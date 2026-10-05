-- ÁPICE IMÓVEIS — cole tudo no Supabase > SQL Editor > Run
create table if not exists imoveis (
  id uuid primary key default gen_random_uuid(),
  categoria text, tipo text, titulo text, cidade text,
  preco numeric, area numeric, quartos int, suites int, vagas int,
  descricao text, fotos text[] default '{}', videos text[] default '{}',
  destaque boolean default false, status text default 'ativo',
  criado timestamptz default now()
);
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text, tel text, tipo text, cidade text, area text, msg text,
  origem text, imovel text, criado timestamptz default now()
);
create table if not exists admins ( email text primary key );

create or replace function is_admin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(auth.jwt()->>'email'));
$$;

alter table imoveis enable row level security;
alter table leads enable row level security;
alter table admins enable row level security;

create policy "ver imoveis" on imoveis for select using (status <> 'oculto' or is_admin());
create policy "admin escreve imoveis" on imoveis for all using (is_admin()) with check (is_admin());
create policy "enviar lead" on leads for insert with check (true);
create policy "admin le leads" on leads for select using (is_admin());
create policy "admin apaga leads" on leads for delete using (is_admin());
create policy "admin ve admins" on admins for select using (lower(email) = lower(auth.jwt()->>'email'));

insert into storage.buckets (id, name, public) values ('midia','midia',true) on conflict do nothing;
create policy "midia publica" on storage.objects for select using (bucket_id = 'midia');
create policy "midia admin envia" on storage.objects for insert with check (bucket_id='midia' and is_admin());
create policy "midia admin apaga" on storage.objects for delete using (bucket_id='midia' and is_admin());

-- DEPOIS de criar o usuário em Authentication > Users, rode (troque pelo e-mail):
-- insert into admins(email) values ('SEU-EMAIL-AQUI');
