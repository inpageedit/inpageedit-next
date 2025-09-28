import { install, SchemaForm } from '@/index'
import { h } from 'jsx-dom'
import Schema from 'schemastery'
import { createApp } from 'vue'
import App from './App.vue'

install()

const root = document.getElementById('app')!

const app = createApp(App)

app.mount(root)
