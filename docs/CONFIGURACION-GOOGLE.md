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

## 1. Crear un proyecto en Google Cloud

1. Entra en <https://console.cloud.google.com/> con la cuenta
   **arimacooltour@gmail.com**.
2. Arriba, en el selector de proyectos, pulsa **Proyecto nuevo**.
3. Nombre: `Fotos Arima`. Pulsa **Crear** y espera a que se seleccione.

## 2. Activar la API del Selector

1. Ve a **APIs y servicios › Biblioteca**.
2. Busca **Photos Picker API**.
3. Ábrela y pulsa **Habilitar**.

> Si te aparece también «Photos Library API», no la actives: no hace falta y sus
> permisos de lectura ya no están disponibles.

## 3. Configurar la pantalla de consentimiento

1. Ve a **APIs y servicios › Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo**. Pulsa **Crear**.
3. Rellena lo mínimo:
   - Nombre de la aplicación: `Fotos Arima`
   - Correo de asistencia: `arimacooltour@gmail.com`
   - Datos de contacto del desarrollador: `arimacooltour@gmail.com`
4. En **Permisos**, pulsa **Añadir o quitar permisos**, busca y marca:

   ```
   https://www.googleapis.com/auth/photospicker.mediaitems.readonly
   ```

5. En **Usuarios de prueba**, añade `arimacooltour@gmail.com` y cualquier otra
   cuenta que vaya a usar la app.
6. Guarda.

> **Deja el proyecto en estado «Prueba».** Para uso personal es suficiente y no
> necesitas que Google verifique la aplicación. Admite hasta 100 usuarios de
> prueba. Verás una pantalla de aviso al dar permiso la primera vez: pulsa
> **Configuración avanzada › Ir a Fotos Arima**.

## 4. Crear el ID de cliente

1. Ve a **APIs y servicios › Credenciales**.
2. **Crear credenciales › ID de cliente de OAuth**.
3. Tipo de aplicación: **Aplicación web**.
4. Nombre: `Fotos Arima web`.
5. En **Orígenes autorizados de JavaScript**, añade una entrada por cada sitio
   desde el que vayas a abrir la app:

   | Dónde usas la app | Qué añadir |
   |---|---|
   | Desarrollo con `npm run dev` | `http://localhost:5173` |
   | Aplicación de escritorio (Electron) | `http://localhost:4173` |
   | Publicada en GitHub Pages | `https://TU-USUARIO.github.io` |
   | Publicada en otro dominio | `https://tu-dominio.com` |

   > Se pone **solo el origen**: protocolo, dominio y puerto. Sin la ruta y sin
   > barra final. Aunque la app viva en `https://usuario.github.io/Fotos-Arima/`,
   > el origen es `https://usuario.github.io`.

6. **No hace falta rellenar «URIs de redirección autorizados»**: la app usa el
   modelo de token de Google Identity Services, que no redirige.
7. Pulsa **Crear** y copia el **ID de cliente**. Tiene esta pinta:

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
| «Google no admite este origen» o `redirect_uri_mismatch` | El origen desde el que abres la app no está en la lista del paso 5. Compruébalo en Ajustes: la app te muestra el origen exacto que debes añadir. Los cambios en Google Cloud pueden tardar unos minutos. |
| «Google ha denegado el acceso» (403) | Falta activar la Photos Picker API (paso 2), o la cuenta no está entre los usuarios de prueba (paso 3.5). |
| «La sesión de Google ha caducado» | Normal: el token dura una hora. Vuelve a pulsar el botón de importar. |
| La ventana del selector no se abre | El navegador la ha bloqueado como emergente. Permite las ventanas emergentes para este sitio. |
| «El navegador ha bloqueado la descarga de la foto» | Alguna extensión o una política del navegador está cortando la petición. La aplicación de escritorio no tiene esta limitación. |

## Qué ve la app y qué no

- **Solo las fotos que marcas** en cada sesión del selector. Nada más.
- El permiso es **de solo lectura**: la app no puede borrar, mover ni modificar
  nada en Google Fotos.
- Las copias que se descargan se guardan **en tu dispositivo**, no en ningún
  servidor.
- Para dejar de dar acceso: <https://myaccount.google.com/permissions>.
