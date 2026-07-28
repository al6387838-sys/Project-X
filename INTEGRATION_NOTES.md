# Integração WhatsApp — Notas de Implementação

## Arquitetura Existente

### Backend APIs (já existentes):
- `functions/api/comm-hub.js` — Communication Hub principal (envio/inbox/CRUD/email)
- `functions/api/messages.js` — Conversas/Mensagens (KV: msg:conversations, msg:messages)
- `functions/api/communication/hub.js` — Monitor/Status/Logs/Queue
- `functions/api/communication/callback/[provider].js` — OAuth callback
- `functions/api/connectors/communication.js` — Conectores legados
- `functions/api/automations.js` — Automações (inclui send_whatsapp)

### Frontend:
- `premium_ui/modules/communication.html` — UI principal (chat, conversas, filtros por canal)
- `premium_ui/modules/communication-hub.html` — Monitor do hub

### WhatsApp já implementado:
- Envio via Graph API (text, image, document) — comm-hub.js:156-181, communication/hub.js:186-207
- OAuth connect flow — comm-hub.js:784-786
- Status check — communication/hub.js:336-341

### Lacunas identificadas:
1. Webhook handler para recebimento de mensagens (NÃO existe)
2. Ponte entre envio WhatsApp e msg:conversations/msg:messages (NÃO existe)
3. Download de mídia WhatsApp (NÃO existe)
4. Notificações para mensagens recebidas (NÃO existe)
5. Templates WhatsApp no front-end (existem mas são estáticos)

## Nova Arquitetura Implementada

### Novos endpoints:
- `functions/api/webhooks/whatsapp.js` — Webhook handler (GET verify + POST receive)
- `functions/api/webhooks/whatsapp-media.js` — Download/upload de mídia
- `functions/api/whatsapp-bridge.js` — Ponte WhatsApp ↔ Messages API

### Fluxos:
1. **Envio**: Frontend → /api/whatsapp-bridge?action=send → Graph API → persiste em msg:messages
2. **Recebimento**: Meta → /api/webhooks/whatsapp → cria/atualiza msg:conversations + msg:messages
3. **Mídia**: /api/webhooks/whatsapp-media?id={id} → download + cache R2
4. **Notificações**: Webhook cria entrada em notifications:{userId}
5. **Status**: /api/webhooks/whatsapp → status updates atualizam comm:history

## Variáveis Cloudflare necessárias:
- WHATSAPP_APP_ID
- WHATSAPP_APP_SECRET (para OAuth callback)
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_ID
- WHATSAPP_VERIFY_TOKEN (para webhook verification)

## Storage namespaces usados:
- `msg:conversations:system` — Conversas WhatsApp (compartilhado)
- `msg:messages:system:{convId}` — Mensagens por conversa
- `comm:history:{userId}` — Histórico de comunicação
- `comm:logs:{userId}` — Logs de eventos
- `notifications:{userId}` — Notificações internas
- R2: `messages/{userId}/{convId}/{id}/{fileName}` — Anexos
