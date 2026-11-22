// Dados de exemplo de cada vm (docs/CONTRATO.md). Servem para desenhar e testar as views sem banco.
// tests/api/contrato.test.mjs confere que toda chave destes exemplos existe no vm real: mudou um vm, mude aqui também.
import {cadastroVm,perguntasCadastro} from './cadastro-perguntas.mjs';
const foto='https://www.primigdivulgacao.com.br/custom/domain_1/image_files/exemplo.png';

// CardEmpresa com os campos da Fase 2 (horário, WhatsApp com mensagem pronta, nota e patrocínio).
export const cardEmpresa={slug:'padaria-exemplo',name:'Padaria <Exemplo> & Cia',image:foto,category:'Padarias',district:'Centro',city:'Nova Iguaçu',summary:'Pães artesanais, bolos e café da manhã no Centro de Nova Iguaçu.',
  whatsappUrl:'https://wa.me/5521900000000?text=Ol%C3%A1!%20Vi%20a%20Padaria%20Exemplo%20no%20Guia%20PRIMIG.',openNow:true,closesAt:'19h',opensAt:'',opensDay:'',rating:4.5,reviewsCount:2,sponsored:false};
export const cardEmpresaSemDados={slug:'oficina-exemplo',name:'Oficina Exemplo',image:'',category:'',district:'',city:'',summary:'',whatsappUrl:'',openNow:null,closesAt:'',opensAt:'',opensDay:'',rating:null,reviewsCount:0,sponsored:false};
export const cardConteudo={href:'/artigos/feira-exemplo',title:'Feira de exemplo no Centro',image:foto,category:'Cidade',kind:'article',excerpt:'Resumo do artigo com até 160 caracteres.',author:'Equipe PRIMIG',editoria:'cidade',readingMinutes:2};
export const mapa={
  quadro:{x:150,y:130.4,w:1000,h:869.6},largura:1300,altura:1130,located:2,missing:1,
  municipios:[{nome:'Nova Iguaçu',x:675,y:419}],
  bairros:[{nome:'Centro',x:756,y:907,guia:true},{nome:'Posse',x:717,y:797,guia:false}],
  pontos:[{slug:'padaria-exemplo',name:'Padaria Exemplo',district:'Centro',city:'Nova Iguaçu',x:750.2,y:900.1,approx:false},{slug:'oficina-exemplo',name:'Oficina Exemplo',district:'',city:'',x:760,y:905,approx:true}]
};
export const formBusca={categories:[{value:'padarias',label:'Padarias',districts:['Centro']},{value:'oficinas',label:'Oficinas',districts:['Centro','Posse']}],districts:[{name:'Centro',categories:['oficinas','padarias']},{name:'Posse',categories:['oficinas']}]};

// Lista única de categorias (contrato da Fase 1): grupos com subcategorias e contagem.
export const categorias=[{slug:'alimentacao',label:'Alimentação',count:9,subcategorias:[{slug:'padarias',label:'Padarias',count:3},{slug:'buffets-e-catering',label:'Buffets e catering',count:2}]},{slug:'automotivo',label:'Automotivo',count:5,subcategorias:[{slug:'oficina-mecanica',label:'Oficina mecânica',count:2}]}];

// Fase 2: Oferta, Evento, Colecao, Avaliacao e o corpo saneado de uma publicação.
export const oferta={id:'oferta-exemplo',name:'Café da manhã para dois',description:'Pães, frios, bolo e café.',conditions:'De segunda a sexta, até as 10h.',validUntil:'31/10/2026',businessSlug:'padaria-exemplo',businessName:'Padaria Exemplo',image:'',priceLabel:'R$ 49,90'};
export const evento={slug:'feira-exemplo',title:'Feira de artesanato do Centro',date:'12/10/2026',endDate:'13/10/2026',time:'9h às 17h',place:'Praça da Liberdade',address:'Centro, Nova Iguaçu',description:'Artesãos e produtores da região.',image:'',href:'https://exemplo.com.br/feira',business:{slug:'padaria-exemplo',name:'Padaria Exemplo'}};
export const colecao={slug:'familia',title:'Vai reunir a família?',subtitle:'Buffets, padarias e restaurantes do guia.',href:'/busca?category=alimentacao',businesses:[cardEmpresa]};
export const avaliacao={author:'Maria S.',date:'12/08/2026',rating:5,title:'Ótimo atendimento',text:'Pães sempre fresquinhos.'};
export const corpo='<p>A feira reúne artesãos da região.</p><h2>Como chegar</h2><ul><li>Ônibus até a Praça da Liberdade.</li></ul><table><thead><tr><th>Dia</th><th>Horário</th></tr></thead><tbody><tr><td>Sábado</td><td>9h às 17h</td></tr></tbody></table><blockquote><p>Entrada gratuita.</p></blockquote>';
// Classificado (Conteudo de /classificados): os mesmos campos da leitura, mais preço, contato e empresa.
export const classificado={section:'classificados',label:'Classificados locais',title:'Painel planejado',category:'Móveis',author:'',date:'20/09/2026',image:foto,paragraphs:['Painel de 1,80 m com iluminação.'],bodyHtml:'<p>Painel de 1,80 m com iluminação.</p>',sourceUrl:'',editoria:null,editorias:[],readingMinutes:1,gallery:[],
  price:'R$ 1.199,00',phone:'(21) 3000-0000',phoneUrl:'tel:2130000000',whatsappUrl:'https://wa.me/5521900000000',business:{slug:'padaria-exemplo',name:'Padaria Exemplo'}};

