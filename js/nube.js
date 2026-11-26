/* BIM Cosmetics · Sincronización Supabase REST (offline-first, sin bloquear la UI). */
(function () {
  'use strict';
  const CFG = window.BIM_CLOUD;
  if (!CFG || !CFG.url || !CFG.key) return;
  const base = CFG.url.replace(/\/+$/, '');
  const table = /^[a-z0-9_]+$/i.test(CFG.table || '') ? CFG.table : 'bim_cloud';
  const endpoint = base + '/rest/v1/' + table;
  const row = String(CFG.row || 'main');
  const TS_KEY = 'bim_cloud_updated';
  const headers = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  let timer = null;
  let inFlight = false;

  const icon = () => document.getElementById('cloudIcon');
  const button = () => document.getElementById('cloudBtn');
  const projectRef = (new URL(base).hostname || '').split('.')[0];
  const sqlEditor = 'https://supabase.com/dashboard/project/' + projectRef + '/sql/new';

  function estado(state, message) {
    const el = button();
    if (el) {
      el.dataset.state = state;
      el.title = message;
      el.setAttribute('aria-label', message);
    }
    const i = icon();
    if (i) i.textContent = state === 'sync' ? '↻' : state === 'ok' ? '☁' : state === 'setup' ? '⚙' : state === 'offline' ? '☁' : '!';
    if (state === 'ok') i && (i.style.color = 'var(--ok)');
    else if (state === 'sync') i && (i.style.color = 'var(--accent)');
    else if (state === 'setup') i && (i.style.color = 'var(--gold)');
    else if (state === 'offline') i && (i.style.color = 'var(--muted)');
    else i && (i.style.color = 'var(--danger)');
  }

  function snapshot() {
    let contactos = [];
    try { contactos = JSON.parse(localStorage.getItem('inv_contactos_v1') || '[]'); } catch {}
    const data = window.BIM_APP.exportar() || {};
    return {
      version: 1,
      app: 'BIM Cosmetics',
      savedAt: Date.now(),
      p: Array.isArray(data.p) ? data.p : [],
      m: Array.isArray(data.m) ? data.m : [],
      ev: Array.isArray(data.ev) ? data.ev : [],
      ped: Array.isArray(data.ped) ? data.ped.slice(-200) : [],
      contactos: Array.isArray(contactos) ? contactos.slice(-100) : []
    };
  }

  async function request(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      return await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: controller.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function leer() {
    const res = await request(endpoint + '?id=eq.' + encodeURIComponent(row) + '&select=payload,updated_at&limit=1', { method: 'GET' });
    if (res.status === 404) { const e = new Error('Falta la tabla ' + table + '. Pulsa la nube para abrir el SQL Editor.'); e.code = 'SETUP'; throw e; }
    if (res.status === 401 || res.status === 403) { const e = new Error('Supabase rechazó la clave o las políticas RLS.'); e.code = 'AUTH'; throw e; }
    if (!res.ok) throw new Error('Supabase HTTP ' + res.status);
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? (rows[0].payload || null) : null;
  }

  async function subir(silencioso) {
    if (inFlight) return;
    inFlight = true;
    if (!silencioso) estado('sync', 'Subiendo datos a Supabase…');
    try {
      const data = snapshot();
      const res = await request(endpoint + '?on_conflict=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ id: row, payload: data, updated_at: new Date(data.savedAt).toISOString() }])
      });
      if (res.status === 404) { const e = new Error('Falta la tabla ' + table + '. Pulsa la nube para abrir el SQL Editor.'); e.code = 'SETUP'; throw e; }
      if (!res.ok) throw new Error('Supabase HTTP ' + res.status);
      try { localStorage.setItem(TS_KEY, String(data.savedAt)); } catch {}
      estado('ok', 'Nube BIM: datos guardados en Supabase');
      return data;
    } catch (error) {
      marcarError(error);
      throw error;
    } finally { inFlight = false; }
  }

  async function sincronizar(manual) {
    if (!navigator.onLine) { estado('offline', 'Sin conexión: los cambios se guardan localmente'); return; }
    if (inFlight) return;
    inFlight = true;
    estado('sync', 'Sincronizando con Supabase…');
    try {
      const remoto = await leer();
      if (!remoto) {
        inFlight = false;
        await subir(manual);
        if (manual) window.BIM_APP.registrar('Nube', 'Catálogo inicial subido a Supabase');
        return;
      }
      const remotoTs = Number(remoto.savedAt || 0);
      let localTs = 0;
      try { localTs = Number(localStorage.getItem(TS_KEY) || 0); } catch {}
      if (remotoTs > localTs + 1500 || (!localTs && remotoTs)) {
        window.BIM_APP.importar(remoto);
        try { localStorage.setItem(TS_KEY, String(remotoTs)); } catch {}
        estado('ok', 'Nube BIM: datos descargados de Supabase');
        window.BIM_APP.registrar('Nube', 'Datos descargados de Supabase');
        if (manual) return;
      } else {
        inFlight = false;
        const local = snapshot();
        if (local.savedAt > remotoTs + 1000) { await subir(manual); if (manual) window.BIM_APP.registrar('Nube', 'Cambios subidos a Supabase'); }
        else estado('ok', 'Nube BIM: todo sincronizado');
      }
      if (manual && !inFlight) window.BIM_APP.registrar('Nube', 'Sincronización manual completada');
    } catch (error) {
      marcarError(error);
      if (manual) window.BIM_APP.registrar('Nube', 'Error de sincronización: ' + error.message);
    } finally { inFlight = false; }
  }

  function marcarError(error) {
    const msg = String(error && error.message || 'Error de sincronización');
    if (error && error.code === 'SETUP') estado('setup', msg);
    else if (error && error.code === 'AUTH') estado('error', msg);
    else if (!navigator.onLine) estado('offline', 'Sin conexión: modo local');
    else estado('error', msg);
  }

  function programarSubida() {
    clearTimeout(timer);
    timer = setTimeout(() => { subir(true).catch(() => {}); }, 1200);
  }

  window.BIM_NUBE = Object.freeze({ sincronizar: () => sincronizar(true), subir: () => subir(false), leer });
  function arrancar() {
    if (!window.BIM_APP) { setTimeout(arrancar, 80); return; }
    window.addEventListener('inventario-cambio', programarSubida);
    window.addEventListener('online', () => { sincronizar(false).catch(() => {}); });
    window.addEventListener('offline', () => estado('offline', 'Sin conexión: modo local'));
    button()?.addEventListener('click', () => {
      if (button()?.dataset.state === 'setup') { window.open(sqlEditor, '_blank', 'noopener'); return; }
      sincronizar(true).catch(() => {});
    });
    estado('sync', 'Conectando con Supabase…');
    setTimeout(() => { sincronizar(false).catch(() => {}); }, 900);
  }
  if (document.readyState === 'complete') arrancar();
  else window.addEventListener('load', arrancar, { once: true });
})();
