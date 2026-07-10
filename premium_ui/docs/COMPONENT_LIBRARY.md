# LifeOS Premium Experience — Component Library

## Visão Geral

A **Component Library** do LifeOS (Sprint 028) é uma coleção de componentes de interface de usuário construídos inteiramente em CSS puro (`components.css`), sem dependência de frameworks JavaScript pesados. Ela consome diretamente os tokens do Design System (`variables.css`).

## 1. Buttons (`.btn`)

Os botões são o principal meio de interação. Eles suportam múltiplos tamanhos, variantes semânticas e estados (hover, active, disabled, loading).

### Variantes Principais
*   `.btn-primary`: Ação principal da tela. Fundo gradiente/sólido, texto branco.
*   `.btn-secondary`: Ações alternativas. Fundo surface, borda sutil.
*   `.btn-ghost`: Ações terciárias. Fundo transparente, revela surface no hover.
*   `.btn-danger`: Ações destrutivas. Vermelho/Rosa, exige confirmação mental.

### Tamanhos
*   `.btn-sm`: Altura 32px, texto `text-xs`.
*   `.btn` (Padrão): Altura 40px, texto `text-sm`.
*   `.btn-lg`: Altura 48px, texto `text-base`.
*   `.btn-xl`: Altura 56px, texto `text-lg`. Usado no Splash/Onboarding.

### Modificadores
*   `.btn-icon`: Torna o botão perfeitamente quadrado (aspect-ratio 1/1) para abrigar apenas um ícone.
*   `.btn-full`: `width: 100%`.
*   `.btn-loading`: Oculta o texto/ícone original e exibe um spinner centralizado.

## 2. Cards (`.card`)

Containers versáteis para agrupar informações relacionadas.

*   `.card`: Fundo `bg-card`, borda sutil, raio `radius-2xl`, padding `space-5`.
*   `.card-interactive`: Adiciona transição de elevação (`elevation-3`) e borda no hover. Usado em Missões e Eventos da Timeline.
*   `.glass`: Aplica o efeito de Glass Morphism (fundo semitransparente + backdrop blur).

## 3. Form Controls

### Inputs & Textareas (`.input`, `.textarea`)
*   Fundo `surface-100`, borda sutil, transição suave para `surface-200` no hover.
*   **Focus**: Borda muda para `color-primary-500` com um anel de foco (ring) semitransparente (`box-shadow: 0 0 0 3px rgba(99,102,241,0.12)`).
*   **Erro**: `.input-error` aplica borda vermelha. Acompanhado por `.input-hint-error`.

### Toggles (`.toggle`)
Substituem checkboxes tradicionais para configurações booleanas de efeito imediato (ex: Configurações).
*   Estrutura: `<label class="toggle"><input type="checkbox" class="toggle-input"><div class="toggle-track"><div class="toggle-thumb"></div></div></label>`
*   Suporta animação elástica do thumb (bolinha).

### Selects (`.select`)
Estilizados nativamente via CSS com um ícone de chevron customizado via `background-image` (SVG data URI), mantendo a acessibilidade nativa do elemento `<select>`.

## 4. Badges & Chips

*   **Badges** (`.badge`): Elementos passivos para exibir status ou contagens. Suportam cores semânticas (`.badge-primary`, `.badge-success`, etc.). O modificador `.badge-dot` adiciona um pequeno círculo pulsante ao lado do texto.
*   **Chips** (`.chip`): Elementos interativos usados para filtros (ex: Timeline, Missões). O modificador `.chip-interactive` adiciona hover states, e `.chip-active` indica seleção.

## 5. Modals & Overlays

*   `.modal-backdrop`: Fundo escuro com blur (`z-index: 100`). Atua como container flexível para centralizar o modal.
*   `.modal`: O container principal. Fundo `bg-elevated`, sombra `elevation-4`, raio `radius-3xl`.
*   **Estrutura interna**:
    *   `.modal-header`: Título e botão de fechar (`.modal-close`).
    *   `.modal-body`: Conteúdo principal com scroll (se necessário).
    *   `.modal-footer`: Ações (geralmente Cancelar e Confirmar alinhados à direita).

## 6. Feedback Components

### Toasts (`.toast-container`, `.toast`)
Notificações não-bloqueantes exibidas no canto superior direito (ou inferior em mobile).
*   Suportam variantes: `success`, `error`, `warning`, `info`.
*   Animados via `Motion.ToastMotion`.

### Skeleton Loading (`.skeleton-*`)
Placeholders animados usados durante o carregamento de dados (ex: lista de missões no Dashboard).
*   `.skeleton-pulse`: Aplica a animação de brilho contínuo.
*   `.skeleton-title`, `.skeleton-line`, `.skeleton-avatar`: Formatos pré-definidos.

### Spinners (`.spinner`)
Indicadores de carregamento circulares.
*   Tamanhos: `xs`, `sm`, padrão, `lg`, `xl`.
*   Cores via modificador: `.spinner-primary`, `.spinner-white`.

## 7. Avatares (`.avatar`)

Usados para representar o usuário ou a IA (Companion).
*   Fundo `surface-200` por padrão, ou `gradient-primary` para a IA.
*   Tamanhos: `xs` (24px) a `xl` (64px).
*   Suporta agrupamento via `.avatar-group`, que aplica margem negativa e borda branca/escura para criar o efeito de sobreposição.

---
*Documentação gerada automaticamente — Sprint 028.*
