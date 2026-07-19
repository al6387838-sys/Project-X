/* LIFEOS Enterprise v44.0 — Admin Control Plane
 * Phases 304-307: Layout Enterprise corrigido, auditoria visual completa,
 * funcionalidade total dos botões, UX Enterprise premium.
 * Camada progressiva sobre /admin — usa exclusivamente /api/admin-data.
 */
(() => {
  'use strict';

  const VERSION = '44.0';

  const NAVIGATION = [
    ['overview',       'dashboard',     'Dashboard',       '▦'],
    ['analytics',      'dashboard',     'Analytics',       '◔'],
    ['crm',            'crm',           'CRM',             '◎'],
    ['users',          'users',         'Usuários',        '♙'],
    ['organizations',  'organizations', 'Organizações',    '◫'],
    ['billing',        'billing',       'Billing',         '◈'],
    ['subscriptions',  'subscriptions', 'Assinaturas',     '↻'],
    ['plans',          'plans',         'Planos',          '◇'],
    ['workspaces',     'workspaces',    'Workspaces',      '▤'],
    ['audit',          'audit',         'Auditoria',       '◷'],
    ['logs',           'logs',          'Logs',            '≡'],
    ['security',       'security',      'Segurança',       '◇'],
    ['system',         'system',        'Sistema',         '⚙'],
    ['integrations',   'integrations',  'Integrações',     '↔'],
    ['features',       'featureFlags',  'Feature Flags',   '⚑'],
  ];

  const NAV_GROUPS = [
    { label: 'Visão Geral',   ids: ['overview', 'analytics'] },
    { label: 'Operacional',   ids: ['crm', 'users', 'organizations'] },
    { label: 'Financeiro',    ids: ['billing', 'subscriptions', 'plans'] },
    { label: 'Infraestrutura',ids: ['workspaces', 'integrations', 'features'] },
    { label: 'Compliance',    ids: ['audit', 'logs', 'security', 'system'] },
  ];

  const state = {
    page: 'overview',
    query: '',
    status: '',
    plan: '',
    pageNumber: 1,
    pageSize: 25,
    loading: false,
    payload: null,
    cache: { organizations: [], plans: [], users: [], workspaces: [] },
    sidebarOpen: false,
  };

  /* ── UTILS ── */
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const text = (v, fb = '—') => (v === null || v === undefined || v === '') ? fb : String(v);
  const arr  = (v) => Array.isArray(v) ? v : [];
  const obj  = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const route = (id) => NAVIGATION.find(([i]) => i === id) || NAVIGATION[0];
  const el   = (sel, root = document) => root.querySelector(sel);
  const all  = (sel, root = document) => [...root.querySelectorAll(sel)];

  const statusClass = (s) => {
    const n = String(s || '').toLowerCase();
    if (['active','ready','connected','healthy','paid','completed','verified','enabled'].includes(n)) return 'is-positive';
    if (['suspended','cancelled','archived','deleted','error','critical','past_due','disabled'].includes(n)) return 'is-negative';
    if (['pending','trialing','warning','paused','not_configured'].includes(n)) return 'is-warning';
    return 'is-neutral';
  };

  const badge = (v) => `<span class="la-badge ${statusClass(v)}">${esc(text(v))}</span>`;

  const fmtDate = (v) => {
    if (!v) return '<span class="la-muted">—</span>';
    const d = new Date(v);
    return isNaN(d) ? esc(v) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const fmtNum  = (v) => (v == null) ? '—' : Number(v).toLocaleString('pt-BR');
  const fmtMoney = (cents) => (cents == null) ? '<span class="la-muted">Não disponível</span>' :
    (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  /* ── STYLE INJECTION ── */
  function injectStyle() {
    if (el('#lifeos-admin-v44-style')) return;
    const s = document.createElement('style');
    s.id = 'lifeos-admin-v44-style';
    s.textContent = `
/* ── RESET & BASE ── */
#lifeos-admin-root *,#lifeos-admin-root *::before,#lifeos-admin-root *::after{box-sizing:border-box}
.la-shell{display:flex;min-height:100vh;background:#f4f6fb;color:#1a2332;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;position:relative}

/* ── SIDEBAR ── */
.la-sidebar{
  width:220px;min-width:220px;flex-shrink:0;
  background:#0f1623;color:#c8d3e6;
  display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;overflow-y:auto;overflow-x:hidden;
  border-right:1px solid rgba(255,255,255,0.06);
  transition:transform .25s ease;
  z-index:200;
}
.la-sidebar::-webkit-scrollbar{width:3px}
.la-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
.la-brand{
  padding:18px 16px 14px;
  border-bottom:1px solid rgba(255,255,255,0.06);
  flex-shrink:0;
}
.la-brand-name{font-size:13px;font-weight:800;color:#fff;letter-spacing:.02em;white-space:nowrap}
.la-brand-sub{font-size:10px;color:#6b7fa0;margin-top:3px;white-space:nowrap}
.la-nav-group{padding:12px 8px 4px}
.la-nav-group-label{
  font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;
  color:#4a5a78;padding:0 8px;margin-bottom:4px;
}
.la-nav{
  width:100%;border:0;background:transparent;color:#8fa3c4;
  text-align:left;padding:8px 10px;border-radius:7px;
  font-size:12px;font-weight:500;font-family:inherit;
  margin:1px 0;cursor:pointer;
  display:flex;gap:8px;align-items:center;
  transition:background .12s,color .12s;
  white-space:nowrap;overflow:hidden;
}
.la-nav:hover{background:rgba(255,255,255,0.06);color:#e2e8f0}
.la-nav.active{background:rgba(99,102,241,0.18);color:#a5b4fc;font-weight:600}
.la-nav-icon{width:14px;text-align:center;flex-shrink:0;font-size:11px;opacity:.8}
.la-nav.active .la-nav-icon{opacity:1}
.la-sidebar-footer{
  margin-top:auto;padding:12px;
  border-top:1px solid rgba(255,255,255,0.06);
  flex-shrink:0;
}
.la-sidebar-user{
  display:flex;align-items:center;gap:9px;
  padding:8px 10px;border-radius:8px;
  background:rgba(255,255,255,0.04);
}
.la-sidebar-avatar{
  width:28px;height:28px;border-radius:50%;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:#fff;flex-shrink:0;
}
.la-sidebar-uname{font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.la-sidebar-urole{font-size:10px;color:#6b7fa0}

/* ── MAIN ── */
.la-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.la-topbar{
  height:56px;display:flex;align-items:center;gap:12px;
  padding:0 24px;background:#fff;
  border-bottom:1px solid #e5e9f0;
  flex-shrink:0;position:sticky;top:0;z-index:100;
}
.la-topbar-title{font-size:15px;font-weight:700;color:#1a2332;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.la-topbar-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.la-topbar-badge{
  display:flex;align-items:center;gap:5px;
  font-size:10px;font-weight:700;letter-spacing:.04em;
  color:#ef4444;background:rgba(239,68,68,0.08);
  border:1px solid rgba(239,68,68,0.18);
  padding:4px 10px;border-radius:99px;
}
.la-topbar-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:la-pulse 2s infinite}
@keyframes la-pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ── CONTENT ── */
.la-content{flex:1;overflow-y:auto;overflow-x:hidden;padding:24px;min-width:0}
.la-content::-webkit-scrollbar{width:5px}
.la-content::-webkit-scrollbar-thumb{background:#d1d9e6;border-radius:3px}

/* ── TOPBAR (page) ── */
.la-page-topbar{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:16px;margin-bottom:20px;flex-wrap:wrap;
}
.la-page-topbar h1{font-size:22px;font-weight:800;color:#111827;letter-spacing:-.03em;margin:0}
.la-page-topbar p{font-size:13px;color:#667085;margin:4px 0 0}
.la-page-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex-shrink:0}

/* ── BUTTONS ── */
.la-btn{
  appearance:none;border:1px solid #d0d5dd;background:#fff;color:#344054;
  border-radius:7px;padding:7px 12px;
  font:600 12px/1.2 inherit;cursor:pointer;
  transition:all .14s;display:inline-flex;align-items:center;gap:6px;
  white-space:nowrap;flex-shrink:0;
}
.la-btn:hover:not(:disabled){border-color:#9aa5b4;background:#f9fafb;transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.06)}
.la-btn:active:not(:disabled){transform:translateY(0);box-shadow:none}
.la-btn:disabled{opacity:.5;cursor:not-allowed}
.la-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-color:transparent;color:#fff}
.la-btn.primary:hover:not(:disabled){box-shadow:0 4px 14px rgba(79,70,229,.35)}
.la-btn.danger{color:#b42318;border-color:#fecdca;background:#fff}
.la-btn.danger:hover:not(:disabled){background:#fff4f2;border-color:#f97066}
.la-btn.ghost{background:transparent;border-color:transparent;color:#667085}
.la-btn.ghost:hover:not(:disabled){background:#f2f4f7;color:#344054;transform:none;box-shadow:none}
.la-btn.small{padding:5px 9px;font-size:11px;border-radius:6px}
.la-btn.icon{padding:6px;width:30px;height:30px;justify-content:center}

/* ── METRICS GRID ── */
.la-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
.la-metric{
  background:#fff;border:1px solid #e5e9f0;border-radius:10px;
  padding:18px;transition:box-shadow .15s,transform .15s;
}
.la-metric:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
.la-metric-label{font-size:11px;font-weight:600;color:#667085;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.la-metric-value{font-size:26px;font-weight:800;color:#111827;letter-spacing:-.03em;line-height:1}
.la-metric-meta{font-size:11px;color:#98a2b3;margin-top:6px}

/* ── CARD ── */
.la-card{background:#fff;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden}
.la-card.pad{padding:18px}
.la-card-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid #f0f2f7;
  gap:12px;flex-wrap:wrap;
}
.la-card-title{font-size:14px;font-weight:700;color:#1a2332}
.la-card-sub{font-size:12px;color:#667085;margin-top:2px}

/* ── GRID ── */
.la-grid{display:grid;gap:14px}
.la-grid.split{grid-template-columns:1fr 1fr}
.la-grid.thirds{grid-template-columns:repeat(3,minmax(0,1fr))}
.la-grid.auto{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}

/* ── TOOLBAR ── */
.la-toolbar{
  display:flex;align-items:center;gap:8px;
  margin-bottom:12px;flex-wrap:wrap;
}
.la-toolbar-left{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.la-toolbar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto}

/* ── FORM CONTROLS ── */
.la-input,.la-select,.la-textarea{
  border:1px solid #d0d5dd;background:#fff;border-radius:7px;
  padding:7px 10px;color:#101828;font:13px/1.4 inherit;
  transition:border-color .15s,box-shadow .15s;
}
.la-input{min-width:200px;height:34px}
.la-select{min-width:130px;height:34px;cursor:pointer}
.la-textarea{width:100%;min-height:80px;resize:vertical}
.la-input:focus,.la-select:focus,.la-textarea:focus{
  outline:none;border-color:#6366f1;
  box-shadow:0 0 0 3px rgba(99,102,241,.12);
}
:focus-visible{outline:2px solid #6366f1;outline-offset:2px}
.la-input::placeholder{color:#98a2b3}

/* ── TABLE ── */
.la-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.la-table{border-collapse:collapse;width:100%;font-size:12px;min-width:580px}
.la-table th{
  color:#667085;background:#f9fafb;text-align:left;
  font-weight:600;padding:10px 12px;
  border-bottom:1px solid #eaecf0;white-space:nowrap;
}
.la-table td{
  padding:10px 12px;border-bottom:1px solid #f0f2f7;
  vertical-align:middle;max-width:240px;
  overflow:hidden;text-overflow:ellipsis;
}
.la-table tr:last-child td{border-bottom:0}
.la-table tbody tr{transition:background .1s}
.la-table tbody tr:hover{background:#f8f9fc}
.la-table-actions{display:flex;gap:4px;align-items:center;white-space:nowrap}
.la-name{font-weight:650;color:#182230;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.la-sub{font-size:11px;color:#667085;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── BADGE ── */
.la-badge{
  display:inline-flex;align-items:center;border-radius:99px;
  padding:2px 8px;font-size:10px;font-weight:650;
  text-transform:capitalize;white-space:nowrap;
}
.la-badge.is-positive{background:#ecfdf3;color:#027a48;border:1px solid #a9efc5}
.la-badge.is-negative{background:#fff1f3;color:#c01048;border:1px solid #fecdca}
.la-badge.is-warning{background:#fffaeb;color:#b54708;border:1px solid #fedf89}
.la-badge.is-neutral{background:#f2f4f7;color:#475467;border:1px solid #e4e7ec}

/* ── EMPTY STATE ── */
.la-empty{
  padding:48px 24px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.la-empty-icon{font-size:28px;color:#d0d5dd}
.la-empty h3{font-size:15px;font-weight:700;color:#344054;margin:0}
.la-empty p{color:#667085;font-size:13px;max-width:380px;margin:0;line-height:1.6}

/* ── SKELETON ── */
.la-skeleton{
  height:13px;border-radius:5px;
  background:linear-gradient(90deg,#f2f4f7 25%,#e8eaf0 37%,#f2f4f7 63%);
  background-size:400% 100%;
  animation:la-shimmer 1.4s ease infinite;
  margin:8px 0;
}
.la-skeleton.w75{width:75%}.la-skeleton.w55{width:55%}.la-skeleton.w40{width:40%}
@keyframes la-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}
.la-loading{padding:24px;display:flex;flex-direction:column;gap:4px}

/* ── PAGINATION ── */
.la-pagination{
  display:flex;justify-content:space-between;align-items:center;
  padding:12px 14px;border-top:1px solid #f0f2f7;
  color:#667085;font-size:12px;flex-wrap:wrap;gap:8px;
}
.la-pagination-controls{display:flex;gap:6px}

/* ── DIALOG ── */
.la-dialog-backdrop{
  position:fixed;inset:0;background:rgba(16,24,40,.5);
  display:flex;align-items:center;justify-content:center;
  padding:16px;z-index:10020;
  animation:la-fade-in .15s ease;
}
.la-dialog{
  background:#fff;border-radius:12px;
  box-shadow:0 20px 60px rgba(16,24,40,.25);
  width:min(540px,100%);max-height:calc(100vh - 32px);
  overflow:auto;animation:la-scale-in .15s ease;
}
.la-dialog-head{
  padding:18px 20px;border-bottom:1px solid #eaecf0;
  display:flex;align-items:center;justify-content:space-between;
  position:sticky;top:0;background:#fff;z-index:1;
}
.la-dialog-head h2{font-size:16px;font-weight:700;margin:0;color:#111827}
.la-dialog-body{padding:20px}
.la-dialog-footer{
  padding:14px 20px;border-top:1px solid #eaecf0;
  display:flex;justify-content:flex-end;gap:8px;
  position:sticky;bottom:0;background:#fff;
}
.la-field{display:block;margin-bottom:14px}
.la-field>span{display:block;font-size:12px;font-weight:600;color:#344054;margin-bottom:5px}
.la-field small{display:block;color:#667085;font-size:11px;margin-top:3px}
.la-checkbox{display:flex!important;gap:8px;align-items:center;flex-direction:row!important}
.la-checkbox span{margin:0!important;font-weight:500!important}
.la-checkbox input{width:15px;height:15px;cursor:pointer}

/* ── TOAST ── */
.la-toast-stack{
  position:fixed;right:18px;bottom:18px;z-index:10030;
  width:min(380px,calc(100vw - 36px));
  display:flex;flex-direction:column;gap:8px;
  pointer-events:none;
}
.la-toast{
  padding:12px 14px;border-radius:9px;
  box-shadow:0 8px 24px rgba(16,24,40,.14);
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  font-size:12px;background:#fff;border:1px solid #e4e7ec;
  pointer-events:all;
  animation:la-toast-in .2s ease;
}
.la-toast.success{border-color:#a9efc5;background:#f6fef9}
.la-toast.error{border-color:#fecdca;background:#fff7f6}
.la-toast.info{border-color:#b2ddff;background:#f0f9ff}
.la-toast-msg{line-height:1.45;flex:1;color:#344054}
.la-toast-close{
  background:none;border:none;cursor:pointer;
  font-size:14px;color:#98a2b3;padding:2px;
  flex-shrink:0;line-height:1;
}
.la-toast-close:hover{color:#475467}

/* ── MISC ── */
.la-warning{
  padding:12px 14px;background:#fffaeb;border:1px solid #fedf89;
  border-radius:8px;color:#7a2e0e;font-size:12px;line-height:1.5;
  margin-bottom:14px;
}
.la-info-box{
  padding:12px 14px;background:#f0f9ff;border:1px solid #b2ddff;
  border-radius:8px;color:#026aa2;font-size:12px;line-height:1.5;
  margin-bottom:14px;
}
.la-muted{color:#98a2b3}
.la-link{color:#4f46e5;text-decoration:none;font-weight:600}
.la-link:hover{text-decoration:underline}
.la-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #edf0f3}
.la-kv div{padding:11px;border-bottom:1px solid #edf0f3}
.la-kv span{display:block;font-size:11px;color:#667085;margin-bottom:3px}
.la-kv b{font-size:13px;color:#182230;word-break:break-word}
.la-list{list-style:none;padding:0;margin:0}
.la-list li{padding:10px 0;border-bottom:1px solid #f0f2f7;display:flex;align-items:center;justify-content:space-between;gap:12px}
.la-list li:last-child{border-bottom:0}
.la-divider{height:1px;background:#f0f2f7;margin:16px 0}
.la-tag{
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600;
  background:#f2f4f7;color:#475467;border:1px solid #e4e7ec;
}
.la-mobile-toggle{
  display:none;background:none;border:none;cursor:pointer;
  font-size:18px;color:#667085;padding:4px;
}

/* ── ANIMATIONS ── */
@keyframes la-fade-in{from{opacity:0}to{opacity:1}}
@keyframes la-scale-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes la-toast-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes la-slide-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.la-animate{animation:la-slide-in .2s ease}

/* ── RESPONSIVE ── */
@media(max-width:1100px){
  .la-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
  .la-grid.thirds{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:900px){
  .la-grid.split{grid-template-columns:1fr}
  .la-content{padding:18px 16px}
}
@media(max-width:760px){
  .la-shell{flex-direction:column}
  .la-sidebar{
    position:fixed;left:0;top:0;height:100vh;
    transform:translateX(-100%);
    box-shadow:4px 0 24px rgba(0,0,0,.25);
  }
  .la-sidebar.open{transform:translateX(0)}
  .la-mobile-toggle{display:flex}
  .la-metrics{grid-template-columns:1fr 1fr}
  .la-grid.thirds{grid-template-columns:1fr}
  .la-input{min-width:0;width:100%}
  .la-toolbar-left,.la-toolbar-right{width:100%}
  .la-toolbar-right .la-input{flex:1}
  .la-topbar{padding:0 14px}
  .la-content{padding:16px 12px}
  .la-page-topbar{flex-direction:column;align-items:flex-start}
  .la-page-actions{width:100%}
}
@media(max-width:480px){
  .la-metrics{grid-template-columns:1fr}
  .la-dialog{width:100%;border-radius:12px 12px 0 0;position:fixed;bottom:0;left:0;max-height:90vh}
  .la-dialog-backdrop{align-items:flex-end;padding:0}
}
    `;
    document.head.appendChild(s);
  }

  /* ── TOAST ── */
  function toast(message, type = 'info', undo = null) {
    let stack = el('#lifeos-admin-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'lifeos-admin-toast-stack';
      stack.className = 'la-toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = `la-toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    item.innerHTML = `<span style="font-size:14px;flex-shrink:0">${icon}</span><div class="la-toast-msg">${esc(message)}</div>`;
    if (undo) {
      const btn = document.createElement('button');
      btn.className = 'la-btn small';
      btn.type = 'button';
      btn.textContent = 'Desfazer';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const r = await post({ action: 'rollback', token: undo.token });
          toast(`Rollback: ${r.result?.restored || 0} registro(s) restaurado(s).`, 'success');
          item.remove();
          await load();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
      });
      item.appendChild(btn);
    }
    const close = document.createElement('button');
    close.className = 'la-toast-close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => item.remove());
    item.appendChild(close);
    stack.appendChild(item);
    setTimeout(() => item.remove(), undo ? 60_000 : 5_000);
  }

  /* ── HTTP ── */
  async function request(url, opts = {}) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
    const d = await r.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor.' }));
    if (!r.ok || !d.ok) throw new Error(d.error || `Erro ${r.status}.`);
    return d;
  }

  async function post(body) { return request('/api/admin-data', { method: 'POST', body: JSON.stringify(body) }); }

  /* ── SHELL ── */
  function buildShell() {
    const content = el('.content') || el('main') || el('.main-area');
    if (!content) throw new Error('Superfície administrativa indisponível.');

    // Wrap in la-shell
    const parent = content.parentElement;
    const shell = document.createElement('div');
    shell.className = 'la-shell';

    // Sidebar
    const sidebar = document.createElement('aside');
    sidebar.className = 'la-sidebar';
    sidebar.id = 'lifeos-admin-sidebar';
    sidebar.innerHTML = buildSidebarHTML();
    shell.appendChild(sidebar);

    // Main
    const main = document.createElement('div');
    main.className = 'la-main';
    main.innerHTML = `
      <header class="la-topbar">
        <button class="la-mobile-toggle" id="la-sidebar-toggle" type="button" aria-label="Menu">☰</button>
        <span class="la-topbar-title" id="la-topbar-title">Dashboard</span>
        <div class="la-topbar-actions">
          <span class="la-topbar-badge"><span class="la-topbar-dot"></span>ADMIN</span>
          <a href="/app" class="la-btn small ghost">← App</a>
          <button class="la-btn small danger" id="la-logout-btn" type="button">Sair</button>
        </div>
      </header>
      <div class="la-content" id="la-content">
        <div id="lifeos-admin-root" aria-live="polite"></div>
      </div>
    `;
    shell.appendChild(main);

    // Replace
    if (parent) {
      parent.innerHTML = '';
      parent.appendChild(shell);
      parent.className = '';
      parent.style.cssText = '';
    } else {
      document.body.appendChild(shell);
    }

    // Events
    el('#la-sidebar-toggle')?.addEventListener('click', toggleSidebar);
    el('#la-logout-btn')?.addEventListener('click', doLogout);
    shell.addEventListener('click', (e) => {
      if (e.target === shell && state.sidebarOpen) closeSidebar();
    });
  }

  function buildSidebarHTML() {
    const navItems = NAV_GROUPS.map(({ label, ids }) => `
      <div class="la-nav-group">
        <div class="la-nav-group-label">${esc(label)}</div>
        ${ids.map((id) => {
          const [, , navLabel, icon] = route(id);
          return `<button class="la-nav${state.page === id ? ' active' : ''}" type="button" data-action="navigate" data-page="${id}">
            <span class="la-nav-icon">${icon}</span><span>${esc(navLabel)}</span>
          </button>`;
        }).join('')}
      </div>
    `).join('');

    return `
      <div class="la-brand">
        <div class="la-brand-name">LIFEOS ENTERPRISE</div>
        <div class="la-brand-sub">Admin Control Plane · v${VERSION}</div>
      </div>
      ${navItems}
      <div class="la-sidebar-footer">
        <div class="la-sidebar-user">
          <div class="la-sidebar-avatar" id="la-sidebar-avatar">A</div>
          <div style="min-width:0">
            <div class="la-sidebar-uname" id="la-sidebar-uname">Admin</div>
            <div class="la-sidebar-urole">Administrador</div>
          </div>
        </div>
      </div>
    `;
  }

  function updateSidebar() {
    const sidebar = el('#lifeos-admin-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = buildSidebarHTML();
    const title = route(state.page)[2];
    const topbarTitle = el('#la-topbar-title');
    if (topbarTitle) topbarTitle.textContent = title;
  }

  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    el('#lifeos-admin-sidebar')?.classList.toggle('open', state.sidebarOpen);
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    el('#lifeos-admin-sidebar')?.classList.remove('open');
  }

  async function doLogout() {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    location.replace('/login');
  }

  /* ── VIEWS ── */
  function root() { return el('#lifeos-admin-root'); }

  function skeletonView() {
    return `<div class="la-card la-loading">
      <div class="la-skeleton w40"></div>
      <div class="la-skeleton"></div>
      <div class="la-skeleton w75"></div>
      <div class="la-skeleton w55"></div>
      <div class="la-skeleton"></div>
    </div>`;
  }

  function emptyView(title, desc, action = null) {
    return `<div class="la-card la-empty la-animate">
      <div class="la-empty-icon">◇</div>
      <h3>${esc(title)}</h3>
      <p>${esc(desc)}</p>
      ${action ? `<button type="button" class="la-btn primary" data-action="${esc(action.action)}">${esc(action.label)}</button>` : ''}
    </div>`;
  }

  function errorView(err) {
    return `<div class="la-card la-empty la-animate" style="border-color:#fecdca">
      <div class="la-empty-icon" style="color:#f97066">!</div>
      <h3 style="color:#b42318">Não foi possível carregar esta tela</h3>
      <p>${esc(err?.message || 'Ocorreu uma falha de comunicação com a API.')}</p>
      <button type="button" class="la-btn primary" data-action="refresh">↻ Tentar novamente</button>
    </div>`;
  }

  function stat(label, value, meta = '') {
    return `<div class="la-metric la-animate">
      <div class="la-metric-label">${esc(label)}</div>
      <div class="la-metric-value">${value}</div>
      ${meta ? `<div class="la-metric-meta">${meta}</div>` : ''}
    </div>`;
  }

  function pageTopbar(title, desc, actions = '') {
    return `<div class="la-page-topbar la-animate">
      <div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>
      <div class="la-page-actions">
        <button type="button" class="la-btn" data-action="refresh">↻ Atualizar</button>
        ${actions}
      </div>
    </div>`;
  }

  function toolbar({ search = true, status = true, plan = false, create = null, bulk = null, exportable = true } = {}) {
    return `<div class="la-toolbar">
      <div class="la-toolbar-left">
        ${create ? `<button class="la-btn primary" type="button" data-action="${create.action}">+ ${esc(create.label)}</button>` : ''}
        ${bulk ? `<button class="la-btn" type="button" data-action="bulk" data-bulk="${bulk}">Ação em lote</button>` : ''}
      </div>
      <div class="la-toolbar-right">
        ${search ? `<input class="la-input" id="la-search" value="${esc(state.query)}" placeholder="Pesquisar…" aria-label="Pesquisar">` : ''}
        ${status ? `<select class="la-select" id="la-status" aria-label="Status">
          <option value="">Todos os status</option>
          <option value="active" ${state.status === 'active' ? 'selected' : ''}>Ativos</option>
          <option value="suspended" ${state.status === 'suspended' ? 'selected' : ''}>Suspensos</option>
          <option value="archived" ${state.status === 'archived' ? 'selected' : ''}>Arquivados</option>
          <option value="pending" ${state.status === 'pending' ? 'selected' : ''}>Pendentes</option>
        </select>` : ''}
        ${plan ? `<select class="la-select" id="la-plan" aria-label="Plano">
          <option value="">Todos os planos</option>
          ${state.cache.plans.map((p) => `<option value="${esc(p.name || p.id)}" ${state.plan === (p.name || p.id) ? 'selected' : ''}>${esc(p.name || p.id)}</option>`).join('')}
        </select>` : ''}
        ${exportable ? `<button class="la-btn" type="button" data-action="export">↓ Exportar</button>` : ''}
      </div>
    </div>`;
  }

  function paginationBar(payload) {
    const pg = payload?.pagination;
    if (!pg) return '';
    return `<div class="la-pagination">
      <span>${fmtNum(pg.total)} registro(s) · página ${pg.page} de ${pg.totalPages}</span>
      <div class="la-pagination-controls">
        <button class="la-btn small" type="button" data-action="page" data-direction="previous" ${pg.hasPrevious ? '' : 'disabled'}>← Anterior</button>
        <button class="la-btn small" type="button" data-action="page" data-direction="next" ${pg.hasNext ? '' : 'disabled'}>Próxima →</button>
      </div>
    </div>`;
  }

  function tableView(headers, rows, payload) {
    if (!rows.length) return emptyView('Nenhum registro encontrado', 'Não há dados para os filtros atuais. Ajuste a pesquisa ou crie o primeiro registro.');
    return `<div class="la-card la-animate">
      <div class="la-table-wrap">
        <table class="la-table">
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      ${paginationBar(payload)}
    </div>`;
  }

  /* ── PAGE RENDERERS ── */
  function renderDashboard(data) {
    const m = obj(data?.metrics || data);
    const audit = arr(data?.recentAudit);
    return `${pageTopbar('Dashboard Executivo', 'Visão consolidada da operação enterprise com dados persistidos no Cloudflare KV.')}
    <div class="la-metrics">
      ${stat('Usuários ativos', esc(fmtNum(m.activeUsers)), `${fmtNum(m.totalUsers)} usuários no total`)}
      ${stat('Organizações', esc(fmtNum(m.totalOrganizations)), `${fmtNum(m.totalWorkspaces)} workspaces`)}
      ${stat('CRM — Oportunidades', esc(fmtNum(m.crmOpenDeals)), `${fmtNum(m.crmContacts)} contatos`)}
      ${stat('MRR', fmtMoney(m.mrr), m.arr != null ? `ARR ${fmtMoney(m.arr)}` : 'ARR não disponível')}
    </div>
    <div class="la-grid split">
      <div class="la-card">
        <div class="la-card-header"><span class="la-card-title">Atividade auditável recente</span></div>
        <div style="padding:0 18px">
          ${audit.length ? `<ul class="la-list">${audit.slice(0, 8).map((a) => `
            <li>
              <div style="min-width:0">
                <div class="la-name">${esc(a.action || 'Operação')}</div>
                <div class="la-sub">${esc(a.detail || a.target || '')}</div>
              </div>
              <div class="la-sub" style="flex-shrink:0">${fmtDate(a.at)}</div>
            </li>`).join('')}</ul>` :
            `<div class="la-empty" style="padding:28px 0"><div class="la-empty-icon">◷</div><h3>Sem atividade registrada</h3><p>As próximas ações realizadas aparecerão nesta trilha.</p></div>`}
        </div>
      </div>
      <div class="la-card">
        <div class="la-card-header"><span class="la-card-title">Prontidão de infraestrutura</span></div>
        <div class="la-kv">
          <div><span>Cloudflare KV</span><b>${m.systemMetrics ? '✓ Disponível' : 'Sem telemetria'}</b></div>
          <div><span>Pipeline</span><b>Cloudflare Pages</b></div>
          <div><span>Dados coletados em</span><b>${fmtDate(m.collectedAt)}</b></div>
          <div><span>Receita total</span><b>${fmtMoney(m.totalRevenue)}</b></div>
        </div>
        <div style="padding:14px 18px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="la-btn primary" type="button" data-action="navigate" data-page="analytics">Ver Analytics →</button>
          <button class="la-btn" type="button" data-action="navigate" data-page="users">Usuários</button>
        </div>
      </div>
    </div>`;
  }

  function renderAnalytics(data) {
    const m = obj(data?.metrics || data);
    const plans = obj(m.plans);
    const planRows = Object.entries(plans).map(([name, count]) =>
      `<tr><td><span class="la-name">${esc(name)}</span></td><td>${fmtNum(count)}</td></tr>`);
    return `${pageTopbar('Analytics', 'Métricas calculadas a partir das entidades persistidas, sem dados de demonstração.')}
    <div class="la-metrics">
      ${stat('Contatos CRM', esc(fmtNum(m.crmContacts)))}
      ${stat('Oportunidades abertas', esc(fmtNum(m.crmOpenDeals)))}
      ${stat('Pipeline comercial', Number(m.crmPipelineValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}
      ${stat('Churn', m.churnRate != null ? `${m.churnRate}%` : '—')}
    </div>
    <div class="la-card la-animate">
      <div class="la-card-header"><span class="la-card-title">Distribuição de planos</span></div>
      <div style="padding:18px">
        ${planRows.length ?
          `<table class="la-table"><thead><tr><th>Plano</th><th>Usuários</th></tr></thead><tbody>${planRows.join('')}</tbody></table>` :
          `<div class="la-empty" style="padding:24px 0"><div class="la-empty-icon">◇</div><h3>Sem distribuição disponível</h3><p>Os dados aparecerão após a criação de planos e assinaturas.</p><button class="la-btn primary" type="button" data-action="navigate" data-page="plans">Criar plano</button></div>`}
      </div>
    </div>`;
  }

  function renderUsers(payload) {
    const items = arr(payload.data);
    const rows = items.map((u) => `<tr>
      <td><input type="checkbox" data-select="user" data-value="${esc(u.email)}" aria-label="Selecionar ${esc(u.email)}"></td>
      <td><div class="la-name">${esc(u.name)}</div><div class="la-sub">${esc(u.email)}</div></td>
      <td>${badge(u.status)}</td>
      <td><span class="la-tag">${esc(text(u.role))}</span></td>
      <td>${esc(text(u.plan))}</td>
      <td>${fmtDate(u.lastLoginAt || u.createdAt)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="edit-user" data-email="${esc(u.email)}" type="button">✎ Editar</button>
        <button class="la-btn small" data-action="toggle-user" data-email="${esc(u.email)}" data-status="${esc(u.status)}" type="button">${u.status === 'suspended' ? '▶ Reativar' : '⏸ Suspender'}</button>
        <button class="la-btn small danger" data-action="delete-user" data-email="${esc(u.email)}" type="button">⌫</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Usuários', 'Gestão integral de contas, status, perfis e acesso à plataforma.', `<button class="la-btn primary" type="button" data-action="invite-user">+ Convidar usuário</button>`)}
    ${toolbar({ plan: true, create: null, bulk: 'users' })}
    ${tableView(['', 'Usuário', 'Status', 'Papel', 'Plano', 'Última atividade', 'Ações'], rows, payload)}`;
  }

  function renderOrganizations(payload) {
    const rows = arr(payload.data).map((o) => `<tr>
      <td><input type="checkbox" data-select="organization" data-value="${esc(o.id)}" aria-label="Selecionar ${esc(o.name)}"></td>
      <td><div class="la-name">${esc(o.name)}</div><div class="la-sub">${esc(o.id)}</div></td>
      <td>${badge(o.status)}</td>
      <td>${esc(text(o.plan))}</td>
      <td>${fmtNum(o.activeMemberCount)} / ${fmtNum(o.memberCount)}</td>
      <td>${fmtNum(o.workspaceCount)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="edit-org" data-id="${esc(o.id)}" type="button">✎</button>
        <button class="la-btn small" data-action="toggle-org" data-id="${esc(o.id)}" data-status="${esc(o.status)}" type="button">${o.status === 'suspended' ? '▶' : '⏸'}</button>
        <button class="la-btn small danger" data-action="archive-org" data-id="${esc(o.id)}" type="button">⌫</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Organizações', 'CRUD empresarial de tenants, planos, capacidade e estado operacional.', `<button class="la-btn primary" type="button" data-action="create-org">+ Nova organização</button>`)}
    ${toolbar({ plan: true, bulk: 'organizations' })}
    ${tableView(['', 'Organização', 'Status', 'Plano', 'Membros ativos', 'Workspaces', 'Ações'], rows, payload)}`;
  }

  function renderWorkspaces(payload) {
    const rows = arr(payload.data).map((w) => `<tr>
      <td><input type="checkbox" data-select="workspace" data-value="${esc(`${w.organizationId}|${w.id}`)}" aria-label="Selecionar ${esc(w.name)}"></td>
      <td><div class="la-name">${esc(w.name)}</div><div class="la-sub">${esc(w.organizationName)}</div></td>
      <td>${badge(w.status)}</td>
      <td><span class="la-tag">${esc(text(w.type))}</span></td>
      <td>${fmtNum(w.memberCount)}</td>
      <td>${fmtDate(w.updatedAt)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="edit-workspace" data-org="${esc(w.organizationId)}" data-id="${esc(w.id)}" type="button">✎</button>
        <button class="la-btn small danger" data-action="archive-workspace" data-org="${esc(w.organizationId)}" data-id="${esc(w.id)}" type="button" ${w.protected ? 'disabled title="Workspace principal protegido"' : ''}>⌫</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Workspaces', 'Gerenciamento de espaços de trabalho organizacionais, com auditoria e rollback.', `<button class="la-btn primary" type="button" data-action="create-workspace">+ Novo workspace</button>`)}
    ${toolbar({ status: true, bulk: 'workspaces', create: null })}
    ${tableView(['', 'Workspace', 'Status', 'Tipo', 'Membros', 'Atualizado em', 'Ações'], rows, payload)}`;
  }

  function renderPlans(payload) {
    const rows = arr(payload.data).map((p) => `<tr>
      <td><div class="la-name">${esc(p.name)}</div><div class="la-sub">${esc(p.id)}</div></td>
      <td>${p.amountCents == null ? '<span class="la-muted">Não informado</span>' : fmtMoney(p.amountCents)}</td>
      <td>${esc(text(p.interval))}</td>
      <td>${badge(p.active === false ? 'archived' : 'active')}</td>
      <td>${fmtNum(arr(p.features).length)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="edit-plan" data-id="${esc(p.id)}" type="button">✎ Editar</button>
        <button class="la-btn small danger" data-action="archive-plan" data-id="${esc(p.id)}" type="button">⌫</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Planos', 'Catálogo interno de planos e recursos, persistido e versionado.', `<button class="la-btn primary" type="button" data-action="create-plan">+ Novo plano</button>`)}
    ${toolbar({ status: false, exportable: true, create: null })}
    ${tableView(['Plano', 'Preço', 'Periodicidade', 'Status', 'Recursos', 'Ações'], rows, payload)}`;
  }

  function renderSubscriptions(payload) {
    const rows = arr(payload.data).map((s) => `<tr>
      <td><div class="la-name">${esc(s.organizationId)}</div><div class="la-sub">${esc(s.id)}</div></td>
      <td>${esc(text(s.planId))}</td>
      <td>${badge(s.status)}</td>
      <td>${s.seats ?? '—'}</td>
      <td>${esc(text(s.provider))}</td>
      <td>${fmtDate(s.currentPeriodEnd)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="edit-subscription" data-id="${esc(s.id)}" type="button">✎ Editar</button>
        <button class="la-btn small danger" data-action="cancel-subscription" data-id="${esc(s.id)}" type="button">Cancelar</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Assinaturas', 'Controle de estados, assentos e referências de cobrança.', `<button class="la-btn primary" type="button" data-action="create-subscription">+ Nova assinatura</button>`)}
    ${toolbar({ status: true, create: null })}
    ${tableView(['Organização', 'Plano', 'Status', 'Assentos', 'Origem', 'Fim do período', 'Ações'], rows, payload)}`;
  }

  function renderBilling(payload) {
    const data = obj(payload.data);
    const stats = obj(data.stats);
    const subs = arr(data.subscriptions);
    const active = subs.filter((s) => s.status === 'active').length;
    return `${pageTopbar('Billing', 'Visão financeira baseada em estatísticas e assinaturas realmente persistidas.')}
    <div class="la-metrics">
      ${stat('MRR', fmtMoney(stats.mrr))}
      ${stat('ARR', fmtMoney(stats.arr))}
      ${stat('Receita total', fmtMoney(stats.totalRevenue))}
      ${stat('Assinaturas ativas', esc(String(active)))}
    </div>
    <div class="la-info-box">
      <strong>Pronto para ativação.</strong> Cobrança automática, webhooks e conciliação dependem exclusivamente de credenciais oficiais do provedor de pagamentos (Stripe / Mercado Pago).
    </div>
    <div class="la-card la-animate">
      <div class="la-card-header">
        <div><div class="la-card-title">Assinaturas persistidas</div><div class="la-card-sub">Use a área de assinaturas para criação, alteração e cancelamento auditável.</div></div>
        <button type="button" class="la-btn primary" data-action="navigate" data-page="subscriptions">Gerenciar assinaturas →</button>
      </div>
    </div>`;
  }

  function renderCRM(payload) {
    const rows = arr(payload.data).map((c) => `<tr>
      <td><div class="la-name">${esc(c.organizationName)}</div><div class="la-sub">${esc(c.workspaceName)}</div></td>
      <td>${fmtNum(c.contacts)}</td>
      <td>${fmtNum(c.openDeals)} / ${fmtNum(c.deals)}</td>
      <td>${Number(c.pipelineValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td>${fmtNum(c.agendaItems)}</td>
      <td>${fmtDate(c.updatedAt)}</td>
    </tr>`);
    return `${pageTopbar('CRM', 'Consolidação do CRM operacional por organização e workspace.', `<a class="la-btn primary" href="/app#crm">Abrir CRM operacional →</a>`)}
    <div class="la-toolbar"><div class="la-toolbar-right"><button type="button" class="la-btn" data-action="export">↓ Exportar</button></div></div>
    ${tableView(['Organização / Workspace', 'Contatos', 'Oportunidades', 'Pipeline', 'Agenda', 'Atualizado em'], rows, payload)}`;
  }

  function renderAudit(payload) {
    const rows = arr(payload.data).map((e) => `<tr>
      <td><div class="la-name">${esc(e.action)}</div><div class="la-sub">${esc(e.source || '')}</div></td>
      <td>${esc(text(e.actor))}</td>
      <td>${esc(text(e.target))}</td>
      <td style="max-width:200px">${esc(text(e.detail))}</td>
      <td>${fmtDate(e.at)}</td>
    </tr>`);
    return `${pageTopbar('Auditoria', 'Trilha imutável de ações administrativas e organizacionais, com exportação.')}
    ${toolbar({ status: false, exportable: true, create: null })}
    ${tableView(['Ação', 'Ator', 'Destino', 'Detalhe', 'Data'], rows, payload)}`;
  }

  function renderLogs(payload) {
    const rows = arr(payload.data).map((e) => `<tr>
      <td>${badge(e.level)}</td>
      <td><div class="la-name">${esc(e.message)}</div><div class="la-sub">${esc(e.service)}</div></td>
      <td>${fmtDate(e.at)}</td>
      <td><span class="la-muted">${esc(Object.keys(obj(e.metadata)).join(', ') || '—')}</span></td>
    </tr>`);
    return `${pageTopbar('Logs', 'Eventos operacionais persistidos e pesquisáveis.')}
    ${toolbar({ status: false, exportable: true, create: null })}
    <div class="la-toolbar"><div class="la-toolbar-right">
      <button class="la-btn danger" type="button" data-action="clear-logs">⌫ Limpar logs persistidos</button>
    </div></div>
    ${tableView(['Nível', 'Mensagem / Serviço', 'Data', 'Metadados'], rows, payload)}`;
  }

  function renderSecurity(payload) {
    const rows = arr(payload.data).map((e) => `<tr>
      <td>${badge(e.severity)}</td>
      <td><div class="la-name">${esc(e.type)}</div><div class="la-sub">${esc(e.detail)}</div></td>
      <td>${esc(text(e.userEmail))}</td>
      <td>${fmtDate(e.at)}</td>
      <td>${e.userEmail ? `<button class="la-btn small danger" type="button" data-action="revoke-sessions" data-email="${esc(e.userEmail)}">Revogar sessões</button>` : '<span class="la-muted">—</span>'}</td>
    </tr>`);
    return `${pageTopbar('Segurança', 'Eventos de segurança, auditoria de dispositivos e revogação efetiva de sessões.')}
    ${toolbar({ status: false, exportable: true, create: null })}
    ${tableView(['Severidade', 'Evento', 'Usuário', 'Data', 'Ação'], rows, payload)}`;
  }

  function renderSystem(payload) {
    const data = obj(payload.data);
    const settings = obj(data.settings);
    const infra = obj(data.infrastructure);
    const settingEntries = Object.entries(settings).filter(([k]) => !['updatedAt', 'updatedBy'].includes(k));
    return `${pageTopbar('Sistema', 'Configurações persistidas, bindings ativos e operações de manutenção.')}
    <div class="la-metrics" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      ${stat('Ambiente', esc(data.environment || 'Não configurado'))}
      ${stat('Versão em execução', esc(data.version || 'Não configurada'))}
      ${stat('Cloudflare KV', infra.kvBound ? '✓ Vinculado' : '✗ Indisponível')}
    </div>
    <div class="la-grid split">
      <div class="la-card la-animate">
        <div class="la-card-header"><span class="la-card-title">Configurações persistidas</span></div>
        <div class="la-kv">
          ${settingEntries.length ?
            settingEntries.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</b></div>`).join('') :
            '<div style="grid-column:1/-1;padding:16px"><span class="la-muted">Nenhuma configuração persistida.</span></div>'}
        </div>
        <div style="padding:14px 18px">
          <button type="button" class="la-btn primary" data-action="edit-system">✎ Atualizar configurações</button>
        </div>
      </div>
      <div class="la-card la-animate">
        <div class="la-card-header"><span class="la-card-title">Operações controladas</span></div>
        <div style="padding:18px;display:flex;flex-direction:column;gap:8px">
          <button type="button" class="la-btn danger" data-action="clear-cache" style="justify-content:flex-start">⌫ Limpar cache</button>
          <button type="button" class="la-btn" data-action="deploy-ready" style="justify-content:flex-start">↑ Iniciar publicação</button>
        </div>
        <div class="la-info-box" style="margin:0 18px 18px">
          <strong>Pronto para ativação.</strong> O disparo remoto de publicação requer token oficial do Cloudflare configurado no ambiente.
        </div>
      </div>
    </div>`;
  }

  function renderIntegrations(payload) {
    const data = obj(payload.data);
    const connected = arr(data.connected);
    const infra = obj(data.infrastructure);
    const rows = connected.map((i) => `<tr>
      <td><div class="la-name">${esc(i.integrationId || i.id || i.key)}</div><div class="la-sub">${esc(i.key)}</div></td>
      <td>${badge(i.status)}</td>
      <td>${esc(text(i.userId))}</td>
      <td>${fmtDate(i.connectedAt)}</td>
      <td><button class="la-btn small danger" type="button" data-action="disconnect-integration" data-key="${esc(i.key)}">Desconectar</button></td>
    </tr>`);
    return `${pageTopbar('Integrações', 'Conexões persistidas e estado dos bindings da plataforma.')}
    <div class="la-metrics" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      ${stat('KV', infra.kvBound ? '✓ Vinculado' : '✗ Indisponível')}
      ${stat('R2', infra.r2Bound ? '✓ Vinculado' : 'Pronto para ativação')}
      ${stat('Conexões ativas', esc(fmtNum(connected.length)))}
    </div>
    <div class="la-info-box">
      <strong>Pronto para ativação.</strong> As conexões que exigem OAuth, pagamento, e-mail, IA ou webhooks serão ativadas automaticamente após a configuração das credenciais oficiais externas.
    </div>
    ${connected.length ?
      tableView(['Integração', 'Status', 'Usuário', 'Conectada em', 'Ação'], rows, payload) :
      `<div class="la-card la-empty la-animate">
        <div class="la-empty-icon">↔</div>
        <h3>Nenhuma integração configurada</h3>
        <p>As integrações serão listadas aqui após a configuração das credenciais externas.</p>
      </div>`}`;
  }

  function renderFeatures(payload) {
    const rows = arr(payload.data).map((f) => `<tr>
      <td><div class="la-name">${esc(f.key || f.id)}</div><div class="la-sub">${esc(f.description || '')}</div></td>
      <td>${badge(f.enabled ? 'active' : 'paused')}</td>
      <td>${fmtDate(f.updatedAt)}</td>
      <td><div class="la-table-actions">
        <button class="la-btn small" data-action="toggle-flag" data-key="${esc(f.key || f.id)}" data-enabled="${f.enabled ? 'true' : 'false'}" type="button">${f.enabled ? 'Desativar' : 'Ativar'}</button>
        <button class="la-btn small danger" data-action="delete-flag" data-key="${esc(f.key || f.id)}" type="button">⌫</button>
      </div></td>
    </tr>`);
    return `${pageTopbar('Feature Flags', 'Controles de lançamento persistidos, auditados e reversíveis.', `<button class="la-btn primary" type="button" data-action="create-flag">+ Nova feature flag</button>`)}
    ${toolbar({ status: false, create: null })}
    ${tableView(['Chave', 'Estado', 'Atualizado em', 'Ações'], rows, payload)}`;
  }

  function pageView(payload) {
    const p = state.page;
    if (p === 'overview')      return renderDashboard(payload.data);
    if (p === 'analytics')     return renderAnalytics(payload.data);
    if (p === 'users')         return renderUsers(payload);
    if (p === 'organizations') return renderOrganizations(payload);
    if (p === 'workspaces')    return renderWorkspaces(payload);
    if (p === 'plans')         return renderPlans(payload);
    if (p === 'subscriptions') return renderSubscriptions(payload);
    if (p === 'billing')       return renderBilling(payload);
    if (p === 'crm')           return renderCRM(payload);
    if (p === 'audit')         return renderAudit(payload);
    if (p === 'logs')          return renderLogs(payload);
    if (p === 'security')      return renderSecurity(payload);
    if (p === 'system')        return renderSystem(payload);
    if (p === 'integrations')  return renderIntegrations(payload);
    if (p === 'features')      return renderFeatures(payload);
    return renderDashboard(payload.data);
  }

  /* ── DATA LOADING ── */
  function updateCache(payload) {
    const r = payload.resource;
    if (r === 'organizations') state.cache.organizations = arr(payload.data);
    if (r === 'plans')         state.cache.plans         = arr(payload.data);
    if (r === 'users')         state.cache.users         = arr(payload.data);
    if (r === 'workspaces')    state.cache.workspaces    = arr(payload.data);
    if (arr(payload.users).length) state.cache.users = payload.users;
  }

  async function warmCache() {
    if (state.cache.organizations.length && state.cache.plans.length) return;
    const [orgs, plans] = await Promise.all([
      request('/api/admin-data?resource=organizations&pageSize=100').catch(() => null),
      request('/api/admin-data?resource=plans&pageSize=100').catch(() => null),
    ]);
    if (orgs?.ok)   state.cache.organizations = arr(orgs.data);
    if (plans?.ok)  state.cache.plans         = arr(plans.data);
  }

  async function load() {
    const target = root();
    if (!target) return;
    state.loading = true;
    target.innerHTML = skeletonView();
    const [, resource] = route(state.page);
    const params = new URLSearchParams({ resource, page: String(state.pageNumber), pageSize: String(state.pageSize) });
    if (state.query)  params.set('q', state.query);
    if (state.status) params.set('status', state.status);
    if (state.plan)   params.set('plan', state.plan);
    try {
      const payload = await request(`/api/admin-data?${params.toString()}`);
      state.payload = payload;
      updateCache(payload);
      target.innerHTML = pageView(payload);
      updateSidebar();
      if (['users','organizations','workspaces','plans','subscriptions'].includes(state.page)) warmCache().catch(() => {});
    } catch (err) {
      target.innerHTML = errorView(err);
    } finally {
      state.loading = false;
    }
  }

  /* ── FORMS ── */
  function fieldHtml(field) {
    const id = `la-field-${field.name}`;
    const attrs = `${field.required ? 'required' : ''} ${field.readonly ? 'readonly' : ''}`;
    if (field.type === 'textarea') return `<label class="la-field"><span>${esc(field.label)}</span><textarea id="${id}" class="la-textarea" name="${esc(field.name)}" ${attrs}>${esc(field.value ?? '')}</textarea>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    if (field.type === 'select')   return `<label class="la-field"><span>${esc(field.label)}</span><select id="${id}" class="la-select" style="width:100%" name="${esc(field.name)}" ${attrs}>${arr(field.options).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(field.value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    if (field.type === 'checkbox') return `<label class="la-field la-checkbox"><input id="${id}" type="checkbox" name="${esc(field.name)}" ${field.value ? 'checked' : ''}><span>${esc(field.label)}</span>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    return `<label class="la-field"><span>${esc(field.label)}</span><input id="${id}" class="la-input" style="width:100%" type="${esc(field.type || 'text')}" name="${esc(field.name)}" value="${esc(field.value ?? '')}" ${attrs}>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
  }

  function openForm({ title, fields, submitLabel = 'Salvar', onSubmit }) {
    el('#lifeos-admin-dialog')?.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'lifeos-admin-dialog';
    backdrop.className = 'la-dialog-backdrop';
    backdrop.innerHTML = `<div class="la-dialog" role="dialog" aria-modal="true" aria-labelledby="la-dialog-title">
      <form id="la-dialog-form">
        <div class="la-dialog-head">
          <h2 id="la-dialog-title">${esc(title)}</h2>
          <button type="button" class="la-btn ghost icon" data-action="close-dialog" aria-label="Fechar">×</button>
        </div>
        <div class="la-dialog-body">${fields.map(fieldHtml).join('')}</div>
        <div class="la-dialog-footer">
          <button type="button" class="la-btn" data-action="close-dialog">Cancelar</button>
          <button type="submit" class="la-btn primary">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(backdrop);
    const form = el('#la-dialog-form', backdrop);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = el('[type="submit"]', form);
      submit.disabled = true;
      submit.textContent = 'Salvando…';
      const values = {};
      for (const [name, value] of new FormData(form).entries()) values[name] = value;
      fields.filter((f) => f.type === 'checkbox').forEach((f) => { values[f.name] = el(`[name="${f.name}"]`, form).checked; });
      try {
        const result = await onSubmit(values);
        backdrop.remove();
        if (result?.rollback) toast('Alteração concluída. Rollback disponível por 1 hora.', 'success', result.rollback);
        else toast(result?.activation || 'Alteração concluída com sucesso.', 'success');
        await load();
      } catch (err) {
        toast(err.message, 'error');
        submit.disabled = false;
        submit.textContent = submitLabel;
      }
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onKey); } });
    // Focus first input
    setTimeout(() => el('input:not([type="checkbox"]),select,textarea', form)?.focus(), 50);
  }

  function readCurrent(type, id) {
    const list = type === 'user' ? state.cache.users : type === 'organization' ? state.cache.organizations : type === 'workspace' ? state.cache.workspaces : type === 'plan' ? state.cache.plans : [];
    return list.find((i) => i.id === id || i.email === id) || null;
  }

  async function confirmAction(message, body, target = null) {
    if (!window.confirm(message)) return null;
    if (target) target.disabled = true;
    try {
      const r = await post(body);
      const result = r.result || {};
      if (result.rollback) toast('Operação concluída. Rollback disponível por 1 hora.', 'success', result.rollback);
      else toast(result.activation || 'Operação concluída com sucesso.', 'success');
      await load();
      return result;
    } catch (err) {
      toast(err.message, 'error');
      throw err;
    } finally { if (target) target.disabled = false; }
  }

  /* ── FORM BUILDERS ── */
  function showUserForm(email = '') {
    const user = email ? readCurrent('user', email) : null;
    if (!user && email) return toast('Usuário não disponível no cache atual.', 'error');
    openForm({
      title: user ? 'Editar usuário' : 'Convidar usuário',
      submitLabel: user ? 'Salvar alterações' : 'Registrar convite',
      fields: [
        { name: 'name',   label: 'Nome',   required: true,  value: user?.name  || '' },
        { name: 'email',  label: 'E-mail', type: 'email', required: true, readonly: Boolean(user), value: user?.email || '' },
        { name: 'role',   label: 'Papel',  type: 'select', value: user?.role || 'user', options: ['admin','manager','user','viewer'].map((v) => ({ value: v, label: v })) },
        { name: 'plan',   label: 'Plano',  type: 'select', value: user?.plan || 'unassigned', options: [{ value: 'unassigned', label: 'Não atribuído' }, ...state.cache.plans.map((p) => ({ value: p.name || p.id, label: p.name || p.id }))] },
        ...(user ? [{ name: 'status', label: 'Status', type: 'select', value: user.status, options: ['active','suspended','pending_verification'].map((v) => ({ value: v, label: v })) }] : []),
      ],
      onSubmit: async (values) => (await post(user ? { action: 'user.update', ...values } : { action: 'user.invite', ...values })).result,
    });
  }

  function showOrganizationForm(id = '') {
    const org = id ? readCurrent('organization', id) : null;
    openForm({
      title: org ? 'Editar organização' : 'Nova organização',
      submitLabel: org ? 'Salvar alterações' : 'Criar organização',
      fields: [
        { name: 'name',        label: 'Nome da organização', required: true, value: org?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: org?.description || '' },
        { name: 'plan',        label: 'Plano', type: 'select', value: org?.plan || 'Unassigned', options: [{ value: 'Unassigned', label: 'Não atribuído' }, ...state.cache.plans.map((p) => ({ value: p.name || p.id, label: p.name || p.id }))] },
        ...(org ? [{ name: 'status', label: 'Status', type: 'select', value: org.status, options: ['active','suspended','archived'].map((v) => ({ value: v, label: v })) }] : [
          { name: 'ownerId',   label: 'E-mail / ID do owner', type: 'email', required: true, value: '' },
          { name: 'ownerName', label: 'Nome do owner', value: '' },
        ]),
      ],
      onSubmit: async (values) => (await post(org ? { action: 'organization.update', id: org.id, ...values } : { action: 'organization.create', ...values, ownerEmail: values.ownerId })).result,
    });
  }

  function showWorkspaceForm(orgId = '', id = '') {
    const ws = id ? readCurrent('workspace', id) : null;
    openForm({
      title: ws ? 'Editar workspace' : 'Novo workspace',
      submitLabel: ws ? 'Salvar alterações' : 'Criar workspace',
      fields: [
        ...(!ws ? [{ name: 'organizationId', label: 'Organização', type: 'select', required: true, value: orgId, options: state.cache.organizations.map((o) => ({ value: o.id, label: o.name })) }] : []),
        { name: 'name',        label: 'Nome do workspace', required: true, value: ws?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: ws?.description || '' },
        { name: 'type',        label: 'Tipo', type: 'select', value: ws?.type || 'general', options: ['general','team','project','private'].map((v) => ({ value: v, label: v })) },
        ...(ws ? [{ name: 'status', label: 'Status', type: 'select', value: ws.status, options: ['active','archived'].map((v) => ({ value: v, label: v })) }] : []),
      ],
      onSubmit: async (values) => (await post(ws ? { action: 'workspace.update', organizationId: ws.organizationId, id: ws.id, ...values } : { action: 'workspace.create', ...values })).result,
    });
  }

  function showPlanForm(id = '') {
    const plan = id ? readCurrent('plan', id) : null;
    openForm({
      title: plan ? 'Editar plano' : 'Novo plano',
      submitLabel: plan ? 'Salvar alterações' : 'Criar plano',
      fields: [
        { name: 'name',        label: 'Nome', required: true, value: plan?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: plan?.description || '' },
        { name: 'amountCents', label: 'Preço em centavos', type: 'number', value: plan?.amountCents ?? '' },
        { name: 'interval',    label: 'Periodicidade', type: 'select', value: plan?.interval || 'month', options: ['month','year','one_time'].map((v) => ({ value: v, label: v })) },
        { name: 'active',      label: 'Plano ativo', type: 'checkbox', value: plan ? plan.active !== false : true },
      ],
      onSubmit: async (values) => (await post(plan ? { action: 'plan.update', id: plan.id, ...values } : { action: 'plan.create', ...values })).result,
    });
  }

  function showSubscriptionForm(id = '') {
    const current = arr(state.payload?.data).find((s) => s.id === id) || null;
    openForm({
      title: current ? 'Editar assinatura' : 'Nova assinatura',
      submitLabel: current ? 'Salvar alterações' : 'Criar assinatura',
      fields: [
        { name: 'organizationId',    label: 'Organização', type: 'select', required: true, value: current?.organizationId || '', options: state.cache.organizations.map((o) => ({ value: o.id, label: o.name })) },
        { name: 'planId',            label: 'Plano', type: 'select', value: current?.planId || '', options: [{ value: '', label: 'Não atribuído' }, ...state.cache.plans.map((p) => ({ value: p.id, label: p.name }))] },
        { name: 'status',            label: 'Status', type: 'select', value: current?.status || 'not_configured', options: ['active','trialing','past_due','paused','cancelled','not_configured'].map((v) => ({ value: v, label: v })) },
        { name: 'seats',             label: 'Assentos', type: 'number', value: current?.seats ?? '' },
        { name: 'provider',          label: 'Origem', value: current?.provider || 'manual', help: 'Use o provedor oficial somente após configurar as credenciais.' },
        { name: 'externalReference', label: 'Referência externa', value: current?.externalReference || '' },
      ],
      onSubmit: async (values) => (await post(current ? { action: 'subscription.update', id: current.id, ...values } : { action: 'subscription.create', ...values })).result,
    });
  }

  function showFlagForm() {
    openForm({
      title: 'Nova feature flag', submitLabel: 'Criar flag',
      fields: [
        { name: 'key',         label: 'Chave', required: true, value: '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: '' },
        { name: 'enabled',     label: 'Ativada por padrão', type: 'checkbox', value: false },
      ],
      onSubmit: async (values) => (await post({ action: 'flag.upsert', ...values })).result,
    });
  }

  function showSystemForm() {
    const settings = obj(state.payload?.data?.settings);
    openForm({
      title: 'Atualizar configurações do sistema', submitLabel: 'Salvar configurações',
      fields: [
        { name: 'maintenanceMessage', label: 'Mensagem de manutenção', type: 'textarea', value: settings.maintenanceMessage || '' },
        { name: 'allowRegistrations', label: 'Permitir novos cadastros', type: 'checkbox', value: settings.allowRegistrations !== false },
      ],
      onSubmit: async (values) => (await post({ action: 'system.settings.update', settings: values })).result,
    });
  }

  /* ── BULK ── */
  function selected(type) {
    return all(`[data-select="${type}"]:checked`).map((i) => i.dataset.value).filter(Boolean);
  }

  async function performBulk(scope, target) {
    const values = selected(scope === 'users' ? 'user' : scope === 'organizations' ? 'organization' : 'workspace');
    if (!values.length) return toast('Selecione pelo menos um registro para a ação em lote.', 'info');
    const label = scope === 'users' ? 'suspender' : 'arquivar';
    if (!window.confirm(`Confirma ${label} ${values.length} registro(s) selecionado(s)?`)) return;
    target.disabled = true;
    let done = 0;
    try {
      for (const value of values) {
        if (scope === 'users')         await post({ action: 'user.update', email: value, status: 'suspended' });
        if (scope === 'organizations') await post({ action: 'organization.update', id: value, status: 'archived' });
        if (scope === 'workspaces')    { const [orgId, id] = value.split('|'); await post({ action: 'workspace.delete', organizationId: orgId, id }); }
        done++;
      }
      toast(`${done} registro(s) processado(s) com sucesso.`, 'success');
      await load();
    } catch (err) {
      toast(`${done} processado(s). ${err.message}`, 'error');
    } finally { target.disabled = false; }
  }

  /* ── EXPORT ── */
  function exportCurrent() {
    const rows = arr(state.payload?.data);
    const data = rows.length ? rows : [obj(state.payload?.data)];
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), page: state.page, records: data }, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
    link.download = `lifeos-${state.page}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(link.href);
    toast('Exportação preparada com os dados reais filtrados.', 'success');
  }

  /* ── EVENT HANDLERS ── */
  async function handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;

    if (action === 'navigate') {
      state.page = btn.dataset.page || 'overview';
      state.query = ''; state.status = ''; state.plan = ''; state.pageNumber = 1;
      history.replaceState({}, '', `#${state.page}`);
      closeSidebar();
      await load();
      return;
    }

    if (action === 'refresh')              return load();
    if (action === 'export')               return exportCurrent();
    if (action === 'page')                 { state.pageNumber += btn.dataset.direction === 'next' ? 1 : -1; return load(); }
    if (action === 'close-dialog')         { el('#lifeos-admin-dialog')?.remove(); return; }

    // Users
    if (action === 'invite-user')          return showUserForm();
    if (action === 'edit-user')            return showUserForm(btn.dataset.email);
    if (action === 'toggle-user')          return confirmAction(`Confirma ${btn.dataset.status === 'suspended' ? 'reativar' : 'suspender'} este usuário?`, { action: 'user.update', email: btn.dataset.email, status: btn.dataset.status === 'suspended' ? 'active' : 'suspended' }, btn);
    if (action === 'delete-user')          return confirmAction('Confirma mover este usuário para exclusão lógica? O rollback ficará disponível por uma hora.', { action: 'user.delete', email: btn.dataset.email }, btn);

    // Organizations
    if (action === 'create-org')           return showOrganizationForm();
    if (action === 'edit-org')             return showOrganizationForm(btn.dataset.id);
    if (action === 'toggle-org')           return confirmAction(`Confirma ${btn.dataset.status === 'suspended' ? 'reativar' : 'suspender'} esta organização?`, { action: 'organization.update', id: btn.dataset.id, status: btn.dataset.status === 'suspended' ? 'active' : 'suspended' }, btn);
    if (action === 'archive-org')          return confirmAction('Confirma arquivar esta organização? O rollback ficará disponível por uma hora.', { action: 'organization.delete', id: btn.dataset.id }, btn);

    // Workspaces
    if (action === 'create-workspace')     return showWorkspaceForm();
    if (action === 'edit-workspace')       return showWorkspaceForm(btn.dataset.org, btn.dataset.id);
    if (action === 'archive-workspace')    return confirmAction('Confirma arquivar este workspace? O rollback ficará disponível por uma hora.', { action: 'workspace.delete', organizationId: btn.dataset.org, id: btn.dataset.id }, btn);

    // Plans
    if (action === 'create-plan')          return showPlanForm();
    if (action === 'edit-plan')            return showPlanForm(btn.dataset.id);
    if (action === 'archive-plan')         return confirmAction('Confirma arquivar este plano? O rollback ficará disponível por uma hora.', { action: 'plan.delete', id: btn.dataset.id }, btn);

    // Subscriptions
    if (action === 'create-subscription')  return showSubscriptionForm();
    if (action === 'edit-subscription')    return showSubscriptionForm(btn.dataset.id);
    if (action === 'cancel-subscription')  return confirmAction('Confirma cancelar esta assinatura? O rollback ficará disponível por uma hora.', { action: 'subscription.cancel', id: btn.dataset.id }, btn);

    // Feature flags
    if (action === 'create-flag')          return showFlagForm();
    if (action === 'toggle-flag')          return confirmAction('Confirma alterar o estado desta feature flag?', { action: 'flag.upsert', key: btn.dataset.key, enabled: btn.dataset.enabled !== 'true' }, btn);
    if (action === 'delete-flag')          return confirmAction('Confirma remover esta feature flag?', { action: 'flag.delete', key: btn.dataset.key }, btn);

    // Logs & Security
    if (action === 'clear-logs')           return confirmAction('Confirma limpar os logs persistidos? O rollback ficará disponível por uma hora.', { action: 'logs.clear' }, btn);
    if (action === 'revoke-sessions')      return confirmAction('Confirma revogar todas as sessões deste usuário?', { action: 'security.revokeSessions', email: btn.dataset.email }, btn);

    // System
    if (action === 'edit-system')          return showSystemForm();
    if (action === 'clear-cache')          return confirmAction('Confirma limpar o cache persistido da plataforma?', { action: 'system.cache.clear' }, btn);
    if (action === 'deploy-ready')         return toast('Pronto para ativação. A publicação remota será habilitada após a configuração do token oficial do Cloudflare.', 'info');

    // Integrations
    if (action === 'disconnect-integration') return confirmAction('Confirma desconectar esta integração? O rollback ficará disponível por uma hora.', { action: 'integration.disconnect', key: btn.dataset.key }, btn);

    // Bulk
    if (action === 'bulk')                 return performBulk(btn.dataset.bulk, btn);
  }

  function handleFilter(e) {
    const t = e.target;
    if (t.id === 'la-search')  { clearTimeout(handleFilter._t); handleFilter._t = setTimeout(() => { state.query = t.value.trim(); state.pageNumber = 1; load(); }, 280); }
    if (t.id === 'la-status')  { state.status = t.value; state.pageNumber = 1; load(); }
    if (t.id === 'la-plan')    { state.plan   = t.value; state.pageNumber = 1; load(); }
  }

  /* ── BOOT ── */
  async function boot() {
    try {
      const session = await fetch('/api/session', { credentials: 'same-origin' }).then((r) => r.json());
      if (!session?.ok || session.user?.role !== 'admin') return;

      injectStyle();
      buildShell();

      // Set user info
      const uname = session.user?.username || session.user?.name || 'Admin';
      const avatar = el('#la-sidebar-avatar');
      const unameEl = el('#la-sidebar-uname');
      if (avatar) avatar.textContent = uname.charAt(0).toUpperCase();
      if (unameEl) unameEl.textContent = uname;

      const hash = location.hash.replace(/^#/, '');
      if (NAVIGATION.some(([id]) => id === hash)) state.page = hash;

      document.addEventListener('click', handleClick);
      document.addEventListener('input', handleFilter);
      document.addEventListener('change', handleFilter);

      await load();
    } catch (err) {
      console.error('[LifeOS Admin] Boot error:', err);
    }
  }

  window.LifeosAdminCompletion = { boot, load, version: VERSION };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
