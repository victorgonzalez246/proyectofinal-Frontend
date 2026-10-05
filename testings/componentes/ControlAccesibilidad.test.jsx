// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AccesibilidadLanding from '../../src/components/ui/AccesibilidadLanding.jsx';

const renderizar = () =>
  render(
    <MemoryRouter>
      <AccesibilidadLanding>
        <main><p>Contenido del sitio</p></main>
      </AccesibilidadLanding>
    </MemoryRouter>
  );

const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Opciones de accesibilidad' }));

describe('selector de accesibilidad del sitio público', () => {
  it('abre un panel etiquetado y lo cierra con Escape devolviendo el foco', () => {
    renderizar();
    const boton = screen.getByRole('button', { name: 'Opciones de accesibilidad' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    abrir();
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Accesibilidad' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveFocus();
  });

  it('agranda el texto de todo el documento', () => {
    renderizar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Texto muy grande' }));
    expect(screen.getByRole('button', { name: 'Texto muy grande' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.style.fontSize).toBe('130%');
  });

  it('activa alto contraste y reducir animaciones como interruptores', () => {
    renderizar();
    abrir();
    const contraste = screen.getByRole('switch', { name: 'Alto contraste' });
    const animaciones = screen.getByRole('switch', { name: 'Reducir animaciones' });
    expect(contraste).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(contraste);
    fireEvent.click(animaciones);
    expect(contraste).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('a11y-alto-contraste', 'a11y-sin-animaciones');
  });

  it('recuerda las preferencias y permite restablecerlas', () => {
    renderizar();
    abrir();
    fireEvent.click(screen.getByRole('switch', { name: 'Alto contraste' }));
    expect(JSON.parse(localStorage.getItem('portal-prefs')).contrast).toBe('high');

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(document.documentElement).not.toHaveClass('a11y-alto-contraste');
    expect(document.documentElement.style.fontSize).toBe('100%');
  });
});
