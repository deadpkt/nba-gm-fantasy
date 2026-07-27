import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TeamProvider } from './context/TeamContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><AuthProvider><TeamProvider><App /></TeamProvider></AuthProvider></BrowserRouter></StrictMode>)
