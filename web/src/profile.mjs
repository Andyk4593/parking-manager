export const PROFILE_KEY='parking-manager:profile-v1';
export function normalizeNickname(value){return [...String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim().replace(/\s+/g,' ')].slice(0,20).join('');}
const validScore=value=>Number.isSafeInteger(value)&&Math.abs(value)<=1000000;
export class ProfileStore{
  constructor(storage=()=>globalThis.localStorage){
    this.storage=storage;this.persistent=true;
    this.data={version:1,nickname:'',players:[],settings:{sound:true,music:true}};
    try{
      const raw=JSON.parse(storage().getItem(PROFILE_KEY));
      if(raw?.version===1){
        this.data.nickname=normalizeNickname(raw.nickname);
        this.data.settings={sound:raw.settings?.sound!==false,music:raw.settings?.music!==false};
        const names=new Set();
        for(const p of Array.isArray(raw.players)?raw.players:[]){
          const nickname=normalizeNickname(p?.nickname);
          if(!nickname||names.has(nickname)||!validScore(p.best)||!validScore(p.last)||p.best<p.last)continue;
          names.add(nickname);this.data.players.push({nickname,best:p.best,last:p.last});
          if(this.data.players.length===100)break;
        }
      }
    }catch{this.persistent=false;}
  }
  save(){try{this.storage().setItem(PROFILE_KEY,JSON.stringify(this.data));this.persistent=true;}catch{this.persistent=false;}return this.persistent;}
  select(value){const nickname=normalizeNickname(value);if(!nickname)return false;this.data.nickname=nickname;this.save();return true;}
  result(nickname=this.data.nickname){return this.data.players.find(p=>p.nickname===normalizeNickname(nickname))??null;}
  record(score){
    const nickname=this.data.nickname;if(!nickname||!validScore(score))return null;
    const previous=this.result(nickname),best=previous?Math.max(previous.best,score):score;
    this.data.players=this.data.players.filter(p=>p.nickname!==nickname);
    this.data.players.unshift({nickname,best,last:score});this.data.players.length=Math.min(100,this.data.players.length);this.save();
    return {best,last:score,isBest:!previous||score>previous.best};
  }
  setting(name,value){if(!['sound','music'].includes(name))return;this.data.settings[name]=Boolean(value);this.save();}
}
