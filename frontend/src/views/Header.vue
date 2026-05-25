<script setup>
import { ref, h, computed, onMounted } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import {
    DarkModeFilled, LightModeFilled, MenuFilled,
    AdminPanelSettingsFilled, MonitorHeartFilled
} from '@vicons/material'
import { Language, User, Home } from '@vicons/fa'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang, hashPassword } from '../utils'
import { DEFAULT_LOCALE, isSupportedLocale, replaceLocaleInFullPath } from '../i18n/utils'
import Turnstile from '../components/Turnstile.vue'
import { NButton, NIcon } from 'naive-ui'

const message = useMessage()
const notification = useNotification()

const {
    toggleDark, isDark, isTelegram, showAdminPage,
    showAuth, auth, loading, openSettings, preferredLocale, userSettings
} = useGlobalState()
const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()

const showMobileMenu = ref(false)
const menuValue = computed(() => {
    if (route.path.includes("user")) return "user";
    if (route.path.includes("admin")) return "admin";
    return "home";
});

const cfToken = ref('')
const turnstileRef = ref(null)

const authFunc = async () => {
    try {
        await api.fetch('/open_api/site_login', {
            method: 'POST',
            body: JSON.stringify({
                password: await hashPassword(auth.value),
                cf_token: cfToken.value
            })
        });
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
        turnstileRef.value?.refresh?.();
    }
}

const { t, locale } = useScopedI18n('views.Header')
const toggledLocale = computed(() => locale.value === 'zh' ? 'en' : 'zh')
const toggledLocaleLabel = computed(() => locale.value === 'zh' ? 'ENG' : '中文')

const changeLocale = async (lang) => {
    if (!isSupportedLocale(lang)) {
        return;
    }

    const currentFullPath = route.fullPath;
    const normalizedLang = lang === 'zh' ? 'zh' : 'en'
    const targetFullPath = replaceLocaleInFullPath(currentFullPath, normalizedLang);

    if (normalizedLang === locale.value && targetFullPath === currentFullPath) {
        showMobileMenu.value = false;
        return;
    }

    if (normalizedLang === DEFAULT_LOCALE) {
        preferredLocale.value = DEFAULT_LOCALE;
    }

    let localeSwitched = false;
    try {
        await router.push({ path: targetFullPath, force: true });
        localeSwitched = router.currentRoute.value.fullPath === targetFullPath;
        if (!localeSwitched) {
            await router.replace({ path: targetFullPath, force: true });
            localeSwitched = router.currentRoute.value.fullPath === targetFullPath;
        }
    } catch (error) {
        console.error('Failed to switch locale', error);
    } finally {
        showMobileMenu.value = false;
    }

    if (localeSwitched) preferredLocale.value = normalizedLang;
}

const menuOptions = computed(() => [
    {
        label: () => h(NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "home" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    await router.push(getRouterPathWithLang('/', locale.value));
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => t('home'),
                icon: () => h(NIcon, { component: Home })
            }),
        key: "home"
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "user" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    await router.push(getRouterPathWithLang("/user", locale.value));
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => t('user'),
                icon: () => h(NIcon, { component: User }),
            }
        ),
        key: "user",
        show: !isTelegram.value
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "admin" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    loading.value = true;
                    await router.push(getRouterPathWithLang('/admin', locale.value));
                    loading.value = false;
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => "Admin",
                icon: () => h(NIcon, { component: AdminPanelSettingsFilled }),
            }
        ),
        show: showAdminPage.value,
        key: "admin"
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => { toggleDark(); showMobileMenu.value = false; }
            },
            {
                default: () => isDark.value ? t('light') : t('dark'),
                icon: () => h(
                    NIcon, { component: isDark.value ? LightModeFilled : DarkModeFilled }
                )
            }
        ),
        key: "theme"
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                style: "width: 100%",
                tag: "a",
                target: "_blank",
                href: openSettings.value?.statusUrl,
            },
            {
                default: () => t('status'),
                icon: () => h(NIcon, { component: MonitorHeartFilled })
            }
        ),
        show: !!openSettings.value?.statusUrl,
        key: "status"
    }
]);

useHead({
    title: () => openSettings.value.title || t('title'),
    meta: [
        { name: "description", content: openSettings.value.description || t('title') },
    ]
});

const logoClickCount = ref(0);
const logoClick = async () => {
    if (route.path.includes("admin")) {
        logoClickCount.value = 0;
        return;
    }
    if (logoClickCount.value >= 5) {
        logoClickCount.value = 0;
        message.info("Change to admin Page");
        loading.value = true;
        await router.push(getRouterPathWithLang('/admin', locale.value));
        loading.value = false;
    } else {
        logoClickCount.value++;
    }
    if (logoClickCount.value > 0) {
        message.info(`Click ${5 - logoClickCount.value + 1} times to enter the admin page`);
    }
}

