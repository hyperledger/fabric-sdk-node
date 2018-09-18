/*
 Copyright 2018 Zhao Chaoyi All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const fs = require('fs');
const path = require('path');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const FabricCAService = require('fabric-ca-client');
const Client = require('fabric-client');
const hash = require('fabric-client/lib/hash');

const jsrsa = require('jsrsasign');
const { KEYUTIL } = jsrsa;
const elliptic = require('elliptic');
const EC = elliptic.ec;

const privateKeyPath = path.resolve(__dirname, '../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/keystore/e4af7f90fa89b3e63116da5d278855cfb11e048397261844db89244549918731_sk');
const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const certPath = path.resolve(__dirname, '../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/signcerts/User1@org1.example.com-cert.pem');
const certPem = fs.readFileSync(certPath, 'utf8');
const mspId = 'Org1MSP';

// this ordersForCurve comes from CryptoSuite_ECDSA_AES.js and will be part of the
// stand alone fabric-sig package in future.
const ordersForCurve = {
	'secp256r1': {
		'halfOrder': elliptic.curves['p256'].n.shrn(1),
		'order': elliptic.curves['p256'].n
	},
	'secp384r1': {
		'halfOrder': elliptic.curves['p384'].n.shrn(1),
		'order': elliptic.curves['p384'].n
	}
};

// this function comes from CryptoSuite_ECDSA_AES.js and will be part of the
// stand alone fabric-sig package in future.
function _preventMalleability(sig, curveParams) {
	const halfOrder = ordersForCurve[curveParams.name]['halfOrder'];
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curveParams.name);
	}

	// in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
	// first see if 's' is larger than half of the order, if so, it needs to be specially treated
	if (sig.s.cmp(halfOrder) === 1) { // module 'bn.js', file lib/bn.js, method cmp()
		// convert from BigInteger used by jsrsasign Key objects and bn.js used by elliptic Signature objects
		const bigNum = ordersForCurve[curveParams.name]['order'];
		sig.s = bigNum.sub(sig.s);
	}

	return sig;
}

/**
 * this method is used for test at this moment. In future this
 * would be a stand alone package that running at the browser/cellphone/PAD
 *
 * @param {string} privateKey PEM encoded private key
 * @param {Buffer} proposalBytes proposal bytes
 */
function sign(privateKey, proposalBytes, algorithm, keySize) {
	const hashAlgorithm = algorithm.toUpperCase();
	const hashFunction = hash[`${hashAlgorithm}_${keySize}`];
	const ecdsaCurve = elliptic.curves[`p${keySize}`];
	const ecdsa = new EC(ecdsaCurve);
	const key = KEYUTIL.getKey(privateKey);

	const signKey = ecdsa.keyFromPrivate(key.prvKeyHex, 'hex');
	const digest = hashFunction(proposalBytes);

	let sig = ecdsa.sign(Buffer.from(digest, 'hex'), signKey);
	sig = _preventMalleability(sig, key.ecparams);

	return Buffer.from(sig.toDER());
}

function signProposal(proposalBytes) {
	const signature = sign(privateKeyPem, proposalBytes, 'sha2', 256);
	const signedProposal = { signature, proposal_bytes: proposalBytes };
	return signedProposal;
}

// setup TLS for this client
async function TLSSetup(client) {
	const tlsOptions = {
		trustedRoots: [],
		verify: false
	};
	const caService = new FabricCAService('https://localhost:7054', tlsOptions, 'ca-org1');
	const req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls'
	};
	const enrollment = await caService.enroll(req);
	client.setTlsClientCertAndKey(enrollment.certificate, enrollment.key.toBytes());
}

async function setupChannel() {
	const channelId = 'mychannel';
	const client = new Client();
	await TLSSetup(client);
	const channel = client.newChannel(channelId);

	const peerTLSCertPath = path.resolve(__dirname, '../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem');
	const peerPEMCert = fs.readFileSync(peerTLSCertPath, 'utf8');
	const peer = client.newPeer(
		'grpcs://localhost:7051',
		{
			pem: peerPEMCert,
			'ssl-target-name-override': 'peer0.org1.example.com',
		}
	);
	const ordererTLSCertPath = path.resolve(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem');
	const ordererPEMCert = fs.readFileSync(ordererTLSCertPath, 'utf8');
	const orderer = client.newOrderer(
		'grpcs://localhost:7050',
		{
			pem: ordererPEMCert,
			'ssl-target-name-override': 'orderer.example.com',
		}
	);
	channel.addPeer(peer);
	channel.addOrderer(orderer);
	// TODO: channel.initialize() should not require an signning identity
	// await channel.initialize();
	return channel;
}

async function transactionMonitor(txId, eh, t) {
	return new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			t.fail('Timeout - Failed to receive event for txId ' + txId);
			eh.disconnect(); //shutdown
			throw new Error('TIMEOUT - no event received');
		}, 60000);

		eh.registerTxEvent(txId, (txnid, code, block_num) => {
			clearTimeout(handle);
			t.pass('Event has been seen with transaction code:' + code + ' for transaction id:' + txnid + ' for block_num:' + block_num);
			resolve('Got the replayed transaction');
		}, (error) => {
			clearTimeout(handle);
			t.fail('Failed to receive event replay for Event for transaction id ::' + txId);
			reject(error);
		}, { disconnect: true }
			// Setting the disconnect to true as we do not want to use this
			// ChannelEventHub after the event we are looking for comes in
		);
		t.pass('Successfully registered event for ' + txId);

		const unsignedEvent = eh.generateUnsignedRegistration({
			certificate: certPem,
			mspId,
		});
		const signedProposal = signProposal(unsignedEvent);
		const signedEvent = {
			signature: signedProposal.signature,
			payload: signedProposal.proposal_bytes,
		};
		eh.connect({ signedEvent });
		t.pass('Successfully called connect on ' + eh.getPeerAddr());
	});
}

test('Test sign a contract with a private key offline', async (t) => {
	try {
		const channel = await setupChannel();

		const transactionProposalReq = {
			fcn: 'move',
			args: ['a', 'b', '100'],
			chaincodeId: 'end2endnodesdk',
			channelId: 'mychannel',
		};

		const { proposal, txId } = channel.generateUnsignedProposal(transactionProposalReq, mspId, certPem);
		const signedProposal = signProposal(proposal.toBuffer());
		t.pass('Successfully build endorse transaction proposal');

		const peer = channel.getPeer('localhost:7051');
		const targets = [peer];

		const sendSignedProposalReq = { signedProposal, targets };
		const proposalResponses = await channel.sendSignedProposal(sendSignedProposalReq);

		t.equal(Array.isArray(proposalResponses), true);
		t.equal(proposalResponses.length, 1);
		t.equal(proposalResponses[0].response.status, 200);

		/**
		 * End the endorse step.
		 * Start to commit the tx.
		 */
		const commitReq = {
			proposalResponses,
			proposal,
		};

		const commitProposal = channel.generateUnsignedTransaction(commitReq);
		t.pass('Successfully build commit transaction proposal');

		// sign this commit proposal at local
		const signedCommitProposal = signProposal(commitProposal.toBuffer());

		const response = await channel.sendSignedTransaction({
			signedProposal: signedCommitProposal,
			request: commitReq,
		});
		t.equal(response.status, 'SUCCESS', 'commit should response success');

		const eh = channel.newChannelEventHub(peer);
		await transactionMonitor(txId.getTransactionID(), eh, t);
		t.pass(`Successfully listened the event for transaction ${txId.getTransactionID()}`);

		t.end();
	} catch (e) {
		t.fail(e.message);
	}
});

