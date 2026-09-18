# Instalar Fotos Arima

La app es una **PWA**: un único programa que se instala igual en el móvil y en
el ordenador, funciona sin conexión y guarda las fotos en el propio dispositivo.
Para Windows, macOS y Linux hay además un instalador clásico.

---

## Paso previo: poner la app en línea

Para instalarla en el móvil hace falta que esté publicada en una dirección
`https://`. La forma más rápida y gratuita es GitHub Pages.

### Opción A — GitHub Pages (recomendada)

El repositorio ya trae el flujo de trabajo `.github/workflows/deploy.yml`.

1. En GitHub: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
2. Sube los cambios a la rama principal. El flujo compila y publica solo.
3. La app queda en `https://TU-USUARIO.github.io/Fotos-Arima/`.
4. Añade `https://TU-USUARIO.github.io` a los orígenes autorizados en Google Cloud
   (ver [CONFIGURACION-GOOGLE.md](CONFIGURACION-GOOGLE.md), paso 4).

> Si publicas en la raíz de un dominio propio, compila con `VITE_BASE=/`.

### Opción B — Cualquier alojamiento estático

```bash
npm install
npm run build          # deja todo en dist/
```

Sube el contenido de `dist/` a Netlify, Vercel, Cloudflare Pages o tu servidor.
Si va en un subdirectorio, compila con `VITE_BASE=/ruta/` para que el service
worker y el manifiesto apunten bien.

### Opción C — Solo en tu red local

```bash
npm install
npm run build
npm run preview        # http://localhost:4173
```

Sirve para probar y para usarla en el ordenador, pero los navegadores móviles no
ofrecen instalar desde `http://` salvo en `localhost`.

---

## Instalar en el móvil

### Android (Chrome, Edge, Samsung Internet)

1. Abre la dirección de la app.
2. Aparecerá el aviso **«Instalar la app»**; pulsa **Instalar**.
3. Si no sale: menú **⋮ › Añadir a pantalla de inicio / Instalar aplicación**.

Queda como una aplicación más: icono propio, pantalla completa y sin barra del
navegador.

### iPhone y iPad (Safari)

1. Abre la dirección en **Safari** (en iOS solo funciona desde Safari).
2. Pulsa el botón **Compartir** (cuadrado con flecha).
3. **Añadir a pantalla de inicio › Añadir**.

> En iOS, compartir fotos desde la app usa el menú nativo de iOS, así que puedes
> mandarlas por WhatsApp, AirDrop, correo o guardarlas en Fotos.

---

## Instalar en el ordenador

### Como PWA (Chrome, Edge, Brave)

1. Abre la dirección de la app.
2. En la barra de direcciones aparece un icono de instalación (⊕ o una pantalla
   con una flecha). Púlsalo y confirma.
3. También vale el botón **Instalar** de la propia app.

Se añade al menú de inicio o al Launchpad y se abre en su propia ventana.

### Como programa instalable (.exe, .dmg, AppImage)

Para quien prefiera un instalador de toda la vida:

```bash
npm install
npm run build              # compila la aplicación web
npm run desktop:install    # descarga Electron (solo la primera vez)
npm run desktop:build      # genera los instaladores
```

Los archivos quedan en `desktop/dist/`:

| Sistema | Archivo |
|---|---|
| Windows | `Fotos Arima Setup 1.0.0.exe` |
| macOS | `Fotos Arima-1.0.0.dmg` |
| Linux | `Fotos Arima-1.0.0.AppImage` y `.deb` |

Para probarlo sin empaquetar: `npm run desktop:dev`.

> **Compila cada instalador en su sistema.** electron-builder no puede generar
> un `.dmg` desde Windows ni un `.exe` firmado desde Linux. El flujo de trabajo
> `.github/workflows/escritorio.yml` los construye para los tres sistemas
> cuando publicas una etiqueta `v*`.

> La versión de escritorio sirve la app en `http://localhost:4173`. Ese origen
> tiene que estar en la lista de orígenes autorizados de Google Cloud.

---

## Usar la app en varios dispositivos

Cada dispositivo guarda su propio catálogo: no hay servidor ni sincronización.
Para llevar el trabajo de un sitio a otro:

- **Ajustes › Exportar el catálogo en ZIP**: las fotos ya renombradas y
  ordenadas en carpetas por tipo, más `catalogo.csv` y `catalogo.json`.
- **Ajustes › Copia de seguridad de las fichas**: solo los datos (nombres,
  categorías, etiquetas), en JSON.

En el otro dispositivo, importa el ZIP desde **Importar › Desde este
dispositivo**: los nombres de archivo ya llevan el tipo de manualidad, así que
el catálogo se reconstruye reconocible.

---

## Desinstalar

- **Android:** mantener pulsado el icono › Desinstalar.
- **iOS:** mantener pulsado el icono › Eliminar app.
- **Escritorio (PWA):** abre la app › menú ⋮ › Desinstalar.
- **Escritorio (instalador):** desde el panel de aplicaciones del sistema.

Desinstalar borra también las fotos guardadas en ese dispositivo. **Los
originales de Google Fotos no se tocan nunca.**
