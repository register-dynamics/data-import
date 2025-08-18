const date = require('./date'); // For unit tests

test('string date parsing', () => {
  const ymd = date.makeCombinedDateType(['year', 'month', 'day']);

  // FIXME: Non-string cases (fill in when I have examples from real spreadsheets)

  // A generic day
  let r = ymd({ v: "2025 6 3" });
  expect(r.valid).toBeTruthy();
  expect(r.value).toMatchObject({ year: 2025, month: 6, day: 3 });
  expect(r.warnings).toMatchObject([]);

  // 29 Feb - not leap year
  r = ymd({ v: "2025 2 29" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Day numbers must be in the range 1-28 for this month, but we found 29']);

  // 29 Feb - leap year
  r = ymd({ v: "2024 2 29" });
  expect(r.valid).toBeTruthy();
  expect(r.value).toMatchObject({ year: 2024, month: 2, day: 29 });
  expect(r.warnings).toMatchObject([]);

  // day 0
  r = ymd({ v: "2025 6 0" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Day numbers must be in the range 1-30 for this month, but we found 0']);

  // month 0
  r = ymd({ v: "2025 0 1" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Month numbers must be in the range 1-12, but we found 0']);

  // day&month 0
  r = ymd({ v: "2025 0 0" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Month numbers must be in the range 1-12, but we found 0',
    'Day numbers must be in the range 1-31 for this month, but we found 0']);

  // day beyond end of month (non-Feb case)
  r = ymd({ v: "2025 6 31" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Day numbers must be in the range 1-30 for this month, but we found 31']);

  r = ymd({ v: "2025 7 32" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Day numbers must be in the range 1-31 for this month, but we found 32']);

  // Date without 3 parts
  r = ymd({ v: "2025 7" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(["Unrecognisable date format (expected 3 components, found 2)"]);

  r = ymd({ v: "2025 6 6 1" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(["Unrecognisable date format (expected 3 components, found 4)"]);

  // Month names
  r = ymd({ v: "2025 June 3" });
  expect(r.valid).toBeTruthy();
  expect(r.value).toMatchObject({ year: 2025, month: 6, day: 3 });
  expect(r.warnings).toMatchObject([]);

  r = ymd({ v: "2025 Junebuary 3" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Months must either be numbers or recognised names, but we found Junebuary']);

  // Month 13+
  r = ymd({ v: "2025 13 3" });
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(['Month numbers must be in the range 1-12, but we found 13']);

  // 2-digit years
  r = ymd({ v: "25 June 3" });
  expect(r.valid).toBeTruthy();
  expect(r.value).toMatchObject({ year: 2025, month: 6, day: 3 });
  expect(r.warnings).toMatchObject(['Guessing a two-digit year 25 is in the 21st century']);

  r = ymd({ v: "95 June 3" });
  expect(r.valid).toBeTruthy();
  expect(r.value).toMatchObject({ year: 1995, month: 6, day: 3 });
  expect(r.warnings).toMatchObject(['Guessing a two-digit year 95 is in the 20th century']);
});

const backend = require('../backend'); // For integration tests
const at = require('./attribute-types');

test('dates in ods', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/dates.ods");
  const dataRange = {
    sheet: 'Sheet1',
    start: { row: 0, column: 0 },
    end: { row: 3, column: 0 }
  };
  const mapping = {
    attributeMappings: {
      Date: 0
    },
    attributeTypes: {
      Date: at.requiredType(at.makeCombinedDateType(['day', 'month', 'year']))
    }
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);
  const jobSummary = backend.JobGetSummary(sid, jid);
  expect(jobSummary).toMatchObject({
    recordCount: 3,
    errorCount: 1,
    warningCount: 1
  });

  const warnings = backend.JobGetWarnings(sid, jid);
  expect(warnings).toStrictEqual([
    { field: "Date", row: 2, message: "Guessing a two-digit year 31 is in the 21st century" }
  ]);

  const errors = backend.JobGetErrors(sid, jid);
  expect(errors).toStrictEqual([
    { field: "Date", row: 2, message: "Day numbers must be in the range 1-30 for this month, but we found 2025" }
  ]);

  const allRecords = backend.JobGetRecords(sid, jid, 0, 3);
  expect(allRecords).toMatchObject([
    { Date: { year: 2025, month: 6, day: 9 } },
    { Date: { year: 2025, month: 4, day: 4 } },
    { Date: { year: 2025, month: 4, day: 9 } }
  ]);

  backend.JobDelete(sid, jid);

  backend.SessionDelete(sid);
});

test('dates in csv', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/dates.csv");
  const dataRange = {
    sheet: 'Sheet1',
    start: { row: 2, column: 1 },
    end: { row: 8, column: 1 }
  };
  const mapping = {
    attributeMappings: {
      Date: 0
    },
    attributeTypes: {
      Date: at.requiredType(at.makeCombinedDateType(['day', 'month', 'year']))
    }
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);
  const jobSummary = backend.JobGetSummary(sid, jid);
  expect(jobSummary).toMatchObject({
    recordCount: 4,
    errorCount: 3,
    warningCount: 3
  });

  const warnings = backend.JobGetWarnings(sid, jid);

  const errors = backend.JobGetErrors(sid, jid);

  expect(warnings).toStrictEqual([
    { field: "Date", row: 2, message: "Guessing a two-digit year 3 is in the 21st century" },
    { field: "Date", row: 6, message: "Guessing a two-digit year 25 is in the 21st century" },
    { field: "Date", row: 8, message: "Guessing a two-digit year 21 is in the 21st century" }
  ]);
  expect(errors).toStrictEqual([
    { field: "Date", row: 2, message: "Day numbers must be in the range 1-31 for this month, but we found 2025" },
    { field: "Date", row: 3, message: "Unrecognisable date format (expected 3 components, found 4)" },
    { field: "Date", row: 8, message: "Day numbers must be in the range 1-31 for this month, but we found 2025" }
  ]);

  const allRecords = backend.JobGetRecords(sid, jid, 0, 6);
  expect(allRecords).toMatchObject([
    { Date: { year: 2025, month: 6, day: 3 } },
    { Date: { year: 2003, month: 2, day: 1 } },
    { Date: { year: 2025, month: 2, day: 1 } },
    { Date: { year: 2025, month: 6, day: 3 } }
  ]);

  backend.JobDelete(sid, jid);

  backend.SessionDelete(sid);
});

test('dates in xlsx from numbers', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/dates.numbers.xlsx");
  const dataRange = {
    sheet: 'Sheet 1',
    start: { row: 2, column: 1 },
    end: { row: 8, column: 1 }
  };
  const mapping = {
    attributeMappings: {
      Date: 0
    },
    attributeTypes: {
      Date: at.requiredType(at.makeCombinedDateType(['dow', 'day', 'month', 'year']))
    }
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);
  const jobSummary = backend.JobGetSummary(sid, jid);
  const warnings = backend.JobGetWarnings(sid, jid);
  const errors = backend.JobGetErrors(sid, jid);

  expect(jobSummary).toMatchObject({
    recordCount: 7,
    errorCount: 0,
    warningCount: 0
  });

  expect(warnings).toStrictEqual([]);
  expect(errors).toStrictEqual([]);

  const allRecords = backend.JobGetRecords(sid, jid, 0, 7);
  expect(allRecords).toMatchObject([
    { Date: { year: 2025, month: 5, day: 3 } }, // "Typed out"
    { Date: { year: 2025, month: 6, day: 3 } }, // "Typed out, human readable"
    { Date: { year: 2025, month: 6, day: 3 } }, // "Set via formula"
    { Date: { year: 2003, month: 2, day: 1 } }, // "Ambiguous, but typed in UK locale"
    { Date: { year: 2025, month: 2, day: 1 } }, // "Ambiguous, format manually specified"
    { Date: { year: 2025, month: 6, day: 3 } }, // "Inserted via “Insert Current Date” "
    { Date: { year: 2025, month: 5, day: 21 } }, // "Copied and pasted"
  ]);

  backend.JobDelete(sid, jid);

  backend.SessionDelete(sid);
});

test('dates in xlsx from office 2016', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/dates.office2016.xlsx");
  const dataRange = {
    sheet: 'Sheet1',
    start: { row: 2, column: 1 },
    end: { row: 3, column: 1 }
  };
  const mapping = {
    attributeMappings: {
      Date: 0
    },
    attributeTypes: {
      Date: at.requiredType(at.makeCombinedDateType())
    }
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);
  const jobSummary = backend.JobGetSummary(sid, jid);
  const warnings = backend.JobGetWarnings(sid, jid);
  const errors = backend.JobGetErrors(sid, jid);

  expect(jobSummary).toMatchObject({
    recordCount: 2,
    errorCount: 0,
    warningCount: 0
  });

  expect(warnings).toStrictEqual([]);
  expect(errors).toStrictEqual([]);

  const allRecords = backend.JobGetRecords(sid, jid, 0, 2);
  expect(allRecords).toMatchObject([
    { Date: { year: 2025, month: 4, day: 4 } },
    { Date: { year: 2024, month: 2, day: 29 } }
  ]);

  backend.JobDelete(sid, jid);

  backend.SessionDelete(sid);
});

test('dates in xls from office 2016', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/dates.office2016.xls");
  const dataRange = {
    sheet: 'Sheet1',
    start: { row: 2, column: 1 },
    end: { row: 3, column: 1 }
  };
  const mapping = {
    attributeMappings: {
      Date: 0
    },
    attributeTypes: {
      Date: at.requiredType(at.makeCombinedDateType())
    }
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);
  const jobSummary = backend.JobGetSummary(sid, jid);
  const warnings = backend.JobGetWarnings(sid, jid);
  const errors = backend.JobGetErrors(sid, jid);

  expect(jobSummary).toMatchObject({
    recordCount: 2,
    errorCount: 0,
    warningCount: 0
  });

  expect(warnings).toStrictEqual([]);
  expect(errors).toStrictEqual([]);

  const allRecords = backend.JobGetRecords(sid, jid, 0, 2);
  expect(allRecords).toMatchObject([
    { Date: { year: 2025, month: 4, day: 4 } },
    { Date: { year: 2024, month: 2, day: 29 } }
  ]);

  backend.JobDelete(sid, jid);

  backend.SessionDelete(sid);
});
