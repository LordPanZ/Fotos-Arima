# Conectar la app con Google Fotos

Se hace **una sola vez** y tarda unos diez minutos. Al terminar tendrás un
«ID de cliente» que pegas en Ajustes de la app.

> **Antes de empezar, lo importante:** desde el 31 de marzo de 2025 Google ya no
> permite que una aplicación de terceros lea la biblioteca entera de Google
> Fotos. La única vía disponible es el **Selector de Google Fotos**: se abre una
> ventana de Google, tú marcas las fotos, y la app solo recibe esas.
>
> En la práctica no es un problema para lo que queremos: en el selector puedes
> marcar muchas fotos de golpe (por ejemplo todas las de un álbum de
> manualidades) y la app se encarga del resto — afinar la selección, agrupar por
> tipo, nombrar y compartir. Pero conviene saberlo: **la app no rastrea la
> cuenta por su cuenta**, tú eliges qué entra.

---

## Si lo haces desde un iPhone o iPad

Se puede, pero la consola de Google Cloud está pensada para pantalla grande y
en el móvil se queda estrecha. Dos cosas que ayudan mucho:

1. Usa **Safari** y activa el modo de escritorio: toca **ᴀA** en la barra de
   direcciones › **Solicitar sitio web para ordenador**. Sin eso, media consola
   queda fuera de la pantalla.
2. Comprueba con qué cuenta estás. Arriba a la derecha, el círculo con la
   inicial: tiene que ser **arimacooltour@gmail.com**. Si tienes varias cuentas
   de Google en el móvil, es el fallo más habitual.

Si tienes un ordenador a mano, hazlo ahí: son los mismos pasos y se tarda la
mitad.

---

## 1. Crear un proyecto en Google Cloud

1. Entra en <https://console.cloud.google.com/> con la cuenta
   **arimacooltour@gmail.com**.
2. Arriba, en el selector de proyectos, pulsa **Proyecto nuevo**.
3. Nombre: `Fotos Arima`. Pulsa **Crear** y espera a que se seleccione.

## 2. Activar la API del Selector

1. Ve a **APIs y servicios › Biblioteca**, o directamente a
   <https://console.cloud.google.com/apis/library/photospicker.googleapis.com>.
2. Comprueba que el título dice **«Photos Picker API»** y pulsa **Habilitar**.

> **Ojo con el nombre.** Existe otra API llamada «Google Picker API», que es
> para elegir archivos de Google Drive y no sirve aquí. Tampoco actives la
> «Photos Library API»: sus permisos de lectura ya no están disponibles.

## 3. Configurar la pantalla de consentimiento

Google reorganizó esta parte de la consola: lo que antes era «Pantalla de
consentimiento de OAuth» ahora es **Google Auth Platform**, con cuatro
pestañas — **Branding**, **Audience**, **Data Access** y **Clients**.

1. Ve a <https://console.cloud.google.com/auth/overview>.
2. Si es la primera vez, te recibe un asistente **«Get started»** de cuatro
   bloques. Rellénalo:
   - **App name**: `Fotos Arima`
   - **User support email**: `arimacooltour@gmail.com`
   - **Audience**: **External**
   - **Contact information**: `arimacooltour@gmail.com`
   - Acepta la política y pulsa **Create**.
