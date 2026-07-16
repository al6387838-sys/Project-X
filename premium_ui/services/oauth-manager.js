/**
 * LifeOS Enterprise — OAuth 2.0 Manager
 * Gerencia integrações com OAuth 2.0, criptografia de tokens e renovação automática
 * 
 * Suporta:
 * - WhatsApp / Instagram (Meta)
 * - Google (Gmail, Calendar, Drive)
 * - Microsoft (Outlook, Teams, OneDrive)
 * - Open Finance (Brasil)
 * - Stripe
 * - Mercado Pago
 */

class OAuthManager {
  constructor() {
    this.providers = {
      whatsapp: {
        name: 'WhatsApp',
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenUrl: 'https://graph.instagram.com/v18.0/oauth/access_token',
        clientId: process.env.WHATSAPP_CLIENT_ID,
        clientSecret: process.env.WHATSAPP_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/whatsapp',
        scopes: ['whatsapp_business_messaging', 'whatsapp_business_management']
      },
      instagram: {
        name: 'Instagram',
        authUrl: 'https://api.instagram.com/oauth/authorize',
        tokenUrl: 'https://graph.instagram.com/v18.0/oauth/access_token',
        clientId: process.env.INSTAGRAM_CLIENT_ID,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/instagram',
        scopes: ['user_profile', 'user_media']
      },
      google: {
        name: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/google',
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/drive.readonly']
      },
      outlook: {
        name: 'Microsoft Outlook',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/outlook',
        scopes: ['Calendars.Read', 'Mail.Read', 'Files.Read.All']
      },
      openfinance: {
        name: 'Open Finance Brasil',
        authUrl: 'https://auth.openfinance.br/oauth/authorize',
        tokenUrl: 'https://auth.openfinance.br/oauth/token',
        clientId: process.env.OPENFINANCE_CLIENT_ID,
        clientSecret: process.env.OPENFINANCE_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/openfinance',
        scopes: ['accounts', 'transactions', 'investments']
      },
      stripe: {
        name: 'Stripe',
        authUrl: 'https://connect.stripe.com/oauth/authorize',
        tokenUrl: 'https://connect.stripe.com/oauth/token',
        clientId: process.env.STRIPE_CLIENT_ID,
        clientSecret: process.env.STRIPE_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/stripe',
        scopes: ['read_write']
      },
      mercadopago: {
        name: 'Mercado Pago',
        authUrl: 'https://auth.mercadopago.com/authorization',
        tokenUrl: 'https://api.mercadopago.com/oauth/token',
        clientId: process.env.MERCADOPAGO_CLIENT_ID,
        clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET,
        redirectUri: '/api/oauth/callback/mercadopago',
        scopes: ['payments', 'users']
      }
    };

    this.tokenStore = new Map(); // Em produção: usar banco de dados
    this.webhookHandlers = new Map();
  }

  /**
   * Gera URL de autorização OAuth 2.0
   */
  generateAuthUrl(providerKey, state) {
    const provider = this.providers[providerKey];
    if (!provider) throw new Error(`Provider ${providerKey} não encontrado`);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state: state,
      access_type: 'offline' // Para refresh tokens
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  /**
   * Troca código de autorização por token de acesso
   */
  async exchangeCodeForToken(providerKey, code) {
    const provider = this.providers[providerKey];
    if (!provider) throw new Error(`Provider ${providerKey} não encontrado`);

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: code,
          redirect_uri: provider.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      return this.encryptAndStoreToken(providerKey, tokenData);
    } catch (error) {
      console.error(`Erro ao trocar código por token (${providerKey}):`, error);
      throw error;
    }
  }

  /**
   * Criptografa e armazena token
   */
  encryptAndStoreToken(providerKey, tokenData) {
    // Em produção: usar crypto library para AES-256
    const encryptedToken = {
      provider: providerKey,
      accessToken: this.encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? this.encrypt(tokenData.refresh_token) : null,
      expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      tokenType: tokenData.token_type || 'Bearer',
      createdAt: new Date().toISOString(),
      scopes: tokenData.scope ? tokenData.scope.split(' ') : []
    };

    this.tokenStore.set(providerKey, encryptedToken);
    
    // Emit evento para logging
    this.logIntegrationEvent(providerKey, 'TOKEN_STORED', {
      expiresAt: encryptedToken.expiresAt,
      scopes: encryptedToken.scopes
    });

    return encryptedToken;
  }

