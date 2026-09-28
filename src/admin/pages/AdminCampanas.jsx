import { useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useCarga } from '../useCarga.js';
import Estado from '../components/Estado.jsx';

const MAX = 300;

export default function AdminCampanas() {
  const { data, loading, error, reload } = useCarga(adminService.getPacientes);
  const [mensaje, setMensaje] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const destinatarias = (data || []).filter((p) => p.promociones).length;
  const valido = mensaje.trim().length >= 10;

  const enviar = async () => {
    setEnviando(true);
    try {
      const { enviados } = await adminService.sendCampana(mensaje);
      toast.success(`Promoción enviada a ${enviados} paciente${enviados === 1 ? '' : 's'}.`);
      setMensaje('');
      setConfirmando(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Campañas</h1>
        <p className="p-lead">
          Se envían por WhatsApp solo a quienes marcaron la casilla de promociones al agendar. Cada mensaje incluye cómo darse de baja.
        </p>
      </header>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (
          <form className="p-panel a-form" onSubmit={(e) => { e.preventDefault(); if (valido) setConfirmando(true); }}>
            <p className="p-subtitle">
              {destinatarias === 0
                ? 'Ninguna paciente aceptó recibir promociones todavía.'
                : `La recibirán ${destinatarias} paciente${destinatarias === 1 ? '' : 's'}.`}
            </p>
            <div>
              <label className="p-label" htmlFor="mensaje">Mensaje</label>
              <textarea
                id="mensaje"
                className="p-field"
                rows={4}
                maxLength={MAX}
                placeholder="Este mes: 15 % en skinboosters de hidratación. Agenda respondiendo a este mensaje."
                value={mensaje}
                onChange={(e) => { setMensaje(e.target.value); setConfirmando(false); }}
              />
              <p className="a-counter">{mensaje.length}/{MAX}</p>
            </div>
            <p className="p-small">No incluyas datos clínicos ni nombres de tratamientos de una paciente en particular.</p>

            {confirmando ? (
              <div className="a-item__actions" role="group" aria-label="Confirmar envío">
                <p className="p-small" style={{ width: '100%' }}>¿Enviar ahora a {destinatarias} paciente{destinatarias === 1 ? '' : 's'}? No se puede deshacer.</p>
                <button type="button" className="p-btn" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Sí, enviar'}</button>
                <button type="button" className="p-btn p-btn--quiet" onClick={() => setConfirmando(false)}>Volver</button>
              </div>
            ) : (
              <div className="a-item__actions">
                <button type="submit" className="p-btn" disabled={!valido || destinatarias === 0}><Send size={16} /> Enviar promoción</button>
              </div>
            )}
          </form>
        )}
      </Estado>
    </>
  );
}
