(()=>{
const $=id=>document.getElementById(id);
if(location.search.includes('clean'))document.body.classList.add('clean');
if(innerWidth>900)$('panel').classList.add('open');
$('gear').onclick=()=>{const p=$('panel');innerWidth>900?p.classList.toggle('hide'):p.classList.toggle('open')};

/* ---------- utilidades ---------- */
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rng=mulberry(7);const R=(a,b)=>a+rng()*(b-a);const pick=a=>a[rng()*a.length|0];
function segClosest(ax,az,bx,bz,px,pz){const dx=bx-ax,dz=bz-az;let t=((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz);t=Math.max(0,Math.min(1,t));const x=ax+dx*t,z=az+dz*t;return{d:Math.hypot(px-x,pz-z),x,z}}

/* ---------- cena ---------- */
const stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
stage.insertBefore(renderer.domElement,stage.firstChild);
let pr=Math.min(2,Math.max(1,devicePixelRatio));
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b9bbd);scene.fog=new THREE.FogExp2(0x1b9bbd,0.017);
const cam=new THREE.PerspectiveCamera(58,9/16,.1,220);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setPixelRatio(pr);renderer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight(0xcff6ff,0x2b6a7a,1.0));
const sun=new THREE.DirectionalLight(0xffffff,.8);sun.position.set(20,40,10);scene.add(sun);
const M=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0x000000});

/* mapa de ruas */
const nodes=[[-24,-24],[0,-24],[24,-24],[24,0],[24,24],[0,24],[-24,24],[-24,0],[-8,-8],[0,-8],[8,-8],[8,0],[8,8],[0,8],[-8,8],[-8,0]];
const edges=[];for(let i=0;i<8;i++){edges.push([i,(i+1)%8]);edges.push([8+i,8+(i+1)%8])}
[[1,9],[3,11],[5,13],[7,15]].forEach(e=>edges.push(e));
const adj=nodes.map(()=>[]);edges.forEach(([a,b])=>{adj[a].push(b);adj[b].push(a)});
const nearRoad=(x,z)=>{let best={d:99};edges.forEach(([a,b])=>{const s=segClosest(nodes[a][0],nodes[a][1],nodes[b][0],nodes[b][1],x,z);if(s.d<best.d)best=s});return best};

/* chão e ruas */
const floor=new THREE.Mesh(new THREE.PlaneGeometry(260,260),M(0xd9bf85));floor.rotation.x=-Math.PI/2;scene.add(floor);
edges.forEach(([a,b])=>{const [ax,az]=nodes[a],[bx,bz]=nodes[b];const L=Math.hypot(bx-ax,bz-az)+4;
 const m=new THREE.Mesh(new THREE.BoxGeometry(ax===bx?4:L,.08,ax===bx?L:4),M(0xf0e2b4));m.position.set((ax+bx)/2,.04,(az+bz)/2);scene.add(m)});

/* praça central */
const plaza=new THREE.Group();
const base=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.6,.5,24),M(0xcfd8dc));base.position.y=.25;plaza.add(base);
const pool=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.6,24),M(0x4fd1f0,0x0b4a66));pool.position.y=.32;plaza.add(pool);
const col=new THREE.Mesh(new THREE.CylinderGeometry(.45,.7,3.2,12),M(0xffd166));col.position.y=2;plaza.add(col);
const orb=new THREE.Mesh(new THREE.SphereGeometry(.9,16,12),M(0xff6fa5,0x551133));orb.position.y=4;plaza.add(orb);
scene.add(plaza);

