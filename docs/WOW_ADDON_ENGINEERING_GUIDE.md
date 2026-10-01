# Guia Canônico de Engenharia e Arquitetura de AddOns WoW
## Master Blueprint: Análise de 19 AddOns de Referência, Padrões de Interface & Boas Práticas (WoW Forever / Classic / Retail)

Este documento técnico consolida a análise aprofundada da estrutura, opções de interface e funcionalidades de **19 addons e bibliotecas renomadas** do ecossistema World of Warcraft. Ele atua como manual de engenharia interna para orientar qualquer processo de criação, refatoração, expansão ou vibe-coding de addons no projeto (seja no AI Studio ou em outros ambientes de desenvolvimento), assegurando máxima estabilidade, conformidade com a Blizzard API e fidelidade visual ao **WoW Forever (Build 16001 / `_classic_beta_`)**.

---

## 🧭 Sumário Executivo dos 19 AddOns e Bibliotecas Analisados

| # | Addon / Biblioteca | Autor / Fonte | Foco Principal | Paradigma de UI | Modelo de Dados |
|---|---|---|---|---|---|
| **1** | **Azeroth Fieldbook** | Spinkler (GitHub) | Diário de campo, bestiário, pesca e atlas | Fundo pergaminho/couro imersivo | `SavedVariablesPerCharacter` + Backup DB |
| **2** | **Character Memoir (Karakter Anıları)** | Comunidade (CurseForge) | Crônica de vida, marcos de níveis e relações | Estilo livro de memórias clássico | Diário cronológico de eventos e mortes |
| **3** | **AllTheThings (ATT)** | Crieve / ATTWoWAddon (GitHub) | Rastreamento exaustivo de coleções e completismo | Árvore hierárquica multi-nível (TreeGroup) | Banco relacional massivo em tabelas Lua |
| **4** | **Forever Field Journal** | Comunidade (CurseForge) | Diário de bordo nativo para WoW Forever | Canvas clássico Vanilla com fotos 3D | Captura por marcos de nível e zonas |
| **5** | **Echoes of Azeroth CCG** | Anasya (CurseForge) | Mini-game in-game colecionável de cartas (CCG) | Layout de tabuleiro e cartas personalizadas | Coleção de cartas com perfis de áudio |
| **6** | **Questie** | Questie Team (GitHub) | Assistente de missões clássico nº 1 do mundo | Ícones no mapa mundi e minimapa (`HereBeDragons`) | Banco relacional SQLite compilado para Lua |
| **7** | **Horizon-Suite** | Tacit Labs (GitHub) | Suíte modular de interface, radar e produtividade | Design flat/dark moderno e limpo | Arquitetura modular com profiles desacoplados |
| **8** | **AtlasLoot Classic** | Hoizame / AtlasLoot Team (GitHub) | Catálogo de saques de masmorras, raides e PvP | Janela com abas duplas, dropdowns e painéis de loot | Módulos `LoadOnDemand: 1` por expansão |
| **9** | **EllesmereUI** | EllesmereGaming (GitHub) | Interface completa de combate, estilo e unit frames | Molduras modernas com estilo dinâmico | Configurações granulares de skins e texturas |
| **10** | **BugSack** | Funkeh (GitHub) | Coletor de erros Lua silencioso com saco de pulgas | Janela popup de log com scroll e atalhos | Fila de stack traces persistida por sessão |
| **11** | **Ace3** | WoWUIDev (GitHub) | Framework de desenvolvimento padrão da indústria | `AceGUI-3.0`, `AceConfig-3.0` | `AceDB-3.0` com herança e profiles |
| **12** | **LibCandyBar-3.0** | BigWigs Team (CurseForge) | Barras de progresso e cronômetros com animação | Barras temporizadas animadas com ícones | Pool de objetos reciclados na memória |
| **13** | **LibDBIcon-1.0** | Torhal / Funkeh (CurseForge) | Gerenciador canônico de botões de minimapa | Botão orbital 360° em volta do minimapa | Armazenamento de ângulo e visibilidade |
| **14** | **LibSink-2.0** | Rabbit (CurseForge) | Roteamento de notificações e alertas de texto | Redirecionamento para Chat, SCT, MSBT ou RaidWarning | Sem persistência (driver de saída) |
| **15** | **Attune** | Caelen / Attune Team (CurseForge) | Rastreador de requisitos (attunements) de raides | Fluxogramas visuais em árvore e matriz de guilda | Gravação de etapas de quests completadas |
| **16** | **Chonky Character Sheet** | Wago/CurseForge | Reformulação visual expandida da ficha de personagem | Ficha de equipamentos de alta fidelidade visual | Dados ao vivo do inventário com iLvl |
| **17** | **DataStore** | Thaoky (GitHub / CurseForge) | Camada unificada de dados de alts e contas | Biblioteca de backend sem interface direta | Tabela multi-personagem desacoplada em módulos |
| **18** | **DungeonJournal (Classic/Forever)** | ExehnTV / Bosheda (CurseForge) | Adventure Guide clássico de chefes e mapas | Estilo compêndio de masmorras com mapas pintados | Banco de dados estático de drops e quests |
| **19** | **Midnight Routine (Routine)** | Comunidade (CurseForge) | Painel de tarefas semanais, checklist e alts | Matriz de checklist com badges coloridos | Snapshots semanais com reset automatizado |

