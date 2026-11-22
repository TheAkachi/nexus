// Cupons (v0.14.0, contrato 14): coletar sem recarregar e copiar o código; em Minha conta, o nome, sair e excluir a conta.
// As escritas levam o X-CSRF-Token do data-csrf do bloco. Sem sessão (401), a tela leva ao login e volta ao cupom.
import { $, $$, api, limparErros, mostrarErros, ocupar } from './formulario.js';

const texto=(tag,conteudo,cls)=>Object.assign(document.createElement(tag),{textContent:conteudo,...(cls?{className:cls}:{})});
const anuncio=$('[data-cupom-anuncio]');
const anunciar=t=>{if(!anuncio)return;anuncio.textContent='';setTimeout(()=>{anuncio.textContent=t;},50);};

// O mesmo bloco do código que a view monta (codigoCupom, em api/views/cupons.mjs).
function blocoCodigo(codigo) {
  const div=texto('div','','coupon-code'),copiar=texto('button','Copiar código','link-button text-button');
  copiar.type='button';copiar.dataset.copiarCodigo=codigo;
  div.append(texto('span','Seu código','coupon-code-label'),texto('strong',codigo,'coupon-code-value'),copiar);
  return div;
}

$$('[data-cupons]').forEach(bloco=>bloco.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-coletar]');if(!b)return;
  const id=b.dataset.coletar,lugar=b.closest('[data-cupom-acao]'),liberar=ocupar(b,'Coletando…');
  lugar.querySelector('.coupon-error')?.remove();
  const r=await api('POST',`/api/cupons/${encodeURIComponent(id)}/coletar`,{csrf:bloco.dataset.csrf});
  if(r.status===401){location.assign(`/entrar?${new URLSearchParams({tipo:'usuario',next:`/cupons/${id}`,motivo:'expirou'})}`);return;}
  if(!r.ok){
    if(r.status===422||r.status===404){lugar.replaceChildren(texto('p',r.status===404?'Este cupom saiu do ar.':r.erro,'coupon-out'));anunciar(r.status===404?'Este cupom saiu do ar.':r.erro);return;}
    liberar();
    const erro=texto('p',r.erro,'coupon-error');erro.setAttribute('role','alert');lugar.append(erro);return;
  }
  const codigo=r.dados?.codigo||'';
  lugar.replaceChildren(blocoCodigo(codigo));
  lugar.querySelector('[data-copiar-codigo]').focus();
  anunciar(`Cupom coletado. Seu código é ${codigo.split('').join(' ')}. Ele fica guardado em Minha conta.`);
}));

document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-copiar-codigo]');if(!b)return;
  try{await navigator.clipboard.writeText(b.dataset.copiarCodigo);b.textContent='Código copiado';}catch{b.textContent='Selecione o código e copie';}
  anunciar(b.textContent);
});

// Minha conta: nome, sair e excluir a conta (só a de usuário; a de afiliado e da equipe sai pelo Nexus).
const conta=$('[data-minha-conta]');
if(conta){
  const csrf=conta.dataset.csrf,aviso=$('[data-conta-aviso]',conta);
  const avisar=(mensagem,erro=false)=>{aviso.className=`panel-flash${erro?' is-error':''}`;aviso.replaceChildren(texto('span',mensagem));aviso.hidden=false;aviso.focus();};
  const expirou=()=>location.assign(`/entrar?${new URLSearchParams({tipo:'usuario',next:'/minha-conta',motivo:'expirou'})}`);
  const fNome=$('form[data-form="nome"]',conta);
  fNome?.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(fNome);
    const nome=fNome.elements.nome.value.trim();
    if(nome.length<2)return mostrarErros(fNome,[{campo:'nome',mensagem:'Informe o seu nome (pelo menos 2 letras).'}]);
    const liberar=ocupar($('[type=submit]',fNome),'Salvando…');
    const r=await api('PATCH','/api/me',{corpo:{nome},csrf});
    liberar();
    if(r.status===401)return expirou();
    if(!r.ok)return mostrarErros(fNome,[{campo:r.campo||'nome',mensagem:r.erro}]);
    avisar('Nome salvo.');
  });
  $('[data-sair]',conta)?.addEventListener('click',async ev=>{
    ocupar(ev.currentTarget,'Saindo…');
    await api('POST','/api/auth/logout',{csrf});
    location.assign('/cupons');
  });
  const fExcluir=$('form[data-form="excluir"]',conta);
  fExcluir?.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(fExcluir);
    const senha=fExcluir.elements.senha.value,botao=$('[type=submit]',fExcluir);
    if(!senha)return mostrarErros(fExcluir,[{campo:'senha',mensagem:'Informe a sua senha para confirmar.'}]);
    // Segundo toque no próprio botão, como nas outras ações sérias.
    if(!botao.dataset.confirmar){botao.dataset.confirmar='1';botao.textContent='Confirmar: excluir a conta e os cupons';anunciar('Toque de novo para excluir a conta.');return;}
    const liberar=ocupar(botao,'Excluindo…');
    const r=await api('DELETE','/api/me',{corpo:{senha},csrf});
    if(r.status===401)return expirou();
    if(!r.ok){liberar();return mostrarErros(fExcluir,[{campo:r.campo||'',mensagem:r.erro}]);}
    location.assign('/');
  });
}
