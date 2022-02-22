#!/usr/bin/env node

const initFn = require("./init").init;
const pushDappFn = require("./pushDapp").pushDapp;
const pushRecordFn = require("./pushRecord").pushRecord;

const init = process.argv.includes("init");
const pushDapp = process.argv.includes("pushdapp");
const pushRecord = process.argv.includes("pushrecord");

if (init) {
  initFn();
} else if (pushDapp) {
  pushDappFn();
} else if (pushRecord) {
  pushRecordFn();
} else {
  throw new Error("Unrecognized command");
}
