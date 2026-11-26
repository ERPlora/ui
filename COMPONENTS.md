# Catálogo de componentes de `@erplora/ui`

Antes de maquetar nada en una pantalla del Hub o del panel del SaaS, se busca aquí. Cada entrada dice cómo se importa,
para qué sirve, cuándo usarla y cuándo no, su API principal y sobre qué componentes de Ionic se apoya. El detalle está
en la cabecera, los tipos y los tests de cada componente.

`src/component-catalog.test.ts` exige una entrada `` ### `Nombre` `` por cada componente que exportan
`@erplora/ui/components` y `@erplora/ui/shell`, y falla si una entrada nombra algo que ya no se exporta: quien añade,
renombra o quita un componente actualiza este fichero en el mismo cambio.

## Necesito… → uso…

- una lista de registros con búsqueda, filtros, orden, páginas y acciones → `DataTable`
- tarjetas hermanas cuyas secciones se alinean entre columnas → `AlignedCardGrid`
- una lista de puntos larga que se pliega → `CollapsibleChecklist`
- un formulario corto en un diálogo → `FormModal`
- guardar una página de ajustes / un número de ajustes → `SettingsFormFooter` / `SettingsNumberField`
- elegir uno entre muchos, o buscarlo en el servidor → `Combo`
- marcar los alérgenos que lleva un plato o producto / decirlos debajo de su nombre → `AllergenSelect` / `AllergenRow`
- escribir un importe / un color / subir una imagen → `MoneyInput` / `ColorInput` / `ImageUpload`
- elegir un día / una hora / un día y una hora juntos → `DateField` / `TimeField` / `DateTimeField`
- enseñar un importe, una fecha, una hora del reloj o una cantidad → `formatMoney`, `formatDateTime`, `formatTimeOfDay`, `formatQuantity`
- decir que no hay datos → `EmptyState`
- confirmar algo que la persona acaba de hacer → `toastSuccess`, `toastError`…
- un aviso que solo tiene sentido junto a lo que afecta (un error de carga, el rechazo de un formulario) → `InlineFeedback`
- un aviso que exige una acción y sigue siendo verdad hasta que se resuelve → el centro de avisos del shell
  (`createShell({ actionNotices })`, `useActionCenter`), nunca un toast ni una caja suelta en la página
- pedir confirmación antes de algo irreversible → `useConfirm` (o `ConfirmDialog`)
- el estado de un registro en una etiqueta de color → `StatusPill`
- cuánto se ha gastado de un límite / una cifra de uso → `UsageMeter` / `UsageCounter`
- una cifra de Inicio, de un informe o de una app (ventas de hoy, tickets), con tendencia, estado, minigráfica o destino →
  `StatCard`, en una fila `ep-stat-grid`
- un gráfico: valores por día u hora en barras / en líneas / un ranking de nombres con su barra → `BarChart` /
  `LineChart` / `BarList`
- informar de un problema sin salir de la app → `ReportProblemModal`
- la persona / un icono → `UserAvatar` / `HubIcon`
- el marco de una pantalla (barra superior, Atrás, acciones, pestañas) → `AppPage`
- las acciones de una pantalla en la barra → el slot `actions` de `AppPage`; en el teléfono van al «⋮» único de la
  barra, nunca a un botón de «más» propio
- algo que solo se enseña en la web (lo que vende) → `WebOnly` / `v-web-only`
- una comanda, en la cocina o en el TPV → las clases `ep-order-ticket` y `ep-order-board` (ver «Clases de la comanda»); el
  componente es de cada app
- el plano de mesas: el plano / el teléfono / la carga / el resumen de la zona / las zonas → `FloorTile` /
  `FloorCards` / `FloorSkeleton` / `FloorSummary` / `FloorZoneTabs`; una mesa dibujada fuera del plano → `TableGlyph`
- un vídeo de YouTube que no pide nada a Google hasta pulsarlo → `YouTubeEmbed`
- el chat del asistente → `AssistantPanel`, `AssistantButton`, `AssistantEmpty`; un texto en Markdown que enlaza a
  pantallas de la app → `AssistantMarkdown`

## Listas y tablas

### `DataTable`
`import { DataTable } from '@erplora/ui/components'`
- **Para qué sirve:** la lista de registros de una pantalla: búsqueda, filtros por columna, orden, acciones de fila, interruptor de estado y selección. Antes de cortar un texto o un encabezado, las columnas de texto corto le ceden el sitio que les sobra (hasta lo que ocupa su texto); una con `minWidth`, con slot propio, con `identity` o con `toggle` no cede. Lo que cabe lo decide su propia caja: primero retira las columnas `priority: 'low'`, después las acciones que no están fijadas y, si `views` ofrece tarjetas, pasa a tarjetas, y vuelve a filas en cuanto tiene sitio otra vez (también al cerrar el panel de filtros que se lo quitaba), salvo que la persona haya elegido la vista; en el teléfono (hasta `cardBreakpoint`, 640 px) son tarjetas siempre que `views` las ofrezca. La lista vacía, la búsqueda sin resultados y la carga fallida se pintan con `EmptyState` e `InlineFeedback`; lo que una página pone en su slot `empty` queda centrado en la tabla. La cabecera de la lista se queda fija al desplazarla, y ella y las acciones fijadas quedan siempre por encima de lo que lleva una fila (un `ion-toggle`, la casilla de selección o lo que ponga el slot de una celda).
- **Acciones de fila:** como mucho dos botones visibles por fila, de solo icono, con la etiqueta como nombre accesible y como título (`showLabel` pinta también el texto; una acción sin icono, su texto). Cada acción se nombra para el lector con la fila a la que afecta, «<acción>: <título de la fila>» («Cambiar rol: Carlos Ruiz»), con el título de su tarjeta (`cardTitle` o `cardTitleColumn`), en su botón (también su título) y en su entrada del «⋮»; el texto visible no cambia y, sin título de fila, el nombre es la etiqueta corta. `ariaLabel(row)` lo sustituye cuando el título no sirve como nombre. La fijada (`pinned`) va primero; el resto, y siempre las delicadas (`menuOnly`), van al menú «⋮» de la fila, con icono y texto, que solo aparece si le queda algo. La tarjeta lleva su acción principal con texto a todo el ancho y el «⋮» al lado.
- **Interruptor:** la opción `toggle` de una columna enciende o apaga la fila con un `ion-toggle` (al principio de la celda en la lista, al final de la cabecera de la tarjeta), con su nombre accesible, su progreso y su motivo debajo; al moverlo emite `toggle`, y si el cambio se cancela o falla vuelve al estado real. `hidden` lo quita en una fila y deja su motivo.
- **Tarjetas y scroll infinito:** el tipo de tarjeta «fila como tarjeta» es la tarjeta del propio `DataTable` y no se monta a mano: la identidad de la columna `identity` en la cabecera, el estado (columna `state` o `status`) como etiqueta, la descripción (`summary` o `description`) a todo el ancho y los demás datos en líneas que dicen qué es cada uno, con el icono de `cardIcon` o, sin él, con el nombre de la columna delante del valor («Divisa EUR»), sin pintar los vacíos; el slot `card` cambia su cuerpo. Las tarjetas y la lista del teléfono cargan las siguientes al llegar al final (`ion-infinite-scroll`; en modo servidor emiten `loadMore`): ya no hay «Cargar más». La lista de escritorio conserva su paginador.
- **Llenar la pantalla (`fill`):** la tabla ocupa el alto de su contenedor y sus filas llegan hasta el paginador, sin franja vacía; si no caben todas, la última que se ve queda cortada en el borde y las demás se desplazan dentro, como en cualquier lista con scroll. En el teléfono la lista se desplaza con la página.
- **Filtros en el navegador:** sin `serverSide`, `text` busca «contiene» en lo que pinta la celda y `select` y `lookup` comparan por igualdad con el campo de la fila (`filter.key` si no es el de la columna); si ese campo es una lista, la fila entra cuando uno de sus elementos es el valor elegido (una venta cobrada con efectivo y tarjeta sale filtrando por cualquiera de los dos).
- **Filtros propios:** un `ion-select` que la página pone directamente en el slot `filters` (o `toolbar`) va enmarcado como los selectores de la barra y mide lo que la opción que enseña (entre 6,5 y 16 rem), así que su texto no se corta.
- **Úsalo cuando** una pantalla lista registros de una entidad; el alta va por `addable` (emite `add` y la página abre su formulario).
- **No lo uses cuando** son unos pocos puntos fijos sin búsqueda ni acciones → `ion-list`; una tarjeta de registro fuera de una lista: aún no existe (ver al final).
- **API:** `columns` (con `identity`, `cardIcon`, `toggle`, `priority`, `cell`, `filter`…), `rows`, `rowKey`, `loading`, `error`, `searchable`, `filters`/`filterFields` (tipos `text`, `select`, `date`, `daterange`, `range`, `boolean` y `lookup`, uno entre muchos), `serverSide` con `total`/`page`/`sort`/`maxWindow`, `actions` (`id`, `label`, `ariaLabel`, `icon`, `showLabel`, `color`, `disabled`, `loading`, `hidden`, `pinned`, `menuOnly`), `maxInlineActions` (2, el máximo), `addable`, `primaryAction`, `rowClickable`, `selectable`, `views`, `cardBreakpoint`, `entityLabel`, `fill`, `testid`; slots de celda (el `cell` de cada columna), `card`, `row-actions` (solo para un control que no puede ser una acción: nunca se pliega), `toolbar`, `filters`, `empty`; eventos `add`, `action`, `toggle`, `rowClick`, `pageChange`, `pageSizeChange`, `sortChange`, `loadMore`, `retry`, `update:search`, `update:filters`. Las pruebas de una página leen y pulsan las acciones de una fila, estén en sus botones o en su «⋮», con `offeredRowActions` y `pressRowAction` de `@erplora/ui/testing/data-table`.
- **Ionic:** `ion-searchbar`, `ion-select`, `ion-checkbox`, `ion-segment`, `ion-popover`, `ion-list` e `ion-item` (el «⋮»), `ion-card`, `ion-chip`, `ion-toggle`, `ion-infinite-scroll`, `ion-button`, `ion-spinner`.

