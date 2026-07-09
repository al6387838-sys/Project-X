# Preference Model — PROJECT-X

**SPRINT 026**

O modelo de preferências do LifeOS foi desenhado para ser dinâmico, rastreável e reversível. Diferente de sistemas tradicionais onde preferências são booleanos estáticos, no LifeOS uma preferência é um organismo vivo.

---

## 1. Estrutura de uma Preferência

Cada `Preference` possui a seguinte anatomia:

| Atributo | Tipo | Descrição |
| :--- | :--- | :--- |
| `key` | String | Identificador único (ex: `saude_morning_exercise`) |
| `value` | Any | O valor atual aprendido |
| `confidence` | Float | De 0.0 a 1.0 — quão certo o sistema está disso |
| `evidence_count` | Int | Quantas interações suportam esta preferência |
| `is_confirmed` | Bool | Se o usuário confirmou explicitamente |
| `is_locked` | Bool | Se o usuário bloqueou alterações automáticas |

---

## 2. Evolução da Confiança (Confidence Evolution)

A confiança de uma preferência não é fixa. Ela sobe e desce com base no comportamento contínuo do usuário.

1. **Criação**: Uma preferência nasce com confiança baixa (ex: 0.1).
2. **Reforço**: Cada vez que o usuário age em conformidade, a confiança sobe (ex: +0.08).
3. **Contradição**: Se o usuário age contra a preferência, a confiança cai (ex: -0.10).
4. **Confirmação Explícita**: Se o usuário declara a preferência, a confiança salta (+0.25) e `is_confirmed` vira `True`.

### 2.1 Histórico (PreferenceHistory)

Toda alteração de confiança ou valor gera um `PreferenceSnapshot`. Isso permite desenhar gráficos de evolução de preferências e entender exatamente quando o usuário mudou de ideia sobre um hábito.

---

## 3. Geração de Insights

Quando a confiança de uma preferência ultrapassa o limiar de `0.4` (40%), o Preference Engine gera um insight humanizado.

**Exemplo:**
> "O LifeOS aprendeu que você prefere o horário: 06:30 (confiança: 85%)"

Esses insights são apresentados ao usuário periodicamente para garantir transparência e permitir que ele corrija o sistema caso o aprendizado esteja incorreto.

---

## 4. Segurança e Bloqueios

* O usuário pode **bloquear** (`lock_preference`) qualquer preferência. Uma vez bloqueada, o comportamento do usuário não altera mais a confiança ou o valor daquela preferência.
* Preferências nunca sobrescrevem configurações críticas do sistema sem a flag `is_confirmed` estar ativa.
