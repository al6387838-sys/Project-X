# Confidence Engine

**Project-X | Sprint 011**

O Confidence Engine é o componente responsável por calcular o quão bem o LifeOS acredita conhecer o usuário. Esta métrica — o **Confidence Score** — é o pilar que define o nível de autonomia do sistema.

## Cálculo da Confiança

O Confidence Score (0.0 a 1.0) não é estático. Ele flutua com base nas interações diárias:

1. **Aumentos**: Ocorrem quando o sistema prevê corretamente uma ação, quando o usuário confirma uma sugestão ou quando uma rotina é estabelecida com consistência.
2. **Quedas**: Ocorrem (com peso maior) quando o usuário rejeita uma sugestão, corrige o sistema ou altera drasticamente um padrão estabelecido.
3. **Fator Tempo**: A confiança máxima requer tempo de convivência. Mesmo com 100% de acerto no primeiro dia, o sistema não atinge confiança máxima até que tenha observado o usuário por um período adequado (ex: 30 dias).

## Níveis de Autonomia

Com base no Confidence Score, o Confidence Engine dita o comportamento do Action Engine e do Decision Engine através de quatro níveis de autonomia:

| Nível | Score | Comportamento do Sistema |
|-------|-------|--------------------------|
| **Observation Only** | `< 0.3` | O sistema apenas observa. Sugestões são passivas e tímidas. Nenhuma ação é executada sem comando explícito. |
| **Suggestive** | `0.3 - 0.59` | O sistema sugere ações ativamente e monta planos, mas requer aprovação explícita para **todas** as execuções. |
| **Semi-Autonomous** | `0.6 - 0.84` | O sistema executa ações de baixo risco (ex: categorizar emails, agendar rotinas) automaticamente. Pede aprovação apenas para ações destrutivas ou de alto impacto. |
| **Autonomous** | `>= 0.85` | Confiança total. O sistema toma decisões e executa a maioria das ações sozinho, notificando o usuário apenas após o fato (garantido pela segurança de *rollback* do Action Engine). |

Esta progressão garante que o LifeOS nunca pareça invasivo ou fora de controle, ganhando o direito de agir de forma autônoma apenas após provar que entende o usuário profundamente.
