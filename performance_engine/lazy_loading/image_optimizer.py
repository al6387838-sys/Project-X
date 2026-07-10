"""
ImageOptimizer — Image optimization pipeline for LifeOS.

Provides:
- Responsive image generation (multiple breakpoints)
- WebP / AVIF conversion
- Lazy loading metadata
- Blur placeholder generation (LQIP)
- CDN-aware URL generation
- Image dimension detection
"""

import os
import io
import time
import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ImageFormat(Enum):
    JPEG = "jpeg"
    PNG = "png"
    WEBP = "webp"
    AVIF = "avif"
    GIF = "gif"
    SVG = "svg"


@dataclass
class ImageBreakpoint:
    """A responsive image breakpoint."""
    name: str           # e.g. "thumbnail", "mobile", "tablet", "desktop"
    width: int          # max width in pixels
    quality: int = 80   # compression quality 1-100


@dataclass
class OptimizedImage:
    """Result of image optimization."""
    original_path: str
    original_size_bytes: int
    variants: List[Dict]   # list of {name, path, width, height, size_bytes, format}
    lqip: Optional[str] = None   # Low Quality Image Placeholder (base64 data URI)
    dominant_color: Optional[str] = None   # hex color
    aspect_ratio: Optional[float] = None
    optimization_time_ms: float = 0.0
    savings_percent: float = 0.0


# Standard breakpoints for LifeOS
STANDARD_BREAKPOINTS = [
    ImageBreakpoint("thumbnail", 64, quality=60),
    ImageBreakpoint("mobile", 375, quality=75),
    ImageBreakpoint("tablet", 768, quality=80),
    ImageBreakpoint("desktop", 1280, quality=85),
    ImageBreakpoint("retina", 2560, quality=90),
]


