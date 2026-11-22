// Painel do anunciante (Fase 3, contrato 12.4). As escritas levam o X-CSRF-Token de data-csrf; quando dão certo, a página recarrega
// com o estado do servidor e a confirmação no topo. 401 volta para /entrar, 409 pede recarregar e 422 marca o campo.
import { $, $$, api, emailOk, limparErros, mostrarErros, ocupar } from './formulario.js';

const painel=$('[data-painel]');
const csrf=painel?.dataset.csrf||'',empresa=painel?.dataset.empresa||'';
const base=`/api/painel/empresas/${encodeURIComponent(empresa)}`;
const CHAVE='nexus-painel-aviso';
const versao=v=>/^\d+$/.test(v)?Number(v):v;
const texto=(tag,conteudo,cls)=>Object.assign(document.createElement(tag),{textContent:conteudo,...(cls?{className:cls}:{})});
const hoje=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
let saindo=false;

// Confirmação no topo do módulo (role="status"), com o botão de recarregar quando a informação mudou noutro lugar.
const aviso=$('[data-painel-aviso]');
function avisar(mensagem,{erro=false,recarregar=false}={}) {
  if(!aviso)return;
  aviso.className=`panel-flash${erro?' is-error':''}`;
  aviso.replaceChildren(texto('span',mensagem));
  if(recarregar){const b=texto('button','Recarregar','button secondary');b.type='button';b.addEventListener('click',()=>location.reload());aviso.append(b);}
  aviso.hidden=false;aviso.focus();
}
// Recarrega sem os atalhos da URL (?novo=, ?nova=), para o formulário não abrir de novo depois de salvo.
function recarregar(mensagem) {
  saindo=true;
  try{sessionStorage.setItem(CHAVE,mensagem);}catch{/* sem armazenamento: recarrega sem o aviso */}
  const url=new URL(location.href);url.searchParams.delete('novo');url.searchParams.delete('nova');url.hash='';
  if(url.href===location.href.replace(/#.*$/,''))location.reload();else location.assign(url.href);
}
try{const guardado=sessionStorage.getItem(CHAVE);if(guardado){sessionStorage.removeItem(CHAVE);avisar(guardado);}}catch{/* idem */}

async function chamar(metodo,url,corpo,extra={}) {
  const r=await api(metodo,url,{corpo,csrf,...extra});
  if(r.status===401){saindo=true;location.assign(`/entrar?${new URLSearchParams({next:location.pathname,motivo:'expirou'})}`);return new Promise(()=>{});}
  return r;
}
function falha(r,form) {
  if(r.status===409)return avisar(r.erro,{erro:true,recarregar:true});
  if(form&&r.status===422)return mostrarErros(form,[{campo:r.campo,mensagem:r.erro}]);
  if(form&&$('.form-errors',form))return mostrarErros(form,[{campo:'',mensagem:r.erro}]);
  avisar(r.erro,{erro:true});
}
// Anúncio curto para leitor de tela, sem tirar o foco de onde a pessoa está.
const anuncio=$('[data-painel-anuncio]');
const anunciar=t=>{if(!anuncio)return;anuncio.textContent='';setTimeout(()=>{anuncio.textContent=t;},50);};
// Ação que apaga ou encerra: o primeiro toque pede a confirmação no próprio botão (o texto para leitor de tela, como "de João
// Lima", continua), e o botão volta ao normal quando o foco sai dele. Sem prazo para responder.
function confirmar(botao,rotulo) {
  const antes=botao.innerHTML,contexto=[...botao.querySelectorAll('.sr-only')].map(s=>s.cloneNode(true));
  botao.dataset.confirmar='1';botao.replaceChildren(texto('span',rotulo),...contexto);
  anunciar(`${rotulo}. Toque de novo para confirmar.`);
  botao.addEventListener('blur',()=>{if(botao.isConnected&&botao.dataset.confirmar){delete botao.dataset.confirmar;botao.innerHTML=antes;}},{once:true});
}
// Formulário começado e não enviado: avisa antes de sair da página (o perfil tem a própria conferência).
const sujos=new Set();
document.addEventListener('input',ev=>{const f=ev.target.closest('form[data-form]');if(f&&!['perfil','papel'].includes(f.dataset.form))sujos.add(f);});
addEventListener('beforeunload',ev=>{if(!saindo&&sujos.size)ev.preventDefault();});

// Módulos no celular: a faixa rola até o módulo aberto.
const atual=$('.panel-nav [aria-current]');
if(atual&&matchMedia('(max-width: 1050px)').matches){const faixa=atual.closest('.panel-nav'),a=atual.getBoundingClientRect(),f=faixa.getBoundingClientRect();faixa.scrollLeft+=a.left-f.left-(f.width-a.width)/2;}

// Seletor de empresa: fecha com Esc (o foco volta ao seletor) e com um toque fora dele.
const troca=$('.company-switch');
if(troca){
  troca.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&troca.open){troca.open=false;troca.querySelector('summary').focus();}});
  document.addEventListener('click',ev=>{if(troca.open&&!troca.contains(ev.target))troca.open=false;});
}

