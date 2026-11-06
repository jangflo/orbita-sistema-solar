import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { bodies } from './data.js';

const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected:null, paused:reducedMotion, speed:1, days:0, orbits:true, labels:true, top:false, ready:false, resumeOverview:false };
const objects = new Map();
let renderer, scene, camera, controls, orbitGroup, stars, animation, selectedPrevious = new THREE.Vector3();
let lastTime=0, transition=null, pointerDown=null, hovered=null, textureFailures=[], lastStageAspect=0, lastMobile=null;
const canvas=$('space'), stage=$('universe');
const projected=new THREE.Vector3(), raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const selectable=[];

// The DOM navigation also works independently of WebGL.
for (const [index,b] of bodies.entries()) {
  const button=document.createElement('button');
  button.className='destination';button.dataset.id=b.id;
  button.setAttribute('aria-label',`Explorar ${b.name}`);button.setAttribute('aria-pressed','false');
  button.style.setProperty('--texture',`url('./assets/${b.texture}.jpg')`);
  button.innerHTML=`<span class="destination-order">${String(index).padStart(2,'0')}</span><span class="thumb" aria-hidden="true"></span><span class="destination-name">${b.name}</span>`;
  button.addEventListener('click',()=>selectBody(b.id));$('destinations').append(button);
  const label=document.createElement('button');label.className='planet-label';label.dataset.id=b.id;
  label.style.setProperty('--planet-color',b.color);label.innerHTML=`${b.name}<span class="label-number">${index?String(index).padStart(2,'0'):'ESTRELLA'}</span>`;
  label.setAttribute('aria-label',`Acercarse a ${b.name}`);label.addEventListener('click',()=>selectBody(b.id));
  $('labels').append(label);
}

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').classList.remove('show'),3000)}

