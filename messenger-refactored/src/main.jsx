import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ResetPassword from './ResetPassword'
import { API_BASE_URL } from './config'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/reset-password" element={<ResetPassword apiBaseUrl={API_BASE_URL} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)