// Admin da equipe Nexus (Fase 4, contrato 13). As escritas levam o X-CSRF-Token de data-csrf e a version lida; quando dão
// certo, a página recarrega com a confirmação no topo. 401 volta para /entrar, 409 pede recarregar e 422 marca o campo.
import { $, $$, api, emailOk, limparErros, mostrarErros, ocupar } from './formulario.js';
import { ligarCampos, normalizar, lerHorario, lerRedes } from './empresa-campos.js';

const raiz=$('[data-admin]');
const csrf=raiz?.dataset.csrf||'',API='/api/admin',CHAVE='nexus-admin-aviso';
const enc=encodeURIComponent;
const versao=v=>/^\d+$/.test(String(v??''))?Number(v):v;
const texto=(tag,conteudo,cls)=>Object.assign(document.createElement(tag),{textContent:conteudo,...(cls?{className:cls}:{})});
const escapar=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const data=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${m[3]}/${m[2]}/${m[1]}`:v;};
let saindo=false;

// Confirmação no topo (role="status"); a de erro pode trazer o botão de recarregar.
const aviso=$('[data-aviso]');
function avisar(mensagem,{erro=false,recarregar=false}={}) {
  if(!aviso)return;
  aviso.className=`panel-flash${erro?' is-error':''}`;
  aviso.replaceChildren(texto('span',mensagem));
  if(recarregar){const b=texto('button','Recarregar','button secondary');b.type='button';b.addEventListener('click',()=>location.reload());aviso.append(b);}
  aviso.hidden=false;aviso.focus();
}
// Vai para a página (ou recarrega a mesma) com a confirmação guardada para depois do carregamento.
function irPara(url,mensagem,erro=false) {
  saindo=true;
  try{sessionStorage.setItem(CHAVE,JSON.stringify({mensagem,erro}));}catch{/* sem armazenamento: segue sem o aviso */}
  const destino=new URL(url,location.href);destino.hash='';
  if(destino.href===location.href.replace(/#.*$/,''))location.reload();else location.assign(destino.href);
}
const recarregar=mensagem=>{const u=new URL(location.href);['espaco','inicio'].forEach(k=>u.searchParams.delete(k));irPara(u.href,mensagem);};
try{const guardado=JSON.parse(sessionStorage.getItem(CHAVE)||'null');if(guardado){sessionStorage.removeItem(CHAVE);avisar(guardado.mensagem,{erro:guardado.erro});}}catch{/* idem */}

async function chamar(metodo,url,corpo,extra={}) {
  const r=await api(metodo,url,{corpo,csrf,...extra});
  if(r.status===401){saindo=true;location.assign(`/entrar?${new URLSearchParams({next:location.pathname+location.search,motivo:'expirou'})}`);return new Promise(()=>{});}
  if(r.status===403&&!r.erro.includes('permissão'))r.erro='Seu papel na equipe não permite fazer isso.';
  return r;
}
function falha(r,form) {
  if(r.status===409)return avisar(r.erro,{erro:true,recarregar:true});
  if(form&&r.status===422)return mostrarErros(form,[{campo:r.campo,mensagem:r.erro}]);
  if(form&&$('.form-errors',form))return mostrarErros(form,[{campo:'',mensagem:r.erro}]);
  avisar(r.erro,{erro:true});
}
const anuncio=$('[data-anuncio]');
const anunciar=t=>{if(!anuncio)return;anuncio.textContent='';setTimeout(()=>{anuncio.textContent=t;},50);};

// Abas do admin até 1050 px (a faixa de módulos que rola de lado): o esmaecido marca o lado em que ainda há módulos
// escondidos, e a faixa já abre rolada até o módulo aberto. No desktop a faixa não rola, e nada muda.
const faixa=$('.admin-nav .nav-groups'),navAdmin=faixa?.closest('.admin-nav');
if(faixa){
  const marcar=()=>{const resto=faixa.scrollWidth-faixa.clientWidth;navAdmin.classList.toggle('tem-antes',faixa.scrollLeft>2);navAdmin.classList.toggle('tem-depois',resto>2&&faixa.scrollLeft<resto-2);};
  const aberta=$('[aria-current]',faixa);
  if(aberta&&faixa.scrollWidth>faixa.clientWidth){const a=aberta.getBoundingClientRect(),f=faixa.getBoundingClientRect();faixa.scrollLeft+=a.left-f.left-(f.width-a.width)/2;}
  faixa.addEventListener('scroll',marcar,{passive:true});addEventListener('resize',marcar);marcar();
}
// Ação que apaga, tira do ar ou desativa: o primeiro toque pede a confirmação no próprio botão, que volta ao normal quando o
// foco sai dele.
function confirmar(botao,rotulo) {
  const antes=botao.innerHTML,contexto=[...botao.querySelectorAll('.sr-only')].map(s=>s.cloneNode(true));
  botao.dataset.confirmar='1';botao.replaceChildren(texto('span',rotulo),...contexto);
  anunciar(`${rotulo}. Toque de novo para confirmar.`);
  botao.addEventListener('blur',()=>{if(botao.isConnected&&botao.dataset.confirmar){delete botao.dataset.confirmar;botao.innerHTML=antes;}},{once:true});
}
// Formulário começado e não enviado: avisa antes de sair (o registro tem a própria conferência).
const sujos=new Set();
document.addEventListener('input',ev=>{const f=ev.target.closest('form[data-form]');if(f&&!f.classList.contains('admin-form')&&!['papel-equipe','status-solicitacao','alt'].includes(f.dataset.form))sujos.add(f);});
addEventListener('beforeunload',ev=>{if(!saindo&&sujos.size)ev.preventDefault();});

// Valores: reais digitados ("1.234,56", "49,9" ou "49.90") em centavos; vazio é null e o que não é número, NaN.
const centavos=v=>{
  let t=String(v??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
  if(!t)return null;
  if(/^\d+\.\d{1,2}$/.test(t))t=t.replace('.',',');
  if(!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t))return NaN;
  const [inteiro,fracao='']=t.replace(/\./g,'').split(',');
  return Number(inteiro)*100+Number(fracao.padEnd(2,'0'));
};
const valor=(f,n)=>{const el=f.elements[n];return el instanceof Element?el.value.trim():undefined;};
const nulo=v=>v===''||v===undefined?null:v;
const marcados=(f,n)=>$$(`input[type=checkbox][name="${n}"]`,f).filter(c=>c.checked).map(c=>c.value);
const inteiro=(f,n,padrao)=>{const v=valor(f,n);return v===''||v===undefined?padrao:Number(v);};

// Navegação ------------------------------------------------------------------------------------------------------------

const atual=$('.admin-nav [aria-current]');
if(atual&&matchMedia('(max-width: 1050px)').matches){const faixa=atual.closest('.panel-nav'),a=atual.getBoundingClientRect(),f=faixa.getBoundingClientRect();faixa.scrollLeft+=a.left-f.left-(f.width-a.width)/2;}
$('[data-sair]')?.addEventListener('click',async ev=>{
  ocupar(ev.currentTarget,'Saindo…');saindo=true;
  await api('POST','/api/auth/logout',{csrf});
  location.assign('/entrar?motivo=saiu');
});
// Filtros vazios ficam fora da URL; ao voltar pelo histórico, os campos voltam a valer.
$$('form.admin-filters').forEach(f=>f.addEventListener('submit',()=>{$$('input,select',f).forEach(c=>{if(c.name&&!c.value)c.disabled=true;});}));
addEventListener('pageshow',()=>$$('.admin-filters [disabled]').forEach(c=>{c.disabled=false;}));

// Biblioteca de imagens -------------------------------------------------------------------------------------------------

const dialogo=$('[data-biblioteca]');
let escolhida=null,termo='',pagina=0;
function escolherImagem() {
  if(!dialogo)return Promise.resolve(null);
  return new Promise(resolver=>{escolhida=resolver;dialogo.showModal();if(!pagina)carregarBiblioteca(true);});
}
function fecharBiblioteca(m=null) {
  const resolver=escolhida;escolhida=null;
  if(dialogo.open)dialogo.close();
  resolver?.(m);
}
async function carregarBiblioteca(doZero) {
  const lista=$('[data-biblioteca-lista]',dialogo),mais=$('[data-biblioteca-mais]',dialogo),estado=$('[data-biblioteca-status]',dialogo);
  if(doZero){pagina=0;lista.replaceChildren(texto('p','Carregando as imagens…','muted'));}
  lista.setAttribute('aria-busy','true');mais.hidden=true;
  const r=await chamar('GET',`${API}/midia?${new URLSearchParams({...(termo?{q:termo}:{}),page:String(pagina+1)})}`);
  lista.setAttribute('aria-busy','false');
  if(doZero)lista.replaceChildren();
  if(!r.ok){lista.append(texto('p',r.erro,'muted'));return;}
  const {itens=[],total=0,paginas=1}=r.dados||{};pagina+=1;
  for(const m of itens){
    const b=document.createElement('button');b.type='button';b.className='media-choice secondary';
    b.append(Object.assign(document.createElement('img'),{src:m.tamanhos?.[320]||m.url,alt:'',loading:'lazy',decoding:'async'}),texto('span',m.alt||'Sem descrição'));
    b.setAttribute('aria-label',`Usar a imagem: ${m.alt||'sem descrição'}`);
    b.addEventListener('click',()=>fecharBiblioteca(m));
    lista.append(b);
  }
  if(!total)lista.append(texto('p',termo?'Nenhuma imagem com essa descrição.':'A biblioteca está vazia. Envie a primeira imagem abaixo.','muted'));
  mais.hidden=pagina>=paginas;
  estado.textContent=total?`${total} ${total===1?'imagem':'imagens'} na biblioteca${termo?' com essa descrição':''}.`:'';
}
if(dialogo){
  dialogo.addEventListener('close',()=>{if(escolhida)fecharBiblioteca(null);});
  dialogo.addEventListener('click',ev=>{if(ev.target===dialogo)fecharBiblioteca(null);});
  $('[data-fechar-biblioteca]',dialogo).addEventListener('click',()=>fecharBiblioteca(null));
  $('[data-biblioteca-busca]',dialogo).addEventListener('submit',ev=>{ev.preventDefault();termo=ev.currentTarget.elements.q.value.trim();carregarBiblioteca(true);});
  $('[data-biblioteca-mais]',dialogo).addEventListener('click',()=>carregarBiblioteca(false));
  // A imagem enviada já volta escolhida; a lista recarrega na próxima vez, com ela.
  envioDeImagem($('[data-envio-midia]',dialogo),m=>{pagina=0;fecharBiblioteca(m);});
}

// Envio de imagem (no módulo Mídia e na biblioteca): prévia, descrição obrigatória e corpo binário com ?alt=.
const problemaImagem=f=>!['image/jpeg','image/png','image/webp'].includes(f.type)?'Use uma imagem em JPG, PNG ou WebP.':f.size>8*1024*1024?'A imagem passa de 8 MB. Escolha uma menor.':'';
function envioDeImagem(form,depois) {
  if(!form)return;
  const arquivo=form.elements.arquivo,previa=$('[data-previa]',form),nome=$('[data-previa-nome]',form),img=Object.assign(document.createElement('img'),{alt:''});
  previa.prepend(img);
  let url='';
  arquivo.addEventListener('change',()=>{
    limparErros(form);if(url)URL.revokeObjectURL(url);
    const f=arquivo.files[0];previa.hidden=true;if(!f)return;
    const problema=problemaImagem(f);if(problema)return mostrarErros(form,[{campo:'arquivo',mensagem:problema}]);
    url=URL.createObjectURL(f);img.src=url;
    nome.textContent=`${f.name} · ${(f.size/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;previa.hidden=false;
    form.elements.alt.focus();
  });
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    const f=arquivo.files[0],alt=form.elements.alt.value.trim(),erros=[];
    if(!f)erros.push({campo:'arquivo',mensagem:'Escolha a imagem.'});else if(problemaImagem(f))erros.push({campo:'arquivo',mensagem:problemaImagem(f)});
    if(alt.length<3)erros.push({campo:'alt',mensagem:'Descreva a imagem: o que aparece nela, em poucas palavras.'});
    if(erros.length)return mostrarErros(form,erros);
    const liberar=ocupar($('[type=submit]',form),'Enviando…');
    const r=await chamar('POST',`${API}/midia?${new URLSearchParams({alt})}`,f,{tipo:f.type});
    liberar();
    if(!r.ok)return falha(r,form);
    sujos.delete(form);form.reset();previa.hidden=true;
    depois(r.dados);
  });
}

