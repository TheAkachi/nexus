ALTER TABLE businesses ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','review','published','paused'));
ALTER TABLE businesses ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN enriched boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN staff_role text CHECK(staff_role IN ('admin','editor','operator'));
ALTER TABLE content ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','review','published','paused'));
ALTER TABLE content ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE content ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE content ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE campaigns ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN destination text NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN image_url text NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN starts_at timestamptz;
ALTER TABLE campaigns ADD COLUMN ends_at timestamptz;
ALTER TABLE campaigns ADD COLUMN business_id text REFERENCES businesses(id);
ALTER TABLE campaigns ADD COLUMN placement text NOT NULL DEFAULT 'home';
CREATE TABLE plans (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused')),
 price_cents integer CHECK(price_cents>=0), version integer NOT NULL DEFAULT 1
);
ALTER TABLE businesses ADD COLUMN plan_id text REFERENCES plans(id);
CREATE TABLE public_events (
 event_id text PRIMARY KEY, name text NOT NULL, business_id text REFERENCES businesses(id),
 campaign_id text REFERENCES campaigns(id), session_id text NOT NULL,
 channel text, source text, result_count integer, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_events_business_date ON public_events(business_id,occurred_at);
CREATE INDEX public_events_date ON public_events(occurred_at);
