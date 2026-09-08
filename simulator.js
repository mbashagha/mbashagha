import * as T from 'three';
import {createGrass} from './sim-render-grass.js?v=21';
import {QualityController,QUALITY} from './sim-render-quality.mjs?v=21';
import {FrameMetrics} from './sim-render-metrics.mjs';
import {loadGardenEnvironmentAssets,buildGardenEnvironment} from './sim-garden-environment.js?v=23';
import {loadGardenMaps,loadGardenMower,loadGardenCharacter} from './sim-render-assets.js?v=23';
import {compileForTarget,uploadSceneTextures,createShadowWarmup,captureGardenReflection,yieldToBrowser} from './sim-startup.mjs?v=23';
import {animateFoliage} from './sim-render-foliage.js?v=21';
import {Sky} from './vendor/Sky.js';
import {RGBELoader} from './vendor/RGBELoader.js';
import {LawnState,LAWN,OBSTACLES,clamp,free,moveRig} from './sim-world.mjs?v=12';
import {createMo} from './sim-character.js?v=13';
import {buildScenery,buildMower} from './sim-scenery.js?v=18';
import {GardenPost} from './sim-post.js?v=21';
import {Clippings,makeDestination} from './sim-effects.js?v=12';

const $=id=>document.getElementById(id),canvas=$('garden');
const bootStages={module:Math.round(performance.now())};
function bootStage(name){bootStages[name]=Math.round(performance.now());canvas.dataset.bootStages=JSON.stringify(bootStages);}
const shaderStages={};
function shaderStage(name){shaderStages[name]=renderer.info.programs.length;canvas.dataset.shaderStages=JSON.stringify(shaderStages);}
const frameMetrics=new FrameMetrics(),reviewParams=new URLSearchParams(location.search);
let gardenEnvironment=null,reviewCamera=null,daySky=null;
const coarse=matchMedia('(pointer:coarse)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let seed=5137;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const lawn=new LawnState(),rig={x:1,z:-7,yaw:0,speed:0};
let renderer,scene,camera,mo,mower,maskTexture,sky,sun,hemi,env,post,maps,clippings,destination;
let fps=60,cutLoad=0;
let grassSystem,foliage;const quality=new QualityController(matchMedia("(pointer:coarse)").matches);
let ready=false,portfolioActive=false,portfolioWasRunning=false,settingsWasRunning=false,completed=false,sweeping=false,pendingSweep=false;
let running=false,started=false,blade=true,night=false,first=false,soundOn=false,distance=0,elapsed=0,lastTime=0,frame=0;
let target=null,orbitYaw=0,orbitPitch=.2,touchAxis={x:0,y:0},keys=new Set(),drag=null;
let audio=null,osc=null,gain=null,filter=null;
const clock=new T.Clock(),v3=new T.Vector3(),cameraTarget=new T.Vector3(),ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
const mini=$('minimap').getContext('2d');

function buildGrass(){
 maskTexture=new T.DataTexture(lawn.mask,lawn.n,lawn.n,T.RedFormat);maskTexture.magFilter=maskTexture.minFilter=T.LinearFilter;maskTexture.needsUpdate=true;
 grassSystem=createGrass(scene,maskTexture,random,maps,(x,z)=>free(x,z));
}
function applyQuality(){
 const q=QUALITY[quality.tier];renderer.setPixelRatio(Math.min(devicePixelRatio,q.scale));renderer.setSize(innerWidth,innerHeight);post?.setQuality(q);post?.setSize(innerWidth,innerHeight);
 if(sun.shadow.mapSize.x!==q.shadow||sun.shadow.mapSize.y!==q.shadow){sun.shadow.mapSize.set(q.shadow,q.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}
 scene.traverse(o=>{if(o.isInstancedMesh&&o!==clippings?.mesh){if(o.userData.fullDensity===undefined)o.userData.fullDensity=o.count;
 // Preserve the original instance order while reducing foliage cost on slower devices.
 if(!o.userData.gardenAsset&&o.material.side===T.DoubleSide)o.count=Math.floor(o.userData.fullDensity*(quality.tier==='high'?1:quality.tier==='medium'?.7:.45));}});
 canvas.dataset.quality=quality.tier;
}

function setLight(){
 const direction=new T.Vector3(night?-.4:-.656,night?.3:.6151,night?.6:-.4373).normalize();sun.position.copy(direction.clone().multiplyScalar(45));
 sun.color.set(night?0xafcafa:0xffe6bd);sun.intensity=night?1.3:3.8;
 hemi.color.set(night?0x6f8bac:0xb3c9e2);hemi.groundColor.set(night?0x16251d:0x576c38);hemi.intensity=night?.9:.55;
 sky.visible=!night&&!daySky;scene.background=night?new T.Color(0x162c42):daySky||new T.Color(0xbecbda);scene.fog=new T.Fog(night?0x162c42:0xc0c8c1,42,140);
 scene.backgroundIntensity=1.15;renderer.toneMappingExposure=night?1.15:1.10;scene.environmentIntensity=night?.28:1.0;grassSystem?.setNight(night);
 scene.traverse(o=>{if(o.userData.gardenLamp)o.intensity=night?25:0;});
 $('light').innerHTML=(night?'Blue hour':'Golden hour')+' <kbd>L</kbd>';$('time-label').textContent=night?'20:16 · BLUE HOUR':'17:42 · GOLDEN HOUR';
}

async function init(){
 try{
 renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.15:1.35));renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 canvas.dataset.parallelShaders=String(renderer.extensions.has('KHR_parallel_shader_compile'));
 canvas.dataset.bootVisibility=document.visibilityState;
 scene=new T.Scene();camera=new T.PerspectiveCamera(innerWidth<650?60:51,innerWidth/innerHeight,.08,220);
 sun=new T.DirectionalLight();sun.castShadow=true;sun.shadow.mapSize.set(coarse?2048:4096,coarse?2048:4096);Object.assign(sun.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:95});sun.shadow.normalBias=.012;sun.shadow.bias=-.00006;scene.add(sun,sun.target);
 hemi=new T.HemisphereLight();scene.add(hemi);
 sky=new Sky();sky.scale.setScalar(180);sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.8;sky.material.uniforms.mieCoefficient.value=.003;sky.material.uniforms.mieDirectionalG.value=.86;sky.material.uniforms.sunPosition.value.set(-.55,.62,-.62);scene.add(sky);
 setLight();const pmrem=new T.PMREMGenerator(renderer);
 // Fetch/decode independently, then assemble with the same deterministic random
 // sequence. A slow character or sky no longer holds up every other request.
 const skyReady=new RGBELoader().loadAsync('./assets/garden-v2/day-sky-1k.hdr').catch(()=>null);
 const mapsReady=loadGardenMaps(renderer).then(value=>{bootStage('materials');return value;});
 const environmentReady=loadGardenEnvironmentAssets().then(value=>({value}),error=>({error}));
 const mowerReady=loadGardenMower(buildMower);
 const characterReady=loadGardenCharacter(async()=>{const old=await loadGardenMaps(renderer,{legacy:true});return createMo(old['mo-face'],old.fabric,old['hair-strands']);});
 const allAssets=Promise.all([skyReady,mapsReady,environmentReady,mowerReady,characterReady]);
 pmrem.compileEquirectangularShader();
 const [loadedSky,loadedMaps,environmentResult,loadedMower,loadedCharacter]=await allAssets;
 bootStage('downloads');maps=loadedMaps;daySky=loadedSky;
 try{
  if(daySky){daySky.mapping=T.EquirectangularReflectionMapping;env=pmrem.fromEquirectangular(daySky);scene.backgroundRotation.y=scene.environmentRotation.y=3.1808;}
  else env=pmrem.fromScene(sky,.025,.1,500);
 }finally{pmrem.dispose();}
 scene.environment=env.texture;setLight();bootStage('sky');
 const authored=new T.Group();
 try{if(environmentResult.error)throw environmentResult.error;gardenEnvironment=buildGardenEnvironment(authored,maps,random,environmentResult.value);scene.add(authored);canvas.dataset.assets='authored-v21';}
 catch(error){console.error('Authored garden assets failed to load',error);Object.assign(maps,await loadGardenMaps(renderer,{legacy:true}));buildScenery(scene,random,maps);canvas.dataset.assets='fallback';}
 bootStage('models');
 foliage=animateFoliage(scene);await yieldToBrowser();buildGrass();
 // Actors are prepared for compilation but excluded from the original static
 // glazing capture, retaining its exact garden-only composition.
 const glazing=[];scene.traverse(o=>{if(o.isMesh&&(o.userData.gardenGlass||o.material?.envMapIntensity===2))glazing.push(o);});
 const reflection=new T.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
 const reflectionCamera=new T.CubeCamera(.1,100,reflection);reflectionCamera.position.set(0,2.2,15.1);
 mower=loadedMower;scene.add(mower.root);
 mo=loadedCharacter;scene.add(mo.root);canvas.dataset.character=mo.source||'fallback';canvas.dataset.characterRevision=String(mo.revision||'legacy');
 bootStage('character');
 clippings=new Clippings(scene);destination=makeDestination(scene);
 updateRig(0);camera.position.set(5,2.5,-12);camera.lookAt(0,1,3);
 post=new GardenPost(renderer,camera);post.material.uniforms.aoStrength.value=.55;
 if(['high','medium','low'].includes(reviewParams.get('quality')))quality.set(reviewParams.get('quality'));
 applyQuality();setLight();installReviewControls();
 installQualityControl();
 // Submit shaders before ANY scene render, including the six reflection faces.
 // Shadow programs require their own warmup in Three r170. Both targets use the
 // same linear scene shader variants; the final display pass is warmed separately.
 bootStage('compileStart');const shadows=createShadowWarmup(scene);
 try{
  const programs=Promise.all([compileForTarget(renderer,scene,camera,reflection),compileForTarget(renderer,shadows.scene,camera,reflection),compileForTarget(renderer,post.scene,post.ortho,null)]);
  bootStage('compileSubmitted');
  await Promise.all([programs,uploadSceneTextures(renderer,scene,[maskTexture,grassSystem.uniforms.trackMap.value]).then(count=>{canvas.dataset.uploadedTextures=String(count);bootStage('texturesUploaded');})]);
  bootStage('compiled');shaderStage('warmed');
  renderer.initRenderTarget(post.target);
  captureGardenReflection(renderer,scene,reflectionCamera,[...glazing,mower.root,mo.root,clippings.mesh,destination]);
  glazing.forEach(o=>{o.material.envMap=reflection.texture;o.material.envMapIntensity=.70;o.material.needsUpdate=true;});
  bootStage('reflections');shaderStage('reflection');
  // Begin with the normal play-camera LODs and shadow selection, avoiding a
  // full-density throwaway first frame. The reflection above keeps its old detail.
  updateCamera(0);grassSystem.update(0,mower.root.position,camera,quality.tier,0);gardenEnvironment?.update(camera,quality.tier);
  await compileForTarget(renderer,scene,camera,post.target);bootStage('glazingCompiled');
  post.render(scene);shaderStage('firstFrame');
 }finally{shadows.dispose();}
 bootStage('ready');
 canvas.dataset.loadMs=String(Math.round(performance.now()));
 canvas.dataset.transferBytes=String(performance.getEntriesByType('resource').reduce((n,r)=>n+(r.transferSize||0),0));
 $('loading').hidden=true;bindControls();drawMap();renderer.setAnimationLoop(tick);
 }catch(error){console.error('Simulator initialization failed',error);$('loading').hidden=true;$('error').hidden=false;renderer?.setAnimationLoop(null);}
}