const guide=`<p>No necesitas una nave. Solo un poco de curiosidad.</p><div class="help-row"><span>Girar la vista</span><div>Arrastra sobre el espacio con el ratón o con un dedo.</div></div><div class="help-row"><span>Acercarte</span><div>Usa la rueda del ratón, el gesto de pinza o los botones <strong>+ y −</strong>.</div></div><div class="help-row"><span>Explorar</span><div>Selecciona un planeta en el espacio o en la barra inferior. Las flechas recorren los mundos en orden.</div></div><div class="help-row"><span>El tiempo</span><div>Al acercarte a un planeta, el tiempo se pausa para que lo examines. Puedes reanudarlo y cambiar su velocidad en la barra inferior. A 1×, cada segundo representa dos días terrestres.</div></div><p style="margin-top:22px"><kbd>Espacio</kbd> pausar · <kbd>Esc</kbd> vista general · <kbd>←</kbd> <kbd>→</kbd> cambiar de planeta · <kbd>H</kbd> ayuda</p>`;
const scaleText=`<p>El sistema solar es tan grande que, si respetáramos una única escala, los planetas serían casi invisibles.</p><p><strong>En la vista general</strong>, las distancias están comprimidas y los cuerpos ampliados para permitir la exploración. El orden de los ocho planetas se conserva. Las órbitas son elípticas, con excentricidades e inclinaciones aproximadas basadas en datos de NASA.</p><p><strong>Al acercarte</strong>, verás texturas cartográficas, el achatamiento de los gigantes, las inclinaciones axiales y los anillos de Saturno. La Tierra tiene nubes, luz nocturna y la Luna; los anillos tenues de los otros gigantes no se representan.</p><p>Los periodos orbitales y de rotación mantienen sus proporciones temporales. A velocidad alta pueden producirse efectos visuales de aliasing. Las posiciones iniciales son una composición didáctica, <strong>no una efeméride ni una vista en directo</strong>.</p><p>Las temperaturas son valores medios orientativos; en los gigantes se refieren a niveles atmosféricos, ya que no tienen una superficie sólida accesible. La perspectiva, la luz ambiental y el color se ajustan para facilitar la observación.</p>`;
const aboutText=`<p><strong>Un atlas para volver a asombrarse.</strong> Órbita es una experiencia interactiva para descubrir el Sol y los ocho planetas que lo acompañan.</p>${scaleText}<p><strong>Fuentes y créditos</strong><br>Datos de referencia: <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noopener noreferrer">NASA · Planetary Fact Sheet</a> y <a href="https://science.nasa.gov/solar-system/planets/" target="_blank" rel="noopener noreferrer">NASA Science</a>.<br>Texturas: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope / INOVE</a>, basadas en imágenes de NASA, bajo <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Algunas zonas se completan artísticamente y el color se realza. El azul de Neptuno está estilizado; su color natural es más pálido.<br>Motor 3D: <a href="https://threejs.org/" target="_blank" rel="noopener noreferrer">Three.js</a> · licencia MIT.</p><p class="dialog-footnote">Una representación educativa. Los modelos no sustituyen datos de navegación astronómica.</p>`;
function openDialog(title,content,eyebrow='BITÁCORA DE VUELO'){$('dialog-title').textContent=title;$('dialog-content').innerHTML=content;$('dialog-eyebrow').textContent=eyebrow;if(!$('info-dialog').open)$('info-dialog').showModal()}
$('help').onclick=()=>openDialog('Tu guía de vuelo',guide);
$('about').onclick=()=>openDialog('La curiosidad es el destino.',aboutText,'SOBRE ÓRBITA');
$('scale-info').onclick=()=>openDialog('Cómo mirar este universo',scaleText,'SOBRE LA ESCALA');
$('close-dialog').onclick=()=>$('info-dialog').close();
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('explore').onclick=()=>overview();$('overview').onclick=()=>overview();$('back').onclick=()=>overview();$('visit-earth').onclick=()=>selectBody('earth');
$('previous').onclick=()=>stepBody(-1);$('next').onclick=()=>stepBody(1);
$('reset').onclick=()=>{if(state.selected)selectBody(state.selected);else overview();toast('Vista restablecida')};
$('perspective').onclick=()=>setTop(false);$('top-view').onclick=()=>setTop(true);
$('toggle-orbits').onclick=()=>{state.orbits=!state.orbits;$('toggle-orbits').classList.toggle('active',state.orbits);$('toggle-orbits').setAttribute('aria-pressed',state.orbits);if(orbitGroup)orbitGroup.visible=state.orbits&&!state.selected};
$('toggle-labels').onclick=()=>{state.labels=!state.labels;$('toggle-labels').classList.toggle('active',state.labels);$('toggle-labels').setAttribute('aria-pressed',state.labels);$('labels').style.opacity=state.labels?'1':'0';$('labels').inert=!state.labels};
$('pause').onclick=()=>{state.paused=!state.paused;updatePause()};
function updatePause(){$('pause').setAttribute('aria-label',state.paused?'Reanudar simulación':'Pausar simulación');$('pause').setAttribute('aria-pressed',state.paused);$('pause-icon').innerHTML=state.paused?'<path d="m5 3 8 5-8 5Z" fill="currentColor" stroke="none"/>':'<path d="M5 3v10M11 3v10"/>'}
updatePause();
$('speed').onchange=()=>{state.speed=Number($('speed').value);$('time-display').textContent=`1 s = ${new Intl.NumberFormat('es').format(state.speed*2)} días`;toast(`Ritmo orbital: ${new Intl.NumberFormat('es').format(state.speed*2)} días por segundo`)};
$('zoom-in').onclick=()=>zoom(.78);$('zoom-out').onclick=()=>zoom(1.28);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Usa el modo de pantalla completa de tu navegador')}catch{toast('Usa el modo de pantalla completa de tu navegador')}};
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;if($('info-dialog').open)return;if(e.code==='Space'){if(e.target.closest('button,a'))return;e.preventDefault();$('pause').click()}else if(e.key==='Escape'){overview()}else if(e.key==='ArrowRight'){e.preventDefault();stepBody(1)}else if(e.key==='ArrowLeft'){e.preventDefault();stepBody(-1)}else if(e.key.toLowerCase()==='h')$('help').click()});

function stepBody(direction){const i=state.selected?bodies.findIndex(b=>b.id===state.selected):0;selectBody(bodies[(i+direction+bodies.length)%bodies.length].id)}
function updateDestination(){document.querySelectorAll('.destination').forEach(b=>{const selected=b.dataset.id===state.selected;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected)});$('overview').classList.toggle('selected',!state.selected);$('overview').setAttribute('aria-pressed',!state.selected)}
function updatePanel(b){$('planet-category').textContent=b.category;$('planet-name').textContent=b.name;$('planet-subtitle').textContent=b.subtitle;$('planet-description').textContent=b.description;$('planet-fact').textContent=b.fact;$('planet-source').href=b.url;$('planet-index').textContent=`${String(bodies.indexOf(b)).padStart(2,'0')} / 08`;
 const stats=[['Diámetro ecuatorial',b.diameter,'km'],[b.id==='sun'?'Tipo de estrella':'Distancia media al Sol',b.id==='sun'?'G2 V':b.distance,b.id==='sun'?'':'mill. km'],[b.id==='sun'?'Rotación ecuatorial':'Una vuelta al Sol',b.id==='sun'?'25,4':b.period,b.id==='sun'?'días':b.periodUnit],['Temperatura media',b.temperature,'°C']];
 $('planet-stats').innerHTML=stats.map(([label,value,unit])=>`<div><dt>${label}</dt><dd>${value}<small>${unit}</small></dd></div>`).join('');
}