/* casas */
const pal=[0xff8fab,0xffd166,0x9be564,0x8ecae6,0xc77dff,0xff9f68,0x6fe3c1];
const placed=[[0,0,5],[16,-16,6.5],[-16,16,6.5]];
function sign(txt,col){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,512,128);g.fillStyle='#fff';g.font='bold 62px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,256,66);return new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}))}
function addWindows(g,r,y){[-1,1].forEach(s=>{const w=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),M(0xbff4ff,0x4fa6c0));w.scale.z=.3;w.position.set(s*r*.5,y,r*.98);g.add(w)})}
function house(x,z){const g=new THREE.Group();const c=pick(pal),t=rng()*3|0,h=R(2.6,4.6),r=R(1.7,2.6);
 if(t===0){const d=new THREE.Mesh(new THREE.SphereGeometry(r*1.3,16,10,0,6.283,0,1.571),M(c));g.add(d)}
 else if(t===1){const b=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,14),M(c));b.position.y=h/2;g.add(b);const k=new THREE.Mesh(new THREE.ConeGeometry(r*1.2,1.8,14),M(pick(pal)));k.position.y=h+.9;g.add(k)}
 else{const b=new THREE.Mesh(new THREE.BoxGeometry(r*2,h,r*2),M(c));b.position.y=h/2;g.add(b);const k=new THREE.Mesh(new THREE.ConeGeometry(r*1.6,1.6,4),M(pick(pal)));k.rotation.y=Math.PI/4;k.position.y=h+.8;g.add(k)}
 addWindows(g,r,t===0?1.6:h*.65);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.8,1.3,.2),M(0x7a4a2a));door.position.set(0,.65,r*1.02);g.add(door);
 const n=nearRoad(x,z);g.rotation.y=Math.atan2(n.x-x,n.z-z);g.position.set(x,0,z);scene.add(g)}
function shop(x,z,ry,label,col){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(7,3.4,5),M(col));b.position.y=1.7;g.add(b);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(7.6,.5,5.6),M(0xffffff));roof.position.y=3.6;g.add(roof);
 const s=sign(label,'#d1495b');s.position.set(0,2.6,2.55);g.add(s);
 const door=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,.2),M(0x7a4a2a));door.position.set(0,.9,2.52);g.add(door);
 [-2.3,2.3].forEach(wx=>{const w=new THREE.Mesh(new THREE.BoxGeometry(1.3,1,.2),M(0xbff4ff,0x4fa6c0));w.position.set(wx,1.3,2.52);g.add(w)});
 g.rotation.y=ry;g.position.set(x,0,z);scene.add(g)}
shop(16,-16,0,'RESTAURANTE CONCHA','#e07a1f');shop(-16,16,Math.PI,'LOJA DE BOLHAS','#2a9d8f');
/* regiões e pontos de interesse */
const pois=[[16,-16],[-16,16],[0,0]];
function regionAt(x,z){if(Math.hypot(x,z)<11)return 'Praça Central';if(x<0&&z<0)return 'Bairro dos Corais';if(x>=0&&z<0)return 'Rua do Restaurante';if(x<0)return 'Bairro das Lojas';return 'Bairro das Algas'}
function shopsNear(p){return pois.some(q=>Math.hypot(q[0]-p.x,q[1]-p.z)<10)}
let regT=0;function showRegion(n){const e=document.getElementById('region');e.textContent=n;e.classList.add('on');clearTimeout(regT);regT=setTimeout(()=>e.classList.remove('on'),2800)}
/* farol */
const lh=new THREE.Group();[0,1,2,3].forEach(i=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(1.6-i*.15,1.75-i*.15,2.2,14),M(i%2?0xffffff:0xe63946));c.position.y=1.1+i*2.2;lh.add(c)});
const lamp=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,10),M(0xffe066,0xffcc33));lamp.position.y=9.6;lh.add(lamp);
const lcap=new THREE.Mesh(new THREE.ConeGeometry(1.5,1.3,12),M(0xe63946));lcap.position.y=11;lh.add(lcap);
lh.position.set(-33,0,-33);scene.add(lh);placed.push([-33,-33,5]);
/* placa de boas-vindas */
const bz=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(1.7,.5,10,24),M(0xff8c1a));ring.position.y=2.4;bz.add(ring);
const post=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,2.2,8),M(0x7a4a2a));post.position.set(2.8,1.1,0);bz.add(post);
const bs=sign('BEM-VINDOS','#1d6fa5');bs.scale.set(.5,.5,.5);bs.position.set(0,2.4,.55);bz.add(bs);bz.position.set(-5,0,-29);scene.add(bz);placed.push([-5,-29,4]);
/* raios de luz */
for(let i=0;i<9;i++){const r=new THREE.Mesh(new THREE.ConeGeometry(R(3,6),60,10,1,true),new THREE.MeshBasicMaterial({color:0xcff6ff,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}));r.position.set(R(-40,40),28,R(-40,40));r.rotation.z=.18;scene.add(r)}
for(let i=0;i<900&&placed.length<52;i++){const x=R(-38,38),z=R(-38,38);if(nearRoad(x,z).d<5.4)continue;if(placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<(p[2]||5)+2.5))continue;placed.push([x,z,5]);house(x,z)}

