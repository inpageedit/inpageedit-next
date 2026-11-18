export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
  }
}

export function loginRequired(name: string) {
  const command = `ipe login --profile ${name} --web`
  return new CliError('login_required', `Ask the user to run ${command}.`, { command })
}
