// EstudioPsi — app.js v8 (pendientes por materia, examen finalizado, próximo contador)
const BASE = 'https://script.google.com/macros/s/AKfycbwQf3mhtBe3n3dMmtr31Zh_aq-xRUY2TebRKS8AJ0msrRJtvjcf2J7Wy7063iMmCzDl/exec';
const CFG = { 
  GB: BASE+'?hoja=Bibliografia', 
  GC: BASE+'?hoja=Clases',
  GE: BASE+'?hoja=Examenes',
  P: BASE, HB:'Bibliografia', HC:'Clases' 
};

const S = {
  biblio:[], clases:[],
  mats_biblio:[],
  mats_clases:[],
  sec:'biblio',
  fmb:'todas', ftb:'todos', feb:'todos',
  fmc:'todas', ftc:'todos',
  tipo:'Teórica', prev:null,
  unidades_abiertas: new Set(),
  examenes: JSON.parse(localStorage.getItem('ep_examenes')||'[]'),
  _exEditId: null,
  _mostrarFinalizados: false,   // ← nuevo
};

const $   = id => document.getElementById(id);
const hoy = () => new Date().toISOString().split('T')[0];
const fmtF = f => {
  if(!f) return '';
  try{
    const d = new Date(f.includes('T') ? f : f+'T12:00:00');
    if(isNaN(d)) return f;
    return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  }catch(e){return f;}
};
const bc  = e => ({'Leído':'b-ok','Salteado':'b-sk','No va':'b-nv','Pendiente':'b-pe'}[e]||'b-sl');
const C   = {
  set:(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v));}catch(e){}},
  get:(k)=>{try{const d=sessionStorage.getItem(k);return d?JSON.parse(d):null;}catch(e){return null;}}
};

function abr(m) {
  if (!m) return '';
  const words = m.trim().split(/\s+/);
  if (words.length <= 2) return m;
  const stop = new Set(['Y','DE','DEL','LA','LAS','LOS','EL','EN','A','E']);
  const sig = words.filter(w => !stop.has(w.toUpperCase()));
  return sig.slice(0,2).join(' ');
}

let _tt;
function toast(m,ms=2600){ const e=$('toast');if(!e)return;clearTimeout(_tt);e.textContent=m;e.classList.add('show');_tt=setTimeout(()=>e.classList.remove('show'),ms); }
function sync(s,l=''){ const d=$('syncDot'),t=$('syncLabel');if(!d||!t)return;d.className='sync-dot'+(s==='s'?' s':s==='e'?' e':'');t.textContent=l; }
function empt(ic,t,s){ return `<div class="empty"><div class="empty-icon">${ic}</div><p class="empty-title">${t}</p><p class="empty-sub">${s}</p></div>`; }

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const fi=$('form-fecha'); if(fi) fi.value=hoy();
  const cb=C.get('ep_biblio'), cc=C.get('ep_clases');
  if(Array.isArray(cb)&&cb.length){ S.biblio=cb; buildMats(); renderBiblio(); }
  else { const tc=$('textos-container');if(tc)tc.innerHTML='<div style="padding:3rem 0;text-align:center;"><div class="spin"></div></div>'; }
  if(Array.isArray(cc)&&cc.length){ S.clases=cc; buildMatClases(); renderClases(); }
  else { const cc2=$('clases-container');if(cc2)cc2.innerHTML='<div style="padding:3rem 0;text-align:center;"><div class="spin"></div></div>'; }
  sync('s','Conectando...');
  fetchB(); fetchC(); fetchExamenes();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
});

// ── FETCH ──────────────────────────────────────────────────────
async function fetchB(){
  sync('s','Cargando...');
  try{
    const r = await fetch(CFG.GB);
    const txt = await r.text();
    let d;
    try { d=JSON.parse(txt); } catch(e){ throw new Error('No JSON: '+txt.slice(0,80)); }
    if(!Array.isArray(d)) throw new Error('No es array: '+JSON.stringify(d).slice(0,80));
    S.biblio=d; C.set('ep_biblio',d);
    buildMats(); renderBiblio();
    sync('', d.length+' textos');
  }catch(e){
    console.warn('fetchB:',e.message);
    sync('e', S.biblio.length ? S.biblio.length+' (caché)' : 'Sin conexión');
    if(!S.biblio.length){ const tc=$('textos-container'); if(tc)tc.innerHTML=empt('📡','Sin datos','Verificá que el Apps Script esté publicado y la hoja "Bibliografia" tenga los encabezados correctos.'); }
  }
}
async function fetchC(){
  try{
    const r=await fetch(CFG.GC);
    const txt=await r.text();
    let d; try{d=JSON.parse(txt);}catch(e){throw new Error('No JSON');}
    if(!Array.isArray(d)) throw new Error('No array');
    S.clases=d; C.set('ep_clases',d);
    buildMatClases(); renderClases(); updateClaseDD();
  }catch(e){
    console.warn('fetchC:',e.message);
    if(!S.clases.length){ const cc=$('clases-container');if(cc)cc.innerHTML=empt('🎓','Sin clases','Cargá la primera desde ＋ Clase.'); }
  }
}
function reloadData(){ toast('Actualizando...'); fetchB(); fetchC(); }
window.addEventListener('online',()=>{ toast('Conexión restaurada'); reloadData(); });

// ── MATERIAS DINÁMICAS ─────────────────────────────────────────
function buildMats(){
  S.mats_biblio = [...new Set(S.biblio.map(t=>t.materia).filter(Boolean))].sort();
  renderChips('chips-biblio','biblio');
  renderStats();
  populateMatForm();
}
function buildMatClases(){
  S.mats_clases = [...new Set(S.clases.map(c=>c.materia).filter(Boolean))].sort();
  renderChips('chips-clases','clases');
}

function renderChips(cid, sec){
  const el=$(cid); if(!el) return;
  const mats = sec==='biblio' ? S.mats_biblio : S.mats_clases;
  const activa = sec==='biblio' ? S.fmb : S.fmc;
  if(!mats.length){
    el.innerHTML=`<span style="font-size:.75rem;color:var(--text3);">Cargá bibliografía para ver las materias</span>`;
    return;
  }
  const fn = sec==='biblio' ? 'setMatB' : 'setMatC';
  const btns = ['todas',...mats].map(m=>{
    const label = m==='todas' ? 'Todas' : abr(m)||m;
    return `<button class="chip${m===activa?' active':''}" onclick="${fn}('${m.replace(/'/g,"\\'")}') " title="${m}">${label}</button>`;
  }).join('');
  el.innerHTML = `<div style="display:inline-flex;gap:.4rem;padding-right:1.5rem;">${btns}</div>`;
}

