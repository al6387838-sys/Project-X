"""
ModelVersion — Versionamento do Modelo de Aprendizado
======================================================
Registra cada versão do modelo de aprendizado do usuário.
Permite rollback completo para qualquer estado anterior.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class LogLevel(str, Enum):
    """Nível de um log de aprendizado."""
    INFO     = "info"
    LEARNING = "learning"
    WARNING  = "warning"
    ROLLBACK = "rollback"
    CONSENT  = "consent"


@dataclass
class LearningLog:
    """
    Registro de uma operação de aprendizado.

    Todo aprendizado é registrado aqui para auditoria completa.
    O usuário pode inspecionar o que o sistema aprendeu e quando.
    """
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    level: LogLevel = LogLevel.LEARNING

    # O que foi aprendido
    operation: str = ""              # Ex: "preference_updated", "pattern_detected"
    entity_type: str = ""            # "preference", "pattern", "profile"
    entity_id: str = ""
    entity_key: str = ""

    # Antes e depois
    before_value: Any = None
    after_value: Any = None
    confidence_before: float = 0.0
    confidence_after: float = 0.0

    # Contexto
    trigger_event_id: Optional[str] = None
    model_version_id: Optional[str] = None
    message: str = ""

    # Consentimento
    consent_verified: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "timestamp": self.timestamp,
            "level": self.level.value,
            "operation": self.operation,
            "entity_type": self.entity_type,
            "entity_key": self.entity_key,
            "before_value": self.before_value,
            "after_value": self.after_value,
            "confidence_before": self.confidence_before,
            "confidence_after": self.confidence_after,
            "message": self.message,
            "consent_verified": self.consent_verified,
        }


@dataclass
class RollbackRecord:
    """
    Registro de um rollback de aprendizado.

    Quando o usuário solicita desfazer um aprendizado,
    este registro documenta o que foi revertido.
    """
    rollback_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)

    target_version_id: str = ""      # Versão para a qual foi revertido
    reason: str = ""                 # Motivo do rollback
    entities_reverted: List[str] = field(default_factory=list)
    initiated_by: str = "user"       # "user" ou "system"
    success: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rollback_id": self.rollback_id,
            "timestamp": self.timestamp,
            "target_version_id": self.target_version_id,
            "reason": self.reason,
            "entities_reverted": self.entities_reverted,
            "initiated_by": self.initiated_by,
            "success": self.success,
        }


@dataclass
class ModelVersion:
    """
    Uma versão snapshot do modelo de aprendizado.

    Cada vez que o modelo aprende algo significativo,
    uma nova versão é criada. Isso permite rollback total.

    Nenhum aprendizado altera dados sem consentimento.
    Nenhuma decisão crítica é automatizada sem autorização.
    """
    version_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    version_number: int = 1
    created_at: float = field(default_factory=time.time)

    # Snapshot do estado
    profile_snapshot: Dict[str, Any] = field(default_factory=dict)
    preferences_snapshot: Dict[str, Any] = field(default_factory=dict)
    patterns_snapshot: Dict[str, Any] = field(default_factory=dict)

    # Metadados da versão
    trigger: str = ""                # O que gerou esta versão
    changes_summary: List[str] = field(default_factory=list)
    learning_score_at_version: float = 0.0

    # Logs desta versão
    logs: List[LearningLog] = field(default_factory=list)

    # Rollbacks
    rollback_records: List[RollbackRecord] = field(default_factory=list)

    # Flags de segurança
    is_stable: bool = True
    requires_consent: bool = False
    consent_obtained: bool = True

    def add_log(self, log: LearningLog) -> None:
        self.logs.append(log)

    def add_rollback(self, record: RollbackRecord) -> None:
        self.rollback_records.append(record)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "version_number": self.version_number,
            "created_at": self.created_at,
            "trigger": self.trigger,
            "changes_summary": self.changes_summary,
            "learning_score_at_version": self.learning_score_at_version,
            "total_logs": len(self.logs),
            "total_rollbacks": len(self.rollback_records),
            "is_stable": self.is_stable,
            "consent_obtained": self.consent_obtained,
        }
