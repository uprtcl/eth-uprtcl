const Buffer = require("buffer/").Buffer;
const CID = require("cids");
const multihashing = require("multihashing-async");
const seedrandom = require("seedrandom");
const rng = seedrandom("randomseed");

const randomInt = () => {
  return Math.floor(rng() * 1000000000);
};

const randomVec = (size) => {
  const vec = Array(size).fill(0);
  return vec.map(e => randomInt());
}

const multibaseToUint = (multibaseName) => {
  return constants.filter(e => e[0]==multibaseName)[0][1];
}

/** multibase to number */
const constants = [
  ['base8', 37 ],
  ['base10', 39 ],
  ['base16', 66 ],
  ['base32', 62 ],
  ['base32pad', 63 ],
  ['base32hex', 76 ],
  ['base32hexpad', 74 ],
  ['base32z', 68 ],
  ['base58flickr', 90 ],
  ['base58btc', 122 ],
  ['base64', 109 ],
  ['base64pad', 77 ],
  ['base64url', 75 ],
  ['Ubase64urlpad', 55 ]
];

cidConfig1 = {
  version: 1,
  codec: 'raw',
  type: 'sha3-256',
  base: 'base58btc',
}
cidConfig2 = {
  version: 1,
  codec: 'raw',
  type: 'sha3-256',
  base: 'base58btc',
}

const cidToHex32 = (cidStr) => {
  /** store the encoded cids as they are, including the multibase bytes */
  let cid = new CID(cidStr);
  let bytes = cid.buffer;

  /* push the code of the multibse (UTF8 number of the string) */
  let firstByte = new Buffer(1).fill(multibaseToUint(cid.multibaseName));
  let arr = [firstByte, bytes];
  bytesWithMultibase = Buffer.concat(arr);

  /** convert to hex */
  cidEncoded16 = bytesWithMultibase.toString('hex')
  /** pad with zeros */
  cidEncoded16 = cidEncoded16.padStart(128, '0');

  let cidHex0 = cidEncoded16.slice(-64);      /** LSB */
  let cidHex1 = cidEncoded16.slice(-128, -64);

  return ['0x' + cidHex1, '0x' + cidHex0];
}

const generateCid = async (message, cidConfig) => {
  const b = Buffer.from(message);
  const encoded = await multihashing(b, cidConfig.type);
  return new CID(cidConfig.version, cidConfig.codec, encoded, cidConfig.base);
}

const ZERO_HEX_32 = '0x' + Array(64).fill(0).join('');

const getLatestHead = async (uprtclRoot, owner) => {
  const events = await uprtclRoot.getPastEvents('HeadUpdated', {
    filter: { owner },
    fromBlock: 0
  });

  const last = events.sort((e1, e2) => (e1.blockNumber > e2.blockNumber) ? 1 : -1).pop();

  return {
    val1: last.returnValues.val1,
    val0: last.returnValues.val0
  }
}

module.exports = {
  randomInt,
  randomVec,
  multibaseToUint,
  constants,
  cidConfig1,
  cidConfig2,
  cidToHex32,
  generateCid,
  ZERO_HEX_32,
  getLatestHead
}