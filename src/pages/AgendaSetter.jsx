import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, query
} from 'firebase/firestore'

const COLS = ['#2D2D8F','#1A6B47','#8B3A00','#1A6B6B','#6B1A6B','#8B001A']
const today = () => new Date().toISOString().split('T')[0]
const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const fmtDL = d => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const tlabel = t => ({ call: 'Chiamata', appt: 'Appuntamento', follow: 'Follow-up' }[t] || t)
const tcol = t => ({ call: '#2D2D8F', appt: '#1A6B47', follow: '#8B5A00' }[t] || '#888')

const ESITI = [
  { id: 'consulenza',      label: 'Consulenza fissata', badge: 'badge-green' },
  { id: 'richiamare',      label: 'Da richiamare',      badge: 'badge-amber' },
  { id: 'non-risponde',    label: 'Non risponde',        badge: 'badge-gray'  },
  { id: 'non-interessato', label: 'Non interessato',     badge: 'badge-red'   },
]

function wdays(off) {
  const d = new Date(); d.setDate(d.getDate() + off * 7)
  const dw = d.getDay() || 7; const mo = new Date(d); mo.setDate(d.getDate() - dw + 1)
  return Array.from({ length: 6 }, (_, i) => { const x = new Date(mo); x.setDate(mo.getDate() + i); return x.toISOString().split('T')[0] })
}

