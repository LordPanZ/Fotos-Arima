import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { iniciarActualizaciones } from './lib/actualizacion';
import App from './App';
import './styles.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Comprueba si hay versión nueva al abrir y cada vez que se vuelve a la app,
// y avisa en pantalla en vez de esperar a que alguien cierre y abra.
iniciarActualizaciones();
