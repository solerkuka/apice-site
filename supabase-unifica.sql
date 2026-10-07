-- ÁPICE IMÓVEIS — CADASTRO ÚNICO DE IMÓVEIS (site + mídias + link privado do cliente)
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode UMA vez, DEPOIS do supabase-tudo.sql e do supabase-atualiza-20.sql.
-- Se rodar de novo por engano, não estraga nada (não duplica e não apaga).
-- O que faz: junta "Imóveis" e "Captação" num cadastro só. Cada imóvel passa a ter ficha privada, link do cliente
-- e kit de fotos/vídeos; as fotos atuais do catálogo viram mídias "No site"; captações antigas viram imóveis Ocultos.
-- Depois deste script NÃO rode de novo o supabase-atualiza-20.sql (ele refaria as fotos do catálogo).

begin;

-- ===== PARTE A: tabelas, gatilhos, permissões e link do cliente =====
-- ---------------------------------------------------------------------------------------------
-- COMO FUNCIONA (cadastro único de imóveis)
--  * imoveis    = a "vitrine" pública. Continua igual para o site (SAMPLE, home, categorias e página do
--                 imóvel não mudam). NUNCA recebe dado sensível: ela é legível por qualquer visitante.
--                 imoveis.fotos / imoveis.videos = SOMENTE as mídias marcadas "No site". Quem mantém essas
--                 duas colunas é um gatilho (midias_sync): o corretor marca/desmarca e o site acompanha,
--                 sem ninguém copiar nada à mão. status: ativo (no site) | oculto | vendido.
--  * captacoes  = a FICHA PRIVADA 1:1 do imóvel (imovel_id único). Guarda o que o público não pode ler:
--                 proprietário, comissão, endereço, observações (privados), GPS exato (lat/lng), token do
--                 link do cliente. Só a equipe (admins + corretores) lê/escreve (RLS). O nome "captacoes"
--                 foi mantido para os links antigos (#/i/<token>) continuarem valendo.
--                 As colunas titulo/cidade/preco/descricao/status dessa tabela são LEGADO (não são mais
--                 usadas; a fonte da verdade é imoveis). Foram mantidas só para não perder dados antigos.
--  * midias     = o KIT de mídia de cada imóvel (40+ fotos/vídeos). Cada mídia tem duas chaves:
--                 no_site (aparece no site público) e no_link (aparece no link privado do cliente).
--                 url = endereço final usado no site (arquivo do Storage ou imagem do próprio site).
--  * O link do cliente é a função captacao_publica(token): devolve só dados seguros e só as mídias no_link,
--    mesmo com o imóvel Oculto. O visitante (anon) não lê nenhuma dessas tabelas direto.
-- ---------------------------------------------------------------------------------------------

alter table imoveis add column if not exists detalhes jsonb default '{}'::jsonb;

-- Equipe: corretores (além dos proprietários em "admins")
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

-- Ficha privada 1:1 do imóvel
create table if not exists captacoes (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  imovel_id uuid,
  tipo text not null default 'Casa',
  titulo text, cidade text, preco numeric, descricao text,       -- LEGADO (fonte da verdade: imoveis)
  bairro text,
  lat double precision, lng double precision, mapa_url text,    -- localização exata (GPS ou link do Google Maps): privada
  mostrar_mapa boolean not null default true,                   -- botão "Ver localização" no link do cliente
  dados jsonb not null default '{}',                            -- campos do imóvel que o cliente pode ver
  privados jsonb not null default '{}',                         -- proprietário, comissão, endereço, observações: só a equipe
  status text not null default 'captado',                       -- LEGADO
  corretor text default (auth.jwt()->>'email'),
  criado timestamptz default now(),
  atualizado timestamptz default now()
);
-- mapa_site: mostrar o botão de mapa também no site público (conversão única: quem já tinha mapa no site continua com ele)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'captacoes' and column_name = 'mapa_site') then
    alter table captacoes add column mapa_site boolean not null default false;
    update captacoes c set mapa_site = true from imoveis i where i.id = c.imovel_id and i.detalhes ? '_mapa';
  end if;
end $$;

-- 1 ficha por imóvel (se houver duas fichas antigas para o mesmo imóvel, a mais nova vira "sem imóvel" e a Parte B cria o imóvel dela)
update captacoes c set imovel_id = null
 where imovel_id is not null
   and exists (select 1 from captacoes o where o.imovel_id = c.imovel_id and o.id <> c.id
               and (coalesce(o.criado, 'epoch'), o.id) < (coalesce(c.criado, 'epoch'), c.id));
create unique index if not exists captacoes_imovel_unico on captacoes(imovel_id);
alter table captacoes drop constraint if exists captacoes_imovel_id_fkey;
alter table captacoes add constraint captacoes_imovel_id_fkey foreign key (imovel_id) references imoveis(id) on delete cascade;

