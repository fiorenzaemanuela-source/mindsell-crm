import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, deleteDoc, doc, addDoc, updateDoc, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore'

const C = {
  bg:     '#151412',
  card:   '#1A1916',
  border: '#2E2C29',
  green:  '#A8D700',
  amber:  '#EF9F27',
  text:   '#F7F5F0',
  mid:    '#9E9B94',
  dim:    '#6B6760',
  mono:   "'JetBrains Mono', 'Fira Mono', monospace",
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

const formatDataRichiamata = ts => {
  if (!ts) return 'Pronto'
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  const ora = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const oggi = new Date()
  const domani = new Date(); domani.setDate(domani.getDate() + 1)

  if (date <= oggi) return 'Pronto'
  if (date.toDateString() === oggi.toDateString()) return `Oggi ${ora}`
  if (date.toDateString() === domani.toDateString()) return `Domani ${ora}`

  const giorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
  const giorno = giorni[date.getDay()]
  const giornon = date.getDate()
  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  const mese = mesi[date.getMonth()]
  return `${giorno} ${giornon} ${mese} ${ora}`
}

const isPronto = ts => {
  if (!ts) return true
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  return date <= new Date()
}

export default function Recall() {
  const [recalls, setRecalls] = useState([])
  const [filtro, setFiltro] = useState('Tutti')

  useEffect(() => {
    const q = query(collection(db, 'recall'), orderBy('data_richiamata', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setRecalls(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.stato === 'attivo')
      )
    })
    return () => unsub()
  }, [])

  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const domani = new Date(oggi); domani.setDate(domani.getDate() + 1)

  const concordati = recalls.filter(r => r.tipo_recall === 'concordato')
  const auto24h = recalls.filter(r => r.tipo_recall === 'automatico_24h')
  const auto48h = recalls.filter(r => r.tipo_recall === 'automatico_48h')

  const filtraPerTab = list => {
    if (filtro === 'Tutti') return list
    if (filtro === 'Oggi') return list.filter(r => {
      const date = r.data_richiamata?.toDate ? r.data_richiamata.toDate() : new Date(r.data_richiamata)
      return date >= oggi && date < domani || date < oggi
    })
    if (filtro === 'Non richiamati') return list.filter(r => isPronto(r.data_richiamata))
    return list
  }

  const elimina = async id => {
    await deleteDoc(doc(db, 'recall', id))
  }

  const totaleOggi = recalls.filter(r => {
    const date = r.data_richiamata?.toDate ? r.data_richiamata.toDate() : null
    return date && date >= oggi && date < domani || (date && date < oggi)
  }).length

  const totaleNonRichiamati = recalls.filter(r => isPronto(r.data_richiamata)).length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: C.text }}>↺ Recall</h1>
        <p style={{ color: C.mid, fontSize: 14, marginTop: 3 }}>
          Lead da richiamare, divisi per tipo di recall.
        </p>
      </div>

      {/* Tab filtri */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[
          { id: 'Tutti', label: `Tutti`, count: recalls.length },
          { id: 'Oggi', label: 'Oggi', count: totaleOggi },
          { id: 'Non richiamati', label: 'Non richiamati', count: totaleNonRichiamati },
        ].map(t => (
          <button key={t.id} onClick={() => setFiltro(t.id)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
            background: filtro === t.id ? C.green : C.card,
            color: filtro === t.id ? '#0A0A00' : C.mid,
            fontWeight: filtro === t.id ? 700 : 400,
          }}>
            {t.label}
            <span style={{
              fontSize: 11, fontFamily: C.mono, fontWeight: 700,
              background: filtro === t.id ? 'rgba(0,0,0,0.15)' : C.border,
              color: filtro === t.id ? '#0A0A00' : C.dim,
              padding: '1px 7px', borderRadius: 10,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {recalls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: C.dim }}>
          <div style={{ fontSize: 32, opacity: .15, marginBottom: 12 }}>↺</div>
          <div style={{ fontSize: 14 }}>Nessun recall attivo. Ottimo lavoro!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Sezione A — DA RISENTIRE: Programmati */}
          {filtraPerTab(concordati).length > 0 && (
            <SezioneRecall
              titolo={`DA RISENTIRE — PROGRAMMATI DA TE (${filtraPerTab(concordati).length})`}
              sottotitolo="Lead che hai messo come 'Da risentire' con data e ora scelta da te."
              coloreLabel={C.green}
              items={filtraPerTab(concordati)}
              onElimina={elimina}
            />
          )}

          {/* Sezione B — RECALL 24H */}
          {filtraPerTab(auto24h).length > 0 && (
            <SezioneRecall
              titolo={`RECALL 24H — PRIMO RICHIAMO (${filtraPerTab(auto24h).length})`}
              sottotitolo="1 tentativo senza risposta. Pronto da richiamare 24h dopo la prima call."
              coloreLabel={C.green}
              items={filtraPerTab(auto24h)}
              onElimina={elimina}
            />
          )}

          {/* Sezione C — RECALL 48H */}
          {filtraPerTab(auto48h).length > 0 && (
            <SezioneRecall
              titolo={`RECALL 48H — ULTIMO PRIMA L2 (${filtraPerTab(auto48h).length})`}
              sottotitolo="2 tentativi senza risposta. Ultimo richiamo prima del passaggio in linea 2."
              coloreLabel={C.amber}
              items={filtraPerTab(auto48h)}
              onElimina={elimina}
            />
          )}

          {/* Nessun risultato per il filtro */}
          {filtraPerTab(concordati).length === 0 &&
           filtraPerTab(auto24h).length === 0 &&
           filtraPerTab(auto48h).length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: C.dim, fontSize: 14 }}>
              Nessun recall per il filtro selezionato.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SezioneRecall({ titolo, sottotitolo, coloreLabel, items, onElimina }) {
  return (
    <div>
      {/* Titolo sezione */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: coloreLabel, letterSpacing: '.04em', marginBottom: 2 }}>
          {titolo}
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>{sottotitolo}</div>
      </div>

      {/* Tabella */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['CLIENTE', 'TELEFONO', 'SETTORE', 'ULTIMA CALL', 'DA RICHIAMARE', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.dim, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(r => {
              const pronto = isPronto(r.data_richiamata)
              const labelData = formatDataRichiamata(r.data_richiamata)
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1F1D1A'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  {/* Cliente */}
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
                    {r.lead_nome || '—'}
                  </td>

                  {/* Telefono */}
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    {r.lead_telefono ? (
                      <a href={`tel:${r.lead_telefono}`} style={{ color: C.mid, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        📞 {r.lead_telefono}
                      </a>
                    ) : '—'}
                  </td>

                  {/* Settore */}
                  <td style={{ padding: '11px 14px', color: C.mid, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.lead_settore || '—'}
                  </td>

                  {/* Ultima call */}
                  <td style={{ padding: '11px 14px', color: C.dim, fontSize: 12, whiteSpace: 'nowrap' }}>
                    ◷ {tempoRelativo(r.ultima_call)}
                  </td>

                  {/* Da richiamare */}
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, fontFamily: C.mono,
                      color: pronto ? C.green : C.amber,
                    }}>
                      {labelData}
                    </span>
                    {r.note_recall && (
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{r.note_recall}</div>
                    )}
                  </td>

                  {/* Azioni */}
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.lead_telefono && (
                        <a href={`tel:${r.lead_telefono}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 8,
                          background: C.green, color: '#0A0A00',
                          textDecoration: 'none', fontSize: 12, fontWeight: 700,
                          border: 'none', cursor: 'pointer',
                        }}>
                          📞 Chiama
                        </a>
                      )}
                      <button onClick={() => onElimina(r.id)} title="Rimuovi recall" style={{
                        background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                        color: C.dim, cursor: 'pointer', fontSize: 13, padding: '5px 8px',
                      }}>
                        🗑
                      </button>
                    </div>
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
