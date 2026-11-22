-- v0.19.0: a Fase 2 da gestão comercial (contrato 19.6). A "Minha assinatura" mandada pela gestão fica na empresa, e as
-- somas diárias (sem dado pessoal) alimentam a rota de métricas: visitas e contatos por empresa, buscas, e os termos, os
-- bairros e as categorias buscados. Os eventos já guardados (até 90 dias) entram nas somas aqui mesmo.
ALTER TABLE businesses ADD COLUMN gestao_assinatura jsonb;
ALTER TABLE businesses ADD COLUMN gestao_assinatura_em timestamptz;

ALTER TABLE business_daily ADD COLUMN views integer NOT NULL DEFAULT 0 CHECK (views >= 0);
ALTER TABLE business_daily ADD COLUMN contact_whatsapp integer NOT NULL DEFAULT 0 CHECK (contact_whatsapp >= 0);
ALTER TABLE business_daily ADD COLUMN contact_phone integer NOT NULL DEFAULT 0 CHECK (contact_phone >= 0);
ALTER TABLE business_daily ADD COLUMN contact_map integer NOT NULL DEFAULT 0 CHECK (contact_map >= 0);
ALTER TABLE business_daily ADD COLUMN contact_website integer NOT NULL DEFAULT 0 CHECK (contact_website >= 0);

CREATE TABLE site_daily (
 day date PRIMARY KEY,
 searches integer NOT NULL DEFAULT 0 CHECK (searches >= 0),
 searches_empty integer NOT NULL DEFAULT 0 CHECK (searches_empty >= 0)
);
CREATE TABLE search_daily (
 day date NOT NULL,
 kind text NOT NULL CHECK (kind IN ('termo','bairro','categoria')),
 value text NOT NULL CHECK (length(value) BETWEEN 1 AND 100),
 count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
 PRIMARY KEY (day, kind, value)
);
CREATE TABLE metric_starts (
 serie text PRIMARY KEY CHECK (serie IN ('contatos','buscas')),
 since date NOT NULL
);

-- Os eventos com consentimento que já estão guardados, somados por empresa e dia de São Paulo (o waze conta como rota).
INSERT INTO business_daily(day,business_id,views,contact_whatsapp,contact_phone,contact_map,contact_website)
SELECT (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,business_id,
 count(*) FILTER (WHERE name='business_viewed'),
 count(*) FILTER (WHERE name='contact_clicked' AND channel='whatsapp'),
 count(*) FILTER (WHERE name='contact_clicked' AND channel='phone'),
 count(*) FILTER (WHERE name='contact_clicked' AND channel IN ('map','waze')),
 count(*) FILTER (WHERE name='contact_clicked' AND channel='website')
FROM public_events e WHERE business_id IS NOT NULL AND name IN ('business_viewed','contact_clicked') AND EXISTS (SELECT 1 FROM businesses b WHERE b.id=e.business_id)
GROUP BY 1,2
ON CONFLICT (day,business_id) DO UPDATE SET views=EXCLUDED.views,contact_whatsapp=EXCLUDED.contact_whatsapp,contact_phone=EXCLUDED.contact_phone,
 contact_map=EXCLUDED.contact_map,contact_website=EXCLUDED.contact_website;

INSERT INTO metric_starts(serie,since) VALUES
 ('contatos',COALESCE((SELECT min((occurred_at AT TIME ZONE 'America/Sao_Paulo')::date) FROM public_events WHERE name IN ('business_viewed','contact_clicked')),(now() AT TIME ZONE 'America/Sao_Paulo')::date)),
 ('buscas',(now() AT TIME ZONE 'America/Sao_Paulo')::date);