// Minha assinatura: copiar a chave Pix. Sem acesso à área de transferência, a chave fica selecionada para copiar à mão.
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-copiar-pix]');if(!b)return;
  const rotulo=b.querySelector('span'),chave=b.closest('.pix-key')?.querySelector('code');
  try{await navigator.clipboard.writeText(b.dataset.copiarPix);rotulo.textContent='Chave copiada';anunciar('Chave Pix copiada.');}
  catch{if(chave)getSelection().selectAllChildren(chave);rotulo.textContent='Selecione a chave e copie';anunciar('Não deu para copiar. A chave Pix está selecionada.');}
  setTimeout(()=>{rotulo.textContent='Copiar a chave';},4000);
});

// Relatório do mês: o "Imprimir" (o navegador também salva em PDF) só aparece com o JavaScript. A troca de mês fecha com Esc
// (o foco volta ao botão) e com um toque fora dela, como o seletor de empresa.
const imprimir=$('[data-imprimir]');
if(imprimir){imprimir.hidden=false;imprimir.addEventListener('click',()=>print());}
const meses=$('.report-switch');
if(meses){
  meses.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&meses.open){meses.open=false;meses.querySelector('summary').focus();}});
  document.addEventListener('click',ev=>{if(meses.open&&!meses.contains(ev.target))meses.open=false;});
}

$('[data-sair]')?.addEventListener('click',async ev=>{
  ocupar(ev.currentTarget,'Saindo…');saindo=true;
  await api('POST','/api/auth/logout',{csrf});
  location.assign('/entrar?motivo=saiu');
});

