import React, { useState, useEffect } from 'react'
import { Navbar, NavbarBrand, Nav, NavItem, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button, Modal, ModalHeader, ModalBody, ModalFooter, Row, Col, Label, Input } from 'reactstrap'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../supabaseClient'
import logo from '/logo.png'

const NavbarComponent = () => {
  const { user, logout, profile, saveProfile, registeredUsers, profileModalOpen, toggleProfileModal } = useAuth()
  const [form, setForm] = useState({
    namaSupplier: '',
    namaBank: '',
    namaPenerima: '',
    noRekening: ''
  })
  const [errors, setErrors] = useState({})
  const refs = {
    namaSupplier: React.useRef(),
    namaBank: React.useRef(),
    namaPenerima: React.useRef(),
    noRekening: React.useRef()
  }

  const location = useLocation()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toggleDropdown = () => setDropdownOpen(!dropdownOpen)

  useEffect(() => {
    if (!user) return

    setForm(prev => ({
      namaSupplier: prev.namaSupplier || user.profile?.namaSupplier || user.name,
      namaBank: prev.namaBank || user.profile?.namaBank || '',
      namaPenerima: prev.namaPenerima || user.profile?.namaPenerima || user.name,
      noRekening: prev.noRekening || user.profile?.noRekening || ''
    }))
  }, [profile, user])

  const handleSave = async () => {
    const { namaSupplier, namaBank, namaPenerima, noRekening } = form
    const newErrors = {}

    if (!namaSupplier.trim()) {
      newErrors.namaSupplier = 'Nama supplier wajib diisi'
    } else {
      const isTaken = registeredUsers.some(
        (u) => u.role === 'supplier' && u.name !== user.name && u.profile?.namaSupplier === namaSupplier
      )
      if (isTaken) newErrors.namaSupplier = 'Nama supplier sudah dipakai'
    }

    if (!namaBank.trim()) newErrors.namaBank = 'Nama bank wajib diisi'
    if (!namaPenerima.trim()) newErrors.namaPenerima = 'Nama penerima wajib diisi'
    if (!noRekening.trim()) newErrors.noRekening = 'No rekening wajib diisi'

    setErrors(newErrors)

    const firstErrorField = Object.keys(newErrors)[0]
    if (firstErrorField) {
      refs[firstErrorField]?.current?.focus()
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          profile: { namaSupplier, namaBank, namaPenerima, noRekening } 
        })
        .eq('name', user.name)

      if (error) {
        console.error('Error updating profile:', error)
        Swal.fire('Error', 'Gagal menyimpan profil', 'error')
        return
      }

      const updatedUser = { ...user, profile: { namaSupplier, namaBank, namaPenerima, noRekening } }
      localStorage.setItem('currentUser', JSON.stringify(updatedUser))

      Swal.fire('Berhasil', 'Profil berhasil disimpan', 'success')

      saveProfile({ namaSupplier, namaBank, namaPenerima, noRekening })
      toggleProfileModal()
    } catch (error) {
      console.error('Error saving profile:', error)
      Swal.fire('Error', 'Gagal menyimpan profil', 'error')
    }
  }

  if (location.pathname === '/login' || location.pathname === '/register') return null

  return (
    <>
      <Navbar color="light" light expand="md" className="px-4 shadow-sm justify-content-between">
        <NavbarBrand onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <img
            src={logo}
            alt="logo"
            style={{ height: "40px", width: "auto", marginRight: "8px" }}
          />
          <span>FRUK</span>
        </NavbarBrand>

        <Nav navbar className="ms-auto">
          <NavItem>
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle caret color="primary">
                {user?.name} ({user?.role})
              </DropdownToggle>
              <DropdownMenu end>
                {user?.role === 'supplier' && (
                  <>
                    <DropdownItem onClick={toggleProfileModal}>
                      Edit Profil
                    </DropdownItem>
                    <DropdownItem divider />
                  </>
                )}
                <DropdownItem onClick={() => {
                  logout()
                  navigate('/login')
                }}>
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
                innerRef={refs.namaSupplier}
                invalid={!!errors.namaSupplier}
                value={form.namaSupplier || ''}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, namaSupplier: val })
                  if (errors.namaSupplier && val.trim()) {
                    setErrors(prev => ({ ...prev, namaSupplier: undefined }))
                  }
                }}
              />
              {errors.namaSupplier && <div className="text-danger small">{errors.namaSupplier}</div>}
            </Col>
            <Col md="12" className="mb-3">
              <Label>Nama Bank</Label>
              <Input
                innerRef={refs.namaBank}
                invalid={!!errors.namaBank}
                value={form.namaBank || ''}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, namaBank: val })
                  if (errors.namaBank && val.trim()) {
                    setErrors(prev => ({ ...prev, namaBank: undefined }))
                  }
                }}
              />
              {errors.namaBank && <div className="text-danger small">{errors.namaBank}</div>}
            </Col>
            <Col md="12" className="mb-3">
              <Label>Nama Penerima</Label>
              <Input
                innerRef={refs.namaPenerima}
                invalid={!!errors.namaPenerima}
                value={form.namaPenerima || ''}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, namaPenerima: val })
                  if (errors.namaPenerima && val.trim()) {
                    setErrors(prev => ({ ...prev, namaPenerima: undefined }))
                  }
                }}
              />
              {errors.namaPenerima && <div className="text-danger small">{errors.namaPenerima}</div>}
            </Col>
            <Col md="12">
              <Label>No Rekening</Label>
              <Input
                type="number"
                innerRef={refs.noRekening}
                invalid={!!errors.noRekening}
                value={form.noRekening || ''}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, noRekening: val })
                  if (errors.noRekening && val.trim()) {
                    setErrors(prev => ({ ...prev, noRekening: undefined }))
                  }
                }}
              />
              {errors.noRekening && <div className="text-danger small">{errors.noRekening}</div>}
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