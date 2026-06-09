import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

const USER_COLUMNS = 'id, name, role, nama_supplier, nama_bank, no_rekening, phone_number, nama_penerima, is_deleted'
const PRODUCT_COLUMNS = 'id, owner_id, nama_produk, jenis_produk, keterangan, satuan, ukuran, hjk, hpp, image_url, aktif, is_deleted, created_at, updated_at'
const REGISTRATION_COLUMNS = `
  id, announcement_id, supplier_id, status, notes, adminNotes,
  participate_online, participate_offline, use_same_products, offline_stock,
  reviewed_by, created_at, updated_at, is_deleted,
  registration_products (
    id, registration_id, channel, nama_produk, jenis_produk, keterangan,
    satuan, ukuran, hjk, hpp, image_url, offline_stock, product_id,
    is_active, is_deleted, created_at
  )
`
const ORDER_COLUMNS = `
  id, week_id, announcement_id, registration_id, registration_product_id,
  supplier_id, channel, pemesan, jumlah, harga_satuan, catatan, bayar,
  status, method, created_by, last_edited_by, created_at, updated_at, is_deleted,
  registration_products (
    id, nama_produk, ukuran, satuan, hjk, hpp
  )
`

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
      .select(USER_COLUMNS)
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
      .select(PRODUCT_COLUMNS)
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

  const syncRegistrationProducts = async ({
    registrationId,
    registrationProducts = []
  }) => {
    if (!registrationId) return

    const normalizedProducts = []
    const uniqueKeys = new Set()

    for (const product of registrationProducts || []) {
      const productId =
        product.product_id ||
        product.productId ||
        null

      const channel =
        product.channel || 'online'

      const key =
        `${productId || product.nama_produk}::${channel}`

      if (uniqueKeys.has(key)) continue

      uniqueKeys.add(key)

      normalizedProducts.push({
        product_id: productId,
        channel,

        nama_produk:
          product.nama_produk ||
          product.namaProduk ||
          product.label ||
          '',

        jenis_produk:
          product.jenis_produk ||
          product.jenisProduk ||
          null,

        keterangan:
          product.keterangan || null,

        satuan:
          product.satuan || null,

        ukuran:
          product.ukuran || null,

        hjk:
          product.hjk !== undefined &&
          product.hjk !== null
            ? Number(product.hjk)
            : 0,

        hpp:
          product.hpp !== undefined &&
          product.hpp !== null
            ? Number(product.hpp)
            : 0,

        image_url:
          product.image_url ||
          product.imageUrl ||
          null,

        offline_stock:
          product.offline_stock !== undefined &&
          product.offline_stock !== null
            ? Number(product.offline_stock)
            : null,

        is_active:
          product.is_active !== undefined
            ? product.is_active
            : product.isActive !== undefined
              ? product.isActive
              : true
      })
    }

    const { data: existingProducts, error: existingError } =
      await supabase
        .from('registration_products')
        .select('*')
        .eq('registration_id', registrationId)

    if (existingError) throw existingError

    const activeExistingProducts =
      (existingProducts || []).filter(
        p => !p.is_deleted
      )

    const existingMap = new Map()

    activeExistingProducts.forEach(product => {
      const key =
        `${product.product_id || product.nama_produk}::${product.channel}`

      existingMap.set(key, product)
    })

    const incomingKeys = new Set()

    for (const product of normalizedProducts) {
      const key =
        `${product.product_id || product.nama_produk}::${product.channel}`

      incomingKeys.add(key)

      const existing =
        existingMap.get(key)

      if (!existing) {
        const { error: insertError } =
          await supabase
            .from('registration_products')
            .insert([
              {
                registration_id: registrationId,
                ...product,
                is_deleted: false
              }
            ])

        if (insertError) throw insertError

        continue
      }

      const hasChanges =
        existing.nama_produk !== product.nama_produk ||
        existing.jenis_produk !== product.jenis_produk ||
        existing.keterangan !== product.keterangan ||
        existing.satuan !== product.satuan ||
        Number(existing.ukuran || 0) !== Number(product.ukuran || 0) ||
        Number(existing.hjk || 0) !== Number(product.hjk || 0) ||
        Number(existing.hpp || 0) !== Number(product.hpp || 0) ||
        existing.image_url !== product.image_url ||
        Number(existing.offline_stock || 0) !== Number(product.offline_stock || 0) ||
        existing.is_active !== product.is_active

      if (hasChanges) {
        const { error: updateError } =
          await supabase
            .from('registration_products')
            .update({
              ...product,
              is_deleted: false
            })
            .eq('id', existing.id)

        if (updateError) throw updateError
      }
    }

    const deleteIds =
      activeExistingProducts
        .filter(product => {
          const key =
            `${product.product_id || product.nama_produk}::${product.channel}`

          return !incomingKeys.has(key)
        })
        .map(product => product.id)

    if (deleteIds.length > 0) {
      const { error: deleteError } =
        await supabase
          .from('registration_products')
          .update({
            is_deleted: true
          })
          .in('id', deleteIds)

      if (deleteError) throw deleteError
    }
  }

  const saveBazaarData = async (newBazaarData) => {
    try {
      const incomingRegs = Array.isArray(newBazaarData?.registrations)
        ? newBazaarData.registrations
        : []

      for (const reg of incomingRegs) {
        const announcementId =
          reg.announcementId || reg.announcement_id

        const supplierId =
          reg.supplierId ||
          users.find(
            u =>
              u?.name === reg?.supplierName ||
              u?.nama_supplier === reg?.supplierName
          )?.id ||
          null

        if (!announcementId || !supplierId) continue

        const announcement = announcements.find(
          a => a.id === announcementId
        )

        if (!announcement) continue

        const rawProducts =
          reg.registrationProducts || []

        const dedupedProducts = []

        const seen = new Set()

        for (const product of rawProducts) {
          const productId =
            product.product_id ||
            product.productId ||
            product.id ||
            null

          const channel =
            product.channel || 'online'

          const key =
            `${productId || product.nama_produk}::${channel}`

          if (seen.has(key)) continue

          seen.add(key)

          dedupedProducts.push(product)
        }

        if (dedupedProducts.length === 0) {
          throw new Error(
            'Minimal 1 produk harus dipilih'
          )
        }

        const payload = {
          announcement_id: announcementId,
          supplier_id: supplierId,

          status: reg.status || 'pending',

          notes: reg.notes || null,
          adminNotes: reg.adminNotes || null,

          participate_online:
            !!reg.participateOnline,

          participate_offline:
            !!reg.participateOffline,

          use_same_products:
            !!reg.useSameProducts,

          offline_stock:
            reg.offlineStock || null,

          reviewed_by:
            reg.reviewedBy || null,

          is_deleted: false,

          updated_at: new Date().toISOString()
        }

        let registrationId = reg.id || null

        const isEditing = !!registrationId

        let createdNewRegistration = false

        if (!isEditing) {
          const {
            data: existingRegs,
            error: existingError
          } = await supabase
            .from('registrations')
            .select('*')
            .eq('announcement_id', announcementId)
            .eq('is_deleted', false)

          if (existingError) throw existingError

          const activeRegs = (existingRegs || []).filter(
            r =>
              r.status === 'pending' ||
              r.status === 'approved'
          )

          const onlineSuppliers = new Set(
            activeRegs
              .filter(r => r.participate_online)
              .map(r => r.supplier_id)
          )

          const offlineSuppliers = new Set(
            activeRegs
              .filter(r => r.participate_offline)
              .map(r => r.supplier_id)
          )

          if (
            payload.participate_online &&
            !onlineSuppliers.has(supplierId)
          ) {
            const maxOnline =
              announcement.maxSuppliersOnline || 999999

            if (onlineSuppliers.size >= maxOnline) {
              throw new Error(
                'Kuota bazaar online sudah penuh'
              )
            }
          }

          if (
            payload.participate_offline &&
            !offlineSuppliers.has(supplierId)
          ) {
            const maxOffline =
              announcement.maxSuppliersOffline || 999999

            if (offlineSuppliers.size >= maxOffline) {
              throw new Error(
                'Kuota bazaar offline sudah penuh'
              )
            }
          }

          const {
            data: insertedReg,
            error: insertError
          } = await supabase
            .from('registrations')
            .insert([
              {
                ...payload,
                created_at:
                  new Date().toISOString()
              }
            ])
            .select()
            .single()

          if (insertError) throw insertError

          registrationId = insertedReg.id
          createdNewRegistration = true
        } else {
          const { error: updateError } =
            await supabase
              .from('registrations')
              .update(payload)
              .eq('id', registrationId)

          if (updateError) throw updateError
        }

        try {
          await syncRegistrationProducts({
            registrationId,
            registrationProducts: dedupedProducts
          })

          const {
            count,
            error: countError
          } = await supabase
            .from('registration_products')
            .select('*', {
              count: 'exact',
              head: true
            })
            .eq(
              'registration_id',
              registrationId
            )
            .eq('is_deleted', false)

          if (countError) throw countError

          if (!count || count === 0) {
            throw new Error(
              'Tidak ada produk yang berhasil disimpan'
            )
          }
        } catch (productError) {
          if (
            createdNewRegistration &&
            registrationId
          ) {
            await supabase
              .from('registrations')
              .delete()
              .eq('id', registrationId)
          }

          throw productError
        }
      }

      await Promise.all([
        fetchAnnouncements(),
        fetchRegistrations(),
        fetchWeeks()
      ])
    } catch (e) {
      console.error(
        'saveBazaarData error',
        e
      )

      Swal.fire(
        'Error',
        e?.message ||
          'Gagal menyimpan data bazaar',
        'error'
      )

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
      .select(REGISTRATION_COLUMNS)
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
      .select(ORDER_COLUMNS)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    if (error) {
      Swal.fire('Error', 'Gagal mengambil order', 'error')
      return
    }
    setOrders(data)
  }

  const fetchOrdersForWeek = async (weekId) => {
    if (!weekId) {
      await fetchOrders()
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('week_id', weekId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      Swal.fire('Error', 'Gagal mengambil order', 'error')
      return
    }

    setOrders(prev => {
      const otherWeekOrders = (prev || []).filter(order => order.week_id !== weekId)
      return [...(data || []), ...otherWeekOrders].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )
    })
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
    const { data, error } = await supabase
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
      .select(ORDER_COLUMNS)
      .single()

    if (error) {
      Swal.fire('Error', 'Gagal menambah order', 'error')
      return
    }

    setOrders(prev => [data, ...(prev || [])])
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
      fetchOrdersForWeek,
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