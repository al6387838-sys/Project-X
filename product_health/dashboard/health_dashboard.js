/* ═══════════════════════════════════════════════════════════════
   LifeOS — Health Intelligence Dashboard
   EXECUTION-005 | PROJECT-X PHASE 5
   ═══════════════════════════════════════════════════════════════ */

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────
let DATA = null;
let HISTORY = null;
let charts = {};

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderAll();
    startClock();
    setupNavigation();
});

// ─── DATA LOADING ──────────────────────────────────────────────────────────
async function loadData() {
    try {
        const [scoreRes, histRes] = await Promise.all([
            fetch('/product_health/data/dashboard_data.json'),
            fetch('/product_health/data/history_data.json'),
        ]);
        DATA = await scoreRes.json();
        HISTORY = histRes || { product: {}, platform: {}, ai: {}, sig: {}, business: {}, security: {} };
    } catch (e) {
        console.warn('Fallback: using embedded mock data', e);
        DATA = generateMockData();
        HISTORY = generateMockHistory();
    }
}

function generateMockData() {
    return {
        overall_score: 82.0,
        scores: {
            product: { domain: 'product', score: 89, label: 'BOM', trend: 'stable', components: { test_pass_rate: 100, code_coverage: 94.2, bug_health: 86, crash_health: 96, adoption_rate: 67, churn_health: 76, response_health: 90, feature_completion: 71 } },
            platform: { domain: 'platform', score: 77, label: 'BOM', trend: 'stable', components: { uptime: 99.94, cpu_health: 66, memory_health: 39, disk_health: 72, latency_health: 62, error_health: 84, crash_health: 90 } },
            ai: { domain: 'ai', score: 69, label: 'REGULAR', trend: 'stable', components: { model_availability: 57, companion_available: 100, avg_success_rate: 93, avg_accuracy: 89, latency_health: 62, sync_health: 100 } },
            sig: { domain: 'sig', score: 77, label: 'BOM', trend: 'stable', components: { node_availability: 100, avg_accuracy: 95, latency_health: 77, learning_accuracy: 94, sync_health: 96, learning_cycle_health: 100 } },
            business: { domain: 'business', score: 84, label: 'BOM', trend: 'stable', components: { mrr_growth: 85, churn_health: 88, ltv_cac_health: 84, nps_health: 100, activation_health: 67, k_factor_health: 34 } },
            security: { domain: 'security', score: 96, label: 'EXCELENTE', trend: 'stable', components: { security_score: 94, vuln_health: 90, certificates_health: 100, mfa_health: 100, encryption_health: 100, audit_health: 100 } },
        },
        services: [
            { name: 'API Gateway', status: 'online', uptime_percent: 100, latency_avg_ms: 12, error_rate_percent: 0.01, crash_count_24h: 0 },
            { name: 'Life Kernel', status: 'online', uptime_percent: 99.9, latency_avg_ms: 35, error_rate_percent: 0.05, crash_count_24h: 0 },
            { name: 'Intelligence Hub', status: 'online', uptime_percent: 99.9, latency_avg_ms: 312, error_rate_percent: 0.03, crash_count_24h: 0 },
            { name: 'Action Engine', status: 'online', uptime_percent: 100, latency_avg_ms: 89, error_rate_percent: 0.02, crash_count_24h: 0 },
            { name: 'Database (Primary)', status: 'online', uptime_percent: 100, latency_avg_ms: 8, error_rate_percent: 0.01, crash_count_24h: 0 },
            { name: 'Database (Replica)', status: 'online', uptime_percent: 100, latency_avg_ms: 11, error_rate_percent: 0.02, crash_count_24h: 0 },
            { name: 'Redis Cache', status: 'online', uptime_percent: 100, latency_avg_ms: 3, error_rate_percent: 0, crash_count_24h: 0 },
            { name: 'Object Storage', status: 'online', uptime_percent: 100, latency_avg_ms: 45, error_rate_percent: 0.01, crash_count_24h: 0 },
        ],
        ai_models: [
            { name: 'Companion Core', status: 'online', model_version: 'v2.4.1', latency_avg_ms: 312, requests_per_day: 4200, success_rate: 97.8, accuracy: 0.946 },
            { name: 'Decision Engine', status: 'online', model_version: 'v3.1.0', latency_avg_ms: 89, requests_per_day: 2100, success_rate: 99.2, accuracy: 0.972 },
            { name: 'Learning Engine', status: 'online', model_version: 'v2.8.3', latency_avg_ms: 445, requests_per_day: 890, success_rate: 96.5, accuracy: 0.931 },
            { name: 'Pattern Recognizer', status: 'online', model_version: 'v1.9.0', latency_avg_ms: 156, requests_per_day: 3400, success_rate: 98.1, accuracy: 0.958 },
            { name: 'Emotion Analyzer', status: 'standby', model_version: 'v0.5.0', latency_avg_ms: 0, requests_per_day: 0, success_rate: 0, accuracy: 0 },
            { name: 'Voice Interface', status: 'degraded', model_version: 'v0.3.2', latency_avg_ms: 890, requests_per_day: 120, success_rate: 82.3, accuracy: 0.823 },
            { name: 'Predictive Engine', status: 'degraded', model_version: 'v0.2.1', latency_avg_ms: 1200, requests_per_day: 50, success_rate: 78.5, accuracy: 0.785 },
        ],
        sig_nodes: [
            { name: 'SIG Core', status: 'active', version: 'v3.2.0', inference_latency_ms: 145, inference_count_24h: 12400, accuracy: 0.962, sync_status: 'synced' },
            { name: 'Inference Engine', status: 'active', version: 'v2.8.1', inference_latency_ms: 89, inference_count_24h: 8900, accuracy: 0.951, sync_status: 'synced' },
            { name: 'Model Registry', status: 'active', version: 'v3.0.0', inference_latency_ms: 23, inference_count_24h: 2100, accuracy: 0.998, sync_status: 'synced' },
            { name: 'Learning Pipeline', status: 'active', version: 'v2.5.0', inference_latency_ms: 445, inference_count_24h: 1200, accuracy: 0.946, sync_status: 'synced' },
            { name: 'Data Ingestion', status: 'active', version: 'v2.1.0', inference_latency_ms: 67, inference_count_24h: 5600, accuracy: 0.985, sync_status: 'synced' },
            { name: 'Validation Layer', status: 'active', version: 'v1.8.0', inference_latency_ms: 34, inference_count_24h: 3400, accuracy: 0.992, sync_status: 'synced' },
            { name: 'Distribution Network', status: 'active', version: 'v2.3.0', inference_latency_ms: 156, inference_count_24h: 2800, accuracy: 0.940, sync_status: 'synced' },
        ],
        alerts: [
            { alert_id: 'platform_1a2b3c', domain: 'platform', severity: 'warning', title: 'Queda de Performance — Memória', message: 'Memória em 61%. Saúde em 39/100.', timestamp: new Date().toISOString() },
            { alert_id: 'platform_4d5e6f', domain: 'platform', severity: 'warning', title: 'Aumento de Latência', message: 'Latência P95: 187ms, P99: 412ms. Saúde em 62/100.', timestamp: new Date().toISOString() },
            { alert_id: 'product_7g8h9i', domain: 'product', severity: 'warning', title: 'Acúmulo de Bugs Detectado', message: '7 bugs abertos. Saúde de bugs em 86/100.', timestamp: new Date().toISOString() },
            { alert_id: 'product_j0k1l2', domain: 'product', severity: 'warning', title: 'Performance Degradada', message: 'Tempo de resposta: 187ms. Saúde em 90/100.', timestamp: new Date().toISOString() },
            { alert_id: 'sig_m3n4o5', domain: 'sig', severity: 'warning', title: 'Problemas de Sincronização', message: '2 falhas de sync. Saúde em 96/100.', timestamp: new Date().toISOString() },
        ],
        recommendations: [
            { rec_id: 'platform_r1', domain: 'platform', priority: 1, title: 'Performance Memória Degradada', description: 'A performance caiu 61% (memória em 61%).', suggested_action: 'Revisar módulo Decision Engine — otimizar processamento batch.', module: 'Decision Engine', confidence: 0.82 },
            { rec_id: 'platform_r2', domain: 'platform', priority: 1, title: 'Latência Elevada Detectada', description: 'Latência P95: 187ms. Saúde em 62/100.', suggested_action: 'Revisar módulo API Gateway — implementar caching agressivo.', module: 'API Gateway', confidence: 0.78 },
            { rec_id: 'product_r3', domain: 'product', priority: 2, title: 'Performance Degradada', description: 'Tempo de resposta: 187ms.', suggested_action: 'Revisar módulo Life Kernel — otimizar queries.', module: 'Life Kernel', confidence: 0.85 },
            { rec_id: 'product_r4', domain: 'product', priority: 2, title: 'Acúmulo de Bugs', description: '7 bugs abertos.', suggested_action: 'Priorizar sprint de bugfixes.', module: 'Action Engine', confidence: 0.75 },
            { rec_id: 'ai_r5', domain: 'ai', priority: 2, title: 'Latência IA Elevada', description: 'Latência média elevada. Saúde em 62/100.', suggested_action: 'Revisar módulo Intelligence Hub.', module: 'Intelligence Hub', confidence: 0.80 },
            { rec_id: 'sig_r6', domain: 'sig', priority: 1, title: 'Falhas de Sincronização', description: '2 falhas de sync. Saúde em 96/100.', suggested_action: 'Verificar rede de distribuição, forçar resync.', module: 'Distribution Network', confidence: 0.85 },
        ],
    };
}

