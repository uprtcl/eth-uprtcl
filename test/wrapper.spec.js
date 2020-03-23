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
  generateCid
} = require("./utils");

let wrapper;
let root;
let details;
let proposals;
let homePerspectives;

let perspectiveIdHash;

contract("DAO Wrapper", async accounts => {
  const god = accounts[0];
  const dao = accounts[7];

  const setHomePerspective = async () => {
    wrapper = await UprtclDAOWrapper.deployed();
    root = await UprtclRoot.deployed();
    details = await UprtclDetails.deployed();
    proposals = await UprtclProposals.deployed();
    homePerspectives = await UprtclHomePerspectives.deployed();

    await wrapper.setDependencies(root.address, details.address, proposals.address, homePerspectives.address, { from: dao });

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
      perspectiveIdHash = await root.getPerspectiveIdHash(perspectivesData.perspective.perspectiveId);

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
    await wrapper.authorizeProposal(proposalId, 1, true, firstOwner, { from: dao });
  };

  const changeOwner = async () => {
    const oldOwner = await root.getPerspectiveOwner(perspectiveIdHash)
    root.setSuperUser(wrapper.address, true, { from: god });
    await wrapper.changeOwner(perspectiveIdHash, dao, oldOwner, { from: dao })
    const newOwner = await root.getPerspectiveOwner(perspectiveIdHash)
    assert.equal(newOwner, dao, "Perspective owner did not change")
  }

  const dontChangeOwner = async () => {
    const oldOwner = await root.getPerspectiveOwner(perspectiveIdHash)
    root.setSuperUser(wrapper.address, true, { from: god });
    await wrapper.changeOwner(perspectiveIdHash, dao, oldOwner)
    let failed = false
    try {

      const newOwner = await root.getPerspectiveOwner(perspectiveIdHash)
    } catch (e) {
      failed = true
    } finally {
      assert.isTrue(failed, "Perspective owner did change")
    }
  }



  it("should set home perspective", setHomePerspective);
  it("should authorize proposal", authorizeProposal);
  it("should change owner", changeOwner);
  it("should not change owner", dontChangeOwner);
});
