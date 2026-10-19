-- Pavilhão comercial no São Luiz (imóvel 24). Rodar uma vez.
begin;
insert into imoveis (id,categoria,tipo,titulo,cidade,preco,area,descricao,fotos,videos,destaque,status,detalhes,criado) values
('a91ce000-0000-4000-8000-000000000024','investir','Pavilhão','Pavilhão comercial no bairro São Luiz','Forquilhinha',1489000,600,
 'Pavilhão com aproximadamente 600 m² de área construída, em terreno de 447,60 m², no bairro São Luiz. Ideal para a sua empresa. Analisamos proposta.',
 '{}'::text[],'{}'::text[],false,'ativo','{"Terreno": "447,60 m²", "Área construída": "aprox. 600 m²", "Condição": "Analisamos proposta"}'::jsonb,now())
on conflict (id) do nothing;
update captacoes set privados = coalesce(privados,'{}'::jsonb) || '{"endereco":"Rua Nicolau Machado de Souza, 67 - São Luiz"}'::jsonb
 where imovel_id = 'a91ce000-0000-4000-8000-000000000024';
insert into midias (captacao_id, tipo, estado, path, url, nome, no_site, no_link, ordem)
select c.id, x.tipo, 'original', null, x.u, regexp_replace(x.u,'^.*/',''), true, true, x.n
from captacoes c cross join (values
 ('foto','imoveis/pavilhao-sao-luiz/02.jpg',1),('foto','imoveis/pavilhao-sao-luiz/01.jpg',2),('foto','imoveis/pavilhao-sao-luiz/03.jpg',3),
 ('foto','imoveis/pavilhao-sao-luiz/05.jpg',4),('foto','imoveis/pavilhao-sao-luiz/04.jpg',5),
 ('video','imoveis/pavilhao-sao-luiz/video1.mp4',6),('video','imoveis/pavilhao-sao-luiz/video2.mp4',7),('video','imoveis/pavilhao-sao-luiz/video3.mp4',8)
) as x(tipo,u,n)
where c.imovel_id = 'a91ce000-0000-4000-8000-000000000024'
  and not exists (select 1 from midias m where m.captacao_id = c.id and m.url = x.u);
commit;
select i.titulo, array_length(i.fotos,1) fotos, array_length(i.videos,1) videos, i.status from imoveis i where i.id='a91ce000-0000-4000-8000-000000000024';
