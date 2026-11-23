// Gera o mapa da região das empresas do guia (Baixada Fluminense) e a localização de cada empresa do acervo.
// Uso (precisa de internet): node scripts/gerar-mapa.mjs [--manter-localizacoes]
//   --manter-localizacoes reaproveita conteudo-portal/localizacoes.json e só redesenha o mapa.
//   MAPA_CACHE=<pasta> guarda as respostas do IBGE/OpenStreetMap para rodar de novo sem baixar tudo.
// Fontes: malhas municipais do IBGE, ruas/trilhos/rios/bairros do OpenStreetMap (Overpass) e geocodificação OSM Nominatim (1 consulta/s).
// Saídas: p2/mapa-baixada.svg (camadas referenciadas por <use> na página; a cor vem do CSS de cada tema),
//         api/mapa-baixada.mjs (projeção, quadro inicial e rótulos) e conteudo-portal/localizacoes.json (coordenada e precisão de cada empresa).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Nexus-Guia-Mapa/1.0 (https://github.com/TheAkachi/nexus)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MUNICIPIOS = { 3304557: 'Rio de Janeiro' };
// Quadro inicial: todos os locais com MARGEM_KM de folga, na proporção largura/altura PROPORCAO (a mesma de --map-r no CSS).
// Em volta dele o SVG traz EXTRA (fração do quadro, de cada lado) para preencher telas de outra proporção e permitir arrastar.
const MARGEM_KM = 1.4, PROPORCAO = 1.15, EXTRA = .15, W = 1000;

async function getJSON(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...init.headers } });
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  return r.json();
}
async function cached(name, load) {
  const dir = process.env.MAPA_CACHE; if (!dir) return load();
  const file = resolve(dir, name.replace(/[^\w.-]+/g, '_') + '.json');
  try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
  const data = await load(); await mkdir(dir, { recursive: true }); await writeFile(file, JSON.stringify(data)); return data;
}
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const overpass = (name, query) => cached(name, async () => {
  let lastErr;
  for (const endpoint of OVERPASS_URLS) {
    try {
      return await getJSON(endpoint, { method: 'POST', body: new URLSearchParams({ data: `[out:json][timeout:120];${query}` }) });
    } catch (err) { lastErr = err; await sleep(1500); }
  }
  throw lastErr;
});

