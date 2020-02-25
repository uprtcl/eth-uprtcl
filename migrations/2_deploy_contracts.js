const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");

module.exports = async (deployer, network, accounts) => {
  deployer.deploy(UprtclRoot, { from: accounts[9] }).then(function (root) {
    return deployer.deploy(UprtclDetails, root.address).then(function (details) {
      return deployer.deploy(UprtclProposals);
    });
  });
};
