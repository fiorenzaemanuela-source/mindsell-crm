import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { firebaseConfig } from '../firebase'
import { useState, useEffect } from 'react'
import { db, auth } from '../firebase'
import { doc, onSnapshot, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'

const secondaryApp = getApps().find(a => a.name === 'secondary') || initializeApp(firebaseConfig, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

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
  contenuti: [],
}

const TIPI_CONTENUTO = ['PDF', 'Immagine', 'Video', 'Link', 'Offerta commerciale']
const RUOLI = ['admin', 'setter', 'closer', 'viewer']

export default function Impostazioni() {
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('funnel')
  const [saving, setSaving] = useState(false)
  const [newFunnel, setNewFunnel] = useState('')
  const [newStato, setNewStato] = useState('')
  const [newContenuto, setNewContenuto] = useState({ nome: '', tipo: 'PDF', url: '' })

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
    { id: 'funnel',    label: 'Funnel'    },
    { id: 'stati',     label: 'Stati'     },
    { id: 'flussi',    label: 'Flussi'    },
    { id: 'contenuti', label: 'Contenuti' },
    { id: 'priorita',  label: 'Priorità'  },
    { id: 'utenti',    label: 'Utenti'    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Impostazioni</h1>
        <p style={{ color: 'var(--txt2)', marginTop: 4, fontSize: 14 }}>Configura funnel, stati, flussi e contenuti del CRM</p>
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

      {tab === 'contenuti' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Archivio contenuti</div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
            Aggiungi qui i contenuti che invii ai lead. Li troverai come scelta rapida nella scheda lead.
          </p>
          {(config.contenuti || []).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 16 }}>Nessun contenuto nell'archivio.</div>
          )}
          {(config.contenuti || []).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--accentbg)', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{c.tipo}</span>
                <span style={{ fontSize: 14, flex: 1 }}>{c.nome}</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}>
                    🔗 Apri
                  </a>
                )}
              </div>
              <button onClick={() => {
                const updated = { ...config, contenuti: config.contenuti.filter((_, j) => j !== i) }
                setConfig(updated); save(updated)
              }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}>Elimina</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <select value={newContenuto.tipo}
              onChange={e => setNewContenuto(n => ({ ...n, tipo: e.target.value }))}
              style={{ width: 160 }}>
              {TIPI_CONTENUTO.map(t => <option key={t}>{t}</option>)}
            </select>
            <input placeholder="Nome contenuto..." value={newContenuto.nome}
              onChange={e => setNewContenuto(n => ({ ...n, nome: e.target.value }))}
              style={{ flex: 1, minWidth: 180 }} />
            <input placeholder="URL (opzionale)..." value={newContenuto.url}
              onChange={e => setNewContenuto(n => ({ ...n, url: e.target.value }))}
              style={{ flex: 1, minWidth: 180 }} />
            <button className="btn-primary" onClick={() => {
              if (!newContenuto.nome.trim()) return
              const updated = { ...config, contenuti: [...(config.contenuti || []), { ...newContenuto }] }
              setConfig(updated); save(updated)
              setNewContenuto({ nome: '', tipo: 'PDF', url: '' })
            }}>Aggiungi</button>
          </div>
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

      {tab === 'utenti' && <GestioneUtenti />}

      {saving && (
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--txt2)' }}>💾 Salvataggio in corso...</div>
      )}
    </div>
  )
}

