import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    reporter: process.env.CI ? ['github', 'junit'] : 'line',
    use: {
        baseURL: 'http://127.0.0.1:3000',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
      }
});
