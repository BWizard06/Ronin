import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the tiny boot controller without a browser or a WebGL context.
const source=readFileSync(new URL('../src/components/LoadingScreen.astro',import.meta.url),'utf8').match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
function boot({reduced=false}={}) {
  class Element extends EventTarget {
    style={};dataset={};attributes={};inert=false;hidden=false;textContent='';tagName='DIV';
    setAttribute(name,value){this.attributes[name]=value;}
    contains(node){return this===node||Object.values(this.nodes??{}).includes(node);}
    querySelector(selector){return this.nodes[selector];}
  }
  const screen=new Element(),bar=new Element(),fill=new Element(),value=new Element(),status=new Element(),actions=new Element(),retry=new Element(),resume=new Element();
  actions.hidden=true;
  screen.nodes={'[role="progressbar"]':bar,'[data-loader-fill]':fill,'[data-loader-value]':value,'[data-loader-status]':status,'.loader-actions':actions,'[data-loader-retry]':retry,'[data-loader-continue]':resume};
  const page=new Element(),previouslyInert=new Element();previouslyInert.inert=true;
  const root=new Element(),document=new EventTarget(),window=new EventTarget();
  let focusReturned=false,reloads=0,dismissed=0;
  Object.assign(document,{readyState:'loading',documentElement:root,body:{children:[screen,page,previouslyInert]},activeElement:null,querySelector:selector=>selector==='[data-initial-loader]'?screen:{focus(){focusReturned=true;}}});
  window.matchMedia=()=>({matches:reduced});window.addEventListener('ronin:loading-dismissed',()=>dismissed++);
  const timers=new Map();let timerId=0,now=0;
  runInNewContext(source,{document,window,HTMLElement:Element,Event,AbortController,performance:{now:()=>now},location:{reload(){reloads++;}},setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const send=(name,detail)=>window.dispatchEvent(new CustomEvent(`ronin:${name}`,{detail}));
  const advance=duration=>{
    const end=now+duration;
    while(true){
      const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next||next[1].at>end)break;
      now=next[1].at;timers.delete(next[0]);next[1].fn();
    }
    now=end;
  };
  return {root,screen,page,previouslyInert,bar,fill,value,status,actions,retry,resume,document,timers,send,advance,get focusReturned(){return focusReturned;},get reloads(){return reloads;},get dismissed(){return dismissed;}};
}

test('cached assets keep the intro visible, while reduced motion skips the added hold and reveal',()=>{
  for(const reduced of [false,true]) {
    const ui=boot({reduced});assert.equal(ui.page.inert,true);
    ui.send('load-progress',100);
    assert.equal(ui.value.textContent,'99','download progress alone cannot dismiss the screen');
    assert.equal(ui.screen.hidden,false);
    ui.send('load-ready');assert.equal(ui.value.textContent,'100');
    assert.equal(ui.fill.style.strokeDashoffset,'0');
    if(!reduced){
      assert.equal(ui.root.dataset.loadState,'loaded');
      ui.advance(3199);assert.equal(ui.root.dataset.loadState,'loaded');assert.equal(ui.page.inert,true);
      ui.advance(1);
    }
    assert.equal(ui.root.dataset.loadState,'ready');
    ui.advance(reduced?0:900);
    assert.equal(ui.screen.hidden,true);assert.equal(ui.page.inert,false);
    assert.equal(ui.previouslyInert.inert,true,'preserve existing accessibility state');
    assert.equal(ui.root.dataset.loadState,undefined);assert.equal(ui.timers.size,0);
    ui.send('load-ready');assert.equal(ui.dismissed,1,'late events must not reopen the screen');
  }
});

test('a slow download must finish, then reveals immediately without adding another intro hold',()=>{
  const ui=boot();ui.send('load-progress',53);ui.advance(8000);
  assert.equal(ui.root.dataset.loadState,'loading');assert.equal(ui.page.inert,true);
  assert.equal(ui.value.textContent,'53');assert.equal(ui.fill.style.strokeDashoffset,'47');
  ui.send('load-ready');assert.equal(ui.root.dataset.loadState,'ready');
  ui.advance(900);assert.equal(ui.screen.hidden,true);assert.equal(ui.timers.size,0);
});

test('failed or stalled startup offers a working exit without claiming completion',()=>{
  for(const mode of ['error','timeout']) {
    const ui=boot();ui.send('load-progress',37);
    if(mode==='error')ui.send('load-error');else ui.advance(45000);
    assert.equal(ui.actions.hidden,false);assert.equal(ui.value.textContent,'37');
    ui.retry.dispatchEvent(new Event('click'));assert.equal(ui.reloads,1);
    ui.document.activeElement=ui.resume;
    ui.resume.dispatchEvent(new Event('click'));
    assert.equal(ui.page.inert,false);assert.equal(ui.screen.hidden,true);
    assert.equal(ui.focusReturned,true);assert.equal(ui.timers.size,0);
  }
});

test('hot disposal releases scroll and keyboard locks during an unfinished load',()=>{
  for(const ready of [false,true]){
    const ui=boot();if(ready)ui.send('load-ready');ui.send('load-cancel');ui.advance(5000);
    assert.equal(ui.root.dataset.loadState,undefined);assert.equal(ui.page.inert,false);assert.equal(ui.timers.size,0);
  }
});
