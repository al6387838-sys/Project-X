#!/usr/bin/env python3
"""Remove hardcoded static content from enterprise-command section."""

with open('premium_ui/enterprise/enterprise_premium.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The hardcoded content starts after the alert-banner closing div and goes to </section>
start_marker = '      </div>\n      <div class="kpi-grid">'
end_marker = '      </div>\n      </section>\n      <section id="enterprise-dynamic"'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f'Markers not found: start={start_idx}, end={end_idx}')
    exit(1)

# Replace the hardcoded block with a loading placeholder
# Keep the closing </div> from end_marker
replacement = '\n      </section>\n      <section id="enterprise-dynamic"'

new_content = content[:start_idx] + replacement + content[end_idx + len(end_marker):]

with open('premium_ui/enterprise/enterprise_premium.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f'Done. Removed {end_idx - start_idx} chars of hardcoded content.')
print(f'New file size: {len(new_content)} chars')
