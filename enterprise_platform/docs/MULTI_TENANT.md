# Multi-Tenant Architecture
**EXECUTION-010 | Isolation & Routing**

## O Problema
Sistemas SaaS precisam compartilhar infraestrutura (banco de dados, computação) entre vários clientes sem misturar seus dados.

## A Solução: Multi-Tenant Engine
O `MultiTenantEngine` do LifeOS utiliza uma abordagem de **Isolamento Lógico (Row-level security via Context)**.

### Como Funciona
1. **Resolução de Tenant:** Ocorre no API Gateway. O tenant é resolvido via API Key, JWT claim ou subdomínio (`acme.lifeos.app`).
2. **Context Manager:** O request entra em um bloco `with engine.tenant_context(org_id)`.
3. **Thread-Local Storage:** O `org_id` é salvo no storage da thread atual.
4. **Isolamento Automático:** Qualquer query ao banco de dados passa pelo método `isolate_query()`, que injeta automaticamente `WHERE org_id = '...'`.
5. **Prevenção de Vazamento:** O método `assert_tenant_access()` valida se a entidade sendo acessada pertence ao tenant atual. Se não, levanta `TenantIsolationError` e gera um log crítico no Audit Center.

### Exemplo de Uso
```python
with tenant_engine.tenant_context("org_acme_123") as ctx:
    # Seguro: Só retornará dados da ACME
    users = db.query(User).filter_by(**tenant_engine.isolate_query({})).all()
```