// Parte A (contrato 11): espaços de anúncio de cada view, com banners pagos (rodízio, imageMobile, lateral só no computador, aCada)
// e anúncios da PRIMIG (house). Entram em exemplos.<view>.ads.
const tabela={'link-patrocinado':['Banner link patrocinado','320 × 100','R$ 35,00','R$ 189,00 / 6 meses'],quadrado:['Quadrado','250 × 250','R$ 79,90','R$ 429,90 / 6 meses'],'super-banner':['Super Banner','728 × 90','R$ 99,00','R$ 250,00 / 3 meses'],
  'ar-livre':['Ar livre','970 × 250','R$ 119,00','R$ 449,00 / 6 meses'],'meia-pagina':['Meia página','300 × 600','R$ 149,00','R$ 799,00 / 6 meses'],'exibir-lateral':['Exibir lateral','160 × 600','R$ 199,00','R$ 1.069,00 / ano']};
export const casa=format=>{const [name,size,price,period]=tabela[format];return {id:`primig-${format}`,format,name,size,price,period,interesse:`banner-${format}`,href:`/cadastro?interesse=banner-${format}`};};
export const peca=(id,format,advertiser,extra={})=>{const [width,height]=tabela[format][1].split(' × ').map(Number);return {id,placement:'',href:'/comercio/padaria-exemplo',image:foto,title:`${advertiser}: café da manhã completo`,advertiser,format,width,height,imageMobile:'',...extra};};
const espaco=(id,computador,celular,banners=[],house=null,extra={})=>({id,formatos:{computador,celular},banners:banners.map(b=>({...b,placement:id})),house,celular:true,aCada:0,...extra});
export const anuncios={
  home:{
    'home-topo':espaco('home-topo',['super-banner'],['link-patrocinado'],[peca('banner-padaria','super-banner','Padaria Exemplo',{imageMobile:foto}),peca('banner-oficina','super-banner','Oficina Exemplo',{href:'https://exemplo.com.br/',imageMobile:foto})]),
    'home-destaques':espaco('home-destaques',['ar-livre'],['quadrado'],[],casa('ar-livre')),
    'home-grade':espaco('home-grade',['quadrado'],['quadrado'],[peca('banner-mercado','quadrado','Mercado Exemplo')]),
    'home-comercial':espaco('home-comercial',['super-banner'],['link-patrocinado'],[],casa('super-banner'))},
  busca:{
    'busca-topo':espaco('busca-topo',['super-banner'],['link-patrocinado'],[peca('banner-padaria','super-banner','Padaria Exemplo',{imageMobile:foto})]),
    'busca-meio':espaco('busca-meio',['link-patrocinado'],['link-patrocinado'],[peca('banner-farmacia','link-patrocinado','Farmácia Exemplo'),peca('banner-pet','link-patrocinado','Pet Exemplo')],null,{aCada:6}),
    'busca-lateral':espaco('busca-lateral',['meia-pagina','exibir-lateral'],[],[peca('banner-moveis','meia-pagina','Móveis Exemplo')]),
    'busca-vazia':espaco('busca-vazia',['quadrado'],['quadrado'],[],casa('quadrado'))},
  conteudos:{
    'lista-topo':espaco('lista-topo',['super-banner'],['link-patrocinado'],[],casa('super-banner')),
    'lista-meio':espaco('lista-meio',['quadrado'],['quadrado'],[peca('banner-mercado','quadrado','Mercado Exemplo')],null,{aCada:6})},
  conteudo:{
    'leitura-texto':espaco('leitura-texto',['ar-livre','quadrado'],['quadrado'],[peca('banner-tintas','ar-livre','Tintas Exemplo',{imageMobile:foto})]),
    'leitura-lateral':espaco('leitura-lateral',['meia-pagina'],[],[peca('banner-moveis','meia-pagina','Móveis Exemplo')]),
    'leitura-fim':espaco('leitura-fim',['super-banner'],['link-patrocinado'],[],casa('super-banner'))},
  empresa:{'perfil-lateral':espaco('perfil-lateral',['quadrado'],['quadrado'],[],casa('quadrado'))},
  ofertas:{'ofertas-topo':espaco('ofertas-topo',['super-banner'],['link-patrocinado'],[],casa('super-banner'))},
  eventos:{'eventos-topo':espaco('eventos-topo',['super-banner'],['link-patrocinado'],[],casa('super-banner'))}
};

