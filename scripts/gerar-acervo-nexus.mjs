// Gera o acervo demonstrativo 100% fictício do Nexus (Guia Gastronômico & Cultural do Rio de Janeiro)
// e as capas editoriais locais em p2/fotos/.
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cp = f => resolve(root, 'conteudo-portal', f);
const fotosDir = resolve(root, 'p2/fotos');

const PALETAS = {
  restaurantes: ['#1E3A5F', '#2E6B9E', '#F59E0B', 'Gastronomia'],
  'cafes-e-padarias': ['#3B2820', '#7C4D33', '#F5CBA7', 'Café & Padaria'],
  'bares-e-botecos': ['#1B2A4A', '#324B7C', '#38BDF8', 'Bar & Boteco'],
  'arte-e-cultura': ['#2D1B4E', '#5B3A8C', '#C084FC', 'Arte & Cultura'],
  'livrarias-e-cinema': ['#133337', '#1E5F65', '#5EEAD4', 'Livros & Cinema'],
  'musica-e-palcos': ['#3D1530', '#7A285B', '#F472B6', 'Música ao Vivo'],
  'parques-e-lazer': ['#143628', '#226146', '#6EE7B7', 'Ao Ar Livre'],
  experiencias: ['#1E293B', '#334155', '#60A5FA', 'Experiência']
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function coverSVG({ title, subtitle, tag, group, seed = 1 }) {
  const [c1, c2, acc] = PALETAS[group] || PALETAS.experiencias;
  const cx1 = 520 + (seed * 37) % 180;
  const cy1 = 80 + (seed * 53) % 140;
  const cx2 = 120 + (seed * 71) % 200;
  const cy2 = 340 + (seed * 29) % 100;
  const words = title.split(' ');
  let l1 = '', l2 = '';
  for (const w of words) {
    if ((l1 + ' ' + w).trim().length <= 22) l1 = (l1 + ' ' + w).trim();
    else l2 = (l2 + ' ' + w).trim();
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="800" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${acc}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${acc}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bg)"/>
  <circle cx="${cx1}" cy="${cy1}" r="220" fill="url(#glow)"/>
  <circle cx="${cx2}" cy="${cy2}" r="180" fill="url(#glow)"/>
  <g opacity="0.14" stroke="#FFFFFF" stroke-width="1.2">
    <path d="M0 100H800M0 200H800M0 300H800M0 400H800"/>
    <path d="M160 0V500M320 0V500M480 0V500M640 0V500"/>
  </g>
  <g opacity="0.24" stroke="${acc}" stroke-width="2">
    <circle cx="${cx1}" cy="${cy1}" r="54"/>
    <circle cx="${cx1}" cy="${cy1}" r="96" stroke-dasharray="6 8"/>
    <path d="M${cx1 - 96} ${cy1} L${cx2} ${cy2}" stroke-dasharray="4 6"/>
    <circle cx="${cx2}" cy="${cy2}" r="10" fill="${acc}"/>
  </g>
  <rect x="48" y="48" width="${Math.min(340, 28 + tag.length * 10)}" height="34" rx="17" fill="#FFFFFF" fill-opacity="0.14"/>
  <text x="66" y="70" fill="#FFFFFF" font-family="Plus Jakarta Sans, Segoe UI, system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="0.1em">${esc(tag.toUpperCase())}</text>
  <text x="48" y="${l2 ? 320 : 352}" fill="#FFFFFF" font-family="Plus Jakarta Sans, Segoe UI, system-ui, sans-serif" font-size="44" font-weight="800" letter-spacing="-0.02em">${esc(l1)}</text>
  ${l2 ? `<text x="48" y="372" fill="#FFFFFF" font-family="Plus Jakarta Sans, Segoe UI, system-ui, sans-serif" font-size="44" font-weight="800" letter-spacing="-0.02em">${esc(l2)}</text>` : ''}
  <text x="48" y="424" fill="#E2E8F0" font-family="Plus Jakarta Sans, Segoe UI, system-ui, sans-serif" font-size="20" font-weight="500">${esc(subtitle)}</text>
  <text x="48" y="464" fill="${acc}" font-family="Plus Jakarta Sans, Segoe UI, system-ui, sans-serif" font-size="13" font-weight="700" letter-spacing="0.14em">NEXUS · RIO DE JANEIRO</text>
</svg>
`;
}

const HORARIO_DIURNO = [
  { dia: 'DOM', horas: ['09:00 - 18:00'] },
  { dia: 'SEG', horas: ['08:00 - 19:00'] },
  { dia: 'TER', horas: ['08:00 - 19:00'] },
  { dia: 'QUA', horas: ['08:00 - 19:00'] },
  { dia: 'QUI', horas: ['08:00 - 19:00'] },
  { dia: 'SEX', horas: ['08:00 - 20:00'] },
  { dia: 'SAB', horas: ['09:00 - 20:00'] }
];
const HORARIO_RESTAURANTE = [
  { dia: 'DOM', horas: ['12:00 - 22:00'] },
  { dia: 'SEG', horas: ['12:00 - 22:00'] },
  { dia: 'TER', horas: ['12:00 - 23:00'] },
  { dia: 'QUA', horas: ['12:00 - 23:00'] },
  { dia: 'QUI', horas: ['12:00 - 23:00'] },
  { dia: 'SEX', horas: ['12:00 - 23:59'] },
  { dia: 'SAB', horas: ['12:00 - 23:59'] }
];
const HORARIO_NOTURNO = [
  { dia: 'DOM', horas: ['16:00 - 23:00'] },
  { dia: 'TER', horas: ['17:00 - 23:59'] },
  { dia: 'QUA', horas: ['17:00 - 23:59'] },
  { dia: 'QUI', horas: ['17:00 - 23:59'] },
  { dia: 'SEX', horas: ['17:00 - 23:59'] },
  { dia: 'SAB', horas: ['15:00 - 23:59'] }
];
const HORARIO_CULTURAL = [
  { dia: 'DOM', horas: ['10:00 - 19:00'] },
  { dia: 'TER', horas: ['10:00 - 20:00'] },
  { dia: 'QUA', horas: ['10:00 - 20:00'] },
  { dia: 'QUI', horas: ['10:00 - 21:00'] },
  { dia: 'SEX', horas: ['10:00 - 21:00'] },
  { dia: 'SAB', horas: ['10:00 - 21:00'] }
];

const LOCAIS = [
  {
    slug: 'bistro-mare-alta',
    nome: 'Bistrô Maré Alta',
    iniciais: 'BM',
    plano: 'Destaque',
    destaque: true,
    grupo: 'restaurantes',
    categorias: ['Bistrôs', 'Frutos do Mar'],
    bairro: 'Botafogo',
    rua: 'Rua Arnaldo Quintela, 64',
    cep: '22280-070',
    lat: -22.9532, lng: -43.1846,
    telefone: '(21) 3000-1101', whatsapp: '5521990001101',
    email: 'contato@bistromarealta.demo',
    resumo: 'Cozinha carioca contemporânea com peixes frescos da costa, carta de vinhos naturais e mesas na calçada em Botafogo.',
    descricao: [
      'O Bistrô Maré Alta combina ingredientes sazonais de produtores fluminenses com técnicas contemporâneas em um casarão restaurado em Botafogo.',
      'O cardápio muda a cada estação e oferece menu executivo no almoço, pratos para compartilhar à noite e harmonização com vinhos brasileiros de pequenos produtores.'
    ],
    horarios: HORARIO_RESTAURANTE,
    caracteristicas: ['Mesas ao ar livre', 'Carta de vinhos naturais', 'Opções vegetarianas', 'Acessível para cadeirantes'],
    avaliacoes: [
      { autor: 'Camila Duarte', data: '12 de outubro, 2026', estrelas: 5, titulo: 'Peixe do dia impecável', texto: 'Ambiente acolhedor, atendimento muito atento e o arroz de polvo estava excelente.' },
      { autor: 'Rafael Menezes', data: '28 de setembro, 2026', estrelas: 5, titulo: 'Ótimo para jantar em Botafogo', texto: 'Menu bem pensado e boa seleção de vinhos em taça.' }
    ]
  },
  {
    slug: 'cafe-mirante-santa',
    nome: 'Café Mirante Santa',
    iniciais: 'CM',
    plano: 'Destaque',
    destaque: true,
    grupo: 'cafes-e-padarias',
    categorias: ['Cafeterias Especiais', 'Confeitarias'],
    bairro: 'Santa Teresa',
    rua: 'Rua Almirante Alexandrino, 512',
    cep: '20241-260',
    lat: -22.9219, lng: -43.1862,
    telefone: '(21) 3000-1102', whatsapp: '5521990001102',
    email: 'ola@cafemirantesanta.demo',
    resumo: 'Cafés especiais de torra própria, métodos filtrados e bolos artesanais em uma varanda com vista para o casario de Santa Teresa.',
    descricao: [
      'Instalado em um sobrado histórico próximo ao trajeto do bonde, o Café Mirante Santa trabalha com microlotes da Serra Fluminense e do Sul de Minas.',
      'Ideal para trabalhar com calma pela manhã ou fazer uma pausa à tarde com pão de queijo na chapa, bolo de fubá cremoso e cold brew da casa.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Torra própria', 'Wi-Fi rápido', 'Varanda arborizada', 'Pet friendly'],
    avaliacoes: [
      { autor: 'Juliana Costa', data: '04 de novembro, 2026', estrelas: 5, titulo: 'Melhor filtrado de Santa Teresa', texto: 'A varanda é linda e o barista explica direitinho cada grão do dia.' }
    ]
  },
  {
    slug: 'boteco-do-arco',
    nome: 'Boteco do Arco',
    iniciais: 'BA',
    plano: 'Destaque',
    destaque: true,
    grupo: 'bares-e-botecos',
    categorias: ['Botecos Tradicionais', 'Casas de Samba e Choro'],
    bairro: 'Lapa',
    rua: 'Rua do Lavradio, 148',
    cep: '20230-070',
    lat: -22.9114, lng: -43.1823,
    telefone: '(21) 3000-1103', whatsapp: '5521990001103',
    email: 'reservas@botecodoarco.demo',
    resumo: 'Petiscos clássicos de botequim, chope tirado na pressão certa e roda de samba acústica às quintas e sábados na Lapa.',
    descricao: [
      'Na Rua do Lavradio, o Boteco do Arco preserva o clima dos antigos botequins cariocas com bolinho de feijoada, carne-seca acebolada e cachaças artesanais do interior do Rio.',
      'A programação musical privilegia samba de raiz e choro instrumental sem cobrança de consumação mínima.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['Música ao vivo', 'Chope artesanal', 'Petiscos clássicos', 'Mesas na calçada'],
    avaliacoes: [
      { autor: 'Thiago Nogueira', data: '19 de outubro, 2026', estrelas: 5, titulo: 'Roda de samba autêntica', texto: 'Bolinho crocante, chope gelado e som na altura perfeita para conversar.' }
    ]
  },
  {
    slug: 'galeria-cais-aberto',
    nome: 'Galeria Cais Aberto',
    iniciais: 'GC',
    plano: 'Destaque',
    destaque: true,
    grupo: 'arte-e-cultura',
    categorias: ['Galerias de Arte', 'Centros Culturais'],
    bairro: 'Centro',
    rua: 'Rua Sacadura Cabral, 120',
    cep: '20081-262',
    lat: -22.8982, lng: -43.1838,
    telefone: '(21) 3000-1104', whatsapp: '5521990001104',
    email: 'curadoria@galeriacaisaberto.demo',
    resumo: 'Espaço de arte contemporânea na zona portuária com exposições gratuitas, fotografia urbana e encontros com artistas.',
    descricao: [
      'Ocupando um antigo armazém revitalizado perto do Cais do Valongo, a Galeria Cais Aberto recebe mostras rotativas de pintura, fotografia e instalações sonoras.',
      'Aos sábados, oferece visitas mediadas gratuitas e oficinas abertas para jovens artistas e estudantes.'
    ],
    horarios: HORARIO_CULTURAL,
    caracteristicas: ['Entrada gratuita', 'Visitas mediadas', 'Loja de gravuras', 'Acessível para cadeirantes'],
    avaliacoes: [
      { autor: 'Beatriz Almeida', data: '01 de novembro, 2026', estrelas: 5, titulo: 'Curadoria inspiradora', texto: 'Espaço amplo, bem iluminado e sempre com artistas locais incríveis.' }
    ]
  },
  {
    slug: 'livraria-folha-e-fogo',
    nome: 'Livraria Folha & Fogo',
    iniciais: 'LF',
    plano: 'Destaque',
    destaque: true,
    grupo: 'livrarias-e-cinema',
    categorias: ['Livrarias Independentes', 'Cafeterias Especiais'],
    bairro: 'Laranjeiras',
    rua: 'Rua das Laranjeiras, 210',
    cep: '22240-003',
    lat: -22.9334, lng: -43.1869,
    telefone: '(21) 3000-1105', whatsapp: '5521990001105',
    email: 'livros@folhaefogo.demo',
    resumo: 'Livraria de rua com curadoria de editoras independentes, clube de leitura semanal e pequeno balcão de espresso.',
    descricao: [
      'A Folha & Fogo reúne literatura brasileira contemporânea, poesia, quadrinhos autorais e livros de arte em um ambiente tranquilo em Laranjeiras.',
      'Toda quarta-feira à noite promove lançamentos e rodas de conversa com escritores e tradutores.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Editoras independentes', 'Clube do livro', 'Café no local', 'Encomenda de títulos'],
    avaliacoes: [
      { autor: 'Mariana Lopes', data: '15 de outubro, 2026', estrelas: 5, titulo: 'Curadoria feita com carinho', texto: 'Sempre saio com alguma descoberta que não encontraria em grandes redes.' }
    ]
  },
  {
    slug: 'forno-carioca-pizzaria',
    nome: 'Forno Carioca Pizzaria',
    iniciais: 'FC',
    plano: 'Destaque',
    destaque: true,
    grupo: 'restaurantes',
    categorias: ['Pizzarias', 'Bistrôs'],
    bairro: 'Copacabana',
    rua: 'Rua Bolívar, 88',
    cep: '22061-020',
    lat: -22.9742, lng: -43.1895,
    telefone: '(21) 3000-1106', whatsapp: '5521990001106',
    email: 'pedidos@fornocarioca.demo',
    resumo: 'Pizzas de longa fermentação natural (48h) assadas em forno a lenha, com queijos artesanais da Serra da Canastra.',
    descricao: [
      'A Forno Carioca une a tradição da massa napolitana de fermentação lenta a ingredientes brasileiros selecionados, como queijo coalho tostado, manjericão orgânico e mel silvestre.',
      'Salão climatizado a duas quadras da praia de Copacabana e opções veganas preparadas na hora.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['Forno a lenha', 'Fermentação natural 48h', 'Opções veganas', 'Retirada no balcão'],
    avaliacoes: [
      { autor: 'Lucas Ferreira', data: '22 de outubro, 2026', estrelas: 5, titulo: 'Massa levíssima', texto: 'Borda aerada, molho fresco e atendimento rápido mesmo na sexta à noite.' }
    ]
  },
  {
    slug: 'cine-estacao-carioca',
    nome: 'Cine Estação Carioca',
    iniciais: 'CE',
    plano: 'Destaque',
    destaque: true,
    grupo: 'livrarias-e-cinema',
    categorias: ['Cinemas de Rua', 'Centros Culturais'],
    bairro: 'Botafogo',
    rua: 'Rua Voluntários da Pátria, 95',
    cep: '22270-000',
    lat: -22.9511, lng: -43.1831,
    telefone: '(21) 3000-1107', whatsapp: '5521990001107',
    email: 'bilheteria@cineestacaocarioca.demo',
    resumo: 'Cinema de rua com 3 salas de projeção digital, mostras de cinema nacional, sessões comentadas e café no foyer.',
    descricao: [
      'Ponto de encontro dos cinéfilos da Zona Sul, o Cine Estação Carioca exibe lançamentos autorais, clássicos restaurados e festivais temáticos durante todo o ano.',
      'O foyer conta com livraria de cinema e área de convivência antes e depois das sessões.'
    ],
    horarios: HORARIO_CULTURAL,
    caracteristicas: ['Cinema de rua', 'Sessões comentadas', 'Meia-entrada às quartas', 'Café no foyer'],
    avaliacoes: [
      { autor: 'André Souza', data: '03 de novembro, 2026', estrelas: 5, titulo: 'Programação imperdível', texto: 'Excelente som, poltronas confortáveis e filmes que não entram no circuito comercial.' }
    ]
  },
  {
    slug: 'casa-choro-laranjeiras',
    nome: 'Casa do Choro Laranjeiras',
    iniciais: 'CC',
    plano: 'Destaque',
    destaque: true,
    grupo: 'musica-e-palcos',
    categorias: ['Rodas de Samba', 'Jazz e Instrumental'],
    bairro: 'Laranjeiras',
    rua: 'Rua General Glicério, 140',
    cep: '22245-120',
    lat: -22.9362, lng: -43.1889,
    telefone: '(21) 3000-1108', whatsapp: '5521990001108',
    email: 'agenda@casachorolaranjeiras.demo',
    resumo: 'Palco dedicado ao choro, jazz brasileiro e música instrumental, com oficinas de violão 7 cordas e pandeiro.',
    descricao: [
      'Localizada perto da tradicional Praça General Glicério, a Casa do Choro Laranjeiras promove apresentações intimistas de quarta a domingo e preserva partituras históricas.',
      'O bar interno serve caldinhos, empadinhas artesanais e drinks com frutas brasileiras.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['Acústica tratada', 'Oficinas musicais', 'Bar de petiscos', 'Programação semanal'],
    avaliacoes: [
      { autor: 'Fernanda Prado', data: '27 de outubro, 2026', estrelas: 5, titulo: 'Noite mágica', texto: 'Músicos de altíssimo nível e clima super respeitoso com quem está ouvindo.' }
    ]
  },
  {
    slug: 'torrefacao-arpoador',
    nome: 'Torrefação Arpoador',
    iniciais: 'TA',
    plano: 'Avançado',
    destaque: true,
    grupo: 'cafes-e-padarias',
    categorias: ['Cafeterias Especiais', 'Padarias Artesanais'],
    bairro: 'Ipanema',
    rua: 'Rua Francisco Otaviano, 72',
    cep: '22080-040',
    lat: -22.9866, lng: -43.1922,
    telefone: '(21) 3000-1109', whatsapp: '5521990001109',
    email: 'oi@torrefacaoarpoador.demo',
    resumo: 'Microtorrefação e brunch pós-praia em Ipanema com pães de fermentação natural, tostadas e grãos para levar.',
    descricao: [
      'A poucos passos do Arpoador, a casa torra grãos frescos toda terça-feira e serve brunch diário com ovos caipiras, avocado toast e croissants laminados na manteiga.',
      'Também realiza degustações guiadas de métodos de extração aos sábados pela manhã.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Brunch diário', 'Grãos em pacote', 'Bicicletário', 'Pet friendly'],
    avaliacoes: [
      { autor: 'Pedro Henrique', data: '09 de novembro, 2026', estrelas: 5, titulo: 'Pós-praia perfeito', texto: 'Croissant crocante e espresso muito bem tirado.' }
    ]
  },
  {
    slug: 'teatro-rua-nova',
    nome: 'Teatro Rua Nova',
    iniciais: 'TR',
    plano: 'Avançado',
    destaque: true,
    grupo: 'arte-e-cultura',
    categorias: ['Teatros', 'Centros Culturais'],
    bairro: 'Flamengo',
    rua: 'Rua Marquês de Abrantes, 118',
    cep: '22230-061',
    lat: -22.9369, lng: -43.1764,
    telefone: '(21) 3000-1110', whatsapp: '5521990001110',
    email: 'producao@teatroruanova.demo',
    resumo: 'Teatro independente no Flamengo com dramaturgia contemporânea, espetáculos infantis aos fins de semana e saraus.',
    descricao: [
      'Com 180 lugares em arena flexível, o Teatro Rua Nova fomenta companhias independentes do Rio de Janeiro, oferecendo ingressos a preços populares às quintas-feiras.',
      'O pátio interno recebe feiras de zines e conversas com elencos após as sessões.'
    ],
    horarios: HORARIO_CULTURAL,
    caracteristicas: ['Ingressos populares às quintas', 'Programação infantil', 'Ar-condicionado', 'Próximo ao metrô'],
    avaliacoes: []
  },
  {
    slug: 'emporio-vinhos-guanabara',
    nome: 'Empório & Vinhos Guanabara',
    iniciais: 'EV',
    plano: 'Avançado',
    destaque: true,
    grupo: 'bares-e-botecos',
    categorias: ['Wine Bars', 'Degustações'],
    bairro: 'Flamengo',
    rua: 'Rua Paissandu, 165',
    cep: '22210-080',
    lat: -22.9331, lng: -43.1781,
    telefone: '(21) 3000-1111', whatsapp: '5521990001111',
    email: 'adega@vinhosguanabara.demo',
    resumo: 'Wine bar e empório de queijos artesanais com mais de 120 rótulos sul-americanos e degustações harmonizadas.',
    descricao: [
      'Sob as palmeiras imperiais da Rua Paissandu, o Empório & Vinhos Guanabara oferece tábuas de queijos de leite cru, charcutaria artesanal e vinhos em taça com atendimento descomplicado.',
      'Todas as sextas realiza degustações temáticas comentadas por sommeliers convidados.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['Vinhos em taça', 'Queijos artesanais', 'Degustações às sextas', 'Mesas externas'],
    avaliacoes: []
  },
  {
    slug: 'atelie-barro-vivo',
    nome: 'Ateliê Barro Vivo',
    iniciais: 'AB',
    plano: 'Avançado',
    destaque: true,
    grupo: 'experiencias',
    categorias: ['Oficinas Criativas', 'Galerias de Arte'],
    bairro: 'Santa Teresa',
    rua: 'Rua Paschoal Carlos Magno, 84',
    cep: '20240-290',
    lat: -22.9204, lng: -43.1841,
    telefone: '(21) 3000-1112', whatsapp: '5521990001112',
    email: 'oficinas@barrovivo.demo',
    resumo: 'Estúdio de cerâmica autoral em Santa Teresa com oficinas de torno e modelagem manual para iniciantes e loja de peças.',
    descricao: [
      'No coração do Largo dos Guimarães, o Ateliê Barro Vivo abre suas bancadas para oficinas avulsas de fim de semana e cursos mensais de cerâmica em alta temperatura.',
      'A loja anexa reúne louças feitas à mão usadas por restaurantes parceiros da cidade.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Oficinas para iniciantes', 'Material incluso', 'Loja de cerâmica autoral', 'Grupos pequenos'],
    avaliacoes: []
  },
  {
    slug: 'sabores-da-praca-tijuca',
    nome: 'Sabores da Praça Tijuca',
    iniciais: 'SP',
    plano: 'Avançado',
    destaque: false,
    grupo: 'restaurantes',
    categorias: ['Cozinha Brasileira', 'Comida Vegetariana'],
    bairro: 'Tijuca',
    rua: 'Rua Conde de Bonfim, 410',
    cep: '20520-054',
    lat: -22.9255, lng: -43.2358,
    telefone: '(21) 3000-1113', whatsapp: '5521990001113',
    email: 'cozinha@saboresdapraca.demo',
    resumo: 'Restaurante de cozinha afetiva brasileira na Tijuca com pratos do dia, moqueca de banana-da-terra e sucos frescos.',
    descricao: [
      'Perto da Praça Saens Peña, o Sabores da Praça valoriza receitas caseiras com ingredientes frescos de feiras livres, oferecendo pratos fartos no almoço e opções vegetarianas criativas.',
      'Ambiente familiar, rápido no horário comercial e tranquilo nos fins de semana.'
    ],
    horarios: HORARIO_RESTAURANTE,
    caracteristicas: ['Prato do dia', 'Opções vegetarianas', 'Sucos naturais', 'Próximo ao metrô'],
    avaliacoes: []
  },
  {
    slug: 'taberna-do-cais',
    nome: 'Taberna do Cais',
    iniciais: 'TC',
    plano: 'Avançado',
    destaque: false,
    grupo: 'bares-e-botecos',
    categorias: ['Cervejarias Artesanais', 'Botecos Tradicionais'],
    bairro: 'Centro',
    rua: 'Rua do Ouvidor, 38',
    cep: '20010-150',
    lat: -22.9029, lng: -43.1759,
    telefone: '(21) 3000-1114', whatsapp: '5521990001114',
    email: 'taproom@tabernadocais.demo',
    resumo: 'Taproom com 12 torneiras rotativas de cervejarias independentes fluminenses e happy hour animado no Centro Histórico.',
    descricao: [
      'A Taberna do Cais celebra a cena cervejeira do Estado do Rio com IPAs frescas, pilsens leves e sours de frutas tropicais, acompanhadas de sanduíches no pão brioche.',
      'Às sextas-feiras o happy hour toma a rua de pedestres com jazz e samba.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['12 torneiras artesanais', 'Growler station', 'Happy hour no Centro', 'Rua de pedestres'],
    avaliacoes: []
  },
  {
    slug: 'padaria-fermento-lento',
    nome: 'Padaria Fermento Lento',
    iniciais: 'PF',
    plano: 'Avançado',
    destaque: false,
    grupo: 'cafes-e-padarias',
    categorias: ['Padarias Artesanais', 'Confeitarias'],
    bairro: 'Gávea',
    rua: 'Rua Marquês de São Vicente, 78',
    cep: '22451-040',
    lat: -22.9766, lng: -43.2286,
    telefone: '(21) 3000-1115', whatsapp: '5521990001115',
    email: 'fornada@fermentolento.demo',
    resumo: 'Padaria artesanal na Gávea com pães de levain, focaccias de alecrim, folhados franceses e café coado na hora.',
    descricao: [
      'Com fornadas saindo ao longo da manhã, a Fermento Lento produz pães rústicos de fermentação natural com farinhas orgânicas, além de brioches, tortas de frutas e sanduíches quentes.',
      'As mesinhas na calçada arborizada fazem do endereço um clássico matinal da Gávea.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Fornadas diárias', 'Farinhas orgânicas', 'Mesas na calçada', 'Encomendas'],
    avaliacoes: []
  },
  {
    slug: 'espaco-cultural-solar',
    nome: 'Espaço Cultural Solar',
    iniciais: 'ES',
    plano: 'Avançado',
    destaque: false,
    grupo: 'arte-e-cultura',
    categorias: ['Museus', 'Centros Culturais'],
    bairro: 'Centro',
    rua: 'Praça XV de Novembro, 42',
    cep: '20010-010',
    lat: -22.9036, lng: -43.1732,
    telefone: '(21) 3000-1116', whatsapp: '5521990001116',
    email: 'visitas@espacosolar.demo',
    resumo: 'Centro cultural dedicado à memória arquitetônica do Rio, com acervo fotográfico, biblioteca aberta e café no pátio.',
    descricao: [
      'Situado em um edifício histórico na Praça XV, o Espaço Cultural Solar reúne exposições permanentes sobre a evolução urbana do Rio e mostras temporárias de design e arquitetura.',
      'A biblioteca de artes visuais é aberta para consulta pública e pesquisa.'
    ],
    horarios: HORARIO_CULTURAL,
    caracteristicas: ['Acervo fotográfico', 'Biblioteca aberta', 'Café no pátio', 'Entrada acessível'],
    avaliacoes: []
  },
  {
    slug: 'bar-da-laje-gavea',
    nome: 'Terraço Jazz Gávea',
    iniciais: 'TJ',
    plano: 'Avançado',
    destaque: false,
    grupo: 'musica-e-palcos',
    categorias: ['Jazz e Instrumental', 'Casas de Show'],
    bairro: 'Gávea',
    rua: 'Praça Santos Dumont, 114',
    cep: '22470-060',
    lat: -22.9735, lng: -43.2267,
    telefone: '(21) 3000-1117', whatsapp: '5521990001117',
    email: 'palco@terracojazzgavea.demo',
    resumo: 'Clube de jazz e música brasileira no Baixo Gávea com coquetelaria autoral e jam sessions às quartas-feiras.',
    descricao: [
      'No segundo andar de um sobrado na Praça Santos Dumont, o Terraço Jazz Gávea recebe quartetos de jazz, bossa nova e soul brasileiro em clima intimista.',
      'A carta de drinks autorais usa ingredientes botânicos e xaropes feitos na casa.'
    ],
    horarios: HORARIO_NOTURNO,
    caracteristicas: ['Jam sessions às quartas', 'Coquetelaria autoral', 'Reservas antecipadas', 'Climatizado'],
    avaliacoes: []
  },
  {
    slug: 'sushi-brisa-ipanema',
    nome: 'Sushi Brisa Ipanema',
    iniciais: 'SB',
    plano: 'Avançado',
    destaque: false,
    grupo: 'restaurantes',
    categorias: ['Culinária Japonesa', 'Frutos do Mar'],
    bairro: 'Ipanema',
    rua: 'Rua Maria Quitéria, 102',
    cep: '22410-040',
    lat: -22.9838, lng: -43.2066,
    telefone: '(21) 3000-1118', whatsapp: '5521990001118',
    email: 'balcao@sushibrisa.demo',
    resumo: 'Balcão japonês autoral em Ipanema com omakase de peixes da costa brasileira, sakes artesanais e pratos quentes.',
    descricao: [
      'O Sushi Brisa une cortes precisos da culinária japonesa a pescados frescos do litoral fluminense, como olho-de-boi, pargo e cavala.',
      'Além do omakase no balcão para 12 pessoas, o salão oferece combinados, lámen artesanal e sobremesas de matchá.'
    ],
    horarios: HORARIO_RESTAURANTE,
    caracteristicas: ['Balcão omakase', 'Peixes da costa', 'Carta de sakes', 'Reservas recomendadas'],
    avaliacoes: []
  },
  {
    slug: 'feira-criativa-do-largo',
    nome: 'Feira Criativa do Largo',
    iniciais: 'FL',
    plano: 'Avançado',
    destaque: false,
    grupo: 'parques-e-lazer',
    categorias: ['Feiras ao Ar Livre', 'Mirantes e Praças'],
    bairro: 'Copacabana',
    rua: 'Praça Edmundo Bittencourt, s/n',
    cep: '22040-030',
    lat: -22.9679, lng: -43.1872,
    telefone: '(21) 3000-1119', whatsapp: '5521990001119',
    email: 'contato@feiracriativadolargo.demo',
    resumo: 'Feira quinzenal ao ar livre reunindo produtores gastronômicos, vinis, cerâmica, moda autoral e música acústica.',
    descricao: [
      'Realizada na Praça Edmundo Bittencourt, no Bairro Peixoto em Copacabana, a Feira Criativa do Largo reúne mais de 40 expositores locais em um ambiente arborizado e familiar.',
      'Conta com barracas de comidas artesanais, espaço infantil e pocket shows gratuitos.'
    ],
    horarios: [
      { dia: 'SAB', horas: ['10:00 - 19:00'] },
      { dia: 'DOM', horas: ['10:00 - 18:00'] }
    ],
    caracteristicas: ['Ao ar livre', 'Entrada gratuita', 'Pet friendly', 'Produtores locais'],
    avaliacoes: []
  },
  {
    slug: 'roteiros-rio-a-pe',
    nome: 'Roteiros Rio a Pé',
    iniciais: 'RP',
    plano: 'Avançado',
    destaque: false,
    grupo: 'experiencias',
    categorias: ['Tours Gastronômicos', 'Jardins e Parques'],
    bairro: 'Tijuca',
    rua: 'Praça Afonso Pena, 50',
    cep: '20270-244',
    lat: -22.9178, lng: -43.2182,
    telefone: '(21) 3000-1120', whatsapp: '5521990001120',
    email: 'passeios@rioape.demo',
    resumo: 'Caminhadas guiadas de história, arquitetura e sabores por bairros tradicionais do Rio, com paradas em cafés e botecos.',
    descricao: [
      'Criado por guias historiadores cariocas, o Roteiros Rio a Pé promove percursos temáticos pela Tijuca, Centro Histórico, Santa Teresa e Pequena África.',
      'Os grupos são reduzidos (até 15 pessoas) e incluem degustações em estabelecimentos parceiros do bairro.'
    ],
    horarios: HORARIO_DIURNO,
    caracteristicas: ['Guias credenciados', 'Grupos reduzidos', 'Paradas gastronômicas', 'Roteiros temáticos'],
    avaliacoes: []
  }
];

const ARTIGOS = [
  {
    slug: 'roteiro-cafes-especiais-santa-teresa-e-ipanema',
    titulo: 'Roteiro de cafés especiais: de Santa Teresa ao Arpoador',
    publicadoEm: '2026-10-18T10:00:00-03:00',
    editoria: 'Gastronomia',
    autor: 'Curadoria Nexus',
    grupo: 'cafes-e-padarias',
    resumo: 'Conheça microtorrefações, métodos filtrados e padarias de fermentação natural que transformaram a cena cafeeira carioca.',
    html: '<p>A cena de cafés especiais no Rio de Janeiro vive um momento vibrante, com microtorrefações que valorizam produtores da Serra Fluminense, Caparaó e Sul de Minas.</p><h2>Comece pelo alto em Santa Teresa</h2><p>As manhãs em Santa Teresa pedem calma. Em sobrados cercados de verde, cafeterias como o <strong>Café Mirante Santa</strong> servem coados na V60 e bolos caseiros com vista para os telhados do bairro.</p><h2>Da Gávea ao pós-praia em Ipanema</h2><p>Descendo para a Zona Sul, vale combinar o pão de levain recém-saído do forno da <strong>Padaria Fermento Lento</strong> com os grãos torrados semanalmente na <strong>Torrefação Arpoador</strong>.</p><p><em>Dica Nexus:</em> consulte no mapa os estabelecimentos abertos agora e ative seus cupons antes da visita.</p>'
  },
  {
    slug: 'onde-ouvir-choro-e-jazz-ao-vivo-no-rio',
    titulo: 'Onde ouvir choro, samba de raiz e jazz ao vivo nesta semana',
    publicadoEm: '2026-10-25T14:00:00-03:00',
    editoria: 'Música & Noite',
    autor: 'Curadoria Nexus',
    grupo: 'musica-e-palcos',
    resumo: 'De rodas acústicas na Lapa e Laranjeiras a jam sessions intimistas na Gávea: um mapa sonoro para sair à noite.',
    html: '<p>A música ao vivo faz parte do cotidiano carioca, mas encontrar casas que cuidam da acústica e valorizam músicos autorais faz toda a diferença.</p><h2>Choro e samba sem pressa</h2><p>Em Laranjeiras, a <strong>Casa do Choro Laranjeiras</strong> mantém uma programação dedicada ao instrumental brasileiro. Já na Rua do Lavradio, o <strong>Boteco do Arco</strong> une petiscos de raiz e rodas de samba acústicas.</p><h2>Jazz intimista no Baixo Gávea</h2><p>Para quem prefere coquetelaria autoral e quartetos de jazz, o <strong>Terraço Jazz Gávea</strong> promove jam sessions abertas às quartas-feiras.</p>'
  },
  {
    slug: 'guia-cinemas-de-rua-e-livrarias-independentes',
    titulo: 'Guia de cinemas de rua e livrarias independentes para o fim de semana',
    publicadoEm: '2026-11-02T09:30:00-03:00',
    editoria: 'Arte & Cultura',
    autor: 'Curadoria Nexus',
    grupo: 'livrarias-e-cinema',
    resumo: 'Espaços que resistem com curadoria afetiva, sessões comentadas, clubes de leitura e cafés no foyer.',
    html: '<p>Frequentar um cinema de rua ou uma livraria independente é também uma forma de viver o bairro em outro ritmo.</p><h2>Curadoria que surpreende</h2><p>Na <strong>Livraria Folha &amp; Fogo</strong>, em Laranjeiras, as estantes destacam editoras pequenas, poesia e quadrinhos nacionais, sempre acompanhados de boas indicações no balcão.</p><h2>Telona e debate em Botafogo</h2><p>O <strong>Cine Estação Carioca</strong> mantém três salas voltadas ao cinema autoral, com mostras temáticas e encontros com diretores após as sessões.</p>'
  },
  {
    slug: 'mesa-carioca-peixes-frescos-e-vinhos-naturais',
    titulo: 'A nova mesa carioca: peixes da costa e vinhos de pequenos produtores',
    publicadoEm: '2026-11-08T11:00:00-03:00',
    editoria: 'Gastronomia',
    autor: 'Curadoria Nexus',
    grupo: 'restaurantes',
    resumo: 'Cozinhas de Botafogo, Ipanema e Flamengo apostam em pesca sustentável, ingredientes locais e cartas descomplicadas.',
    html: '<p>Cozinheiros e sommeliers do Rio têm olhado cada vez mais para perto: pescados do litoral fluminense, queijos de pequenas fazendas e vinhos de mínima intervenção.</p><h2>Onde provar</h2><p>No <strong>Bistrô Maré Alta</strong>, o cardápio acompanha o que chega fresco no dia. Em Ipanema, o <strong>Sushi Brisa</strong> aplica técnica japonesa a peixes da nossa costa, enquanto o <strong>Empório &amp; Vinhos Guanabara</strong> facilita a descoberta de rótulos sul-americanos em taça.</p>'
  },
  {
    slug: 'sabado-cultural-centro-historico-e-zona-portuaria',
    titulo: 'Um sábado a pé pelo Centro Histórico e Zona Portuária',
    publicadoEm: '2026-11-12T10:00:00-03:00',
    editoria: 'Roteiros',
    autor: 'Curadoria Nexus',
    grupo: 'arte-e-cultura',
    resumo: 'Exposições gratuitas, arquitetura preservada e uma parada para cerveja artesanal no fim da tarde.',
    html: '<p>O Centro do Rio aos sábados revela ruas mais silenciosas, galerias abertas e museus que convidam a caminhar sem pressa.</p><h2>Manhã de arte e memória</h2><p>Comece pela Praça XV no <strong>Espaço Cultural Solar</strong> e siga em direção à Zona Portuária para conhecer a programação gratuita da <strong>Galeria Cais Aberto</strong>.</p><h2>Brinde no fim do dia</h2><p>Para encerrar o roteiro, a <strong>Taberna do Cais</strong> na Rua do Ouvidor oferece 12 torneiras de cervejarias artesanais fluminenses.</p>'
  },
  {
    slug: 'oficinas-criativas-e-feiras-ao-ar-livre-no-rio',
    titulo: 'Oficinas criativas e feiras de produtores para sair da rotina',
    publicadoEm: '2026-11-16T15:00:00-03:00',
    editoria: 'Experiências',
    autor: 'Curadoria Nexus',
    grupo: 'experiencias',
    resumo: 'Cerâmica manual em Santa Teresa, caminhadas históricas pela Tijuca e feiras de economia criativa em Copacabana.',
    html: '<p>Trocar o roteiro tradicional por uma experiência mão na massa é uma das melhores formas de redescobrir a cidade.</p><h2>Mão no barro e pés na rua</h2><p>O <strong>Ateliê Barro Vivo</strong> recebe iniciantes em oficinas de cerâmica de um dia, enquanto o <strong>Roteiros Rio a Pé</strong> conduz caminhadas com paradas gastronômicas. Nos fins de semana quinzenais, a <strong>Feira Criativa do Largo</strong> reúne artesãos e produtores no Bairro Peixoto.</p>'
  }
];

const CLASSIFICADOS = [
  {
    id: 'cl-01',
    slug: 'vaga-barista-botafogo-santa-teresa',
    categoria: 'Oportunidades',
    titulo: 'Vaga para Barista — Cafeteria Especial em Santa Teresa',
    endereco: 'Rua Almirante Alexandrino, 512, Santa Teresa, Rio de Janeiro, RJ',
    telefone: '(21) 3000-1102',
    preco: 'R$ 2.400,00',
    grupo: 'cafes-e-padarias',
    empresa: 'cafe-mirante-santa',
    descricao: 'Buscamos barista com interesse em cafés especiais e métodos filtrados para jornada de terça a domingo. Treinamento em torra e extração incluso (anúncio demonstrativo).'
  },
  {
    id: 'cl-02',
    slug: 'chamada-exposicao-coletiva-cais-aberto',
    categoria: 'Chamadas Culturais',
    titulo: 'Chamada Aberta: Exposição Coletiva de Fotografia Urbana',
    endereco: 'Rua Sacadura Cabral, 120, Centro, Rio de Janeiro, RJ',
    telefone: '(21) 3000-1104',
    preco: '',
    grupo: 'arte-e-cultura',
    empresa: 'galeria-cais-aberto',
    descricao: 'Artistas visuais e fotógrafos residentes no RJ podem enviar portfólio com até 5 obras sobre o cotidiano dos bairros cariocas. Inscrições gratuitas até 15/12/2026.'
  },
  {
    id: 'cl-03',
    slug: 'sala-ensaios-acusticos-lapa',
    categoria: 'Espaços & Estúdios',
    titulo: 'Locação de Sala Acústica para Ensaios de Choro e Jazz',
    endereco: 'Rua General Glicério, 140, Laranjeiras, Rio de Janeiro, RJ',
    telefone: '(21) 3000-1108',
    preco: 'R$ 90,00',
    grupo: 'musica-e-palcos',
    empresa: 'casa-choro-laranjeiras',
    descricao: 'Sala tratada acusticamente com piano vertical afinado, microfones condensadores e ar-condicionado. Valor por hora em horário comercial.'
  },
  {
    id: 'cl-04',
    slug: 'inscricoes-expositores-feira-criativa',
    categoria: 'Feiras & Produtores',
    titulo: 'Inscrições para Expositores — Edição de Verão da Feira Criativa',
    endereco: 'Praça Edmundo Bittencourt, Copacabana, Rio de Janeiro, RJ',
    telefone: '(21) 3000-1119',
    preco: 'R$ 180,00',
    grupo: 'parques-e-lazer',
    empresa: 'feira-criativa-do-largo',
    descricao: 'Vagas abertas para marcas autorais de gastronomia artesanal, cerâmica, ilustrações e vinis para a edição de dezembro no Bairro Peixoto.'
  }
];

const EVENTOS = [
  {
    id: 'ev-noite-jazz-terraco',
    titulo: 'Noite de Jazz Brasileiro & Jam Session',
    descricao: '<p>Quarteto convidado abre a noite com repertório de bossa e jazz contemporâneo, seguido de jam session aberta para instrumentistas.</p>',
    inicio: '2026-12-04T20:00',
    fim: '2026-12-04T23:30',
    local: 'Terraço Jazz Gávea',
    endereco: 'Praça Santos Dumont, 114, Gávea',
    imagem: '/assets/fotos/bar-da-laje-gavea.svg',
    empresa: 'bar-da-laje-gavea'
  },
  {
    id: 'ev-feira-vinhos-naturais',
    titulo: 'Degustação de Vinhos Naturais da Serra',
    descricao: '<p>Cinco rótulos de pequenos produtores brasileiros harmonizados com queijos artesanais e pães de fermentação natural.</p>',
    inicio: '2026-12-11T19:00',
    fim: '2026-12-11T22:00',
    local: 'Empório & Vinhos Guanabara',
    endereco: 'Rua Paissandu, 165, Flamengo',
    imagem: '/assets/fotos/emporio-vinhos-guanabara.svg',
    empresa: 'emporio-vinhos-guanabara'
  },
  {
    id: 'ev-mostra-cinema-independente',
    titulo: 'Mostra Rio de Cinema Independente',
    descricao: '<p>Três dias de sessões comentadas com curtas e longas dirigidos por realizadores fluminenses, com debate no foyer após os filmes.</p>',
    inicio: '2026-12-18T18:30',
    fim: '2026-12-20T22:00',
    local: 'Cine Estação Carioca',
    endereco: 'Rua Voluntários da Pátria, 95, Botafogo',
    imagem: '/assets/fotos/cine-estacao-carioca.svg',
    empresa: 'cine-estacao-carioca'
  },
  {
    id: 'ev-roda-choro-verao',
    titulo: 'Roda de Choro de Verão em Laranjeiras',
    descricao: '<p>Encontro especial de fim de tarde celebrando Pixinguinha e Jacob do Bandolim com convidados especiais.</p>',
    inicio: '2026-12-19T17:00',
    fim: '2026-12-19T21:00',
    local: 'Casa do Choro Laranjeiras',
    endereco: 'Rua General Glicério, 140, Laranjeiras',
    imagem: '/assets/fotos/casa-choro-laranjeiras.svg',
    empresa: 'casa-choro-laranjeiras'
  },
  {
    id: 'ev-oficina-ceramica-cafe',
    titulo: 'Oficina de Cerâmica & Café Filtrado',
    descricao: '<p>Modele sua própria xícara em argila enquanto degusta microlotes coados na hora. Inclui queima e esmaltação das peças.</p>',
    inicio: '2027-01-09T10:00',
    fim: '2027-01-09T13:30',
    local: 'Ateliê Barro Vivo',
    endereco: 'Rua Paschoal Carlos Magno, 84, Santa Teresa',
    imagem: '/assets/fotos/atelie-barro-vivo.svg',
    empresa: 'atelie-barro-vivo'
  },
  {
    id: 'ev-feira-criativa-verao',
    titulo: 'Feira Criativa do Largo — Edição de Verão',
    descricao: '<p>Mais de 40 expositores de gastronomia artesanal, cerâmica, livros, vinis e apresentações musicais gratuitas na praça.</p>',
    inicio: '2027-01-16T10:00',
    fim: '2027-01-17T19:00',
    local: 'Praça Edmundo Bittencourt',
    endereco: 'Bairro Peixoto, Copacabana',
    imagem: '/assets/fotos/feira-criativa-do-largo.svg',
    empresa: 'feira-criativa-do-largo'
  }
];

const CUPONS = [
  {
    id: 'cupom-mare-alta-sobremesa',
    business_id: 'bistro-mare-alta',
    title: 'Sobremesa cortesia no jantar',
    conditions: 'Válido de terça a quinta no jantar, na compra de um prato principal. Apresente o código ao garçom.',
    code: 'NEXUSMARE',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 80
  },
  {
    id: 'cupom-mirante-cafe-20',
    business_id: 'cafe-mirante-santa',
    title: '20% OFF no combo filtrado + fatia de bolo',
    conditions: 'Válido de segunda a sexta, das 9h às 17h, para consumo na varanda ou retirada.',
    code: 'MIRANTE20',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 120
  },
  {
    id: 'cupom-cine-estacao-meia',
    business_id: 'cine-estacao-carioca',
    title: 'Ingresso com 50% de desconto às terças e quartas',
    conditions: 'Válido na bilheteria física para qualquer sessão da mostra regular, sujeito à lotação da sala.',
    code: 'CINENEXUS50',
    starts_on: '2026-11-01',
    ends_on: '2027-04-30',
    quantity: 200
  },
  {
    id: 'cupom-boteco-arco-chope',
    business_id: 'boteco-do-arco',
    title: '2º chope artesanal pela metade do preço',
    conditions: 'Válido no happy hour (17h às 20h) de terça a sexta-feira. Uso individual.',
    code: 'ARCOCHOPE',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 100
  },
  {
    id: 'cupom-folha-fogo-15',
    business_id: 'livraria-folha-e-fogo',
    title: '15% OFF em títulos de editoras independentes',
    conditions: 'Válido para compras na loja física em Laranjeiras, não cumulativo com outras promoções.',
    code: 'LEIANEXUS15',
    starts_on: '2026-11-01',
    ends_on: '2027-04-30',
    quantity: 60
  },
  {
    id: 'cupom-forno-carioca-entrada',
    business_id: 'forno-carioca-pizzaria',
    title: 'Focaccia de alecrim cortesia na mesa',
    conditions: 'Válido para mesas a partir de 2 pessoas no salão em Copacabana, de domingo a quinta.',
    code: 'FORNONEXUS',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 90
  }
];

const OFERTAS = [
  {
    id: 'of-mare-executivo',
    business_id: 'bistro-mare-alta',
    kind: 'offer',
    name: 'Menu Executivo de Maré (Entrada + Principal)',
    description: 'Salada de folhas orgânicas com cítricos + peixe fresco do dia grelhado com purê de baroa.',
    conditions: 'De segunda a sexta, das 12h às 15h30, no salão em Botafogo.',
    valid_until: '2027-03-31',
    price_mode: 'fixed',
    price_cents: 6800,
    image_url: '/assets/fotos/bistro-mare-alta.svg'
  },
  {
    id: 'of-arpoador-brunch',
    business_id: 'torrefacao-arpoador',
    kind: 'offer',
    name: 'Combo Brunch Pós-Praia para Dois',
    description: '2 cafés filtrados ou espressos, 2 croissants artesanais, ovos mexidos e cesta de pães de levain.',
    conditions: 'Todos os dias até 13h, mediante disponibilidade.',
    valid_until: '2027-03-31',
    price_mode: 'fixed',
    price_cents: 8400,
    image_url: '/assets/fotos/torrefacao-arpoador.svg'
  },
  {
    id: 'of-barro-oficina',
    business_id: 'atelie-barro-vivo',
    kind: 'offer',
    name: 'Oficina Avulsa de Cerâmica (1 dia)',
    description: 'Aula prática de 3 horas com argila, ferramentas, queima e esmaltação de até 2 peças incluídas.',
    conditions: 'Aos sábados, com agendamento prévio pelo perfil.',
    valid_until: '2027-04-30',
    price_mode: 'fixed',
    price_cents: 19500,
    image_url: '/assets/fotos/atelie-barro-vivo.svg'
  },
  {
    id: 'of-guanabara-voo',
    business_id: 'emporio-vinhos-guanabara',
    kind: 'offer',
    name: 'Voo de 3 Taças Sul-Americanas + Tábua de Queijos',
    description: 'Seleção semanal de 3 rótulos (branco, laranja e tinto) acompanhados de 3 queijos artesanais.',
    conditions: 'De terça a quinta, das 18h às 21h.',
    valid_until: '2027-03-31',
    price_mode: 'fixed',
    price_cents: 11000,
    image_url: '/assets/fotos/emporio-vinhos-guanabara.svg'
  }
];

await mkdir(fotosDir, { recursive: true });

// 1. Gerar capas SVG para locais, artigos e classificados
for (let i = 0; i < LOCAIS.length; i++) {
  const l = LOCAIS[i];
  const svg = coverSVG({ title: l.nome, subtitle: `${l.bairro} · ${l.categorias[0]}`, tag: l.categorias[0], group: l.grupo, seed: i + 1 });
  await writeFile(resolve(fotosDir, `${l.slug}.svg`), svg, 'utf8');
}
for (let i = 0; i < ARTIGOS.length; i++) {
  const a = ARTIGOS[i];
  const svg = coverSVG({ title: a.titulo.slice(0, 40), subtitle: a.editoria, tag: `Roteiro · ${a.editoria}`, group: a.grupo, seed: i + 21 });
  await writeFile(resolve(fotosDir, `artigo-${a.slug}.svg`), svg, 'utf8');
}
for (let i = 0; i < CLASSIFICADOS.length; i++) {
  const c = CLASSIFICADOS[i];
  const svg = coverSVG({ title: c.titulo.slice(0, 38), subtitle: c.categoria, tag: c.categoria, group: c.grupo, seed: i + 41 });
  await writeFile(resolve(fotosDir, `classificado-${c.slug}.svg`), svg, 'utf8');
}

// 2. empresas.json
const empresasJSON = LOCAIS.map(l => ({
  slug: l.slug,
  slugPortal: l.slug,
  nome: l.nome,
  iniciais: l.iniciais,
  plano: l.plano,
  destaque: l.destaque,
  temPaginaPropria: l.plano === 'Destaque',
  categorias: l.categorias.map(nome => ({ nome, slug: nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })),
  bairro: l.bairro,
  cidade: 'Rio de Janeiro',
  rua: l.rua,
  cep: l.cep,
  endereco: `${l.rua}, ${l.bairro}, Rio de Janeiro, RJ`,
  telefone: l.telefone,
  telefoneDigitos: l.telefone.replace(/\D/g, ''),
  whatsapp: l.whatsapp,
  email: l.email,
  site: '',
  resumo: l.resumo,
  descricao: l.descricao,
  horarios: l.horarios,
  caracteristicas: l.caracteristicas,
  redes: [{ rede: 'Instagram', url: `https://instagram.com/${l.slug.replace(/-/g, '')}` }],
  imagem: `/assets/fotos/${l.slug}.svg`,
  imagemGrande: `/assets/fotos/${l.slug}.svg`,
  fotos: [`/assets/fotos/${l.slug}.svg`],
  geo: { lat: l.lat, lng: l.lng },
  avaliacoes: { itens: l.avaliacoes },
  classificados: CLASSIFICADOS.filter(c => c.empresa === l.slug).map(c => c.slug)
}));
await writeFile(cp('empresas.json'), JSON.stringify(empresasJSON, null, 2) + '\n', 'utf8');

