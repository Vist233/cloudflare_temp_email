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

const { t } = useScopedI18n('views.user.UserLogin')

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
        <n-tabs v-model:value="tabValue" size="large" v-if="userOpenSettings.fetched" justify-content="space-evenly">
            <n-tab-pane name="signin" :tab="t('login')">
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
            </n-tab-pane>
            <n-tab-pane v-if="useExternalAuth" name="signup" :tab="t('register')">
                <n-space vertical :size="16">
                    <n-alert :show-icon="false" :bordered="false">
                        tmpmail users sign up and recover passwords through the unified auth service.
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
            </n-tab-pane>
        </n-tabs>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
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
}

.cta-button--primary {
    box-shadow: inset 2px 0 0 var(--signal);
}

.cta-button--secondary {
    background: color-mix(in srgb, var(--field) 92%, transparent);
}

.cta-button--ghost {
    background: transparent;
}
</style>
