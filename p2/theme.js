// Tema claro é o padrão; o escuro fica salvo no navegador quando o visitante escolhe.
// Carregado no <head> sem defer para aplicar o tema antes da primeira pintura.
(()=>{
  const root=document.documentElement,key='nexus-tema';
  const sync=()=>{
    const dark=root.dataset.theme==='dark',label=dark?'Ativar tema claro':'Ativar tema escuro';
    for(const button of document.querySelectorAll('[data-theme-toggle]')){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',label);button.title=label;}
  };
  let saved=null;
  try{saved=localStorage.getItem(key);}catch{}
  root.dataset.theme=saved==='dark'?'dark':'light';
  document.addEventListener('DOMContentLoaded',sync);
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-theme-toggle]'))return;
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem(key,root.dataset.theme);}catch{}
    sync();
  });
})();
