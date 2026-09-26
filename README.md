# amauriswill.github.io

Portafolio personal de **Amauris Willmore Medrano**: sitio estático de una sola columna,
Inter + IBM Plex Mono auto-alojadas y tema claro/oscuro con interruptor.

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
├── assets/fonts/         Inter e IBM Plex Mono (woff2, subconjunto latino)
├── assets/js/theme.js    Interruptor de tema (claro por defecto)
├── assets/js/reading-progress.js  Barra de progreso de lectura
├── assets/icons/         Icono local del interruptor (SVG)
├── assets/img/           Fotografías del sitio (convención en su README)
├── tools/validate-site.mjs  Pruebas de conformidad arquitectónica
├── tools/contrast-report.mjs  Informe de contraste, tipografía y peso del CSS
├── tools/measure-viewport.mjs  Mide en Chrome si la portada cabe en una pantalla
└── .nojekyll             Evita el procesado de Jekyll en GitHub Pages
```

## Arquitectura por capas

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Tipografías | `main.css` §0 | `@font-face` de Inter e IBM Plex Mono, auto-alojadas |
| Tokens de diseño | `main.css` §1 | Única fuente de verdad de color, tipografía, espaciado y medidas de lectura |
| Reset mínimo | `main.css` §2 | Normalización local, sin frameworks ni dependencias |
| Elementos base | `main.css` §3 | Tipografía, enlaces, ritmo de prosa y columnas de lectura |
| Layout y componentes | `main.css` §4 | `.site-header`, `.theme-switch`, `.page-title`, `.section-title`, `.subtitle`, `.entry`, `.project`, `.article`, `.tags` / `.tag`, `.gallery` / `.photo`, `.section-more`, `.credentials`, `.site-footer` |
| Utilidades | `main.css` §5 | `.visually-hidden` (contenido solo para lectores de pantalla y buscadores) |
| Responsive | `main.css` §6 | Un único breakpoint en 550px |
| Comportamiento | `assets/js/*.js` | Interruptor de tema y barra de progreso; sin ellos, el sitio se queda en claro |
| Contenido | los 12 `*.html` | Markup semántico sin presentación |
| Contrato verificable | `tools/validate-site.mjs` | Impide que las capas se mezclen o se degraden con el tiempo |

La regla de dependencia es de fuera hacia dentro: **el HTML depende de la hoja de
estilos, nunca al contrario**. La hoja no conoce páginas concretas, solo componentes.

## Reglas del proyecto (Clean Code)

1. Cero CSS embebido y cero atributos `style` en línea.
2. JavaScript mínimo y externo: solo `assets/js/theme.js` y `assets/js/reading-progress.js`, nunca
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
10. Cada tema cumple contraste mínimo sobre el fondo: texto 7:1; texto atenuado y acento 4.5:1.
    El test calcula los ratios y falla si alguno baja del mínimo.
11. **Sin bordes decorativos**: el texto se separa con espacio. Los enlaces no llevan línea en
    reposo; la que aparece al pasar el ratón entra de derecha a izquierda en 150 ms, y el test lo
    verifica.
12. Cada token de color se declara **una sola vez** con `light-dark(claro, oscuro)`; el tema
    activo lo decide `color-scheme`, que vale `light` por defecto y el interruptor cambia a `dark`
    con `:root[data-theme="dark"]`.
13. Las tipografías son locales: nada de peticiones a Google ni a ningún otro tercero.

## Validación

```bash
node tools/validate-site.mjs      # contrato: falla con código 1 si algo se rompe
node tools/contrast-report.mjs    # informe legible de accesibilidad
node tools/measure-viewport.mjs    # comprueba en Chrome que la portada cabe en una pantalla
```

El segundo imprime el contraste de cada par en los dos temas, las tipografías en uso y el peso
del CSS. **Importa la matemática del primero**, así que informe y validación nunca discrepan.

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

- **Claro por defecto.** Sin elección guardada el sitio se muestra en claro, aunque el sistema
  operativo esté en oscuro; el interruptor es la única vía al tema oscuro y su preferencia se
  guarda en `localStorage` con la clave `theme`. No hay ninguna `@media (prefers-color-scheme)`.
- El interruptor de la cabecera es **solo icono** (una bombilla): sin texto visible, su nombre
  accesible viene de `aria-label="Tema oscuro"` y el estado de `aria-checked`. El test exige que
  `role="switch"` y ese `aria-label` no falten. El relleno amplía el área sensible a ~28 px.
- `data-theme` solo se escribe para el tema **oscuro**; sin atributo, `:root` ya es claro, así que
  no hace falta un selector para volver atrás.
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

## Estilo

Sistema visual tomado de ivan.codes — descargué su CSS real para copiar los valores, no de
memoria — y aplicado sobre nuestras secciones, nuestras tipografías y nuestro propio tema oscuro.

| Token | Claro | Oscuro | Mínimo exigido |
|---|---|---|---|
| `--color-bg` | `#fafafa` | `#0a0a0a` | — |
| `--color-text` | `#181919` | `#e6e6e3` | 7:1 → 16.9 / 15.8 |
| `--color-muted` | `#6b6b66` | `#8a8a85` | 4.5:1 → 5.1 / 5.7 |
| `--color-surface` | `#f0f0f0` | `#171717` | decorativo |
| `--color-accent` | `#7c700f` | `#f7df1e` | 4.5:1 → 4.8 / 14.6 |

### El acento, derivado de `#f7df1e`

Un solo token, dos valores. El amarillo de partida es `#f7df1e`:

- **Sobre fondo oscuro** se usa tal cual: da **14.6:1**, Spectacular.
- **Sobre fondo claro** da **1.3:1**, inservible incluso para texto grande. Por eso ahí se usa
  el **mismo tono al 50%** (`#7c700f`): mismo hue —53,4° verificado—, solo menos luminosidad, y
  sube a **4.8:1**, que ya cumple AA para texto normal.

Así hay un único acento para los dos temas, derivado del hex que indicaste, y siempre legible.

### Enlaces: la línea que entra desde la derecha

- En reposo no hay ninguna línea: el enlace se reconoce por su color de acento.
- Al pasar el ratón, una barra de 1 px del mismo acento **barre de derecha a izquierda** en
  **150 ms** (`background-position: right` + `background-size` de 0% a 100%).
- Menú, pie, marca del sitio y el enlace "volver" quedan excluidos: son controles de interfaz,
  no texto en línea.
- Con `prefers-reduced-motion: reduce` la línea aparece de golpe, pero se sigue viendo.
- El test comprueba las dos condiciones del requisito: que entre desde la derecha y que dure 150ms.

Lo que sí se ha adoptado de su sitio:

- **La página de artículo**, replicada desde su marcado real: fila de contexto con las migas a la
  izquierda y la fecha en monoespaciada a la derecha, cabecera con el `h1` a 1,875 rem
  (`text-3xl`), `semibold`, `tracking-tight` y `leading-tight`, subtítulo apagado, y después la
  prosa ocupando todo el ancho del contenedor.
- **La prosa con sus proporciones de Tailwind `prose-lg`**: 1,0625 rem (17 px, un punto por debajo
  de él), interlineado 1,8, tinta al 80% (`color-mix`), separación de párrafo de 1,35 rem (su
  `1.25em`), títulos en `em`; cita con barra de acento de 2 px; viñetas de lista en acento; código
  en línea como chip con marco; y bloque de código como tarjeta oscura **también en tema claro**.
- **Los dos contenedores de su sitio**: 36 rem (`max-w-xl`) para los listados y 42 rem
  (`max-w-2xl`) para los artículos, que necesitan más ancho para la prosa y las imágenes. En ambos,
  24 px laterales (`px-6`) y 96 px de aire vertical (`py-24`), que bajan a 64 px en móvil (`py-16`).
- **Barra de progreso de lectura**: línea de acento fija arriba que crece con el scroll.
- **Listas con línea guía**: título monoespaciado, guion fino hasta el metadato y fecha a la
  derecha, con el título en acento al pasar el ratón. También en móvil desaparece la línea guía.
- **Cambio de tema animado** en `body`: 0,3 s de transición de fondo y tinta.
- **El acento `#f7df1e`** en los enlaces, las viñetas, la barra de progreso y la línea guía.
- **El cuerpo sigue en 16 px**, aunque su escala baja a 14-15 px: se lee más cómodo.

Lo que **no** se ha copiado, y por qué:

- Sus hairlines como separadores de lista (`--border: #d4d4d4`): la separación entre bloques es
  por espacio. Sí se usan líneas dentro de los componentes donde él las usa: la guía de las listas
  y los marcos de código e imágenes.
- Su escala de 14-15 px y su tipografía de display de 10vw: aquí el cuerpo se queda en 16 px y no
  hace falta un titular gigante para nuestro contenido.
- Su barra de "copy prompt" y el resaltado de sintaxis con Shiki: son piezas de su contenido, no
  de la maqueta; el CSS del bloque de código ya está listo para cuando haya un `<pre>`.

## Escala tipográfica

| Elemento | Token | Tamaño | Caracteres por línea (listados a 576 px) |
|---|---|---|---|
| Cuerpo del sitio | `--text-body` | **15 px** | ~77 |
| Prosa del artículo | `--text-prose` | **17 px** | ~68 (listados) · ~79 (artículos a 672 px) |
| Títulos de listas, navegación y etiquetas | `--text-sm` | **14 px** | ~69 (monoespaciada) |
| Fechas, años y metadatos | `--text-2xs` | **12 px** | — |
| Subtítulo de página | `--text-md` | 16,8 px | — |
| `h1` del artículo | `--text-2xl` | 30 px | — |

Es un punto más compacta que la de ivan.codes (16 px de cuerpo y 18 px de prosa). El titular del
artículo se mantiene en 30 px, que es su valor exacto.

Adoptar su ancho de listado corrigió la densidad: antes el cuerpo llegaba a ~90 caracteres por
línea y las listas a ~96; con 576 px quedan en ~77 y ~69, dentro del rango cómodo de lectura.

## Tipografías

`Inter` (texto) y `IBM Plex Mono` (código y datos), las dos familias que usa ivan.codes,
**auto-alojadas** en `assets/fonts/` con el subconjunto latino: 48 KB + 45 KB en total, sin una
sola petición a Google en cada visita, y con `font-display: swap`.

El reparto es el de su sitio:

- **Inter** para la prosa, los títulos de página, el subtítulo y las descripciones.
- **IBM Plex Mono** para los títulos de las listas (`.entry__title`, `.project__title`), los roles
  (`.project__role`), los metadatos y fechas (`.entry__meta`, `.project__meta`, `.site-time`) y el
  código.
- El `h1` del artículo va en Inter, como el suyo: es un titular, no un dato.

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
## La portada cabe en una sola pantalla

`index.html` se lee entera sin scroll: es la idea que se toma de `ivan.codes`, donde
la portada es un indice corto que se agota de un vistazo.

Se sostiene con tres decisiones, todas en la capa 8 de `assets/css/main.css`:

1. `body` es una columna flex de altura completa, con cabecera y pie fijos y el
   contenido repartido en el espacio sobrante.
2. Los dos listados van en paralelo con `auto-fit`, no apilados. Apilados, la
   altura seguiria al numero de filas y dejaria de caber en pantallas cortas.
3. La escala tipografica y los huecos se miden en `vh` con `clamp()`, asi que en
   una ventana baja el sitio se comprime en lugar de desbordarse.

**Deliberadamente no se usa `overflow: hidden`.** Recortar dejaria fuera filas y
enlaces al ampliar el zoom o en pantallas muy bajas, que es justo lo que un
reclutador con lupa no deberia encontrar. Si el viewport es mas bajo que lo que
el texto necesita, la pagina se hace mas alta: se prefiere scroll a contenido
invisible.

En movil (390x844) el scroll sigue siendo necesario: en una sola columna, las diez
filas de los listados mas la prosa no caben sin borrar contenido. Ahi se acepta.

Como el validador de arquitectura no puede saber si algo desborda, la medicion se
hace con un motor de verdad:

```
node tools/measure-viewport.mjs          # portada: sin scroll en escritorio
node tools/measure-viewport.mjs blog.html   # paginas interiores: si deben hacer scroll
```

Abre Chrome sin interfaz, carga la pagina a cinco tamanos y compara
`document.scrollHeight` con la altura visible. Con `MEASURE_SHOT=ruta.png` deja ademas una
captura de la portada, que es la forma util de comparar el resultado con la referencia.
