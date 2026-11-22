-- v0.23.0: os pedidos do cadastro para a gestão, os leads (contrato 23). Só com a chave LEADS_LIGADOS: o código curto, as
-- respostas de escolher, a origem (o ?interesse) e a hora. Nada de nome, telefone, e-mail, IP, sessão ou navegador.
-- Guarda proposta de 30 dias [SEG]: o pedido mais velho sai a cada cadastro novo e a cada leitura da rota.
CREATE TABLE signup_requests (
 codigo text PRIMARY KEY CHECK (codigo ~ '^[ACDEFHJKMNPRTUVWXY3479]{4,5}$'),
 respostas jsonb NOT NULL,
 origem text NOT NULL DEFAULT '' CHECK (origem ~ '^[a-z0-9-]{0,60}$'),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_requests_criado ON signup_requests(criado_em);
