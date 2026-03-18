import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'

const ESITI = [
  { id: 'consulenza',      label: 'Consulenza fissata' },
  { id: 'richiamare',      label: 'Da richiamare' },
  { id: 'non-risponde',    label: 'Non risponde' },
  { id: 'non-interessato', label: 'Non interessato' },
]

const FUNNEL_OPTIONS = [
  'Funnel Lead Freddi',
  'Funnel Lead Caldi',
  'Funnel Post-Consulenza',
  'Funnel Riattivazione',
  'Corso Online',
  'Consulenza 1:1',
  'Programma di Gruppo',
  'Evento/Webinar',
  'Partnership B2B',
]

export default function EmailCampagna() {
  const [leads, setLeads] = useState([])
  const [step, setStep] = useState(1) // 1=filtra, 2=componi, 3=anteprima, 4=risultato
  const [filters, setFilters] = useState({ funnel: [], esiti: [], tags: [], manual: [] })
  const [selected, setSelected] = useState([])
  const [email, setEmail] = useState({ subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState([])
  const [manualMode, setManualMode] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'leads'), orderBy('createdAt', 'desc')),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [])

  // Leads filtrati in base ai criteri scelti
  const filteredLeads = leads.filter(l => {
    if (!l.email) return false
    const byFunnel = filters.funnel.length === 0 || filters.funnel.includes(l.funnel)
    const byEsito = filters.esiti.length === 0 || filters.esiti.includes(l.esito)
    const byTag = filters.tags.length === 0 || (l.tags || []).some(t => filters.tags.includes(t))
    return byFunnel && byEsito && byTag
  })

  const allTags = [...new Set(leads.flatMap(l => l.tags || []))]

  const toggleFilter = (key, val) => {
    setFilters(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val]
    }))
  }

  const toggleLead = id => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const selectAll = () => setSelected(filteredLeads.map(l => l.id))
  const deselectAll = () => setSelected([])

  const selectedLeads = manualMode
    ? leads.filter(l => selected.includes(l.id) && l.email)
    : filteredLeads.filter(l => selected.includes(l.id))

  const goToStep2 = () => {
    if (!manualMode) setSelected(filteredLeads.map(l => l.id))
    setStep(2)
  }

  const sendEmails = async () => {
    setSending(true)
    const res = []
    for (const lead of selectedLeads) {
      const personalizedBody = email.body
        .replace(/\{\{nome\}\}/g, lead.nome || lead.ln || 'Cliente')
        .replace(/\{\{cognome\}\}/g, lead.cognome || '')
        .replace(/\{\{funnel\}\}/g, lead.funnel || '')

      try {
        const r = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: [{ email: lead.email, name: lead.nome || lead.ln || '' }],
            subject: email.subject,
            htmlContent: `<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#1A1916;max-width:600px">${personalizedBody.replace(/\n/g, '<br/>')}</div>`,
            senderName: 'Mindsell Academy',
          }),
        })
        const data = await r.json()
        res.push({ lead, ok: r.ok, error: data.error })
      } catch (e) {
        res.push({ lead, ok: false, error: e.message })
      }
    }
    setResults(res)
    setSending(false)
    setStep(4)
  }

  const reset = () => {
    setStep(1); setFilters({ funnel: [], esiti: [], tags: [], manual: [] })
    setSelected([]); setEmail({ subject: '', body: '' }); setResults([])
  }

  const ok = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Campagne Email</h1>
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 3 }}>Invia email a gruppi di lead via Brevo</p>
        </div>
        {step > 1 && <button className="btn-ghost" onClick={reset}>← Nuova campagna</button>}
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {[['1', 'Filtra lead'], ['2', 'Componi email'], ['3', 'Anteprima'], ['4', 'Risultati']].map(([n, label]) => (
          <div key={n} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: step === +n ? 600 : 400,
            color: step === +n ? 'var(--txt)' : step > +n ? 'var(--green)' : 'var(--txt3)',
            borderBottom: step === +n ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <span style={{ marginRight: 6, fontSize: 11, fontWeight: 600 }}>
              {step > +n ? '✓' : n}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* STEP 1 — Filtra */}
      {step === 1 && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setManualMode(false)} className={!manualMode ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13 }}>
              Filtra automaticamente
            </button>
            <button onClick={() => setManualMode(true)} className={manualMode ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13 }}>
              Selezione manuale
            </button>
          </div>

          {!manualMode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Funnel */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Funnel</div>
                {FUNNEL_OPTIONS.map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={filters.funnel.includes(f)} onChange={() => toggleFilter('funnel', f)} style={{ width: 'auto' }} />
                    {f}
                  </label>
                ))}
              </div>

              {/* Esito */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Esito chiamata</div>
                {ESITI.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={filters.esiti.includes(e.id)} onChange={() => toggleFilter('esiti', e.id)} style={{ width: 'auto' }} />
                    {e.label}
                  </label>
                ))}
              </div>

              {/* Tag */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Tag</div>
                {allTags.length === 0
                  ? <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Nessun tag disponibile</div>
                  : allTags.map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filters.tags.includes(t)} onChange={() => toggleFilter('tags', t)} style={{ width: 'auto' }} />
                      {t}
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Lista lead risultante */}
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {manualMode ? `${selected.length} lead selezionati` : `${filteredLeads.length} lead trovati`}
              </div>
              {!manualMode && filteredLeads.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm" onClick={selectAll}>Seleziona tutti</button>
                  <button className="btn-sm" onClick={deselectAll}>Deseleziona</button>
                </div>
              )}
            </div>

            {leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 14 }}>
                Nessun lead nel database ancora.<br />
                <span style={{ fontSize: 12 }}>I lead verranno aggiunti dalla scheda lead (prossimo modulo).</span>
              </div>
            ) : filteredLeads.length === 0 && !manualMode ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 14 }}>
                Nessun lead corrisponde ai filtri selezionati.
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {(manualMode ? leads : filteredLeads).filter(l => l.email).map(l => (
                  <label key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 14,
                  }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={() => toggleLead(l.id)}
                      style={{ width: 'auto', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{l.nome || l.ln || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{l.email} {l.funnel ? `· ${l.funnel}` : ''}</div>
                    </div>
                    {l.esito && <span className="badge badge-gray" style={{ fontSize: 11 }}>{ESITI.find(e => e.id === l.esito)?.label || l.esito}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={goToStep2}
              disabled={manualMode ? selected.length === 0 : filteredLeads.length === 0}
            >
              Continua → {manualMode ? selected.length : filteredLeads.length} destinatari
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Componi */}
      {step === 2 && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16, background: 'var(--accentbg)', padding: '8px 12px', borderRadius: 8 }}>
              Puoi usare <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{'{{nome}}'}</code>, <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{'{{cognome}}'}</code>, <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{'{{funnel}}'}</code> per personalizzare il testo.
            </div>
            <div className="form-group">
              <label className="form-label">Oggetto email *</label>
              <input
                placeholder="Es. Una risorsa esclusiva per te, {{nome}}"
                value={email.subject}
                onChange={e => setEmail(em => ({ ...em, subject: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Corpo email *</label>
              <textarea
                style={{ minHeight: 280, fontFamily: 'var(--font)', fontSize: 14 }}
                placeholder={`Ciao {{nome}},\n\nvolevo condividere con te...\n\nA presto,\nEmanuela`}
                value={email.body}
                onChange={e => setEmail(em => ({ ...em, body: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn-ghost" onClick={() => setStep(1)}>← Indietro</button>
            <button
              className="btn-primary"
              onClick={() => setStep(3)}
              disabled={!email.subject.trim() || !email.body.trim()}
            >
              Anteprima →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Anteprima */}
      {step === 3 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Anteprima email */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Anteprima</div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 4 }}>
                <strong>Da:</strong> Mindsell Academy &lt;info@mindsell.it&gt;
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 12 }}>
                <strong>Oggetto:</strong> {email.subject.replace(/\{\{nome\}\}/g, selectedLeads[0]?.nome || selectedLeads[0]?.ln || 'Cliente')}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--txt)' }}>
                {email.body
                  .replace(/\{\{nome\}\}/g, selectedLeads[0]?.nome || selectedLeads[0]?.ln || 'Cliente')
                  .replace(/\{\{cognome\}\}/g, selectedLeads[0]?.cognome || '')
                  .replace(/\{\{funnel\}\}/g, selectedLeads[0]?.funnel || '')}
              </div>
            </div>

            {/* Lista destinatari */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
                {selectedLeads.length} destinatari
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {selectedLeads.map(l => (
                  <div key={l.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ fontWeight: 500 }}>{l.nome || l.ln || '—'}</div>
                    <div style={{ color: 'var(--txt2)', fontSize: 12 }}>{l.email}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--amberbg)', border: '1px solid var(--amber)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--amber)' }}>
            ⚠️ Stai per inviare <strong>{selectedLeads.length} email</strong> reali da <strong>info@mindsell.it</strong>. Verifica il testo prima di confermare.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn-ghost" onClick={() => setStep(2)}>← Modifica</button>
            <button className="btn-primary" onClick={sendEmails} disabled={sending}>
              {sending ? `Invio in corso... (${results.length}/${selectedLeads.length})` : `Invia ${selectedLeads.length} email →`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — Risultati */}
      {step === 4 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--green)' }}>{ok}</div>
              <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>Email inviate con successo</div>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 600, color: fail > 0 ? 'var(--red)' : 'var(--txt3)' }}>{fail}</div>
              <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>Errori di invio</div>
            </div>
          </div>

          {fail > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 10 }}>Email non inviate:</div>
              {results.filter(r => !r.ok).map((r, i) => (
                <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--txt2)' }}>
                  {r.lead.nome || r.lead.ln} — {r.lead.email} <span style={{ color: 'var(--red)' }}>{r.error}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={reset}>Nuova campagna</button>
          </div>
        </div>
      )}
    </div>
  )
}
