<!-- 知识库：运维手册、故障复盘、常见问题，AI 问答时检索引用 -->
<template>
  <div class="list">
    <div class="toolbar">
      <ElButton type="primary" size="small" @click="edit()">
        <LogxSvgIcon icon="ri:add-line" class="mr-1" />新增文档
      </ElButton>
      <ElInput
        v-model="filter"
        size="small"
        clearable
        placeholder="按标题、标签筛选"
        class="w-filter"
      />
      <span class="hint"
        >支持 Markdown；可直接导入 .md、.txt 文件。AI
        诊断的历史结论会自动作为资料，无需重复录入</span
      >
    </div>
    <ElTable v-loading="loading" :data="shown" size="small" height="100%" class="table">
      <template #empty>
        <ElEmpty
          :image-size="72"
          description="还没有知识库文档。把运维手册、故障复盘放进来，AI 回答会更准确"
        />
      </template>
      <ElTableColumn label="标题" min-width="260">
        <template #default="{ row }">
          <ElButton link type="primary" @click="edit(row)">{{ row.title }}</ElButton>
          <div class="muted excerpt">{{ row.excerpt }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="标签" min-width="140">
        <template #default="{ row }">
          <ElTag v-for="tag in row.tags" :key="tag" size="small" type="info" class="tag">{{
            tag
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="适用日志库" width="130">
        <template #default="{ row }">{{ row.storeName ?? '全部' }}</template>
      </ElTableColumn>
      <ElTableColumn label="字数" width="80" align="right">
        <template #default="{ row }">{{ row.length.toLocaleString() }}</template>
      </ElTableColumn>
      <ElTableColumn label="更新" width="170">
        <template #default="{ row }">
          <div>{{ row.updateTime }}</div>
          <div class="muted">{{ row.createdBy ?? '' }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="edit(row)">编辑</ElButton>
          <ElButton link type="danger" size="small" @click="remove(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="dialog"
      :title="editingId ? '编辑文档' : '新增文档'"
      width="760px"
      align-center
    >
      <ElForm v-loading="loadingDetail" label-width="90px">
        <ElFormItem label="标题" required>
          <ElInput
            v-model="form.title"
            maxlength="200"
            placeholder="如：订单服务库存为负的处理手册"
          />
        </ElFormItem>
        <ElFormItem label="适用日志库">
          <ElSelect v-model="form.storeId" clearable placeholder="全部日志库" class="w-store">
            <ElOption
              v-for="store in stores"
              :key="store.storeId"
              :value="store.storeId"
              :label="store.storeName"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="标签">
          <ElInput v-model="form.tags" placeholder="用逗号分隔，如：订单, 数据库, 故障复盘" />
        </ElFormItem>
        <ElFormItem label="内容" required>
          <div class="content">
            <div class="content__bar">
              <label class="import">
                <input
                  type="file"
                  accept=".md,.markdown,.txt,text/plain,text/markdown"
                  @change="importFile"
                />
                <LogxSvgIcon icon="ri:upload-2-line" /> 导入文件
              </label>
              <span class="muted">{{ form.content.length.toLocaleString() }} 字</span>
            </div>
            <ElInput
              v-model="form.content"
              type="textarea"
              :rows="16"
              placeholder="# 现象&#10;……&#10;&#10;# 原因&#10;……&#10;&#10;# 处理步骤&#10;1. ……"
            />
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialog = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import {
    deleteKnowledge,
    fetchKnowledge,
    fetchKnowledgeDetail,
    saveKnowledge
  } from '@/api/ai-diagnosis'

  defineProps<{ stores: Api.AiDiagnosis.StoreConfig[] }>()

  const loading = ref(false)
  const list = ref<Api.AiOps.Knowledge[]>([])
  const filter = ref('')
  const shown = computed(() => {
    const word = filter.value.trim().toLowerCase()
    if (!word) return list.value
    return list.value.filter(
      (item) =>
        item.title.toLowerCase().includes(word) ||
        item.tags.some((tag) => tag.toLowerCase().includes(word))
    )
  })

  const load = async () => {
    loading.value = true
    try {
      list.value = await fetchKnowledge()
    } finally {
      loading.value = false
    }
  }

  const dialog = ref(false)
  const saving = ref(false)
  const loadingDetail = ref(false)
  const editingId = ref<number>()
  const form = reactive<Api.AiOps.KnowledgeForm>({
    title: '',
    content: '',
    tags: '',
    storeId: null
  })

  const edit = async (item?: Api.AiOps.Knowledge | { id: number }) => {
    editingId.value = item?.id
    Object.assign(form, { title: '', content: '', tags: '', storeId: null })
    dialog.value = true
    if (!item) return
    loadingDetail.value = true
    try {
      const detail = await fetchKnowledgeDetail(item.id)
      Object.assign(form, {
        title: detail.item.title,
        content: detail.content,
        tags: detail.item.tags.join(', '),
        storeId: detail.item.storeId
      })
    } finally {
      loadingDetail.value = false
    }
  }

  const importFile = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 2_000_000) {
      ElMessage.warning('文件超过 2 MB，请拆分后导入')
      return
    }
    form.content = await file.text()
    if (!form.title.trim()) form.title = file.name.replace(/\.(md|markdown|txt)$/i, '')
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      ElMessage.warning('请填写标题和内容')
      return
    }
    saving.value = true
    try {
      await saveKnowledge(editingId.value, { ...form })
      ElMessage.success('已保存')
      dialog.value = false
      load()
    } finally {
      saving.value = false
    }
  }

  const remove = async (item: Api.AiOps.Knowledge) => {
    try {
      await ElMessageBox.confirm(`删除文档「${item.title}」？`, '删除文档', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await deleteKnowledge(item.id)
    ElMessage.success('已删除')
    load()
  }

  onMounted(load)
  defineExpose({ edit })
</script>

<style scoped>
  .list {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .w-filter {
    width: 200px;
  }

  .w-store {
    width: 220px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .excerpt {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .tag {
    margin: 2px 4px 2px 0;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .content__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .import {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 13px;
    color: var(--el-color-primary);
    cursor: pointer;
  }

  .import input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .import:focus-within {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
</style>