// 1. Limites municipais (IBGE).
const municipios = [];
for (const [id, nome] of Object.entries(MUNICIPIOS)) {
  const geo = await cached(`ibge-${id}`, () => getJSON(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${id}?formato=application/vnd.geo%2Bjson&qualidade=maxima`));
  const g = geo.features[0].geometry;
  municipios.push({ nome, polygons: g.type === 'Polygon' ? [g.coordinates] : g.coordinates });
}
const coords = municipios.flatMap(m => m.polygons.flatMap(p => p[0]));
const baixada = { minLng: Math.min(...coords.map(p => p[0])), maxLng: Math.max(...coords.map(p => p[0])), minLat: Math.min(...coords.map(p => p[1])), maxLat: Math.max(...coords.map(p => p[1])) };
const inside = ([x, y], ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inMunicipio = (lng, lat, nome) => municipios.filter(m => !nome || m.nome === nome).some(m => m.polygons.some(poly => inside([lng, lat], poly[0]) && !poly.slice(1).some(hole => inside([lng, lat], hole))));

// 2. Localização das empresas: coordenada do portal só vale se cair no município informado; senão, geocodifica.
const saida = resolve(root, 'conteudo-portal/localizacoes.json');
let empresas = {}, semLocal = [];
if (process.argv.includes('--manter-localizacoes')) ({ empresas, semLocal } = JSON.parse(await readFile(saida, 'utf8')));
else {
  const companies = JSON.parse(await readFile(resolve(root, 'conteudo-portal/empresas.json'), 'utf8'));
  const clean = s => String(s || '').replace(/\b(loja|lj)\b\s*,?/gi, '').replace(/\s+/g, ' ').replace(/\s*,\s*,/g, ',').trim().replace(/^,|,$/g, '').trim();
  const streetType = /^(rua|r\.|avenida|av\.?|estrada|estr\.?|travessa|rodovia|praça|alameda)\s+/i;
  const nominatim = async params => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    for (const [k, v] of Object.entries({ format: 'jsonv2', limit: 1, countrycodes: 'br', viewbox: `${baixada.minLng},${baixada.maxLat},${baixada.maxLng},${baixada.minLat}`, bounded: 1, ...params })) url.searchParams.set(k, v);
    await sleep(1100);
    return (await getJSON(url, { headers: { 'Accept-Language': 'pt-BR' } }))[0] || null;
  };
  for (const c of companies) {
    const cidade = Object.values(MUNICIPIOS).includes(c.cidade) ? c.cidade : null;
    if (c.geo && inMunicipio(c.geo.lng, c.geo.lat, cidade)) { empresas[c.slug] = { lat: c.geo.lat, lng: c.geo.lng, precisao: 'portal' }; continue; }
    const bairro = c.bairro || '', city = cidade || c.cidade || 'Nova Iguaçu';
    const raw = clean(c.rua) || clean((c.endereco || '').split(',').slice(0, 2).join(','));
    const street = streetType.test(raw) && /[a-zà-ú]{3}/i.test(raw.replace(streetType, '').replace(/[\d,\-]/g, '')) ? raw.split(' - ')[0] : '';
    const attempts = [];
    if (street) attempts.push(['rua', { q: [street, bairro, city, 'RJ'].filter(Boolean).join(', ') }]);
    if (c.cep) attempts.push(['cep', { postalcode: String(c.cep).replace(/\D/g, ''), country: 'Brasil' }]);
    if (bairro) attempts.push(['bairro', { q: `${bairro}, ${city}, RJ` }]);
    let found = null;
    for (const [precisao, params] of attempts) {
      const r = await nominatim(params);
      if (r && inMunicipio(+r.lon, +r.lat, cidade)) { found = { lat: +(+r.lat).toFixed(6), lng: +(+r.lon).toFixed(6), precisao, consulta: params.q || `CEP ${params.postalcode}` }; break; }
    }
    if (found) empresas[c.slug] = found; else semLocal.push(c.slug);
    console.log(c.slug.padEnd(52), found ? `${found.precisao} ${found.lat},${found.lng}` : 'sem localização');
  }
  await writeFile(saida, JSON.stringify({ geradoEm: new Date().toISOString().slice(0, 10), fontes: 'Coordenadas do portal PRIMIG validadas contra as malhas do IBGE; demais por OpenStreetMap Nominatim. precisao: portal, rua, cep ou bairro.', empresas, semLocal }, null, 1) + '\n');
}

// 3. Recorte: quadro em volta das empresas e área de dados (quadro + EXTRA), em projeção equirretangular corrigida pela latitude.
const pts = Object.values(empresas);
let [w, e, s, n] = [Math.min(...pts.map(p => p.lng)), Math.max(...pts.map(p => p.lng)), Math.min(...pts.map(p => p.lat)), Math.max(...pts.map(p => p.lat))];
const kx = Math.cos(((s + n) / 2) * Math.PI / 180), kmLat = 111.32, kmLng = 111.32 * kx;
[w, e, s, n] = [w - MARGEM_KM / kmLng, e + MARGEM_KM / kmLng, s - MARGEM_KM / kmLat, n + MARGEM_KM / kmLat];
const [largKm, altKm] = [(e - w) * kmLng, (n - s) * kmLat];
if (largKm / altKm < PROPORCAO) { const d = (altKm * PROPORCAO - largKm) / 2 / kmLng; [w, e] = [w - d, e + d]; }
else { const d = (largKm / PROPORCAO - altKm) / 2 / kmLat; [s, n] = [s - d, n + d]; }
const [dLng, dLat] = [(e - w) * EXTRA, (n - s) * EXTRA];
const area = { minLng: w - dLng, maxLng: e + dLng, minLat: s - dLat, maxLat: n + dLat };
const K = W / ((e - w) * kx); // unidades do SVG por grau de latitude
const project = ([lng, lat]) => [(lng - area.minLng) * kx * K, (area.maxLat - lat) * K];
const AW = Math.round((area.maxLng - area.minLng) * kx * K), AH = Math.round((area.maxLat - area.minLat) * K);
const [qx, qy] = project([w, n]), quadro = { x: +qx.toFixed(1), y: +qy.toFixed(1), w: W, h: +((n - s) * K).toFixed(1) };

// Grade de 1 unidade com o índice do município (0 = fora da Baixada): separa vias de dentro e de fora e posiciona rótulos.
const grid = new Uint8Array(AW * AH);
municipios.forEach((m, mi) => {
  const rows = Array.from({ length: AH }, () => []);
  for (const ring of m.polygons.flat()) {
    const P = ring.map(project);
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [x1, y1] = P[j], [x2, y2] = P[i];
      for (let r = Math.max(0, Math.ceil(Math.min(y1, y2) - .5)); r <= Math.min(AH - 1, Math.floor(Math.max(y1, y2) - .5)); r++) {
        const y = r + .5; if ((y1 > y) === (y2 > y)) continue;
        rows[r].push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
  }
  rows.forEach((xs, r) => { xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let c = Math.max(0, Math.ceil(xs[k] - .5)); c <= Math.min(AW - 1, Math.floor(xs[k + 1] - .5)); c++) grid[r * AW + c] = mi + 1; });
});
const cell = ([x, y]) => x < 0 || y < 0 || x >= AW || y >= AH ? 0 : grid[Math.floor(y) * AW + Math.floor(x)];

// 4. Vias, trilhos e rios do OpenStreetMap, simplificados por Douglas-Peucker e emendados pelas pontas para encurtar o SVG.
const bbox = [area.minLat, area.minLng, area.maxLat, area.maxLng].map(v => v.toFixed(4)).join(',');
const classes = { motorway: 'exp', trunk: 'exp', motorway_link: 'exp', trunk_link: 'exp', primary: 'pri', primary_link: 'pri', secondary: 'sec', secondary_link: 'sec', tertiary: 'ter', tertiary_link: 'ter', unclassified: 'ter', residential: 'res', living_street: 'res', pedestrian: 'res' };
const vias = await overpass(`osm-vias-${bbox}`, `way["highway"~"^(${Object.keys(classes).join('|')})$"](${bbox});out geom;`);
const extra = await overpass(`osm-extra-${bbox}`, `(way["railway"="rail"][!"service"](${bbox});way["waterway"="river"](${bbox});node["place"="suburb"](${bbox}););out geom;`);
const simplify = (P, eps) => {
  if (P.length < 3) return P;
  const [a, b] = [P[0], P[P.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  let max = 0, idx = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = len ? Math.abs(dy * P[i][0] - dx * P[i][1] + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(P[i][0] - a[0], P[i][1] - a[1]); if (d > max) { max = d; idx = i; } }
  return max > eps ? [...simplify(P.slice(0, idx + 1), eps).slice(0, -1), ...simplify(P.slice(idx), eps)] : [a, b];
};
const key = p => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
function chain(lines) {
  const ends = new Map(), used = new Uint8Array(lines.length), out = [];
  lines.forEach((l, i) => { for (const k of [key(l[0]), key(l.at(-1))]) (ends.get(k) || ends.set(k, []).get(k)).push(i); });
  const next = k => (ends.get(k) || []).find(i => !used[i]) ?? -1;
  lines.forEach((l, i) => {
    if (used[i]) return; used[i] = 1; let cur = l.slice();
    for (let j; (j = next(key(cur.at(-1)))) >= 0;) { used[j] = 1; const m = lines[j]; cur = cur.concat(key(m[0]) === key(cur.at(-1)) ? m.slice(1) : m.slice(0, -1).reverse()); }
    for (let j; (j = next(key(cur[0]))) >= 0;) { used[j] = 1; const m = lines[j]; cur = (key(m.at(-1)) === key(cur[0]) ? m.slice(0, -1) : m.slice(1).reverse()).concat(cur); }
    out.push(cur);
  });
  return out;
}
// Caminho compacto: décimos de unidade, tudo relativo ("m" + pares), sem zeros nem separadores supérfluos.
// Anéis (closed) não são emendados e terminam em "z", que devolve o ponto atual ao início do anel.
const num = t => { const a = Math.abs(t), i = Math.floor(a / 10), d = a % 10; return (t < 0 ? '-' : '') + ((i ? String(i) : '') + (d ? '.' + d : '') || '0'); };
function encode(lines, eps, closed = false) {
  let out = '', X = 0, Y = 0;
  for (const line of closed ? lines : chain(lines)) {
    const P = simplify(line, eps).map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (closed && P.length > 1 && P[0][0] === P.at(-1)[0] && P[0][1] === P.at(-1)[1]) P.pop();
    if (P.length < (closed ? 3 : 2)) continue;
    let seg = 'm', dot = false;
    P.forEach(([x, y], i) => { for (const t of [num(x - X), num(y - Y)]) { if (seg.length > 1 && !(t[0] === '-' || (t[0] === '.' && dot))) seg += ' '; seg += t; dot = t.includes('.'); } X = x; Y = y; });
    if (closed) { seg += 'z'; [X, Y] = P[0]; }
    out += seg;
  }
  return out;
}
const camadas = { exp: [[], []], pri: [[], []], sec: [[], []], ter: [[], []], res: [[], []] }; // [dentro, fora] da Baixada
for (const way of vias.elements) {
  const P = way.geometry.map(p => project([p.lon, p.lat])), dest = camadas[classes[way.tags.highway]];
  // Divide a via onde ela cruza o limite da Baixada; o trecho de fora sai mais apagado.
  let run = [P[0]], dentro = cell(P[0]) > 0;
  for (let i = 1; i < P.length; i++) { const d = cell(P[i]) > 0; run.push(P[i]); if (d !== dentro) { dest[dentro ? 0 : 1].push(run); run = [P[i]]; dentro = d; } }
  if (run.length > 1) dest[dentro ? 0 : 1].push(run);
}
const linhas = tag => extra.elements.filter(x => x.type === 'way' && x.tags?.[tag]).map(x => x.geometry.map(p => project([p.lon, p.lat])));
const terra = encode(municipios.flatMap(m => m.polygons.flat()).map(ring => ring.map(project)), .25, true);
const eps = { exp: .2, pri: .2, sec: .22, ter: .25, res: .3 };
const paths = [['terra', terra], ...Object.entries(camadas).flatMap(([k, [dentro, fora]]) => [[k, encode(dentro, eps[k])], [k + '-fora', encode(fora, eps[k])]]), ['trilhos', encode(linhas('railway'), .2)], ['rios', encode(linhas('waterway'), .3)]];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AW} ${AH}">
<!-- Mapa da cidade do Rio de Janeiro para o guia Nexus. Limites: IBGE. Ruas, trilhos e rios: © colaboradores do OpenStreetMap (ODbL). Gerado por scripts/gerar-mapa.mjs. -->
${paths.map(([id, d]) => `<path id="${id}" d="${d}"${id === 'terra' ? ' fill-rule="evenodd"' : ''} vector-effect="non-scaling-stroke"/>`).join('\n')}
</svg>
`;
await writeFile(resolve(root, 'p2/mapa-rio.svg'), svg);

// 5. Rótulos. Municípios: ponto dentro do quadro mais distante das divisas (transformada de distância na grade).
const dist = new Float32Array(AW * AH).fill(1e9);
for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const i = y * AW + x, g = grid[i]; if ((x && grid[i - 1] !== g) || (y && grid[i - AW] !== g) || (x < AW - 1 && grid[i + 1] !== g) || (y < AH - 1 && grid[i + AW] !== g)) dist[i] = 0; }
for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const i = y * AW + x; if (x) dist[i] = Math.min(dist[i], dist[i - 1] + 1); if (y) dist[i] = Math.min(dist[i], dist[i - AW] + 1, x ? dist[i - AW - 1] + 1.414 : 1e9, x < AW - 1 ? dist[i - AW + 1] + 1.414 : 1e9); }
for (let y = AH - 1; y >= 0; y--) for (let x = AW - 1; x >= 0; x--) { const i = y * AW + x; if (x < AW - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1); if (y < AH - 1) dist[i] = Math.min(dist[i], dist[i + AW] + 1, x < AW - 1 ? dist[i + AW + 1] + 1.414 : 1e9, x ? dist[i + AW - 1] + 1.414 : 1e9); }
// Meia largura do nome em unidades (11 px em maiúsculas a ~0,55 px por unidade) e distância aos pontos das empresas, para o nome não cobrir pontos nem sair do quadro.
const pontos = pts.map(p => project([p.lng, p.lat]));
const rotulos = municipios.map((m, mi) => {
  let best = { score: 0 }; const half = m.nome.length * 6.8;
  for (let y = Math.ceil(quadro.y); y < quadro.y + quadro.h; y += 3) for (let x = Math.ceil(quadro.x); x < quadro.x + quadro.w; x += 3) {
    if (grid[y * AW + x] !== mi + 1) continue;
    const perto = Math.min(...pontos.map(p => Math.hypot(p[0] - x, (p[1] - y) * 2.5)));
    const score = Math.min(dist[y * AW + x], x - quadro.x - half, quadro.x + quadro.w - x - half, y - quadro.y - 15, quadro.y + quadro.h - y - 8, perto - half * .8);
    if (score > best.score) best = { score, x, y };
  }
  return best.score >= 20 ? { nome: m.nome, rotulo: [best.x, best.y] } : null;
}).filter(Boolean);
// Bairros (place=suburb do OpenStreetMap) dentro da Baixada; a página mostra os que cabem conforme o zoom.
const bairros = extra.elements.filter(x => x.type === 'node' && x.tags?.name).map(x => ({ nome: x.tags.name, p: project([x.lon, x.lat]) }))
  .filter(b => cell(b.p) > 0).map(b => ({ nome: b.nome, x: Math.round(b.p[0]), y: Math.round(b.p[1]) }))
  .filter((b, i, a) => a.findIndex(o => o.nome === b.nome && Math.hypot(o.x - b.x, o.y - b.y) < 40) === i);

const mod = `// Gerado por scripts/gerar-mapa.mjs a partir das malhas do IBGE e do OpenStreetMap. Não editar à mão.
// largura/altura: área do SVG (unidades); quadro: enquadramento inicial com todas as empresas (proporção = --map-r no CSS).
export const mapa = ${JSON.stringify({ largura: AW, altura: AH, quadro, limites: Object.fromEntries(Object.entries(area).map(([k, v]) => [k, +v.toFixed(6)])), kx: +kx.toFixed(8), escala: +K.toFixed(6), municipios: rotulos, bairros })};
export const projetar = (lng, lat) => [(lng - mapa.limites.minLng) * mapa.kx * mapa.escala, (mapa.limites.maxLat - lat) * mapa.escala];
`;
await writeFile(resolve(root, 'api/mapa-rio.mjs'), mod);
const km = v => (v / K * kmLat).toFixed(1);
console.log(`área ${AW}x${AH} (${km(AW)} x ${km(AH)} km); quadro ${JSON.stringify(quadro)} proporção ${(quadro.w / quadro.h).toFixed(3)}`);
console.log('camadas', paths.map(([id, d]) => `${id}=${Math.round(d.length / 1024)}KB`).join(' '));
console.log(`svg ${Math.round(svg.length / 1024)} KB; rótulos ${rotulos.map(r => r.nome).join(', ')}; bairros ${bairros.length}; empresas localizadas ${Object.keys(empresas).length}, sem localização ${semLocal.length}`);
