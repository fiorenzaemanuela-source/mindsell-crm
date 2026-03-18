import { Routes, Route, NavLink } from 'react-router-dom'
import AgendaSetter from './pages/AgendaSetter.jsx'
import Dashboard from './pages/Dashboard.jsx'

const NAV = [
  { to: '/',       icon: '◈', label: 'Dashboard' },
  { to: '/agenda', icon: '◷', label: 'Agenda Setter' },
]

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <Routes>
          <Route path="/"       element={<Dashboard />} />
          <Route path="/agenda" element={<AgendaSetter />} />
        </Routes>
      </main>
    </div>
  )
}

function Sidebar() {
  return (
    <aside style={{
      width: 220,
      background: '#1A1916',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2E2C29' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: '#9E9B94', letterSpacing: '.08em', textTransform: 'uppercase' }}>Mindsell</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#F7F5F0', marginTop: 2 }}>CRM</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            marginBottom: 2,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 400,
            color: isActive ? '#F7F5F0' : '#6B6760',
            background: isActive ? '#2E2C29' : 'transparent',
            transition: 'all .15s',
          })}>
            <span style={{ fontSize: 16, opacity: .8 }}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #2E2C29' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" style={{ background: '#4ADE80' }}></span>
          <span style={{ fontSize: 11, color: '#6B6760', fontFamily: 'var(--mono)' }}>Firebase live</span>
        </div>
      </div>
    </aside>
  )
}
