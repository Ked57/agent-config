import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard' } },
    { path: '/projects', name: 'projects', component: () => import('@/views/ProjectsView.vue'), meta: { title: 'Projects' } },
    { path: '/users', name: 'users', component: () => import('@/views/UsersView.vue'), meta: { title: 'Users' } },
    { path: '/users/:id', name: 'user', component: () => import('@/views/UserDetailView.vue'), props: true, meta: { title: 'User' } },
    { path: '/gallery', name: 'gallery', component: () => import('@/views/GalleryView.vue'), meta: { title: 'Gallery' } },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: 'Settings' } },
    { path: '/help', name: 'help', component: () => import('@/views/FaqView.vue'), meta: { title: 'Help' } },
  ],
})
