# El catálogo compartido

Fotos Arima empezó guardando todo en el dispositivo. Ahora hay además un
catálogo común: lo que sube cualquiera de vosotros aparece en el aparato del
otro, sin cuentas ni registro.

## Cómo funciona

```
 Tu móvil ─┐                        ┌─ Móvil de Aitzi
           ├──▶ función «catalogo» ─┤
 Tu PC ────┘      (Supabase)        └─ Formulario de monitores
                       │
              ┌────────┴────────┐
              ▼                 ▼
         tabla fotos      almacén de imágenes
        (fichas JSON)        (privado)
```

- Cada aparato mantiene **su copia local** en IndexedDB. La app sigue
  funcionando sin cobertura y sincroniza cuando vuelve.
- Al sincronizar se **envía lo que has cambiado** y se **trae lo cambiado
  fuera**, solo lo nuevo desde la última vez.
- **Gana el cambio más reciente.** Para dos personas es suficiente, y evita
  toda la complejidad de fusionar campo a campo.
- Los **borrados dejan lápida** en el servidor. Sin ella, el aparato que estaba
  desconectado volvería a subir la foto que el otro acaba de borrar.
- Lo que hayas cambiado y no se haya enviado todavía **nunca se pisa** al
  sincronizar.

### Consumo de datos

Al sincronizar viajan solo las **miniaturas** (unos 40 KB). La imagen grande se
baja cuando abres la foto o la compartes, y se queda guardada. Así abrir la app
en el móvil con datos no se come la tarifa.

### Cuándo sincroniza

Al abrir la app, al volver a ella y cuando recupera la conexión. También a mano,
con el botón de la barra superior: el número que aparece encima son los cambios
tuyos que todavía no han salido.

## Acceso

**El catálogo está abierto**, por decisión expresa: no pide ningún código.
Quien conozca la dirección de la función puede leer, escribir y borrar.

Lo que sí está protegido:

- El almacén de imágenes es **privado**: no se puede navegar ni lo indexan los
  buscadores. Las fotos se sirven con enlaces que caducan en una hora.
- La base de datos tiene RLS activada **sin ninguna política**, así que la clave
  pública no sirve para nada. Todo el acceso pasa por la función, que es la
  única que tiene la clave de servicio.

### Cerrarlo con código

Está preparado para hacerlo sin tocar código. En el panel de Supabase, en
**Edge Functions › catalogo › Secrets**, define:

| Variable | Para qué |
|---|---|
| `CLAVE_EQUIPO` | Acceso completo: tú y Aitzi. |
| `CLAVE_MONITORES` | Solo subir. Para el formulario de monitores. |

En cuanto `CLAVE_EQUIPO` exista, la función empieza a exigirla en la cabecera
`x-arima-clave`. En la app se pone compilando con `VITE_CLAVE_ARIMA`.

> Siendo fotos de talleres, con menores, esto es lo recomendable. Queda a tu
> criterio.

## El proyecto de Supabase

| | |
|---|---|
| Proyecto | `fotos-arima` (`igxanputrpxdvpocfipy`) |
| Región | París (`eu-west-3`) |
| Plan | Gratuito — 0 €/mes |
| Función | `https://igxanputrpxdvpocfipy.supabase.co/functions/v1/catalogo` |

El plan gratuito da 1 GB de almacenamiento y 5 GB de descarga al mes. A unos
400 KB por foto, caben del orden de **2.000 fotos**.

> **Los proyectos gratuitos se pausan tras una semana sin actividad.** Si pasáis
> mucho tiempo sin abrir la app, habrá que despertarlo desde el panel de
> Supabase. Abrir la app de vez en cuando basta para que no ocurra.

## Si algo no cuadra

| Lo que ves | Qué pasa |
|---|---|
| «No se ha podido conectar con el catálogo compartido» | Sin conexión, o el proyecto está pausado. La app sigue funcionando con lo que tiene y reintenta sola. |
| El número del botón de sincronizar no baja | Hay cambios que no consiguen salir. Pulsa el botón para ver el error concreto. |
| Una foto aparece en un aparato y en el otro no | Sincroniza en el que falta. Si persiste, mira que no esté en «Descartadas». |
| Aitzi no ve nada al abrir el enlace | La primera sincronización tarda: son las miniaturas de todo el catálogo. |
