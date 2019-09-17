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

/** simulate a Cid as the one that will be received by the contract */
const generateCid = async (message, cidConfig) => {
  const b = Buffer.from(message);
  const encoded = await multihashing(b, cidConfig.type);
  return new CID(cidConfig.version, cidConfig.codec, encoded, cidConfig.base);
}

/** hashes the cid to fit in a bytes32 word */
const hash = async (perspectiveIdStr) => {
  const cid = new CID(perspectiveIdStr)
  const encoded = await multihashing.digest(cid.buffer, 'sha3-256');
  return '0x' + encoded.toString('hex');
}

const createNPerspectives = async (uprtclInstance, contextNonces, owner, creator) => {
  let perspectiveIds = [];
  let calls = contextNonces.map(async (nonce) => {
    const context = { creatorId: 'did:uport:123', timestamp: 0, nonce: nonce }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    contextIdStr = contextCid.toString();
    
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: 0,
      context: contextCid.toString(),
      name: 'test perspective'
    }

    let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    perspectiveIdStr = perspectiveCid.toString();
    perspectiveIds.push(perspectiveIdStr);
    
    /** perspective and context ids are hashed to fit in bytes32
     * their multihash is hashed so different cids map to the same perspective */
    let contextIdHash = await hash(contextCid);
    let perspectiveIdHash = await hash(perspectiveCid);
    
    return uprtclInstance.addPerspective(
      perspectiveIdHash,
      contextIdHash,
      '',
      owner,
      perspectiveIdStr,
      { from: creator })
  });

  await Promise.all(calls);

  return perspectiveIds;
}

const createNUpdateHeads = async (perspectiveIds) => {
  let headUpdatesCalls = perspectiveIds.map(async (perspectiveId) => {
    let perspectiveIdHash = await hash(perspectiveId); 

    const data = {
      text: Math.random().toString()
    }

    dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 615,
      message: 'test commit 4',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let headId = await generateCid(JSON.stringify(head), cidConfig1);
    headIdStr = headId.toString();

    return {
      perspectiveIdHash: perspectiveIdHash,
      headId: headIdStr,
      executed: 0
    }
  })

  headUpdates = await Promise.all(headUpdatesCalls);
  return headUpdates;
}

