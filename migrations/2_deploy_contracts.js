const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");

module.exports = async (deployer, network, accounts) => {
  deployer.deploy(UprtclRoot, { from: accounts[9] }).then(function (root) {
    return deployer.deploy(UprtclDetails, root.address);
  });
};
