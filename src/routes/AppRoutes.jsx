import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Dashboard from '../pages/Dashboard'
import Week from '../pages/Week'
import CustomerInvoice from '../pages/CustomerInvoice'
import SupplierInvoice from '../pages/SupplierInvoice'
import MasterSupplier from '../pages/MasterSupplier'
import DataSupplier from '../pages/DataSupplier'
import BazaarAnnouncement from '../pages/BazaarAnnouncement'
import BazaarRegistration from '../pages/BazaarRegistration'
import BazaarManagement from '../pages/BazaarManagement'
import BazaarLogs from '../pages/BazaarLogs'
import WeekLogs from '../pages/WeekLogs'
import BazaarProducts from '../pages/BazaarProducts'
import PrivateRoutes from './PrivateRoutes'
import BazaarCharts from '../pages/BazaarCharts'

const AppRoutes = () => {
  return (
    <Routes>
      {/* public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invoice-customer/:num" element={<CustomerInvoice />} />

      {/* protected routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoutes>
            <Dashboard />
          </PrivateRoutes>
        }
      />
      <Route
        path="/data-supplier"
        element={
          <PrivateRoutes>
            <MasterSupplier />
          </PrivateRoutes>
        }
      />
      <Route
        path="/data-supplier/:user"
        element={
          <PrivateRoutes>
            <DataSupplier />
          </PrivateRoutes>
        }
      />
      <Route
        path="/week/:num?"
        element={
          <PrivateRoutes>
            <Week />
          </PrivateRoutes>
        }
      />
      <Route
        path="/customer-invoice/:num?"
        element={
          <PrivateRoutes>
            <CustomerInvoice />
          </PrivateRoutes>
        }
      />
      <Route
        path="/supplier-invoice/:num?"
        element={
          <PrivateRoutes>
            <SupplierInvoice />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-announcement"
        element={
          <PrivateRoutes>
            <BazaarAnnouncement />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-registration"
        element={
          <PrivateRoutes>
            <BazaarRegistration />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-management"
        element={
          <PrivateRoutes>
            <BazaarManagement />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-products"
        element={
          <PrivateRoutes>
            <BazaarProducts />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-logs"
        element={
          <PrivateRoutes>
            <BazaarLogs />
          </PrivateRoutes>
        }
      />
      <Route
        path="/week-logs"
        element={
          <PrivateRoutes>
            <WeekLogs />
          </PrivateRoutes>
        }
      />
      <Route
        path="/bazaar-charts"
        element={
          <PrivateRoutes>
            <BazaarCharts />
          </PrivateRoutes>
        }
      />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default AppRoutes