function setMatB(m){ S.fmb=m; renderChips('chips-biblio','biblio'); renderBiblio(); }
function setMatC(m){ S.fmc=m; renderChips('chips-clases','clases'); renderClases(); }

function setTipoBiblio(t){
  S.ftb=t;
  ['todos','Teorica','Practica'].forEach(x=>$('ft-'+x)?.classList.toggle('active',x===t));
  renderBiblio();
}
function setTipoClase(t){
  S.ftc=t;
  ['todos','Teorica','Practica'].forEach(x=>$('ct-'+x)?.classList.toggle('active',x===t));
  renderClases();
}
function setEstadoBiblio(e){
  S.feb = e;
  // Al filtrar por estado, resetear chips a "Todas" para ver todas las materias separadas
  if(e !== 'todos') {
    S.fmb = 'todas';
    renderChips('chips-biblio', 'biblio');
  }
  ['todos','pendiente','sinleer','leido'].forEach(x=>{
    const el=$('fe-'+x);
    if(el){
      el.classList.toggle('active',x===e);
      el.classList.toggle('pend',x==='pendiente'&&x===e);
    }
  });
  renderBiblio();
}

// ── STATS ───────────────────────────────────────────────────────
function renderStats(){
  const el=$('stats-bar'); if(!el||!S.biblio.length) return;
  const total   = S.biblio.length;
  const leidos  = S.biblio.filter(t=>t.estado==='Leído').length;
  const salt    = S.biblio.filter(t=>t.estado==='Salteado').length;
  const nova    = S.biblio.filter(t=>t.estado==='No va').length;
  const pend    = S.biblio.filter(t=>t.estado==='Pendiente').length;
  const otros   = total-leidos-salt-nova-pend;
  const pct     = total ? Math.round(((leidos+salt+nova)/total)*100) : 0;
  el.innerHTML=`
    <div class="stats-card">
      <div class="stats-row">
        <div>
          <div class="stats-title">Progreso general</div>
          <div class="stats-pct">${pct}%</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:.75rem;opacity:.8;">${total} textos</div>
          <div style="font-size:.75rem;opacity:.8;">${S.mats_biblio.length} materias</div>
        </div>
      </div>
      <div class="prog"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="stats-pills">
        <span class="spill">✓ ${leidos} leídos</span>
        <span class="spill">↷ ${salt} salt.</span>
        <span class="spill">✕ ${nova} no va</span>
        <span class="spill">⏳ ${pend} pend.</span>
        <span class="spill">· ${otros} sin leer</span>
      </div>
    </div>`;
}

// ── BIBLIOGRAFÍA ────────────────────────────────────────────────
function renderBiblio(){
  const el=$('textos-container'); if(!el) return;

  let items = S.biblio.filter(t => {
    const matchMat  = S.fmb==='todas' || String(t.materia||'').trim() === S.fmb;
    const tipoDato  = String(t.tipo_clase||'').trim();
    const matchTipo = S.ftb==='todos' ||
      (S.ftb==='Teorica'  && (tipoDato==='Teórica'  || tipoDato==='Teorica'))  ||
      (S.ftb==='Practica' && (tipoDato==='Práctica' || tipoDato==='Practica'));
    const estado    = String(t.estado||'').trim();
    const matchEst  = S.feb==='todos' ||
      (S.feb==='pendiente' && estado==='Pendiente') ||
      (S.feb==='sinleer'   && (estado==='Sin leer'||!estado)) ||
      (S.feb==='leido'     && estado==='Leído');
    return matchMat && matchTipo && matchEst;
  });

  const cc=$('biblio-count');
  if(cc) cc.textContent = items.length + ' textos';

  if(!items.length){
    el.innerHTML=empt('📚','Sin textos','No hay textos para el filtro seleccionado.');
    return;
  }

  let html = '';

  // ── CAMBIO CLAVE: agrupar por materia cuando hay filtro de estado activo ──
  // Así "Pendientes" (y Sin leer / Leídos) siempre aparecen segmentados por materia
  if(S.fmb === 'todas' || S.feb !== 'todos'){
    const gMats = {};
    const ordenMats = [];
    items.forEach(t=>{
      const m = String(t.materia||'Sin materia').trim();
      if(!gMats[m]){gMats[m]=[];ordenMats.push(m);}
      gMats[m].push(t);
    });
    ordenMats.forEach(m=>{
      html += `<div class="mat-separador"><span class="mat-separador-label">${m}</span></div>`;
      html += buildUnidadesHTML(gMats[m], m);
    });
  } else {
    // Una sola materia seleccionada, sin filtro de estado → directo por unidad
    html += buildUnidadesHTML(items, S.fmb);
  }

  el.innerHTML = html;
  renderStats();
}

