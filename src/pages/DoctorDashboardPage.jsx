import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import api from '../services/api.js';
import { Users, LogOut, Search, Stethoscope } from 'lucide-react';

// Origen del registro de cada paciente (lo asigna el servidor)
const SOURCES = {
  'landing-cita': 'Cita desde la web',
  'recepcionista-ia': 'Recepcionista por WhatsApp',
};

export default function DoctorDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/admin/pacientes')
      .then((res) => { if (active) { setPatients(res.data || []); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/portal/acceso');
  };

  const term = searchTerm.toLowerCase();
  const filteredPatients = patients.filter((p) =>
    p.name?.toLowerCase().includes(term) ||
    p.email?.toLowerCase().includes(term) ||
    p.phone?.includes(searchTerm)
  );

  const emptyMessage = {
    loading: 'Cargando pacientes...',
    error: 'No pudimos cargar las pacientes. Revisa que el servidor esté activo.',
    ready: patients.length === 0 ? 'Todavía no hay pacientes registradas.' : 'Ninguna paciente coincide con la búsqueda.',
  }[status];

  return (
    <div className="min-h-screen bg-[var(--cream-bg)] text-[var(--charcoal)] font-sans selection:bg-[var(--nude-rose-20)] selection:text-[var(--charcoal)]">

      {/* Top Navigation */}
      <header className="border-b border-[var(--border-subtle)] bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--champagne-linen)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-[var(--taupe-atelier)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-serif font-bold text-[var(--charcoal)] uppercase tracking-wide">Panel Médico</h1>
                <span className="text-[10px] bg-[var(--nude-rose-10)] text-[var(--taupe-atelier)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full font-semibold">
                  Dra. Laura Jiménez
                </span>
              </div>
              <p className="text-[11px] text-[var(--stone-muted)]">Pacientes de la clínica</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs text-[var(--stone-muted)] hover:text-[var(--olive-maison)] px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--border-subtle)] transition-colors hidden sm:block"
            >
              Ver Landing Page
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[var(--nude-rose-10)] border border-[var(--border-subtle)] text-[var(--stone-muted)] hover:text-[var(--charcoal)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in-up">

        {/* Directorio de Pacientes */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[var(--charcoal)] flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--taupe-atelier)]" />
                Pacientes ({filteredPatients.length})
              </h2>
              <p className="text-xs text-[var(--stone-muted)]">
                Personas registradas al agendar una cita desde la web o por WhatsApp.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[var(--stone-light)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 py-1.5"
              />
            </div>
          </div>

          {/* Tabla de Pacientes */}
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-white/60 backdrop-blur-sm shadow-sm">
            <table className="w-full text-left text-xs text-[var(--charcoal)]">
              <thead className="bg-[var(--cream-bg)] text-[var(--stone-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Teléfono & Correo</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {status !== 'ready' || filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-[var(--stone-muted)]">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--nude-rose-10)] transition-colors">
                      <td className="px-4 py-3.5 font-medium text-[var(--charcoal)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--celadon-pearl)] text-[var(--olive-maison)] flex items-center justify-center font-bold text-[11px]">
                            {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="block text-[var(--charcoal)]">{p.phone || 'Sin teléfono'}</span>
                          <span className="block text-[11px] text-[var(--stone-light)]">{p.email || 'Sin correo'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--stone-muted)] text-[11px]">
                        {SOURCES[p.source] || 'Registro manual'}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--stone-muted)] text-[11px]">
                        {p.dateJoined ? new Date(p.dateJoined).toLocaleDateString('es-CR') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

    </div>
  );
}
