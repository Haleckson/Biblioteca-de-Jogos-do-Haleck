# Reestruturação do Painel de Admin & Central Técnica de Integrações

Reorganizar o **Painel de Admin (SiteSettingsModal)** em uma Central de Controle Técnico expandida (ocupando 95% do espaço de tela), com barra lateral vertical de categorias à esquerda e painel de controle amplo à direita, integrando todas as configurações do Addon WoW e o Simulador In-Game na aba dedicada da Blizzard.

---

## Decisões Confirmadas & Respostas do Usuário

> [!IMPORTANT]
> **Decisões confirmadas na Etapa 1:**
> - **Navegação Principal**: Menu lateral vertical fixo à esquerda ($260\text{px}$) com painel de conteúdo técnico amplo à direita (layout 95% do viewport: `w-[95vw] h-[95vh] max-w-[1750px]`).
> - **Estrutura da Categoria Blizzard**: Dividida em 3 sub-abas técnicas limpas e especializadas:
>   1. `Autenticação & Contas`: Battle.net OAuth permanente, credenciais Client ID/Secret, BattleTag, status do token e listener automático.
>   2. `Addon & Sincronização`: Download do Addon Universal v4.0.0, scripts do Agente Local (.bat / .ps1), ingestão de SavedVariables e estúdio de desenvolvimento (Dev Studio).
>   3. `Simulador In-Game`: Simulador interativo in-game embutido diretamente na tela com alternância entre dados reais e de exemplo, controle de extração e Meu Diário de Aventura.

---

## 1. Visão Geral & Conceito

- **O que faz**: Transforma o modal de configurações em um console de administração técnico profissional de alta densidade (95% do viewport), separando a responsabilidade de **configuração técnica e gerenciamento de integrações** (exclusiva do Admin) da **experiência de jogo e exploração de dados** (páginas dos jogos e Armory).
- **Público-alvo**: Administrador do catálogo e jogadores de WoW/Steam/GOG configurando suas credenciais com clareza técnica e sem sobreposição de botões ou textos.
- **Valor Principal**: Elimina sobrecargas visuais na visualização do jogo, remove elementos duplicados e organiza cada plataforma de forma modular e expansível.

---

## 2. Experiência do Usuário & Design Visual

### A. Layout Espacial & Proporção (95% do Viewport)
- **Container**: `w-[95vw] h-[95vh] max-w-[1750px] bg-[#0b0d14] border border-cyan-500/30 rounded-3xl flex flex-col shadow-2xl overflow-hidden`.
- **Top Header**: Breadcrumb técnico com indicador de conexão das APIs, perfil do admin e botão de fechar acessível com atalho `Esc`.
- **Corpo Dividido**:
  - **Barra Lateral Esquerda ($260\text{px}$)**:
    - Botões de categoria com ícones específicos de plataforma, contador de jogos/serviços ativos e estado de seleção ciano/azul:
      - ⚔️ **Blizzard & Battle.net** (OAuth, Armory, Addon v4.0.0, Simulador)
      - 🎮 **Steam Web API** (Credenciais Steam, SteamID64, Cache)
      - 👾 **GOG Galaxy** (Login Direto OAuth, Username, API Key)
      - 🎨 **Mídia & Metadados** (IGDB/Twitch, SteamGridDB, ImgBB, YouTube, Drive, Gmail)
      - ⚙️ **Sistema & Manutenção** (Efeitos de Som Retrô, Diagnóstico, Lixeira, Logs de Auditoria, Logout)
  - **Painel de Conteúdo Amplo à Direita (Flex-1)**:
    - Espaço de trabalho amplo com rolagem suave (`custom-scrollbar`), cartões de nível único com borda sutil de 1px e zero sobreposição.

### B. Sub-abas Técnicas da Blizzard
```
┌────────────────────────────────────────────────────────────────────────┐
│ [Autenticação & Contas]   [Addon & Sincronização]   [Simulador In-Game]│
└────────────────────────────────────────────────────────────────────────┘
```
1. **Autenticação & Contas**:
   - Card de Conexão Battle.net OAuth com botão direto, BattleTag ativo, expiração do token e renovação.
   - Seletor de Região (US, EU, KR, TW) e campos de Client ID / Client Secret personalizados com máscara de proteção.
   - Diagnosticador de Redirect URIs permitidas pela Blizzard (`/auth/blizzard/callback`).
2. **Addon & Sincronização**:
   - Gerador do pacote `.zip` do Addon HaleckAccountImporter com seletor de versão (WoW Forever Beta `_classic_beta_`, Classic Era, Retail).
   - Scripts do Agente Local de Sincronização Automática em segundo plano (`.bat` para Windows e `.ps1` para PowerShell).
   - Ingestor de arquivos `SavedVariables/HaleckAccountImporter.lua` e leitor da API local `/api/blizzard/wow/addon-sync`.
   - Botão para o **Dev Studio** (estúdio de criação de addons com templates e documentação canônica).
