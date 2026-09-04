const Z40_BREAKPOINT = 860;
let z40Observer = null;
let z40Timer = null;
let z40FuelOpen = false;

const Z40_ICONS = {
  today:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h5l2-6 3 12 2-6h4"/><path d="M4 5h16v14H4z"/></svg>',
  train:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6M2.5 10.5v3M19 9v6M21.5 10.5v3M5 12h14"/></svg>',
  nutrition:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4A2.5 2.5 0 0 0 7 10v11M9.5 3v4A2.5 2.5 0 0 1 7 10"/><path d="M16 4v17M16 4c2.8 1.4 4 4 4 7v1h-4"/></svg>',
  character:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 8 7l4 4 4-4-4-4Z"/><path d="M8 11 4.5 15 12 21l7.5-6-3.5-4"/></svg>',
  journey:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 6 5-5"/></svg>',
  data:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="8" cy="7" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="11" cy="17" r="1.5"/></svg>'
};

function z40EnsureStyle() {
  const hrefs = ['./build040.css','./build040-pages.css','./build040-mobile.css'];
  hrefs.forEach(href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });
}

function z40Page() {
  return document.querySelector('.page.active')?.id?.replace('page-','') || 'today';
}

function z40Navigate(page) {
  document.querySelector(`.nav-item[data-page="${page}"]`)?.click();
}

function z40SetText(selector, text) {
  const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (node && node.textContent !== text) node.textContent = text;
}

function z40Navigation() {
  const labels = {
    today:'Today', train:'Train', nutrition:'Fuel', character:'Adventure', journey:'Progress', data:'Devices'
  };
  const order = ['today','train','nutrition','character','journey','data'];
  const nav = document.getElementById('navList');
  if (!nav) return;

  if (!nav.dataset.z40Ordered) {
    order.forEach(page => {
      const button = nav.querySelector(`.nav-item[data-page="${page}"]`);
      if (button) nav.appendChild(button);
    });
    nav.dataset.z40Ordered = '1';
  }

  nav.querySelectorAll('.nav-item[data-page]').forEach(button => {
    const page = button.dataset.page;
    if (!labels[page]) return;
    if (!button.dataset.z40Nav) {
      button.dataset.z40Nav = '1';
      button.innerHTML = `<span class="z40-nav-icon">${Z40_ICONS[page]}</span><span>${labels[page]}</span>`;
    }
    if (!button.dataset.z40Bound) {
      button.dataset.z40Bound = '1';
      button.addEventListener('click', () => setTimeout(z40UpdateHeader, 0));
    }
  });
}

function z40Brand() {
  z40SetText('.brand-mark','02');
  z40SetText('.brand-name','Zero2Fit');
  z40SetText('.brand-subtitle','personal fitness system');
  const note = document.querySelector('.sidebar-note');
  if (note && !note.dataset.z40Copy) {
    note.dataset.z40Copy = '1';
    note.innerHTML = '<strong>Private fitness data</strong><span>Real activity powers every recommendation and game reward.</span>';
  }
}

function z40UpdateHeader() {
  const page = z40Page();
  const copy = {
    today:['Today','Do the next useful thing.'],
    train:['Train','A session that fits the place and the day.'],
    nutrition:['Fuel','Log quickly. Learn from the pattern.'],
    character:['Adventure','Your real fitness sets the ceiling.'],
    journey:['Progress','Watch the trend, not the noise.'],
    data:['Devices','Sources, sync and verification.']
  };
  const [title, subtitle] = copy[page] || ['Zero2Fit',''];
  z40SetText('#pageTitle', title);

  let descriptor = document.getElementById('z40PageDescriptor');
  if (!descriptor) {
    descriptor = document.createElement('p');
    descriptor.id = 'z40PageDescriptor';
    document.getElementById('pageTitle')?.after(descriptor);
  }
  z40SetText(descriptor, subtitle);
  document.body.dataset.z40Page = page;

  const date = document.getElementById('todayDate');
  if (date) date.classList.add('z40-date');

  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('z40HeaderSignal')) {
    const signal = document.createElement('div');
    signal.id = 'z40HeaderSignal';
    signal.className = 'z40-header-signal';
    signal.innerHTML = '<span></span><strong>Live personal system</strong>';
    topbar.querySelector('.topbar-actions')?.prepend(signal);
  }
}

function z40SectionIntro(parent, id, kicker, title, copy) {
  if (!parent || document.getElementById(id)) return;
  const intro = document.createElement('header');
  intro.id = id;
  intro.className = 'z40-section-intro';
  intro.innerHTML = `<span>${kicker}</span><h2>${title}</h2><p>${copy}</p>`;
  parent.prepend(intro);
}

