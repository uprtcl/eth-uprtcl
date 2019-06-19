const Uprtcl = artifacts.require("Uprtcl");

const CID = require('cids');
const multihashing = require('multihashing-async')
const Buffer = require('buffer/').Buffer;
const toBuffer = require('typedarray-to-buffer')

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

const multibaseToUint = (multibaseName) => {
  return constants.filter(e => e[0]==multibaseName)[0][1];
}

const uintToMultibase = (number) => {
  return constants.filter(e => e[1]==number)[0][0];
}

/** simulate a Cid as the one that will be received by the contract */
const generateCid = async (message, cidConfig) => {
  const b = Buffer.from(message);
  const encoded = await multihashing(b, cidConfig.type);
  return new CID(cidConfig.version, cidConfig.codec, encoded, cidConfig.base);
}

/** hashes the cid to fit in a bytes32 word */
const hash = async (perspectiveCidStr) => {
  const cid = new CID(perspectiveCidStr)
  const encoded = await multihashing.digest(cid.buffer, 'sha3-256');
  return '0x' + encoded.toString('hex');
}

const cidToHeadParts = (cidStr) => {
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

  return [ '0x' + cidHex1, '0x' + cidHex0 ];
}

const headPartsToCid = (headParts) => {
  let cidHex1 = headParts[0].substring(2);
  let cidHex0 = headParts[1].substring(2); /** LSB */
  
  let cidHex = cidHex1.concat(cidHex0).replace(/^0+/, '');
  let cidBufferWithBase = Buffer.from(cidHex, 'hex');
  
  let multibaseCode = cidBufferWithBase[0];
  let cidBuffer = cidBufferWithBase.slice(1)

  let multibaseName = uintToMultibase(multibaseCode);

  /** Force Buffer class */
  let cid = new CID(toBuffer(cidBuffer));
  
  return cid.toBaseEncodedString(multibaseName);
}

