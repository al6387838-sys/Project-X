# LifeOS Premium Experience — Design System

## Visão Geral

O **LifeOS Premium Experience Design System** foi construído do zero no Sprint 028 para elevar a qualidade visual da aplicação a um padrão global. Inspirado nas melhores práticas da Apple, Linear e Notion, este sistema não é apenas um conjunto de cores, mas um motor visual completo focado em **clareza, elegância e foco**.

O objetivo central é reduzir a carga cognitiva do usuário através de hierarquia visual rigorosa, permitindo que o foco permaneça inteiramente na gestão da vida pessoal.

## Princípios de Design

1. **Clareza acima de tudo**: O conteúdo dita o design. A interface deve ser invisível até que o usuário precise dela.
2. **Consistência absoluta**: Uma única fonte de verdade (`variables.css`) governa todos os componentes.
3. **Acessibilidade como fundação**: Contraste, suporte a fontes grandes e redução de movimento não são extras, são pilares.
4. **Micro-interações com propósito**: Animações existem para guiar a atenção e confirmar ações, não apenas para enfeitar.

## 1. Typography System

A tipografia do LifeOS utiliza a família **Inter** para a interface geral, garantindo legibilidade excepcional em telas de alta densidade. Para dados numéricos, métricas e código, utilizamos **JetBrains Mono**.

### Escala Tipográfica (Base 16px)

| Nome | Tamanho | Peso | Line Height | Uso Principal |
| :--- | :--- | :--- | :--- | :--- |
| **Display 6XL** | 64px (4rem) | 900 (Black) | 1.1 | Splash screens, números heroicos (Life Score) |
| **Display 5XL** | 48px (3rem) | 900 (Black) | 1.1 | Títulos de onboarding |
| **Heading 4XL** | 36px (2.25rem) | 800 (ExtraBold) | 1.2 | Saudações do Dashboard |
| **Heading 3XL** | 30px (1.875rem) | 800 (ExtraBold) | 1.2 | Títulos de seção principais |
| **Heading 2XL** | 24px (1.5rem) | 700 (Bold) | 1.3 | Títulos de tela (Missions, Timeline) |
| **Heading XL** | 20px (1.25rem) | 600 (SemiBold) | 1.4 | Títulos de modais |
| **Heading LG** | 18px (1.125rem) | 600 (SemiBold) | 1.5 | Títulos de cards |
| **Body Base** | 16px (1rem) | 400/500 | 1.6 | Texto principal, descrições |
| **Body SM** | 14px (0.875rem) | 400/500 | 1.5 | Mensagens do Companion, inputs |
| **Caption XS** | 12px (0.75rem) | 500/600 | 1.4 | Labels, metadados, timestamps |
| **Caption 2XS** | 10px (0.625rem) | 600/700 | 1.4 | Badges, tags muito pequenas |

*Nota: O sistema suporta a classe `.text-large` ativada via configurações de acessibilidade, que aumenta a escala base em 12.5%.*

## 2. Color System

O sistema de cores foi projetado para funcionar perfeitamente em Light Mode, Dark Mode e High Contrast Mode. A paleta utiliza o espaço de cor OKLCH sob o capô, garantindo transições de luminosidade consistentes.

### Cores Semânticas

*   **Primary (Índigo)**: Ações principais, progresso, elementos ativos. (`--color-primary-500`: `#6366F1`)
*   **Success (Esmeralda)**: Missões concluídas, aumento de score, status positivo. (`--color-success-500`: `#10B981`)
*   **Warning (Âmbar)**: Alertas, atenção necessária, dias consecutivos (streaks). (`--color-warning-500`: `#F59E0B`)
*   **Danger (Rosa/Vermelho)**: Ações destrutivas, prazos perdidos, erros. (`--color-danger-500`: `#F43F5E`)
*   **Info (Azul)**: Insights do Companion, informações neutras. (`--color-info-500`: `#3B82F6`)

### Hierarquia de Superfícies (Dark Mode)

| Nível | Variável | Cor (Hex) | Uso |
| :--- | :--- | :--- | :--- |
| **Base** | `--bg-base` | `#080810` | Fundo principal da aplicação |
| **Elevated** | `--bg-elevated` | `#0D0D16` | Sidebar, modais, painéis |
| **Card** | `--bg-card` | `#12121A` | Cards principais (Dashboard, Missions) |
| **Surface 100** | `--surface-100` | `#1A1A24` | Hover states, inputs inativos |
| **Surface 200** | `--surface-200` | `#242430` | Active states, inputs ativos |
| **Surface 300** | `--surface-300` | `#2D2D3C` | Bordas fortes, divisores secundários |

### Hierarquia de Texto

*   `--text-primary`: Branco quase puro (`#F8FAFC`). Para títulos e dados essenciais.
*   `--text-secondary`: Cinza claro (`#CBD5E1`). Para texto de corpo e descrições.
*   `--text-tertiary`: Cinza médio (`#64748B`). Para labels, metadados e placeholders.

## 3. Spacing System

O sistema de espaçamento utiliza uma escala base de 4px (`0.25rem`) para garantir ritmo vertical e horizontal perfeito.

*   `--space-1` (4px): Espaçamento interno muito sutil (ex: ícone e texto em badge).
*   `--space-2` (8px): Espaçamento entre elementos irmãos próximos (ex: título e subtítulo de card).
*   `--space-3` (12px): Padding interno de botões e inputs.
*   `--space-4` (16px): Padding padrão de cards pequenos e gutters.
*   `--space-5` (20px): Padding de cards médios.
*   `--space-6` (24px): Margem entre seções, padding de modais.
*   `--space-8` (32px): Margem grande entre blocos principais.
*   `--space-10` (40px): Espaçamento heroico.
*   `--space-12` (48px): Margem superior de telas principais.

## 4. Elevation & Depth System

A elevação no LifeOS é criada através de sombras sutis (box-shadow) e, no Dark Mode, através do clareamento sutil da cor de fundo (surfaces).

| Nível | Variável CSS | Descrição |
| :--- | :--- | :--- |
| **Flat** | `none` | Elementos no mesmo nível do fundo. |
| **Level 1** | `--elevation-1` | Sombra muito sutil. Cards padrão, botões. |
| **Level 2** | `--elevation-2` | Hover em cards, dropdowns pequenos. |
| **Level 3** | `--elevation-3` | Modais pequenos, command palette. |
| **Level 4** | `--elevation-4` | Modais grandes, onboarding cards. |
| **Glow** | `--elevation-glow-primary` | Brilho colorido ao redor de avatares de IA e botões principais. |

### Glass Morphism

Utilizado estritamente em elementos que flutuam sobre conteúdo variável, como a Topbar e o Loading Overlay. Implementado via `backdrop-filter: blur(var(--blur-xl))`.

## 5. Animation System

Consulte `PREMIUM_UI.md` para detalhes sobre a implementação técnica do Motion Engine. As animações no LifeOS seguem curvas elásticas (spring physics) para parecerem orgânicas e responsivas.

*   **Duração Padrão**: 200ms (Rápido) a 400ms (Suave).
*   **Curva Padrão**: `cubic-bezier(0.4, 0, 0.2, 1)` (Ease-out).
*   **Curva Spring**: `cubic-bezier(0.34, 1.56, 0.64, 1)` (Bouncy, usado em modais e toasts).

O sistema respeita rigorosamente a preferência do usuário por movimento reduzido (`prefers-reduced-motion`).

---
*Documentação gerada automaticamente — Sprint 028.*
