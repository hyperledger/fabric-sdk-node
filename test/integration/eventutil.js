/*
 Copyright 2017 London Stock Exchange All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const utils = require('fabric-client/lib/utils.js');
const util = require('util');

module.exports.registerTxEvent = function(eh, txid, timeout) {
	return new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			eh.unregisterTxEvent(txid);
			reject('timeout');
		}, timeout);

		eh.registerTxEvent(txid, (txId, code) => {
			if (code !== 'VALID') {
				reject('invalid');
			} else {
				resolve();
			}
			clearTimeout(handle);
			eh.unregisterTxEvent(txId);
		});
	});
};

module.exports.registerCCEvent = function(eh, ccid, enregex, timeout, t, message) {
	return new Promise((resolve, reject) => {
		let regid = null;
		const handle = setTimeout(() => {
			t.fail('Failed to receive ' + message);
			reject();
			if (regid) {
				eh.unregisterChaincodeEvent(regid);
			}
		}, timeout);

		regid = eh.registerChaincodeEvent(ccid, enregex, () => {
			t.pass('Successfully received ' + message);
			resolve();
			clearTimeout(handle);
			eh.unregisterChaincodeEvent(regid);
		});
	});
};

module.exports.createRequest = function(client, chaincode_id, targets, fcn, args) {
	const tx_id = client.newTransactionID();
	const request = {
		targets : targets,
		chaincodeId: chaincode_id,
		chaincodeVersion: '',
		fcn: fcn,
		args: args,
		txId: tx_id
	};
	return request;
};

function checkProposal(results) {
	const proposalResponses = results[0];
	let all_good = true;

	for (const i in proposalResponses) {
		let one_good = false;

		if (proposalResponses &&
			proposalResponses[i].response &&
			proposalResponses[i].response.status === 200) {

			one_good = true;
		}
		all_good = all_good & one_good;
	}
	return all_good;
}

module.exports.checkProposal =  checkProposal;

module.exports.sendTransaction = function(channel, results) {
	if (checkProposal(results)) {
		const proposalResponses = results[0];
		const proposal = results[1];
		const request = {
			proposalResponses: proposalResponses,
			proposal: proposal
		};
		return channel.sendTransaction(request);
	} else {
		utils.getLogger('eventutil.js').error(util.format('bad result: %j', results));
		return Promise.reject('Proposal responses returned unsuccessful status');
	}
};
