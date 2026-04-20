// EstudioPsi — app.js v6 (materias dinámicas, filtro correcto)
const BASE = 'https://script.google.com/macros/s/AKfycbzGgwvN3y3xV-HQIbaOOnerxKebQovcjm7LW0KhQ0ocgXuIffHCZTmuxRZfg7pBrrMR/exec';
const CFG  = { GB: BASE+'?hoja=Bibliografia', GC: BASE+'?hoja=Clases', P: BASE, HB:'Bibliografia', HC:'Clases' };

// SIN materias hardcoded — todo viene del Sheets
const S = {
  biblio:[], clases:[],
  mats_biblio:[],   // materias únicas en bibliografía
  mats_clases:[],   // materias únicas en clases
  sec:'biblio',
  fmb:'todas', ftb:'todos',   // filtro materia biblio / tipo biblio
  fmc:'todas', ftc:'todos',   // filtro materia clases / tipo clases
  tipo:'Teórica', prev:null,
};

const $   = id => document.getElementById(id);
const hoy = () => new Date().toISOString().split('T')[0];
const fmtF= f => { try{return new Date(f+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return f||'';} };
const bc  = e => ({'Leído':'b-ok','Salteado':'b-sk','No va':'b-nv'}[e]||'b-sl');
const C   = {
  set:(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v));}catch(e){}},
  get:(k)=>{try{const d=sessionStorage.getItem(k);return d?JSON.parse(d):null;}catch(e){return null;}}
};

// Abreviación inteligente de materia
function abr(m) {
  if (!m) return '';
  const words = m.trim().split(/\s+/);
  if (words.length <= 2) return m;
  // Primeras 2 palabras significativas
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
  fetchB(); fetchC();
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
// Solo las materias que existen en los datos — sin hardcodear nada
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
  // Si no hay materias, mostrar placeholder
  if(!mats.length){
    el.innerHTML=`<span style="font-size:.75rem;color:var(--text3);">Cargá bibliografía para ver las materias</span>`;
    return;
  }
  const fn = sec==='biblio' ? 'setMatB' : 'setMatC';
  el.innerHTML = ['todas',...mats].map(m=>{
    const label = m==='todas' ? 'Todas' : abr(m)||m;
    return `<button class="chip${m===activa?' active':''}" onclick="${fn}('${m.replace(/'/g,"\\'")}') " title="${m}">${label}</button>`;
  }).join('');
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

// ── STATS ───────────────────────────────────────────────────────
function renderStats(){
  const el=$('stats-bar'); if(!el||!S.biblio.length) return;
  const total  = S.biblio.length;
  const leidos = S.biblio.filter(t=>t.estado==='Leído').length;
  const salt   = S.biblio.filter(t=>t.estado==='Salteado').length;
  const nova   = S.biblio.filter(t=>t.estado==='No va').length;
  const pend   = total-leidos-salt-nova;
  const pct    = total ? Math.round(((leidos+salt+nova)/total)*100) : 0;
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
        <span class="spill">· ${pend} pendientes</span>
      </div>
    </div>`;
}

// ── BIBLIOGRAFÍA ────────────────────────────────────────────────
function renderBiblio(){
  const el=$('textos-container'); if(!el) return;

  // Aplicar filtros — COMPARACIÓN EXACTA de string
  let items = S.biblio.filter(t => {
    const matchMat  = S.fmb==='todas' || String(t.materia||'').trim() === S.fmb;
    const tipoDato  = String(t.tipo_clase||'').trim();
    const matchTipo = S.ftb==='todos' ||
      (S.ftb==='Teorica'  && (tipoDato==='Teórica'  || tipoDato==='Teorica'))  ||
      (S.ftb==='Practica' && (tipoDato==='Práctica' || tipoDato==='Practica'));
    return matchMat && matchTipo;
  });

  // Contador
  const cc=$('biblio-count');
  if(cc) cc.textContent = items.length + ' textos';

  if(!items.length){
    el.innerHTML=empt('📚','Sin textos','No hay textos para el filtro seleccionado.');
    return;
  }

  // Agrupar por unidad manteniendo orden
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

    html += `<div class="unidad-section">
      <div class="unidad-header">
        <span class="unidad-name">${u}</span>
        <span class="unidad-prog">${leidos}/${txs.length} · ${pct}%</span>
      </div>
      <div class="unidad-body">`;

    txs.forEach((t,i)=>{
      const e = String(t.estado||'Sin leer').trim();
      const cls = e==='Leído'?'leido':e==='No va'?'nova':'';
      const nro = t.nro_texto || (i+1);
      html += `
        <div class="texto-row ${cls}" id="txr-${t.id}">
          <div class="texto-num">${nro}</div>
          <div class="texto-content">
            <div class="texto-title">${t.titulo_texto||'—'}</div>
            ${t.autores?`<div class="texto-author">${t.autores}</div>`:''}
            <div class="texto-meta">
              <span class="badge ${bc(e)}">${e}</span>
              ${t.tipo_clase?`<span class="badge ${String(t.tipo_clase).includes('Práctica')?'b-p':'b-t'}">${t.tipo_clase}</span>`:''}
              ${t.link_resumen?`<a href="${t.link_resumen}" target="_blank" class="lc">📄 Resumen</a>`:''}
              ${t.notas?`<span class="lc" title="${t.notas}">📝 Nota</span>`:''}
            </div>
          </div>
          <div class="pop-wrap">
            <button class="edit-btn" onclick="togglePop('pop-${t.id}')">✏️</button>
            <div class="estado-popup" id="pop-${t.id}">
              <button class="ep"    onclick="cambiarEstado('${t.id}','Sin leer')">⬜ Sin leer</button>
              <button class="ep ok" onclick="cambiarEstado('${t.id}','Leído')">✅ Leído</button>
              <button class="ep sk" onclick="cambiarEstado('${t.id}','Salteado')">⏭ Salteado</button>
              <button class="ep nv" onclick="cambiarEstado('${t.id}','No va')">❌ No va</button>
            </div>
          </div>
        </div>`;
    });
    html += '</div></div>';
  });

  el.innerHTML = html;
  renderStats();
}

function togglePop(id){
  document.querySelectorAll('.estado-popup.open').forEach(p=>{ if(p.id!==id) p.classList.remove('open'); });
  $(id)?.classList.toggle('open');
}
document.addEventListener('click',e=>{ if(!e.target.closest('.texto-row,.pop-wrap')) document.querySelectorAll('.estado-popup.open').forEach(p=>p.classList.remove('open')); });

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

  // Agrupar por materia
  const gmats={}, mordenC=[];
  items.forEach(c=>{
    const m=String(c.materia||'Sin materia').trim();
    if(!gmats[m]){gmats[m]=[];mordenC.push(m);}
    gmats[m].push(c);
  });

  let html='';
  mordenC.forEach(m=>{
    html+=`<div class="sec-title">${m}</div>`;
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

// ── FORM CLASE ──────────────────────────────────────────────────
function populateMatForm(){
  const sel=$('form-materia'); if(!sel) return;
  // Solo materias que ya existen + opción para ingresar nueva
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
function setSection(sec){
  ['biblio','clases','cargar','cargarbiblio'].forEach(s=>{
    $('sec-'+s)?.classList.toggle('hidden',s!==sec);
    $('bn-'+s)?.classList.toggle('active',s===sec);
    $('tab-'+s)?.classList.toggle('active',s===sec);
  });
  S.sec=sec;
  if(sec==='clases'){ renderChips('chips-clases','clases'); }
  if(sec==='cargar'){ populateMatForm(); updateClaseDD(); }
}