// Editor de texto rico --------------------------------------------------------------------------------------------------

// O mesmo conjunto do saneamento do servidor (contrato 13.3): o resto vira texto. div vira parágrafo e h1, título de seção.
const PERMITIDAS={P:'p',DIV:'p',H1:'h2',H2:'h2',H3:'h3',H4:'h4',H5:'h4',H6:'h4',UL:'ul',OL:'ol',LI:'li',BLOCKQUOTE:'blockquote',STRONG:'strong',B:'strong',EM:'em',I:'em',A:'a',FIGURE:'figure',FIGCAPTION:'figcaption',BR:'br',IMG:'img'};
const BLOCOS=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','BLOCKQUOTE','FIGURE','TABLE']);
const IGNORAR=new Set(['SCRIPT','STYLE','TEMPLATE','IFRAME','OBJECT','EMBED','NOSCRIPT','META','LINK','TITLE']);
const linkOk=h=>/^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i.test(h);
const vazioHtml=h=>!h.replace(/<br>/g,'').replace(/&nbsp;| /g,'').trim()&&!h.includes('<img');
function limparNo(n) {
  if(n.nodeType===3)return escapar(n.nodeValue);
  if(n.nodeType!==1||IGNORAR.has(n.nodeName))return '';
  const tag=PERMITIDAS[n.nodeName];
  if(!tag)return limparFilhos(n);
  if(tag==='br')return '<br>';
  if(tag==='img'){const src=n.getAttribute('src')||'';return src?`<img src="${escapar(src)}" alt="${escapar(n.getAttribute('alt')||'')}">`:'';}
  const dentro=limparFilhos(n);
  if(tag==='a'){const h=(n.getAttribute('href')||'').trim();return linkOk(h)&&dentro?`<a href="${escapar(h)}">${dentro}</a>`:dentro;}
  if(vazioHtml(dentro))return '';
  return `<${tag}>${dentro}</${tag}>`;
}
const limparFilhos=n=>[...n.childNodes].map(limparNo).join('');
// Texto solto no primeiro nível entra num parágrafo.
function htmlLimpo(raiz) {
  let saida='',linha='';
  const fechar=()=>{if(!vazioHtml(linha))saida+=`<p>${linha.replace(/^(<br>)+|(<br>)+$/g,'')}</p>`;linha='';};
  for(const n of raiz.childNodes){if(n.nodeType===1&&BLOCOS.has(n.nodeName)){fechar();saida+=limparNo(n);}else linha+=limparNo(n);}
  fechar();
  return saida;
}
function ligarEditor(caixa) {
  const area=$('[data-area]',caixa),barra=$('[data-link-barra]',caixa),url=$('[data-link-url]',caixa);
  if(area.getAttribute('contenteditable')!=='true')return;
  let faixa=null;
  document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&area.contains(s.anchorNode))faixa=s.getRangeAt(0).cloneRange();});
  const voltar=()=>{area.focus();if(faixa){const s=getSelection();s.removeAllRanges();s.addRange(faixa);}};
  const fecharLink=()=>{barra.hidden=true;voltar();};
  const linkAtual=()=>{const s=getSelection();const no=s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement;return no?.closest?.('a')?.getAttribute('href')||'';};
  const aplicarLink=()=>{
    let h=url.value.trim();
    if(!h){url.focus();return;}
    if(!/^(https?:\/\/|\/|mailto:|tel:)/i.test(h))h=`https://${h}`;
    voltar();
    if(getSelection().isCollapsed)document.execCommand('insertHTML',false,`<a href="${escapar(h)}">${escapar(h)}</a>`);
    else document.execCommand('createLink',false,h);
    barra.hidden=true;anunciar('Link aplicado.');
  };
  try{document.execCommand('defaultParagraphSeparator',false,'p');}catch{/* navegador sem o comando */}
  $$('[data-cmd]',caixa).forEach(b=>{
    b.addEventListener('mousedown',ev=>ev.preventDefault());
    b.addEventListener('click',async()=>{
      const cmd=b.dataset.cmd;
      if(cmd==='link'){voltar();url.value=linkAtual();barra.hidden=false;url.focus();return;}
      if(cmd==='imagem'){
        const m=await escolherImagem();voltar();if(!m)return;
        document.execCommand('insertHTML',false,`<figure><img src="${escapar(m.url)}" alt="${escapar(m.alt||'')}"></figure><p><br></p>`);
        anunciar('Imagem inserida no texto.');return;
      }
      voltar();
      if(['h2','h3','p'].includes(cmd)){const agora=String(document.queryCommandValue('formatBlock')||'').toLowerCase();document.execCommand('formatBlock',false,agora===cmd&&cmd!=='p'?'<p>':`<${cmd}>`);}
      else document.execCommand({ul:'insertUnorderedList',ol:'insertOrderedList',b:'bold'}[cmd]);
    });
  });
  $('[data-link-aplicar]',caixa).addEventListener('click',aplicarLink);
  $('[data-link-tirar]',caixa).addEventListener('click',()=>{voltar();document.execCommand('unlink');barra.hidden=true;anunciar('Link tirado.');});
  $('[data-link-cancelar]',caixa).addEventListener('click',fecharLink);
  url.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();aplicarLink();}if(ev.key==='Escape'){ev.preventDefault();fecharLink();}});
  // Colar mantém só títulos, listas, negrito, links e imagens; texto puro vira parágrafos.
  area.addEventListener('paste',ev=>{
    ev.preventDefault();
    const html=ev.clipboardData.getData('text/html'),puro=ev.clipboardData.getData('text/plain');
    let limpo;
    if(html){const t=document.createElement('template');t.innerHTML=html;limpo=htmlLimpo(t.content);}
    else limpo=puro.split(/\n\s*\n/).filter(p=>p.trim()).map(p=>`<p>${escapar(p.trim()).replace(/\n/g,'<br>')}</p>`).join('');
    document.execCommand('insertHTML',false,limpo);
  });
  area.addEventListener('drop',ev=>{if(ev.dataTransfer?.files?.length)ev.preventDefault();});
  // Atalhos de teclado comuns, além dos botões.
  area.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();$('[data-cmd="link"]',caixa).click();}});
}
const htmlDoEditor=(f,nome)=>{const area=$(`[data-editor="${nome}"] [data-area]`,f);return area?htmlLimpo(area):undefined;};

