const Z38_MOBILE = '(max-width: 820px)';
let z38FuelOpen = false;
let z38Observer = null;
let z38Timer = null;

const Z38_ICONS = {
  today:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/></svg>',
  train:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/></svg>',
  nutrition:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10"/><path d="M16 3v18M16 3c2.8 1.4 4 4.1 4 7.3V12h-4"/></svg>',
  character:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 8 7l4 4 4-4-4-4Z"/><path d="M8.5 10.5 5 14l7 7 7-7-3.5-3.5"/></svg>',
  journey:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 7 6-4 6 7 5-5"/></svg>',
  data:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19 13.5 1.7 1-2 3.5-1.8-1a8 8 0 0 1-2.1 1.2v2H9.2v-2A8 8 0 0 1 7.1 17l-1.8 1-2-3.5 1.7-1a8 8 0 0 1 0-2.5l-1.7-1 2-3.5 1.8 1a8 8 0 0 1 2.1-1.2v-2h5.6v2A8 8 0 0 1 16.9 7l1.8-1 2 3.5-1.7 1a8 8 0 0 1 0 3Z"/></svg>'
};

function z38EnsureStyle() {
  if (document.querySelector('link[href="./build038.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build038.css';
  document.head.appendChild(link);
}

function z38Text(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function z38ActivePage() {
  return document.querySelector('.page.active')?.id?.replace('page-','') || 'today';
}

function z38PageTitle(page = z38ActivePage()) {
  const copy = {
    today:['Today','Your next useful action'],
    train:['Train','One set at a time'],
    nutrition:['Fuel','Eat, log, move on'],
    character:['Adventure','Your fitness powers the run'],
    journey:['Progress','Trends, not noise'],
    data:['Devices','Health sources and private sync']
  };
  const [title, subtitle] = copy[page] || ['Zero2Fit',''];
  z38Text(document.getElementById('pageTitle'), title);
  z38Text(document.getElementById('z4PageSubtitle'), subtitle);
  document.body.dataset.z38Page = page;
}

function z38Navigation() {
  const labels = { today:'Today', train:'Train', nutrition:'Fuel', character:'Adventure', journey:'Progress', data:'Devices' };
  const nav = document.getElementById('navList');
  if (!nav) return;
  const order = ['today','train','nutrition','character','journey','data'];
  order.forEach(key => {
    const node = nav.querySelector(`.nav-item[data-page="${key}"]`);
    if (node) nav.appendChild(node);
  });
  nav.querySelectorAll('.nav-item[data-page]').forEach(button => {
    const page = button.dataset.page;
    if (!labels[page]) return;
    button.dataset.z38Nav = '1';
    button.innerHTML = `<span class="z38-nav-icon">${Z38_ICONS[page]}</span><strong>${labels[page]}</strong>`;
    if (!button.dataset.z38Bound) {
      button.dataset.z38Bound = '1';
      button.addEventListener('click', () => setTimeout(() => z38PageTitle(page), 0));
    }
  });
  document.querySelectorAll('[data-go-page],[data-z4-page],[data-z12-page]').forEach(node => {
    if (node.dataset.z38HeadingBound) return;
    node.dataset.z38HeadingBound = '1';
    node.addEventListener('click', () => setTimeout(z38PageTitle, 0));
  });
}

function z38Brand() {
  const mark = document.querySelector('.brand-mark');
  const name = document.querySelector('.brand-name');
  const subtitle = document.querySelector('.brand-subtitle');
  if (mark) mark.textContent = 'Z';
  if (name) name.textContent = 'Zero2Fit';
  if (subtitle) subtitle.textContent = 'Personal fitness OS';
  const note = document.querySelector('.sidebar-note');
  if (note) note.innerHTML = '<strong>Private by default</strong><span>Real activity drives the game.</span>';
}

function z38CleanCopy() {
  const replacements = [
    ['#page-data .data-intro .eyebrow','Connected health'],
    ['#page-data .data-intro h2','Your health stack'],
    ['#page-data .data-intro .muted','Amazfit, RENPHO, manual entries and private sync feed one source-aware timeline.'],
    ['#z17Fuel .z17-fuel-hero .eyebrow','Fuel'],
    ['#z17Fuel .z17-fuel-hero h2','Today'],
    ['#z18FoodLookup .eyebrow','Search'],
    ['#z18FoodLookup h2','Find food'],
    ['#z24Acceptance .eyebrow','Account'],
    ['#z26ActivationGuide .eyebrow','Setup'],
    ['#z26ActivationGuide h2','Finish setup'],
    ['#z28HealthKitEvidence .eyebrow','HealthKit'],
    ['#z28HealthKitEvidence h2','Match your real sources']
  ];
  for (const [selector, value] of replacements) z38Text(document.querySelector(selector), value);
  document.querySelectorAll('.eyebrow').forEach(node => {
    const text = node.textContent || '';
    if (/build\s*\d+/i.test(text)) node.textContent = text.replace(/\s*[·—-]\s*build\s*\d+/ig,'').replace(/build\s*\d+\s*[·—-]?\s*/ig,'').trim() || 'Zero2Fit';
  });
}

function z38SectionLabel(beforeNode, label, key) {
  if (!beforeNode || document.querySelector(`[data-z38-label="${key}"]`)) return;
  const heading = document.createElement('div');
  heading.className = 'z38-section-label';
  heading.dataset.z38Label = key;
  heading.textContent = label;
  beforeNode.before(heading);
}

function z38Today() {
  const page = document.getElementById('page-today');
  const hero = page?.querySelector('.hero-grid');
  if (!page || !hero) return;
  page.classList.add('z38-today');
  hero.classList.add('z38-today-hero');
  hero.querySelector('.character-summary')?.classList.add('z38-campaign');
  hero.querySelector('.momentum-card')?.classList.add('z38-readiness');

  const characterHeading = hero.querySelector('.character-summary h2');
  if (characterHeading) characterHeading.textContent = 'Foundation';
  const characterCopy = hero.querySelector('.character-summary .muted');
  if (characterCopy) characterCopy.textContent = 'Build the routine. Let the data catch up.';

  const sensors = document.getElementById('z4SensorStrip');
  if (sensors) {
    sensors.classList.add('z38-health-strip');
    z38SectionLabel(sensors, 'Health snapshot', 'today-health');
  }

  const grid = page.querySelector('.content-grid');
  const workout = page.querySelector('.today-workout-card');
  const quests = page.querySelector('.quest-card');
  if (grid && workout) {
    workout.classList.add('z38-workout-focus');
    grid.prepend(workout);
    z38SectionLabel(workout, 'Next session', 'today-workout');
  }
  if (quests) {
    quests.classList.add('z38-quest-list');
    z38SectionLabel(quests, 'Daily goals', 'today-goals');
  }

  if (!document.getElementById('z38ManualLog')) {
    const cards = [...page.querySelectorAll('.metric-card')];
    if (cards.length) {
      const details = document.createElement('details');
      details.id = 'z38ManualLog';
      details.className = 'z38-disclosure z38-manual-log';
      details.innerHTML = '<summary><span>Manual log</span><small>Only when a device source is unavailable</small><b>＋</b></summary><div class="z38-disclosure-body"></div>';
      cards[0].before(details);
      const body = details.querySelector('.z38-disclosure-body');
      cards.forEach(card => body.appendChild(card));
    }
  }

  const primary = document.querySelector('#z4HeroActions .z4-primary');
  if (primary) primary.textContent = 'Start today’s workout';
}

function z38Disclosure(node, title, subtitle, key, open = false) {
  if (!node) return null;
  const existing = node.closest(`.z38-disclosure[data-z38="${key}"]`);
  if (existing) return existing;
  const details = document.createElement('details');
  details.className = 'z38-disclosure';
  details.dataset.z38 = key;
  details.open = open;
  details.innerHTML = `<summary><span><strong>${title}</strong><small>${subtitle}</small></span><b>＋</b></summary><div class="z38-disclosure-body"></div>`;
  node.before(details);
  details.querySelector('.z38-disclosure-body').appendChild(node);
  return details;
}

function z38Train() {
  const page = document.getElementById('page-train');
  if (!page) return;
  page.classList.add('z38-train');
  const header = page.querySelector('.train-header');
  header?.classList.add('z38-train-meta');
  const focus = document.getElementById('z14FocusCard');
  if (focus) {
    focus.classList.add('z38-set-stage');
    if (!document.getElementById('z38TrainStage')) {
      const stage = document.createElement('section');
      stage.id = 'z38TrainStage';
      stage.className = 'z38-train-stage';
      focus.before(stage);
      stage.appendChild(focus);
    }
  }
  const context = document.getElementById('trainingContextCard');
  z38Disclosure(context,'Change workout','Location, duration and substitutions','train-setup');
  const sync = document.getElementById('z21WorkoutSyncStatus');
  z38Disclosure(sync,'History & sync','Private workout continuity','workout-sync');
  const list = document.getElementById('exerciseList');
  if (list) list.classList.add('z38-exercise-list');
}

function z38FuelSheet() {
  if (document.getElementById('z38FuelSheet')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'z38FuelSheet';
  backdrop.className = 'z38-sheet-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="z38-sheet" role="dialog" aria-modal="true" aria-labelledby="z38FuelSheetTitle">
      <div class="z38-sheet-grabber" aria-hidden="true"></div>
      <header><div><span>Fuel</span><h2 id="z38FuelSheetTitle">Add food</h2></div><button type="button" id="z38FuelClose" aria-label="Close">×</button></header>
      <div class="z38-sheet-body"></div>
    </section>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) z38SetFuelSheet(false); });
  document.getElementById('z38FuelClose')?.addEventListener('click', () => z38SetFuelSheet(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && z38FuelOpen) z38SetFuelSheet(false); });
}

