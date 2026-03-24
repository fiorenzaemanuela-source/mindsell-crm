import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function initFirebase() {
  if (getApps().length) return getApp()
  const sa = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
  )
  return initializeApp({ credential: cert(sa) })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'import-leads' })
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const app = initFirebase()
    const db = getFirestore(app)
    const payload = req.body
    const leads = Array.isArray(payload) ? payload : [payload]

    let creati = 0, aggiornati = 0, errori = 0

    for (const item of leads) {
      try {
        const nomeCompleto = (item.nomeCompleto || '').trim()
        const parti = nomeCompleto.split(' ')
        const nome = parti[0] || ''
        const cognome = parti.slice(1).join(' ') || ''
        const email = (item.email || '').toLowerCase().trim()
        const telefono = (item.telefono || '').trim()
        const funnel = (item.funnel || 'Webinar').trim()
        const fonte = item.fonte || 'Import Sheet'
        const presenzaEvento = (item.presenzaEvento || '').trim()

        let priorita = 'Bassa'
        const gg = parseInt(presenzaEvento) || 0
        if (gg >= 2) priorita = 'Alta'
        else if (gg === 1) priorita = 'Media'

        if (!email && !nomeCompleto) continue

        if (email) {
          const existing = await db.collection('leads')
            .where('email', '==', email).limit(1).get()
         if (!existing.empty) {
            await db.collection('leads').doc(existing.docs[0].id).update({
              updatedAt: Date.now(),
              fonte,
              ...(item.settore            && { settore: item.settore }),
              ...(item.ruolo              && { ruolo: item.ruolo }),
              ...(item.esperienzaVendita  && { esperienzaVendita: item.esperienzaVendita }),
              ...(item.haCorsiVendita     && { haCorsiVendita: item.haCorsiVendita }),
              ...(item.obiettivoLead      && { obiettivoLead: item.obiettivoLead }),
              ...(item.citta              && { citta: item.citta }),
            })
            aggiornati++
            continue
          }

        await db.collection('leads').add({
          nome, cognome, email, telefono, funnel, fonte,
          stage: 'Nuovo lead', priorita, tags: ['import'],
          presenzaEvento, citta: '', settore: '', ruolo: '',
          esperienzaVendita: '', haCorsiVendita: '', obiettivoLead: '',
          campagna: '', note: presenzaEvento ? 'Presenza evento: ' + presenzaEvento + 'gg' : '',
          materiali: [], offerte: [], esito: '', flowEmail: '',
          canale: 'Telefono', valoreStimato: '', motivoPerdita: '',
          metaLeadgenId: '', createdAt: Date.now(),
        })
        creati++
      } catch(e) {
        errori++
      }
    }

    return res.status(200).json({ status: 'ok', creati, aggiornati, errori })

  } catch (e) {
    console.error('Errore:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
