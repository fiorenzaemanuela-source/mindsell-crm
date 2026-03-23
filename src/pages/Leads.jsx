import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from 'firebase/firestore'

const FUNNEL_OPTIONS = [
  'Funnel Lead Freddi', 'Funnel Lead Caldi', 'Funnel Post-Consulenza',
  'Funnel Riattivazione', 'Corso Online', 'Consulenza 1:1',
  'Programma di Gruppo', 'Evento/Webinar', 'Partnership B2B',
]

const STAGE_OPTIONS = [
  'Nuovo lead', 'Da contattare', 'Da richiamare',
  'Non risponde', 'Non interessato', 'Consulenza fissata', 'Cliente',
]

const ESITI = [
  { id: 'consulenza',      label: 'Consulenza fissata', badge: 'badge-green' },
  { id: 'richiamare',      label: 'Da richiamare',      badge: 'badge-amber' },
  { id: 'non-risponde',    label: 'Non risponde',        badge: 'badge-gray'  },
  { id: 'non-interessato', label: 'Non interessato',     badge: 'badge-red'   },
]

const FONTE_OPTIONS = [
  'Meta Ads', 'Google Ads', 'LinkedIn', 'Referral', 'Organico', 'Webinar', 'Email', 'Altro'
]

const CANALE_OPTIONS = ['Telefono', 'WhatsApp', 'Email', 'LinkedIn']

const OFFERTE_OPTIONS = [
  'Corso Online Base', 'Corso Online Avanzato', 'Consulenza 1:1',
  'Programma di Gruppo', 'Webinar Gratuito', 'Partnership B2B',
]

const MATERIALI_OPTIONS = [
  'PDF Introduttivo', 'Brochure Corsi', 'Case Study', 'Video Demo',
  'Offerta Speciale', 'Proposta Commerciale',
]

const FLOW_OPTIONS = [
  'Flow Benvenuto', 'Flow Nurturing', 'Flow Post-Consulenza',
  'Flow Riattivazione', 'Flow Webinar', 'Flow Offerta',
]

const PRIORITA = ['Alta', 'Media', 'Bassa']
const MOTIVI_PERDITA = ['Prezzo', 'Timing', 'Concorrente', 'Non qualificato', 'Non raggiungibile', 'Altro']

const EMPTY_LEAD = {
  nome: '', cognome: '', email: '', telefono: '',
  funnel: '', stage: 'Nuovo lead', esito: '',
  fonte: '', canale: '', priorita: 'Media',
  valoreStimato: '', flowEmail: '',
  materiali: [], offerte: [],
  tags: '', note: '',
  motivoPerdita: '',
}

const badgeClass = esito => ({
  consulenza: 'badge-green', richiamare: 'badge-amber',
  'non-risponde': 'badge-gray', 'non-interessato': 'badge-red',
}[esito] || 'badge-gray')

const stageDot = stage => ({
  'Nuovo lead': '#378ADD', 'Da contattare': '#BA7517', 'Da richiamare': '#EF9F27',
  'Non risponde': '#888', 'Non interessato': '#E24B4A',
  'Consulenza fissata': '#1D9E75', 'Cliente': '#2D2D8F',
}[stage] || '#888')

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [search, setSearch] = useState('')
  const [filterFunnel, setFilterFunnel] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterPriorita, setFilterPriorita] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('anagrafica')

 useEffect(() => {
  console.log('--- DEBUG FIREBASE ---')
  console.log('projectId env:', import.meta.env.VITE_FIREBASE_PROJECT_ID)
  console.log('db projectId:', db.app.options.projectId)
  console.log('all env:', import.meta.env)

  const unsub = onSnapshot(
    collection(db, 'leads'),
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      console.log('SNAPSHOT ARRIVATO')
      console.log('docs length:', snap.docs.length)
      console.log('data:', data)
      setLeads(data)
    },
    err => {
      console.error('SNAPSHOT ERROR:', err)
    }
  )

  return () => unsub()
}, [])
  const q = (search || '').toLowerCase()

