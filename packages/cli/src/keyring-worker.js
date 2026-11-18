import { parentPort, workerData } from 'node:worker_threads'
import { Entry } from '@napi-rs/keyring'

const { op, service, account, value } = workerData
try {
  const entry = new Entry(service, account, { linux: { store: 'secret-service' } })
  parentPort.postMessage({ ok: true, result: entry[op](...(value === undefined ? [] : [value])) })
} catch {
  parentPort.postMessage({ ok: false })
}
