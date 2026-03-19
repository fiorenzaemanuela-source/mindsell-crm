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
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge)
    }
    return res.status(403).send('Forbidden')
  }

  if (req.method === 'POST') {
    const body = req.body
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            await fetchAndSaveLead(change.value)
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED')
  }

  return res.status(405).send('Method Not Allowed')
}

async function fetchAndSaveLead(webhookData) {
  try {
    const { leadgen_id, form_id, ad_id, adgroup_id, campaign_id } = webhookData

    // Recupera dati lead da Meta
    const url = `https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data,ad_id,adgroup_id,campaign_id,form_id,created_time&access_token=${PAGE_ACCESS_TOKEN}`
    const r = await fetch(url)
    const data = await r.json()
    if (!data.field_data) return

    // Mappa i campi del form
    const fields = {}
    data.field_data.forEach(f => { fields[f.name] = f.values?.[0] || '' })

    // Recupera nome campagna da Meta
    let campagna = ''
    let funnel = 'Meta Ads'
    if (data.campaign_id) {
      try {
        const cr = await fetch(`https://graph.facebook.com/v19.0/${data.campaign_id}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`)
        const cd = await cr.json()
        campagna = cd.name || ''
        funnel = campagna || 'Meta Ads'
      } catch (e) {}
    }

    // Recupera nome form
    let nomeForm = ''
    if (data.form_id) {
      try {
        const fr = await fetch(`https://graph.facebook.com/v19.0/${data.form_id}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`)
        const fd = await fr.json()
        nomeForm = fd.name || ''
      } catch (e) {}
    }

    const nomeCompleto = (fields['full_name'] || fields['nome'] || '').trim()
    const parti = nomeCompleto.split(' ')

    // Calcola priorità da presenza evento
    const presenza = parseInt(fields['presenza'] || fields['giorni_presenza'] || '0') || 0
    const priorita = presenza >= 2 ? 'Alta' : 'Media'

    const tags = ['meta-ads']
    if (campagna) tags.push(campagna)
    if (nomeForm) tags.push(nomeForm)

    const lead = {
      nome: parti[0] || '',
      cognome: parti.slice(1).join(' ') || '',
      email: fields['email'] || '',
      telefono: fields['phone_number'] || fields['telefono'] || '',
      funnel,
      fonte: 'Meta Ads',
      stage: 'Nuovo lead',
      priorita,
      tags,
      settore: fields['settore'] || fields['in_quale_settore_operi'] || '',
      ruolo: fields['ruolo'] || fields['quale_ruolo_ricopri'] || '',
      esperienzaVendita: fields['da_quanto_tempo'] || '',
      obiettivoLead: fields['priorita_obiettivo'] || fields['qual_e_la_tua_priorita'] || '',
      haCorsiVendita: fields['hai_gia_seguito_corsi'] || '',
      citta: fields['city'] || fields['citta'] || '',
      campagna,
      nomeForm,
      note: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n'),
      materiali: [], offerte: [], esito: '', flowEmail: '',
      canale: 'Telefono', valoreStimato: '', motivoPerdita: '',
      metaLeadgenId: leadgen_id,
      createdAt: Date.now()
    }

    // Deduplicazione per email
    if (lead.email) {
      const existing = await db.collection('leads')
        .where('email', '==', lead.email).limit(1).get()
      if (!existing.empty) {
        const existingData = existing.docs[0].data()
        const updatedTags = [...new Set([...(existingData.tags || []), ...tags])]
        await db.collection('leads').doc(existing.docs[0].id).update({
          tags: updatedTags,
          campagna,
          updatedAt: Date.now()
        })
        return
      }
    }

    await db.collection('leads').add(lead)
  } catch (e) {
    console.error('Errore fetch lead Meta:', e)
  }
}