### `AlignedCardGrid`
`import { AlignedCardGrid } from '@erplora/ui/components'`
- **Para qué sirve:** una rejilla de tarjetas a 1, 2 o 3 columnas (teléfono, tableta, escritorio) en la que las secciones de cada tarjeta quedan a la misma altura entre columnas.
- **Úsalo cuando** tarjetas con las mismas secciones se comparan lado a lado, como los planes de precios.
- **No lo uses cuando** las tarjetas son registros de una lista → `DataTable` con `views` de tarjetas.
- **API:** prop `rows` (1–12, las filas que ocupa cada tarjeta); slot por defecto con las tarjetas, que alinean sus secciones con `grid-template-rows: subgrid` y `overflow: clip`, con una alternativa apilada sin subgrid.
- **Ionic:** ninguno (rejilla CSS); las tarjetas pueden ser `ion-card`.

### `CollapsibleChecklist`
`import { CollapsibleChecklist } from '@erplora/ui/components'`
- **Para qué sirve:** una lista de puntos con marca que enseña los primeros y un botón «ver todos» / «ver menos».
- **Úsalo cuando** lo que incluye algo (las funciones de un plan) es largo y la tarjeta tiene que seguir corta.
- **No lo uses cuando** los puntos son registros con acciones → `DataTable`; la lista entera cabe → `ion-list`.
- **API:** props `items` (`{ text, testid? }[]`), `collapsedCount` (5), `showAllLabel` y `showFewerLabel` (los textos del botón, de la página), `toggleTestid`; `v-model:expanded`.
- **Ionic:** `ion-list`, `ion-item`, `ion-label`, `ion-button`, con `HubIcon`.

## Formularios y campos

### `FormModal`
`import { FormModal } from '@erplora/ui/components'`
- **Para qué sirve:** un formulario corto en un diálogo, con Guardar y Cancelar, su estado de envío y el error del servidor (el mensaje arriba y el de cada campo en el slot). El motivo de un campo sale una sola vez, debajo de ese campo: si el mensaje del rechazo es el motivo que ya pinta un campo marcado (un nombre que ya tiene otro registro), el recuadro de arriba no lo repite; arriba queda lo que no dice ningún campo. Nunca pasa del alto de la pantalla: si no cabe, los campos se desplazan entre el título y los botones, que siempre se ven (también en una tableta en horizontal con un pie de varias filas). Un párrafo encima de un campo ya va separado de su rótulo, también dentro de `ConfirmDialog` (ver «Reglas»). Un título largo pasa a las líneas que necesite, nunca se corta con «…».
- **Úsalo cuando** se crea o edita algo de pocos campos sin salir de la pantalla.
- **No lo uses cuando** el formulario de una entidad es largo → una página con `AppPage`; es una pregunta de sí o no → `useConfirm`.
- **API:** `v-model:open`, `title`, `submitLabel`, `pending`, `error`, `size` (`sm` 420 px, `md` 480 px, `lg` 640 px para una ventana de lectura), `phoneLayout` (`sheet`, `card`), `submitDisabled`, `submitHint` (lo que aún falta mientras Guardar está apagado, una cosa cada vez: «Escribe el nombre para continuar.»; sale en su propia línea encima de los botones, del lado de Guardar, que siempre se ve, y el lector de pantalla la anuncia cada vez que cambia (`role="status"`); con Guardar encendido o en una ventana de solo lectura no sale), `readonly`, `canDismiss`, `testid`; slot por defecto con `{ fieldErrors, pending }` y slot `footer`; eventos `submit` (no cierra: la página pone `open = false` cuando su orden sale bien) y `cancel`. `useRefusal` mantiene los errores de un rechazo mientras se corrige.
- **Ionic:** `ion-modal`, `ion-header`, `ion-toolbar`, `ion-title`, `ion-buttons`, `ion-button`, `ion-spinner`.

### `SettingsFormFooter`
`import { SettingsFormFooter } from '@erplora/ui/components'`
- **Para qué sirve:** el final del formulario de una página de ajustes: el aviso del rechazo, el aviso de «guardado» y el botón Guardar, apagado sin cambios o mientras guarda. Como en `FormModal`, el aviso rojo no repite el motivo que ya dice un campo de la página debajo de sí; uno que no pinta ningún campo sigue en el aviso.
- **Úsalo cuando** una página de ajustes se guarda con `useSettingsForm`, que solo envía los campos tocados y no pisa lo que otro guardó.
- **No lo uses cuando** el formulario va en un diálogo → `FormModal`, que trae sus botones.
- **API:** props `settings` (lo que devuelve `useSettingsForm`), `testid`, `saveLabel`, `savedLabel`, `errorHeading`, `saveIcon`, `spinner`, `allowUnchanged`, `readonly`.
- **Ionic:** `ion-button`, `ion-spinner`, con `InlineFeedback` y `HubIcon`.

### `SettingsNumberField`
`import { SettingsNumberField } from '@erplora/ui/components'`
- **Para qué sirve:** un campo numérico de una página de ajustes, ligado a `useSettingsForm`: pinta el valor del formulario y el error del servidor para ese campo.
- **Úsalo cuando** un número (minutos, días, unidades) de una página de ajustes que usa `useSettingsForm`.
- **No lo uses cuando** es un importe → `MoneyInput`; es un número fuera de una página de ajustes → `ion-input`.
- **API:** props `settings`, `field`, `label`, `testid`, `helperText`, `min`, `max`, `step`, `inputmode` (`numeric`, `decimal`), `disabled`.
- **Ionic:** `ion-input`.

### `Combo`
`import { Combo } from '@erplora/ui/components'`
- **Para qué sirve:** un campo que busca entre sus opciones mientras se escribe (contiene, sin acentos ni mayúsculas) o pregunta al servidor, con la opción de crear lo escrito.
- **Úsalo cuando** se elige uno entre muchos (clientes, productos, cuentas) o entre lo que responde el servidor.
- **No lo uses cuando** son pocas opciones fijas → `ion-select`; se filtra una columna de una lista → el filtro `lookup` de `DataTable`.
- **API:** `v-model` (`{ id, label, hint? }` o `null`), `options` o `search(query)`, `label`, `placeholder`, `emptyLabel`, `errorText`, `helperText`, `allowCreate` (evento `create`), `clearable`, `debounce`, `disabled`, `testid`.
- **Ionic:** `ion-input`, `ion-popover`, `ion-item`, `ion-label`, `ion-button`, `ion-spinner`.

