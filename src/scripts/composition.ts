import * as THREE from 'three';
import { mix, smooth, sampleMotion } from './motion.mjs';
import type { createKatanaModel } from './katana-model';

type Model = ReturnType<typeof createKatanaModel>;
type Frame = ReturnType<typeof sampleMotion>;
const bounds = new THREE.Box3();
const sheathBounds = new THREE.Box3();
const centre = new THREE.Vector3();
const size = new THREE.Vector3();
const detail = new THREE.Vector3();

export function applyComposition(model: Model, frame: Frame, rotation = 0, tilt = 0) {
  model.root.rotation.set(frame.rotationX + tilt * frame.free, frame.rotationY + rotation * frame.free, frame.rotationZ);
  model.saya.position.set(frame.sayaX, frame.sayaY, 0);
  model.saya.rotation.z = frame.sayaAngle;
  // First pull the grip clear of the tang. Then slide the guard back along
  // that tang; only lift and turn it after it is fully clear of the blade.
  const gripRelease = smooth(0,.5,frame.separation), guardRelease = smooth(.35,.8,frame.separation), lift = smooth(.8,1,frame.separation);
  model.grip.position.set(-3.5 * gripRelease, -.3 * lift, .1 * lift);
  model.guard.position.set(-3 * guardRelease, .9 * lift, .35 * lift);
  model.guard.rotation.set(.15 * lift, -.55 * lift, -.12 * lift);
  model.blade.position.x = 0;
  model.root.updateMatrixWorld(true);
}

/** Leave all material layers opaque while the complete object exits spatially. */
export function departComposition(model: Model, presence: number, height: number, aspect: number) {
  const departure=smooth(0,.95,presence);
  model.root.position.set(-departure*height*.65*aspect,departure*height*1.5,0);
  model.root.rotation.z+=departure*.35;
  model.root.visible=departure<.999;
  model.root.updateMatrixWorld(true);
}

export function fitComposition(model: Model, frame: Frame, aspect: number) {
  // World-space bounds are calculated AFTER rotation and part separation.
  // This also keeps the complete object in frame during direct manipulation.
  bounds.setFromObject(model.sword).expandByScalar(.12);
  sheathBounds.setFromObject(model.saya);
  for (const axis of ['x', 'y', 'z'] as const) {
    bounds.min[axis] = mix(bounds.min[axis], Math.min(bounds.min[axis], sheathBounds.min[axis]), frame.paired);
    bounds.max[axis] = mix(bounds.max[axis], Math.max(bounds.max[axis], sheathBounds.max[axis]), frame.paired);
  }
  bounds.getCenter(centre); bounds.getSize(size);
  const safeWidth = frame.safeRight - frame.safeLeft;
  const safeHeight = frame.safeBottom - frame.safeTop;
  const fitHeight = Math.max(size.y / safeHeight, size.x / (aspect * safeWidth)) * 1.035;
  const x = centre.x + (.5 - (frame.safeLeft + frame.safeRight) / 2) * fitHeight * aspect;
  const y = centre.y + ((frame.safeTop + frame.safeBottom) / 2 - .5) * fitHeight;
  detail.set(frame.focusX, frame.focusY, 0).applyMatrix4(model.root.matrixWorld);
  const detailX = detail.x + (.5 - frame.screenX) * frame.detailHeight * aspect;
  const detailY = detail.y + (frame.screenY - .5) * frame.detailHeight;
  return {
    height: mix(fitHeight, frame.detailHeight, frame.zoom),
    x: mix(x, detailX, frame.zoom), y: mix(y, detailY, frame.zoom),
  };
}

/** Assemble the object beneath a short bridge from craft to landscape. */
export function bridgeFrame(frame:Frame,presence:number,mobile=false) {
 const target={rotationX:6.4,rotationY:-.18,rotationZ:mobile?.10:.18,zoom:0,separation:0,paired:1,sayaX:0,sayaY:-.87,sayaAngle:0,free:0,safeLeft:.08,safeRight:mobile?.88:.56,safeTop:mobile?.56:.48,safeBottom:mobile?.80:.82};
 const result={...frame};for(const key of Object.keys(target) as (keyof typeof target)[])result[key]=mix(frame[key],target[key],presence);return result;
}
