# LifeOS Enterprise Premium — Polish Checklist

**Phase:** 007 — Polish Final  
**Date:** 2026-07-13  
**Status:** Ready for Review  

---

## 🎯 Objetivo

Revisão pixel-perfect da interface. Eliminar absolutamente TODA inconsistência. Quando qualquer investidor abrir a plataforma, deve pensar: "Isso parece produto de empresa Série A."

---

## ✅ Checklist de Revisão

### 1. Alinhamento de Pixels

- [ ] Todos os elementos estão alinhados ao grid 4px
- [ ] Sem half-pixels ou valores decimais
- [ ] Borders alinhadas corretamente
- [ ] Padding/margin consistentes
- [ ] Elementos não estão "flutuando"

**Verificar:**
```css
/* Todos os valores devem ser múltiplos de 4 */
padding: 16px;    /* ✅ 4 × 4 */
padding: 15px;    /* ❌ Não é múltiplo de 4 */
```

---

### 2. Cores Inconsistentes

- [ ] Todas as cores usam variáveis CSS
- [ ] Sem hardcoded colors (#FFFFFF, rgb(), etc)
- [ ] Paleta de cores consistente
- [ ] Contraste de cores atende WCAG AA
- [ ] Sem cores "quase iguais"

**Verificar:**
```css
/* ✅ Usar variáveis */
color: var(--text-primary);
background: var(--bg-card);

/* ❌ Evitar hardcoded */
color: #333333;
background: #FFFFFF;
```

---

### 3. Bordas Diferentes

- [ ] Todas as bordas usam `--border-*` variables
- [ ] Espessura consistente (1px)
- [ ] Raio de borda consistente
- [ ] Sem bordas "quase iguais"
- [ ] Borders em hover/focus consistentes

**Verificar:**
```css
/* ✅ Consistente */
border: 1px solid var(--border-default);
border-radius: var(--radius-md);

/* ❌ Inconsistente */
border: 1px solid #CCCCCC;
border-radius: 6px;
```

---

### 4. Fontes Diferentes

- [ ] Apenas 2 famílias de fonte (Inter, JetBrains Mono)
- [ ] Sem fontes do sistema
- [ ] Sem fallbacks diferentes
- [ ] Pesos consistentes (300, 400, 500, 600, 700, 800, 900)
- [ ] Tamanhos usam escala tipográfica

**Verificar:**
```css
/* ✅ Correto */
font-family: var(--font-sans);
font-weight: var(--font-semibold);
font-size: var(--text-lg);

/* ❌ Errado */
font-family: 'Segoe UI', Arial;
font-weight: 600;
font-size: 18px;
```

---

### 5. Ícones Diferentes

- [ ] Todos os ícones usam Lucide ou SVG inline
- [ ] Tamanho consistente (24px, 32px, 48px)
- [ ] Stroke width consistente
- [ ] Sem ícones de múltiplas fontes
- [ ] Sem emoji como ícones (usar apenas em placeholders)

**Verificar:**
```html
<!-- ✅ Lucide -->
<i class="lucide lucide-home"></i>

<!-- ✅ SVG inline -->
<svg viewBox="0 0 24 24">...</svg>

<!-- ❌ Emoji como ícone -->
<span>📊</span>
```

---

### 6. Padding Inconsistente

- [ ] Padding segue grid 4px (4, 8, 12, 16, 20, 24, 28, 32...)
- [ ] Padding horizontal = padding vertical (quando apropriado)
- [ ] Sem valores como 15px, 18px, 22px
- [ ] Padding em cards consistente
- [ ] Padding em buttons consistente

**Verificar:**
```css
/* ✅ Grid 4px */
padding: 16px;      /* 4 × 4 */
padding: 24px 32px; /* 6 × 4, 8 × 4 */

/* ❌ Fora do grid */
padding: 15px;
padding: 18px 22px;
```

---

### 7. Margin Inconsistente

- [ ] Margin segue grid 4px
- [ ] Margin bottom consistente entre elementos
- [ ] Sem margin top em primeiros elementos
- [ ] Sem margin bottom em últimos elementos
- [ ] Margin entre seções consistente

**Verificar:**
```css
/* ✅ Correto */
margin-bottom: 24px;

/* ❌ Errado */
margin: 15px 0 18px 0;
```

---

### 8. Componentes Antigos

- [ ] Sem classes antigas (`.btn-old`, `.card-legacy`)
- [ ] Sem estilos duplicados
- [ ] Sem CSS comentado
- [ ] Sem componentes não utilizados
- [ ] Sem arquivos CSS obsoletos

**Verificar:**
```bash
# Buscar componentes antigos
grep -r "btn-old\|card-legacy\|deprecated" premium_ui/
```

---

### 9. Placeholders

- [ ] Sem placeholder text visível
- [ ] Sem "Lorem ipsum"
- [ ] Sem "TODO", "FIXME", "XXX"
- [ ] Sem valores de teste
- [ ] Sem dados fake visíveis

**Verificar:**
```html
<!-- ❌ Errado -->
<input placeholder="Seu nome aqui..." />
<p>TODO: implementar isso</p>

<!-- ✅ Correto -->
<input placeholder="Nome completo" />
```

---

### 10. Dados Fake

- [ ] Sem dados de teste visíveis
- [ ] Sem IDs fictícios
- [ ] Sem valores dummy
- [ ] Sem "test@test.com"
- [ ] Sem "John Doe"

**Verificar:**
```html
<!-- ❌ Errado -->
<p>Email: test@test.com</p>
<p>Nome: John Doe</p>

<!-- ✅ Correto -->
<p>Email: user@example.com</p>
<p>Nome: João Silva</p>
```

---

### 11. Textos Genéricos

- [ ] Sem "Click here"
- [ ] Sem "Lorem ipsum"
- [ ] Sem "Button"
- [ ] Sem "Text"
- [ ] Todos os textos em português (ou inglês, consistente)

**Verificar:**
```html
<!-- ❌ Errado -->
<button>Click here</button>
<p>Lorem ipsum dolor sit amet</p>

<!-- ✅ Correto -->
<button>Salvar Alterações</button>
<p>Descrição significativa do conteúdo</p>
```

---

### 12. Espaçamento Visual

- [ ] Espaçamento entre elementos consistente
- [ ] Sem "buracos" visuais
- [ ] Sem aglomeração de elementos
- [ ] Whitespace profissional
- [ ] Hierarquia visual clara

**Verificar:**
- Elementos não estão muito próximos
- Elementos não estão muito distantes
- Espaçamento segue grid 4px

---

### 13. Sombras

- [ ] Sombras usam `--shadow-*` variables
- [ ] Sombras consistentes por nível
- [ ] Sem sombras "quase iguais"
- [ ] Sombras em hover mais pronunciadas
- [ ] Sem sombras excessivas

**Verificar:**
```css
/* ✅ Usar variáveis */
box-shadow: var(--shadow-md);

/* ❌ Hardcoded */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
```

---

### 14. Animações

- [ ] Animações suaves (não abruptas)
- [ ] Duração consistente
- [ ] Easing consistente
- [ ] Sem animações excessivas
- [ ] Reduced motion respeitado

**Verificar:**
```css
/* ✅ Consistente */
transition: all var(--duration-normal) var(--ease-out);

/* ❌ Inconsistente */
transition: all 0.3s ease-in;
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

### 15. Responsividade

- [ ] Mobile (375px): sem quebra de layout
- [ ] Tablet (768px): layout adaptado
- [ ] Desktop (1024px+): layout completo
- [ ] Sem scroll horizontal
- [ ] Touch targets mínimo 44px

**Verificar:**
```bash
# Testar em breakpoints
375px, 390px, 768px, 1024px, 1280px, 1440px, 1920px
```

---

### 16. Acessibilidade

- [ ] Contraste de cores WCAG AA
- [ ] Focus states visíveis
- [ ] Keyboard navigation funcional
- [ ] Alt text em imagens
- [ ] Labels em inputs

**Verificar:**
```html
<!-- ✅ Acessível -->
<label for="email">Email</label>
<input id="email" type="email" />

<!-- ❌ Inacessível -->
<input type="email" placeholder="Email" />
```

---

### 17. Performance

- [ ] CSS minificado
- [ ] Sem CSS não utilizado
- [ ] Sem imports duplicados
- [ ] Sem animações pesadas
- [ ] Smooth 60fps

**Verificar:**
```bash
# Verificar tamanho do CSS
wc -l premium_ui/design_system/*.css
```

---

### 18. Consistência de UI

- [ ] Buttons: mesmo estilo, tamanho, spacing
- [ ] Inputs: mesmo estilo, altura, padding
- [ ] Cards: mesmo padding, border, shadow
- [ ] Tables: mesma altura de linha, padding
- [ ] Modals: mesmo padding, border-radius

**Verificar:**
- Todos os botões primários parecem iguais
- Todos os inputs parecem iguais
- Todos os cards parecem iguais

---

### 19. Ícones e Símbolos

- [ ] Ícones alinhados verticalmente
- [ ] Ícones com tamanho consistente
- [ ] Sem ícones faltando
- [ ] Sem ícones duplicados
- [ ] Ícones com stroke width consistente

**Verificar:**
```html
<!-- ✅ Consistente -->
<i class="lucide lucide-home" style="width: 24px; height: 24px;"></i>

<!-- ❌ Inconsistente -->
<i class="lucide lucide-home" style="width: 20px; height: 24px;"></i>
```

---

### 20. Estados de Componentes

- [ ] Hover state consistente
- [ ] Focus state visível
- [ ] Active state claro
- [ ] Disabled state óbvio
- [ ] Loading state elegante

**Verificar:**
```css
/* ✅ Todos os estados definidos */
.enterprise-btn { /* base */ }
.enterprise-btn:hover { /* hover */ }
.enterprise-btn:focus { /* focus */ }
.enterprise-btn:active { /* active */ }
.enterprise-btn:disabled { /* disabled */ }
```

---

## 🔍 Processo de Revisão

### Passo 1: Revisão Automática
```bash
# Buscar hardcoded colors
grep -r "#[0-9A-Fa-f]\{6\}" premium_ui/ --include="*.css"

# Buscar valores fora do grid 4px
grep -r "px" premium_ui/design_system/enterprise_*.css | grep -v "4px\|8px\|12px\|16px\|20px\|24px\|28px\|32px"

# Buscar TODO/FIXME
grep -r "TODO\|FIXME\|XXX" premium_ui/
```

### Passo 2: Revisão Visual
1. Abrir cada página em navegador
2. Verificar cada seção
3. Testar responsividade
4. Testar interações
5. Testar acessibilidade

### Passo 3: Revisão de Código
1. Revisar CSS variables
2. Revisar componentes
3. Revisar animações
4. Revisar layout
5. Revisar tipografia

### Passo 4: QA Final
1. Testar em múltiplos browsers
2. Testar em múltiplos devices
3. Testar acessibilidade
4. Testar performance
5. Testar responsividade

---

## 📋 Itens Críticos

Estes itens **DEVEM** estar 100% corretos antes do deploy:

- ✅ Sem hardcoded colors
- ✅ Sem valores fora do grid 4px
- ✅ Sem componentes antigos
- ✅ Sem placeholders visíveis
- ✅ Sem dados fake
- ✅ Sem textos genéricos
- ✅ Sem TODO/FIXME
- ✅ Responsividade funcional
- ✅ Acessibilidade WCAG AA
- ✅ Performance 60fps

---

## 🚀 Deploy Checklist

Antes de fazer deploy em produção:

- [ ] Todos os itens do checklist revisados
- [ ] Build gerado sem erros
- [ ] Testes em múltiplos browsers
- [ ] Testes em múltiplos devices
- [ ] Performance verificada
- [ ] Acessibilidade verificada
- [ ] Commit feito no Git
- [ ] Versão atualizada
- [ ] Changelog atualizado
- [ ] Documentação atualizada

---

## 📊 Métricas de Qualidade

| Métrica | Target | Status |
|---------|--------|--------|
| CSS Variables | 100% | ⏳ |
| Grid Alignment | 100% | ⏳ |
| Responsive | 100% | ⏳ |
| Accessibility | WCAG AA | ⏳ |
| Performance | 60fps | ⏳ |
| Browser Support | 90%+ | ⏳ |

---

## 🎓 Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS Best Practices](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Web Performance](https://web.dev/performance/)
- [Accessibility](https://www.a11y-101.com/)

---

**Last Updated:** 2026-07-13  
**Next Step:** PHASE 007 — Polish Final Review
