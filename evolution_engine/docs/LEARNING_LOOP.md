# Learning Loop

**Project-X | Sprint 011**

O Learning Loop é o componente do Evolution Engine responsável por observar continuamente as interações do usuário e extrair padrões significativos. Ele converte dados brutos de uso em `LearningEvents` estruturados.

## Mecanismos de Aprendizado

O Learning Loop opera em duas frentes:

### 1. Processamento em Tempo Real (Event-Driven)
Analisa interações individuais no momento em que ocorrem.
- **Preferências Explícitas**: Quando o usuário declara algo (ex: "Prefiro reuniões curtas"). Gera um alto delta de confiança (+0.15).
- **Correções (Overrides)**: Quando o usuário ignora uma sugestão do Decision Engine e escolhe outro caminho. Isso gera uma queda temporária na confiança (-0.05), mas ensina ao sistema os verdadeiros pesos de decisão do usuário para aquele contexto.

### 2. Análise Histórica (Batch Processing)
Analisa o histórico acumulado (ex: últimos 7 dias) para encontrar padrões sutis.
- **Rotinas Consistentes**: Detecta ações repetidas no mesmo contexto/horário.
- **Estilos Comportamentais**: Alimenta o Behavior Analyzer para entender mudanças no estilo de trabalho ou aprendizado.

## Estrutura do Learning Event

Quando um padrão é detectado, um `LearningEvent` é gerado. Ele contém:
- **Categoria**: `routine`, `preference`, `habit`, `goal`, `work_style`, `learning_style`, `decision_style`.
- **Descrição**: O padrão bruto detectado.
- **Confidence Delta**: O impacto deste aprendizado na confiança geral do sistema (positivo para confirmações, negativo para correções).
- **Campos de Explicabilidade**: `why_changed`, `what_learned`, `how_improves_experience`.

Estes eventos são armazenados permanentemente na `UserTimeline` e servem como gatilhos para o Adaptation Engine.
