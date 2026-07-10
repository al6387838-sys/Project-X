"""
LifeOS OAuth 2.0 — Flows de Autenticação
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Dict, List, Optional, Tuple


class PKCEHelper:
    """Utilitário para geração e verificação de PKCE (RFC 7636)."""

    @staticmethod
    def generate_code_verifier() -> str:
        """Gera um code_verifier aleatório."""
        return secrets.token_urlsafe(64)

    @staticmethod
    def generate_code_challenge(verifier: str) -> str:
        """Gera o code_challenge a partir do verifier (S256)."""
        digest = hashlib.sha256(verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    @staticmethod
    def verify(verifier: str, challenge: str) -> bool:
        """Verifica se o verifier corresponde ao challenge."""
        expected = PKCEHelper.generate_code_challenge(verifier)
        return expected == challenge


class AuthorizationCodeFlow:
    """
    Implementação do Authorization Code Flow com PKCE.

    Uso recomendado para:
    - Aplicações web com backend
    - Aplicações mobile/desktop (com PKCE obrigatório)
    - Qualquer app que acessa dados de usuário
    """

    def __init__(self, oauth_server):
        self._server = oauth_server

    def start(
        self,
        client_id: str,
        redirect_uri: str,
        scopes: List[str],
        state: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Inicia o fluxo. Retorna (authorization_url, code_verifier, state).

        O code_verifier deve ser armazenado pelo cliente para uso no step 2.
        """
        state = state or secrets.token_urlsafe(16)
        code_verifier = PKCEHelper.generate_code_verifier()
        code_challenge = PKCEHelper.generate_code_challenge(code_verifier)

        result = self._server.create_authorization_url(
            client_id=client_id,
            redirect_uri=redirect_uri,
            scopes=scopes,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        if "error" in result:
            raise ValueError(f"OAuth Error: {result['error']} — {result.get('error_description', '')}")

        return result["authorization_url"], code_verifier, state

    def exchange(
        self,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> Dict:
        """Troca o código de autorização por tokens."""
        return self._server.exchange_code_for_token(
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier,
        )


class ClientCredentialsFlow:
    """
    Implementação do Client Credentials Flow.

    Uso recomendado para:
    - Integrações server-to-server
    - Automações sem interação do usuário
    - Serviços de backend
    """

    def __init__(self, oauth_server):
        self._server = oauth_server

    def get_token(
        self,
        client_id: str,
        client_secret: str,
        scopes: List[str],
    ) -> Dict:
        """Obtém um access token via Client Credentials."""
        return self._server.client_credentials_token(
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
        )
