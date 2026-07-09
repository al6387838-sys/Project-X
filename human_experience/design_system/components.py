from typing import List, Dict, Any, Optional

class UIComponent:
    def __init__(self, id: str, type: str, props: Dict[str, Any]):
        self.id = id
        self.type = type
        self.props = props

    def render(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "props": self.props
        }

class Button(UIComponent):
    def __init__(self, id: str, label: str, variant: str = "primary", size: str = "md", disabled: bool = False):
        super().__init__(id, "button", {
            "label": label,
            "variant": variant,
            "size": size,
            "disabled": disabled
        })

class Card(UIComponent):
    def __init__(self, id: str, title: str, content: Any, footer: Optional[Any] = None):
        super().__init__(id, "card", {
            "title": title,
            "content": content,
            "footer": footer
        })

class Typography(UIComponent):
    def __init__(self, id: str, text: str, variant: str = "body", color: str = "primary"):
        super().__init__(id, "typography", {
            "text": text,
            "variant": variant,
            "color": color
        })

class Dashboard(UIComponent):
    def __init__(self, id: str, widgets: List[Any]):
        super().__init__(id, "dashboard", {
            "widgets": [w.render() if hasattr(w, 'render') else w for w in widgets]
        })

class OnboardingStep(UIComponent):
    def __init__(self, id: str, title: str, description: str, image_url: Optional[str] = None):
        super().__init__(id, "onboarding_step", {
            "title": title,
            "description": description,
            "image_url": image_url
        })
