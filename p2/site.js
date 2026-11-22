const $=id=>document.getElementById(id);
const storage={get:(k,session=false)=>{try{return (session?sessionStorage:localStorage).getItem(k);}catch{return null;}},set:(k,v,session=false)=>{try{(session?sessionStorage:localStorage).setItem(k,v);}catch{}},remove:(k,session=false)=>{try{(session?sessionStorage:localStorage).removeItem(k);}catch{}}};
$('menu-toggle')?.addEventListener('click',()=>{const open=$('menu-toggle').getAttribute('aria-expanded')==='true';$('menu-toggle').setAttribute('aria-expanded',String(!open));$('main-nav').classList.toggle('open',!open);});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&$('main-nav')?.classList.contains('open')){$('main-nav').classList.remove('open');$('menu-toggle')?.setAttribute('aria-expanded','false');$('menu-toggle')?.focus();}});
let favorites;try{favorites=JSON.parse(storage.get('nexus-favorites')||'[]');if(!Array.isArray(favorites))favorites=[];}catch{favorites=[];}
function renderFavorites(){document.querySelectorAll('[data-favorite]').forEach(b=>{const saved=favorites.includes(b.dataset.favorite);b.setAttribute('aria-pressed',String(saved));b.textContent=b.classList.contains('icon-button')?(saved?'♥':'♡'):(saved?'♥ Lugar salvo':'♡ Salvar lugar');});if($('saved-grid')){let visible=0;$('saved-grid').querySelectorAll('.business-card').forEach(card=>{const saved=favorites.includes(card.querySelector('[data-favorite]').dataset.favorite);card.hidden=!saved;if(saved)visible++;});$('saved-empty').hidden=visible>0;}}
document.querySelectorAll('[data-favorite]').forEach(b=>b.addEventListener('click',()=>{favorites=favorites.includes(b.dataset.favorite)?favorites.filter(x=>x!==b.dataset.favorite):[...favorites,b.dataset.favorite].slice(-200);storage.set('nexus-favorites',JSON.stringify(favorites));renderFavorites();}));renderFavorites();
document.querySelectorAll('img').forEach(img=>{const fallback=()=>{img.hidden=true;img.parentElement.classList.add('image-unavailable');};img.addEventListener('error',fallback);if(img.complete&&!img.naturalWidth)fallback();});
let consent=storage.get('nexus-consent-v1');
const consentTime=Number(storage.get('nexus-consent-time')||0);if(Date.now()-consentTime>180*86400000)consent=null;
if($('consent'))$('consent').hidden=consent!==null;
async function measure(name,extra={}){if(consent!=='yes'||document.visibilityState!=='visible')return;let sid=storage.get('nexus-session',true);if(!sid){sid=crypto.randomUUID();storage.set('nexus-session',sid,true);}try{await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,event_id:crypto.randomUUID(),session_id:sid,consent:true,...extra}),keepalive:true});}catch{/* Falha de medição não impede navegação. */}}
let pageMeasured=false;const onConsent=[];
function measurePage(){if(consent!=='yes'||pageMeasured)return;pageMeasured=true;const profile=document.querySelector('[data-profile]'),search=document.querySelector('[data-search-results]');if(profile){const from=new URL(location.href).searchParams.get('from');measure('business_viewed',{business_id:profile.dataset.profile,source:['search','home','content','campaign'].includes(from)?from:'direct'});}if(search)measure('search_submitted',{result_count:Number(search.dataset.searchResults)});}
for(const [id,value] of [['consent-yes','yes'],['consent-no','no']])$(id)?.addEventListener('click',()=>{consent=value;storage.set('nexus-consent-v1',value);storage.set('nexus-consent-time',String(Date.now()));$('consent').hidden=true;if(value==='no')storage.remove('nexus-session',true);measurePage();if(value==='yes')onConsent.forEach(f=>f());});
$('privacy-settings')?.addEventListener('click',()=>{$('consent').hidden=false;$('consent-no').focus();});measurePage();
document.querySelectorAll('[data-contact]').forEach(a=>a.addEventListener('click',()=>measure('contact_clicked',{business_id:a.dataset.business,channel:a.dataset.contact})));
// Perfil no celular: a barra fixa de contato só aparece quando os botões do topo saem da tela.
const contactBar=document.querySelector('[data-contact-bar]'),profileActions=document.querySelector('.profile-head .actions');
if(contactBar&&profileActions&&'IntersectionObserver' in window){contactBar.toggleAttribute('data-hidden',true);new IntersectionObserver(([entry])=>contactBar.toggleAttribute('data-hidden',entry.isIntersecting)).observe(profileActions);}
// Formulário devolvido com erro: leva a lista de erros para a tela, inclusive no celular.
const formErrors=document.querySelector('.form-errors');if(formErrors){formErrors.tabIndex=-1;formErrors.scrollIntoView({block:'center'});formErrors.focus({preventScroll:true});}
// Anúncios (contrato 11): rodízio a cada 8s entre as peças de um espaço (data-rotate: anterior, pausar e próximo), parado com
// prefers-reduced-motion, com o mouse ou o foco no espaço e com a aba escondida. No celular, pula as peças sem formato de celular.
// Mede só a peça que aparece na tela (metade visível por 1s) e o clique, com o espaço (slot) quando ele é do inventário. Ao aceitar
// a medição, a peça que já está na tela também conta.
const small=matchMedia('(max-width: 700px)');
document.querySelectorAll('.vitrine-slot').forEach(slot=>{
  const slides=[...slot.querySelectorAll('[data-campaign]')],space=slot.dataset.vitrine;
  const count=slot.querySelector('.vitrine-count'),controls=slot.querySelector('.vitrine-controls'),toggle=slot.querySelector('[data-rotate="toggle"]');
  const fits=s=>!(small.matches&&s.classList.contains('sem-celular'));
  let current=slides.find(fits)||slides[0],paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show=step=>{const list=slides.filter(fits);if(controls)controls.hidden=list.length<2;if(!list.length)return;let i=list.indexOf(current);i=i<0?0:(i+step+list.length)%list.length;current=list[i];slides.forEach(s=>{s.hidden=s!==current;});if(count)count.textContent=`${i+1} de ${list.length}`;};
  show(0);small.addEventListener('change',()=>show(0));
  slot.querySelector('[data-rotate="next"]')?.addEventListener('click',()=>show(1));slot.querySelector('[data-rotate="previous"]')?.addEventListener('click',()=>show(-1));
  const update=()=>toggle?.setAttribute('aria-pressed',String(paused));update();toggle?.addEventListener('click',()=>{paused=!paused;update();});
  if(slides.length>1)setInterval(()=>{if(!paused&&document.visibilityState==='visible'&&!slot.matches(':hover')&&!slot.contains(document.activeElement))show(1);},8000);
  const data=a=>({campaign_id:a.dataset.campaign,...(space?{slot:space}:{})});
  const seen=new Set(),timers=new Map();const observer=new IntersectionObserver(entries=>{for(const entry of entries){const target=entry.target;if(timers.has(target)){clearTimeout(timers.get(target));timers.delete(target);}if(entry.intersectionRatio>=.5&&!target.hidden&&!seen.has(target)&&consent==='yes'){timers.set(target,setTimeout(()=>{if(!target.hidden&&document.visibilityState==='visible'&&consent==='yes'){seen.add(target);measure('banner_viewed',data(target));}},1000));}}},{threshold:[0,.5,1]});
  slides.forEach(a=>{observer.observe(a);a.addEventListener('click',()=>measure('banner_clicked',data(a)));});
  onConsent.push(()=>slides.forEach(a=>{observer.unobserve(a);observer.observe(a);}));
});
// Busca: categoria e bairro se filtram mutuamente; cada lista mostra só o que existe junto com a escolha da outra.
document.querySelectorAll('form.search').forEach(form=>{
  const category=form.querySelector('select[name=category]'),district=form.querySelector('select[name=district]');
  if(!category||!district)return;
  const lists=[[district,[...district.options].slice(1),'categories',category],[category,[...category.options].slice(1),'districts',district]].map(([select,options,key,other])=>({select,first:select.options[0],options,key,other}));
  const apply=({select,first,options,key,other})=>{
    const current=select.value,wanted=other.value;
    const visible=options.filter(option=>!wanted||(option.dataset[key]||'').split('|').includes(wanted));
    select.replaceChildren(first,...visible);
    select.value=visible.some(option=>option.value===current)?current:'';
  };
  const update=changed=>{const [a,b]=changed===district?[lists[1],lists[0]]:lists;apply(a);apply(b);};
  category.addEventListener('change',()=>update(category));
  district.addEventListener('change',()=>update(district));
  update(category);
});
// Mapa da abertura: a roda do mouse aproxima em volta do cursor, arrastar move; no celular, pinça e dois dedos (um dedo move
// quando já está aproximado) e toque duplo amplia. Botões: aproximar, afastar e voltar ao quadro com todas as empresas.
// O zoom troca o viewBox do SVG; --u (unidades por px) mantém pontos e rótulos do mesmo tamanho na tela.
document.querySelectorAll('[data-map]').forEach(map=>{
  const frame=map.querySelector('.map-frame'),svg=map.querySelector('.map-svg');
  const [qx,qy,qw,qh]=map.dataset.quadro.split(' ').map(Number),[aw,ah]=map.dataset.area.split(' ').map(Number);
  // data-foco (16/10): o mapa abre e volta ao aglomerado de empresas; afastar ainda mostra o quadro todo.
  const foco=map.dataset.foco?map.dataset.foco.split(' ').map(Number):null;
  const MAX=8,R=4.5,home=foco?[foco[0]+foco[2]/2,foco[1]+foco[3]/2]:[qx+qw/2,qy+qh/2],circles=[...svg.querySelectorAll('.map-point circle')];
  const buttons=Object.fromEntries([...map.querySelectorAll('[data-map-zoom]')].map(b=>[b.dataset.mapZoom,b]));
  const at=el=>({el,x:+el.getAttribute('x'),y:+el.getAttribute('y'),n:el.textContent.length});
  const towns=[...svg.querySelectorAll('.map-labels text')].map(at),dots=circles.map(c=>({x:+c.getAttribute('cx'),y:+c.getAttribute('cy')}));
  const districts=[...svg.querySelectorAll('.map-bairros text')].map(el=>({...at(el),guia:el.classList.contains('is-guia')}));
  const clamp=(v,a,b)=>Math.min(Math.max(v,a),b),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const controls=map.querySelector('.map-controls');
  let fw=1,fh=1,base=1,z=1,zHome=1,[cx,cy]=home,pending=0,anim=0,wheel=null,ctrl=[0,0,0,0];
  const fit=()=>{const r=frame.getBoundingClientRect(),c=controls.getBoundingClientRect();fw=r.width||1;fh=r.height||1;base=Math.min(fw/qw,fh/qh);zHome=foco?clamp(Math.min(fw/foco[2],fh/foco[3])/base,1,MAX):1;ctrl=[c.left-r.left-6,c.top-r.top-6,c.right-r.left+6,c.bottom-r.top+6];};
  const limit=()=>{z=clamp(z,1,MAX);const hw=fw/base/z/2,hh=fh/base/z/2;cx=hw*2>=aw?aw/2:clamp(cx,hw,aw-hw);cy=hh*2>=ah?ah/2:clamp(cy,hh,ah-hh);};
  const view=()=>{const s=base*z;return {s,x:cx-fw/s/2,y:cy-fh/s/2};};
  // Ponto do mapa sob o cursor e posição do cursor no quadro; keep() centraliza para esse ponto continuar sob o cursor.
  const under=(px,py)=>{const r=frame.getBoundingClientRect(),v=view(),mx=px-r.left,my=py-r.top;return {ux:v.x+mx/v.s,uy:v.y+my/v.s,mx,my};};
  const keep=(p,nz)=>{const s=base*nz;return [p.ux-p.mx/s+fw/s/2,p.uy-p.my/s+fh/s/2];};
  // Nomes de município ficam inteiros dentro do quadro (deslizam da borda para dentro, sem ir para baixo dos botões) e não se sobrepõem. Os de bairro
  // aparecem ao aproximar, só os que cabem sem cobrir outros nomes nem pontos; bairros com empresas do guia vêm primeiro
  // e podem ficar sob os pontos.
  function declutter(v){
    const labels=[ctrl],dotBoxes=dots.map(d=>{const x=(d.x-v.x)*v.s,y=(d.y-v.y)*v.s;return [x-7,y-7,x+7,y+7];});
    const box=(x,y,w,size)=>[x-w/2,y-size,x+w/2,y+size*.4];
    const hit=(b,list)=>list.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1]);
    for(const t of towns){
      const w=t.n*12*.68+8,y=(t.y-v.y)*v.s;let x=(t.x-v.x)*v.s;
      if(x>=0&&x<=fw)x=clamp(x,w/2+4,(y+5>ctrl[1]&&y-12<ctrl[3]?ctrl[0]:fw)-w/2-4);
      const b=box(x,y,w,12),show=!hit(b,labels);
      if(show)labels.push(b);
      t.el.setAttribute('x',(v.x+x/v.s).toFixed(1));t.el.classList.toggle('is-off',!show);
    }
    for(const d of districts){
      const b=box((d.x-v.x)*v.s,(d.y-v.y)*v.s,d.n*10*.6+8,10);
      const show=z>=1.6&&b[0]>=0&&b[2]<=fw&&b[1]>=0&&b[3]<=fh&&!hit(b,labels)&&(d.guia||!hit(b,dotBoxes));
      if(show)labels.push(b);
      d.el.classList.toggle('is-on',show);
    }
  }
  function render(){
    pending=0;limit();const v=view();
    svg.setAttribute('viewBox',`${v.x.toFixed(2)} ${v.y.toFixed(2)} ${(fw/v.s).toFixed(2)} ${(fh/v.s).toFixed(2)}`);
    svg.style.setProperty('--u',(1/v.s).toFixed(4));
    const r=(R/v.s).toFixed(2);circles.forEach(c=>c.setAttribute('r',r));
    map.dataset.nivel=z<1.6?'longe':z<3.2?'medio':'perto';
    map.toggleAttribute('data-zoomed',z>1.02);
    buttons.in.disabled=z>=MAX-.01;buttons.out.disabled=z<=1.01;
    buttons.reset.disabled=Math.abs(z-zHome)<.01&&Math.hypot(cx-home[0],cy-home[1])<1;
    declutter(v);
  }
  const request=()=>{if(!pending)pending=requestAnimationFrame(render);};
  const stop=()=>{cancelAnimationFrame(anim);anim=0;wheel=null;};
  function animate(nz,ncx,ncy){
    stop();const [z0,x0,y0]=[z,cx,cy];[z,cx,cy]=[nz,ncx,ncy];limit();const [z1,x1,y1]=[z,cx,cy];
    if(reduce.matches)return request();
    [z,cx,cy]=[z0,x0,y0];const t0=performance.now();
    const step=now=>{const t=Math.min(1,(now-t0)/320),k=1-(1-t)**3;z=z0*(z1/z0)**k;cx=x0+(x1-x0)*k;cy=y0+(y1-y0)*k;render();anim=t<1?requestAnimationFrame(step):0;};
    anim=requestAnimationFrame(step);
  }
  const zoomAround=(nz,px,py)=>{const p=under(px,py),t=clamp(nz,1,MAX);animate(t,...keep(p,t));};
  buttons.in.addEventListener('click',()=>animate(z*2,cx,cy));
  buttons.out.addEventListener('click',()=>animate(z/2,cx,cy));
  buttons.reset.addEventListener('click',()=>animate(zHome,...home));
  // Roda do mouse: cada movimento aproxima na hora, suavizado até o alvo. Se a página estava rolando por cima do mapa, ou se o
  // zoom já está no limite, a roda continua rolando a página em vez de ficar presa no mapa.
  let scrolledAt=0,zoomedAt=0;
  addEventListener('scroll',()=>{scrolledAt=performance.now();},{passive:true});
  const wheelStep=()=>{
    const w=wheel;anim=0;if(!w)return;
    const lz=Math.log(z),lt=Math.log(w.z),done=Math.abs(lt-lz)<.003;
    z=done?w.z:Math.exp(lz+(lt-lz)*.4);[cx,cy]=keep(w.p,z);render();
    if(done)wheel=null;else anim=requestAnimationFrame(wheelStep);
  };
  frame.addEventListener('wheel',e=>{
    const now=performance.now(),recent=now-zoomedAt<400;
    if(!recent&&now-scrolledAt<400)return;
    const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?fh:1);if(!dy)return;
    const target=wheel?wheel.z:z;
    if(!recent&&((dy>0&&target<=1.001)||(dy<0&&target>=MAX-.001)))return;
    e.preventDefault();zoomedAt=now;
    const p=under(e.clientX,e.clientY),nz=clamp(target*Math.exp(-dy*(e.ctrlKey?.012:.0028)),1,MAX);
    if(!wheel){cancelAnimationFrame(anim);anim=requestAnimationFrame(wheelStep);}
    wheel={z:nz,p};
  },{passive:false});
  frame.addEventListener('dblclick',e=>{if(e.target.closest('a,.map-controls'))return;e.preventDefault();zoomAround(e.shiftKey?z/2:z*2,e.clientX,e.clientY);});
  // Arrastar com o mouse (o toque tem tratamento próprio abaixo). Um arraste não conta como clique no ponto.
  let drag=null,dragged=false;
  frame.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button||e.target.closest('.map-controls'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,c:[cx,cy]};dragged=false;});
  frame.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!dragged){if(Math.hypot(dx,dy)<4)return;dragged=true;stop();frame.setPointerCapture(e.pointerId);frame.classList.add('is-dragging');}
    const s=base*z;cx=drag.c[0]-dx/s;cy=drag.c[1]-dy/s;request();
  });
  const release=e=>{if(drag&&e.pointerId===drag.id){drag=null;frame.classList.remove('is-dragging');}};
  frame.addEventListener('pointerup',release);frame.addEventListener('pointercancel',release);
  frame.addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopPropagation();dragged=false;}},true);
  // Toque: dois dedos aproximam e movem; um dedo só move quando já está aproximado (senão a página rola normalmente).
  let touch=null,tap=null;
  const fingers=e=>[...e.touches].map(t=>[t.clientX,t.clientY]);
  const startTouch=e=>{
    const f=fingers(e);
    if(f.length>=2){const [a,b]=f;touch={pinch:true,d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,z,p:under((a[0]+b[0])/2,(a[1]+b[1])/2)};}
    else if(f.length===1)touch={pinch:false,start:f[0],c:[cx,cy],moved:false,time:performance.now()};
  };
  frame.addEventListener('touchstart',e=>{if(e.target.closest('.map-controls'))return;stop();startTouch(e);},{passive:true});
  frame.addEventListener('touchmove',e=>{
    if(!touch)return;const f=fingers(e);
    if(touch.pinch&&f.length>=2){
      e.preventDefault();const [a,b]=f,r=frame.getBoundingClientRect();
      z=clamp(touch.z*Math.hypot(a[0]-b[0],a[1]-b[1])/touch.d,1,MAX);
      [cx,cy]=keep({...touch.p,mx:(a[0]+b[0])/2-r.left,my:(a[1]+b[1])/2-r.top},z);request();
    }else if(!touch.pinch&&f.length===1){
      const dx=f[0][0]-touch.start[0],dy=f[0][1]-touch.start[1];
      if(Math.hypot(dx,dy)>8)touch.moved=true;
      if(z>1.02){e.preventDefault();const s=base*z;cx=touch.c[0]-dx/s;cy=touch.c[1]-dy/s;request();}
    }
  },{passive:false});
  frame.addEventListener('touchend',e=>{
    if(!touch)return;
    if(e.touches.length){startTouch(e);if(touch)touch.moved=true;return;}
    if(!touch.pinch&&!touch.moved&&performance.now()-touch.time<300){
      const now=performance.now(),p=touch.start;
      if(tap&&now-tap.t<320&&Math.hypot(p[0]-tap.p[0],p[1]-tap.p[1])<30){e.preventDefault();zoomAround(z>=MAX-.01?1:z*2,...p);tap=null;}
      else tap={t:now,p};
    }
    touch=null;
  },{passive:false});
  frame.addEventListener('touchcancel',()=>{touch=null;});
  new ResizeObserver(()=>{fit();render();}).observe(frame);
  fit();z=zHome;render();
});

