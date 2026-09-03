const Z36_MOBILE = '(max-width: 820px)';
let z36Observer = null;
let z36FuelOpen = false;
let z36Timer = null;

const Z36_ICONS = {
  today:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  train:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/></svg>',
  nutrition:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10"/><path d="M16 3v18M16 3c2.8 1.4 4 4.1 4 7.3V12h-4"/></svg>',
  character:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 8 7l4 4 4-4-4-4Z"/><path d="M8.5 10.5 5 14l7 7 7-7-3.5-3.5"/><path d="m7 5-3 3M17 5l3 3"/></svg>',
  journey:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 7 6-4 6 7 5-5"/></svg>',
  data:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19 13.5 1.7 1-2 3.5-1.8-1a8 8 0 0 1-2.1 1.2v2H9.2v-2A8 8 0 0 1 7.1 17l-1.8 1-2-3.5 1.7-1a8 8 0 0 1 0-2.5l-1.7-1 2-3.5 1.8 1a8 8 0 0 1 2.1-1.2v-2h5.6v2A8 8 0 0 1 16.9 7l1.8-1 2 3.5-1.7 1a8 8 0 0 1 0 3Z"/></svg>'
};

function z36EnsureStyle() {
  if (document.querySelector('link[href="./build036.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build036.css';
  document.head.appendChild(link);
}

function z36Text(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function z36SetPageCopy() {
  const copy = {
    today:['Today','Your plan, recovery and progress'],
    train:['Train','Your workout, one set at a time'],
    nutrition:['Fuel','Log food with less friction'],
    character:['Adventure','Real progress powers the game'],
    journey:['Progress','Trends that matter'],
    data:['Devices','Account, health sources and data']
  };
  const active = document.querySelector('.page.active')?.id?.replace('page-','') || 'today';
  const [title, subtitle] = copy[active] || ['Zero2Fit',''];
  z36Text(document.getElementById('pageTitle'), title);
  z36Text(document.getElementById('z4PageSubtitle'), subtitle);
}

function z36Navigation() {
  const labels = { today:'Today', train:'Train', nutrition:'Fuel', character:'Adventure', journey:'Progress', data:'Devices' };
  document.querySelectorAll('.nav-item[data-page]').forEach(button => {
    const page = button.dataset.page;
    if (!labels[page] || button.dataset.z36Nav === '1') return;
    button.dataset.z36Nav = '1';
    button.innerHTML = `<span class="z36-nav-icon">${Z36_ICONS[page]}</span><strong>${labels[page]}</strong>`;
  });
  document.querySelectorAll('.nav-item,[data-go-page],[data-z4-page],[data-z12-page]').forEach(node => {
    if (node.dataset.z36HeadingBound === '1') return;
    node.dataset.z36HeadingBound = '1';
    node.addEventListener('click', () => setTimeout(z36SetPageCopy, 0));
  });
}

function z36CleanProductCopy() {
  const replacements = [
    ['#z17Fuel .z17-fuel-hero .eyebrow','Fuel'],
    ['#z17Fuel .z17-fuel-hero h2','Today’s nutrition'],
    ['#z18FoodLookup .eyebrow','Food search'],
    ['#z18FoodLookup h2','Find a food'],
    ['#page-data .data-intro .eyebrow','Health & data'],
    ['#page-data .data-intro h2','Your devices and private data'],
    ['#z24Acceptance .eyebrow','Account check'],
    ['#z26ActivationGuide .eyebrow','Setup'],
    ['#z26ActivationGuide h2','Finish setup'],
    ['#z28HealthKitEvidence .eyebrow','Health sources'],
    ['#z28HealthKitEvidence h2','Verify your health sources']
  ];
  for (const [selector, value] of replacements) z36Text(document.querySelector(selector), value);

  document.querySelectorAll('.eyebrow').forEach(node => {
    const text = node.textContent || '';
    if (/build\s*\d+/i.test(text)) node.textContent = text.replace(/\s*[·—-]\s*build\s*\d+/ig,'').replace(/build\s*\d+\s*[·—-]?\s*/ig,'').trim() || 'Zero2Fit';
  });
}

function z36EnhanceToday() {
  const page = document.getElementById('page-today');
  const hero = page?.querySelector('.hero-grid');
  if (!page || !hero) return;
  hero.classList.add('z36-today-overview');

  const character = hero.querySelector('.character-summary');
  const momentum = hero.querySelector('.momentum-card');
  character?.classList.add('z36-foundation');
  momentum?.classList.add('z36-momentum');

  const sensors = document.getElementById('z4SensorStrip');
  sensors?.classList.add('z36-sensors');

  const grid = page.querySelector('.content-grid');
  const workout = page.querySelector('.today-workout-card');
  const quests = page.querySelector('.quest-card');
  workout?.classList.add('z36-next-workout');
  quests?.classList.add('z36-quests');
  if (grid && workout && grid.firstElementChild !== workout) grid.prepend(workout);

  if (!document.getElementById('z36QuickLog')) {
    const metricCards = [...page.querySelectorAll('.metric-card')];
    if (metricCards.length) {
      const details = document.createElement('details');
      details.id = 'z36QuickLog';
      details.className = 'z36-disclosure z36-quick-log';
      details.innerHTML = '<summary><span><strong>Quick manual log</strong><small>Weight or steps when device data is unavailable</small></span><b>＋</b></summary><div class="z36-disclosure-body"></div>';
      metricCards[0].before(details);
      const body = details.querySelector('.z36-disclosure-body');
      metricCards.forEach(card => body.appendChild(card));
    }
  }

  const primary = document.querySelector('#z4HeroActions .z4-primary');
  if (primary) primary.textContent = 'Start workout';
}

function z36Disclosure(node, title, subtitle, key) {
  if (!node || node.closest(`.z36-disclosure[data-z36="${key}"]`)) return;
  const details = document.createElement('details');
  details.className = 'z36-disclosure';
  details.dataset.z36 = key;
  details.innerHTML = `<summary><span><strong>${title}</strong><small>${subtitle}</small></span><b>＋</b></summary><div class="z36-disclosure-body"></div>`;
  node.before(details);
  details.querySelector('.z36-disclosure-body').appendChild(node);
}

function z36EnhanceTrain() {
  const page = document.getElementById('page-train');
  if (!page) return;
  page.classList.add('z36-train');
  const header = page.querySelector('.train-header');
  header?.classList.add('z36-train-header');
  const focus = document.getElementById('z14FocusCard');
  focus?.classList.add('z36-focus');
  const context = document.getElementById('trainingContextCard');
  if (context) z36Disclosure(context,'Workout setup','Location, duration and today’s substitutions','train-setup');
  const setupDisclosure = document.querySelector('.z36-disclosure[data-z36="train-setup"]');
  if (focus && setupDisclosure && focus.closest('.z36-disclosure') === setupDisclosure) setupDisclosure.before(focus);
  const continuity = document.getElementById('z21WorkoutSyncStatus');
  if (continuity) z36Disclosure(continuity,'Workout history','Private continuity and sync status','workout-sync');
}

function z36FuelSheet() {
  if (document.getElementById('z36FuelSheet')) return;
  const sheet = document.createElement('div');
  sheet.id = 'z36FuelSheet';
  sheet.className = 'z36-sheet-backdrop';
  sheet.hidden = true;
  sheet.innerHTML = `
    <section class="z36-sheet z36-fuel-sheet" role="dialog" aria-modal="true" aria-labelledby="z36FuelSheetTitle">
      <header class="z36-sheet-head"><div><span>Fuel</span><h2 id="z36FuelSheetTitle">Add food</h2></div><button type="button" id="z36FuelClose" aria-label="Close">×</button></header>
      <div class="z36-fuel-sheet-body"></div>
    </section>`;
  document.body.appendChild(sheet);
  const close = () => z36SetFuelSheet(false);
  document.getElementById('z36FuelClose')?.addEventListener('click', close);
  sheet.addEventListener('click', event => { if (event.target === sheet) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && z36FuelOpen) close(); });
}

function z36SetFuelSheet(open) {
  z36FuelOpen = Boolean(open);
  const sheet = document.getElementById('z36FuelSheet');
  if (!sheet) return;
  sheet.hidden = !z36FuelOpen;
  document.body.classList.toggle('z36-sheet-open', z36FuelOpen);
  if (z36FuelOpen) setTimeout(() => document.getElementById('z18Search')?.focus(), 120);
}

function z36MoveFuelTools() {
  const target = document.querySelector('#z36FuelSheet .z36-fuel-sheet-body');
  if (!target) return;
  const lookup = document.getElementById('z18FoodLookup');
  const quick = document.querySelector('#z17Fuel .z17-quick-grid');
  const saved = document.querySelector('#z17Fuel .z17-saved-card');
  [lookup,quick,saved].filter(Boolean).forEach(node => {
    if (node.parentElement !== target) target.appendChild(node);
  });
}

function z36EnhanceFuel() {
  const page = document.getElementById('page-nutrition');
  const fuel = document.getElementById('z17Fuel');
  if (!page || !fuel) return;
  page.classList.add('z36-fuel');
  z36FuelSheet();

  const hero = fuel.querySelector('.z17-fuel-hero');
  if (hero && !document.getElementById('z36AddFood')) {
    const actions = document.createElement('div');
    actions.className = 'z36-fuel-actions';
    actions.innerHTML = '<button class="primary-button" type="button" id="z36AddFood">＋ Add food</button><button class="z36-icon-action" type="button" id="z36FuelTargets">Targets</button>';
    hero.appendChild(actions);
    document.getElementById('z36AddFood')?.addEventListener('click', () => z36SetFuelSheet(true));
    document.getElementById('z36FuelTargets')?.addEventListener('click', () => {
      const form = document.getElementById('z17TargetForm');
      if (form) { form.hidden = false; form.scrollIntoView({behavior:'smooth',block:'center'}); }
    });
  }

  z36MoveFuelTools();
  fuel.querySelector('.z17-log-card')?.classList.add('z36-food-log');
  const sync = document.getElementById('z19FuelSync');
  sync?.classList.add('z36-inline-status');
}

function z36EnhanceAdventure() {
  const page = document.getElementById('page-character');
  if (!page) return;
  page.classList.add('z36-adventure');
  document.getElementById('z4FrontierCard')?.classList.add('z36-adventure-hero');
  document.getElementById('z16Battlefield')?.classList.add('z36-battlefield');
}

function z36EnhanceProgress() {
  const page = document.getElementById('page-journey');
  if (!page) return;
  page.classList.add('z36-progress');
  const hero = page.querySelector('.journey-hero');
  if (hero) {
    hero.classList.add('z36-progress-hero');
    z36Text(hero.querySelector('.eyebrow'),'Progress');
    z36Text(hero.querySelector('h2'),'Your progress');
    z36Text(hero.querySelector('.muted'),'Weight, strength, recovery and consistency over time.');
  }
}

function z36EnhanceDevices() {
  const page = document.getElementById('page-data');
  if (!page) return;
  page.classList.add('z36-devices');
  page.querySelector('.connection-grid')?.classList.add('z36-device-list');
  const table = page.querySelector('.data-table-card');
  if (table) z36Disclosure(table,'Data details','Normalized records, provenance and technical status','data-details');

  const acceptance = document.getElementById('z24Acceptance');
  const activation = document.getElementById('z26ActivationGuide');
  const healthkit = document.getElementById('z28HealthKitEvidence');
  if (acceptance) z36Disclosure(acceptance,'Account check','Private-store infrastructure acceptance','account-check');
  if (activation) z36Disclosure(activation,'Finish setup','Cross-browser and physical-device setup','activation');
  if (healthkit) z36Disclosure(healthkit,'Verify health sources','Advanced Zepp and RENPHO HealthKit evidence','health-sources');
}

function z36EnhanceSettings() {
  const sheet = document.querySelector('.z12-settings-sheet');
  if (!sheet) return;
  sheet.classList.add('z36-settings-sheet');
  z36Text(sheet.querySelector('.eyebrow'),'Zero2Fit');
  z36Text(sheet.querySelector('h2'),'Settings');
}

function z36ApplyQaFocus() {
  const params = new URLSearchParams(location.search);
  const focus = params.get('qaFocus');
  if (focus === 'activation') document.querySelector('.z36-disclosure[data-z36="activation"]')?.setAttribute('open','');
  if (focus === 'healthkitEvidence') document.querySelector('.z36-disclosure[data-z36="health-sources"]')?.setAttribute('open','');
  if (focus === 'fuelAdd' && document.getElementById('z17Fuel')) z36SetFuelSheet(true);
}

function z36EnhanceSaveFeedback() {
  document.querySelectorAll('[data-z17-save]').forEach(button => {
    const saved = button.disabled;
    button.classList.toggle('z36-saved', saved);
    button.setAttribute('aria-label', saved ? 'Saved food' : 'Save food');
  });
}

function z36Enhance() {
  document.body.classList.add('z36-ui');
  z36EnsureStyle();
  z36Navigation();
  z36SetPageCopy();
  z36CleanProductCopy();
  z36EnhanceToday();
  z36EnhanceTrain();
  z36EnhanceFuel();
  z36EnhanceAdventure();
  z36EnhanceProgress();
  z36EnhanceDevices();
  z36EnhanceSettings();
  z36EnhanceSaveFeedback();
  z36ApplyQaFocus();
}

function z36Schedule() {
  clearTimeout(z36Timer);
  z36Timer = setTimeout(z36Enhance, 40);
}

function z36Init() {
  z36EnsureStyle();
  z36Enhance();
  z36Observer = new MutationObserver(z36Schedule);
  z36Observer.observe(document.body, {childList:true,subtree:true});
  window.addEventListener('resize', z36Schedule);
  window.addEventListener('focus', z36Schedule);
  window.addEventListener('zero2fit:fuel-updated', z36Schedule);
  window.addEventListener('zero2fit:remote-sync', z36Schedule);
  setTimeout(z36Enhance, 500);
  setTimeout(z36Enhance, 1400);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z36Init, {once:true});
else z36Init();
