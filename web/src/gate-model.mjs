// Shared by the tutorial lane and the full shift. Timing is in game seconds.
export const createGate=()=>({openedAt:-Infinity,pulseUntil:-Infinity,closeAt:-Infinity,readyAt:0});
const smooth=x=>x*x*(3-2*x),clamp=x=>Math.max(0,Math.min(1,x));
export function openGate(g,time,rules){
  if(time+1e-9<g.readyAt)return false;
  g.openedAt=time;g.pulseUntil=time+rules.pulse;g.closeAt=g.pulseUntil;g.readyAt=g.closeAt+rules.fall+rules.recovery;return true;
}
export function gateAmount(g,time,rules){
  if(time<g.openedAt||!Number.isFinite(g.openedAt))return 0;
  if(time<g.openedAt+rules.rise)return smooth(clamp((time-g.openedAt)/rules.rise));
  if(time<g.closeAt)return 1;
  return 1-smooth(clamp((time-g.closeAt)/rules.fall));
}
export const canPass=(g,time,rules)=>time+1e-9>=g.openedAt+rules.rise&&time<g.pulseUntil-1e-9;
export function protectRear(g,at,car,rules){
  g.closeAt=Math.max(g.closeAt,at+(car.width+48)/car.speed);
  g.readyAt=g.closeAt+rules.fall+rules.recovery;
}