function GestioneUtenti() {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newUser, setNewUser] = useState({ nome: '', email: '', password: '', ruolo: 'setter' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUtenti(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const creaUtente = async () => {
    if (!newUser.nome.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      return setError('Compila tutti i campi.')
    }
    setSaving(true)
    setError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        nome: newUser.nome.trim(),
        email: newUser.email.trim(),
        ruolo: newUser.ruolo,
        attivo: true,
        createdAt: Date.now(),
      })
      setNewUser({ nome: '', email: '', password: '', ruolo: 'setter' })
      setShowForm(false)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email già in uso.')
      else if (err.code === 'auth/weak-password') setError('Password troppo corta (min 6 caratteri).')
      else setError('Errore: ' + err.message)
    }
    setSaving(false)
  }

  const cambiaRuolo = async (uid, ruolo) => {
    await updateDoc(doc(db, 'users', uid), { ruolo })
  }

  const toggleAttivo = async (uid, attivo) => {
    await updateDoc(doc(db, 'users', uid), { attivo: !attivo })
  }

  const coloreRuolo = r => ({
    admin:  { bg: '#E6F1FB', color: '#185FA5' },
    setter: { bg: '#EAF3DE', color: '#3B6D11' },
    closer: { bg: '#FAEEDA', color: '#854F0B' },
    viewer: { bg: '#F1EFE8', color: '#5F5E5A' },
  }[r] || { bg: '#F1EFE8', color: '#5F5E5A' })

  if (loading) return <div style={{ fontSize: 13, color: 'var(--txt2)' }}>Caricamento utenti...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Gestione utenti</div>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>{utenti.length} utenti totali</div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Annulla' : '+ Nuovo utente'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Crea nuovo utente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>Nome *</div>
              <input placeholder="Mario Rossi" value={newUser.nome}
                onChange={e => setNewUser(u => ({ ...u, nome: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>Email *</div>
              <input type="email" placeholder="mario@mindsell.it" value={newUser.email}
                onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>Password *</div>
              <input type="password" placeholder="min 6 caratteri" value={newUser.password}
                onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>Ruolo *</div>
              <select value={newUser.ruolo} onChange={e => setNewUser(u => ({ ...u, ruolo: e.target.value }))} style={{ width: '100%' }}>
                {RUOLI.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
          <button className="btn-primary" onClick={creaUtente} disabled={saving}>
            {saving ? 'Creazione...' : 'Crea utente'}
          </button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Nome', 'Email', 'Ruolo', 'Stato', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {utenti.map(u => {
              const badge = coloreRuolo(u.ruolo)
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 500 }}>{u.nome || '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--txt2)' }}>{u.email}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <select value={u.ruolo} onChange={e => cambiaRuolo(u.id, e.target.value)}
                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: badge.bg, color: badge.color, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                      {RUOLI.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: u.attivo !== false ? '#EAF3DE' : '#F1EFE8', color: u.attivo !== false ? '#3B6D11' : '#5F5E5A' }}>
                      {u.attivo !== false ? 'Attivo' : 'Disabilitato'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => toggleAttivo(u.id, u.attivo !== false)}
                      style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--txt2)', cursor: 'pointer' }}>
                      {u.attivo !== false ? 'Disabilita' : 'Abilita'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FlussoEditor({ funnel, config, setConfig, save }) {
  const flusso = config.flussi?.[funnel] || []
  const fonti = config.fontiFunnel?.[funnel] || []
  const disponibili = config.stati.filter(s => !flusso.includes(s))
  const [nuovaFonte, setNuovaFonte] = useState('')

  const update = (nuovoFlusso) => {
    const updated = { ...config, flussi: { ...config.flussi, [funnel]: nuovoFlusso } }
    setConfig(updated); save(updated)
  }

  const addFonte = () => {
    if (!nuovaFonte.trim()) return
    const updated = { ...config, fontiFunnel: { ...(config.fontiFunnel || {}), [funnel]: [...fonti, nuovaFonte.trim()] } }
    setConfig(updated); save(updated); setNuovaFonte('')
  }

  const removeFonte = (i) => {
    const updated = { ...config, fontiFunnel: { ...(config.fontiFunnel || {}), [funnel]: fonti.filter((_, j) => j !== i) } }
    setConfig(updated); save(updated)
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{funnel}</div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fonti di provenienza</div>
        {fonti.length === 0 && <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 8 }}>Nessuna fonte — verranno mostrate tutte le fonti globali.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {fonti.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--accentbg)', color: 'var(--accent)', fontSize: 12 }}>
              {f}
              <button onClick={() => removeFonte(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Nuova fonte..." value={nuovaFonte} onChange={e => setNuovaFonte(e.target.value)}
            style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addFonte()} />
          <button className="btn-primary" onClick={addFonte}>Aggiungi</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Stati del flusso</div>
      <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
        {flusso.length === 0 ? 'Nessuno stato nel flusso' : `${flusso.length} stati`}
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
              <button key={s} onClick={() => update([...flusso, s])} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--txt2)' }}>{s} +</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
