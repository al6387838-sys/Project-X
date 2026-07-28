# Microsoft Ecosystem — Notas de Implementação

## Estado Prévio
- OAuth callback: functions/api/oauth/callback/[provider].js — já suporta microsoft
- Communication callback: functions/api/communication/callback/[provider].js — já suporta outlook
- comm-hub.js: já tem envio outlook, inbox, delete, restore, move, mark-read, search
- events.js: já tem outlook-sync (pull de calendarView)
- integrations.js: já tem microsoft_365 com test, refresh-token, oauth-url
- oauth-manager.js: já tem provider outlook com authUrl, tokenUrl, scopes
- frontend communication.html: já tem seção page-comm-outlook com botão Conectar

## Novo Arquivo
- functions/api/microsoft/graph-client.js — cliente unificado Graph API

## Próximo: API de integração Microsoft (nova rota)
- functions/api/microsoft/[action].js — endpoint REST completo

## Scopes necessários
- offline_access (refresh token)
- User.Read (perfil)
- Mail.Read, Mail.Send, Mail.ReadWrite (Outlook)
- Calendars.Read, Calendars.ReadWrite (Calendar)
- Files.Read.All, Files.ReadWrite.All (OneDrive)
- Channel.ReadBasic.All, ChannelMessage.Read, ChannelMessage.Send (Teams)
- User.Read.All (busca de pessoas)
- Sites.Read.All (SharePoint/OneDrive compartilhado)
