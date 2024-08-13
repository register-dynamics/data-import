exports.CreateSession = function (request) {
  const response = {
    id: "",
    error: undefined,
  };

  const file = request.file;
  if (!file) {
    response.error = "Please attach a file";
    return response;
  }

  const err = validateUpload(file);
  if (err != undefined) {
    response.error = err;
    return response;
  }

  response.id = "foo";

  return response;
};

function validateUpload(file) {
  if (
    file.mimetype !=
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Uploaded file was not an XLSX file";
  }

  return undefined;
}
