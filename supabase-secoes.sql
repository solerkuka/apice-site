-- ÁPICE IMÓVEIS — NOVAS SEÇÕES DO SITE: Lotes, Casas, Apartamentos, Investir
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode junto com a atualização do site (index.html e captacao.js).
update imoveis set categoria = case
  when tipo in ('Terreno','Lote em condomínio','Área para lotear','Sítio') then 'lotes'
  when tipo = 'Casa' then 'casas'
  when tipo in ('Apartamento','Cobertura') then 'apartamentos'
  else 'investir' end;
select categoria, count(*) from imoveis group by categoria order by categoria;
