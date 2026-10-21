import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { useAuth } from './lib/auth'
import { Welcome } from './pages/Welcome'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { AuthCallback } from './pages/AuthCallback'
import { CompleteProfile } from './pages/CompleteProfile'
import { Home } from './pages/Home'
import { NotFound } from './pages/Placeholder'
import { Menu } from './pages/Menu'
import { Cart } from './pages/Cart'
import { OrderStatus } from './pages/OrderStatus'
import { Points } from './pages/Points'
import { Leaderboard } from './pages/Leaderboard'
import { Events } from './pages/Events'
import { Scan } from './pages/Scan'
import { Orders } from './pages/Orders'
import { Redeem } from './pages/Redeem'
import { MenuEdit } from './pages/MenuEdit'
import { RoleGate } from './components/RoleGate'
import { Banned, Warned } from './pages/Moderation'
import { Stats } from './pages/admin/Stats'
import { Staff } from './pages/admin/Staff'
import { RewardsEdit } from './pages/admin/RewardsEdit'
import { Reviews } from './pages/admin/Reviews'
import { EventsEdit } from './pages/admin/EventsEdit'


function AppRoutes() {
  const { session, profile, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <div className="page"><p className="spinner">CAFFE PADRINO</p></div>
  if (pathname === '/auth/callback') return <AuthCallback />

  if (!session) return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  if (profile?.banned) return <Banned />
  if (profile && (!profile.nickname || !profile.birth_year)) return <CompleteProfile />
  if (profile?.warned_until && new Date(profile.warned_until).getTime() > Date.now()) return <Warned />

  return (
    <Routes key={pathname}>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/order/new" element={<Cart />} />
      <Route path="/order/:id" element={<OrderStatus />} />
      <Route path="/points" element={<Points />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/events" element={<Events />} />
      <Route path="/scan" element={<RoleGate min="waiter"><Scan /></RoleGate>} />
      <Route path="/orders" element={<RoleGate min="waiter"><Orders /></RoleGate>} />
      <Route path="/redeem" element={<RoleGate min="waiter"><Redeem /></RoleGate>} />
      <Route path="/admin/menu" element={<RoleGate min="waiter"><MenuEdit /></RoleGate>} />
      <Route path="/admin/stats" element={<RoleGate min="admin"><Stats /></RoleGate>} />
      <Route path="/admin/staff" element={<RoleGate min="admin"><Staff /></RoleGate>} />
      <Route path="/admin/rewards" element={<RoleGate min="admin"><RewardsEdit /></RoleGate>} />
      <Route path="/admin/reviews" element={<RoleGate min="admin"><Reviews /></RoleGate>} />
      <Route path="/admin/events" element={<RoleGate min="admin"><EventsEdit /></RoleGate>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main className="frame">
        <div className="frame-inner"><AppRoutes /></div>
      </main>
    </>
  )
}