---

## 🔍 Análise Detalhada dos 19 AddOns & Aprendizados de Engenharia

### 1. Azeroth Fieldbook (Spinkler)
- **O que faz:** Transforma o jogo em uma expedição científica. Registra um Bestiário detalhado de cada monstro enfrentado, catálogo de pesca (*Angling*), atlas cartográfico de exploração e livro de tesouros.
- **Interface & UX:**
  - Janela em formato de livro antigo com tons de couro escuro (`ink`, `inkShadow`) e suporte a redimensionamento de fonte (`TextSize.lua`).
  - Cada seção (Monstros, Pesca, Lore, Tesouro) possui sua própria aba lateral customizada e barra de busca instantânea.
  - Animação e destaque em ícones 3D com molduras personalizadas.
- **Estrutura Técnica:**
  - TOC configurado com `## Interface: 16001` (mesma versão do WoW Forever).
  - Isolamento estrito por `local addonName, ns = ...`.
  - Módulos utilitários independentes: `WindowPositions.lua`, `UIScale.lua`, `MapBrightness.lua`, `Scrollbars.lua`.
  - Separação clara entre `SavedVariablesPerCharacter` (progresso pessoal) e `SavedVariables` (backups da conta).
- **Lição para o Nosso Addon:** O design de livro/diário de campo com abas dedicadas e busca instantânea é o padrão ideal para o nosso "Meu Diário de Aventura". A persistência de posição da janela (`WindowPositions`) garante que a UI abra onde o jogador deixou.

### 2. Character Memoir (Karakter Anıları)
- **O que faz:** Cria uma crônica viva da história do personagem, registrando datas de marcos de nível (ex: onde o jogador estava ao pegar nível 20, 40 ou 60), primeiras mortes em combate, encontros marcantes com outros jogadores e zonas desbravadas.
- **Interface & UX:**
  - Interface minimalista com estética de pergaminho antigo.
  - Linha do tempo visual cronológica com ícones de marcos (espadas para combate, caveira para morte, livro para quests).
- **Estrutura Técnica:**
  - Escuta rigorosa de eventos de ciclo de vida (`PLAYER_LEVEL_UP`, `PLAYER_DEAD`, `ZONE_CHANGED_NEW_AREA`).
  - Armazenamento em listas indexadas com timestamp humano (`date("%Y-%m-%d %H:%M:%S")`) e época Unix (`time()`).
- **Lição para o Nosso Addon:** A linha do tempo da nossa aba "Meu Diário de Aventura" implementa exatamente essa filosofia: transformar ações triviais em crônica histórica eterna.

### 3. AllTheThings (ATT)
- **O que faz:** O addon mais completo de completismo do WoW. Rastreia mais de 100.000 itens colecionáveis, aparências de transmog, brinquedos, montarias, mascotes, títulos, missões, receitas de profissão e exploração.
- **Interface & UX:**
  - Estrutura de árvore colapsável profunda (`TreeGroup` do AceGUI) com porcentagens dinâmicas de conclusão por zona e categoria.
  - Mini-janelas auxiliares destacáveis para foco em masmorras específicas.
