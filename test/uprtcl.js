const Uprtcl = artifacts.require("Uprtcl");
var CryptoJS = require("crypto-js/core");

contract('Uprtcl', (accounts) => {

  let contextId;
  let perspectiveId;

  it('should persist a perspective', async () => {

    const context = {
      creatorId: accounts[0],
      timestamp: 0,
      nonce: 0
    }

    contextId = CrytpoJS.SHA256(JSON.stringify(context));

    const perspective = {
      origin: 'eth://contractAddress',
      creatorId: accounts[0],
      timestamp: 0,
      contextId: '',
      name: 'test perspective'
    }

    perspectiveId = CrytpoJS.SHA256(JSON.stringify(perspective));

    console.log(contextId);
    console.log(perspectiveId);

    /* 
    const uprtclInstance = await Uprtcl.deployed();
    const balance = await uprtclInstance.addPerspective.call(...);

    truffleAssert.eventEmitted(result, 'TestEvent', (ev) => {
      return ev.param1 === 10 && ev.param2 === ev.param3;
    });
    */ 
  });

  it('should should not be able to add an existing perspective', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should update the head if owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 0,
      message: 'test commit',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should not update the head if not owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 1,
      message: 'test commit from bad actor',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should not update the owner if not the owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 1,
      message: 'test commit from bad actor',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should update the owner if owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 1,
      message: 'test commit from bad actor',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should update head with new owner if new owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 1,
      message: 'test commit from bad actor',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

  it('should not update head now if old owner', async () => {
    
    const data = {
      text: 'This is my data'
    }

    dataId = CrytpoJS.SHA256(JSON.stringify(data));

    const head = {
      creatorId: accounts[0],
      timestamp: 1,
      message: 'test commit from bad actor',
      parentsIds: [],
      dataId: dataId
    }

    headId = CrytpoJS.SHA256(JSON.stringify(head));

    console.log(headId);

  });

});
