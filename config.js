// Configuração do site Ápice Imóveis.
// Deixe SUPABASE_URL e SUPABASE_ANON_KEY vazios para usar o MODO DEMONSTRAÇÃO.
window.APICE_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  WHATSAPP: '',  // número único do site; vazio = os botões levam para /whatsapp (Maciel e Luiz)
  WHATSAPP_VISIVEL: '',
  EMAIL: 'contato@apiceimoveis.com.br',
  CRECI: '',  // CRECI da empresa: preencher quando sair (ex.: '12345-J'). Enquanto vazio, aparecem só os CRECI dos corretores.
  // Página /whatsapp (link da bio do Instagram): um botão para cada corretor.
  // Preencha o WhatsApp só com números, com DDD (ex.: '48999990000'). Quem ficar vazio não aparece.
  CORRETORES: [
    { nome: 'Maciel da Soler', creci: '76286', whatsapp: '5548991911979' },
    { nome: 'Luiz Vagner Pereira', creci: '63296', whatsapp: '5548999192297' }
  ]
};
