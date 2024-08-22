const xlsx = require("node-xlsx").default;

// Returns the name of all of the sheets in the file attached to 
// the current session
exports.ListSheets = (filename) => {
  const worksheet = xlsx.parse(filename);
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

function removeBlanks(obj) {
  const result = {};
  for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] != '') {
          result[parseInt(key)] = obj[key];
      }
  }
  return result;
}

// Uses the session provided, which must contain a sheet name and a 
// mapping to perform the mapping of the data across the remaining 
// rows in the sheet to return an array of objects.
exports.MapData = (session) => {
    const worksheet = xlsx.parse(session.filename);
    const sheet = worksheet.find((x) => x.name === session.sheet)

    const entries = removeBlanks(session.mapping);

    const results = sheet.data.slice(1).map( (row) => {
        let m = new Array();

        for (const [key, _value] of Object.entries(entries)) {
          m.push(row[key]);
        }

        return m;
    });

    return results;
}