function generateMockHistory() {
    const days = 30;
    const result = { product: [], platform: [], ai: [], sig: [], business: [], security: [] };
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        const label = d.toISOString().split('T')[0];
        result.product.push({ label, value: 82 + Math.random() * 12 });
        result.platform.push({ label, value: 70 + Math.random() * 12 });
        result.ai.push({ label, value: 63 + Math.random() * 12 });
        result.sig.push({ label, value: 72 + Math.random() * 10 });
        result.business.push({ label, value: 78 + Math.random() * 10 });
        result.security.push({ label, value: 90 + Math.random() * 8 });
    }
    return result;
}

// ─── RENDER ALL ────────────────────────────────────────────────────────────
function renderAll() {
    renderOverview();
    renderProduct();
    renderPlatform();
    renderAI();
    renderSIG();
    renderBusiness();
    renderSecurity();
    renderServices();
    renderAlerts();
    renderRecommendations();
    renderHistory();
    updateCounts();
}

// ─── OVERVIEW ──────────────────────────────────────────────────────────────
function renderOverview() {
    if (!DATA) return;

    // Overall score ring
    const overall = DATA.overall_score || 82;
    const circumference = 238.76;
    const offset = circumference - (overall / 100) * circumference;
    document.getElementById('overall-ring').style.strokeDashoffset = offset;
    document.getElementById('overall-score-text').textContent = overall;
    document.getElementById('overall-grade').textContent = getGradeLabel(overall);
    document.getElementById('overall-alerts').textContent = (DATA.alerts || []).length;
    document.getElementById('overall-recs').textContent = (DATA.recommendations || []).length;

    // Score cards
    const grid = document.getElementById('scores-grid');
    grid.innerHTML = '';
    const domains = ['product', 'platform', 'ai', 'sig', 'business', 'security'];
    const icons = { product: '📦', platform: '🖥', ai: '🤖', sig: '🧠', business: '💰', security: '🔒' };
    domains.forEach(domain => {
        const s = DATA.scores[domain];
        if (!s) return;
        grid.innerHTML += `
            <div class="score-card" data-domain="${domain}">
                <div class="score-label">${icons[domain] || ''} ${capitalize(domain)}</div>
                <div class="score-value">${s.score}</div>
                <span class="score-grade grade-${getGradeClass(s.score)}">${s.label}</span>
                <div class="score-trend">${getTrendIcon(s.trend)} ${s.trend === 'up' ? 'Crescendo' : s.trend === 'down' ? 'Declinando' : 'Estável'}</div>
            </div>`;
    });

    // History chart
    renderHistoryChart('chart-history', HISTORY);

    // Alerts preview
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';
    (DATA.alerts || []).slice(0, 8).forEach(a => {
        alertsList.innerHTML += renderAlertHTML(a);
    });
}

