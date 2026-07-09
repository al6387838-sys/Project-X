# LifeOS Platform SDK

**Project-X | Sprint 014**

O LifeOS Platform SDK (Software Development Kit) é o conjunto de ferramentas e bibliotecas que permite a desenvolvedores externos estenderem as funcionalidades do LifeOS. Ele fornece uma interface segura e controlada para interagir com os motores internos do LifeOS, criar plugins personalizados e integrar o LifeOS com outros sistemas e serviços.

## Arquitetura do SDK

O SDK é construído sobre uma arquitetura modular, garantindo segurança, escalabilidade e facilidade de uso:

1.  **LifeOS SDK Core**: Contém as classes principais para inicialização, gerenciamento de sessões e acesso simplificado à API.
2.  **LifeOS API**: Uma camada de abstração que fornece acesso controlado e baseado em permissões aos motores do LifeOS (Life Graph, Context Engine, Timeline, Memory, Future Engine, Mission Engine, Companion).
3.  **Permission Manager**: Garante que todo acesso aos dados e funcionalidades do LifeOS respeite a soberania dos dados, o consentimento explícito, as permissões granulares e a revogação instantânea.
4.  **Plugin Engine**: Responsável por carregar, descarregar e gerenciar o ciclo de vida dos plugins externos.
5.  **Extension Runtime**: O ambiente seguro onde os plugins são executados, orquestrando sua interação com o LifeOS API.

## Princípios Fundamentais

O desenvolvimento do LifeOS SDK é guiado pelos seguintes princípios:

*   **Soberania dos Dados**: O usuário final sempre mantém o controle total sobre seus dados. Os plugins só podem acessar dados com consentimento explícito.
*   **Consentimento Explícito**: Todas as permissões devem ser explicitamente concedidas pelo usuário antes que um plugin possa acessar qualquer funcionalidade ou dado.
*   **Permissões Granulares**: As permissões são definidas em níveis detalhados (ex: `life_graph.read`, `context.write`, `missions.all`), permitindo que o usuário conceda apenas o acesso necessário.
*   **Revogação Instantânea**: O usuário pode revogar permissões a qualquer momento, e o sistema garante que o acesso seja imediatamente interrompido.
*   **Segurança por Design**: O SDK é projetado com foco em segurança, isolando plugins e protegendo os dados do usuário.

## Como Usar o SDK (Python)

### Instalação

```bash
pip install lifeos-sdk
```

### Exemplo Básico

```python
from lifeos_sdk import LifeOSSDK, PluginManifest

# 1. Inicializar o SDK
sdk = LifeOSSDK(user_id="usuario_exemplo")

# 2. Definir o manifesto do seu plugin
my_plugin_manifest = PluginManifest(
    plugin_id="meu_plugin_id",
    name="Meu Plugin Incrível",
    author="Seu Nome",
    description="Um plugin que faz coisas incríveis com o LifeOS.",
    required_permissions=["life_graph.read", "companion.send_notification"],
    entry_point="/caminho/para/meu_plugin.py" # Caminho para o arquivo principal do seu plugin
)

# 3. Registrar e carregar o plugin
# Em um ambiente real, o usuário precisaria aprovar as permissões aqui
plugin_id = sdk.register_and_load_plugin(my_plugin_manifest)

if plugin_id:
    print(f"Plugin {my_plugin_manifest.name} carregado com sucesso!")
    
    # 4. Obter uma sessão para interagir com a API (geralmente feita internamente pelo runtime)
    # Para demonstração, vamos criar uma sessão manualmente com as permissões necessárias
    session = sdk.request_session(plugin_id, my_plugin_manifest.required_permissions)
    
    if session:
        # 5. Interagir com a LifeOS API através do SDK
        goals_response = sdk.get_life_graph_goals(session.session_id)
        if goals_response.success:
            print(f"Metas do Life Graph: {goals_response.data}")
            sdk.send_companion_notification(session.session_id, "Meu plugin leu suas metas!", "info")
        else:
            print(f"Erro ao ler metas: {goals_response.error}")

        # Exemplo de revogação de permissão
        sdk.revoke_permission(session.session_id, "life_graph.read")
        print("Permissão de leitura do Life Graph revogada.")
        # Tentativa de acesso após revogação falhará
        denied_response = sdk.get_life_graph_goals(session.session_id)
        print(f"Tentativa de acesso após revogação: {denied_response.success} - {denied_response.error}")

    # 6. Descarregar o plugin
    sdk.unload_plugin(plugin_id)
    print(f"Plugin {my_plugin_manifest.name} descarregado.")
else:
    print(f"Falha ao carregar o plugin {my_plugin_manifest.name}.")
```

## Recursos para Desenvolvedores

*   **Developer Portal**: Um portal centralizado para gerenciar plugins, acessar documentação e ferramentas.
*   **API Explorer**: Uma interface interativa para explorar os endpoints da LifeOS API.
*   **Sandbox**: Um ambiente isolado para testar plugins sem afetar os dados reais do usuário.

O LifeOS SDK abre um mundo de possibilidades para a personalização e extensão do LifeOS, permitindo que a comunidade de desenvolvedores crie soluções inovadoras que se integram perfeitamente à vida digital do usuário.
