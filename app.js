/* Consulta urbanística · Vicuña Mackenna (adaptado del visualizador de Mercedes). Sitio estático: no necesita servidor. */
(function () {
  "use strict";
  var C = window.MCD_CONFIG, P = window.MCD.parcelas, N = window.MCD.normativa, AF = window.MCD.afectaciones;
  var col = P.col, dic = P.dic, meta = P.meta, n = col.id.length;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nf = function (v, d) { return Number(v).toLocaleString("es-AR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var dec = function (x) { return Math.round(x * 1000) % 10 ? 3 : 2; };
  var num = function (s) { return /^\d+([.,]\d+)?$/.test(String(s).trim()) ? parseFloat(String(s).replace(",", ".")) : null; };

  /* ------------------------------------------------------------ geometría */
  var geo = new Array(n), bb = new Float64Array(n * 4);
  (function () {
    var S = meta.escala, ox = meta.origen[0], oy = meta.origen[1];
    for (var i = 0; i < n; i++) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      geo[i] = P.geom[i].map(function (pol) {
        return pol.map(function (r) {
          var x = ox, y = oy, o = [];
          for (var k = 0; k < r.length; k += 2) {
            x += r[k]; y += r[k + 1];
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            o.push([x / S, y / S]);
          }
          o.push(o[0]);
          return o;
        });
      });
      bb[i * 4] = x0 / S; bb[i * 4 + 1] = y0 / S; bb[i * 4 + 2] = x1 / S; bb[i * 4 + 3] = y1 / S;
    }
    P.geom = null;
  })();

  /* ------------------------------------------------------------ acceso a datos */
  var distDe = function (i) { return dic.dist[col.dist[i]]; };
  var zonaDe = function (i) { return N.zonas[distDe(i)] || null; };
  var grupoDe = function (i) { var z = zonaDe(i); return z ? z.zona : ""; };
  var colorDe = function (g) { return C.colores[g] || C.sinZona; };
  var ROM = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
  var circNum = function (v) { v = String(v || "").trim().toUpperCase(); if (/^\d+$/.test(v)) return parseInt(v, 10); var k = ROM.indexOf(v); return k > 0 ? k : null; };
  var normC = function (v) { return String(v || "").toUpperCase().replace(/[\s.\-]/g, "").replace(/^0+(?=.)/, ""); };
  var keyPartida = function (s) {
    s = String(s || "").replace(/\D/g, "").replace(/^0+/, "");
    if (!s) return null;
    return parseInt(s, 10);
  };
  var textoPartida = function (i) { var p = col.par[i]; if (!p) return "Sin dato"; return p.length === 12 ? p.slice(0, 4) + "-" + p.slice(4, 11) + "/" + p.slice(11) : p; };
  var nomLegible = function (i) {
    var o = [];
    [["circ", "C"], ["secc", "S"], ["mza", "M"], ["pcl", "P"]].forEach(function (p) { if (col[p[0]][i]) o.push(p[1] + " " + col[p[0]][i]); });
    return o.join(" · ") || "Sin nomenclatura";
  };
  var afectDe = function (i) {
    var o = {}, orden = [];
    dic.afe[col.afe[i]].split(";").forEach(function (t) {
      t = t.trim(); if (!t) return;
      var k = t.indexOf(":"), cod = (k < 0 ? t : t.slice(0, k)).trim(), nom = k < 0 ? "" : t.slice(k + 1).trim();
      if (!o[cod]) { o[cod] = []; orden.push(cod); }
      if (nom) o[cod].push(nom);
    });
    return orden.map(function (c) { return { cod: c, nombres: o[c] }; });
  };
  var flagsDe = function (i) {
    var z = zonaDe(i), p = dic.pen[col.pen[i]].split(" ");
    return { desaf: false, zona: !!(z && z.confirmar), sinZona: p.indexOf("A8") >= 0 || !z || !z.zona };
  };
  /* Indicadores según la superficie y si la parcela está en esquina (la norma fija casos distintos). */
  var esq = false, esqAuto = false;
  var indDe = function (i, S) {
    var z = zonaDe(i);
    if (!z || !z.casos || !z.casos.length) return null;
    S = S > 0 ? S : (col.sup[i] || 0);
    for (var k = 0; k < z.casos.length; k++) {
      var c = z.casos[k];
      if (c.desde != null && S < c.desde) continue;
      if (c.hasta != null && S >= c.hasta) continue;
      if (c.esq != null && c.esq !== esq) continue;
      return { fos: c.fos, fot: c.fot, confirmar: !!c.confirmar, porSup: c.desde != null || c.hasta != null, porEsq: c.esq != null };
    }
    return null;
  };
  var hayEsquina = function (z) { return !!(z && z.casos && z.casos.some(function (c) { return c.esq != null; })); };

  /* índices de búsqueda */
  var idxPar = new Map(), idxNom = new Map(), idxId = new Map();
  for (var i = 0; i < n; i++) {
    var kp = keyPartida(col.par[i]);
    if (kp != null) { if (!idxPar.has(kp)) idxPar.set(kp, []); idxPar.get(kp).push(i); }
    if (col.nom[i]) { if (!idxNom.has(col.nom[i])) idxNom.set(col.nom[i], []); idxNom.get(col.nom[i]).push(i); }
    idxId.set(col.id[i], i);
  }

  /* ------------------------------------------------------------ usos */
  var UC = N.usos.columnas, UF = N.usos.filas;
  var estadoUso = function (v) { return v === "D" || v === "C" ? "si" : v === "-" ? "no" : /^[KVA]$/.test(v) ? "cond" : "sd"; };
  var ETQ = { si: "Se puede", cond: "Con condiciones", no: "No se puede", sd: "No lo menciona" };
  var nombreUso = function (u) { var m = /^([\d.]+)\s+(.*)$/.exec(u); return m ? m[2] : u; };
  var valorUso = function (k, g) { var ci = UC.indexOf(g); return ci < 0 ? "" : (UF[k].v[ci] || "").trim(); };

  /* ------------------------------------------------------------ partes de la ficha */
  function conf() { return '<span class="conf">a confirmar</span>'; }

  function parteCab(i) {
    var z = zonaDe(i), d = distDe(i), g = grupoDe(i), f = flagsDe(i);
    var area = dic.area[col.area[i]];
    var titulo = z && z.zona ? (z.nombre || d) : "Sin zona asignada";
    return '<div class="cab"><span class="sigla" style="background:' + colorDe(g) + '">' + esc(d || "—") + '</span><div><h2>' + esc(titulo) +
      (f.zona && !f.sinZona ? conf() : "") + '</h2><p>' + (area ? "Área " + esc(area.toLowerCase()) : "Área sin dato") + '</p></div></div>' +
      '<dl class="datos"><dt>Nomenclatura</dt><dd>' + esc(nomLegible(i)) + '</dd><dt>Cuenta</dt><dd>' + esc(textoPartida(i)) +
      '</dd>' + (col.des[i] ? '<dt>Designación oficial</dt><dd>' + esc(col.des[i]) + '</dd>' : "") +
      '<dt>Superficie</dt><dd>' + (col.sup[i] != null ? nf(col.sup[i], 1) + " m² <small>(según Catastro)</small>" : "Sin dato") + '</dd></dl>';
  }
  function parteAvisos(i) {
    var f = flagsDe(i), t = C.pendientes, o = [];
    if (f.sinZona) o.push(t.sinZona); else if (f.zona) o.push(t.zona);
    var z = zonaDe(i), ind = indDe(i, supCalc);
    if (z && z.confirmar) o.push(z.confirmar);
    if (ind && ind.confirmar && z.confirmar_caso) o.push(z.confirmar_caso);
    return o.map(function (x) { return '<p class="aviso-p">' + esc(x) + '</p>'; }).join("");
  }
  function parteInd(i, soloCuerpo) {
    var z = zonaDe(i);
    if (!z || !z.zona) return "";
    var v = function (t) { return t ? esc(t).replace(/\n+/g, "<br>") : "—"; };
    var ind = indDe(i, supCalc), filas = [];
    if (z.casos && z.casos.length) {
      var cual = [];
      if (ind && ind.porSup) cual.push("de " + nf(supCalc || col.sup[i] || 0, 0) + " m²");
      if (ind && ind.porEsq) cual.push(esq ? "en esquina" : "no en esquina");
      var pie = cual.length ? "<small>Para parcela " + cual.join(", ") + "</small>" : "";
      filas.push(["FOS <small>Qué parte del terreno se puede cubrir</small>", (ind && ind.fos != null ? nf(ind.fos, 2) : "—") + (ind && ind.confirmar ? conf() : "") + pie]);
      filas.push(["FOT <small>Cuántas veces el terreno se puede construir, sumando plantas</small>", (ind && ind.fot != null ? nf(ind.fot, dec(ind.fot)) : "—") + (ind && ind.confirmar ? conf() : "") + pie]);
    }
    if (z.altura) filas.push(["Altura máxima", esc(z.altura)]);
    var largo = function (t) { return t && num(t) == null; };
    if (soloCuerpo && (z.sup_min || z.frente_min)) {
      if (z.sup_min) filas.push(["Parcela mínima para dividir", nf(z.sup_min) + " m²" + (z.frente_min ? " y " + nf(z.frente_min, z.frente_min % 1 ? 1 : 0) + " m de frente" : "") +
        (largo(z.sup_min_txt) || largo(z.frente_min_txt) ? "<small>Hay casos especiales: ver el texto de la ordenanza</small>" : "")]);
    } else {
      if (z.sup_min_txt) filas.push(["Superficie mínima de parcela", v(z.sup_min_txt) + (num(z.sup_min_txt) != null ? " m²" : "")]);
      if (z.frente_min_txt) filas.push(["Frente mínimo de parcela", v(z.frente_min_txt) + (num(z.frente_min_txt) != null ? " m" : "")]);
    }
    if (!soloCuerpo) {
      if (z.fracc) filas.push(["Subdivisión", v(z.fracc)]);
      if (z.retiros) filas.push(["Retiros", v(z.retiros)]);
      if (z.estac) filas.push(["Estacionamiento", v(z.estac)]);
    }
    var h = "";
    if (hayEsquina(z) && soloCuerpo == null) h += '<p class="nota">Calculado para parcela ' + (esq ? "en esquina" : "no en esquina") + ".</p>";
    if (filas.length) h += '<table class="ind">' + filas.map(function (r) {
      return "<tr><th>" + r[0].replace("<small>", "<small style='display:block;color:#74808d'>") + "</th><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>";
    else h += '<p class="nota">La ordenanza no fija indicadores para esta zona.</p>';
    if (z.extra) h += '<p class="nota">' + esc(z.extra) + "</p>";
    if (!soloCuerpo && (z.fos_txt || z.fot_txt || z.altura_txt)) h += '<details class="txt"><summary>Texto de la ordenanza (FOS, FOT y alturas)</summary>' +
      (z.fos_txt ? "<h4>FOS</h4><p>" + v(z.fos_txt) + "</p>" : "") + (z.fot_txt ? "<h4>FOT</h4><p>" + v(z.fot_txt) + "</p>" : "") +
      (z.altura_txt ? "<h4>Alturas</h4><p>" + v(z.altura_txt) + "</p>" : "") + "</details>";
    if (z.art && !soloCuerpo) h += '<p class="nota">' + (/^\d+$/.test(z.art) ? "Art. " + esc(z.art) + " del " : "") + "Código de Urbanización (Ord. 1067/2015).</p>";
    return soloCuerpo ? h : '<div class="bloque"><h3>Indicadores urbanísticos</h3>' + h + "</div>";
  }
  function parteCaracter(i) {
    var z = zonaDe(i);
    return z && z.caracter ? '<div class="bloque"><h3>Carácter de la zona</h3><p class="caracter">' + esc(z.caracter).replace(/\n+/g, "<br>") + "</p></div>" : "";
  }
  function parteAfe(i) {
    var a = afectDe(i);
    if (!a.length) return "";
    return '<div class="bloque"><h3>Patrón de actividades económicas</h3>' + a.map(function (x) {
      var d = C.afectaciones[x.cod] || { nombre: x.cod, color: "#555", efecto: "" };
      return '<div class="afe"><b style="background:' + d.color + '">' + esc(x.cod) + '</b><div><strong>' + esc(d.nombre) + '</strong>' + esc(d.efecto) + '</div></div>';
    }).join("") + '</div>';
  }
  function calcFilas(i, S) {
    var z = zonaDe(i), o = [], ind = indDe(i, S);
    if (!z || !z.zona) return o;
    var m2 = function (v) { v = Math.round(v * 10) / 10; return nf(v, v % 1 ? 1 : 0) + " m²"; }, cf = ind && ind.confirmar ? conf() : "";
    var pb = ind && ind.fos != null ? S * ind.fos : null, tot = ind && ind.fot != null ? S * ind.fot : null;
    if (pb != null) o.push(["Superficie que se puede cubrir en planta baja", m2(pb) + cf,
      m2(S) + " × FOS " + nf(ind.fos, 2) + ". Es lo máximo que puede ocupar la construcción sobre el terreno; el " + nf(100 - ind.fos * 100) + " % restante queda libre."]);
    if (tot != null) {
      var ej = pb != null && tot > pb + 0.05 ? " Por ejemplo, " + m2(pb) + " en planta baja y " + m2(tot - pb) + " en plantas altas."
        : pb != null ? " Entra completa en la planta baja." : "";
      o.push(["Superficie total que se puede construir", m2(tot) + cf,
        m2(S) + " × FOT " + nf(ind.fot, dec(ind.fot)) + ". Es la suma de todas las plantas." + ej + " La altura máxima y los retiros limitan cuántas plantas entran."]);
    }
    var minimo = z.sup_min ? "al menos " + nf(z.sup_min) + " m²" + (z.frente_min ? " y " + nf(z.frente_min, z.frente_min % 1 ? 1 : 0) + " m de frente" : "") : "";
    if (/no se admite/i.test(z.fracc)) o.push(["¿Se puede dividir?", "No", "En esta zona no se admite la subdivisión de parcelas."]);
    else if (z.sup_min) {
      var k = Math.floor(S / z.sup_min + 1e-9);
      o.push(["¿Se puede dividir?", k >= 2 ? "Sí, hasta en " + k + " parcelas" : "No",
        "Para dividir, cada parcela nueva tiene que tener " + minimo + ". " +
        (k >= 2 ? "Con " + m2(S) + " salen hasta " + k + ", si el frente también alcanza." : "Con " + m2(S) + " no alcanza para dos.")]);
    }
    return o;
  }
  function calcHTML(i, S) {
    if (!(S > 0)) return '<p class="nota">Ingresá una superficie mayor que cero.</p>';
    var o = calcFilas(i, S);
    if (!o.length) return '<p class="nota">Esta parcela no tiene indicadores para calcular.</p>';
    return '<table class="ind">' + o.map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + (r[2] ? "<small>" + r[2] + "</small>" : "") + "</td></tr>"; }).join("") + "</table>";
  }
  function usosTexto(z) {
    var f = function (t, x) { return x ? "<h4>" + t + "</h4><p>" + esc(x.charAt(0).toUpperCase() + x.slice(1)).replace(/\n+/g, " ") + "</p>" : ""; };
    return f("Dominantes", z.uso_dom) + f("Complementarios", z.uso_comp) + f("Condicionados", z.uso_cond);
  }
  function urlDe(i) {
    var base = C.urlPublica || location.href.split("#")[0];
    var nm = col.nom[i];
    return base + "#" + (nm && idxNom.get(nm).length === 1 ? "parcela=" + encodeURIComponent(nm) : "id=" + col.id[i]);
  }
  function qrDe(url) {
    try { var q = window.qrcode(0, "M"); q.addData(url); q.make(); return q.createDataURL(4, 0); } catch (e) { return ""; }
  }

  /* ------------------------------------------------------------ volumen 3D orientativo */
  var ver3d = false, PISO = 3;
  var COL_3D = { env: "#1d4e6f", a: "#e39a3c", b: "#f2bd7c" };
  function alturaMax(z) { return z.altura_m != null ? z.altura_m : null; }
  function anilloMayor(i) {
    var mejor = null, ma = 0;
    geo[i].forEach(function (pol) {
      var r = pol[0], a = 0;
      for (var k = 0; k < r.length - 1; k++) a += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
      a = Math.abs(a / 2);
      if (a > ma) { ma = a; mejor = r; }
    });
    return mejor;
  }
  function escalar(r, f) {
    var A = 0, cx = 0, cy = 0;
    for (var k = 0; k < r.length - 1; k++) {
      var c = r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
      A += c; cx += (r[k][0] + r[k + 1][0]) * c; cy += (r[k][1] + r[k + 1][1]) * c;
    }
    cx /= 3 * A; cy /= 3 * A;
    return r.map(function (p) { return [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; });
  }
  /* ---------------- lados de la parcela y retiros ----------------
     Se trabaja en metros alrededor de la parcela. Un lado es «calle» si no lo comparte ninguna parcela vecina.
     Con dos lados sobre calle que forman ángulo, la parcela es esquina. */
  var cacheLados = {};
  function marcoLocal(i) {
    var cy = (bb[i * 4 + 1] + bb[i * 4 + 3]) / 2, cx = (bb[i * 4] + bb[i * 4 + 2]) / 2;
    var kx = 111320 * Math.cos(cy * Math.PI / 180), ky = 110540;
    return {
      a: function (p) { return [(p[0] - cx) * kx, (p[1] - cy) * ky]; },
      ll: function (p) { return [cx + p[0] / kx, cy + p[1] / ky]; }
    };
  }
  function areaM(r) { var a = 0; for (var k = 0; k < r.length; k++) { var p = r[k], q = r[(k + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function distSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }
  function ladosDe(i) {
    if (cacheLados[i]) return cacheLados[i];
    var M = marcoLocal(i), r = anilloMayor(i);
    if (!r) return null;
    var P = r.slice(0, -1).map(M.a);
    if (areaM(P) < 0) P.reverse();                       /* sentido antihorario: el interior queda a la izquierda */
    var n0 = P.length, dir = function (k) { var a = P[k], b = P[(k + 1) % n0]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    var giro = function (a, b) { var d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
    /* agrupar segmentos casi alineados en lados */
    var ini = 0, mx = -1;
    for (var k = 0; k < n0; k++) { var g = giro(dir((k + n0 - 1) % n0), dir(k)); if (g > mx) { mx = g; ini = k; } }
    var lados = [], act = null;
    for (var j = 0; j < n0; j++) {
      var k2 = (ini + j) % n0, a = P[k2], b = P[(k2 + 1) % n0];
      if (act && giro(act.ang, dir(k2)) < 20 * Math.PI / 180) { act.b = b; act.pts.push(b); }
      else { act = { a: a, b: b, ang: dir(k2), pts: [a, b] }; lados.push(act); }
    }
    /* vecinas: parcelas cuyo rectángulo toca el de esta */
    var m = 0.00003, vec = [];
    for (var q = 0; q < n; q++) {
      if (q === i || bb[q * 4] > bb[i * 4 + 2] + m || bb[q * 4 + 2] < bb[i * 4] - m || bb[q * 4 + 1] > bb[i * 4 + 3] + m || bb[q * 4 + 3] < bb[i * 4 + 1] - m) continue;
      geo[q].forEach(function (pol) { pol.forEach(function (rr) { vec.push(rr.map(M.a)); }); });
    }
    var cerca = function (p) {
      for (var v = 0; v < vec.length; v++) { var R = vec[v]; for (var k = 0; k < R.length - 1; k++) if (distSeg(p, R[k], R[k + 1]) < 1.2) return true; }
      return false;
    };
    /* Un lado libre da a la calle si, mirando hacia afuera, la primera parcela que aparece es de otra manzana
       (o no aparece ninguna en 45 m). Si es de la misma manzana, el hueco es una parcela que falta en el parcelario. */
    var dentro = function (pt, j) {
      var x = pt[0], y = pt[1], ins = false;
      geo[j].forEach(function (pol) { pol.forEach(function (R) {
        for (var k = 0, l = R.length - 1; k < R.length; l = k++) {
          if ((R[k][1] > y) !== (R[l][1] > y) && x < (R[l][0] - R[k][0]) * (y - R[k][1]) / (R[l][1] - R[k][1]) + R[k][0]) ins = !ins;
        }
      }); });
      return ins;
    };
    var mz = col.secc[i] + "-" + col.mza[i], lejos = 0.0005, cand = [];
    for (var q2 = 0; q2 < n; q2++) {
      if (q2 === i || bb[q2 * 4] > bb[i * 4 + 2] + lejos || bb[q2 * 4 + 2] < bb[i * 4] - lejos || bb[q2 * 4 + 1] > bb[i * 4 + 3] + lejos || bb[q2 * 4 + 3] < bb[i * 4 + 1] - lejos) continue;
      cand.push(q2);
    }
    var daACalle = function (L) {
      var dx = (L.b[0] - L.a[0]) / L.len, dy = (L.b[1] - L.a[1]) / L.len, ox = dy, oy = -dx;   /* normal hacia afuera */
      var m0 = [(L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2];
      for (var t = 1.5; t <= 45; t += 1.5) {
        var pt = M.ll([m0[0] + ox * t, m0[1] + oy * t]);
        for (var c = 0; c < cand.length; c++) {
          var j = cand[c];
          if (pt[0] < bb[j * 4] || pt[0] > bb[j * 4 + 2] || pt[1] < bb[j * 4 + 1] || pt[1] > bb[j * 4 + 3]) continue;
          if (dentro(pt, j)) return (col.secc[j] + "-" + col.mza[j]) !== mz || !col.mza[j];
        }
      }
      return true;
    };
    lados.forEach(function (L) {
      var dx = L.b[0] - L.a[0], dy = L.b[1] - L.a[1];
      L.len = Math.sqrt(dx * dx + dy * dy); L.ang = Math.atan2(dy, dx);
      var c = 0; [0.2, 0.5, 0.8].forEach(function (t) { if (cerca([L.a[0] + dx * t, L.a[1] + dy * t])) c++; });
      L.calle = c < 2 && L.len >= 3 && daACalle(L);
    });
    var calles = lados.filter(function (L) { return L.calle; }).sort(function (x, y) { return y.len - x.len; });
    var paral = function (x, y) { var g = giro(x.ang, y.ang); return g < 0.5 || g > Math.PI - 0.5; };
    var res = { P: P, M: M, lados: lados, esquina: false, ok: calles.length > 0 };
    if (!res.ok) return (cacheLados[i] = res);
    /* frente principal: el lado sobre calle más corto entre los que forman esquina; si no hay esquina, el más largo */
    var otros = calles.filter(function (L) { return !paral(L, calles[0]); });
    res.esquina = otros.length > 0;
    var princ = res.esquina ? [calles[0], otros[0]].sort(function (x, y) { return x.len - y.len; })[0] : calles[0];
    var u = [Math.cos(princ.ang), Math.sin(princ.ang)], nrm = [-u[1], u[0]];
    var dist = function (p) { return (p[0] - princ.a[0]) * nrm[0] + (p[1] - princ.a[1]) * nrm[1]; };
    res.prof = Math.max.apply(null, P.map(dist));
    lados.forEach(function (L) {
      if (L === princ) L.tipo = "frente";
      else if (L.calle) L.tipo = paral(L, princ) ? "frente" : "frente2";
      else if (L.len < 1.5) L.tipo = "otro";
      else if (paral(L, princ) && dist([(L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2]) > res.prof / 2) L.tipo = "fondo";
      else L.tipo = "lateral";
    });
    return (cacheLados[i] = res);
  }
  function retDe(z, S, esquina, prof) {
    var R = z.ret || [];
    for (var k = 0; k < R.length; k++) {
      var c = R[k];
      if (c.desde != null && S < c.desde) continue;
      if (c.hasta != null && S >= c.hasta) continue;
      if (c.esq != null && c.esq !== esquina) continue;
      var o = { frente: c.frente || 0, frente2: c.frente2 != null ? c.frente2 : (c.frente || 0), lateral: c.lateral || 0, lateral_uno: !!c.lateral_uno, fondo: c.fondo || 0, opt: c.opt || "" };
      if (c.frente_prof) o.frente = prof != null && prof > c.frente_prof[0] ? c.frente_prof[2] : c.frente_prof[1];
      return o;
    }
    return null;
  }
  /* Recorta un polígono con el semiplano que queda a distancia >= d hacia el interior del lado a→b (Sutherland-Hodgman). */
  function recortar(P, a, b, d) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy), nx = -dy / L, ny = dx / L;
    var f = function (p) { return (p[0] - a[0]) * nx + (p[1] - a[1]) * ny - d; }, o = [];
    for (var k = 0; k < P.length; k++) {
      var p = P[k], q = P[(k + 1) % P.length], fp = f(p), fq = f(q);
      if (fp >= 0) o.push(p);
      if ((fp >= 0) !== (fq >= 0)) { var t = fp / (fp - fq); o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return o;
  }
  /* Área edificable después de retiros, en metros y en lon/lat. */
  function edificable(i, z, S) {
    var LD = ladosDe(i);
    if (!LD) return null;
    var A = Math.abs(areaM(LD.P)), ret = retDe(z, S || A, LD.esquina, LD.prof), Q = LD.P.slice(), apl = [];
    if (LD.ok && ret) {
      var lat1 = false;
      LD.lados.slice().sort(function (x, y) { return y.len - x.len; }).forEach(function (L) {
        var d = L.tipo === "frente" ? ret.frente : L.tipo === "frente2" ? ret.frente2 : L.tipo === "fondo" ? ret.fondo : L.tipo === "lateral" ? ret.lateral : 0;
        if (L.tipo === "lateral" && ret.lateral_uno) { if (lat1) d = 0; else if (d) lat1 = true; }
        if (d > 0 && Q.length >= 3) { Q = recortar(Q, L.a, L.b, d); apl.push({ tipo: L.tipo, d: d }); }
      });
    }
    var Ab = Q.length >= 3 ? Math.abs(areaM(Q)) : 0;
    return { Q: Q, A: A, Ab: Ab, frac: A ? Ab / A : 0, esquina: LD.esquina, ok: LD.ok, ret: ret, apl: apl, prof: LD.prof,
      ll: function (R) { var o = R.map(LD.M.ll); o.push(o[0]); return o; }, M: LD.M };
  }
  function escalarM(R, f) {
    var A = 0, cx = 0, cy = 0;
    for (var k = 0; k < R.length; k++) { var p = R[k], q = R[(k + 1) % R.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
    cx /= 3 * A; cy /= 3 * A;
    return R.map(function (p) { return [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; });
  }

  /* Envolvente: el área edificable (parcela menos retiros) hasta la altura máxima.
     Ejemplo: planta igual al FOS (o al área edificable si es menor), en niveles de 3 m, hasta agotar el FOT o la altura. */
  function volumen(i) {
    var z0 = zonaDe(i), ind = indDe(i, supCalc);
    if (!z0 || !ind || ind.fos == null || ind.fot == null || !(ind.fos > 0) || !geo[i].length) return null;
    var E = edificable(i, z0, supCalc);
    if (!E || E.Ab <= 0) return null;
    var H = alturaMax(z0), planta = Math.min(ind.fos, E.frac), nec = ind.fot / planta;
    var maxP = H != null ? Math.max(1, Math.floor(H / PISO + 1e-9)) : Infinity;
    var pisos = Math.min(nec, maxP), ent = Math.floor(pisos + 1e-9), resto = pisos - ent;
    if (resto < 0.02) resto = 0;
    var base = escalarM(E.Q, Math.sqrt(planta / E.frac)), fs = [];
    var piso = function (k, R) { return { type: "Feature", properties: { t: "ej", c: k % 2 ? COL_3D.b : COL_3D.a, b: k * PISO, h: (k + 1) * PISO - 0.2 }, geometry: { type: "Polygon", coordinates: [E.ll(R)] } }; };
    for (var k = 0; k < ent; k++) fs.push(piso(k, base));
    if (resto) fs.push(piso(ent, escalarM(E.Q, Math.sqrt(planta * resto / E.frac))));
    if (H != null) fs.push({ type: "Feature", properties: { t: "env", c: COL_3D.env, b: 0, h: H }, geometry: { type: "Polygon", coordinates: [E.ll(E.Q)] } });
    if (E.apl.length) fs.push({ type: "Feature", properties: { t: "base" }, geometry: { type: "LineString", coordinates: E.ll(E.Q) } });
    return { fs: fs, H: H, pisos: pisos, planta: planta, niveles: ent + (resto ? 1 : 0), limitado: nec > maxP + 1e-9, E: E, fot: ind.fot, fos: ind.fos, confirmar: ind.confirmar };
  }
  var NOM_RET = { frente: "frente", frente2: "segundo frente", lateral: "lateral", fondo: "fondo" };
  function volTexto(i) {
    var v = volumen(i), S = supCalc;
    if (!v) return "";
    var E = v.E, o = [];
    var ORD = { frente: 0, frente2: 1, lateral: 2, fondo: 3 }, DIC = { frente: "al frente", frente2: "sobre la otra calle", lateral: "al costado", fondo: "al fondo" };
    if (!E.ok) o.push('<li><i style="border:2px dashed #111;background:transparent"></i>No pudimos identificar el frente del terreno con el plano catastral, así que el dibujo no descuenta retiros.</li>');
    else {
      var vistos = {}, partes = [];
      E.apl.slice().sort(function (x, y) { return ORD[x.tipo] - ORD[y.tipo]; }).forEach(function (a) { var k = a.tipo + a.d; if (!vistos[k]) { vistos[k] = 1; partes.push(mt(a.d) + " " + DIC[a.tipo]); } });
      o.push('<li><i style="border:2px dashed #111;background:transparent"></i>' + (partes.length ? "<b>Línea punteada:</b> hasta dónde se puede construir, dejando " + lista(partes) + "."
        : "<b>Sin retiros:</b> en esta zona se puede construir hasta el borde del terreno.") + (E.esquina ? " Es un terreno en esquina." : "") + "</li>");
    }
    if (v.H != null) o.push('<li><i style="background:' + COL_3D.env + ';opacity:.35"></i><b>Caja celeste:</b> el espacio máximo que se puede ocupar, hasta ' + mt(v.H) + " de altura.</li>");
    else o.push("<li>La zona no fija una altura máxima en metros, por eso no hay caja celeste.</li>");
    var txt = "<b>Volumen naranja:</b> un ejemplo de edificio que cumple las reglas: " + v.niveles + (v.niveles === 1 ? " planta" : " plantas") +
      (S > 0 ? ", " + m2(S * v.planta) + " por planta y " + m2(S * v.planta * v.pisos) + " en total" : "") + ".";
    if (v.planta < v.fos - 1e-6) txt += " Los retiros dejan menos lugar que el que permite el FOS.";
    if (v.limitado) txt += " Con la altura máxima no se llega a usar todo lo que permite el FOT" + (S > 0 ? " (" + m2(S * v.fot) + ")" : "") + ".";
    o.push('<li><i style="background:' + COL_3D.a + '"></i>' + txt + (v.confirmar ? conf() : "") + "</li>");
    return '<ul class="vol">' + o.join("") + '</ul><p class="nota">Es una forma posible entre muchas, para dar una idea. No incluye planos límite y supone plantas de ' + PISO + " m. Podés girar el mapa con clic derecho o con dos dedos.</p>";
  }
  function aplicar3d(camara) {
    var src = map.getSource("vol"); if (!src) return;
    var v = ver3d && sel >= 0 ? volumen(sel) : null;
    src.setData({ type: "FeatureCollection", features: v ? v.fs : [] });
    if (ver3d) map.dragRotate.enable(); else map.dragRotate.disable();
    if (!camara) return;
    if (ver3d && v) map.fitBounds([[bb[sel * 4], bb[sel * 4 + 1]], [bb[sel * 4 + 2], bb[sel * 4 + 3]]], { padding: 150, maxZoom: 19.5, pitch: 58, bearing: -25, duration: 900 });
    else map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  }

  /* ------------------------------------------------------------ ficha en pantalla
     Arriba, un resumen en lenguaje simple para cualquier vecino. Abajo, el detalle técnico en desplegables. */
  var sel = -1, supCalc = 0, colUso = "";
  var abiertos = {};                                     /* desplegables abiertos: se conservan al redibujar */
  var m2 = function (v) { v = Math.round(v * 10) / 10; return nf(v, v % 1 ? 1 : 0) + " m²"; };
  var mt = function (v) { return nf(v, v % 1 ? 1 : 0) + " m"; };
  var minus = function (t) { return t.charAt(0).toLowerCase() + t.slice(1); };
  var lista = function (a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]; };
  function desp(id, titulo, cuerpo, bajada) {
    if (!cuerpo) return "";
    return '<details class="desp" data-d="' + id + '"' + (abiertos[id] ? " open" : "") + '><summary><span>' + titulo + "</span>" +
      (bajada ? "<small>" + bajada + "</small>" : "") + '</summary><div class="desp-c">' + cuerpo + "</div></details>";
  }
  /* Glosario: términos que aparecen en la ficha, explicados para quien no es del oficio. */
  var GLOSARIO = [
    ["Zona", "Cada sector de la ciudad tiene reglas propias sobre qué se puede construir y para qué se puede usar. La zona de tu terreno define esas reglas."],
    ["FOS (factor de ocupación del suelo)", "Qué parte del terreno se puede cubrir con construcción, vista desde arriba. Un FOS de 0,70 en un terreno de 300 m² permite cubrir hasta 210 m²; el resto queda libre (patio, jardín, entrada)."],
    ["FOT (factor de ocupación total)", "Cuántos metros cuadrados se pueden construir en total, sumando todas las plantas. Un FOT de 1,00 en 300 m² permite 300 m² en total: por ejemplo, 200 m² abajo y 100 m² arriba."],
    ["Altura máxima", "Hasta dónde puede subir la construcción, medida desde la vereda. Como referencia, cada planta mide unos 3 m."],
    ["Retiro", "Franja del terreno donde no se puede construir: al frente (contra la vereda), a los costados o al fondo."],
    ["Línea municipal (L.M.)", "El límite entre el terreno y la vereda."],
    ["Planos límite", "Planos inclinados imaginarios que la construcción no puede atravesar por encima de cierta altura. Sirven para que lo más alto quede retirado de la calle."],
    ["Parcela mínima", "La superficie y el frente más chicos que puede tener un terreno nuevo si se divide uno existente."],
    ["Uso dominante, complementario y condicionado", "Dominante: la actividad principal de la zona. Complementario: se admite junto con la principal. Condicionado: se admite solo si se cumplen ciertas condiciones que evalúa el municipio."],
    ["Patrón de actividades económicas", "Clasificación de comercios, talleres e industrias según cuánto molestan (ruido, tránsito, olores). Cada zona admite ciertos patrones."],
    ["Nomenclatura catastral", "El código que identifica cada terreno en Catastro: circunscripción (C), sección (S), manzana (M) y parcela (P)."],
    ["Número de cuenta", "El número con el que Rentas identifica el inmueble. Figura en la boleta del impuesto inmobiliario."]
  ];
  function glosarioHTML() {
    return '<dl class="glosario">' + GLOSARIO.map(function (g) { return "<dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd>"; }).join("") + "</dl>";
  }
  /* Retiros en palabras, a partir de la misma regla que usa el volumen 3D. */
  function retirosEnPalabras(i, z) {
    var E = edificable(i, z, col.sup[i] || 0), r = E && E.ret;
    if (!r) return null;
    var p = [];
    if (r.frente > 0) p.push(mt(r.frente) + " al frente");
    if (E.esquina && r.frente2 > 0) p.push(mt(r.frente2) + " sobre la otra calle");
    if (r.lateral > 0) p.push(r.lateral_uno ? mt(r.lateral) + " sobre uno de los costados" : mt(r.lateral) + " a cada costado");
    if (r.fondo > 0) p.push(mt(r.fondo) + " al fondo");
    return { txt: p.length ? "Hay que dejar " + lista(p) + " sin construir." : "No hace falta dejar retiros: se puede construir sobre la línea de la vereda.", opt: r.opt };
  }
  function usosEnPalabras(z) {
    var si = [], cond = [];
    UF.forEach(function (u, k) {
      var v = valorUso(k, z.zona), e = estadoUso(v), nm = minus(nombreUso(u.uso));
      if (e === "si") si.push(nm);
      else if (e === "cond") cond.push(nm + (v === "V" ? " (solo vivienda que acompañe a la actividad principal)" : v === "A" ? " (solo como complemento de la actividad principal)" : ""));
    });
    return { si: si, cond: cond };
  }
  function resumenHTML(i, enPantalla) {
    var z = zonaDe(i);
    if (!z || !z.zona) return "";
    var S = col.sup[i] || 0, ind = indDe(i, S), H = alturaMax(z), it = [];
    /* 1. cuánto se puede construir */
    if (ind && ind.fos != null && ind.fot != null && S > 0) {
      var plantas = H != null ? Math.max(1, Math.floor(H / PISO + 1e-9)) : null;
      it.push(["¿Cuánto puedo construir?",
        "Hasta <b>" + m2(S * ind.fot) + "</b> en total, sumando plantas, y cubriendo como máximo <b>" + m2(S * ind.fos) + "</b> del terreno." +
        (H != null ? " Altura máxima: <b>" + mt(H) + "</b>, unas " + plantas + (plantas === 1 ? " planta" : " plantas") + "." : z.altura ? " Altura: " + esc(minus(z.altura)) + "." : "") +
        (ind.confirmar ? conf() : "")]);
    } else if (!z.casos || !z.casos.length) it.push(["¿Cuánto puedo construir?", "La ordenanza no fija indicadores para esta zona: hay que consultar en el municipio."]);
    /* 2. qué dejar libre */
    var rp = retirosEnPalabras(i, z);
    if (rp) it.push(["¿Qué tengo que dejar libre?", esc(rp.txt) + (ind && ind.fos != null ? " Además, el " + nf(100 - ind.fos * 100) + " % del terreno queda sin cubrir." : "") +
      (rp.opt ? ' <span class="suave">' + esc(rp.opt) + ".</span>" : "")]);
    /* 3. usos */
    var u = usosEnPalabras(z);
    if (u.si.length || u.cond.length) it.push(["¿Para qué lo puedo usar?",
      (u.si.length ? '<span class="usos-l">' + u.si.map(function (x) { return "<span>" + esc(x.charAt(0).toUpperCase() + x.slice(1)) + "</span>"; }).join("") + "</span>" : "") +
      (u.cond.length ? '<span class="suave">Con condiciones: ' + esc(lista(u.cond)) + ".</span>" : "")]);
    /* 4. dividir */
    if (/no se admite/i.test(z.fracc)) it.push(["¿Puedo dividir el terreno?", "No. En esta zona no se admite la subdivisión."]);
    else if (z.sup_min && S > 0) {
      var k = Math.floor(S / z.sup_min + 1e-9);
      it.push(["¿Puedo dividir el terreno?", (k >= 2 ? "Por superficie, sí: en hasta <b>" + k + "</b> terrenos" : "No: cada terreno nuevo") +
        " " + (k >= 2 ? "de" : "tiene que tener") + " al menos " + m2(z.sup_min) + (z.frente_min ? " y " + mt(z.frente_min) + " de frente" : "") + "."]);
    }
    var h = '<div class="resumen"><p class="res-cab">En pocas palabras' + (S > 0 ? ", para este terreno de " + m2(S) : "") + "</p>";
    if (enPantalla && hayEsquina(z)) h += '<label class="sw"><input type="checkbox" id="esq"' + (esq ? " checked" : "") + '><span></span>Terreno en esquina' +
      (esqAuto ? "<small>Lo detectamos con el plano catastral. Si no es así, cambialo.</small>" : "") + "</label>";
    h += it.map(function (x) { return '<div class="res-it"><h4>' + x[0] + "</h4><p>" + x[1] + "</p></div>"; }).join("");
    return h + "</div>";
  }
  function cabHTML(i) {
    var z = zonaDe(i), d = distDe(i), f = flagsDe(i);
    var titulo = z && z.zona ? (z.nombre || d) : "Fuera de la zonificación urbana";
    var datos = [nomLegible(i)]; if (col.sup[i] != null) datos.push(m2(col.sup[i]));
    return '<div class="cab"><span class="sigla" style="background:' + colorDe(grupoDe(i)) + '">' + esc(d || "—") + "</span><div><p class=\"cab-z\">Zona</p><h2>" + esc(titulo) +
      (f.zona && !f.sinZona ? conf() : "") + '</h2><p class="cab-d">' + esc(datos.join(" · ")) + "</p></div></div>";
  }
  function renderFicha() {
    var F = $("#ficha");
    if (sel < 0) return;
    var i = sel, z = zonaDe(i), url = urlDe(i), v = z && z.zona ? volumen(i) : null;
    var h = cabHTML(i) + parteAvisos(i) + resumenHTML(i, true);
    /* acciones */
    h += '<div class="acciones">' + (v ? '<button class="btn' + (ver3d ? " on" : "") + '" data-acc="3d">' + (ver3d ? "Salir de 3D" : "Ver en 3D") + "</button>" : "") +
      '<button class="btn" data-acc="copiar">Copiar enlace</button><span class="nota" id="msg-copia"></span></div>';
    if (ver3d && v) h += '<div class="vol-caja"><p class="res-cab">Qué estás viendo en 3D</p><div id="vol-txt">' + volTexto(i) + "</div></div>";
    /* desplegables */
    var d = "";
    if (z && z.zona) {
      var ind = indDe(i, supCalc);
      d += desp("ind", "Indicadores urbanísticos", parteInd(i, true), "FOS, FOT, altura y parcela mínima");
      if (ind && (ind.fos != null || ind.fot != null)) d += desp("calc", "Calcular con otra superficie",
        '<p class="nota">Sirve para simular, por ejemplo, la medida de una mensura o la de dos terrenos unidos. El cálculo no descuenta retiros.</p>' +
        '<div class="calc-in"><label for="calc-sup">Superficie del terreno</label><span class="unid"><input type="number" id="calc-sup" min="0" step="0.1" value="' + (supCalc || "") + '"><i>m²</i></span>' +
        '<button class="btn chico" data-acc="sup">Volver a la de Catastro</button></div><div id="calc-out">' + calcHTML(i, supCalc) + "</div>", "Cuánto se podría construir con otra medida");
      if (z.uso_dom || z.uso_comp || z.uso_cond) d += desp("usos", "Usos según la ordenanza", '<div class="usos-txt">' + usosTexto(z) + "</div>" +
        (z.patron ? '<p class="nota">Los comercios, talleres e industrias se regulan por el patrón ' + esc(z.patron) + " de la tabla de patrones del Código.</p>" : "") +
        (afectDe(i).length ? parteAfe(i).replace('<div class="bloque"><h3>Patrón de actividades económicas</h3>', '<div class="afes">') : ""), "Dominantes, complementarios y condicionados");
      if (z.caracter) d += desp("car", "Carácter de la zona", '<p class="caracter">' + esc(z.caracter).replace(/\n+/g, "<br>") + "</p>", "Qué busca la ordenanza para este sector");
      var largo2 = function (t) { return t && num(t) == null; };
      var tx = function (t, x) { return x ? "<h4>" + t + "</h4><p>" + esc(x).replace(/\n+/g, "<br>") + "</p>" : ""; };
      var ord = tx("Retiros", z.retiros) + tx("Subdivisión", z.fracc) + (largo2(z.sup_min_txt) ? tx("Superficie mínima de parcela", z.sup_min_txt) : "") +
        (largo2(z.frente_min_txt) ? tx("Frente mínimo de parcela", z.frente_min_txt) : "") + tx("Estacionamiento", z.estac) + tx("FOS", z.fos_txt) + tx("FOT", z.fot_txt) + tx("Alturas", z.altura_txt) +
        (z.extra ? tx("Otros casos", z.extra) : "") +
        (z.art ? '<p class="nota">' + (/^\d+$/.test(z.art) ? "Art. " + esc(z.art) + " del " : "") + "Código de Urbanización (Ord. 1067/2015).</p>" : "");
      d += desp("ord", "Texto de la ordenanza", ord ? '<div class="txt-ord">' + ord + "</div>" : "", "Para profesionales: la redacción original");
    }
    d += desp("datos", "Datos catastrales", '<dl class="datos"><dt>Nomenclatura</dt><dd>' + esc(nomLegible(i)) + "</dd><dt>Cuenta</dt><dd>" + esc(textoPartida(i)) + "</dd>" +
      (col.des[i] ? "<dt>Designación oficial</dt><dd>" + esc(col.des[i]) + "</dd>" : "") +
      "<dt>Superficie</dt><dd>" + (col.sup[i] != null ? m2(col.sup[i]) + " según Catastro" : "Sin dato") + "</dd></dl>", "Nomenclatura, cuenta y designación");
    d += desp("qr", "Código QR", '<div class="qr"><img alt="Código QR de la parcela" src="' + qrDe(url) + '"><span>' + esc(url) + "</span></div>", "Para abrir esta ficha desde el celular");
    d += desp("glos", "¿Qué significa cada término?", glosarioHTML(), "FOS, FOT, retiro, planos límite y más");
    F.innerHTML = h + '<div class="desps">' + d + "</div>";
  }
  $("#ficha").addEventListener("toggle", function (e) { var t = e.target; if (t.dataset && t.dataset.d) abiertos[t.dataset.d] = t.open; }, true);
  $("#ficha").addEventListener("input", function (e) {
    if (e.target.id === "calc-sup") {
      supCalc = parseFloat(e.target.value) || 0; $("#calc-out").innerHTML = calcHTML(sel, supCalc);
      if (ver3d && $("#vol-txt")) $("#vol-txt").innerHTML = volTexto(sel);
      aplicar3d(false);
    }
  });
  $("#ficha").addEventListener("change", function (e) {
    if (e.target.id === "esq") { esq = e.target.checked; var pos = $("#panel").scrollTop; renderFicha(); $("#panel").scrollTop = pos; aplicar3d(false); }
  });
  $("#ficha").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-acc]") : e.target, a = b && b.dataset && b.dataset.acc;
    if (a === "sup") {
      supCalc = col.sup[sel]; $("#calc-sup").value = supCalc; $("#calc-out").innerHTML = calcHTML(sel, supCalc);
      if (ver3d && $("#vol-txt")) $("#vol-txt").innerHTML = volTexto(sel);
    }
    if (a === "3d") { ver3d = !ver3d; var pos = $("#panel").scrollTop; renderFicha(); $("#panel").scrollTop = pos; aplicar3d(true); }
    if (a === "copiar") copiar(urlDe(sel));
    if (a === "ejemplo") { var r = idxNom.get(C.ejemplo); if (r && r.length) seleccionar(r[0]); }
    if (a === "imprimir") imprimir(sel);
  });
  $("#btn-imp").addEventListener("click", function () { if (sel >= 0) imprimir(sel); });
  function copiar(t) {
    var ok = function () { $("#msg-copia").textContent = "Enlace copiado"; setTimeout(function () { var m = $("#msg-copia"); if (m) m.textContent = ""; }, 2500); };
    var viejo = function () {
      var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { $("#msg-copia").textContent = "No se pudo copiar"; }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, viejo); else viejo();
  }

  /* ------------------------------------------------------------ ficha impresa */
  function croquis(i) {
    var x0 = bb[i * 4], y0 = bb[i * 4 + 1], x1 = bb[i * 4 + 2], y1 = bb[i * 4 + 3];
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.cos(cy * Math.PI / 180);
    var half = Math.max(Math.max((x1 - x0) * k, y1 - y0) * 1.1, 0.0007), T = 300;
    var X0 = cx - half / k, X1 = cx + half / k, Y0 = cy - half, Y1 = cy + half;
    var px = function (p) { return ((p[0] - X0) / (X1 - X0) * T).toFixed(1) + " " + ((Y1 - p[1]) / (Y1 - Y0) * T).toFixed(1); };
    var path = function (j) { return geo[j].map(function (pol) { return pol.map(function (r) { return "M" + r.map(px).join("L") + "Z"; }).join(""); }).join(""); };
    var vec = "", c = 0;
    for (var j = 0; j < n && c < 3000; j++) {
      if (j === i || bb[j * 4] > X1 || bb[j * 4 + 2] < X0 || bb[j * 4 + 1] > Y1 || bb[j * 4 + 3] < Y0) continue;
      vec += path(j); c++;
    }
    return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#fff"/>' +
      '<path d="' + vec + '" fill="#f1f3f5" stroke="#8d97a1" stroke-width=".6" fill-rule="evenodd"/>' +
      '<path d="' + path(i) + '" fill="' + colorDe(grupoDe(i)) + '" stroke="#000" stroke-width="2" fill-rule="evenodd"/>' +
      '<path d="M278 34L284 16L290 34L284 30Z" fill="#000"/><text x="284" y="12" font-size="10" text-anchor="middle" font-family="sans-serif">N</text></svg>';
  }
  function imprimir(i) {
    var url = urlDe(i), z = zonaDe(i), hoy = new Date().toLocaleDateString("es-AR");
    var h = '<div class="imp-cab"><div><h1>' + esc(C.titulo) + " · Ficha de parcela</h1><p>" + esc(C.subtitulo) + '</p></div><span class="imp-estado">' + esc(C.estado) + "</span></div>" +
      '<div class="imp-dos"><div>' + parteCab(i) + parteAvisos(i) + "</div><div>" + croquis(i) +
      '<div class="imp-qr"><img alt="" src="' + qrDe(url) + '"><span>' + esc(url) + "</span></div></div></div>" + resumenHTML(i, false) + parteInd(i);
    if (z && z.zona) {
      var o = calcFilas(i, supCalc);
      if (o.length && supCalc > 0) h += '<div class="bloque"><h3>Edificabilidad orientativa para ' + nf(supCalc, 1) + ' m²</h3><table class="ind">' +
        o.map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + (r[2] ? "<small>" + r[2] + "</small>" : "") + "</td></tr>"; }).join("") + "</table></div>";
      if (z.uso_dom || z.uso_comp || z.uso_cond) h += '<div class="bloque"><h3>Usos del suelo</h3><div class="usos-txt">' + usosTexto(z) + "</div></div>";
      h += parteAfe(i);
    }
    h += '<div class="imp-pie"><p>' + esc(C.aviso) + "</p><p>Emitida el " + hoy + " · Capa " + esc(meta.version) + "</p></div>";
    $("#impresion").innerHTML = h;
    window.print();
  }

  /* ------------------------------------------------------------ mapa */
  var features = [];
  for (i = 0; i < n; i++) if (geo[i].length) features.push({ type: "Feature", id: i, properties: { i: i, g: grupoDe(i) }, geometry: { type: "MultiPolygon", coordinates: geo[i] } });
  var presentes = {}; features.forEach(function (f) { presentes[f.properties.g] = 1; });

  function exprZona() {
    var e = ["match", ["get", "g"]];
    Object.keys(C.colores).forEach(function (z) { e.push(z, C.colores[z]); });
    e.push(C.sinZona);
    return e;
  }
  var COL_USO = { si: "#2e9d5b", cond: "#e3a820", no: "#e9ecef", sd: "#c4b5d6" };
  var b = meta.bbox;
  var map = new maplibregl.Map({
    container: "mapa",
    style: {
      version: 8,
      sources: {
        /* Argenmap (IGN). Es un servicio TMS: el eje y va invertido, por eso scheme "tms". */
        osm: { type: "raster", scheme: "tms", tiles: ["https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19,
          attribution: '<a href="https://www.ign.gob.ar/AreaServicios/Argenmap/Introduccion" target="_blank">Argenmap · IGN</a>' },
        sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Imágenes: Esri y proveedores" }
      },
      layers: [
        { id: "fondo", type: "background", paint: { "background-color": "#e9edf0" } },
        { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6, "raster-opacity": 0.95 } },
        { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } }
      ]
    },
    center: meta.centro, zoom: 13, minZoom: 9, maxZoom: 19.5,
    maxBounds: [[b[0] - 0.4, b[1] - 0.3], [b[2] + 0.4, b[3] + 0.3]],
    dragRotate: false, attributionControl: { compact: true }
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  var afActivas = [];  /* los patrones cubren toda la planta urbana: se prenden desde Capas */
  var filtroAf = function () { return ["in", ["get", "t"], ["literal", afActivas]]; };
  var exprAf = function () { var e = ["match", ["get", "t"]]; Object.keys(C.afectaciones).forEach(function (k) { e.push(k, C.afectaciones[k].color); }); e.push("#555"); return e; };

  map.on("load", function () {
    map.addSource("parcelas", { type: "geojson", data: { type: "FeatureCollection", features: features }, maxzoom: 17, tolerance: 0.25 });
    map.addSource("afect", { type: "geojson", data: AF });
    map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "pz", type: "fill", source: "parcelas", paint: { "fill-color": exprZona(), "fill-opacity": 0.6 } });
    map.addLayer({ id: "pl", type: "line", source: "parcelas", minzoom: 13.5, paint: { "line-color": "#4d5660", "line-opacity": 0.6, "line-width": ["interpolate", ["linear"], ["zoom"], 13.5, 0.2, 18, 1.1] } });
    map.addLayer({ id: "af", type: "fill", source: "afect", filter: filtroAf(), paint: { "fill-color": exprAf(), "fill-opacity": 0.14 } });
    map.addLayer({ id: "afl", type: "line", source: "afect", filter: filtroAf(), paint: { "line-color": exprAf(), "line-width": 1.8, "line-dasharray": [2.5, 1.5] } });
    map.addSource("vol", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "sel-b", type: "line", source: "sel", paint: { "line-color": "#fff", "line-width": 6 } });
    map.addLayer({ id: "sel-l", type: "line", source: "sel", paint: { "line-color": "#111", "line-width": 3 } });
    var ext = { "fill-extrusion-color": ["get", "c"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "h"] };
    map.addLayer({ id: "vol-ej", type: "fill-extrusion", source: "vol", filter: ["==", ["get", "t"], "ej"], paint: Object.assign({ "fill-extrusion-opacity": 0.95 }, ext) });
    map.addLayer({ id: "vol-base", type: "line", source: "vol", filter: ["==", ["get", "t"], "base"], paint: { "line-color": "#111", "line-width": 2, "line-dasharray": [2, 1.5] } });
    map.addLayer({ id: "vol-env", type: "fill-extrusion", source: "vol", filter: ["==", ["get", "t"], "env"], paint: Object.assign({ "fill-extrusion-opacity": 0.22 }, ext) });
    map.on("click", "pz", function (e) { if (e.features.length) seleccionar(e.features[0].properties.i, { volar: false }); });
    map.on("mouseenter", "pz", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "pz", function () { map.getCanvas().style.cursor = ""; });
    $("#cargando").hidden = true; $("#cargando").style.display = "none";
    leerHash();
  });
  window.addEventListener("hashchange", leerHash);

  function seleccionar(i, o) {
    o = o || {};
    sel = i; supCalc = col.sup[i] || 0;
    var LD = ladosDe(i); esqAuto = !!(LD && LD.ok); esq = !!(LD && LD.esquina);
    renderFicha();
    $("#btn-imp").hidden = false;
    $("#resultados").innerHTML = o.mantenerLista ? $("#resultados").innerHTML : "";
    activarTab("parcela");
    if (map.getSource("sel")) map.getSource("sel").setData({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: geo[i] } });
    var en3d = ver3d && !!volumen(i);
    aplicar3d(false);
    if (o.volar !== false && geo[i].length) map.fitBounds([[bb[i * 4], bb[i * 4 + 1]], [bb[i * 4 + 2], bb[i * 4 + 3]]],
      en3d ? { padding: 150, maxZoom: 19.5, pitch: 58, bearing: -25, duration: 900 } : { padding: 70, maxZoom: 18, duration: 700 });
    var h = "#" + urlDe(i).split("#")[1];
    if (location.hash !== h) history.replaceState(null, "", h);
    if (o.volar !== false) $("#panel").scrollTop = 0;
  }
  function leerHash() {
    var m = /^#(parcela|id|partida)=(.+)$/.exec(location.hash);
    if (!m) return;
    var v = decodeURIComponent(m[2]), r = null;
    if (m[1] === "parcela") r = idxNom.get(v);
    else if (m[1] === "id") { var k = idxId.get(parseInt(v, 10)); r = k == null ? null : [k]; }
    else r = idxPar.get(keyPartida(v));
    if (r && r.length && r[0] !== sel) seleccionar(r[0]);
  }

  /* ------------------------------------------------------------ búsqueda */
  function mostrarResultados(r, vacio) {
    var R = $("#resultados");
    if (!r.length) { R.innerHTML = "<p>" + esc(vacio) + "</p>"; return; }
    if (r.length === 1) { seleccionar(r[0]); return; }
    var tope = 100;
    R.innerHTML = "<p>" + nf(r.length) + " parcelas coinciden" + (r.length > tope ? " (se muestran las primeras " + tope + ")" : "") + '. Elegí una:</p><ul class="lista">' +
      r.slice(0, tope).map(function (i) {
        return '<li><button data-i="' + i + '"><span>' + esc(nomLegible(i)) + "</span><small>" + (col.des[i] ? esc(col.des[i]) : col.par[i] ? "Cuenta " + esc(textoPartida(i)) : "Sin cuenta") + " · " + esc(distDe(i) || "s/z") + "</small></button></li>";
      }).join("") + "</ul>";
  }
  $("#resultados").addEventListener("click", function (e) {
    var bt = e.target.closest("button[data-i]");
    if (bt) seleccionar(parseInt(bt.dataset.i, 10), { mantenerLista: true });
  });
  $("#f-partida").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("#q").value.trim();
    if (!q) return;
    var limpio = q.toUpperCase().replace(/[\s.\-]/g, "");
    if (idxNom.has(limpio)) return mostrarResultados(idxNom.get(limpio), "");
    if (/^\d+$/.test(limpio)) return mostrarResultados(idxPar.get(keyPartida(limpio)) || [], "No hay parcelas con la cuenta " + q + ". Probá con la nomenclatura catastral.");
    mostrarResultados([], "Ingresá el número de cuenta o la nomenclatura de 16 dígitos (solo números), o usá la búsqueda por nomenclatura.");
  });
  (function () {
    var cs = {}, ss = {};
    for (var i = 0; i < n; i++) { if (col.circ[i]) cs[col.circ[i]] = 1; if (col.secc[i]) ss[col.secc[i]] = 1; }
    $("#n-circ").innerHTML += Object.keys(cs).sort().map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
    $("#n-secc").innerHTML += Object.keys(ss).sort().map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
  })();
  var normN = function (v) { v = String(v || "").replace(/\D/g, ""); return v ? parseInt(v, 10) : null; };
  $("#f-nom").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = $("#n-circ").value, s = $("#n-secc").value, m = normN($("#n-mza").value), p = normN($("#n-pcl").value);
    var d = $("#n-des").value.trim().toUpperCase().replace(/[\s.]/g, "");
    if (!c && !s && m == null && p == null && !d) return mostrarResultados([], "Completá al menos un dato de la nomenclatura.");
    var r = [];
    for (var i = 0; i < n; i++) {
      if (c && col.circ[i] !== c) continue;
      if (s && col.secc[i] !== s) continue;
      if (m != null && normN(col.mza[i]) !== m) continue;
      if (p != null && normN(col.pcl[i]) !== p) continue;
      if (d && col.des[i].toUpperCase().replace(/[\s.]/g, "").indexOf(d) < 0) continue;
      r.push(i);
    }
    mostrarResultados(r, "No hay parcelas con esa nomenclatura.");
  });

  /* ------------------------------------------------------------ pestañas */
  function activarTab(t) {
    document.querySelectorAll(".tabs button").forEach(function (bt) { bt.setAttribute("aria-selected", bt.dataset.tab === t ? "true" : "false"); });
    ["parcela", "usos", "capas"].forEach(function (k) { $("#t-" + k).hidden = k !== t; });
  }
  $(".tabs").addEventListener("click", function (e) { if (e.target.dataset.tab) activarTab(e.target.dataset.tab); });

  /* ------------------------------------------------------------ pestaña Usos */
  var usoActivo = null;
  $("#u-lista").innerHTML = UF.map(function (u, k) { var nm = nombreUso(u.uso); return '<li><button data-k="' + k + '" aria-pressed="false"><span>' + esc(nm) + "</span></button></li>"; }).join("");
  $("#u-fuente").textContent = C.usosFuente;
  $("#u-lista").addEventListener("click", function (e) {
    var bt = e.target.closest("button[data-k]"); if (!bt) return;
    var k = parseInt(bt.dataset.k, 10);
    ponerUso(usoActivo === k ? null : k);
  });
  function ponerUso(k) {
    usoActivo = k;
    document.querySelectorAll("#u-lista button").forEach(function (bt) { bt.setAttribute("aria-pressed", String(parseInt(bt.dataset.k, 10) === k)); });
    var M = $("#modo-uso"), A = $("#u-activo");
    if (k == null) { map.setPaintProperty("pz", "fill-color", exprZona()); M.hidden = true; A.innerHTML = ""; return; }
    var gr = { si: [], cond: [], no: [], sd: [] }, cond = {};
    var orden = []; C.leyenda.forEach(function (gp) { orden = orden.concat(gp.zonas); });
    Object.keys(presentes).sort(function (a, b) { return orden.indexOf(a) - orden.indexOf(b); }).forEach(function (g) {
      if (!g) return;
      var v = valorUso(k, g), e = estadoUso(v); gr[e].push(g);
      if (e === "cond" || e === "si") cond[g] = C.usosRef[v] || v;
    });
    var ex = ["match", ["get", "g"]];
    ["si", "cond", "no"].forEach(function (e) { if (gr[e].length) ex.push(gr[e], COL_USO[e]); });
    ex.push(COL_USO.sd);
    map.setPaintProperty("pz", "fill-color", ex.length > 3 ? ex : COL_USO.sd);
    var nm = nombreUso(UF[k].uso);
    var ref = '<div class="ref">' + ["si", "cond", "no", "sd"].map(function (e) { return '<span><i style="background:' + COL_USO[e] + '"></i>' + ETQ[e] + "</span>"; }).join("") + "</div>";
    M.innerHTML = "<strong>" + esc(nm) + "</strong>" + ref + '<button class="btn chico" data-acc="quitar">Volver a las zonas</button>';
    M.hidden = false;
    var zn = function (g) { return "<li><i style=\"background:" + colorDe(g) + "\"></i><b>" + esc(g) + "</b> " + esc((N.zonas[g] && N.zonas[g].nombre) || "") +
      (cond[g] ? ' <small>' + esc(minus(cond[g])) + "</small>" : "") + "</li>"; };
    var grupo = function (t, e, a) { return a.length ? '<div class="u-g"><p><span class="eu ' + e + '">' + t + "</span></p><ul>" + a.map(zn).join("") + "</ul></div>" : ""; };
    A.innerHTML = grupo("Se puede", "si", gr.si) + grupo("Con condiciones", "cond", gr.cond) + grupo("No se puede", "no", gr.no) +
      (gr.sd.length ? '<details class="desp"><summary><span>Zonas donde el Código no lo menciona</span><small>' + gr.sd.length + ' zonas: conviene consultar en el municipio</small></summary><div class="desp-c"><ul class="u-sd">' + gr.sd.map(zn).join("") + "</ul></div></details>" : "");
  }
  $("#modo-uso").addEventListener("click", function (e) { if (e.target.dataset.acc === "quitar") ponerUso(null); });

  /* ------------------------------------------------------------ pestaña Capas */
  $("#c-fondo").addEventListener("change", function (e) {
    ["osm", "sat"].forEach(function (k) { map.setLayoutProperty(k, "visibility", k === e.target.value ? "visible" : "none"); });
  });
  $("#c-opac").addEventListener("input", function (e) { map.setPaintProperty("pz", "fill-opacity", e.target.value / 100); });
  $("#c-afect").innerHTML = Object.keys(C.afectaciones).map(function (k) {
    return '<label><input type="checkbox" value="' + k + '"><i style="background:' + C.afectaciones[k].color + '"></i>' + k + " · " + esc(C.afectaciones[k].nombre) + "</label>";
  }).join("");
  $("#c-afect").addEventListener("change", function () {
    afActivas = Array.prototype.map.call(document.querySelectorAll("#c-afect input:checked"), function (x) { return x.value; });
    map.setFilter("af", filtroAf()); map.setFilter("afl", filtroAf());
  });
  $("#c-leyenda").innerHTML = C.leyenda.map(function (gp) {
    var zs = gp.zonas.filter(function (z) { return presentes[z]; });
    return zs.length ? "<h4>" + esc(gp.grupo) + "</h4><ul>" + zs.map(function (z) {
      var nm = C.nombresGrupo[z] || (N.zonas[z] && N.zonas[z].nombre) || "";
      return '<li><i style="background:' + colorDe(z) + '"></i><b>' + z + "</b>" + esc(nm) + "</li>";
    }).join("") + "</ul>" : "";
  }).join("");

  /* ------------------------------------------------------------ pantalla inicial */
  function inicioHTML() {
    return '<div class="inicio"><h2>¿Qué se puede construir en un terreno?</h2>' +
      '<p>Esta consulta muestra, para cada terreno de ' + esc(C.localidad || "la localidad") + ', qué permite el Código de Urbanización: cuánto se puede construir, qué hay que dejar libre y para qué actividades se puede usar.</p>' +
      '<ol class="pasos"><li><span><b>Buscá el terreno</b> con el número de cuenta de la boleta del inmobiliario, o tocalo en el mapa.</span></li>' +
      '<li><span><b>Leé el resumen</b>: está escrito para que lo entienda cualquier vecino.</span></li>' +
      '<li><span><b>Abrí los desplegables</b> si necesitás el detalle técnico o el texto de la ordenanza.</span></li></ol>' +
      (C.ejemplo ? '<button class="btn" data-acc="ejemplo">Ver un terreno de ejemplo</button>' : "") +
      desp("glos0", "¿Qué significa cada término?", glosarioHTML(), "FOS, FOT, retiro, planos límite y más") + "</div>";
  }
  $("#ficha").innerHTML = inicioHTML();

  /* ------------------------------------------------------------ textos fijos */
  $("#titulo").textContent = C.titulo; $("#subtitulo").textContent = C.subtitulo; $("#estado").textContent = C.estado;
  $("#aviso").textContent = C.aviso;
  $("#version").textContent = "Capa " + meta.version + " · Datos exportados el " + meta.exportado.split("-").reverse().join("/") + " · " + nf(meta.parcelas) + " parcelas";
  document.title = C.titulo + " · Vicuña Mackenna";
})();
