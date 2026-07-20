/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LifeOS Enterprise Premium — Command Palette                    ║
 * ║  Version 5.0.0 | PHASE 005 — Experiência Premium               ║
 * ║  Cmd/Ctrl + K para abrir                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

class CommandPalette {
  constructor() {
    this.isOpen = false;
    this.selectedIndex = 0;
    this.commands = [
      // Dashboard
      { id: 'dashboard', label: 'Dashboard', category: 'Navigation', icon: '\u{1F4CA}', action: () => this.navigate('/dashboard') },
      { id: 'analytics', label: 'Analytics', category: 'Navigation', icon: '\u{1F4C8}', action: () => this.navigate('/analytics') },
      { id: 'users', label: 'Usuários', category: 'Navigation', icon: '\u{1F465}', action: () => this.navigate('/users') },
      { id: 'organizations', label: 'Organizações', category: 'Navigation', icon: '\u{1F3E2}', action: () => this.navigate('/organizations') },
      { id: 'billing', label: 'Faturamento', category: 'Navigation', icon: '\u{1F4B0}', action: () => this.navigate('/billing') },
      { id: 'settings', label: 'Configurações', category: 'Navigation', icon: '\u{2699}\u{FE0F}', action: () => this.navigate('/settings') },
      
      // Actions
      { id: 'new-user', label: 'Novo Usuário', category: 'Actions', icon: '\u{2795}', action: () => this.action('new-user') },
      { id: 'new-org', label: 'Nova Organização', category: 'Actions', icon: '\u{2795}', action: () => this.action('new-org') },
      { id: 'export-data', label: 'Exportar Dados', category: 'Actions', icon: '\u{1F4E5}', action: () => this.action('export-data') },
      { id: 'import-data', label: 'Importar Dados', category: 'Actions', icon: '\u{1F4E4}', action: () => this.action('import-data') },
      
      // Theme
      { id: 'theme-dark', label: 'Tema Escuro', category: 'Theme', icon: '\u{1F319}', action: () => this.setTheme('enterprise-dark') },
      { id: 'theme-light', label: 'Tema Claro', category: 'Theme', icon: '\u{2600}\u{FE0F}', action: () => this.setTheme('enterprise-light') },
      { id: 'theme-auto', label: 'Tema Automático', category: 'Theme', icon: '\u{1F504}', action: () => this.setTheme('auto') },
      
      // Help
      { id: 'help', label: 'Ajuda', category: 'Help', icon: '\u{2753}', action: () => this.action('help') },
      { id: 'docs', label: 'Documentação', category: 'Help', icon: '\u{1F4D6}', action: () => this.action('docs') },
      { id: 'shortcuts', label: 'Atalhos de Teclado', category: 'Help', icon: '\u{2328}️', action: () => this.action('shortcuts') },
      { id: 'about', label: 'Sobre', category: 'Help', icon: '\u{2139}️', action: () => this.action('about') },
    ];

    this.filteredCommands = [...this.commands];
    this.init();
  }

  init() {
    this.createHTML();
    this.attachEventListeners();
  }

  createHTML() {
    const palette = document.createElement('div');
    palette.id = 'command-palette';
    palette.className = 'command-palette';
    palette.innerHTML = `
      <div class="command-palette-backdrop"></div>
      <div class="command-palette-content">
        <div class="command-palette-header">
          <input 
            type="text" 
            class="command-palette-input" 
            placeholder="Buscar comando..." 
            autocomplete="off"
          />
          <span class="command-palette-hint">ESC para fechar</span>
        </div>
        <div class="command-palette-list"></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = this.getStyles();
    document.head.appendChild(style);
    document.body.appendChild(palette);

    this.palette = palette;
    this.input = palette.querySelector('.command-palette-input');
    this.list = palette.querySelector('.command-palette-list');
  }

  getStyles() {
    return `
      .command-palette {
        display: none;
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
      }

      .command-palette.open {
        display: flex;
      }

      .command-palette-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(var(--blur-md));
        animation: commandPaletteBackdrop var(--duration-normal) var(--ease-out) forwards;
      }

