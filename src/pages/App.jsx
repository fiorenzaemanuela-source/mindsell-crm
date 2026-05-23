import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { AuthProvider, useAuth } from './AuthContext'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import logo from './logo.png'

// ── Pagine esistenti (già funzionanti) ────────────────────────
import AgendaSetter  from './pages/AgendaSetter.jsx'
import Dashboard     from './pages/Dashboard.jsx'
import EmailCampagna from './pages/EmailCampagna.jsx'
import Leads         from './pages/Leads.jsx'
import Impostazioni  from './pages/Impostazioni.jsx'
import Eventi        from './pages/Eventi.jsx'
import Login         from './pages/Login.jsx'

// ── Pagine da sviluppare (Sprint 1-4) — decommentare man mano ─
// import CodaChiamate    from './pages/CodaChiamate.jsx'
// import Recall          from './pages/Recall.jsx'
// import StoricoChiamate from './pages/StoricoChiamate.jsx'
// import Agenda          from './pages/Agenda.jsx'
// import FollowUp        from './pages/FollowUp.jsx'
// import MieiClienti     from './pages/MieiClienti.jsx'
// import LeadMagnet      from './pages/LeadMagnet.jsx'
// import Rate            from './pages/Rate.jsx'
// import Strumenti       from './pages/Strumenti.jsx'
// import Classifica      from './pages/Classifica.jsx'
// import KpiVendita      from './pages/KpiVendita.jsx'

// ── Colori tema ────────────────────────────────────────────────
const C = {
  bg:         '#080A0D',
  sidebar:    '#0A0E14',
  sideHover:  '#0F1520',
  sideActive: '#131E2C',
  border:     '#1E2A38',
  green:      '#6DBF2A',
  greenDim:   '#1E3A08',
  blue:       '#5A9FE0',
  text:       '#F0F4F8',
  textMid:    '#B8C8D8',
  textDim:    '#7A92A8',
  mono:       "'Montserrat', sans-serif",
}

// ── Struttura sidebar a sezioni ───────────────────────────────
// Le pagine esistenti sono marcate con existing: true
// Le pagine in sviluppo hanno sprint: N per il placeholder
const NAV_SECTIONS_ADMIN = [
  {
    label: 'SETTER',
    items: [
      { to: '/coda-chiamate',    icon: '☎', label: 'Coda Chiamate',    badge: 'callQueue',   sprint: 1 },
      { to: '/recall',           icon: '↺', label: 'Recall',           badge: 'recallToday', sprint: 1 },
      { to: '/storico-chiamate', icon: '◷', label: 'Storico Chiamate',                       sprint: 1 },
    ],
  },
  {
    label: 'CLOSING',
    items: [
      { to: '/agenda-closer', icon: '▦', label: 'Agenda',    badge: 'agendaToday', sprint: 2 },
      { to: '/follow-up',     icon: '⟳', label: 'Follow-up', badge: 'followupDue', sprint: 3 },
    ],
  },
  {
    label: 'AMMINISTRAZIONE',
    items: [
      { to: '/',             icon: '◈', label: 'Dashboard',      existing: true },
      { to: '/leads',        icon: '◉', label: 'Lead',           existing: true },
      { to: '/agenda',       icon: '◑', label: 'Agenda Setter',  existing: true },
      { to: '/eventi',       icon: '◆', label: 'Eventi',         existing: true },
      { to: '/email',        icon: '✉', label: 'Campagne Email', existing: true },
      { to: '/miei-clienti', icon: '⬡', label: 'I miei clienti',               sprint: 3 },
      { to: '/lead-magnet',  icon: '⚡', label: 'Lead Magnet',                  sprint: 4 },
      { to: '/rate',         icon: '◰', label: 'Rate',                          sprint: 4 },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/strumenti',    icon: '⚙', label: 'Strumenti',   sprint: 2 },
      { to: '/classifica',   icon: '⬖', label: 'Classifica',  sprint: 4 },
      { to: '/kpi',          icon: '↗', label: 'KPI Vendita', sprint: 2 },
      { to: '/impostazioni', icon: '◧', label: 'Impostazioni', existing: true },
    ],
  },
]

// Sidebar semplificata per ruoli non-admin
const NAV_SECTIONS_SETTER = [
  {
    label: 'SETTER',
    items: [
      { to: '/coda-chiamate',    icon: '☎', label: 'Coda Chiamate',    badge: 'callQueue',   sprint: 1 },
      { to: '/recall',           icon: '↺', label: 'Recall',           badge: 'recallToday', sprint: 1 },
      { to: '/storico-chiamate', icon: '◷', label: 'Storico Chiamate',                       sprint: 1 },
    ],
  },
  {
    label: 'LEAD',
    items: [
      { to: '/leads',  icon: '◉', label: 'Lead',          existing: true },
      { to: '/agenda', icon: '◑', label: 'Agenda Setter', existing: true },
    ],
  },
]

