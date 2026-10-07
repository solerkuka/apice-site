/* ÁPICE IMÓVEIS — CADASTRO ÚNICO DE IMÓVEIS (dados, kit de fotos/vídeos, publicar/ocultar e link privado do cliente)
   Carregado pelo index.html. Usa as peças do site (SB, auth, store, render, ESC, imoveis, refresh...).
   Modelo: tabela imoveis (vitrine pública) + captacoes (ficha privada 1:1) + midias (kit; no_site / no_link). Veja o supabase-unifica.sql. */
(function () {
"use strict";
const BUCKET = 'captacao';

/* ---------- FORMULÁRIOS POR TIPO DE IMÓVEL ---------- */
const N = (k, l, u) => ({ k, l, t: 'n', u }), S = (k, l, o) => ({ k, l, t: 's', o }),
      K = (k, l, o) => ({ k, l, t: 'c', o }), T = (k, l) => ({ k, l, t: 't' }), D = (k, l) => ({ k, l, t: 'm' });
const SN = ['Sim', 'Não'];
const DOCS = S('docs', 'Documentação', ['Escritura registrada', 'Em regularização', 'Inventário / pendente']);
const FIN = S('financia', 'Aceita financiamento', SN), PER = S('permuta', 'Aceita permuta', SN);
const EST = S('estado', 'Estado', ['Novo', 'Usado', 'Reformado', 'Na planta', 'Em construção']);
const MOB = S('mobiliado', 'Mobiliado', ['Não', 'Semimobiliado', 'Mobiliado']);
const TOPO = S('topografia', 'Topografia', ['Plano', 'Aclive', 'Declive', 'Irregular']);
const FORMS = {
  casa: [N('area', 'Área construída', 'm²'), N('area_terreno', 'Área do terreno', 'm²'), N('quartos', 'Quartos'), N('suites', 'Suítes'),
    N('banheiros', 'Banheiros'), N('vagas', 'Vagas de garagem'), N('andares', 'Pavimentos'), EST, MOB,
    S('local', 'Localização', ['Rua aberta', 'Condomínio fechado']), D('condominio', 'Condomínio (mensal)'), D('iptu', 'IPTU (anual)'),
    K('comodidades', 'Comodidades', ['Piscina', 'Área gourmet', 'Churrasqueira', 'Edícula', 'Quintal', 'Energia solar', 'Ar-condicionado', 'Lareira', 'Casa inteligente', 'Escritório', 'Elevador']),
    DOCS, FIN, PER],
  apto: [N('area', 'Área privativa', 'm²'), N('area_externa', 'Terraço / área externa', 'm²'), N('quartos', 'Quartos'), N('suites', 'Suítes'),
    N('banheiros', 'Banheiros'), N('vagas', 'Vagas de garagem'), N('andar', 'Andar'), T('edificio', 'Nome do edifício'),
    S('sol', 'Posição solar', ['Nascente', 'Poente', 'Norte', 'Sul']), S('vista', 'Vista', ['Mar', 'Cidade', 'Montanha', 'Livre']),
    EST, MOB, D('condominio', 'Condomínio (mensal)'), D('iptu', 'IPTU (anual)'),
    K('comodidades', 'Comodidades', ['Piscina', 'Academia', 'Salão de festas', 'Playground', 'Churrasqueira', 'Elevador', 'Portaria 24h', 'Sacada gourmet', 'Pet place', 'Gerador', 'Brinquedoteca', 'Coworking']),
    DOCS, FIN, PER],
  lote: [N('area', 'Área do terreno', 'm²'), N('frente', 'Frente', 'm'), N('fundos', 'Fundos', 'm'), N('lateral', 'Lateral', 'm'), TOPO,
    S('esquina', 'Esquina', SN), T('loteamento', 'Loteamento / condomínio'), S('uso', 'Uso permitido', ['Residencial', 'Comercial', 'Misto']),
    D('condominio', 'Condomínio (mensal)'),
    K('infra', 'Infraestrutura', ['Água', 'Energia', 'Esgoto', 'Asfalto', 'Iluminação pública', 'Murado', 'Calçada', 'Internet']),
    DOCS, FIN, PER],
  area: [N('area', 'Área total', 'm²'), N('frente', 'Frente para a via', 'm'), T('via', 'Via de acesso'), TOPO, T('zoneamento', 'Zoneamento'),
    N('dist_centro', 'Distância do centro', 'km'), S('app', 'Área de preservação (APP)', ['Não tem', 'Tem em parte', 'Não sei']),
    S('viabilidade', 'Viabilidade de loteamento', ['Aprovada', 'Em análise', 'Ainda não consultada']),
    K('infra', 'Infraestrutura', ['Água', 'Energia', 'Esgoto', 'Asfalto na frente', 'Rodovia próxima', 'Internet']), DOCS, PER],
  comercial: [N('area', 'Área construída', 'm²'), N('area_terreno', 'Área do terreno', 'm²'), N('salas', 'Salas / unidades'), N('banheiros', 'Banheiros'),
    N('vagas', 'Vagas'), N('andares', 'Pavimentos'), T('uso', 'Uso atual'), S('locado', 'Locado hoje', SN), D('renda', 'Renda mensal de aluguel'), EST,
    K('comodidades', 'Comodidades', ['Elevador', 'Ar-condicionado central', 'Gerador', 'Estacionamento', 'Acessibilidade', 'Fachada de vidro']),
    DOCS, FIN, PER]
};
const FAM = { 'Casa': 'casa', 'Apartamento': 'apto', 'Cobertura': 'apto', 'Terreno': 'lote', 'Lote em condomínio': 'lote', 'Área para lotear': 'area', 'Sítio': 'area', 'Prédio / comercial': 'comercial' };
const TIPOS = Object.keys(FAM);
const PRIV = [T('endereco', 'Endereço completo'), T('proprietario', 'Proprietário'), T('tel_proprietario', 'Telefone do proprietário'),
  T('comissao', 'Comissão combinada'), { k: 'obs', l: 'Observações internas', t: 'x' }];
const STD = ['area', 'quartos', 'suites', 'vagas'];   // viram colunas do imóvel no site

const fields = tipo => FORMS[FAM[tipo]] || [];
const fieldOf = (tipo, k) => fields(tipo).find(f => f.k === k);
const esc = s => ESC(s);
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
function fmt(f, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (f.t === 'n') return Number(v).toLocaleString('pt-BR') + (f.u ? ' ' + f.u : '');
  if (f.t === 'm') return 'R$ ' + Number(v).toLocaleString('pt-BR');
  if (f.t === 'c') return v.join(', ');
  return String(v);
}
function pairs(tipo, d, bairro) {
  const r = []; d = d || {};
  if (bairro) r.push(['Bairro', bairro]);
  for (const f of fields(tipo)) { if (STD.includes(f.k)) continue; const v = fmt(f, d[f.k]); if (v) r.push([f.l, v]); }
  return r;
}
const dtl = r => r.length ? `<div class="dtl">${r.map(([a, b]) => `<div>${esc(a)}<b>${esc(b)}</b></div>`).join('')}</div>` : '';
const specs = (tipo, d) => { d = d || {}; const a = fieldOf(tipo, 'area');
  return `<div class="specs">${d.area ? `<span><b>${esc(d.area)} m²</b>${esc(a ? a.l : 'Área')}</span>` : ''}${d.quartos ? `<span><b>${esc(d.quartos)}</b>Quartos</span>` : ''}${d.suites ? `<span><b>${esc(d.suites)}</b>Suítes</span>` : ''}${d.vagas ? `<span><b>${esc(d.vagas)}</b>Vagas</span>` : ''}</div>`; };

/* ---------- ESTADO ---------- */
const s = { fic: [], mid: [], eq: [], loaded: false, loading: false, err: '', open: null, form: null, queue: [], sel: new Set(),
  msg: '', busy: '', q: '', fil: '', pub: { token: null, data: null, err: '' } };
const msg = t => { s.msg = t; };
function busy(t) { s.busy = t; const e = document.getElementById('capbusy'); if (e) e.textContent = t; }
const goTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
function rr() { const y = window.scrollY; render(); window.scrollTo({ top: y, left: 0, behavior: 'instant' }); }
const rid = () => Math.random().toString(36).slice(2, 10);
const ms = x => x ? new Date(x).getTime() : 0;
const equipe = () => !!(auth.admin || auth.corretor);
const imv = id => imoveis.find(x => x.id === id);
const ficOf = id => s.fic.find(f => f.imovel_id === id);
const ficById = id => s.fic.find(f => f.id === id);
const byOrd = (a, b) => (a.ordem || 0) - (b.ordem || 0) || (ms(a.criado) - ms(b.criado)) || (a.id > b.id ? 1 : -1);
const midsOf = fid => s.mid.filter(m => m.captacao_id === fid).sort(byOrd);
const replaced = m => m.estado === 'original' && s.mid.some(t => t.original_id === m.id);   // original já trocada por uma versão tratada
const vis = fid => midsOf(fid).filter(m => !replaced(m));                                   // o que aparece na grade
const siteList = (fid, tipo) => vis(fid).filter(m => m.no_site && m.tipo === tipo && mUrl(m));
const tituloDe = (i, f) => (i && i.titulo) || ((i && i.tipo || (f && f.tipo) || 'Imóvel') + ' em ' + ((f && f.bairro) || (i && i.cidade) || '—'));
const mUrl = m => m.url || (m.path ? (DEMO ? m.path : SB.storage.from(BUCKET).getPublicUrl(m.path).data.publicUrl) : '');
const mapaUrl = f => safeUrl(f.mapa_url) || (f.lat != null && f.lng != null ? `https://www.google.com/maps?q=${f.lat},${f.lng}` : '');
const shareUrl = f => location.origin + location.pathname + '#/i/' + f.token;
const kindOf = f => { const t = f.type || ''; const e = (f.name.split('.').pop() || '').toLowerCase();
  if (t.startsWith('video') || ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(e)) return 'video';
  if (t.startsWith('image') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(e)) return 'foto';
  return null; };
const catsDe = tipo => Object.keys(CATS).filter(k => CATS[k].tipos.includes(tipo));
const STDC = ['area', 'quartos', 'suites', 'vagas'];
const falta = (i, fid) => { const m = []; if (!i.preco) m.push('preço'); if (!i.area) m.push('área'); if (siteList(fid, 'foto').length < 3) m.push('fotos no site'); if (!i.cidade) m.push('cidade'); return m; };

/* ---------- DADOS (Supabase ou modo demonstração) ---------- */
async function fetchAll(tabela) {   // o Supabase devolve no máximo 1000 linhas por pedido
  const out = []; for (let a = 0; ; a += 1000) {
    const r = await SB.from(tabela).select('*').order('criado', { ascending: true }).order('id', { ascending: true }).range(a, a + 999);
    if (r.error) throw r.error; out.push(...r.data); if (r.data.length < 1000) break;
  } return out;
}
const normM = r => ({ ...r, criado: ms(r.criado) });
const demoF = i => { const d = i.detalhes || {}, dados = {}; STDC.forEach(k => { if (i[k]) dados[k] = Number(i[k]); });
  return { id: 'f' + rid() + rid(), imovel_id: i.id, token: rid() + rid() + rid(), tipo: i.tipo || 'Casa', bairro: d.Bairro || null, lat: null, lng: null, mapa_url: d._mapa || '',
    mostrar_mapa: true, mapa_site: !!d._mapa, dados, privados: {}, corretor: 'demo', criado: Date.now(), atualizado: Date.now() }; };
const urlNome = u => String(u).split('?')[0].split('/').pop().slice(0, 60) || 'arquivo';
const db = {
  async load() {
    if (SB) {
      s.fic = await fetchAll('captacoes'); s.mid = (await fetchAll('midias')).map(normM);
      if (auth.admin) { const c = await SB.from('corretores').select('email').order('email'); s.eq = c.data || []; }
      const sem = s.mid.filter(m => !m.url && m.path);      // mídias antigas sem endereço final: completa de uma vez
      for (const m of sem) m.url = mUrl(m);
      for (let k = 0; k < sem.length; k += 10) await Promise.all(sem.slice(k, k + 10).map(m => SB.from('midias').update({ url: m.url }).eq('id', m.id).then(() => 0, () => 0)));
    } else {   // demonstração: cada imóvel ganha ficha e kit a partir das fotos que já tem
      let F = LS.get('apice_fic', []), M = LS.get('apice_mid', []), mud = false;
      for (const i of imoveis) if (!F.some(f => f.imovel_id === i.id)) {
        const f = demoF(i); F.push(f); mud = true;
        (i.fotos || []).forEach((u, n) => M.push({ id: 'm' + rid() + rid(), captacao_id: f.id, tipo: 'foto', estado: 'original', original_id: null, path: null, url: u, nome: urlNome(u), no_site: true, no_link: true, ordem: n + 1, criado: Date.now() + n }));
        (i.videos || []).forEach((u, n) => M.push({ id: 'm' + rid() + rid(), captacao_id: f.id, tipo: 'video', estado: 'original', original_id: null, path: null, url: u, nome: urlNome(u), no_site: true, no_link: true, ordem: n + 1, criado: Date.now() + n }));
      }
      s.fic = F; s.mid = M; if (mud) { LS.set('apice_fic', F); LS.set('apice_mid', M); }
    }
  },
  async ensureFic(i) {
    let f = ficOf(i.id); if (f) return f;
    if (SB) {
      const dados = {}; STDC.forEach(k => { if (i[k]) dados[k] = Number(i[k]); });
      const { data, error } = await SB.from('captacoes').insert({ imovel_id: i.id, tipo: i.tipo || 'Casa', dados }).select('*').single(); if (error) throw error; f = data;
    } else { f = demoF(i); LS.set('apice_fic', [...s.fic, f]); }
    s.fic.push(f); return f;
  },
  async patchF(f, p) {
    if (SB) { const { error } = await SB.from('captacoes').update(p).eq('id', f.id); if (error) throw error; }
    Object.assign(f, p); if (!SB) LS.set('apice_fic', s.fic);
  },
  async createImovel(row, frow) {
    let i, f;
    if (SB) {
      const { data, error } = await SB.from('imoveis').insert(row).select('*').single(); if (error) throw error;
      i = data; await refresh(); i = imv(i.id) || i;
      const r = await SB.from('captacoes').select('*').eq('imovel_id', i.id).maybeSingle(); f = r.data;
      if (f) s.fic.push(f); else f = await db.ensureFic(i);
    } else {
      i = { ...row }; await store.save(i); await refresh(); i = imv(i.id) || i; f = demoF(i); s.fic.push(f); LS.set('apice_fic', s.fic);
    }
    await db.patchF(f, frow); return { i, f };
  },
  async saveImovel(i, row, f, frow) {
    if (SB) { const { error } = await SB.from('imoveis').update(row).eq('id', i.id); if (error) throw error; } else await store.patch(i.id, row);
    await db.patchF(f, frow); await refresh();
  },
  async patchImovel(i, p) { if (SB) { const { error } = await SB.from('imoveis').update(p).eq('id', i.id); if (error) throw error; } else await store.patch(i.id, p); Object.assign(i, p); },
  async delImovel(i) {
    const f = ficOf(i.id), paths = f ? s.mid.filter(m => m.captacao_id === f.id && m.path).map(m => m.path) : [];
    if (SB) {
      if (paths.length) await SB.storage.from(BUCKET).remove(paths);
      const { error } = await SB.from('imoveis').delete().eq('id', i.id); if (error) throw error;
    } else { await store.remove(i.id); }
    if (f) { s.fic = s.fic.filter(x => x !== f); s.mid = s.mid.filter(m => m.captacao_id !== f.id); }
    if (!SB) { LS.set('apice_fic', s.fic); LS.set('apice_mid', s.mid); }
    await refresh();
  },
  async addM(f, file, x) {
    x = x || {}; const tipo = kindOf(file);
    if (!tipo) throw new Error('não é foto nem vídeo');
    let path = null, url;
    if (SB) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      path = f.id + '/' + Date.now() + '-' + rid() + '.' + ext;
      const { error } = await SB.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000' }); if (error) throw error;
      url = SB.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } else {
      if (file.size > 2.5 * 1024 * 1024) throw new Error('no modo demonstração use arquivos de até 2,5 MB');
      url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    }
    const ord = Math.max(0, ...midsOf(f.id).map(m => m.ordem || 0)) + 1;
    const row = { captacao_id: f.id, tipo, estado: x.estado || 'original', original_id: x.original_id || null, path, url, nome: file.name,
      no_site: !!x.no_site, no_link: x.no_link !== false, ordem: x.ordem != null ? x.ordem : ord };
    if (SB) {
      const { data, error } = await SB.from('midias').insert(row).select('*').single();
      if (error) { await SB.storage.from(BUCKET).remove([path]); throw error; }
      const m = normM(data); s.mid.push(m); return m;
    }
    row.id = 'm' + rid() + rid(); row.criado = Date.now(); s.mid.push(row);
    if (!LS.set('apice_mid', s.mid)) { s.mid.pop(); throw new Error('armazenamento do navegador cheio (modo demonstração)'); }
    return row;
  },
  async patchM(m, p) {
    if (SB) { const { error } = await SB.from('midias').update(p).eq('id', m.id); if (error) throw error; }
    Object.assign(m, p); if (!SB) LS.set('apice_mid', s.mid);
  },
  async patchMany(list, p) {
    if (!list.length) return;
    if (SB) { const { error } = await SB.from('midias').update(p).in('id', list.map(m => m.id)); if (error) throw error; }
    list.forEach(m => Object.assign(m, p)); if (!SB) LS.set('apice_mid', s.mid);
  },
  async delM(m) {
    const gone = [m, ...s.mid.filter(x => x.original_id === m.id)];
    const orig = m.estado === 'tratada' && m.original_id ? s.mid.find(x => x.id === m.original_id) : null;
    if (orig) await db.patchM(orig, { no_site: m.no_site, no_link: m.no_link });   // apagar a tratada devolve a original
    const paths = gone.map(x => x.path).filter(Boolean);
    if (SB) {
      if (paths.length) await SB.storage.from(BUCKET).remove(paths);
      const { error } = await SB.from('midias').delete().eq('id', m.id); if (error) throw error;
    }
    s.mid = s.mid.filter(x => !gone.includes(x));
    if (!SB) LS.set('apice_mid', s.mid);
  }
};
// Mantém a lista de fotos/vídeos do site (imoveis.fotos / videos) igual ao que está marcado "No site".
// No Supabase o gatilho do banco já faz isso; aqui só atualizamos a tela (e o modo demonstração, que não tem banco).
async function syncSite(fid) {
  const f = ficById(fid), i = f && imv(f.imovel_id); if (!i) return;
  i.fotos = siteList(fid, 'foto').map(mUrl); i.videos = siteList(fid, 'video').map(mUrl);
  if (!SB) await store.patch(i.id, { fotos: i.fotos, videos: i.videos });
}

/* ---------- ENVIO DE ARQUIVOS (fotos reduzidas no navegador para ~1600 px) ---------- */
const loadImg = file => new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); const t = setTimeout(() => { URL.revokeObjectURL(u); no(new Error('timeout')); }, 20000);
  im.onload = () => { clearTimeout(t); URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { clearTimeout(t); URL.revokeObjectURL(u); no(new Error('img')); }; im.src = u; });
