# Decision History e Aprendizagem

**Projeto:** PROJECT-X | **Fase:** 3 | **Sprint:** 021

O **Decision History** é o módulo de persistência e aprendizagem do Decision Engine. Ele não apenas armazena o histórico de recomendações, mas atua como a base de dados para o sistema de feedback contínuo do LifeOS.

## Armazenamento de Histórico

Toda vez que o Decision Engine gera uma recomendação, o objeto `Decision` completo é armazenado no `DecisionHistory`. Isso inclui o contexto utilizado, as alternativas avaliadas, os scores calculados e a justificativa.

*   **Rastreabilidade:** Permite auditar por que uma decisão foi tomada semanas ou meses depois.
*   **Consulta de Contexto:** Facilita a análise de quais variáveis de contexto geraram recomendações de maior impacto.

## Sistema de Feedback

A evolução do Decision Engine depende da interação do usuário. O fluxo de feedback funciona da seguinte forma:

1.  O sistema apresenta a `recommendation` ao usuário.
2.  O usuário pode **aceitar** (`accepted=True`) ou **rejeitar** (`accepted=False`) a recomendação.
3.  Opcionalmente, o usuário pode fornecer um `feedback_text` explicando o motivo da rejeição ou aceitação.
4.  O status da decisão no histórico é atualizado para `accepted` ou `rejected`.
5.  Uma entrada de feedback é registrada no `feedback_log`.

## Aprendizagem Contínua (Learning Boost)

O Decision Engine utiliza o histórico de feedback para ajustar decisões futuras. 

*   **Extração de Padrões:** O método `get_learning_patterns()` analisa o `feedback_log` filtrado por categoria para calcular a taxa de aceitação e extrair padrões comportamentais.
*   **Aplicação no Decision Score:** Se uma categoria possui um histórico de alta aceitação (o usuário concorda frequentemente com as sugestões de "Saúde", por exemplo), o motor aplica um **Learning Boost** (até +20% no Decision Score).
*   **Evolução Futura:** Em sprints subsequentes, o *Evolution Engine* utilizará este log de feedback para ajustar dinamicamente os pesos dos fatores de contexto, criando um modelo de decisão hiper-personalizado.
