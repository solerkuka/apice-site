/* Ápice · modo imersivo 3D (prévia: abrir com /?3d). Fundo WebGL (montanha + poeira) + profundidade nos elementos. */
import * as THREE from '/vendor/three.module.min.js';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const mob=innerWidth<800;
document.body.classList.add('i3d');
const css=document.createElement('style');css.textContent=`
html{background:radial-gradient(90% 60% at 50% 78%,#4a443e 0%,#1b1a18 55%,#0F0E0D 100%) fixed}
body.i3d{background:transparent!important}
body.i3d #app{position:relative;z-index:1}
#gl{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
body.i3d .dkh,body.i3d .fold .hero.first{background:linear-gradient(180deg,rgba(15,14,13,.55),rgba(15,14,13,0))!important}
body.i3d .dkst,body.i3d .mq,body.i3d .dk,body.i3d .fold{background:transparent!important}
body.i3d #principios,body.i3d #quem,body.i3d .cta,body.i3d footer,body.i3d .qs{background:transparent!important}
body.i3d .divl{opacity:.4}
body.i3d .d3{will-change:transform;transform-style:preserve-3d}
body.i3d .r3,body.i3d .t3{transition:opacity 1.1s ease,transform .9s cubic-bezier(.2,.7,.2,1),box-shadow .25s;transform:perspective(900px) translate3d(0,var(--ty,0px),calc(var(--zr,0px) + var(--tz,0px))) rotateX(calc(var(--rr,0deg) + var(--rx,0deg))) rotateY(var(--ry,0deg))}
body.i3d .r3{opacity:0;--ty:70px;--zr:-160px;--rr:16deg}
body.i3d .r3.in{opacity:1;--ty:0px;--zr:0px;--rr:0deg}
body.i3d .t3{box-shadow:0 calc(14px + var(--tz,0px)) calc(30px + var(--tz,0px)) rgba(0,0,0,.45)}
body.i3d .t3:hover{--tz:26px;transition:opacity 1.1s ease,transform .25s ease-out,box-shadow .25s}
body.i3d .t3:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,248,235,.16),transparent 55%);opacity:0;transition:opacity .25s}
body.i3d .t3:hover:after{opacity:1}
body.i3d .sc,body.i3d .pr .rv,body.i3d .dkm a{position:relative}
body.i3d .dkm a{overflow:visible}
body.i3d .dkh .brand svg{filter:drop-shadow(0 18px 24px rgba(0,0,0,.55))}
body.i3d .dkl{transition:opacity 1.6s ease,transform 9s ease-out!important}
`;document.head.appendChild(css);

/* ---------- WebGL ---------- */
const cv=document.createElement('canvas');cv.id='gl';document.body.prepend(cv);
const rd=new THREE.WebGLRenderer({canvas:cv,antialias:!mob,alpha:true,powerPreference:'high-performance'});
rd.setPixelRatio(Math.min(devicePixelRatio,mob?1.5:2));rd.setClearColor(0x000000,0);
const sc=new THREE.Scene();sc.fog=new THREE.FogExp2(0x161513,.0068);
const cam=new THREE.PerspectiveCamera(58,1,.5,900);
sc.add(new THREE.AmbientLight(0xb09e8c,.8));
const sun=new THREE.DirectionalLight(0xffe2bd,2.4);sun.position.set(-60,90,40);sc.add(sun);
const rim=new THREE.DirectionalLight(0x95806D,.6);rim.position.set(80,30,-60);sc.add(rim);
/* terreno com pico central ("o ápice") */
function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function noise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return hash(xi,yi)*(1-u)*(1-v)+hash(xi+1,yi)*u*(1-v)+hash(xi,yi+1)*(1-u)*v+hash(xi+1,yi+1)*u*v}
function height(x,z){let h=0,a=1,f=.012;for(let i=0;i<5;i++){h+=(noise(x*f+7,z*f+3)*2-1)*a*34;a*=.5;f*=2.1}
 const d=Math.hypot(x-4,z+70);const peak=Math.max(0,1-d/150);h+=Math.pow(peak,1.55)*135;
 const ridge=Math.max(0,1-Math.abs(x)/260)*14;return h+ridge-8}
