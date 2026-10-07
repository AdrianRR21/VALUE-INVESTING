// Datos de referencia: sectores, regiones, monedas, ayudas y comparables sugeridas.
const DATOS = (() => {

  const REGIONES = [
    ["es", "España"], ["eu", "Europa (resto)"], ["us", "EE. UU. y Canadá"],
    ["latam", "Latinoamérica"], ["asia", "Asia-Pacífico"], ["otro", "Otros"]
  ];

  // Tipo libre de riesgo orientativo (bono a 10 años en esa moneda) y crecimiento nominal del PIB a largo plazo.
  // Son puntos de partida: actualiza el tipo con el dato del día en la propia web.
  const MONEDAS = {
    EUR: { rf: 0.027, pib: 0.030, bono: "Bund alemán a 10 años" },
    USD: { rf: 0.042, pib: 0.040, bono: "Treasury de EE. UU. a 10 años" },
    GBP: { rf: 0.045, pib: 0.035, bono: "Gilt británico a 10 años" },
    CHF: { rf: 0.005, pib: 0.020, bono: "bono suizo a 10 años" },
    JPY: { rf: 0.015, pib: 0.015, bono: "bono japonés a 10 años" },
    DKK: { rf: 0.025, pib: 0.030, bono: "bono danés a 10 años" },
    SEK: { rf: 0.025, pib: 0.030, bono: "bono sueco a 10 años" },
    NOK: { rf: 0.040, pib: 0.035, bono: "bono noruego a 10 años" },
    CAD: { rf: 0.033, pib: 0.035, bono: "bono canadiense a 10 años" },
    AUD: { rf: 0.043, pib: 0.040, bono: "bono australiano a 10 años" },
    HKD: { rf: 0.035, pib: 0.035, bono: "bono de Hong Kong a 10 años" },
    CNY: { rf: 0.018, pib: 0.040, bono: "bono chino a 10 años", emergente: true },
    INR: { rf: 0.064, pib: 0.080, bono: "bono indio a 10 años", emergente: true },
    BRL: { rf: 0.135, pib: 0.070, bono: "bono brasileño a 10 años", emergente: true },
    MXN: { rf: 0.090, pib: 0.060, bono: "bono mexicano a 10 años", emergente: true }
  };

  const CRP_REGION = { es: 0, eu: 0, us: 0, latam: 0.03, asia: 0.01, otro: 0.02 };

  const SECTORES = [
    ["banca", "Banca"], ["seguros", "Seguros"],
    ["software", "Tecnología y software"], ["semis", "Semiconductores"],
    ["telecos", "Telecomunicaciones"], ["petroleo", "Petróleo y gas"],
    ["utilities", "Eléctricas y utilities"], ["renovables", "Renovables"],
    ["consumo", "Consumo básico (alimentación, bebidas, higiene)"],
    ["retail", "Distribución minorista"], ["moda", "Moda y lujo"],
    ["auto", "Automoción y componentes"], ["industria", "Industria y bienes de equipo"],
    ["construccion", "Construcción e infraestructuras"], ["salud", "Farmacia y salud"],
    ["inmobiliaria", "Inmobiliaria (SOCIMI / REIT)"], ["materiales", "Materiales, química y minería"],
    ["transporte", "Transporte y logística"], ["ocio", "Medios, ocio y turismo"],
    ["otro", "Otro"]
  ];

  // Sugerencias de comparables por sector y zona. Orientativas: comprueba que el negocio sea realmente parecido.
  const COMPARABLES = {
    banca:        { es: ["Santander", "BBVA", "CaixaBank", "Bankinter", "Sabadell", "Unicaja"], eu: ["BNP Paribas", "ING", "Intesa Sanpaolo", "UniCredit", "Deutsche Bank"], us: ["JPMorgan Chase", "Bank of America", "Wells Fargo", "Citigroup", "U.S. Bancorp"], em: ["Itaú Unibanco", "Banorte", "HDFC Bank", "ICBC"] },
    seguros:      { es: ["Mapfre", "Línea Directa", "Grupo Catalana Occidente"], eu: ["Allianz", "AXA", "Generali", "Zurich", "Munich Re"], us: ["Chubb", "Travelers", "AIG", "Progressive", "MetLife"], em: ["Ping An", "AIA Group", "Qualitas"] },
    software:     { es: ["Amadeus", "Indra"], eu: ["SAP", "Dassault Systèmes", "Capgemini", "Sage"], us: ["Microsoft", "Oracle", "Salesforce", "Adobe", "Alphabet"], em: ["Tencent", "Infosys", "Tata Consultancy Services", "MercadoLibre"] },
    semis:        { es: [], eu: ["ASML", "Infineon", "STMicroelectronics", "ASM International"], us: ["NVIDIA", "AMD", "Intel", "Texas Instruments", "Broadcom"], em: ["TSMC", "Samsung Electronics", "SK Hynix"] },
    telecos:      { es: ["Telefónica", "Cellnex"], eu: ["Deutsche Telekom", "Orange", "Vodafone", "KPN"], us: ["Verizon", "AT&T", "T-Mobile US"], em: ["América Móvil", "China Mobile", "Bharti Airtel"] },
    petroleo:     { es: ["Repsol"], eu: ["Shell", "TotalEnergies", "BP", "Eni", "Equinor"], us: ["ExxonMobil", "Chevron", "ConocoPhillips"], em: ["Petrobras", "Saudi Aramco", "PetroChina"] },
    utilities:    { es: ["Iberdrola", "Endesa", "Naturgy", "Redeia", "Enagás"], eu: ["Enel", "E.ON", "Engie", "RWE"], us: ["NextEra Energy", "Duke Energy", "Southern Company"], em: ["Eletrobras", "Enel Américas"] },
    renovables:   { es: ["Acciona Energía", "Solaria", "Grenergy"], eu: ["Ørsted", "EDP Renováveis", "Vestas"], us: ["Brookfield Renewable", "First Solar", "Clearway Energy"], em: ["Adani Green Energy"] },
    consumo:      { es: ["Ebro Foods", "Viscofan"], eu: ["Nestlé", "Unilever", "Danone", "Diageo", "AB InBev"], us: ["Procter & Gamble", "Coca-Cola", "PepsiCo", "Mondelez"], em: ["Ambev", "FEMSA", "Grupo Bimbo"] },
    retail:       { es: ["DIA"], eu: ["Carrefour", "Ahold Delhaize", "Tesco", "Jerónimo Martins"], us: ["Walmart", "Costco", "Target", "Amazon"], em: ["Walmex", "Cencosud", "Alibaba"] },
    moda:         { es: ["Inditex", "Puig"], eu: ["LVMH", "Hermès", "Kering", "H&M", "Richemont"], us: ["Nike", "Tapestry", "Ralph Lauren", "TJX"], em: ["Anta Sports", "Li Ning"] },
    auto:         { es: ["CIE Automotive", "Gestamp"], eu: ["Volkswagen", "Stellantis", "BMW", "Mercedes-Benz", "Renault"], us: ["Ford", "General Motors", "Tesla"], em: ["Toyota", "BYD", "Hyundai Motor"] },
    industria:    { es: ["Fluidra", "CAF", "Talgo"], eu: ["Siemens", "Schneider Electric", "ABB", "Atlas Copco"], us: ["Caterpillar", "Honeywell", "Deere", "Eaton"], em: ["Larsen & Toubro", "WEG"] },
    construccion: { es: ["ACS", "Ferrovial", "Acciona", "Sacyr", "Aena"], eu: ["Vinci", "Bouygues", "Eiffage", "Skanska"], us: ["Quanta Services", "Jacobs Solutions", "Vulcan Materials"], em: ["China State Construction", "Cemex"] },
    salud:        { es: ["Grifols", "Almirall", "Rovi", "Faes Farma"], eu: ["Novo Nordisk", "Roche", "Novartis", "AstraZeneca", "Sanofi"], us: ["Johnson & Johnson", "Pfizer", "Merck & Co.", "Eli Lilly", "AbbVie"], em: ["Sun Pharma", "Dr. Reddy's"] },
    inmobiliaria: { es: ["Merlin Properties", "Inmobiliaria Colonial", "Neinor Homes", "Aedas Homes"], eu: ["Vonovia", "Unibail-Rodamco-Westfield", "Segro", "Gecina"], us: ["Prologis", "Simon Property Group", "Realty Income", "Equinix"], em: ["Fibra Uno", "Emaar Properties"] },
    materiales:   { es: ["Acerinox", "ArcelorMittal", "Cementos Molins"], eu: ["Glencore", "Rio Tinto", "BASF", "Heidelberg Materials", "Air Liquide"], us: ["Freeport-McMoRan", "Linde", "Dow", "Nucor"], em: ["Vale", "Southern Copper", "BHP"] },
    transporte:   { es: ["IAG", "Logista"], eu: ["Ryanair", "Lufthansa", "Air France-KLM", "DHL Group", "Maersk"], us: ["Delta Air Lines", "Union Pacific", "UPS", "FedEx"], em: ["Copa Holdings", "LATAM Airlines", "Grupo Aeroportuario del Pacífico"] },
    ocio:         { es: ["Atresmedia", "Meliá Hotels"], eu: ["Universal Music Group", "Accor", "Flutter Entertainment"], us: ["Netflix", "Walt Disney", "Booking Holdings", "Marriott"], em: ["Naspers", "Trip.com"] }
  };

  // Ayuda de cada campo: qué es y dónde encontrarlo.
  const AYUDA = {
    // Identificación
    tipo: ["Tipo de empresa", "Marca «Banco» o «Aseguradora» si lo es: cambia los métodos que tienen sentido (en financieras no se usa el DCF de FCFF ni múltiplos sobre EV)."],
    dividendosEstables: ["Dividendos estables", "Márcalo si la empresa paga un dividendo recurrente y predecible desde hace años. Activará el DDM en la fase 2."],
    unidades: ["Unidades", "Las unidades en las que vienen las cifras del informe que vas a copiar. Casi todos los 10-K e informes anuales grandes vienen en millones; muchas cuentas de la CNMV, en miles."],
    // Mercado
    precio: ["Precio por acción", "Cotización actual en la moneda en que cotiza la empresa. La encuentras en la web de la bolsa, Google Finance, Investing.com o tu bróker."],
    acciones: ["Acciones en circulación (millones)", "Número de acciones en millones, descontando la autocartera. Viene en la portada del 10-K, en el informe anual (capital social) o en la web de relación con inversores. Siempre en millones, aunque los estados estén en miles."],
    beta: ["Beta", "Sensibilidad de la acción al mercado. Puedes usar la beta de regresión (Yahoo Finance, Reuters) o, mejor, la beta desapalancada media del sector de Damodaran reapalancada con la deuda de la empresa. Si la dejas vacía se usa 1,0."],
    deudaNeta: ["Deuda neta", "Deuda financiera total − efectivo. Si lo dejas vacío se calcula con el último balance que hayas introducido. Úsalo si quieres una cifra más actual (último trimestre)."],
    minoritarios: ["Intereses minoritarios", "Participaciones no dominantes del balance (dentro del patrimonio neto). Se restan al pasar del valor de la empresa (EV) al valor para el accionista."],
    dpa: ["Dividendo por acción", "Dividendo por acción de los últimos 12 meses. Se usará en el DDM (fase 2)."],
    // Cuenta de resultados
    ventas: ["Ingresos / ventas", "Importe neto de la cifra de negocios (Revenue, Net sales). Cuenta de resultados consolidada: en el 10-K, «Consolidated Statements of Operations»; en España, el informe financiero anual depositado en la CNMV."],
    bruto: ["Beneficio bruto", "Ventas menos coste de las ventas o aprovisionamientos (Gross profit). Opcional: se usará en el Piotroski F-Score (fase 3)."],
    ebitda: ["EBITDA", "Resultado bruto de explotación. Si lo dejas vacío se calcula como EBIT + amortizaciones. Cuidado con el «EBITDA ajustado» de las presentaciones si excluye costes que se repiten todos los años."],
    da: ["Amortizaciones (D&A)", "Dotación a la amortización del inmovilizado material e intangible. Fácil de encontrar en el estado de flujos de efectivo, como ajuste al resultado («Depreciation and amortization»)."],
    ebit: ["EBIT / resultado de explotación", "Resultado de explotación u Operating income: antes de resultados financieros e impuestos."],
    gastosFin: ["Gastos financieros", "Intereses de la deuda (Interest expense), en positivo. En la cuenta de resultados o en la nota de resultado financiero."],
    bai: ["Resultado antes de impuestos", "Income before income taxes. Último escalón antes del impuesto sobre beneficios."],
    impuestos: ["Impuesto sobre beneficios", "Gasto por impuesto (Income tax expense), en positivo. Si ese año fue un ingreso fiscal, ponlo en negativo."],
    bn: ["Beneficio neto atribuible", "Resultado atribuido a la sociedad dominante (Net income attributable to shareholders), sin la parte de minoritarios."],
    // Balance
    activoTotal: ["Activo total", "Total activo del balance consolidado."],
    activoCorriente: ["Activo corriente", "Total activo corriente (Total current assets): existencias, clientes, caja…"],
    caja: ["Efectivo y equivalentes", "Efectivo y otros activos líquidos equivalentes (Cash and cash equivalents). Puedes sumar inversiones financieras a corto plazo muy líquidas."],
    pasivoCorriente: ["Pasivo corriente", "Total pasivo corriente (Total current liabilities)."],
    deudaCP: ["Deuda financiera a corto plazo", "Préstamos, bonos y pagarés con vencimiento inferior a un año (incluidos dentro del pasivo corriente). Sirve para calcular bien el circulante operativo."],
    deuda: ["Deuda financiera total", "Deuda a corto + largo plazo con coste: préstamos bancarios, bonos, pagarés. Incluye los pasivos por arrendamiento (NIIF 16) si tu EBITDA ya los excluye, para ser coherente."],
    pasivoTotal: ["Pasivo total", "Total pasivo, sin el patrimonio neto. Opcional: se usará en el Altman Z-Score (fase 3)."],
    reservas: ["Reservas / ganancias acumuladas", "Reservas y resultados de ejercicios anteriores (Retained earnings). Opcional: Altman Z-Score (fase 3)."],
    patrimonio: ["Patrimonio neto atribuible", "Patrimonio neto atribuido a la sociedad dominante (Total shareholders' equity sin minoritarios). Es el valor contable."],
    accionesAnio: ["Acciones del año (millones)", "Número medio de acciones de ese ejercicio, en millones (viene junto al beneficio por acción). Opcional: Piotroski (dilución, fase 3)."],
    // Flujos
    fco: ["Flujo de caja de explotación", "Flujos netos de efectivo de las actividades de explotación (Net cash provided by operating activities)."],
    capex: ["Capex", "Pagos por inversiones en inmovilizado material e intangible (Purchases of property and equipment), en positivo. Estado de flujos, actividades de inversión."],
    dividendos: ["Dividendos pagados", "Dividendos pagados a los accionistas de la dominante, en positivo. Estado de flujos, actividades de financiación."],
    // Hipótesis
    gIni: ["Crecimiento inicial de ventas", "Crecimiento de las ventas el primer año proyectado. Desde ahí converge en línea recta hasta el crecimiento terminal en el último año."],
    mObj: ["Margen EBIT objetivo", "Margen EBIT al que llega la empresa al final de la proyección. Se parte del margen del último año y se converge linealmente."],
    anos: ["Años de proyección", "Duración del periodo explícito. 5 años para empresas maduras; 10 cuando el crecimiento actual está muy por encima del de la economía y necesita tiempo para normalizarse."],
    tax: ["Tipo impositivo", "Impuesto sobre el EBIT para calcular el NOPAT. Se propone el tipo efectivo medio, que puede ser menor que el nominal por deducciones."],
    daPct: ["Amortizaciones / ventas", "Peso de las amortizaciones sobre las ventas. Se suma al NOPAT porque no es salida de caja."],
    capexPct: ["Capex / ventas", "Inversión en inmovilizado sobre ventas. Si es mayor que las amortizaciones, la empresa está creciendo su base de activos."],
    nwcPct: ["Circulante operativo / ventas", "(Activo corriente − caja) − (pasivo corriente − deuda a corto). Al crecer las ventas, la empresa inmoviliza este % del incremento."],
    rf: ["Tipo libre de riesgo", "Rentabilidad del bono soberano a 10 años en la moneda de la empresa. Actualízalo con el dato del día (Investing.com, Banco de España, FRED)."],
    erp: ["Prima de riesgo de mercado", "Rentabilidad extra que exige el mercado de acciones sobre el bono. Damodaran publica cada mes la prima implícita del S&P 500 (normalmente entre 4 % y 5 %)."],
    crp: ["Prima de riesgo país", "Riesgo adicional por operar en países emergentes. Consulta la tabla «Country Default Spreads and Risk Premiums» de Damodaran. Si el tipo libre de riesgo es el bono en moneda local de un emergente, déjala en 0 (ya lo incluye)."],
    kd: ["Coste de la deuda (antes de impuestos)", "Tipo de interés que paga la empresa por su deuda. Se propone gastos financieros / deuda; si cotizan sus bonos, puedes usar su rentabilidad."],
    pesoDeuda: ["Peso de la deuda", "D / (D + E) con valores de mercado: deuda financiera frente a capitalización bursátil. Para empresas cuyo endeudamiento cambiará, usa un peso objetivo."],
    gTerm: ["Crecimiento terminal (g)", "Crecimiento perpetuo a partir del último año. No puede superar el crecimiento nominal de la economía a largo plazo ni, en la práctica, el tipo libre de riesgo."],
    pibLP: ["PIB nominal a largo plazo", "Crecimiento real (≈1,5–2 % en desarrollados) más inflación (≈2 %). Sirve de techo para g terminal."],
    roicT: ["ROIC terminal", "Rentabilidad sobre la nueva inversión a perpetuidad. Fija cuánto hay que reinvertir para crecer a g: reinversión = g / ROIC. Igual al WACC = crecer no crea valor; por encima = ventaja competitiva duradera."],
    margenDeseado: ["Margen de seguridad exigido", "Descuento sobre el valor intrínseco que pides para comprar. Graham usaba ~1/3; 20–30 % es habitual."],
    objetivo: ["Precio objetivo de compra", "Precio al que comprarías. Por defecto, valor intrínseco × (1 − margen exigido). La cartera te avisará cuando la cotización baje de aquí."]
  };

  const CAMPOS = [
    { grupo: "Cuenta de resultados", campos: [["ventas"], ["bruto", 1], ["ebitda", 1], ["da"], ["ebit"], ["gastosFin"], ["bai"], ["impuestos"], ["bn"]] },
    { grupo: "Balance", campos: [["activoTotal"], ["activoCorriente"], ["caja"], ["pasivoCorriente"], ["deudaCP"], ["deuda"], ["pasivoTotal", 1], ["reservas", 1], ["patrimonio"], ["accionesAnio", 1]] },
    { grupo: "Flujos de efectivo", campos: [["fco"], ["capex"], ["dividendos"]] }
  ];

  return { REGIONES, MONEDAS, CRP_REGION, SECTORES, COMPARABLES, AYUDA, CAMPOS };
})();
