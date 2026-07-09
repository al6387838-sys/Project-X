# Transparência no LifeOS

**Project-X | Sprint 015**

A transparência é um pilar central do LifeOS, garantindo que o usuário não apenas receba sugestões e ações, mas também compreenda o raciocínio por trás delas. O `Transparency Engine`, parte integrante do Trust Engine, é o componente responsável por desmistificar as operações internas do LifeOS, fornecendo explicações claras, auditáveis e acessíveis para cada decisão tomada pelo sistema.

## Objetivo e Interação com o Usuário

O principal objetivo do `Transparency Engine` é capacitar o usuário a fazer perguntas como:

*   "Por que você fez isso?"
*   "Por que sugeriu isso?"
*   "Por que mudou meu planejamento?"
*   "Quais dados foram utilizados?"

E, em resposta, o sistema deverá fornecer explicações detalhadas e baseadas em dados reais registrados, **nunca gerando explicações falsas ou especulativas**.

## Componentes Chave

O `Transparency Engine` funciona em estreita colaboração com outros componentes do Trust Engine:

| Componente | Função na Transparência |
|---|---|
| **Transparency Engine** | Atua como a interface primária para o usuário, processando suas perguntas e orquestrando a recuperação e formatação das explicações. |
| **Decision History** | Fornece o registro imutável de todas as decisões (`DecisionRecord`s), que são a fonte da verdade para as explicações. |
| **Reasoning Engine** | Traduz os dados técnicos de um `DecisionRecord` em uma explicação em linguagem natural, tornando-a compreensível para o usuário. |

## Como o LifeOS Responde a Perguntas

Quando o usuário faz uma pergunta sobre uma decisão do LifeOS, o `Transparency Engine` segue um processo:

1.  **Identificação da Decisão**: Se o usuário fornecer um `decision_id` específico, o `Transparency Engine` busca esse registro no `Decision History`. Caso contrário, ele tenta inferir a decisão mais relevante ou recente com base no contexto da pergunta e no histórico do usuário.
2.  **Geração da Explicação**: Uma vez que o `DecisionRecord` é identificado, ele é passado para o `Reasoning Engine`. Este motor utiliza os dados registrados (engine responsável, dados utilizados, nível de confiança, alternativas consideradas) para construir uma explicação detalhada e fácil de entender.
3.  **Apresentação ao Usuário**: A explicação gerada, juntamente com informações adicionais como o nível de confiança e sua justificativa, é apresentada ao usuário. O usuário também pode solicitar os dados brutos utilizados na decisão.

## Detalhes da Explicação

Uma explicação gerada pelo `Reasoning Engine` para o usuário incluirá:

*   **Quando a decisão foi tomada**: Data e hora.
*   **Quem tomou a decisão**: O motor do LifeOS responsável.
*   **O que foi decidido**: A ação ou sugestão específica.
*   **Por que foi decidido**: Os dados e o contexto que levaram àquela conclusão.
*   **Quão confiável é**: O nível de confiança do LifeOS na decisão e o que isso significa.
*   **O que mais foi considerado**: As alternativas que foram avaliadas.

### Exemplo de Uso (Resposta a "Por que você fez isso?")

```python
from trust_engine.engines.trust_engine import TrustEngine
from trust_engine.models.trust import ConfidenceLevel

trust_engine = TrustEngine()
user_id = "usuario_curioso"

# Simular uma decisão do LifeOS
record = trust_engine.record_lifeos_decision(
    user_id=user_id,
    engine_responsible="MissionEngine",
    data_used={
        "missao_id": "comprar_casa",
        "prioridade_atual": 95,
        "risco_financeiro": "medio",
        "contexto_mercado": "favoravel"
    },
    explanation="Priorizou a missão 'Comprar Casa' devido à alta prioridade do usuário e condições de mercado favoráveis.",
    alternatives_considered=[
        {"description": "Aguardar 6 meses", "impact": "perda de oportunidade"}
    ],
    metadata={"tags": ["missao_critica"]}
)

# Usuário pergunta: "Por que você priorizou a missão 'Comprar Casa'?"
response = trust_engine.transparency_engine.answer_why_question(
    user_id=user_id,
    query="Por que você priorizou a missão 'Comprar Casa'?",
    decision_id=record.decision_id # Usuário pode referenciar a decisão ou o sistema infere
)

if response["success"]:
    print(f"Resposta do LifeOS:\n{response["explanation"]}")
    print(f"\nNível de Confiança: {response["confidence_explanation"]}")
else:
    print(f"Erro: {response["error"]}")
```

O `Transparency Engine` é a ponte entre a inteligência artificial do LifeOS e a compreensão humana, garantindo que o usuário esteja sempre no controle e plenamente informado sobre as ações do seu copiloto de vida.
