// A bounded rolling window; diagnostics report actual submitted frame work.
export class FrameMetrics {
 constructor(){this.samples=[];this.total=0;}
 sample(ms){if(!Number.isFinite(ms)||ms<=0)return;this.samples.push(ms);this.total++;if(this.samples.length>600)this.samples.shift();}
 snapshot(){const s=[...this.samples].sort((a,b)=>a-b);const at=p=>s.length?Number(s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2)):0;return{frames:this.total,medianMs:at(.5),p95Ms:at(.95),stalls:s.filter(v=>v>100).length};}
 reset(){this.samples=[];this.total=0;}
}
