# amauriswill.github.io

Portafolio personal de **Amauris Willmore Medrano**: sitio estático de una sola columna,
tipografías Google Sans auto-alojadas y tema claro/oscuro con interruptor.

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
├── assets/fonts/         Google Sans Flex y Google Sans Code (woff2, subconjunto latino)
├── assets/js/theme.js    Único JavaScript: el interruptor de tema
├── assets/icons/         Icono local del interruptor (SVG)
├── assets/img/           Fotografías del sitio (convención en su README)
├── tools/validate-site.mjs  Pruebas de conformidad arquitectónica
└── .nojekyll             Evita el procesado de Jekyll en GitHub Pages
```

## Arquitectura por capas

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Tipografías | `main.css` §0 | `@font-face` de Google Sans Flex y Google Sans Code, auto-alojadas |
| Tokens de diseño | `main.css` §1 | Única fuente de verdad de color, tipografía, espaciado y medidas de lectura |
| Reset mínimo | `main.css` §2 | Normalización local, sin frameworks ni dependencias |
| Elementos base | `main.css` §3 | Tipografía, enlaces, ritmo de prosa y columnas de lectura |
| Layout y componentes | `main.css` §4 | `.site-header`, `.theme-switch`, `.page-title`, `.section-title`, `.subtitle`, `.entry`, `.project`, `.article`, `.tags` / `.tag`, `.gallery` / `.photo`, `.section-more`, `.credentials`, `.site-footer` |
| Utilidades | `main.css` §5 | `.visually-hidden` (contenido solo para lectores de pantalla y buscadores) |
| Responsive | `main.css` §6 | Un único breakpoint en 550px |
| Comportamiento | `assets/js/theme.js` | Interruptor de tema; sin él, el sitio sigue el sistema |
| Contenido | los 12 `*.html` | Markup semántico sin presentación |
| Contrato verificable | `tools/validate-site.mjs` | Impide que las capas se mezclen o se degraden con el tiempo |

La regla de dependencia es de fuera hacia dentro: **el HTML depende de la hoja de
estilos, nunca al contrario**. La hoja no conoce páginas concretas, solo componentes.

## Reglas del proyecto (Clean Code)

1. Cero CSS embebido y cero atributos `style` en línea.
2. JavaScript mínimo y externo: el único archivo es `assets/js/theme.js`, nunca
   `<script>` en línea ni manejadores `on*` en atributos.
3. Sin `!important`, sin selectores de ID, sin valores mágicos (todo valor visual es un token).
4. Convención de nombres **BEM-lite**: `.bloque`, `.bloque__elemento`, `.bloque--variante`.
5. Un componente resuelve un solo patrón visual: `.entry` cubre las filas con
   metadato, `.entry--detail` es su variante con descripción, `.entry--block` la
   entrada apilada con etiquetas y `.project` el bloque con rol y descripción.
6. El estado de la página activa se expresa con `aria-current="page"` (semántica y
   accesibilidad), no con una clase adjetiva.
7. Cabecera y pie son **contratos idénticos** en todas las páginas y están verificados por el test.
   La navegación principal tiene cuatro secciones (inicio, proyectos, blog, contact); `uses` y
   `photos` son secundarias y viven en el pie, para no dispersar a quien viene a evaluar trabajo.
8. Enlaces externos siempre con `target="_blank"` + `rel="noopener noreferrer"`.
9. UTF-8 sin BOM en todos los archivos.
10. Cada tema cumple contraste mínimo sobre el fondo: texto 7:1, texto atenuado y enlace 4.5:1,
    subrayado 3:1. El test calcula los ratios y falla si alguno baja del mínimo.
11. **Sin bordes decorativos**: el texto se separa con espacio. La única línea que se dibuja es el
    subrayado de los enlaces, con `--color-underline`, porque su color es casi igual al del texto y
    sin él no se sabría qué es un enlace.
12. Cada token de color se declara **una sola vez** con `light-dark(claro, oscuro)`; el tema
    activo lo decide `color-scheme`, que el interruptor fija con `:root[data-theme]`.
13. Las tipografías son locales: nada de peticiones a Google ni a ningún otro tercero.

## Validación

```bash
node tools/validate-site.mjs
```

Comprueba: existencia de las 12 páginas, UTF-8 sin BOM, esqueleto del documento, capa de
estilos externa, JavaScript acotado a `assets/js/theme.js`, anidamiento de etiquetas, enlaces
internos resueltos, contrato de navegación, contrato de pie de página, contrato de identidad
(el nombre público del sitio, `Amauris Willmore`, debe ser idéntico en la cabecera de todas
las páginas), tokens de diseño, tipografías locales y contraste de ambos temas.
El proceso devuelve código de salida `1` si alguna comprobación falla.

Para previsualizar en local:

```bash
python -m http.server 8000    # luego abrir http://localhost:8000
```

## Tema claro y oscuro

- Por defecto manda el sistema (`prefers-color-scheme`), sin JavaScript.
- El interruptor de la cabecera es **solo icono** (una bombilla): sin texto visible, su nombre
  accesible viene de `aria-label="Tema oscuro"` y el estado de `aria-checked`. El test exige que
  `role="switch"` y ese `aria-label` no falten. El relleno amplía el área sensible a ~28 px.
- `data-theme` solo se escribe en `<html>` cuando la elección **difiere** del sistema; si no, se
  retira y `:root` vuelve a valer `color-scheme: light dark`.
- Los colores se declaran una sola vez con `light-dark(claro, oscuro)`, así que el tema oscuro no
  duplica bloque: el valor que se usa depende del `color-scheme` resuelto.
- Con `light-dark()` no soportado, cada token tiene antes una declaración de reserva con el valor
  claro: el sitio se mantiene legible aunque el interruptor no funcione.
- El icono es un **archivo local** (`assets/icons/lightbulb.svg`, de Material Symbols, Apache-2.0)
  pintado con `mask`, no un `<img>`: dentro de un `<img>` el `fill="currentColor"` del SVG no ve los
  colores de la página y el icono se quedaría negro en el tema oscuro. Con máscara hereda el color
  del texto, y el archivo se cachea como cualquier otro recurso del sitio.

## Tipografías

`Google Sans Flex` (texto) y `Google Sans Code` (código) están **auto-alojadas** en `assets/fonts/`
con el subconjunto latino: 117 KB + 34 KB, sin peticiones a Google en cada visita. Se sirven con
`font-display: swap` y `font-optical-sizing: auto` para que el eje `opsz` afine las formas al
tamaño de lectura.

El reparto es deliberado: **títulos y subtítulos** (`h1`, `h2`, `h3` y `.subtitle`) y también los
**títulos y roles de proyecto** (`.project__title`, `.project__role`) usan Google Sans Code,
mientras que la prosa, las descripciones, las etiquetas, el contenido de las secciones, la cabecera
y el pie se quedan en Google Sans Flex. Así los títulos hacen de firma técnica y el texto corrido
se lee más abierto.

El subconjunto latino no incluye las flechas `U+2190`/`U+2192`, así que el sitio usa comillas
angulares (`»`, `«`) en los enlaces de continuar y de volver, que además encajan mejor con la
tipografía editorial.

## La experiencia de lectura

- Contenedor de 660 px (≈74 caracteres) y columna de prosa de `64ch` en los artículos: dentro del
  rango cómodo de 60-75 caracteres por línea.
- Prosa a 1,05 rem con interlineado 1,7, frente al 1,6 de la interfaz.
- `text-wrap: balance` en los títulos y `text-wrap: pretty` en los párrafos, para no dejar
  palabras huérfanas ni líneas muy cortas al final.
- Separación por espacio, nunca por líneas decorativas, y `::selection` con los tokens del tema.

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
