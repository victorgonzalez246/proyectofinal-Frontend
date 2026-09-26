import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// Hoja modal accesible: se cierra con Escape o tocando fuera, y devuelve el foco al cerrar
export default function Sheet({ title, onClose, children, labelledBy }) {
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Solo al abrir: enfocar la hoja, escuchar Escape y bloquear el scroll de fondo
  useEffect(() => {
    const previous = document.activeElement;
    sheetRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <motion.div
      className="p-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={sheetRef}
        className="p-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : title}
        tabIndex={-1}
        style={{ position: 'relative' }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <button type="button" className="p-icon-btn p-sheet__close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
