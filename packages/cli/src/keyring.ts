import { Worker } from 'node:worker_threads'
import { CliError } from './errors.js'

const NOTICE_MS = 3_000
const TIMEOUT_MS = 60_000

export interface KeyringRequest {
  op: 'getPassword' | 'getSecret' | 'setPassword' | 'setSecret'
  service: string
  account: string
  value?: string | Uint8Array
}

let notify = () => {}

/** Called when the credential store is slow, which on macOS means an access prompt is open. */
export function onCredentialWait(callback: () => void) {
  notify = callback
}

/**
 * Runs one credential store call off the main thread. The call blocks while the OS shows an
 * access prompt (macOS asks again whenever a different binary reads an item), and a blocked
 * main thread could neither tell the caller nor give up.
 */
export function keyring(request: KeyringRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./keyring-worker.js', import.meta.url), {
      workerData: request,
    })
    const notice = setTimeout(() => notify(), NOTICE_MS)
    const timeout = setTimeout(() => {
      finish()
      reject(
        new CliError(
          'credential_store_timeout',
          'The system credential store did not respond. Approve its access prompt on this computer, then run the command again.'
        )
      )
    }, TIMEOUT_MS)
    function finish() {
      clearTimeout(notice)
      clearTimeout(timeout)
      // A worker stuck in the native call cannot be stopped. Detach it so the process can exit.
      worker.unref()
      worker.terminate()
    }
    worker.once('message', ({ ok, result }: { ok: boolean; result?: unknown }) => {
      finish()
      if (ok) resolve(result)
      else reject(new Error('credential store call failed'))
    })
    worker.once('error', (error) => {
      finish()
      reject(error)
    })
  })
}
