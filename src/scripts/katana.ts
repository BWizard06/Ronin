import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createKatanaModel } from './katana-model';
import { loadKatanaAsset, installKatanaAsset, disposeModelResources } from './katana-asset';
import { applyComposition, fitComposition, departComposition, bridgeFrame } from './composition';
import { clamp, mix, sampleMotion } from './motion.mjs';
import { createOpeningWorld } from './opening-world';
import { hasAmbientMotion } from './opening-motion.mjs';
import { createDetailWorld } from './detail-world';
import { detailState, hasDetailMotion } from './detail-motion.mjs';
import { createObjectTypography, type ProjectedAnchors } from './object-typography';
import { createInspectionMotion } from './inspection.mjs';
import { createCulturalWorld } from './cultural-world';
import { cultureTarget, gestureIntent, turnCulture } from './culture-interaction.mjs';
import { loadSceneAsset, PROP_URLS, resources, releaseRetired, replaceChildren } from './scene-assets';
import { portraitLayout, renderPixelRatio } from './viewport-layout.mjs';
import { createRendererSize } from './renderer-size.mjs';

export type ViewFrame = ReturnType<typeof sampleMotion> & { inspection: number; history: number; culture: number; materials:number; bridge:number; cultureProgress?: number; bridgeProgress?:number; cultureTarget?:string };

