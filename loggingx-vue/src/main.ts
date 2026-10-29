import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'                 // Store
import { initRouter } from './router'               // Router
import language from './locales'                    // 国际化
import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
import '@utils/sys/console.ts'                      // 控制台输出内容
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'

// 空的 touchstart 监听用于在 iOS Safari 上启用 :active 样式。
// 必须是 passive: true，否则浏览器每次触摸都要等 JS 判断是否 preventDefault，会造成滚动卡顿。
document.addEventListener('touchstart', () => {}, { passive: true })

const app = createApp(App)
initStore(app)
initRouter(app)
setupGlobDirectives(app)
setupErrorHandle(app)

app.use(language)
app.mount('#app')