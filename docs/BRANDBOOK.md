# Brandbook de ERPlora

**Versión 1 · 8 de noviembre de 2026.** Esta es la norma visual de Hub, SaaS, web pública y componentes
compartidos. La fuente técnica es `@erplora/ui`: `src/shell/brandbook.ts` cataloga las paletas,
`theme/variables.css` define marca y estados, `theme/palettes.css` las variantes y `theme/brand.css`
las primitivas. La presentación se puede recorrer en [brandbook.html](./brandbook.html).

## 1. Idea de marca

ERPlora es una plataforma central rodeada de módulos. La interfaz debe sentirse **clara, cercana,
moderna y trabajadora**: el contenido manda, el azul identifica la plataforma y el color señala una
acción o un estado, nunca decora por decorar.

- **Una sola marca, siete expresiones.** La paleta cambia el acento y los neutros; no cambia la
  jerarquía, los componentes, los datos ni el significado de las acciones.
- **Superficies antes que barras.** Lienzo discreto, tarjetas blancas o de tinta, bordes finos y
  sombras suaves. Sin paneles saturados compitiendo con los datos.
- **Táctil primero.** Ionic aporta los controles y sus gestos; en dispositivos con
  `@media (pointer: coarse)` los controles miden al menos 44×44 px, 48 px es el objetivo de producto
  y 56 px el grande del TPV. No se sustituyen por botones HTML si Ionic ya los cubre.
- **Personal sin perder identidad.** Claro, oscuro o sistema y paleta global o personal componen
  libremente. El modo de contraste `aa` está disponible cuando el sólido de marca no alcanza AA.
- **Sin sorpresas.** Una página nueva reutiliza primitivas; no inventa otro radio, otra sombra u
  otro significado para un color.

## 2. Logotipo

El símbolo es el hub central azul con ocho módulos rojos, verdes y amarillos. Se implementa una sola
vez en `theme/erplora-logo.css` mediante `.erp-logo`; el lockup añade `.erp-wordmark` en minúsculas.

- El centro sigue `--ion-color-primary`; los módulos conservan sus colores de marca.
- Tamaños: `xs` 16 px, `sm` 32 px, `md` 56 px, `lg` 96 px y `xl` 144 px.
- Reserva espacio suficiente para que el símbolo no toque texto ni bordes. No rotarlo, deformarlo,
  cambiar el orden de los módulos, añadir gradientes ni reconstruirlo con SVG sueltos.
- `.mono` usa una sola tinta para impresión o reproducción monocroma. No cambiar el caso del
  wordmark ni usarlo como sustituto del título de una página.

## 3. Color

### Reglas

- `--ion-color-primary`: acento y acción principal. No usarlo para grandes fondos de contenido.
- `--ion-color-success`: completado o correcto; `--ion-color-warning`: requiere atención;
  `--ion-color-danger`: error o acción destructiva; `--ion-color-secondary`: apoyo, nunca otro
  significado de estado. El color siempre va acompañado de texto, icono o forma.
- Texto normal: `--ion-text-color`; secundario: `--ep-text-muted`; fondos: `--ion-background-color`;
  superficies: `--ion-card-background`; separadores: `--ep-border`.
- Sobre tintes usar los pares `--ep-<estado>-tint` y `--ep-<estado>-text`. En una paleta opcional el
  tinte y el texto de primario se derivan de su propio color, nunca vuelven al azul ERPlora.
- Los valores hexadecimales viven en el catálogo y en las hojas de tema. Un fallback literal de un
  componente no es una nueva decisión cromática. Logos, imágenes, gráficos categóricos y documentos
  impresos conservan sus colores funcionales documentados.

### Paletas

Cada celda muestra **primario claro / primario oscuro**. El lienzo y la tinta también cambian según
el modo; sus valores exactos están en `src/shell/brandbook.ts` y se comprueban contra el CSS.

| ID | Nombre y carácter | Primario claro | Primario oscuro |
|---|---|---|---|
| `erplora` | Azul de plataforma, neutro | `#1496d6` | `#2aa6e4` |
| `terracotta` | Cálido, artesanal | `#E8552A` | `#E8552A` |
| `corporate` | Sobrio, empresarial | `#0F3F9C` | `#176EC8` |
| `minimal` | Monocromo, editorial | `#111111` | `#FAFAFA` |
| `forest` | Natural, terroso | `#1F542A` | `#3B874A` |
| `ocean` | Tecnológico, cian | `#008CBD` | `#00B1DA` |
| `violet` | Creativo, violeta | `#742AD9` | `#7F3BE7` |

### Semántica base

| Token | Valor claro | Uso |
|---|---|---|
| `--ion-color-secondary` | `#6366f1` | Apoyo e información secundaria |
| `--ion-color-success` | `#23944e` | Correcto, activo, completado |
| `--ion-color-warning` | `#e8a912` | Aviso; texto oscuro sobre el sólido |
| `--ion-color-danger` | `#d6404f` | Error, borrado o riesgo |
| `--ion-color-medium` | `#6b7280` | Información neutra y etiquetas |
| `--ep-primary-accessible` | `#0e78ad` | Azul sólido AA sobre blanco |

