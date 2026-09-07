import * as T from 'three';

// One continuous cloth surface per leg with smooth skin weights across the knee.
// The same bones drive the planted feet and the cloth, avoiding separate cylinders.
export function trouserLeg(root,side,material){
 const hip=new T.Bone(),knee=new T.Bone(),ankle=new T.Bone();
 hip.position.set(side*.105,.88,.025);knee.position.y=-.43;ankle.position.y=-.43;
 root.add(hip);hip.add(knee);knee.add(ankle);
 const p=[],n=[],uv=[],ix=[],skinIndex=[],skinWeight=[],colors=[];
 const rows=64,cols=48;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,a=i/cols*Math.PI*2,y=-t*.86;
  // The linen falls from the seat, eases around the knee, and gathers at the shoe.
  const profile=.107+.013*Math.sin(t*Math.PI)-.013*Math.pow(t,4);
  const vertical=Math.sin(a*7+t*1.3)*.005+Math.sin(a*11-t*2)*.002;
  const kneeFold=Math.exp(-Math.pow((t-.51)/.14,2))*Math.sin(t*44+a*1.8)*.006;
  const ankleFold=Math.pow(t,5)*Math.sin(t*63+a*2.1)*.011;
  const r=profile+vertical+kneeFold+ankleFold;
  p.push(side*.105+Math.sin(a)*r,.88+y,.025+Math.cos(a)*r*.88);
  uv.push(i/cols,t);
  const kneeBlend=T.MathUtils.smoothstep(t,.39,.62);
  skinIndex.push(0,1,0,0);skinWeight.push(1-kneeBlend,kneeBlend,0,0);
  const shade=.94+.06*Math.sin(a*7+t*1.3);colors.push(shade,shade,shade);
  if(j<rows&&i<cols){const k=j*(cols+1)+i;ix.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));g.setIndex(ix);g.computeVertexNormals();
 const cloth=material.clone();cloth.vertexColors=true;
 const mesh=new T.SkinnedMesh(g,cloth);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([hip,knee,ankle]));mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {leg:hip,shin:knee,foot:ankle,s:side};
}

export function seam(parent,points,radius,material){
 const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(16,points.length*3),radius,5,false);
 const mesh=new T.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