// 3. localizacoes.json
const localizacoesJSON = {
  geradoEm: '2026-11-22',
  fontes: 'Coordenadas demonstrativas do acervo Nexus no município do Rio de Janeiro, validadas contra a malha do IBGE.',
  empresas: Object.fromEntries(LOCAIS.map(l => [l.slug, { lat: l.lat, lng: l.lng, precisao: 'rua' }])),
  semLocal: []
};
await writeFile(cp('localizacoes.json'), JSON.stringify(localizacoesJSON, null, 2) + '\n', 'utf8');

// 4. colecoes.json
const colecoesJSON = {
  fonte: 'Coleções temáticas da página inicial do Nexus.',
  colecoes: [
    { id: 'cafe-sem-pressa', titulo: 'Para um café sem pressa', subtitulo: 'Cafeterias especiais, padarias de levain e varandas tranquilas.', grupos: ['cafes-e-padarias'] },
    { id: 'noite-musica-boa-mesa', titulo: 'Noite de música e boa mesa', subtitulo: 'Bistrôs, choro, jazz, vinhos e botecos clássicos do Rio.', grupos: ['restaurantes', 'bares-e-botecos', 'musica-e-palcos'] },
    { id: 'arte-livros-cinema', titulo: 'Arte, livros e cinema de rua', subtitulo: 'Galerias gratuitas, teatros, livrarias independentes e telonas autorais.', grupos: ['arte-e-cultura', 'livrarias-e-cinema'] },
    { id: 'experiencias-ar-livre', titulo: 'Experiências para sair da rotina', subtitulo: 'Oficinas criativas, feiras de produtores e caminhadas guiadas.', grupos: ['experiencias', 'parques-e-lazer'] }
  ]
};
await writeFile(cp('colecoes.json'), JSON.stringify(colecoesJSON, null, 2) + '\n', 'utf8');

