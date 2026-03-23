import { useState } from 'react'

export default function Dashboard() {
  const [importStatus, setImportStatus] = useState(null) // null | 'loading' | 'done' | 'error'
  const [importResult, setImportResult] = useState(null)

  async function importaDaBrevo() {
    setImportStatus('loading')
    setImportResult(null)
    try {
      const res = await fetch('/api/import-from-brevo', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setImportStatus('done')
        setImportResult(data)
      } else {
        setImportStatus('error')
        setImportResult({ error: data.error || 'Errore sconosciuto' })
      }
    } catch (e) {
      setImportStatus('error')
      setImportResult({ error: e.message })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Dashboard</h1>
        <p style={{ color: 'var(--txt2)', marginTop: 4, fontSize: 14 }}>
          Panoramica del CRM — in costruzione
        </p>
      </div>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          { label: 'Lead totali',        value: '—', color: 'var(--accent)' },
          { label: 'Consulenze fissate', value: '—', color: 'var(--green)'  },
          { label: 'Da richiamare',      value: '—', color: 'var(--amber)'  },
          { label: 'Task oggi',          value: '—', color: 'var(--txt)'    },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Import da Brevo */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Importa contatti da Brevo
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
          Importa automaticamente i lead dai webinar (liste Brevo) nel CRM.
          I duplicati vengono rilevati e saltati automaticamente.
        </div>

        <button
          onClick={importaDaBrevo}
          disabled={importStatus === 'loading'}
          style={{
            background: importStatus === 'loading' ? 'var(--txt3)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: importStatus === 'loading' ? 'not-allowed' : 'pointer',
            transition: 'opacity .2s',
          }}
        >
          {importStatus === 'loading' ? '⏳ Importazione in corso...' : '⬇ Importa da Brevo'}
        </button>

        {/* Risultato */}
        {importStatus === 'done' && importResult && (
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'var(--green-soft, #e8f5e9)',
            borderRadius: 8, fontSize: 13,
          }}>
            ✅ Import completato —{' '}
            <strong>{importResult.creati}</strong> creati,{' '}
            <strong>{importResult.aggiornati}</strong> aggiornati,{' '}
            <strong>{importResult.errori}</strong> errori
          </div>
        )}

        {importStatus === 'error' && (
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'var(--red-soft, #fdecea)',
            borderRadius: 8, fontSize: 13, color: 'var(--red, #c62828)',
          }}>
            ❌ Errore: {importResult?.error}
          </div>
        )}
      </div>

      {/* Dashboard in costruzione */}
      <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
        <div style={{ fontSize: 14 }}>La dashboard con KPI e report verrà costruita nel prossimo sprint.</div>
      </div>
    </div>
  )
}
