import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { AuthProvider, useAuth } from './AuthContext'
import AgendaSetter from './pages/AgendaSetter.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EmailCampagna from './pages/EmailCampagna.jsx'
import Leads from './pages/Leads.jsx'
import Impostazioni from './pages/Impostazioni.jsx'
import Eventi from './pages/Eventi.jsx'
import Login from './pages/Login.jsx'

const NAV_ADMIN = [
  { to: '/',             icon: '◈', label: 'Dashboard'      },
  { to: '/leads',        icon: '◉', label: 'Lead'           },
  { to: '/agenda',       icon: '◷', label: 'Agenda Setter'  },
  { to: '/email',        icon: '✉', label: 'Campagne Email' },
  { to: '/eventi',       icon: '◑', label: 'Eventi'         },
  { to: '/impostazioni', icon: '⚙', label: 'Impostazioni'   },
]

const NAV_SETTER = [
  { to: '/leads',  icon: '◉', label: 'Lead'          },
  { to: '/agenda', icon: '◷', label: 'Agenda Setter' },
]

function ProtectedApp() {
  const { user, profile } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  const isAdmin = profile?.ruolo === 'admin'
  const nav = isAdmin ? NAV_ADMIN : NAV_SETTER

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <Sidebar nav={nav} profile={profile} isAdmin={isAdmin} />
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <Routes>
          {isAdmin && <Route path="/" element={<Dashboard />} />}
          <Route path="/leads" element={<Leads />} />
          <Route path="/agenda" element={<AgendaSetter />} />
          {isAdmin && <Route path="/email" element={<EmailCampagna />} />}
          {isAdmin && <Route path="/eventi" element={<Eventi />} />}
          {isAdmin && <Route path="/impostazioni" element={<Impostazioni />} />}
          <Route path="*" element={<Navigate to="/leads" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

function AppRouter() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/leads" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}

function Sidebar({ nav, profile, isAdmin }) {
  return (
    <aside style={{
      width: 220, background: '#1A1916',
      display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2E2C29' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: '#9E9B94', letterSpacing: '.08em', textTransform: 'uppercase' }}>Mindsell</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#F7F5F0', marginTop: 2 }}>CRM</div>
      </div>
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8, marginBottom: 2,
            textDecoration: 'none', fontSize: 14, fontWeight: 400,
            color: isActive ? '#F7F5F0' : '#6B6760',
            background: isActive ? '#2E2C29' : 'transparent',
            transition: 'all .15s',
          })}>
            <span style={{ fontSize: 16, opacity: .8 }}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #2E2C29' }}>
        <div style={{ fontSize: 12, color: '#9E9B94', marginBottom: 8 }}>
          {profile?.nome || profile?.email || ''}
          {isAdmin && <span style={{ marginLeft: 6, fontSize: 10, background: '#2E2C29', color: '#9E9B94', padding: '1px 6px', borderRadius: 4 }}>Admin</span>}
        </div>
        <button onClick={() => signOut(auth)} style={{
          background: 'none', border: 'none', color: '#6B6760', fontSize: 12,
          cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6
        }}>
          ⎋ Esci
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span className="live-dot" style={{ background: '#4ADE80' }}></span>
          <span style={{ fontSize: 11, color: '#6B6760', fontFamily: 'var(--mono)' }}>Firebase live</span>
        </div>
      </div>
    </aside>
  )
}