export const exemplos={
  home:{category:'',directCategory:'',categorias,companiesCount:43,articlesCount:45,selectedCount:5,
    businesses:[cardEmpresa,cardEmpresaSemDados,cardEmpresa,cardEmpresaSemDados,cardEmpresa],articles:[cardConteudo],map:mapa,
    districts:[{name:'Centro',count:1},{name:'Posse',count:1}],collections:[colecao],offers:[oferta]},
  busca:{categorias,favorites:false,q:'pão',district:'',category:'',sort:'name',location:'',total:13,pages:2,current:1,results:[cardEmpresa,cardEmpresaSemDados],form:formBusca,
    filters:{aberto:false,whatsapp:false,avaliacoes:false,cupom:false},counts:{aberto:4,whatsapp:9,avaliacoes:1,cupom:2},suggestions:{categorias:[],bairros:[]},map:mapa},
  empresa:{id:'padaria-exemplo',slug:'padaria-exemplo',name:'Padaria Exemplo',summary:'Pães artesanais no Centro.',district:'Centro',city:'Nova Iguaçu',categories:['Padarias','Cafés'],image:foto,
    description:['Primeiro parágrafo.','Segundo parágrafo.'],socials:[{label:'Instagram',url:'https://instagram.com/exemplo'}],
    whatsappUrl:'https://wa.me/5521900000000',phoneUrl:'tel:2130000000',address:'Rua Exemplo, 10 - Centro',mapUrl:'https://www.google.com/maps/search/?api=1&query=Rua%20Exemplo',hours:'Seg a sex: 7h às 19h\nSáb: 7h às 13h',website:'https://exemplo.com.br/',
    catalog:[{kind:'product',name:'Pão de fermentação natural',description:'Unidade de 500 g',priceMode:'fixed',priceCents:1890},{kind:'offer',name:'Café da manhã',description:'Para duas pessoas',priceMode:'inquiry',priceCents:null}],
    photos:[{href:foto,src:foto}],street:'Rua Exemplo, 10',cep:'26000-000',directionsUrl:'https://www.google.com/maps/dir/?api=1&destination=-22.759,-43.451',
    openNow:true,closesAt:'19h',opensAt:'',opensDay:'',holiday:'',week:[{day:'segunda-feira',label:'7h às 19h',today:true},{day:'domingo',label:'Fechado',today:false}],
    rating:4.5,reviewsCount:2,reviews:[avaliacao,{...avaliacao,author:'João',rating:4,title:'',text:'Bom.'}],reviewsSource:'portal PRIMIG',units:[{slug:'padaria-exemplo-posse',name:'Padaria Exemplo Posse',district:'Posse'}],
    email:'contato@exemplo.com.br',videoUrl:'',features:['Estacionamento'],sponsored:false,plan:null,
    referencia:'Em frente à praça da matriz',pagamentos:['pix','debito','credito'],wazeUrl:'https://waze.com/ul?ll=-22.75,-43.45&navigate=yes',
    moradores:{media:4.5,total:2,itens:[{nome:'Ana',nota:5,texto:'Pão sempre fresquinho e atendimento rápido.',data:'10/10/2026'},{nome:'Caio',nota:4,texto:'Bom café, fila grande no sábado.',data:'02/10/2026'}]},
    avaliar:{conta:true,csrf:'csrf-exemplo',minha:null,bloqueio:''}},
  conteudos:{section:'artigos',label:'Artigos',q:'',pages:2,current:1,items:[cardConteudo],editorias:[{slug:'cidade',label:'Cidade',count:4},{slug:'saude',label:'Saúde',count:2}],editoria:'',destaque:{...cardConteudo,title:'Feira de bairro volta ao Centro',href:'/artigos/feira-de-bairro'}},
  conteudo:{section:'artigos',label:'Artigos',title:'Feira de exemplo no Centro',category:'Cidade',author:'',date:'20/09/2026',image:foto,paragraphs:['Primeiro parágrafo com <b>marcação</b> que deve sair escapada.','Segundo parágrafo.'],sourceUrl:'https://www.primigdivulgacao.com.br/noticia/exemplo',
    bodyHtml:corpo,editoria:{slug:'cidade',label:'Cidade'},editorias:[{slug:'cidade',label:'Cidade'},{slug:'baixada-fluminense',label:'Baixada Fluminense'}],readingMinutes:2,gallery:[{src:foto,alt:'Feira no Centro'}]},
  ofertas:{items:[oferta]},
  eventos:{items:[evento]},
  'para-empresas':{cadastro:{abertura:cadastroVm().abertura,novidades:cadastroVm().novidades,perguntas:perguntasCadastro.filter(p=>['ramo','local','plano'].includes(p.id))},
    plans:[{name:'Avançado',price:'R$ 67,00',period:'R$ 179,90 / 3 meses',features:['1 anúncio avançado'],interesse:'plano-avancado'},{name:'Personalizado',price:'A combinar',custom:true,features:['Pacote sob medida'],interesse:'plano-personalizado'}],
    campaigns:[{name:'Campanha Básica',price:'R$ 750,00',tier:'basic',concept:'Descoberta local',idea:'Apresentar a marca.',steps:['Anúncio','Visita ao perfil'],interesse:'campanha-basica'}],
    banners:[{name:'Quadrado',price:'R$ 79,90',period:'R$ 429,90 / 6 meses',size:'250 × 250',interesse:'banner-quadrado'}],
    fonte:'https://www.primigdivulgacao.com.br/anunciar'},
  cadastro:cadastroVm({plano:'plano-avancado'}),
  contato:{values:{},errors:[],whatsappUrl:'https://wa.me/5521900000000?text=Ol%C3%A1',telefone:'(21) 90000-0000'},
  sobre:{equipe:[{nome:'Leandro',funcao:'Atendimento às empresas',foto:'/midia/m1/800.webp'}]},
  institucional:{title:'Termos de uso',key:'termos'},
  'nao-encontrada':{},
  indisponivel:{},
  bairros:{map:mapa,bairros:[{slug:'centro',name:'Centro',city:'Nova Iguaçu',count:5},{slug:'posse',name:'Posse',city:'Nova Iguaçu',count:1},{slug:'centro-mesquita',name:'Centro',city:'Mesquita',count:2}]},
  bairro:{slug:'centro',name:'Centro',city:'Nova Iguaçu',total:14,pages:2,current:1,results:[cardEmpresa,cardEmpresaSemDados],map:mapa,outros:[{slug:'posse',name:'Posse',count:1}]}
};

// Views com espaço de anúncio (contrato 11.4): o vm real traz ads (ou {} quando nada aparece).
for(const view of ['home','busca','conteudos','conteudo','empresa','ofertas','eventos'])exemplos[view].ads=anuncios[view];

