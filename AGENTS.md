# Diretrizes e Planejamento do Projeto (AGENTS.md)

## 📌 Projetos e Funcionalidades para Implementação Futura

### 🚀 Sistema de Usuários Descentralizado (BYOB - Bring Your Own Backend)
*Planejado para execução futura a pedido do usuário.*

#### **Conceito & Objetivo**
Permitir que o aplicativo funcione em um modelo multi-tenant descentralizado onde **o código-fonte da aplicação permanece 100% único e centralizado** (qualquer alteração de layout, novas features ou correções no site são aplicadas instantaneamente para todos os usuários), mas **o armazenamento e fluxo de dados pertencem individualmente a cada usuário**.

#### **Credenciais por Usuário**
Ao criar uma conta ou acessar o painel de configurações, o usuário poderá conectar suas próprias credenciais:
1. **Firebase Config**: Provedor do seu próprio banco de dados Firestore (para salvar jogos, histórico, listas).
2. **ImgBB API Key**: Para upload e hospedagem das capas de jogos sem estourar limites do servidor principal.
3. **Google OAuth Tokens / APIs**: Para sincronização com Google Drive, Gmail e YouTube do próprio usuário.

#### **Arquitetura Técnica Recomendada**
- **Camada de Abstração de Dados (`StorageAdapter`)**:
  - Criar uma interface unificada para operações de dados (`getGames`, `saveGame`, `uploadImage`).
  - Implementar adaptadores dinâmicos: `DefaultFirebaseAdapter` (atual) e `UserCustomFirebaseAdapter` (inicializado com a chave do usuário salva em LocalStorage criptografado ou estado de sessão).
- **Assistente Didático de Configuração (Onboarding UI)**:
  - Tela/Modal passo a passo com instruções visuais simples para o usuário gerar suas chaves de API sem dificuldade.
- **Fallbacks Integrados**:
  - Se o usuário não fornecer chaves, a aplicação utilizará a conta/modo local ou de demonstração.

---

## 🎨 Convenções e Estilo do Projeto
- **UI/Layout**: Layout escuro/médio moderno em tons de zinco/cyan, botões de ação e ferramentas em ícones concisos com hover animado.
- **Ampliação de Imagem (Modo Teatro)**: Clique simples na imagem com escala normal fecha o visualizador.
- **Ações de Card de Jogo**: Ícones de controle no canto inferior direito respeitam a paleta cyan (ampliar, editar ficha de jogo e ajustar capa).

---

## ⚔️ World of Warcraft, Addons & Blizzard Ecosystem Guidelines
- **Jogo Principal & Prioridade:** **WoW Forever (Vanilla+)**, com lançamento oficial agendado para **04 de novembro de 2026** (transição de Beta Build 16001). O ambiente do site e do Addon deve estar sempre otimizado prioritariamente para o WoW Forever.
- **Pasta Oficial do WoW Forever Beta (`_classic_beta_`):**
  - **Atenção Crítica:** O nome da pasta do cliente do WoW Forever Beta, apesar de ser WoW Forever, vem escrita no disco como **`_classic_beta_`** (exemplo: `World of Warcraft/_classic_beta_/`). Todos os scripts de exportação, watchers em PowerShell/Batch e guias devem verificar essa pasta prioritariamente.
- **Distinção Rígida de Versões do WoW:**
  - **WoW Forever & Classic Era:** Exibir Banco Pessoal, Economia de Alts, e **Chefes Mundiais (World Boss Timers: Lord Kazzak, Azuregos, Dragões do Pesadelo)**. NUNCA misturar ou renderizar abas de Warband Bank ou Mítico+ / Great Vault (exclusivos do Retail).
  - **WoW Retail (The War Within / Midnight):** Exibir Cofre de Guerra (Warband Bank), Pontuação Mítico+ (Mythic Score & Keystone), e progresso semanal do The Great Vault.
- **Documentação Técnica Canônica & Endpoints de Backend:**
  - O arquivo `/docs/WOW_ADDON_ECOSYSTEM.md` contém todas as 12 fontes oficiais de documentação (incluindo WoW Forever Wiki, Beta Breaks, Better-Addons AI Guide, Deprecated Function Map e Golden Rules).
  - Toda alteração no Addon ou nas interfaces de Armory deve seguir rigorosamente o padrão Anti-Taint, chamadas seguras via `pcall`, e o mapeamento de APIs seguras para Secret Health Values & Dead Secure SNI.
  - Endpoints do Backend dedicados ao Addon:
    - `POST /api/blizzard/wow/addon-sync`: Processamento e ingestão de snapshots do Addon (JSON ou Lua SavedVariables com parser robusto).
    - `GET /api/blizzard/wow/addon-sync/all`: Listagem consolidada de todos os personagens sincronizados e ouro total.
    - `GET /api/blizzard/wow/addon-sync/detect-paths`: Mapeamento de pastas oficiais de instalação de cada versão (`_classic_beta_`, `_classic_era_`, `_classic_`, `_retail_`).
    - `GET /api/blizzard/wow/addon-sync/account-economy`: Agregação de economia de conta e fluxo financeiro de alts.
    - `POST /api/blizzard/wow/addon-sync/clear`: Limpeza segura do cache de sincronização.
