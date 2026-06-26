<script setup>
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { User, ExchangeAlt } from '@vicons/fa'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Login from '../common/Login.vue'
import TelegramAddress from './TelegramAddress.vue'
import LocalAddress from './LocalAddress.vue'
import AddressManagement from '../user/AddressManagement.vue'
import { getRouterPathWithLang } from '../../utils'
import AddressSelect from '../../components/AddressSelect.vue'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'
import AccountSettings from './AccountSettings.vue'

const router = useRouter()

const {
    jwt, settings, showAddressCredential, userJwt,
    isTelegram, addressPassword
} = useGlobalState()

const { locale, t } = useScopedI18n('views.index.AddressBar')

const showAddressManage = ref(false)

const onUserLogin = async () => {
    await router.push(getRouterPathWithLang("/user", locale.value))
}

onMounted(async () => {
    await api.getSettings();
});
</script>

<template>
    <div class="address-shell">
        <n-card :bordered="false" embedded v-if="!settings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>
        <section v-else-if="settings.address" class="address-active">
            <div class="section-head">
                <div class="address-copyblock">
                    <h1>{{ settings.address }}</h1>
                    <p>{{ t('addressManage') }}</p>
                </div>
            </div>
            <div class="control-deck">
                <AddressSelect class="address-actions">
                    <template #actions>
                        <n-button class="address-manage control-button" size="small" tertiary :round="false"
                            @click="showAddressManage = true">
                            <n-icon :component="ExchangeAlt" />
                            {{ t('addressManage') }}
                        </n-button>
                    </template>
                </AddressSelect>
                <AccountSettings inline />
            </div>
        </section>
        <div v-else-if="isTelegram">
            <TelegramAddress />
        </div>
        <section v-else-if="userJwt" class="empty-state large">
            <header class="section-head">
                <div>
                    <h1>{{ t('addressManage') }}</h1>
                    <p>{{ t('userLogin') }}</p>
                </div>
            </header>
            <div class="section-body">
                <AddressManagement />
            </div>
        </section>
        <section v-else class="empty-state">
            <header class="section-head">
                <div>
                    <h1>{{ t('addressManage') }}</h1>
                    <p>{{ t('userLogin') }}</p>
                </div>
            </header>
            <div class="section-body">
                <n-alert v-if="jwt" type="warning" :show-icon="false" :bordered="false" closable>
                    <span>{{ t('fetchAddressError') }}</span>
                </n-alert>
                <Login />
                <n-divider />
                <n-button @click="onUserLogin" type="primary" block strong :round="false">
                    <template #icon>
                        <n-icon :component="User" />
                    </template>
                    {{ t('userLogin') }}
                </n-button>
            </div>
        </section>
        <AddressCredentialModal v-model:show="showAddressCredential" :address="settings.address" :jwt="jwt"
            :address-password="addressPassword" />
        <n-modal v-model:show="showAddressManage" preset="card" :title="t('addressManage')"
            style="width: 720px;">
            <TelegramAddress v-if="isTelegram" />
            <AddressManagement v-else-if="userJwt" />
            <LocalAddress v-else />
        </n-modal>
    </div>
</template>

<style scoped>
.address-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.address-active,
.empty-state {
    border: 1px solid var(--line);
    background: var(--panel-strong);
    padding: 18px;
}

.empty-state {
    width: min(100%, 860px);
    margin: 0 auto;
}

.empty-state.large {
    padding: 18px;
}

.section-head {
    display: block;
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--line);
}

.address-copyblock {
    max-width: min(100%, 980px);
}

.section-head h1 {
    margin: 0;
    font-size: 24px;
    line-height: 1.2;
    overflow-wrap: anywhere;
}

.section-head p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
}

.control-deck,
.address-actions,
.section-body {
    text-align: left;
}

.section-body {
    display: grid;
    gap: 14px;
}

.control-deck {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
}

.address-actions {
    flex: 1 1 560px;
    min-width: min(100%, 560px);
}

.control-button {
    color: var(--ink);
}

@media (max-width: 720px) {
    .control-deck {
        align-items: stretch;
    }

    .address-actions {
        width: 100%;
        min-width: 0;
    }
}
</style>
