CREATE TABLE users (
 id text PRIMARY KEY,
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 disabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE businesses (
 id text PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 name text NOT NULL,
 district text NOT NULL DEFAULT '',
 summary text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '',
 website text NOT NULL DEFAULT '',
 source_url text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 user_id text REFERENCES users(id) ON DELETE CASCADE,
 business_id text REFERENCES businesses(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (user_id,business_id)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE password_resets (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used boolean NOT NULL DEFAULT false
);
CREATE TABLE catalog_items (
 id text PRIMARY KEY,
 business_id text NOT NULL REFERENCES businesses(id),
 kind text NOT NULL CHECK (kind IN ('product','service','offer')),
 name text NOT NULL,
 description text NOT NULL DEFAULT '',
 price_cents integer CHECK (price_cents >= 0),
 price_mode text NOT NULL CHECK (price_mode IN ('fixed','from','inquiry')),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','paused')),
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (price_mode = 'inquiry' OR price_cents IS NOT NULL)
);
CREATE INDEX catalog_business_idx ON catalog_items(business_id);
CREATE TABLE content (
 id text PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('news','article','classified')),
 slug text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 source_url text NOT NULL,
 UNIQUE(kind,slug)
);
CREATE TABLE campaigns (
 id text PRIMARY KEY,
 title text NOT NULL DEFAULT '',
 source jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending-review'
);
CREATE TABLE redirects (
 old_path text PRIMARY KEY,
 new_path text NOT NULL,
 CHECK (old_path <> new_path)
);
CREATE TABLE measurement_events (
 event_id text PRIMARY KEY,
 business_id text NOT NULL REFERENCES businesses(id),
 name text NOT NULL,
 payload jsonb NOT NULL,
 occurred_at timestamptz NOT NULL
);
CREATE INDEX measurement_business_idx ON measurement_events(business_id,occurred_at);
CREATE TABLE audit_log (
 id text PRIMARY KEY,
 actor_id text,
 business_id text,
 action text NOT NULL,
 resource_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (
 key_hash text PRIMARY KEY,
 count integer NOT NULL,
 reset_at timestamptz NOT NULL
);
