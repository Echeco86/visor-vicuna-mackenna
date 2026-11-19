#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Exporta las capas de Vicuña Mackenna a los archivos de datos del visualizador web.

Entrada (por defecto, en la carpeta VISUALIZADOR MACKENNA):
  vic_mack_zonificacion.json   zonas del Código de Urbanización (Ord. 1067/2015), EPSG:22174
  vic_mack_patron.json         patrones de actividades económicas, EPSG:22174
  Capas/parcelas_Mackenna.shp  parcelario de Catastro (POSGAR 98 faja 4)

Salida (Visualizador/datos):
  parcelas.js      geometría comprimida + atributos mínimos de cada parcela (sin titulares ni valuaciones)
  normativa.js     indicadores por zona (con casos por superficie y esquina) y cuadro de usos
  afectaciones.js  polígonos de los patrones de actividades económicas

Uso:
  python Scripts/exportar_visualizador.py [zonificacion.json] [patron.json] [parcelas.shp]

Necesita Python 3, numpy, pyshp y shapely (pip install pyshp shapely).
La normativa estructurada (casos de FOS y FOT, cuadro de usos) está escrita a mano más abajo,
a partir de los textos de la capa de zonificación. Si cambia la ordenanza, se edita acá.
"""
import sys, json, math, datetime
from pathlib import Path
from collections import Counter
import numpy as np
import shapefile                       # pyshp
from shapely.geometry import shape

BASE = Path(__file__).resolve().parent.parent
ZON = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "vic_mack_zonificacion.json"
PAT = Path(sys.argv[2]) if len(sys.argv) > 2 else BASE / "vic_mack_patron.json"
PAR = Path(sys.argv[3]) if len(sys.argv) > 3 else BASE / "Capas/parcelas_Mackenna.shp"
OUT = BASE / "Visualizador/datos"
OUT.mkdir(parents=True, exist_ok=True)
ESCALA = 1_000_000
VERSION = "Ord. 1067/2015 · capas IDECOR · parcelario Catastro 2019"

# ---------------------------------------------------------------- proyección
def tm_inversa(E, N, lon0=-63.0, k0=1.0, FE=4500000.0, FN=10001965.7293, a=6378137.0, f=1 / 298.257222101):
    """POSGAR 98/2007 faja 4 (EPSG:22184 / 22174) -> lon, lat en grados. Acepta arrays."""
    E = np.asarray(E, float); N = np.asarray(N, float)
    e2 = f * (2 - f); ep2 = e2 / (1 - e2)
    M = (N - FN) / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * np.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * np.sin(4 * mu)
          + (151 * e1 ** 3 / 96) * np.sin(6 * mu) + (1097 * e1 ** 4 / 512) * np.sin(8 * mu))
    C1 = ep2 * np.cos(p1) ** 2; T1 = np.tan(p1) ** 2
    N1 = a / np.sqrt(1 - e2 * np.sin(p1) ** 2); R1 = a * (1 - e2) / (1 - e2 * np.sin(p1) ** 2) ** 1.5
    D = (E - FE) / (N1 * k0)
    lat = p1 - (N1 * np.tan(p1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
          + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720)
    lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / np.cos(p1)
    return np.degrees(lon) + lon0, np.degrees(lat)

def anillo_entero(coords):
    r = np.asarray(coords, float)[:, :2]
    lon, lat = tm_inversa(r[:, 0], r[:, 1])
    q = np.stack([np.rint(lon * ESCALA), np.rint(lat * ESCALA)], axis=1).astype(np.int64)
    keep = np.ones(len(q), bool); keep[1:] = np.any(q[1:] != q[:-1], axis=1)
    q = q[keep]
    if len(q) > 1 and np.all(q[0] == q[-1]): q = q[:-1]
    return q if len(q) >= 3 else None

def poligonos(g):
    return [g] if g.geom_type == "Polygon" else list(g.geoms) if g.geom_type == "MultiPolygon" else []

def js(nombre, clave, obj, legible=False):
    txt = json.dumps(obj, ensure_ascii=False, indent=1 if legible else None, separators=None if legible else (',', ':'))
    p = OUT / nombre
    p.write_text(f"window.MCD=window.MCD||{{}};window.MCD.{clave}={txt};\n", encoding="utf-8")
    print(f"  {nombre}: {p.stat().st_size / 1e6:.2f} MB")

def s(v):
    return "" if v is None else str(v).strip()

# ---------------------------------------------------------------- códigos de zona
CODIGO = {"Espacios Verdes Publicos": "EV", "Espacios Verdes Publicos propuestos": "EVP", "Equipamiento Comunitario": "EQ",
          "Equipamiento proyecto": "EQP", "Poligono ruta": "PR"}
NOMBRE_ESP = {"EV": "Espacio verde público", "EVP": "Espacio verde público propuesto", "EQ": "Equipamiento comunitario",
              "EQP": "Equipamiento (proyecto)", "PR": "Polígono ruta"}
cod_zona = lambda z: CODIGO.get(s(z), s(z))
COD_PATRON = {"I a": "Ia", "I b": "Ib", "II a": "IIa", "II b": "IIb", "III": "III", "IV a": "IVa", "IV b": "IVb", "Poligono ruta": "PR"}

# ---------------------------------------------------------------- normativa estructurada
# casos: se elige el primero que cumpla superficie (desde <= S < hasta) y esquina (True / False / None = cualquiera).
# fos y fot null = la norma no fija valor para ese caso.
CASOS = {
    "IA": dict(casos=[dict(fos=0.80, fot=2.30)], altura_m=7, altura="7,00 m de fachada y total; hasta 9,00 m con retiro de frente de 3,00 m",
               confirmar="La ordenanza prevé que los índices, retiros y alturas se definan en un proyecto particular de puesta en valor de la zona."),
    "C1": dict(casos=[dict(esq=True, fos=0.80, fot=2.30), dict(esq=False, fos=0.75, fot=2.10)], altura_m=7,
               altura="7,00 m (o la del edificio patrimonial adyacente); hasta 9,00 m con retiro de frente de 3,00 m y planos límite a 30°",
               extra="Edificación de valor patrimonial: FOS 0,85 en esquina y 0,80 fuera de esquina; FOT 2,40 y 2,30."),
    "C2": dict(casos=[dict(esq=True, fos=0.80, fot=2.30), dict(esq=False, fos=0.70, fot=2.00)], altura_m=7,
               altura="7,00 m; hasta 9,00 m con retiro de frente de 3,00 m y planos límite a 45°",
               extra="En las manzanas «B» a «E»: FOS 0,80 y FOT 2,30 para toda parcela."),
    "CR": dict(casos=[dict(esq=True, fos=0.80, fot=1.40), dict(esq=False, fos=0.70, fot=1.30)], altura_m=6.5,
               altura="6,50 m de fachada; hasta 8,00 m dentro de planos límite a 45°",
               extra="Desde los 25 m de la L.M. se admiten playas de estacionamiento con FOS y FOT 0,60; parcelas solo de estacionamiento, hasta 1,00."),
    "R1": dict(casos=[dict(fos=0.70, fot=1.00)], altura_m=6, altura="Viviendas: 6,00 m. Otros usos: 6,50 m",
               extra="Conjuntos edilicios: FOS 0,70 y FOT 1,20 (parcela mínima 1.000 m², frente 20 m)."),
    "R2": dict(casos=[dict(hasta=360, fos=0.65, fot=0.90), dict(desde=360, hasta=700.01, fos=0.65, fot=0.80),
                      dict(desde=700.01, fos=0.65, fot=0.80, confirmar=True)], altura_m=6.5,
               altura="6,50 m de fachada (2 pisos), hasta 8,00 m con techo inclinado; intervenciones integrales: 9,00 m de fachada y 10,50 m total",
               extra="Conjuntos de viviendas colectivas: FOS 0,70 y FOT 1,40 (parcela mínima 2.500 m², frente 30 m).",
               confirmar_caso="La ordenanza fija indicadores hasta 700 m²; para parcelas mayores se muestran los de 360 a 700 m²."),
    "R3": dict(casos=[dict(hasta=350, fos=0.70, fot=1.00), dict(desde=350, fos=0.75, fot=1.10)], altura_m=7, altura="7,00 m"),
    "I1": dict(casos=[dict(fos=0.30, fot=0.40)], altura_m=7.5, altura="Edificación industrial: 7,50 m. No industrial: 3,50 m"),
    "I2": dict(casos=[dict(hasta=5000, fos=0.30, fot=0.39), dict(desde=5000, hasta=10000, fos=0.25, fot=0.325), dict(desde=10000, fos=0.20, fot=0.26)],
               altura_m=None, altura="Sin limitación, según actividad y escala", extra="El FOT es un 30 % mayor que el FOS."),
    "I3": dict(casos=[dict(hasta=5000, fos=0.25, fot=0.325, confirmar=True), dict(desde=5000, hasta=10000, fos=0.25, fot=0.325),
                      dict(desde=10000, fos=0.20, fot=0.26)],
               altura_m=None, altura="Sin limitación, según actividad y escala", extra="El FOT es un 30 % mayor que el FOS.",
               confirmar_caso="La ordenanza fija indicadores desde 5.000 m² (la parcela mínima); para parcelas menores se muestran los de 5.000 a 10.000 m²."),
    "RE": dict(casos=[], altura_m=None, altura="", confirmar="Zona de expansión: su habilitación y sus indicadores están condicionados a cambios en las condiciones actuales."),
    "ZE": dict(casos=[], altura_m=None, altura="", confirmar="Zona especial sin reglamentar."),
}
# Retiros para el volumen 3D (metros). Se elige el primer caso que cumpla superficie y esquina.
# frente: retiro sobre la calle principal · frente2: sobre la otra calle si es esquina · lateral: de cada divisoria lateral
# lateral_uno: el retiro lateral es de una sola divisoria · fondo: de la divisoria de fondo
# frente_prof: [profundidad límite, retiro si es menor, retiro si es mayor] · opt: texto de retiros optativos (no se dibujan)
RETIROS = {
    "IA": [dict(frente=0, opt="Retiro de frente optativo en la Mz. «a»; no se admite en las Mz. 42, 43 y «d»")],
    "C1": [dict(frente=0, opt="Fachada sobre la L.M.; por encima de la altura de fachada rigen planos límite")],
    "C2": [dict(frente=0, opt="Retiros de frente optativos")],
    "CR": [dict(frente=0, opt="Sin retiro sobre calles este-oeste; optativo sobre calles norte-sur")],
    "R1": [dict(frente=0, opt="Retiro de frente de 3 m optativo")],
    "R2": [dict(frente_prof=[30, 3, 4], frente2=0)],
    "R3": [dict(frente=3, frente2=0)],
    "I1": [dict(esq=True, frente=10, frente2=7, fondo=10), dict(esq=False, frente=10, lateral=7, lateral_uno=True, fondo=10)],
    "I2": [dict(hasta=5000, frente=15, frente2=10, lateral=10, fondo=10), dict(desde=5000, hasta=10000.01, frente=20, frente2=10, lateral=10, fondo=10),
           dict(desde=10000.01, frente=25, frente2=15, lateral=15, fondo=10)],
    "I3": [dict(hasta=10000.01, frente=20, frente2=10, lateral=10, fondo=10), dict(desde=10000.01, frente=25, frente2=15, lateral=15, fondo=10)],
}
SUP_FRENTE = {  # parcela mínima para subdividir (texto completo en la ficha)
    "IA": (None, None), "C1": (None, None), "C2": (420, 12), "CR": (375, 12.5), "R1": (375, 12.5), "R2": (360, 12),
    "R3": (250, 10), "I1": (1000, 20), "I2": (2500, 50), "I3": (5000, 50),
}
# Cuadro de usos, armado a partir de los textos de cada zona.
# D dominante · C complementario · K condicionado · V solo vivienda accesoria · A solo auxiliar de la actividad principal · "" el texto no lo menciona
COLS = ["IA", "C1", "C2", "CR", "R1", "R2", "R3", "I1", "I2", "I3"]
USOS = [
    ("Vivienda",                                         "C C C D D D D V V V"),
    ("Comercio y servicios",                             "C D D D C C C . A A"),
    ("Institucional y equipamiento comunitario",         "D D C C . C C . . ."),
    ("Industria y actividades asimilables",              ". . D . . K D D D D"),
    ("Usos singulares (societarios, culturales, recreativos)", ". K K K K . . . . ."),
    ("Estacionamiento",                                  ". K . K . . . . . ."),
    ("Entretenimiento y esparcimiento",                  ". . . . . . . C . ."),
]
PATRON_USO = {"IA": "I.a", "C1": "I.b", "C2": "II.a", "CR": "I.b", "R1": "I.b", "R2": "I.b (condicionado)", "R3": "II.b", "I1": "III", "I2": "IV", "I3": "IV.b"}

# ---------------------------------------------------------------- capas de zonas y patrones
Z = json.load(open(ZON, encoding="utf-8"))
zonas_geo = [(cod_zona(f["properties"]["zona"]), shape(f["geometry"]).buffer(0), f["properties"]) for f in Z["features"]]
P = json.load(open(PAT, encoding="utf-8"))
patr_geo = [(COD_PATRON.get(s(f["properties"]["patron"]), s(f["properties"]["patron"])), shape(f["geometry"]).buffer(0)) for f in P["features"]]
# Las zonas de uso específico (espacios verdes, equipamiento) se superponen a las residenciales: tienen prioridad.
PRIORIDAD = ["EV", "EVP", "EQ", "EQP"]
orden_z = sorted(zonas_geo, key=lambda z: (0 if z[0] in PRIORIDAD else 1))

# ---------------------------------------------------------------- parcelas
def zona_de(g, capas):
    """Zona con mayor superposición, si cubre al menos la mitad de la parcela.
    Las de uso específico (espacios verdes, equipamiento) ganan si cubren la mitad.
    Así no se asigna zona a las parcelas rurales grandes que envuelven la planta urbana."""
    if not g.is_valid: g = g.buffer(0)
    A = g.area
    if A <= 0: return ""
    mejor, ma = "", 0.0
    for z, gz in capas:
        if not gz.intersects(g): continue
        a = gz.intersection(g).area / A
        if z in PRIORIDAD and a >= 0.5: return z
        if a > ma: mejor, ma = z, a
    return mejor if ma >= 0.5 else ""

rd = shapefile.Reader(str(PAR), encoding="utf-8")
cols = {k: [] for k in ("id", "nom", "par", "circ", "secc", "cha", "qta", "fra", "mza", "pcl", "des", "sup", "area", "dist", "afe", "pen")}
dic = {k: {} for k in ("area", "dist", "afe", "pen")}
def cod(k, v):
    d = dic[k]
    if v not in d: d[v] = len(d)
    return d[v]

todos, regs = [], []
for sr in rd.iterShapeRecords():
    g = shape(sr.shape.__geo_interface__) if sr.shape.points else None
    polys = []
    if g is not None and not g.is_empty:
        for pg in poligonos(g):
            rr = [q for q in (anillo_entero(list(r.coords)) for r in [pg.exterior] + list(pg.interiors)) if q is not None]
            if rr: polys.append(rr)
    todos.append(polys); regs.append((sr.record.as_dict(), g))

xs = np.concatenate([q[:, 0] for p in todos for rr in p for q in rr]); ys = np.concatenate([q[:, 1] for p in todos for rr in p for q in rr])
ORIGEN = [int(xs.min()), int(ys.min())]
geoms, cen_urb, cuenta_z = [], [], Counter()
for k, ((rec, g), polys) in enumerate(zip(regs, todos)):
    geoms.append([[[int(q[0, 0] - ORIGEN[0]), int(q[0, 1] - ORIGEN[1])] + np.diff(q, axis=0).reshape(-1).tolist() for q in rr] for rr in polys])
    zona, pat = "", ""
    if g is not None and not g.is_empty:
        zona = zona_de(g, [(z, gz) for z, gz, _ in orden_z])
        pat = zona_de(g, patr_geo)
    nom = s(rec.get("Nomenclatu"))
    sup = rec.get("Superficie")
    if not isinstance(sup, (int, float)) or sup <= 0:
        sup = g.area if g is not None and not g.is_empty else None
    cols["id"].append(k + 1); cols["nom"].append(nom); cols["par"].append(s(rec.get("Nro_Cuenta")))
    cols["circ"].append(nom[6:8] if len(nom) == 16 else ""); cols["secc"].append(nom[8:10] if len(nom) == 16 else "")
    cols["mza"].append(nom[10:13] if len(nom) == 16 else ""); cols["pcl"].append(nom[13:16] if len(nom) == 16 else "")
    for c in ("cha", "qta", "fra"): cols[c].append("")
    cols["des"].append(s(rec.get("desig_ofic")))
    cols["sup"].append(round(float(sup), 1) if sup else None)
    area = {"URBANO": "URBANA", "RURAL": "RURAL"}.get(s(rec.get("Tipo_Parce")), "")
    cols["area"].append(cod("area", area)); cols["dist"].append(cod("dist", zona))
    cols["afe"].append(cod("afe", pat)); cols["pen"].append(cod("pen", "" if zona else "A8"))
    cuenta_z[zona] += 1
    if zona and polys:
        q = polys[0][0]; cen_urb.append((q[:, 0].mean(), q[:, 1].mean()))

cu = np.array(cen_urb)
meta = {
    "version": VERSION, "exportado": datetime.date.today().isoformat(), "parcelas": len(regs),
    "escala": ESCALA, "origen": ORIGEN,
    "bbox": [int(xs.min()) / ESCALA, int(ys.min()) / ESCALA, int(xs.max()) / ESCALA, int(ys.max()) / ESCALA],
    "centro": [float(np.median(cu[:, 0])) / ESCALA, float(np.median(cu[:, 1])) / ESCALA],
}
inv = {k: [v for v, _ in sorted(d.items(), key=lambda kv: kv[1])] for k, d in dic.items()}
js("parcelas.js", "parcelas", {"meta": meta, "dic": inv, "col": cols, "geom": geoms})
print("  parcelas por zona:", dict(cuenta_z.most_common()))

# ---------------------------------------------------------------- normativa
zonas = {}
for z, _, p in zonas_geo:
    c = CASOS.get(z, {})
    sm, fm = SUP_FRENTE.get(z, (None, None))
    zonas[z] = {
        "zona": z, "nombre": s(p.get("zona2")) or NOMBRE_ESP.get(z, z), "art": s(p.get("art")),
        "caracter": s(p.get("carac")),
        "uso_dom": s(p.get("uso_dom")), "uso_comp": s(p.get("uso_comp")), "uso_cond": s(p.get("uso_cond")),
        "fracc": s(p.get("fracc")) or s(p.get("f_pc_usoinst")),
        "sup_min_txt": s(p.get("pc_ou_supmin")), "frente_min_txt": s(p.get("pc_ou_ftemin")),
        "sup_min": sm, "frente_min": fm,
        "fos_txt": s(p.get("pr_fos_m")), "fot_txt": s(p.get("pr_fot_m")),
        "altura_txt": s(p.get("pr_hmax")), "retiros": s(p.get("pr_retiros")), "estac": s(p.get("pr_estac")),
        "casos": c.get("casos", []), "altura_m": c.get("altura_m"), "altura": c.get("altura", ""),
        "extra": c.get("extra", ""), "confirmar": c.get("confirmar", ""), "confirmar_caso": c.get("confirmar_caso", ""),
        "patron": PATRON_USO.get(z, ""), "parcelas": cuenta_z.get(z, 0), "ret": RETIROS.get(z, []),
    }
usos = {"columnas": COLS, "filas": [{"uso": u, "v": [x if x != "." else "" for x in v.split()]} for u, v in USOS]}
js("normativa.js", "normativa", {"zonas": zonas, "usos": usos}, legible=True)

# ---------------------------------------------------------------- patrones (capa superpuesta)
feats = []
for t, g in patr_geo:
    for pg in poligonos(g):
        coords = []
        for r in [pg.exterior] + list(pg.interiors):
            a = np.asarray(r.coords)
            lon, lat = tm_inversa(a[:, 0], a[:, 1])
            coords.append([[round(float(x), 6), round(float(y), 6)] for x, y in zip(lon, lat)])
        feats.append({"type": "Feature", "properties": {"t": t}, "geometry": {"type": "Polygon", "coordinates": coords}})
js("afectaciones.js", "afectaciones", {"type": "FeatureCollection", "features": feats})
print(f"  patrones: {len(feats)} polígonos")
print("Listo.")
