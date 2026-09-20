import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Upload from './pages/Upload'
import Show from './pages/Show'
import Admin from './pages/Admin'
import './styles.css'
import { logInfo } from './logger'

function RouteLogger(){
  const location = useLocation()

  React.useEffect(() => {
    logInfo('router', 'Route changed', {
      path: location.pathname,
      search: location.search,
    })
  }, [location.pathname, location.search])

  return null
}

function App(){
  return (
    <BrowserRouter>
      <RouteLogger />
      <Routes>
        <Route path="/" element={<Navigate to="/show" replace />} />
        <Route path="/show" element={<Show/>} />
        <Route path="/upload" element={<Upload/>} />
        <Route path="/admin" element={<Admin/>} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
