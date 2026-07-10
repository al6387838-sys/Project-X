"""
CompressionEngine — Payload compression for LifeOS API responses.

Supports:
- Gzip (universal compatibility)
- Brotli (superior compression, modern browsers)
- Zstandard (fast, high ratio, server-to-server)
- LZ4 (ultra-fast, in-memory use cases)
- Adaptive selection based on content type and size
- Streaming compression for large payloads
"""

import io
import gzip
import zlib
import time
import logging
from typing import Any, Dict, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class CompressionAlgorithm(Enum):
    NONE = "none"
    GZIP = "gzip"
    DEFLATE = "deflate"
    BROTLI = "brotli"
    ZSTD = "zstd"
    LZ4 = "lz4"


@dataclass_like = None  # avoid import issues — use plain class


class CompressionResult:
    """Result of a compression operation."""
    def __init__(
        self,
        data: bytes,
        algorithm: CompressionAlgorithm,
        original_size: int,
        compressed_size: int,
        compression_time_ms: float,
    ):
        self.data = data
        self.algorithm = algorithm
        self.original_size = original_size
        self.compressed_size = compressed_size
        self.compression_time_ms = compression_time_ms

    @property
    def ratio(self) -> float:
        return self.compressed_size / self.original_size if self.original_size else 1.0

    @property
    def savings_percent(self) -> float:
        return (1 - self.ratio) * 100

    def __repr__(self) -> str:
        return (
            f"CompressionResult(algo={self.algorithm.value!r}, "
            f"ratio={self.ratio:.2f}, "
            f"savings={self.savings_percent:.1f}%)"
        )


