# JUGA — Regalos que despiertan sonrisas

Tienda online de **JUGA** (Colombia): juguetería y regalos infantiles —
juguetería, piñatería, didácticos, cubos Rubik, colecciones, cacharros y más —
publicada en **https://tiendalunaria.github.io/juga/** desde el repositorio
`github.com/tiendalunaria/juga`. Sin frameworks, sin build, sin backend:
HTML + CSS + JS en un archivo, catálogo sincronizado automáticamente y panel
de administración que publica la configuración por API.

JUGA hereda el sistema completo de la tienda de LUNARIA
(github.com/tiendalunaria/lunaria) con la estrategia del grupo de **un
catálogo por repositorio**. Aquí vive la línea de **juguetes**: el inventario
real de la juguetería publicado en
`github.com/jugueteriataiwanoficial/jugueteriataiwan` (generado 4 veces al día
desde el POS de la tienda física). Identidad propia: paleta azul JUGA /
amarillo / coral / crema, tipografía Baloo 2 + Nunito, logo infantil con
sonrisas y códigos de producto `JUG-XXXX` (ver `JUGA_Brief_Branding.md`).

---

## 1. Arquitectura de archivos

| Archivo / carpeta | Rol |
|---|---|
| `index.html` | Tienda completa (HTML + CSS + JS en un archivo). Todo el comportamiento vive aquí |
| `catalogo.js` | Catálogo activo (~1.938 juguetes). **Lo genera el cron**: no se edita a mano |
| `data/configuracion.js` | Configuración publicada desde el panel ("Publicar para TODOS"). La mantiene el panel vía API de GitHub: nadie la edita a mano |
| `legal.html` | 8 políticas con anclas; absorbe la configuración publicada (razón social, NIT, contacto) |
| `scripts/sync_catalogos.py` | Lee el catálogo maestro publicado por la juguetería, lo convierte al formato JUGA, rehospeda las fotos nuevas y escribe `catalogo.js` |
| `.github/workflows/sync-catalogos.yml` | Cron cada 6 horas (+ manual): clona la fuente, sincroniza, commitea y publica (con `pull --rebase` para absorber lo publicado por el panel) |
| `img/p/` | Miniaturas webp rehospedadas de los juguetes (hash del path de la fuente: rehost incremental) |
| `generar_enlace_config.py` | **Local** (en `.gitignore`): arma el enlace de configuración de un solo toque (token) |
| `GitHub.txt` | **Local** (en `.gitignore`): donde vive el token de GitHub |
| `JUGA_Brief_Branding.md` | Manual de marca y del sistema publicado |
| `PLAN_AUDITORIA_E2E_QA.md` | Plan de auditoría E2E/QA: niveles L0–L5, severidades, calendario |
| `logo_120.png` / `logo_512.png` / `*_light.png` | Logo JUGA transparente en tamaños web (120: horizontal; 512: emblema cuadrado) |
| `favicon.ico`, `favicon-32/48.png`, `apple-touch-icon.png` | Emblema JUGA para navegadores |
| `qr_juga.png` | QR hacia la tienda (tarjeta para compartir) |
| `og.png` | Imagen de vista previa para redes (1200×630) |
| `qa_admin_e2e.js`, `qa_aterrizaje_precios.js` | Suites E2E locales (ajustar rutas al checkout local antes de correr) |
| `sitemap.xml`, `robots.txt` | SEO: envío a Google Search Console; canonical en index/legal. Al comprar el dominio oficial: actualizar URLs (GitHub Pages redirige 301 automático) |
| `qa_smoke_produccion.js` + `.github/workflows/qa-smoke.yml` | Smoke L4 diario (12:00 UTC) contra la tienda publicada: abre/cierra issue automático |

---

## 2. Actualización del catálogo (pipeline completo)

El cron corre `scripts/sync_catalogos.py` cada 6 horas. El pipeline:

### 2.1 Fuente: el catálogo maestro de la juguetería

| Línea | Fuente | Qué alimenta |
|---|---|---|
| `tw` | `github.com/jugueteriataiwanoficial/jugueteriataiwan` (su `catalogo.js`, regenerado 4×/día desde el POS de la tienda) | las 17 categorías de juguetes: juguetería, colecciones, piñatería, juegos de mesa, armatodo, didácticos, cacharros, slime, deporte, peluches, bebé, térmicos, burbujeros, escolar, animales, cubos Rubik y hogar |

