# Component Guidelines

**Versão:** 3.0.0
**Sprint:** 029
**Data:** 10 Jul 2026
**Fase:** EXECUTION-007

---

## 1. Introdução

Este documento estabelece as diretrizes de uso para cada componente presente na biblioteca `components.css`. O objetivo é garantir que os desenvolvedores e designers utilizem os componentes da maneira correta, mantendo a consistência visual e a experiência de usuário (UX) premium.

## 2. Botões (Buttons)

Os botões são os principais elementos de interação. Eles devem ser utilizados de forma hierárquica, onde apenas uma ação primária deve existir por seção ou modal.

### 2.1. Variantes
- **Primary (`lifeos-btn-primary`):** Para a ação principal de uma tela (ex: Salvar, Confirmar). Deve usar o gradiente principal.
- **Secondary (`lifeos-btn-secondary`):** Para ações secundárias que mantêm o usuário no mesmo contexto (ex: Cancelar, Voltar). Usa borda e fundo sutil.
- **Ghost (`lifeos-btn-ghost`):** Para ações discretas em listas ou configurações. Sem fundo ou borda até o hover.
- **Danger (`lifeos-btn-danger`):** Exclusivo para ações destrutivas (ex: Excluir, Sair).
- **Success (`lifeos-btn-success`):** Para confirmações positivas ou ações de alta prioridade.

### 2.2. Tamanhos
- **XS/SM:** Para ações em linhas de tabelas, badges ou espaços compactos.
- **MD (Padrão):** Para a maioria das ações em formulários e cards.
- **LG/XL:** Exclusivo para Calls-to-Action (CTA) em landing pages ou onboarding.

### 2.3. Estados
- **Disabled:** Opacidade reduzida (0.4) e cursor bloqueado. Não deve usar `pointer-events: none` se precisar de tooltip explicando o motivo.
- **Loading:** Oculta o texto e mostra um spinner. O botão deve ficar imune a cliques.

## 3. Inputs e Formulários

Inputs devem fornecer feedback claro sobre seu estado (vazio, preenchido, erro, foco).

### 3.1. Inputs de Texto
- Devem ter padding suficiente para o texto respirar (mínimo 12px vertical).
- O estado de foco (focus) deve acender a borda com a cor `border-focus` e aplicar o `glow-primary`.
- **Input Group:** Para inputs com ícones (como busca), o ícone deve ser posicionado absolutamente à esquerda.

### 3.2. Toggles e Checkboxes
- **Toggles:** Usados exclusivamente para configurações que ativam/desativam um estado instantaneamente (ex: Dark Mode).
- **Checkboxes:** Usados em formulários para aceitar termos ou seleções múltiplas.

## 4. Cards e Containers

Cards são os blocos fundamentais de organização de conteúdo no LifeOS.

### 4.1. Card Padrão
- Usa fundo `bg-card` e borda `border-default`.
- Deve conter um header (`lifeos-card-header`) quando tiver título e ação (ex: botão de menu).

### 4.2. Glass Card
- O `lifeos-card-glass` é reservado para elementos que precisam parecer flutuar sobre o conteúdo (ex: topbar, modais, overlays).
- Requer `backdrop-filter: blur` para funcionar corretamente.

### 4.3. Modal e Drawer
- **Modal:** Usado para interrupções que exigem decisão imediata (ex: confirmar exclusão, preencher formulário curto). Deve ter overlay escuro.
- **Drawer:** Usado para mostrar detalhes extensos sem perder o contexto da tela atual (ex: ver perfil de usuário, ler documentação).

## 5. Tabelas e Listas

A apresentação de dados deve ser limpa e escaneável.

### 5.1. Tabelas
- O cabeçalho (`th`) deve ter fundo `surface-100`, texto em caixa alta (uppercase) e tamanho `xs`.
- Linhas do corpo (`td`) devem ter hover sutil (`surface-100`).
- Ações dentro de linhas (ex: editar) devem usar `btn-icon`.

### 5.2. Listas
- Usadas quando o conteúdo não justifica uma tabela estruturada.
- Devem ter um ícone à esquerda, título, subtítulo e ação à direita.

## 6. Feedback

O feedback ao usuário deve ser imediato e não intrusivo.

### 6.1. Toasts
- Mensagens temporárias (ex: "Salvo com sucesso").
- Devem aparecer no canto superior direito.
- Usar ícones coloridos (verde para sucesso, vermelho para erro) para rápida identificação.

### 6.2. Badges
- Usados para status (ex: "Ativo", "Pendente").
- Devem usar as cores semânticas (primary, success, warning, danger, info).

---
*Documento gerado durante EXECUTION-007. Obrigatório para todas as interfaces do PROJECT-X.*
