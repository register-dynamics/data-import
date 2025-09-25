import { expect } from '@playwright/test';

export class MappingPage {
    constructor(page) {
        this.p = page
    }

    getTable = async() => {
        return await this.p.locator('table').nth(0)
    }

    getColumnNames = async() => {
        let tbl = await this.getTable()

        let rowCount = await tbl.locator("tbody tr").count();
        let names = new Array()

        for (let idx = 0; idx< rowCount; idx++) {
            let colText = await tbl.locator("tbody tr").nth(idx).locator("th").nth(0).textContent();
            names.push(colText)
        }

        return names
    }

    getExamples = async() => {
        let tbl = await this.getTable()
        let rowCount = await tbl.locator("tbody tr").count()
        let names = new Array()

        for (let idx = 0; idx< rowCount; idx++) {
            let colText = await tbl.locator("tbody tr").nth(idx).locator("td").nth(0).textContent();
            names.push(colText)
        }

        return names
    }

    setMapping = async(columnName, fieldName) => {
        let cols = await this.getColumnNames()
        let idx = cols.findIndex((x)=>x == columnName);
        await this.p.locator(`[name='field-${idx}']`).selectOption(fieldName)
    }

    submit = async() => {
        await this.p.getByRole('button', { name: 'Submit' }).click();
    }
}

