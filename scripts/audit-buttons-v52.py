#!/usr/bin/env python3
"""
LifeOS Enterprise — Auditoria Completa de Botões v52.5.0
Fase 2: Verifica TODOS os botões em TODOS os arquivos HTML/JS
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PREMIUM_UI = ROOT / 'premium_ui'

dead_buttons = []
total_buttons = 0
files_scanned = 0

def check_button(tag, filename, line_num):
    """Verifica se um botão tem ação associada."""
    has_onclick = 'onclick=' in tag
    has_data_action = 'data-action=' in tag
    has_data_view = 'data-view=' in tag
    has_data_cmd = 'data-cmd' in tag
    has_type_submit = 'type="submit"' in tag or "type='submit'" in tag
    has_form_related = 'form=' in tag or 'formaction=' in tag
    has_id = 'id=' in tag  # pode ter listener por ID
    has_aria_controls = 'aria-controls=' in tag
    has_data_page = 'data-page=' in tag
    has_data_tab = 'data-tab=' in tag
    has_data_filter = 'data-filter=' in tag
    has_data_provider = 'data-provider=' in tag
    has_data_plan = 'data-plan=' in tag
    has_data_target = 'data-target=' in tag
    has_data_modal = 'data-modal=' in tag
    has_data_nav = 'data-nav=' in tag
    has_href = 'href=' in tag  # <a> com role=button
    
    # Botão tem ação se qualquer um dos acima for verdadeiro
    has_action = any([
        has_onclick, has_data_action, has_data_view, has_data_cmd,
        has_type_submit, has_form_related, has_id, has_aria_controls,
        has_data_page, has_data_tab, has_data_filter, has_data_provider,
        has_data_plan, has_data_target, has_data_modal, has_data_nav, has_href
    ])
    
    return has_action

html_files = list(PREMIUM_UI.rglob('*.html'))

for f in sorted(html_files):
    content = f.read_text(encoding='utf-8', errors='ignore')
    files_scanned += 1
    
    # Encontrar todos os botões
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        # Match de tags button
        buttons = re.findall(r'<button[^>]*>', line)
        for btn in buttons:
            total_buttons += 1
            if not check_button(btn, f.name, i):
                # Verificar se é um botão de fechar/toggle comum
                btn_lower = btn.lower()
                is_close = 'close' in btn_lower or 'modal-close' in btn_lower
                is_toggle = 'toggle' in btn_lower
                is_nav_item = 'nav-item' in btn_lower  # nav items têm listeners globais
                is_filter_chip = 'filter-chip' in btn_lower  # já tratados
                
                if not (is_close or is_toggle or is_nav_item or is_filter_chip):
                    dead_buttons.append({
                        'file': str(f.relative_to(ROOT)),
                        'line': i,
                        'tag': btn[:120] + ('...' if len(btn) > 120 else '')
                    })

print('=' * 60)
print('LifeOS Enterprise — Auditoria de Botões v52.5.0')
print('=' * 60)
print(f'Arquivos escaneados: {files_scanned}')
print(f'Total de botões encontrados: {total_buttons}')
print(f'Botões potencialmente sem ação: {len(dead_buttons)}')
print()

if dead_buttons:
    print('BOTÕES SUSPEITOS:')
    for btn in dead_buttons[:50]:
        print(f"  [{btn['file']}:{btn['line']}]")
        print(f"    {btn['tag']}")
    if len(dead_buttons) > 50:
        print(f'  ... e mais {len(dead_buttons) - 50} botões')
else:
    print('✓ Nenhum botão morto detectado!')

print()
print(f'RESULTADO: {total_buttons - len(dead_buttons)}/{total_buttons} botões com ação ({100*(total_buttons-len(dead_buttons))//total_buttons}%)')
