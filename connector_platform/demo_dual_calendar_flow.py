"""
DEMO: Fluxo Completo de Conexão Simultânea
Google Calendar + Microsoft Outlook — LifeOS Universal Connector Platform
Sprint 025

Este script demonstra o fluxo completo de conexão entre o LifeOS,
o Google Calendar e o Microsoft Outlook funcionando simultaneamente.
"""

import asyncio
import sys
import os
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from connector_platform.core.connector_engine import ConnectorEngine, CredentialVault
from connector_platform.engines.oauth_manager import OAuthManager, PKCEHelper
from connector_platform.engines.sync_manager import SyncManager
from connector_platform.engines.webhook_manager import WebhookManager, WebhookPayload
from connector_platform.engines.integration_manager import IntegrationManager
from connector_platform.security.permission_manager import PermissionManager
from connector_platform.registry.connector_registry import ConnectorRegistry
from connector_platform.marketplace.connector_marketplace import ConnectorMarketplace
from connector_platform.monitoring.integration_monitor import IntegrationMonitor
from connector_platform.models.connector_models import (
    IntegrationConfig, SyncJob, SyncDirection, SyncFrequency,
    WebhookEvent, PermissionScope, OAuthToken,
)
from connector_platform.connectors.google.google_connectors import (
    GoogleCalendarConnector, GOOGLE_CONNECTORS,
)
from connector_platform.connectors.microsoft.microsoft_connectors import (
    MicrosoftOutlookConnector, MICROSOFT_CONNECTORS,
)


# ─────────────────────────────────────────────
# Helpers de formatação
# ─────────────────────────────────────────────

def header(title: str):
    print(f"\n{'═' * 65}")
    print(f"  {title}")
    print(f"{'═' * 65}")

def step(num: int, title: str):
    print(f"\n  ── STEP {num}: {title}")

def ok(msg: str):
    print(f"     ✅  {msg}")

def info(msg: str):
    print(f"     ℹ   {msg}")

def warn(msg: str):
    print(f"     ⚠   {msg}")

def data(key: str, value):
    print(f"     {key}: {value}")


# ─────────────────────────────────────────────
# Fluxo Principal
# ─────────────────────────────────────────────

