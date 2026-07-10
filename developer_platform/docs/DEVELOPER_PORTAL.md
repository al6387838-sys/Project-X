# LifeOS Developer Portal
**EXECUTION-009 | Developer Platform**

O Developer Portal é o ponto central para desenvolvedores que desejam construir sobre o LifeOS. Ele fornece acesso à documentação completa, gerenciamento de API Keys, registro de aplicações OAuth e monitoramento de uso.

## Acesso

- **Produção:** https://developers.lifeos.app
- **Sandbox:** https://sandbox.lifeos.app

## Funcionalidades

### 1. Gerenciamento de Aplicações OAuth
Registre aplicações que atuam em nome de usuários do LifeOS. Cada aplicação recebe um `client_id` e `client_secret` para autenticação via OAuth 2.0.

### 2. Gerenciamento de API Keys
Crie e revogue chaves de API com escopos granulares. Chaves de produção têm prefixo `lk_live_` e chaves de sandbox têm prefixo `lk_test_`.

### 3. Monitoramento de Uso
Acompanhe o consumo de rate limits, erros e latência das suas integrações em tempo real.

### 4. Webhooks
Registre endpoints para receber notificações em tempo real sobre eventos do LifeOS.

### 5. Sandbox
Acesse o ambiente isolado de testes com dados de exemplo e API Key dedicada.

## Escopos de API

| Escopo | Descrição |
|---|---|
| `read:memory` | Leitura de memórias |
| `write:memory` | Criação e edição de memórias |
| `read:timeline` | Leitura de eventos da timeline |
| `write:timeline` | Adição de eventos à timeline |
| `read:decisions` | Leitura de decisões |
| `read:insights` | Acesso a insights gerados por IA |
| `manage:webhooks` | Gerenciamento de webhooks |
| `manage:api_keys` | Gerenciamento de chaves de API |
