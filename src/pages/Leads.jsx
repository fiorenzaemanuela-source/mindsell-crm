import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'

const ESITI = [
  { id: 'consulenza',      label: 'Consulenza fissata', badge: 'badge-green' },
  { id: 'richiamare',      label: 'Da richiamare',      badge: 'badge-amber' },
  { id: 'non-risponde',    label: 'Non risponde',        badge: 'badge-gray'  },
  { id: 'non-interessato', label: 'Non interessato',     badge: 'badge-red'   },
]

const FONTE_OPTIONS = [
  'Meta Ads', 'Google Ads', 'LinkedIn', 'Referral', 'Organico', 'Webinar', 'Email', 'Import Sheet', 'Altro'
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

const DEFAULT_FUNNEL = ['Webinar_MindSell_2025', 'Traffico questionario', 'Webinar_Potere_Parole_2026']
const DEFAULT_STATI = [
  'Messaggio di benvenuto', 'Chiamata', 'Non risponde — richiamare',
  'Contatto non utile', 'Consulenza fissata', 'Cliente acquisito',
  'Non interessato', 'Cliente non in target', 'Appuntamento telefonico',
  'Email di contatto', 'Cliente irreperibile',
]

const EMPTY_LEAD = {
  nome: '', cognome: '', email: '', telefono: '',
  funnel: '', stage: '', esito: '',
  fonte: '', canale: '', priorita: 'Alta',
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
  'Messaggio di benvenuto': '#378ADD',
  'Chiamata': '#BA7517',
  'Non risponde — richiamare': '#EF9F27',
  'Consulenza fissata': '#1D9E75',
  'Cliente acquisito': '#2D2D8F',
  'Non interessato': '#E24B4A',
  'Cliente non in target': '#888',
  'Appuntamento telefonico': '#9B59B6',
  'Email di contatto': '#3498DB',
  'Cliente irreperibile': '#555',
  'Contatto non utile': '#E67E22',
}[stage] || '#888')

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [crmConfig, setCrmConfig] = useState(null)
  const [view, setView] = useState('list')
  const [viewMode, setViewMode] = useState('list')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_LEAD })
  const [search, setSearch] = useState('')
  const [filterFunnel, setFilterFunnel] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterPriorita, setFilterPriorita] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('anagrafica')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leads'), snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), snap => {
      if (snap.exists()) setCrmConfig(snap.data())
    })
    return () => unsub()
  }, [])

  const FUNNEL_OPTIONS = crmConfig?.funnels || DEFAULT_FUNNEL
  const STAGE_OPTIONS  = crmConfig?.stati   || DEFAULT_STATI

  const q = (search || '').toLowerCase()
  const filtered = leads.filter(l => {
    const matchSearch = !q ||
      (l.nome || '').toLowerCase().includes(q) ||
      (l.cognome || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.telefono || '').includes(q)
    const matchFunnel   = !filterFunnel   || l.funnel   === filterFunnel
    const matchStage    = !filterStage    || l.stage    === filterStage
    const matchPriorita = !filterPriorita || l.priorita === filterPriorita
    return matchSearch && matchFunnel && matchStage && matchPriorita
  })

  const openNew    = () => { setForm({ ...EMPTY_LEAD }); setSelected(null); setTab('anagrafica'); setView('new') }
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
    await updateDoc(doc(db, 'leads', selected.id), { ...form, tags, updatedAt: Date.now() })
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
        funnel: row.funnel || '', stage: row.stage || '',
        fonte: row.fonte || '', priorita: row.priorita || 'Alta',
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

  const Toggle = () => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
      <button onClick={() => setViewMode('list')} style={{
        padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
        background: viewMode === 'list' ? 'var(--card)' : 'transparent',
        color: viewMode === 'list' ? 'var(--txt)' : 'var(--txt3)',
        fontWeight: viewMode === 'list' ? 600 : 400,
      }}>☰ Lista</button>
      <button onClick={() => setViewMode('kanban')} style={{
        padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
        background: viewMode === 'kanban' ? 'var(--card)' : 'transparent',
        color: viewMode === 'kanban' ? 'var(--txt)' : 'var(--txt3)',
        fontWeight: viewMode === 'kanban' ? 600 : 400,
      }}>⊞ Kanban</button>
    </div>
  )

  if (view === 'list' && viewMode === 'kanban') {
    const colonne = filterFunnel && crmConfig?.flussi?.[filterFunnel]?.length > 0
      ? crmConfig.flussi[filterFunnel]
      : STAGE_OPTIONS

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>Lead</h1>
            <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>{leads.length} lead totali · {filtered.length} visualizzati</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterFunnel} onChange={e => setFilterFunnel(e.target.value)}>
              <option value="">Tutti i funnel</option>
              {FUNNEL_OPTIONS.map(f => <option key={f}>{f}</option>)}
            </select>
            <Toggle />
            <button className="btn-primary" onClick={openNew}>+ Nuovo lead</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {colonne.map(stato => {
            const leadsStato = filtered.filter(l => l.stage === stato)
            const colori = {
              'Alta': '#E24B4A', 'Media': '#EF9F27', 'Bassa': '#888'
            }
            return (
              <div key={stato} style={{ minWidth: 230, maxWidth: 260, flexShrink: 0 }}>
                <div style={{
                  background: 'var(--card)', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 8,
                  borderTop: '3px solid var(--accent)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{stato}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--txt)' }}>{leadsStato.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leadsStato.map(l => (
                    <div key={l.id} onClick={() => openDetail(l)} className="card"
                      style={{ padding: '12px 14px', cursor: 'pointer', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accentbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                          {(l.nome?.[0] || '?').toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.nome} {l.cognome}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 6 }}>{l.email || l.telefono || '—'}</div>
                      {l.priorita && (
                        <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 11 }}>
                          {l.priorita}
                        </span>
                      )}
                    </div>
                  ))}
                  {leadsStato.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '16px 0', background: 'var(--card)', borderRadius: 8 }}>
                      Nessun lead
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (view === 'list') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Lead</h1>
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>{leads.length} lead totali · {filtered.length} visualizzati</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="btn-ghost" style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>
            ↑ Importa CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          </label>
          <Toggle />
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
          <option value="">Tutti gli stati</option>
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
                  {['Lead', 'Email', 'Funnel', 'Stato', 'Esito', 'Priorità', 'Fonte', ''].map(h => (
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
  const flussoCorrente = form.funnel && crmConfig?.flussi?.[form.funnel]?.length > 0
    ? crmConfig.flussi[form.funnel]
    : STAGE_OPTIONS

  const TABS = [
    { id: 'anagrafica',   label: 'Anagrafica'        },
    { id: 'funnel',       label: 'Funnel & Stato'    },
    { id: 'questionario', label: 'Questionario'       },
    { id: 'attivita',     label: 'Attività'           },
    { id: 'materiali',    label: 'Materiali & Offerte'},
    { id: 'note',         label: 'Note & Scoring'    },
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
                <select value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value, stage: '' }))}>
                  <option value="">Seleziona...</option>
                  {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Stato attuale" half>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {flussoCorrente.map(o => <option key={o}>{o}</option>)}
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
        {tab === 'questionario' && (
          <div>
            {(() => {
              const campi = [
                { label: 'Settore',              val: form.settore           },
                { label: 'Ruolo',                val: form.ruolo             },
                { label: 'Esperienza vendita',   val: form.esperienzaVendita },
                { label: 'Ha già fatto corsi',   val: form.haCorsiVendita    },
                { label: 'Obiettivo / Priorità', val: form.obiettivoLead     },
                { label: 'Città',                val: form.citta             },
              ]
              const extra = form.datiQuestionario
                ? Object.entries(form.datiQuestionario)
                : []
              const tutti = [
                ...campi.filter(c => c.val),
                ...extra.map(([k, v]) => ({ label: k, val: v }))
              ]
              if (tutti.length === 0) return (
                <div style={{ color: 'var(--txt3)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                  Nessun dato questionario disponibile per questo lead.
                </div>
              )
              return (
                <div style={{ display: 'grid', gap: 12 }}>
                  {tutti.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', paddingTop: 2 }}>{c.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--txt)' }}>{c.val}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
        {tab === 'attivita' && (
          <div>
            <AttivitaLead leadId={selected?.id} />
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
function AttivitaLead({ leadId }) {
  const [eventi, setEventi] = useState([])
  const [contenuti, setContenuti] = useState([])
  const [nuovoContenuto, setNuovoContenuto] = useState({ tipo: 'PDF', nome: '', data: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!leadId) return
    const unsub = onSnapshot(collection(db, 'eventi'), snap => {
      const eventiLead = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (e.invitati || []).includes(leadId))
      setEventi(eventiLead)
    })
    return () => unsub()
  }, [leadId])

  useEffect(() => {
    if (!leadId) return
    const unsub = onSnapshot(
      collection(db, 'leads', leadId, 'contenuti'),
      snap => setContenuti(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [leadId])

  const aggiungiContenuto = async () => {
    if (!nuovoContenuto.nome.trim()) return alert('Inserisci il nome del contenuto.')
    setSaving(true)
    await addDoc(collection(db, 'leads', leadId, 'contenuti'), {
      ...nuovoContenuto,
      data: nuovoContenuto.data || new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
    })
    setNuovoContenuto({ tipo: 'PDF', nome: '', data: '' })
    setSaving(false)
  }

  const eliminaContenuto = async (id) => {
    await deleteDoc(doc(db, 'leads', leadId, 'contenuti', id))
  }

  const TIPI_CONTENUTO = ['PDF', 'Video', 'Link', 'Offerta commerciale']

  return (
    <div>
      {/* Contenuti inviati */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contenuti inviati</div>
        {contenuti.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 12 }}>Nessun contenuto inviato ancora.</div>
        )}
        {contenuti.sort((a, b) => b.createdAt - a.createdAt).map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--accentbg)', color: 'var(--accent)', fontWeight: 600, marginRight: 8 }}>{c.tipo}</span>
              <span style={{ fontSize: 14 }}>{c.nome}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                {c.data ? new Date(c.data).toLocaleDateString('it-IT') : '—'}
              </span>
              <button onClick={() => eliminaContenuto(c.id)}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          </div>
        ))}

        {/* Aggiungi contenuto */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <select value={nuovoContenuto.tipo}
            onChange={e => setNuovoContenuto(n => ({ ...n, tipo: e.target.value }))}
            style={{ width: 140 }}>
            {TIPI_CONTENUTO.map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Nome contenuto..." value={nuovoContenuto.nome}
            onChange={e => setNuovoContenuto(n => ({ ...n, nome: e.target.value }))}
            style={{ flex: 1, minWidth: 160 }} />
          <input type="date" value={nuovoContenuto.data}
            onChange={e => setNuovoContenuto(n => ({ ...n, data: e.target.value }))}
            style={{ width: 140 }} />
          <button className="btn-primary" onClick={aggiungiContenuto} disabled={saving}>
            {saving ? '...' : '+ Aggiungi'}
          </button>
        </div>
      </div>

      {/* Eventi */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Partecipazione eventi</div>
        {eventi.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Nessun evento associato a questo lead.</div>
        )}
        {eventi.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1).map(e => {
          const presente = (e.presenti || []).includes(leadId)
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{e.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                  {e.tipo} · {e.data ? new Date(e.data).toLocaleDateString('it-IT') : '—'}
                </div>
              </div>
              <span className={`badge ${presente ? 'badge-green' : 'badge-gray'}`}>
                {presente ? 'Presente' : 'Assente'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
