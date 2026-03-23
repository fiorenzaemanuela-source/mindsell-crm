import { useState } from 'react'

export default function Dashboard() {
  const [stato, setStato] = useState(null)
  const [totali, setTotali] = useState({ creati: 0, aggiornati: 0 })
  const [listaCorrente, setListaCorrente] = useState('')

  async function importaDaBrevo() {
    setStato('loading')
    setTotali({ creati: 0, aggiornati: 0 })

    let prossima = { listaIndex: 0, offset: 0 }
    let totCreati = 0, totAggiornati = 0

    try {
      while (true) {
        const res = await fetch('/api/import-from-brevo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prossima),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Errore server')

        totCreati    += data.creati    || 0
        totAggiornati += data.aggiornati || 0
        setTotali({ creati: totCreati, aggiornati: totAggiornati })
        setListaCorrente(data.lista || '')

        if (data.status === 'completato') break
        prossima = data.prossima
      }
      setStato('done')
    } catch (e) {
      setStato('error')
      console.error(e)
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Lead totali',        value: '—', color: 'var(--accent)' },
          { label: 'Consulenze fissate', value: '—', color: 'var(--green)'  },
          { label: 'Da richiamare',      value: '—', color: 'var(--amber)'  },
          { label: 'Task oggi',          value: '—', color: 'var(--txt)'    },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Importa contatti da Brevo</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
          Importa i lead dai webinar Brevo nel CRM. I duplicati vengono saltati automaticamente.
        </div>

        <button
          onClick={importaDaBrevo}
          disabled={stato === 'loading'}
          style={{
            background: stato === 'loading' ? 'var(--txt3)' : 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: stato === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {stato === 'loading' ? '⏳ Importazione in corso...' : '⬇ Importa da Brevo'}
        </button>

        {stato === 'loading' && listaCorrente && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--txt2)' }}>
            📋 {listaCorrente} — {totali.creati} creati, {totali.aggiornati} aggiornati...
          </div>
        )}

        {stato === 'done' && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#e8f5e9', borderRadius: 8, fontSize: 13 }}>
            ✅ Import completato — <strong>{totali.creati}</strong> creati, <strong>{totali.aggiornati}</strong> aggiornati
          </div>
        )}

        {stato === 'error' && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#fdecea', borderRadius: 8, fontSize: 13, color: '#c62828' }}>
            ❌ Errore durante l'import — controlla i log Vercel
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
        <div style={{ fontSize: 14 }}>La dashboard con KPI e report verrà costruita nel prossimo sprint.</div>
      </div>
    </div>
  )
}