// Grade da página inicial: o cartão "Ver as N empresas" fecha a última linha contando só os cards que aparecem. Um card de
// anúncio escondido (no celular, ou por um bloqueador do navegador) não deixa casa vazia.
const fecharGrade=()=>{
  const tile=document.querySelector('.more-tile[data-resto4]');if(!tile)return;
  const n=[...tile.parentElement.children].filter(el=>el!==tile&&getComputedStyle(el).display!=='none').length;
  tile.dataset.resto4=String((4-n%4)%4||4);tile.dataset.resto2=String((2-n%2)%2||2);
};
fecharGrade();addEventListener('load',fecharGrade);setTimeout(fecharGrade,1500);
let gradeQuadro=0;addEventListener('resize',()=>{cancelAnimationFrame(gradeQuadro);gradeQuadro=requestAnimationFrame(fecharGrade);});

// v0.17.0 (contrato 18.8): medição dos atalhos de categoria, da cópia do código do cupom e do filtro "Com cupom", com o
// mesmo consentimento. O "Abrir no Waze" é um data-contact (canal waze) e o mapa da busca mede a própria abertura.
document.querySelectorAll('[data-atalho]').forEach(a=>a.addEventListener('click',()=>measure('shortcut_clicked',{ref:a.dataset.atalho,source:'home'})));
document.addEventListener('click',ev=>{
  const copiar=ev.target.closest('[data-copiar-codigo]'),empresa=copiar?.closest('[data-cupom-empresa]')?.dataset.cupomEmpresa;
  if(empresa)measure('coupon_copied',{business_id:empresa});
  const filtro=ev.target.closest('[data-filtro-medido]');
  if(filtro)measure('filter_used',{ref:filtro.dataset.filtroMedido,source:'search'});
});
// Mapa da busca (18.3): no celular, "Ver no mapa" alterna lista e mapa; na tela larga o mapa fica ao lado. map_opened uma
// vez por página: na abertura pelo botão ou no primeiro uso do mapa (toque, roda ou botão de zoom) na tela larga.
const split=document.querySelector('[data-search-split]');
if(split){
  const botao=split.querySelector('[data-alternar-mapa]'),mapa=split.querySelector('.search-map');let medido=false;
  const abriu=()=>{if(!medido){medido=true;measure('map_opened',{source:'search'});}};
  split.classList.add('tem-alternancia');botao.hidden=false;
  botao.addEventListener('click',()=>{const ver=!split.classList.contains('mostra-mapa');split.classList.toggle('mostra-mapa',ver);botao.setAttribute('aria-pressed',String(ver));botao.textContent=ver?'Ver a lista':'Ver no mapa';if(ver){abriu();window.dispatchEvent(new Event('resize'));}});
  for(const ev of ['pointerdown','wheel','keydown'])mapa.addEventListener(ev,()=>{if(getComputedStyle(botao).display==='none')abriu();},{once:true,passive:true});
}
// Atalhos de categoria (v0.17.1): uma faixa só, sem quebra. As setas aparecem quando sobra categoria fora da tela, andam
// cerca de 80% da largura e ficam desativadas nas pontas. A barra de rolagem continua para quem arrasta ou usa o teclado.
const atalhos=document.querySelector('[data-atalhos]');
if(atalhos){
  const trilha=atalhos.querySelector('[data-atalhos-trilha]'),setas=[...atalhos.querySelectorAll('[data-atalhos-ir]')];
  const calmo=matchMedia('(prefers-reduced-motion: reduce)');
  const atualizar=()=>{const resto=trilha.scrollWidth-trilha.clientWidth;setas.forEach(b=>{b.hidden=resto<=4;});if(resto>4){setas[0].disabled=trilha.scrollLeft<=2;setas[1].disabled=trilha.scrollLeft>=resto-2;}};
  setas.forEach(b=>b.addEventListener('click',()=>trilha.scrollBy({left:Number(b.dataset.atalhosIr)*trilha.clientWidth*.8,behavior:calmo.matches?'auto':'smooth'})));
  trilha.addEventListener('scroll',atualizar,{passive:true});addEventListener('resize',atualizar);addEventListener('load',atualizar);atualizar();
}
