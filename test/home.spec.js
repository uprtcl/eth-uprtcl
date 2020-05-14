const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");
const { getHomePerspective } = require("./utils");

contract('UprtclHomePerspectives', (accounts) => {

  const alice = accounts[4];
  const bob = accounts[5];
  const observer = accounts[9];
  
  it('should set home', async () => {
    uprtclHomePerspectives = await UprtclHomePerspectives.deployed();
    
    const pidAlice = '12345';
    const pidBob = '87654';
    await uprtclHomePerspectives.setSuperUser(alice, { from: observer });
    await uprtclHomePerspectives.setSuperUser(bob, { from: observer });

    await uprtclHomePerspectives.setHomePerspectivePublic(pidAlice, { from: alice });
    await uprtclHomePerspectives.setHomePerspectivePublic(pidBob, { from: bob });

    const pidAliceRead = await getHomePerspective(uprtclHomePerspectives, alice);
    const pidBobRead = await getHomePerspective(uprtclHomePerspectives, bob);

    assert.equal(pidAliceRead, pidAlice, "pidAlice not expected");
    assert.equal(pidBobRead, pidBob, "pidBob not expected");
  })
});

