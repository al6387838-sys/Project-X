"""
BETA-005: Push Notification Intelligence
LifeOS Mobile Ecosystem — Program Beta

Architecture: AI-driven notification routing with context awareness,
user preference learning, and optimal delivery timing.
"""

from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid


class NotificationCategory(Enum):
    COMPANION_INSIGHT  = "companion_insight"   # AI-generated insights
    DECISION_REQUIRED  = "decision_required"   # Decisions needing action
    HABIT_REMINDER     = "habit_reminder"      # Habit tracking
    GOAL_MILESTONE     = "goal_milestone"      # Goal achievements
    MEMORY_SURFACE     = "memory_surface"      # Surfaced memories
    TEAM_ACTIVITY      = "team_activity"       # Team updates
    SYSTEM_ALERT       = "system_alert"        # System notifications
    SCHEDULED_BRIEF    = "scheduled_brief"     # Daily/weekly briefings


class NotificationUrgency(Enum):
    CRITICAL   = 0   # Interrupt immediately (decisions, deadlines)
    HIGH       = 1   # Deliver within 5 minutes
    NORMAL     = 2   # Deliver at optimal time
    LOW        = 3   # Batch with other low-priority
    SILENT     = 4   # No sound/banner, badge only


class DeliveryChannel(Enum):
    PUSH_BANNER    = "push_banner"       # Standard push notification
    LOCK_SCREEN    = "lock_screen"       # Lock screen widget update
    DYNAMIC_ISLAND = "dynamic_island"   # iOS Dynamic Island (live activity)
    HOME_WIDGET    = "home_widget"       # Home screen widget
    WATCH          = "watch"             # Apple Watch / WearOS
    SILENT_SYNC    = "silent_sync"       # Background data sync only


@dataclass
class UserContext:
    """Real-time user context for intelligent delivery."""
    user_id:          str
    local_time:       time
    is_focus_mode:    bool = False
    is_driving:       bool = False
    is_sleeping:      bool = False
    is_in_meeting:    bool = False
    device_state:     str = "active"   # active | background | locked
    last_interaction: Optional[datetime] = None
    location_type:    str = "unknown"  # home | work | commute | unknown
    battery_level:    int = 100
    notification_score: float = 1.0    # 0.0–1.0, learned preference


@dataclass
class NotificationPayload:
    """A rich notification payload."""
    id:           str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    category:     NotificationCategory = NotificationCategory.COMPANION_INSIGHT
    urgency:      NotificationUrgency = NotificationUrgency.NORMAL
    title:        str = ""
    body:         str = ""
    subtitle:     str = ""
    data:         Dict = field(default_factory=dict)
    actions:      List[Dict] = field(default_factory=list)
    image_url:    Optional[str] = None
    thread_id:    Optional[str] = None
    collapse_key: Optional[str] = None   # Collapse duplicate notifications
    ttl_seconds:  int = 3600
    created_at:   datetime = field(default_factory=datetime.now)
    scheduled_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    channels:     List[DeliveryChannel] = field(default_factory=list)

    def to_apns_payload(self) -> Dict:
        """Convert to Apple Push Notification Service format."""
        return {
            "aps": {
                "alert": {"title": self.title, "subtitle": self.subtitle, "body": self.body},
                "sound": "default" if self.urgency.value <= 1 else None,
                "badge": 1,
                "content-available": 1,
                "mutable-content": 1,
                "category": self.category.value,
                "thread-id": self.thread_id or self.category.value,
                "interruption-level": self._apns_interruption_level(),
            },
            "data": self.data,
            "actions": self.actions,
        }

    def to_fcm_payload(self) -> Dict:
        """Convert to Firebase Cloud Messaging format."""
        return {
            "notification": {"title": self.title, "body": self.body},
            "data": {**self.data, "category": self.category.value},
            "android": {
                "priority": "high" if self.urgency.value <= 1 else "normal",
                "notification": {
                    "channel_id": f"lifeos_{self.category.value}",
                    "color": "#6366F1",
                    "icon": "ic_lifeos_notification",
                },
                "collapse_key": self.collapse_key,
                "ttl": f"{self.ttl_seconds}s",
            },
        }

    def _apns_interruption_level(self) -> str:
        levels = {0: "critical", 1: "time-sensitive", 2: "active", 3: "passive", 4: "passive"}
        return levels.get(self.urgency.value, "active")