class ImageOptimizer:
    """
    Image optimization pipeline for LifeOS.

    Generates responsive variants, converts to modern formats,
    and produces LQIP placeholders for progressive loading.
    """

    def __init__(
        self,
        output_dir: str = "/tmp/lifeos_images",
        cdn_base_url: str = "",
        default_format: ImageFormat = ImageFormat.WEBP,
        breakpoints: Optional[List[ImageBreakpoint]] = None,
        name: str = "image_optimizer",
    ) -> None:
        self.name = name
        self.output_dir = output_dir
        self.cdn_base_url = cdn_base_url
        self.default_format = default_format
        self.breakpoints = breakpoints or STANDARD_BREAKPOINTS
        os.makedirs(output_dir, exist_ok=True)
        self._stats = {
            "images_processed": 0,
            "total_original_bytes": 0,
            "total_optimized_bytes": 0,
            "errors": 0,
        }

    def optimize(
        self,
        image_path: str,
        breakpoints: Optional[List[ImageBreakpoint]] = None,
        output_format: Optional[ImageFormat] = None,
        generate_lqip: bool = True,
    ) -> OptimizedImage:
        """
        Optimize a single image: resize, convert, generate LQIP.
        Returns OptimizedImage with all variants.
        """
        t0 = time.monotonic()
        bps = breakpoints or self.breakpoints
        fmt = output_format or self.default_format
        original_size = os.path.getsize(image_path) if os.path.exists(image_path) else 0

        try:
            from PIL import Image as PILImage
            with PILImage.open(image_path) as img:
                orig_w, orig_h = img.size
                aspect = orig_w / orig_h if orig_h else 1.0

                variants = []
                total_opt_bytes = 0

                for bp in bps:
                    if bp.width >= orig_w:
                        target_w = orig_w
                    else:
                        target_w = bp.width
                    target_h = int(target_w / aspect)

                    resized = img.resize((target_w, target_h), PILImage.LANCZOS)
                    if resized.mode in ("RGBA", "P") and fmt == ImageFormat.JPEG:
                        resized = resized.convert("RGB")

                    # Build output path
                    base = hashlib.md5(image_path.encode()).hexdigest()[:8]
                    ext = fmt.value if fmt != ImageFormat.AVIF else "avif"
                    out_name = f"{base}_{bp.name}.{ext}"
                    out_path = os.path.join(self.output_dir, out_name)

                    save_kwargs = {"quality": bp.quality}
                    if fmt == ImageFormat.WEBP:
                        save_kwargs["method"] = 6
                    resized.save(out_path, format=fmt.value.upper(), **save_kwargs)

                    opt_size = os.path.getsize(out_path)
                    total_opt_bytes += opt_size
                    url = f"{self.cdn_base_url}/{out_name}" if self.cdn_base_url else out_path

                    variants.append({
                        "name": bp.name,
                        "path": out_path,
                        "url": url,
                        "width": target_w,
                        "height": target_h,
                        "size_bytes": opt_size,
                        "format": fmt.value,
                        "quality": bp.quality,
                    })

                # Generate LQIP (8px wide, base64 encoded)
                lqip = None
                if generate_lqip:
                    lqip = self._generate_lqip(img)

                # Dominant color (simple average)
                dominant = self._dominant_color(img)

                savings = (1 - total_opt_bytes / (original_size * len(bps))) * 100 if original_size else 0

                self._stats["images_processed"] += 1
                self._stats["total_original_bytes"] += original_size
                self._stats["total_optimized_bytes"] += total_opt_bytes

                return OptimizedImage(
                    original_path=image_path,
                    original_size_bytes=original_size,
                    variants=variants,
                    lqip=lqip,
                    dominant_color=dominant,
                    aspect_ratio=round(aspect, 4),
                    optimization_time_ms=(time.monotonic() - t0) * 1000,
                    savings_percent=round(savings, 2),
                )
        except ImportError:
            logger.warning("[ImageOptimizer] Pillow not available. Returning stub.")
            return self._stub_result(image_path, original_size, bps, fmt, t0)
        except Exception as exc:
            self._stats["errors"] += 1
            logger.error("[ImageOptimizer] Error optimizing %s: %s", image_path, exc)
            return self._stub_result(image_path, original_size, bps, fmt, t0)

    def _generate_lqip(self, img: Any) -> str:
        """Generate a Low Quality Image Placeholder as base64 data URI."""
        import base64
        try:
            thumb = img.resize((8, 8))
            buf = io.BytesIO()
            thumb.save(buf, format="JPEG", quality=20)
            b64 = base64.b64encode(buf.getvalue()).decode()
            return f"data:image/jpeg;base64,{b64}"
        except Exception:
            return ""

    def _dominant_color(self, img: Any) -> str:
        """Calculate dominant color as hex string."""
        try:
            small = img.resize((1, 1)).convert("RGB")
            r, g, b = small.getpixel((0, 0))
            return f"#{r:02x}{g:02x}{b:02x}"
        except Exception:
            return "#888888"

    def _stub_result(self, path, size, bps, fmt, t0) -> OptimizedImage:
        return OptimizedImage(
            original_path=path,
            original_size_bytes=size,
            variants=[{"name": bp.name, "path": path, "width": bp.width} for bp in bps],
            optimization_time_ms=(time.monotonic() - t0) * 1000,
        )

    def get_srcset(self, optimized: OptimizedImage) -> str:
        """Generate HTML srcset attribute string."""
        parts = [
            f"{v['url']} {v['width']}w"
            for v in optimized.variants
            if "url" in v and "width" in v
        ]
        return ", ".join(parts)

    def stats(self) -> Dict[str, Any]:
        total_orig = self._stats["total_original_bytes"]
        total_opt = self._stats["total_optimized_bytes"]
        savings = (1 - total_opt / total_orig) * 100 if total_orig else 0
        return {
            "name": self.name,
            "overall_savings_percent": round(savings, 2),
            **self._stats,
        }

    def __repr__(self) -> str:
        return (
            f"ImageOptimizer(name={self.name!r}, "
            f"format={self.default_format.value!r}, "
            f"breakpoints={len(self.breakpoints)})"
        )
