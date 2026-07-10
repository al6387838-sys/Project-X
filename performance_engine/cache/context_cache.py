"""
ContextCache — Specialized cache for AI Companion context windows.

Optimized for:
- User session context (conversation history)
- Companion response pre-computation
- Personality profile snapshots
- Recent interaction summaries

Target: Companion Response < 1 second (Sprint 027 SLA).
"""

import time
import threading
from typing import Any, Optional, Dict, List
from dataclasses import dataclass, field
from collections import deque


@dataclass
class ContextWindow:
    """Sliding window of context entries for a user session."""
    user_id: str
    entries: deque = field(default_factory=lambda: deque(maxlen=50))
    personality_snapshot: Optional[Dict] = None
    last_updated: float = field(default_factory=time.monotonic)
    session_start: float = field(default_factory=time.monotonic)
    ttl: float = 1800.0  # 30 minutes session TTL

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.last_updated) > self.ttl

    def add_entry(self, entry: Dict) -> None:
        self.entries.append({**entry, "ts": time.monotonic()})
        self.last_updated = time.monotonic()

    def get_recent(self, n: int = 10) -> List[Dict]:
        return list(self.entries)[-n:]

    @property
    def session_duration_s(self) -> float:
        return time.monotonic() - self.session_start


class ContextCache:
    """
    Per-user context cache for the AI Companion.

    Maintains:
    - Active conversation windows (sliding, max 50 turns)
    - Personality profile snapshots (refreshed every 10 min)
    - Pre-computed response fragments for common intents
    - User preference fast-lookup
    """

    def __init__(
        self,
        max_sessions: int = 100_000,
        session_ttl: float = 1800.0,
        name: str = "context_cache",
    ) -> None:
        self.name = name
        self.max_sessions = max_sessions
        self.session_ttl = session_ttl
        self._sessions: Dict[str, ContextWindow] = {}
        self._response_fragments: Dict[str, Any] = {}
        self._user_prefs: Dict[str, Dict] = {}
        self._lock = threading.RLock()
        self._stats = {
            "session_hits": 0,
            "session_misses": 0,
            "fragment_hits": 0,
            "fragment_misses": 0,
            "evictions": 0,
        }

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------

    def get_session(self, user_id: str) -> Optional[ContextWindow]:
        with self._lock:
            window = self._sessions.get(user_id)
            if window is None:
                self._stats["session_misses"] += 1
                return None
            if window.is_expired:
                del self._sessions[user_id]
                self._stats["session_misses"] += 1
                return None
            self._stats["session_hits"] += 1
            return window

    def get_or_create_session(self, user_id: str) -> ContextWindow:
        with self._lock:
            window = self.get_session(user_id)
            if window is None:
                if len(self._sessions) >= self.max_sessions:
                    self._evict_expired_sessions()
                window = ContextWindow(user_id=user_id, ttl=self.session_ttl)
                self._sessions[user_id] = window
            return window

    def add_context_entry(self, user_id: str, entry: Dict) -> None:
        window = self.get_or_create_session(user_id)
        with self._lock:
            window.add_entry(entry)

    def get_recent_context(self, user_id: str, n: int = 10) -> List[Dict]:
        window = self.get_session(user_id)
        if window is None:
            return []
        return window.get_recent(n)

    def end_session(self, user_id: str) -> None:
        with self._lock:
            self._sessions.pop(user_id, None)

    # ------------------------------------------------------------------
    # Personality snapshot
    # ------------------------------------------------------------------

    def set_personality(self, user_id: str, snapshot: Dict, ttl: float = 600.0) -> None:
        """Cache a personality profile snapshot for fast Companion access."""
        with self._lock:
            window = self.get_or_create_session(user_id)
            window.personality_snapshot = {
                "data": snapshot,
                "cached_at": time.monotonic(),
                "ttl": ttl,
            }

    def get_personality(self, user_id: str) -> Optional[Dict]:
        with self._lock:
            window = self._sessions.get(user_id)
            if window is None or window.personality_snapshot is None:
                return None
            snap = window.personality_snapshot
            if (time.monotonic() - snap["cached_at"]) > snap["ttl"]:
                window.personality_snapshot = None
                return None
            return snap["data"]

    # ------------------------------------------------------------------
    # Response fragment cache (pre-computed common responses)
    # ------------------------------------------------------------------

    def set_fragment(self, intent_key: str, fragment: Any, ttl: float = 300.0) -> None:
        with self._lock:
            self._response_fragments[intent_key] = {
                "data": fragment,
                "cached_at": time.monotonic(),
                "ttl": ttl,
            }

    def get_fragment(self, intent_key: str) -> Optional[Any]:
        with self._lock:
            entry = self._response_fragments.get(intent_key)
            if entry is None:
                self._stats["fragment_misses"] += 1
                return None
            if (time.monotonic() - entry["cached_at"]) > entry["ttl"]:
                del self._response_fragments[intent_key]
                self._stats["fragment_misses"] += 1
                return None
            self._stats["fragment_hits"] += 1
            return entry["data"]

    # ------------------------------------------------------------------
    # User preferences fast-lookup
    # ------------------------------------------------------------------

    def set_user_prefs(self, user_id: str, prefs: Dict) -> None:
        with self._lock:
            self._user_prefs[user_id] = {**prefs, "_cached_at": time.monotonic()}

    def get_user_prefs(self, user_id: str) -> Optional[Dict]:
        with self._lock:
            return self._user_prefs.get(user_id)

    # ------------------------------------------------------------------
    # Eviction
    # ------------------------------------------------------------------

    def _evict_expired_sessions(self) -> int:
        expired = [uid for uid, w in self._sessions.items() if w.is_expired]
        for uid in expired:
            del self._sessions[uid]
        self._stats["evictions"] += len(expired)
        # If still over limit, evict oldest
        if len(self._sessions) >= self.max_sessions:
            oldest = sorted(
                self._sessions.items(), key=lambda x: x[1].last_updated
            )[: len(self._sessions) // 10]
            for uid, _ in oldest:
                del self._sessions[uid]
            self._stats["evictions"] += len(oldest)
        return len(expired)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            active = sum(1 for w in self._sessions.values() if not w.is_expired)
            return {
                "name": self.name,
                "active_sessions": active,
                "total_sessions": len(self._sessions),
                "fragments_cached": len(self._response_fragments),
                "user_prefs_cached": len(self._user_prefs),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"ContextCache(name={self.name!r}, "
            f"sessions={len(self._sessions)}, "
            f"fragments={len(self._response_fragments)})"
        )