// Minha empresa: horário (vários intervalos por dia), contatos, redes e textos num PATCH só com o que mudou.
function perfil() {
  const form=$('[data-form="perfil"]');if(!form)return;
  const modeloIntervalo=$('[data-modelo-intervalo]',form),modeloRede=$('[data-modelo-rede]',form);
  const novoIntervalo=dia=>{
    const nome=$(`#dia-${dia}`,form).textContent,n=modeloIntervalo.content.firstElementChild.cloneNode(true);
    $$('.sr-only',n).forEach((s,i)=>{s.textContent=`${nome}, ${i?'fecha':'abre'} às`;});
    n.querySelector('[data-tirar-intervalo]').setAttribute('aria-label',`Tirar este horário de ${nome.toLowerCase()}`);
    return n;
  };
  form.addEventListener('click',ev=>{
    const mais=ev.target.closest('[data-mais-intervalo]');
    if(mais){const dia=mais.closest('[data-dia]'),n=novoIntervalo(dia.dataset.dia);$('[data-intervalos]',dia).append(n);n.querySelector('input').focus();return;}
    const tirar=ev.target.closest('[data-tirar-intervalo]');
    if(tirar){const dia=tirar.closest('[data-dia]');tirar.closest('.hours-interval').remove();if(!$('.hours-interval',dia)){$('[data-aberto]',dia).checked=false;$('[data-mais-intervalo]',dia).hidden=true;$('[data-aberto]',dia).focus();}else $('[data-mais-intervalo]',dia).focus();return;}
    if(ev.target.closest('[data-mais-rede]')){const n=modeloRede.content.firstElementChild.cloneNode(true),total=$$('.social-row',form).length;$$('.sr-only',n).forEach((s,i)=>{s.textContent=i?`Endereço da rede ${total+1}`:`Rede ${total+1}`;});$('[data-redes]',form).append(n);n.querySelector('select').focus();return;}
    const tirarRede=ev.target.closest('[data-tirar-rede]');
    if(tirarRede){tirarRede.closest('.social-row').remove();$('[data-mais-rede]',form).focus();return;}
    // O caso mais comum: o mesmo horário de segunda a sexta.
    if(ev.target.closest('[data-copiar-segunda]')){
      const segunda=$('[data-dia="1"]',form),aberto=$('[data-aberto]',segunda).checked,faixas=$$('.hours-interval',segunda).map(iv=>[$('[data-abre]',iv).value,$('[data-fecha]',iv).value]);
      for(const d of [2,3,4,5]){
        const dia=$(`[data-dia="${d}"]`,form),lista=$('[data-intervalos]',dia);
        $('[data-aberto]',dia).checked=aberto;$('[data-mais-intervalo]',dia).hidden=!aberto;
        lista.replaceChildren(...faixas.map(([abre,fecha])=>{const n=novoIntervalo(d);$('[data-abre]',n).value=abre;$('[data-fecha]',n).value=fecha;return n;}));
      }
      anunciar(aberto?'Horário de segunda repetido de terça a sexta.':'Terça a sexta marcadas como fechadas, como a segunda.');
    }
  });
  // "@suaempresa" ou "suaempresa.com.br" viram o endereço completo antes de salvar; o campo mostra o resultado.
  const PERFIS={Instagram:'https://instagram.com/',Facebook:'https://facebook.com/',TikTok:'https://tiktok.com/@',YouTube:'https://youtube.com/@',X:'https://x.com/',Kwai:'https://kwai.com/@',Pinterest:'https://pinterest.com/'};
  const endereco=(v,rede)=>{
    v=v.trim();if(!v)return '';
    if(/^@?[\w.]+$/.test(v)&&!v.includes('.')||/^@[\w.]+$/.test(v))return PERFIS[rede]?PERFIS[rede]+v.replace(/^@/,''):v;
    return /^https?:\/\//i.test(v)?v.replace(/^http:\/\//i,'https://'):`https://${v.replace(/^\/+/,'')}`;
  };
  form.addEventListener('change',ev=>{
    if(ev.target.matches('[data-url]'))ev.target.value=endereco(ev.target.value,$('[data-rede]',ev.target.closest('.social-row')).value);
    if(ev.target.name==='site'&&ev.target.value.trim())ev.target.value=endereco(ev.target.value,'');
  });
  form.addEventListener('change',ev=>{
    const aberto=ev.target.closest('[data-aberto]');if(!aberto)return;
    const dia=aberto.closest('[data-dia]');
    $('[data-mais-intervalo]',dia).hidden=!aberto.checked;
    if(aberto.checked&&!$('.hours-interval',dia))$('[data-intervalos]',dia).append(novoIntervalo(dia.dataset.dia));
  });
  const valores=()=>{
    const horario=[];
    $$('[data-dia]',form).forEach(d=>{if(!$('[data-aberto]',d).checked)return;$$('.hours-interval',d).forEach(iv=>{const fecha=$('[data-fecha]',iv).value;horario.push({dia:Number(d.dataset.dia),abre:$('[data-abre]',iv).value,fecha:fecha==='00:00'?'24:00':fecha});});});
    const redes=$$('.social-row',form).map(r=>({rede:$('[data-rede]',r).value,url:$('[data-url]',r).value.trim()})).filter(r=>r.url);
    const v=n=>form.elements[n].value.trim();
    // Nome, endereço, categorias e foto principal (v0.14.0, 14.5), quando a tela traz esses campos.
    const empresaDados=form.elements.nome?{nome:v('nome'),rua:v('rua'),bairro:v('bairro'),cidade:v('cidade'),cep:v('cep'),
      categorias:$$('input[name="categorias"]',form).filter(c=>c.checked).map(c=>c.value),imagem:$('input[name="imagem"]:checked',form)?.value??'',
      // v0.17.0 (18.4): ponto de referência e formas de pagamento, na ordem da lista.
      ...(form.elements.referencia?{referencia:v('referencia'),pagamentos:$$('input[name="pagamentos"]',form).filter(c=>c.checked).map(c=>c.value)}:{})}:{};
    // v0.22.0 (22.4): a categoria sugerida vai no PATCH só quando o nome foi escrito.
    const sugestao=form.elements.sugestaoNome&&v('sugestaoNome')?{sugestaoCategoria:{nome:v('sugestaoNome'),grupo:form.elements.sugestaoGrupo.value}}:{};
    return {...empresaDados,horario,telefone:v('telefone'),whatsapp:v('whatsapp'),email:v('email'),site:v('site'),redes,resumo:v('resumo'),descricao:v('descricao'),...sugestao};
  };
  const inicio=valores();
  const mudancas=()=>{const atual=valores(),mudou={};for(const k of Object.keys(atual))if(JSON.stringify(atual[k])!==JSON.stringify(inicio[k]))mudou[k]=atual[k];return mudou;};
  addEventListener('beforeunload',ev=>{if(!saindo&&Object.keys(mudancas()).length)ev.preventDefault();});
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    $$('[data-url]',form).forEach(i=>{i.value=endereco(i.value,$('[data-rede]',i.closest('.social-row')).value);});
    if(form.elements.site.value.trim())form.elements.site.value=endereco(form.elements.site.value,'');
    const mudou=mudancas();
    if(!Object.keys(mudou).length)return avisar('Nada mudou desde a última vez que você salvou.');
    const erros=[];
    if((mudou.horario||[]).some(h=>!h.abre||!h.fecha))erros.push({campo:'horario',mensagem:'Preencha a hora de abrir e a de fechar em cada horário.'});
    if(mudou.email&&!emailOk(mudou.email))erros.push({campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio.'});
    if(mudou.site&&!/^https?:\/\/[^\s.]+\.\S+/.test(mudou.site))erros.push({campo:'site',mensagem:'Confira o site: ele precisa ter um domínio, como suaempresa.com.br.'});
    if((mudou.redes||[]).some(r=>!/^https:\/\/[^\s.]+\.\S+/.test(r.url)))erros.push({campo:'redes',mensagem:'Confira as redes: use o @ do perfil (como @suaempresa) ou o link completo.'});
    if(mudou.nome!==undefined&&mudou.nome.length<2)erros.push({campo:'nome',mensagem:'Informe o nome da empresa.'});
    if(mudou.cep&&!/^\d{5}-?\d{3}$/.test(mudou.cep))erros.push({campo:'cep',mensagem:'Confira o CEP: são 8 números, como 26000-000.'});
    if(mudou.categorias&&mudou.categorias.length>8)erros.push({campo:'categorias',mensagem:`Marque até 8 categorias (agora são ${mudou.categorias.length}).`});
    if(mudou.categorias&&!mudou.categorias.length&&'publicada' in form.dataset)erros.push({campo:'categorias',mensagem:'A empresa no guia precisa de pelo menos uma categoria.'});
    const sug=mudou.sugestaoCategoria;
    if(sug&&(sug.nome.length<2||sug.nome.length>60))erros.push({campo:'sugestaoNome',mensagem:'Dê o nome da categoria, de 2 a 60 letras.'});
    if(sug&&!sug.grupo)erros.push({campo:'sugestaoGrupo',mensagem:'Escolha o grupo da categoria.'});
    if(erros.length)return mostrarErros(form,erros);
    const liberar=ocupar(form.querySelector('[type=submit]'),'Salvando…');
    const r=await chamar('PATCH',base,{...mudou,version:versao(form.elements.version.value)});
    if(!r.ok){
      liberar();
      // A categoria sugerida já está na lista: ela fica marcada, e a sugestão sai do formulário.
      const igual=r.dados?.igual?.nome,caixa=igual&&$$('input[name="categorias"]',form).find(c=>c.value===igual);
      if(caixa){caixa.checked=true;caixa.closest('details').open=true;form.elements.sugestaoNome.value='';return mostrarErros(form,[{campo:'sugestaoCategoria',mensagem:`${r.erro} Ela já foi marcada: salve de novo.`}]);}
      return falha(r,form);
    }
    const {publicado=[],emAnalise=[]}=r.dados||{},textos=emAnalise.filter(x=>x!=='sugestaoCategoria');
    const fila=sug?' A categoria sugerida foi para a aprovação do Nexus: até lá, a empresa continua nas categorias marcadas.':'';
    recarregar(publicado.length&&textos.length?`Salvo. O que mudou já está no guia; os textos foram para a aprovação do Nexus.${fila}`
      :textos.length?`Salvo. Os textos foram para a aprovação do Nexus: até lá, o público vê a versão anterior.${fila}`
      :publicado.length||!sug?`Salvo. As mudanças já aparecem no seu perfil no guia.${fila}`:`Salvo.${fila}`);
  });
  // Retirar a sugestão pendente (sugestaoCategoria: null): sai da fila do Nexus.
  $('[data-retirar-sugestao]',form)?.addEventListener('click',async ev=>{
    const liberar=ocupar(ev.currentTarget,'Retirando…');
    const r=await chamar('PATCH',base,{sugestaoCategoria:null,version:versao(form.elements.version.value)});
    if(!r.ok){liberar();return falha(r,form);}
    recarregar('Sugestão de categoria retirada.');
  });
}

