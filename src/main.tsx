import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings/index.ts';
import { HOST, DB_NAME, IDENTITY_KEY } from './config';
import App from './App.tsx';
import './index.css';

const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

const oidcConfig = {
  authority: (import.meta.env.VITE_OIDC_AUTHORITY as string) ?? 'https://auth.spacetimedb.com/oidc',
  client_id: (import.meta.env.VITE_OIDC_CLIENT_ID as string) ?? '',
  redirect_uri: `${window.location.origin}/callback`,
  scope: 'openid profile email',
  response_type: 'code',
  automaticSilentRenew: true,
};

// Used in the auth-enabled path — must be inside AuthProvider to call useAuth
function AuthedConnector() {
  const auth = useAuth();
  const token = auth.user?.id_token;

  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .withToken(token)
        .onConnect((_conn, identity) => {
          sessionStorage.setItem(IDENTITY_KEY, identity.toHexString());
        })
        .onDisconnect(() => {})
        .onConnectError(() => {}),
    [token]
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  );
}

// Used in the anonymous path (dev / CI)
function AnonConnector() {
  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .withToken(localStorage.getItem(TOKEN_KEY) || undefined)
        .onConnect((_conn, identity, token) => {
          localStorage.setItem(TOKEN_KEY, token);
          sessionStorage.setItem(IDENTITY_KEY, identity.toHexString());
        })
        .onDisconnect(() => {})
        .onConnectError(() => {}),
    []
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  );
}

import { AuthGate } from './AuthGate.tsx';

function Root() {
  if (AUTH_ENABLED) {
    return (
      <StrictMode>
        <BrowserRouter>
          <AuthProvider {...oidcConfig}>
            <AuthGate>
              <AuthedConnector />
            </AuthGate>
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <BrowserRouter>
        <AnonConnector />
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
