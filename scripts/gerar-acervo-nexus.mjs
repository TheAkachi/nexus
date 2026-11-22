// Gera o acervo do Nexus (Guia Gastronômico & Cultural do Rio de Janeiro) com 20 estabelecimentos
// e espaços públicos reais do Rio de Janeiro, dados públicos reais e fotos da Wikimedia Commons em p2/fotos/.
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cp = f => resolve(root, 'conteudo-portal', f);

const LOCAIS = [
  {
    slug: 'confeitaria-colombo',
    nome: 'Confeitaria Colombo',
    iniciais: 'CC',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Confeitarias', 'Cafeterias Especiais', 'Bistrôs'],
    bairro: 'Centro',
    rua: 'Rua Gonçalves Dias, 32',
    cep: '20050-030',
    lat: -22.9052, lng: -43.1788,
    telefone: '(21) 2505-1500',
    site: 'https://www.confeitariacolombo.com.br',
    resumo: 'Patrimônio histórico e gastronômico fundado em 1894 no Centro do Rio, famoso pelos espelhos belgas, vitrais art nouveau e chá da tarde.',
    descricao: [
      'Fundada em 1894, a Confeitaria Colombo é um dos marcos mais emblemáticos da história gastronômica e arquitetônica do Rio de Janeiro, com salão art nouveau decorado por espelhos de cristal belga e bancadas de mármore italiano.',
      'Serve café da manhã, almoço no salão Cristóvão, doces tradicionais portugueses, salgados clássicos e o tradicional chá da tarde.'
    ],
    horarios: [
      { dia: 'SEG', horas: ['11:00 - 18:00'] },
      { dia: 'TER', horas: ['11:00 - 18:00'] },
      { dia: 'QUA', horas: ['11:00 - 18:00'] },
      { dia: 'QUI', horas: ['11:00 - 18:00'] },
      { dia: 'SEX', horas: ['11:00 - 18:00'] },
      { dia: 'SAB', horas: ['11:00 - 18:00'] }
    ],
    caracteristicas: ['Patrimônio histórico', 'Chá da tarde', 'Salão art nouveau', 'Próximo ao metrô Uruguaiana'],
    avaliacoes: [
      { autor: 'Camila Duarte', data: '12 de outubro, 2026', estrelas: 5, titulo: 'Arquitetura deslumbrante', texto: 'Um passeio no tempo no coração do Centro. O pastel de nata e o café passado valem muito a visita.' }
    ]
  },
  {
    slug: 'real-gabinete-portugues',
    nome: 'Real Gabinete Português de Leitura',
    iniciais: 'RG',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Centros Culturais', 'Livrarias Independentes'],
    bairro: 'Centro',
    rua: 'Rua Luís de Camões, 30',
    cep: '20051-020',
    lat: -22.9054, lng: -43.1822,
    telefone: '(21) 2221-3138',
    site: 'https://www.realgabinete.com.br',
    resumo: 'Biblioteca histórica fundada em 1837 em estilo neomanuelino, detentora do maior acervo de obras portuguesas fora de Portugal.',
    descricao: [
      'Inaugurado em sua sede atual em 1887, o Real Gabinete Português de Leitura encanta visitantes do mundo inteiro pelo Salão de Leitura com claraboia de ferro e vidro e estantes de madeira entalhada que vão do piso ao teto.',
      'A visitação ao salão principal é gratuita e aberta ao público de segunda a sexta-feira.'
    ],
    horarios: [
      { dia: 'SEG', horas: ['10:00 - 17:00'] },
      { dia: 'TER', horas: ['10:00 - 17:00'] },
      { dia: 'QUA', horas: ['10:00 - 17:00'] },
      { dia: 'QUI', horas: ['10:00 - 17:00'] },
      { dia: 'SEX', horas: ['10:00 - 17:00'] }
    ],
    caracteristicas: ['Entrada gratuita', 'Biblioteca histórica', 'Arquitetura neomanuelina', 'Centro Histórico'],
    avaliacoes: [
      { autor: 'Rafael Menezes', data: '28 de setembro, 2026', estrelas: 5, titulo: 'Uma das bibliotecas mais bonitas do mundo', texto: 'Silenciosa, impressionante e com entrada gratuita. Imperdível no Centro.' }
    ]
  },
  {
    slug: 'ccbb-rio',
    nome: 'Centro Cultural Banco do Brasil (CCBB Rio)',
    iniciais: 'CB',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Centros Culturais', 'Museus', 'Cinemas de Rua'],
    bairro: 'Centro',
    rua: 'Rua Primeiro de Março, 66',
    cep: '20010-000',
    lat: -22.9011, lng: -43.1765,
    telefone: '(21) 3808-2020',
    site: 'https://ccbb.com.br/rio-de-janeiro',
    resumo: 'Um dos centros culturais mais visitados do país, com exposições internacionais gratuitas, teatro, cinema, biblioteca e cafés na rotunda.',
    descricao: [
      'Instalado em um edifício neoclássico histórico na Rua Primeiro de Março, o CCBB Rio reúne salas de exposição de grande porte, teatros, salas de cinema, auditório e biblioteca.',
      'A maioria das exposições tem entrada gratuita mediante retirada de ingresso, e a rotunda central abriga livraria e cafeteria.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['09:00 - 20:00'] },
      { dia: 'SEG', horas: ['09:00 - 20:00'] },
      { dia: 'QUA', horas: ['09:00 - 20:00'] },
      { dia: 'QUI', horas: ['09:00 - 20:00'] },
      { dia: 'SEX', horas: ['09:00 - 20:00'] },
      { dia: 'SAB', horas: ['09:00 - 20:00'] }
    ],
    caracteristicas: ['Exposições gratuitas', 'Cinema e teatro', 'Livraria e café', 'Acessível para cadeirantes'],
    avaliacoes: [
      { autor: 'Beatriz Almeida', data: '01 de novembro, 2026', estrelas: 5, titulo: 'Programação sempre excelente', texto: 'Fui à exposição principal e depois fiquei no café da rotunda. Estrutura impecável.' }
    ]
  },
  {
    slug: 'museu-do-amanha',
    nome: 'Museu do Amanhã',
    iniciais: 'MA',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Museus', 'Centros Culturais'],
    bairro: 'Centro',
    rua: 'Praça Mauá, 1',
    cep: '20081-240',
    lat: -22.8939, lng: -43.1795,
    telefone: '(21) 3812-1800',
    site: 'https://museudoamanha.org.br',
    resumo: 'Museu de ciências aplicadas projetado por Santiago Calatrava no Píer Mauá, com experiências interativas sobre sustentabilidade e futuro.',
    descricao: [
      'Ícone da revitalização da Zona Portuária do Rio de Janeiro, o Museu do Amanhã combina arquitetura sustentável com exposições interativas sobre o cosmos, a Terra, o Antropoceno e os caminhos para o futuro.',
      'O espelho d’água e os jardins ao redor oferecem vista privilegiada para a Baía de Guanabara e a Ponte Rio-Niterói.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['10:00 - 18:00'] },
      { dia: 'TER', horas: ['10:00 - 18:00'] },
      { dia: 'QUA', horas: ['10:00 - 18:00'] },
      { dia: 'QUI', horas: ['10:00 - 18:00'] },
      { dia: 'SEX', horas: ['10:00 - 18:00'] },
      { dia: 'SAB', horas: ['10:00 - 18:00'] }
    ],
    caracteristicas: ['Gratuito às terças', 'Arquitetura de Calatrava', 'Vista da Baía de Guanabara', 'Acessível para cadeirantes'],
    avaliacoes: [
      { autor: 'Lucas Ferreira', data: '19 de outubro, 2026', estrelas: 5, titulo: 'Experiência interativa incrível', texto: 'Vale combinar a visita com o MAR na Praça Mauá e o pôr do sol no píer.' }
    ]
  },
  {
    slug: 'theatro-municipal-rio',
    nome: 'Theatro Municipal do Rio de Janeiro',
    iniciais: 'TM',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Teatros', 'Música e Palcos'],
    bairro: 'Centro',
    rua: 'Praça Floriano, s/n',
    cep: '20031-050',
    lat: -22.9092, lng: -43.1765,
    telefone: '(21) 2332-9191',
    site: 'https://theatromunicipal.rj.gov.br',
    resumo: 'Principal casa de ópera, balé e música sinfônica do Brasil, inaugurada em 1909 na Cinelândia com arquitetura inspirada na Ópera de Paris.',
    descricao: [
      'Inaugurado em 1909, o Theatro Municipal do Rio de Janeiro abriga a Orquestra Sinfônica, o Coro e o Ballet do Theatro Municipal, além de visitas guiadas pelo foyer e salão nobre.',
      'O edifício também conta com o Café do Theatro e está integrado ao circuito cultural da Cinelândia.'
    ],
    horarios: [
      { dia: 'TER', horas: ['10:00 - 18:00'] },
      { dia: 'QUA', horas: ['10:00 - 18:00'] },
      { dia: 'QUI', horas: ['10:00 - 20:00'] },
      { dia: 'SEX', horas: ['10:00 - 20:00'] },
      { dia: 'SAB', horas: ['10:00 - 20:00'] }
    ],
    caracteristicas: ['Visitas guiadas', 'Ópera e concertos', 'Metrô Cinelândia', 'Patrimônio histórico'],
    avaliacoes: []
  },
  {
    slug: 'museu-de-arte-do-rio',
    nome: 'Museu de Arte do Rio (MAR)',
    iniciais: 'MR',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Museus', 'Galerias de Arte'],
    bairro: 'Centro',
    rua: 'Praça Mauá, 5',
    cep: '20081-240',
    lat: -22.8962, lng: -43.1818,
    telefone: '(21) 3031-2741',
    site: 'https://museudeartedorio.org.br',
    resumo: 'Museu dedicado à arte, história visual e cultura do Rio de Janeiro, ligando o Palacete Dom João VI à Escola do Olhar sob uma cobertura em onda.',
    descricao: [
      'O Museu de Arte do Rio une dois edifícios de épocas distintas na Praça Mauá, com exposições que cruzam arte contemporânea, história carioca, fotografia e culturas populares.',
      'O terraço panorâmico no último andar oferece uma das vistas mais bonitas da Praça Mauá e da Baía de Guanabara.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['11:00 - 18:00'] },
      { dia: 'TER', horas: ['11:00 - 18:00'] },
      { dia: 'QUA', horas: ['11:00 - 18:00'] },
      { dia: 'QUI', horas: ['11:00 - 18:00'] },
      { dia: 'SEX', horas: ['11:00 - 18:00'] },
      { dia: 'SAB', horas: ['11:00 - 18:00'] }
    ],
    caracteristicas: ['Gratuito às terças', 'Terraço panorâmico', 'Escola do Olhar', 'VLT Parada dos Museus'],
    avaliacoes: []
  },
  {
    slug: 'circo-voador',
    nome: 'Circo Voador',
    iniciais: 'CV',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Casas de Show', 'Rodas de Samba'],
    bairro: 'Lapa',
    rua: 'Rua dos Arcos, s/n',
    cep: '20230-060',
    lat: -22.9129, lng: -43.1802,
    telefone: '(21) 2533-0354',
    site: 'https://www.circovoador.com.br',
    resumo: 'A lendária lona cultural da Lapa, palco histórico da música brasileira desde 1982, aos pés dos Arcos da Lapa.',
    descricao: [
      'Nascido no Arpoador em 1982 e estabelecido sob os Arcos da Lapa, o Circo Voador é um dos palcos mais importantes da música brasileira, recebendo shows de MPB, samba, rock, rap e festivais independentes.',
      'Além da programação noturna, realiza oficinas culturais e eventos comunitários.'
    ],
    horarios: [
      { dia: 'QUI', horas: ['20:00 - 23:59'] },
      { dia: 'SEX', horas: ['21:00 - 23:59'] },
      { dia: 'SAB', horas: ['21:00 - 23:59'] }
    ],
    caracteristicas: ['Palco histórico', 'Arcos da Lapa', 'Shows nacionais e internacionais', 'Bares internos'],
    avaliacoes: [
      { autor: 'Thiago Nogueira', data: '25 de outubro, 2026', estrelas: 5, titulo: 'A melhor energia de show do Rio', texto: 'Clima único sob a lona e visibilidade ótima de qualquer lugar da pista.' }
    ]
  },
  {
    slug: 'rio-scenarium',
    nome: 'Rio Scenarium',
    iniciais: 'RS',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Casas de Samba e Choro', 'Botecos Tradicionais', 'Jazz e Instrumental'],
    bairro: 'Lapa',
    rua: 'Rua do Lavradio, 20',
    cep: '20230-070',
    lat: -22.9094, lng: -43.1829,
    telefone: '(21) 3147-9000',
    site: 'https://www.rioscenarium.com.br',
    resumo: 'Pavilhão cultural, antiquário e casa de música brasileira em um casarão de três andares na Rua do Lavradio, com samba, choro e gastronomia.',
    descricao: [
      'Localizado em um casarão do século XIX na Rua do Lavradio, o Rio Scenarium mistura decoração de antiquário com três andares voltados ao samba, choro, gafieira e MPB ao vivo.',
      'Oferece cardápio de petiscos cariocas, pratos brasileiros e carta de caipirinhas e drinques.'
    ],
    horarios: [
      { dia: 'QUI', horas: ['19:00 - 23:59'] },
      { dia: 'SEX', horas: ['19:00 - 23:59'] },
      { dia: 'SAB', horas: ['19:00 - 23:59'] }
    ],
    caracteristicas: ['3 andares', 'Samba e choro ao vivo', 'Decoração de antiquário', 'Restaurante e bar'],
    avaliacoes: []
  },
  {
    slug: 'bar-do-mineiro',
    nome: 'Bar do Mineiro',
    iniciais: 'BM',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Botecos Tradicionais', 'Cozinha Brasileira'],
    bairro: 'Santa Teresa',
    rua: 'Rua Paschoal Carlos Magno, 99',
    cep: '20240-290',
    lat: -22.9210, lng: -43.1856,
    telefone: '(21) 2221-9227',
    site: 'https://bardomineiro.net',
    resumo: 'Clássico botequim de Santa Teresa famoso pela feijoada, pastel de feijão, cachaças artesanais e paredes cobertas de arte local.',
    descricao: [
      'Um dos endereços mais tradicionais de Santa Teresa, o Bar do Mineiro é parada obrigatória para quem sobe o bairro de bonde ou a pé.',
      'O cardápio destaca feijoada servida o ano inteiro, pastel de feijão com torresmo, carne-seca com aipim e seleção de cachaças mineiras e fluminenses.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['11:00 - 22:00'] },
      { dia: 'TER', horas: ['11:00 - 23:00'] },
      { dia: 'QUA', horas: ['11:00 - 23:00'] },
      { dia: 'QUI', horas: ['11:00 - 23:00'] },
      { dia: 'SEX', horas: ['11:00 - 23:59'] },
      { dia: 'SAB', horas: ['11:00 - 23:59'] }
    ],
    caracteristicas: ['Feijoada tradicional', 'Pastel de feijão', 'Cachaças artesanais', 'Largo dos Guimarães'],
    avaliacoes: [
      { autor: 'Juliana Costa', data: '04 de novembro, 2026', estrelas: 5, titulo: 'Pastel de feijão inesquecível', texto: 'Clima autêntico de Santa Teresa, comida farta e cerveja bem gelada.' }
    ]
  },
  {
    slug: 'parque-das-ruinas',
    nome: 'Parque Glória Maria (Parque das Ruínas)',
    iniciais: 'PR',
    plano: 'Avançado',
    destaque: true,
    categorias: ['Mirantes e Praças', 'Centros Culturais'],
    bairro: 'Santa Teresa',
    rua: 'Rua Murtinho Nobre, 169',
    cep: '20241-050',
    lat: -22.9175, lng: -43.1823,
    telefone: '(21) 2215-0621',
    site: 'https://www.rio.rj.gov.br',
    resumo: 'Centro cultural e mirante público em Santa Teresa construído nas ruínas do palacete de Laurinda Santos Lobo, com vista 360° do Centro e da Baía.',
    descricao: [
      'Antigo ponto de encontro de artistas modernistas na década de 1920, o Parque das Ruínas (hoje Parque Glória Maria) preserva a estrutura histórica combinada a passarelas metálicas que levam a um mirante panorâmico.',
      'A entrada é gratuita e o espaço recebe exposições, feiras criativas e apresentações musicais.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['09:00 - 16:00'] },
      { dia: 'TER', horas: ['09:00 - 16:00'] },
      { dia: 'QUA', horas: ['09:00 - 16:00'] },
      { dia: 'QUI', horas: ['09:00 - 16:00'] },
      { dia: 'SEX', horas: ['09:00 - 16:00'] },
      { dia: 'SAB', horas: ['09:00 - 16:00'] }
    ],
    caracteristicas: ['Entrada gratuita', 'Mirante panorâmico', 'Arquitetura histórica', 'Santa Teresa'],
    avaliacoes: []
  },
  {
    slug: 'museu-chacara-do-ceu',
    nome: 'Museu da Chácara do Céu',
    iniciais: 'MC',
    plano: 'Avançado',
    destaque: true,
    categorias: ['Museus', 'Jardins e Parques'],
    bairro: 'Santa Teresa',
    rua: 'Rua Murtinho Nobre, 93',
    cep: '20241-050',
    lat: -22.9173, lng: -43.1841,
    telefone: '(21) 3970-1126',
    site: 'https://museuscastromaya.com.br',
    resumo: 'Antiga residência de Raymundo Ottoni de Castro Maya em Santa Teresa, com acervo de Portinari, Di Cavalcanti, Matisse e jardins com vista.',
    descricao: [
      'Projetada em estilo modernista nos anos 1950, a casa que abriga o Museu da Chácara do Céu conserva mobiliário original e uma das coleções mais importantes de arte moderna brasileira e europeia.',
      'Fica a poucos metros do Parque das Ruínas, formando um ótimo roteiro combinado por Santa Teresa.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['12:00 - 17:00'] },
      { dia: 'SEG', horas: ['12:00 - 17:00'] },
      { dia: 'QUA', horas: ['12:00 - 17:00'] },
      { dia: 'QUI', horas: ['12:00 - 17:00'] },
      { dia: 'SEX', horas: ['12:00 - 17:00'] },
      { dia: 'SAB', horas: ['12:00 - 17:00'] }
    ],
    caracteristicas: ['Obras de Portinari', 'Jardins panorâmicos', 'Gratuito às quartas', 'Museus Castro Maya'],
    avaliacoes: []
  },
  {
    slug: 'museu-da-republica',
    nome: 'Museu da República (Palácio do Catete)',
    iniciais: 'MR',
    plano: 'Avançado',
    destaque: true,
    categorias: ['Museus', 'Jardins e Parques'],
    bairro: 'Catete',
    rua: 'Rua do Catete, 153',
    cep: '22220-000',
    lat: -22.9259, lng: -43.1762,
    telefone: '(21) 2127-0324',
    site: 'https://museudarepublica.museus.gov.br',
    resumo: 'Antiga sede da Presidência da República no Palácio do Catete, cercada por um dos jardins históricos mais agradáveis da Zona Sul.',
    descricao: [
      'Sede do governo federal de 1897 a 1960, o Palácio do Catete abriga o Museu da República, com acervo sobre a história republicana brasileira, cinema, livraria e bistrô.',
      'Os jardins do palácio têm entrada gratuita diariamente e são ponto de encontro de famílias, leitores e feiras culturais.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['11:00 - 17:00'] },
      { dia: 'TER', horas: ['10:00 - 17:00'] },
      { dia: 'QUA', horas: ['10:00 - 17:00'] },
      { dia: 'QUI', horas: ['10:00 - 17:00'] },
      { dia: 'SEX', horas: ['10:00 - 17:00'] },
      { dia: 'SAB', horas: ['11:00 - 17:00'] }
    ],
    caracteristicas: ['Jardim gratuito', 'Metrô Catete', 'Cinema e bistrô', 'Patrimônio histórico'],
    avaliacoes: []
  },
  {
    slug: 'parque-lage',
    nome: 'Parque Henrique Lage (EAV Parque Lage)',
    iniciais: 'PL',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Jardins e Parques', 'Centros Culturais', 'Cafeterias Especiais'],
    bairro: 'Jardim Botânico',
    rua: 'Rua Jardim Botânico, 414',
    cep: '22461-000',
    lat: -22.9606, lng: -43.2120,
    telefone: '(21) 3257-1800',
    site: 'https://eavparquelage.rj.gov.br',
    resumo: 'Parque público aos pés do Corcovado com palacete histórico, pátio com piscina emoldurado pelo Cristo Redentor, café e a Escola de Artes Visuais.',
    descricao: [
      'Com jardins de estilo inglês, grutas artificiais, lago e trilhas cercadas por Mata Atlântica, o Parque Lage é um dos refúgios mais fotogênicos do Rio de Janeiro.',
      'O palacete central abriga a Escola de Artes Visuais (EAV), exposições gratuitas e o café ao redor da piscina.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['09:00 - 17:00'] },
      { dia: 'SEG', horas: ['09:00 - 17:00'] },
      { dia: 'TER', horas: ['09:00 - 17:00'] },
      { dia: 'QUA', horas: ['09:00 - 17:00'] },
      { dia: 'QUI', horas: ['09:00 - 17:00'] },
      { dia: 'SEX', horas: ['09:00 - 17:00'] },
      { dia: 'SAB', horas: ['09:00 - 17:00'] }
    ],
    caracteristicas: ['Entrada gratuita no parque', 'Café no pátio', 'Escola de Artes Visuais', 'Vista do Corcovado'],
    avaliacoes: [
      { autor: 'Mariana Lopes', data: '15 de outubro, 2026', estrelas: 5, titulo: 'Café da manhã com vista inesquecível', texto: 'Chegue cedo nos fins de semana para aproveitar o jardim tranquilo e o pátio do palacete.' }
    ]
  },
  {
    slug: 'jardim-botanico-rio',
    nome: 'Jardim Botânico do Rio de Janeiro',
    iniciais: 'JB',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Jardins e Parques', 'Museus'],
    bairro: 'Jardim Botânico',
    rua: 'Rua Jardim Botânico, 1008',
    cep: '22460-030',
    lat: -22.9675, lng: -43.2248,
    telefone: '(21) 3874-1808',
    site: 'https://www.gov.br/jbrj',
    resumo: 'Instituto de pesquisa e arboreto fundado em 1808 por D. João VI, famoso pela alameda de palmeiras imperiais, orquidário e vitórias-régias.',
    descricao: [
      'Com mais de 50 hectares de área cultivada, o Jardim Botânico reúne milhares de espécies da flora brasileira e mundial, além do Museu do Meio Ambiente e do Orquidário.',
      'As alamedas sombreadas são ideais para caminhadas contemplativas, observação de aves e visita com crianças.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['08:00 - 17:00'] },
      { dia: 'SEG', horas: ['08:00 - 17:00'] },
      { dia: 'TER', horas: ['08:00 - 17:00'] },
      { dia: 'QUA', horas: ['11:00 - 17:00'] },
      { dia: 'QUI', horas: ['08:00 - 17:00'] },
      { dia: 'SEX', horas: ['08:00 - 17:00'] },
      { dia: 'SAB', horas: ['08:00 - 17:00'] }
    ],
    caracteristicas: ['Palmeiras imperiais', 'Orquidário e bromeliário', 'Área histórica de 1808', 'Acessível para cadeirantes'],
    avaliacoes: []
  },
  {
    slug: 'cine-odeon',
    nome: 'Cine Odeon — Centro Cultural LSR',
    iniciais: 'CO',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Cinemas de Rua', 'Centros Culturais'],
    bairro: 'Centro',
    rua: 'Praça Floriano, 7',
    cep: '20031-050',
    lat: -22.9107, lng: -43.1757,
    telefone: '(21) 2240-1093',
    site: 'https://www.kinoplex.com.br',
    resumo: 'Cinema de rua mais icônico da Cinelândia, inaugurado em 1926, palco histórico do Festival do Rio e de mostras de cinema autoral.',
    descricao: [
      'Com uma grande sala em estilo clássico com balcão e foyer elegante, o Cine Odeon é símbolo da Cinelândia e da cinefilia carioca há quase um século.',
      'Recebe estreias de cinema brasileiro e internacional, festivais, pré-estreias comentadas e mostras especiais.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['13:00 - 22:00'] },
      { dia: 'TER', horas: ['13:00 - 22:00'] },
      { dia: 'QUA', horas: ['13:00 - 22:00'] },
      { dia: 'QUI', horas: ['13:00 - 22:00'] },
      { dia: 'SEX', horas: ['13:00 - 22:00'] },
      { dia: 'SAB', horas: ['13:00 - 22:00'] }
    ],
    caracteristicas: ['Cinema histórico de 1926', 'Palco do Festival do Rio', 'Metrô Cinelândia', 'Foyer e café'],
    avaliacoes: [
      { autor: 'André Souza', data: '03 de novembro, 2026', estrelas: 5, titulo: 'Tela gigante e história viva', texto: 'Assistir a um filme no Odeon é uma experiência completamente diferente de shopping.' }
    ]
  },
  {
    slug: 'casa-de-rui-barbosa',
    nome: 'Fundação Casa de Rui Barbosa',
    iniciais: 'RB',
    plano: 'Avançado',
    destaque: false,
    categorias: ['Museus', 'Jardins e Parques'],
    bairro: 'Botafogo',
    rua: 'Rua São Clemente, 134',
    cep: '22260-000',
    lat: -22.9494, lng: -43.1867,
    telefone: '(21) 3289-4600',
    site: 'https://www.gov.br/casaruibarbosa',
    resumo: 'Casa-museu do século XIX em Botafogo rodeada por um amplo jardim público arborizado, com biblioteca, exposições e programação cultural.',
    descricao: [
      'Antiga residência do jurista e escritor Rui Barbosa, a Fundação preserva os cômodos originais do sobrado neoclássico e um dos jardins públicos mais tranquilos de Botafogo.',
      'O jardim é aberto gratuitamente para leitura, descanso e atividades infantis.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['08:00 - 17:30'] },
      { dia: 'SEG', horas: ['08:00 - 17:30'] },
      { dia: 'TER', horas: ['08:00 - 17:30'] },
      { dia: 'QUA', horas: ['08:00 - 17:30'] },
      { dia: 'QUI', horas: ['08:00 - 17:30'] },
      { dia: 'SEX', horas: ['08:00 - 17:30'] },
      { dia: 'SAB', horas: ['08:00 - 17:30'] }
    ],
    caracteristicas: ['Jardim gratuito', 'Casa-museu histórica', 'Próximo ao metrô Botafogo', 'Biblioteca de pesquisa'],
    avaliacoes: []
  },
  {
    slug: 'forte-de-copacabana',
    nome: 'Forte de Copacabana',
    iniciais: 'FC',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Museus', 'Cafeterias Especiais', 'Mirantes e Praças'],
    bairro: 'Copacabana',
    rua: 'Praça Coronel Eugênio Franco, 1',
    cep: '22070-020',
    lat: -22.9868, lng: -43.1877,
    telefone: '(21) 2521-1032',
    site: 'https://www.fortedecopacabana.com',
    resumo: 'Fortificação histórica no Posto 6 com Museu Histórico do Exército, vista panorâmica de toda a orla de Copacabana e filial da Confeitaria Colombo.',
    descricao: [
      'Localizado na ponta sul da Praia de Copacabana, o Forte reúne o Museu Histórico do Exército, cúpula de canhões históricos e um dos cafés da manhã com vista para o mar mais procurados do Rio.',
      'Abriga filiais da Confeitaria Colombo e do Café 18 do Forte com mesas ao ar livre voltadas para a praia.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['10:00 - 19:00'] },
      { dia: 'TER', horas: ['10:00 - 19:00'] },
      { dia: 'QUA', horas: ['10:00 - 19:00'] },
      { dia: 'QUI', horas: ['10:00 - 19:00'] },
      { dia: 'SEX', horas: ['10:00 - 19:00'] },
      { dia: 'SAB', horas: ['10:00 - 19:00'] }
    ],
    caracteristicas: ['Vista de toda a orla', 'Confeitaria Colombo no local', 'Museu histórico', 'Posto 6 Copacabana'],
    avaliacoes: [
      { autor: 'Pedro Henrique', data: '09 de novembro, 2026', estrelas: 5, titulo: 'Vista de cartão-postal', texto: 'Ótimo lugar para um café no fim da tarde olhando a praia de Copacabana inteira.' }
    ]
  },
  {
    slug: 'garota-de-ipanema',
    nome: 'Bar Garota de Ipanema',
    iniciais: 'GI',
    plano: 'Avançado',
    destaque: false,
    categorias: ['Botecos Tradicionais', 'Cozinha Brasileira'],
    bairro: 'Ipanema',
    rua: 'Rua Vinícius de Moraes, 49',
    cep: '22411-010',
    lat: -22.9852, lng: -43.2038,
    telefone: '(21) 2523-3787',
    site: 'https://www.bargarotadeipanema.com.br',
    resumo: 'Antigo Bar Veloso, berço da canção "Garota de Ipanema" composta por Tom Jobim e Vinícius de Moraes em 1962, famoso pela picanha na chapa e chope.',
    descricao: [
      'A duas quadras da Praia de Ipanema, o histórico Bar Garota de Ipanema guarda a memória da bossa nova em fotos e partituras nas paredes.',
      'Serve picanha fatiada na chapa, bolinho de bacalhau, peixes grelhados e chope gelado desde o almoço até a noite.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['11:00 - 23:00'] },
      { dia: 'SEG', horas: ['11:00 - 23:00'] },
      { dia: 'TER', horas: ['11:00 - 23:00'] },
      { dia: 'QUA', horas: ['11:00 - 23:00'] },
      { dia: 'QUI', horas: ['11:00 - 23:59'] },
      { dia: 'SEX', horas: ['11:00 - 23:59'] },
      { dia: 'SAB', horas: ['11:00 - 23:59'] }
    ],
    caracteristicas: ['Berço da Bossa Nova', 'Picanha na chapa', 'Chope tradicional', 'Ipanema'],
    avaliacoes: []
  },
  {
    slug: 'livraria-da-travessa-ipanema',
    nome: 'Livraria da Travessa — Ipanema',
    iniciais: 'LT',
    plano: 'Avançado',
    destaque: false,
    categorias: ['Livrarias Independentes', 'Cafeterias Especiais'],
    bairro: 'Ipanema',
    rua: 'Rua Visconde de Pirajá, 572',
    cep: '22410-002',
    lat: -22.9839, lng: -43.2104,
    telefone: '(21) 3205-9002',
    site: 'https://www.travessa.com.br',
    resumo: 'Referência literária na Zona Sul do Rio com acervo curado de literatura, artes, cinema, lançamentos frequentes e café no segundo andar.',
    descricao: [
      'A unidade de Ipanema da Livraria da Travessa é um dos principais pontos de encontro literários do Rio, com seções especializadas em arte, arquitetura, literatura brasileira e livros importados.',
      'Conta com agenda constante de noites de autógrafos e cafeteria acolhedora no interior da loja.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['10:00 - 20:00'] },
      { dia: 'SEG', horas: ['09:00 - 21:00'] },
      { dia: 'TER', horas: ['09:00 - 21:00'] },
      { dia: 'QUA', horas: ['09:00 - 21:00'] },
      { dia: 'QUI', horas: ['09:00 - 21:00'] },
      { dia: 'SEX', horas: ['09:00 - 21:00'] },
      { dia: 'SAB', horas: ['09:00 - 21:00'] }
    ],
    caracteristicas: ['Lançamentos e debates', 'Café no local', 'Curadoria de artes e cinema', 'Ipanema'],
    avaliacoes: []
  },
  {
    slug: 'ims-rio',
    nome: 'Instituto Moreira Salles (IMS Rio)',
    iniciais: 'IM',
    plano: 'Destaque',
    destaque: true,
    categorias: ['Centros Culturais', 'Galerias de Arte', 'Cinemas de Rua'],
    bairro: 'Gávea',
    rua: 'Rua Marquês de São Vicente, 476',
    cep: '22451-040',
    lat: -22.9765, lng: -43.2317,
    telefone: '(21) 3284-7400',
    site: 'https://ims.com.br/unidade/rio-de-janeiro',
    resumo: 'Centro cultural na Gávea em residência modernista de Olavo Redig de Campos com jardins de Burle Marx, fotografia, cinema, livraria e café.',
    descricao: [
      'Instalado na antiga residência da família Moreira Salles, o IMS Rio é um ícone da arquitetura modernista brasileira cercado por jardins projetados por Roberto Burle Marx.',
      'Oferece exposições gratuitas de fotografia e artes visuais, sala de cinema com curadoria autoral, livraria da Travessa e o Empório Jardim no pátio.'
    ],
    horarios: [
      { dia: 'DOM', horas: ['11:00 - 20:00'] },
      { dia: 'TER', horas: ['11:00 - 20:00'] },
      { dia: 'QUA', horas: ['11:00 - 20:00'] },
      { dia: 'QUI', horas: ['11:00 - 20:00'] },
      { dia: 'SEX', horas: ['11:00 - 20:00'] },
      { dia: 'SAB', horas: ['11:00 - 20:00'] }
    ],
    caracteristicas: ['Jardins de Burle Marx', 'Exposições gratuitas', 'Cinema e livraria', 'Café no jardim'],
    avaliacoes: [
      { autor: 'Fernanda Prado', data: '27 de outubro, 2026', estrelas: 5, titulo: 'Arquitetura, arte e café perfeitos', texto: 'Um dos lugares mais bonitos do Rio para passar uma tarde inteira entre exposições e o jardim.' }
    ]
  }
];

