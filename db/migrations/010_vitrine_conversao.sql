-- v0.17.0 (contrato, seção 18): avaliações de moradores, pessoas do Sobre nós e o campo ref da medição.

-- Medição (18.8): o atalho de categoria e o filtro usados ficam em ref (até 60 caracteres, [-a-z0-9]).
ALTER TABLE public_events ADD COLUMN ref text CHECK (ref IS NULL OR ref ~ '^[-a-z0-9]{1,60}$');

-- Avaliação de morador (18.4): uma por conta e empresa; entra pendente e passa pela fila da equipe.
-- Sai junto com a conta excluída e com a empresa.
CREATE TABLE resident_reviews (
 id text PRIMARY KEY,
 business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 body text NOT NULL CHECK (length(body) BETWEEN 10 AND 600),
 status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','publicada','recusada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 UNIQUE (business_id, user_id)
);
CREATE INDEX resident_reviews_business ON resident_reviews(business_id, status, created_at);

-- Pessoas da PRIMIG na página Sobre nós (18.7). A foto é uma imagem da biblioteca de mídia.
CREATE TABLE about_people (
 id text PRIMARY KEY,
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
 role text NOT NULL DEFAULT '' CHECK (length(role) <= 80),
 media_id text REFERENCES media(id) ON DELETE SET NULL,
 position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 999),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1
);
