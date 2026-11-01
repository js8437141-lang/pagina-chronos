const SHEET_ID = "1UY8OdTVvWH4GIr0cWRIOJf46OXJ0tzRxP2rHRzBH-3M";
const HOJA = "Link";
const CELDA = "B1:B1";

// Clave compartida con el Apps Script de Chronos (variable de entorno RESOLVER_KEY en Vercel;
// si no está cargada se usa esta).
const CLAVE = process.env.RESOLVER_KEY || "code&cruve-chronos-2026";

let cache = { url: "", t: 0 };

// Lee el enlace del script desde la hoja (cacheado 60 segundos)
async function obtenerBase() {
  if (cache.url && Date.now() - cache.t < 60000) return cache.url;
  const u = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(HOJA)}&range=${CELDA}&headers=0`;
  const r = await fetch(u, { redirect: "follow" });
  const txt = await r.text();
  const m = txt.match(/https:\/\/script\.google\.com\/[^",\s]+/);
  if (!m) throw new Error("No se encontró el enlace en la celda");
  cache = { url: m[0], t: Date.now() };
  return m[0];
}

module.exports = async (req, res) => {
  const modo = String(req.query.modo || "").toLowerCase();
  const comercio = String(req.query.comercio || "").trim();
  const extra = String(req.query.extra || "").trim();

  if (!comercio) return res.status(400).send("Falta el comercio");

  let BASE;
  try {
    BASE = await obtenerBase();
  } catch (err) {
    return res.status(500).send("No se pudo leer el enlace de la hoja Link");
  }

  // /pase/{parametro}  ->  ?pase={parametro}&lic={parametro}
  // /pase/{token}/{licencia}  ->  ?pase={token}&lic={licencia}   (cuando el token y la licencia son distintos)
  if (modo === "pase") {
    const lic = extra || comercio;
    return res.redirect(302, `${BASE}?pase=${encodeURIComponent(comercio)}&lic=${encodeURIComponent(lic)}`);
  }

  // /admin/{parametro}    ->  ?admin=true&lic={licencia}
  // /escaner/{parametro}  ->  ?escaner=true&lic={licencia}
  // La licencia se resuelve contra el Apps Script con la clave; si no responde (o devuelve
  // HTML de login) se usa el parámetro tal cual.
  if (modo === "admin" || modo === "escaner") {
    let lic = comercio;
    try {
      const r = await fetch(`${BASE}?resolver=${encodeURIComponent(comercio)}&key=${encodeURIComponent(CLAVE)}`, { redirect: "follow" });
      const t = (await r.text()).trim();
      if (t && !t.startsWith("<")) lic = t;
    } catch (err) {}
    return res.redirect(302, `${BASE}?${modo}=true&lic=${encodeURIComponent(lic)}`);
  }

  res.status(404).send("No encontrado");
};