### `AllergenSelect`, `ALLERGEN_CODES`, `allergenName`, `formatAllergens`
`import { AllergenSelect, ALLERGEN_CODES, allergenName, formatAllergens } from '@erplora/ui/components'`
- **Para qué sirve:** marcar y desmarcar los catorce alérgenos de declaración obligatoria, cada uno por su nombre y en el orden del reglamento europeo. Los nombres salen en el idioma del negocio; los códigos estables viajan en `v-model` y siempre se emiten en el orden de la lista. `allergenName` traduce un código y `formatAllergens` escribe una selección con esos mismos nombres y orden, para fichas y líneas de detalle.
- **Úsalo cuando** un plato, producto o alergia de una persona declara cualquier subconjunto de esa lista cerrada.
- **No lo uses cuando** se elige una sola opción → `ion-select` o `Combo`; los alérgenos solo se enseñan → `AllergenRow`; son puntos de solo lectura → `CollapsibleChecklist`; la lista no es la de los catorce alérgenos.
- **API:** `v-model` (`AllergenCode[]`), `label`, `helperText`, `errorText`, `disabled`, `testid`; `ALLERGEN_CODES` fija los códigos y su orden, `allergenName(code, locale)` y `formatAllergens(codes, locale)` dan los textos. Es un `fieldset` con nombre, ayuda y error asociados; cada casilla se maneja con toque o teclado.
- **Ionic:** `ion-list`, `ion-item`, `ion-checkbox`, `ion-note`.

### `AllergenRow`
`import { AllergenRow } from '@erplora/ui/components'`
- **Para qué sirve:** la línea «Alérgenos: Gluten, Leche» debajo del nombre de un plato, una opción o una línea de la cuenta. Recibe los códigos en cualquier orden y los escribe por su nombre, en el orden de la lista y en el idioma del negocio; sin ninguno de los catorce no pinta nada, así que la página no necesita su propio `v-if`.
- **Úsalo cuando** se enseñan, de solo lectura, los alérgenos de algo cuyo nombre ya está en pantalla (la hoja de un grupo de suplementos, la línea del TPV); con `name` cuando la fila va separada de su nombre, como los platos de un menú («Paella · Alérgenos: Pescado»).
- **No lo uses cuando** se marcan o desmarcan → `AllergenSelect`; la ficha ya pone su propia etiqueta «Alérgenos» → `formatAllergens`; es la alergia de un cliente, que pide atención → `InlineFeedback`.
- **API:** props `codes` (los que no son de la lista se ignoran), `name`, `testid`. Es un `span` en bloque, que cabe dentro de una etiqueta, con texto secundario (`--ep-text-muted`) de 0,75 rem que parte las palabras largas. No es una tarjeta: es una línea de detalle dentro de la que la lleva.
- **Ionic:** ninguno.

### `MoneyInput`
`import { MoneyInput } from '@erplora/ui/components'`
- **Para qué sirve:** el único campo en el que se escribe un importe: teclado decimal, lee coma o punto y al salir lo reescribe en el formato de la página.
- **Úsalo cuando** un precio, un coste o cualquier importe; `signed` añade el botón ± para los negativos.
- **No lo uses cuando** es una cantidad o un número que no es dinero → `ion-input`; solo se enseña el importe → `formatMoney`.
- **API:** `v-model` (el texto tal cual: al guardar se lee con `parseMoney` y un importe guardado se escribe con `moneyFieldText`), `label`, `testid`, `money` (`{ currency, decimals }`), `signed`, `errorText`, `helperText`, `showError`, `disabled`.
- **Ionic:** `ion-input`, `ion-button`.

### `DateField`, `TimeField`, `DateTimeField`
`import { DateField, DateTimeField, TimeField } from '@erplora/ui/components'`
- **Para qué sirve:** el día o la hora de un formulario. Cerrado es un campo con contorno como los demás, de solo lectura (no abre el teclado), que enseña el valor en el idioma de la app («23/11/2026» o «11/23/2026»; «14:30» o «02:30 PM»). Al tocarlo, o con Intro, Espacio o la flecha abajo, abre el calendario o la rueda de horas de Ionic (`ion-datetime`) en un `ion-popover` en el centro de la pantalla, entero con sus botones (también en una tableta en horizontal, esté donde esté el campo), con los colores de la paleta activa, el idioma de la app, la semana desde el día en que la empieza ese idioma y las 24 horas o AM/PM según el idioma; abajo, Aceptar y Cancelar, y Borrar si el campo no es obligatorio. El día que se toca (o se elige con Intro o Espacio) queda elegido y el calendario se cierra, sin pulsar Aceptar; moverse por los meses y los años no elige nada, y la rueda de horas se confirma con Aceptar. Cancelar, Escape o tocar fuera lo cierran sin cambiar el campo. Nunca el selector nativo del dispositivo, que pinta con sus colores y en su idioma.
  `DateTimeField` es la pareja de los dos, lado a lado (uno debajo del otro si no caben), para un instante: el día bajo la etiqueta del campo y la hora bajo «Hora».
- **Úsalo cuando** un formulario o una barra pide un día, una hora o un instante (día y hora).
- **No lo uses cuando** se filtra una lista por fechas → los filtros `date` y `daterange` de `DataTable`; solo se enseña la fecha → `formatDateTime`.
- **API:** `v-model` (`DateField`: `AAAA-MM-DD`; `TimeField`: `HH:MM`; `''` o `null` es sin valor, y Borrar deja `''`), `label`, `testid` (el del `ion-input`), `min` y `max` (en el mismo formato; sin `max`, el calendario de `DateField` llega hasta el 31/12/2100, como el de Android, y su lista de años ofrece también los que vienen), `minuteStep` (solo `TimeField`: los minutos cada tantos desde la hora en punto), `required` (sin Borrar), `disabled`, `errorText`, `helperText`, `name` (su nombre en el formulario y en un rechazo del servidor). Al elegir, el formulario que lo rodea oye un `input` nativo, como de un campo escrito: así `FormModal` quita la marca de un rechazo. Solo `DateField`: `compact` (control de una fila de filtros, que le da su estilo: sin contorno ni etiqueta pintada, que queda como su nombre accesible) y `placeholder` (lo que se lee mientras está vacío). `DateTimeField`: `v-model` `AAAA-MM-DDTHH:MM` (los segundos se ignoran; `''` mientras falte el día o la hora, y lo ya elegido sigue a la vista), `label` (la del día y el nombre del grupo), `testid` (el del grupo; sus campos llevan `<testid>-date` y `<testid>-time`), `minuteStep`, `required`, `disabled`, `errorText` y `helperText` (bajo el día) y `name` (en los dos campos).
- **Ionic:** `ion-input`, `ion-popover`, `ion-datetime`, con `HubIcon`.

### `ColorInput`
`import { ColorInput } from '@erplora/ui/components'`
- **Para qué sirve:** un color de un formulario: una muestra que abre la paleta del sistema y el texto hexadecimal al lado.
- **Úsalo cuando** la persona elige un color libre (los colores de marca de su web).
- **No lo uses cuando** se escoge entre unos pocos colores fijos → `ion-select` o `ion-radio-group`.
- **API:** `v-model` (`#rrggbb`; un texto que no es un color no se emite y se marca al salir), `label`, `disabled`, `testid`.
- **Ionic:** `ion-item`, `ion-input`, con el `<input type="color">` nativo.

### `ImageUpload`
`import { ImageUpload } from '@erplora/ui/components'`
- **Para qué sirve:** una imagen de un formulario (logotipo, portada): miniatura, «Elegir imagen» o «Cambiar imagen» y «Quitar», con el tipo y el tamaño comprobados antes de subir.
- **Úsalo cuando** un campo guarda una sola imagen y la página la sube con su propia `upload(file)`.
- **No lo uses cuando** hacen falta varias imágenes o adjuntos: aún no hay componente, y se avisa antes de crear uno.
- **API:** `v-model` (`{ id, url }` o `null`), `label`, `upload(file)` (sube y devuelve la imagen guardada), `accept`, `maxBytes` (5 MB), `disabled`, `testid`.
- **Ionic:** `ion-item`, `ion-thumbnail`, `ion-label`, `ion-note`, `ion-button`, `ion-spinner`.

## Cifras, importes y fechas

### `formatMoney`, `formatDateTime`, `formatTimeOfDay`, `formatQuantity`, `decimalMark`
`import { formatMoney, formatDateTime, formatTimeOfDay, formatQuantity, decimalMark } from '@erplora/ui/components'`
- **Para qué sirve:** la única forma de enseñar un importe (la unidad menor del servidor, en la moneda del negocio y con los miles siempre agrupados), una fecha y hora, una hora del reloj («6:00 PM», «18:00», la misma que `formatDateTime` escribe tras la fecha) o una cantidad, en el idioma de la persona.
- **Úsalo cuando** cualquier cifra, fecha o importe se pinta en una celda, una ficha o un resumen.
- **No lo uses cuando** se escribe el importe → `MoneyInput`; nunca `Intl` ni `toFixed` a mano en una página.
- **API:** `formatMoney(minor, locale, money?)` (sin `money`, un guion), `formatDateTime(value, locale?, options?)`, `formatTimeOfDay(time, locale)` (`HH:MM` o `HH:MM:SS`; lo que no es una hora, tal cual), `formatQuantity(quantity, locale)`, `decimalMark(locale)`.
- **Ionic:** ninguno.