3. Pestaña **Data Access** (<https://console.cloud.google.com/auth/scopes>):
   pulsa **Add or remove scopes**, busca `photospicker` y marca:

   ```
   https://www.googleapis.com/auth/photospicker.mediaitems.readonly
   ```

   Pulsa **Update** y luego **Save**.

   > Si el buscador no lo encuentra, pégalo a mano en el recuadro
   > **«Manually add scopes»** y pulsa **Add to table**.

4. Pestaña **Audience** (<https://console.cloud.google.com/auth/audience>):
   en **Test users** pulsa **Add users**, escribe `arimacooltour@gmail.com` y
   guarda. Añade también cualquier otra cuenta que vaya a usar la app.

> **Deja la aplicación en estado «Testing».** Para uso personal es suficiente y
> no necesitas que Google verifique nada. Admite hasta 100 usuarios de prueba.
> La primera vez que des permiso verás una pantalla de aviso: pulsa
> **Configuración avanzada › Ir a Fotos Arima (no seguro)**. Es lo esperable en
> una app propia sin verificar.

## 4. Crear el ID de cliente

1. Pestaña **Clients** (<https://console.cloud.google.com/auth/clients>).
2. Pulsa **Create client**.
3. **Application type**: **Web application**.
4. **Name**: `Fotos Arima web`.
5. En **Authorized JavaScript origins**, pulsa **Add URI** y añade una entrada
   por cada sitio desde el que abras la app:

   | Dónde usas la app | Qué añadir |
   |---|---|
   | Publicada en GitHub Pages | `https://lordpanz.github.io` |
   | Desarrollo con `npm run dev` | `http://localhost:5173` |
   | Aplicación de escritorio (Electron) | `http://localhost:4173` |
   | Publicada en otro dominio | `https://tu-dominio.com` |

   > Se pone **solo el origen**: protocolo, dominio y puerto. Sin la ruta y sin
   > barra final. Aunque la app viva en `https://usuario.github.io/Fotos-Arima/`,
   > el origen es `https://usuario.github.io`.

6. **No hace falta rellenar «Authorized redirect URIs»**: la app usa el modelo
   de token de Google Identity Services, que no redirige.
7. Pulsa **Create** y copia el **Client ID**. Tiene esta pinta:

   ```
   123456789012-a1b2c3d4e5f6g7h8.apps.googleusercontent.com
   ```

## 5. Pegarlo en la app

Abre la app › **Ajustes › Google Fotos** y pega el ID de cliente. Se guarda en
el dispositivo. A partir de ahí, en **Importar** ya funciona el botón
«Elegir fotos en Google Fotos».

Si prefieres dejarlo fijado en la compilación, crea un archivo `.env` en la raíz
del proyecto:

```
VITE_GOOGLE_CLIENT_ID=123456789012-a1b2c3d4e5f6g7h8.apps.googleusercontent.com
```

---

## Si algo no va

| Lo que ves | Qué pasa |
|---|---|
| «Google no admite este origen» o `redirect_uri_mismatch` | El origen desde el que abres la app no está en **Authorized JavaScript origins** (paso 4.5). Compruébalo en Ajustes: la app te muestra el origen exacto que debes añadir. Los cambios en Google Cloud pueden tardar unos minutos en surtir efecto. |
| «Google ha denegado el acceso» (403) | Falta activar la Photos Picker API (paso 2), o la cuenta no está en **Test users** (paso 3.4), o falta el permiso en **Data Access** (paso 3.3). |
| «La sesión de Google ha caducado» | Normal: el token dura una hora. Vuelve a pulsar el botón de importar. |
| La ventana del selector no se abre | El navegador la ha bloqueado como emergente. Permite las ventanas emergentes para este sitio. |
| «El navegador ha bloqueado la descarga de la foto» | Alguna extensión o una política del navegador está cortando la petición. La aplicación de escritorio no tiene esta limitación. |

## Usarlo después desde el iPhone

Una vez configurado, al pulsar «Elegir fotos en Google Fotos»:

1. Se abre una ventana de Google. Si Safari la bloquea, sale un aviso arriba:
   tócalo y permite la ventana emergente para este sitio.
2. Elige las fotos y pulsa **Hecho** (arriba a la derecha).
3. **Vuelve a Fotos Arima.** Si la tienes instalada en la pantalla de inicio, la
   ventana de Google se abre en Safari aparte, así que hay que volver a la app a
   mano. Ella sola detecta que ya has elegido y empieza a descargar; no hay que
   pulsar nada más.

> Si te dejas la ventana de Google abierta y vuelves a la app, funciona igual.
> Lo que no puedes es cerrar Fotos Arima mientras descarga.

## Qué ve la app y qué no

- **Solo las fotos que marcas** en cada sesión del selector. Nada más.
- El permiso es **de solo lectura**: la app no puede borrar, mover ni modificar
  nada en Google Fotos.
- Las copias que se descargan se guardan **en tu dispositivo**, no en ningún
  servidor.
- Para dejar de dar acceso: <https://myaccount.google.com/permissions>.
