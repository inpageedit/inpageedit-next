/**
 * Core features entry point
 */

// expose all classes
export * from './InPageEdit.js'
export { default as BasePlugin } from './plugins/BasePlugin.js'
export { Endpoints } from './constants/endpoints.js'
export { RegisterPreferences } from './decorators/Preferences.js'

// expose all types
export type * from './components/index.js'
export type * from './models/index.js'
export type * from './plugins/index.js'
export type * from './services/index.js'
export type * from './types/index.js'
