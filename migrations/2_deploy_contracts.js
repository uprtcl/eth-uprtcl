const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");

module.exports = async (deployer, network, accounts) => {
  const owner = accounts[9];
  deployer.deploy(UprtclRoot, { from: owner }).then(function (root) {
    return deployer.deploy(UprtclDetails, root.address);
  });

  deployer.deploy(UprtclProposals, { from: owner });
  deployer.deploy(UprtclAccounts, { from: owner });
  deployer.deploy(ERC20Mintable, { from: owner });
};