### `UsageMeter`
`import { UsageMeter } from '@erplora/ui/components'`
- **Para qué sirve:** una barra con etiqueta de cuánto se ha usado de un límite («Almacenamiento · 1,2 GB de 10 GB · 12 %»): verde, ámbar desde el 70 % y roja desde el 90 %.
- **Úsalo cuando** se enseña un consumo frente a su tope (almacenamiento, usuarios del plan).
- **No lo uses cuando** es el avance de una tarea → `ion-progress-bar`; es una cifra sin tope → `UsageCounter`.
- **API:** props `label`, `value` y `max`, o `percent`, `unit`, `tone`, `hint`, `size` (`sm`, `md`), `locale`.
- **Ionic:** ninguno (barra propia con `role="progressbar"`).

### `UsageCounter`
`import { UsageCounter } from '@erplora/ui/components'`
- **Para qué sirve:** una cifra grande con su etiqueta y una pista («Activos ayer 3»), en el formato del idioma de la persona.
- **Úsalo cuando** se ponen cifras de uso junto a un `UsageMeter`, dos o más en fila.
- **No lo uses cuando** es la cifra resumen de un panel de inicio, con tendencia o enlace → `StatCard`.
- **API:** props `label`, `value` (número o texto), `hint`, `locale`.
- **Ionic:** ninguno.

### `StatCard`
`import { StatCard } from '@erplora/ui/components'`
- **Para qué sirve:** la tarjeta de cifra, uno de los ocho tipos de tarjeta: la etiqueta, el valor grande y su icono, con una nota y una tendencia opcionales, en uno de los seis colores de datos (`--ep-data-1` a `--ep-data-6`, los mismos de los gráficos). Con destino, toda la tarjeta es un enlace: un solo foco y un solo toque. Pinta su carga, su vacío (sin valor: «—» y «No hay datos en este periodo») y su error, que conserva su propia acción, «Reintentar». Superficie opaca, nunca cristal.
- **Úsalo cuando** Inicio, un informe o una app enseñan sus cifras. La variante viva (el degradado del tono) es para la fila principal de 2 a 4 cifras: una sola fila, un tono por cifra y nunca dos filas vivas seguidas. La suave (la superficie, con el color en el icono) es para 5 cifras o más y para las filas secundarias. La misma medida lleva el mismo tono en todas las pantallas: Ventas 1, Tickets 2, Ticket medio 3, Mesas 4, Clientes 5, Inventario 6. Un estado (agotado, descuadre) no cambia el tono de la cifra: va aparte, con `status`.
- **No lo uses cuando** son cifras de uso junto a un `UsageMeter` → `UsageCounter`; el resumen de una zona del plano de mesas → `FloorSummary`.
- **API:** props `label`, `value` (el texto ya formateado con `formatMoney` o `formatQuantity`; sin valor, el vacío), `icon` (`juego:nombre` registrado), `tone` (1 a 6; 1 por defecto), `variant` (`soft` por defecto, o `live`), `note`, `trend` (`{ direction: 'up' | 'down' | 'flat', label, tone? }`: lo que sube va en verde y lo que baja en rojo, salvo que `tone` diga otra cosa), `status` (`{ tone: 'success' | 'warning' | 'danger', label }`: lo que le pasa a la cifra, «Agotado», «Descuadre»; es un `StatusPill` de ese tono con su icono, un círculo con visto, un triángulo o un círculo con exclamación, en la fila de abajo en lugar de la tendencia; el lector de pantalla lee su texto; solo con la cifra cargada; en la viva, la etiqueta lleva debajo la superficie de la tarjeta), `sparkline` (los últimos valores de la cifra, del más antiguo al más reciente: la minigráfica, una línea al pie de la tarjeta en su color, sin ejes y oculta al lector de pantalla, que ya lee la cifra y la tendencia; solo con la cifra cargada), `to`, `loading`, `error`, `emptyLabel`, `testid`; evento `retry`. Mientras carga y con error la tarjeta no abre nada, y la variante viva solo pinta una cifra: los demás estados van en la superficie. La fila es un `div` con la clase `ep-stat-grid`: cuatro tarjetas por fila a lo ancho y dos en la tableta y el teléfono. El aspecto vive en `src/shell/theme/stat-card.css`, que carga `createShell`, y el brandbook lo enseña con esa misma hoja.
- **Ionic:** `ion-skeleton-text` (la carga) e `ion-button` (Reintentar), con `HubIcon`, `StatusPill` (el estado), `RouterLink` y las clases `ep-surface` y `ep-icon-tile`.

### `BarChart`
`import { BarChart } from '@erplora/ui/components'`
- **Para qué sirve:** valores por etiqueta (días, horas) en barras verticales sobre una escala redonda desde cero, una barra por serie lado a lado, en los colores de datos (`--ep-data-1` a `--ep-data-6`, los de `StatCard`). Con dos series o más, cada una lleva además su forma (rellena, con contorno, discontinua) y una leyenda las nombra; un valor bajo cero cuelga de la línea del cero y uno que falta no se dibuja. Debajo, la descripción en texto; para el lector de pantalla, la tabla con los mismos valores (el dibujo se le oculta). Pinta su carga, su vacío y su error con «Reintentar». SVG y CSS, sin librería.
- **Úsalo cuando** un informe o un panel compara importes o recuentos por día, semana o categoría, y hasta seis series.
- **No lo uses cuando** son valores a lo largo del tiempo continuo (horas de un día, días de un mes) → `LineChart`; un ranking de nombres con su valor → `BarList`; una sola cifra con su evolución → `StatCard` con `sparkline`.
- **API:** props `labels`, `series` (`{ label, values: (número o null)[], tone? }[]`: sin `tone`, la primera es la serie 1, la segunda la 2…; seis como mucho, más se agrupan antes en «Otros»), `description` (obligatoria: el pie y el nombre de la tabla), `format` (escribe los valores del eje y de la tabla, p. ej. `(v) => formatMoney(v, locale, money)`; por defecto, un número en el idioma de la persona), `loading`, `error`, `emptyLabel`, `testid`; evento `retry`. El aspecto vive en `src/shell/theme/charts.css`, que carga `createShell`, y el brandbook lo enseña con esa misma hoja.
- **Ionic:** `ion-skeleton-text` (la carga) e `ion-button` (Reintentar), con `InlineFeedback` para el error.

### `LineChart`
`import { LineChart } from '@erplora/ui/components'`
- **Para qué sirve:** valores por etiqueta en líneas sobre una escala redonda desde cero, cada punto sobre el centro de su etiqueta; la primera serie lleva un sombreado suave hasta el cero y cada serie siguiente su propio trazo (discontinuo, punteado) además de su color, con una leyenda. Un valor que falta corta la línea. Descripción, tabla para el lector de pantalla y estados, como `BarChart`.
- **Úsalo cuando** se sigue una medida a lo largo del tiempo (las ventas por hora de hoy frente al mismo día de la semana anterior).
- **No lo uses cuando** se comparan categorías sueltas → `BarChart` o `BarList`.
- **API:** las mismas props y el mismo evento que `BarChart`.
- **Ionic:** como `BarChart`.

### `BarList`
`import { BarList } from '@erplora/ui/components'`
- **Para qué sirve:** una lista ordenada de nombres, cada uno con su valor escrito y una barra tan larga como su parte del mayor (un valor bajo cero, por su tamaño y en rojo). La lista con nombres y valores es lo que lee el lector de pantalla; las barras son solo para la vista.
- **Úsalo cuando** se enseña un reparto o un ranking: ventas por canal, productos más vendidos, descuadres por caja.
- **No lo uses cuando** los valores van por días u horas → `BarChart` o `LineChart`; es el consumo frente a un tope → `UsageMeter`.
- **API:** props `items` (`{ label, value: número o null, text, tone? }[]`: `text` es el valor ya formateado por la página; sin valor, sin barra), `tone` (el de las filas que no piden uno; 1 por defecto), `description` (opcional, el pie), `loading`, `error`, `emptyLabel`, `testid`; evento `retry`.
- **Ionic:** como `BarChart`.