// ─── DOMAIN PAGES ──────────────────────────────────────────────────────────
function renderDomainPage(domain, canvasId, detailsId, componentsId) {
    const s = DATA?.scores?.[domain];
    if (!s) return;

    // Components
    const compGrid = document.getElementById(componentsId);
    if (compGrid) {
        compGrid.innerHTML = '';
        Object.entries(s.components).forEach(([key, val]) => {
            const name = capitalize(key.replace('_', ' '));
            compGrid.innerHTML += `
                <div class="score-card" data-domain="${domain}">
                    <div class="score-label">${name}</div>
                    <div class="score-value" style="font-size:28px">${typeof val === 'number' ? val.toFixed(1) : val}</div>
                    <div class="score-trend">${val >= 80 ? '✔ Bom' : val >= 60 ? '⚠ Atenção' : '✘ Crítico'}</div>
                </div>`;
        });
    }

    // Details
    const det = document.getElementById(detailsId);
    if (det) {
        det.innerHTML = '';
        Object.entries(s.components).forEach(([key, val]) => {
            const name = capitalize(key.replace('_', ' '));
            const color = val >= 80 ? 'var(--health-excellent)' : val >= 60 ? 'var(--health-regular)' : 'var(--health-critical)';
            det.innerHTML += `
                <div class="metric-bar">
                    <div class="metric-bar-label">${name}</div>
                    <div class="metric-bar-track"><div class="metric-bar-fill" style="width:${Math.min(100,val)}%;background:${color}"></div></div>
                    <div class="metric-bar-value">${typeof val === 'number' ? val.toFixed(1) : val}</div>
                </div>`;
        });
    }

    // Chart
    if (canvasId && HISTORY) {
        const histData = HISTORY[domain] || [];
        renderHistoryChart(canvasId, { [domain]: histData }, domain);
    }
}

