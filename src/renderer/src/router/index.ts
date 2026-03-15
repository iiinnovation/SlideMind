import { createRouter, createMemoryHistory } from 'vue-router'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: () => import('../views/EditorView.vue')
    }
  ]
})

export default router