## Estados y avisos

Hay tres tipos de aviso. Regla para elegir: se resuelve solo → toast; exige una acción y persiste → centro de avisos;
habla de un sitio concreto de la pantalla → en línea.

### `EmptyState`
`import { EmptyState } from '@erplora/ui/components'`
- **Para qué sirve:** decir que no hay datos, con un icono, un título, una frase y la acción para empezar.
- **Úsalo cuando** una pantalla o una sección aún no tiene nada que enseñar.
- **No lo uses cuando** la lista ya es un `DataTable` (su `emptyMessage` o su slot `empty`); no se pudo cargar → `InlineFeedback`.
- **API:** props `icon`, `heading`, `message`; slot `action` (bajo el texto, normalmente un `ion-button`) y slot por defecto.
- **Ionic:** `ion-icon`.

### `toast`, `toastSuccess`, `toastError`, `toastWarning`, `toastInfo`, `dismissToast`
`import { toastSuccess, toastError, toast, dismissToast } from '@erplora/ui/shell'` (y `toastWarning`, `toastInfo`)
- **Para qué sirve:** aviso efímero de una acción (guardado, error, información pasajera). La pantalla solo pasa datos (`message`, `tone`, `duration`, `id`, `action`); nunca se monta un `ion-toast` ni se usa `toastController` directo.
- **Úsalo cuando** «Guardado», «No se pudo enviar» o un aviso con una acción («Deshacer») después de una orden.
- **No lo uses cuando** el aviso solo tiene sentido junto a lo que afecta → `InlineFeedback`; exige una acción hasta resolverse → el centro de avisos (`useActionCenter`).
- **API:** síncronas. `toast({ message, tone?, duration?, id?, action?: { label, run }, position?: 'bottom' | 'top' })` devuelve el id; `toastSuccess`, `toastError`, `toastInfo` y `toastWarning(message, options?)`; `dismissToast(id)` devuelve `false` si ya no estaba. Tonos `success`, `error`, `info` (por defecto) y `warning`; dura 3 s (éxito e info), 4 s (aviso) o 5 s (error), `duration: 0` lo deja fijo hasta cerrarlo y el mismo `id` sustituye al anterior.
- **Ionic:** `ion-button` (acción y cerrar), no `ion-toast`: los pinta la pila que el shell monta una sola vez, abajo y arriba en el centro: una píldora de cristal con el más nuevo delante y hasta dos asomando detrás, que con el ratón, el foco o un toque se despliega en lista y para sus tiempos, y que se descarta deslizándola. Caben tres a la vista en cada borde. Con los tres ocupados, uno nuevo cierra el más antiguo de los que se van solos (con tiempo y sin acción), primero uno que no sea error, y uno que no es error nunca cierra un error. Si no hay ninguno que cerrar, un error entra igualmente y devuelve a la espera, con el tiempo que le quedaba, al más antiguo, primero uno que no sea error; cualquier otro aviso espera su turno, así que con los tres fijos o con acción uno que no es error espera. Cuando se libera un sitio entra primero el error que espera.

### `useActionCenter`, `useQuietActionNotices`, `connectActionCenter`
`import { useActionCenter, useQuietActionNotices } from '@erplora/ui/shell'`
- **Para qué sirve:** avisos permanentes que exigen que el usuario haga algo y siguen siendo verdad al recargar (factura sin pagar, datos fiscales que faltan). La app entrega una fuente de `ActionNotice`; no monta campana, tira fija ni banner propios. La campana los resume y abre su panel; un aviso nuevo llega como tarjeta bajo la barra superior.
- **Úsalo cuando** el proyecto da la fuente de sus avisos a `createShell({ actionNotices })`: el shell pinta la campana en `AppTopbar`, la tarjeta de llegada y el panel. `useQuietActionNotices` silencia las llegadas del centro de avisos mientras hay un flujo delicado abierto (el cobro).
- **No lo uses cuando** confirma lo que la persona acaba de hacer → `toast`; solo tiene sentido junto a lo que afecta → `InlineFeedback`.
- **Piezas internas:** la campana (`ActionBell`), la tarjeta de llegada y el panel son piezas internas del centro de avisos y no se exportan; las monta el shell. Una app no las usa directamente.
- **API:** `actionNotices: () => ({ notices, failed, retry? })`, con avisos `{ id, severity, icon, label, title, body?, figure?, chip?, count?, due?, action?, secondary? }`, `severity` `danger`, `warning` o `info` y acciones `{ label, to | href | run }`; `useQuietActionNotices(active)`: mientras `active`, un aviso nuevo no tapa la pantalla y solo late la campana; `useActionCenter()` lee su estado y lo abre (`total`, `openPanel(id?)`…); `connectActionCenter(source)` lo llama el shell, no una pantalla.
- **Ionic:** `ion-button`, `ion-badge` e `ion-chip` en la campana; `ion-modal`, `ion-list` e `ion-item` en el panel.

### `InlineFeedback`
`import { InlineFeedback } from '@erplora/ui/components'`
- **Para qué sirve:** aviso contextual, pegado a un campo o a un bloque de la pantalla (validación, error de carga de una sección). No para confirmaciones ni para avisos globales.
- **Úsalo cuando** tiene que seguir visible mientras dure lo que dice: un error de carga con «Reintentar», un rechazo, una advertencia.
- **No lo uses cuando** confirma lo que la persona acaba de hacer → `toast`; exige una acción hasta resolverse → el centro de avisos (`useActionCenter`); pregunta algo → `useConfirm`.
- **API:** props `tone` (`info`, `success`, `warning`, `danger`, `neutral`), `heading`, `icon`, `dismissible` (evento `dismiss`), `role` (`status`, `alert`); slot por defecto y slot `actions`.
- **Ionic:** `ion-icon`.

### `ConfirmDialog`, `useConfirm`
`import { ConfirmDialog, useConfirm } from '@erplora/ui/components'`
- **Para qué sirve:** pedir confirmación antes de una acción, con el aspecto de los demás diálogos; `useConfirm` es el atajo: `await confirm({ … })` devuelve `true` o `false`.
- **Úsalo cuando** se borra, se cancela o se hace algo irreversible; `ConfirmDialog` si el diálogo espera a la acción (`pending`, `error`) o pide escribir un texto (`requireText`).
- **No lo uses cuando** hay que rellenar campos → `FormModal`; solo se avisa → `toast` o `InlineFeedback`.
- **API:** `useConfirm().confirm({ title, message, tone, confirmLabel, consequences, requireText })`; el componente: `v-model:open`, `title`, `message`, `tone` (`danger`, `warning`, `primary`), `confirmLabel`, `consequences`, `requireText`, `pending`, `error`; eventos `confirm` (no cierra) y `cancel`.
- **Ionic:** `ion-modal` (es un `FormModal` con `role="alertdialog"`, no un `ion-alert`), `ion-input`.

### `StatusPill`
`import { StatusPill } from '@erplora/ui/components'`
- **Para qué sirve:** el estado de un registro en una etiqueta corta del color de su significado, con un punto que late si está en curso.
- **Úsalo cuando** el estado va en una celda, una ficha o una tarjeta; los de negocio y factura del panel salen hechos con `businessStatusPill` e `invoiceStatusPill`.
- **No lo uses cuando** es una etiqueta sin estado (categoría, filtro) → `ion-chip`; el aviso necesita una frase → `InlineFeedback`.
- **API:** props `label`, `tone` (`success`, `info`, `warning`, `danger`, `neutral`), `dot`, `busy`, `size` (`sm`, `md`), `icon` (`juego:nombre` registrado: se pinta antes del texto en lugar del punto, como forma además del color, y el lector de pantalla no lo lee); slot por defecto en lugar de `label`. Sobre un fondo de color (una tarjeta de cifra viva), la página da con `--status-pill-surface` la superficie sobre la que va el tinte, para que se lea igual que sobre una tarjeta.
- **Ionic:** ninguno (HTML con los tokens `--ep-*`, contraste AA comprobado).

### `ReportProblemModal`
`import { ReportProblemModal } from '@erplora/ui/components'`
- **Para qué sirve:** «Informar de un problema» en un diálogo, sin salir de la app, con los textos y límites de la página del SaaS; al cerrarlo sin enviar guarda el borrador.
- **Úsalo cuando** la entrada «Informar de un problema» de un menú del Hub o del SaaS.
- **No lo uses cuando** es el formulario de otra cosa → `FormModal`.
- **API:** `v-model:open` y `send(report)`, con el que la página llama a su operación.
- **Ionic:** `ion-modal` (vía `FormModal`), `ion-input`, `ion-textarea`, `ion-button`.

