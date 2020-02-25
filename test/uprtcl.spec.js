const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");

const CID = require('cids');
const multihashing = require('multihashing-async')
const Buffer = require('buffer/').Buffer;
const toBuffer = require('typedarray-to-buffer')
var seedrandom = require('seedrandom');

var BN = web3.utils.BN;

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


var rng = seedrandom('randomseed');

const randomInt = () => {
  return Math.floor(rng()*1000000000);
}

const randomVec = (size) => {
  const vec = Array(size).fill(0);
  return vec.map(e => randomInt());
}

const ZERO_HEX_32 = '0x' + Array(64).fill(0).join('');

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

const stringToHex32 = (str) => {
  var bytes = Buffer.from(str, 'utf8').toString('hex');

  /** convert to hex */
  cidEncoded16 = bytes.toString('hex')
  /** pad with zeros */
  cidEncoded16 = cidEncoded16.padStart(128, '0');

  let hex0 = cidEncoded16.slice(-64);      /** LSB */
  let hex1 = cidEncoded16.slice(-128, -64);

  return ['0x' + hex1, '0x' + hex0];
}

const bytes32ToCid = (bytes) => {
  let cidHex1 = bytes[0].substring(2);
  let cidHex0 = bytes[1].substring(2); /** LSB */

  let cidHex = cidHex1.concat(cidHex0).replace(/^0+/, '');
  let cidBufferWithBase = Buffer.from(cidHex, 'hex');

  let multibaseCode = cidBufferWithBase[0];
  let cidBuffer = cidBufferWithBase.slice(1)

  let multibaseName = uintToMultibase(multibaseCode);

  /** Force Buffer class */
  let cid = new CID(toBuffer(cidBuffer));

  return cid.toBaseEncodedString(multibaseName);
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

  return ['0x' + cidHex1, '0x' + cidHex0];
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

/** simulate a Cid as the one that will be received by the contract */
const generateCid = async (message, cidConfig) => {
  const b = Buffer.from(message);
  const encoded = await multihashing(b, cidConfig.type);
  return new CID(cidConfig.version, cidConfig.codec, encoded, cidConfig.base);
}

/** hashes the cid to fit in a bytes32 word */
const hash2x32 = async (cid) => {
  const cidStrParts = cidToHex32(cid);
  const hash = web3.utils.keccak256(cidStrParts[0] + cidStrParts[1].slice(2), { encoding: 'hex' });
  return hash;
}

contract('UprtclRoot', (accounts) => {

  const creator = accounts[0];
  const firstOwner = accounts[1];
  const observer = accounts[3];
  const owner = accounts[9];
  const newOwner = accounts[8];

  const proposalOwner = accounts[0];
  const requestRegistrator = accounts[4];

  const accountOwner = accounts[6];

  const ADD_FEE = new BN(500000000000000);
  const UPDATE_FEE = new BN(200000000000000);

  it('should be able to set the fees', async () => {
    const uprtclInstance = await UprtclRoot.deployed();

    const ownerRead = await uprtclInstance.owner({ from: observer });
    assert.equal(ownerRead, owner, "owner not as expected");

    const fees = await uprtclInstance.getFees({ from: observer });
    
    assert.isTrue(fees.addFee.eq(new BN(0)), 'add fee not zero');
    assert.isTrue(fees.updateFee.eq(new BN(0)), 'update fee not zero');

    let failed = false;
    await uprtclInstance.setFees(ADD_FEE, UPDATE_FEE, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "fees set did not failed");

    await uprtclInstance.setFees(ADD_FEE, UPDATE_FEE, { from: owner })
    
    const fees2 = await uprtclInstance.getFees({ from: observer });
    assert.isTrue(fees2.addFee.eq(ADD_FEE), 'add fee not zero');
    assert.isTrue(fees2.updateFee.eq(UPDATE_FEE), 'update fee not zero');

    failed = false;
    await uprtclInstance.transferOwnership(newOwner, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "owner transfer did not failed");

    await uprtclInstance.transferOwnership(newOwner, { from: owner });

    const result2 = await uprtclInstance.owner({ from: observer });
    assert.equal(result2, newOwner, "owner not as expected");

    failed = false;
    await uprtclInstance.transferOwnership(observer, { from: owner }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "owner transfer did not failed");

    /** leave owner as the owner, not newOwner */
    await uprtclInstance.transferOwnership(owner, { from: newOwner });
  })

  it('should be able to set the accounts', async () => {
    const uprtclRoot = await UprtclRoot.deployed();
    const uprtclAccounts = await UprtclAccounts.deployed();
    const token = await ERC20Mintable.deployed();

    /** set accounts token */
    let failed = false;
    await uprtclAccounts.setToken(token.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "token set did not failed");

    await uprtclAccounts.setToken(token.address, { from: owner });
    
    failed = false;
    await uprtclRoot.setAccounts(uprtclAccounts.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "accounts set did not failed");

    await uprtclRoot.setAccounts(uprtclAccounts.address, { from: owner });
  })

  it('should persist and read a perspective - no fees', async () => {
    const uprtclInstance = await UprtclRoot.deployed();

    await uprtclInstance.setFees(0, 0, { from: owner })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

    const perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    const result = await uprtclInstance.addPerspective(
      newPerspective, observer,
      { from: creator });

    console.log(`addPerspective gas cost: ${result.receipt.gasUsed}`);
    
    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveRead.headCid1, ZERO_HEX_32, "head is not what was expected");
  });

  it('should persist and read a perspective - with fees', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const uprtclAccounts = await UprtclAccounts.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

    await uprtclInstance.setFees(ADD_FEE, 0, { from: owner })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

    const perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    /** mint tokens to the accountOwner */
    await erc20Instance.mint(accountOwner, ADD_FEE, { from: owner });

    const accountBalance = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance.eq(ADD_FEE), "account balance not as expected");

    /** acountOwner gives UprtclAcconts allowance */
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    /** the acountOwner gives the creator the right to consume from his balance */
    await uprtclAccounts.setUsufructuary(creator, true, { from: accountOwner });
    const isUsufructurary = await uprtclAccounts.isUsufructuary(accountOwner, creator);

    assert.equal(isUsufructurary, true, 'usufructuary not set');

    const result = await uprtclInstance.addPerspective(
      newPerspective, accountOwner,
      { from: creator });

    console.log(`addPerspective with payment gas cost: ${result.receipt.gasUsed}`);

    const accountBalance2 = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance2.eq(new BN(0)), "account balance not as expected");

    const uprtclBalance = await erc20Instance.balanceOf(uprtclAccounts.address);
    assert.isTrue(uprtclBalance.eq(ADD_FEE), "uprtcl balance not as expected");
    
    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveRead.headCid1, ZERO_HEX_32, "head is not what was expected");
  });

  it('should persist and read a perspective with head', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

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

    let perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: headCidParts[0],
      headCid0: headCidParts[1],
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    const result = await uprtclInstance.addPerspective(
      newPerspective, accountOwner,
      { from: creator });

    console.log(`addPerspective with head gas cost: ${result.receipt.gasUsed}`);

    let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead.headCid0, headCidParts[1], "head is not what was expected");
    assert.equal(perspectiveRead.headCid1, headCidParts[0], "head is not what was expected");
  });
  
  it('should persist and update a perspective', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const uprtclAccounts = await UprtclAccounts.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

    await uprtclInstance.setFees(ADD_FEE, UPDATE_FEE, { from: owner })

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

    let perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclInstance.addPerspective(
      newPerspective, accountOwner,
      { from: creator });

    let perspectiveRead1 = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead1.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead1.headCid0, ZERO_HEX_32, "head is not what was expected");
    assert.equal(perspectiveRead1.headCid1, ZERO_HEX_32, "head is not what was expected");

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
    await erc20Instance.mint(accountOwner, UPDATE_FEE, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, UPDATE_FEE, { from: accountOwner });
    
    let failed = false;
    await uprtclInstance.updateHead(
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

    const result = await uprtclInstance.updateHead(
      perspectiveIdHash, headCidParts[0], headCidParts[1], accountOwner,
      { from: firstOwner });

      await uprtclAccounts.setUsufructuary(firstOwner, false, { from: accountOwner });

    console.log(`updateHead gas cost: ${result.receipt.gasUsed}`);

    let perspectiveRead2 = await uprtclInstance.getPerspectiveDetails(
      perspectiveIdHash,
      { from: observer });

    assert.equal(perspectiveRead2.owner, firstOwner, "owner is not what was expected");
    assert.equal(perspectiveRead2.headCid0, headCidParts[1], "head is not what was expected");
    assert.equal(perspectiveRead2.headCid1, headCidParts[0], "head is not what was expected");
  });

  it('should be able to add a batch of perspectives', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

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
      
      /** perspective and context ids are hashed to fit in bytes32
       * their multihash is hashed so different cids map to the same perspective */
      let perspectiveIdHash = await hash2x32(perspectiveCid);

      return {
        perspectiveIdHash: perspectiveIdHash,
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        owner: firstOwner
      }
    });

    const perspectives = await Promise.all(buildPerspectivesPromises);

    const fee = ADD_FEE.mul(new BN(perspectives.length));

    await erc20Instance.mint(accountOwner, fee, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, fee, { from: accountOwner });

    let result = await uprtclInstance.addPerspectiveBatch(
      perspectives, accountOwner, { from: creator } );

    console.log(`addPerspectiveBatch gas cost: ${result.receipt.gasUsed}`)

    const checkOwnersPromises = await timestamps.map(async (timestamp) => {
      const perspective = {
        origin: 'eth://contractAddress',
        creatorId: 'did:uport:123',
        timestamp: timestamp
      }

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const perspectiveIdHash = await hash2x32(perspectiveCid);
      let perspectiveRead = await uprtclInstance.getPerspectiveDetails(
        perspectiveIdHash,
        { from: observer });
  
      assert.equal(perspectiveRead.owner, firstOwner, "owner is not what was expected");
    })

    await Promise.all(checkOwnersPromises);

  });

  it('should be able to set the details of a persective', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const detailsInstance = await UprtclDetails.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

    let perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclInstance.addPerspective(
      newPerspective, accountOwner,
      { from: creator });

    const currentDetails = await detailsInstance.getPerspectiveDetails(perspectiveIdHash);
    
    assert.equal(currentDetails.name, '', "wrong name");
    assert.equal(currentDetails.context, '', "wrong context");

    const details = {
      name: 'my-name',
      context: 'my-context'
    };

    let failed = false;
    await detailsInstance.setPerspectiveDetails(
      perspectiveIdHash,
      details,
      { from: observer } )
    .catch((error) => {
      assert.equal(error.reason, 'details can only by set by perspective owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "set details did not fail");
    
    await detailsInstance.setPerspectiveDetails(
        perspectiveIdHash,
        details,
        { from: firstOwner } )

    const newDetails = await detailsInstance.getPerspectiveDetails(perspectiveIdHash);

    assert.equal(newDetails.name, 'my-name', "wrong name");
    assert.equal(newDetails.context, 'my-context', "wrong context");

  });

  it('should be able to init a persective with head and details', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const detailsInstance = await UprtclDetails.deployed();
    const erc20Instance = await ERC20Mintable.deployed();    

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    /** store this string to simulate the step from string to cid */
    const perspectiveCidStr = perspectiveCid.toString();

    let perspectiveIdHash = await hash2x32(perspectiveCidStr);
    
    const newPerspective = {
      perspectiveIdHash: perspectiveIdHash,
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: firstOwner
    }

    const details = {
      name: 'my-name',
      context: 'my-context'
    };

    await erc20Instance.mint(accountOwner, ADD_FEE, { from: owner });
    await erc20Instance.approve(UprtclAccounts.address, ADD_FEE, { from: accountOwner });

    await uprtclInstance.setSuperUser(detailsInstance.address, { from: owner });    

    await detailsInstance.initPerspective(
        newPerspective,
        details,
        accountOwner,
        { from: creator } )

    const newDetails = await detailsInstance.getPerspectiveDetails(perspectiveIdHash);

    assert.equal(newDetails.name, 'my-name', "wrong name");
    assert.equal(newDetails.context, 'my-context', "wrong context");

  });

  it.skip('should be able to create a new proposal without update heads', async () => {
    const uprtclInstance = await UprtclRoot.deployed();
    const uprtclProposals = await UprtclProposals.deployed();

    failed = false;
    await uprtclInstance.setSuperUser(uprtclProposals.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superUser set did not afailed");

    await uprtclInstance.setSuperUser(uprtclProposals.address, { from: owner });    

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
    
    const toPerspectiveIdHash = await hash2x32(toPerspectiveCid.toString());
    const fromPerspectiveIdHash = await hash2x32(fromPerspectiveCid.toString());
    const nonce = 0;

    const result = await uprtclProposals.initProposal(
      toPerspectiveIdHash, 
      fromPerspectiveIdHash, 
      proposalOwner, 
      nonce, 
      [], 
      [],
      { from: requestRegistrator })

    console.log(`initProposal gas cost: ${result.receipt.gasUsed}`)
    
    const proposalId01 = await uprtclProposals.getProposalId(
      toPerspectiveIdHash,
      fromPerspectiveIdHash,
      nonce);

    let proposalRead = await uprtclProposals.getProposal(proposalId01);
    assert.equal(proposalRead.owner, proposalOwner, "unexpected request owner")
    assert.equal(proposalRead.approvedAddresses.length, 0, "unexpected approvedAddress")
    assert.equal(proposalRead.status, 1, "unexpected status")
    assert.equal(proposalRead.authorized, 0, "unexpected authorized")
  });
});
