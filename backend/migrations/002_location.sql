create table if not exists location_history (
  id bigserial primary key,
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  created_at timestamptz default now()
);
create index if not exists idx_loc_created on location_history (created_at desc);
