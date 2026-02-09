import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userList, setUserList] = useState([])
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(JSON.parse(localStorage.getItem('supplierProfile')) || {})
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [productData, setProductData] = useState({})
  const [weekData, setWeekData] = useState({})
  const [bazaarData, setBazaarData] = useState({})

  const toggleProfileModal = () => setProfileModalOpen(prev => !prev)

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching users:', error)
        Swal.fire('Error', 'Gagal mengambil data pengguna', 'error')
        return
      }

      setRegisteredUsers(data || [])
      setUserList(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      Swal.fire('Error', 'Gagal mengambil data pengguna', 'error')
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')

      if (error) {
        console.error('Error fetching products:', error)
        Swal.fire('Error', 'Gagal mengambil data produk', 'error')
        return
      }

      const transformed = {}
      data?.forEach(item => {
        if (!transformed[item.owner]) {
          transformed[item.owner] = []
        }
        transformed[item.owner].push(item.data)
      })

      setProductData(transformed)
    } catch (error) {
      console.error('Error fetching products:', error)
      Swal.fire('Error', 'Gagal mengambil data produk', 'error')
    }
  }

  const fetchWeeks = async () => {
    try {
      const { data, error } = await supabase
        .from('weeks')
        .select('*')

      if (error) {
        console.error('Error fetching weeks:', error)
        Swal.fire('Error', 'Gagal mengambil data minggu', 'error')
        return
      }

      const transformed = {}
      data?.forEach(item => {
        transformed[item.week_id] = item.entries
      })

      setWeekData(transformed)
    } catch (error) {
      console.error('Error fetching weeks:', error)
      Swal.fire('Error', 'Gagal mengambil data minggu', 'error')
    }
  }

  const fetchBazaarData = async () => {
    try {
      const { data, error } = await supabase
        .from('bazaar_data')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        console.error('Error fetching bazaar data:', error)
        return
      }

      if (data) {
        let clean = data
        while (clean?.data && clean.data?.id && clean.data.data) {
          clean = clean.data
        }
        setBazaarData(clean?.data || clean)
      } else {
        setBazaarData({})
      }
    } catch (error) {
      console.error('Error fetching bazaar data:', error)
    }
  }

  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchUsers(),
          fetchProducts(),
          fetchWeeks(),
          fetchBazaarData()
        ])

        const storedUser = localStorage.getItem('currentUser')
        if (storedUser) setUser(JSON.parse(storedUser))

        setLoading(false)
      } catch (error) {
        console.error('Error initializing data:', error)
        setLoading(false)
      }
    }
    
    initializeData()
  }, [])

  const register = async (name, role) => {
    const exists = registeredUsers.some((u) => u.name === name)
    if (exists) throw new Error('Nama sudah terdaftar')

    try {
      const { error } = await supabase
        .from('users')
        .insert([{ name, role, requested_admin: 'false' }])

      if (error) throw new Error(error.message)

      await fetchUsers()
      Swal.fire('Berhasil', 'Pengguna berhasil didaftarkan', 'success')
    } catch (error) {
      Swal.fire('Error', error.message, 'error')
      throw new Error(error.message)
    }
  }

  const login = (name) => {
    const found = registeredUsers.find((u) => u.name === name)
    if (!found) throw new Error('Pengguna tidak ditemukan')

    const updatedUser = { ...found, profile: found.profile || {}, requestedAdmin: found.requested_admin || false }
    setUser(updatedUser)
    localStorage.setItem('currentUser', JSON.stringify(updatedUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('currentUser')
  }

  const applyAsAdmin = async () => {
    if (!user || user.role !== 'supplier') return

    try {
      const { error } = await supabase
        .from('users')
        .update({ requested_admin: 'true' })
        .eq('name', user.name)

      if (error) {
        console.error('Error updating admin request:', error)
        Swal.fire('Error', 'Gagal mengajukan sebagai admin', 'error')
        return
      }

      const updatedUser = { ...user, requestedAdmin: true }
      setUser(updatedUser)
      localStorage.setItem('currentUser', JSON.stringify(updatedUser))

      await fetchUsers()
      Swal.fire('Berhasil', 'Pengajuan admin berhasil dikirim', 'success')
    } catch (error) {
      console.error('Error applying as admin:', error)
      Swal.fire('Error', 'Gagal mengajukan sebagai admin', 'error')
    }
  }

  const saveProfile = (newProfile) => {
    setProfile(newProfile)
    setUser(prev => prev ? { ...prev, profile: newProfile } : prev)
    localStorage.setItem('currentUser', JSON.stringify({ ...user, profile: newProfile }))
  }

  const saveProductData = async (name, data) => {
    try {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('owner', name)

      if (deleteError) {
        console.error('Error deleting products:', deleteError)
        Swal.fire('Error', 'Gagal menyimpan data produk', 'error')
        return
      }

      if (data.length > 0) {
        const productsToInsert = data.map(item => ({
          owner: name,
          data: item
        }))

        const { error: insertError } = await supabase
          .from('products')
          .insert(productsToInsert)

        if (insertError) {
          console.error('Error inserting products:', insertError)
          Swal.fire('Error', 'Gagal menyimpan data produk', 'error')
          return
        }
      }

      const updated = { ...productData, [name]: data }
      setProductData(updated)
      await fetchProducts()
      Swal.fire('Berhasil', 'Data produk berhasil disimpan', 'success')
    } catch (error) {
      console.error('Error saving product data:', error)
      Swal.fire('Error', 'Gagal menyimpan data produk', 'error')
    }
  }

  const saveWeekData = async (sheetName, newSheetData) => {
    try {
      const { error } = await supabase
        .from('weeks')
        .upsert([{ week_id: sheetName, entries: newSheetData }])

      if (error) {
        console.error('Error saving week data:', error)
        Swal.fire('Error', 'Gagal menyimpan data minggu', 'error')
        return
      }

      const existing = { ...weekData }
      const updated = { ...existing, [sheetName]: newSheetData }
      setWeekData(updated)
      await fetchWeeks()
    } catch (error) {
      console.error('Error saving week data:', error)
      Swal.fire('Error', 'Gagal menyimpan data minggu', 'error')
    }
  }

  const saveBazaarData = async (newBazaarData) => {
    try {
      const cleanData = newBazaarData?.data ? newBazaarData.data : newBazaarData

      const { error } = await supabase
        .from('bazaar_data')
        .upsert([{ id: 1, data: cleanData }])

      if (error) throw error
      await fetchBazaarData()
    } catch (error) {
      console.error('Error saving bazaar data:', error)
      Swal.fire('Error', 'Gagal menyimpan data bazaar', 'error')
    }
  }

  const handleAdminDecision = async (name, accepted) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          role: accepted ? 'admin' : 'supplier',
          requested_admin: accepted ? 'false' : 'rejected'
        })
        .eq('name', name)

      if (error) {
        console.error('Error updating admin decision:', error)
        Swal.fire('Error', 'Gagal memproses keputusan admin', 'error')
        return
      }

      await fetchUsers()

      if (user?.name === name) {
        const updatedCurrent = registeredUsers.find(u => u.name === name)
        if (updatedCurrent) {
          const updatedUser = { 
            ...updatedCurrent, 
            role: accepted ? 'admin' : 'supplier',
            requestedAdmin: accepted ? false : 'rejected'
          }
          setUser(updatedUser)
          localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        }
      }

      Swal.fire('Berhasil', `Pengajuan admin ${accepted ? 'diterima' : 'ditolak'}`, 'success')
    } catch (error) {
      console.error('Error handling admin decision:', error)
      Swal.fire('Error', 'Gagal memproses keputusan admin', 'error')
    }
  }

  const cancelAdminRequest = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ requested_admin: 'false' })
        .eq('name', user.name)

      if (error) {
        console.error('Error canceling admin request:', error)
        Swal.fire('Error', 'Gagal membatalkan pengajuan admin', 'error')
        return
      }

      const updatedCurrent = { ...user, requestedAdmin: false }
      setUser(updatedCurrent)
      localStorage.setItem('currentUser', JSON.stringify(updatedCurrent))

      await fetchUsers()
      Swal.fire('Berhasil', 'Pengajuan admin berhasil dibatalkan', 'success')
    } catch (error) {
      console.error('Error canceling admin request:', error)
      Swal.fire('Error', 'Gagal membatalkan pengajuan admin', 'error')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      applyAsAdmin,
      register,
      loading,
      registeredUsers,
      profile,
      saveProfile,
      profileModalOpen,
      toggleProfileModal,
      productData,
      saveProductData,
      weekData,
      saveWeekData,
      bazaarData,
      saveBazaarData,
      userList,
      handleAdminDecision,
      cancelAdminRequest
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export async function logBazaarAction({ user, action, target, targetId, dataBefore, dataAfter, description }) {
  try {
    await supabase.from('bazaar_logs').insert([{
      user_name: user?.name,
      action,
      target,
      target_id: targetId,
      data_before: dataBefore ? JSON.stringify(dataBefore) : null,
      data_after: dataAfter ? JSON.stringify(dataAfter) : null,
      description
    }])
  } catch (e) {
    console.error('Failed to log bazaar action', e)
  }
}

export const logWeekAction = async ({ user, action, sheetName, entryBefore, entryAfter, description }) => {
  try {
    await supabase.from('week_logs').insert([{
      user_name: user?.name,
      action,
      target: 'week_entry',
      target_id: entryAfter?.id || `${sheetName}|${entryAfter?.pemesan}|${entryAfter?.produkLabel}`,
      data_before: entryBefore ? JSON.stringify(entryBefore) : null,
      data_after: entryAfter ? JSON.stringify(entryAfter) : null,
      description,
    }])
  } catch (err) {
    console.error('Error logging week action:', err)
  }
}