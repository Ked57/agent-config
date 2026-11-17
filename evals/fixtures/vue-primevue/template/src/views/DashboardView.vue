<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import StatCard from '@/components/StatCard.vue'
import { useOrdersStore } from '@/stores/orders'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Order, OrderStatus } from '@/types'

const ordersStore = useOrdersStore()
const { orders, loading, revenue, pendingCount } = storeToRefs(ordersStore)

const severity: Record<OrderStatus, 'success' | 'warn' | 'info' | 'danger'> = {
  paid: 'success',
  pending: 'warn',
  shipped: 'info',
  refunded: 'danger',
}

function removeOrder(order: Order) {
  void ordersStore.remove(order.id)
}

onMounted(() => {
  void ordersStore.load()
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">Dashboard</h1>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="Revenue" :value="formatCurrency(revenue)" icon="pi pi-dollar" />
      <StatCard label="Orders" :value="String(orders.length)" icon="pi pi-shopping-cart" />
      <StatCard label="Pending" :value="String(pendingCount)" icon="pi pi-clock" />
    </div>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <h2 class="mb-3 text-lg font-semibold">Recent orders</h2>
      <DataTable :value="orders" :loading="loading" data-key="id" striped-rows>
        <Column field="id" header="Order" />
        <Column field="customer" header="Customer" />
        <Column field="total" header="Total">
          <template #body="{ data }">{{ formatCurrency(data.total) }}</template>
        </Column>
        <Column field="status" header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="severity[data.status as OrderStatus]" />
          </template>
        </Column>
        <Column field="createdAt" header="Created">
          <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
        </Column>
        <Column header="" class="w-16">
          <template #body="{ data }">
            <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="`Delete ${data.id}`" @click="removeOrder(data)" />
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>
