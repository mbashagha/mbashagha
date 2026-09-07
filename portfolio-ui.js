(() => {
 'use strict';
 const $=id=>document.getElementById(id),is3d=document.body.dataset.game==='3d',query=new URLSearchParams(location.search),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 let open=false,finished=document.body.classList.contains('done'),settingsWasRunning=false,workPushed=false,opener=null;
 const read=(key)=>{try{return localStorage.getItem('mo:'+key);}catch{return null;}},write=(key,value)=>{try{localStorage.setItem('mo:'+key,value);}catch{}};
 let unlocked=false;try{unlocked=sessionStorage.getItem('mo:unlocked')==='true';}catch{}
 const root=document.createElement('div');root.id='portfolio-shell';root.innerHTML=`
 <header class="site-header"><a class="site-name" href="./index.html">Mo Bashagha<span>PRODUCT DESIGNER</span></a><nav class="mode-switch" aria-label="Visual mode"><a data-mode="retro" href="./index.html?gfx=retro">8-bit</a><a data-mode="ultra" href="./index.html?gfx=ultra">Ultra</a><a data-mode="3d" href="./simulator.html">3D Gaming</a></nav><span class="mode-picker"><span id="mode-value" aria-hidden="true"></span><svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="m2 6 4-4 4 4M2 10l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><select id="mode-select" aria-label="Visual mode"><option value="retro">8-bit</option><option value="ultra">Ultra</option><option value="3d">3D Gaming</option></select></span></header>
 <div class="garden-progress"><span>Lawn mo'ed:</span> <strong id="shared-progress">0%</strong></div>
 <div class="garden-toolbar" aria-label="Garden controls"><button id="shared-mow">Mo all</button><button id="shared-settings" aria-haspopup="dialog" aria-controls="garden-settings">Settings</button></div>
 <dialog id="garden-settings" aria-labelledby="settings-title"><div class="settings-heading"><div><h2 id="settings-title">Garden settings</h2></div><button id="settings-close" aria-label="Close settings">×</button></div><div class="setting-row"><span>Sound</span><button id="shared-sound" aria-pressed="false">Sound off</button></div><div class="setting-row"><span>Appearance</span><button id="shared-light">Day</button></div>${is3d?'<div class="setting-row"><span>Camera</span><button id="shared-camera">Third person</button></div><div class="setting-row"><span>Mower blade</span><button id="shared-blade">On</button></div><label class="setting-row"><span>Show game details</span><input id="shared-details" type="checkbox"></label><div class="setting-row"><span>Pause</span><button id="shared-pause">Pause game</button></div>':''}<div class="instructions"><h3>Controls</h3><p>${is3d?'Use W A S D or the arrow keys to move. Click the lawn to walk there. Drag with the right mouse button to look around. On touch screens, use the steering pad.':'Move your cursor across the lawn, or drag with your finger, to reveal the portfolio.'}</p><p>Mo all finishes the lawn for you. </p></div></dialog>`;
 document.body.append(root);
 if('scrollRestoration' in history)history.scrollRestoration='manual';
 const resetPageScroll=()=>window.scrollTo(0,0);addEventListener('pageshow',resetPageScroll);resetPageScroll();
 const header=root.querySelector('.site-header'),modeLinks=root.querySelector('.mode-switch'),brand=root.querySelector('.site-name');
 function fitModes(){const css=getComputedStyle(header),available=header.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);header.classList.toggle('compact-modes',brand.getBoundingClientRect().width+modeLinks.getBoundingClientRect().width+24>available);}
 new ResizeObserver(fitModes).observe(header);new ResizeObserver(fitModes).observe(brand);new ResizeObserver(fitModes).observe(modeLinks);document.fonts.ready.then(fitModes);
 $('mode-select').onchange=e=>{const link=root.querySelector('[data-mode="'+e.target.value+'"]');if(link)location.href=link.href;};
 const scene=$('portfolio-scene'),career=$('career-dialog'),settings=$('garden-settings');
 function emit(name,detail){dispatchEvent(new CustomEvent('mo:'+name,{detail}));}
 function mode(){return is3d?'3d':(document.body.classList.contains('ultra')||(!window.LAWN&&query.get('gfx')==='ultra'))?'ultra':'retro';}
 function sync(){
  $('edition').textContent=mode()==='retro'?'8-bit edition':mode()==='ultra'?'Ultra edition':'3D Gaming edition';$('mode-select').value=mode();$('mode-value').textContent=$('mode-select').selectedOptions[0].textContent;
  root.querySelectorAll('[data-mode]').forEach(a=>{if(a.dataset.mode===mode())a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');const url=new URL(a.href);if(open||unlocked)url.searchParams.set('view','portfolio');else url.searchParams.delete('view');a.href=url.href;});
  const sound=is3d?$('sound'):$('mute'),on=sound?.getAttribute('aria-pressed')==='true';$('shared-sound').textContent=on?'Sound on':'Sound off';$('shared-sound').setAttribute('aria-pressed',String(on));
  const night=is3d?$('light')?.textContent.includes('Blue'):document.body.classList.contains('night');$('shared-light').textContent=night?'Night':'Day';
  if(is3d){$('shared-camera').textContent=$('camera')?.textContent.includes('First')?'First person':'Third person';$('shared-blade').textContent=$('blade')?.getAttribute('aria-pressed')==='true'?'On':'Off';}
  $('shared-mow').textContent=finished?'Mow again':'Mo all';
  const pct=is3d?$('percent')?.textContent:document.querySelector('#progress .pct')?.textContent?.replace('%','');$('shared-progress').textContent=finished?'100%':`${Math.min(100,Math.max(0,parseFloat(pct)||0))}%`;
 }
 function show(completed=false){
  if(completed){finished=true;unlocked=true;try{sessionStorage.setItem('mo:unlocked','true');}catch{}}
  if(open){sync();return;}open=true;document.title='Mo Bashagha — Product Designer';document.body.classList.add('portfolio-open');emit('portfolio',{open:true,completed});
  document.querySelectorAll('canvas').forEach(c=>c.inert=true);scene.inert=false;$('portfolio-title').focus({preventScroll:true});
  const u=new URL(location.href);u.searchParams.set('view','portfolio');history.replaceState(history.state,'',u);sync();
 }
 function restart(){try{sessionStorage.removeItem('mo:unlocked');}catch{}const u=new URL(location.href);u.searchParams.delete('view');u.hash='';location.href=u.href;}
 function hide(){if(finished){restart();return;}open=false;scene.inert=true;document.body.classList.remove('portfolio-open');document.querySelectorAll('canvas').forEach(c=>c.inert=false);emit('portfolio',{open:false});const u=new URL(location.href);u.searchParams.delete('view');history.replaceState(history.state,'',u);$('shared-mow').focus({preventScroll:true});sync();}
 window.MO_PORTFOLIO={show,hide,isOpen:()=>open||career.open||settings.open,complete:()=>show(true)};
 if($('pause-portfolio'))$('pause-portfolio').onclick=e=>{e.preventDefault();$('pause-panel').hidden=true;show();};
 $('shared-mow').onclick=()=>{if(finished){restart();return;}$('shared-mow').disabled=true;if(is3d)emit('mow-all');else if(window.LAWN)window.LAWN.skip();else show(true);};
 $('shared-sound').onclick=()=>{const button=is3d?$('sound'):$('mute');if(!is3d&&!window.LAWN)button?.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));else button?.click();const on=button?.getAttribute('aria-pressed')==='true';write('sound',String(on));sync();};
 $('shared-light').onclick=()=>{if(!is3d&&!window.LAWN)document.body.classList.toggle('night');else (is3d?$('light'):$('modebtn'))?.click();sync();write('appearance',$('shared-light').textContent==='Night'?'night':'day');};
 $('shared-settings').onclick=()=>{settingsWasRunning=!open;emit('settings',{open:true});settings.showModal();};
 function closeSettings(){settings.close();}
 settings.addEventListener('close',()=>{emit('settings',{open:false,resume:settingsWasRunning});$('shared-settings').focus({preventScroll:true});});$('settings-close').onclick=closeSettings;
 if(is3d){$('shared-camera').onclick=()=>{$('camera').click();sync();};$('shared-blade').onclick=()=>{$('blade').click();sync();};$('shared-details').onchange=e=>document.body.classList.toggle('game-details',e.target.checked);$('shared-pause').onclick=()=>{settingsWasRunning=false;settings.close();emit('pause');};}
 function openWork(push=true){if(career.open)return;if(!open)show();opener=document.activeElement;career.showModal();$('workbtn').setAttribute('aria-expanded','true');$('career-close').focus({preventScroll:true});if(push&&location.hash!=='#work'){history.pushState({work:true},'','#work');workPushed=true;}}
 function closeWork(){career.close();}
 $('workbtn').onclick=()=>openWork();$('career-close').onclick=closeWork;
 career.addEventListener('close',()=>{$('workbtn').setAttribute('aria-expanded','false');if(location.hash==='#work'){if(workPushed)history.back();else history.replaceState(null,'',location.pathname+location.search);}workPushed=false;(opener?.isConnected?opener:$('workbtn')).focus({preventScroll:true});});
 for(const dialog of [career,settings])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 addEventListener('popstate',()=>{if(location.hash==='#work')openWork(false);else if(career.open){workPushed=false;career.close();}});
 addEventListener('mo:complete',()=>{$('shared-mow').disabled=false;show(true);});addEventListener('mo:ready',()=>{if(is3d&&read('appearance')==='night'&&!$('light').textContent.includes('Blue'))$('light').click();if(open)emit('portfolio',{open:true,completed:finished});sync();});
 // Keep game shortcuts away from links, dialogs, and the visible portfolio.
 document.addEventListener('keydown',e=>{if((open||career.open||settings.open)&&!e.target.closest('canvas'))e.stopPropagation();},true);
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 for(const id of is3d?['sound','light','camera','blade','percent']:['mute','modebtn','progress']){const el=$(id);if(el)new MutationObserver(sync).observe(el,{attributes:true,childList:true,subtree:true,characterData:true});}
 if(query.get('view')==='portfolio'||unlocked||reduced||location.hash==='#work'){show(unlocked||finished);if(location.hash==='#work')openWork(false);}
 scene.inert=!open;sync();
})();