// Fotos: prévia antes do envio, corpo binário com o tipo real e ?alt=; excluir com confirmação.
const problemaFoto=f=>!['image/jpeg','image/png','image/webp'].includes(f.type)?'Use uma foto em JPG, PNG ou WebP.':f.size>8*1024*1024?'A foto passa de 8 MB. Escolha uma menor.':'';
function fotos() {
  $$('[data-excluir-foto]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar exclusão');
    const liberar=ocupar(b,'Excluindo…');
    const r=await chamar('DELETE',`${base}/fotos/${encodeURIComponent(b.dataset.excluirFoto)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Foto excluída.');
  }));
  const form=$('[data-form="foto"]');if(!form)return;
  // A prévia (blob: liberado no img-src da CSP) só ganha a imagem quando a pessoa escolhe a foto.
  const arquivo=form.elements.arquivo,previa=$('[data-previa]',form),nome=$('[data-previa-nome]',form),img=Object.assign(document.createElement('img'),{alt:''});
  previa.prepend(img);
  let url='';
  arquivo.addEventListener('change',()=>{
    limparErros(form);if(url)URL.revokeObjectURL(url);
    const f=arquivo.files[0];previa.hidden=true;if(!f)return;
    const problema=problemaFoto(f);if(problema)return mostrarErros(form,[{campo:'arquivo',mensagem:problema}]);
    url=URL.createObjectURL(f);img.src=url;
    nome.textContent=`${f.name} · ${(f.size/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;previa.hidden=false;
  });
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    const f=arquivo.files[0],problema=!f?'Escolha uma foto.':problemaFoto(f);
    if(problema)return mostrarErros(form,[{campo:'arquivo',mensagem:problema}]);
    const alt=form.elements.alt.value.trim();
    const liberar=ocupar(form.querySelector('[type=submit]'),'Enviando…');
    const r=await chamar('POST',`${base}/fotos${alt?`?${new URLSearchParams({alt})}`:''}`,f,{tipo:f.type});
    if(!r.ok){liberar();return falha(r,form);}
    recarregar('Foto enviada. Ela aparece no perfil depois da aprovação do Nexus.');
  });
}