El repo fuente es público: el sync lo clona (`--depth 1`) o lee su URL crudo.
Ante el cliente nunca aparece el nombre de la fuente: una sola marca (JUGA).

### 2.2 Conversión y curación

- **Precio final de vitrina tal cual**: la fuente ya publica el precio real de
  venta (Precio 2 del POS); el catálogo base arranca con margen 0 y redondeo 0.
  Si algún día se quiere ganancia extra, se sube desde el panel sin tocar
  código (publicado desde oct-2026 — ver §3).
- Nombres en formato Título (la fuente viene en mayúsculas), con SKU por
  producto para el buscador y los pedidos.
- Precio tachado (`antes`) solo si la fuente trae un `comparePrice` real por
  encima del precio de venta: no se inventan rebajas.
- Todo producto entra con foto (la miniatura webp publicada por la fuente).

### 2.3 Slugs y códigos permanentes (JUG-XXXX)

El `id` de cada juguete ES su slug de la fuente (estable por diseño), y el
código `JUG-XXXX` se asigna la primera vez que el producto aparece y **jamás
cambia**: el sync reutiliza los códigos del `catalogo.js` anterior por slug,
así los enlaces de pedidos viejos (`?art=JUG-XXXX`) y la curación del
héroe/favoritos no se rompen. Guarda-red: si la fuente cae y el catálogo
nuevo queda con <50% de los previos, se aborta y se conserva el vigente.

### 2.4 Imágenes propias

Las miniaturas webp de la fuente se **rehospedan** en `img/p/` (rehost
incremental por hash del path: solo se copian las nuevas). Cero dominios
ajenos en las fotos. Cadena de respaldo en la tienda: foto fallida →
siguiente de la galería → placeholder "JUGA" de la categoría.

### 2.5 Cron de GitHub Actions

Cada 6 horas: checkout con historial completo → clonar la fuente → sync →
`git add catalogo.js img` → si hay cambios: commit `[skip ci]` →
**`git pull --rebase`** (absorbe lo publicado por el panel vía API) → push.

---

## 3. Precios

`precioFinal = base × multiplicador × (1 + margen) → redondeo configurado`

Prioridad: **1)** precio exacto fijado en el panel → **2)** margen de
temporada → **3)** margen de categoría → **4)** margen global.

- **Fábrica: margen 0 y redondeo 0.** Publicado desde el panel (25-oct-2026):
  **margen global 30 % + redondeo comercial a $100** sobre el precio de
  vitrina (Precio 2 del POS). Calibrado contra mercado (oct-2026): futbolito
  de madera Éxito $301–362 mil vs JUGA $312 mil; cubos QiYi especializadas
  $18–29,5 mil vs JUGA $22,1 mil — ganancia fuerte sin salirse del rango de
  grandes superficies y tiendas especializadas.
- **Regla de negocio:** el margen es la ganancia de la gestión del
  administrador (comisión por las ventas) y se administra por configuración
  publicada (`data/configuracion.js`), nunca tocando código. El cliente solo
  ve el precio final: ningún porcentaje ni desglose se muestra en la tienda.
- **Orden del catálogo**: de **menor a mayor precio** por defecto.
- **Temporada automática** del 15-nov al 6-ene: configurable desde el panel
  (fábrica: 0 puntos extra).

---

## 4. Panel de administración

Acceso: footer "Administración", `?admin` o Ctrl+Shift+A (clave de
conveniencia, no seguridad; fábrica `JUGA123*`).

- **Publicar para TODOS**: sube la configuración vigente a
  `data/configuracion.js` vía API de GitHub (`tiendalunaria/juga`), con
  **versión siempre creciente** y **sin la clave del panel**; todos los
  visitantes la ven en ~1 minuto.
- Editable sin tocar código: nombre, logo, WhatsApp, email, redes, datos
  legales, analítica (Pixel de Meta y GA4), héroe, favoritos, visibilidad de
  secciones/carruseles, catálogo de inventario, categorías visibles,
  ocultar productos, precio exacto por producto y márgenes por categoría.
