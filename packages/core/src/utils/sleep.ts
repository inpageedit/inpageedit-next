export const sleep = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms))
