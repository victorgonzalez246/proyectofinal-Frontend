import ClimaPiel from '../clima/ClimaPiel.jsx'

// Cuidado de la piel según el clima del día (API externa Open-Meteo)
export default function ClimaSection() {
  return (
    <section id="clima" className="section" aria-labelledby="clima-titulo" style={{ paddingTop: 0 }}>
      <div
        className="container"
        style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))', alignItems: 'center' }}
      >
        <div>
          <span className="label-upper text-olive">Cuidado diario</span>
          <h2 id="clima-titulo" style={{ marginTop: '0.75rem' }}>
            El sol de Costa Rica, <span className="text-serif-italic">tu piel protegida</span>
          </h2>
          <hr className="divider" />
          <p style={{ color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.8, maxWidth: '34rem' }}>
            En el Valle Central el índice UV suele ser alto todo el año. Consulta el clima de hoy en Escazú y
            ajusta tu rutina: la protección solar y la hidratación prolongan los resultados de cada tratamiento.
          </p>
        </div>
        <ClimaPiel />
      </div>
    </section>
  )
}
