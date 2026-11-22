-- v0.18.0: integração com a gestão comercial (contrato 19). plan_managed marca a empresa cujo plano é definido pela gestão
-- (o admin e o db:seed deixam de mudar o plano dela); integration_nonces guarda os nonces das chamadas assinadas por 10
-- minutos, para recusar a repetição.
ALTER TABLE businesses ADD COLUMN plan_managed boolean NOT NULL DEFAULT false;
CREATE TABLE integration_nonces (
 nonce text PRIMARY KEY,
 seen_at timestamptz NOT NULL
);
CREATE INDEX integration_nonces_seen ON integration_nonces(seen_at);