// Produtos e serviços: novo item (também pelo "Criar meu anúncio", com tipo oferta), edição, envio, pausa e reativação.
const centavos=t=>{if(!t)return null;const n=Number(t.replace(/[^\d,.]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN;};
function catalogo() {
  $$('.item-new input[type=date], .item-edit input[type=date]').forEach(i=>{i.min=hoje();});
  document.addEventListener('change',ev=>{
    const f=ev.target.closest('.item-new form, .item-edit form');if(!f)return;
    if(ev.target.matches('[data-tipo]')){
      $('[data-oferta]',f).classList.toggle('is-hidden',ev.target.value!=='oferta');
      const titulo=$('[data-titulo-item]',f);if(titulo)titulo.textContent={produto:'Novo produto',servico:'Novo serviço',oferta:'Nova oferta'}[ev.target.value]||'Novo item';
    }
    if(ev.target.matches('[data-preco-modo]'))$('.preco-valor',f).classList.toggle('is-hidden',ev.target.value==='consulta');
  });
  const novo=$('#novo-item'),pedido=new URLSearchParams(location.search).get('novo');
  if(novo&&(pedido||location.hash==='#novo-item')){
    novo.open=true;
    if(pedido==='oferta'){const tipo=$('[data-tipo]',novo);tipo.value='oferta';tipo.dispatchEvent(new Event('change',{bubbles:true}));}
    $('[name=nome]',novo).focus();
  }
  const dados=f=>{
    const v=n=>(f.elements[n]?.value||'').trim(),tipo=v('tipo'),modo=v('precoModo'),oferta=tipo==='oferta';
    return {tipo,nome:v('nome'),descricao:v('descricao'),precoModo:modo,precoCentavos:modo==='consulta'?null:centavos(v('precoCentavos')),condicoes:oferta?v('condicoes'):'',validade:oferta?v('validade'):''};
  };
  // Rascunho só precisa do nome (contrato 12.6); o resto é conferido ao enviar para a aprovação, com exemplos.
  const validar=(i,completo=true)=>{
    const erros=[];
    if(!i.nome)erros.push({campo:'nome',mensagem:'Dê um nome ao item.'});
    if(!completo)return erros;
    if(i.precoModo!=='consulta'&&!(i.precoCentavos>0))erros.push({campo:'precoCentavos',mensagem:'Informe o valor, como 18,90.'});
    if(i.tipo==='oferta'){
      if(!i.condicoes)erros.push({campo:'condicoes',mensagem:'A oferta precisa das condições: quando vale, para quem e os limites.'});
      if(!i.validade)erros.push({campo:'validade',mensagem:'A oferta precisa da data de validade.'});
      else if(i.validade<hoje())erros.push({campo:'validade',mensagem:'A validade precisa ser de hoje em diante.'});
    }
    return erros;
  };
  const fNovo=$('[data-form="item-novo"]');
  fNovo?.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(fNovo);
    const enviar=ev.submitter?.dataset.enviar!=='false';
    const item=dados(fNovo),erros=validar(item,enviar);if(erros.length)return mostrarErros(fNovo,erros);
    // Rascunho sem valor: o servidor guarda como "sob consulta" até a pessoa completar (contrato 12.6).
    if(!enviar&&item.precoCentavos==null){delete item.precoModo;delete item.precoCentavos;}
    const liberar=ocupar(ev.submitter||fNovo.querySelector('[type=submit]'),'Salvando…');
    const r=await chamar('POST',`${base}/catalogo`,{...item,enviar});
    if(!r.ok){liberar();return falha(r,fNovo);}
    recarregar(enviar?'Item enviado. Ele aparece no perfil depois da aprovação do Nexus.':'Rascunho salvo. Envie para a aprovação quando estiver pronto.');
  });
  $$('[data-corrigir]').forEach(b=>b.addEventListener('click',()=>{
    const edicao=b.closest('.item-row').querySelector('.item-edit');edicao.open=true;
    edicao.querySelector('input:not([type=hidden]),select,textarea').focus();
  }));
  $$('[data-form="item"]').forEach(f=>f.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(f);
    const item=dados(f),erros=validar(item);if(erros.length)return mostrarErros(f,erros);
    const reenviar=f.hasAttribute('data-reenviar'),id=encodeURIComponent(f.dataset.item);
    const liberar=ocupar(f.querySelector('[type=submit]'),reenviar?'Reenviando…':'Salvando…');
    let r=await chamar('PATCH',`${base}/catalogo/${id}`,{...item,version:versao(f.elements.version.value)});
    if(r.ok&&reenviar&&r.dados?.status==='rascunho')r=await chamar('POST',`${base}/catalogo/${id}/enviar`,{version:r.dados.version});
    if(!r.ok){liberar();return falha(r,f);}
    recarregar(r.dados?.status==='validacao'?'Alterações salvas e enviadas para a aprovação do Nexus.':'Alterações salvas.');
  }));
  $$('[data-excluir-item]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar exclusão');
    const liberar=ocupar(b,'Excluindo…');
    const r=await chamar('DELETE',`${base}/catalogo/${encodeURIComponent(b.dataset.excluirItem)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Rascunho excluído.');
  }));
  const OCUPADO={enviar:'Enviando…',pausar:'Pausando…',reativar:'Reativando…'};
  $$('[data-acao-item]').forEach(b=>b.addEventListener('click',async()=>{
    const acao=b.dataset.acaoItem,liberar=ocupar(b,OCUPADO[acao]);
    const r=await chamar('POST',`${base}/catalogo/${encodeURIComponent(b.dataset.item)}/${acao}`,{version:versao(b.dataset.version)});
    if(!r.ok){liberar();return falha(r);}
    recarregar({enviar:'Item enviado para a aprovação do Nexus.',pausar:'Item pausado: ele saiu do seu perfil.',
      reativar:r.dados?.status==='validacao'?'O item mudou depois da aprovação e voltou para a fila do Nexus.':'Item reativado: ele voltou ao seu perfil.'}[acao]);
  }));
}

// Solicitações: nova (o briefing aparece na criação; ?nova= escolhe o tipo), conversa carregada ao abrir, resposta e encerramento.
const dataHora=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?String(v||''):d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
function solicitacoes() {
  const form=$('[data-form="solicitacao"]');
  if(form){
    const briefing=$('[data-briefing]',form),mostrar=()=>briefing.classList.toggle('is-hidden',form.elements.tipo.value!=='criacao');
    form.addEventListener('change',ev=>{if(ev.target.name==='tipo')mostrar();});
    const pedido=new URLSearchParams(location.search).get('nova');
    if(['suporte','alteracao','criacao'].includes(pedido)){$('#nova-solicitacao').open=true;form.elements.tipo.value=pedido;form.elements.assunto.focus();}
    mostrar();
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();limparErros(form);
      const v=n=>(form.elements[n]?.value||'').trim(),tipo=form.elements.tipo.value;
      const corpo={tipo,assunto:v('assunto'),texto:v('texto')};
      if(tipo==='criacao')corpo.briefing={objetivo:v('objetivo'),formato:v('formato'),prazo:v('prazo'),referencias:v('referencias')};
      const erros=[];
      if(!corpo.assunto)erros.push({campo:'assunto',mensagem:'Dê um assunto, como "Banner para o Dia das Mães".'});
      if(!corpo.texto)erros.push({campo:'texto',mensagem:'Conte em poucas palavras o que você precisa.'});
      if(tipo==='criacao'&&!corpo.briefing.objetivo)erros.push({campo:'objetivo',mensagem:'Diga o objetivo da criação.'});
      if(erros.length)return mostrarErros(form,erros);
      const liberar=ocupar(form.querySelector('[type=submit]'),'Enviando…');
      const r=await chamar('POST',`${base}/solicitacoes`,corpo);
      if(!r.ok){liberar();return falha(r,form);}
      recarregar('Solicitação enviada. A equipe do Nexus responde por aqui.');
    });
  }
  const mensagem=m=>{
    const lado=m.autor?.lado==='associado'?'associado':'equipe';
    const art=document.createElement('article');art.className=`message is-${lado}`;
    const cab=document.createElement('header');cab.append(texto('strong',m.autor?.nome||(lado==='equipe'?'Equipe Nexus':'Você')),texto('span',dataHora(m.em)));
    art.append(cab,texto('p',m.texto||''));return art;
  };
  async function carregar(d) {
    const lugar=$('[data-conversa]',d);d.dataset.carregada='1';
    lugar.setAttribute('aria-busy','true');lugar.replaceChildren(texto('div','','skeleton'),texto('div','','skeleton'));
    const r=await chamar('GET',`${base}/solicitacoes/${encodeURIComponent(d.dataset.solicitacao)}`);
    lugar.setAttribute('aria-busy','false');
    if(!r.ok){
      delete d.dataset.carregada;
      const outra=texto('button','Tentar de novo','button secondary');outra.type='button';outra.addEventListener('click',()=>carregar(d));
      lugar.replaceChildren(texto('p','Não deu para carregar a conversa.','muted'),outra);return;
    }
    const lista=r.dados?.mensagens||[];
    lugar.replaceChildren(...(lista.length?lista.map(mensagem):[texto('p','Ainda não há mensagens nesta solicitação.','muted')]));
  }
  $$('details[data-solicitacao]').forEach(d=>{
    d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.carregada)carregar(d);});
    if(location.hash===`#sol-${d.dataset.solicitacao}`)d.open=true;
  });
  $$('[data-form="mensagem"]').forEach(f=>f.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(f);
    const t=f.elements.texto.value.trim();if(!t)return mostrarErros(f,[{campo:'texto',mensagem:'Escreva a resposta.'}]);
    const liberar=ocupar(f.querySelector('[type=submit]'),'Enviando…');
    const r=await chamar('POST',`${base}/solicitacoes/${encodeURIComponent(f.dataset.solicitacao)}/mensagens`,{texto:t});
    liberar();if(!r.ok)return falha(r,f);
    f.reset();carregar(f.closest('details'));avisar('Resposta enviada.');
  }));
  $$('[data-fechar-solicitacao]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: encerrar');
    const liberar=ocupar(b,'Encerrando…');
    const r=await chamar('POST',`${base}/solicitacoes/${encodeURIComponent(b.dataset.fecharSolicitacao)}/fechar`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Solicitação encerrada.');
  }));
}