function z38SetFuelSheet(open) {
  z38FuelOpen = Boolean(open);
  const sheet = document.getElementById('z38FuelSheet');
  if (!sheet) return;
  sheet.hidden = !z38FuelOpen;
  document.body.classList.toggle('z38-sheet-open', z38FuelOpen);
  if (z38FuelOpen) setTimeout(() => document.getElementById('z18Search')?.focus(), 80);
}

function z38MoveFuelTools() {
  const target = document.querySelector('#z38FuelSheet .z38-sheet-body');
  if (!target) return;
  const lookup = document.getElementById('z18FoodLookup');
  const quick = document.querySelector('#z17Fuel .z17-quick-grid');
  const saved = document.querySelector('#z17Fuel .z17-saved-card');
  [lookup, quick, saved].filter(Boolean).forEach(node => {
    if (node.parentElement !== target) target.appendChild(node);
  });
}

function z38Fuel() {
  const page = document.getElementById('page-nutrition');
  const fuel = document.getElementById('z17Fuel');
  if (!page || !fuel) return;
  page.classList.add('z38-fuel');
  z38FuelSheet();
  const hero = fuel.querySelector('.z17-fuel-hero');
  hero?.classList.add('z38-fuel-dashboard');
  if (hero && !document.getElementById('z38AddFood')) {
    const button = document.createElement('button');
    button.id = 'z38AddFood';
    button.className = 'z38-add-food';
    button.type = 'button';
    button.innerHTML = '<span>＋</span><strong>Add food</strong>';
    hero.after(button);
    button.addEventListener('click', () => z38SetFuelSheet(true));
  }
  z38MoveFuelTools();
  fuel.querySelector('.z17-log-card')?.classList.add('z38-food-timeline');
  document.getElementById('z19FuelSync')?.classList.add('z38-inline-status');
}

