const HTLCManager = artifacts.require('HTLCManager');
const chai = require('chai');
const crypto = require('crypto');
const toBN = web3.utils.toBN;

chai.use(require('chai-as-promised'));

const r32 = () => crypto.randomBytes(32);
const hash = (x) => crypto.createHash('sha256').update(x).digest();
const btoh = (x) => '0x' + x.toString('hex');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

contract('HTLCManager', (accounts) => {
    let htlcManager;

    const htlcId = btoh(r32());
    const rB = r32();
    const R = btoh(rB);
    const H = btoh(hash(rB));

    before(async () => {
        // We can only test with no gas price so we can accurately test balances
        if (!toBN(await web3.eth.getGasPrice()).eq(toBN(0))) {
            throw new Error('Network gas price not zero. Did you forget to ' +
                'set the gasPrice paramter of testrpc to 0?');
        }
    });

    // Used to automatically check account balances after each test case by
    // storing the Ether on account1 and account2 before and after the test case
    let accountABalanceDifference;
    let accountBBalanceDifference;
    let accountABalance;
    let accountBBalance;

    beforeEach(async () => {
        htlcManager = await HTLCManager.new();
        global.expect = chai.expect; // Replace default chai

        accountABalanceDifference = 0;
        accountBBalanceDifference = 0;
        accountABalance = toBN(await web3.eth.getBalance(accounts[0]));
        accountBBalance = toBN(await web3.eth.getBalance(accounts[1]));
    });

    afterEach(async () => {
        accountABalanceDifference = toBN(accountABalanceDifference);
        accountBBalanceDifference = toBN(accountBBalanceDifference);

        let newAccountABalance = toBN(await web3.eth.getBalance(accounts[0]));
        let newAccountBBalance = toBN(await web3.eth.getBalance(accounts[1]));

        if (!accountABalance.add(accountABalanceDifference)
                            .eq(newAccountABalance) ||
          !accountBBalance.add(accountBBalanceDifference)
                          .eq(newAccountBBalance)) {
            throw new Error(`Incorrect account balances. Expected ` +
                `(${accountABalance.add(accountABalanceDifference)}, ` +
                `${accountBBalance.add(accountBBalanceDifference)}) but got ` +
                `(${newAccountABalance}, ${newAccountBBalance})`);
        }
    });

    describe('fund', async () => {
        it('Should be able to fund an HTLC', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            return chai.expect(htlcManager.fund(accounts[1], H,
                90000, htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.fulfilled;
        });

        it('Should not be able to re-fund an HTLC', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 600000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });

            return expect(htlcManager.fund(accounts[1], H, 600000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        });

        it('Should revert when no Ethereum is sent', async () => {
            return expect(htlcManager.fund(accounts[1], htlcId,
                90000, web3.utils.asciiToHex('random1'), {
                    'from': accounts[0],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        });
    });

    describe('claim', () => {
        it('Should be able to claim an HTLC', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');
            accountBBalanceDifference = web3.utils.toWei('1', 'ether');

            await htlcManager.fund(accounts[1], H, 90000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });
            return expect(htlcManager.claim(htlcId, R, {
                    'from': accounts[1],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.fulfilled;
        });

        it('Should not be able to claim a non-existing HTLC', async () => {
            const rB = btoh(r32());

            return expect(htlcManager.claim(rB, R, {
                    'from': accounts[1],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        });

        it('Should not be able to claim someone else\'s HTLC', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 90000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });
            return expect(htlcManager.claim(htlcId, R, {
                    'from': accounts[2],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        });

        it('Should not able to claim an HTLC with an invalid R', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 90000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });
            return expect(htlcManager.claim(htlcId, btoh(r32()), {
                    'from': accounts[1],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        });

        it('Should not able to claim an expired HTLC', async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 0,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });
            await sleep(3000);
            return expect(htlcManager.claim(htlcId, R, {
                    'from': accounts[1],
                    'value': 0,
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                })).to.eventually.be.rejected;
        }).timeout(5000);
    });

    describe('refund', () => {
        it('Should be able to refund the funds to the owner after the ' +
          'timelock has expired', async () => {
            await htlcManager.fund(accounts[1], H, 0,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });

            await sleep(3000);

            return expect(htlcManager.refund(htlcId, {
                'from': accounts[0],
                'value': 0,
                'gasLimit': web3.utils.toHex('200000'),
                'gasPrice': await web3.eth.getGasPrice(),
            })).to.eventually.be.fulfilled;
        }).timeout(5000);

        it('Should not be able to refund the funds of an HTLC with an ' +
          'invalid id', async () => {
            const rB = btoh(r32());

            return expect(htlcManager.refund(rB, {
                'from': accounts[0],
                'value': 0,
                'gasLimit': web3.utils.toHex('200000'),
                'gasPrice': await web3.eth.getGasPrice(),
            })).to.eventually.be.rejected;
        });

        it('Should not be able to refund the funds of another person',
          async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 0,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });

            return expect(htlcManager.refund(htlcId, {
                'from': accounts[1],
                'value': 0,
                'gasLimit': web3.utils.toHex('200000'),
                'gasPrice': await web3.eth.getGasPrice(),
            })).to.eventually.be.rejected;
        });

        it('Should not be able to refund the funds of a non-expired HTLC ',
          async () => {
            accountABalanceDifference = web3.utils.toWei('-1', 'ether');

            await htlcManager.fund(accounts[1], H, 90000,
                htlcId, {
                    'from': accounts[0],
                    'value': web3.utils.toWei('1', 'ether'),
                    'gasLimit': web3.utils.toHex('200000'),
                    'gasPrice': await web3.eth.getGasPrice(),
                });

            return expect(htlcManager.refund(htlcId, {
                'from': accounts[1],
                'value': 0,
                'gasLimit': web3.utils.toHex('200000'),
                'gasPrice': await web3.eth.getGasPrice(),
            })).to.eventually.be.rejected;
        });
    });
});
