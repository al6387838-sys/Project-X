# Pesquisa de referências — Operation Black Diamond

## Apple Human Interface Guidelines

A Apple define o design de alta qualidade a partir de propósito, agência, responsabilidade, familiaridade, flexibilidade, simplicidade, craft e delight. Para o LifeOS, isso se traduz em colocar conteúdo e tarefas antes da decoração; manter controles previsíveis e consistentes; comunicar estados com clareza; permitir recuperação; adaptar a composição a diferentes larguras; e tratar cada detalhe como parte da confiança no produto.[1]

A diretriz de simplicidade afirma que simplicidade não equivale a minimalismo: a interface deve manter o que é necessário, ser concisa e estabelecer hierarquia. A orientação de craft reforça decisões deliberadas, visuais precisos, animações suaves e texto cuidadoso. Delight deve emergir da experiência completa, e não de decoração gratuita.[1]

Em tipografia, a Apple recomenda tamanhos legíveis, pesos Regular, Medium, Semibold ou Bold, um número reduzido de famílias tipográficas e hierarquia construída por tamanho, peso e cor. Para macOS, a referência publicada indica 13 pt como tamanho padrão e 10 pt como mínimo; o redesenho web adotará equivalentes em pixels sem comprometer legibilidade. A interface deverá responder a mudanças de tamanho de texto e reduzir truncamentos.[2]

Em layout, a Apple orienta agrupar itens relacionados, dar espaço suficiente à informação essencial, preencher adequadamente a janela, alinhar componentes, ordenar conteúdo importante no início da leitura, diferenciar controles de conteúdo e usar progressive disclosure. A adaptação deve preservar posições previsíveis, funcionar em várias dimensões de janela e manter consistência reconhecível.[3]

Em motion, a Apple recomenda animação intencional, breve e precisa, usada para status e feedback sem dominar a experiência. Movimento não deve ser o único meio de comunicar informação, precisa respeitar `prefers-reduced-motion`, deve permitir continuidade da interação e evitar animações repetitivas em ações frequentes.[4]

## Implicações para o LifeOS

| Dimensão | Decisão de sistema |
| --- | --- |
| Hierarquia | Conteúdo crítico em leitura superior/esquerda; níveis tipográficos claros; ações primárias escassas e explícitas. |
| Tipografia | Uma única pilha sans-serif de interface, com escala responsiva e pesos 400/500/600/700. |
| Layout | Grid responsivo de 12 colunas, alinhamentos rigorosos, densidade executiva e progressive disclosure. |
| Navegação | Sidebar persistente em desktop, compacta em larguras médias e navegação adaptada em mobile. |
| Motion | Transições de 140–260 ms, easing natural, sem bloqueio e com modo de movimento reduzido. |
| Estados | Feedback visual e textual consistente; estados vazios orientados à próxima ação. |
| Ícones | Conjunto vetorial monocromático, proporção e peso uniformes; nenhum emoji como controle. |

## Referências

[1]: https://developer.apple.com/design/human-interface-guidelines/design-principles "Apple Human Interface Guidelines — Design principles"
[2]: https://developer.apple.com/design/human-interface-guidelines/typography "Apple Human Interface Guidelines — Typography"
[3]: https://developer.apple.com/design/human-interface-guidelines/layout "Apple Human Interface Guidelines — Layout"
[4]: https://developer.apple.com/design/human-interface-guidelines/motion "Apple Human Interface Guidelines — Motion"

## Linear, Vercel, Raycast e Stripe

A Linear apresenta qualidade de software como prática estrutural e organiza seu método em direção, priorização, momentum, escopo e construção contínua. Para o LifeOS, a referência relevante é reduzir ruído, manter o contexto operacional visível e estruturar cada superfície em torno do próximo avanço — não em torno de componentes decorativos.[5]

O Geist, sistema de design da Vercel, explicita fundações de cores acessíveis e de alto contraste, tipografia consistente, materiais padronizados, grid central e ativos vetoriais próprios. A transformação do LifeOS seguirá esse modelo de fundações compartilhadas em vez de estilos específicos e divergentes por página.[6]

O Raycast se define como uma ferramenta de produtividade que permite lançar aplicações, pesquisar, gerenciar janelas e utilizar IA sem abandonar o teclado. Essa abordagem fundamenta a manutenção de busca/command palette, atalhos visíveis, navegação de baixa fricção e ações contextuais compactas no LifeOS.[7]

