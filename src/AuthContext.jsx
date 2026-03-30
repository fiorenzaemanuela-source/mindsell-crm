import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
     if (firebaseUser) {
  setUser(firebaseUser)
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
 if (snap.exists()) setProfile(snap.data())
else setProfile({ ruolo: 'setter', nome: firebaseUser.email })
} else {
  console.log('Documento utente non trovato, uso setter di default')
  setProfile({ ruolo: 'setter', nome: firebaseUser.email })
}
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
