const BREVO_API_KEY = process.env.BREVO_API_KEY
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID

const LISTE = [
  { id: 11, funnel: 'Webinar Potere Parole 2026' },
  { id: 9,  funnel: 'Partecipanti Webinar'       },
  { id: 8,  funnel: 'Video Lezione'              },
  { id: 13, funnel: 'Offerta Limitata'           },
  { id: 3,  funnel: 'Webinar MindSell 2025'      },
]

async function firestoreQuery(projectId, query) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  return r.json()
}

async function firestoreAdd(projectId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`
  const fields = {}
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) } }
    } else if (typeof v === 'number') {
      fields[k] = { integerValue: v }
    } else {
      fields[k] = { stringValue: String(v || '') }
    }
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  return r.json()
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      brevo: !!BREVO_API_KEY,
      firebase: !!FIREBASE_PROJECT_ID,
    })
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { listaIndex = 0, offset = 0 } = req.body || {}
    const lista = LISTE[listaIndex]
    if (!lista) return res.status(200).json({ status: 'completato' })

    // Scarica contatti da Brevo
    const url = `https://api.brevo.com/v3/contacts/lists/${lista.id}/contacts?limit=10&offset=${offset}`
    const r = await fetch(url, { headers: { 'api-key': BREVO_API_KEY } })
    const data = await r.json()
    const contatti = data.contacts || []

    let creati = 0, aggiornati = 0

    for (const contatto of contatti) {
      const email = (contatto.email || '').toLowerCase().trim()
      if (!email) continue

      const nome     = (contatto.attributes?.FIRSTNAME || '').trim()
      const cognome  = (contatto.attributes?.LASTNAME  || '').trim()
      const telefono = (contatto.attributes?.SMS || contatto.attributes?.PHONE || '').trim()
      const citta    = (contatto.attributes?.CITY || '').trim()

      // Cerca se esiste già
      const queryRes = await firestoreQuery(FIREBASE_PROJECT_ID, {
        structuredQuery: {
          from: [{ collectionId: 'leads' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: email },
            }
          },
          limit: 1,
        }
      })

      const exists = queryRes[0]?.document
      if (exists) { aggiornati++; continue }

      await firestoreAdd(FIREBASE_PROJECT_ID, {
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
      })
      creati++
    }

    const haAltri = contatti.length === 10
    const prossima = haAltri
      ? { listaIndex, offset: offset + 10 }
      : { listaIndex: listaIndex + 1, offset: 0 }

    return res.status(200).json({
      status: haAltri || listaIndex + 1 < LISTE.length ? 'continua' : 'completato',
      lista: lista.funnel,
      creati,
      aggiornati,
      prossima,
    })

  } catch (e) {
    console.error('Errore:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
