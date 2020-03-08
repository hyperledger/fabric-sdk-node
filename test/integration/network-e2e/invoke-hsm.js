
/**
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const {Gateway, HsmX509Provider, Wallets} = require('fabric-network');
const fs = require('fs-extra');

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtils = require('../util.js');
const channelName = testUtils.NETWORK_END2END.channel;
const chaincodeId = testUtils.NETWORK_END2END.chaincodeId;

const fixtures = process.cwd() + '/test/fixtures';
const ccp = fixtures + '/profiles/network.json';

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

const PKCS11_SLOT = process.env.PKCS11_SLOT || '0';
const PKCS11_PIN = process.env.PKCS11_PIN || '98765432';
const hsmUser = 'hsm-user';
const mspId = 'Org1MSP';
const adminUser = 'admin';
const adminSecret = 'adminpw';

const walletPromise = (async () => {
	const wallet = await Wallets.newInMemoryWallet();
	const hsmOptions = {
		lib: pkcsLibPath,
		pin: PKCS11_PIN,
		slot: PKCS11_SLOT
	};
	const hsmProvider = new HsmX509Provider(hsmOptions);
	wallet.getProviderRegistry().addProvider(hsmProvider);

	const idManager = new IDManager(ccp, hsmOptions);
	await idManager.initialize();

	const adminEnrollment = await idManager.enroll(adminUser, adminSecret);
	const adminIdentity = {
		credentials: {
			certificate: adminEnrollment.certificate,
			privateKey: adminEnrollment.key.toBytes()
		},
		mspId,
		type: 'X.509'
	};
	await wallet.put(adminUser, adminIdentity);

	const secret = await idManager.registerUser(hsmUser, wallet, adminUser);
	const hsmEnrollment = await idManager.enrollToHsm(hsmUser, secret);

	const hsmIdentity = {
		credentials: {
			certificate: hsmEnrollment.certificate
		},
		mspId,
		type: hsmProvider.type
	};
	await wallet.put(hsmUser, hsmIdentity);

	idManager.closeHsmSession();

	return wallet;
})();

async function createContract(t, gateway, gatewayOptions) {
	const ccpData = await fs.promises.readFile(ccp);
	await gateway.connect(JSON.parse(ccpData.toString()), gatewayOptions);
	t.pass('Connected to the gateway');

	const network = await gateway.getNetwork(channelName);
	t.pass('Initialized the network, ' + channelName);

	const contract = network.getContract(chaincodeId);
	t.pass('Got the contract, about to submit "move" transaction');

	return contract;
}

test('\n\n****** Network End-to-end flow: import identity into wallet using hsm *****\n\n', async (t) => {
	const wallet = await walletPromise;
	const identity = await wallet.get(hsmUser);
	if (identity) {
		t.pass('Successfully imported hsmUser into wallet');
	} else {
		t.fail('Failed to import hsmUser into wallet');
	}
	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using file hsm wallet and default event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();

	try {
		const wallet = await walletPromise;
		const tlsInfo = await e2eUtils.tlsEnroll('org1');
		const contract = await createContract(t, gateway, {
			wallet,
			identity: hsmUser,
			tlsInfo,
			discovery: {enabled: false}
		});

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

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
	}
	t.end();
});
