import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppUi } from '../context/AppUiContext'
import DataTable from 'react-data-table-component'
import { Button, Row, Col, Card, CardHeader, CardBody, Input, Modal, ModalBody, ModalFooter, ModalHeader, Label, FormGroup, CardFooter } from 'reactstrap'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Select from 'react-select'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2'

const CustomerInvoice = () => {
  const { num } = useParams()
  const { currentWeek } = useAppUi()
  const activeWeek = num ? Number(num) : currentWeek
  const { orders, weeks, weekData } = useAuth()
  const [grouped, setGrouped] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedPemesan, setSelectedPemesan] = useState(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [selectedInvoiceRow, setSelectedInvoiceRow] = useState(null)
  const [invoiceMethod, setInvoiceMethod] = useState('transfer')
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  const highlightText = (text, search) => {
    if (!search) return text
    const regex = new RegExp(`(${search})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }

  useEffect(() => {
    const relevant = (orders || []).filter(o => o.channel === 'online' || (o.channel === 'offline' && o.status === 'open_bill'))
      .filter(o => {
        if (!activeWeek) return true
        const weekCode = weeks.find(w => w.id === o.week_id)?.week_code
        return weekCode === `W${activeWeek}`
      })

    const map = {}
    relevant.forEach(o => {
      const prod = o.registration_products || {}
      const label = `${prod.nama_produk || ''} ${prod.ukuran || ''} ${prod.satuan || ''}`.trim()
      const sourceLabel = o.channel === 'offline'
        ? (o.status === 'open_bill' ? 'Offline Open Bill' : 'Offline')
        : 'Online'
      const key = `${o.pemesan}|${sourceLabel}|${label}|${o.catatan || ''}`
      const qty = Number(o.jumlah)
      const bayarRaw = Number(o.bayar)
      const bayar = bayarRaw > 0 && bayarRaw < 1000 ? bayarRaw * 1000 : bayarRaw

      const row = {
        pemesan: o.pemesan,
        sourceLabel,
        produkLabel: label,
        catatan: o.catatan || '',
        jumlah: qty,
        bayar,
        week: weeks.find(w => w.id === o.week_id)?.week_code || '',
        orderIds: [o.id],
        rawStatus: o.status,
        rawChannel: o.channel
      }

      if (!map[key]) {
        map[key] = { ...row }
      } else {
        map[key].jumlah += qty
        map[key].bayar += bayar
        map[key].orderIds = [...new Set([...(map[key].orderIds || []), ...row.orderIds])]
      }
    })

    const arr = Object.values(map)
    const byPemesan = {}
    arr.forEach(r => {
      if (!byPemesan[r.pemesan]) byPemesan[r.pemesan] = []
      byPemesan[r.pemesan].push(r)
    })

    setGrouped(Object.entries(byPemesan).map(([pemesan, list], i) => {
      const totalQty = list.reduce((a, b) => a + b.jumlah, 0)
      const totalHarga = list.reduce((a, b) => a + b.bayar, 0)
      const sourceSet = [...new Set(list.map(item => item.sourceLabel))].filter(Boolean)
      const sourceLabel = sourceSet.length === 1 ? sourceSet[0] : sourceSet.join(', ')
      return { id: i + 1, pemesan, sourceLabel, items: list, totalQty, totalHarga }
    }).sort((a, b) => a.pemesan.toLowerCase().localeCompare(b.pemesan.toLowerCase())))
  }, [orders, weeks, activeWeek])

  const handleInvoiceMarkLunas = async () => {
    if (!selectedInvoiceRow || !selectedInvoiceRow.items?.length) return

    const openBillOrderIds = selectedInvoiceRow.items
      .filter(item => item.rawStatus === 'open_bill')
      .flatMap(item => item.orderIds)

    if (!openBillOrderIds.length) return

    setInvoiceLoading(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'lunas',
          method: invoiceMethod
        })
        .in('id', openBillOrderIds)

      if (error) throw error

      Swal.fire('Berhasil', 'Open bill berhasil diubah menjadi lunas.', 'success').then(() => {
        window.location.reload()
      })
    } catch (error) {
      console.error('Error updating invoice status:', error)
      Swal.fire('Error', 'Gagal mengubah status invoice.', 'error')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const sendInvoice = (pemesan, items, weekNum, sourceLabel) => {
    const weekLabel = weekNum || activeWeek
    const date = new Date()
    const todayStr = date.toISOString().split('T')[0]
    const dueDate = new Date(date)
    dueDate.setDate(dueDate.getDate() + 2)
    const dueStr = dueDate.toISOString().split('T')[0]

    const doc = new jsPDF('p', 'mm', 'a4')
    const logoUrl = '/logo.jpg'

    const img = new Image()
    img.src = logoUrl
    img.onload = () => {
      doc.addImage(img, 'JPEG', 10, 10, 40, 40)

      doc.setFontSize(26)
      doc.setFont('helvetica', 'bold')
      const title = `Customer Invoice - ${pemesan}${sourceLabel ? ` (${sourceLabel})` : ''} ${weekLabel ? `Minggu ke-${weekLabel}` : 'Semua Minggu'}`
      const wrapped = doc.splitTextToSize(title, 120)

      wrapped.forEach((line, i) => {
        doc.text(line, 195, 20 + (i * 10), { align: 'right' })
      })

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Tanggal: ${todayStr}`, 195, 50, { align: 'right' })
      doc.text(`Jatuh Tempo: ${dueStr}`, 195, 60, { align: 'right' })

      doc.setFont('helvetica', 'bold')
      const totalBayar = items.reduce((a, b) => a + Number(b.bayar), 0)
      doc.text(`Balance Due: Rp${totalBayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`, 195, 70, { align: 'right' })

      doc.setFontSize(10)
      doc.text('Bazaar FRUK', 15, 50)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Indonesia', 15, 55)
      doc.text('desofita@gmail.com', 15, 60)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Untuk: ${pemesan}`, 15, 70)

      const table = []
      let totalQty = 0

      table.push(['Produk', 'Jumlah', 'Harga Satuan', 'Total Bayar'])

      items.forEach(item => {
        const qty = Number(item.jumlah)
        const bayar = Number(item.bayar)
        const unit = qty > 0 ? bayar / qty : 0

        table.push([
          `${item.produkLabel}${item.catatan ? ` (${item.catatan})` : ''}`,
          qty,
          `Rp${unit.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
          `Rp${bayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
        ])

        totalQty += qty
      })

      table.push([
        'TOTAL',
        totalQty,
        '',
        `Rp${totalBayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      ])

      autoTable(doc, {
        startY: 78,
        head: [table[0]],
        body: table.slice(1),
        styles: {
          fontSize: 9,
          cellPadding: 2,
          fillColor: [255, 255, 255]
        },
        headStyles: {
          fillColor: [224, 224, 224],
          textColor: 20
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255]
        },
        didParseCell: data => {
          if (data.row.index === table.length - 2) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [224, 224, 224]
          }
        }
      })

      const finalY = doc.lastAutoTable.finalY || 100

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Catatan:', 15, finalY + 10)
      doc.text(`Invoice untuk ${weekNum ? `minggu ke-${weekNum}` : 'semua minggu'}`, 15, finalY + 15)
      doc.text('Pembayaran dapat dilakukan melalui :\nBank Jago Syariah - 503236704721\nDini Widianti', 15, finalY + 25)

      doc.save(`Customer Invoice - ${pemesan} ${weekNum ? `Minggu ke-${weekNum}` : 'Semua Minggu'}.pdf`)
    }
  }

  const generateInvoiceSheet = () => {
    const doc = new jsPDF('p', 'mm', 'a4')
    let y = 20

    doc.setFontSize(14)
    doc.text(`Customer Invoice - ${activeWeek ? `Minggu ${activeWeek}` : 'Semua Minggu'}`, 14, y)

    y += 5

    const table = []
    table.push(['No', 'Nama Pemesan', 'Produk', 'Total Jumlah Pesanan', 'Harga Satuan', 'Total Bayar Customer'])

    let no = 1
    let grandTotalQty = 0
    let grandTotalBayar = 0

    grouped.forEach(group => {
      let totalQty = 0
      let totalBayar = 0
      let firstRow = true

      group.items.forEach(item => {
        const unitPrice = item.jumlah > 0 ? item.bayar / item.jumlah : 0
        table.push([
          firstRow ? no : '',
          firstRow ? group.pemesan : '',
          `${item.produkLabel}${item.catatan ? ` (${item.catatan})` : ''}`,
          item.jumlah,
          `Rp${unitPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
          `Rp${item.bayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
        ])
        firstRow = false
        totalQty += item.jumlah
        totalBayar += item.bayar
      })

      table.push([
        '',
        `${group.pemesan} Total`,
        '',
        totalQty,
        '',
        `Rp${totalBayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      ])

      no++
      grandTotalQty += totalQty
      grandTotalBayar += totalBayar
    })

    table.push([
      '',
      'TOTAL',
      '',
      grandTotalQty,
      '',
      `Rp${grandTotalBayar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
    ])

    autoTable(doc, {
      startY: y,
      head: [table[0]],
      body: table.slice(1),
      styles: {
        fontSize: 9,
        cellPadding: 2,
        fillColor: [255, 255, 255]
      },
      headStyles: {
        fillColor: [224, 224, 224],
        textColor: 20
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      didParseCell: data => {
        const cellText = data.cell.raw?.toString() || ''

        if (
          cellText.toLowerCase().includes('total') &&
          data.row.section === 'body' &&
          data.row.index >= 0
        ) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [224, 224, 224]
        }
      }
    })

    doc.save(`Customer-Invoice-${activeWeek ? `Minggu-${activeWeek}` : 'Semua-Minggu'}.pdf`)
  }

  const filteredGrouped = grouped.filter(group => {
    const matchPemesan = selectedPemesan ? group.pemesan === selectedPemesan.value : true
    const matchSearch = searchText
      ? group.items.some(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchText.toLowerCase())
        )
      )
      : true

    return matchPemesan && matchSearch
  })

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3">
        <Col xs="12" md="6">
          <h4>Customer Invoice - {activeWeek ? `Minggu ${activeWeek}` : 'Semua Minggu'}</h4>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
        </Col>
      </Row>
      <Row className="mb-3">
        <Col xs="12" md="4" className="mb-2 mb-md-0">
          <Input
            placeholder="🔍 Cari..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Col>
        <Col xs="12" md="4" className="mb-2 mb-md-0">
          <Select
            options={grouped.map(g => ({ label: g.pemesan, value: g.pemesan }))}
            placeholder="🔽 Filter Pemesan"
            isClearable
            isSearchable
            value={selectedPemesan}
            onChange={setSelectedPemesan}
          />
        </Col>
        <Col xs="6" md="2" className="mb-2 mb-md-0">
          <Button color="danger" onClick={() => {
            setSearchText('')
            setSelectedPemesan(null)
          }}>
            Reset Filter
          </Button>
        </Col>
        <Col xs="6" md="2" className="text-end">
          {grouped.length > 0 && (
            <Button
              color="success"
              onClick={() => generateInvoiceSheet()}
            >
              Generate All Invoice
            </Button>
          )}
        </Col>
      </Row>
      {filteredGrouped.map(group => (
        <Card key={group.id} className="mb-3">
          <CardHeader>
            <Row className="align-items-center">
              <Col>
                <h5>{group.pemesan}{group.sourceLabel ? ` (${group.sourceLabel})` : ''}</h5>
              </Col>
              {group.items.some(item => item.rawStatus === 'open_bill') && (
                <Col xs="auto">
                  <Button
                    color="warning"
                    size="sm"
                    onClick={() => {
                      setSelectedInvoiceRow(group)
                      setInvoiceMethod('transfer')
                      setInvoiceModalOpen(true)
                    }}
                  >
                    Tandai Lunas
                  </Button>
                </Col>
              )}
            </Row>
          </CardHeader>
          <CardBody className="mb-2 p-0">
            <div className="overflow-auto">
              <DataTable
                columns={[
                  {
                    name: 'Produk',
                    cell: row => {
                      const txt = `${row.produkLabel}${row.catatan ? ` (${row.catatan})` : ''}`
                      return (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: highlightText(txt, searchText)
                          }}
                        />
                      )
                    },
                    wrap: true
                  },
                  {
                    name: 'Jumlah',
                    cell: row => (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: highlightText(String(row.jumlah), searchText)
                        }}
                      />
                    ),
                    wrap: true
                  },
                  {
                    name: 'Harga Satuan',
                    cell: row => {
                      const unit = row.jumlah > 0 ? row.bayar / row.jumlah : 0
                      const adjusted = unit < 1000 ? unit * 1000 : unit
                      const txt = adjusted > 0 ? `Rp${adjusted.toLocaleString('id-ID')}` : '-'
                      return (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: highlightText(txt, searchText)
                          }}
                        />
                      )
                    },
                    wrap: true
                  },
                  {
                    name: 'Total Bayar',
                    cell: row => {
                      const bayar = row.bayar
                      const adjusted = bayar < 1000 ? bayar * 1000 : bayar
                      const txt = adjusted > 0 ? `Rp${adjusted.toLocaleString('id-ID')}` : '-'
                      return (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: highlightText(txt, searchText)
                          }}
                        />
                      )
                    },
                    wrap: true
                  },
                  {
                    name: 'Aksi',
                    cell: row => '-',
                    width: '140px',
                    wrap: true
                  }
                ]}
                data={group.items}
                highlightOnHover
                responsive
              />
            </div>
          </CardBody>
          <CardFooter className='py-3'>
            <Row>
              <Col xs="12" md="6" className="text-start mb-2 mb-md-0">
                <strong>Total Qty:</strong> {group.totalQty} &nbsp; | &nbsp;
                <strong>Total:</strong> Rp{group.totalHarga.toLocaleString()}
              </Col>
              <Col xs="12" md="6" className="text-end">
                <Button color="primary" size="sm" onClick={() => sendInvoice(group.pemesan, group.items, activeWeek, group.sourceLabel)}>
                  Generate Invoice {group.pemesan}
                </Button>
              </Col>
            </Row>
          </CardFooter>
        </Card>
      ))}
      <Modal isOpen={invoiceModalOpen} toggle={() => setInvoiceModalOpen(false)} centered>
        <ModalHeader toggle={() => setInvoiceModalOpen(false)}>Ubah Open Bill menjadi Lunas</ModalHeader>
        <ModalBody>
          <p>Ubah semua open bill offline menjadi lunas untuk <strong>{selectedInvoiceRow?.pemesan}</strong>.</p>
          <FormGroup>
            <Label>Method pembayaran</Label>
            <Select
              options={[
                { label: 'Transfer', value: 'transfer' },
                { label: 'QRIS', value: 'qris' },
                { label: 'Cash', value: 'cash' }
              ]}
              value={{ label: invoiceMethod.charAt(0).toUpperCase() + invoiceMethod.slice(1), value: invoiceMethod }}
              onChange={(option) => setInvoiceMethod(option?.value || 'transfer')}
              isClearable={false}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setInvoiceModalOpen(false)} disabled={invoiceLoading}>
            Batal
          </Button>
          <Button color="primary" onClick={handleInvoiceMarkLunas} disabled={invoiceLoading}>
            {invoiceLoading ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default CustomerInvoice