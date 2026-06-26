<script setup>
import { ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils'
import { getRouterPathWithLang } from '../../utils'

const {
    jwt, settings, showAddressCredential, loading, openSettings
} = useGlobalState()
const router = useRouter()
const message = useMessage()

const showLogout = ref(false)
const showDeleteAccount = ref(false)
const showClearInbox = ref(false)
const showChangePassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const { locale, t } = useScopedI18n('views.index.AccountSettings')
const props = defineProps({
    inline: {
        type: Boolean,
        default: false,
    },
})

const logout = async () => {
    jwt.value = '';
    await router.push(getRouterPathWithLang("/", locale.value))
    location.reload()
}

const deleteAccount = async () => {
    try {
        await api.fetch(`/api/delete_address`, {
            method: 'DELETE'
        });
        jwt.value = '';
        await router.push(getRouterPathWithLang("/", locale.value))
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
};

const clearInbox = async () => {
    try {
        await api.fetch(`/api/clear_inbox`, {
            method: 'DELETE'
        });
        message.success(t("success"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearInbox.value = false;
    }
};

const changePassword = async () => {
    if (newPassword.value !== confirmPassword.value) {
        message.error(t("passwordMismatch"));
        return;
    }
    try {
        await api.fetch(`/api/address_change_password`, {
            method: 'POST',
            body: JSON.stringify({
                new_password: await hashPassword(newPassword.value)
            })
        });
        message.success(t("passwordChanged"));
        newPassword.value = '';
        confirmPassword.value = '';
        showChangePassword.value = false;
    } catch (error) {
        message.error(error.message || "error");
    }
};
</script>

<template>
    <div class="center" v-if="settings.address">
        <div class="account-card" :class="{ inline: props.inline }">
            <n-button @click="showAddressCredential = true" class="action-button action-soft" :block="!props.inline" strong>
                {{ t('showAddressCredential') }}
            </n-button>
            <n-button v-if="openSettings?.enableAddressPassword" @click="showChangePassword = true" class="action-button action-soft" :block="!props.inline" strong>
                {{ t('changePassword') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showClearInbox = true" class="action-button action-warm"
                :block="!props.inline" strong>
                {{ t('clearInbox') }}
            </n-button>
            <n-button @click="showLogout = true" class="action-button" :block="!props.inline" strong>
                {{ t('logout') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showDeleteAccount = true" class="action-button action-danger"
                :block="!props.inline" strong>
                {{ t('deleteAccount') }}
            </n-button>
        </div>

        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="warning">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDeleteAccount" preset="dialog" :title="t('deleteAccount')">
            <p>{{ t('deleteAccountConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteAccount" size="small" tertiary type="error">
                    {{ t('deleteAccount') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearInbox" preset="dialog" :title="t('clearInbox')">
            <p>{{ t('clearInboxConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearInbox" size="small" tertiary type="warning">
                    {{ t('clearInbox') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showChangePassword" preset="dialog" :title="t('changePassword')">
            <n-form :model="{ newPassword, confirmPassword }">
                <n-form-item :label="t('newPassword')">
                    <n-input v-model:value="newPassword" type="password" placeholder="" show-password-on="click"
                        @keyup.enter="changePassword" />
                </n-form-item>
                <n-form-item :label="t('confirmPassword')">
                    <n-input v-model:value="confirmPassword" type="password" placeholder="" show-password-on="click"
                        @keyup.enter="changePassword" />
                </n-form-item>
            </n-form>
            <template #action>
                <n-button :loading="loading" @click="changePassword" size="small" tertiary type="info">
                    {{ t('changePassword') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    display: block;
}

.account-card {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 10px;
}

.account-card.inline {
    grid-template-columns: repeat(auto-fit, minmax(170px, max-content));
    align-items: center;
    justify-content: start;
    gap: 10px;
}

.n-button {
    margin: 0;
}

.action-button {
    color: var(--ink);
    border-color: var(--line);
    background: var(--field);
    justify-content: flex-start;
    min-height: 40px;
}

.action-soft {
    background: color-mix(in srgb, var(--field) 88%, transparent);
    box-shadow: inset 2px 0 0 var(--signal);
}

.action-warm {
    background: color-mix(in srgb, #b18a45 18%, var(--field));
}

.action-danger {
    background: color-mix(in srgb, var(--proof) 12%, var(--field));
}

html[data-theme="dark"] .action-button {
    background: rgba(242, 242, 239, 0.04);
}

html[data-theme="dark"] .action-warm {
    background: rgba(177, 138, 69, 0.18);
}

html[data-theme="dark"] .action-danger {
    background: rgba(255, 93, 80, 0.12);
}

</style>
