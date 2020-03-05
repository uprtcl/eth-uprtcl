const UprtclRoot = artifacts.require("UprtclRoot");
const UPNService = artifacts.require("UPNService");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");

var seedrandom = require('seedrandom');
var BN = web3.utils.BN;
var rng = seedrandom('randomseed');

const randomInt = () => {
  return Math.floor(rng()*1000000000);
}

const mineOneBlock = async () => {
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    params: [],
    id: 0,
  })
}

const startMiner = async () => {
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'miner_start',
    id: 0,
  })
}

const stopMiner = async () => {
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'miner_stop',
    id: 0,
  })
}

const mineNBlocks = async (n) => {
  await stopMiner()
  for (let i = 0; i < n; i++) {
    await mineOneBlock()
  }
  await startMiner()
}


contract('UPNService', (accounts) => {

  const account = accounts[2];
  const observer = accounts[3];
  const alice = accounts[4];

  const aliceUpn = 'alice';
  const bob = accounts[5];
  const god = accounts[9];

  let uprtclRoot;
  let upnService;
  let erc20Instance;
  let uprtclAccounts;

  let F = 0.1;
  let R = 0.005;
  let Q = web3.utils.toWei(web3.utils.toBN(2));
  let P_PER_YEAR = 4;
  let P_BLOCKS = 585600;

  it('should set uprtclRoot', async () => {
    uprtclRoot = await UprtclRoot.deployed();
    upnService = await UPNService.deployed();
    erc20Instance = await ERC20Mintable.deployed();
    uprtclAccounts = await UprtclAccounts.deployed();

    /** set uprtclRoot */
    let failed = false;
    await upnService.setUprtclRoot(uprtclRoot.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    await upnService.setUprtclRoot(uprtclRoot.address, { from: god });
    await uprtclAccounts.setToken(erc20Instance.address, { from: god });
    await uprtclRoot.setAccounts(uprtclAccounts.address, { from: god });

    await uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god });
    await uprtclRoot.setSuperUser(upnService.address, true, { from: god });    
  })

  it('should be able to register and transfer a UPN - free', async () => {
    const upn = {
      owner: alice,
      V: 0,
      P: 0
    }
    await upnService.registerUPN(aliceUpn, upn, account, 0, { from: alice });

    const aliceUpnHash = await upnService.hashUpn(aliceUpn);
    const upnRead = await upnService.getUPN(aliceUpnHash, { from: observer });

    assert.equal(upnRead.owner, alice, "UPN owner not expected");

    let failed = false;

    const upnBob = {
      owner: bob,
      V: 0,
      P: 0
    }

    failed = false;
    await upnService.registerUPN(aliceUpn, upnBob, account, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'upn not available', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn register did not failed");

    failed = false;
    await upnService.transferUPN(await upnService.hashUpn(aliceUpn), bob, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'upn can only be updated by its current owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn trasnfer did not failed");

    await upnService.transferUPN(await upnService.hashUpn(aliceUpn), bob, { from: alice })

    const newUpnRead = await upnService.getUPN(aliceUpnHash, { from: observer });
    assert.equal(newUpnRead.owner, bob, "UPN owner not expected");

    /** leave it to the name of alice */
    await upnService.transferUPN(await upnService.hashUpn(aliceUpn), alice, { from: bob })
    const finalUpn = await upnService.getUPN(aliceUpnHash, { from: observer });
    assert.equal(finalUpn.owner, alice, "UPN owner not expected");
  })

  it('should be able to configure COST parameters', async () => {
    const DECIMALS = await upnService.DECIMALS();
    assert.isTrue(DECIMALS.eq(new BN(1000000)), "decimals not expected");
    
    failed = false;
    await upnService.setFi(new BN(DECIMALS.toNumber()*F), { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "parameter set did not failed");
    
    await upnService.setFi(DECIMALS.toNumber()*F, { from: god });
    await upnService.setRi(DECIMALS.toNumber()*R, { from: god });
    await upnService.setQ(Q, { from: god });
    await upnService.setP_BLOCKS(P_BLOCKS, { from: god });
    await upnService.setP_PER_YEAR(P_PER_YEAR, { from: god });
  })

  it('should be able to register and transfer a UPN - with V and P', async () => {
    const DECIMALS = await upnService.DECIMALS();
    const Ri = web3.utils.toBN(DECIMALS.toNumber()*R);
    
    const V = web3.utils.toWei(web3.utils.toBN(100000));
    const P = new BN(16);
    const taxRead = await upnService.getTaxPerYear(V, P);
    const taxExpected = V.mul(Ri).div(DECIMALS).add(Q.mul(P.mul(P)));

    assert.isTrue(taxExpected.eq(web3.utils.toWei(web3.utils.toBN(1012))), "tax not expected");
    assert.isTrue(taxRead.eq(taxExpected), "tax not expected");
    
    const upnName = 'alice-2';
    const aliceConfig = {
      owner: alice,
      V: V.toString(),
      P: P.toString()
    }

    await upnService.registerUPN(upnName, aliceConfig, account, 0, { from: alice });

    const bobConfig = {
      owner: bob,
      V: V.toString(),
      P: P.toString()
    }
    const upnHash = await upnService.hashUpn(upnName);
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob });

    const upnRead = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead.owner, bob, "UPN owner not expected");

    const upnName2 = 'alice-3';
    
    /** prepay half a year */
    const UPFRONT = web3.utils.toWei(taxRead).div(new BN(36));

    await erc20Instance.mint(account, UPFRONT, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT, { from: account });
    await uprtclAccounts.setUsufructuary(alice, true, { from: account });

    await upnService.registerUPN(upnName2, aliceConfig, account, UPFRONT, { from: alice });

    const upnHash2 = await upnService.hashUpn(upnName2);
    let failed = false;
    await upnService.takeUnpaidUPN(upnHash2, bobConfig, account, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN is up-to-date on payments', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn take did not failed");

    /*** half of year time has passed */
    // console.log('time travelling');
    // await mineNBlocks(2336000/36);
    // console.log('done');

    await stopMiner();
    await startMiner();

    await upnService.takeUnpaidUPN(upnHash2, bobConfig, account, 0, { from: bob });

    const upnRead2 = await upnService.getUPN(upnHash2, { from: observer });
    assert.equal(upnRead2.owner, bob, "UPN owner not expected");

  })

  it('should be able to register UPRs of a registered UPN', async () => {
    const context = 'barack-obama';
    const cid = 'zb123';
    
    failed = false;
    await upnService.setUPR({ context, upn: aliceUpn }, cid, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'UPN not owned by msg.sender', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upr registry did not failed");

    await upnService.setUPR({ context, upn: aliceUpn }, cid, { from: alice })

    const uprHash = await upnService.hashUpr(context, aliceUpn, { from: observer });
    const cidRead = await upnService.getUPR(uprHash, cid, { from: alice });
    
    assert.equal(cidRead, cid, "UPN owner not expected");
  })
  
});

