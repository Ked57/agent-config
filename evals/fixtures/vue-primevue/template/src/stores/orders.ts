import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deleteOrder, fetchOrders } from '@/services/api'
import type { Order } from '@/types'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)

  const revenue = computed(() =>
    orders.value.filter((order) => order.status !== 'refunded').reduce((sum, order) => sum + order.total, 0),
  )
  const pendingCount = computed(() => orders.value.filter((order) => order.status === 'pending').length)

  async function load() {
    loading.value = true
    try {
      orders.value = await fetchOrders()
    } finally {
      loading.value = false
    }
  }

  async function remove(id: string) {
    await deleteOrder(id)
    orders.value = orders.value.filter((order) => order.id !== id)
  }

  return { orders, loading, revenue, pendingCount, load, remove }
})
