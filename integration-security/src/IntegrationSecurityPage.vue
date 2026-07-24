<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useIntegrationSecurityRuntime } from './runtime'

const runtime = useIntegrationSecurityRuntime()
const activeMachines = computed(() => runtime.state.machines.filter(item => item.status === 'active').length)
const activeWebhooks = computed(() => runtime.state.webhooks.filter(item => item.status === 'active').length)
onMounted(runtime.load)
</script>

<template>
  <main class="integration-security-page">
    <header class="page-header">
      <div><h1>Integration security</h1><p>Machine credentials, outbound endpoints, and signed-in devices</p></div>
      <el-button :loading="runtime.state.loading" @click="runtime.load">Refresh</el-button>
    </header>
    <el-alert v-if="runtime.state.error" type="error" :title="runtime.state.error.message" show-icon :closable="false" />
    <section class="summary" aria-label="Security summary">
      <div><strong>{{ activeMachines }}</strong><span>Active machines</span></div>
      <div><strong>{{ activeWebhooks }}</strong><span>Active webhooks</span></div>
      <div><strong>{{ runtime.state.sessions.length }}</strong><span>Signed-in devices</span></div>
    </section>
    <section>
      <h2>Machine identities</h2>
      <el-table :data="runtime.state.machines" empty-text="No machine identities">
        <el-table-column prop="name" label="Name" min-width="180" /><el-table-column prop="status" label="Status" width="120" />
        <el-table-column label="Token" min-width="180"><template #default="{ row }">{{ row.tokenPrefix }}...{{ row.tokenLastFour }}</template></el-table-column>
        <el-table-column label="Scopes" min-width="240"><template #default="{ row }">{{ row.scopes.join(', ') }}</template></el-table-column>
      </el-table>
    </section>
    <section>
      <h2>Webhook endpoints</h2>
      <el-table :data="runtime.state.webhooks" empty-text="No webhook endpoints">
        <el-table-column prop="name" label="Name" min-width="160" /><el-table-column prop="url" label="HTTPS destination" min-width="280" show-overflow-tooltip />
        <el-table-column prop="status" label="Status" width="120" /><el-table-column label="Events" min-width="220"><template #default="{ row }">{{ row.events.join(', ') }}</template></el-table-column>
      </el-table>
    </section>
    <section>
      <h2>Signed-in devices</h2>
      <el-table :data="runtime.state.sessions" empty-text="No sessions">
        <el-table-column label="Device" min-width="180"><template #default="{ row }">{{ row.clientKey }}<span v-if="row.current"> (current)</span></template></el-table-column>
        <el-table-column prop="maskedIp" label="Network" min-width="140" /><el-table-column prop="lastSeenAt" label="Last seen" min-width="190" />
        <el-table-column label="" width="112" align="right"><template #default="{ row }"><el-button text :disabled="row.status !== 'active' || runtime.state.mutating" @click="runtime.revokeSession(row)">Revoke</el-button></template></el-table-column>
      </el-table>
    </section>
  </main>
</template>

<style scoped>
.integration-security-page{display:grid;gap:24px;max-width:1280px;margin:0 auto;padding:24px}.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.page-header h1{margin:0;font-size:24px}.page-header p{margin:6px 0 0;color:var(--el-text-color-secondary)}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--el-border-color);border-radius:6px}.summary div{display:grid;gap:4px;padding:16px;border-right:1px solid var(--el-border-color)}.summary div:last-child{border-right:0}.summary strong{font-size:20px}.summary span{color:var(--el-text-color-secondary)}section h2{font-size:16px;margin:0 0 12px}@media(max-width:720px){.integration-security-page{padding:16px}.summary{grid-template-columns:1fr}.summary div{border-right:0;border-bottom:1px solid var(--el-border-color)}.summary div:last-child{border-bottom:0}}
</style>
