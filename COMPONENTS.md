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
- escribir un importe / un color / subir una imagen → `MoneyInput` / `ColorInput` / `ImageUpload`
- enseñar un importe, una fecha o una cantidad → `formatMoney`, `formatDateTime`, `formatQuantity`
- decir que no hay datos → `EmptyState`
- confirmar algo que la persona acaba de hacer → `toastSuccess`, `toastError`…
- un aviso que solo tiene sentido junto a lo que afecta (un error de carga, el rechazo de un formulario) → `InlineFeedback`
- un aviso que exige una acción y sigue siendo verdad hasta que se resuelve → el centro de avisos del shell
  (`createShell({ actionNotices })`, `ActionBell`), nunca un toast ni una caja suelta en la página
- pedir confirmación antes de algo irreversible → `useConfirm` (o `ConfirmDialog`)
- el estado de un registro en una etiqueta de color → `StatusPill`
- cuánto se ha gastado de un límite / una cifra de uso → `UsageMeter` / `UsageCounter`
- informar de un problema sin salir de la app → `ReportProblemModal`
- la persona / un icono → `UserAvatar` / `HubIcon`
- el marco de una pantalla (barra superior, Atrás, acciones, pestañas) → `AppPage`
- algo que solo se enseña en la web (lo que vende) → `WebOnly` / `v-web-only`
- el chat del asistente → `AssistantPanel`, `AssistantButton`, `AssistantEmpty`

## Listas y tablas

### `DataTable`
`import { DataTable } from '@erplora/ui/components'`
- **Para qué sirve:** la lista de registros de una pantalla: búsqueda, filtros por columna, orden, páginas (en el cliente o en el servidor), acciones de fila y selección; lo que no cabe se pliega y en el teléfono pasa a tarjetas.
- **Úsalo cuando** una pantalla lista registros de una entidad; el alta va por `addable` (emite `add` y la página abre su formulario).
- **No lo uses cuando** son unos pocos puntos fijos sin búsqueda ni acciones → `ion-list`.
- **API:** `columns`, `rows`, `rowKey`, `loading`, `error`, `searchable`, `filters`/`filterFields` (tipos `text`, `select`, `date`, `daterange`, `range`, `boolean` y `lookup`, uno entre muchos), `serverSide` con `total`/`page`/`sort`/`maxWindow`, `actions`, `addable`, `rowClickable`, `selectable`, `views`, `fill`, `testid`; slots de celda (el `cell` de cada columna), `card`, `row-actions`, `toolbar`, `filters`, `empty`; eventos `add`, `action`, `rowClick`, `pageChange`, `pageSizeChange`, `sortChange`, `loadMore`, `retry`, `update:search`, `update:filters`.
- **Ionic:** `ion-searchbar`, `ion-select`, `ion-checkbox`, `ion-segment`, `ion-popover`, `ion-card`, `ion-chip`, `ion-button`, `ion-spinner`.

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
- **Para qué sirve:** un formulario corto en un diálogo, con Guardar y Cancelar, su estado de envío y el error del servidor (el mensaje arriba y el de cada campo en el slot).
- **Úsalo cuando** se crea o edita algo de pocos campos sin salir de la pantalla.
- **No lo uses cuando** el formulario de una entidad es largo → una página con `AppPage`; es una pregunta de sí o no → `useConfirm`.
- **API:** `v-model:open`, `title`, `submitLabel`, `pending`, `error`, `size` (`sm`, `md`), `phoneLayout` (`sheet`, `card`), `submitDisabled`, `readonly`, `canDismiss`, `testid`; slot por defecto con `{ fieldErrors, pending }` y slot `footer`; eventos `submit` (no cierra: la página pone `open = false` cuando su orden sale bien) y `cancel`. `useRefusal` mantiene los errores de un rechazo mientras se corrige.
- **Ionic:** `ion-modal`, `ion-header`, `ion-toolbar`, `ion-title`, `ion-buttons`, `ion-button`, `ion-spinner`.

### `SettingsFormFooter`
`import { SettingsFormFooter } from '@erplora/ui/components'`
- **Para qué sirve:** el final del formulario de una página de ajustes: el aviso del rechazo, el aviso de «guardado» y el botón Guardar, apagado sin cambios o mientras guarda.
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

