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
    const unsub = onSnapshot(
      query(collection(db, 'leads'), orderBy('createdAt', 'desc')),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [])

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
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
    <div className="form-group" style={half
