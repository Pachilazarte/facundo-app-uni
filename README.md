# EstudioPsi — Instrucciones de configuración

## Archivos del proyecto
- `index.html` — App principal
- `app.js` — Lógica de la app
- `sw.js` — Service Worker (PWA / offline)
- `manifest.json` — Configuración PWA
- `script-apps.gs` — Código para Google Apps Script
- `icons/` — Carpeta para los íconos PWA

---

## Paso 1 — Google Sheets

1. Abrí tu Google Sheets
2. Creá 2 hojas con estos nombres **exactos**:

### Hoja: `Bibliografia`
| id | materia | unidad | nro_texto | titulo_texto | autores | estado | link_resumen | tipo_clase | notas | fecha_actualizacion |

### Hoja: `Clases`
| id | materia | tipo | nro_clase | fecha | titulo_clase | link_grabacion | link_doc_resumen | estado | transcripcion | contenido_ppt | nombre_archivo | fecha_carga |

---

## Paso 2 — Google Apps Script

1. En tu Sheets: **Extensiones > Apps Script**
2. Borrá el código que hay y pegá el contenido de `script-apps.gs`
3. Reemplazá `TU_SHEET_ID_AQUI` con el ID de tu Sheets (está en la URL de Sheets)
4. Hacé click en **Deploy > New deployment**
   - Type: Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copiá la URL del deploy

---

## Paso 3 — Configurar la app

Abrí `app.js` y reemplazá en el objeto CONFIG:

```js
const CONFIG = {
  GS_GET_BIBLIO:  'URL_DEL_DEPLOY?hoja=Bibliografia',
  GS_POST_BIBLIO: 'URL_DEL_DEPLOY',
  GS_GET_CLASES:  'URL_DEL_DEPLOY?hoja=Clases',
  GS_POST_CLASES: 'URL_DEL_DEPLOY',
  ...
};
```

---

## Paso 4 — Cómo cargar bibliografía en Sheets

Agregá una fila por texto en la hoja `Bibliografia`:

| Campo | Ejemplo |
|---|---|
| id | `texto_001` (único) |
| materia | `SEMIOSIS` |
| unidad | `Unidad 1` |
| nro_texto | `1` |
| titulo_texto | `Título completo del texto` |
| autores | `Apellido, N. (2020)` |
| estado | `Sin leer` |
| link_resumen | URL de tu resumen en Drive |
| tipo_clase | `Teórica` o `Práctica` |
| notas | (opcional) |
| fecha_actualizacion | `2026-04-14` |

---

## Paso 5 — Íconos PWA (para instalar en iPhone)

Necesitás 2 imágenes en la carpeta `icons/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Podés crearlas en Canva o cualquier editor con el logo que quieras.

---

## Paso 6 — Publicar la app

Podés hostear en:
- **GitHub Pages** (gratis): subí los archivos y activá Pages
- **Netlify** (gratis): arrastrá la carpeta
- **Cualquier hosting** con soporte de archivos estáticos

Para instalar en iPhone: abrí Safari > compartir > "Agregar a pantalla de inicio"

---

## Formato para pasarme las materias

Cuando me pases el contenido de cada materia, usá este formato:

```
MATERIA: SEMIOSIS
TIPO: Teórica

UNIDAD 1: Nombre de la unidad
- Apellido, N. (año). Título del texto.
- Apellido, N. (año). Otro texto.

UNIDAD 2: Nombre
- ...

---
MATERIA: SEMIOSIS
TIPO: Práctica
...
```

Yo lo convierto directamente en filas para tu Sheets.
