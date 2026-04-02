import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Dashboard from '../pages/Dashboard'
import Week from '../pages/Week'
import WeekOffline from '../pages/WeekOffline'
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
import BazaarCharts from '../pages/BazaarCharts'
import ProtectedLayout from './ProtectedLayout'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invoice-customer/:num" element={<CustomerInvoice />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/data-supplier" element={<MasterSupplier />} />
        <Route path="/data-supplier/:user" element={<DataSupplier />} />
        <Route path="/week/:num?" element={<Week />} />
        <Route path="/weekoffline/:num?" element={<WeekOffline />} />
        <Route path="/customer-invoice/:num?" element={<CustomerInvoice />} />
        <Route path="/supplier-invoice/:num?" element={<SupplierInvoice />} />
        <Route path="/bazaar-announcement" element={<BazaarAnnouncement />} />
        <Route path="/bazaar-registration" element={<BazaarRegistration />} />
        <Route path="/bazaar-management" element={<BazaarManagement />} />
        <Route path="/bazaar-products" element={<BazaarProducts />} />
        <Route path="/bazaar-logs" element={<BazaarLogs />} />
        <Route path="/week-logs" element={<WeekLogs />} />
        <Route path="/bazaar-charts" element={<BazaarCharts />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default AppRoutes
