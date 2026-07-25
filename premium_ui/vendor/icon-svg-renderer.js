/**
 * LifeOS Enterprise — Runtime SVG Icon Renderer
 * Replaces data-lucide attributes with inline SVGs at runtime.
 * Zero external dependencies. Works offline.
 *
 * This script:
 * 1. Observes DOM for new data-lucide elements
 * 2. Replaces them with inline SVG equivalents
 * 3. Handles template-based icons created by JS
 * 4. Provides a refreshIcons() function for manual re-renders
 */
(() => {
  'use strict';

  // Complete inline SVG icon map (659 icons from lucide v0.468)
  const ICONS = window.__LIFEOS_ICONS__ || {};

  const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';

  /**
   * Resolve icon name from template expressions
   * e.g., "${icon}" or "${status.icon}" or "${t.status === 'done' ? 'circle-check' : 'circle'}"
   */
  function resolveDynamicIcon(element) {
    const attr = element.getAttribute('data-lucide');
    if (!attr) return null;
    // If it's already a resolved name, use it directly
    if (!attr.includes('$') && !attr.includes('{')) {
      return attr.trim();
    }
    return null; // Can't resolve template expressions statically
  }

  /**
   * Replace a single data-lucide element with inline SVG
   */
  function replaceIconElement(element) {
    if (!element || element.tagName === 'svg' || element.closest('svg')) return false;
    
    const name = element.getAttribute('data-lucide');
    if (!name) return false;
    
    // Get all attributes except data-lucide
    const attrs = [...element.attributes]
      .filter(a => a.name !== 'data-lucide')
      .map(a => `${a.name}="${a.name === 'class' ? a.value : a.value.replace(/"/g, '&quot;')}"`)
      .join(' ');
    
    const svg = ICONS[name] || FALLBACK_SVG;
    
    // If the element is an <i> or <span> with no children, replace entirely
    if ((element.tagName === 'I' || element.tagName === 'SPAN') && !element.children.length) {
      element.outerHTML = svg.replace('<svg ', `<svg ${attrs} `);
      return true;
    }
    
    // Otherwise, clear content and set innerHTML to SVG
    element.removeAttribute('data-lucide');
    if (attrs) {
      element.setAttribute('data-icon-rendered', 'true');
    }
    element.innerHTML = svg.replace('<svg ', '<svg ');
    return true;
  }

  /**
   * Scan and replace all data-lucide elements in a root
   */
  function refreshIcons(root = document) {
    const elements = root.querySelectorAll('[data-lucide]');
    let count = 0;
    elements.forEach(el => {
      if (replaceIconElement(el)) count++;
    });
    
    // Mark document as icons-ready
    if (root.documentElement) {
      root.documentElement.setAttribute('data-icons-ready', 'true');
    }
    
    return count;
  }

  /**
   * Create an SVG icon element for use in template literals
   */
  function createIconSVG(name, attrs = '') {
    const svg = ICONS[name] || FALLBACK_SVG;
    return svg.replace('<svg ', `<svg ${attrs} `);
  }

  /**
   * Get SVG string for an icon name
   */
  function getIconSVG(name) {
    return ICONS[name] || FALLBACK_SVG;
  }

  /**
   * Observer to handle dynamically added icons
   */
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refreshIcons(document);
    });
  });

  function start() {
    // Initial render
    refreshIcons(document);
    
    // Observe for dynamically added elements
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-lucide']
    });
  }

  // Export functions to global scope
  window.refreshIcons = refreshIcons;
  window.createIconSVG = createIconSVG;
  window.getIconSVG = getIconSVG;
  window.__ICON_SVG_RENDERER__ = true;

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
