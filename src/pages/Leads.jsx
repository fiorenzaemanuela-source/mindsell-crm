import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'

const ESITI = [
  { id: 'consulenza',      label: 'Consulenza fissata' },
  { id: 'richiamare',      label: 'Da richiamare'      },
  { id: 'non-risponde',    label: 'Non risponde'        },
  { id: 'non-interessato', label: 'Non interessato'     },
]

const FONTE_OPTIONS = ['Meta Ads', 'Google Ads', 'LinkedIn', 'Referral', 'Organico', 'Webinar', 'Email', 'Import Sheet', 'Altro']
const CANALE_OPTIONS = ['Telefono', 'WhatsApp', 'Email', 'LinkedIn']
const FLOW_OPTIONS = ['Flow Benvenuto', 'Flow Nurturing', 'Flow Post-Consulenza', 'Flow Riattivazione', 'Flow Webinar', 'Flow Offerta']
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
  tags: '', note: '', motivoPerdita: '',
}

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

const esitoBadge = id => ({
  consulenza: { bg: '#EAF3DE', color: '#3B6D11' },
  richiamare: { bg: '#FAEEDA', color: '#854F0B' },
  'non-risponde': { bg: '#F1EFE8', color: '#5F5E5A' },
  'non-interessato': { bg: '#FCEBEB', color: '#A32D2D' },
}[id] || { bg: '#F1EFE8', color: '#5F5E5A' })

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
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [showQuestionario, setShowQuestionario] = useState(false)

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
  const filtered = leads
    .filter(l => {
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
    .sort((a, b) => {
      let va, vb
      if (sortBy === 'nome')        { va = (a.nome + ' ' + a.cognome).toLowerCase(); vb = (b.nome + ' ' + b.cognome).toLowerCase() }
      else if (sortBy === 'email')  { va = a.email || ''; vb = b.email || '' }
      else if (sortBy === 'funnel') { va = a.funnel || ''; vb = b.funnel || '' }
      else if (sortBy === 'priorita') {
        const ord = { 'Alta': 0, 'Media': 1, 'Bassa': 2 }
        va = ord[a.priorita] ?? 3; vb = ord[b.priorita] ?? 3
        return sortDir === 'asc' ? va - vb : vb - va
      }
      else { va = a.createdAt || 0; vb = b.createdAt || 0; return sortDir === 'asc' ? va - vb : vb - va }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const openNew    = () => { setForm({ ...EMPTY_LEAD }); setSelected(null); setView('new') }
  const openDetail = lead => { setForm({ ...EMPTY_LEAD, ...lead }); setSelected(lead); setShowQuestionario(false); setView('detail') }

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
        tags: [], note: '', flowEmail: '', canale: '', valoreStimato: '',
        esito: '', motivoPerdita: '', createdAt: Date.now()
      })
      count++
    }
    alert(`✅ Importati ${count} lead`)
    e.target.value = ''
  }

  const Toggle = () => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
      <button onClick={() => setViewMode('list')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer', background: viewMode === 'list' ? 'var(--card)' : 'transparent', color: viewMode === 'list' ? 'var(--txt)' : 'var(--txt3)', fontWeight: viewMode === 'list' ? 600 : 400 }}>☰ Lista</button>
      <button onClick={() => setViewMode('kanban')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--card)' : 'transparent', color: viewMode === 'kanban' ? 'var(--txt)' : 'var(--txt3)', fontWeight: viewMode === 'kanban' ? 600 : 400 }}>⊞ Kanban</button>
    </div>
  )

  // ── KANBAN ─────────────────────────────────────────────────────────────────
  if (view === 'list' && viewMode === 'kanban') {
    const colonne = filterFunnel && crmConfig?.flussi?.[filterFunnel]?.length > 0
      ? crmConfig.flussi[filterFunnel] : STAGE_OPTIONS
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
            return (
              <div key={stato} style={{ minWidth: 230, maxWidth: 260, flexShrink: 0 }}>
                <div style={{ background: 'var(--card)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, borderTop: '3px solid var(--accent)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{stato}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--txt)' }}>{leadsStato.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leadsStato.map(l => (
                    <div key={l.id} onClick={() => openDetail(l)} className="card" style={{ padding: '12px 14px', cursor: 'pointer', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accentbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{(l.nome?.[0] || '?').toUpperCase()}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.nome} {l.cognome}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 6 }}>{l.email || l.telefono || '—'}</div>
                      {l.priorita && <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 11 }}>{l.priorita}</span>}
                    </div>
                  ))}
                  {leadsStato.length === 0 && <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '16px 0', background: 'var(--card)', borderRadius: 8 }}>Nessun lead</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── LISTA ──────────────────────────────────────────────────────────────────
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
                  {[
                    { label: 'Lead',             key: 'nome'      },
                    { label: 'Email',            key: 'email'     },
                    { label: 'Funnel',           key: 'funnel'    },
                    { label: 'Stato',            key: null        },
                    { label: 'Esito',            key: null        },
                    { label: 'Priorità',         key: 'priorita'  },
                    { label: 'Fonte',            key: null        },
                    { label: 'Data inserimento', key: 'createdAt' },
                    { label: '',                 key: null        },
                  ].map(h => (
                    <th key={h.label} onClick={() => {
                      if (!h.key) return
                      if (sortBy === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortBy(h.key); setSortDir('asc') }
                    }} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: sortBy === h.key ? 'var(--accent)' : 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                      {h.label}{sortBy === h.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const esito = ESITI.find(e => e.id === l.esito)
                  const badge = esitoBadge(l.esito)
                  return (
                    <tr key={l.id} onClick={() => openDetail(l)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '11px 14px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accentbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{(l.nome?.[0] || '?').toUpperCase()}</div>
                          {l.nome} {l.cognome}
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--txt2)' }}>{l.email || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--txt2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.funnel || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {l.stage && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: stageDot(l.stage), flexShrink: 0 }} />{l.stage}
                        </span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {esito && <span style={{ background: badge.bg, color: badge.color, fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{esito.label}</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {l.priorita && <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>{l.priorita}</span>}
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--txt2)' }}>{l.fonte || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--txt2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button className="btn-sm" onClick={e => { e.stopPropagation(); openDetail(l) }}>Apri</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  // ── NUOVO LEAD ─────────────────────────────────────────────────────────────
  if (view === 'new') {
    const flussoNew = form.funnel && crmConfig?.flussi?.[form.funnel]?.length > 0
      ? crmConfig.flussi[form.funnel] : STAGE_OPTIONS
    const F = ({ label, children }) => (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {children}
      </div>
    )
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setView('list')}>← Lead</button>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuovo lead</h1>
          </div>
          <button className="btn-primary" onClick={saveNew} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Crea lead'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Anagrafica</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <F label="Nome *"><input placeholder="Marco" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></F>
              <F label="Cognome"><input placeholder="Rossi" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} /></F>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <F label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></F>
              <F label="Telefono"><input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></F>
            </div>
            <div className="form-row">
              <F label="Fonte">
                <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {FONTE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Canale">
                <select value={form.canale} onChange={e => setForm(f => ({ ...f, canale: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {CANALE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
            </div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Percorso</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <F label="Funnel">
                <select value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value, stage: '' }))}>
                  <option value="">Seleziona...</option>
                  {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Stato">
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {flussoNew.map(o => <option key={o}>{o}</option>)}
                </select>
              </F>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <F label="Priorità">
                <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))}>
                  {PRIORITA.map(p => <option key={p}>{p}</option>)}
                </select>
              </F>
              <F label="Valore potenziale (€)">
                <input type="number" placeholder="es. 2500" value={form.valoreStimato} onChange={e => setForm(f => ({ ...f, valoreStimato: e.target.value }))} />
              </F>
            </div>
            <F label="Note">
              <textarea style={{ minHeight: 80 }} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </F>
          </div>
        </div>
      </div>
    )
  }

  // ── DETTAGLIO LEAD ─────────────────────────────────────────────────────────
  const flussoCorrente = form.funnel && crmConfig?.flussi?.[form.funnel]?.length > 0
    ? crmConfig.flussi[form.funnel] : STAGE_OPTIONS

  const haQuestionario = !!(form.settore || form.ruolo || form.esperienzaVendita || form.obiettivoLead || form.haCorsiVendita || form.citta || form.datiQuestionario)

  const campiQ = [
    { label: 'Settore',              val: form.settore           },
    { label: 'Ruolo',                val: form.ruolo             },
    { label: 'Esperienza vendita',   val: form.esperienzaVendita },
    { label: 'Ha già fatto corsi',   val: form.haCorsiVendita    },
    { label: 'Obiettivo / Priorità', val: form.obiettivoLead     },
    { label: 'Città',                val: form.citta             },
    ...(form.datiQuestionario ? Object.entries(form.datiQuestionario).map(([k, v]) => ({ label: k, val: v })) : [])
  ].filter(c => c.val)

  const S = ({ label, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setView('list')}>← Lead</button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accentbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
            {(form.nome?.[0] || '?').toUpperCase()}
          </div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{form.nome} {form.cognome}</span>
          {form.priorita && (
            <span className={`badge ${form.priorita === 'Alta' ? 'badge-red' : form.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>{form.priorita}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteLead(selected.id)}>Elimina</button>
          <button className="btn-primary" onClick={saveEdit} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* Overlay Questionario */}
      {showQuestionario && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowQuestionario(false)}>
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, maxWidth: 520, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Questionario</div>
              <button onClick={() => setShowQuestionario(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--txt2)' }}>✕</button>
            </div>
            {campiQ.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Nessun dato disponibile.</div>
            ) : campiQ.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', paddingTop: 2 }}>{c.label}</div>
                <div style={{ fontSize: 13 }}>{c.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Riga 1: Anagrafica + Percorso */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Anagrafica */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Anagrafica</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Nome</div>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Cognome</div>
              <input value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Email</div>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Telefono</div>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Fonte</div>
              <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))} style={{ width: '100%' }}>
                <option value="">—</option>
                {FONTE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Canale</div>
              <select value={form.canale} onChange={e => setForm(f => ({ ...f, canale: e.target.value }))} style={{ width: '100%' }}>
                <option value="">—</option>
                {CANALE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
              Inserito il: <strong>{form.createdAt ? new Date(form.createdAt).toLocaleDateString('it-IT') : '—'}</strong>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Tag</div>
              <input placeholder="tag1, tag2..." style={{ width: 160 }}
                value={typeof form.tags === 'string' ? form.tags : (form.tags || []).join(', ')}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Percorso + Questionario indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Percorso */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Percorso</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Funnel</div>
                <select value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value, stage: '' }))} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Stato attuale</div>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {flussoCorrente.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Esito ultima chiamata</div>
                <select value={form.esito} onChange={e => setForm(f => ({ ...f, esito: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Nessun esito</option>
                  {ESITI.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
              </div>
              {form.esito === 'non-interessato' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 3 }}>Motivo perdita</div>
                  <select value={form.motivoPerdita} onChange={e => setForm(f => ({ ...f, motivoPerdita: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">—</option>
                    {MOTIVI_PERDITA.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Questionario indicator */}
          <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
            onClick={() => haQuestionario && setShowQuestionario(true)}>
            <span style={{ fontSize: 28, opacity: haQuestionario ? 1 : 0.25 }}>📋</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Questionario</div>
              <div style={{ fontSize: 12, color: haQuestionario ? '#3B6D11' : 'var(--txt3)' }}>
                {haQuestionario ? `${campiQ.length} risposte disponibili — clicca per leggere` : 'Nessun dato'}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Riga 2: Attività + Flow email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Attività */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Attività</div>
          <AttivitaLead leadId={selected?.id} />
        </div>

        {/* Flow email */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Flow email</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {FLOW_OPTIONS.map(o => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: form.flowEmail === o ? 'var(--accentbg)' : 'transparent' }}>
                <input type="radio" name="flowEmail" checked={form.flowEmail === o} onChange={() => setForm(f => ({ ...f, flowEmail: o }))} style={{ width: 'auto' }} />
                <span style={{ fontSize: 13 }}>{o}</span>
                {form.flowEmail === o && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Attivo</span>}
              </label>
            ))}
            {form.flowEmail && (
              <button onClick={() => setForm(f => ({ ...f, flowEmail: '' }))} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--txt3)', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>
                ✕ Rimuovi flow
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Riga 3: Note + Scoring */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Note</div>
          <textarea style={{ minHeight: 100, width: '100%' }}
            placeholder="Note libere sul lead..."
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Scoring</div>
          <S label="Priorità">
            <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))}>
              {PRIORITA.map(p => <option key={p}>{p}</option>)}
            </select>
          </S>
          <S label="Valore potenziale (€)">
            <input type="number" placeholder="es. 2500" value={form.valoreStimato}
              onChange={e => setForm(f => ({ ...f, valoreStimato: e.target.value }))} />
          </S>
        </div>
      </div>

    </div>
  )
}

function AttivitaLead({ leadId }) {
  const [eventi, setEventi] = useState([])
  const [contenuti, setContenuti] = useState([])
  const [archivio, setArchivio] = useState([])
  const [selectedContenuto, setSelectedContenuto] = useState('')
  const [dataInvio, setDataInvio] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!leadId) return
    const unsub = onSnapshot(collection(db, 'eventi'), snap => {
      setEventi(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => (e.invitati || []).includes(leadId)))
    })
    return () => unsub()
  }, [leadId])

  useEffect(() => {
    if (!leadId) return
    const unsub = onSnapshot(collection(db, 'leads', leadId, 'contenuti'),
      snap => setContenuti(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => unsub()
  }, [leadId])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), snap => {
      if (snap.exists()) setArchivio(snap.data().contenuti || [])
    })
    return () => unsub()
  }, [])

  const aggiungiContenuto = async () => {
    if (!selectedContenuto) return alert('Seleziona un contenuto.')
    setSaving(true)
    const c = archivio.find(c => c.nome === selectedContenuto)
    await addDoc(collection(db, 'leads', leadId, 'contenuti'), {
      ...c, data: dataInvio || new Date().toISOString().split('T')[0], createdAt: Date.now(),
    })
    setSelectedContenuto(''); setDataInvio(''); setSaving(false)
  }

  const eliminaContenuto = async id => await deleteDoc(doc(db, 'leads', leadId, 'contenuti', id))

  return (
    <div>
      {contenuti.length === 0 && eventi.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>Nessuna attività ancora.</div>
      )}

      {contenuti.sort((a, b) => b.createdAt - a.createdAt).map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--accentbg)', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{c.tipo}</span>
          <span style={{ fontSize: 12, flex: 1 }}>{c.nome}</span>
          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>🔗</a>}
          <span style={{ fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>{c.data ? new Date(c.data).toLocaleDateString('it-IT') : '—'}</span>
          <button onClick={() => eliminaContenuto(c.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
        </div>
      ))}

      {eventi.map(e => {
        const presenze = e.presenze?.[leadId] || {}
        const giorni = e.giorni || []
        const haPresenza = Object.values(presenze).some(v => v)
        const tuttiPresenti = giorni.length > 0 && giorni.every((_, i) => presenze[`g${i}`])
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, flex: 1 }}>{e.nome}</span>
            <span style={{ fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>
              {e.dataInizio ? new Date(e.dataInizio).toLocaleDateString('it-IT') : '—'}
            </span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: tuttiPresenti ? '#EAF3DE' : haPresenza ? '#FAEEDA' : '#F1EFE8', color: tuttiPresenti ? '#3B6D11' : haPresenza ? '#854F0B' : '#5F5E5A', flexShrink: 0 }}>
              {tuttiPresenti ? 'Presente' : haPresenza ? 'Parziale' : 'Assente'}
            </span>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <select value={selectedContenuto} onChange={e => setSelectedContenuto(e.target.value)} style={{ flex: 1, minWidth: 150, fontSize: 12 }}>
          <option value="">Aggiungi contenuto...</option>
          {archivio.map((c, i) => <option key={i} value={c.nome}>{c.tipo} — {c.nome}</option>)}
        </select>
        <input type="date" value={dataInvio} onChange={e => setDataInvio(e.target.value)} style={{ width: 130, fontSize: 12 }} />
        <button className="btn-primary" onClick={aggiungiContenuto} disabled={saving} style={{ fontSize: 12, padding: '6px 12px' }}>
          {saving ? '...' : '+'}
        </button>
      </div>
    </div>
  )
}