- **Estrutura Técnica:**
  - O banco de dados é fragmentado em centenas de arquivos categorizados por expansão e zona.
  - Uso massivo de bitmasks para economizar memória ao salvar milhares de flags booleanas de missões concluídas.
  - Mecanismo avançado de reconciliação de dados entre personagens da mesma conta.
- **Lição para o Nosso Addon:** O nosso motor ATT de varredura profunda no `HaleckAccountImporter.lua` utiliza essa mesma abordagem para catalogar missões completadas via `GetQuestsCompleted()` / `C_QuestLog.GetAllCompletedQuestIDs()`.

### 4. Forever Field Journal
- **O que faz:** Addon focado especificamente na comunidade do **WoW Forever Beta**, unindo o conceito de diário de campo do Vanilla+ com anotações automáticas de monstros e chefes mundiais (Lord Kazzak, Azuregos, etc.).
- **Interface & UX:**
  - Integração perfeita com a paleta clássica de ardósia e ouro Blizzard.
  - Pré-visualização de modelos 3D do personagem no momento do registro.
- **Estrutura Técnica:**
  - Otimizado para não disparar taints em combates do Vanilla+.
  - Utiliza `pcall` defensivo em todas as consultas de combate para suportar `Secret Health Values` e `Dead Secure SNI`.
- **Lição para o Nosso Addon:** A segurança de chamadas protegidas que adotamos no `HaleckAccountImporter.lua` nasceu diretamente das lições do Forever Field Journal para evitar crashes durante raides e encontros de chefes de mundo.

### 5. Echoes of Azeroth CCG
- **O que faz:** Implementa um jogo de cartas colecionáveis dentro do WoW. Os jogadores encontram pacotes de cartas derrotando monstros e chefes, montam decks e duelam com amigos através de canais ocultos de addon.
- **Interface & UX:**
  - Molduras personalizadas para cartas de raridade variada (Comum, Rara, Épica, Lendária).
  - Feedback sonoro dramático ao abrir pacotes e invocar criaturas.
- **Estrutura Técnica:**
  - Comunicação peer-to-peer usando `C_ChatInfo.SendAddonMessage` ou `SendAddonMessage`.
  - Serialização binária compacta para transmitir dados de baralhos e turnos sem exceder limites do chat.
- **Lição para o Nosso Addon:** O uso de sons envolventes (`SOUNDKIT`) e feedback tátil em cada ação reforça que uma boa UI de WoW deve parecer parte nativa do jogo, não uma aplicação web externa flutuando na tela.

### 6. Questie
- **O que faz:** O addon mais popular de missões do Classic WoW. Mostra onde pegar missões, locais de objetivos, monstros a caçar e recompensas de itens diretamente no mapa e minimapa.
- **Interface & UX:**
  - Pins customizados de alta densidade no mapa mundi com tooltips ricos contendo frações de objetivos (ex: "Presas de Javali 3/8").
  - Painel lateral de rastreamento com ordenação por proximidade geográfica.
- **Estrutura Técnica:**
  - Utiliza a biblioteca `HereBeDragons` para converter coordenadas de zonas 2D em distâncias vetoriais 3D em jardas.
  - Carregamento assíncrono do banco de dados de quests para evitar travamentos de tela (frame drops) durante o login.
  - Mapeamento refinado de pré-requisitos de missões (quest chains).
- **Lição para o Nosso Addon:** O cálculo de distância e passos que implementamos no diário de bordo usa a mesma trigonometria vetorial do Questie (`math.sqrt((dx*dx) + (dy*dy))`), traduzindo jardas em passos autênticos.

### 7. Horizon-Suite (Tacit Labs)
- **O que faz:** Uma suíte moderna e modular de produtividade, radar e visualização de mundo para WoW.
- **Interface & UX:**
  - Estilo flat visualmente arrojado, com cartões escuros translúcidos, tipografia nítida e ícones customizados.
  - Janelas com abas suaves, busca preditiva e painel de diagnóstico em tempo real (`LoggerPanel.lua`).
