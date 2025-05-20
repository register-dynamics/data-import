import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    workers: 1,
    testDir: './tests',
    reporter: process.env.CI ? [['github'], ['junit', { outputFile: "./test-results/results.xml" }]] : 'line',
    // use: {
    //     baseURL: 'http://127.0.0.1:3000',
    // },
    projects: [
        {
            name: 'simple-tests',
            use: {
                baseURL: 'http://localhost:3000',
            },
            testDir: './tests/simple',
        },
        {
            name: 'sheet-selection-auto',
            use: {
                baseURL: 'http://localhost:3000',
            },
            testDir: './tests/sheet-selection-auto',
        },
        {
            name: 'sheet-selection-manual',
            use: {
                baseURL: 'http://localhost:3000',
            },
            testDir: './tests/sheet-selection-manual',
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
    }
});
