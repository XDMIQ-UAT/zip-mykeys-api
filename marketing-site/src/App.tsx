import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Docs from './pages/Docs'
import Tools from './pages/Tools'
import GenerateToken from './pages/GenerateToken'
import Layout from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/generate-token" element={<GenerateToken />} />
        <Route path="/generate-token.html" element={<GenerateToken />} />
      </Routes>
    </Layout>
  )
}

export default App


