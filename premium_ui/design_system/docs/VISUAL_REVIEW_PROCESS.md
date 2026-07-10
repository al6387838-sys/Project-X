# Visual Review Process

**Versão:** 3.0.0
**Sprint:** 029
**Data:** 10 Jul 2026
**Fase:** EXECUTION-007

---

## 1. Propósito

O processo de revisão visual é um mecanismo obrigatório que garante que nenhuma interface nova ou modificada entre em produção sem atender aos padrões estabelecidos pelo LifeOS Design System. Este processo atua como um filtro de qualidade visual que protege a integridade estética e funcional do produto.

## 2. Regra de Aprovação

**Nenhuma nova interface poderá ser aprovada sem atender aos padrões definidos neste documento.** A aprovação visual é tão obrigatória quanto a revisão de código. Um Pull Request que passe na revisão técnica mas falhe na revisão visual deve ser rejeitado.

## 3. Checklist de Revisão Visual

A revisão visual deve cobrir os seguintes aspectos, em ordem de prioridade:

### 3.1. Conformidade com Tokens (Bloqueante)
Verificar se todos os valores de cor, espaçamento, tipografia e borda utilizam exclusivamente os Design Tokens do `tokens.json`. Cores hexadecimais hardcoded, tamanhos de fonte arbitrários e paddings não padronizados são rejeitados imediatamente.

### 3.2. Consistência de Componentes (Bloqueante)
Verificar se os componentes utilizados pertencem à biblioteca oficial (`components.css`). Componentes duplicados, variações não autorizadas ou customizações visuais fora do sistema são rejeitados.

### 3.3. Estados de Interação (Bloqueante)
Verificar se todos os elementos interativos possuem estados claros de hover, focus, active e disabled. Botões sem feedback visual ao passar o mouse são rejeitados.

### 3.4. Acessibilidade Visual (Bloqueante)
Verificar se o contraste entre texto e fundo atende ao mínimo WCAG AA. Verificar se os tamanhos de toque (touch targets) são adequados para dispositivos móveis (mínimo 44px).

### 3.5. Responsividade (Recomendado)
Verificar se a interface se adapta adequadamente aos breakpoints definidos no Design System (xs, sm, md, lg, xl, 2xl). Layouts que quebram em telas menores são rejeitados.

### 3.6. Consistência Temática (Recomendado)
Verificar se a interface funciona corretamente tanto no tema Dark quanto no tema Light. Elementos com cores fixas que não se adaptam ao tema são rejeitados.

## 4. Fluxo de Aprovação

O processo de revisão visual segue o seguinte fluxo sequencial:

**Etapa 1 — Desenvolvimento:** O designer ou desenvolvedor cria a interface seguindo rigorosamente o Design System. Cada componente, token e espaçamento deve ser escolhido com base nos documentos oficiais.

**Etapa 2 — Auto-Revisão:** Antes de submeter o código, o autor deve percorrer o checklist acima e corrigir quaisquer violações encontradas. A auto-revisão é responsabilidade do autor.

**Etapa 3 — Submissão:** O código é submetido via Pull Request com o prefixo `[UI]` no título, indicando que contém alterações visuais.

**Etapa 4 — Revisão Técnica:** Um revisor de código verifica se os tokens e componentes estão corretamente implementados. Esta revisão é focada na conformidade técnica com o Design System.

**Etapa 5 — Revisão Visual:** Um designer ou stakeholder avalia a estética, usabilidade e alinhamento com as referências de qualidade (Linear, Stripe, Notion, Arc, Figma, Vercel, Raycast).

**Etapa 6 — Decisão:** O PR é aprovado e mesclado, ou rejeitado com comentários detalhados sobre as violações encontradas. Rejeições devem sempre incluir referência ao documento violado.

## 5. Critérios de Rejeição

Uma interface será rejeitada se apresentar qualquer uma das seguintes violações:

| Categoria | Violação | Documento de Referência |
|---|---|---|
| Token | Cores hexadecimais hardcoded | DESIGN_TOKENS.md |
| Token | Tamanhos de fonte arbitrários | DESIGN_TOKENS.md |
| Token | Paddings/margins fora da escala 4px | DESIGN_TOKENS.md |
| Componente | Uso de componentes não oficiais | COMPONENT_GUIDELINES.md |
| Componente | Estilos inline ou CSS arbitrário | COMPONENT_GUIDELINES.md |
| UX | Ausência de estados de hover/focus | COMPONENT_GUIDELINES.md |
| UX | Hierarquia visual inconsistente | UI_STANDARDS.md |
| UX | Espaçamento insuficiente (whitespace) | UI_STANDARDS.md |
| Acessibilidade | Contraste abaixo de WCAG AA | UI_STANDARDS.md |
| Qualidade | Aparência de template genérico ou amador | DESIGN_SYSTEM.md |

## 6. Referências de Qualidade

O design de toda interface deve ser comparado visualmente com as seguintes referências, que representam o nível mínimo de qualidade exigido:

| Referência | Aspecto a Comparar |
|---|---|
| Linear | Tipografia limpa, espaçamento generoso, foco em produtividade |
| Stripe Dashboard | Clareza na apresentação de dados complexos, tabelas elegantes |
| Notion | Flexibilidade de layout, blocos de informação bem definidos |
| Arc Browser | Gradientes sutis, efeitos de vidro (glassmorphism) |
| Figma | Precisão no alinhamento, grid system rigoroso |
| Vercel | Tipografia de alta legibilidade, contrastes suaves |
| Raycast | Interação rápida, feedback visual imediato |

---
*Documento gerado durante EXECUTION-007. Obrigatório para todas as interfaces do PROJECT-X.*