- **Estrutura Técnica:**
  - Estrutura de diretórios exemplar: `core/`, `modules/`, `options/`, `media/`, `locales/`, `tools/`.
  - Sistema de migrações de banco de dados (`core/migrations/`) para garantir que atualizações de versão não corrompam configurações antigas do jogador.
  - Utilitários dedicados para cópia de URL/código (`UrlCopyDialog.lua`).
- **Lição para o Nosso Addon:** O modal de exportação com `EditBox` auto-selecionável e opção de compactação Base64 que implementamos no `ShowExportDialog` segue exatamente a arquitetura do `UrlCopyDialog` do Horizon-Suite.

### 8. AtlasLoot Classic / Continued
- **O que faz:** A enciclopédia definitiva de itens e saques de chefes de World of Warcraft, permitindo ver tudo o que cada chefe dropa, sets de armadura, profissões e recompensas de reputação.
- **Interface & UX:**
  - Janela dividida em painéis: seletor de masmorra à esquerda, lista de chefes e itens com ícones e links clicáveis à direita.
  - Suporte nativo a Shift+Clique para linkar itens no chat e Ctrl+Clique para provador 3D (DressUpFrame).
- **Estrutura Técnica:**
  - Cada expansão ou módulo é empacotado em um diretório próprio com `## LoadOnDemand: 1` (`AtlasLootClassic_DungeonsAndRaids`, `AtlasLootClassic_Crafting`).
  - As tabelas de itens armazenam apenas IDs inteiros, resolvendo nomes e ícones através da cache do cliente (`GetItemInfo`), o que mantém o tamanho do addon em poucos megabytes.
- **Lição para o Nosso Addon:** Nosso serializador de equipamentos armazena primordialmente Item IDs, delegando a resolução de atributos pesados para o motor e para o nosso banco de dados relacional DB2 no backend.

### 9. EllesmereUI
- **O que faz:** Uma interface gráfica completa e de alto nível desenvolvida pelo jogador Ellesmere (MDI / Mythic+ Champion).
- **Interface & UX:**
  - Visual ultra-moderno e limpo, focado em clareza absoluta de informação sem poluição visual.
  - Uso de cartões de estilo (`StyleCards`), popups contextuais e barras personalizadas.
- **Estrutura Técnica:**
  - Código desacoplado em regras de visibilidade (`EllesmereUI_VisibilityRules.lua`), skins de janela e gerenciamento de ticks de performance (`EllesmereUI_Ticker.lua`).
  - Utiliza texturas em formato `.tga` e `.blp` de alta resolução com mascaramento suave de bordas.
- **Lição para o Nosso Addon:** A padronização de cartões escuros com realce ciano/ouro e tipografia com sombras duplas (`ink`, `inkShadow`) foi inspirada na precisão gráfica do EllesmereUI.

### 10. BugSack & !BugGrabber
- **O que faz:** Captura silenciosamente todos os erros de execução em Lua disparados por qualquer addon no cliente, impedindo que popups irritantes da Blizzard interrompam o combate.
- **Interface & UX:**
  - Janela minimalista de inspeção com lista de erros, botão de copiar stack trace completo e contador sonoro no minimapa.
- **Estrutura Técnica:**
  - Possui um arquivo explícito `forever.lua` declarando suporte nativo ao **WoW Forever** (`addonTable.isForever = true`).
  - Integração via `LibDBIcon-1.0` para exibir um saco de pulgas no minimapa que fica vermelho ao detectar falhas.
- **Lição para o Nosso Addon:** A inclusão de `16001` no TOC do BugSack confirma o padrão canônico da versão do WoW Forever e reforça a importância de um botão de minimapa dinâmico.

### 11. Ace3 (Framework Canônico da Blizzard UI Community)
- **O que faz:** A espinha dorsal da maioria dos grandes addons de WoW há mais de 15 anos. Provê módulos padronizados para ciclo de vida, eventos, bancos de dados, opções gráficas e comunicação.
- **Módulos Principais:**
  - `AceAddon-3.0`: Ciclo de vida previsível (`OnInitialize`, `OnEnable`, `OnDisable`).
  - `AceEvent-3.0`: Despachante seguro de eventos do jogo com isolamento de erros.
  - `AceDB-3.0`: Sistema robusto de persistência com perfis (`Default`, `Character`, `Realm`), migrações e herança de tabelas.
  - `AceGUI-3.0`: Biblioteca de mais de 30 widgets prontos (Button, EditBox, Dropdown, Slider, TabGroup, TreeGroup).
  - `AceConfig-3.0`: Gera painéis de opções inteiros automaticamente a partir de uma simples tabela declarativa de opções Lua.
  - `AceBucket-3.0`: Agrupamento de eventos frequentes (ex: consolidar 15 eventos de `BAG_UPDATE` em apenas uma execução após 0.2 segundos).
