// Progreso de un paquete: "Sesión 2 de 3" con un segmento por sesión
export default function SessionMeter({ total, used }) {
  const label = used >= total ? 'Paquete completado' : `Sesión ${used} de ${total} realizada${used === 1 ? '' : 's'}`;
  return (
    <div>
      <div className="p-sessions" role="img" aria-label={label}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-used={i < used} />
        ))}
      </div>
      <p className="p-small">{used === 0 ? `${total} sesiones disponibles` : `${used} de ${total} sesiones realizadas`}</p>
    </div>
  );
}