/* corais, algas, rochas, montanhas */
for(let i=0;i<500&&i<500;i++){if(i>=80)break;const x=R(-46,46),z=R(-46,46);if(nearRoad(x,z).d<3.4||placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<(p[2]||5)+.3))continue;
 const g=new THREE.Group(),c=pick([0xff5d8f,0xff9f1c,0xb388eb,0x80ed99,0xff6b6b]);
 for(let k=0;k<4;k++){const h=R(.7,1.8);const b=new THREE.Mesh(new THREE.CylinderGeometry(.08,.2,h,6),M(c));b.position.set(R(-.5,.5),h/2,R(-.5,.5));b.rotation.z=R(-.4,.4);g.add(b);const tip=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),M(c,0x220011));tip.position.set(b.position.x+Math.sin(-b.rotation.z)*h/2,h,b.position.z);g.add(tip)}
 g.position.set(x,0,z);scene.add(g)}
const kelp=[];
for(let i=0;i<70;i++){const x=R(-50,50),z=R(-50,50);if(nearRoad(x,z).d<3.2||placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<(p[2]||5)))continue;const h=R(2.5,6);
 const k=new THREE.Mesh(new THREE.BoxGeometry(.25,h,.08),M(0x2fb86b,0x0a3a1a));k.geometry.translate(0,h/2,0);k.position.set(x,0,z);k.userData.p=rng()*6;scene.add(k);kelp.push(k)}
for(let i=0;i<30;i++){const a=rng()*6.283,d=R(44,56);const r=new THREE.Mesh(new THREE.DodecahedronGeometry(R(1.5,6.5)),M(0x7d8fa0));r.position.set(Math.cos(a)*d,.8,Math.sin(a)*d);r.rotation.set(rng()*3,rng()*3,0);scene.add(r)}
for(let i=0;i<22;i++){const a=i/22*6.283,d=R(66,80);const h=R(25,50);const m=new THREE.Mesh(new THREE.ConeGeometry(R(12,20),h,7),M(0x4a6f8a));m.position.set(Math.cos(a)*d,h/2-2,Math.sin(a)*d);scene.add(m)}

/* bolhas */
const NB=260,bp=new Float32Array(NB*3);for(let i=0;i<NB;i++){bp[i*3]=R(-50,50);bp[i*3+1]=R(0,25);bp[i*3+2]=R(-50,50)}
const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bp,3));
scene.add(new THREE.Points(bg,new THREE.PointsMaterial({color:0xffffff,size:.45,transparent:true,opacity:.55,depthWrite:false})));

/* peixes */
const fish=[];
for(let i=0;i<16;i++){const g=new THREE.Group(),c=pick([0xff9f1c,0xff5d8f,0xffe66d,0x9be564,0xc77dff]);
 const b=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),M(c));b.scale.set(1.5,.8,.5);g.add(b);
 const t=new THREE.Mesh(new THREE.ConeGeometry(.35,.6,4),M(c));t.rotation.z=Math.PI/2;t.position.x=-.85;g.add(t);
 g.userData={r:R(12,48),s:R(.08,.2)*(rng()<.5?-1:1),y:R(2,9),a:rng()*6.283,w:rng()*6};scene.add(g);fish.push(g)}

/* confete */
const NC=320,cp=new Float32Array(NC*3).fill(-100),cc=new Float32Array(NC*3),cv=[],cl=new Float32Array(NC);
for(let i=0;i<NC;i++)cv.push(new THREE.Vector3());
const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.BufferAttribute(cp,3));cg.setAttribute('color',new THREE.BufferAttribute(cc,3));
const confetti=new THREE.Points(cg,new THREE.PointsMaterial({size:.35,vertexColors:true}));confetti.frustumCulled=false;scene.add(confetti);
let cn=0;const cols=[[1,.35,.55],[1,.8,.2],[.4,.9,.6],[.5,.7,1],[.8,.5,1]];
function burst(n){const o=char.position;for(let k=0;k<n;k++){const i=cn++%NC;cp[i*3]=o.x+R(-1,1);cp[i*3+1]=o.y+3;cp[i*3+2]=o.z+R(-1,1);cv[i].set(R(-4,4),R(4,10),R(-4,4));cl[i]=R(1.5,3);const c=pick(cols);cc.set(c,i*3)}cg.attributes.color.needsUpdate=true}