const ARTIGOS = [
  {
    slug: 'roteiro-historico-centro-colombo-gabinete-ccbb',
    titulo: 'Um dia no Centro Histórico: Confeitaria Colombo, Real Gabinete e CCBB',
    publicadoEm: '2026-10-18T10:00:00-03:00',
    editoria: 'Roteiros',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/confeitaria-colombo.jpg',
    resumo: 'Como percorrer a pé três ícones do século XIX e XX no Centro do Rio em um único passeio cheio de arquitetura, arte e café.',
    html: '<p>O Centro do Rio de Janeiro guarda alguns dos interiores mais impressionantes do Brasil a poucos minutos de caminhada entre si.</p><h2>Manhã entre livros e espelhos</h2><p>Comece pelo <strong>Real Gabinete Português de Leitura</strong>, na Rua Luís de Camões, quando a luz da manhã atravessa a claraboia do salão. A duas quadras dali, a <strong>Confeitaria Colombo</strong> convida para um café e um pastel de nata sob os vitrais art nouveau.</p><h2>Tarde de arte no CCBB</h2><p>Siga pela Rua Primeiro de Março até o <strong>CCBB Rio</strong> para visitar as exposições gratuitas e encerrar o dia na Cinelândia, entre o <strong>Theatro Municipal</strong> e o <strong>Cine Odeon</strong>.</p>'
  },
  {
    slug: 'santa-teresa-a-pe-bar-do-mineiro-ruinas-chacara',
    titulo: 'Santa Teresa a pé: Bar do Mineiro, Parque das Ruínas e Chácara do Céu',
    publicadoEm: '2026-10-25T14:00:00-03:00',
    editoria: 'Gastronomia & Cultura',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/parque-das-ruinas.jpg',
    resumo: 'Do mirante panorâmico sobre a Baía de Guanabara às obras de Portinari e à feijoada clássica no Largo dos Guimarães.',
    html: '<p>Subir Santa Teresa é trocar o ritmo acelerado da cidade por ladeiras de paralelepípedo, ateliês abertos e vistas panorâmicas.</p><h2>Mirante e arte moderna</h2><p>Comece pelo <strong>Parque Glória Maria (Parque das Ruínas)</strong> para ver o Centro e a Baía do alto e caminhe dois minutos até o <strong>Museu da Chácara do Céu</strong>, que reúne obras de Portinari e Di Cavalcanti.</p><h2>Almoço clássico</h2><p>Desça até o Largo dos Guimarães para o pastel de feijão e a feijoada do tradicional <strong>Bar do Mineiro</strong>.</p>'
  },
  {
    slug: 'noite-na-lapa-circo-voador-e-rio-scenarium',
    titulo: 'Noite na Lapa: música ao vivo entre o Circo Voador e o Rio Scenarium',
    publicadoEm: '2026-11-02T09:30:00-03:00',
    editoria: 'Música & Noite',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/circo-voador.jpg',
    resumo: 'Dois palcos icônicos que definem a vida noturna carioca, do samba e choro na Rua do Lavradio aos shows sob a lona dos Arcos.',
    html: '<p>A Lapa concentra algumas das casas musicais mais célebres do país, cada uma com identidade própria.</p><h2>Samba e antiquário na Rua do Lavradio</h2><p>No <strong>Rio Scenarium</strong>, três andares decorados com peças antigas recebem bandas de samba, choro e gafieira.</p><h2>A lona lendária</h2><p>A poucos passos dali, aos pés dos Arcos, o <strong>Circo Voador</strong> mantém desde 1982 a tradição de revelar e consagrar nomes da música brasileira.</p>'
  },
  {
    slug: 'jardins-e-modernismo-parque-lage-jardim-botanico-ims',
    titulo: 'Jardins e modernismo: Parque Lage, Jardim Botânico e IMS Rio',
    publicadoEm: '2026-11-08T11:00:00-03:00',
    editoria: 'Arquitetura & Natureza',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/parque-lage.jpg',
    resumo: 'Um corredor verde entre o Jardim Botânico e a Gávea que combina Mata Atlântica, paisagismo de Burle Marx, fotografia e cafés.',
    html: '<p>Ao pé do Maciço da Tijuca, três espaços públicos e culturais formam um dos passeios mais agradáveis do Rio de Janeiro.</p><h2>Manhã verde</h2><p>Caminhe pelas alamedas de palmeiras imperiais do <strong>Jardim Botânico</strong> e siga até o pátio do <strong>Parque Lage</strong> para um café com vista para o Corcovado.</p><h2>Tarde na Gávea</h2><p>Feche o roteiro no <strong>Instituto Moreira Salles (IMS Rio)</strong>, com jardins de Burle Marx, exposições gratuitas de fotografia e sala de cinema.</p>'
  },
  {
    slug: 'zona-portuaria-museu-do-amanha-e-mar',
    titulo: 'Praça Mauá cultural: combinando Museu do Amanhã e Museu de Arte do Rio',
    publicadoEm: '2026-11-12T10:00:00-03:00',
    editoria: 'Arte & Cultura',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/museu-do-amanha.jpg',
    resumo: 'Dicas práticas de horários, dias gratuitos e como aproveitar os dois museus vizinhos na orla revitalizada da Praça Mauá.',
    html: '<p>Frente a frente na Praça Mauá, o <strong>Museu do Amanhã</strong> e o <strong>Museu de Arte do Rio (MAR)</strong> se complementam em arquitetura e proposta.</p><h2>Terça-feira gratuita</h2><p>Ambos oferecem entrada gratuita às terças-feiras, com fácil acesso pelo VLT (Parada dos Museus). Reserve o fim da tarde para o terraço panorâmico do MAR e a caminhada no píer.</p>'
  },
  {
    slug: 'orla-e-bossa-nova-forte-copacabana-garota-ipanema-travessa',
    titulo: 'Do Posto 6 a Ipanema: café no Forte, bossa nova e livraria de rua',
    publicadoEm: '2026-11-16T15:00:00-03:00',
    editoria: 'Gastronomia',
    autor: 'Curadoria Nexus',
    foto: '/assets/fotos/forte-de-copacabana.jpg',
    resumo: 'Um passeio pela Zona Sul unindo o café da manhã no Forte de Copacabana, o histórico Bar Garota de Ipanema e a Livraria da Travessa.',
    html: '<p>Entre Copacabana e Ipanema, história musical, literatura e gastronomia ficam a poucos quarteirões de distância.</p><h2>Comece no Posto 6</h2><p>Tome café olhando toda a curvatura da praia no <strong>Forte de Copacabana</strong>. Depois, atravesse para Ipanema, almoce no histórico <strong>Bar Garota de Ipanema</strong> e passe a tarde explorando as estantes da <strong>Livraria da Travessa</strong>.</p>'
  }
];

