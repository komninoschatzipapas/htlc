var HTLCManager = artifacts.require("HTLCManager");

module.exports = (deployer) => {
    deployer.deploy(HTLCManager);
};
