const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const UPNService = artifacts.require("UPNService");
const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");

module.exports = async (deployer, network, accounts) => {
  const god = accounts[0];

  deployer.deploy(UprtclRoot, { from: god });
  deployer.deploy(UprtclAccounts, { from: god });
  deployer.deploy(ERC20Mintable, { from: god });
  deployer.deploy(UPNService, { from: god });
  
  deployer.deploy(UprtclHomePerspectives, { from: god });
};
