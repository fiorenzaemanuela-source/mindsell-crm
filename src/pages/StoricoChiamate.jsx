import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore'

const ESITI = [
  { id: 'prenotata',     label: 'Consulenza prenotata', bg: '#EAF3DE', color: '#3B6D11' },
  { id: 'non_risponde',  label: 'Non risponde',          bg: '#F1EFE8', color: '#5F5E5A' },
  { id: 'da_risentire',  label: 'Da risentire',          bg: '#FAEEDA', color: '#854F0B' },
  { id: 'non_in_target', label: 'Non in target',         bg: '#FCEBEB', color: '#A32D2D' },
  { id: 'numero_errato', label: 'Numero errato',         bg: '#FFF3E0', color: '#854F0B' },
  { id: 'blacklist',     label: 'Black list lead',        bg: '#FCEBEB', color: '#A32D2D' },
]

const C = {
  bg:      '#080A0D',
  card:    '#0F1218',
  border:  '#1E2A38',
  green:   '#6DBF2A',
  text:    '#F0F4F8',
  mid:     '#8A9BB0',
  dim:     '#4A5A6E',
  mono:    "'Montserrat', sans-serif",
  amber:   '#E8A020',
}

const formatDurata = sec => {
  if (!sec) return '—'
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
  if (diff < 86400 * 2) return 'ieri'
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}gg fa`
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

const isOggi = ts => {
  if (!ts) return false
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  const oggi = new Date()
  return date.toDateString() === oggi.toDateString()
}

const isIeri = ts => {
  if (!ts) return false
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  const ieri = new Date(); ieri.setDate(ieri.getDate() - 1)
  return date.toDateString() === ieri.toDateString()
}

const isSettimana = ts => {
  if (!ts) return false
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  return (Date.now() - date.getTime()) < 7 * 86400 * 1000
}

const isMese = ts => {
  if (!ts) return false
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  return (Date.now() - date.getTime()) < 30 * 86400 * 1000
}

export default function StoricoChiamate() {
  const [chiamate, setChiamate] = useState([])
  const [filtro, setFiltro] = useState('Oggi')
  const [search, setSearch] = useState('')
  const [filtroEsito, setFiltroEsito] = useState('')
  const [editingEsito, setEditingEsito] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'chiamate'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setChiamate(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const filtrate = chiamate.filter(c => {
    const ts = c.timestamp
    const matchTempo = filtro === 'Tutti' ? true
      : filtro === 'Oggi' ? isOggi(ts)
      : filtro === 'Ieri' ? isIeri(ts)
      : filtro === 'Ultima settimana' ? isSettimana(ts)
      : filtro === 'Ultimo mese' ? isMese(ts)
      : true

    const q = search.toLowerCase()
    const matchSearch = !q ||
      (c.lead_nome || '').toLowerCase().includes(q) ||
      (c.lead_telefono || '').includes(q) ||
      (c.lead_settore || '').toLowerCase().includes(q) ||
      (c.note || '').toLowerCase().includes(q)

    const matchEsito = !filtroEsito || c.esito === filtroEsito

    return matchTempo && matchSearch && matchEsito
  })

  const cambiaEsito = async (id, nuovoEsito) => {
    await updateDoc(doc(db, 'chiamate', id), { esito: nuovoEsito })
    setEditingEsito(null)
  }

  const FILTRI = ['Oggi', 'Ieri', 'Ultima settimana', 'Ultimo mese', 'Passato']

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: C.text }}>Storico Chiamate</h1>
        <p style={{ color: C.mid, fontSize: 14, marginTop: 3 }}>
          Tutte le chiamate registrate, dalla più recente. Puoi cambiare l'esito direttamente dalla riga.
        </p>
      </div>

      {/* Filtri temporali + ricerca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTRI.map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              background: filtro === f ? C.green : C.card,
              color: filtro === f ? '#060A02' : C.mid,
              fontWeight: filtro === f ? 700 : 400,
            }}>
              {f}
            </button>
          ))}
        </div>

        <input
          placeholder="Cerca nome, telefono, settore, note..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: '7px 12px', fontSize: 13, outline: 'none' }}
        />

        <select
          value={filtroEsito}
          onChange={e => setFiltroEsito(e.target.value)}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.mid, padding: '7px 12px', fontSize: 13 }}
        >
          <option value="">Tutti gli esiti</option>
          {ESITI.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>

      {/* Contatore */}
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 12, fontFamily: C.mono }}>
        {filtrate.length} chiamate{filtro !== 'Tutti' ? ` · ${filtro.toLowerCase()}` : ''}
        {filtroEsito ? ` · ${ESITI.find(e => e.id === filtroEsito)?.label}` : ''}
      </div>

      {/* Tabella */}
      {filtrate.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: C.dim }}>
          <div style={{ fontSize: 32, opacity: .15, marginBottom: 12 }}>◷</div>
          <div style={{ fontSize: 14 }}>Nessuna chiamata in questo periodo.</div>
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {['QUANDO', 'CLIENTE', 'TELEFONO', 'SETTORE', 'ESITO', 'DURATA', 'NOTE', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.dim, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrate.map(c => {
                const esito = ESITI.find(e => e.id === c.esito)
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1F1D1A'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    {/* Quando */}
                    <td style={{ padding: '11px 14px', color: C.dim, fontSize: 12, fontFamily: C.mono, whiteSpace: 'nowrap' }}>
                      {tempoRelativo(c.timestamp)}
                    </td>

                    {/* Cliente */}
                    <td style={{ padding: '11px 14px', fontWeight: 500, color: C.text, whiteSpace: 'nowrap' }}>
                      {c.lead_nome || '—'}
                    </td>

                    {/* Telefono */}
                    <td style={{ padding: '11px 14px', color: C.mid, whiteSpace: 'nowrap' }}>
                      {c.lead_telefono ? (
                        <a href={`tel:${c.lead_telefono}`} style={{ color: C.mid, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          📞 {c.lead_telefono}
                        </a>
                      ) : '—'}
                    </td>

                    {/* Settore */}
                    <td style={{ padding: '11px 14px', color: C.mid, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lead_settore || '—'}
                    </td>

                    {/* Esito — cliccabile per modifica */}
                    <td style={{ padding: '11px 14px', position: 'relative' }}>
                      {editingEsito === c.id ? (
                        <div style={{ position: 'absolute', top: 4, left: 8, zIndex: 10, background: '#242220', border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                          {ESITI.map(e => (
                            <div key={e.id} onClick={() => cambiaEsito(c.id, e.id)}
                              style={{ padding: '6px 10px', borderRadius: 5, cursor: 'pointer', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={el => el.currentTarget.style.background = C.border}
                              onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ background: e.bg, color: e.color, fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>{e.label}</span>
                            </div>
                          ))}
                          <button onClick={() => setEditingEsito(null)} style={{ width: '100%', marginTop: 4, padding: '4px', background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 11 }}>Annulla</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {esito ? (
                            <span style={{ background: esito.bg, color: esito.color, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                              {esito.label}
                            </span>
                          ) : (
                            <span style={{ color: C.dim, fontSize: 11 }}>—</span>
                          )}
                          <button onClick={() => setEditingEsito(c.id)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 11, padding: '2px 4px', borderRadius: 3 }} title="Cambia esito">
                            ✏
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Durata */}
                    <td style={{ padding: '11px 14px', fontFamily: C.mono, fontSize: 12, color: C.mid, whiteSpace: 'nowrap' }}>
                      {formatDurata(c.durata)}
                    </td>

                    {/* Note */}
                    <td style={{ padding: '11px 14px', color: C.dim, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.note || '—'}
                    </td>

                    {/* Azioni */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {c.lead_telefono && (
                        <a href={`tel:${c.lead_telefono}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: '#1E2A38', color: C.green, textDecoration: 'none', fontSize: 11, fontWeight: 600 }}>
                          ↺ Nuova call
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
