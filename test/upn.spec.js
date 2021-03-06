const UPNService = artifacts.require("UPNService");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const UPRRegistry = artifacts.require("UPRRegistry");

var seedrandom = require('seedrandom');
var BN = web3.utils.BN;
var rng = seedrandom('randomseed');
const ZERO_ADDRESS = '0x' + new Array(40).fill('0').join('');

const randomInt = () => {
  return Math.floor(rng()*1000000000);
}

const mineOneBlock = async () => {
  return new Promise((resolve) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: new Date().getTime(),
    }, () => resolve())
  });
}

const startMiner = async () => {
  return new Promise((resolve) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'miner_start',
      params: [1],
      id: new Date().getTime(),
    }, () => resolve())
  });
}

const stopMiner = async () => {
  return new Promise((resolve) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'miner_stop',
      params: [1],
      id: new Date().getTime(),
    }, () => resolve())
  });
}

const mineNBlocks = async (n) => {
  for (let i = 0; i < n; i++) {
    await mineOneBlock();
    // console.log(`mining ${i}/${n}`)
  }
}


contract('UPNService', (accounts) => {

  const account = accounts[2];
  const observer = accounts[3];
  const alice = accounts[4];

  const aliceUpn = 'alice';
  const bob = accounts[5];
  const god = accounts[0];

  let upnService;
  let erc20Instance;
  let uprtclAccounts;

  let aliceUPR;
  let bobUPR;

  let F = 0.1;
  let R = 0.005;
  let Q = web3.utils.toWei(web3.utils.toBN(2));
  let P_PER_YEAR = 4;
  let P_BLOCKS = 585600;

  it('should set uprtclAccounts', async () => {
    upnService = await UPNService.deployed();
    erc20Instance = await ERC20Mintable.deployed();
    uprtclAccounts = await UprtclAccounts.deployed();

    /** set uprtclAccounts */
    let failed = false;
    await upnService.setAccounts(uprtclAccounts.address, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    await upnService.setAccounts(uprtclAccounts.address, { from: god });
    await uprtclAccounts.setSuperUser(upnService.address, true, { from: god });

    await uprtclAccounts.setToken(erc20Instance.address, { from: god });
  })

  it('should be able to create two UPR registries', async () => {
    aliceUPR = await UPRRegistry.new({ from: alice });
    bobUPR = await UPRRegistry.new({ from: bob });
  })

  it('should be able to register and transfer a UPN - free', async () => {
    const upn = {
      owner: alice,
      V: 0,
      P: 0,
      registry: aliceUPR.address
    }
    await upnService.registerUPN(aliceUpn, upn, account, 0, { from: alice });

    const aliceUpnHash = await upnService.hashUpn(aliceUpn);
    const upnRead = await upnService.getUPN(aliceUpnHash, { from: observer });

    assert.equal(upnRead.owner, alice, "UPN owner not expected");
    assert.equal(upnRead.registry, aliceUPR.address, "UPN owner not expected");

    let failed = false;

    const upnBob = {
      owner: bob,
      V: 0,
      P: 0,
      registry: bobUPR.address
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

  it('should be able to register and loose a UPN - without upfront payment', async () => {
    const DECIMALS = await upnService.DECIMALS();
    const P_BLOCKS = await upnService.P_BLOCKS();

    const Ri = web3.utils.toBN(DECIMALS.toNumber()*R);
    
    const V = web3.utils.toWei(web3.utils.toBN(100000));
    const P = P_BLOCKS.mul(new BN(16));
    const taxRead = await upnService.getTaxPerYear(V, P);
    const taxExpected = V.mul(Ri).div(DECIMALS).add(Q.mul(P).div(P_BLOCKS).mul(P).div(P_BLOCKS));

    assert.equal(taxExpected.toString(),web3.utils.toWei(web3.utils.toBN(1012)).toString(), "tax not expected");
    assert.equal(taxRead.toString(),taxExpected.toString(), "tax not expected");
    
    const upnName = `alice${randomInt()}`;
    const contextName = `home${randomInt()}`;
    const cidAlice = `zbAlice${randomInt()}`;
    const cidBob = `zbBob${randomInt()}`;

    const upnHash = await upnService.hashUpn(upnName);

    const aliceConfig = {
      owner: alice,
      V: V.toString(),
      P: P.toString(),
      registry: aliceUPR.address
    }

    await upnService.registerUPN(upnName, aliceConfig, account, 0, { from: alice });

    const contextHash = await upnService.hashContext(contextName);
    await aliceUPR.setUPR(contextHash, cidAlice, { from: alice });

    const uprRead = await upnService.getUPR(contextHash, upnHash);
    assert.equal(uprRead, cidAlice, "UPR value not expected");    

    let failed = false;
    await aliceUPR.setUPR(contextHash, cidBob, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upr set did not failed");

    bobUPR = await UPRRegistry.new({ from: bob });
    const bobConfig = {
      owner: bob,
      V: V.toString(),
      P: P.toString(),
      registry: bobUPR.address
    }

    await bobUPR.setUPR(contextHash, cidBob, { from: bob });

    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob });

    const upnRead = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead.owner, bob, "UPN owner not expected");
    
    const uprRead2 = await upnService.getUPR(contextHash, upnHash);
    assert.equal(uprRead2, cidBob, "UPR value not expected");   

  })

  it('should be able to register and loose a UPN - with upfront payment', async () => {
    const P_BLOCKS = await upnService.P_BLOCKS();
    const V = web3.utils.toWei(web3.utils.toBN(100000));
    const P = P_BLOCKS.mul(new BN(16));
    const taxRead = await upnService.getTaxPerYear(V, P);
     
    const upnName = `alice${randomInt()}`;
    const upnHash = await upnService.hashUpn(upnName);
    const aliceConfig = {
      owner: alice,
      V: V.toString(),
      P: P.toString(),
      registry: aliceUPR.address
    }
    const bobConfig = {
      owner: bob,
      V: V.toString(),
      P: P.toString(),
      registry: bobUPR.address
    }

    /** prepay 1 hour (aprox) */
    const UPFRONT = taxRead.div(new BN(365*24));

    // console.log({taxRead: taxRead.toString()});
    // console.log({UPFRONT: UPFRONT.toString()});

    await erc20Instance.mint(account, UPFRONT, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT, { from: account });
    await uprtclAccounts.setUsufructuary(alice, true, { from: account });

    const result = await upnService.registerUPN(upnName, aliceConfig, account, UPFRONT, { from: alice });

    const upnRead = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead.owner, alice, "UPN owner not expected");
    assert.equal(upnRead.paid, UPFRONT, "UPN owner not expected");
    assert.equal(upnRead.block0, result.receipt.blockNumber, "UPN owner not expected");

    let failed = false;
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN is up-to-date on payments', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn take did not failed");

    /*** time has passed */
    await mineNBlocks(Math.floor(2336000/(365*24)) + 10);
    
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob });

    const upnRead2 = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead2.owner, bob, "UPN owner not expected");

  })

  it('should be able to register and transfer a UPN - recharging balance', async () => {
    const P_BLOCKS = await upnService.P_BLOCKS();
    const V = web3.utils.toWei(web3.utils.toBN(100000));
    const P = P_BLOCKS.mul(new BN(16));

    const taxRead = await upnService.getTaxPerYear(V, P);
     
    const upnName = `alice${randomInt()}`;
    const upnHash = await upnService.hashUpn(upnName);
    const aliceConfig = {
      owner: alice,
      V: V.toString(),
      P: P.toString(),
      registry: aliceUPR.address
    }
    const bobConfig = {
      owner: bob,
      V: V.toString(),
      P: P.toString(),
      registry: bobUPR.address
    }

    /** prepay 1 hour (aprox) */
    const UPFRONT = taxRead.div(new BN(365*24));

    // console.log({taxRead: taxRead.toString()});
    // console.log({UPFRONT: UPFRONT.toString()});

    await erc20Instance.mint(account, UPFRONT, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT, { from: account });
    await uprtclAccounts.setUsufructuary(alice, true, { from: account });

    const result = await upnService.registerUPN(upnName, aliceConfig, account, UPFRONT, { from: alice });

    const allowance = await erc20Instance.allowance(account, UprtclAccounts.address);
    assert.equal(allowance, 0, "allowance not expected");

    const upnRead = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead.owner, alice, "UPN owner not expected");
    assert.equal(upnRead.paid, UPFRONT, "UPN owner not expected");
    assert.equal(upnRead.block0, result.receipt.blockNumber, "UPN owner not expected");

    let failed = false;
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN is up-to-date on payments', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn take did not failed");

    /** recharge with 1 hour more */
    await erc20Instance.mint(account, UPFRONT, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT, { from: account });

    await upnService.chargeUPN(upnHash, account, UPFRONT, { from: alice });
    
    /*** 1hr has passed */
    await mineNBlocks(Math.floor(2336000/(365*24)));
    
    /** it still fails */
    failed = false;
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN is up-to-date on payments', "unexpected reason");
      failed = true
    });

    /** another hour passes */
    await mineNBlocks(Math.floor(2336000/(365*24)) + 10);
    
    /** now it should be able to take the domain */
    await upnService.takeUnpaidUPN(upnHash, bobConfig, account, 0, { from: bob });

    const upnRead2 = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead2.owner, bob, "UPN owner not expected");
  })

  it('should be able to register and force-sell a UPN', async () => {
    debugger
    const DECIMALS = await upnService.DECIMALS();
    const P_BLOCKS = await upnService.P_BLOCKS();
    const Valice = web3.utils.toWei(web3.utils.toBN(100000));
    const Palice = web3.utils.toBN(100);

    const taxRead = await upnService.getTaxPerYear(Valice, Palice);
     
    const upnName = `alice${randomInt()}`;
    const upnHash = await upnService.hashUpn(upnName);
    const aliceConfig = {
      owner: alice,
      V: Valice.toString(),
      P: Palice.toString(),
      registry: aliceUPR.address
    }
    const Vbob = web3.utils.toWei(web3.utils.toBN(100000));
    const Pbob = P_BLOCKS.mul(new BN(12));
    const bobConfig = {
      owner: bob,
      V: Vbob.toString(),
      P: Pbob.toString(),
      registry: bobUPR.address
    }

    /** prepay 1 year */
    const UPFRONT = taxRead.div(new BN(1));

    await erc20Instance.mint(account, UPFRONT, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT, { from: account });
    await uprtclAccounts.setUsufructuary(alice, true, { from: account });
    
    const registerTx = await upnService.registerUPN(upnName, aliceConfig, account, UPFRONT, { from: alice });

    const upnRead = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead.owner, alice, "UPN owner not expected");
    assert.equal(upnRead.paid, UPFRONT, "UPN owner not expected");
    assert.equal(upnRead.block0, registerTx.receipt.blockNumber, "UPN owner not expected");

    /** bob account */
    await uprtclAccounts.setUsufructuary(bob, true, { from: bob });
    await erc20Instance.mint(bob, Valice, { from: god });
    
    let failed = false;
    await upnService.takeUPN(upnHash, bobConfig, bob, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'ERC20: transfer amount exceeds allowance', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn take did not failed");

    /** now bob approved the payment of V */
    const bobBalance = await erc20Instance.balanceOf(bob, { from: observer });
    const uprtclBalance = await erc20Instance.balanceOf(uprtclAccounts.address, { from: observer });
    const aliceBalance = await erc20Instance.balanceOf(alice, { from: observer });
    
    await erc20Instance.approve(UprtclAccounts.address, Valice, { from: bob });
    const takeTx = await upnService.takeUPN(upnHash, bobConfig, bob, { from: bob })

    const bobBalanceAfter = await erc20Instance.balanceOf(bob, { from: observer });
    const uprtclBalanceAfter = await erc20Instance.balanceOf(uprtclAccounts.address, { from: observer });
    const aliceBalanceAfter = await erc20Instance.balanceOf(alice, { from: observer });

    assert.isTrue(
      bobBalance.sub(bobBalanceAfter).eq(Valice),
      "bob balance not expected"
    );

    const uprtlcFee = Valice.mul(new BN(DECIMALS*F)).div(DECIMALS);
    assert.isTrue(
      uprtclBalanceAfter.sub(uprtclBalance).eq(uprtlcFee),
      "uprtclAccounts balance not expected"
    );

    assert.isTrue(
      aliceBalanceAfter.sub(aliceBalance).eq(Valice.sub(uprtlcFee)),
      "alice balance not expected"
    );

    /** upn taken, but alice is still the owner */
    const upnRead2 = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead2.owner, alice, "UPN owner not expected");
    assert.equal(upnRead2.paid, UPFRONT, "UPN owner not expected");
    assert.equal(upnRead2.block0, registerTx.receipt.blockNumber, "UPN owner not expected");

    const expBlockAvailable = web3.utils.toBN(takeTx.receipt.blockNumber).add(Palice);

    assert.equal(upnRead2.taken, 1, "UPN not expected");
    assert.equal(upnRead2.newOwner, bob, "UPN not expected");
    assert.isTrue(web3.utils.toBN(upnRead2.blockAvailable).eq(expBlockAvailable), "UPN not expected");
    assert.isTrue(web3.utils.toBN(upnRead2.newV).eq(Vbob), "UPN not expected");
    assert.isTrue(web3.utils.toBN(upnRead2.newP).eq(Pbob), "UPN not expected");

    /** UPN is taken by Bob, but registry is still alice's */
    const contextName = `home${randomInt()}`;
    const cidAlice = `zbAlice${randomInt()}`;
    const cidBob = `zbBob${randomInt()}`;

    const contextHash = await upnService.hashContext(contextName);
    await aliceUPR.setUPR(contextHash, cidAlice, { from: alice });

    const uprRead = await upnService.getUPR(contextHash, upnHash, { from: observer });
    assert.equal(uprRead, cidAlice, "UPR value not expected");    

    /** and Bob cant change this upn registry */
    await bobUPR.setUPR(contextHash, cidBob, { from: bob });

    failed = false;
    await upnService.changeUPRRegistry(upnHash, bobUPR.address, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'upn can only be updated by its current owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upr registry change did not failed");

    /** nor take the UPN */
    failed = false;
    await upnService.executeTake(upnHash, bob, 0, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'upn still under protection period', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upr registry change did not failed");

    /** time passes */
    await mineNBlocks(Palice.toNumber() + 10);

    /** and now the take can be executed */
    const UPFRONT_BOB = taxRead.div(new BN(2));

    await erc20Instance.mint(bob, UPFRONT_BOB, { from: god });
    await erc20Instance.approve(UprtclAccounts.address, UPFRONT_BOB, { from: bob });

    const executeTakeTx = await upnService.executeTake(upnHash, bob, UPFRONT_BOB, { from: bob });

    /** the upn belongs to Bob */
    const upnRead3 = await upnService.getUPN(upnHash, { from: observer });
    assert.equal(upnRead3.owner, bob, "UPN owner not expected");
    assert.equal(upnRead3.paid, UPFRONT_BOB, "UPN owner not expected");
    assert.equal(upnRead3.block0, executeTakeTx.receipt.blockNumber, "UPN owner not expected");
    assert.isTrue(web3.utils.toBN(upnRead3.V).eq(Vbob), "UPN owner not expected");

    assert.equal(upnRead3.taken, '0', "UPN not expected");
    assert.equal(upnRead3.newOwner, ZERO_ADDRESS, "UPN not expected");
    assert.equal(upnRead3.blockAvailable, '0', "UPN not expected");
    assert.equal(upnRead3.newV, '0', "UPN not expected");
    assert.equal(upnRead3.newP, '0', "UPN not expected");

    /** the upr registry is bob's */
    const uprRead2 = await upnService.getUPR(contextHash, upnHash, { from: observer });
    assert.equal(uprRead2, cidBob, "UPR value not expected");    

  })

});

