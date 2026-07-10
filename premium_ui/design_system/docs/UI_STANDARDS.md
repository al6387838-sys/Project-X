# UI Standards & Review Process

**Versão:** 3.0.0
**Sprint:** 029
**Data:** 10 Jul 2026
**Fase:** EXECUTION-007

---

## 1. Introdução

Os Padrões de Interface de Usuário (UI Standards) definem as regras de qualidade visual e o processo de revisão que toda nova interface deve passar antes de ser aprovada e integrada ao LifeOS. O objetivo é eliminar qualquer rastro de amadorismo e garantir que o produto tenha a aparência de um software Enterprise Premium.

## 2. Referências de Qualidade

O Design System do LifeOS foi fortemente influenciado pelos seguintes padrões de mercado, que servem como referências absolutas de qualidade:

- **Linear:** Uso de tipografia limpa, espaçamento generoso e foco em produtividade.
- **Stripe Dashboard:** Clareza na apresentação de dados complexos e tabelas elegantes.
- **Notion:** Flexibilidade de layout e blocos de informação bem definidos.
- **Arc Browser:** Uso sutil de gradientes e efeitos de vidro (glassmorphism).
- **Vercel / Raycast:** Tipografia de alta legibilidade e contrastes suaves.

## 3. Princípios de UX

Toda tela deve obedecer aos seguintes princípios:

### 3.1. Hierarquia Visual
- A informação mais importante deve ter maior peso visual (tamanho de fonte, cor primária).
- Ações secundárias devem recuar visualmente (cores terciárias, botões ghost).

### 3.2. Respiração (Whitespace)
- O uso de margens e paddings é inegociável. Elementos não devem "encostar" nas bordas.
- Utilizar o Spacing System (escala de 4px) para garantir consistência.

### 3.3. Contraste e Leitura
- O texto secundário nunca deve competir com o texto primário.
- Evitar fundos com alto contraste absoluto (ex: preto puro sobre branco puro). Usar as paletas do Design System.

## 4. Processo de Revisão Visual

Nenhuma nova interface poderá ser aprovada sem atender aos padrões definidos abaixo. O processo de revisão é obrigatório para qualquer Pull Request (PR) que contenha alterações visuais.

### 4.1. Checklist de Aprovação

O revisor (ou o próprio designer/desenvolvedor) deve verificar os seguintes itens:

1. **Uso de Tokens:** A interface utiliza *exclusivamente* as variáveis CSS (`var(--name)`) ou os tokens JSON? Cores hexadecimais hardcoded são **proibidas**.
2. **Tipografia:** Os tamanhos e pesos de fonte seguem estritamente o Typography System? (Nenhum `font-size` arbitrário).
3. **Espaçamento:** As margens e paddings seguem a escala de 4px/8px? (Nenhum `padding: 13px`).
4. **Componentes:** Foram usados os componentes da biblioteca oficial (`components.css`)? A criação de componentes duplicados ou fora do padrão é **proibida**.
5. **Estados de Interação:** Botões e inputs possuem estados claros de hover, focus e disabled?
6. **Tema:** A interface funciona corretamente tanto no modo Dark quanto no Light?
7. **Responsividade:** A interface se adapta adequadamente a telas menores (tablet/mobile)?

### 4.2. Fluxo de Aprovação

1. **Desenvolvimento:** O designer/desenvolvedor cria a interface seguindo o Design System.
2. **Auto-Revisão:** O autor verifica o checklist de aprovação.
3. **Pull Request:** O código é submetido com o título `[UI] Nome da Tela`.
4. **Revisão Técnica:** Um revisor verifica se os tokens e componentes estão corretos.
5. **Revisão Visual:** Um designer (ou stakeholder) avalia a estética e a usabilidade.
6. **Aprovação ou Rejeição:**
   - **Aprovado:** O PR é mesclado.
   - **Rejeitado:** O PR recebe comentários detalhados sobre o que não está no padrão e volta para o desenvolvimento.

---
*Documento gerado durante EXECUTION-007. Obrigatório para todas as interfaces do PROJECT-X.*
