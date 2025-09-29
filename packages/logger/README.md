# @inpageedit/logger

Flexible, Extensible Console Logger with Colored Labels and Hierarchical Loggers.

Features:

- Level control (debug < log < info < warn < error < silent)
- Custom dynamic levels
- Hierarchical grouping: `logger('sub')`
- Deterministic color assignment for names & groups
- Styled name badge & group labels

## Usage

```ts
import { createLogger, Logger, LoggerLevel } from '@inpageedit/logger'

const logger = createLogger({ name: 'MyApp', level: LoggerLevel.debug })
// Or
const logger = new Logger({ name: 'MyApp', level: LoggerLevel.debug })

// normal usage
logger.info('Application started')

// create sub-logger group
const apiLogger = logger.group('API', { color: '#f59e0b' })
apiLogger.warn('Deprecated API endpoint used')
// or one-liner
logger('API').error('This is a error from API')

// define custom level
declare module '@inpageedit/logger' {
  interface Logger {
    success: (...args: any[]) => void
  }
}
logger.defineLevel('success', { level: LoggerLevel.info, label: '✅', method: 'info' })
logger.success('User created successfully')
```

---

> MIT License
>
> Copyright (c) 2025 dragon-fish
