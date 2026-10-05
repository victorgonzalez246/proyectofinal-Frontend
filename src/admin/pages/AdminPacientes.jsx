import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { formatDate } from '../../portal/lib/format.js';
import { useCarga } from '../useCarga.js';
import { ORIGENES } from '../lib.js';
import Estado from '../components/Estado.jsx';

export default function AdminPacientes() {
  const { data, loading, error, reload } = useCarga(adminService.getPacientes);
  const [busqueda, setBusqueda] = useState('');

  const termino = busqueda.trim().toLowerCase();
  const digitos = termino.replace(/\D/g, '');
  const pacientes = (data || []).filter((p) =>
    !termino ||
    p.name?.toLowerCase().includes(termino) ||
    p.email?.toLowerCase().includes(termino) ||
    (digitos && p.phone?.replace(/\D/g, '').includes(digitos))
  );

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Pacientes</h1>
        <p className="p-lead">Quien agenda una cita queda registrada aquí. Abre su ficha para crear o editar su plan.</p>
      </header>

      <div className="a-toolbar">
        <div style={{ position: 'relative', flex: '1 1 16rem', maxWidth: '22rem' }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--p-muted)' }} />
          <input
            type="search"
            aria-label="Buscar paciente"
            className="p-field"
            style={{ paddingLeft: '2.4rem', maxWidth: 'none' }}
            placeholder="Nombre, correo o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {data && <p className="p-small">{pacientes.length} de {data.length}</p>}
      </div>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (pacientes.length === 0 ? (
          <p className="p-empty">{data.length === 0 ? 'Todavía no hay pacientes registradas.' : 'Ninguna paciente coincide con la búsqueda.'}</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Contacto</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Registro</th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/admin/pacientes/${p.id}`} className="p-link" style={{ fontSize: '0.9rem' }}>{p.name}</Link>
                      {p.promociones && <p className="p-small">Acepta promociones</p>}
                    </td>
                    <td>
                      <span>{p.phone || 'Sin teléfono'}</span>
                      <p className="p-small">{p.email || 'Sin correo'}</p>
                    </td>
                    <td>{p.tienePlan ? <span className="p-chip">Con plan</span> : <span className="p-chip p-chip--rose">Sin plan</span>}</td>
                    <td className="p-small">{ORIGENES[p.source] || 'Registro manual'}</td>
                    <td className="p-small">{p.dateJoined ? formatDate(p.dateJoined) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Estado>
    </>
  );
}
