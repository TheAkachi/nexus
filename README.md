# Nexus · Guia Gastronômico & Cultural do Rio de Janeiro

> **Projeto demonstrativo de portfólio Full Stack** desenvolvido por [Pedro Siqueira](https://www.linkedin.com/in/pedro-akachi) (com apoio de IA durante o desenvolvimento). Os 20 espaços culturais e gastronômicos listados são locais públicos reais do Rio de Janeiro (endereços, sites oficiais e fotografias de licença aberta da Wikimedia Commons). Cupons, ofertas, classificados e contas de parceiro/admin são demonstrativos para avaliação da aplicação.

O **Nexus** é uma aplicação web Full Stack renderizada no servidor (SSR) para descoberta hiperlocal de restaurantes, cafés especiais, bares, galerias, cinemas de rua, palcos e eventos no Rio de Janeiro.

## Principais funcionalidades

- **Mapa SVG interativo do Rio de Janeiro:** gerado a partir de malhas municipais do IBGE e vias/trilhos/bairros do OpenStreetMap (`scripts/gerar-mapa.mjs`), com zoom sincronizado, arraste, foco automático nos pontos e tema claro/escuro.
- **Busca hiperlocal com filtros cruzados (`/busca`):** texto, categoria ↔ bairro (se filtram mutuamente), status *"aberto agora"* calculado no fuso de São Paulo com feriados nacionais, favoritos no navegador (`/favoritos`), avaliações e cupons.
- **Cupons e contas de visitantes (`/cupons`, `/minha-conta`):** criação de conta, coleta de cupons com controle de estoque/validade e envio de avaliações moderadas.
- **Painel do Parceiro (`/painel`):** gerenciamento do perfil do estabelecimento, horários, catálogo/ofertas, criação de cupons, métricas de 7/30/90 dias e controle de acessos por papel (`dono`, `editor`, `financeiro`, `leitura`).
- **Administração da curadoria (`/admin`):** gestão de lugares, fila de aprovação, categorias, coleções, eventos, roteiros/artigos, banners, usuários e relatórios.
- **Segurança & Arquitetura:** Node.js 22+ nativo sem frameworks pesados no servidor, data loaders (`api/data/`) separados de views puras (`api/views/`), PostgreSQL (ou PGlite embarcado em dev), migrações SQL (`db/migrations/`), senhas com `scrypt`, sessões `HttpOnly`, proteção CSRF, auditoria append-only e CSP estrita.

## Contas de demonstração (já semeadas no `db:seed`)

Acesse `/entrar` e utilize os botões de **Acesso demonstrativo** (1 clique) ou as credenciais abaixo:

| Perfil | E-mail | Senha | Destino |
| --- | --- | --- | --- |
| Visitante | `visitante@nexus.demo` | `NexusDemo2026!` | `/cupons` e `/minha-conta` |
| Parceiro | `parceiro@nexus.demo` | `NexusDemo2026!` | `/painel` (*Confeitaria Colombo* e *Bar do Mineiro*) |
| Admin | `admin@nexus.demo` | `NexusDemo2026!` | `/admin` |

## Como executar localmente

Requisitos: **Node.js 22+** (usa PGlite embarcado automaticamente em `.runtime/postgres`, sem precisar instalar PostgreSQL localmente).

```bash
npm install
npm run db:seed
npm start
```

Abra **http://127.0.0.1:4183/** no navegador.

Para rodar com Docker e PostgreSQL externo, configure `DATABASE_URL` e `PUBLIC_ORIGIN` (veja `.env.example` e `Dockerfile`).

## Scripts úteis

- `npm run db:seed` — aplica as migrações e carrega o acervo demonstrativo (20 lugares, 6 cupons, 6 eventos, 6 artigos, 4 ofertas, 4 classificados e 3 contas demo).
- `node scripts/gerar-mapa.mjs --manter-localizacoes` — regenera `p2/mapa-rio.svg` e `api/mapa-rio.mjs` a partir do IBGE e OpenStreetMap.
- `node scripts/syntax-check.mjs` — valida a sintaxe de todos os módulos ES do projeto.