// 5. artigos.json
const artigosJSON = {
  total: ARTIGOS.length,
  artigos: ARTIGOS.map(a => ({
    slug: a.slug,
    url: `https://nexus.demo/artigos/${a.slug}`,
    status: 200,
    titulo: a.titulo,
    publicadoEm: a.publicadoEm,
    editoria: a.editoria,
    categorias: [{ nome: a.editoria, link: `/artigos?editoria=${a.editoria.toLowerCase()}` }],
    autor: a.autor,
    resumo: a.resumo,
    imagem: { original: `/assets/fotos/artigo-${a.slug}.svg` },
    galeria: [`/assets/fotos/artigo-${a.slug}.svg`],
    html: a.html,
    texto: a.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }))
};
await writeFile(cp('artigos.json'), JSON.stringify(artigosJSON, null, 2) + '\n', 'utf8');

// 6. classificados.json
const classificadosJSON = {
  total: CLASSIFICADOS.length,
  classificados: CLASSIFICADOS.map(c => ({
    id: c.id,
    slug: c.slug,
    url: `https://nexus.demo/classificados/${c.slug}`,
    categoria: c.categoria,
    titulo: c.titulo,
    endereco: c.endereco,
    telefone: c.telefone,
    preco: c.preco,
    descricao: c.descricao,
    imagem: `/assets/fotos/classificado-${c.slug}.svg`,
    linhas: [c.categoria, c.titulo, c.descricao, ...(c.preco ? [c.preco] : [])]
  }))
};
await writeFile(cp('classificados.json'), JSON.stringify(classificadosJSON, null, 2) + '\n', 'utf8');

