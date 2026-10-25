# -*- coding: utf-8 -*-
"""Sincroniza el catalogo de JUGA (jugueteria) desde la fuente de inventario
publicada y actualiza catalogo.js.

Fuente:
  - El inventario real de la jugueteria (repo publico
    github.com/jugueteriataiwanoficial/jugueteriataiwan): su catalogo.js
    publicado (generado 4 veces al dia desde el POS de la tienda, con
    productos activos, existencias y foto) es el MAESTRO de juguetes.

Que hace:
  - Lee el catalogo publicado de la fuente (clon local via JUGA_FUENTE_LOCAL,
    o descarga directa del URL crudo de GitHub si no hay clon).
  - Convierte cada producto al formato de la tienda JUGA: nombre en Titulo,
    precio final tal cual (el precio de vitrina ya es el precio de venta),
    categoria, SKU y fotos rehospedadas en img/p/ (webp, hash del path:
    incremental).
  - Asigna codigos permanentes JUG-XXXX por slug: se reutilizan los del
    catalogo.js anterior (los enlaces ?art=JUG-XXXX nunca se rompen) y los
    productos nuevos reciben numeros frescos, jamas reutilizados.
  - Guarda-red: si la fuente cae y el catalogo nuevo queda con menos de la
    mitad de los productos previos, ABORTA sin tocar el catalogo vigente.

Ejecutar:  python scripts/sync_catalogos.py
Cron:      .github/workflows/sync-catalogos.yml (cada 6 horas + manual)
"""
import hashlib
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
PEQ = {"de", "del", "la", "el", "los", "las", "y", "con", "para", "en", "x", "por", "al", "un", "una",
       "sin", "con"}

FUENTE_REPO = "jugueteriataiwanoficial/jugueteriataiwan"
FUENTE_RAW = "https://raw.githubusercontent.com/%s/main/" % FUENTE_REPO
FUENTE_LOCAL = os.environ.get("JUGA_FUENTE_LOCAL", "")

# ============================================================================
# Utilidades
# ============================================================================

def get(url, intentos=3):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=dict(UA))
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == intentos - 1:
                print("  ! fallo", url[:90], str(e)[:90])
                return None
            time.sleep(1.5)

def titulo(s):
    """'MESA FUTBOL DE MADERA' -> 'Mesa Futbol de Madera' (conectores en minuscula)."""
    s = re.sub(r"\s+", " ", (s or "")).strip()
    out = []
    for w in s.split(" "):
        if not w:
            continue
        if any(c.islower() for c in w):
            out.append(w)
        elif w.lower() in PEQ:
            out.append(w.lower())
        else:
            out.append(w[0].upper() + w[1:].lower())
    return " ".join(out)

def js_str(s):
    return json.dumps(s, ensure_ascii=False)

def lista_js(texto):
    """'["a","b"]' -> ['a','b']"""
    if not texto:
        return []
    return re.findall(r'"([^"]*)"', texto)

# ============================================================================
# 1. DESCARGA DEL CATALOGO FUENTE
# ============================================================================

def leer_catalogo_fuente():
    """Devuelve (texto_catalogo, raiz_local). Lee del clon local si existe."""
    if FUENTE_LOCAL and os.path.isdir(FUENTE_LOCAL):
        p = os.path.join(FUENTE_LOCAL, "catalogo.js")
        if os.path.isfile(p):
            print("  fuente local:", FUENTE_LOCAL)
            return open(p, encoding="utf-8").read(), FUENTE_LOCAL
    print("  fuente remota:", FUENTE_RAW + "catalogo.js")
    data = get(FUENTE_RAW + "catalogo.js")
    if not data:
        return None, None
    return data.decode("utf-8", errors="replace"), None

def parsear_productos(texto):
    """Parsea el catalogo fuente (JS, una entrada por linea) a diccionarios."""
    productos = []
    for bloque in texto.split('{id:"')[1:]:
        try:
            m = lambda pat: re.search(pat, '{id:"' + bloque)
            pid = m(r'^\{id:"([^"]+)"').group(1)
            nombre = m(r'name:"([^"]*)"').group(1)
            imagen = m(r'image:"([^"]*)"').group(1)
            cat = m(r'category:"([^"]*)"').group(1)
            precio = int(m(r'price:(\d+)').group(1))
            cmpre = m(r'comparePrice:(\d+)')
            sku = m(r'sku:"([^"]*)"')
            imgs = m(r'images:\[(.*?)\]')
            productos.append({
                "id": pid,
                "n": titulo(nombre),
                "img": imagen,
                "imgs": [x for x in lista_js(imgs.group(1)) if x != imagen][:3],
                "cat": cat,
                "p": precio,
                "antes": int(cmpre.group(1)) if cmpre else 0,
                "sku": sku.group(1) if sku else "",
            })
        except Exception:
            continue
    return productos

# ============================================================================
# 2. REHOST DE IMAGENES (incremental por hash del path de la fuente)
# ============================================================================

