const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const {
  randomInt,
  cidToHex32,
  generateCid,
  getLatestHead,
} = require("./utils");

var BN = web3.utils.BN;

contract('UprtclRoot', (accounts) => {

  const god = accounts[0];
  const newOwner = accounts[8];
  const observer = accounts[3];

  const creator = accounts[9];
  const accountOwner = accounts[6];

  const FEE = new BN(500000000000000);
  
  let uprtclRoot;
  let uprtclAccounts;
  let erc20Instance;

  it('should set superusers', async () => {
    uprtclRoot = await UprtclRoot.deployed();
    uprtclAccounts = await UprtclAccounts.deployed();
    erc20Instance = await ERC20Mintable.deployed();

    /** set super users */
    failed = false;
    await uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });
    assert.isTrue(failed, "superuser set did not failed");

    /** root can consume and transfer funds from accounts */
    await uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god });
  })

  it('should be able to set the fee', async () => {
    const godRead = await uprtclRoot.owner({ from: observer });
    assert.equal(godRead, god, "god not as expected");

    const fee = await uprtclRoot.fee({ from: observer });
    
    assert.isTrue(fee.eq(new BN(0)), 'fee not zero');
    
    let failed = false;
    await uprtclRoot.setFee(FEE, { from: observer }).catch((error) => {
      assert.equal(error.reason, 'Ownable: caller is not the owner', "unexpected reason");
      failed = true
    });

    assert.isTrue(failed, "fees set did not failed");

    await uprtclRoot.setFee(FEE, { from: god })
    
    const fee2 = await uprtclRoot.fee({ from: observer });
    assert.isTrue(fee2.eq(FEE), 'add fee not zero');
  })

  it('should be able to transfer ownership', async () => {
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
  });

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

  it('should create a new signal - no fee', async () => {
    debugger
    await uprtclRoot.setFee(0, { from: god })

    const cid = await generateCid(randomInt().toString());
    const vals = cidToHex32(cid);

    const result = await uprtclRoot.updateHead(
      vals[0], vals[1], observer,
      { from: creator });

    console.log(`signal gas cost: ${result.receipt.gasUsed}`);

    const head = await getLatestHead(uprtclRoot, creator);

    assert.equal(head.val1, vals[0], "head is not what was expected");
    assert.equal(head.val0, vals[1], "head is not what was expected");
  });

  it('should persist and read a perspective - with fee', async () => {
    debugger
    await uprtclRoot.setFee(FEE, { from: god })

    const cid = await generateCid(randomInt().toString());
    const vals = cidToHex32(cid);

    /** mint tokens to the accountOwner */
    await erc20Instance.mint(accountOwner, FEE, { from: god });

    const accountBalance = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance.eq(FEE), "account balance not as expected");

    /** acountOwner gives UprtclAcconts allowance */
    await erc20Instance.approve(UprtclAccounts.address, FEE, { from: accountOwner });

    /** the acountOwner gives the creator the right to consume from his balance */
    await uprtclAccounts.setUsufructuary(creator, true, { from: accountOwner });
    const isUsufructurary = await uprtclAccounts.isUsufructuary(accountOwner, creator);

    assert.equal(isUsufructurary, true, 'usufructuary not set');

    const result = await uprtclRoot.updateHead(
      vals[0], vals[1], accountOwner,
      { from: creator });

    console.log(`signal gas cost with fee: ${result.receipt.gasUsed}`);

    const head = await getLatestHead(uprtclRoot, creator);

    assert.equal(head.val1, vals[0], "head is not what was expected");
    assert.equal(head.val0, vals[1], "head is not what was expected");

    const accountBalance2 = await erc20Instance.balanceOf(accountOwner);
    assert.isTrue(accountBalance2.eq(new BN(0)), "account balance not as expected");

    const uprtclBalance = await erc20Instance.balanceOf(uprtclAccounts.address);
    assert.isTrue(uprtclBalance.eq(FEE), "uprtcl balance not as expected");
  });

});
