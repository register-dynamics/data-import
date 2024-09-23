import { expect } from '@playwright/test';

export class FooterSelectorPage {
    constructor(page) {
        this.p = page
    }

    skip = async() => {
        await this.p.getByRole('button', { name: 'Skip' }).click();
    }


    submit = async() => {
        await this.p.getByRole('button', { name: 'Next' }).click();
    }
}

