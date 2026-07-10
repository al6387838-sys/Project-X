"""
LifeOS SDK — Exceções
EXECUTION-009: Developer Platform
"""


class LifeOSError(Exception):
    """Exceção base do LifeOS SDK."""
    def __init__(self, message: str, code: str = "LIFEOS_ERROR", request_id: str = ""):
        super().__init__(message)
        self.message = message
        self.code = code
        self.request_id = request_id

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code!r}, message={self.message!r})"


class AuthenticationError(LifeOSError):
    """Erro de autenticação (401)."""
    def __init__(self, message: str = "Authentication failed.", **kwargs):
        super().__init__(message, code="AUTHENTICATION_ERROR", **kwargs)


class RateLimitError(LifeOSError):
    """Rate limit excedido (429)."""
    def __init__(self, message: str = "Rate limit exceeded.", retry_after: int = 60, **kwargs):
        super().__init__(message, code="RATE_LIMIT_EXCEEDED", **kwargs)
        self.retry_after = retry_after


class NotFoundError(LifeOSError):
    """Recurso não encontrado (404)."""
    def __init__(self, message: str = "Resource not found.", **kwargs):
        super().__init__(message, code="NOT_FOUND", **kwargs)


class ValidationError(LifeOSError):
    """Erro de validação (422)."""
    def __init__(self, message: str = "Validation failed.", errors: list = None, **kwargs):
        super().__init__(message, code="VALIDATION_ERROR", **kwargs)
        self.errors = errors or []


class APIError(LifeOSError):
    """Erro genérico da API (5xx)."""
    def __init__(self, message: str = "Internal API error.", status_code: int = 500, **kwargs):
        super().__init__(message, code="API_ERROR", **kwargs)
        self.status_code = status_code


class ForbiddenError(LifeOSError):
    """Acesso negado por falta de escopos (403)."""
    def __init__(self, message: str = "Access forbidden. Missing required scopes.", **kwargs):
        super().__init__(message, code="FORBIDDEN", **kwargs)
