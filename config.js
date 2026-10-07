// Configuração do site Ápice Imóveis.
// Deixe SUPABASE_URL e SUPABASE_ANON_KEY vazios para usar o MODO DEMONSTRAÇÃO.
window.APICE_CONFIG = {
  SUPABASE_URL: 'https://xwjdvakfqpunnjofsadv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amR2YWtmcXB1bm5qb2ZzYWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNjA5MzQsImV4cCI6MjEwNjkzNjkzNH0.QWQDzPPtMPwFo3gwJg4evXWAy_L9iYUosg18Pi2PB9o',
  WHATSAPP: '',  // número único do site; vazio = os botões levam para /whatsapp (Maciel e Luiz)
  WHATSAPP_VISIVEL: '',
  EMAIL: 'contato@apiceimoveis.com',
  RAZAO:'Ápice Imóveis Ltda',
  CNPJ:'69.450.101/0001-60',
  CRECI: '',  // CRECI da empresa: preencher quando sair (ex.: '12345-J'). Enquanto vazio, aparecem só os CRECI dos corretores.
  // Página /whatsapp (link da bio do Instagram): um botão para cada corretor.
  // Preencha o WhatsApp só com números, com DDD (ex.: '48999990000'). Quem ficar vazio não aparece.
  CORRETORES: [
    { nome: 'Maciel da Soler', creci: '76286', whatsapp: '5548991911979' },
    { nome: 'Luiz Vagner Pereira', creci: '63296', whatsapp: '5548999192297' }
  ]
};