function focusVector(b){const r=b.radius,view=state.top?new THREE.Vector3(.001,r*7.5,.01):b.id==='saturn'?new THREE.Vector3(r*1.4,r*5.8,r*8):new THREE.Vector3(r*1.35,r*1.4,r*6.8);if(stage.clientWidth<700)view.multiplyScalar(1.35);return view}
function selectBody(id){const b=bodies.find(b=>b.id===id);if(!b)return;if(!state.selected)state.resumeOverview=!state.paused;state.paused=true;updatePause();state.selected=id;updatePanel(b);$('planet-panel').hidden=false;document.body.classList.add('detail');$('hero').inert=true;$('invitation').inert=true;$('labels').inert=true;updateDestination();const destination=document.querySelector(`.destination[data-id="${id}"]`),row=$('destinations');row.scrollTo({left:destination.offsetLeft-row.offsetLeft-row.clientWidth/2+destination.clientWidth/2,behavior:reducedMotion?'instant':'smooth'});if(!renderer)return;
 orbitGroup.visible=false;resize();const o=objects.get(id);selectedPrevious.copy(o.root.position);
 const r=b.radius;startTransition(o.root.position,focusVector(b));controls.minDistance=r*1.4;controls.maxDistance=r*28;
 objects.forEach((obj,key)=>{obj.label.tabIndex=-1;obj.root.visible=key===id});
}
function overviewTarget(){return new THREE.Vector3(stage.clientWidth<1100?27:16,0,0)}
function overview(){if(state.selected&&state.resumeOverview){state.paused=false;updatePause()}state.selected=null;document.body.classList.remove('detail');$('planet-panel').hidden=true;$('hero').inert=false;$('invitation').inert=false;$('labels').inert=!state.labels;updateDestination();if(!renderer)return;objects.forEach(o=>{o.root.visible=true;o.label.tabIndex=0});orbitGroup.visible=state.orbits;controls.minDistance=25;controls.maxDistance=360;resize();startTransition(overviewTarget(),overviewVector());}
function overviewVector(){const aspect=stage.clientWidth/stage.clientHeight;const fit=Math.max(135,51/(Math.tan(THREE.MathUtils.degToRad(19))*aspect));return state.top?new THREE.Vector3(.001,fit*1.04,.01):new THREE.Vector3(0,fit*.58,fit*.815)}
function setTop(top){state.top=top;$('top-view').classList.toggle('chosen',top);$('perspective').classList.toggle('chosen',!top);$('top-view').setAttribute('aria-pressed',top);$('perspective').setAttribute('aria-pressed',!top);if(state.selected)selectBody(state.selected);else if(renderer)startTransition(overviewTarget(),overviewVector())}
function startTransition(target,offset){transition={start:performance.now(),duration:reducedMotion?0:1350,fromTarget:controls.target.clone(),fromPos:camera.position.clone(),toTarget:target.clone(),toOffset:offset.clone()};controls.enabled=false;}
function zoom(factor){if(!renderer)return;transition=null;controls.enabled=true;const v=camera.position.clone().sub(controls.target);v.setLength(THREE.MathUtils.clamp(v.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(v);controls.update()}

function setup(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0x080b0f,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.02,1800);camera.position.copy(overviewTarget().add(overviewVector()));
 controls=new OrbitControls(camera,canvas);controls.target.copy(overviewTarget());controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=25;controls.maxDistance=360;controls.maxPolarAngle=Math.PI*.93;controls.minPolarAngle=.015;controls.rotateSpeed=.55;controls.zoomSpeed=.7;
 controls.addEventListener('start',()=>{transition=null;controls.enabled=true});controls.update();
 scene.add(new THREE.AmbientLight(0xa7b9d5,.5));
 const solarLight=new THREE.PointLight(0xfff4df,1400,0,0);solarLight.position.set(0,0,0);scene.add(solarLight);
 // Constant illumination over illustrative distances; inverse-square falloff is intentionally disabled.
 solarLight.intensity=3.2;solarLight.decay=0;
 const fill=new THREE.DirectionalLight(0xb8d5ff,.55);fill.position.set(15,20,70);scene.add(fill);
 createStars();orbitGroup=new THREE.Group();scene.add(orbitGroup);
 const manager=new THREE.LoadingManager();manager.onProgress=(_,loaded,total)=>{$('loading-progress').style.width=`${loaded/total*100}%`};manager.onError=url=>textureFailures.push(url);
 manager.onLoad=()=>{state.ready=true;$('loading-progress').style.width='100%';$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,800);if(textureFailures.length)toast('Algunas texturas no pudieron cargarse. Recarga para volver a intentarlo.')};
 const loader=new THREE.TextureLoader(manager);const textures=new Map();
 function texture(name,srgb=true){const key=name+srgb;if(textures.has(key))return textures.get(key);const t=loader.load(`./assets/${name}`);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);textures.set(key,t);return t}
 const sphere=new THREE.SphereGeometry(1,80,48);
 for(const b of bodies){
  const root=new THREE.Group();scene.add(root);const axial=new THREE.Group();root.add(axial);axial.rotation.z=THREE.MathUtils.degToRad(b.tilt);
  const map=texture(`${b.texture}.jpg`);if(b.id==='neptune'){map.colorSpace=THREE.SRGBColorSpace;}
  let material;
  if(b.id==='sun')material=new THREE.MeshBasicMaterial({map,color:0xffddaa,toneMapped:false});
  else material=new THREE.MeshStandardMaterial({map,roughness:b.id==='earth'?.73:1,metalness:0});
  if(b.id==='neptune')material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat paleLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(paleLuma*0.9,paleLuma*1.12,paleLuma*1.18),0.77)*1.55;')};
  const mesh=new THREE.Mesh(sphere,material);mesh.scale.setScalar(b.radius);axial.add(mesh);mesh.userData.id=b.id;selectable.push(mesh);
  // Equatorial bulges of the giant planets, relative to their equatorial radii.
  const flatten={jupiter:.935,saturn:.902,uranus:.977,neptune:.983};if(flatten[b.id])mesh.scale.y*=flatten[b.id];
  mesh.rotation.y=b.id==='earth'?3.7:b.id==='jupiter'?2.4:.45;
  let cloud=null,moon=null;
  if(b.id==='earth'){
   const night=texture('earth_nightmap.jpg');
   material.onBeforeCompile=shader=>{shader.uniforms.nightMap={value:night};shader.uniforms.sunDirection={value:new THREE.Vector3()};material.userData.shader=shader;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorldNormal;\nvarying vec2 vNightUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);\nvNightUv=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D nightMap;\nuniform vec3 sunDirection;\nvarying vec3 vWorldNormal;\nvarying vec2 vNightUv;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat darkSide=1.0-smoothstep(-0.2,0.12,dot(normalize(vWorldNormal),normalize(sunDirection)));\ntotalEmissiveRadiance += texture2D(nightMap,vNightUv).rgb * darkSide * 1.3;')};
   cloud=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({alphaMap:texture('earth_clouds.jpg',false),color:0xffffff,transparent:true,opacity:.57,depthWrite:false,roughness:1}));cloud.scale.setScalar(b.radius*1.014);axial.add(cloud);
   addAtmosphere(root,b.radius,0x6aafff,.32);
   const moonOrbit=new THREE.Group();root.add(moonOrbit);moonOrbit.rotation.z=THREE.MathUtils.degToRad(5.1);moon=new THREE.Mesh(new THREE.SphereGeometry(.273,40,28),new THREE.MeshStandardMaterial({map:texture('moon.jpg'),roughness:1}));moonOrbit.add(moon);moon.position.set(3.2,0,0);
  }else if(b.id==='venus')addAtmosphere(root,b.radius,0xe6c68d,.14);
  else if(b.id==='mars')addAtmosphere(root,b.radius,0xdba37e,.12);
  else if(b.id==='uranus')addAtmosphere(root,b.radius,0x9fdada,.12);
  else if(b.id==='neptune')addAtmosphere(root,b.radius,0x7ea9d7,.14);
  if(b.id==='saturn'){
   const inner=b.radius*1.24,outer=b.radius*2.28;const geo=new THREE.RingGeometry(inner,outer,180,1);const positions=geo.attributes.position,uv=geo.attributes.uv;
   for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i);uv.setXY(i,(Math.hypot(x,y)-inner)/(outer-inner),.5)}
   const ring=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:texture('saturn_ring.png'),side:THREE.DoubleSide,transparent:true,alphaTest:.05,roughness:1,depthWrite:false}));ring.rotation.x=-Math.PI/2;axial.add(ring);ring.userData.id=b.id;selectable.push(ring);
  }
  if(b.id==='sun')createGlow(root,b.radius);
  if(b.orbit){createOrbit(b);root.position.copy(orbitalPosition(b,0))}
  const label=document.querySelector(`.planet-label[data-id="${b.id}"]`);
  objects.set(b.id,{root,axial,mesh,material,cloud,moon,label,b});
 }
 createAsteroids();resize();window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);
 canvas.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};canvas.style.cursor='grabbing'});
 canvas.addEventListener('pointerup',e=>{canvas.style.cursor=hovered?'pointer':'grab';if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<6&&state.ready){const hit=pick(e);if(hit)selectBody(hit.object.userData.id)}pointerDown=null});
 canvas.addEventListener('pointermove',e=>{if(pointerDown||!state.ready||transition)return;const hit=pick(e);hovered=hit?hit.object.userData.id:null;canvas.style.cursor=hovered?'pointer':'grab'});
 canvas.addEventListener('pointercancel',()=>{pointerDown=null;canvas.style.cursor='grab'});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.paused=true;updatePause();toast('Se interrumpió la conexión gráfica. Recarga para volver a explorar.')});
 lastTime=performance.now();animation=requestAnimationFrame(frame);
}

