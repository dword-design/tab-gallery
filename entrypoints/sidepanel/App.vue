<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { type Browser, browser } from 'wxt/browser';

const IS_INCOGNITO_CONTEXT = browser.extension.inIncognitoContext;

const PREVIEW_STORAGE_KEY = IS_INCOGNITO_CONTEXT
  ? 'tabPreviewById:incognito'
  : 'tabPreviewById:default';

type PreviewByTabId = Record<string, string>;

type TabRecord = Browser.tabs.Tab;
const tabs = ref<TabRecord[]>([]);
const previews = ref<PreviewByTabId>({});

const sortTabs = (tabItems: TabRecord[]) =>
  tabItems.toSorted((leftTab, rightTab) => {
    const leftWindow = leftTab.windowId ?? 0;
    const rightWindow = rightTab.windowId ?? 0;

    if (leftWindow !== rightWindow) {
      return leftWindow - rightWindow;
    }

    return (leftTab.index ?? 0) - (rightTab.index ?? 0);
  });

const refreshTabs = async () => {
  const allTabs = await browser.tabs.query({});
  tabs.value = sortTabs(allTabs);
};

const refreshPreviews = async () => {
  const result = await browser.storage.local.get(PREVIEW_STORAGE_KEY);

  previews.value =
    (result[PREVIEW_STORAGE_KEY] as PreviewByTabId | undefined) ?? {};
};

const getHostname = (url?: string) => {
  if (!url) {
    return 'No URL';
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const getPreview = (tabId?: number) => {
  if (tabId === undefined) {
    return;
  }

  return previews.value[String(tabId)];
};

const activateTab = async (tab: TabRecord) => {
  if (tab.id === undefined) {
    return;
  }

  await Promise.all([
    browser.tabs.update(tab.id, { active: true }),
    tab.windowId === undefined
      ? Promise.resolve()
      : browser.windows.update(tab.windowId, { focused: true }),
  ]);
};

const closeTab = async (tabId?: number) => {
  if (tabId === undefined) {
    return;
  }

  await browser.tabs.remove(tabId);
};

const visibleTabs = computed(() =>
  tabs.value.filter(
    tab => tab.id !== undefined && tab.incognito === IS_INCOGNITO_CONTEXT,
  ),
);

const refreshAll = async () => {
  await Promise.all([refreshTabs(), refreshPreviews()]);
};

const handleTabsChanged = () => {
  void refreshTabs();
};

const handleStorageChanged: Parameters<
  typeof browser.storage.onChanged.addListener
>[0] = (changes, area) => {
  if (area === 'local' && PREVIEW_STORAGE_KEY in changes) {
    previews.value =
      (changes[PREVIEW_STORAGE_KEY].newValue as PreviewByTabId | undefined) ??
      {};
  }
};

onMounted(() => {
  void refreshAll();
  browser.tabs.onActivated.addListener(handleTabsChanged);
  browser.tabs.onAttached.addListener(handleTabsChanged);
  browser.tabs.onCreated.addListener(handleTabsChanged);
  browser.tabs.onDetached.addListener(handleTabsChanged);
  browser.tabs.onMoved.addListener(handleTabsChanged);
  browser.tabs.onRemoved.addListener(handleTabsChanged);
  browser.tabs.onUpdated.addListener(handleTabsChanged);
  browser.windows.onFocusChanged.addListener(handleTabsChanged);
  browser.storage.onChanged.addListener(handleStorageChanged);
});

onUnmounted(() => {
  browser.tabs.onActivated.removeListener(handleTabsChanged);
  browser.tabs.onAttached.removeListener(handleTabsChanged);
  browser.tabs.onCreated.removeListener(handleTabsChanged);
  browser.tabs.onDetached.removeListener(handleTabsChanged);
  browser.tabs.onMoved.removeListener(handleTabsChanged);
  browser.tabs.onRemoved.removeListener(handleTabsChanged);
  browser.tabs.onUpdated.removeListener(handleTabsChanged);
  browser.windows.onFocusChanged.removeListener(handleTabsChanged);
  browser.storage.onChanged.removeListener(handleStorageChanged);
});
</script>

<template>
  <main class="panel">
    <header class="panel-header">
      <p class="eyebrow">Side Panel</p>
      <h1>Tab Gallery</h1>
      <p class="subtitle">{{ visibleTabs.length }} open tabs</p>
    </header>

    <section class="tab-grid">
      <article
        v-for="tab in visibleTabs"
        :key="tab.id"
        class="tab-card"
        :class="{ 'tab-card-active': tab.active }"
        @click="activateTab(tab)"
      >
        <button
          aria-label="Close tab"
          class="close-button"
          title="Close tab"
          type="button"
          @click.stop="closeTab(tab.id)"
        >
          ×
        </button>

        <div class="preview-wrap">
          <img
            v-if="getPreview(tab.id)"
            alt="Tab preview"
            class="preview-image"
            :src="getPreview(tab.id)"
          />
          <div v-else class="preview-fallback">
            <span>{{ getHostname(tab.url).slice(0, 2).toUpperCase() }}</span>
          </div>
          <span v-if="tab.pinned" class="pill">Pinned</span>
        </div>

        <div class="tab-meta">
          <img
            v-if="tab.favIconUrl"
            alt=""
            class="favicon"
            :src="tab.favIconUrl"
          />
          <div class="tab-text">
            <h2>{{ tab.title || 'Untitled tab' }}</h2>
            <p>{{ getHostname(tab.url) }}</p>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