function renderProduct() { renderDomainPage('product', 'chart-product', 'product-details', 'product-components'); }
function renderPlatform() { renderDomainPage('platform', 'chart-platform', 'platform-details', 'platform-components'); }
function renderAI() {
    renderDomainPage('ai', 'chart-ai', 'ai-components', 'ai-components');
    // AI models table
    const tbl = document.getElementById('ai-models-table');
    if (tbl && DATA?.ai_models) {
        tbl.innerHTML = `<thead><tr><th>Modelo</th><th>Status</th><th>Versão</th><th>Latência</th><th>Req/dia</th><th>Sucesso</th><th>Precisão</th></tr></thead><tbody>`;
        DATA.ai_models.forEach(m => {
            tbl.innerHTML += `<tr>
                <td style="color:var(--text-primary);font-weight:500">${m.name}</td>
                <td>${renderStatusBadge(m.status)}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${m.model_version}</td>
                <td>${m.latency_avg_ms}ms</td>
                <td>${m.requests_per_day.toLocaleString()}</td>
                <td>${m.success_rate}%</td>
                <td>${(m.accuracy * 100).toFixed(1)}%</td>
            </tr>`;
        });
        tbl.innerHTML += '</tbody>';
    }
}
function renderSIG() {
    renderDomainPage('sig', 'chart-sig', 'sig-components', 'sig-components');
    const tbl = document.getElementById('sig-nodes-table');
    if (tbl && DATA?.sig_nodes) {
        tbl.innerHTML = `<thead><tr><th>Nó</th><th>Status</th><th>Versão</th><th>Latência</th><th>Inferências/dia</th><th>Precisão</th><th>Sync</th></tr></thead><tbody>`;
        DATA.sig_nodes.forEach(n => {
            tbl.innerHTML += `<tr>
                <td style="color:var(--text-primary);font-weight:500">${n.name}</td>
                <td>${renderStatusBadge(n.status === 'active' ? 'online' : n.status)}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${n.version}</td>
                <td>${n.inference_latency_ms}ms</td>
                <td>${n.inference_count_24h.toLocaleString()}</td>
                <td>${(n.accuracy * 100).toFixed(1)}%</td>
                <td>${n.sync_status === 'synced' ? '<span class="status-badge status-online"><span class="status-dot"></span>Sincronizado</span>' : '<span class="status-badge status-degraded"><span class="status-dot"></span>Dessincronizado</span>'}</td>
            </tr>`;
        });
        tbl.innerHTML += '</tbody>';
    }
}
function renderBusiness() { renderDomainPage('business', 'chart-business', 'business-details', 'business-components'); }
function renderSecurity() { renderDomainPage('security', 'chart-security', 'security-details', 'security-components'); }

