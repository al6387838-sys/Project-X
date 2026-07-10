/**
 * LifeOS Premium — Motion Engine
 * Sprint 028 | Version 2.0.0
 *
 * Provides a unified animation API for all LifeOS UI components.
 * Inspired by Framer Motion, Apple UIKit, and Linear's animation system.
 */

'use strict';

/* ============================================================
   MOTION CONFIG
   ============================================================ */
const MotionConfig = {
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  defaultDuration: 200,
  defaultEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',

  spring: {
    gentle:  'cubic-bezier(0.25, 1.0, 0.5, 1)',
    bouncy:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
    stiff:   'cubic-bezier(0.5, 0, 0.75, 0)',
    smooth:  'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  durations: {
    instant:  50,
    fast:     100,
    normal:   200,
    moderate: 300,
    slow:     500,
    slower:   700,
    slowest:  1000,
  },

  stagger: {
    fast:   30,
    normal: 60,
    slow:   100,
  }
};

// Listen for reduced motion changes
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  MotionConfig.reducedMotion = e.matches;
});

/* ============================================================
   CORE ANIMATE FUNCTION
   ============================================================ */
/**
 * Animate an element using the Web Animations API.
 * @param {Element} el - Target element
 * @param {Keyframe[]} keyframes - Animation keyframes
 * @param {Object} options - Animation options
 * @returns {Animation|null}
 */
function animate(el, keyframes, options = {}) {
  if (!el) return null;
  if (MotionConfig.reducedMotion) {
    // Apply final state immediately
    const last = keyframes[keyframes.length - 1];
    Object.assign(el.style, last);
    return null;
  }

  const defaults = {
    duration: MotionConfig.defaultDuration,
    easing:   MotionConfig.defaultEasing,
    fill:     'forwards',
  };

  return el.animate(keyframes, { ...defaults, ...options });
}

/* ============================================================
   ENTRANCE ANIMATIONS
   ============================================================ */
const Entrance = {
  fadeIn(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 200, easing: MotionConfig.spring.gentle, ...opts });
  },

  fadeInUp(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateY(24px) scale(0.97)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 300, easing: MotionConfig.spring.bouncy, ...opts });
  },

  fadeInDown(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateY(-24px) scale(0.97)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 300, easing: MotionConfig.spring.bouncy, ...opts });
  },

  fadeInLeft(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateX(-32px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 300, easing: MotionConfig.spring.gentle, ...opts });
  },

  fadeInRight(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateX(32px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 300, easing: MotionConfig.spring.gentle, ...opts });
  },

  scaleIn(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'scale(0.88)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 200, easing: MotionConfig.spring.bouncy, ...opts });
  },

  bounceIn(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'scale(0.3)' },
      { opacity: 1, transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(0.9)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 500, easing: 'ease-out', ...opts });
  },

  slideInFromRight(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateX(100%)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 350, easing: MotionConfig.spring.gentle, ...opts });
  },

  slideInFromLeft(el, opts = {}) {
    return animate(el, [
      { opacity: 0, transform: 'translateX(-100%)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 350, easing: MotionConfig.spring.gentle, ...opts });
  },
};

/* ============================================================
   EXIT ANIMATIONS
   ============================================================ */
const Exit = {
  fadeOut(el, opts = {}) {
    return animate(el, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(8px)' }
    ], { duration: 150, easing: MotionConfig.spring.smooth, ...opts });
  },

  scaleOut(el, opts = {}) {
    return animate(el, [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.88)' }
    ], { duration: 150, easing: 'ease-in', ...opts });
  },

  slideOutRight(el, opts = {}) {
    return animate(el, [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(100%)' }
    ], { duration: 300, easing: MotionConfig.spring.smooth, ...opts });
  },

  slideOutLeft(el, opts = {}) {
    return animate(el, [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(-100%)' }
    ], { duration: 300, easing: MotionConfig.spring.smooth, ...opts });
  },
};

/* ============================================================
   MICRO INTERACTIONS
   ============================================================ */
