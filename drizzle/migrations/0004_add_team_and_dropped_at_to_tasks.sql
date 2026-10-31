alter table public.tasks add column if not exists team text not null default '';

alter table public.tasks add column if not exists dropped_at timestamptz;