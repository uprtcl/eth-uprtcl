const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const {
  randomInt,
  randomVec,
  multibaseToUint,
  cidConfig1,
  cidToHex32,
  generateCid,
  ZERO_HEX_32,
  getPerspectiveHead,
  getPerspectiveDetails
} = require("./utils");

var BN = web3.utils.BN;

contract('All', (accounts) => {

  const creator = accounts[9];
  const firstOwner = accounts[1];
  const observer = accounts[3];
  
  const newOwner = accounts[8];

  const god = accounts[0];

  const proposalOwner = accounts[0];
  const requestRegistrator = accounts[4];

  const accountOwner = accounts[6];

  const ADD_FEE = new BN(500000000000000);
  const UPDATE_FEE = new BN(200000000000000);
  const PROPOSAL_MIN_FEE = new BN(500000000000000);
  const PROPOSAL_NUM = new BN(10);
  const PROPOSAL_DEN = new BN(100);


  let uprtclRoot;
  let uprtclDetails;
  let uprtclAccounts;
  let uprtclProposals;
  let erc20Instance;

  it('should set superusers', async () => {
    uprtclRoot = await UprtclRoot.deployed();
    uprtclDetails = await UprtclDetails.deployed();
    uprtclAccounts = await UprtclAccounts.deployed();
    uprtclProposals = await UprtclProposals.deployed();
    erc20Instance = await ERC20Mintable.deployed();

    /** set uprtclRoot */
    let failed = false;
    await uprtclDetails.setUprtclRoot(uprtclRoot.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    await uprtclDetails.setUprtclRoot(uprtclRoot.address, { from: god });
    await uprtclProposals.setUprtclRoot(uprtclRoot.address, { from: god });
    
    /** set super users */
    failed = false;
    await uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    /** root can consume and transfer funds from accounts */
    await uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god });
    
    /* details can add a perspective without paying fees */
    await uprtclRoot.setSuperUser(uprtclDetails.address, true, { from: god });    

    /* proposals can add update heads without paying fees */
    await uprtclRoot.setSuperUser(uprtclProposals.address, true, { from: god }); 


  })

  it('should be able to set the fees', async () => {
    const godRead = await uprtclRoot.owner({ from: observer });
    assert.equal(godRead, god, "god not as expected");

    const fees = await uprtclRoot.getFees({ from: observer });
    
    assert.isTrue(fees.addFee.eq(new BN(0)), 'add fee not zero');
    assert.isTrue(fees.updateFee.eq(new BN(0)), 'update fee not zero');

    let failed = false;
    await uprtclRoot.setFees(ADD_FEE, UPDATE_FEE, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "fees set did not failed");

    await uprtclRoot.setFees(ADD_FEE, UPDATE_FEE, { from: god })
    
    const fees2 = await uprtclRoot.getFees({ from: observer });
    assert.isTrue(fees2.addFee.eq(ADD_FEE), 'add fee not zero');
    assert.isTrue(fees2.updateFee.eq(UPDATE_FEE), 'update fee not zero');

    failed = false;
    await uprtclRoot.transferOwnership(newOwner, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "owner transfer did not failed");

    await uprtclRoot.transferOwnership(newOwner, { from: god });

    const result2 = await uprtclRoot.owner({ from: observer });
    assert.equal(result2, newOwner, "owner not as expected");

    failed = false;
    await uprtclRoot.transferOwnership(observer, { from: god }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "owner transfer did not failed");

    /** leave owner as the owner, not newOwner */
    await uprtclRoot.transferOwnership(god, { from: newOwner });
  })

  it('should be able to set the accounts', async () => {
    /** set accounts token */
    let failed = false;
    await uprtclAccounts.setToken(erc20Instance.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "token set did not failed");

    await uprtclAccounts.setToken(erc20Instance.address, { from: god });
    
    failed = false;
    await uprtclRoot.setAccounts(uprtclAccounts.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "accounts set did not failed");

    await uprtclRoot.setAccounts(uprtclAccounts.address, { from: god });
  })

  it('should persist and read a perspective - no fees', async () => {
    await uprtclRoot.setFees(0, 0, { from: god })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    const result = await uprtclRoot.createPerspective(
      newPerspective, observer,
      { from: creator });

    console.log(`createPerspective gas cost: ${result.receipt.gasUsed}`);

    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    
    const ownerRead = await uprtclRoot.getPerspectiveOwner(
      perspectiveIdHash,
      { from: observer });

    const perspectiveHead = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);

    assert.equal(ownerRead, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveHead.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveHead.headCid1, ZERO_HEX_32, "head is not what was expected");
  });

  it('should persist and read a perspective - with fees', async () => {
    await uprtclRoot.setFees(ADD_FEE, 0, { from: god })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    /** mint tokens to the accountOwner */
    await erc20Instance.mint(accountOwner, ADD_FEE, { from: god });

    const accountBalance = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance.eq(ADD_FEE), "account balance not as expected");

    /** acountOwner gives UprtclAcconts allowance */
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    /** the acountOwner gives the creator the right to consume from his balance */
    await uprtclAccounts.setUsufructuary(creator, true, { from: accountOwner });
    const isUsufructurary = await uprtclAccounts.isUsufructuary(accountOwner, creator);

    assert.equal(isUsufructurary, true, 'usufructuary not set');

    const result = await uprtclRoot.createPerspective(
      newPerspective, accountOwner,
      { from: creator });

    console.log(`createPerspective with payment gas cost: ${result.receipt.gasUsed}`);

    const accountBalance2 = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance2.eq(new BN(0)), "account balance not as expected");

    const uprtclBalance = await erc20Instance.balanceOf(uprtclAccounts.address);
    assert.isTrue(uprtclBalance.eq(ADD_FEE), "uprtcl balance not as expected");
    
    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    
    const ownerRead = await uprtclRoot.getPerspectiveOwner(
      perspectiveIdHash,
      { from: observer });

    const perspectiveHead = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);

    assert.equal(ownerRead, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveHead.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveHead.headCid1, ZERO_HEX_32, "head is not what was expected");
  });

  it('should persist and read a perspective with head', async () => {
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    /** head */
    const data = {
      text: 'This is my data 2'
    }

    const dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123456',
      timestamp: randomInt(),
      message: 'test commit 2',
      parentsIds: [],
      dataId: dataId.toString()
    }

    const headId = await generateCid(JSON.stringify(head), cidConfig1);
    const headCidStr = headId.toString();
    const headCidParts = cidToHex32(headCidStr);

    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: headCidParts[0],
      headCid0: headCidParts[1],
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    const result = await uprtclRoot.createPerspective(
      newPerspective, accountOwner,
      { from: creator });

    console.log(`createPerspective with head gas cost: ${result.receipt.gasUsed}`);

    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    
    const ownerRead = await uprtclRoot.getPerspectiveOwner(
      perspectiveIdHash,
      { from: observer });

    const perspectiveHead = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);

    assert.equal(ownerRead, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveHead.headCid0, headCidParts[1], "head is not what was expected");
    assert.equal(perspectiveHead.headCid1, headCidParts[0], "head is not what was expected");
  });
  
  it('should persist and update a perspective', async () => {
    await uprtclRoot.setFees(ADD_FEE, UPDATE_FEE, { from: god })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclRoot.createPerspective(
      newPerspective, accountOwner,
      { from: creator });

    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    
    const ownerRead1 = await uprtclRoot.getPerspectiveOwner(
      perspectiveIdHash,
      { from: observer });

    const perspectiveHead1 = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);

    assert.equal(ownerRead1, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveHead1.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveHead1.headCid1, ZERO_HEX_32, "head is not what was expected");

    const data = {
      text: 'This is my data ads'
    }

    const dataId = await generateCid(JSON.stringify(data), cidConfig1);

    const head = {
      creatorId: 'did:uport:123',
      timestamp: randomInt(),
      message: 'test commit new',
      parentsIds: [],
      dataId: dataId.toString()
    }

    const headId = await generateCid(JSON.stringify(head), cidConfig1);
    const headCidStr = headId.toString();
    const headCidParts = cidToHex32(headCidStr);

    await uprtclAccounts.setUsufructuary(observer, true, { from: accountOwner });
    await erc20Instance.mint(accountOwner, UPDATE_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPDATE_FEE, { from: accountOwner });

    let failed = false;
    await uprtclRoot.updateHead(
      perspectiveIdHash, headCidParts[0], headCidParts[1], accountOwner,
      { from: observer })
    .catch((error) => {
      assert.equal(error.reason, 'only the owner can update the perspective', "unexpected reason");
      failed = true
    });

    await uprtclAccounts.setUsufructuary(observer, false, { from: accountOwner });
    const isUsufructurary = await uprtclAccounts.isUsufructuary(accountOwner, observer);
    assert.equal(isUsufructurary, false, 'usufructuary not set');

    assert.isTrue(failed, "update the perspective did not failed");

    await uprtclAccounts.setUsufructuary(firstOwner, true, { from: accountOwner });

    const result = await uprtclRoot.updateHead(
      perspectiveIdHash, headCidParts[0], headCidParts[1], accountOwner,
      { from: firstOwner });

      await uprtclAccounts.setUsufructuary(firstOwner, false, { from: accountOwner });

    console.log(`updateHead gas cost: ${result.receipt.gasUsed}`);

    const ownerRead2 = await uprtclRoot.getPerspectiveOwner(
      perspectiveIdHash,
      { from: observer });

    const perspectiveHead2 = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);

    assert.equal(ownerRead2, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveHead2.headCid0, headCidParts[1], "head is not what was expected");
    assert.equal(perspectiveHead2.headCid1, headCidParts[0], "head is not what was expected");
  });

  it('should be able to add a batch of perspectives', async () => {
    const timestamps = randomVec(50);

    const buildPerspectivesPromises = timestamps.map(async (timestamp) => {

      const data = {
        text: 'This is my data ads'
      }

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: 'did:uport:123',
        timestamp: timestamp + 1,
        message: 'test commit new',
        parentsIds: [],
        dataId: dataId.toString()
      }
      
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);
      
      return {
        perspectiveId: perspectiveCid.toString(),
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        owner: firstOwner
      }
    });

    const perspectives = await Promise.all(buildPerspectivesPromises);

    const fee = ADD_FEE.mul(new BN(perspectives.length));

    await erc20Instance.mint(accountOwner, fee, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, fee, { from: accountOwner });

    let result = await uprtclRoot.createPerspectiveBatch(
      perspectives, accountOwner, { from: creator } );

    console.log(`createPerspectiveBatch gas cost: ${result.receipt.gasUsed}`)

    const checkOwnersPromises = await timestamps.map(async (timestamp) => {
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());

      const ownerRead = await uprtclRoot.getPerspectiveOwner(
        perspectiveIdHash,
        { from: observer });
  
      assert.equal(ownerRead, firstOwner, "owner is not what was expected");
    })

    await Promise.all(checkOwnersPromises);

  });

  it('should be able to set the details of a persective', async () => {
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclRoot.createPerspective(
      newPerspective, accountOwner,
      { from: creator });

    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    const currentContext = await getPerspectiveDetails(uprtclDetails, perspectiveIdHash);
    
    assert.equal(currentContext, '', "wrong context");

    const context = 'my-context';

    let failed = false;
    await uprtclDetails.setPerspectiveDetails(
      perspectiveIdHash,
      context,
      { from: observer } )
    .catch((error) => {
      assert.equal(error.reason, 'details can only by set by perspective owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "set details did not fail");
    
    await uprtclDetails.setPerspectiveDetails(
        perspectiveIdHash,
        context,
        { from: firstOwner } )

    const newContext = await getPerspectiveDetails(uprtclDetails, perspectiveIdHash);

    assert.equal(newContext, 'my-context', "wrong context");

  });

  it('should be able to init a persective with head and details', async () => {
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    const context = 'my-context';

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclDetails.initPerspective(
        { perspective: newPerspective, context },
        accountOwner,
        { from: creator } )

    const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveCid.toString());
    const newDetails = await getPerspectiveDetails(uprtclDetails, perspectiveIdHash);

    assert.equal(newDetails, 'my-context', "wrong context");

  });

  it('should be able to init a batch of persectives with head and details', async () => {

    const timestamps = randomVec(40);

    const buildPerspectivesPromises = timestamps.map(async (timestamp) => {

      const data = {
        text: `This is my data ${randomInt()}`
      }

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: 'did:uport:123',
        timestamp: timestamp + 1,
        message: 'test commit new',
        parentsIds: [],
        dataId: dataId.toString()
      }
      
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);

      const ethPerspective = {
        perspectiveId: perspectiveCid.toString(),
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        owner: firstOwner
      }

      const context = (timestamp + 2).toString();
      
      return { perspective: ethPerspective, context };
    });

    const perspectivesData = await Promise.all(buildPerspectivesPromises);

    const fee = ADD_FEE.mul(new BN(perspectivesData.length));

    await erc20Instance.mint(accountOwner, fee, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, fee, { from: accountOwner });

    const result = await uprtclDetails.initPerspectiveBatch(
        perspectivesData,
        accountOwner,
        { from: creator } )

    console.log(`initPerspectiveBatch gas cost: ${result.receipt.gasUsed}`)

    const checkOwnersPromises = perspectivesData.map(async (perspectiveData) => {
      
      const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveData.perspective.perspectiveId);

      let ownerRead = await uprtclRoot.getPerspectiveOwner(perspectiveIdHash);

      const perspectiveHead = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);
  
      assert.equal(ownerRead, perspectiveData.perspective.owner, "owner is not what was expected");
      assert.equal(perspectiveHead.headCid1, perspectiveData.perspective.headCid1, "headCid1 is not what was expected");
      assert.equal(perspectiveHead.headCid0, perspectiveData.perspective.headCid0, "headCid0 is not what was expected");

      const contextRead = await getPerspectiveDetails(uprtclDetails, perspectiveIdHash);
    
      assert.equal(contextRead, perspectiveData.context, "wrong context");
    })

    await Promise.all(checkOwnersPromises);
  });

  it('should be able to create a new proposal - free', async () => {
    
    await uprtclRoot.setFees(0, 0, { from: god })

    const toPerspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const fromPerspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const toPerspectiveCid = await generateCid(JSON.stringify(toPerspective), cidConfig1);
    const fromPerspectiveCid = await generateCid(JSON.stringify(fromPerspective), cidConfig1);
    const nonce = 0;

    /** head updates */
    const timestamps = randomVec(10);

    const buildPerspectivesPromises = timestamps.map(async (timestamp) => {

      const data = {
        text: `This is my data ${randomInt()}`
      }

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: 'did:uport:123',
        timestamp: timestamp + 1,
        message: 'test commit new',
        parentsIds: [],
        dataId: dataId.toString()
      }
      
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);

      const ethPerspective = {
        perspectiveId: perspectiveCid.toString(),
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        owner: firstOwner
      }

      const context = (timestamp + 2).toString();
      
      return { perspective: ethPerspective, context };
    });

    const perspectivesData = await Promise.all(buildPerspectivesPromises);

    await uprtclDetails.initPerspectiveBatch(
      perspectivesData,
      accountOwner,
      { from: creator } )

    const buildUpdatesPromises = perspectivesData.map(async (perspectivesData) => {

      const data = {
        text: `This is my data ${randomInt()}`
      }

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: 'did:uport:123',
        timestamp: randomInt(),
        message: 'test commit new',
        parentsIds: [],
        dataId: dataId.toString()
      }

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);
      const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectivesData.perspective.perspectiveId);

      const headUpdate = {
        perspectiveIdHash: perspectiveIdHash,
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        fromPerspectiveId: "",
        fromHeadId: ""
      }

      return { perspectivesData, headUpdate };
    });

    const updates = await Promise.all(buildUpdatesPromises);

    const newProposal = {
      toPerspectiveId: toPerspectiveCid.toString(), 
      fromPerspectiveId: fromPerspectiveCid.toString(), 
      toHeadId: '',
      fromHeadId: '',
      owner: firstOwner, 
      nonce: nonce, 
      headUpdates: updates.map(u => u.headUpdate), 
      approvedAddresses: []
    }

    const result = await uprtclProposals.initProposal(
      newProposal, accountOwner,
      { from: requestRegistrator })

    console.log(`initProposal gas cost: ${result.receipt.gasUsed}`)
    
    const proposalId01 = await uprtclProposals.getProposalId(
      toPerspectiveCid.toString(),
      fromPerspectiveCid.toString(),
      nonce);

    let proposalRead = await uprtclProposals.getProposal(proposalId01);

    const proposalDetails = await uprtclProposals.getPastEvents('ProposalCreated', {
      filter: { proposalId: proposalId01 },
      fromBlock: 0
    });

    const perspectiveDetails = proposalDetails.map(e => {
        return {
          toPerspectiveId: e.returnValues.toPerspectiveId,
          fromPerspectiveId: e.returnValues.fromPerspectiveId,
          toHeadId: e.returnValues.toHeadId,
          fromHeadId: e.returnValues.fromHeadId,
          nonce: e.returnValues.fromHeadId
        }
      });

    assert.equal(perspectiveDetails.length, 1, 'unexpected number of initProposal events');

    assert.equal(perspectiveDetails[0].toPerspectiveId, toPerspectiveCid.toString(), "unexpected request toPerspectiveCid")
    assert.equal(perspectiveDetails[0].fromPerspectiveId, fromPerspectiveCid.toString(), "unexpected request fromPerspectiveCid")

    assert.equal(proposalRead.owner, firstOwner, "unexpected request owner")
    assert.equal(proposalRead.approvedAddresses.length, 0, "unexpected approvedAddress")
    assert.equal(proposalRead.status, 1, "unexpected status")
    assert.equal(proposalRead.authorized, 0, "unexpected authorized")

    proposalRead.headUpdates.map((update, ix) => {
      assert.equal(update.perspectiveIdHash, updates[ix].headUpdate.perspectiveIdHash, "unexpected request toPerspectiveCid")
      assert.equal(update.headCid1, updates[ix].headUpdate.headCid1, "unexpected request headCid1")
      assert.equal(update.headCid0, updates[ix].headUpdate.headCid0, "unexpected request headCid1")
    })

    failed = false;
    await uprtclProposals.authorizeProposal(
      proposalId01, 1, false,
      { from: requestRegistrator }).catch((error) => {
      assert.equal(error.reason, 'Proposal can only by authorized by its owner');
      failed = true
    });
    assert.isTrue(failed, "setProposalAuthorized set did not failed");

    await uprtclProposals.authorizeProposal(
      proposalId01, 1, false,
      { from: firstOwner })


    /** check heads are original */
    const checkHeadsPromises = perspectivesData.map(async (perspectiveData) => {
      const perspectiveIdHash = await uprtclRoot.getPerspectiveIdHash(perspectiveData.perspective.perspectiveId);

      const ownerRead = await uprtclRoot.getPerspectiveOwner(
        perspectiveIdHash,
        { from: observer });

      const perspectiveHead = await getPerspectiveHead(uprtclRoot, perspectiveIdHash);
  
      assert.equal(ownerRead, firstOwner, "owner is not what was expected");
      assert.equal(perspectiveHead.headCid0, perspectiveData.perspective.headCid0, "head is not what was expected");
      assert.equal(perspectiveHead.headCid1, perspectiveData.perspective.headCid1, "head is not what was expected");
    })

    await Promise.all(checkHeadsPromises);

    await uprtclProposals.executeProposalExternal(
      proposalId01,
      { from: firstOwner });

    /** check heads are original */
    const checkHeadsPromisesAfter = updates.map(async (update) => {
      const ownerRead = await uprtclRoot.getPerspectiveOwner(
        update.headUpdate.perspectiveIdHash,
        { from: observer });

      const perspectiveHead = await getPerspectiveHead(uprtclRoot, update.headUpdate.perspectiveIdHash);
  
      assert.equal(ownerRead, firstOwner, "owner is not what was expected");
      assert.equal(perspectiveHead.headCid0, update.headUpdate.headCid0, "head is not what was expected");
      assert.equal(perspectiveHead.headCid1, update.headUpdate.headCid1, "head is not what was expected");
    })

    await Promise.all(checkHeadsPromisesAfter);

  });

  it('should be able to create a new proposal - with fee', async () => {

    let failed = false;
    await uprtclProposals.setMinFee(PROPOSAL_MIN_FEE, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    await uprtclProposals.setMinFee(PROPOSAL_MIN_FEE, { from: god })
    await uprtclProposals.setFactorNum(PROPOSAL_NUM, { from: god })
    await uprtclProposals.setFactorDen(PROPOSAL_DEN, { from: god })

    const toPerspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const fromPerspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const toPerspectiveCid = await generateCid(JSON.stringify(toPerspective), cidConfig1);
    const fromPerspectiveCid = await generateCid(JSON.stringify(fromPerspective), cidConfig1);
    
    const nonce = 0;

    await uprtclAccounts.setUsufructuary(requestRegistrator, true, { from: accountOwner });
    await erc20Instance.mint(accountOwner, PROPOSAL_MIN_FEE, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, PROPOSAL_MIN_FEE, { from: accountOwner });


    const newProposal = {
      toPerspectiveId: toPerspectiveCid.toString(), 
      fromPerspectiveId: fromPerspectiveCid.toString(), 
      toHeadId: '',
      fromHeadId: '',
      owner: proposalOwner, 
      nonce: nonce, 
      headUpdates: [], 
      approvedAddresses: []
    }

    const result = await uprtclProposals.initProposal(
      newProposal, accountOwner,
      { from: requestRegistrator })

      
    console.log(`initProposal gas cost: ${result.receipt.gasUsed}`)
    
    const proposalId01 = await uprtclProposals.getProposalId(
      toPerspectiveCid.toString(),
      fromPerspectiveCid.toString(),
      nonce);

    let proposalRead = await uprtclProposals.getProposal(proposalId01);
    assert.equal(proposalRead.owner, proposalOwner, "unexpected request owner")
    assert.equal(proposalRead.approvedAddresses.length, 0, "unexpected approvedAddress")
    assert.equal(proposalRead.status, 1, "unexpected status")
    assert.equal(proposalRead.authorized, 0, "unexpected authorized")
    await uprtclProposals.setMinFee(0, { from: god })
  });

  
});