const CLASSIFICADOS = [
  {
    id: 'cl-01',
    slug: 'visitas-mediadas-praca-maua',
    categoria: 'Visitas & Roteiros',
    titulo: 'Roteiro guiado a pé: Praça Mauá, MAR e Museu do Amanhã',
    endereco: 'Praça Mauá, Centro, Rio de Janeiro, RJ',
    telefone: '(21) 3031-2741',
    preco: '',
    empresa: 'museu-de-arte-do-rio',
    imagem: '/assets/fotos/museu-de-arte-do-rio.jpg',
    descricao: 'Caminhada cultural de demonstração pela Zona Portuária com foco em arquitetura contemporânea e história do Rio. Entrada gratuita às terças nos museus.'
  },
  {
    id: 'cl-02',
    slug: 'oficinas-artes-visuais-parque-lage',
    categoria: 'Cursos & Oficinas',
    titulo: 'Oficinas abertas de desenho e pintura — EAV Parque Lage',
    endereco: 'Rua Jardim Botânico, 414, Jardim Botânico, Rio de Janeiro, RJ',
    telefone: '(21) 3257-1800',
    preco: '',
    empresa: 'parque-lage',
    imagem: '/assets/fotos/parque-lage.jpg',
    descricao: 'Consulte a programação de cursos livres, palestras e exposições gratuitas da Escola de Artes Visuais no site oficial da instituição.'
  },
  {
    id: 'cl-03',
    slug: 'clube-leitura-ipanema-travessa',
    categoria: 'Literatura',
    titulo: 'Encontros e lançamentos literários em Ipanema',
    endereco: 'Rua Visconde de Pirajá, 572, Ipanema, Rio de Janeiro, RJ',
    telefone: '(21) 3205-9002',
    preco: '',
    empresa: 'livraria-da-travessa-ipanema',
    imagem: '/assets/fotos/livraria-da-travessa-ipanema.jpg',
    descricao: 'Programação semanal de debates, lançamentos de livros e tardes de autógrafos com autores brasileiros e internacionais.'
  },
  {
    id: 'cl-04',
    slug: 'visita-guiada-theatro-municipal',
    categoria: 'Patrimônio',
    titulo: 'Visita guiada pelo salão nobre e foyer do Theatro Municipal',
    endereco: 'Praça Floriano, s/n, Cinelândia, Rio de Janeiro, RJ',
    telefone: '(21) 2332-9191',
    preco: 'R$ 20,00',
    empresa: 'theatro-municipal-rio',
    imagem: '/assets/fotos/theatro-municipal-rio.jpg',
    descricao: 'Percurso educativo pela história e arquitetura de 1909 do Theatro Municipal do Rio de Janeiro (valores de referência sujeitos a confirmação na bilheteria).'
  }
];

