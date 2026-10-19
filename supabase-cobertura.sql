-- Cobertura Residencial Flamingo (imóvel 25), oculta até chegarem as fotos. Rodar uma vez.
insert into imoveis (id,categoria,tipo,titulo,cidade,preco,area,quartos,suites,descricao,fotos,videos,destaque,status,detalhes,criado) values
('a91ce000-0000-4000-8000-000000000025','morar','Cobertura','Cobertura semimobiliada no Residencial Flamingo','Criciúma',889000,130,3,1,
 'Cobertura no bairro Comerciário, com espaço gourmet e sol da manhã e da tarde. Três dormitórios, sendo uma suíte, semimobiliada, piso laminado, porcelanato na cozinha e garagem coberta. 130 m² de área privativa com garagem e 152 m² de área total. Desocupa em 60 dias. Aceita imóvel e carro na negociação e financiamento bancário.',
 '{}'::text[],'{}'::text[],false,'oculto','{"Bairro": "Comerciário", "Área privativa": "130 m² (com garagem)", "Área total": "152 m²", "Mobília": "Semimobiliada", "Garagem": "Coberta", "Desocupação": "Em 60 dias", "Negociação": "Aceita imóvel e carro", "Financiamento": "Aceita financiamento bancário"}'::jsonb,now())
on conflict (id) do nothing;
select titulo,status from imoveis where id='a91ce000-0000-4000-8000-000000000025';
