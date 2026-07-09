# Connector Marketplace

O **Connector Marketplace** é a vitrine oficial e o gerenciador de instalações das integrações do LifeOS. Desenvolvido para ser o ponto central de descoberta, ele permite que os usuários explorem, avaliem e habilitem conectores de forma intuitiva, conectando suas ferramentas diárias à plataforma com segurança e transparência.

## Arquitetura e Componentes

O Marketplace opera diretamente sobre o `ConnectorRegistry`, que atua como a fonte de verdade absoluta para todos os conectores suportados no sistema. Esta arquitetura garante que apenas integrações validadas e registradas pela equipe de engenharia estejam disponíveis para os usuários finais.

A funcionalidade de descoberta e organização do catálogo é um dos pilares do sistema. O Marketplace fornece métodos avançados para buscar conectores por nome, categoria ou tags específicas. O catálogo é organizado de maneira lógica para facilitar a navegação. A seção de destaque exibe as integrações mais populares ou recomendadas. A navegação por categorias permite explorar ferramentas segmentadas por áreas como calendário, armazenamento, comunicação ou saúde. Além disso, o sistema suporta o conceito de *Bundles*, que são agrupamentos lógicos de conectores. Por exemplo, a instalação do pacote do Google Workspace habilita simultaneamente os conectores do Calendar, Drive, Gmail, Tasks e Meet, otimizando o tempo de configuração do usuário.

Para auxiliar na tomada de decisão, cada entrada no Marketplace é representada por um objeto `MarketplaceEntry`. Este objeto encapsula o manifesto técnico do conector e o enriquece com metadados orientados à comunidade e à qualidade. Os usuários podem visualizar a contagem total de instalações e consultar o sistema de avaliações, que exibe notas de um a cinco e comentários detalhados. O sistema também exibe selos de qualidade cruciais, indicando se a integração é verificada, oficial da plataforma parceira ou se ainda encontra-se em fase beta. Capturas de tela e registros de alterações (changelogs) complementam a página de detalhes de cada conector.

A tabela a seguir ilustra a estrutura de organização do catálogo:

| Seção do Catálogo | Descrição | Exemplo de Uso |
| :--- | :--- | :--- |
| **Featured** | Conectores promovidos e altamente avaliados. | Destacar integrações recém-lançadas ou populares. |
| **Categorias** | Agrupamento por setor de atuação. | Filtrar apenas ferramentas de produtividade ou saúde. |
| **Bundles** | Instalação em lote de ecossistemas completos. | Ativar toda a suíte da Microsoft ou do Google de uma vez. |

## Fluxo de Instalação

A instalação de um conector no LifeOS não envolve o download de código executável no dispositivo do usuário, mas sim um processo lógico e seguro que prepara a infraestrutura em nuvem para orquestrar a comunicação de dados.

O processo começa com a seleção, onde o usuário escolhe a ferramenta desejada no catálogo. Em seguida, ocorre a instalação lógica, momento em que o Marketplace registra a intenção do usuário e adiciona o aplicativo ao seu painel de controle. A etapa crítica é a autorização, onde o fluxo é repassado ao `OAuthManager` e ao `PermissionManager`. Nesta fase, o usuário é redirecionado para conceder os tokens de acesso e o consentimento explícito, seguindo os princípios do Zero Trust. Uma vez autorizado, a `ConnectorEngine` ativa formalmente a integração, e o `SyncManager` entra em ação, agendando imediatamente o primeiro trabalho de sincronização total para popular os dados no LifeOS.

## Integration Dashboard e Monitoramento

O Marketplace atua como a base de dados que alimenta o **Integration Dashboard**, a interface de controle central onde o usuário gerencia o ciclo de vida de suas integrações ativas.

Através de uma integração profunda com o `IntegrationMonitor`, o dashboard oferece total transparência sobre as operações de dados. O usuário pode visualizar o status de saúde em tempo real de cada conexão, identificando rapidamente se o link está operando normalmente, se apresenta lentidão ou se requer reautenticação. O painel também exibe estatísticas detalhadas de sincronização, informando o momento exato da última atualização e o volume de registros processados. Por fim, o dashboard oferece controle granular de permissões, permitindo que o usuário revogue acessos específicos — como remover a permissão de escrita de um calendário, mantendo apenas a leitura — ou opte por desinstalar o conector e apagar todos os dados associados com um único clique.
