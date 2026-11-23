import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  integrations: [{
    name: 'isolated-vite-caches',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        // Astro check/sync starts a temporary Vite server with different dependency
        // discovery settings. It must not replace the running preview's prebundles.
        updateConfig({ vite: { cacheDir: fileURLToPath(new URL(`./node_modules/.vite-${command}/`, import.meta.url)) } });
      },
    },
  }],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['three', 'three/addons/environments/RoomEnvironment.js'] },
  },
  devToolbar: { enabled: false },
});
