declare type MwApiResponse<Data = any> = {
  batchcomplete?: string
  continue?: Record<string, any>
  error?: MwApiError
  errors?: MwApiError[]
  warnings?: Record<string, { warnings: string }>
} & Data

declare interface MwApiError {
  code: string
  info: string
  docref?: string
}

declare interface MwQueryApiResponse<T = any> extends MwApiResponse<{ query: T }> {}
