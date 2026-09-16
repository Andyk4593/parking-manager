import {lanes,rect,poly} from './art.mjs';
export function gateArt(i,amount,admitting,active=true){
  const a=[1512,140],angle=amount*Math.PI/2,b=[a[0]+82*Math.cos(angle),a[1]-72*Math.cos(angle)-92*Math.sin(angle)];
  let s=`<g class="gate-art" data-lane="${i}" data-amount="${amount.toFixed(3)}" transform="translate(0 ${lanes[i]})" opacity="${active?1:.35}">`;
  s+=poly([[1514,146],[1599,74],[1606,80],[1521,152]],'#263f34','opacity=".5"');
  s+=poly([[a[0]+7,a[1]+5],[b[0]+7,b[1]+5],[b[0]-7,b[1]+5],[a[0]-7,a[1]+5]],'#004d2c');
  s+=poly([[a[0]-7,a[1]],[b[0]-7,b[1]],[b[0]+7,b[1]],[a[0]+7,a[1]]],'#006f3d');
  for(let n=0;n<5;n++){const t=(n+.2)/5,t2=(n+.65)/5,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,x2=a[0]+(b[0]-a[0])*t2,y2=a[1]+(b[1]-a[1])*t2;s+=poly([[x-7,y],[x2-7,y2],[x2+7,y2],[x+7,y]],'#f3efd6');}
  s+=rect(1494,140,36,33,'#004c2d')+poly([[1494,140],[1506,127],[1541,127],[1530,140]],'#369264')+poly([[1530,140],[1541,127],[1541,160],[1530,173]],'#003d25');
  s+=rect(1499,146,22,7,admitting?'#bef0a3':'#e8cf80')+rect(1503,161,15,4,'#0e7247');return s+'</g>';
}