const Micro = {
  /** Press feedback — scale down on press */
  press(el) {
    return animate(el, [
      { transform: 'scale(1)' },
      { transform: 'scale(0.96)' },
      { transform: 'scale(1)' }
    ], { duration: 150, easing: MotionConfig.spring.stiff });
  },

  /** Hover lift — subtle elevation on hover */
  hoverLift(el) {
    return animate(el, [
      { transform: 'translateY(0)', boxShadow: 'var(--elevation-1)' },
      { transform: 'translateY(-2px)', boxShadow: 'var(--elevation-3)' }
    ], { duration: 200, easing: MotionConfig.spring.gentle, fill: 'forwards' });
  },

  hoverLiftReset(el) {
    return animate(el, [
      { transform: 'translateY(-2px)', boxShadow: 'var(--elevation-3)' },
      { transform: 'translateY(0)', boxShadow: 'var(--elevation-1)' }
    ], { duration: 200, easing: MotionConfig.spring.smooth, fill: 'forwards' });
  },

  /** Shake — error feedback */
  shake(el) {
    return animate(el, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' }
    ], { duration: 400, easing: 'ease-in-out' });
  },

  /** Pulse — attention feedback */
  pulse(el, color = 'rgba(99,102,241,0.4)') {
    return animate(el, [
      { boxShadow: `0 0 0 0 ${color}` },
      { boxShadow: `0 0 0 8px transparent` }
    ], { duration: 600, easing: 'ease-out' });
  },

  /** Ripple effect on click */
  ripple(el, event) {
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x - size/2}px;
      top: ${y - size/2}px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      pointer-events: none;
      transform: scale(0);
    `;

    const prevPosition = el.style.position;
    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);

    const anim = ripple.animate([
      { transform: 'scale(0)', opacity: 0.6 },
      { transform: 'scale(1)', opacity: 0 }
    ], { duration: 600, easing: 'ease-out', fill: 'forwards' });

    anim.onfinish = () => {
      ripple.remove();
      el.style.position = prevPosition;
    };

    return anim;
  },

  /** Success checkmark bounce */
  successBounce(el) {
    return animate(el, [
      { transform: 'scale(0) rotate(-30deg)', opacity: 0 },
      { transform: 'scale(1.2) rotate(5deg)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 }
    ], { duration: 400, easing: MotionConfig.spring.bouncy });
  },

  /** Number count up animation */
  countUp(el, from, to, duration = 1000, formatter = (n) => Math.round(n).toString()) {
    if (MotionConfig.reducedMotion) {
      el.textContent = formatter(to);
      return;
    }
    const start = performance.now();
    const update = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = formatter(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },
};

/* ============================================================
   STAGGER ANIMATIONS
   ============================================================ */
const Stagger = {
  /**
   * Animate a list of elements with staggered delay.
   * @param {NodeList|Element[]} elements
   * @param {Function} animFn - Animation function from Entrance
   * @param {Object} opts
   */
  animate(elements, animFn, opts = {}) {
    const delay = opts.stagger || MotionConfig.stagger.normal;
    const items = Array.from(elements);
    items.forEach((el, i) => {
      animFn(el, { ...opts, delay: (opts.delay || 0) + i * delay });
    });
  },

  fadeInList(elements, opts = {}) {
    this.animate(elements, Entrance.fadeIn, opts);
  },

  fadeInUpList(elements, opts = {}) {
    this.animate(elements, Entrance.fadeInUp, opts);
  },

  fadeInLeftList(elements, opts = {}) {
    this.animate(elements, Entrance.fadeInLeft, opts);
  },
};

/* ============================================================
   SHARED ELEMENT TRANSITIONS
   ============================================================ */
const SharedElement = {
  /**
   * Animate from one element's position to another (FLIP technique).
   * @param {Element} from - Source element
   * @param {Element} to - Target element
   * @param {Object} opts
   */
  transition(from, to, opts = {}) {
    if (MotionConfig.reducedMotion) return;

    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();

    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    const dw = fromRect.width / toRect.width;
    const dh = fromRect.height / toRect.height;

    to.style.transformOrigin = '0 0';
    to.style.opacity = '0';
    to.style.visibility = 'visible';

    animate(to, [
      {
        opacity: 0,
        transform: `translate(${dx}px, ${dy}px) scale(${dw}, ${dh})`
      },
      {
        opacity: 1,
        transform: 'translate(0, 0) scale(1)'
      }
    ], { duration: opts.duration || 400, easing: MotionConfig.spring.gentle, ...opts });
  }
};

/* ============================================================
   PAGE TRANSITIONS
   ============================================================ */
const PageTransition = {
  /** Navigate forward — new page slides in from right */
  forward(outEl, inEl, opts = {}) {
    if (MotionConfig.reducedMotion) {
      if (outEl) outEl.style.display = 'none';
      if (inEl) { inEl.style.display = 'flex'; inEl.style.opacity = '1'; }
      return;
    }
    const duration = opts.duration || 350;
    const easing = MotionConfig.spring.gentle;

    if (outEl) {
      animate(outEl, [
        { opacity: 1, transform: 'translateX(0) scale(1)' },
        { opacity: 0, transform: 'translateX(-32px) scale(0.98)' }
      ], { duration, easing, fill: 'forwards' }).onfinish = () => {
        outEl.style.display = 'none';
      };
    }

    if (inEl) {
      inEl.style.display = 'flex';
      animate(inEl, [
        { opacity: 0, transform: 'translateX(32px) scale(0.98)' },
        { opacity: 1, transform: 'translateX(0) scale(1)' }
      ], { duration, easing, fill: 'forwards' });
    }
  },

  /** Navigate back — current page slides out to right */
  back(outEl, inEl, opts = {}) {
    if (MotionConfig.reducedMotion) {
      if (outEl) outEl.style.display = 'none';
      if (inEl) { inEl.style.display = 'flex'; inEl.style.opacity = '1'; }
      return;
    }
    const duration = opts.duration || 350;
    const easing = MotionConfig.spring.gentle;

    if (outEl) {
      animate(outEl, [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(32px)' }
      ], { duration, easing, fill: 'forwards' }).onfinish = () => {
        outEl.style.display = 'none';
      };
    }

    if (inEl) {
      inEl.style.display = 'flex';
      animate(inEl, [
        { opacity: 0, transform: 'translateX(-32px)' },
        { opacity: 1, transform: 'translateX(0)' }
      ], { duration, easing, fill: 'forwards' });
    }
  },

  /** Fade transition — neutral navigation */
  fade(outEl, inEl, opts = {}) {
    if (MotionConfig.reducedMotion) {
      if (outEl) outEl.style.display = 'none';
      if (inEl) { inEl.style.display = 'flex'; inEl.style.opacity = '1'; }
      return;
    }
    const duration = opts.duration || 250;

    if (outEl) {
      animate(outEl, [{ opacity: 1 }, { opacity: 0 }], {
        duration: duration * 0.6, easing: 'ease-in', fill: 'forwards'
      }).onfinish = () => {
        outEl.style.display = 'none';
        if (inEl) {
          inEl.style.display = 'flex';
          animate(inEl, [{ opacity: 0 }, { opacity: 1 }], {
            duration: duration * 0.8, easing: 'ease-out', fill: 'forwards'
          });
        }
      };
    } else if (inEl) {
      inEl.style.display = 'flex';
      animate(inEl, [{ opacity: 0 }, { opacity: 1 }], {
        duration, easing: 'ease-out', fill: 'forwards'
      });
    }
  },
};

/* ============================================================
   MODAL ANIMATIONS
   ============================================================ */
const ModalMotion = {
  open(backdropEl, contentEl) {
    if (backdropEl) {
      animate(backdropEl, [
        { opacity: 0, backdropFilter: 'blur(0px)' },
        { opacity: 1, backdropFilter: 'blur(8px)' }
      ], { duration: 250, easing: 'ease-out', fill: 'forwards' });
    }
    if (contentEl) {
      animate(contentEl, [
        { opacity: 0, transform: 'scale(0.92) translateY(16px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' }
      ], { duration: 300, easing: MotionConfig.spring.bouncy, fill: 'forwards' });
    }
  },

  close(backdropEl, contentEl, onComplete) {
    let done = 0;
    const check = () => { done++; if (done >= 2 && onComplete) onComplete(); };

    if (backdropEl) {
      const a = animate(backdropEl, [
        { opacity: 1, backdropFilter: 'blur(8px)' },
        { opacity: 0, backdropFilter: 'blur(0px)' }
      ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      if (a) a.onfinish = check; else check();
    } else check();

    if (contentEl) {
      const a = animate(contentEl, [
        { opacity: 1, transform: 'scale(1) translateY(0)' },
        { opacity: 0, transform: 'scale(0.92) translateY(16px)' }
      ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      if (a) a.onfinish = check; else check();
    } else check();
  },
};

/* ============================================================
   TOAST / NOTIFICATION ANIMATIONS
   ============================================================ */
const ToastMotion = {
  show(el) {
    return animate(el, [
      { opacity: 0, transform: 'translateX(120%) scale(0.9)' },
      { opacity: 1, transform: 'translateX(0) scale(1)' }
    ], { duration: 350, easing: MotionConfig.spring.bouncy, fill: 'forwards' });
  },

  hide(el, onComplete) {
    const a = animate(el, [
      { opacity: 1, transform: 'translateX(0) scale(1)' },
      { opacity: 0, transform: 'translateX(120%) scale(0.9)' }
    ], { duration: 250, easing: 'ease-in', fill: 'forwards' });
    if (a && onComplete) a.onfinish = onComplete;
  },
};

/* ============================================================
   SKELETON LOADING
   ============================================================ */
const Skeleton = {
  /**
   * Replace element content with skeleton placeholders.
   * @param {Element} container
   * @param {Object} config - { lines, avatar, title }
   */
  show(container, config = {}) {
    const { lines = 3, avatar = false, title = true } = config;
    container.setAttribute('aria-busy', 'true');
    container.setAttribute('aria-label', 'Carregando...');

    let html = '<div class="skeleton-wrapper" role="presentation">';
    if (avatar) {
      html += '<div class="skeleton-avatar skeleton-pulse"></div>';
    }
    if (title) {
      html += '<div class="skeleton-title skeleton-pulse"></div>';
    }
    for (let i = 0; i < lines; i++) {
      const width = [100, 85, 70, 90, 75][i % 5];
      html += `<div class="skeleton-line skeleton-pulse" style="width:${width}%"></div>`;
    }
    html += '</div>';

    container._skeletonOriginal = container.innerHTML;
    container.innerHTML = html;
  },

  hide(container) {
    if (container._skeletonOriginal !== undefined) {
      container.innerHTML = container._skeletonOriginal;
      delete container._skeletonOriginal;
    }
    container.removeAttribute('aria-busy');
    container.removeAttribute('aria-label');
  },

  /** Create a standalone skeleton card */
  card(lines = 3) {
    const div = document.createElement('div');
    div.className = 'skeleton-card';
    div.innerHTML = `
      <div class="skeleton-title skeleton-pulse"></div>
      ${Array.from({length: lines}, (_, i) => {
        const w = [100,85,70,90,75][i%5];
        return `<div class="skeleton-line skeleton-pulse" style="width:${w}%"></div>`;
      }).join('')}
    `;
    return div;
  },
};

/* ============================================================
   HAPTIC FEEDBACK (Mobile)
   ============================================================ */
const Haptic = {
  /** Light tap — for selections */
  light() {
    if ('vibrate' in navigator) navigator.vibrate(10);
  },

  /** Medium tap — for confirmations */
  medium() {
    if ('vibrate' in navigator) navigator.vibrate(20);
  },

  /** Heavy tap — for errors or important actions */
  heavy() {
    if ('vibrate' in navigator) navigator.vibrate([30, 10, 30]);
  },

  /** Success pattern */
  success() {
    if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
  },

  /** Error pattern */
  error() {
    if ('vibrate' in navigator) navigator.vibrate([30, 20, 30, 20, 30]);
  },

  /** Warning pattern */
  warning() {
    if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
  },
};

/* ============================================================
   SOUND FEEDBACK (Optional)
   ============================================================ */
const Sound = {
  _enabled: false,
  _ctx: null,

  enable() { this._enabled = true; },
  disable() { this._enabled = false; },
  toggle() { this._enabled = !this._enabled; return this._enabled; },

  _getCtx() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    return this._ctx;
  },

  _play(frequency, type = 'sine', duration = 0.1, volume = 0.1) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  },

  click()   { this._play(800, 'sine', 0.05, 0.08); },
  success() { this._play(880, 'sine', 0.15, 0.10); setTimeout(() => this._play(1100, 'sine', 0.10, 0.08), 100); },
  error()   { this._play(220, 'sawtooth', 0.20, 0.12); },
  notification() { this._play(660, 'sine', 0.10, 0.08); setTimeout(() => this._play(880, 'sine', 0.08, 0.06), 80); },
  toggle()  { this._play(600, 'square', 0.05, 0.06); },
};

/* ============================================================
   INTERSECTION OBSERVER — Scroll Animations
   ============================================================ */
const ScrollReveal = {
  _observer: null,

  init(selector = '[data-reveal]') {
    if (MotionConfig.reducedMotion) return;

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const type = el.dataset.reveal || 'fadeIn';
          const delay = parseInt(el.dataset.revealDelay || 0);

          setTimeout(() => {
            if (Entrance[type]) Entrance[type](el);
            else Entrance.fadeIn(el);
          }, delay);

          this._observer.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(selector).forEach(el => {
      el.style.opacity = '0';
      this._observer.observe(el);
    });
  },

  destroy() {
    if (this._observer) this._observer.disconnect();
  },
};

/* ============================================================
   PROGRESS BAR
   ============================================================ */
const ProgressBar = {
  animate(el, targetPercent, opts = {}) {
    const duration = opts.duration || 600;
    const easing = opts.easing || 'cubic-bezier(0, 0, 0.2, 1)';

    return animate(el, [
      { width: '0%' },
      { width: `${targetPercent}%` }
    ], { duration, easing, fill: 'forwards' });
  },

  animateFrom(el, fromPercent, toPercent, opts = {}) {
    const duration = opts.duration || 600;
    return animate(el, [
      { width: `${fromPercent}%` },
      { width: `${toPercent}%` }
    ], { duration, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'forwards', ...opts });
  },
};

/* ============================================================
   EXPORT
   ============================================================ */
window.LifeOSMotion = {
  config:     MotionConfig,
  animate,
  Entrance,
  Exit,
  Micro,
  Stagger,
  SharedElement,
  PageTransition,
  ModalMotion,
  ToastMotion,
  Skeleton,
  Haptic,
  Sound,
  ScrollReveal,
  ProgressBar,
};

// Convenience aliases
window.Motion = window.LifeOSMotion;
