const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");

module.exports = async (deployer, network, accounts) => {
  const god = accounts[9];
  deployer.deploy(UprtclRoot, { from: god });
  deployer.deploy(UprtclDetails, { from: god });
  deployer.deploy(UprtclProposals, { from: god });
  deployer.deploy(UprtclAccounts, { from: god });
  deployer.deploy(ERC20Mintable, { from: god });
};
