-- ÁPICE IMÓVEIS — ARQUIVO ÚNICO. Supabase > SQL Editor > New query > cole TUDO > Run (uma única vez; depois rode o supabase-atualiza-20.sql e, se quiser conferir, o supabase-unifica.sql)

-- ===== 1) Site, contatos e fotos =====
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

-- (as permissões da tabela imoveis ficam na seção 2: equipe vê/cria/edita, só proprietário exclui)
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


-- ===== 2) Cadastro único: ficha privada, kit de mídia, link do cliente, corretores =====
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

-- ===== 3) Catálogo: 20 imóveis da planilha do Luiz + 3 antigos ocultos =====
insert into imoveis (id,categoria,tipo,titulo,cidade,preco,area,quartos,suites,vagas,descricao,fotos,videos,destaque,status,detalhes,criado) values
('a91ce000-0000-4000-8000-000000000001','morar','Casa','Casa nova no Loteamento Antônio Hoor','Forquilhinha',400000,76,3,1,null,'Casa nova no Loteamento Antônio Hoor, bairro Santa Ana, com 76 m² construídos em terreno de 13 x 28 m. Três dormitórios (1 suíte), massa corrida em todas as paredes, aberturas em alumínio preto, forro em PVC com junta seca e piso em porcelanato. Murada nas laterais e nos fundos, com a viga frontal já executada, pronta para o fechamento da frente. Aceita carro como parte do pagamento e terreno em Forquilhinha, ambos mediante avaliação.',array['imoveis/casa-santa-ana/01.jpg','imoveis/casa-santa-ana/02.jpg','imoveis/casa-santa-ana/03.jpg','imoveis/casa-santa-ana/04.jpg','imoveis/casa-santa-ana/05.jpg','imoveis/casa-santa-ana/06.jpg','imoveis/casa-santa-ana/07.jpg','imoveis/casa-santa-ana/08.jpg','imoveis/casa-santa-ana/09.jpg','imoveis/casa-santa-ana/10.jpg','imoveis/casa-santa-ana/11.jpg','imoveis/casa-santa-ana/12.jpg']::text[],'{}'::text[],true,'ativo','{"Bairro": "Santa Ana", "Loteamento": "Antônio Hoor", "Terreno": "13 x 28 m", "Piso": "Porcelanato", "Aberturas": "Alumínio preto"}'::jsonb,now() - interval '1 minutes'),
('a91ce000-0000-4000-8000-000000000002','investir','Sítio','Sítio de 2 hectares a 2,3 km do centro','Timbé do Sul',265000,20000,null,null,null,'Sítio de 2 hectares a 2,3 km do centro, com 1,5 km de estrada de pedra e projeto de asfalto previsto. Terreno totalmente plano, com uma parte mais alta ideal para casas. Todo cercado, com divisa de água corrente do morro e rio na frente do terreno. Energia elétrica aprovada pela Cersul e pronto para escritura. Aceita automóveis mediante avaliação.',array['imoveis/sitio-2ha-timbe/01.jpg','imoveis/sitio-2ha-timbe/02.jpg','imoveis/sitio-2ha-timbe/03.jpg','imoveis/sitio-2ha-timbe/04.jpg','imoveis/sitio-2ha-timbe/05.jpg','imoveis/sitio-2ha-timbe/06.jpg']::text[],'{}'::text[],true,'ativo','{"Área total": "2 hectares", "Distância do centro": "2,3 km", "Energia": "Aprovada pela Cersul", "Documentação": "Pronto para escritura"}'::jsonb,now() - interval '2 minutes'),
('a91ce000-0000-4000-8000-000000000003','construir','Terreno','Lotes no Loteamento Flor de Lis','Meleiro',null,null,null,null,null,'Lotes no Loteamento Flor de Lis, em Meleiro. Valor, tamanho dos lotes e quantidade disponível sob consulta.',array['imoveis/flor-de-lis-meleiro/01.jpg','imoveis/flor-de-lis-meleiro/02.jpg','imoveis/flor-de-lis-meleiro/03.jpg','imoveis/flor-de-lis-meleiro/04.jpg']::text[],'{}'::text[],false,'ativo','{"Loteamento": "Flor de Lis"}'::jsonb,now() - interval '3 minutes'),
('a91ce000-0000-4000-8000-000000000004','investir','Sítio','Área rural de 15 hectares','',null,150000,null,null,null,'Área rural de 15 hectares, sendo 11 de arroz e 4 de lomba. Cidade, valor e demais detalhes sob consulta.','{}'::text[],'{}'::text[],false,'oculto','{"Área total": "15 hectares", "Lavoura de arroz": "11 hectares", "Lomba": "4 hectares", "_mapa": "https://www.google.com/maps?q=-28.787004,-49.569828"}'::jsonb,now() - interval '4 minutes'),
('a91ce000-0000-4000-8000-000000000005','morar','Casa','Casa mobiliada a 150 m do mar','Balneário Arroio do Silva',null,null,3,1,2,'Casa totalmente mobiliada, a 150 metros do mar. Três quartos (1 suíte e 2 climatizados), banheiro social, cozinha e sala conjugadas, garagem fechada para 2 carros, churrasqueira e pátio amplo.',array['imoveis/casa-mobiliada-arroio/01.jpg','imoveis/casa-mobiliada-arroio/02.jpg','imoveis/casa-mobiliada-arroio/03.jpg','imoveis/casa-mobiliada-arroio/04.jpg','imoveis/casa-mobiliada-arroio/05.jpg','imoveis/casa-mobiliada-arroio/06.jpg','imoveis/casa-mobiliada-arroio/07.jpg','imoveis/casa-mobiliada-arroio/08.jpg','imoveis/casa-mobiliada-arroio/09.jpg','imoveis/casa-mobiliada-arroio/10.jpg','imoveis/casa-mobiliada-arroio/11.jpg','imoveis/casa-mobiliada-arroio/12.jpg']::text[],'{}'::text[],true,'ativo','{"Distância do mar": "150 m", "Mobília": "Totalmente mobiliada", "Churrasqueira": "Sim", "_mapa": "https://www.google.com/maps?q=-28.980419,-49.406525"}'::jsonb,now() - interval '5 minutes'),
('a91ce000-0000-4000-8000-000000000006','morar','Apartamento','Apartamento no centro, 1º andar','Forquilhinha',null,92,2,1,1,'Apartamento de 92 m² no 1º andar, no centro de Forquilhinha. Dois dormitórios (1 suíte), sala e cozinha conjugadas, área de serviço, banheiro social, sacada ampla com churrasqueira e garagem coberta para 1 carro. Salão de festas no condomínio.',array['imoveis/apto-centro-forquilhinha/01.jpg','imoveis/apto-centro-forquilhinha/02.jpg','imoveis/apto-centro-forquilhinha/03.jpg','imoveis/apto-centro-forquilhinha/04.jpg','imoveis/apto-centro-forquilhinha/05.jpg','imoveis/apto-centro-forquilhinha/06.jpg','imoveis/apto-centro-forquilhinha/07.jpg','imoveis/apto-centro-forquilhinha/08.jpg','imoveis/apto-centro-forquilhinha/09.jpg','imoveis/apto-centro-forquilhinha/10.jpg','imoveis/apto-centro-forquilhinha/11.jpg','imoveis/apto-centro-forquilhinha/12.jpg']::text[],'{}'::text[],true,'ativo','{"Andar": "1º andar", "Sacada": "Com churrasqueira", "Condomínio": "Salão de festas"}'::jsonb,now() - interval '6 minutes'),
('a91ce000-0000-4000-8000-000000000007','construir','Terreno','Lote Sérgio, região de praia','',null,null,null,null,null,'Lote em região de praia. Cidade, medidas e valor sob consulta.',array['imoveis/lote-praia-sergio/01.jpg','imoveis/lote-praia-sergio/02.jpg','imoveis/lote-praia-sergio/03.jpg','imoveis/lote-praia-sergio/04.jpg','imoveis/lote-praia-sergio/05.jpg']::text[],'{}'::text[],false,'ativo','{}'::jsonb,now() - interval '7 minutes'),
('a91ce000-0000-4000-8000-000000000008','morar','Casa','Casa de dois pisos na Vila Franca','',null,null,2,null,null,'Casa de dois pisos no bairro Vila Franca. No piso superior: 2 quartos, sala e cozinha conjugadas e banheiro social. No piso inferior: sala ampla de 56 m², ideal para ponto comercial ou investimento.',array['imoveis/casa-vila-franca/01.jpg','imoveis/casa-vila-franca/02.jpg','imoveis/casa-vila-franca/03.jpg','imoveis/casa-vila-franca/04.jpg','imoveis/casa-vila-franca/05.jpg','imoveis/casa-vila-franca/06.jpg','imoveis/casa-vila-franca/07.jpg','imoveis/casa-vila-franca/08.jpg']::text[],'{}'::text[],false,'ativo','{"Bairro": "Vila Franca", "Piso inferior": "Sala de 56 m²"}'::jsonb,now() - interval '8 minutes'),
('a91ce000-0000-4000-8000-000000000009','investir','Sítio','Sítio de 1 hectare com casa mobiliada','Timbé do Sul',null,10000,2,1,null,'Sítio de 1 hectare em localização privilegiada, com casa de 2 quartos, sendo 1 suíte com banheira. Totalmente mobiliado, com fogão a lenha e água corrente natural.',array['imoveis/sitio-1ha-timbe/01.jpg','imoveis/sitio-1ha-timbe/02.jpg','imoveis/sitio-1ha-timbe/03.jpg','imoveis/sitio-1ha-timbe/04.jpg','imoveis/sitio-1ha-timbe/05.jpg','imoveis/sitio-1ha-timbe/06.jpg','imoveis/sitio-1ha-timbe/07.jpg','imoveis/sitio-1ha-timbe/08.jpg','imoveis/sitio-1ha-timbe/09.jpg','imoveis/sitio-1ha-timbe/10.jpg','imoveis/sitio-1ha-timbe/11.jpg','imoveis/sitio-1ha-timbe/12.jpg']::text[],'{}'::text[],false,'ativo','{"Área total": "1 hectare", "Mobília": "Totalmente mobiliado", "Água": "Corrente natural"}'::jsonb,now() - interval '9 minutes'),
('a91ce000-0000-4000-8000-000000000010','construir','Terreno','Lote a 230 m do mar','Balneário Arroio do Silva',null,null,null,null,null,'Lote de 12,5 x 25 m na Rua Antônio Dionízio Bento, a 230 metros do mar, com escritura pronta para financiamento. Ideal para investir ou construir uma casa de praia.',array['imoveis/lote-arroio-230m/01.jpg','imoveis/lote-arroio-230m/02.jpg','imoveis/lote-arroio-230m/03.jpg','imoveis/lote-arroio-230m/04.jpg']::text[],'{}'::text[],false,'ativo','{"Terreno": "12,5 x 25 m", "Distância do mar": "230 m", "Escritura": "Pronta para financiamento"}'::jsonb,now() - interval '10 minutes'),
('a91ce000-0000-4000-8000-000000000011','morar','Casa','Casa mobiliada com piscina na Vila Lourdes','Forquilhinha',470000,85,null,null,null,'Casa mobiliada com piscina privativa, em ambientes aconchegantes e bem planejados, no bairro Vila Lourdes. São 85 m² de área construída em terreno de 14,80 x 35 m.',array['imoveis/casa-piscina-vila-lourdes/01.jpg','imoveis/casa-piscina-vila-lourdes/02.jpg','imoveis/casa-piscina-vila-lourdes/03.jpg','imoveis/casa-piscina-vila-lourdes/04.jpg','imoveis/casa-piscina-vila-lourdes/05.jpg','imoveis/casa-piscina-vila-lourdes/06.jpg','imoveis/casa-piscina-vila-lourdes/07.jpg','imoveis/casa-piscina-vila-lourdes/08.jpg']::text[],'{}'::text[],true,'ativo','{"Bairro": "Vila Lourdes", "Terreno": "14,80 x 35 m", "Piscina": "Privativa", "Mobília": "Mobiliada"}'::jsonb,now() - interval '11 minutes'),
('a91ce000-0000-4000-8000-000000000012','construir','Terreno','Lote em rua de bloquete','Forquilhinha',null,null,null,null,null,'Lote em rua de bloquete, com placa de venda no terreno e casas dos lados. Medidas, valor e bairro sob consulta.',array['imoveis/lote-santa-ana/01.jpg','imoveis/lote-santa-ana/02.jpg','imoveis/lote-santa-ana/03.jpg','imoveis/lote-santa-ana/04.jpg','imoveis/lote-santa-ana/05.jpg','imoveis/lote-santa-ana/06.jpg','imoveis/lote-santa-ana/07.jpg','imoveis/lote-santa-ana/08.jpg','imoveis/lote-santa-ana/09.jpg','imoveis/lote-santa-ana/10.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.758598,-49.489563"}'::jsonb,now() - interval '12 minutes'),
('a91ce000-0000-4000-8000-000000000013','investir','Prédio / comercial','Prédio de esquina com salas comerciais','',null,null,null,null,null,'Prédio de esquina com dois andares e salas comerciais no térreo. No andar superior, ambientes residenciais (cozinha, quartos e banheiros). Garagem coberta e pátio com piso de pedra. Cidade, metragem e valor sob consulta.',array['imoveis/predio-comercial-criciuma/01.jpg','imoveis/predio-comercial-criciuma/02.jpg','imoveis/predio-comercial-criciuma/03.jpg','imoveis/predio-comercial-criciuma/04.jpg','imoveis/predio-comercial-criciuma/05.jpg','imoveis/predio-comercial-criciuma/06.jpg','imoveis/predio-comercial-criciuma/07.jpg','imoveis/predio-comercial-criciuma/08.jpg','imoveis/predio-comercial-criciuma/09.jpg','imoveis/predio-comercial-criciuma/10.jpg','imoveis/predio-comercial-criciuma/11.jpg','imoveis/predio-comercial-criciuma/12.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.666288,-49.427341"}'::jsonb,now() - interval '13 minutes'),
('a91ce000-0000-4000-8000-000000000014','construir','Terreno','Lote com pinheiros','',null,null,null,null,null,'Lote em rua de pedra, com pinheiros e cercas. Cidade, medidas e valor sob consulta.',array['imoveis/lote-pinheiros/01.jpg','imoveis/lote-pinheiros/02.jpg','imoveis/lote-pinheiros/03.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-29.009266,-49.441643"}'::jsonb,now() - interval '14 minutes'),
('a91ce000-0000-4000-8000-000000000015','construir','Terreno','Lote gramado e cercado','Forquilhinha',null,null,null,null,null,'Terreno gramado e cercado, em rua asfaltada. Medidas, valor e bairro sob consulta.',array['imoveis/lote-forquilhinha-cerca/01.jpg','imoveis/lote-forquilhinha-cerca/02.jpg','imoveis/lote-forquilhinha-cerca/03.jpg','imoveis/lote-forquilhinha-cerca/04.jpg','imoveis/lote-forquilhinha-cerca/05.jpg','imoveis/lote-forquilhinha-cerca/06.jpg','imoveis/lote-forquilhinha-cerca/07.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.75559,-49.485149"}'::jsonb,now() - interval '15 minutes'),
('a91ce000-0000-4000-8000-000000000016','construir','Terreno','Lotes ao lado de rua de bloquete','',null,null,null,null,null,'Terrenos ao lado de rua de bloquete e de estrada de terra. Cidade, medidas e valor sob consulta.',array['imoveis/lote-forquilhinha-bloquete/01.jpg','imoveis/lote-forquilhinha-bloquete/02.jpg','imoveis/lote-forquilhinha-bloquete/03.jpg','imoveis/lote-forquilhinha-bloquete/04.jpg','imoveis/lote-forquilhinha-bloquete/05.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.746546,-49.464607"}'::jsonb,now() - interval '16 minutes'),
('a91ce000-0000-4000-8000-000000000017','morar','Apartamento','Apartamento em prédio de 6 andares','',null,null,null,null,null,'Apartamento em prédio de 6 andares, com quarto com ar-condicionado, banheiro com box, sala e jantar integradas e cozinha com armários. Cidade, metragem e valor sob consulta.',array['imoveis/apto-predio-6-andares/01.jpg','imoveis/apto-predio-6-andares/02.jpg','imoveis/apto-predio-6-andares/03.jpg','imoveis/apto-predio-6-andares/04.jpg','imoveis/apto-predio-6-andares/05.jpg','imoveis/apto-predio-6-andares/06.jpg','imoveis/apto-predio-6-andares/07.jpg','imoveis/apto-predio-6-andares/08.jpg','imoveis/apto-predio-6-andares/09.jpg','imoveis/apto-predio-6-andares/10.jpg']::text[],'{}'::text[],false,'ativo','{}'::jsonb,now() - interval '17 minutes'),
('a91ce000-0000-4000-8000-000000000018','morar','Casa','Casa térrea a 300 m do mar, Rua Inácio Antonio Peres','Balneário Arroio do Silva',240000,50,2,null,1,'Casa térrea de 50 m², padrão Minha Casa Minha Vida, em rua tranquila no bairro Areias Brancas, a 300 metros do mar. Dois quartos, banheiro social, área social integrada (cozinha, sala de jantar e estar) de 21,60 m² e vaga de garagem. Porcelanato simples nas áreas sociais. Sinal de 10% (R$ 24.000) para reservar; restante à vista ou com financiamento pela Caixa.','{}'::text[],'{}'::text[],false,'oculto','{"Bairro": "Areias Brancas", "Rua": "Inácio Antonio Peres", "Distância do mar": "300 m", "Entrada": "Sinal de 10%", "Financiamento": "Minha Casa Minha Vida"}'::jsonb,now() - interval '18 minutes'),
('a91ce000-0000-4000-8000-000000000019','morar','Casa','Casa térrea a 300 m do mar, Rua 40','Balneário Arroio do Silva',250000,50,2,null,1,'Casa térrea de 50 m², padrão Minha Casa Minha Vida, na Rua 40, no bairro Areias Brancas, a 300 metros do mar. Dois quartos, banheiro social, área social integrada (cozinha, sala de jantar e estar) e vaga de garagem. Mesmo modelo da casa da Rua Inácio Antonio Peres. Sinal de 10% para reservar; financiamento pela Caixa.','{}'::text[],'{}'::text[],false,'oculto','{"Bairro": "Areias Brancas", "Rua": "Rua 40", "Distância do mar": "300 m", "Entrada": "Sinal de 10%", "Financiamento": "Minha Casa Minha Vida"}'::jsonb,now() - interval '19 minutes'),
('a91ce000-0000-4000-8000-000000000020','morar','Casa','Casa térrea a 50 m do mar','Balneário Arroio do Silva',375000,60,3,null,1,'Casa térrea de 60 m², a 50 metros do mar, em rua tranquila. Três quartos, banheiro social, área de serviço e vaga de garagem. Entregue com grama, muro, calçada da frente em paver, grade frontal, alarme, câmeras e jardim. Sinal de 10% (R$ 37.500); financiamento pela Caixa.','{}'::text[],'{}'::text[],false,'oculto','{"Distância do mar": "50 m", "Entrada": "Sinal de 10%", "Financiamento": "Minha Casa Minha Vida"}'::jsonb,now() - interval '20 minutes'),
('a91ce000-0000-4000-8000-000000000021','morar','Casa','Casa nova no Loteamento Cechinel','Criciúma',240000,45,null,null,null,'Casa nova com 45 m², nunca habitada, pronta e averbada. Documentação 100% regularizada e aceita financiamento pelo Minha Casa, Minha Vida. Em loteamento consolidado, com infraestrutura completa e localização tranquila, de fácil acesso.',array['imoveis/casa-nova-criciuma/01.jpg','imoveis/casa-nova-criciuma/02.jpg','imoveis/casa-nova-criciuma/03.jpg','imoveis/casa-nova-criciuma/04.jpg','imoveis/casa-nova-criciuma/05.jpg','imoveis/casa-nova-criciuma/06.jpg','imoveis/casa-nova-criciuma/07.jpg','imoveis/casa-nova-criciuma/08.jpg']::text[],'{}'::text[],false,'oculto','{"Situação": "Nova, nunca habitada", "Documentação": "100% regularizada", "Financiamento": "Minha Casa, Minha Vida", "Loteamento": "Cechinel"}'::jsonb,now() - interval '111 minutes'),
('a91ce000-0000-4000-8000-000000000022','morar','Casa','Casa de madeira com terreno amplo','Criciúma',null,null,null,null,null,'Casa de madeira aconchegante com terreno amplo ao lado. Detalhes e valor sob consulta.',array['imoveis/casa-madeira-criciuma/01.jpg','imoveis/casa-madeira-criciuma/02.jpg','imoveis/casa-madeira-criciuma/03.jpg','imoveis/casa-madeira-criciuma/04.jpg','imoveis/casa-madeira-criciuma/05.jpg','imoveis/casa-madeira-criciuma/06.jpg','imoveis/casa-madeira-criciuma/07.jpg','imoveis/casa-madeira-criciuma/08.jpg']::text[],'{}'::text[],false,'oculto','{"_mapa": "https://www.google.com/maps?q=-28.751217,-49.434502"}'::jsonb,now() - interval '112 minutes'),
('a91ce000-0000-4000-8000-000000000023','construir','Terreno','Lote em Criciúma','Criciúma',null,null,null,null,null,'Lote em Criciúma com rua de acesso. Medidas e valor sob consulta.',array['imoveis/lote-criciuma/01.jpg','imoveis/lote-criciuma/02.jpg','imoveis/lote-criciuma/03.jpg','imoveis/lote-criciuma/04.jpg']::text[],'{}'::text[],false,'oculto','{"_mapa": "https://www.google.com/maps?q=-28.749439,-49.434429"}'::jsonb,now() - interval '113 minutes')
on conflict (id) do update set categoria=excluded.categoria,tipo=excluded.tipo,titulo=excluded.titulo,cidade=excluded.cidade,preco=excluded.preco,area=excluded.area,quartos=excluded.quartos,suites=excluded.suites,vagas=excluded.vagas,descricao=excluded.descricao,fotos=excluded.fotos,videos=excluded.videos,destaque=excluded.destaque,status=excluded.status,detalhes=excluded.detalhes;

-- ===== 4) Quem pode administrar o site (proprietários) =====
-- Confira os e-mails. Cada um também precisa ser criado em Authentication > Users.
insert into admins(email) values ('kuka.soler@gmail.com'), ('macieldasoler@gmail.com') on conflict do nothing;
-- Quando tiver o e-mail do Luiz, rode: insert into admins(email) values ('email-do-luiz');

-- ===== 5) Kit de mídia do catálogo (fotos atuais viram mídias "No site" e "No link") =====
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
