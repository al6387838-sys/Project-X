# Programa Beta Privado do LifeOS

## Visão Geral

O Programa Beta Privado do LifeOS foi desenvolvido para permitir que um grupo seleto de usuários teste as novas funcionalidades e forneça feedback valioso antes do lançamento público. Este documento detalha os componentes principais que suportam o programa, incluindo o gerenciamento de convites, lista de espera e controle de acesso.

## Componentes Principais

### Beta Program Manager (`beta-manager.js`)

O `BetaManager` é o coração do programa beta, responsável por gerenciar a entrada e o acesso dos usuários. Ele lida com:

- **Lista de Espera**: Permite que usuários interessados se inscrevam e sejam gerenciados em uma fila, com priorização por tiers (Early Access, Standard, VIP).
- **Geração de Códigos de Convite**: Cria códigos únicos e com validade limitada para convidar usuários específicos.
- **Validação e Resgate de Convites**: Verifica a validade dos códigos e os resgata, concedendo acesso ao beta.
- **Controle de Acesso**: Determina se um usuário tem permissão para acessar o ambiente beta e qual o seu tier.
- **Rastreamento Básico de Usuários Beta**: Armazena informações como data de entrada, último acesso e contadores de feedback/crash reports.

#### Estrutura de Dados Interna

O `BetaManager` mantém um objeto `betaData` no `localStorage` com as seguintes chaves:

- `waitlist`: Array de objetos de usuários na lista de espera.
- `inviteCodes`: Array de objetos de códigos de convite gerados, com status de uso e expiração.
- `betaUsers`: Array de objetos de usuários que já foram aceitos no programa beta.
- `tiers`: Objeto que define os diferentes níveis de acesso e seus limites de slots.

### Fluxo de Entrada de um Beta Tester

1. **Inscrição na Lista de Espera**: Um usuário pode se inscrever na lista de espera, fornecendo seu e-mail e, opcionalmente, um tier preferencial. Ele recebe um código de referência.
2. **Geração de Convite**: Um administrador (ou o próprio sistema, com base na posição na lista de espera) gera um código de convite para o usuário.
3. **Validação do Convite**: O usuário recebe o código e tenta resgatá-lo. O sistema valida o código (existência, expiração, uso).
4. **Acesso ao Beta**: Se o código for válido, o usuário é adicionado à lista de `betaUsers`, removido da `waitlist` (se aplicável) e ganha acesso ao LifeOS Beta.
5. **Atualização de Atividade**: A cada sessão, a atividade do usuário beta é registrada para métricas de retenção e engajamento.

## LGPD/GDPR e Privacidade

Todos os dados coletados pelo `BetaManager` são tratados com foco na privacidade. Informações sensíveis são minimizadas e o sistema é projetado para ser compatível com LGPD e GDPR, especialmente quando integrado ao `TelemetryEngine` que lida com consentimento explícito e anonimização. O direito ao esquecimento é suportado através da função `deleteAllData` no `TelemetryEngine`.

## Integração com Outros Componentes

O `BetaManager` se integra diretamente com o `TelemetryEngine` para registrar eventos de entrada e atividade do usuário, e com o `FeedbackCenter` para rastrear o feedback enviado pelos beta testers. Ele também pode ser usado em conjunto com o `FeatureFlagsEngine` para controlar o acesso a funcionalidades específicas com base no tier do usuário.
