// Horário da semana e redes sociais do cadastro da empresa (o mesmo HTML do painel, em painel.mjs): vários intervalos por dia,
// repetir a segunda de terça a sexta, redes com o @ ou o link, e a leitura dos valores no formato das APIs.
import { $, $$ } from './formulario.js';

// "@suaempresa" ou "suaempresa.com.br" viram o endereço completo antes de salvar; o campo mostra o resultado.
const PERFIS={Instagram:'https://instagram.com/',Facebook:'https://facebook.com/',TikTok:'https://tiktok.com/@',YouTube:'https://youtube.com/@',X:'https://x.com/',Kwai:'https://kwai.com/@',Pinterest:'https://pinterest.com/'};
export const endereco=(v,rede)=>{
  v=v.trim();if(!v)return '';
  if(/^@?[\w.]+$/.test(v)&&!v.includes('.')||/^@[\w.]+$/.test(v))return PERFIS[rede]?PERFIS[rede]+v.replace(/^@/,''):v;
  return /^https?:\/\//i.test(v)?v.replace(/^http:\/\//i,'https://'):`https://${v.replace(/^\/+/,'')}`;
};

export function ligarCampos(form,anunciar=()=>{}) {
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
  form.addEventListener('change',ev=>{
    if(ev.target.matches('[data-url]'))ev.target.value=endereco(ev.target.value,$('[data-rede]',ev.target.closest('.social-row')).value);
    if(ev.target.name==='site'&&ev.target.value.trim())ev.target.value=endereco(ev.target.value,'');
    const aberto=ev.target.closest('[data-aberto]');if(!aberto)return;
    const dia=aberto.closest('[data-dia]');
    $('[data-mais-intervalo]',dia).hidden=!aberto.checked;
    if(aberto.checked&&!$('.hours-interval',dia))$('[data-intervalos]',dia).append(novoIntervalo(dia.dataset.dia));
  });
}

// Antes de salvar: o @ e o domínio solto viram links, como no change.
export function normalizar(form) {
  $$('[data-url]',form).forEach(i=>{i.value=endereco(i.value,$('[data-rede]',i.closest('.social-row')).value);});
  if(form.elements.site?.value.trim())form.elements.site.value=endereco(form.elements.site.value,'');
}
// Horário no formato da API: [{dia, abre, fecha}], com a meia-noite como 24:00.
export const lerHorario=form=>{
  const horario=[];
  $$('[data-dia]',form).forEach(d=>{if(!$('[data-aberto]',d).checked)return;$$('.hours-interval',d).forEach(iv=>{const fecha=$('[data-fecha]',iv).value;horario.push({dia:Number(d.dataset.dia),abre:$('[data-abre]',iv).value,fecha:fecha==='00:00'?'24:00':fecha});});});
  return horario;
};
export const lerRedes=form=>$$('.social-row',form).map(r=>({rede:$('[data-rede]',r).value,url:$('[data-url]',r).value.trim()})).filter(r=>r.url);