- **Lição para o Nosso Addon:** O agrupamento de eventos (*throttling/bucket*) é essencial para varreduras de inventário e banco, evitando lag spikes quando o jogador abre as bolsas ou move múltiplos itens rapidamente.

### 12. LibCandyBar-3.0
- **O que faz:** Biblioteca ultrarrápida para barras temporizadas e cronômetros com ícone e texto animado (usada em addons como BigWigs e LittleWigs).
- **Interface & UX:** Barras deslizantes com gradientes de cor suaves, animação de expiração e formatação inteligente de tempo (`3m 12s`, `45.2s`).
- **Engenharia:** Reutilização agressiva de frames usando *object pooling* para que nenhuma tabela ou textura nova precise ser instanciada durante o combate.
- **Lição para o Nosso Addon:** Nosso monitor de World Bosses do WoW Forever utiliza a lógica de formatação de janelas temporais do LibCandyBar para exibir a contagem regressiva precisa de 72h a 96h para Kazzak e Azuregos.

### 13. LibDBIcon-1.0
- **O que faz:** A biblioteca padrão para botões de minimapa no World of Warcraft.
- **Engenharia:**
  - Conecta qualquer objeto `LibDataBroker` a um botão ancorado no anel do minimapa.
  - Calcula o ângulo polar radial automaticamente em função da posição do cursor do mouse (`math.atan2(cy - my, cx - mx)`).
  - Salva o ângulo polar em uma chave numérica simples no `SavedVariables` (`db.minimapPos = angle`).
- **Lição para o Nosso Addon:** Nosso botão de minimapa em `AddonInterface.lua` foi programado com este exato cálculo trigonométrico, garantindo arrasto 360° fluido ao redor do minimapa e salvamento imediato do ângulo.

### 14. LibSink-2.0
- **O que faz:** Biblioteca de saída flexível que permite ao jogador escolher onde quer receber notificações do addon (no chat principal, em uma aba privada de whisper, no meio da tela como Raid Warning, ou através de addons de Scrolling Combat Text).
- **Lição para o Nosso Addon:** Dá ao usuário a liberdade de silenciar avisos no chat ou redirecioná-los de forma discreta.

### 15. Attune
- **O que faz:** O addon essencial para Classic e TBC que rastreia os "attunements" (pré-requisitos de acesso a masmorras e raides épicas, como a chave de Onyxia, o selo de Molten Core e a cadeia de Karazhan).
- **Interface & UX:** Interface tipo checklist com barra de progresso percentual e nós de missões interconectados.
- **Lição para o Nosso Addon:** Rastrear o avanço de missões essenciais de acesso ao endgame do WoW Forever (como as cadeias de acesso a Molten Core e Blackwing Lair) através do nosso módulo de Quests ATT.

### 16. Chonky Character Sheet
- **O que faz:** Substitui a tradicional ficha de personagem (`CharacterFrame`) por um painel largo de alta fidelidade visual, exibindo simultaneamente todos os atributos, durabilidade de itens, encantamentos ativos, gemas e status de masmorras.
- **Interface & UX:**
  - Layout dividido em 3 colunas: equipamentos da esquerda, modelo 3D central rotacionável, equipamentos da direita e painel dobrável de atributos detalhados.
- **Lição para o Nosso Addon:** A nossa subcategoria 8 do diário de aventura ("📈 Estatísticas do Jogo") adota essa clareza visual para listar atributos primários (Força, Agilidade, etc.) e secundários (Crítico, Poder Mágico, Armadura) com ícones vívidos.

