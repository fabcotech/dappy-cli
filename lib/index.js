#!/usr/bin/env node

const initFn = require("./init").init;
const pushFn = require("./push").push;

const init = process.argv.includes("init");
const push = process.argv.includes("push");

if (init) {
  initFn();
} else if (push) {
  pushFn();
} else {
  throw new Error("Unrecognized command");
}
