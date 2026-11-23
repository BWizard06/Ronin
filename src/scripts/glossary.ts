export function setupGlossary(signal:AbortSignal) {
  const dialog=document.querySelector<HTMLDialogElement>('#glossary')!;
  const opener=document.querySelector<HTMLButtonElement>('.glossary-open')!;
  const index=dialog.querySelector<HTMLElement>('.glossary-index')!;
  const buttons=Array.from(index.querySelectorAll<HTMLButtonElement>('[data-word]'));
  const entries=Array.from(dialog.querySelectorAll<HTMLElement>('.glossary-entry'));
  const compact=window.matchMedia('(max-width:699px), (max-width:999px) and (orientation:portrait)');
  let selected=0, locked=false, previousOverflow='',previousBodyOverflow='',previousPadding='';
  let returnTo:HTMLElement=opener;

  function revealSelected() {
    const button=buttons[selected], r=button.getBoundingClientRect(), bounds=index.getBoundingClientRect();
    // Scroll only the index, never the document behind the dialog.
    if(compact.matches) {
      if(r.left<bounds.left+12)index.scrollLeft+=r.left-bounds.left-12;
      else if(r.right>bounds.right-12)index.scrollLeft+=r.right-bounds.right+12;
    } else {
      if(r.top<bounds.top+12)index.scrollTop+=r.top-bounds.top-12;
      else if(r.bottom>bounds.bottom-12)index.scrollTop+=r.bottom-bounds.bottom+12;
    }
  }
  function select(value:number,focus=false) {
    selected=value;
    buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===value));button.tabIndex=i===value?0:-1;});
    entries.forEach((entry,i)=>{entry.hidden=i!==value;if(i===value)entry.scrollTop=0;});
    if(focus)buttons[value].focus({preventScroll:true});
    revealSelected();
  }
  buttons.forEach((button,i)=>{
    button.addEventListener('click',()=>select(i),{signal});
    button.addEventListener('keydown',event=>{
      const previous=compact.matches?'ArrowLeft':'ArrowUp',next=compact.matches?'ArrowRight':'ArrowDown';
      let value=i;
      if(event.key===previous)value=(i+buttons.length-1)%buttons.length;
      else if(event.key===next)value=(i+1)%buttons.length;
      else if(event.key==='Home')value=0;
      else if(event.key==='End')value=buttons.length-1;
      else return;
      event.preventDefault();select(value,true);
    },{signal});
  });
  const orientation=()=>{index.setAttribute('aria-orientation',compact.matches?'horizontal':'vertical');if(dialog.open)revealSelected();};
  compact.addEventListener('change',orientation,{signal});orientation();
  function unlock() {
    if(!locked)return;
    document.documentElement.style.overflow=previousOverflow;
    document.documentElement.style.paddingRight=previousPadding;
    document.body.style.overflow=previousBodyOverflow;locked=false;
  }
  opener.addEventListener('click',()=>{
    if(dialog.open)return;
    returnTo=opener;
    previousOverflow=document.documentElement.style.overflow;
    previousBodyOverflow=document.body.style.overflow;
    previousPadding=document.documentElement.style.paddingRight;
    const gutter=window.innerWidth-document.documentElement.clientWidth;
    if(gutter>0)document.documentElement.style.paddingRight=`${parseFloat(getComputedStyle(document.documentElement).paddingRight)+gutter}px`;
    document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';locked=true;
    dialog.showModal();revealSelected();
  },{signal});
  dialog.querySelector('.glossary-close')!.addEventListener('click',()=>dialog.close(),{signal});
  dialog.addEventListener('close',()=>{unlock();returnTo.focus({preventScroll:true});},{signal});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  },{signal});
  dialog.querySelector('[data-glossary-history]')!.addEventListener('click',event=>{
    event.preventDefault();returnTo=document.querySelector<HTMLElement>('#history')!;
    dialog.close();unlock();returnTo.scrollIntoView({block:'start',behavior:'instant'});
  },{signal});
  signal.addEventListener('abort',()=>{if(dialog.open)dialog.close();unlock();},{once:true});
}
