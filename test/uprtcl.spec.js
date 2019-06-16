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
    cidHex1 = new Array(64).fill('0').join('');
  } else {
    cidHex0 = cidBytes.slice(-64);
    cidHex1 = cidBytes.slice(-cidBytes.length, -64).padStart(64,'0');
  }
  
  return [ cidHex1, cidHex0 ];
}

contract('Uprtcl', (accounts) => {

  let creator = accounts[0];
  let firstOwner = accounts[1];
  let secondOwner = accounts[2];
  let observer = accounts[3];
  
  let contextIdHash;
  let perspectiveIdHash;
  let perspectiveIdHash2;
  let head1;
  let head0;

  beforeEach(() => {}) 
  afterEach(() => {}) 

  it('should persist a perspective and retrieve it', async () => {

    const context = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      nonce: 0
    }

    let contextCidParts = await generateCid(JSON.stringify(context));

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
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
      firstOwner,
      { from: creator });    

    assert.isTrue(result.receipt.status, "status not true");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
  });

  it('should not be able to persist an existing perspective', async () => {
    
    let uprtclInstance = await Uprtcl.deployed();

    let failed = false;
    await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + contextIdHash.toString('hex'),
      creator,
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'existing perspective', "unexpected reason");
        failed = true
      });

    assert.isTrue(failed, "the perspective was recreated");
    
  });

  it('should not be able to persist a perspective without owner', async () => {
    
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: 2,
      contextId: '',
      name: 'test perspective 2'
    }

    let perspectiveCidParts = await generateCid(JSON.stringify(perspective));
    perspectiveIdHash2 = await multihashing.digest(perspectiveCidParts.join(), 'sha2-256');

    let uprtclInstance = await Uprtcl.deployed();

    let failed = false;
    await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      '0x' + perspectiveIdHash2.toString('hex'),
      '0x' + contextIdHash.toString('hex'),
      '0x' + new Array(40).fill('0').join(''),
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'owner cant be empty', "unexpected reason");
        failed = true;
      });    

    assert.isTrue(failed, "the perspective was created");
    
  });

  it('should not be able to update the head of a perspective if not owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    let dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    let headParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let failed = false;
    await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + headParts[0], /** this is head1 */
      '0x' + headParts[1], /** this is head0 - LSB */
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true
      });

    assert.isTrue(failed, "the head was updated");

  });

  it('should be able to update the head of a perspective if owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    let dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 8787,
      message: 'test commit new',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    let headParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveReadBefore.head1.toString(), 
      '0x' + new Array(64).fill('0').join(''), 
      "original head is not null"); 
    
    assert.equal(
      perspectiveReadBefore.head0.toString(), 
      '0x' + new Array(64).fill('0').join(''), 
      "original head is not null"); 

    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + headParts[0], /** this is head1 */
      '0x' + headParts[1], /** this is head0 LSB */
      { from: firstOwner });

    head1 = headParts[0];
    head0 = headParts[1];  /** this is head0 LSB */
      
    assert.isTrue(result.receipt.status);

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveRead.head1.toString(), 
      '0x'+head1, 
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0.toString(), 
      '0x'+head0, 
      "new head is not what expected"); 
    
  });

  it('should not be able to change the owner of a perspective if not the current owner', async () => {
    
    let uprtclInstance = await Uprtcl.deployed();

    let failed = false
    let result = await uprtclInstance.methods['changeOwner(bytes32,address)'](
      '0x' + perspectiveIdHash.toString('hex'),
      secondOwner,
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true;
      });
      
    assert.isTrue(failed, "the owner was updated");

  });

  it('should be able to change the owner of a perspective if it is the current owner', async () => {
    
    let uprtclInstance = await Uprtcl.deployed();

    let result = await uprtclInstance.methods['changeOwner(bytes32,address)'](
      '0x' + perspectiveIdHash.toString('hex'),
      secondOwner,
      { from: firstOwner });
      
    assert.isTrue(result.receipt.status, "the tx was not sent");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(perspectiveRead.owner, secondOwner, "owner was not updated");

  });

  it('should be able to update the head of a perspective as the new owner', async () => {
    
    const data = {
      text: 'This is my data 2'
    }

    dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 615,
      message: 'test commit 4',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    let newHeadParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveReadBefore.head1, 
      '0x' + head1, 
      "original head is not what expected"); 
    
    assert.equal(
      perspectiveReadBefore.head0, 
      '0x' + head0, 
      "original head is not what expected"); 

    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + newHeadParts[0],  /** head1 */
      '0x' + newHeadParts[1],  /** head0 - LSB */
      { from: secondOwner });

    assert.isTrue(result.receipt.status, "the head was not updated");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveRead.head1, 
      '0x' + newHeadParts[0],
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0, 
      '0x' + newHeadParts[1],
      "new head is not what expected"); 

    head1 = perspectiveRead.head1;
    head0 = perspectiveRead.head0;

  });

  it('should not be able to update the head of a perspective as the old owner', async () => {
    
    const data = {
      text: 'This is my data 5'
    }

    dataIdParts = await generateCid(JSON.stringify(data));

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 822,
      message: 'test commit 587',
      parentsIds: [],
      dataId: dataIdParts.join()
    }

    let newHeadParts = await generateCid(JSON.stringify(head));

    let uprtclInstance = await Uprtcl.deployed();

    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveReadBefore.head1, 
      head1, 
      "original head is not what expected"); 
    
    assert.equal(
      perspectiveReadBefore.head0, 
      head0, 
      "original head is not what expected"); 

    let failed = false;
    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      '0x' + newHeadParts[0],
      '0x' + newHeadParts[1],
      { from: firstOwner }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "the head was updated");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      '0x' + perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveRead.head1, 
      head1,
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0, 
      head0,
      "new head is not what expected"); 

  });

});