function z38Adventure() {
  const page = document.getElementById('page-character');
  if (!page) return;
  page.classList.add('z38-adventure');
  const frontier = document.getElementById('z4FrontierCard');
  const battlefield = document.getElementById('z16Battlefield');
  frontier?.classList.add('z38-adventure-summary');
  battlefield?.classList.add('z38-adventure-stage');
  if (frontier && battlefield && battlefield.previousElementSibling !== frontier) frontier.after(battlefield);
}

function z38Progress() {
  const page = document.getElementById('page-journey');
  if (!page) return;
  page.classList.add('z38-progress');
  const hero = page.querySelector('.journey-hero');
  if (hero) {
    hero.classList.add('z38-progress-head');
    z38Text(hero.querySelector('.eyebrow'),'Progress');
    z38Text(hero.querySelector('h2'),'Your trend line');
    z38Text(hero.querySelector('.muted'),'See what is changing over weeks, not hours.');
  }
  document.getElementById('z12ProgressTabs')?.classList.add('z38-progress-tabs');
  const intel = document.getElementById('z10Intelligence');
  intel?.classList.add('z38-intelligence');
  const body = document.getElementById('z4BodyComposition');
  body?.classList.add('z38-body-data');
}

function z38Devices() {
  const page = document.getElementById('page-data');
  if (!page) return;
  page.classList.add('z38-devices');
  page.querySelector('.data-intro')?.classList.add('z38-device-head');
  page.querySelector('.connection-grid')?.classList.add('z38-device-stack');
  const table = page.querySelector('.data-table-card');
  z38Disclosure(table,'Technical data','Normalized records and provenance','data-details');
  z38Disclosure(document.getElementById('z24Acceptance'),'Account self-test','Private-store infrastructure checks','account-check');
  z38Disclosure(document.getElementById('z26ActivationGuide'),'Activation checklist','Cross-browser and physical-device setup','activation');
  z38Disclosure(document.getElementById('z28HealthKitEvidence'),'HealthKit source matching','Advanced Zepp and RENPHO verification','health-sources');
}