/* ---------- personagem original: Espongito ---------- */
const char=new THREE.Group(),body=new THREE.Group();char.add(body);scene.add(char);
const skin=0xffe135,spots=0xd9b514;
const torso=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.5,.85),M(skin));torso.position.y=1.5;body.add(torso);
for(let i=0;i<6;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(R(.08,.16),6,5),M(spots));s.scale.z=.3;s.position.set(R(-.55,.55),R(1.1,2.1),.43);body.add(s)}
const tuft=new THREE.Mesh(new THREE.ConeGeometry(.2,.5,6),M(0xff6fa5));tuft.position.set(0,2.5,0);body.add(tuft);
const shirt=new THREE.Mesh(new THREE.BoxGeometry(1.44,.42,.88),M(0x7b4a1e));shirt.position.y=.88;body.add(shirt);
const eyes=new THREE.Group();eyes.position.set(0,1.82,.43);body.add(eyes);
[-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),M(0xffffff));e.position.set(s*.34,0,.05);eyes.add(e);
 const p=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),M(0x000000));p.position.set(s*.34,0,.3);eyes.add(p);
 const ch=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),M(0xff8fab));ch.scale.z=.3;ch.position.set(s*.55,-.55,-.05);eyes.add(ch)});
const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),M(0x7a1f2b));mouth.scale.set(.32,.1,.06);mouth.position.set(0,1.2,.44);body.add(mouth);
function limb(x,y,len,col,hand){const p=new THREE.Group();p.position.set(x,y,0);const m=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,len,6),M(col));m.position.y=-len/2;p.add(m);
 const h=new THREE.Mesh(hand?new THREE.SphereGeometry(.15,8,6):new THREE.BoxGeometry(.3,.15,.45),M(hand?skin:0x000000));h.position.set(0,-len,hand?0:.1);p.add(h);body.add(p);return p}
const legL=limb(-.35,.75,.7,0xf2e8cf),legR=limb(.35,.75,.7,0xf2e8cf),armL=limb(-.8,1.95,.75,skin,1),armR=limb(.8,1.95,.75,skin,1);
char.scale.setScalar(1.25);

/* poses */
function pose(type,t,d){const s=Math.sin;
 const P={ll:0,lr:0,alx:0,alz:-.15,arx:0,arz:.15,by:s(t*2)*.02,ry:0};
 if(type==='walk'){const w=s(t*9);P.ll=w*.7;P.lr=-w*.7;P.alx=-w*.6;P.arx=w*.6;P.by=Math.abs(w)*.1}
 else if(type==='wave'){P.arz=2.6+s(t*12)*.3;P.ry=-.2}
 else if(type==='run'){const w=s(t*13);P.ll=w;P.lr=-w;P.alx=-w*.9;P.arx=w*.9;P.alz=-.3;P.arz=.3;P.by=Math.abs(w)*.18}
 else if(type==='celebrate'){const w=s(t*10);P.by=Math.abs(w)*.5;P.arz=2.2+w*.4;P.alz=-(2.2-w*.4);P.ll=w*.4;P.lr=-w*.4;P.ry=s(t*5)*.8}
 else if(type==='look'){P.ry=s(t*2.2)*.9}
 else if(type==='dance'){const w=s(t*8);P.ll=w*.5;P.lr=-w*.5;P.arz=1.6+w*.8;P.alz=-(1.6-w*.8);P.by=Math.abs(w)*.3;P.ry=s(t*4)*.6}
 else if(type==='jump'){const u=Math.min(1,t/d);P.by=s(u*Math.PI)*1.6;P.arz=2.4;P.alz=-2.4;P.ll=-.5;P.lr=-.5}
 else if(type==='wow'){P.by=Math.abs(s(t*9))*.45;P.arz=2.5+s(t*14)*.2;P.alz=-2.5-s(t*14)*.2;P.ry=s(t*6)*.3}
 else if(type==='talk'){P.alx=s(t*3)*.3-.2;P.arx=s(t*3+2)*.3-.2;P.by=s(t*6)*.03;P.ry=s(t*1.5)*.15}
 return P}