// 7. eventos.json, cupons.json, ofertas.json
await writeFile(cp('eventos.json'), JSON.stringify({ fonte: 'Agenda cultural e gastronômica demonstrativa do Nexus.', eventos: EVENTOS }, null, 2) + '\n', 'utf8');
await writeFile(cp('cupons.json'), JSON.stringify({ fonte: 'Cupons demonstrativos ativos do Nexus.', cupons: CUPONS }, null, 2) + '\n', 'utf8');
await writeFile(cp('ofertas.json'), JSON.stringify({ fonte: 'Ofertas demonstrativas vigentes do Nexus.', ofertas: OFERTAS }, null, 2) + '\n', 'utf8');

// 8. Arquivos auxiliares limpos (zero PRIMIG)
await writeFile(cp('noticias.json'), JSON.stringify({ total: 0, noticias: [] }, null, 2) + '\n', 'utf8');
await writeFile(cp('redes.json'), JSON.stringify({ redes: [] }, null, 2) + '\n', 'utf8');
await writeFile(cp('correcoes.json'), JSON.stringify({
  planos: [
    { id: 'plano-destaque', nome: 'Destaque', ordem: 1, patrocinado: true },
    { id: 'plano-avancado', nome: 'Presença', ordem: 2, patrocinado: false }
  ],
  empresas: Object.fromEntries(LOCAIS.map(l => [l.slug, { plano: l.plano === 'Destaque' ? 'plano-destaque' : 'plano-avancado' }]))
}, null, 2) + '\n', 'utf8');
await writeFile(cp('banners.json'), JSON.stringify({ banners: [] }, null, 2) + '\n', 'utf8');
await writeFile(cp('portal-antigo.json'), JSON.stringify({ guia: [], locaisGuia: [], noticias: [], artigos: [], classificados: [], ofertas: [] }, null, 2) + '\n', 'utf8');
await writeFile(cp('site.json'), JSON.stringify({ coletadoEm: '2026-11-22', origem: 'https://nexus.demo', banners: [] }, null, 2) + '\n', 'utf8');
await writeFile(cp('redirecionamentos.csv'), 'url_antiga,rota_nova\n', 'utf8');

console.log(`Acervo Nexus gerado: ${LOCAIS.length} locais, ${ARTIGOS.length} artigos, ${CLASSIFICADOS.length} classificados, ${EVENTOS.length} eventos, ${CUPONS.length} cupons, ${OFERTAS.length} ofertas.`);
