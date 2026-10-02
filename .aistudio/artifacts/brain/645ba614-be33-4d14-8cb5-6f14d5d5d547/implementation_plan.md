# Plano de Implementação: Seletor de Diretório WoW Forever e Exportação com Dry-Run de Integridade

Este plano detalha a implementação das ferramentas solicitadas na aba técnica **Blizzard** do Painel de Admin, garantindo a integração perfeita com o cliente **WoW: Forever (Vanilla+ Build 16001)** e a verificação rigorosa de integridade de SavedVariables antes da ingestão de dados.

---

## 1. Seletor de Diretório Local do WoW Forever com Botões 'Instalar Addon' e 'Atualizar Addon'

### 1.1 Explorador de Pastas Nativo com Resolução Inteligente
- **Integração com File System Access API (`window.showDirectoryPicker`):**
  - Adicionar botão **"Procurar Pasta..."** que abre o explorador de arquivos nativo do sistema operacional.
  - Fallback universal via `<input type="file" webkitdirectory directory />` para navegadores que não suportam a API de acesso direto ao sistema de arquivos.
  - **Resolução Automática da Estrutura do Jogo:**
    - Se o usuário selecionar a pasta raiz do WoW (`World of Warcraft`), o sistema detecta prioritariamente a subpasta oficial do WoW Forever (`_classic_beta_`) e aponta para `_classic_beta_/Interface/AddOns/HaleckAccountImporter`.
    - Se selecionar a pasta `_classic_beta_`, adiciona `Interface/AddOns/HaleckAccountImporter`.
    - Se selecionar `Interface/AddOns`, adiciona a subpasta do addon.
- **Campo de Texto & Atalhos de Presets:**
  - Manter campo de texto editável com o caminho absoluto para flexibilidade total.
  - Botões de atalho rápido para os caminhos padrão do Windows (Drives `C:` e `D:`).

### 1.2 Botões Claros e Distintos: 'Instalar Addon' e 'Atualizar Addon'
- **Botão 'Instalar Addon' (Haleck Account Importer):**
  - Cria o diretório `HaleckAccountImporter/` na pasta `Interface/AddOns` do jogo e grava a versão v4.1.0 completa (`.toc`, `HaleckAccountImporter.lua` e `AddonInterface.lua`).
  - Fornece feedback visual imediato de sucesso ou download automático do script `.BAT`/`.PS1` de 1 clique caso o diretório pertença ao cliente local do Windows.
- **Botão 'Atualizar Addon' (Haleck Account Importer):**
  - Inspeciona os arquivos existentes no caminho configurado, compara o hash/versão com a v4.1.0 e sobrescreve atomicamente apenas os scripts executáveis do addon.
  - **Garantia de Segurança:** Mantém 100% intactas as pastas `WTF/SavedVariables/` e os dados do usuário.

---

## 2. Função de Exportação de Dados & Dry-Run de Integridade de Quests e Itens

### 2.1 Função de Exportação de Dados na Aba de Configurações
- Botão **"Exportar Dados do Addon (.lua / .json)"**:
  - Exporta os dados atuais do personagem ou do armory para o formato oficial de SavedVariables (`HaleckAccountImporter.lua` com tabela `HaleckAccountImporterDB = { ... }`), pronto para ser colocado diretamente na pasta `WTF/Account/<Conta>/SavedVariables/` do jogo.
  - Suporte adicional para exportar em formato JSON limpo para auditoria externa.

### 2.2 Leitor de SavedVariables e Verificador de Schema
- Campo de inserção flexível: Upload de arquivo (`.lua` ou `.json`) ou colar texto bruto.
- **Auditoria Rigorosa de Quests Conforme o Schema:**
  - Validação de IDs inteiros de missões (`questID > 0`).
  - Verificação de títulos, objetivos, status de conclusão e timestamps.
  - Detecção de registros incompletos ou órfãos com alertas claros de formato.
- **Auditoria Rigorosa de Itens & Equipamentos:**
  - Validação de cada slot de equipamento (1 a 19: Head, Neck, Shoulders, Chest, MainHand, OffHand, etc.).
  - Checagem de integridade de `itemID`, `itemLevel`, raridade/qualidade e `display_id` de transmog.
  - Validação de bolsas e banco pessoal.

### 2.3 Painel de Dry-Run com Badges de Conformidade e Auditoria Item a Item
- Ao clicar em **"Executar Dry-Run de Integridade"**:
  - Análise em tempo real do conteúdo sem gravar imediatamente no banco.
  - Exibição de painel visual com:
    - Badge Geral: *"Schema 100% Válido"* (Verde) ou *"Requer Atenção"* (Amarelo/Vermelho).
    - 4 Badges de Métricas: Quests Concluídas vs Ativas, Conquistas, Coleções e Equipamento.
    - Tabela de Auditoria Item por Item: cada quest ou item analisado recebe um badge (*Válido*, *Aviso de Formato* ou *Erro Crítico*) acompanhado da descrição exata do campo inconsistente.
  - Botão **"Confirmar & Importar Dados para o Site"**:
    - Fica ativo apenas após a conclusão bem-sucedida do dry-run, garantindo que nenhum dado corrompido seja inserido no banco do armory.

---

## 3. Ordem de Execução das Modificações

1. **Atualizar `SiteSettingsModal.tsx`:**
   - Adicionar manipulador do seletor nativo de diretório (`showDirectoryPicker` e input fallback).
   - Separar e estilizar os botões **"Instalar Addon"** e **"Atualizar Addon"** com ações e feedbacks distintos.
   - Aprimorar o painel do **Dry-Run** com badges de conformidade por item e auditoria estrita de quests e itens conforme o schema.
2. **Atualizar `wowSavedVariablesIntegrity.ts` & `addonExportService.ts`:**
   - Adicionar regras específicas de auditoria detalhada de quests e slots de itens.
   - Adicionar helper de exportação em múltiplos formatos (.lua e .json).
3. **Verificação & Testes:**
   - Executar `lint_applet` e `compile_applet` para assegurar build sem erros.
