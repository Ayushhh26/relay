import { tables, reducers } from './module_bindings';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';

const params = new URLSearchParams(window.location.search);
export const ROOM_ID = BigInt(params.get('room') ?? '1');
export const ROLE = params.get('role') ?? 'observer';
export const NAME = params.get('name') ?? ROLE;
export const POLICY = params.get('policy') ?? 'open';

function App() {
  const { isActive } = useSpacetimeDB();
  const createRoom = useReducer(reducers.createRoom);

  const [rooms, roomsReady] = useTable(tables.room);

  // Seed the default room as soon as we're connected and have no rooms
  if (isActive && roomsReady && rooms.length === 0) {
    createRoom({ title: 'Interview Room' });
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: '0 0 8px' }}>Relay</h1>

      <div style={{ marginBottom: '16px' }}>
        <span
          data-testid="connection-status"
          style={{ color: isActive ? '#4ade80' : '#f87171' }}
        >
          {isActive ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      <button
        onClick={() => createRoom({ title: 'Interview Room' })}
        disabled={!isActive}
        style={{ padding: '6px 14px', marginBottom: '16px' }}
      >
        Create Room
      </button>

      <ul data-testid="room-list" style={{ listStyle: 'none', padding: 0 }}>
        {rooms.map(r => (
          <li key={String(r.id)} style={{ padding: '4px 0' }}>
            {r.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
