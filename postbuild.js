const fs = require("fs");
const archiver = require("archiver");

const output = fs.createWriteStream("./public/build.zip");
const archive = archiver("zip", {
  zlib: { level: 9 }, // set compression to best
});

const MAX = 13 * 1024; // 13kb

output.on("close", () => {
  const bytes = archive.pointer();
  const percent = ((bytes / MAX) * 100).toFixed(2);
  if (bytes > MAX) {
    console.error(`Size overflow: ${bytes} bytes (${percent}%)`);
  } else {
    console.log(`Size: ${bytes} bytes (${percent}%)`);
  }
});

archive.on("warning", (err) => {
  if (err.code === "ENOENT") {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.file("./public/index.html", { name: "index.html" });
archive.file("./public/main.js", { name: "main.js" });
archive.finalize();
