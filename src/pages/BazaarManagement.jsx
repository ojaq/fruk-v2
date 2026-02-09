import React, { useState, useEffect } from 'react'
import { Button, Col, Input, Label, Row, Modal, ModalHeader, ModalBody, ModalFooter, Card, CardBody, CardHeader, Form, FormGroup, Alert, Badge, Spinner } from 'reactstrap'
import Swal from 'sweetalert2'
import DataTable from 'react-data-table-component'
import { Edit, Trash2, Eye, Check, X, Download } from 'react-feather'
import { useAuth } from '../context/AuthContext'
import { logBazaarAction } from '../context/AuthContext'
import Select from 'react-select'
import moment from 'moment'
import 'moment/locale/id'
moment.locale('id')
import { supabase } from '../supabaseClient'

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
function formatDateID(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
}
function formatDateTimeID(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const jam = d.getHours().toString().padStart(2, '0')
  const menit = d.getMinutes().toString().padStart(2, '0')
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()} ${jam}:${menit}`
}

const BazaarManagement = () => {
  const { user, bazaarData, saveBazaarData, registeredUsers } = useAuth()
  const [registrations, setRegistrations] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState(null)
  const [editIndex, setEditIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterAnnouncement, setFilterAnnouncement] = useState(null)
  const [filterStatus, setFilterStatus] = useState(null)
  const [editingRegistration, setEditingRegistration] = useState(null)
  const [filterParticipation, setFilterParticipation] = useState('all')
  const [fixModalOpen, setFixModalOpen] = useState(false)
  const [missingRegistrations, setMissingRegistrations] = useState([])
  const [checkingFix, setCheckingFix] = useState(false)
  const [selectedFixReg, setSelectedFixReg] = useState(null)
  const [selectedFixIds, setSelectedFixIds] = useState(new Set())

  const [form, setForm] = useState({
    status: '',
    adminNotes: ''
  })

  useEffect(() => {
    if (bazaarData) {
      setRegistrations((bazaarData.registrations || []).filter(Boolean))
      setAnnouncements((bazaarData.announcements || []).filter(Boolean))
    }
  }, [bazaarData])

  const handleSave = async () => {
    setLoading(true)

    try {
      const { status, adminNotes } = form

      if (!status) {
        Swal.fire('Error', 'Status wajib dipilih!', 'error')
        setLoading(false)
        return
      }

      if (status === 'rejected' && (!adminNotes || !adminNotes.trim())) {
        Swal.fire('Error', 'Alasan penolakan wajib diisi jika status Ditolak!', 'error')
        setLoading(false)
        return
      }

      const updated = [...registrations]
      if (editIndex !== null && editingRegistration) {
        const actualIndex = registrations.findIndex(r => r?.id === editingRegistration?.id)
        if (actualIndex !== -1) {
          await logBazaarAction({
            user,
            action: 'edit',
            target: 'registration',
            targetId: editingRegistration?.id,
            dataBefore: registrations[actualIndex],
            dataAfter: {
              ...registrations[actualIndex],
              status: form.status,
              adminNotes: form.adminNotes,
              updatedAt: new Date().toISOString(),
              reviewedBy: user.name
            },
            description: `Edit registration status to ${form.status}`
          })
          updated[actualIndex] = {
            ...updated[actualIndex],
            status: form.status,
            adminNotes: form.adminNotes,
            updatedAt: new Date().toISOString(),
            reviewedBy: user.name
          }
        } else {
          await logBazaarAction({
            user,
            action: 'edit',
            target: 'registration',
            targetId: editingRegistration?.id,
            dataBefore: updated[editIndex],
            dataAfter: {
              ...updated[editIndex],
              status: form.status,
              adminNotes: form.adminNotes,
              updatedAt: new Date().toISOString(),
              reviewedBy: user.name
            },
            description: `Edit registration status to ${form.status}`
          })
          updated[editIndex] = {
            ...updated[editIndex],
            status: form.status,
            adminNotes: form.adminNotes,
            updatedAt: new Date().toISOString(),
            reviewedBy: user.name
          }
        }
      }

      await saveBazaarData({ ...bazaarData, registrations: updated })

      Swal.fire('Berhasil', 'Status pendaftaran berhasil diubah', 'success')

      setForm({
        status: '',
        adminNotes: ''
      })
      setEditIndex(null)
      setEditingRegistration(null)
      setModalOpen(false)
    } catch (error) {
      console.error('Error updating registration:', error)
      Swal.fire('Error', 'Gagal mengubah status pendaftaran', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row) => {
    setForm({
      status: row?.status,
      adminNotes: row?.adminNotes || ''
    })
    const idx = registrations.findIndex(r => r?.id === row?.id)
    setEditIndex(idx)
    setEditingRegistration(row)
    setModalOpen(true)
  }

  const handleCheckMissingRegistrations = async () => {
    if (!filterAnnouncement?.value) {
      Swal.fire('Error', 'Pilih bazaar terlebih dahulu untuk memulai pengecekan.', 'error')
      return
    }
    setCheckingFix(true)
    try {
      const { data: allBazaarData, error: fetchError } = await supabase
        .from('bazaar_data')
        .select('data')

      if (fetchError) throw new Error('Gagal mengambil data bazaar')

      let freshRegistrations = []

      for (const item of allBazaarData) {
        const anns = item?.data?.announcements || []
        const regs = item?.data?.registrations || []

        const isMatched = anns.some(a => a?.id === filterAnnouncement.value)
        if (isMatched) {
          freshRegistrations = regs
          break
        }
      }

      const { data: logs, error } = await supabase
        .from('bazaar_logs')
        .select('*')
        .eq('action', 'add')
        .eq('target', 'registration')
        .order('timestamp', { ascending: false })

      if (error) throw new Error('Gagal mengambil log pendaftaran')

      const existingMap = new Set(
        freshRegistrations.map(r => `${r?.announcementId}|${r?.supplierName}`)
      )

      const seen = new Set()
      const found = []
      for (const log of logs) {
        const after = log.data_after ? JSON.parse(log.data_after) : null
        if (!after) continue
        if (after.announcementId !== filterAnnouncement.value) continue
        const key = `${after.announcementId}|${after.supplierName}`
        if (!seen.has(key) && !existingMap.has(key)) {
          found.push(after)
          seen.add(key)
        }
      }

      setMissingRegistrations(found)
      setSelectedFixIds(new Set(found.map(r => r?.id)))
      setSelectedFixReg(null)
      setFixModalOpen(true)
    } catch (err) {
      console.error('Fixer check failed:', err)
      Swal.fire('Error', err.message, 'error')
    } finally {
      setCheckingFix(false)
    }
  }

  const handleAddMissingRegistrations = async () => {
    try {
      const selectedData = missingRegistrations.filter(r => selectedFixIds.has(r?.id))
      const updated = [...registrations, ...selectedData]
      await saveBazaarData({ ...bazaarData, registrations: updated })

      for (const reg of selectedData) {
        await logBazaarAction({
          user,
          action: 'restore',
          target: 'registration',
          targetId: reg?.id,
          dataBefore: null,
          dataAfter: reg,
          description: 'Restored missing registration via fixer tool'
        })
      }

      Swal.fire('Berhasil', 'Pendaftaran berhasil dipulihkan', 'success')
      setFixModalOpen(false)
    } catch (err) {
      console.error('Restore failed:', err)
      Swal.fire('Error', 'Gagal memulihkan pendaftaran', 'error')
    }
  }

  const handleView = (row) => {
    setSelectedRegistration(row)
    setViewModalOpen(true)
  }

  const handleQuickApprove = async (row) => {
    const result = await Swal.fire({
      title: 'Setujui pendaftaran?',
      text: 'Pendaftaran ini akan disetujui.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Setujui',
      cancelButtonText: 'Batal'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const updated = [...registrations]
      const idx = registrations.findIndex(r => r?.id === row?.id)
      if (idx === -1) throw new Error('Registration not found')
      await logBazaarAction({
        user,
        action: 'edit',
        target: 'registration',
        targetId: row?.id,
        dataBefore: registrations[idx],
        dataAfter: {
          ...registrations[idx],
          status: 'approved',
          updatedAt: new Date().toISOString(),
          reviewedBy: user.name
        },
        description: 'Quick approve registration'
      })
      updated[idx] = {
        ...updated[idx],
        status: 'approved',
        updatedAt: new Date().toISOString(),
        reviewedBy: user.name
      }

      await saveBazaarData({ ...bazaarData, registrations: updated })
      Swal.fire('Berhasil', 'Pendaftaran berhasil disetujui', 'success')
    } catch (error) {
      console.error('Error approving registration:', error)
      Swal.fire('Error', 'Gagal menyetujui pendaftaran', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickReject = async (row) => {
    const { value: reason } = await Swal.fire({
      title: 'Tolak pendaftaran?',
      text: 'Masukkan alasan penolakan untuk supplier.',
      input: 'textarea',
      inputPlaceholder: 'Alasan penolakan...',
      inputAttributes: { maxlength: 200 },
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Alasan penolakan wajib diisi!'
        }
      }
    })

    if (!reason) return

    setLoading(true)
    try {
      const updated = [...registrations]
      const idx = registrations.findIndex(r => r?.id === row?.id)
      if (idx === -1) throw new Error('Registration not found')
      await logBazaarAction({
        user,
        action: 'edit',
        target: 'registration',
        targetId: row?.id,
        dataBefore: registrations[idx],
        dataAfter: {
          ...registrations[idx],
          status: 'rejected',
          adminNotes: reason,
          updatedAt: new Date().toISOString(),
          reviewedBy: user.name
        },
        description: 'Quick reject registration'
      })
      updated[idx] = {
        ...updated[idx],
        status: 'rejected',
        adminNotes: reason,
        updatedAt: new Date().toISOString(),
        reviewedBy: user.name
      }

      await saveBazaarData({ ...bazaarData, registrations: updated })
      Swal.fire('Berhasil', 'Pendaftaran berhasil ditolak', 'success')
    } catch (error) {
      console.error('Error rejecting registration:', error)
      Swal.fire('Error', 'Gagal menolak pendaftaran', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: `Hapus pendaftaran?`,
      text: 'Pendaftaran ini akan dihapus secara permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const actualIndex = registrations.findIndex(r => r?.id === row?.id)
      if (actualIndex === -1) {
        Swal.fire('Error', 'Data tidak ditemukan', 'error')
        return
      }
      await logBazaarAction({
        user,
        action: 'delete',
        target: 'registration',
        targetId: row?.id,
        dataBefore: registrations[actualIndex],
        dataAfter: null,
        description: 'Delete registration'
      })
      const updated = [...registrations]
      updated.splice(actualIndex, 1)
      await saveBazaarData({ ...bazaarData, registrations: updated })
      Swal.fire('Dihapus!', 'Pendaftaran berhasil dihapus.', 'success')
    } catch (error) {
      console.error('Error deleting registration:', error)
      Swal.fire('Error', 'Gagal menghapus pendaftaran', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'warning', text: 'Menunggu' },
      approved: { color: 'success', text: 'Disetujui' },
      rejected: { color: 'danger', text: 'Ditolak' }
    }
    const badge = badges[status] || badges.pending
    return <span className={`badge bg-${badge.color}`}>{badge.text}</span>
  }

  const getParticipationBadge = (registration) => {
    const badges = []
    if (registration?.participateOnline) badges.push(<span key="online" className="badge bg-primary me-1">Online</span>)
    if (registration?.participateOffline) badges.push(<span key="offline" className="badge bg-info me-1">Offline</span>)
    return badges
  }

  const columns = [
    {
      name: 'No',
      selector: (row, i) => i + 1,
      width: '60px',
      wrap: true
    },
    {
      name: 'Supplier',
      selector: row => row?.supplierName,
      sortable: true,
      wrap: true
    },
    {
      name: 'Bazaar',
      selector: row => {
        const announcement = announcements.find(a => a?.id === row?.announcementId)
        return announcement ? announcement.title : 'N/A'
      },
      sortable: true,
      wrap: true
    },
    {
      name: 'Partisipasi',
      cell: row => getParticipationBadge(row),
      width: '150px',
      wrap: true
    },
    {
      name: 'Jumlah Produk',
      selector: row => {
        if (row?.selectedProductsOnline?.length || row?.selectedProductsOffline?.length) {
          let count = 0
          if (row?.selectedProductsOnline) count += row?.selectedProductsOnline.length
          if (row?.selectedProductsOffline) count += row?.selectedProductsOffline.length
          return count
        }
        return row?.selectedProducts?.length || 0
      },
      sortable: true,
      width: '150px',
      wrap: true
    },
    {
      name: 'Status',
      cell: row => getStatusBadge(row?.status),
      width: '80px',
      wrap: true
    },
    {
      name: 'Tanggal Daftar',
      selector: row => formatDateID(row?.createdAt),
      sortable: true,
      width: '150px',
      wrap: true
    },
    {
      name: 'Aksi',
      cell: (row) => (
        <>
          <Button size="sm" color="info" className="me-2" onClick={() => handleView(row)} disabled={loading}>
            <Eye size={16} />
          </Button>
          <Button size="sm" color="warning" className="me-2" onClick={() => handleEdit(row)} disabled={loading}>
            <Edit size={16} />
          </Button>
          {row?.status === 'pending' && (
            <>
              <Button size="sm" color="success" className="me-2" onClick={() => handleQuickApprove(row)} disabled={loading}>
                <Check size={16} />
              </Button>
              <Button size="sm" color="danger" className="me-2" onClick={() => handleQuickReject(row)} disabled={loading}>
                <X size={16} />
              </Button>
            </>
          )}
          <Button size="sm" color="danger" onClick={() => handleDelete(row)} disabled={loading}>
            <Trash2 size={16} />
          </Button>
        </>
      ),
      width: '250px',
      wrap: true
    }
  ]

  const announcementOptions = (announcements || []).filter(Boolean).map(a => ({
    label: a?.title || 'N/A',
    value: a?.id
  }))

  const statusOptions = [
    { label: 'Menunggu', value: 'pending' },
    { label: 'Disetujui', value: 'approved' },
    { label: 'Ditolak', value: 'rejected' }
  ]

  const filteredData = (registrations || []).filter(item => {
    const announcement = (announcements || []).find(a => a?.id === item?.announcementId)
    const announcementTitle = announcement ? announcement.title : ''
    const loweredSearch = (searchText || '').toLowerCase()
    const matchSearch = (announcementTitle || '').toLowerCase().includes(loweredSearch) ||
      ((item?.supplierName || '').toLowerCase().includes(loweredSearch)) ||
      ((item?.notes || '').toLowerCase().includes(loweredSearch))
    const matchAnnouncement = filterAnnouncement ? item?.announcementId === filterAnnouncement.value : true
    const matchStatus = filterStatus ? item?.status === filterStatus.value : true
    const matchParticipation =
      filterParticipation === 'all' ? true :
        filterParticipation === 'online' ? item?.participateOnline :
          filterParticipation === 'offline' ? item?.participateOffline : true
    return matchSearch && matchAnnouncement && matchStatus && matchParticipation
  })

  const stats = {
    total: filteredData.length,
    pending: filteredData.filter(r => r?.status === 'pending').length,
    approved: filteredData.filter(r => r?.status === 'approved').length,
    rejected: filteredData.filter(r => r?.status === 'rejected').length
  }
  const onlineCount = filteredData.filter(r => r?.participateOnline).length
  const offlineCount = filteredData.filter(r => r?.participateOffline).length

  const handleExportCSV = () => {
    try {
      const headers = [
        'Nama Supplier',
        'Bazaar',
        'Partisipasi Online',
        'Partisipasi Offline',
        'Jenis Partisipasi',
        'Nama Produk',
        'Jenis Produk',
        'Ukuran',
        'Satuan',
        'HPP',
        'HJK',
        'Keterangan Produk',
        'Label Produk',
        'Gambar Produk',
        'Catatan Supplier',
        'Catatan Admin'
      ]

      const csvRows = [headers.join(',')]

      filteredData.filter(r => r?.status === 'approved').forEach(registration => {
        const announcement = announcements.find(a => a?.id === registration?.announcementId)
        const bazaarTitle = announcement ? announcement.title : 'N/A'
        const regInfo = [
          registration?.supplierName,
          bazaarTitle,
          registration?.participateOnline ? 'Ya' : 'Tidak',
          registration?.participateOffline ? 'Ya' : 'Tidak',
        ]
        const regTail = [
          registration?.notes || '',
          registration?.adminNotes || ''
        ]
        const escapeCSV = (value) => {
          if (value === undefined || value === null) return ''
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }
        const formatPrice = (val) => {
          const num = parseFloat(val)
          if (!num || num <= 0) return ''
          const adjusted = num < 1000 ? num * 1000 : num
          return `Rp${adjusted.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
        }
        const pushProductRow = (product, partisipasi) => {
          if (!product) return
          const d = product.data || {}
          const row = [
            regInfo[0], // Nama Supplier
            regInfo[1], // Bazaar
            regInfo[2], // Partisipasi Online
            regInfo[3], // Partisipasi Offline
            partisipasi, // Jenis Partisipasi
            d.namaProduk || '',
            d.jenisProduk || '',
            d.ukuran || '',
            d.satuan || '',
            formatPrice(d.hpp),
            formatPrice(d.hjk),
            d.keterangan || '',
            product.label || '',
            d.imageUrl || '',
            regTail[0], // Catatan Supplier
            regTail[1]  // Catatan Admin
          ]
          csvRows.push(row?.map(escapeCSV).join(','))
        }
        let hasProduct = false
        if (registration?.selectedProductsOnline && registration?.selectedProductsOnline.length > 0) {
          registration?.selectedProductsOnline.forEach(product => {
            pushProductRow(product, 'Online')
            hasProduct = true
          })
        }
        if (registration?.selectedProductsOffline && registration?.selectedProductsOffline.length > 0) {
          registration?.selectedProductsOffline.forEach(product => {
            pushProductRow(product, 'Offline')
            hasProduct = true
          })
        }
        if (!hasProduct && registration?.selectedProducts && registration?.selectedProducts.length > 0) {
          registration?.selectedProducts.forEach(product => {
            if (registration?.participateOnline) {
              pushProductRow(product, 'Online')
              hasProduct = true
            }
            if (registration?.participateOffline) {
              pushProductRow(product, 'Offline')
              hasProduct = true
            }
          })
        }
        if (!hasProduct) {
          const emptyProduct = { data: {} }
          pushProductRow(emptyProduct, '')
        }
      })

      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `bazaar_registrations_${moment().format('YYYY-MM-DD_HH-mm')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      Swal.fire('Berhasil', 'Data berhasil diekspor ke CSV', 'success')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      Swal.fire('Error', 'Gagal mengekspor data ke CSV', 'error')
    }
  }

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>Manajemen Pendaftaran Bazaar</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
          <Button className="me-3" color="info" onClick={handleCheckMissingRegistrations} disabled={checkingFix}>
            {checkingFix ? <Spinner size="sm" /> : '🔍 Cek Pendaftaran Hilang'}
          </Button>
          <Button className="me-3" color="success" onClick={handleExportCSV} disabled={loading}>
            <Download size={16} className="me-1" />
            Export CSV
          </Button>
          <Button className="me-3" color="danger" onClick={() => {
            setSearchText('')
            setFilterAnnouncement(null)
            setFilterStatus(null)
            setFilterParticipation('')
          }} disabled={loading}>
            Reset Filter
          </Button>
          <Button color="warning" onClick={() => window.history.back()} disabled={loading}>
            Kembali
          </Button>
        </Col>
      </Row>

      {/* Cards */}
      <Row className="mb-2">
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-primary">
              <h3 className="text-white">{stats.total}</h3>
              <small className="text-white fw-bolder">Total Pendaftaran</small>
            </CardBody>
          </Card>
        </Col>
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-warning">
              <h3 className="text-white">{stats.pending}</h3>
              <small className="text-white fw-bolder">Menunggu</small>
            </CardBody>
          </Card>
        </Col>
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-success">
              <h3 className="text-white">{stats.approved}</h3>
              <small className="text-white fw-bolder">Disetujui</small>
            </CardBody>
          </Card>
        </Col>
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-danger">
              <h3 className="text-white">{stats.rejected}</h3>
              <small className="text-white fw-bolder">Ditolak</small>
            </CardBody>
          </Card>
        </Col>
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-primary">
              <h3 className="text-white">{onlineCount}</h3>
              <small className="text-white fw-bolder">Online</small>
            </CardBody>
          </Card>
        </Col>
        <Col xs="6" md="2" className="mb-3">
          <Card className="text-center">
            <CardBody className="bg-info">
              <h3 className="text-white">{offlineCount}</h3>
              <small className="text-white fw-bolder">Offline</small>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col xs="12" md="3" className="mb-2 mb-md-0">
          <Input
            placeholder="🔍 Cari pendaftaran..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            disabled={loading}
          />
        </Col>
        <Col xs="12" md="3" className="mb-2 mb-md-0">
          <Select
            options={announcementOptions}
            placeholder="🔽 Filter Bazaar"
            isClearable
            isSearchable
            value={filterAnnouncement}
            onChange={setFilterAnnouncement}
            isDisabled={loading}
          />
        </Col>
        <Col xs="12" md="3" className="mb-2 mb-md-0">
          <Select
            options={statusOptions}
            placeholder="🔽 Filter Status"
            isClearable
            isSearchable
            value={filterStatus}
            onChange={setFilterStatus}
            isDisabled={loading}
          />
        </Col>
        <Col xs="12" md="3" className="d-flex align-items-center gap-2">
          <Label className="mb-0">Partisipasi:</Label>
          <Input
            type="select"
            value={filterParticipation}
            onChange={e => setFilterParticipation(e.target.value)}
          >
            <option value="all">Semua</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </Input>
        </Col>
      </Row>

      <div className="border overflow-auto" style={{ minHeight: 200 }}>
        <DataTable
          columns={columns}
          data={filteredData}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 25, 50, 100]}
          noDataComponent="Belum ada pendaftaran bazaar"
          responsive
          highlightOnHover
          progressPending={loading}
        />
      </div>

      {/* Edit Modal */}
      <Modal isOpen={modalOpen} toggle={() => setModalOpen(!modalOpen)} centered>
        <ModalHeader toggle={() => setModalOpen(!modalOpen)}>
          Edit Status Pendaftaran
        </ModalHeader>
        <ModalBody>
          <Form>
            <Row>
              <Col xs="12" className="mb-3">
                <Label>Status *</Label>
                <Input
                  type="select"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  disabled={loading}
                >
                  <option value="">Pilih status</option>
                  <option value="pending">Menunggu</option>
                  <option value="approved">Disetujui</option>
                  <option value="rejected">Ditolak</option>
                </Input>
              </Col>
            </Row>

            <Row>
              <Col xs="12" className="mb-3">
                <Label>Catatan Admin</Label>
                <Input
                  type="textarea"
                  rows="3"
                  value={form.adminNotes}
                  onChange={e => setForm({ ...form, adminNotes: e.target.value })}
                  disabled={loading}
                  placeholder="Tambahkan catatan untuk supplier..."
                />
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Loading...' : 'Update'}
          </Button>
          <Button color="secondary" onClick={() => setModalOpen(false)} disabled={loading}>
            Batal
          </Button>
        </ModalFooter>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(!viewModalOpen)} centered size="lg">
        <ModalHeader toggle={() => setViewModalOpen(!viewModalOpen)}>
          Detail Pendaftaran Bazaar
        </ModalHeader>
        <ModalBody>
          {selectedRegistration && (
            <div>
              <Card className="mb-3">
                <CardHeader>
                  <h6>Informasi Pendaftaran</h6>
                </CardHeader>
                <CardBody>
                  <Row>
                    <Col xs="12" md="6">
                      <strong>Supplier:</strong><br />
                      {selectedRegistration?.supplierName}
                    </Col>
                    <Col xs="12" md="6">
                      <strong>Status:</strong><br />
                      {getStatusBadge(selectedRegistration?.status)}
                    </Col>
                  </Row>
                  <Row className="mt-2">
                    <Col xs="12" md="6">
                      <strong>Bazaar:</strong><br />
                      {announcements.find(a => a?.id === selectedRegistration?.announcementId)?.title || 'N/A'}
                    </Col>
                    <Col xs="12" md="6">
                      <strong>Partisipasi:</strong><br />
                      {getParticipationBadge(selectedRegistration)}
                    </Col>
                  </Row>
                  <Row className="mt-2">
                    <Col xs="12">
                      <strong>Produk yang Didaftarkan:</strong><br />
                      <ul className="mt-1">
                        {selectedRegistration?.selectedProductsOnline?.length || selectedRegistration?.selectedProductsOffline?.length
                          ? <>
                            {selectedRegistration?.selectedProductsOnline?.length > 0 && <>
                              <li><strong>Online:</strong></li>
                              {selectedRegistration?.selectedProductsOnline.map((product, index) => (
                                <li key={"on-" + index} style={{ marginLeft: 16 }}>{product.label}</li>
                              ))}
                            </>}
                            {selectedRegistration?.selectedProductsOffline?.length > 0 && <>
                              <li><strong>Offline:</strong></li>
                              {selectedRegistration?.selectedProductsOffline.map((product, index) => (
                                <li key={"off-" + index} style={{ marginLeft: 16 }}>{product.label}</li>
                              ))}
                            </>}
                          </>
                          : selectedRegistration?.selectedProducts?.map((product, index) => (
                            <li key={index}>{product.label}</li>
                          ))}
                      </ul>
                    </Col>
                  </Row>
                  {selectedRegistration?.notes && (
                    <Row className="mt-2">
                      <Col xs="12">
                        <strong>Catatan Supplier:</strong><br />
                        {selectedRegistration?.notes}
                      </Col>
                    </Row>
                  )}
                  {selectedRegistration?.adminNotes && (
                    <Row className="mt-2">
                      <Col xs="12">
                        <strong>Catatan Admin:</strong><br />
                        {selectedRegistration?.adminNotes}
                      </Col>
                    </Row>
                  )}
                  <Row className="mt-2">
                    <Col xs="12" md="6">
                      <small className="text-muted">
                        Didaftarkan pada: {formatDateTimeID(selectedRegistration?.createdAt)}
                      </small>
                    </Col>
                    {selectedRegistration?.reviewedBy && (
                      <Col xs="12" md="6">
                        <small className="text-muted">
                          Direview oleh: {selectedRegistration?.reviewedBy}
                        </small>
                      </Col>
                    )}
                  </Row>
                </CardBody>
              </Card>
            </div>
          )}
        </ModalBody>
      </Modal>

      <Modal isOpen={fixModalOpen} toggle={() => {
        setFixModalOpen(!fixModalOpen)
        setSelectedFixReg(null)
      }} size="lg">
        <ModalHeader toggle={() => setFixModalOpen(!fixModalOpen)}>Data Pendaftaran Hilang</ModalHeader>
        <ModalBody>
          {missingRegistrations.length === 0 ? (
            <Alert color="success">Tidak ada data yang hilang</Alert>
          ) : (
            <>
              <p>Ditemukan <strong>{missingRegistrations.length}</strong> pendaftaran yang belum tercatat:</p>
              <ul className="list-unstyled">
                {missingRegistrations.map((reg, i) => (
                  <li key={reg?.id} className="mb-2">
                    <Input
                      type="checkbox"
                      checked={selectedFixIds.has(reg?.id)}
                      onChange={e => {
                        const copy = new Set(selectedFixIds)
                        if (e.target.checked) copy.add(reg?.id)
                        else copy.delete(reg?.id)
                        setSelectedFixIds(copy)
                      }}
                      className="me-2"
                    />
                    <b>{reg.supplierName}</b>{' '}
                    <Eye size={20} style={{ cursor: 'pointer' }} onClick={() => setSelectedFixReg(reg)} />{' '}
                    ({formatDateID(reg.createdAt)})
                  </li>
                ))}
              </ul>
            </>
          )}
          {selectedFixReg && (
            <div className="mt-4">
              <h6>Detail Pendaftaran</h6>
              <div className="border p-2 bg-light rounded" style={{ overflow: 'auto' }}>
                <p><strong>Nama:</strong> {selectedFixReg.supplierName}</p>
                <p><strong>Online:</strong> {selectedFixReg.participateOnline ? 'Ya' : 'Tidak'}</p>
                <p><strong>Offline:</strong> {selectedFixReg.participateOffline ? 'Ya' : 'Tidak'}</p>
                <p><strong>Catatan:</strong> {selectedFixReg.notes || '-'}</p>
                <p><strong>Produk:</strong></p>
                <ul>
                  {(selectedFixReg.selectedProducts || []).map((p, i) => (
                    <li key={i}>{p.label}</li>
                  ))}
                  {(selectedFixReg.selectedProductsOnline || []).map((p, i) => (
                    <li key={`on-${i}`}>{p.label} <small>(Online)</small></li>
                  ))}
                  {(selectedFixReg.selectedProductsOffline || []).map((p, i) => (
                    <li key={`off-${i}`}>{p.label} <small>(Offline)</small></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {missingRegistrations.length > 0 && (
            <Button color="primary" onClick={handleAddMissingRegistrations}>Tambahkan ke Registrasi</Button>
          )}
          <Button color="secondary" onClick={() => {
            setFixModalOpen(false)
            setSelectedFixReg(null)
          }}>Tutup</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default BazaarManagement 