// ── Placeholder pagine in sviluppo ────────────────────────────
function ComingSoon({ title, sprint }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60vh', gap: 16,
    }}>
      <div style={{ fontSize: 36, opacity: .15 }}>◈</div>
      <div style={{ fontSize: 15, color: '#B8C8D8', fontFamily: C.mono }}>{title}</div>
      <div style={{
        fontSize: 11, color: '#7A92A8', fontFamily: C.mono,
        background: C.sideActive, padding: '4px 12px', borderRadius: 20,
        border: `1px solid ${C.border}`,
      }}>
        Sprint {sprint} — in sviluppo
      </div>
    </div>
  )
}

// ── Hook badge contatori da Firestore ─────────────────────────
// Ottimizzato per 300+ lead — usa query specifiche, non legge tutta la collection
function useBadges() {
  const [badges, setBadges] = useState({
    callQueue:   0,
    recallToday: 0,
    agendaToday: 0,
    followupDue: 0,
  })

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const unsubs = []

    // Coda chiamate: lead con stato = 'nuovo' o 'da_chiamare'
    try {
      const qCoda = query(
        collection(db, 'leads'),
        where('stato', 'in', ['nuovo', 'da_chiamare'])
      )
      unsubs.push(onSnapshot(qCoda, snap =>
        setBadges(b => ({ ...b, callQueue: snap.size }))
      ))
    } catch (e) { console.warn('Badge callQueue:', e.message) }

    // Recall oggi
    try {
      const qRecall = query(
        collection(db, 'recall'),
        where('data_richiamata', '>=', today),
        where('data_richiamata', '<', tomorrow)
      )
      unsubs.push(onSnapshot(qRecall, snap =>
        setBadges(b => ({ ...b, recallToday: snap.size }))
      ))
    } catch (e) { console.warn('Badge recallToday:', e.message) }

    // Agenda oggi — appuntamenti senza esito
    try {
      const qAgenda = query(
        collection(db, 'agenda'),
        where('data_call', '>=', today),
        where('data_call', '<', tomorrow),
        where('esito', '==', null)
      )
      unsubs.push(onSnapshot(qAgenda, snap =>
        setBadges(b => ({ ...b, agendaToday: snap.size }))
      ))
    } catch (e) { console.warn('Badge agendaToday:', e.message) }

    // Follow-up scaduti o in scadenza oggi
    try {
      const qFollowup = query(
        collection(db, 'followup'),
        where('stato', '==', 'da_fare'),
        where('data_followup', '<=', tomorrow)
      )
      unsubs.push(onSnapshot(qFollowup, snap =>
        setBadges(b => ({ ...b, followupDue: snap.size }))
      ))
    } catch (e) { console.warn('Badge followupDue:', e.message) }

    return () => unsubs.forEach(u => u())
  }, [])

  return badges
}

// ── App principale ─────────────────────────────────────────────
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
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}

