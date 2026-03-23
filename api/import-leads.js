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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'mindsell-import-leads' })
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const payload = req.body
    const nomeCompleto = (payload.nomeCompleto || '').trim()
    const parti = nomeCompleto.split(' ')
    const nome    = parti[0] || ''
    const cognome = parti.slice(1).join(' ') || ''
    const email   = (payload.email || '').toLowerCase().trim()
    const telefono = (payload.telefono || '').trim()
    const funnel   = (payload.funnel || 'Nuovo').trim()
    const presenzaEvento = (payload.presenzaEvento || '').trim()

    // Stessa logica priorità di meta-webhook.js
    let priorita = 'Bassa'
    const gg = parseInt(presenzaEvento) || 0
    if (gg >= 2) priorita = 'Alta'
    else if (gg === 1) priorita = 'Media'

    if (!email && !nomeCompleto) {
      return res.status(400).json({ error: 'Riga vuota, saltata' })
    }

    // Deduplicazione per email (stessa logica meta-webhook.js)
    if (email) {
      const existing = await db.collection('leads')
        .where('email', '==', email).limit(1).get()

      if (!existing.empty) {
        await db.collection('leads').doc(existing.docs[0].id).update({
          updatedAt: Date.now(),
          fonte: 'Import Sheet',
        })
        return res.status(200).json({ status: 'updated', id: existing.docs[0].id })
      }
    }

    // Schema identico a meta-webhook.js
    const lead = {
      nome,
      cognome,
      email,
      telefono,
      funnel,
      fonte: 'Import Sheet',
      stage: 'Nuovo lead',
      priorita,
      tags: ['import-sheet'],
      settore: '',
      ruolo: '',
      esperienzaVendita: '',
      obiettivoLead: '',
      haCorsiVendita: '',
      citta: '',
      campagna: '',
      nomeForm: '',
      note: presenzaEvento ? `Presenza evento: ${presenzaEvento}gg` : '',
      materiali: [],
      offerte: [],
      esito: '',
      flowEmail: '',
      canale: 'Telefono',
      valoreStimato: '',
      motivoPerdita: '',
      metaLeadgenId: '',
      createdAt: Date.now(),
    }

    const docRef = await db.collection('leads').add(lead)
    console.log(`✅ Lead importato: ${nomeCompleto} (${email}) → ${docRef.id}`)
    return res.status(200).json({ status: 'created', id: docRef.id })

  } catch (e) {
    console.error('❌ Errore import-leads:', e)
    return res.status(500).json({ error: e.message })
  }
}