  /**
   * Renovação automática de tokens (refresh token)
   */
  async refreshToken(providerKey) {
    const stored = this.tokenStore.get(providerKey);
    if (!stored || !stored.refreshToken) {
      throw new Error(`Refresh token não encontrado para ${providerKey}`);
    }

    const provider = this.providers[providerKey];
    const refreshToken = this.decrypt(stored.refreshToken);

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const newTokenData = await response.json();
      this.logIntegrationEvent(providerKey, 'TOKEN_REFRESHED', {
        expiresAt: new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString()
      });

      return this.encryptAndStoreToken(providerKey, newTokenData);
    } catch (error) {
      this.logIntegrationEvent(providerKey, 'TOKEN_REFRESH_FAILED', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtém token descriptografado (apenas para uso interno)
   */
  getDecryptedToken(providerKey) {
    const stored = this.tokenStore.get(providerKey);
    if (!stored) return null;

    // Verificar se token expirou
    if (new Date(stored.expiresAt) < new Date()) {
      this.logIntegrationEvent(providerKey, 'TOKEN_EXPIRED', {});
      return null; // Token expirado
    }

    return {
      ...stored,
      accessToken: this.decrypt(stored.accessToken)
    };
  }

  /**
   * Registra webhook para sincronização
   */
  registerWebhook(providerKey, webhookUrl, events) {
    this.webhookHandlers.set(providerKey, {
      url: webhookUrl,
      events: events,
      registeredAt: new Date().toISOString(),
      active: true
    });

    this.logIntegrationEvent(providerKey, 'WEBHOOK_REGISTERED', {
      url: webhookUrl,
      events: events
    });
  }

  /**
   * Processa webhook recebido
   */
  async processWebhook(providerKey, payload, signature) {
    // Verificar assinatura do webhook
    if (!this.verifyWebhookSignature(providerKey, payload, signature)) {
      throw new Error('Webhook signature inválida');
    }

    this.logIntegrationEvent(providerKey, 'WEBHOOK_RECEIVED', {
      eventType: payload.type,
      timestamp: new Date().toISOString()
    });

    // Disparar sincronização
    return this.triggerSync(providerKey, payload);
  }

  /**
   * Dispara sincronização de dados
   */
  async triggerSync(providerKey, data) {
    const startTime = Date.now();
    
    try {
      // Implementar lógica de sincronização específica por provider
      const syncResult = await this.syncData(providerKey, data);
      
      const duration = Date.now() - startTime;
      this.logIntegrationEvent(providerKey, 'SYNC_COMPLETED', {
        duration: `${duration}ms`,
        recordsProcessed: syncResult.count
      });

      return syncResult;
    } catch (error) {
      this.logIntegrationEvent(providerKey, 'SYNC_FAILED', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sincroniza dados do provider
   */
  async syncData(providerKey, data) {
    // Implementação específica por provider
    // [removed]
    
    return {
      provider: providerKey,
      count: 0,
      status: 'pending',
      nextSync: new Date(Date.now() + 3600000).toISOString()
    };
  }

  /**
   * Registra evento de integração
   */
  logIntegrationEvent(providerKey, eventType, metadata = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      provider: providerKey,
      eventType: eventType,
      metadata: metadata
    };

    // [removed]
    
    // Em produção: enviar para sistema de logging (CloudFlare Logs, Datadog, etc.)
  }

  /**
   * Descriptografa token (placeholder)
   */
  decrypt(encrypted) {
    // Em produção: usar crypto.subtle.decrypt() com AES-256
    return encrypted; // Placeholder
  }

  /**
   * Criptografa token (placeholder)
   */
  encrypt(data) {
    // Em produção: usar crypto.subtle.encrypt() com AES-256
    return data; // Placeholder
  }

  /**
   * Verifica assinatura de webhook
   */
  verifyWebhookSignature(providerKey, payload, signature) {
    // Implementar verificação de assinatura específica por provider
    return true; // Placeholder
  }

  /**
   * Obtém status de todas as integrações
   */
  getIntegrationStatus() {
    const status = {};
    
    for (const [provider, config] of Object.entries(this.providers)) {
      const stored = this.tokenStore.get(provider);
      const isConnected = !!stored;
      const isExpired = stored && new Date(stored.expiresAt) < new Date();

      status[provider] = {
        name: config.name,
        connected: isConnected,
        expired: isExpired,
        expiresAt: stored?.expiresAt || null,
        lastSync: stored?.lastSync || null,
        scopes: stored?.scopes || []
      };
    }

    return status;
  }

  /**
   * Desconecta integração
   */
  disconnectIntegration(providerKey) {
    this.tokenStore.delete(providerKey);
    this.logIntegrationEvent(providerKey, 'DISCONNECTED', {});
  }
}

// Exportar singleton
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new OAuthManager();
}
