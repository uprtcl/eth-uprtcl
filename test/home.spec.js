const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");

contract('UprtclHomePerspectives', (accounts) => {

  const alice = accounts[4];
  const bob = accounts[5];
  const observer = accounts[9];
  
  it('should set home', async () => {
    uprtclHomePerspectives = await UprtclHomePerspectives.deployed();
    
    const pidAlice = '12345';
    const pidBob = '87654';

    await uprtclHomePerspectives.setHomePerspective(pidAlice, { from: alice });
    await uprtclHomePerspectives.setHomePerspective(pidBob, { from: bob });

    const pidAliceRead = await uprtclHomePerspectives.getHomePerspective(alice, { from: observer });
    const pidBobRead = await uprtclHomePerspectives.getHomePerspective(bob, { from: observer });

    assert.equal(pidAliceRead, pidAlice, "pidAlice not expected");
    assert.equal(pidBobRead, pidBob, "pidBob not expected");
  })
});

