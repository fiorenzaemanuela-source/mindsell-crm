import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'

const TIPI_EVENTO = ['Webinar', 'Aula didattica gratuita']

export default function Eventi() {
  const [eventi, setEventi] = useState([])
  const [leads, setLeads] = useState([])
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ nome: '', dataInizio: '', dataFine: '', tipo: 'Webinar', note: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterFunnel, setFilterFunnel] = useState('')
  const [filterPriorita, setFilterPriorita] = useState('')
  const [tab, setTab] = useState('dettagli')

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'eventi'), snap => {
      setEventi(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const unsub2 = onSnapshot(collection(db, 'leads'), snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { unsub1(); unsub2() }
  }, [])

  // Calcola array di date tra inizio e fine
  const calcolaGiorni = (inizio, fine) => {
    if (!inizio) return []
    if (!fine || fine === inizio) return [inizio]
    const giorni = []
    const d = new Date(inizio)
    const f = new Date(fine)
    while (d <= f) {
      giorni.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
    return giorni
  }

  const saveEvento = async () => {
    if (!form.nome.trim()) return alert('Inserisci il nome evento.')
    setSaving(true)
    const giorni = calcolaGiorni(form.dataInizio, form.dataFine)
    const presenze = {} // { leadId: { giorno_0: true/false, giorno_1: true/false } }
    if (selected) {
      await updateDoc(doc(db, 'eventi', selected.id), { ...form, giorni, updatedAt: Date.now() })
    } else {
      await addDoc(collection(db, 'eventi'), {
        ...form, giorni, invitati: [], presenze, createdAt: Date.now()
      })
    }
    setSaving(false)
    setView('list')
    setSelected(null)
    setForm({ nome: '', dataInizio: '', dataFine: '', tipo: 'Webinar', note: '' })
  }

  const deleteEvento = async id => {
    if (!confirm('Eliminare questo evento?')) return
    await deleteDoc(doc(db, 'eventi', id))
    setView('list')
  }

  const toggleInvitato = async (eventoId, leadId) => {
    const evento = eventi.find(e => e.id === eventoId)
    const invitati = evento.invitati || []
    const isInvitato = invitati.includes(leadId)
    const nuoviInvitati = isInvitato
      ? invitati.filter(id => id !== leadId)
      : [...invitati, leadId]
    // Se rimosso, cancella anche presenze
    const presenze = { ...(evento.presenze || {}) }
    if (isInvitato) delete presenze[leadId]
    await updateDoc(doc(db, 'eventi', eventoId), { invitati: nuoviInvitati, presenze })
  }

  const togglePresenza = async (eventoId, leadId, giornoIndex) => {
    const evento = eventi.find(e => e.id === eventoId)
    const presenze = { ...(evento.presenze || {}) }
    if (!presenze[leadId]) presenze[leadId] = {}
    presenze[leadId][`g${giornoIndex}`] = !presenze[leadId][`g${giornoIndex}`]

    await updateDoc(doc(db, 'eventi', eventoId), { presenze })

    // Se presente almeno un giorno → priorità Alta
    const haPresenza = Object.values(presenze[leadId]).some(v => v)
    if (haPresenza) {
      await updateDoc(doc(db, 'leads', leadId), { priorita: 'Alta', updatedAt: Date.now() })
    }
  }

  const invitaTutti = async (eventoId, leadsDaInvitare) => {
    const evento = eventi.find(e => e.id === eventoId)
    const invitati = evento.invitati || []
    const nuovi = leadsDaInvitare.filter(l => !invitati.includes(l.id)).map(l => l.id)
    if (nuovi.length === 0) return
    await updateDoc(doc(db, 'eventi', eventoId), {
      invitati: [...invitati, ...nuovi]
    })
  }

  const deselezionaTutti = async (eventoId, leadsDaRimuovere) => {
    const evento = eventi.find(e => e.id === eventoId)
    const invitati = evento.invitati || []
    const ids = leadsDaRimuovere.map(l => l.id)
    const nuovi = invitati.filter(id => !ids.includes(id))
    const presenze = { ...(evento.presenze || {}) }
    ids.forEach(id => delete presenze[id])
    await updateDoc(doc(db, 'eventi', eventoId), { invitati: nuovi, presenze })
  }

  const openEdit = (evento) => {
    setSelected(evento)
    setForm({
      nome: evento.nome,
      dataInizio: evento.dataInizio || evento.data || '',
      dataFine: evento.dataFine || '',
      tipo: evento.tipo,
      note: evento.note || ''
    })
    setTab('dettagli')
    setView('detail')
  }

  const openNew = () => {
    setSelected(null)
    setForm({ nome: '', dataInizio: '', dataFine: '', tipo: 'Webinar', note: '' })
    setView('new')
  }

  // ── LISTA ──────────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Eventi</h1>
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>{eventi.length} eventi totali</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Nuovo evento</button>
      </div>
      {eventi.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
          <div style={{ fontSize: 14 }}>Nessun evento ancora. Creane uno.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {eventi.sort((a, b) => (a.dataInizio || '') > (b.dataInizio || '') ? -1 : 1).map(e => {
            const invitati = e.invitati?.length || 0
            const presenze = e.presenze || {}
            const presentiAlmeno1 = Object.values(presenze).filter(p => Object.values(p).some(v => v)).length
            const giorni = e.giorni || []
            const presentiTutti = giorni.length > 1
              ? Object.values(presenze).filter(p => giorni.every((_, i) => p[`g${i}`])).length
              : presentiAlmeno1
            const tasso = invitati > 0 ? Math.round((presentiAlmeno1 / invitati) * 100) : 0

            return (
              <div key={e.id} className="card" style={{ padding: '18px 20px', cursor: 'pointer' }} onClick={() => openEdit(e)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{e.nome}</div>
                    <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
                      {e.tipo} · {e.dataInizio ? new Date(e.dataInizio).toLocaleDateString('it-IT') : '—'}
                      {e.dataFine && e.dataFine !== e.dataInizio ? ` → ${new Date(e.dataFine).toLocaleDateString('it-IT')}` : ''}
                      {giorni.length > 1 ? ` (${giorni.length} giorni)` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{invitati}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Invitati</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{presentiAlmeno1}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Presenti ≥1gg</div>
                    </div>
                    {giorni.length > 1 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#9B59B6' }}>{presentiTutti}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Tutti i gg</div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: tasso >= 50 ? '#1D9E75' : '#EF9F27' }}>{tasso}%</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Tasso</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── NUOVO ──────────────────────────────────────────────────────────────────
  if (view === 'new') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setView('list')}>← Eventi</button>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuovo evento</h1>
      </div>
      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Nome evento *</label>
          <input placeholder="es. Aula gratuita Marzo 2026" value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Data inizio</label>
            <input type="date" value={form.dataInizio}
              onChange={e => setForm(f => ({ ...f, dataInizio: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Data fine (opzionale)</label>
            <input type="date" value={form.dataFine}
              onChange={e => setForm(f => ({ ...f, dataFine: e.target.value }))} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Tipo</label>
          <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {TIPI_EVENTO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Note</label>
          <textarea placeholder="Note sull'evento..." value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ minHeight: 80 }} />
        </div>
        <button className="btn-primary" onClick={saveEvento} disabled={saving}>
          {saving ? 'Salvataggio...' : 'Crea evento'}
        </button>
      </div>
    </div>
  )

  // ── DETTAGLIO ──────────────────────────────────────────────────────────────
  const evento = eventi.find(e => e.id === selected?.id) || selected
  if (!evento) return null

  const invitati = evento.invitati || []
  const presenze = evento.presenze || {}
  const giorni = evento.giorni || (evento.dataInizio ? [evento.dataInizio] : [])
  const presentiAlmeno1 = Object.values(presenze).filter(p => Object.values(p).some(v => v)).length
  const presentiTutti = giorni.length > 1
    ? Object.values(presenze).filter(p => giorni.every((_, i) => p[`g${i}`])).length
    : presentiAlmeno1
  const tasso = invitati.length > 0 ? Math.round((presentiAlmeno1 / invitati.length) * 100) : 0

  const leadsFiltrati = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || (l.nome + ' ' + l.cognome).toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q)
    const matchFunnel = !filterFunnel || l.funnel === filterFunnel
    const matchPriorita = !filterPriorita || l.priorita === filterPriorita
    return matchSearch && matchFunnel && matchPriorita
  })

  const TABS = [
    { id: 'dettagli',    label: 'Dettagli' },
    { id: 'invitati',    label: `Invitati (${invitati.length})` },
    { id: 'statistiche', label: 'Statistiche' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setView('list')}>← Eventi</button>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>{evento.nome}</h1>
          <span style={{ fontSize: 13, color: 'var(--txt2)' }}>{evento.tipo}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => deleteEvento(evento.id)}>Elimina</button>
          <button className="btn-primary" onClick={saveEvento} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
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

      {tab === 'dettagli' && (
        <div className="card" style={{ padding: 24, maxWidth: 600 }}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Nome evento</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data inizio</label>
              <input type="date" value={form.dataInizio} onChange={e => setForm(f => ({ ...f, dataInizio: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data fine (opzionale)</label>
              <input type="date" value={form.dataFine} onChange={e => setForm(f => ({ ...f, dataFine: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPI_EVENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ minHeight: 80 }} />
          </div>
        </div>
      )}

      {tab === 'invitati' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input placeholder="Cerca per nome o email..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }} />
            <select value={filterFunnel} onChange={e => setFilterFunnel(e.target.value)} style={{ width: 220 }}>
              <option value="">Tutti i funnel</option>
              {[...new Set(leads.map(l => l.funnel).filter(Boolean))].map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select value={filterPriorita} onChange={e => setFilterPriorita(e.target.value)} style={{ width: 160 }}>
              <option value="">Tutte le priorità</option>
              {['Alta', 'Media', 'Bassa'].map(p => <option key={p}>{p}</option>)}
            </select>
            <button className="btn-ghost" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={() => invitaTutti(evento.id, leadsFiltrati)}>
              ✓ Invita tutti ({leadsFiltrati.length})
            </button>
            <button className="btn-ghost" style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'var(--red)' }}
              onClick={() => deselezionaTutti(evento.id, leadsFiltrati)}>
              ✕ Rimuovi tutti
            </button>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Lead</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Funnel</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Priorità</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Invitato</th>
                  {giorni.map((g, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--txt2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {giorni.length > 1 ? `Giorno ${i + 1}` : 'Presente'}
                      <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--txt3)' }}>
                        {new Date(g).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsFiltrati.map(l => {
                  const isInvitato = invitati.includes(l.id)
                  const presenzeL = presenze[l.id] || {}
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 500 }}>{l.nome} {l.cognome}</div>
                        <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{l.email}</div>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--txt2)', fontSize: 12 }}>{l.funnel || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {l.priorita && <span className={`badge ${l.priorita === 'Alta' ? 'badge-red' : l.priorita === 'Media' ? 'badge-amber' : 'badge-gray'}`}>{l.priorita}</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <input type="checkbox" checked={isInvitato}
                          onChange={() => toggleInvitato(evento.id, l.id)} />
                      </td>
                      {giorni.map((_, i) => (
                        <td key={i} style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={!!presenzeL[`g${i}`]}
                            disabled={!isInvitato}
                            onChange={() => togglePresenza(evento.id, l.id, i)} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'statistiche' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { label: 'Invitati',           value: invitati.length,                   color: 'var(--accent)' },
            { label: 'Presenti ≥ 1 giorno', value: presentiAlmeno1,                  color: '#1D9E75' },
            { label: 'Presenti tutti i gg', value: presentiTutti,                    color: '#9B59B6' },
            { label: 'Assenti',             value: invitati.length - presentiAlmeno1, color: '#EF9F27' },
            { label: 'Tasso partecipazione', value: tasso + '%',                     color: tasso >= 50 ? '#1D9E75' : '#E24B4A' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
