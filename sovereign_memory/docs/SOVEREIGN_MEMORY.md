# Sovereign Memory Evolution

A **Sovereign Memory** (Memória Soberana) é o sistema cognitivo central do Companion do LifeOS (PROJECT-X). Diferente de sistemas tradicionais de IA que armazenam dados de forma opaca em bancos de vetores centralizados, a Sovereign Memory foi desenhada com um princípio inegociável: **o usuário tem controle absoluto sobre tudo que o Companion aprende e lembra**.

## Princípios de Soberania

A arquitetura da Sovereign Memory é regida por quatro pilares fundamentais de soberania de dados e privacidade cognitiva:

1. **Consentimento Explícito:** Nenhuma memória de longo prazo é consolidada ou persistida sem o consentimento (implícito ou explícito) do usuário.
2. **Direito ao Esquecimento:** Qualquer memória pode ser apagada permanentemente a qualquer momento, sem deixar rastros ou resíduos em modelos de IA.
3. **Proteção de Memórias Críticas:** O usuário pode "proteger" memórias específicas, impedindo que o sistema de *aging* (envelhecimento) ou consolidação as modifique ou exclua automaticamente.
4. **Transparência Cognitiva:** O usuário tem acesso visual completo ao *Memory Graph*, podendo ver exatamente o que a IA sabe, como sabe, e por que associou uma informação à outra.

## Arquitetura Cognitiva (Os 6 Tipos de Memória)

Para emular o raciocínio humano de forma eficiente e contextual, o sistema divide a memória em seis categorias especializadas:

### 1. Working Memory (Memória de Trabalho)
Armazena o contexto imediato da conversa atual. É volátil, efêmera e limitada em capacidade (geralmente as últimas 20 interações). É usada para manter a coerência durante uma sessão ativa, mas é descartada ou promovida após o fim da sessão.

### 2. Short-Term Memory (Memória de Curto Prazo)
Informações recentes que sobreviveram à sessão atual, mas ainda não foram consolidadas. Ficam retidas por horas ou dias, aguardando validação ou repetição para provarem sua utilidade.

### 3. Long-Term Memory (Memória de Longo Prazo)
O núcleo do conhecimento do Companion sobre o usuário. Inclui:
- **Preferências:** (ex: "prefere trabalhar de manhã", "usa dark mode")
- **Objetivos:** (ex: "lançar produto em Q3", "aprender IA")
- **Hábitos:** (ex: "exercício 4x por semana")
- **Pessoas e Projetos:** Entidades fundamentais na vida do usuário.

### 4. Context Memory (Memória de Contexto)
Memórias situacionais com *Time-To-Live* (TTL). Por exemplo, se o usuário diz "estou viajando para Londres esta semana", o Companion cria uma Context Memory válida por 7 dias. Após esse período, ela expira automaticamente.

### 5. Semantic Memory (Memória Semântica)
Fatos, conceitos e conhecimentos gerais que o Companion aprendeu com o usuário, separados de experiências específicas. (ex: "LifeOS é um sistema operacional pessoal").

### 6. Episodic Memory (Memória Episódica)
Eventos e experiências específicas localizadas no tempo. (ex: "A reunião de decisão técnica com o Carlos na última terça-feira onde escolhemos usar Python").

## O Ciclo de Vida da Memória

O motor de evolução (`MemoryEvolutionEngine`) gerencia o ciclo de vida contínuo das memórias:

1. **Captura:** A informação entra via `Working Memory`.
2. **Consolidação:** Durante a manutenção (análogo ao sono humano), memórias acessadas frequentemente são promovidas para `Long-Term`.
3. **Associação:** O sistema detecta entidades em comum e cria arestas no `Memory Graph`.
4. **Aging (Envelhecimento):** Memórias não acessadas perdem "força" gradualmente (taxa de decaimento).
5. **Esquecimento/Arquivamento:** Memórias que caem abaixo de um limiar de força são arquivadas (ou apagadas permanentemente, dependendo da configuração).

## Interface de Inspeção (Memory Center)

A interface do *Memory Center* permite que o usuário exerça sua soberania:
- **Memory Graph:** Visualização em rede de como os conceitos se conectam.
- **Memory Timeline:** Linha do tempo cronológica de quando cada memória foi formada.
- **Memory Inspector:** Permite auditar a "força", a "confiança" e a origem de cada memória individualmente, além de oferecer botões para **Proteger** ou **Apagar** a memória.

---
*Documentação gerada automaticamente para a fase EXECUTION-006.*
