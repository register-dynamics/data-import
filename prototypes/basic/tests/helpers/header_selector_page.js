import { expect } from '@playwright/test';

export class HeaderSelectorPage {
    constructor(page) {
        this.p = page
    }

    getTable = async() => {
        return await this.p.locator("table").nth(0);
    }

    select = async(start, end) => {
        let [startRow, startCol] = start;
        let [endRow, endCol] = end;

        let tbl = await this.getTable()
        const startCell = await tbl.locator("tbody tr").nth(startRow).locator("td").nth(startCol)
        const endCell = await tbl.locator("tbody tr").nth(endRow).locator("td").nth(endCol)
        await startCell.dragTo(endCell)
    }

    submit = async() => {
        await this.p.getByRole('button', { name: 'Next' }).click();
    }
}