const filtered = leads.filter(l => {
  const matchSearch = !q ||
    (l.nome || '').toLowerCase().includes(q) ||
    (l.cognome || '').toLowerCase().includes(q) ||
    (l.email || '').toLowerCase().includes(q) ||
    (l.telefono || '').includes(q)

  const matchFunnel = !filterFunnel || l.funnel === filterFunnel
  const matchStage = !filterStage || l.stage === filterStage
  const matchPriorita = !filterPriorita || l.priorita === filterPriorita

  return matchSearch && matchFunnel && matchStage && matchPriorita
})

console.log('RENDER leads:', leads.length)
console.log('RENDER filtered:', filtered.length)
console.log('RENDER view:', view)
  const openNew = () => { setForm(EMPTY_LEAD); setSelected(null); setTab('anagrafica'); setView('new') }
  const openDetail = lead => { setForm({ ...EMPTY_LEAD, ...lead }); setSelected(lead); setTab('anagrafica'); setView('detail') }

  const saveNew = async () => {
    if (!form.nome.trim()) return alert('Inserisci almeno il nome.')
    setSaving(true)
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    await addDoc(collection(db, 'leads'), { ...form, tags, createdAt: Date.now() })
    setSaving(false)
    setView('list')
  }

  const saveEdit = async () => {
    setSaving(true)
    const tags = typeof form.tags === 'string'
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : form.tags || []
    await updateDoc(doc(db, 'leads', selected.id), { ...form, tags })
    setSaving(false)
    setView('list')
  }

  const deleteLead = async id => {
    if (!confirm('Eliminare questo lead?')) return
    await deleteDoc(doc(db, 'leads', id))
    setView('list')
  }

  const toggleArr = (key, val) => {
    const arr = form[key] || []
    setForm(f => ({ ...f, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }))
  }

  const importCSV = async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    let count = 0
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })
      if (!row.nome && !row.email) continue
      await addDoc(collection(db, 'leads'), {
        nome: row.nome || '', cognome: row.cognome || '',
        email: row.email || '', telefono: row.telefono || row.phone || '',
        funnel: row.funnel || '', stage: row.stage || 'Nuovo lead',
        fonte: row.fonte || '', priorita: row.priorita || 'Media',
        tags: [], materiali: [], offerte: [], note: '',
        flowEmail: '', canale: '', valoreStimato: '', esito: '',
        motivoPerdita: '', createdAt: Date.now()
      })
      count++
    }
    alert(`✅ Importati ${count} lead`)
    e.target.value = ''
  }

  const F = ({ label, children, half }) => (
    <div className="form-group" style={half ? { margin: 0 } : {}}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )

  if (view === 'list') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Lead</h1>
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>{leads.length} lead totali · {filtered.length} visualizzati</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn-ghost" style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>
            ↑ Importa CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          </label>
          <button className="btn-primary" onClick={openNew}>+ Nuovo lead</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <input placeholder="Cerca per nome, email, telefono..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterFunnel} onChange={e => setFilterFunnel(e.target.value)}>
          <option value="">Tutti i funnel</option>
          {FUNNEL_OPTIONS.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">Tutti gli stage</option>
          {STAGE_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriorita} onChange={e => setFilterPriorita(e.target.value)}>
          <option value="">Tutte le priorità</option>
          {PRIORITA.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
          <div style={{ fontSize: 14 }}>{leads.length === 0 ? 'Nessun lead ancora. Aggiungine uno o importa un CSV.' : 'Nessun lead corrisponde ai filtri.'}</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Lead', 'Email', 'Funnel', 'Stage', 'Esito', 'Priorità', 'Fonte', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} onClick={() => openDetail(l)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '11px 14px', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accentbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                          {(l.nome?.[0] || '?').toUpperCase()}
                        </div>
                        {l.nome} {l.cognome}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--txt2)' }}>{l.email || '—'}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--txt2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.funnel || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {l.stage && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: stageDot(l.stage), flexShrink: 0 }} />
                        {l.stage}
                      </span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {l.esito && <span className={`badge ${badgeClass(l.esito)}`}>{ESITI.find(e => e.id === l.esito)?.label}</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {l.priorita && <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>{l.priorita}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--txt2)' }}>{l.fonte || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <button className="btn-sm" onClick={e => { e.stopPropagation(); openDetail(l) }}>Apri</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  const isNew = view === 'new'
  const TABS = [
    { id: 'anagrafica', label: 'Anagrafica' },
    { id: 'funnel',     label: 'Funnel & Stage' },
    { id: 'materiali',  label: 'Materiali & Offerte' },
    { id: 'note',       label: 'Note & Scoring' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setView('list')}>← Lead</button>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>{isNew ? 'Nuovo lead' : `${form.nome} ${form.cognome}`}</h1>
          {!isNew && form.priorita && (
            <span className={`badge ${form.priorita === 'Alta' ? 'badge-red' : form.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>{form.priorita}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteLead(selected.id)}>Elimina</button>}
          <button className="btn-primary" onClick={isNew ? saveNew : saveEdit} disabled={saving}>
            {saving ? 'Salvataggio...' : isNew ? 'Crea lead' : 'Salva modifiche'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
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
      <div className="card" style={{ padding: 24 }}>
        {tab === 'anagrafica' && (
          <div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Nome *" half><input placeholder="Marco" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></F>
              <F label="Cognome" half><input placeholder="Rossi" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} /></F>
            </div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Email" half><input type="email" placeholder="marco.rossi@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></F>
              <F label="Telefono" half><input placeholder="+39 333 1234567" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></F>
            </div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Fonte" half>
                <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {FONTE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Canale preferito" half>
                <select value={form.canale} onChange={e => setForm(f => ({ ...f, canale: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {CANALE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
            </div>
            <F label="Tag (separati da virgola)">
              <input placeholder="es. ha già fatto corsi, budget alto, decisore"
                value={typeof form.tags === 'string' ? form.tags : (form.tags || []).join(', ')}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </F>
          </div>
        )}
        {tab === 'funnel' && (
          <div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Funnel di appartenenza" half>
                <select value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Stage attuale" half>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  {STAGE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
            </div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Esito ultima chiamata" half>
                <select value={form.esito} onChange={e => setForm(f => ({ ...f, esito: e.target.value }))}>
                  <option value="">Nessun esito</option>
                  {ESITI.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
              </F>
              <F label="Motivo perdita" half>
                <select value={form.motivoPerdita} onChange={e => setForm(f => ({ ...f, motivoPerdita: e.target.value }))}
                  disabled={form.esito !== 'non-interessato'}>
                  <option value="">—</option>
                  {MOTIVI_PERDITA.map(m => <option key={m}>{m}</option>)}
                </select>
              </F>
            </div>
            <F label="Flow email assegnato">
              <select value={form.flowEmail} onChange={e => setForm(f => ({ ...f, flowEmail: e.target.value }))}>
                <option value="">Nessun flow</option>
                {FLOW_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </F>
          </div>
        )}
        {tab === 'materiali' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div className="form-label" style={{ marginBottom: 10 }}>Materiali inviati</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {MATERIALI_OPTIONS.map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: (form.materiali || []).includes(m) ? 'var(--accentbg)' : 'transparent' }}>
                    <input type="checkbox" checked={(form.materiali || []).includes(m)} onChange={() => toggleArr('materiali', m)} style={{ width: 'auto' }} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 10 }}>Offerte presentate</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {OFFERTE_OPTIONS.map(o => (
                  <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: (form.offerte || []).includes(o) ? 'var(--accentbg)' : 'transparent' }}>
                    <input type="checkbox" checked={(form.offerte || []).includes(o)} onChange={() => toggleArr('offerte', o)} style={{ width: 'auto' }} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'note' && (
          <div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <F label="Priorità" half>
                <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))}>
                  {PRIORITA.map(p => <option key={p}>{p}</option>)}
                </select>
              </F>
              <F label="Valore potenziale (€)" half>
                <input type="number" placeholder="es. 2500" value={form.valoreStimato} onChange={e => setForm(f => ({ ...f, valoreStimato: e.target.value }))} />
              </F>
            </div>
            <F label="Note">
              <textarea style={{ minHeight: 160 }}
                placeholder="Note libere sul lead, contesto, osservazioni del setter..."
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </F>
          </div>
        )}
      </div>
    </div>
  )
}
