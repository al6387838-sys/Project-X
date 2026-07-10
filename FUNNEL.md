# Funil de Crescimento LifeOS

O funil de crescimento da LifeOS foi desenhado para maximizar a conversão em cada etapa da jornada do usuário. Este documento detalha as definições, gatilhos e métricas de cada estágio da jornada, estruturando o caminho desde o primeiro contato até a expansão máxima da conta.

## Estágios e Progressão

A jornada do usuário é dividida em sete estágios rigorosamente definidos. A progressão no funil é gerenciada de forma automatizada pelo motor de crescimento. Quando um evento chave ocorre, o sistema avalia as condições, avança o estágio atual do usuário e cria um registro de conversão que captura o tempo exato levado entre os estágios para análise de gargalos.

| Estágio | Definição | Gatilho de Entrada | Métricas Chave |
| :--- | :--- | :--- | :--- |
| **Visitante** | Usuário que acessou a plataforma, mas não se cadastrou. | `PAGE_VIEW` com novo ID de sessão. | Visitantes únicos, Custo por Visitante. |
| **Cadastro** | Usuário que criou uma conta e iniciou o onboarding. | `SIGNUP_COMPLETED` | Visitor-to-Signup Rate. |
| **Usuário Ativado** | Usuário que experimentou o valor central do produto. | `ONBOARDING_COMPLETED` ou alcance do Aha Moment. | Signup-to-Activation Rate, Time to Aha. |
| **Usuário Ativo** | Usuário que demonstra engajamento consistente na plataforma. | `SESSION_STARTED` ultrapassando o limite de 3 sessões. | DAU/MAU, Activation-to-Retention Rate. |
| **Assinante Pro** | Usuário pagante do tier inicial de assinatura. | `SUBSCRIPTION_CREATED` com plano Pro. | Retention-to-Subscription Rate, MRR Pro. |
| **Assinante Ultra** | Usuário pagante do tier avançado de assinatura. | `SUBSCRIPTION_CREATED` com plano Ultra. | Upgrade Rate, Expansion MRR. |
| **Enterprise** | Conta corporativa ou implantação para equipes. | `SUBSCRIPTION_CREATED` com plano Enterprise. | B2B Conversion Rate. |

## O Aha Moment

O momento de ativação é o ponto crítico do funil. A LifeOS define o *Aha Moment* universal como a criação da primeira meta combinada com o registro de três check-ins consecutivos nos primeiros sete dias. No entanto, o motor de ativação adapta essa definição com base no perfil detectado durante o onboarding. Por exemplo, para um estudante, o momento mágico ocorre ao criar o primeiro plano de estudos e completar a primeira sessão de foco. Pesquisas internas demonstram que usuários que atingem este marco têm uma probabilidade significativamente maior de retenção a longo prazo.
