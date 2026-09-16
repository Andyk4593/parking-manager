export const IDLE_SECONDS=30;
export class IdleTimer{
  constructor(){this.seconds=0;}
  reset(){this.seconds=0;}
  update(dt,mode,hidden=false){
    if(hidden||!['idle','result'].includes(mode)){this.reset();return false;}
    this.seconds+=Math.max(0,Number.isFinite(dt)?dt:0);
    return this.seconds>=IDLE_SECONDS;
  }
}
// The demo uses the same physics, never the player's score or persistence path.
export function advanceDemo(game,dt){
  for(let left=dt;left>1e-8;left-=1/120){
    for(const car of game.cars)if(car.state==='approaching'&&car.revealed&&!car.black&&car.arrivalAt-game.time<=.25)game.tap(car.lane);
    game.update(Math.min(left,1/120));
  }
}
