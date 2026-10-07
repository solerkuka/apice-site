-- ÁPICE IMÓVEIS — ARQUIVO ÚNICO. Supabase > SQL Editor > New query > cole TUDO > Run (uma única vez)

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


-- ===== 2) Captação (corretores, fotos e vídeos pelo celular) =====
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

-- ===== 3) Imóveis já importados do grupo do WhatsApp (16) =====
insert into imoveis (categoria,tipo,titulo,cidade,preco,area,quartos,suites,vagas,descricao,fotos,videos,destaque,status,detalhes,criado) values
('morar','Casa','Casa nova no Loteamento Antônio Hoor','Forquilhinha',400000,76,3,1,null,'Casa nova, pronta para morar, com excelente acabamento, no Loteamento Antônio Hoor, bairro Santa Ana. Terreno de 13 x 28 m, massa corrida em todas as paredes, aberturas em alumínio preto, forro em PVC com junta seca e piso em porcelanato. Murada nas laterais e nos fundos. Aceita carro ou terreno em Forquilhinha como parte do pagamento, mediante avaliação.',array['imoveis/casa-santa-ana/01.jpg','imoveis/casa-santa-ana/02.jpg','imoveis/casa-santa-ana/03.jpg','imoveis/casa-santa-ana/04.jpg','imoveis/casa-santa-ana/05.jpg','imoveis/casa-santa-ana/06.jpg','imoveis/casa-santa-ana/07.jpg','imoveis/casa-santa-ana/08.jpg']::text[],'{}'::text[],true,'ativo','{"Bairro": "Santa Ana", "Terreno": "13 x 28 m", "Piso": "Porcelanato", "Aberturas": "Alumínio preto"}'::jsonb,now() - interval '0 minutes'),
('construir','Terreno','Lote no bairro Santa Ana','Forquilhinha',null,null,null,null,null,'Lote plano em rua já aberta, ao lado de casas novas, na região do Loteamento Antônio Hoor. Medidas e valor sob consulta.',array['imoveis/lote-santa-ana/01.jpg','imoveis/lote-santa-ana/02.jpg','imoveis/lote-santa-ana/03.jpg','imoveis/lote-santa-ana/04.jpg','imoveis/lote-santa-ana/05.jpg','imoveis/lote-santa-ana/06.jpg','imoveis/lote-santa-ana/07.jpg','imoveis/lote-santa-ana/08.jpg']::text[],'{}'::text[],false,'ativo','{"Bairro": "Santa Ana", "_mapa": "https://www.google.com/maps?q=-28.758598,-49.489563"}'::jsonb,now() - interval '1 minutes'),
('investir','Sítio','Sítio de 2 hectares a 2,3 km do centro','Timbé do Sul',265000,20000,null,null,null,'Sítio com 2 hectares, terreno totalmente plano, com uma parte mais alta ideal para construção de casas. Todo cercado, com divisa de água corrente do morro e rio passando na frente. Energia elétrica aprovada pela Cersul e pronto para escritura. São 1,5 km de estrada de pedra, com projeto de asfalto previsto. Aceita automóveis mediante avaliação.',array['imoveis/sitio-2ha-timbe/01.jpg','imoveis/sitio-2ha-timbe/02.jpg','imoveis/sitio-2ha-timbe/03.jpg','imoveis/sitio-2ha-timbe/04.jpg','imoveis/sitio-2ha-timbe/05.jpg']::text[],'{}'::text[],true,'ativo','{"Área total": "2 hectares", "Distância do centro": "2,3 km", "Energia": "Aprovada pela Cersul", "Documentação": "Pronto para escritura"}'::jsonb,now() - interval '2 minutes'),
('construir','Terreno','Loteamento Flor de Lis','Meleiro',null,null,null,null,null,'Lotes no Loteamento Flor de Lis, em Meleiro, com rua pavimentada em bloquete. Medidas e valores sob consulta.',array['imoveis/flor-de-lis-meleiro/01.jpg','imoveis/flor-de-lis-meleiro/02.jpg','imoveis/flor-de-lis-meleiro/03.jpg','imoveis/flor-de-lis-meleiro/04.jpg']::text[],'{}'::text[],false,'ativo','{"Loteamento": "Flor de Lis"}'::jsonb,now() - interval '3 minutes'),
('construir','Terreno','Lote plano em Forquilhinha','Forquilhinha',null,null,null,null,null,'Lote plano e cercado, em região residencial de Forquilhinha. Medidas e valor sob consulta.',array['imoveis/lote-forquilhinha-cerca/01.jpg','imoveis/lote-forquilhinha-cerca/02.jpg','imoveis/lote-forquilhinha-cerca/03.jpg','imoveis/lote-forquilhinha-cerca/04.jpg','imoveis/lote-forquilhinha-cerca/05.jpg','imoveis/lote-forquilhinha-cerca/06.jpg','imoveis/lote-forquilhinha-cerca/07.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.755590,-49.485149"}'::jsonb,now() - interval '4 minutes'),
('morar','Casa','Casa térrea a 300 m do mar - Areias Brancas','Balneário Arroio do Silva',240000,50,2,null,1,'Casa térrea de 50 m², padrão Minha Casa Minha Vida, em rua tranquila a 300 metros do mar. Dois quartos, banheiro social, cozinha integrada à sala e vaga de garagem. Sinal de 10% para reservar; restante à vista ou com financiamento pela Caixa. Imagens ilustrativas do projeto.',array['imoveis/casa-areias-brancas/01.jpg','imoveis/casa-areias-brancas/02.jpg','imoveis/casa-areias-brancas/03.jpg','imoveis/casa-areias-brancas/04.jpg','imoveis/casa-areias-brancas/05.jpg','imoveis/casa-areias-brancas/06.jpg','imoveis/casa-areias-brancas/07.jpg','imoveis/casa-areias-brancas/08.jpg']::text[],'{}'::text[],false,'ativo','{"Bairro": "Areias Brancas", "Distância do mar": "300 m", "Entrada": "Sinal de 10%", "Financiamento": "Minha Casa Minha Vida"}'::jsonb,now() - interval '5 minutes'),
('morar','Casa','Casa mobiliada a 150 m do mar','Balneário Arroio do Silva',null,null,3,1,2,'Casa a apenas 150 metros do mar, pronta para curtir. Três quartos (1 suíte e 2 climatizados), banheiro social, cozinha e sala conjugadas, garagem fechada para 2 carros, churrasqueira e pátio amplo. Totalmente mobiliada.',array['imoveis/casa-mobiliada-arroio/01.jpg','imoveis/casa-mobiliada-arroio/02.jpg','imoveis/casa-mobiliada-arroio/03.jpg','imoveis/casa-mobiliada-arroio/04.jpg','imoveis/casa-mobiliada-arroio/05.jpg','imoveis/casa-mobiliada-arroio/06.jpg','imoveis/casa-mobiliada-arroio/07.jpg','imoveis/casa-mobiliada-arroio/08.jpg']::text[],'{}'::text[],true,'ativo','{"Distância do mar": "150 m", "Mobília": "Totalmente mobiliada", "Churrasqueira": "Sim", "_mapa": "https://www.google.com/maps?q=-28.980419,-49.406525"}'::jsonb,now() - interval '6 minutes'),
('morar','Apartamento','Apartamento no centro, 1º andar','Forquilhinha',null,92,2,1,1,'Apartamento de 92 m² no 1º andar, no centro de Forquilhinha. Dois dormitórios (1 suíte), sala e cozinha conjugadas, área de serviço, banheiro social, sacada ampla com churrasqueira e garagem coberta para 1 carro. Salão de festas no condomínio.',array['imoveis/apto-centro-forquilhinha/01.jpg','imoveis/apto-centro-forquilhinha/02.jpg','imoveis/apto-centro-forquilhinha/03.jpg','imoveis/apto-centro-forquilhinha/04.jpg','imoveis/apto-centro-forquilhinha/05.jpg','imoveis/apto-centro-forquilhinha/06.jpg','imoveis/apto-centro-forquilhinha/07.jpg','imoveis/apto-centro-forquilhinha/08.jpg']::text[],'{}'::text[],true,'ativo','{"Andar": "1º andar", "Sacada": "Com churrasqueira", "Condomínio": "Salão de festas"}'::jsonb,now() - interval '7 minutes'),
('investir','Sítio','Sítio de 1 hectare com casa mobiliada','Timbé do Sul',null,10000,2,1,null,'Sítio com 1 hectare e casa aconchegante de 2 quartos, sendo 1 suíte com banheira. Imóvel totalmente mobiliado, com fogão a lenha e água corrente natural. Um refúgio de paz e tranquilidade.',array['imoveis/sitio-1ha-timbe/01.jpg','imoveis/sitio-1ha-timbe/02.jpg','imoveis/sitio-1ha-timbe/03.jpg','imoveis/sitio-1ha-timbe/04.jpg','imoveis/sitio-1ha-timbe/05.jpg','imoveis/sitio-1ha-timbe/06.jpg','imoveis/sitio-1ha-timbe/07.jpg','imoveis/sitio-1ha-timbe/08.jpg']::text[],'{}'::text[],false,'ativo','{"Área total": "1 hectare", "Mobília": "Totalmente mobiliado", "Água": "Corrente natural"}'::jsonb,now() - interval '8 minutes'),
('construir','Terreno','Lote a 230 m do mar','Balneário Arroio do Silva',null,312,null,null,null,'Lote de 12,5 x 25 m na Rua Antônio Dionízio Bento, a 230 metros do mar, com escritura pronta para financiamento. Ideal para investir ou construir a sua casa de praia.',array['imoveis/lote-arroio-230m/01.jpg','imoveis/lote-arroio-230m/02.jpg','imoveis/lote-arroio-230m/03.jpg','imoveis/lote-arroio-230m/04.jpg']::text[],'{}'::text[],false,'ativo','{"Terreno": "12,5 x 25 m", "Distância do mar": "230 m", "Escritura": "Pronta para financiamento"}'::jsonb,now() - interval '9 minutes'),
('construir','Terreno','Lote em Criciúma','Criciúma',null,null,null,null,null,'Lote em Criciúma com rua de acesso. Medidas e valor sob consulta.',array['imoveis/lote-criciuma/01.jpg','imoveis/lote-criciuma/02.jpg','imoveis/lote-criciuma/03.jpg','imoveis/lote-criciuma/04.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.749439,-49.434429"}'::jsonb,now() - interval '10 minutes'),
('morar','Casa','Casa nova no Loteamento Cechinel','Criciúma',240000,45,null,null,null,'Casa nova com 45 m², nunca habitada, pronta e averbada. Documentação 100% regularizada e aceita financiamento pelo Minha Casa, Minha Vida. Em loteamento consolidado, com infraestrutura completa e localização tranquila, de fácil acesso.',array['imoveis/casa-nova-criciuma/01.jpg','imoveis/casa-nova-criciuma/02.jpg','imoveis/casa-nova-criciuma/03.jpg','imoveis/casa-nova-criciuma/04.jpg','imoveis/casa-nova-criciuma/05.jpg','imoveis/casa-nova-criciuma/06.jpg','imoveis/casa-nova-criciuma/07.jpg','imoveis/casa-nova-criciuma/08.jpg']::text[],'{}'::text[],true,'ativo','{"Situação": "Nova, nunca habitada", "Documentação": "100% regularizada", "Financiamento": "Minha Casa, Minha Vida", "Loteamento": "Cechinel"}'::jsonb,now() - interval '11 minutes'),
('morar','Casa','Casa com piscina na Vila Lourdes','Forquilhinha',470000,85,null,null,null,'Casa mobiliada com piscina privativa e ambientes aconchegantes e bem planejados, em localização tranquila de Forquilhinha. Terreno de 14,80 x 35 m e 85 m de área construída.',array['imoveis/casa-piscina-vila-lourdes/01.jpg','imoveis/casa-piscina-vila-lourdes/02.jpg','imoveis/casa-piscina-vila-lourdes/03.jpg','imoveis/casa-piscina-vila-lourdes/04.jpg','imoveis/casa-piscina-vila-lourdes/05.jpg','imoveis/casa-piscina-vila-lourdes/06.jpg','imoveis/casa-piscina-vila-lourdes/07.jpg','imoveis/casa-piscina-vila-lourdes/08.jpg']::text[],'{}'::text[],true,'ativo','{"Bairro": "Vila Lourdes", "Terreno": "14,80 x 35 m", "Piscina": "Privativa", "Mobília": "Mobiliada"}'::jsonb,now() - interval '12 minutes'),
('investir','Prédio / comercial','Prédio com salas comerciais','Criciúma',null,null,null,null,null,'Prédio de três pavimentos com salas comerciais, áreas internas amplas e garagem. Ótima opção para investir. Detalhes e valor sob consulta.',array['imoveis/predio-comercial-criciuma/01.jpg','imoveis/predio-comercial-criciuma/02.jpg','imoveis/predio-comercial-criciuma/03.jpg','imoveis/predio-comercial-criciuma/04.jpg','imoveis/predio-comercial-criciuma/05.jpg','imoveis/predio-comercial-criciuma/06.jpg','imoveis/predio-comercial-criciuma/07.jpg','imoveis/predio-comercial-criciuma/08.jpg']::text[],'{}'::text[],false,'ativo','{"Pavimentos": "3", "_mapa": "https://www.google.com/maps?q=-28.666288,-49.427341"}'::jsonb,now() - interval '13 minutes'),
('construir','Terreno','Lote com rua de bloquete','Forquilhinha',null,null,null,null,null,'Lote em região com rua de bloquete e acesso fácil. Medidas e valor sob consulta.',array['imoveis/lote-forquilhinha-bloquete/01.jpg','imoveis/lote-forquilhinha-bloquete/02.jpg','imoveis/lote-forquilhinha-bloquete/03.jpg','imoveis/lote-forquilhinha-bloquete/04.jpg','imoveis/lote-forquilhinha-bloquete/05.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.746546,-49.464607"}'::jsonb,now() - interval '14 minutes'),
('morar','Casa','Casa de madeira com terreno amplo','Criciúma',null,null,null,null,null,'Casa de madeira aconchegante com terreno amplo ao lado. Detalhes e valor sob consulta.',array['imoveis/casa-madeira-criciuma/01.jpg','imoveis/casa-madeira-criciuma/02.jpg','imoveis/casa-madeira-criciuma/03.jpg','imoveis/casa-madeira-criciuma/04.jpg','imoveis/casa-madeira-criciuma/05.jpg','imoveis/casa-madeira-criciuma/06.jpg','imoveis/casa-madeira-criciuma/07.jpg','imoveis/casa-madeira-criciuma/08.jpg']::text[],'{}'::text[],false,'ativo','{"_mapa": "https://www.google.com/maps?q=-28.751217,-49.434502"}'::jsonb,now() - interval '15 minutes');

-- ===== 4) Quem pode administrar o site (proprietários) =====
-- Confira os e-mails. Cada um também precisa ser criado em Authentication > Users.
insert into admins(email) values ('kuka.soler@gmail.com'), ('macieldasoler@gmail.com') on conflict do nothing;
-- Quando tiver o e-mail do Luiz, rode: insert into admins(email) values ('email-do-luiz');
