import { install } from '@/index'
import { createApp } from 'vue'
import App from './App.vue'

install()

const root = document.getElementById('app')!

const app = createApp(App)

app.mount(root)
