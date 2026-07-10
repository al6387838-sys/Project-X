"""
LifeOS OAuth 2.0 Server — Core
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from .models import AuthorizationCode, OAuthApp, OAuthScope, OAuthToken


@dataclass
class OAuthConfig:
    """Configuração do servidor OAuth."""
    authorization_endpoint: str = "/oauth/authorize"
    token_endpoint: str = "/oauth/token"
    revoke_endpoint: str = "/oauth/revoke"
    introspect_endpoint: str = "/oauth/introspect"
    jwks_endpoint: str = "/oauth/.well-known/jwks.json"
    access_token_ttl_seconds: int = 3600
    refresh_token_ttl_days: int = 30
    authorization_code_ttl_minutes: int = 10
    require_pkce: bool = True


class OAuthServer:
    """
    LifeOS OAuth 2.0 Authorization Server.

    Implementa:
    - Authorization Code Flow (com PKCE)
    - Client Credentials Flow
    - Token Refresh
    - Token Revocation (RFC 7009)
    - Token Introspection (RFC 7662)
    """

    def __init__(self, config: Optional[OAuthConfig] = None):
        self.config = config or OAuthConfig()
        self._apps: Dict[str, OAuthApp] = {}
        self._auth_codes: Dict[str, AuthorizationCode] = {}
        self._tokens: Dict[str, OAuthToken] = {}
        self._refresh_tokens: Dict[str, OAuthToken] = {}

    # ── App Management ──────────────────────────────────────────────────────

    def register_app(self, app: OAuthApp) -> OAuthApp:
        """Registra uma nova aplicação OAuth."""
        self._apps[app.client_id] = app
        return app

    def get_app(self, client_id: str) -> Optional[OAuthApp]:
        return self._apps.get(client_id)

    def list_apps(self) -> List[OAuthApp]:
        return list(self._apps.values())

    # ── Authorization Code Flow ─────────────────────────────────────────────

    def create_authorization_url(
        self,
        client_id: str,
        redirect_uri: str,
        scopes: List[str],
        state: str,
        code_challenge: Optional[str] = None,
        code_challenge_method: str = "S256",
    ) -> Dict:
        """
        Valida parâmetros e retorna URL de autorização.
        Passo 1 do Authorization Code Flow.
        """
        app = self._apps.get(client_id)
        if not app:
            return {"error": "invalid_client", "error_description": "Unknown client_id."}

        if redirect_uri not in app.redirect_uris:
            return {"error": "invalid_request", "error_description": "redirect_uri not registered."}

        invalid_scopes = [s for s in scopes if s not in app.allowed_scopes]
        if invalid_scopes:
            return {"error": "invalid_scope", "error_description": f"Scopes not allowed: {invalid_scopes}"}

        if self.config.require_pkce and not code_challenge:
            return {"error": "invalid_request", "error_description": "PKCE code_challenge is required."}

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
            "response_type": "code",
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = code_challenge_method

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return {
            "authorization_url": f"https://auth.lifeos.app{self.config.authorization_endpoint}?{query_string}",
            "state": state,
        }

    def create_authorization_code(
        self,
        client_id: str,
        user_id: str,
        scopes: List[str],
        redirect_uri: str,
        code_challenge: Optional[str] = None,
    ) -> AuthorizationCode:
        """
        Cria código de autorização após consentimento do usuário.
        Passo 2 do Authorization Code Flow.
        """
        code = AuthorizationCode(
            client_id=client_id,
            user_id=user_id,
            scopes=scopes,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
        )
        self._auth_codes[code.code] = code
        return code

    def exchange_code_for_token(
        self,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        code_verifier: Optional[str] = None,
    ) -> Dict:
        """
        Troca código de autorização por access token.
        Passo 3 do Authorization Code Flow.
        """
        auth_code = self._auth_codes.get(code)
        if not auth_code or not auth_code.is_valid():
            return {"error": "invalid_grant", "error_description": "Authorization code is invalid or expired."}

        if auth_code.client_id != client_id:
            return {"error": "invalid_client", "error_description": "client_id mismatch."}

        app = self._apps.get(client_id)
        if not app or app.client_secret != client_secret:
            return {"error": "invalid_client", "error_description": "Invalid client credentials."}

        if auth_code.redirect_uri != redirect_uri:
            return {"error": "invalid_request", "error_description": "redirect_uri mismatch."}

        # Verificar PKCE
        if auth_code.code_challenge and code_verifier:
            expected = hashlib.sha256(code_verifier.encode()).digest()
            import base64
            expected_b64 = base64.urlsafe_b64encode(expected).rstrip(b"=").decode()
            if expected_b64 != auth_code.code_challenge:
                return {"error": "invalid_grant", "error_description": "PKCE verification failed."}

        # Marcar código como usado
        auth_code.used = True

        token = OAuthToken(
            client_id=client_id,
            user_id=auth_code.user_id,
            scopes=auth_code.scopes,
        )
        self._tokens[token.access_token] = token
        self._refresh_tokens[token.refresh_token] = token

        return token.to_response_dict()

    # ── Client Credentials Flow ─────────────────────────────────────────────

    def client_credentials_token(
        self,
        client_id: str,
        client_secret: str,
        scopes: List[str],
    ) -> Dict:
        """Gera token via Client Credentials Flow (server-to-server)."""
        app = self._apps.get(client_id)
        if not app or app.client_secret != client_secret:
            return {"error": "invalid_client", "error_description": "Invalid client credentials."}

        invalid_scopes = [s for s in scopes if s not in app.allowed_scopes]
        if invalid_scopes:
            return {"error": "invalid_scope", "error_description": f"Scopes not allowed: {invalid_scopes}"}

        token = OAuthToken(
            client_id=client_id,
            user_id="",  # No user in client credentials
            scopes=scopes,
        )
        self._tokens[token.access_token] = token
        return token.to_response_dict()

    # ── Token Operations ────────────────────────────────────────────────────

    def refresh_token(self, refresh_token_str: str, client_id: str, client_secret: str) -> Dict:
        """Renova um access token usando o refresh token."""
        token = self._refresh_tokens.get(refresh_token_str)
        if not token or token.client_id != client_id:
            return {"error": "invalid_grant", "error_description": "Invalid refresh token."}

        app = self._apps.get(client_id)
        if not app or app.client_secret != client_secret:
            return {"error": "invalid_client", "error_description": "Invalid client credentials."}

        # Revogar token antigo
        token.revoked = True

        new_token = OAuthToken(
            client_id=client_id,
            user_id=token.user_id,
            scopes=token.scopes,
        )
        self._tokens[new_token.access_token] = new_token
        self._refresh_tokens[new_token.refresh_token] = new_token

        return new_token.to_response_dict()

    def revoke_token(self, token_str: str) -> bool:
        """Revoga um token (RFC 7009)."""
        token = self._tokens.get(token_str) or self._refresh_tokens.get(token_str)
        if token:
            token.revoked = True
            return True
        return False

    def introspect_token(self, token_str: str) -> Dict:
        """Inspeciona um token (RFC 7662)."""
        token = self._tokens.get(token_str)
        if not token or not token.is_valid():
            return {"active": False}

        return {
            "active": True,
            "client_id": token.client_id,
            "user_id": token.user_id,
            "scope": " ".join(token.scopes),
            "token_type": token.token_type,
            "exp": int(token.expires_at.timestamp()),
            "iat": int(token.expires_at.timestamp()) - token.expires_in,
        }

    def validate_token(self, token_str: str) -> Dict:
        """Valida um token e retorna informações para o middleware de auth."""
        token = self._tokens.get(token_str)
        if not token or not token.is_valid():
            return {"valid": False}
        return {
            "valid": True,
            "user_id": token.user_id,
            "client_id": token.client_id,
            "scopes": token.scopes,
        }