export default function AgendaSetter() {
  const [tasks, setTasks] = useState([])
  const [setters, setSetters] = useState([])
  const [tab, setTab] = useState('oggi')
  const [asr, setAsr] = useState('tutti')
  const [woff, setWoff] = useState(0)
  const [panel, setPanel] = useState(null) // null | 'new' | {id}
  const [form, setForm] = useState({})
  const [esito, setEsito] = useState(null)
  const [eNota, setENota] = useState('')
  const settersReady = useRef(false)

  // Firebase listeners
  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const unsub2 = onSnapshot(collection(db, 'setters'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (!settersReady.current) {
        settersReady.current = true
        if (docs.length === 0) {
          addDoc(collection(db, 'setters'), { name: 'Setter 1', color: COLS[0] })
          addDoc(collection(db, 'setters'), { name: 'Setter 2', color: COLS[1] })
          return
        }
      }
      setSetters(docs)
    })
    return () => { unsub1(); unsub2() }
  }, [])

  // Notifications
  useEffect(() => {
    if (Notification.permission !== 'granted') return
    const iv = setInterval(() => {
      const now = new Date()
      tasks.forEach(t => {
        if (t.st === 'done' || t.notified || !t.dt || !t.tm) return
        const diff = (new Date(t.dt + 'T' + t.tm) - now) / 60000
        if (diff >= 0 && diff <= 10) {
          new Notification('Agenda Setter', { body: `Tra ${Math.round(diff)}min: ${t.ln} – ${tlabel(t.tp)}` })
          updateDoc(doc(db, 'tasks', t.id), { notified: true })
        }
      })
    }, 60000)
    return () => clearInterval(iv)
  }, [tasks])

  const filtered = tasks.filter(t => asr === 'tutti' || t.sid === asr)
  const sof = id => setters.find(s => s.id === id) || { name: '?', color: '#888' }

  const openNew = () => {
    setForm({ ln: '', sid: setters[0]?.id || '', dt: today(), tm: '', tp: 'call', nt: '' })
    setPanel('new')
  }

  const openEsito = task => {
    setPanel({ id: task.id, ln: task.ln })
    setEsito(task.out || null)
    setENota(task.ont || '')
  }

  const closePanel = () => { setPanel(null); setEsito(null); setENota('') }

  const saveTask = async () => {
    if (!form.ln?.trim() || !form.dt) return alert('Inserisci nome lead e data.')
    await addDoc(collection(db, 'tasks'), {
      ln: form.ln.trim(), sid: form.sid, dt: form.dt, tm: form.tm,
      tp: form.tp, nt: form.nt, st: 'pending', out: null, ont: '', notified: false,
      createdAt: Date.now()
    })
    closePanel()
  }

  const saveEsito = async () => {
    if (!esito) return alert('Seleziona un esito.')
    await updateDoc(doc(db, 'tasks', panel.id), { out: esito, ont: eNota, st: 'done' })
    closePanel()
  }

  const delTask = async id => {
    if (!confirm('Eliminare questo task?')) return
    await deleteDoc(doc(db, 'tasks', id))
  }

  const addSetter = async () => {
    const n = prompt('Nome del nuovo setter:')
    if (!n?.trim()) return
    await addDoc(collection(db, 'setters'), { name: n.trim(), color: COLS[setters.length % COLS.length] })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>Agenda Setter</h1>
            <span className="live-dot"></span>
          </div>
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>Gestione task, chiamate e appuntamenti</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Nuovo task</button>
      </div>

      {/* Setter filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ id: 'tutti', name: 'Tutti', color: '#1A1916' }, ...setters].map(s => (
          <button key={s.id} onClick={() => setAsr(s.id)} style={{
            padding: '5px 14px', borderRadius: 999, fontSize: 13,
            border: asr === s.id ? `2px solid ${s.color}` : '1px solid var(--border)',
            background: asr === s.id ? s.id === 'tutti' ? '#1A1916' : s.color : 'transparent',
            color: asr === s.id ? '#fff' : 'var(--txt2)',
            fontWeight: asr === s.id ? 500 : 400,
            transition: 'all .15s',
          }}>{s.name}</button>
        ))}
        <button onClick={addSetter} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 13, border: '1px dashed var(--border2)', background: 'none', color: 'var(--txt3)' }}>+ Setter</button>
      </div>

      {/* Panel */}
      {panel === 'new' && (
        <div className="card fade-in" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Nuovo task</div>
          <div className="form-group">
            <label className="form-label">Nome lead *</label>
            <input placeholder="Es. Marco Rossi" value={form.ln || ''} onChange={e => setForm(f => ({ ...f, ln: e.target.value }))} />
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data *</label>
              <input type="date" value={form.dt || ''} onChange={e => setForm(f => ({ ...f, dt: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Ora</label>
              <input type="time" value={form.tm || ''} onChange={e => setForm(f => ({ ...f, tm: e.target.value }))} />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tipo</label>
              <select value={form.tp || 'call'} onChange={e => setForm(f => ({ ...f, tp: e.target.value }))}>
                <option value="call">Chiamata</option>
                <option value="appt">Appuntamento</option>
                <option value="follow">Follow-up</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Setter</label>
              <select value={form.sid || ''} onChange={e => setForm(f => ({ ...f, sid: e.target.value }))}>
                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note pre-chiamata</label>
            <textarea placeholder="Es. Ha ricevuto offerta A, interessato al corso B2B..." value={form.nt || ''} onChange={e => setForm(f => ({ ...f, nt: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn-ghost" onClick={closePanel}>Annulla</button>
            <button className="btn-primary" onClick={saveTask}>Salva task</button>
          </div>
        </div>
      )}

      {panel && panel.id && (
        <div className="card fade-in" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Esito chiamata — <span style={{ color: 'var(--accent)' }}>{panel.ln}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {ESITI.map(e => (
              <button key={e.id} onClick={() => setEsito(e.id)} style={{
                padding: '12px 14px', borderRadius: 10, textAlign: 'left', fontSize: 13, fontWeight: 500,
                border: esito === e.id ? '2px solid currentColor' : '1px solid var(--border)',
                background: esito === e.id ? 'currentColor' : 'var(--surface)',
                cursor: 'pointer', transition: 'all .15s',
              }} className={esito === e.id ? e.badge : ''}>
                {esito !== e.id && <span className={`badge ${e.badge}`} style={{ pointerEvents: 'none' }}>{e.label}</span>}
                {esito === e.id && <span style={{ color: '#fff' }}>{e.label}</span>}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Nota rapida</label>
            <textarea placeholder="Es. Molto interessata, richiama giovedì mattina..." value={eNota} onChange={e => setENota(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={closePanel}>Annulla</button>
            <button className="btn-primary" onClick={saveEsito}>Salva esito</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[['oggi', 'Oggi'], ['sett', 'Settimana'], ['tutti', 'Tutti']].map(([id, label]) => {
          const cnt = id === 'oggi' ? filtered.filter(t => t.dt === today()).length : null
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 18px', border: 'none', background: 'none', fontSize: 14,
              color: tab === id ? 'var(--txt)' : 'var(--txt3)',
              fontWeight: tab === id ? 600 : 400,
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', transition: 'all .15s',
            }}>
              {label}
              {cnt !== null && <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--accentbg)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>{cnt}</span>}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'oggi' && <TodayView tasks={filtered} sof={sof} onEsito={openEsito} onDel={delTask} />}
      {tab === 'sett' && <WeekView tasks={filtered} sof={sof} woff={woff} setWoff={setWoff} onEsito={openEsito} />}
      {tab === 'tutti' && <AllView tasks={filtered} sof={sof} onEsito={openEsito} onDel={delTask} />}

      {/* Footer stats */}
      <div style={{ marginTop: 24, padding: '10px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 24, fontSize: 12, color: 'var(--txt3)' }}>
        <span>{tasks.length} task totali</span>
        <span>{tasks.filter(t => t.out === 'consulenza').length} consulenze fissate</span>
        <span>{tasks.filter(t => t.st !== 'done').length} in attesa</span>
      </div>
    </div>
  )
}

function TaskCard({ task, sof, onEsito, onDel, showDate }) {
  const s = sof(task.sid)
  const esito = ESITI.find(e => e.id === task.out)
  return (
    <div className="card fade-in" style={{
      padding: '13px 16px', marginBottom: 8, display: 'flex',
      gap: 12, alignItems: 'flex-start',
      opacity: task.st === 'done' ? .55 : 1,
    }}>
      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: tcol(task.tp), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{task.ln}</div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
          {task.tm && <span>{task.tm}</span>}
          <span>{tlabel(task.tp)}</span>
          <span style={{ color: s.color, fontWeight: 500 }}>{s.name}</span>
          {showDate && task.dt && <span>{fmtDL(task.dt)}</span>}
        </div>
        {task.nt && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 5, fontStyle: 'italic' }}>{task.nt}</div>}
        {task.ont && <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4 }}>📝 {task.ont}</div>}
        {esito && <span className={`badge ${esito.badge}`} style={{ marginTop: 6 }}>{esito.label}</span>}
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {task.st !== 'done' && <button className="btn-sm accent" onClick={() => onEsito(task)}>Esito</button>}
        {onDel && <button className="btn-sm" onClick={() => onDel(task.id)}>✕</button>}
      </div>
    </div>
  )
}

function TodayView({ tasks, sof, onEsito, onDel }) {
  const td = today()
  const list = tasks.filter(t => t.dt === td).sort((a, b) => (a.tm || '').localeCompare(b.tm || ''))
  if (!list.length) return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--txt3)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>◷</div>
      <div style={{ fontSize: 14 }}>Nessun task per oggi.</div>
    </div>
  )
  return <>{list.map(t => <TaskCard key={t.id} task={t} sof={sof} onEsito={onEsito} onDel={onDel} />)}</>
}

function WeekView({ tasks, sof, woff, setWoff, onEsito }) {
  const days = wdays(woff)
  const td = today()
  const DN = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn-sm" onClick={() => setWoff(w => w - 1)}>← Prec</button>
        <span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 500 }}>{fmtD(days[0])} – {fmtD(days[5])}</span>
        <button className="btn-sm" onClick={() => setWoff(w => w + 1)}>Succ →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {days.map((d, i) => {
          const dt = tasks.filter(t => t.dt === d).sort((a, b) => (a.tm || '').localeCompare(b.tm || ''))
          const isT = d === td
          return (
            <div key={d} style={{
              background: isT ? 'var(--accentbg)' : 'var(--bg)',
              border: isT ? '1px solid var(--accent2)' : '1px solid var(--border)',
              borderRadius: 10, padding: '10px 8px', minHeight: 90,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: isT ? 'var(--accent)' : 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>
                {DN[i]} {new Date(d + 'T00:00:00').getDate()}
              </div>
              {dt.map(t => {
                const s = sof(t.sid)
                return (
                  <div key={t.id} onClick={() => onEsito(t)} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${tcol(t.tp)}`,
                    borderRadius: 6, padding: '4px 6px', marginBottom: 4,
                    fontSize: 11, cursor: 'pointer',
                    opacity: t.st === 'done' ? .5 : 1,
                  }}>
                    <div style={{ color: 'var(--txt2)', fontSize: 10 }}>{t.tm || '–'}</div>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.ln}</div>
                    <div style={{ color: s.color, fontSize: 10 }}>{s.name}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AllView({ tasks, sof, onEsito, onDel }) {
  const td = today()
  const tday = tasks.filter(t => t.dt === td).sort((a, b) => (a.tm || '').localeCompare(b.tm || ''))
  const next = tasks.filter(t => t.dt > td).sort((a, b) => a.dt.localeCompare(b.dt))
  const past = tasks.filter(t => t.dt < td).sort((a, b) => b.dt.localeCompare(a.dt))
  const SL = ({ label }) => <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>{label}</div>
  if (!tasks.length) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--txt3)', fontSize: 14 }}>Nessun task ancora.</div>
  return (
    <div>
      {tday.length > 0 && <><SL label="Oggi" />{tday.map(t => <TaskCard key={t.id} task={t} sof={sof} onEsito={onEsito} onDel={onDel} />)}</>}
      {next.length > 0 && <><SL label="Prossimi" />{next.map(t => <TaskCard key={t.id} task={t} sof={sof} onEsito={onEsito} onDel={onDel} showDate />)}</>}
      {past.length > 0 && <><SL label="Passati" />{past.map(t => <TaskCard key={t.id} task={t} sof={sof} onEsito={onEsito} onDel={onDel} showDate />)}</>}
    </div>
  )
}