### `MoneyInput`
`import { MoneyInput } from '@erplora/ui/components'`
- **Para qué sirve:** el único campo en el que se escribe un importe: teclado decimal, lee coma o punto y al salir lo reescribe en el formato de la página.
- **Úsalo cuando** un precio, un coste o cualquier importe; `signed` añade el botón ± para los negativos.
- **No lo uses cuando** es una cantidad o un número que no es dinero → `ion-input`; solo se enseña el importe → `formatMoney`.
- **API:** `v-model` (el texto tal cual: al guardar se lee con `parseMoney` y un importe guardado se escribe con `moneyFieldText`), `label`, `testid`, `money` (`{ currency, decimals }`), `signed`, `errorText`, `helperText`, `showError`, `disabled`.
- **Ionic:** `ion-input`, `ion-button`.

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

### `formatMoney`, `formatDateTime`, `formatQuantity`, `decimalMark`
`import { formatMoney, formatDateTime, formatQuantity, decimalMark } from '@erplora/ui/components'`
- **Para qué sirve:** la única forma de enseñar un importe (la unidad menor del servidor, en la moneda del negocio y con los miles siempre agrupados), una fecha y hora o una cantidad, en el idioma de la persona.
- **Úsalo cuando** cualquier cifra, fecha o importe se pinta en una celda, una ficha o un resumen.
- **No lo uses cuando** se escribe el importe → `MoneyInput`; nunca `Intl` ni `toFixed` a mano en una página.
- **API:** `formatMoney(minor, locale, money?)` (sin `money`, un guion), `formatDateTime(value, locale?, options?)`, `formatQuantity(quantity, locale)`, `decimalMark(locale)`.
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
- **No lo uses cuando** es la cifra resumen de un panel de inicio, con tendencia o enlace: aún no existe (ver al final).
- **API:** props `label`, `value` (número o texto), `hint`, `locale`.
- **Ionic:** ninguno.

## Estados y avisos

### `EmptyState`
`import { EmptyState } from '@erplora/ui/components'`
- **Para qué sirve:** decir que no hay datos, con un icono, un título, una frase y la acción para empezar.
- **Úsalo cuando** una pantalla o una sección aún no tiene nada que enseñar.
- **No lo uses cuando** la lista ya es un `DataTable` (su `emptyMessage` o su slot `empty`); no se pudo cargar → `InlineFeedback`.
- **API:** props `icon`, `heading`, `message`; slot `action` (bajo el texto, normalmente un `ion-button`) y slot por defecto.
- **Ionic:** `ion-icon`.

### `InlineFeedback`
`import { InlineFeedback } from '@erplora/ui/components'`
- **Para qué sirve:** un aviso que se queda en el flujo de la pantalla (información, éxito, advertencia o error), con acciones a su lado.
- **Úsalo cuando** tiene que seguir visible mientras dure lo que dice: un error de carga con «Reintentar», un rechazo, una advertencia.
- **No lo uses cuando** confirma lo que la persona acaba de hacer → `toast`; exige una acción hasta resolverse → el centro de avisos (`ActionBell`); pregunta algo → `useConfirm`.
- **API:** props `tone` (`info`, `success`, `warning`, `danger`, `neutral`), `heading`, `icon`, `dismissible` (evento `dismiss`), `role` (`status`, `alert`); slot por defecto y slot `actions`.
- **Ionic:** `ion-icon`.