// Fase 3 (contrato 12): conta e painel do anunciante. `dados` de cada módulo é o GET da API do módulo (12.4); datas das APIs
// em aaaa-mm-dd.
export const usuario={id:'u-maria',email:'maria@padaria-exemplo.com.br',nome:'Maria Souza'};
const empresasPainel=[{id:'padaria-exemplo',slug:'padaria-exemplo',name:'Padaria <Exemplo>',papel:'dono'},{id:'oficina-exemplo',slug:'oficina-exemplo',name:'Oficina Exemplo',papel:'editor'}];
const dias=n=>Array.from({length:n},(_,i)=>new Date(Date.UTC(2026,8,4+i)).toISOString().slice(0,10));
const serie=(a,b,c)=>dias(a.length).map((dia,i)=>({dia,visitas:a[i],cliques:b[i],buscas:c[i]}));
// A "Minha assinatura" que a gestão manda (19.6), como o painel recebe em Resumo.contratado.assinatura.
export const minhaAssinatura={plano:{id:'basico',nome:'Básico'},valorCentavos:6700,ciclo:'mensal',venceEm:'2026-11-26',dias:31,situacao:'em-dia',
  ultimosPagamentos:[{pagoEm:'2026-10-26',valorCentavos:6700,forma:'pix',referencia:{de:'2026-10-26',ate:'2026-11-25'}},{pagoEm:'2026-09-25',valorCentavos:6700,forma:'transferencia',referencia:{de:'2026-09-26',ate:'2026-10-25'}}],
  comoPagar:{chavePix:'pix@primig.test',whatsapp:'5521900000000'},atualizadaEm:'2026-10-26T18:38:54.000Z'};
export const painelDados={
  resumo:{
    aparece:{status:'published',url:'/comercio/padaria-exemplo',completo:[{item:'foto',ok:true},{item:'horario',ok:true},{item:'whatsapp',ok:true},{item:'descricao',ok:false},{item:'endereco',ok:true},{item:'redes',ok:false}],visitas30:56,buscas30:230,card:cardEmpresa,visitas30Antes:44,buscas30Antes:241},
    depende:[{tipo:'completar',texto:'Escreva a descrição da empresa.',href:'/painel/padaria-exemplo/perfil#campo-descricao'},{tipo:'recusado',texto:'"Café da manhã para dois" voltou da aprovação: falta a validade da oferta.',href:'/painel/padaria-exemplo/catalogo#item-i2'},{tipo:'responder',texto:'A PRIMIG respondeu "Trocar o telefone".',href:'/painel/padaria-exemplo/solicitacoes#sol-s2'}],
    primig:{emAnalise:[{tipo:'foto',titulo:'Foto "Balcão"',desde:'2026-10-02'},{tipo:'catalogo',titulo:'Encomenda de bolos',desde:'2026-10-01'}],solicitacoes:[{id:'s1',assunto:'Banner para o Dia das Crianças',status:'em-andamento'}],banners:[{titulo:'Padaria Exemplo: café da manhã',espaco:'home-topo',ate:'2026-10-31'}]},
    contratado:{plano:null,banners:[],assinatura:null}},
  perfil:{version:3,nome:'Padaria <Exemplo>',rua:'Rua Exemplo, 10',bairro:'Centro',cidade:'Nova Iguaçu',cep:'26000-000',categorias:['Padarias'],imagem:'/midia/f1/800.webp',
    opcoes:{categorias,bairros:['Centro','Posse','Santa Rita']},horario:[{dia:1,abre:'07:00',fecha:'19:00'},{dia:2,abre:'07:00',fecha:'19:00'},{dia:3,abre:'07:00',fecha:'12:00'},{dia:3,abre:'14:00',fecha:'19:00'},{dia:4,abre:'07:00',fecha:'19:00'},{dia:5,abre:'07:00',fecha:'19:00'},{dia:6,abre:'07:00',fecha:'13:00'}],
    telefone:'(21) 3000-0000',whatsapp:'(21) 90000-0000',email:'contato@padaria-exemplo.com.br',site:'https://padaria-exemplo.com.br/',redes:[{rede:'Instagram',url:'https://instagram.com/padariaexemplo'}],
    resumo:'Pães artesanais e café da manhã no Centro de Nova Iguaçu.',descricao:'Primeiro parágrafo da descrição.\n\nSegundo parágrafo.',
    fotos:[{id:'f1',url:'/midia/f1/800.webp',largura:800,altura:600,alt:'Fachada da padaria',status:'aprovada',recusa:null},{id:'f2',url:'/midia/f2/800.webp',largura:800,altura:533,alt:'Balcão',status:'pendente',recusa:null},{id:'f3',url:'/midia/f3/800.webp',largura:800,altura:800,alt:'',status:'recusada',recusa:{comentario:'A foto está escura.',em:'2026-10-02'}}],emAnalise:['descricao']},
  catalogo:{itens:[
    {id:'i1',tipo:'produto',nome:'Pão de fermentação natural',descricao:'Unidade de 500 g.',precoModo:'fixo',precoCentavos:1890,condicoes:'',validade:'',status:'publicado',version:2,recusa:null},
    {id:'i2',tipo:'oferta',nome:'Café da manhã para dois',descricao:'Pães, frios, bolo e café.',precoModo:'fixo',precoCentavos:4990,condicoes:'De segunda a sexta, até as 10h.',validade:'',status:'rascunho',version:4,recusa:{comentario:'Falta a validade da oferta.',em:'2026-10-02'}},
    {id:'i3',tipo:'servico',nome:'Encomenda de bolos',descricao:'Bolos para festas, com 48 horas de antecedência.',precoModo:'a-partir',precoCentavos:8000,condicoes:'',validade:'',status:'validacao',version:1,recusa:null},
    {id:'i4',tipo:'produto',nome:'Panetone artesanal',descricao:'',precoModo:'consulta',precoCentavos:null,condicoes:'',validade:'',status:'pausado',version:3,recusa:null}]},
  resultados:{periodo:'30d',de:'2026-09-04',ate:'2026-10-03',anterior:{visitas:41,cliques:25,buscas:198,cupons:4},cupons:9,visitas:56,cliques:{whatsapp:12,telefone:5,rota:3,site:2},buscas:230,
    banners:[{id:'banner-padaria',titulo:'Padaria Exemplo: café da manhã',espaco:'home-topo',impressoes:1200,cliques:18}],
    serie:serie([1,3,2,0,4,2,1,2,3,1,0,2,5,2,1,3,2,1,2,0,1,3,2,4,1,2,1,3,2,2],[0,1,0,0,2,1,0,1,1,0,0,1,2,1,0,1,1,0,1,0,0,1,1,2,0,1,0,1,1,1],[6,8,7,5,9,8,7,8,9,6,5,8,11,8,7,9,8,7,8,6,7,9,8,10,7,8,7,9,8,8]),
    nota:'Visitas e cliques contam só os visitantes que aceitaram a medição. As aparições em buscas contam todas as páginas de resultado em que a empresa apareceu.'},
  solicitacoes:{solicitacoes:[
    {id:'s1',tipo:'criacao',assunto:'Banner para o Dia das Crianças',status:'em-andamento',criada:'2026-09-28',atualizada:'2026-10-01',briefing:{objetivo:'Divulgar os bolos temáticos.',formato:'Banner',prazo:'2026-10-10',referencias:'Cores da marca e foto dos bolos.'}},
    {id:'s2',tipo:'suporte',assunto:'Trocar o telefone',status:'respondida',criada:'2026-09-25',atualizada:'2026-09-26',briefing:null}]},
  acessos:{membros:[{usuario,papel:'dono',ativo:true,desde:'2026-09-24'},{usuario:{id:'u-joao',email:'joao@padaria-exemplo.com.br',nome:'João Lima'},papel:'editor',ativo:true,desde:'2026-09-30'}],
    convites:[{email:'financeiro@padaria-exemplo.com.br',papel:'financeiro',expira:'2026-10-10'}]}
};
export const painel=(modulo='resumo',extra={})=>({usuario,csrf:'csrf-exemplo-0123456789abcdef0123',empresas:empresasPainel,
  empresa:{id:'padaria-exemplo',slug:'padaria-exemplo',name:'Padaria <Exemplo>',status:'published',url:'/comercio/padaria-exemplo'},
  papel:'dono',pode:{perfil:true,catalogo:true,cupons:true,plano:true,solicitar:true,acessos:true},suporte:{whatsappUrl:'https://wa.me/5521982155579?text=Ol%C3%A1%2C+Leandro%21'},modulo,dados:modulo==='empresas'?null:painelDados[modulo],...extra});
