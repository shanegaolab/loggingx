/**
 * API 接口类型定义模块
 *
 * 提供所有后端接口的类型定义
 *
 * ## 主要功能
 *
 * - 通用类型（分页参数、响应结构等）
 * - 认证类型（登录、用户信息等）
 * - 系统管理类型（用户、角色等）
 * - 全局命名空间声明
 *
 * ## 使用场景
 *
 * - API 请求参数类型约束
 * - API 响应数据类型定义
 * - 接口文档类型同步
 *
 * ## 注意事项
 *
 * - 在 .vue 文件使用需要在 eslint.config.mjs 中配置 globals: { Api: 'readonly' }
 * - 使用全局命名空间，无需导入即可使用
 *
 * ## 使用方式
 *
 * ```typescript
 * const params: Api.Auth.LoginParams = { userName: 'admin', password: '123456' }
 * const response: Api.Auth.UserInfo = await fetchUserInfo()
 * ```
 *
 * @module types/api/api
 * @author LoggingX Team
 */

declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /** 分页参数 */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数 */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证类型 */
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      userName: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      tokenType?: string
      /** 令牌有效期（秒） */
      expiresIn?: number
      /** 后端暂不支持刷新令牌 */
      refreshToken?: string
    }

    /** 用户信息 */
    interface UserInfo {
      buttons: string[]
      roles: string[]
      userId: number
      userName: string
      nickName?: string
      email: string
      avatar?: string
    }
  }

  /** 系统管理类型 */
  namespace SystemManage {
    /** 角色可访问的日志库；allStores 为 true 时包括以后新建的日志库 */
    interface RoleStoreScope {
      allStores: boolean
      storeIds: number[]
    }

    /** 用户列表 */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id: number
      avatar: string
      status: string
      userName: string
      userGender: string
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
      /** 所属部门，未分配时为 null */
      deptId: number | null
      deptName: string | null
      /** 岗位，按岗位排序；postNames 与 postIds 一一对应 */
      postIds: number[]
      postNames: string[]
      createBy: string
      createTime: string
      updateBy: string
      updateTime: string
    }

    /** 用户搜索参数（deptId 同时匹配其下级部门的用户） */
    type UserSearchParams = Partial<
      Pick<
        UserListItem,
        'id' | 'userName' | 'userGender' | 'userPhone' | 'userEmail' | 'status' | 'deptId'
      > &
        Api.Common.CommonSearchParams
    >

    /** 角色列表 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色列表项 */
    interface RoleListItem {
      roleId: number
      roleName: string
      roleCode: string
      description: string
      enabled: boolean
      createTime: string
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleId' | 'roleName' | 'roleCode' | 'description' | 'enabled'> &
        Api.Common.CommonSearchParams & {
          startTime: string | null
          endTime: string | null
        }
    >

    /** 新增/编辑用户（password 新增时必填，编辑时留空表示不修改） */
    interface UserForm {
      userName: string
      password?: string
      nickName?: string
      /** 1 男，2 女 */
      userGender: string
      userPhone: string
      userEmail?: string
      /** 1 在线，2 离线，3 异常，4 注销 */
      status?: string
      /** 角色编码 */
      userRoles: string[]
      /** 所属部门，不传表示不分配 */
      deptId?: number
      /** 岗位 ID */
      postIds: number[]
    }

    /** 新增/编辑角色 */
    type RoleForm = Pick<RoleListItem, 'roleName' | 'roleCode' | 'description' | 'enabled'>

    /** 部门（树形，叶子节点没有 children） */
    interface DeptItem {
      deptId: number
      /** 0 表示一级部门 */
      parentId: number
      deptName: string
      sort: number
      leader?: string
      phone?: string
      email?: string
      enabled: boolean
      createTime: string
      children?: DeptItem[]
    }

    /** 部门搜索参数 */
    type DeptSearchParams = Partial<Pick<DeptItem, 'deptName' | 'enabled'>>

    /** 新增/编辑部门 */
    type DeptForm = Pick<
      DeptItem,
      'parentId' | 'deptName' | 'sort' | 'leader' | 'phone' | 'email' | 'enabled'
    >

    /** 岗位列表 */
    type PostList = Api.Common.PaginatedResponse<PostListItem>

    /** 岗位列表项 */
    interface PostListItem {
      postId: number
      postCode: string
      postName: string
      sort: number
      enabled: boolean
      remark?: string
      /** 适用部门（同时适用其下级部门），为空表示适用全部部门；deptNames 与 deptIds 一一对应 */
      deptIds: number[]
      deptNames: string[]
      createTime: string
    }

    /** 岗位搜索参数 */
    type PostSearchParams = Partial<
      Pick<PostListItem, 'postCode' | 'postName' | 'enabled'> & Api.Common.CommonSearchParams
    >

    /** 新增/编辑岗位 */
    type PostForm = Pick<
      PostListItem,
      'postCode' | 'postName' | 'sort' | 'enabled' | 'remark' | 'deptIds'
    >

    /** 新增/编辑菜单或按钮（字段与菜单弹窗表单一致） */
    interface MenuForm {
      menuType: 'menu' | 'button'
      /** 父级菜单 ID，新增时有效，0 表示一级菜单 */
      parentId?: number
      /** 菜单名称（标题） */
      name: string
      path: string
      /** 路由名称（权限标识） */
      label: string
      component: string
      icon: string
      isEnable: boolean
      sort: number
      keepAlive: boolean
      isHide: boolean
      isHideTab: boolean
      link: string
      isIframe: boolean
      showBadge: boolean
      showTextBadge: string
      fixedTab: boolean
      activePath: string
      isFullPage: boolean
      /** 按钮名称 */
      authName: string
      /** 按钮权限标识 */
      authLabel: string
      authSort: number
    }
  }

  /** 日志管理类型 */
  namespace Log {
    /** 日志级别（从低到高） */
    type Level = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

    /** 日志库（管理视图，含上报 Token） */
    interface Store {
      storeId: number
      /** 日志库编码，上报时用于指定日志库，创建后不可修改 */
      code: string
      name: string
      description: string | null
      /** 保留天数，过期日志自动删除 */
      retentionDays: number
      /** HTTP 上报 Token，请求头 X-Log-Token */
      ingestToken: string
      enabled: boolean
      /** 最近一条日志的时间，没有日志时为 null */
      lastLogTime: string | null
      /** 近 24 小时日志数 */
      recentCount: number | null
      /** 已安装的采集 Agent 数 */
      agentCount: number | null
      /** 其中在线（最近 3 分钟内同步过）的数量 */
      onlineAgentCount: number | null
      /** 归档备份情况 */
      backup: StoreBackup | null
      createTime: string
      updateTime: string
    }

    /** 日志库选项（不含 Token） */
    interface StoreOption {
      storeId: number
      code: string
      name: string
      enabled: boolean
    }

    /** 新增/编辑日志库（code 仅新增时有效） */
    interface StoreForm {
      code: string
      name: string
      description?: string
      retentionDays: number
      enabled: boolean
      /** 归档设置，不传则不修改 */
      backup?: { enabled: boolean; archiveAfterDays: number; keepDays: number }
    }

    /** 日志库的归档备份情况 */
    interface StoreBackup {
      /** 是否开启归档（未设置为 false） */
      enabled: boolean
      archiveAfterDays: number | null
      keepDays: number | null
      /** 已归档天数 */
      archives: number
      archivedBytes: number
      rawBytes: number
      latestDay: string | null
      /** 归档失败、等待重试的天数 */
      failed: number
      /** 已超过保留期、等待归档成功后才删除的天数 */
      pendingDays: number
    }

    /** 一条日志 */
    interface LogRecord {
      /** 字符串形式：ID 超出 JS 安全整数范围 */
      id: string
      storeId: number
      /** 日志时间，精确到毫秒，如 2026-10-23 16:00:00.123 */
      time: string
      /** 采集端给出的行序号（如文件偏移），同一时间的日志按它排序；未提供时为 null */
      seq: number | null
      level: Level
      host: string | null
      source: string | null
      traceId: string | null
      message: string
      /** 附加字段 */
      fields: { [key: string]: unknown } | null
      receivedAt: string
    }

    /** 日志查询参数 */
    interface SearchParams {
      storeId: number
      /** yyyy-MM-dd HH:mm:ss，包含 */
      startTime?: string
      /** yyyy-MM-dd HH:mm:ss，不包含 */
      endTime?: string
      /** 逗号分隔的级别 */
      levels?: string
      keyword?: string
      host?: string
      traceId?: string
      current: number
      size: number
    }

    /** 日志查询结果；levelCounts 为各级别命中数（不受级别筛选影响） */
    interface SearchResult extends Api.Common.PaginatedResponse<LogRecord> {
      levelCounts: { [level: string]: number }
    }
  }

  /** 采集 Agent（Vector）部署 */
  namespace Agent {
    type Platform = 'linux' | 'docker' | 'kubernetes' | 'windows'
    type Transport = 'http' | 'kafka'
    /** 多行合并：不合并 / 异常堆栈 / 以日期开头 / 自定义正则 */
    type Multiline = 'none' | 'stacktrace' | 'timestamp' | 'custom'

    interface Package {
      platform: 'linux' | 'windows'
      arch: string
      /** 下载地址为 /api/agent/download/<file> */
      file: string
    }

    interface Meta {
      version: string
      /** Docker / Kubernetes 使用的镜像 */
      image: string
      packages: Package[]
      /** SHA-256 校验文件名 */
      checksums: string
      /** 后端配置的 Agent 访问地址，为 null 时使用当前页面地址 */
      serverUrl: string | null
      kafka: { enabled: boolean; servers: string; topic: string }
      /** 超过这么多秒没有同步的 Agent 视为离线 */
      onlineSeconds: number
    }

    /** 日志库的采集配置：该日志库的所有 Agent 按它采集，修改后 Agent 在下次同步时自动生效 */
    interface CollectConfig {
      /** Linux 主机与 Docker 宿主机上的日志文件 */
      paths: string[]
      /** Windows 主机上的日志文件 */
      windowsPaths: string[]
      /** Docker：同时采集容器标准输出 */
      containers: boolean
      multiline: Multiline
      multilinePattern?: string | null
      transport: Transport
      kafkaServers?: string | null
      kafkaTopic?: string | null
      /** 主机资源监控 */
      monitor?: MonitorConfig
    }

    /** 主机资源监控：Agent 同时采集宿主机的 CPU、内存、磁盘、网络等指标 */
    interface MonitorConfig {
      enabled: boolean
      /** 采集间隔（秒），5~300 */
      intervalSeconds: number
      /** 上报占用较高的进程 */
      processes: boolean
      /** 上报容器与服务的资源（Linux cgroups） */
      containers: boolean
    }

    interface CollectConfigView extends CollectConfig {
      storeId: number
      /** 最近保存时间；为 null 表示仍是默认配置 */
      updateTime: string | null
    }

    /** synced：已应用当前配置；pending：等待下次同步；invalid：采集配置在该环境下没有可采集的内容 */
    type SyncState = 'synced' | 'pending' | 'invalid'

    /** 已安装并登记的采集 Agent */
    interface Instance {
      agentId: number
      storeId: number
      storeCode: string
      storeName: string
      hostname: string
      platform: Platform
      /** Vector 版本 */
      version: string | null
      ip: string | null
      serverUrl: string | null
      online: boolean
      syncState: SyncState
      /** 版本与 LoggingX 当前安装的版本不同，重新执行安装命令即可升级 */
      outdated: boolean
      lastSeenTime: string | null
      registerTime: string | null
    }
  }

  /** 主机监控 */
  namespace Monitor {
    type Severity = 'warning' | 'critical'
    type AlertMetric = 'cpu' | 'memory' | 'disk' | 'load' | 'offline'

    /** 主机当前状态；速率与 CPU 使用率由最近两次采集计算，未上报的值为 null */
    interface Host {
      storeId: number
      storeCode: string | null
      storeName: string | null
      /** 小写主机名，指标的主键 */
      host: string
      /** Agent 登记的主机名 */
      hostname: string
      agentId: number | null
      platform: Agent.Platform | null
      version: string | null
      ip: string | null
      online: boolean
      lastSeenTime: string | null
      /** 最近一次采集时间（毫秒），近 5 分钟没有上报时为 null */
      sampleTime: number | null
      cpuPercent: number | null
      cpuCores: number | null
      memTotal: number | null
      memUsed: number | null
      memPercent: number | null
      swapTotal: number | null
      swapUsed: number | null
      load1: number | null
      load5: number | null
      load15: number | null
      /** 最满的文件系统使用率 */
      diskMaxPercent: number | null
      diskMaxMount: string | null
      diskReadBps: number | null
      diskWriteBps: number | null
      netRxBps: number | null
      netTxBps: number | null
      /** 开机时长（秒） */
      uptime: number | null
      /** 进行中的告警数 */
      alerts: number
      alertSeverity: Severity | null
    }

    interface SeriesPoint {
      time: number
      cpuPercent: number | null
      memPercent: number | null
      swapPercent: number | null
      load1: number | null
      load5: number | null
      load15: number | null
      diskReadBps: number | null
      diskWriteBps: number | null
      netRxBps: number | null
      netTxBps: number | null
      diskMaxPercent: number | null
    }

    interface Filesystem {
      mountpoint: string
      fsType: string | null
      totalBytes: number
      usedBytes: number
      usedPercent: number
    }

    interface Process {
      pid: number
      name: string
      /** 单核百分比，可超过 100 */
      cpuPercent: number | null
      /** 低于 50MB 时 Agent 不上报，为 null */
      memBytes: number | null
      time: number
    }

    interface Container {
      cgroup: string
      kind: 'docker' | 'kubernetes' | 'service' | 'other'
      name: string
      cpuPercent: number | null
      memBytes: number | null
    }

    interface AlertEvent {
      id: number
      ruleId: number
      ruleName: string
      metric: AlertMetric
      severity: Severity
      threshold: number
      storeId: number
      storeCode: string | null
      storeName: string | null
      host: string
      value: number | null
      peakValue: number | null
      status: 'firing' | 'resolved'
      startedAt: number
      startTime: string
      updateTime: string
      resolveTime: string | null
    }

    interface AlertRule {
      id: number
      name: string
      metric: AlertMetric
      threshold: number
      durationMinutes: number
      severity: Severity
      /** 为 null 时作用于所有日志库 */
      storeId: number | null
      storeName: string | null
      enabled: boolean
      updateTime: string | null
      notification: AlertCenter.RuleNotify
    }

    type AlertRuleForm = Omit<AlertRule, 'id' | 'storeName' | 'updateTime'>
  }

  /** AI 诊断：结合代码库分析错误日志 */
  namespace AiDiagnosis {
    /** auto 新类型错误自动分析，alert 日志告警触发，manual 手动 */
    type Trigger = 'auto' | 'alert' | 'manual'
    type ReviewState = 'open' | 'resolved' | 'ignored'
    type Status = 'pending' | 'running' | 'success' | 'failed'

    interface Settings {
      provider: string | null
      model: string | null
      /** 每天自动分析（新错误、告警）的上限，手动分析不计 */
      dailyLimit: number
      /** 已配置 API Key 的提供方 */
      providers: string[]
      usedToday: number
      notification: AlertCenter.RuleNotify
    }

    interface StoreConfig {
      storeId: number
      storeCode: string
      storeName: string
      storeEnabled: boolean
      repoUrl: string | null
      repoBranch: string | null
      repoUsername: string | null
      tokenSaved: boolean
      autoNew: boolean
      onAlert: boolean
      repoCommit: string | null
      repoSyncTime: string | null
      repoError: string | null
    }

    interface StoreForm {
      repoUrl: string
      repoBranch: string
      repoUsername: string
      /** 只写；留空沿用已保存的令牌 */
      token: string
      autoNew: boolean
      onAlert: boolean
    }

    interface Group {
      id: number
      storeId: number
      storeName: string | null
      errorType: string | null
      /** 出错位置：第一个业务代码栈帧，或日志首行 */
      location: string | null
      sample: string | null
      host: string | null
      occurrences: number
      firstSeen: string
      lastSeen: string
      status: ReviewState
      diagnosisId: number | null
    }

    interface Item {
      id: number
      storeId: number
      storeName: string | null
      groupId: number | null
      triggerType: Trigger
      status: Status
      reviewState: ReviewState
      errorType: string | null
      summary: string | null
      confidence: 'high' | 'medium' | 'low' | null
      host: string | null
      logTime: string | null
      createdBy: string | null
      createTime: string
      finishTime: string | null
      error: string | null
    }

    interface CodeRef {
      path: string
      startLine: number
      /** 堆栈指向的行，0 为未知 */
      focusLine: number
      frame: string
      text: string
    }

    interface Detail {
      item: Item
      alertEventId: number | null
      logText: string
      source: string | null
      repoCommit: string | null
      codeRefs: CodeRef[]
      provider: string | null
      model: string | null
      rootCause: string | null
      suggestion: string | null
      diff: string | null
      promptTokens: number | null
      completionTokens: number | null
    }
  }

  /** AI 运维问答（RAG）与知识库 */
  namespace AiOps {
    interface Knowledge {
      id: number
      title: string
      excerpt: string
      tags: string[]
      /** 为 null 时适用于全部日志库 */
      storeId: number | null
      storeName: string | null
      length: number
      createdBy: string | null
      updateTime: string | null
    }

    interface KnowledgeDetail {
      item: Knowledge
      content: string
    }

    interface KnowledgeForm {
      title: string
      content: string
      tags: string
      storeId: number | null
    }

    /** 回答引用的资料，ref 即回答中的 [n] */
    interface Source {
      ref: number
      type: 'knowledge' | 'diagnosis' | 'group' | 'alert' | 'log' | 'stats' | 'code'
      id: string | null
      storeId: number | null
      storeName: string | null
      title: string
      excerpt: string
      time: string | null
    }

    interface Turn {
      role: 'user' | 'assistant'
      content: string
    }
  }

  /** 顶栏通知 */
  namespace Notice {
    interface Item {
      /** ai 为 AI 诊断，host 为监控告警，log 为日志告警 */
      type: 'ai' | 'host' | 'log'
      id: number
      title: string
      detail: string
      level: 'critical' | 'warning' | 'info'
      time: number
      timeText: string
      unread: boolean
    }

    interface List {
      unread: number
      items: Item[]
    }
  }

  /** 告警中心：日志告警与通知 */
  namespace AlertCenter {
    type Channel = 'email' | 'sms'

    /** 规则的通知方式；channels 为空表示不通知 */
    interface RuleNotify {
      channels: Channel[]
      userIds: number[]
      groupIds: number[]
      notifyResolved: boolean
      /** 告警持续时每隔多少分钟再提醒一次，0 为不重复 */
      repeatMinutes: number
    }

    interface StoreOption {
      id: number
      code: string
      name: string
    }

    /** 可选的通知用户，邮箱与手机号已脱敏 */
    interface UserOption {
      id: number
      username: string
      nickName: string | null
      email: string | null
      phone: string | null
      disabled: boolean
    }

    interface LogRule {
      id: number
      name: string
      storeId: number
      storeName: string | null
      /** 为空表示所有级别 */
      levels: string[]
      keyword: string | null
      host: string | null
      windowMinutes: number
      threshold: number
      severity: Monitor.Severity
      enabled: boolean
      updateTime: string | null
      notification: RuleNotify
    }

    type LogRuleForm = Omit<LogRule, 'id' | 'storeName' | 'updateTime'>

    interface LogEvent {
      id: number
      ruleId: number
      ruleName: string
      storeId: number
      storeCode: string | null
      storeName: string | null
      severity: Monitor.Severity
      threshold: number
      windowMinutes: number
      value: number | null
      peakValue: number | null
      /** 最新一条匹配日志 */
      sample: string | null
      status: 'firing' | 'resolved'
      startedAt: number
      resolvedAt: number | null
      startTime: string
      updateTime: string
      resolveTime: string | null
    }

    interface EmailSettings {
      enabled: boolean
      host: string
      port: number
      security: 'ssl' | 'starttls' | 'none'
      username: string
      /** 只写；留空表示沿用已保存的密码 */
      password?: string | null
      passwordSaved?: boolean
      from: string
      fromName: string
      updatedAt?: string | null
    }

    interface SmsSettings {
      enabled: boolean
      provider: 'aliyun' | 'tencent'
      accessKeyId: string
      /** 只写；留空表示沿用已保存的密钥 */
      secret?: string | null
      secretSaved?: boolean
      signName: string
      templateId: string
      sdkAppId: string
      region: string
      endpoint: string
      updatedAt?: string | null
    }

    interface Channels {
      email: EmailSettings
      sms: SmsSettings
    }

    interface Contact {
      name: string
      email: string
      phone: string
    }

    interface Group {
      id: number
      name: string
      description: string | null
      userIds: number[]
      contacts: Contact[]
      updateTime: string | null
    }

    type GroupForm = Pick<Group, 'name' | 'description' | 'userIds' | 'contacts'>

    interface NotifyRecord {
      id: number
      eventType: 'host' | 'log' | 'ai' | 'test'
      eventId: number | null
      ruleName: string
      kind: 'firing' | 'resolved' | 'repeat' | 'diagnosis' | 'test'
      channel: Channel
      recipient: string
      status: 'success' | 'failed'
      error: string | null
      sendTime: string
    }
  }

  /** 日志备份 */
  namespace Backup {
    /** S3 兼容存储（MinIO / OSS / COS / S3） */
    interface Storage {
      endpoint: string
      region: string
      bucket: string
      /** 对象前缀，可为空 */
      prefix: string
      accessKey: string
      /** 是否已保存 Secret Key（不会返回明文） */
      secretSaved: boolean
      /** 路径风格：endpoint/bucket/key（MinIO 需要） */
      pathStyle: boolean
      updateTime: string | null
    }

    interface StorageForm {
      endpoint: string
      region: string
      bucket: string
      prefix: string
      accessKey: string
      /** 留空表示沿用已保存的 */
      secretKey: string
      pathStyle: boolean
    }

    interface Policy {
      storeId: number
      storeCode: string
      storeName: string
      /** 日志库热数据保留天数 */
      retentionDays: number
      storeEnabled: boolean
      /** 未配置策略时为 null */
      enabled: boolean | null
      archiveAfterDays: number | null
      keepDays: number | null
      archives: number
      archivedBytes: number
      rawBytes: number
      latestDay: string | null
      failed: number
    }

    type RestoreStatus = 'restoring' | 'restored' | 'failed' | 'expired'

    interface Archive {
      id: number
      storeId: number
      storeCode: string
      day: string
      objectKey: string
      recordCount: number
      rawBytes: number
      sizeBytes: number
      sha256: string | null
      status: 'success' | 'failed'
      error: string | null
      archiveTime: string
      restoreStatus: RestoreStatus | null
      restoreError: string | null
      restoreTime: string | null
      restoredUntil: string | null
    }

    interface Status {
      running: boolean
      lastStartTime: string | null
      lastFinishTime: string | null
      archived: number | null
      failed: number | null
      deleted: number | null
      error: string | null
    }
  }

  /** 工作台概览：各部分仅在有对应页面权限时返回，否则为 null */
  namespace Dashboard {
    interface Overview {
      from: number
      to: number
      hours: number
      bucketMillis: number
      logs: Logs | null
      agents: { total: number; online: number } | null
      hosts: Hosts | null
      alerts: Alerts | null
      backup: Backup | null
    }

    interface Logs {
      /** 日志存储是否可用；不可用时各项计数为空 */
      available: boolean
      total: number
      previousTotal: number
      errors: number
      previousErrors: number
      levels: Partial<Record<Log.Level, number>>
      series: { time: number; levels: Partial<Record<Log.Level, number>> }[]
      storeCount: number
      enabledStores: number
      stores: {
        storeId: number
        code: string
        name: string
        enabled: boolean
        total: number
        errors: number
      }[]
      recentErrors: {
        id: string
        storeId: number
        storeName: string | null
        time: string
        level: Log.Level
        host: string | null
        message: string
      }[]
    }

    interface Hosts {
      total: number
      online: number
      /** 有资源数据的主机 */
      monitored: number
      alerting: number
      top: {
        storeId: number
        host: string
        hostname: string
        online: boolean
        cpuPercent: number | null
        memPercent: number | null
        diskMaxPercent: number | null
        alerts: number
      }[]
    }

    interface Alerts {
      firing: number
      critical: number
      items: {
        /** host 为监控告警，log 为日志告警 */
        type: 'host' | 'log'
        id: number
        ruleName: string
        /** 日志告警为 log */
        metric: Monitor.AlertMetric | 'log'
        severity: Monitor.Severity
        storeId: number
        host: string
        value: number | null
        startTime: string
      }[]
    }

    interface Backup {
      configured: boolean
      enabledStores: number
      storeCount: number
      archives: number
      archivedBytes: number
      rawBytes: number
      failed: number
      pendingDays: number
      running: boolean
      lastRunTime: string | null
      lastArchived: number | null
      lastFailed: number | null
      lastError: string | null
    }
  }
}
