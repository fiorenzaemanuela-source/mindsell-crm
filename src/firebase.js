import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBFETruNuacAboudE4w66GOBLGN4x8iog8",
  authDomain: "mindsell-crm.firebaseapp.com",
  projectId: "mindsell-crm",
  storageBucket: "mindsell-crm.firebasestorage.app",
  messagingSenderId: "955776000909",
  appId: "1:955776000909:web:8ef60c4faa38c8685ad3c4"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
