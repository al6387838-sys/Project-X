// LifeOS Enterprise — Performance Optimization v1.0
// Phase 150 — Performance Optimization
// Cache · Lazy Loading · Bundle Optimization · Asset Compression

// ─── Cache Strategy ───────────────────────────────────────────────────────────
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
  }

  set(key, value, ttlSeconds = 3600) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttlSeconds * 1000);
    return value;
  }

  get(key) {
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  has(key) {
    return this.get(key) !== null;
  }
}

const globalCache = new CacheManager();

// ─── Lazy Loading Images ──────────────────────────────────────────────────────
function initLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: carregar todas as imagens
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });

  document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// ─── Lazy Loading Modules ─────────────────────────────────────────────────────
async function lazyLoadModule(moduleName) {
  const cacheKey = `module:${moduleName}`;
  if (globalCache.has(cacheKey)) {
    return globalCache.get(cacheKey);
  }

  try {
    const response = await fetch(`/app/modules/${moduleName}.html`);
    if (!response.ok) throw new Error(`Módulo ${moduleName} não encontrado`);
    const html = await response.text();
    globalCache.set(cacheKey, html, 86400); // 24 horas
    return html;
  } catch (err) {
    console.error(`Erro ao carregar módulo ${moduleName}:`, err);
    return null;
  }
}

// ─── Prefetch Resources ───────────────────────────────────────────────────────
function prefetchResources(urls) {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
}

// ─── Preload Critical Resources ───────────────────────────────────────────────
function preloadCritical() {
  const criticalResources = [
    { href: '/black_diamond.css', as: 'style' },
    { href: '/precision_graphite.js', as: 'script' },
    { href: '/vendor/lucide.min.js', as: 'script' },
  ];

  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    if (resource.as === 'script') link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// ─── Request Debouncing ───────────────────────────────────────────────────────
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ─── Request Throttling ───────────────────────────────────────────────────────
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ─── API Request Caching ──────────────────────────────────────────────────────
async function cachedFetch(url, options = {}, ttlSeconds = 300) {
  const cacheKey = `fetch:${url}`;
  
  if (options.method === 'GET' || !options.method) {
    const cached = globalCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(url, { ...options, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (response.ok && (!options.method || options.method === 'GET')) {
      globalCache.set(cacheKey, data, ttlSeconds);
    }
    return data;
  } catch (err) {
    console.error(`Erro em cachedFetch(${url}):`, err);
    throw err;
  }
}

// ─── Virtual Scrolling para Listas Grandes ────────────────────────────────────
class VirtualScroller {
  constructor(container, items, itemHeight, renderItem) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.visibleRange = { start: 0, end: 0 };
    this.init();
  }

  init() {
    this.container.style.overflow = 'auto';
    this.container.style.height = '100%';
    this.render();
    this.container.addEventListener('scroll', () => this.onScroll());
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = Math.ceil((scrollTop + containerHeight) / this.itemHeight);
    
    if (start !== this.visibleRange.start || end !== this.visibleRange.end) {
      this.visibleRange = { start, end };
      this.render();
    }
  }

  render() {
    const { start, end } = this.visibleRange;
    const fragment = document.createDocumentFragment();
    
    for (let i = start; i < Math.min(end, this.items.length); i++) {
      const item = this.items[i];
      const el = this.renderItem(item, i);
      el.style.position = 'absolute';
      el.style.top = `${i * this.itemHeight}px`;
      el.style.height = `${this.itemHeight}px`;
      fragment.appendChild(el);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}

// ─── Performance Monitoring ───────────────────────────────────────────────────
class PerformanceMonitor {
  static logMetric(name, duration) {
    if (window.performance && window.performance.mark) {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
        const measure = performance.getEntriesByName(name)[0];
        // [removed]
      } catch (e) {
        // [removed]
      }
    }
  }

  static reportWebVitals() {
    if ('web-vital' in window) {
      window.addEventListener('load', () => {
        const vitals = {
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          lcp: 0,
          cls: 0,
        };
        // [removed]
      });
    }
  }

  static getMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] || {};
    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      domComplete: navigation.domComplete - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
    };
  }
}

// ─── Bundle Size Optimization ─────────────────────────────────────────────────
// Estratégia: Code splitting por módulo, lazy loading de módulos não-críticos
const CRITICAL_MODULES = ['dashboard', 'tasks', 'notifications'];
const LAZY_MODULES = ['communication-hub', 'finance-hub', 'document-center', 'ai-orchestrator', 'security', 'collaboration', 'payments', 'platform'];

// ─── Asset Compression & Optimization ──────────────────────────────────────────
// Recomendações:
// 1. Usar WebP com fallback para PNG/JPG
// 2. Servir imagens responsivas com srcset
// 3. Minificar CSS e JS em produção
// 4. Usar gzip/brotli no servidor (Cloudflare)

function optimizeImages() {
  document.querySelectorAll('img').forEach(img => {
    // Adicionar loading="lazy" se não tiver data-src
    if (!img.hasAttribute('data-src') && !img.hasAttribute('loading')) {
      img.loading = 'lazy';
    }
  });
}

// ─── Initialize Performance Optimizations ─────────────────────────────────────
function initPerformanceOptimizations() {
  // Preload críticos
  preloadCritical();

  // Lazy loading de imagens
  initLazyLoading();

  // Otimizar imagens
  optimizeImages();

  // Monitorar performance
  PerformanceMonitor.reportWebVitals();

  // Prefetch módulos lazy
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        LAZY_MODULES.forEach(mod => lazyLoadModule(mod));
      }, 2000);
    });
  } else {
    setTimeout(() => {
      LAZY_MODULES.forEach(mod => lazyLoadModule(mod));
    }, 2000);
  }
}

// Auto-inicializar quando o script carregar
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPerformanceOptimizations);
  } else {
    initPerformanceOptimizations();
  }
}

// Exportar para uso em outros scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CacheManager,
    VirtualScroller,
    PerformanceMonitor,
    cachedFetch,
    debounce,
    throttle,
    lazyLoadModule,
    initLazyLoading,
    preloadCritical,
    optimizeImages,
  };
}

// ─── Phase 180 — Performance Enterprise v19.0 ────────────────────────────────
function initModuleLazyLoad() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.lazyModule) {
          import(el.dataset.lazyModule).catch(() => {});
          observer.unobserve(el);
        }
      }
    });
  }, { rootMargin: '200px' });
  document.querySelectorAll('[data-lazy-module]').forEach(el => observer.observe(el));
}
function prefetchCriticalRoutes() {
  const routes = ['/app/index.html', '/login/index.html'];
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      routes.forEach(route => {
        const link = document.createElement('link');
        link.rel = 'prefetch'; link.href = route;
        document.head.appendChild(link);
      });
    }, { timeout: 2000 });
  }
}
function cleanupObsoleteListeners() {
  if ('performance' in window && 'memory' in performance) {
    const mem = performance.memory;
    if (mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.85) globalCache?.clear?.();
  }
}
function injectResourceHints() {
  const hints = [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
  ];
  hints.forEach(({ rel, href, crossorigin }) => {
    if (!document.querySelector('link[rel="' + rel + '"][href="' + href + '"]')) {
      const link = document.createElement('link');
      link.rel = rel; link.href = href;
      if (crossorigin) link.crossOrigin = 'anonymous';
      document.head.insertBefore(link, document.head.firstChild);
    }
  });
}
if (typeof document !== 'undefined') {
  const run = () => { initModuleLazyLoad(); prefetchCriticalRoutes(); injectResourceHints(); setInterval(cleanupObsoleteListeners, 60000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
