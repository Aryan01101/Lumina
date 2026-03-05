declare module 'sqlite-vec' {
  import type Database from 'better-sqlite3'
  export function load(db: Database.Database): void
  export const version: string
}
