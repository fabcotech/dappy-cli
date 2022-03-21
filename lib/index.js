#!/usr/bin/env node

const initFn = require('./init').init;
const pushDappFn = require('./pushDapp').pushDapp;
const pushRecordFn = require('./pushRecord').pushRecord;
const webconfigFn = require('./webconfig').webconfig;

const init = process.argv.includes('init');
const pushDapp = process.argv.includes('pushdapp');
const pushRecord = process.argv.includes('pushrecord');
const nginx = process.argv.includes('nginx');
const apache = process.argv.includes('apache');

if (init) {
  initFn();
} else if (pushDapp) {
  pushDappFn();
} else if (pushRecord) {
  pushRecordFn();
} else if (nginx) {
  webconfigFn('nginx', process.argv.includes('--commands'));
} else if (apache) {
  webconfigFn('apache', process.argv.includes('--commands'));
} else {
  throw new Error('Unrecognized command');
}
