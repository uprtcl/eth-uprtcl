const Uprtcl = artifacts.require("Uprtcl");

const CID = require('cids');
const multihashing = require('multihashing-async')
const Buffer = require('buffer/').Buffer;

const generateCid = async (message) => {
  const version = 1;
  const codec = 'raw';
  const type = 'sha2-256';

  const b = Buffer.from(message);
  const encoded = await multihashing(b, type);
  const cid = new CID(version, codec, encoded, 'base16');

  const cidBytes = cid.toString();

  /** cid can be of any length, so it is converted to 
   * two chunks of 256 bits each */
  if (cidBytes.length <= 64) {
    cidHex0 = cidBytes.padStart(64, '0');
    cidHex1 = new Array(64).fill('0');
  } else {
    cidHex0 = cidBytes.slice(-64);
    cidHex1 = cidBytes.slice(-cidBytes.length, -64).padStart(64,'0');
  }
  
  return [ cidHex1, cidHex0 ];
}

contract('Uprtcl', (accounts) => {

  let contextIdHash;
  let perspectiveIdHash;

  beforeEach(() => {}) 
  afterEach(() => {}) 

  it('should persist a perspective', async () => {

    const context = {
      creatorId: accounts[0],
      timestamp: 0,
      nonce: 0
    }

    let contextCidParts = await generateCid(JSON.stringify(context));

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: accounts[0],
      timestamp: 0,
      contextId: '',
      name: 'test perspective'
    }

    let perspectiveCidParts = await generateCid(JSON.stringify(perspective));
    
    /** perspective and context ids are stored hased to fit in a bytes32 */
    perspectiveIdHash = await multihashing.digest(perspectiveCidParts.join(), 'sha2-256');
    contextIdHash = await multihashing.digest(contextCidParts.join(), 'sha2-256');
    
    let uprtclInstance = await Uprtcl.deployed();
    
    let result = await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + contextIdHash.toString('hex'),
      accounts[1],
      { from: accounts[0] });    

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should not be able to update the head of a perspective if not owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    headParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let failed = false;
    await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + headParts[0],
      '0x' + headParts[1],
      { from: accounts[0] }).catch((error) => {
        failed = true
      });

    assert.isTrue(failed, "the head was updated");

  });

  it('should be able to update the head of a perspective if owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    headParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + headParts[0],
      '0x' + headParts[1],
      { from: accounts[1] });
      
    assert.isTrue(result.receipt.status);
    
  });
});
