export default function Dashboard() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Dashboard</h1>
        <p style={{ color: 'var(--txt2)', marginTop: 4, fontSize: 14 }}>
          Panoramica del CRM — in costruzione
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          { label: 'Lead totali',        value: '—', color: 'var(--accent)' },
          { label: 'Consulenze fissate', value: '—', color: 'var(--green)' },
          { label: 'Da richiamare',      value: '—', color: 'var(--amber)' },
          { label: 'Task oggi',          value: '—', color: 'var(--txt)' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--txt3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
        <div style={{ fontSize: 14 }}>La dashboard con KPI e report verrà costruita nel prossimo sprint.</div>
      </div>
    </div>
  )
}
