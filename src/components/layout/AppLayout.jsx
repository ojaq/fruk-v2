import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppUi } from '../../context/AppUiContext'
import AppSidebar from './AppSidebar'
import TopNavBar from './TopNavBar'

export default function AppLayout() {
  const { isMobile, mobileNavOpen, setMobileNavOpen } = useAppUi()
  const location = useLocation()

  useEffect(() => {
    if (isMobile) setMobileNavOpen(false)
  }, [location.pathname, isMobile, setMobileNavOpen])

  const sidebarOpen = !isMobile || mobileNavOpen

  return (
    <div className="app-shell">
      <AppSidebar open={sidebarOpen} />
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          className="app-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="app-main-wrap">
        <TopNavBar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