function buildUnidadesHTML(items, matKey){
  const grupos = {};
  const orden  = [];
  items.forEach(t=>{
    const u = String(t.unidad||'Sin unidad').trim();
    if(!grupos[u]){ grupos[u]=[]; orden.push(u); }
    grupos[u].push(t);
  });

  let html = '';
  orden.forEach(u=>{
    const txs = grupos[u];
    const leidos = txs.filter(t=>t.estado==='Leído').length;
    const pct    = txs.length ? Math.round((leidos/txs.length)*100) : 0;
    const uid    = 'u_'+btoa(encodeURIComponent(matKey+'__'+u)).replace(/[^a-zA-Z0-9]/g,'').slice(0,20);
    const colapsada = !S.unidades_abiertas.has(uid);

    html += `<div class="unidad-section">
      <div class="unidad-header${colapsada?' collapsed':''}" onclick="toggleUnidad('${uid}')">
        <div class="unidad-left">
          <span class="unidad-toggle${colapsada?'':' open'}">▾</span>
          <span class="unidad-name">${u}</span>
        </div>
        <span class="unidad-prog">${leidos}/${txs.length} · ${pct}%</span>
      </div>
      <div class="unidad-body${colapsada?' collapsed':''}" id="${uid}">`;

    txs.forEach((t,i)=>{
      const e = String(t.estado||'Sin leer').trim();
      const cls = e==='Leído'?'leido':e==='No va'?'nova':e==='Pendiente'?'pendiente':'';
      const nro = t.nro_texto || (i+1);
      const resId = 'res_'+String(t.id).replace(/[^a-zA-Z0-9]/g,'');
      html += `
        <div class="texto-row ${cls}" id="txr-${t.id}">
          <div class="texto-num">${nro}</div>
          <div class="texto-content">
            <div class="texto-title">${t.titulo_texto||'—'}</div>
            ${t.autores?`<div class="texto-author">${t.autores}</div>`:''}
            <div class="texto-meta">
              <span class="badge ${bc(e)}">${e}</span>
              ${t.tipo_clase?`<span class="badge ${String(t.tipo_clase).includes('Práctica')?'b-p':'b-t'}">${t.tipo_clase}</span>`:''}
              ${t.link_resumen
                ? `<a href="${t.link_resumen}" target="_blank" class="lc">📄 Resumen</a>
                   <button class="lc" onclick="toggleResumenForm('${t.id}','${resId}')" title="Editar link de resumen">✏️</button>`
                : `<button class="lc add-res" onclick="toggleResumenForm('${t.id}','${resId}')">＋ Resumen</button>`
              }
            </div>
          </div>
          <div class="pop-wrap">
            <button class="edit-btn" onclick="togglePop('pop-${t.id}')">✏️</button>
            <div class="estado-popup" id="pop-${t.id}">
              <button class="ep"    onclick="cambiarEstado('${t.id}','Sin leer')">⬜ Sin leer</button>
              <button class="ep ok" onclick="cambiarEstado('${t.id}','Leído')">✅ Leído</button>
              <button class="ep sk" onclick="cambiarEstado('${t.id}','Salteado')">⏭ Salteado</button>
              <button class="ep pe" onclick="cambiarEstado('${t.id}','Pendiente')">⏳ Pendiente</button>
              <button class="ep nv" onclick="cambiarEstado('${t.id}','No va')">❌ No va</button>
            </div>
          </div>
        </div>
        <div class="resumen-form hidden" id="${resId}">
          <input type="url" placeholder="https://docs.google.com/..." id="inp-${resId}" value="${t.link_resumen||''}" onkeydown="if(event.key==='Enter')guardarResumen('${t.id}','${resId}')"/>
          <button class="resumen-save-btn" onclick="guardarResumen('${t.id}','${resId}')">Guardar</button>
          <button class="resumen-cancel-btn" onclick="toggleResumenForm('${t.id}','${resId}')">✕</button>
        </div>`;
    });
    html += '</div></div>';
  });
  return html;
}

// ── TOGGLE UNIDAD ─────────────────────────────────────────────
function toggleUnidad(uid){
  const body=$(uid);
  const header=body?.previousElementSibling;
  if(!body) return;
  const isAbierta = S.unidades_abiertas.has(uid);
  if(isAbierta){
    S.unidades_abiertas.delete(uid);
    body.classList.add('collapsed');
    header?.classList.add('collapsed');
    header?.querySelector('.unidad-toggle')?.classList.remove('open');
  } else {
    S.unidades_abiertas.add(uid);
    body.classList.remove('collapsed');
    header?.classList.remove('collapsed');
    header?.querySelector('.unidad-toggle')?.classList.add('open');
  }
}

function togglePop(id){
  document.querySelectorAll('.estado-popup.open').forEach(p=>{ if(p.id!==id) p.classList.remove('open'); });
  $(id)?.classList.toggle('open');
}
document.addEventListener('click',e=>{ if(!e.target.closest('.texto-row,.pop-wrap')) document.querySelectorAll('.estado-popup.open').forEach(p=>p.classList.remove('open')); });

// ── RESUMEN INLINE ─────────────────────────────────────────────
function toggleResumenForm(id, resId){
  document.querySelectorAll('.estado-popup.open').forEach(p=>p.classList.remove('open'));
  const form=$(resId); if(!form) return;
  const wasHidden = form.classList.contains('hidden');
  document.querySelectorAll('.resumen-form:not(.hidden)').forEach(f=>{ if(f.id!==resId) f.classList.add('hidden'); });
  form.classList.toggle('hidden', !wasHidden);
  if(wasHidden){ setTimeout(()=>$('inp-'+resId)?.focus(), 50); }
}

async function guardarResumen(id, resId){
  const inp=$('inp-'+resId); if(!inp) return;
  const link = inp.value.trim();
  const idx = S.biblio.findIndex(t=>String(t.id)===String(id));
  if(idx===-1) return;
  S.biblio[idx].link_resumen = link;
  S.biblio[idx].fecha_actualizacion = hoy();
  C.set('ep_biblio', S.biblio);
  renderBiblio();
  toast(link ? '✓ Resumen guardado' : '✓ Link eliminado');
  try{
    await fetch(CFG.P,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({accion:'actualizar_resumen',nombreHoja:CFG.HB,id:String(id),link_resumen:link,fecha:hoy()})});
    sync('','Guardado');
  }catch(e){ sync('e','Sin conexión'); }
}

async function cambiarEstado(id, nuevoEstado){
  document.querySelectorAll('.estado-popup.open').forEach(p=>p.classList.remove('open'));
  const idx=S.biblio.findIndex(t=>String(t.id)===String(id)); if(idx===-1) return;
  S.biblio[idx].estado = nuevoEstado;
  S.biblio[idx].fecha_actualizacion = hoy();
  C.set('ep_biblio',S.biblio); renderBiblio(); toast('✓ '+nuevoEstado);
  try{
    await fetch(CFG.P,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({accion:'actualizar_estado',nombreHoja:CFG.HB,id:String(id),estado:nuevoEstado,fecha:hoy()})});
    sync('','Guardado');
  }catch(e){ sync('e','Sin conexión'); }
}

// ── CLASES ──────────────────────────────────────────────────────
function renderClases(){
  const el=$('clases-container'); if(!el) return;
  let items=[...S.clases];
  if(S.fmc!=='todas') items=items.filter(c=>String(c.materia||'').trim()===S.fmc);
  if(S.ftc==='Teorica')  items=items.filter(c=>String(c.tipo||'').includes('eórica'));
  if(S.ftc==='Practica') items=items.filter(c=>String(c.tipo||'').includes('ráctica'));

  const cc=$('clases-count'); if(cc) cc.textContent=items.length+' clases';

  if(!items.length){ el.innerHTML=empt('🎓','Sin clases','Cargá la primera desde ＋ Clase.'); return; }
  items.sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));

  const gmats={}, mordenC=[];
  items.forEach(c=>{
    const m=String(c.materia||'Sin materia').trim();
    if(!gmats[m]){gmats[m]=[];mordenC.push(m);}
    gmats[m].push(c);
  });

  let html='';
  mordenC.forEach(m=>{
    html+=`<div class="mat-separador"><span class="mat-separador-label">${m}</span></div>`;
    gmats[m].forEach(c=>{
      const tipoBadge=String(c.tipo||'').includes('eórica')?'b-t':'b-p';
      html+=`
        <div class="clase-card">
          <div class="clase-meta">
            <span class="badge ${tipoBadge}">${c.tipo||'—'}</span>
            ${c.nro_clase?`<span class="badge b-sl">Clase ${c.nro_clase}</span>`:''}
            ${c.fecha?`<span style="font-size:.72rem;color:var(--text3);">${fmtF(c.fecha)}</span>`:''}
          </div>
          <div class="clase-title">${c.titulo_clase||'—'}</div>
          ${(c.link_grabacion||c.link_doc_resumen)?`
            <div class="clase-links">
              ${c.link_grabacion?`<a href="${c.link_grabacion}" target="_blank" class="lc">🎬 Grabación</a>`:''}
              ${c.link_doc_resumen?`<a href="${c.link_doc_resumen}" target="_blank" class="lc">📄 Resumen</a>`:''}
            </div>`:''}
        </div>`;
    });
  });
  el.innerHTML=html;
}

