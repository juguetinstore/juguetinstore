/* ===== AUDITORIA E2E COMPLETA DEL PANEL DE ADMINISTRACION (JUGA) =====
   Ejecutar:  node qa_admin_e2e.js   (usa el playwright de dropi-analytics)
   Cubre: acceso (3 vias + login/clave), todos los campos (identidad,
   legales, redes, ganancias, categorias), todas las funciones (heroe,
   favoritos, visibilidad de secciones/carruseles/catalogos/categorias,
   ocultar productos, precio exacto, comportamiento, clave nueva, token,
   publicar, guardar, restaurar, copiar, preview, lista). El grupo G publica
   de verdad una version nueva de data/configuracion.js (solo si hay token
   local de GitHub para tiendalunaria/juga). */
const { chromium } = require("C:/Users/User/IKI/dropi-analytics/node_modules/playwright");
const fs = require("fs");

const BASE = process.env.QA_LOCAL_URL || "file:///C:/Users/User/JUGA/juga/index.html";
const PROD = process.env.QA_TIENDA_URL || "https://tiendalunaria.github.io/juga/";
const CLAVE = "JUGA123*";
const TOKEN_FILE = process.env.QA_TOKEN_FILE || "C:/Users/User/JUGA/juga/GitHub.txt";
const res = [];
let grupo = "";
const check = (n, c, e) => res.push(grupo + " | " + n + ": " + (c ? "PASS" : "FAIL" + (e !== undefined ? " -> " + JSON.stringify(e) : "")));

