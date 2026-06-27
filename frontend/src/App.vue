<script setup>
import {
  darkTheme,
} from 'naive-ui'
import { computed, onMounted, watchEffect } from 'vue'
import { useScript } from '@unhead/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from './store'
import { useIsMobile } from './utils/composables'
import Header from './views/Header.vue';
import Footer from './views/Footer.vue';
import { api } from './api'
import { getNaiveLocaleConfig } from './i18n/naive-locale'
import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/utils'

const {
  isDark, loading, useSideMargin, telegramApp, isTelegram
} = useGlobalState()
const adClient = import.meta.env.VITE_GOOGLE_AD_CLIENT;
const adSlot = import.meta.env.VITE_GOOGLE_AD_SLOT;
const { locale } = useI18n({ useScope: 'global' });
const theme = computed(() => isDark.value ? darkTheme : null)
const themeOverrides = computed(() => {
  const common = isDark.value
    ? {
        bodyColor: '#050505',
        cardColor: '#10100f',
        modalColor: '#10100f',
        popoverColor: '#10100f',
        tableColor: '#10100f',
        borderColor: 'rgba(242, 242, 239, 0.14)',
        dividerColor: 'rgba(242, 242, 239, 0.14)',
        inputColor: '#10100f',
        textColorBase: '#f2f2ef',
        textColor1: '#f2f2ef',
        textColor2: '#a7a7a1',
        textColor3: '#73736e',
        placeholderColor: '#73736e',
        primaryColor: '#d8ff3e',
        primaryColorHover: '#d8ff3e',
        primaryColorPressed: '#d8ff3e',
        primaryColorSuppl: '#d8ff3e',
        infoColor: '#d8ff3e',
        infoColorHover: '#d8ff3e',
        infoColorPressed: '#d8ff3e',
        infoColorSuppl: '#d8ff3e',
      }
    : {
        bodyColor: '#f1f0ec',
        cardColor: '#e6e3dc',
        modalColor: '#f1f0ec',
        popoverColor: '#f1f0ec',
        tableColor: '#f1f0ec',
        borderColor: '#c9c5bc',
        dividerColor: '#c9c5bc',
        inputColor: '#e6e3dc',
        textColorBase: '#111111',
        textColor1: '#111111',
        textColor2: '#6e6c66',
        textColor3: '#918f88',
        placeholderColor: '#918f88',
        primaryColor: '#111111',
        primaryColorHover: '#111111',
        primaryColorPressed: '#111111',
        primaryColorSuppl: '#111111',
        infoColor: '#111111',
        infoColorHover: '#111111',
        infoColorPressed: '#111111',
        infoColorSuppl: '#111111',
      };

  return {
    common,
    Card: {
      color: isDark.value ? '#10100f' : '#e6e3dc',
      colorEmbedded: isDark.value ? '#10100f' : '#e6e3dc',
      borderColor: common.borderColor,
      borderRadius: '0px',
      textColor: common.textColor1,
      titleTextColor: common.textColor1,
    },
    Button: {
      borderRadiusTiny: '0px',
      borderRadiusSmall: '0px',
      borderRadiusMedium: '0px',
      borderRadiusLarge: '0px',
      textColorPrimary: isDark.value ? '#f2f2ef' : '#111111',
      textColorHoverPrimary: isDark.value ? '#f2f2ef' : '#111111',
      textColorPressedPrimary: isDark.value ? '#f2f2ef' : '#111111',
      textColorFocusPrimary: isDark.value ? '#f2f2ef' : '#111111',
      colorPrimary: isDark.value ? '#171814' : '#e6e3dc',
      colorHoverPrimary: isDark.value ? '#1d1f19' : '#dedbd3',
      colorPressedPrimary: isDark.value ? '#11120f' : '#d6d1c7',
      colorFocusPrimary: isDark.value ? '#1d1f19' : '#dedbd3',
      borderPrimary: isDark.value ? '1px solid rgba(242, 242, 239, 0.16)' : '1px solid #111111',
      borderHoverPrimary: isDark.value ? '1px solid rgba(242, 242, 239, 0.22)' : '1px solid #111111',
      borderPressedPrimary: isDark.value ? '1px solid rgba(242, 242, 239, 0.16)' : '1px solid #111111',
      borderFocusPrimary: isDark.value ? '1px solid rgba(242, 242, 239, 0.22)' : '1px solid #111111',
      textColorInfo: isDark.value ? '#f2f2ef' : '#111111',
      textColorHoverInfo: isDark.value ? '#f2f2ef' : '#111111',
      textColorPressedInfo: isDark.value ? '#f2f2ef' : '#111111',
      textColorFocusInfo: isDark.value ? '#f2f2ef' : '#111111',
      colorInfo: isDark.value ? '#171814' : '#e6e3dc',
      colorHoverInfo: isDark.value ? '#1d1f19' : '#dedbd3',
      colorPressedInfo: isDark.value ? '#11120f' : '#d4d0c6',
      colorFocusInfo: isDark.value ? '#1d1f19' : '#dedbd3',
      borderInfo: isDark.value ? '1px solid rgba(242, 242, 239, 0.16)' : '1px solid #c9c5bc',
      borderHoverInfo: isDark.value ? '1px solid rgba(242, 242, 239, 0.22)' : '1px solid #bdb8ae',
      borderPressedInfo: isDark.value ? '1px solid rgba(242, 242, 239, 0.16)' : '1px solid #c9c5bc',
      borderFocusInfo: isDark.value ? '1px solid rgba(242, 242, 239, 0.22)' : '1px solid #bdb8ae',
      textColorTextPrimary: common.textColor1,
      textColorTextHoverPrimary: common.textColor1,
      textColorTextPressedPrimary: common.textColor1,
      textColorTextFocusPrimary: common.textColor1,
      textColorGhostPrimary: common.textColor1,
      textColorGhostHoverPrimary: common.textColor1,
      textColorGhostPressedPrimary: common.textColor1,
      textColorGhostFocusPrimary: common.textColor1,
    },
    Input: {
      borderRadius: '0px',
      color: isDark.value ? '#10100f' : '#e6e3dc',
      colorFocus: isDark.value ? '#10100f' : '#e6e3dc',
      colorDisabled: isDark.value ? '#10100f' : '#e6e3dc',
      border: `1px solid ${common.borderColor}`,
      borderFocus: `1px solid ${common.textColor1}`,
      boxShadowFocus: 'none',
      textColor: common.textColor1,
      placeholderColor: common.textColor3,
    },
    Select: {
      peers: {
        InternalSelection: {
          borderRadius: '0px',
          color: isDark.value ? '#10100f' : '#e6e3dc',
          textColor: common.textColor1,
        },
      },
    },
    Tabs: {
      tabTextColorActiveLine: common.textColor1,
      tabTextColorLine: common.textColor2,
      tabTextColorHoverLine: common.textColor1,
      barColor: '#d8ff3e',
    },
    Tag: {
      borderRadius: '0px',
      color: isDark.value ? '#151513' : '#e6e3dc',
      textColor: common.textColor2,
      border: `1px solid ${common.borderColor}`,
    },
    Alert: {
      color: isDark.value ? 'rgba(242, 242, 239, 0.04)' : '#ece8e1',
      border: `1px solid ${common.borderColor}`,
      titleTextColor: common.textColor1,
      textColor: common.textColor2,
    },
    DataTable: {
      tdColor: isDark.value ? '#10100f' : '#f1f0ec',
      thColor: isDark.value ? '#10100f' : '#f1f0ec',
      borderColor: common.borderColor,
    },
    Modal: {
      color: isDark.value ? '#10100f' : '#f1f0ec',
    },
  };
})
const localeConfig = computed(() => getNaiveLocaleConfig(isSupportedLocale(locale.value) ? locale.value : DEFAULT_LOCALE))
const isMobile = useIsMobile()
const showSideMargin = computed(() => !isMobile.value && useSideMargin.value);
const showAd = computed(() => !isMobile.value && adClient && adSlot);
const gridMaxCols = computed(() => showAd.value ? 8 : 12);

