-- ÁPICE IMÓVEIS — CÓDIGO DE CADA IMÓVEL (C = casa, L = lote, A = apartamento, I = investir)
-- Supabase > SQL Editor > New query > cole TUDO > Run.
alter table imoveis add column if not exists codigo text;
update imoveis set codigo = v.c from (values
 ('001','C1'),('002','L1'),('003','L2'),('004','L3'),('005','C2'),('006','A1'),('007','L4'),('008','C3'),('009','L5'),('010','L6'),
 ('011','C4'),('012','L7'),('013','I1'),('014','L8'),('015','L9'),('016','L10'),('017','A2'),('018','C5'),('019','C6'),('020','C7'),
 ('021','C10'),('022','C11'),('023','L16'),('024','I2'),('025','A4'),('127','L11'),('128','L12'),('129','L13'),('130','L14'),('131','L15'),('132','A5')
) as v(n,c) where right(imoveis.id::text,3) = v.n;
select codigo, titulo, status, categoria from imoveis order by codigo;
