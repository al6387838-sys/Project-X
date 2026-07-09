# Sistema de Permissões do LifeOS

**Project-X | Sprint 014**

O Sistema de Permissões do LifeOS é a base da segurança e privacidade da plataforma, garantindo que o acesso de plugins e aplicativos externos aos dados e funcionalidades do usuário seja estritamente controlado. Ele é implementado principalmente pelo `PermissionManager` e segue princípios rigorosos para proteger a soberania dos dados do usuário.

## Princípios Fundamentais

O design do Sistema de Permissões é guiado por quatro pilares essenciais:

1.  **Soberania dos Dados**: O usuário é o único proprietário de seus dados. O LifeOS atua como um guardião, não como um proprietário. Nenhum dado pode ser acessado ou utilizado sem a permissão explícita do usuário.
2.  **Consentimento Explícito**: Antes que qualquer plugin ou aplicativo possa acessar qualquer funcionalidade ou dado do LifeOS, o usuário deve conceder consentimento explícito. Isso geralmente ocorre através de uma interface de usuário clara que detalha as permissões solicitadas.
3.  **Permissões Granulares**: As permissões não são um conceito de "tudo ou nada". Elas são definidas em escopos específicos e detalhados, permitindo que o usuário conceda apenas o acesso mínimo necessário para a funcionalidade desejada. Exemplos de escopos incluem:
    *   `life_graph.read`: Permite ler dados do Life Graph.
    *   `life_graph.write`: Permite modificar dados do Life Graph.
    *   `context.read`: Permite ler o contexto atual do usuário.
    *   `companion.send_notification`: Permite enviar notificações através do Life Companion.
    *   `missions.all`: Permite acesso total (leitura e escrita) às missões do usuário.
4.  **Revogação Instantânea**: O usuário tem o direito de revogar qualquer permissão concedida a qualquer momento. Uma vez revogada, o acesso correspondente é imediatamente interrompido, garantindo que o controle permaneça sempre com o usuário.

## O `PermissionManager`

O `PermissionManager` é a classe central que implementa esses princípios. Suas responsabilidades incluem:

*   **Criação de Sessões**: Quando um plugin é carregado, o `PermissionManager` cria uma `AppSession` e associa as permissões solicitadas a essa sessão. Em um ambiente real, este processo envolveria a interação com o usuário para obter o consentimento.
*   **Verificação de Permissões**: Antes de qualquer operação da `LifeOSApi` ser executada, o `PermissionManager` verifica se a `AppSession` ativa possui a permissão necessária para a ação solicitada.
*   **Gerenciamento de Escopos**: Mantém uma lista de todos os escopos de permissão válidos e disponíveis no sistema.
*   **Revogação de Permissões**: Permite que permissões individuais sejam desativadas para uma sessão específica, ou que todas as permissões de um plugin sejam revogadas quando ele é descarregado.

### Fluxo de Permissões

1.  **Solicitação**: Um plugin declara as permissões que necessita em seu `PluginManifest`.
2.  **Aprovação (Usuário)**: O LifeOS apresenta ao usuário as permissões solicitadas pelo plugin. O usuário revisa e aprova (ou nega) o acesso.
3.  **Concessão (PermissionManager)**: Se aprovado, o `PermissionManager` cria uma `AppSession` com as permissões concedidas e gera um `session_id` e `access_token`.
4.  **Uso (LifeOS API)**: O plugin utiliza o `session_id` para fazer chamadas à `LifeOSApi`. Cada chamada é interceptada pelo `PermissionManager` para verificar se a permissão correspondente foi concedida e ainda está ativa.
5.  **Revogação (Usuário)**: A qualquer momento, o usuário pode ir às configurações do LifeOS e revogar permissões específicas ou desinstalar um plugin, o que aciona a revogação de todas as suas permissões.

## Benefícios para o Usuário e Desenvolvedor

Para o **usuário**, o Sistema de Permissões oferece tranquilidade e controle total sobre seus dados. Ele pode usar plugins com confiança, sabendo que suas informações estão protegidas.

Para o **desenvolvedor**, ele fornece um framework claro e seguro para construir integrações. Ao declarar explicitamente as permissões necessárias, os desenvolvedores podem criar plugins transparentes e confiáveis, que se integram de forma ética ao ecossistema LifeOS.
