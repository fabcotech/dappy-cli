const keccak256 = require("ethers/utils/solidity.js").keccak256;
const secp256k1Sign = require("secp256k1").sign;
const secp256k1Recover = require("secp256k1").recover;

module.exports.removeTrailing0x = str => {
  if (str.startsWith("0x")) return str.substring(2);
  else return str;
};

module.exports.addTrailing0x = str => {
  if (!str.startsWith("0x")) return "0x" + str;
  else return str;
};

// from eth-crypto/src/hash
module.exports.stringToKeccak256 = params => {
  const types = [];
  const values = [];
  types.push("string");
  values.push(params);
  return keccak256(types, values);
};

// from eth-crypto/src/sign
module.exports.sign = (privateKey, hash) => {
  hash = exports.addTrailing0x(hash);
  if (hash.length !== 66)
    throw new Error("Can only sign hashes, given: " + hash);

  const sigObj = secp256k1Sign(
    new Buffer(exports.removeTrailing0x(hash), "hex"),
    new Buffer(exports.removeTrailing0x(privateKey), "hex")
  );

  const recoveryId = sigObj.recovery === 1 ? "1c" : "1b";

  const newSignature = "0x" + sigObj.signature.toString("hex") + recoveryId;
  return newSignature;
};

// from eth-crypto/src/recover-public-key
module.exports.recoverPublicKey = (signature, hash) => {
  signature = exports.removeTrailing0x(signature);

  // split into v-value and sig
  const sigOnly = signature.substring(0, signature.length - 2); // all but last 2 chars
  const vValue = signature.slice(-2); // last 2 chars

  const recoveryNumber = vValue === "1c" ? 1 : 0;

  let pubKey = secp256k1Recover(
    new Buffer(exports.removeTrailing0x(hash), "hex"),
    new Buffer(sigOnly, "hex"),
    recoveryNumber,
    false
  ).toString("hex");

  // remove trailing '04'
  pubKey = pubKey.slice(2);

  return pubKey;
};
