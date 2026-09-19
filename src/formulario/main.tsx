import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Formulario } from './Formulario';
import '../styles.css';
import './formulario.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en formulario/index.html');

createRoot(raiz).render(
  <StrictMode>
    <Formulario />
  </StrictMode>,
);
