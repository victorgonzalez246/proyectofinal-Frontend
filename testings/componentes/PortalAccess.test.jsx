// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Se simula la API de acceso (la misma que atiende n8n en producción)
const { authService } = vi.hoisted(() => ({
  authService: {
    requestMagicLink: vi.fn(),
    verifyCode: vi.fn(),
    verifyMagicLink: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    logout: vi.fn(),
  },
}));
vi.mock('../../src/services/authService.js', () => ({ authService }));

import { AuthProvider } from '../../src/context/AuthContext.jsx';
import PortalAccess from '../../src/portal/pages/PortalAccess.jsx';

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={['/portal/acceso']}>
      <AuthProvider>
        <Routes>
          <Route path="/portal/acceso" element={<PortalAccess />} />
          <Route path="/portal" element={<p>Portal de la paciente</p>} />
          <Route path="/admin" element={<p>Panel médico</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

const pedirCodigo = async (telefono = '8888 0001') => {
  fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: telefono } });
  fireEvent.click(screen.getByRole('button', { name: /Enviar código por WhatsApp/ }));
  return screen.findByLabelText('Código de acceso');
};

describe('<PortalAccess /> (acceso con código de WhatsApp)', () => {
  beforeEach(() => {
    authService.requestMagicLink.mockReset();
    authService.verifyCode.mockReset();
  });

  it('pide el número y valida que tenga 8 dígitos', () => {
    renderizar();
    fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar código por WhatsApp/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('8 dígitos');
    expect(authService.requestMagicLink).not.toHaveBeenCalled();
  });

  it('después de pedirlo muestra el campo del código, listo para autocompletar', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true });
    renderizar();
    const campo = await pedirCodigo();
    expect(authService.requestMagicLink).toHaveBeenCalledWith('+506 8888 0001');
    expect(campo).toHaveAttribute('autocomplete', 'one-time-code');
    expect(campo).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('status')).toHaveTextContent('código de 6 dígitos');
  });

  it('solo acepta dígitos y exige los 6', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true });
    renderizar();
    const campo = await pedirCodigo();
    fireEvent.change(campo, { target: { value: '12a3' } });
    expect(campo).toHaveValue('123');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 dígitos');
    expect(authService.verifyCode).not.toHaveBeenCalled();
  });

  it('con el código correcto entra: la doctora va al panel', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true });
    authService.verifyCode.mockResolvedValue({ user: { role: 'doctor' }, token: 't' });
    renderizar();
    fireEvent.change(await pedirCodigo('8575 8780'), { target: { value: '482913' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Panel médico')).toBeInTheDocument();
    expect(authService.verifyCode).toHaveBeenCalledWith('+506 8575 8780', '482913');
  });

  it('una paciente va a su portal', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true });
    authService.verifyCode.mockResolvedValue({ user: { role: 'member' }, token: 't' });
    renderizar();
    fireEvent.change(await pedirCodigo(), { target: { value: '000111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Portal de la paciente')).toBeInTheDocument();
  });

  it('si el código es incorrecto lo explica y permite reintentar', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true });
    authService.verifyCode.mockRejectedValue(new Error('El código no es válido o ya venció. Pide uno nuevo.'));
    renderizar();
    fireEvent.change(await pedirCodigo(), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no es válido');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('en desarrollo (sin n8n) muestra el código para poder probar', async () => {
    authService.requestMagicLink.mockResolvedValue({ ok: true, devCodigo: '123456', devLink: 'http://localhost:5173/portal/verificar#x' });
    renderizar();
    await pedirCodigo();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enlace de acceso/ })).toBeInTheDocument();
  });
});
