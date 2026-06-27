<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { NewLabelOutlined, EmailOutlined } from '@vicons/material'

import Turnstile from '../../components/Turnstile.vue'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang, hashPassword } from '../../utils'

const props = defineProps({
    bindUserAddress: {
        type: Function,
        default: async () => { await api.bindUserAddress(); },
        required: true
    },
    newAddressPath: {
        type: Function,
        default: async (address_name, domain, cf_token, enableRandomSubdomain) => {
            return await api.fetch("/api/new_address", {
                method: "POST",
                body: JSON.stringify({
                    name: address_name,
                    domain: domain,
                    cf_token: cf_token,
                    enableRandomSubdomain: enableRandomSubdomain,
                }),
            });
        },
        required: true
    },
})

const message = useMessage()
const notification = useNotification()
const router = useRouter()

const {
    jwt, loading, openSettings,
    showAddressCredential, userSettings, addressPassword
} = useGlobalState()

const tabValue = ref('signin')
const credential = ref('')
const emailName = ref("")
const emailDomain = ref("")
const cfToken = ref("")
const enableRandomSubdomain = ref(false)
const loginCfToken = ref("")
const loginTurnstileRef = ref(null)
const loginMethod = ref('credential') // 'credential' or 'password'
const loginAddress = ref('')
const loginPassword = ref('')

// 根据 openSettings 初始化登录方式
const initLoginMethod = () => {
    if (openSettings.value?.enableAddressPassword) {
        loginMethod.value = 'password';
    } else {
        loginMethod.value = 'credential';
    }
}

const login = async () => {
    if (loginMethod.value === 'password') {
        // Password login
        if (!loginAddress.value || !loginPassword.value) {
            message.error(t('emailPasswordRequired'));
            return;
        }
        try {
            const res = await api.fetch('/api/address_login', {
                method: 'POST',
                body: JSON.stringify({
                    email: loginAddress.value,
                    password: await hashPassword(loginPassword.value),
                    cf_token: loginCfToken.value
                })
            });
            jwt.value = res.jwt;
            await api.getSettings();
            try {
                await props.bindUserAddress();
            } catch (error) {
                message.error(`${t('bindUserAddressError')}: ${error.message}`);
            }
            await router.push(getRouterPathWithLang("/", locale.value));
        } catch (error) {
            message.error(error.message || "error");
            loginTurnstileRef.value?.refresh?.();
        }
        return;
    }
    if (!credential.value) {
        message.error(t('credentialInput'));
        return;
    }
    try {
        await api.fetch('/open_api/credential_login', {
            method: 'POST',
            body: JSON.stringify({
                credential: credential.value,
                cf_token: loginCfToken.value
            })
        });
        jwt.value = credential.value;
        await api.getSettings();
        try {
            await props.bindUserAddress();
        } catch (error) {
            message.error(`${t('bindUserAddressError')}: ${error.message}`);
        }
        await router.push(getRouterPathWithLang("/", locale.value));
    } catch (error) {
        message.error(error.message || "error");
        loginTurnstileRef.value?.refresh?.();
    }
}

const { locale, t } = useScopedI18n('views.common.Login')

const loginAndBindTag = computed(() => {
    if (userSettings.value.user_email) {
        return t('loginAndBind')
    }
    return t('login')
})

const addressRegex = computed(() => {
    try {
        if (openSettings.value.addressRegex) {
            return new RegExp(openSettings.value.addressRegex, 'g');
        }
    } catch (error) {
        console.error(error);
        message.error(`Invalid addressRegex: ${openSettings.value.addressRegex}`);
    }
    return /[^a-z0-9]/g;
});

