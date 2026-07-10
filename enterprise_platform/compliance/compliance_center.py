"""
LifeOS Enterprise Platform — Compliance Center
EXECUTION-010: Enterprise Platform

Gerenciamento de conformidade regulatória:
- ISO 27001 (Information Security Management)
- SOC 2 Type II (Security, Availability, Confidentiality)
- LGPD (Lei Geral de Proteção de Dados — Brasil)
- GDPR (General Data Protection Regulation — EU)
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class ComplianceFramework(str, Enum):
    ISO_27001 = "iso_27001"
    SOC2 = "soc2"
    LGPD = "lgpd"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"


class ControlStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIAL = "partial"
    NOT_APPLICABLE = "not_applicable"
    UNDER_REVIEW = "under_review"


class DataSubjectRequestType(str, Enum):
    ACCESS = "access"           # Direito de acesso (LGPD Art. 18 / GDPR Art. 15)
    RECTIFICATION = "rectification"  # Correção de dados
    ERASURE = "erasure"         # Direito ao esquecimento
    PORTABILITY = "portability" # Portabilidade de dados
    RESTRICTION = "restriction" # Restrição de processamento
    OBJECTION = "objection"     # Oposição ao processamento
    WITHDRAW_CONSENT = "withdraw_consent"


class DataSubjectRequestStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ComplianceControl:
    """Controle de conformidade individual."""
    framework: ComplianceFramework
    control_id: str              # Ex: "ISO-A.9.1.1", "SOC2-CC6.1"
    name: str
    description: str
    status: ControlStatus = ControlStatus.UNDER_REVIEW
    evidence: List[str] = field(default_factory=list)
    last_assessed_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    owner: str = ""
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "control_id": self.control_id,
            "framework": self.framework.value,
            "name": self.name,
            "status": self.status.value,
            "evidence_count": len(self.evidence),
            "last_assessed_at": self.last_assessed_at.isoformat() if self.last_assessed_at else None,
            "owner": self.owner,
        }


@dataclass
class DataSubjectRequest:
    """Solicitação de titular de dados (LGPD/GDPR)."""
    org_id: str
    request_type: DataSubjectRequestType
    subject_email: str
    subject_name: str = ""
    request_id: str = field(default_factory=lambda: f"dsr_{secrets.token_hex(10)}")
    status: DataSubjectRequestStatus = DataSubjectRequestStatus.PENDING
    description: str = ""
    assigned_to: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    due_at: Optional[datetime] = None   # Prazo legal (LGPD: 15 dias, GDPR: 30 dias)
    completed_at: Optional[datetime] = None
    response: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "request_id": self.request_id,
            "org_id": self.org_id,
            "type": self.request_type.value,
            "subject_email": self.subject_email,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class DataBreachIncident:
    """Incidente de violação de dados."""
    org_id: str
    title: str
    description: str
    incident_id: str = field(default_factory=lambda: f"breach_{secrets.token_hex(8)}")
    severity: str = "medium"
    affected_users_count: int = 0
    data_types_affected: List[str] = field(default_factory=list)
    discovered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    reported_to_authority: bool = False
    reported_at: Optional[datetime] = None
    authority_reference: str = ""
    remediation_steps: List[str] = field(default_factory=list)
    status: str = "open"
    # LGPD: notificar ANPD em até 72h
    # GDPR: notificar DPA em até 72h
    notification_deadline_hours: int = 72

    def to_dict(self) -> dict:
        return {
            "incident_id": self.incident_id,
            "org_id": self.org_id,
            "title": self.title,
            "severity": self.severity,
            "affected_users": self.affected_users_count,
            "discovered_at": self.discovered_at.isoformat(),
            "reported_to_authority": self.reported_to_authority,
            "status": self.status,
        }


# ── Framework Controls ─────────────────────────────────────────────────────

ISO_27001_CONTROLS = [
    ("ISO-A.5.1.1", "Information Security Policies", "Policies for information security"),
    ("ISO-A.6.1.1", "Information Security Roles", "Defined security roles and responsibilities"),
    ("ISO-A.8.1.1", "Asset Inventory", "Inventory of assets maintained"),
    ("ISO-A.9.1.1", "Access Control Policy", "Access control policy established"),
    ("ISO-A.9.2.1", "User Registration", "User registration and de-registration process"),
    ("ISO-A.9.4.1", "Information Access Restriction", "Access to information restricted"),
    ("ISO-A.10.1.1", "Encryption Policy", "Policy on use of cryptographic controls"),
    ("ISO-A.12.1.1", "Operational Procedures", "Documented operating procedures"),
    ("ISO-A.12.4.1", "Event Logging", "Event logs recorded and maintained"),
    ("ISO-A.13.1.1", "Network Controls", "Networks managed and controlled"),
    ("ISO-A.16.1.1", "Incident Management", "Responsibilities for incident management"),
    ("ISO-A.18.1.1", "Applicable Legislation", "Statutory/regulatory requirements identified"),
]

SOC2_CONTROLS = [
    ("SOC2-CC1.1", "COSO Principle 1", "Demonstrates commitment to integrity and ethical values"),
    ("SOC2-CC2.1", "Board Oversight", "Board exercises oversight responsibility"),
    ("SOC2-CC6.1", "Logical Access", "Logical access security measures implemented"),
    ("SOC2-CC6.2", "Authentication", "Prior to issuing credentials, entity registers users"),
    ("SOC2-CC6.3", "Access Removal", "Access removed when no longer required"),
    ("SOC2-CC7.1", "System Monitoring", "Detects and monitors for security events"),
    ("SOC2-CC7.2", "Incident Response", "Security incidents identified and responded to"),
    ("SOC2-CC8.1", "Change Management", "Change management process followed"),
    ("SOC2-A1.1", "Availability", "Current processing capacity managed"),
    ("SOC2-C1.1", "Confidentiality", "Confidential information identified and protected"),
]

LGPD_CONTROLS = [
    ("LGPD-Art6", "Principles of Processing", "Data processing follows LGPD principles"),
    ("LGPD-Art7", "Legal Basis", "Legal basis for processing identified"),
    ("LGPD-Art8", "Consent Management", "Consent obtained and managed properly"),
    ("LGPD-Art18", "Data Subject Rights", "Mechanisms for exercising data subject rights"),
    ("LGPD-Art37", "DPO Appointment", "Data Protection Officer appointed"),
    ("LGPD-Art46", "Security Measures", "Technical and administrative security measures"),
    ("LGPD-Art48", "Breach Notification", "ANPD notified within 72h of breach"),
    ("LGPD-Art50", "Privacy by Design", "Privacy by design implemented"),
]

GDPR_CONTROLS = [
    ("GDPR-Art5", "Data Processing Principles", "Personal data processed lawfully and fairly"),
    ("GDPR-Art6", "Lawfulness of Processing", "Legal basis for processing documented"),
    ("GDPR-Art7", "Consent", "Consent freely given, specific, and informed"),
    ("GDPR-Art13", "Privacy Notice", "Privacy notice provided to data subjects"),
    ("GDPR-Art17", "Right to Erasure", "Right to erasure (right to be forgotten) honored"),
    ("GDPR-Art20", "Data Portability", "Data portability provided upon request"),
    ("GDPR-Art25", "Privacy by Design", "Data protection by design and by default"),
    ("GDPR-Art30", "Records of Processing", "Records of processing activities maintained"),
    ("GDPR-Art32", "Security of Processing", "Appropriate technical and organizational measures"),
    ("GDPR-Art33", "Breach Notification", "Supervisory authority notified within 72h"),
    ("GDPR-Art37", "DPO", "Data Protection Officer designated"),
]


class ComplianceCenter:
    """
    Central de Compliance do LifeOS Enterprise.

    Funcionalidades:
    - Rastreamento de controles por framework
    - Gestão de solicitações de titulares (LGPD/GDPR)
    - Registro e gestão de incidentes de violação de dados
    - Dashboard de conformidade com score por framework
    - Relatórios de auditoria de compliance
    """

    def __init__(self):
        self._controls: Dict[str, List[ComplianceControl]] = {}  # org_id -> controls
        self._dsr_requests: List[DataSubjectRequest] = []
        self._breach_incidents: List[DataBreachIncident] = []
        self._org_frameworks: Dict[str, List[ComplianceFramework]] = {}

    def enable_framework(
        self,
        org_id: str,
        framework: ComplianceFramework,
    ) -> List[ComplianceControl]:
        """Habilita um framework de compliance e cria seus controles."""
        if org_id not in self._org_frameworks:
            self._org_frameworks[org_id] = []
        if framework not in self._org_frameworks[org_id]:
            self._org_frameworks[org_id].append(framework)

        controls = self._create_framework_controls(framework)
        if org_id not in self._controls:
            self._controls[org_id] = []

        # Evitar duplicatas
        existing_ids = {c.control_id for c in self._controls[org_id]}
        new_controls = [c for c in controls if c.control_id not in existing_ids]
        self._controls[org_id].extend(new_controls)
        return new_controls

    def _create_framework_controls(
        self, framework: ComplianceFramework
    ) -> List[ComplianceControl]:
        """Cria os controles para um framework específico."""
        control_map = {
            ComplianceFramework.ISO_27001: ISO_27001_CONTROLS,
            ComplianceFramework.SOC2: SOC2_CONTROLS,
            ComplianceFramework.LGPD: LGPD_CONTROLS,
            ComplianceFramework.GDPR: GDPR_CONTROLS,
        }
        raw_controls = control_map.get(framework, [])
        return [
            ComplianceControl(
                framework=framework,
                control_id=cid,
                name=name,
                description=desc,
                status=ControlStatus.UNDER_REVIEW,
            )
            for cid, name, desc in raw_controls
        ]

    def update_control_status(
        self,
        org_id: str,
        control_id: str,
        status: ControlStatus,
        evidence: Optional[List[str]] = None,
        notes: str = "",
        owner: str = "",
    ) -> bool:
        """Atualiza o status de um controle de compliance."""
        controls = self._controls.get(org_id, [])
        for control in controls:
            if control.control_id == control_id:
                control.status = status
                control.last_assessed_at = datetime.now(timezone.utc)
                if evidence:
                    control.evidence.extend(evidence)
                if notes:
                    control.notes = notes
                if owner:
                    control.owner = owner
                return True
        return False

    def get_compliance_score(self, org_id: str) -> Dict[str, Any]:
        """Calcula o score de conformidade por framework."""
        controls = self._controls.get(org_id, [])
        frameworks = self._org_frameworks.get(org_id, [])

        scores = {}
        for framework in frameworks:
            fw_controls = [c for c in controls if c.framework == framework]
            if not fw_controls:
                continue
            compliant = sum(1 for c in fw_controls if c.status == ControlStatus.COMPLIANT)
            partial = sum(1 for c in fw_controls if c.status == ControlStatus.PARTIAL)
            na = sum(1 for c in fw_controls if c.status == ControlStatus.NOT_APPLICABLE)
            applicable = len(fw_controls) - na
            score = ((compliant + partial * 0.5) / applicable * 100) if applicable > 0 else 0
            scores[framework.value] = {
                "score": round(score, 1),
                "total_controls": len(fw_controls),
                "compliant": compliant,
                "partial": partial,
                "non_compliant": sum(1 for c in fw_controls if c.status == ControlStatus.NON_COMPLIANT),
                "under_review": sum(1 for c in fw_controls if c.status == ControlStatus.UNDER_REVIEW),
                "not_applicable": na,
            }

        overall = (
            sum(s["score"] for s in scores.values()) / len(scores)
            if scores else 0
        )
        return {
            "org_id": org_id,
            "overall_score": round(overall, 1),
            "frameworks": scores,
            "enabled_frameworks": [f.value for f in frameworks],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── Data Subject Requests (LGPD/GDPR) ─────────────────────────────────

    def submit_dsr(
        self,
        org_id: str,
        request_type: DataSubjectRequestType,
        subject_email: str,
        subject_name: str = "",
        description: str = "",
    ) -> DataSubjectRequest:
        """Registra uma solicitação de titular de dados."""
        from datetime import timedelta
        # LGPD: 15 dias úteis | GDPR: 30 dias
        deadline_days = 15
        request = DataSubjectRequest(
            org_id=org_id,
            request_type=request_type,
            subject_email=subject_email,
            subject_name=subject_name,
            description=description,
            due_at=datetime.now(timezone.utc) + timedelta(days=deadline_days),
        )
        self._dsr_requests.append(request)
        return request

    def process_dsr(
        self,
        request_id: str,
        status: DataSubjectRequestStatus,
        response: str = "",
        assigned_to: Optional[str] = None,
    ) -> bool:
        for req in self._dsr_requests:
            if req.request_id == request_id:
                req.status = status
                req.response = response
                if assigned_to:
                    req.assigned_to = assigned_to
                if status == DataSubjectRequestStatus.COMPLETED:
                    req.completed_at = datetime.now(timezone.utc)
                return True
        return False

    def list_dsr(
        self,
        org_id: str,
        status: Optional[DataSubjectRequestStatus] = None,
    ) -> List[DataSubjectRequest]:
        requests = [r for r in self._dsr_requests if r.org_id == org_id]
        if status:
            requests = [r for r in requests if r.status == status]
        return requests

    # ── Data Breach Management ─────────────────────────────────────────────

    def report_breach(
        self,
        org_id: str,
        title: str,
        description: str,
        severity: str = "medium",
        affected_users_count: int = 0,
        data_types_affected: Optional[List[str]] = None,
    ) -> DataBreachIncident:
        """Registra um incidente de violação de dados."""
        incident = DataBreachIncident(
            org_id=org_id,
            title=title,
            description=description,
            severity=severity,
            affected_users_count=affected_users_count,
            data_types_affected=data_types_affected or [],
        )
        self._breach_incidents.append(incident)
        return incident

    def get_controls(
        self,
        org_id: str,
        framework: Optional[ComplianceFramework] = None,
        status: Optional[ControlStatus] = None,
    ) -> List[ComplianceControl]:
        controls = self._controls.get(org_id, [])
        if framework:
            controls = [c for c in controls if c.framework == framework]
        if status:
            controls = [c for c in controls if c.status == status]
        return controls

    def get_dashboard(self, org_id: str) -> Dict[str, Any]:
        """Retorna dados completos para o Compliance Dashboard."""
        score = self.get_compliance_score(org_id)
        pending_dsr = len(self.list_dsr(org_id, DataSubjectRequestStatus.PENDING))
        open_breaches = sum(
            1 for b in self._breach_incidents
            if b.org_id == org_id and b.status == "open"
        )
        return {
            **score,
            "pending_dsr_requests": pending_dsr,
            "open_breach_incidents": open_breaches,
            "total_breach_incidents": sum(
                1 for b in self._breach_incidents if b.org_id == org_id
            ),
            "total_dsr_requests": len(self.list_dsr(org_id)),
        }
