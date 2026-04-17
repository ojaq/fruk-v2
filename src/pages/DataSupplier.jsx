import React, { useEffect, useState } from 'react'
import { Button, Col, Input, Label, Row, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import Swal from 'sweetalert2'
import DataTable from 'react-data-table-component'
import { Edit, Trash2, Check, X } from 'react-feather'
import { useAuth } from '../context/AuthContext'
import { useParams } from 'react-router-dom'
import { FilePond, registerPlugin } from 'react-filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css'
import { supabase } from '../supabaseClient'

registerPlugin(
  FilePondPluginImagePreview,
  FilePondPluginFileValidateType,
  FilePondPluginImageExifOrientation
)

const DataSupplier = () => {
  const { user, productData, saveProductData, registeredUsers } = useAuth()
  const { user: targetUser } = useParams()
  const [form, setForm] = useState({
    namaProduk: '',
    jenisProduk: '',
    ukuran: '',
    satuan: '',
    hpp: '',
    hjk: '',
    keterangan: '',
    imageUrl: ''
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [file, setFile] = useState([])
  const [imagePreview, setImagePreview] = useState({ open: false, url: '' })

  const [editingRow, setEditingRow] = useState(null)
  const username = targetUser || user?.name || ''
  const targetUserData = registeredUsers.find(u => u.name === username)

  const canEdit = user?.role === 'admin' || user?.role === 'dev' || username === user?.name
  const isViewingOwnData = username === user?.name

  const [editIndex, setEditIndex] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)

  const data = (productData[username] || []).slice().sort((a, b) => (a.namaProduk || '').toLowerCase().localeCompare((b.namaProduk || '').toLowerCase()))

  const uniqueNamaProduk = [...new Set(data.map(d => d.namaProduk))].sort((a, b) => a.localeCompare(b))

  const [showNamaSuggestions, setShowNamaSuggestions] = useState(false)

  const handleSave = async () => {
    setLoading(true)

    try {
      const { namaProduk, jenisProduk, ukuran, satuan, hpp, hjk } = form

      if (!namaProduk || !jenisProduk || !ukuran || !satuan || !hpp || !hjk) {
        Swal.fire('Error', 'Field tidak boleh kosong!', 'error')
        return
      }
      let imageUrl = form.imageUrl
      if (file.length > 0 && file[0].file) {
        try {
          const ext = file[0].file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}.${ext}`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file[0].file, { upsert: true })
          
          if (uploadError) {
            console.error('Upload error:', uploadError)
            if (uploadError.message?.includes('row-level security') || uploadError.statusCode === '403') {
              Swal.fire('Error', 'Storage tidak dikonfigurasi dengan benar. Silakan hubungi admin untuk mengatur bucket storage.', 'error')
            } else {
              Swal.fire('Error', `Gagal upload gambar: ${uploadError.message}`, 'error')
            }
            setLoading(false)
            return
          }
          
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        } catch (uploadErr) {
          console.error('Upload exception:', uploadErr)
          Swal.fire('Error', 'Gagal upload gambar. Silakan coba lagi.', 'error')
          setLoading(false)
          return
        }
      }
      const profileDefaults = {
        namaSupplier: targetUserData?.profile?.namaSupplier || user?.profile?.namaSupplier || '',
        namaBank: targetUserData?.profile?.namaBank || user?.profile?.namaBank || '',
        namaPenerima: targetUserData?.profile?.namaPenerima || user?.profile?.namaPenerima || '',
        noRekening: targetUserData?.profile?.noRekening || user?.profile?.noRekening || ''
      }

      const newItem = {
        ...form,
        imageUrl,
        aktif: true,
        ...profileDefaults
      }

      const updated = [...data]
      if (editIndex !== null && editingRow) {
        const actualIndex = data.findIndex(item =>
          item.namaProduk === editingRow.namaProduk &&
          item.jenisProduk === editingRow.jenisProduk &&
          item.ukuran === editingRow.ukuran &&
          item.satuan === editingRow.satuan &&
          item.hpp === editingRow.hpp &&
          item.hjk === editingRow.hjk &&
          (item.keterangan || '') === (editingRow.keterangan || '') &&
          (item.imageUrl || '') === (editingRow.imageUrl || '')
        )
        if (actualIndex !== -1) {
          updated[actualIndex] = { ...newItem }
          await saveProductData(username, updated)
          Swal.fire('Berhasil', 'Data berhasil diubah', 'success')
        } else {
          updated.push(newItem)
          await saveProductData(username, updated)
          Swal.fire('Berhasil', 'Data berhasil ditambahkan', 'success')
        }
      } else {
        updated.push(newItem)
        await saveProductData(username, updated)
        Swal.fire('Berhasil', 'Data berhasil ditambahkan', 'success')
      }

      setForm({
        namaProduk: '',
        jenisProduk: '',
        ukuran: '',
        satuan: '',
        hpp: '',
        hjk: '',
        keterangan: '',
        imageUrl: ''
      })
      setFile([])
      setEditIndex(null)
      setEditingRow(null)
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving product:', error)
      Swal.fire('Error', 'Gagal menyimpan data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row, index) => {
    setForm(row)
    setFile([])
    setEditIndex(index)
    setEditingRow(row)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setForm({
      namaProduk: '',
      jenisProduk: '',
      ukuran: '',
      satuan: '',
      hpp: '',
      hjk: '',
      keterangan: '',
      imageUrl: ''
    })
    setFile([])
    setEditIndex(null)
    setEditingRow(null)
    setModalOpen(true)
  }

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: `Yakin ingin hapus produk "${row.namaProduk}"?`,
      text: 'Data ini akan dihapus secara permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal'
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const index = data.findIndex(p => p.id === row.id)
      if (index === -1) throw new Error('Data tidak ditemukan')

      const updated = [...data]
      updated[index].isDeleted = true
      await saveProductData(username, updated)
      Swal.fire('Dihapus!', `Produk "${row.namaProduk}" berhasil dihapus.`, 'success')
    } catch (error) {
      console.error('Error deleting product:', error)
      Swal.fire('Error', 'Gagal menghapus produk', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleAktif = async (index) => {
    const isActivating = !data[index].aktif

    if (!isActivating) {
      const result = await Swal.fire({
        html: `
          <h4>Nonaktifkan produk</h4>
          <strong>\"${data[index].namaProduk}\"?</strong>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Lanjutkan',
        cancelButtonText: 'Batal'
      })
      if (!result.isConfirmed) return
    }
    setLoading(true)
    try {
      const updated = [...data]
      updated[index].aktif = isActivating
      await saveProductData(username, updated)
      const actionText = isActivating ? 'diaktifkan' : 'dinonaktifkan'
      const revertStatus = !isActivating
      const result = await Swal.fire({
        title: 'Berhasil',
        text: `Produk \"${updated[index].namaProduk}\" berhasil ${actionText}.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Undo',
        cancelButtonText: 'Tutup'
      })
      if (result.isConfirmed) {
        const reverted = [...data]
        reverted[index].aktif = revertStatus
        await saveProductData(username, reverted)
        Swal.fire('Dibatalkan', 'Status produk dikembalikan ke sebelumnya.', 'info')
      }
    } catch (error) {
      console.error('Error toggling product status:', error)
      Swal.fire('Error', 'Gagal mengubah status produk', 'error')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      name: 'No',
      selector: (row, i) => i + 1,
      width: '60px',
      wrap: true
    },
    {
      name: 'Nama Produk',
      selector: row => row.namaProduk,
      sortable: true,
      wrap: true
    },
    {
      name: 'Detail Produk',
      selector: row => {return `${row.jenisProduk} ${row.ukuran} ${row.satuan}`},
      sortable: true,
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
      width: "120px",
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
      width: "120px",
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
          alt={row.namaProduk}
          style={{ width: 60, height: 60, objectFit: 'cover', cursor: 'pointer', borderRadius: 6, border: '1px solid #eee' }}
          onClick={() => setImagePreview({ open: true, url: row.imageUrl })}
        />
      ) : <span className="text-muted">-</span>,
      width: '100px',
      wrap: true
    },
    {
      name: 'Aktif?',
      cell: (row, i) => (
        <Button size="sm" color={row.aktif ? "success" : "danger"} onClick={() => toggleAktif(i)} disabled={loading || !canEdit}>
          {row.aktif ? <Check size={16} /> : <X size={16} />}
        </Button>
      ),
      width: "70px",
      wrap: true
    },
    {
      name: 'Aksi',
      cell: (row, i) => (
        <>
          {canEdit && (
            <>
              <Button size="sm" color="warning" className="me-2" onClick={() => handleEdit(row, i)} disabled={loading}>
                <Edit size={16} />
              </Button>
              <Button size="sm" color="danger" onClick={() => handleDelete(row)} disabled={loading}>
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </>
      ),
      width: "130px",
      wrap: true
    }
  ]

  const filteredData = data.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchText.toLowerCase())
    )
  )

  const filteredNamaProduk = uniqueNamaProduk.filter(n =>
    n.toLowerCase().includes(form.namaProduk.toLowerCase())
  )

  const allActive = filteredData.length > 0 && filteredData.every(p => p.aktif)
  const allInactive = filteredData.length > 0 && filteredData.every(p => !p.aktif)

  const toggleAllAktif = async (status) => {
    const affected = filteredData.filter(item => item.aktif !== status)
    if (affected.length === 0) return
    const htmlList = affected.map((item, i) => `
      <div style="text-align:left;margin-bottom:6px;">
        <input type="checkbox" id="prod-${i}" data-index="${data.findIndex(d => d === item)}" checked />
        <label for="prod-${i}">
          ${item.namaProduk} (${item.jenisProduk} ${item.ukuran} ${item.satuan})
        </label>
      </div>
    `).join('')

    const result = await Swal.fire({
      title: status ? 'Aktifkan Produk' : 'Nonaktifkan Produk',
      html: `
        <div style="max-height:300px;overflow:auto;">
          ${htmlList}
        </div>
      `,
      width: 600,
      showCancelButton: true,
      confirmButtonText: 'Lanjutkan',
      cancelButtonText: 'Batal',
      preConfirm: () => {
        const checkboxes = Swal.getPopup().querySelectorAll('input[type="checkbox"]')
        const selectedIndexes = []
        checkboxes.forEach(cb => {
          if (cb.checked) {
            selectedIndexes.push(parseInt(cb.dataset.index))
          }
        })
        return selectedIndexes
      }
    })

    if (!result.isConfirmed || result.value.length === 0) return
    setLoading(true)
    try {
      const updated = [...data]
      result.value.forEach(index => {
        updated[index].aktif = status
      })
      await saveProductData(username, updated)
      Swal.fire(
        'Berhasil',
        `${result.value.length} produk berhasil di-${status ? 'aktifkan' : 'nonaktifkan'}`,
        'success'
      )
    } catch (error) {
      console.error(error)
      Swal.fire('Error', 'Gagal mengubah status', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <h4>Data Supplier ({targetUserData?.profile?.namaSupplier || username})</h4>
      {!isViewingOwnData && (
        <p className="text-muted mb-3">
          {canEdit ? 'Mode Admin - Anda dapat mengedit data supplier ini' : 'Mode View - Anda hanya dapat melihat data'}
        </p>
      )}
      <div className="mb-4 mt-3">
        <Row className="mb-3">
          <Col xs="12" md="6" className="mb-2 mb-md-0">
            <Input
              placeholder="🔍 Cari produk..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              disabled={loading}
            />
          </Col>
          <Col xs="12" md="6" className="text-end">
            {canEdit && (
              <>
                <Button type="submit" color="primary" className="me-2" disabled={loading} onClick={handleAdd}>
                  Tambah Produk
                </Button>
                <Button color="success" className="me-2" onClick={() => toggleAllAktif(true)} disabled={loading || filteredData.length === 0 || allActive}>
                  Aktifkan Semua
                </Button>
                <Button color="danger" className="me-2" onClick={() => toggleAllAktif(false)} disabled={loading || filteredData.length === 0 || allInactive}>
                  Nonaktifkan Semua
                </Button>
              </>
            )}
          </Col>
        </Row>
      </div>

      <div className="border overflow-auto" style={{ minHeight: 200 }}>
        <DataTable
          columns={columns}
          data={filteredData}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 25, 50, 100]}
          noDataComponent="Belum ada data"
          responsive
          highlightOnHover
          progressPending={loading}
        />
      </div>

      <Modal isOpen={modalOpen} toggle={() => setModalOpen(!modalOpen)} centered size="lg">
        <ModalHeader toggle={() => setModalOpen(!modalOpen)}>
          {editIndex !== null ? 'Edit Produk' : 'Tambah Produk'}
        </ModalHeader>
        <ModalBody>
          <Row className="mb-2">
            <Col xs="12" sm="6" md="12" className="mb-2 mb-md-3">
              <Label>Nama Produk *</Label>
              <div style={{ position: 'relative' }}>
                <Input
                  value={form.namaProduk}
                  onChange={e => {
                    setForm({ ...form, namaProduk: e.target.value })
                    setShowNamaSuggestions(true)
                  }}
                  onFocus={() => setShowNamaSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNamaSuggestions(false), 150)}
                  disabled={loading}
                  placeholder="Masukkan nama produk"
                />

                {showNamaSuggestions &&
                  form.namaProduk &&
                  filteredNamaProduk.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        width: '100%',
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderTop: 'none',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}
                    >
                      {filteredNamaProduk.map((n, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '8px',
                            cursor: 'pointer'
                          }}
                          onMouseDown={() => {
                            setForm({ ...form, namaProduk: n })
                            setShowNamaSuggestions(false)
                          }}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </Col>
            <Col xs="12" sm="6" md="4" className="mb-2 mb-md-3">
              <Label>Jenis Produk *</Label>
              <Input
                type="select"
                value={form.jenisProduk}
                onChange={e => setForm({ ...form, jenisProduk: e.target.value })}
                disabled={loading}
                required
              >
                <option value="">Pilih Jenis</option>
                <option value="Makanan">Makanan</option>
                <option value="Minuman">Minuman</option>
                <option value="Frozen Food">Frozen Food</option>
                <option value="Toiletries">Toiletries</option>
                <option value="Buku">Buku</option>
                <option value="Pakaian">Pakaian</option>
                <option value="Kebutuhan Rumah Tangga">Kebutuhan Rumah Tangga</option>
                <option value="Mainan">Mainan</option>
                <option value="Aksesoris">Aksesoris</option>
              </Input>
            </Col>
            <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
              <Label>Ukuran *</Label>
              <Input type="number" value={form.ukuran} onChange={e => setForm({ ...form, ukuran: e.target.value })} disabled={loading} />
            </Col>
            <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
              <Label>Satuan *</Label>
              <Input value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} disabled={loading} />
            </Col>
            <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
              <Label>HPP *</Label>
              <Input type="number" value={form.hpp} onChange={e => setForm({ ...form, hpp: e.target.value })} disabled={loading} />
            </Col>
            <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
              <Label>HJK *</Label>
              <Input type="number" value={form.hjk} onChange={e => setForm({ ...form, hjk: e.target.value })} disabled={loading} />
            </Col>
            <Col xs="12" md="12" className="mb-2 mb-md-2">
              <Label>Keterangan</Label>
              <Input type="textarea" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} disabled={loading} />
            </Col>
            <Col xs="12" md="12">
              <Label>Gambar Produk</Label>
              <FilePond
                files={file}
                onupdatefiles={setFile}
                allowMultiple={false}
                maxFiles={1}
                name="image"
                maxFileSize="25MB"
                acceptedFileTypes={['image/jpeg', 'image/png', 'image/svg+xml']}
                labelIdle={`<span class="text-center" style="cursor: pointer;">
                  Drag & Drop your files or <span class='filepond--label-action'>Browse</span>
                  <br/>
                  <small class="text-muted d-block mb-0">Only image files (jpeg, png, svg) are allowed. </small>
                </span>`}
                labelFileTypeNotAllowed="File type not supported!"
                credits={false}
                allowImagePreview={true}
                disabled={loading}
              />
              {form.imageUrl && file.length === 0 && (
                <div className="text-center mt-2">
                  <img src={form.imageUrl} alt="Preview" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8, border: '1px solid #eee' }} />
                  <div className="text-muted small mt-1">Gambar saat ini</div>
                </div>
              )}
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Loading...' : (editIndex !== null ? 'Update' : 'Tambah')}
          </Button>
          <Button color="secondary" onClick={() => setModalOpen(false)} disabled={loading}>
            Batal
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={imagePreview.open} toggle={() => setImagePreview({ open: false, url: '' })} centered size="xl">
        <ModalBody className="text-center p-0 bg-dark">
          <img src={imagePreview.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', margin: 'auto', display: 'block' }} />
        </ModalBody>
      </Modal>
    </div>
  )
}

export default DataSupplier