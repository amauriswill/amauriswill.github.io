# assets/img

Imágenes del sitio. Esta carpeta existe para que las fotos de la página `photos.html`
no dependan de servicios externos.

## Convención

- **Formato:** JPG o WebP (WebP si el peso importa). Nada de PNG para fotos.
- **Ancho:** 1600 px de lado largo es suficiente para la cuadrícula (se muestran a ~320 px).
- **Proporción:** 4:3 o 3:2, la misma en toda la serie, para que la cuadrícula quede alineada.
- **Nombre:** `serie-<tema>-<numero>.jpg` → `serie-calle-01.jpg`, `serie-calle-02.jpg`.
- **Peso:** por debajo de 300 KB por archivo.

## Cómo publicar una serie

1. Copiar los archivos aquí con la convención de nombres.
2. En `photos.html`, sustituir el hueco de la serie por su imagen:

   ```html
   <!-- antes -->
   <div class="photo__frame"></div>

   <!-- después -->
   <img class="photo__frame" src="assets/img/serie-calle-01.jpg"
        alt="Descripción breve de la foto" loading="lazy">
   ```

3. Cambiar el pie de la serie (`photo__meta`) de "Serie en preparación" al año y número de fotos.
4. Ejecutar `node tools/validate-site.mjs` y confirmar que sigue en `PASS`.

La clase `.photo__frame` ya define la proporción (4:3), el borde y el fondo, así que la
imagen solo tiene que aportar el contenido.
