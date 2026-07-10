# Admin Console
**EXECUTION-010 | Enterprise Admin Interface**

O Admin Console do LifeOS Enterprise é a interface central de gestão para Super Admins e Org Admins. Disponível em `enterprise_dashboard.html`, foi construído sobre o LifeOS Design System v3.0.0 (midnight dark, Inter + JetBrains Mono).

## Seções Principais

| Seção | Descrição |
|---|---|
| **Dashboard** | Visão geral: organizações, membros, workspaces, alertas |
| **Organizations** | Criar, suspender, atualizar planos, gerenciar compliance |
| **Workspaces** | Hierarquia de departamentos, equipes e projetos |
| **Members & Teams** | Gestão de membros, roles e equipes |
| **Roles & Permissions** | Matriz RBAC, custom roles, ABAC policies |
| **SSO & Identity** | Configurar SAML, OIDC, LDAP, SCIM |
| **Audit Center** | Logs imutáveis, alertas de segurança, exportação SIEM |
| **Security Center** | Alertas ativos, bloqueios de IP, sessões suspeitas |
| **Compliance Dashboard** | Scores ISO 27001, SOC 2, LGPD, GDPR; DSR requests |
| **Billing Center** | Planos, assinaturas, faturas, uso por organização |

## Acesso
- Super Admin: acesso total a todas as organizações.
- Org Admin: acesso restrito à própria organização.
- Security Admin: acesso ao Audit Center e Security Center.
- Billing Admin: acesso ao Billing Center.
