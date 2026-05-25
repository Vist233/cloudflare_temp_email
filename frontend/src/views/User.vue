<script setup>
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import AddressMangement from './user/AddressManagement.vue';
import UserSettingsPage from './user/UserSettings.vue';
import UserBar from './user/UserBar.vue';

const { t } = useScopedI18n('views.User')
const { userSettings } = useGlobalState()

</script>

<template>
    <div class="user-shell">
        <UserBar />
        <div v-if="userSettings.user_email" class="user-workbench">
            <section class="user-section main">
                <header class="section-head">
                    <h2>{{ t('address_management') }}</h2>
                </header>
                <div class="management-grid">
                    <AddressMangement />
                    <div class="account-inline">
                        <UserSettingsPage />
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.user-shell {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.user-workbench {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    align-items: start;
}

.user-section {
    border: 1px solid var(--line);
    background: var(--panel-strong);
    padding: 18px;
}

.management-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(260px, 0.75fr);
    gap: 18px;
    align-items: start;
}

.account-inline {
    border-left: 1px solid var(--line);
    padding-left: 18px;
}

.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--line);
}

.section-head h2 {
    margin: 0;
    font-size: 15px;
    line-height: 1.3;
}

@media (max-width: 960px) {
    .management-grid {
        grid-template-columns: 1fr;
    }

    .account-inline {
        border-left: 0;
        border-top: 1px solid var(--line);
        padding-left: 0;
        padding-top: 18px;
    }
}
</style>