-- Kit de mídia
create table if not exists midias (
  id uuid primary key default gen_random_uuid(),
  captacao_id uuid not null references captacoes(id) on delete cascade,
  tipo text not null check (tipo in ('foto','video')),
  estado text not null default 'original' check (estado in ('original','tratada')),
  original_id uuid references midias(id) on delete cascade,
  path text,                                  -- caminho no bucket 'captacao' (vazio = imagem que já vive no site)
  nome text,
  no_site boolean not null default false,     -- aparece no site público
  no_link boolean not null default true,      -- aparece no link privado do cliente
  url text,                                   -- endereço final (usado para montar imoveis.fotos / imoveis.videos)
  ordem int not null default 0,
  criado timestamptz default now()
);
alter table midias alter column path drop not null;

-- Conversão ÚNICA dos dados antigos (só roda se a tabela ainda é a antiga, sem as colunas no_site/no_link/url)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'midias' and column_name = 'no_site') then
    alter table midias add column no_site boolean not null default false, add column no_link boolean not null default true, add column url text;
    update midias m set
      no_link = (m.estado = 'tratada' or not exists (select 1 from midias t where t.original_id = m.id)),
      url = (select u from imoveis i, unnest(coalesce(i.fotos, '{}'::text[]) || coalesce(i.videos, '{}'::text[])) as u
              where i.id = c.imovel_id and m.path is not null and right(u, length(m.path) + 1) = '/' || m.path limit 1),
      no_site = case when c.status = 'publicado' and c.imovel_id is not null
                     then exists (select 1 from imoveis i, unnest(coalesce(i.fotos, '{}'::text[]) || coalesce(i.videos, '{}'::text[])) as u
                                   where i.id = c.imovel_id and m.path is not null and right(u, length(m.path) + 1) = '/' || m.path)
                     else m.publicar end
                  and (m.estado = 'tratada' or not exists (select 1 from midias t where t.original_id = m.id))
    from captacoes c where c.id = m.captacao_id;
  end if;
end $$;
create index if not exists midias_captacao on midias(captacao_id);

-- Funções internas (ninguém de fora executa)
create or replace function criar_ficha(p imoveis) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into captacoes (imovel_id, tipo, dados, mapa_url, mapa_site, corretor)
  values (p.id, coalesce(nullif(p.tipo, ''), 'Casa'),
          jsonb_strip_nulls(jsonb_build_object('area', nullif(p.area, 0), 'quartos', p.quartos, 'suites', p.suites, 'vagas', p.vagas)),
          nullif(p.detalhes->>'_mapa', ''), coalesce(p.detalhes ? '_mapa', false), auth.jwt()->>'email')
  on conflict (imovel_id) do nothing;
end $$;

create or replace function ficha_do_imovel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.sem_ficha', true), '') <> '1' then perform criar_ficha(new); end if;
  return new;
end $$;