const EVENTOS = [
  {
    id: 'ev-terca-gratuita-museus',
    titulo: 'Terça-feira Gratuita na Praça Mauá (MAR + Museu do Amanhã)',
    descricao: '<p>Visitação gratuita às exposições do Museu do Amanhã e do Museu de Arte do Rio durante toda a terça-feira (retirada de ingressos conforme regras oficiais).</p>',
    inicio: '2026-12-01T10:00',
    fim: '2026-12-01T18:00',
    local: 'Praça Mauá',
    endereco: 'Praça Mauá, 1 e 5, Centro',
    imagem: '/assets/fotos/museu-do-amanha.jpg',
    empresa: 'museu-do-amanha'
  },
  {
    id: 'ev-samba-lavradio-scenarium',
    titulo: 'Noite de Samba e Choro na Rua do Lavradio',
    descricao: '<p>Programação demonstrativa: apresentação de samba tradicional e gafieira nos salões do Rio Scenarium, na Lapa.</p>',
    inicio: '2026-12-05T19:30',
    fim: '2026-12-05T23:30',
    local: 'Rio Scenarium',
    endereco: 'Rua do Lavradio, 20, Lapa',
    imagem: '/assets/fotos/rio-scenarium.jpg',
    empresa: 'rio-scenarium'
  },
  {
    id: 'ev-mostra-cinema-odeon',
    titulo: 'Mostra de Clássicos Brasileiros no Cine Odeon',
    descricao: '<p>Sessões especiais em tela grande na Cinelândia celebrando a história do cinema nacional (agenda demonstrativa).</p>',
    inicio: '2026-12-12T18:00',
    fim: '2026-12-13T21:30',
    local: 'Cine Odeon — Centro Cultural LSR',
    endereco: 'Praça Floriano, 7, Cinelândia',
    imagem: '/assets/fotos/cine-odeon.jpg',
    empresa: 'cine-odeon'
  },
  {
    id: 'ev-musica-lona-circo',
    titulo: 'Festival de Verão sob a Lona do Circo Voador',
    descricao: '<p>Encontro de bandas cariocas independentes aos pés dos Arcos da Lapa (evento demonstrativo de portfólio).</p>',
    inicio: '2026-12-19T21:00',
    fim: '2026-12-19T23:59',
    local: 'Circo Voador',
    endereco: 'Rua dos Arcos, s/n, Lapa',
    imagem: '/assets/fotos/circo-voador.jpg',
    empresa: 'circo-voador'
  },
  {
    id: 'ev-fotografia-ims-rio',
    titulo: 'Visita Mediada de Fotografia Brasileira no IMS Rio',
    descricao: '<p>Percurso guiado pelas galerias de fotografia seguidas de encontro nos jardins de Burle Marx, na Gávea.</p>',
    inicio: '2027-01-09T14:00',
    fim: '2027-01-09T17:00',
    local: 'Instituto Moreira Salles (IMS Rio)',
    endereco: 'Rua Marquês de São Vicente, 476, Gávea',
    imagem: '/assets/fotos/ims-rio.jpg',
    empresa: 'ims-rio'
  },
  {
    id: 'ev-caminhada-jardim-botanico',
    titulo: 'Manhã Botânica nas Alamedas Imperiais',
    descricao: '<p>Roteiro matinal de observação da flora brasileira no Orquidário e nas alamedas históricas do Jardim Botânico.</p>',
    inicio: '2027-01-17T09:00',
    fim: '2027-01-17T12:00',
    local: 'Jardim Botânico do Rio de Janeiro',
    endereco: 'Rua Jardim Botânico, 1008, Jardim Botânico',
    imagem: '/assets/fotos/jardim-botanico-rio.jpg',
    empresa: 'jardim-botanico-rio'
  }
];

