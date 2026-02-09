import React, { useEffect, useMemo, useState } from 'react'
import { Row, Col, Card, CardBody, CardHeader, Input, Button, Nav, NavItem, NavLink } from 'reactstrap'
import Select from 'react-select'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../context/AuthContext'

const MEDALS = ['🥇', '🥈', '🥉']

const TopList = ({ title, data, valueKey = 'value', labelKey = 'label' }) => {
  return (
    <Card className="mb-3">
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <ol className="ps-3 mb-0">
          {data.map((d, i) => (
            <li key={i} className="mb-1">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <strong>{i < 3 ? MEDALS[i] + ' ' : ''}{d[labelKey]}</strong>
                </div>
                <div className="text-muted small" style={{ minWidth: 120, textAlign: 'right' }}>
                  <strong>{d[valueKey]}</strong>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}

const parseMoney = (val) => {
  if (val == null) return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[^0-9\-,.]/g, '')
  const asNum = Number(cleaned.replace(/,/g, ''))
  return isNaN(asNum) ? 0 : asNum
}
const getAdjustedPrice = (val) => {
  const raw = parseMoney(val)
  if (!raw || raw <= 0) return 0
  return raw < 1000 ? raw * 1000 : raw
}
const formatNumber = (n) => {
  if (!isFinite(n)) return '-'
  return Math.round(n).toLocaleString('id-ID')
}
const formatCurrency = (n) => {
  if (!isFinite(n)) return '-'
  return `Rp${Math.round(n).toLocaleString('id-ID')}`
}

const wrapLabelWords = (text, maxChars = 20) => {
  if (!text) return text
  const words = String(text).split(' ')
  const lines = []
  let current = ''
  words.forEach(w => {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim()
    } else {
      if (current) lines.push(current)
      current = w
    }
  })
  if (current) lines.push(current)
  return lines.join('\n')
}

const BazaarCharts = () => {
  const { weekData, productData } = useAuth()

  const weeks = useMemo(() => Object.keys(weekData || {}).sort((a, b) => {
    const an = Number(a.replace(/^W/, ''))
    const bn = Number(b.replace(/^W/, ''))
    return an - bn
  }), [weekData])

  const optionsWeek = [{ label: 'Semua Minggu', value: 'ALL' }, ...weeks.map(w => ({ label: w, value: w }))]
  const [selectedWeek, setSelectedWeek] = useState(optionsWeek[0])
  const [topN, setTopN] = useState(10)
  const [viewMode, setViewMode] = useState('charts')
  const [chartType, setChartType] = useState('bar')
  const [activeTab, setActiveTab] = useState('items')

  const allRows = useMemo(() => {
    if (!weekData) return []
    if (!selectedWeek || selectedWeek.value === 'ALL') return Object.values(weekData).flatMap(x => x || [])
    return weekData[selectedWeek.value] || []
  }, [weekData, selectedWeek])

  const normalized = useMemo(() => allRows.map(r => {
    const jumlah = Number(r?.jumlah) || 0
    const bayar = parseMoney(r?.bayar) || 0
    return { ...r, jumlah, bayar }
  }), [allRows])

  const productLookup = useMemo(() => {
    const map = {}
    Object.entries(productData || {}).forEach(([owner, items]) => {
      (items || []).forEach(p => {
        const label = `${p.namaProduk} ${p.ukuran} ${p.satuan}`.trim()
        map[label] = { ...p, owner }
      })
    })
    return map
  }, [productData])

  const metrics = useMemo(() => {
    const itemMap = {}
    const customerMap = {}
    const supplierMap = {}

    normalized.forEach(row => {
      const keyItem = row.produkLabel
      const qty = Number(row.jumlah) || 0
      const prodInfo = productLookup[row.produkLabel]

      const hjkUnit = prodInfo ? getAdjustedPrice(prodInfo.hjk ?? prodInfo.data?.hjk ?? prodInfo.harga ?? prodInfo.data?.harga) : 0
      const hppUnit = prodInfo ? getAdjustedPrice(prodInfo.hpp ?? prodInfo.data?.hpp ?? prodInfo.harga_modal ?? prodInfo.data?.harga_modal) : 0

      const derivedUnit = qty > 0 ? (row.bayar || 0) / qty : 0
      const unitSelling = hjkUnit > 0 ? hjkUnit : (derivedUnit > 0 ? (derivedUnit < 1000 ? derivedUnit * 1000 : derivedUnit) : 0)
      const unitCost = hppUnit > 0 ? hppUnit : 0

      const revenue = unitSelling * qty
      const cost = unitCost * qty
      const profit = (unitSelling - unitCost) * qty

      if (!itemMap[keyItem]) itemMap[keyItem] = { label: keyItem, qty: 0, revenue: 0, profit: 0 }
      itemMap[keyItem].qty += qty
      itemMap[keyItem].revenue += revenue
      itemMap[keyItem].profit += profit

      const cust = row.pemesan || 'Unknown'
      if (!customerMap[cust]) customerMap[cust] = { label: cust, qty: 0, spend: 0 }
      customerMap[cust].qty += qty
      customerMap[cust].spend += revenue

      const supplierName = (prodInfo && (prodInfo.namaSupplier || prodInfo.owner)) || row.namaSupplier || 'Unknown'
      if (!supplierMap[supplierName]) supplierMap[supplierName] = { label: supplierName, qty: 0, revenue: 0, cost: 0, profit: 0 }
      supplierMap[supplierName].qty += qty
      supplierMap[supplierName].revenue += revenue
      supplierMap[supplierName].cost += cost
      supplierMap[supplierName].profit += profit
    })

    const toSortedArray = (map, sortBy = 'qty') => Object.values(map).sort((a, b) => b[sortBy] - a[sortBy])

    return {
      topItemsByQty: toSortedArray(itemMap, 'qty'),
      topItemsByRevenue: toSortedArray(itemMap, 'revenue'),
      topItemsByProfit: toSortedArray(itemMap, 'profit'),
      topCustomersByQty: toSortedArray(customerMap, 'qty'),
      topCustomersBySpend: toSortedArray(customerMap, 'spend'),
      topSuppliersByQty: toSortedArray(supplierMap, 'qty'),
      topSuppliersByRevenue: toSortedArray(supplierMap, 'revenue'),
      topSuppliersByProfit: toSortedArray(supplierMap, 'profit')
    }
  }, [normalized, productLookup])

  const makeBarOption = (title, list, labelKey = 'label', valueKey = 'value') => {
    const top = list.slice(0, topN)

    return {
      title: { text: title, left: 'center' },
      tooltip: {
        trigger: 'item',
        formatter: params => {
          const p = Array.isArray(params) ? params[0] : params
          return `${p.name}<br/>${formatNumber(p.value)}`
        }
      },
      grid: { left: 0, right: 0, containLabel: true },
      yAxis: { type: 'value' },
      xAxis: {
        type: 'category',
        data: top.map(i => wrapLabelWords(i[labelKey], 20)),
        axisLabel: {
          interval: 0,
          fontWeight: 'bold',
          color: '#222'
        }
      },
      series: [
        {
          type: 'bar',
          data: top.map(i => i[valueKey]),
          label: {
            show: true,
            position: 'inside',
            formatter: ({ value }) => formatNumber(value),
            fontWeight: 'bold',
            color: '#fff',
            textBorderWidth: 2,
            textBorderColor: 'rgba(0,0,0,0.4)'
          },
          emphasis: { focus: 'series' }
        }
      ]
    }
  }

  const buildOption = (title, list, labelKey = 'label', valueKey = 'value') => {
    return makeBarOption(title, list, labelKey, valueKey)
  }

  const itemQtyOption = useMemo(() => buildOption(`Produk Terbanyak (Jumlah Terjual) — ${selectedWeek?.label}`, metrics.topItemsByQty.map(i => ({ label: i.label, value: i.qty }))), [metrics, selectedWeek, topN, chartType])
  const itemRevenueOption = useMemo(() => buildOption(`Produk Terbanyak (Pendapatan) — ${selectedWeek?.label}`, metrics.topItemsByRevenue.map(i => ({ label: i.label, value: i.revenue }))), [metrics, selectedWeek, topN, chartType])
  const itemProfitOption = useMemo(() => buildOption(`Produk Teratas (Keuntungan) — ${selectedWeek?.label}`, metrics.topItemsByProfit.map(i => ({ label: i.label, value: i.profit }))), [metrics, selectedWeek, topN, chartType])

  const customerQtyOption = useMemo(() => buildOption(`Customer Terbanyak (Jumlah Membeli) — ${selectedWeek?.label}`, metrics.topCustomersByQty.map(i => ({ label: i.label, value: i.qty }))), [metrics, selectedWeek, topN, chartType])
  const customerSpendOption = useMemo(() => buildOption(`Customer Teratas (Pengeluaran) — ${selectedWeek?.label}`, metrics.topCustomersBySpend.map(i => ({ label: i.label, value: i.spend }))), [metrics, selectedWeek, topN, chartType])

  const supplierQtyOption = useMemo(() => buildOption(`Supplier Terbanyak (Jumlah Terjual) — ${selectedWeek?.label}`, metrics.topSuppliersByQty.map(i => ({ label: i.label, value: i.qty }))), [metrics, selectedWeek, topN, chartType])
  const supplierRevenueOption = useMemo(() => buildOption(`Supplier Teratas (Pendapatan) — ${selectedWeek?.label}`, metrics.topSuppliersByRevenue.map(i => ({ label: i.label, value: i.revenue }))), [metrics, selectedWeek, topN, chartType])
  const supplierProfitOption = useMemo(() => buildOption(`Supplier Teratas (Keuntungan) — ${selectedWeek?.label}`, metrics.topSuppliersByProfit.map(i => ({ label: i.label, value: i.profit }))), [metrics, selectedWeek, topN, chartType])

  return (
    <div className="container-fluid mt-4 px-1 px-sm-3 px-md-5">
      <Row className="mb-3 align-items-center">
        <Col xs="12" md="6">
          <h4>Bazaar Charts</h4>
          <div className="text-muted small">Pilih minggu atau lihat gabungan semua minggu</div>
        </Col>
        <Col xs="12" md="6" className="text-end mt-2 mt-md-0">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ minWidth: 220 }}>
              <Select
                options={optionsWeek}
                value={selectedWeek}
                onChange={setSelectedWeek}
                isSearchable
                placeholder="Pilih minggu..."
              />
            </div>

            <Input type="number" value={topN} onChange={e => setTopN(Math.max(1, Number(e.target.value || 5)))} style={{ width: 80 }} />

            <Button color={viewMode === 'charts' ? 'primary' : 'secondary'} onClick={() => setViewMode('charts')}>📊 Chart</Button>
            <Button color={viewMode === 'toplist' ? 'primary' : 'secondary'} onClick={() => setViewMode('toplist')}>📋 List</Button>

            <Button color="danger" onClick={() => {
              setSelectedWeek(optionsWeek[0])
              setTopN(10)
              setChartType('bar')
              setViewMode('charts')
              setActiveTab('items')
            }}>Reset</Button>
            <Button color="warning" onClick={() => window.history.back()}>
              Kembali
            </Button>
          </div>
        </Col>
      </Row>

      <Nav tabs className="mb-3">
        <NavItem>
          <NavLink active={activeTab === 'items'} onClick={() => setActiveTab('items')} style={{ cursor: 'pointer' }}>
            📦 Produk
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} style={{ cursor: 'pointer' }}>
            👥 Customer
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} style={{ cursor: 'pointer' }}>
            🏪 Supplier
          </NavLink>
        </NavItem>
      </Nav>

      {viewMode === 'charts' && (
        <>
          {activeTab === 'items' && (
            <>
              <Row>
                <Col md={12}><ReactECharts option={itemQtyOption} style={{ height: 420 }} /></Col>
              </Row>
              <Row className="mt-2">
                <Col md={12}><ReactECharts option={itemRevenueOption} style={{ height: 420 }} /></Col>
              </Row>
              <Row className="mt-2">
                <Col md={12}><ReactECharts option={itemProfitOption} style={{ height: 420 }} /></Col>
              </Row>
            </>
          )}

          {activeTab === 'customers' && (
            <>
              <Row>
                <Col md={12}><ReactECharts option={customerQtyOption} style={{ height: 420 }} /></Col>
              </Row>
              <Row className="mt-2">
                <Col md={12}><ReactECharts option={customerSpendOption} style={{ height: 420 }} /></Col>
              </Row>
            </>
          )}

          {activeTab === 'suppliers' && (
            <>
              <Row>
                <Col md={12}><ReactECharts option={supplierQtyOption} style={{ height: 420 }} /></Col>
              </Row>
              <Row className="mt-2">
                <Col md={12}><ReactECharts option={supplierRevenueOption} style={{ height: 420 }} /></Col>
              </Row>
              <Row className="mt-2">
                <Col md={12}><ReactECharts option={supplierProfitOption} style={{ height: 420 }} /></Col>
              </Row>
            </>
          )}
        </>
      )}

      {viewMode === 'toplist' && (
        <>
          {activeTab === 'items' && (
            <Row>
              <Col md={6}><TopList title="Produk — Jumlah Terjual" data={metrics.topItemsByQty.slice(0, topN).map(i => ({ label: i.label, value: formatNumber(i.qty) }))} /></Col>
              <Col md={6}><TopList title="Produk — Pendapatan" data={metrics.topItemsByRevenue.slice(0, topN).map(i => ({ label: i.label, value: formatCurrency(i.revenue) }))} /></Col>
              <Col md={6}><TopList title="Produk — Keuntungan" data={metrics.topItemsByProfit.slice(0, topN).map(i => ({ label: i.label, value: formatCurrency(i.profit) }))} /></Col>
            </Row>
          )}

          {activeTab === 'customers' && (
            <Row>
              <Col md={6}><TopList title="Customer — Jumlah Membeli" data={metrics.topCustomersByQty.slice(0, topN).map(i => ({ label: i.label, value: formatNumber(i.qty) }))} /></Col>
              <Col md={6}><TopList title="Customer — Pengeluaran" data={metrics.topCustomersBySpend.slice(0, topN).map(i => ({ label: i.label, value: formatCurrency(i.spend) }))} /></Col>
            </Row>
          )}

          {activeTab === 'suppliers' && (
            <Row>
              <Col md={6}><TopList title="Supplier — Jumlah Terjual" data={metrics.topSuppliersByQty.slice(0, topN).map(i => ({ label: i.label, value: formatNumber(i.qty) }))} /></Col>
              <Col md={6}><TopList title="Supplier — Pendapatan" data={metrics.topSuppliersByRevenue.slice(0, topN).map(i => ({ label: i.label, value: formatCurrency(i.revenue) }))} /></Col>
              <Col md={6}><TopList title="Supplier — Keuntungan" data={metrics.topSuppliersByProfit.slice(0, topN).map(i => ({ label: i.label, value: formatCurrency(i.profit) }))} /></Col>
            </Row>
          )}
        </>
      )}
    </div>
  )
}

export default BazaarCharts
