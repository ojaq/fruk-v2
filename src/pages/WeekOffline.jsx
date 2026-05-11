import React, { useEffect, useState, useMemo } from 'react'
import { Badge, Button, Col, Form, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap'
import DataTable from 'react-data-table-component'
import { Edit, Trash2, Printer } from 'react-feather'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import { useAppUi } from '../context/AppUiContext'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ExcelJS from 'exceljs'

const WeekOffline = () => {
  const { user, users, productData, registeredUsers, bazaarData, createOrder, fetchOrders, weeks, orders } = useAuth()
  const { currentWeek } = useAppUi()
  const { num } = useParams()
  const activeWeek = num ? Number(num) : currentWeek
  const sheetName = activeWeek ? `W${activeWeek}` : null

  const createEmptyItem = () => ({
    registrationProductId: null,
    registrationId: null,
    supplierId: null,
    label: '',
    data: {},
    jumlah: '',
    catatan: '',
    hargaSatuan: 0,
    status: '',
    method: ''
  })
  const createInitialForm = () => ({
    pemesan: '',
    status: '',
    method: '',
    items: [createEmptyItem()]
  })
  const cloneForm = (source) => ({
    pemesan: source?.pemesan || '',
    status: source?.status || '',
    method: source?.method || '',
    items: (source?.items || []).map(item => ({
      ...createEmptyItem(),
      ...item
    }))
  })

  const [form, setForm] = useState(createInitialForm())
  const [initialFormSnapshot, setInitialFormSnapshot] = useState(createInitialForm())
  const [data, setData] = useState([])
  const [editingOrderIds, setEditingOrderIds] = useState([])
  const [produkOptions, setProdukOptions] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedPemesan, setSelectedPemesan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set())

  const isAllWeek = !activeWeek

  const uniquePemesanThisWeek = !isAllWeek
    ? [...new Set((data || []).map(d => d.pemesan))].sort((a, b) => a.localeCompare(b))
    : []

  const currentAnnouncement = useMemo(() => {
    return (bazaarData.announcements || [])
      .find(a => a.weekCode === sheetName && a.status === 'active')
  }, [bazaarData, sheetName])
  const approvedRegs = useMemo(() => {
    return (bazaarData.registrations || [])
      .filter(r => r?.announcementId === currentAnnouncement?.id && r?.status === 'approved')
  }, [bazaarData, currentAnnouncement])
  const usersById = useMemo(() => {
    const map = new Map()
      ; (users || []).forEach(u => map.set(u.id, u))
    return map
  }, [users])

  const allowedProducts = useMemo(() => {
    const result = []
    approvedRegs.forEach(reg => {
      if (reg.participateOffline) {
        const offlineProducts = (reg.registrationProducts || []).filter(p => {
          const ch = (p.channel || '').toLowerCase()
          return (ch === 'offline' || ch === 'both') && !p.isDeleted
        })

        offlineProducts.forEach(prod => {
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
    const createdByUser = usersById.get(o.created_by)
    const lastEditedByUser = usersById.get(o.last_edited_by)
    return {
      ...o,
      produkLabel: `${prod.nama_produk || ''} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim(),
      registrationProductId: o.registration_product_id,
      registrationId: o.registration_id,
      supplierId: o.supplier_id,
      createdByName: createdByUser?.nama_supplier || createdByUser?.name || o.created_by || '',
      lastEditedByName: lastEditedByUser?.nama_supplier || lastEditedByUser?.name || o.last_edited_by || '',
      week: weekCode
    }
  }

  const usedStockMap = useMemo(() => {
    const map = {}

      ; (orders || []).forEach(o => {
        if (o.channel !== 'offline') return
        const key = o.registration_product_id
        if (!map[key]) map[key] = 0
        map[key] += Number(o.jumlah || 0)
      })

    return map
  }, [orders])

  const currentGroupQtyByProduct = useMemo(() => {
    return form.items.reduce((acc, item) => {
      if (!item.registrationProductId) return acc
      const qty = Number(item.jumlah || 0)
      if (!qty) return acc
      acc[item.registrationProductId] = (acc[item.registrationProductId] || 0) + qty
      return acc
    }, {})
  }, [form.items])

  const usedStockByOthersMap = useMemo(() => {
    const editingIdSet = new Set(editingOrderIds)
    return (orders || []).reduce((acc, order) => {
      if (order.channel !== 'offline') return acc
      if (editingIdSet.has(order.id)) return acc
      const key = order.registration_product_id
      if (!key) return acc
      acc[key] = (acc[key] || 0) + Number(order.jumlah || 0)
      return acc
    }, {})
  }, [orders, editingOrderIds])

  const getRemainingStockForProduct = (registrationProductId, qtyInCurrentForm = 0) => {
    if (!registrationProductId) return 0
    const selectedProduct = allowedProducts.find(p => p.registrationProductId === registrationProductId)
    const totalStock = Number(selectedProduct?.offline_stock ?? 0)
    if (!totalStock) return 0
    const usedByOthers = Number(usedStockByOthersMap[registrationProductId] || 0)
    const effectiveUsed = Math.max(0, usedByOthers + Number(qtyInCurrentForm || 0))
    return totalStock - effectiveUsed
  }

  const groupedOrders = useMemo(() => {
    const map = new Map()

    data.forEach(order => {
      const key = isAllWeek ? `${order.week}||${order.pemesan}` : order.pemesan
      const group = map.get(key) || {
        pemesan: order.pemesan,
        week: order.week,
        items: [],
        total: 0,
        statuses: new Set(),
        methods: new Set(),
        statusCounts: {},
        methodCounts: {},
        orderIds: []
      }

      group.items.push(order)
      group.total += Number(order.bayar || 0)
      if (order.status) group.statuses.add(order.status)
      if (order.method) group.methods.add(order.method)
      if (order.status) group.statusCounts[order.status] = (group.statusCounts[order.status] || 0) + 1
      if (order.method) group.methodCounts[order.method] = (group.methodCounts[order.method] || 0) + 1
      group.orderIds.push(order.id)
      map.set(key, group)
    })

    return Array.from(map.values()).map(group => {
      const createdBySet = new Set(group.items.map(item => item.createdByName).filter(Boolean))
      const lastEditedBySet = new Set(group.items.map(item => item.lastEditedByName).filter(Boolean))
      return {
        ...group,
        status: group.statuses.size === 1 ? Array.from(group.statuses)[0] : '-',
        method: group.methods.size === 1 ? Array.from(group.methods)[0] : '-',
        statusDetail: Object.entries(group.statusCounts).map(([name, count]) => `${name} (${count})`).join(', '),
        methodDetail: Object.entries(group.methodCounts).map(([name, count]) => `${name} (${count})`).join(', '),
        createdBy: createdBySet.size === 1 ? Array.from(createdBySet)[0] : (createdBySet.size ? 'Multiple' : '-'),
        lastEditedBy: lastEditedBySet.size === 1 ? Array.from(lastEditedBySet)[0] : (lastEditedBySet.size ? 'Multiple' : '-')
      }
    })
  }, [data, isAllWeek])

  const isStockExceeded = useMemo(() => {
    if (!form.items.length) return false
    return Object.entries(currentGroupQtyByProduct).some(([registrationProductId, fullDraftQty]) => {
      const selectedProduct = allowedProducts.find(p => p.registrationProductId === registrationProductId)
      const totalStock = Number(selectedProduct?.offline_stock ?? 0)
      if (!totalStock) return false
      const usedByOthers = Number(usedStockByOthersMap[registrationProductId] || 0)
      const availableForCurrentForm = Math.max(0, totalStock - usedByOthers)
      return Number(fullDraftQty || 0) > availableForCurrentForm
    })
  }, [form.items, allowedProducts, currentGroupQtyByProduct, usedStockByOthersMap])

  useEffect(() => {
    const weekId = weeks.find(w => w.week_code === sheetName)?.id
    let filtered = (orders || []).filter(o => o.channel === 'offline')

    if (!isAllWeek && weekId) {
      filtered = filtered.filter(o => o.week_id === weekId)
    }

    filtered = filtered
      .map(mapOrderRow)
      .sort((a, b) => (a.pemesan || '').toLowerCase().localeCompare((b.pemesan || '').toLowerCase()))

    setData(filtered)
  }, [orders, weeks, sheetName, isAllWeek])

  useEffect(() => {
    if (currentAnnouncement) {
      const opts = allowedProducts.map(prod => {
        const totalStock = prod.offline_stock ?? 0
        const remaining = totalStock > 0
          ? getRemainingStockForProduct(prod.registrationProductId, currentGroupQtyByProduct[prod.registrationProductId] || 0)
          : 0
        const isDisabled = totalStock > 0 && remaining <= 0
        const baseLabel = `${prod.namaProduk || prod.nama_produk || 'N/A'} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim()
        const stockText = totalStock > 0 ? `${remaining}/${totalStock} stok tersisa` : 'stok tidak terbatas'

        return {
          label: baseLabel,
          value: prod.registrationProductId,
          baseLabel,
          stockText,
          isDisabled,
          data: {
            ...prod,
            remainingStock: remaining,
            totalStock
          },
          registrationProductId: prod.registrationProductId,
          registrationId: prod.registrationId,
          supplierId: prod.supplierId
        }
      })
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
  }, [productData, registeredUsers, currentAnnouncement, allowedProducts, currentGroupQtyByProduct, orders, usedStockByOthersMap])

  const getAdjustedHJK = (val) => {
    const num = parseFloat(val)
    if (!num || num <= 0) return 0
    return num < 1000 ? num * 1000 : num
  }

  const getMostExpensiveItem = (items) => {
    if (!items || items.length === 0) return null
    return items.reduce((max, item) => {
      const maxTotal = Number(max.bayar || max.total_harga || Number(max.jumlah || 0) * getAdjustedHJK(max.harga_satuan || max.data?.hjk || 0))
      const itemTotal = Number(item.bayar || item.total_harga || Number(item.jumlah || 0) * getAdjustedHJK(item.harga_satuan || item.data?.hjk || 0))
      return itemTotal > maxTotal ? item : max
    })
  }

  const getFormItemsFromGroup = (group) => {
    return group.items.map(item => {
      const opt = produkOptions.find(o => o.registrationProductId === item.registrationProductId) || {
        label: item.produkLabel || '',
        value: item.registrationProductId || '',
        data: {
          hjk: item.harga_satuan || 0,
          hpp: item.hpp || 0,
          namaSupplier: item.supplierName || '',
          namaProduk: item.produkLabel || '',
          ukuran: item.registration_products?.ukuran || '',
          satuan: item.registration_products?.satuan || ''
        },
        registrationProductId: item.registrationProductId,
        registrationId: item.registrationId,
        supplierId: item.supplierId
      }

      return {
        orderId: item.id,
        registrationProductId: item.registrationProductId,
        registrationId: item.registrationId,
        supplierId: item.supplierId,
        label: opt.label,
        data: opt.data,
        hargaSatuan: opt.data?.hjk || 0,
        jumlah: item.jumlah,
        catatan: item.catatan || '',
        status: item.status || '',
        method: item.method || ''
      }
    })
  }

  const handleSelectProduk = (option, index) => {
    if (!option || option.isDisabled) return
    setForm(prev => {
      const items = [...prev.items]
      items[index] = {
        ...items[index],
        registrationProductId: option.registrationProductId,
        registrationId: option.registrationId,
        supplierId: option.supplierId,
        label: option.label,
        data: option.data,
        hargaSatuan: option.data?.hjk || 0,
        jumlah: items[index]?.jumlah || 1,
        catatan: items[index]?.catatan || ''
      }
      return { ...prev, items }
    })
  }

  const handleJumlahChange = (val, index) => {
    setForm(prev => {
      const items = [...prev.items]
      items[index] = {
        ...items[index],
        jumlah: val
      }
      return { ...prev, items }
    })
  }

  const handleItemCatatanChange = (val, index) => {
    setForm(prev => {
      const items = [...prev.items]
      items[index] = {
        ...items[index],
        catatan: val
      }
      return { ...prev, items }
    })
  }

  const addItem = () => {
    setForm(prev => {
      const prevItems = prev.items || []
      const statusMethod = prev.status
        ? {
          status: prev.status,
          method: prev.status === 'lunas' ? prev.method : ''
        }
        : {}

      return {
        ...prev,
        items: [
          ...prevItems,
          {
            ...createEmptyItem(),
            ...statusMethod
          }
        ]
      }
    })
  }

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)

    try {
      const { pemesan, items } = form
      const validItems = (items || []).filter(item => item.registrationProductId && item.jumlah)
      const selectedProductIds = validItems.map(item => item.registrationProductId)
      const hasDuplicateProduct = new Set(selectedProductIds).size !== selectedProductIds.length
      const hasOpenBillItem = validItems.some(item => (item.status || (!editingOrderIds.length ? form.status : '')) === 'open_bill')
      const normalizedPemesan = (pemesan || '').trim()
      const effectivePemesan = normalizedPemesan || 'Tanpa Nama'
      const invalidStatusMethod = validItems.some(item => {
        const status = item.status || (!editingOrderIds.length ? form.status : '')
        const methodValue = item.method || (!editingOrderIds.length ? form.method : '')
        return !status || (status === 'lunas' && !methodValue)
      })

      if (!validItems.length || invalidStatusMethod || (hasOpenBillItem && !normalizedPemesan)) {
        Swal.fire('Gagal', 'Semua field * wajib diisi', 'error')
        setLoading(false)
        return
      }
      if (hasDuplicateProduct) {
        Swal.fire('Gagal', 'Produk yang sama tidak boleh dipilih lebih dari satu kali', 'error')
        setLoading(false)
        return
      }

      if (!currentAnnouncement) {
        Swal.fire('Error', 'Tidak ada pengumuman aktif untuk minggu ini', 'error')
        setLoading(false)
        return
      }

      if (isStockExceeded) {
        Swal.fire('Error', 'Stok tidak cukup', 'error')
        setLoading(false)
        return
      }

      const weekId = weeks.find(w => w.week_code === sheetName)?.id
      if (!weekId) {
        Swal.fire('Error', 'Minggu tidak ditemukan', 'error')
        setLoading(false)
        return
      }

      const payloadForItem = (item, isUpdate = false) => {
        const hargaSatuan = item.hargaSatuan || item.data?.hjk || 0
        const jumlah = Number(item.jumlah || 0)
        const status = item.status || (isUpdate ? '' : form.status)
        const methodValue = item.method || (isUpdate ? '' : form.method)
        return {
          week_id: weekId,
          announcement_id: currentAnnouncement.id,
          registration_id: item.registrationId,
          registration_product_id: item.registrationProductId,
          supplier_id: item.supplierId || undefined,
          channel: 'offline',
          pemesan: effectivePemesan,
          jumlah,
          harga_satuan: hargaSatuan,
          catatan: item.catatan || null,
          bayar: jumlah * getAdjustedHJK(hargaSatuan),
          status: status || null,
          method: status === 'lunas' ? (methodValue || null) : null,
          ...(isUpdate ? { last_edited_by: user?.id || null } : { created_by: user?.id || null, last_edited_by: user?.id || null })
        }
      }

      if (editingOrderIds.length) {
        const existingIds = new Set(editingOrderIds)
        const updatePromises = []
        const insertRows = []

        validItems.forEach(item => {
          if (item.orderId && existingIds.has(item.orderId)) {
            existingIds.delete(item.orderId)
            updatePromises.push(
              supabase
                .from('orders')
                .update(payloadForItem(item, true))
                .eq('id', item.orderId)
            )
          } else {
            insertRows.push(payloadForItem(item, false))
          }
        })

        const deleteIds = Array.from(existingIds)
        const deletePromise = deleteIds.length
          ? supabase.from('orders').delete().in('id', deleteIds)
          : Promise.resolve({ error: null })

        const [updateResults, deleteResult, insertResult] = await Promise.all([
          Promise.all(updatePromises),
          deletePromise,
          insertRows.length ? supabase.from('orders').insert(insertRows) : Promise.resolve({ error: null })
        ])

        if (deleteResult?.error) throw deleteResult.error
        if (insertResult?.error) throw insertResult.error
        const failedUpdate = updateResults.find(r => r?.error)
        if (failedUpdate) throw failedUpdate.error

        await fetchOrders()
        Swal.fire('Berhasil', 'Order berhasil diperbarui', 'success')
      } else {
        const inserts = validItems.map(item => payloadForItem(item, false))
        const { error } = await supabase.from('orders').insert(inserts)
        if (error) throw error

        await fetchOrders()
        Swal.fire('Berhasil', 'Order berhasil ditambahkan', 'success')
      }

      setForm(createInitialForm())
      setInitialFormSnapshot(createInitialForm())
      setEditingOrderIds([])
      setOrderModalOpen(false)
    } catch (error) {
      console.error('Error saving order:', error)
      Swal.fire('Error', 'Gagal menyimpan order', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (group) => {
    const items = group.items.map(item => {
      const opt = produkOptions.find(o => o.registrationProductId === item.registrationProductId) || {
        label: item.produkLabel || '',
        value: item.registrationProductId || '',
        data: {
          hjk: item.harga_satuan || 0,
          hpp: item.hpp || 0,
          namaSupplier: item.supplierName || '',
          namaProduk: item.produkLabel || '',
          ukuran: item.registration_products?.ukuran || '',
          satuan: item.registration_products?.satuan || ''
        },
        registrationProductId: item.registrationProductId,
        registrationId: item.registrationId,
        supplierId: item.supplierId
      }
      return {
        orderId: item.id,
        registrationProductId: item.registrationProductId,
        registrationId: item.registrationId,
        supplierId: item.supplierId,
        label: opt.label,
        data: opt.data,
        hargaSatuan: opt.data?.hjk || 0,
        jumlah: item.jumlah,
        catatan: item.catatan || '',
        status: item.status || '',
        method: item.method || ''
      }
    })

    const editForm = {
      pemesan: group.pemesan,
      items: items.length ? items : [createEmptyItem()]
    }
    setForm(editForm)
    setInitialFormSnapshot(cloneForm(editForm))
    setEditingOrderIds(group.orderIds)
    setOrderModalOpen(true)
  }

  const handleDelete = async (group) => {
    const result = await Swal.fire({
      title: `Hapus pemesan ${group.pemesan}?`,
      text: 'Semua order untuk pemesan ini akan dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const { error } = await supabase.from('orders').delete().in('id', group.orderIds)
      if (error) throw error
      await fetchOrders()
      Swal.fire('Dihapus!', 'Order berhasil dihapus.', 'success')
    } catch (error) {
      console.error('Error deleting order:', error)
      Swal.fire('Error', 'Gagal menghapus data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintStruk = (group) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    let strukHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Struk - ${group.pemesan}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 10mm;
            width: 80mm;
            background: white;
          }
          .struk {
            text-align: center;
            margin: 0;
            padding: 0;
          }
          .header {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .content {
            text-align: left;
            margin: 10px 0;
            font-size: 12px;
          }
          .info-line {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .label {
            font-weight: bold;
          }
          .items {
            margin: 10px 0;
          }
          .item {
            margin: 5px 0;
            font-size: 11px;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 3px;
          }
          .item-name {
            font-weight: bold;
          }
          .item-detail {
            display: flex;
            justify-content: space-between;
            margin-top: 2px;
          }
          .total-section {
            margin-top: 10px;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 5px 0;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 13px;
          }
          .footer {
            text-align: center;
            margin-top: 10px;
            font-size: 11px;
          }
          .status {
            margin: 5px 0;
            padding: 3px;
            border: 1px solid #000;
            font-weight: bold;
          }
          @media print {
            body { margin: 0; padding: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="struk">
          <div class="header">BAZAAR FRUK</div>
          <div class="header" style="font-size: 12px; font-weight: normal;">STRUK PEMESANAN</div>
          <div class="divider"></div>
          
          <div class="content">
            <div class="info-line">
              <span class="label">Pemesan:</span>
              <span>${group.pemesan}</span>
            </div>
            <div class="info-line">
              <span class="label">Tanggal:</span>
              <span>${dateStr}</span>
            </div>
            <div class="info-line">
              <span class="label">Waktu:</span>
              <span>${timeStr}</span>
            </div>
            <div class="info-line">
              <span class="label">Minggu/Bazaar:</span>
              <span>${group.week || 'N/A'} - ${group.title}</span>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="items">
    `

    group.items.forEach((item, idx) => {
      const itemTotal = Number(item.bayar || Number(item.jumlah || 0) * getAdjustedHJK(item.data?.hjk || item.harga_satuan || 0))
      const unitPrice = item.jumlah > 0 ? itemTotal / item.jumlah : 0
      strukHTML += `
            <div class="item">
              <div class="item-name">${idx + 1}. ${item.produkLabel}</div>
              <div class="item-detail">
                <span>${item.jumlah} x Rp${unitPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                <span>Rp${itemTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              ${item.catatan ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">Catatan: ${item.catatan}</div>` : ''}
            </div>
      `
    })

    const totalAmount = group.total || 0
    strukHTML += `
          </div>
          
          <div class="divider"></div>
          
          <div class="total-section">
            <div class="total-line">
              <span>TOTAL:</span>
              <span>Rp${totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          
          <div class="content" style="margin-top: 10px;">
            <div class="info-line">
              <span class="label">Status:</span>
              <span>${group.status === '-' ? '-' : group.status.toUpperCase()}</span>
            </div>
            <div class="info-line">
              <span class="label">Method:</span>
              <span>${group.method === '-' ? '-' : group.method.toUpperCase()}</span>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p style="margin: 5px 0;">Terima kasih</p>
            <p style="margin: 5px 0; font-size: 10px;">Bazaar FRUK<br>desofita@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '', 'width=400,height=600')
    printWindow.document.write(strukHTML)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const columns = [
    { name: 'No', selector: (r, i) => i + 1, width: '5%', wrap: true },
    ...(isAllWeek ? [{ name: 'Minggu', selector: r => r.week, wrap: true }] : []),
    { name: 'Pemesan', selector: r => r.pemesan, wrap: true, width: '17%' },
    {
      name: 'Produk',
      cell: row => {
        const key = row.orderIds ? row.orderIds.join('-') : row.pemesan
        const isExpanded = expandedRows.has(key)
        const mostExpensive = getMostExpensiveItem(row.items)
        const itemsToShow = isExpanded ? row.items : (mostExpensive ? [mostExpensive] : [])
        return (
          <div className="d-flex flex-column gap-2 py-1 position-relative">
            {itemsToShow.map((item, idx) => {
              const itemTotal = Number(item.bayar || Number(item.jumlah || 0) * getAdjustedHJK(item.data?.hjk || item.harga_satuan || 0))
              const statusColor = item.status === 'lunas' ? 'success' : item.status === 'open_bill' ? 'danger' : 'secondary'
              return (
                <div key={item.orderId || `${item.registrationProductId}-${item.jumlah}-${idx}`} className="border rounded p-2">
                  <div className="fw-semibold">{item.produkLabel}</div>
                  <div className="small text-muted">
                    {item.jumlah} x Rp{(item.jumlah > 0 ? itemTotal / item.jumlah : 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    {' '}= Rp{itemTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="d-flex gap-1 mt-1">
                    <Badge color={statusColor}>{item.status === 'open_bill' ? 'Open Bill' : (item.status || '-')}</Badge>
                    {item.method ? <Badge color="primary">{item.method.toUpperCase()}</Badge> : null}
                    {!isExpanded && row.items.length > 1 && (
                      <Badge color="secondary">
                        +{row.items.length - 1}
                      </Badge>
                    )}
                  </div>
                  {item.catatan ? <div className="text-muted small">{item.catatan}</div> : null}
                </div>
              )
            })}
          </div>
        )
      },
      wrap: true,
      width: '23%'
    },
    {
      name: 'Total',
      selector: row => {
        const total = Number(row.total || 0)
        if (!total || total <= 0) return '-'
        return `Rp${total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      },
      sortable: true,
      wrap: true,
      width: '9%'
    },
    {
      name: 'Status',
      cell: row => {
        if (!row.status) return '-'
        if (row.status === '-') {
          const counts = row.items.reduce((acc, item) => {
            if (!item.status) return acc
            acc[item.status] = (acc[item.status] || 0) + 1
            return acc
          }, {})
          return (
            <div className="d-flex gap-1 flex-wrap">
              {Object.entries(counts).map(([statusName, count]) => (
                <Badge key={statusName} color={statusName === 'lunas' ? 'success' : statusName === 'open_bill' ? 'danger' : 'secondary'}>
                  {count}x {statusName === 'open_bill' ? 'Open Bill' : statusName}
                </Badge>
              ))}
            </div>
          )
        }
        const map = {
          lunas: { color: 'success', label: 'Lunas' },
          open_bill: { color: 'danger', label: 'Open Bill' }
        }
        const config = map[row.status] || { color: 'secondary', label: row.status === '-' ? '-' : row.status }
        return <Badge color={config.color}>{config.label}</Badge>
      },
      wrap: true,
      width: '7%'
    },
    {
      name: 'Method',
      cell: row => {
        if (!row.method) return '-'
        if (row.method === '-') {
          const counts = row.items.reduce((acc, item) => {
            if (!item.method) return acc
            acc[item.method] = (acc[item.method] || 0) + 1
            return acc
          }, {})
          return (
            <div className="d-flex gap-1 flex-wrap">
              {Object.entries(counts).map(([methodName, count]) => (
                <Badge key={methodName} color="primary">{count}x {methodName.toUpperCase()}</Badge>
              ))}
            </div>
          )
        }
        return <Badge color="primary">{row.method.toUpperCase()}</Badge>
      },
      wrap: true,
      width: '8%'
    },
    {
      name: 'Dibuat',
      selector: row => row.createdBy || '-',
      wrap: true,
      width: '12%'
    },
    {
      name: 'Terakhir Diubah',
      selector: row => row.lastEditedBy || '-',
      wrap: true,
      width: '12%'
    },
    {
      name: 'Aksi',
      cell: row => (
        <div>
          {/* <Button size="sm" color="info" className="me-2" onClick={(e) => { e.stopPropagation(); handlePrintStruk(row); }} disabled={loading}>
            <Printer size={16} />
          </Button> */}
          <Button size="sm" color="warning" className='mb-1' onClick={(e) => { e.stopPropagation(); handleEdit(row); }} disabled={loading || isAllWeek}>
            <Edit size={16} />
          </Button>
          <Button size="sm" color="danger" onClick={(e) => { e.stopPropagation(); handleDelete(row); }} disabled={loading}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
      wrap: true,
      width: '7%'
    }
  ]

  const filtered = groupedOrders.filter(row => {
    const concatenated = [row.pemesan, row.week, row.status, row.method, row.items.map(i => i.produkLabel).join(' ')].join(' ').toLowerCase()
    const matchSearch = concatenated.includes(searchText.toLowerCase())
    const matchPemesan = selectedPemesan ? row.pemesan === selectedPemesan.value : true
    const matchWeek = selectedWeek ? row.week === selectedWeek.value : true
    const matchStatus = selectedStatus
      ? (row.status === selectedStatus.value || row.items.some(item => item.status === selectedStatus.value))
      : true
    const matchMethod = selectedMethod
      ? (row.method === selectedMethod.value || row.items.some(item => item.method === selectedMethod.value))
      : true
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

  const totalProduk = (form.items || []).reduce(
    (acc, item) => acc + Number(item.jumlah || 0),
    0
  )

  const totalBelanja = (form.items || []).reduce(
    (acc, item) => {
      const harga = item.hargaSatuan || item.data?.hjk || 0
      return acc + (Number(item.jumlah || 0) * getAdjustedHJK(harga))
    },
    0
  )

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

    filtered.forEach(group => {
      const groupTotalQty = group.items.reduce((sum, item) => sum + Number(item.jumlah || 0), 0)
      const groupTotalPrice = group.items.reduce((sum, item) => {
        const jumlahProduk = Number(item.jumlah || 0)
        const hargaSatuanRaw = Number(item.harga_satuan || item.hargaSatuan || item.data?.hjk || 0)
        const hargaSatuan = getAdjustedHJK(hargaSatuanRaw)
        const totalHarga = Number(item.bayar || item.total_harga || jumlahProduk * hargaSatuan)
        return sum + totalHarga
      }, 0)

      group.items.forEach((item, index) => {
        const hargaSatuanRaw = Number(item.harga_satuan || item.hargaSatuan || item.data?.hjk || 0)
        const hargaSatuan = getAdjustedHJK(hargaSatuanRaw)
        const jumlahProduk = Number(item.jumlah || 0)
        const totalHarga = Number(item.bayar || item.total_harga || jumlahProduk * hargaSatuan)
        data.push({
          type: 'item',
          pemesan: index === 0 ? (group.pemesan || 'Tanpa Nama') : '',
          produk: item.produkLabel || item.label || item.registration_products?.nama_produk || '',
          harga_satuan: hargaSatuan,
          jumlah_produk: jumlahProduk,
          total_harga: totalHarga,
          status: item.status || '',
          metode_bayar: item.method || '',
          jam: formatUtc7(item.created_at),
          created_by: item.createdByName || '',
          edited_by: item.lastEditedByName || ''
        })
      })

      data.push({
        type: 'subtotal',
        pemesan: `Total ${group.pemesan || 'Tanpa Nama'}`,
        produk: '',
        harga_satuan: '',
        jumlah_produk: groupTotalQty,
        total_harga: groupTotalPrice,
        status: '',
        metode_bayar: '',
        jam: '',
        created_by: '',
        edited_by: ''
      })
      grandTotal += groupTotalPrice
      grandTotalQty += groupTotalQty
    })

    if (data.length) {
      data.push({
        type: 'grand_total',
        pemesan: 'TOTAL PENJUALAN',
        produk: '',
        harga_satuan: '',
        jumlah_produk: grandTotalQty,
        total_harga: grandTotal,
        status: '',
        metode_bayar: '',
        jam: '',
        created_by: '',
        edited_by: ''
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
      const worksheet = workbook.addWorksheet('Offline Orders')

      const headerRow = ['PEMESAN', 'PRODUK', 'HARGA SATUAN', 'JUMLAH PRODUK', 'TOTAL HARGA', 'STATUS', 'METODE BAYAR', 'JAM', 'DIBUAT OLEH', 'DIUBAH OLEH']
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
          row.harga_satuan,
          row.jumlah_produk,
          row.total_harga,
          row.status,
          row.metode_bayar,
          row.jam,
          row.created_by,
          row.edited_by
        ])

        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }

          if (row.type === 'subtotal') {
            cell.font = { bold: false, color: { argb: 'FF000000' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
          }

          if ([3, 4, 5].includes(colNumber)) {
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
        ? `offline-orders-all-weeks-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `W${activeWeek} - ${announcementName} - ${new Date().toISOString().slice(0, 10)}.xlsx`

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

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>{isAllWeek ? 'Semua Minggu - Offline' : `Minggu ${activeWeek} - Offline`}</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0 d-flex flex-wrap gap-2 justify-content-md-end">
          <Button
            color="primary"
            disabled={loading || isAllWeek}
            onClick={() => {
              const newForm = createInitialForm()
              setForm(newForm)
              setInitialFormSnapshot(cloneForm(newForm))
              setEditingOrderIds([])
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
          <Button color="danger" onClick={() => {
            setSearchText('')
            setSelectedPemesan(null)
            setSelectedWeek(null)
            setSelectedStatus(null)
            setSelectedMethod(null)
          }} disabled={loading}>
            Reset Filter
          </Button>
        </Col>
      </Row>
      <div className="mb-2">
        <Row className="mb-3">
          <Col xs="12" md="3" className="mb-2 mb-md-0">
            <Input
              placeholder="🔍 Cari apa aja..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              disabled={loading}
            />
          </Col>
          <Col xs="12" md="3" className="mb-2 mb-md-0">
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
            <>
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
        </Row>
      </div>

      <Modal isOpen={orderModalOpen} toggle={() => setOrderModalOpen(false)} size="lg" centered>
        <ModalHeader toggle={() => setOrderModalOpen(false)}>
          {editingOrderIds.length ? 'Edit order offline' : 'Order offline baru'} {!isAllWeek && `(minggu ${activeWeek})`}
        </ModalHeader>
        <Form onSubmit={handleSubmit}>
          <ModalBody>
            <Row className="mb-2">
              <Col xs="12" sm="12" className="mb-2">
                <Label>
                  Pemesan {form.items.some(item => item.status === 'open_bill') ? '*' : '(opsional jika semua lunas)'}
                </Label>
                <Input
                  value={form.pemesan}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, pemesan: e.target.value }))
                  }}
                  disabled={loading || isAllWeek}
                  placeholder={form.items.some(item => item.status === 'open_bill') ? 'Isi nama pemesan' : 'Jika kosong akan disimpan sebagai Tanpa Nama'}
                  list={!isAllWeek ? 'pemesan-suggestions-offline' : undefined}
                />
                {!isAllWeek && (
                  <datalist id="pemesan-suggestions-offline">
                    {uniquePemesanThisWeek.filter(p => p !== 'Tanpa Nama').map((p, i) => (
                      <option key={i} value={p} />
                    ))}
                  </datalist>
                )}
              </Col>
            </Row>

            {(form.items || []).map((item, index) => {
              const selectedOption = produkOptions.find(opt => opt.registrationProductId === item.registrationProductId) || null
              const itemTotal = Number(item.jumlah || 0) * getAdjustedHJK(item.hargaSatuan || item.data?.hjk || 0)
              const selectedProduct = allowedProducts.find(p => p.registrationProductId === item.registrationProductId)
              const totalStock = Number(selectedProduct?.offline_stock ?? item.data?.totalStock ?? 0)
              const fullDraftQty = currentGroupQtyByProduct[item.registrationProductId] || 0
              const dynamicRemaining = totalStock > 0 ? getRemainingStockForProduct(item.registrationProductId, fullDraftQty) : null
              const usedByOthers = Number(usedStockByOthersMap[item.registrationProductId] || 0)
              const availableForCurrentForm = totalStock > 0 ? Math.max(0, totalStock - usedByOthers) : 0
              const stockExceeded = totalStock > 0 && Number(fullDraftQty || 0) > availableForCurrentForm
              const selectedInOtherRows = (form.items || [])
                .some((other, otherIndex) => otherIndex !== index && other.registrationProductId === item.registrationProductId)
              return (
                <div key={item.orderId || index} className="border rounded p-3 mb-3 bg-light-subtle position-relative">
                  <Row className="align-items-start">
                    <Col xs="12" md="6" className="mb-2">
                      <Label>Produk *</Label>
                      <Select
                        options={produkOptions}
                        value={selectedOption}
                        onChange={(option) => handleSelectProduk(option, index)}
                        placeholder="Pilih produk"
                        isSearchable
                        isDisabled={loading || isAllWeek}
                        isOptionDisabled={(option) => {
                          if (option.isDisabled) return true
                          const selectedByOtherItem = (form.items || []).some(
                            (other, otherIndex) => otherIndex !== index && other.registrationProductId === option.registrationProductId
                          )
                          return selectedByOtherItem
                        }}
                        formatOptionLabel={(option) => (
                          <div style={{ opacity: option.isDisabled ? 0.5 : 1 }}>
                            <div>
                              {option.baseLabel}
                              {option.isDisabled && (
                                <span className="text-danger ms-2">(habis)</span>
                              )}
                              {(form.items || []).some(
                                (other, otherIndex) => otherIndex !== index && other.registrationProductId === option.registrationProductId
                              ) && (
                                  <span className="text-warning ms-2">(sudah dipilih)</span>
                                )}
                            </div>
                            <small className="text-muted">{option.stockText}</small>
                          </div>
                        )}
                      />
                    </Col>

                    <Col xs="6" md="3" className="mb-2">
                      <Label>Jumlah *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.jumlah}
                        onChange={(e) => handleJumlahChange(e.target.value, index)}
                        disabled={loading || isAllWeek}
                        invalid={stockExceeded}
                      />
                    </Col>

                    <Col xs="6" md="3" className="mb-2">
                      <Label>Subtotal</Label>
                      <Input
                        readOnly
                        value={itemTotal > 0 ? `Rp${itemTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : ''}
                        disabled
                      />
                    </Col>

                    <Col xs="12" md="1" className="mb-2">
                      <Button
                        color="danger"
                        size="sm"
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={loading || isAllWeek}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      >
                        X
                      </Button>
                    </Col>

                    <Col xs="12" className="mb-1">
                      <hr className="my-1" />
                    </Col>

                    <Col xs="12" md={editingOrderIds.length > 0 && 4 || 12} className="mb-2">
                      <Label>Catatan</Label>
                      <Input
                        value={item.catatan}
                        onChange={(e) => handleItemCatatanChange(e.target.value, index)}
                        disabled={loading || isAllWeek}
                        placeholder="Catatan untuk produk ini"
                      />
                    </Col>

                    {editingOrderIds.length > 0 && (
                      <>
                        <Col xs="12" md="4" className="mb-2">
                          <Label>Status produk *</Label>
                          <Select
                            options={statusOptions}
                            value={statusOptions.find((o) => o.value === item.status) || null}
                            onChange={(option) => {
                              setForm((prev) => {
                                const nextItems = [...prev.items]
                                nextItems[index] = {
                                  ...nextItems[index],
                                  status: option ? option.value : '',
                                  method: option?.value === 'lunas' ? nextItems[index].method : ''
                                }
                                return { ...prev, items: nextItems }
                              })
                            }}
                            placeholder="Pilih status"
                            isDisabled={loading || isAllWeek}
                          />
                        </Col>

                        <Col xs="12" md="4" className="mb-2">
                          <Label>Method produk {item.status === 'lunas' ? '*' : ''}</Label>
                          <Select
                            options={methodOptions}
                            value={methodOptions.find((o) => o.value === item.method) || null}
                            onChange={(option) => {
                              setForm((prev) => {
                                const nextItems = [...prev.items]
                                nextItems[index] = {
                                  ...nextItems[index],
                                  method: option ? option.value : ''
                                }
                                return { ...prev, items: nextItems }
                              })
                            }}
                            placeholder={item.status === 'lunas' ? 'Pilih method' : 'Method hanya untuk status lunas'}
                            isDisabled={loading || isAllWeek || item.status !== 'lunas'}
                          />
                        </Col>
                      </>
                    )}

                    {(stockExceeded || selectedInOtherRows) && (
                      <Col xs="12">
                        <div className="text-danger small">
                          {stockExceeded ? `Stok tidak cukup, sisa ${Math.max(0, Number(dynamicRemaining || 0))}. ` : ''}
                        </div>
                      </Col>
                    )}
                  </Row>
                </div>
              )
            })}

            <Row className="mb-3 align-items-end g-3">
              {!editingOrderIds.length ? (
                <>
                  <Col xs="12" md="4">
                    <Label>Status semua produk *</Label>
                    <Select
                      options={statusOptions}
                      value={statusOptions.find((o) => o.value === form.status) || null}
                      onChange={(option) => {
                        setForm((prev) => ({
                          ...prev,
                          status: option?.value || '',
                          method: option?.value === 'lunas' ? prev.method : '',
                          items: prev.items.map(item => ({
                            ...item,
                            status: option?.value || '',
                            method: option?.value === 'lunas' ? item.method : ''
                          }))
                        }))
                      }}
                      placeholder="Pilih status"
                      isDisabled={loading || isAllWeek}
                    />
                  </Col>
                  <Col xs="12" md="4">
                    <Label>Method semua produk {form.status === 'lunas' ? '*' : ''}</Label>
                    <Select
                      options={methodOptions}
                      value={methodOptions.find((o) => o.value === form.method) || null}
                      onChange={(option) => setForm((prev) => ({ ...prev, method: option?.value || '' }))}
                      placeholder={form.status === 'lunas' ? 'Pilih method' : 'Status lunas untuk pilihan'}
                      isDisabled={loading || isAllWeek || form.status !== 'lunas'}
                    />
                  </Col>
                  <Col xs="12" md="4" className="d-flex justify-content-md-end">
                    <Button color="success" type="button" onClick={addItem} disabled={loading || isAllWeek}>
                      Tambah produk
                    </Button>
                  </Col>
                </>
              ) : (
                <Col xs="12" className="d-flex justify-content-start">
                  <Button color="success" type="button" onClick={addItem} disabled={loading || isAllWeek}>
                    Tambah produk
                  </Button>
                </Col>
              )}
            </Row>
            <Row className="mb-3">
              <Col xs="12">
                <div className="border rounded p-3 bg-light">
                  <div>
                    <strong>Total Produk:</strong> {totalProduk}
                  </div>

                  <div>
                    <strong>Total Belanja:</strong>{' '}
                    Rp{totalBelanja.toLocaleString('id-ID', {
                      maximumFractionDigits: 0
                    })}
                  </div>
                </div>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setOrderModalOpen(false)}>
              Batal
            </Button>
            <Button
              color="warning"
              type="button"
              onClick={() => setForm(cloneForm(initialFormSnapshot))}
              disabled={loading || isAllWeek}
            >
              Reset
            </Button>
            <Button
              color="primary"
              type="submit"
              disabled={loading || isAllWeek || isStockExceeded}
            >
              {loading ? 'Menyimpan…' : editingOrderIds.length ? 'Simpan' : 'Tambah'}
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
          onRowClicked={(row) => {
            const key = row.orderIds ? row.orderIds.join('-') : row.pemesan
            setExpandedRows(prev => {
              const newSet = new Set(prev)
              if (newSet.has(key)) {
                newSet.delete(key)
              } else {
                newSet.add(key)
              }
              return newSet
            })
          }}
        />
      </div>
    </div>
  )
}

export default WeekOffline