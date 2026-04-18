import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  build: {
    // Split heavy third-party code into long-lived vendor chunks. Railway
    // redeploys invalidate only the app chunk, so returning visitors
    // re-download ~270 kB (gzipped) of app code instead of the full
    // ~950 kB bundle. This also reduces egress bandwidth on Railway.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix'
          if (id.includes('node_modules/framer-motion/') || id.includes('node_modules/motion/'))
            return 'vendor-motion'
          if (id.includes('node_modules/@phosphor-icons/')) return 'vendor-icons'
          if (id.includes('node_modules/three/')) return 'vendor-three'
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3')) return 'vendor-charts'
          return 'vendor'
        },
      },
    },
    // Raise the warning threshold now that we're explicitly chunking;
    // the split vendor chunks are intentional and cache well.
    chunkSizeWarningLimit: 800,
  },
});
