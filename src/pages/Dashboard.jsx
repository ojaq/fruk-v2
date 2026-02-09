import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Input, InputGroup, InputGroupText } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import { Instagram, Linkedin, Mail, Phone } from 'react-feather'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, applyAsAdmin, logout, profile, toggleProfileModal, registeredUsers, handleAdminDecision, cancelAdminRequest, bazaarData } = useAuth()
  const [isProfileEmpty, setIsProfileEmpty] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  const [adminView, setAdminView] = useState(() => {
    return localStorage.getItem('adminView') === 'false' ? false : true
  })

  const [currentWeek, setCurrentWeek] = useState(() => {
    return Number(localStorage.getItem('currentWeek')) || 1
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

  const handleWeekly = () => {
    navigate(`/week/${currentWeek}`)
  }

  const handleWeek = () => {
    navigate(`/week`)
  }

  const handleWeeklyCustomerInvoice = () => {
    navigate(`/customer-invoice/${currentWeek}`)
  }

  const handleWeeklySupplierInvoice = () => {
    navigate(`/supplier-invoice/${currentWeek}`)
  }

  const handleCustomerInvoice = () => {
    navigate(`/customer-invoice`)
  }

  const handleSupplierInvoice = () => {
    navigate(`/supplier-invoice`)
  }

  const handleBazaarAnnouncement = () => {
    navigate(`/bazaar-announcement`)
  }

  const handleBazaarRegistration = () => {
    navigate(`/bazaar-registration`)
  }

  const handleBazaarManagement = () => {
    navigate(`/bazaar-management`)
  }

  const handleBazaarCharts = () => {
    navigate(`/bazaar-charts`)
  }

  const checkProfileEmpty = (profileObj) => {
    const { namaSupplier, namaBank, namaPenerima, noRekening } = profileObj || {}
    return !namaSupplier?.trim() || !namaBank?.trim() || !namaPenerima?.trim() || !noRekening?.trim()
  }

  useEffect(() => {
    if (user?.role === 'supplier') {
      const empty = checkProfileEmpty(user.profile)
      setIsProfileEmpty(empty)
    }
  }, [user])

  const supplierOptions = registeredUsers
    .filter(u => !['admin', 'supplier', 'superadmin'].includes(u.name.toLowerCase()))
    .map(u => ({
      label: `${u.name}${u.profile?.namaSupplier ? ` (${u.profile.namaSupplier})` : ''}`,
      value: u.name
    }))

  const pendingRegistrations = (bazaarData?.registrations || []).filter(r => r?.status === 'pending').length

  let needsRegistration = false
  let unregisteredAnnouncements = []
  let rejectedAnnouncements = []
  if ((user.role === 'supplier') || (user.role === 'admin' && !adminView)) {
    const now = new Date()
    const activeAnnouncements = (bazaarData?.announcements || []).filter(a => {
      if (a?.status !== 'active') return false
      if (!a.registrationDeadline) return true
      return new Date(a.registrationDeadline) > now
    })
    const myRegs = (bazaarData?.registrations || []).filter(
      r => r?.supplierName && r?.supplierName.trim().toLowerCase() === user.name.trim().toLowerCase()
    )
    needsRegistration = activeAnnouncements.some(a => {
      const reg = myRegs.find(r => r?.announcementId === a.id)
      if (!reg) unregisteredAnnouncements.push(a)
      else if (reg?.status === 'rejected') rejectedAnnouncements.push(a)
      return !reg || reg?.status === 'rejected'
    })
  }

  return (
    <div className="container mt-5" style={{ paddingBottom: '70px' }}>
      <h3>Halo, {user.name}</h3>
      <p>Role kamu sekarang: <strong>{user.role}</strong></p>

      {user.role === 'admin' && (
        <div className="mb-4">
          <Button color="danger" onClick={() => navigate('/bazaar-logs')} className="me-2">
            Lihat Log Bazaar
          </Button>
          <Button color="danger" onClick={() => navigate('/week-logs')} className="me-2">
            Lihat Log Week
          </Button>
        </div>
      )}

      {user.role === 'superadmin' && (
        <>
          <h5 className="mt-4">Permintaan Admin Baru</h5>
          {registeredUsers.filter(u => u.requested_admin === 'true' && u.role === 'supplier').length === 0 ? (
            <p className="text-muted">Tidak ada permintaan saat ini.</p>
          ) : (
            registeredUsers
              .filter(u => u.role === 'supplier' && u.requested_admin === 'true')
              .map((u, idx) => (
                <div key={idx} className="mb-2 d-flex align-items-center justify-content-between border p-2 rounded">
                  <div>
                    <strong>{u.name}</strong> mengajukan sebagai admin.
                  </div>
                  <div>
                    <Button color="success" className="me-2" onClick={() => handleAdminDecision(u.name, true)}>
                      Terima
                    </Button>
                    <Button color="danger" onClick={() => handleAdminDecision(u.name, false)}>
                      Tolak
                    </Button>
                  </div>
                </div>
              ))
          )}
        </>
      )}

      {(user.role === 'admin' && adminView) && (
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
            <li className="mb-2">Atur data dan masuk ke minggu: &nbsp;
              <InputGroup size="sm" style={{ width: 150, display: 'inline-flex' }}>
                <InputGroupText>Minggu</InputGroupText>
                <Input
                  type="text"
                  pattern="\d*"
                  inputMode="numeric"
                  value={currentWeek}
                  onChange={e => {
                    const raw = e.target.value
                    if (/^\d*$/.test(raw)) {
                      setCurrentWeek(raw)
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(currentWeek)
                    if (!parsed || parsed < 1) {
                      setCurrentWeek(1)
                      localStorage.setItem('currentWeek', 1)
                    } else {
                      localStorage.setItem('currentWeek', parsed)
                    }
                  }}
                />
              </InputGroup>
              <Button color="primary" size="sm" className="ms-2" onClick={handleWeekly}>
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

      {((user.role === 'admin' && !adminView) || user.role === 'supplier') && (
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
              <InputGroup size="sm" style={{ width: 150, display: 'inline-flex' }}>
                <InputGroupText>Minggu</InputGroupText>
                <Input
                  type="text"
                  pattern="\d*"
                  inputMode="numeric"
                  value={currentWeek}
                  onChange={e => {
                    const raw = e.target.value
                    if (/^\d*$/.test(raw)) {
                      setCurrentWeek(raw)
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(currentWeek)
                    if (!parsed || parsed < 1) {
                      setCurrentWeek(1)
                      localStorage.setItem('currentWeek', 1)
                    } else {
                      localStorage.setItem('currentWeek', parsed)
                    }
                  }}
                />
              </InputGroup>
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
              {(unregisteredAnnouncements.length > 0 || rejectedAnnouncements.length > 0) && (
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
        {user.role === 'supplier' && user.requestedAdmin === true && (
          <>
            <Button color="warning" className="me-3" disabled>
              ⏳ Menunggu persetujuan admin...
            </Button>
            <Button color="danger" onClick={cancelAdminRequest} className="me-3">
              Batalkan
            </Button>
          </>
        )}

        {user.role === 'supplier' && user.requestedAdmin === 'rejected' && (
          <>
            <span className="text-danger me-3">❌ Pengajuan admin ditolak.</span>
            <Button color="info" onClick={applyAsAdmin} className="me-3">
              Ajukan Ulang
            </Button>
          </>
        )}

        {user.role === 'supplier' && !user.requestedAdmin && (
          <Button color="primary" onClick={applyAsAdmin} className="me-3">
            Ajukan sebagai Admin
          </Button>
        )}

        {user.role === 'admin' && (
          <>
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
          </>
        )}

        <Button color="danger" onClick={handleLogout}>Logout</Button>
      </div>
      <div style={{
        position: 'fixed',
        bottom: '15px',
        right: '15px',
        fontSize: '0.9rem',
        color: '#888'
      }}>
        Made by Abdur Razzaq - <Phone size="18" color="#05b729ff" /> 082125970813 - <Instagram size="18" color="#b9359eff" /> & <Linkedin size="18" color="#2535e3ff" /> abangojaq - <Mail size="18" color="#bc1313ff" /> abangojaq@gmail.com
      </div>
    </div>
  )
}

export default Dashboard