class NotificationIntelligenceEngine:
    """
    AI-driven notification intelligence for LifeOS.

    Learns user preferences, respects context, and delivers
    notifications at the optimal moment through the right channel.
    """

    # Quiet hours: no non-critical notifications
    QUIET_HOURS_START = time(22, 0)
    QUIET_HOURS_END   = time(7, 0)

    # Optimal delivery windows
    MORNING_BRIEF_TIME = time(7, 30)
    EVENING_BRIEF_TIME = time(20, 0)

    def __init__(self):
        self._pending:    List[NotificationPayload] = []
        self._delivered:  List[NotificationPayload] = []
        self._suppressed: List[NotificationPayload] = []
        self._user_prefs: Dict[str, Dict] = {}
        self._delivery_log: List[Dict] = []

    # ── INTELLIGENCE ───────────────────────────────────────

    def route(self, notification: NotificationPayload, context: UserContext) -> Dict:
        """
        Intelligently route a notification based on context.
        Returns routing decision with channels and timing.
        """
        decision = {
            "notification_id": notification.id,
            "category": notification.category.value,
            "urgency": notification.urgency.value,
            "deliver": True,
            "channels": [],
            "delay_seconds": 0,
            "reason": "",
            "suppressed": False,
        }

        # 1. Critical notifications always go through
        if notification.urgency == NotificationUrgency.CRITICAL:
            decision["channels"] = [DeliveryChannel.PUSH_BANNER.value,
                                     DeliveryChannel.DYNAMIC_ISLAND.value,
                                     DeliveryChannel.WATCH.value]
            decision["reason"] = "critical_override"
            return self._finalize(notification, decision, context)

        # 2. Check quiet hours
        if self._is_quiet_hours(context.local_time):
            if notification.urgency.value >= 2:
                decision["deliver"] = False
                decision["suppressed"] = True
                decision["reason"] = "quiet_hours"
                self._suppressed.append(notification)
                return decision

        # 3. Context-aware suppression
        if context.is_driving:
            decision["channels"] = [DeliveryChannel.WATCH.value]
            decision["reason"] = "driving_mode_watch_only"
            return self._finalize(notification, decision, context)

        if context.is_in_meeting and notification.urgency.value >= 2:
            decision["delay_seconds"] = self._estimate_meeting_end(context)
            decision["reason"] = "in_meeting_delayed"
            return self._finalize(notification, decision, context)

        if context.is_focus_mode and notification.urgency.value >= 2:
            decision["delay_seconds"] = 1800  # 30 min
            decision["reason"] = "focus_mode_delayed"
            return self._finalize(notification, decision, context)

        # 4. Device state routing
        if context.device_state == "locked":
            decision["channels"] = [DeliveryChannel.LOCK_SCREEN.value]
            decision["reason"] = "device_locked_lock_screen"
            return self._finalize(notification, decision, context)

        # 5. Category-specific routing
        channels = self._category_channels(notification.category, context)
        decision["channels"] = [c.value for c in channels]
        decision["reason"] = "standard_routing"

        # 6. Apply user preference score
        score = context.notification_score
        if score < 0.3 and notification.urgency.value >= 3:
            decision["deliver"] = False
            decision["suppressed"] = True
            decision["reason"] = "user_preference_suppressed"
            self._suppressed.append(notification)
            return decision

        return self._finalize(notification, decision, context)

    def _category_channels(self, category: NotificationCategory,
                            context: UserContext) -> List[DeliveryChannel]:
        """Determine channels based on notification category."""
        mapping = {
            NotificationCategory.COMPANION_INSIGHT:  [DeliveryChannel.PUSH_BANNER, DeliveryChannel.HOME_WIDGET],
            NotificationCategory.DECISION_REQUIRED:  [DeliveryChannel.PUSH_BANNER, DeliveryChannel.DYNAMIC_ISLAND],
            NotificationCategory.HABIT_REMINDER:     [DeliveryChannel.PUSH_BANNER, DeliveryChannel.WATCH],
            NotificationCategory.GOAL_MILESTONE:     [DeliveryChannel.PUSH_BANNER, DeliveryChannel.HOME_WIDGET],
            NotificationCategory.MEMORY_SURFACE:     [DeliveryChannel.PUSH_BANNER],
            NotificationCategory.TEAM_ACTIVITY:      [DeliveryChannel.PUSH_BANNER],
            NotificationCategory.SYSTEM_ALERT:       [DeliveryChannel.PUSH_BANNER],
            NotificationCategory.SCHEDULED_BRIEF:    [DeliveryChannel.PUSH_BANNER, DeliveryChannel.HOME_WIDGET,
                                                       DeliveryChannel.LOCK_SCREEN],
        }
        return mapping.get(category, [DeliveryChannel.PUSH_BANNER])

    def _is_quiet_hours(self, t: time) -> bool:
        if self.QUIET_HOURS_START <= self.QUIET_HOURS_END:
            return self.QUIET_HOURS_START <= t <= self.QUIET_HOURS_END
        return t >= self.QUIET_HOURS_START or t <= self.QUIET_HOURS_END

    def _estimate_meeting_end(self, context: UserContext) -> int:
        return 1800  # Default: 30 minutes

    def _finalize(self, notification: NotificationPayload, decision: Dict, context: UserContext) -> Dict:
        if decision["deliver"]:
            notification.delivered_at = datetime.now()
            notification.channels = [DeliveryChannel(c) for c in decision["channels"] if c in [d.value for d in DeliveryChannel]]
            self._delivered.append(notification)
            self._delivery_log.append({
                "id": notification.id,
                "category": notification.category.value,
                "channels": decision["channels"],
                "reason": decision["reason"],
                "context": {
                    "focus": context.is_focus_mode,
                    "meeting": context.is_in_meeting,
                    "device": context.device_state,
                },
            })
        return decision

    def get_stats(self) -> Dict:
        return {
            "pending": len(self._pending),
            "delivered": len(self._delivered),
            "suppressed": len(self._suppressed),
            "delivery_rate": len(self._delivered) / max(1, len(self._delivered) + len(self._suppressed)),
            "channel_breakdown": self._channel_breakdown(),
        }

    def _channel_breakdown(self) -> Dict:
        breakdown = {}
        for n in self._delivered:
            for ch in n.channels:
                breakdown[ch.value] = breakdown.get(ch.value, 0) + 1
        return breakdown


