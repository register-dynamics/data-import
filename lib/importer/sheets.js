const xlsx = require("node-xlsx").default;

// Returns the name of all of the sheets in the file attached to 
// the current session
exports.ListSheets = (session) => {
  const worksheet = xlsx.parse(session.filename);
  const sheets = worksheet.map((sheet) => {
    return sheet.name;
  });

  return sheets;
};

// Given a session and a range (row number initially) returns the text in 
// the cells found for that row.
exports.GetHeader = (session, range=0) => {
  const worksheet = xlsx.parse(session.filename);
  const sheet = worksheet.find((x) => x.name === session.sheet)

  // We are assuming the first row is the headings for now but will 
  // do better matching in future.
  return sheet.data[range];
};