# AGENTS.md — Guía para trabajar en este repositorio

Tienda online de JUGA: un `index.html` monolítico publicado por GitHub Pages
en https://tiendalunaria.github.io/juga/, con catálogo sincronizado cada 6 h
desde el repo de la juguetería y panel de administración que publica la
configuración por API. Ver `README.md` para la arquitectura completa y
`JUGA_Brief_Branding.md` para la identidad de marca.

## Reglas de oro

1. **El repo es público.** Nada de tokens, llaves ni contraseñas. El token de
   GitHub (fine-grained, Contents de este repo) vive SOLO en el navegador del
   panel; `GitHub.txt` es local (`.gitignore`).
2. **`catalogo.js` e `img/p/` son generados** por `scripts/sync_catalogos.py`
   (cron cada 6 h): jamás se editan a mano. `data/configuracion.js` lo escribe
   el PANEL vía API de GitHub: tampoco se edita a mano.
3. Al publicar, `index.html` y `legal.html` son lo único que se toca a mano.
4. Textos de la tienda: español de Colombia, tuteo, tono cálido. Los mensajes
   de commit del grupo no llevan tildes (estilo histórico).
5. No commitear sin QA verde: sintaxis del index (abajo), `node --check
   catalogo.js`, suites locales y smoke L4 de producción.

## Comandos de verificación

```bash
# Sintaxis JS del index (los <script> con src y JSON-LD no se evalúan)
node -e "const h=require('fs').readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(h))!==null){if(m[1].trim())new Function(m[1]);}console.log('OK')"

node --check catalogo.js          # catálogo vigente parsea
node qa_admin_e2e.js             # panel: 47/47 esperado (Playwright; grupo C calcula con el motor)
node qa_aterrizaje_precios.js    # aterrizajes + precios + carrito: 45/45 esperado (producción)
node qa_smoke_produccion.js      # smoke L4 de producción: 25/25 (solo lectura; QA_TIENDA_URL para otra URL)

# Sync en seco contra un clon local de la fuente (no toca producción):
JUGA_FUENTE_LOCAL=/ruta/al/clon/jugueteriataiwan python scripts/sync_catalogos.py
```

Publicar: `git push origin main`. GitHub Pages republica en ~1–3 min. Si el
push es rechazado, el cron o el panel movieron el remoto: `git pull --rebase
origin main` y push de nuevo (el panel solo toca `data/configuracion.js` y el
cron `catalogo.js` + `img/`: no hay conflicto posible).

## Mapa del código (index.html)

- **Configuración editable**: `TIENDA_DEFECTO` y `PRECIOS_DEFECTO` son la
  FÁBRICA; `data/configuracion.js` es lo PUBLICADO desde el panel (botón
  "Publicar para TODOS", vía API con el token Contents) y **manda sobre la
  fábrica** con versión siempre creciente (`Math.max(Date.now(), publicada+1)`)
  y SIN `claveAdmin`. La absorción (`absorberConfigPublica`, `BASE_CONFIG_KEY`)
  descarta el preview local cuando lo publicado es más nuevo. Si cambias la
  fábrica a mano, recuerda que lo publicado la tapa.
- **Panel de administración**: login con `TIENDA_DEFECTO.claveAdmin` (clave de
  conveniencia, no seguridad), abre con el enlace del pie, `?admin` o
  Ctrl+Shift+A. El token de GitHub se guarda en localStorage
  (`juga-github-token`) y se puede cargar con el enlace de configuración de un
  solo toque (`generar_enlace_config.py`, local: viaja en el #fragmento, que
  nunca llega al servidor).
- **Precios**: `precioFinal(p) = base × multiplicadorBase × (1 + margen)` con
  redondeo comercial hacia ARRIBA (`redondearPrecio`, con épsilon para que un
  resto flotante tipo `4000×1.3 = 5200.000…01` no suba $100 de más). Prioridad:
  precio exacto del panel → margen de temporada → margen de categoría →
  margen global (el de categoría REEMPLAZA al global). **Base del catálogo =
  Precio 2 de vitrina del POS** (el `price5` mayorista que publica la fuente NO
  se consume: con él, un tercio del catálogo quedaba por debajo de la tienda
  física saldosjugueteriataiwan.com, que vende al Precio 2 exacto). Publicado
  desde oct-2026: **margen global 30 % + redondeo $100** → JUGA queda SIEMPRE
  por encima de la tienda física, y el % del panel es el control de cuánto por
  encima. **Orden por defecto del grid: mayor a menor** (`orden="d"`).
