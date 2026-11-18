export class CliError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function loginRequired(name) {
  const command = `ipe login --profile ${name} --web`
  return new CliError('login_required', `Ask the user to run ${command}.`, { command })
}