## 4. Tipografía y números

- **Hub y shell de producto:** `system-ui`, `-apple-system`, `Segoe UI`, Roboto, sans-serif. No se
  promete una tipografía que no esté servida localmente; el Hub puede funcionar sin red.
- **SaaS y web pública:** IBM Plex Sans, servida como recurso propio, con la misma pila de sistema
  como fallback. La diferencia de fuente no cambia medidas ni jerarquía.
- Títulos: peso 600–700 y tracking ligeramente negativo. Texto: 1rem; ayuda y metadatos: 0.875rem;
  etiquetas pequeñas: 0.72–0.75rem. No bajar de 11 px en navegación compacta.
- Importes, cantidades y KPIs usan cifras tabulares. Monoespaciada solo para código, identificadores
  técnicos o contenido que deba alinearse carácter a carácter.
- No usar mayúsculas para botones. Los rótulos de sección pueden usarlas solo como variante
  tipográfica puntual, con tamaño y contraste suficientes.

## 5. Geometría, elevación y movimiento

| Concepto | Token | Valor |
|---|---|---|
| Radio normal | `--ep-radius` | 14 px |
| Controles | `--ep-radius-sm` | 10 px |
| Tarjetas grandes | `--ep-radius-lg` | 16 px |
| Píldoras | `--ep-radius-pill` | 999 px |
| Elevación de superficie | `--ep-shadow-xs`, `--ep-shadow-sm` | Fina y corta |
| Elemento flotante | `--ep-shadow-pop`, `--ep-shadow-modal` | Más profunda, según capa |
| Transición | `--ep-transition` | 150 ms, suave |
| Pulsación | `--ep-press-scale` | 0.98 |
| Foco | `--ep-focus-ring` | Anillo del primario al 24 % |

La animación comunica respuesta, no entretiene. `prefers-reduced-motion` elimina desplazamientos y
transiciones no esenciales. No usar glass o gradientes como fondo general de una pantalla de trabajo.

## 6. Componentes

- **Botones:** `ion-button`, radio de controles, sin sombra ni mayúsculas. Una acción primaria por
  zona; iconos de `HubIcon` y texto claro. Un botón con solo icono conserva nombre accesible y tooltip.
- **Tarjetas:** `ion-card` o `.ep-surface` para contenido no Ionic. Borde, fondo de tarjeta y sombra
  de tema. `.ep-clickable` solo si toda la superficie ejecuta una acción.
- **Iconos tonales:** `.ep-icon-tile`, con `--ep-primary-tint` y `--ep-primary-text`; `--sm` para
  encabezados compactos. No usar cuadrados saturados salvo que el icono sea la propia acción primaria.
- **Tablas y listados:** `DataTable` de `@erplora/ui`; no crear una tabla paralela por página. Sus
  controles de paginación, selección, filtros y densidad son Ionic.
- **Formularios:** controles Ionic, etiquetas persistentes y errores junto al campo. `fill="outline"`
  siempre con `mode="md"`; los formularios no pierden sus valores al cambiar tamaño u orientación.
- **Estados y avisos:** `StatusPill` e `InlineFeedback`; texto explícito y pares de tinte accesibles.
- **Diálogos y hojas:** Ionic y `FormModal`; elevación `--ep-shadow-modal`, fondo de la paleta y foco
  devuelto al disparador al cerrar.

## 7. Responsive y accesibilidad

- Móvil, tablet y escritorio se diseñan juntos. La tablet es el dispositivo principal del TPV.
- En móvil la navegación se agrupa y las listas pueden ser tarjetas; no se eliminan acciones.
- Sin desplazamiento horizontal de página. Los scrollers especializados se anuncian y no capturan la
  página entera. Los textos largos parten entre palabras y las acciones no se cortan.
- Controles de al menos 44×44 px con `@media (pointer: coarse)` y objetivo de 48 px en producto;
  foco visible, lector de pantalla, teclado y gestos Ionic.
- Texto normal AA ≥ 4.5:1; texto grande y componentes ≥ 3:1. El modo de marca conserva su color, y
  `data-ep-contrast="aa"` cambia a los sólidos accesibles cuando se necesita.
- La pantalla respeta safe areas, zoom, orientación y reducción de movimiento.

## 8. Cómo aplicarlo

1. Importar la shell de `@erplora/ui` en la SPA; en la web pública, cargar `variables.css`,
   `palettes.css` y `brand.css` antes de los estilos de página.
2. Elegir primero un componente de `@erplora/ui/components` o uno Ionic. Usar Tailwind para layout y
  espaciado, no para reconstruir el control.
3. Usar tokens `--ion-*` para color y `--ep-*` para geometría. Nuevos valores globales entran primero
   en el tema, con su traducción a oscuro y sus pruebas de contraste.
4. No introducir selectores de marca específicos de una página en `brand.css`. Las excepciones de
   contenido (gráficos, imágenes, impresión) se justifican junto al componente.
5. Revisar claro y oscuro, al menos la paleta ERPlora y una opcional, en 390, 834 y 1440 px, con
   teclado y tacto. Los tests de `brandbook.test.ts` y `theme-css.test.ts` deben quedar verdes.
