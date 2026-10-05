// Unitarias: cómo muestra el panel las alertas que llegan del chat de WhatsApp (POST /n8n/alerta)
import { describe, expect, it } from 'vitest';
import { distintivoAlerta } from '../../src/admin/lib.js';
import { analiticaOperativa } from '../../src/admin/metricas.js';

describe('panel: alertas de WhatsApp', () => {
  it('llevan el distintivo "WhatsApp" y su tipo; las de siempre no cambian', () => {
    expect(distintivoAlerta({ tipo: 'whatsapp', subtipo: 'emergencia' })).toEqual({ etiqueta: 'WhatsApp', chip: 'p-chip p-chip--alert', detalle: 'Emergencia' });
    expect(distintivoAlerta({ tipo: 'whatsapp', subtipo: 'enfermera' })).toMatchObject({ etiqueta: 'WhatsApp', detalle: 'Enfermera IA' });
    expect(distintivoAlerta({ tipo: 'whatsapp', subtipo: 'ia_sin_respuesta' })).toMatchObject({ detalle: 'Sin respuesta de la IA' });
    expect(distintivoAlerta({ tipo: 'sos' })).toEqual({ etiqueta: 'SOS', chip: 'p-chip p-chip--alert', detalle: '' });
    expect(distintivoAlerta({ tipo: 'checkin' })).toEqual({ etiqueta: 'Check-in', chip: 'p-chip p-chip--rose', detalle: '' });
  });

  it('las métricas las cuentan con su propio motivo', () => {
    const op = analiticaOperativa([], [], [
      { tipo: 'whatsapp', subtipo: 'emergencia', estado: 'abierta' },
      { tipo: 'whatsapp', subtipo: 'enfermera', estado: 'atendida' },
      { tipo: 'sos', motivo: 'dolor', estado: 'abierta' },
    ]);
    expect(op.alertas).toMatchObject({ total: 3, abiertas: 2, atendidas: 1 });
    expect(op.alertas.porMotivo.map((m) => m.motivo).sort()).toEqual(['Dolor fuerte', 'WhatsApp: Enfermera IA', 'WhatsApp: emergencia']);
  });
});
