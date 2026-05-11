import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Navbar,
  Button,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalBody,
  ModalFooter,
  Row,
  Col,
  Label,
  Input
} from 'reactstrap'
import { Menu } from 'react-feather'
import Select from 'react-select'
import { useAuth } from '../../context/AuthContext'
import { useAppUi } from '../../context/AppUiContext'
import { useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../supabaseClient'
import logo from '/logo.jpg'

const selectCompact = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)'
  }),
  singleValue: (base) => ({ ...base, color: '#e8eef7' }),
  placeholder: (base) => ({ ...base, color: 'rgba(232,238,247,0.5)' }),
  input: (base) => ({ ...base, color: '#e8eef7' }),

  menu: (base) => ({
    ...base,
    zIndex: 1060,
    backgroundColor: '#1e293b'
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#334155' : state.isSelected ? '#2563eb' : '#1e293b',
    color: '#e8eef7',
    cursor: 'pointer'
  })
}

export default function TopNavBar() {
  const { user, logout, registeredUsers, profileModalOpen, toggleProfileModal, bazaarData } = useAuth()
  const {
    isMobile,
    toggleMobileNav,
    currentWeek,
    setCurrentWeek,
    adminView,
    setAdminView
  } = useAppUi()
  const navigate = useNavigate()
  const location = useLocation()

  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    nama_supplier: '',
    nama_bank: '',
    nama_penerima: '',
    no_rekening: '',
    phone_number: ''
  })
  const refs = {
    nama_supplier: useRef(),
    nama_bank: useRef(),
    nama_penerima: useRef(),
    no_rekening: useRef(),
    phone_number: useRef()
  }

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [weekNavOpen, setWeekNavOpen] = useState(false)
  const [invoiceNavOpen, setInvoiceNavOpen] = useState(false)

  const weekOptions = useMemo(() => {
    const map = new Map()
      ; (bazaarData?.announcements || []).forEach((a) => {
        if (!a.weekCode || a.isDeleted || a.is_deleted) return
        const num = Number(String(a.weekCode).replace('W', ''))
        if (!num) return
        if (!map.has(num)) {
          map.set(num, {
            value: num,
            label: `${a.weekCode} – ${a.title}`
          })
        }
      })
    const sorted = Array.from(map.values()).sort((a, b) => a.value - b.value)
    return [{ value: null, label: 'Semua Minggu/Bazaar' }, ...sorted]
  }, [bazaarData])

  const isDev = user?.role === 'dev'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user) return
    setForm({
      nama_supplier: user.nama_supplier ?? user.name,
      nama_bank: user.nama_bank ?? '',
      nama_penerima: user.nama_penerima ?? user.name,
      no_rekening: user.no_rekening ?? '',
      phone_number: user.phone_number ?? ''
    })
  }, [user])

  const handleSave = async () => {
    const { nama_supplier, nama_bank, nama_penerima, no_rekening, phone_number } = form
    const newErrors = {}

    if (!nama_supplier.trim()) {
      newErrors.nama_supplier = 'Nama supplier wajib diisi'
    } else {
      const isTaken = (registeredUsers || []).some(
        (u) => u.name !== user.name && u.nama_supplier === nama_supplier
      )
      if (isTaken) newErrors.nama_supplier = 'Nama supplier sudah dipakai'
    }

    if (!nama_bank.trim()) newErrors.nama_bank = 'Nama bank wajib diisi'
    if (!nama_penerima.trim()) newErrors.nama_penerima = 'Nama penerima wajib diisi'
    if (!no_rekening.trim()) newErrors.no_rekening = 'No rekening wajib diisi'
    if (phone_number && !/^[0-9]+$/.test(phone_number)) newErrors.phone_number = 'Nomor telepon hanya boleh angka'

    setErrors(newErrors)
    const firstError = Object.keys(newErrors)[0]
    if (firstError) {
      refs[firstError]?.current?.focus()
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          nama_supplier,
          nama_bank,
          nama_penerima,
          no_rekening,
          phone_number: phone_number || null
        })
        .eq('name', user.name)

      if (error) throw error
      const updatedUser = {
        ...user,
        nama_supplier,
        nama_bank,
        nama_penerima,
        no_rekening,
        phone_number: phone_number || null
      }

      localStorage.setItem('currentUser', JSON.stringify(updatedUser))
      Swal.fire('Berhasil', 'Profil berhasil disimpan', 'success')
      toggleProfileModal()
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'Gagal menyimpan profil', 'error')
    }
  }

  const weekSelectValue = weekOptions.find((w) => w.value === currentWeek) || null

  return (
    <>
      <Navbar dark className="app-topnav px-2 px-md-3 py-2 mb-0 border-bottom border-light border-opacity-10 shadow-sm sticky-top">
        <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
          {isMobile && (
            <Button
              color="link"
              className="text-white p-2 me-1"
              onClick={toggleMobileNav}
              aria-label="Buka menu samping"
            >
              <Menu size={22} />
            </Button>
          )}
          <button
            type="button"
            className="btn btn-link text-white text-decoration-none d-flex align-items-center gap-2 p-0 me-2"
            onClick={() => navigate('/dashboard')}
          >
            <img src={logo} alt="" className="app-topnav-logo" />
            <span className="fw-semibold d-none d-sm-inline">FRUK</span>
          </button>

          <div className="d-none d-md-flex align-items-center gap-2 ms-2 flex-grow-1 flex-wrap justify-content-end">
            <div style={{ width: 220, minWidth: 160 }}>
              <Select
                options={weekOptions}
                placeholder="Pilih minggu bazaar"
                isClearable
                isSearchable
                value={weekSelectValue}
                onChange={(opt) => {
                  const week = opt?.value ?? null
                  setCurrentWeek(week)

                  const path = location.pathname
                  if (path.startsWith('/weekoffline')) {
                    navigate(week ? `/weekoffline/${week}` : '/weekoffline')
                  } else if (path.startsWith('/week')) {
                    navigate(week ? `/week/${week}` : '/week')
                  } else if (path.startsWith('/customer-invoice')) {
                    navigate(week ? `/customer-invoice/${week}` : '/customer-invoice')
                  } else if (path.startsWith('/supplier-invoice')) {
                    navigate(week ? `/supplier-invoice/${week}` : '/supplier-invoice')
                  }
                }}
                styles={selectCompact}
              />
            </div>
          </div>

          {(isAdmin || isDev) && (
            <Button
              size="sm"
              outline
              className="app-topnav-btn border-light text-white"
              onClick={() => {
                setAdminView(v => !v)
                navigate('/dashboard')
                window.location.reload()
              }}
            >
              {adminView ? 'Mode supplier' : 'Mode admin'}
            </Button>
          )}

          <Dropdown
            isOpen={userMenuOpen}
            toggle={() => setUserMenuOpen((o) => !o)}
          >
            <DropdownToggle caret size="sm" className="app-topnav-btn">
              <span className="d-none d-sm-inline">{user?.nama_supplier || user?.name}</span>
              <span className="d-inline d-sm-none">{user?.nama_supplier || user?.name}</span>
            </DropdownToggle>
            <DropdownMenu end>
              <DropdownItem header>{user?.role}</DropdownItem>
              <DropdownItem onClick={toggleProfileModal}>Edit profil</DropdownItem>
              <DropdownItem divider />
              <DropdownItem
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                Logout
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </Navbar>

      <div className="d-md-none px-3 py-2 border-bottom border-light border-opacity-10 sticky-top" style={{ top: '56px' }}>
        <Select
          options={weekOptions}
          placeholder="Pilih minggu bazaar"
          isClearable
          isSearchable
          value={weekSelectValue}
          onChange={(opt) => {
            const week = opt?.value ?? null
            setCurrentWeek(week)

            const path = location.pathname
            if (path.startsWith('/weekoffline')) {
              navigate(week ? `/weekoffline/${week}` : '/weekoffline')
            } else if (path.startsWith('/week')) {
              navigate(week ? `/week/${week}` : '/week')
            } else if (path.startsWith('/customer-invoice')) {
              navigate(week ? `/customer-invoice/${week}` : '/customer-invoice')
            } else if (path.startsWith('/supplier-invoice')) {
              navigate(week ? `/supplier-invoice/${week}` : '/supplier-invoice')
            }
          }}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: base => ({ ...base, zIndex: 1000 })
          }}
        />
      </div>

      <Modal isOpen={profileModalOpen} toggle={toggleProfileModal} centered size="lg">
        <ModalBody className="pt-4">
          <Row>
            <Col md="12" className="mb-3">
              <Label>Nama Supplier</Label>
              <Input
                innerRef={refs.nama_supplier}
                invalid={!!errors.nama_supplier}
                value={form.nama_supplier}
                onChange={(e) => setForm({ ...form, nama_supplier: e.target.value })}
              />
              {errors.nama_supplier && <div className="text-danger small">{errors.nama_supplier}</div>}
            </Col>

            <Col md="12" className="mb-3">
              <Label>Nama Bank</Label>
              <Input
                innerRef={refs.nama_bank}
                invalid={!!errors.nama_bank}
                value={form.nama_bank}
                onChange={(e) => setForm({ ...form, nama_bank: e.target.value })}
              />
              {errors.nama_bank && <div className="text-danger small">{errors.nama_bank}</div>}
            </Col>

            <Col md="12" className="mb-3">
              <Label>Nama Penerima</Label>
              <Input
                innerRef={refs.nama_penerima}
                invalid={!!errors.nama_penerima}
                value={form.nama_penerima}
                onChange={(e) => setForm({ ...form, nama_penerima: e.target.value })}
              />
              {errors.nama_penerima && <div className="text-danger small">{errors.nama_penerima}</div>}
            </Col>

            <Col md="12" className="mb-3">
              <Label>No Rekening</Label>
              <Input
                type="text"
                innerRef={refs.no_rekening}
                invalid={!!errors.no_rekening}
                value={form.no_rekening}
                onChange={(e) => setForm({ ...form, no_rekening: e.target.value })}
              />
              {errors.no_rekening && <div className="text-danger small">{errors.no_rekening}</div>}
            </Col>

            <Col md="12">
              <Label>Nomor Telepon</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                innerRef={refs.phone_number}
                invalid={!!errors.phone_number}
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value.replace(/[^0-9]/g, '') })}
              />
              {errors.phone_number && <div className="text-danger small">{errors.phone_number}</div>}
            </Col>
          </Row>
        </ModalBody>

        <ModalFooter>
          <Button color="primary" onClick={handleSave}>
            Simpan
          </Button>
          <Button color="secondary" onClick={toggleProfileModal}>
            Batal
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