- **Token de GitHub**: fine-grained, Contents Read and write, **solo este
  repositorio**; vive únicamente en el navegador y se puede cargar con el
  **enlace de configuración** de un solo toque (`python
  generar_enlace_config.py`, local).

### Seguridad

- **Cero secretos en el repo y su historial**: ni tokens de GitHub ni
  credenciales; `GitHub.txt` y afines viven solo en `.gitignore` local.
- La clave de fábrica del panel (`JUGA123*`) viaja en el HTML a propósito:
  es conveniencia, no seguridad — solo cambia el navegador local. Publicar
  para todos exige el token fine-grained, que nunca está en el código.
- Verificación diaria automática: el smoke L4 revisa que la configuración
  publicada no contenga `claveAdmin` ni `github_pat_`.

---

## 5. Visibilidad (una sola fuente de verdad)

`prodVisible` (categoría viva + no oculto + catálogo no oculto) y `catViva`
gobiernan TODAS las superficies: grid, subnav, burbujas, chips, menú móvil,
carruseles, héroe, favoritos, buscador, upsells y footer.

---

## 6. Héroe y favoritos

- **Héroe** (solo escritorio, hasta 6 juguetes): selección de la tienda con
  texto "Encuentra ese regalo que ilumina su día / Juguetes para imaginar,
  descubrir y jugar". Se cura desde el panel (heroIds).
- **Favoritos del carrusel**: 14 juguetes representativos de las categorías.
- Los slugs/códigos son estables: la curación sobrevive a los syncs.

---

## 7. Compra, buscador y dopamina

- **Checkout por fases** (pedido → datos → entrega → pago → notas) con
  validación en vivo y consecutivo `PED-YYYYMMDD-NNN`.
- **Vuelo al carrito** (WAAPI, respeta `prefers-reduced-motion`), badge con
  rebote y vibración en celulares.
- **Pedido SIEMPRE directo por wa.me** al **+57 313 243 4760**: WhatsApp
  abre con el chat listo; la hoja PNG del pedido se **descarga** para
  adjuntarla en el mismo chat (logo JUGA, código `JUG-XXXX` por artículo,
  Nequi 313 243 4760).
- **Buscador con cobertura total**: sin tildes/ñ, palabras sueltas en
  cualquier orden, código `JUG-XXXX` y SKU de la fuente.
- Eventos para el Pixel de Meta: `PageView`, `ViewContent`, `AddToCart`,
  `Search`, `InitiateCheckout` y **`Purchase` con el valor total** en COP
  (GA4 recibe los mismos eventos).

---

## 8. Pruebas

Plan completo en `PLAN_AUDITORIA_E2E_QA.md` (niveles L0–L5, severidades S1–S4
y calendario). Suites:

- **Locales** (Playwright, ajustar rutas del checkout local antes de correr):
  `qa_admin_e2e.js` (panel) y `qa_aterrizaje_precios.js` (aterrizajes,
  precios, carrito y mensaje de WhatsApp).
- **Producción (automática)**: `qa_smoke_produccion.js` corre diario a las
  12:00 UTC vía `qa-smoke.yml`: checks de lectura (página, catálogo,
  configuración, imágenes, activos de marca, deploy de Pages). Falla →
  issue `qa-smoke` con el log; se recupera → se cierra solo.

Verificación rápida de sintaxis del index:

```
node -e "const h=require('fs').readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(h))!==null){if(m[1].trim())new Function(m[1]);}console.log('OK')"
```

---

## 9. Operación diaria

| Tarea | Cómo |
|---|---|
| Cambiar precios, héroe, favoritos, ocultar productos/categorías | Panel → "Ver cambios ahora" (previsualiza) → "Publicar para TODOS" |
| Previsualizar sin publicar | Panel → "Guardar en MI computador" (solo este navegador) |
| Configurar un navegador nuevo del panel | `python generar_enlace_config.py` → abrir el enlace una vez |
| Refrescar el catálogo ya | Pestaña Actions → "Sincronizar catalogo" → Run workflow |
| Respaldar la configuración sin GitHub | Panel → "Copiar configuración (respaldo)" |
