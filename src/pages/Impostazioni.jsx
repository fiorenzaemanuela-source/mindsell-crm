import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'

const DEFAULT_CONFIG = {
  funnels: ['Webinar_MindSell_2025', 'Traffico questionario', 'Webinar_Potere_Parole_2026'],
  stati: [
    'Messaggio di benvenuto', 'Chiamata', 'Non risponde — richiamare',
    'Contatto non utile', 'Consulenza fissata', 'Cliente acquisito',
    'Non interessato', 'Cliente non in target', 'Appuntamento telefonico',
    'Email di contatto', 'Cliente irreperibile',
  ],
  flussi: {},
  priorita: { giorniMedia: 7, giorniBassa: 30 },
}

export default function Impostazioni() {
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('funnel')
  const [saving, setSaving] = useState(false)
  const [newFunnel, setNewFunnel] = useState('')
  const [newStato, setNewStato] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), snap => {
      if (snap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
      } else {
        setConfig(DEFAULT_CONFIG)
        setDoc(doc(db, 'settings', 'config'), DEFAULT_CONFIG)
      }
    })
    return () => unsub()
  }, [])

  const save = async (newConfig) => {
    setSaving(true)
    await setDoc(doc(db, 'settings', 'config'), newConfig)
    setSaving(false)
  }

  if (!config) return <div style={{ padding: 32, color: 'var(--txt2)' }}>Caricamento...</div>

  const TABS = [
    { id: 'funnel',   label: 'Funnel'   },
    { id: 'stati',    label: 'Stati'    },
    { id: 'flussi',   label: 'Flussi'   },
    { id: 'priorita', label: 'Priorità' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Impostazioni</h1>
        <p style={{ color: 'var(--txt2)', marginTop: 4, fontSize: 14 }}>Configura funnel, stati e flussi del CRM</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', border: 'none', background: 'none', fontSize: 14, cursor: 'pointer',
            color: tab === t.id ? 'var(--txt)' : 'var(--txt3)',
            fontWeight: tab === t.id ? 600 : 400,
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'funnel' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Funnel attivi</div>
          {config.funnels.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>{f}</span>
              <button onClick={() => {
                const updated = { ...config, funnels: config.funnels.filter((_, j) => j !== i) }
                setConfig(updated); save(updated)
              }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}>Elimina</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input placeholder="Nome nuovo funnel..." value={newFunnel}
              onChange={e => setNewFunnel(e.target.value)} style={{ flex: 1 }}
              onKeyDown={e => {
                if (e.key !== 'Enter' || !newFunnel.trim()) return
                const updated = { ...config, funnels: [...config.funnels, newFunnel.trim()] }
                setConfig(updated); save(updated); setNewFunnel('')
              }} />
            <button className="btn-primary" onClick={() => {
              if (!newFunnel.trim()) return
              const updated = { ...config, funnels: [...config.funnels, newFunnel.trim()] }
              setConfig(updated); save(updated); setNewFunnel('')
            }}>Aggiungi</button>
          </div>
        </div>
      )}

      {tab === 'stati' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Archivio stati</div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
            Questi sono tutti gli stati disponibili. Assegnali ai flussi nel tab "Flussi".
          </p>
          {config.stati.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>{s}</span>
              <button onClick={() => {
                const updated = { ...config, stati: config.stati.filter((_, j) => j !== i) }
                setConfig(updated); save(updated)
              }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}>Elimina</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input placeholder="Nuovo stato..." value={newStato}
              onChange={e => setNewStato(e.target.value)} style={{ flex: 1 }}
              onKeyDown={e => {
                if (e.key !== 'Enter' || !newStato.trim()) return
                const updated = { ...config, stati: [...config.stati, newStato.trim()] }
                setConfig(updated); save(updated); setNewStato('')
              }} />
            <button className="btn-primary" onClick={() => {
              if (!newStato.trim()) return
              const updated = { ...config, stati: [...config.stati, newStato.trim()] }
              setConfig(updated); save(updated); setNewStato('')
            }}>Aggiungi</button>
          </div>
        </div>
      )}

      {tab === 'flussi' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
            Per ogni funnel definisci l'ordine degli stati. Il setter avanzerà il lead attraverso questi step.
          </p>
          {config.funnels.map(funnel => (
            <FlussoEditor key={funnel} funnel={funnel} config={config} setConfig={setConfig} save={save} />
          ))}
        </div>
      )}

      {tab === 'priorita' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Regole priorità automatica</div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 24 }}>
            Un lead entra sempre come <strong>Alta priorità</strong>. Scende automaticamente se non viene aggiornato.
          </p>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Giorni senza aggiornamento → Media
              </label>
              <input type="number" min="1" value={config.priorita.giorniMedia} style={{ width: 80 }}
                onChange={e => {
                  const updated = { ...config, priorita: { ...config.priorita, giorniMedia: parseInt(e.target.value) || 7 } }
                  setConfig(updated); save(updated)
                }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Giorni senza aggiornamento → Bassa
              </label>
              <input type="number" min="1" value={config.priorita.giorniBassa} style={{ width: 80 }}
                onChange={e => {
                  const updated = { ...config, priorita: { ...config.priorita, giorniBassa: parseInt(e.target.value) || 30 } }
                  setConfig(updated); save(updated)
                }} />
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--txt2)' }}>💾 Salvataggio in corso...</div>
      )}
    </div>
  )
}

function FlussoEditor({ funnel, config, setConfig, save }) {
  const flusso = config.flussi?.[funnel] || []
  const disponibili = config.stati.filter(s => !flusso.includes(s))

  const update = (nuovoFlusso) => {
    const updated = { ...config, flussi: { ...config.flussi, [funnel]: nuovoFlusso } }
    setConfig(updated); save(updated)
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{funnel}</div>
      <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
        {flusso.length === 0 ? 'Nessuno stato nel flusso — aggiungine uno qui sotto' : `${flusso.length} stati nel flusso`}
      </div>

      {flusso.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--txt3)', width: 24, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
          <span style={{ fontSize: 14, flex: 1 }}>{s}</span>
          <button onClick={() => { if (i === 0) return; const arr = [...flusso]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; update(arr) }}
            style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--txt3)' : 'var(--txt2)', fontSize: 16, padding: '0 4px' }}>↑</button>
          <button onClick={() => { if (i === flusso.length - 1) return; const arr = [...flusso]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; update(arr) }}
            style={{ background: 'none', border: 'none', cursor: i === flusso.length - 1 ? 'default' : 'pointer', color: i === flusso.length - 1 ? 'var(--txt3)' : 'var(--txt2)', fontSize: 16, padding: '0 4px' }}>↓</button>
          <button onClick={() => update(flusso.filter((_, j) => j !== i))}
            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>✕</button>
        </div>
      ))}

      {disponibili.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Aggiungi al flusso</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {disponibili.map(s => (
              <button key={s} onClick={() => update([...flusso, s])} style={{
                padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--txt2)',
              }}>{s} +</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
