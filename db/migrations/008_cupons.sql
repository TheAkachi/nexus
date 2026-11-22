-- v0.14.0: cupons das empresas e contas de usuário (contrato, seção 14).

-- Conta de usuário (kind 'consumidor'): data em que aceitou os termos e a privacidade.
ALTER TABLE users ADD COLUMN terms_accepted_at timestamptz;

-- Cupom da empresa: código mostrado a quem coletou, validade obrigatória e quantidade opcional.
-- status guardado: ativo, pausado (pela empresa), suspenso (pela equipe) ou removido; agendado, esgotado e vencido são calculados.
CREATE TABLE coupons (
 id text PRIMARY KEY,
 business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 title text NOT NULL,
 conditions text NOT NULL,
 code text NOT NULL,
 starts_on date,
 ends_on date NOT NULL,
 quantity integer CHECK (quantity IS NULL OR quantity BETWEEN 1 AND 100000),
 claimed integer NOT NULL DEFAULT 0 CHECK (claimed >= 0),
 status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','suspenso','removido')),
 suspension jsonb,
 created_by text REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 CHECK (quantity IS NULL OR claimed <= quantity),
 CHECK (starts_on IS NULL OR starts_on <= ends_on)
);
CREATE INDEX coupons_business ON coupons(business_id, status);
CREATE INDEX coupons_public ON coupons(status, ends_on);

-- Coleta: uma por conta e cupom. Sai junto com a conta excluída.
CREATE TABLE coupon_claims (
 coupon_id text NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (coupon_id, user_id)
);
CREATE INDEX coupon_claims_user ON coupon_claims(user_id, claimed_at);
CREATE INDEX coupon_claims_date ON coupon_claims(claimed_at);