// ── PERFIL ──────────────────────────────────────────────────────
function renderPerfil(){
  if(!S.biblio.length) return;

  const total   = S.biblio.length;
  const leidos  = S.biblio.filter(t=>t.estado==='Leído').length;
  const pend    = S.biblio.filter(t=>t.estado==='Pendiente').length;
  const pct     = total ? Math.round((leidos/total)*100) : 0;

  const pst = id => $(id);
  if(pst('pst-total')) pst('pst-total').textContent = total;
  if(pst('pst-leidos')) pst('pst-leidos').textContent = leidos;
  if(pst('pst-pend')) pst('pst-pend').textContent = pend;
  if(pst('pst-pct')) pst('pst-pct').textContent = pct+'%';

  const matProg = $('perfil-mat-prog');
  if(matProg){
    const colores = ['#6d4af5','#9333ea','#d946a8','#2563eb','#059669','#d97706','#dc2626','#ea580c'];
    let mpHtml = '';
    S.mats_biblio.forEach((m, i)=>{
      const txs = S.biblio.filter(t=>String(t.materia||'').trim()===m);
      const leid = txs.filter(t=>t.estado==='Leído').length;
      const salt = txs.filter(t=>t.estado==='Salteado').length;
      const nova = txs.filter(t=>t.estado==='No va').length;
      const p = txs.length ? Math.round(((leid+salt+nova)/txs.length)*100) : 0;
      const color = colores[i % colores.length];
      mpHtml += `
        <div class="mat-prog-row">
          <div class="mat-prog-name" title="${m}">${abr(m)||m}</div>
          <div class="mat-prog-bar"><div class="mat-prog-fill" style="width:${p}%;background:${color}"></div></div>
          <div class="mat-prog-pct">${p}%</div>
        </div>`;
    });
    matProg.innerHTML = mpHtml || '<p style="font-size:.78rem;color:var(--text3);">Sin datos aún.</p>';
  }

  const pendEl = $('perfil-pendientes');
  if(pendEl){
    const pendList = S.biblio.filter(t=>t.estado==='Pendiente');
    if(!pendList.length){
      pendEl.innerHTML = '<p style="font-size:.78rem;color:var(--text3);">No hay textos marcados como pendientes. 🎉</p>';
    } else {
      if(!S._pendColapsadas) S._pendColapsadas = new Set();
      const gMats = {}, ordenMats = [];
      pendList.forEach(t=>{
        const m = String(t.materia||'Sin materia').trim();
        if(!gMats[m]){gMats[m]=[];ordenMats.push(m);}
        gMats[m].push(t);
      });
      let html = '';
      ordenMats.forEach(m=>{
        const col = S._pendColapsadas.has(m);
        const mid = 'pmat_'+m.replace(/[^a-zA-Z0-9]/g,'').slice(0,16);
        html += `<div style="margin-bottom:.2rem;">
          <button onclick="togglePendMat('${m.replace(/'/g,"\\'")}','${mid}')"
            style="display:flex;align-items:center;gap:.4rem;font-family:inherit;cursor:pointer;
            font-size:.65rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
            color:var(--v);background:var(--v-light);border:1px solid var(--v-mid);border-radius:100px;
            padding:.25rem .75rem;margin:.55rem 0 .3rem;transition:all .15s;width:auto;"
            onmouseover="this.style.background='var(--v);this.style.color=\\'#fff\\'"
            onmouseout="this.style.background='var(--v-light)';this.style.color='var(--v)'">
            <span id="${mid}_arrow" style="transition:transform .2s;display:inline-block;${col?'':'transform:rotate(0deg)'}">${col?'▶':'▾'}</span>
            ${m}
            <span style="background:rgba(109,74,245,.15);border-radius:100px;padding:.1rem .45rem;font-size:.6rem;">${gMats[m].length}</span>
          </button>
          <div id="${mid}" style="${col?'display:none':''}">`;
        gMats[m].forEach(t=>{
          html += `<div class="perfil-pend-item">
            <div class="perfil-pend-dot"></div>
            <div>
              <div class="perfil-pend-title">${t.titulo_texto||'—'}</div>
              <div class="perfil-pend-sub">${t.unidad||''}</div>
            </div>
          </div>`;
        });
        html += `</div></div>`;
      });
      pendEl.innerHTML = html;
    }
  }

  const estEl = $('perfil-estadisticas');
  if(estEl){
    const salt = S.biblio.filter(t=>t.estado==='Salteado').length;
    const nova = S.biblio.filter(t=>t.estado==='No va').length;
    const sinleer = S.biblio.filter(t=>!t.estado||t.estado==='Sin leer').length;
    const conResumen = S.biblio.filter(t=>t.link_resumen).length;
    const stats = [
      {l:'Sin leer',n:sinleer,c:'var(--text3)'},
      {l:'Salteados',n:salt,c:'var(--y)'},
      {l:'No va',n:nova,c:'var(--r)'},
      {l:'Con resumen',n:conResumen,c:'var(--v)'},
    ];
    estEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;">
      ${stats.map(s=>`
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:.75rem .9rem;border:1px solid var(--border);">
          <div style="font-size:1.35rem;font-weight:800;color:${s.c}">${s.n}</div>
          <div style="font-size:.7rem;color:var(--text3);font-weight:600;margin-top:.1rem;">${s.l}</div>
        </div>`).join('')}
    </div>`;
  }
  renderExamenes();
}

// ── FORM CLASE ──────────────────────────────────────────────────
function populateMatForm(){
  const sel=$('form-materia'); if(!sel) return;
  const mats=[...new Set([...S.mats_biblio,...S.mats_clases])].sort();
  sel.innerHTML='<option value="">— Seleccioná una materia —</option>'+
    mats.map(m=>`<option value="${m}">${m}</option>`).join('')+
    '<option value="__otra__">✏️  Otra (nueva materia)</option>';
}
function onSelMat(v){
  const w=$('otra-mat-wrap');
  if(v==='__otra__'){w.classList.remove('hidden');$('form-materia-otra')?.focus();}
  else{w.classList.add('hidden');updateClaseDD();}
}
function getMatForm(){
  const v=$('form-materia')?.value;
  return v==='__otra__'?($('form-materia-otra')?.value?.trim()?.toUpperCase()||''):v||'';
}
function setTipoForm(t){
  S.tipo=t;
  $('ftype-Teorica')?.classList.toggle('active',t==='Teórica');
  $('ftype-Practica')?.classList.toggle('active',t==='Práctica');
  updateClaseDD();
}
function updateClaseDD(){
  const sel=$('form-titulo-dd'); if(!sel) return;
  const mat=getMatForm(), tipo=S.tipo;
  const ex=S.clases
    .filter(c=>(!mat||String(c.materia||'').trim()===mat)&&(!tipo||String(c.tipo||'')===tipo))
    .sort((a,b)=>(+a.nro_clase||0)-(+b.nro_clase||0));
  sel.innerHTML='<option value="">— Clases ya cargadas para esta materia —</option>'+
    ex.map(c=>`<option value="${c.titulo_clase||''}" data-nro="${c.nro_clase||''}" data-fecha="${c.fecha||''}">${c.nro_clase?'Clase '+c.nro_clase+' — ':''}${c.titulo_clase||'—'}</option>`).join('')+
    '<option value="__nueva__">✏️  Nueva clase (escribir abajo)</option>';
}
function onSelClase(v){
  const inp=$('form-titulo');
  if(!v||v==='__nueva__'){if(inp)inp.value='';inp?.focus();return;}
  if(inp)inp.value=v;
  const sel=$('form-titulo-dd'),opt=sel?.options[sel.selectedIndex];
  if(opt?.dataset?.nro){const n=$('form-nro');if(n)n.value=opt.dataset.nro;}
  if(opt?.dataset?.fecha){const f=$('form-fecha');if(f)f.value=opt.dataset.fecha;}
}
function onTituloInput(v){
  const list=$('ac-list'); if(!list) return;
  if(!v||v.length<2){list.classList.add('hidden');return;}
  const mat=getMatForm();
  const sugs=S.clases.filter(c=>(!mat||String(c.materia||'').trim()===mat)&&c.titulo_clase?.toLowerCase().includes(v.toLowerCase())).slice(0,5);
  if(!sugs.length){list.classList.add('hidden');return;}
  list.innerHTML=sugs.map(c=>`
    <div class="ac-item" onmousedown="selAC('${c.titulo_clase.replace(/'/g,"\\'")}','${c.nro_clase||''}','${c.fecha||''}')">
      ${c.titulo_clase}<span class="ac-sub"> · Clase ${c.nro_clase||'?'}</span>
    </div>`).join('');
  list.classList.remove('hidden');
}
function selAC(t,n,f){
  const ti=$('form-titulo');if(ti)ti.value=t;
  const ni=$('form-nro');if(ni&&n)ni.value=n;
  const fi=$('form-fecha');if(fi&&f)fi.value=f;
  $('ac-list')?.classList.add('hidden');
}

async function guardarClase(){
  const mat=getMatForm(), tit=$('form-titulo')?.value?.trim();
  const fec=$('form-fecha')?.value, nro=$('form-nro')?.value;
  const tra=$('form-transc')?.value?.trim(), ppt=$('form-ppt')?.value?.trim();
  const gra=$('form-grab')?.value?.trim(), doc=$('form-doc')?.value?.trim();
  if(!mat){toast('⚠️ Seleccioná una materia');return;}
  if(!tit){toast('⚠️ Escribí el título');return;}
  const btn=$('btn-guardar'); if(btn){btn.disabled=true;btn.textContent='Guardando...';}
  const id='cls_'+Date.now();
  const fila=[id,mat,S.tipo,nro,fec,tit,gra||'',doc||'','Sin ver',tra||'',ppt||'',
    [fec,abr(mat).replace(/\s+/g,'-'),S.tipo.includes('eórica')?'Teorica':'Practica',nro?'Clase'+nro:''].filter(Boolean).join('_'),hoy()];
  S.clases.unshift({id,materia:mat,tipo:S.tipo,nro_clase:nro,fecha:fec,titulo_clase:tit,link_grabacion:gra||'',link_doc_resumen:doc||''});
  C.set('ep_clases',S.clases); buildMatClases();
  try{
    const res=await fetch(CFG.P,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({nombreHoja:CFG.HC,fila})});
    const txt=await res.text();
    toast(txt.includes('Guardado')?'✓ Clase guardada':'✓ Guardado');
  }catch(e){toast('💾 Sin conexión — guardado localmente');}
  renderClases(); setSection('clases');
  if(btn){btn.disabled=false;btn.textContent='Guardar en Sheets →';}
  ['form-titulo','form-transc','form-ppt','form-grab','form-doc','form-nro','form-materia-otra'].forEach(id=>{const e=$(id);if(e)e.value='';});
  const fm=$('form-materia');if(fm)fm.value='';
  $('otra-mat-wrap')?.classList.add('hidden');
}

// ── BIBLIO UPLOAD ───────────────────────────────────────────────
function copiarPrompt(){
  const txt=$('prompt-ia')?.innerText||'';
  navigator.clipboard.writeText(txt).then(()=>{
    toast('✓ Prompt copiado — pegalo en Claude con el temario');
    const b=$('btn-copiar');if(b){b.textContent='✓ Copiado';setTimeout(()=>b.textContent='📋 Copiar',2000);}
  }).catch(()=>{
    const r=document.createRange();r.selectNode($('prompt-ia'));
    window.getSelection().removeAllRanges();window.getSelection().addRange(r);
    toast('Seleccionado — copiá con Ctrl+C');
  });
}
function previsualizarBiblio(){
  const raw=$('json-input')?.value?.trim();
  if(!raw){toast('⚠️ Pegá el JSON primero');return;}
  let datos;
  try{datos=JSON.parse(raw.replace(/```json\n?|```\n?/g,'').trim());}
  catch(e){toast('❌ JSON inválido — revisá el formato');return;}
  if(!Array.isArray(datos)||!datos.length){toast('❌ Debe ser un array con al menos 1 item');return;}
  const errs=[],ids=new Set();
  datos.forEach((d,i)=>{
    if(!d.id)errs.push(`Fila ${i+1}: falta "id"`);
    if(!d.titulo_texto)errs.push(`Fila ${i+1}: falta "titulo_texto"`);
    if(!d.materia)errs.push(`Fila ${i+1}: falta "materia"`);
    if(d.id&&ids.has(d.id))errs.push(`ID duplicado: "${d.id}"`);
    if(d.id)ids.add(d.id);
  });
  const ed=$('prev-errors'),el=$('err-list');
  if(errs.length&&ed&&el){el.innerHTML=[...new Set(errs)].map(e=>`<li>${e}</li>`).join('');ed.classList.remove('hidden');}
  else if(ed)ed.classList.add('hidden');
  const tbody=$('prev-tbody');
  if(tbody)tbody.innerHTML=datos.map(d=>`
    <tr>
      <td class="mono">${d.id||'—'}</td>
      <td>${abr(d.materia||'')||d.materia||'—'}</td>
      <td style="font-size:.72rem;color:var(--text3);">${(d.unidad||'—').replace('Unidad ','U.')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.titulo_texto||''}">${d.titulo_texto||'—'}</td>
      <td><span class="badge ${String(d.tipo_clase||'').includes('eórica')?'b-t':'b-p'}">${d.tipo_clase||'—'}</span></td>
    </tr>`).join('');
  const pc=$('prev-count');if(pc)pc.textContent=datos.length;
  S.prev=datos;
  const pv=$('biblio-preview');
  if(pv){pv.classList.remove('hidden');setTimeout(()=>pv.scrollIntoView({behavior:'smooth',block:'nearest'}),100);}
}
function limpiarPreview(){
  $('biblio-preview')?.classList.add('hidden');
  const ji=$('json-input');if(ji)ji.value='';
  S.prev=null;
}
async function subirBiblio(){
  const datos=S.prev;if(!datos?.length){toast('⚠️ Previsualizá primero');return;}
  const btn=$('btn-subir');if(btn)btn.disabled=true;
  let ok=0,err=0;
  for(let i=0;i<datos.length;i++){
    const d=datos[i];
    if(btn)btn.textContent=`↑ Subiendo ${i+1}/${datos.length}...`;
    const fila=[d.id,d.materia,d.unidad||'',d.nro_texto||'',d.titulo_texto,d.autores||'',
      d.estado||'Sin leer',d.link_resumen||'',d.tipo_clase||'',d.notas||'',d.fecha_actualizacion||hoy()];
    try{
      const r=await fetch(CFG.P,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({nombreHoja:CFG.HB,fila})});
      if(r.ok){ok++;S.biblio.push({...d});}else err++;
    }catch(e){err++;}
    await new Promise(r=>setTimeout(r,350));
  }
  C.set('ep_biblio',S.biblio); buildMats(); renderBiblio();
  if(btn){btn.disabled=false;btn.textContent='↑ Subir todo a Google Sheets';}
  if(!err){toast(`✓ ${ok} textos subidos`);limpiarPreview();setSection('biblio');}
  else toast(`⚠️ ${ok} OK · ${err} fallaron`);
}

// ── NAVEGACIÓN ───────────────────────────────────────────────────
const SECS = ['biblio','clases','perfil','cargar','cargarbiblio'];
function setSection(sec){
  SECS.forEach(s=>{
    $('sec-'+s)?.classList.toggle('hidden',s!==sec);
    $('bn-'+s)?.classList.toggle('active',s===sec);
    $('tab-'+s)?.classList.toggle('active',s===sec);
  });
  S.sec=sec;
  if(sec==='clases'){ renderChips('chips-clases','clases'); }
  if(sec==='cargar'){ populateMatForm(); updateClaseDD(); }
  if(sec==='perfil'){ renderPerfil(); }
}

// ── EXÁMENES ────────────────────────────────────────────────────
function saveLocalExamenes(){ 
  localStorage.setItem('ep_examenes', JSON.stringify(S.examenes)); 
}

async function fetchExamenes(){
  try{
    const r = await fetch(CFG.GE);
    const d = await r.json();
    if(!Array.isArray(d)) return;
    S.examenes = d;
    localStorage.setItem('ep_examenes', JSON.stringify(d));
    renderExamenes();
  }catch(e){ console.warn('fetchExamenes:', e.message); }
}

async function syncExamenSheets(examen, accion='guardar_examen'){
  try{
    await fetch(CFG.P,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({
        accion,
        id: examen.id,
        nombre: examen.nombre||'',
        materia: examen.materia||'',
        fecha: examen.fecha||'',
        finalizado: examen.finalizado||false,
        textos: examen.textos||[]
      })
    });
  }catch(e){ sync('e','Sin conexión'); }
}

function cerrarExamenForm(){
  $('modal-examen').style.display = 'none';
  S._exEditId = null;
}

function cargarTextosModal(selIds=[]){
  const mat = $('ex-materia')?.value;
  const lista = $('ex-textos-list');
  const chips = $('ex-unidad-chips');
  if(!lista||!chips) return;

  if(!mat){ lista.innerHTML='<p style="padding:.75rem;font-size:.78rem;color:var(--text3);">Seleccioná una materia primero.</p>'; chips.innerHTML=''; return; }

  const textos = S.biblio.filter(t=>String(t.materia||'').trim()===mat);
  if(!textos.length){ lista.innerHTML='<p style="padding:.75rem;font-size:.78rem;color:var(--text3);">No hay textos para esta materia.</p>'; return; }

  const yaSeleccionados = new Set(selIds.map(String));

  const grupos={}, ordenU=[];
  textos.forEach(t=>{
    const u=String(t.unidad||'Sin unidad').trim();
    if(!grupos[u]){grupos[u]=[];ordenU.push(u);}
    grupos[u].push(t);
  });

  chips.innerHTML = ordenU.map((u,i)=>`
    <button class="chip active" style="font-size:.65rem;padding:.2rem .6rem;"
      onclick="filtrarUnidadModal('${u.replace(/'/g,"\\'")}',this)">${u.replace('Unidad ','U.')}</button>`).join('');

  let html='';
  ordenU.forEach(u=>{
    html+=`<div class="ex-unidad-group" data-unidad="${u.replace(/"/g,'&quot;')}">
      <div style="padding:.45rem .75rem;background:var(--v-light);border-bottom:1px solid var(--v-mid);font-size:.68rem;font-weight:800;color:var(--v);letter-spacing:.04em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
        <span>${u}</span>
        <button onclick="toggleUnidadExamen('${u.replace(/'/g,"\\'")}',true)" style="font-size:.65rem;padding:.1rem .4rem;border-radius:4px;border:1px solid var(--v-mid);background:var(--white);color:var(--v);cursor:pointer;">Todo</button>
      </div>`;
    grupos[u].forEach(t=>{
      const checked = yaSeleccionados.has(String(t.id));
      const estadoBadge = t.estado&&t.estado!=='Sin leer' ? `<span style="font-size:.6rem;color:var(--text3);">${t.estado}</span>` : '';
      html+=`<label style="display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
        <input type="checkbox" data-id="${t.id}" ${checked?'checked':''} onchange="updateSelCount()" style="margin-top:2px;accent-color:var(--v);flex-shrink:0;"/>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;font-weight:600;line-height:1.3;color:var(--text);">${t.titulo_texto||'—'}</div>
          <div style="font-size:.7rem;color:var(--text3);">${t.autores||''} ${estadoBadge}</div>
        </div>
      </label>`;
    });
    html+='</div>';
  });
  lista.innerHTML=html;
  updateSelCount();
}

