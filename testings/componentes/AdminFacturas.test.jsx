// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { adminService, descargarFacturaPdf } = vi.hoisted(() => ({
  adminService: { getFacturas: vi.fn(), getPacientes: vi.fn(), crearFactura: vi.fn(), actualizarFactura: vi.fn() },
  descargarFacturaPdf: vi.fn(),
}));
vi.mock('../../src/services/adminService.js', () => ({ adminService }));
vi.mock('../../src/lib/facturaPdf.js', () => ({ descargarFacturaPdf }));

import AdminFacturas from '../../src/admin/pages/AdminFacturas.jsx';
import { hoyCR } from '../../src/lib/factura.js';

const HOY = hoyCR();
const base = { metodoPago: 'sinpe', referencia: '111', subtotal: 100000, descuento: 0, impuesto: 0, impuestoMonto: 0, items: [{ descripcion: 'Valoración médica', cantidad: 1, precio: 100000 }] };
const FACTURAS = [
  { ...base, id: 'f1', numero: 'FAC-0001', fecha: HOY, estado: 'pagada', total: 100000, cliente: { nombre: 'Valeria Rojas' }, idPaciente: 'pac-1' },
  { ...base, id: 'f2', numero: 'FAC-0002', fecha: HOY, estado: 'pendiente', total: 50000, metodoPago: 'efectivo', referencia: '', cliente: { nombre: 'Mariana Solís' } },
];
const PACIENTES = [{ id: 'pac-1', name: 'Valeria Rojas', phone: '+506 8888 0001', email: 'valeria@example.com' }];

const renderizar = (ruta = '/admin/facturas') =>
  render(<MemoryRouter initialEntries={[ruta]}><AdminFacturas /></MemoryRouter>);

