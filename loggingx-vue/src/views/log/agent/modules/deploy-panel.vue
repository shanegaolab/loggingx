<!-- 一键部署：选择环境，生成安装命令、安装脚本与 Vector 配置；采集内容来自日志库的采集配置 -->
<template>
  <div class="deploy-panel">
    <div class="platforms">
      <button
        v-for="item in PLATFORMS"
        :key="item.value"
        type="button"
        class="platform"
        :class="{ 'is-active': platform === item.value }"
        @click="platform = item.value"
      >
        <LogxSvgIcon :icon="item.icon" class="platform__icon" />
        <span class="platform__name">{{ item.label }}</span>
        <span class="platform__desc">{{ item.desc }}</span>
      </button>
    </div>

    <div class="collect-summary">
      <div class="collect-summary__body">
        <span class="collect-summary__label">采集内容</span>
        <span class="collect-summary__text">{{ collectSummary }}</span>
      </div>
      <ElButton link type="primary" @click="emit('edit-collect')">修改采集配置</ElButton>
    </div>

    <ElFormItem label="LoggingX 地址" class="server-item">
      <ElInput v-model="server" placeholder="https://logs.example.com" class="mono-input" />
      <span class="form-hint"
        >Agent 所在机器要能访问这个地址：用于下载安装包、同步配置和上报日志</span
      >
    </ElFormItem>

    <ElAlert v-if="!store.enabled" type="warning" :closable="false" show-icon class="mb-3">
      日志库已停用：Agent 可以安装和同步，但上报的日志会被拒绝，启用后恢复。
    </ElAlert>
    <ElAlert v-if="formError" type="warning" :closable="false" show-icon>
      {{ formError }}
      <ElButton v-if="missingPaths" link type="primary" @click="emit('edit-collect')"
        >去填写</ElButton
      >
    </ElAlert>
    <template v-else>
      <p class="deploy-tip">{{ DEPLOY_TIPS[platform] }}</p>
      <div class="command">
        <pre class="command__text">{{ installCommand }}</pre>
        <ElButton class="command__copy" size="small" @click="copy(installCommand, '安装命令')">
          <LogxSvgIcon icon="ri:file-copy-line" class="mr-1" />复制
        </ElButton>
      </div>
      <p class="deploy-warning">
        <LogxSvgIcon icon="ri:shield-keyhole-line" />
        命令里含有日志库的上报 Token，请勿发到公开渠道。安装后 Agent
        自动登记到本日志库，之后修改采集配置或重置 Token 都会自动下发，无需重新执行。
      </p>

      <div class="downloads">
        <ElButton :loading="downloading === 'script'" @click="downloadScript">
          <LogxSvgIcon icon="ri:file-code-line" class="mr-1" />下载{{ scriptLabel }}
        </ElButton>
        <ElButton :loading="downloading === 'config'" @click="downloadConfig">
          <LogxSvgIcon icon="ri:settings-3-line" class="mr-1" />下载 Vector 配置
        </ElButton>
        <ElDropdown
          v-if="packagesForPlatform.length"
          trigger="click"
          @command="(file: string) => openPackage(file)"
        >
          <ElButton>
            <LogxSvgIcon icon="ri:download-2-line" class="mr-1" />下载 Agent 安装包
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem v-for="pkg in packagesForPlatform" :key="pkg.file" :command="pkg.file"
                >{{ pkg.platform }} {{ pkg.arch }}</ElDropdownItem
              >
              <ElDropdownItem v-if="meta" :command="meta.checksums" divided
                >SHA-256 校验文件</ElDropdownItem
              >
            </ElDropdownMenu>
          </template>
        </ElDropdown>
        <span v-else-if="meta" class="image-name"
          >镜像 <code>{{ meta.image }}</code></span
        >
      </div>

      <ElCollapse v-model="openPanels" class="deploy-panels">
        <ElCollapseItem title="查看生成的 Vector 配置" name="config">
          <div v-loading="loadingPreview" class="preview">
            <pre class="preview__text">{{ preview || ' ' }}</pre>
          </div>
        </ElCollapseItem>
        <ElCollapseItem title="卸载与手动安装" name="manual">
          <div class="manual-title">卸载（同时从 Agent 列表移除）：</div>
          <div class="command command--small">
            <pre class="command__text">{{ uninstallCommand }}</pre>
            <ElButton class="command__copy" size="small" @click="copy(uninstallCommand, '卸载命令')"
              >复制</ElButton
            >
          </div>
          <div class="manual-title">手动安装（不登记、不自动同步配置）：</div>
          <ul class="manual">
            <li v-for="(step, index) in manualSteps" :key="index">{{ step }}</li>
          </ul>
        </ElCollapseItem>
      </ElCollapse>
    </template>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { buildAgentQuery, fetchAgentFile } from '@/api/agent'
  import type { AgentFileKind } from '@/api/agent'

  type Platform = Api.Agent.Platform

  const props = defineProps<{
    store: Api.Log.Store
    meta?: Api.Agent.Meta
    collect?: Api.Agent.CollectConfigView
  }>()
  const emit = defineEmits<{ 'edit-collect': [] }>()

  const PLATFORMS: { value: Platform; label: string; desc: string; icon: string }[] = [
    { value: 'linux', label: 'Linux', desc: 'systemd 服务', icon: 'ri:terminal-box-line' },
    { value: 'docker', label: 'Docker', desc: '容器运行', icon: 'ri:box-3-line' },
    { value: 'kubernetes', label: 'Kubernetes', desc: 'DaemonSet', icon: 'ri:ship-2-line' },
    { value: 'windows', label: 'Windows', desc: 'Windows 服务', icon: 'ri:windows-line' }
  ]

  const MULTILINE_NAMES: Record<Api.Agent.Multiline, string> = {
    none: '不合并多行',
    stacktrace: '合并异常堆栈',
    timestamp: '以日期开头为新日志',
    custom: '自定义多行规则'
  }

  const DEPLOY_TIPS: Record<Platform, string> = {
    linux:
      '在目标机器上以 root 执行（支持 x86_64 / arm64），会安装为 systemd 服务 loggingx-agent 并开机自启：',
    docker: '在 Docker 宿主机上以 root 执行，会运行名为 loggingx-agent 的容器并随 Docker 自启：',
    kubernetes:
      '在能访问集群的机器上执行（需要 kubectl 和集群管理员权限），会创建 loggingx 命名空间和 DaemonSet：',
    windows:
      '在目标机器上以管理员身份打开 PowerShell 执行，会安装为 Windows 服务 loggingx-agent 并开机自启：'
  }

  const platform = ref<Platform>('linux')
  const server = ref(window.location.origin)
  const openPanels = ref<string[]>([])
  const preview = ref('')
  const loadingPreview = ref(false)
  const downloading = ref<'script' | 'config' | ''>('')

  watch(
    () => props.meta?.serverUrl,
    (url) => {
      if (url) server.value = url
    },
    { immediate: true }
  )

  const paths = computed(() =>
    platform.value === 'windows'
      ? (props.collect?.windowsPaths ?? [])
      : (props.collect?.paths ?? [])
  )

  const collectSummary = computed(() => {
    const collect = props.collect
    if (!collect) return '加载中…'
    const parts: string[] = []
    if (platform.value === 'kubernetes') parts.push('所有 Pod 的容器日志')
    else {
      if (paths.value.length) parts.push(paths.value.join('，'))
      if (platform.value === 'docker' && collect.containers) parts.push('所有容器的标准输出')
    }
    if (platform.value !== 'kubernetes') parts.push(MULTILINE_NAMES[collect.multiline])
    parts.push(collect.transport === 'kafka' ? `经 Kafka（${collect.kafkaTopic}）` : 'HTTP 直传')
    return parts.join(' · ')
  })

  const missingPaths = computed(
    () =>
      !!props.collect &&
      (platform.value === 'linux' || platform.value === 'windows') &&
      !paths.value.length
  )

  const formError = computed(() => {
    if (missingPaths.value) {
      return `采集配置中还没有${platform.value === 'windows' ? ' Windows ' : ' Linux '}日志路径。`
    }
    if (
      platform.value === 'docker' &&
      props.collect &&
      !props.collect.paths.length &&
      !props.collect.containers
    ) {
      return 'Docker 环境下既没有日志路径，也没有开启容器标准输出。'
    }
    if (!/^https?:\/\/[^\s/?#'"]+(\/[^\s?#'"]*)?$/.test(server.value.trim())) {
      return 'LoggingX 地址需为 http(s):// 开头的地址'
    }
    return ''
  })

  const serverBase = computed(() => server.value.trim().replace(/\/+$/, ''))

  const fileKind = computed<AgentFileKind>(() =>
    platform.value === 'windows'
      ? 'install.ps1'
      : platform.value === 'kubernetes'
        ? 'kubernetes.yaml'
        : 'install.sh'
  )

  const scriptLabel = computed(() =>
    platform.value === 'kubernetes'
      ? ' Kubernetes 清单'
      : platform.value === 'windows'
        ? ' PowerShell 脚本'
        : '安装脚本'
  )

  const scriptUrl = computed(
    () =>
      `${serverBase.value}/api/agent/${fileKind.value}?${buildAgentQuery(platform.value, serverBase.value)}`
  )

  // Token 放在请求头里，不出现在 URL（避免进入代理和服务器的访问日志）
  const installCommand = computed(() => {
    const token = props.store.ingestToken
    switch (platform.value) {
      case 'windows':
        return `$h = @{ 'X-Log-Token' = '${token}' }; & ([scriptblock]::Create((irm '${scriptUrl.value}' -Headers $h)))`
      case 'kubernetes':
        return `curl -fsSL -H 'X-Log-Token: ${token}' '${scriptUrl.value}' | kubectl apply -f -`
      default:
        return `curl -fsSL -H 'X-Log-Token: ${token}' '${scriptUrl.value}' | sudo bash`
    }
  })

  const uninstallCommand = computed(() => {
    switch (platform.value) {
      case 'windows':
        return installCommand.value.replace(/\)\)\)$/, '))) -Uninstall')
      case 'kubernetes':
        return 'kubectl delete namespace loggingx; kubectl delete clusterrole,clusterrolebinding loggingx-agent'
      default:
        return installCommand.value.replace(/\| sudo bash$/, '| sudo bash -s -- uninstall')
    }
  })

  const manualSteps = computed(() => {
    const version = props.meta?.version ?? ''
    switch (platform.value) {
      case 'linux':
        return [
          `下载 Agent 安装包（Vector ${version}，按 CPU 架构选择），解压出 bin/vector 放到 /opt/loggingx-agent/bin/`,
          '下载 Vector 配置，保存为 /etc/loggingx-agent/vector.yaml（权限 600，内含 Token）',
          '运行 /opt/loggingx-agent/bin/vector --config /etc/loggingx-agent/vector.yaml，或交给 systemd / supervisor 管理'
        ]
      case 'docker':
        return [
          '下载 Vector 配置，保存为 /etc/loggingx-agent/vector.yaml',
          `docker run 镜像 ${props.meta?.image ?? ''}，挂载配置到 /etc/vector/vector.yaml、宿主机根目录只读挂载到 /host、/var/run/docker.sock`
        ]
      case 'kubernetes':
        return ['下载 Kubernetes 清单，检查后执行 kubectl apply -f loggingx-agent.yaml']
      default:
        return [
          `下载 Agent 安装包（Vector ${version}），解压出 bin\\vector.exe`,
          '下载 Vector 配置，保存为 C:\\ProgramData\\LoggingX Agent\\vector.yaml',
          '注册服务：vector.exe service install --name loggingx-agent --config-yaml <配置路径>，然后启动服务'
        ]
    }
  })

  const packagesForPlatform = computed(() =>
    (props.meta?.packages ?? []).filter((pkg) => pkg.platform === platform.value)
  )

  // 展开配置预览时刷新（输入停顿后再请求）
  let previewTimer: ReturnType<typeof setTimeout> | undefined
  const refreshPreview = () => {
    clearTimeout(previewTimer)
    if (!openPanels.value.includes('config') || formError.value) return
    previewTimer = setTimeout(async () => {
      loadingPreview.value = true
      try {
        preview.value = await fetchAgentFile(
          'config',
          props.store.storeId,
          platform.value,
          serverBase.value
        )
      } catch (error) {
        preview.value = `# 生成失败：${(error as Error).message}`
      } finally {
        loadingPreview.value = false
      }
    }, 400)
  }
  watch(
    [platform, serverBase, openPanels, () => props.store, () => props.collect],
    refreshPreview,
    { deep: true }
  )

  const saveFile = (content: string, fileName: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadScript = async () => {
    downloading.value = 'script'
    try {
      const content = await fetchAgentFile(
        fileKind.value,
        props.store.storeId,
        platform.value,
        serverBase.value
      )
      const names: Record<AgentFileKind, string> = {
        'install.sh': 'install-loggingx-agent.sh',
        'install.ps1': 'install-loggingx-agent.ps1',
        'kubernetes.yaml': 'loggingx-agent.yaml',
        config: 'vector.yaml'
      }
      // Windows PowerShell 5.1 只有在文件带 BOM 时才按 UTF-8 读取（fetch 解码时会去掉 BOM，这里补上）
      const saved =
        fileKind.value === 'install.ps1' ? String.fromCharCode(0xfeff) + content : content
      saveFile(saved, names[fileKind.value])
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      downloading.value = ''
    }
  }

  const downloadConfig = async () => {
    downloading.value = 'config'
    try {
      saveFile(
        await fetchAgentFile('config', props.store.storeId, platform.value, serverBase.value),
        'vector.yaml'
      )
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      downloading.value = ''
    }
  }

  const openPackage = (file: string) => {
    window.open(`${serverBase.value}/api/agent/download/${file}`, '_blank', 'noopener')
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(`${label}已复制`)
    } catch {
      ElMessage.error('复制失败，请手动选择复制')
    }
  }
