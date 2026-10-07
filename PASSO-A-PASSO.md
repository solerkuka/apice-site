# Colocar o site da Ápice no ar (3 etapas)

## Etapa 1 — GitHub (guardar os arquivos)
1. Entre em github.com > botão **+** > **New repository**. Nome: `apice-site`. Create.
2. Clique em **uploading an existing file**, arraste TODOS os arquivos desta pasta (descompactada, inclusive a pasta `modelo`) e clique **Commit changes**.

## Etapa 2 — Vercel (colocar no ar)
1. Entre em vercel.com com a conta do GitHub.
2. **Add New > Project** > escolha `apice-site` > **Deploy** (não mude nada).
3. Pronto: ele gera um link `xxxx.vercel.app`. Abra no celular e teste.
   - Já funciona em **modo demonstração** (imóveis modelo, painel de teste em `#/acesso-restrito`; toque em Entrar).

## Etapa 3 — Supabase (admin de verdade, fotos e contatos salvos)
1. supabase.com > **New project** (guarde a senha).
2. Menu **SQL Editor** > cole o conteúdo de `schema.sql` > **Run**.
3. **Authentication > Users > Add user**: seu e-mail e uma senha (marque Auto confirm).
4. No SQL Editor rode: `insert into admins(email) values ('seu-email');`
5. **Project Settings > API**: copie **Project URL** e **anon public key**.
6. No GitHub, abra `config.js` > lápis (editar) > cole nos campos `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Aqui também troque WhatsApp, e-mail e CRECI reais > Commit.
7. A Vercel atualiza sozinha em ~1 minuto. Acesse `seu-link/#/acesso-restrito` e entre.

## Depois
- Comprar domínio: Vercel > Settings > Domains.
- Trocar imagens modelo: no admin, edite o imóvel e envie fotos reais.

## Cadastro único de imóveis (novo)
1. Supabase > **SQL Editor** > cole o conteúdo de `supabase-unifica.sql` > **Run** (só uma vez; depois do `supabase-tudo.sql` e do `supabase-atualiza-20.sql`). Não rode o `supabase-atualiza-20.sql` de novo depois disso.
2. No GitHub, envie `index.html` e `captacao.js` (substituem os antigos). A antiga aba **Captação** acabou: tudo fica na lista **Imóveis**.
3. Acesse `seu-link/#/acesso-restrito`. Cada imóvel tem todas as fotos e vídeos (o "kit"), e você marca em cada um: **No site** (aparece para todos) e **No link** (aparece só no link privado do cliente).
4. Corretores: crie o usuário em Supabase > Authentication > Users (Auto confirm) e, na lista de Imóveis, em **Equipe de corretores**, coloque o e-mail dele. Corretores e proprietários editam e publicam; só proprietários excluem.
5. No local: **+ Novo imóvel** > escolha o tipo > **Usar minha localização agora** > tire as fotos/vídeos > preencha o que souber > **Salvar imóvel**. Ele nasce **Oculto** e já tem o link do cliente (**Copiar link** ou **Enviar por WhatsApp**). No escritório: complete os dados, marque as fotos **No site**, escolha a capa (estrela) e toque em **Publicar no site**.

## Mapa do site (endereços e pastas)
| Endereço | O que é | Onde mexer |
|---|---|---|
| `seusite.com.br` | Site principal | `index.html` |
| `seusite.com.br/whatsapp` | Página do link da bio (logo + botões de WhatsApp dos corretores) | pasta `whatsapp` |
| `seusite.com.br/app` | Entrada dos corretores (abre direto a área restrita) | pasta `app` |
| `seusite.com.br/#/acesso-restrito` | Painel (proprietários e corretores) | `index.html` e `captacao.js` |
| `seusite.com.br/#/i/código` | Link que o corretor manda ao cliente | gerado pelo sistema |

Pastas: `whatsapp` (página do link da bio), `app` (entrada do app), `assets` (logo e ícones do app), `modelo` (imagens de exemplo).
Arquivos na raiz: `config.js` (WhatsApp, e-mail, CRECI, corretores, Supabase), `manifest.webmanifest` e `sw.js` (app no celular), `schema.sql`, `schema-captacao.sql`, `supabase-tudo.sql` e `supabase-unifica.sql` (banco).

## Página do link da bio
A página `seusite.com.br/whatsapp` já está pronta (sua página do Instagram, com logo e os WhatsApp do Maciel e do Luiz). Basta colocar esse endereço no link da bio. Para trocar números ou textos, edite `whatsapp/index.html`.

## App dos corretores no celular
- **iPhone:** abra `seusite.com.br/app` no **Safari** > botão Compartilhar > **Adicionar à Tela de Início**.
- **Android:** abra `seusite.com.br/app` no Chrome > menu (3 pontinhos) > **Instalar app**.
- Abra pelo ícone e entre com e-mail e senha **uma única vez**: o login fica salvo e o app já abre direto na lista de Imóveis. (No iPhone, entre dentro do app do ícone, não no Safari: os dois não compartilham o login.)