const cur={ll:0,lr:0,alx:0,alz:0,arx:0,arz:0,by:0,ry:0};

/* ---------- estado do jogo ---------- */
let running=false,node=0,target=1,prev=-1,action=null,reaction=null,speaking=false,speechDone=true,busy=false,t0=0,animT=0,speedF=1,runMode=false,camMode='follow',camT=0,camLook=new THREE.Vector3(),region='',orbA=0,talkYaw=0,prevTalk=false,mouthKick=0;
char.position.set(nodes[0][0],0,nodes[0][1]);char.rotation.y=Math.PI/2;
function nextNode(){const opts=adj[target].filter(n=>n!==node);const from=target;node=from;target=opts.length?pick(opts):node}
const cc2=new THREE.Vector3();

/* ---------- fila de falas, voz, bolha ---------- */
const queue=[];let bubTimer=0;
const bub=$('bubble');
function showBubble(u,t){bub.innerHTML='<small></small><span></span>';bub.firstChild.textContent=u;bub.lastChild.textContent=t;bub.classList.add('on');clearTimeout(bubTimer)}
function hideBubble(){bubTimer=setTimeout(()=>bub.classList.remove('on'),1200)}
let voices=[];function loadVoices(){voices=(speechSynthesis.getVoices?speechSynthesis.getVoices():[]).filter(v=>/^pt/i.test(v.lang));
 const sel=$('voiceSel');sel.innerHTML='';voices.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v.name+' ('+v.lang+')';sel.appendChild(o)});
 const br=voices.findIndex(v=>/pt-BR/i.test(v.lang));if(br>=0)sel.value=br;if(!voices.length)sel.innerHTML='<option>Nenhuma voz pt-BR encontrada</option>'}
if('speechSynthesis' in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices}
function speakText(text,done){
 const fin=(()=>{let f=false;return()=>{if(!f){f=true;done()}}})();
 if($('voiceOn').checked&&'speechSynthesis' in window&&parseFloat($('vol').value)>0){
  const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';const v=voices[$('voiceSel').value];if(v)u.voice=v;
  u.volume=parseFloat($('vol').value);u.pitch=parseFloat($('pitch').value);u.rate=parseFloat($('rate').value);
  u.onend=fin;u.onerror=fin;u.onboundary=()=>{mouthKick=1};setTimeout(fin,text.length*120+4000);speechSynthesis.speak(u)
 }else setTimeout(fin,Math.max(2200,text.length*70))}
function enqueue(item){
 if(item.kind==='chat'){if(queue.length>=6)return;queue.push(item)}
 else{let i=queue.findIndex(q=>q.kind==='chat');if(i<0)i=queue.length;queue.splice(i,0,item)}}
function pump(){
 if(!running||busy||!queue.length)return;
 const it=queue.shift();busy=true;speaking=true;speechDone=false;animT=0;
 showBubble(it.user||'',it.text);
 if(it.react){reaction={type:it.react,t:0,dur:it.dur||3};if(it.confetti)burst(it.confetti)}
 speakText(it.text,()=>{speaking=false;speechDone=true})}