## Identidad e iconos

### `UserAvatar`
`import { UserAvatar } from '@erplora/ui/components'`
- **Para qué sirve:** el avatar redondo de una persona: su foto o sus iniciales sobre un tono que es siempre el mismo para ella.
- **Úsalo cuando** la persona aparece en la cabecera de la barra lateral, en su perfil o en las filas de miembros.
- **No lo uses cuando** es el icono de una app o de una cosa → `HubIcon`; es la imagen de un producto → `ion-thumbnail`.
- **API:** props `name`, `email`, `src`, `size` (`sm`, `md`, `lg`, `xl`), `tone`, `decorative`.
- **Ionic:** ninguno.

### `HubIcon`
`import { HubIcon } from '@erplora/ui/shell'`
- **Para qué sirve:** pinta un icono horneado de cualquier juego (`ion:`, `lucide:`, `mdi:`, `material-symbols:`) a través de `ion-icon`, sin pedir nada a la red.
- **Úsalo cuando** cualquier icono de una plantilla; el nombre tiene que estar registrado en `src/shell/icons.ts` (los Ionicons) o en `src/shell/set-icons.ts` (los demás juegos).
- **No lo uses cuando** es un logotipo, una foto o una ilustración → `<img>`; nunca un SVG suelto.
- **API:** props `name` (`juego:nombre`), `label` (lo hace imagen con nombre accesible; sin él es decorativo), `decorative`; admite `slot` y `color` de Ionic.
- **Ionic:** `ion-icon`.

## Marco de página

### `AppPage`
`import { AppPage } from '@erplora/ui/shell'`
- **Para qué sirve:** el marco de toda pantalla: la barra superior con título, Atrás y acciones, un solo `ion-content` con los márgenes del shell y las pestañas de sección abajo.
- **Úsalo cuando** siempre, como raíz de cada página de una app del Hub o del panel del SaaS.
- **No lo uses cuando** el contenido va en un diálogo → `FormModal`; nunca un `ion-page` o `ion-header` propios en una pantalla normal.
- **API:** props `title`, `backHref` (enseña Atrás: vista de detalle), `contentLayout` (`fluid`, `detail`, `detail-fill`, `fill` para una lista `DataTable fill`), `headingOnScreen`, `tabs` con `v-model:tab`, `tabsLabel`; slots por defecto, `actions` (en la barra; en el teléfono, al «⋮» de `AppTopbar` cuando no caben) y `footer`.
- **Ionic:** `ion-page`, `ion-content`, `ion-footer`, `ion-toolbar`, `ion-segment`, con `AppTopbar`.

### `AppTopbar`, `useTopbarMenu`
`import { AppTopbar, useTopbarMenu } from '@erplora/ui/shell'`
- **Para qué sirve:** la barra superior del shell: el botón del menú (solo donde el shell pinta el menú lateral; sin sesión, o en una pantalla con su propio marco, queda oculto), título, sección, Atrás, las acciones de la vista, «Mis apps» (con la barra lateral del Hub), la pieza de barra del proyecto (`chrome.topbar` de `createShell`, el botón del asistente) y la campana del centro de avisos (con `createShell({ actionNotices })`). En el teléfono (hasta 767 px) la derecha lleva como mucho dos botones y la campana es uno de ellos. A cualquier ancho el título ocupa lo que pide su texto y queda centrado mientras cabe; solo se corta con «…» cuando llega a los botones.
- **El «⋮»:** el «⋮» único de la barra en el teléfono. Cuando las acciones de la vista, «Mis apps» y la pieza del proyecto no caben junto a la campana, o la vista trae dos o más acciones, van todas a él, una fila cada una; una app no pone su propio botón de «más».
- **Úsalo cuando** una vista monta su propio `ion-page` y no puede usar `AppPage`; `useTopbarMenu` solo lo llama la pieza de barra del proyecto.
- **No lo uses cuando** es una pantalla normal → `AppPage`, que ya la pinta.
- **API:** props `title`, `section`, `backHref`, `titleIsHeading`; slot `actions`. `useTopbarMenu()` devuelve el menú cuando la pieza está listada en el «⋮» (`undefined` en la barra): la pieza se pinta entonces como fila con su nombre y abre lo suyo con `closeThen(action)`, que espera a que el menú se haya ido.
- **Ionic:** `ion-header`, `ion-toolbar`, `ion-buttons`, `ion-menu-button`, `ion-title`, `ion-button`, `ion-popover`.

### `WebOnly`, `vWebOnly`
`import { WebOnly, vWebOnly } from '@erplora/ui/shell'`
- **Para qué sirve:** enseñar lo que vende (precios, cambiar de plan, pagar) solo en la web; en la app ni llega al DOM y el slot `app` dice cómo hacerlo desde un navegador.
- **Úsalo cuando** un bloque de compra o de pago está en una pantalla que también se ve dentro de la app.
- **No lo uses cuando** es una ruta entera → `meta.webOnly` de la ruta; un solo elemento que debe seguir en el DOM → la directiva `v-web-only`.
- **API:** slots por defecto (solo en la web) y `app` (solo en la app); `v-web-only` lo muestra u oculta como `v-show`.
- **Ionic:** ninguno.

## Plano de mesas

Son piezas de presentación: reciben cada mesa con sus textos ya escritos en el idioma de la persona (`FloorTable`:
número, estado, plazas, reserva, tiempo, el importe de la cuenta de una mesa ocupada, si se ha pedido una de sus cuentas y
la frase entera para un lector de pantalla) y avisan de la que se elige; los
datos y las órdenes son de la app. `FLOOR_STATUS_ICONS` y `FLOOR_STAT_ICONS` dan el icono de cada estado y de cada cifra.
Una mesa ocupada con `billRequested` (la marca es de una de sus cuentas, no de la mesa) se pinta de un color propio,
`--ep-bill-requested` (el violeta de la tercera serie de datos y, con la paleta «Violeta», cuyo primario también es
violeta, el verde azulado de la cuarta), lejos del de cualquier otro estado y del ámbar y el rojo del tiempo en todas las
paletas, en claro y en oscuro; el plano y la tarjeta del teléfono usan ese mismo token. Su estado lleva el icono
de la cuenta (`ion:receipt-outline`) en lugar del suyo; el texto lo escribe la página: «Cuenta pedida» en `statusLabel`,
`caption` y `accessible`. En una mesa libre, reservada o bloqueada la marca no pinta nada.

### `TableGlyph`
`import { TableGlyph } from '@erplora/ui/components'`
- **Para qué sirve:** el dibujo de una mesa cuadrada, redonda o rectangular: una silla por plaza alrededor (en una mesa alargada, en sus lados largos), llenas según los comensales (en proporción por encima de doce plazas), y en una mesa ocupada el arco del tiempo que lleva. Es decorativo: el nombre lo dice quien lo contiene.
- **Úsalo cuando** una mesa se dibuja fuera del plano, como en el selector de mesas del TPV; `variant="mini"` dibuja también la mesa en su forma y su estado.
- **No lo uses cuando** la mesa va en el plano → `FloorTile`, que ya la dibuja; en el teléfono → `FloorCards`.
- **API:** props `table` (`FloorGlyphTable`: `status`, `shape`, `capacity`, `guests`, `ratio`, `tone`, `progress` de 0 a 100 y `billRequested` opcional, que en una mesa ocupada pinta la mesa, las sillas y el arco del color de la cuenta pedida, salvo el ámbar y el rojo del tiempo) y `variant` (`plan`, `mini`).
- **Ionic:** ninguno (HTML y SVG con los tokens del tema).

