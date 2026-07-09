# LifeOS API Reference

**Project-X | Sprint 014**

A LifeOS API é a interface principal para que plugins e aplicativos externos interajam com os motores do LifeOS de forma programática. Todo acesso é mediado pelo `PermissionManager`, garantindo que as permissões concedidas pelo usuário sejam respeitadas.

## Estrutura da Resposta da API (`APIResponse`)

Todas as chamadas à API retornam um objeto `APIResponse` padronizado:

| Atributo | Tipo | Descrição |
|---|---|---|
| `success` | `bool` | Indica se a operação foi bem-sucedida. |
| `data` | `Any` | Os dados retornados pela operação, se `success` for `True`. |
| `error` | `Optional[str]` | Mensagem de erro, se `success` for `False`. |
| `timestamp` | `float` | Timestamp da resposta. |

## Autenticação e Autorização

Cada chamada à API requer um `session_id` válido, obtido através do `PermissionManager` após o consentimento do usuário. O `session_id` é usado para verificar as permissões concedidas para a sessão atual.

## Endpoints da API

Abaixo estão os principais endpoints e as permissões necessárias para acessá-los. O `user_id` é implicitamente gerenciado pelo SDK e associado à sessão.

### Life Graph

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `GET` | `/life_graph/goals` | `life_graph.read` | Retorna as metas e objetivos do usuário. |
| `POST` | `/life_graph/goals/{goal_id}/progress` | `life_graph.write` | Atualiza o progresso de uma meta específica. |

### Context Engine

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `GET` | `/context` | `context.read` | Retorna o contexto atual do usuário. |
| `PUT` | `/context` | `context.write` | Atualiza o contexto do usuário com novos dados. |

### Timeline

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `GET` | `/timeline/events` | `timeline.read` | Retorna eventos da linha do tempo do usuário. |
| `POST` | `/timeline/events` | `timeline.write` | Adiciona um novo evento à linha do tempo. |

### Memory Engine

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `GET` | `/memory?query={query}` | `memory.read` | Busca itens na memória do usuário. |
| `POST` | `/memory` | `memory.write` | Adiciona um novo item à memória do usuário. |

### Future Engine

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `POST` | `/future/simulate` | `future_engine.simulate` | Simula um cenário futuro com base em uma situação. |
| `GET` | `/future/risks` | `future_engine.read` | Retorna riscos detectados para o usuário. |
| `GET` | `/future/opportunities` | `future_engine.read` | Retorna oportunidades detectadas para o usuário. |

### Mission Engine

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `GET` | `/missions` | `mission_engine.read` | Retorna todas as missões do usuário. |
| `POST` | `/missions` | `mission_engine.write` | Cria uma nova missão para o usuário. |
| `PUT` | `/missions/{mission_id}/status` | `mission_engine.write` | Atualiza o status de uma missão existente. |

### Life Companion

| Método | Endpoint | Permissão Necessária | Descrição |
|---|---|---|---|
| `POST` | `/companion/notify` | `companion.send_notification` | Envia uma notificação ao usuário via Companion. |
| `PUT` | `/companion/dashboard` | `companion.update_dashboard` | Atualiza o dashboard do Companion com novos dados. |

## Tratamento de Erros

Se uma chamada à API falhar (ex: permissão negada, erro interno), o campo `success` será `False` e o campo `error` conterá uma mensagem descritiva do problema. Os desenvolvedores devem sempre verificar o campo `success` antes de tentar processar os dados retornados.
