import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Blocco identico a meta-webhook.js che funziona
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
const BREVO_API_KEY = process.env.BREVO_API_KEY

const LISTE = [
  { id: 11, funnel: 'Webinar Potere Parole 2026' },
  { id: 9,  funnel: 'Webinar MindSell 2025'      },
  { id: 8,  funnel: 'Video Lezione'              },
  { id: 13, funnel: 'Offerta Limitata'           },
]

async function getContattiBravo(listaId) {
  const url = `https://api.brevo.com/v3/contacts/lists/${listaId}/contacts?limit=500&offset=0`
  const r = await fetch(url, {
    headers: { 'api-key': BREVO_API_KEY }
  })
  return r.json()
}

async function getDettaglioContatto(email) {
  const url = `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`
  const r = await fetch(url, {
    headers: { 'api-key': BREVO_API_KEY }
  })
  return r.json()
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'import-from-brevo' })
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    let totCreati = 0, totAggiornati = 0, totErrori = 0

    for (const lista of LISTE) {
      const data = await getContattiBravo(lista.id)
      const contatti = data.contacts || []

      for (const contatto of contatti) {
        try {
          const email = (contatto.email || '').toLowerCase().trim()
          if (!email) continue

          const dettaglio = await getDettaglioContatto(email)
          const attr = dettaglio.attributes || {}

          const nome     = (attr.FIRSTNAME || '').trim()
          const cognome  = (attr.LASTNAME  || '').trim()
          const telefono = (attr.SMS || attr.PHONE || '').trim()
          const citta    = (attr.CITY || '').trim()

          const existing = await db.collection('leads')
            .where('email', '==', email).limit(1).get()

          if (!existing.empty) {
            await db.collection('leads').doc(existing.docs[0].id).update({
              updatedAt: Date.now(),
              fonte: 'Brevo - ' + lista.funnel,
            })
            totAggiornati++
            continue
          }

          const lead = {
            nome, cognome, email, telefono, citta,
            funnel: lista.funnel,
            fonte: 'Brevo',
            stage: 'Nuovo lead',
            priorita: 'Media',
            tags: ['brevo', 'webinar'],
            settore: '', ruolo: '', esperienzaVendita: '',
            haCorsiVendita: '', obiettivoLead: '', campagna: '',
            note: '', materiali: [], offerte: [], esito: '',
            flowEmail: '', canale: 'Telefono', valoreStimato: '',
            motivoPerdita: '', metaLeadgenId: '',
            createdAt: Date.now(),
          }

          await db.collection('leads').add(lead)
          totCreati++
          await new Promise(r => setTimeout(r, 200))

        } catch (e) {
          console.error('Errore contatto:', e.message)
          totErrori++
        }
      }
    }

    return res.status(200).json({
      status: 'completato',
      creati: totCreati,
      aggiornati: totAggiornati,
      errori: totErrori
    })

  } catch (e) {
    console.error('Errore import Brevo:', e)
    return res.status(500).json({ error: e.message })
  }
}
