const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclDetails = artifacts.require("UprtclDetails");
const UprtclProposals = artifacts.require("UprtclProposals");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const UPNService = artifacts.require("UPNService");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const UprtclHomePerspectives = artifacts.require("UprtclHomePerspectives");
const UprtclWrapper = artifacts.require("UprtclWrapper");

module.exports = function (deployer, networks, acccounts) {
    deployer.then(async () => {
        const god = acccounts[0];

        const uprtclRoot = await UprtclRoot.deployed();
        const uprtclDetails = await UprtclDetails.deployed();
        const uprtclAccounts = await UprtclAccounts.deployed();
        const uprtclProposals = await UprtclProposals.deployed();
        const upnService = await UPNService.deployed();
        const uprtclHomePerspectives = await UprtclHomePerspectives.deployed();
        const uprtclWrapper = await UprtclWrapper.deployed();

        return Promise.all([
            uprtclDetails.setUprtclRoot(uprtclRoot.address, { from: god }),
            uprtclProposals.setUprtclRoot(uprtclRoot.address, { from: god }),
            upnService.setUprtclRoot(uprtclRoot.address, { from: god }),

            uprtclWrapper.setDependencies(
                uprtclRoot.address, 
                uprtclDetails.address, 
                uprtclProposals.address, 
                uprtclHomePerspectives.address,  { from: god }),

            uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god }),
            uprtclRoot.setSuperUser(uprtclDetails.address, true, { from: god }),
            uprtclRoot.setSuperUser(uprtclProposals.address, true, { from: god }),
            
            uprtclRoot.setSuperUser(uprtclWrapper.address, true, { from: god }),
            uprtclHomePerspectives.setSuperUser(uprtclWrapper.address, true, { from: god }),
            uprtclProposals.setSuperUser(uprtclWrapper.address, true, { from: god }),
            uprtclDetails.setSuperUser(uprtclWrapper.address, true, { from: god }),
        ])
    })

}