### `FloorTile`
`import { FloorTile } from '@erplora/ui/components'`
- **Para qué sirve:** la mesa del plano, en su sitio y a su tamaño: el número y una línea dentro (el tiempo, la hora de la reserva o el estado), las sillas y el arco alrededor, y debajo su etiqueta, de dos líneas como mucho: el estado con las plazas y, en la siguiente, el importe de la cuenta de una mesa ocupada y la reserva si la hay, que corta un nombre largo con puntos suspensivos y nunca el importe ni la hora (una tercera línea llegaría a la mesa de debajo). Con la cuenta pedida, la mesa entera va del color de la cuenta pedida y su estado lleva el icono de la cuenta, sin quitar el número, el tiempo, los comensales ni el importe. Es la pieza que se arrastra al editar el plano: queda fuera de los tipos de tarjeta.
- **Úsalo cuando** se pinta el plano de una zona en tableta y escritorio.
- **No lo uses cuando** es el teléfono → `FloorCards`; la mesa se dibuja sin plano → `TableGlyph`.
- **API:** props `table` (`FloorTable`; su `amount` opcional es el importe ya escrito con `formatMoney` y solo se pinta en una mesa ocupada: libre, reservada, bloqueada o sin dato, no pinta nada; su `billRequested` opcional, igual, solo en una mesa ocupada, que lleva entonces `data-bill="requested"`), `box` (`FloorBox`: `x`, `y`, `width`, `height` en px y `slot`, el ancho de su sitio y el límite de su etiqueta), `inactiveLabel` (la apaga en gris con su nota), `editing` (se agarra para moverla), `dragging` (levantada mientras se arrastra). Mientras se elige un destino, `table.pickable` la marca (`true`) o la atenúa y la deja fuera de alcance (`false`). No emite eventos: el plano escucha el toque, el teclado y el arrastre sobre ella.
- **Ionic:** ninguno (un `<button>` propio por mesa), con `TableGlyph` y `HubIcon`.

### `FloorCards`, `FloorCard`
`import { FloorCards } from '@erplora/ui/components'` (y `FloorCard`, la tarjeta suelta)
- **Para qué sirve:** las mesas en el teléfono, dos por fila y ordenadas por número, en una lista con nombre. Cada `FloorCard` es una baldosa táctil: una superficie con un único toque, sin botones ni acciones dentro, con el dibujo de la mesa, el número con sus plazas o su reserva y el estado escrito con su tiempo y, en una mesa ocupada, el importe de su cuenta (si no cabe al lado, baja debajo del tiempo); borde del color de su estado (discontinuo si está reservada) y contorno primario cuando es destino. Con la cuenta pedida, el número, el estado (con el icono de la cuenta delante) y el borde van del color de la cuenta pedida.
- **Úsalo cuando** el plano de mesas se ve en un teléfono.
- **No lo uses cuando** hay sitio para el plano → `FloorTile`; la tarjeta es de otra cosa: aún no hay baldosa táctil genérica, y se avisa antes de maquetar una.
- **API:** `FloorCards`: props `tables` (`FloorTable[]`) y `label` (el nombre de la lista); eventos `select(id)` y `actions(id)`. `FloorCard`: prop `table` (su `amount` y su `billRequested`, como en `FloorTile`); evento `select(id)` al tocarla y `actions(id)` al mantenerla pulsada (también con el clic derecho o la tecla de menú: el evento `contextmenu`, sin el menú del navegador); ninguno de los dos sale de una mesa con `pickable: false` (atenuada y anunciada como no disponible, nunca apagada).
- **Ionic:** `ion-card` con `button` (al menos 112 px de alto, superficie opaca y nunca cristal), con `TableGlyph`.

### `FloorSkeleton`
`import { FloorSkeleton } from '@erplora/ui/components'`
- **Para qué sirve:** lo que ocupa el sitio del plano mientras carga: mesas de las dos formas con brillo, o en el teléfono tarjetas dos por fila, con un nombre para el lector de pantalla.
- **Úsalo cuando** el plano o sus tarjetas aún no han llegado.
- **No lo uses cuando** la carga es de una lista → el `loading` de `DataTable`; no se pudo cargar → `InlineFeedback`.
- **API:** props `label` (lo que se anuncia) y `variant` (`plan`, `cards`).
- **Ionic:** `ion-skeleton-text`.

### `FloorSummary`
`import { FloorSummary } from '@erplora/ui/components'`
- **Para qué sirve:** el resumen de una zona: su nombre en su color, cuántas mesas están ocupadas y cada cifra (libres, ocupadas, reservadas, comensales) con su icono.
- **Úsalo cuando** encabeza el plano de la zona elegida.
- **No lo uses cuando** son cifras de uso de un plan → `UsageCounter`.
- **API:** props `label` (el nombre de la sección), `title`, `subtitle`, `color` (el nombre de un color de Ionic; sin él, `primary`), `stats` (`FloorStat[]`: `key`, `value`, `label`). `zoneColor(color)` da el color CSS de una zona.
- **Ionic:** ninguno; `HubIcon`.

### `FloorZoneTabs`
`import { FloorZoneTabs } from '@erplora/ui/components'`
- **Para qué sirve:** las pestañas de las zonas del plano, cada una con un punto de su color y sus mesas ocupadas sobre las que están en servicio; la tira se desplaza y difumina el borde que tiene más zonas detrás.
- **Úsalo cuando** el plano tiene más de una zona y se elige cuál ver.
- **No lo uses cuando** son las secciones de una pantalla → `tabs` de `AppPage`.
- **API:** props `zones` (`FloorZoneTab[]`), `active` (el id o `null`), `label`; evento `change(zoneId)`. `useScrollEdges(element)` dice qué bordes de una caja con desplazamiento tienen más contenido detrás, para el mismo difuminado, y los vuelve a medir por sí mismo cuando la caja se desplaza, cambia de tamaño o cambia lo que lleva dentro (pestañas que llegan después de pintarla o que crecen al dibujarse).
- **Ionic:** `ion-segment` desplazable, `ion-segment-button`, `ion-label`.

## Vídeo

### `YouTubeEmbed`
`import { YouTubeEmbed } from '@erplora/ui/components'`
- **Para qué sirve:** un vídeo de YouTube que no pide nada a Google hasta pulsarlo: antes solo pinta un póster propio, con el título, la duración y el aviso de que se carga desde YouTube (el botón de reproducir, centrado mientras el título cabe encima y debajo de él cuando no, nunca lo tapa); al pulsar, el reproductor `youtube-nocookie` en línea, con todos sus controles y la pantalla completa, a todo el ancho y en 16:9. Su logo y su título abren el vídeo en YouTube en otra pestaña, nunca en la ventana de la app. Con `language`, los subtítulos salen encendidos en ese idioma y el reproductor habla en él. Sin conexión enseña una tarjeta en su lugar, y un id que no es de YouTube no pinta nada.
- **Úsalo cuando** un vídeo explicativo va dentro de una página o de una ventana de ayuda.
- **No lo uses cuando** el vídeo no está en YouTube: aún no hay componente, y se avisa antes de crear uno.
- **API:** props `videoId` (los 11 caracteres de YouTube), `title` (el del póster y el nombre del reproductor), `duration` (como la escribe la página, «2 min»), `icon`, `language` (el código de idioma de la persona, `es` o `pt-BR`; lo que no es un código de idioma no llega al reproductor).
- **Ionic:** ninguno (botón propio y un `iframe` con sandbox), con `HubIcon`.

## Asistente

El host lo configura una vez al arrancar (`configureAssistant`) y suma `assistantMessages` a sus catálogos de textos.

Cada dato de la tarjeta que aprueba una escritura (`AssistantField`) puede traer `choice`, un valor de una lista cerrada («Claro», «50 m»): la línea de una acción normal lo dice siempre con el nombre de su dato delante, también el primero («Apariencia: Claro»), porque suelto no dice qué cambia.

El `done` de cada ronda que manda el host puede traer `sources`, las direcciones web que consultaron sus propias herramientas (en el Hub y en el SaaS, la búsqueda en la web y los tipos de cambio). Una dirección de la respuesta que no sale de ahí, de un resultado del turno ni de la pregunta lleva, fuera de la burbuja, el aviso de una dirección web no consultada, como el de un identificador no leído; sin `sources`, las direcciones no se comprueban.

### `AssistantPanel`
`import { AssistantPanel } from '@erplora/ui/components'`
- **Para qué sirve:** el chat del asistente, el mismo en el Hub y en el SaaS: a la derecha desde 768 px y a pantalla completa en el teléfono, con dictado, lectura en voz alta y la tarjeta que aprueba cada escritura.
- **Úsalo cuando** el host lo monta una sola vez junto al panel del shell, mientras hay una sesión.
- **No lo uses cuando** una pantalla quiere su propio chat: hay un solo asistente por pestaña, que se abre con `AssistantButton` o `useAssistant()`.
- **API:** slot `empty` con `{ setup, ask }` para la bienvenida; lo demás sale de `configureAssistant`. Con `toolFiles` (`AssistantToolFile`: terminación, tipo, tamaño máximo y clave del aviso, con los textos del host) el adjuntar acepta además los ficheros que una herramienta del host recibe tal cual (en el Hub, la copia de un negocio, `.blueprint.zip`), con su propio tope; sin él, solo lo que lee erplora.com. Con `imageNames` el turno del host recibe cada imagen adjunta con su nombre (`filename`, junto a `image_url`), para que sus herramientas puedan guardarla entera (en el Hub, en Archivos): su servidor se la nombra al modelo y la manda a erplora.com sin ese campo; sin él, la imagen va como la toma erplora.com, sin nombre. Cada fila `executed` del turno que manda el host puede traer `reason`, el motivo de un fallo por el idioma en que se dijo (`{ es: '…' }`): el recibo lo añade tras «No se hizo, falló: …» solo leído en ese idioma; sin él, el recibo queda como siempre. Una fila `executed` puede traer también `file` (`HandedFile`: `filename`, `content_type` y `content`), el fichero entero que da una lectura del host (en el Hub, el CSV de una exportación): bajo la respuesta sale «Descargar {nombre}», que lo entrega a `saveFile` del host con el `t` del panel, para sus avisos (en el Hub, las descargas del navegador o las de su app); la historia de la pestaña guarda solo su nombre, y tras recargar dice que ya no está y que se pida otra vez. Sin `saveFile`, el chat no ofrece ningún fichero.
- **Ionic:** `ion-button`, `ion-select`.