function z40Disclosure(node, title, subtitle, key, open = false) {
  if (!node) return null;
  const wrapper = node.closest(`details[data-z40="${key}"]`);
  if (wrapper) return wrapper;

  const details = document.createElement('details');
  details.className = 'z40-disclosure';
  details.dataset.z40 = key;
  details.open = open;
  details.innerHTML = `<summary><span><strong>${title}</strong><small>${subtitle}</small></span><b aria-hidden="true">+</b></summary><div class="z40-disclosure-body"></div>`;
  node.before(details);
  details.querySelector('.z40-disclosure-body').appendChild(node);
  return details;
}

function z40Today() {
  const page = document.getElementById('page-today');
  if (!page) return;
  page.classList.add('z40-today');
  z40SectionIntro(page,'z40TodayIntro','DAILY BRIEF','One useful day at a time','Zero2Fit turns your real data into a short plan. No streak punishment, no fake urgency.');

  const hero = page.querySelector('.hero-grid');
  if (hero) {
    hero.classList.add('z40-day-brief');
    const momentum = hero.querySelector('.momentum-card');
    const character = hero.querySelector('.character-summary');
    if (momentum) {
      momentum.classList.add('z40-momentum-panel');
      hero.prepend(momentum);
      z40SetText(momentum.querySelector('.eyebrow'),'MOMENTUM');
      z40SetText(momentum.querySelector('h2'),'Today is still open');
    }
    if (character) {
      character.classList.add('z40-level-panel');
      z40SetText(character.querySelector('.eyebrow'),'FOUNDATION');
      z40SetText(character.querySelector('h2'),'Build capacity, then complexity');
    }
  }

  if (!document.getElementById('z40QuickActions')) {
    const quick = document.createElement('div');
    quick.id = 'z40QuickActions';
    quick.className = 'z40-quick-actions';
    quick.innerHTML = `
      <button type="button" data-z40-jump="train"><span>${Z40_ICONS.train}</span><strong>Start training</strong><small>Use today’s recommended session</small></button>
      <button type="button" data-z40-jump="nutrition"><span>${Z40_ICONS.nutrition}</span><strong>Log food</strong><small>Fast calories + protein entry</small></button>
      <button type="button" data-z40-jump="journey"><span>${Z40_ICONS.journey}</span><strong>Check progress</strong><small>Look at the longer trend</small></button>`;
    (hero || document.getElementById('z40TodayIntro'))?.after(quick);
    quick.querySelectorAll('[data-z40-jump]').forEach(button => button.addEventListener('click', () => z40Navigate(button.dataset.z40Jump)));
  }

  const sensors = document.getElementById('z4SensorStrip');
  if (sensors) sensors.classList.add('z40-health-row');

  const grid = page.querySelector('.content-grid');
  const workout = page.querySelector('.today-workout-card');
  const quests = page.querySelector('.quest-card');
  if (grid) grid.classList.add('z40-today-grid');
  if (workout) {
    workout.classList.add('z40-next-workout');
    grid?.prepend(workout);
    z40SetText(workout.querySelector('.eyebrow'),'NEXT SESSION');
  }
  if (quests) {
    quests.classList.add('z40-daily-goals');
    z40SetText(quests.querySelector('.eyebrow'),'TODAY');
    z40SetText(quests.querySelector('h2'),'Small wins');
  }

  if (!document.getElementById('z40ManualLog')) {
    const metrics = [...page.querySelectorAll('.metric-card')];
    if (metrics.length) {
      const panel = document.createElement('details');
      panel.id = 'z40ManualLog';
      panel.className = 'z40-disclosure z40-manual-log';
      panel.innerHTML = '<summary><span><strong>Manual entries</strong><small>Use only when a connected source is unavailable.</small></span><b aria-hidden="true">+</b></summary><div class="z40-manual-grid"></div>';
      metrics[0].before(panel);
      const target = panel.querySelector('.z40-manual-grid');
      metrics.forEach(card => target.appendChild(card));
    }
  }
}

function z40Train() {
  const page = document.getElementById('page-train');
  if (!page) return;
  page.classList.add('z40-train');
  z40SectionIntro(page,'z40TrainIntro','TRAINING','Do the set in front of you','Location, duration and recovery change the prescription; the training intent stays intact.');

  const header = page.querySelector('.train-header');
  if (header) header.classList.add('z40-train-summary');

  const focus = document.getElementById('z14FocusCard');
  if (focus) {
    focus.classList.add('z40-focus-card');
    if (!document.getElementById('z40TrainStage')) {
      const stage = document.createElement('section');
      stage.id = 'z40TrainStage';
      stage.className = 'z40-train-stage';
      focus.before(stage);
      stage.appendChild(focus);
    }
  }

  const context = document.getElementById('trainingContextCard');
  z40Disclosure(context,'Workout setup','Home, Apartment Gym or Full Gym · Quick, Standard or Full','train-setup');
  z40Disclosure(document.getElementById('z21WorkoutSyncStatus'),'Training history','Private session/set continuity and adaptive load history','train-sync');
  document.getElementById('exerciseList')?.classList.add('z40-exercise-list');
}

