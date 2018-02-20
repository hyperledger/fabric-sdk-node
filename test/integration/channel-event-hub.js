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
var e2eUtils = require('./e2e/e2eUtils.js');

// When running this as a standalone test, be sure to create and join a channel called 'mychannel'
test('Test chaincode instantiate with event, transaction invocation with chaincode event, and query number of chaincode events', (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	let client = new Client();
	let channel = client.newChannel('mychannel'); // this channel must exist in the fabric network

	let chaincode_version = testUtil.getUniqueVersion();
	let chaincode_id = 'events_unit_test_' + chaincode_version;
	let the_user = null;
	let targets = [];
	let req1 = null;
	let req2 = null;
	let tls_data = null;
	let txid = null;
	let block_reg = null;
	let event_hub = null;

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
					logger.debug('Disconnecting the event hub from the modified test end method');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, eventhubs, t.end);
	t.pass('Successfully setup the eventhub disconnect when the test ends');

	let data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
	let caroots = Buffer.from(data).toString();
	var tlsInfo = null;
	let orderer = null;
	let peer = null;

	e2eUtils.tlsEnroll('org1')
	.then((enrollment) => {
		t.pass('Successfully retrieved TLS certificate');
		tlsInfo = enrollment;
		return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg('peerOrg1')});
	}).then((store) => {
		client.setStateStore(store);

		// get the peer org's admin user identity
		return testUtil.getSubmitter(client, t, true /* get peer org admin */, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled admin user \'admin\'');
		the_user = admin;

		orderer = client.newOrderer(
			'grpcs://localhost:7050',
			{
				'pem': caroots,
				'clientCert': tlsInfo.certificate,
				'clientKey': tlsInfo.key,
				'ssl-target-name-override': 'orderer.example.com'
			}
		);
		channel.addOrderer(orderer);

		data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem'));
		peer = client.newPeer(
			'grpcs://localhost:7051',
			{
				pem: Buffer.from(data).toString(),
				'clientCert': tlsInfo.certificate,
				'clientKey': tlsInfo.key,
				'ssl-target-name-override': 'peer0.org1.example.com'
			}
		);
		channel.addPeer(peer);
		targets.push(peer);

		event_hub = channel.newChannelEventHub(peer);
		t.pass('Successfully created new channel event hub for peer');
		eventhubs.push(event_hub); //add to list so we can shutdown at end of test

		// Now that the user has been assigned to the client instance we can
		// have the channel event hub connect to the peer's channel-based event
		// service. This connect can be done anytime after the user has been
		// assigned to the client and before the transaction is submitted
		event_hub.connect();

		// get a transaction ID object based on the current user assigned
		// to the client instance
		let tx_id = client.newTransactionID();
		let req = {
			targets : targets,
			chaincodePath: 'github.com/events_cc',
			chaincodeId: chaincode_id,
			chaincodeVersion: chaincode_version,
			txId: tx_id
		};

		return client.installChaincode(req, 30000);
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

			let req = {
				targets : targets,
				chaincodeId: chaincode_id,
				chaincodeVersion: chaincode_version,
				fcn: 'init',
				args: [],
				txId: tx_id
			};

			// the instantiate proposal can take longer
			return channel.sendInstantiateProposal(req, 30000);
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

		if(!all_good) {
			t.fail('Failed to endorse the instantiate chaincode proposal');
			throw new Error('Failed to endorse the instatiate chaincode proposal:' + results);
		}
		t.pass('Successfully endorsed the instantiate chaincode proposal');

		let event_monitor = new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for instantiate');
				// still have to unregister to clean up the channelEventHub instance
				event_hub.unregisterTxEvent(txid);
				reject('timeout');
			}, 15000);

			event_hub.registerTxEvent(txid, (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('instantiate has transaction code:'+ code + ' for transaction id ::'+txnid);
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event for instantiate');
				// send back error
				reject(error);
			});
		});

		let send_trans = channel.sendTransaction({proposalResponses: proposalResponses,	proposal: proposal});

		return Promise.all([event_monitor, send_trans]);
	}).then((results) => {
		t.pass('Successfully got the instantiate results');
		t.equal(results[0],'VALID', 'checking that the event says the transaction was valid');

		// need to always get a new transaction id for every transaction
		let tx_id = client.newTransactionID();
		txid = tx_id.getTransactionID(); //save the transaction id string
		let req = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'BLOCK'],
			txId: tx_id
		};
		t.pass('Successfully built transaction proposal request with txid:'+txid);

		return channel.sendTransactionProposal(req);
	}).then((results) => {
		// a real application would check the proposal results
		t.pass('Successfully endorsed proposal to invoke chaincode');

		let event_monitor = new Promise((resolve, reject) => {
			let block_reg = null;
			let handle = setTimeout(() => {
				if (block_reg) {
					event_hub.unregisterBlockEvent(block_reg);
					event_hub.unregisterTxEvent(txid);
					t.fail('Timeout - Failed to receive the block and transaction event');
				}
				reject(new Error('Timed out waiting for block event'));
			}, 20000);

			block_reg = event_hub.registerBlockEvent((filtered_block) => {
				clearTimeout(handle);
				event_hub.unregisterBlockEvent(block_reg);
				// this block listener has to handle the filtered block
				if(filtered_block.number) {
					t.pass('Successfully received the filtered block event for block_num:' + filtered_block.number);
				} else {
					t.failed('Failed - received the full block event for block_num:' + filtered_block.header.number);
				}
			}, (error)=> {
				clearTimeout(handle);
				t.fail('Failed to receive the block event ::'+error);
			});

			event_hub.registerTxEvent(txid, (txid, status, block_num) => {
				t.pass('Successfully got transaction event with txid:'+txid);
				t.pass('Successfully received the transaction status:'+ status + ' for block num:'+block_num);
				resolve(block_num);
			}, (error)=> {
				t.fail('Failed to receive the block event ::'+error);
				reject(error);
			});
		});
		let send_trans = channel.sendTransaction({proposalResponses: results[0],	proposal: results[1]});

		return Promise.all([event_monitor, send_trans]);
	}).then((results) => {
		t.pass('Successfully got the block ::'+ results[0]);
		t.pass('Successfully got send transaction status of :'+ results[1].status);

		// the query target will be the peer added to the channel
		return channel.queryBlock(Long.fromValue(results[0]).toNumber());
	}).then((results) => {
		t.pass('Successfully queried for block: '+results.header.number);

		let request = {
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		// the query target will be the peer added to the channel
		return channel.queryByChaincode(request);
	}).then((results) => {
		t.pass('Successfully queried chaincode again...');

		for (let i = 0; i < results.length; i++) {
			t.pass('Got results back ' + results[i].toString('utf8') );
			t.equal(results[i].toString('utf8'), '1', 'checking query results are number of events generated');
		}

		// need to always get a new transactionId object for every transaction
		let tx_id = client.newTransactionID();
		txid = tx_id.getTransactionID(); //save the actual transaction id string
		let req = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'CHAINCODE'],
			txId: tx_id
		};

		return channel.sendTransactionProposal(req);
	}).then((results) => {
		// a real application would check the proposal results
		t.pass('Successfully endorsed proposal to invoke chaincode');

		let event_monitor = new Promise((resolve, reject) => {
			let regid = null;
			let handle = setTimeout(() => {
				if (regid) {
					event_hub.unregisterChaincodeEvent(regid);
					t.fail('Timeout - Failed to receive the chaincode event');
				}
				reject(new Error('Timed out waiting for chaincode event'));
			}, 40000);

			regid = event_hub.registerChaincodeEvent(chaincode_id.toString(), '^evtsender*', (event, block_num, txnid, status) => {
				t.pass('Successfully got a chaincode event with transid:'+ txnid + ' with status:'+status);
				// --- With filtered events there is no chaincode event payload,
				// --- the chaincode event does have the chaincode event name.
				// --- To get the payload you must call the connect(true) to get full blocks
				// --- and you must have the access rights to get those blocks that
				// --- contain your chaincode events with the payload
				clearTimeout(handle);
				// Chaincode event listeners are meant to run continuously
				// Therefore the default to automatically unregister is false
				// So in this case we want to shutdown the event listener
				event_hub.unregisterChaincodeEvent(regid);
				t.pass('Successfully received the chaincode event on block number '+ block_num);
				resolve('RECEIVED');
			}, (error)=> {
				clearTimeout(handle);
				t.fail('Failed to receive the chaincode event ::'+error);
				reject(error);
			});
		});
		let send_trans = channel.sendTransaction({proposalResponses: results[0],	proposal: results[1]});

		return Promise.all([event_monitor, send_trans]);
	}).then((results) => {
		t.pass('Successfully submitted the transaction to be committed');

		t.equals(results[0], 'RECEIVED', 'Checking that we got the correct resolve string from our event callback');
		//check the status of the sendTransaction
		let sendResults = results[1];
		// notice that we are using index 1, the orderer is based on the order of
		// the promise all array , where the send transaction was second

		// overall status
		let all_good = false;

		if(sendResults.status && sendResults.status === 'SUCCESS') {
			all_good = true;
			t.pass('Successfully sent transaction to get chaincode event');
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

		let request = {
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		// the query target will be the peer added to the channel
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

			event_hub.registerTxEvent(req1.txId.getTransactionID(), (txnid, code, block_num) => {
				clearTimeout(handle);
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
				t.fail('Failed to receive event for Event1 for transaction id ::'+req1.txId.getTransactionID());
				// send back error
				reject(error);
			});

		});
		let event_monitor_2 =  new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for event2');
				// still have to unregister to clean up the channelEventHub instance
				event_hub.unregisterTxEvent(req2.txId.getTransactionID());
				reject('timeout');
			}, 200000);

			event_hub.registerTxEvent(req2.txId.getTransactionID(), (txnid, code) => {
				clearTimeout(handle);
				t.pass('Event2 has transaction code:'+ code + ' for transaction id ::'+txnid);
				// send back what we got... look at it later
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event2 for Event2 for transaction id ::'+req2.txId.getTransactionID());
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
			let channel_height = Long.fromValue(results.height);

			// will use the following number as way to know when to stop the replay
			let current_block = channel_height.subtract(1);
			t.pass('Successfully got current_block number :'+ current_block.toInt());

			let eh2 = channel.newChannelEventHub(peer);
			eventhubs.push(eh2); //putting on this list will have it closed on the test end
			let block_reg_num = null;

			// a real application would not want to have a timeout if the application
			// wanted to continuously listen to block events
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to replay all the block events in a reasonable amount of time');
				eh2.unregisterBlockEvent(block_reg_num); // using unregister set to false
				throw new Error('Timeout -  block replay has not completed');
			}, 60000);

			// register to replay all block events
			block_reg_num = eh2.registerBlockEvent((full_block) => {
				// block number is decoded into human readable form
				// let's put it back into a long
				let event_block = Long.fromValue(full_block.header.number);
				if(event_block.equals(current_block)) {
					clearTimeout(handle);
					// This registation must be done before the connect since
					// the listener being register will be doing replay/resume
					eh2.unregisterBlockEvent(block_reg_num);
					// using unregister set to false, just to show how to use
					// if we do not remove the registration
					// the error callback will get called
					// when the disconnect gets called at the test end
					t.pass('Successfully had all blocks replayed ');
					let last_block_number = eh2.lastBlockNumber();
					if(last_block_number.equals(event_block)) {
						t.pass('Successfully got the same last block number');
					} else {
						t.fail('Failed to get the same last block number');
					}
					resolve('all blocks replayed');
				} else {
					t.pass('Replay block event '+full_block.header.number);
					if(full_block.header.number === '112') {
						t.pass('time to stop');
					}
					// keep going...do not resolve this promise yet
				}
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to replay all the block events');
				throw new Error('Replay Error callback was called with ::' + error);
			},
				// a real application would have remembered the last block event
				// received and used that value here to start the replay
				// setting the unregister here, so application code will handle it
				{startBlock : 0, endBlock : current_block, unregister : false}
			);
			t.pass('Successfully registered block replay with startBlock and endBlock reg number of :'+block_reg_num);

			// this connect must be done after the registration of listener
			// doing resume/replay so that the peer's channel-base event service
			// will know to which blocks to send.
			eh2.connect(true);
			t.pass('Successfully called connect on the replay with startblock and endblock');
		});
	}).then((results) => {
		t.pass('Successfully got results :'+results);
		return new Promise((resolve, reject) => {
			// need to create a new ChannelEventHub when registering a listener
			// that will have a startBlock or endBlock -- doing a replay/resume
			// The ChannelEventHub must not have been connected or have other
			// listeners.
			let eh2 = channel.newChannelEventHub(peer);
			eventhubs.push(eh2); //putting on this list will have it closed on the test end

			// a real application would not want to have a timeout if the application
			// wanted to continuously listen to block events
			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to replay all the block events in a reasonable amount of time');
				throw new Error('Timeout -  block replay has not completed');
			}, 10000);
			let block_reg_num = null;

			// register to replay block events
			block_reg_num = eh2.registerBlockEvent((block) => {
				t.fail('Failed - the error callback should get called when only endBlock defined lower than chain height');
				reject('all blocks replayed with only endBlock defined');
			}, (error) => {
				clearTimeout(handle);
				t.pass('Successfully got the error when only endBlock defined lower than chain height');
				resolve('Replay Error callback was called with ::' + error);
			},
				// this should not work as the current block height is larger
				{endBlock : 0}
			);
			t.pass('Successfully registered block replay with only endBlock, registration number of :'+block_reg_num);

			eh2.connect(true);
			t.pass('Successfully called connect on the replay with only endblock - will fail later');
		});
	}).then((results) => {
		t.pass('Successfully got results :'+results);

		return new Promise((resolve, reject) => {
			// need to create a new ChannelEventHub when registering a listener
			// that will have a startBlock or endBlock -- doing a replay/resume
			// The ChannelEventHub must not have been connected or have other
			// listeners.
			let eh2 = channel.newChannelEventHub(peer);
			eventhubs.push(eh2); //putting on this list will have it closed on the test end

			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive replay the event for event1');
				eh2.unregisterTxEvent(req1.txId.getTransactionID());
				t.end();
			}, 10000);

			eh2.registerTxEvent(req1.txId.getTransactionID(), (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('Event has been replayed with transaction code:'+ code + ' for transaction id:'+ txnid + ' for block_num:' + block_num);
				resolve('Got the replayed transaction');
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event replay for Event for transaction id ::'+req1.txId.getTransactionID());
				throw(error);
			},
				// a real application would have remembered that last block event
				// received and used that value to start the replay
				// Setting the disconnect to true as we do not want to use this
				// ChannelEventHub once event we are looking for comes in
				{startBlock : 0, disconnect: true}
			);
			t.pass('Successfully registered transaction replay for'+req1.txId.getTransactionID());

			eh2.connect(true);
			t.pass('Successfully called connect on the transaction replay event hub');
		});
	}).then((results) => {
		t.pass('Successfully got results :'+results);

		return new Promise((resolve, reject) => {
			// need to create a new ChannelEventHub when registering a listener
			// that will have a startBlock or endBlock -- doing a replay/resume
			// The ChannelEventHub must not have been connected or have other
			// listeners.
			let eh2 = channel.newChannelEventHub(peer);
			eventhubs.push(eh2); //putting on this list will have it closed on the test end
			let cc_reg = null;

			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive replay the event for event1');
				eh2.unregisterChaincodeEvent(cc_reg);
				t.end();
			}, 10000);

			cc_reg = eh2.registerChaincodeEvent(chaincode_id.toString(), '^evtsender*', (event, block_num, txnid, status) => {
				t.pass('Successfully got a chaincode event with transid:'+ txnid + ' with status:'+status);
				let event_payload = event.payload.toString('utf8');
				t.comment(' ------ payload ::'+event_payload);
				if(event_payload.indexOf('CHAINCODE') > -1) {
					clearTimeout(handle);
					// Chaincode event listeners are meant to run continuously
					// Therefore the default to automatically unregister is false
					// So in this case we want to shutdown the event listener once
					// we see the event with the correct payload
					eh2.unregisterChaincodeEvent(cc_reg);
					t.pass('Successfully received the chaincode event on block number '+ block_num);
					resolve('RECEIVED');
				} else {
					t.pass('Successfully got chaincode event ... just not the one we are looking for on block number '+ block_num);
				}
			}, (error)=> {
				clearTimeout(handle);
				t.fail('Failed to receive the chaincode event ::'+error);
				reject(error);
			},
				{startBlock: 0}
			);
			t.pass('Successfully registered chaincode with full blocks and replay');

			eh2.connect(true);
			t.pass('Successfully called connect on the chaincode fullblock replay event hub');
		});
	}).then((result) => {
		t.pass('Successfully finished testing with '+result);
		t.end();
	}).catch((err) => {
		if(err) t.fail('Unexpected error. ' + err.stack ? err.stack : err);
		else t.fail('Unexpected error with no error object in catch clause');
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
