export const HOST = (import.meta.env.VITE_SPACETIMEDB_HOST as string) ?? 'ws://localhost:3000'
export const DB_NAME = (import.meta.env.VITE_SPACETIMEDB_DB_NAME as string) ?? 'react-ts'
export const IDENTITY_KEY = `${HOST}/${DB_NAME}/identity`
