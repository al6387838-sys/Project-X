// LifeOS Enterprise — Finance Module Open Finance Patch
// Phase 134 — Open Finance Foundation
// Este script é injetado no módulo finance.html para usar APIs reais

(function() {
  'use strict';

  // Carregar status do Open Finance ao inicializar
  async function loadOpenFinanceStatus() {
    try {
      const res = await fetch('/api/finance/open-finance?resource=overview', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;

      // Atualizar botão de conexão Open Finance
      const connectBtn = document.querySelector('[onclick*="finance-openfinance"]');
      if (connectBtn && data.summary && data.summary.connectedBanks > 0) {
        connectBtn.textContent = `${data.summary.connectedBanks} banco(s) conectado(s)`;
      }

      // Verificar resultado de callback
      const urlParams = new URLSearchParams(window.location.search);
      const finSuccess = urlParams.get('finance_success');
      const finError = urlParams.get('finance_error');

      if (finSuccess === 'openfinance' && typeof showToast === 'function') {
        const institution = urlParams.get('institution') || 'banco';
        showToast(`${institution} conectado ao Open Finance!`, 'success');
      }
      if (finError && typeof showToast === 'function') {
        showToast(`Erro ao conectar: ${finError}`, 'error');
      }
    } catch (_) { /* ignorar */ }
  }

  // Carregar chaves PIX
  async function loadPixKeys() {
    try {
      const res = await fetch('/api/finance/pix?resource=keys', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.keys) return;

      // Atualizar lista de chaves PIX no módulo
      const pixKeysList = document.querySelector('#pix-keys-list');
      if (pixKeysList && data.keys.length > 0) {
        pixKeysList.innerHTML = data.keys.map(k => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-elevated);border-radius:8px;margin-bottom:8px">
            <div style="font-size:11px;font-weight:600;padding:3px 8px;background:rgba(59,130,246,0.15);color:var(--accent);border-radius:4px">${k.type}</div>
            <div style="flex:1;font-size:13px;font-family:monospace">${k.value}</div>
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="deletePixKey('${k.id}')">Remover</button>
          </div>
        `).join('');
      }
    } catch (_) { /* ignorar */ }
  }

  // Conectar banco via Open Finance
  window.connectOpenFinance = async function(institutionId) {
    try {
      const res = await fetch('/api/finance/open-finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'connect', institutionId }),
      });
      const data = await res.json();
      if (data.setup_required) {
        alert(`Open Finance Brasil — Configuração necessária:\n\n${data.instructions}`);
        return;
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (_) {
      if (typeof showToast === 'function') showToast('Erro ao conectar banco', 'error');
    }
  };

  // Remover chave PIX
  window.deletePixKey = async function(keyId) {
    if (!confirm('Remover esta chave PIX?')) return;
    try {
      const res = await fetch('/api/finance/pix', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'delete_key', keyId }),
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof showToast === 'function') showToast('Chave PIX removida', 'success');
        loadPixKeys();
      }
    } catch (_) { /* ignorar */ }
  };

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadOpenFinanceStatus();
      loadPixKeys();
    });
  } else {
    loadOpenFinanceStatus();
    loadPixKeys();
  }
})();
