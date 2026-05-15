import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DataTable from 'react-data-table-component'
import { Button, Col, Input, Label, Row, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import Swal from 'sweetalert2'
import { Check, Edit, Trash2, X } from 'react-feather'
import Select from 'react-select'
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

const MasterSupplier = () => {
  const { productData, registeredUsers, user, saveProductData } = useAuth()
  const [combinedData, setCombinedData] = useState([])
  const [searchText, setSearchText] = useState('')
  const [filterSupplier, setFilterSupplier] = useState(null)
  const [filterJenis, setFilterJenis] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editOwner, setEditOwner] = useState(null)
  const [editIndex, setEditIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState([])
  const [imagePreview, setImagePreview] = useState({ open: false, url: '' })
  const [editingRow, setEditingRow] = useState(null)

  const allProducts = Object.values(productData).flat()
  const uniqueNamaProduk = [...new Set(allProducts.map(d => d.namaProduk))].sort((a, b) => a.localeCompare(b))
  const uniqueJenisProduk = [...new Set(allProducts.map(d => d.jenisProduk))].sort((a, b) => a.localeCompare(b))

  const [showNamaSuggestions, setShowNamaSuggestions] = useState(false)

  useEffect(() => {
    const all = []
    Object.entries(productData).forEach(([username, items]) => {
      const userObj = registeredUsers.find(u => u.name === username)
      items.forEach((item, i) => {
        if (item.aktif) {
          all.push({
            ...item,
            namaSupplier: item.namaSupplier || userObj?.profile?.namaSupplier || userObj?.name || username,
            namaBank: item.namaBank,
            namaPenerima: item.namaPenerima,
            noRekening: item.noRekening,
            noTelp: item.noTelp,
            _owner: username,
            _index: i
          })
        }
      })
    })
    all.sort((a, b) => (a.namaSupplier || '').toLowerCase().localeCompare((b.namaSupplier || '').toLowerCase()))
    setCombinedData(all)
  }, [productData, registeredUsers])

  const handleEdit = (row) => {
    setEditForm({ ...row })
    setFile([])
    setEditOwner(row._owner)
    setEditIndex(row._index)
    setEditingRow(row)
    setEditModal(true)
  }

  const toggleAktif = async (row) => {
    const isActivating = !row.aktif

    if (!isActivating) {
      const result = await Swal.fire({
        html: `
          <h4>Nonaktifkan produk</h4>
          <strong>"${row.namaProduk}"?</strong><br/><br/>
          Produk akan disembunyikan dari halaman ini.<br/>
          Kamu bisa mengaktifkannya kembali di halaman<br/><br/>
          "<strong>Data Supplier - ${row._owner}</strong>".
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
      const updatedList = [...(productData[row._owner] || [])]
      updatedList[row._index].aktif = isActivating
      await saveProductData(row._owner, updatedList)

      const actionText = isActivating ? 'diaktifkan' : 'dinonaktifkan'
      const revertStatus = !isActivating

      const result = await Swal.fire({
        title: 'Berhasil',
        text: `Produk "${row.namaProduk}" berhasil ${actionText}.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Undo',
        cancelButtonText: 'Tutup'
      })

      if (result.isConfirmed) {
        const revertedList = [...(productData[row._owner] || [])]
        revertedList[row._index].aktif = revertStatus
        await saveProductData(row._owner, revertedList)
        Swal.fire('Dibatalkan', `Status produk dikembalikan ke sebelumnya.`, 'info')
      }
    } catch (error) {
      console.error('Error toggling product status:', error)
      Swal.fire('Error', 'Gagal mengubah status produk', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSave = async () => {
    setLoading(true)
    try {
      let imageUrl = editForm.imageUrl
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
      const updatedList = [...(productData[editOwner] || [])]
      let actualIndex = editIndex
      if (editingRow) {
        actualIndex = updatedList.findIndex(item =>
          item.namaProduk === editingRow.namaProduk &&
          item.jenisProduk === editingRow.jenisProduk &&
          item.ukuran === editingRow.ukuran &&
          item.satuan === editingRow.satuan &&
          item.hpp === editingRow.hpp &&
          item.hjk === editingRow.hjk &&
          (item.keterangan || '') === (editingRow.keterangan || '') &&
          (item.imageUrl || '') === (editingRow.imageUrl || '')
        )
      }
      if (actualIndex !== null && actualIndex !== -1 && updatedList[actualIndex]) {
        updatedList[actualIndex] = { ...editForm, imageUrl }
        await saveProductData(editOwner, updatedList)
        setEditModal(false)
        setEditingRow(null)
        Swal.fire('Berhasil', 'Data produk berhasil diupdate', 'success')
      } else {
        updatedList.push({ ...editForm, imageUrl })
        await saveProductData(editOwner, updatedList)
        setEditModal(false)
        setEditingRow(null)
        Swal.fire('Berhasil', 'Data produk berhasil ditambahkan', 'success')
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal update produk', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: `Hapus produk "${row.namaProduk}"?`,
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

  const columns = [
    { name: 'No', selector: (row, i) => i + 1, width: '60px', wrap: true },
    { name: 'Nama Supplier', selector: row => row.namaSupplier, wrap: true },
    { name: 'Nama Produk', selector: row => row.namaProduk, wrap: true },
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
      name: 'Detail Produk',
      selector: row => { return `${row.jenisProduk} ${row.ukuran} ${row.satuan}` },
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
    { name: 'Keterangan', selector: row => row.keterangan || '-', wrap: true },
    { name: 'Bank', selector: row => row.namaBank || '-', wrap: true, width: "120px", },
    { name: 'Penerima', selector: row => row.namaPenerima || '-', wrap: true, width: "150px", },
    { name: 'No Rekening', selector: row => row.noRekening || '-', wrap: true, width: "150px", },
    { name: 'No Telp', selector: row => row.noTelp || '-', wrap: true, width: "150px", },
    ...(user?.role === 'admin' || user?.role === 'dev' ? [
      {
        name: 'Aksi',
        cell: (row, i) => (
          <>
            <Button size="sm" color={row.aktif ? "success" : "danger"} className="me-2" onClick={() => toggleAktif(row)} disabled={loading}>
              {row.aktif ? <Check size={16} /> : <X size={16} />}
            </Button>
            <Button size="sm" color="warning" className="me-2" onClick={() => handleEdit(row)} disabled={loading}>
              <Edit size={16} />
            </Button>
            <Button size="sm" color="danger" onClick={() => handleDelete(row)} disabled={loading}>
              <Trash2 size={16} />
            </Button>
          </>
        ),
        width: '150px',
        wrap: true
      }] : [])
  ]

  const supplierOptions = [...new Set(combinedData.map(d => d.namaSupplier))].map(s => ({ label: s, value: s }))
  const jenisOptions = [...new Set(combinedData.map(d => d.jenisProduk))].map(j => ({ label: j, value: j }))

  const filtered = combinedData.filter(item => {
    const matchesSearch = Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchText.toLowerCase())
    )
    const matchesSupplier = filterSupplier ? item.namaSupplier === filterSupplier.value : true
    const matchesJenis = filterJenis ? item.jenisProduk === filterJenis.value : true
    return matchesSearch && matchesSupplier && matchesJenis
  })

  const filteredNamaProduk = uniqueNamaProduk.filter(n =>
    n.toLowerCase().includes((editForm?.namaProduk || '').toLowerCase())
  )

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row>
        <Col md="6">
          <h4>Master Data Supplier</h4>
        </Col>
        <Col md="6" className="text-end">
          <Button color="danger" onClick={() => {
            setSearchText('')
            setFilterSupplier(null)
            setFilterJenis(null)
          }}>
            Reset Filter
          </Button>
        </Col>
      </Row>

      <Row className="mt-3 mb-4">
        <Col xs="12" md="4" className="mb-2 mb-md-0">
          <Input
            placeholder="🔍 Cari apa aja..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Col>
        <Col xs="12" md="4" className="mb-2 mb-md-0">
          <Select
            options={supplierOptions}
            placeholder="🔽 Filter Supplier"
            isClearable
            isSearchable
            value={filterSupplier}
            onChange={setFilterSupplier}
          />
        </Col>
        <Col xs="12" md="4">
          <Select
            options={jenisOptions}
            placeholder="🔽 Filter Jenis"
            isClearable
            isSearchable
            value={filterJenis}
            onChange={setFilterJenis}
          />
        </Col>
      </Row>

      <div className="border overflow-auto" style={{ minHeight: 200 }}>
        <DataTable
          columns={columns}
          data={filtered}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 25, 50, 100]}
          noDataComponent="Belum ada data supplier aktif"
          responsive
          highlightOnHover
        />
      </div>


      {editModal && (
        <Modal isOpen={editModal} toggle={() => setEditModal(!editModal)} centered size="lg">
          <ModalHeader toggle={() => setEditModal(!editModal)}>
            {editIndex !== null ? 'Edit Produk' : 'Tambah Produk'}
          </ModalHeader>
          <ModalBody>
            <Row className="mb-2">
              <Col xs="12" sm="6" md="12" className="mb-2 mb-md-3">
                <Label>Nama Produk *</Label>
                <div style={{ position: 'relative' }}>
                  <Input
                    value={editForm.namaProduk}
                    onChange={e => {
                      setEditForm(f => ({ ...f, namaProduk: e.target.value }))
                      setShowNamaSuggestions(true)
                    }}
                    onFocus={() => setShowNamaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNamaSuggestions(false), 150)}
                    disabled={loading}
                    placeholder="Masukkan nama produk"
                  />

                  {showNamaSuggestions &&
                    editForm.namaProduk &&
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
                              setEditForm(f => ({ ...f, namaProduk: n }))
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
                  value={editForm.jenisProduk}
                  onChange={e => setEditForm(f => ({ ...f, jenisProduk: e.target.value }))}
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
                <Input type="number" value={editForm.ukuran} onChange={e => setEditForm({ ...editForm, ukuran: e.target.value })} />
              </Col>
              <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
                <Label>Satuan *</Label>
                <Input value={editForm.satuan} onChange={e => setEditForm({ ...editForm, satuan: e.target.value })} />
              </Col>
              <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
                <Label>HPP *</Label>
                <Input type="number" value={editForm.hpp} onChange={e => setEditForm({ ...editForm, hpp: e.target.value })} />
              </Col>
              <Col xs="6" sm="3" md="2" className="mb-2 mb-md-3">
                <Label>HJK *</Label>
                <Input type="number" value={editForm.hjk} onChange={e => setEditForm({ ...editForm, hjk: e.target.value })} />
              </Col>
              <Col xs="12" md="12" className="mb-2 mb-md-2">
                <Label>Keterangan</Label>
                <Input type="textarea" value={editForm.keterangan} onChange={e => setEditForm({ ...editForm, keterangan: e.target.value })} />
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
                />
                {editForm.imageUrl && file.length === 0 && (
                  <div className="text-center mt-2">
                    <img src={editForm.imageUrl} alt="Preview" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8, border: '1px solid #eee' }} />
                    <div className="text-muted small mt-1">Gambar saat ini</div>
                  </div>
                )}
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={handleEditSave}>
              Update
            </Button>
            <Button color="secondary" onClick={() => setEditModal(false)}>
              Batal
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <Modal isOpen={imagePreview.open} toggle={() => setImagePreview({ open: false, url: '' })} centered size="xl">
        <ModalBody className="text-center p-0 bg-dark">
          <img src={imagePreview.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', margin: 'auto', display: 'block' }} />
        </ModalBody>
      </Modal>
    </div>
  )
}

export default MasterSupplier