// Formulários da conta e do painel (Fase 3): chamada às APIs, erros por campo no padrão do cadastro e botão ocupado.
export const $=(s,el=document)=>el.querySelector(s);
export const $$=(s,el=document)=>[...el.querySelectorAll(s)];
export const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// APIs JSON do contrato 12: mesma origem, X-CSRF-Token nas escritas autenticadas e erro {erro, campo?}. Um arquivo (Blob)
// vai como corpo binário com o próprio tipo. Sem rede, devolve status 0 com uma mensagem própria.
const PADRAO={401:'Sua sessão terminou. Entre de novo para continuar.',403:'Você não tem permissão para fazer isso nesta empresa.',404:'Não encontramos o que você procurava. Recarregue a página.',
  409:'Esta informação mudou desde que você abriu. Recarregue a página.',413:'O arquivo é grande demais.',415:'Esse tipo de arquivo não é aceito.',429:'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'};
export async function api(metodo,url,{corpo,csrf,tipo}={}) {
  const headers={};let body;
  if(corpo instanceof Blob){body=corpo;headers['Content-Type']=tipo||corpo.type;}
  else if(corpo!==undefined){body=JSON.stringify(corpo);headers['Content-Type']='application/json';}
  if(csrf)headers['X-CSRF-Token']=csrf;
  let resposta;
  try{resposta=await fetch(url,{method:metodo,headers,body,credentials:'same-origin'});}
  catch{return {ok:false,status:0,erro:'Sem conexão com o guia. Confira a internet e tente de novo.',campo:''};}
  let dados=null;try{dados=await resposta.json();}catch{/* resposta sem corpo */}
  if(resposta.ok)return {ok:true,status:resposta.status,dados};
  // dados: o corpo do erro, com o que algumas rotas mandam além de {erro, campo}, como o igual e as parecidas (v0.22.0, 22.7).
  return {ok:false,status:resposta.status,erro:dados?.erro||PADRAO[resposta.status]||'Não deu para concluir agora. Tente de novo em instantes.',campo:dados?.campo||'',dados};
}

// Controle do formulário para um campo do erro: o input pelo name ou um bloco marcado com data-campo (horário, redes, um grupo
// de caixas de marcar, a imagem da biblioteca ou o editor de texto).
function controleDe(form,campo) {
  if(!campo)return null;
  const el=form.elements[campo],bloco=form.querySelector(`[data-campo="${CSS.escape(campo)}"]`);
  if(el instanceof Element&&el.type!=='hidden')return el;
  return bloco||(el instanceof Element?null:el?.[0])||null;
}
export function limparErros(form) {
  $$('.field-error',form).forEach(p=>p.remove());
  $$('.has-error',form).forEach(el=>el.classList.remove('has-error'));
  $$('[aria-invalid]',form).forEach(c=>{
    c.removeAttribute('aria-invalid');
    const resto=(c.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&!id.startsWith('erro-')).join(' ');
    if(resto)c.setAttribute('aria-describedby',resto);else c.removeAttribute('aria-describedby');
  });
  const caixa=$('.form-errors',form);if(caixa){caixa.hidden=true;caixa.replaceChildren();}
}
// erros: [{campo, mensagem}]. A mensagem fica abaixo do campo (aria-invalid + aria-describedby) e na caixa do topo, que leva ao
// campo; erro sem campo só vai para a caixa.
export function mostrarErros(form,erros) {
  const caixa=$('.form-errors',form),itens=[];
  erros.forEach(({campo,mensagem},n)=>{
    const controle=controleDe(form,campo);
    if(!controle){itens.push({mensagem});return;}
    const bloco=controle.closest('.form-field')||controle;
    const id=`erro-${form.dataset.form||form.dataset.conta||'form'}-${n}`;
    const p=Object.assign(document.createElement('p'),{className:'field-error',id,textContent:mensagem});
    bloco.classList.add('has-error');bloco.append(p);
    const foco=controle.matches('input,select,textarea')?controle:$('[contenteditable="true"]',controle)||$('input:not([type=hidden]),select,textarea,button',controle);
    if(foco){foco.setAttribute('aria-invalid','true');foco.setAttribute('aria-describedby',[foco.getAttribute('aria-describedby'),id].filter(Boolean).join(' '));}
    itens.push({mensagem,foco});
  });
  if(!caixa){itens.find(i=>i.foco)?.foco.focus();return;}
  const lista=document.createElement('ul');
  for(const item of itens){
    const li=document.createElement('li');
    if(item.foco){const a=Object.assign(document.createElement('a'),{href:'#',textContent:item.mensagem});a.addEventListener('click',ev=>{ev.preventDefault();item.foco.focus();});li.append(a);}
    else li.textContent=item.mensagem;
    lista.append(li);
  }
  caixa.replaceChildren(Object.assign(document.createElement('strong'),{textContent:itens.length>1?'Revise antes de continuar:':'Revise antes de continuar'}),lista);
  caixa.hidden=false;caixa.focus();
}

// Botão ocupado enquanto a chamada corre: desabilitado, aria-busy e o texto da ação ("Salvando…"). Devolve quem libera.
export function ocupar(botao,texto) {
  if(!botao)return ()=>{};
  const antes=botao.innerHTML;
  botao.disabled=true;botao.setAttribute('aria-busy','true');botao.textContent=texto;
  return ()=>{botao.disabled=false;botao.removeAttribute('aria-busy');botao.innerHTML=antes;};
}

// Mostrar e ocultar a senha.
export function revelarSenhas(raiz=document) {
  $$('[data-revelar]',raiz).forEach(b=>{
    const campo=b.previousElementSibling;if(!campo)return;
    b.setAttribute('aria-controls',campo.id);
    b.addEventListener('click',()=>{const ver=campo.type==='password';campo.type=ver?'text':'password';b.textContent=ver?'Ocultar':'Mostrar';b.setAttribute('aria-pressed',String(ver));});
  });
}
