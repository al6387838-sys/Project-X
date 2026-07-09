# Scenario Generator

**Project-X | Sprint 012**

O Scenario Generator é o componente do Future Engine responsável por construir narrativas de futuros possíveis. Ele pega uma situação base e uma ação hipotética do usuário e projeta as consequências ao longo de diferentes horizontes de tempo.

## Como Funciona

O Scenario Generator utiliza dados de todos os motores do LifeOS para criar uma simulação rica e contextualizada. Ele considera:

*   **Estado Atual do Usuário**: Coletado do Evolution Engine (via `EvolutionSnapshot`), Context Engine e Memory Engine.
*   **Padrões Comportamentais**: Analisados pelo Behavior Analyzer (parte do Evolution Engine).
*   **Objetivos e Metas**: Extraídos do Life Graph.
*   **Padrões de Decisão**: Entendidos pelo Decision Engine.

### Horizontes de Tempo Suportados

O gerador pode criar cenários para os seguintes períodos:

*   `30_days` (curto prazo)
*   `90_days` (médio prazo)
*   `1_year` (anual)
*   `5_years` (longo prazo)
*   `10_years` (muito longo prazo)

### Elementos de um Cenário

Cada `Scenario` gerado é um objeto rico em informações, incluindo:

*   **Título e Descrição**: Uma sumarização clara do cenário.
*   **Probabilidade**: A chance estimada de o cenário se concretizar, ajustada pela ação hipotética.
*   **Impacto**: A magnitude (positiva ou negativa) das consequências.
*   **Confiança**: A confiança do sistema na precisão da simulação, que diminui em horizontes de tempo mais longos.
*   **Motivos**: As razões fundamentais e os dados do LifeOS que sustentam a projeção.
*   **Sugestões**: Ações recomendadas para o usuário em relação ao cenário.
*   **Riscos, Oportunidades, Conflitos, Ganhos e Perdas**: Listas detalhadas de elementos específicos identificados na simulação.

## Exemplos de Uso

O Scenario Generator pode responder a perguntas como:

*   "Se eu continuar dormindo pouco, como estará minha saúde em 30 dias?"
*   "Se eu aumentar meus investimentos em X%, qual o ganho potencial em 5 anos?"
*   "Se eu aceitar a proposta de emprego Y, quais os riscos e oportunidades para minha carreira no próximo ano?"

Ao fornecer uma visão estruturada de futuros alternativos, o Scenario Generator capacita o usuário a tomar decisões mais informadas e, consequentemente, a moldar seu próprio futuro de destino.
