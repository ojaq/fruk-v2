import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Label, Form, FormGroup, FormFeedback, Card, CardBody, CardTitle, Container, Row, Col } from 'reactstrap'
import Swal from 'sweetalert2'

const Login = () => {
  const { login, userList } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!name.trim()) {
        setError('Nama wajib diisi')
        return
      }

      login(name.trim())
      Swal.fire('Berhasil', 'Login berhasil!', 'success')
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
      Swal.fire('Error', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Row>
        <Col>
          <div className="d-flex justify-content-center">
            <img 
              src="./logo.jpeg" 
              alt="logo"
              style={{ height: '200px', width: 'auto', marginBottom: '-30px' }}
            />
          </div>
          <h5 className="text-center mb-3">Mohon cek nama supplier <br/> terlebih dahulu sebelum mendaftar!</h5>
          <Card style={{ minWidth: 350 }}>
            <CardBody>
              <CardTitle tag="h3" className="mb-4 text-center">Login</CardTitle>
              <Form onSubmit={handleLogin}>
                <FormGroup>
                  <Label>Nama</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    invalid={!!error}
                    placeholder="Masukkan nama"
                    list="name-suggestions"
                    disabled={loading}
                  />
                  <datalist id="name-suggestions">
                    {userList
                      .filter(user => !['supplier', 'admin', 'superadmin'].includes(user.name.toLowerCase()))
                      .map((user, i) => (
                        <option key={i} value={user.name} />
                      ))}
                  </datalist>
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
  )
}

export default Login