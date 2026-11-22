import { slugify } from '../lib/saneamento.mjs';

// Planos, campanhas e formatos de banner publicados no "Anuncie aqui" oficial (consultado em 24/09/2026).
// interesse é o valor enviado ao /cadastro; o mesmo valor é validado em api/cadastro.mjs.
export const FONTE_OFICIAL='/para-empresas';
export const plans=[
 {name:'Avançado',price:'R$ 67,00',period:'R$ 179,90 / 3 meses',features:['1 anúncio avançado','1 classificado intermediário','Até 3 categorias e galeria com até 3 imagens','Até 1 oferta e 1 classificado associados','Mapa, horário, contato e redes sociais']},
 {name:'Premium',price:'R$ 350,00',period:'R$ 949,90 / 3 meses',popular:true,features:['1 anúncio premium','1 artigo','1 classificado avançado','1 banner móvel grande (320 × 100)','Até 5 categorias e galeria com até 6 imagens','Até 3 ofertas e 3 classificados associados']},
 {name:'Personalizado',price:'A combinar',custom:true,features:['Monte o pacote com anúncio, artigo, classificados, banners e panfletagem digital','Formato, duração e investimento sob medida para o seu negócio','Valor combinado na conversa com a equipe Nexus']}
].map(p=>({...p,interesse:`plano-${slugify(p.name)}`}));
export const banners=[
 {name:'Banner link patrocinado',price:'R$ 35,00',period:'R$ 189,00 / 6 meses',size:'320 × 100'},
 {name:'Quadrado',price:'R$ 79,90',period:'R$ 429,90 / 6 meses',size:'250 × 250'},
 {name:'Super Banner',price:'R$ 99,00',period:'R$ 250,00 / 3 meses',size:'728 × 90',popular:true},
 {name:'Ar livre',price:'R$ 119,00',period:'R$ 449,00 / 6 meses',size:'970 × 250'},
 {name:'Meia página',price:'R$ 149,00',period:'R$ 799,00 / 6 meses',size:'300 × 600'},
 {name:'Exibir lateral',price:'R$ 199,00',period:'R$ 1.069,00 / ano',size:'160 × 600'}
].map(b=>({...b,interesse:`banner-${slugify(b.name.replace(/^banner\s+/i,''))}`}));
export const campaigns=[
 {name:'Campanha Básica',price:'R$ 750,00',tier:'basic',concept:'Descoberta local',idea:'Apresentar a marca a pessoas da região.',steps:['Anúncio de apresentação','Visita ao perfil']},
 {name:'Campanha Intermediária',price:'R$ 1.150,00',tier:'intermediate',concept:'Interesse pelo serviço',idea:'Destacar uma oferta ou serviço e convidar à conversa.',steps:['Criativo segmentado','Página da oferta','Mensagem']},
 {name:'Campanha Avançada',price:'R$ 1.550,00',tier:'advanced',concept:'Relacionamento',idea:'Combinar mensagens diferentes ao longo da jornada do público.',steps:['Campanha por objetivo','Novo contato','Conversa']}
].map(c=>({...c,interesse:slugify(c.name)}));
