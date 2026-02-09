import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { Table, Button, Collapse, Card, CardBody, Alert } from 'reactstrap'
import { useNavigate } from 'react-router-dom'

const WeekLogs = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') return
    const fetchLogs = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('week_logs')
        .select('*')
        .order('timestamp', { ascending: false })
      if (!error) setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [user])

  if (user?.role !== 'admin') {
    return <Alert color="danger" className="mt-5">Akses hanya untuk admin.</Alert>
  }

  return (
    <div className="container mt-4">
      <h3>Log Minggu</h3>
      <Button color="warning" className="mb-3" onClick={() => navigate('/dashboard')}>Kembali ke Dashboard</Button>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <Table bordered responsive hover>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>User</th>
              <th>Aksi</th>
              <th>Target</th>
              <th>ID Target</th>
              <th>Deskripsi</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <React.Fragment key={log.id}>
                <tr>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.user_name}</td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                  <td>{log.target_id}</td>
                  <td>{log.description}</td>
                  <td>
                    <Button
                      color="info"
                      size="sm"
                      onClick={() => setExpanded(e => ({ ...e, [log.id]: !e[log.id] }))}
                    >
                      {expanded[log.id] ? 'Sembunyikan' : 'Lihat'}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td colSpan={7} style={{ padding: 0, border: 0 }}>
                    <Collapse isOpen={!!expanded[log.id]}>
                      <Card className="mb-2">
                        <CardBody>
                          <div style={{ fontSize: 13 }}>
                            <strong>Data Sebelum:</strong>
                            <pre style={{ background: '#f8f9fa', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                              {log.data_before ? JSON.stringify(JSON.parse(log.data_before), null, 2) : '-'}
                            </pre>
                            <strong>Data Sesudah:</strong>
                            <pre style={{ background: '#f8f9fa', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                              {log.data_after ? JSON.stringify(JSON.parse(log.data_after), null, 2) : '-'}
                            </pre>
                          </div>
                        </CardBody>
                      </Card>
                    </Collapse>
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

export default WeekLogs