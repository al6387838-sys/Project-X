# Universal Connector Engine

A **Universal Connector Engine** é o coração da plataforma de integrações do LifeOS. Ela orquestra a comunicação entre os sistemas internos do LifeOS e os serviços externos (como Google, Microsoft, Apple e Notion), garantindo segurança, resiliência e padronização em todas as chamadas.

## Arquitetura e Componentes Principais

A arquitetura da Connector Engine foi desenhada para suportar alta escalabilidade e implementar nativamente o modelo de segurança Zero Trust. Todos os componentes internos trabalham em conjunto para isolar falhas, proteger dados e garantir que nenhuma ação seja executada sem autorização explícita.

O **Zero Trust Enforcer** é o porteiro de todas as operações da Connector Engine. Nenhuma integração possui acesso implícito aos dados do sistema. O acesso só é concedido mediante consentimento explícito, onde o usuário deve aprovar cada escopo individualmente. Além disso, ocorre uma verificação contínua, pois cada chamada de API valida em tempo real se o consentimento ainda está ativo e se não foi revogado ou expirado.

Para proteger os dados sensíveis, o **Credential Vault** assegura que as credenciais e tokens de acesso nunca sejam armazenados em texto puro. Este componente implementa End-to-End Encryption (E2E) utilizando criptografia forte (AES-256-GCM em ambientes de produção). Isso garante que, mesmo em caso de acesso direto e não autorizado ao banco de dados, as chaves dos usuários permaneçam seguras e ilegíveis.

A resiliência do sistema é garantida pelo **Circuit Breaker**. Para evitar falhas em cascata quando um serviço externo fica instável ou inoperante, a Engine monitora a taxa de erros. O circuito opera em estado *Closed* durante o funcionamento normal. Após uma série de falhas consecutivas, ele muda para *Open*, rejeitando requisições imediatamente para evitar sobrecarga. Após um período de recuperação, ele transita para *Half-Open*, permitindo um número limitado de requisições para testar se o serviço externo voltou à normalidade.

Por fim, o **Rate Limiter** protege a plataforma e as contas dos usuários contra bloqueios por excesso de uso. Ele implementa um algoritmo de Token Bucket isolado por usuário e por conector, garantindo que as cotas de API impostas pelos serviços externos sejam estritamente respeitadas, evitando erros do tipo *HTTP 429 Too Many Requests*.

A tabela a seguir resume as responsabilidades de cada componente arquitetural:

| Componente | Função Principal | Mecanismo de Ação |
| :--- | :--- | :--- |
| **Zero Trust Enforcer** | Controle de Acesso | Exige consentimento explícito e verifica permissões em cada chamada. |
| **Credential Vault** | Segurança de Dados | Criptografa tokens e credenciais utilizando AES-256-GCM. |
| **Circuit Breaker** | Resiliência | Bloqueia chamadas para APIs instáveis, prevenindo falhas em cascata. |
| **Rate Limiter** | Controle de Tráfego | Limita o volume de requisições por usuário usando Token Bucket. |

## Fluxo de Vida de uma Integração

O ciclo de vida de uma integração no LifeOS segue um fluxo padronizado, previsível e seguro. O processo se inicia com a fase de descoberta, onde o sistema consulta o `ConnectorRegistry` para listar os conectores disponíveis. Em seguida, ocorre a autorização, na qual o usuário inicia o fluxo OAuth gerido pelo `OAuthManager`.

Com os tokens obtidos, a integração entra na fase de ativação. A `ConnectorEngine` ativa a integração registrando formalmente o consentimento no `ZeroTrustEnforcer`. A partir desse momento, a sincronização de dados tem início, com o `SyncManager` agendando e executando os trabalhos de sincronização em segundo plano. O ciclo se encerra na revogação, permitindo que o usuário cancele o consentimento a qualquer momento. Esta ação desativa a integração imediatamente e limpa de forma irreversível todos os tokens armazenados no `CredentialVault`.

## Interface Base: `BaseConnector`

Para garantir a padronização, todos os conectores do sistema herdam da classe abstrata `BaseConnector`. Esta interface exige a implementação de métodos essenciais para o funcionamento da plataforma. O método de autenticação inicia o processo de conexão, enquanto os métodos de renovação e revogação gerenciam o ciclo de vida dos tokens. O teste de conexão valida a conectividade básica com a API externa. Por fim, o método de sincronização é responsável por executar a extração e transformação dos dados. Essa padronização arquitetural permite que a Engine orquestre qualquer serviço externo de maneira uniforme, independentemente de ser um provedor de calendário, um wearable de saúde ou uma instituição financeira.
