/* Configuración del visualizador. Este archivo se edita a mano; no lo pisa el script de exportación. */
window.MCD_CONFIG = {
  titulo: "Consulta urbanística",
  subtitulo: "Vicuña Mackenna · Córdoba",
  localidad: "Vicuña Mackenna",
  /* Nomenclatura del terreno que abre el botón «Ver un terreno de ejemplo» de la pantalla inicial. */
  ejemplo: "2406640101100009",
  estado: "Demo · Ord. 1067/2015",
  aviso: "Demostración elaborada con la zonificación publicada por el municipio en Mapas Córdoba (IDECOR) y el parcelario de Catastro de 2019. Información orientativa: no reemplaza al certificado de uso del suelo ni a la consulta en la oficina municipal.",

  /* Dirección pública del sitio. Si queda vacía, los enlaces y el QR usan la dirección desde la que se abre la página. */
  urlPublica: "https://echeco86.github.io/visor-vicuna-mackenna/",

  colores: {
    IA: "#54278f", C1: "#b2182b", C2: "#de77ae", CR: "#f46d43",
    R1: "#fdae61", R2: "#fee090", R3: "#f6e8c3", RE: "#d9f0a3",
    I1: "#bcbddc", I2: "#9e9ac8", I3: "#807dba",
    EV: "#5aae61", EVP: "#a6dba0", EQ: "#4393c3", EQP: "#92c5de", PR: "#969696", ZE: "#bdbdbd"
  },
  sinZona: "#c9ced3",

  leyenda: [
    { grupo: "Centro, comercio y servicios", zonas: ["IA", "C1", "C2", "CR"] },
    { grupo: "Residencial", zonas: ["R1", "R2", "R3", "RE"] },
    { grupo: "Industrial", zonas: ["I1", "I2", "I3"] },
    { grupo: "Espacios verdes y equipamiento", zonas: ["EV", "EVP", "EQ", "EQP", "PR", "ZE"] }
  ],
  nombresGrupo: {},

  /* Patrones de actividades económicas (capa superpuesta). Los números romanos crecen con el grado de molestia admitido. */
  afectaciones: {
    Ia:  { nombre: "Patrón I.a", color: "#1b9e77", efecto: "Actividades económicas de menor impacto, compatibles con el área institucional central." },
    Ib:  { nombre: "Patrón I.b", color: "#66a61e", efecto: "Comercio, servicios y actividades de bajo impacto, compatibles con la vivienda." },
    IIa: { nombre: "Patrón II.a", color: "#e6ab02", efecto: "Admite además industrias y actividades asimilables de impacto moderado." },
    IIb: { nombre: "Patrón II.b", color: "#d95f02", efecto: "Mixto residencial e industrial, con media restricción a las actividades industriales." },
    III: { nombre: "Patrón III", color: "#e7298a", efecto: "Actividades industriales y asimilables que requieren cierto aislamiento." },
    IVa: { nombre: "Patrón IV.a", color: "#7570b3", efecto: "Actividades industriales de mayor impacto, alejadas de la planta urbana." },
    IVb: { nombre: "Patrón IV.b", color: "#3f007d", efecto: "Actividades industriales de mayor conflictividad; algunas requieren normas especiales." },
    PR:  { nombre: "Polígono ruta", color: "#666666", efecto: "Franja sobre la ruta con su propio patrón de actividades." }
  },

  pendientes: {
    zona: "La zona asignada a esta parcela está a confirmar por el municipio.",
    sinZona: "La parcela está fuera de la zonificación urbana del Código."
  },

  usosFuente: "Cuadro orientativo armado a partir de los usos dominantes, complementarios y condicionados de cada zona (Ord. 1067/2015). Las actividades económicas en detalle se rigen por la tabla de patrones.",
  usosRef: {
    D: "Es el uso principal de la zona",
    C: "Se admite junto al uso principal",
    K: "El municipio evalúa cada caso",
    V: "Solo vivienda accesoria al uso principal",
    A: "Solo como actividad auxiliar de la principal"
  }
};