### `toast`, `toastSuccess`, `toastError`, `toastWarning`, `toastInfo`, `dismissToast`
`import { toastSuccess, toastError, toast, dismissToast } from '@erplora/ui/shell'` (y `toastWarning`, `toastInfo`)
- **Para qué sirve:** el aviso pasajero que confirma lo que la persona acaba de hacer. Lo pinta la pila que el shell monta una sola vez: ninguna pantalla monta un toast.
- **Úsalo cuando** «Guardado», «No se pudo enviar» o un aviso con una acción («Deshacer») después de una orden.
- **No lo uses cuando** el aviso solo tiene sentido junto a lo que afecta → `InlineFeedback`; exige una acción hasta resolverse → el centro de avisos (`ActionBell`); nunca un `ion-toast` ni un `toastController` propios.
- **API:** síncronas. `toast({ message, tone?, duration?, id?, action?: { label, run }, position?: 'bottom' | 'top' })` devuelve el id; `toastSuccess`, `toastError`, `toastInfo` y `toastWarning(message, options?)`; `dismissToast(id)` devuelve `false` si ya no estaba. Tonos `success`, `error`, `info` (por defecto) y `warning`; dura 3 s (éxito e info), 4 s (aviso) o 5 s (error), `duration: 0` lo deja fijo hasta cerrarlo y el mismo `id` sustituye al anterior.
- **Ionic:** `ion-button` (acción y cerrar) dentro de la pila propia del shell; no usa `ion-toast`.

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
- **API:** props `label`, `tone` (`success`, `info`, `warning`, `danger`, `neutral`), `dot`, `busy`, `size` (`sm`, `md`); slot por defecto en lugar de `label`.
- **Ionic:** ninguno (HTML con los tokens `--ep-*`, contraste AA comprobado).

### `ActionBell`, `useActionCenter`, `useQuietActionNotices`, `connectActionCenter`
`import { ActionBell, useActionCenter, useQuietActionNotices } from '@erplora/ui/shell'`
- **Para qué sirve:** el centro de avisos: lo que exige una acción y sigue siendo verdad hasta que se resuelve (una factura sin pagar, una impresora sin conexión, citas por confirmar). La campana lo resume y abre su panel; un aviso nuevo llega como tarjeta bajo la barra superior.
- **Úsalo cuando** el proyecto da la fuente de sus avisos a `createShell({ actionNotices })`: el shell pinta la campana en `AppTopbar`, la tarjeta de llegada y el panel. Una pantalla no monta la tarjeta ni el panel; `ActionBell` a mano solo va en una pantalla con cabecera propia, sin `AppTopbar`.
- **No lo uses cuando** confirma lo que la persona acaba de hacer → `toast`; solo tiene sentido junto a lo que afecta → `InlineFeedback`; nunca una banda ni una caja suelta en la página.
- **API:** `actionNotices: () => ({ notices, failed, retry? })`, con avisos `{ id, severity, icon, label, title, body?, figure?, chip?, count?, due?, action?, secondary? }`, `severity` `danger`, `warning` o `info` y acciones `{ label, to | href | run }`; `useQuietActionNotices(active)`: mientras `active`, un aviso nuevo no tapa la pantalla y solo late la campana (una hoja de cobro); `useActionCenter()` lee su estado y lo abre (`total`, `openPanel(id?)`…); `connectActionCenter(source)` lo llama el shell, no una pantalla. `ActionBell` no tiene props.
- **Ionic:** `ion-button`, `ion-badge` e `ion-chip` en la campana; `ion-modal`, `ion-list` e `ion-item` en el panel.

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
- **Úsalo cuando** cualquier icono de una plantilla; el nombre tiene que estar registrado en `src/shell/icons.ts`.
- **No lo uses cuando** es un logotipo, una foto o una ilustración → `<img>`; nunca un SVG suelto.
- **API:** props `name` (`juego:nombre`), `label` (lo hace imagen con nombre accesible; sin él es decorativo), `decorative`; admite `slot` y `color` de Ionic.
- **Ionic:** `ion-icon`.

## Marco de página

### `AppPage`
`import { AppPage } from '@erplora/ui/shell'`
- **Para qué sirve:** el marco de toda pantalla: la barra superior con título, Atrás y acciones, un solo `ion-content` con los márgenes del shell y las pestañas de sección abajo.
- **Úsalo cuando** siempre, como raíz de cada página de una app del Hub o del panel del SaaS.
- **No lo uses cuando** el contenido va en un diálogo → `FormModal`; nunca un `ion-page` o `ion-header` propios en una pantalla normal.
- **API:** props `title`, `backHref` (enseña Atrás: vista de detalle), `contentLayout` (`fluid`, `detail`, `detail-fill`, `fill` para una lista `DataTable fill`), `headingOnScreen`, `tabs` con `v-model:tab`, `tabsLabel`; slots por defecto, `actions` (en la barra; en el teléfono se pliegan en «⋮») y `footer`.
- **Ionic:** `ion-page`, `ion-content`, `ion-footer`, `ion-toolbar`, `ion-segment`, con `AppTopbar`.

