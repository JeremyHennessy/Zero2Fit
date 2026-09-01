import * as core from './activation-handoff-core.mjs';

const target = core.activationTarget(location.search);
let attempts = 0;

function ensureStylesheet() {
  if (document.querySelector('link[href="./build031.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build031.css';
  document.head.appendChild(link);
}

function ensureNote(panel) {
  if (document.getElementById('z31ActivationHandoff')) return;
  const note = document.createElement('div');
  note.id = 'z31ActivationHandoff';
  note.className = 'z31-handoff-note';
  note.innerHTML = '<div>↗</div><div><strong>Opened from Zero2Fit Bridge</strong><span>Your private HealthKit source observations stay in the account. Select the real Zepp and RENPHO candidates here, resolve the physical matrix, then use the separate Verify actions only when the gate is ready.</span></div>';
  panel.prepend(note);
}

function finish(panel) {
  ensureStylesheet();
  ensureNote(panel);
  panel.classList.add('z31-activation-focus');
  panel.scrollIntoView({ behavior: 'auto', block: 'start' });
  document.documentElement.dataset.zero2fitActivationHandoff = 'healthkit';
  history.replaceState(null, '', core.sanitizedActivationUrl(location.href));
  window.dispatchEvent(new CustomEvent('zero2fit:activation-handoff', { detail: { target: 'healthkit' } }));
}

function activate() {
  if (target !== core.HEALTHKIT_ACTIVATION) return;
  const nav = document.querySelector('.nav-item[data-page="data"]');
  const page = document.getElementById('page-data');
  const panel = document.getElementById('z28HealthKitEvidence');
  if ((!nav || !page || !panel) && attempts < 240) {
    attempts += 1;
    setTimeout(activate, 100);
    return;
  }
  if (!nav || !page || !panel) return;
  nav.click();
  setTimeout(() => finish(panel), 120);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
else activate();

window.Zero2FitActivationHandoff = {
  target,
  openHealthKitEvidence: () => {
    const panel = document.getElementById('z28HealthKitEvidence');
    document.querySelector('.nav-item[data-page="data"]')?.click();
    if (panel) setTimeout(() => finish(panel), 60);
  }
};
