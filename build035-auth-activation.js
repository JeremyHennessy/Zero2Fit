import { AUTH_SESSION_KEY, appRedirectUrl, implicitAuthResult, authErrorMessage } from './auth-activation-core.mjs';

const config = window.ZERO2FIT_CONFIG || {};
const apiBase = String(config.supabaseUrl || '').replace(/\/+$/, '');
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';
let attempts = 0;

function configured() {
  return /^https:\/\//.test(apiBase) && Boolean(publishableKey);
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function writeSession(session) {
  if (!session) localStorage.removeItem(AUTH_SESSION_KEY);
  else localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('zero2fit:remote-session', { detail:{ signedIn:Boolean(session?.access_token), source:'auth-activation' } }));
}

async function hydrateUser(session) {
  if (!session?.access_token || !configured()) return session;
  try {
    const response = await fetch(`${apiBase}/auth/v1/user`, {
      headers:{ apikey:publishableKey, Authorization:`Bearer ${session.access_token}` }
    });
    const user = await parseResponse(response);
    if (response.ok && user?.id) {
      const hydrated = { ...session, user };
      writeSession(hydrated);
      return hydrated;
    }
  } catch {}
  return session;
}

async function consumeImplicitReturn() {
  const result = implicitAuthResult(window.location.hash);
  if (!result.session && !result.error) return null;

  const cleanUrl = `${window.location.pathname}${window.location.search}` || '/';
  history.replaceState(history.state, '', cleanUrl);

  if (result.error) {
    window.Zero2FitAuthActivation = { ...(window.Zero2FitAuthActivation || {}), lastError:result.error };
    return null;
  }

  writeSession(result.session);
  return hydrateUser(result.session);
}

async function signUp(email, password) {
  if (!configured()) throw new Error('Private sync is not configured.');
  const redirectTo = appRedirectUrl(window.location.href);
  const response = await fetch(`${apiBase}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method:'POST',
    headers:{ apikey:publishableKey, 'Content-Type':'application/json' },
    body:JSON.stringify({ email, password })
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const raw = payload?.msg || payload?.message || payload?.error_description || payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(authErrorMessage(response.status, raw));
  }
  if (payload?.access_token) writeSession(payload);
  return payload;
}

function install() {
  const remote = window.Zero2FitRemoteSync;
  if (!remote?.signUp && attempts < 200) {
    attempts += 1;
    setTimeout(install, 50);
    return;
  }
  if (!remote?.signUp || remote.signUp.__z35AuthActivation) return;

  signUp.__z35AuthActivation = true;
  remote.signUp = signUp;
  consumeImplicitReturn().catch(error => console.warn('Zero2Fit Build 035 auth redirect handling failed', error));
  window.Zero2FitAuthActivation = {
    ...(window.Zero2FitAuthActivation || {}),
    redirectUrl:() => appRedirectUrl(window.location.href),
    consumeImplicitReturn
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
else install();
