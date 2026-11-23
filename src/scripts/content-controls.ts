import { toggleTopic } from './interaction-state.mjs';
import { setupGlossary } from './glossary';
import { portraitLayout } from './viewport-layout.mjs';
export function setupContentControls(signal: AbortSignal, onTopic: (index: number) => void, onLight: (value: number) => void) {
  document.documentElement.classList.add('enhanced-content');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-detail]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.detail-panel'));
  const mobileParts=document.querySelector<HTMLElement>('.inspection-mobile-parts')!;
  let topic=0;
  function selectTopic(index: number) {
    topic=index;
    buttons.forEach(button => {const selected=Number(button.dataset.detail)===index;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',selected ? `${button.dataset.name}. Return to Sugata` : `Explore ${button.dataset.name}`);});
    panels.forEach((panel, i) => { panel.classList.toggle('is-selected', i === index); panel.inert = i !== index; panel.setAttribute('aria-hidden', String(i !== index)); });
    onTopic(index);
    const selected=mobileParts.querySelector<HTMLElement>(`[data-detail="${index}"]`);
    if(selected && mobileParts.clientWidth){const r=selected.getBoundingClientRect(),bounds=mobileParts.getBoundingClientRect();if(r.left<bounds.left)mobileParts.scrollLeft+=r.left-bounds.left;else if(r.right>bounds.right)mobileParts.scrollLeft+=r.right-bounds.right;}
  }
  buttons.forEach(button => button.addEventListener('click', () => { selectTopic(toggleTopic(topic,Number(button.dataset.detail))); }, { signal }));
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && !document.querySelector('dialog[open]') && document.activeElement?.closest('.inspection,.part-hotspots'))selectTopic(0);},{signal});
  const light = document.querySelector<HTMLInputElement>('#light-angle')!;
  light.addEventListener('input', () => onLight(Number(light.value) / 100), { signal });
  selectTopic(0); onLight(Number(light.value) / 100);

  const steelButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-steel-tab]'));
  const steelPanels=Array.from(document.querySelectorAll<HTMLElement>('.steel-panel'));
  const steelSection=document.querySelector<HTMLElement>('.steel-study')!;
  function selectSteel(index:number,focus=false) {
    steelSection.dataset.steel=String(index);
    steelButtons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
    steelPanels.forEach((panel,i)=>{panel.classList.toggle('is-selected',i===index);panel.inert=i!==index;panel.setAttribute('aria-hidden',String(i!==index));});
    if(focus)steelButtons[index].focus({preventScroll:true});
  }
  steelButtons.forEach((button,i)=>{
    button.addEventListener('click',()=>selectSteel(i),{signal});
    button.addEventListener('keydown',event=>{let next=i;if(event.key==='ArrowRight')next=(i+1)%steelButtons.length;else if(event.key==='ArrowLeft')next=(i+steelButtons.length-1)%steelButtons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=steelButtons.length-1;else return;event.preventDefault();selectSteel(next,true);},{signal});
  });
  selectSteel(0);

  const dates = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-era]'));
  const eras = Array.from(document.querySelectorAll<HTMLElement>('.era-panel'));
  const controls = document.querySelector<HTMLElement>('.timeline-controls')!;
  let raf = 0, previousIndex=-1;
  function updateTimeline() {
    raf = 0; const mid = window.innerHeight * .5;
    const distances = eras.map(era => { const r = era.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); });
    const index = distances.indexOf(Math.min(...distances));
    dates.forEach((button,i) => { if(i === index) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current'); });
    eras.forEach((era,i) => era.classList.toggle('is-selected', i === index));
    controls.style.setProperty('--timeline', `${index / Math.max(1,eras.length-1) * 100}%`);
    if(index!==previousIndex && portraitLayout(window.innerWidth,window.innerHeight)) {
      const button=dates[index],r=button.getBoundingClientRect(),bounds=controls.getBoundingClientRect();
      if(r.left<bounds.left+16)controls.scrollLeft+=r.left-bounds.left-16;
      else if(r.right>bounds.right-16)controls.scrollLeft+=r.right-bounds.right+16;
    }
    previousIndex=index;
  }
  dates.forEach((button,i) => button.addEventListener('click', () => {
    eras[i].scrollIntoView({block:portraitLayout(window.innerWidth,window.innerHeight)?'start':'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    eras[i].focus({preventScroll:true});
  }, {signal}));
  const request = () => { if (!raf) raf = requestAnimationFrame(updateTimeline); };
  window.addEventListener('scroll',request,{passive:true,signal}); window.addEventListener('resize',request,{passive:true,signal});
  signal.addEventListener('abort',()=>cancelAnimationFrame(raf),{once:true}); updateTimeline();

  setupGlossary(signal);
}
