# Consulta urbanística · Vicuña Mackenna (demo)

Visor web para consultar, terreno por terreno, qué permite el Código de Urbanización de Vicuña Mackenna (Ord. 1067/2015): cuánto se puede construir, qué hay que dejar libre, para qué actividades se puede usar y si se puede dividir. Incluye volumen 3D orientativo con retiros.

**Ver online:** https://echeco86.github.io/visor-vicuna-mackenna/

Es una demostración. Información orientativa: no reemplaza al certificado de uso del suelo ni a la consulta en la oficina municipal.

## Fuentes
- Zonificación y patrones de actividades económicas: Mapas Córdoba (IDECOR).
- Parcelario: Catastro de la Provincia de Córdoba (2019). Se publican solo nomenclatura, número de cuenta, designación oficial y superficie.
- Mapa de fondo: Argenmap (IGN).

## Archivos
| Archivo | Contenido |
|---|---|
| `index.html`, `app.js`, `estilos.css` | La aplicación (sitio estático, sin servidor) |
| `config.js` | Títulos, aviso, colores, patrones y terreno de ejemplo |
| `datos/` | Parcelas, normativa por zona y patrones, generados por el script |
| `fuentes/` | Capas de zonificación y patrones, y `exportar_visualizador.py`, que genera `datos/` |
| `vendor/` | MapLibre GL JS 4.7.1 y qrcode-generator 1.4.4 |

## Actualizar los datos
```
pip install pyshp shapely numpy
python fuentes/exportar_visualizador.py fuentes/vic_mack_zonificacion.json fuentes/vic_mack_patron.json ruta/parcelas.shp
```
El script escribe en `Visualizador/datos` relativo a la carpeta superior; si se corre desde este repositorio, copiar después la carpeta generada a `datos/`.

Hecho por Físico Político.