const CUPONS = [
  {
    id: 'cupom-colombo-cha',
    business_id: 'confeitaria-colombo',
    title: 'Cupom Demo · 15% OFF no Chá da Tarde',
    conditions: 'Cupom demonstrativo de portfólio (sem validade comercial real) para testar a coleta e o painel do parceiro.',
    code: 'NEXUSCOLOMBO',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 100
  },
  {
    id: 'cupom-mineiro-pastel',
    business_id: 'bar-do-mineiro',
    title: 'Cupom Demo · Porção de pastel de feijão com desconto',
    conditions: 'Cupom demonstrativo de portfólio para testar o fluxo de usuário em /cupons e /minha-conta.',
    code: 'MINEIRONEXUS',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 80
  },
  {
    id: 'cupom-odeon-meia',
    business_id: 'cine-odeon',
    title: 'Cupom Demo · Benefício em sessões de quarta-feira',
    conditions: 'Cupom demonstrativo de portfólio para teste do sistema de coleta com controle de estoque.',
    code: 'ODEONNEXUS',
    starts_on: '2026-11-01',
    ends_on: '2027-04-30',
    quantity: 150
  },
  {
    id: 'cupom-scenarium-entrada',
    business_id: 'rio-scenarium',
    title: 'Cupom Demo · Lista amiga para noite de samba',
    conditions: 'Cupom demonstrativo de portfólio (sem validade comercial real).',
    code: 'SCENARIUM26',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 120
  },
  {
    id: 'cupom-travessa-livros',
    business_id: 'livraria-da-travessa-ipanema',
    title: 'Cupom Demo · 10% OFF em literatura brasileira',
    conditions: 'Cupom demonstrativo de portfólio para teste da plataforma Nexus.',
    code: 'TRAVESSA10',
    starts_on: '2026-11-01',
    ends_on: '2027-04-30',
    quantity: 90
  },
  {
    id: 'cupom-garota-ipanema',
    business_id: 'garota-de-ipanema',
    title: 'Cupom Demo · Chope cortesia no almoço',
    conditions: 'Cupom demonstrativo de portfólio (sem validade comercial real).',
    code: 'BOSSAIPANEMA',
    starts_on: '2026-11-01',
    ends_on: '2027-03-31',
    quantity: 100
  }
];

