import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'virtual:uno.css'
import '@quizv/theme-default/styles/vars.css'
import '@quizv/ui/styles/base.css'

createApp(App).use(createPinia()).mount('#app')
