create table public.dishes (id text primary key, name text, position int);
create table public.secrets (id int);
alter table public.secrets enable row level security;
create or replace function public.is_editor() returns boolean language sql security definer set search_path = '' as $$ select true $$;
do $$ declare t text; begin
  foreach t in array array['dishes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "editors write" on public.%I for update to authenticated using ((select public.is_editor()))', t);
  end loop;
end $$;
select cron.schedule('nightly-reset', '0 3 * * *', $$ select public.is_editor() $$);
insert into storage.buckets (id, name, public) values ('photos', 'photos', true);