// ─── SERVICES ──────────────────────────────────────────────────────────────
function renderServices() {
    const tbody = document.getElementById('services-tbody');
    if (!tbody || !DATA?.services) return;
    tbody.innerHTML = '';
    DATA.services.forEach(svc => {
        tbody.innerHTML += `<tr>
            <td style="color:var(--text-primary);font-weight:500">${svc.name}</td>
            <td>${renderStatusBadge(svc.status)}</td>
            <td>${svc.uptime_percent}%</td>
            <td>${svc.latency_avg_ms}ms</td>
            <td>${svc.error_rate_percent}%</td>
            <td>${svc.crash_count_24h}</td>
        </tr>`;
    });
    document.getElementById('services-total').textContent = DATA.services.length;
}

// ─── ALERTS ────────────────────────────────────────────────────────────────
function renderAlerts() {
    const list = document.getElementById('all-alerts-list');
    if (!list || !DATA?.alerts) return;
    list.innerHTML = '';
    DATA.alerts.forEach(a => {
        list.innerHTML += renderAlertHTML(a);
    });
}

function renderRecommendations() {
    const list = document.getElementById('recommendations-list');
    if (!list || !DATA?.recommendations) return;
    list.innerHTML = '';
    DATA.recommendations.forEach(r => {
        list.innerHTML += `
            <div class="rec-item priority-${r.priority}">
                <div class="rec-header">
                    <span class="rec-title">${r.title}</span>
                    <span class="rec-priority priority-${r.priority === 1 ? 'urgent' : 'high'}">${r.priority === 1 ? 'URGENTE' : 'ALTA'}</span>
                </div>
                <div class="rec-desc">${r.description}</div>
                <div class="rec-action">→ ${r.suggested_action}</div>
                <div class="rec-module">Módulo: ${r.module} · Confiança: ${(r.confidence * 100).toFixed(0)}%</div>
            </div>`;
    });
}

// ─── HISTORY ───────────────────────────────────────────────────────────────
function renderHistory() {
    if (!HISTORY) return;
    const ctx = document.getElementById('chart-full-history');
    if (!ctx) return;
    if (charts['full-history']) charts['full-history'].destroy();

    const domains = ['product', 'platform', 'ai', 'sig', 'business', 'security'];
    const colors = {
        product: '#8b5cf6', platform: '#3b82f6', ai: '#ec4899',
        sig: '#06b6d4', business: '#f59e0b', security: '#10b981'
    };

    const datasets = domains.map(d => {
        const histData = HISTORY[d] || [];
        return {
            label: capitalize(d),
            data: histData.map(h => h.value),
            borderColor: colors[d],
            backgroundColor: colors[d] + '20',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
        };
    });

    charts['full-history'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: (HISTORY.product || []).map(h => h.label),
            datasets,
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#9a9ab0', font: { size: 11 } } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', maxTicksLimit: 10 } },
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80' } },
            },
        },
    });
}