      .command-palette-content {
        position: relative;
        width: 90%;
        max-width: 600px;
        max-height: 70vh;
        background: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-2xl);
        box-shadow: var(--shadow-2xl);
        display: flex;
        flex-direction: column;
        margin: auto;
        animation: commandPaletteContent var(--duration-moderate) var(--ease-spring-smooth) forwards;
      }

      .command-palette-header {
        padding: var(--space-4);
        border-bottom: 1px solid var(--border-default);
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .command-palette-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text-primary);
        font-size: var(--text-base);
        outline: none;
        font-family: var(--font-sans);
      }

      .command-palette-input::placeholder {
        color: var(--text-tertiary);
      }

      .command-palette-hint {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        background: var(--bg-surface-1);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
      }

      .command-palette-list {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-2);
      }

      .command-palette-group {
        margin-bottom: var(--space-3);
      }

      .command-palette-group-title {
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: var(--space-2) var(--space-4);
        margin-bottom: var(--space-1);
      }

      .command-palette-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--duration-normal) var(--ease-out);
        color: var(--text-secondary);
      }

      .command-palette-item:hover,
      .command-palette-item.selected {
        background: var(--bg-surface-1);
        color: var(--text-primary);
      }

      .command-palette-item-icon {
        font-size: var(--text-lg);
        width: 24px;
        text-align: center;
      }

      .command-palette-item-content {
        flex: 1;
      }

      .command-palette-item-label {
        font-size: var(--text-base);
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }

      .command-palette-item-category {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }

      .command-palette-item-shortcut {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        background: var(--bg-surface-2);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
      }

      /* Scrollbar */
      .command-palette-list::-webkit-scrollbar {
        width: 6px;
      }

      .command-palette-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .command-palette-list::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: var(--radius-full);
      }

      .command-palette-list::-webkit-scrollbar-thumb:hover {
        background: var(--border-strong-2);
      }

      @media (max-width: 768px) {
        .command-palette-content {
          width: 95%;
          max-height: 80vh;
        }
      }
    `;
  }

  attachEventListeners() {
    // Keyboard shortcut to open
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (this.isOpen) {
        this.handleKeydown(e);
      }
    });

    // Close on backdrop click
    this.palette.querySelector('.command-palette-backdrop').addEventListener('click', () => {
      this.close();
    });

    // Input filtering
    this.input.addEventListener('input', (e) => {
      this.filter(e.target.value);
    });

    // Focus input when opened
    this.palette.addEventListener('transitionend', () => {
      if (this.isOpen) {
        this.input.focus();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.palette.classList.add('open');
    this.selectedIndex = 0;
    this.render();
    this.input.focus();
  }

  close() {
    this.isOpen = false;
    this.palette.classList.remove('open');
    this.input.value = '';
    this.filteredCommands = [...this.commands];
  }

  filter(query) {
    const q = query.toLowerCase();
    this.filteredCommands = this.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
    this.selectedIndex = 0;
    this.render();
  }

  render() {
    this.list.innerHTML = '';
    const grouped = this.groupByCategory();

    Object.entries(grouped).forEach(([category, commands]) => {
      const group = document.createElement('div');
      group.className = 'command-palette-group';

      const title = document.createElement('div');
      title.className = 'command-palette-group-title';
      title.textContent = category;
      group.appendChild(title);

      commands.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = 'command-palette-item';
        if (this.getGlobalIndex(cmd) === this.selectedIndex) {
          item.classList.add('selected');
        }

        item.innerHTML = `
          <span class="command-palette-item-icon">${cmd.icon}</span>
          <div class="command-palette-item-content">
            <div class="command-palette-item-label">${cmd.label}</div>
            <div class="command-palette-item-category">${cmd.category}</div>
          </div>
        `;

        item.addEventListener('click', () => {
          this.execute(cmd);
        });

        item.addEventListener('mouseenter', () => {
          this.selectedIndex = this.getGlobalIndex(cmd);
          this.render();
        });

        group.appendChild(item);
      });

      this.list.appendChild(group);
    });
  }

  groupByCategory() {
    const grouped = {};
    this.filteredCommands.forEach(cmd => {
      if (!grouped[cmd.category]) {
        grouped[cmd.category] = [];
      }
      grouped[cmd.category].push(cmd);
    });
    return grouped;
  }

  getGlobalIndex(cmd) {
    return this.filteredCommands.indexOf(cmd);
  }

  handleKeydown(e) {
    switch (e.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.render();
        this.scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.render();
        this.scrollToSelected();
        break;
      case 'Enter':
        e.preventDefault();
        const selected = this.filteredCommands[this.selectedIndex];
        if (selected) {
          this.execute(selected);
        }
        break;
    }
  }

  scrollToSelected() {
    const selected = this.list.querySelector('.command-palette-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  execute(cmd) {
    cmd.action();
    this.close();
    this.showToast(`Executado: ${cmd.label}`);
  }

  navigate(path) {
    window.location.href = path;
  }

  action(action) {
    // [removed]
    // Implementar ações específicas
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.showToast(`Tema alterado para: ${theme}`);
  }

  showToast(message) {
    const stack = document.querySelector('.enterprise-toast-stack') || this.createToastStack();
    const toast = document.createElement('div');
    toast.className = 'enterprise-toast';
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  createToastStack() {
    const stack = document.createElement('div');
    stack.className = 'enterprise-toast-stack';
    document.body.appendChild(stack);
    return stack;
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CommandPalette();
  });
} else {
  new CommandPalette();
}