// ── App protetta (richiede login) ──────────────────────────────
function ProtectedApp() {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const isAdmin  = profile?.ruolo === 'admin'
  const isSetter = profile?.ruolo === 'setter'
  const navSections = isAdmin ? NAV_SECTIONS_ADMIN : NAV_SECTIONS_SETTER

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh', background: C.bg }}>
      <Sidebar sections={navSections} profile={profile} isAdmin={isAdmin} />
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', minHeight: '100vh' }}>
        <Routes>

          {/* ── Pagine ESISTENTI — già funzionanti ── */}
          <Route path="/"             element={<Dashboard />}     />
          <Route path="/leads"        element={<Leads />}         />
          <Route path="/agenda"       element={<AgendaSetter />}  />
          <Route path="/email"        element={<EmailCampagna />} />
          <Route path="/eventi"       element={<Eventi />}        />
          <Route path="/impostazioni" element={<Impostazioni />}  />

          {/* ── Sprint 1 — Setter ── */}
          <Route path="/coda-chiamate"    element={<ComingSoon title="Coda Chiamate"    sprint={1} />} />
          <Route path="/recall"           element={<ComingSoon title="Recall"           sprint={1} />} />
          <Route path="/storico-chiamate" element={<ComingSoon title="Storico Chiamate" sprint={1} />} />

          {/* ── Sprint 2 — Closing + Tools ── */}
          <Route path="/agenda-closer" element={<ComingSoon title="Agenda Closer" sprint={2} />} />
          <Route path="/kpi"           element={<ComingSoon title="KPI Vendita"   sprint={2} />} />
          <Route path="/strumenti"     element={<ComingSoon title="Strumenti"     sprint={2} />} />

          {/* ── Sprint 3 ── */}
          <Route path="/follow-up"     element={<ComingSoon title="Follow-up"       sprint={3} />} />
          <Route path="/miei-clienti"  element={<ComingSoon title="I miei clienti"  sprint={3} />} />

          {/* ── Sprint 4 ── */}
          <Route path="/lead-magnet"   element={<ComingSoon title="Lead Magnet"  sprint={4} />} />
          <Route path="/rate"          element={<ComingSoon title="Rate"         sprint={4} />} />
          <Route path="/classifica"    element={<ComingSoon title="Classifica"   sprint={4} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────
function Sidebar({ sections, profile, isAdmin }) {
  const badges   = useBadges()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    try { await signOut(auth) } catch (e) { console.error(e) }
  }

  return (
    <aside style={{
      width:         collapsed ? 60 : 224,
      background:    C.sidebar,
      display:       'flex',
      flexDirection: 'column',
      flexShrink:    0,
      borderRight:   `1px solid ${C.border}`,
      transition:    'width .2s ease',
      overflow:      'hidden',
    }}>

      {/* Logo + collapse */}
      <div style={{
        padding:        '20px 16px 18px',
        borderBottom:   `1px solid ${C.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logo}
              alt="MindSell"
              style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <span style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: '#6DBF2A', letterSpacing: '-.02em' }}>Mind</span>
                <span style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: '#5A9FE0', letterSpacing: '-.02em' }}>Sell</span>
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: '#6A8AA8', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 1 }}>CRM</div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#7A92A8', fontSize: 14, padding: 4,
            marginLeft: collapsed ? 'auto' : 0, lineHeight: 1,
          }}
          title={collapsed ? 'Espandi' : 'Comprimi'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Sezioni navigazione */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {sections.map(section => (
          <div key={section.label} style={{ marginBottom: 4 }}>

            {/* Label sezione */}
            {!collapsed && (
              <div style={{
                padding:       '10px 18px 4px',
                fontSize:      10,
                fontFamily:    C.mono,
                color:         C.textDim,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
              }}>
                {section.label}
              </div>
            )}

            {/* Voci */}
            {section.items.map(item => {
              const count    = item.badge ? (badges[item.badge] || 0) : 0
              const isActive = location.pathname === item.to ||
                               (item.to === '/' && location.pathname === '/')
              const isDimmed = !item.existing && item.sprint  // pagine in sviluppo

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  style={({ isActive: navActive }) => ({
                    display:        'flex',
                    alignItems:     'center',
                    gap:            10,
                    padding:        collapsed ? '9px 0' : '8px 14px',
                    margin:         '1px 8px',
                    borderRadius:   6,
                    textDecoration: 'none',
                    fontSize:       13.5,
                    fontWeight:     navActive ? 500 : 400,
                    color:          navActive ? C.text : isDimmed ? C.textDim : C.textMid,
                    background:     navActive ? C.sideActive : 'transparent',
                    transition:     'all .12s',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    position:       'relative',
                    opacity:        isDimmed ? 0.6 : 1,
                  })}
                >
                  {/* Indicatore attivo */}
                  {isActive && (
                    <span style={{
                      position:     'absolute',
                      left:         0,
                      top:          '20%',
                      height:       '60%',
                      width:        2,
                      background:   C.green,
                      borderRadius: 2,
                    }} />
                  )}

                  {/* Icona */}
                  <span style={{ fontSize: 15, minWidth: 18, textAlign: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </span>

                  {/* Label */}
                  {!collapsed && (
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
                  )}

                  {/* Badge sprint (solo per pagine in sviluppo, non collapsed) */}
                  {!collapsed && isDimmed && (
                    <span style={{
                      fontSize:     9,
                      color:        C.textDim,
                      fontFamily:   C.mono,
                      background:   C.border,
                      padding:      '1px 5px',
                      borderRadius: 4,
                      flexShrink:   0,
                    }}>
                      S{item.sprint}
                    </span>
                  )}

                  {/* Badge contatore (solo pagine esistenti con dati) */}
                  {!collapsed && count > 0 && !isDimmed && (
                    <span style={{
                      background:   C.green,
                      color:        '#0A0A00',
                      fontSize:     10,
                      fontWeight:   700,
                      fontFamily:   C.mono,
                      padding:      '1px 6px',
                      borderRadius: 10,
                      minWidth:     18,
                      textAlign:    'center',
                      lineHeight:   '16px',
                    }}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}

                  {/* Badge dot (collapsed) */}
                  {collapsed && count > 0 && (
                    <span style={{
                      position:     'absolute',
                      top:          4,
                      right:        4,
                      width:        7,
                      height:       7,
                      borderRadius: '50%',
                      background:   C.green,
                    }} />
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer — profilo + logout */}
      <div style={{
        padding:    '12px 16px',
        borderTop:  `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {!collapsed && profile && (
          <div style={{
            display:       'flex',
            alignItems:    'center',
            justifyContent:'space-between',
            marginBottom:  8,
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#B8C8D8', fontFamily: C.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                {profile.nome || profile.email}
              </div>
              <div style={{ fontSize: 10, color: '#7A92A8', fontFamily: C.mono, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {profile.ruolo}
              </div>
            </div>
            <button
              onClick={handleLogout}  // handleLogout è definito nel componente Sidebar
              title="Esci"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#7A92A8', fontSize: 13, padding: 4,
              }}
            >
              ⏻
            </button>
          </div>
        )}

        {/* Firebase live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span style={{
            width:        7,
            height:       7,
            borderRadius: '50%',
            background:   '#4ADE80',
            flexShrink:   0,
            boxShadow:    '0 0 6px #4ADE8088',
          }} />
          {!collapsed && (
            <span style={{ fontSize: 10, color: '#7A92A8', fontFamily: C.mono }}>
              Firebase live
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
