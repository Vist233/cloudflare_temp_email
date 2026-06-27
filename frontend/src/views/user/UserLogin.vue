<script setup>
import { computed, ref } from "vue";
import { useMessage } from 'naive-ui'
import { useScopedI18n } from '@/i18n/app'
import { KeyFilled, OpenInNewFilled } from '@vicons/material'
import { startAuthentication } from '@simplewebauthn/browser';

import { api } from '../../api';
import { useGlobalState } from '../../store'
import { hashPassword } from '../../utils';

import Turnstile from '../../components/Turnstile.vue';

const {
    userJwt, userOpenSettings, openSettings,
    userOauth2SessionState, userOauth2SessionClientID
} = useGlobalState()
const message = useMessage();

const { t, locale } = useScopedI18n('views.user.UserLogin')

const tabValue = ref("signin");
const user = ref({
    email: "",
    password: "",
});
const loginCfToken = ref("")
const loginTurnstileRef = ref(null)

const useExternalAuth = computed(() => !!userOpenSettings.value.useExternalAuth)
const signUpUrl = computed(() => userOpenSettings.value.signUpUrl || "")
const forgotPasswordUrl = computed(() => userOpenSettings.value.forgotPasswordUrl || "")
const hostedAuthHelpText = computed(() => {
    if (locale.value === 'zh') {
        return '注册和密码找回统一通过认证中心处理。tmpmail 这里只保留登录与地址使用入口。';
    }
    return 'Registration and password recovery are handled by the unified auth service. tmpmail keeps only the login and mailbox entry flow here.';
})

const openHostedAuthPage = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
};

const emailLogin = async () => {
    if (!user.value.email || !user.value.password) {
        message.error(t('pleaseInput'));
        return;
    }
    try {
        const res = await api.fetch(`/user_api/login`, {
            method: "POST",
            body: JSON.stringify({
                email: user.value.email,
                password: useExternalAuth.value ? user.value.password : await hashPassword(user.value.password),
                cf_token: loginCfToken.value
            })
        });
        userJwt.value = res.jwt;
        location.reload();
    } catch (error) {
        message.error(error.message || "login failed");
        loginTurnstileRef.value?.refresh?.();
    }
};

const passkeyLogin = async () => {
    try {
        const options = await api.fetch(`/user_api/passkey/authenticate_request`, {
            method: 'POST',
            body: JSON.stringify({
                domain: location.hostname,
            })
        })
        const credential = await startAuthentication({ optionsJSON: options })

        const res = await api.fetch(`/user_api/passkey/authenticate_response`, {
            method: 'POST',
            body: JSON.stringify({
                origin: location.origin,
                domain: location.hostname,
                credential
            })
        })
        userJwt.value = res.jwt;
        location.reload();
    } catch (e) {
        console.error(e)
        message.error(e.message)
    }
};

const oauth2Login = async (clientID) => {
    try {
        userOauth2SessionClientID.value = clientID;
        userOauth2SessionState.value = Math.random().toString(36).substring(2);
        const res = await api.fetch(`/user_api/oauth2/login_url?clientID=${clientID}&state=${userOauth2SessionState.value}`);
        location.href = res.url;
    } catch (error) {
        message.error(error.message || "login failed");
    }
};
</script>