async function nuevaPagina(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 950 } }, opts || {}));
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__toasts = []; });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => (window.PRODUCTOS || []).length > 0, { timeout: 45000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}
async function entrar(page) {
  await page.evaluate(() => intentarAbrirAdmin());
  await page.fill("#adminClave", CLAVE);
  await page.press("#adminClave", "Enter");
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch();

  /* ============ A. ACCESO Y LOGIN ============ */
  grupo = "A-Acceso";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await page.click('footer a[onclick*="intentarAbrirAdmin"]');
    await page.waitForTimeout(200);
    check("A1 footer 'Administración' abre login", await page.evaluate(() => document.getElementById("adminLoginModal").classList.contains("show")));
    await page.fill("#adminClave", "Incorrecta99");
    await page.press("#adminClave", "Enter");
    await page.waitForTimeout(200);
    const errVisible = await page.evaluate(() => !document.getElementById("adminLoginError").hidden);
    const panelCerrado = await page.evaluate(() => !document.getElementById("adminModal").classList.contains("show"));
    check("A2 clave incorrecta: error visible y panel cerrado", errVisible && panelCerrado);
    await page.fill("#adminClave", CLAVE);
    await page.press("#adminClave", "Enter");
    await page.waitForTimeout(300);
    check("A3 clave correcta con Enter: panel abre", await page.evaluate(() => document.getElementById("adminModal").classList.contains("show")));
    await page.evaluate(() => cerrarPanelAdmin());
    await page.keyboard.press("Control+Shift+A");
    await page.waitForTimeout(250);
    check("A4 Ctrl+Shift+A con sesión: abre panel directo", await page.evaluate(() => document.getElementById("adminModal").classList.contains("show")));
    await page.evaluate(() => cerrarSesionAdmin());
    await page.waitForTimeout(200);
    const cerrado = await page.evaluate(() => !document.getElementById("adminModal").classList.contains("show"));
    await page.evaluate(() => intentarAbrirAdmin());
    const loginOtraVez = await page.evaluate(() => document.getElementById("adminLoginModal").classList.contains("show"));
    check("A5 Salir: cierra panel y exige clave de nuevo", cerrado && loginOtraVez);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "?admin=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(400);
    check("A6 ?admin en la URL abre login", await page.evaluate(() => document.getElementById("adminLoginModal").classList.contains("show")));
    await ctx.close();
  }
  {
    const { ctx, page } = await nuevaPagina(browser);
    await page.keyboard.press("Control+Shift+A");
    await page.waitForTimeout(250);
    check("A7 Ctrl+Shift+A sin sesión abre login", await page.evaluate(() => document.getElementById("adminLoginModal").classList.contains("show")));
    await ctx.close();
  }

  /* ============ B. IDENTIDAD, LEGALES, REDES, GUARDAR/RESTAURAR/COPIAR ============ */
  grupo = "B-Identidad";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await entrar(page);
    await page.fill("#adminNombre", "TIENDA PRUEBA E2E");
    await page.evaluate(() => aplicarPanelAdmin());
    await page.waitForTimeout(300);
    const titulo = await page.evaluate(() => document.title);
    check("B1 nombre: título del documento actualizado", /TIENDA PRUEBA E2E/.test(titulo), titulo);
    await page.fill("#adminWaPedidos", "3001112222");
    await page.evaluate(() => guardarPanelAdmin());
    const wa = await page.evaluate(() => CONFIG.whatsapp);
    check("B2 WhatsApp 3001112222 normaliza a 573001112222", wa === "573001112222", wa);
    await page.fill("#adminRazon", "Prueba SAS");
    await page.fill("#adminNit", "NIT-900123");
    await page.fill("#adminDir", "Calle Falsa 123");
    await page.fill("#adminEmail", "prueba@juga.co");
    await page.fill("#adminIg", "@juga.prueba");
    await page.fill("#adminPixel", "1234567890");
    await page.evaluate(() => guardarPanelAdmin());
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("juga-tienda-v1")));
    check("B3 legales/redes/pixel persistidos en localStorage",
      guardado.razonSocial === "Prueba SAS" && guardado.nit === "NIT-900123" && guardado.pixelMeta === "1234567890" && guardado.instagram === "juga.prueba", guardado);
    await page.evaluate(() => { window.__cb = null; const o = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null; if (o) navigator.clipboard.writeText = t => { window.__cb = t; return o(t); }; });
    await page.evaluate(() => copiarConfigAdmin());
    await page.waitForTimeout(350);
    const cb = await page.evaluate(() => window.__cb);
    check("B4 copiar configuración: bloques TIENDA_DEFECTO + PRECIOS_DEFECTO con valores actuales",
      cb && /const TIENDA_DEFECTO=/.test(cb) && /const PRECIOS_DEFECTO=/.test(cb) && /TIENDA PRUEBA E2E/.test(cb), cb && cb.slice(0, 80));
    await page.evaluate(() => restaurarPanelAdmin());
    const despues = await page.evaluate(() => ({ ls: localStorage.getItem("juga-tienda-v1"), nombre: TIENDA.nombre, wa: TIENDA.whatsappPedidos }));
    check("B5 restaurar: limpia localStorage y vuelve a lo publicado", despues.ls === null && despues.nombre === "JUGA" && despues.wa === "573132434760", despues);
    const preview = await page.evaluate(() => { document.getElementById("adminMargen").value = "25"; document.getElementById("adminMultiplicador").value = "1"; document.getElementById("adminRedondeo").value = "100"; pintarPreviewAdmin(); return document.getElementById("adminPreview").textContent; });
    check("B6 preview: costo $10.000 con 25% -> $12.500", /\$12\.500/.test(preview), preview);
    await ctx.close();
  }

  /* ============ C. PRECIOS (base = vitrina del POS + config publicada: margen 30%, redondeo $100) ============ */
  grupo = "C-Precios";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await entrar(page);
    const antes = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C0 base: pinza-la-bubu al precio configurado (vitrina $4.000 ×1.3 → $5.200)", antes === 5200, antes);
    await page.fill('#adminCats input[data-cat="cacharro"]', "100");
    await page.evaluate(() => aplicarPanelAdmin());
    const c1 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C1 margen cacharros 100% (reemplaza al global): pinza = $8.000", c1 === 8000, c1);
    await page.fill("#adminBuscarPrecio", "pinza la bubu");
    await page.waitForTimeout(200);
    await page.evaluate(() => fijarPrecioAdmin("pinza-la-bubu", "50000"));
    const c2 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C2 precio exacto pinza=$50.000 gana sobre el margen", c2 === 50000, c2);
    await page.evaluate(() => fijarPrecioAdmin("pinza-la-bubu", ""));
    const c3 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C3 quitar precio fijo: vuelve a $8.000", c3 === 8000, c3);
    await page.selectOption("#adminRedondeo", "500");
    await page.evaluate(() => aplicarPanelAdmin());
    const c4 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C4 redondeo 500: 4000×2(cat 100%)=8.000 ya es múltiplo → $8.000", c4 === 8000, c4);
    await page.fill("#adminMultiplicador", "2");
    await page.evaluate(() => aplicarPanelAdmin());
    const c5 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C5 multiplicador x2: 4000×2×2=16.000 red500 → $16.000", c5 === 16000, c5);
    await page.evaluate(() => restaurarPanelAdmin());
    const c6 = await page.evaluate(() => window.PRODUCTOS.find(p => p.id === "pinza-la-bubu").p);
    check("C6 restaurar: pinza vuelve al precio configurado $5.200", c6 === 5200, c6);
    await ctx.close();
  }

  /* ============ D. HÉROE Y FAVORITOS ============ */
  grupo = "D-Héroe/Favoritos";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await entrar(page);
    const heroe0 = await page.evaluate(() => [...document.querySelectorAll("#heroGal .hg-item")].length);
    check("D0 héroe con 6 juguetes destacados", heroe0 === 6, heroe0);
    await page.evaluate(() => quitarHeroAdmin("goku-y-rey-mono"));
    const heroe1 = await page.evaluate(() => [...document.querySelectorAll("#heroGal .hg-item")].length);
    check("D1 quitar del héroe: queda 5", heroe1 === 5, heroe1);
    await page.fill("#adminBuscarHero", "rubik");
    await page.waitForTimeout(250);
    const resultados = await page.evaluate(() => document.querySelectorAll("#adminResHero .admin-fila").length);
    await page.evaluate(() => agregarHeroAdmin("caja-cubo-rubik-3x3-cuadritos-qytoys"));
    const heroe2 = await page.evaluate(() => [...document.querySelectorAll("#heroGal .hg-item")].length);
    check("D2 buscador del héroe agrega: 5 -> 6", resultados > 0 && heroe2 === 6, { resultados, heroe2 });
    await page.fill("#adminBuscarHero", "mesa");
    await page.waitForTimeout(250);
    const cap = await page.evaluate(() => { const b = document.querySelector("#adminResHero button"); return b ? (b.disabled || /Máximo/.test(b.textContent)) : true; });
    check("D3 tope de 6: botón deshabilitado en los resultados", cap === true);
    const HERO_PUB = "mesa-futbol-de-madera,pista-neon-carro-pila-luz-con-numero,carro-armable-x448pcs-control-remoto-pilas-1,goku-y-rey-mono,rompecabezas-torre-eiffel-x1000-piezas-caja,burbujero-mil-burbujas-pilas-cj-bubble-gun-4-motivos";
    await page.evaluate((h) => { TIENDA.heroIds = h; aplicarTienda(); actualizarHero(); pintarHeroAdmin(); }, HERO_PUB);
    const heroe4 = await page.evaluate(() => TIENDA.heroIds);
    check("D4 héroe restaurado a la curación publicada", heroe4 === HERO_PUB, heroe4);
    const fav0 = await page.evaluate(() => document.querySelectorAll("#carFav .cari").length);
    await page.evaluate(() => quitarFavoritoAdmin("muneco-pokemon"));
    const fav1 = await page.evaluate(() => document.querySelectorAll("#carFav .cari").length);
    await page.fill("#adminBuscarFav", "pokemon");
    await page.waitForTimeout(250);
    await page.evaluate(() => agregarFavoritoAdmin("muneco-pokemon"));
    const fav2 = await page.evaluate(() => document.querySelectorAll("#carFav .cari").length);
    check("D5 favoritos: quitar 14->13 y agregar 13->14", fav0 === 14 && fav1 === 13 && fav2 === 14, { fav0, fav1, fav2 });
    const listaFav = await page.evaluate(() => document.querySelectorAll("#adminFavoritosLista .admin-fila").length);
    check("D6 panel lista los 14 favoritos", listaFav === 14, listaFav);
    await ctx.close();
  }

  /* ============ E. VISIBILIDAD ============ */
  grupo = "E-Visibilidad";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await entrar(page);
    const secciones = [["adminVerMarquee", ".marquee"], ["adminVerCategorias", ".catsbar"], ["adminVerCarruseles", ".carsec"], ["adminVerConfianza", ".trust"], ["adminVerFaq", "#faq"], ["adminVerContacto", ".news"], ["adminVerHero", ".hero"]];
    for (const [id, sel] of secciones) {
      await page.evaluate((id) => { const cb = document.getElementById(id); cb.checked = false; cb.dispatchEvent(new Event("change")); }, id);
      const oculto = await page.evaluate((sel) => { const el = document.querySelector(sel); return el && el.style.display === "none"; }, sel);
      await page.evaluate((id) => { const cb = document.getElementById(id); cb.checked = true; cb.dispatchEvent(new Event("change")); }, id);
      const visible = await page.evaluate((sel) => { const el = document.querySelector(sel); return el && el.style.display !== "none"; }, sel);
      check(`E ${id.replace("adminVer", "Sección ")}: oculta y muestra`, oculto && visible, { id, oculto, visible });
    }
    await page.evaluate(() => { const cb = document.getElementById("adminVerCarFav"); cb.checked = false; cb.dispatchEvent(new Event("change")); });
    const favOff = await page.evaluate(() => document.getElementById("favoritos").style.display === "none");
    await page.evaluate(() => { const cb = document.getElementById("adminVerCarFav"); cb.checked = true; cb.dispatchEvent(new Event("change")); });
    const favOn = await page.evaluate(() => document.getElementById("favoritos").style.display !== "none");
    check("E8 carrusel favoritos: oculta y muestra", favOff && favOn, { favOff, favOn });
    // E9: ocultar el catalogo completo de juguetes (linea tw)
    const totalVisibles = await page.evaluate(() => window.PRODUCTOS.filter(p => prodVisible(p)).length);
    await page.evaluate(() => toggleCatalogo("tw", false));
    await page.waitForTimeout(300);
    const e9 = await page.evaluate(() => ({
      visibles: window.PRODUCTOS.filter(p => prodVisible(p)).length,
      chips: document.querySelectorAll("#chips .chip").length,
      grid: document.querySelector("#grid").textContent.includes("No encontramos"),
      heroe: document.querySelectorAll("#heroGal .hg-item").length,
    }));
    check("E9 ocultar catalogo tw: tienda vacía (0 visibles, grid avisa, héroe vacío)", e9.visibles === 0 && e9.chips === 1 && e9.grid && e9.heroe === 0, e9);
    await page.evaluate(() => toggleCatalogo("tw", true));
    await page.waitForTimeout(200);
    const e9b = await page.evaluate(() => window.PRODUCTOS.filter(p => prodVisible(p)).length);
    check("E9b restaurar tw: " + totalVisibles + " visibles de nuevo", e9b === totalVisibles && totalVisibles > 1500, { e9b, totalVisibles });
    // E10: ocultar una categoria completa (conteo dinamico: nunca queda viejo)
    const antesColecciones = await page.evaluate(() => ({ visibles: window.PRODUCTOS.filter(p => prodVisible(p)).length, enCat: window.PRODUCTOS.filter(p => p.cat === "colecciones" && prodVisible(p)).length }));
    await page.evaluate(() => { const cb = document.querySelector('#adminCatsVis input[onchange*="colecciones"]'); cb.checked = false; cb.dispatchEvent(new Event("change")); });
    await page.waitForTimeout(200);
    const e10 = await page.evaluate(() => ({ chip: !!document.querySelector('#chips .chip[data-c="colecciones"]'), visibles: window.PRODUCTOS.filter(p => prodVisible(p)).length }));
    check("E10 ocultar categoría colecciones: chip fuera y " + (antesColecciones.visibles - antesColecciones.enCat) + " visibles",
      e10.chip === false && e10.visibles === antesColecciones.visibles - antesColecciones.enCat, { e10, antesColecciones });
    await page.evaluate(() => { const cb = document.querySelector('#adminCatsVis input[onchange*="colecciones"]'); cb.checked = true; cb.dispatchEvent(new Event("change")); });
    // E11: ocultar producto y mostrarlo
    await page.fill("#adminBuscarOcultar", "mesa futbol");
    await page.waitForTimeout(250);
    await page.evaluate(() => toggleProductoOculto("mesa-futbol-de-madera"));
    const e11 = await page.evaluate(() => window.PRODUCTOS.filter(p => prodVisible(p)).length);
    await page.fill("#adminBuscarOcultar", "mesa futbol");
    await page.waitForTimeout(250);
    const etiqueta = await page.evaluate(() => document.querySelector("#adminResOcultar .admin-btn").textContent.trim());
    await page.evaluate(() => toggleProductoOculto("mesa-futbol-de-madera"));
    const e11b = await page.evaluate(() => window.PRODUCTOS.filter(p => prodVisible(p)).length);
    check("E11 ocultar producto mesa-futbol: 1 menos, botón cambia a Mostrar, se restaura", e11 === totalVisibles - 1 && etiqueta === "Mostrar" && e11b === totalVisibles, { e11, etiqueta, e11b });
    await ctx.close();
  }

  /* ============ F. COMPORTAMIENTO, CLAVE, TOKEN, LISTA ============ */
  grupo = "F-Comportamiento";
  {
    const { ctx, page } = await nuevaPagina(browser);
    await entrar(page);
    await page.evaluate(() => { const cb = document.getElementById("adminContraEntrega"); cb.checked = false; cb.dispatchEvent(new Event("change")); });
    await page.evaluate(() => aplicarPanelAdmin());
    const f1 = await page.evaluate(() => {
      const op = document.querySelector('input[name="paymentMethod"][value="contra-entrega"]');
      const et = op.closest(".po");
      return { oculta: et.style.display === "none", contra: contraEntregaActiva() };
    });
    check("F1 contra entrega off: opción desaparece del checkout", f1.oculta && f1.contra === false, f1);
    await page.evaluate(() => { const cb = document.getElementById("adminVaciar"); cb.checked = false; cb.dispatchEvent(new Event("change")); });
    await page.evaluate(() => guardarPanelAdmin());
    const f2 = await page.evaluate(() => JSON.parse(localStorage.getItem("juga-tienda-v1")).vaciarCarrito);
    check("F2 vaciar carrito off persistido", f2 === false, f2);
    await page.fill("#adminClaveNueva", "NuevaClaveE2E");
    await page.evaluate(() => guardarPanelAdmin());
    await page.evaluate(() => cerrarSesionAdmin());
    await page.evaluate(() => intentarAbrirAdmin());
    await page.fill("#adminClave", CLAVE);
    await page.press("#adminClave", "Enter");
    await page.waitForTimeout(200);
    const viejaFalla = await page.evaluate(() => !document.getElementById("adminModal").classList.contains("show") && !document.getElementById("adminLoginError").hidden);
    await page.fill("#adminClave", "NuevaClaveE2E");
    await page.press("#adminClave", "Enter");
    await page.waitForTimeout(250);
    const nuevaEntra = await page.evaluate(() => document.getElementById("adminModal").classList.contains("show"));
    check("F3 clave nueva: vieja falla, nueva entra", viejaFalla && nuevaEntra);
    await page.fill("#adminToken", "github_pat_PRUEBA");
    await page.evaluate(() => guardarTokenGitHub());
    const tok1 = await page.evaluate(() => localStorage.getItem("juga-github-token"));
    await page.fill("#adminToken", "");
    await page.evaluate(() => guardarTokenGitHub());
    const tok2 = await page.evaluate(() => localStorage.getItem("juga-github-token"));
    check("F4 token: se guarda y se borra", tok1 === "github_pat_PRUEBA" && tok2 === "", { tok1, tok2 });
    await page.evaluate(() => { window.__ultimoToast = ""; const o = showToast; window.showToast = m => { window.__ultimoToast = m; o(m); }; });
    await page.evaluate(() => publicarConfigAdmin());
    await page.waitForTimeout(200);
    const f5 = await page.evaluate(() => ({ toast: window.__ultimoToast, guia: document.querySelector(".admin-sync-ayuda").open }));
    check("F5 publicar sin token: toast de error y guía abierta", /token/i.test(f5.toast) && f5.guia === true, f5);
    await page.evaluate(() => toggleListaTodosAdmin());
    const f6 = await page.evaluate(() => ({ visible: !document.getElementById("adminLista").hidden, filas: document.querySelectorAll("#adminLista .admin-fila").length }));
    check("F6 lista completa de productos: abre con todas las filas", f6.visible && f6.filas > 1500, f6);
    await page.fill("#adminNombre", "PRUEBA GUARDAR");
    await page.evaluate(() => guardarPanelAdmin());
    const f7 = await page.evaluate(() => JSON.parse(localStorage.getItem("juga-tienda-v1")).nombre);
    check("F7 guardar en MI computador persiste el nombre", f7 === "PRUEBA GUARDAR", f7);
    await ctx.close();
  }

  /* ============ G. PUBLICAR PARA TODOS (EN VIVO, solo si hay token local) ============ */
  grupo = "G-Publicar(vivo)";
  {
    let tok = "";
    try { tok = ((fs.readFileSync(TOKEN_FILE, "utf8").match(/github_pat_[A-Za-z0-9_]+/) || [])[0]) || ""; } catch (e) {}
    if (!tok) {
      check("G0 omitido: sin token local para " + "tiendalunaria/juga" + " (deja " + TOKEN_FILE + " con el token fine-grained para correr esta prueba)", true);
    } else {
      const apiConfig = async () => {
        const r = await fetch("https://api.github.com/repos/tiendalunaria/juga/contents/data/configuracion.js", { headers: { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json" }, cache: "no-store" });
        const j = await r.json();
        const txt = Buffer.from(j.content, "base64").toString("utf8");
        return { version: Number((/"version":\s*(\d+)/.exec(txt) || [0, 0])[1]), sinClave: !/"claveAdmin"/.test(txt), hero: /"heroIds":\s*"([^"]*)"/.exec(txt)[1] };
      };
      const previaCfg = await apiConfig();
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
      const page = await ctx.newPage();
      await page.route("**/data/configuracion.js", r => { const u = new global.URL(r.request().url()); u.searchParams.set("cb", String(Date.now())); r.continue({ url: u.toString() }); });
      await page.goto(PROD + "?cb=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForFunction(() => (window.PRODUCTOS || []).length > 0, { timeout: 60000 });
      await page.waitForTimeout(1000);
      await page.evaluate((t) => { localStorage.setItem("juga-github-token", t); }, tok);
      await page.evaluate(() => intentarAbrirAdmin());
      await page.fill("#adminClave", CLAVE);
      await page.press("#adminClave", "Enter");
      await page.waitForTimeout(400);
      const tokenEnCampo = await page.evaluate(() => document.getElementById("adminToken").value);
      await page.evaluate(() => { window.__pubToast = ""; const o = showToast; window.showToast = m => { window.__pubToast = m; o(m); }; });
      await page.evaluate(() => publicarConfigAdmin());
      await page.waitForTimeout(6000);
      const nuevaCfg = await apiConfig();
      const g = await page.evaluate(() => ({ toast: window.__pubToast, base: localStorage.getItem("juga-config-base"), hero: TIENDA.heroIds }));
      check("G1 publicar con token real: toast de publicada", /Publicada/.test(g.toast), g.toast);
      check("G2 la versión publicada incrementa sobre la previa", nuevaCfg.version > previaCfg.version, { previa: previaCfg.version, nueva: nuevaCfg.version });
      check("G3 la configuración publicada no lleva la clave", nuevaCfg.sinClave === true);
      check("G4 el navegador queda sincronizado con lo publicado", g.base === String(nuevaCfg.version), { base: g.base, nueva: nuevaCfg.version });
      check("G5 el campo del panel nace lleno con el token", /^github_pat_/.test(tokenEnCampo));
      check("G6 lo publicado conserva la curación vigente (héroe)", nuevaCfg.hero === g.hero, { remoto: nuevaCfg.hero, local: g.hero });
      await ctx.close();
    }
  }

  await browser.close();
  const total = res.length, ok = res.filter(r => r.includes("PASS")).length;
  console.log(res.join("\n"));
  console.log("\n===== RESUMEN: " + ok + "/" + total + " PASS =====");
  process.exit(ok === total ? 0 : 1);
})();