</script>

<style scoped>
  .platforms {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .platform {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    padding: 12px 6px;
    cursor: pointer;
    background: var(--el-fill-color-lighter);
    border: 1px solid transparent;
    border-radius: 8px;
    transition: all 0.15s;
  }

  .platform:hover {
    border-color: var(--el-border-color);
  }

  .platform.is-active {
    background: var(--el-bg-color);
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }

  .platform__icon {
    margin-bottom: 4px;
    font-size: 24px;
    color: var(--el-text-color-regular);
  }

  .platform.is-active .platform__icon {
    color: var(--el-color-primary);
  }

  .platform__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .platform__desc {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .collect-summary {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    margin: 14px 0;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }

  .collect-summary__body {
    flex: 1;
    min-width: 0;
    font-size: 13px;
  }

  .collect-summary__label {
    margin-right: 8px;
    color: var(--el-text-color-secondary);
  }

  .collect-summary__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-primary);
    word-break: break-all;
  }

  .server-item {
    margin-bottom: 14px;
  }

  .server-item :deep(.el-form-item__label) {
    font-size: 13px;
  }

  .server-item :deep(.el-form-item__content) {
    flex-direction: column;
    align-items: stretch;
  }

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  .mono-input :deep(input) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .deploy-tip {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }

  .command {
    position: relative;
    padding: 14px 16px;
    padding-right: 80px;
    color: #e5e7eb;
    background: #14161a;
    border-radius: 8px;
  }

  .command--small {
    padding: 10px 12px;
    padding-right: 72px;
    margin-bottom: 12px;
  }

  .command__text {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .command__copy {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .deploy-warning {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .deploy-warning svg {
    flex: none;
    margin-top: 3px;
  }

  .downloads {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 16px;
  }

  .downloads .el-button {
    margin: 0;
  }

  .image-name {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .image-name code,
  .manual {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .deploy-panels {
    margin-top: 16px;
  }

  .preview {
    min-height: 60px;
    max-height: 420px;
    overflow: auto;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }

  .preview__text {
    padding: 10px 12px;
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre;
  }

  .manual-title {
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .manual {
    padding-left: 18px;
    margin: 0;
    font-size: 12px;
    line-height: 1.9;
    color: var(--el-text-color-regular);
  }

  @media (width <= 640px) {
    .platforms {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
