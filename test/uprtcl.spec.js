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
  let batchRegistrator = accounts[4];
  
  let batchId01;
  let perspectiveIds01 = [];
  let perspectiveIds02 = [];

  let batchId02;
  let perspectiveIds03 = [];
  
  it.skip('should persist a perspective', async () => {
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
      contextId: contextCid,
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

  it.skip('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspectiveIdStr);

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
  });

  it.skip('should persist a perspective with a head', async () => {
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
      contextId: context2IdStr,
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

  it.skip('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspective2IdStr);

    let perspectiveRead = await uprtclInstance.getPerspective(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headId, head2IdStr, "head2 Cid is not what was expected");
  });

  it.skip('should not be able to persist an existing perspective', async () => {
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

  it.skip('should not be able to persist a perspective without owner', async () => {
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

  it.skip('should not be able to update the head of a perspective if not owner', async () => {
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
      [{perspectiveIdHash: perspectiveIdHash,headId:headIdStr}],
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'unauthorized access', "unexpected reason");
        failed = true
      });

    assert.isTrue(failed, "the head was updated");

  });

  it.skip('should be able to update the head of a perspective if owner', async () => {
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
      [{perspectiveIdHash: perspectiveIdHash,headId:headIdStr}],
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

  it.skip('should not be able to change the owner of a perspective if not the current owner', async () => {
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

  it.skip('should be able to change the owner of a perspective if it is the current owner', async () => {
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

  it.skip('should be able to update the head of a perspective as the new owner', async () => {
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
      [{perspectiveIdHash: perspectiveIdHash,headId:newheadIdStr}],
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

  it.skip('should not be able to update the head of a perspective as the old owner', async () => {
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
      [{perspectiveIdHash: perspectiveIdHash,headId:newBadheadIdStr}],
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
    let nonce = 10;
    let tx = await uprtclInstance.initBatch(
      batchOwner, nonce, [], [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs[0].args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, nonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId01 = event.batchId;

    let batchRead = await uprtclInstance.getBatch(batchId01);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
  });

  it('should be able to add headUpdates to existing empty batch', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create 10 perspectives */
    let contextNonces = [1, 2, 3, 4, 5];
    
    let calls = await contextNonces.map(async (nonce) => {
      const context = { creatorId: 'did:uport:123', timestamp: 0, nonce: nonce }
  
      let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
       /** store this string to simulate the step from string to cid */
      contextIdStr = contextCid.toString();
      
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: 0,
        contextId: contextCid,
        name: 'test perspective'
      }
  
      let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
      /** store this string to simulate the step from string to cid */
      perspectiveIdStr = perspectiveCid.toString();
      perspectiveIds01.push(perspectiveIdStr);
      
      /** perspective and context ids are hashed to fit in bytes32
       * their multihash is hashed so different cids map to the same perspective */
      let contextIdHash = await hash(contextCid);
      let perspectiveIdHash = await hash(perspectiveCid);
      
      return uprtclInstance.addPerspective(
        perspectiveIdHash,
        contextIdHash,
        '',
        batchOwner,
        perspectiveIdStr,
        { from: batchRegistrator })
    });

    await Promise.all(calls);

    /** create updateHeads pairs */
    let headUpdatesCalls = perspectiveIds01.map(async (perspectiveId) => {
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
        headId: headIdStr
      }
    })

    headUpdates = await Promise.all(headUpdatesCalls);
    
    /** init batch with headUpdates */
    let tx = await uprtclInstance.addUpdatesToBatch(
      batchId01, headUpdates,
      { from: batchRegistrator })
    
    let batchRead = await uprtclInstance.getBatch(batchId01);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
    assert.equal(batchRead.headUpdates.length, perspectiveIds01.length, "unexpected number of updateHeads registered")
    
    batchRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

  it('should be able to create a new batch with update heads', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create 10 perspectives */
    let contextNonces = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    let calls = await contextNonces.map(async (nonce) => {
      const context = { creatorId: 'did:uport:123', timestamp: 0, nonce: nonce }
  
      let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
       /** store this string to simulate the step from string to cid */
      contextIdStr = contextCid.toString();
      
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: 0,
        contextId: contextCid,
        name: 'test perspective'
      }
  
      let perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
      /** store this string to simulate the step from string to cid */
      perspectiveIdStr = perspectiveCid.toString();
      perspectiveIds03.push(perspectiveIdStr);
      
      /** perspective and context ids are hashed to fit in bytes32
       * their multihash is hashed so different cids map to the same perspective */
      let contextIdHash = await hash(contextCid);
      let perspectiveIdHash = await hash(perspectiveCid);
      
      return uprtclInstance.addPerspective(
        perspectiveIdHash,
        contextIdHash,
        '',
        batchOwner,
        perspectiveIdStr,
        { from: batchRegistrator })
    });

    await Promise.all(calls);

    /** create 10 updateHeads pairs */
    let headUpdatesCalls = perspectiveIds03.map(async (perspectiveId) => {
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
        headId: headIdStr
      }
    })

    headUpdates = await Promise.all(headUpdatesCalls);
    
    batchNonce = 11;
    /** init batch with headUpdates */
    let tx = await uprtclInstance.initBatch(
      batchOwner, batchNonce, headUpdates, [batchRegistrator],
      { from: batchRegistrator })
    
    let event = tx.logs[0].args;
    assert.equal(event.owner, batchOwner, "unexpected batch owner")
    assert.equal(event.nonce, batchNonce, "unexpected nonce")
    assert.notEqual(event.batchId, '', "empty batch id")

    batchId02 = event.batchId;

    let batchRead = await uprtclInstance.getBatch(batchId);
    assert.equal(batchRead.owner, batchOwner, "unexpected batch owner")
    assert.equal(batchRead.approvedAddresses[0], batchRegistrator, "unexpected approvedAddress")
    assert.equal(batchRead.status, 1, "unexpected status")
    assert.equal(batchRead.authorized, 0, "unexpected authorized")
    assert.equal(batchRead.headUpdates.length, perspectiveIds03.length, "unexpected number of updateHeads registered")
    
    batchRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

});