// Campos de imagem e galeria ------------------------------------------------------------------------------------------

function ligarImagens(form) {
  $$('[data-imagem-campo]',form).forEach(c=>{
    const entrada=$('input[type=hidden]',c),previa=$('[data-imagem-previa]',c),botao=$('[data-escolher-imagem]',c),tirar=$('[data-tirar-imagem]',c);
    if(botao.disabled)return;
    const mostrar=url=>{
      entrada.value=url;
      previa.replaceChildren(url?Object.assign(document.createElement('img'),{src:url,alt:''}):texto('span','Nenhuma imagem'));
      tirar.hidden=!url;botao.textContent=url?'Trocar imagem':'Escolher na biblioteca';
      entrada.dispatchEvent(new Event('change',{bubbles:true}));
    };
    botao.addEventListener('click',async()=>{const m=await escolherImagem();botao.focus();if(m){mostrar(m.url);anunciar('Imagem escolhida.');}});
    tirar.addEventListener('click',()=>{mostrar('');botao.focus();anunciar('Imagem tirada.');});
  });
  const galeria=$('[data-galeria]',form);if(!galeria)return;
  const lista=$('[data-galeria-lista]',galeria),mais=$('[data-galeria-mais]',galeria);
  mais?.addEventListener('click',async()=>{
    if($$('li',lista).length>=12)return avisar('A galeria aceita até 12 fotos.',{erro:true});
    const m=await escolherImagem();mais.focus();if(!m)return;
    const li=document.createElement('li'),tirar=texto('button','','icon-button small');
    tirar.type='button';tirar.dataset.tirarGaleria='';tirar.setAttribute('aria-label','Tirar esta foto da galeria');tirar.innerHTML='<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>';
    li.append(Object.assign(document.createElement('img'),{src:m.tamanhos?.[320]||m.url,alt:''}),Object.assign(document.createElement('input'),{type:'hidden',value:m.url}),tirar);
    li.querySelector('input').dataset.galeriaUrl='';
    lista.append(li);anunciar('Foto adicionada à galeria.');
  });
  lista.addEventListener('click',ev=>{const b=ev.target.closest('[data-tirar-galeria]');if(!b)return;b.closest('li').remove();(mais||lista).focus?.();anunciar('Foto tirada da galeria.');});
}

// Banner: formatos aceitos pelo espaço, prévia no tamanho real e aviso de ocupação ---------------------------------------

// Classe de cada formato, como em api/views/componentes.mjs (sem "banner" nem "patrocinado").
const CLASSE_FORMATO={'link-patrocinado':'link',quadrado:'quadrado','super-banner':'faixa','ar-livre':'painel','meia-pagina':'meia','exibir-lateral':'coluna'};
const FORMATOS={'link-patrocinado':[320,100],quadrado:[250,250],'super-banner':[728,90],'ar-livre':[970,250],'meia-pagina':[300,600],'exibir-lateral':[160,600]};
function ligarBanner(form,id) {
  const esp=form.elements.espaco,fmt=form.elements.formato,previa=$('[data-previa]',form),saida=$('[data-ocupacao-aviso]',form);
  const lista=(o,k)=>(o?.dataset[k]||'').split(' ').filter(Boolean);
  const formatos=()=>{const o=esp.selectedOptions[0];return {pc:lista(o,'computador'),cel:lista(o,'celular')};};
  const ajustarFormatos=()=>{
    const {pc}=formatos();
    [...fmt.options].forEach(op=>{const ok=!pc.length||pc.includes(op.value);op.hidden=!ok;op.disabled=!ok;});
    if(fmt.selectedOptions[0]?.disabled)fmt.value=pc[0]||'';
  };
  const peca=(f,img)=>{
    const [w,h]=FORMATOS[f],div=document.createElement('div');div.className=`vitrine-piece is-${CLASSE_FORMATO[f]}`;
    const tag=texto('span','','vitrine-tag'),rotulo=texto('span','Publicidade'),por=texto('span',` · ${form.elements.anunciante.value.trim()||'Anunciante'}`,'vitrine-by');
    rotulo.append(por);tag.append(rotulo);
    const moldura=texto('span','','vitrine-frame');
    moldura.append(img?Object.assign(document.createElement('img'),{src:img,alt:'',width:w,height:h}):texto('span','Sem imagem','vitrine-empty'));
    div.append(tag,moldura);return div;
  };
  // Tamanho da imagem escolhida: outra proporção vira faixa no espaço; menor que o formato fica borrada.
  const medir=url=>new Promise(fim=>{if(!url)return fim(null);const i=new Image();i.addEventListener('load',()=>fim([i.naturalWidth,i.naturalHeight]));i.addEventListener('error',()=>fim(null));i.src=url;});
  const conferirTamanho=async(nome,fmt)=>{
    const aviso=$(`[data-campo="${nome}"] [data-imagem-aviso]`,form);if(!aviso)return;
    const t=FORMATOS[fmt]?await medir(form.elements[nome].value):null;
    if(!t){aviso.hidden=true;return;}
    const [w,h]=t,[W,H]=FORMATOS[fmt];
    aviso.textContent=Math.abs(w/h-W/H)/(W/H)>.08?`A imagem tem ${w} × ${h}, outra proporção: no formato ${W} × ${H} ela aparece menor, com faixas. Use ${W} × ${H} (ou ${W*2} × ${H*2}).`
      :w<W?`A imagem tem ${w} × ${h}, menor que ${W} × ${H}: pode aparecer borrada.`:'';
    aviso.hidden=!aviso.textContent;
  };
  const desenhar=()=>{
    const {cel}=formatos(),f=fmt.value||'super-banner',img=form.elements.imagem.value,imgCel=form.elements.imagemCelular.value;
    const m=imgCel&&cel[0]?cel[0]:cel.includes(f)?f:'';
    const [pc,celular]=$$('.preview-stage',previa);
    pc.replaceChildren(peca(f,img));
    celular.replaceChildren(m?peca(m,imgCel||img):texto('p','Este espaço não aparece no celular com este formato.','muted'));
    $('[data-previa-medida="computador"]',previa).textContent=`${FORMATOS[f][0]} × ${FORMATOS[f][1]} px`;
    $('[data-previa-medida="celular"]',previa).textContent=m?`${FORMATOS[m][0]} × ${FORMATOS[m][1]} px`:'não aparece';
    conferirTamanho('imagem',f);conferirTamanho('imagemCelular',cel[0]||'');
  };
  // Dias do período em que o espaço já tem todas as vagas vendidas (sem contar este banner).
  let pedido=0;
  const conferir=async()=>{
    const espaco=esp.value,de=form.elements.inicio.value,ate=form.elements.fim.value;
    if(!espaco||!de||!ate||ate<de||(Date.parse(ate)-Date.parse(de))/864e5>91){saida.hidden=true;return;}
    const n=++pedido,r=await api('GET',`${API}/banners/ocupacao?${new URLSearchParams({de,ate})}`,{csrf});
    if(n!==pedido||!r.ok)return;
    const s=(r.dados?.espacos||[]).find(x=>x.id===espaco);if(!s){saida.hidden=true;return;}
    const cheios=(s.dias||[]).filter(d=>d.livres<=0&&!(d.banners||[]).some(b=>b.id===id)).map(d=>data(d.dia));
    saida.textContent=cheios.length?`Atenção: o espaço já tem todas as vagas vendidas em ${cheios.length} ${cheios.length===1?'dia':'dias'} desse período (${cheios.slice(0,4).join(', ')}${cheios.length>4?'…':''}).`:'O espaço tem vaga em todos os dias desse período.';
    saida.classList.toggle('is-warning',cheios.length>0);saida.hidden=false;
  };
  if('novo' in form.dataset){const q=new URLSearchParams(location.search);if(q.get('espaco'))esp.value=q.get('espaco');if(/^\d{4}-\d{2}-\d{2}$/.test(q.get('inicio')||''))form.elements.inicio.value=q.get('inicio');}
  // Destino: com a empresa escolhida e o destino em branco (ou no perfil da empresa anterior), vai o perfil dela no guia.
  const empresa=form.elements.empresa,destino=form.elements.destino;
  let automatico=!destino.value||destino.value===`/comercio/${empresa.value}`;
  destino.addEventListener('input',()=>{automatico=false;});
  empresa.addEventListener('change',()=>{if(!automatico)return;destino.value=empresa.value?`/comercio/${empresa.value}`:'';if(empresa.value)anunciar('Destino: o perfil da empresa no guia.');});
  ajustarFormatos();desenhar();conferir();
  esp.addEventListener('change',()=>{ajustarFormatos();desenhar();conferir();});
  form.elements.inicio.addEventListener('change',conferir);form.elements.fim.addEventListener('change',conferir);
  form.addEventListener('change',ev=>{if(['formato','imagem','imagemCelular'].includes(ev.target.name))desenhar();});
  form.elements.anunciante.addEventListener('input',desenhar);
}