function filtrarUnidadModal(u, btn){
  const activo = btn.classList.contains('active');
  document.querySelectorAll('.ex-unidad-group').forEach(g=>{
    if(g.dataset.unidad===u) g.style.display = activo?'none':'';
  });
  btn.classList.toggle('active',!activo);
}

function toggleUnidadExamen(u, sel){
  document.querySelectorAll('.ex-unidad-group').forEach(g=>{
    if(g.dataset.unidad===u){
      g.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=sel);
    }
  });
  updateSelCount();
}

function updateSelCount(){
  const n = document.querySelectorAll('#ex-textos-list input[type=checkbox]:checked').length;
  const el=$('ex-sel-count'); if(el) el.textContent=n+' textos seleccionados';
}

function guardarExamen(){
  const nombre=$('ex-nombre')?.value?.trim();
  const materia=$('ex-materia')?.value;
  const fecha=$('ex-fecha')?.value;
  if(!nombre){toast('⚠️ Poné un nombre al examen');return;}
  if(!materia){toast('⚠️ Seleccioná una materia');return;}
  if(!fecha){toast('⚠️ Poné la fecha del examen');return;}
  const textos=[...(document.querySelectorAll('#ex-textos-list input[type=checkbox]:checked')||[])].map(cb=>cb.dataset.id);
  if(!textos.length){toast('⚠️ Seleccioná al menos un texto');return;}

  let examen;
  if(S._exEditId){
    const idx=S.examenes.findIndex(e=>e.id===S._exEditId);
    if(idx!==-1){ 
      S.examenes[idx]={...S.examenes[idx], nombre, materia, fecha, textos}; 
      examen=S.examenes[idx]; 
    }
  } else {
    examen={id:'ex_'+Date.now(), nombre, materia, fecha, textos, finalizado: false};
    S.examenes.push(examen);
  }
  saveLocalExamenes();
  syncExamenSheets(examen, 'guardar_examen');
  cerrarExamenForm(); renderExamenes();
  toast('✓ Examen guardado');
}

