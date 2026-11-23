import { clamp, mix, smooth } from './motion.mjs';

/** A three quarter approach, a frontal passage, then an orbit of the canopy.
 * All poses derive from scroll position, so reverse scrolling retraces them. */
export function culturePath(progress, aspect, compact = false, reduced = false, area) {
  let p=clamp(progress);
  if(reduced)p=p<.38?0:p<.68?.53:.85;
  const pass=smooth(.19,.69,p), bloom=smooth(.45,.84,p);
  const approach=smooth(0,.22,p), align=smooth(.22,.45,p), orbit=smooth(.42,1,p);
  const availableHeight=area?Math.max(.12,area.bottom-area.top):1;
  const centreY=area ? .5-(area.top+area.bottom)/2 : .22;
  const gateStart=compact&&area?Math.min(aspect*1.2,availableHeight/.66):Math.min(.95,aspect*1.2);
  const gateScale=mix(gateStart,Math.max(8,aspect*8),pass);
  // Leave room for the canopy's depth when it is turned sideways or backwards.
  const treeEnd=compact?Math.min(.68,aspect*.95,area?availableHeight/.98:1):Math.min(.98,aspect*.58);
  const treeScale=mix(Math.min(.48,aspect*.85,treeEnd),treeEnd,bloom);
  return {
    gateScale, gateX:mix(compact?0:aspect*.12,0,smooth(.10,.35,p))+Math.sin(approach*Math.PI)*aspect*.035*(1-align),
    gateY:(compact?centreY:0)+.03*gateScale,
    gateYaw:mix(mix(-.80,.42,approach),0,align), gatePitch:mix(.10,-.035,approach)*(1-align),
    gateVisible:p<.69, treeScale,
    treeX:mix(aspect*.28,compact?0:-aspect*.23,bloom)+Math.sin(orbit*Math.PI)*aspect*.018,
    treeY:mix(.10,compact?centreY:.04,bloom),
    treeYaw:mix(-.90,1.05,orbit), treePitch:mix(.10,-.06,orbit), petalTravel:orbit,
  };
}
