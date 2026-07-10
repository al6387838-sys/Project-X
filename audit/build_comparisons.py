from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / "screenshots" / "before"
AFTER = ROOT / "screenshots" / "after"
OUT = ROOT / "comparisons"
OUT.mkdir(parents=True, exist_ok=True)

screens = [
    ("dashboard", "Dashboard"),
    ("companion", "Companion"),
    ("missions", "Mission Center"),
    ("timeline", "Timeline"),
    ("life-graph", "Life Graph"),
    ("briefing", "Briefing"),
    ("analytics", "Analytics"),
    ("settings", "Profile & Settings"),
    ("memory-center", "Memory Center"),
    ("admin-dashboard", "Admin"),
    ("enterprise-command-center", "Enterprise"),
    ("marketplace", "Marketplace"),
]

font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_title = ImageFont.truetype(bold_path, 30)
font_label = ImageFont.truetype(bold_path, 18)
font_small = ImageFont.truetype(font_path, 14)

BG = "#080b0d"
PANEL = "#101519"
LINE = "#253038"
TEXT = "#edf3f2"
MUTED = "#8e9a9f"
ACCENT = "#97c4be"


def add_header(canvas, title, width):
    draw = ImageDraw.Draw(canvas)
    draw.text((32, 24), title, font=font_title, fill=TEXT)
    draw.text((width - 32, 28), "OPERATION BLACK DIAMOND", font=font_small, fill=ACCENT, anchor="ra")
    draw.line((32, 70, width - 32, 70), fill=LINE, width=1)


def fit_width(image, width):
    ratio = width / image.width
    return image.resize((width, max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)

comparisons = []
for slug, title in screens:
    before_path = BEFORE / f"{slug}-desktop.png"
    after_path = AFTER / f"{slug}-desktop.png"
    if not before_path.exists() or not after_path.exists():
        continue
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")
    column_width = 960
    before = fit_width(before, column_width)
    after = fit_width(after, column_width)
    content_height = max(before.height, after.height)
    canvas_width = column_width * 2 + 72
    canvas_height = content_height + 132
    canvas = Image.new("RGB", (canvas_width, canvas_height), BG)
    add_header(canvas, title, canvas_width)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((24, 84, 24 + column_width, canvas_height - 24), radius=14, fill=PANEL, outline=LINE)
    draw.rounded_rectangle((48 + column_width, 84, 48 + column_width * 2, canvas_height - 24), radius=14, fill=PANEL, outline=LINE)
    draw.text((44, 96), "ANTES", font=font_label, fill=MUTED)
    draw.text((68 + column_width, 96), "DEPOIS", font=font_label, fill=ACCENT)
    canvas.paste(before, (24, 126))
    canvas.paste(after, (48 + column_width, 126))
    out_path = OUT / f"{slug}-before-after.png"
    canvas.save(out_path, quality=94)
    comparisons.append((slug, title, out_path))

card_w, card_h = 560, 360
cols, rows = 3, 4
overview_w = cols * card_w + 96
header_h = 112
overview_h = header_h + rows * card_h + 48
overview = Image.new("RGB", (overview_w, overview_h), BG)
draw = ImageDraw.Draw(overview)
draw.text((32, 26), "LifeOS · Premium Transformation", font=font_title, fill=TEXT)
draw.text((32, 66), "12 superfícies redesenhadas · comparativo Antes / Depois", font=font_small, fill=MUTED)
draw.text((overview_w - 32, 30), "BLACK DIAMOND", font=font_label, fill=ACCENT, anchor="ra")

for i, (slug, title, _) in enumerate(comparisons):
    row, col = divmod(i, cols)
    x = 24 + col * card_w
    y = header_h + row * card_h
    before = Image.open(BEFORE / f"{slug}-desktop.png").convert("RGB")
    after = Image.open(AFTER / f"{slug}-desktop.png").convert("RGB")
    half_w = 248
    preview_h = 278
    before_preview = ImageOps.fit(before, (half_w, preview_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.0))
    after_preview = ImageOps.fit(after, (half_w, preview_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.0))
    draw.rounded_rectangle((x, y, x + 528, y + 328), radius=14, fill=PANEL, outline=LINE)
    overview.paste(before_preview, (x + 12, y + 38))
    overview.paste(after_preview, (x + 268, y + 38))
    draw.text((x + 14, y + 12), title, font=font_label, fill=TEXT)
    draw.text((x + 250, y + 16), "ANTES", font=font_small, fill=MUTED, anchor="ra")
    draw.text((x + 516, y + 16), "DEPOIS", font=font_small, fill=ACCENT, anchor="ra")

overview_path = ROOT / "OPERATION_BLACK_DIAMOND_OVERVIEW.png"
overview.save(overview_path, quality=95)
print({"comparisons": len(comparisons), "overview": str(overview_path)})
