// Estados de carga y error comunes a todas las páginas del panel
export default function Estado({ loading, error, onRetry, children }) {
  if (error) {
    return (
      <div className="p-empty" role="alert">
        <p>{error}</p>
        <button type="button" className="p-btn p-btn--quiet" style={{ marginTop: '1rem' }} onClick={onRetry}>
          Reintentar
        </button>
      </div>
    );
  }
  if (loading && !children) return <p className="p-small" role="status">Cargando…</p>;
  return (
    <div aria-busy={loading}>
      {children}
    </div>
  );
}
