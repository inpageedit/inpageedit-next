import type Schema from 'schemastery'

type AnyConstructor<T = any> = new (...args: any[]) => T

export type PreferenceAugmented<D, C extends AnyConstructor> = C & {
  PreferencesSchema: Schema<D>
}

/**
 * Decorator for registering preferences
 *
 * ```ts
 * @RegisterPreferences(
 *   Schema.object({
 *     foo: Schema.string().description('Foo description'),
 *   })
 * )
 * class Foo {}
 * ```
 *
 * same as:
 *
 * ```ts
 * class Foo {
 *    static ConfigSchema = Schema.object({
 *      foo: Schema.string().description('Foo description')
 *    })
 * }
 * ```
 */
export function RegisterPreferences<D extends Record<string, any>>(schema: Schema<D>) {
  return function <T extends AnyConstructor>(target: T): PreferenceAugmented<D, T> {
    ;(target as any).PreferencesSchema = schema
    return target as PreferenceAugmented<D, T>
  }
}