onMounted(async () => {
    await api.getOpenSettings(message, notification);
    // make sure user_id is fetched
    if (!userSettings.value.user_id) await api.getUserSettings(message);
});
</script>

<template>
    <div class="header-shell">
        <n-page-header class="page-header">
            <template #title>
                <div class="header-title">
                    <h3>TMPMAIL</h3>
                </div>
            </template>
            <template #avatar>
                <div @click="logoClick" class="header-avatar">
                    <n-avatar style="margin-left: 10px;" src="/logo.png" :round="false" />
                </div>
            </template>
            <template #extra>
                <n-space align="center" class="header-extra">
                    <n-menu v-if="!isMobile" mode="horizontal" :options="menuOptions" responsive />
                    <n-button v-else :text="true" @click="showMobileMenu = !showMobileMenu">
                        <template #icon>
                            <n-icon :component="MenuFilled" />
                        </template>
                        {{ t('menu') }}
                    </n-button>
                    <n-button v-if="!isMobile" text size="small" class="header-locale-button" style="padding: 0 10px;"
                        @click="changeLocale(toggledLocale)">
                        <template #icon>
                            <n-icon :component="Language" />
                        </template>
                        {{ toggledLocaleLabel }}
                    </n-button>
                </n-space>
            </template>
        </n-page-header>
        <n-drawer v-model:show="showMobileMenu" placement="top" style="height: 100vh;">
            <n-drawer-content :title="t('menu')" closable>
                <n-menu :options="menuOptions" />
                <div class="mobile-menu-actions">
                    <button type="button" class="mobile-menu-utility-button" @click="changeLocale(toggledLocale)">
                        <n-icon :component="Language" />
                        <span class="mobile-menu-action-label">{{ toggledLocaleLabel }}</span>
                    </button>
                </div>
            </n-drawer-content>
        </n-drawer>
        <n-modal v-model:show="showAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
            :title="t('accessHeader')">
            <p>{{ t('accessTip') }}</p>
            <n-input v-model:value="auth" type="password" show-password-on="click" @keyup.enter="authFunc" />
            <Turnstile ref="turnstileRef" v-if="openSettings.enableGlobalTurnstileCheck" v-model:value="cfToken" />
            <template #action>
                <n-button :loading="loading" @click="authFunc" type="primary">
                    {{ t('ok') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.header-shell {
    padding: 10px 0 4px;
}

.page-header {
    border-bottom: 1px solid var(--line-strong);
    padding-bottom: 10px;
}

.header-title {
    display: flex;
    align-items: center;
}

:deep(.n-page-header-header__title h3) {
    margin: 0;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: 0.08em;
}

.n-layout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-extra {
    align-items: center;
    flex-wrap: nowrap;
}

.header-extra :deep(.n-space-item) {
    display: flex;
    align-items: center;
}

.header-locale-button {
    display: inline-flex;
    align-items: center;
}

.header-locale-button :deep(.n-button__content) {
    display: inline-flex;
    align-items: center;
}

.header-locale-button :deep(.n-icon) {
    display: inline-flex;
    align-items: center;
}

.header-version-button {
    display: inline-flex;
    align-items: center;
}

.header-version-button :deep(.n-button__content) {
    display: inline-flex;
    align-items: center;
}

.mobile-menu-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

.mobile-menu-utility-button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    width: 100%;
    min-width: 0;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: none;
    opacity: 0.82;
    cursor: pointer;
}

.mobile-menu-action-label {
    margin: 0 6px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mobile-menu-action-arrow {
    flex: 0 0 auto;
    margin-left: 2px;
}

.header-avatar :deep(.n-avatar) {
    margin-left: 10px;
    border: 1px solid var(--line);
    background: var(--panel);
}

.header-extra :deep(.n-menu .n-menu-item-content) {
    border-radius: 0;
}

.header-extra :deep(.n-button),
.header-extra :deep(.n-menu-item-content),
.mobile-menu-utility-button {
    color: var(--ink);
}

.n-alert {
    margin-top: 10px;
    margin-bottom: 10px;
    text-align: center;
}

.n-card {
    margin-top: 10px;
}

.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
    margin: 20px;
}

.n-form .n-button {
    margin-top: 10px;
}

@media (max-width: 640px) {
    :deep(.n-page-header__title) {
        min-width: 0;
    }

    :deep(.n-page-header__title h3) {
        max-width: calc(100vw - 156px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}
</style>
