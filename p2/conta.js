// Entrar, criar a conta de usuário (v0.14.0, 14.4), recuperar o acesso e definir a senha (Fase 3, contrato 12.4): o formulário
// fala com /api/auth/* e mostra o erro no campo.
import { $, api, emailOk, limparErros, mostrarErros, ocupar, revelarSenhas } from './formulario.js';

revelarSenhas();
const form=$('[data-conta]');
document.querySelectorAll('[data-demo-email]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(!form||form.dataset.conta!=='entrar')return;
    form.elements.email.value=btn.dataset.demoEmail;
    form.elements.senha.value=btn.dataset.demoSenha;
    form.requestSubmit();
  });
});
const OCUPADO={entrar:'Entrando…','criar-conta':'Criando a conta…',recuperar:'Enviando…','definir-senha':'Salvando…'};
// Depois de entrar ou criar a conta: o next pedido (painel, admin, cupons ou minha conta) ou o lugar de cada tipo (14.2).
const LUGAR={equipe:'/admin',afiliado:'/painel',usuario:'/cupons'};
const destino=(next,usuario={})=>/^\/(painel|admin|cupons|minha-conta)(\/|\?|$)/.test(next)?next:LUGAR[usuario.tipo]||(usuario.equipe?'/admin':'/painel');

function validar(tipo) {
  const erros=[],email=(form.elements.email?.value||'').trim(),senha=form.elements.senha?.value||'';
  if(tipo==='criar-conta'){
    const nome=form.elements.nome.value.trim();
    if(nome.length<2)erros.push({campo:'nome',mensagem:'Informe o seu nome (pelo menos 2 letras).'});
  }
  if(tipo!=='definir-senha'){
    if(!email)erros.push({campo:'email',mensagem:'Informe o seu e-mail.'});
    else if(!emailOk(email))erros.push({campo:'email',mensagem:'Confira o e-mail: falta o @ ou o domínio (como maria@empresa.com.br).'});
  }
  if(tipo==='entrar'&&!senha)erros.push({campo:'senha',mensagem:'Informe a sua senha.'});
  if(tipo==='criar-conta'){
    if(senha.length<12)erros.push({campo:'senha',mensagem:'A senha precisa de pelo menos 12 caracteres.'});
    else if(senha.length>128)erros.push({campo:'senha',mensagem:'A senha pode ter no máximo 128 caracteres.'});
    if(!form.elements.aceite.checked)erros.push({campo:'aceite',mensagem:'Para criar a conta, aceite os termos de uso e a política de privacidade.'});
  }
  if(tipo==='definir-senha'){
    if(senha.length<12)erros.push({campo:'senha',mensagem:'A senha precisa de pelo menos 12 caracteres.'});
    else if(senha.length>128)erros.push({campo:'senha',mensagem:'A senha pode ter no máximo 128 caracteres.'});
    if(form.elements.confirmar.value!==senha)erros.push({campo:'confirmar',mensagem:'As duas senhas não são iguais.'});
  }
  return erros;
}

form?.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(form);
  const tipo=form.dataset.conta,erros=validar(tipo);
  if(erros.length)return mostrarErros(form,erros);
  const email=(form.elements.email?.value||'').trim(),senha=form.elements.senha?.value||'';
  const liberar=ocupar(form.querySelector('[type=submit]'),OCUPADO[tipo]);
  const r=tipo==='entrar'?await api('POST','/api/auth/login',{corpo:{email,senha}})
    :tipo==='criar-conta'?await api('POST','/api/auth/cadastro',{corpo:{nome:form.elements.nome.value.trim(),email,senha,aceite:true}})
    :tipo==='recuperar'?await api('POST','/api/auth/reset',{corpo:{email}})
    :await api('POST','/api/auth/senha',{corpo:{token:form.elements.token.value,senha}});
  if(!r.ok){
    liberar();
    if(tipo==='entrar'||tipo==='criar-conta')form.elements.senha.value='';
    return mostrarErros(form,[{campo:r.campo,mensagem:r.erro}]);
  }
  if(tipo==='entrar'||tipo==='criar-conta'){
    location.assign(destino(form.elements.next.value,r.dados?.usuario));
    return;
  }
  // Recuperação e senha nova: o formulário dá lugar à confirmação.
  if(tipo==='recuperar')$('[data-conta-email]').textContent=email;
  $('[data-conta-form]').hidden=true;
  const feito=$('[data-conta-feito]');feito.hidden=false;feito.focus();
});
