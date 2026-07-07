-- Schéma ClickOne : persistance Supabase (remplace le stockage en mémoire).
-- Idempotent (IF NOT EXISTS) : peut être exécuté plusieurs fois sans risque.

create table if not exists orders (
  id serial primary key,
  "table" text not null,
  items jsonb not null,
  subtotal numeric not null default 0,
  tip numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists table_statuses (
  "table" text primary key,
  status text not null
);

create table if not exists help_calls (
  "table" text primary key,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id serial primary key,
  "table" text not null,
  rating int not null,
  comment text default '',
  created_at timestamptz not null default now()
);

create index if not exists orders_table_idx on orders ("table");
create index if not exists orders_status_idx on orders (status);
