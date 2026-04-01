import React, { useEffect, useState } from 'react'
import { Alert, Badge, Button, Col, Form, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap'
import DataTable from 'react-data-table-component'
import { Edit, Trash2 } from 'react-feather'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const WeekOffline = () => {
  const { productData, registeredUsers, bazaarData, user, createOrder, weeks, orders } = useAuth()
  const { num } = useParams()
  const sheetName = `W${num}`

  const [form, setForm] = useState({
    pemesan: '', produkLabel: null, catatan: '', jumlah: '', bayar: '', method: '', status: ''
  })
  const [data, setData] = useState([])
  const [editIndex, setEditIndex] = useState(null)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [produkOptions, setProdukOptions] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedPemesan, setSelectedPemesan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [fixModalOpen, setFixModalOpen] = useState(false)
  const [missingEntries, setMissingEntries] = useState([])
  const [selectedFixIds, setSelectedFixIds] = useState(new Set())
  const [expandedPemesan, setExpandedPemesan] = useState(null)

  const isAllWeek = !num

  const uniquePemesanThisWeek = !isAllWeek
    ? [...new Set((data || []).map(d => d.pemesan))].sort((a, b) => a.localeCompare(b))
    : []

  const currentAnnouncement = (bazaarData.announcements || []).find(a => a.weekCode === sheetName && a.status === 'active')
  const approvedRegs = (bazaarData.registrations || []).filter(r => r?.announcementId === currentAnnouncement?.id && r?.status === 'approved')
  const allowedProducts = []
  approvedRegs.forEach(reg => {
    if (reg.participateOffline) {
      const offlineProducts = (reg.registrationProducts || []).filter(p => {
        const ch = (p.channel || '').toLowerCase()
        return (ch === 'offline' || ch === 'both') && !p.isDeleted
      })
      if (offlineProducts.length) {
        offlineProducts.forEach(prod => {
          allowedProducts.push({
            ...prod,
            owner: reg.supplierName,
            supplierId: reg.supplierId,
            registrationId: reg.id,
            registrationProductId: prod.id
          })
        })
      }
    }
  })


  const mapOrderRow = (o) => {
    const prod = o.registration_products || {}
    const weekCode = weeks.find(w => w.id === o.week_id)?.week_code || ''
    return {
      ...o,
      produkLabel: `${prod.nama_produk || ''} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim(),
      registrationProductId: prod.id,
      registrationId: o.registration_id,
      supplierId: o.supplier_id,
      week: weekCode
    }
  }

  useEffect(() => {
    if (isAllWeek) {
      const sorted = (orders || [])
        .filter(o => o.channel === 'offline')
        .map(mapOrderRow)
        .sort((a, b) => (a.pemesan || '').toLowerCase().localeCompare((b.pemesan || '').toLowerCase()))
      setData(sorted)
    } else {
      const weekId = weeks.find(w => w.week_code === sheetName)?.id
      const filtered = (orders || [])
        .filter(o => o.week_id === weekId && o.channel === 'offline')
        .map(mapOrderRow)
        .sort((a, b) => (a.pemesan || '').toLowerCase().localeCompare((b.pemesan || '').toLowerCase()))
      setData(filtered)
    }
  }, [orders, weeks, sheetName, isAllWeek])

  useEffect(() => {
    if (currentAnnouncement) {

      const opts = allowedProducts.map(prod => ({
        label: `${prod.namaProduk || prod.nama_produk || 'N/A'} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim(),
        value: prod.registrationProductId,
        data: {
          hjk: prod.hjk,
          hpp: prod.hpp,
          namaSupplier: prod.owner,
          namaProduk: prod.namaProduk || prod.nama_produk,
          jenisProduk: prod.jenisProduk || prod.jenis_produk,
          ukuran: prod.ukuran,
          satuan: prod.satuan,
          keterangan: prod.keterangan,
          imageUrl: prod.imageUrl || prod.image_url
        },
        registrationProductId: prod.registrationProductId,
        registrationId: prod.registrationId,
        supplierId: prod.supplierId
      }))
      setProdukOptions(opts)
    } else {
      const all = []
      Object.entries(productData).forEach(([username, items]) => {
        const user = registeredUsers.find(u => u.name === username)
        if (!user) return
        items.forEach((item, i) => {
          if (item.aktif) {
            all.push({
              label: `${item.namaProduk} ${item.ukuran} ${item.satuan}`.trim(),
              value: `${username}-${i}`,
              data: item
            })
          }
        })
      })
      setProdukOptions(all)
    }
  }, [productData, registeredUsers, currentAnnouncement, allowedProducts])

  const getAdjustedHJK = (val) => {
    const num = parseFloat(val)
    if (!num || num <= 0) return 0
    return num < 1000 ? num * 1000 : num
  }

  const handleSelectProduk = option => {
    const harga = option.data.hjk
    const adjustedHJK = getAdjustedHJK(harga)
    setForm(f => ({
      ...f,
      produkLabel: option,
      bayar: f.jumlah ? Number(f.jumlah) * adjustedHJK : '',
      adjustedHJK: adjustedHJK
    }))
  }

  const handleJumlahChange = val => {
    const jumlah = Number(val)
    setForm(f => ({
      ...f,
      jumlah: val,
      bayar: f.produkLabel ? jumlah * getAdjustedHJK(f.produkLabel.data.hjk) : '',
      adjustedHJK: f.produkLabel ? getAdjustedHJK(f.produkLabel.data.hjk) : ''
    }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)

    try {
      const { pemesan, produkLabel, jumlah, method } = form
      if (!pemesan || !produkLabel || !jumlah || (form.status === 'lunas' && !method)) {
        Swal.fire('Gagal', 'Semua field * wajib diisi', 'error')
        return
      }

      if (!currentAnnouncement) {
        Swal.fire('Error', 'Tidak ada pengumuman aktif untuk minggu ini', 'error')
        return
      }


      const weekId = weeks.find(w => w.week_code === sheetName)?.id
      if (!weekId) {
        Swal.fire('Error', 'Minggu tidak ditemukan', 'error')
        return
      }

      if (editingOrderId) {

        const { error } = await supabase
          .from('orders')
          .update({
            pemesan,
            jumlah: Number(jumlah),
            harga_satuan: produkLabel.data.hjk,
            catatan: form.catatan || null,
            bayar: parseFloat(form.bayar) || null,
            method: form.method,
            status: form.status
          })
          .eq('id', editingOrderId)
        if (error) throw error


        setData(prev => prev.map(r => r.id === editingOrderId ? {
          ...r,
          pemesan,
          jumlah: Number(jumlah),
          bayar: parseFloat(form.bayar) || null,
          catatan: form.catatan || '',
          method: form.method,
          status: form.status
        } : r))

        Swal.fire('Berhasil', 'Order berhasil diperbarui', 'success')
      } else {
        await createOrder({
          weekId,
          announcementId: currentAnnouncement.id,
          registrationId: produkLabel.registrationId,
          registrationProductId: produkLabel.registrationProductId,
          channel: 'offline',
          pemesan,
          jumlah: Number(jumlah),
          hargaSatuan: produkLabel.data.hjk,
          catatan: form.catatan || null,
          bayar: parseFloat(form.bayar) || null,
          supplierId: produkLabel.supplierId || undefined,
          method: form.method,
          status: form.status
        })
        Swal.fire('Berhasil', 'Order berhasil ditambahkan', 'success')
      }

      setForm({ pemesan: '', produkLabel: null, catatan: '', jumlah: '', bayar: '', method: null, status: null })
      setEditIndex(null)
      setEditingOrderId(null)
    } catch (error) {
      console.error('Error saving order:', error)
      Swal.fire('Error', 'Gagal menyimpan order', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row, i) => {
    let opt = produkOptions.find(o => o.registrationProductId === row.registrationProductId)
    if (!opt) {
      opt = {
        label: row.produkLabel || '',
        value: row.registrationProductId || '',
        data: {
          hjk: row.harga_satuan || 0,
          hpp: row.hpp || 0,
          namaSupplier: row.supplierName || '',
          namaProduk: row.produkLabel || '',
          ukuran: '',
          satuan: ''
        },
        registrationProductId: row.registrationProductId,
        registrationId: row.registration_id,
        supplierId: row.supplier_id
      }
    }
    setForm({
      pemesan: row.pemesan,
      produkLabel: opt,
      catatan: row.catatan,
      jumlah: row.jumlah,
      bayar: row.bayar,
      method: row.method,
      status: row.status || '',
      adjustedHJK: opt ? getAdjustedHJK(opt.data.hjk) : 0
    })
    setEditIndex(i)
    setEditingOrderId(row.id)
  }

  const handleDelete = async (index) => {
    const filteredRows = data.filter(row => {
      const matchSearch = Object.values(row).some(val =>
        String(val).toLowerCase().includes(searchText.toLowerCase())
      )
      const matchPemesan = selectedPemesan ? row.pemesan === selectedPemesan.value : true
      return matchSearch && matchPemesan
    })
    const selected = filteredRows[index]
    const result = await Swal.fire({
      title: `Hapus data \n "${selected.pemesan} - ${selected.produkLabel}"?`,
      text: 'Anda akan menghapus data ini.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {

      const { error } = await supabase.from('orders').delete().eq('id', selected.id)
      if (error) throw error

      setData(prev => prev.filter(r => r.id !== selected.id))
      Swal.fire('Dihapus!', 'Data berhasil dihapus.', 'success')
    } catch (error) {
      console.error('Error deleting order:', error)
      Swal.fire('Error', 'Gagal menghapus data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleFixSelection = id => {
    setSelectedFixIds(prev => {
      const newSet = new Set(prev)
      newSet.has(id) ? newSet.delete(id) : newSet.add(id)
      return newSet
    })
  }

  const handleCheckMissingEntries = async () => {
    try {
      Swal.fire({
        title: 'Memeriksa data...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })

      let existing = []
      let weekKey = sheetName

      if (isAllWeek) {
        if (!selectedWeek) {
          Swal.close()
          Swal.fire('Pilih minggu dulu', 'Kalau cek semua minggu, harus pilih minggu yang mana dulu.', 'warning')
          return
        }
        weekKey = selectedWeek.value
        existing = weekData[weekKey] || []
      } else {
        existing = weekData[weekKey] || []
      }

      const existingKeys = new Set(existing.map(e => `${e.pemesan}|${e.produkLabel}|${e.jumlah}`))

      const { data: logs, error } = await supabase
        .from('week_logs')
        .select('*')
        .in('action', ['add', 'delete'])
        .eq('target', 'week_entry')
        .like('target_id', `${weekKey}|%`)
        .order('timestamp', { ascending: false })

      if (error) throw error

      const seen = new Set()
      const deletedKeys = new Set()
      const found = []

      for (const log of logs) {
        if (log.action === 'delete') {
          const before = log.data_before ? JSON.parse(log.data_before) : null
          if (!before) continue
          const key = `${before.pemesan}|${before.produkLabel}|${before.jumlah}`
          deletedKeys.add(key)
        } else if (log.action === 'add') {
          const after = log.data_after ? JSON.parse(log.data_after) : null
          if (!after) continue
          const key = `${after.pemesan}|${after.produkLabel}|${after.jumlah}`
          if (!existingKeys.has(key) && !seen.has(key)) {
            found.push({
              ...after,
              id: log.id,
              week: weekKey,
              _deleted: deletedKeys.has(key)
            })
            seen.add(key)
          }
        }
      }

      Swal.close()

      const autoChecked = found.filter(e => !e._deleted).map(e => e.id)

      setMissingEntries(found)
      setSelectedFixIds(new Set(autoChecked))
      setFixModalOpen(true)
    } catch (err) {
      Swal.close()
      Swal.fire('Error', err.message, 'error')
    }
  }

  const groupedMissing = missingEntries.reduce((acc, e) => {
    if (!acc[e.pemesan]) acc[e.pemesan] = []
    acc[e.pemesan].push(e)
    return acc
  }, {})

  const handleRestoreMissingEntries = async () => {
    try {
      const selected = missingEntries.filter(e => selectedFixIds.has(e.id))
      if (!selected.length) return

      const grouped = selected.reduce((acc, e) => {
        const wk = e.week || sheetName
        acc[wk] = acc[wk] || []
        acc[wk].push(e)
        return acc
      }, {})

      for (const [wk, entries] of Object.entries(grouped)) {
        const updated = [...(weekData[wk] || []), ...entries]
        await saveWeekData(wk, updated)

        for (const e of entries) {
          await logWeekAction({
            user,
            action: 'restore',
            sheetName: wk,
            entryBefore: null,
            entryAfter: e,
            description: `Restored missing entry in ${wk}`
          })
        }
      }

      Swal.fire('Berhasil', 'Data berhasil dipulihkan', 'success')
      setFixModalOpen(false)
    } catch (err) {
      Swal.fire('Error', 'Gagal memulihkan data', 'error')
    }
  }


  const columns = [
    { name: 'No', selector: (r, i) => i + 1, width: '60px', wrap: true },
    ...(isAllWeek ? [{ name: 'Minggu', selector: r => r?.week, wrap: true }] : []),
    { name: 'Pemesan', selector: r => r?.pemesan, wrap: true },
    { name: 'Produk', selector: r => r?.produkLabel, wrap: true },
    { name: 'Catatan', selector: r => r?.catatan || "-", wrap: true },
    { name: 'Jumlah', selector: r => r?.jumlah, wrap: true, width: "120px", },
    {
      name: 'Total Bayar',
      selector: r => {
        const bayar = parseFloat(r?.bayar)
        if (!bayar || bayar <= 0) return '-'
        const adjustedValue = bayar < 1000 ? bayar * 1000 : bayar
        return `Rp${adjustedValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      },
      width: "140px",
      wrap: true
    },
    {
      name: 'Status',
      cell: (row) => {
        if (!row.status) return '-'
        const map = {
          lunas: { color: 'success', label: 'Lunas' },
          open_bill: { color: 'danger', label: 'Open Bill' }
        }
        const config = map[row.status] || { color: 'secondary', label: row.status }
        return <Badge color={config.color}>{config.label}</Badge>
      },
      width: "120px",
      wrap: true
    },
    {
      name: 'Method',
      cell: (row) => (row.method ? <Badge color="primary">{row.method.toUpperCase()}</Badge> : '-'),
      width: "120px",
      wrap: true
    },
    {
      name: 'Aksi',
      cell: (row) => {
        const filteredIndex = filtered.findIndex(f =>
          f.pemesan === row.pemesan &&
          f.produkLabel === row.produkLabel &&
          f.jumlah === row.jumlah &&
          f.catatan === row.catatan
        )
        return (
          <>
            <Button size="sm" color="warning" className="me-2" onClick={() => handleEdit(row, filteredIndex)} disabled={loading || isAllWeek}>
              <Edit size={16} />
            </Button>
            <Button size="sm" color="danger" onClick={() => handleDelete(filteredIndex)} disabled={loading}>
              <Trash2 size={16} />
            </Button>
          </>
        )
      },
      width: "140px",
      wrap: true
    }
  ]

  const filtered = data.filter(row => {
    const matchSearch = Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchText.toLowerCase())
    )
    const matchPemesan = selectedPemesan ? row.pemesan === selectedPemesan.value : true
    const matchWeek = selectedWeek ? row.week === selectedWeek.value : true
    const matchStatus = isAllWeek && selectedStatus ? row.status === selectedStatus.value : true
    const matchMethod = selectedMethod ? row.method === selectedMethod.value : true
    return matchSearch && matchPemesan && matchWeek && matchStatus && matchMethod
  })

  const uniquePemesanOptions = [...new Set(data.map(d => d.pemesan))].map(p => ({
    label: p,
    value: p
  }))

  const uniqueWeekOptions = isAllWeek
    ? [...new Set(data.map(d => d.week))]
      .sort((a, b) => Number(a.replace('W', '')) - Number(b.replace('W', '')))
      .map(w => ({ label: w, value: w }))
    : []

  const statusOptions = [
    { label: 'Lunas', value: 'lunas' },
    { label: 'Open Bill', value: 'open_bill' }
  ]

  const methodOptions = [
    { label: 'QRIS', value: 'qris' },
    { label: 'Cash', value: 'cash' },
    { label: 'Transfer', value: 'transfer' }
  ]

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-2">
        <Col xs="12" md="6">
          <h4>{isAllWeek ? 'Semua Minggu' : `Minggu ${num} Offline`}</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
          {/* <Button color="info" onClick={handleCheckMissingEntries} disabled={loading} className="me-3">
            🔍 Cek Data Minggu Hilang
          </Button> */}
          <Button color="warning" onClick={() => window.history.back()}>
            Kembali
          </Button>
        </Col>
      </Row>
      <Form onSubmit={handleSubmit} className="mb-4">
        <Row className="mb-2">
          <Col xs="12" sm="6" md="3" className="mb-2 mb-md-0">
            <FormGroup>
              <Label>Pemesan *</Label>
              <Input
                value={form.pemesan}
                onChange={e => setForm(f => ({ ...f, pemesan: e.target.value }))}
                disabled={loading || isAllWeek}
                list={!isAllWeek ? 'pemesan-suggestions' : undefined}
              />
              {!isAllWeek && (
                <datalist id="pemesan-suggestions">
                  {uniquePemesanThisWeek.map((p, i) => (
                    <option key={i} value={p} />
                  ))}
                </datalist>
              )}
            </FormGroup>
          </Col>
          <Col xs="12" sm="6" md="2" className="mb-2 mb-md-0">
            <FormGroup>
              <Label>Produk *</Label>
              <Select
                options={produkOptions}
                value={form.produkLabel}
                onChange={handleSelectProduk}
                placeholder="🔽 Pilih produk"
                isSearchable
                isDisabled={loading || isAllWeek}
              />
              {form.produkLabel?.data?.keterangan && (
                <small className="text-muted">
                  Keterangan: {form.produkLabel.data.keterangan}
                </small>
              )}
            </FormGroup>
          </Col>
          <Col xs="12" sm="6" md="2" className="mb-2 mb-md-0">
            <FormGroup>
              <Label>Catatan/Varian</Label>
              <Input
                value={form.catatan}
                onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                disabled={loading || isAllWeek}
              />
            </FormGroup>
          </Col>
          <Col xs="12" sm="6" md="2" className="mb-2 mb-md-0">
            <FormGroup>
              <Label>Status *</Label>
              <Select
                options={statusOptions}
                value={statusOptions.find(o => o.value === form.status || null)}
                onChange={(option) => {
                  setForm(f => ({
                    ...f,
                    status: option ? option.value : '',
                    method: option?.value === 'lunas' ? f.method : null
                  }))
                }}
                placeholder="🔽 Pilih status"
                isDisabled={loading || isAllWeek}
              />
            </FormGroup>
          </Col>
          {form.status === 'lunas' && (
            <Col xs="12" sm="6" md="2" className="mb-2 mb-md-0">
              <FormGroup>
                <Label>Method *</Label>
                <Select
                  options={methodOptions}
                  value={methodOptions.find(o => o.value === form.method) || null}
                  onChange={(option) => setForm(f => ({ ...f, method: option ? option.value : '' }))}
                  placeholder="🔽 Pilih method"
                  isDisabled={loading || isAllWeek}
                />
              </FormGroup>
            </Col>
          )}
          <Col xs="6" sm="3" md="1" className="mb-2 mb-md-0">
            <FormGroup>
              <Label>Jumlah *</Label>
              <Input
                type="number"
                value={form.jumlah}
                onChange={e => handleJumlahChange(e.target.value)}
                disabled={loading || isAllWeek}
              />
            </FormGroup>
          </Col>
          <Col xs="6" sm="3" md="2">
            <FormGroup>
              <Label>Total Bayar</Label>
              <Input
                readOnly
                value={
                  form.bayar && parseFloat(form.bayar) > 0
                    ? `Rp${parseFloat(form.bayar).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                    : ''
                }
                disabled={loading || isAllWeek}
              />
            </FormGroup>
          </Col>
        </Row>
        <Row className="mb-3">
          <Col xs="12" md={isAllWeek ? "2" : "3"} className="mb-2 mb-md-0">
            <Input
              placeholder="🔍 Cari apa aja..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              disabled={loading}
            />
          </Col>
          <Col xs="12" md={isAllWeek ? "2" : "3"} className="mb-2 mb-md-0">
            <Select
              options={uniquePemesanOptions}
              isClearable
              isSearchable
              placeholder="🔽 Filter pemesan"
              value={selectedPemesan}
              onChange={setSelectedPemesan}
              isDisabled={loading}
            />
          </Col>
          {!isAllWeek && (
            <Col xs="12" md="3" className="mb-2 mb-md-0">
              <Select
                options={methodOptions}
                isClearable
                isSearchable
                placeholder="🔽 Filter method"
                value={selectedMethod}
                onChange={setSelectedMethod}
                isDisabled={loading}
              />
            </Col>
          )}
          {isAllWeek && (
            <>
              <Col xs="12" md="2" className="mb-2 mb-md-0">
                <Select
                  options={uniqueWeekOptions}
                  isClearable
                  isSearchable
                  placeholder="🔽 Filter minggu"
                  value={selectedWeek}
                  onChange={setSelectedWeek}
                  isDisabled={loading}
                />
              </Col>
              <Col xs="12" md="2" className="mb-2 mb-md-0">
                <Select
                  options={statusOptions}
                  isClearable
                  isSearchable
                  placeholder="🔽 Filter status"
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  isDisabled={loading}
                />
              </Col>
              <Col xs="12" md="2" className="mb-2 mb-md-0">
                <Select
                  options={methodOptions}
                  isClearable
                  isSearchable
                  placeholder="🔽 Filter method"
                  value={selectedMethod}
                  onChange={setSelectedMethod}
                  isDisabled={loading}
                />
              </Col>
            </>
          )}
          <Col xs="12" md={isAllWeek ? "2" : "3"} className="text-end">
            <Button color="danger" className="me-3 mb-2 mb-md-0" onClick={() => {
              setSearchText('')
              setSelectedPemesan(null)
              setSelectedWeek(null)
              setSelectedStatus(null)
              setSelectedMethod(null)
            }} disabled={loading}>
              Reset Filter
            </Button>
            <Button type="submit" color="primary" disabled={loading || isAllWeek} className="mb-2 mb-md-0">
              {loading ? 'Loading...' : (editIndex !== null ? 'Update' : 'Tambah')}
            </Button>
          </Col>
        </Row>
      </Form>
      <div className="border overflow-auto" style={{ minHeight: 200 }}>
        <DataTable
          columns={columns}
          data={filtered}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 25, 50, 100]}
          noDataComponent="Belum ada data"
          highlightOnHover
          responsive
          progressPending={loading}
        />
      </div>

      <Modal isOpen={fixModalOpen} toggle={() => setFixModalOpen(!fixModalOpen)} size="lg">
        <ModalHeader toggle={() => setFixModalOpen(false)}>
          Data Hilang {isAllWeek ? (selectedWeek?.value || 'Pilih minggu') : sheetName}
        </ModalHeader>

        <ModalBody>
          {missingEntries.length === 0 ? (
            <Alert color="success">Tidak ada data yang hilang</Alert>
          ) : (
            <>
              <p>
                Ditemukan <strong>{missingEntries.length}</strong> data pesanan yang belum tercatat:
              </p>
              <ul className="list-unstyled">
                {Object.entries(groupedMissing).map(([pemesan, entries]) => {
                  const allChecked = entries.every(e => selectedFixIds.has(e.id))
                  const someChecked = entries.some(e => selectedFixIds.has(e.id)) && !allChecked
                  const totalPemesan = entries.filter(ent => selectedFixIds.has(ent.id)).reduce((sum, ent) => sum + Number(ent.bayar || 0), 0)
                  const isExpanded = expandedPemesan === pemesan

                  return (
                    <li key={pemesan} className="mb-3 border rounded p-2 bg-light">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <Input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => {
                              if (el) el.indeterminate = someChecked
                            }}
                            onChange={e => {
                              const copy = new Set(selectedFixIds)
                              if (e.target.checked) {
                                entries.forEach(ent => copy.add(ent.id))
                              } else {
                                entries.forEach(ent => copy.delete(ent.id))
                              }
                              setSelectedFixIds(copy)
                            }}
                            className="me-2"
                          />
                          <b>{pemesan}</b>
                          <span className="ms-2 text-muted">Total Rp{totalPemesan.toLocaleString('id-ID')}</span>
                        </div>
                        <Button
                          size="sm"
                          color="link"
                          onClick={() => setExpandedPemesan(isExpanded ? null : pemesan)}
                        >
                          {isExpanded ? '▲ Sembunyikan' : '▼ Lihat Produk'}
                        </Button>
                      </div>

                      {isExpanded && (
                        <ul className="mt-2">
                          {entries.map(ent => (
                            <li
                              key={ent.id}
                              className="d-flex align-items-center justify-content-between border-bottom py-1"
                            >
                              <div>
                                <Input
                                  type="checkbox"
                                  checked={selectedFixIds.has(ent.id)}
                                  onChange={() => toggleFixSelection(ent.id)}
                                  className="me-2"
                                />
                                {ent.produkLabel} <small>({ent.jumlah}x)</small>
                                {ent._deleted && <span className="badge bg-danger ms-2">dihapus</span>}
                              </div>
                              <div>
                                <small className="text-muted">
                                  Rp{Number(ent.bayar || 0).toLocaleString('id-ID')}
                                </small>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          {missingEntries.length > 0 && (
            <Button color="primary" onClick={handleRestoreMissingEntries}>Pulihkan</Button>
          )}
          <Button color="secondary" onClick={() => setFixModalOpen(false)}>Tutup</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default WeekOffline