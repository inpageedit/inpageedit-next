<template lang="pug">
#demo-app
  h1 Schemastery Form Vue Demo
  SchemasteryFormVue(:schema='schema', v-model:value='value')
  button(@click='onGetValue') Get Value
  pre {{ value }}
</template>

<script setup lang="ts">
import SchemasteryFormVue from '@/vue'
import Schema from 'schemastery'
import { ref } from 'vue'

interface TestSchema {
  string: string
  number: number
  boolean: boolean
  date: Date
  enum: 'option1' | 'option2' | 'option3'
  tuple: [string, number, boolean]
  array: string[]
  dict: Record<string, string>
  deep: {
    nested: Pick<TestSchema, 'string' | 'number' | 'array'>
  }
}

const schema = ref(
  new Schema<TestSchema>(
    Schema.object({
      string: Schema.string().description('Test String').default('Hello, World!'),
      number: Schema.number().description('Test Number').default(42),
      boolean: Schema.boolean().description('Test Boolean').default(true),
      date: Schema.date().description('Test Date').default(new Date()),
      enum: Schema.union(['option1', 'option2', 'option3'])
        .description('Test Enum')
        .default('option1'),
      tuple: Schema.tuple([String, Number, Boolean]).description('Test Tuple') as any,
      array: Schema.array(String)
        .description('Nested Array of Strings')
        .default(['one', 'two', 'three']),
      dict: Schema.dict(String),
      deep: Schema.object({
        nested: Schema.object({
          string: Schema.string().default('Nested String'),
          number: Schema.number().default(99),
          array: Schema.array(String).default(['nested', 'array']),
        }).description('Nested Object'),
      }),
    }).description('Root Object')
  )
)

const value = ref<TestSchema>({
  string: 'Initial String',
  number: 100,
  boolean: false,
  date: new Date('2000-10-05'),
  enum: 'option2',
  tuple: ['initial', 1, true],
  array: ['initial', 'array'],
  dict: { key1: 'value1', key2: 'value2' },
  deep: {
    nested: {
      string: 'Deep Nested String',
      number: 123,
      array: ['deep', 'nested', 'array'],
    },
  },
})

const onGetValue = () => {
  console.log('Current Value:', value.value)
}
</script>

<style scoped lang="scss"></style>