// Registros: empresa, conteúdo, evento, oferta, coleção e banner --------------------------------------------------------

const RECURSO={empresa:'empresas',conteudo:'conteudo',evento:'eventos',oferta:'ofertas',colecao:'colecoes',banner:'banners',pessoa:'pessoas'};
const MODULO={empresa:'empresas',conteudo:'conteudo',evento:'conteudo',oferta:'conteudo',colecao:'conteudo',banner:'banners',pessoa:'pessoas'};
const PUBLICAVEL=new Set(['empresa','conteudo','evento','oferta','banner']);
const LER={
  empresa:f=>({nome:valor(f,'nome'),...(f.elements.slug&&valor(f,'slug')?{slug:valor(f,'slug')}:{}),bairro:valor(f,'bairro'),cidade:valor(f,'cidade'),rua:valor(f,'rua'),cep:valor(f,'cep'),
    whatsapp:valor(f,'whatsapp'),telefone:valor(f,'telefone'),email:valor(f,'email'),site:valor(f,'site'),redes:lerRedes(f),horario:lerHorario(f),resumo:valor(f,'resumo'),descricao:valor(f,'descricao'),
    // Sem o campo (plano definido pela gestão, contrato 19.4), o plano não vai: mandar null tiraria o plano da empresa.
    categorias:marcados(f,'categorias'),...(f.elements.plano?{plano:nulo(valor(f,'plano'))}:{}),rede:nulo(valor(f,'rede')),destaque:f.elements.destaque.checked,imagem:valor(f,'imagem'),
    referencia:valor(f,'referencia'),pagamentos:marcados(f,'pagamentos')}),
  conteudo:f=>({titulo:valor(f,'titulo'),resumo:valor(f,'resumo'),html:htmlDoEditor(f,'html'),autor:valor(f,'autor'),data:nulo(valor(f,'data')),
    ...(f.dataset.tipo==='classificado'?{classificado:{preco:valor(f,'preco'),telefone:valor(f,'telefone'),empresa:nulo(valor(f,'empresa'))}}:{editorias:marcados(f,'editorias'),destaque:!!f.elements.destaque?.checked}),
    imagem:valor(f,'imagem'),galeria:$$('[data-galeria-url]',f).map(i=>i.value),fonte:valor(f,'fonte')}),
  evento:f=>({titulo:valor(f,'titulo'),descricao:htmlDoEditor(f,'descricao'),inicio:valor(f,'inicio'),fim:nulo(valor(f,'fim')),local:valor(f,'local'),endereco:valor(f,'endereco'),link:valor(f,'link'),empresa:nulo(valor(f,'empresa')),imagem:valor(f,'imagem')}),
  oferta:f=>{const modo=valor(f,'precoModo');return {...(f.elements.empresa?{empresa:valor(f,'empresa')}:{}),nome:valor(f,'nome'),descricao:valor(f,'descricao'),precoModo:modo,precoCentavos:modo==='consulta'?null:centavos(valor(f,'precoCentavos')),condicoes:valor(f,'condicoes'),validade:valor(f,'validade'),imagem:valor(f,'imagem')};},
  colecao:f=>({titulo:valor(f,'titulo'),subtitulo:valor(f,'subtitulo'),grupos:marcados(f,'grupos'),posicao:inteiro(f,'posicao',0),status:valor(f,'status')}),
  banner:f=>({titulo:valor(f,'titulo'),anunciante:valor(f,'anunciante'),empresa:nulo(valor(f,'empresa')),destino:valor(f,'destino'),espaco:valor(f,'espaco'),formato:valor(f,'formato'),peso:inteiro(f,'peso',1),inicio:valor(f,'inicio'),fim:valor(f,'fim'),imagem:valor(f,'imagem'),imagemCelular:valor(f,'imagemCelular')})
};
// Pessoa do Sobre nós (18.7): a foto vai como o id da imagem da biblioteca (o campo guarda a URL /midia/<id>/800.webp).
LER.pessoa=f=>({nome:valor(f,'nome'),funcao:valor(f,'funcao'),foto:(valor(f,'foto').match(/^\/midia\/([^/]+)\//)||[])[1]||null,ordem:inteiro(f,'ordem',0)});
const falta=(v,campo,mensagem)=>!v&&{campo,mensagem};
const VALIDAR={
  empresa:v=>[falta(v.nome,'nome','Dê o nome da empresa.'),v.email&&!emailOk(v.email)&&{campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio.'},
    v.site&&!/^https?:\/\/[^\s.]+\.\S+/.test(v.site)&&{campo:'site',mensagem:'Confira o site: ele precisa ter um domínio, como empresa.com.br.'},
    v.horario.some(h=>!h.abre||!h.fecha)&&{campo:'horario',mensagem:'Preencha a hora de abrir e a de fechar em cada horário.'},
    v.redes.some(r=>!/^https:\/\/[^\s.]+\.\S+/.test(r.url))&&{campo:'redes',mensagem:'Confira as redes: use o @ do perfil ou o link completo.'},
    v.rede==='__nova__'&&{campo:'rede',mensagem:'Crie a rede nova (botão “Criar a rede”) ou escolha uma da lista.'}],
  conteudo:v=>[falta(v.titulo,'titulo','Dê um título.')],
  evento:v=>[falta(v.titulo,'titulo','Dê o nome do evento.'),falta(v.inicio,'inicio','Informe quando o evento começa.'),v.fim&&v.inicio&&v.fim<v.inicio&&{campo:'fim',mensagem:'O fim vem depois do início.'}],
  oferta:v=>[v.empresa===''&&{campo:'empresa',mensagem:'Escolha a empresa da oferta.'},falta(v.nome,'nome','Dê um nome à oferta.'),Number.isNaN(v.precoCentavos)&&{campo:'precoCentavos',mensagem:'Use só números no valor, como 49,90.'},
    v.precoModo!=='consulta'&&v.precoCentavos===null&&{campo:'precoCentavos',mensagem:'Informe o valor ou escolha “Sob consulta”.'},falta(v.condicoes,'condicoes','Diga as condições: quando vale, para quem e os limites.'),falta(v.validade,'validade','Informe até quando a oferta vale.')],
  pessoa:v=>[falta(v.nome,'nome','Dê o nome da pessoa.'),(!Number.isInteger(v.ordem)||v.ordem<0||v.ordem>999)&&{campo:'ordem',mensagem:'Use um número inteiro de 0 a 999.'}],
  colecao:v=>[falta(v.titulo,'titulo','Dê um título à coleção.'),!v.grupos.length&&{campo:'grupos',mensagem:'Escolha pelo menos um grupo de categoria.'}],
  banner:v=>[falta(v.titulo,'titulo','Dê um nome ao banner.'),falta(v.anunciante,'anunciante','Informe o anunciante.'),falta(v.destino,'destino','Diga para onde o banner leva.'),falta(v.espaco,'espaco','Escolha o espaço.'),
    falta(v.inicio,'inicio','Informe o dia em que o banner entra no ar.'),falta(v.fim,'fim','Informe o último dia do banner no ar.'),v.inicio&&v.fim&&v.fim<v.inicio&&{campo:'fim',mensagem:'O último dia vem depois do início.'}]
};
const PRONTO={empresa:['Empresa publicada no guia.','Empresa salva.'],pessoa:['Pessoa salva.','Pessoa salva.'],conteudo:['Publicado no guia.','Salvo.'],evento:['Evento publicado.','Evento salvo.'],oferta:['Oferta publicada.','Oferta salva.'],colecao:['Coleção salva.','Coleção salva.'],banner:['Banner publicado: entra no ar no dia de início.','Banner salvo.']};

// Categoria e rede novas (v0.22.0, contrato 22.3 e 22.6) ------------------------------------------------------------------
// O nome igual nunca cria: a tela marca a categoria (ou escolhe a rede) que já existe. Com nomes parecidos, pergunta "Você
// quis dizer…?", com cada parecida, e deixa usar uma delas ou criar mesmo assim (confirmar: true).
const empresasN=n=>`${Number(n)||0} ${Number(n)===1?'empresa':'empresas'}`;
function perguntar(caixa,{titulo,itens,usar,criar,rotuloCriar}) {
  const lista=document.createElement('ul');lista.className='similar-list';
  for(const p of itens){
    const li=document.createElement('li');
    if(usar.acao){const b=texto('button',usar.rotulo(p),'link-button text-button');b.type='button';b.addEventListener('click',()=>usar.acao(p));li.append(b);}
    else li.append(texto('strong',usar.rotulo(p)));
    li.append(texto('small',usar.detalhe(p)));lista.append(li);
  }
  const mesmo=texto('button',rotuloCriar,'button secondary');mesmo.type='button';mesmo.addEventListener('click',criar);
  const acoes=document.createElement('div');acoes.className='panel-actions';acoes.append(mesmo);
  caixa.replaceChildren(texto('p',titulo,'similar-title'),lista,acoes);caixa.hidden=false;caixa.focus();
}
const dizer=(caixa,frase)=>{caixa.replaceChildren(texto('p',frase,'similar-title'));caixa.hidden=false;caixa.focus();};
function categoriaNova(form) {
  const caixa=$('[data-categoria-nova]',form);if(!caixa)return;
  const nome=form.elements.categoriaNova,grupo=form.elements.categoriaGrupo,aviso=$('[data-parecidas]',caixa),botao=$('[data-criar-categoria]',caixa);
  const contar=det=>{const n=$$('input[name="categorias"]:checked',det).length,s=$('summary',det);let t=$('.count-tag',s);if(!n)return t?.remove();if(!t){t=texto('span','','count-tag');s.append(' ',t);}t.textContent=String(n);};
  // Marca pelo nome; a categoria que acabou de ser criada entra no grupo dela. Sem caixa para marcar (um grupo, "Outra"), false.
  const marcar=(nomeCat,slug)=>{
    let c=$$('input[name="categorias"]',form).find(i=>i.value===nomeCat);
    const det=c?.closest('.category-group')||(slug&&$(`.category-group[data-grupo="${CSS.escape(slug)}"]`,form));
    if(!c){if(!det)return false;const rotulo=document.createElement('label');rotulo.className='toggle';c=Object.assign(document.createElement('input'),{type:'checkbox',name:'categorias',value:nomeCat});rotulo.append(c,texto('span',nomeCat));$('.check-options',det).append(rotulo);}
    c.checked=true;if(det){det.open=true;contar(det);}
    return true;
  };
  const criar=async(confirmar=false)=>{
    limparErros(form);
    const v={nome:nome.value.trim(),grupo:grupo.value};
    const erros=[v.nome.length<2&&{campo:'categoriaNova',mensagem:'Dê o nome da categoria, com pelo menos 2 letras.'},!v.grupo&&{campo:'categoriaGrupo',mensagem:'Escolha o grupo da categoria.'}].filter(Boolean);
    if(erros.length)return mostrarErros(form,erros);
    const liberar=ocupar(botao,'Criando…');
    const r=await chamar('POST',`${API}/categorias`,confirmar?{...v,confirmar:true}:v);
    liberar();
    if(r.ok){
      const nova=r.dados||{},rotuloGrupo=grupo.selectedOptions[0]?.textContent||'';
      marcar(nova.nome||v.nome,nova.grupos?.[0]?.slug||v.grupo);nome.value='';grupo.value='';
      return dizer(aviso,`Categoria “${nova.nome||v.nome}” criada em ${nova.grupos?.[0]?.label||rotuloGrupo} e marcada nesta empresa. Salve a empresa para ela valer aqui.`);
    }
    const igual=r.dados?.igual;
    if(igual)return dizer(aviso,marcar(igual.nome)?`${r.erro} Ela já foi marcada na lista.`:r.erro);
    if(r.dados?.parecidas?.length)return perguntar(aviso,{titulo:`Você quis dizer…? Há categorias parecidas com “${v.nome}”.`,itens:r.dados.parecidas,
      usar:{rotulo:p=>`Marcar ${p.nome}`,detalhe:p=>`${(p.grupos||[]).map(g=>g.label).join(', ')} · ${empresasN(p.empresas)} no guia`,acao:p=>{marcar(p.nome,p.grupos?.[0]?.slug);nome.value='';dizer(aviso,`“${p.nome}” foi marcada. Salve a empresa para valer.`);}},
      criar:()=>criar(true),rotuloCriar:`Criar “${v.nome}” mesmo assim`});
    if(r.status===422)return mostrarErros(form,[{campo:r.campo==='grupo'?'categoriaGrupo':'categoriaNova',mensagem:r.erro}]);
    falha(r);
  };
  botao.addEventListener('click',()=>criar());
  nome.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();criar();}});
}
function redeNova(form) {
  const sel=form.elements.rede,caixa=$('[data-rede-nova]',form);if(!sel||!caixa)return;
  const nome=form.elements.redeNova,aviso=$('[data-parecidas]',caixa),botao=$('[data-criar-rede]',caixa),nova=$('option[value="__nova__"]',sel),pronta=$('[data-rede-aviso]',form);
  sel.addEventListener('change',()=>{const abrir=sel.value==='__nova__';caixa.hidden=!abrir;if(abrir){aviso.hidden=true;pronta.hidden=true;nome.focus();}});
  // Escolhe a rede no select (a nova entra antes de "Outra rede…") e diz embaixo dele que a empresa ainda precisa ser salva.
  const escolher=(id,rotulo,frase)=>{
    if(![...sel.options].some(o=>o.value===id))sel.insertBefore(new Option(rotulo,id),nova);
    sel.value=id;caixa.hidden=true;nome.value='';aviso.hidden=true;
    pronta.textContent=frase;pronta.hidden=false;sel.focus();
  };
  const criar=async(confirmar=false)=>{
    limparErros(form);
    const v={nome:nome.value.trim()};
    if(v.nome.length<2)return mostrarErros(form,[{campo:'redeNova',mensagem:'Dê o nome da rede.'}]);
    const liberar=ocupar(botao,'Criando…');
    const r=await chamar('POST',`${API}/redes`,confirmar?{...v,confirmar:true}:v);
    liberar();
    if(r.ok)return escolher(r.dados?.id,r.dados?.nome||v.nome,`Rede “${r.dados?.nome||v.nome}” criada e escolhida. Salve a empresa para ela valer aqui.`);
    const igual=r.dados?.igual;
    if(igual?.id)return escolher(igual.id,igual.nome,`Já existe a rede “${igual.nome}”: ela foi escolhida. Salve a empresa para valer.`);
    if(r.dados?.parecidas?.length)return perguntar(aviso,{titulo:`Você quis dizer…? Há redes parecidas com “${v.nome}”.`,itens:r.dados.parecidas,
      usar:{rotulo:p=>`Escolher ${p.nome}`,detalhe:p=>`${empresasN(Array.isArray(p.empresas)?p.empresas.length:p.empresas)} no guia`,acao:p=>escolher(p.id,p.nome,`Rede “${p.nome}” escolhida. Salve a empresa para valer.`)},
      criar:()=>criar(true),rotuloCriar:`Criar “${v.nome}” mesmo assim`});
    if(r.status===422)return mostrarErros(form,[{campo:'redeNova',mensagem:r.erro}]);
    falha(r);
  };
  botao.addEventListener('click',()=>criar());
  nome.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();criar();}});
}