-- Mantém imoveis.fotos / imoveis.videos = mídias "No site", na ordem do kit
create or replace function sync_imovel_midias(p_cap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select imovel_id into v from captacoes where id = p_cap;
  if v is null then return; end if;
  update imoveis set
    fotos  = coalesce((select array_agg(m.url order by m.ordem, m.criado, m.id) from midias m
                        where m.captacao_id = p_cap and m.no_site and m.tipo = 'foto' and m.url is not null), '{}'::text[]),
    videos = coalesce((select array_agg(m.url order by m.ordem, m.criado, m.id) from midias m
                        where m.captacao_id = p_cap and m.no_site and m.tipo = 'video' and m.url is not null), '{}'::text[])
  where id = v;
end $$;

create or replace function midias_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform sync_imovel_midias(old.captacao_id); return old; end if;
  perform sync_imovel_midias(new.captacao_id);
  if tg_op = 'UPDATE' and old.captacao_id <> new.captacao_id then perform sync_imovel_midias(old.captacao_id); end if;
  return new;
end $$;

revoke all on function criar_ficha(imoveis), ficha_do_imovel(), sync_imovel_midias(uuid), midias_sync() from public, anon, authenticated;

drop trigger if exists imoveis_ficha on imoveis;
create trigger imoveis_ficha after insert on imoveis for each row execute function ficha_do_imovel();
drop trigger if exists midias_sync on midias;
create trigger midias_sync after insert or update of no_site, url, ordem, tipo, captacao_id or delete on midias for each row execute function midias_sync();

-- Quem pode o quê
--   imoveis: todos veem o que não está Oculto; equipe (admins + corretores) vê tudo, cria e edita; só admin exclui.
alter table imoveis enable row level security;
alter table captacoes enable row level security;
alter table midias enable row level security;
drop policy if exists "ver imoveis" on imoveis;
drop policy if exists "admin escreve imoveis" on imoveis;
drop policy if exists "equipe cria imoveis" on imoveis;
drop policy if exists "equipe edita imoveis" on imoveis;
drop policy if exists "admin apaga imoveis" on imoveis;
create policy "ver imoveis" on imoveis for select using (status <> 'oculto' or is_equipe());
create policy "equipe cria imoveis" on imoveis for insert with check (is_equipe());
create policy "equipe edita imoveis" on imoveis for update using (is_equipe()) with check (is_equipe());
create policy "admin apaga imoveis" on imoveis for delete using (is_admin());

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

-- Pasta de arquivos 'captacao': o endereço de cada arquivo é impossível de adivinhar e a lista da pasta é fechada
insert into storage.buckets (id, name, public) values ('captacao','captacao',true) on conflict do nothing;
drop policy if exists "captacao equipe envia" on storage.objects;
drop policy if exists "captacao equipe apaga" on storage.objects;
drop policy if exists "captacao equipe ve" on storage.objects;
create policy "captacao equipe envia" on storage.objects for insert with check (bucket_id = 'captacao' and is_equipe());
create policy "captacao equipe apaga" on storage.objects for delete using (bucket_id = 'captacao' and is_equipe());
create policy "captacao equipe ve" on storage.objects for select using (bucket_id = 'captacao' and is_equipe());

-- Link do cliente: só dados seguros (nunca privados, comissão, proprietário, endereço, observações) e só mídias "No link"
create or replace function captacao_publica(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'tipo', i.tipo, 'titulo', i.titulo, 'cidade', i.cidade, 'bairro', c.bairro,
    'preco', i.preco, 'descricao', i.descricao, 'vendido', (i.status = 'vendido'),
    'dados', c.dados - array['endereco','proprietario','tel_proprietario','comissao','obs'],
    'mapa', case when c.mostrar_mapa then coalesce(nullif(c.mapa_url, ''),
              case when c.lat is not null and c.lng is not null
                   then 'https://www.google.com/maps?q=' || c.lat || ',' || c.lng end) end,
    'midias', (
      select coalesce(json_agg(json_build_object('tipo', m.tipo, 'path', m.path, 'url', m.url) order by m.ordem, m.criado, m.id), '[]'::json)
      from midias m where m.captacao_id = c.id and m.no_link
    )
  ) from captacoes c join imoveis i on i.id = c.imovel_id where c.token = p_token;
$$;
grant execute on function captacao_publica(text) to anon, authenticated;

-- Para cadastrar um corretor: crie o usuário em Authentication > Users (Auto confirm) e rode:
-- insert into corretores(email) values ('email-do-corretor');

-- ===== PARTE B: migra o que já existe (captações antigas e fotos do catálogo) =====
-- 1) Captações antigas que nunca foram publicadas (sem imóvel) ganham um imóvel Oculto na lista única
do $$ declare r record; v uuid; cat text;
begin
  perform set_config('app.sem_ficha', '1', true);
  for r in select * from captacoes where imovel_id is null order by criado loop
    cat := case when r.tipo in ('Casa','Apartamento','Cobertura') then 'morar'
                when r.tipo in ('Terreno','Lote em condomínio') then 'construir' else 'investir' end;
    insert into imoveis (categoria, tipo, titulo, cidade, preco, area, quartos, suites, vagas, descricao, fotos, videos, destaque, status, detalhes, criado)
    values (cat, r.tipo, coalesce(nullif(r.titulo, ''), r.tipo || ' em ' || coalesce(nullif(r.bairro, ''), nullif(r.cidade, ''), '—')),
            coalesce(r.cidade, ''), r.preco,
            nullif(r.dados->>'area', '')::numeric, round(nullif(r.dados->>'quartos', '')::numeric)::int,
            round(nullif(r.dados->>'suites', '')::numeric)::int, round(nullif(r.dados->>'vagas', '')::numeric)::int,
            coalesce(r.descricao, ''), '{}', '{}', false, 'oculto', '{}'::jsonb, coalesce(r.criado, now()))
    returning id into v;
    update captacoes set imovel_id = v where id = r.id;
  end loop;
  perform set_config('app.sem_ficha', '0', true);
end $$;

-- 2) Todo imóvel do catálogo ganha a sua ficha privada (com link/token próprio)
do $$ begin
  perform criar_ficha(i) from imoveis i where not exists (select 1 from captacoes c where c.imovel_id = i.id);
end $$;
alter table captacoes alter column imovel_id set not null;

-- 3) Kit de mídia dos imóveis do catálogo: cada foto/vídeo atual do imóvel vira mídia "No site" e "No link"
--    (não repete o que já existe; ignora endereços antigos do bucket 'captacao' cujo arquivo já foi apagado)
insert into midias (captacao_id, tipo, estado, path, url, nome, no_site, no_link, ordem)
select c.id, x.tipo, 'original', null, x.u, nullif(regexp_replace(x.u, '^.*/', ''), ''), true, true, x.n::int
from captacoes c
join imoveis i on i.id = c.imovel_id
cross join lateral (
  select 'foto'::text as tipo, t.u, t.n from unnest(coalesce(i.fotos, '{}'::text[])) with ordinality as t(u, n)
  union all
  select 'video'::text, t.u, t.n from unnest(coalesce(i.videos, '{}'::text[])) with ordinality as t(u, n)
) x
where x.u is not null and x.u <> ''
  and x.u not like '%/storage/v1/object/public/captacao/%'
  and not exists (select 1 from midias m where m.captacao_id = c.id and m.url = x.u);

-- 4) Confere: imoveis.fotos/videos de cada imóvel = mídias "No site" do kit
do $$ begin
  perform sync_imovel_midias(c.id) from captacoes c where exists (select 1 from midias m where m.captacao_id = c.id);
end $$;

commit;
