<!-- 登录、注册、忘记密码左侧展示区：纯黑底（两种主题一致），产品标语 + 实时日志窗口 + AI 诊断卡片 -->
<template>
  <div class="login-left-view">
    <div class="glow glow--blue"></div>
    <div class="glow glow--violet"></div>
    <div class="grid"></div>

    <header class="brand">
      <LogxLogo size="36" />
      <span>{{ AppConfig.systemInfo.name }}</span>
    </header>

    <div v-if="!hideContent" class="hero">
      <p class="eyebrow">{{ $t('login.leftView.eyebrow') }}</p>
      <h1 class="headline">
        {{ $t('login.leftView.title') }}<br />
        <span>{{ $t('login.leftView.titleAccent') }}</span>
      </h1>
      <p class="lead">{{ $t('login.leftView.subTitle') }}</p>

      <div class="stage">
        <div class="window" aria-hidden="true">
          <div class="window__bar">
            <i></i><i></i><i></i>
            <span>order-service — live tail</span>
          </div>
          <div class="histogram">
            <b
              v-for="(bar, index) in BARS"
              :key="index"
              :class="{ 'is-error': bar.error }"
              :style="{ height: `${bar.height}%`, animationDelay: `${index * 30}ms` }"
            ></b>
          </div>
          <div class="lines">
            <div class="lines__track">
              <div
                v-for="(line, index) in [...LINES, ...LINES]"
                :key="index"
                class="line"
                :class="`line--${line.level.toLowerCase()}`"
              >
                <time>{{ line.time }}</time>
                <em>{{ line.level }}</em>
                <span>{{ line.text }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="toast" aria-hidden="true">
          <span class="toast__icon"><LogxSvgIcon icon="ri:sparkling-2-fill" /></span>
          <div>
            <b>{{ $t('login.leftView.aiTitle') }}</b>
            <p>{{ $t('login.leftView.aiText') }}</p>
          </div>
        </div>
      </div>
    </div>

    <ul v-if="!hideContent" class="points">
      <li><LogxSvgIcon icon="ri:shield-check-line" />{{ $t('login.leftView.point1') }}</li>
      <li><LogxSvgIcon icon="ri:terminal-box-line" />{{ $t('login.leftView.point2') }}</li>
      <li><LogxSvgIcon icon="ri:robot-2-line" />{{ $t('login.leftView.point3') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'

  defineProps<{
    hideContent?: boolean // 是否隐藏内容，只显示 logo
  }>()

  /** 柱状图：最近 24 个时间段的日志量，红色为出现错误的时段 */
  const BARS = [
    38, 46, 41, 55, 49, 62, 58, 44, 51, 67, 73, 88, 95, 71, 60, 52, 57, 49, 63, 70, 58, 54, 61, 66
  ].map((height, index) => ({ height, error: index >= 11 && index <= 13 }))

  const LINES = [
    { time: '14:02:08', level: 'INFO', text: 'POST /api/orders 201 · 38ms' },
    { time: '14:02:09', level: 'INFO', text: 'order-42817 paid via wechat' },
    { time: '14:02:10', level: 'WARN', text: 'HikariPool-1 connection wait 1.2s' },
    { time: '14:02:11', level: 'ERROR', text: 'PaymentClient NullPointerException' },
    { time: '14:02:11', level: 'ERROR', text: 'OrderService submit failed, retrying' },
    { time: '14:02:12', level: 'INFO', text: 'retry ok · order-42817 confirmed' },
    { time: '14:02:13', level: 'INFO', text: 'GET /api/orders/42817 200 · 12ms' },
    { time: '14:02:14', level: 'WARN', text: 'disk /data 82% on node-3' }
  ]
</script>

<style lang="scss" scoped>
  $ease: cubic-bezier(0.28, 0.11, 0.32, 1);
  $mono: ui-monospace, 'SF Mono', sfmono-regular, menlo, consolas, monospace;

  .login-left-view {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex: none;
    flex-direction: column;
    width: 54vw;
    max-width: 1040px;
    height: 100%;
    padding: 36px clamp(40px, 5vw, 88px) 40px;
    overflow: hidden;
    color: #f5f5f7;
    background: #000;
  }

  // 背景：两团柔和的光晕 + 极淡的网格
  .glow {
    position: absolute;
    filter: blur(90px);
    border-radius: 50%;
    opacity: 0.55;
    animation: drift 18s ease-in-out infinite alternate;

    &--blue {
      top: -18%;
      right: -12%;
      width: 60%;
      aspect-ratio: 1;
      background: radial-gradient(circle, #0a84ff 0%, transparent 65%);
    }

    &--violet {
      bottom: -25%;
      left: -15%;
      width: 55%;
      aspect-ratio: 1;
      background: radial-gradient(circle, #5e5ce6 0%, transparent 65%);
      animation-delay: -9s;
    }
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgb(255 255 255 / 4%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(255 255 255 / 4%) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(ellipse at 60% 40%, #000 20%, transparent 75%);
  }

  .brand {
    position: relative;
    z-index: 2;
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .hero {
    position: relative;
    z-index: 2;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    max-width: 640px;
    padding: 24px 0;
  }

  .eyebrow {
    font-size: 15px;
    font-weight: 600;
    color: #f56300;
    animation: rise 0.9s $ease both;
  }

  .headline {
    margin-top: 14px;
    font-size: clamp(40px, 3.9vw, 64px);
    font-weight: 700;
    line-height: 1.08;
    color: #f5f5f7;
    letter-spacing: -0.025em;
    animation: rise 0.9s $ease 0.08s both;

    span {
      color: transparent;
      background: linear-gradient(90deg, #64d2ff 0%, #0a84ff 40%, #bf5af2 100%);
      background-clip: text;
    }
  }

  .lead {
    max-width: 520px;
    margin-top: 18px;
    font-size: 16px;
    line-height: 1.65;
    color: #a1a1a6;
    animation: rise 0.9s $ease 0.16s both;
  }

  // 日志窗口 + AI 卡片
  .stage {
    position: relative;
    margin-top: 40px;
    animation: rise 1s $ease 0.24s both;
  }

  .window {
    overflow: hidden;
    background: rgb(28 28 30 / 82%);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 8%),
      0 30px 80px -20px rgb(0 0 0 / 80%);
  }

  .window__bar {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    height: 38px;
    padding: 0 14px;
    border-bottom: 1px solid rgb(255 255 255 / 6%);

    i {
      width: 11px;
      height: 11px;
      background: #ff5f57;
      border-radius: 50%;

      &:nth-child(2) {
        background: #febc2e;
      }

      &:nth-child(3) {
        background: #28c840;
      }
    }

    span {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-family: $mono;
      font-size: 12px;
      color: #8e8e93;
      pointer-events: none;
    }
  }

  .histogram {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    height: 64px;
    padding: 12px 16px 0;

    b {
      flex: 1;
      background: linear-gradient(180deg, #0a84ff, rgb(10 132 255 / 35%));
      border-radius: 3px 3px 0 0;
      transform-origin: bottom;
      animation: grow 0.9s $ease both;

      &.is-error {
        background: linear-gradient(180deg, #ff453a, rgb(255 69 58 / 40%));
      }
    }
  }

  .lines {
    height: 176px;
    padding: 6px 0;
    overflow: hidden;
    border-top: 1px solid rgb(255 255 255 / 6%);
    mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent);
  }

  .lines__track {
    animation: scroll 16s linear infinite;
  }

  .line {
    display: flex;
    gap: 12px;
    align-items: center;
    height: 30px;
    padding: 0 16px;
    font-family: $mono;
    font-size: 12.5px;
    white-space: nowrap;

    time {
      color: #636366;
    }

    em {
      width: 44px;
      font-style: normal;
      font-weight: 600;
    }

    span {
      overflow: hidden;
      color: #d1d1d6;
      text-overflow: ellipsis;
    }

    &--info em {
      color: #64d2ff;
    }

    &--warn em {
      color: #ffd60a;
    }

    &--error {
      background: rgb(255 69 58 / 12%);

      em {
        color: #ff6961;
      }
    }
  }

  .toast {
    position: absolute;
    right: -24px;
    bottom: -28px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    width: min(340px, 70%);
    padding: 14px 16px;
    color: #1d1d1f;
    background: rgb(255 255 255 / 92%);
    backdrop-filter: saturate(180%) blur(20px);
    border-radius: 16px;
    box-shadow:
      0 24px 60px -18px rgb(0 0 0 / 70%),
      0 0 0 1px rgb(255 255 255 / 30%);
    animation:
      pop 0.8s $ease 1.1s both,
      float 6s ease-in-out 2s infinite;

    b {
      font-size: 14px;
      font-weight: 600;
    }

    p {
      margin-top: 3px;
      font-size: 13px;
      line-height: 1.5;
      color: #424245;
    }
  }

  .toast__icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    font-size: 17px;
    color: #fff;
    background: linear-gradient(135deg, #5e5ce6, #bf5af2);
    border-radius: 10px;
  }

  .points {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 28px;
    padding-top: 22px;
    font-size: 14px;
    color: #a1a1a6;
    border-top: 1px solid rgb(255 255 255 / 10%);
    animation: rise 0.9s $ease 0.4s both;

    li {
      display: flex;
      gap: 8px;
      align-items: center;

      :deep(.logx-svg-icon) {
        font-size: 17px;
        color: #30d158;
      }
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18px);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes grow {
    from {
      transform: scaleY(0.15);
    }

    to {
      transform: scaleY(1);
    }
  }

  @keyframes scroll {
    from {
      transform: translateY(0);
    }

    to {
      transform: translateY(-50%);
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.96);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes float {
    50% {
      transform: translateY(-6px);
    }
  }

  @keyframes drift {
    to {
      transform: translate(-6%, 8%) scale(1.08);
    }
  }

  // 窗口较矮时收起日志窗口，只保留标语
  @media (height <= 760px) {
    .stage {
      display: none;
    }
  }

  @media (width <= 1180px) {
    .login-left-view {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glow,
    .lines__track,
    .toast,
    .histogram b,
    .eyebrow,
    .headline,
    .lead,
    .stage,
    .points {
      animation: none;
    }
  }
</style>