contract('Uprtcl', (accounts) => {

  let creator = accounts[0];
  let firstOwner = accounts[1];
  let secondOwner = accounts[2];
  let observer = accounts[3];
  
  let contextCidStr;
  let perspectiveCidStr;
  let headCidStr;
  
  it('should persist a perspective', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    debugger 

    const context = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      nonce: 0
    }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    contextCidStr = contextCid.toString();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: 0,
      contextId: '',
      name: 'test perspective'
    }

    let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    perspectiveCidStr = perspectiveCid.toString();
    
    /** perspective and context ids are hashed to fit in bytes32
     * their multihash is hashed so different cids map to the same perspective */
    let contextIdHash = await hash(contextCid);
    let perspectiveIdHash = await hash(perspectiveCid);
    
    let result = await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      perspectiveIdHash,
      contextIdHash,
      firstOwner,
      { from: creator });    

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspectiveCidStr);

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
  });

  it('should not be able to persist an existing perspective', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    let perspectiveIdHash = await hash(perspectiveCidStr);
    let contextIdHash = await hash(contextCidStr);

    let failed = false;
    await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      perspectiveIdHash,
      contextIdHash,
      creator,
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'existing perspective', "unexpected reason");
        failed = true
      });
      
    assert.isTrue(failed, "the perspective was recreated");
    
  });

  it('should not be able to persist a perspective without owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: 2,
      contextId: '',
      name: 'test perspective 2'
    }

    let perspectiveCid2 = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    let perspectiveIdHash2 = await hash(perspectiveCid2);
    let contextIdHash = await hash(contextCidStr);

    let failed = false;
    await uprtclInstance.methods['addPerspective(bytes32,bytes32,address)'](
      perspectiveIdHash2,
      contextIdHash,
      '0x' + new Array(40).fill('0').join(''),
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'owner cant be empty', "unexpected reason");
        failed = true;
      });    

    assert.isTrue(failed, "the perspective was created");
    
  });

  it('should not be able to update the head of a perspective if not owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const data = {
      text: 'This is my data'
    }

    let dataIdCid = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataIdCid.toString()
    }

    let headCid = await generateCid(JSON.stringify(head), cidConfig1);
    headCidStr = headCid.toString();

    let headParts = cidToHeadParts(headCidStr)

    let perspectiveIdHash = await hash(perspectiveCidStr); 

    let failed = false;
    await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      perspectiveIdHash,
      headParts[0], /** this is head1 */
      headParts[1], /** this is head0 - LSB */
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true
      });

    assert.isTrue(failed, "the head was updated");

  });

  it('should be able to update the head of a perspective if owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const data = {
      text: 'This is my data'
    }

    let dataIdCid = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 8787,
      message: 'test commit new',
      parentsIds: [],
      dataId: dataIdCid.toString()
    }

    let headCid = await generateCid(JSON.stringify(head), cidConfig1);
    headCidStr = headCid.toString();

    let headParts = cidToHeadParts(headCidStr);

    let perspectiveIdHash = await hash(perspectiveCidStr); 

    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
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
      perspectiveIdHash,
      headParts[0], /** this is head1 */
      headParts[1], /** this is head0 LSB */
      { from: firstOwner });

    assert.isTrue(result.receipt.status);

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveRead.head1.toString(), 
      headParts[0], 
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0.toString(), 
      headParts[1], 
      "new head is not what expected"); 

    let headCidStrRead = headPartsToCid(headParts);
    assert.equal(
      headCidStr,
      headCidStrRead,
      "new head did not parsed to the expected CID string"
    )
  });

  it('should not be able to change the owner of a perspective if not the current owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveCidStr); 

    let failed = false
    let result = await uprtclInstance.methods['changeOwner(bytes32,address)'](
      perspectiveIdHash,
      secondOwner,
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true;
      });
      
    assert.isTrue(failed, "the owner was updated");

  });

  it('should be able to change the owner of a perspective if it is the current owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveCidStr); 

    let result = await uprtclInstance.methods['changeOwner(bytes32,address)'](
      perspectiveIdHash,
      secondOwner,
      { from: firstOwner });
      
    assert.isTrue(result.receipt.status, "the tx was not sent");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, secondOwner, "owner was not updated");

  });

  it('should be able to update the head of a perspective as the new owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveCidStr); 

    const data = {
      text: 'This is my data 2'
    }

    dataIdCid = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 615,
      message: 'test commit 4',
      parentsIds: [],
      dataId: dataIdCid.toString()
    }

    let newHeadCid = await generateCid(JSON.stringify(head), cidConfig1);
    newHeadCidStr = newHeadCid.toString();
    let newHeadParts = cidToHeadParts(newHeadCidStr);

    let oldHeadParts = cidToHeadParts(headCidStr);

    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.head1, 
      oldHeadParts[0], 
      "original head is not what expected"); 
    
    assert.equal(
      perspectiveReadBefore.head0, 
      oldHeadParts[1], 
      "original head is not what expected"); 

    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      perspectiveIdHash,
      newHeadParts[0],  /** head1 */
      newHeadParts[1],  /** head0 - LSB */
      { from: secondOwner });

    assert.isTrue(result.receipt.status, "the head was not updated");

    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveRead.head1, 
      newHeadParts[0],
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0, 
      newHeadParts[1],
      "new head is not what expected"); 

    let newHeadCidStrRead = headPartsToCid(newHeadParts);
    assert.equal(
      newHeadCidStr,
      newHeadCidStrRead,
      "new head did not parsed to the expected CID string"
    )
  });

  it('should not be able to update the head of a perspective as the old owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveCidStr); 

    const data = {
      text: 'This is my data 5'
    }

    dataIdCid = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 822,
      message: 'test commit 587',
      parentsIds: [],
      dataId: dataIdCid.toString()
    }

    let newBadHeadCid = await generateCid(JSON.stringify(head), cidConfig1);
    newHeadParts = cidToHeadParts(newBadHeadCid.toString());

    /** check the current head is what expected */
    let oldHeadParts = cidToHeadParts(newHeadCidStr);
    
    let perspectiveReadBefore = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.head1, 
      oldHeadParts[0], 
      "original head is not what expected"); 
    
    assert.equal(
      perspectiveReadBefore.head0, 
      oldHeadParts[1], 
      "original head is not what expected"); 

      
    let failed = false;
    let result = await uprtclInstance.methods['updateHead(bytes32,bytes32,bytes32)'](
      perspectiveIdHash,
      newHeadParts[0],
      newHeadParts[1],
      { from: firstOwner }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "the head was updated");

    /** review that the head did not changed */
    let perspectiveRead = await uprtclInstance.methods['getPerspective(bytes32)'](
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveRead.head1, 
      oldHeadParts[0],
      "new head is not what expected"); 
    
    assert.equal(
      perspectiveRead.head0, 
      oldHeadParts[1],
      "new head is not what expected"); 

  });

});
