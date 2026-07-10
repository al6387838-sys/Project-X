# LifeOS Design System

**Versão:** 3.0.0
**Sprint:** 029
**Data:** 10 Jul 2026
**Fase:** EXECUTION-007

---

## 1. Visão Geral

O LifeOS Design System é o sistema de design definitivo e obrigatório para todas as interfaces presentes e futuras do PROJECT-X. Desenvolvido com princípios de design Enterprise Premium, este sistema estabelece as regras, tokens, componentes e padrões de UX que garantem a consistência visual, a qualidade profissional e a identidade única da plataforma LifeOS.

Nenhuma tela, componente ou fluxo poderá ser criado fora deste padrão. O objetivo é eliminar completamente a aparência de templates prontos, dashboards genéricos ou interfaces amadoras.

## 2. Princípios Fundamentais

O Design System é guiado por quatro pilares inegociáveis:

1. **Enterprise Premium:** A interface deve transmitir solidez, segurança e alta tecnologia, alinhada com os padrões de mercado definidos por empresas como Linear, Stripe e Notion.
2. **Clareza Cognitiva:** A informação deve ser apresentada de forma limpa, hierárquica e direta, reduzindo a carga cognitiva do usuário.
3. **Consistência Absoluta:** Todos os elementos visuais devem seguir rigorosamente os Design Tokens definidos, garantindo que a experiência seja uniforme em qualquer contexto.
4. **Acessibilidade e Inclusão:** O sistema deve ser utilizável por todos, considerando contraste, tamanhos de toque e leitura de tela.

## 3. Design Tokens

Os Design Tokens são a fonte única de verdade (Single Source of Truth) para todo o estilo do sistema. Eles são definidos no arquivo `tokens.json` e mapeados para variáveis CSS no arquivo `variables.css`.

Os tokens são divididos em oito categorias principais:
- **Color Tokens:** Paletas brand (primary, accent) e semânticas (success, warning, danger, info), além de suporte completo para temas Dark, Light e High Contrast.
- **Typography Tokens:** Sistema baseado na família tipográfica Inter (Sans) e JetBrains Mono (Mono), com escala de pesos e tamanhos rigorosa.
- **Spacing Tokens:** Escala baseada em múltiplos de 4px (8pt grid), garantindo alinhamento perfeito.
- **Border Radius Tokens:** Padrões para cantos arredondados, desde elementos discretos (sm) até pílulas (full).
- **Elevation Tokens:** Sombras sutis para hierarquia de profundidade, com destaque para os efeitos "glow" e "glass" (vidro).
- **Motion Tokens:** Curvas de animação (easing) e durações padronizadas para transições suaves e naturais.
- **Shadow Tokens:** Variações específicas para estados de interação (hover, active, focus).
- **Icon Tokens:** Tamanhos padronizados para ícones em diferentes contextos.

## 4. Biblioteca de Componentes

A biblioteca de componentes (`components.css`) é construída sobre os Design Tokens e fornece a base visual para as interfaces. Os componentes são classificados por categoria:

### 4.1. Elementos de Base
Incluem tipografia (Headings, Body, Code), botões (Primary, Secondary, Ghost, Danger) e inputs (Text, Select, Toggle). Todos possuem estados de interação (hover, focus, disabled, loading) rigorosamente definidos.

### 4.2. Containers
Incluem Cards (padrão, glass, interativo), Modais e Drawers. Os containers utilizam as sombras de elevação e as bordas definidas nos tokens para criar camadas de profundidade.

### 4.3. Dados e Listas
Incluem Tabelas e Listas estilizadas. A apresentação de dados em massa prioriza o alinhamento, a tipografia e os badges de status para rápida leitura.

### 4.4. Navegação e Layout
Incluem o Grid System (12 colunas), Sidebar, Topbar, Tabs e Pagination. O layout é estruturado para maximizar a área de trabalho e fornecer navegação clara.

### 4.5. Feedback e Status
Incluem Toasts, Tooltips, Badges e Progress Bars. Esses componentes fornecem feedback imediato ao usuário sobre o estado do sistema ou o resultado de uma ação.

## 5. Aplicação e Demonstração

A aplicação do Design System v3.0.0 foi demonstrada através do redesenho de três interfaces críticas do LifeOS:
1. **Dashboard:** Foco em widgets de métricas e visualização de progresso.
2. **Memory Center:** Foco em listagem de memórias, timeline e filtros.
3. **Companion:** Foco na interface de chat contextual e integração com o sistema de memória.

O catálogo oficial de componentes (`component_catalog.html`) serve como referência visual e interativa para todos os elementos disponíveis no sistema.

---
*Documento gerado durante EXECUTION-007. Obrigatório para todas as interfaces do PROJECT-X.*