function eliminarExamen(id){
  if(!confirm('¿Eliminar este examen?')) return;
  S.examenes=S.examenes.filter(e=>e.id!==id);
  saveLocalExamenes();
  syncExamenSheets({id}, 'eliminar_examen');
  renderExamenes(); toast('Examen eliminado');
}

function editarExamen(id){ abrirExamenForm(id); }

// ── TOGGLE MATERIA PENDIENTES ─────────────────────────────────
function togglePendMat(m, mid){
  if(!S._pendColapsadas) S._pendColapsadas = new Set();
  const body = document.getElementById(mid);
  const arrow = document.getElementById(mid+'_arrow');
  if(!body) return;
  if(S._pendColapsadas.has(m)){
    S._pendColapsadas.delete(m);
    body.style.display = '';
    if(arrow) arrow.textContent = '▾';
  } else {
    S._pendColapsadas.add(m);
    body.style.display = 'none';
    if(arrow) arrow.textContent = '▶';
  }
}

// ── TOGGLE FINALIZADO ─────────────────────────────────────────
function toggleFinalizadoExamen(id){
  const idx = S.examenes.findIndex(e=>e.id===id);
  if(idx===-1) return;
  S.examenes[idx].finalizado = !S.examenes[idx].finalizado;
  saveLocalExamenes();
  syncExamenSheets(S.examenes[idx], 'guardar_examen');
  renderExamenes();
  toast(S.examenes[idx].finalizado ? '✅ Examen finalizado' : '↩ Examen reactivado');
}

