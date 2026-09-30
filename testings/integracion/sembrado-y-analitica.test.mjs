// Integración: datos de demostración → API real (api/nucleo.mjs, la misma lógica que usa n8n) → analítica de los dashboards.
// Genera la base con `npm run sembrar:demo` en un archivo temporal (no toca db.json).
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApi } from '../../api/nucleo.mjs';
import { analiticaOperativa, calcularMetricas } from '../../src/admin/metricas.js';
import { curvaPromedio, progresoPlan, resumenRecuperacion } from '../../src/lib/analitica.js';

const api = crearApi({
  secretoSesion: 'secreto-de-integracion',
  secretoN8n: 'n8n-de-integracion',
  portalUrl: 'http://localhost:5173',
  modoDesarrollo: true, // el enlace mágico se devuelve en la respuesta, sin WhatsApp
  cripto: {
    hmac: (k, t) => crypto.createHmac('sha256', k).update(t).digest('hex'),
    sha256: (t) => crypto.createHash('sha256').update(t).digest('hex'),
    aleatorio: (b) => crypto.randomBytes(b).toString('hex'),
    igual: (a, b) => a === b,
  },
});

let db;
const llamar = (metodo, ruta, { token, body, query } = {}) =>
  api.manejar({ metodo, ruta, body, query, headers: token ? { authorization: `Bearer ${token}` } : {} }, db);
const entrar = (telefono) => {
  const { body } = llamar('POST', '/auth/magic-link', { body: { phone: telefono } });
  return llamar('POST', '/auth/verify', { body: { token: body.devLink.split('#')[1] } }).body.token;
};

beforeAll(() => {
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-demo-')), 'db.json');
  const r = spawnSync(process.execPath, ['scripts/sembrar-demo.mjs'], { env: { ...process.env, DB_FILE: archivo }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  db = JSON.parse(fs.readFileSync(archivo, 'utf8'));
});

describe('datos de demostración', () => {
  it('son íntegros: toda cita, plan, check-in y alerta pertenece a una paciente existente', () => {
    const ids = new Set(db.users.map((u) => u.id));
    for (const tabla of ['appointments', 'portal', 'checkins', 'sosAlerts']) {
      expect(db[tabla].every((fila) => ids.has(fila.userId)), tabla).toBe(true);
    }
    expect(db.users.filter((u) => u.role === 'doctor')).toHaveLength(1);
  });

  it('respetan las reglas del negocio', () => {
    // La Recepcionista IA solo registra citas confirmadas y con hora
    expect(db.appointments.filter((c) => c.origen === 'recepcionista-ia' && c.estado === 'pendiente')).toHaveLength(0);
    expect(db.appointments.filter((c) => c.estado === 'confirmada').every((c) => /^\d{2}:\d{2}$/.test(c.hora))).toBe(true);
    // Ningún registro con fecha futura y solo quedan abiertas las alertas recientes
    expect(db.checkins.filter((c) => Date.parse(c.createdAt) > Date.now())).toHaveLength(0);
    // Los teléfonos son ficticios (+506 8888 ...)
    expect(db.users.every((u) => u.phone.startsWith('+506 8888'))).toBe(true);
  });
});

describe('dashboard de la doctora con la API real', () => {
  let doctora;
  let citas;
  let pacientes;
  let alertas;
  beforeAll(() => {
    doctora = entrar('8888 8888');
    citas = llamar('GET', '/admin/citas', { token: doctora }).body;
    pacientes = llamar('GET', '/admin/pacientes', { token: doctora }).body;
    alertas = llamar('GET', '/admin/alertas', { token: doctora }).body;
  });

  it('la API entrega los datos que necesitan las métricas', () => {
    expect(citas.length).toBeGreaterThan(50);
    expect(pacientes.filter((p) => p.tienePlan).length).toBeGreaterThanOrEqual(5);
    expect(alertas.some((a) => a.estado === 'abierta')).toBe(true);
  });

  it('las métricas de agenda y operación salen coherentes', () => {
    const m = calcularMetricas(citas, pacientes, { meses: 6 });
    const op = analiticaOperativa(citas, pacientes, alertas, { meses: 6 });
    expect(m.kpis.total).toBe(m.kpis.confirmadas + m.kpis.pendientes + m.kpis.canceladas);
    expect(m.kpis.tasaConfirmacion).toBeGreaterThan(70);
    expect(op.porDiaSemana.reduce((s, d) => s + d.total, 0)).toBe(m.kpis.total - m.kpis.canceladas);
    expect(op.alertas.total).toBe(alertas.length);
    expect(op.fidelizacion.tasaRetorno).toBeGreaterThan(0);
  });

  it('la curva de recuperación promedio muestra que la molestia baja', () => {
    const recuperaciones = pacientes
      .filter((p) => p.tienePlan)
      .map((p) => llamar('GET', '/admin/pacientes/ficha', { token: doctora, query: { id: p.id } }).body)
      .map((ficha) => ({ checkins: ficha.checkins, fechaTratamiento: ficha.plan.lastTreatment.date }));
    const curva = curvaPromedio(recuperaciones).filter((t) => t.molestia !== null);
    expect(curva.length).toBeGreaterThanOrEqual(4);
    expect(curva.at(-1).molestia).toBeLessThan(curva[0].molestia);
  });
});

describe('dashboard de la paciente con la API real', () => {
  it('Valeria ve su evolución: la molestia mejora y el plan avanza', () => {
    const paciente = entrar('8888 0001');
    const plan = llamar('GET', '/me/portal', { token: paciente }).body;
    const checkins = llamar('GET', '/me/checkins', { token: paciente }).body;

    const resumen = resumenRecuperacion(checkins, plan.lastTreatment.date);
    expect(resumen.tendencia).toBe('mejora');
    expect(resumen.mejora).toBeGreaterThan(50);
    expect(progresoPlan(plan.roadmap).completados).toBeGreaterThan(0);
  });

  it('una paciente no puede ver los datos del panel', () => {
    const paciente = entrar('8888 0001');
    expect(llamar('GET', '/admin/citas', { token: paciente }).status).toBe(403);
  });
});
