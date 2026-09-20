# Cómo funciona por dentro

## El recorrido de una foto

```
Google Fotos ──selector──▶ descarga ──▶ dispositivo (IndexedDB)
                                            │
                                            ▼
                                     clasificación
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
              confianza alta         confianza baja          no es manualidad
                     │                      │                      │
                     ▼                      ▼                      ▼
                 Catálogo             Por revisar             Descartadas
                     │                      │
                     └───── nombre ◀────────┘
                              │
                              ▼
                     compartir / exportar
```

## Qué entra en el catálogo

El catálogo recoge **dos cosas distintas**, y la taxonomía las separa con el
campo `familia`:

- **Manualidades** — 18 categorías, reconocidas por la técnica.
- **Actividades de Arima** — `diskofesta` e `ihes-gela`, reconocidas por la
  escena, no por un objeto. Aquí sí se cataloga a la gente participando.

Esa distinción importa porque el clasificador necesita reglas propias para cada
familia: sin ellas, una foto de una fiesta se descartaría por «no es una
manualidad».

## Afinar la selección

El objetivo no es meter todo lo que haya en la cuenta, sino quedarse **solo con
lo que pertenece al catálogo**. Hay cuatro filtros encadenados:

1. **El selector de Google.** Tú eliges qué fotos entran. Es el filtro más
   grueso y el más barato.
2. **El clasificador.** Decide si la foto muestra una manualidad y de qué tipo,
   con una confianza de 0 a 1. Rechaza explícitamente retratos sin pieza,
   paisajes, comida, capturas de pantalla, documentos y productos comprados.
3. **El umbral de confianza** (Ajustes, 60 % por defecto). Lo que queda por
   debajo no entra directamente al catálogo: va a *Por revisar*. Subirlo afina
   más la selección a costa de revisar más a mano; bajarlo deja decidir a la app.
4. **La revisión manual.** Una foto por pantalla, con la propuesta del
   clasificador y el motivo. Confirmas, corriges el tipo o descartas.

Una decisión tuya siempre gana: al confirmar o cambiar el tipo a mano, la ficha
queda marcada como `manual` con confianza 1 y ningún análisis posterior la
sobrescribe.

## Los dos motores de clasificación

### Con clave de la API de Claude (recomendado)

Cada foto se reduce a 768 px por el lado mayor y se envía al modelo de visión
junto con la taxonomía completa de tipos de manualidad. La respuesta viene con
esquema fijo (*structured outputs*), así que siempre se puede leer:

| Campo | Para qué sirve |
|---|---|
| `entra_en_catalogo`, `confianza` | Entrar al catálogo o ir a revisión |
| `categoria`, `categoria_alternativa` | Agrupar la galería |
| `tecnica`, `materiales`, `colores` | Ficha y búsqueda |
| `descripcion` | El nombre del archivo |
| `etiquetas` | Búsqueda |
| `motivo` | Explicar la decisión al revisar |

El prompt (en `src/lib/classifier/ai.ts`) incluye reglas de calibración
explícitas para que el modelo **no infle la confianza**: lo dudoso debe quedar
en la franja media, que es justo lo que manda las fotos a revisión manual.

### Sin clave (modo local)

Analiza la imagen en el propio dispositivo: brillo, saturación, variedad de
color, zonas planas y densidad de bordes. Con eso descarta con bastante acierto
capturas de pantalla, documentos e imágenes sin detalle, y aprovecha el nombre
del archivo si menciona una técnica conocida. **No distingue tipos de
manualidad**: todo lo demás queda en *Por revisar* con confianza baja, que es la
respuesta honesta cuando no se puede saber.

La app lo dice donde se nota: tras importar, el resumen avisa de que esas fotos
no se han clasificado solas y de que están esperando en *Revisar*; y la propia
pantalla de revisión recuerda que ahí cae todo mientras falte la clave. Para no
ir una a una, **Rellenar ficha** (en el resumen de la importación y en la barra
de selección del catálogo) pone tipo, título y etiquetas a todas las elegidas de
una vez; elegir el tipo a mano cuenta como revisión y la foto entra directa al
catálogo.

## Categorías propias

Las 20 categorías de serie viven en `src/taxonomy.ts`. Encima de ellas hay un
registro mutable que la tienda rellena al leer los ajustes con las que se han
creado a mano (`registrarCategoriasPropias`). Por eso `categoria(id)`,
`listaCategorias()` y `taxonomiaParaPrompt()` son funciones y no constantes: el
esquema que acota la respuesta del modelo y el listado del prompt se arman en
cada análisis, cacheados por el contenido del listado.

Los ajustes no se sincronizan, pero el catálogo sí, así que cada foto que está
en una categoría propia se lleva la definición pegada a la ficha
(`categoriaPropia`). Al recargar, el otro dispositivo da de alta las que le
llegan y las pinta igual. El identificador se prefija con `propia-` para que
nunca choque con una de serie, ni siquiera si mañana se añaden más.

## Coste aproximado con IA

Orientativo, por foto analizada (la imagen son unos 800 tokens de entrada):

