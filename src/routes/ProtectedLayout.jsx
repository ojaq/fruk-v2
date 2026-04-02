import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppUiProvider } from '../context/AppUiContext'
import AppLayout from '../components/layout/AppLayout'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="app-loading d-flex align-items-center justify-content-center min-vh-100 bg-app">
        <div className="text-center">
          <div className="spinner-border text-app-primary mb-3" role="status" aria-label="Loading" />
          <div className="text-muted small">Memuat…</div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <AppUiProvider>
      <AppLayout />
    </AppUiProvider>
  )
}