const generateNameLoading = ref(false);
const generateName = async () => {
    try {
        generateNameLoading.value = true;
        const { faker } = await import('https://esm.sh/@faker-js/faker');
        emailName.value = faker.internet.email()
            .split('@')[0]
            .replace(/\s+/g, '.')
            .replace(/\.{2,}/g, '.')
            .replace(addressRegex.value, '')
            .toLowerCase();
        // support maxAddressLen
        if (emailName.value.length > openSettings.value.maxAddressLen) {
            emailName.value = emailName.value.slice(0, openSettings.value.maxAddressLen);
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        generateNameLoading.value = false;
    }
};

const newEmail = async () => {
    try {
        // If custom names are disabled, send empty name to trigger backend auto-generation
        const nameToSend = openSettings.value.disableCustomAddressName ? "" : emailName.value;
        const res = await props.newAddressPath(
            nameToSend,
            emailDomain.value,
            cfToken.value,
            enableRandomSubdomain.value
        );
        jwt.value = res["jwt"];
        addressPassword.value = res["password"] || '';
        await api.getSettings();
        await router.push(getRouterPathWithLang("/", locale.value));
        showAddressCredential.value = true;
        try {
            await props.bindUserAddress();
        } catch (error) {
            message.error(`${t('bindUserAddressError')}: ${error.message}`);
        }
    } catch (error) {
        message.error(error.message || "error");
    }
};

const addressPrefix = computed(() => {
    // if user has role, return role prefix
    if (userSettings.value?.user_role) {
        return userSettings.value.user_role.prefix || "";
    }
    // if user has no role, return default prefix
    return openSettings.value.prefix;
});

const canUseRandomSubdomain = computed(() => {
    if (!emailDomain.value) {
        return false;
    }
    return (openSettings.value.randomSubdomainDomains || []).includes(emailDomain.value);
});

watch(canUseRandomSubdomain, (enabled) => {
    if (!enabled) {
        enableRandomSubdomain.value = false;
    }
});

const domainsOptions = computed(() => {
    // if user has role, return role domains
    if (userSettings.value.user_role) {
        const allDomains = userSettings.value.user_role.domains;
        if (!allDomains) return openSettings.value.domains;
        return openSettings.value.domains.filter((domain) => {
            return allDomains.includes(domain.value);
        });
    }
    // if user has no role, return default domains
    if (!openSettings.value.defaultDomains) {
        return openSettings.value.domains;
    }
    // if user has no role and no default domains, return all domains
    return openSettings.value.domains.filter((domain) => {
        return openSettings.value.defaultDomains.includes(domain.value);
    });
});

const showNewAddressTab = computed(() => {
    if (openSettings.value.disableAnonymousUserCreateEmail
        && !userSettings.value.user_email
    ) {
        return false;
    }
    return openSettings.value.enableUserCreateEmail;
});

onMounted(async () => {
    if (!openSettings.value.domains || openSettings.value.domains.length === 0) {
        await api.getOpenSettings(message, notification);
    }
    emailDomain.value = domainsOptions.value ? domainsOptions.value[0]?.value : "";
    initLoginMethod();
});
</script>

<template>
    <div class="login-shell">
        <n-alert v-if="userSettings.user_email" :show-icon="false" :bordered="false" closable>
            <span>{{ t('bindUserInfo') }}</span>
        </n-alert>
        <div v-if="openSettings.fetched" class="login-panel">
            <n-radio-group v-model:value="tabValue" class="login-mode" name="login-mode">
                <n-radio-button value="signin">{{ loginAndBindTag }}</n-radio-button>
                <n-radio-button v-if="showNewAddressTab" value="register">{{ t('getNewEmail') }}</n-radio-button>
            </n-radio-group>

            <section v-if="tabValue === 'signin'" class="login-section">
                <n-form>
                    <div v-if="loginMethod === 'password'">
                        <n-form-item-row :label="t('email')" required>
                            <n-input v-model:value="loginAddress" />
                        </n-form-item-row>
                        <n-form-item-row :label="t('password')" required>
                            <n-input v-model:value="loginPassword" type="password" show-password-on="click"
                                @keyup.enter="login" />
                        </n-form-item-row>
                    </div>

                    <div v-else>
                        <n-form-item-row :label="t('credential')" required>
                            <n-input v-model:value="credential" type="textarea" :autosize="{ minRows: 3 }" />
                        </n-form-item-row>
                    </div>

                    <Turnstile ref="loginTurnstileRef" v-if="openSettings.enableGlobalTurnstileCheck"
                        v-model:value="loginCfToken" />

                    <div class="switch-login-button">
                        <n-button v-if="openSettings?.enableAddressPassword"
                            @click="loginMethod === 'password' ? loginMethod = 'credential' : loginMethod = 'password'"
                            type="info" quaternary size="tiny">
                            {{ loginMethod === 'password' ? t('credentialLogin') : t('passwordLogin') }}
                        </n-button>
                    </div>

                    <div class="login-actions">
                    <n-button @click="login" :loading="loading" type="primary" block strong class="cta-button cta-button--primary">
                        <template #icon>
                            <n-icon :component="EmailOutlined" />
                        </template>
                        {{ loginAndBindTag }}
                    </n-button>
                    <n-button v-if="showNewAddressTab" @click="tabValue = 'register'" block secondary strong class="cta-button cta-button--secondary">
                        <template #icon>
                            <n-icon :component="NewLabelOutlined" />
                        </template>
                        {{ t('getNewEmail') }}
                    </n-button>
                    </div>
                </n-form>
            </section>
            <section v-else-if="showNewAddressTab" class="login-section">
                <n-spin :show="generateNameLoading">
                    <n-form>
                        <div class="helper-copy">
                            <p v-if="!openSettings.disableCustomAddressName">{{ t("getNewEmailTip1") +
                                addressRegex.source }}</p>
                            <p v-if="!openSettings.disableCustomAddressName">{{ t("getNewEmailTip2") }}</p>
                            <p>{{ t("getNewEmailTip3") }}</p>
                        </div>
                        <n-button v-if="!openSettings.disableCustomAddressName" @click="generateName"
                            style="margin-bottom: 10px;" class="compact-utility-button">
                            {{ t('generateName') }}
                        </n-button>
                        <n-input-group>
                            <n-input-group-label v-if="addressPrefix">
                                {{ addressPrefix }}
                            </n-input-group-label>
                            <n-input v-if="!openSettings.disableCustomAddressName" v-model:value="emailName" show-count
                                :minlength="openSettings.minAddressLen" :maxlength="openSettings.maxAddressLen" />
                            <n-input v-else :value="t('autoGeneratedName')" disabled />
                            <n-input-group-label>@</n-input-group-label>
                            <n-select v-model:value="emailDomain" :consistent-menu-width="false"
                                :options="domainsOptions" />
                        </n-input-group>
                        <n-form-item-row v-if="canUseRandomSubdomain">
                            <n-checkbox v-model:checked="enableRandomSubdomain">
                                {{ t('enableRandomSubdomain') }}
                            </n-checkbox>
                            <p style="margin: 8px 0 0; opacity: 0.75;">
                                {{ t('randomSubdomainTip') }}
                            </p>
                        </n-form-item-row>
                        <Turnstile v-model:value="cfToken" />
                        <n-button type="primary" block strong @click="newEmail" :loading="loading" class="cta-button cta-button--primary">
                            <template #icon>
                                <n-icon :component="NewLabelOutlined" />
                            </template>
                            {{ t('getNewEmail') }}
                        </n-button>
                    </n-form>
                </n-spin>
            </section>
        </div>
    </div>
</template>

<style scoped>
.login-shell {
    display: grid;
    gap: 12px;
}

.login-panel {
    display: grid;
    gap: 16px;
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

.login-mode :deep(.n-radio-button) {
    flex: 1 1 0;
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

.login-mode :deep(.n-radio-button__state-border),
.login-mode :deep(.n-radio-button__state-border-left) {
    border-radius: 0;
}

.login-section {
    display: grid;
    gap: 12px;
    max-width: 760px;
}

.switch-login-button {
    display: flex;
    justify-content: flex-start;
    margin: 4px 0 10px;
}

.login-actions {
    display: grid;
    gap: 10px;
}

.cta-button {
    justify-content: flex-start;
    min-height: 42px;
    font-weight: 600;
}

.cta-button--primary {
    box-shadow: inset 2px 0 0 var(--signal);
}

.cta-button--secondary {
    background: color-mix(in srgb, var(--field) 92%, transparent);
}

.compact-utility-button {
    justify-self: start;
}

.helper-copy p {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
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
</style>


<style scoped>
.n-form .n-button {
    margin-top: 10px;
}

.switch-login-button {
    display: flex;
    justify-content: center;
    margin: 10px 0;
}

.n-form {
    text-align: left;
}
</style>