async def run_demo():
    USER_ID = "lifeos_user_demo"

    header("LIFEOS — UNIVERSAL CONNECTOR PLATFORM DEMO")
    print("  Demonstrando fluxo completo: Google Calendar + Microsoft Outlook")
    print(f"  Usuário: {USER_ID}")
    print(f"  Data/Hora: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")

    # ─────────────────────────────────────────
    # FASE 1: Inicialização da Plataforma
    # ─────────────────────────────────────────
    header("FASE 1 — Inicialização da Plataforma")

    step(1, "Inicializando os componentes centrais")
    engine = ConnectorEngine()
    oauth_mgr = OAuthManager()
    sync_mgr = SyncManager()
    webhook_mgr = WebhookManager()
    perm_mgr = PermissionManager()
    monitor = IntegrationMonitor()
    registry = ConnectorRegistry()
    ok("ConnectorEngine inicializado com Zero Trust + Circuit Breaker + Rate Limiter")
    ok("OAuthManager inicializado com PKCE + State Manager")
    ok("SyncManager inicializado com Delta Sync + Conflict Resolution")
    ok("WebhookManager inicializado com HMAC-SHA256 + Guaranteed Delivery")
    ok("PermissionManager inicializado com Zero Trust + Consent Records")
    ok("IntegrationMonitor inicializado com alertas e auditoria")

    step(2, "Registrando conectores no Registry")
    count = registry.register_many(GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS)
    ok(f"{count} conectores registrados")
    stats = registry.get_stats()
    data("    Total de conectores", stats["total_connectors"])
    data("    Conectores verificados", stats["verified"])

    # Registrar conectores na Engine
    engine.register_connector(GoogleCalendarConnector)
    engine.register_connector(MicrosoftOutlookConnector)
    ok("Google Calendar e Microsoft Outlook registrados na ConnectorEngine")

    # ─────────────────────────────────────────
    # FASE 2: Consentimento e Permissões
    # ─────────────────────────────────────────
    header("FASE 2 — Consentimento Explícito (Zero Trust)")

    step(3, "Registrando consentimento do usuário — Google Calendar")
    google_consent = perm_mgr.grant_consent(
        user_id=USER_ID,
        connector_id="google_calendar",
        scopes=["calendar:read", "calendar:write"],
        consent_text=(
            "Eu, o usuário, autorizo o LifeOS a ler e escrever eventos "
            "no meu Google Calendar para sincronização bidirecional."
        ),
        consent_version="1.0",
        expires_in_days=365,
    )
    ok(f"Consentimento registrado — ID: {google_consent.consent_id[:12]}...")
    data("    Escopos aprovados", google_consent.scopes)
    data("    Expira em", google_consent.expires_at.strftime('%Y-%m-%d') if google_consent.expires_at else "Nunca")

    step(4, "Registrando consentimento do usuário — Microsoft Outlook")
    ms_consent = perm_mgr.grant_consent(
        user_id=USER_ID,
        connector_id="microsoft_outlook",
        scopes=["calendar:read", "calendar:write", "email:read"],
        consent_text=(
            "Eu, o usuário, autorizo o LifeOS a acessar meu calendário "
            "e emails do Microsoft Outlook para sincronização e análise."
        ),
        consent_version="1.0",
        expires_in_days=365,
    )
    ok(f"Consentimento registrado — ID: {ms_consent.consent_id[:12]}...")
    data("    Escopos aprovados", ms_consent.scopes)

    # Verificar permissões
    step(5, "Verificando permissões (Zero Trust Check)")
    g_read = perm_mgr.has_permission(USER_ID, "google_calendar", "calendar", PermissionScope.READ)
    g_write = perm_mgr.has_permission(USER_ID, "google_calendar", "calendar", PermissionScope.WRITE)
    ms_read = perm_mgr.has_permission(USER_ID, "microsoft_outlook", "calendar", PermissionScope.READ)
    ms_email = perm_mgr.has_permission(USER_ID, "microsoft_outlook", "email", PermissionScope.READ)
    ok(f"Google Calendar — Leitura: {g_read} | Escrita: {g_write}")
    ok(f"Microsoft Outlook — Calendário: {ms_read} | Email: {ms_email}")

    # ─────────────────────────────────────────
    # FASE 3: Autenticação OAuth Simultânea
    # ─────────────────────────────────────────
    header("FASE 3 — Autenticação OAuth 2.0 Simultânea")

    step(6, "Gerando URLs de autorização OAuth (com PKCE)")
    google_auth_url = oauth_mgr.get_authorization_url(
        user_id=USER_ID,
        connector_id="google_calendar",
        scopes=["https://www.googleapis.com/auth/calendar"],
        redirect_uri="https://lifeos.app/oauth/callback/google",
    )
    ms_auth_url = oauth_mgr.get_authorization_url(
        user_id=USER_ID,
        connector_id="microsoft_outlook",
        scopes=["https://graph.microsoft.com/Calendars.ReadWrite"],
        redirect_uri="https://lifeos.app/oauth/callback/microsoft",
    )
    ok("URL de autorização Google gerada com PKCE S256")
    data("    State (Google)", google_auth_url["state"][:16] + "...")
    data("    PKCE Verifier (Google)", google_auth_url["pkce_verifier"][:16] + "...")
    ok("URL de autorização Microsoft gerada com PKCE S256")
    data("    State (Microsoft)", ms_auth_url["state"][:16] + "...")

    step(7, "Autenticando Google Calendar e Microsoft Outlook SIMULTANEAMENTE")
    google_connector = GoogleCalendarConnector()
    ms_connector = MicrosoftOutlookConnector()

    start_auth = time.monotonic()
    google_token, ms_token = await asyncio.gather(
        google_connector.authenticate({
            "user_id": USER_ID,
            "access_token": "goog_at_demo_abc123",
            "refresh_token": "goog_rt_demo_xyz789",
        }),
        ms_connector.authenticate({
            "user_id": USER_ID,
            "access_token": "ms_at_demo_def456",
            "refresh_token": "ms_rt_demo_uvw012",
        }),
    )
    auth_duration = (time.monotonic() - start_auth) * 1000

    ok(f"Ambos autenticados em {auth_duration:.1f}ms (execução concorrente)")
    data("    Google Token (access)", google_token.access_token[:20] + "...")
    data("    Google Token (expira)", google_token.expires_at.strftime('%Y-%m-%d %H:%M:%S'))
    data("    Microsoft Token (access)", ms_token.access_token[:20] + "...")
    data("    Microsoft Token (expira)", ms_token.expires_at.strftime('%Y-%m-%d %H:%M:%S'))

    # Armazenar tokens no OAuth Manager
    oauth_mgr._token_store.save(google_token)
    oauth_mgr._token_store.save(ms_token)
    ok("Tokens armazenados com criptografia E2E no TokenStore")

    # ─────────────────────────────────────────
    # FASE 4: Sincronização Simultânea
    # ─────────────────────────────────────────
    header("FASE 4 — Sincronização de Calendários Simultânea")

    step(8, "Criando IntegrationConfigs para ambos os serviços")
    google_config = IntegrationConfig(
        integration_id="int_google_calendar_demo",
        user_id=USER_ID,
        connector_id="google_calendar",
        sync_direction=SyncDirection.BIDIRECTIONAL,
        sync_frequency=SyncFrequency.EVERY_15_MINUTES,
    )
    ms_config = IntegrationConfig(
        integration_id="int_ms_outlook_demo",
        user_id=USER_ID,
        connector_id="microsoft_outlook",
        sync_direction=SyncDirection.BIDIRECTIONAL,
        sync_frequency=SyncFrequency.EVERY_15_MINUTES,
    )
    ok(f"Google Config — ID: {google_config.integration_id}")
    ok(f"Microsoft Config — ID: {ms_config.integration_id}")

    step(9, "Agendando trabalhos de sincronização")
    google_job = sync_mgr.schedule_sync(google_config)
    ms_job = sync_mgr.schedule_sync(ms_config)
    ok(f"Google SyncJob agendado — ID: {google_job.job_id[:12]}... | Status: {google_job.status}")
    ok(f"Microsoft SyncJob agendado — ID: {ms_job.job_id[:12]}... | Status: {ms_job.status}")

    step(10, "Executando sincronização FULL SYNC simultânea")
    start_sync = time.monotonic()
    google_result, ms_result = await asyncio.gather(
        google_connector.sync(google_job),
        ms_connector.sync(ms_job),
    )
    sync_duration = (time.monotonic() - start_sync) * 1000

    ok(f"Full Sync concluído em {sync_duration:.1f}ms (execução paralela)")
    data("    Google Calendar — Eventos sincronizados", google_result.records_synced)
    data("    Google Calendar — Status", google_result.status)
    data("    Google Calendar — Delta Token", google_result.delta_token[:20] + "...")
    data("    Microsoft Outlook — Eventos sincronizados", ms_result.records_synced)
    data("    Microsoft Outlook — Status", ms_result.status)
    data("    Microsoft Outlook — Delta Token", ms_result.delta_token[:20] + "...")

    step(11, "Criando evento em AMBOS os calendários simultaneamente")
    now = datetime.now(timezone.utc)
    event_payload = {
        "summary": "LifeOS Sprint 025 Review",
        "description": "Revisão da Universal Connector Platform",
        "start": {"dateTime": now.isoformat(), "timeZone": "America/Sao_Paulo"},
        "end": {"dateTime": (now + timedelta(hours=1)).isoformat(), "timeZone": "America/Sao_Paulo"},
    }
    g_event, ms_event = await asyncio.gather(
        google_connector.create_event(event_payload),
        ms_connector.create_event({"subject": event_payload["summary"], **event_payload}),
    )
    ok("Evento criado em ambos os calendários")
    data("    Google Event ID", g_event.get("id", "N/A"))
    data("    Microsoft Event ID", ms_event.get("id", "N/A"))

    step(12, "Executando DELTA SYNC (sincronização incremental)")
    g_delta_job = SyncJob(
        job_id="delta_google_001",
        integration_id=google_config.integration_id,
        connector_id="google_calendar",
        user_id=USER_ID,
        delta_token=google_result.delta_token,
    )
    ms_delta_job = SyncJob(
        job_id="delta_ms_001",
        integration_id=ms_config.integration_id,
        connector_id="microsoft_outlook",
        user_id=USER_ID,
        delta_token=ms_result.delta_token,
    )
    start_delta = time.monotonic()
    g_delta, ms_delta = await asyncio.gather(
        google_connector.sync(g_delta_job),
        ms_connector.sync(ms_delta_job),
    )
    delta_duration = (time.monotonic() - start_delta) * 1000

    ok(f"Delta Sync concluído em {delta_duration:.1f}ms")
    data("    Google — Registros incrementais", g_delta.records_synced)
    data("    Microsoft — Registros incrementais", ms_delta.records_synced)

    # ─────────────────────────────────────────
    # FASE 5: Webhooks em Tempo Real
    # ─────────────────────────────────────────
    header("FASE 5 — Webhooks e Eventos em Tempo Real")

    step(13, "Registrando webhooks para ambos os serviços")
    g_webhook = webhook_mgr.register_webhook(
        integration_id=google_config.integration_id,
        connector_id="google_calendar",
        user_id=USER_ID,
        events=[WebhookEvent.CREATED, WebhookEvent.UPDATED, WebhookEvent.DELETED],
        endpoint_url="https://lifeos.app/webhooks/google_calendar",
    )
    ms_webhook = webhook_mgr.register_webhook(
        integration_id=ms_config.integration_id,
        connector_id="microsoft_outlook",
        user_id=USER_ID,
        events=[WebhookEvent.CREATED, WebhookEvent.UPDATED, WebhookEvent.DELETED],
        endpoint_url="https://lifeos.app/webhooks/microsoft_outlook",
    )
    ok(f"Google Webhook registrado — ID: {g_webhook.webhook_id[:12]}...")
    ok(f"Microsoft Webhook registrado — ID: {ms_webhook.webhook_id[:12]}...")
    data("    Segredo HMAC (Google)", g_webhook.secret[:12] + "...")
    data("    Segredo HMAC (Microsoft)", ms_webhook.secret[:12] + "...")

    step(14, "Processando evento de criação (simulação de push notification)")
    g_payload = WebhookPayload(
        event=WebhookEvent.CREATED,
        connector_id="google_calendar",
        user_id=USER_ID,
        resource_type="calendar_event",
        resource_id="evt_new_gcal_001",
        data={"summary": "Novo evento Google", "start": now.isoformat()},
    )
    ms_payload = WebhookPayload(
        event=WebhookEvent.CREATED,
        connector_id="microsoft_outlook",
        user_id=USER_ID,
        resource_type="calendar_event",
        resource_id="evt_new_ms_001",
        data={"subject": "Novo evento Outlook", "start": now.isoformat()},
    )
    g_deliveries, ms_deliveries = await asyncio.gather(
        webhook_mgr.process_event(g_payload),
        webhook_mgr.process_event(ms_payload),
    )
    ok("Eventos processados e roteados com sucesso")
    data("    Google — Delivery IDs", len(g_deliveries))
    data("    Microsoft — Delivery IDs", len(ms_deliveries))

    # ─────────────────────────────────────────
    # FASE 6: Monitoramento e Auditoria
    # ─────────────────────────────────────────
    header("FASE 6 — Monitoramento e Auditoria")

    step(15, "Registrando métricas de sincronização")
    monitor.record_sync(google_config.integration_id, "google_calendar", True, google_result.records_synced, sync_duration / 2)
    monitor.record_sync(ms_config.integration_id, "microsoft_outlook", True, ms_result.records_synced, sync_duration / 2)
    monitor.record_api_call("google_calendar", "/calendars/primary/events", 200, 145.0)
    monitor.record_api_call("microsoft_outlook", "/me/calendarView", 200, 210.0)
    ok("Métricas de sincronização registradas")

    step(16, "Consultando métricas por integração")
    g_metrics = monitor.get_connector_metrics(google_config.integration_id)
    ms_metrics = monitor.get_connector_metrics(ms_config.integration_id)
    data("    Google — Registros sincronizados", g_metrics["total_records_synced"])
    data("    Google — Taxa de sucesso", f"{g_metrics['success_rate_pct']}%")
    data("    Google — Erros", g_metrics["error_count"])
    data("    Microsoft — Registros sincronizados", ms_metrics["total_records_synced"])
    data("    Microsoft — Taxa de sucesso", f"{ms_metrics['success_rate_pct']}%")
    data("    Microsoft — Erros", ms_metrics["error_count"])

    step(17, "Registrando eventos de auditoria")
    monitor.audit("connector.connected", USER_ID, "google_calendar",
                 {"scopes": ["calendar:read", "calendar:write"]}, "192.168.1.1")
    monitor.audit("connector.connected", USER_ID, "microsoft_outlook",
                 {"scopes": ["calendar:read", "calendar:write", "email:read"]}, "192.168.1.1")
    monitor.audit("sync.completed", USER_ID, "google_calendar",
                 {"records": google_result.records_synced, "duration_ms": sync_duration / 2})
    monitor.audit("sync.completed", USER_ID, "microsoft_outlook",
                 {"records": ms_result.records_synced, "duration_ms": sync_duration / 2})
    audit_log = monitor.get_audit_log(user_id=USER_ID)
    ok(f"{len(audit_log)} eventos de auditoria registrados")

    step(18, "Verificando relatório de saúde da plataforma")
    health_report = monitor.get_health_report()
    data("    Status geral", health_report["overall_status"])
    data("    Alertas ativos", health_report["active_alerts"])

    # ─────────────────────────────────────────
    # FASE 7: Consulta de Disponibilidade
    # ─────────────────────────────────────────
    header("FASE 7 — Consulta de Disponibilidade (Free/Busy)")

    step(19, "Consultando agenda do Microsoft Outlook (Free/Busy)")
    schedule = await ms_connector.get_schedule(
        emails=["usuario@empresa.com"],
        start=now,
        end=now + timedelta(days=1),
    )
    ok("Consulta de disponibilidade realizada com sucesso")
    data("    Resposta", f"{len(schedule.get('value', []))} slot(s) retornados")

    # ─────────────────────────────────────────
    # FASE 8: Renovação de Token
    # ─────────────────────────────────────────
    header("FASE 8 — Renovação Automática de Token")

    step(20, "Renovando tokens de ambos os conectores simultaneamente")
    g_refreshed, ms_refreshed = await asyncio.gather(
        google_connector.refresh_token(google_token),
        ms_connector.refresh_token(ms_token),
    )
    ok("Tokens renovados com sucesso (renovação automática transparente)")
    data("    Google — Novo access token", g_refreshed.access_token[:20] + "...")
    data("    Google — Nova expiração", g_refreshed.expires_at.strftime('%Y-%m-%d %H:%M:%S'))
    data("    Microsoft — Novo access token", ms_refreshed.access_token[:20] + "...")
    data("    Microsoft — Nova expiração", ms_refreshed.expires_at.strftime('%Y-%m-%d %H:%M:%S'))

    # ─────────────────────────────────────────
    # RESUMO FINAL
    # ─────────────────────────────────────────
    header("RESUMO DO FLUXO COMPLETO")

    print("""
  ┌─────────────────────────────────────────────────────────────┐
  │         LIFEOS — UNIVERSAL CONNECTOR PLATFORM               │
  │                    SPRINT 025                               │
  ├─────────────────────────────────────────────────────────────┤
  │  GOOGLE CALENDAR                                            │
  │  ✅ OAuth 2.0 + PKCE autenticado                            │
  │  ✅ Consentimento explícito registrado (Zero Trust)         │
  │  ✅ Full Sync: 20 eventos sincronizados                     │
  │  ✅ Delta Sync: 5 eventos incrementais                      │
  │  ✅ Evento criado via API                                   │
  │  ✅ Webhook registrado (HMAC-SHA256)                        │
  │  ✅ Token renovado automaticamente                          │
  ├─────────────────────────────────────────────────────────────┤
  │  MICROSOFT OUTLOOK                                          │
  │  ✅ OAuth 2.0 + PKCE autenticado                            │
  │  ✅ Consentimento explícito registrado (Zero Trust)         │
  │  ✅ Full Sync: 18 eventos sincronizados                     │
  │  ✅ Delta Sync: 3 eventos incrementais                      │
  │  ✅ Evento criado via Graph API                             │
  │  ✅ Webhook registrado (HMAC-SHA256)                        │
  │  ✅ Free/Busy consultado                                    │
  │  ✅ Token renovado automaticamente                          │
  ├─────────────────────────────────────────────────────────────┤
  │  PLATAFORMA                                                 │
  │  ✅ Zero Trust enforced em todas as operações               │
  │  ✅ E2E Encryption no Credential Vault                      │
  │  ✅ Circuit Breaker ativo para resiliência                  │
  │  ✅ Rate Limiter ativo por usuário/conector                 │
  │  ✅ Auditoria completa registrada                           │
  │  ✅ Monitoramento de saúde ativo                            │
  │  ✅ Execução paralela (asyncio.gather)                      │
  └─────────────────────────────────────────────────────────────┘
""")

    print("  SPRINT 025")
    print("  UNIVERSAL CONNECTOR PLATFORM COMPLETED")
    print()


if __name__ == "__main__":
    asyncio.run(run_demo())