// ─── CHART RENDERING ───────────────────────────────────────────────────────
function renderHistoryChart(canvasId, history, domain) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !history) return;
    if (charts[canvasId]) charts[canvasId].destroy();

    const colors = {
        product: '#8b5cf6', platform: '#3b82f6', ai: '#ec4899',
        sig: '#06b6d4', business: '#f59e0b', security: '#10b981'
    };

    if (domain) {
        const data = history[domain] || [];
        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(h => h.label),
                datasets: [{
                    label: capitalize(domain),
                    data: data.map(h => h.value),
                    borderColor: colors[domain],
                    backgroundColor: colors[domain] + '20',
                    borderWidth: 2, pointRadius: 2, tension: 0.3,
                    fill: true,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80' } },
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80' } },
                },
            },
        });
    } else {
        // Multi-domain overview chart
        const domains = ['product', 'platform', 'ai', 'sig', 'business', 'security'];
        const datasets = domains.map(d => {
            const histData = history[d] || [];
            return {
                label: capitalize(d),
                data: histData.map(h => h.value),
                borderColor: colors[d],
                borderWidth: 2, pointRadius: 1, tension: 0.3,
            };
        });

        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: (history.product || []).map(h => h.label),
                datasets,
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#9a9ab0', font: { size: 10 } } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', maxTicksLimit: 7 } },
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80' } },
                },
            },
        });
    }
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────
function setupNavigation() {
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
            li.classList.add('active');
            const page = li.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + page)?.classList.add('active');
            document.getElementById('breadcrumb-page').textContent = li.textContent.trim();
        });
    });
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function getGradeLabel(score) {
    if (score >= 90) return 'EXCELENTE — Saúde do sistema está em nível ótimo.';
    if (score >= 75) return 'BOM — Sistema operacional com alguns pontos de atenção.';
    if (score >= 60) return 'REGULAR — Necessita monitoramento e otimização.';
    if (score >= 40) return 'ATENÇÃO — Degradação significativa detectada.';
    return 'CRÍTICO — Ação imediata necessária.';
}

function getGradeClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'regular';
    if (score >= 40) return 'attention';
    return 'critical';
}

function getTrendIcon(trend) {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
}

function renderStatusBadge(status) {
    const map = {
        online: '<span class="status-badge status-online"><span class="status-dot"></span>Online</span>',
        active: '<span class="status-badge status-online"><span class="status-dot"></span>Ativo</span>',
        degraded: '<span class="status-badge status-degraded"><span class="status-dot"></span>Degradado</span>',
        offline: '<span class="status-badge status-offline"><span class="status-dot"></span>Offline</span>',
        standby: '<span class="status-badge status-standby"><span class="status-dot"></span>Standby</span>',
    };
    return map[status] || `<span class="status-badge status-standby"><span class="status-dot"></span>${capitalize(status)}</span>`;
}

function renderAlertHTML(a) {
    const sevColor = a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info';
    const time = a.timestamp ? new Date(a.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `
        <div class="alert-item">
            <span class="alert-dot ${sevColor}"></span>
            <div class="alert-content">
                <div class="alert-title">${a.title}</div>
                <div class="alert-msg">${a.message}</div>
            </div>
            <span class="alert-time">${time}</span>
        </div>`;
}

function updateCounts() {
    const alertCount = (DATA?.alerts || []).length;
    const recCount = (DATA?.recommendations || []).length;
    document.getElementById('alert-count').textContent = alertCount;
    document.getElementById('alerts-count-badge').textContent = alertCount;
    document.getElementById('total-alerts-badge').textContent = alertCount;
    document.getElementById('recs-count-badge').textContent = recCount;
}

// ─── CLOCK ─────────────────────────────────────────────────────────────────
function startClock() {
    function update() {
        const now = new Date();
        document.getElementById('clock').textContent =
            now.toLocaleTimeString('pt-BR', { hour12: false });
    }
    update();
    setInterval(update, 1000);
}

// ─── ACTIONS ───────────────────────────────────────────────────────────────
async function refreshData() {
    document.getElementById('breadcrumb-page').textContent = 'Atualizando...';
    await loadData();
    renderAll();
}

function exportReport() {
    if (!DATA) return;
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lifeos_health_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function switchHistory(period) {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderHistory();
}