function z38Settings() {
  const backdrop = document.getElementById('z12SettingsBackdrop');
  const sheet = backdrop?.querySelector('.z12-settings-sheet');
  if (!sheet) return;
  sheet.classList.add('z38-settings');
  z38Text(sheet.querySelector('.eyebrow'),'Zero2Fit');
  z38Text(sheet.querySelector('h2'),'Settings');
}

function z38SavedFeedback() {
  document.querySelectorAll('[data-z17-save]').forEach(button => {
    const saved = button.disabled;
    button.classList.toggle('z38-saved', saved);
    button.textContent = saved ? '★' : '☆';
    button.setAttribute('aria-label', saved ? 'Saved food' : 'Save food');
  });
}

function z38FocusTechnicalViews() {
  const params = new URLSearchParams(location.search);
  const focus = params.get('qaFocus');
  if (focus === 'activation') document.querySelector('.z38-disclosure[data-z38="activation"]')?.setAttribute('open','');
  if (focus === 'healthkitEvidence') document.querySelector('.z38-disclosure[data-z38="health-sources"]')?.setAttribute('open','');
  if (focus === 'fuelAdd') z38SetFuelSheet(true);
  if (document.documentElement.dataset.zero2fitActivationHandoff === 'healthkit') {
    document.querySelector('.z38-disclosure[data-z38="health-sources"]')?.setAttribute('open','');
  }
}

function z38Compose() {
  document.body.classList.add('z38-rebuild');
  z38Navigation();
  z38Brand();
  z38CleanCopy();
  z38Today();
  z38Train();
  z38Fuel();
  z38Adventure();
  z38Progress();
  z38Devices();
  z38Settings();
  z38SavedFeedback();
  z38PageTitle();
  z38FocusTechnicalViews();
}

function z38Schedule() {
  clearTimeout(z38Timer);
  z38Timer = setTimeout(z38Compose, 30);
}

function z38Observe() {
  if (z38Observer) return;
  z38Observer = new MutationObserver(() => z38Schedule());
  z38Observer.observe(document.body, { childList:true, subtree:true });
}

function z38Init() {
  z38EnsureStyle();
  z38Compose();
  z38Observe();
  window.addEventListener('zero2fit:remote-sync', z38Schedule);
  window.addEventListener('zero2fit:personal-intelligence', z38Schedule);
  window.addEventListener('zero2fit:activation-handoff', () => setTimeout(z38FocusTechnicalViews, 0));
  window.addEventListener('resize', z38Schedule);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z38Init, { once:true });
else z38Init();
