<script setup>
import { onMounted } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import UserLogin from './UserLogin.vue'

const message = useMessage()

const {
    userSettings, userJwt, userOpenSettings
} = useGlobalState()

const { t } = useScopedI18n('views.user.UserBar')


onMounted(async () => {
    await api.getUserOpenSettings(message);
    // make sure user_id is fetched
    if (!userSettings.value.user_id) await api.getUserSettings(message);
});
</script>

<template>
    <div class="user-bar">
        <n-card :bordered="false" embedded v-if="!userSettings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>
        <section v-else-if="userSettings.user_email" class="identity-strip">
            <div class="identity-main">
                <div>
                    <p class="identity-label">{{ t('currentUser') }}</p>
                    <h1>{{ userSettings.user_email }}</h1>
                </div>
            </div>
            <div class="identity-meta">
                <span v-if="userSettings.user_role?.role">{{ userSettings.user_role.role }}</span>
                <span v-if="userSettings.is_admin">admin</span>
            </div>
        </section>
        <div v-else class="center">
            <section class="login-surface">
                <n-alert v-if="userJwt" type="warning" :show-icon="false" :bordered="false" closable>
                    <span>{{ t('fetchUserSettingsError') }}</span>
                </n-alert>
                <UserLogin />
            </section>
        </div>
    </div>
</template>

<style scoped>
.user-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.identity-strip,
.login-surface {
    border: 1px solid var(--line);
    background: var(--panel-strong);
}

.identity-strip {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    padding: 18px;
}

.identity-main {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.identity-label {
    margin: 0 0 4px;
    font-size: 12px;
    color: var(--muted);
}

.identity-strip h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
    word-break: break-word;
}

.identity-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.identity-meta span {
    padding: 4px 8px;
    border: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
    background: color-mix(in srgb, var(--field) 86%, transparent);
}

.center {
    display: flex;
    justify-content: center;
}

.login-surface {
    width: min(640px, 100%);
    padding: 18px;
}

@media (max-width: 720px) {
    .identity-strip {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