describe('<AdminFacturas /> (facturas de la doctora)', () => {
  beforeEach(() => {
    adminService.getFacturas.mockResolvedValue(FACTURAS);
    adminService.getPacientes.mockResolvedValue(PACIENTES);
    adminService.crearFactura.mockReset();
    adminService.actualizarFactura.mockReset();
    descargarFacturaPdf.mockReset();
  });

  it('muestra las facturas con su estado y las cifras del mes', async () => {
    renderizar();
    expect(await screen.findByText('FAC-0001 · Valeria Rojas')).toBeInTheDocument();
    expect(screen.getByText('FAC-0002 · Mariana Solís')).toBeInTheDocument();
    expect(screen.getByText('Cobrado este mes').parentElement).toHaveTextContent('₡100');
    expect(screen.getByText('Pendiente por cobrar').parentElement).toHaveTextContent('₡50');
    // filtro por estado
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes' }));
    expect(screen.queryByText('FAC-0001 · Valeria Rojas')).not.toBeInTheDocument();
    expect(screen.getByText('FAC-0002 · Mariana Solís')).toBeInTheDocument();
  });

  it('emite una factura: elige la paciente, calcula el total y exige el comprobante del SINPE', async () => {
    adminService.crearFactura.mockResolvedValue({ ...FACTURAS[0], id: 'f3', numero: 'FAC-0003', total: 146900 });
    renderizar();
    await screen.findByText('FAC-0001 · Valeria Rojas');
    fireEvent.click(screen.getByRole('button', { name: /Nueva factura/ }));
    const dialogo = await screen.findByRole('dialog');
    const form = within(dialogo);

    await waitFor(() => expect(form.getByRole('option', { name: /Valeria Rojas/ })).toBeInTheDocument());
    fireEvent.change(form.getByLabelText('Paciente registrada'), { target: { value: 'pac-1' } });
    expect(form.getByLabelText('Nombre completo *')).toHaveValue('Valeria Rojas');

    fireEvent.change(form.getByLabelText('Descripción'), { target: { value: 'Perfilado labial' } });
    fireEvent.change(form.getByLabelText('Precio (₡)'), { target: { value: '130000' } });
    fireEvent.change(form.getByLabelText('IVA'), { target: { value: '13' } });
    expect(form.getByText('Total').nextSibling).toHaveTextContent('₡146');

    fireEvent.click(form.getByRole('button', { name: 'Emitir factura' }));
    expect(form.getByRole('alert')).toHaveTextContent('comprobante del SINPE');
    expect(adminService.crearFactura).not.toHaveBeenCalled();

    fireEvent.change(form.getByLabelText('Número de comprobante SINPE *'), { target: { value: '20261001555' } });
    fireEvent.click(form.getByRole('button', { name: 'Emitir factura' }));
    await waitFor(() => expect(adminService.crearFactura).toHaveBeenCalledTimes(1));
    expect(adminService.crearFactura.mock.calls[0][0]).toMatchObject({
      idPaciente: 'pac-1',
      cliente: { nombre: 'Valeria Rojas', telefono: '+506 8888 0001' },
      items: [{ descripcion: 'Perfilado labial', cantidad: 1, precio: 130000 }],
      impuesto: 13,
      metodoPago: 'sinpe',
      referencia: '20261001555',
      estado: 'pagada',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('en efectivo no pide comprobante', async () => {
    adminService.crearFactura.mockResolvedValue({ ...FACTURAS[1], id: 'f4', numero: 'FAC-0004' });
    renderizar();
    await screen.findByText('FAC-0001 · Valeria Rojas');
    fireEvent.click(screen.getByRole('button', { name: /Nueva factura/ }));
    const form = within(await screen.findByRole('dialog'));
    fireEvent.change(form.getByLabelText('Nombre completo *'), { target: { value: 'Cliente sin registro' } });
    fireEvent.change(form.getByLabelText('Descripción'), { target: { value: 'Valoración médica' } });
    fireEvent.change(form.getByLabelText('Precio (₡)'), { target: { value: '30000' } });
    fireEvent.click(form.getByRole('button', { name: 'Efectivo' }));
    expect(form.queryByLabelText(/comprobante/i)).not.toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Emitir factura' }));
    await waitFor(() => expect(adminService.crearFactura).toHaveBeenCalled());
    expect(adminService.crearFactura.mock.calls[0][0]).toMatchObject({ metodoPago: 'efectivo', idPaciente: undefined });
  });

  it('registra el pago de una pendiente y anula con motivo', async () => {
    adminService.actualizarFactura.mockImplementation(async (id, cambios) => ({ ...FACTURAS.find((f) => f.id === id), ...cambios }));
    renderizar();
    await screen.findByText('FAC-0002 · Mariana Solís');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const cobro = within(await screen.findByRole('dialog'));
    fireEvent.click(cobro.getByRole('button', { name: 'Marcar como pagada' }));
    await waitFor(() => expect(adminService.actualizarFactura).toHaveBeenCalledWith('f2', { estado: 'pagada', metodoPago: 'efectivo', referencia: '' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Anular' })[0]);
    const anular = within(await screen.findByRole('dialog'));
    fireEvent.click(anular.getByRole('button', { name: 'Anular factura' }));
    expect(anular.getByRole('alert')).toHaveTextContent('motivo');
    fireEvent.change(anular.getByLabelText('Motivo *'), { target: { value: 'Monto incorrecto' } });
    fireEvent.click(anular.getByRole('button', { name: 'Anular factura' }));
    await waitFor(() => expect(adminService.actualizarFactura).toHaveBeenLastCalledWith('f1', { estado: 'anulada', motivo: 'Monto incorrecto' }));
  });

  it('descarga el PDF de una factura', async () => {
    renderizar();
    await screen.findByText('FAC-0001 · Valeria Rojas');
    fireEvent.click(screen.getAllByRole('button', { name: /Descargar PDF/ })[0]);
    await waitFor(() => expect(descargarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({ numero: 'FAC-0001' })));
  });

  it('desde la ficha de una paciente abre el formulario con sus datos', async () => {
    renderizar('/admin/facturas?paciente=pac-1');
    const form = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(form.getByLabelText('Nombre completo *')).toHaveValue('Valeria Rojas'));
    expect(form.getByLabelText('Paciente registrada')).toHaveValue('pac-1');
  });
});
