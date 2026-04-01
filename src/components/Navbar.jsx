import React, { useState, useEffect, useRef } from 'react'
import { Navbar, NavbarBrand, Nav, NavItem, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button, Modal, ModalBody, ModalFooter, Row, Col, Label, Input } from 'reactstrap'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../supabaseClient'
import logo from '/logo.png'

const NavbarComponent = () => {
  const { user, logout, registeredUsers, profileModalOpen, toggleProfileModal } = useAuth()
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    nama_supplier: '',
    nama_bank: '',
    nama_penerima: '',
    no_rekening: ''
  })

  const refs = {
    nama_supplier: useRef(),
    nama_bank: useRef(),
    nama_penerima: useRef(),
    no_rekening: useRef()
  }

  const location = useLocation()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toggleDropdown = () => setDropdownOpen(prev => !prev)

  useEffect(() => {
    if (!user) return
    setForm({
      nama_supplier: user.nama_supplier ?? user.name,
      nama_bank: user.nama_bank ?? '',
      nama_penerima: user.nama_penerima ?? user.name,
      no_rekening: user.no_rekening ?? ''
    })
  }, [user])

  const handleSave = async () => {
    const { nama_supplier, nama_bank, nama_penerima, no_rekening } = form
    const newErrors = {}

    if (!nama_supplier.trim()) {
      newErrors.nama_supplier = 'Nama supplier wajib diisi'
    } else {
      const isTaken = (registeredUsers || []).some(
        u => u.name !== user.name && u.nama_supplier === nama_supplier
      )
      if (isTaken) newErrors.nama_supplier = 'Nama supplier sudah dipakai'
    }

    if (!nama_bank.trim()) newErrors.nama_bank = 'Nama bank wajib diisi'
    if (!nama_penerima.trim()) newErrors.nama_penerima = 'Nama penerima wajib diisi'
    if (!no_rekening.trim()) newErrors.no_rekening = 'No rekening wajib diisi'

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
          no_rekening
        })
        .eq('name', user.name)

      if (error) throw error
      const updatedUser = {
        ...user,
        nama_supplier,
        nama_bank,
        nama_penerima,
        no_rekening
      }

      localStorage.setItem('currentUser', JSON.stringify(updatedUser))
      Swal.fire('Berhasil', 'Profil berhasil disimpan', 'success')
      toggleProfileModal()
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'Gagal menyimpan profil', 'error')
    }
  }

  if (location.pathname === '/login' || location.pathname === '/register') return null

  return (
    <>
      <Navbar color="light" light expand="md" className="px-4 shadow-sm justify-content-between">
        <NavbarBrand
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <img src={logo} alt="logo" style={{ height: 40, marginRight: 8 }} />
          <span>FRUK</span>
        </NavbarBrand>

        <Nav navbar className="ms-auto">
          <NavItem>
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle caret color="primary">
                {user?.name} ({user?.role})
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem onClick={toggleProfileModal}>
                  Edit Profil
                </DropdownItem>
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
          </NavItem>
        </Nav>
      </Navbar>

      {/* Modal */}
      <Modal isOpen={profileModalOpen} toggle={toggleProfileModal} centered size="lg">
        <ModalBody>
          <Row>
            <Col md="12" className="mb-3">
              <Label>Nama Supplier</Label>
              <Input
                innerRef={refs.nama_supplier}
                invalid={!!errors.nama_supplier}
                value={form.nama_supplier}
                onChange={e => setForm({ ...form, nama_supplier: e.target.value })}
              />
              {errors.nama_supplier && <div className="text-danger small">{errors.nama_supplier}</div>}
            </Col>

            <Col md="12" className="mb-3">
              <Label>Nama Bank</Label>
              <Input
                innerRef={refs.nama_bank}
                invalid={!!errors.nama_bank}
                value={form.nama_bank}
                onChange={e => setForm({ ...form, nama_bank: e.target.value })}
              />
              {errors.nama_bank && <div className="text-danger small">{errors.nama_bank}</div>}
            </Col>

            <Col md="12" className="mb-3">
              <Label>Nama Penerima</Label>
              <Input
                innerRef={refs.nama_penerima}
                invalid={!!errors.nama_penerima}
                value={form.nama_penerima}
                onChange={e => setForm({ ...form, nama_penerima: e.target.value })}
              />
              {errors.nama_penerima && <div className="text-danger small">{errors.nama_penerima}</div>}
            </Col>

            <Col md="12">
              <Label>No Rekening</Label>
              <Input
                type="text"
                innerRef={refs.no_rekening}
                invalid={!!errors.no_rekening}
                value={form.no_rekening}
                onChange={e => setForm({ ...form, no_rekening: e.target.value })}
              />
              {errors.no_rekening && <div className="text-danger small">{errors.no_rekening}</div>}
            </Col>
          </Row>
        </ModalBody>

        <ModalFooter>
          <Button color="primary" onClick={handleSave}>Simpan</Button>
          <Button color="secondary" onClick={toggleProfileModal}>Batal</Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default NavbarComponent