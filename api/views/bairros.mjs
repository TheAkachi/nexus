import { escape as e } from '../lib/html.mjs';
import { businessCard } from './componentes.mjs';
import { mapView } from './mapa.mjs';

// Bairros (v0.17.0, contrato 18.2): /bairros com a lista dos bairros que têm empresas e o mapa do guia; /bairros/<slug> com
// as empresas do bairro, o mapa só com elas e outros bairros da mesma cidade. Contagens e nomes vêm do vm, nada inventado.
const empresas = n => `${n} ${n === 1 ? 'empresa' : 'empresas'}`;

// vm Bairros {map, bairros:[{slug, name, city, count}]}, em ordem alfabética; aqui agrupados por cidade.
export function bairrosView(vm) {
  const cidades = new Map();
  for (const b of vm.bairros || []) cidades.set(b.city || 'Outras cidades', [...(cidades.get(b.city || 'Outras cidades') || []), b]);
  const grupos = [...cidades.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  const lista = grupos.map(([cidade, bairros]) => `<section class="district-city" aria-labelledby="cidade-${e(bairros[0].slug)}"><h2 id="cidade-${e(bairros[0].slug)}">${e(cidade)}</h2><ul class="district-list">${bairros.map(b => `<li><a href="/bairros/${e(b.slug)}"><span class="district-name">${e(b.name)}</span><span class="district-count">${empresas(b.count)}</span></a></li>`).join('')}</ul></section>`).join('');
  return `<section class="section-intro"><p class="eyebrow">BAIRROS · GUIA Nexus</p><h1>Empresas por bairro</h1><p>Escolha um bairro para ver as empresas do guia que ficam lá.</p></section>
<div class="district-layout"><div class="district-index">${lista || '<p class="muted">Ainda não há bairros com empresas no guia.</p>'}</div>${vm.map ? `<div class="district-map">${mapView(vm.map, { eyebrow: 'BAIRROS NO MAPA', from: 'search' })}</div>` : ''}</div>`;
}

// vm Bairro {slug, name, city, total, pages, current, results, map, outros}.
export function bairroView(vm) {
  const { slug, name, city, total, pages = 1, current = 1, results = [], outros = [] } = vm;
  const onde = city ? `${name}, ${city}` : name;
  const cards = results.map(b => businessCard(b)).join('');
  const paginas = pages > 1 ? `<nav class="pagination" aria-label="Páginas de empresas em ${e(name)}">${Array.from({ length: pages }, (_, i) => `<a ${i + 1 === current ? 'aria-current="page" ' : ''}href="/bairros/${e(slug)}${i ? `?page=${i + 1}` : ''}">${i + 1}</a>`).join('')}</nav>` : '';
  const vizinhos = outros.length ? `<section class="district-others" aria-labelledby="outros-bairros"><h2 id="outros-bairros">Outros bairros${city ? ` de ${e(city)}` : ''}</h2><ul class="district-chips">${outros.map(o => `<li><a href="/bairros/${e(o.slug)}">${e(o.name)} <span>${o.count}</span></a></li>`).join('')}</ul><p><a href="/bairros">Ver todos os bairros <span aria-hidden="true">→</span></a></p></section>` : '';
  return `<nav class="breadcrumbs" aria-label="Caminho"><a href="/">Início</a><span aria-hidden="true">/</span><a href="/bairros">Bairros</a><span aria-hidden="true">/</span><span>${e(name)}</span></nav>
<section class="section-intro"><p class="eyebrow">BAIRRO · ${e((city || 'GUIA Nexus').toUpperCase())}</p><h1>Empresas em ${e(name)}</h1><p>${empresas(total)} do guia em ${e(onde)}.</p></section>
<div class="district-layout is-bairro"><div><div class="business-grid district-results">${cards}</div>${paginas}</div>${vm.map ? `<div class="district-map">${mapView(vm.map, { eyebrow: `MAPA · ${name.toUpperCase()}`, from: 'search', titulo: `${vm.map.located} ${vm.map.located === 1 ? 'empresa' : 'empresas'} no mapa` })}</div>` : ''}</div>${vizinhos}`;
}
