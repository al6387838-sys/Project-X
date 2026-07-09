# System Health and Recovery

**Project-X | Sprint 016**

Em um sistema complexo como o LifeOS, a capacidade de monitorar a saúde dos seus componentes e se recuperar automaticamente de falhas é crucial para garantir a disponibilidade e a confiabilidade. O `Kernel Monitor`, integrado ao `Kernel Runtime`, é o componente responsável por essa tarefa vital. Ele atua como um sentinela, observando o estado de cada Engine e do sistema como um todo, e intervindo proativamente para resolver problemas.

## Objetivo e Princípios

O principal objetivo do `System Health and Recovery` é manter o LifeOS operando de forma contínua e estável, minimizando interrupções e garantindo a integridade dos dados e processos. Seus princípios incluem:

*   **Monitoramento Contínuo**: Verificação periódica da saúde de todos os Engines e do Kernel.
*   **Detecção Proativa de Falhas**: Identificação rápida de Engines em estado de erro ou degradação.
*   **Recuperação Automática**: Tentativas de restaurar a funcionalidade de Engines com falha sem intervenção manual.
*   **Transparência de Status**: Fornecimento de relatórios de saúde claros e compreensíveis.
*   **Resiliência**: Capacidade de suportar falhas de componentes individuais sem comprometer todo o sistema.

## O `Kernel Monitor`

O `Kernel Monitor` é a inteligência por trás do sistema de saúde e recuperação. Ele interage diretamente com o `Kernel State Manager` para obter informações sobre o status dos Engines e métricas do sistema, e com o `Kernel Event Manager` para publicar eventos relacionados à saúde e recuperação.

### Funcionalidades Principais

*   **`perform_health_check()`**: Realiza uma varredura completa do estado atual do sistema, gerando um relatório de saúde detalhado. Este relatório inclui:
    *   `timestamp`: Momento da verificação.
    *   `overall_status`: Status geral do sistema (HEALTHY, DEGRADED).
    *   `engine_health`: Status individual de cada Engine (ONLINE, OFFLINE, BUSY, ERROR, RECOVERING).
    *   `queue_status`: Tamanho das filas de eventos e execução.
    *   `system_load`: Carga atual do sistema.
    Se o status geral for `DEGRADED`, um alerta é emitido.

*   **`attempt_recovery(engine_name: str)`**: Inicia um processo de recuperação para um Engine específico. Este processo envolve:
    1.  Atualizar o status do Engine para `RECOVERING` no `Kernel State Manager`.
    2.  Simular uma tentativa de reinício ou reconfiguração (para demonstração, um `time.sleep`).
    3.  Atualizar o status do Engine para `ONLINE` (assumindo sucesso na recuperação).
    4.  Publicar um evento `ENGINE_RECOVERED` via `Kernel Event Manager` para notificar outros componentes.

## Ciclo de Monitoramento e Recuperação

1.  **Monitoramento Periódico**: O `Kernel Runtime` invoca o `Kernel Monitor.perform_health_check()` em intervalos regulares (ex: a cada 10 segundos na demonstração).
2.  **Detecção de Anomalias**: Durante o `health check`, se um Engine for detectado com o status `ERROR` (ou qualquer outro status que indique problema), o `overall_status` do sistema é marcado como `DEGRADED`.
3.  **Início da Recuperação**: Se uma anomalia for detectada e o sistema estiver configurado para recuperação automática, o `Kernel Monitor.attempt_recovery()` é acionado para o Engine problemático.
4.  **Processo de Recuperação**: O Engine passa para o estado `RECOVERING`. O `Kernel Monitor` tenta restaurar sua funcionalidade.
5.  **Notificação de Recuperação**: Após uma recuperação bem-sucedida, o Engine retorna ao estado `ONLINE`, e um evento `ENGINE_RECOVERED` é publicado, permitindo que outros Engines reajam a essa mudança.

## Registro de Eventos de Saúde

Todos os eventos relacionados à saúde e recuperação são registrados pelo `Kernel Event Manager` e podem ser auditados através do `Trust Engine`. Isso inclui:

*   `ENGINE_STATUS_UPDATE`: Mudanças no status de um Engine.
*   `SYSTEM_DEGRADED`: Quando o sistema entra em um estado degradado.
*   `ENGINE_RECOVERING`: Quando um Engine está em processo de recuperação.
*   `ENGINE_RECOVERED`: Quando um Engine é recuperado com sucesso.

### Exemplo de Uso (Health Check e Recovery)

```python
from life_kernel.core.kernel_runtime import KernelRuntime
from life_kernel.core.models import EngineStatus
import time

kernel = KernelRuntime()

print("\n--- SIMULAÇÃO: HEALTH CHECK INICIAL ---")
initial_report = kernel.get_health_report()
print(f"Status Geral: {initial_report["overall_status"]}")
print(f"Saúde dos Engines: {initial_report["engine_health"]}")

print("\n--- SIMULAÇÃO: FALHA DE UM ENGINE (LifeGraph) ---")
kernel.state_manager.update_engine_status("LifeGraph", EngineStatus.ERROR)

print("\n--- SIMULAÇÃO: HEALTH CHECK APÓS FALHA ---")
failed_report = kernel.get_health_report()
print(f"Status Geral: {failed_report["overall_status"]}")
print(f"Saúde do LifeGraph: {failed_report["engine_health"]["LifeGraph"]}")

print("\n--- SIMULAÇÃO: TENTATIVA DE RECUPERAÇÃO DO LifeGraph ---")
kernel.trigger_recovery("LifeGraph")

print("\n--- SIMULAÇÃO: HEALTH CHECK APÓS RECUPERAÇÃO ---")
recovered_report = kernel.get_health_report()
print(f"Status Geral: {recovered_report["overall_status"]}")
print(f"Saúde do LifeGraph: {recovered_report["engine_health"]["LifeGraph"]}")

# Iniciar o Kernel Runtime para ver o monitoramento periódico
print("\n--- INICIANDO KERNEL RUNTIME PARA MONITORAMENTO PERIÓDICO (15s) ---")
kernel.start()
time.sleep(15) # Espera para ver alguns health checks periódicos
kernel.stop()
```

O sistema de saúde e recuperação do Life Kernel é a garantia de que o LifeOS é um parceiro confiável e resiliente, capaz de se adaptar e superar desafios operacionais para continuar servindo ao usuário de forma ininterrupta.
