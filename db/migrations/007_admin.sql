-- Fase 4: admin da equipe (contrato, seção 13).

-- Plano real: "pago" decide a regra de anúncio no perfil (11.3).
ALTER TABLE plans ADD COLUMN paid boolean NOT NULL DEFAULT true;

-- Registro editado no admin: o db:seed e a coleta diária deixam de sobrescrever (managed_at) ou de pausar (source).
ALTER TABLE content ADD COLUMN managed_at timestamptz;
ALTER TABLE content ADD COLUMN created_by text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN managed_at timestamptz;
ALTER TABLE events ADD COLUMN source text NOT NULL DEFAULT 'arquivo' CHECK (source IN ('arquivo','admin'));
ALTER TABLE events ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE collections ADD COLUMN source text NOT NULL DEFAULT 'arquivo' CHECK (source IN ('arquivo','admin'));
ALTER TABLE collections ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE media ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE requests ADD COLUMN version integer NOT NULL DEFAULT 1;

-- Assinantes (planilha do Privix e cadastro no admin) e receita.
CREATE TABLE subscriptions (
 id text PRIMARY KEY,
 business_id text REFERENCES businesses(id) ON DELETE SET NULL,
 name text NOT NULL,
 plan_id text REFERENCES plans(id),
 value_cents integer NOT NULL CHECK (value_cents >= 0),
 period text NOT NULL DEFAULT 'mensal' CHECK (period IN ('mensal','trimestral','semestral','anual')),
 started_on date NOT NULL,
 due_on date,
 status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inadimplente','cancelado')),
 canceled_on date,
 notes text NOT NULL DEFAULT '',
 source text NOT NULL DEFAULT 'admin' CHECK (source IN ('privix','admin')),
 source_key text UNIQUE,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status<>'cancelado' OR canceled_on IS NOT NULL)
);
CREATE INDEX subscriptions_business ON subscriptions(business_id, status);

-- Buscas sem resultado, contadas no servidor por dia e termo normalizado (sem IP e sem sessão), guardadas por 90 dias.
CREATE TABLE search_misses (
 day date NOT NULL,
 term text NOT NULL CHECK (length(term) <= 60),
 count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
 PRIMARY KEY (day, term)
);
