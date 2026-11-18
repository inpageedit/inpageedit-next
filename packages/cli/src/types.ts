import type { MwApi } from 'wiki-saikou'

export interface Profile {
  name: string
  api: string
  loginName: string
  username: string
  userId: number
}

export interface Identity {
  username: string
  userId: number
}

export interface Session {
  wiki: MwApi
  /** `assert` and `assertuser` for profile sessions, empty for anonymous reads. */
  assert: Record<string, string>
  identity?: Identity
}

/** Parsed command-line options; see the option table in cli.ts. */
export interface Values {
  profile?: string
  json?: boolean
  help?: boolean
  version?: boolean
  api?: string
  'login-name'?: string
  web?: boolean
  limit?: string
  file?: string
  out?: string
  html?: string
  section?: string
  'base-revid'?: string
  summary?: string
  method?: string
  query?: string[]
  form?: string[]
  body?: string
  token?: string
  filename?: string
  'description-file'?: string
  'ignore-warnings'?: boolean
  reason?: string
  'move-talk'?: boolean
  'no-redirect'?: boolean
}
