# OAuth Manager System

O **OAuth Manager** é o subsistema responsável por gerenciar todo o ciclo de vida da autenticação OAuth 2.0 na Universal Connector Platform do LifeOS. Ele garante que a obtenção, renovação e armazenamento de tokens de acesso sigam as melhores práticas de segurança da indústria, protegendo as contas dos usuários contra acessos não autorizados.

## Fluxo de Autenticação

O LifeOS utiliza o fluxo de **Authorization Code** aprimorado com extensões de segurança modernas. O processo de autenticação é projetado para ser transparente para o usuário, ao mesmo tempo em que mitiga ativamente vetores de ataque comuns.

O fluxo se inicia com a geração da URL de autorização. Quando o usuário solicita a conexão com um serviço externo, o sistema gera uma URL que inclui um parâmetro de estado (`state`) criado criptograficamente. Este parâmetro é essencial para prevenir ataques do tipo CSRF (Cross-Site Request Forgery), garantindo que a resposta de autorização corresponda à solicitação original iniciada pelo usuário.

Para provedores que oferecem suporte, como Google, Microsoft e Dropbox, o sistema implementa a extensão PKCE (Proof Key for Code Exchange). Durante a inicialização, o OAuth Manager gera um par de chaves composto por um `code_verifier` e um `code_challenge`. Esta camada adicional impede que códigos de autorização interceptados durante o redirecionamento sejam trocados por tokens válidos por atores maliciosos.

Após a preparação técnica, o usuário é redirecionado para a tela de login do provedor escolhido, onde analisa e aprova os escopos de acesso solicitados. Uma vez concedido o consentimento, o provedor redireciona o usuário de volta para o LifeOS, enviando um código de autorização temporário. Neste momento, o OAuth Manager valida o parâmetro de estado, recupera a sessão PKCE correspondente e realiza a troca segura do código de autorização pelos tokens definitivos de acesso e renovação.

A tabela abaixo detalha as etapas de segurança aplicadas durante o fluxo:

| Etapa de Segurança | Mecanismo | Proteção Oferecida |
| :--- | :--- | :--- |
| **Validação de Estado** | Geração de token aleatório atrelado à sessão. | Prevenção contra ataques CSRF. |
| **PKCE** | Uso de `code_verifier` e `code_challenge`. | Proteção contra interceptação do código de autorização. |
| **Troca Segura** | Comunicação back-end to back-end com o provedor. | Impede o vazamento de tokens no navegador do cliente. |

## Gerenciamento de Tokens

A gestão do ciclo de vida dos tokens é automatizada e focada em segurança e resiliência. O armazenamento seguro é a primeira premissa: os tokens nunca são salvos em texto puro. O componente `TokenStore` trabalha em conjunto com o `CredentialVault` para aplicar criptografia de ponta a ponta (End-to-End Encryption) no `access_token` e no `refresh_token` antes de qualquer persistência no banco de dados.

A renovação automática garante que as integrações operem sem interrupções. Tokens de acesso geralmente expiram em curtos períodos, frequentemente em uma hora. O OAuth Manager possui lógica proativa para detectar expirações iminentes. Antes de iniciar qualquer operação, o `SyncManager` consulta a validade do token. Caso o token esteja expirado ou com expiração prevista para os próximos cinco minutos, o sistema utiliza o `refresh_token` armazenado para solicitar um novo `access_token` diretamente ao provedor. Todo este processo ocorre em segundo plano, de forma totalmente transparente para o usuário final.

O processo de revogação é igualmente rigoroso. Quando o usuário decide desconectar um serviço, o sistema não se limita a apagar os tokens locais. O OAuth Manager realiza uma chamada HTTP proativa para a URL de revogação oficial do provedor. Esta ação garante que o acesso seja imediatamente invalidado na origem, assegurando que os tokens antigos não possam ser reutilizados, mesmo que tenham sido comprometidos.

## Isolamento por Usuário

A arquitetura do sistema garante o isolamento estrito e absoluto dos tokens. As chaves de indexação utilizadas no `TokenStore` são sempre compostas por uma combinação única do identificador do usuário e do conector. Testes de segurança automatizados e rotinas de validação contínua garantem que, sob nenhuma circunstância, um usuário possa acessar, referenciar ou utilizar os tokens de acesso pertencentes a outro usuário, mantendo a integridade estrutural e a privacidade dos dados na plataforma.
