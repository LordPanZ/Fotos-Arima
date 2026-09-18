import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Mantiene la copia instalada al día sin molestar: la siguiente vez que se
// abra la app ya estará la versión nueva.
registerSW({ immediate: true });