type AssetTask = 'katana' | 'saya' | 'torii' | 'sakura' | 'scene';
export function createKatanaView(element: HTMLElement, onFrame: (frame: ViewFrame, anchors: ProjectedAnchors) => void, onProgress: (task: AssetTask, fraction: number) => void = () => {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  const renderSize = createRendererSize(renderer);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  // Compilation failures do not throw by default in Three.js. Route them to
  // the same readable fallback as a lost context instead of a blank canvas.
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    throw new Error([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader)].filter(Boolean).join('\n') || 'A scene shader could not compile.');
  };
  renderer.domElement.setAttribute('aria-hidden', 'true');
  element.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
  const environment = new RoomEnvironment();
  // Long softboxes give the polished blade an actual reflected light band.
  // They live only in the reflection map, never in the landscape itself.
  const stripGeometry = new THREE.PlaneGeometry(14, .28);
  const stripMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.1, 4.25), side: THREE.DoubleSide });
  const reflectionStrip = new THREE.Mesh(stripGeometry, stripMaterial);
  reflectionStrip.position.set(0, 2.1, 5); reflectionStrip.rotation.x = -.38;
  environment.add(reflectionStrip);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .03);
  scene.environment = environmentTarget.texture;
  environment.dispose(); stripGeometry.dispose(); stripMaterial.dispose(); pmrem.dispose();
  const key = new THREE.DirectionalLight('#fffaf2', 3.2); scene.add(key);
  const edge = new THREE.DirectionalLight('#ffffff', 2.1); edge.position.set(4, -2, 3); scene.add(edge);
  const rim = new THREE.DirectionalLight('#ed4b35', 1.3); rim.position.set(2, 2, -3); scene.add(rim);
  const ambient = new THREE.HemisphereLight('#f1efe8', '#161514', .8); scene.add(ambient);
  const katana = createKatanaModel(); scene.add(katana.root);
  const world = createOpeningWorld(); scene.add(world.root);
  const details = createDetailWorld(); scene.add(details.root);
  const typography = createObjectTypography(); scene.add(typography.root);
  const culture = createCulturalWorld(); scene.add(culture.root);
  const inspect = createInspectionMotion();
  const targets = { blade: new THREE.Vector3(), guard: new THREE.Vector3(), grip: new THREE.Vector3() };
  const state = { progress: 0, rotation: 0, tilt: 0, pointerX: 0, pointerY: 0, inspection: 0, history: 0, culture: 0, materials:0, bridge:0, cultureProgress: 0, bridgeProgress:0, light: .1, toriiTurn:0,toriiTilt:0,sakuraTurn:0,sakuraTilt:0 };
  let topic = 0, topicMotionUntil = 0;
  const partPoints = { blade:new THREE.Vector3(), grip:new THREE.Vector3(), guard:new THREE.Vector3(), saya:new THREE.Vector3() };
  const current = { ...state };
  let width = 1, height = 1, mobile = false;
  type ScreenArea = {left:number;right:number;top:number;bottom:number};
  let inspectionSlot: ScreenArea | undefined, cultureSlot: ScreenArea | undefined;
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  let frameId = 0, last = 0, worldTime = 0, ready = false, disposed = false, contextLost = false;
  let visible = true, reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dragging = false, pointerId: number | null = null, lastX = 0, lastY = 0, startX=0,startY=0;
  let dragTarget='';
  const pickRay=new THREE.Raycaster(),pickPointer=new THREE.Vector2();
  const assetRequest = new AbortController();
  const assetErrors: unknown[] = [];
  let assetsPrepared = false, initialSettled = false;
  let resolveLoaded!: () => void, rejectLoaded!: (error: unknown) => void;
  const loaded = new Promise<void>((resolve, reject) => { resolveLoaded = resolve; rejectLoaded = reject; });
  element.dataset.model = 'loading';
  // Keep a usable procedural view if the visitor continues after a failed load.
  const katanaReady = loadKatanaAsset(assetRequest.signal, value => onProgress('katana', value)).then(asset => {
    if (disposed) { disposeModelResources(asset.root, asset.textures); return; }
    installKatanaAsset(katana, asset);
    element.dataset.model = 'katana-v04'; onProgress('katana', 1); wake();
  }).catch(error => {
    if (disposed || assetRequest.signal.aborted) return;
    element.dataset.model = 'fallback';
    assetErrors.push(error);
    console.warn('The detailed katana could not load; keeping the interactive fallback.', error);
  });
  // Fetch in parallel, but install the separate saya after the main assembly so
  // a slower katana request cannot overwrite it with its embedded fallback.
  const sayaReady = loadSceneAsset(PROP_URLS.saya, assetRequest.signal, value => onProgress('saya', value)).then(async asset => {
    await katanaReady;
    if (disposed) { releaseRetired(asset.root); return; }
    replaceChildren(katana.saya, asset, katana.root);
    katana.textures = [...resources(katana.root).textures];
    element.dataset.saya = 'tripo'; onProgress('saya', 1); wake();
  }).catch(error => {
    if (!disposed && !assetRequest.signal.aborted) { assetErrors.push(error); console.warn('The new saya could not load; keeping the fitted fallback.', error); }
  });
  // The initial screen covers the entire experience, including the later garden.
  const cultureReady = (['torii', 'sakura'] as const).map(name =>
      loadSceneAsset(PROP_URLS[name], assetRequest.signal, value => onProgress(name, value)).then(asset => {
        if (disposed) { releaseRetired(asset.root); return; }
        if (name === 'torii') culture.installTorii(asset); else culture.installSakura(asset);
        onProgress(name, 1); wake();
      }).catch(error => {
        if (!disposed && !assetRequest.signal.aborted) { assetErrors.push(error); console.warn(`The ${name} could not load; keeping the interactive scenery.`, error); }
      })
  );
  Promise.all([katanaReady, sayaReady, ...cultureReady]).then(async () => {
    if (disposed) return;
    // Upload even the hidden garden textures and compile its materials before revealing.
    resources(scene).textures.forEach(texture => renderer.initTexture(texture));
    onProgress('scene', .35);
    await renderer.compileAsync(scene, camera);
    if (disposed) return;
    onProgress('scene', .8);
    assetsPrepared = true; wake();
  }).catch(error => { if (!disposed) rejectLoaded(error); });

  function render(time: number) {
    frameId = 0;
    if (disposed || (!visible && initialSettled) || document.hidden || contextLost) return;
    // Resizing clears the drawing buffer. Commit it here, immediately before
    // drawing, never in ResizeObserver after the browser has rendered a frame.
    const size = renderSize.apply();
    if (!size) return;
    width = size.width; height = size.height; mobile = portraitLayout(width, height);
    renderer.transmissionResolutionScale = coarsePointer.matches || mobile ? .5 : .75;
    const dt = Math.min((time - last) / 1000, .05) || .016; last = time;
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 11);
    let moving = false;
    for (const name of Object.keys(state) as (keyof typeof state)[]) {
      current[name] = mix(current[name], state[name], ease);
      if (Math.abs(current[name] - state[name]) > .00008) moving = true;
      else current[name] = state[name];
    }
    const frame: ViewFrame = { ...bridgeFrame(inspect(sampleMotion(current.progress,mobile), current.inspection,topic,mobile,dt,reduced,inspectionSlot),current.bridge,mobile), inspection: current.inspection, history: current.history, culture: current.culture, cultureProgress:current.cultureProgress, materials:current.materials, bridge:current.bridge, bridgeProgress:current.bridgeProgress,cultureTarget:activeCulture() };
    const contentPresence = clamp(current.inspection + current.history + current.culture + current.materials + current.bridge);
    const ambientMotion = (contentPresence < .999 && (hasAmbientMotion(frame.progress, reduced) || hasDetailMotion(frame.progress, reduced))) || ((current.culture+current.bridge) > .001 && !reduced);
    if (ambientMotion) worldTime += dt;
    katana.root.position.set(0,0,0);
    applyComposition(katana, frame, current.rotation, current.tilt);
    const fit = fitComposition(katana, frame, width / height);
    const half = fit.height / 2;
    camera.left = -half * width / height; camera.right = half * width / height;
    camera.top = half; camera.bottom = -half;
    camera.position.set(fit.x, fit.y, 24); camera.lookAt(fit.x, fit.y, 0); camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    // Move the opaque assembly out of the frame. Fading every overlapping
    // material exposed the tang/underlay as black bars and red grip blocks.
    departComposition(katana,clamp(current.history+current.culture+current.materials),fit.height,width/height);
    const worldInput = { progress: frame.progress, time: worldTime, reduced,
      pointerX: current.pointerX, pointerY: current.pointerY,
      viewport: { ...fit, aspect: width / height }, swordMatrix: katana.root.matrixWorld, presence: 1 - contentPresence, compact: mobile, cultureArea: cultureSlot };
    world.update({...worldInput,progress:mix(frame.progress,.97,current.bridge),presence:clamp(1-contentPresence+current.bridge*.45)});
    katana.blade.localToWorld(targets.blade.set(3.6, .2, 0));
    katana.guard.localToWorld(targets.guard.set(0, 0, 0));
    katana.grip.localToWorld(targets.grip.set(-1.1, 0, 0));
    details.update({ ...worldInput, targets });
    const anchors = typography.update({ ...worldInput, targets });
    culture.update(worldInput, current.culture,current.cultureProgress,current);
    partPoints.blade.copy(targets.blade);
    partPoints.grip.copy(targets.grip);
    partPoints.guard.copy(targets.guard);
    katana.saya.localToWorld(partPoints.saya.set(2.8,.12,0));
    anchors.parts = {} as NonNullable<ProjectedAnchors['parts']>;
    for (const name of ['blade','grip','guard','saya'] as const) {
      const p=partPoints[name].project(camera); anchors.parts[name]={x:.5+p.x/2,y:.5-p.y/2};
    }
    scene.environmentIntensity = mix(mix(1.1, .85, frame.dark), 1.45, current.inspection);
    scene.environmentRotation.x = .12 + Math.sin(frame.lightAngle) * .14 + current.light * .35 * current.inspection;
    scene.environmentRotation.y = current.light * 1.8 * current.inspection + current.pointerX * .10;
    ambient.intensity = mix(mix(.8, .45, frame.dark), .38, current.inspection);
    rim.intensity = mix(mix(.55, 1.5, frame.dark), .5, current.inspection);
    key.intensity = mix(3.2, 5.5, current.inspection);
    const angle = mix(frame.lightAngle, current.light * 2.4, current.inspection) + current.pointerX * (.6 + detailState(frame.progress).steel * .8);
    key.position.set(Math.sin(angle) * 7, 3 + Math.cos(angle) * 2 + current.pointerY, 5);
    try { renderer.render(scene, camera); }
    catch (error) {
      contextLost = true; console.warn('The 3D view could not render.', error);
      rejectLoaded(error);
      element.dispatchEvent(new CustomEvent('scene-unavailable')); return;
    }
    onFrame(frame, anchors);
    if (!ready) { ready = true; element.dispatchEvent(new CustomEvent('scene-ready')); }
    if (assetsPrepared && !initialSettled) {
      initialSettled = true;
      onProgress('scene', 1);
      if (assetErrors.length) rejectLoaded(new AggregateError(assetErrors, 'Some scene assets could not load.'));
      else resolveLoaded();
    }
    // scene-ready can synchronously call setProgress → wake. Reuse that request
    // rather than starting a second ambient render loop on the first frame.
    if (!frameId && visible && (moving || ambientMotion || time < topicMotionUntil)) frameId = requestAnimationFrame(render);
  }
  function wake() { if (!frameId && (visible || !initialSettled) && !document.hidden && !disposed && !contextLost) { last = performance.now(); frameId = requestAnimationFrame(render); } }
  function resize() {
    const bounds = element.getBoundingClientRect();
    const compact = portraitLayout(bounds.width, bounds.height);
    const ratio = renderPixelRatio(bounds.width, bounds.height, window.devicePixelRatio, coarsePointer.matches || compact);
    if (renderSize.request(bounds.width, bounds.height, ratio)) wake();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element);
  window.addEventListener('resize', resize, { passive: true });
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) wake(); else { cancelAnimationFrame(frameId); frameId = 0; } }); visibility.observe(element);
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); };
  document.addEventListener('visibilitychange', onVisibility);
  function activeCulture() {
    const target=cultureTarget(current.culture,current.cultureProgress);
    return target===cultureTarget(state.culture,state.cultureProgress)?target:'';
  }
  function canTurnKatana() {
    return state.progress>=.97 && state.inspection+state.history+state.culture+state.materials+state.bridge<.1
      && current.inspection+current.history+current.culture+current.materials+current.bridge<.1;
  }
  function cultureAction(action:string) {
    const target=activeCulture();if(!target)return;
    const turn=target==='torii'?'toriiTurn':'sakuraTurn',tilt=target==='torii'?'toriiTilt':'sakuraTilt';
    if(action==='left'||action==='right')state[turn]=clamp(state[turn]+(action==='left'?-.35:.35),-Math.PI,Math.PI);
    else if(action==='reset'){state[turn]=0;state[tilt]=0;}
    else if(action==='breeze'&&target==='sakura')culture.breeze(worldTime,reduced);
    wake();
  }
  function stopDrag() {
    const captured = pointerId; dragging = false; pointerId = null;dragTarget='';
    if (captured !== null && element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
    element.classList.remove('is-dragging'); wake();
  }
  function onDown(event: PointerEvent) {
    if(event.button!==0||!event.isPrimary||pointerId!==null)return;
    const rect = element.getBoundingClientRect();
    if (world.ripple((event.clientX - rect.left) / width, (event.clientY - rect.top) / height, worldTime, current.progress, reduced)) wake();
    const target=activeCulture();
    if(target){
      pickPointer.set((event.clientX-rect.left)/width*2-1,1-(event.clientY-rect.top)/height*2);
      pickRay.setFromCamera(pickPointer,camera);
      if(!culture.intersects(pickRay.ray,target))return;
      dragTarget=target;
    } else if(canTurnKatana())dragTarget='katana';else return;
    pointerId=event.pointerId;startX=lastX=event.clientX;startY=lastY=event.clientY;
    element.setPointerCapture(event.pointerId);
  }
  function onMove(event: PointerEvent) {
    if(pointerId!==null && event.pointerId!==pointerId)return;
    if (pointerId!==null) {
      if(!dragging){
        const intent=gestureIntent(event.clientX-startX,event.clientY-startY,event.pointerType==='touch');
        if(intent==='scroll'){stopDrag();return;}if(intent==='pending')return;
        dragging=true;element.classList.add('is-dragging');
      }
      if(dragTarget==='katana') {
        state.rotation = clamp(state.rotation + (event.clientX - lastX) * .007, -1.35, 1.35);
        if (event.pointerType !== 'touch') state.tilt = clamp(state.tilt + (event.clientY - lastY) * .004, -.5, .5);
      } else {
        const turn=dragTarget==='torii'?'toriiTurn':'sakuraTurn',tilt=dragTarget==='torii'?'toriiTilt':'sakuraTilt';
        state[turn]=turnCulture(state[turn],event.clientX-lastX,width);
        if(event.pointerType!=='touch')state[tilt]=clamp(state[tilt]+(event.clientY-lastY)*.002,-.12,.12);
      }
      lastX = event.clientX; lastY = event.clientY;
    } else if (event.pointerType === 'mouse' && !reduced) {
      const rect = element.getBoundingClientRect(); state.pointerX = (event.clientX - rect.left) / width - .5; state.pointerY = (event.clientY - rect.top) / height - .5;
      world.ripple(state.pointerX + .5, state.pointerY + .5, worldTime, current.progress, reduced);
    }
    wake();
  }
  function onUp(event:PointerEvent) {
    if(event.pointerId!==pointerId)return;
    if(!dragging&&dragTarget==='sakura'&&activeCulture()==='sakura')culture.breeze(worldTime,reduced);
    stopDrag();
  }
  function onLeave() { if (pointerId===null) { state.pointerX = 0; state.pointerY = 0; wake(); } }
  function reset() { state.rotation = 0; state.tilt = 0;state.toriiTurn=0;state.toriiTilt=0;state.sakuraTurn=0;state.sakuraTilt=0; wake(); }
  function onKey(event: KeyboardEvent) {
    const target=activeCulture();
    if(target){
      const action=event.key==='ArrowLeft'?'left':event.key==='ArrowRight'?'right':event.key==='Home'?'reset':target==='sakura'&&(event.key==='Enter'||event.key===' ')?'breeze':'';
      if(action){event.preventDefault();cultureAction(action);}return;
    }
    if (!canTurnKatana()) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); state.rotation = clamp(state.rotation + (event.key === 'ArrowLeft' ? -.2 : .2), -1.35, 1.35); wake(); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
  }
  function onLost(event: Event) { event.preventDefault(); contextLost = true; ready = false; cancelAnimationFrame(frameId); frameId = 0; rejectLoaded(new Error('The graphics context was lost.')); element.dispatchEvent(new CustomEvent('scene-unavailable')); }
  function onRestored() { contextLost = false; wake(); }
  element.addEventListener('pointerdown', onDown); element.addEventListener('pointermove', onMove); element.addEventListener('pointerup', onUp); element.addEventListener('pointercancel', stopDrag);
  element.addEventListener('lostpointercapture', stopDrag); element.addEventListener('pointerleave', onLeave); element.addEventListener('keydown', onKey);
  renderer.domElement.addEventListener('webglcontextlost', onLost); renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  resize(); wake();
  return {
    loaded,
    setLayout(inspection?:ScreenArea,cultural?:ScreenArea) { inspectionSlot=inspection;cultureSlot=cultural;wake(); },
    setProgress(value: number) { state.progress = clamp(value); if (!ready) current.progress = state.progress; if (state.progress < .97 && dragTarget==='katana') stopDrag(); wake(); },
    setContent(mode: string, presence: number, contentProgress = 0) {
      for (const name of ['inspection', 'history', 'culture','materials','bridge'] as const) { state[name] = mode === name ? clamp(presence) : 0; if (!ready) current[name] = state[name]; }
      state.bridgeProgress=mode==='bridge'?clamp(contentProgress):state.bridgeProgress;if(!ready)current.bridgeProgress=state.bridgeProgress;
      state.cultureProgress = mode === 'culture' ? clamp(contentProgress) : state.cultureProgress; if(!ready)current.cultureProgress=state.cultureProgress;
      if(pointerId!==null&&dragTarget!=='katana'&&dragTarget!==activeCulture())stopDrag();
      wake();
    },
    setTopic(value: number) { topic = Math.round(clamp(value,0,4)); topicMotionUntil=performance.now()+1500; wake(); },
    setLight(value: number) { state.light = clamp(value, -1, 1); wake(); },
    setReducedMotion(value: boolean) { reduced = value; if (reduced) { state.pointerX = 0; state.pointerY = 0; } wake(); }, reset, cultureAction,
    dispose() {
      disposed = true; assetRequest.abort(); rejectLoaded(new DOMException('View disposed', 'AbortError')); cancelAnimationFrame(frameId); stopDrag(); resizeObserver.disconnect(); window.removeEventListener('resize', resize); visibility.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
      element.removeEventListener('pointerdown', onDown); element.removeEventListener('pointermove', onMove); element.removeEventListener('pointerup', onUp); element.removeEventListener('pointercancel', stopDrag);
      element.removeEventListener('lostpointercapture', stopDrag); element.removeEventListener('pointerleave', onLeave); element.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(item => { if (item instanceof THREE.InstancedMesh) item.dispose(); if (item instanceof THREE.Mesh || item instanceof THREE.Line || item instanceof THREE.Points) { geometries.add(item.geometry); (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => materials.add(material)); } });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); resources(scene).textures.forEach(texture => texture.dispose()); environmentTarget.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
