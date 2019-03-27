const initFn = require("./init").init;
const buildFn = require("./build").build;
const pushFn = require("./push").push;
const updateFn = require("./update").update;

const init = process.argv.contains("init");
const build = process.argv.contains("build");
const push = process.argv.contains("push");
const update = process.argv.contains("update");

if (init) {
  initFn();
} else if (build) {
  buildFn();
} else if (push) {
  pushFn();
} else if (update) {
  updateFn();
} else {
  console.log("Unrecognized command");
  process.exit();
}
