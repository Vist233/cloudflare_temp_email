<script setup>
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
const { openSettings } = useGlobalState()


const { t } = useScopedI18n('views.Footer')

</script>

<template>
    <div class="footer-shell">
        <n-divider class="footer-divider" />
        <div class="footer-inner">
            <n-space justify="center">
                <n-text depth="3">
                    {{ t('copyright') }} © 2023-{{ new Date().getFullYear() }}
                </n-text>
                <n-text depth="3">
                    <div v-html="openSettings.copyright"></div>
                </n-text>
            </n-space>
        </div>
    </div>
</template>


<style scoped>
.footer-shell {
    padding-top: 6px;
}

.footer-divider {
    margin: 0;
    padding: 0 var(--x-padding);
}

.footer-inner {
    text-align: center;
    padding: 16px 0 6px;
}
</style>
