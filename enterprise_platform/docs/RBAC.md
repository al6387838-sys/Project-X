# Role & Attribute Based Access Control
**EXECUTION-010 | Authorization Framework**

O LifeOS Enterprise utiliza um modelo híbrido (RBAC + ABAC) para garantir flexibilidade e segurança extrema.

## 1. RBAC (Role-Based Access Control)
Controla o acesso com base em papéis estáticos e permissões matriciais.

### Recursos e Ações
- **Recursos:** memory, timeline, decision, insight, organization, workspace, team, billing, audit, etc.
- **Ações:** create, read, update, delete, manage, invite, export, approve, audit.
- **Formato:** `resource:action` (ex: `memory:delete`).

### System Roles
1. **Super Admin:** Acesso total a tudo.
2. **Org Admin:** Administração da organização.
3. **Workspace Admin:** Administração de um workspace.
4. **Manager:** Gestão de equipe.
5. **Member:** Leitura/escrita padrão.
6. **Viewer:** Apenas leitura.
7. **Guest:** Acesso limitado a itens compartilhados.
8. **Billing Admin:** Faturamento.
9. **Security Admin:** Auditoria e compliance.

## 2. ABAC (Attribute-Based Access Control)
Avalia regras dinâmicas em tempo real baseadas no contexto (usuário, ambiente, recurso).

### Exemplo de Política ABAC
**Nome:** "Block sensitive data outside business hours"
**Efeito:** `DENY`
**Condições:**
- `environment.business_hours == False`
- `user.role NOT IN ["super_admin", "security_admin"]`

### Motor de Decisão
O `ABACEngine` avalia as políticas por prioridade. Um `DENY` explícito sempre tem precedência. Se nenhuma política bloquear, o RBAC toma a decisão final.
