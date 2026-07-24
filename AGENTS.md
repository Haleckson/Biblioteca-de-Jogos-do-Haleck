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