// Acessos: papel, retirada (com confirmação) e convite; sem e-mail enviado, o link aparece para mandar pelo WhatsApp.
// Cupons (v0.14.0, 14.6): publicar, editar (depois da primeira coleta, só validade e quantidade), pausar, reativar, tirar do
// site com o segundo toque e copiar o link para divulgar.
function cupons() {
  const ler=f=>{
    const v=n=>f.elements[n]&&!f.elements[n].disabled?f.elements[n].value.trim():undefined,q=v('quantidade');
    const c={titulo:v('titulo'),condicoes:v('condicoes'),validade:v('validade'),inicio:v('inicio'),quantidade:q===undefined?undefined:q===''?null:Number(q),codigo:v('codigo')};
    if(c.codigo)c.codigo=c.codigo.toUpperCase();
    return Object.fromEntries(Object.entries(c).filter(([,x])=>x!==undefined));
  };
  const validar=(c,novo)=>{
    const erros=[];
    if(c.titulo!==undefined&&(c.titulo.length<4||c.titulo.length>80))erros.push({campo:'titulo',mensagem:'O título tem de 4 a 80 caracteres.'});
    if(c.condicoes!==undefined&&(c.condicoes.length<10||c.condicoes.length>600))erros.push({campo:'condicoes',mensagem:'Diga o que vale, onde e como usar, em 10 a 600 caracteres.'});
    if(!c.validade)erros.push({campo:'validade',mensagem:'Informe até quando o cupom vale.'});
    else if(c.validade<hoje())erros.push({campo:'validade',mensagem:'A validade não pode ser antes de hoje.'});
    if(c.inicio&&c.validade&&c.inicio>c.validade)erros.push({campo:'inicio',mensagem:'O início vem antes da validade.'});
    if(c.quantidade!=null&&(!Number.isInteger(c.quantidade)||c.quantidade<1||c.quantidade>100000))erros.push({campo:'quantidade',mensagem:'Use um número de 1 a 100000, ou deixe em branco para não ter limite.'});
    if(c.codigo&&!/^[A-Z0-9-]{4,20}$/.test(c.codigo))erros.push({campo:'codigo',mensagem:'O código tem de 4 a 20 letras, números ou hífen, sem espaço.'});
    if(novo){if(!c.inicio)delete c.inicio;if(!c.codigo)delete c.codigo;if(c.quantidade===null)delete c.quantidade;}
    return erros;
  };
  const fNovo=$('[data-form="cupom-novo"]');
  fNovo?.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(fNovo);
    const c=ler(fNovo),erros=validar(c,true);if(erros.length)return mostrarErros(fNovo,erros);
    const liberar=ocupar(ev.submitter||$('[type=submit]',fNovo),'Publicando…');
    const r=await chamar('POST',`${base}/cupons`,c);
    if(!r.ok){liberar();return falha(r,fNovo);}
    recarregar(r.dados?.status==='agendado'?`Cupom agendado: entra no ar em ${r.dados.inicio.split('-').reverse().join('/')}.`:'Cupom no ar. Divulgue o link para os seus clientes.');
  });
  $$('[data-form="cupom"]').forEach(f=>f.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(f);
    const c=ler(f),erros=validar(c,false);if(erros.length)return mostrarErros(f,erros);
    const liberar=ocupar(ev.submitter||$('[type=submit]',f),'Salvando…');
    const r=await chamar('PATCH',`${base}/cupons/${encodeURIComponent(f.dataset.cupom)}`,{...c,version:versao(f.elements.version.value)});
    if(!r.ok){liberar();return falha(r,f);}
    recarregar('Cupom salvo.');
  }));
  $$('[data-acao-cupom]').forEach(b=>b.addEventListener('click',async()=>{
    const pausar=b.dataset.acaoCupom==='pausar',liberar=ocupar(b,pausar?'Pausando…':'Reativando…');
    const r=await chamar('POST',`${base}/cupons/${encodeURIComponent(b.dataset.cupom)}/${pausar?'pausar':'reativar'}`,{version:versao(b.dataset.version)});
    if(!r.ok){liberar();return falha(r);}
    recarregar(pausar?'Cupom pausado: saiu do guia até você reativar.':'Cupom reativado.');
  }));
  $$('[data-excluir-cupom]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: tirar do site');
    const liberar=ocupar(b,'Tirando…');
    const r=await chamar('DELETE',`${base}/cupons/${encodeURIComponent(b.dataset.excluirCupom)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Cupom tirado do site. Quem coletou passa a vê-lo como encerrado.');
  }));
  $$('[data-copiar-link]').forEach(b=>b.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(new URL(b.dataset.copiarLink,location.origin).href);b.textContent='Link copiado';}catch{b.textContent='Não deu para copiar';}
  }));
}

function acessos() {
  $$('[data-form="papel"]').forEach(f=>{
    const sel=f.elements.papel,salvar=$('[data-salvar-papel]',f),aviso=$('[data-confirmar-dono]',f),rotulo=salvar.innerHTML;
    sel.addEventListener('change',()=>{
      const mudou=sel.value!==sel.dataset.papelAtual,dono=mudou&&sel.value==='dono';
      salvar.hidden=!mudou;aviso.hidden=!dono;
      salvar.innerHTML=rotulo;if(dono)salvar.firstChild.textContent='Confirmar: tornar dono';
      if(dono)anunciar(aviso.textContent);
    });
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();
      if(sel.value===sel.dataset.papelAtual)return;
      const liberar=ocupar(salvar,'Salvando…');
      const r=await chamar('PATCH',`${base}/acessos/${encodeURIComponent(f.dataset.usuario)}`,{papel:sel.value});
      if(!r.ok){liberar();sel.value=sel.dataset.papelAtual;salvar.hidden=true;aviso.hidden=true;return falha(r);}
      recarregar('Papel atualizado.');
    });
  });
  $$('[data-revogar]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: tirar acesso');
    const liberar=ocupar(b,'Tirando…');
    const r=await chamar('DELETE',`${base}/acessos/${encodeURIComponent(b.dataset.revogar)}`);
    if(!r.ok){liberar();return falha(r);}
    recarregar('Acesso retirado. As sessões abertas dessa pessoa foram encerradas.');
  }));
  const saida=$('[data-convite-resultado]');
  // Convite sem e-mail enviado: o link aparece para copiar ou mandar pelo WhatsApp.
  const mostrarLink=(email,endereco)=>{
    const link=new URL(endereco,location.origin).href;
    const copiar=texto('button','Copiar o link','button secondary');copiar.type='button';
    copiar.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);copiar.textContent='Link copiado';}catch{copiar.textContent='Selecione o link acima e copie';}});
    const zap=texto('a','Mandar pelo WhatsApp ↗','button');zap.href=`https://wa.me/?${new URLSearchParams({text:`Olá! Este é o seu convite para o painel do Nexus: ${link}`})}`;zap.target='_blank';zap.rel='noopener';
    const acoes=document.createElement('div');acoes.className='panel-actions';acoes.append(copiar,zap);
    saida.replaceChildren(texto('p',`O convite para ${email} está pronto. O e-mail não foi enviado: mande o link para a pessoa. Ele vale 7 dias e funciona uma vez só.`),texto('code',link),acoes);
    saida.hidden=false;saida.focus();
  };
  $$('[data-reenviar-convite]').forEach(b=>b.addEventListener('click',async()=>{
    const email=b.dataset.reenviarConvite,liberar=ocupar(b,'Reenviando…');
    const r=await chamar('POST',`${base}/acessos/convites/reenviar`,{email});
    liberar();if(!r.ok)return falha(r);
    if(r.dados?.link)return mostrarLink(email,r.dados.link);
    recarregar(`Convite reenviado por e-mail para ${email}. O novo link vale 7 dias.`);
  }));
  $$('[data-cancelar-convite]').forEach(b=>b.addEventListener('click',async()=>{
    if(!b.dataset.confirmar)return confirmar(b,'Confirmar: cancelar convite');
    const liberar=ocupar(b,'Cancelando…');
    const r=await chamar('POST',`${base}/acessos/convites/cancelar`,{email:b.dataset.cancelarConvite});
    if(!r.ok){liberar();return falha(r);}
    recarregar('Convite cancelado: o link deixou de valer.');
  }));
  const form=$('[data-form="convite"]');if(!form)return;
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);saida.hidden=true;
    const email=form.elements.email.value.trim(),papel=form.elements.papel.value;
    if(!emailOk(email))return mostrarErros(form,[{campo:'email',mensagem:'Confira o e-mail da pessoa.'}]);
    const liberar=ocupar(form.querySelector('[type=submit]'),'Convidando…');
    const r=await chamar('POST',`${base}/acessos`,{email,papel});
    liberar();if(!r.ok)return falha(r,form);
    const c=r.dados||{};
    if(c.ativo)return recarregar(`${email} já tinha conta e agora tem acesso a esta empresa.`);
    if(!c.link)return recarregar(`Convite enviado por e-mail para ${email}. O link vale 7 dias.`);
    mostrarLink(email,c.link);form.reset();
  });
}

if(painel&&empresa){perfil();fotos();catalogo();cupons();solicitacoes();acessos();}