### 17. DataStore (Thaoky)
- **O que faz:** A biblioteca fundamental que alimenta o famoso addon de alts *Altoholic*.
- **Estrutura Técnica:**
  - Arquitetura completamente modular: `DataStore_Characters`, `DataStore_Containers` (bolsas e banco), `DataStore_Quests`, `DataStore_Spells`, `DataStore_Talents`, `DataStore_Reputations`.
  - Permite que qualquer script acerte perguntas como: *"Quantas barras de ferro eu tenho em todos os meus alts?"* ou *"Qual alt tem a chave de Scholomance?"*.
  - Chave de indexação padronizada: `DataStore:GetCharacter("NomeDoAlt", "NomeDoReino")`.
- **Lição para o Nosso Addon:** O nosso formato `HaleckAccountImporterDB.characters["Nome-Reino"]` foi inspirado diretamente no DataStore, garantindo que você possa deslogar de um personagem, logar em outro, e o SavedVariables preserve os dados de ambos sem sobrescrever!

### 18. DungeonJournal (Classic / WoW Forever)
- **O que faz:** Traz para o Vanilla e WoW Forever a experiência moderna do *Almanaque de Masmorras* (Adventure Guide), apresentando a lista de chefes de cada masmorra, suas habilidades e itens de saque.
- **Interface & UX:** Fundo pergaminho com ilustrações dos chefes e abas de dificuldade (Normal / Heroico).
- **Lição para o Nosso Addon:** A nossa aba de "Chefes & Caçadas" complementa o DungeonJournal registrando a contagem pessoal de vitórias do próprio jogador contra cada chefe.

### 19. Midnight Routine (Routine)
- **O que faz:** Um painel de tarefas e rotina periódica do jogador (checklist de missões semanais, chefes mundiais derrotados na semana, bloqueios de raide e progresso de profissões).
- **Interface & UX:** Checklist interativo com marcação automática em verde ao concluir cada atividade e botão de reset manual.
- **Lição para o Nosso Addon:** O nosso detector de World Bosses adota a mesma lógica de status (`active` / `killed` / `respawning`) para dar ao jogador certeza de quais chefes já foram abatidos na semana.

---

## 🏗️ Padrões Canônicos de Engenharia para Criação de AddOns

### 1. Prevenção Absoluta de Taint (Regra de Ouro)
Nunca declare variáveis globais soltas. O arquivo Lua principal recebe automaticamente do FrameXML dois argumentos fundamentais:
```lua
local ADDON_NAME, addon = ...
addon = addon or {}
```
Qualquer tabela, função ou estado compartilhado entre os arquivos do mesmo addon deve viver dentro de `addon` ou `ns` (namespace do addon), **nunca em `_G`**, a menos que seja uma API pública explícita ou o nome do frame declarado no XML/TOC.

### 2. Chamadas Defensivas com `pcall`
Em clientes em evolução (como o WoW Forever Beta Build 16001), funções podem mudar de assinatura ou retornar nil em combates protegidos (`Secret Health Values`). O padrão canônico para chamadas seguras é:
```lua
local function SafeCall(fn, ...)
    if not fn then return nil end
    local ok, res1, res2 = pcall(fn, ...)
    if ok then return res1, res2 end
    return nil
end
```

### 3. O Ciclo da Memória vs Gravação no Disco (SavedVariables)
No motor de World of Warcraft:
1. `HaleckAccountImporterDB` é mantida **exclusivamente em memória RAM** durante toda a partida.
2. A escrita física no disco (`WTF\Account\<Conta>\SavedVariables\HaleckAccountImporter.lua`) **só ocorre quando**:
   - O jogador executa `/reload` (ou `ReloadUI()`).
   - O jogador desloga para a tela de seleção de personagens (`/logout`).
   - O jogador encerra o cliente normalmente (`/exit` ou `/quit`).
3. **Padrão de UX para o Botão "Salvar Dados":**
   Sempre que o usuário clicar em "Salvar Dados" dentro do jogo:
   - Gerar o snapshot em `HaleckAccountImporterDB`.
   - Oferecer um botão explícito de **`[⚡ Recarregar UI (/reload)]`** para forçar o WoW a gravar o arquivo no disco naquele exato instante.
   - Oferecer a opção de copiar o código diretamente (Base64 ou texto Lua) para quem não quiser esperar o recarregamento.