function registro() {
  const form=$('form.admin-form');if(!form)return;
  const tipo=form.dataset.form,novo='novo' in form.dataset,recurso=RECURSO[tipo];
  let id=form.dataset.id||'';
  $$('[data-editor]',form).forEach(ligarEditor);
  ligarImagens(form);
  if(tipo==='empresa'){ligarCampos(form,anunciar);categoriaNova(form);redeNova(form);}
  if(tipo==='banner')ligarBanner(form,id);
  if(tipo==='oferta'){const modo=form.elements.precoModo;modo.addEventListener('change',()=>{form.querySelector('.preco-valor').classList.toggle('is-hidden',modo.value==='consulta');});}
  const endereco=alvo=>{const t=tipo==='conteudo'?form.dataset.tipo:['evento','oferta','colecao'].includes(tipo)?tipo:'';return `/admin/${MODULO[tipo]}/${enc(alvo)}${t?`?tipo=${t}`:''}`;};
  let inicio=LER[tipo](form);
  const mudancas=()=>{const agora=LER[tipo](form),mudou={};for(const k of Object.keys(agora))if(JSON.stringify(agora[k])!==JSON.stringify(inicio[k]))mudou[k]=agora[k];return mudou;};
  addEventListener('beforeunload',ev=>{if(!saindo&&Object.keys(mudancas()).length)ev.preventDefault();});
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    if(tipo==='empresa')normalizar(form);
    const botao=ev.submitter||$('[type=submit]',form),publicar=botao?.dataset.depois==='publicar'&&PUBLICAVEL.has(tipo);
    const v=LER[tipo](form),erros=VALIDAR[tipo](v).filter(Boolean);
    if(erros.length)return mostrarErros(form,erros);
    let corpo=novo?v:mudancas();
    if(novo&&tipo==='conteudo')corpo={tipo:form.dataset.tipo,...corpo};
    if(!novo&&!Object.keys(corpo).length&&!publicar)return avisar('Nada mudou desde a última vez que você salvou.');
    const liberar=ocupar(botao,publicar?'Publicando…':'Salvando…');
    let atualVersao=versao(form.elements.version.value);
    if(novo||Object.keys(corpo).length){
      const r=await chamar(novo?'POST':'PATCH',novo?`${API}/${recurso}`:`${API}/${recurso}/${enc(id)}`,novo?corpo:{...corpo,version:atualVersao});
      if(!r.ok){liberar();return falha(r,form);}
      id=r.dados?.id||id;atualVersao=r.dados?.version??atualVersao;
      form.elements.version.value=atualVersao;inicio=LER[tipo](form);
    }
    if(publicar){
      const p=await chamar('POST',`${API}/${recurso}/${enc(id)}/publicar`,{version:atualVersao});
      if(!p.ok){
        // Criado e não publicado: o registro já existe, então a página passa a ser a dele, com o motivo.
        if(novo)return irPara(endereco(id),`Salvo como rascunho, mas não publicado: ${p.erro}`,true);
        liberar();return falha(p,form);
      }
    }
    if(novo)return irPara(endereco(id),PRONTO[tipo][publicar?0:1]);
    recarregar(publicar?PRONTO[tipo][0]:$('[data-acao-registro="pausar"]',form)?'Alterações salvas: já valem no guia.':PRONTO[tipo][1]);
  });
  $('[data-acao-registro="excluir"]',form)?.addEventListener('click',async ev=>{
    const b=ev.currentTarget;
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: excluir');
    const liberar=ocupar(b,'Excluindo…');
    const r=await chamar('DELETE',`${API}/${recurso}/${enc(id)}`);
    if(!r.ok){liberar();return falha(r);}
    saindo=true;irPara(`/admin/${MODULO[tipo]}`,'Pessoa excluída.');
  });
  $('[data-acao-registro="pausar"]',form)?.addEventListener('click',async ev=>{
    const b=ev.currentTarget;
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: tirar do ar');
    const liberar=ocupar(b,'Tirando do ar…');
    const r=await chamar('POST',`${API}/${recurso}/${enc(id)}/pausar`,{version:versao(form.elements.version.value)});
    if(!r.ok){liberar();return falha(r);}
    recarregar('Tirado do ar. Para voltar, use “Salvar e publicar de novo”.');
  });
}