exemplos.entrar={next:'/painel',motivo:''};
exemplos.recuperar={};
exemplos['definir-senha']={token:'token-exemplo-0123456789',tipo:'convite',valido:true,email:'maria@padaria-exemplo.com.br',empresa:'Padaria Exemplo',convidadoPor:'Equipe PRIMIG'};
exemplos.painel=painel();

// Fase 4 (contrato 13): admin da equipe. `dados` é o GET da lista do módulo com os filtros (13.2 e 13.9); na página de um
// registro (/admin/<modulo>/<id>), o GET do registro.
const equipeUsuario={id:'u-ana',email:'ana@primig.com.br',nome:'Ana Equipe'};
export const adminOpcoes={categorias,bairros:['Centro','Posse','Santa Rita'],planos:[{id:'p-premium',nome:'Premium'},{id:'p-avancado',nome:'Avançado'}],redes:[{id:'r-medic',nome:'Medic Saúde'}],
  empresas:[{id:'padaria-exemplo',nome:'Padaria Exemplo'},{id:'oficina-exemplo',nome:'Oficina Exemplo'}],editorias:[{slug:'cidade',label:'Cidade'},{slug:'saude',label:'Saúde'}],
  espacos:[{id:'home-topo',pagina:'home',onde:'logo depois da abertura',formatos:{computador:['super-banner'],celular:['link-patrocinado']},giram:3,casa:true},
    {id:'home-grade',pagina:'home',onde:'card na grade dos destaques',formatos:{computador:['quadrado'],celular:['quadrado']},giram:1,casa:false},
    {id:'busca-lateral',pagina:'busca',onde:'lateral em tela larga',formatos:{computador:['meia-pagina','exibir-lateral'],celular:[]},giram:1,casa:true}]};
