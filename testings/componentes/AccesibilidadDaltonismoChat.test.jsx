// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Las órdenes de accesibilidad no deben llegar a la IA
const { preguntarAlAsistente } = vi.hoisted(() => ({ preguntarAlAsistente: vi.fn() }));
vi.mock('../../src/services/asistenteService.js', () => ({ preguntarAlAsistente }));

import AccesibilidadLanding from '../../src/components/ui/AccesibilidadLanding.jsx';
import AsistenteVirtual from '../../src/components/asistente/AsistenteVirtual.jsx';

// Landing real: panel de accesibilidad y Aura comparten las mismas preferencias
const renderizar = () =>
  render(
    <MemoryRouter>
      <AccesibilidadLanding>
        <main id="contenido"><p>Contenido del sitio</p></main>
        <AsistenteVirtual variante="landing" />
      </AccesibilidadLanding>
    </MemoryRouter>
  );

const abrirAccesibilidad = () => fireEvent.click(screen.getByRole('button', { name: 'Opciones de accesibilidad' }));
const pedirAAura = (texto) => {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir asistente virtual' }));
  fireEvent.change(screen.getByLabelText('Escribe tu pregunta'), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
};

describe('daltonismo y órdenes de accesibilidad en el chat', () => {
  beforeEach(() => {
    preguntarAlAsistente.mockReset();
  });

  it('el panel ofrece los modos de daltonismo como radios y filtra toda la página', () => {
    renderizar();
    abrirAccesibilidad();
    const grupo = screen.getByRole('group', { name: 'Daltonismo' });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Colores normales/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /Deuteranopia/ }));
    expect(screen.getByRole('radio', { name: /Deuteranopia/ })).toBeChecked();
    expect(document.documentElement.style.filter).toContain('#a11y-deuteranopia');
    expect(document.getElementById('a11y-deuteranopia')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('portal-prefs')).daltonismo).toBe('deuteranopia');

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(document.documentElement.style.filter).toBe('');
  });

  it('Aura cambia el modo de daltonismo sin llamar a la IA y el panel lo refleja', () => {
    renderizar();
    pedirAAura('Activa el modo protanopia');

    expect(preguntarAlAsistente).not.toHaveBeenCalled();
    expect(document.documentElement.style.filter).toContain('#a11y-protanopia');
    expect(screen.getByRole('log')).toHaveTextContent('activé el modo para protanopia');
    expect(screen.getByText(/^Aura respondió: Listo, activé el modo para protanopia/)).toHaveAttribute('aria-live', 'polite');

    abrirAccesibilidad();
    expect(screen.getByRole('radio', { name: /Protanopia/ })).toBeChecked();
  });

  it('una pregunta normal sobre colores sigue yendo a la IA', async () => {
    preguntarAlAsistente.mockImplementation(async (_m, alRecibir) => {
      alRecibir('Respuesta de Aura');
      return { aviso: '' };
    });
    renderizar();
    pedirAAura('Tengo manchas rojas en la cara');
    expect(await screen.findByText('Respuesta de Aura')).toBeInTheDocument();
    expect(preguntarAlAsistente).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.filter).toBe('');
  });

  it('pedir que lea la página sin soporte de voz explica alternativas (TalkBack)', () => {
    renderizar();
    pedirAAura('Lee la página en voz alta');
    expect(preguntarAlAsistente).not.toHaveBeenCalled();
    expect(screen.getByRole('log')).toHaveTextContent('TalkBack');
  });
});
