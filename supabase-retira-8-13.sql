-- ÁPICE IMÓVEIS — RETIRA DO SITE: Casa Vila Franca (nº 8) e Prédio comercial/residencial (nº 13)
-- Supabase > SQL Editor > New query > cole TUDO > Run.
-- Eles ficam 'oculto' (somem do site, mas continuam cadastrados). Para voltar: Acesso restrito > status Ativo.
update imoveis set status = 'oculto'
where id in ('a91ce000-0000-4000-8000-000000000008','a91ce000-0000-4000-8000-000000000013');
select titulo, status from imoveis
where id in ('a91ce000-0000-4000-8000-000000000008','a91ce000-0000-4000-8000-000000000013');