const pagina=(itens,total=itens.length)=>({itens,total,pagina:1,paginas:Math.max(1,Math.ceil(total/20))});
export const adminRegistros={
  empresa:{id:'padaria-exemplo',slug:'padaria-exemplo',nome:'Padaria <Exemplo>',status:'publicado',bairro:'Centro',cidade:'Nova Iguaçu',rua:'Rua Exemplo, 10',cep:'26000-000',telefone:'(21) 3000-0000',whatsapp:'(21) 90000-0000',
    email:'contato@padaria-exemplo.com.br',site:'https://padaria-exemplo.com.br/',redes:[{rede:'Instagram',url:'https://instagram.com/padariaexemplo'}],resumo:'Pães artesanais no Centro.',descricao:'Primeiro parágrafo.',
    categorias:['Padarias'],rede:null,plano:'p-premium',destaque:true,imagem:'/midia/m1/800.webp',horario:[{dia:1,abre:'07:00',fecha:'19:00'}],gerida:true,planoGerido:false,atualizada:'2026-10-10',version:5},
  conteudo:{id:'c1',tipo:'artigo',slug:'feira-no-centro',titulo:'Feira de artesanato no Centro',resumo:'Artesãos e produtores da região.',html:'<p>A feira reúne artesãos.</p><h2>Como chegar</h2><ul><li>Ônibus até a praça.</li></ul>',
    autor:'Equipe PRIMIG',data:'2026-10-12',editorias:['Cidade'],imagem:'/midia/m1/800.webp',galeria:[],fonte:'',status:'rascunho',classificado:null,version:2},
  banner:{id:'b1',titulo:'Padaria Exemplo: café da manhã',anunciante:'Padaria Exemplo',empresa:'padaria-exemplo',espaco:'home-topo',formato:'super-banner',inicio:'2026-10-15',fim:'2026-11-14',
    destino:'/comercio/padaria-exemplo',peso:1,imagem:'/midia/m2/800.webp',imagemCelular:'/midia/m3/800.webp',status:'rascunho',version:1},
  solicitacao:{id:'s1',tipo:'criacao',assunto:'Banner para o Dia das Crianças',status:'aberta',version:3,criada:'2026-09-28',atualizada:'2026-10-01',empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},
    briefing:{objetivo:'Divulgar os bolos.',formato:'banner',prazo:'2026-10-10',referencias:''},mensagens:[{id:'msg1',autor:{nome:'Maria Souza',lado:'associado'},texto:'Quero um banner para os bolos.',em:'2026-09-28T10:00:00-03:00'}]}
};
export const adminDados={
  resumo:{recorte:null,fila:3,solicitacoes:2,empresas:{publicadas:41,pausadas:2},cupons:{ativos:7,coletas30:58},bannersNoAr:5,espacosLivres:11},
  empresas:pagina([{...adminRegistros.empresa},{id:'oficina-exemplo',slug:'oficina-exemplo',nome:'Oficina Exemplo',status:'pausado',bairro:'Posse',cidade:'Nova Iguaçu',categorias:['Oficina mecânica'],plano:null,destaque:false,gerida:false,planoGerido:false,atualizada:'2026-09-20',version:1}],43),
  conteudo:pagina([{...adminRegistros.conteudo},{id:'c2',tipo:'artigo',slug:'vacinacao',titulo:'Vacinação nos postos',resumo:'',autor:'',data:'2026-10-01',editorias:['Saúde'],imagem:'',status:'publicado',version:4}],109),
  banners:pagina([{...adminRegistros.banner}]),
  midia:pagina([{id:'m1',url:'/midia/m1/800.webp',largura:800,altura:600,tamanhos:{320:'/midia/m1/320.webp',800:'/midia/m1/800.webp',1600:'/midia/m1/800.webp'},alt:'Feira no Centro',version:1}]),
  fila:pagina([
    {id:'a1',tipo:'descricao',empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},recurso:'padaria-exemplo',dados:{resumo:'Pães e bolos.',descricao:'Texto novo.',antes:{resumo:'Pães artesanais.',descricao:'Texto antigo.'}},enviado:{por:'Maria Souza',em:'2026-10-02T09:30:00-03:00'},status:'pendente',comentario:'',decidido:null,version:1},
    {id:'a2',tipo:'oferta',empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},recurso:'i2',dados:{id:'i2',tipo:'oferta',nome:'Café da manhã para dois',descricao:'Pães e café.',precoModo:'fixo',precoCentavos:4990,condicoes:'Até as 10h.',validade:'2026-10-31',status:'validacao',version:5,recusa:null,antes:null},enviado:{por:'Maria Souza',em:'2026-10-02T10:00:00-03:00'},status:'pendente',comentario:'',decidido:null,version:1},
    {id:'a3',tipo:'foto',empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},recurso:'f2',dados:{id:'f2',url:'/midia/f2/800.webp',largura:800,altura:533,alt:'Balcão',status:'pendente',recusa:null},enviado:{por:'Maria Souza',em:'2026-10-02T11:00:00-03:00'},status:'pendente',comentario:'',decidido:null,version:1}]),
  relatorios:{periodo:'30d',de:'2026-09-15',ate:'2026-10-14',buscasSemResultado:[{termo:'conserto de celular',vezes:12},{termo:'pet shop',vezes:5}],maisVistas:[{empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},visitas:56,buscas:230}],
    cliques:{whatsapp:40,telefone:12,rota:9,site:4},banners:[{id:'b1',titulo:'Padaria Exemplo: café da manhã',espaco:'home-topo',impressoes:1200,cliques:18,ctr:0.015}],espacos:[{id:'home-topo',impressoes:3400,cliques:41,ctr:0.0121}]},
  auditoria:pagina([{id:'au1',em:'2026-10-02T09:30:00-03:00',acao:'perfil_alterado',empresa:'padaria-exemplo',recurso:'padaria-exemplo',por:{id:'u-maria',email:'maria@padaria-exemplo.com.br'},antes:{whatsapp:'(21) 9999-0000'},depois:{whatsapp:'(21) 90000-0000'},ip:'177.0.0.1'}]),
  usuarios:pagina([{id:'u-ana',email:'ana@primig.com.br',nome:'Ana Equipe',tipo:'equipe',equipe:'admin',desativado:false,acessos:[],version:1},
    {id:'u-maria',email:'maria@padaria-exemplo.com.br',nome:'Maria Souza',tipo:'associado',equipe:null,desativado:false,acessos:[{empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},papel:'dono',ativo:true}],version:2}]),
  solicitacoes:pagina([{...adminRegistros.solicitacao,mensagens:undefined}])
};
// Acessos ao painel (21.1, v0.21.0): uma empresa em cada situação, com os membros, os convites e o convite sugerido.
adminDados.acessos={...pagina([
  {empresa:{id:'boreal-tintas',nome:'Boreal Tintas',status:'publicado',bairro:'Centro'},situacao:'sem-conta',contato:{email:'contato@borealtintas.test',whatsapp:'5521988887777'},membros:[],convites:[],convite:{email:'contato@borealtintas.test',papel:'dono'}},
  {empresa:{id:'oficina-exemplo',nome:'Oficina Exemplo',status:'pausado',bairro:'Posse'},situacao:'convite-pendente',contato:{email:'',whatsapp:''},membros:[],convites:[{email:'joao@oficina.test',papel:'dono',expira:'2026-11-04T13:00:00.000Z',vencido:false}],convite:{email:'',papel:'dono'}},
  {empresa:{id:'rascunho-exemplo',nome:'Rascunho Exemplo',status:'rascunho',bairro:''},situacao:'convite-vencido',contato:{email:'ola@rascunho.test',whatsapp:''},membros:[],convites:[{email:'ola@rascunho.test',papel:'editor',expira:'2026-10-20T13:00:00.000Z',vencido:true}],convite:{email:'ola@rascunho.test',papel:'dono'}},
  {empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo',status:'publicado',bairro:'Centro'},situacao:'com-acesso',contato:{email:'contato@padaria-exemplo.com.br',whatsapp:'5521900000000'},
    membros:[{usuario:{id:'u-maria',email:'maria@padaria-exemplo.com.br',nome:'Maria Souza'},papel:'dono',desde:'2026-09-24T12:00:00.000Z'}],convites:[{email:'financeiro@padaria-exemplo.com.br',papel:'financeiro',expira:'2026-11-03T12:00:00.000Z',vencido:false}],convite:{email:'contato@padaria-exemplo.com.br',papel:'dono'}}]),
  contagem:{semConta:1,convitePendente:1,conviteVencido:1,comAcesso:1},acoes:{convidar:true,reenviar:true,cancelar:true}};