- **Héroe** (solo escritorio, ≤900 px oculto): galería de hasta 6 juguetes
  (heroIds del panel) con el **emblema** `logo_512.png` al centro — el círculo
  blanco con las letras de color es opaco y se lee sobre cualquier foto. Nunca
  usar `logo_512_light.png` ahí: la versión light vuelve blanco TODO el
  emblema y el círculo queda vacío.
- **Barra de filtros del catálogo** (`.tbar` + `#chips`): los chips van en UNA
  sola fila deslizable (snap entre chips, degradado al borde derecho con el
  pseudo sticky `::after` y la clase `is-desb` que marca `ajustarChips()` en
  render y resize). Envueltos ocupaban 2–3 filas y la barra pegajosa tapaba las
  tarjetas.
- **Navegación a un producto** (`scrollToProduct`): paginación just-in-time
  (renderiza la página del índice), abre el panel de cantidad y
  `scrollIntoView` con `behavior:"instant"` si el salto es >4000 px, suave si
  es corto. OJO: `behavior:"auto"` NO es instantáneo — cae al
  `scroll-behavior:smooth` del CSS del html.
- **Compra**: carrito lateral con sugeridos por categoría (COMPLEMENTOS),
  checkout por fases (pedido → datos → entrega → pago → notas) con validación
  en vivo, consecutivo `PED-YYYYMMDD-NNN`, pedido directo por wa.me al
  WhatsApp configurado y hoja de pedido PNG dibujada en canvas que se
  descarga para adjuntar al chat. "Vuelo al carrito" con WAAPI (respeta
  `prefers-reduced-motion`).
- **Visibilidad**: `prodVisible(p)` y `catViva(id)` son la ÚNICA fuente de
  verdad — gobiernan grid, subnav, burbujas, chips, menú móvil, carruseles,
  héroe, favoritos, buscador, lightbox, upsells y footer.
- **Buscador**: normaliza tildes y ñ, palabras sueltas en cualquier orden, y
  cubre código `JUG-XXXX` y SKU de la fuente. Enlace de alistamiento:
  `?art=JUG-XXXX`.

## QA: por qué las suites son dinámicas

- El grupo C de `qa_admin_e2e.js` calcula las expectativas con el propio
  `precioFinal()` del index: NO codificar precios esperados — cualquier cambio
  de base o margen los invalidaría.
- El check 6 de `qa_aterrizaje_precios.js` compara cada producto visible
  contra `precioFinal(base)`: válido para cualquier estrategia publicada.
- El smoke L4 lee el margen de la config publicada y escala los rangos:
  vitrina $200–$600.000; precio final $200–$780.000 con margen 30 % (el techo
  del 2.4b se recalcula solo si se sube el margen).

## Gotchas conocidos

- GitHub Pages sirve el index con caché: al verificar un deploy usa
  cache-buster (`?t=` + fecha). El deploy tarda 1–3 min tras el push.
- Los cambios de margen/redondeo van por el PANEL (Publicar para TODOS), no
  por código: lo publicado siempre tapa a la fábrica. La clave del panel nunca
  viaja en la config publicada (el smoke lo verifica a diario).
- `price5` (Precio 5 del POS, escalón mayorista) viaja en el catálogo de la
  fuente como campo aditivo (1.923 de 1.938 productos lo traen): disponible
  para otros canales, pero JUGA no lo consume por decisión de negocio
  (superioridad sobre la tienda física). Ratio P2/P5 hasta 12×: ningún margen
  único sano lo compensaría.
- El historial de este repo contiene los commits previos de LUNARIA (pijamas):
  es herencia del clon; los checks L0 de marca vieja solo aplican al contenido
  actual de `index.html`/`legal.html`.
- Las rutas absolutas de las suites apuntan al Playwright de
  `C:/Users/User/IKI/dropi-analytics/node_modules`: ajustar si se mueve ese
  proyecto.