// Formulários simples (redes, planos, solicitações e usuários) ----------------------------------------------

function simples(form,{metodo,url,ler,validar,pronto,depois}) {
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    const v=ler(form),erros=(validar?.(v)||[]).filter(Boolean);
    if(erros.length)return mostrarErros(form,erros);
    const botao=ev.submitter||$('[type=submit]',form),liberar=ocupar(botao,'Salvando…');
    const r=await chamar(metodo(form),url(form),v);
    if(!r.ok){liberar();return falha(r,form);}
    sujos.delete(form);
    if(depois)return depois(r,form,liberar);
    recarregar(typeof pronto==='function'?pronto(v):pronto);
  });
}
const comVersao=(f,v)=>'novo' in f.dataset?v:{...v,version:versao(f.elements.version.value)};
const metodoDe=f=>'novo' in f.dataset?'POST':'PATCH';

// Convite ou link de senha sem e-mail enviado: o link aparece para copiar ou mandar pelo WhatsApp.
const resultado=$('[data-link-resultado]');
function mostrarLink(frase,endereco,mensagem) {
  const link=new URL(endereco,location.origin).href;
  const copiar=texto('button','Copiar o link','button secondary');copiar.type='button';
  copiar.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);copiar.textContent='Link copiado';}catch{copiar.textContent='Selecione o link acima e copie';}});
  const zap=texto('a','Mandar pelo WhatsApp ↗','button');zap.href=`https://wa.me/?${new URLSearchParams({text:`${mensagem} ${link}`})}`;zap.target='_blank';zap.rel='noopener';
  const acoes=document.createElement('div');acoes.className='panel-actions';acoes.append(copiar,zap);
  resultado.replaceChildren(texto('p',frase),texto('code',link),acoes);
  resultado.hidden=false;resultado.focus();
}
const respostaDeLink=(email,{convite=true}={})=>(r,form,liberar)=>{
  liberar();form?.reset();
  const {link,enviado}=r.dados||{};
  if(enviado||!link)return convite?recarregar(`Convite enviado por e-mail para ${email}. O link vale 7 dias.`):avisar(`Link para criar a senha enviado por e-mail para ${email}.`);
  mostrarLink(convite?`O convite para ${email} está pronto, mas o e-mail não foi enviado: mande o link para a pessoa. Ele vale 7 dias e funciona uma vez só.`:`O link de senha de ${email} está pronto, mas o e-mail não foi enviado: mande o link para a pessoa. Ele funciona uma vez só.`,link,
    convite?'Olá! Este é o seu acesso ao Nexus:':'Olá! Use este link para criar a sua senha no Nexus:');
};