// A resposta do convite sem e-mail (21.3), o exemplo do contrato.
export const conviteAcesso={email:'contato@borealtintas.test',papel:'dono',expira:'2026-11-04T13:00:00.000Z',link:'https://primig.srv1779406.hstgr.cloud/entrar/definir-senha?token=EXEMPLO',enviado:false,ativo:false,
  whatsapp:'https://wa.me/5521988887777?text=Ol%C3%A1!%0A%0AVoc%C3%AA%20foi%20convidado%20para%20cuidar%20da%20empresa%20Boreal%20Tintas%20no%20Guia%20PRIMIG%2C%20com%20o%20papel%20%22dono%22.%0A%0APara%20criar%20sua%20senha%20e%20entrar%2C%20abra%20o%20link%20abaixo%20(vale%20at%C3%A9%2004%2F11%2F2026)%3A%0Ahttps%3A%2F%2Fprimig.srv1779406.hstgr.cloud%2Fentrar%2Fdefinir-senha%3Ftoken%3DEXEMPLO'};
// Categoria sugerida (22.4 e 22.5, v0.22.0): o item da fila, com as parecidas, e a sugestão no Perfil, pendente ou recusada.
export const filaCategoria={id:'a9',tipo:'categoria',empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'},recurso:'padaria-exemplo',status:'pendente',version:1,
  dados:{nome:'Pizzaria',grupo:{slug:'alimentacao',label:'Alimentação'},parecidas:[{nome:'Padarias',grupos:[{slug:'alimentacao',label:'Alimentação'}],empresas:3}]},
  enviado:{por:{id:'u-maria',email:'maria@padaria-exemplo.com.br'},em:'2026-10-29T10:00:00-03:00'}};
export const sugestaoCategoria={pendente:{nome:'Pizzaria',grupo:{slug:'alimentacao',label:'Alimentação'},status:'pendente',comentario:'',em:'2026-10-29T13:00:00.000Z'},
  recusada:{nome:'Pizzaria',grupo:{slug:'alimentacao',label:'Alimentação'},status:'recusada',comentario:'Use "Padarias": a empresa vende pizza no balcão.',em:'2026-10-29T15:00:00.000Z'}};
// Ocupação dos banners (aba "ocupacao", pedida ao back): um dia por data, com os banners e as vagas.
export const adminOcupacao={espacos:adminOpcoes.espacos.map((s,k)=>({id:s.id,pagina:s.pagina,onde:s.onde,giram:s.giram,casa:s.casa,
  dias:Array.from({length:14},(_,i)=>{const dia=new Date(Date.UTC(2026,9,15+i)).toISOString().slice(0,10),pagos=k===0&&i<10?[{id:'b1',titulo:'Padaria Exemplo: café da manhã',anunciante:'Padaria Exemplo'}]:[];return {dia,banners:pagos,livres:s.giram-pagos.length};})}))};
export const admin=(modulo='resumo',extra={})=>({usuario:equipeUsuario,csrf:'csrf-admin-0123456789abcdef0123',equipe:'admin',contagem:{fila:3,solicitacoes:2},
  pode:{empresas:true,conteudo:true,banners:true,midia:true,fila:true,cupons:true,planos:true,acessos:true,equipe:true,solicitacoes:true},
  modulo,filtros:{q:'',status:'',page:1},opcoes:adminOpcoes,dados:adminDados[modulo],...extra});
exemplos.admin=admin();

