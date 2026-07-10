# LifeOS Premium Experience — Acessibilidade

## Visão Geral

No LifeOS, acessibilidade (a11y) não é um recurso opcional adicionado no final do processo; é uma fundação estrutural do Design System implementado no Sprint 028. O sistema foi construído para ser utilizável, confortável e claro para o maior número possível de pessoas, independentemente de suas capacidades visuais, motoras ou cognitivas.

## 1. Suporte a Temas e Contraste

O LifeOS Premium UI suporta múltiplos temas, gerenciados pelo `ThemeEngine` e aplicados via atributos `data-theme` na tag `<html>`.

### Dark Mode (Padrão) e Light Mode
As paletas de cores para ambos os temas foram rigorosamente testadas para garantir contraste adequado (WCAG AA). O texto principal (`text-primary`) contra o fundo (`bg-base`) oferece contraste superior a 7:1 em ambos os modos.

### High Contrast Mode (`data-theme="high-contrast"`)
Para usuários que necessitam de distinção visual extrema, o modo de Alto Contraste:
*   Remove fundos sutis (surfaces) e os substitui por bordas sólidas (`1px solid white`).
*   Aumenta a opacidade de textos secundários e terciários para o valor máximo.
*   Desativa efeitos de Glass Morphism (blur) que podem reduzir a legibilidade.
*   Torna o anel de foco (focus ring) significativamente mais espesso e visível.

## 2. Tipografia e Legibilidade

A tipografia utiliza a fonte **Inter**, reconhecida por sua excelente legibilidade em telas digitais.

### Large Fonts Mode (`data-theme-font="large"`)
Acessível através do painel de Configurações, este modo aumenta o tamanho base da fonte (root font-size) no `html` de `16px` para `18px`.
Como todo o sistema de espaçamento e tipografia foi construído utilizando unidades relativas (`rem`), a interface inteira (textos, paddings, tamanhos de botões) escala proporcionalmente sem quebrar o layout, garantindo conforto visual imediato.

## 3. Motion e Animações

O LifeOS utiliza animações extensivamente para guiar a atenção e fornecer feedback. No entanto, o movimento pode causar desconforto para alguns usuários.

### Reduced Motion
O `MotionEngine` intercepta nativamente a media query do sistema operacional `(prefers-reduced-motion: reduce)`. Quando detectado (ou quando forçado via Configurações do LifeOS através do atributo `data-reduce-motion="true"`):
*   Todas as animações de entrada e saída (fades, slides, scales) aplicam seu estado final instantaneamente (duração = 0).
*   A transição de telas ocorre sem deslizamento.
*   Micro-interações (como hover lifts em cards) são desativadas, mantendo o elemento estático.
*   Spinners de carregamento mantêm seu propósito, mas podem ter a velocidade ajustada ou substituídos por indicadores de progresso lineares onde aplicável.

## 4. Feedback Multissensorial

Para garantir que as ações do usuário sejam confirmadas de forma clara, o LifeOS implementa feedback em três camadas:

1.  **Visual**: Mudanças de estado imediatas (botões loading, skeleton screens, toasts de sucesso).
2.  **Tátil (Haptics)**: Em dispositivos móveis, o `Motion.Haptic` aciona vibrações curtas e sutis para confirmar cliques, ou vibrações distintas para erros e sucessos.
3.  **Sonoro (Opcional)**: O `Motion.Sound` fornece cliques e sinos suaves para interações. Está desativado por padrão, mas pode ser habilitado nas Configurações para reforçar a confirmação de ações sem depender exclusivamente da visão.

## 5. Navegação por Teclado e Screen Readers

*   **Focus Visible**: Todos os elementos interativos (botões, inputs, chips) possuem estilos de foco explícitos (`:focus-visible`), desenhando um anel azul ao redor do elemento ao navegar com a tecla Tab. O foco via mouse não exibe o anel, mantendo a interface limpa.
*   **Skip Link**: Um link invisível "Pular para o conteúdo principal" está presente no topo do documento, tornando-se visível apenas quando focado via teclado, permitindo que usuários de leitores de tela pulem a navegação da Sidebar.
*   **Atributos ARIA**: Utilizados criteriosamente para complementar a semântica HTML:
    *   `aria-label` em botões que contêm apenas ícones (ex: botão de fechar modal).
    *   `aria-live="polite"` na área de mensagens do Companion e no container de Toasts, garantindo que o leitor de tela anuncie novas mensagens sem interromper o usuário.
    *   `role="dialog"` e `aria-modal="true"` nos modais, retendo o foco do leitor de tela dentro do modal enquanto ele estiver aberto.

---
*Documentação gerada automaticamente — Sprint 028.*
