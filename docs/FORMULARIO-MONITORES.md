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

## Varios talleres de una vez

Arriba se pregunta **cuántos talleres** va a mandar (hasta 8). Si dice 3, salen
3 bloques numerados, cada uno con su título, fecha, lugar, materiales, notas y
**sus propias fotos**.

Al enviar, **cada taller viaja por separado** y llega a Fotos Arima como un
envío independiente: sus fotos no se mezclan con las de los otros y cada uno
conserva su ficha. Por el camino del archivo se genera un paquete por taller.

El número del bloque se pone en ámbar mientras falte algo, y el botón de enviar
no se activa hasta que todos los talleres estén completos.

*Tu nombre* se pregunta una sola vez, arriba: es de la persona, no del taller.

## Qué rellenan

| Campo | En el formulario | Obligatorio | Para qué |
|---|---|---|---|
| Título del taller | *Tailerraren izenburua* | Sí | Es el nombre que reciben las fotos al llegar. |
| Fecha | *Data* | Sí | La del taller. Manda sobre la del archivo, que se pierde al reenviar por WhatsApp. |
| Lugar | *Lekua* | Sí | Queda en la ficha y se puede buscar. |
| Tu nombre | *Zure izena* | No | Para saber a quién preguntar. Se recuerda para la próxima vez. |
| Notas | *Oharrak* | No | Cualquier cosa que convenga saber. |
| Materiales | *Materialak* | No | Menú de botones: se tocan los que se han usado. |
| Fotos | *Argazkiak* | Sí | Hasta 60 por envío. |

Las fotos se **reducen a 2048 px antes de enviarse**, así que un envío de 30
fotos ocupa unos 12 MB en vez de 150. En el móvil del monitor eso es la
diferencia entre que funcione y que no.

## Los materiales

Hay un menú de botones con los materiales habituales —goma eva, feltroa,
kartulina, pintura, silikona pistola, labea…— y un campo libre (*Besterik?*)
para lo que no esté. El monitor toca los que ha usado y listo.

Los rótulos están en euskera pero **se guardan en castellano**, para que el
catálogo, la búsqueda y los nombres de archivo estén en un solo idioma. La
correspondencia está en `src/materiales.ts`: añadir uno ahí lo hace aparecer en
el formulario automáticamente.

Los materiales marcados llegan a la foto como **etiquetas**, que es donde se
buscan y se editan en la app. El clasificador añade las suyas, pero no borra las
de quien estuvo en el taller.

## Qué llega a cada foto

Cada foto guarda la ficha del taller entera, y se ve al abrirla en la app:

| En la foto | De dónde sale |
|---|---|
| **Nombre** | El título del taller. Si el envío trae varias fotos, se numeran: «Taller de macramé en Getxo 01, 02, 03…» |
| **Etiquetas** | Los materiales marcados, más las que añada el clasificador |
| **Taller** | Título y lugar del formulario |
| **Enviada por** | Nombre del monitor |
| **Notas** | Lo que escribiera |
| **Fecha** | La del formulario, no la del archivo |

El nombre y las etiquetas **sobreviven al análisis**. El título cuenta como
nombre puesto a mano —lo escribió una persona—, así que la plantilla no lo
sobrescribe, y las etiquetas del clasificador se suman a las del monitor en vez
de sustituirlas.

Si quieres que las fotos de un taller se llamen de otra forma, cámbiales el
nombre en la app como cualquier otra, o usa «Aplicar a todas» en
Ajustes › Nombres para forzar la plantilla.

Todo eso **se puede buscar** desde el catálogo: escribiendo «Algorta» salen las
fotos de los talleres de ese sitio.

También hay dos tokens nuevos para los nombres de archivo, en
Ajustes › Nombres: `{evento}` y `{lugar}`. Por ejemplo, la plantilla
`{evento} - {descripcion} - {fecha}` produce
`Taller de macramé en Getxo - colgante beige - 2026-09-15.jpg`.

## Los dos botones

**Arimara bidali** («Enviar a Arima») sube las fotos directamente al catálogo compartido. Es lo
normal: en cuanto termina, aparecen en vuestras apps la próxima vez que
sincronicen.

**Fitxategi gisa bidali** («Mandar como archivo») empaqueta todo —fotos y datos— en un único archivo
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
