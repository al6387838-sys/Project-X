# Reasoning Engine

O **Reasoning Engine** é responsável por garantir a **explicabilidade total** do sistema. Ele constrói, valida e enriquece o raciocínio de cada decisão gerada pelo Decision Engine.

## A Regra de Ouro

> A IA nunca poderá responder apenas: "Porque sim." Ela deverá mostrar o raciocínio utilizado.

## Como Funciona

Para cada decisão, o Reasoning Engine constrói uma `ReasoningChain` (Cadeia de Raciocínio), composta por múltiplos `ReasoningStep` (Passos de Raciocínio).

1. **Seleção de Template:** Dependendo do tipo de ação (`action_type` como `goal_pursuit`, `event_response`, etc.), um template de raciocínio é selecionado.
2. **Coleta de Evidências:** O motor busca nos dados de contexto (`ContextInput`) as evidências que suportam cada passo.
3. **Construção dos Passos:** Cada passo é documentado com uma descrição, evidências atreladas e um peso.
4. **Conclusão:** Uma conclusão final é gerada, validando a cadeia.

## Estrutura de um Reasoning Step

Um passo individual possui:
- `step_id`: Identificador sequencial.
- `description`: O que foi analisado ou inferido.
- `evidence`: Lista de dados brutos que suportam a descrição.
- `weight`: Importância deste passo para a decisão final.

## Validação

O Reasoning Engine possui métodos (`validate`, `validate_all`) para auditar as decisões. Uma decisão é considerada inválida (ou gera avisos) se:
- Não possuir raciocínio associado.
- Tiver confiança zero.
- Não definir o contexto afetado.

A explicabilidade gerada pelo método `explain()` formata a decisão de maneira humanamente legível, expondo todo o processo lógico interno.
