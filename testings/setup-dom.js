// Preparación común de las pruebas de componentes (entorno jsdom).
// Cada archivo de testings/componentes la importa al inicio.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Vitest corre sin globales: se limpia el DOM entre pruebas a mano
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom no implementa estas APIs del navegador que usan Recharts, framer-motion y usePreferences
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
