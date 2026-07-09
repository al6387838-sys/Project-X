# Adaptation System

**Project-X | Sprint 011**

O Adaptation Engine é a ponte entre o Evolution Engine e o resto do LifeOS. Sua função é garantir que, quando o sistema aprende algo novo sobre o usuário, esse conhecimento seja imediatamente aplicado para melhorar a experiência.

## Fluxo de Adaptação

Sempre que o Evolution Engine detecta uma "melhoria significativa" (ex: um aumento notável no Confidence Score ou a descoberta de um novo padrão forte), o Adaptation Engine é acionado.

Ele avalia o `LearningEvent` e o `EvolutionSnapshot` atual, e então propaga as mudanças para os sistemas registrados:

### 1. Personal DNA
- **Gatilhos**: Descoberta de preferências, estilo de trabalho ou estilo de aprendizado.
- **Ação**: Atualiza o grafo de identidade central do usuário, alterando as premissas básicas de como o sistema vê o indivíduo.

### 2. Context Engine
- **Gatilhos**: Descoberta de novas rotinas ou hábitos.
- **Ação**: Ajusta os pesos de reconhecimento de contexto. Por exemplo, se o sistema aprende que o usuário corre às 06:00, o Context Engine passará a classificar o horário das 06:00 como "Contexto de Exercício" com alta prioridade.

### 3. Decision Engine
- **Gatilhos**: Mudanças no estilo de decisão ou correções (*overrides*).
- **Ação**: Reajusta os pesos (*weights*) dos algoritmos de recomendação e resolução de conflitos. Se o usuário frequentemente prioriza a família sobre o trabalho em conflitos de agenda, o Decision Engine adapta suas regras de prioridade.

### 4. Action Engine
- **Gatilhos**: Aumentos no Confidence Score.
- **Ação**: Altera os requisitos de aprovação. Com alta confiança, o Action Engine passa a executar tarefas de rotina automaticamente, reduzindo a fricção e aumentando a autonomia.

### 5. Companion (Interface)
- **Gatilhos**: Qualquer adaptação significativa.
- **Ação**: O Companion utiliza os campos de explicabilidade do `LearningEvent` para comunicar ao usuário a mudança de forma natural (ex: *"Percebi que você prefere trabalhar focado pela manhã. A partir de amanhã, vou bloquear automaticamente sua agenda até as 11:00"*).