function z40FuelPanel() {
  if (document.getElementById('z40FuelSheet')) return;
  const panel = document.createElement('div');
  panel.id = 'z40FuelSheet';
  panel.className = 'z40-food-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <section class="z40-food-panel-card" role="dialog" aria-modal="true" aria-labelledby="z40FuelPanelTitle">
      <header><div><span>FOOD ENTRY</span><h2 id="z40FuelPanelTitle">Add what you ate</h2><p>Search, scan, repeat a saved item, or enter nutrition directly.</p></div><button type="button" id="z40FuelClose" aria-label="Close food entry">×</button></header>
      <div class="z40-food-panel-body"></div>
    </section>`;
  document.body.appendChild(panel);
  panel.addEventListener('click', event => { if (event.target === panel) z40SetFuelPanel(false); });
  document.getElementById('z40FuelClose')?.addEventListener('click', () => z40SetFuelPanel(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && z40FuelOpen) z40SetFuelPanel(false); });
}

function z40SetFuelPanel(open) {
  z40FuelOpen = Boolean(open);
  const panel = document.getElementById('z40FuelSheet');
  if (!panel) return;
  panel.hidden = !z40FuelOpen;
  document.body.classList.toggle('z40-food-open', z40FuelOpen);
  if (z40FuelOpen) setTimeout(() => document.getElementById('z18Search')?.focus(), 80);
}

function z40MoveFuelTools() {
  const target = document.querySelector('#z40FuelSheet .z40-food-panel-body');
  if (!target) return;
  const nodes = [
    document.getElementById('z18FoodLookup'),
    document.querySelector('#z17Fuel .z17-quick-grid'),
    document.querySelector('#z17Fuel .z17-saved-card')
  ].filter(Boolean);
  nodes.forEach(node => { if (node.parentElement !== target) target.appendChild(node); });
}

function z40Fuel() {
  const page = document.getElementById('page-nutrition');
  const fuel = document.getElementById('z17Fuel');
  if (!page || !fuel) return;
  page.classList.add('z40-fuel');
  z40SectionIntro(page,'z40FuelIntro','FUEL','Know enough to make the next choice','Fast logging first. Targets are explicit, never silently inferred.');
  z40FuelPanel();

  const hero = fuel.querySelector('.z17-fuel-hero');
  if (hero) hero.classList.add('z40-fuel-summary');
  if (hero && !document.getElementById('z40AddFood')) {
    const button = document.createElement('button');
    button.id = 'z40AddFood';
    button.type = 'button';
    button.className = 'z40-add-food';
    button.innerHTML = '<span>+</span><strong>Add food</strong><small>Search · scan · quick entry</small>';
    hero.after(button);
    button.addEventListener('click', () => z40SetFuelPanel(true));
  }
  z40MoveFuelTools();
  fuel.querySelector('.z17-log-card')?.classList.add('z40-food-log');
  document.getElementById('z19FuelSync')?.classList.add('z40-sync-line');
}

function z40Adventure() {
  const page = document.getElementById('page-character');
  if (!page) return;
  page.classList.add('z40-adventure');
  z40SectionIntro(page,'z40AdventureIntro','ADVENTURE','Fitness in, game progress out','The game can reward gear and materials. Permanent Fitness XP still comes from real actions.');

  const frontier = document.getElementById('z4FrontierCard');
  const battlefield = document.getElementById('z16Battlefield');
  if (frontier) frontier.classList.add('z40-adventure-status');
  if (battlefield) battlefield.classList.add('z40-battlefield');
  if (frontier && battlefield && frontier.nextElementSibling !== battlefield) frontier.after(battlefield);
  document.getElementById('z12AdventureControls')?.classList.add('z40-adventure-controls');
}

function z40Progress() {
  const page = document.getElementById('page-journey');
  if (!page) return;
  page.classList.add('z40-progress');
  z40SectionIntro(page,'z40ProgressIntro','PROGRESS','Evidence over impressions','Use weeks and repeated sessions to decide whether the plan is working.');

  const hero = page.querySelector('.journey-hero');
  if (hero) {
    hero.classList.add('z40-progress-summary');
    z40SetText(hero.querySelector('.eyebrow'),'LIFETIME');
    z40SetText(hero.querySelector('h2'),'Your trend line');
  }
  document.getElementById('z12ProgressTabs')?.classList.add('z40-progress-tabs');
  document.getElementById('z10Intelligence')?.classList.add('z40-intelligence');
  document.getElementById('z4BodyComposition')?.classList.add('z40-body-composition');
}

function z40Devices() {
  const page = document.getElementById('page-data');
  if (!page) return;
  page.classList.add('z40-devices');
  z40SectionIntro(page,'z40DevicesIntro','SOURCES','Trust the source before the score','Connected data stays source-aware. Verification is explicit and fail-closed.');

  const intro = page.querySelector('.data-intro');
  if (intro) intro.classList.add('z40-device-summary');
  const connections = page.querySelector('.connection-grid');
  if (connections) connections.classList.add('z40-device-list');

  z40Disclosure(page.querySelector('.data-table-card'),'Normalized timeline','Technical event records and provenance','data-records');
  z40Disclosure(document.getElementById('z24Acceptance'),'Private account self-test','RLS, CRUD, Storage and sync checks','account-test');
  z40Disclosure(document.getElementById('z26ActivationGuide'),'Activation checklist','Two-browser continuity and physical-device acceptance','activation');
  z40Disclosure(document.getElementById('z28HealthKitEvidence'),'HealthKit source verification','Exact Zepp and RENPHO source matching','healthkit');
}

function z40Settings() {
  const sheet = document.querySelector('#z12SettingsBackdrop .z12-settings-sheet');
  if (!sheet) return;
  sheet.classList.add('z40-settings');
  z40SetText(sheet.querySelector('.eyebrow'),'ZERO2FIT');
  z40SetText(sheet.querySelector('h2'),'Settings & private sync');
}

function z40CleanCopy() {
  const replacements = [
    ['#page-data .data-intro .eyebrow','CONNECTED HEALTH'],
    ['#page-data .data-intro h2','Your data sources'],
    ['#page-data .data-intro .muted','Amazfit, RENPHO, manual entries and private sync feed one source-aware timeline.'],
    ['#z17Fuel .z17-fuel-hero .eyebrow','TODAY'],
    ['#z18FoodLookup .eyebrow','SEARCH'],
    ['#z24Acceptance .eyebrow','ACCOUNT'],
    ['#z26ActivationGuide .eyebrow','SETUP'],
    ['#z28HealthKitEvidence .eyebrow','HEALTHKIT']
  ];
  replacements.forEach(([selector,text]) => z40SetText(selector,text));

  document.querySelectorAll('.eyebrow').forEach(node => {
    if (/build\s*\d+/i.test(node.textContent || '')) {
      node.textContent = (node.textContent || '').replace(/\s*[·—-]\s*build\s*\d+/ig,'').replace(/build\s*\d+\s*[·—-]?\s*/ig,'').trim() || 'ZERO2FIT';
    }
  });
}

function z40FocusTechnical() {
  const params = new URLSearchParams(location.search);
  const focus = params.get('qaFocus');
  if (focus === 'activation') document.querySelector('.z40-disclosure[data-z40="activation"]')?.setAttribute('open','');
  if (focus === 'healthkitEvidence') document.querySelector('.z40-disclosure[data-z40="healthkit"]')?.setAttribute('open','');
  if (focus === 'fuelAdd') z40SetFuelPanel(true);
  if (document.documentElement.dataset.zero2fitActivationHandoff === 'healthkit') {
    document.querySelector('.z40-disclosure[data-z40="healthkit"]')?.setAttribute('open','');
  }
}

function z40Compose() {
  document.body.classList.add('z40-rebuild');
  z40Navigation();
  z40Brand();
  z40CleanCopy();
  z40UpdateHeader();
  z40Today();
  z40Train();
  z40Fuel();
  z40Adventure();
  z40Progress();
  z40Devices();
  z40Settings();
  z40FocusTechnical();
}

function z40Schedule() {
  clearTimeout(z40Timer);
  z40Timer = setTimeout(z40Compose, 40);
}

function z40Observe() {
  if (z40Observer) return;
  z40Observer = new MutationObserver(z40Schedule);
  z40Observer.observe(document.body, { childList:true, subtree:true });
}

function z40Init() {
  z40EnsureStyle();
  z40Compose();
  z40Observe();
  window.addEventListener('zero2fit:remote-sync', z40Schedule);
  window.addEventListener('zero2fit:personal-intelligence', z40Schedule);
  window.addEventListener('zero2fit:activation-handoff', () => setTimeout(z40FocusTechnical, 0));
  window.addEventListener('resize', z40Schedule);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z40Init, { once:true });
else z40Init();