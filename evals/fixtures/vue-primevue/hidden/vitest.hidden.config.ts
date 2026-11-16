// Config for the hidden acceptance tests, copied to the app root next to vite.config.ts. It reuses the
// app's own Vite config (plugins and aliases, including any the agent added) so .vue files compile,
// and keeps the agent's vitest.config.ts (environment, setup files) out of the hidden run.
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/__hidden__/**/*.test.ts'],
      environment: 'jsdom',
      testTimeout: 40000,
      fileParallelism: false,
    },
  }),
)