watchEffect(() => {
  if (typeof document === 'undefined') return
  document.documentElement.lang = isSupportedLocale(locale.value) ? locale.value : DEFAULT_LOCALE
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
})

// Load Google Ad script at top level (not inside onMounted)
if (showAd.value) {
  useScript({
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`,
    async: true,
    crossorigin: "anonymous",
  })
}

onMounted(async () => {
  try {
    await api.getUserSettings();
  } catch (error) {
    console.error(error);
  }

  const token = import.meta.env.VITE_CF_WEB_ANALY_TOKEN;

  const exist = document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]') !== null
  if (token && !exist) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.dataset.cfBeacon = `{ token: ${token} }`;
    document.body.appendChild(script);
  }

  // check if google ad is enabled
  if (showAd.value) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }


  // check if telegram is enabled
  const enableTelegram = import.meta.env.VITE_IS_TELEGRAM;
  if (
    (typeof enableTelegram === 'boolean' && enableTelegram === true)
    ||
    (typeof enableTelegram === 'string' && enableTelegram === 'true')
  ) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    telegramApp.value = window.Telegram?.WebApp || {};
    isTelegram.value = !!window.Telegram?.WebApp?.initData;
  }
});
</script>

<template>
  <n-config-provider :locale="localeConfig.locale" :date-locale="localeConfig.dateLocale" :theme="theme" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-spin description="loading..." :show="loading">
      <n-notification-provider container-style="margin-top: 60px;">
        <n-message-provider container-style="margin-top: 20px;">
          <n-grid x-gap="12" :cols="gridMaxCols">
            <n-gi v-if="showSideMargin" span="1">
              <div class="side" v-if="showAd">
                <ins class="adsbygoogle" style="display:block" :data-ad-client="adClient" :data-ad-slot="adSlot"
                  data-ad-format="auto" data-full-width-responsive="true"></ins>
              </div>
            </n-gi>
            <n-gi :span="!showSideMargin ? gridMaxCols : (gridMaxCols - 2)">
              <div class="main">
                <n-space vertical>
                  <n-layout class="app-layout">
                    <Header />
                    <router-view></router-view>
                  </n-layout>
                  <Footer />
                </n-space>
              </div>
            </n-gi>
            <n-gi v-if="showSideMargin" span="1">
              <div class="side" v-if="showAd">
                <ins class="adsbygoogle" style="display:block" :data-ad-client="adClient" :data-ad-slot="adSlot"
                  data-ad-format="auto" data-full-width-responsive="true"></ins>
              </div>
            </n-gi>
          </n-grid>
          <n-back-top />
        </n-message-provider>
      </n-notification-provider>
    </n-spin>
  </n-config-provider>
</template>


<style>
:root {
  --paper: #f1f0ec;
  --field: #e6e3dc;
  --ink: #111111;
  --muted: #6e6c66;
  --quiet: #918f88;
  --line: #c9c5bc;
  --line-strong: #1c1c1c;
  --panel: rgba(241, 240, 236, 0.9);
  --panel-strong: rgba(230, 227, 220, 0.96);
  --signal: #d8ff3e;
  --signal-soft: rgba(216, 255, 62, 0.22);
  --proof: #d63a2f;
}

html[data-theme="dark"] {
  --paper: #050505;
  --field: #10100f;
  --ink: #f2f2ef;
  --muted: #a7a7a1;
  --quiet: #73736e;
  --line: rgba(242, 242, 239, 0.14);
  --line-strong: rgba(242, 242, 239, 0.28);
  --panel: rgba(16, 16, 15, 0.92);
  --panel-strong: rgba(16, 16, 15, 0.98);
  --signal: #d8ff3e;
  --signal-soft: rgba(216, 255, 62, 0.16);
  --proof: #ff5d50;
}

html,
body,
#app {
  min-height: 100%;
  background: var(--paper);
  color: var(--ink);
}

body {
  margin: 0;
  font-family: Inter, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--ink) 4%, transparent) 1px, transparent 1px),
    linear-gradient(180deg, color-mix(in srgb, var(--ink) 4%, transparent) 1px, transparent 1px),
    var(--paper);
  background-size: 48px 48px, 48px 48px, auto;
}

html[data-theme="dark"] body {
  background:
    linear-gradient(90deg, rgba(242, 242, 239, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(242, 242, 239, 0.03) 1px, transparent 1px),
    radial-gradient(circle at 42% 0%, rgba(242, 242, 239, 0.07), transparent 28rem),
    var(--paper);
  background-size: 84px 84px, 84px 84px, auto, auto;
}

a {
  color: inherit;
}

.n-switch {
  margin-left: 10px;
  margin-right: 10px;
}

@media (hover: none) and (pointer: coarse) and (max-width: 1024px) {
  :where(input, textarea, select, [contenteditable="true"]) {
    font-size: 16px !important;
  }

  :where(.n-input, .n-input-number, .n-base-selection, .n-input-group-label) {
    --n-font-size: 16px !important;
  }
}
</style>

<style scoped>
.app-layout {
  min-height: 0;
}

.side {
  height: 100vh;
}

.main {
  min-height: 0;
  text-align: left;
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 0 12px 12px;
}

.n-grid {
  height: 100%;
}

.n-gi {
  height: 100%;
}

.n-space {
  height: 100%;
}

:deep(.n-layout) {
  background: transparent;
}

:deep(.n-card) {
  border-radius: 0;
  border: 1px solid var(--line);
  background: var(--panel-strong);
}

:deep(.n-button) {
  border-radius: 0;
  min-height: 36px;
  letter-spacing: 0;
}

html[data-theme="dark"] :deep(.n-button--primary-type),
html[data-theme="dark"] :deep(.n-button--info-type) {
  box-shadow: inset 2px 0 0 var(--signal);
}

html[data-theme="dark"] :deep(.n-button--secondary-type),
html[data-theme="dark"] :deep(.n-button--tertiary-type),
html[data-theme="dark"] :deep(.n-button--quaternary-type) {
  color: var(--ink);
}

html[data-theme="dark"] :deep(.n-button:hover) {
  background-image: linear-gradient(90deg, rgba(216, 255, 62, 0.08), transparent 35%);
}

:deep(.n-input),
:deep(.n-input-group-label),
:deep(.n-base-selection),
:deep(.n-tag) {
  border-radius: 0;
}

:deep(.n-layout-header),
:deep(.n-layout-content),
:deep(.n-drawer-content),
:deep(.n-modal),
:deep(.n-page-header),
:deep(.n-alert),
:deep(.n-data-table),
:deep(.n-data-table th),
:deep(.n-data-table td),
:deep(.n-tabs-nav),
:deep(.n-menu) {
  background: transparent;
  color: var(--ink);
}

:deep(.n-page-header .n-page-header__title),
:deep(.n-page-header .n-page-header__extra) {
  color: var(--ink);
}

html[data-theme="dark"] :deep(.n-tag) {
  background: rgba(242, 242, 239, 0.04);
  color: var(--muted);
  border-color: rgba(242, 242, 239, 0.12);
}

html[data-theme="dark"] :deep(.n-data-table th) {
  color: var(--muted);
}

html[data-theme="dark"] :deep(.n-tabs-nav-scroll-content) {
  border-bottom: 1px solid var(--line);
}

html[data-theme="dark"] :deep(.n-alert) {
  background: rgba(242, 242, 239, 0.04);
}
</style>
