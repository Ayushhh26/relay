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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
