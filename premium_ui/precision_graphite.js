/* LifeOS Enterprise — Precision Graphite icon and polish adapter.
   Presentation-only: no business logic, persistence, auth or routing changes. */
(() => {
  'use strict';

  const SCRIPT_SELECTOR = 'script[data-pg-lucide]';
  const LUCIDE_SRC = '/vendor/lucide.min.js';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'CODE', 'PRE']);
  const ICON_PATTERN = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)*|[\u{231A}\u{23F1}\u{23F0}\u{231B}\u{25B6}\u{23F8}\u{23F9}\u{23ED}\u{23EE}\u{2139}\u{2328}\u{25C8}\u{25C7}\u{25CE}\u{25EC}\u{25A0}\u{25CF}\u{D7}]|[\u{2190}\u{2192}\u{2191}\u{2193}\u{2713}\u{2714}\u{2715}\u{2716}\u{2717}\u{2718}\u{26A0}]/gu;

  const ICONS = new Map([
    ['\u{26A1}', 'zap'], ['\u{1F512}', 'lock-keyhole'], ['\u{1F510}', 'shield-check'], ['\u{1F6E1}', 'shield-check'],
    ['\u{1F441}', 'eye'], ['\u{1F440}', 'eye'], ['\u{1F3AF}', 'target'], ['\u{1F504}', 'refresh-cw'], ['\u{1F501}', 'repeat-2'],
    ['\u{1F4C5}', 'calendar-days'], ['\u{1F5D3}', 'calendar-range'], ['\u{1F9E0}', 'brain'], ['\u{1F4CA}', 'chart-no-axes-combined'],
    ['\u{1F4C8}', 'trending-up'], ['\u{1F4C9}', 'trending-down'], ['\u{1F680}', 'rocket'], ['\u{1F916}', 'bot'],
    ['\u{1F310}', 'globe-2'], ['\u{1F30D}', 'globe-2'], ['\u{1F517}', 'link-2'], ['\u{1F4E7}', 'mail'], ['\u{2709}', 'mail'],
    ['\u{1F4BC}', 'briefcase-business'], ['\u{2705}', 'circle-check'], ['\u{2611}', 'square-check-big'], ['\u{2713}', 'check'], ['\u{2714}', 'check'],
    ['\u{274C}', 'circle-x'], ['\u{2715}', 'x'], ['\u{2716}', 'x'], ['\u{2717}', 'x'], ['\u{2718}', 'x'],
    ['\u{1F4AC}', 'message-square-text'], ['\u{1F4AD}', 'message-circle-more'], ['\u{1F537}', 'diamond'], ['\u{1F34E}', 'heart-pulse'],
    ['\u{231A}', 'watch'], ['\u{1F4B0}', 'wallet-cards'], ['\u{1F4B3}', 'credit-card'], ['\u{1F419}', 'github'], ['\u{1F4C1}', 'folder'],
    ['\u{1F4C2}', 'folder-open'], ['\u{1F4C4}', 'file-text'], ['\u{1F4D6}', 'book-open'], ['\u{1F4DD}', 'notebook-pen'], ['\u{270F}', 'pencil'],
    ['\u{1F5D1}', 'trash-2'], ['\u{1F511}', 'key-round'], ['\u{1F4F1}', 'smartphone'], ['\u{1F4CB}', 'clipboard-list'],
    ['\u{1F4E4}', 'upload'], ['\u{1F4E5}', 'download'], ['\u{1F6AA}', 'log-out'], ['\u{1F514}', 'bell'], ['\u{1F515}', 'bell-off'],
    ['\u{1F50D}', 'search'], ['\u{1F50E}', 'search'], ['\u{2699}', 'settings'], ['\u{1F6E0}', 'wrench'], ['\u{1F9E9}', 'blocks'],
    ['\u{1F3E2}', 'building-2'], ['\u{1F3EC}', 'building'], ['\u{1F464}', 'user-round'], ['\u{1F465}', 'users-round'], ['\u{1F9D1}', 'user-round'],
    ['\u{1F44B}', 'hand'], ['\u{1F4A1}', 'lightbulb'], ['\u{1F525}', 'flame'], ['⭐', 'star'], ['\u{2605}', 'star'],
    ['\u{2764}\u{FE0F}', 'heart'], ['\u{2665}', 'heart'], ['\u{1F49C}', 'heart'], ['\u{1F3C6}', 'trophy'], ['\u{1F393}', 'graduation-cap'],
    ['\u{1F3A8}', 'palette'], ['\u{2728}', 'sparkles'], ['\u{1F48E}', 'gem'], ['\u{1F4E6}', 'package'], ['\u{1F6D2}', 'shopping-cart'],
    ['\u{1F9FE}', 'receipt-text'], ['\u{1F4B5}', 'banknote'], ['\u{1F3E6}', 'landmark'], ['\u{1F4E1}', 'radio-tower'], ['\u{2601}', 'cloud'],
    ['\u{1F50C}', 'plug-zap'], ['\u{1F527}', 'wrench'], ['\u{1F9EA}', 'flask-conical'], ['\u{1F9ED}', 'compass'], ['\u{1F5FA}', 'map'],
    ['\u{1F3E0}', 'house'], ['\u{1F4CD}', 'map-pin'], ['\u{23F1}', 'timer'], ['\u{23F0}', 'alarm-clock'], ['\u{231B}', 'hourglass'],
    ['\u{25B6}', 'play'], ['\u{23F8}', 'pause'], ['\u{23F9}', 'square'], ['\u{23ED}', 'skip-forward'], ['\u{23EE}', 'skip-back'],
    ['\u{2795}', 'plus'], ['\u{2796}', 'minus'], ['\u{D7}', 'x'], ['+', 'plus'], ['\u{2190}', 'arrow-left'], ['\u{2192}', 'arrow-right'],
    ['\u{2191}', 'arrow-up'], ['\u{2193}', 'arrow-down'], ['\u{26A0}', 'triangle-alert'], ['\u{2139}', 'info'], ['\u{2753}', 'circle-help'],
    ['\u{2757}', 'circle-alert'], ['\u{1F6A8}', 'siren'], ['\u{1F534}', 'circle'], ['\u{1F7E2}', 'circle'], ['\u{1F7E1}', 'circle'],
    ['\u{1F4BB}', 'laptop'], ['\u{1F5A5}', 'monitor'], ['\u{2328}', 'keyboard'], ['\u{1F4F2}', 'tablet-smartphone'], ['\u{1F5A8}', 'printer'],
    ['\u{1F399}', 'mic'], ['\u{1F3A7}', 'headphones'], ['\u{1F4DE}', 'phone'], ['\u{1F4E2}', 'megaphone'], ['\u{1F50A}', 'volume-2'],
    ['\u{1F9D8}', 'person-standing'], ['\u{1F3C3}', 'activity'], ['\u{1F4AA}', 'dumbbell'], ['\u{2764}\u{FE0F}\u{200D}\u{1FA79}', 'heart-pulse'], ['\u{1FA7A}', 'stethoscope'],
    ['\u{1F331}', 'sprout'], ['\u{1F33F}', 'leaf'], ['\u{2600}', 'sun'], ['\u{1F319}', 'moon'], ['\u{2615}', 'coffee'],
    ['\u{1F9F9}', 'brush-cleaning'], ['\u{1F4CC}', 'pin'], ['\u{1F516}', 'bookmark'], ['\u{1F9EE}', 'calculator'], ['\u{1F5C4}', 'archive'],
    ['\u{1F52C}', 'microscope'], ['\u{1F52D}', 'telescope'], ['\u{1F9EC}', 'dna'], ['\u{1F9F1}', 'blocks'], ['\u{1F578}', 'network'],
    ['\u{267B}', 'recycle'], ['\u{1F50B}', 'battery-charging'], ['\u{1F4E3}', 'megaphone'], ['\u{1F91D}', 'handshake'], ['\u{1F381}', 'gift'],
    ['\u{1F389}', 'party-popper'], ['\u{1F3F7}', 'tag'], ['\u{1F513}', 'unlock'], ['\u{1F50F}', 'file-lock-2'], ['\u{1FAAA}', 'badge-check'],
    ['\u{25C8}', 'diamond'], ['\u{25C7}', 'diamond'], ['\u{25CE}', 'circle-dot'], ['\u{25EC}', 'triangle'], ['\u{25A0}', 'square'], ['\u{25CF}', 'circle']
  ]);

  const nameFor = (token) => ICONS.get(token) || ICONS.get(token.replace(/[\uFE0E\uFE0F]/g, '')) || 'circle-dot';

  function iconElement(name, title = '') {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.className = 'pg-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (title) icon.dataset.pgTitle = title;
    return icon;
  }

  function replaceTextNode(node) {
    if (!node.nodeValue || !ICON_PATTERN.test(node.nodeValue)) return false;
    ICON_PATTERN.lastIndex = 0;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-pg-processed], svg, script, style, textarea, code, pre')) return false;

    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let changed = false;

    for (const match of text.matchAll(ICON_PATTERN)) {
      if (match.index > cursor) fragment.append(text.slice(cursor, match.index));
      const token = match[0];
      fragment.append(iconElement(nameFor(token), token));
      cursor = match.index + token.length;
      changed = true;
    }

    if (!changed) return false;
    if (cursor < text.length) fragment.append(text.slice(cursor));
    node.replaceWith(fragment);
    return true;
  }

  function replaceVisibleSymbols(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  function replaceBrandMarks(root = document) {
    const selectors = [
      '.sidebar-logo', '.logo-icon', '.brand-icon', '.onboarding-brand-mark',
      '[data-brand-mark]', '.auth-logo-icon'
    ];
    root.querySelectorAll(selectors.join(',')).forEach((element) => {
      if (element.querySelector('[data-lucide]')) return;
      const raw = (element.textContent || '').trim();
      if (!raw || ICON_PATTERN.test(raw) || raw.length <= 2) {
        element.textContent = '';
        element.append(iconElement('orbit'));
      }
      ICON_PATTERN.lastIndex = 0;
    });
  }

  function normalizeControlSymbols(root = document) {
    root.querySelectorAll('button, a, [role="button"]').forEach((element) => {
      if (element.querySelector('.lucide, [data-lucide]')) return;
      const directText = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
      if (!directText) return;
      const value = directText.nodeValue;
      const trimmed = value.trim();
      const isAddControl = trimmed === '+' || /^\+\s+[A-Za-zÀ-ÿ]/.test(trimmed);
      const isRemoveControl = trimmed === '−' || /^−\s+[A-Za-zÀ-ÿ]/.test(trimmed);
      if (!isAddControl && !isRemoveControl) return;

      const symbol = isAddControl ? '+' : '−';
      directText.nodeValue = value.replace(symbol, '').replace(/^\s+/, ' ');
      element.prepend(iconElement(isAddControl ? 'plus' : 'minus'));
    });
  }

  function applySemanticIcons(root = document) {
    root.querySelectorAll('button, a, [role="button"], .nav-item').forEach((element) => {
      if (element.querySelector('.lucide, [data-lucide]')) return;
      const label = `${element.getAttribute('aria-label') || ''} ${element.title || ''} ${element.textContent || ''}`.trim().toLowerCase();
      if (!label) return;

      let icon = '';
      if (/mostrar senha|exibir senha/.test(label)) icon = 'eye';
      else if (/ocultar senha/.test(label)) icon = 'eye-off';
      else if (/voltar/.test(label) && /^[\s\u{2190}]/.test(element.textContent || '')) icon = 'arrow-left';
      else if (/notifica/.test(label) && element.children.length === 0) icon = 'bell';
      else if (/pesquis|buscar/.test(label) && element.children.length === 0) icon = 'search';
      else if (/configura/.test(label) && element.children.length === 0) icon = 'settings';
      else if (/menu/.test(label) && element.children.length === 0) icon = 'menu';

      if (icon) element.prepend(iconElement(icon));
    });
  }

  function normalizeAccessibility(root = document) {
    root.querySelectorAll('[data-lucide]').forEach((icon) => {
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
    });
    root.querySelectorAll('button:not([type])').forEach((button) => button.setAttribute('type', 'button'));
  }

  function renderLucide(root = document) {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
    window.lucide.createIcons({
      attrs: { 'aria-hidden': 'true', focusable: 'false' },
      nameAttr: 'data-lucide'
    });
    root.documentElement?.setAttribute('data-pg-icons-ready', 'true');
  }

  function polish(root = document) {
    replaceVisibleSymbols(root.body || root);
    replaceBrandMarks(root);
    normalizeControlSymbols(root);
    applySemanticIcons(root);
    normalizeAccessibility(root);
    renderLucide(document);
  }

  function loadLucide() {
    if (window.lucide) {
      polish(document);
      return;
    }
    if (document.querySelector(SCRIPT_SELECTOR)) return;
    const script = document.createElement('script');
    script.src = LUCIDE_SRC;
    script.defer = true;
    script.dataset.pgLucide = 'true';
    script.addEventListener('load', () => polish(document), { once: true });
    document.head.append(script);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      polish(document);
    });
  });

  function start() {
    document.documentElement.dataset.visualSystem = 'precision-graphite';
    polish(document);
    loadLucide();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