/* ---------- respostas do chat (modo grátis, sem IA externa) ---------- */
const bad=['porra','caralho','merda','puta','fdp','viado','otario','otário','idiota','burro','cu ','buceta','vsf','vtnc'];
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const rules=[
 [/\b(oi|ola|opa|eae|e ai|salve|bom dia|boa tarde|boa noite|fala)\b/,['Olá, {n}! Que alegria te ver por aqui!','Oi, {n}! Seja muito bem-vindo ao Recife das Bolhas!','Opa, {n}! Tudo bem? Estou passeando pela cidade!']],
 [/(como (voce )?(esta|ta|vai)|tudo bem|td bem)/,['Estou muito bem, {n}! Hoje estou passeando pelo Recife das Bolhas. E você, como está?','Tudo ótimo, {n}! Cheio de energia! E com você?']],
 [/(abraco|abraço|abracinho)/,['Um abraço bem grande para você, {n}! Você é demais!','Vem cá, {n}! Abraço apertado de esponja!']],
 [/(patrick|estrela)/,['Boa pergunta, {n}! Conhecendo ele, deve estar dormindo debaixo de uma pedra!','Não vi por aí, {n}! Mas aposto que está atrás de um lanche!']],
 [/(quem (e|eh) (voce|vc)|seu nome|qual.*nome)/,['Eu sou o Espongito, {n}! O morador mais animado do Recife das Bolhas!','Meu nome é Espongito, {n}! Muito prazer!']],
 [/(te amo|amo voce|amo vc|fofo|lindo|legal|top|brabo)/,['Aaaah, {n}, que carinho! Você também é demais!','Obrigado, {n}! Você me deixou todo feliz!']],
 [/(tchau|ate mais|flw|fui)/,['Tchau, {n}! Volte sempre!','Até mais, {n}! Foi ótimo te ver!']],
 [/(dan[cç]a|dança)/,['Pode deixar, {n}! Olha esse passinho!','Bora dançar, {n}! Música na bolha!']],
 [/(fome|comer|lanche|restaurante)/,['Fome, {n}? Passa no Restaurante Concha, o melhor da cidade!','Hmm, {n}, deu até vontade de um lanchinho!']],
 [/(pula|pular)/,['Lá vai, {n}! Pulo de esponja!']]];
const generic=['Que legal, {n}! Conta mais!','Olha só, {n}! Adorei seu comentário!','Valeu por falar comigo, {n}! Você é demais!','Hum, {n}, que interessante! Estou aqui passeando e curtindo a live!'];
const lastIdx={};
function variant(key,arr){let i=rng()*arr.length|0;if(arr.length>1&&i===lastIdx[key])i=(i+1)%arr.length;lastIdx[key]=i;return arr[i]}
function answer(user,text){
 const t=norm(text);
 for(const [re,arr] of rules)if(re.test(t)){const out=variant(re.source,arr).replace('{n}',user);
  const react=/dan[cç]a/.test(t)?'dance':/pul/.test(t)?'jump':/abra|oi|ola|opa|tchau/.test(t)?'wave':null;return{text:out,react}}
 return{text:variant('g',generic).replace('{n}',user)}}
let lastReply=0;
function comentario(user,text){
 user=(user||'amigo').toString().slice(0,24);text=(text||'').toString().slice(0,200);
 const t=norm(text);
 if(bad.some(b=>t.includes(b))){log('🚫 bloqueado: '+user+': '+text);return}
 log('💬 '+user+': '+text);
 if(!$('auto').checked)return;
 if(Date.now()-lastReply<2500)return;lastReply=Date.now();
 const a=answer(user,text);enqueue({kind:'chat',user,text:a.text,react:a.react,dur:2.5})}

/* ---------- presentes e eventos ---------- */
function presente(user,gift,qty,value){
 user=(user||'amigo').toString().slice(0,24);qty=Math.max(1,qty|0);value=+value||1;const total=value*qty;
 log('🎁 '+user+' enviou '+qty+'x '+gift+' ('+total+' moedas)');
 const G=gift.toUpperCase();let text,react,conf,dur;
 if(qty>=10){text='UAU! CHUVA DE PRESENTES! '+user+', VOCÊ MANDOU '+qty+' '+G+'! MUITO OBRIGADO! VOCÊ É INCRÍVEL!';react='celebrate';conf=260;dur=5}
 else if(total>=1000){text='UAU! '+user+', VOCÊ MANDOU ESSE PRESENTÃO?! MUITO OBRIGADO PELO '+G+'! VOCÊ É INCRÍVEL!';react='wow';conf=300;dur=5}
 else if(total>=100){text='Nossa, '+user+'! Muito obrigado pelo '+gift+'! Você é demais!';react='dance';conf=150;dur=4}
 else if(total>=5){text='Obrigado, '+user+', pelo '+gift+'! Que presente lindo!';react='jump';conf=80;dur=2.5}
 else{text='OBRIGADO, '+user+', PELA '+G+'! VOCÊ É DEMAIS!';react='jump';conf=40;dur=2.2}
 enqueue({kind:'gift',user,text,react,confetti:conf,dur})}