| Modelo | Por foto | 500 fotos | 2.000 fotos |
|---|---|---|---|
| Claude Opus 5 | ~0,02 $ | ~10 $ | ~40 $ |
| Claude Sonnet 5 | ~0,008 $ | ~4 $ | ~16 $ |
| Claude Haiku 4.5 | ~0,004 $ | ~2 $ | ~8 $ |

Se paga solo al analizar. Cambiar nombres, agrupar, buscar, compartir y exportar
no cuestan nada. El ajuste **Precisión** mueve el esfuerzo del modelo (y con él
el coste) entre rápida, equilibrada y máxima.

## Los nombres

La plantilla por defecto es `{categoria} - {descripcion} - {fecha}`, que produce
cosas como:

```
Macramé y fibras - colgante de pared beige - 2024-05-12.jpg
Cerámica y arcilla - tazas esmaltadas en azul - 2024-06-03.jpg
```

Reglas:

- Se aplica sola al clasificar, y se puede volver a aplicar en lote desde
  Ajustes o desde la barra de selección.
- **Un nombre escrito a mano no se sobrescribe nunca** (salvo que uses
  explícitamente «Aplicar a todas»).
- Los caracteres que rompen nombres de archivo en Windows, macOS o Android se
  sustituyen, y los duplicados reciben un « (2)», « (3)»…
- Los tokens vacíos no dejan guiones sueltos.

## Compartir

- **Con ficha o sin ella.** Al compartir, la app pregunta: *Foto y ficha* añade
  el nombre, la categoría y los materiales como texto; *Solo la foto* envía
  únicamente las imágenes. La última elección queda marcada para la siguiente
  vez.
- **Móvil:** menú nativo del sistema con las fotos adjuntas (Web Share API), así
  que aparecen WhatsApp, Telegram, correo, AirDrop…
- **En lote:** «Seleccionar las N» marca de golpe todo lo que estés viendo, y se
  comparten juntas en un solo envío.
- **Si el dispositivo no sabe compartir archivos** (algunos navegadores de
  escritorio), la app lo resuelve sola: descarga las fotos sueltas si son pocas,
  o un único ZIP a partir de cuatro, para no lanzar una lluvia de descargas.
- **Exportación:** ZIP con carpetas por categoría y un `catalogo.csv` listo para
  abrir en Excel.

## Privacidad

- Las fotos y las fichas viven en **IndexedDB, en tu dispositivo**. No hay
  servidor propio ni cuenta que crear.
- El permiso de Google es de **solo lectura** y limitado a lo que marcas en el
  selector.
- Con la IA activada, **solo se envía a `api.anthropic.com` una copia reducida
  de cada foto** mientras dura el análisis.
- La clave de la API se guarda en IndexedDB de este dispositivo y se envía
  únicamente a Anthropic.

### Sobre la clave de API en el navegador

La app llama a la API de Claude directamente desde el navegador
(`dangerouslyAllowBrowser`). Es una decisión consciente para una herramienta
personal: evita montar y mantener un servidor intermedio. La contrapartida es
que la clave está en el dispositivo, así que:

- Usa una clave dedicada a esta app y ponle un límite de gasto en la consola de
  Anthropic.
- No instales la app en un ordenador compartido con tu clave dentro.
- Si la app llegara a usarse con más gente, la clave debería moverse a un
  pequeño servidor intermedio.

## Estructura del código

```
src/
├── taxonomy.ts              categorías y familias (fuente única)
├── types.ts                 modelo de datos y ajustes
├── lib/
│   ├── db.ts                IndexedDB: fotos, imágenes, ajustes
│   ├── image.ts             reescalado, miniaturas, EXIF, huella
│   ├── naming.ts            plantillas de nombre
│   ├── share.ts             Web Share API y alternativas
│   ├── exportZip.ts         ZIP + catálogo CSV/JSON
│   ├── importar.ts          entrada de fotos (Google y local)
│   ├── googleAuth.ts        OAuth con Google Identity Services
│   ├── googlePicker.ts      API del Selector de Google Fotos
│   └── classifier/
│       ├── ai.ts            modelo de visión (Claude)
│       ├── heuristic.ts     análisis local sin conexión
│       └── index.ts         cola, umbrales y concurrencia
├── state/store.tsx          estado de la aplicación
├── components/              piezas de interfaz (incluye el diálogo de envío)
└── views/                   Catálogo, Importar, Revisar, Ajustes
```

## Comprobar que todo sigue funcionando

```bash
npm run typecheck   # TypeScript en modo estricto
npm run build       # compilación de producción
npm run smoke       # recorrido completo en un navegador real
```

`npm run smoke` levanta la build, abre Chromium y recorre el camino entero sin
tocar Google ni la API de Claude: importar, clasificar, revisar, agrupar,
renombrar, comprobar que el cambio sobrevive a una recarga, seleccionar en lote,
compartir y buscar. También comprueba que **el menú cabe entero a 320 y 390 px**,
que es donde se coló el fallo de que Ajustes quedara fuera de la pantalla.

`npm run verificar-pwa` comprueba que la compilación publicada sigue siendo
instalable desde un subdirectorio.
