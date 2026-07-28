# Microsoft Ecosystem — Release v51.0.0

## Status: Pronta para Produção

**Data:** 28 de julho de 2026  
**Versão:** v51.0.0  
**Tag:** microsoft-ecosystem-enterprise  
**Status dos testes:** 106/106 passaram

---

## Funcionalidades Implementadas

### Microsoft Graph API Client (Core)
O módulo `functions/api/microsoft/graph-client.js` é o cliente unificado que gerencia toda a comunicação com a Microsoft Graph API. Ele implementa autenticação OAuth 2.0 com refresh automático de tokens, retry logic (3 tentativas com backoff), tratamento de rate-limiting (429), e refresh automático em caso de token expirado (401). O cliente é organizado em quatro módulos: `MAIL`, `CALENDAR`, `ONEDRIVE` e `TEAMS`, cada um encapsulando as operações específicas do respectivo serviço.

### Outlook Mail
A integração de e-mail cobre todo o ciclo de vida de mensagens. É possível listar mensagens por pasta (inbox, sent, drafts, deleteditems), obter detalhes de uma mensagem individual, listar pastas, obter anexos, pesquisar mensagens por texto livre, enviar e-mails novos, criar rascunhos, enviar rascunhos, responder, responder a todos, encaminhar, marcar como lida/não lida, mover entre pastas, deletar permanentemente, mover para lixeira e restaurar da lixeira.

### Outlook Calendar
O calendário suporta visualização de eventos em um intervalo de tempo (calendarView), listagem de calendários disponíveis, obtenção de detalhes de um evento, criação de novos eventos, atualização de eventos existentes, exclusão de eventos, aceitação de convites, recusa de convites, aceite provisório (tentative), e proposta de novo horário. A sincronização é bidirecional — eventos criados no LIFEOS aparecem no Outlook e vice-versa.

### OneDrive
A integração de arquivos inclui listagem da raiz, listagem de itens em qualquer pasta, obtenção de detalhes de um item, listagem de arquivos recentes, busca por texto livre, listagem de permissões, criação de pastas, upload de arquivos (via base64), exclusão de itens, renomeação, movimentação entre pastas, geração de links de compartilhamento (view/edit, anonymous/organization), e convite de compartilhamento por e-mail com mensagem personalizada.

### Microsoft Teams
A integração de Teams cobre listagem de equipes do usuário, listagem de canais de uma equipe, listagem de mensagens de um canal, envio de mensagens em canais, resposta a mensagens, exclusão de mensagens, listagem de arquivos da equipe, e listagem de tabs de um canal.

### Communication Hub
O Microsoft foi adicionado como provedor Enterprise no Communication Hub com status dinâmico em tempo real. A UI mostra o dot de status (verde/âmbar/vermelho), nome do perfil conectado, e-mail, data de última sincronização, e data de expiração do token. Botões de Conectar, Atualizar e Desconectar estão disponíveis na página de Outlook dentro do módulo de Mensagens.

---

## Dependências de Credenciais

A integração funciona imediatamente após a configuração das seguintes variáveis de ambiente no Cloudflare Pages:

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `MICROSOFT_CLIENT_ID` | Client ID do App registrado no Azure AD (Azure Portal → App registrations) | Sim |
| `MICROSOFT_CLIENT_SECRET` | Client Secret gerado no Azure AD | Sim |

O App no Azure AD deve ter as seguintes permissões configuradas:
- User.Read
- Mail.Read, Mail.Send, Mail.ReadWrite
- Calendars.Read, Calendars.ReadWrite
- Files.Read.All, Files.ReadWrite.All
- Sites.Read.All
- Channel.ReadBasic.All, ChannelMessage.Read, ChannelMessage.Send
- Chat.Read

A redirect URI deve ser: `https://<domínio>/api/oauth/callback/microsoft_365`

---

## Checklist de Ativação para Produção

### 1. Configuração Azure AD
- Acessar [Azure Portal](https://portal.azure.com) → App registrations
- Criar novo App Registration (ou usar existente)
- Adicionar redirect URI: `https://<domínio>/api/oauth/callback/microsoft_365`
- Gerar Client Secret (não expira em 24 meses recomendado)
- Copiar Application (client) ID

### 2. Permissões Graph API
- API Permissions → Add a permission → Microsoft Graph → Delegated permissions
- Adicionar: User.Read, Mail.Read, Mail.Send, Mail.ReadWrite, Calendars.Read, Calendars.ReadWrite, Files.Read.All, Files.ReadWrite.All, Sites.Read.All, Channel.ReadBasic.All, ChannelMessage.Read, ChannelMessage.Send, Chat.Read
- Clicar em "Grant admin consent"

### 3. Cloudflare Pages
- Settings → Environment Variables
- Adicionar: `MICROSOFT_CLIENT_ID` e `MICROSOFT_CLIENT_SECRET`
- Redeploy (trigger automatico via push ao main)

### 4. Validação
- Acessar LIFEOS → Mensagens → Microsoft Outlook
- Status deve mostrar "Credenciais: configuradas"
- Clicar em "Conectar Microsoft" → autorizar na janela pop-up
- Status deve mudar para "Conectado" com nome e e-mail do usuário
- Testar: enviar e-mail, criar evento, listar OneDrive, listar Teams

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIFEOS ENTERPRISE                            │
├─────────────────────────────────────────────────────────────────┤
│  premium_ui/modules/communication.html                          │
│    ├── msRefreshStatus() → /api/microsoft?action=status         │
│    ├── msConnect() → /api/microsoft?action=oauth-url            │
│    └── msDisconnect() → POST /api/microsoft {disconnect}        │
├─────────────────────────────────────────────────────────────────┤
│  functions/api/microsoft.js (REST Endpoint)                     │
│    GET: status, profile, test, oauth-url,                       │
│         mail-list, mail-get, mail-folders, mail-search,         │
│         calendar-view, calendar-list, calendar-get,             │
│         onedrive-root, onedrive-list, onedrive-search,          │
│         teams-list, teams-channels, teams-messages,             │
│    POST: refresh-token, disconnect, reconnect,                  │
│          mail-send, mail-reply, mail-forward,                   │
│          calendar-create, calendar-accept, calendar-decline,    │
│          onedrive-upload, onedrive-share, onedrive-invite,      │
│          teams-send, teams-reply                                │
├─────────────────────────────────────────────────────────────────┤
│  functions/api/microsoft/graph-client.js (Core Client)          │
│    ├── getAccessToken() → auto-refresh                          │
│    ├── refreshAccessToken()                                     │
│    ├── graphRequest() → retry + 401 refresh                     │
│    ├── graphDownload()                                          │
│    ├── MAIL { listMessages, getMessage, sendMessage, ... }      │
│    ├── CALENDAR { getCalendarView, createEvent, ... }           │
│    ├── ONEDRIVE { getRoot, listItems, uploadFile, ... }         │
│    └── TEAMS { listTeams, listChannels, sendMessage, ... }      │
├─────────────────────────────────────────────────────────────────┤
│  functions/api/oauth/callback/[provider].js                     │
│    └── microsoft_365 → persist in KV oauth:token:{userId}:...   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos

A integração Microsoft Ecosystem está completa e homologada. O próximo checkpoint é a integração do **Google Workspace Enterprise** (Gmail, Google Drive, Google Meet, Google Calendar), seguindo a mesma arquitetura de client unificado e OAuth 2.0.