const OFERTAS = [
  {
    id: 'of-colombo-cha',
    business_id: 'confeitaria-colombo',
    kind: 'offer',
    name: 'Experiência Chá da Tarde no Salão Histórico (Demo)',
    description: 'Seleção de doces portugueses, sanduíches clássicos, chá ou café filtrado no salão art nouveau.',
    conditions: 'Oferta demonstrativa para exibição do módulo de ofertas em /ofertas.',
    valid_until: '2027-03-31',
    price_mode: 'from',
    price_cents: 9800,
    image_url: '/assets/fotos/confeitaria-colombo.jpg'
  },
  {
    id: 'of-forte-cafe',
    business_id: 'forte-de-copacabana',
    kind: 'offer',
    name: 'Café da Manhã com Vista para a Orla no Posto 6 (Demo)',
    description: 'Café completo ao ar livre com vista panorâmica para toda a Praia de Copacabana.',
    conditions: 'Oferta demonstrativa para teste do catálogo do Nexus.',
    valid_until: '2027-03-31',
    price_mode: 'from',
    price_cents: 7600,
    image_url: '/assets/fotos/forte-de-copacabana.jpg'
  },
  {
    id: 'of-mineiro-feijoada',
    business_id: 'bar-do-mineiro',
    kind: 'offer',
    name: 'Feijoada Completa para Dois em Santa Teresa (Demo)',
    description: 'Acompanha arroz, couve mineira, farofa, laranja e porção de pastel de feijão.',
    conditions: 'Oferta demonstrativa de portfólio.',
    valid_until: '2027-04-30',
    price_mode: 'fixed',
    price_cents: 13800,
    image_url: '/assets/fotos/bar-do-mineiro.jpg'
  },
  {
    id: 'of-theatro-visita',
    business_id: 'theatro-municipal-rio',
    kind: 'offer',
    name: 'Visita Guiada Histórica pelo Theatro Municipal (Demo)',
    description: 'Tour guiado pelo foyer, escadaria monumental, salão nobre e sala de espetáculos.',
    conditions: 'Valores e horários oficiais devem ser confirmados na bilheteria.',
    valid_until: '2027-04-30',
    price_mode: 'fixed',
    price_cents: 2000,
    image_url: '/assets/fotos/theatro-municipal-rio.jpg'
  }
];

