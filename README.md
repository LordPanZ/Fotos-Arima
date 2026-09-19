# Fotos Arima

Catálogo de manualidades para la cuenta de Google Fotos de **arimacooltour@gmail.com**.
Importa las fotos, se queda solo con las manualidades, las **agrupa por tipo**,
les pone nombre y te deja **editarlo y compartirlas**.

Es una aplicación instalable en el móvil y en el ordenador. Funciona sin
conexión y guarda todo en el propio dispositivo: no hay servidor ni cuenta que
crear.

---

## Qué hace

**Importar.** Desde Google Fotos a través del selector oficial de Google, o
arrastrando archivos (por ejemplo una descarga de Google Takeout).

**Afinar la selección.** Un modelo de visión decide si cada foto muestra una
manualidad y con cuánta seguridad. Descarta retratos sin pieza, paisajes,
comida, capturas de pantalla, documentos y productos comprados. Lo que no tiene
claro no entra al catálogo: va a una cola de revisión donde lo confirmas o lo
descartas de un toque.

**Agrupar por tipo de manualidad.** 18 categorías —ganchillo y punto, costura y
textil, macramé y fibras, cerámica y arcilla, pintura y dibujo, papel y cartón,
madera y carpintería, joyería y abalorios, velas y jabones, resina epoxi,
mosaico y vidrio, reciclaje, decoración del hogar, fiestas, Navidad, infantil,
flores y naturaleza, y otras— con la técnica, los materiales y los colores de
cada pieza.

**Nombrar y renombrar.** Nombres automáticos con plantilla configurable
(`Macramé y fibras - colgante de pared beige - 2024-05-12`), editables uno a uno
o en lote. Lo que escribes a mano no se sobrescribe.

**Compartir.** Menú nativo del sistema con las fotos adjuntas, una o varias a la
vez. También descarga directa y exportación a ZIP con carpetas por tipo y un
`catalogo.csv`.

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

## Privacidad

Las fotos y sus fichas se quedan en tu dispositivo. El permiso de Google es de
solo lectura y alcanza únicamente a las fotos que marcas en el selector. Con la
clasificación por IA activada se envía una copia reducida de cada foto a
`api.anthropic.com` mientras dura el análisis, y nada más. Los originales de
Google Fotos no se modifican nunca.
