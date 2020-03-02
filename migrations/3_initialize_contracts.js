const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const ERC20Mintable = artifacts.require("ERC20Mintable");

module.exports = function(deployer, networks, acccounts) {
    deployer.then(async () => {
        const god = acccounts[9];

        const uprtclRoot = await UprtclRoot.deployed();
        const uprtclDetails = await UprtclDetails.deployed();
        const uprtclAccounts = await UprtclAccounts.deployed();
        const uprtclProposals = await UprtclProposals.deployed();
        // const erc20Instance = await ERC20Mintable.deployed();

        return Promise.all([
            uprtclDetails.setUprtclRoot(uprtclRoot.address, { from: god }),
            uprtclProposals.setUprtclRoot(uprtclRoot.address, { from: god }),
            uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god }),
            uprtclRoot.setSuperUser(uprtclDetails.address, true, { from: god }),
            uprtclRoot.setSuperUser(uprtclProposals.address, true, { from: god })
        ])
      })
    
}