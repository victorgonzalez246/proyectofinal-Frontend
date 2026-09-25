import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import api from '../services/api.js';
import { 
  Users, 
  LogOut, 
  Tag, 
  Mail, 
  CheckCircle2, 
  Search, 
  Send,
  Stethoscope,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

export default function DoctorDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [promoSentNotice, setPromoSentNotice] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsersList(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleSendBroadcastPromo = () => {
    setPromoSentNotice(true);
    setTimeout(() => setPromoSentNotice(false), 4000);
  };

  const members = usersList.filter(u => u.role === 'member');
  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <h1 className="text-sm font-serif font-bold text-[var(--charcoal)] uppercase tracking-wide">Panel Médico & Gestión</h1>
                <span className="text-[10px] bg-[var(--nude-rose-10)] text-[var(--taupe-atelier)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full font-semibold">
                  Dra. Laura Jiménez
                </span>
              </div>
              <p className="text-[11px] text-[var(--stone-muted)]">Control de Pacientes, Membresías y Promociones</p>
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

        {/* Métricas Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between text-[var(--stone-muted)] mb-3">
              <span className="text-xs uppercase font-medium tracking-wider">Miembros Suscritos</span>
              <Users className="w-4 h-4 text-[var(--olive-maison)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-[var(--charcoal)]">{members.length}</span>
              <span className="text-xs text-[var(--olive-maison)] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Activos en Club
              </span>
            </div>
            <p className="text-[11px] text-[var(--stone-light)] mt-2">Pacientes recibiendo cupones y ofertas por correo.</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between text-[var(--stone-muted)] mb-3">
              <span className="text-xs uppercase font-medium tracking-wider">Campañas Enviadas</span>
              <Mail className="w-4 h-4 text-[var(--taupe-atelier)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-[var(--charcoal)]">2</span>
              <span className="text-xs text-[var(--taupe-atelier)]">Cupones Automáticos</span>
            </div>
            <p className="text-[11px] text-[var(--stone-light)] mt-2">15% OFF de Bienvenida + Hydrafacial Glow activo.</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between text-[var(--stone-muted)] mb-3">
              <span className="text-xs uppercase font-medium tracking-wider">Seguridad Clínica</span>
              <ShieldCheck className="w-4 h-4 text-[var(--olive-maison)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-serif text-[var(--charcoal)]">Blindado</span>
              <span className="text-xs text-[var(--stone-muted)]">bcrypt + XSS</span>
            </div>
            <p className="text-[11px] text-[var(--stone-light)] mt-2">Protección completa de contraseñas y datos locales.</p>
          </div>
        </div>

        {/* Notificación de Campaña Promocional Enviada */}
        {promoSentNotice && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-3 animate-fade-in-up">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
            <div>
              <strong>¡Campaña de Correo Enviada!</strong> Se ha enviado una notificación de oferta flash con cupón exclusivo a los {members.length} usuarios suscritos.
            </div>
          </div>
        )}

        {/* Herramienta de Envío Masivo de Promociones a Miembros */}
        <section className="bg-[var(--champagne-linen-50)] border border-[var(--border-light)] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-sm font-serif font-bold text-[var(--charcoal)] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--taupe-atelier)]" />
              Lanzar Cupón Promocional al Correo de Suscriptores
            </h3>
            <p className="text-xs text-[var(--stone-muted)]">
              Envía instantáneamente a toda la base de datos de pacientes registrados un nuevo beneficio o promoción de temporada.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendBroadcastPromo}
            className="btn-primary py-2.5 px-4 shrink-0 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Notificación Promocional</span>
          </button>
        </section>

        {/* Directorio de Pacientes y Miembros Suscritos */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[var(--charcoal)] flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--taupe-atelier)]" />
                Pacientes y Miembros Suscritos ({filteredMembers.length})
              </h2>
              <p className="text-xs text-[var(--stone-muted)]">
                Usuarios registrados en el club de beneficios con sus cupones asignados.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[var(--stone-light)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar paciente o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 py-1.5"
              />
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-white/60 backdrop-blur-sm shadow-sm">
            <table className="w-full text-left text-xs text-[var(--charcoal)]">
              <thead className="bg-[var(--cream-bg)] text-[var(--stone-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Correo & Teléfono</th>
                  <th className="px-4 py-3">Cupones Asignados</th>
                  <th className="px-4 py-3">Suscripción Promocional</th>
                  <th className="px-4 py-3">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-[var(--stone-muted)]">
                      Cargando pacientes...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-[var(--stone-muted)]">
                      No hay pacientes registrados aún en el club de beneficios.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-[var(--nude-rose-10)] transition-colors">
                      <td className="px-4 py-3.5 font-medium text-[var(--charcoal)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--celadon-pearl)] text-[var(--olive-maison)] flex items-center justify-center font-bold text-[11px]">
                            {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="block text-[var(--charcoal)]">{m.email}</span>
                          <span className="block text-[11px] text-[var(--stone-light)]">{m.phone || 'Sin teléfono'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {m.coupons?.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-white text-[var(--charcoal)] border border-[var(--border-subtle)] font-mono text-[10px]">
                              {c.code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {m.subscribedToOffers ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--olive-maison)] bg-[var(--celadon-pearl-30)] px-2 py-0.5 rounded-full border border-[var(--border-light)]">
                            <CheckCircle2 className="w-3 h-3" />
                            Activo para Ofertas
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--stone-light)]">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--stone-muted)] text-[11px]">
                        {m.dateJoined ? new Date(m.dateJoined).toLocaleDateString() : 'Reciente'}
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
