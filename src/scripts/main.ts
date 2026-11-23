import { clamp, mix, smooth, sampleMotion, reducedProgress } from './motion.mjs';
import type { createKatanaView, ViewFrame } from './katana';
import type { ProjectedAnchors } from './object-typography';
import { editorialState } from './editorial-motion.mjs';
import { sampleJourney, journeyOffset } from './journey-flow.mjs';
import { inspectionControls } from './interaction-state.mjs';
import { setupContentControls } from './content-controls';
import { createLoadProgress } from './load-progress.mjs';
import { portraitLayout, inspectionArea, culturalArea } from './viewport-layout.mjs';

const journey = document.querySelector<HTMLElement>('.journey')!;
const stage = document.querySelector<HTMLElement>('.stage')!;
const element = document.querySelector<HTMLElement>('.model-stage')!;
const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-moment]'));
const freeControls = document.querySelector<HTMLElement>('.free-controls')!;
const cultureControls=document.querySelector<HTMLElement>('.culture-controls')!;
const cultureButtons=Array.from(cultureControls.querySelectorAll<HTMLButtonElement>('[data-culture-action]'));
const begin = document.querySelector<HTMLButtonElement>('.begin')!;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const controller = new AbortController();
const signal = controller.signal;
const reportLoad = createLoadProgress((value: number) => {
  if (!signal.aborted) window.dispatchEvent(new CustomEvent('ronin:load-progress', { detail: value }));
});
// Explicitly load both editorial faces, including glyphs used later in the page.
const fontsReady = Promise.all([
  document.fonts.load('400 16px Anton', 'RŌNIN'),
  document.fonts.load('italic 400 16px "Instrument Serif"'),
]).then(() => document.fonts.ready).then(() => reportLoad('fonts', 1));
// Attach immediately: a font request may fail before the 3D module arrives.
fontsReady.catch(() => { if (!signal.aborted) window.dispatchEvent(new Event('ronin:load-error')); });
const flow = document.querySelector<HTMLElement>('.journey-flow')!;
const segments = Array.from(flow.querySelectorAll<HTMLElement>(':scope > [data-from]'));
let spans: { start: number; end: number; from: number; to: number; mode: string }[] = [];
let view: ReturnType<typeof createKatanaView> | undefined;
let requestedProgress = 0, scrollFrame = 0;
let requestedMode = '', requestedPresence = 0, requestedTopic = 0, requestedLight = .1;
let requestedContentProgress = 0;
const hotspots = document.querySelector<HTMLElement>('.part-hotspots')!;
const leader=document.querySelector<SVGSVGElement>('.inspection-leader')!;
const thread=document.querySelector<SVGSVGElement>('.culture-thread')!;
const inspectionCopy=document.querySelector<HTMLElement>('.inspection-copy')!;
const inspectionSpace=document.querySelector<HTMLElement>('.inspection-space')!;
const cultureSection=document.querySelector<HTMLElement>('.culture-section')!;
const cultureStories=Array.from(cultureSection.querySelectorAll<HTMLElement>('.culture-story'));
let cultureSlot: {left:number;right:number;top:number;bottom:number} | undefined;
const bridgeSection=document.querySelector<HTMLElement>('.culture-bridge')!;
const partButtons = Array.from(hotspots.querySelectorAll<HTMLButtonElement>('[data-part]'));
const contentStops = Array.from(document.querySelectorAll<HTMLElement>('[data-mode]'));
let unavailable = false;
let lastPainted = '';
const bodyBackground = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
journey.classList.remove('is-still');