function seguir(user){user=user||'amigo';log('➕ '+user+' seguiu');enqueue({kind:'event',user,text:'Bem-vindo, '+user+'! Obrigado por seguir a live!',react:'wave',dur:2.5,confetti:30})}
let likes=0,goal=100;
function curtidas(n){likes+=n;if($('goalTxt')){$('goalTxt').textContent='Meta de curtidas: '+Math.min(likes,goal)+'/'+goal;$('goalBar').style.width=Math.min(100,likes/goal*100)+'%'}
 if(likes>=goal){goal+=100;enqueue({kind:'event',user:'Meta!',text:'Meta de curtidas alcançada! Vocês são demais! Vamos comemorar!',react:'dance',dur:4,confetti:220});setTimeout(()=>curtidas(0),50)}}
function log(s){const d=document.createElement('div');d.textContent=s;const l=$('log');l.prepend(d);while(l.children.length>60)l.lastChild.remove()}

/* ---------- painel ---------- */
$('bStart').onclick=()=>{running=true;if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}log('▶ jogo iniciado')};
$('bStop').onclick=()=>{running=false;log('⏸ jogo pausado')};
$('bMsg').onclick=()=>{comentario($('tUser').value,$('tMsg').value);$('tMsg').value=''};
$('tMsg').onkeydown=e=>{if(e.key==='Enter')$('bMsg').click()};
document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const [n,v]=b.dataset.g.split(',');presente($('tUser').value,n,+$('tQty').value,+v)});
$('bFollow').onclick=()=>seguir($('tUser').value);$('bLike').onclick=()=>curtidas(20);
$('spd').oninput=e=>speedF=+e.target.value;
window.BobLive={comentario,presente,seguir,curtidas,iniciar:()=>$('bStart').click(),pausar:()=>$('bStop').click()};

