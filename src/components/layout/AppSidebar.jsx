import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  Home,
  Users,
  Calendar,
  Clipboard,
  Package,
  BarChart2,
  Activity,
  ShoppingCart,
  Layers,
  ChevronDown
} from 'react-feather'
import { useAuth } from '../../context/AuthContext'
import { useAppUi } from '../../context/AppUiContext'

export default function AppSidebar({ open }) {
  const { user } = useAuth()
  const { isMobile, setMobileNavOpen, adminView } = useAppUi()
  const [expandedWeek, setExpandedWeek] = useState(false)
  const [expandedInvoice, setExpandedInvoice] = useState(false)

  const isDev = user?.role === 'dev'
  const isAdmin = user?.role === 'admin'
  const isSupplier = user?.role === 'supplier'

  const showAdminNav = (isAdmin || isDev) && adminView
  const showSupplierNav = isSupplier || ((isAdmin || isDev) && !adminView)

  const closeIfMobile = () => {
    if (isMobile) setMobileNavOpen(false)
  }

  const linkClass = ({ isActive }) =>
    `app-nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`

  const submenuClass = ({ isActive }) =>
    `app-nav-link app-nav-submenu d-flex align-items-center gap-2 ms-3 ${isActive ? 'active' : ''}`

  return (
    <aside className={`app-sidebar ${open ? 'is-open' : ''}`} aria-label="Menu utama">
      <nav className="app-sidebar-nav px-2 pb-4 flex-grow-1 overflow-auto">
        <div className="app-nav-section">Umum</div>
        <NavLink end to="/dashboard" className={linkClass} onClick={closeIfMobile}>
          <Home size={18} aria-hidden />
          <span>Dashboard</span>
        </NavLink>

        <div className="app-nav-section mt-3">Operasional</div>

        {/* Week Module */}
        <div>
          <button
            className={`app-nav-link d-flex align-items-center gap-2 w-100 border-0 ${expandedWeek ? 'active' : ''}`}
            onClick={() => setExpandedWeek(!expandedWeek)}
            style={{ padding: '0.55rem 0.75rem', background: 'none', cursor: 'pointer', color: 'rgba(232, 238, 247, 0.88)' }}
          >
            <Calendar size={18} aria-hidden />
            <span style={{ flex: 1, textAlign: 'left' }}>Minggu</span>
            <ChevronDown
              size={16}
              aria-hidden
              style={{ transform: expandedWeek ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            />
          </button>
          {expandedWeek && (
            <>
              <NavLink to="/week" className={submenuClass} onClick={closeIfMobile}>
                <span>Online</span>
              </NavLink>
              <NavLink to="/weekoffline" className={submenuClass} onClick={closeIfMobile}>
                <span>Offline</span>
              </NavLink>
            </>
          )}
        </div>

        {/* Invoice Module */}
        <div>
          <button
            className={`app-nav-link d-flex align-items-center gap-2 w-100 border-0 ${expandedInvoice ? 'active' : ''}`}
            onClick={() => setExpandedInvoice(!expandedInvoice)}
            style={{ padding: '0.55rem 0.75rem', background: 'none', cursor: 'pointer', color: 'rgba(232, 238, 247, 0.88)' }}
          >
            <Clipboard size={18} aria-hidden />
            <span style={{ flex: 1, textAlign: 'left' }}>Invoice</span>
            <ChevronDown
              size={16}
              aria-hidden
              style={{ transform: expandedInvoice ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            />
          </button>
          {expandedInvoice && (
            <>
              <NavLink to="/customer-invoice" className={submenuClass} onClick={closeIfMobile}>
                <span>Customer</span>
              </NavLink>
              <NavLink to="/supplier-invoice" className={submenuClass} onClick={closeIfMobile}>
                <span>Supplier</span>
              </NavLink>
            </>
          )}
        </div>

        {showAdminNav && (
          <>
            <div className="app-nav-section mt-3">Admin</div>
            <NavLink to="/master-supplier" className={linkClass} onClick={closeIfMobile}>
              <Users size={18} aria-hidden />
              <span>Master data supplier</span>
            </NavLink>
            <NavLink to="/bazaar-announcement" className={linkClass} onClick={closeIfMobile}>
              <Calendar size={18} aria-hidden />
              <span>Pengumuman bazaar</span>
            </NavLink>
            <NavLink to="/bazaar-management" className={linkClass} onClick={closeIfMobile}>
              <Clipboard size={18} aria-hidden />
              <span>Kelola pendaftaran</span>
            </NavLink>
            <NavLink to="/bazaar-products" className={linkClass} onClick={closeIfMobile}>
              <Package size={18} aria-hidden />
              <span>Produk per bazaar</span>
            </NavLink>
            <NavLink to="/bazaar-charts" className={linkClass} onClick={closeIfMobile}>
              <BarChart2 size={18} aria-hidden />
              <span>Grafik bazaar</span>
            </NavLink>
          </>
        )}

        {showSupplierNav && (
          <>
            <div className="app-nav-section mt-3">Supplier</div>
            <NavLink to={`/data-supplier/${encodeURIComponent(user.name)}`} className={linkClass} onClick={closeIfMobile}>
              <ShoppingCart size={18} aria-hidden />
              <span>Produk saya</span>
            </NavLink>
            <NavLink to="/master-supplier" className={linkClass} onClick={closeIfMobile}>
              <Users size={18} aria-hidden />
              <span>Direktori supplier</span>
            </NavLink>
            <NavLink to="/bazaar-registration" className={linkClass} onClick={closeIfMobile}>
              <Clipboard size={18} aria-hidden />
              <span>Daftar bazaar</span>
            </NavLink>
            <NavLink to="/bazaar-charts" className={linkClass} onClick={closeIfMobile}>
              <BarChart2 size={18} aria-hidden />
              <span>Grafik bazaar</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="app-sidebar-footer px-3 py-2 small text-muted border-top border-light border-opacity-10">
        v2.0
      </div>
    </aside>
  )
}