def rehost(ruta_local, rutas):
    """Copia las miniaturas webp de la fuente a img/p/<hash>.webp.
    Incremental: solo baja/copi­a las que falten. Si una imagen no se
    consigue localmente, queda apuntando al URL crudo publico (el navegador
    la sirve directo). Devuelve (ruta_nueva_o_remota, n_descargadas)."""
    carpeta = os.path.join(RAIZ, "img", "p")
    os.makedirs(carpeta, exist_ok=True)

    def destino(u):
        h = hashlib.md5(u.encode()).hexdigest()[:16]
        return "img/p/" + h + ".webp", os.path.join(carpeta, h + ".webp")

    faltan = []
    mapa = {}
    for u in rutas:
        if not u:
            continue
        nueva, arch = destino(u)
        mapa[u] = nueva
        if not os.path.exists(arch):
            faltan.append((u, arch))

    def copiar(ua):
        u, arch = ua
        # primero del clon local (rapido); si no esta, del URL crudo
        if ruta_local:
            p = os.path.join(ruta_local, u.replace("/", os.sep))
            if os.path.isfile(p):
                shutil.copyfile(p, arch)
                return 1
        data = get(FUENTE_RAW + u)
        if data:
            with open(arch, "wb") as f:
                f.write(data)
            return 1
        return 0

    n = 0
    if faltan:
        print("  rehost: %d imagenes nuevas" % len(faltan))
        if len(faltan) > 16:
            with ThreadPoolExecutor(max_workers=12) as ex:
                for ok in ex.map(copiar, faltan):
                    n += ok
        else:
            for ua in faltan:
                n += copiar(ua)
    # las que no se pudieron bajar quedan como URL crudo publico
    def resolver(u):
        nueva, arch = destino(u)
        if os.path.exists(arch):
            return nueva
        return FUENTE_RAW + u
    return mapa, resolver, n

# ============================================================================
# 3. ESCRITURA: catalogo.js con codigos JUG-XXXX permanentes
# ============================================================================

def escribir_catalogo_js(items):
    """items: [dict con id/n/p/antes/cat/prov/img/imgs/sku] -> catalogo.js.
    Codigo permanente JUG-XXXX: se reutiliza el del producto con el mismo
    slug del catalogo anterior; los nuevos reciben numeros frescos y los
    numeros usados jamas se reemiten (enlaces de pedidos viejos vivos)."""
    previos = {}
    usados_cid = set()
    previos_n = 0
    try:
        with open(os.path.join(RAIZ, "catalogo.js"), encoding="utf-8") as f:
            texto_previo = f.read()
        for mm in re.finditer(r'\{id:"([^"]+)",n:"(?:[^"\\]|\\.)*"[^}]*?cid:"JUG-(\d+)"', texto_previo):
            previos[mm.group(1)] = int(mm.group(2))
            usados_cid.add(int(mm.group(2)))
        previos_n = len(previos)
    except Exception:
        pass

    def cid_libre():
        n = 1
        while n in usados_cid:
            n += 1
        usados_cid.add(n)
        return n

    vistos = set()
    lineas = []
    lineas.append("// ======================================================================")
    lineas.append("// catalogo.js de JUGA - generado automaticamente por scripts/sync_catalogos.py")
    lineas.append("// (%s). NO editar a mano: el cron de GitHub Actions lo regenera." % time.strftime("%Y-%m-%d %H:%M"))
    lineas.append("// Fuente: inventario de juguetes publicado por la jugueteria")
    lineas.append("// (github.com/%s). Precio final de vitrina tal cual." % FUENTE_REPO)
    lineas.append("// ======================================================================")
    lineas.append("const CATALOGO_JUGA=[")
    total = 0
    for p in items:
        if p["id"] in vistos:
            continue
        vistos.add(p["id"])
        cid_num = previos.get(p["id"]) or cid_libre()
        partes = ['{id:%s' % js_str(p["id"]), "n:%s" % js_str(p["n"]), "p:%d" % p["p"],
                  'cat:%s' % js_str(p["cat"]), 'prov:"tw"', 'cid:"JUG-%04d"' % cid_num]
        if p["img"]:
            partes.append("img:%s" % js_str(p["img"]))
            if p["imgs"]:
                partes.append("imgs:[%s]" % ",".join(js_str(x) for x in p["imgs"]))
        if p["sku"]:
            partes.append("sku:%s" % js_str(p["sku"]))
        if p["antes"] and p["antes"] > p["p"]:
            partes.append("antes:%d" % p["antes"])
        lineas.append(",".join(partes) + "},")
        total += 1
    lineas.append("];")

    # Guarda-red: fuente caida o descarga parcial NO destruye el catalogo vigente
    if previos_n and total < previos_n * 0.5:
        print("  ! ABORTADO: %d productos vs %d previos (descarga parcial): se conserva el catalogo vigente." % (total, previos_n))
        return 0
    with open(os.path.join(RAIZ, "catalogo.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lineas) + "\n")
    print("catalogo.js: %d productos (%d códigos JUG-XXXX reutilizados)" % (total, min(len(previos), total)))
    return total

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("== Leyendo catalogo fuente (jugueteria) ==")
    texto, raiz_local = leer_catalogo_fuente()
    if not texto:
        print("  ! Sin catalogo fuente: no se toca el vigente.")
        sys.exit(1)
    productos = parsear_productos(texto)
    print("  productos fuente:", len(productos))

    # validacion basica: precio real y foto
    productos = [p for p in productos if p["p"] > 0 and p["img"] and p["n"]]
    print("  validos (precio+foto+nombre):", len(productos))

    print("== Rehost de imagenes ==")
    rutas = []
    for p in productos:
        rutas.append(p["img"])
        rutas.extend(p["imgs"])
    _, resolver, n_ok = rehost(raiz_local, [u for u in rutas if u])
    for p in productos:
        p["img"] = resolver(p["img"])
        p["imgs"] = [resolver(u) for u in p["imgs"]]
    print("  descargadas/copiadas:", n_ok)

    print("== catalogo.js ==")
    total = escribir_catalogo_js(productos)
    print("== Sincronizacion completa ==" if total else "== Abortada (se conserva el vigente) ==")
