# Evolution Engine

**Project-X | Sprint 011**

O Evolution Engine é o coração do sistema de aprendizado contínuo do LifeOS. Sua principal responsabilidade é garantir que o sistema melhore e se adapte continuamente à medida que conhece o usuário, analisando padrões, comportamentos e preferências ao longo do tempo.

## Visão Geral da Arquitetura

O Evolution Engine atua como o orquestrador central do processo evolutivo. Ele é composto por quatro motores secundários:

1. **Learning Loop**: Processa interações diárias para extrair padrões e aprendizados (rotinas, preferências, hábitos).
2. **Behavior Analyzer**: Analisa o histórico de interações para deduzir o estilo de trabalho, aprendizado e tomada de decisão do usuário.
3. **Confidence Engine**: Calcula e gerencia o *Confidence Score*, que determina o nível de autonomia que o sistema pode assumir.
4. **Adaptation Engine**: Propaga os aprendizados para os outros módulos do LifeOS (Personal DNA, Context Engine, Decision Engine, Action Engine e Companion).

## Timeline de Evolução e Snapshots

Um princípio fundamental do Evolution Engine é que **versões anteriores nunca são apagadas**. O sistema mantém uma `UserTimeline` que registra toda a história evolutiva através de `EvolutionSnapshots`.

Cada *Snapshot* representa o estado do sistema em um determinado momento e contém:
- **Confidence Score**: (0.0 a 1.0) O quão bem o sistema acredita conhecer o usuário.
- **Evolution Score**: (0.0 a 100.0) Pontuação absoluta que cresce à medida que o sistema se adapta e acerta predições.
- **Adaptation Score**: (0.0 a 100.0) O nível de personalização do sistema.
- **Learning Velocity**: A taxa atual de aprendizado.
- **Padrões Identificados**: Rotinas, preferências e hábitos aprendidos até o momento.
- **Estilos de Comportamento**: Estilo de trabalho, aprendizado e decisão.

## Mecanismo de Explicabilidade

Para garantir transparência, toda mudança significativa gera um `LearningEvent` que inclui uma explicação clara:
- **Por que o sistema mudou** (`why_changed`)
- **O que foi aprendido** (`what_learned`)
- **Como isso melhora a experiência** (`how_improves_experience`)

Essas explicações são usadas pelo Companion para notificar o usuário sobre as adaptações feitas em seu benefício.

## Exemplo de Evolução (Simulação de 6 Meses)

| Período | Confidence Score | Evolution Score | Autonomia | Aprendizados Principais |
|---------|------------------|-----------------|-----------|-------------------------|
| **Mês 1** | 0.20 | 10.0 | *Observation Only* | Identifica rotinas básicas (horário de acordar, preferências de leitura). |
| **Mês 3** | 0.55 | 45.0 | *Suggestive* | Entende o estilo de trabalho (*Deep Worker*). Sistema sugere bloqueios na agenda, mas pede aprovação. |
| **Mês 6** | 0.85 | 85.0 | *Autonomous* | Sistema gerencia a agenda automaticamente, resolve conflitos menores e notifica apenas sobre exceções. |
