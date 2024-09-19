import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    use: {
        // Base URL to use in actions like `await page.goto('/')`.
        baseURL: 'http://127.0.0.1:3000',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            dependencies: [],
        },
    ]
});