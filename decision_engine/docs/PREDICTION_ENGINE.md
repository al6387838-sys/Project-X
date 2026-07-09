# Prediction Engine

O **Prediction Engine** atua como a camada prospectiva do Decision Engine. Ele analisa o estado atual e o histórico para gerar estimativas sobre estados futuros do sistema ou do usuário.

## Objeto `Prediction`

Uma predição encapsula uma visão do futuro:

- `target`: O que está sendo previsto (ex: `user_stress_level`, `project_completion`).
- `predicted_value`: O valor estimado.
- `confidence`: Nível de certeza da predição.
- `horizon`: Horizonte temporal (`short_term`, `medium_term`, `long_term`).
- `reasoning`: A lógica utilizada para chegar à predição.
- `risk_factors`: Variáveis que podem invalidar a predição.

## Mecanismos de Predição

O motor utiliza três fontes principais para gerar predições:

1. **Análise de Tendência Histórica:** Calcula tendências lineares baseadas nos dados fornecidos pelo Memory Engine (`historical_values`).
2. **Sinais de Contexto:** Avalia volatilidade e qualidade dos dados vindos do Context Engine. Sinais de alta volatilidade reduzem automaticamente a confiança da predição.
3. **Padrões de Memória:** Identifica padrões recorrentes e aplica sua força para ajustar a confiança da estimativa.

## Avaliação de Risco

O método `assess_risk` analisa um lote de predições e determina o nível geral de risco (`low`, `medium`, `high`) com base na média de confiança e na quantidade de fatores de risco detectados. Isso permite que o sistema aja de forma conservadora quando a incerteza é alta.