function orbitalPosition(b,days){let mean=b.phase-b.e*Math.sin(b.phase)+days/b.days*Math.PI*2;mean%=Math.PI*2;let E=mean;for(let j=0;j<6;j++)E-=(E-b.e*Math.sin(E)-mean)/(1-b.e*Math.cos(E));const z=b.orbit*Math.sqrt(1-b.e*b.e)*Math.sin(E);return new THREE.Vector3(b.orbit*(Math.cos(E)-b.e),z*Math.sin(THREE.MathUtils.degToRad(b.inclination)),-z*Math.cos(THREE.MathUtils.degToRad(b.inclination)))}
function createOrbit(b){const points=[];for(let i=0;i<=256;i++){const E=i/256*Math.PI*2,z=b.orbit*Math.sqrt(1-b.e*b.e)*Math.sin(E);points.push(new THREE.Vector3(b.orbit*(Math.cos(E)-b.e),z*Math.sin(THREE.MathUtils.degToRad(b.inclination)),-z*Math.cos(THREE.MathUtils.degToRad(b.inclination))))}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8598b4,transparent:true,opacity:.135}));orbitGroup.add(line)}
function addAtmosphere(root,radius,color,strength){const mat=new THREE.ShaderMaterial({uniforms:{glowColor:{value:new THREE.Color(color)},strength:{value:strength}},vertexShader:'varying vec3 vNormal;varying vec3 vPosition;void main(){vNormal=normalize(normalMatrix*normal);vec4 mvPosition=modelViewMatrix*vec4(position,1.0);vPosition=mvPosition.xyz;gl_Position=projectionMatrix*mvPosition;}',fragmentShader:'uniform vec3 glowColor;uniform float strength;varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=1.0-abs(dot(normalize(vNormal),normalize(-vPosition)));float a=pow(rim,4.5)*strength;gl_FragColor=vec4(glowColor,a);}',side:THREE.FrontSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.045,64,40),mat);root.add(atmosphere)}
function createGlow(root,radius){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,190,84,.7)');g.addColorStop(.22,'rgba(255,169,50,.35)');g.addColorStop(.4,'rgba(247,116,36,.11)');g.addColorStop(.7,'rgba(207,74,30,.025)');g.addColorStop(1,'rgba(159,60,20,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,toneMapped:false}));glow.scale.set(radius*6.7,radius*6.7,1);root.add(glow)}
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function createStars(){const random=seeded(1073),count=2500,pos=new Float32Array(count*3),colors=new Float32Array(count*3);for(let i=0;i<count;i++){const theta=random()*Math.PI*2,phi=Math.acos(2*random()-1),r=500+random()*350;pos[i*3]=r*Math.sin(phi)*Math.cos(theta);pos[i*3+1]=r*Math.cos(phi);pos[i*3+2]=r*Math.sin(phi)*Math.sin(theta);const brightness=.18+Math.pow(random(),4)*.6;colors[i*3]=brightness*.84;colors[i*3+1]=brightness*.89;colors[i*3+2]=brightness;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));stars=new THREE.Points(geo,new THREE.PointsMaterial({size:.7,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));scene.add(stars)}
function createAsteroids(){const random=seeded(121),count=2000,pos=new Float32Array(count*3);for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=29+random()*3.3;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=(random()-.5)*.9;pos[i*3+2]=Math.sin(a)*r;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));orbitGroup.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xb9a48b,size:.075,transparent:true,opacity:.23,depthWrite:false})))}

