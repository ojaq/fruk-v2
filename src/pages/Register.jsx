import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Button,
  Input,
  Label,
  FormGroup,
  Form,
  FormFeedback,
  Card,
  CardBody,
  CardTitle,
  Container,
  Row,
  Col
} from 'reactstrap'

const Register = () => {
  const { register, users } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const trimmed = name.trim()

      if (!trimmed) {
        setError('Nama wajib diisi')
        return
      }

      const exists = users.some(
        u => u.name.toLowerCase() === trimmed.toLowerCase()
      )

      if (exists) {
        setError('Nama sudah digunakan')
        return
      }

      await register(trimmed)
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Gagal mendaftar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Container>
        <Row className="justify-content-center">
          <Col md="10" lg="8" xl="6">
            <div className="d-flex justify-content-center mb-3">
              <img
                src="./logo.jpg"
                alt="logo"
                style={{ height: '300px' }}
              />
            </div>
            <Card>
              <CardBody>
                <CardTitle tag="h3" className="mb-4 text-center">
                  Register
                </CardTitle>
                <Form onSubmit={handleRegister}>
                  <FormGroup>
                    <Label>Nama Supplier</Label>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setError(null)
                      }}
                      invalid={!!error}
                      placeholder="Nama supplier"
                      disabled={loading}
                    />
                    {error && <FormFeedback>{error}</FormFeedback>}
                  </FormGroup>
                  <Button color="primary" type="submit" block disabled={loading}>
                    {loading ? 'Loading...' : 'Daftar'}
                  </Button>
                </Form>
                <div className="text-center mt-3">
                  Sudah punya akun? <Link to="/login">Masuk di sini</Link>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default Register