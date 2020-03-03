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

  it('should set uprtclRoot', async () => {
    uprtclRoot = await UprtclRoot.deployed();
    upnService = await UPNService.deployed();
    erc20Instance = await ERC20Mintable.deployed();
    const uprtclAccounts = await UprtclAccounts.deployed();

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
    
  })

  it('should be able to register and transfer a UPN - free', async () => {
    await upnService.setRegFees(Array(16).fill(0), { from: god })
    await upnService.registerUPN(aliceUpn, alice, account, { from: alice });

    const aliceUpnHash = await upnService.hashUpn(aliceUpn);
    const owner = await upnService.getUPN(aliceUpnHash, { from: observer });

    assert.equal(owner, alice, "UPN owner not expected");

    let failed = false;

    failed = false;
    await upnService.registerUPN(aliceUpn, bob, account, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN not available', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn register did not failed");

    failed = false;
    await upnService.transferUPN(aliceUpn, bob, account, { from: bob }).catch((error) => {
      assert.equal(error.reason, 'UPN not owned by msg.sender', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "upn trasnfer did not failed");

    await upnService.transferUPN(aliceUpn, bob, account, { from: alice })

    const newOwner = await upnService.getUPN(aliceUpnHash, { from: observer });
    assert.equal(newOwner, bob, "UPN owner not expected");

    /** leave it to the name of alice */
    await upnService.transferUPN(aliceUpn, alice, account, { from: bob })
    const finalOwner = await upnService.getUPN(aliceUpnHash, { from: observer });
    assert.equal(finalOwner, alice, "UPN owner not expected");
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
