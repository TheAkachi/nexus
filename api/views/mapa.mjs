import { escape as e } from '../lib/html.mjs';

// vm Mapa: SVG na página cujas camadas (<use>) vêm de /assets/mapa-baixada.svg, então a cor segue o tema pelo CSS.
// Começa no quadro com todas as empresas; o site.js troca o viewBox para o zoom (roda do mouse, pinça, arraste e botões).
// Tamanhos (raio, rótulos) são para a tela sem JavaScript (~0,55 px por unidade); o site.js os recalcula a cada zoom.
const camadas = ['res', 'ter', 'sec', 'pri', 'exp'];
const icon = d => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;

// v0.17.0: também em /bairros, /bairros/<slug> e na busca; opcoes troca o cabeçalho, a origem do link (from=) e o id do título.
// Foco inicial (16/10, pedido do usuário): o mapa abre no aglomerado de empresas, sem os pontos isolados (8% de cada ponta em
// x e em y), com folga de 18% e no mínimo 30% do quadro. O quadro todo continua sendo o limite do zoom para afastar.
function foco(m) {
  const pts = m.pontos || [], q = m.quadro;
  if (pts.length < 5) return null;
  const faixa = vs => { const o = [...vs].sort((a, b) => a - b), corte = Math.floor(o.length * 0.08); return [o[corte], o[o.length - 1 - corte]]; };
  const [x0, x1] = faixa(pts.map(p => p.x)), [y0, y1] = faixa(pts.map(p => p.y));
  const w = Math.max((x1 - x0) * 1.36, q.w * 0.3), h = Math.max((y1 - y0) * 1.36, q.h * 0.3);
  if (w * h > q.w * q.h * 0.85) return null;
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, q.x), q.x + q.w - w), y = Math.min(Math.max((y0 + y1) / 2 - h / 2, q.y), q.y + q.h - h);
  return [x, y, w, h].map(v => +v.toFixed(1));
}

export function mapView(m, { eyebrow = 'MAPA DO GUIA · RIO DE JANEIRO', titulo, from = 'home', id = 'map-title' } = {}) {
  const q = m.quadro;
  const use = (id, cls) => `<use href="/assets/mapa-rio.svg#${id}" class="${cls}"/>`;
  const base = `<g class="map-base" aria-hidden="true">${use('terra', 'm-terra')}<g class="m-fora">${camadas.map(k => use(`${k}-fora`, `m-${k}`)).join('')}</g>${use('rios', 'm-rios')}<g class="m-dentro">${camadas.map(k => use(k, `m-${k}`)).join('')}</g>${use('trilhos', 'm-trilhos')}${use('terra', 'm-limites')}</g>`;
  const labels = m.municipios.map(l => `<text x="${l.x}" y="${l.y}">${e(l.nome)}</text>`).join('');
  const districts = m.bairros.map(b => `<text x="${b.x}" y="${b.y}"${b.guia ? ' class="is-guia"' : ''}>${e(b.nome)}</text>`).join('');
  const dots = m.pontos.map(p => `<a class="map-point${p.approx ? ' is-approx' : ''}" href="/comercio/${e(p.slug)}?from=${from}"><circle cx="${p.x}" cy="${p.y}" r="8"/><title>${e(p.name)} · ${e(p.district || p.city || 'Rio de Janeiro')}${p.approx ? ' (localização aproximada, no bairro)' : ''}</title></a>`).join('');
  return `<figure class="future-map baixada-map" data-map data-quadro="${q.x} ${q.y} ${q.w} ${q.h}" data-area="${m.largura} ${m.altura}"${(f => f ? ` data-foco="${f.join(' ')}"` : '')(foco(m))} aria-labelledby="${id}">
<figcaption class="map-head"><span class="eyebrow">${e(eyebrow)}</span><strong id="${id}">${e(titulo ?? `${m.located} ${m.located === 1 ? 'lugar' : 'lugares'} no mapa`)}</strong></figcaption>
<div class="map-frame"><svg class="map-svg" viewBox="${q.x} ${q.y} ${q.w} ${q.h}" role="group" aria-label="Lugares do guia Nexus no Rio de Janeiro">${base}<g class="map-bairros" aria-hidden="true">${districts}</g><g class="map-labels" aria-hidden="true">${labels}</g><g class="map-points">${dots}</g></svg>
<div class="map-controls" role="group" aria-label="Zoom do mapa"><button type="button" class="map-control" data-map-zoom="in" aria-label="Aproximar" title="Aproximar">${icon('M8 3v10M3 8h10')}</button><button type="button" class="map-control" data-map-zoom="out" aria-label="Afastar" title="Afastar">${icon('M3 8h10')}</button><button type="button" class="map-control" data-map-zoom="reset" aria-label="Ver todos os lugares" title="Ver todos os lugares">${icon('M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10')}</button></div></div>
<div class="map-foot"><small class="map-hint"><span class="hint-mouse">Role o mouse sobre o mapa para aproximar · arraste para mover</span><span class="hint-touch">Use dois dedos para aproximar · toque duplo amplia</span></small><small>${m.missing ? `${m.missing} sem endereço no acervo · ` : ''}Limites: IBGE · Ruas: © OpenStreetMap</small></div>
</figure>`;
}
