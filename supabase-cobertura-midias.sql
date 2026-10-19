insert into midias (captacao_id,tipo,estado,path,url,nome,no_site,no_link,ordem)
select c.id, x.tipo,'original',null,x.u,regexp_replace(x.u,'^.*/',''),true,true,x.n
from captacoes c cross join (values
('foto','imoveis/cobertura-flamingo/05.jpg',1),
('foto','imoveis/cobertura-flamingo/17.jpg',2),
('foto','imoveis/cobertura-flamingo/09.jpg',3),
('foto','imoveis/cobertura-flamingo/12.jpg',4),
('foto','imoveis/cobertura-flamingo/18.jpg',5),
('foto','imoveis/cobertura-flamingo/06.jpg',6),
('foto','imoveis/cobertura-flamingo/10.jpg',7),
('foto','imoveis/cobertura-flamingo/13.jpg',8),
('foto','imoveis/cobertura-flamingo/16.jpg',9),
('foto','imoveis/cobertura-flamingo/01.jpg',10),
('foto','imoveis/cobertura-flamingo/03.jpg',11),
('foto','imoveis/cobertura-flamingo/11.jpg',12),
('foto','imoveis/cobertura-flamingo/14.jpg',13),
('foto','imoveis/cobertura-flamingo/04.jpg',14),
('foto','imoveis/cobertura-flamingo/08.jpg',15),
('foto','imoveis/cobertura-flamingo/02.jpg',16),
('foto','imoveis/cobertura-flamingo/07.jpg',17),
('foto','imoveis/cobertura-flamingo/15.jpg',18)
) as x(tipo,u,n)
where c.imovel_id='a91ce000-0000-4000-8000-000000000025' and not exists (select 1 from midias m where m.captacao_id=c.id and m.url=x.u);
update imoveis set status='ativo', destaque=true where id='a91ce000-0000-4000-8000-000000000025';
