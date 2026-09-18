import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Icono({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoBiblioteca = (p: Props) => (
  <Icono {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </Icono>
);

export const IconoImportar = (p: Props) => (
  <Icono {...p}>
    <path d="M12 3v12" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </Icono>
);

export const IconoRevisar = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m8.6 12.2 2.4 2.4 4.4-4.9" />
  </Icono>
);

export const IconoAjustes = (p: Props) => (
  <Icono {...p}>
    <path d="M4 7h11" /><circle cx="18" cy="7" r="2.2" />
    <path d="M20 12H9" /><circle cx="6" cy="12" r="2.2" />
    <path d="M4 17h11" /><circle cx="18" cy="17" r="2.2" />
  </Icono>
);

export const IconoBuscar = (p: Props) => (
  <Icono {...p}><circle cx="11" cy="11" r="6.4" /><path d="m16 16 4.2 4.2" /></Icono>
);

export const IconoCompartir = (p: Props) => (
  <Icono {...p}>
    <path d="M12 3.6v11" />
    <path d="m8.2 7.4 3.8-3.8 3.8 3.8" />
    <path d="M5.5 13v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6" />
  </Icono>
);

export const IconoDescargar = (p: Props) => (
  <Icono {...p}>
    <path d="M12 3.6v11" />
    <path d="m8.2 10.8 3.8 3.8 3.8-3.8" />
    <path d="M5.5 17v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </Icono>
);

export const IconoPapelera = (p: Props) => (
  <Icono {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
    <path d="M6.6 6.5 7.4 20a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.8-13.5" />
    <path d="M10.4 10.5v6.4M13.6 10.5v6.4" />
  </Icono>
);

export const IconoEstrella = ({ relleno, ...p }: Props & { relleno?: boolean }) => (
  <Icono {...p} fill={relleno ? 'currentColor' : 'none'}>
    <path d="m12 3.9 2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.75L6.8 20l1-5.8-4.2-4.1 5.8-.85Z" />
  </Icono>
);

export const IconoCerrar = (p: Props) => (
  <Icono {...p}><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></Icono>
);

export const IconoComprobado = (p: Props) => (
  <Icono {...p} strokeWidth={2.6}><path d="m5 12.5 4.5 4.5L19 7" /></Icono>
);

export const IconoAviso = (p: Props) => (
  <Icono {...p}>
    <path d="M12 3.8 21 19.5H3Z" />
    <path d="M12 9.8v4.2" /><circle cx="12" cy="16.9" r="0.9" fill="currentColor" stroke="none" />
  </Icono>
);

export const IconoLapiz = (p: Props) => (
  <Icono {...p}>
    <path d="M4 20.2h4l10.2-10.2a2.4 2.4 0 0 0-3.4-3.4L4.6 16.8Z" />
    <path d="m14.4 7.4 2.9 2.9" />
  </Icono>
);

export const IconoChispa = (p: Props) => (
  <Icono {...p}>
    <path d="m12 3.4 1.9 4.8 4.8 1.9-4.8 1.9L12 16.8l-1.9-4.8-4.8-1.9 4.8-1.9Z" />
    <path d="M18.6 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
  </Icono>
);

export const IconoGoogle = (p: Props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59Z" />
    <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59C7.2 7.72 9.4 5.98 12 5.98Z" />
  </svg>
);

export const IconoCarpeta = (p: Props) => (
  <Icono {...p}>
    <path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h3.6l2 2.4h8A1.7 1.7 0 0 1 20.5 9.6v8.2a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
  </Icono>
);

export const IconoInstalar = (p: Props) => (
  <Icono {...p}>
    <rect x="6" y="2.6" width="12" height="18.8" rx="2.4" />
    <path d="M12 7.4v6.4" /><path d="m9.6 11.4 2.4 2.4 2.4-2.4" />
  </Icono>
);

export const IconoRefrescar = (p: Props) => (
  <Icono {...p}>
    <path d="M20.2 12a8.2 8.2 0 1 1-2.5-5.9" />
    <path d="M20.5 4v4.4h-4.4" />
  </Icono>
);

export const IconoAtras = (p: Props) => (
  <Icono {...p}><path d="M19 12H5" /><path d="m10.5 6.5-5.5 5.5 5.5 5.5" /></Icono>
);

export const IconoSiguiente = (p: Props) => (
  <Icono {...p}><path d="M5 12h14" /><path d="m13.5 6.5 5.5 5.5-5.5 5.5" /></Icono>
);

export const IconoVeto = (p: Props) => (
  <Icono {...p}><circle cx="12" cy="12" r="8.6" /><path d="m6.5 6.5 11 11" /></Icono>
);

export const IconoLogo = (p: Props) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" {...p}>
    <rect width="48" height="48" rx="11" fill="#b4553a" />
    <circle cx="24" cy="24" r="8.5" fill="none" stroke="#faf0e6" strokeWidth="2.6" />
    <path
      d="M24 15.5c4 3 4 6 0 8.5s-4 5.5 0 8.5"
      fill="none"
      stroke="#faf0e6"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <circle cx="33.5" cy="15" r="3" fill="#f0c88a" />
  </svg>
);
