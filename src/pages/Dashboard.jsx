import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Input, InputGroup, InputGroupText } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout, toggleProfileModal, registeredUsers, bazaarData } = useAuth()

  const isDev = user?.role === 'dev'
  const isAdmin = user?.role === 'admin'
  const isSupplier = user?.role === 'supplier'

  const [isProfileEmpty, setIsProfileEmpty] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  const [adminView, setAdminView] = useState(() => {
    return localStorage.getItem('adminView') === 'false' ? false : true
  })

  const [currentWeek, setCurrentWeek] = useState(() => {
    const saved = Number(localStorage.getItem('currentWeek'))
    return saved || null
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDataSupplier = () => {
    navigate(`/data-supplier/${user.name}`)
  }

  const handleMasterDataSupplier = () => {
    navigate(`/data-supplier`)
  }

  const handleViewSupplierData = () => {
    if (selectedSupplier) {
      navigate(`/data-supplier/${selectedSupplier.value}`)
    }
  }

  const handleWeekly = () => navigate(`/week/${currentWeek}`)
  const handleWeeklyOffline = () => navigate(`/weekoffline/${currentWeek}`)
  const handleWeek = () => navigate(`/week`)
  const handleWeeklyCustomerInvoice = () => navigate(`/customer-invoice/${currentWeek}`)
  const handleWeeklySupplierInvoice = () => navigate(`/supplier-invoice/${currentWeek}`)
  const handleCustomerInvoice = () => navigate(`/customer-invoice`)
  const handleSupplierInvoice = () => navigate(`/supplier-invoice`)
  const handleBazaarAnnouncement = () => navigate(`/bazaar-announcement`)
  const handleBazaarRegistration = () => navigate(`/bazaar-registration`)
  const handleBazaarManagement = () => navigate(`/bazaar-management`)
  const handleBazaarCharts = () => navigate(`/bazaar-charts`)

  const isEmpty = (v) => !v || String(v).trim() === ''

  const checkProfileEmpty = (u) => {
    return (
      isEmpty(u.nama_supplier) ||
      isEmpty(u.nama_bank) ||
      isEmpty(u.no_rekening) ||
      isEmpty(u.nama_penerima)
    )
  }

  useEffect(() => {
    if (!user) return
    setIsProfileEmpty(checkProfileEmpty(user))
  }, [user])

  const supplierOptions = (registeredUsers || [])
    .filter(u => ['supplier', 'admin', 'dev'].includes(u.role))
    .map(u => ({
      label: `${u.name}${u.namaSupplier ? ` (${u.namaSupplier})` : ''}`,
      value: u.name
    }))

  const pendingRegistrations = (bazaarData?.registrations || []).filter(r => r?.status === 'pending').length

  let unregisteredAnnouncements = []
  let rejectedAnnouncements = []
  let pendingAnnouncements = []

  if (isSupplier || (isAdmin && !adminView) || (isDev && !adminView)) {
    const now = new Date()
    const activeAnnouncements = (bazaarData?.announcements || []).filter(a => {
      if (a?.status !== 'active') return false
      if (!a.registrationDeadline) return true


      const deadline = new Date(a.registrationDeadline)
      deadline.setHours(23, 59, 59, 999)

      return deadline >= now
    })

    const myRegs = (bazaarData?.registrations || []).filter(
      r => r?.supplierId === user.id
    )

    activeAnnouncements.forEach(a => {
      const reg = myRegs.find(r => r?.announcementId === a.id)

      if (!reg) {
        unregisteredAnnouncements.push(a)
        return
      }

      if (reg.status === 'pending') {
        pendingAnnouncements.push(a)
        return
      }

      if (reg.status === 'rejected') {
        rejectedAnnouncements.push(a)
      }
    })
  }

  const weekOptions = React.useMemo(() => {
    const map = new Map()

      ; (bazaarData?.announcements || []).forEach(a => {
        if (!a.weekCode) return
        if (a.is_deleted) return

        const num = Number(a.weekCode.replace('W', ''))
        if (!num) return

        if (!map.has(num)) {
          map.set(num, {
            value: num,
            label: `${a.title} – ${a.weekCode}`
          })
        }
      })

    return Array.from(map.values()).sort((a, b) => a.value - b.value)
  }, [bazaarData])

  return (
    <div className="container mt-5" style={{ paddingBottom: '70px' }}>
      <h3>Halo, {user.name}</h3>
      <p>Role kamu sekarang: <strong>{user.role}</strong></p>

      {/* {(isAdmin || isDev) && (
        <div className="mb-4">
          <Button color="danger" onClick={() => navigate('/bazaar-logs')} className="me-2">
            Lihat Log Bazaar
          </Button>
          <Button color="danger" onClick={() => navigate('/week-logs')} className="me-2">
            Lihat Log Week
          </Button>
        </div>
      )} */}

      {((isDev && adminView) || (isAdmin && adminView)) && (
        <>
          <p className="mt-4"><strong>🛠️ Panduan untuk Admin:</strong></p>
          <ul>
            <li className="mb-2">Cek <strong>Data Supplier disini.</strong> &nbsp;
              <Button color="primary" size="sm" onClick={handleMasterDataSupplier}>
                Data Supplier
              </Button>
            </li>
            <li className="mb-2">Lihat data supplier tertentu: &nbsp;
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <Select
                  options={supplierOptions}
                  placeholder="🔽 Pilih supplier"
                  isClearable
                  isSearchable
                  value={selectedSupplier}
                  onChange={setSelectedSupplier}
                  styles={{
                    control: (base) => ({
                      ...base,
                      width: '300px',
                    })
                  }}
                />
                <Button
                  color="primary"
                  size="sm"
                  onClick={handleViewSupplierData}
                  disabled={!selectedSupplier}
                >
                  Lihat Data
                </Button>
              </div>
            </li>
            <li className="mb-2">Atur data dan masuk di bazaar <strong>online</strong>: &nbsp;
              <div style={{ width: 260, display: 'inline-block' }}>
                <Select
                  options={weekOptions}
                  placeholder="📅 Pilih Bazaar / Week"
                  isClearable
                  value={weekOptions.find(w => w.value === currentWeek) || null}
                  onChange={(opt) => {
                    if (!opt) {
                      setCurrentWeek(null)
                      localStorage.removeItem('currentWeek')
                      return
                    }

                    setCurrentWeek(opt.value)
                    localStorage.setItem('currentWeek', opt.value)
                  }}
                />
              </div>
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeekly}>
                Week {currentWeek}
              </Button>
            </li>
            <li className="mb-2">Atur data dan masuk di bazaar <strong>offline</strong>: &nbsp;
              <div style={{ width: 260, display: 'inline-block' }}>
                <Select
                  options={weekOptions}
                  placeholder="📅 Pilih Bazaar / Week"
                  isClearable
                  value={weekOptions.find(w => w.value === currentWeek) || null}
                  onChange={(opt) => {
                    if (!opt) {
                      setCurrentWeek(null)
                      localStorage.removeItem('currentWeek')
                      return
                    }

                    setCurrentWeek(opt.value)
                    localStorage.setItem('currentWeek', opt.value)
                  }}
                />
              </div>
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeeklyOffline}>
                Week {currentWeek}
              </Button>
            </li>
            <li className="mb-2">Lihat invoice mingguan di <strong>Customer Invoice</strong>. &nbsp;
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeeklyCustomerInvoice}>
                Customer Invoice Week {currentWeek}
              </Button>
            </li>
            <li className="mb-2">Lihat invoice mingguan di <strong>Supplier Invoice</strong>. &nbsp;
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeeklySupplierInvoice}>
                Supplier Invoice Week {currentWeek}
              </Button>
            </li>
            <li className="mb-2">Atur data dan masuk ke seluruh minggu: &nbsp;
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeek}>
                All Week
              </Button>
            </li>
            <li className="mb-2">Cek data berbentuk grafik dari semua minggu di <strong>Bazaar Charts</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleBazaarCharts}>
                Bazaar Charts
              </Button>
            </li>
            <li className="mb-2">Lihat semua invoice dari semua minggu di <strong>All Customer Invoice</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleCustomerInvoice}>
                All Customer Invoice
              </Button>
            </li>
            <li className="mb-2">Lihat semua invoice dari semua minggu di <strong>All Supplier Invoice</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleSupplierInvoice}>
                All Supplier Invoice
              </Button>
            </li>
            <li className="mb-2">Kelola pengumuman bazaar di <strong>Bazaar Pengumuman</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleBazaarAnnouncement}>
                Bazaar Pengumuman
              </Button>
            </li>
            <li className="mb-2">Kelola pendaftaran bazaar di <strong>Kelola Pendaftaran Bazaar</strong>.
              <Button color="primary" size="sm" className="ms-2 position-relative" onClick={handleBazaarManagement}>
                Kelola Pendaftaran Bazaar
              </Button>
              {pendingRegistrations > 0 && (
                <span className="badge bg-danger py-2 px-3 ms-2">{pendingRegistrations}</span>
              )}
            </li>
            <li className="mb-2">Lihat <strong>Data Supplier per bazaar.</strong> &nbsp;
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-products')}>
                Lihat Produk Bazaar (per Pengumuman)
              </Button>
            </li>
          </ul>
        </>
      )}

      {((isDev && !adminView) || (isAdmin && !adminView) || isSupplier) && (
        <>
          <p className="mt-4"><strong>📦 Panduan untuk Supplier:</strong></p>
          <ul>
            {isProfileEmpty && (
              <li className="mb-2">
                🚨 <strong>Lengkapi profil kamu terlebih dahulu.</strong> &nbsp;
                <Button color="warning" size="sm" onClick={toggleProfileModal}>
                  Isi Profil Sekarang
                </Button>
              </li>
            )}
            {!isProfileEmpty && (
              <li className="mb-2">
                <>✔️ Profil kamu sudah lengkap. Kamu bisa mengedit disini.</> &nbsp;
                <Button color="primary" size="sm" onClick={toggleProfileModal}>
                  Edit Profil
                </Button>
              </li>
            )}
            <li className="mb-2">Isi data produk kamu dari menu <strong>Data Supplier.</strong> &nbsp;
              <Button color="primary" size="sm" onClick={handleDataSupplier}>
                Data Supplier {user.name}
              </Button>
            </li>
            <li className="mb-2">Double-Cek <strong>Data Supplier kamu disini.</strong> &nbsp;
              <Button color="primary" size="sm" onClick={handleMasterDataSupplier}>
                Data Supplier
              </Button>
            </li>
            <li className="mb-2">Cek pesanan mingguan di <strong>Supplier Invoice</strong>. &nbsp;
              <div style={{ width: 260, display: 'inline-block' }}>
                <Select
                  options={weekOptions}
                  placeholder="📅 Pilih Bazaar / Week"
                  isClearable
                  value={weekOptions.find(w => w.value === currentWeek) || null}
                  onChange={(opt) => {
                    if (!opt) {
                      setCurrentWeek(null)
                      localStorage.removeItem('currentWeek')
                      return
                    }

                    setCurrentWeek(opt.value)
                    localStorage.setItem('currentWeek', opt.value)
                  }}
                />
              </div>
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeeklySupplierInvoice}>
                Supplier Invoice Week {currentWeek}
              </Button>
            </li>
            <li className="mb-2">Cek data berbentuk grafik dari semua minggu di <strong>Bazaar Charts</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleBazaarCharts}>
                Bazaar Charts
              </Button>
            </li>
            <li className="mb-2">Cek semua pesanan dari semua minggu di <strong>All Supplier Invoice</strong>.
              <Button color="primary" size="sm" className="ms-2" onClick={handleSupplierInvoice}>
                All Supplier Invoice
              </Button>
            </li>
            <li className="mb-2">Daftar untuk bazaar di <strong>Daftar Bazaar</strong>.
              <Button color="primary" size="sm" className="ms-2 position-relative" onClick={handleBazaarRegistration}>
                Daftar Bazaar
              </Button>
              {(unregisteredAnnouncements.length > 0 || pendingAnnouncements.length > 0 || rejectedAnnouncements.length > 0) && (
                <>
                  {unregisteredAnnouncements.length > 0 && (
                    <div className="badge bg-warning text-black py-2 px-3 ms-2">
                      Belum daftar: {unregisteredAnnouncements.map(a => a.title).join(', ')}
                    </div>
                  )}
                  {rejectedAnnouncements.length > 0 && (
                    <div className="badge bg-danger py-2 px-3 ms-2">
                      Ditolak: {rejectedAnnouncements.map(a => a.title).join(', ')}
                    </div>
                  )}
                </>
              )}
            </li>
          </ul>
        </>
      )}

      <div className="mt-4">
        {(isDev || isAdmin) && (
          <Button
            color="secondary"
            onClick={() => {
              setAdminView(prev => {
                localStorage.setItem('adminView', String(!prev))
                return !prev
              })
            }}
            className="me-3"
          >
            Pindah ke Tampilan {adminView ? 'Supplier' : 'Admin'}
          </Button>
        )}

        <Button color="danger" onClick={handleLogout}>Logout</Button>
      </div>
    </div>
  )
}

export default Dashboard