### 4. Recorte e Carregamento Assíncrono de Ícones (Safe Texture Handling)
No motor moderno/classic do WoW, o carregamento de texturas é assíncrono:
- **Erro comum:** Chamar `texObj:SetTexture(path)` e logo em seguida testar `if not texObj:GetTexture()`. Essa checagem falha porque a textura ainda está decodificando no motor, apagando o ícone indevidamente!
- **Padrão Correto:**
```lua
local function SafeSetTexture(texObj, path, fallback)
    if not texObj then return end
    fallback = fallback or "Interface\\Icons\\INV_Misc_Book_09"
    local p = path
    if not p or p == "" then p = fallback end
    if type(p) == "string" and not p:find("^Interface") and not tonumber(p) then
        p = "Interface\\Icons\\" .. p
    end
    local ok = pcall(function() texObj:SetTexture(p) end)
    if not ok then
        pcall(function() texObj:SetTexture(fallback) end)
    end
    -- Recorte canônico das bordas cinzas do WoW para acabamento moderno
    if texObj.SetTexCoord then
        texObj:SetTexCoord(0.08, 0.92, 0.08, 0.92)
    end
end
```

### 5. Suporte a Nomes Compostos no WoW Forever
O WoW Forever (Vanilla+) suporta nomes com sobrenome (como `"Hedwing Szian"`).
A resolução de nome do personagem deve sempre inspecionar:
1. `UnitName("player")` (se já vier com espaço)
2. Funções de sobrenome nativas ou de RP: `UnitSurname("player")`, `GetSurname("player")`, `C_Character.GetSurname()`
3. Título ou sobrenome do banco persistente: `HaleckAccountImporterDB.latestCharacter`

---

## 🛠️ Receitas Prontas para Novas Funcionalidades (Playbook de Código)

### Receita 1: Como Adicionar uma Nova Aba na Interface Principal
```lua
-- 1. Declarar o botão da nova aba no cabeçalho
local tabNew = CreateFrame("Button", "HAI_Tab3", win, BACKDROP_TEMPLATE)
tabNew:SetSize(200, 34)
tabNew:SetPoint("LEFT", tabJournal, "RIGHT", 8, 0)

-- 2. Criar o container de conteúdo correspondente
local viewNew = CreateFrame("Frame", nil, win)
viewNew:SetPoint("TOPLEFT", tabNew, "BOTTOMLEFT", 0, -8)
viewNew:SetPoint("BOTTOMRIGHT", win, "BOTTOMRIGHT", -22, 20)
viewNew:Hide()

-- 3. Inserir a alternância na função SwitchToCategory(catId)
```

### Receita 2: Como Criar um Popup com EditBox para Cópia com Ctrl+C
```lua
local function ShowCopyDialog(textToCopy, titleText)
    local dlg = CreateFrame("Frame", nil, UIParent, BACKDROP_TEMPLATE)
    dlg:SetSize(600, 400)
    dlg:SetPoint("CENTER")
    dlg:SetFrameStrata("DIALOG")
    -- Usar ScrollFrame + EditBox com SetMultiLine(true) e HighlightText()
    local eb = CreateFrame("EditBox", nil, dlg)
    eb:SetText(textToCopy)
    eb:SetFocus()
    eb:HighlightText()
end
```

### Receita 3: Como Registrar Eventos com Proteção Anti-Taint
```lua
local coreFrame = CreateFrame("Frame")
coreFrame:RegisterEvent("ADDON_LOADED")
coreFrame:RegisterEvent("PLAYER_LOGIN")
coreFrame:RegisterEvent("PLAYER_LOGOUT")
coreFrame:SetScript("OnEvent", function(self, event, ...)
    if event == "ADDON_LOADED" and select(1, ...) == ADDON_NAME then
        -- Inicialização segura de banco
    end
end)
```

---

## 📜 Resumo Final de Aplicação
Com este guia perene documentado, qualquer modificação futura no addon `HaleckAccountImporter` — seja adição de novas abas, integração de minimapa, árvores de habilidades, suporte a novas expansões ou exportação web — seguirá rigorosamente os mesmos padrões da melhor engenharia de software da comunidade mundial de World of Warcraft.
