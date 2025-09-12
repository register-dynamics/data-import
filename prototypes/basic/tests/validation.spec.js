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

test('validation messages are shown', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Start now').click();

    // ---------------------------------------------------------------------------
    // Upload a file
    await expect(page).toHaveURL(/.upload/)

    const uploadPage = new UploadPage(page)
    const browseButton = await uploadPage.browseButton()

    await browseButton.click();
    await browseButton.setInputFiles(fixtures.getFixture('tribbles.csv'));
    await uploadPage.submit();

    // ---------------------------------------------------------------------------
    // Select sheet
    await expect(page).toHaveURL(/.select_sheet/)

    const sheets = new SheetSelectorPage(page);

    const radioButton = await sheets.getRadio('Sheet1')
    await radioButton.check()
    expect(radioButton).toBeChecked();

    // Check sheet preview visibility, we only expect one to be shown
    expect(await sheets.getTableProperty(0, 'visibility')).toBe("visible")


    // Check the data is present in the sheet previews
    const previewRow = await sheets.getTableRow(0, 0)
    const firstCell = await previewRow.locator("td").nth(0).textContent()
    expect(firstCell).toBe("My lovely tribbles")

    await sheets.submit()

    // ---------------------------------------------------------------------------
    // Select some cells for a header row
    // We will use Name->Markings as our selection
    await expect(page).toHaveURL(/.select_header_row/)

    const headers = new HeaderSelectorPage(page)
    await headers.select([2, 0], [2, 6])
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

    const expectedColumns = ["Name", "Date of birth", "Time of birth", "Weight", "Colour", "Markings", "Notes"]
    const expectedExamples = [
        "Alex, Drew, Emm, Jamie, Kris",
        "1-1-24, 1-5-24, 2-3-24, 2-4-24, 3-5-24",
        "15:05, 1:00, 4:34, 6:01, 9:55",
        "4.9, 5.5, 6, 6.5, 8.4",
        "Beige, Brown, Maroon, Pink", // Pink appears twice but should only be in the list once
        "Blob on top, N/A, Splotches, Yes,",
        "Evil!!, My fave <3,"
    ]

    const colNames = await mapping.getColumnNames()
    expect(colNames).toStrictEqual(expectedColumns)

    const examples = await mapping.getExamples()
    expect(examples).toStrictEqual(expectedExamples)

    await mapping.setMapping('Name', 'Title')
    await mapping.setMapping('Colour', 'First name')
    await mapping.setMapping('Notes', 'Salary')
    await mapping.submit()

    // ---------------------------------------------------------------------------
    // Should be on the review page and we want to check that the total number of rows,
    // sum of salaries and avg of salaries is correct
    await expect(page).toHaveURL(/.review/)

    // We expect some validation errors, and so we check for them here.

    const error_messages =  (await page.locator(".validation-error-message").allTextContents()).map(msg => msg.trim());
    expect(error_messages).toEqual([
        "'Salary' must be a 'number'",
        "A row was found with fewer columns than expected, wanted 7 but found 6"
    ])

    const metaMessages = await page.locator(".validation-error-message ~ p").allTextContents();
    expect(metaMessages.length).toBe(2)
    expect(metaMessages[0].trim()).toBe("This error occurs twice in your data. The first time at row 5:")
    expect(metaMessages[1].trim()).toBe("This warning occurs three times in your data. The first time at row 4:")

    // Errors should be shown on the relevant cells
    const tables = await page.locator(".selectable").all();
    const errorTable = tables[0];
    const warningTable = tables[1];

    const errorCount = await errorTable.locator("tr.validation-error").count()
    const warningCount = await warningTable.locator("tr.validation-error").count()

    expect(errorCount).toBe(2)
    expect(warningCount).toBe(3)



});
