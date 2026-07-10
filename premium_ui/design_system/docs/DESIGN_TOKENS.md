# Design Tokens

**Versão:** 3.0.0
**Sprint:** 029
**Data:** 10 Jul 2026
**Fase:** EXECUTION-007

---

## 1. Introdução

Os Design Tokens são os blocos atômicos de design que definem a aparência e o comportamento visual do LifeOS. Eles são armazenados no arquivo `tokens.json` e mapeados para variáveis CSS utilizáveis no `variables.css`. Este documento detalha cada categoria de token.

## 2. Color Tokens

As cores são divididas em paletas de marca (Brand) e paletas semânticas (Semantic), além de definições específicas para os temas Dark, Light e High Contrast.

### 2.1. Brand Colors
- **Primary:** `#6366F1` (Indigo). Usada para a ação principal e identidade da marca.
- **Accent:** `#8B5CF6` (Violet). Usada para gradientes e detalhes secundários.

### 2.2. Semantic Colors
- **Success:** `#10B981` (Emerald). Para confirmações e estados positivos.
- **Warning:** `#F59E0B` (Amber). Para alertas e estados de atenção.
- **Danger:** `#F43F5E` (Rose). Para erros e ações destrutivas.
- **Info:** `#3B82F6` (Blue). Para informações neutras e tooltips.

### 2.3. Tema Dark (Padrão)
- **Backgrounds:** Base `#080810`, Elevated `#0F0F1A`, Card `#13131F`.
- **Surfaces:** De `#1E1E32` (100) a `#4A4A6A` (500).
- **Borders:** De `subtle` (6% opacidade) a `strong` (18% opacidade).
- **Text:** Primary `#F1F5F9`, Secondary `#94A3B8`, Tertiary `#64748B`.

## 3. Typography Tokens

O sistema tipográfico é baseado na família `Inter` (Sans) para textos gerais e `JetBrains Mono` (Mono) para códigos.

### 3.1. Escala de Tamanhos
- **2xs:** 10px (10px)
- **xs:** 12px (12px)
- **sm:** 14px (14px)
- **base/md:** 16px (16px) - Tamanho padrão do corpo do texto.
- **lg:** 18px (18px)
- **xl:** 20px (20px)
- **2xl:** 24px (24px)
- **3xl:** 30px (30px)
- **4xl:** 36px (36px)
- **5xl:** 48px (48px)

### 3.2. Pesos
- **Regular:** 400
- **Medium:** 500
- **Semibold:** 600 (Usado para Headings e textos de destaque)
- **Bold:** 700

## 4. Spacing Tokens

O espaçamento segue uma escala baseada em múltiplos de 4px, garantindo alinhamento perfeito na grade de 8px.

- **1:** 4px
- **2:** 8px
- **3:** 12px
- **4:** 16px (Padding padrão de componentes)
- **6:** 24px (Gap padrão de grids)
- **8:** 32px
- **12:** 48px

## 5. Border Radius Tokens

- **sm:** 4px (Botões pequenos, badges)
- **md:** 8px (Inputs, cards padrão)
- **lg:** 12px (Cards interativos, modais)
- **xl:** 16px (Modais grandes)
- **full:** 9999px (Avatars, pills, toggles)

## 6. Elevation Tokens

A elevação é controlada por sombras (`box-shadow`) para criar profundidade.

- **0:** Nenhuma sombra.
- **1:** Sombra sutil para botões e cards em repouso.
- **2/3:** Sombra média para cards interativos e dropdowns.
- **4/5:** Sombra forte para modais e drawers.
- **Glow:** Sombras coloridas (ex: `glow-primary`) usadas em estados de foco.
- **Glass:** Sombra interna e externa para elementos com efeito de vidro.

## 7. Motion Tokens

As animações devem ser suaves e naturais, evitando movimentos bruscos.

### 7.1. Durações
- **Fast:** 100ms (Hover de botões)
- **Normal:** 200ms (Transições de cor)
- **Moderate:** 300ms (Aparecimento de modais, slides)
- **Slow:** 500ms (Progress bars)

### 7.2. Easing
- **EaseOut:** `cubic-bezier(0, 0, 0.2, 1)` (Usado para a maioria das transições)
- **Spring:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (Usado para modais e elementos que "saltam" na tela)

## 8. Icon Tokens

- **xs:** 12px
- **sm:** 16px (Ícones em botões pequenos)
- **md:** 20px (Ícones em sidebar e inputs)
- **lg:** 24px (Ícones em botões padrão)

---
*Documento gerado durante EXECUTION-007. Obrigatório para todas as interfaces do PROJECT-X.*
