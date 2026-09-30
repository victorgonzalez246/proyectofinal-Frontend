// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// El servicio real usa @anthropic-ai/sdk contra el proxy; aquí se simula la respuesta en streaming
const { preguntarAlAsistente } = vi.hoisted(() => ({ preguntarAlAsistente: vi.fn() }));
vi.mock('../../src/services/asistenteService.js', () => ({ preguntarAlAsistente }));

import AsistenteVirtual from '../../src/components/asistente/AsistenteVirtual.jsx';

const renderizar = () =>
  render(
    <MemoryRouter>
      <AsistenteVirtual variante="landing" />
    </MemoryRouter>
  );

const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir asistente virtual' }));
const escribir = (texto) => fireEvent.change(screen.getByLabelText('Escribe tu pregunta'), { target: { value: texto } });

describe('<AsistenteVirtual /> (chat con IA)', () => {
  // Con llaves: si beforeEach devuelve una función, Vitest la ejecuta como limpieza al terminar la prueba
  beforeEach(() => {
    preguntarAlAsistente.mockReset();
  });

  it('abre un diálogo accesible con bienvenida, sugerencias y foco en el campo', () => {
    renderizar();
    const lanzador = screen.getByRole('button', { name: 'Abrir asistente virtual' });
    expect(lanzador).toHaveAttribute('aria-expanded', 'false');

    abrir();
    expect(screen.getByRole('dialog', { name: /Aura/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar asistente virtual', expanded: true })).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('Hola, soy Aura');
    expect(screen.getByRole('list', { name: 'Preguntas sugeridas' })).toBeInTheDocument();
    expect(screen.getByLabelText('Escribe tu pregunta')).toHaveFocus();
  });

  it('envía la pregunta y muestra la respuesta a medida que llega', async () => {
    preguntarAlAsistente.mockImplementation(async (mensajes, alRecibir) => {
      alRecibir('La valoración ');
      alRecibir('es **presencial** con la doctora.');
      return { aviso: '' };
    });
    renderizar();
    abrir();
    escribir('¿Cómo es la valoración?');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));

    expect(await screen.findByText('presencial')).toBeInTheDocument();
    expect(screen.getByText('presencial').tagName).toBe('STRONG'); // formato de negritas sin innerHTML
    expect(screen.getByText('¿Cómo es la valoración?')).toBeInTheDocument();
    expect(preguntarAlAsistente.mock.calls[0][0]).toEqual([{ role: 'user', content: '¿Cómo es la valoración?' }]);
  });

  it('manda el historial alternando paciente y asistente', async () => {
    preguntarAlAsistente.mockImplementation(async (mensajes, alRecibir) => {
      alRecibir(`Respuesta ${mensajes.length}`);
      return { aviso: '' };
    });
    renderizar();
    abrir();
    escribir('Primera');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await screen.findByText('Respuesta 1');
    escribir('Segunda');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await screen.findByText('Respuesta 3');
    expect(preguntarAlAsistente.mock.calls[1][0].map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('si falla muestra el error, ofrece WhatsApp y devuelve la pregunta al campo', async () => {
    preguntarAlAsistente.mockRejectedValue(new Error('El asistente no está disponible en este momento.'));
    renderizar();
    abrir();
    escribir('Hola');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible');
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    await waitFor(() => expect(screen.getByLabelText('Escribe tu pregunta')).toHaveValue('Hola'));
  });

  it('Escape cierra el panel y devuelve el foco al botón', () => {
    renderizar();
    abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    const lanzador = screen.getByRole('button', { name: 'Abrir asistente virtual' });
    expect(lanzador).toHaveAttribute('aria-expanded', 'false');
    expect(lanzador).toHaveFocus();
  });
});
