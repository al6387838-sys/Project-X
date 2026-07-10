# LifeOS CLI v2.0.0
**EXECUTION-009 | Developer Platform**

A Interface de Linha de Comando (CLI) oficial do LifeOS permite que você interaja com a plataforma diretamente do seu terminal. É ideal para automação de tarefas, integração contínua (CI/CD) e gerenciamento rápido de recursos.

## Instalação

```bash
# O CLI é instalado junto com o SDK Python
pip install lifeos-sdk
```

## Autenticação

Para começar a usar o CLI, você precisa se autenticar:

```bash
lifeos auth login
```
Isso abrirá o navegador para você autorizar o CLI no Developer Portal.

Para verificar o status da sua autenticação:
```bash
lifeos auth status
```

## Comandos Principais

### Memory

```bash
# Listar memórias recentes
lifeos memory list

# Criar uma nova memória
lifeos memory create "Reunião de alinhamento estratégico concluída"

# Obter detalhes de uma memória
lifeos memory get mem_01abc
```

### Webhooks

```bash
# Listar webhooks registrados
lifeos webhooks list

# Criar um novo webhook
lifeos webhooks create --url https://api.meuapp.com/webhook --events memory.created,insight.generated

# Testar a entrega de um webhook
lifeos webhooks test wh_01abc
```

### API Keys

```bash
# Listar chaves de API
lifeos api-keys list

# Criar uma nova chave (ATENÇÃO: O segredo só é exibido uma vez)
lifeos api-keys create --name "Produção" --scopes read:memory,write:timeline

# Revogar uma chave
lifeos api-keys revoke key_01abc
```

### Sandbox

```bash
# Popular o sandbox com dados de teste
lifeos sandbox seed

# Resetar o sandbox (apaga todos os dados de teste)
lifeos sandbox reset

# Verificar status do sandbox
lifeos sandbox status
```

### Informações da API

```bash
# Verificar a saúde da API
lifeos api health

# Listar versões da API e seus status de depreciação
lifeos api versions
```
