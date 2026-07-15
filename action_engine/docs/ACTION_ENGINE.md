# LIFEOS Enterprise — AI Automation & Action Engine

O **Action Engine v2.0** é a superfície canônica para transformar decisões, eventos, regras e workflows em ações governadas. A Phase 064 mantém os modelos e controles existentes, mas substitui a automação mínima por uma engine determinística, auditável e integrada ao framework da Phase 061.

## Princípios arquiteturais

**Governança por padrão.** Ações críticas continuam aguardando aprovação humana; prioridade superior a 80 ou confiança inferior a 0,8 nunca é executada automaticamente. Cada ação preserva origem, justificativa, objetivo, resultado esperado, parâmetros e metadados de auditoria.

**Idempotência e isolamento.** Eventos podem informar `event_id`; replays não recriam ações. Regras com falha são registradas e não bloqueiam regras independentes. Handlers com falha não interrompem a execução das próximas ações.

**Integração sem acoplamento.** Módulos registram handlers via `register_module_action`. Integrações externas utilizam exclusivamente `bind_integration_sdk`, que publica `integration.execute`, `integration.extension` e `integration.sync` sobre o Integration SDK.

**Workflows seguros.** Etapas formam um grafo acíclico dirigido, validado no registro. Dependências concretas são ligadas por IDs de ação; a ordem do grafo prevalece sobre prioridade, e políticas `on_failure` controlam interrupção ou continuidade.

| Componente | Responsabilidade |
|---|---|
| **ActionPlanner** | Converte decisões em ações e separa parâmetros executáveis de metadados de governança. |
| **AutomationEngine** | Avalia regras contextuais ou inteligentes, recebe eventos e planeja workflows. |
| **ExecutionManager** | Gerencia filas, aprovações, handlers, dependências, idempotência, resultados e falhas. |
| **ActionEngine** | Unifica decisões, eventos, workflows, módulos e Integration SDK em um único ciclo. |
| **ApprovalManager** | Mantém o contrato independente de revisão humana e auditoria. |
| **RollbackManager** | Aplica estratégias de compensação em ações concluídas. |

## Fluxo definitivo

Uma decisão ou evento entra pela fachada `ActionEngine`. Regras compatíveis geram decisões explicáveis, o planner cria ações canônicas, e o executor encaminha cada ação para aprovação ou fila. Workflows são planejados em ordem topológica e suas dependências são verificadas em runtime. Na execução, o handler registrado para `action_type` realiza a operação; o resultado ou erro é anexado aos metadados da ação e registrado na trilha de execução.

## Regras e gatilhos

Regras aceitam tipo de gatilho, cooldown, limite de execuções e metadados. Regras inteligentes usam função de score e limiar explícito entre 0 e 1. Os tipos de gatilho podem representar eventos de domínio, módulos, webhooks, sincronização, calendário, comunicação ou finanças.

```python
engine.automation.add_smart_rule(
    "finance.anomaly",
    score=lambda context: context["risk_score"],
    threshold=0.8,
    template={"action_type": "module.finance.review", "priority": 70},
    trigger_type="finance.transaction.created",
)
engine.process_event(
    "finance.transaction.created",
    {"risk_score": 0.91},
    event_id="transaction-123",
)
```

## Workflows e ações entre módulos

Toda ação interna deve usar namespace `module.<módulo>.<ação>`. A engine valida IDs, ciclos e dependências no registro do workflow. Execuções recebem `run_id` idempotente e produzem metadados com workflow, run, etapa, dependências e política de falha.

```python
engine.register_module_action("communication", "notify", notify_handler)
engine.register_workflow(
    "account-alert",
    [
        {
            "step_id": "notify",
            "action_template": {
                "action_type": "module.communication.notify",
                "priority": 50,
                "parameters": {"account_id": "{account_id}"},
            },
        }
    ],
)
engine.launch_workflow("account-alert", {"account_id": "acc-1"}, run_id="alert-1")
engine.run_cycle()
```

## Integration SDK

Nenhum workflow deve acessar managers ou providers diretamente. Após `bind_integration_sdk(sdk)`, as ações externas usam um dos tipos abaixo.

| Tipo de ação | Uso |
|---|---|
| `integration.execute` | Executa operação em um conector autorizado. |
| `integration.extension` | Invoca extensão de domínio registrada, como `finance.reconcile`. |
| `integration.sync` | Solicita sincronização pelo Sync Engine canônico. |

## Compatibilidade e QA

Os contratos legados `add_rule`, `check_triggers`, `toggle_rule`, `process_decisions`, `run_cycle` e os modelos `Action`/`ActionGroup` foram preservados. A suíte da Phase 064 cobre idempotência, limites, scores, isolamento de regras, DAG, aprovação humana, detecção de ciclos, Integration SDK e ações entre módulos.