contract('Uprtcl', (accounts) => {

  let creator = accounts[0];
  let firstOwner = accounts[1];
  let secondOwner = accounts[2];
  let observer = accounts[3];
  
  let contextIdStr;
  let perspectiveIdStr;
  let headIdStr;

  let context2IdStr;
  let perspective2IdStr;
  let head2IdStr;

  let batchOwner = accounts[0];
  let perspectiveOwner = accounts[1];
  let batchRegistrator = accounts[4];
  
  let batchId01;
  let batchId02;

  let perspectiveIds01;
  let perspectiveIds001;
  let perspectiveIds02;
  let perspectiveIds03;
  
  it('should persist a perspective', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const context = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      nonce: 0
    }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    contextIdStr = contextCid.toString();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: 0,
      context: contextIdStr,
      name: 'test perspective'
    }

    let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    perspectiveIdStr = perspectiveCid.toString();
    
    /** perspective and context ids are hashed to fit in bytes32
     * their multihash is hashed so different cids map to the same perspective */
    let contextIdHash = await hash(contextCid);
    let perspectiveIdHash = await hash(perspectiveCid);
    
    let result = await uprtclInstance.addPerspective(
      perspectiveIdHash,
      contextIdHash,
      '',
      firstOwner,
      perspectiveIdStr,
      { from: creator });    

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspectiveIdStr);

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
  });

  it('should persist a perspective with a head', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const context = {
      creatorId: 'did:uport:123456',
      timestamp: 0,
      nonce: 0
    }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    context2IdStr = contextCid.toString();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123546',
      timestamp: 0,
      context: context2IdStr,
      name: 'test perspective 2'
    }

    let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    perspective2IdStr = perspectiveCid.toString();

    /** head */
    const data = {
      text: 'This is my data 2'
    }

    let dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123456',
      timestamp: 0,
      message: 'test commit 2',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let headId = await generateCid(JSON.stringify(head), cidConfig1);
    head2IdStr = headId.toString();
    
    /** perspective and context ids are hashed to fit in bytes32
     * their multihash is hashed so different cids map to the same perspective */
    let contextIdHash = await hash(contextCid);
    let perspectiveIdHash = await hash(perspectiveCid);
    
    let result = await uprtclInstance.addPerspective(
      perspectiveIdHash,
      contextIdHash,
      head2IdStr,
      firstOwner,
      perspectiveIdStr,
      { from: creator });    

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspective2IdStr);

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headId, head2IdStr, "head2 Cid is not what was expected");
  });

  it('should not be able to persist an existing perspective', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    let perspectiveIdHash = await hash(perspectiveIdStr);
    let contextIdHash = await hash(contextIdStr);
    
    let failed = false;
    await uprtclInstance.addPerspective(
      perspectiveIdHash,
      contextIdHash,
      '',
      creator,
      perspectiveIdStr,
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
      context: '',
      name: 'test perspective 2'
    }

    let perspectiveCid2 = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    let perspectiveIdHash2 = await hash(perspectiveCid2);
    let contextIdHash = await hash(contextIdStr);
    
    let failed = false;
    await uprtclInstance.addPerspective(
      perspectiveIdHash2,
      contextIdHash,
      '',
      '0x' + new Array(40).fill('0').join(''),
      perspectiveCid2.toString(),
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

    let dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let headId = await generateCid(JSON.stringify(head), cidConfig1);
    headIdStr = headId.toString();

    let perspectiveIdHash = await hash(perspectiveIdStr); 

    let failed = false;
    await uprtclInstance.updateHeads(
      [{perspectiveIdHash: perspectiveIdHash,headId:headIdStr, executed: 0}],
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

    let dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 8787,
      message: 'test commit new',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let headId = await generateCid(JSON.stringify(head), cidConfig1);
    headIdStr = headId.toString();

    let perspectiveIdHash = await hash(perspectiveIdStr); 

    let perspectiveReadBefore = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.headId, 
      '', 
      "original head is not null"); 
    
    let result = await uprtclInstance.updateHeads(
      [{perspectiveIdHash: perspectiveIdHash,headId:headIdStr, executed: 0}],
      { from: firstOwner });

    assert.isTrue(result.receipt.status);

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveRead.headId, 
      headIdStr, 
      "new head is not what expected"); 
  });

  it('should not be able to change the owner of a perspective if not the current owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveIdStr); 

    let failed = false
    let result = await uprtclInstance.changeOwner(
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
    let perspectiveIdHash = await hash(perspectiveIdStr); 

    let result = await uprtclInstance.changeOwner(
      perspectiveIdHash,
      secondOwner,
      { from: firstOwner });
      
    assert.isTrue(result.receipt.status, "the tx was not sent");

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, secondOwner, "owner was not updated");

  });

  it('should be able to update the head of a perspective as the new owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveIdStr); 

    const data = {
      text: 'This is my data 2'
    }

    dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 615,
      message: 'test commit 4',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let newheadId = await generateCid(JSON.stringify(head), cidConfig1);
    newheadIdStr = newheadId.toString();
    
    let perspectiveReadBefore = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.headId, 
      headIdStr, 
      "original head is not what expected"); 
    
    let result = await uprtclInstance.updateHeads(
      [{perspectiveIdHash: perspectiveIdHash,headId:newheadIdStr, executed: 0}],
      { from: secondOwner });

    assert.isTrue(result.receipt.status, "the head was not updated");

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash.toString('hex'),
      { from: observer });

    assert.equal(
      perspectiveRead.headId, 
      newheadIdStr,
      "new head is not what expected"); 
    
  });

  it('should not be able to update the head of a perspective as the old owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let perspectiveIdHash = await hash(perspectiveIdStr); 

    const data = {
      text: 'This is my data 5'
    }

    dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: 822,
      message: 'test commit 587',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let newBadheadId = await generateCid(JSON.stringify(head), cidConfig1);
    let newBadheadIdStr = newBadheadId.toString();
    
    let perspectiveReadBefore = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.headId, 
      newheadIdStr, 
      "original head is not what expected"); 
    
    let failed = false;
    let result = await uprtclInstance.updateHeads(
      [{perspectiveIdHash: perspectiveIdHash,headId:newBadheadIdStr, executed: 0}],
      { from: firstOwner }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "the head was updated");

    /** review that the head did not changed */
    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveRead.headId, 
      newheadIdStr,
      "new head is not what expected"); 
  });

  it('should be able to create a new batch without update heads', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let batchNonce = 10;
    let tx = await uprtclInstance.initBatch(
      batchOwner, batchNonce, [], [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs.find(log => log.event === 'BatchCreated').args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, batchNonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId01 = event.batchId;

    let batchRead = await uprtclInstance.getBatch(batchId01);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
  });

  it('should not be able to add headUpdates to batch if perspective owner is not batch owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create a perspective not owner by batchId01 owner */
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [23], 
      perspectiveOwner, 
      batchRegistrator);

    perspectiveIds001 = perspectiveIds;

    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    /** init batch with headUpdates */
    let failed = false;
    let tx = await uprtclInstance.addUpdatesToBatch(
      batchId01, headUpdates,
      { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Batch can only store perspectives owner by its owner', "unexpected reason");
        failed = true;
      })
    
    assert.isTrue(failed, "added update to batch for perspective not owned by batch owner");
  });

  it('should be able to add headUpdates to existing batch if perpsective owned by batch owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    for (let ix = 0; ix < perspectiveIds001.length; ix++) {
      let perspectiveIdsHash = await hash(perspectiveIds001[ix]);

      await uprtclInstance.changeOwner(
        perspectiveIdsHash,
        batchOwner,
        { from: perspectiveOwner });
    }
    
    /** init batch with headUpdates */
    await uprtclInstance.addUpdatesToBatch(
      batchId01, headUpdates,
      { from: batchRegistrator });
    
    let batchRead = await uprtclInstance.getBatch(batchId01);

    for (let ix = 0; ix < perspectiveIds001.length; ix++) {
      let perspectiveIdHash = await hash(perspectiveIds001[ix]);
      let headUpdate = batchRead.headUpdates[batchRead.headUpdates.length - perspectiveIds001.length + ix];
      assert.equal(headUpdate.perspectiveIdHash, perspectiveIdHash, "unexpected update head perspective id hash");
    }

  });
  
  it('should be able to add headUpdates to existing empty batch', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let batchNonce = 51;
    let tx = await uprtclInstance.initBatch(
      batchOwner, batchNonce, [], [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs.find(log => log.event === 'BatchCreated').args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, batchNonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId = event.batchId;

    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [101, 102, 103, 104, 105], 
      batchOwner, 
      batchRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);

    /** init batch with headUpdates */
    await uprtclInstance.addUpdatesToBatch(
      batchId, headUpdates,
      { from: batchRegistrator })
    
    let batchRead = await uprtclInstance.getBatch(batchId);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
    assert.equal(batchRead.headUpdates.length, perspectiveIds.length, "unexpected number of updateHeads registered")
    
    batchRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

  it('should be able to create a new batch with update heads', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create 10 perspectives */
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [11, 12, 13, 14, 15], 
      batchOwner, 
      batchRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    perspectiveIds02 = perspectiveIds;
    headUpdates02 = headUpdates;
    
    batchNonce = 11;
    /** init batch with headUpdates */
    let tx = await uprtclInstance.initBatch(
      batchOwner, batchNonce, headUpdates, [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs.find(log => log.event === 'BatchCreated').args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, batchNonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId02 = event.batchId;

    let batchRead = await uprtclInstance.getBatch(batchId02);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
    assert.equal(batchRead.headUpdates.length, perspectiveIds.length, "unexpected number of updateHeads registered")
    
    batchRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

  it('should be able to add headUpdates to existing full batch', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [16, 17, 18, 19, 20], 
      batchOwner, 
      batchRegistrator);
    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    perspectiveIds03 = perspectiveIds;
    headUpdates03 = headUpdates;

    /** init batch with headUpdates */
    let tx = await uprtclInstance.addUpdatesToBatch(
      batchId02, headUpdates,
      { from: batchRegistrator })
    
    let batchRead = await uprtclInstance.getBatch(batchId02);

    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
    assert.equal(
      batchRead.headUpdates.length, 
      perspectiveIds02.length + perspectiveIds.length, 
      "unexpected number of updateHeads registered")
    
    for (let ix = 0; ix < batchRead.headUpdates.length; ix++) {
      headUpdate = batchRead.headUpdates[ix];
      if (ix < perspectiveIds02.length) {
        assert.equal(
          headUpdate.headId, 
          headUpdates02[ix].headId, 
          "unexpected head id on headUpdate")
      } else {
        assert.equal(
          headUpdate.headId, 
          headUpdates03[ix - perspectiveIds02.length].headId, 
          "unexpected head id on headUpdate")
      }  
    }
  });

  it('should not be able set status if not owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    let tx = await uprtclInstance.setBatchStatus(
      batchId02, 0,
      { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Batch status can only by set by its owner', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "status was updated by a not owner");
  });

  it('should be able set status if owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    await uprtclInstance.setBatchStatus(
      batchId02, 0,
      { from: batchOwner });

    let batchRead = await uprtclInstance.getBatch(batchId02);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.status, 0, "unexpected status")
  });

  it('should not be able add new head updates with status 0', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.addUpdatesToBatch(
      batchId02, headUpdates,
      { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Batch status is disabled', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "head udates were added when disabled");
  });

  it('should not be able to execute a batch if it has not being authorized', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.executeBatch(
      batchId02, { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Batch not authorized', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "batch executed without an authorization. Tishhhh.");
  });

  it('should not be able authorize batch if not owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    let tx = await uprtclInstance.setBatchAuthorized(
      batchId02, 1,
      { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Batch can only by athorized by its owner', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "authorization was given by a not owner");
  });

  it('should be able authorize batch if owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    await uprtclInstance.setBatchAuthorized(
      batchId02, 1,
      { from: batchOwner });

    let batchRead = await uprtclInstance.getBatch(batchId02);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.authorized, 1, "unexpected authorized state")
  });

  it('should not be able to execute batch if not an approved address', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.executeBatch(
      batchId02, { from: observer }).catch((error) => {
        assert.equal(error.reason, 'msg.sender not an approved address', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "batch executed by a non approved addres..");
  });

  it('should be able to execute batch if approved address', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let batchRead = await uprtclInstance.getBatch(batchId02);
    let headUpdates = batchRead.headUpdates;

    /** make sure current head is not the value to be set */
    for (let ix = 0; ix < headUpdates.length; ix++) {
      let headUpdate = headUpdates[ix];
      let perspectiveRead = await uprtclInstance.getPerspective(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert(perspectiveRead.headId != headUpdate.headId);
    }

    await uprtclInstance.executeBatch(
      batchId02, { from: batchRegistrator });

    /** make sure current head is not the value to be set */
    for (let ix = 0; ix < headUpdates.length; ix++) {
      let headUpdate = headUpdates[ix];
      let perspectiveRead = await uprtclInstance.getPerspective(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert(perspectiveRead.headId == headUpdate.headId, "unexpected headId");
    }
  });

  it('should be able to execute only some elements of a batch', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [151, 152, 153, 154, 155], 
      batchOwner, 
      batchRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);

    let batchNonce = 21;
    let tx = await uprtclInstance.initBatch(
      batchOwner, batchNonce, headUpdates, [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs.find(log => log.event === 'BatchCreated').args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, batchNonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId = event.batchId;

    await uprtclInstance.setBatchAuthorized(
      batchId, 1,
      { from: batchOwner });

    let indexes0 = [0, 1, 2];
    
    await uprtclInstance.executeBatchPartially(
      batchId, indexes0,
      { from: batchRegistrator });

    let batchRead = await uprtclInstance.getBatch(batchId);

    for (let ix = 0; ix < indexes0.length; ix++) {
      let headUpdate = headUpdates[indexes0[ix]];
      let perspectiveRead = await uprtclInstance.getPerspective(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert.equal(perspectiveRead.headId, headUpdate.headId, "unexpected headId");
      assert.equal(batchRead.headUpdates[indexes0[ix]].executed, 1, "unexpected executed state")
    }

    let indexes1 = [3, 4];

    await uprtclInstance.executeBatchPartially(
      batchId, indexes1,
      { from: batchRegistrator });
      
    let batchRead2 = await uprtclInstance.getBatch(batchId);
      
    for (let ix = 0; ix < indexes1.length; ix++) {
      let headUpdate = headUpdates[indexes1[ix]];
      let perspectiveRead = await uprtclInstance.getPerspective(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert.equal(perspectiveRead.headId, headUpdate.headId, "unexpected headId");
      assert.equal(batchRead2.headUpdates[indexes1[ix]].executed, 1, "unexpected executed state")
    }

    /** and should not work again */
    let indexes2 = [3, 4];
    
    let failed = false;
    await uprtclInstance.executeBatchPartially(
      batchId, indexes2,
      { from: batchRegistrator }).catch((error) => {
        assert.equal(error.reason, 'head update already executed', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "head update executed twice");

  });

});
