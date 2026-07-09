# Plugin Engine

**Project-X | Sprint 014**

O Plugin Engine é o componente central do LifeOS Platform SDK responsável por gerenciar o ciclo de vida dos plugins externos. Ele permite que o LifeOS carregue, execute e descarregue funcionalidades adicionais de forma segura e controlada, estendendo suas capacidades sem modificar o código-fonte principal.

## Funcionalidades Principais

O Plugin Engine oferece as seguintes capacidades:

*   **Carregamento Dinâmico**: Carrega plugins em tempo de execução, permitindo que novas funcionalidades sejam adicionadas sem reiniciar o LifeOS.
*   **Gerenciamento de Manifestos**: Utiliza `PluginManifest` para obter metadados essenciais sobre cada plugin, como ID, nome, autor, descrição, permissões necessárias e ponto de entrada.
*   **Isolamento de Plugins**: Embora a implementação atual seja simplificada para demonstração, em um ambiente de produção, o Plugin Engine garantiria o isolamento de cada plugin em seu próprio ambiente de execução (sandboxing) para evitar conflitos e garantir a segurança.
*   **Ciclo de Vida do Plugin**: Gerencia o carregamento (`load_plugin`), descarregamento (`unload_plugin`) e a execução de ações específicas (`execute_plugin_action`) de cada plugin.
*   **Injeção de Dependência**: Injeta a `LifeOSApi` nos plugins no momento do carregamento, permitindo que eles interajam com os motores do LifeOS de forma controlada.

## O Manifesto do Plugin (`PluginManifest`)

Cada plugin deve fornecer um `PluginManifest` que descreve suas características e requisitos. Este manifesto é crucial para o Plugin Engine entender como carregar e interagir com o plugin.

| Atributo | Descrição |
|---|---|
| `plugin_id` | Identificador único do plugin. |
| `name` | Nome amigável do plugin. |
| `version` | Versão do plugin. |
| `author` | Desenvolvedor ou organização responsável. |
| `description` | Breve descrição da funcionalidade do plugin. |
| `required_permissions` | Lista de escopos de permissão que o plugin necessita (ex: `life_graph.read`). |
| `category` | Categoria do plugin (ex: `finance`, `health`, `education`). |
| `entry_point` | Caminho para o arquivo Python que contém a classe principal do plugin. |

## Como um Plugin Interage com o LifeOS

Quando um plugin é carregado pelo Plugin Engine, uma instância da `LifeOSApi` é passada para ele. Esta API é o único meio pelo qual o plugin pode acessar os dados e funcionalidades do LifeOS. Isso garante que todas as interações sejam mediadas pelo `PermissionManager`, respeitando as permissões concedidas pelo usuário.

### Exemplo de Estrutura de Plugin (Python)

```python
from typing import Any, Dict

class MeuPlugin:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None # Definido pelo Extension Runtime

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def minha_acao_personalizada(self, user_id: str) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de uso da LifeOS API
        response = self.lifeos_api.get_life_graph_goals(self.session_id, user_id)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, "Plugin executou ação!", "info")
            return {"status": "ok", "data": response.data}
        else:
            return {"status": "error", "message": response.error}
```

## Benefícios

O Plugin Engine é fundamental para a extensibilidade do LifeOS, proporcionando:

*   **Flexibilidade**: Permite que o LifeOS se adapte a uma vasta gama de necessidades do usuário através de funcionalidades personalizadas.
*   **Inovação**: Abre o LifeOS para a criatividade da comunidade de desenvolvedores.
*   **Modularidade**: Mantém o core do LifeOS enxuto e estável, enquanto as funcionalidades adicionais são gerenciadas como módulos separados.
*   **Segurança**: Garante que os plugins operem dentro de limites definidos, protegendo a integridade do sistema e a privacidade dos dados do usuário.