function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight,mobile=w<700;renderer.setSize(w,h,false);camera.aspect=w/h;if(state.selected){camera.setViewOffset(w,h,mobile?0:-w*.14,mobile?-h*.025:0,w,h);if(lastMobile!==null&&mobile!==lastMobile)startTransition(objects.get(state.selected).root.position,focusVector(objects.get(state.selected).b))}else{camera.setViewOffset(w,h,0,-h*.085,w,h);if(lastStageAspect&&Math.abs(lastStageAspect-camera.aspect)>.2)startTransition(overviewTarget(),overviewVector())}lastStageAspect=camera.aspect;lastMobile=mobile;camera.updateProjectionMatrix()}
function pick(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(selectable).find(hit=>hit.object.visible&&objects.get(hit.object.userData.id).root.visible)}
function frame(now){animation=requestAnimationFrame(frame);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(document.hidden)return;
 if(!state.paused&&state.ready){const d=dt*2*state.speed;state.days+=d;objects.forEach(o=>{if(o.b.orbit)o.root.position.copy(orbitalPosition(o.b,state.days));o.mesh.rotation.y+=d*24/o.b.rotation*Math.PI*2;if(o.cloud)o.cloud.rotation.y+=d*24/o.b.rotation*Math.PI*2*1.03;if(o.moon){const a=state.days/27.3217*Math.PI*2;o.moon.position.set(Math.cos(a)*3.2,0,-Math.sin(a)*3.2);o.moon.rotation.y=a}})}
 if(state.selected){const o=objects.get(state.selected),delta=o.root.position.clone().sub(selectedPrevious);if(!transition){camera.position.add(delta);controls.target.add(delta)}selectedPrevious.copy(o.root.position);const shader=objects.get('earth').material.userData.shader;if(shader)shader.uniforms.sunDirection.value.copy(objects.get('earth').root.position).negate();}
 else {const shader=objects.get('earth').material.userData.shader;if(shader)shader.uniforms.sunDirection.value.copy(objects.get('earth').root.position).negate()}
 if(transition){const t=transition.duration?Math.min((now-transition.start)/transition.duration,1):1,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;const target=state.selected?objects.get(state.selected).root.position:transition.toTarget;controls.target.lerpVectors(transition.fromTarget,target,e);const desired=target.clone().add(transition.toOffset);camera.position.lerpVectors(transition.fromPos,desired,e);if(t>=1){transition=null;controls.enabled=true}}
 controls.update();camera.updateMatrixWorld();
 if(!state.selected){const w=stage.clientWidth,h=stage.clientHeight,camDir=new THREE.Vector3();camera.getWorldDirection(camDir);for(const o of objects.values()){projected.copy(o.root.position);const distance=projected.distanceTo(camera.position);projected.project(camera);const screenX=(projected.x*.5+.5)*w,screenY=(-projected.y*.5+.5)*h;const pixR=o.b.radius/(distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*h/2;const show=projected.z<1&&screenX>10&&screenX<w-10&&screenY>5&&screenY<h-40;o.label.style.left=`${screenX}px`;o.label.style.top=`${screenY+pixR+5}px`;o.label.style.opacity=show?'1':'0';o.label.style.pointerEvents=show&&state.labels?'auto':'none';o.label.tabIndex=show&&state.labels?0:-1;}}
 renderer.render(scene,camera);
}

try { setup() } catch(error){console.error('Unable to initialize the 3D explorer:',error);renderer=null;$('loading').hidden=true;$('webgl-error').hidden=false;$('dismiss-error').onclick=()=>{$('webgl-error').hidden=true;selectBody('earth')};}
window.addEventListener('pagehide',()=>{if(animation)cancelAnimationFrame(animation)});
window.addEventListener('pageshow',e=>{if(e.persisted&&renderer){lastTime=performance.now();animation=requestAnimationFrame(frame)}});
