window.ZERO2FIT_CONFIG = Object.freeze({
  supabaseUrl: 'https://guxdnxnqzhkidtastsfb.supabase.co',
  supabasePublishableKey: 'sb_publishable_pRhqHz4vEl0plyGuXx8Ztg_JfSxg57m'
});

let zero2fitAuthActivationPromise = null;
function loadZero2FitAuthActivation() {
  zero2fitAuthActivationPromise ||= import('./build035-auth-activation.js');
  return zero2fitAuthActivationPromise;
}

if (/(?:^|[#&])(access_token|refresh_token|error|error_code)=/.test(window.location.hash || '')) {
  loadZero2FitAuthActivation().catch(error => console.warn('Zero2Fit Build 035 auth activation failed to load', error));
}

document.addEventListener('click', async event => {
  const button = event.target?.closest?.('#z8SignUp');
  if (!button || window.Zero2FitAuthActivation) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    await loadZero2FitAuthActivation();
    button.click();
  } catch (error) {
    console.warn('Zero2Fit Build 035 auth activation failed to load', error);
  }
}, true);
