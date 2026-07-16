#!/usr/bin/env python3
"""Gera ícones SVG e PNG para o LifeOS Enterprise (favicon, PWA icons)."""
import os
import struct
import zlib

# Diretórios
PUBLIC = os.path.join(os.path.dirname(__file__), '..', 'public')
ICONS_DIR = os.path.join(PUBLIC, 'icons')
os.makedirs(ICONS_DIR, exist_ok=True)

# SVG do ícone LifeOS (L estilizado com gradiente)
SVG_ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#0A0E14"/>
  <rect x="48" y="48" width="416" height="416" rx="80" fill="url(#g1)" opacity="0.15"/>
  <text x="256" y="340" font-family="Inter, -apple-system, sans-serif" font-size="280" font-weight="900"
        text-anchor="middle" fill="url(#g1)">L</text>
  <circle cx="380" cy="148" r="36" fill="#6366F1" opacity="0.8"/>
  <circle cx="380" cy="148" r="20" fill="#818CF8"/>
</svg>'''

# Salvar SVG
svg_path = os.path.join(ICONS_DIR, 'icon.svg')
with open(svg_path, 'w') as f:
    f.write(SVG_ICON)
print(f'SVG salvo: {svg_path}')

# Favicon SVG (simplificado)
FAVICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="#0A0E14"/>
  <text x="16" y="24" font-family="Inter, sans-serif" font-size="20" font-weight="900"
        text-anchor="middle" fill="url(#g)">L</text>
</svg>'''

favicon_svg_path = os.path.join(PUBLIC, 'favicon.svg')
with open(favicon_svg_path, 'w') as f:
    f.write(FAVICON_SVG)
print(f'Favicon SVG salvo: {favicon_svg_path}')

# Gerar PNG simples usando Pillow se disponível, senão criar PNG mínimo
try:
    from PIL import Image, ImageDraw, ImageFont
    import io

    def create_icon_png(size):
        img = Image.new('RGBA', (size, size), (10, 14, 20, 255))
        draw = ImageDraw.Draw(img)
        # Fundo arredondado
        r = size // 6
        draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=(10, 14, 20, 255))
        # Gradiente simulado com retângulo
        draw.rounded_rectangle([size//8, size//8, size*7//8, size*7//8], radius=r//2, fill=(99, 102, 241, 30))
        # Letra L
        font_size = int(size * 0.55)
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()
        draw.text((size//2, size//2), 'L', font=font, fill=(99, 102, 241, 255), anchor='mm')
        return img

    for sz in [192, 512]:
        img = create_icon_png(sz)
        path = os.path.join(ICONS_DIR, f'icon-{sz}.png')
        img.save(path, 'PNG')
        print(f'PNG {sz}x{sz} salvo: {path}')

    # Favicon ICO (16x16 e 32x32)
    img16 = create_icon_png(16)
    img32 = create_icon_png(32)
    ico_path = os.path.join(PUBLIC, 'favicon.ico')
    img32.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32)])
    print(f'Favicon ICO salvo: {ico_path}')

    # Apple touch icon
    img180 = create_icon_png(180)
    apple_path = os.path.join(ICONS_DIR, 'apple-touch-icon.png')
    img180.save(apple_path, 'PNG')
    print(f'Apple touch icon salvo: {apple_path}')

except ImportError:
    print('Pillow não disponível — gerando PNG mínimo via bytes raw')
    # PNG mínimo 1x1 como fallback
    def minimal_png(size, color=(99, 102, 241)):
        def chunk(name, data):
            c = zlib.crc32(name + data) & 0xffffffff
            return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
        ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
        raw = b''
        for _ in range(size):
            raw += b'\x00' + bytes(color) * size
        idat = zlib.compress(raw)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

    for sz in [192, 512]:
        path = os.path.join(ICONS_DIR, f'icon-{sz}.png')
        with open(path, 'wb') as f:
            f.write(minimal_png(sz))
        print(f'PNG {sz}x{sz} (mínimo) salvo: {path}')

    ico_path = os.path.join(PUBLIC, 'favicon.ico')
    with open(ico_path, 'wb') as f:
        f.write(minimal_png(32))
    print(f'Favicon ICO (mínimo) salvo: {ico_path}')

print('Ícones gerados com sucesso.')