function installQualityControl(){
 const settings=$('garden-settings');if(!settings)return;
 const row=document.createElement('label');row.className='setting-row';row.innerHTML='<span>Graphics quality</span><select aria-label="Graphics quality"><option value="auto">Automatic</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>';
 const select=row.querySelector('select');select.style.cssText='font:inherit;background:var(--ui-paper);color:var(--ui-ink);padding:9px;border:1px solid var(--ui-line);border-radius:8px';
 select.onchange=()=>{quality.set(select.value);applyQuality();};settings.insertBefore(row,settings.querySelector('.instructions'));
}

function installReviewControls(){
 if(!reviewParams.has('review'))return;
 const views={pavilion:{position:[4,1.6,-3],target:[-.6,1.8,16]},border:{position:[8.1,1.35,-2.5],target:[11.8,1.0,7]},lawn:{position:[-2.5,.65,-4],target:[1,.25,4]},character:{position:[0,1.18,-2.65],target:[0,.92,.06],character:true},hair:{position:[0,1.61,-1.08],target:[0,1.43,0],character:true}};
 const bar=document.createElement('div');bar.style.cssText='position:fixed;z-index:1000;left:24px;top:84px;padding:8px 12px;background:#14221ee6;color:white;border-radius:8px;font:13px system-ui;display:flex;gap:12px;align-items:center';
 const label=document.createElement('label');label.textContent='Review view ';const select=document.createElement('select');select.setAttribute('aria-label','Review view');
 for(const [value,text] of [['play','Play camera'],['pavilion','Pavilion'],['border','Planting border'],['lawn','Grass detail'],['character','Character rear'],['hair','Hair and clothing']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 label.append(select);bar.append(label);document.body.append(bar);
 select.onchange=()=>{reviewCamera=views[select.value]||null;mo.firstPerson(!!reviewCamera&&!reviewCamera.character);$('intro').hidden=!!reviewCamera||started;frameMetrics.reset();updateCamera(1);};
 const initial=reviewParams.get('review');if(views[initial]){select.value=initial;select.onchange();}
}

function updateRig(dt){
 mower.root.position.set(rig.x,0,rig.z);mower.root.rotation.y=rig.yaw;
 mo.root.position.set(rig.x-Math.sin(rig.yaw)*1.05,0,rig.z-Math.cos(rig.yaw)*1.05);mo.root.rotation.y=rig.yaw;
 mo.animate(distance,rig.speed,clock.elapsedTime,reduced);
 mower.wheels.forEach(w=>w.rotation.x=distance/.16);
}
function updateCamera(dt){
 if(reviewCamera){
  camera.position.fromArray(reviewCamera.position);cameraTarget.fromArray(reviewCamera.target);
  if(reviewCamera.character){const up=new T.Vector3(0,1,0);camera.position.applyAxisAngle(up,rig.yaw).add(mo.root.position);cameraTarget.applyAxisAngle(up,rig.yaw).add(mo.root.position);}
  camera.lookAt(cameraTarget);return;
 }
 if(portfolioActive){const blend=reduced?1:1-Math.exp(-dt*3.2);camera.position.lerp(new T.Vector3(3,3.0,7),blend);cameraTarget.lerp(new T.Vector3(0,2,16),blend);camera.lookAt(cameraTarget);return;}
 if(!started){if(!reduced){const t=clock.elapsedTime*.025;camera.position.set(5+Math.sin(t)*.8,2.5,-12+Math.cos(t)*.3);}camera.lookAt(0,1.2,3);return;}
 const yaw=rig.yaw+orbitYaw;
 if(first){v3.set(mo.root.position.x,1.72,mo.root.position.z).add(new T.Vector3(Math.sin(rig.yaw)*.16,0,Math.cos(rig.yaw)*.16));camera.position.lerp(v3,1-Math.exp(-dt*18));cameraTarget.copy(v3).add(new T.Vector3(Math.sin(yaw)*5,-3.1+orbitPitch*2,Math.cos(yaw)*5));}
 else{const d=innerWidth<650?4.1:3.7,shoulder=0;v3.set(mo.root.position.x-Math.sin(yaw)*d+Math.cos(yaw)*shoulder,2.20+orbitPitch*1.5,mo.root.position.z-Math.cos(yaw)*d-Math.sin(yaw)*shoulder);v3.x=clamp(v3.x,-11.5,11.5);v3.z=clamp(v3.z,-13.2,14.5);camera.position.lerp(v3,1-Math.exp(-dt*5));cameraTarget.set(rig.x+Math.sin(yaw)*1.3,1.15,rig.z+Math.cos(yaw)*1.3);}
 camera.lookAt(cameraTarget);
}
function steerToTarget(){
 if(!target)return null;
 const dx=target.x-rig.x,dz=target.z-rig.z,d=Math.hypot(dx,dz);if(d<.3){target=null;return {throttle:0,steer:0};}
 const angle=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(angle-rig.yaw),Math.cos(angle-rig.yaw));
 return {throttle:Math.abs(diff)>1.2?.15:Math.min(1,d),steer:clamp(diff*2,-1,1)};
}
function tick(){
 const rawDt=clock.getDelta(),dt=Math.min(rawDt,.04);const t=clock.elapsedTime;
 if(document.hidden)return;
 frameMetrics.sample(rawDt*1000);
 if(running&&quality.sample(rawDt*1000))applyQuality();
 fps+=(1/Math.max(.001,rawDt)-fps)*.04;
 if(running){elapsed+=Math.min(rawDt,.2);let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
 if(touchAxis.y||touchAxis.x){throttle=-touchAxis.y;steer=-touchAxis.x;target=null;}else if(throttle||steer){target=null;orbitYaw=0;}else{const auto=steerToTarget();if(auto){throttle=auto.throttle;steer=auto.steer;}}
 const before={x:rig.x,z:rig.z};moveRig(rig,throttle,steer,dt);const moved=Math.hypot(rig.x-before.x,rig.z-before.z);distance+=moved*Math.sign(rig.speed);if(moved>.00001)grassSystem.trackSegment(before,rig);
 cutLoad*=Math.exp(-dt*4);if(blade&&moved>.00001){const cut=lawn.sweep(before,rig);if(cut){maskTexture.needsUpdate=true;cutLoad=Math.min(1,cutLoad+cut*.05);if(!reduced)clippings.spawn(rig.x,rig.z,rig.yaw,cut);}}
 clippings.update(dt);destination.visible=!!target;if(target){destination.position.set(target.x,.255,target.z);destination.scale.setScalar(1+Math.sin(t*4)*.08);}
 updateRig(dt);
 if(lawn.ratio>=.995)finishGarden();
 }
 if(!started||running||portfolioActive)updateCamera(dt);
 if(++frame%10===0){$('percent').textContent=Math.floor(lawn.ratio*100);$('progress-fill').style.width=`${lawn.ratio*100}%`;$('area').textContent=Math.round(lawn.area);$('elapsed').textContent=formatTime(elapsed);$('speed').innerHTML=`${(Math.abs(rig.speed)*3.6).toFixed(1)} <small>km/h</small>`;canvas.dataset.fps=String(Math.round(fps));drawMap();syncSound();}
 const artTime=reviewCamera?0:t;grassSystem.update(reduced?0:artTime,mower.root.position,camera,quality.tier,dt);foliage.update(reduced?0:artTime);gardenEnvironment?.update(camera,quality.tier);post.render(scene);
 if(frame%10===0){canvas.dataset.drawCalls=String(post.metrics.calls);canvas.dataset.triangles=String(post.metrics.triangles);canvas.dataset.frameP95=String(frameMetrics.snapshot().p95Ms);canvas.dataset.shaderPrograms=String(renderer.info.programs.length);}
}
function formatTime(s){return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
function drawMap(){
 const w=180,h=200;mini.fillStyle='#24452e';mini.fillRect(0,0,w,h);const n=lawn.n;
 mini.fillStyle='#bed397';for(let z=0;z<n;z+=2)for(let x=0;x<n;x+=2)if(lawn.mask[z*n+x]&&lawn.valid[z*n+x])mini.fillRect(9+x/n*162,10+z/n*180,2.1,2.3);
 mini.strokeStyle='#e9ead17f';mini.strokeRect(9,10,162,180);for(const o of OBSTACLES){mini.fillStyle='#172d20';mini.beginPath();mini.arc(9+(o.x/20+.5)*162,10+(o.z/24+.5)*180,o.r*8,0,Math.PI*2);mini.fill();}
 mini.save();mini.translate(9+(rig.x/20+.5)*162,10+(rig.z/24+.5)*180);mini.rotate(-rig.yaw);mini.fillStyle='#fff6d4';mini.beginPath();mini.moveTo(0,6);mini.lineTo(-4,-4);mini.lineTo(4,-4);mini.closePath();mini.fill();mini.restore();
}
function syncSound(){if(gain)gain.gain.setTargetAtTime(soundOn&&running&&blade ? .012+cutLoad*.004 : 0,audio.currentTime,.15);if(osc)osc.frequency.setTargetAtTime(47+Math.abs(rig.speed)*4-cutLoad*5,audio.currentTime,.1);}
function toggleSound(){soundOn=!soundOn;if(soundOn&&!audio){audio=new (window.AudioContext||window.webkitAudioContext)();osc=audio.createOscillator();osc.type='sawtooth';filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=350;gain=audio.createGain();gain.gain.value=0;osc.connect(filter).connect(gain).connect(audio.destination);osc.start();}if(soundOn)audio.resume().catch(()=>{});$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').innerHTML=(soundOn?'Sound on':'Sound off')+' <kbd>M</kbd>';syncSound();}
function toggleCamera(){first=!first;orbitYaw=0;orbitPitch=.2;mo.firstPerson(first);camera.fov=first?72:(innerWidth<650?60:51);camera.updateProjectionMatrix();$('camera').innerHTML=(first?'First person':'Third person')+' <kbd>C</kbd>';}
function toggleBlade(){blade=!blade;$('blade').setAttribute('aria-pressed',String(blade));$('blade').innerHTML=(blade?'Blade on':'Blade off')+' <kbd>Space</kbd>';syncSound();}
function pause(){if(!started||!$('complete').hidden)return;running=!running;keys.clear();target=null;rig.speed=0;$('pause-panel').hidden=running;syncSound();}
function reset(){grassSystem.clearTracks();completed=false;lawn.reset();maskTexture.needsUpdate=true;rig.x=1;rig.z=-7;rig.yaw=0;rig.speed=0;elapsed=0;distance=0;target=null;keys.clear();touchAxis={x:0,y:0};$('stick').style.transform='';$('complete').hidden=true;$('pause-panel').hidden=true;running=true;syncSound();}
function pick(e){if(!running)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);const point=ray.ray.intersectPlane(plane,new T.Vector3());if(point&&free(point.x,point.z,.4))target={x:point.x,z:point.z};}
function startGarden(){try{if(localStorage.getItem('mo:sound')==='true'&&!soundOn)toggleSound();}catch{}if(soundOn)audio?.resume().catch(()=>{});started=true;running=true;$('intro').hidden=true;$('hud').hidden=false;canvas.focus({preventScroll:true});}
function bindControls(){

 $('pause').onclick=pause;$('resume').onclick=pause;$('reset').onclick=reset;$('again').onclick=reset;$('camera').onclick=toggleCamera;$('sound').onclick=toggleSound;$('blade').onclick=toggleBlade;$('light').onclick=()=>{night=!night;setLight();};
 window.addEventListener('keydown',e=>{if(window.MO_PORTFOLIO?.isOpen()||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||(e.code==='Space'&&e.target.closest('button,a')))return;if(e.code==='Escape'){pause();return;}if(!started&&!e.target.closest('button,a,select')&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code))startGarden();if(!running)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(!e.repeat){if(e.code==='KeyC')toggleCamera();if(e.code==='KeyL'){night=!night;setLight();}if(e.code==='KeyM')toggleSound();if(e.code==='Space')toggleBlade();}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();touchAxis={x:0,y:0};drag=null;if(running)pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(!started&&!window.MO_PORTFOLIO?.isOpen())startGarden();if(!running)return;canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,look:e.button===2,id:e.pointerId};if(!drag.look)pick(e);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;if(drag.look){orbitYaw-=(e.clientX-drag.x)*.004;orbitPitch=clamp(orbitPitch+(e.clientY-drag.y)*.003,-.2,1);drag.x=e.clientX;drag.y=e.clientY;}else pick(e);});
 const release=()=>{drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 let joyId=null;const joy=$('joystick');const move=e=>{if(e.pointerId!==joyId)return;const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy),f=len>38?38/len:1;touchAxis={x:dx*f/38,y:dy*f/38};$('stick').style.transform=`translate(${dx*f}px,${dy*f}px)`;};
 joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);move(e);});joy.addEventListener('pointermove',move);for(const event of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(event,()=>{joyId=null;touchAxis={x:0,y:0};$('stick').style.transform='';});
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=first?72:(innerWidth<650?60:51);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);post.setSize(innerWidth,innerHeight);});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;syncSound();renderer.setAnimationLoop(null);$('error').hidden=false;});
 registerGardenTools();ready=true;try{if(localStorage.getItem('mo:sound')==='true'&&!soundOn)toggleSound();}catch{}window.dispatchEvent(new CustomEvent('mo:ready'));if(pendingSweep)mowAll();
}
function finishGarden(){
 if(completed)return;completed=true;running=false;target=null;rig.speed=0;keys.clear();touchAxis={x:0,y:0};syncSound();
 window.dispatchEvent(new CustomEvent('mo:complete'));
}
function mowAll(){
 if(!ready){pendingSweep=true;return;}if(sweeping||completed)return;
 pendingSweep=false;sweeping=true;started=true;running=false;target=null;rig.speed=0;keys.clear();touchAxis={x:0,y:0};$('intro').hidden=true;$('pause-panel').hidden=true;syncSound();
 const begin=performance.now(),duration=reduced?0:1200;let next=0;
 function sweep(now){const end=duration?Math.min(lawn.n,Math.ceil((now-begin)/duration*lawn.n)):lawn.n;
  for(;next<end;next++)for(let z=0;z<lawn.n;z++){const i=z*lawn.n+next;if(lawn.valid[i]&&!lawn.mask[i]){lawn.mask[i]=255;lawn.count++;}}
  maskTexture.needsUpdate=true;drawMap();if(next<lawn.n)requestAnimationFrame(sweep);else{sweeping=false;finishGarden();}
 }requestAnimationFrame(sweep);
}
addEventListener('mo:mow-all',mowAll);
addEventListener('mo:portfolio',e=>{if(e.detail.open){if(!portfolioActive)portfolioWasRunning=running;portfolioActive=true;running=false;keys.clear();target=null;rig.speed=0;touchAxis={x:0,y:0};}else{portfolioActive=false;running=portfolioWasRunning&&!completed;$('pause-panel').hidden=true;}syncSound();});
addEventListener('mo:settings',e=>{if(e.detail.open){settingsWasRunning=running;running=false;keys.clear();rig.speed=0;}else if(e.detail.resume&&settingsWasRunning&&!portfolioActive&&!completed){running=true;}syncSound();});
addEventListener('mo:pause',()=>{if(started&&!completed){running=false;$('pause-panel').hidden=false;syncSound();}});
function registerGardenTools(){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const snapshot=()=>({started,running,camera:first?'first':'third',percent:Math.floor(lawn.ratio*100),area:Math.round(lawn.area),position:{x:rig.x,z:rig.z},fps:Math.round(fps),quality:quality.tier,assets:canvas.dataset.assets,render:post.metrics,timing:frameMetrics.snapshot()});
 const tools=[
  {name:'read_garden',description:'Read the current visible game state and mowing progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('Expected an empty object');return snapshot();}},
  {name:'start_garden',description:'Start the garden or resume a paused mowing session, using the visible play controls.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute(input){if(!input||Object.keys(input).length)throw new Error('Expected an empty object');if(!started)startGarden();else if(!running&&$('complete').hidden)$('resume').click();return snapshot();}},
  {name:'set_garden_camera',description:'Switch the game to its first-person or third-person camera.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['first','third']}},required:['view'],additionalProperties:false},execute(input){if(!input||!['first','third'].includes(input.view)||Object.keys(input).length!==1)throw new Error('Choose first or third');if(first!==(input.view==='first'))toggleCamera();return snapshot();}},
  {name:'set_mower_destination',description:'Set a point on the lawn for the mower to walk toward, like clicking the lawn. Movement continues after this call.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:-9.6,maximum:9.6},z:{type:'number',minimum:-11.6,maximum:11.6}},required:['x','z'],additionalProperties:false},execute(input){if(!input||Object.keys(input).length!==2||!Number.isFinite(input.x)||!Number.isFinite(input.z)||!free(input.x,input.z,.4))throw new Error('Destination must be on clear lawn');if(!running)throw new Error('Start or resume the garden first');target={x:input.x,z:input.z};return{destination:target,...snapshot()};}}
 ];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional proposed browser API. */}}
}
init();
