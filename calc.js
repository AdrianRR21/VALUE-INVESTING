// Cálculos financieros (sin interfaz). Todas las cifras de estados, en las unidades elegidas por empresa.
const Calc = (() => {
  const FACTOR = { millones: 1e6, miles: 1e3, unidades: 1 };
  const num = x => (x === null || x === undefined || x === "" || !isFinite(x)) ? null : Number(x);
  const ok = x => x !== null && x !== undefined && isFinite(x);
  const mean = a => { const b = a.filter(ok); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
  const median = a => { const b = a.filter(ok).sort((x, y) => x - y); if (!b.length) return null; const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const r3 = x => Math.round(x * 1000) / 1000;
  const P = x => ok(x) ? (x * 100).toFixed(1).replace(".", ",") + " %" : "—";
  const div = (a, b) => (ok(a) && ok(b) && b !== 0) ? a / b : null;
  const v = (a, k) => num(a ? a[k] : null);

  const serie = E => (E.anios || []).filter(a => ok(num(a.anio))).slice().sort((a, b) => a.anio - b.anio);
  // Último año con ventas (los años añadidos y aún vacíos no cuentan)
  const ultimo = E => { const s = serie(E), c = s.filter(a => ok(num(a.ventas))); return c[c.length - 1] || s[s.length - 1] || {}; };
  const esFinanciera = E => E.tipo === "banco" || E.tipo === "aseguradora";
  const moneda = E => DATOS.MONEDAS[E.moneda] || null;

  function ebitda(a) { const e = v(a, "ebitda"); if (ok(e)) return e; const b = v(a, "ebit"), d = v(a, "da"); return ok(b) && ok(d) ? b + d : null; }
  function nwc(a) { const ac = v(a, "activoCorriente"), pc = v(a, "pasivoCorriente"); if (!ok(ac) || !ok(pc)) return null; return (ac - (v(a, "caja") || 0)) - (pc - (v(a, "deudaCP") || 0)); }
  function tasa(a) { const bai = v(a, "bai"), t = v(a, "impuestos"); return ok(bai) && bai > 0 && ok(t) ? t / bai : null; }
  function capInv(a) { const pn = v(a, "patrimonio"); if (!ok(pn)) return null; return pn + (v(a, "deuda") || 0) - (v(a, "caja") || 0); }

  function mercado(E) {
    const m = E.mercado || {}, f = FACTOR[E.unidades] || 1e6, u = ultimo(E);
    const precio = num(m.precio), acciones = num(m.acciones);
    const cap = ok(precio) && ok(acciones) ? precio * acciones * 1e6 / f : null; // en unidades de los estados
    const dnProp = ok(v(u, "deuda")) ? v(u, "deuda") - (v(u, "caja") || 0) : null;
    const deudaNeta = ok(num(m.deudaNeta)) ? num(m.deudaNeta) : dnProp;
    const porAccion = x => (ok(x) && ok(acciones) && acciones > 0) ? x * f / (acciones * 1e6) : null;
    return { precio, acciones, cap, dnProp, deudaNeta, minoritarios: num(m.minoritarios) || 0, beta: num(m.beta), f, porAccion };
  }

  function historico(E) {
    const s = serie(E);
    return s.map((a, i) => {
      const prev = s[i - 1];
      const ventas = v(a, "ventas"), ebit = v(a, "ebit"), t = tasa(a);
      const nopat = ok(ebit) ? ebit * (1 - (ok(t) ? clip(t, 0, 0.5) : 0.25)) : null;
      const dNwc = prev && ok(nwc(a)) && ok(nwc(prev)) ? nwc(a) - nwc(prev) : 0;
      const fcff = ok(nopat) && ok(v(a, "da")) && ok(v(a, "capex")) ? nopat + v(a, "da") - v(a, "capex") - dNwc : null;
      const ci = capInv(a), ciP = prev ? capInv(prev) : null;
      const ciM = ok(ci) && ok(ciP) ? (ci + ciP) / 2 : ci;
      return {
        anio: a.anio, ventas,
        crec: prev && ok(v(prev, "ventas")) && v(prev, "ventas") > 0 && ok(ventas) ? ventas / v(prev, "ventas") - 1 : null,
        mEbitda: div(ebitda(a), ventas), mEbit: div(ebit, ventas), mNeto: div(v(a, "bn"), ventas),
        tasa: t, nopat, fcff,
        fcl: ok(v(a, "fco")) && ok(v(a, "capex")) ? v(a, "fco") - v(a, "capex") : null,
        roic: ok(ciM) && ciM > 0 ? div(nopat, ciM) : null,
        roe: ok(v(a, "patrimonio")) && v(a, "patrimonio") > 0 ? div(v(a, "bn"), v(a, "patrimonio")) : null,
        deudaEbitda: ok(ebitda(a)) && ebitda(a) > 0 && ok(v(a, "deuda")) ? (v(a, "deuda") - (v(a, "caja") || 0)) / ebitda(a) : null
      };
    });
  }

  // Hipótesis propuestas + valores finales (los tuyos si los has cambiado, si no la propuesta)
  function hipotesis(E) {
    const hip = E.hip || {}, P_ = {}, h = {};
    const s = serie(E), H = historico(E), u = ultimo(E), m = mercado(E), mon = moneda(E);
    const val = k => { const x = num(hip[k]); h[k] = ok(x) ? x : (P_[k] ? P_[k].v : null); return h[k]; };

    // Crecimiento
    const vs = s.filter(a => ok(v(a, "ventas")) && v(a, "ventas") > 0);
    const nA = vs.length >= 2 ? vs[vs.length - 1].anio - vs[0].anio : 0;
    if (nA > 0) {
      const cagr = Math.pow(v(vs[vs.length - 1], "ventas") / v(vs[0], "ventas"), 1 / nA) - 1;
      const c = clip(cagr, -0.05, 0.20);
      P_.gIni = { v: r3(c), t: `Crecimiento anual compuesto de las ventas ${vs[0].anio}–${vs[vs.length - 1].anio}: ${P(cagr)}` + (Math.abs(c - cagr) > 1e-9 ? `, limitado a ${P(c)} para no extrapolar un dato extremo.` : ".") };
      P_.gIni.hist = cagr;
    } else P_.gIni = { v: 0.04, t: "Solo hay un año de ventas: se propone un 4 % genérico. Añade más años para una propuesta basada en tu histórico." };
    val("gIni");

    // Margen
    const margenes = H.map(x => x.mEbit).filter(ok);
    const m0 = div(v(u, "ebit"), v(u, "ventas"));
    if (margenes.length) {
      const mm = mean(margenes);
      P_.mObj = { v: r3(mm), t: `Margen EBIT medio de los años introducidos (${P(mm)}). Se parte del margen del último año (${P(m0)}) y se converge a este.`, max: Math.max(...margenes) };
    } else P_.mObj = { v: null, t: "Falta el EBIT y las ventas en «Estados»." };
    val("mObj");

    P_.anos = h.gIni > 0.10
      ? { v: 10, t: "El crecimiento inicial supera el 10 %: se proponen 10 años para que converja con calma hacia el terminal." }
      : { v: 5, t: "Crecimiento moderado: 5 años de proyección explícita bastan." };
    val("anos");

    const tasas = H.map(x => x.tasa).filter(x => ok(x) && x >= 0 && x <= 0.5);
    P_.tax = tasas.length
      ? { v: r3(clip(mean(tasas), 0.05, 0.35)), t: `Tipo efectivo medio (impuestos / resultado antes de impuestos): ${P(mean(tasas))}.` }
      : { v: 0.25, t: "No hay datos de impuestos: se usa el 25 % (tipo nominal general en España)." };
    val("tax");

    const daR = s.map(a => div(v(a, "da"), v(a, "ventas"))).filter(ok);
    const cxR = s.map(a => div(v(a, "capex"), v(a, "ventas"))).filter(ok);
    P_.daPct = daR.length ? { v: r3(mean(daR)), t: `Media histórica de amortizaciones / ventas (${P(mean(daR))}).` } : { v: 0.03, t: "Sin datos: 3 % genérico." };
    P_.capexPct = cxR.length ? { v: r3(mean(cxR)), t: `Media histórica de capex / ventas (${P(mean(cxR))}).` } : { v: ok(P_.daPct.v) ? P_.daPct.v : 0.03, t: "Sin datos de capex: se iguala a las amortizaciones (solo mantenimiento)." };
    const nwR = s.map(a => div(nwc(a), v(a, "ventas"))).filter(ok);
    P_.nwcPct = nwR.length ? { v: r3(clip(mean(nwR), -0.3, 0.5)), t: `Circulante operativo medio sobre ventas (${P(mean(nwR))}). Negativo = los proveedores financian a la empresa.` } : { v: 0, t: "Sin datos del balance corriente: se supone que el circulante no consume caja." };
    val("daPct"); val("capexPct"); val("nwcPct");

    // Coste de capital
    P_.rf = mon ? { v: mon.rf, t: `Orientativo: ${mon.bono}. Actualízalo con la rentabilidad del día.` } : { v: 0.04, t: "Moneda sin referencia: 4 % genérico. Pon la rentabilidad del bono a 10 años de esa moneda." };
    val("rf");
    P_.erp = { v: 0.045, t: "Prima de mercado madura: Damodaran estima la prima implícita del S&P 500 en torno al 4–5 %." };
    val("erp");
    const crpR = DATOS.CRP_REGION[E.region] ?? 0;
    P_.crp = (mon && mon.emergente)
      ? { v: 0, t: "Valoras en moneda local de un emergente: su bono ya incluye el riesgo país, así que no se añade prima." }
      : { v: crpR, t: crpR ? `Prima orientativa para la zona (${P(crpR)}). Ajústala con la tabla de Damodaran del país concreto.` : "Mercado desarrollado: sin prima de riesgo país." };
    val("crp");
    P_.beta = ok(m.beta) ? { v: m.beta, t: "La beta que has introducido en «Empresa»." } : { v: 1, t: "No has puesto beta en «Empresa»: se usa 1,0 (riesgo igual al del mercado)." };
    val("beta");

    const kdR = s.map(a => div(v(a, "gastosFin"), v(a, "deuda"))).filter(x => ok(x) && x > 0);
    if (kdR.length) {
      const k = mean(kdR), kc = clip(k, h.rf + 0.005, h.rf + 0.08);
      P_.kd = { v: r3(kc), t: `Gastos financieros / deuda media: ${P(k)}` + (Math.abs(kc - k) > 1e-9 ? `, ajustado a ${P(kc)} (entre rf + 0,5 y rf + 8 puntos).` : ".") };
    } else P_.kd = { v: r3(h.rf + 0.02), t: "Sin datos de gastos financieros: tipo libre de riesgo + 2 puntos." };
    val("kd");

    const D = v(u, "deuda") || 0;
    if (ok(m.cap) && m.cap > 0) P_.pesoDeuda = { v: r3(clip(D / (D + m.cap), 0, 0.8)), t: `Deuda / (deuda + capitalización bursátil) = ${P(D / (D + m.cap))} a valores de mercado.` };
    else if (ok(v(u, "patrimonio")) && v(u, "patrimonio") > 0) P_.pesoDeuda = { v: r3(clip(D / (D + v(u, "patrimonio")), 0, 0.8)), t: "Sin precio o nº de acciones: se usa el peso contable (deuda / (deuda + patrimonio))." };
    else P_.pesoDeuda = { v: 0.2, t: "Sin datos: 20 % genérico." };
    val("pesoDeuda");

    const ke = h.rf + h.beta * h.erp + h.crp, kdNet = h.kd * (1 - h.tax), wacc = ke * (1 - h.pesoDeuda) + kdNet * h.pesoDeuda;

    // Valor terminal
    P_.pibLP = mon ? { v: mon.pib, t: `Orientativo para ${E.moneda}: crecimiento real a largo plazo + inflación.` } : { v: 0.03, t: "3 % genérico (≈1,5 % real + 1,5–2 % de inflación)." };
    val("pibLP");
    const gt = r3(Math.max(0, Math.min(0.025, h.pibLP, h.rf)));
    P_.gTerm = { v: gt, t: `El menor entre 2,5 %, el PIB nominal a largo plazo (${P(h.pibLP)}) y el tipo libre de riesgo (${P(h.rf)}): conservador.` };
    val("gTerm");
    const roicH = mean(H.map(x => x.roic));
    if (ok(roicH) && roicH > wacc) P_.roicT = { v: r3(Math.min((roicH + wacc) / 2, 0.30)), t: `Punto medio entre el ROIC histórico (${P(roicH)}) y el WACC (${P(wacc)}): la ventaja competitiva se erosiona en parte a largo plazo.` };
    else if (ok(roicH)) P_.roicT = { v: r3(wacc), t: `ROIC histórico (${P(roicH)}) por debajo del WACC: se supone que a perpetuidad gana justo su coste de capital (${P(wacc)}).` };
    else P_.roicT = { v: r3(wacc), t: "Sin ROIC histórico (falta patrimonio o deuda): se iguala al WACC; crecer ni crea ni destruye valor." };
    val("roicT");

    return { h, P: P_, ke, kdNet, wacc, m0 };
  }

  function dcf(E) {
    const out = { ok: false, avisos: [] };
    const aviso = (n, t) => out.avisos.push({ n, t });
    if (esFinanciera(E)) { out.motivo = "En bancos y aseguradoras el DCF de flujos para la empresa (FCFF) no tiene sentido: la deuda y los depósitos son su materia prima, no su financiación. Se valorarán con residual income y P/VC justificado por ROE (fase 2)."; return out; }
    const u = ultimo(E), m = mercado(E);
    if (!ok(v(u, "ventas")) || !ok(v(u, "ebit")) || v(u, "ventas") <= 0) { out.motivo = "Faltan las ventas y el EBIT del último año en «Estados»."; return out; }
    const H = hipotesis(E), h = H.h, w = H.wacc;
    out.H = H;
    const faltan = ["gIni", "mObj", "anos", "tax", "daPct", "capexPct", "nwcPct", "gTerm", "roicT"].filter(k => !ok(h[k]));
    if (faltan.length || !ok(w)) { out.motivo = "Faltan hipótesis por completar."; return out; }
    if (h.gTerm >= w) { aviso("error", `El crecimiento terminal (${P(h.gTerm)}) es igual o mayor que el WACC (${P(w)}): el valor terminal sería infinito. Bájalo.`); out.motivo = "Hipótesis incoherentes: revisa los avisos."; return out; }

    const N = Math.round(clip(h.anos, 1, 15));
    let V = v(u, "ventas"), pv = 0;
    const m0 = H.m0, proj = [];
    for (let t = 1; t <= N; t++) {
      const g = N === 1 ? h.gTerm : h.gIni + (h.gTerm - h.gIni) * (t - 1) / (N - 1);
      const Vp = V; V = V * (1 + g);
      const mg = m0 + (h.mObj - m0) * t / N;
      const ebit = V * mg, nopat = ebit * (1 - h.tax), da = V * h.daPct, capex = V * h.capexPct, dnwc = (V - Vp) * h.nwcPct;
      const fcff = nopat + da - capex - dnwc, fd = 1 / Math.pow(1 + w, t);
      proj.push({ t, anio: (num(u.anio) || 0) + t, ventas: V, g, ebit, mg, nopat, da, capex, dnwc, fcff, fd, va: fcff * fd });
      pv += fcff * fd;
    }
    const nopatT = V * (1 + h.gTerm) * h.mObj * (1 - h.tax);
    const rr = h.roicT > 0 ? h.gTerm / h.roicT : null;
    if (!ok(rr) || rr >= 1) { aviso("error", `Con un ROIC terminal de ${P(h.roicT)} habría que reinvertir más de todo lo que se gana para crecer al ${P(h.gTerm)}. Sube el ROIC terminal o baja g.`); out.motivo = "Hipótesis incoherentes: revisa los avisos."; return out; }
    const fcffT = nopatT * (1 - rr), tv = fcffT / (w - h.gTerm), pvTv = tv / Math.pow(1 + w, N);
    const ev = pv + pvTv;
    if (!ok(m.deudaNeta)) aviso("aviso", "Falta la deuda neta (ni en «Empresa» ni en el balance): se ha supuesto 0.");
    const eq = ev - (m.deudaNeta || 0) - m.minoritarios;
    const pa = m.porAccion(eq);

    // Avisos de coherencia
    if (h.gTerm > h.pibLP) aviso("aviso", `El crecimiento terminal (${P(h.gTerm)}) supera el del PIB nominal a largo plazo (${P(h.pibLP)}): a perpetuidad la empresa acabaría siendo mayor que la economía.`);
    else if (h.gTerm > h.rf) aviso("info", `El crecimiento terminal (${P(h.gTerm)}) supera el tipo libre de riesgo (${P(h.rf)}). Damodaran recomienda que no lo supere.`);
    if (h.gIni > 0.20) aviso("aviso", `Crecimiento inicial muy alto (${P(h.gIni)}). Pocas empresas lo sostienen; asegúrate de que lo justifica algo concreto.`);
    else if (ok(H.P.gIni.hist) && h.gIni > H.P.gIni.hist + 0.05) aviso("aviso", `El crecimiento inicial (${P(h.gIni)}) supera en más de 5 puntos el histórico (${P(H.P.gIni.hist)}).`);
    if (ok(H.P.mObj.max) && h.mObj > H.P.mObj.max + 0.03) aviso("aviso", `El margen objetivo (${P(h.mObj)}) supera en más de 3 puntos el mejor margen histórico (${P(H.P.mObj.max)}).`);
    if (w < 0.05) aviso("aviso", `WACC muy bajo (${P(w)}): infla el valor. Revisa beta y prima de riesgo.`);
    if (w > 0.15) aviso("aviso", `WACC muy alto (${P(w)}): revisa la prima de riesgo país y la beta.`);
    if (h.tax < 0.10) aviso("aviso", `Tipo impositivo muy bajo (${P(h.tax)}): a largo plazo suele converger al tipo nominal.`);
    if (h.roicT < w - 1e-9) aviso("aviso", `ROIC terminal (${P(h.roicT)}) inferior al WACC (${P(w)}): cada euro reinvertido destruye valor.`);
    if (h.roicT > 0.30) aviso("aviso", `ROIC terminal muy alto (${P(h.roicT)}): implica una ventaja competitiva excepcional para siempre.`);
    if (h.daPct > h.capexPct + 0.01 && h.gIni > 0) aviso("aviso", `Las amortizaciones (${P(h.daPct)} de ventas) superan al capex (${P(h.capexPct)}) mientras la empresa crece: es como si los activos se fueran agotando sin reponerse. Es frecuente si la D&A incluye arrendamientos (NIIF 16) que no están en el capex; en ese caso iguala el capex a las amortizaciones o usa D&A sin arrendamientos.`);
    if (!ok(m.beta)) aviso("info", "No has introducido la beta en «Empresa»: se está usando 1,0.");
    const pesoTV = ev > 0 ? pvTv / ev : null;
    if (ok(pesoTV) && pesoTV > 0.8) aviso("aviso", `El valor terminal supone el ${P(pesoTV)} del valor de la empresa: el resultado depende casi todo de g y del WACC.`);
    const hf = historico(E).map(x => x.fcff).filter(ok);
    if (hf.length && hf.every(x => x < 0)) aviso("info", "El FCFF histórico es negativo todos los años: el valor depende de que la empresa cambie de tendencia.");
    if (proj[0] && proj[0].fcff < 0) aviso("info", "El FCFF del primer año proyectado es negativo (la reinversión supera el NOPAT).");
    if (eq <= 0) aviso("aviso", "El valor del equity sale negativo: la deuda supera el valor de los flujos.");
    if (!ok(pa)) aviso("aviso", "Falta el número de acciones en «Empresa» para pasar a valor por acción.");

    Object.assign(out, { ok: true, N, proj, pv, nopatT, rr, fcffT, tv, pvTv, ev, eq, porAccion: pa, pesoTV, deudaNeta: m.deudaNeta || 0, minoritarios: m.minoritarios });
    return out;
  }

  const MULT = [
    { k: "per", nombre: "PER", base: "Beneficio neto", tipo: "eq", metric: a => v(a, "bn") },
    { k: "evEbitda", nombre: "EV/EBITDA", base: "EBITDA", tipo: "ev", metric: ebitda },
    { k: "pvc", nombre: "P/VC", base: "Patrimonio neto", tipo: "eq", metric: a => v(a, "patrimonio") },
    { k: "evVentas", nombre: "EV/Ventas", base: "Ventas", tipo: "ev", metric: a => v(a, "ventas") }
  ];

  function multiplos(E) {
    const m = mercado(E), u = ultimo(E), comps = E.comparables || [], fin = esFinanciera(E), usar = E.multUsar || {};
    const ev = ok(m.cap) ? m.cap + (m.deudaNeta || 0) + m.minoritarios : null;
    const propios = {
      per: ok(m.cap) && v(u, "bn") > 0 ? m.cap / v(u, "bn") : null,
      evEbitda: ok(ev) && ebitda(u) > 0 ? ev / ebitda(u) : null,
      pvc: ok(m.cap) && v(u, "patrimonio") > 0 ? m.cap / v(u, "patrimonio") : null,
      evVentas: ok(ev) && v(u, "ventas") > 0 ? ev / v(u, "ventas") : null
    };
    const filas = MULT.map(d => {
      const vals = comps.map(c => num(c[d.k])).filter(x => ok(x) && x > 0);
      const metric = d.metric(u);
      const r = { ...d, n: vals.length, metric, propio: propios[d.k], usar: usar[d.k] !== false, aplicable: true, motivo: "" };
      if (fin && d.tipo === "ev") { r.aplicable = false; r.motivo = "En financieras la deuda es parte del negocio: los múltiplos sobre EV no tienen sentido."; }
      else if (!ok(metric)) { r.aplicable = false; r.motivo = `Falta ${d.base.toLowerCase()} en el último año.`; }
      else if (metric <= 0) { r.aplicable = false; r.motivo = `${d.base} negativo o cero: el múltiplo no se puede interpretar.`; }
      else if (d.tipo === "ev" && !ok(m.deudaNeta)) { r.aplicable = false; r.motivo = "Falta la deuda neta para pasar de EV a equity."; }
      else if (!vals.length) { r.aplicable = false; r.motivo = "Introduce este múltiplo en al menos una comparable."; }
      if (r.aplicable) {
        const imp = x => m.porAccion(d.tipo === "ev" ? x * metric - m.deudaNeta - m.minoritarios : x * metric);
        r.med = median(vals); r.min = Math.min(...vals); r.max = Math.max(...vals);
        r.vMed = imp(r.med); r.vMin = imp(r.min); r.vMax = imp(r.max);
      }
      return r;
    });
    const usados = filas.filter(r => r.aplicable && r.usar && ok(r.vMed));
    return {
      filas, propios,
      porAccion: usados.length ? mean(usados.map(r => r.vMed)) : null,
      lo: usados.length ? Math.min(...usados.map(r => r.vMin)) : null,
      hi: usados.length ? Math.max(...usados.map(r => r.vMax)) : null,
      motivo: !comps.length ? "Añade empresas comparables y sus múltiplos." : (!usados.length ? "Ningún múltiplo aplicable todavía." : "")
    };
  }

  function seleccion(E) {
    const fin = esFinanciera(E);
    const hf = historico(E).map(x => x.fcff).filter(ok);
    const neg = hf.length && hf.every(x => x < 0);
    return [
      { n: "DCF (FCFF descontado al WACC)", e: fin ? "no" : (neg ? "cautela" : "si"),
        t: fin ? "Descartado: en una financiera no se puede separar la deuda operativa de la financiación." : (neg ? "Se aplica con cautela: los flujos históricos son negativos y el valor depende de supuestos de mejora." : "Método principal: valora la capacidad de generar caja del negocio.") },
      { n: "Múltiplos comparables", e: "si", t: fin ? "Solo PER y P/VC (los múltiplos sobre EV se descartan)." : "PER, EV/EBITDA, P/VC y EV/Ventas; se descartan los de denominador negativo." },
      { n: "DDM (Gordon y por etapas)", e: E.dividendosEstables ? "fase" : "no", t: E.dividendosEstables ? "Tiene sentido por sus dividendos estables. Llega en la fase 2." : "Descartado: no has marcado dividendos estables." },
      { n: "Residual income / P/VC justificado por ROE", e: fin ? "fase" : "no", t: fin ? "Método principal para financieras. Llega en la fase 2." : "Reservado para bancos y aseguradoras." },
      { n: "Número de Graham", e: "fase", t: "Contraste conservador. Llega en la fase 2." }
    ];
  }

  function resultado(E) {
    const m = mercado(E), d = dcf(E), mu = multiplos(E), pesos = E.pesos || {};
    const metodos = [
      { k: "dcf", nombre: "DCF (FCFF)", valor: d.ok ? d.porAccion : null, lo: null, hi: null },
      { k: "mult", nombre: "Múltiplos comparables", valor: mu.porAccion, lo: mu.lo, hi: mu.hi }
    ];
    const disp = metodos.filter(x => ok(x.valor));
    disp.forEach(x => { const p = num(pesos[x.k]); x.peso = ok(p) ? p : 1 / disp.length; });
    const sw = disp.reduce((s, x) => s + x.peso, 0);
    const vi = disp.length && sw > 0 ? disp.reduce((s, x) => s + x.valor * x.peso, 0) / sw : null;
    const md = ok(num(E.margenDeseado)) ? num(E.margenDeseado) : 0.25;
    const objProp = ok(vi) ? vi * (1 - md) : null;
    const objetivo = ok(num(E.objetivo)) ? num(E.objetivo) : objProp;
    return {
      d, mu, metodos, vi, md, objProp, objetivo, precio: m.precio, sumaPesos: sw,
      margen: ok(vi) && vi > 0 && ok(m.precio) ? (vi - m.precio) / vi : null,
      potencial: ok(vi) && ok(m.precio) && m.precio > 0 ? vi / m.precio - 1 : null
    };
  }

  return { FACTOR, num, ok, mean, median, P, serie, ultimo, mercado, historico, hipotesis, dcf, multiplos, seleccion, resultado, esFinanciera, ebitda };
})();
if (typeof module !== "undefined") module.exports = Calc;
