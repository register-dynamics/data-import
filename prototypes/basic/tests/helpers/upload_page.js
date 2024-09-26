import { expect } from '@playwright/test';

export class UploadPage {
    constructor(page) {
        this.p = page
    }

    browseButton = async() => {
        return await this.p.locator('input[name="file"]')
    }

    submit = async() => {
        await this.p.getByRole('button', { name: 'Upload' }).click();
    }
}

