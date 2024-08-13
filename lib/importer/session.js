const crypto = require("crypto");

let in_memory_db = new Map();

exports.CreateSession = (request) => {
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

  // We need to tie the session id to a specific upload in such a way that
  // we can find the upload from the session id, and also find session ids
  // that we might consider timed out. For now we will use the hash of the
  // filename and remember it in an in-memory dictionary
  response.id = getFilenameHash(file.filename);
  in_memory_db.set(response.id, file.filename);

  return response;
};

var getFilenameHash = (filename) => {
  var hash = crypto.createHash("md5");
  data = hash.update(filename, "utf-8");
  var gen_hash = data.digest("hex");
  return gen_hash;
};

var validateUpload = (file) => {
  if (
    file.mimetype !=
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Uploaded file was not an XLSX file";
  }

  return undefined;
};

exports.ListSessions = () => {
  return in_memory_db.keys();
};