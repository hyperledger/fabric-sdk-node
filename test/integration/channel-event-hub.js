/**
 * Copyright 2017 London Stock Exchange All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

let utils = require('fabric-client/lib/utils.js');
let logger = utils.getLogger('channel-event-hub');

let tape = require('tape');
let _test = require('tape-promise');
let test = _test(tape);

let path = require('path');
let util = require('util');
let fs = require('fs');
let Long = require('long');

let Client = require('fabric-client');
let testUtil = require('../unit/util.js');

// When running this as a standalone test, be sure to create and join a channel called 'mychannel'
test('Test chaincode instantiate with event, transaction invocation with chaincode event, and query number of chaincode events', (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	let client = new Client();
	let channel = client.newChannel('mychannel'); // this channel must exist in the fabric network

	let chaincode_version = testUtil.getUniqueVersion();
	let chaincode_id = 'events_unit_test_' + chaincode_version;
	let request = null;
	let the_user = null;
	let targets = [];
	let eh;
	let req1 = null;
	let req2 = null;
	let tls_data = null;
	let txid = null;
	let block_reg = null;

	// using an array to track the event hub instances so that when this gets
	// passed into the overriden t.end() closure below it will get updated
	// later when the eventhub instances are created
	let eventhubs = [];
	// override t.end function so it'll always disconnect the event hub
	t.end = ((context, ehs, f) => {
		return function() {
			for(let key in ehs) {
				let eventhub = ehs[key];
				if (eventhub && eventhub.isconnected()) {
					logger.debug('Disconnecting the event hub');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, eventhubs, t.end);
	t.pass('Successfully setup the eventhub disconnect when the test ends');

	let data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
	let caroots = Buffer.from(data).toString();

	let orderer = client.newOrderer(
		'grpcs://localhost:7050',
		{
			'pem': caroots,
			'ssl-target-name-override': 'orderer.example.com'
		}
	);
	channel.addOrderer(orderer);

	data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem'));
	let peer = client.newPeer(
		'grpcs://localhost:7051',
		{
			pem: Buffer.from(data).toString(),
			'ssl-target-name-override': 'peer0.org1.example.com'
		}
	);
	channel.addPeer(peer);
	targets.push(peer);
	eh = channel.newChannelEventHub(peer);
	t.pass('Successfully created new channel event hub for peer');
	eventhubs.push(eh);

	Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg('peerOrg1')
	}).then((store) => {
		client.setStateStore(store);

		// get the peer org's admin user identity
		return testUtil.getSubmitter(client, t, true /* get peer org admin */, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled admin user \'admin\'');
		the_user = admin;

		// now that the user has been assigned to the client instance , we are able to
		// try to connect to the peer's new channel based event service on the peer.
		// This will setup the stream and blocks will start to be returned asynchrously.
		eh.connect();

		// get a transaction ID object based on the current user assigned
		// to the client instance
		let tx_id = client.newTransactionID();
		let request = {
			targets : targets,
			chaincodePath: 'github.com/events_cc',
			chaincodeId: chaincode_id,
			chaincodeVersion: chaincode_version,
			txId: tx_id
		};

		return client.installChaincode(request, 30000);
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let all_good = true;

		for (let i in proposalResponses) {
			let one_good = false;

			if (proposalResponses &&
				proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {

				one_good = true;
			}
			all_good = all_good & one_good;
		}
		if(all_good) {
			t.pass('Successfully installed chaincode');

			// get a transaction ID object based on the current user assigned
			// to the client instance
			let tx_id = client.newTransactionID();
			txid = tx_id.getTransactionID(); //save the transaction id string

			request = {
				targets : targets,
				chaincodeId: chaincode_id,
				chaincodeVersion: chaincode_version,
				fcn: 'init',
				args: [],
				txId: tx_id
			};

			// the instantiate proposal can take a longer
			return channel.sendInstantiateProposal(request, 120000);
		} else {
			t.fail('Failed to install chaincode');
			throw new Error('failed to endorse the install chaincode proposal:' + results);
		}
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let all_good = true;

		for (let i in proposalResponses) {
			let one_good = false;
			if (proposalResponses &&
				proposalResponses[i].response &&
				proposalResponses[i].response.status === 200) {
				one_good = true;
			}
			all_good = all_good & one_good;
		}

		if(all_good) {
			t.pass('Successfully endorsed the instantiate chaincode proposal');

			let event_monitor =  new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eh.unregisterTxEvent(txid); //use the transaction id string saved above during edorsement
					t.fail('Failed to receive the event for transaction ::'+req)
					reject('timeout');
				}, 60000);

				eh.registerTxEvent(txid, (txnid, code) => {
					clearTimeout(handle);
					eh.unregisterTxEvent(txnid);
					if (code !== 'VALID') {
						t.fail('Failed to instantiate event for transaction '+ txnid + ' was not valid');
						reject('invalid');
					} else {
						t.pass('Successfully received instantiate event for transaction '+ txnid);
						resolve();
					}
				}, (error) => {
					clearTimeout(handle);
					eh.unregisterTxEvent(txid);
					t.fail('Instantiate event failed to due to :'+error);
					reject(error);
				});
			});
			let send_trans = channel.sendTransaction({proposalResponses: proposalResponses,	proposal: proposal});

			// send to the orderer and use an event to know when the one peer has committed the transaction
			return Promise.all([event_monitor, send_trans]);
		} else {
			t.fail('Failed to endorse the instantiate chaincode proposal');
			throw new Error('Failed to endorse the instatiate chaincode proposal:' + results);
		}
	}).then((results) => {
		// a real application would check the results here
		t.pass('Successfully instantiated chaincode, however we need to sleep for a bit.');

		return sleep(10000);
	}).then((nothing) => {
		t.pass('Successfully slept for awhile waiting for chaincode to start');

		// need to always get a new transaction id for every transaction
		let tx_id = client.newTransactionID();
		let request = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'BLOCK'],
			txId: tx_id
		};

		return channel.sendTransactionProposal(request);
	}).then((results) => {
		// a real application would check the proposal results
		t.pass('Successfully endorsed proposal to invoke chaincode');

		let event_monitor = new Promise((resolve, reject) => {
			let regid = null;
			let handle = setTimeout(() => {
				if (regid) {
					eh.unregisterBlockEvent(block_reg);
					t.fail('Timeout - Failed to receive the block event');
				}
				reject(new Error('Timed out waiting for block event'));
			}, 20000);

			block_reg = eh.registerBlockEvent((block) => {
				clearTimeout(handle);
				eh.unregisterBlockEvent(block_reg);
				t.pass('Successfully received the block event');
				resolve(block);
			}, (error)=> {
				clearTimeout(handle);
				eh.unregisterBlockEvent(block_reg);
				t.fail('Failed to receive the block event ::'+error);
				reject(error);
			});
		});
		let send_trans = channel.sendTransaction({proposalResponses: results[0],	proposal: results[1]});

		return Promise.all([event_monitor, send_trans]);
	}).then((results) => {
		//a real application would check the results of both the block event and send transaction
		t.pass('Successfully received block event.');

		return sleep(10000);
	}).then((nothing) => {
		t.pass('Successfully slept for awhile waiting for block to get here');

		let request = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		return channel.queryByChaincode(request);
	}).then((results) => {
		t.pass('Successfully queried chaincode.');

		for (let i = 0; i < results.length; i++) {
			t.pass('Got results back ' + results[i].toString('utf8') );
			t.equal(results[i].toString('utf8'), '1', 'checking query results are number of events generated');
		}

		// need to always get a new transaction id for every transaction
		let tx_id = client.newTransactionID();
		let request = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'CHAINCODE'],
			txId: tx_id
		};

		return channel.sendTransactionProposal(request);
	}).then((results) => {
		// a real application would check the proposal results
		t.pass('Successfully endorsed proposal to invoke chaincode');

		let event_monitor = new Promise((resolve, reject) => {
			let regid = null;
			let handle = setTimeout(() => {
				if (regid) {
					eh.unregisterChaincodeEvent(regid);
					t.fail('Timeout - Failed to receive the chaincode event');
				}
				reject(new Error('Timed out waiting for chaincode event'));
			}, 20000);

			regid = eh.registerChaincodeEvent(chaincode_id.toString(), '^evtsender*',
				(event, block_num) => {
				clearTimeout(handle);
				eh.unregisterChaincodeEvent(regid);
				t.pass('Successfully received the chaincode event on block number '+ block_num);
				resolve('RECEIVED');
			}, (error)=> {
				clearTimeout(handle);
				eh.unregisterChaincodeEvent(regid);
				t.fail('Failed to receive the chaincode event ::'+error);
				reject(error);
			});
		});
		let send_trans = channel.sendTransaction({proposalResponses: results[0],	proposal: results[1]});

		return Promise.all([event_monitor, send_trans]);
	}).then((results) => {
		//First check the status of the sendTransaction
		let sendResults = results[1];
		// notice that we are using index 1, the orderer is based on the order of
		// the promise all array , where the send transaction was second

		// overall status
		let all_good = false;

		if(sendResults.status && sendResults.status === 'SUCCESS') {
			all_good = true;
			t.pass('Successfully send transaction to get chaincode event');
		} else {
			t.fail('Failed to send transaction to get chaincode event ');
		}
		// now check the chaincode results, should see xxx
		let eventResults = results[0];
		if(eventResults instanceof Error) {
			t.fail('Failed to get proper event status from chaincode event');
			all_good = all_good & false;
		} else {
			if(eventResults === 'RECEIVED') {
				t.pass('Successfully received chaincode event');
				all_good = all_good & true;
			} else {
				t.fail('Failed to get proper chaincode event status');
				all_good = all_good & false;
			}
		}

		if(all_good) {
			t.pass('Successfully received chaincode event.');
		} else {
			t.failed('Failed to get the results required');
			throw new Error('Failed to get proper results');
		}

		return sleep(10000);
	}).then((nothing) => {
		t.pass('Successfully slept for awhile waiting for block to get here');

		let request = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		return channel.queryByChaincode(request);
	}).then((results) => {
		t.pass('Successfully queried chaincode.');

		for (let i = 0; i < results.length; i++) {
			t.equal(results[i].toString('utf8'), '2', 'checking query results are number of events generated');
		}

		// Test invalid transaction
		// create 2 invoke requests in quick succession that modify
		// the same state, which should cause one invoke to
		// be invalid
		let tx_id_1 = client.newTransactionID();
		req1 = {
			targets : targets,
			chaincodeId: chaincode_id,
			chaincodeVersion: '',
			fcn: 'invoke',
			args: ['invoke', 'TRANSACTIONID1'],
			txId: tx_id_1
		};
		let tx_id_2 = client.newTransactionID();
		req2 = {
			targets : targets,
			chaincodeId: chaincode_id,
			chaincodeVersion: '',
			fcn: 'invoke',
			args: ['invoke', 'TRANSACTIONID2'],
			txId: tx_id_2
		};

		return Promise.all([channel.sendTransactionProposal(req1), channel.sendTransactionProposal(req2)]);
	}).then(([results1, results2]) => {
		// a real application would check the results
		t.pass('Successfully endorsed the double transactions');

		// setup the events to look for transaction id, these will
		// go to the peer
		let event_monitor_1 =  new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for event1');
				eh.unregisterTxEvent(req1.txId.getTransactionID());
				reject('timeout');
			}, 200000);

			eh.registerTxEvent(req1.txId.getTransactionID(), (txnid, code, block_num) => {
				clearTimeout(handle);
				eh.unregisterTxEvent(txnid);
				t.pass('Event1 has transaction code:'+ code
					+ ' for transactionID:'+txnid + ' block number:'
					+ block_num);
				if(block_num) {
					t.pass('Successfully got the block number '+block_num);
				} else {
					t.fail('Failed to get the block number');
				}
				// send back what we got... look at it later
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				eh.unregisterTxEvent(req1.txId.getTransactionID());
				t.fail('Failed to receive event for Event1 for transaction id ::'+txid);
				// send back error
				reject(error);
			});
		});
		let event_monitor_2 =  new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for event2');
				eh.unregisterTxEvent(req2.txId.getTransactionID());
				reject('timeout');
			}, 200000);

			eh.registerTxEvent(req2.txId.getTransactionID(), (txnid, code) => {
				clearTimeout(handle);
				eh.unregisterTxEvent(txnid);
				t.pass('Event2 has transaction code:'+ code + ' for transaction id ::'+txnid);
				// send back what we got... look at it later
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				eh.unregisterTxEvent(req2.txId.getTransactionID());
				t.fail('Failed to receive event for Event2 for transaction id ::'+txnid);
				// send back error
				reject(error);
			});
		});

		// now setup two send the transactions to the orderer
		let send_trans_1 = channel.sendTransaction({proposalResponses: results1[0],	proposal: results1[1]});
		let send_trans_2 = channel.sendTransaction({proposalResponses: results2[0],	proposal: results2[1]});

		// now lets have the events and the sendtransaction all execute together
		// results will come back when all of them complete
		return Promise.all([event_monitor_1, event_monitor_2, send_trans_1, send_trans_2]);
	}).then(([regResult1, regResult2, sendResult1, sendResult2]) => {
		t.pass('Successfully got back event and transaction results');
		// lets see what we have
		let fail = false;
		if(regResult1 !== 'Valid') fail = true;
		if(regResult2 !== 'Valid') fail = true;
		t.equals(fail, true, 'Checking that we had a failure when sending two transactions that try to do the same thing');

		return channel.queryInfo(peer);
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.pass('Successfully received channel info');
		return new Promise((resolve, reject) => {
			let channel_height = Long.fromValue(results.height); //this is a long object

			// will use the following number as way to know when to stop the replay
			let current_block = channel_height.subtract(1);
			t.pass('Successfully got current_block number :'+ current_block.toInt());

			let eh2 = channel.newChannelEventHub(peer);
			eventhubs.push(eh2); //putting on this list will have it closed on the test end

			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to replay all the block events in a reasonable amount of time');
				throw new Error('Timeout -  block replay has not completed');
			}, 60000);
			let block_reg_num = null;
			// register to replay all block events
			block_reg_num = eh2.registerBlockEvent((block) => {
				// block number is decoded into human readable form
				// let's put it back into a long
				let event_block = Long.fromValue(block.header.number);
				if(event_block.equals(current_block)) {
					clearTimeout(handle);
					eh2.unregisterBlockEvent(block_reg_num);
					// we do not remove the registration
					// the error callback will get called
					// when the disconnect gets called on test end
					t.pass('Successfully had all blocks replayed ');
					resolve();
				} else {
					t.pass('Replay block event '+block.header.number);
				}
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to replay all the block events');
				throw new Error('Replay Error callback was called with ::' + error);
			}, 0); // a real application would have remembered that last block event
			       // received and used that value hear to start the replay
			t.pass('Successfully registered block replay with reg number of :'+block_reg_num);
			eh2.connect();
			t.pass('Successfully called connect on the replay');
		});
	}).then((results) => {
		let eh2 = channel.newChannelEventHub(peer);
		eventhubs.push(eh2); //putting on this list will have it closed on the test end

		let handle = setTimeout(() => {
			t.fail('Timeout - Failed to receive replay the event for event1');
			eh2.unregisterTxEvent(req1.txId.getTransactionID());
			t.end();
		}, 10000);

		eh2.registerTxEvent(req1.txId.getTransactionID(), (txnid, code) => {
			clearTimeout(handle);
			eh2.unregisterTxEvent(txnid);
			t.pass('Event1 has been replayed with transaction code:'+ code + ' for transaction id ::'+txnid);
			// send back what we got... look at it later
			t.end();
		}, (error) => {
			clearTimeout(handle);
			eh2.unregisterTxEvent(req1.txId.getTransactionID());
			t.fail('Failed to receive event replay for Event1 for transaction id ::'+req1.txId.getTransactionID());
			t.end();
		}, 0); // a real application would know the last event block received
		t.pass('Successfully registered transaction replay for'+req1.txId.getTransactionID());
		eh2.connect();
		t.pass('Successfully called connect on the transaction replay event hub');

		return Promise.resolve();
	}).then(() => {
		t.pass('Successfully finished testing');
	}).catch((err) => {
		if(err) t.fail('Unexpected error. ' + err.stack ? err.stack : err);
		else t.fail('Unexpected error with no error object in catch clause');
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
