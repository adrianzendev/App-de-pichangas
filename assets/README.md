# Assets de la app nativa (iconos y splash)

`@capacitor/assets` genera todos los tamaños de Android e iOS a partir de las imágenes de esta carpeta.

## Estado
`icon-master.png` (1024×1024) es el icono real de la marca y es lo único que se versiona aquí; el resto se genera.
No guardar
el maestro dentro de `client/src`: Vite lo empaquetaría con la web.

Para el icono adaptativo de Android lo ideal es además un `icon-foreground-master.png` con solo la hoja y la «m» sobre
fondo transparente; sin él se usa el icono completo (se ve bien porque el fondo toma su mismo verde).

## Cómo se usa
1. Colocar el icono maestro en esta carpeta:
   - `icon-master.png` (cuadrado, mínimo 1024×1024) **o** `icon-master.svg`.
   - Opcional: `icon-foreground-master.png`, solo la marca con fondo transparente, para el icono adaptativo de Android.
     Si no existe se usa el icono maestro completo.
2. Generar las fuentes: `npm run assets:prepare`
   (crea `icon-only.png`, `icon-foreground.png`, `icon-background.png` y `splash.png`; valida que sea cuadrado y de al menos 1024).
3. Con Capacitor instalado y los proyectos creados (`npx cap add android ios`):
   `npx @capacitor/assets generate --android --iconBackgroundColor "<fondo>" --splashBackgroundColor "#F5F5F5"` (el script imprime el comando con el color de fondo tomado del icono maestro; hoy `#59BC7A`)

Colores: verde de marca `#8B2FE0` (`theme_color`) y fondo `#F5F5F5` (`background_color`). La app no tiene modo oscuro,
así que no hace falta `splash-dark.png`.

Los archivos generados (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`) se pueden
volver a crear en cualquier momento; el maestro es lo que se conserva en el repositorio.
