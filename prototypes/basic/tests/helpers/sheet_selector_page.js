import { expect } from '@playwright/test';

export class SheetSelectorPage {
    constructor(page) {
        this.p = page
    }

    getRadio = async(name) => {
        return await this.p.getByLabel(name);
    }

    getTableCount = async() => {
        return page.locator("table").count
    }

    getTableProperty = async(idx, propertyName) => {
        return await this.p.locator("table").nth(idx).evaluate(
            (el, property) => {
                return window.getComputedStyle(el).getPropertyValue(property);
            }, propertyName
        );
    }

    getTableRow = async(tableIdx, rowIdx ) => {
        return await this.p.locator("table").nth(tableIdx).locator("tbody tr").nth(rowIdx)
    }

    submit = async() => {
        await this.p.getByRole('button', { name: 'Next' }).click();
    }
}

