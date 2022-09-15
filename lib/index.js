#!/usr/bin/env node

const initFn = require('./init').init;
const pushDappFn = require('./pushDapp').pushDapp;
const pushZonesFn = require('./pushZones').pushZones;
const webconfigFn = require('./webconfig').webconfig;
const generateCertFn = require('./generateCert').generateCert;
const generatePrivateKeyFn = require('./generatePrivateKey').generatePrivateKey;
const printPublicKeyFn = require('./printPublicKey').printPublicKey;
const checkFn = require('./check').check;
const helloWorldServerFn = require('./helloWorldServer').helloWorldServer;

const init = process.argv.includes("init");
const pushDapp = process.argv.includes("pushdapp");
const pushZones = process.argv.includes("pushzones");
const check = process.argv.includes("check");
const nginx = process.argv.includes("nginx");
const apache = process.argv.includes("apache");
const generateCert = process.argv.includes("generateselfsignedcert");
const generatePrivateKey = process.argv.includes("generateprivatekey");
const printPublicKey = process.argv.includes("printpublickey");
const helloworldServer = process.argv.includes("helloworldserver");

if (init) {
  initFn();
} else if (pushDapp) {
  pushDappFn();
} else if (pushZones) {
  pushZonesFn();
} else if (generatePrivateKey) {
  generatePrivateKeyFn();
} else if (printPublicKey) {
  printPublicKeyFn();
} else if (generateCert) {
  generateCertFn();
} else if (nginx) {
  webconfigFn('nginx', process.argv.includes('--commands'));
} else if (apache) {
  webconfigFn('apache', process.argv.includes('--commands'));
} else if (helloworldServer) {
  helloWorldServerFn();
} else if (check) {
  checkFn();
} else {
  throw new Error('Unrecognized command');
}
