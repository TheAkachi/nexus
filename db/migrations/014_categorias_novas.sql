-- v0.22.0: categorias novas (contrato 22). A base da lista única continua no código (api/data/categorias.mjs); aqui ficam
-- as categorias criadas pela equipe, cada uma com um dos 10 grupos da home. A fila ganha o tipo categoria: a sugestão do
-- anunciante ("Outra"), que a equipe aprova criando, troca por uma da lista ou recusa.
CREATE TABLE categories (
 nome text PRIMARY KEY CHECK (length(nome) BETWEEN 2 AND 60),
 slug text NOT NULL UNIQUE,
 grupo text NOT NULL CHECK (grupo IN ('alimentacao','saude-e-bem-estar','casa-e-construcao','automotivo','eventos','moda-e-beleza','pets',
   'tecnologia-e-comunicacao','imobiliaria','outros-servicos')),
 criada_em timestamptz NOT NULL DEFAULT now(),
 criada_por text REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE approvals DROP CONSTRAINT approvals_kind_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_kind_check CHECK (kind IN ('descricao','foto','catalogo','oferta','banner','avaliacao','categoria'));
