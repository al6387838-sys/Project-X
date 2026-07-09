# Design System do LifeOS

**Project-X | Sprint 015**

O Design System do LifeOS é um conjunto abrangente de princípios, diretrizes, componentes e ferramentas que garantem consistência, eficiência e escalabilidade no desenvolvimento da interface de usuário. Ele serve como a fonte única da verdade para a linguagem visual e interativa do LifeOS, permitindo que a equipe de desenvolvimento e design trabalhe de forma coesa e entregue uma experiência de usuário de alta qualidade.

## Componentes Principais

O Design System é estruturado em torno dos seguintes elementos:

1.  **Design Tokens**: As menores unidades de decisão de design, como cores, tipografia, espaçamento, raios de borda, sombras e durações de animação. Eles são definidos em um formato agnóstico de plataforma (`tokens.json`) e podem ser transformados para uso em diferentes ambientes (web, mobile).
2.  **Componentes UI**: Blocos de construção reutilizáveis da interface de usuário (ex: Botões, Cards, Tipografia, Dashboards). Cada componente é projetado para ser flexível, acessível e aderente aos Design Tokens.
3.  **Diretrizes de Uso**: Documentação detalhada sobre como e quando usar cada componente e token, incluindo exemplos de código, variações e melhores práticas.

## Design Tokens (`tokens.json`)

Os Design Tokens são a base do nosso sistema. Eles permitem que as propriedades de design sejam gerenciadas de forma centralizada e aplicadas consistentemente em toda a plataforma. O arquivo `tokens.json` define:

| Categoria | Exemplo de Token | Descrição |
|---|---|---|
| **Cores** | `primary.base`, `text.primary`, `status.error` | Paleta de cores para elementos interativos, texto, fundos e estados de feedback. |
| **Tipografia** | `fontFamily`, `sizes.base`, `weights.semibold` | Fontes, tamanhos e pesos para garantir hierarquia visual e legibilidade. |
| **Espaçamento** | `sm`, `md`, `lg` | Valores padronizados para margens, preenchimentos e lacunas entre elementos. |
| **Raios de Borda** | `sm`, `md`, `full` | Valores para arredondamento de cantos de componentes. |
| **Sombras** | `sm`, `md`, `lg` | Estilos de sombra para profundidade e hierarquia visual. |
| **Animações** | `duration.normal`, `easing.easeInOut` | Propriedades para transições e microinterações, garantindo fluidez e responsividade.

## Componentes UI (`components.py`)

Os componentes UI são implementações concretas dos Design Tokens e diretrizes. Eles são projetados para serem modulares e reutilizáveis. Exemplos de componentes incluem:

*   `Button`: Para ações interativas, com variantes de estilo (primary, secondary, ghost) e tamanhos.
*   `Card`: Para agrupar conteúdo relacionado, com títulos, conteúdo principal e rodapés opcionais.
*   `Typography`: Para exibir texto com diferentes estilos (títulos, corpo, legendas) e cores.
*   `Dashboard`: Um componente de layout para organizar e exibir múltiplos widgets.
*   `OnboardingStep`: Componente específico para o fluxo de primeiro acesso, contendo título, descrição e imagem.

### Exemplo de Componente (Python - Representação Abstrata)

```python
from typing import List, Dict, Any

class Button:
    def __init__(self, id: str, label: str, variant: str = "primary", size: str = "md"):
        self.id = id
        self.type = "button"
        self.props = {
            "label": label,
            "variant": variant,
            "size": size
        }

    def render(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "props": self.props
        }
```

## Benefícios do Design System

*   **Consistência**: Garante uma experiência de usuário unificada em todas as partes do LifeOS.
*   **Eficiência**: Acelera o processo de desenvolvimento, pois os designers e desenvolvedores podem reutilizar componentes e tokens existentes.
*   **Qualidade**: Reduz erros e garante que os padrões de acessibilidade e usabilidade sejam seguidos.
*   **Escalabilidade**: Facilita a expansão da plataforma, permitindo que novas funcionalidades sejam adicionadas sem comprometer a integridade do design.
*   **Colaboração**: Promove uma linguagem comum entre equipes de design, desenvolvimento e produto.
