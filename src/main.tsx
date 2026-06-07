import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings/index.ts';
import './index.css';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;

const connectionBuilder = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .withToken(localStorage.getItem(TOKEN_KEY) || undefined)
  .onConnect((_conn, _identity, token) => { localStorage.setItem(TOKEN_KEY, token); })
  .onDisconnect(() => {})
  .onConnectError(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  </StrictMode>
);
