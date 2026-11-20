import { parentPort, workerData } from 'node:worker_threads'
import { Entry } from '@napi-rs/keyring'
import type { KeyringRequest } from './keyring.js'

const { op, service, account, value } = workerData as KeyringRequest
try {
  const entry = new Entry(service, account, { linux: { store: 'secret-service' } })
  let result: unknown
  if (op === 'getPassword') result = entry.getPassword()
  else if (op === 'getSecret') result = entry.getSecret()
  else if (op === 'setPassword') entry.setPassword(value as string)
  else entry.setSecret(value as Uint8Array)
  parentPort!.postMessage({ ok: true, result })
} catch {
  parentPort!.postMessage({ ok: false })
}
