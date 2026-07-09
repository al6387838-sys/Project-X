# Approval System

O **Approval System**, implementado pelo `ApprovalManager`, é um componente crítico do Action Engine que garante a segurança e o controle sobre a execução de ações. Ele impede que ações consideradas críticas ou de alto impacto sejam executadas sem a validação explícita de um usuário humano.

## Por que um Sistema de Aprovação?

O sistema de IA do PROJECT-X é projetado para ser autônomo, mas a segurança e a confiança do usuário são primordiais. Ações que podem ter consequências irreversíveis, financeiras, de saúde ou que alteram significativamente o estado do usuário ou do ambiente, devem passar por um crivo humano. Isso evita execuções indesejadas e mantém o usuário no controle final.

## Como Funciona

1.  **Identificação de Ações Críticas:** Durante o planejamento (`ActionPlanner`), uma ação é marcada com `approval_required = True` se sua prioridade for muito alta, sua confiança for baixa ou se for categorizada como crítica (ex: transações financeiras, alterações de agendamento importantes).
2.  **Requisição de Aprovação (`request_approval`):** Quando uma ação com `approval_required = True` é enfileirada, ela não vai diretamente para a fila de execução. Em vez disso, o `ExecutionManager` a encaminha para o `ApprovalManager`.
3.  **Fila de Aprovação Pendente:** O `ApprovalManager` mantém uma lista de `pending_requests`, que são ações aguardando a decisão do usuário.
4.  **Decisão do Usuário:** O usuário (ou um sistema externo de interface) pode então:
    *   **Aprovar (`approve`):** A ação é movida para a fila de execução do `ExecutionManager` com o status `approved`.
    *   **Rejeitar (`reject`):** A ação é marcada como `rejected` e removida do fluxo de execução. O motivo da rejeição é registrado.
5.  **Registro Histórico:** Todas as decisões de aprovação ou rejeição são registradas no `approval_history` para auditoria e rastreabilidade.

## Explicabilidade

Para cada requisição de aprovação, o `ApprovalManager` pode fornecer um resumo (`get_pending_summary`) que inclui o objetivo da ação, sua justificativa (herdada da decisão original) e sua prioridade. Isso permite que o usuário tome uma decisão informada, compreendendo o contexto e o raciocínio por trás da ação proposta pela IA.
