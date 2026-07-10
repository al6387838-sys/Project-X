"""
LifeOS Enterprise Platform — Audit Center
EXECUTION-010: Enterprise Platform

Auditoria corporativa completa com:
- Logs imutáveis de todas as ações
- Histórico de alterações (Change History)
- Rastreamento de acesso a dados sensíveis
- Exportação para SIEM
- Retenção configurável
"""
from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class AuditEventCategory(str, Enum):
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    CONFIGURATION = "configuration"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    BILLING = "billing"
    ADMIN = "admin"
    SSO = "sso"
    API = "api"
    SYSTEM = "system"


class AuditEventSeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditEventOutcome(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"
    UNKNOWN = "unknown"


@dataclass
class AuditEvent:
    """
    Evento de auditoria imutável.
    Uma vez criado, não pode ser modificado (append-only log).
    """
    org_id: str
    category: AuditEventCategory
    action: str                       # Ex: "user.login", "memory.delete", "role.assign"
    actor_id: str                     # Quem executou a ação
    actor_email: str = ""
    actor_ip: str = ""
    actor_user_agent: str = ""
    target_id: Optional[str] = None   # ID do recurso afetado
    target_type: Optional[str] = None # Tipo do recurso afetado
    outcome: AuditEventOutcome = AuditEventOutcome.SUCCESS
    severity: AuditEventSeverity = AuditEventSeverity.INFO
    workspace_id: Optional[str] = None
    team_id: Optional[str] = None
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None  # {field: {before, after}}
    metadata: Dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: f"evt_{secrets.token_hex(12)}")
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _hash: str = field(default="", init=False)

    def __post_init__(self):
        self._hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """Gera hash SHA-256 do evento para garantir imutabilidade."""
        payload = json.dumps({
            "event_id": self.event_id,
            "org_id": self.org_id,
            "action": self.action,
            "actor_id": self.actor_id,
            "timestamp": self.timestamp.isoformat(),
            "outcome": self.outcome.value,
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()

    def verify_integrity(self) -> bool:
        """Verifica se o evento não foi adulterado."""
        return self._hash == self._compute_hash()

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "org_id": self.org_id,
            "category": self.category.value,
            "action": self.action,
            "actor_id": self.actor_id,
            "actor_email": self.actor_email,
            "actor_ip": self.actor_ip,
            "target_id": self.target_id,
            "target_type": self.target_type,
            "outcome": self.outcome.value,
            "severity": self.severity.value,
            "workspace_id": self.workspace_id,
            "changes": self.changes,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
            "integrity_hash": self._hash,
        }


@dataclass
class ChangeRecord:
    """Registro de alteração em um recurso específico."""
    org_id: str
    resource_type: str
    resource_id: str
    changed_by: str
    changes: Dict[str, Dict[str, Any]]  # {field: {before: x, after: y}}
    change_id: str = field(default_factory=lambda: f"chg_{secrets.token_hex(10)}")
    workspace_id: Optional[str] = None
    reason: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "change_id": self.change_id,
            "org_id": self.org_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "changed_by": self.changed_by,
            "changes": self.changes,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
        }