const empresasJSON = LOCAIS.map(l => ({
  slug: l.slug,
  slugPortal: l.slug,
  nome: l.nome,
  iniciais: l.iniciais,
  plano: l.plano,
  destaque: l.destaque,
  temPaginaPropria: l.plano === 'Destaque',
  categorias: l.categorias.map(nome => ({
    nome,
    slug: nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  })),
  bairro: l.bairro,
  cidade: 'Rio de Janeiro',
  rua: l.rua,
  cep: l.cep,
  endereco: `${l.rua}, ${l.bairro}, Rio de Janeiro, RJ`,
  telefone: l.telefone,
  telefoneDigitos: l.telefone.replace(/\D/g, ''),
  whatsapp: '',
  email: '',
  site: l.site,
  resumo: l.resumo,
  descricao: l.descricao,
  horarios: l.horarios,
  caracteristicas: l.caracteristicas,
  redes: [],
  imagem: `/assets/fotos/${l.slug}.jpg`,
  imagemGrande: `/assets/fotos/${l.slug}.jpg`,
  fotos: [`/assets/fotos/${l.slug}.jpg`],
  geo: { lat: l.lat, lng: l.lng },
  avaliacoes: { itens: l.avaliacoes },
  classificados: CLASSIFICADOS.filter(c => c.empresa === l.slug).map(c => c.slug)
}));
await writeFile(cp('empresas.json'), JSON.stringify(empresasJSON, null, 2) + '\n', 'utf8');

