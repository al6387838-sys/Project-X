# Continuous Learning Engine — PROJECT-X

**SPRINT 026**

O **Continuous Learning Engine** é o cérebro do LifeOS. Ele é responsável por observar, analisar e aprender com cada interação do usuário, criando um modelo comportamental em constante evolução, **sem necessidade de treinamento manual**.

---

## 1. Visão Geral da Arquitetura

O sistema é composto por cinco motores especializados que operam em pipeline:

1. **Feedback Engine**: Coleta e classifica sinais (positivos, negativos, implícitos e explícitos).
2. **Behavior Analyzer**: Analisa tendências, horários, domínios e engajamento.
3. **Pattern Detector**: Identifica padrões consistentes (hábitos, rejeições, rotinas).
4. **Preference Engine**: Converte padrões em preferências explícitas e calcula o *Learning Score*.
5. **Version Manager**: Mantém o histórico completo de aprendizado, permitindo rollback e auditoria.

### 1.1 Princípios Fundamentais

* **Aprendizado Contínuo**: Toda interação gera aprendizado.
* **Privacidade e Consentimento**: Nenhum aprendizado altera dados sem consentimento.
* **Segurança Operacional**: Nenhuma decisão crítica é automatizada sem autorização.
* **Rastreabilidade**: Todo aprendizado pode ser explicado, auditado e revertido.

---

## 2. O Ciclo de Aprendizado

Quando um usuário interage com o LifeOS, o evento passa pelo seguinte ciclo:

```text
Interação do Usuário
       │
       ▼
[ Feedback Engine ] ──────► Classifica como Positivo/Negativo/Implícito
       │
       ▼
[ Behavior Analyzer ] ────► Atualiza métricas de comportamento temporal e de domínio
       │
       ▼
[ Pattern Detector ] ─────► Verifica se a ação constitui um padrão (ex: 3x seguidas)
       │
       ▼
[ Preference Engine ] ────► Atualiza a confiança da preferência e gera Insights
       │
       ▼
[ Version Manager ] ──────► Registra no log e cria nova versão (Snapshot)
```

---

## 3. Learning Score

O **Learning Score** é a métrica que define o quanto o LifeOS "conhece" o usuário. Ele é calculado como uma média ponderada das seguintes dimensões:

| Dimensão | Peso | Descrição |
| :--- | :--- | :--- |
| **Preferências** | 20% | Conhecimento geral sobre gostos do usuário |
| **Rotinas** | 15% | Entendimento das sequências de ações diárias |
| **Prioridades** | 15% | Compreensão do que é mais importante |
| **Objetivos** | 15% | Alinhamento com metas de longo prazo |
| **Horários** | 10% | Padrões temporais de atividade |
| **Hábitos** | 10% | Ações repetidas consistentemente |
| **Comunicação** | 10% | Estilo de interação com o sistema |
| **Tom** | 5% | Tom de voz preferido (formal, casual, etc.) |

---

## 4. Integração com o LifeOS

O Learning Engine não atua isolado. Ele fornece o **Contexto Aprendido** para o `Decision Engine` e o `Action Engine`.

Quando o `Decision Engine` precisa priorizar tarefas, ele consulta o `LearningProfile` atual para saber os horários de pico de energia do usuário e suas prioridades inferidas. Se o usuário costuma rejeitar tarefas complexas à noite, o sistema aprenderá esse padrão e parará de sugeri-las nesse horário.
