-- Loyalty card: customers and visits are only reached through these functions.
create table public.customers (phone text primary key, stamps int not null default 0);
create table public.visits (phone text, at timestamptz default now());
alter table public.customers enable row level security;
alter table public.visits enable row level security;
create or replace function public.norm(p text) returns text language sql immutable as $$ select regexp_replace(p, '\D', '', 'g') $$;
create or replace function public.visit(phone text) returns int language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.visits (phone) values (public.norm(phone));
  update public.customers set stamps = stamps + 1 where customers.phone = public.norm(phone);
  return (select stamps from public.customers where customers.phone = public.norm(phone));
end $fn$;
create function public.touch() returns trigger language plpgsql as $$ begin new.at = now(); return new; end $$;
create trigger touch before update on public.visits for each row execute function public.touch();
