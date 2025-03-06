import { test, expect } from '@playwright/test';

import * as fixtures from "./helpers/fixtures";

import { UploadPage } from './helpers/upload_page';
import { SheetSelectorPage } from './helpers/sheet_selector_page';
import { HeaderSelectorPage } from './helpers/header_selector_page';
import { FooterSelectorPage } from './helpers/footer_selector_page'
import { MappingPage } from './helpers/mapping_page'

const path = require('node:path');

// Take a screenshot to help with debugging
const screenshot = async (page, name) => {
    await page.screenshot({ path: name, fullPage: true });
}

test('tiny files', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Start now').click();

    // ---------------------------------------------------------------------------
    // Upload a file
    await expect(page).toHaveURL(/.upload/)

    const uploadPage = new UploadPage(page)
    const browseButton = await uploadPage.browseButton()

    await browseButton.click();
    await browseButton.setInputFiles(fixtures.getFixture('small-file.csv'));
    await uploadPage.submit();

    // ---------------------------------------------------------------------------
    // Select sheet
    await expect(page).toHaveURL(/.select_sheet/)

    const sheets = new SheetSelectorPage(page);

    // There is only a single sheet, it should default be selected and the table
    // visible
    const radioButton = await sheets.getRadio('Sheet1')
    await expect(radioButton).toBeChecked();
    const vis = await sheets.getTableProperty(0, 'visibility')
    await expect(vis).toBe('visible')

    // // Check the data is present in the sheet previews
    const previewRow = await sheets.getTableRow(0, 0)
    const zerozero = await previewRow.locator("td").nth(0).textContent()
    const zeroone = await previewRow.locator("td").nth(1).textContent()
    await expect(zerozero).toBe("A")
    await expect(zeroone).toBe("B")

    await sheets.submit()

    // ---------------------------------------------------------------------------
    // Select some cells for a header row
    // We will use the entire first row as our selection
    await expect(page).toHaveURL(/.select_header_row/)

    const headers = new HeaderSelectorPage(page)
    await headers.select([0, 0], [0, 1])
    await headers.submit()

    // // ---------------------------------------------------------------------------
    // // Do not choose a footer row, just click Skip
    await expect(page).toHaveURL(/.select_footer_row/)

    const footers = new FooterSelectorPage(page)
    await footers.skip()

    // // ---------------------------------------------------------------------------
    // // Perform the mapping after checking the previews here are what we expect
    await expect(page).toHaveURL(/.mapping/)
    const mapping = new MappingPage(page)

    const expectedColumns = ["A", "B"]
    const expectedExamples = [
        "1",
        "2",
    ]

    const colNames = await mapping.getColumnNames()
    expect(colNames).toStrictEqual(expectedColumns)

    const examples = await mapping.getExamples()
    expect(examples).toStrictEqual(expectedExamples)

    await mapping.setMapping('A', 'Title')
    await mapping.setMapping('B', 'Surname')
    await mapping.submit()

    // // ---------------------------------------------------------------------------
    // // Should be on the success page
    await expect(page).toHaveURL(/.success/)
});
