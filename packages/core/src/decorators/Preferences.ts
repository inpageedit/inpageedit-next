import type Schema from 'schemastery'

type AnyConstructor<T = any> = new (...args: any[]) => T

export type PreferenceAugmented<C extends AnyConstructor, D extends Record<string, any>> = C & {
  PreferencesSchema: Schema<D>
  PreferencesDefaults: D
}

/**
 * Decorator for registering preferences
 *
 * ```ts
 * @RegisterPreferences(
 *   Schema.object({
 *     foo: Schema.string().description('Foo description'),
 *   }),
 *   {
 *     foo: 'default foo value',
 *   }
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
 *    static ConfigDefaults = {
 *      foo: 'default foo value'
 *    }
 * }
 * ```
 */
export function RegisterPreferences<D extends Record<string, any>>(
  schema: Schema<D>,
  defaults?: D
) {
  return function <T extends AnyConstructor>(target: T): PreferenceAugmented<T, D> {
    ;(target as any).PreferencesSchema = schema
    ;(target as any).PreferencesDefaults = defaults
    return target as PreferenceAugmented<T, D>
  }
}
