// Configuração do site Ápice Imóveis.
// Deixe SUPABASE_URL e SUPABASE_ANON_KEY vazios para usar o MODO DEMONSTRAÇÃO.
window.APICE_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  WHATSAPP: '5548999990000',
  WHATSAPP_VISIVEL: '(48) 99999-0000',
  EMAIL: 'contato@apiceimoveis.com.br',
  CRECI: '12345-J',
  // Página /whatsapp (link da bio do Instagram): um botão para cada corretor.
  // Preencha o WhatsApp só com números, com DDD (ex.: '48999990000'). Quem ficar vazio não aparece.
  CORRETORES: [
    { nome: 'Maciel da Soler', creci: '76286', whatsapp: '' },
    { nome: 'Luiz Vagner Pereira', creci: '63296', whatsapp: '' }
  ]
};
