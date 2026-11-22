-- Fase 2 (vitrine completa): redes com unidades, avaliações, horários estruturados, destaque, plano real (D2),
-- ofertas com validade e condições, eventos, coleções, HTML saneado das publicações e anunciante dos banners.
CREATE TABLE business_groups (
 id text PRIMARY KEY,
 name text NOT NULL
);
ALTER TABLE businesses ADD COLUMN group_id text REFERENCES business_groups(id);
ALTER TABLE businesses ADD COLUMN featured boolean NOT NULL DEFAULT false;
-- Plano real de cada empresa (D2): rank ordena a busca; sponsored marca os resultados como patrocinados.
ALTER TABLE plans ADD COLUMN rank integer NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN sponsored boolean NOT NULL DEFAULT false;

CREATE TABLE reviews (
 id text PRIMARY KEY,
 business_id text NOT NULL REFERENCES businesses(id),
 author text NOT NULL,
 rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
 title text NOT NULL DEFAULT '',
 body text NOT NULL DEFAULT '',
 reviewed_on date,
 source text NOT NULL CHECK (source IN ('portal','guia')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','hidden')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_business_idx ON reviews(business_id,status);

-- weekday: 0 = domingo. closes menor ou igual a opens: o intervalo passa da meia-noite. 00:00 a 24:00: aberto o dia todo.
CREATE TABLE business_hours (
 business_id text NOT NULL REFERENCES businesses(id),
 weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
 opens text NOT NULL CHECK (opens ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 closes text NOT NULL CHECK (closes ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'),
 PRIMARY KEY (business_id,weekday,opens)
);

ALTER TABLE catalog_items ADD COLUMN conditions text NOT NULL DEFAULT '';
ALTER TABLE catalog_items ADD COLUMN valid_until date;
ALTER TABLE catalog_items ADD COLUMN image_url text NOT NULL DEFAULT '';

CREATE TABLE events (
 id text PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 starts_at timestamptz NOT NULL,
 ends_at timestamptz,
 place text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 image_url text NOT NULL DEFAULT '',
 url text NOT NULL DEFAULT '',
 business_id text REFERENCES businesses(id),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','paused')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_starts_idx ON events(status,starts_at);

-- Coleções por necessidade, montadas a partir dos grupos de categorias (lista de slugs em groups).
CREATE TABLE collections (
 id text PRIMARY KEY,
 title text NOT NULL,
 subtitle text NOT NULL DEFAULT '',
 groups jsonb NOT NULL DEFAULT '[]',
 position integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','paused'))
);

ALTER TABLE content ADD COLUMN body_html text NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN advertiser text NOT NULL DEFAULT '';
