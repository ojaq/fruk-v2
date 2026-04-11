import React, { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppUi } from '../context/AppUiContext'
import { Button, Badge } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  Users,
  Calendar,
  Clipboard,
  Package,
  BarChart2,
  Activity,
  ShoppingCart,
  AlertCircle,
  Check,
  X
} from 'react-feather'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, toggleProfileModal, bazaarData, saveBazaarData, logBazaarAction } = useAuth()
  const { adminView, currentWeek } = useAppUi()

  const isDev = user?.role === 'dev'
  const isAdmin = user?.role === 'admin'
  const isSupplier = user?.role === 'supplier'

  const showAdminNav = (isAdmin || isDev) && adminView
  const showSupplierNav = isSupplier || ((isAdmin || isDev) && !adminView)

  const [quickLoading, setQuickLoading] = useState(null)

  const isEmpty = (v) => !v || String(v).trim() === ''
  const isProfileEmpty =
    isEmpty(user?.nama_supplier) ||
    isEmpty(user?.nama_bank) ||
    isEmpty(user?.no_rekening) ||
    isEmpty(user?.nama_penerima)

  const pendingRegs = useMemo(
    () => (bazaarData?.registrations || []).filter((r) => r?.status === 'pending'),
    [bazaarData]
  )

  const activeAnnouncementsCount = useMemo(
    () => (bazaarData?.announcements || []).filter((a) => a?.status === 'active' && !a.isDeleted).length,
    [bazaarData]
  )

  let unregisteredAnnouncements = []
  let pendingAnnouncements = []
  let rejectedAnnouncements = []

  if (showSupplierNav) {
    const now = new Date()
    const activeAnnouncements = (bazaarData?.announcements || []).filter((a) => {
      if (a?.status !== 'active') return false
      if (!a.registrationDeadline) return true
      const deadline = new Date(a.registrationDeadline)
      deadline.setHours(23, 59, 59, 999)
      return deadline >= now
    })

    const myRegs = (bazaarData?.registrations || []).filter((r) => r?.supplierId === user.id)

    activeAnnouncements.forEach((a) => {
      const reg = myRegs.find((r) => r?.announcementId === a.id)
      if (!reg) {
        unregisteredAnnouncements.push(a)
        return
      }
      if (reg.status === 'pending') pendingAnnouncements.push(a)
      if (reg.status === 'rejected') rejectedAnnouncements.push(a)
    })
  }

  const announcementById = useMemo(() => {
    const m = {}
    ;(bazaarData?.announcements || []).forEach((a) => {
      if (a?.id) m[a.id] = a
    })
    return m
  }, [bazaarData])

  const quickApprove = async (row) => {
    const ok = await Swal.fire({
      title: 'Setujui pendaftaran?',
      text: `${row.supplierName || ''}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Setujui',
      cancelButtonText: 'Batal'
    })
    if (!ok.isConfirmed) return

    setQuickLoading(row.id)
    try {
      const registrations = [...(bazaarData.registrations || [])]
      const idx = registrations.findIndex((r) => r?.id === row.id)
      if (idx === -1) throw new Error('not found')

      await logBazaarAction({
        user,
        action: 'edit',
        target: 'registration',
        targetId: row.id,
        dataBefore: registrations[idx],
        dataAfter: {
          ...registrations[idx],
          status: 'approved',
          updatedAt: new Date().toISOString(),
          reviewedBy: user.name
        },
        description: 'Quick approve from dashboard'
      })

      registrations[idx] = {
        ...registrations[idx],
        status: 'approved',
        updatedAt: new Date().toISOString(),
        reviewedBy: user.name
      }

      await saveBazaarData({ ...bazaarData, registrations })
      Swal.fire('Berhasil', 'Disetujui', 'success')
    } catch (e) {
      console.error(e)
      Swal.fire('Error', 'Gagal menyetujui', 'error')
    } finally {
      setQuickLoading(null)
    }
  }

  const quickReject = async (row) => {
    const { value: reason } = await Swal.fire({
      title: 'Tolak pendaftaran?',
      input: 'textarea',
      inputPlaceholder: 'Alasan penolakan…',
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      inputValidator: (value) => {
        if (!value || !value.trim()) return 'Alasan wajib diisi'
      }
    })
    if (!reason) return

    setQuickLoading(row.id)
    try {
      const registrations = [...(bazaarData.registrations || [])]
      const idx = registrations.findIndex((r) => r?.id === row.id)
      if (idx === -1) throw new Error('not found')

      await logBazaarAction({
        user,
        action: 'edit',
        target: 'registration',
        targetId: row.id,
        dataBefore: registrations[idx],
        dataAfter: {
          ...registrations[idx],
          status: 'rejected',
          adminNotes: reason,
          updatedAt: new Date().toISOString(),
          reviewedBy: user.name
        },
        description: 'Quick reject from dashboard'
      })

      registrations[idx] = {
        ...registrations[idx],
        status: 'rejected',
        adminNotes: reason,
        updatedAt: new Date().toISOString(),
        reviewedBy: user.name
      }

      await saveBazaarData({ ...bazaarData, registrations })
      Swal.fire('Berhasil', 'Ditolak', 'success')
    } catch (e) {
      console.error(e)
      Swal.fire('Error', 'Gagal menolak', 'error')
    } finally {
      setQuickLoading(null)
    }
  }

  const currentAnnouncement = useMemo(() => {
    if (currentWeek == null) return null

    return (bazaarData?.announcements || []).find(a => {
      if (!a?.weekCode) return false
      const num = Number(String(a.weekCode).replace('W', ''))
      return num === currentWeek && a.status === 'active' && !a.isDeleted
    })
  }, [bazaarData, currentWeek])

  const weekHint = currentWeek != null ? currentAnnouncement ? `W${currentWeek} – ${currentAnnouncement.title}` : `W${currentWeek}` : 'Semua Minggu/Bazaar'

  return (
    <div>
      <div className="app-dashboard-hero mb-4">
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div>
            <h1 className="h4 mb-1 text-white fw-bold">{user.name}</h1>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Badge color="light" className="text-dark">
                {user.role}
              </Badge>
              {showAdminNav && <span className="small">Tampilan admin</span>}
              {showSupplierNav && !isSupplier && (
                <span className="small">Tampilan supplier</span>
              )}
            </div>
          </div>
          <div className="text-md-end text-white fw-bold max-w-100" style={{ maxWidth: 320 }}>
            {weekHint}
          </div>
        </div>
      </div>

      {showSupplierNav && isProfileEmpty && (
        <div className="alert alert-warning d-flex align-items-center gap-3 app-page-card border-0 mb-4" role="status">
          <AlertCircle size={24} />
          <div className="flex-grow-1">
            <strong>Lengkapi profil</strong> — bank dan rekening diperlukan untuk pembayaran.
          </div>
          <Button color="warning" onClick={toggleProfileModal}>
            Isi profil
          </Button>
        </div>
      )}

      {showSupplierNav && !isProfileEmpty && (
        <div className="alert alert-light border app-page-card mb-4 py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="small text-muted mb-0">Profil sudah lengkap.</span>
          <Button size="sm" color="primary" outline onClick={toggleProfileModal}>
            Edit profil
          </Button>
        </div>
      )}

      {showSupplierNav && (unregisteredAnnouncements.length > 0 || pendingAnnouncements.length > 0) && (
        <div className="mb-4 d-flex flex-wrap gap-2">
          {unregisteredAnnouncements.length > 0 && (
            <Badge color="warning" className="p-2 text-dark">
              Belum daftar: {unregisteredAnnouncements.map((a) => a.title).join(', ')}
            </Badge>
          )}
          {pendingAnnouncements.length > 0 && (
            <Badge color="info" className="p-2">
              Menunggu verifikasi: {pendingAnnouncements.map((a) => a.title).join(', ')}
            </Badge>
          )}
          {rejectedAnnouncements.length > 0 && (
            <Badge color="danger" className="p-2">
              Ditolak: {rejectedAnnouncements.map((a) => a.title).join(', ')}
            </Badge>
          )}
        </div>
      )}

      {showAdminNav && (
        <>
          <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
            Butuh tindakan
          </h2>
          <div className="app-page-card p-3 p-md-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
              <div>
                <strong>Pendaftaran menunggu</strong>
                <div className="small text-muted">{pendingRegs.length} antrian</div>
              </div>
              <Button color="primary" size="sm" outline onClick={() => navigate('/bazaar-management')}>
                Buka halaman penuh
              </Button>
            </div>
            {pendingRegs.length === 0 ? (
              <p className="text-muted small mb-0">Tidak ada pendaftaran pending.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {pendingRegs.slice(0, 5).map((r) => {
                  const ann = announcementById[r.announcementId]
                  const busy = quickLoading === r.id
                  return (
                    <li
                      key={r.id}
                      className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 py-2 border-bottom border-light"
                    >
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold text-truncate">{r.supplierName || 'Supplier'}</div>
                        <div className="small text-muted text-truncate">
                          {ann?.title || 'Pengumuman'} · {ann?.weekCode || ''}
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          color="success"
                          disabled={busy}
                          onClick={() => quickApprove(r)}
                          className="d-flex align-items-center gap-1"
                        >
                          <Check size={16} /> Setujui
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          outline
                          disabled={busy}
                          onClick={() => quickReject(r)}
                          className="d-flex align-items-center gap-1"
                        >
                          <X size={16} /> Tolak
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {pendingRegs.length > 5 && (
              <p className="small text-muted mt-2 mb-0">Menampilkan 5 pertama. Sisanya di kelola pendaftaran.</p>
            )}
          </div>

          <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
            Modul
          </h2>
          <div className="app-teaser-grid mb-4">
            <div className="app-teaser">
              <Calendar className="text-app-primary mb-2" size={22} />
              <h6>Minggu online</h6>
              <p className="hint">Kelola pesanan dan minggu online.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/week')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Activity className="text-app-primary mb-2" size={22} />
              <h6>Minggu offline</h6>
              <p className="hint">Kelola pesanan dan minggu offline.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/weekoffline')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Clipboard className="text-app-primary mb-2" size={22} />
              <h6>Invoice customer</h6>
              <p className="hint">Kelola invoice untuk customer.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/customer-invoice')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <ShoppingCart className="text-app-primary mb-2" size={22} />
              <h6>Invoice supplier</h6>
              <p className="hint">Kelola invoice untuk supplier.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/supplier-invoice')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Calendar className="text-app-primary mb-2" size={22} />
              <h6>Pengumuman bazaar</h6>
              <p className="hint">
                <span className="app-stat-pill me-1">{activeAnnouncementsCount} aktif</span> Jadwal &
                kuota.
              </p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-announcement')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Clipboard className="text-app-primary mb-2" size={22} />
              <h6>Kelola pendaftaran</h6>
              <p className="hint">
                <span className="app-stat-pill me-1">{pendingRegs.length} pending</span> Verifikasi
                supplier.
              </p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-management')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Users className="text-app-primary mb-2" size={22} />
              <h6>Master supplier</h6>
              <p className="hint">Kelola direktori supplier dan produk master.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/master-supplier')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Package className="text-app-primary mb-2" size={22} />
              <h6>Produk per bazaar</h6>
              <p className="hint">Snapshot produk terverifikasi per bazaar.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-products')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <BarChart2 className="text-app-primary mb-2" size={22} />
              <h6>Grafik bazaar</h6>
              <p className="hint">Ringkasan performa lintas minggu.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-charts')}>
                Buka
              </Button>
            </div>
          </div>
        </>
      )}

      {showSupplierNav && (
        <>
          <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
            Modul supplier
          </h2>
          <div className="app-teaser-grid mb-4">
            <div className="app-teaser">
              <ShoppingCart className="text-app-primary mb-2" size={22} />
              <h6>Produk saya</h6>
              <p className="hint">Katalog yang Anda pasok ke bazaar.</p>
              <Button color="primary" size="sm" onClick={() => navigate(`/data-supplier/${user.name}`)}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Users className="text-app-primary mb-2" size={22} />
              <h6>Direktori supplier</h6>
              <p className="hint">Lihat supplier & produk lain (read-only).</p>
              <Button color="primary" size="sm" onClick={() => navigate('/master-supplier')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Clipboard className="text-app-primary mb-2" size={22} />
              <h6>Daftar bazaar</h6>
              <p className="hint">Ikut serta pada pengumuman yang masih buka.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-registration')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <BarChart2 className="text-app-primary mb-2" size={22} />
              <h6>Grafik bazaar</h6>
              <p className="hint">Visualisasi agregat (jika tersedia untuk Anda).</p>
              <Button color="primary" size="sm" onClick={() => navigate('/bazaar-charts')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <Clipboard className="text-app-primary mb-2" size={22} />
              <h6>Invoice customer</h6>
              <p className="hint">Kelola invoice untuk customer.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/customer-invoice')}>
                Buka
              </Button>
            </div>
            <div className="app-teaser">
              <ShoppingCart className="text-app-primary mb-2" size={22} />
              <h6>Invoice supplier</h6>
              <p className="hint">Kelola invoice untuk supplier.</p>
              <Button color="primary" size="sm" onClick={() => navigate('/supplier-invoice')}>
                Buka
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard