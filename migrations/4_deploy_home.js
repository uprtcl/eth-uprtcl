const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");

module.exports = async (deployer, network, accounts) => {
  const god = accounts[0];
  deployer.deploy(UprtclHomePerspectives, { from: god });
};
