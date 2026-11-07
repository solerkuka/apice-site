-- ÁPICE IMÓVEIS — NOVOS IMÓVEIS 26 a 32 (nº da pasta do Drive) + correções de valor
-- Supabase > SQL Editor > New query > cole TUDO > Run (pode rodar mais de uma vez).
-- Todos entram OCULTOS (sem fotos ainda). Depois: Acesso restrito > imóvel > enviar fotos > status Ativo.
-- No painel, o que estiver vazio aparece em "Faltam: ...".
begin;

insert into imoveis (id,categoria,tipo,titulo,cidade,preco,area,descricao,fotos,videos,destaque,status,detalhes,criado) values
('a91ce000-0000-4000-8000-000000000126','construir','Terreno','Lote no bairro Santa Ana (nº 26)','Forquilhinha',130000,395.4,
 'Lote de 395,40 m² (15 x 26,36 m) no bairro Santa Ana, em Forquilhinha.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"26","Bairro":"Santa Ana","Terreno":"15 x 26,36 m"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000127','construir','Terreno','Dois lotes lado a lado no Ouro Negro (nº 27)','',145000,336,
 'Dois lotes lado a lado no loteamento Ouro Negro (quadra P, lotes 20 e 22), de 336 m² cada. Valor de R$ 145.000 cada lote.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"27","Loteamento":"Ouro Negro","Quadra":"P","Lotes":"20 e 22","Valor":"R$ 145.000 cada"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000128','construir','Terreno','Lote no Sampaio, Santa Cruz (nº 28)','',70000,404.62,
 'Lote de 404,62 m² (15,83 x 25,56 m). Oportunidade; liberação somente em maio de 2027.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"28","Terreno":"15,83 x 25,56 m","Liberação":"Maio/2027","Valor de mercado":"R$ 100.000 (confirmar qual valor publicar)"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000129','construir','Terreno','Terreno no centro, 400 m² (nº 29)','',350000,400,
 'Terreno de 400 m² (14 x 28,5 m) em região central.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"29","Terreno":"14 x 28,5 m"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000130','construir','Terreno','Lote no bairro Santa Clara (nº 30)','',135000,476,
 'Lote de 476 m² (13,8 x 34,5 m) no bairro Santa Clara.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"30","Bairro":"Santa Clara","Terreno":"13,8 x 34,5 m"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000131','construir','Terreno','Lote vizinho no Santa Clara (nº 31)','',115000,null,
 'Lote ao lado do nº 30, no bairro Santa Clara. Medidas a confirmar.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"31","Bairro":"Santa Clara"}'::jsonb,now()),
('a91ce000-0000-4000-8000-000000000132','morar','Apartamento','Residencial Firenze (nº 32)','Forquilhinha',null,null,
 'Apartamentos do Residencial Firenze, empreendimento F/J Empreendimentos. Plantas de 58 m² e 68 m².',
 '{}'::text[],'{}'::text[],false,'oculto','{"Drive nº":"32","Empreendimento":"F/J Empreendimentos","Plantas":"58 m² e 68 m²"}'::jsonb,now())
on conflict (id) do update set titulo=excluded.titulo,tipo=excluded.tipo,cidade=excluded.cidade,preco=excluded.preco,area=excluded.area,descricao=excluded.descricao,detalhes=excluded.detalhes;

-- Correções de valor (planilha): nº 1 = R$ 420.000 ; nº 6 = R$ 520.000
update imoveis set preco = 420000 where id = 'a91ce000-0000-4000-8000-000000000001';
update imoveis set preco = 520000 where id = 'a91ce000-0000-4000-8000-000000000006';

commit;
select titulo, preco, status from imoveis where id like 'a91ce000-0000-4000-8000-0000000001%' or id in ('a91ce000-0000-4000-8000-000000000001','a91ce000-0000-4000-8000-000000000006') order by titulo;
