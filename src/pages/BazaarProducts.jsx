import React, { useEffect, useState } from 'react'
import { Button, Col, Input, Label, Row, Modal, ModalBody, FormGroup, Badge } from 'reactstrap'
import DataTable from 'react-data-table-component'
import Select from 'react-select'
import { useAuth } from '../context/AuthContext'

const BazaarProducts = () => {
  const { bazaarData } = useAuth()
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [participationFilter, setParticipationFilter] = useState('all')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [imagePreview, setImagePreview] = useState({ open: false, url: '' })
  const [supplierFilter, setSupplierFilter] = useState(null)
  const [jenisFilter, setJenisFilter] = useState(null)

  const announcementOptions = (bazaarData.announcements || []).map(a => ({
    label: a.title,
    value: a.id,
    data: a
  }))

  useEffect(() => {
    if (!selectedAnnouncement) {
      setProducts([])
      return
    }
    setLoading(true)
    const regs = (bazaarData.registrations || []).filter(r => r?.announcementId === selectedAnnouncement.value && r?.status === 'approved')
    let allProducts = []
    regs.forEach(reg => {
      if ((participationFilter === 'all' || participationFilter === 'online') && reg.participateOnline) {
        const arr = reg.selectedProductsOnline?.length ? reg.selectedProductsOnline : reg.selectedProducts
        if (arr && arr.length) {
          arr.forEach(prod => {
            allProducts.push({
              ...prod,
              supplierName: reg.supplierName,
              participation: 'online',
              jenisProduk: prod.data?.jenisProduk || prod.jenisProduk || '',
              ukuran: prod.data?.ukuran || prod.ukuran || '',
              satuan: prod.data?.satuan || prod.satuan || '',
              hpp: prod.data?.hpp || prod.hpp || '',
              hjk: prod.data?.hjk || prod.hjk || '',
              keterangan: prod.data?.keterangan || prod.keterangan || '',
              imageUrl: prod.data?.imageUrl || prod.imageUrl || ''
            })
          })
        }
      }
      if ((participationFilter === 'all' || participationFilter === 'offline') && reg.participateOffline) {
        const arr = reg.selectedProductsOffline?.length ? reg.selectedProductsOffline : reg.selectedProducts
        if (arr && arr.length) {
          arr.forEach(prod => {
            allProducts.push({
              ...prod,
              supplierName: reg.supplierName,
              participation: 'offline',
              jenisProduk: prod.data?.jenisProduk || prod.jenisProduk || '',
              ukuran: prod.data?.ukuran || prod.ukuran || '',
              satuan: prod.data?.satuan || prod.satuan || '',
              hpp: prod.data?.hpp || prod.hpp || '',
              hjk: prod.data?.hjk || prod.hjk || '',
              keterangan: prod.data?.keterangan || prod.keterangan || '',
              imageUrl: prod.data?.imageUrl || prod.imageUrl || ''
            })
          })
        }
      }
    })
    setProducts(allProducts)
    setLoading(false)
  }, [selectedAnnouncement, participationFilter, bazaarData])

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

  const getParticipationBadge = (type) => {
    if (type === 'online') return <Badge color="primary" className="me-1">Online</Badge>
    if (type === 'offline') return <Badge color="info">Offline</Badge>
    return null
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
      width: "200px",
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
      width: '120px',
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
      width: '120px',
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
      width: '100px',
      wrap: true
    },
    {
      name: 'Partisipasi',
      cell: row => getParticipationBadge(row.participation),
      width: '100px',
      wrap: true
    }
  ]

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>Produk Bazaar per Pengumuman</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
          <Button color="danger" className="me-2" onClick={() => {
            setSearchText('');
            setSupplierFilter(null);
            setJenisFilter(null);
            setParticipationFilter('all');
          }}>
            Reset Filter
          </Button>
          <Button color="warning" onClick={() => window.history.back()}>
            Kembali
          </Button>
        </Col>
      </Row>
      <Row className="mb-3">
        <Col xs="12" md="3" className="mb-2 mb-md-0">
          <Label>Pilih Pengumuman Bazaar</Label>
          <Select
            options={announcementOptions}
            value={selectedAnnouncement}
            onChange={setSelectedAnnouncement}
            placeholder="Pilih pengumuman..."
            isClearable
            isSearchable
            isDisabled={loading}
          />
        </Col>
        <Col xs="12" md="2" className="mb-2 mb-md-0 d-flex align-items-end">
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
        <Col xs="12" md="2" className="mb-2 mb-md-0 d-flex align-items-end">
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
        <Col xs="12" md="2" className="mb-2 mb-md-0 d-flex align-items-end">
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