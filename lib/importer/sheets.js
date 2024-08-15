const xlsx = require("node-xlsx").default;

exports.ListSheets = (filename) => {
  const worksheet = xlsx.parse(filename);
  const sheets = worksheet.map((sheet) => {
    return sheet.name;
  });

  return sheets;
};