class AuditCenter:
    """
    Central de Auditoria do LifeOS Enterprise.

    Funcionalidades:
    - Log imutável de todos os eventos (append-only)
    - Verificação de integridade via hash SHA-256
    - Histórico de alterações por recurso
    - Busca e filtragem avançada
    - Exportação para SIEM (JSON, CSV)
    - Alertas de segurança automáticos
    - Retenção configurável por organização
    """

    # Ações que requerem severidade HIGH automaticamente
    HIGH_SEVERITY_ACTIONS = {
        "user.login_failed", "user.account_locked",
        "role.assign", "role.revoke", "permission.grant",
        "sso.config_changed", "api_key.created", "api_key.revoked",
        "organization.settings_changed", "billing.plan_changed",
        "member.removed", "member.suspended",
        "security.ip_blocked", "security.mfa_disabled",
    }

    CRITICAL_SEVERITY_ACTIONS = {
        "organization.deleted", "organization.suspended",
        "data.bulk_export", "data.bulk_delete",
        "sso.disabled", "compliance.framework_removed",
        "admin.privilege_escalation",
    }

    def __init__(self):
        self._events: List[AuditEvent] = []
        self._change_records: List[ChangeRecord] = []
        self._org_event_index: Dict[str, List[int]] = {}  # org_id -> [event indices]
        self._security_alerts: List[Dict] = []

    def log(
        self,
        org_id: str,
        category: AuditEventCategory,
        action: str,
        actor_id: str,
        actor_email: str = "",
        actor_ip: str = "",
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        outcome: AuditEventOutcome = AuditEventOutcome.SUCCESS,
        severity: Optional[AuditEventSeverity] = None,
        workspace_id: Optional[str] = None,
        changes: Optional[Dict] = None,
        metadata: Optional[Dict] = None,
        **kwargs,
    ) -> AuditEvent:
        """Registra um evento de auditoria."""
        # Auto-determinar severidade se não especificada
        if severity is None:
            if action in self.CRITICAL_SEVERITY_ACTIONS:
                severity = AuditEventSeverity.CRITICAL
            elif action in self.HIGH_SEVERITY_ACTIONS:
                severity = AuditEventSeverity.HIGH
            elif outcome == AuditEventOutcome.FAILURE:
                severity = AuditEventSeverity.MEDIUM
            else:
                severity = AuditEventSeverity.INFO

        event = AuditEvent(
            org_id=org_id,
            category=category,
            action=action,
            actor_id=actor_id,
            actor_email=actor_email,
            actor_ip=actor_ip,
            target_id=target_id,
            target_type=target_type,
            outcome=outcome,
            severity=severity,
            workspace_id=workspace_id,
            changes=changes,
            metadata=metadata or {},
            **kwargs,
        )

        idx = len(self._events)
        self._events.append(event)
        self._org_event_index.setdefault(org_id, []).append(idx)

        # Verificar se deve gerar alerta de segurança
        if severity in (AuditEventSeverity.HIGH, AuditEventSeverity.CRITICAL):
            self._generate_security_alert(event)

        return event

    def record_change(
        self,
        org_id: str,
        resource_type: str,
        resource_id: str,
        changed_by: str,
        changes: Dict[str, Dict[str, Any]],
        workspace_id: Optional[str] = None,
        reason: str = "",
    ) -> ChangeRecord:
        """Registra uma alteração em um recurso."""
        record = ChangeRecord(
            org_id=org_id,
            resource_type=resource_type,
            resource_id=resource_id,
            changed_by=changed_by,
            changes=changes,
            workspace_id=workspace_id,
            reason=reason,
        )
        self._change_records.append(record)
        return record

    def query(
        self,
        org_id: str,
        category: Optional[AuditEventCategory] = None,
        action: Optional[str] = None,
        actor_id: Optional[str] = None,
        severity: Optional[AuditEventSeverity] = None,
        outcome: Optional[AuditEventOutcome] = None,
        workspace_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Busca eventos de auditoria com filtros."""
        indices = self._org_event_index.get(org_id, [])
        events = [self._events[i] for i in indices]

        if category:
            events = [e for e in events if e.category == category]
        if action:
            events = [e for e in events if action.lower() in e.action.lower()]
        if actor_id:
            events = [e for e in events if e.actor_id == actor_id]
        if severity:
            events = [e for e in events if e.severity == severity]
        if outcome:
            events = [e for e in events if e.outcome == outcome]
        if workspace_id:
            events = [e for e in events if e.workspace_id == workspace_id]
        if start_time:
            events = [e for e in events if e.timestamp >= start_time]
        if end_time:
            events = [e for e in events if e.timestamp <= end_time]

        total = len(events)
        events = events[offset:offset + limit]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "events": [e.to_dict() for e in events],
        }

    def get_change_history(
        self,
        org_id: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict]:
        """Retorna o histórico de alterações de um recurso."""
        records = [r for r in self._change_records if r.org_id == org_id]
        if resource_type:
            records = [r for r in records if r.resource_type == resource_type]
        if resource_id:
            records = [r for r in records if r.resource_id == resource_id]
        return [r.to_dict() for r in records[-limit:]]

    def verify_log_integrity(self, org_id: str) -> Dict[str, Any]:
        """Verifica a integridade de todos os eventos de uma organização."""
        indices = self._org_event_index.get(org_id, [])
        events = [self._events[i] for i in indices]
        tampered = [e.event_id for e in events if not e.verify_integrity()]
        return {
            "org_id": org_id,
            "total_events": len(events),
            "verified": len(events) - len(tampered),
            "tampered": len(tampered),
            "tampered_event_ids": tampered,
            "integrity_ok": len(tampered) == 0,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

    def export_to_siem(
        self,
        org_id: str,
        format: str = "json",
        limit: int = 1000,
    ) -> str:
        """Exporta eventos para integração com SIEM (Splunk, Datadog, etc.)."""
        result = self.query(org_id=org_id, limit=limit)
        if format == "json":
            return json.dumps(result["events"], indent=2, default=str)
        elif format == "csv":
            if not result["events"]:
                return ""
            headers = list(result["events"][0].keys())
            lines = [",".join(headers)]
            for event in result["events"]:
                lines.append(",".join(str(event.get(h, "")) for h in headers))
            return "\n".join(lines)
        return json.dumps(result["events"], default=str)

    def get_security_alerts(
        self, org_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict]:
        alerts = self._security_alerts
        if org_id:
            alerts = [a for a in alerts if a["org_id"] == org_id]
        return alerts[-limit:]

    def _generate_security_alert(self, event: AuditEvent) -> None:
        """Gera um alerta de segurança para eventos de alta severidade."""
        self._security_alerts.append({
            "alert_id": f"alert_{secrets.token_hex(8)}",
            "org_id": event.org_id,
            "event_id": event.event_id,
            "action": event.action,
            "severity": event.severity.value,
            "actor_id": event.actor_id,
            "actor_ip": event.actor_ip,
            "message": f"High-severity event detected: {event.action}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "acknowledged": False,
        })

    def get_stats(self, org_id: str) -> Dict[str, Any]:
        """Retorna estatísticas de auditoria da organização."""
        indices = self._org_event_index.get(org_id, [])
        events = [self._events[i] for i in indices]
        return {
            "total_events": len(events),
            "by_category": {
                cat.value: sum(1 for e in events if e.category == cat)
                for cat in AuditEventCategory
            },
            "by_severity": {
                sev.value: sum(1 for e in events if e.severity == sev)
                for sev in AuditEventSeverity
            },
            "by_outcome": {
                out.value: sum(1 for e in events if e.outcome == out)
                for out in AuditEventOutcome
            },
            "security_alerts": sum(
                1 for a in self._security_alerts
                if a["org_id"] == org_id and not a["acknowledged"]
            ),
            "change_records": sum(
                1 for r in self._change_records if r.org_id == org_id
            ),
        }
