// Value Investing · interfaz
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $("#app");
  const { ok, num } = Calc;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  const hoy = () => new Date().toISOString().slice(0, 10);

  // ── Formato de números (español) ──────────────────────────
  const NF = {};
  const nf = d => NF[d] || (NF[d] = new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmt = (v, d = 0) => ok(v) ? nf(d).format(v) : "—";
  const pct = (v, d = 1) => ok(v) ? nf(d).format(v * 100) + " %" : "—";
  const mon = (v, m, d = 2) => ok(v) ? nf(d).format(v) + " " + (m || "") : "—";
  const fechaTxt = s => s ? new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).trim().replace(/\s/g, "").replace(/%$/, "").replace(/−/g, "-");
    if (s === "" || s === "-") return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
    const n = Number(s);
    return isFinite(n) ? n : null;
  }
  const toInput = (v, esPct) => ok(v) ? String(+(esPct ? v * 100 : v).toFixed(esPct ? 4 : 6)).replace(".", ",") : "";

  // ── Almacenamiento: Supabase o, si no está configurado, este navegador ──
  const local = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
  };
  const CFG = (typeof CONFIG !== "undefined" && CONFIG) || {};
  const configurado = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);
  const nube = configurado && !!window.supabase;
  const sb = nube ? window.supabase.createClient(CFG.SUPABASE_URL.trim(), CFG.SUPABASE_KEY.trim()) : null;
  let usuario = null;

  const DB = {
    async lista() {
      if (!nube) return local.get("vi_empresas");
      const { data, error } = await sb.from("empresas").select("id, datos");
      if (error) throw error;
      return data.map(r => ({ ...r.datos, id: r.id }));
    },
    async guardar(x) {
      x.actualizado = new Date().toISOString();
      if (!nube) {
        const l = local.get("vi_empresas"), i = l.findIndex(e => e.id === x.id);
        if (i >= 0) l[i] = x; else l.push(x);
        return local.set("vi_empresas", l);
      }
      const { error } = await sb.from("empresas").upsert({ id: x.id, nombre: x.nombre || "", datos: x, actualizado: x.actualizado });
      if (error) throw error;
    },
    async borrar(id) {
      if (!nube) {
        local.set("vi_empresas", local.get("vi_empresas").filter(e => e.id !== id));
        return local.set("vi_valoraciones", local.get("vi_valoraciones").filter(v => v.empresa_id !== id));
      }
      const { error } = await sb.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    async registrar(x, r) {
      const fila = {
        id: uid(), empresa_id: x.id, fecha: new Date().toISOString(), valor: r.vi, precio: r.precio, moneda: x.moneda,
        detalle: { metodos: r.metodos.map(m => ({ k: m.k, valor: m.valor, peso: m.peso ?? null })), hip: clone(x.hip || {}), objetivo: r.objetivo }
      };
      if (!nube) { const l = local.get("vi_valoraciones"); l.push(fila); return local.set("vi_valoraciones", l); }
      const { error } = await sb.from("valoraciones").insert(fila);
      if (error) throw error;
    }
  };

  // ── Estado ────────────────────────────────────────────────
  let empresas = [];      // guardadas
  let E = null;           // empresa abierta (copia de trabajo)
  let tab = null;
  let sucio = false;
  let ignorarRuta = false;

  function nueva() {
    const y = new Date().getFullYear();
    return {
      id: uid(), nombre: "", ticker: "", region: "es", sector: "", tipo: "general", dividendosEstables: false,
      moneda: "EUR", unidades: "millones",
      mercado: { precio: null, fechaPrecio: hoy(), acciones: null, beta: null, deudaNeta: null, minoritarios: null, dpa: null },
      anios: [y - 3, y - 2, y - 1].map(anio => ({ anio })),
      hip: {}, comparables: [], multUsar: {}, pesos: {}, margenDeseado: null, objetivo: null, notas: "",
      resultado: null, creado: new Date().toISOString()
    };
  }

  // ── Utilidades de interfaz ───────────────────────────────
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600); }
  function modal(html) { const m = $("#modal"); m.innerHTML = `<div class="caja">${html}</div>`; m.classList.remove("hidden"); }
  function cerrarModal() { $("#modal").classList.add("hidden"); $("#modal").innerHTML = ""; }
  function getPath(o, p) { return p.split(".").reduce((a, k) => a == null ? undefined : a[k], o); }
  function setPath(o, p, v) {
    const ks = p.split("."); let a = o;
    ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; });
    a[ks[ks.length - 1]] = v;
  }
  const ay = k => DATOS.AYUDA[k] ? `<button type="button" class="ayuda" data-ayuda="${k}" aria-label="Ayuda">?</button>` : "";
  const NEG = new Set(["ebitda", "ebit", "bai", "impuestos", "bn", "patrimonio", "reservas", "fco", "deudaNeta", "gIni", "mObj", "nwcPct", "gTerm"]);
  function inp(path, t, extra = "") {
    const v = getPath(E, path), k = path.split(".").pop();
    const valor = t === "pct" ? toInput(v, true) : t === "num" ? toInput(v) : esc(v ?? "");
    const modo = t === "txt" ? "text" : (NEG.has(k) ? "text" : "decimal");
    return `<input type="text" inputmode="${modo}" autocomplete="off" data-k="${path}" data-t="${t}" value="${valor}" ${extra}>`;
  }
  function sel(path, opciones, re = true) {
    const v = getPath(E, path);
    return `<select data-k="${path}" data-t="txt" ${re ? "data-re" : ""}>${opciones.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  }
  const fld = (label, k, html) => `<div class="campo"><label>${esc(label)} ${ay(k)}</label>${html}</div>`;
  const unidadTxt = () => ({ millones: "millones", miles: "miles", unidades: "unidades" }[E.unidades] || "") + " de " + E.moneda;

  // ── Rutas ─────────────────────────────────────────────────
  const ir = h => { location.hash = h; };
  function ruta() {
    if (ignorarRuta) { ignorarRuta = false; return; }
    if (nube && !usuario) return vLogin();
    const [vista, id, t] = location.hash.replace(/^#\/?/, "").split("/");
    if (E && sucio && !(vista === "e" && id === E.id)) {
      if (!confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?")) { ignorarRuta = true; location.hash = `#/e/${E.id}/${tab}`; return; }
      sucio = false;
    }
    if (vista === "nueva") { E = nueva(); sucio = true; return ir(`#/e/${E.id}/empresa`); }
    if (vista === "e" && id) return vEmpresa(id, TABS[t] ? t : "empresa");
    vCartera();
  }

  // ── Acceso (solo con Supabase) ───────────────────────────
  function vLogin() {
    $("#sesion").innerHTML = "";
    quitarGuardar();
    app.innerHTML = `
      <form class="login panel" id="flogin">
        <h1>Value Investing</h1>
        <p class="mut" style="margin:4px 0 16px">Entra con el usuario que creaste en Supabase.</p>
        <div class="campo"><label>Email</label><input type="email" id="lemail" autocomplete="username" required></div>
        <div class="campo" style="margin-top:10px"><label>Contraseña</label><input type="password" id="lpass" autocomplete="current-password" required></div>
        <button class="btn pri" style="width:100%;margin-top:16px;justify-content:center">Entrar</button>
        <p id="lerr" class="neg small"></p>
      </form>`;
  }
  async function entrar(e) {
    e.preventDefault();
    $("#lerr").textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#lemail").value.trim(), password: $("#lpass").value });
    if (error) { $("#lerr").textContent = "No se ha podido entrar: revisa el email y la contraseña."; return; }
    usuario = data.user;
    await arrancar();
  }
  function pintarSesion() {
    $("#sesion").innerHTML = nube
      ? `<span class="hide-m">${esc(usuario?.email || "")}</span><button class="btn mini" data-act="salir">Salir</button>`
      : `<span>Modo local</span>`;
  }

  // ── Cartera ───────────────────────────────────────────────
  function vCartera() {
    E = null; tab = null; quitarGuardar();
    const lista = empresas.slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
    const datos = lista.map(x => {
      const r = x.resultado || {}, precio = num(x.mercado?.precio), vi = r.vi;
      const ms = ok(vi) && vi > 0 && ok(precio) ? (vi - precio) / vi : null;
      const bajo = ok(r.objetivo) && ok(precio) && precio <= r.objetivo;
      return { x, r, precio, vi, ms, bajo };
    });
    const nOp = datos.filter(d => d.bajo).length;
    const aviso = !configurado
      ? `<div class="banner">Modo local: los datos se guardan solo en este navegador. Configura Supabase en <b>config.js</b> para verlos en el iPhone y en el ordenador.</div>`
      : (!nube ? `<div class="banner">No se ha podido cargar Supabase (¿sin conexión?). Recarga la página.</div>` : "");
    app.innerHTML = `
      ${aviso}
      <div class="cabecera">
        <div><h1>Cartera</h1><div class="sub">${lista.length} ${lista.length === 1 ? "empresa" : "empresas"}${nOp ? ` · <span class="pos">${nOp} por debajo de tu precio objetivo</span>` : ""}</div></div>
        <a class="btn pri" href="#/nueva">+ Nueva empresa</a>
      </div>
      ${lista.length ? `<div class="tarjetas">${datos.map(tarjeta).join("")}</div>` : `
        <div class="panel vacio"><h2 style="color:var(--txt);margin-bottom:6px">Aún no hay empresas</h2>
        <p>Añade la primera: introduce sus estados financieros, revisa las hipótesis y compara su valor con el precio.</p>
        <a class="btn pri" href="#/nueva" style="margin-top:8px">+ Nueva empresa</a></div>`}`;
  }
  function tarjeta({ x, r, precio, vi, ms, bajo }) {
    const cls = !ok(ms) ? "" : ms >= 0.25 ? "pos" : ms >= 0 ? "warn" : "neg";
    const sector = (DATOS.SECTORES.find(s => s[0] === x.sector) || [])[1];
    return `
      <div class="tarjeta ${bajo ? "oportunidad" : ""}">
        <div class="fila entre">
          <a href="#/e/${x.id}/resultado"><div class="nombre">${esc(x.nombre || "Sin nombre")} ${x.ticker ? `<span class="dim small">${esc(x.ticker)}</span>` : ""}</div>
          <div class="small mut">${esc(sector || "Sin sector")} · ${esc(x.moneda)}</div></a>
          ${bajo ? `<span class="badge pos">Bajo objetivo</span>` : ""}
        </div>
        <div class="cifras">
          <div><div class="l">Precio</div><div class="v">${fmt(precio, 2)}</div></div>
          <div><div class="l">Valor intrínseco</div><div class="v">${fmt(vi, 2)}</div></div>
          <div><div class="l">Margen seg.</div><div class="v ${cls}">${pct(ms)}</div></div>
          <div><div class="l">Objetivo</div><div class="v">${fmt(r.objetivo, 2)}</div></div>
        </div>
        <div class="fila entre">
          <span class="small dim">Valorada ${fechaTxt(r.fecha)} · precio ${fechaTxt(x.mercado?.fechaPrecio)}</span>
          <span class="fila" style="gap:6px"><button class="btn mini" data-act="precio" data-id="${x.id}">Actualizar precio</button><a class="btn mini" href="#/e/${x.id}/empresa">Abrir</a></span>
        </div>
      </div>`;
  }
  function modalPrecio(id) {
    const x = empresas.find(e => e.id === id); if (!x) return;
    modal(`
      <h2>Actualizar precio</h2>
      <p>${esc(x.nombre)}. Tu valoración no cambia; solo se recalcula el margen de seguridad.</p>
      <div class="campo"><label>Precio por acción (${esc(x.moneda)})</label><input id="mprecio" type="text" inputmode="decimal" value="${toInput(x.mercado?.precio)}"></div>
      <div class="fila" style="justify-content:flex-end;margin-top:16px">
        <button class="btn" data-act="cerrar">Cancelar</button>
        <button class="btn pri" data-act="okPrecio" data-id="${x.id}">Guardar</button>
      </div>`);
    setTimeout(() => { const i = $("#mprecio"); if (i) { i.focus(); i.select(); } }, 50);
  }
  async function guardarPrecio(id) {
    const x = empresas.find(e => e.id === id), p = parseNum($("#mprecio").value);
    if (!x || !ok(p) || p <= 0) return toast("Introduce un precio válido");
    x.mercado = x.mercado || {}; x.mercado.precio = p; x.mercado.fechaPrecio = hoy();
    try { await DB.guardar(x); cerrarModal(); toast("Precio actualizado"); vCartera(); }
    catch (err) { toast("Error al guardar: " + err.message); }
  }

  // ── Ficha de empresa ─────────────────────────────────────
  const TABS = {
    empresa: { t: "Empresa", html: tEmpresa, salida: sEmpresa },
    estados: { t: "Estados financieros", html: tEstados, salida: sEstados },
    dcf: { t: "DCF", html: tDcf, salida: sDcf },
    multiplos: { t: "Múltiplos", html: tMultiplos, salida: sMultiplos },
    resultado: { t: "Resultado", html: tResultado, salida: sResultado }
  };

  function vEmpresa(id, t) {
    if (!E || E.id !== id) {
      const x = empresas.find(e => e.id === id);
      if (!x) return ir("#/");
      E = clone(x); sucio = false;
    }
    const cambiaTab = tab !== t;
    tab = t;
    const y = window.scrollY;
    app.innerHTML = `
      <div class="cabecera">
        <div><a href="#/" class="small">← Cartera</a><h1 id="cab-nombre">${esc(E.nombre || "Nueva empresa")}</h1><div class="sub" id="cab-sub"></div></div>
      </div>
      <nav class="tabs">${Object.entries(TABS).map(([k, v]) => `<a href="#/e/${E.id}/${k}" class="${k === t ? "on" : ""}">${v.t}</a>`).join("")}</nav>
      <div id="contenido">${TABS[t].html()}</div>`;
    ponerGuardar();
    refrescar();
    window.scrollTo(0, cambiaTab ? 0 : y);
  }
  const repintar = () => vEmpresa(E.id, tab);

  function refrescar() {
    if (!E) return;
    $("#cab-nombre").textContent = E.nombre || "Nueva empresa";
    const r = Calc.resultado(E);
    const cls = !ok(r.margen) ? "" : r.margen >= 0.25 ? "pos" : r.margen >= 0 ? "warn" : "neg";
    $("#cab-sub").innerHTML = [
      E.ticker ? esc(E.ticker) : null,
      `Precio ${mon(r.precio, E.moneda)}`,
      `Valor intrínseco ${mon(r.vi, E.moneda)}`,
      ok(r.margen) ? `<span class="${cls}">Margen ${pct(r.margen)}</span>` : null
    ].filter(Boolean).join(" · ");
    TABS[tab].salida(r);
  }

  // Pestaña Empresa
  function tEmpresa() {
    const regiones = DATOS.REGIONES, sectores = [["", "Elige un sector…"], ...DATOS.SECTORES];
    const monedas = Object.keys(DATOS.MONEDAS).map(k => [k, k]);
    return `
      <div class="panel"><h3>Identificación</h3>
        <div class="grid">
          ${fld("Nombre", "", inp("nombre", "txt", 'placeholder="Ej. Inditex"'))}
          ${fld("Ticker", "", inp("ticker", "txt", 'placeholder="Ej. ITX.MC"'))}
          ${fld("Región", "", sel("region", regiones))}
          ${fld("Sector", "", sel("sector", sectores))}
          ${fld("Tipo de empresa", "tipo", sel("tipo", [["general", "Empresa no financiera"], ["banco", "Banco"], ["aseguradora", "Aseguradora"]]))}
          ${fld("Moneda", "", sel("moneda", monedas))}
          ${fld("Unidades de los estados", "unidades", sel("unidades", [["millones", "Millones"], ["miles", "Miles"], ["unidades", "Unidades"]]))}
          <div class="campo"><label>&nbsp;</label><label class="check"><input type="checkbox" data-k="dividendosEstables" data-t="bool" data-re ${E.dividendosEstables ? "checked" : ""}> Dividendos estables ${ay("dividendosEstables")}</label></div>
        </div>
      </div>
      <div class="panel"><h3>Mercado</h3>
        <div class="grid">
          ${fld(`Precio por acción (${E.moneda})`, "precio", inp("mercado.precio", "num"))}
          <div class="campo"><label>Fecha del precio</label><input type="date" data-k="mercado.fechaPrecio" data-t="txt" value="${esc(E.mercado.fechaPrecio || "")}"></div>
          ${fld("Acciones en circulación (millones)", "acciones", inp("mercado.acciones", "num"))}
          ${fld("Beta", "beta", inp("mercado.beta", "num", 'placeholder="1,0"'))}
          ${fld(`Deuda neta (${unidadTxt()})`, "deudaNeta", inp("mercado.deudaNeta", "num", 'id="i-dn"'))}
          ${fld(`Minoritarios (${unidadTxt()})`, "minoritarios", inp("mercado.minoritarios", "num", 'placeholder="0"'))}
          ${fld(`Dividendo por acción (${E.moneda})`, "dpa", inp("mercado.dpa", "num"))}
        </div>
      </div>
      <div class="panel"><h3>Métodos que se aplicarán</h3><div id="o-metodos"></div></div>
      <div class="panel"><h3>Tesis de inversión y notas</h3>
        <textarea data-k="notas" data-t="txt" placeholder="Por qué te interesa, ventajas competitivas, riesgos, catalizadores, qué tendría que pasar para que cambies de opinión…">${esc(E.notas || "")}</textarea>
      </div>
      ${empresas.some(e => e.id === E.id) ? `<div class="fila" style="justify-content:flex-end"><button class="btn peligro" data-act="borrar">Eliminar empresa</button></div>` : ""}`;
  }
  function sEmpresa() {
    const m = Calc.mercado(E), dn = $("#i-dn");
    if (dn) dn.placeholder = ok(m.dnProp) ? `${toInput(Math.round(m.dnProp * 100) / 100)} (último balance)` : "Se calcula con el balance";
    const et = { si: "Se aplica", no: "Descartado", cautela: "Con cautela", fase: "Próximamente" };
    $("#o-metodos").innerHTML = Calc.seleccion(E).map(x => `
      <div class="metodo"><span class="estado ${x.e}">${et[x.e]}</span><div><b>${esc(x.n)}</b><div class="small mut">${esc(x.t)}</div></div></div>`).join("");
  }

  // Pestaña Estados financieros
  function tEstados() {
    E.anios.sort((a, b) => (num(a.anio) ?? 0) - (num(b.anio) ?? 0));
    const A = E.anios;
    const cab = A.map((a, i) => `<th>${inp(`anios.${i}.anio`, "num", 'inputmode="numeric" data-re')}<button class="icono" data-act="quitarAnio" data-i="${i}" title="Quitar año" aria-label="Quitar año">×</button></th>`).join("");
    const cuerpo = DATOS.CAMPOS.map(g => `
      <tr class="sub"><td class="etq-col">${g.grupo}</td><td colspan="${A.length}"></td></tr>
      ${g.campos.map(([k, opc]) => `<tr><td class="etq-col"><span class="etq">${esc(DATOS.AYUDA[k][0])}${opc ? '<span class="opc">opc.</span>' : ""} ${ay(k)}</span></td>
        ${A.map((a, i) => `<td>${inp(`anios.${i}.${k}`, "num")}</td>`).join("")}</tr>`).join("")}`).join("");
    return `
      <div class="panel">
        <div class="fila entre">
          <p class="mut" style="margin:0">Cifras en <b style="color:var(--txt)">${unidadTxt()}</b>. Gastos, impuestos, capex y dividendos, en positivo. Toca <b style="color:var(--txt)">?</b> para ver qué va en cada campo y dónde encontrarlo.</p>
          <div class="fila"><button class="btn mini" data-act="anio" data-d="-1">+ Año anterior</button><button class="btn mini" data-act="anio" data-d="1">+ Año siguiente</button></div>
        </div>
        <p class="nota">Los campos marcados «opc.» no hacen falta ahora; se usarán en los indicadores de calidad (fase 3).</p>
      </div>
      ${A.length ? `<div class="tabla-wrap estados"><table><thead><tr><th class="etq-col">Concepto</th>${cab}</tr></thead><tbody>${cuerpo}</tbody></table></div>` : `<div class="panel vacio">Añade al menos un año.</div>`}
      <div class="panel" style="margin-top:14px"><h3>Ratios calculados (para revisar los datos)</h3><div id="o-ratios"></div></div>`;
  }
  function sEstados() {
    const H = Calc.historico(E);
    if (!H.length) { $("#o-ratios").innerHTML = `<p class="mut">Sin datos todavía.</p>`; return; }
    const filas = [
      ["Crecimiento de ventas", x => pct(x.crec)], ["Margen EBITDA", x => pct(x.mEbitda)], ["Margen EBIT", x => pct(x.mEbit)],
      ["Margen neto", x => pct(x.mNeto)], ["Tipo impositivo efectivo", x => pct(x.tasa)], ["FCFF", x => fmt(x.fcff)],
      ["Flujo libre (FCO − capex)", x => fmt(x.fcl)], ["ROIC", x => pct(x.roic)], ["ROE", x => pct(x.roe)], ["Deuda neta / EBITDA", x => ok(x.deudaEbitda) ? fmt(x.deudaEbitda, 1) + "x" : "—"]
    ];
    $("#o-ratios").innerHTML = `<div class="tabla-wrap"><table><thead><tr><th class="etq-col">Ratio</th>${H.map(x => `<th>${x.anio}</th>`).join("")}</tr></thead>
      <tbody>${filas.map(([t, f]) => `<tr><td class="etq-col">${t}</td>${H.map(x => `<td>${f(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="nota">FCFF = EBIT × (1 − t) + amortizaciones − capex − variación del circulante. ROIC sobre capital invertido medio (patrimonio + deuda − caja).</p>`;
  }

  // Pestaña DCF
  const GRUPOS_HIP = [
    ["Crecimiento y márgenes", [["gIni", "pct"], ["mObj", "pct"], ["anos", "num"], ["tax", "pct"]]],
    ["Reinversión", [["daPct", "pct"], ["capexPct", "pct"], ["nwcPct", "pct"]]],
    ["Coste de capital (WACC)", [["rf", "pct"], ["erp", "pct"], ["crp", "pct"], ["beta", "num"], ["kd", "pct"], ["pesoDeuda", "pct"]]],
    ["Valor terminal", [["gTerm", "pct"], ["pibLP", "pct"], ["roicT", "pct"]]]
  ];
  function tDcf() {
    if (Calc.esFinanciera(E)) return `<div class="panel"><h3>DCF no aplicable</h3><p class="mut" style="margin:0">${esc(Calc.dcf(E).motivo)}</p></div>`;
    const grupos = GRUPOS_HIP.map(([g, ks]) => `
      <div class="panel"><h3>${g}</h3>
        ${ks.map(([k, t]) => {
          const puesto = ok(num(E.hip?.[k]));
          return `<div class="hip">
            <div class="etq">${esc(DATOS.AYUDA[k][0])} ${ay(k)}</div>
            <div class="ctl"><div class="unidad">${inp(`hip.${k}`, t, `class="${puesto ? "cambiado" : ""}"`)}<span>${t === "pct" ? "%" : (k === "anos" ? "años" : "")}</span></div>
              <button class="icono reset ${puesto ? "on" : ""}" data-act="reset" data-k="${k}" title="Volver a la propuesta" aria-label="Volver a la propuesta">↺</button></div>
            <div class="exp" data-prop="${k}"></div>
          </div>`;
        }).join("")}
      </div>`).join("");
    return `
      <div class="avisos" id="o-avisos"></div>
      <div class="panel"><h3>Valoración DCF</h3><div id="o-val"></div></div>
      <p class="nota" style="margin:0 0 14px">Los campos vacíos usan la <b>propuesta</b> calculada con tu histórico (en gris). Escribe un valor para cambiarla; se resalta en azul y puedes volver a la propuesta con ↺.</p>
      ${grupos}
      <div class="panel"><h3>Coste de capital</h3><div id="o-wacc"></div></div>
      <div class="panel"><h3>Proyección de flujos (${unidadTxt()})</h3><div id="o-proy"></div></div>`;
  }
  function sDcf(r) {
    if (Calc.esFinanciera(E)) return;
    const d = r.d, H = d.H || Calc.hipotesis(E);
    GRUPOS_HIP.forEach(([, ks]) => ks.forEach(([k, t]) => {
      const p = H.P[k], i = $(`[data-k="hip.${k}"]`), ex = $(`[data-prop="${k}"]`);
      if (i) i.placeholder = p && ok(p.v) ? toInput(p.v, t === "pct") : "";
      if (ex) ex.textContent = p ? `Propuesta: ${ok(p.v) ? (t === "pct" ? pct(p.v) : fmt(p.v, k === "beta" ? 2 : 0)) : "—"}. ${p.t}` : "";
    }));
    $("#o-avisos").innerHTML = d.avisos.map(a => `<div class="av ${a.n}">${esc(a.t)}</div>`).join("");
    const h = H.h;
    $("#o-wacc").innerHTML = `<div class="kpis">
      <div class="kpi"><div class="l">Coste del equity (CAPM)</div><div class="v">${pct(H.ke, 2)}</div><div class="small dim">${pct(h.rf)} + ${fmt(h.beta, 2)} × ${pct(h.erp)}${h.crp ? ` + ${pct(h.crp)}` : ""}</div></div>
      <div class="kpi"><div class="l">Coste de la deuda neto</div><div class="v">${pct(H.kdNet, 2)}</div><div class="small dim">${pct(h.kd)} × (1 − ${pct(h.tax)})</div></div>
      <div class="kpi"><div class="l">Peso deuda / equity</div><div class="v">${pct(h.pesoDeuda, 0)} / ${pct(1 - h.pesoDeuda, 0)}</div></div>
      <div class="kpi"><div class="l">WACC</div><div class="v" style="color:var(--acc)">${pct(H.wacc, 2)}</div></div></div>`;
    if (!d.ok) {
      $("#o-val").innerHTML = `<p class="mut" style="margin:0">${esc(d.motivo || "")}</p>`;
      $("#o-proy").innerHTML = `<p class="mut" style="margin:0">—</p>`;
      return;
    }
    const m = Calc.mercado(E), pot = ok(d.porAccion) && ok(m.precio) ? d.porAccion / m.precio - 1 : null;
    $("#o-val").innerHTML = `
      <div class="kpis" style="margin-bottom:14px">
        <div class="kpi grande"><div class="l">Valor por acción (DCF)</div><div class="v">${mon(d.porAccion, E.moneda)}</div></div>
        <div class="kpi"><div class="l">Precio</div><div class="v">${mon(m.precio, E.moneda)}</div></div>
        <div class="kpi"><div class="l">Potencial</div><div class="v ${pot >= 0 ? "pos" : "neg"}">${pct(pot)}</div></div>
        <div class="kpi"><div class="l">Peso del valor terminal</div><div class="v ${d.pesoTV > 0.8 ? "warn" : ""}">${pct(d.pesoTV, 0)}</div></div>
      </div>
      <div class="tabla-wrap"><table class="puente"><tbody>
        <tr><td>Valor actual de los flujos (${d.N} años)</td><td>${fmt(d.pv)}</td></tr>
        <tr><td>Valor terminal en el año ${d.N} <div class="dim small">FCFF ${fmt(d.fcffT)} / (${pct(H.wacc)} − ${pct(h.gTerm)}) · reinversión ${pct(d.rr)}</div></td><td>${fmt(d.tv)}</td></tr>
        <tr><td>Valor actual del valor terminal</td><td>${fmt(d.pvTv)}</td></tr>
        <tr class="total"><td>Valor de la empresa (EV)</td><td>${fmt(d.ev)}</td></tr>
        <tr><td>− Deuda neta</td><td>${fmt(d.deudaNeta)}</td></tr>
        <tr><td>− Minoritarios</td><td>${fmt(d.minoritarios)}</td></tr>
        <tr class="total"><td>Valor para el accionista</td><td>${fmt(d.eq)}</td></tr>
        <tr><td>÷ Acciones (millones)</td><td>${fmt(m.acciones, 2)}</td></tr>
        <tr class="total"><td>Valor por acción</td><td>${mon(d.porAccion, E.moneda)}</td></tr>
      </tbody></table></div>`;
    const f = [
      ["Ventas", x => fmt(x.ventas)], ["Crecimiento", x => pct(x.g)], ["Margen EBIT", x => pct(x.mg)], ["EBIT", x => fmt(x.ebit)],
      ["NOPAT", x => fmt(x.nopat)], ["+ Amortizaciones", x => fmt(x.da)], ["− Capex", x => fmt(x.capex)], ["− Δ Circulante", x => fmt(x.dnwc)],
      ["FCFF", x => `<b>${fmt(x.fcff)}</b>`], ["Factor de descuento", x => fmt(x.fd, 3)], ["Valor actual", x => fmt(x.va)]
    ];
    $("#o-proy").innerHTML = `<div class="tabla-wrap"><table><thead><tr><th class="etq-col"></th>${d.proj.map(x => `<th>${x.anio}</th>`).join("")}</tr></thead>
      <tbody>${f.map(([t, fn]) => `<tr><td class="etq-col">${t}</td>${d.proj.map(x => `<td>${fn(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  // Pestaña Múltiplos
  function tMultiplos() {
    const sug = DATOS.COMPARABLES[E.sector];
    const zona = { es: "es", eu: "eu", us: "us" }[E.region] || "em";
    const nombres = { es: "España", eu: "Europa", us: "EE. UU.", em: "Emergentes y resto" };
    const ya = new Set((E.comparables || []).map(c => (c.nombre || "").toLowerCase()));
    const chips = z => (sug[z] || []).filter(n => n.toLowerCase() !== (E.nombre || "").toLowerCase())
      .map(n => `<button class="chip" data-act="addComp" data-n="${esc(n)}" ${ya.has(n.toLowerCase()) ? "disabled style='opacity:.4'" : ""}>+ ${esc(n)}</button>`).join("") || `<span class="dim small">Sin sugerencias en esta zona.</span>`;
    const orden = [zona, ...["es", "eu", "us", "em"].filter(z => z !== zona)];
    const sugerencias = !sug
      ? `<p class="mut" style="margin:0">${E.sector === "otro" ? "Sector «Otro»: busca empresas con el mismo modelo de negocio, tamaño parecido y mercados similares." : "Elige el sector en la pestaña «Empresa» para ver sugerencias."}</p>`
      : `<p class="small mut" style="margin:0 0 10px">Primero las de tu zona. Son orientativas: quédate con las que tengan un negocio, crecimiento y riesgo de verdad parecidos.</p>
         ${orden.map(z => `<div style="margin-bottom:10px"><div class="small dim" style="margin-bottom:6px">${nombres[z]}</div><div class="chips">${chips(z)}</div></div>`).join("")}`;
    const C = E.comparables || [];
    const fin = Calc.esFinanciera(E);
    const cols = [["per", "PER"], ["evEbitda", "EV/EBITDA"], ["pvc", "P/VC"], ["evVentas", "EV/Ventas"]];
    return `
      <div class="panel"><h3>Comparables sugeridas</h3>${sugerencias}</div>
      <div class="panel"><h3>Tus comparables</h3>
        <p class="small mut" style="margin:0 0 10px">Copia los múltiplos actuales de cada una (Yahoo Finance, Marketscreener, Investing…). Usa el mismo criterio para todas: últimos 12 meses o estimación del próximo año. Deja vacío lo que no tengas.${fin ? " En financieras solo cuentan PER y P/VC." : ""}</p>
        ${C.length ? `<div class="tabla-wrap estados"><table><thead><tr><th class="etq-col">Empresa</th>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
          ${C.map((c, i) => `<tr><td class="etq-col">${inp(`comparables.${i}.nombre`, "txt", 'style="width:100%;text-align:left"')}</td>${cols.map(([k]) => `<td>${inp(`comparables.${i}.${k}`, "num")}</td>`).join("")}
          <td><button class="icono" data-act="quitarComp" data-i="${i}" aria-label="Quitar">×</button></td></tr>`).join("")}
        </tbody></table></div>` : ""}
        <button class="btn mini" style="margin-top:10px" data-act="addComp" data-n="">+ Añadir comparable</button>
      </div>
      <div class="panel"><h3>Valoración por múltiplos</h3><div id="o-mult"></div></div>
      <p class="nota">Referencia de múltiplos medios del sector (Damodaran): llega en la fase 2.</p>`;
  }
  function sMultiplos(r) {
    const mu = r.mu, x = mu.filas;
    const vx = v => ok(v) ? fmt(v, 1) + "x" : "—";
    $("#o-mult").innerHTML = `
      <div class="tabla-wrap"><table><thead><tr><th>Múltiplo</th><th>Usar</th><th>Comps.</th><th>Mediana</th><th>Rango</th><th>Empresa hoy</th><th>Valor/acción</th><th>Rango valor</th></tr></thead><tbody>
      ${x.map(f => f.aplicable ? `<tr>
          <td><b>${f.nombre}</b></td>
          <td><input type="checkbox" style="width:18px;height:18px;min-height:0;accent-color:var(--acc)" data-k="multUsar.${f.k}" data-t="bool" ${f.usar ? "checked" : ""}></td>
          <td>${f.n}</td><td>${vx(f.med)}</td><td>${vx(f.min)} – ${vx(f.max)}</td><td>${vx(f.propio)}</td>
          <td><b>${fmt(f.vMed, 2)}</b></td><td>${fmt(f.vMin, 2)} – ${fmt(f.vMax, 2)}</td></tr>`
        : `<tr><td><b>${f.nombre}</b></td><td colspan="7" class="small mut" style="text-align:left;white-space:normal">${esc(f.motivo)}${ok(f.propio) ? ` (empresa hoy: ${vx(f.propio)})` : ""}</td></tr>`).join("")}
      </tbody></table></div>
      ${ok(mu.porAccion)
        ? `<div class="kpis" style="margin-top:14px"><div class="kpi grande"><div class="l">Valor por múltiplos (media de medianas)</div><div class="v">${mon(mu.porAccion, E.moneda)}</div></div>
           <div class="kpi"><div class="l">Rango</div><div class="v">${fmt(mu.lo, 2)} – ${fmt(mu.hi, 2)}</div></div>
           <div class="kpi"><div class="l">Precio</div><div class="v">${mon(r.precio, E.moneda)}</div></div></div>`
        : `<p class="mut" style="margin:12px 0 0">${esc(mu.motivo)}</p>`}
      <p class="nota">Se usa la mediana de las comparables (menos sensible a extremos). Los múltiplos sobre EV se convierten a valor por acción restando deuda neta y minoritarios.</p>`;
  }

  // Pestaña Resultado
  function tResultado() {
    return `
      <div class="panel"><h3>Valor intrínseco frente a precio</h3><div id="o-kpis"></div></div>
      <div class="panel"><h3>Comparación</h3><div id="o-barras"></div></div>
      <div class="panel"><h3>Ponderación de métodos</h3>
        <p class="small mut" style="margin:0 0 6px">La web propone repartir el peso a partes iguales entre los métodos con resultado. Cámbialo si te fías más de uno (los pesos se reescalan para sumar 100 %).</p>
        ${[["dcf", "DCF (FCFF)"], ["mult", "Múltiplos comparables"]].map(([k, t]) => `
          <div class="hip"><div class="etq">${t} <div class="dim small" data-mval="${k}"></div></div>
          <div class="ctl"><div class="unidad">${inp(`pesos.${k}`, "pct", `class="${ok(num(E.pesos?.[k])) ? "cambiado" : ""}"`)}<span>%</span></div>
          <button class="icono reset ${ok(num(E.pesos?.[k])) ? "on" : ""}" data-act="resetPath" data-k="pesos.${k}" aria-label="Volver a la propuesta">↺</button></div></div>`).join("")}
      </div>
      <div class="panel"><h3>Precio objetivo de compra</h3>
        <div class="grid">
          ${fld("Margen de seguridad exigido", "margenDeseado", `<div class="unidad">${inp("margenDeseado", "pct", 'placeholder="25"')}<span>%</span></div>`)}
          ${fld(`Precio objetivo (${E.moneda})`, "objetivo", inp("objetivo", "num", 'id="i-obj"'))}
        </div>
      </div>`;
  }
  function sResultado(r) {
    const cls = !ok(r.margen) ? "" : r.margen >= 0.25 ? "pos" : r.margen >= 0 ? "warn" : "neg";
    const bajo = ok(r.objetivo) && ok(r.precio) && r.precio <= r.objetivo;
    $("#o-kpis").innerHTML = ok(r.vi) ? `
      <div class="kpis">
        <div class="kpi grande"><div class="l">Valor intrínseco</div><div class="v">${mon(r.vi, E.moneda)}</div></div>
        <div class="kpi grande"><div class="l">Precio</div><div class="v">${mon(r.precio, E.moneda)}</div></div>
        <div class="kpi"><div class="l">Margen de seguridad</div><div class="v ${cls}">${pct(r.margen)}</div><div class="small dim">(valor − precio) / valor</div></div>
        <div class="kpi"><div class="l">Potencial de revalorización</div><div class="v ${r.potencial >= 0 ? "pos" : "neg"}">${pct(r.potencial)}</div><div class="small dim">valor / precio − 1</div></div>
        <div class="kpi"><div class="l">Precio objetivo</div><div class="v">${mon(r.objetivo, E.moneda)}</div><div class="small ${bajo ? "pos" : "dim"}">${bajo ? "El precio está por debajo: zona de compra" : `Exige un ${pct(r.md, 0)} de descuento`}</div></div>
      </div>`
      : `<p class="mut" style="margin:0">Todavía no hay ningún método con resultado. Completa «Estados financieros» y el precio, y revisa el DCF o añade comparables.</p>`;
    r.metodos.forEach(m => { const el = $(`[data-mval="${m.k}"]`); if (el) el.textContent = ok(m.valor) ? `${mon(m.valor, E.moneda)}${ok(m.peso) && r.sumaPesos ? ` · peso efectivo ${pct(m.peso / r.sumaPesos, 0)}` : ""}` : "sin resultado"; });
    ["dcf", "mult"].forEach(k => { const i = $(`[data-k="pesos.${k}"]`), m = r.metodos.find(x => x.k === k); if (i) i.placeholder = m && ok(m.valor) ? toInput(1 / r.metodos.filter(x => ok(x.valor)).length, true) : "—"; });
    const io = $("#i-obj"); if (io) io.placeholder = ok(r.objProp) ? toInput(Math.round(r.objProp * 100) / 100) : "";
    // Barras
    const filas = [
      ...r.metodos.filter(m => ok(m.valor)).map(m => ({ t: m.nombre, v: m.valor, lo: m.lo, hi: m.hi, c: "" })),
      ok(r.vi) ? { t: "Valor intrínseco ponderado", v: r.vi, c: "vi" } : null,
      ok(r.objetivo) ? { t: "Precio objetivo", v: r.objetivo, c: "" } : null,
      ok(r.precio) ? { t: "Precio actual", v: r.precio, c: "precio" } : null
    ].filter(Boolean);
    const maxV = Math.max(...filas.flatMap(f => [f.v, f.hi]).filter(x => ok(x) && x > 0), 0) * 1.1;
    $("#o-barras").innerHTML = filas.length && maxV > 0 ? `<div class="barras">${filas.map(f => {
      const p = x => Math.max(0, Math.min(100, x / maxV * 100));
      return `<div class="barra ${f.c}"><div class="l"><span>${esc(f.t)}</span><span class="n">${mon(f.v, E.moneda)}${ok(f.lo) ? ` <span class="dim">(${fmt(f.lo, 2)} – ${fmt(f.hi, 2)})</span>` : ""}</span></div>
        <div class="pista">${ok(f.lo) && ok(f.hi) ? `<div class="rango" style="left:${p(f.lo)}%;width:${Math.max(1, p(f.hi) - p(f.lo))}%"></div>` : ""}<div class="punto" style="left:${p(f.v)}%"></div></div></div>`;
    }).join("")}</div><p class="nota">El gráfico «football field» completo, con escenarios y todos los métodos, llega en la fase 2.</p>` : `<p class="mut" style="margin:0">—</p>`;
  }

  // ── Guardado ──────────────────────────────────────────────
  function ponerGuardar() {
    let b = $("#barra-guardar");
    if (!b) {
      b = document.createElement("div"); b.id = "barra-guardar"; b.className = "guardar";
      b.innerHTML = `<span class="estado-g"></span><button class="btn pri" data-act="guardar">Guardar</button>`;
      document.body.appendChild(b);
    }
    marcar();
  }
  function quitarGuardar() { $("#barra-guardar")?.remove(); }
  function marcar() {
    const b = $("#barra-guardar"); if (!b) return;
    b.classList.toggle("sucio", sucio);
    $(".estado-g", b).textContent = sucio ? "Cambios sin guardar" : (E?.actualizado ? `Guardado · ${fechaTxt(E.actualizado)}` : "");
  }
  async function guardar() {
    if (!(E.nombre || "").trim()) { toast("Ponle un nombre a la empresa"); return ir(`#/e/${E.id}/empresa`); }
    const r = Calc.resultado(E), prev = E.resultado;
    let registrar = false;
    if (ok(r.vi)) {
      registrar = !prev || !ok(prev.vi) || Math.abs(r.vi - prev.vi) > 1e-6 * Math.max(1, Math.abs(r.vi));
      E.resultado = { vi: r.vi, objetivo: r.objetivo, md: r.md, fecha: registrar ? new Date().toISOString() : prev.fecha, metodos: Object.fromEntries(r.metodos.map(m => [m.k, m.valor])) };
    } else E.resultado = null;
    const btn = $('[data-act="guardar"]'); if (btn) btn.disabled = true;
    try {
      await DB.guardar(E);
      if (registrar) await DB.registrar(E, r);
      const i = empresas.findIndex(e => e.id === E.id), copia = clone(E);
      if (i >= 0) empresas[i] = copia; else empresas.push(copia);
      sucio = false; marcar();
      toast(registrar ? "Guardado · nueva valoración registrada" : "Guardado");
      if (tab === "empresa") repintar();
    } catch (err) { toast("Error al guardar: " + (err.message || err)); }
    finally { if (btn) btn.disabled = false; }
  }
  async function borrar() {
    if (!confirm(`¿Eliminar ${E.nombre || "esta empresa"} y todo su histórico? No se puede deshacer.`)) return;
    try {
      await DB.borrar(E.id);
      empresas = empresas.filter(e => e.id !== E.id);
      sucio = false; E = null; toast("Empresa eliminada"); ir("#/");
    } catch (err) { toast("Error: " + (err.message || err)); }
  }

  // ── Eventos ──────────────────────────────────────────────
  function editar(e) {
    const el = e.target.closest("[data-k]");
    if (!el || !E || !app.contains(el)) return;
    const esTexto = el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text");
    if (e.type === "input" && !esTexto) return;
    if (e.type === "change" && esTexto && !el.hasAttribute("data-re")) return;
    const t = el.dataset.t, k = el.dataset.k;
    let v;
    if (t === "bool") v = el.checked;
    else if (t === "num") v = parseNum(el.value);
    else if (t === "pct") { const n = parseNum(el.value); v = ok(n) ? n / 100 : null; }
    else v = el.value;
    setPath(E, k, v);
    if (k === "sector") { if (v === "banca") E.tipo = "banco"; else if (v === "seguros") E.tipo = "aseguradora"; }
    if (/^(hip|pesos)\./.test(k)) {
      el.classList.toggle("cambiado", ok(v));
      el.closest(".hip")?.querySelector(".reset")?.classList.toggle("on", ok(v));
    }
    sucio = true; marcar();
    if (el.hasAttribute("data-re")) { if (e.type === "change") repintar(); return; }
    refrescar();
  }
  app.addEventListener("input", editar);
  app.addEventListener("change", editar);

  document.addEventListener("submit", e => { if (e.target.id === "flogin") entrar(e); });
  document.addEventListener("click", async e => {
    const h = e.target.closest("[data-ayuda]");
    if (h) {
      const [t, d] = DATOS.AYUDA[h.dataset.ayuda];
      return modal(`<h2>${esc(t)}</h2><p>${esc(d)}</p><div class="fila" style="justify-content:flex-end"><button class="btn" data-act="cerrar">Entendido</button></div>`);
    }
    if (e.target.id === "modal") return cerrarModal();
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const act = a.dataset.act;
    if (act === "cerrar") return cerrarModal();
    if (act === "salir") { await sb.auth.signOut(); usuario = null; empresas = []; E = null; return vLogin(); }
    if (act === "precio") return modalPrecio(a.dataset.id);
    if (act === "okPrecio") return guardarPrecio(a.dataset.id);
    if (!E) return;
    if (act === "guardar") return guardar();
    if (act === "borrar") return borrar();
    if (act === "reset") { delete E.hip[a.dataset.k]; sucio = true; marcar(); return repintar(); }
    if (act === "resetPath") { setPath(E, a.dataset.k, null); sucio = true; marcar(); return repintar(); }
    if (act === "anio") {
      const ys = E.anios.map(x => num(x.anio)).filter(ok), d = +a.dataset.d;
      const y = ys.length ? (d > 0 ? Math.max(...ys) + 1 : Math.min(...ys) - 1) : new Date().getFullYear() - 1;
      E.anios.push({ anio: y }); sucio = true; marcar(); return repintar();
    }
    if (act === "quitarAnio") {
      const fila = E.anios[+a.dataset.i];
      const tieneDatos = fila && Object.keys(fila).some(k => k !== "anio" && ok(num(fila[k])));
      if (tieneDatos && !confirm(`¿Quitar el año ${fila.anio} y sus datos?`)) return;
      E.anios.splice(+a.dataset.i, 1); sucio = true; marcar(); return repintar();
    }
    if (act === "addComp") { E.comparables = E.comparables || []; E.comparables.push({ nombre: a.dataset.n || "" }); sucio = true; marcar(); return repintar(); }
    if (act === "quitarComp") { E.comparables.splice(+a.dataset.i, 1); sucio = true; marcar(); return repintar(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") cerrarModal();
    if (e.key === "Enter" && e.target.id === "mprecio") $('[data-act="okPrecio"]')?.click();
  });
  window.addEventListener("beforeunload", e => { if (sucio) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("hashchange", ruta);

  // ── Arranque ─────────────────────────────────────────────
  async function arrancar() {
    pintarSesion();
    app.innerHTML = `<p class="mut">Cargando…</p>`;
    try { empresas = await DB.lista(); }
    catch (err) { app.innerHTML = `<div class="banner">No se han podido cargar tus empresas: ${esc(err.message || err)}. ¿Has ejecutado supabase.sql?</div>`; return; }
    ruta();
  }
  (async () => {
    if (nube) {
      const { data } = await sb.auth.getSession();
      usuario = data.session?.user || null;
      if (!usuario) return vLogin();
    }
    arrancar();
  })();
})();
