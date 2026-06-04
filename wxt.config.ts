import { defineConfig } from 'wxt';

const BASE_PERMISSIONS = ['tabs', 'storage'];
const BASE_HOST_PERMISSIONS = ['<all_urls>'];

export default defineConfig({
  manifest: ({ browser }) => ({
    action: { default_title: 'Open tab gallery' },
    host_permissions: BASE_HOST_PERMISSIONS,
    name: 'Chrome Tab Gallery',
    permissions: [
      ...BASE_PERMISSIONS,
      ...(browser === 'firefox' ? [] : ['sidePanel']),
    ],
    ...(browser === 'firefox'
      ? {}
      : { incognito: 'split', side_panel: { default_path: 'sidepanel.html' } }),
  }),
});
