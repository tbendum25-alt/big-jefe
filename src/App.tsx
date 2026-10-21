import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Loader } from './components/ui'
import Confirmation from './pages/Confirmation'
import Contact from './pages/Contact'
import Home from './pages/Home'
import MyBooking from './pages/MyBooking'
import Restaurant from './pages/Restaurant'
import RoomDetail from './pages/RoomDetail'
import Rooms from './pages/Rooms'
import Services from './pages/Services'

// L'administration est chargée à la demande : elle n'alourdit pas le site public sur mobile.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'))
const AdminRooms = lazy(() => import('./pages/admin/AdminRooms'))
const AdminMenu = lazy(() => import('./pages/admin/AdminMenu'))
const AdminServices = lazy(() => import('./pages/admin/AdminServices'))
const AdminInvoices = lazy(() => import('./pages/admin/AdminInvoices'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam'))

function NotFound() {
  return (
    <div className="pt-40 text-center px-5">
      <h1 className="text-5xl text-emerald-deep font-semibold">Page introuvable</h1>
      <p className="mt-3 text-[#4b5d56]">Cette page n'existe pas ou a été déplacée.</p>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="chambres" element={<Rooms />} />
          <Route path="chambres/:id" element={<RoomDetail />} />
          <Route path="reservation-confirmee" element={<Confirmation />} />
          <Route path="ma-reservation" element={<MyBooking />} />
          <Route path="restaurant" element={<Restaurant />} />
          <Route path="services" element={<Services />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="reservations" element={<AdminBookings />} />
          <Route path="chambres" element={<AdminRooms />} />
          <Route path="restaurant" element={<AdminMenu />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="factures" element={<AdminInvoices />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="parametres" element={<AdminSettings />} />
          <Route path="equipe" element={<AdminTeam />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