3. **Simulador In-Game**:
   - Acesso e controle completo do simulador in-game diretamente no Admin, com renderização da janela do addon in-game, seletor de dados reais vs exemplo, Central de Extração e Meu Diário de Aventura.

### C. Limpeza das Páginas dos Jogos
- Remoção do botão de pré-visualização do Addon na tela principal do Armory (`WoWArmoryView`), mantendo apenas um atalho discreto que abre o Admin na aba Blizzard quando o usuário quiser gerenciar configurações ou o addon.

---

## 3. Decisões de Produto & Arquitetura de Interface

- **Decisão 1: Menu Lateral Fixo em vez de Abas no Topo**:
  - *Abordagem*: Barra lateral vertical à esquerda com largura fixa de $260\text{px}$ e rolagem interna no painel direito.
  - *Por que*: Com a expansão para 95% da tela, uma barra lateral oferece espaço proporcional para rótulos legíveis, métricas de status por plataforma e navegação ágil sem aglomerar o cabeçalho.
- **Decisão 2: Sub-abas Especializadas para a Blizzard**:
  - *Abordagem*: Dividir a complexidade do ecossistema Blizzard (OAuth + Addon ZIP + Sync Server + Simulador) em 3 sub-abas limpas.
  - *Por que*: Evita que uma tela longa de formulários e instruções técnicas sobreponha o simulador e o download do addon.
- **Decisão 3: Reorganização das Outras Categorias (Steam, GOG, Mídia, Sistema)**:
  - *Abordagem*: Cada categoria ganha seu espaço dedicado com formulários organizados em grids de 2 colunas, testes de conexão com feedback visual imediato e sem botões sobrepostos.

---

## 4. Diagrama de Arquitetura do Painel de Admin

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PAINEL DE ADMIN (SiteSettingsModal - 95vw x 95vh)                                      │
├─────────────────────┬──────────────────────────────────────────────────────────────────┤
│ BARRA LATERAL (260px)│ PAINEL TÉCNICO DIREITO (Flex-1, Scrollable)                      │
│                     │                                                                  │
│ [⚔️ Blizzard]  ───► │ Sub-Abas: [Autenticação] | [Addon & Sync] | [Simulador In-Game]  │
│                     │ ├─ Autenticação: Battle.net OAuth, BattleTag, Client ID/Secret   │
│                     │ ├─ Addon & Sync: Download .ZIP, Scripts .bat/.ps1, SavedVars Ingest│
│                     │ └─ Simulador: Central de Extração + Meu Diário de Aventura      │
│                     │                                                                  │
│ [🎮 Steam]     ───► │ Formulário Steam Web API, SteamID64, Cache de Jogos              │
│                     │                                                                  │
│ [👾 GOG Galaxy]───► │ Login OAuth GOG, Perfil, Chave API, Sincronização de Biblioteca  │
│                     │                                                                  │
│ [🎨 Mídia & APIs]──► │ IGDB/Twitch (Rate limits), SteamGridDB, ImgBB, Drive, YouTube   │
│                     │                                                                  │
│ [⚙️ Sistema]    ───► │ Áudio Retrô, Diagnóstico, Lixeira, Auditoria de Backup, Logout  │
└─────────────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## 5. Plano de Execução & Verificação

1. **Refatorar `SiteSettingsModal.tsx`**:
   - Ajustar container principal para `w-[95vw] h-[95vh] max-w-[1750px]`.
   - Adicionar estado de categoria principal: `activeCategory: "blizzard" | "steam" | "gog" | "media" | "system"`.
   - Implementar a barra lateral vertical fixa com ícones e status.
   - Criar as 3 sub-abas da categoria Blizzard (`auth`, `addon_sync`, `simulator`).
   - Mover os módulos de download do addon, tutorial, Dev Studio e o Simulador In-Game (`WoWAddonPreviewModal`) para dentro do painel da Blizzard.
   - Organizar as categorias Steam, GOG, Mídia e Sistema em grids com espaçamento adequado sem sobreposições.
2. **Ajustar `WoWArmoryView.tsx`**:
   - Remover os botões redundantes de simulação espalhados na barra de tabs do Armory, substituindo por link/atalho que direciona para a Central de Admin da Blizzard.
3. **Validação & Testes**:
   - Compilação via `compile_applet`.
   - Verificação de tipos via `lint_applet`.
   - Teste de alternância entre todas as categorias e sub-abas.
