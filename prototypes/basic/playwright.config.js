import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    workers: 1,
    testDir: './tests',
    reporter: process.env.CI ? [['github'], ['junit', {outputFile: "./test-results/results.xml"}]] : 'line',
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