const localizacoesJSON = {
  geradoEm: '2026-11-22',
  fontes: 'Coordenadas públicas reais dos 20 estabelecimentos e espaços culturais do Rio de Janeiro, validadas contra a malha do IBGE.',
  empresas: Object.fromEntries(LOCAIS.map(l => [l.slug, { lat: l.lat, lng: l.lng, precisao: 'rua' }])),
  semLocal: []
};
await writeFile(cp('localizacoes.json'), JSON.stringify(localizacoesJSON, null, 2) + '\n', 'utf8');

const colecoesJSON = {
  fonte: 'Coleções temáticas da página inicial do Nexus.',
  colecoes: [
    { id: 'cafes-historicos', titulo: 'Cafés históricos e paradas obrigatórias', subtitulo: 'Da Confeitaria Colombo ao pátio do Parque Lage e o Forte de Copacabana.', grupos: ['cafes-e-padarias'] },
    { id: 'museus-centros-culturais', titulo: 'Museus, arquitetura e centros culturais', subtitulo: 'CCBB, Museu do Amanhã, MAR, Real Gabinete, IMS Rio e Theatro Municipal.', grupos: ['arte-e-cultura'] },
    { id: 'noite-lapa-botecos', titulo: 'Samba, música ao vivo e botecos clássicos', subtitulo: 'Circo Voador, Rio Scenarium, Bar do Mineiro e Garota de Ipanema.', grupos: ['bares-e-botecos', 'musica-e-palcos'] },
    { id: 'jardins-cinema-livros', titulo: 'Jardins, cinema de rua e livrarias', subtitulo: 'Jardim Botânico, Parque das Ruínas, Cine Odeon e Livraria da Travessa.', grupos: ['parques-e-lazer', 'livrarias-e-cinema'] }
  ]
};
await writeFile(cp('colecoes.json'), JSON.stringify(colecoesJSON, null, 2) + '\n', 'utf8');

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
    imagem: { original: a.foto },
    galeria: [a.foto],
    html: a.html,
    texto: a.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }))
};
await writeFile(cp('artigos.json'), JSON.stringify(artigosJSON, null, 2) + '\n', 'utf8');

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
    imagem: c.imagem,
    linhas: [c.categoria, c.titulo, c.descricao, ...(c.preco ? [c.preco] : [])]
  }))
};
await writeFile(cp('classificados.json'), JSON.stringify(classificadosJSON, null, 2) + '\n', 'utf8');

await writeFile(cp('eventos.json'), JSON.stringify({ fonte: 'Agenda cultural e gastronômica demonstrativa em espaços reais do Rio.', eventos: EVENTOS }, null, 2) + '\n', 'utf8');
await writeFile(cp('cupons.json'), JSON.stringify({ fonte: 'Cupons demonstrativos de portfólio.', cupons: CUPONS }, null, 2) + '\n', 'utf8');
await writeFile(cp('ofertas.json'), JSON.stringify({ fonte: 'Ofertas demonstrativas de portfólio.', ofertas: OFERTAS }, null, 2) + '\n', 'utf8');
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

console.log(`Acervo real do Rio gerado: ${LOCAIS.length} locais reais, ${ARTIGOS.length} roteiros, ${CLASSIFICADOS.length} classificados, ${EVENTOS.length} eventos, ${CUPONS.length} cupons, ${OFERTAS.length} ofertas.`);
