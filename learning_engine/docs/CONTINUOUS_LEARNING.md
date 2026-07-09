# Continuous Learning no LifeOS — PROJECT-X

**SPRINT 026**

Este documento detalha as políticas, garantias e mecanismos de segurança do **Continuous Learning Engine**.

---

## 1. O Paradigma do Aprendizado Invisível

O objetivo do LifeOS é se adaptar ao usuário sem exigir que ele preencha formulários intermináveis ou configure dezenas de opções. O sistema aprende observando.

* Se o usuário ignora notificações de finanças no fim de semana, o sistema aprende a silenciá-las.
* Se o usuário sempre remarca a academia quando chove, o sistema aprende a sugerir treinos indoor automaticamente.

---

## 2. Tipos de Feedback

O motor processa quatro tipos de sinais:

| Tipo | Peso | Impacto na Confiança | Exemplo |
| :--- | :--- | :--- | :--- |
| **Explícito** | Alto (1.5) | Rápido (+/- 0.15) | Usuário clica em "Não gosto disso" |
| **Positivo** | Médio (1.0) | Moderado (+0.08) | Usuário completa a tarefa sugerida |
| **Negativo** | Médio (1.0) | Moderado (-0.10) | Usuário exclui a sugestão |
| **Implícito** | Baixo (0.4) | Lento (+0.03) | Usuário acessa o app todo dia às 8h |

---

## 3. Garantias de Segurança e Privacidade

O aprendizado autônomo apresenta riscos se não for contido. O LifeOS implementa as seguintes travas de segurança absolutas:

### 3.1 Regra do Consentimento
> **Nenhum aprendizado altera dados sem consentimento.**

O sistema pode aprender que o usuário prefere treinar às 18h em vez das 7h. Ele irá *sugerir* a mudança, mas nunca alterará o horário na agenda automaticamente sem que o usuário aprove.

### 3.2 Regra da Decisão Crítica
> **Nenhuma decisão crítica é automatizada sem autorização.**

Se o sistema aprender que o usuário sempre aprova pagamentos de até R$ 50, ele ainda assim não automatizará o pagamento a menos que o usuário ative explicitamente uma regra de automação no `Action Engine`.

---

## 4. Model Versioning e Rollback

Para garantir que o usuário tenha controle total sobre o que o sistema "pensa" sobre ele, o `VersionManager` implementa um sistema de controle de versão (semelhante ao Git) para o cérebro do LifeOS.

1. A cada 10 interações significativas, um **Snapshot** (ModelVersion) é criado.
2. Todo evento gera um **LearningLog** auditável.
3. O usuário pode solicitar um **Rollback** a qualquer momento.

Se o sistema aprender um padrão errado (ex: usuário passou uma semana doente e o sistema achou que ele abandonou o exercício), o usuário pode simplesmente "Desfazer o aprendizado da última semana". O Rollback reverte os scores de confiança, os padrões e as preferências para o estado exato da versão selecionada.