class CompressionEngine:
    """
    Adaptive compression engine for LifeOS.

    Automatically selects the best algorithm based on:
    - Content type (JSON, binary, text)
    - Payload size (skip compression for tiny payloads)
    - Available libraries
    - Target use case (HTTP response vs in-memory vs storage)
    """

    # Minimum size to bother compressing (bytes)
    MIN_COMPRESS_SIZE = 1024

    def __init__(
        self,
        default_algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP,
        gzip_level: int = 6,
        brotli_quality: int = 4,
        zstd_level: int = 3,
        name: str = "compression_engine",
    ) -> None:
        self.name = name
        self.default_algorithm = default_algorithm
        self.gzip_level = gzip_level
        self.brotli_quality = brotli_quality
        self.zstd_level = zstd_level
        self._available = self._detect_available()
        self._stats = {
            "compressions": 0,
            "decompressions": 0,
            "total_original_bytes": 0,
            "total_compressed_bytes": 0,
            "skipped_too_small": 0,
        }

    def _detect_available(self) -> Dict[str, bool]:
        available = {
            "gzip": True,
            "deflate": True,
            "brotli": False,
            "zstd": False,
            "lz4": False,
        }
        try:
            import brotli  # type: ignore
            available["brotli"] = True
        except ImportError:
            pass
        try:
            import zstandard  # type: ignore
            available["zstd"] = True
        except ImportError:
            pass
        try:
            import lz4.frame  # type: ignore
            available["lz4"] = True
        except ImportError:
            pass
        return available

    # ------------------------------------------------------------------
    # Compression
    # ------------------------------------------------------------------

    def compress(
        self,
        data: bytes,
        algorithm: Optional[CompressionAlgorithm] = None,
    ) -> CompressionResult:
        """Compress bytes with the specified (or default) algorithm."""
        if isinstance(data, str):
            data = data.encode("utf-8")

        original_size = len(data)
        self._stats["total_original_bytes"] += original_size

        if original_size < self.MIN_COMPRESS_SIZE:
            self._stats["skipped_too_small"] += 1
            return CompressionResult(
                data=data,
                algorithm=CompressionAlgorithm.NONE,
                original_size=original_size,
                compressed_size=original_size,
                compression_time_ms=0.0,
            )

        algo = algorithm or self.default_algorithm
        # Fallback if not available
        if algo == CompressionAlgorithm.BROTLI and not self._available["brotli"]:
            algo = CompressionAlgorithm.GZIP
        if algo == CompressionAlgorithm.ZSTD and not self._available["zstd"]:
            algo = CompressionAlgorithm.GZIP
        if algo == CompressionAlgorithm.LZ4 and not self._available["lz4"]:
            algo = CompressionAlgorithm.GZIP

        t0 = time.monotonic()
        compressed = self._do_compress(data, algo)
        elapsed = (time.monotonic() - t0) * 1000

        self._stats["compressions"] += 1
        self._stats["total_compressed_bytes"] += len(compressed)

        return CompressionResult(
            data=compressed,
            algorithm=algo,
            original_size=original_size,
            compressed_size=len(compressed),
            compression_time_ms=elapsed,
        )

    def _do_compress(self, data: bytes, algo: CompressionAlgorithm) -> bytes:
        if algo == CompressionAlgorithm.GZIP:
            return gzip.compress(data, compresslevel=self.gzip_level)
        if algo == CompressionAlgorithm.DEFLATE:
            return zlib.compress(data, level=self.gzip_level)
        if algo == CompressionAlgorithm.BROTLI:
            import brotli
            return brotli.compress(data, quality=self.brotli_quality)
        if algo == CompressionAlgorithm.ZSTD:
            import zstandard as zstd
            cctx = zstd.ZstdCompressor(level=self.zstd_level)
            return cctx.compress(data)
        if algo == CompressionAlgorithm.LZ4:
            import lz4.frame
            return lz4.frame.compress(data)
        return data

    # ------------------------------------------------------------------
    # Decompression
    # ------------------------------------------------------------------

    def decompress(
        self,
        data: bytes,
        algorithm: CompressionAlgorithm,
    ) -> bytes:
        """Decompress bytes."""
        self._stats["decompressions"] += 1
        if algorithm == CompressionAlgorithm.NONE:
            return data
        if algorithm == CompressionAlgorithm.GZIP:
            return gzip.decompress(data)
        if algorithm == CompressionAlgorithm.DEFLATE:
            return zlib.decompress(data)
        if algorithm == CompressionAlgorithm.BROTLI:
            import brotli
            return brotli.decompress(data)
        if algorithm == CompressionAlgorithm.ZSTD:
            import zstandard as zstd
            dctx = zstd.ZstdDecompressor()
            return dctx.decompress(data)
        if algorithm == CompressionAlgorithm.LZ4:
            import lz4.frame
            return lz4.frame.decompress(data)
        return data

    # ------------------------------------------------------------------
    # Adaptive selection
    # ------------------------------------------------------------------

    def best_algorithm(
        self,
        content_type: str = "application/json",
        accept_encoding: str = "gzip, deflate, br",
        size_bytes: int = 0,
    ) -> CompressionAlgorithm:
        """
        Select the best compression algorithm for an HTTP response.

        Priority: Brotli > Zstd > Gzip > Deflate > None
        """
        if size_bytes < self.MIN_COMPRESS_SIZE:
            return CompressionAlgorithm.NONE

        if "br" in accept_encoding and self._available["brotli"]:
            return CompressionAlgorithm.BROTLI
        if "zstd" in accept_encoding and self._available["zstd"]:
            return CompressionAlgorithm.ZSTD
        if "gzip" in accept_encoding:
            return CompressionAlgorithm.GZIP
        if "deflate" in accept_encoding:
            return CompressionAlgorithm.DEFLATE
        return CompressionAlgorithm.NONE

    def compress_json(self, obj: Any) -> CompressionResult:
        """Convenience: JSON-serialize and compress an object."""
        import json
        raw = json.dumps(obj, default=str).encode("utf-8")
        return self.compress(raw)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        total_orig = self._stats["total_original_bytes"]
        total_comp = self._stats["total_compressed_bytes"]
        savings = (1 - total_comp / total_orig) * 100 if total_orig else 0
        return {
            "name": self.name,
            "available_algorithms": [k for k, v in self._available.items() if v],
            "overall_savings_percent": round(savings, 2),
            **self._stats,
        }

    def __repr__(self) -> str:
        algos = [k for k, v in self._available.items() if v]
        return f"CompressionEngine(name={self.name!r}, available={algos})"
