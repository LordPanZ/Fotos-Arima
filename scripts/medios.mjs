/**
 * Archivos de prueba para las pruebas de humo.
 *
 * Se generan en un navegador de verdad —y no se guardan en el repositorio—
 * porque lo que hay que probar es el camino real: una imagen con textura que
 * el heurístico no confunda con una captura, y un vídeo reproducible con el
 * que se pueda sacar un fotograma de portada.
 */

/** PNG con degradado y ruido: se parece a una foto, no a un dibujo plano. */
export async function imagenDePrueba(navegador) {
  const pagina = await navegador.newPage({ viewport: { width: 320, height: 320 } });
  const datos = await pagina.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 320;
    lienzo.height = 320;
    const ctx = lienzo.getContext('2d');
    const degradado = ctx.createLinearGradient(0, 0, 320, 320);
    degradado.addColorStop(0, '#c98b5e');
    degradado.addColorStop(0.5, '#e8d9c0');
    degradado.addColorStop(1, '#7a5a3a');
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, 320, 320);

    const imagen = ctx.getImageData(0, 0, 320, 320);
    for (let i = 0; i < imagen.data.length; i += 4) {
      const ruido = (Math.random() - 0.5) * 60;
      imagen.data[i] = Math.max(0, Math.min(255, imagen.data[i] + ruido));
      imagen.data[i + 1] = Math.max(0, Math.min(255, imagen.data[i + 1] + ruido));
      imagen.data[i + 2] = Math.max(0, Math.min(255, imagen.data[i + 2] + ruido));
    }
    ctx.putImageData(imagen, 0, 0);
    return lienzo.toDataURL('image/png').split(',')[1];
  });
  await pagina.close();
  return Buffer.from(datos, 'base64');
}

/** WebM corto grabado de un lienzo animado con MediaRecorder. */
export async function videoDePrueba(navegador) {
  const pagina = await navegador.newPage();
  const datos = await pagina.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const lienzo = document.createElement('canvas');
        lienzo.width = 320;
        lienzo.height = 240;
        const ctx = lienzo.getContext('2d');
        const trozos = [];
        const grabadora = new MediaRecorder(lienzo.captureStream(25), { mimeType: 'video/webm' });

        grabadora.ondataavailable = (e) => e.data.size && trozos.push(e.data);
        grabadora.onerror = () => reject(new Error('MediaRecorder ha fallado.'));
        grabadora.onstop = async () => {
          const blob = new Blob(trozos, { type: 'video/webm' });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binario = '';
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          resolve(btoa(binario));
        };

        grabadora.start();
        let fotograma = 0;
        const pintar = () => {
          ctx.fillStyle = `hsl(${fotograma * 8}, 70%, 50%)`;
          ctx.fillRect(0, 0, 320, 240);
          fotograma += 1;
          if (fotograma < 45) requestAnimationFrame(pintar);
          else grabadora.stop();
        };
        pintar();
      }),
  );
  await pagina.close();
  return Buffer.from(datos, 'base64');
}
