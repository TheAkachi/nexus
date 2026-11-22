-- Parte A: espaços de anúncio. O placement do banner passa a ser o id do espaço (api/data/espacos.mjs).
ALTER TABLE campaigns ADD COLUMN format text NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN image_mobile_url text NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100);
UPDATE campaigns SET placement = CASE placement WHEN 'home' THEN 'home-topo' WHEN 'home-meio' THEN 'home-destaques' WHEN 'search' THEN 'busca-topo' WHEN 'content' THEN 'lista-topo' ELSE placement END;
ALTER TABLE campaigns ALTER COLUMN placement SET DEFAULT 'home-topo';

-- Página própria no portal antigo: até a lista real de planos (D2), é o que define a empresa pagante.
ALTER TABLE businesses ADD COLUMN own_page boolean NOT NULL DEFAULT false;

-- Medição por espaço: o evento guarda o espaço, e a soma diária fica depois dos 90 dias dos eventos.
ALTER TABLE public_events ADD COLUMN slot text;
CREATE TABLE ad_daily (
 day date NOT NULL,
 campaign_id text NOT NULL REFERENCES campaigns(id),
 slot text NOT NULL DEFAULT '',
 impressions integer NOT NULL DEFAULT 0 CHECK (impressions >= 0),
 clicks integer NOT NULL DEFAULT 0 CHECK (clicks >= 0),
 PRIMARY KEY (day, campaign_id, slot)
);
CREATE INDEX ad_daily_slot ON ad_daily(slot, day);
