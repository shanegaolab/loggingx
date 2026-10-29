<!-- AI 诊断设置：模型与通知，以及每个日志库的代码仓库和触发方式 -->
<template>
  <div class="settings">
    <section v-loading="loadingSettings" class="card">
      <header class="card__head">
        <div>
          <div class="card__title">AI 模型与通知</div>
          <span class="muted">分析时把错误日志和相关代码发给所选的模型</span>
        </div>
      </header>
      <ElAlert
        v-if="settings && !settings.providers.length"
        type="warning"
        :closable="false"
        show-icon
        title="还没有可用的 AI 提供方"
        description="在 LoggingX 后端设置 LOGGINGX_AI_DEEPSEEK_API_KEY、LOGGINGX_AI_OPENAI_API_KEY 或 LOGGINGX_AI_ANTHROPIC_API_KEY 后重启。"
        class="mb-4"
      />
      <ElForm v-if="settings" label-width="96px" class="form">
        <ElFormItem label="提供方">
          <ElSelect
            v-model="form.provider"
            clearable
            placeholder="自动选择第一个已配置的"
            class="w-provider"
          >
            <ElOption
              v-for="provider in settings.providers"
              :key="provider"
              :value="provider"
              :label="PROVIDER_NAMES[provider] ?? provider"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="模型">
          <ElInput
            v-model="form.model"
            clearable
            placeholder="留空使用后端配置的默认模型"
            class="w-provider"
          />
        </ElFormItem>
        <ElFormItem label="每日上限">
          <ElInputNumber
            v-model="form.dailyLimit"
            :min="0"
            :max="10000"
            controls-position="right"
          />
          <span class="tip"
            >自动分析（新错误、告警触发）每天最多次数，今天已用
            {{ settings.usedToday }} 次；手动分析不计</span
          >
        </ElFormItem>
        <div class="section-title">分析完成后通知</div>
        <NotifyFields v-model="form.notification" />
        <ElFormItem>
          <ElButton type="primary" :loading="savingSettings" @click="saveSettings">保存</ElButton>
        </ElFormItem>
      </ElForm>
    </section>

    <section class="card">
      <header class="card__head">
        <div>
          <div class="card__title">日志库与代码仓库</div>
          <span class="muted"
            >关联 Git 仓库后，AI 会按堆栈找到出错的源文件一起分析；只支持 HTTPS 地址，需要 LoggingX
            服务器安装 git</span
          >
        </div>
      </header>
      <div class="table-wrap">
        <ElTable :data="stores" size="small">
          <ElTableColumn label="日志库" min-width="130">
            <template #default="{ row }">
              <div>{{ row.storeName }}</div>
              <div class="muted mono">{{ row.storeCode }}</div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="代码仓库" min-width="260">
            <template #default="{ row }">
              <template v-if="row.repoUrl">
                <div class="mono repo">{{ row.repoUrl }}</div>
                <div class="muted">
                  {{ row.repoBranch ?? '默认分支' }}
                  <template v-if="row.repoCommit">
                    · <span class="mono">{{ row.repoCommit.slice(0, 8) }}</span> ·
                    {{ row.repoSyncTime }}
                  </template>
                </div>
                <div v-if="row.repoError" class="error">{{ row.repoError }}</div>
              </template>
              <span v-else class="muted">未关联</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="自动分析" width="150">
            <template #default="{ row }">
              <div :class="row.autoNew ? 'on' : 'muted'"
                >新错误：{{ row.autoNew ? '开' : '关' }}</div
              >
              <div :class="row.onAlert ? 'on' : 'muted'"
                >告警触发：{{ row.onAlert ? '开' : '关' }}</div
              >
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" size="small" @click="edit(row)">设置</ElButton>
              <ElButton
                v-if="row.repoUrl"
                link
                type="primary"
                size="small"
                :loading="syncing === row.storeId"
                @click="sync(row)"
                >同步</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </section>

    <ElDialog
      v-model="dialog"
      :title="`AI 诊断设置 · ${editing?.storeName ?? ''}`"
      width="600px"
      align-center
    >
      <ElForm label-width="110px">
        <ElFormItem label="仓库地址">
          <ElInput
            v-model="storeForm.repoUrl"
            clearable
            placeholder="https://github.com/your-org/order-service.git"
          />
        </ElFormItem>
        <ElFormItem label="分支">
          <ElInput
            v-model="storeForm.repoBranch"
            clearable
            placeholder="留空使用默认分支，如 main"
          />
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput
            v-model="storeForm.repoUsername"
            clearable
            placeholder="GitHub、GitLab 可留空；Gitee 填写用户名"
          />
        </ElFormItem>
        <ElFormItem label="访问令牌">
          <ElInput
            v-model="storeForm.token"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              editing?.tokenSaved ? '已保存，留空则不修改' : '只读权限的令牌即可；公开仓库留空'
            "
          />
        </ElFormItem>
        <ElFormItem label="新错误自动分析">
          <ElSwitch v-model="storeForm.autoNew" />
          <span class="tip">某类错误第一次出现时分析一次，同类错误不重复分析</span>
        </ElFormItem>
        <ElFormItem label="告警触发分析">
          <ElSwitch v-model="storeForm.onAlert" />
          <span class="tip">该日志库的日志告警触发时，分析最新一条匹配的日志</span>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialog = false">取消</ElButton>
        <ElButton type="primary" :loading="savingStore" @click="saveStore">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessageBox } from 'element-plus'
  import { HttpError } from '@/utils/http/error'
  import { fetchAiSettings, saveAiSettings, saveAiStore, syncAiStore } from '@/api/ai-diagnosis'
  import NotifyFields from '@/views/alert/modules/notify-fields.vue'
  import { emptyNotify } from '@/views/alert/shared'
  import { PROVIDER_NAMES } from '../shared'

  defineProps<{ stores: Api.AiDiagnosis.StoreConfig[] }>()
  const emit = defineEmits<{ storesChanged: [] }>()

  const loadingSettings = ref(false)
  const savingSettings = ref(false)
  const settings = ref<Api.AiDiagnosis.Settings>()
  const form = reactive({
    provider: null as string | null,
    model: '' as string | null,
    dailyLimit: 50,
    notification: emptyNotify()
  })

  const loadSettings = async () => {
    loadingSettings.value = true
    try {
      settings.value = await fetchAiSettings()
      Object.assign(form, {
        provider: settings.value.provider,
        model: settings.value.model ?? '',
        dailyLimit: settings.value.dailyLimit,
        notification: structuredClone(toRaw(settings.value.notification ?? emptyNotify()))
      })
    } finally {
      loadingSettings.value = false
    }
  }

  const saveSettings = async () => {
    const { notification } = form
    if (
      notification.channels.length &&
      !notification.userIds.length &&
      !notification.groupIds.length
    ) {
      ElMessage.warning('请选择通知用户或通知组')
      return
    }
    savingSettings.value = true
    try {
      settings.value = await saveAiSettings({
        provider: form.provider || null,
        model: form.model?.trim() || null,
        dailyLimit: form.dailyLimit,
        notification
      })
      ElMessage.success('已保存')
    } finally {
      savingSettings.value = false
    }
  }

  const dialog = ref(false)
  const savingStore = ref(false)
  const editing = ref<Api.AiDiagnosis.StoreConfig>()
  const storeForm = reactive<Api.AiDiagnosis.StoreForm>({
    repoUrl: '',
    repoBranch: '',
    repoUsername: '',
    token: '',
    autoNew: false,
    onAlert: false
  })

  const edit = (store: Api.AiDiagnosis.StoreConfig) => {
    editing.value = store
    Object.assign(storeForm, {
      repoUrl: store.repoUrl ?? '',
      repoBranch: store.repoBranch ?? '',
      repoUsername: store.repoUsername ?? '',
      token: '',
      autoNew: store.autoNew,
      onAlert: store.onAlert
    })
    dialog.value = true
  }

  const saveStore = async () => {
    if (!editing.value) return
    savingStore.value = true
    try {
      await saveAiStore(editing.value.storeId, { ...storeForm })
      ElMessage.success('已保存')
      dialog.value = false
      emit('storesChanged')
    } finally {
      savingStore.value = false
    }
  }

  const syncing = ref<number>()
  const sync = async (store: Api.AiDiagnosis.StoreConfig) => {
    syncing.value = store.storeId
    try {
      const result = await syncAiStore(store.storeId)
      ElMessage.success(`同步完成：提交 ${result.commit.slice(0, 8)}，${result.files} 个文件`)
    } catch (error) {
      ElMessageBox.alert(error instanceof HttpError ? error.message : String(error), '同步失败', {
        type: 'error',
        confirmButtonText: '知道了'
      })
    } finally {
      syncing.value = undefined
      emit('storesChanged')
    }
  }

  onMounted(loadSettings)
</script>

<style scoped>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 8px;
  }

  .card {
    padding: 18px 20px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .card__head {
    margin-bottom: 14px;
  }

  .card__title {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .form {
    max-width: 760px;
  }

  .w-provider {
    width: 280px;
    max-width: 100%;
  }

  .section-title {
    padding-left: 8px;
    margin: 6px 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-left: 3px solid var(--el-color-primary);
  }

  .table-wrap {
    overflow-x: auto;
  }

  .tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .repo {
    font-size: 12px;
    word-break: break-all;
  }

  .error {
    font-size: 12px;
    color: var(--el-color-danger);
    word-break: break-all;
  }

  .on {
    font-size: 12px;
    color: var(--el-color-success);
  }
</style>
