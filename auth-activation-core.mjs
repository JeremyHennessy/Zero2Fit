export const AUTH_SESSION_KEY = 'zero2fit-supabase-session-v1';

export function appRedirectUrl(href) {
  const url = new URL(String(href || ''));
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/, '');
  return url.href;
}

export function implicitAuthResult(hash, nowMs = Date.now()) {
  const raw = String(hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const errorCode = params.get('error_code') || params.get('error');
  const errorDescription = params.get('error_description');
  if (errorCode || errorDescription) {
    return {
      session:null,
      error:{ code:errorCode || 'auth_redirect_error', message:errorDescription || errorCode || 'Authentication redirect failed.' }
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return { session:null, error:null };

  const expiresIn = Math.max(1, Number(params.get('expires_in') || 3600));
  const explicitExpiresAt = Number(params.get('expires_at') || 0);
  const expiresAt = explicitExpiresAt > 0 ? explicitExpiresAt : Math.floor(Number(nowMs) / 1000) + expiresIn;
  return {
    error:null,
    session:{
      access_token:accessToken,
      refresh_token:refreshToken,
      expires_in:expiresIn,
      expires_at:expiresAt,
      token_type:params.get('token_type') || 'bearer',
      user:null
    },
    type:params.get('type') || null
  };
}

export function authErrorMessage(status, message) {
  const text = String(message || '').trim() || `Authentication request failed with HTTP ${status}.`;
  if (Number(status) === 429 && /email rate limit exceeded/i.test(text)) {
    return 'Confirmation email limit reached for the Supabase project. Do not keep retrying Create account; wait for the quota to reset or configure custom SMTP, then submit one signup attempt.';
  }
  if (Number(status) === 429 && /only request this after/i.test(text)) {
    return 'A confirmation email was requested too recently. Do not keep retrying; wait for the resend cooldown before trying once more.';
  }
  return text;
}