### `AppTopbar`
`import { AppTopbar } from '@erplora/ui/shell'`
- **Para qué sirve:** la barra superior del shell: menú, título, sección, Atrás, las acciones de la vista (dos o más se pliegan en «⋮» en el teléfono) la campana del centro de avisos (con `createShell({ actionNotices })`) y las piezas del proyecto, como el lanzador de apps.
- **Úsalo cuando** una vista monta su propio `ion-page` y no puede usar `AppPage`.
- **No lo uses cuando** es una pantalla normal → `AppPage`, que ya la pinta.
- **API:** props `title`, `section`, `backHref`, `titleIsHeading`; slot `actions`.
- **Ionic:** `ion-header`, `ion-toolbar`, `ion-buttons`, `ion-menu-button`, `ion-title`, `ion-button`, `ion-popover`.

### `WebOnly`, `vWebOnly`
`import { WebOnly, vWebOnly } from '@erplora/ui/shell'`
- **Para qué sirve:** enseñar lo que vende (precios, cambiar de plan, pagar) solo en la web; en la app ni llega al DOM y el slot `app` dice cómo hacerlo desde un navegador.
- **Úsalo cuando** un bloque de compra o de pago está en una pantalla que también se ve dentro de la app.
- **No lo uses cuando** es una ruta entera → `meta.webOnly` de la ruta; un solo elemento que debe seguir en el DOM → la directiva `v-web-only`.
- **API:** slots por defecto (solo en la web) y `app` (solo en la app); `v-web-only` lo muestra u oculta como `v-show`.
- **Ionic:** ninguno.

## Asistente

El host lo configura una vez al arrancar (`configureAssistant`) y suma `assistantMessages` a sus catálogos de textos.

### `AssistantPanel`
`import { AssistantPanel } from '@erplora/ui/components'`
- **Para qué sirve:** el chat del asistente, el mismo en el Hub y en el SaaS: a la derecha desde 768 px y a pantalla completa en el teléfono, con dictado, lectura en voz alta y la tarjeta que aprueba cada escritura.
- **Úsalo cuando** el host lo monta una sola vez junto al panel del shell, mientras hay una sesión.
- **No lo uses cuando** una pantalla quiere su propio chat: hay un solo asistente por pestaña, que se abre con `AssistantButton` o `useAssistant()`.
- **API:** slot `empty` con `{ setup, ask }` para la bienvenida; lo demás sale de `configureAssistant`.
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

## Fuera del catálogo

`@erplora/ui/shell` exporta también el arranque del shell (`createShell`, rutas, sesión, tema, superficie, avisos e
impresora del dispositivo, `useMyApps`), que no pinta pantallas; los datos van por `@erplora/ui/sdk` (`useLive`,
`useCommand`). Los tipos y las constantes de cada componente se importan del mismo sitio que el componente.

## Lo que aún no existe

Las tarjetas de entidad, la tarjeta de cifra, la baldosa táctil, la comanda y el panel de ajustes están en diseño.
Mientras no existan, no se maqueta una tarjeta nueva a mano sin avisarlo en la issue o en la PR, para que entre en el
diseño de la pieza común.

## Reglas

- Los componentes compartidos se construyen sobre componentes de Ionic, personalizados con sus variables CSS y
  `::part`, y con los tokens `--ep-*` del tema; nada de colores ni medidas sueltas.
- El material translúcido es la clase `.ep-glass` de `src/shell/theme/glass.css` y solo va en superficies flotantes
  (en un overlay de Ionic, sus tokens `--ep-glass-*` en `::part(content)` o en `--background`); un componente no
  declara cristal propio.
- Ningún prefijo `ok-`.
- Una pieza sube a la librería cuando la necesita una segunda app (o el Hub y el SaaS): `src/components/<Nombre>/`,
  con su test, sus textos en `en` y `es`, su export en `src/components/index.ts` y su entrada en este catálogo. Lo que
  solo se repite dentro de una app vive en `apps/<app>/frontend/components/` de esa app.
- Antes de crear un componente en una app se mira este catálogo y los `components/` de la propia app.
- Un componente que ya existe no se copia a otra app: se sube a la librería y se importa.
