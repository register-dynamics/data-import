import { test, expect } from '@playwright/test';

import { UploadPage } from './helpers/upload_page';
import { SheetSelectorPage } from './helpers/sheet_selector_page';


const path = require('node:path');

const sheetPreviewVisibility = new Map([
    [0, "hidden"],
    [1, "visible"],
    [2, "hidden"]
]);

test('trouble with tribbles', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Start now').click();

    // ---------------------------------------------------------------------------
    // Upload a file
    await expect(page).toHaveURL(/.upload/)

    const tribblesFile = path.join(__dirname, "../../../fixtures", 'tribbles.xlsx')
    const uploadPage = new UploadPage(page)
    const browseButton = await uploadPage.browseButton()

    await browseButton.click();
    await browseButton.setInputFiles(tribblesFile);
    await uploadPage.submit();

    // ---------------------------------------------------------------------------
    // Select sheet
    await expect(page).toHaveURL(/.select_sheet/)

    const sheets = new SheetSelectorPage(page);

    const radioButton = await sheets.getRadio('My lovely tribbles')
    await radioButton.check()
    expect(radioButton).toBeChecked();

    // Check sheet preview visibility, we only expect one to be shown
    for (let [idx, expected] of sheetPreviewVisibility) {
        expect(await sheets.getTableProperty(idx, 'visibility')).toBe(expected)
    }

    // Check the data is present in the sheet previews
    const data = sheets.getTableData(1)


    const tbl = await page.locator("table").nth(1);
    const firstCell = await tbl.locator("tbody tr").nth(0).locator("td").nth(0).textContent()
    expect(firstCell).toBe("My lovely tribbles")
    await page.getByRole('button', { name: 'Next' }).click();

    // ---------------------------------------------------------------------------
    // Select some cells for a header row
    // We will use Name->Markings as our selection
    await expect(page).toHaveURL(/.select_header_row/)

    const headerTbl = await page.locator("table").nth(0);
    const startCell = await headerTbl.locator("tbody tr").nth(2).locator("td").nth(0)
    const endCell = await headerTbl.locator("tbody tr").nth(2).locator("td").nth(5)
    await startCell.dragTo(endCell)
    await page.getByRole('button', { name: 'Next' }).click();

    // ---------------------------------------------------------------------------
    // Do not choose a footer row, just click Skip
    await expect(page).toHaveURL(/.select_footer_row/)

    await page.getByRole('button', { name: 'Skip' }).click();

    // ---------------------------------------------------------------------------
    // Perform the mapping after checking the previews here are what we expect
    await expect(page).toHaveURL(/.mapping/)

    const expectedColumns = ["Name", "Date of birth", "Time of birth", "Weight", "Colour", "Markings"]
    const expectedExamples = new Map([
        [0, "Alex, Drew, Emm, Jamie, Kris"],
        [4, "Beige, Black, Brown, Maroon, Pink"],
        [5, "Blob on top, N/A, Splotches, Yes,"],
    ])

    const mappingTbl = await page.locator("table").nth(0)

    // Check the columns names (these are the headers we selected previously)
    let rowCount = await mappingTbl.locator("tbody tr").count()
    for(;rowCount>0;rowCount--) {
        let index = rowCount - 1;

        // First cell is a th not a td
        let colText = await mappingTbl.locator("tbody tr").nth(index).locator("th").nth(0).textContent();
        expect(expectedColumns.pop()).toBe(colText)

        if (expectedExamples.has(index)) {
            let exampleText = await mappingTbl.locator("tbody tr").nth(index).locator("td").nth(0).textContent();
            expect(exampleText).toBe(expectedExamples.get(index))
        }
    }
    expect(expectedColumns).toStrictEqual([])

    // Single selection matching the value or label
    await page.locator("[name='0']").selectOption("Code")
    await page.locator("[name='4']").selectOption("Name")
    await page.locator("[name='5']").selectOption("Speciality")

    await page.getByRole('button', { name: 'Submit' }).click();

    // ---------------------------------------------------------------------------
    // Should be on the success page
    await expect(page).toHaveURL(/.success/)
});
