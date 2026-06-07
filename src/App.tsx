import { Routes, Route, Navigate } from 'react-router-dom'
import { Lobby } from './Lobby'
import { Join } from './Join'
import { RoomView } from './RoomView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/join/:roomId" element={<Join />} />
      <Route path="/room/:roomId" element={<RoomView />} />
      {/* OIDC redirect handler — AuthProvider processes the code exchange on mount */}
      <Route path="/callback" element={<div data-testid="auth-callback" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
