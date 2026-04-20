// ================================================================
//  EstudioPsi — Google Apps Script
//  Pegá este código en 2 proyectos distintos de Apps Script:
//  uno para la hoja "Bibliografia" y otro para "Clases"
//  (o podés usar el mismo archivo con las 2 hojas)
// ================================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
var SHEET_ID = 'TU_SHEET_ID_AQUI'; // ID de tu Google Sheets

// ================================================================
//  doGET — Lee todos los datos de la hoja y los devuelve en JSON
// ================================================================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var nombreHoja = params.hoja || 'Bibliografia'; // ?hoja=Clases para la otra

  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(nombreHoja);

    if (!sheet) {
      return jsonResponse({ error: 'Hoja no encontrada: ' + nombreHoja });
    }

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);

    var result = rows
      .filter(function(row) { return row[0] !== ''; }) // ignorar filas vacías
      .map(function(row) {
        var obj = {};
        headers.forEach(function(h, i) { obj[h] = row[i]; });
        return obj;
      });

    return jsonResponse(result);

  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ================================================================
//  doPOST — Agrega una fila o actualiza el estado de un texto
// ================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var datos      = JSON.parse(e.postData.contents);
    var ss         = SpreadsheetApp.openById(SHEET_ID);
    var nombreHoja = datos.nombreHoja || 'Bibliografia';
    var sheet      = ss.getSheetByName(nombreHoja);

    if (!sheet) throw new Error('Hoja no encontrada: ' + nombreHoja);

    // ── Acción: actualizar estado de un texto (sin agregar fila nueva)
    if (datos.accion === 'actualizar_estado' && datos.id) {
      var data    = sheet.getDataRange().getValues();
      var headers = data[0];
      var idCol   = headers.indexOf('id');
      var estCol  = headers.indexOf('estado');
      var fechaCol = headers.indexOf('fecha_actualizacion');

      if (idCol === -1 || estCol === -1) throw new Error('Columnas id/estado no encontradas');

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(datos.id)) {
          sheet.getRange(i + 1, estCol + 1).setValue(datos.estado);
          if (fechaCol !== -1) {
            sheet.getRange(i + 1, fechaCol + 1).setValue(datos.fecha || new Date().toISOString().split('T')[0]);
          }
          return textResponse('Actualizado');
        }
      }
      throw new Error('ID no encontrado: ' + datos.id);
    }

    // ── Acción: agregar fila nueva (clases u otros)
    if (Array.isArray(datos.fila)) {
      sheet.appendRow(datos.fila);
      return textResponse('Guardado');
    }

    throw new Error('Acción no reconocida o fila inválida');

  } catch(err) {
    return textResponse('Error: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// ── Helpers ──────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function textResponse(msg) {
  return ContentService
    .createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}


// ================================================================
//  INSTRUCCIONES DE USO
// ================================================================
/*
  1. Abrí tu Google Sheets
  2. Creá 2 hojas con estos nombres exactos: "Bibliografia" y "Clases"

  ── HOJA: Bibliografia ──────────────────────────────────────────
  Columnas (en este orden, fila 1):
  id | materia | unidad | nro_texto | titulo_texto | autores | estado | link_resumen | tipo_clase | notas | fecha_actualizacion

  Valores de estado válidos: Sin leer | Leído | Salteado | No va
  Valores de tipo_clase: Teórica | Práctica

  ── HOJA: Clases ────────────────────────────────────────────────
  Columnas (en este orden, fila 1):
  id | materia | tipo | nro_clase | fecha | titulo_clase | link_grabacion | link_doc_resumen | estado | transcripcion | contenido_ppt | nombre_archivo | fecha_carga

  ── EJEMPLO DE FILA en Bibliografia ────────────────────────────
  texto_001 | SEMIOSIS | Unidad 1 | 1 | Título del texto | Apellido, N. (2020) | Sin leer | https://... | Teórica | | 2026-04-14

  ── DEPLOY ──────────────────────────────────────────────────────
  - Extensiones > Apps Script
  - Pegá este código
  - Reemplazá SHEET_ID con el ID real de tu Sheets
  - Deploy > New deployment > Web App
  - Execute as: Me | Who has access: Anyone
  - Copiá la URL generada
  - En app.js, reemplazá XXXXX_BIBLIO_GET y XXXXX_CLASES_GET con esa URL + ?hoja=Bibliografia / ?hoja=Clases
  - Para el POST (GS_POST_BIBLIO y GS_POST_CLASES) usás la misma URL base del deploy
*/
