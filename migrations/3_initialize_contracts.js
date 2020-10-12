const UprtclRoot = artifacts.require("UprtclRoot");
const UprtclAccounts = artifacts.require("UprtclAccounts");
const UPNService = artifacts.require("UPNService");

module.exports = function (deployer, networks, acccounts) {
    deployer.then(async () => {
        const god = acccounts[0];

        const uprtclRoot = await UprtclRoot.deployed();
        const uprtclAccounts = await UprtclAccounts.deployed();
        const upnService = await UPNService.deployed();

        return Promise.all([
            upnService.setAccounts(uprtclAccounts.address, { from: god }),
            uprtclRoot.setAccounts(uprtclAccounts.address, { from: god }),

            uprtclAccounts.setSuperUser(uprtclRoot.address, true, { from: god }),
        ])
    })

}
