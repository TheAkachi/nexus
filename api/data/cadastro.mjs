import { plans, campaigns, banners } from './planos.mjs';
import { categoryTree } from './categorias.mjs';
import { slugify } from '../lib/saneamento.mjs';
import { rota, titulo } from './rota.mjs';

// Cadastro e contato do ambiente demonstrativo Nexus: validados no servidor, geram uma prévia confirmada na própria página.
export const DEMO_TELEFONE='(21) 3000-0000 (demo)';
export const whatsappURL=text=>`#demo-envio`;

// Cadastro só com respostas de escolher: as perguntas, a abertura e a caixa de novidades.
export const ABERTURA='Olá, equipe Nexus! Gostaria de cadastrar meu espaço no guia.';
export const NOVIDADES={frase:'Quero receber novidades do Nexus por e-mail (demonstração).'};
const op=(valor,rotulo,extra={})=>({valor,rotulo,...extra});
const RAMOS={
  'restaurantes':'de gastronomia e restaurante',
  'cafes-e-padarias':'de café e padaria artesanal',
  'bares-e-botecos':'de bar e boteco',
  'arte-e-cultura':'de arte e cultura',
  'livrarias-e-cinema':'de livraria e cinema',
  'musica-e-palcos':'de música e palco ao vivo',
  'parques-e-lazer':'de lazer ao ar livre',
  'experiencias':'de experiências criativas'
};
const BAIRROS=['Botafogo','Copacabana','Ipanema','Santa Teresa','Lapa','Centro','Laranjeiras','Flamengo','Gávea','Tijuca'];
const preco=p=>p.custom?'valor a combinar':`${p.price}/mês`;
const nomeBanner=b=>{const n=b.name.replace(/^banner\s+/i,'');return n[0].toUpperCase()+n.slice(1);};
export const PERGUNTAS=[
  {id:'ramo',titulo:'Qual é a categoria do seu espaço?',tipo:'uma',obrigatoria:true,bloco:1,frase:'Meu espaço é {}.',
    opcoes:[...categoryTree([],{all:true}).map(g=>op(g.slug,g.label,{trecho:RAMOS[g.slug]||`de ${g.label.toLowerCase()}`})),
      op('outro','Outra categoria',{trecho:'de outra categoria cultural ou gastronômica'})]},
  {id:'local',titulo:'Em qual bairro do Rio fica o espaço?',tipo:'uma',obrigatoria:true,bloco:1,frase:'Ele fica em {}.',
    opcoes:[...BAIRROS.map(c=>op(slugify(c),c,{trecho:c})),op('outro-bairro','Outro bairro do Rio',{frase:'Ele fica em outro bairro do Rio de Janeiro.'})]},
  {id:'tempo',titulo:'Há quanto tempo o espaço funciona?',tipo:'uma',obrigatoria:false,bloco:1,frase:'Ele funciona há {}.',
    opcoes:[op('vai-abrir','Ainda vai inaugurar',{frase:'Ainda vamos inaugurar o espaço.'}),op('menos-de-1','Menos de 1 ano',{trecho:'menos de 1 ano'}),
      op('1-a-5','De 1 a 5 anos',{trecho:'1 a 5 anos'}),op('mais-de-5','Mais de 5 anos',{trecho:'mais de 5 anos'})]},
  {id:'canais',titulo:'Como o público encontra você hoje?',tipo:'varias',obrigatoria:false,bloco:1,frase:'Hoje o público nos encontra {}.',
    opcoes:[op('instagram','Instagram',{trecho:'pelo Instagram'}),op('maps','Google Maps',{trecho:'pelo Google Maps'}),op('indicacao','Indicação',{trecho:'por indicação'}),
      op('movimento-da-rua','Movimento da rua',{trecho:'pelo movimento da rua'})]},
  {id:'objetivos',titulo:'O que você quer destacar no Nexus?',tipo:'varias',obrigatoria:false,bloco:1,frase:'Quero {}.',
    opcoes:[op('cupons','Publicar cupons de desconto',{trecho:'publicar cupons de desconto'}),op('eventos','Divulgar agenda de eventos',{trecho:'divulgar nossa agenda de eventos'}),
      op('mapa','Aparecer no mapa interativo',{trecho:'aparecer no mapa interativo'}),op('marca','Fortalecer a marca no bairro',{trecho:'fortalecer a marca no bairro'})]},
  {id:'plano',titulo:'Qual formato te interessa?',tipo:'uma',obrigatoria:true,bloco:2,frase:'Tenho interesse {}.',
    opcoes:[...plans.map(p=>op(p.interesse,`Plano ${p.name}`,{detalhe:preco(p),trecho:`no Plano ${p.name} (${preco(p)})`})),
      ...campaigns.map(c=>op(c.interesse,c.name,{detalhe:`campanha editorial · ${c.price}/mês`,trecho:`na ${c.name} (${c.price}/mês)`})),
      op('conhecer','Quero ajuda para escolher',{frase:'Quero ajuda para escolher o melhor formato.'})]},
  {id:'banner',titulo:'Deseja incluir destaque visual no guia?',tipo:'uma',obrigatoria:false,bloco:2,frase:'Também quero {}.',
    opcoes:[...banners.map(b=>op(b.interesse,nomeBanner(b),{detalhe:`${b.size} · ${b.price}/mês`,trecho:`o banner ${nomeBanner(b)}, ${b.size} (${b.price}/mês)`})),
      op('nao','Não, por enquanto',{frase:''}),op('saber','Quero saber mais',{frase:'Quero saber mais sobre os espaços de destaque.'})]},
  {id:'horario',titulo:'Qual o melhor período para contato?',tipo:'uma',obrigatoria:false,bloco:3,frase:'Prefiro conversar {}.',
    opcoes:[op('manha','Manhã',{trecho:'de manhã'}),op('tarde','Tarde',{trecho:'à tarde'}),op('noite','Noite',{trecho:'à noite'}),
      op('qualquer','Qualquer horário',{frase:'Posso conversar em qualquer horário.'})]}
];
export const FALTA={ramo:'Escolha a categoria do seu espaço.',local:'Escolha o bairro do seu espaço.',plano:'Escolha um formato, ou peça ajuda para escolher.'};

export const cadastroVM=({values={},errors=[],origem='',enviado=null}={})=>({values,errors,abertura:ABERTURA,perguntas:PERGUNTAS,novidades:NOVIDADES,origem,enviado});
export const origemDe=v=>{const s=String(v??'').trim();return /^[a-z0-9-]{1,60}$/.test(s)?s:'';};
export const contatoVM=({values={},errors=[],enviado=null}={})=>({values,errors,whatsappUrl:'#contato-form',telefone:DEMO_TELEFONE,enviado});

export const CADASTRO={title:titulo('Cadastre seu espaço'),description:'Simule o cadastro de um espaço gastronômico ou cultural no guia demonstrativo Nexus.'};
export const CONTATO={title:titulo('Contato'),description:'Entre em contato com a equipe do projeto demonstrativo Nexus.'};
// ?interesse= marca o plano (plano-*, campanha-* e conhecer) ou o banner (banner-*); valor desconhecido não marca nada.
export function loadCadastro(url) {
  const interesse=(url.searchParams.get('interesse')||'').slice(0,60),values={};
  for(const id of ['plano','banner'])if(PERGUNTAS.find(p=>p.id===id).opcoes.some(o=>o.valor===interesse))values[id]=interesse;
  return rota('cadastro',cadastroVM({values,origem:origemDe(interesse)}),CADASTRO);
}
export const loadContato=()=>rota('contato',contatoVM(),CONTATO);