function formularios() {
  // Rede nova na aba Redes (22.6): o nome igual é recusado; com redes parecidas, a lista e o "Criar mesmo assim".
  $$('form[data-form="rede"]').forEach(f=>{
    const aviso=$('[data-parecidas]',f);
    const enviar=async(confirmar=false)=>{
      limparErros(f);
      const nome=valor(f,'nome');if(!nome)return mostrarErros(f,[{campo:'nome',mensagem:'Dê o nome da rede.'}]);
      const liberar=ocupar($('[type=submit]',f),'Criando…');
      const r=await chamar('POST',`${API}/redes`,confirmar?{nome,confirmar:true}:{nome});
      liberar();
      if(r.ok){sujos.delete(f);return recarregar(`Rede ${r.dados?.nome||nome} criada.`);}
      if(r.dados?.parecidas?.length&&aviso)return perguntar(aviso,{titulo:`Há redes parecidas com “${nome}”. Confira antes de criar.`,itens:r.dados.parecidas,
        usar:{rotulo:p=>p.nome,detalhe:p=>`${empresasN(Array.isArray(p.empresas)?p.empresas.length:p.empresas)} no guia`},criar:()=>enviar(true),rotuloCriar:`Criar “${nome}” mesmo assim`});
      falha(r,f);
    };
    f.addEventListener('submit',ev=>{ev.preventDefault();enviar();});
  });
  $$('form[data-form="plano"]').forEach(f=>simples(f,{metodo:metodoDe,url:f2=>'novo' in f2.dataset?`${API}/planos`:`${API}/planos/${enc(f2.dataset.id)}`,
    ler:f2=>comVersao(f2,{nome:valor(f2,'nome'),precoCentavos:centavos(valor(f2,'precoCentavos')),ordem:inteiro(f2,'ordem',0),patrocinado:f2.elements.patrocinado.checked,pago:f2.elements.pago.checked,status:valor(f2,'status')}),
    validar:v=>[falta(v.nome,'nome','Dê o nome do plano.'),(v.precoCentavos===null||Number.isNaN(v.precoCentavos))&&{campo:'precoCentavos',mensagem:'Informe o preço por mês, como 67,00.'}],pronto:'Plano salvo.'}));
  const solicitacao=raiz?.dataset.id;
  $$('form[data-form="mensagem"]').forEach(f=>simples(f,{metodo:()=>'POST',url:()=>`${API}/solicitacoes/${enc(solicitacao)}/mensagens`,ler:f2=>({texto:valor(f2,'texto')}),
    validar:v=>[falta(v.texto,'texto','Escreva a resposta.')],pronto:'Resposta enviada. A solicitação agora espera o associado.'}));
  $$('form[data-form="convite"]').forEach(f=>simples(f,{metodo:()=>'POST',url:()=>`${API}/usuarios/convite`,ler:f2=>({email:valor(f2,'email'),empresa:valor(f2,'empresa'),papel:valor(f2,'papel')}),
    validar:v=>[!emailOk(v.email)&&{campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio.'},falta(v.empresa,'empresa','Escolha a empresa.')],depois:(r,f2,l)=>respostaDeLink(f2.elements.email.value.trim())(r,f2,l)}));
  $$('form[data-form="equipe"]').forEach(f=>simples(f,{metodo:()=>'POST',url:()=>`${API}/equipe`,ler:f2=>({email:valor(f2,'email'),papel:valor(f2,'papel')}),
    validar:v=>[!emailOk(v.email)&&{campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio.'}],depois:(r,f2,l)=>respostaDeLink(f2.elements.email.value.trim())(r,f2,l)}));
  // Papel na equipe e situação da solicitação: o botão de salvar só aparece quando o valor muda.
  $$('form[data-form="papel-equipe"],form[data-form="status-solicitacao"]').forEach(f=>{
    const sel=$('select',f),salvar=$('[data-salvar-papel]',f);
    sel.addEventListener('change',()=>{salvar.hidden=sel.value===sel.dataset.papelAtual;});
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const liberar=ocupar(salvar,'Salvando…'),equipe=f.dataset.form==='papel-equipe';
      const r=equipe?await chamar('PATCH',`${API}/usuarios/${enc(f.dataset.usuario)}`,{equipe:sel.value,version:versao(f.dataset.version)})
        :await chamar('PATCH',`${API}/solicitacoes/${enc(solicitacao)}`,{status:sel.value,...(f.dataset.version?{version:versao(f.dataset.version)}:{})});
      if(!r.ok){liberar();return falha(r);}
      recarregar(equipe?'Papel na equipe alterado.':'Situação da solicitação alterada.');
    });
  });
  $$('[data-editar-linha]').forEach(b=>b.addEventListener('click',()=>{
    const linha=document.getElementById(b.getAttribute('aria-controls')),abrir=linha.hidden;
    linha.hidden=!abrir;b.setAttribute('aria-expanded',String(abrir));b.firstChild.textContent=abrir?'Fechar':'Editar';
    if(abrir)$('input:not([type=hidden]),select,textarea',linha)?.focus();
  }));
  $$('details.queue-refuse,details.item-new').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)$('input:not([type=hidden]),select,textarea',d)?.focus();}));
}

// Fila de aprovação -----------------------------------------------------------------------------------------------------

// Cupons (v0.14.0, 14.7): suspender com o motivo, que a empresa lê no painel, e reativar.
function cuponsDaEquipe() {
  $$('form[data-form="suspender"]').forEach(f=>f.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(f);
    const motivo=f.elements.motivo.value.trim();
    if(motivo.length<4)return mostrarErros(f,[{campo:'motivo',mensagem:'Diga à empresa por que o cupom foi suspenso (pelo menos 4 letras).'}]);
    const liberar=ocupar($('[type=submit]',f),'Suspendendo…');
    const r=await chamar('POST',`${API}/cupons/${enc(f.dataset.cupom)}/suspender`,{motivo,version:versao(f.dataset.version)});
    if(!r.ok){liberar();return falha(r,f);}
    sujos.delete(f);recarregar('Cupom suspenso. A empresa vê o motivo no painel.');
  }));
  $$('[data-reativar-cupom]').forEach(b=>b.addEventListener('click',async()=>{
    const liberar=ocupar(b,'Reativando…');
    const r=await chamar('POST',`${API}/cupons/${enc(b.dataset.reativarCupom)}/reativar`,{version:versao(b.dataset.version)});
    if(!r.ok){liberar();return falha(r);}
    recarregar('Cupom reativado.');
  }));
}

// Fila de aprovação: decidir no lugar. Aprovar e recusar esperam alguns segundos com "Desfazer" antes de ir ao servidor, e o
// foco passa ao próximo envio. Saindo da página antes disso, o pedido vai na hora (keepalive).
const ESPERA=6000,naFila=new Map();
addEventListener('pagehide',()=>{for(const {url,corpo} of naFila.values())fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(corpo),keepalive:true,credentials:'same-origin'});naFila.clear();});
function menosUmNaFila() {
  const n=$('.admin-nav a[href="/admin/fila"] .nav-count');
  if(n){const v=Number(n.firstChild.textContent)-1;if(v>0)n.firstChild.textContent=String(v);else n.remove();}
  const aba=$('.admin-tabs [aria-current]');
  if(aba)aba.textContent=aba.textContent.replace(/\s*\((\d+)\)/,(_,v)=>Number(v)>1?` (${Number(v)-1})`:'');
}
function decidir(cartao,{url,corpo,rotulo,ocupado,depois,link}) {
  const partes=[...cartao.children],assunto=$('h2',cartao).textContent;
  const linha=document.createElement('div');linha.className='queue-pending';
  const frase=texto('p',`${rotulo}: ${assunto}.`),desfazer=texto('button','Desfazer','button secondary');desfazer.type='button';
  linha.append(frase,desfazer);
  partes.forEach(p=>{p.hidden=true;});cartao.append(linha);cartao.classList.add('is-pending');
  const abertos=$$('.queue-item:not(.is-pending)'),seguinte=abertos.find(c=>cartao.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING);
  (seguinte||abertos[0]||desfazer).focus();
  anunciar(`${rotulo}: ${assunto}. Para desfazer, use o botão Desfazer no envio, nos próximos segundos.`);
  const voltar=()=>{linha.remove();partes.forEach(p=>{p.hidden=false;});cartao.classList.remove('is-pending');};
  const enviar=async()=>{
    naFila.delete(cartao.id);desfazer.remove();frase.textContent=`${ocupado}: ${assunto}…`;
    const r=await chamar('POST',url,corpo);
    if(!r.ok){voltar();cartao.focus();return falha(r);}
    frase.textContent=`${rotulo}: ${assunto}. ${depois}`;anunciar(frase.textContent);
    if(link){const a=texto('a','Ver no perfil ↗');a.href=link;a.target='_blank';a.rel='noopener';linha.append(a);}
    menosUmNaFila();
  };
  const espera=setTimeout(enviar,ESPERA);
  naFila.set(cartao.id,{url,corpo});
  desfazer.addEventListener('click',()=>{clearTimeout(espera);naFila.delete(cartao.id);voltar();cartao.focus();anunciar('Decisão desfeita: o envio continua esperando.');});
}
function filaDeAprovacao() {
  $$('[data-aprovar]').forEach(b=>b.addEventListener('click',()=>{
    decidir(b.closest('.queue-item'),{url:`${API}/fila/${enc(b.dataset.aprovar)}/aprovar`,corpo:{version:versao(b.dataset.version)},rotulo:'Aprovado',ocupado:'Aprovando',depois:'Já está no perfil da empresa.',link:b.dataset.perfil});
  }));
  // Categoria sugerida (22.5): aprovar cria com o nome e o grupo do formulário; trocar põe uma da lista, sem criar nada.
  $$('form[data-form="aprovar-categoria"]').forEach(f=>f.addEventListener('submit',ev=>{
    ev.preventDefault();limparErros(f);
    const nome=f.elements.nome.value.trim(),grupo=f.elements.grupo.value;
    const erros=[nome.length<2&&{campo:'nome',mensagem:'Dê o nome da categoria, com pelo menos 2 letras.'},!grupo&&{campo:'grupo',mensagem:'Escolha o grupo.'}].filter(Boolean);
    if(erros.length)return mostrarErros(f,erros);
    sujos.delete(f);
    decidir(f.closest('.queue-item'),{url:`${API}/fila/${enc(f.dataset.fila)}/aprovar`,corpo:{version:versao(f.dataset.version),nome,grupo},rotulo:'Aprovado',ocupado:'Aprovando',depois:`A categoria “${nome}” entrou na lista e na empresa.`});
  }));
  $$('form[data-form="trocar-categoria"]').forEach(f=>f.addEventListener('submit',ev=>{
    ev.preventDefault();limparErros(f);
    const categoria=f.elements.categoria.value;
    if(!categoria)return mostrarErros(f,[{campo:'categoria',mensagem:'Escolha a categoria da lista.'}]);
    sujos.delete(f);
    decidir(f.closest('.queue-item'),{url:`${API}/fila/${enc(f.dataset.fila)}/aprovar`,corpo:{version:versao(f.dataset.version),categoria},rotulo:'Trocado',ocupado:'Trocando',depois:`A empresa ficou com “${categoria}”, que já estava na lista.`});
  }));
  $$('form[data-form="recusa"]').forEach(f=>f.addEventListener('submit',ev=>{
    ev.preventDefault();limparErros(f);
    const comentario=f.elements.comentario.value.trim();
    if(comentario.length<5)return mostrarErros(f,[{campo:'comentario',mensagem:'Diga ao associado o que precisa mudar.'}]);
    sujos.delete(f);
    decidir(f.closest('.queue-item'),{url:`${API}/fila/${enc(f.dataset.fila)}/recusar`,corpo:{comentario,version:versao(f.dataset.version)},rotulo:'Recusado',ocupado:'Recusando',depois:'O associado vê o comentário no painel.'});
  }));
}

