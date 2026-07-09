# Rollback System

O **Rollback System**, implementado pelo `RollbackManager`, é um componente vital do Action Engine que garante a resiliência e a capacidade de recuperação do sistema. Ele permite reverter ações que foram executadas, seja por falha na execução, por uma mudança de contexto que as tornou indesejáveis, ou por decisão humana.

## Importância do Rollback

Em um sistema autônomo que interage com o mundo real, a capacidade de desfazer ações é tão importante quanto a capacidade de executá-las. Erros podem ocorrer, o contexto pode mudar inesperadamente, ou o usuário pode simplesmente mudar de ideia. O Rollback System oferece uma rede de segurança, minimizando o impacto de ações indesejadas ou incorretas.

## Como Funciona

1.  **Estratégia de Rollback por Ação:** Cada objeto `Action` possui um atributo `rollback_strategy` que define como a ação deve ser revertida:
    *   **`none`:** A ação não pode ser revertida (ex: envio de e-mail sem opção de 
desfazer).
    *   **`automatic`:** O sistema possui um procedimento automatizado para reverter a ação (ex: deletar um arquivo criado, cancelar um agendamento).
    *   **`manual`:** A reversão requer intervenção humana ou um procedimento externo (ex: ligar para um serviço de suporte).

2.  **Registro de Rollback:** O `RollbackManager` mantém um `rollback_log` de todas as tentativas de reversão, incluindo o status (sucesso/falha) e quaisquer erros.

3.  **Execução da Reversão (`perform_rollback`):** Quando uma ação precisa ser revertida, o `RollbackManager` verifica sua `rollback_strategy` e tenta executar o procedimento correspondente. Em um ambiente real, isso envolveria a chamada de APIs ou funções específicas dos conectores que executaram a ação original.

## Cenários de Uso

-   **Falha na Execução:** Se uma ação falhar durante a execução, o sistema pode tentar um rollback automático para restaurar o estado anterior.
-   **Decisão do Usuário:** O usuário pode solicitar a reversão de uma ação concluída, caso ela não tenha produzido o resultado desejado ou se o contexto mudou.
-   **Conflito Resolvido:** Em casos de conflito, uma decisão pode ser revertida para dar precedência a outra.

O Rollback System é essencial para a resiliência do PROJECT-X, permitindo que o sistema se recupere de erros e se adapte a novas condições de forma segura e controlada.