/* ---------- loop principal ---------- */
const clock=new THREE.Clock();let fAcc=0,fN=0,tAll=0,blink=0;
function update(dt){
 tAll+=dt;animT+=dt;
 pump();
 let type='idle',d=1;
 if(busy){
  if(reaction){reaction.t+=dt;type=reaction.type;animT=reaction.t;d=reaction.dur;if(reaction.t>=reaction.dur)reaction=null}
  else type='talk';
  if(speechDone&&!reaction){busy=false;hideBubble()}
 }else if(running){
  if(action){action.t+=dt;type=action.type;animT=action.t;d=action.dur;if(action.t>=action.dur){action=null}}
  else{
   type=runMode?'run':'walk';animT=tAll;
   const tx=nodes[target][0],tz=nodes[target][1],dx=tx-char.position.x,dz=tz-char.position.z,dist=Math.hypot(dx,dz);
   let want=Math.atan2(dx,dz),diff=want-char.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));
   char.rotation.y+=diff*Math.min(1,dt*6);
   const sp=3.4*speedF*(runMode?1.9:1)*(Math.abs(diff)>.8?.25:1);
   if(dist>.35){char.position.x+=Math.sin(char.rotation.y)*sp*dt;char.position.z+=Math.cos(char.rotation.y)*sp*dt}
   if(dist<.6){nextNode();runMode=rng()<.3;if(rng()<.5){const k=pick(['wave','look','dance','jump','look','wave']);action={type:k,t:0,dur:k==='dance'?3.2:k==='jump'?1:2.4}}}
  }}
 if(!running&&!busy)animT=tAll;
 const tg=pose(type,animT,d),k=Math.min(1,dt*12);
 for(const key in cur)cur[key]+=(tg[key]-cur[key])*k;
 legL.rotation.x=cur.ll;legR.rotation.x=cur.lr;armL.rotation.x=cur.alx;armR.rotation.x=cur.arx;armL.rotation.z=cur.alz;armR.rotation.z=cur.arz;
 body.position.y=cur.by;body.rotation.y=cur.ry;
 mouthKick=Math.max(0,mouthKick-dt*7);mouth.scale.y=speaking?.12+Math.max(mouthKick,Math.abs(Math.sin(tAll*14))*.3)*.2:.1;
 mouth.scale.x=speaking?.3:.36;
 blink-=dt;if(blink<-3.2)blink=.14;eyes.scale.y=blink>0?.1:1;
 /* câmera */
 const fw=cc2.set(Math.sin(char.rotation.y),0,Math.cos(char.rotation.y));
 const p0=char.position,talking=busy;
 if(talking&&!prevTalk)talkYaw=char.rotation.y;prevTalk=talking;
 camT-=dt;
 if(!talking&&camT<=0){const nr=regionAt(p0.x,p0.z);
  if(nr!==region){region=nr;showRegion(nr);camMode='wide';camT=4}
  else if(shopsNear(p0)){camMode='wide';camT=3}
  else if(running&&rng()<.01){camMode='orbit';camT=5;orbA=Math.atan2(-fw.x,-fw.z)+Math.PI}
  else{camMode='follow';camT=.6}}
 const mode=talking?'talk':camMode;let want,look;
 if(mode==='talk'){const sy=Math.sin(talkYaw),cy=Math.cos(talkYaw);
  want=new THREE.Vector3(p0.x+sy*3.4+cy*1.8,2.9,p0.z+cy*3.4-sy*1.8);look=new THREE.Vector3(p0.x,2.4,p0.z);
  const a=Math.atan2(cam.position.x-p0.x,cam.position.z-p0.z),df=Math.atan2(Math.sin(a-char.rotation.y),Math.cos(a-char.rotation.y));char.rotation.y+=df*Math.min(1,dt*4)}
 else if(mode==='wide'){want=new THREE.Vector3(p0.x+fw.x*11+fw.z*5,8,p0.z+fw.z*11-fw.x*5);look=new THREE.Vector3(p0.x,1.5,p0.z)}
 else if(mode==='orbit'){orbA+=dt*.5;want=new THREE.Vector3(p0.x+Math.sin(orbA)*8,4.2,p0.z+Math.cos(orbA)*8);look=new THREE.Vector3(p0.x,2.2,p0.z)}
 else{want=new THREE.Vector3(p0.x+fw.x*6.5,3.6,p0.z+fw.z*6.5);look=new THREE.Vector3(p0.x,2,p0.z)}
 cam.position.lerp(want,Math.min(1,dt*(mode==='talk'?3.5:2)));
 camLook.lerp(look,Math.min(1,dt*4));cam.lookAt(camLook);
 /* mundo */
 for(let i=0;i<NB;i++){bp[i*3+1]+=dt*(1+(i%5)*.3);if(bp[i*3+1]>26){bp[i*3+1]=0;bp[i*3]=R(-50,50);bp[i*3+2]=R(-50,50)}}
 bg.attributes.position.needsUpdate=true;
 fish.forEach(f=>{const u=f.userData;u.a+=u.s*dt;const x=Math.cos(u.a)*u.r,z=Math.sin(u.a)*u.r;f.position.set(x,u.y+Math.sin(tAll+u.w)*.6,z);f.rotation.y=-u.a+(u.s>0?Math.PI:0)});
 kelp.forEach(kp=>kp.rotation.z=Math.sin(tAll*1.4+kp.userData.p)*.12);
 orb.position.y=4+Math.sin(tAll*2)*.25;
 for(let i=0;i<NC;i++){if(cl[i]>0){cl[i]-=dt;cv[i].y-=9*dt;cp[i*3]+=cv[i].x*dt;cp[i*3+1]+=cv[i].y*dt;cp[i*3+2]+=cv[i].z*dt;if(cl[i]<=0||cp[i*3+1]<0){cl[i]=0;cp[i*3+1]=-100}}}
 cg.attributes.position.needsUpdate=true}
function loop(){requestAnimationFrame(loop);const dt=Math.min(.05,clock.getDelta());update(dt);renderer.render(scene,cam);
 fAcc+=dt;fN++;if(fAcc>2){const fps=fN/fAcc;if(fps<42&&pr>.75){pr=Math.max(.75,pr-.2);resize()}fAcc=0;fN=0}}
cam.position.set(nodes[0][0]-7,4.6,nodes[0][1]);
curtidas(0);running=true;addEventListener('pointerdown',()=>{try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}catch(e){}},{once:true});loop();
})();
