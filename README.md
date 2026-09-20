# Fotos Arima

Catálogo de manualidades para la cuenta de Google Fotos de **arimacooltour@gmail.com**.
Importa las fotos, se queda solo con las manualidades, las **agrupa por tipo**,
les pone nombre y te deja **editarlo y compartirlas**.

Es una aplicación instalable en el móvil y en el ordenador, con **catálogo
compartido**: lo que sube cualquiera del equipo aparece en el aparato del otro,
sin cuentas ni registro. Cada dispositivo guarda su copia, así que sigue
funcionando sin conexión y sincroniza cuando vuelve.

---

## Qué hace

**Importar.** Desde Google Fotos a través del selector oficial de Google,
arrastrando archivos (por ejemplo una descarga de Google Takeout), o desde el
formulario **Tailerren Argazkiak Arima** (en euskera, instalable aparte), con el
que los monitores mandan las fotos de sus talleres con título, fecha, lugar y
los materiales usados — [docs/FORMULARIO-MONITORES.md](docs/FORMULARIO-MONITORES.md).

**Afinar la selección.** Un modelo de visión decide si cada foto muestra una
manualidad y con cuánta seguridad. Descarta retratos sin pieza, paisajes,
comida, capturas de pantalla, documentos y productos comprados. Lo que no tiene
claro no entra al catálogo: va a una cola de revisión donde lo confirmas o lo
descartas de un toque.

**Agrupar por categoría.** 20 categorías. Dieciocho de manualidad —ganchillo y
punto, costura y textil, macramé y fibras, cerámica y arcilla, pintura y dibujo,
papel y cartón, madera y carpintería, joyería y abalorios, velas y jabones,
resina epoxi, mosaico y vidrio, reciclaje, decoración del hogar, fiestas,
Navidad, infantil, flores y naturaleza, y otras— más las dos actividades de
Arima: **Diskofesta** e **Ihes Gela**. Cada foto guarda además su técnica o
escena, sus materiales y sus colores.

**Tipos propios.** Desde Ajustes puedes crear los tuyos —Tecnología, Cocina,
Deporte…— con su icono, su color y una frase que explica cuándo usarlos. Salen
en la galería y al revisar, y el clasificador también los tiene en cuenta. Como
viajan pegados a la ficha de cada foto, quien abra el catálogo compartido desde
otro dispositivo los ve igual, sin tener que crearlos.

**Nombrar y renombrar.** Nombres automáticos con plantilla configurable
(`Macramé y fibras - colgante de pared beige - 2024-05-12`), editables uno a uno
o en lote. Lo que escribes a mano no se sobrescribe.

**Rellenar varias de una vez.** Cuando llegan las fotos de un mismo taller,
**Rellenar ficha** pone el título, el tipo, la técnica, la descripción y las
etiquetas a todas de golpe, numerando los títulos (`Taller de robots 01`, `02`…).
Solo se aplica lo que escribes, así que sirve igual si las fotos son de tipos
distintos y solo quieres tocarles el título. Está en el resumen de la
importación y en la barra de selección del catálogo.

**Compartir.** Menú nativo del sistema con las fotos adjuntas, una o varias a la
vez. Al compartir eliges si va **la foto con su ficha** (nombre, categoría y
materiales como texto) o **solo la imagen**, sin nada escrito; la app recuerda
tu última elección. También descarga directa y exportación a ZIP con carpetas
por categoría y un `catalogo.csv`.

---

## Dónde está

**https://lordpanz.github.io/Fotos-Arima/** — instalable desde el navegador en
el móvil y en el ordenador.

## Empezar (desarrollo)

```bash
npm install
npm run dev          # http://localhost:5173
```

Para usarla de verdad hacen falta dos cosas, ambas de configuración única:

| | Para qué | Dónde |
|---|---|---|
| **ID de cliente de Google** | Importar desde Google Fotos | [docs/CONFIGURACION-GOOGLE.md](docs/CONFIGURACION-GOOGLE.md) |
| **Clave de la API de Claude** | Clasificar por tipo de manualidad | Ajustes › Clasificación |

Las dos se pegan en **Ajustes** y se guardan solo en ese dispositivo.

Sin ellas la app funciona igualmente: puedes importar archivos del ordenador y
clasificarlos a mano, y el análisis local descarta capturas y documentos.

> **Una limitación que conviene conocer de entrada:** desde marzo de 2025 Google
> no permite que una aplicación de terceros recorra sola la biblioteca de Google
> Fotos. Se elige en el selector de Google qué fotos entran —puedes marcar
> muchas a la vez— y a partir de ahí trabaja la app. El detalle está en
> [docs/CONFIGURACION-GOOGLE.md](docs/CONFIGURACION-GOOGLE.md).

---

## Instalar

En el móvil y en el ordenador se instala desde el navegador (PWA). Para Windows,
macOS y Linux hay además instaladores clásicos generados con Electron.

Instrucciones completas: [docs/INSTALACION.md](docs/INSTALACION.md).

```bash
npm run build           # aplicación web lista para publicar (dist/)
npm run desktop:build   # instaladores .exe / .dmg / AppImage
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y compila a `dist/` |
| `npm run preview` | Sirve la compilación en `localhost:4173` |
| `npm run typecheck` | Solo TypeScript |
| `npm run smoke` | Recorrido completo en un navegador real |
| `npm run smoke:google` | Camino de Google Fotos, con Google sustituido por dobles |
| `npm run smoke:formulario` | Formulario de monitores de punta a punta |
| `npm run icons` | Regenera los iconos desde el SVG |
| `npm run desktop:dev` | Abre la versión de escritorio |
| `npm run desktop:build` | Genera los instaladores |

---

## Cómo está hecho

React + TypeScript + Vite, PWA con service worker, IndexedDB para las fotos y
las fichas, la API del Selector de Google Fotos para importar y la API de Claude
para clasificar.

La arquitectura, el prompt del clasificador, los costes aproximados y las
consideraciones de privacidad están en [docs/COMO-FUNCIONA.md](docs/COMO-FUNCIONA.md).

---

## Catálogo compartido y privacidad

Las fotos viven en tu dispositivo **y** en un catálogo común (Supabase) para que
el equipo vea lo mismo. Cómo sincroniza, qué cuesta y cómo protegerlo con
código: [docs/CATALOGO-COMPARTIDO.md](docs/CATALOGO-COMPARTIDO.md).

El catálogo está **abierto**: quien conozca la dirección puede ver y editar. El
almacén de imágenes sí es privado y no indexable. El permiso de Google es de
solo lectura y alcanza únicamente a las fotos que marcas en el selector. Con la
clasificación por IA activada se envía una copia reducida de cada foto a
`api.anthropic.com` mientras dura el análisis, y nada más. Los originales de
Google Fotos no se modifican nunca.
