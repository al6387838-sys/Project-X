# LifeOS Premium Experience — Architecture & Motion

## Arquitetura da Interface V2

O Sprint 028 introduziu uma reescrita completa da camada de visualização (View Layer) do LifeOS, movendo de um MVP rudimentar para uma Single Page Application (SPA) responsiva, fluida e com qualidade premium.

### Estrutura de Layout (App Shell)

A interface utiliza um modelo de "App Shell" composto por três áreas principais:

1.  **Sidebar (`.sidebar`)**: Navegação principal. Fixa à esquerda em desktop, oculta em mobile. Contém o perfil do usuário e o Life Score consolidado.
2.  **Topbar (`.topbar`)**: Cabeçalho contextual. Exibe o título da tela atual, barra de busca (Command Palette) e ações rápidas globais (Tema, Companion). Utiliza Glass Morphism para flutuar sobre o conteúdo scrollável.
3.  **Content Area (`.content-area`)**: A área de visualização onde as "telas" (`.screen`) são renderizadas.

### Roteamento e Telas (Screens)

O roteamento é gerenciado via JavaScript no arquivo `app.js`. Todas as telas residem no `index.html` e têm sua visibilidade alternada pela função `showView(viewId)`.

As principais telas (V2) construídas são:
*   **Dashboard V2**: Visão consolidada do dia. Inclui o widget circular do Life Score (renderizado via Chart.js), métricas rápidas, lista de missões ativas e o Morning Briefing.
*   **Companion V2**: Interface de chat com a IA. Layout dividido em duas colunas (chat principal e painel lateral de insights).
*   **Missions V2**: Gestão de objetivos. Layout master-detail, onde clicar em um card de missão abre o painel lateral com detalhes e subtarefas interativas.
*   **Timeline V2**: Histórico de vida. Visualização vertical com agrupamento por ano e filtragem por área da vida via Chips interativos.

## Motion Engine (`motion.js`)

O Motion Engine é o coração da experiência premium. Ele encapsula a Web Animations API (WAAPI) para fornecer animações performáticas, consistentes e que respeitam as preferências de acessibilidade do usuário.

### Funcionalidades Core

A função base `animate(el, keyframes, options)` intercepta todas as chamadas de animação. Se o usuário tiver ativado a redução de movimento (`prefers-reduced-motion`), a função ignora a animação e aplica imediatamente o estado final (último keyframe), garantindo que a aplicação permaneça funcional sem causar desconforto.

### Módulos do Engine

1.  **Entrance**: Animações de entrada para elementos recém-renderizados.
    *   `fadeIn`, `fadeInUp`, `scaleIn`, `slideInFromRight`.
    *   Utilizado extensivamente nas transições de tela e ao carregar listas de itens.
2.  **Exit**: Animações de saída antes da remoção de elementos do DOM.
3.  **Micro**: Micro-interações de feedback.
    *   `press`: Efeito de "afundar" o botão ao clicar.
    *   `hoverLift`: Elevação suave em cards interativos.
    *   `shake`: Feedback visual de erro (ex: tentar criar missão sem título).
    *   `countUp`: Animação de contagem de números (usada nos widgets de Life Score).
4.  **PageTransition**: Gerencia a transição fluida entre as telas do App Shell, aplicando fade e slide coordenados.
5.  **ModalMotion**: Anima a entrada e saída de modais, coordenando o blur do backdrop (`.modal-backdrop`) com o scale/translate do conteúdo (`.modal`).
6.  **Haptic**: Wrapper para a API `navigator.vibrate`, fornecendo feedback tátil sutil em dispositivos móveis compatíveis durante ações como concluir tarefas ou alternar temas.
7.  **Sound**: Sistema opcional de feedback sonoro (click, success, notification), que pode ser ativado nas Configurações.

### Integração com CSS

Embora o JavaScript controle as animações complexas, o CSS (`animations.css`) fornece classes utilitárias (`.animate-fade-in`, `.delay-100`) para animações declarativas simples que ocorrem apenas no carregamento inicial, delegando o trabalho pesado para a GPU do navegador.

---
*Documentação gerada automaticamente — Sprint 028.*
