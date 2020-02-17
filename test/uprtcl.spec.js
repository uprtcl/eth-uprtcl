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
    const context = { creatorId: 'did:uport:123', timestamp: Date.now(), nonce: nonce }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    contextIdStr = contextCid.toString();
    
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: Date.now() + Math.random(),
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
      '',
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
      timestamp: Date.now(),
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

  let requestOwner = accounts[0];
  let perspectiveOwner = accounts[1];
  let requestRegistrator = accounts[4];
  
  let requestId01;
  let requestId02;

  let perspectiveIds01;
  let perspectiveIds001;
  let perspectiveIds02;
  let perspectiveIds03;
  
  it('should persist a perspective', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const context = {
      creatorId: 'did:uport:123',
      timestamp: Date.now(),
      nonce: 0
    }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    contextIdStr = contextCid.toString();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: Date.now()
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
      '',
      '',
      firstOwner,
      perspectiveIdStr,
      { from: creator });
      
    console.log(`addPerspective gas cost: ${result.receipt.gasUsed}`)

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspectiveIdStr);

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
  });

  it('should persist a perspective with a head', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    const context = {
      creatorId: 'did:uport:123456',
      timestamp: Date.now(),
      nonce: 0
    }

    let contextCid = await generateCid(JSON.stringify(context), cidConfig1);
     /** store this string to simulate the step from string to cid */
    context2IdStr = contextCid.toString();

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123546',
      timestamp: Date.now(),
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
      timestamp: Date.now(),
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
      '',
      '',
      firstOwner,
      perspectiveIdStr,
      { from: creator });    

    console.log(`addPerspective with head gas cost: ${result.receipt.gasUsed}`)

    assert.isTrue(result.receipt.status, "status not true");
  });

  it('should retrieve the perspective from its encoded cid ', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIdHash = await hash(perspective2IdStr);

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headId, head2IdStr, "head2 Cid is not what was expected");
  });

  it('should persist a batch of perspectives', async () => {
    const uprtclInstance = await Uprtcl.deployed();

    const timestamps = [Date.now(), Date.now() + 1, Date.now() + 2];

    debugger

    const buildPerspectivesDataPromises = timestamps.map(async (timestamp) => {
      const context = {
        creatorId: 'did:uport:123',
        timestamp: timestamp,
        nonce: 0
      }

      const contextCid = await generateCid(JSON.stringify(context), cidConfig1);
      /** store this string to simulate the step from string to cid */
      contextIdStr = contextCid.toString();

      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
      /** store this string to simulate the step from string to cid */
      return { 
        perspectiveId: perspectiveCid.toString(), 
        context: contextIdStr
      }
    });

    const perspectivesData = await Promise.all(buildPerspectivesDataPromises);

    const buildPerspectivesPromises = perspectivesData.map(async (perspectivesData) => {
      
      const contextCid = perspectivesData.context;
      const perspectiveCid = perspectivesData.perspectiveId;
      
      /** perspective and context ids are hashed to fit in bytes32
       * their multihash is hashed so different cids map to the same perspective */
      let contextIdHash = await hash(contextCid);
      let perspectiveIdHash = await hash(perspectiveCid);

      return {
        perspectiveIdHash: perspectiveIdHash,
        contextHash: contextIdHash,
        headId: '',
        context: '',
        name: '',
        owner: firstOwner,
        perspectiveId: perspectiveIdStr        
      }
    });

    const perspectives = await Promise.all(buildPerspectivesPromises);
    
    let result = await uprtclInstance.addPerspectiveBatch(
      perspectives, { from: creator} );
      
    console.log(`addPerspectiveBatch gas cost: ${result.receipt.gasUsed}`)

    assert.isTrue(result.receipt.status, "status not true");

    const checkOwnersPromises = await perspectivesData.map(async (perspectiveData) => {
      const perspectiveIdHash = await hash(perspectiveData.perspectiveId);
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        perspectiveIdHash,
        { from: observer });
  
      assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    })

    await Promise.all(checkOwnersPromises);
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
      '',
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
      timestamp: Date.now(),
    }

    let perspectiveCid2 = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    let perspectiveIdHash2 = await hash(perspectiveCid2);
    let contextIdHash = await hash(contextIdStr);
    
    let failed = false;
    await uprtclInstance.addPerspective(
      perspectiveIdHash2,
      contextIdHash,
      '',
      '',
      '',
      '0x' + new Array(40).fill('0').join(''),
      perspectiveCid2.toString(),
      { from: creator }).catch((error) => {
        assert.equal(error.reason, 'owner cannot be empty', "unexpected reason");
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
      timestamp: Date.now(),
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
        assert.equal(error.reason, 'only the owner can update the perspective', "unexpected reason");
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
      timestamp: Date.now(),
      message: 'test commit new',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let headId = await generateCid(JSON.stringify(head), cidConfig1);
    headIdStr = headId.toString();

    let perspectiveIdHash = await hash(perspectiveIdStr); 

    let perspectiveReadBefore = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveReadBefore.headId, 
      '', 
      "original head is not null"); 
    
    let result = await uprtclInstance.updateHeads(
      [{perspectiveIdHash: perspectiveIdHash,headId:headIdStr, executed: 0}],
      { from: firstOwner });

    console.log(`updateHeads gas cost: ${result.receipt.gasUsed}`)

    assert.isTrue(result.receipt.status);

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
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

    console.log(`changeOwner gas cost: ${result.receipt.gasUsed}`)
      
    assert.isTrue(result.receipt.status, "the tx was not sent");

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
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
      timestamp: Date.now(),
      message: 'test commit 4',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let newheadId = await generateCid(JSON.stringify(head), cidConfig1);
    newheadIdStr = newheadId.toString();
    
    let perspectiveReadBefore = await uprtclInstance.getPerspectiveDetails(
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

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
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
      timestamp: Date.now(),
      message: 'test commit 587',
      parentsIds: [],
      dataId: dataId.toString()
    }

    let newBadheadId = await generateCid(JSON.stringify(head), cidConfig1);
    let newBadheadIdStr = newBadheadId.toString();
    
    let perspectiveReadBefore = await uprtclInstance.getPerspectiveDetails(
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
        assert.equal(error.reason, 'only the owner can update the perspective', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "the head was updated");

    /** review that the head did not changed */
    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(
      perspectiveRead.headId, 
      newheadIdStr,
      "new head is not what expected"); 
  });

  it('should be able to create a new request without update heads', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    let toPerspectiveIdHash = await hash(perspectiveIdStr);
    let fromPerspectiveIdHash = await hash(perspective2IdStr);
    let requestNonce = 10;

    const result = await uprtclInstance.initRequest(
      toPerspectiveIdHash, 
      fromPerspectiveIdHash, 
      requestOwner, 
      requestNonce, 
      [], 
      [requestRegistrator],
      perspectiveIdStr,
      perspective2IdStr,
      { from: requestRegistrator })

    console.log(`initRequest gas cost: ${result.receipt.gasUsed}`)
    
    requestId01 = await uprtclInstance.getRequestId(
      toPerspectiveIdHash,
      fromPerspectiveIdHash,
      requestNonce);

    let requestRead = await uprtclInstance.getRequest(requestId01);
    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.approvedAddresses[0], requestRegistrator, "unexpected approvedAddress")
    assert.equal(requestRead.status, 1, "unexpected status")
    assert.equal(requestRead.authorized, 0, "unexpected authorized")
  });

  it('should not be able to add headUpdates to request if perspective owner is not request owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create a perspective not owner by requestId01 owner */
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [23], 
      perspectiveOwner, 
      requestRegistrator);

    perspectiveIds001 = perspectiveIds;

    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    /** init request with headUpdates */
    let failed = false;
    let tx = await uprtclInstance.addUpdatesToRequest(
      requestId01, headUpdates,
      { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'request can only store perspectives owner by its owner', "unexpected reason");
        failed = true;
      })
    
    assert.isTrue(failed, "added update to request for perspective not owned by request owner");
  });

  it('should be able to add headUpdates to existing request if perpsective owned by request owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    for (let ix = 0; ix < perspectiveIds001.length; ix++) {
      let perspectiveIdsHash = await hash(perspectiveIds001[ix]);

      await uprtclInstance.changeOwner(
        perspectiveIdsHash,
        requestOwner,
        { from: perspectiveOwner });
    }
    
    /** init request with headUpdates */
    const result = await uprtclInstance.addUpdatesToRequest(
      requestId01, headUpdates,
      { from: requestRegistrator });

    console.log(`addUpdatesToRequest gas cost: ${result.receipt.gasUsed}`)
    
    let requestRead = await uprtclInstance.getRequest(requestId01);

    for (let ix = 0; ix < perspectiveIds001.length; ix++) {
      let perspectiveIdHash = await hash(perspectiveIds001[ix]);
      let headUpdate = requestRead.headUpdates[requestRead.headUpdates.length - perspectiveIds001.length + ix];
      assert.equal(headUpdate.perspectiveIdHash, perspectiveIdHash, "unexpected update head perspective id hash");
    }

  });
  
  it('should be able to add headUpdates to existing empty request', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let toPerspectiveIdHash = await hash(perspectiveIdStr);
    let fromPerspectiveIdHash = await hash(perspective2IdStr);
    let requestNonce = 51;

    await uprtclInstance.initRequest(
      toPerspectiveIdHash, 
      fromPerspectiveIdHash, 
      requestOwner, 
      requestNonce, 
      [], 
      [requestRegistrator],
      perspectiveIdStr,
      perspective2IdStr,
      { from: requestRegistrator })
    
    let requestId = await uprtclInstance.getRequestId(
      toPerspectiveIdHash,
      fromPerspectiveIdHash,
      requestNonce);

    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [101, 102, 103, 104, 105], 
      requestOwner, 
      requestRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);

    /** init request with headUpdates */
    await uprtclInstance.addUpdatesToRequest(
      requestId, headUpdates,
      { from: requestRegistrator })
    
    let requestRead = await uprtclInstance.getRequest(requestId);
    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.approvedAddresses[0], requestRegistrator, "unexpected approvedAddress")
    assert.equal(requestRead.status, 1, "unexpected status")
    assert.equal(requestRead.authorized, 0, "unexpected authorized")
    assert.equal(requestRead.headUpdates.length, perspectiveIds.length, "unexpected number of updateHeads registered")
    
    requestRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

  it('should be able to create a new request with update heads', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    /** create 10 perspectives */
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [11, 12, 13, 14, 15], 
      requestOwner, 
      requestRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    perspectiveIds02 = perspectiveIds;
    headUpdates02 = headUpdates;

    let toPerspectiveIdHash = await hash(perspectiveIdStr);
    let fromPerspectiveIdHash = await hash(perspective2IdStr);
    let requestNonce = 11;
    
    const result = await uprtclInstance.initRequest(
      toPerspectiveIdHash, 
      fromPerspectiveIdHash, 
      requestOwner, 
      requestNonce, 
      headUpdates02, 
      [requestRegistrator],
      perspectiveIdStr,
      perspective2IdStr,
      { from: requestRegistrator })

    console.log(`initRequest gas cost: ${result.receipt.gasUsed}`)
    
    requestId02 = await uprtclInstance.getRequestId(
        toPerspectiveIdHash,
        fromPerspectiveIdHash,
        requestNonce);

    let requestRead = await uprtclInstance.getRequest(requestId02);
    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.approvedAddresses[0], requestRegistrator, "unexpected approvedAddress")
    assert.equal(requestRead.status, 1, "unexpected status")
    assert.equal(requestRead.authorized, 0, "unexpected authorized")
    assert.equal(requestRead.headUpdates.length, perspectiveIds.length, "unexpected number of updateHeads registered")
    
    requestRead.headUpdates.forEach((registeredHeadUpdate) => {
      foundHeadUpdate = headUpdates.find(headUpdate => headUpdate.perspectiveIdHash === registeredHeadUpdate.perspectiveIdHash);
      assert.equal(foundHeadUpdate.headId, registeredHeadUpdate.headId, "unexpected head id on headUpdate")
    })
  });

  it('should be able to add headUpdates to existing full request', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [16, 17, 18, 19, 20], 
      requestOwner, 
      requestRegistrator);
    let headUpdates = await createNUpdateHeads(perspectiveIds);
    
    perspectiveIds03 = perspectiveIds;
    headUpdates03 = headUpdates;

    /** init request with headUpdates */
    let tx = await uprtclInstance.addUpdatesToRequest(
      requestId02, headUpdates,
      { from: requestRegistrator })
    
    let requestRead = await uprtclInstance.getRequest(requestId02);

    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.approvedAddresses[0], requestRegistrator, "unexpected approvedAddress")
    assert.equal(requestRead.status, 1, "unexpected status")
    assert.equal(requestRead.authorized, 0, "unexpected authorized")
    assert.equal(
      requestRead.headUpdates.length, 
      perspectiveIds02.length + perspectiveIds.length, 
      "unexpected number of updateHeads registered")
    
    for (let ix = 0; ix < requestRead.headUpdates.length; ix++) {
      headUpdate = requestRead.headUpdates[ix];
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
    let tx = await uprtclInstance.setRequestStatus(
      requestId02, 0,
      { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Request status can only by set by its owner', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "status was updated by a not owner");
  });

  it('should be able set status if owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    await uprtclInstance.setRequestStatus(
      requestId02, 0,
      { from: requestOwner });

    let requestRead = await uprtclInstance.getRequest(requestId02);
    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.status, 0, "unexpected status")
  });

  it('should be able set status to disabled if approved', async () => {
    let uprtclInstance = await Uprtcl.deployed();

    await uprtclInstance.setRequestStatus(
      requestId02, 1,
      { from: requestOwner });

    let requestRead01 = await uprtclInstance.getRequest(requestId02);
    assert.equal(requestRead01.status, 1, "unexpected status")
    
    await uprtclInstance.closeRequest(
      requestId02,
      { from: requestRegistrator });

    let requestRead02 = await uprtclInstance.getRequest(requestId02);
    assert.equal(requestRead02.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead02.status, 0, "unexpected status")
  });

  it('should not be able add new head updates with status 0', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.addUpdatesToRequest(
      requestId02, headUpdates,
      { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'request status is disabled', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "head udates were added when disabled");
  });

  it('should not be able to execute a request if it has not being authorized', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.executeRequest(
      requestId02, { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Request not authorized', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "request executed without an authorization. Tishhhh.");
  });

  it('should not be able authorize request if not owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    let tx = await uprtclInstance.setRequestAuthorized(
      requestId02, 1,
      { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'Request can only by authorized by its owner', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "authorization was given by a not owner");
  });

  it('should be able authorize request if owner', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    await uprtclInstance.setRequestAuthorized(
      requestId02, 1,
      { from: requestOwner });

    let requestRead = await uprtclInstance.getRequest(requestId02);
    assert.equal(requestRead.owner, requestOwner, "unexpected request owner")
    assert.equal(requestRead.authorized, 1, "unexpected authorized state")
  });

  it('should not be able to execute request if not an approved address', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let failed = false;
    await uprtclInstance.executeRequest(
      requestId02, { from: observer }).catch((error) => {
        assert.equal(error.reason, 'msg.sender not an approved address', "unexpected reason");
        failed = true;
      })

    assert.isTrue(failed, "request executed by a non approved addres..");
  });

  it('should be able to execute request if approved address', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let requestRead = await uprtclInstance.getRequest(requestId02);
    let headUpdates = requestRead.headUpdates;

    assert(requestRead.approvedAddresses[0] === requestRegistrator);

    /** make sure current head is not the value to be set */
    for (let ix = 0; ix < headUpdates.length; ix++) {
      let headUpdate = headUpdates[ix];
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert(perspectiveRead.headId != headUpdate.headId);
    }

    await uprtclInstance.executeRequest(
      requestId02, { from: requestRegistrator });

    /** make sure current head is not the value to be set */
    for (let ix = 0; ix < headUpdates.length; ix++) {
      let headUpdate = headUpdates[ix];
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert(perspectiveRead.headId == headUpdate.headId, "unexpected headId");
    }
  });

  it('should be able to execute only some elements of a request', async () => {
    let uprtclInstance = await Uprtcl.deployed();
    
    let perspectiveIds = await createNPerspectives(
      uprtclInstance, 
      [151, 152, 153, 154, 155], 
      requestOwner, 
      requestRegistrator);

    let headUpdates = await createNUpdateHeads(perspectiveIds);

    let toPerspectiveIdHash = await hash(perspectiveIdStr);
    let fromPerspectiveIdHash = await hash(perspective2IdStr);
    let requestNonce = 21;

    await uprtclInstance.initRequest(
      toPerspectiveIdHash, 
      fromPerspectiveIdHash, 
      requestOwner, 
      requestNonce, 
      headUpdates, 
      [requestRegistrator], 
      perspectiveIdStr, 
      perspective2IdStr,
      { from: requestRegistrator })

    let requestId = await uprtclInstance.getRequestId(
        toPerspectiveIdHash,
        fromPerspectiveIdHash,
        requestNonce);
    
    await uprtclInstance.setRequestAuthorized(
      requestId, 1,
      { from: requestOwner });

    let indexes0 = [0, 1, 2];
    
    await uprtclInstance.executeRequestPartially(
      requestId, indexes0,
      { from: requestRegistrator });

    let requestRead = await uprtclInstance.getRequest(requestId);

    for (let ix = 0; ix < indexes0.length; ix++) {
      let headUpdate = headUpdates[indexes0[ix]];
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert.equal(perspectiveRead.headId, headUpdate.headId, "unexpected headId");
      assert.equal(requestRead.headUpdates[indexes0[ix]].executed, 1, "unexpected executed state")
    }

    let indexes1 = [3, 4];

    await uprtclInstance.executeRequestPartially(
      requestId, indexes1,
      { from: requestRegistrator });
      
    let requestRead2 = await uprtclInstance.getRequest(requestId);
      
    for (let ix = 0; ix < indexes1.length; ix++) {
      let headUpdate = headUpdates[indexes1[ix]];
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        headUpdate.perspectiveIdHash,
        { from: observer });
      
      assert.equal(perspectiveRead.headId, headUpdate.headId, "unexpected headId");
      assert.equal(requestRead2.headUpdates[indexes1[ix]].executed, 1, "unexpected executed state")
    }

    /** and should not work again */
    let indexes2 = [3, 4];
    
    let failed = false;
    await uprtclInstance.executeRequestPartially(
      requestId, indexes2,
      { from: requestRegistrator }).catch((error) => {
        assert.equal(error.reason, 'head update already executed', "unexpected reason");
        failed = true;
      });

    assert.isTrue(failed, "head update executed twice");

  });

});
