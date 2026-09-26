# amauriswill.github.io

Portafolio personal de **Amauris Willmore Medrano**: sitio estático de una sola
columna, tipografía nativa del sistema y modo oscuro automático por CSS.

## Mapa del repositorio

```
/                      12 páginas HTML en la raíz (contrato de publicación)
├── index.html            Portada: bio, experiencia destacada, blog y educación
├── proyectos.html        Trayectoria completa (5 proyectos)
├── blog.html             Índice del blog (6 artículos)
├── uses.html             Stack y herramientas (hardware, software y flujo)
├── photos.html           Cuadrícula de series fotográficas
├── contact.html          Canales de contacto
├── nota-cpp.html         Artículo: subprocesos y Direct2D en C++
├── nota-ia.html          Artículo: modelo Jev JSON / TypeSafe AI
├── nota-automatizacion.html
├── nota-omarchy.html
├── nota-educacion.html
├── nota-psicologia.html
├── assets/css/main.css   Capa de presentación única (tokens + componentes)
├── assets/img/           Fotografías del sitio (convención en su README)
├── tools/validate-site.mjs  Pruebas de conformidad arquitectónica
└── .nojekyll             Evita el procesado de Jekyll en GitHub Pages
```

## Arquitectura por capas

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Tokens de diseño | `main.css` §1 | Única fuente de verdad de color, tipografía, espaciado y medida de lectura |
| Reset mínimo | `main.css` §2 | Normalización local, sin frameworks ni dependencias |
| Elementos base | `main.css` §3 | Tipografía, enlaces y ritmo vertical de la prosa |
| Layout y componentes | `main.css` §4 | `.site-header`, `.page-title`, `.section-title`, `.subtitle`, `.entry`, `.project`, `.article`, `.tags` / `.tag`, `.gallery` / `.photo`, `.site-footer` |
| Responsive | `main.css` §5 | Un único breakpoint en 550px |
| Contenido | los 10 `*.html` | Markup semántico sin presentación ni comportamiento |
| Contrato verificable | `tools/validate-site.mjs` | Impide que las capas se mezclen o se degraden con el tiempo |

La regla de dependencia es de fuera hacia dentro: **el HTML depende de la hoja de
estilos, nunca al contrario**. La hoja no conoce páginas concretas, solo componentes.

## Reglas del proyecto (Clean Code)

1. Cero CSS embebido y cero atributos `style` en línea.
2. Cero JavaScript: el sitio es completamente estático.
3. Sin `!important`, sin selectores de ID, sin valores mágicos (todo valor visual es un token).
4. Convención de nombres **BEM-lite**: `.bloque`, `.bloque__elemento`, `.bloque--variante`.
5. Un componente resuelve un solo patrón visual: `.entry` cubre las filas con
   metadato, `.entry--detail` es su variante con descripción, `.entry--block` la
   entrada apilada con etiquetas y `.project` el bloque con rol y descripción.
6. El estado de la página activa se expresa con `aria-current="page"` (semántica y
   accesibilidad), no con una clase adjetiva.
7. Cabecera y pie son **contratos idénticos** en todas las páginas y están verificados por el test.
   La navegación tiene seis secciones en este orden: inicio, proyectos, blog, uses, photos, contact.
8. Enlaces externos siempre con `target="_blank"` + `rel="noopener noreferrer"`.
9. UTF-8 sin BOM en todos los archivos.

## Validación

```bash
node tools/validate-site.mjs
```

Comprueba: existencia de las 12 páginas, UTF-8 sin BOM, esqueleto del documento,
capa de estilos externa, ausencia de JavaScript, anidamiento de etiquetas, enlaces
internos resueltos, contrato de navegación, contrato de pie de página, contrato de
identidad (el nombre público del sitio, `Amauris Willmore`, debe ser idéntico en la
cabecera de todas las páginas) y los tokens de diseño.
El proceso devuelve código de salida `1` si alguna comprobación falla.

Para previsualizar en local:

```bash
python -m http.server 8000    # luego abrir http://localhost:8000
```

## Cómo añadir una nota nueva

1. Duplicar `nota-cpp.html` como `nota-<tema>.html` y reemplazar `<title>`,
   `<meta name="description">`, el `<h1 class="page-title">`, el
   `<p class="article__meta">` y el contenido de `.article__body`.
2. Añadir la entrada correspondiente en `blog.html` (un `<li class="entry entry--detail">`).
3. Enlazar la entrada desde `index.html` solo si es una nota destacada.
4. Registrar la nueva página en el mapa `PAGES` de `tools/validate-site.mjs`.
5. Ejecutar `node tools/validate-site.mjs` hasta obtener `PASS`.

## Cómo publicar fotos

La página `photos.html` usa el componente `.gallery` / `.photo`. Cada serie es una
`<figure>` con un hueco (`<div class="photo__frame">`) y su pie. Para activar una serie:

1. Copiar los archivos en `assets/img/` siguiendo la convención de nombres y tamaños
   descrita en `assets/img/README.md`.
2. Sustituir el hueco por su imagen:

   ```html
   <img class="photo__frame" src="assets/img/serie-calle-01.jpg"
        alt="Descripción de la foto" loading="lazy">
   ```

3. Actualizar el pie (`photo__meta`) con el año y el número de fotos.
4. Ejecutar `node tools/validate-site.mjs` hasta obtener `PASS`.

## Publicación

El repositorio corresponde a `https://github.com/amauriswill/amauriswill.github.io`,
por lo que GitHub Pages publica la rama `main` desde la raíz. La presencia de
`.nojekyll` hace que los archivos se sirvan tal cual, sin procesado de plantillas.
