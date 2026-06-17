import React, { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row
} from 'reactstrap'
import DataTable from 'react-data-table-component'
import { Edit, Trash2 } from 'react-feather'
import Select from 'react-select'
import Swal from 'sweetalert2'
import ExcelJS from 'exceljs'
import { useAuth } from '../context/AuthContext'
import { useAppUi } from '../context/AppUiContext'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const Week = () => {
  const { productData, registeredUsers, bazaarData, createOrder, weeks, orders } = useAuth()
  const { currentWeek } = useAppUi()
  const { num } = useParams()
  const activeWeek = num ? Number(num) : currentWeek
  const sheetName = activeWeek ? `W${activeWeek}` : null

  const [form, setForm] = useState({
    pemesan: '', produkLabel: null, catatan: '', jumlah: '', bayar: '', status: null
  })
  const [data, setData] = useState([])
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [produkOptions, setProdukOptions] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedPemesan, setSelectedPemesan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)

  const isAllWeek = !activeWeek

  const uniquePemesanThisWeek = !isAllWeek
    ? [...new Set((data || []).map(d => d.pemesan))].sort((a, b) => a.localeCompare(b))
    : []

  const statusOptions = [
    { label: 'Lunas', value: 'lunas' },
    { label: 'Open Bill', value: 'open_bill' }
  ]

  const currentAnnouncement = useMemo(() => {
    return (bazaarData.announcements || [])
      .find(a => a.weekCode === sheetName && a.status === 'active')
  }, [bazaarData, sheetName])
  const approvedRegs = useMemo(() => {
    return (bazaarData.registrations || [])
      .filter(r => r?.announcementId === currentAnnouncement?.id && r?.status === 'approved')
  }, [bazaarData, currentAnnouncement])
  const allowedProducts = useMemo(() => {
    const result = []
    approvedRegs.forEach(reg => {
      if (reg.participateOnline) {
        const onlineProducts = (reg.registrationProducts || []).filter(p => {
          const ch = (p.channel || '').toLowerCase()
          return (ch === 'online' || ch === 'both') && !p.isDeleted
        })

        onlineProducts.forEach(prod => {
          result.push({
            ...prod,
            owner: reg.supplierName,
            supplierId: reg.supplierId,
            registrationId: reg.id,
            registrationProductId: prod.id
          })
        })
      }
    })
    return result
  }, [approvedRegs])


  const mapOrderRow = (o) => {
    const prod = o.registration_products || {}
    const weekCode = weeks.find(w => w.id === o.week_id)?.week_code || ''
    return {
      ...o,
      produkLabel: `${prod.nama_produk || ''} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim(),
      registrationProductId: prod.id,
      registrationId: o.registration_id,
      supplierId: o.supplier_id,
      week: weekCode,
      channel: o.channel
    }
  }

  useEffect(() => {
    if (isAllWeek) {
      const sorted = (orders || [])
        .filter(o => o.channel === 'online')
        .map(mapOrderRow)
        .sort((a, b) => (a.pemesan || '').toLowerCase().localeCompare((b.pemesan || '').toLowerCase()))
      setData(sorted)
    } else {
      const weekId = weeks.find(w => w.week_code === sheetName)?.id
      const filtered = (orders || [])
        .filter(o => o.week_id === weekId && o.channel === 'online')
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
      setProdukOptions(prev => {
        const same =
          prev.length === opts.length &&
          prev.every((p, i) => p.value === opts[i].value)

        return same ? prev : opts
      })
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

  const formatUtc7 = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const getExportData = () => {
    const data = []
    let grandTotal = 0
    let grandTotalQty = 0

    const grouped = []
    const groupMap = new Map()

    filtered.forEach(order => {
      const pemesan = order.pemesan || 'Tanpa Nama'
      if (!groupMap.has(pemesan)) {
        groupMap.set(pemesan, { pemesan, items: [] })
      }
      groupMap.get(pemesan).items.push(order)
    })

    groupMap.forEach(group => grouped.push(group))

    grouped.forEach(group => {
      const groupTotalQty = group.items.reduce((sum, item) => sum + Number(item.jumlah || 0), 0)
      const groupTotalPrice = group.items.reduce((sum, item) => {
        const jumlahProduk = Number(item.jumlah || 0)
        const hargaSatuanRaw = Number(item.harga_satuan || item.hargaSatuan || item.produkLabel?.data?.hjk || 0)
        const hargaSatuan = getAdjustedHJK(hargaSatuanRaw)
        const totalHarga = Number(item.bayar || item.total_harga || jumlahProduk * hargaSatuan)
        return sum + totalHarga
      }, 0)

      group.items.forEach((item, index) => {
        const jumlahProduk = Number(item.jumlah || 0)
        const hargaSatuanRaw = Number(item.harga_satuan || item.hargaSatuan || item.produkLabel?.data?.hjk || 0)
        const hargaSatuan = getAdjustedHJK(hargaSatuanRaw)
        const totalHarga = Number(item.bayar || item.total_harga || jumlahProduk * hargaSatuan)

        data.push({
          type: 'item',
          pemesan: index === 0 ? group.pemesan : '',
          produk: item.produkLabel || '',
          catatan: item.catatan || '',
          harga_satuan: hargaSatuan,
          jumlah_produk: jumlahProduk,
          total_harga: totalHarga,
          status: item.status || '',
          metode_bayar: item.method || '',
          jam: formatUtc7(item.created_at)
        })
      })

      data.push({
        type: 'subtotal',
        pemesan: `Total ${group.pemesan}`,
        produk: '',
        catatan: '',
        harga_satuan: '',
        jumlah_produk: groupTotalQty,
        total_harga: groupTotalPrice,
        status: '',
        metode_bayar: '',
        jam: ''
      })

      grandTotal += groupTotalPrice
      grandTotalQty += groupTotalQty
    })

    if (data.length) {
      data.push({
        type: 'grand_total',
        pemesan: 'TOTAL PENJUALAN',
        produk: '',
        catatan: '',
        harga_satuan: '',
        jumlah_produk: grandTotalQty,
        total_harga: grandTotal,
        status: '',
        metode_bayar: '',
        jam: ''
      })
    }

    return data
  }

  const handleExportCsv = async () => {
    const data = getExportData()
    if (!data.length) {
      Swal.fire('Info', 'Tidak ada data untuk diekspor', 'info')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Online Orders')

      const headerRow = ['PEMESAN', 'PRODUK', 'CATATAN', 'HARGA SATUAN', 'JUMLAH PRODUK', 'TOTAL HARGA', 'STATUS', 'METODE BAYAR', 'JAM']
      worksheet.addRow(headerRow)

      const headerFormatting = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      }

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerFormatting.font
        cell.fill = headerFormatting.fill
        cell.alignment = headerFormatting.alignment
        cell.border = headerFormatting.border
      })

      data.forEach((row) => {
        const excelRow = worksheet.addRow([
          row.pemesan,
          row.produk,
          row.catatan,
          row.harga_satuan,
          row.jumlah_produk,
          row.total_harga,
          row.status,
          row.metode_bayar,
          row.jam
        ])

        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }

          if (row.type === 'subtotal' || row.type === 'grand_total') {
            cell.font = { bold: true, color: { argb: 'FF000000' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
          }

          if ([4, 5, 6].includes(colNumber)) {
            cell.numFmt = '#,##0'
          }
        })
      })

      worksheet.columns = [
        { width: 20 },
        { width: 35 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 12 },
        { width: 15 },
        { width: 18 },
        { width: 18 }
      ]

      worksheet.getRow(1).height = 25

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const announcementName = currentAnnouncement?.title || currentAnnouncement?.name || 'Announcement'
      const filename = isAllWeek
        ? `online-orders-all-weeks-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Online - W${activeWeek} - ${announcementName} - ${new Date().toISOString().slice(0, 10)}.xlsx`

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      Swal.fire('Error', 'Gagal mengekspor data ke Excel', 'error')
    }
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
      const { pemesan, produkLabel, jumlah } = form
      if (!pemesan || !produkLabel || !jumlah) {
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
            status: form.status || null
          })
          .eq('id', editingOrderId)
        if (error) throw error

        setData(prev => prev.map(r => r.id === editingOrderId ? {
          ...r,
          pemesan,
          jumlah: Number(jumlah),
          bayar: parseFloat(form.bayar) || null,
          catatan: form.catatan || '',
          status: form.status || null
        } : r))
        Swal.fire('Berhasil', 'Order berhasil diperbarui', 'success')
      } else {
        await createOrder({
          weekId,
          announcementId: currentAnnouncement.id,
          registrationId: produkLabel.registrationId,
          registrationProductId: produkLabel.registrationProductId,
          channel: 'online',
          pemesan,
          jumlah: Number(jumlah),
          hargaSatuan: produkLabel.data.hjk,
          catatan: form.catatan || null,
          bayar: parseFloat(form.bayar) || null,
          supplierId: produkLabel.supplierId || undefined,
          status: 'open_bill',
          method: null
        })
        Swal.fire('Berhasil', 'Order berhasil ditambahkan', 'success')
      }

      setForm({ pemesan: '', produkLabel: null, catatan: '', jumlah: '', bayar: '', status: null })
      setEditingOrderId(null)
      setOrderModalOpen(false)
    } catch (error) {
      console.error('Error saving order:', error)
      Swal.fire('Error', 'Gagal menyimpan order', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row) => {
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
      status: row.status || null,
      adjustedHJK: opt ? getAdjustedHJK(opt.data.hjk) : 0
    })
    setEditingOrderId(row.id)
    setOrderModalOpen(true)
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

  const columns = [
    { name: 'No', selector: (r, i) => i + 1, width: '5%', wrap: true },
    ...(isAllWeek ? [{ name: 'Minggu', selector: r => r?.week, wrap: true, width: '6%' }] : []),
    { name: 'Pemesan', selector: r => r?.pemesan, wrap: true, width: isAllWeek ? '18%' : '20%' },
    { name: 'Produk', selector: r => r?.produkLabel, wrap: true, width: isAllWeek ? '18%' : '20%' },
    { name: 'Catatan', selector: r => r?.catatan || "-", wrap: true, width: isAllWeek ? '18%' : '20%' },
    {
      name: 'Status',
      cell: row => {
        if (!row.status) {
          return '-'
        }
        return (
          <Badge color={row.status === 'lunas' ? 'success' : 'danger'}>
            {row.status === 'lunas' ? 'Lunas' : 'Open Bill'}
          </Badge>
        )
      },
      width: '9%'
    },
    { name: 'Jumlah', selector: r => r?.jumlah, wrap: true, width: "8%", },
    {
      name: 'Total Bayar',
      selector: r => {
        const bayar = parseFloat(r?.bayar)
        if (!bayar || bayar <= 0) return '-'
        const adjustedValue = bayar < 1000 ? bayar * 1000 : bayar
        return `Rp${adjustedValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      },
      width: "9%",
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
            <Button size="sm" color="warning" className="me-1" onClick={() => handleEdit(row)} disabled={loading || isAllWeek}>
              <Edit size={16} />
            </Button>
            <Button size="sm" color="danger" onClick={() => handleDelete(filteredIndex)} disabled={loading}>
              <Trash2 size={16} />
            </Button>
          </>
        )
      },
      width: "9%",
      wrap: true
    }
  ]

  const filtered = data.filter(row => {
    const matchSearch = Object.values(row).some(val => String(val).toLowerCase().includes(searchText.toLowerCase()))
    const matchPemesan = selectedPemesan ? row.pemesan === selectedPemesan.value : true
    const matchWeek = selectedWeek ? row.week === selectedWeek.value : true
    const matchStatus = selectedStatus ? row.status === selectedStatus.value : true
    return matchSearch && matchPemesan && matchWeek && matchStatus
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

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>{isAllWeek ? 'Semua Minggu - Online' : `Minggu ${activeWeek} - Online`}</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0 d-flex flex-wrap gap-2 justify-content-md-end">
          <Button
            color="primary"
            disabled={loading || isAllWeek}
            onClick={() => {
              setForm({ pemesan: '', produkLabel: null, catatan: '', jumlah: '', bayar: '' })
              setEditingOrderId(null)
              setOrderModalOpen(true)
            }}
          >
            Tambah order
          </Button>
          <Button
            color="success"
            onClick={handleExportCsv}
            disabled={loading || !filtered.length}
          >
            Ekspor Data
          </Button>
          <Button color="danger" className="me-3 mb-2 mb-md-0" onClick={() => {
            setSearchText('')
            setSelectedPemesan(null)
            setSelectedWeek(null)
            setSelectedStatus(null)
          }} disabled={loading}>
            Reset Filter
          </Button>
        </Col>
      </Row>
      <div className="mb-2">
        <Row className="mb-3">
          <Col xs="12" md="3" className="mb-2">
            <Input
              placeholder="🔍 Cari apa aja..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              disabled={loading}
            />
          </Col>
          <Col xs="12" md="3" className="mb-2">
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
          <Col xs="12" md="3" className="mb-2">
            <Select
              options={statusOptions}
              isClearable
              placeholder="🔽 Filter status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              isDisabled={loading}
            />
          </Col>
          {isAllWeek && (
            <Col xs="12" md="3" className="mb-2">
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
          )}
        </Row>
      </div>

      <Modal isOpen={orderModalOpen} toggle={() => setOrderModalOpen(false)} size="lg" centered>
        <ModalHeader toggle={() => setOrderModalOpen(false)}>
          {editingOrderId ? 'Edit order' : 'Order baru'} {!isAllWeek && `(minggu ${activeWeek}) - online`}
        </ModalHeader>
        <Form
          onSubmit={(e) => {
            handleSubmit(e)
          }}
        >
          <ModalBody>
            <Row className="mb-2">
              <Col xs="12" sm="6" className="mb-3">
                <Label>Pemesan *</Label>
                <Input
                  value={form.pemesan}
                  onChange={(e) => setForm((f) => ({ ...f, pemesan: e.target.value }))}
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
              </Col>
              <Col xs="12" sm="6" className="mb-3">
                <Label>Produk *</Label>
                <Select
                  options={produkOptions}
                  value={form.produkLabel}
                  onChange={handleSelectProduk}
                  placeholder="Pilih produk"
                  isSearchable
                  isDisabled={loading || isAllWeek}
                />
                {form.produkLabel?.data?.keterangan && (
                  <small className="text-muted">Keterangan: {form.produkLabel.data.keterangan}</small>
                )}
              </Col>
              <Col xs="12" className="mb-3">
                <Label>Catatan/Varian</Label>
                <Input
                  value={form.catatan}
                  onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                  disabled={loading || isAllWeek}
                  type="textarea"
                />
              </Col>
              {editingOrderId && (
                <Col xs="12" className="mb-3">
                  <Label>Status</Label>
                  <Select
                    options={statusOptions}
                    isClearable
                    placeholder="Pilih status"
                    value={statusOptions.find(s => s.value === form.status) || null}
                    onChange={option =>
                      setForm(f => ({
                        ...f,
                        status: option?.value || null
                      }))
                    }
                    isDisabled={loading || isAllWeek}
                  />
                </Col>
              )}
              <Col xs="6" md="4" className="mb-3">
                <Label>Jumlah *</Label>
                <Input
                  type="number"
                  value={form.jumlah}
                  onChange={(e) => handleJumlahChange(e.target.value)}
                  disabled={loading || isAllWeek}
                />
              </Col>
              <Col xs="6" md="8" className="mb-3">
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
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setOrderModalOpen(false)}>
              Batal
            </Button>
            <Button color="primary" type="submit" disabled={loading || isAllWeek}>
              {loading ? 'Menyimpan…' : editingOrderId ? 'Simpan' : 'Tambah'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
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
    </div>
  )
}

export default Week