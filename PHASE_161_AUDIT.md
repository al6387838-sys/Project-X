# LIFEOS ENTERPRISE v16.5 — Auditoria interna da Phase 161

## Estado confirmado

O repositório ativo é `al6387838-sys/Project-X`, branch `main`, com HEAD inicial `51fdf52f677ac3ddf69a7a639b50b4b2412cee29`. O último release funcional é `v16.0.0`; o relatório `RELEASE_CANDIDATE_v16.md` registra o deploy Cloudflare como pendente.

O build atual conclui, porém `npm run test:production` apresenta 232/257 verificações aprovadas e 25 falhas: 17 rotas internas declaradas sem artefato correspondente e 8 verificações de referências OAuth no HTML minificado.

## Lacunas reais do ciclo de conta

| Fluxo | Estado encontrado | Correção necessária |
|---|---|---|
| Cadastro | Persiste usuário no Cloudflare KV e autentica imediatamente | Criar confirmação de e-mail real; impedir login antes da confirmação; registrar sessão/dispositivo no cadastro somente após confirmação |
| Confirmação de e-mail | Ausente | Implementar token com TTL em KV, endpoint de confirmação, reenvio e tela completa; usar provedor real de e-mail |
| Login | Valida senha e emite cookie HMAC | Respeitar `emailVerified`; registrar sessão e dispositivo automaticamente |
| Logout | Apenas expira cookie | Revogar a sessão corrente no KV antes de expirar o cookie |
| Recuperação | A tela `/forgot-password` chama endpoint legado que não cria token | Consolidar em `/api/password-reset`; remover fallback de log e falhar de forma controlada quando o provedor de e-mail não estiver configurado |
| Alteração de senha | Persiste hash | Revogar outras sessões e invalidar tokens antigos; retornar erro real se usuário/KV não existir |
| Alteração de e-mail | Migra imediatamente a chave do usuário | Exigir confirmação do novo e-mail antes da migração; preservar todos os dados indexados pelo identificador anterior; expirar a sessão após confirmação |
| Exclusão de conta | Remove somente quatro chaves | Excluir integralmente todas as chaves conhecidas do usuário, sessões, dispositivos e tokens; expirar cookie na resposta |
| Sessões ativas | API existe, mas login/cadastro não registram sessões; revogação não invalida token | Registrar automaticamente, marcar sessão corrente por `jti`, manter índice de revogação e validar `jti` em requisições autenticadas |
| Dispositivos | API real está em `/api/security?view=devices`; UI consulta `/api/sessions` | Corrigir contrato, registrar dispositivo automaticamente e revogar pelo endpoint correto |
| Perfil em tempo real | API retorna `{ profile }`; módulo espera `{ user }` | Corrigir frontend, atualizar shell e emitir evento local de perfil após gravação |

## Inconsistências de frontend

Em `premium_ui/modules/enterprise-settings.html`, o carregamento de perfil espera `d.user`, mas `/api/profile` retorna `d.profile`. A revogação envia `sessionId`, enquanto o backend espera `id`. A lista de dispositivos consulta `/api/sessions`, embora os dispositivos estejam em `/api/security?view=devices`. No shell `premium_ui/app_dashboard.html`, os botões “Ativar MFA”, “Ver sessões”, “Exportar dados” e “Importar dados” ainda executam apenas toasts ou comportamento incompleto; o acesso a sessões deve abrir o módulo real.

## Infraestrutura disponível

O projeto já possui `wrangler.toml`, binding `LIFEOS_KV` e configuração de Cloudflare Pages. No ambiente atual não foram encontradas variáveis `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `RESEND_API_KEY` ou `SENDGRID_API_KEY`. O deploy deverá usar autenticação interativa do Cloudflare se necessário. A entrega real de e-mail depende de um serviço externo configurado no Cloudflare; a implementação interna não deve usar mock, placeholder ou logging de token como fallback.