# ── DEMO ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("BETA-005: Push Notification Intelligence — Demo")
    print("=" * 60)

    engine = NotificationIntelligenceEngine()

    # Test scenarios
    scenarios = [
        {
            "name": "Critical decision during focus mode",
            "notification": NotificationPayload(
                category=NotificationCategory.DECISION_REQUIRED,
                urgency=NotificationUrgency.CRITICAL,
                title="Decisão Crítica: Arquitetura Mobile",
                body="Companion identificou 3 cenários. Prazo: 17h.",
                actions=[{"id": "review", "title": "Revisar agora"}, {"id": "later", "title": "Em 1h"}],
            ),
            "context": UserContext(user_id="alex", local_time=time(10, 0), is_focus_mode=True),
        },
        {
            "name": "Habit reminder during meeting",
            "notification": NotificationPayload(
                category=NotificationCategory.HABIT_REMINDER,
                urgency=NotificationUrgency.NORMAL,
                title="Lembrete: Exercício Físico",
                body="Você tem 2h para completar sua meta de hoje.",
            ),
            "context": UserContext(user_id="alex", local_time=time(14, 0), is_in_meeting=True),
        },
        {
            "name": "Morning brief at optimal time",
            "notification": NotificationPayload(
                category=NotificationCategory.SCHEDULED_BRIEF,
                urgency=NotificationUrgency.HIGH,
                title="Briefing Matinal · LifeOS",
                body="3 decisões · 87% progresso · Streak: 12 dias",
            ),
            "context": UserContext(user_id="alex", local_time=time(7, 30), device_state="locked"),
        },
        {
            "name": "Insight while driving",
            "notification": NotificationPayload(
                category=NotificationCategory.COMPANION_INSIGHT,
                urgency=NotificationUrgency.NORMAL,
                title="Companion detectou padrão",
                body="Sua produtividade é 40% maior às terças-feiras.",
            ),
            "context": UserContext(user_id="alex", local_time=time(9, 0), is_driving=True),
        },
        {
            "name": "Low priority during quiet hours",
            "notification": NotificationPayload(
                category=NotificationCategory.MEMORY_SURFACE,
                urgency=NotificationUrgency.LOW,
                title="Memória de 1 ano atrás",
                body="Você começou o PROJECT-X há exatamente 1 ano.",
            ),
            "context": UserContext(user_id="alex", local_time=time(23, 30)),
        },
    ]

    for scenario in scenarios:
        result = engine.route(scenario["notification"], scenario["context"])
        status = "DELIVERED" if result["deliver"] else "SUPPRESSED"
        channels = ", ".join(result["channels"]) if result["channels"] else "none"
        print(f"\n[{status}] {scenario['name']}")
        print(f"  Channels: {channels}")
        print(f"  Reason: {result['reason']}")
        if result.get("delay_seconds"):
            print(f"  Delayed: {result['delay_seconds']}s")

    stats = engine.get_stats()
    print(f"\n[STATS]")
    print(f"  Delivered: {stats['delivered']} | Suppressed: {stats['suppressed']}")
    print(f"  Delivery rate: {stats['delivery_rate']:.0%}")
    print(f"  Channel breakdown: {stats['channel_breakdown']}")
    print("\n✅ BETA-005: Push Notification Intelligence — COMPLETE")
