<!-- 通知设置：邮件（SMTP）与短信（阿里云 / 腾讯云）通道 -->
<template>
  <div v-loading="loading" class="channels">
    <!-- 邮件 -->
    <section class="channel">
      <header class="channel__head">
        <LogxSvgIcon icon="ri:mail-send-line" class="channel__icon channel__icon--email" />
        <div class="channel__title">
          <div>邮件通知</div>
          <span class="muted">通过 SMTP 发送 HTML 告警邮件</span>
        </div>
        <ElTag v-if="saved.email" :type="email.enabled ? 'success' : 'info'" size="small">
          {{ email.enabled ? '已启用' : '未启用' }}
        </ElTag>
        <ElTag v-else type="info" size="small">未配置</ElTag>
      </header>
      <ElForm
        ref="emailRef"
        :model="email"
        :rules="emailRules"
        label-width="116px"
        class="channel__form"
      >
        <ElFormItem label="启用">
          <ElSwitch v-model="email.enabled" />
        </ElFormItem>
        <ElFormItem label="常用邮箱">
          <div class="presets">
            <ElButton
              v-for="preset in SMTP_PRESETS"
              :key="preset.host"
              size="small"
              @click="applyPreset(preset)"
              >{{ preset.name }}</ElButton
            >
          </div>
        </ElFormItem>
        <ElFormItem label="SMTP 服务器" prop="host">
          <div class="row">
            <ElInput v-model="email.host" placeholder="smtp.example.com" class="row__grow" />
            <ElInputNumber
              v-model="email.port"
              :min="1"
              :max="65535"
              controls-position="right"
              class="row__port"
            />
          </div>
        </ElFormItem>
        <ElFormItem label="加密方式">
          <ElRadioGroup v-model="email.security" @change="onSecurityChange">
            <ElRadio value="ssl">SSL/TLS</ElRadio>
            <ElRadio value="starttls">STARTTLS</ElRadio>
            <ElRadio value="none">不加密</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="账号">
          <ElInput
            v-model="email.username"
            placeholder="一般为完整邮箱地址；无需登录的服务器留空"
          />
        </ElFormItem>
        <ElFormItem label="密码 / 授权码">
          <ElInput
            v-model="email.password"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              email.passwordSaved ? '已保存，留空则不修改' : 'QQ、163 等邮箱需使用授权码'
            "
          />
        </ElFormItem>
        <ElFormItem label="发件地址" prop="from">
          <div class="row">
            <ElInput v-model="email.from" placeholder="alert@example.com" class="row__grow" />
            <ElInput v-model="email.fromName" placeholder="发件人名称" class="row__name" />
          </div>
        </ElFormItem>
        <ElFormItem label="测试">
          <div class="row">
            <ElInput v-model="testTo" placeholder="收件邮箱" class="row__grow" />
            <ElButton :loading="testing.email" @click="sendTest('email')">发送测试邮件</ElButton>
          </div>
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :loading="saving.email" @click="save('email')">保存</ElButton>
          <span v-if="email.updatedAt" class="muted ml-3"
            >上次保存 {{ formatTime(email.updatedAt) }}</span
          >
        </ElFormItem>
      </ElForm>
    </section>

    <!-- 短信 -->
    <section class="channel">
      <header class="channel__head">
        <LogxSvgIcon icon="ri:message-3-line" class="channel__icon channel__icon--sms" />
        <div class="channel__title">
          <div>短信通知</div>
          <span class="muted">使用已审核通过的短信签名与模板发送</span>
        </div>
        <ElTag v-if="saved.sms" :type="sms.enabled ? 'success' : 'info'" size="small">
          {{ sms.enabled ? '已启用' : '未启用' }}
        </ElTag>
        <ElTag v-else type="info" size="small">未配置</ElTag>
      </header>
      <ElForm ref="smsRef" :model="sms" :rules="smsRules" label-width="116px" class="channel__form">
        <ElFormItem label="启用">
          <ElSwitch v-model="sms.enabled" />
        </ElFormItem>
        <ElFormItem label="服务商">
          <ElRadioGroup v-model="sms.provider">
            <ElRadioButton value="aliyun">阿里云</ElRadioButton>
            <ElRadioButton value="tencent">腾讯云</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem :label="isTencent ? 'SecretId' : 'AccessKey ID'" prop="accessKeyId">
          <ElInput v-model="sms.accessKeyId" autocomplete="off" />
        </ElFormItem>
        <ElFormItem :label="isTencent ? 'SecretKey' : 'AccessKey Secret'">
          <ElInput
            v-model="sms.secret"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              sms.secretSaved ? '已保存，留空则不修改' : '建议使用只授权短信发送的子账号密钥'
            "
          />
        </ElFormItem>
        <ElFormItem v-if="isTencent" label="SdkAppId" prop="sdkAppId">
          <div class="row">
            <ElInput
              v-model="sms.sdkAppId"
              placeholder="短信应用 ID，如 1400000000"
              class="row__grow"
            />
            <ElInput v-model="sms.region" placeholder="地域" class="row__name" />
          </div>
        </ElFormItem>
        <ElFormItem label="短信签名" prop="signName">
          <ElInput v-model="sms.signName" placeholder="已审核通过的签名，如 LoggingX" />
        </ElFormItem>
        <ElFormItem :label="isTencent ? '模板 ID' : '模板 CODE'" prop="templateId">
          <ElInput
            v-model="sms.templateId"
            :placeholder="isTencent ? '如 1234567' : '如 SMS_123456789'"
          />
        </ElFormItem>
        <ElFormItem label="模板内容">
          <div class="template">
            <div class="template__text">
              <span>{{ templateExample }}</span>
              <ElButton link type="primary" size="small" @click="copyTemplate">复制</ElButton>
            </div>
            <div class="muted">
              在{{
                isTencent ? '腾讯云' : '阿里云'
              }}短信控制台按此格式申请模板，变量依次为：级别、规则、对象、状态、详情（每个变量最多
              {{ isTencent ? 20 : 30 }} 字，超出截断）
            </div>
          </div>
        </ElFormItem>
        <ElFormItem label="接口地址">
          <ElInput
            v-model="sms.endpoint"
            clearable
            :placeholder="
              isTencent
                ? '默认 https://sms.tencentcloudapi.com'
                : '默认 https://dysmsapi.aliyuncs.com'
            "
          />
        </ElFormItem>
        <ElFormItem label="测试">
          <div class="row">
            <ElInput v-model="testPhone" placeholder="接收手机号" class="row__grow" />
            <ElButton :loading="testing.sms" @click="sendTest('sms')">发送测试短信</ElButton>
          </div>
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :loading="saving.sms" @click="save('sms')">保存</ElButton>
          <span v-if="sms.updatedAt" class="muted ml-3"
            >上次保存 {{ formatTime(sms.updatedAt) }}</span
          >
        </ElFormItem>
      </ElForm>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import { HttpError } from '@/utils/http/error'
  import {
    fetchNotifyChannels,
    saveEmailSettings,
    saveSmsSettings,
    testEmail,
    testSms
  } from '@/api/alert-center'

  const loading = ref(false)
  const emailRef = ref<FormInstance>()
  const smsRef = ref<FormInstance>()
  const saved = reactive({ email: false, sms: false })
  const saving = reactive({ email: false, sms: false })
  const testing = reactive({ email: false, sms: false })
  const testTo = ref('')
  const testPhone = ref('')

  const email = reactive<Api.AlertCenter.EmailSettings>({
    enabled: false,
    host: '',
    port: 465,
    security: 'ssl',
    username: '',
    password: '',
    passwordSaved: false,
    from: '',
    fromName: 'LoggingX'
  })
  const sms = reactive<Api.AlertCenter.SmsSettings>({
    enabled: false,
    provider: 'aliyun',
    accessKeyId: '',
    secret: '',
    secretSaved: false,
    signName: '',
    templateId: '',
    sdkAppId: '',
    region: 'ap-guangzhou',
    endpoint: ''
  })
  const isTencent = computed(() => sms.provider === 'tencent')

  const SMTP_PRESETS = [
    { name: 'QQ 邮箱', host: 'smtp.qq.com', port: 465, security: 'ssl' },
    { name: '腾讯企业邮', host: 'smtp.exmail.qq.com', port: 465, security: 'ssl' },
    { name: '163 邮箱', host: 'smtp.163.com', port: 465, security: 'ssl' },
    { name: '阿里企业邮', host: 'smtp.qiye.aliyun.com', port: 465, security: 'ssl' },
    { name: 'Outlook', host: 'smtp.office365.com', port: 587, security: 'starttls' },
    { name: 'Gmail', host: 'smtp.gmail.com', port: 465, security: 'ssl' }
  ] as const

  const applyPreset = (preset: (typeof SMTP_PRESETS)[number]) => {
    Object.assign(email, { host: preset.host, port: preset.port, security: preset.security })
  }

  const DEFAULT_PORTS = { ssl: 465, starttls: 587, none: 25 } as const
  const onSecurityChange = (value: string | number | boolean | undefined) => {
    if (Object.values(DEFAULT_PORTS).includes(email.port as 465)) {
      email.port = DEFAULT_PORTS[value as keyof typeof DEFAULT_PORTS]
    }
  }

  const templateExample = computed(() =>
    isTencent.value
      ? '【{1}】{2}：{3} {4}，{5}'
      : '【${level}】${rule}：${target} ${status}，${detail}'
  )
  const copyTemplate = async () => {
    await navigator.clipboard.writeText(templateExample.value)
    ElMessage.success('已复制')
  }

  const emailAddress = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
  const emailRules: FormRules = {
    host: [{ required: true, message: '请输入 SMTP 服务器', trigger: 'blur' }],
    from: [
      { required: true, message: '请输入发件地址', trigger: 'blur' },
      { pattern: emailAddress, message: '邮箱格式不正确', trigger: 'blur' }
    ]
  }
  const smsRules: FormRules = {
    accessKeyId: [{ required: true, message: '请输入访问密钥 ID', trigger: 'blur' }],
    signName: [{ required: true, message: '请输入短信签名', trigger: 'blur' }],
    templateId: [{ required: true, message: '请输入模板', trigger: 'blur' }],
    sdkAppId: [{ required: true, message: '请输入 SdkAppId', trigger: 'blur' }]
  }

  const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

  const load = async () => {
    loading.value = true
    try {
      const channels = await fetchNotifyChannels()
      Object.assign(email, channels.email, { password: '' })
      Object.assign(sms, channels.sms, { secret: '' })
      saved.email = !!channels.email.updatedAt
      saved.sms = !!channels.sms.updatedAt
    } finally {
      loading.value = false
    }
  }

  const save = async (channel: 'email' | 'sms') => {
    const form = channel === 'email' ? emailRef.value : smsRef.value
    if (!(await form?.validate().catch(() => false))) return
    if (channel === 'sms' && !sms.secret && !sms.secretSaved) {
      ElMessage.warning(`请输入 ${isTencent.value ? 'SecretKey' : 'AccessKey Secret'}`)
      return
    }
    saving[channel] = true
    try {
      if (channel === 'email') {
        Object.assign(email, await saveEmailSettings({ ...email }), { password: '' })
      } else {
        Object.assign(sms, await saveSmsSettings({ ...sms }), { secret: '' })
      }
      saved[channel] = true
      ElMessage.success('已保存')
    } finally {
      saving[channel] = false
    }
  }

  /** 用当前填写的配置（不必先保存）发送测试 */
  const sendTest = async (channel: 'email' | 'sms') => {
    const form = channel === 'email' ? emailRef.value : smsRef.value
    if (!(await form?.validate().catch(() => false))) return
    const target = (channel === 'email' ? testTo.value : testPhone.value).trim()
    if (!target) {
      ElMessage.warning(channel === 'email' ? '请输入收件邮箱' : '请输入接收手机号')
      return
    }
    testing[channel] = true
    try {
      if (channel === 'email') await testEmail({ ...email }, target)
      else await testSms({ ...sms }, target)
      ElMessage.success(channel === 'email' ? '测试邮件已发送，请查收' : '测试短信已发送')
    } catch (error) {
      ElMessageBox.alert(
        error instanceof HttpError ? error.message : String(error),
        channel === 'email' ? '测试邮件发送失败' : '测试短信发送失败',
        { type: 'error', confirmButtonText: '知道了' }
      )
    } finally {
      testing[channel] = false
    }
  }

  onMounted(load)
</script>

<style scoped>
  .channels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(440px, 100%), 1fr));
    gap: 16px;
    align-items: start;
    padding-bottom: 8px;
  }

  .channel {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .channel__head {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .channel__icon {
    flex: none;
    width: 36px;
    height: 36px;
    padding: 8px;
    font-size: 20px;
    border-radius: 8px;
  }

  .channel__icon--email {
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  }

  .channel__icon--sms {
    color: var(--el-color-success);
    background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  }

  .channel__title {
    flex: 1;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .channel__title .muted {
    font-weight: normal;
  }

  .channel__form {
    padding: 16px 18px 0 6px;
  }

  .row {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .row__grow {
    flex: 1;
    min-width: 0;
  }

  .row__port {
    width: 110px;
  }

  .row__name {
    width: 140px;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .presets .el-button {
    margin: 0;
  }

  .template {
    width: 100%;
    line-height: 1.6;
  }

  .template__text {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    background: var(--el-fill-color-lighter);
    border-radius: 4px;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