const seg=mob?90:150,size=720;
const g=new THREE.PlaneGeometry(size,size,seg,seg);g.rotateX(-Math.PI/2);
const pos=g.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,height(pos.getX(i),pos.getZ(i)))}
g.computeVertexNormals();
const terr=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x9a8876,flatShading:true,roughness:.95,metalness:0}));
terr.position.z=-90;sc.add(terr);
const wire=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xD3C7BA,wireframe:true,transparent:true,opacity:.035,depthWrite:false}));wire.position.copy(terr.position);wire.position.y=.15;sc.add(wire);
/* poeira / neblina flutuante */
const nP=mob?260:700,pp=new Float32Array(nP*3);
for(let i=0;i<nP;i++){pp[i*3]=(Math.random()-.5)*420;pp[i*3+1]=Math.random()*190;pp[i*3+2]=-Math.random()*340+90}
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
const dust=new THREE.Points(pg,new THREE.PointsMaterial({color:0xD3C7BA,size:mob?1.6:1.3,transparent:true,opacity:.55,depthWrite:false,sizeAttenuation:true}));sc.add(dust);
/* lua / sol distante */
const sunM=new THREE.Mesh(new THREE.CircleGeometry(16,48),new THREE.MeshBasicMaterial({color:0xE8D9C4,transparent:true,opacity:.9,fog:false}));sunM.position.set(-70,150,-420);sc.add(sunM);
const halo=new THREE.Mesh(new THREE.CircleGeometry(58,48),new THREE.MeshBasicMaterial({color:0xD3C7BA,transparent:true,opacity:.12,fog:false,depthWrite:false}));halo.position.set(-70,150,-421);sc.add(halo);

function size_(){rd.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
addEventListener('resize',size_);size_();

let mx=0,my=0,smx=0,smy=0,sp=0,spT=0;
addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
function prog(){const h=document.documentElement.scrollHeight-innerHeight;return h>0?Math.min(1,Math.max(0,scrollY/h)):0}
const look=new THREE.Vector3();
function frame(t){
 spT=prog();sp+=(spT-sp)*.07;smx+=(mx-smx)*.05;smy+=(my-smy)*.05;
 const e=sp*sp*(3-2*sp);
 /* câmera sobe a montanha conforme rola a página */
 cam.position.set(smx*14,16+e*118,150-e*150);
 look.set(4+smx*-10,26+e*86-smy*8,-70-e*30);cam.lookAt(look);
 cam.rotation.z=smx*-.03;
 if(!reduce){dust.rotation.y=t*.00004;const a=dust.geometry.attributes.position;for(let i=0;i<nP;i++){let y=a.getY(i)+.02+Math.sin(t*.0005+i)*.004;if(y>190)y=0;a.setY(i,y)}a.needsUpdate=true}
 sunM.position.y=150+e*30;halo.position.y=150+e*30;
 rd.render(sc,cam);
 /* altitude no HUD */
 const n=document.querySelector('.hud .n');if(n)n.style.setProperty('--alt',Math.round(e*3200));
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);

/* ---------- profundidade nos elementos ---------- */
const REV='.pr .rv,.qs .sc,.qs .vals div,.qh,.cta .rv,.lab,.dkm a,.arch';
const TILT='.sc,.pr .rv,.dkm a,.arch,.dkcta';
const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.15});
function scan(){
 document.querySelectorAll(REV).forEach((el,i)=>{if(el.dataset.r3)return;el.dataset.r3=1;if(el.closest('.dk,.fold')&&!el.matches('.arch')){/* dobra inicial: entra já */}
  el.classList.add('r3');el.style.transitionDelay=(i%5)*90+'ms';io.observe(el)});
 document.querySelectorAll(TILT).forEach(el=>{if(!el.classList.contains('t3'))el.classList.add('t3')});
 /* camadas com paralaxe do mouse na primeira dobra */
 const L=[['.dkh .brand',-26],['.dkm',-10],['.dkc',-34],['.dkn',-18],['.fold .brand',-24],['.fold .lvs',-8]];
 L.forEach(([s,d])=>{const el=document.querySelector(s);if(el&&!el.dataset.p3){el.dataset.p3=d;el.classList.add('d3')}});
}
new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,60)}).observe(document.getElementById('app'),{childList:true});
scan();
/* inclinação 3D com brilho seguindo o ponteiro */
document.addEventListener('pointermove',e=>{
 const el=e.target.closest&&e.target.closest('.t3');
 if(el){const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  el.style.setProperty('--ry',((x-.5)*14)+'deg');el.style.setProperty('--rx',((.5-y)*10)+'deg');el.style.setProperty('--gx',x*100+'%');el.style.setProperty('--gy',y*100+'%')}
},{passive:true});
document.addEventListener('pointerout',e=>{const el=e.target.closest&&e.target.closest('.t3');if(el&&!el.contains(e.relatedTarget)){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')}});
/* paralaxe do mouse + rolagem nas camadas */
function par(){
 document.querySelectorAll('[data-p3]').forEach(el=>{const d=+el.dataset.p3;
  el.style.transform=`translate3d(${smx*d*-1.6}px,${smy*d*-1.2 - sp*d*-40}px,0)`});
 document.querySelectorAll('.dkl').forEach(el=>{el.style.backgroundPosition=`${50+smx*-3}% ${50+smy*-3}%`});
 requestAnimationFrame(par)}
if(!reduce)requestAnimationFrame(par);
