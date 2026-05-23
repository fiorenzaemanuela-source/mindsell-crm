import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore'

// ── Esiti chiamata ─────────────────────────────────────────────
const ESITI_CHIAMATA = [
  { id: 'prenotata',    label: 'Consulenza prenotata', tipo: 'positivo',  color: '#6DBF2A', textColor: '#060A02' },
  { id: 'non_risponde', label: 'Non risponde',          tipo: 'riprovare', color: '#1E2A38', textColor: '#F0F4F8' },
  { id: 'da_risentire', label: 'Da risentire',          tipo: 'riprovare', color: '#C87A10', textColor: '#FAEEDA' },
  { id: 'non_in_target',label: 'Non in target',         tipo: 'chiudi',    color: '#2A1010', textColor: '#F09595' },
  { id: 'numero_errato',label: 'Numero errato',         tipo: 'chiudi',    color: '#2A1010', textColor: '#F09595' },
  { id: 'blacklist',    label: 'Black list lead',        tipo: 'chiudi',    color: '#0F0606', textColor: '#E24B4A' },
]

const ESITO_BADGE = {
  prenotata:     { bg: '#EAF3DE', color: '#3B6D11' },
  non_risponde:  { bg: '#F1EFE8', color: '#5F5E5A' },
  da_risentire:  { bg: '#FAEEDA', color: '#C87A10' },
  non_in_target: { bg: '#FCEBEB', color: '#A32D2D' },
  numero_errato: { bg: '#FFF3E0', color: '#C87A10' },
  blacklist:     { bg: '#FCEBEB', color: '#A32D2D' },
}

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

// ── Helpers ────────────────────────────────────────────────────
const C = {
  bg:      '#080A0D',
  card:    '#0F1218',
  card2:   '#131820',
  border:  '#1E2A38',
  border2: '#2A3A4E',
  green:   '#6DBF2A',
  blue:    '#2B6CB8',
  text:    '#F0F4F8',
  textMid: '#8A9BB0',
  textDim: '#4A5A6E',
  mono:    "'Montserrat', sans-serif",
}

const stageDot = stage => ({
  'Messaggio di benvenuto': '#378ADD',
  'Chiamata': '#BA7517',
  'Non risponde — richiamare': '#E8A020',
  'Consulenza fissata': '#1D9E75',
  'Cliente acquisito': '#2D2D8F',
  'Non interessato': '#E24B4A',
  'Cliente non in target': '#888',
  'Appuntamento telefonico': '#9B59B6',
  'Email di contatto': '#3498DB',
  'Cliente irreperibile': '#555',
  'Contatto non utile': '#E67E22',
}[stage] || '#888')

const formatDurata = sec => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const tempoRelativo = ts => {
  if (!ts) return '—'
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  return `${Math.floor(diff / 86400)}gg fa`
}

const Field = ({ label, children }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    {children}
  </div>
)

const SectionField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
      {label}
    </div>
    {children}
  </div>
)

