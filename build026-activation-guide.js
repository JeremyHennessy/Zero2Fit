import * as core from './activation-guide-core.mjs';

const APP_KEY='zero2fit-v1';
const FUEL_KEY='zero2fit-fuel-v2';
const BROWSER_KEY='zero2fit-activation-browser-v1';
const MANUAL_KEY='zero2fit-activation-manual-v1';
const PRIVATE_ACCEPTANCE_KEY='zero2fit-private-acceptance-v1';
const remote=window.Zero2FitRemoteSync;
const storage=window.Zero2FitStorage;
const ingestion=window.Zero2FitIngestion;
let initialized=false;
let busy=false;
let lastReport=null;

function readJson(key,fallback={}){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function browserId(){let id=localStorage.getItem(BROWSER_KEY);if(!id){id=globalThis.crypto?.randomUUID?.()||`browser-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;localStorage.setItem(BROWSER_KEY,id)}return id}
function manualState(){return readJson(MANUAL_KEY,{})}
function shortBrowser(id=browserId()){return String(id).replace(/^browser-/,'').slice(0,8)}

function ensureStylesheet(){if(document.querySelector('link[href="./build026.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./build026.css';document.head.appendChild(link)}

function ensureUi(){
  const sync=document.getElementById('z8PrivateSync');
  if(!sync||document.getElementById('z26ActivationGuide'))return Boolean(document.getElementById('z26ActivationGuide'));
  const card=document.createElement('article');
  card.id='z26ActivationGuide';
  card.className='card z26-activation';
  card.innerHTML=`
    <div class="z26-head">
      <div><div class="eyebrow">Activation guide · Build 026</div><h2>Finish real-account and iPhone acceptance.</h2><p class="muted">Build 024 proves the private store itself. This guide tracks the remaining real data flow across two browsers and the physical HealthKit checks software cannot manufacture.</p></div>
      <span class="small-tag" id="z26Overall">Checking</span>
    </div>
    <div class="z26-prereq" id="z26Infrastructure" data-state="pending"><span class="z26-prereq-icon">○</span><div><strong>Private-store infrastructure self-test</strong><small>Sign in, then run the Build 024 acceptance self-test above before cross-browser acceptance.</small></div></div>
    <div class="z26-actions"><button class="primary-button" type="button" id="z26Run">Run local checks</button><button class="z4-secondary" type="button" id="z26RunInfrastructure" hidden>Run private-store self-test</button><span id="z26Browser" class="z26-browser"></span></div>
    <p class="muted compact" id="z26Message">Reading local evidence…</p>
    <div class="z26-grid">
      <section class="z26-section"><div class="z26-section-head"><div><span>Build 020</span><h3>Real-account acceptance</h3></div><strong id="z26Build020Score">0 / 10</strong></div><div id="z26Build020Steps" class="z26-steps"></div></section>
      <section class="z26-section"><div class="z26-section-head"><div><span>Physical iPhone</span><h3>HealthKit acceptance</h3></div><strong id="z26DeviceScore">0 / 5</strong></div><div id="z26DeviceSteps" class="z26-steps"></div><div class="z26-manual">
        <label><input type="checkbox" data-z26-manual="healthkit_value_parity"> I compared representative values through source app → Apple Health → Zero2Fit.</label>
        <label><input type="checkbox" data-z26-manual="healthkit_background_delivery"> I confirmed physical HealthKit background delivery.</label>
        <label><input type="checkbox" data-z26-manual="renpho_model_label"> I checked the RENPHO underside model label.</label>
      </div></section>
    </div>
    <div class="z26-manual z26-adaptive-confirm"><label><input type="checkbox" data-z26-manual="adaptive_second_browser_confirmed"> On the second browser, the adaptive target matched after workout history reconstructed.</label><small>Manual confirmations are evidence only. They never create workouts, verify a HealthKit bundle, award Fitness XP or change RPG stats.</small></div>
    <div class="z26-evidence" id="z26Evidence"></div>`;
  sync.after(card);bindUi();return true;
}

const stateLabel=step=>step.done?'complete':step.partial?'partial':'pending';
const stateIcon=step=>step.done?'✓':step.partial?'◐':'○';

function build020Detail(step,r){
  const {fuel,workout,photos,cross,account,infrastructure}=r;
  return ({
    account:account.signed_in?'Authenticated session is active.':'Create/sign in above with the private account you want to keep.',
    'manual-food':`${fuel.manual_entries} manual/quick-line entr${fuel.manual_entries===1?'y':'ies'} detected.`,
    'provider-food':`${fuel.provider_entries} Open Food Facts entr${fuel.provider_entries===1?'y':'ies'} detected.`,
    'saved-meal':`${fuel.saved_meals} saved meal${fuel.saved_meals===1?'':'s'} detected.`,
    targets:`${fuel.targets_set} / 4 explicit macro/calorie targets set.`,
    sync:infrastructure.passed?(fuel.synced?`${fuel.remote_entries} Fuel entries reconciled after the private-store self-test.`:'Private store passed; run checks + sync.'):'Build 024 infrastructure self-test has not passed for this account yet.',
    'second-browser':`${cross.browser_count} authenticated browser snapshot${cross.browser_count===1?'':'s'} · Fuel reconstructed on two: ${cross.fuel_reconstructed?'yes':'not yet'}.`,
    'fuel-delete':`${fuel.tombstones} deletion tombstone${fuel.tombstones===1?'':'s'} visible here · seen in two browser snapshots: ${cross.fuel_deletion_propagated?'yes':'not yet'}.`,
    workout:`${workout.history_rows} exercise-history rows · ${workout.synced_sets} synced sets · two-browser history match: ${cross.matching_workout_history?'yes':'not yet'}.`,
    photo:`${photos.remote_assets} remote photo assets · upload→other-browser download: ${cross.photo_round_trip?'yes':'not yet'} · deletion propagation: ${cross.photo_deletion_propagated?'yes':'not yet'}.`
  })[step.id]||'';
}
function deviceDetail(step,d){return({
  zepp:`Exact source verified: ${d.zepp_verified?'yes':'no'} · observed metric types on that verified bundle: ${d.zepp_metric_types}.`,
  renpho:`Exact source verified: ${d.renpho_verified?'yes':'no'} · observed metric types on that verified bundle: ${d.renpho_metric_types}.`,
  parity:'Manual physical evidence checkpoint; it does not authorize device Fitness XP.',
  background:'Physical-device checkpoint; simulator/browser tests cannot establish background delivery.',
  'renpho-label':'Hardware-label checkpoint; keep the RENPHO model unresolved until the underside label is checked.'
})[step.id]||''}
function renderSteps(id,steps,detail,evidence){const target=document.getElementById(id);if(!target)return;target.innerHTML=steps.map(step=>`<div class="z26-step" data-state="${stateLabel(step)}"><span class="z26-step-icon">${stateIcon(step)}</span><span><strong>${esc(step.label)}</strong><small>${esc(detail(step,evidence))}</small></span></div>`).join('')}
function renderManual(manual,cross){document.querySelectorAll('[data-z26-manual]').forEach(input=>{input.checked=Boolean(manual[input.dataset.z26Manual]);if(input.dataset.z26Manual==='adaptive_second_browser_confirmed'){input.disabled=!(cross.browser_count>=2&&cross.workout_reconstructed&&cross.matching_workout_history);input.closest('label')?.classList.toggle('z26-disabled',input.disabled)}})}

function render(report){
  lastReport=report;
  const b=core.summarizeSteps(report.build020Steps),d=core.summarizeSteps(report.deviceSteps);
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('z26Overall',b.done&&d.done?'Activated':`${b.complete+d.complete} / ${b.total+d.total}`);
  set('z26Build020Score',`${b.complete} / ${b.total}`);set('z26DeviceScore',`${d.complete} / ${d.total}`);
  set('z26Browser',`Browser ${shortBrowser()} · ${report.cross.browser_count} authenticated snapshot${report.cross.browser_count===1?'':'s'}`);
  set('z26Run',report.account.signed_in?'Run checks + sync':'Run local checks');
  const infraRun=document.getElementById('z26RunInfrastructure');if(infraRun)infraRun.hidden=!(report.account.signed_in&&!report.infrastructure.passed&&window.Zero2FitPrivateAcceptance?.runAcceptanceSelfTest);
  const infra=document.getElementById('z26Infrastructure');if(infra){infra.dataset.state=report.infrastructure.passed?'complete':report.account.signed_in?'ready':'pending';infra.querySelector('.z26-prereq-icon').textContent=report.infrastructure.passed?'✓':'○';const small=infra.querySelector('small');if(small)small.textContent=report.infrastructure.passed?`Passed${report.infrastructure.finished_at?` · ${new Date(report.infrastructure.finished_at).toLocaleString()}`:''} · ${report.infrastructure.check_count||0} recorded checks.`:report.account.signed_in?'Authenticated. Run the self-test once; probe data is cleaned automatically.':'Sign in above, then run the Build 024 self-test.'}
  renderSteps('z26Build020Steps',report.build020Steps,build020Detail,report);renderSteps('z26DeviceSteps',report.deviceSteps,deviceDetail,report.devices);renderManual(report.manual,report.cross);
  const ev=document.getElementById('z26Evidence');if(ev)ev.innerHTML=`<span><strong>${report.fuel.entries}</strong> Fuel entries</span><span><strong>${report.workout.history_rows}</strong> exercise-history rows</span><span><strong>${report.photos.local_assets}</strong> local photos</span><span><strong>${report.devices.observed_bundles}</strong> observed HealthKit bundles</span>`;
  const msg=document.getElementById('z26Message');if(msg){if(!report.account.signed_in)msg.textContent='Local evidence checked. Sign in above when you are ready to exercise the real private-account path.';else if(!report.infrastructure.passed)msg.textContent='The account is signed in, but the private-store infrastructure self-test still needs to pass before Build 020 can complete.';else if(b.done&&d.done)msg.textContent='Build 020 and physical-device evidence are complete. Continue with Use → Measure → Tune.';else if(report.cross.browser_count<2)msg.textContent='This browser is registered. Open Zero2Fit in a second browser/private session, sign in to the same account, and run checks + sync there.';else msg.textContent='Two-browser evidence is active. Complete the remaining real actions shown below and rerun checks after each sync.'}
}

async function localEvidence(){const [events,photos]=await Promise.all([storage?.getRecentEvents?.(50000).catch(()=>[])||[],storage?.getAllPhotoMetadata?.().catch(()=>[])||[]]);return{app:readJson(APP_KEY,{}),fuel:readJson(FUEL_KEY,{}),events:events||[],photos:photos||[]}}
async function collectReport({remoteEvents=null}={}){
  const id=browserId(),status=remote?.status?.()||{configured:false,signed_in:false,last_sync:null},local=await localEvidence();
  let observations=[],verifications=[],preference=null,allEvents=remoteEvents||local.events;
  if(status.signed_in){try{const [pulled,observed,verified,prefs]=await Promise.all([remote.pullEvents?.(50000)||[],remote.pullSourceObservations?.()||[],remote.pullVerifications?.()||[],remote.pullUserPreferencesRow?.()||null]);allEvents=pulled||allEvents;observations=observed||[];verifications=verified||[];preference=prefs||null}catch{}}
  const snapshots=core.latestBrowserSnapshots(allEvents),prior=snapshots.find(row=>row.browser_instance_id===id)||{},manual=core.mergedManualEvidence(snapshots,manualState());
  const fuel=core.fuelEvidence(local.fuel,allEvents,status.last_sync||{}),workout=core.workoutEvidence(local.app,status.last_sync||{}),photos=core.photoEvidence(local.photos,allEvents,status.last_sync||{},prior.photos||{}),infrastructure=core.privateAcceptanceEvidence(readJson(PRIVATE_ACCEPTANCE_KEY,null),preference),devices=core.deviceEvidence(observations,verifications,manual);
  const snapshot={version:1,browser_instance_id:id,recorded_at:new Date().toISOString(),account:{signed_in:Boolean(status.signed_in)},infrastructure:{passed:infrastructure.passed,run_id:infrastructure.run_id},fuel,workout,photos,manual};
  const cross=core.crossBrowserEvidence([...snapshots.filter(row=>row.browser_instance_id!==id),snapshot]);
  return{account:snapshot.account,infrastructure,fuel,workout,photos,devices,manual,snapshot,cross,build020Steps:core.build020Steps({account:snapshot.account,infrastructure,fuel,workout,photos,cross,manual}),deviceSteps:core.physicalDeviceSteps(devices)};
}
async function publishSnapshot(snapshot){if(!snapshot?.browser_instance_id||!ingestion?.makeEvent||!storage?.upsertEvents)return null;const event=ingestion.makeEvent(core.activationSnapshotEventInput(snapshot));await storage.upsertEvents([event]);if(remote?.status?.().signed_in&&remote?.pushEvents)await remote.pushEvents([event]);return event}
async function runChecks({sync=false,publish=false}={}){if(busy)return;busy=true;document.getElementById('z26Run')?.setAttribute('disabled','');try{const signedIn=Boolean(remote?.status?.().signed_in);if(sync&&signedIn&&remote?.syncNow)await remote.syncNow();let report=await collectReport();if(publish){await publishSnapshot(report.snapshot);const pulled=signedIn&&remote?.pullEvents?await remote.pullEvents(50000).catch(()=>null):null;report=await collectReport({remoteEvents:pulled})}render(report)}catch(error){set('z26Message',`Activation checks could not finish: ${error.message}`)}finally{busy=false;document.getElementById('z26Run')?.removeAttribute('disabled')}}
function set(id,value){const node=document.getElementById(id);if(node)node.textContent=value}

function bindUi(){
  document.getElementById('z26Run')?.addEventListener('click',()=>{const signedIn=Boolean(remote?.status?.().signed_in);runChecks({sync:signedIn,publish:signedIn})});
  document.getElementById('z26RunInfrastructure')?.addEventListener('click',async()=>{if(!window.Zero2FitPrivateAcceptance?.runAcceptanceSelfTest||busy)return;busy=true;const button=document.getElementById('z26RunInfrastructure');if(button){button.disabled=true;button.textContent='Running self-test…'}try{await window.Zero2FitPrivateAcceptance.runAcceptanceSelfTest()}catch(error){set('z26Message',`Private-store self-test needs attention: ${error.message}`)}finally{busy=false;if(button){button.disabled=false;button.textContent='Run private-store self-test'}runChecks({sync:false,publish:false})}});
  document.querySelectorAll('[data-z26-manual]').forEach(input=>input.addEventListener('change',()=>{const manual=manualState();manual[input.dataset.z26Manual]=Boolean(input.checked);writeJson(MANUAL_KEY,manual);runChecks({sync:false,publish:false})}));
}
function bindEvents(){window.addEventListener('zero2fit:remote-session',()=>setTimeout(()=>runChecks({sync:false,publish:false}),50));window.addEventListener('zero2fit:remote-sync',()=>setTimeout(()=>runChecks({sync:false,publish:false}),120));window.addEventListener('zero2fit:private-acceptance',()=>setTimeout(()=>runChecks({sync:false,publish:false}),100));window.addEventListener('zero2fit:fuel-updated',()=>setTimeout(()=>runChecks({sync:false,publish:false}),80));window.addEventListener('focus',()=>setTimeout(()=>runChecks({sync:false,publish:false}),80))}
function qaFocus(){if(new URLSearchParams(location.search).get('qaFocus')!=='activation')return;setTimeout(()=>{document.getElementById('z26ActivationGuide')?.scrollIntoView({block:'start',behavior:'auto'});document.documentElement.dataset.zero2fitQaReady='activation'},1200)}
function init(){if(initialized)return;if(!remote||!storage||!ingestion||!document.getElementById('z8PrivateSync')||!window.Zero2FitPrivateAcceptance)return setTimeout(init,100);initialized=true;ensureStylesheet();if(!ensureUi())return;document.body.classList.add('build026-activation-guide');bindEvents();runChecks({sync:false,publish:false});qaFocus()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.Zero2FitActivationGuide={runChecks,collectReport,browserId,get lastReport(){return lastReport}};
