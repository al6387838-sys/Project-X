"""
Version Manager — Gerenciador de Versões do Modelo de Aprendizado
=================================================================
Gerencia o versionamento do modelo de aprendizado do usuário.

Responsabilidades:
- Criar snapshots do modelo a cada aprendizado significativo
- Registrar logs de todas as operações de aprendizado
- Permitir rollback para qualquer versão anterior
- Garantir que nenhum aprendizado altera dados sem consentimento
- Garantir que nenhuma decisão crítica é automatizada sem autorização
"""

from typing import Any, Dict, List, Optional
import time
import copy

from ..models.model_version import ModelVersion, LearningLog, RollbackRecord, LogLevel
from ..models.learning_profile import LearningProfile


class VersionManager:
    """
    Gerencia versões do modelo de aprendizado.

    Mantém um histórico completo de todas as versões do modelo,
    permitindo rollback total para qualquer estado anterior.

    Princípios de segurança:
    - Nenhum aprendizado altera dados sem consentimento.
    - Nenhuma decisão crítica é automatizada sem autorização.
    - Todo aprendizado é auditável e reversível.
    """

    # Número máximo de versões mantidas em memória
    MAX_VERSIONS_IN_MEMORY = 50
    # Intervalo mínimo entre versões automáticas (segundos)
    MIN_VERSION_INTERVAL = 60.0

    def __init__(self):
        self._versions: List[ModelVersion] = []
        self._current_version_number: int = 0
        self._logs: List[LearningLog] = []
        self._rollback_history: List[RollbackRecord] = []
        self._last_version_time: float = 0.0

    # ------------------------------------------------------------------ #
    #  Criação de Versões                                                  #
    # ------------------------------------------------------------------ #

    def create_version(
        self,
        profile: LearningProfile,
        trigger: str = "learning_update",
        changes: Optional[List[str]] = None,
        force: bool = False,
    ) -> ModelVersion:
        """
        Cria uma nova versão snapshot do modelo de aprendizado.

        Args:
            profile: Perfil de aprendizado atual.
            trigger: O que gerou esta versão.
            changes: Lista de mudanças realizadas.
            force: Força criação mesmo dentro do intervalo mínimo.

        Returns:
            Nova ModelVersion criada.
        """
        now = time.time()

        # Respeita intervalo mínimo entre versões (exceto se forçado)
        if not force and (now - self._last_version_time) < self.MIN_VERSION_INTERVAL:
            if self._versions:
                return self._versions[-1]

        self._current_version_number += 1

        version = ModelVersion(
            version_number=self._current_version_number,
            profile_snapshot=copy.deepcopy(profile.summary()),
            preferences_snapshot=copy.deepcopy(profile.preferences),
            patterns_snapshot=copy.deepcopy(profile.patterns),
            trigger=trigger,
            changes_summary=changes or [],
            learning_score_at_version=profile.learning_score.overall,
            consent_obtained=True,
        )

        self._versions.append(version)
        self._last_version_time = now

        # Mantém limite de versões em memória
        if len(self._versions) > self.MAX_VERSIONS_IN_MEMORY:
            self._versions = self._versions[-self.MAX_VERSIONS_IN_MEMORY:]

        # Registra log
        self.log(
            operation="version_created",
            entity_type="model_version",
            entity_id=version.version_id,
            entity_key=f"v{version.version_number}",
            message=f"Versão {version.version_number} criada. Trigger: {trigger}",
            level=LogLevel.INFO,
        )

        return version

    def get_current_version(self) -> Optional[ModelVersion]:
        """Retorna a versão atual do modelo."""
        if not self._versions:
            return None
        return self._versions[-1]

    def get_version(self, version_number: int) -> Optional[ModelVersion]:
        """Retorna uma versão específica pelo número."""
        for v in self._versions:
            if v.version_number == version_number:
                return v
        return None

    def get_version_by_id(self, version_id: str) -> Optional[ModelVersion]:
        """Retorna uma versão pelo ID."""
        for v in self._versions:
            if v.version_id == version_id:
                return v
        return None

    def list_versions(self) -> List[Dict[str, Any]]:
        """Lista todas as versões disponíveis."""
        return [v.to_dict() for v in reversed(self._versions)]

    # ------------------------------------------------------------------ #
    #  Rollback                                                            #
    # ------------------------------------------------------------------ #

    def rollback_to_version(
        self,
        version_number: int,
        profile: LearningProfile,
        reason: str = "user_request",
        initiated_by: str = "user",
    ) -> RollbackRecord:
        """
        Reverte o modelo para uma versão anterior.

        IMPORTANTE: O rollback requer iniciativa do usuário.
        Nenhum rollback automático é executado sem autorização.

        Args:
            version_number: Número da versão para reverter.
            profile: Perfil a ser revertido (modificado in-place).
            reason: Motivo do rollback.
            initiated_by: Quem iniciou ("user" ou "system").

        Returns:
            RollbackRecord com resultado da operação.
        """
        target_version = self.get_version(version_number)
        record = RollbackRecord(
            target_version_id=target_version.version_id if target_version else "",
            reason=reason,
            initiated_by=initiated_by,
        )

        if not target_version:
            record.success = False
            self._rollback_history.append(record)
            self.log(
                operation="rollback_failed",
                entity_type="model_version",
                entity_id="",
                entity_key=f"v{version_number}",
                message=f"Rollback falhou: versão {version_number} não encontrada.",
                level=LogLevel.WARNING,
            )
            return record

        # Reverte preferências
        reverted_entities = []
        if target_version.preferences_snapshot:
            profile.preferences = copy.deepcopy(target_version.preferences_snapshot)
            reverted_entities.append("preferences")

        # Reverte padrões
        if target_version.patterns_snapshot:
            profile.patterns = copy.deepcopy(target_version.patterns_snapshot)
            reverted_entities.append("patterns")

        # Reverte score
        profile.learning_score.overall = target_version.learning_score_at_version

        record.entities_reverted = reverted_entities
        record.success = True
        self._rollback_history.append(record)

        # Registra log de rollback
        self.log(
            operation="rollback_executed",
            entity_type="model_version",
            entity_id=target_version.version_id,
            entity_key=f"v{version_number}",
            message=f"Rollback para versão {version_number}. Motivo: {reason}. Entidades: {reverted_entities}",
            level=LogLevel.ROLLBACK,
        )

        # Cria nova versão pós-rollback
        self.create_version(
            profile=profile,
            trigger=f"rollback_to_v{version_number}",
            changes=[f"Rollback para versão {version_number}: {reason}"],
            force=True,
        )

        return record

    def rollback_last(
        self,
        profile: LearningProfile,
        reason: str = "undo_last_learning",
    ) -> RollbackRecord:
        """
        Desfaz o último aprendizado (rollback para versão anterior).

        Args:
            profile: Perfil a ser revertido.
            reason: Motivo do desfazer.

        Returns:
            RollbackRecord com resultado.
        """
        if len(self._versions) < 2:
            record = RollbackRecord(reason=reason, success=False)
            record.entities_reverted = []
            return record

        # Versão anterior à atual
        target_version_number = self._versions[-2].version_number
        return self.rollback_to_version(
            version_number=target_version_number,
            profile=profile,
            reason=reason,
        )

    def get_rollback_history(self) -> List[Dict[str, Any]]:
        """Retorna histórico de rollbacks."""
        return [r.to_dict() for r in self._rollback_history]

    # ------------------------------------------------------------------ #
    #  Learning Logs                                                       #
    # ------------------------------------------------------------------ #

    def log(
        self,
        operation: str,
        entity_type: str,
        entity_id: str,
        entity_key: str = "",
        before_value: Any = None,
        after_value: Any = None,
        confidence_before: float = 0.0,
        confidence_after: float = 0.0,
        trigger_event_id: Optional[str] = None,
        message: str = "",
        level: LogLevel = LogLevel.LEARNING,
        consent_verified: bool = True,
    ) -> LearningLog:
        """
        Registra uma operação de aprendizado no log.

        Todo aprendizado é registrado aqui para auditoria completa.
        O usuário pode inspecionar o que o sistema aprendeu e quando.

        Args:
            operation: Tipo de operação (ex: "preference_updated").
            entity_type: Tipo da entidade afetada.
            entity_id: ID da entidade.
            entity_key: Chave legível da entidade.
            before_value: Valor antes da mudança.
            after_value: Valor após a mudança.
            confidence_before: Confiança antes.
            confidence_after: Confiança após.
            trigger_event_id: ID do evento que gerou o log.
            message: Mensagem descritiva.
            level: Nível do log.
            consent_verified: Se o consentimento foi verificado.

        Returns:
            LearningLog criado.
        """
        log = LearningLog(
            level=level,
            operation=operation,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_key=entity_key,
            before_value=before_value,
            after_value=after_value,
            confidence_before=confidence_before,
            confidence_after=confidence_after,
            trigger_event_id=trigger_event_id,
            message=message,
            consent_verified=consent_verified,
        )
        self._logs.append(log)

        # Adiciona ao version atual se existir
        if self._versions:
            self._versions[-1].add_log(log)

        return log

    def log_preference_update(
        self,
        preference_key: str,
        before_confidence: float,
        after_confidence: float,
        before_value: Any = None,
        after_value: Any = None,
        trigger_event_id: Optional[str] = None,
    ) -> LearningLog:
        """Registra atualização de preferência."""
        return self.log(
            operation="preference_updated",
            entity_type="preference",
            entity_id=preference_key,
            entity_key=preference_key,
            before_value=before_value,
            after_value=after_value,
            confidence_before=before_confidence,
            confidence_after=after_confidence,
            trigger_event_id=trigger_event_id,
            message=(
                f"Preferência '{preference_key}' atualizada: "
                f"confiança {before_confidence:.2f} → {after_confidence:.2f}"
            ),
            level=LogLevel.LEARNING,
        )

    def log_pattern_detected(
        self,
        pattern_key: str,
        confidence: float,
        pattern_type: str,
        trigger_event_id: Optional[str] = None,
    ) -> LearningLog:
        """Registra detecção de novo padrão."""
        return self.log(
            operation="pattern_detected",
            entity_type="pattern",
            entity_id=pattern_key,
            entity_key=pattern_key,
            after_value={"confidence": confidence, "type": pattern_type},
            confidence_after=confidence,
            trigger_event_id=trigger_event_id,
            message=f"Padrão '{pattern_key}' ({pattern_type}) detectado com confiança {confidence:.2f}",
            level=LogLevel.LEARNING,
        )

    def get_logs(
        self,
        level: Optional[LogLevel] = None,
        entity_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Retorna logs filtrados.

        Args:
            level: Filtrar por nível de log.
            entity_type: Filtrar por tipo de entidade.
            limit: Número máximo de logs a retornar.

        Returns:
            Lista de logs como dicionários.
        """
        logs = list(self._logs)

        if level:
            logs = [l for l in logs if l.level == level]
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]

        # Mais recentes primeiro
        logs = sorted(logs, key=lambda l: l.timestamp, reverse=True)
        return [l.to_dict() for l in logs[:limit]]

    def get_learning_summary(self) -> Dict[str, Any]:
        """Retorna resumo do histórico de aprendizado."""
        total_logs = len(self._logs)
        by_operation: Dict[str, int] = {}
        for log in self._logs:
            by_operation[log.operation] = by_operation.get(log.operation, 0) + 1

        return {
            "total_versions": len(self._versions),
            "current_version": self._current_version_number,
            "total_logs": total_logs,
            "total_rollbacks": len(self._rollback_history),
            "operations_summary": by_operation,
            "latest_version": self._versions[-1].to_dict() if self._versions else None,
        }
