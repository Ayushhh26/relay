const KEY = (roomId: string | bigint) => `relay:membership:${roomId}`

export interface RoomMembership {
  displayName: string
  role: string
}

export function saveRoomMembership(roomId: string | bigint, m: RoomMembership) {
  sessionStorage.setItem(KEY(roomId), JSON.stringify(m))
}

export function loadRoomMembership(roomId: string | bigint): RoomMembership | null {
  try {
    const raw = sessionStorage.getItem(KEY(roomId))
    return raw ? (JSON.parse(raw) as RoomMembership) : null
  } catch {
    return null
  }
}

export function clearRoomMembership(roomId: string | bigint) {
  sessionStorage.removeItem(KEY(roomId))
}
