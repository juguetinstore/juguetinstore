/* ============================================================
   QA SMOKE L4 — Producción (https://tiendalunaria.github.io/juga/)
   Solo lectura, sin compras. Corre diario (workflow qa-smoke.yml) y a mano.
   Uso local:  node qa_smoke_produccion.js
   URL alterna: QA_TIENDA_URL=https://... node qa_smoke_produccion.js
   Escribe smoke_resultado.txt (lo consume el workflow al abrir issue).
   ============================================================ */
const BASE = (process.env.QA_TIENDA_URL || "https://tiendalunaria.github.io/juga/").replace(/\/?$/, "/");
const UA = { "User-Agent": "juga-qa-smoke" };

const res = [];
const check = (ok, id, msg, extra) => {
  res.push({ ok: !!ok, id, msg, extra: extra === undefined ? "" : JSON.stringify(extra).slice(0, 400) });
  console.log((ok ? "PASS " : "FAIL ") + id + " " + msg + (ok ? "" : "  -> " + (extra === undefined ? "" : JSON.stringify(extra).slice(0, 400))));
};

async function pedir(url, opts) {
  const r = await fetch(url, { headers: UA, redirect: "follow", ...opts });
  return r;
}
const texto = async (u) => { const r = await pedir(u); return { st: r.status, t: r.ok ? await r.text() : "" }; };
const vivo = async (u) => { try { const r = await pedir(u, { method: "HEAD" }); return r.status; } catch (e) { return 0; } };

