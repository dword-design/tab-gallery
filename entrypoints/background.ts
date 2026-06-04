import { type Browser, browser } from 'wxt/browser';

const IS_INCOGNITO_CONTEXT = browser.extension.inIncognitoContext;

const PREVIEW_STORAGE_KEY = IS_INCOGNITO_CONTEXT
  ? 'tabPreviewById:incognito'
  : 'tabPreviewById:default';

const FORBIDDEN_CAPTURE_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
];

type PreviewByTabId = Record<string, string>;

const shouldCapture = (
  tab: Browser.tabs.Tab,
): tab is Browser.tabs.Tab & {
  active: true;
  id: number;
  url: string;
  windowId: number;
} => {
  if (
    tab.active !== true ||
    tab.windowId === undefined ||
    tab.id === undefined ||
    tab.url === undefined ||
    tab.incognito !== IS_INCOGNITO_CONTEXT
  ) {
    return false;
  }

  const tabUrl = tab.url;
  return !FORBIDDEN_CAPTURE_PREFIXES.some(prefix => tabUrl.startsWith(prefix));
};

const getStoredPreviews = async () => {
  const result = await browser.storage.local.get(PREVIEW_STORAGE_KEY);
  return (result[PREVIEW_STORAGE_KEY] as PreviewByTabId | undefined) ?? {};
};

const setStoredPreviews = async (previews: PreviewByTabId) => {
  await browser.storage.local.set({ [PREVIEW_STORAGE_KEY]: previews });
};

const upsertPreview = async (tabId: number, dataUrl: string) => {
  const previews = await getStoredPreviews();
  await setStoredPreviews({ ...previews, [String(tabId)]: dataUrl });
};

const removePreview = async (tabId: number) => {
  const previews = await getStoredPreviews();

  const remainingPreviews = Object.fromEntries(
    Object.entries(previews).filter(([key]) => key !== String(tabId)),
  ) as PreviewByTabId;

  await setStoredPreviews(remainingPreviews);
};

const capturePreviewForTab = async (tab: Browser.tabs.Tab) => {
  if (!shouldCapture(tab)) {
    return;
  }

  try {
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 55,
    });

    await upsertPreview(tab.id, dataUrl);
  } catch {
    // Capture can fail for restricted or internal pages; we skip these silently.
  }
};

const capturePreviewForTabId = async (tabId: number) => {
  const tab = await browser.tabs.get(tabId);
  await capturePreviewForTab(tab);
};

const warmUpActiveTabPreviews = async () => {
  const windows = await browser.windows.getAll({ populate: true });

  const activeTabs = windows.flatMap(windowInfo =>
    (windowInfo.tabs ?? []).filter(tab => tab.active),
  );

  await Promise.all(activeTabs.map(tab => capturePreviewForTab(tab)));
};

export default defineBackground(() => {
  browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  void warmUpActiveTabPreviews();

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void capturePreviewForTabId(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      void capturePreviewForTabId(tabId);
    }
  });

  browser.tabs.onRemoved.addListener(tabId => {
    void removePreview(tabId);
  });
});
