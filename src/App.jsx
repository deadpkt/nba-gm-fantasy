import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LeaderboardPage from './pages/LeaderboardPage'
import LoginPage from './pages/LoginPage'
import MyTeamPage from './pages/MyTeamPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import SignUpPage from './pages/SignUpPage'
import SimulationPage from './pages/SimulationPage'
import './App.css'

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>
function App() { return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignUpPage />} /><Route path="/" element={protectedPage(<HomePage />)} /><Route path="/my-team" element={protectedPage(<MyTeamPage />)} /><Route path="/simulation" element={protectedPage(<SimulationPage />)} /><Route path="/leaderboard" element={protectedPage(<LeaderboardPage />)} /><Route path="/profile" element={protectedPage(<ProfilePage />)} /><Route path="*" element={<NotFoundPage />} /></Routes> }
export default App