async function compress(file) {
  if (kindOf(file) !== 'foto' || CAP.noCompress) return file;
  const max = DEMO ? 1000 : 1600;
  try {
    let bmp; if (window.createImageBitmap) { try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); } } else bmp = await loadImg(file);
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, max / Math.max(w, h));
    if (k === 1 && file.size < 700 * 1024 && /jpe?g/i.test(file.type)) return file;
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', DEMO ? .7 : .82));
    if (!blob || (k === 1 && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}
async function enviar(f, files, map) {
  const arr = [...files]; let ok = 0; const bad = [];
  for (let n = 0; n < arr.length; n++) {
    busy(`Enviando ${n + 1} de ${arr.length}…`);
    const ex = map ? map(arr[n]) : {}; let done = false, err, fl = arr[n];
    try { fl = await compress(arr[n]); } catch (e) { fl = arr[n]; }
    for (let t = 0; t < 2 && !done; t++) { try { await db.addM(f, fl, ex); done = true; ok++; } catch (e) { err = e; } }
    if (!done) bad.push(arr[n].name + ' (' + ((err && err.message) || 'erro') + ')');
    else if (ex._o) { try { await db.patchM(ex._o, { no_site: false, no_link: false }); } catch (e) {} }
  }
  try { await syncSite(f.id); } catch (e) {}
  busy(''); msg(bad.length ? '!Não enviou: ' + bad.join('; ') : `${ok} arquivo(s) enviado(s).`); rr();
}
const stem = n => String(n).replace(/\.[^.]+$/, '').toLowerCase().replace(/\s*\(\d+\)$/, '').replace(/[\s_-]*(editad[ao]|tratad[ao]|edit|final|hdr|web)\d*$/, '');
function enviarTratadas(f, files) {
  const orig = vis(f.id).filter(m => m.estado === 'original');
  return enviar(f, files, x => { const o = orig.find(m => stem(m.nome || '') === stem(x.name));
    return o ? { estado: 'tratada', original_id: o.id, ordem: o.ordem, no_site: o.no_site, no_link: o.no_link, _o: o } : {}; });
}
/* ---------- ZIP (sem biblioteca) ---------- */
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true);
    c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
    cen.push(c.buffer, nm); off += 30 + nm.length + sz;
  }
  const cs = cen.reduce((a, b) => a + b.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e.buffer], { type: 'application/zip' });
}
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
const safeName = n => String(n).replace(/[\\/:*?"<>|]+/g, '_');
const slug = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imovel';

function resumo(i, f) {
  const d = f.dados || {}, L = [tituloDe(i, f), i.tipo + ' · ' + [f.bairro, i.cidade].filter(Boolean).join(', '), i.preco ? 'Valor: R$ ' + Number(i.preco).toLocaleString('pt-BR') : 'Valor: sob consulta', ''];
  pairs(i.tipo, d, f.bairro).forEach(([a, b]) => L.push(a + ': ' + b));
  STD.forEach(k => { const x = fieldOf(i.tipo, k); if (x && d[k]) L.push(x.l + ': ' + fmt(x, d[k])); });
  if (i.descricao) L.push('', i.descricao);
  L.push('', '--- PARTICULAR (não divulgar) ---'); const p = f.privados || {};
  PRIV.forEach(x => { if (p[x.k]) L.push(x.l + ': ' + p[x.k]); });
  const m = mapaUrl(f); if (m) L.push('Localização: ' + m);
  L.push('Link do cliente: ' + shareUrl(f)); return L.join('\r\n');
}

/* ---------- FORMULÁRIO ---------- */
const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));
function formFrom(i, f) {
  const dados = clone(f.dados); STDC.forEach(k => { if (dados[k] == null && i[k]) dados[k] = Number(i[k]); });
  return { id: i.id, fid: f.id, tipo: i.tipo || f.tipo || 'Casa', categoria: i.categoria || '', titulo: i.titulo || '', cidade: i.cidade || '', bairro: f.bairro || '',
    preco: i.preco || '', descricao: i.descricao || '', lat: f.lat == null ? null : f.lat, lng: f.lng == null ? null : f.lng, mapa_url: f.mapa_url || '',
    mostrar_mapa: f.mostrar_mapa !== false, mapa_site: !!f.mapa_site, dados, privados: clone(f.privados) };
}
const blank = () => ({ id: null, tipo: 'Casa', categoria: '', titulo: '', cidade: '', bairro: '', preco: '', descricao: '', lat: null, lng: null, mapa_url: '', mostrar_mapa: true, mapa_site: false, dados: {}, privados: {} });
function fieldHtml(f) {
  const v = s.form.dados[f.k], cl = x => `oninput="CAP.set('${x}','${f.k}',this.value)"`;
  if (f.t === 'n') return `<label>${f.l}${f.u ? ' (' + f.u + ')' : ''}<input inputmode="decimal" value="${esc(v)}" ${cl('dados')}></label>`;
  if (f.t === 'm') return `<label>${f.l} (R$)<input inputmode="numeric" value="${esc(v)}" ${cl('dados')}></label>`;
  if (f.t === 's') return `<label>${f.l}<select onchange="CAP.set('dados','${f.k}',this.value)"><option value="">—</option>${f.o.map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<label>${f.l}<input value="${esc(v)}" ${cl('dados')}></label>`;
}
const inp = (k, l, ex) => `<label>${l}<input ${ex || ''} value="${esc(s.form[k])}" oninput="CAP.set('f','${k}',this.value)"></label>`;
function tipoBox() {
  const f = s.form;
  return `<label style="margin-top:0">Tipo de imóvel</label><div class="chips" style="margin-top:8px">${TIPOS.map(t => `<button class="chip ${f.tipo === t ? 'on' : ''}" onclick="CAP.tipo('${t}')">${t}</button>`).join('')}</div>`;
}
function localBox() {
  const f = s.form, tem = f.lat != null && f.lng != null;
  const loc = tem ? `Localização salva (${f.lat}, ${f.lng}) · <a target="_blank" rel="noopener" style="color:#d3c7ba" href="https://www.google.com/maps?q=${f.lat},${f.lng}">conferir no mapa</a>` : 'Nenhuma localização salva ainda.';
  return `<label style="margin-top:0">Localização exata (só a equipe vê)</label><div class="note" style="margin-top:8px">${loc}</div>
  <div style="margin-top:10px"><button class="btn o sm" onclick="CAP.gps()">Usar minha localização agora</button></div>
  ${inp('mapa_url', 'Ou cole o link do Google Maps', 'inputmode="url"')}
  <label class="ck" style="margin-top:12px"><input type="checkbox" ${f.mostrar_mapa ? 'checked' : ''} onchange="CAP.set('f','mostrar_mapa',this.checked)"> Mostrar o botão "Ver localização" no link do cliente</label>
  <label class="ck" style="margin-top:8px"><input type="checkbox" ${f.mapa_site ? 'checked' : ''} onchange="CAP.set('f','mapa_site',this.checked)"> Mostrar o botão também no site público</label>`;
}
function dadosBox() {
  const f = s.form, fs = fields(f.tipo), grid = fs.filter(x => x.t !== 'c'), checks = fs.filter(x => x.t === 'c'), cats = catsDe(f.tipo);
  return `<div class="g2">${inp('cidade', 'Cidade')}${inp('bairro', 'Bairro')}</div>${inp('preco', 'Valor (R$) · vazio = sob consulta', 'inputmode="numeric"')}${inp('titulo', 'Título (vazio = criamos um)')}
  ${cats.length > 1 ? `<label>Seção no site<select onchange="CAP.set('f','categoria',this.value)">${cats.map(k => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${CATS[k].n}</option>`).join('')}</select></label>` : ''}
  <label style="margin-top:22px">Dados do imóvel · ${esc(f.tipo)}</label><div class="g2">${grid.map(fieldHtml).join('')}</div>
  ${checks.map(c => `<label>${c.l}</label><div class="ckg">${c.o.map((o, i) => `<label class="ck"><input type="checkbox" ${(f.dados[c.k] || []).includes(o) ? 'checked' : ''} onchange="CAP.tog('${c.k}',${i},this.checked)"> ${esc(o)}</label>`).join('')}</div>`).join('')}
  <label>Descrição<textarea oninput="CAP.set('f','descricao',this.value)">${esc(f.descricao)}</textarea></label>`;
}
function privBox() {
  const f = s.form;
  return `<label style="margin-top:0">Particular · só a equipe vê (nunca vai para o cliente nem para o site)</label>
  ${PRIV.map(x => x.t === 'x' ? `<label>${x.l}<textarea oninput="CAP.set('privados','${x.k}',this.value)">${esc(f.privados[x.k])}</textarea></label>` : `<label>${x.l}<input value="${esc(f.privados[x.k])}" oninput="CAP.set('privados','${x.k}',this.value)"></label>`).join('')}`;
}
const pickBtns = `<div class="up"><label class="btn">Tirar foto<input type="file" accept="image/*" capture="environment" onchange="CAP.pick(this)"></label><label class="btn">Gravar vídeo<input type="file" accept="video/*" capture="environment" onchange="CAP.pick(this)"></label><label class="btn o">Fotos e vídeos da galeria<input type="file" accept="image/*,video/*" multiple onchange="CAP.pick(this)"></label></div>`;

/* ---------- TELAS DA EQUIPE ---------- */
function shell(body) {
  return `<div class="adm"><button class="back" onclick="go('')">← Ver o site</button><p class="eyebrow">Acesso restrito</p><h1>Imóveis</h1>${DEMO ? '<div class="demo"><b>Modo demonstração:</b> tudo fica só neste navegador (arquivos de até 2,5 MB).</div>' : ''}${admTabs('imoveis')}${s.msg ? `<div class="msg ${s.msg[0] === '!' ? 'e' : ''}">${esc(s.msg.replace(/^!/, ''))}</div>` : ''}<div class="msg" id="capbusy">${esc(s.busy)}</div>${body}</div>`;
}
function page() {
  if (!s.loaded && !s.loading && !s.err) {
    s.loading = true;
    db.load().then(() => { s.loaded = true; }).catch(e => { s.err = (e && e.message) || 'erro'; }).finally(() => { s.loading = false; render(); });
  }
  if (s.err) return shell(`<div class="msg e">Não foi possível abrir os imóveis: ${esc(s.err)}. Se for a primeira vez, rode o arquivo <b>supabase-unifica.sql</b> no Supabase.</div><div style="margin-top:14px"><button class="btn o sm" onclick="CAP.retry()">Tentar de novo</button></div>`);
  if (!s.loaded) return shell('<div class="empty">Carregando…</div>');
  return shell(s.form && !s.form.id ? newView() : s.open ? editView() : listView());
}
const STL = { ativo: 'No site', oculto: 'Oculto', vendido: 'Vendido' };
function listRow(i) {
  const f = ficOf(i.id), md = f ? vis(f.id) : [], nf = md.filter(m => m.tipo === 'foto').length, nv = md.filter(m => m.tipo === 'video').length, st = i.status || 'ativo';
  const fl = f ? falta(i, f.id) : [], c = (i.fotos || [])[0];
  return `<div class="row"><div class="th" style="cursor:pointer;${c ? `background-image:url('${esc(c)}')` : ''}" onclick="CAP.abrir('${esc(i.id)}')"></div><div class="i" style="cursor:pointer" onclick="CAP.abrir('${esc(i.id)}')"><b>${esc(tituloDe(i, f))}</b><span>${esc([i.tipo, i.cidade].filter(Boolean).join(' · '))} · ${money(i.preco)}<br>${nf} foto(s) (${(i.fotos || []).length} no site) · ${nv} vídeo(s)</span> <span class="pill ${esc(st)}">${esc(STL[st] || st)}</span>${fl.length ? `<span style="color:#FF5A4F;display:block;margin-top:4px">Faltam: ${fl.join(', ')}</span>` : ''}</div>
  <div class="acts"><button class="star ${i.destaque ? 'on' : ''}" title="Destaque na página inicial" onclick="CAP.dest('${esc(i.id)}')">★</button><button class="btn o sm" onclick="CAP.copiar('${esc(i.id)}')">Link</button><button class="btn o sm" onclick="CAP.abrir('${esc(i.id)}')">Editar</button></div></div>`;
}
function listBody() {
  const q = s.q.toLowerCase();
  const L = imoveis.filter(i => (!s.fil || (i.status || 'ativo') === s.fil) && (!q || [i.titulo, i.cidade, i.tipo].join(' ').toLowerCase().includes(q)));
  return L.length ? L.map(listRow).join('') : '<div class="empty">Nenhum imóvel encontrado.</div>';
}
function listView() {
  const eq = (auth.admin && SB) ? `<div class="box"><h2 style="font-size:20px">Equipe de corretores</h2><p class="sub">Corretores cadastram e editam imóveis e escolhem o que vai para o site; só os proprietários excluem. Antes de adicionar, crie o usuário em Supabase &gt; Authentication &gt; Users.</p>${s.eq.map(e => `<div class="row"><div class="i"><b>${esc(e.email)}</b></div><button class="btn d sm" onclick="CAP.rmEq('${esc(e.email)}')">Remover</button></div>`).join('')}<div class="two"><label>E-mail do corretor<input id="capeq" type="email" autocomplete="off"></label><div style="align-self:end"><button class="btn sm" onclick="CAP.addEq()">Adicionar</button></div></div></div>` : '';
  const n = k => imoveis.filter(i => (i.status || 'ativo') === k).length;
  return `<div style="margin-top:20px"><button class="btn" onclick="CAP.novo()">+ Novo imóvel</button></div>
  <div class="note">Todos os imóveis ficam aqui. Você escolhe quais aparecem no site e quais fotos; cada imóvel tem um link privado para enviar ao cliente.</div>
  <div class="chips" style="margin-top:16px">${[['', 'Todos (' + imoveis.length + ')'], ['ativo', 'No site (' + n('ativo') + ')'], ['oculto', 'Ocultos (' + n('oculto') + ')'], ['vendido', 'Vendidos (' + n('vendido') + ')']].map(([v, t]) => `<button class="chip ${s.fil === v ? 'on' : ''}" onclick="CAP.filtro('${v}')">${t}</button>`).join('')}</div>
  <input placeholder="Buscar por título, cidade ou tipo" value="${esc(s.q)}" oninput="CAP.busca(this.value)">
  <div id="caplist" style="margin-top:10px">${listBody()}</div>${eq}`;
}
function tile(m, capaId) {
  const u = esc(mUrl(m)), id = esc(m.id), on = s.sel.has(m.id);
  const el = m.tipo === 'foto' ? `<img src="${u}" loading="lazy" decoding="async" alt="">` : `<video src="${u}#t=0.1" preload="metadata" muted playsinline></video><span class="vd">▶ Vídeo</span>`;
  return `<div class="mt ${on ? 'sel' : ''} ${!m.no_site && !m.no_link ? 'off' : ''}"><div class="mi" onclick="CAP.sel('${id}')">${el}<span class="ck2">${on ? '✓' : ''}</span>${m.tipo === 'foto' ? `<button class="cv ${m.id === capaId ? 'on' : ''}" title="Definir como capa" onclick="event.stopPropagation();CAP.capa('${id}')">★</button>` : ''}${m.estado === 'tratada' ? '<span class="tr">Tratada</span>' : ''}</div>
  <div class="tg"><button class="${m.no_site ? 'on' : ''}" onclick="CAP.flag('${id}','no_site')">No site</button><button class="${m.no_link ? 'on' : ''}" onclick="CAP.flag('${id}','no_link')">No link</button></div>
  <div class="ac"><button title="Mover para antes" onclick="CAP.mover('${id}',-1)">↑</button><button title="Mover para depois" onclick="CAP.mover('${id}',1)">↓</button><button title="Ver" onclick="CAP.ver('${id}')">⤢</button><button title="Baixar" onclick="CAP.baixar('${id}')">⬇</button><button title="Excluir" onclick="CAP.rm('${id}',this)">✕</button></div></div>`;
}
function editView() {
  const i = imv(s.open), f = i && ficOf(i.id); if (!i || !f) { s.open = null; s.form = null; return listView(); }
  const md = vis(f.id), nf = md.filter(m => m.tipo === 'foto'), nv = md.filter(m => m.tipo === 'video'), st = i.status || 'ativo', u = shareUrl(f), fl = falta(i, f.id);
  const np = siteList(f.id, 'foto').length, nvp = siteList(f.id, 'video').length, capa = nf[0] && nf[0].id, mp = mapaUrl(f);
  const bar = s.sel.size ? `<div class="selbar"><b>${s.sel.size} selecionada(s)</b><button onclick="CAP.bulk('no_site',true)">No site</button><button onclick="CAP.bulk('no_site',false)">Tirar do site</button><button onclick="CAP.bulk('no_link',true)">No link</button><button onclick="CAP.bulk('no_link',false)">Tirar do link</button><button class="x" onclick="CAP.bulkDel(this)">Excluir</button><button onclick="CAP.limpaSel()">Limpar</button></div>` : '';
  return `<div style="margin-top:16px"><button class="btn o sm" onclick="CAP.fechar()">← Todos os imóveis</button></div>
  <h2 class="tt">${esc(tituloDe(i, f))}</h2>
  <div class="sub" style="margin:0">${esc([i.tipo, i.cidade].filter(Boolean).join(' · '))} · ${money(i.preco)} <span class="pill ${esc(st)}">${esc(STL[st] || st)}</span></div>
  ${fl.length ? `<div class="falta">Faltam: ${fl.join(', ')}</div>` : '<div class="ok">Tudo certo para publicar.</div>'}
  <div class="up">${st === 'ativo' ? `<button class="btn o" onclick="CAP.status('oculto')">Ocultar do site</button>` : `<button class="btn" onclick="CAP.publicar()">Publicar no site</button>`}
  <select style="width:auto;margin:0" onchange="CAP.status(this.value)" aria-label="Status"><option value="ativo" ${st === 'ativo' ? 'selected' : ''}>Ativo (no site)</option><option value="oculto" ${st === 'oculto' ? 'selected' : ''}>Oculto</option><option value="vendido" ${st === 'vendido' ? 'selected' : ''}>Vendido</option></select>
  ${st !== 'oculto' ? `<a class="btn sm o" href="#/imovel/${esc(i.id)}">Ver no site</a>` : ''}</div>
  <label class="ck"><input type="checkbox" ${i.destaque ? 'checked' : ''} onchange="CAP.dest('${esc(i.id)}')"> Destaque na página inicial</label>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Link privado para o cliente</label><p class="sub" style="margin:6px 0 0">Mostra só as fotos marcadas "No link", mesmo com o imóvel oculto. Nunca mostra dados do proprietário, comissão ou observações.</p><input readonly value="${esc(u)}" onclick="this.select()">
  <div class="up" style="margin-bottom:0"><button class="btn sm" onclick="CAP.copiar('${esc(i.id)}')">Copiar link</button><a class="btn sm o" target="_blank" rel="noopener" href="${esc(CAP.wa(i, f))}">Enviar por WhatsApp</a>${navigator.share ? `<button class="btn sm o" onclick="CAP.compartilhar()">Compartilhar</button>` : ''}<a class="btn sm o" target="_blank" rel="noopener" href="${esc(u)}">Abrir</a></div></div>
  <div class="box" style="margin-top:14px" id="capmedia"><label style="margin-top:0">Fotos e vídeos</label>${pickBtns}
  <div class="cnt"><b>${np} de ${nf.length} fotos no site</b> · ${nvp} de ${nv.length} vídeos no site · ${md.filter(m => m.no_link).length} no link do cliente</div>
  <p class="sub" style="margin:6px 0 0"><b>No site</b>: aparece para todos. <b>No link</b>: aparece no link privado. Toque na foto para selecionar várias; a estrela define a capa; ↑ ↓ mudam a ordem.</p>
  ${md.length ? `<div class="up" style="margin:12px 0 0"><button class="btn o sm" onclick="CAP.selAll()">Selecionar todas</button><button class="btn o sm" onclick="CAP.limpaSel()">Limpar seleção</button></div>` : ''}
  <div class="cm">${md.length ? md.map(m => tile(m, capa)).join('') : '<div class="empty" style="grid-column:1/-1">Ainda sem fotos ou vídeos. Use os botões acima.</div>'}</div>${bar}
  <div class="up"><button class="btn o sm" onclick="CAP.zip()">Baixar tudo (ZIP)</button><label class="btn o sm">Enviar tratadas<input type="file" accept="image/*,video/*" multiple onchange="CAP.upT(this)"></label>${mp ? `<a class="btn o sm" target="_blank" rel="noopener" href="${esc(mp)}">Ver no mapa</a>` : ''}</div>
  <div class="note">Para tratar no computador: baixe o ZIP, edite e use "Enviar tratadas" (mantenha o nome do arquivo: a tratada substitui a original).</div></div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Dados do imóvel</label>${tipoBox()}${dadosBox()}</div>
  <div class="box" style="margin-top:14px">${localBox()}</div>
  <div class="box" style="margin-top:14px">${privBox()}</div>
  <div class="up"><button class="btn" onclick="CAP.salvar()">Salvar dados</button>${auth.admin ? `<button class="btn d" onclick="CAP.excluir(this)">Excluir imóvel</button>` : ''}</div>`;
}
function newView() {
  const q = s.queue;
  return `<div style="margin-top:16px"><button class="btn o sm" onclick="CAP.cancelar()">← Cancelar</button></div><h2 class="tt">Novo imóvel</h2>
  <div class="note" style="margin-top:6px">Ele nasce <b>Oculto</b> (fora do site) e já ganha o link privado para mandar ao cliente. Depois você completa os dados e escolhe o que vai para o site.</div>
  <div class="box" style="margin-top:14px">${tipoBox()}</div>
  <div class="box" style="margin-top:14px">${localBox()}</div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Fotos e vídeos</label>${pickBtns}
  ${q.length ? `<div class="cnt"><b>${q.length} arquivo(s) para enviar</b> ao salvar</div><div class="thumbs">${q.map(x => `<div>${x.url ? `<img src="${esc(x.url)}" alt="">` : `<div class="qv">Vídeo<br>${esc(x.file.name.slice(0, 14))}</div>`}<button onclick="CAP.qrm('${x.id}')">Remover</button></div>`).join('')}</div>` : '<p class="sub" style="margin:8px 0 0">Tire fotos ou escolha da galeria (várias de uma vez). Elas são enviadas quando você salvar.</p>'}</div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">O que você já souber</label>${dadosBox()}</div>
  <div class="box" style="margin-top:14px">${privBox()}</div>
  <div class="up"><button class="btn" onclick="CAP.salvar()">Salvar imóvel</button></div><div class="msg" id="capbusy2"></div>`;
}

/* ---------- LINK DO CLIENTE (#/i/código) ---------- */
async function loadPub(token) {
  try {
    let d;
    if (SB) {
      const r = await SB.rpc('captacao_publica', { p_token: token }); if (r.error) throw r.error; d = r.data;
      if (d) d.midias = (d.midias || []).map(m => ({ tipo: m.tipo, url: m.url || (m.path ? SB.storage.from(BUCKET).getPublicUrl(m.path).data.publicUrl : '') })).filter(m => m.url);
    } else {
      const f = LS.get('apice_fic', []).find(x => x.token === token), all = await store.list(), i = f && all.find(x => x.id === f.imovel_id);
      if (i) {
        const mm = LS.get('apice_mid', []).filter(m => m.captacao_id === f.id && m.no_link).sort(byOrd);
        d = { tipo: i.tipo, titulo: i.titulo, cidade: i.cidade, bairro: f.bairro, preco: i.preco, descricao: i.descricao, vendido: i.status === 'vendido', dados: f.dados || {},
          mapa: f.mostrar_mapa ? mapaUrl(f) : null, midias: mm.map(m => ({ tipo: m.tipo, url: m.url || m.path })) };
      }
    }
    if (!d) throw new Error('nada');
    if (s.pub.token === token) s.pub.data = d;
  } catch (e) { if (s.pub.token === token) s.pub.err = 'x'; }
  if (R.name === 'cap') render();
}
function publico(token) {
  if (s.pub.token !== token) { s.pub = { token, data: null, err: '' }; loadPub(token); }
  const p = s.pub;
  if (p.err) return head('Imóvel', 'Link indisponível', 'Este link não existe mais ou foi desativado.') + foot();
  if (!p.data) return head('Imóvel', 'Carregando…', '') + foot();
  const i = p.data, md = i.midias || [], t = i.titulo || i.tipo, mp = safeUrl(i.mapa);
  return `<div class="det"><p class="eyebrow">${esc(i.tipo)} · ${esc([i.bairro, i.cidade].filter(Boolean).join(', '))}</p><h1>${esc(t)}</h1><div class="pc">${money(i.preco)}${i.vendido ? ' · Vendido' : ''}</div>
  ${specs(i.tipo, i.dados)}${dtl(pairs(i.tipo, i.dados, i.bairro))}${mp ? `<p><a class="btn o" target="_blank" rel="noopener" href="${esc(mp)}">Ver localização no mapa</a></p>` : ''}
  <div class="gal">${md.filter(m => m.tipo === 'video').map(m => `<video controls playsinline preload="metadata" src="${esc(m.url)}"></video>`).join('')}${md.filter(m => m.tipo === 'foto').map(m => `<img loading="lazy" src="${esc(m.url)}" alt="" style="cursor:zoom-in" onclick="CAP.zoomU(this.src)">`).join('')}</div>
  <div class="dw"><div class="dd">${esc(i.descricao)}</div><div><form class="box" style="margin:0" onsubmit="return sendLead(event,'interesse','${esc(p.token)}','${esc(t).replace(/'/g, '')}')"><b style="font-weight:400;letter-spacing:.15em;font-size:11px;text-transform:uppercase;color:#EAE3DA">Quero saber mais</b><label>Nome<input name="nome" required></label><label>WhatsApp<input name="tel" type="tel" inputmode="tel" required></label><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Enviar</button><a class="btn o" target="_blank" rel="noopener" href="${wa('Olá! Tenho interesse em: ' + t)}">WhatsApp</a></div><div class="msg"></div></form></div></div></div>${foot()}`;
}

/* ---------- AÇÕES ---------- */
const LABELS = new Set(['Bairro']); Object.values(FORMS).forEach(a => a.forEach(f => { if (!STD.includes(f.k)) LABELS.add(f.l); }));
// Detalhes públicos do imóvel: o que o formulário gera + o que já existia (ex.: catálogo importado) sem perder nada.
function buildDet(old, tipo, d, bairro, mapaSite, mapa) {
  const o = {}, ant = (old && old._gerado) || [];
  Object.keys(old || {}).forEach(k => { if (k[0] !== '_' && !ant.includes(k)) o[k] = old[k]; });
  const pr = pairs(tipo, d, bairro); pr.forEach(([a, b]) => { o[a] = b; });
  o._gerado = pr.map(x => x[0]); if (mapaSite && mapa) o._mapa = mapa; return o;
}
const toInt = v => v == null ? null : Math.round(Number(v));
function collect() {
  const f = s.form, d = {}, base = f.id ? (imv(f.id) || {}) : {};
  for (const x of fields(f.tipo)) {
    let v = f.dados[x.k];
    if (x.t === 'n') { v = String(v == null ? '' : v).replace(',', '.').replace(/[^0-9.]/g, ''); v = v === '' ? null : Number(v); }
    else if (x.t === 'm') v = Number(String(v == null ? '' : v).replace(/\D/g, '')) || null;
    else if (x.t === 'c') v = (v || []).length ? v : null;
    else v = v || null;
    if (v != null && !Number.isNaN(v)) d[x.k] = v;
  }
  const pv = {}; PRIV.forEach(x => { const v = String(f.privados[x.k] || '').trim(); if (v) pv[x.k] = v; });
  const cidade = String(f.cidade || '').trim(), bairro = String(f.bairro || '').trim();
  const std = k => fieldOf(f.tipo, k) ? (d[k] != null ? d[k] : null) : (base[k] || null);   // campo que o tipo não tem mantém o valor atual
  const mapa = { mapa_url: safeUrl(f.mapa_url), lat: f.lat, lng: f.lng };
  const irow = { categoria: catsDe(f.tipo).includes(f.categoria) ? f.categoria : (catsDe(f.tipo)[0] || 'morar'), tipo: f.tipo,
    titulo: String(f.titulo || '').trim() || (f.tipo + (bairro || cidade ? ' em ' + (bairro || cidade) : '')), cidade,
    preco: Number(String(f.preco).replace(/\D/g, '')) || null, area: std('area'), quartos: toInt(std('quartos')), suites: toInt(std('suites')), vagas: toInt(std('vagas')),
    descricao: String(f.descricao || '').trim(), detalhes: buildDet(base.detalhes, f.tipo, d, bairro, f.mapa_site, mapaUrl(mapa)) };
  const frow = { tipo: f.tipo, bairro: bairro || null, lat: f.lat == null ? null : f.lat, lng: f.lng == null ? null : f.lng, mapa_url: mapa.mapa_url || null,
    mostrar_mapa: !!f.mostrar_mapa, mapa_site: !!f.mapa_site, dados: d, privados: pv, atualizado: new Date().toISOString() };
  return { irow, frow };
}
const guard = async (fn) => { try { await fn(); } catch (e) { busy(''); msg('!' + ((e && e.message) || 'erro')); } };
const confirmar = (b, txt) => { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Confirmar?'; setTimeout(() => { if (b.isConnected) { b.dataset.s = ''; b.textContent = txt; } }, 4000); return false; } return true; };
const CAP = {
  page, publico, noCompress: false,
  det(i) { const d = i.detalhes || {}, ks = Object.keys(d).filter(k => k[0] !== '_'), m = safeUrl(d._mapa);
    return dtl(ks.map(k => [k, d[k]])) + (m ? `<p><a class="btn o" target="_blank" rel="noopener" href="${esc(m)}">Ver localização no mapa</a></p>` : ''); },
  reset() { s.fic = []; s.mid = []; s.loaded = false; s.err = ''; s.open = null; s.form = null; s.queue = []; s.sel = new Set(); s.msg = ''; },
  wa(i, f) { return 'https://wa.me/?text=' + encodeURIComponent('Olá! Veja as fotos e as informações do imóvel "' + tituloDe(i, f) + '": ' + shareUrl(f)); },
  retry() { s.err = ''; s.loaded = false; render(); },
  filtro(v) { s.fil = v; rr(); },
  busca(v) { s.q = v; const e = document.getElementById('caplist'); if (e) e.innerHTML = listBody(); },
  novo() { s.form = blank(); s.open = null; s.queue = []; msg(''); goTop(); render(); },
  cancelar() { s.queue.forEach(x => x.url && URL.revokeObjectURL(x.url)); s.queue = []; s.form = null; msg(''); render(); },
  async abrir(id) {
    const i = imv(id); if (!i) return;
    await guard(async () => { const f = await db.ensureFic(i); s.open = id; s.form = formFrom(i, f); s.sel = new Set(); msg(''); goTop(); });
    render();
  },
  fechar() { s.open = null; s.form = null; s.sel = new Set(); msg(''); render(); },
  tipo(t) { s.form.tipo = t; if (!catsDe(t).includes(s.form.categoria)) s.form.categoria = catsDe(t)[0] || ''; rr(); },
  set(g, k, v) { if (g === 'f') s.form[k] = v; else s.form[g][k] = v; },
  tog(k, i, on) { const f = fieldOf(s.form.tipo, k), x = f.o[i], a = s.form.dados[k] || (s.form.dados[k] = []), n = a.indexOf(x); if (on && n < 0) a.push(x); if (!on && n >= 0) a.splice(n, 1); },
  gps() {
    if (!navigator.geolocation) { msg('!Este aparelho não permite pegar a localização.'); return rr(); }
    busy('Buscando localização…');
    navigator.geolocation.getCurrentPosition(p => { s.form.lat = +p.coords.latitude.toFixed(6); s.form.lng = +p.coords.longitude.toFixed(6); busy(''); msg('Localização salva (toque em Salvar para gravar).'); rr(); },
      () => { busy(''); msg('!Não foi possível pegar a localização. Permita o acesso à localização no navegador e tente de novo.'); rr(); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  },
  async salvar(quieto) {
    const novo = !s.form.id; let ok = false;
    await guard(async () => {
      const { irow, frow } = collect();
      if (novo) {
        busy('Salvando…');
        const { i, f } = await db.createImovel({ ...irow, status: 'oculto', destaque: false, fotos: [], videos: [] }, frow);
        const q = s.queue; s.queue = []; s.open = i.id; s.form = formFrom(i, f); s.sel = new Set(); goTop();
        if (q.length) { render(); await enviar(f, q.map(x => x.file)); q.forEach(x => x.url && URL.revokeObjectURL(x.url)); }
        msg(s.msg && s.msg[0] === '!' ? s.msg : 'Imóvel salvo como Oculto. O link do cliente já está pronto: copie ou envie por WhatsApp.');
      } else {
        const i = imv(s.form.id), f = ficOf(s.form.id); await db.saveImovel(i, irow, f, frow);
        s.form = formFrom(imv(s.form.id), ficOf(s.form.id)); if (!quieto) msg('Dados salvos.');
      }
      busy(''); ok = true;
    });
    if (!quieto || !ok) { goTop(); render(); }
    return ok;
  },
  pick(inp) {
    const files = [...inp.files]; inp.value = ''; if (!files.length) return;
    if (s.form && !s.form.id) { files.forEach(x => { if (kindOf(x)) s.queue.push({ id: rid(), file: x, url: kindOf(x) === 'foto' ? URL.createObjectURL(x) : '' }); }); rr(); }
    else if (s.open) enviar(ficOf(s.open), files);
  },
  qrm(id) { const x = s.queue.find(q => q.id === id); if (x && x.url) URL.revokeObjectURL(x.url); s.queue = s.queue.filter(q => q.id !== id); rr(); },
  upT(inp) { const files = [...inp.files]; inp.value = ''; if (files.length) enviarTratadas(ficOf(s.open), files); },
  async status(v) {
    const i = imv(s.open); if (!i || v === (i.status || 'ativo')) return;
    if (v === 'ativo') return CAP.publicar();
    await guard(async () => { await db.patchImovel(i, { status: v }); await refresh(); msg(v === 'oculto' ? 'Imóvel oculto: saiu do site, mas o link do cliente continua funcionando.' : 'Imóvel marcado como vendido.'); });
    rr();
  },
  async publicar() {
    const i = imv(s.open); if (!i) return;
    if (!(await CAP.salvar(true))) return;
    const f = ficOf(i.id);
    if (!siteList(f.id, 'foto').length) { msg('!Marque ao menos uma foto com "No site" antes de publicar.'); return rr(); }
    await guard(async () => { await db.patchImovel(imv(i.id), { status: 'ativo' }); await refresh(); msg('Publicado no site.'); });
    rr();
  },
  async dest(id) { const i = imv(id); if (!i) return; await guard(async () => { await db.patchImovel(i, { destaque: !i.destaque }); await refresh(); }); rr(); },
  /* mídias */
  sel(id) { if (s.sel.has(id)) s.sel.delete(id); else s.sel.add(id); rr(); },
  selAll() { vis(ficOf(s.open).id).forEach(m => s.sel.add(m.id)); rr(); },
  limpaSel() { s.sel = new Set(); rr(); },
  async flag(id, k) {
    const m = s.mid.find(x => x.id === id); if (!m) return;
    await guard(async () => { const p = { [k]: !m[k] }; if (k === 'no_site' && !m.url) p.url = mUrl(m); await db.patchM(m, p); if (k === 'no_site') await syncSite(m.captacao_id); });
    rr();
  },
  async bulk(k, on) {
    const f = ficOf(s.open), L = vis(f.id).filter(m => s.sel.has(m.id));
    await guard(async () => { const sem = L.filter(m => !m.url); for (const m of sem) await db.patchM(m, { url: mUrl(m) }); await db.patchMany(L, { [k]: on }); if (k === 'no_site') await syncSite(f.id); });
    rr();
  },
  async bulkDel(b) {
    if (!confirmar(b, 'Excluir')) return;
    const f = ficOf(s.open), L = vis(f.id).filter(m => s.sel.has(m.id));
    await guard(async () => { busy('Excluindo…'); for (const m of L) await db.delM(m); s.sel = new Set(); await syncSite(f.id); busy(''); msg(L.length + ' arquivo(s) excluído(s).'); });
    rr();
  },
  async renum(f, lista) {   // grava a nova ordem (1..n) só onde mudou
    const ch = []; lista.forEach((m, n) => { if ((m.ordem || 0) !== n + 1) ch.push([m, n + 1]); });
    if (SB) await Promise.all(ch.map(([m, o]) => db.patchM(m, { ordem: o }))); else for (const [m, o] of ch) await db.patchM(m, { ordem: o });
  },
  async mover(id, dir) {
    const f = ficOf(s.open), L = vis(f.id), n = L.findIndex(m => m.id === id), j = n + dir; if (n < 0 || j < 0 || j >= L.length) return;
    [L[n], L[j]] = [L[j], L[n]];
    await guard(async () => { await CAP.renum(f, L); await syncSite(f.id); }); rr();
  },
  async capa(id) {
    const f = ficOf(s.open), L = vis(f.id), m = L.find(x => x.id === id); if (!m) return;
    L.splice(L.indexOf(m), 1); L.unshift(m);
    await guard(async () => { await CAP.renum(f, L); await db.patchM(m, { no_site: true, no_link: true, url: m.url || mUrl(m) }); await syncSite(f.id); msg('Foto definida como capa (e marcada No site).'); }); rr();
  },
  async rm(id, b) {
    if (!confirmar(b, '✕')) return;
    const m = s.mid.find(x => x.id === id); if (!m) return;
    await guard(async () => { await db.delM(m); s.sel.delete(id); await syncSite(m.captacao_id); }); rr();
  },
  ver(id) { const m = s.mid.find(x => x.id === id); if (m) CAP.zoomU(mUrl(m), m.tipo); },
  zoomU(u, tipo) {
    const d = document.createElement('div'); d.id = 'capzoom';
    d.innerHTML = tipo === 'video' ? `<video src="${esc(u)}" controls autoplay playsinline></video>` : `<img src="${esc(u)}" alt="">`;
    d.onclick = e => { if (e.target.tagName !== 'VIDEO') d.remove(); }; document.body.appendChild(d);
  },
  async baixar(id) {
    const m = s.mid.find(x => x.id === id); busy('Baixando…');
    try { const r = await fetch(mUrl(m)); saveBlob(await r.blob(), safeName(m.nome || 'arquivo')); busy(''); } catch (e) { busy(''); msg('!Não foi possível baixar: ' + e.message); rr(); }
  },
  async zip() {
    const f = ficOf(s.open), i = imv(s.open), md = midsOf(f.id), files = [], usados = {};
    try {
      let n = 0;
      for (const m of md) {
        busy(`Preparando ${++n} de ${md.length}…`);
        const r = await fetch(mUrl(m)); if (!r.ok) throw new Error('arquivo ' + (m.nome || n) + ' indisponível');
        let nome = (m.estado === 'tratada' ? 'tratadas/' : 'originais/') + safeName(m.nome || ('arquivo-' + n));
        if (usados[nome]) { const k = ++usados[nome]; nome = nome.replace(/(\.[^./]+)?$/, '-' + k + '$1'); } else usados[nome] = 1;
        files.push({ name: nome, data: new Uint8Array(await r.arrayBuffer()) });
      }
      files.push({ name: 'dados-do-imovel.txt', data: new TextEncoder().encode(resumo(i, f)) });
      busy('Montando o arquivo…'); saveBlob(makeZip(files), slug(tituloDe(i, f)) + '.zip'); busy(''); msg('ZIP pronto.');
    } catch (e) { busy(''); msg('!Não foi possível montar o ZIP: ' + e.message); }
    rr();
  },
  async copiar(id) {
    const i = imv(id || s.open); if (!i) return;
    let f; try { f = await db.ensureFic(i); } catch (e) { msg('!' + e.message); return rr(); }
    const u = shareUrl(f); try { await navigator.clipboard.writeText(u); msg('Link copiado: ' + u); } catch (e) { prompt('Copie o link:', u); } rr();
  },
  compartilhar() { const i = imv(s.open), f = ficOf(s.open); navigator.share({ title: tituloDe(i, f), text: 'Fotos e informações do imóvel:', url: shareUrl(f) }).catch(() => {}); },
  async excluir(b) {
    if (!confirmar(b, 'Excluir imóvel')) return;
    const i = imv(s.open);
    await guard(async () => { busy('Excluindo…'); await db.delImovel(i); s.open = null; s.form = null; busy(''); msg('Imóvel excluído.'); });
    goTop(); render();
  },
  async addEq() {
    const el = document.getElementById('capeq'), v = el ? el.value.trim().toLowerCase() : ''; if (!v) return;
    const { error } = await SB.from('corretores').insert({ email: v }); if (error) msg('!' + error.message); else { msg('Corretor adicionado.'); await db.load(); } rr();
  },
  async rmEq(email) { const { error } = await SB.from('corretores').delete().eq('email', email); if (error) msg('!' + error.message); else await db.load(); rr(); }
};
window.CAP = CAP;

/* ---------- ESTILO ---------- */
const st = document.createElement('style');
st.textContent = `.adm~.wfab{display:none}.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.g2 label{min-width:0;overflow-wrap:anywhere}
.up .btn{padding:12px 16px;letter-spacing:.14em}.up .btn.sm{padding:10px 12px}
.up{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;align-items:center}.up label{margin:0}.up input[type=file]{display:none}
.tt{font-weight:200;letter-spacing:.06em;text-transform:uppercase;margin:18px 0 4px;overflow-wrap:anywhere}
.pill{display:inline-block;font-size:10px!important;letter-spacing:.14em;text-transform:uppercase;padding:2px 8px;border:1px solid #6B625B;color:#B9AEA2!important;margin-top:4px;vertical-align:middle}
.pill.ativo{border-color:#d3c7ba;color:#d3c7ba!important}.pill.vendido{border-color:#8a4a44;color:#d9a29b!important}
.falta{color:#FF5A4F;font-size:14px;margin:12px 0 0}.ok{color:#9fc79a;font-size:13px;margin:12px 0 0}
.cnt{font-size:13px;color:#d3c7ba;margin:14px 0 0}.cnt b{font-weight:500}
.cm{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
@media(min-width:640px){.cm{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}}
.mt{border:1px solid #2e2d2b;background:#1a1816;padding:6px;min-width:0}.mt.sel{border-color:#d3c7ba;box-shadow:0 0 0 1px #d3c7ba}.mt.off .mi{opacity:.45}
.mi{position:relative;cursor:pointer}.mi img,.mi video{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#1a1a19}
.ck2{position:absolute;top:6px;right:6px;width:26px;height:26px;border:2px solid #EAE3DA;border-radius:50%;background:rgba(20,20,19,.5);color:#141413;font-size:15px;line-height:22px;text-align:center;font-weight:700}
.mt.sel .ck2{background:#d3c7ba;border-color:#d3c7ba}
.cv{position:absolute;top:6px;left:6px;width:34px;height:34px;border-radius:50%;border:1px solid #d3c7ba;background:rgba(20,20,19,.65);color:#d3c7ba;font-size:17px;line-height:1;padding:0;cursor:pointer}.cv.on{background:#d3c7ba;color:#141413}
.mi .tr,.mi .vd{position:absolute;left:6px;bottom:6px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;background:rgba(20,20,19,.75);color:#d3c7ba;padding:3px 6px}
.tg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.tg button{padding:11px 2px;font-size:11px;letter-spacing:.04em;border:1px solid #4a4743;background:none;color:#9A8573;cursor:pointer;min-height:40px}
.tg button.on{background:#d3c7ba;color:#141413;border-color:#d3c7ba;font-weight:600}
.ac{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:6px}
.ac button{padding:0;min-height:38px;font-size:15px;line-height:1;background:#1a1a19;border:1px solid #3a3937;cursor:pointer;color:#D3C7BB}
.selbar{position:sticky;bottom:10px;z-index:6;margin-top:12px;background:#2a2826;border:1px solid #d3c7ba;padding:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.selbar b{font-weight:500;font-size:13px;width:100%;color:#EAE3DA}.selbar button{padding:10px 12px;font-size:12px;background:#1a1a19;border:1px solid #6B625B;color:#EAE3DA;cursor:pointer;min-height:40px}.selbar button.x{border-color:#8a4a44;color:#d9a29b}
.thumbs .qv{width:84px;height:84px;border:1px solid #3a3937;font-size:10px;color:#9A8573;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px}
.ck{display:inline-flex;gap:8px;align-items:center;margin:0;padding:10px 12px;border:1px solid #3a3937;text-transform:none;letter-spacing:.02em;font-size:13px;cursor:pointer}
.ck input{width:auto;margin:0}.ckg{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.dtl{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px 26px;margin:22px 0;font-size:11px;letter-spacing:.14em;color:#9A8573;text-transform:uppercase}
.dtl b{display:block;color:#EAE3DA;font-weight:300;font-size:15px;letter-spacing:.03em;text-transform:none;margin-top:3px}
#capzoom{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
#capzoom img,#capzoom video{max-width:96vw;max-height:94vh;object-fit:contain}`;
document.head.appendChild(st);
})();
