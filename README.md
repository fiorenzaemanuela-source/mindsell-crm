# Mindsell CRM

CRM custom per Mindsell Academy — React + Firebase Firestore + Vercel.

## Stack
- **React 18** + Vite
- **Firebase Firestore** — database realtime
- **React Router** — navigazione
- **Vercel** — hosting

## Struttura
```
src/
  firebase.js          # Config Firebase
  App.jsx              # Layout + routing
  index.css            # Design system
  pages/
    Dashboard.jsx      # Dashboard KPI (in costruzione)
    AgendaSetter.jsx   # Agenda setter completa
```

## Deploy su Vercel

### 1. Pubblica su GitHub
```bash
git init
git add .
git commit -m "init: mindsell crm"
git remote add origin https://github.com/TUO-USERNAME/mindsell-crm.git
git push -u origin main
```

### 2. Collega a Vercel
1. Vai su vercel.com → "Add New Project"
2. Importa il repo `mindsell-crm`
3. Framework: **Vite** (rilevato automaticamente)
4. Clicca **Deploy**

### 3. Regole Firestore
Dopo il deploy, aggiorna le regole Firestore su Firebase Console:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Da aggiornare con autenticazione
    }
  }
}
```

## Sviluppo locale
```bash
npm install
npm run dev
```