// v0.14.0 (contrato 14): cupons, conta de usuário e afiliado. O código só vem para quem já coletou.
export const cupomCard={id:'cp1',titulo:'10% no café da manhã',condicoes:'Vale de segunda a sexta, até as 10h, para consumo na loja.',validade:'2026-11-30',restantes:42,esgotado:false,href:'/cupons/cp1',
  empresa:{slug:'padaria-exemplo',name:'Padaria <Exemplo>',image:'',district:'Centro',category:'Padarias'},coletado:false,codigo:''};
export const cupomColetado={...cupomCard,id:'cp2',titulo:'Bolo de aniversário com 15%',href:'/cupons/cp2',restantes:null,coletado:true,codigo:'BOLO15'};
export const cupomEsgotado={...cupomCard,id:'cp3',titulo:'Pão de queijo em dobro',href:'/cupons/cp3',restantes:0,esgotado:true};
export const contaUsuario={tipo:'usuario',csrf:'csrf-usuario-0123456789abcdef0123'};
exemplos.cupons={items:[cupomCard,cupomColetado,cupomEsgotado],total:3,pages:1,current:1,q:'',categoria:'',categorias,conta:contaUsuario,ads:{}};
exemplos.cupom={cupom:cupomCard,outros:[cupomColetado],conta:contaUsuario};
exemplos['criar-conta']={next:''};
exemplos['minha-conta']={usuario:{id:'u-joana',email:'joana@exemplo.test',nome:'Joana',tipo:'usuario'},csrf:'csrf-usuario-0123456789abcdef0123',
  cupons:[{...cupomColetado,coletadoEm:'2026-10-10T14:00:00Z',situacao:'valido'},{...cupomCard,id:'cp4',coletado:true,codigo:'CAFE10',coletadoEm:'2026-09-01T12:00:00Z',situacao:'vencido',validade:'2026-09-30'},
    {...cupomCard,id:'cp5',coletado:true,codigo:'PAO2X',coletadoEm:'2026-09-20T12:00:00Z',situacao:'encerrado'}]};
exemplos.entrar={next:'/painel',motivo:'',tipo:'afiliado'};
exemplos.empresa={...exemplos.empresa,cupons:[cupomCard]};
// Cupons no painel (14.6): CupomPainel.
export const cupomPainel={id:'cp1',titulo:'10% no café da manhã',condicoes:'Vale de segunda a sexta, até as 10h, para consumo na loja.',codigo:'CAFE10',inicio:'',validade:'2026-11-30',quantidade:50,coletados:8,status:'ativo',suspensao:null,url:'/cupons/cp1',criado:'2026-10-10T12:00:00Z',version:2};
painelDados.cupons={cupons:[cupomPainel,{...cupomPainel,id:'cp6',titulo:'Pão de queijo em dobro',codigo:'PAO2X',coletados:0,quantidade:null,inicio:'2026-11-01',status:'agendado',url:'/cupons/cp6',version:1},
  {...cupomPainel,id:'cp7',titulo:'Bolo com 15%',codigo:'BOLO15',status:'suspenso',suspensao:{motivo:'Condições diferentes das da loja.',em:'2026-10-12T10:00:00Z'},url:'/cupons/cp7',version:4}]};
// Relatório do mês no painel (20.3, v0.20.0): o exemplo do contrato.
painelDados.relatorio={
  mes:'2026-11',rotulo:'novembro de 2026',anterior:{mes:'2026-10',rotulo:'outubro de 2026'},url:'/painel/boreal-tintas/relatorio/2026-11',
  disponiveis:[{mes:'2026-11',rotulo:'novembro de 2026',url:'/painel/boreal-tintas/relatorio/2026-11'},{mes:'2026-10',rotulo:'outubro de 2026',url:'/painel/boreal-tintas/relatorio/2026-10'},{mes:'2026-09',rotulo:'setembro de 2026',url:'/painel/boreal-tintas/relatorio/2026-09'}],
  series:{contatos:{medidoDesde:'2026-09-24',parcial:{atual:false,anterior:false}},aparicoes:{medidoDesde:'2026-10-15',parcial:{atual:false,anterior:true}},banners:{medidoDesde:'2026-10-03',parcial:{atual:false,anterior:true}}},
  visitas:{atual:412,anterior:365,diferenca:47},
  contatos:{whatsapp:{atual:41,anterior:35,diferenca:6},telefone:{atual:6,anterior:9,diferenca:-3},rota:{atual:14,anterior:12,diferenca:2},site:{atual:4,anterior:4,diferenca:0},total:{atual:65,anterior:60,diferenca:5}},
  aparicoes:{atual:1280,anterior:640,diferenca:null},
  banners:[{id:'boreal-tintas-novembro',titulo:'Tintas com 10% de desconto',impressoes:{atual:2310,anterior:820,diferenca:null},cliques:{atual:37,anterior:9,diferenca:null}}],
  nota:'Visitas e contatos contam só os visitantes que aceitaram a medição. As aparições na busca são contadas pelo servidor, sem dado pessoal. Mês sem medição aparece em branco, e o mês em que a medição começou no meio aparece como parcial.'};
// Cupons no admin (14.7): CupomPainel com a empresa.
adminDados.cupons={itens:[{...cupomPainel,empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'}},{...cupomPainel,id:'cp7',titulo:'Bolo com 15%',codigo:'BOLO15',status:'suspenso',suspensao:{motivo:'Condições diferentes das da loja.',em:'2026-10-12T10:00:00Z'},url:'/cupons/cp7',version:4,empresa:{id:'padaria-exemplo',nome:'Padaria Exemplo'}}],total:2,pagina:1,paginas:1};
