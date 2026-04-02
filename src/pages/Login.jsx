import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Button,
  Input,
  Label,
  Form,
  FormGroup,
  FormFeedback,
  Card,
  CardBody,
  CardTitle,
  Container,
  Row,
  Col
} from 'reactstrap'
import Swal from 'sweetalert2'

const Login = () => {
  const { login, users } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const trimmed = name.trim()

      if (!trimmed) {
        setError('Nama wajib diisi')
        return
      }

      login(trimmed)
      Swal.fire('Berhasil', 'Login berhasil!', 'success')
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login gagal')
      Swal.fire('Error', err.message || 'Login gagal', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users
  .filter(u => u.role !== 'dev')
  .filter(u =>
    u.name.toLowerCase().includes(name.toLowerCase())
  )

  return (
    <div className="auth-page">
      <Container>
        <Row className="justify-content-center">
          <Col md="10" lg="8" xl="6">
            <div className="d-flex justify-content-center mb-2">
              <img
                src="./logo.jpeg"
                alt="logo"
                style={{ height: '200px' }}
              />
            </div>

            <h6 className="text-center mb-2">
              Mohon cek nama supplier <br />
              terlebih dahulu sebelum mendaftar
            </h6>

            <Card>
              <CardBody>
                <CardTitle tag="h3" className="mb-4 text-center">
                  Login
                </CardTitle>
                <Form onSubmit={handleLogin}>
                  <FormGroup>
                    <Label>Nama Supplier</Label>
                    <div style={{ position: 'relative' }}>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setShowSuggestions(true)
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      invalid={!!error}
                      placeholder="Masukkan nama supplier"
                      disabled={loading}
                    />

                    {showSuggestions && name && filteredUsers.length > 0 && (
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
                        {filteredUsers.map(u => (
                          <div
                            key={u.id}
                            style={{
                              padding: '8px',
                              cursor: 'pointer'
                            }}
                            onMouseDown={() => {
                              setName(u.name)
                              setShowSuggestions(false)
                            }}
                          >
                            {u.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {error && <FormFeedback>{error}</FormFeedback>}
                  </div>
                    {error && <FormFeedback>{error}</FormFeedback>}
                  </FormGroup>
                  <Button color="primary" type="submit" block disabled={loading}>
                    {loading ? 'Loading...' : 'Masuk'}
                  </Button>
                </Form>
                <div className="text-center mt-3">
                  Belum punya akun? <Link to="/register">Daftar di sini</Link>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default Login