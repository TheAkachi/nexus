-- v0.20.0: o relatório do mês no painel do anunciante (contrato 20). Desde quando as aparições na busca e os banners são
-- medidos: o dia de São Paulo em que rodou a migração que começou a somar cada um (006 e 005); num banco novo, o dia
-- desta migração. Com isso, o mês antes da medição vem em branco no relatório, e não com zero.
ALTER TABLE metric_starts DROP CONSTRAINT metric_starts_serie_check;
ALTER TABLE metric_starts ADD CONSTRAINT metric_starts_serie_check CHECK (serie IN ('contatos','buscas','aparicoes','banners'));
INSERT INTO metric_starts(serie,since)
SELECT s.serie,COALESCE((SELECT (m.applied_at AT TIME ZONE 'America/Sao_Paulo')::date FROM schema_migrations m WHERE m.name=s.arquivo),(now() AT TIME ZONE 'America/Sao_Paulo')::date)
FROM (VALUES ('aparicoes','006_contas.sql'),('banners','005_anuncios.sql')) AS s(serie,arquivo)
ON CONFLICT (serie) DO NOTHING;