function paint(frame: ViewFrame, anchors?: ProjectedAnchors) {
  if (unavailable) return;
  const ready = stage.classList.contains('is-ready');
  const width = stage.clientWidth, height = stage.clientHeight;
  const controls=inspectionControls(frame.inspection,ready);
  hotspots.style.opacity=String(controls.opacity);hotspots.inert=!controls.enabled;
  const selected=partButtons.find(button=>Number(button.dataset.detail)===requestedTopic);
  const point=selected && anchors?.parts?.[selected.dataset.part as keyof NonNullable<ProjectedAnchors['parts']>];
  leader.style.opacity=String(point && width>=1000 ? controls.opacity*.55 : 0);
  if(point && width>=1000){const rect=inspectionCopy.getBoundingClientRect(),x=point.x*width,y=point.y*height,ex=rect.left-24,ey=rect.top+Math.min(rect.height*.40,150);leader.querySelector('path')!.setAttribute('d',`M${x+22} ${y} Q${ex-70} ${y} ${ex} ${ey}`);leader.querySelector('circle')!.setAttribute('cx',String(ex));leader.querySelector('circle')!.setAttribute('cy',String(ey));}
  const bridgeProgress=frame.bridgeProgress??0;
  thread.style.opacity=String(smooth(.35,.85,frame.bridge)*smooth(.08,.42,bridgeProgress));
  if(anchors){const x=anchors.guard.x*width,y=anchors.guard.y*height,ex=width*.62,ey=height*.60;thread.querySelector('path')!.setAttribute('d',`M${x} ${y} C${width*.45} ${y+height*.16} ${width*.38} ${ey} ${ex} ${ey}`);}
  bridgeSection.style.setProperty('--bridge-progress',String(smooth(.12,.8,bridgeProgress)));
  partButtons.forEach(button=>{const p=anchors?.parts?.[button.dataset.part as keyof NonNullable<ProjectedAnchors['parts']>];if(!p)return;
    const visible=p.x>.025&&p.x<.975&&p.y>.07&&p.y<.94;button.hidden=!visible;button.style.left=`${p.x*100}%`;button.style.top=`${p.y*100}%`;});
  const signature = [frame.progress, frame.inspection, frame.history, frame.culture, frame.cultureProgress,frame.cultureTarget, frame.materials, frame.bridge, frame.bridgeProgress, requestedTopic, ready, width, height].join(':');
  if (signature === lastPainted) return;
  lastPainted = signature;
  const contentPresence = clamp(frame.inspection + frame.history + frame.culture + frame.materials + frame.bridge);
  const editorial = editorialState(frame.progress);
  const paper = [232, 232, 227], dark = [15, 15, 14], red = [237, 75, 53];
  const gardenWarmth=smooth(.42,.92,frame.cultureProgress??0);
  const gardenColour=[203,215,204].map((value,index)=>Math.round(mix(value,[237,221,208][index],gardenWarmth)));
  const background = paper.map((start, index) => Math.round(mix(mix(mix(mix(mix(start, dark[index], frame.dark), red[index], frame.red), [230,227,216][index], frame.inspection), start, frame.history), gardenColour[index], frame.culture)));
  const finalBackground=background.map((value,index)=>Math.round(mix(mix(value,[24,34,36][index],frame.materials),[222,225,211][index],frame.bridge)));
  const color = `rgb(${finalBackground.join(',')})`;
  stage.style.setProperty('--background', color); bodyBackground.content = color;
  stage.style.setProperty('--foreground', frame.dark > .58 && frame.red < .50 ? '#eeece5' : '#151513');
  stage.style.setProperty('--red-field', String(frame.red));
  panels.forEach(panel => {
    const id = panel.dataset.moment!;
    const opacity = editorial.opacity[id] * (1 - contentPresence);
    panel.style.opacity = String(opacity);
    panel.style.setProperty('--entrance', String(1 - opacity));
    panel.setAttribute('aria-hidden', String(id !== editorial.active || opacity < .1));
    panel.inert = id !== editorial.active || opacity < .9;

  });
  const free = frame.progress >= .97 && contentPresence < .1 && stage.classList.contains('is-ready');
  freeControls.style.opacity = String(frame.free * (1 - contentPresence));
  freeControls.inert = !free; freeControls.setAttribute('aria-hidden', String(!free));
  const cultureTarget=ready?(frame.cultureTarget??''):'';
  element.tabIndex = free||cultureTarget ? 0 : -1; stage.classList.toggle('is-free', free);
  element.classList.toggle('is-cultural',Boolean(cultureTarget));
  cultureControls.inert=!cultureTarget;cultureControls.setAttribute('aria-hidden',String(!cultureTarget));cultureControls.style.opacity=cultureTarget?'1':'0';
  if(cultureTarget){
    cultureControls.dataset.target=cultureTarget;
    const name=cultureTarget==='torii'?'torii':'cherry tree';
    cultureControls.setAttribute('aria-label',`Explore the ${name}`);
    element.setAttribute('aria-label',`${name}. Drag horizontally or use left and right arrow keys to turn it. Home resets the view.${cultureTarget==='sakura'&&!reduced.matches?' Tap the tree or press Enter for a breeze.':''}`);
    cultureButtons.forEach(button=>{
      const action=button.dataset.cultureAction;
      if(action==='left'||action==='right')button.setAttribute('aria-label',`Rotate the ${name} ${action}`);
      else if(action==='reset')button.setAttribute('aria-label',`Reset the ${name} view`);
    });
  } else element.setAttribute('aria-label','Complete katana. At the end of the experience, drag or use left and right arrow keys to turn it. Home resets the view.');
  begin.style.opacity = String(editorial.opacity.opening); begin.inert = editorial.opacity.opening < .2;
  stage.dataset.scene = editorial.active ?? 'object';
  contentStops.forEach(section=>{const amount=frame[section.dataset.mode as 'inspection'|'history'|'culture'|'materials'|'bridge'];section.style.setProperty('--content-visibility',String(smooth(.6,.95,amount)));section.inert=amount<.6;});
  const cultureSection=document.querySelector<HTMLElement>('.culture-section')!, phase=frame.cultureProgress??0;
  cultureSection.style.setProperty('--culture-paper',`rgb(${gardenColour.join(',')})`);
  const toriiCopy=(1-smooth(.18,.38,phase))*smooth(.6,.95,frame.culture), sakuraCopy=smooth(.60,.78,phase)*smooth(.6,.95,frame.culture);
  cultureSection.style.setProperty('--torii-copy',String(toriiCopy));cultureSection.style.setProperty('--sakura-copy',String(sakuraCopy));
  cultureSection.querySelector<HTMLElement>('.torii-story')!.inert=toriiCopy<.85;cultureSection.querySelector<HTMLElement>('.sakura-story')!.inert=sakuraCopy<.85;
}
function updateScroll() {
  scrollFrame = 0;
  if (unavailable) return;
  const sample = sampleJourney(spans, -flow.getBoundingClientRect().top, stage.offsetHeight);
  requestedProgress = reduced.matches ? reducedProgress(sample.progress) : sample.progress;
  requestedMode = sample.mode; requestedPresence = sample.presence;requestedContentProgress=sample.contentProgress;
  if (view) {
    const rect=inspectionSpace.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    const slot=portraitLayout(stage.clientWidth,stage.clientHeight)?inspectionArea(rect.top-stageRect.top,rect.bottom-stageRect.top,stage.clientHeight):undefined;
    view.setLayout(slot,cultureSlot);
    view.setProgress(requestedProgress); view.setContent(requestedMode, requestedPresence,requestedContentProgress);
  }
  else paint({ ...sampleMotion(requestedProgress, portraitLayout(window.innerWidth,window.innerHeight)), inspection: 0, history: 0, culture: 0, materials:0, bridge:0 });
}
function requestScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }
function measureFlow() {
  if(portraitLayout(stage.clientWidth,stage.clientHeight)) {
    const style=getComputedStyle(document.documentElement);
    const layout=culturalArea(stage.clientHeight,Math.max(...cultureStories.map(story=>story.offsetHeight)),cultureControls.offsetHeight,parseFloat(style.getPropertyValue('--safe-top'))||0,parseFloat(style.getPropertyValue('--safe-bottom'))||0);
    cultureSlot=layout.area;
    cultureSection.style.setProperty('--culture-copy-top',`${layout.copyTop}px`);
    cultureSection.style.setProperty('--culture-controls-top',`${layout.controlsTop}px`);
  } else cultureSlot=undefined;
  spans = segments.map(segment => ({ start: segment.offsetTop, end: segment.offsetTop + segment.offsetHeight, from: Number(segment.dataset.from), to: Number(segment.dataset.to), mode: segment.dataset.mode ?? '' }));
  requestScroll();
}
function goTo(progress: number, smooth = true) {
  const top = flow.getBoundingClientRect().top + window.scrollY + journeyOffset(spans, progress);
  window.scrollTo({ top, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
}
begin.addEventListener('click', () => goTo(.24), { signal });
document.querySelectorAll<HTMLAnchorElement>('[data-restart]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); view?.reset(); history.replaceState(null, '', '#top'); goTo(0); }, { signal }));
document.querySelector('.skip-link')!.addEventListener('click', event => { event.preventDefault(); const craft = document.querySelector<HTMLElement>('#craft')!; craft.scrollIntoView({ behavior: 'instant' }); craft.focus({ preventScroll: true }); }, { signal });
document.querySelector('.reset-view')!.addEventListener('click', () => view?.reset(), { signal });
cultureButtons.forEach(button=>button.addEventListener('click',()=>view?.cultureAction(button.dataset.cultureAction!),{signal}));
element.addEventListener('scene-ready', () => { unavailable = false; journey.classList.remove('is-still'); stage.classList.add('is-ready'); stage.classList.remove('is-unavailable'); measureFlow(); updateScroll(); }, { signal });
function showStill() {
  lastPainted = '';
  unavailable = true; stage.classList.remove('is-ready', 'is-free'); stage.classList.add('is-unavailable'); journey.classList.add('is-still'); freeControls.inert = true;cultureControls.inert=true;cultureControls.setAttribute('aria-hidden','true'); element.classList.remove('is-cultural');element.tabIndex = -1;
  panels.forEach(panel => { panel.setAttribute('aria-hidden', 'false'); panel.inert = false; });
  contentStops.forEach(section=>{section.inert=false;section.querySelectorAll<HTMLElement>('.culture-story').forEach(story=>story.inert=false);});
  document.querySelectorAll<HTMLElement>('.detail-panel,.steel-panel').forEach(panel=>{panel.inert=false;panel.setAttribute('aria-hidden','false');});
}
element.addEventListener('scene-unavailable', showStill, { signal });
window.addEventListener('scroll', requestScroll, { passive: true, signal });
window.addEventListener('resize', measureFlow, { passive: true, signal });
window.visualViewport?.addEventListener('resize',measureFlow,{passive:true,signal});
reduced.addEventListener('change', () => { view?.setReducedMotion(reduced.matches); updateScroll(); }, { signal });
window.addEventListener('pageshow', measureFlow, { signal });
window.addEventListener('ronin:loading-dismissed', measureFlow, { signal });
setupContentControls(signal, value => { requestedTopic=value;view?.setTopic(value); },value=>{requestedLight=value;view?.setLight(value);});
const flowObserver = new ResizeObserver(measureFlow);
for(const target of [flow,stage,inspectionSpace,cultureControls,...cultureStories])flowObserver.observe(target);
measureFlow();
updateScroll();
document.fonts.ready.then(() => { if (!signal.aborted) measureFlow(); });
import('./katana').then(({ createKatanaView }) => {
  if (signal.aborted) return;
  reportLoad('engine', 1);
  view = createKatanaView(element, paint, reportLoad); view.setReducedMotion(reduced.matches); view.setProgress(requestedProgress);
  updateScroll();
  view.setContent(requestedMode, requestedPresence,requestedContentProgress); view.setTopic(requestedTopic); view.setLight(requestedLight);
  Promise.all([view.loaded, fontsReady]).then(() => {
    if (!signal.aborted) window.dispatchEvent(new Event('ronin:load-ready'));
  }).catch(error => {
    if (signal.aborted) return;
    console.warn('The initial assets could not all be prepared.', error);
    window.dispatchEvent(new Event('ronin:load-error'));
  });
}).catch(error => { if (signal.aborted) return; console.warn('The interactive view could not start.', error); showStill(); window.dispatchEvent(new Event('ronin:load-error')); });
function cleanup() { controller.abort(); window.dispatchEvent(new Event('ronin:load-cancel')); flowObserver.disconnect(); cancelAnimationFrame(scrollFrame); view?.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, { signal });
if (import.meta.hot) import.meta.hot.dispose(cleanup);
