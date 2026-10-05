import { adminService } from '../services/adminService.js';

// Foto de los datos del panel para Aura (solo lectura). Cada sección sale de las mismas rutas /admin/*
// que usa el panel. El resumen general se guarda 2 minutos para no repetir llamadas a n8n en cada pregunta;
// las fichas completas (plan, productos con lote y vencimiento, citas, check-ins) se piden solo cuando hacen falta.
const VIGENCIA_MS = 2 * 60 * 1000;
const MAX_FICHAS = 25;
const PIDE_PRODUCTOS = /\b(producto|productos|lote|lotes|vence|vencen|vencimiento|caduc|inventario|paquete|paquetes|plan|planes)\b/i;

let cache = null; // { hora, datos }

const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Una sección que falla no tumba a las demás: Aura sabrá que ese dato no llegó
const seguro = (promesa) => promesa.catch((err) => ({ error: err.message }));

async function resumenGeneral() {
  if (cache && Date.now() - cache.hora < VIGENCIA_MS) return cache.datos;
  const [hoy, citas, pacientes, alertas, facturas, tratamientos, estadisticas] = await Promise.all([
    seguro(adminService.getHoy()),
    seguro(adminService.getCitas()),
    seguro(adminService.getPacientes()),
    seguro(adminService.getAlertas()),
    seguro(adminService.getFacturas()),
    seguro(adminService.getTratamientos()),
    seguro(adminService.getEstadisticas()),
  ]);
  const datos = { hoy, citas, pacientes, alertas, facturas, tratamientos, estadisticas };
  cache = { hora: Date.now(), datos };
  return datos;
}

// Pacientes cuya ficha conviene adjuntar: las que la doctora nombra (nombre o apellido) o, si pregunta
// por productos, lotes o planes, todas las que tienen plan (hasta MAX_FICHAS)
export function pacientesMencionadas(pregunta, pacientes) {
  if (!Array.isArray(pacientes)) return [];
  const texto = sinTildes(pregunta);
  const nombradas = pacientes.filter((p) =>
    sinTildes(p.name).split(/\s+/).some((parte) => parte.length >= 4 && new RegExp(`\\b${parte}\\b`).test(texto))
  );
  if (nombradas.length) return nombradas.slice(0, MAX_FICHAS);
  if (PIDE_PRODUCTOS.test(texto)) return pacientes.filter((p) => p.tienePlan).slice(0, MAX_FICHAS);
  return [];
}

/**
 * Contexto en texto (JSON) para la pregunta de la doctora.
 * @param {string} pregunta  último mensaje de la doctora
 * @param {string[]} conversacion  mensajes anteriores de la doctora (para seguir hablando de la misma paciente)
 */
export async function contextoParaAura(pregunta, conversacion = []) {
  const general = await resumenGeneral();
  const elegidas = pacientesMencionadas([pregunta, ...conversacion.slice(-3)].join(' '), general.pacientes);
  const fichas = await Promise.all(elegidas.map((p) => seguro(adminService.getPaciente(p.id))));
  return JSON.stringify({
    generado: new Date().toISOString(),
    ...general,
    fichas: fichas.length ? fichas : 'Sin fichas adjuntas: nombre a la paciente para ver su plan, productos, citas y check-ins.',
  });
}

// Tras cambiar datos en el panel, la próxima pregunta vuelve a leerlos
export const olvidarContextoAura = () => { cache = null; };
