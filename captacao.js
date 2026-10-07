/* ÁPICE IMÓVEIS — CAPTAÇÃO DE FOTOS, VÍDEOS E DADOS DO IMÓVEL
   Carregado pelo index.html. Usa as peças do site (SB, auth, store, render, ESC...). */
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
const FAM = { 'Casa': 'casa', 'Apartamento': 'apto', 'Cobertura': 'apto', 'Terreno': 'lote', 'Lote em condomínio': 'lote', 'Área para lotear': 'area', 'Prédio / comercial': 'comercial' };
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
const s = { list: [], mid: [], eq: [], loaded: false, loading: false, err: '', open: null, form: null, msg: '', busy: '', q: '', fil: '',
  pub: { token: null, data: null, err: '' } };
const cur = () => s.list.find(x => x.id === s.open);
const titulo = c => c.titulo || (c.tipo + ' em ' + (c.bairro || c.cidade || '—'));
const msg = t => { s.msg = t; };
function busy(t) { s.busy = t; const e = document.getElementById('capbusy'); if (e) e.textContent = t; }
function rr() { const y = window.scrollY; render(); window.scrollTo(0, y); }
const rid = () => Math.random().toString(36).slice(2, 10);
const ms = x => x ? new Date(x).getTime() : 0;
const mUrl = m => DEMO ? m.path : SB.storage.from(BUCKET).getPublicUrl(m.path).data.publicUrl;
const mapaUrl = c => safeUrl(c.mapa_url) || (c.lat != null && c.lng != null ? `https://www.google.com/maps?q=${c.lat},${c.lng}` : '');
const shareUrl = c => location.origin + location.pathname + '#/i/' + c.token;
const byOrd = (a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.criado > b.criado ? 1 : -1);
const midsOf = id => s.mid.filter(m => m.captacao_id === id).sort(byOrd);
const efetivas = id => midsOf(id).filter(m => m.estado === 'tratada' || !s.mid.some(t => t.original_id === m.id));
const pubM = (id, tipo) => midsOf(id).filter(m => m.publicar && m.tipo === tipo);
function ordered(id) {
  const all = midsOf(id), o = all.filter(m => m.estado === 'original'), r = [];
  for (const m of o) { r.push(m); all.filter(t => t.original_id === m.id).forEach(t => r.push(t)); }
  all.filter(t => t.estado === 'tratada' && !o.some(m => m.id === t.original_id)).forEach(t => r.push(t));
  return r;
}
const kindOf = f => { const t = f.type || ''; const e = (f.name.split('.').pop() || '').toLowerCase();
  if (t.startsWith('video') || ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(e)) return 'video';
  if (t.startsWith('image') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(e)) return 'foto';
  return null; };

/* ---------- DADOS (Supabase ou modo demonstração) ---------- */
const db = {
  async load() {
    if (SB) {
      const a = await SB.from('captacoes').select('*').order('criado', { ascending: false }); if (a.error) throw a.error;
      const b = await SB.from('midias').select('*').order('criado', { ascending: true }); if (b.error) throw b.error;
      s.list = a.data.map(r => ({ ...r, criado: ms(r.criado) })); s.mid = b.data.map(r => ({ ...r, criado: ms(r.criado) }));
      if (auth.admin) { const c = await SB.from('corretores').select('email').order('email'); s.eq = c.data || []; }
    } else { s.list = LS.get('apice_cap', []); s.mid = LS.get('apice_cap_m', []); }
  },
  async saveC(id, row) {
    if (SB) {
      const d = { ...row, atualizado: new Date().toISOString() };
      if (id) { const { error } = await SB.from('captacoes').update(d).eq('id', id); if (error) throw error; return id; }
      const { data, error } = await SB.from('captacoes').insert(d).select('id').single(); if (error) throw error; return data.id;
    }
    const a = LS.get('apice_cap', []);
    if (id) { const k = a.findIndex(x => x.id === id); a[k] = { ...a[k], ...row, atualizado: Date.now() }; }
    else { id = 'c' + Date.now(); a.unshift({ ...row, id, token: rid() + rid(), criado: Date.now(), atualizado: Date.now(), status: 'captado', corretor: 'demo' }); }
    if (!LS.set('apice_cap', a)) throw new Error('Armazenamento do navegador cheio (modo demonstração).');
    return id;
  },
  async patchC(c, p) {
    if (SB) { const { error } = await SB.from('captacoes').update(p).eq('id', c.id); if (error) throw error; Object.assign(c, p); return; }
    Object.assign(c, p); LS.set('apice_cap', s.list);
  },
  async delC(c) {
    const paths = s.mid.filter(m => m.captacao_id === c.id).map(m => m.path);
    if (SB) {
      if (paths.length) await SB.storage.from(BUCKET).remove(paths);
      const { error } = await SB.from('captacoes').delete().eq('id', c.id); if (error) throw error;
    } else { LS.set('apice_cap', s.list.filter(x => x.id !== c.id)); LS.set('apice_cap_m', s.mid.filter(m => m.captacao_id !== c.id)); }
    s.list = s.list.filter(x => x.id !== c.id); s.mid = s.mid.filter(m => m.captacao_id !== c.id);
  },
  async addM(cid, file, x) {
    x = x || {}; const tipo = kindOf(file);
    if (!tipo) throw new Error('não é foto nem vídeo');
    let path;
    if (SB) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      path = cid + '/' + Date.now() + '-' + rid() + '.' + ext;
      const { error } = await SB.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000' }); if (error) throw error;
    } else {
      if (file.size > 2.5 * 1024 * 1024) throw new Error('no modo demonstração use arquivos de até 2,5 MB');
      path = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    }
    const row = { captacao_id: cid, tipo, estado: x.estado || 'original', original_id: x.original_id || null, path, nome: file.name, publicar: !!x.publicar, ordem: x.ordem || 0 };
    if (SB) {
      const { data, error } = await SB.from('midias').insert(row).select('*').single();
      if (error) { await SB.storage.from(BUCKET).remove([path]); throw error; }
      const m = { ...data, criado: ms(data.criado) }; s.mid.push(m); return m;
    }
    row.id = 'm' + Date.now() + rid(); row.criado = Date.now(); s.mid.push(row);
    if (!LS.set('apice_cap_m', s.mid)) { s.mid.pop(); throw new Error('armazenamento do navegador cheio (modo demonstração)'); }
    return row;
  },
  async patchM(m, p) {
    if (SB) { const { error } = await SB.from('midias').update(p).eq('id', m.id); if (error) throw error; Object.assign(m, p); return; }
    Object.assign(m, p); LS.set('apice_cap_m', s.mid);
  },
  async delM(m) {
    const gone = [m, ...s.mid.filter(x => x.original_id === m.id)];
    if (SB) {
      await SB.storage.from(BUCKET).remove(gone.map(x => x.path));
      const { error } = await SB.from('midias').delete().eq('id', m.id); if (error) throw error;
    }
    s.mid = s.mid.filter(x => !gone.includes(x));
    if (!SB) LS.set('apice_cap_m', s.mid);
  }
};

