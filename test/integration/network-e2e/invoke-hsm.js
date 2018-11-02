
/**
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const {Gateway, InMemoryWallet, HSMWalletMixin} = require('../../../fabric-network/index.js');
const fs = require('fs-extra');

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtils = require('../../unit/util');
const channelName = testUtils.NETWORK_END2END.channel;
const chaincodeId = testUtils.NETWORK_END2END.chaincodeId;


const fixtures = process.cwd() + '/test/fixtures';
const inMemoryWallet = new InMemoryWallet();
const ccp = fs.readFileSync(fixtures + '/network.json');

const common_pkcs_pathnames = [
	'/usr/lib/softhsm/libsofthsm2.so',								// Ubuntu
	'/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so',				// Ubuntu  apt-get install
	'/usr/lib/s390x-linux-gnu/softhsm/libsofthsm2.so',				// Ubuntu
	'/usr/local/lib/softhsm/libsofthsm2.so',						// Ubuntu, OSX (tar ball install)
	'/usr/lib/powerpc64le-linux-gnu/softhsm/libsofthsm2.so',		// Power (can't test this)
	'/usr/lib/libacsp-pkcs11.so'									// LinuxOne
];
let pkcsLibPath;
if (typeof process.env.PKCS11_LIB === 'string' && process.env.PKCS11_LIB !== '') {
	pkcsLibPath  = process.env.PKCS11_LIB;
} else {
	//
	// Check common locations for PKCS library
	//
	for (let i = 0; i < common_pkcs_pathnames.length; i++) {
		if (fs.existsSync(common_pkcs_pathnames[i])) {
			pkcsLibPath = common_pkcs_pathnames[i];
			break;
		}
	}
}

const IDManager = require('./idmanager');
const idManager = new IDManager();
idManager.initialize(JSON.parse(ccp.toString()));

const PKCS11_SLOT = process.env.PKCS11_SLOT || '0';
const PKCS11_PIN = process.env.PKCS11_PIN || '98765432';
const hsmUser = 'hsm-user';
const hsmWallet = new InMemoryWallet(new HSMWalletMixin(pkcsLibPath, PKCS11_SLOT, PKCS11_PIN));

async function setupAdmin() {
	if (!(await inMemoryWallet.exists('admin'))) {
		await idManager.enrollToWallet('admin', 'adminpw', 'Org1MSP', inMemoryWallet);
	}
}

async function hsmIdentitySetup() {
	if (!(await hsmWallet.exists(hsmUser))) {
		const secret = await idManager.registerUser(hsmUser, null, inMemoryWallet, 'admin');
		await idManager.enrollToWallet(hsmUser, secret, 'Org1MSP', hsmWallet);
	}
}

async function createContract(t, gateway, gatewayOptions) {
	await gateway.connect(JSON.parse(ccp.toString()), gatewayOptions);
	t.pass('Connected to the gateway');

	const network = await gateway.getNetwork(channelName);
	t.pass('Initialized the network, ' + channelName);

	const contract = network.getContract(chaincodeId);
	t.pass('Got the contract, about to submit "move" transaction');

	return contract;
}

const getEventHubForOrg = async (gateway, orgMSP) => {
	const network = await gateway.getNetwork(channelName);
	const channel = network.getChannel();
	const orgPeer = channel.getPeersForOrg(orgMSP)[0];
	return channel.getChannelEventHub(orgPeer.getName());
};

test('\n\n****** Network End-to-end flow: import identity into wallet using hsm *****\n\n', async (t) => {
	await setupAdmin();
	await hsmIdentitySetup();
	const exists = await hsmWallet.exists(hsmUser);
	if (exists) {
		t.pass('Successfully imported hsmUser into wallet');
	} else {
		t.fail('Failed to import hsmUser into wallet');
	}
	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using file hsm wallet and default event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;

	try {
		await setupAdmin();
		await hsmIdentitySetup();

		const tlsInfo = await e2eUtils.tlsEnroll('org1');
		const contract = await createContract(t, gateway, {
			wallet: hsmWallet,
			identity: hsmUser,
			tlsInfo,
			discovery: {enabled: false}
		});

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let eventFired = -1;

		// have to register for all transaction events (a new feature in 1.3) as
		// there is no way to know what the initial transaction id is
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				eventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		t.true(org1EventHub.isconnected(), 'org1 event hub correctly connected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		const expectedResult = 'move succeed';
		if (response.toString() === expectedResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}
	t.end();
});
