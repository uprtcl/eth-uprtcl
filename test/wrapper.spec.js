const UprtclDAOWrapper = artifacts.require("UprtclDAOWrapper");
const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");

const {
  randomInt,
  randomVec,
  multibaseToUint,
  constants,
  cidConfig1,
  cidConfig2,
  cidToHex32,
  generateCid,
  ZERO_HEX_32
} = require("./utils");

let wrapper;
let root;
let details;
let proposals;
let homePerspectives;

contract("DAO Wrapper", async accounts => {
  const god = accounts[0];

  const newOwner = accounts[1];
  const observer = accounts[2];

  const dao = accounts[3];

  const setHomePerspective = async () => {
    wrapper = await UprtclDAOWrapper.deployed();
    root = await UprtclRoot.deployed();
    details = await UprtclDetails.deployed();
    proposals = await UprtclProposals.deployed();
    homePerspectives = await UprtclHomePerspectives.deployed();

    await wrapper.setDependencies(
      root.address, 
      details.address, 
      proposals.address, 
      homePerspectives.address, { from: god });

    const myPerspectiveHash = "0x10";
    homePerspectives.setSuperUser(wrapper.address, true, { from: god });
    await wrapper.setHomePerspective(myPerspectiveHash, { from: dao });

    const homePerspective = await homePerspectives.getHomePerspective(dao);
    assert.equal(myPerspectiveHash, homePerspective, "Home perspective is not correct");
  };

  const authorizeProposal = async () => {
    const accountOwner = accounts[3];
    const firstOwner = accounts[9];
    const creator = accounts[7];
    const requestRegistrator = accounts[8];

    const toPerspective = {
      origin: "eth://contractAddressTwo",
      creatorId: "did:uport:456",
      timestamp: randomInt()
    };

    const fromPerspective = {
      origin: "eth://contractAddressTwo",
      creatorId: "did:uport:456",
      timestamp: randomInt()
    };

    const toPerspectiveCid = await generateCid(JSON.stringify(toPerspective), cidConfig1);
    const fromPerspectiveCid = await generateCid(JSON.stringify(fromPerspective), cidConfig1);
    const nonce = 0;

    /** head updates */
    const timestamps = randomVec(10);

    const buildPerspectivesPromises = timestamps.map(async timestamp => {
      const data = {
        text: `This is my data ${randomInt()}`
      };

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: "did:uport:456",
        timestamp: timestamp + 1,
        message: "test commit new again",
        parentsIds: [],
        dataId: dataId.toString()
      };

      const perspective = {
        origin: "eth://contractAddressTwo",
        creatorId: "did:uport:456",
        timestamp: timestamp
      };

      const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);

      const ethPerspective = {
        perspectiveId: perspectiveCid.toString(),
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        owner: firstOwner
      };

      const details = {
        context: (timestamp + 2).toString(),
        name: randomInt().toString()
      };

      return { perspective: ethPerspective, details };
    });

    const perspectivesData = await Promise.all(buildPerspectivesPromises);

    await details.initPerspectiveBatch(perspectivesData, accountOwner, { from: creator });

    const buildUpdatesPromises = perspectivesData.map(async perspectivesData => {
      const data = {
        text: `This is my data ${randomInt()}`
      };

      const dataId = await generateCid(JSON.stringify(data), cidConfig1);

      const head = {
        creatorId: "did:uport:456",
        timestamp: randomInt(),
        message: "test commit new again",
        parentsIds: [],
        dataId: dataId.toString()
      };

      const headId = await generateCid(JSON.stringify(head), cidConfig1);
      const headCidStr = headId.toString();
      const headCidParts = cidToHex32(headCidStr);
      const perspectiveIdHash = await root.getPerspectiveIdHash(perspectivesData.perspective.perspectiveId);

      const headUpdate = {
        perspectiveIdHash,
        headCid1: headCidParts[0],
        headCid0: headCidParts[1],
        executed: "0"
      };

      return { perspectivesData, headUpdate };
    });

    const updates = await Promise.all(buildUpdatesPromises);

    const newProposal = {
      toPerspectiveId: toPerspectiveCid.toString(),
      fromPerspectiveId: fromPerspectiveCid.toString(),
      owner: firstOwner,
      nonce: nonce,
      headUpdates: updates.map(u => u.headUpdate),
      approvedAddresses: []
    };

    const result = await proposals.initProposal(newProposal, accountOwner, { from: requestRegistrator });

    const proposalId = await proposals.getProposalId(toPerspectiveCid.toString(), fromPerspectiveCid.toString(), nonce);

    proposals.setSuperUser(wrapper.address, true, { from: god });
    
    await wrapper.authorizeProposal(proposalId, 1, true, { from: firstOwner });
  };

  const changePerspectiveOwner = async () => {
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    const perspectiveIdHash = await root.getPerspectiveIdHash(perspectiveCid.toString());

    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: dao
    }

    await root.createPerspective(
      newPerspective, observer,
      { from: observer });


    root.setSuperUser(wrapper.address, true, { from: god });

    await wrapper.changePerspectiveOwner(perspectiveIdHash, newOwner, { from: dao });

    const newOwnerRead = await root.getPerspectiveOwner(perspectiveIdHash);
    assert.equal(newOwnerRead, newOwner, "Perspective owner did not change");
  };

  const dontChangePerspectiveOwner = async () => {
    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: 'did:uport:123',
      timestamp: randomInt()
    }

    const perspectiveCid = await generateCid(JSON.stringify(perspective), cidConfig1);
    const perspectiveIdHash = await root.getPerspectiveIdHash(perspectiveCid.toString());
    
    const newPerspective = {
      perspectiveId: perspectiveCid.toString(),
      headCid1: ZERO_HEX_32,
      headCid0: ZERO_HEX_32,
      owner: dao
    }

    await root.createPerspective(
      newPerspective, observer,
      { from: observer });

    let failed = false;
    try {
      await wrapper.changeOwner(perspectiveIdHash, newOwner, { from: observer });
      await root.getPerspectiveOwner(perspectiveIdHash);
    } catch (e) {
      failed = true;
    } finally {
      assert.isTrue(failed, "Perspective owner did change");
    }
  };

  const changePespectiveDetail = async () => {
    const newDetails = {
      name: "new name",
      context: "new context"
    };
    details.setSuperUser(wrapper.address, true, { from: god });
    await wrapper.setPerspectiveDetails(perspectiveIdHash, newDetails, { from: dao });
    const perspective = await details.getPerspectiveDetails(perspectiveIdHash);
    assert.equal(newDetails.name, perspective.name, "Perspective name did not change");
  };

  const dontChangePerspectiveDetail = async () => {
    const newDetails = {
      name: "new name",
      context: "new context"
    };
    let failed = false;
    try {
      await wrapper.setPerspectiveDetails(perspectiveIdHash, newDetails, { from: observer });
    } catch (e) {
      failed = true;
    } finally {
      assert.isTrue(failed, "Perspective name did change");
    }
  };

  it("should set home perspective", setHomePerspective);
  it("should authorize proposal", authorizeProposal);
  it("should change owner", changePerspectiveOwner);
  it("should not change owner", dontChangePerspectiveOwner);
  it("should change perspective's name", changePespectiveDetail);
  it("should not change perspective's name, because user is not authorized", dontChangePerspectiveDetail);
});
