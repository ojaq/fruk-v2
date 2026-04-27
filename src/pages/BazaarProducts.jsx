import React, { useEffect, useMemo, useState } from 'react'
import { Button, Col, Input, Label, Row, Modal, ModalBody, FormGroup, Badge } from 'reactstrap'
import DataTable from 'react-data-table-component'
import Select from 'react-select'
import { useAuth } from '../context/AuthContext'
import { useAppUi } from '../context/AppUiContext'

const BazaarProducts = () => {
  const { bazaarData, orders } = useAuth()
  const { currentWeek } = useAppUi()
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [participationFilter, setParticipationFilter] = useState('all')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [imagePreview, setImagePreview] = useState({ open: false, url: '' })
  const [supplierFilter, setSupplierFilter] = useState(null)
  const [jenisFilter, setJenisFilter] = useState(null)

  const announcementOptions = useMemo(() => (
    (bazaarData.announcements || []).map(a => ({
      label: a.title,
      value: a.id,
      data: a
    }))
  ), [bazaarData])

  const currentWeekAnnouncement = useMemo(() => {
    if (!currentWeek) return null
    const weekCode = `W${currentWeek}`
    const byStatus = (bazaarData.announcements || []).find(a => a.weekCode === weekCode && !a.isDeleted && a.status === 'active')
    if (byStatus) return byStatus
    return (bazaarData.announcements || []).find(a => a.weekCode === weekCode && !a.isDeleted) || null
  }, [bazaarData, currentWeek])

  const effectiveAnnouncement = selectedAnnouncement || announcementOptions.find(opt => opt.value === currentWeekAnnouncement?.id) || null

  useEffect(() => {
    if (!effectiveAnnouncement) {
      setProducts([])
      return
    }

    setLoading(true)
    const regs = (bazaarData.registrations || [])
      .filter(r => r?.announcementId === effectiveAnnouncement.value && r?.status === 'approved')

    let allProducts = []

    regs.forEach(reg => {
      (reg.registrationProducts || []).forEach(prod => {
        const isOnline = prod.channel === 'online' || prod.channel === 'both'
        const isOffline = prod.channel === 'offline' || prod.channel === 'both'

        let participation = []

        if (participationFilter === 'all') {
          if (isOnline && reg.participateOnline) participation.push('online')
          if (isOffline && reg.participateOffline) participation.push('offline')
        } else if (participationFilter === 'online') {
          if (isOnline && reg.participateOnline) participation.push('online')
        } else if (participationFilter === 'offline') {
          if (isOffline && reg.participateOffline) participation.push('offline')
        }

        if (participation.length > 0) {
          allProducts.push({
            ...prod,
            supplierName: reg.supplierName,
            participation,
            offline_stock: prod.offline_stock || 0,
            jenisProduk: prod.jenisProduk || '',
            ukuran: prod.ukuran || '',
            satuan: prod.satuan || '',
            hpp: prod.hpp || '',
            hjk: prod.hjk || '',
            keterangan: prod.keterangan || '',
            imageUrl: prod.imageUrl || ''
          })
        }
      })
    })

    setProducts(allProducts)
    setLoading(false)
  }, [effectiveAnnouncement, participationFilter, bazaarData])

  const filteredProducts = products.filter(item => {
    return (
      (item.supplierName?.toLowerCase().includes(searchText.toLowerCase()) ||
        (item.label || item.namaProduk || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (item.jenisProduk || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (item.keterangan || '').toLowerCase().includes(searchText.toLowerCase()))
    )
  })
  const supplierOptions = Array.from(new Set(filteredProducts.map(p => p.supplierName))).map(s => ({ label: s, value: s }))
  const jenisOptions = Array.from(new Set(filteredProducts.map(p => p.jenisProduk))).map(j => ({ label: j, value: j }))

  const filteredByDropdowns = filteredProducts.filter(item => {
    if (supplierFilter && item.supplierName !== supplierFilter.value) return false
    if (jenisFilter && item.jenisProduk !== jenisFilter.value) return false
    return true
  })

  const offlineOrdersByProduct = useMemo(() => {
    const map = new Map()
    const announcementId = effectiveAnnouncement?.value
    if (!announcementId) return map

      ; (orders || []).forEach(order => {
        if (order.channel !== 'offline') return
        if (order.announcement_id !== announcementId) return
        const productId = order.registration_product_id
        if (!productId) return
        const qty = Number(order.jumlah || 0)
        if (!qty) return
        map.set(productId, (map.get(productId) || 0) + qty)
      })

    return map
  }, [orders, effectiveAnnouncement])

  const handleExportCSV = () => {
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

    const headers = [
      'Supplier',
      'Nama Produk',
      'Detail Produk',
      'HPP',
      'HJK',
      'Sisa Offline Stock',
      'Keterangan',
      'Partisipasi',
      'Gambar'
    ]

    const rows = [headers.join(',')]

    filteredByDropdowns.forEach(row => {
      const stock = Number(row.offline_stock || 0)
      const sold = offlineOrdersByProduct.get(row.id) || 0
      const remaining = stock > 0 ? Math.max(stock - sold, 0) : 0
      const stockText = stock > 0 ? `${remaining}/${stock}` : String(sold)
      const detail = `${row.jenisProduk} ${row.ukuran} ${row.satuan}`.trim()
      const part = row.participation?.join(' & ') || ''
      const valueRow = [
        row.supplierName,
        row.label || row.namaProduk || '',
        detail,
        formatPrice(row.hpp),
        formatPrice(row.hjk),
        stockText,
        row.keterangan || '',
        part,
        row.imageUrl || ''
      ]
      rows.push(valueRow.map(escapeCSV).join(','))
    })

    const csvContent = rows.join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    const announcementName = effectiveAnnouncement?.data?.title || 'Bazaar'
    link.setAttribute('download', `Produk Bazaar - ${announcementName}_${timestamp}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getParticipationBadge = (types = []) => {
    return (
      <div className="d-flex flex-column gap-1">
        {types.includes('online') && (
          <Badge color="primary">Online</Badge>
        )}
        {types.includes('offline') && (
          <Badge color="info">Offline</Badge>
        )}
      </div>
    )
  }

  const columns = [
    {
      name: 'Supplier',
      selector: row => row.supplierName,
      sortable: true,
      wrap: true
    },
    {
      name: 'Nama Produk',
      selector: row => row.label || row.namaProduk,
      sortable: true,
      wrap: true
    },
    {
      name: 'Detail Produk',
      selector: row => { return `${row.jenisProduk} ${row.ukuran} ${row.satuan}` },
      sortable: true,
      wrap: true
    },
    {
      name: 'HPP',
      selector: row => {
        const hpp = parseFloat(row.hpp)
        if (!hpp || hpp <= 0) return '-'
        const adjustedValue = hpp < 1000 ? hpp * 1000 : hpp
        return `Rp${adjustedValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      },
      sortable: true,
      wrap: true
    },
    {
      name: 'HJK',
      selector: row => {
        const hjk = parseFloat(row.hjk)
        if (!hjk || hjk <= 0) return '-'
        const adjustedValue = hjk < 1000 ? hjk * 1000 : hjk
        return `Rp${adjustedValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      },
      sortable: true,
      wrap: true
    },
    {
      name: 'Offline Stock',
      selector: row => {
        if (!row.participation?.includes('offline')) return '-'
        const sold = offlineOrdersByProduct.get(row.id) || 0
        const stock = Number(row.offline_stock || 0)
        const remaining = stock > 0 ? Math.max(stock - sold, 0) : 0
        return stock ? `${remaining}/${stock}` : String(sold)
      },
      sortable: true,
      wrap: true
    },
    {
      name: 'Keterangan',
      selector: row => row.keterangan || '-',
      sortable: true,
      wrap: true
    },
    {
      name: 'Gambar',
      cell: row => row.imageUrl ? (
        <img
          src={row.imageUrl}
          alt={row.label || row.namaProduk}
          style={{ width: 60, height: 60, objectFit: 'cover', cursor: 'pointer', borderRadius: 6, border: '1px solid #eee' }}
          onClick={() => setImagePreview({ open: true, url: row.imageUrl })}
        />
      ) : <span className="text-muted">-</span>,
      wrap: true
    },
    {
      name: 'Partisipasi',
      cell: row => getParticipationBadge(row.participation),
      wrap: true
    }
  ]

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>Produk per Bazaar{effectiveAnnouncement ? ` - ${effectiveAnnouncement.data.weekCode || ''} - ${effectiveAnnouncement.data.title || ''}` : ''}</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
          <Button color="success" className="me-2" onClick={handleExportCSV} disabled={loading}>
            Export CSV
          </Button>
          <Button color="danger" className="me-2" onClick={() => {
            setSearchText('');
            setSupplierFilter(null);
            setJenisFilter(null);
            setParticipationFilter('all');
          }}>
            Reset Filter
          </Button>
        </Col>
      </Row>
      <Row className="mb-3">
        <Col xs="12" md="3" className="mb-2 mb-md-0 d-flex align-items-end">
          <FormGroup className="mb-0 w-100">
            <Label>Filter Partisipasi</Label>
            <Input
              type="select"
              value={participationFilter}
              onChange={e => setParticipationFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">Semua</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </Input>
          </FormGroup>
        </Col>
        <Col xs="12" md="3" className="mb-2 mb-md-0 d-flex align-items-end">
          <FormGroup className="mb-0 w-100">
            <Label>Filter Supplier</Label>
            <Select
              options={supplierOptions}
              value={supplierFilter}
              onChange={setSupplierFilter}
              isClearable
              isSearchable
              placeholder="Semua Supplier"
              isDisabled={loading}
            />
          </FormGroup>
        </Col>
        <Col xs="12" md="3" className="mb-2 mb-md-0 d-flex align-items-end">
          <FormGroup className="mb-0 w-100">
            <Label>Filter Jenis Produk</Label>
            <Select
              options={jenisOptions}
              value={jenisFilter}
              onChange={setJenisFilter}
              isClearable
              isSearchable
              placeholder="Semua Jenis"
              isDisabled={loading}
            />
          </FormGroup>
        </Col>
        <Col xs="12" md="3" className="mb-2 mb-md-0 d-flex align-items-end">
          <FormGroup className="mb-0 w-100">
            <Input
              placeholder="🔍 Cari apa aja..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              disabled={loading}
            />
          </FormGroup>
        </Col>
      </Row>
      <div className="border overflow-auto" style={{ minHeight: 200 }}>
        <DataTable
          columns={columns}
          data={filteredByDropdowns}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 25, 50, 100]}
          noDataComponent="Belum ada produk untuk pengumuman ini"
          responsive
          highlightOnHover
          progressPending={loading}
        />
      </div>
      <Modal isOpen={imagePreview.open} toggle={() => setImagePreview({ open: false, url: '' })} centered size="xl">
        <ModalBody className="text-center p-0 bg-dark">
          <img src={imagePreview.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', margin: 'auto', display: 'block' }} />
        </ModalBody>
      </Modal>
    </div>
  )
}

export default BazaarProducts 