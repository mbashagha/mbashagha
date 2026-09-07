export const QUALITY = Object.freeze({
 high:{scale:1.5,shadow:4096,samples:4,fps:60},medium:{scale:1.25,shadow:2048,samples:4,fps:30},low:{scale:1,shadow:1024,samples:2,fps:30}
});
export class QualityController {
 constructor(coarse=false){this.mode='auto';this.tier=coarse?'medium':'high';this.samples=[];this.slowWindows=0;this.elapsed=0;}
 set(mode){if(!['auto',...Object.keys(QUALITY)].includes(mode))throw new RangeError('Unknown quality');this.mode=mode;if(mode!=='auto')this.tier=mode;this.samples=[];this.elapsed=0;this.slowWindows=0;return this.tier;}
 sample(ms){if(this.mode!=='auto'||!Number.isFinite(ms)||ms<=0||ms>250)return false;this.samples.push(ms);this.elapsed+=ms;if(this.elapsed<4000)return false;
   const sorted=[...this.samples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.9)];this.samples=[];this.elapsed=0;
   this.slowWindows=p90>(this.tier==='high'?23:40)?this.slowWindows+1:0;
   if(this.slowWindows<2||this.tier==='low')return false;
   this.tier=this.tier==='high'?'medium':'low';this.slowWindows=0;return true;
 }
}
