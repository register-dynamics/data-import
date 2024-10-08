import { test, expect } from '@playwright/test';

import * as fixtures from "./helpers/fixtures";

import { UploadPage } from './helpers/upload_page';
import { SheetSelectorPage } from './helpers/sheet_selector_page';
import { HeaderSelectorPage } from './helpers/header_selector_page';
import { FooterSelectorPage } from './helpers/footer_selector_page'
import { MappingPage } from './helpers/mapping_page'

const path = require('node:path');

const sheetPreviewVisibility = new Map([
    [0, "hidden"],
    [1, "visible"],
    [2, "hidden"]
]);

// Take a screenshot to help with debugging
const screenshot = async(page, name) => {
    await page.screenshot({ path: name, fullPage: true });
}

test('trouble with tribbles', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Start now').click();

    // ---------------------------------------------------------------------------
    // Upload a file
    await expect(page).toHaveURL(/.upload/)

    const uploadPage = new UploadPage(page)
    const browseButton = await uploadPage.browseButton()

    await browseButton.click();
    await browseButton.setInputFiles(fixtures.getFixture('tribbles.xlsx'));
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
    const previewRow = await sheets.getTableRow(1, 0)
    const firstCell = await previewRow.locator("td").nth(0).textContent()
    expect(firstCell).toBe("My lovely tribbles")

    await sheets.submit()

    // ---------------------------------------------------------------------------
    // Select some cells for a header row
    // We will use Name->Markings as our selection
    await expect(page).toHaveURL(/.select_header_row/)

    const headers = new HeaderSelectorPage(page)
    await headers.select([2,0], [2,5])
    await headers.submit()

    // ---------------------------------------------------------------------------
    // Do not choose a footer row, just click Skip
    await expect(page).toHaveURL(/.select_footer_row/)

    const footers = new FooterSelectorPage(page)
    await footers.skip()

    // ---------------------------------------------------------------------------
    // Perform the mapping after checking the previews here are what we expect
    await expect(page).toHaveURL(/.mapping/)

    const mapping = new MappingPage(page)

    const expectedColumns = ["Name", "Date of birth", "Time of birth", "Weight", "Colour", "Markings"]
    const expectedExamples = [
        "Alex, Drew, Emm, Jamie, Kris",
        "1-1-24, 1-5-24, 2-3-24, 2-4-24, 3-5-24",
        "15:05, 1:00, 4:34, 6:01, 9:55",
        "4.9, 5.5, 6, 6.5, 8.4",
        "Beige, Black, Brown, Maroon, Pink",
        "Blob on top, N/A, Splotches, Yes,"
    ]

    const colNames = await mapping.getColumnNames()
    expect(colNames).toStrictEqual(expectedColumns)

    const examples = await mapping.getExamples()
    expect(examples).toStrictEqual(expectedExamples)

    await mapping.setMapping('Name', 'Code')
    await mapping.setMapping('Colour', 'Name')
    await mapping.setMapping('Markings', 'Speciality')
    await mapping.submit()

    // ---------------------------------------------------------------------------
    // Should be on the success page
    await expect(page).toHaveURL(/.success/)
});
