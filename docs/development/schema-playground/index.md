<script setup lang="ts">
import { schema, value, SchemaForm } from './index.parts'

const onGetValue = () => {
  console.log('Current Value:', schema.value(value.value))
}
</script>

# Schema 游乐园

<SchemaForm :schema="schema" v-model:value="value"></SchemaForm>

<button @click="onGetValue">打印当前值</button>

<pre>{{ value }}</pre>
