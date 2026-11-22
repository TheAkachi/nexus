CREATE TABLE pilot_experiences (
 id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id),
 kind text NOT NULL CHECK(kind IN ('voucher','agenda','menu')),
 title text NOT NULL, description text NOT NULL, external_url text NOT NULL DEFAULT '',
 expires_at timestamptz, capacity integer NOT NULL DEFAULT 1 CHECK(capacity BETWEEN 1 AND 1000),
 issued integer NOT NULL DEFAULT 0 CHECK(issued>=0 AND issued<=capacity),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','paused')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pilot_vouchers (
 id text PRIMARY KEY, experience_id text NOT NULL REFERENCES pilot_experiences(id),
 code text NOT NULL UNIQUE, request_id text NOT NULL UNIQUE, issued_by text NOT NULL REFERENCES users(id),
 redeemed_by text REFERENCES users(id), redeemed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pilot_referrals (
 id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id),
 referred_business_id text NOT NULL UNIQUE REFERENCES businesses(id),
 status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','qualified','rejected')),
 evidence text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(business_id<>referred_business_id)
);
CREATE TABLE pilot_suggestion_reviews (
 business_id text NOT NULL REFERENCES businesses(id), rule_id text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('accepted','dismissed')), actor_id text NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(business_id,rule_id)
);
CREATE INDEX pilot_experiences_business ON pilot_experiences(business_id);
CREATE INDEX pilot_referrals_business ON pilot_referrals(business_id);