<template>
    <div class="center">
        <div v-if="userOpenSettings.fetched" class="login-shell">
            <n-radio-group v-model:value="tabValue" class="login-mode" name="user-login-mode">
                <n-radio-button value="signin">{{ t('login') }}</n-radio-button>
                <n-radio-button v-if="useExternalAuth" value="signup">{{ t('register') }}</n-radio-button>
            </n-radio-group>
            <section v-if="tabValue === 'signin'" class="login-section">
                <n-form>
                    <n-form-item-row :label="t('email')" required>
                        <n-input v-model:value="user.email" />
                    </n-form-item-row>
                    <n-form-item-row :label="t('password')" required>
                        <n-input v-model:value="user.password" type="password" show-password-on="click"
                            @keyup.enter="emailLogin" />
                    </n-form-item-row>
                    <Turnstile ref="loginTurnstileRef" v-if="openSettings.enableGlobalTurnstileCheck" v-model:value="loginCfToken" />
                    <n-button @click="emailLogin" type="primary" block strong :round="false" class="cta-button cta-button--primary">
                        {{ t('login') }}
                    </n-button>
                    <div class="aux-actions" v-if="useExternalAuth">
                        <n-button v-if="signUpUrl" @click="openHostedAuthPage(signUpUrl)" block secondary :round="false" class="cta-button cta-button--secondary">
                            <template #icon>
                                <n-icon :component="OpenInNewFilled" />
                            </template>
                            {{ t('register') }}
                        </n-button>
                        <n-button v-if="forgotPasswordUrl" @click="openHostedAuthPage(forgotPasswordUrl)" block tertiary :round="false" class="cta-button cta-button--ghost">
                            {{ t('forgotPassword') }}
                        </n-button>
                    </div>
                    <template v-else>
                        <n-divider />
                        <n-button @click="passkeyLogin" type="primary" block secondary strong class="cta-button cta-button--secondary">
                            <template #icon>
                                <n-icon :component="KeyFilled" />
                            </template>
                            {{ t('loginWithPasskey') }}
                        </n-button>
                        <n-button @click="oauth2Login(item.clientID)" v-for="item in userOpenSettings.oauth2ClientIDs"
                            :key="item.clientID" block secondary strong class="cta-button cta-button--secondary">
                            <template #icon v-if="item.icon">
                                <span class="oauth2-icon" v-html="item.icon"></span>
                            </template>
                            {{ t('loginWith', { provider: item.name }) }}
                        </n-button>
                    </template>
                </n-form>
            </section>
            <section v-else-if="useExternalAuth" class="login-section">
                <n-space vertical :size="16">
                    <n-alert :show-icon="false" :bordered="false" class="register-note">
                        {{ hostedAuthHelpText }}
                    </n-alert>
                    <n-button v-if="signUpUrl" @click="openHostedAuthPage(signUpUrl)" type="primary" block strong :round="false" class="cta-button cta-button--primary">
                        <template #icon>
                            <n-icon :component="OpenInNewFilled" />
                        </template>
                        {{ t('register') }}
                    </n-button>
                    <n-button v-if="forgotPasswordUrl" @click="openHostedAuthPage(forgotPasswordUrl)" block secondary :round="false" class="cta-button cta-button--secondary">
                        {{ t('forgotPassword') }}
                    </n-button>
                </n-space>
            </section>
        </div>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    justify-content: center;
    width: 100%;
}

.login-shell {
    width: min(100%, 680px);
    display: grid;
    gap: 16px;
    text-align: left;
}

.login-mode {
    width: fit-content;
    max-width: 100%;
    padding: 4px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--field) 88%, transparent);
}

.login-mode :deep(.n-radio-group__splitor) {
    display: none;
}

.login-mode :deep(.n-radio-button__state-border),
.login-mode :deep(.n-radio-button__state-border-left) {
    display: none;
}

.login-mode :deep(.n-radio-button__button) {
    border: 0;
    min-height: 34px;
    color: var(--muted);
    background: transparent;
}

.login-mode :deep(.n-radio-button--checked .n-radio-button__button) {
    color: var(--ink);
    background: color-mix(in srgb, var(--signal) 12%, var(--field));
    box-shadow: inset 2px 0 0 var(--signal);
}

.login-section {
    display: grid;
    gap: 12px;
}

.login-section :deep(.n-form) {
    text-align: left;
}

.aux-actions {
    margin-top: 8px;
    display: grid;
    gap: 10px;
}

.oauth2-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
}

.oauth2-icon :deep(svg) {
    width: 100%;
    height: 100%;
}

.cta-button {
    justify-content: flex-start;
    min-height: 42px;
    font-weight: 600;
}

.cta-button--primary {
    box-shadow: inset 2px 0 0 var(--signal);
    color: var(--ink);
}

.cta-button--secondary {
    background: color-mix(in srgb, var(--field) 92%, transparent);
    color: var(--ink);
}

.cta-button--ghost {
    background: transparent;
    color: var(--muted);
}

.register-note {
    line-height: 1.6;
}

html[data-theme="dark"] .login-mode {
    background: rgba(242, 242, 239, 0.03);
}

html[data-theme="dark"] .login-mode :deep(.n-radio-button.n-radio-button--checked .n-radio-button__button) {
    background: rgba(242, 242, 239, 0.05) !important;
    color: var(--ink) !important;
    box-shadow: inset 2px 0 0 var(--signal) !important;
}

html[data-theme="dark"] .cta-button--secondary {
    background: rgba(242, 242, 239, 0.04);
}

html[data-theme="dark"] .cta-button--ghost {
    color: var(--muted);
}
</style>
