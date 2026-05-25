<script setup>
import { onMounted, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRoute } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'

import AddressBar from './index/AddressBar.vue';
import MailBox from '../components/MailBox.vue';
import Attachment from './index/Attachment.vue';

const { settings, openSettings } = useGlobalState()
const message = useMessage()
const route = useRoute()

const { t } = useScopedI18n('views.Index')

const fetchMailData = async (limit, offset) => {
  if (mailIdQuery.value > 0) {
    const singleMail = await api.fetch(`/api/mail/${mailIdQuery.value}`);
    if (singleMail) return { results: [singleMail], count: 1 };
    return { results: [], count: 0 };
  }
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

const saveToS3 = async (mail_id, filename, blob) => {
  try {
    const { url } = await api.fetch(`/api/attachment/put_url`, {
      method: 'POST',
      body: JSON.stringify({ key: `${mail_id}/${filename}` })
    });
    // upload to s3 by formdata
    const formData = new FormData();
    formData.append(filename, blob);
    await fetch(url, {
      method: 'PUT',
      body: formData
    });
    message.success(t('saveToS3Success'));
  } catch (error) {
    console.error(error);
    message.error(error.message || "save to s3 error");
  }
}

const mailBoxKey = ref("")
const mailIdQuery = ref("")
const showMailIdQuery = ref(false)

const queryMail = () => {
  mailBoxKey.value = Date.now();
}

watch(route, () => {
  if (!route.query.mail_id) {
    showMailIdQuery.value = false;
    mailIdQuery.value = "";
    queryMail();
  }
})

onMounted(() => {
  if (route.query.mail_id) {
    showMailIdQuery.value = true;
    mailIdQuery.value = route.query.mail_id;
    queryMail();
  }
})
</script>

<template>
  <div class="page-shell">
    <AddressBar />
    <div v-if="settings.address" class="mail-layout">
      <section class="mail-panel">
        <header class="section-head">
          <h2>{{ t('mailbox') }}</h2>
        </header>
        <div v-if="showMailIdQuery" class="mail-query">
          <n-input-group>
            <n-input v-model:value="mailIdQuery" />
            <n-button @click="queryMail" type="primary" tertiary>
              {{ t('query') }}
            </n-button>
          </n-input-group>
        </div>
        <MailBox :key="mailBoxKey" :showEMailTo="false" :showReply="false" :showSaveS3="openSettings.isS3Enabled"
          :saveToS3="saveToS3" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
          :fetchMailData="fetchMailData" :deleteMail="deleteMail" :showFilterInput="true" />
      </section>
    </div>
    <section v-if="settings.address && openSettings.isS3Enabled" class="utility-section utility-wide">
      <header class="section-head">
        <h2>{{ t('s3Attachment') }}</h2>
      </header>
      <Attachment />
    </section>
  </div>
</template>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mail-layout {
  display: block;
}

.mail-panel,
.utility-section {
  border: 1px solid var(--line);
  background: var(--panel-strong);
}

.mail-panel {
  padding: 18px;
}

.utility-section {
  padding: 16px;
}

.utility-wide {
  margin-top: 18px;
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

.mail-query {
  margin-bottom: 12px;
}

</style>
