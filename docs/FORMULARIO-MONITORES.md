# Tailerren Argazkiak Arima

El formulario con el que los monitores mandan las fotos de sus talleres. Llegan
al catálogo compartido y se quedan en **Revisar** hasta que alguien las mira.

## El enlace

```
https://lordpanz.github.io/Fotos-Arima/formulario/
```

Pásaselo a los monitores. No hace falta instalar nada ni registrarse: se abre en
el navegador del móvil y ya está. Conviene que lo guarden en marcadores o en la
pantalla de inicio, porque lo usarán a menudo.

## Qué rellenan

| Campo | Obligatorio | Para qué |
|---|---|---|
| Título del taller | Sí | Es el nombre que reciben las fotos al llegar. |
| Fecha | Sí | La del taller. Manda sobre la del archivo, que se pierde al reenviar por WhatsApp. |
| Lugar | Sí | Queda en la ficha y se puede buscar. |
| Tu nombre | No | Para saber a quién preguntar. Se recuerda para la próxima vez. |
| Notas | No | Cualquier cosa que convenga saber. |
| Fotos | Sí | Hasta 60 por envío. |

Las fotos se **reducen a 2048 px antes de enviarse**, así que un envío de 30
fotos ocupa unos 12 MB en vez de 150. En el móvil del monitor eso es la
diferencia entre que funcione y que no.

## Los dos botones

**Enviar a Arima** sube las fotos directamente al catálogo compartido. Es lo
normal: en cuanto termina, aparecen en vuestras apps la próxima vez que
sincronicen.

**Mandar como archivo** empaqueta todo —fotos y datos— en un único archivo
`.arima.zip` y abre el menú de compartir del móvil para que lo mande por
WhatsApp. Sirve para cuando no hay cobertura, el servidor está pausado o el
envío falla. Tú lo abres luego desde **Importar › Envío de un monitor**.

## Qué pasa al llegar

Las fotos entran con `origen: 'envio'`, y esa marca hace que **pasen siempre por
Revisar**, por muy seguro que esté el clasificador. Es material de otra persona:
alguien lo mira antes de que entre al catálogo.

Cada foto llega con el título, la fecha y el lugar del taller ya puestos, así
que al revisarlas solo hay que confirmar la categoría.

## Límites

- 60 fotos por envío. Si hay más, se manda en varias tandas.
- El envío al buzón sube de 8 en 8, para no agotar la conexión del móvil.
- Si alguna foto falla, el resto del envío sigue adelante y al final se dice
  cuántas no han podido subir.

## Cerrar el formulario con código

Ahora mismo cualquiera con el enlace puede enviar. Para exigir un código, define
`CLAVE_MONITORES` en los secretos de la función `catalogo` (ver
[CATALOGO-COMPARTIDO.md](CATALOGO-COMPARTIDO.md)). Ese código solo permite
**subir**: quien lo tenga no puede ver ni borrar el catálogo.
