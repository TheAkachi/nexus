import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeHtml} from '../../api/lib/html-seguro.mjs';

// Saneamento por lista branca do corpo das notícias e artigos (Conteudo.bodyHtml).
const clean=(html,opts)=>sanitizeHtml(html,opts);

test('tira script, estilo, atributos e eventos; mantém só as marcas da lista',()=>{
 assert.equal(clean('<p onclick="x()" style="color:red" class="a" id="b">Oi <b>forte</b> &amp; <i>it</i></p><script>alert(1)</script><style>p{}</style>'),'<p>Oi <strong>forte</strong> &amp; <em>it</em></p>');
 assert.equal(clean('<h1>T</h1><h5>s</h5><span>sem marca</span><div><p>dentro</p></div><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>'),'<h2>T</h2><h4>s</h4>sem marca<p>dentro</p><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>');
 assert.equal(clean('<blockquote>Citação</blockquote><ul><li>um</li></ul><ol><li>dois</li></ol><figure><img src="https://www.primigdivulgacao.com.br/a.png"><figcaption>Legenda</figcaption></figure><hr><br>'),'<blockquote>Citação</blockquote><ul><li>um</li></ul><ol><li>dois</li></ol><figure><img src="https://www.primigdivulgacao.com.br/a.png" alt="" loading="lazy"><figcaption>Legenda</figcaption></figure><br>');
 for(const attack of ['<img src=x onerror=alert(1)>','<svg><script>alert(1)</script></svg>','<a href="javascript:alert(1)">x</a>','<iframe src="https://x"></iframe>','<scr<script>ipt>alert(1)</script>','<p style="background:url(javascript:alert(1))">t</p>','<!-- <script>alert(1)</script> -->','<a href="data:text/html,<script>alert(1)</script>">d</a>']) {
  const out=clean(attack);assert.doesNotMatch(out,/<script|<svg|<iframe|onerror|javascript:|data:|style=/i,attack);
 }
 assert.equal(clean('<p>a < b e c > d &copy; & e</p>'),'<p>a &lt; b e c &gt; d &copy; &amp; e</p>');
 assert.equal(clean('<p>&nbsp;</p><p><br></p><p>texto'),'<p>texto</p>','parágrafo vazio sai e o aberto é fechado');
});

test('links: https ou caminho do site, http vira https, sem rastreio, e os do portal antigo apontam para as páginas novas',()=>{
 const rewriteLink=href=>href.includes('boreal-tintas.html')?'/comercio/boreal-tintas':href;
 assert.equal(clean('<a href="https://www.primigdivulgacao.com.br/guia-comercial/boreal-tintas.html?utm_source=x">Boreal</a>',{rewriteLink}),'<a href="/comercio/boreal-tintas">Boreal</a>');
 assert.equal(clean('<a href="http://www.light.com.br/x?utm_source=a&amp;id=2" target="_blank">Light</a>'),'<a href="https://www.light.com.br/x?id=2" rel="noopener noreferrer">Light</a>');
 assert.equal(clean('<a href="/busca">interno</a>'),'<a href="/busca">interno</a>');
 assert.equal(clean('<a href="mailto:x@y.z">e-mail</a> fim'),'e-mail fim','link que não é https nem do site some e o texto fica');
});

test('imagem só do portal; a de outro site vira link para ela, com a legenda',()=>{
 assert.equal(clean('<img src="https://www.primigdivulgacao.com.br/a.png" alt="Foto &quot;1&quot;">'),'<img src="https://www.primigdivulgacao.com.br/a.png" alt="Foto &quot;1&quot;" loading="lazy">');
 assert.equal(clean('<img src="https://s2.glbimg.com/foto.jpg" alt="Senhor no sol">'),'<a href="https://s2.glbimg.com/foto.jpg" rel="noopener noreferrer">Imagem: Senhor no sol</a>');
 assert.equal(clean('<a href="http://site.gov.br/f.jpg"><img src="http://site.gov.br/f.jpg" alt=""></a>'),'<a href="https://site.gov.br/f.jpg" rel="noopener noreferrer">Imagem: ver na fonte</a>','sem link dentro de link');
});