// ── Componente principale ──────────────────────────────────────
export default function Leads() {
  const { user, profile } = useAuth()
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
  const [modalOpen, setModalOpen] = useState(false)

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
  const STAGE_OPTIONS = crmConfig?.stati || DEFAULT_STATI

  const q = (search || '').toLowerCase()
  const filtered = leads
    .filter(l => {
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
    .sort((a, b) => {
      let va, vb
      if (sortBy === 'nome') {
        va = `${a.nome || ''} ${a.cognome || ''}`.toLowerCase()
        vb = `${b.nome || ''} ${b.cognome || ''}`.toLowerCase()
      } else if (sortBy === 'email') {
        va = a.email || ''; vb = b.email || ''
      } else if (sortBy === 'funnel') {
        va = a.funnel || ''; vb = b.funnel || ''
      } else if (sortBy === 'priorita') {
        const ord = { Alta: 0, Media: 1, Bassa: 2 }
        va = ord[a.priorita] ?? 3; vb = ord[b.priorita] ?? 3
        return sortDir === 'asc' ? va - vb : vb - va
      } else {
        va = a.createdAt || 0; vb = b.createdAt || 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const openNew = () => {
    setForm({ ...EMPTY_LEAD })
    setSelected(null)
    setView('new')
  }

  const openDetail = lead => {
    const fonti = crmConfig?.fontiFunnel?.[lead.funnel]
    const fonte = lead.fonte || (fonti?.length === 1 ? fonti[0] : '')
    setForm({ ...EMPTY_LEAD, ...lead, fonte })
    setSelected(lead)
    setShowQuestionario(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelected(null)
  }

  const saveEdit = async () => {
    setSaving(true)
    const tags = typeof form.tags === 'string'
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : form.tags || []
    await updateDoc(doc(db, 'leads', selected.id), { ...form, tags, updatedAt: Date.now() })
    setSaving(false)
  }

  const saveNew = async () => {
    if (!form.nome.trim()) return alert('Inserisci almeno il nome.')
    setSaving(true)
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    await addDoc(collection(db, 'leads'), { ...form, tags, createdAt: Date.now() })
    setSaving(false)
    setView('list')
  }

  const deleteLead = async id => {
    if (!confirm('Eliminare questo lead?')) return
    await deleteDoc(doc(db, 'leads', id))
    closeModal()
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
        tags: [], note: '', flowEmail: '', canale: '',
        valoreStimato: '', esito: '', motivoPerdita: '',
        createdAt: Date.now(),
      })
      count++
    }
    alert(`✅ Importati ${count} lead`)
    e.target.value = ''
  }

  const Toggle = () => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
      {['list', 'kanban'].map(m => (
        <button key={m} onClick={() => setViewMode(m)} style={{
          padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
          background: viewMode === m ? 'var(--card)' : 'transparent',
          color: viewMode === m ? 'var(--txt)' : 'var(--txt3)',
          fontWeight: viewMode === m ? 600 : 400,
        }}>
          {m === 'list' ? '☰ Lista' : '⊞ Kanban'}
        </button>
      ))}
    </div>
  )

  // ── KANBAN ────────────────────────────────────────────────────
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
                    <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '16px 0', background: 'var(--card)', borderRadius: 8 }}>Nessun lead</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {modalOpen && selected && (
          <LeadModal
            lead={selected} form={form} setForm={setForm}
            onClose={closeModal} onSave={saveEdit} onDelete={deleteLead}
            saving={saving} crmConfig={crmConfig}
            STAGE_OPTIONS={STAGE_OPTIONS} FUNNEL_OPTIONS={FUNNEL_OPTIONS}
            showQuestionario={showQuestionario} setShowQuestionario={setShowQuestionario}
            user={user} profile={profile}
          />
        )}
      </div>
    )
  }

  // ── LISTA ─────────────────────────────────────────────────────
  if (view === 'list') {
    return (
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
            <div style={{ fontSize: 14 }}>
              {leads.length === 0 ? 'Nessun lead ancora. Aggiungine uno o importa un CSV.' : 'Nessun lead corrisponde ai filtri.'}
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'Lead', key: 'nome' },
                      { label: 'Email', key: 'email' },
                      { label: 'Funnel', key: 'funnel' },
                      { label: 'Stato', key: null },
                      { label: 'Ultima chiamata', key: null },
                      { label: 'Priorità', key: 'priorita' },
                      { label: 'Fonte', key: null },
                      { label: 'Data inserimento', key: 'createdAt' },
                      { label: '', key: null },
                    ].map(h => (
                      <th key={h.label} onClick={() => {
                        if (!h.key) return
                        if (sortBy === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                        else { setSortBy(h.key); setSortDir('asc') }
                      }} style={{
                        padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                        color: sortBy === h.key ? 'var(--accent)' : 'var(--txt2)',
                        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
                        whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none',
                      }}>
                        {h.label}{sortBy === h.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const esitoBadge = ESITO_BADGE[l.ultimoEsito] || null
                    const esitoLabel = ESITI_CHIAMATA.find(e => e.id === l.ultimoEsito)?.label || null
                    return (
                      <tr key={l.id} onClick={() => openDetail(l)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '' }}
                      >
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
                          {l.stage && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: stageDot(l.stage), flexShrink: 0 }} />
                              {l.stage}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {esitoBadge && esitoLabel && (
                            <span style={{ background: esitoBadge.bg, color: esitoBadge.color, fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                              {esitoLabel}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {l.priorita && (
                            <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>
                              {l.priorita}
                            </span>
                          )}
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

        {/* Modal sovrapposto */}
        {modalOpen && selected && (
          <LeadModal
            lead={selected} form={form} setForm={setForm}
            onClose={closeModal} onSave={saveEdit} onDelete={deleteLead}
            saving={saving} crmConfig={crmConfig}
            STAGE_OPTIONS={STAGE_OPTIONS} FUNNEL_OPTIONS={FUNNEL_OPTIONS}
            showQuestionario={showQuestionario} setShowQuestionario={setShowQuestionario}
            user={user} profile={profile}
          />
        )}
      </div>
    )
  }

  // ── NUOVO LEAD ────────────────────────────────────────────────
  if (view === 'new') {
    const flussoNew = form.funnel && crmConfig?.flussi?.[form.funnel]?.length > 0
      ? crmConfig.flussi[form.funnel] : STAGE_OPTIONS
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
              <Field label="Nome *"><input placeholder="Marco" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></Field>
              <Field label="Cognome"><input placeholder="Rossi" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} /></Field>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
              <Field label="Telefono"><input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></Field>
            </div>
            <div className="form-row">
              <Field label="Fonte">
                <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {(form.funnel && crmConfig?.fontiFunnel?.[form.funnel]?.length > 0 ? crmConfig.fontiFunnel[form.funnel] : FONTE_OPTIONS).map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Canale">
                <select value={form.canale} onChange={e => setForm(f => ({ ...f, canale: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {CANALE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Percorso</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <Field label="Funnel">
                <select value={form.funnel} onChange={e => { const f = e.target.value; const fonti = crmConfig?.fontiFunnel?.[f]; setForm(prev => ({ ...prev, funnel: f, stage: '', fonte: fonti?.length === 1 ? fonti[0] : prev.fonte })) }}>
                  <option value="">Seleziona...</option>
                  {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Stato">
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {flussoNew.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <Field label="Priorità">
                <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))}>
                  {PRIORITA.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Valore potenziale (€)">
                <input type="number" placeholder="es. 2500" value={form.valoreStimato} onChange={e => setForm(f => ({ ...f, valoreStimato: e.target.value }))} />
              </Field>
            </div>
            <Field label="Note"><textarea style={{ minHeight: 80 }} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Modal scheda lead ──────────────────────────────────────────
function LeadModal({ lead, form, setForm, onClose, onSave, onDelete, saving, crmConfig, STAGE_OPTIONS, FUNNEL_OPTIONS, showQuestionario, setShowQuestionario, user, profile }) {
  const flussoCorrente = form.funnel && crmConfig?.flussi?.[form.funnel]?.length > 0
    ? crmConfig.flussi[form.funnel] : STAGE_OPTIONS

  const haQuestionario = !!(form.settore || form.ruolo || form.esperienzaVendita || form.obiettivoLead || form.haCorsiVendita || form.citta || form.datiQuestionario)
  const campiQ = [
    { label: 'Settore', val: form.settore },
    { label: 'Ruolo', val: form.ruolo },
    { label: 'Esperienza vendita', val: form.esperienzaVendita },
    { label: 'Ha già fatto corsi', val: form.haCorsiVendita },
    { label: 'Obiettivo / Priorità', val: form.obiettivoLead },
    { label: 'Città', val: form.citta },
    ...(form.datiQuestionario ? Object.entries(form.datiQuestionario).map(([k, v]) => ({ label: k, val: v })) : []),
  ].filter(c => c.val)

  // Chiudi con ESC
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 780,
        background: '#0F1218',
        borderRadius: 12,
        border: '1px solid #2E2C29',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 48px)',
        overflow: 'hidden',
      }}>

        {/* Header modal */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2E2C29', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1E2A38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6DBF2A', flexShrink: 0 }}>
            {(form.nome?.[0] || '?').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4F8' }}>{form.nome} {form.cognome}</div>
            <div style={{ fontSize: 12, color: '#8A9BB0' }}>{form.email}</div>
          </div>
          {form.telefono && (
            <a href={`tel:${form.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#1E2A38', color: '#6DBF2A', textDecoration: 'none', fontSize: 13, fontWeight: 500, border: '1px solid #3D4E00' }}>
              📞 {form.telefono}
            </a>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onSave(); }} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, background: '#6DBF2A', color: '#060A02', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? '...' : 'Salva'}
            </button>
            <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', color: '#8A9BB0', border: '1px solid #2E2C29', cursor: 'pointer', fontSize: 13 }}>
              ✕
            </button>
          </div>
        </div>

        {/* Corpo modal scrollabile */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Nota generale */}
          <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6DBF2A', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              ✏ Nota generale del lead <span style={{ color: '#4A5A6E', fontWeight: 400 }}>· autosave</span>
            </div>
            <textarea
              style={{ width: '100%', minHeight: 60, background: 'transparent', border: 'none', color: '#F0F4F8', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
              placeholder="Note libere su questo lead — visibili a tutti i venditori che lo lavorano..."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          {/* Storia chiamate */}
          <StoriaChiamateLead leadId={lead.id} />

          {/* Sezione avvia chiamata */}
          <AvviaChiamata lead={lead} form={form} setForm={setForm} user={user} profile={profile} onSaveForm={onSave} />

          {/* Anagrafica + Percorso */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Anagrafica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Nome', 'nome'], ['Cognome', 'cognome'], ['Email', 'email'], ['Telefono', 'telefono']].map(([lbl, key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 3 }}>{lbl}</div>
                    <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', fontSize: 12 }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Percorso</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 3 }}>Funnel</div>
                  <select value={form.funnel} onChange={e => { const f = e.target.value; setForm(prev => ({ ...prev, funnel: f, stage: '' })) }} style={{ width: '100%', fontSize: 12 }}>
                    <option value="">—</option>
                    {FUNNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 3 }}>Stato</div>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={{ width: '100%', fontSize: 12 }}>
                    <option value="">—</option>
                    {flussoCorrente.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 3 }}>Priorità</div>
                  <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))} style={{ width: '100%', fontSize: 12 }}>
                    {PRIORITA.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 3 }}>Fonte</div>
                  <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))} style={{ width: '100%', fontSize: 12 }}>
                    <option value="">—</option>
                    {FONTE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Note strutturate MindSell */}
          <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Note strutturate (compila durante la call)
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Settore / Prodotto venduto</div>
              <input
                placeholder="es. Immobiliare, Assicurazioni, Software B2B, Consulenza..."
                value={form.settoreVendita || ''}
                onChange={e => setForm(f => ({ ...f, settoreVendita: e.target.value }))}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Problema principale con le vendite</div>
              <textarea
                placeholder="es. Non riesce a chiudere, paura del rifiuto, non sa gestire le obiezioni, perde clienti sul prezzo..."
                value={form.problemaVendite || ''}
                onChange={e => setForm(f => ({ ...f, problemaVendite: e.target.value }))}
                style={{ width: '100%', minHeight: 72, background: '#0F1218', border: '1px solid #2E2C29', borderRadius: 6, color: '#F0F4F8', fontSize: 12, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: '#4A5A6E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ha già fatto formazione alla vendita?</div>
              <textarea
                placeholder="es. Sì, ha fatto corso X ma non ha visto risultati / No, è la prima volta che investe in formazione..."
                value={form.formazionePrecedente || ''}
                onChange={e => setForm(f => ({ ...f, formazionePrecedente: e.target.value }))}
                style={{ width: '100%', minHeight: 72, background: '#0F1218', border: '1px solid #2E2C29', borderRadius: 6, color: '#F0F4F8', fontSize: 12, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Flow email */}
          <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Flow email</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {FLOW_OPTIONS.map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #2E2C29', cursor: 'pointer', background: form.flowEmail === o ? '#1E2A38' : 'transparent' }}>
                  <input type="radio" name="flowEmail" checked={form.flowEmail === o} onChange={() => setForm(f => ({ ...f, flowEmail: o }))} style={{ width: 'auto' }} />
                  <span style={{ fontSize: 12, color: '#F0F4F8' }}>{o}</span>
                  {form.flowEmail === o && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6DBF2A', fontWeight: 600 }}>Attivo</span>}
                </label>
              ))}
              {form.flowEmail && (
                <button onClick={() => setForm(f => ({ ...f, flowEmail: '' }))} style={{ background: 'none', border: 'none', fontSize: 11, color: '#4A5A6E', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}>✕ Rimuovi flow</button>
              )}
            </div>
          </div>

          {/* Questionario */}
          {haQuestionario && (
            <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setShowQuestionario(v => !v)}>
                <span style={{ fontSize: 20 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4F8' }}>Questionario</div>
                  <div style={{ fontSize: 11, color: '#3B6D11' }}>{campiQ.length} risposte — clicca per {showQuestionario ? 'chiudere' : 'leggere'}</div>
                </div>
                <span style={{ fontSize: 11, color: '#4A5A6E' }}>{showQuestionario ? '▲' : '▼'}</span>
              </div>
              {showQuestionario && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2E2C29' }}>
                  {campiQ.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '5px 0', borderBottom: '1px solid #2E2C29' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: '#F0F4F8' }}>{c.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer elimina */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={() => onDelete(lead.id)} style={{ background: 'none', border: '1px solid #3D1F1F', color: '#E24B4A', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Elimina lead
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Avvia Chiamata ─────────────────────────────────────────────
function AvviaChiamata({ lead, form, setForm, user, profile, onSaveForm }) {
  const [chiamataAttiva, setChiamataAttiva] = useState(false)
  const [durata, setDurata] = useState(0)
  const [noteChiamata, setNoteChiamata] = useState('')
  const [dataRichiamata, setDataRichiamata] = useState('')
  const [oraRichiamata, setOraRichiamata] = useState('')
  const [salvando, setSalvando] = useState(false)
  const intervalRef = useRef(null)
  const startRef = useRef(null)

  const avvia = () => {
    setChiamataAttiva(true)
    setDurata(0)
    startRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      setDurata(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }

  const registraEsito = async (esito) => {
    clearInterval(intervalRef.current)
    setSalvando(true)
    const durataFinale = durata

    try {
      // 1. Salva chiamata in collezione chiamate/
      await addDoc(collection(db, 'chiamate'), {
        lead_id:       lead.id,
        lead_nome:     `${form.nome || ''} ${form.cognome || ''}`.trim(),
        lead_telefono: form.telefono || '',
        lead_settore:  form.professione || form.settore || '',
        esito,
        durata:        durataFinale,
        note:          noteChiamata,
        setter_id:     user?.uid || '',
        setter_nome:   profile?.nome || profile?.email || '',
        timestamp:     serverTimestamp(),
      })

      // 2. Aggiorna ultimo esito sul lead
      await updateDoc(doc(db, 'leads', lead.id), {
        ultimoEsito:        esito,
        ultimaChiamataAt:   Date.now(),
        updatedAt:          Date.now(),
      })

      // 3. Logica recall automatica
      if (esito === 'non_risponde') {
        // Recall automatico 24h
        const dataRichiamo = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await addDoc(collection(db, 'recall'), {
          lead_id:        lead.id,
          lead_nome:      `${form.nome || ''} ${form.cognome || ''}`.trim(),
          lead_telefono:  form.telefono || '',
          lead_settore:   form.professione || form.settore || '',
          tipo_recall:    'automatico_24h',
          data_richiamata: Timestamp.fromDate(dataRichiamo),
          ultima_call:    serverTimestamp(),
          setter_id:      user?.uid || '',
          stato:          'attivo',
        })
      }

      if (esito === 'da_risentire' && dataRichiamata && oraRichiamata) {
        // Recall concordato con data/ora scelte
        const dt = new Date(`${dataRichiamata}T${oraRichiamata}`)
        await addDoc(collection(db, 'recall'), {
          lead_id:        lead.id,
          lead_nome:      `${form.nome || ''} ${form.cognome || ''}`.trim(),
          lead_telefono:  form.telefono || '',
          lead_settore:   form.professione || form.settore || '',
          tipo_recall:    'concordato',
          data_richiamata: Timestamp.fromDate(dt),
          ultima_call:    serverTimestamp(),
          note_recall:    noteChiamata,
          setter_id:      user?.uid || '',
          stato:          'attivo',
        })
      }

      // 4. Aggiorna form con nuovo esito
      setForm(f => ({ ...f, ultimoEsito: esito }))

    } catch (e) {
      console.error('Errore registrazione chiamata:', e)
      alert('Errore nel salvare la chiamata. Riprova.')
    }

    setSalvando(false)
    setChiamataAttiva(false)
    setDurata(0)
    setNoteChiamata('')
    setDataRichiamata('')
    setOraRichiamata('')
  }

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  if (!chiamataAttiva) {
    return (
      <button
        onClick={avvia}
        style={{
          width: '100%', padding: '13px', borderRadius: 8,
          background: '#6DBF2A', color: '#060A02',
          border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700,
          letterSpacing: '.02em',
        }}
      >
        📞 Avvia chiamata
      </button>
    )
  }

  return (
    <div style={{ background: '#080A0D', borderRadius: 8, padding: '14px', border: '1px solid #3D4E00' }}>
      {/* Timer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6DBF2A', display: 'inline-block', animation: 'pulse 1s infinite' }} />
        <span style={{ fontSize: 13, color: '#6DBF2A', fontWeight: 500 }}>Chiamata in corso</span>
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: '#F0F4F8' }}>
          {formatDurata(durata)}
        </span>
      </div>

      {/* Note durante la call */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Note durante la call</div>
        <textarea
          value={noteChiamata}
          onChange={e => setNoteChiamata(e.target.value)}
          placeholder="Scrivi note mentre parli..."
          style={{ width: '100%', minHeight: 52, background: '#0F1218', border: '1px solid #2E2C29', borderRadius: 6, color: '#F0F4F8', fontSize: 12, padding: '6px 8px', resize: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Da risentire — selettore data/ora */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Se "Da risentire" — scegli quando</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={dataRichiamata} onChange={e => setDataRichiamata(e.target.value)} style={{ flex: 1, fontSize: 12, background: '#0F1218', border: '1px solid #2E2C29', borderRadius: 6, color: '#F0F4F8', padding: '6px 8px' }} />
          <input type="time" value={oraRichiamata} onChange={e => setOraRichiamata(e.target.value)} style={{ width: 100, fontSize: 12, background: '#0F1218', border: '1px solid #2E2C29', borderRadius: 6, color: '#F0F4F8', padding: '6px 8px' }} />
        </div>
      </div>

      {/* Esito positivo */}
      <div style={{ fontSize: 10, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Esito positivo</div>
      <button onClick={() => registraEsito('prenotata')} disabled={salvando} style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#6DBF2A', color: '#060A02', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        📅 Consulenza prenotata
      </button>

      {/* Da riprovare */}
      <div style={{ fontSize: 10, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Da riprovare</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button onClick={() => registraEsito('non_risponde')} disabled={salvando} style={{ padding: '9px', borderRadius: 8, background: '#1E2A38', color: '#F0F4F8', border: '1px solid #3D3C39', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
          ✕ Non risponde
        </button>
        <button onClick={() => registraEsito('da_risentire')} disabled={salvando || (!dataRichiamata || !oraRichiamata)} style={{ padding: '9px', borderRadius: 8, background: '#1E1400', color: '#E8A020', border: '1px solid #854F0B', cursor: 'pointer', fontSize: 12, fontWeight: 500, opacity: (!dataRichiamata || !oraRichiamata) ? 0.5 : 1 }}>
          ◷ Da risentire
        </button>
      </div>

      {/* Chiudi lead */}
      <div style={{ fontSize: 10, color: '#4A5A6E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Chiudi lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {['non_in_target', 'numero_errato', 'blacklist'].map(id => {
          const esito = ESITI_CHIAMATA.find(e => e.id === id)
          return (
            <button key={id} onClick={() => registraEsito(id)} disabled={salvando} style={{ padding: '8px 4px', borderRadius: 8, background: '#120808', color: '#F09595', border: '1px solid #3D1F1F', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
              {esito.label}
            </button>
          )
        })}
      </div>

      {salvando && <div style={{ textAlign: 'center', fontSize: 12, color: '#8A9BB0', marginTop: 10 }}>Salvataggio...</div>}
    </div>
  )
}

// ── Storia chiamate nella scheda lead ──────────────────────────
function StoriaChiamateLead({ leadId }) {
  const [chiamate, setChiamate] = useState([])

  useEffect(() => {
    if (!leadId) return
    const q = query(
      collection(db, 'chiamate'),
      orderBy('timestamp', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setChiamate(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.lead_id === leadId)
      )
    })
    return () => unsub()
  }, [leadId])

  if (chiamate.length === 0) return null

  return (
    <div style={{ background: '#080A0D', borderRadius: 8, padding: '12px 14px', border: '1px solid #2E2C29' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#4A5A6E', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        ◷ Storia chiamate ({chiamate.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chiamate.map(c => {
          const badge = ESITO_BADGE[c.esito] || { bg: '#1E2A38', color: '#8A9BB0' }
          const label = ESITI_CHIAMATA.find(e => e.id === c.esito)?.label || c.esito
          return (
            <div key={c.id} style={{ padding: '8px 10px', background: '#0F1218', borderRadius: 6, border: '1px solid #2E2C29' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: c.note ? 4 : 0 }}>
                <span style={{ background: badge.bg, color: badge.color, fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: '#4A5A6E' }}>
                  {c.timestamp?.toDate
                    ? c.timestamp.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ', ' +
                      c.timestamp.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                    : '—'
                  }
                </span>
                <span style={{ fontSize: 11, color: '#4A5A6E' }}>· {c.setter_nome || 'Setter'}</span>
                {c.durata > 0 && (
                  <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A9BB0' }}>
                    {formatDurata(c.durata)}
                  </span>
                )}
              </div>
              {c.note && <div style={{ fontSize: 12, color: '#8A9BB0', paddingLeft: 2 }}>{c.note}</div>}
            </div>
          )
        })}
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
    const unsub = onSnapshot(collection(db, 'leads', leadId, 'contenuti'), snap =>
      setContenuti(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
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
    await addDoc(collection(db, 'leads', leadId, 'contenuti'), { ...c, data: dataInvio || new Date().toISOString().split('T')[0], createdAt: Date.now() })
    setSelectedContenuto(''); setDataInvio(''); setSaving(false)
  }

  const eliminaContenuto = async id => { await deleteDoc(doc(db, 'leads', leadId, 'contenuti', id)) }

  return (
    <div>
      {contenuti.length === 0 && eventi.length === 0 && <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>Nessuna attività ancora.</div>}
      {contenuti.sort((a, b) => b.createdAt - a.createdAt).map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--accentbg)', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{c.tipo}</span>
          <span style={{ fontSize: 12, flex: 1 }}>{c.nome}</span>
          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>🔗</a>}
          <span style={{ fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>{c.data ? new Date(c.data).toLocaleDateString('it-IT') : '—'}</span>
          <button onClick={() => eliminaContenuto(c.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <select value={selectedContenuto} onChange={e => setSelectedContenuto(e.target.value)} style={{ flex: 1, minWidth: 150, fontSize: 12 }}>
          <option value="">Aggiungi contenuto...</option>
          {archivio.map((c, i) => <option key={i} value={c.nome}>{c.tipo} — {c.nome}</option>)}
        </select>
        <input type="date" value={dataInvio} onChange={e => setDataInvio(e.target.value)} style={{ width: 130, fontSize: 12 }} />
        <button className="btn-primary" onClick={aggiungiContenuto} disabled={saving} style={{ fontSize: 12, padding: '6px 12px' }}>{saving ? '...' : '+'}</button>
      </div>
    </div>
  )
}
