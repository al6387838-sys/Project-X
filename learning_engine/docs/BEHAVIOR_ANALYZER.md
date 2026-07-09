# Behavior Analyzer — PROJECT-X

**SPRINT 026**

O **Behavior Analyzer** é o componente do Learning Engine responsável por transformar eventos brutos em insights comportamentais. Ele atua como a camada analítica que alimenta o `Pattern Detector`.

---

## 1. Capacidades Analíticas

O Behavior Analyzer processa o histórico de `LearningEvents` para extrair métricas em quatro dimensões principais:

### 1.1 Análise Temporal
Identifica os ritmos biológicos e de produtividade do usuário:
* **Horários de Pico**: Quando o usuário é mais ativo.
* **Dias Ativos**: Distribuição de energia ao longo da semana.
* **Preferências de Agendamento**: Em qual período do dia o usuário prefere realizar tarefas de Saúde vs. Finanças.

### 1.2 Análise de Domínio
Avalia o engajamento do usuário com diferentes áreas da vida:
* **Taxa de Aceitação/Rejeição**: Quais áreas o usuário mais ignora sugestões.
* **Score de Engajamento**: Métrica composta de interações positivas e explícitas.

### 1.3 Análise de Estilo de Comunicação
Infere como o usuário prefere interagir com o LifeOS:
* Analisa respostas diretas, verbosas, formais ou casuais.
* Ajusta o tom das respostas do sistema com base nessa inferência.

### 1.4 Análise de Prioridades
Observa as escolhas reais do usuário em detrimento do que ele declara:
* Se o usuário diz que Saúde é prioridade 1, mas sempre cancela o treino para trabalhar, o sistema ajusta a prioridade comportamental inferida.

---

## 2. Estruturas de Dados

A saída do Behavior Analyzer é um relatório consolidado que alimenta os motores subsequentes:

```json
{
  "metrics": {
    "positive_ratio": 0.75,
    "negative_ratio": 0.15,
    "implicit_events": 42
  },
  "temporal": {
    "peak_hours": [9, 10, 14],
    "most_active_day": "ter"
  },
  "communication_style": {
    "inferred_tone": "direto",
    "confidence": 0.85
  }
}
```

---

## 3. Integração com Pattern Detector

O Behavior Analyzer não toma decisões nem crava padrões. Ele fornece as estatísticas. O `Pattern Detector` consome essas estatísticas e, se os limiares de confiança forem atingidos (ex: 3 dias seguidos acordando às 6h), ele formaliza um `Pattern` no sistema.