(async () => {
  console.log("== QA SMOKE L4 == " + BASE + " (" + new Date().toISOString() + ")\n");

  /* 1. Página principal */
  const home = await texto(BASE);
  check(home.st === 200, "1.1", "home HTTP 200", home.st);
  check(/<title>JUGA — Regalos que despiertan sonrisas<\/title>/i.test(home.t), "1.2", "title con eslogan oficial");
  check(/og:title" content="JUGA — Regalos que despiertan sonrisas"/i.test(home.t), "1.3", "og:title oficial");
  check(/rel="icon" href="favicon\.ico"/.test(home.t), "1.4", "favicon enlazado");
  check(/fonts\.googleapis\.com[^"]*Baloo\+2/.test(home.t) && /fonts\.googleapis\.com[^"]*Nunito/.test(home.t), "1.5", "tipografias oficiales cargadas");
  check(/wa\.me\/573132434760|573132434760/.test(home.t), "1.6", "WhatsApp de pedidos presente");

  /* 1.5 Configuración publicada: el margen vigente define el techo de los
     precios FINALES (vitrina × (1+margen) + redondeo). Se usa en 2.4b. */
  const cfg = await texto(BASE + "data/configuracion.js?t=" + Date.now());
  let conf = null;
  try { conf = JSON.parse(cfg.t.replace(/^[\s\S]*?window\.CONFIG_PUBLICADA\s*=\s*/, "").replace(/;\s*$/, "")); } catch (e) { conf = null; }
  const margenCfg = (conf && conf.precios && Number(conf.precios.margenGlobal)) || 0;
  const redCfg = (conf && conf.precios && Number(conf.precios.redondeo)) || 0;
  const precioFinalSmoke = p => redCfg > 0 ? Math.ceil((p * (1 + margenCfg) - 0.001) / redCfg) * redCfg : Math.round(p * (1 + margenCfg));
  const techo = Math.ceil(600000 * (1 + margenCfg) / 1000) * 1000;

  /* 2. catalogo.js */
  const cat = await texto(BASE + "catalogo.js?t=" + Date.now());
  check(cat.st === 200, "2.1", "catalogo.js HTTP 200", cat.st);
  const ps = [...cat.t.matchAll(/\{id:"([\w-]+)",n:"((?:[^"\\]|\\.)*)",p:(\d+),cat:"([\w-]+)".*?cid:"JUG-(\d+)"/g)]
    .map(m => ({ id: m[1], n: m[2], p: +m[3], cat: m[4], cid: "JUG-" + m[5], img: (cat.t.slice(m.index, m.index + 600).match(/img:"([^"]+)"/) || [])[1] }));
  check(ps.length >= 1500, "2.2", "catalogo con >=1500 juguetes visibles", ps.length);
  check(ps.every(x => x.p >= 100), "2.3", "sin precios base fuera de rango (<$100; base = Precio 5, respaldo Precio 2)", ps.filter(x => x.p < 100).slice(0, 3).map(x => x.id + ":" + x.p));
  check(ps.every(x => x.p <= 600000), "2.4", "sin precios fuera de rango (> $600.000)", ps.filter(x => x.p > 600000).slice(0, 3).map(x => x.id + ":" + x.p));
  const fueraRango = ps.filter(x => { const fin = precioFinalSmoke(x.p); return fin < 200 || fin > techo; });
  check(fueraRango.length === 0, "2.4b", "precio final (vitrina + margen " + Math.round(margenCfg * 100) + "%) dentro de rango: $200 – $" + techo.toLocaleString("es-CO"), fueraRango.slice(0, 3).map(x => x.id + ":" + precioFinalSmoke(x.p)));
  check(ps.every(x => /^JUG-\d{4}$/.test(x.cid)), "2.5", "todos con codigo JUG-XXXX");
  const conImg = ps.filter(x => x.img);
  check(conImg.length >= ps.length * 0.95, "2.6", ">=95% con imagen propia", conImg.length + "/" + ps.length);
  check(!/https?:\/\/(?!tiendalunaria\.github\.io|raw\.githubusercontent\.com)[^"']*\.(jpg|jpeg|png|webp)/i.test(cat.t), "2.7", "sin imagenes de dominios ajenos");

  /* 3. Muestra de imagenes (20 aleatorias) */
  const muestra = conImg.sort(() => Math.random() - 0.5).slice(0, 20);
  const rotas = [];
  for (const p of muestra) { const st = await vivo(BASE + p.img); if (st !== 200) rotas.push(p.id + ":" + st); }
  check(rotas.length === 0, "3.1", "muestra de 20 imagenes sin rotas", rotas);

  /* 4. data/configuracion.js */
  check(cfg.st === 200, "4.1", "configuracion HTTP 200", cfg.st);
  check(!!conf, "4.2", "configuracion parsea como JSON");
  if (conf) {
    check(!/"claveAdmin"/.test(cfg.t), "4.3", "sin claveAdmin publicada");
    check(!/github_pat_/.test(cfg.t), "4.4", "sin token de GitHub publicado");
    check(typeof conf.version === "number", "4.5", "version numerica", conf.version);
    check((conf.tienda || {}).whatsappPedidos === "573132434760", "4.6", "WhatsApp vigente en config publicada", (conf.tienda || {}).whatsappPedidos);
    check((conf.tienda || {}).nombre === "JUGA", "4.7", "nombre JUGA en config publicada", (conf.tienda || {}).nombre);
  }

  /* 5. Legal y activos de marca */
  const legal = await texto(BASE + "legal.html");
  check(legal.st === 200, "5.1", "legal.html HTTP 200", legal.st);
  const activos = ["logo_120.png", "logo_120_light.png", "logo_512.png", "logo_512_light.png", "favicon.ico",
    "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "og.png", "qr_juga.png"];
  const muertos = [];
  for (const a of activos) { const st = await vivo(BASE + a); if (st !== 200) muertos.push(a + ":" + st); }
  check(muertos.length === 0, "5.2", "10 activos de marca HTTP 200", muertos);

  /* 6. Deploy reciente de Pages (aviso, no bloquea si la API esta limitada) */
  try {
    const r = await fetch("https://api.github.com/repos/tiendalunaria/juga/actions/runs?per_page=15", { headers: UA });
    if (r.ok) {
      const runs = (await r.json()).workflow_runs || [];
      const last = runs.find(x => x.name === "pages build and deployment");
      check(!!last && (last.conclusion === "success" || last.status === "in_progress"), "6.1",
        "ultimo deploy de Pages " + (last ? last.conclusion || last.status : "n/d"), last && last.created_at);
    } else check(true, "6.1", "deploy Pages no verificado (API " + r.status + ")");
  } catch (e) { check(true, "6.1", "deploy Pages no verificado (sin red a la API)"); }

  /* Resumen + archivo para el workflow */
  const ok = res.filter(x => x.ok).length, total = res.length;
  const lineas = [
    "Fecha: " + new Date().toISOString(),
    "URL: " + BASE,
    "RESULTADO: " + ok + "/" + total + " PASS" + (ok === total ? "" : "  *** FALLO ***"),
    "",
    ...res.map(x => (x.ok ? "PASS " : "FAIL ") + x.id + " " + x.msg + (x.ok ? "" : " -> " + x.extra)),
  ].join("\n");
  require("fs").writeFileSync(__dirname + "/smoke_resultado.txt", lineas + "\n");
  console.log("\n===== " + ok + "/" + total + " PASS ===== " + (ok === total ? "PRODUCCION SANA" : "REVISAR YA"));
  process.exit(ok === total ? 0 : 1);
})().catch(e => {
  require("fs").writeFileSync(__dirname + "/smoke_resultado.txt", "FALLO GENERAL: " + (e && e.message || e) + "\n" + (e && e.stack || ""));
  console.error("FALLO GENERAL:", e && e.message || e);
  process.exit(1);
});