// Mídia ----------------------------------------------------------------------------------------------------------------

function midia() {
  envioDeImagem($('#enviar [data-envio-midia]'),()=>recarregar('Imagem enviada para a biblioteca.'));
  $$('form[data-form="alt"]').forEach(f=>{
    const campo=f.elements.alt,salvar=$('[data-salvar-alt]',f),antes=campo.value;if(!salvar)return;
    campo.addEventListener('input',()=>{salvar.hidden=campo.value.trim()===antes.trim();});
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();limparErros(f);
      const alt=campo.value.trim();if(alt.length<3)return mostrarErros(f,[{campo:'alt',mensagem:'Descreva a imagem em pelo menos 3 letras.'}]);
      const liberar=ocupar(salvar,'Salvando…');
      const r=await chamar('PATCH',`${API}/midia/${enc(f.dataset.midia)}`,{alt,version:versao(f.dataset.version)});
      if(!r.ok){liberar();return falha(r,f);}
      recarregar('Descrição salva.');
    });
  });
  $$('[data-excluir-midia]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar exclusão');
    const liberar=ocupar(b,'Excluindo…');
    const r=await chamar('DELETE',`${API}/midia/${enc(b.dataset.excluirMidia)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Imagem excluída da biblioteca.');
  }));
  $$('[data-copiar-url]').forEach(b=>b.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(new URL(b.dataset.copiarUrl,location.origin).href);b.textContent='Endereço copiado';}catch{b.textContent='Não deu para copiar';}
  }));
}

// Usuários -------------------------------------------------------------------------------------------------------------

function usuarios() {
  $$('[data-link-senha]').forEach(b=>b.addEventListener('click',async()=>{
    const liberar=ocupar(b,'Gerando…');
    const r=await chamar('POST',`${API}/usuarios/${enc(b.dataset.linkSenha)}/link-senha`);
    if(!r.ok){liberar();return falha(r);}
    respostaDeLink(b.dataset.email,{convite:false})(r,null,liberar);
  }));
  $$('[data-encerrar]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: encerrar sessões');
    const liberar=ocupar(b,'Encerrando…');
    const r=await chamar('POST',`${API}/usuarios/${enc(b.dataset.encerrar)}/sessoes/encerrar`);
    liberar();if(!r.ok)return falha(r);
    delete b.dataset.confirmar;avisar('Sessões encerradas: a pessoa precisa entrar de novo.');
  }));
  $$('[data-desativar]').forEach(b=>b.addEventListener('click',async()=>{
    const desativar=b.dataset.valor==='true';
    if(desativar&&!b.dataset.confirmar)return confirmar(b,'Confirmar: desativar');
    const liberar=ocupar(b,desativar?'Desativando…':'Reativando…');
    const r=await chamar('PATCH',`${API}/usuarios/${enc(b.dataset.desativar)}`,{desativado:desativar,version:versao(b.dataset.version)});
    if(!r.ok){liberar();return falha(r);}
    recarregar(desativar?'Conta desativada e sessões encerradas.':'Conta reativada.');
  }));
  $$('[data-revogar]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: tirar acesso');
    const liberar=ocupar(b,'Tirando…');
    const r=await chamar('DELETE',`${API}/usuarios/${enc(b.dataset.revogar)}/acessos/${enc(b.dataset.empresa)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Acesso tirado.');
  }));
}

// Acessos ao painel (v0.21.0, contrato 21.3) ----------------------------------------------------------------------------
// O convite e o reenvio sem e-mail mostram o link no próprio cartão da empresa, com o "Enviar pelo WhatsApp" (o WhatsApp da
// empresa, com a mensagem pronta) e o "Copiar o link". O link é uma credencial: não fica guardado e some ao sair da página.
const diaSP=v=>{const d=new Date(v||'');return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});};
function linkDoConvite(caixa,dados,{email,reenvio=false}) {
  const {link,whatsapp,expira}=dados||{},ate=diaSP(expira);
  const codigo=texto('code',link);
  const copiar=texto('button','Copiar o link','button secondary');copiar.type='button';
  copiar.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(link);copiar.textContent='Link copiado';anunciar('Link do convite copiado.');}
    catch{getSelection().selectAllChildren(codigo);copiar.textContent='Selecione o link acima e copie';anunciar('Não deu para copiar: o link está selecionado.');}
  });
  const acoes=document.createElement('div');acoes.className='panel-actions';
  if(whatsapp){const zap=texto('a','Enviar pelo WhatsApp ↗','button is-whatsapp');zap.href=whatsapp;zap.target='_blank';zap.rel='noopener';zap.append(texto('span',' (abre em outra aba)','sr-only'));acoes.append(zap);}
  const atualizar=texto('button','Atualizar a lista','link-button text-button');atualizar.type='button';atualizar.addEventListener('click',()=>location.reload());
  acoes.append(copiar,atualizar);
  const frase=texto('p',`${reenvio?'O convite foi reenviado':'O convite está pronto'} para ${email}, mas o e-mail não foi enviado: mande o link para a pessoa.`);
  const prazo=texto('p',`O link vale 7 dias${ate?` (até ${ate})`:''} e funciona uma vez só. Ele não fica guardado: some quando você sair desta página.`,'invite-terms');
  const semZap=whatsapp?[]:[texto('p','A empresa não tem WhatsApp no perfil: copie o link e mande por outro caminho.','invite-warning')];
  caixa.replaceChildren(frase,prazo,codigo,...semZap,acoes);
  caixa.hidden=false;caixa.focus();
}
function acessosPainel() {
  $$('form[data-form="acesso-convite"]').forEach(f=>f.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(f);
    const email=valor(f,'email'),papel=valor(f,'papel');
    if(!emailOk(email))return mostrarErros(f,[{campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio.'}]);
    const liberar=ocupar($('[type=submit]',f),'Convidando…');
    const r=await chamar('POST',`${API}/usuarios/convite`,{email,empresa:f.dataset.empresa,papel});
    liberar();
    if(!r.ok)return falha(r,f);
    sujos.delete(f);
    const {link,enviado,ativo}=r.dados||{};
    if(ativo)return recarregar(`${email} já tinha conta: o acesso a ${f.dataset.nome} já está liberado.`);
    if(enviado)return recarregar(`Convite enviado por e-mail para ${email}. O link vale 7 dias e funciona uma vez só.`);
    if(!link)return recarregar(`Convite para ${email} criado.`);
    f.closest('details').open=false;
    linkDoConvite($('[data-acesso-resultado]',f.closest('.access-item')),r.dados,{email});
  }));
  // Reenviar (o link anterior deixa de valer) e cancelar (com a confirmação no próprio botão): as rotas do painel (12.6).
  $$('[data-reenviar-convite],[data-cancelar-convite]').forEach(b=>b.addEventListener('click',async()=>{
    const cancelar='cancelarConvite' in b.dataset,email=cancelar?b.dataset.cancelarConvite:b.dataset.reenviarConvite;
    if(cancelar&&!b.dataset.confirmar)return confirmar(b,'Confirmar: cancelar');
    const liberar=ocupar(b,cancelar?'Cancelando…':'Reenviando…');
    const r=await chamar('POST',`/api/painel/empresas/${enc(b.dataset.empresa)}/acessos/convites/${cancelar?'cancelar':'reenviar'}`,{email});
    liberar();
    if(!r.ok)return falha(r);
    if(cancelar)return recarregar(`Convite de ${email} cancelado: o link dele não vale mais.`);
    if(r.dados?.enviado||!r.dados?.link)return recarregar(`Convite reenviado por e-mail para ${email}. O link novo vale 7 dias e funciona uma vez só.`);
    linkDoConvite($('[data-acesso-resultado]',b.closest('.access-item')),r.dados,{email,reenvio:true});
  }));
}

if(raiz){registro();formularios();filaDeAprovacao();cuponsDaEquipe();midia();usuarios();acessosPainel();}
