//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter

// Add your filters here
addFilter('lastMonthRange', function (content) {
    var lastMonth = new Date();
    lastMonth.setDate(0)

    if (content == "start") {
        lastMonth.setDate(1)
    }

    return lastMonth.toLocaleDateString('en-gb', { weekday: "long", year: "numeric", month: "short", day: "numeric" })
})
