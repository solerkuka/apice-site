-- ÁPICE IMÓVEIS — CAPTAÇÃO DE FOTOS E VÍDEOS
-- Rode DEPOIS do schema.sql: Supabase > SQL Editor > cole tudo > Run

-- 1) Corretores (podem cadastrar imóveis e enviar fotos; só os proprietários publicam no site)
create table if not exists corretores ( email text primary key );
alter table corretores enable row level security;

create or replace function is_equipe() returns boolean
language sql security definer set search_path = public as $$
  select is_admin() or exists (select 1 from corretores where lower(email) = lower(auth.jwt()->>'email'));
$$;

drop policy if exists "corretor ve a si" on corretores;
drop policy if exists "admin gerencia corretores" on corretores;
create policy "corretor ve a si" on corretores for select using (lower(email) = lower(auth.jwt()->>'email') or is_admin());
create policy "admin gerencia corretores" on corretores for all using (is_admin()) with check (is_admin());

-- 2) Captações (o imóvel cadastrado pelo corretor, ainda fora do site)
create table if not exists captacoes (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  tipo text not null,
  titulo text, cidade text, bairro text, preco numeric, descricao text,
  lat double precision, lng double precision, mapa_url text,  -- localização (GPS do celular ou link do Google Maps)
  mostrar_mapa boolean not null default true,                 -- mostrar o botão "Ver no mapa" ao cliente e no site
  dados jsonb not null default '{}',      -- campos que o cliente pode ver
  privados jsonb not null default '{}',   -- endereço, proprietário, comissão (nunca aparecem no link)
  status text not null default 'captado', -- captado | publicado
  imovel_id uuid references imoveis(id) on delete set null,
  corretor text default (auth.jwt()->>'email'),
  criado timestamptz default now(),
  atualizado timestamptz default now()
);

-- 3) Fotos e vídeos de cada captação
create table if not exists midias (
  id uuid primary key default gen_random_uuid(),
  captacao_id uuid not null references captacoes(id) on delete cascade,
  tipo text not null check (tipo in ('foto','video')),
  estado text not null default 'original' check (estado in ('original','tratada')),
  original_id uuid references midias(id) on delete cascade,
  path text not null,
  nome text,
  publicar boolean not null default false,
  ordem int not null default 0,
  criado timestamptz default now()
);
create index if not exists midias_captacao on midias(captacao_id);

alter table captacoes enable row level security;
alter table midias enable row level security;

drop policy if exists "equipe ve captacoes" on captacoes;
drop policy if exists "equipe cria captacoes" on captacoes;
drop policy if exists "equipe edita captacoes" on captacoes;
drop policy if exists "admin apaga captacoes" on captacoes;
drop policy if exists "equipe midias" on midias;
create policy "equipe ve captacoes" on captacoes for select using (is_equipe());
create policy "equipe cria captacoes" on captacoes for insert with check (is_equipe());
create policy "equipe edita captacoes" on captacoes for update using (is_equipe()) with check (is_equipe());
create policy "admin apaga captacoes" on captacoes for delete using (is_admin());
create policy "equipe midias" on midias for all using (is_equipe()) with check (is_equipe());

-- 4) Pasta de arquivos: o link de cada arquivo é impossível de adivinhar e a lista da pasta é fechada
insert into storage.buckets (id, name, public) values ('captacao','captacao',true) on conflict do nothing;
drop policy if exists "captacao equipe envia" on storage.objects;
drop policy if exists "captacao equipe apaga" on storage.objects;
drop policy if exists "captacao equipe ve" on storage.objects;
create policy "captacao equipe envia" on storage.objects for insert with check (bucket_id = 'captacao' and is_equipe());
create policy "captacao equipe apaga" on storage.objects for delete using (bucket_id = 'captacao' and is_equipe());
create policy "captacao equipe ve" on storage.objects for select using (bucket_id = 'captacao' and is_equipe());

-- 5) Link do cliente: devolve só os dados seguros (sem endereço, proprietário ou comissão)
create or replace function captacao_publica(p_token text) returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'tipo', c.tipo, 'titulo', c.titulo, 'cidade', c.cidade, 'bairro', c.bairro,
    'preco', c.preco, 'descricao', c.descricao, 'dados', c.dados,
    'mapa', case when c.mostrar_mapa then coalesce(nullif(c.mapa_url, ''),
              case when c.lat is not null and c.lng is not null
                   then 'https://www.google.com/maps?q=' || c.lat || ',' || c.lng end) end,
    'midias', (
      select coalesce(json_agg(json_build_object('tipo', m.tipo, 'path', m.path) order by m.ordem, m.criado), '[]'::json)
      from midias m
      where m.captacao_id = c.id
        and (m.estado = 'tratada' or not exists (select 1 from midias t where t.original_id = m.id))
    )
  ) from captacoes c where c.token = p_token;
$$;
grant execute on function captacao_publica(text) to anon, authenticated;

-- 6) Detalhes extras de cada tipo de imóvel também aparecem na página do imóvel no site
alter table imoveis add column if not exists detalhes jsonb default '{}'::jsonb;

-- Para cadastrar um corretor: crie o usuário em Authentication > Users (Auto confirm) e rode:
-- insert into corretores(email) values ('email-do-corretor');
