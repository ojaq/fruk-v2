import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import NavbarComponent from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavbarComponent />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App