// ── NUEVO: mostrar/ocultar finalizados ────────────────────────
function toggleMostrarFinalizados(){
  S._mostrarFinalizados = !S._mostrarFinalizados;
  renderExamenes();
}

function abrirExamenForm(id=null){
  S._exEditId = id;
  const ex = id ? S.examenes.find(e=>e.id===id) : null;
  $('modal-examen-title').textContent = id ? '✏️ Editar Examen' : '📅 Nuevo Examen';
  $('ex-nombre').value  = ex?.nombre || '';
  $('ex-fecha').value   = ex?.fecha  || '';

  const sel = $('ex-materia');
  sel.innerHTML = '<option value="">— Seleccioná —</option>' +
    S.mats_biblio.map(m=>`<option value="${m}" ${ex?.materia===m?'selected':''}>${m}</option>`).join('');

  $('modal-examen').style.display = 'block';
  cargarTextosModal(ex?.textos||[]);
}

// ── RENDER EXÁMENES (reescrito) ───────────────────────────────
function renderExamenes(){
  const el=$('perfil-examenes'); if(!el) return;

  const hoyMs = new Date().setHours(0,0,0,0);

  // Próximo examen (no finalizado, en el futuro)
  const proximos = S.examenes
    .filter(e => !e.finalizado)
    .filter(e => {
      const d = new Date(e.fecha+'T00:00:00');
      return !isNaN(d) && d >= hoyMs;
    })
    .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

  const finalizadosCount = S.examenes.filter(e=>e.finalizado).length;

  // ── Banner próximo examen ──
  let bannerHtml = '';
  if(proximos.length > 0){
    const next = proximos[0];
    const diasR = Math.ceil((new Date(next.fecha+'T00:00:00') - hoyMs) / 864e5);
    const urgColor = diasR === 0 ? 'var(--r)' : diasR <= 7 ? 'var(--r)' : diasR <= 14 ? 'var(--o)' : 'var(--v)';
    const urgBg    = diasR <= 7 ? 'var(--r-light)' : diasR <= 14 ? 'var(--o-light)' : 'var(--v-light)';
    const diasLabel = diasR === 0 ? '¡HOY!' : diasR === 1 ? '1 día' : diasR + ' días';

    bannerHtml = `
      <div style="background:${urgBg};border:1.5px solid ${urgColor}55;border-radius:var(--radius-sm);
        padding:.8rem 1rem;margin-bottom:.9rem;display:flex;align-items:center;gap:.9rem;">
        <div style="text-align:center;min-width:52px;flex-shrink:0;">
          <div style="font-size:${diasR===0?'1.3':'1.7'}rem;font-weight:800;color:${urgColor};line-height:1;">
            ${diasR === 0 ? '🔥' : diasR}
          </div>
          <div style="font-size:.55rem;font-weight:800;color:${urgColor};text-transform:uppercase;letter-spacing:.05em;margin-top:.1rem;">
            ${diasR === 0 ? 'hoy' : 'días'}
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.6rem;font-weight:800;color:${urgColor};text-transform:uppercase;letter-spacing:.07em;margin-bottom:.15rem;">
            📅 Próximo examen
          </div>
          <div style="font-size:.92rem;font-weight:700;color:var(--text);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${next.nombre}
          </div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:.15rem;">
            ${abr(next.materia)||next.materia} · ${fmtF(next.fecha)} · faltan ${diasLabel}
          </div>
        </div>
      </div>`;
  }

  if(!S.examenes.length){
    el.innerHTML = bannerHtml + '<p style="font-size:.78rem;color:var(--text3);padding:.5rem 0;">No hay exámenes cargados. Tocá ＋ Nuevo para agregar uno.</p>';
    return;
  }

  // Toggle mostrar finalizados
  let toggleHtml = '';
  if(finalizadosCount > 0){
    toggleHtml = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:.55rem;">
        <button onclick="toggleMostrarFinalizados()" class="btn-icon" style="font-size:.68rem;">
          ${S._mostrarFinalizados
            ? '🙈 Ocultar finalizados'
            : `📁 Ver finalizados (${finalizadosCount})`
          }
        </button>
      </div>`;
  }

  // Exámenes a mostrar
  const shown = S._mostrarFinalizados
    ? [...S.examenes].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha))
    : S.examenes.filter(e=>!e.finalizado).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));

  if(!shown.length){
    el.innerHTML = bannerHtml + toggleHtml +
      '<p style="font-size:.78rem;color:var(--g);font-weight:600;padding:.5rem 0;">🎉 Todos los exámenes finalizados.</p>';
    return;
  }

  let html = bannerHtml + toggleHtml;

  shown.forEach(ex=>{
    const rawFecha = new Date(ex.fecha && ex.fecha.includes('T') ? ex.fecha : (ex.fecha||'')+'T00:00:00');
    const diasR   = isNaN(rawFecha) ? 999 : Math.ceil((rawFecha - hoyMs) / 864e5);
    const pasado  = diasR < 0;
    const urgColor = ex.finalizado ? 'var(--g)'
      : pasado ? 'var(--text3)'
      : diasR <= 7 ? 'var(--r)'
      : diasR <= 14 ? 'var(--o)'
      : 'var(--v)';
    const urgBg = ex.finalizado ? 'var(--g-light)'
      : pasado ? 'var(--bg2)'
      : diasR <= 7 ? 'var(--r-light)'
      : diasR <= 14 ? 'var(--o-light)'
      : 'var(--v-light)';
    const diasLabel = ex.finalizado ? '✅ Listo'
      : pasado ? 'Pasado'
      : diasR === 0 ? '¡Hoy!'
      : diasR === 1 ? 'Mañana'
      : diasR + 'd';

    const textos = S.biblio.filter(t=>ex.textos.includes(String(t.id)));
    const total  = textos.length;
    const ok     = textos.filter(t=>t.estado==='Leído'||t.estado==='Salteado').length;
    const pend   = textos.filter(t=>!t.estado||t.estado==='Sin leer'||t.estado==='Pendiente');
    const pct    = total ? Math.round((ok/total)*100) : 0;

    const pendPorUnidad={};
    pend.forEach(t=>{
      const u=String(t.unidad||'Sin unidad').trim();
      if(!pendPorUnidad[u])pendPorUnidad[u]=[];
      pendPorUnidad[u].push(t);
    });

    html += `
      <div class="examen-card${pasado && !ex.finalizado?' pasado':''}${ex.finalizado?' finalizado':''}">

        <!-- Cabecera -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.65rem;">
          <div style="flex:1;min-width:0;">
            <div class="examen-nombre">${ex.finalizado ? '<span style="color:var(--g);">✅</span> ' : ''}${ex.nombre}</div>
            <div class="examen-sub">${abr(ex.materia)||ex.materia} · ${fmtF(ex.fecha)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-size:.75rem;font-weight:700;color:${urgColor};background:${urgBg};padding:.22rem .65rem;border-radius:100px;white-space:nowrap;">${diasLabel}</span>
            <button onclick="toggleFinalizadoExamen('${ex.id}')"
              class="btn-icon" 
              style="padding:.25rem .55rem;font-size:.68rem;${ex.finalizado?'color:var(--g);border-color:var(--g-light);':''}"
              title="${ex.finalizado ? 'Reactivar examen' : 'Marcar como finalizado'}">
              ${ex.finalizado ? '↩ Reactivar' : '✅ Finalizar'}
            </button>
            <button onclick="editarExamen('${ex.id}')" class="btn-icon" style="padding:.25rem .5rem;" title="Editar">✏️</button>
            <button onclick="eliminarExamen('${ex.id}')" class="btn-icon" style="padding:.25rem .5rem;color:var(--r);" title="Eliminar">✕</button>
          </div>
        </div>

        <!-- Barra de progreso -->
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.65rem;">
          <div style="flex:1;height:7px;border-radius:100px;background:var(--bg2);overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${urgColor};border-radius:100px;transition:width .6s;"></div>
          </div>
          <span style="font-size:.72rem;font-weight:700;color:${urgColor};white-space:nowrap;min-width:70px;text-align:right;">${ok}/${total} · ${pct}%</span>
        </div>

        <!-- Estado de textos -->
        ${ex.finalizado
          ? `<div style="font-size:.8rem;color:var(--g);font-weight:600;padding:.3rem 0;">Examen completado · ${fmtF(ex.fecha)}</div>`
          : pend.length === 0
            ? `<div style="font-size:.8rem;color:var(--g);font-weight:700;padding:.35rem 0;">✅ ¡Todo listo para este examen!</div>`
            : `<div class="examen-pend-list">
                <div style="font-size:.65rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text3);margin-bottom:.35rem;">Falta leer (${pend.length})</div>
                ${Object.entries(pendPorUnidad).map(([u,txs])=>`
                  <div class="examen-pend-unidad">${u}</div>
                  ${txs.map(t=>`
                    <div class="examen-pend-item">
                      <div class="examen-pend-dot"></div>
                      <div class="examen-pend-txt">${t.titulo_texto||'—'}</div>
                    </div>`).join('')}
                `).join('')}
              </div>`
        }
      </div>`;
  });
  el.innerHTML = html;
}