### `AssistantButton`
`import { AssistantButton } from '@erplora/ui/components'`
- **Para qué sirve:** el botón de la barra superior que abre y cierra el asistente; solo aparece si el host deja usarlo.
- **Úsalo cuando** en la pieza de barra del proyecto (`chrome.topbar` de `createShell`).
- **No lo uses cuando** se quiere abrir desde una pantalla → `useAssistant()`.
- **API:** sin props.
- **Ionic:** `ion-button`.

### `AssistantEmpty`
`import { AssistantEmpty } from '@erplora/ui/components'`
- **Para qué sirve:** la bienvenida del chat vacío: una frase y atajos que se preguntan al pulsarlos.
- **Úsalo cuando** el host rellena el slot `empty` de `AssistantPanel` con sus palabras y sus atajos.
- **No lo uses cuando** es el estado vacío de una pantalla → `EmptyState`.
- **API:** props `text`, `shortcuts`; evento `ask(text)`.
- **Ionic:** ninguno; `HubIcon`.

### `AssistantMarkdown`
`import { AssistantMarkdown } from '@erplora/ui/components'`
- **Para qué sirve:** un texto en Markdown (negrita, cursiva, código, títulos, listas, tablas en su propia caja con desplazamiento, citas y separadores) pintado con elementos de Vue, nunca con `v-html`: nada de lo que trae el texto llega a ser HTML. Un enlace solo lleva a una pantalla que la app sirve, con el nombre que le da el menú si no trae texto; cualquier otra ruta queda como texto.
- **Úsalo cuando** un texto con formato que enlaza a pantallas de la app se enseña fuera del chat, como en la ayuda.
- **No lo uses cuando** es el chat del asistente → `AssistantPanel`, que ya lo usa en cada respuesta; un texto sin formato → un párrafo.
- **API:** props `text`, `screenExists(path)` y `nameOf(path)`; evento `go(path)`, con el que la página navega.
- **Ionic:** ninguno.

## Clases de la comanda

La comanda es uno de los tipos de tarjeta, con un componente en cada app que la enseña (la pantalla de cocina, las
comandas del TPV): comparten el aspecto, no el contrato. El aspecto vive aquí, como clases que el shell carga con el tema
(`src/shell/theme/order-ticket.css` y `order-board.css`, desde `createShell`); la app no importa nada ni lleva `<style>`
propio, solo pone las clases sobre las piezas de Ionic.

- **`ep-order-ticket`:** la tarjeta. El `article` lleva `data-sem` (`ok`, `warning`, `critical`) y pinta la franja de
  arriba según la espera; su `ion-card` va con `ep-surface`, opaca y nunca de cristal. Dentro: la cabecera (`__head`,
  `__headline`, `__icon`, `__title`, `__label`, `__waiter`, `__clock`, `__timer`, `__wait`, `__number`, `__flags`,
  `__pill` sobre `StatusPill`), el cuerpo (`__body`, `__notes`), el menú (`__menu` y sus partes), cada plato (`__dish`
  con `data-status`, `__dish--menu`, `__qty`, `__dish-body`, `__name`, `__allergy`, `__modifiers`, `__dish-note`,
  `__void`, `__meta`, `__state`) y el pie (`__foot`, `__step`, `__more`). En la cabecera, `__label` pone el destino en
  grande en su propia línea y `__waiter` va debajo, aparte; ambos ajustan primero por palabras enteras. En la cabecera
  del menú, `__menu-label` pone el nombre (`__menu-name`) a un lado y cuántos platos lleva (`__menu-count`) al otro, o
  debajo si no caben juntos. En el plato, `__allergy` es el aviso en línea de la alergia del cliente, en rojo y antes de
  los suplementos: su icono (`__allergy-icon`), la alergia en un `strong` y, si el plato lleva alguno de esos alérgenos,
  `__allergy-contains` debajo; la marca «Alergia» de la cabecera es un `__pill` más. `ep-order-ticket-steps` es el
  `ion-popover` de los demás pasos, y `ep-station-dot` el color de una estación delante de su nombre.
- **`ep-order-board`:** la rejilla de comandas, y alrededor la barra fija con las vistas y las estaciones
  (`ep-order-board-bar`), la tabla de lo que queda por hacer (`ep-order-board-totals`) y las comandas grises mientras
  carga (`ep-order-board-skeleton`). La barra se pega al borde de arriba de la caja que se desplaza, por encima de su
  relleno, para que ninguna comanda asome sobre ella: lee el relleno de arriba del `ion-content` (`--padding-top`), y
  otra caja que se desplace (el tablero solo en pantalla completa) declara el suyo en esa misma variable.
- **Úsalo cuando** una app enseña comandas; la cabecera de cada hoja lista sus clases.
- **No lo uses cuando** la tarjeta es de otro tipo: la fila de una lista es la del `DataTable`, y la mesa es `FloorCard`.

## Fuera del catálogo

`@erplora/ui/shell` exporta también el arranque del shell (`createShell`, rutas, sesión, tema, superficie, avisos e
impresora del dispositivo, `useMyApps`), que no pinta pantallas; los datos van por `@erplora/ui/sdk` (`useLive`,
`useCommand`). Los tipos y las constantes de cada componente se importan del mismo sitio que el componente.

## Lo que aún no existe

Las tarjetas de entidad, la baldosa táctil genérica y el panel de ajustes están en diseño. La fila como tarjeta ya existe: es la tarjeta del propio `DataTable`, y no se monta a mano; la tarjeta de cifra es `StatCard`. De la baldosa
táctil (una superficie, un único toque) ya existe la de la mesa en el teléfono, `FloorCard`; la mesa que se arrastra en
el plano, `FloorTile`, no es un tipo de tarjeta. Mientras no existan, no se maqueta una tarjeta
nueva a mano sin avisarlo en la issue o en la PR, para que entre en el diseño de la pieza común.

## Reglas

- Los componentes compartidos se construyen sobre componentes de Ionic, personalizados con sus variables CSS y
  `::part`, y con los tokens `--ep-*` del tema; nada de colores ni medidas sueltas.
- `.ep-glass` (tokens `--ep-glass-*`): material de cristal solo para superficies flotantes; se apaga con la preferencia
  «Efectos de transparencia». Es la clase de `src/shell/theme/glass.css`; en un overlay de Ionic, sus tokens van en
  `::part(content)` o en `--background`, y un componente no declara cristal propio.
- Los huecos de un texto con lo que le sigue los da el tema (`src/shell/theme/global.css`), y la página no les pone
  margen: un párrafo justo encima de un campo con contorno, o del bloque que el campo abre (un formulario, la envoltura
  de otro componente), deja 14 px, lo que la mayoría de los formularios deja entre dos campos; el texto de una fila
  (`ion-label`) deja el hueco de Ionic con el valor de su final (`ion-note` en `slot="end"`). Una rejilla con `gap` ya
  separa sus textos: su párrafo lleva `margin: 0`, que gana.
- Ningún prefijo `ok-`.
- Una pieza sube a la librería cuando la necesita una segunda app (o el Hub y el SaaS): `src/components/<Nombre>/`,
  con su test, sus textos en `en` y `es`, su export en `src/components/index.ts` y su entrada en este catálogo. Lo que
  solo se repite dentro de una app vive en `apps/<app>/frontend/components/` de esa app.
- Antes de crear un componente en una app se mira este catálogo y los `components/` de la propia app.
- Un componente que ya existe no se copia a otra app: se sube a la librería y se importa.
