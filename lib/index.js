const initFn = require("./init").init;
const buildFn = require("./build").build;
const pushFn = require("./push").push;
const pushFileFn = require("./pushFile").pushFile;
const updateFn = require("./update").update;

const init = process.argv.includes("init");
const build = process.argv.includes("build");
const push = process.argv.includes("push");
const pushFile = process.argv.includes("push-file");
const update = process.argv.includes("update");

if (init) {
  initFn();
} else if (build) {
  buildFn();
} else if (push) {
  pushFn();
} else if (update) {
  updateFn();
} else if (pushFile) {
  pushFileFn();
} else {
  console.log("Unrecognized command");
  process.exit();
}
