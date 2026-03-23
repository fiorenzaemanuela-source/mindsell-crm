import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  })
}

const db = getFirestore()

// Campi fissi che vanno sempre al primo livello del documento
const CAMPI_FISSI = ['nome', 'cognome', 'email', 'telefono', 'funnel',
                     'fonte', 'stage', 'priorita', 'tags', 'presenzaEvento',
                     'citta', 'settore', 'ruolo', 'esperienzaVendita',
                     'haCorsiVendita', 'obiettivoLead', 'campagna']

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'mindsell-import-leads' })
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const payload = req.body

    // ── Campi fissi ──────────────────────────────────────────────────────────
    const nomeCompleto = (payload.nomeCompleto || '').trim()
    const parti = nomeCompleto.split(' ')
    const nome    = parti[0] || ''
    const cognome = parti.slice(1).join(' ') || ''
    const email   = (payload.email || '').toLowerCase().trim()
    const telefono = (payload.telefono || '').trim()
    const funnel   = (payload.funnel || 'Nuovo').trim()
    const fonte    = payload.fonte || 'Import Sheet'
    const presenzaEvento = (payload.presenzaEvento || '').trim()

    // Priorità da presenza evento
    let priorita = 'Bassa'
    const gg = parseInt(presenzaEvento) || 0
    if (gg >= 2) priorita = 'Alta'
    else if (gg === 1) priorita = 'Media'

    if (!email && !nomeCompleto) {
      return res.status(400).json({ error: 'Riga vuota' })
    }

    // ── Campi dinamici → datiQuestionario ────────────────────────────────────
    // Tutto quello che arriva nel payload ma NON è un campo fisso
    // viene salvato in datiQuestionario{} automaticamente
    const datiQuestionario = {}
    const campiDaIgnorare = ['nomeCompleto', 'email', 'telefono', 'funnel',
                              'fonte', 'presenzaEvento', 'tags', '_source']

    for (const [key, value] of Object.entries(payload)) {
      if (!campiDaIgnorare.includes(key) && value !== '' && value !== null) {
        datiQuestionario[key] = String(value).trim()
      }
    }

    // ── Deduplicazione per email ──────────────────────────────────────────────
    if (email) {
      const existing = await db.collection('leads')
        .where('email', '==', email).limit(1).get()

      if (!existing.empty) {
        // Aggiorna datiQuestionario se arrivano dati nuovi
        await db.collection('leads').doc(existing.docs[0].id).update({
          updatedAt: Date.now(),
          fonte,
          ...(Object.keys(datiQuestionario).length > 0 && { datiQuestionario })
        })
        return res.status(200).json({ status: 'updated', id: existing.docs[0].id })
      }
    }

    // ── Crea nuovo lead ───────────────────────────────────────────────────────
    const lead = {
      nome, cognome, email, telefono, funnel, fonte,
      stage: 'Nuovo lead',
      priorita,
      tags: payload.tags || ['import'],
      presenzaEvento,
      // Campi fissi opzionali (se presenti nel payload)
      citta:             payload.citta             || '',
      settore:           payload.settore           || '',
      ruolo:             payload.ruolo             || '',
      esperienzaVendita: payload.esperienzaVendita || '',
      haCorsiVendita:    payload.haCorsiVendita    || '',
      obiettivoLead:     payload.obiettivoLead     || '',
      campagna:          payload.campagna          || '',
      // Tutti i campi extra del questionario
      datiQuestionario,
      // Campi standard CRM
      note: '', materiali: [], offerte: [], esito: '',
      flowEmail: '', canale: 'Telefono', valoreStimato: '',
      motivoPerdita: '', metaLeadgenId: '',
      createdAt: Date.now(),
    }

    const docRef = await db.collection('leads').add(lead)
    console.log(`✅ ${nomeCompleto} (${email}) → ${docRef.id}`)
    return res.status(200).json({ status: 'created', id: docRef.id })

  } catch (e) {
    console.error('❌ Errore:', e)
    return res.status(500).json({ error: e.message })
  }
}
