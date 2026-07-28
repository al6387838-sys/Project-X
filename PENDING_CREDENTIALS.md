# Credenciais Pendentes — LifeOS Enterprise

As seguintes variáveis de ambiente devem ser configuradas manualmente no painel do Cloudflare Pages (ou via \`wrangler secret put\`) para ativar as funcionalidades correspondentes:

| Variável | Serviço | Onde Obter |
|---|---|---|
| \`RESEND_API_KEY\` | Email (Resend) | [resend.com/api-keys](https://resend.com/api-keys) |
| \`EMAIL_FROM\` | Email Sender | Endereço de email verificado no Resend |
| \`LIFEOS_ADMIN_PASSWORD_HASH\` | Admin Auth | Hash bcrypt da senha do administrador |
| \`WHATSAPP_ACCESS_TOKEN\` | WhatsApp API | [developers.facebook.com](https://developers.facebook.com) |
| \`WHATSAPP_PHONE_ID\` | WhatsApp API | [developers.facebook.com](https://developers.facebook.com) |
| \`STRIPE_SECRET_KEY\` | Pagamentos | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| \`GOOGLE_CLIENT_ID\` | Google OAuth | [console.cloud.google.com](https://console.cloud.google.com) |

