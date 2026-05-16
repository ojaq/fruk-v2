import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [productData, setProductData] = useState({})
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [weeks, setWeeks] = useState([])
  const [bazaarData, setBazaarData] = useState(null)
  const [weekData, setWeekData] = useState({})
  const [announcements, setAnnouncements] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [orders, setOrders] = useState([])

  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const toggleProfileModal = () => setProfileModalOpen(prev => !prev)

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_deleted', false)
      .order('name')

    if (error) {
      Swal.fire('Error', 'Gagal mengambil users', 'error')
      return
    }
    setUsers(data)
  }

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_deleted', false)

    if (error) {
      Swal.fire('Error', 'Gagal mengambil produk', 'error')
      return
    }
    setProducts(data)
  }

  useEffect(() => {
    const usersById = {}
    users.forEach(u => { usersById[u.id] = u })

    const mapped = products.map(p => {
      const owner = usersById[p.owner_id]
      return {
        id: p.id,
        ownerId: p.owner_id,
        namaProduk: p.nama_produk,
        jenisProduk: p.jenis_produk,
        keterangan: p.keterangan,
        satuan: p.satuan,
        ukuran: p.ukuran,
        hjk: p.hjk,
        hpp: p.hpp,
        aktif: p.aktif,
        imageUrl: p.image_url,
        isDeleted: p.is_deleted,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        namaSupplier: owner?.nama_supplier || owner?.namaSupplier || owner?.name || null,
        namaBank: owner?.nama_bank || owner?.namaBank || null,
        noRekening: owner?.no_rekening || owner?.noRekening || null,
        noTelp: owner?.phone_number || null,
        namaPenerima: owner?.nama_penerima || owner?.namaPenerima || null
      }
    })

    const grouped = {}
    mapped.forEach(p => {
      const owner = usersById[p.ownerId]
      const ownerName = owner?.name || 'unknown'
      if (!grouped[ownerName]) grouped[ownerName] = []
      grouped[ownerName].push(p)
    })
    setProductData(grouped)

    const allowedRoles = ['supplier', 'admin', 'dev']
    const regs = users
      .filter(u => allowedRoles.includes(u.role) && !u.is_deleted)
      .map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        namaSupplier: u.nama_supplier || u.namaSupplier || null,
        namaBank: u.nama_bank || u.namaBank || null,
        noRekening: u.no_rekening || u.noRekening || null,
        noTelp: u?.phone_number || null,
        namaPenerima: u.nama_penerima || u.namaPenerima || null
      }))

    setRegisteredUsers(regs)
  }, [users, products])

  const saveProductData = async (supplierName, productsArray) => {
    try {
      const owner = users.find(u => u.name === supplierName)
      if (!owner) throw new Error('Owner not found')

      const ops = productsArray.map(async p => {
        const payload = {
          owner_id: owner.id,
          nama_produk: p.namaProduk,
          jenis_produk: p.jenisProduk,
          keterangan: p.keterangan,
          satuan: p.satuan,
          ukuran: p.ukuran,
          hjk: p.hjk,
          hpp: p.hpp,
          image_url: p.imageUrl || null,
          aktif: !!p.aktif,
          is_deleted: !!p.isDeleted
        }

        if (p.id) {
          const { error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', p.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('products')
            .insert([payload])
          if (error) throw error
        }
      })

      await Promise.all(ops)
      await fetchProducts()
      Swal.fire('Berhasil', 'Data produk tersimpan', 'success')
    } catch (e) {
      console.error(e)
      Swal.fire('Error', 'Gagal menyimpan produk', 'error')
      throw e
    }
  }

  const buildBazaarData = () => {
    const anns = (announcements || []).map(a => {
      const creator = users.find(u => u.id === a.created_by)

      const week = a.week_id && weekData ? Object.values(weekData).find(w => w.id === a.week_id) : null

      return {
        id: a.id,
        title: a.title,
        greeting: a.greeting,
        description: a.description,
        terms: a.terms,
        status: a.status,

        onlineDateStart: a.online_date_start,
        onlineDateEnd: a.online_date_end,
        offlineDate: a.offline_date,
        deliveryDate: a.delivery_date,
        deliveryTime: a.delivery_time,
        registrationDeadline: a.registration_deadline,

        maxSuppliersOnline: a.max_suppliers_online,
        maxSuppliersOffline: a.max_suppliers_offline,
        maxProductsPerSupplier: a.max_products_per_supplier,

        weekCode: week ? `W${Object.keys(weekData).find(k => weekData[k].id === week.id).replace('W', '')}` : null,

        createdAt: a.created_at,
        updatedAt: a.updated_at,
        createdBy: creator?.name || null,
        isDeleted: a.is_deleted || false
      }
    })

    const regs = (registrations || []).map(r => {
      const supplier = users.find(u => u.id === r.supplier_id)
      const reviewer = users.find(u => u.id === r.reviewed_by)

      return {
        id: r.id,
        announcementId: r.announcement_id,
        supplierId: r.supplier_id,
        supplierName: supplier?.nama_supplier || supplier?.name || null,

        status: r.status,
        notes: r.notes,
        adminNotes: r.adminNotes,

        participateOnline: r.participate_online,
        participateOffline: r.participate_offline,
        useSameProducts: r.use_same_products,
        offlineStock: r.offline_stock,

        reviewedBy: reviewer?.name || null,

        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isDeleted: r.is_deleted || false,

        registrationProducts: (r.registration_products || []).map(p => ({
          id: p.id,
          registrationId: p.registration_id,
          channel: p.channel,

          namaProduk: p.nama_produk,
          jenisProduk: p.jenis_produk,
          keterangan: p.keterangan,
          satuan: p.satuan,
          ukuran: p.ukuran,
          hjk: p.hjk,
          hpp: p.hpp,
          imageUrl: p.image_url,
          offline_stock: p.offline_stock,

          productId: p.product_id,

          isActive: p.is_active,
          isDeleted: p.is_deleted,
          createdAt: p.created_at
        }))
      }
    })

    setBazaarData({
      announcements: anns,
      registrations: regs
    })
  }

  useEffect(() => {
    const weekMap = {}

      ; (weeks || []).forEach(w => {
        const code = w.week_code || null
        if (!code) return
        weekMap[code] = {
          id: w.id,
          isActive: w.is_active,
          createdAt: w.created_at
        }
      })

    setWeekData(weekMap)
  }, [weeks])

  useEffect(() => {
    buildBazaarData()
  }, [announcements, registrations, users, weekData])

  const logBazaarAction = async ({ user: actionUser, action, target, targetId, dataBefore, dataAfter, description }) => {
    try {
      await supabase.from('bazaar_logs').insert([{ user_name: actionUser?.name || actionUser?.id || null, action, target, target_id: targetId, data_before: dataBefore || null, data_after: dataAfter || null, description }])
    } catch (e) {

      console.debug('bazaar_logs insert failed (may be absent in new schema)', e?.message || e)
    }
  }

  const syncRegistrationProducts = async (registrationId, products = []) => {
    if (!Array.isArray(products)) return

    const { data: existingProducts, error: existingErr } = await supabase
      .from('registration_products')
      .select('*')
      .eq('registration_id', registrationId)
      .eq('is_deleted', false)

    if (existingErr) throw existingErr

    const existingBySnapshotId = new Map(
      existingProducts.map(p => [p.id, p])
    )

    const existingByProductChannel = new Map(
      existingProducts
        .filter(p => p.product_id)
        .map(p => [`${p.product_id}::${p.channel}`, p])
    )

    const touchedIds = new Set()

    const updates = []
    const inserts = []

    for (const p of products) {
      const normalized = {
        registration_id: registrationId,
        channel: p.channel,
        nama_produk: p.nama_produk || p.namaProduk || p.label || null,
        jenis_produk: p.jenis_produk || p.jenisProduk || null,
        keterangan: p.keterangan || null,
        satuan: p.satuan || null,
        ukuran: p.ukuran || null,
        hjk: p.hjk || null,
        hpp: p.hpp || null,
        image_url: p.image_url || p.imageUrl || null,
        offline_stock: p.offline_stock ?? p.offlineStock ?? null,
        product_id: p.product_id || p.productId || null,
        is_active: p.isActive === undefined ? true : p.isActive,
        is_deleted: false
      }

      let existing = null

      if (p.id && existingBySnapshotId.has(p.id)) {
        existing = existingBySnapshotId.get(p.id)
      } else if (
        normalized.product_id &&
        existingByProductChannel.has(`${normalized.product_id}::${normalized.channel}`)
      ) {
        existing = existingByProductChannel.get(`${normalized.product_id}::${normalized.channel}`)
      }

      if (existing) {
        touchedIds.add(existing.id)

        updates.push({
          id: existing.id,
          ...normalized
        })
      } else {
        inserts.push(normalized)
      }
    }

    const deleteIds = existingProducts
      .filter(p => !touchedIds.has(p.id))
      .map(p => p.id)

    if (updates.length) {
      for (const row of updates) {
        const { id, ...payload } = row

        const { error } = await supabase
          .from('registration_products')
          .update(payload)
          .eq('id', id)

        if (error) throw error
      }
    }

    if (inserts.length) {
      const { error } = await supabase
        .from('registration_products')
        .insert(inserts)

      if (error) throw error
    }

    if (deleteIds.length) {
      const { error } = await supabase
        .from('registration_products')
        .update({ is_deleted: true })
        .in('id', deleteIds)

      if (error) throw error
    }
  }

  const saveBazaarData = async (newBazaarData) => {
    try {
      const incomingAnns = (newBazaarData?.announcements || []).slice()
      const existingAnnIds = (announcements || []).map(a => a.id)
      for (const ann of incomingAnns) {
        const payload = {
          title: ann.title,
          greeting: ann.greeting,
          description: ann.description,
          terms: ann.terms,
          status: ann.status,
          online_date_start: ann.onlineDateStart || null,
          online_date_end: ann.onlineDateEnd || null,
          offline_date: ann.offlineDate || null,
          delivery_date: ann.deliveryDate || null,
          delivery_time: ann.deliveryTime || null,
          registration_deadline: ann.registrationDeadline || null,
          max_suppliers_online: ann.maxSuppliersOnline || null,
          max_suppliers_offline: ann.maxSuppliersOffline || null,
          max_products_per_supplier: ann.maxProductsPerSupplier || null,
          is_deleted: ann.isDeleted || false
        }

        const weekCode = ann.weekCode && typeof ann.weekCode === 'string' ? ann.weekCode : null
        if (weekCode) {
          let week = weeks.find(w => w.week_code === weekCode)
          if (!week) {
            const { data: newWeek, error } = await supabase
              .from('weeks')
              .insert([{ week_code: weekCode }])
              .select()
              .single()
            if (error) throw error
            week = newWeek
            await fetchWeeks()
          }
          payload.week_id = week.id
        }
        if (ann.id) {
          await supabase.from('announcements').update(payload).eq('id', ann.id)
        } else {
          payload.created_by = user?.id || null
          await supabase.from('announcements').insert([payload])
        }
      }

      const incomingIds = new Set(incomingAnns.map(a => a.id).filter(Boolean))
      const deletedWeekIds = new Set()
      for (const existing of announcements || []) {
        if (existing && !incomingIds.has(existing.id)) {
          await supabase
            .from('announcements')
            .update({ is_deleted: true })
            .eq('id', existing.id)
        }
      }

      const incomingRegs = (newBazaarData?.registrations || []).slice()
      const existingRegIds = (registrations || []).map(r => r.id)
      for (const reg of incomingRegs) {
        const payload = {
          announcement_id: reg.announcementId,
          supplier_id: (() => {
            const u =
              users.find(
                x =>
                  x.name === reg.supplierName ||
                  x.nama_supplier === reg.supplierName ||
                  x.namaSupplier === reg.supplierName
              ) || users.find(x => x.id === reg.supplierId)

            return u ? u.id : reg.supplierId || null
          })(),

          status: reg.status,
          notes: reg.notes || null,
          adminNotes: reg.adminNotes || null,
          participate_online: reg.participateOnline || false,
          participate_offline: reg.participateOffline || false,
          use_same_products: reg.useSameProducts || false,
          offline_stock: reg.offlineStock || null,

          reviewed_by: (() => {
            const u = users.find(x => x.name === reg.reviewedBy)
            return u ? u.id : null
          })(),

          is_deleted: reg.isDeleted || false
        }

        if (reg.id && existingRegIds.includes(reg.id)) {
          const currentReg = registrations.find(r => r.id === reg.id)

          const hasChanges =
            JSON.stringify({
              status: currentReg.status,
              notes: currentReg.notes,
              adminNotes: currentReg.adminNotes,
              participate_online: currentReg.participate_online,
              participate_offline: currentReg.participate_offline,
              use_same_products: currentReg.use_same_products,
              offline_stock: currentReg.offline_stock,
              is_deleted: currentReg.is_deleted
            }) !== JSON.stringify({
              status: payload.status,
              notes: payload.notes,
              adminNotes: payload.adminNotes,
              participate_online: payload.participate_online,
              participate_offline: payload.participate_offline,
              use_same_products: payload.use_same_products,
              offline_stock: payload.offline_stock,
              is_deleted: payload.is_deleted
            })

          if (hasChanges) {
            await supabase
              .from('registrations')
              .update(payload)
              .eq('id', reg.id)
          }

          if (Array.isArray(reg.registrationProducts)) {
            const currentReg = registrations.find(r => r.id === reg.id)

            const currentProducts = (currentReg?.registration_products || [])
              .map(p => ({
                channel: p.channel,
                nama_produk: p.nama_produk,
                jenis_produk: p.jenis_produk,
                keterangan: p.keterangan,
                satuan: p.satuan,
                ukuran: p.ukuran,
                hjk: p.hjk,
                hpp: p.hpp,
                image_url: p.image_url,
                offline_stock: p.offline_stock,
                product_id: p.product_id,
                is_active: p.is_active,
                is_deleted: p.is_deleted
              }))
              .sort((a, b) => (a.product_id || '').localeCompare(b.product_id || ''))

            const incomingProducts = reg.registrationProducts
              .map(p => ({
                channel: p.channel,
                nama_produk: p.nama_produk || p.namaProduk || p.label || null,
                jenis_produk: p.jenis_produk || p.jenisProduk || null,
                keterangan: p.keterangan || null,
                satuan: p.satuan || null,
                ukuran: p.ukuran || null,
                hjk: p.hjk || null,
                hpp: p.hpp || null,
                image_url: p.image_url || p.imageUrl || null,
                offline_stock: p.offline_stock ?? p.offlineStock ?? null,
                product_id: p.product_id || p.productId || null,
                is_active: p.isActive === undefined ? true : p.isActive,
                is_deleted: false
              }))
              .sort((a, b) => (a.product_id || '').localeCompare(b.product_id || ''))

            if (
              JSON.stringify(currentProducts) !==
              JSON.stringify(incomingProducts)
            ) {
              await syncRegistrationProducts(
                reg.id,
                reg.registrationProducts
              )
            }
          }
        }

        else {
          let { data: newReg, error: regErr } = await supabase
            .from('registrations')
            .insert([payload])
            .select()
            .single()

          if (regErr && regErr.code === '23505') {
            const { data: existingReg, error: existingErr } =
              await supabase
                .from('registrations')
                .select('id')
                .eq('announcement_id', payload.announcement_id)
                .eq('supplier_id', payload.supplier_id)
                .maybeSingle()

            if (existingErr) throw existingErr
            if (!existingReg?.id) throw regErr

            await supabase
              .from('registrations')
              .update({
                ...payload,
                is_deleted: false
              })
              .eq('id', existingReg.id)

            newReg = { id: existingReg.id }
          } else if (regErr) {
            throw regErr
          }

          if (Array.isArray(reg.registrationProducts)) {
            await syncRegistrationProducts(
              newReg.id,
              reg.registrationProducts
            )
          }
        }
      }

      const incomingRegIds = new Set(incomingRegs.map(r => r.id).filter(Boolean))
      for (const existing of registrations || []) {
        if (existing && !incomingRegIds.has(existing.id)) {
          await supabase.from('registrations').update({ is_deleted: true }).eq('id', existing.id)
        }
      }

      await Promise.all([
        fetchAnnouncements(),
        fetchRegistrations(),
        fetchWeeks()
      ])
    } catch (e) {
      console.error('saveBazaarData error', e)
      Swal.fire('Error', 'Gagal menyimpan data bazaar', 'error')
      throw e
    }
  }

  const fetchWeeks = async () => {
    const { data, error } = await supabase
      .from('weeks')
      .select('*')
      .order('created_at')

    if (error) {
      Swal.fire('Error', 'Gagal mengambil minggu', 'error')
      return
    }
    setWeeks(data)
  }

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      Swal.fire('Error', 'Gagal mengambil pengumuman', 'error')
      return
    }
    setAnnouncements(data)
  }

  const fetchRegistrations = async () => {
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        *,
        registration_products (*)
      `)
      .eq('is_deleted', false)

    if (error) {
      Swal.fire('Error', 'Gagal mengambil registrasi', 'error')
      return
    }
    setRegistrations(data)
  }

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        registration_products (
          nama_produk,
          ukuran,
          satuan,
          hjk,
          hpp
        )
      `)
      .eq('is_deleted', false)

    if (error) {
      Swal.fire('Error', 'Gagal mengambil order', 'error')
      return
    }
    setOrders(data)
  }

  const login = (name) => {
    const normalized = name.trim().toLowerCase()
    const found = users.find(
      u => u.name.trim().toLowerCase() === normalized
    )

    if (!found) throw new Error('User tidak ditemukan')

    setUser(found)
    localStorage.setItem('currentUser', JSON.stringify(found))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('currentUser')
  }

  const register = async (name) => {
    if (users.some(u => u.name === name)) {
      throw new Error('Nama sudah terdaftar')
    }

    const { error } = await supabase
      .from('users')
      .insert([{ name, role: 'supplier' }])

    if (error) throw error

    await fetchUsers()
    Swal.fire('Berhasil', 'User terdaftar', 'success')
  }

  const createRegistration = async ({
    announcementId,
    participateOnline,
    participateOffline,
    useSameProducts,
    offlineStock,
    productsOnline,
    productsOffline
  }) => {
    try {
      const { data: reg, error } = await supabase
        .from('registrations')
        .insert([{
          announcement_id: announcementId,
          supplier_id: user.id,
          participate_online: participateOnline,
          participate_offline: participateOffline,
          use_same_products: useSameProducts,
          offline_stock: offlineStock,
          status: 'pending'
        }])
        .select()
        .single()

      if (error) throw error

      const snapshots = []

      if (useSameProducts) {
        productsOnline.forEach(p => {
          snapshots.push({
            registration_id: reg.id,
            channel: 'both',
            nama_produk: p.nama_produk,
            jenis_produk: p.jenis_produk,
            ukuran: p.ukuran,
            satuan: p.satuan,
            hjk: p.hjk,
            hpp: p.hpp,
            image_url: p.image_url,
            keterangan: p.keterangan
          })
        })
      } else {
        productsOnline.forEach(p => snapshots.push({ ...p, channel: 'online', registration_id: reg.id }))
        productsOffline.forEach(p => snapshots.push({ ...p, channel: 'offline', registration_id: reg.id }))
      }

      const { error: prodErr } = await supabase
        .from('registration_products')
        .insert(snapshots)

      if (prodErr) throw prodErr

      await fetchRegistrations()
      Swal.fire('Berhasil', 'Registrasi berhasil', 'success')
    } catch (e) {
      console.error(e)
      Swal.fire('Error', 'Gagal registrasi', 'error')
    }
  }

  const createOrder = async ({
    weekId,
    announcementId,
    registrationId,
    registrationProductId,
    channel,
    pemesan,
    jumlah,
    hargaSatuan,
    catatan,
    bayar,
    supplierId,
    status,
    method
  }) => {

    const supId = supplierId || user?.id
    const { error } = await supabase
      .from('orders')
      .insert([{
        week_id: weekId,
        announcement_id: announcementId,
        registration_id: registrationId,
        registration_product_id: registrationProductId,
        supplier_id: supId,
        channel,
        pemesan,
        jumlah,
        harga_satuan: hargaSatuan,
        catatan,
        bayar,
        status: status || null,
        method: method || null,
        created_by: user?.id || null,
        last_edited_by: user?.id || null
      }])

    if (error) {
      Swal.fire('Error', 'Gagal menambah order', 'error')
      return
    }

    await fetchOrders()
  }

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchUsers(),
        fetchProducts(),
        fetchWeeks(),
        fetchAnnouncements(),
        fetchRegistrations(),
        fetchOrders()
      ])

      const stored = localStorage.getItem('currentUser')
      if (stored) setUser(JSON.parse(stored))

      setLoading(false)
    }

    init()
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      users,
      registeredUsers,
      bazaarData,
      weekData,
      productData,
      products,
      weeks,
      announcements,
      registrations,
      orders,
      loading,
      login,
      logout,
      register,
      createRegistration,
      createOrder,
      fetchOrders,
      saveBazaarData,
      logBazaarAction,
      saveProductData,
      profileModalOpen,
      toggleProfileModal
    }}>
      {children}
    </AuthContext.Provider>
  )
}