/* ---------- ENVIO DE ARQUIVOS ---------- */
async function enviar(cid, files, x) {
  const arr = [...files]; let ok = 0; const bad = [];
  for (let n = 0; n < arr.length; n++) {
    busy(`Enviando ${n + 1} de ${arr.length}…`);
    const ex = typeof x === 'function' ? x(arr[n]) : (x || {}); let done = false, err;
    for (let t = 0; t < 2 && !done; t++) { try { await db.addM(cid, arr[n], ex); done = true; ok++; } catch (e) { err = e; } }
    if (!done) bad.push(arr[n].name + ' (' + ((err && err.message) || 'erro') + ')');
    else if (ex._o && ex._o.publicar) { try { await db.patchM(ex._o, { publicar: false }); } catch (e) {} }
  }
  busy(''); msg(bad.length ? '!Não enviou: ' + bad.join('; ') : `${ok} arquivo(s) enviado(s).`); rr();
}
const stem = n => n.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s*\(\d+\)$/, '').replace(/[\s_-]*(editad[ao]|tratad[ao]|edit|final|hdr|web)\d*$/, '');
function enviarTratadas(cid, files) {
  const orig = s.mid.filter(m => m.captacao_id === cid && m.estado === 'original');
  return enviar(cid, files, f => {
    const o = orig.find(m => stem(m.nome || '') === stem(f.name));
    return { estado: 'tratada', original_id: o ? o.id : null, publicar: o ? !!o.publicar : false, ordem: o ? o.ordem : 0, _o: o };
  });
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
function resumo(c) {
  const L = [titulo(c), c.tipo + ' · ' + [c.bairro, c.cidade].filter(Boolean).join(', '), c.preco ? 'Valor: R$ ' + Number(c.preco).toLocaleString('pt-BR') : 'Valor: sob consulta', ''];
  pairs(c.tipo, c.dados).forEach(([a, b]) => L.push(a + ': ' + b));
  const d = c.dados || {}; STD.forEach(k => { const f = fieldOf(c.tipo, k); if (f && d[k]) L.push(f.l + ': ' + fmt(f, d[k])); });
  if (c.descricao) L.push('', c.descricao);
  L.push('', '--- PARTICULAR (não divulgar) ---'); const p = c.privados || {};
  PRIV.forEach(f => { if (p[f.k]) L.push(f.l + ': ' + p[f.k]); });
  const m = mapaUrl(c); if (m) L.push('Localização: ' + m);
  L.push('Link do cliente: ' + shareUrl(c)); return L.join('\r\n');
}

/* ---------- TELAS DA EQUIPE ---------- */
function shell(body) {
  const tabs = `<div class="chips">${auth.admin ? `<button class="chip" onclick="adminTab='imoveis';render()">Imóveis (${imoveis.length})</button><button class="chip" onclick="adminTab='leads';loadLeads()">Contatos (${leads.length})</button>` : ''}<button class="chip on" onclick="CAP.home()">Captação</button><button class="chip" onclick="doLogout()">Sair</button></div>`;
  return `<div class="adm"><button class="back" onclick="go('')">← Ver o site</button><p class="eyebrow">Acesso restrito</p><h1>Captação</h1>${DEMO ? '<div class="demo"><b>Modo demonstração:</b> tudo fica só neste navegador (arquivos de até 2,5 MB).</div>' : ''}${tabs}${s.msg ? `<div class="msg ${s.msg[0] === '!' ? 'e' : ''}">${esc(s.msg.replace(/^!/, ''))}</div>` : ''}<div class="msg" id="capbusy">${esc(s.busy)}</div>${body}</div>`;
}
function page() {
  if (!s.loaded && !s.loading && !s.err) {
    s.loading = true;
    db.load().then(() => { s.loaded = true; }).catch(e => { s.err = (e && e.message) || 'erro'; }).finally(() => { s.loading = false; render(); });
  }
  if (s.err) return shell(`<div class="msg e">Não foi possível abrir a captação: ${esc(s.err)}. Se for a primeira vez, rode o arquivo <b>schema-captacao.sql</b> no Supabase.</div><div style="margin-top:14px"><button class="btn o sm" onclick="CAP.retry()">Tentar de novo</button></div>`);
  if (!s.loaded) return shell('<div class="empty">Carregando…</div>');
  return shell(s.form ? formView() : s.open ? detView() : listView());
}
function listRow(c) {
  const ms_ = midsOf(c.id), cv = efetivas(c.id).find(m => m.tipo === 'foto');
  const nf = ms_.filter(m => m.tipo === 'foto' && m.estado === 'original').length, nv = ms_.filter(m => m.tipo === 'video').length;
  return `<div class="row" style="cursor:pointer" onclick="CAP.abrir('${esc(c.id)}')"><div class="th" style="${cv ? `background-image:url('${esc(mUrl(cv))}')` : ''}"></div><div class="i"><b>${esc(titulo(c))}</b><span>${esc(c.tipo)} · ${esc([c.bairro, c.cidade].filter(Boolean).join(', '))} · ${c.preco ? money(c.preco) : 'Sob consulta'}<br>${nf} foto(s) · ${nv} vídeo(s)${c.status === 'publicado' ? ' · <b style="color:#D9AE7C;font-weight:400">No site</b>' : ''}</span></div></div>`;
}
function listBody() {
  const q = s.q.toLowerCase();
  const L = s.list.filter(c => (!s.fil || c.status === s.fil) && (!q || [c.titulo, c.cidade, c.bairro, c.tipo].join(' ').toLowerCase().includes(q)));
  return L.length ? L.map(listRow).join('') : '<div class="empty">Nenhuma captação encontrada.</div>';
}
function listView() {
  const eq = (auth.admin && SB) ? `<div class="box"><h2 style="font-size:20px">Equipe de corretores</h2><p class="sub">Corretores cadastram imóveis e enviam fotos, mas só os proprietários publicam no site. Antes de adicionar, crie o usuário em Supabase &gt; Authentication &gt; Users.</p>${s.eq.map(e => `<div class="row"><div class="i"><b>${esc(e.email)}</b></div><button class="btn d sm" onclick="CAP.rmEq('${esc(e.email)}')">Remover</button></div>`).join('')}<div class="two"><label>E-mail do corretor<input id="capeq" type="email" autocomplete="off"></label><div style="align-self:end"><button class="btn sm" onclick="CAP.addEq()">Adicionar</button></div></div></div>` : '';
  return `<div style="margin-top:20px"><button class="btn" onclick="CAP.novo()">+ Nova captação</button></div>
  <div class="note">Cadastre o imóvel, envie fotos e vídeos direto do celular e mande o link ao cliente.</div>
  <div class="chips" style="margin-top:16px">${[['', 'Todas'], ['captado', 'Só captadas'], ['publicado', 'No site']].map(([v, n]) => `<button class="chip ${s.fil === v ? 'on' : ''}" onclick="CAP.filtro('${v}')">${n}</button>`).join('')}</div>
  <input placeholder="Buscar por cidade, bairro ou tipo" value="${esc(s.q)}" oninput="CAP.busca(this.value)">
  <div id="caplist" style="margin-top:10px">${listBody()}</div>${eq}`;
}
function fieldHtml(f) {
  const v = s.form.dados[f.k], v2 = s.form.privados[f.k], cl = x => `oninput="CAP.set('${x}','${f.k}',this.value)"`;
  if (f.t === 'n') return `<label>${f.l}${f.u ? ' (' + f.u + ')' : ''}<input inputmode="decimal" value="${esc(v)}" ${cl('dados')}></label>`;
  if (f.t === 'm') return `<label>${f.l} (R$)<input inputmode="numeric" value="${esc(v)}" ${cl('dados')}></label>`;
  if (f.t === 's') return `<label>${f.l}<select onchange="CAP.set('dados','${f.k}',this.value)"><option value="">—</option>${f.o.map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<label>${f.l}<input value="${esc(v)}" ${cl('dados')}></label>`;
}
function formView() {
  const f = s.form, fs = fields(f.tipo), grid = fs.filter(x => x.t !== 'c'), checks = fs.filter(x => x.t === 'c');
  const inp = (k, l, ex) => `<label>${l}<input ${ex || ''} value="${esc(f[k])}" oninput="CAP.set('f','${k}',this.value)"></label>`;
  const loc = f.lat != null && f.lng != null ? `Localização salva (${f.lat}, ${f.lng}) · <a target="_blank" rel="noopener" style="color:#D9AE7C" href="https://www.google.com/maps?q=${f.lat},${f.lng}">conferir no mapa</a>` : 'Nenhuma localização salva ainda.';
  return `<div style="margin-top:16px"><button class="btn o sm" onclick="CAP.cancelar()">← Cancelar</button></div><h2 style="font-weight:200;letter-spacing:.08em;text-transform:uppercase;margin:18px 0 0">${f.id ? 'Editar imóvel' : 'Novo imóvel'}</h2>
  <div class="box" style="margin-top:12px"><label style="margin-top:0">Tipo de imóvel</label><div class="chips" style="margin-top:8px">${TIPOS.map(t => `<button class="chip ${f.tipo === t ? 'on' : ''}" onclick="CAP.tipo('${t}')">${t}</button>`).join('')}</div>
  <div class="two">${inp('cidade', 'Cidade')}${inp('bairro', 'Bairro')}</div><div class="two">${inp('preco', 'Valor (R$) · vazio = sob consulta', 'inputmode="numeric"')}${inp('titulo', 'Título (opcional)')}</div>
  <label>Localização</label><div class="note" style="margin-top:8px">${loc}</div>
  <div style="margin-top:10px"><button class="btn o sm" onclick="CAP.gps()">Usar minha localização agora</button></div>
  ${inp('mapa_url', 'Ou cole o link do Google Maps', 'inputmode="url"')}
  <label class="ck" style="margin-top:12px"><input type="checkbox" ${f.mostrar_mapa ? 'checked' : ''} onchange="CAP.set('f','mostrar_mapa',this.checked)"> Mostrar o botão "Ver no mapa" para o cliente e no site</label></div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Dados do imóvel · ${esc(f.tipo)}</label><div class="two">${grid.map(fieldHtml).join('')}</div>
  ${checks.map(c => `<label>${c.l}</label><div class="ckg">${c.o.map((o, i) => `<label class="ck"><input type="checkbox" ${(f.dados[c.k] || []).includes(o) ? 'checked' : ''} onchange="CAP.tog('${c.k}',${i},this.checked)"> ${esc(o)}</label>`).join('')}</div>`).join('')}
  <label>Descrição<textarea oninput="CAP.set('f','descricao',this.value)">${esc(f.descricao)}</textarea></label></div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Particular · só a equipe vê (nunca vai para o cliente nem para o site)</label>
  ${PRIV.map(x => x.t === 'x' ? `<label>${x.l}<textarea oninput="CAP.set('privados','${x.k}',this.value)">${esc(f.privados[x.k])}</textarea></label>` : `<label>${x.l}<input value="${esc(f.privados[x.k])}" oninput="CAP.set('privados','${x.k}',this.value)"></label>`).join('')}</div>
  <div style="margin-top:16px"><button class="btn" onclick="CAP.salvar()">${f.id ? 'Salvar' : 'Salvar e adicionar fotos'}</button></div>`;
}
function mediaCard(m) {
  const u = esc(mUrl(m)), id = esc(m.id);
  const el = m.tipo === 'foto' ? `<img src="${u}" loading="lazy" alt="" onclick="CAP.zoomM('${id}')">` : `<video src="${u}#t=0.1" controls preload="metadata" playsinline></video>`;
  return `<div>${el}<div class="bd ${m.estado === 'tratada' ? 't' : ''}">${m.estado === 'tratada' ? 'Tratada' : 'Original'}${m.tipo === 'video' ? ' · vídeo' : ''}</div>
  ${auth.admin ? `<label class="ck" style="margin:4px 0"><input type="checkbox" ${m.publicar ? 'checked' : ''} onchange="CAP.marca('${id}',this.checked)"> No site</label>` : ''}
  <div class="ac"><button onclick="CAP.baixar('${id}')">Baixar</button>${m.estado === 'original' ? `<label class="bt">Tratada<input type="file" accept="image/*,video/*" onchange="CAP.upT1('${id}',this)"></label>` : ''}${auth.admin && m.tipo === 'foto' && m.publicar ? `<button onclick="CAP.capa('${id}')">Capa</button>` : ''}<button onclick="CAP.rm('${id}',this)">Remover</button></div></div>`;
}
function detView() {
  const c = cur(); if (!c) { s.open = null; return listView(); }
  const u = shareUrl(c), md = ordered(c.id), mp = mapaUrl(c), p = c.privados || {};
  const priv = PRIV.filter(x => p[x.k]).map(x => [x.l, p[x.k]]);
  const np = pubM(c.id, 'foto').length, nvp = pubM(c.id, 'video').length;
  const cats = Object.keys(CATS).filter(k => CATS[k].tipos.includes(c.tipo));
  const pubBox = auth.admin ? `<div class="box" style="margin-top:14px"><label style="margin-top:0">Publicar no site</label><p class="sub" style="margin-top:8px">Marque "No site" nas fotos e vídeos que devem aparecer (de preferência as tratadas). Marcados agora: ${np} foto(s) e ${nvp} vídeo(s).</p>
  <div class="up">${cats.length > 1 ? `<select id="capcat" style="width:auto;margin:0">${cats.map(k => `<option value="${k}">Seção ${CATS[k].n}</option>`).join('')}</select>` : `<input type="hidden" id="capcat" value="${cats[0] || 'morar'}">`}<button class="btn" onclick="CAP.publicar()">${c.status === 'publicado' ? 'Atualizar no site' : 'Publicar no site'}</button><button class="btn o" onclick="CAP.todas(true)">Marcar todas as fotos</button><button class="btn o" onclick="CAP.todas(false)">Desmarcar</button>${c.status === 'publicado' ? `<button class="btn d" onclick="CAP.tirar()">Tirar do site</button>` : ''}</div>${c.status === 'publicado' && c.imovel_id ? `<a class="btn o sm" href="#/imovel/${esc(c.imovel_id)}">Ver no site</a>` : ''}</div>` : '';
  return `<div style="margin-top:16px"><button class="btn o sm" onclick="CAP.fechar()">← Todas as captações</button></div>
  <h2 style="font-weight:200;letter-spacing:.06em;text-transform:uppercase;margin:18px 0 4px">${esc(titulo(c))}</h2>
  <div class="sub" style="margin:0">${esc(c.tipo)} · ${esc([c.bairro, c.cidade].filter(Boolean).join(', '))} · ${c.preco ? money(c.preco) : 'Sob consulta'}${c.status === 'publicado' ? ' · No site' : ''}</div>
  <div class="up"><label class="btn">Tirar foto<input type="file" accept="image/*" capture="environment" onchange="CAP.up(this)"></label><label class="btn">Gravar vídeo<input type="file" accept="video/*" capture="environment" onchange="CAP.up(this)"></label><label class="btn o">Da galeria<input type="file" accept="image/*,video/*" multiple onchange="CAP.up(this)"></label></div>
  <div class="box" style="margin-top:14px"><label style="margin-top:0">Link para o cliente</label><input readonly value="${esc(u)}" onclick="this.select()">
  <div class="up"><button class="btn sm" onclick="CAP.copiar()">Copiar link</button><a class="btn sm o" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Olá! Veja as fotos e as informações do imóvel: ' + u)}">Enviar no WhatsApp</a>${navigator.share ? `<button class="btn sm o" onclick="CAP.compartilhar()">Compartilhar</button>` : ''}<a class="btn sm o" target="_blank" rel="noopener" href="${esc(u)}">Abrir</a></div></div>
  <div class="up"><button class="btn o sm" onclick="CAP.editar()">Editar dados</button><button class="btn o sm" onclick="CAP.zip()">Baixar tudo (ZIP)</button><label class="btn o sm">Enviar tratadas<input type="file" accept="image/*,video/*" multiple onchange="CAP.upT(this)"></label>${mp ? `<a class="btn o sm" target="_blank" rel="noopener" href="${esc(mp)}">Ver no mapa</a>` : ''}${auth.admin ? `<button class="btn d sm" onclick="CAP.excluir(this)">Excluir</button>` : ''}</div>
  <div class="note">Para tratar no computador: baixe o ZIP, edite e depois use "Enviar tratadas" (mantenha o nome do arquivo que o sistema liga cada tratada à sua original).</div>
  ${dtl(pairs(c.tipo, c.dados, c.bairro))}${c.descricao ? `<div class="dd" style="white-space:pre-line;color:#B9AEA2;line-height:1.8;font-size:14px">${esc(c.descricao)}</div>` : ''}
  ${priv.length ? `<label>Particular</label>${dtl(priv)}` : ''}
  <div class="cm">${md.length ? md.map(mediaCard).join('') : '<div class="empty" style="grid-column:1/-1">Ainda sem fotos ou vídeos. Use os botões acima.</div>'}</div>${pubBox}`;
}

/* ---------- PÁGINA DO CLIENTE (#/i/código) ---------- */
async function loadPub(token) {
  try {
    let d;
    if (SB) {
      const r = await SB.rpc('captacao_publica', { p_token: token }); if (r.error) throw r.error; d = r.data;
      if (d) d.midias = (d.midias || []).map(m => ({ tipo: m.tipo, url: SB.storage.from(BUCKET).getPublicUrl(m.path).data.publicUrl }));
    } else {
      const c = LS.get('apice_cap', []).find(x => x.token === token), mm = LS.get('apice_cap_m', []);
      if (c) {
        const md = mm.filter(m => m.captacao_id === c.id).sort(byOrd).filter(m => m.estado === 'tratada' || !mm.some(t => t.original_id === m.id));
        d = { ...c, mapa: c.mostrar_mapa ? mapaUrl(c) : null, midias: md.map(m => ({ tipo: m.tipo, url: m.path })) };
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
  const i = p.data, md = i.midias || [], t = titulo(i), mp = safeUrl(i.mapa);
  return `<div class="det"><p class="eyebrow">${esc(i.tipo)} · ${esc([i.bairro, i.cidade].filter(Boolean).join(', '))}</p><h1>${esc(t)}</h1><div class="pc">${money(i.preco)}</div>
  ${specs(i.tipo, i.dados)}${dtl(pairs(i.tipo, i.dados, i.bairro))}${mp ? `<p><a class="btn o" target="_blank" rel="noopener" href="${esc(mp)}">Ver localização no mapa</a></p>` : ''}
  <div class="gal">${md.filter(m => m.tipo === 'video').map(m => `<video controls playsinline preload="metadata" src="${esc(m.url)}"></video>`).join('')}${md.filter(m => m.tipo === 'foto').map(m => `<img loading="lazy" src="${esc(m.url)}" alt="" style="cursor:zoom-in" onclick="CAP.zoomU(this.src)">`).join('')}</div>
  <div class="dw"><div class="dd">${esc(i.descricao)}</div><div><form class="box" style="margin:0" onsubmit="return sendLead(event,'interesse','${esc(p.token)}','${esc(t).replace(/'/g, '')}')"><b style="font-weight:400;letter-spacing:.15em;font-size:11px;text-transform:uppercase;color:#EAE3DA">Quero saber mais</b><label>Nome<input name="nome" required></label><label>WhatsApp<input name="tel" type="tel" inputmode="tel" required></label><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Enviar</button><a class="btn o" target="_blank" rel="noopener" href="${wa('Olá! Tenho interesse em: ' + t)}">WhatsApp</a></div><div class="msg"></div></form></div></div></div>${foot()}`;
}

/* ---------- AÇÕES ---------- */
function detalhesSite(c) {
  const o = {}; pairs(c.tipo, c.dados, c.bairro).forEach(([a, b]) => { o[a] = b; });
  const m = c.mostrar_mapa ? mapaUrl(c) : ''; if (m) o._mapa = m; return o;
}
const CAP = {
  page, publico,
  det(i) { const d = i.detalhes || {}, ks = Object.keys(d).filter(k => k[0] !== '_'), m = safeUrl(d._mapa);
    return dtl(ks.map(k => [k, d[k]])) + (m ? `<p><a class="btn o" target="_blank" rel="noopener" href="${esc(m)}">Ver localização no mapa</a></p>` : ''); },
  retry() { s.err = ''; s.loaded = false; render(); },
  home() { s.open = null; s.form = null; msg(''); render(); },
  abrir(id) { s.open = id; msg(''); window.scrollTo(0, 0); render(); },
  fechar() { s.open = null; msg(''); render(); },
  filtro(v) { s.fil = v; rr(); },
  busca(v) { s.q = v; const e = document.getElementById('caplist'); if (e) e.innerHTML = listBody(); },
  novo() { s.form = { tipo: 'Casa', titulo: '', cidade: '', bairro: '', preco: '', descricao: '', lat: null, lng: null, mapa_url: '', mostrar_mapa: true, dados: {}, privados: {} }; msg(''); window.scrollTo(0, 0); render(); },
  editar() { const c = cur(); s.form = JSON.parse(JSON.stringify({ ...c, preco: c.preco || '', mapa_url: c.mapa_url || '', dados: c.dados || {}, privados: c.privados || {} })); msg(''); window.scrollTo(0, 0); render(); },
  cancelar() { s.form = null; msg(''); render(); },
  tipo(t) { s.form.tipo = t; rr(); },
  set(g, k, v) { if (g === 'f') s.form[k] = v; else s.form[g][k] = v; },
  tog(k, i, on) { const f = fieldOf(s.form.tipo, k), x = f.o[i], a = s.form.dados[k] || (s.form.dados[k] = []), n = a.indexOf(x); if (on && n < 0) a.push(x); if (!on && n >= 0) a.splice(n, 1); },
  gps() {
    if (!navigator.geolocation) { msg('!Este aparelho não permite pegar a localização.'); return rr(); }
    busy('Buscando localização…');
    navigator.geolocation.getCurrentPosition(p => { s.form.lat = +p.coords.latitude.toFixed(6); s.form.lng = +p.coords.longitude.toFixed(6); busy(''); msg('Localização salva.'); rr(); },
      () => { busy(''); msg('!Não foi possível pegar a localização. Permita o acesso à localização no navegador e tente de novo.'); rr(); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  },
  async salvar() {
    const f = s.form, d = {};
    if (!String(f.cidade).trim()) { msg('!Informe a cidade.'); return rr(); }
    for (const x of fields(f.tipo)) {
      let v = f.dados[x.k];
      if (x.t === 'n') { v = String(v == null ? '' : v).replace(',', '.').replace(/[^0-9.]/g, ''); v = v === '' ? null : Number(v); }
      else if (x.t === 'm') v = Number(String(v == null ? '' : v).replace(/\D/g, '')) || null;
      else if (x.t === 'c') v = (v || []).length ? v : null;
      else v = v || null;
      if (v != null && !Number.isNaN(v)) d[x.k] = v;
    }
    const pv = {}; PRIV.forEach(x => { const v = String(f.privados[x.k] || '').trim(); if (v) pv[x.k] = v; });
    const row = { tipo: f.tipo, titulo: String(f.titulo || '').trim() || null, cidade: String(f.cidade).trim(), bairro: String(f.bairro || '').trim() || null,
      preco: Number(String(f.preco).replace(/\D/g, '')) || null, descricao: String(f.descricao || '').trim() || null,
      lat: f.lat == null ? null : f.lat, lng: f.lng == null ? null : f.lng, mapa_url: safeUrl(f.mapa_url) || null, mostrar_mapa: !!f.mostrar_mapa, dados: d, privados: pv };
    try { const id = await db.saveC(f.id, row); await db.load(); s.form = null; s.open = id; msg(f.id ? 'Dados salvos.' : 'Imóvel cadastrado. Agora envie as fotos e vídeos.'); }
    catch (e) { msg('!Erro ao salvar: ' + (e.message || '')); }
    window.scrollTo(0, 0); render();
  },
  up(inp) { const f = [...inp.files]; inp.value = ''; if (f.length) enviar(s.open, f, {}); },
  upT(inp) { const f = [...inp.files]; inp.value = ''; if (f.length) enviarTratadas(s.open, f); },
  upT1(id, inp) {
    const f = [...inp.files]; inp.value = ''; const o = s.mid.find(m => m.id === id); if (!f.length || !o) return;
    enviar(o.captacao_id, f, { estado: 'tratada', original_id: o.id, publicar: !!o.publicar, ordem: o.ordem, _o: o });
  },
  async marca(id, on) { const m = s.mid.find(x => x.id === id); try { await db.patchM(m, { publicar: on }); } catch (e) { msg('!' + e.message); } rr(); },
  async todas(on) {
    try { for (const m of efetivas(s.open).filter(x => x.tipo === 'foto')) await db.patchM(m, { publicar: on });
      if (!on) for (const m of midsOf(s.open).filter(x => x.publicar)) await db.patchM(m, { publicar: false }); }
    catch (e) { msg('!' + e.message); } rr();
  },
  async capa(id) { const m = s.mid.find(x => x.id === id); const mn = Math.min(0, ...midsOf(m.captacao_id).map(x => x.ordem || 0)) - 1; try { await db.patchM(m, { ordem: mn }); msg('Foto definida como capa.'); } catch (e) { msg('!' + e.message); } rr(); },
  async rm(id, b) {
    if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Confirmar?'; setTimeout(() => { if (b.isConnected) { b.dataset.s = ''; b.textContent = 'Remover'; } }, 4000); return; }
    try { await db.delM(s.mid.find(x => x.id === id)); } catch (e) { msg('!' + e.message); } rr();
  },
  async excluir(b) {
    if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Confirmar?'; setTimeout(() => { if (b.isConnected) { b.dataset.s = ''; b.textContent = 'Excluir'; } }, 4000); return; }
    try { await db.delC(cur()); s.open = null; msg('Captação excluída.'); } catch (e) { msg('!' + e.message); } window.scrollTo(0, 0); render();
  },
  async baixar(id) {
    const m = s.mid.find(x => x.id === id); busy('Baixando…');
    try { const r = await fetch(mUrl(m)); saveBlob(await r.blob(), safeName(m.nome || 'arquivo')); busy(''); } catch (e) { busy(''); msg('!Não foi possível baixar: ' + e.message); rr(); }
  },
  async zip() {
    const c = cur(), md = ordered(c.id), files = [], usados = {};
    try {
      let n = 0;
      for (const m of md) {
        busy(`Preparando ${++n} de ${md.length}…`);
        const r = await fetch(mUrl(m)); if (!r.ok) throw new Error('arquivo ' + (m.nome || n) + ' indisponível');
        let nome = (m.estado === 'tratada' ? 'tratadas/' : 'originais/') + safeName(m.nome || ('arquivo-' + n));
        if (usados[nome]) { const k = ++usados[nome]; nome = nome.replace(/(\.[^./]+)?$/, '-' + k + '$1'); } else usados[nome] = 1;
        files.push({ name: nome, data: new Uint8Array(await r.arrayBuffer()) });
      }
      files.push({ name: 'dados-do-imovel.txt', data: new TextEncoder().encode(resumo(c)) });
      busy('Montando o arquivo…'); saveBlob(makeZip(files), slug(titulo(c)) + '.zip'); busy(''); msg('ZIP pronto.');
    } catch (e) { busy(''); msg('!Não foi possível montar o ZIP: ' + e.message); }
    rr();
  },
  async copiar() { const u = shareUrl(cur()); try { await navigator.clipboard.writeText(u); msg('Link copiado.'); } catch (e) { prompt('Copie o link:', u); } rr(); },
  compartilhar() { const c = cur(); navigator.share({ title: titulo(c), text: 'Fotos e informações do imóvel:', url: shareUrl(c) }).catch(() => {}); },
  zoomM(id) { CAP.zoomU(mUrl(s.mid.find(x => x.id === id))); },
  zoomU(u) { const d = document.createElement('div'); d.id = 'capzoom'; d.innerHTML = `<img src="${esc(u)}" alt="">`; d.onclick = () => d.remove(); document.body.appendChild(d); },
  async publicar() {
    const c = cur(), ph = pubM(c.id, 'foto'), vd = pubM(c.id, 'video');
    if (!ph.length) { msg('!Marque ao menos uma foto com "No site".'); return rr(); }
    const el = document.getElementById('capcat'), cat = (el && el.value) || 'morar', dd = c.dados || {}, rep = c.status !== 'publicado';
    const d = { categoria: cat, tipo: c.tipo, titulo: titulo(c), cidade: c.cidade || '', preco: c.preco || 0, area: dd.area || null, quartos: dd.quartos || null,
      suites: dd.suites || null, vagas: dd.vagas || null, descricao: c.descricao || '', fotos: ph.map(mUrl), videos: vd.map(mUrl), detalhes: detalhesSite(c) };
    try {
      let id = c.imovel_id;
      if (SB) {
        if (id) { const { error } = await SB.from('imoveis').update(rep ? { ...d, status: 'ativo' } : d).eq('id', id); if (error) throw error; }
        else { const { data, error } = await SB.from('imoveis').insert({ ...d, destaque: false, status: 'ativo' }).select('id').single(); if (error) throw error; id = data.id; }
      } else {
        const all = await store.list(), ex = id && all.find(x => x.id === id);
        if (ex) await store.save({ ...ex, ...d, status: rep ? 'ativo' : ex.status }); else { const it = { ...d, destaque: false, status: 'ativo' }; await store.save(it); id = it.id; }
      }
      await db.patchC(c, { status: 'publicado', imovel_id: id }); await refresh(); msg('Publicado no site.');
    } catch (e) { msg('!Erro ao publicar: ' + (e.message || '') + (/detalhes/.test(e.message || '') ? ' (rode o schema-captacao.sql no Supabase)' : '')); }
    rr();
  },
  async tirar() {
    const c = cur();
    try {
      if (c.imovel_id) { if (SB) { const { error } = await SB.from('imoveis').update({ status: 'oculto' }).eq('id', c.imovel_id); if (error) throw error; } else await store.patch(c.imovel_id, { status: 'oculto' }); }
      await db.patchC(c, { status: 'captado' }); await refresh(); msg('Imóvel retirado do site (continua guardado aqui).');
    } catch (e) { msg('!' + (e.message || '')); }
    rr();
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
st.textContent = `.up{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;align-items:center}.up label{margin:0}.up input[type=file]{display:none}
.cm{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:16px}
.cm>div{border:1px solid #2E2A27;background:#13110f;padding:6px}
.cm img,.cm video{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#1a1816;cursor:zoom-in}
.cm .bd{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#9A8573;margin:6px 0 2px}.cm .bd.t{color:#D9AE7C}
.cm .ac{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.cm .ac button,.cm .ac .bt{font-size:10px;padding:5px 7px;background:#1a1816;border:1px solid #3a3632;cursor:pointer;color:#D3C7BB;margin:0;letter-spacing:.04em;text-transform:none;display:inline-block}
.cm .ac input{display:none}
.ck{display:inline-flex;gap:8px;align-items:center;margin:0;padding:8px 10px;border:1px solid #3a3632;text-transform:none;letter-spacing:.02em;font-size:13px;cursor:pointer}
.ck input{width:auto;margin:0}.ckg{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.dtl{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px 26px;margin:22px 0;font-size:11px;letter-spacing:.14em;color:#9A8573;text-transform:uppercase}
.dtl b{display:block;color:#EAE3DA;font-weight:300;font-size:15px;letter-spacing:.03em;text-transform:none;margin-top:3px}
#capzoom{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
#capzoom img{max-width:96vw;max-height:94vh;object-fit:contain}`;
document.head.appendChild(st);
})();