A documentação do Stripe Dashboard descreve uma sidebar orientada a recursos, atalhos para páginas recentes ou fixadas, visão inicial com analytics, notificações importantes, filtros, exportação e configuração dividida entre categorias pessoais, de conta e de produto. O LifeOS adotará a mesma disciplina de agrupamento sem copiar a estética, especialmente nas superfícies de Analytics, Admin, Marketplace, Profile e Settings.[8]

| Referência | Princípio incorporado ao LifeOS |
| --- | --- |
| Linear | Densidade com clareza, foco no avanço e estados operacionais legíveis. |
| Vercel / Geist | Tokens consistentes, alto contraste, grid rigoroso, materiais e ícones unificados. |
| Raycast | Fluxos keyboard-first, busca central e ações contextuais sem navegação desnecessária. |
| Stripe Dashboard | Arquitetura de informação por domínio, analytics acionável, filtros e estados explícitos. |

[5]: https://linear.app/method "The Linear Method"
[6]: https://vercel.com/geist/introduction "Vercel — Geist Design System"
[7]: https://manual.raycast.com/ "Raycast Manual"
[8]: https://stripe.com/docs/dashboard "Stripe — Web Dashboard"

## Figma, Notion, Arc e Perplexity

A Figma organiza boas interfaces em sete princípios: hierarquia, progressive disclosure, consistência, contraste, proximidade, acessibilidade e alinhamento. A fonte também associa sistemas de design a menor carga cognitiva, recomenda navegação consistente, feedback claro, atalhos e busca. Esses critérios serão usados como checklist de validação para cada superfície do LifeOS.[9]

O Notion estrutura o produto como um espaço único para contexto, respostas, automação, documentos, conhecimento e projetos, com IA integrada ao trabalho em vez de isolada em um módulo decorativo. No LifeOS, o Companion será tratado como camada contextual presente na experiência e conectado às decisões e ao fluxo diário.[10]

O Arc descreve uma experiência limpa e calma, adaptada ao modo de uso, com Spaces e Profiles para organizar diferentes contextos em uma mesma janela. A referência orienta a sidebar contextual, a preservação de contexto e a redução da sensação de múltiplos dashboards desconectados.[11]

A Perplexity apresenta a IA como agente que recebe tarefas em linguagem natural, trabalha, mostra progressão e permite iteração e refinamento. A transformação do Companion deve tornar o estado da IA legível — observando, sintetizando, aguardando ou agindo — e sempre permitir que o usuário revise e conduza o processo.[12]

| Referência | Princípio incorporado ao LifeOS |
| --- | --- |
| Figma | Hierarquia, consistência, proximidade, contraste, acessibilidade e alinhamento rigoroso. |
| Notion | IA integrada ao contexto, superfícies calmas e foco no conteúdo útil. |
| Arc | Sidebar contextual, organização por espaços e preservação de contexto. |
| Perplexity | Companion orientado a tarefas, estado visível e iteração natural. |

## Síntese visual da Operation Black Diamond

A linguagem final será **quiet luxury digital**: fundos de grafite quase neutro, superfícies discretamente elevadas, texto marfim frio, linhas de separação de baixo contraste e um acento azul-petróleo mineral usado com extrema parcimônia. Métricas positivas e alertas adotarão cores semânticas dessaturadas. Não serão usados emojis como ícones, gradientes ornamentais, halos neon, cartões excessivamente grandes ou blur intenso.

A composição adotará um grid de 12 colunas, sidebar de aproximadamente 236 px, cabeçalho de 56 px e conteúdo com largura fluida. A densidade será executiva: informação relevante no primeiro viewport, espaços vazios funcionais e nenhum painel vazio sem orientação. Cartões serão substituídos, sempre que possível, por seções contínuas, listas estruturadas, bordas internas e agrupamentos tipográficos.

O Companion será a assinatura visual: um núcleo vetorial abstrato, discreto e vivo, acompanhado de estado operacional, resumo do momento e ações contextuais. Seu movimento será sutil, com respiração de baixa amplitude apenas quando o usuário não tiver solicitado redução de movimento. O Companion não será apresentado como mascote e não utilizará estética de chatbot genérico.

[9]: https://www.figma.com/resource-library/ui-design-principles/ "Figma — Seven essential UI design principles"
[10]: https://www.notion.com/product "Notion — Product"
[11]: https://arc.net/ "Arc Browser"
[12]: https://www.perplexity.ai/products/computer "Perplexity Computer"
