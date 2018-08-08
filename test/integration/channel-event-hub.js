/**
 * Copyright 2017 London Stock Exchange All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('channel-event-hub');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const fs = require('fs');
const Long = require('long');

const Client = require('fabric-client');
const testUtil = require('../unit/util.js');
const e2eUtils = require('./e2e/e2eUtils.js');

// When running this as a standalone test, be sure to create and join a channel called 'mychannel'
test('*****  Test channel events', async (t) => {
	t.pass(' ======>>>>> CHANNEL EVENT INTEGRATION TEST START');

	try {
		testUtil.resetDefaults();
		testUtil.setupChaincodeDeploy();
		const client = new Client();
		const channel = client.newChannel('mychannel'); // this channel must exist in the fabric network

		const chaincode_version = testUtil.getUniqueVersion();
		const chaincode_id = 'events_unit_test_' + chaincode_version;
		const targets = [];
		let req = null;
		let tx_id = null;
		let txid = null;

		// using an array to track the event hub instances so that when this gets
		// passed into the overriden t.end() closure below it will get updated
		// later when the eventhub instances are created
		const eventhubs = [];
		// override t.end function so it'll always disconnect the event hub
		t.end = ((context, ehs, f) => {
			return function() {
				for(const key in ehs) {
					const eventhub = ehs[key];
					if (eventhub && eventhub.isconnected()) {
						logger.debug('Disconnecting the event hub from the modified test end method');
						eventhub.disconnect();
					}
				}

				f.apply(context, arguments);
			};
		})(t, eventhubs, t.end);

		let tlsInfo = await e2eUtils.tlsEnroll('org1');
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg('peerOrg1')});
		client.setStateStore(store);

		// get the peer org's admin user identity
		await testUtil.getSubmitter(client, t, true /* get peer org admin */, 'org1');

		let data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
		const orderer = client.newOrderer('grpcs://localhost:7050',{
			'pem': Buffer.from(data).toString(),
			'ssl-target-name-override': 'orderer.example.com'});
		channel.addOrderer(orderer);

		data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem'));
		const peer = client.newPeer('grpcs://localhost:7051',{
			pem: Buffer.from(data).toString(),
			'ssl-target-name-override': 'peer0.org1.example.com'
		});
		channel.addPeer(peer);
		targets.push(peer);

		// get a transaction ID object based on the current user assigned to the client instance
		tx_id = client.newTransactionID();
		req = {
			targets : targets,
			chaincodePath: 'github.com/events_cc',
			chaincodeId: chaincode_id,
			chaincodeVersion: chaincode_version,
			txId: tx_id
		};

		let results = await client.installChaincode(req, 30000);
		if(!checkResults(t, results[0])) {
			throw Error('Failed to install chaincode');
		}

		// get a transaction ID object based on the current user assigned
		// to the client instance
		tx_id = client.newTransactionID();
		txid = tx_id.getTransactionID(); //get the transaction id string

		req = {
			targets : targets,
			chaincodeId: chaincode_id,
			chaincodeVersion: chaincode_version,
			fcn: 'init',
			args: [],
			txId: tx_id
		};

		// the instantiate proposal can take longer
		results = await channel.sendInstantiateProposal(req, 30000);
		if(!checkResults(t, results[0])) {
			throw Error('Failed to instantiate chaincode');
		}

		/*
		 * Test
		 * Creating a ChannelEventHub
		 */
		const event_hub = channel.newChannelEventHub(peer);
		t.equal(event_hub.getName(), 'localhost:7051', 'Successfully created new channel event hub for peer, isName check');
		t.equal(event_hub.isconnected(), false, 'Successfully created new channel event hub for peer, isconnected check');
		eventhubs.push(event_hub); //add to list so we can shutdown at end of test

		/*
		 * Test
		 *  Transaction registration using all defaults
		 */
		let event_monitor = new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for instantiate');
				reject('timeout');
			}, 15000);

			event_hub.registerTxEvent(txid, (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('instantiate has transaction status code:'+ code + ' for transaction id ::' + txnid + ' block_num:' + block_num);
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event for instantiate ::'+ error.toString());
				// send back error
				reject(error);
			});
			event_hub.connect();
		});

		let send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

		results = await Promise.all([event_monitor, send_trans]);
		t.pass('Successfully got the instantiate results');

		// checking that the callback is able to tell the application something
		t.equal(results[0],'VALID', 'checking that the event says the transaction was valid');

		// must get a new transaction object for every transaction
		tx_id = client.newTransactionID();
		txid = tx_id.getTransactionID(); //get the actual transaction id string
		req = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'BLOCK'],
			txId: tx_id
		};

		results = await channel.sendTransactionProposal(req);
		if(!checkResults(t, results[0])) {
			throw Error('Failed to endorse invoke proposal with "BLOCK" arg');
		}

		/*
		 * Test
		 *  Register three events
		 *     Block registration using all defaults
		 *     Transaction registration using all defaults
		 *     Transaction registration that will only be called when event hub is shutdown
		 *  .connect() is not called, was called on last test, using an active event hub
		 */
		let error_callback_called = 0;
		let check_block_number = Long.fromValue(0);
		event_monitor = new Promise((resolve, reject) => {
			let block_reg = null;
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the block and transaction event');
				reject(new Error('Timed out waiting for events'));
			}, 20000);

			block_reg = event_hub.registerBlockEvent((filtered_block) => {
				// this block listener has to handle the filtered block
				if(filtered_block.number) {
					t.pass('Successfully received the filtered block event for block_num:' + filtered_block.number);
				} else {
					t.failed('Failed - received the full block event for block_num:' + filtered_block.header.number);
				}
			}, (error)=> {
				t.pass('Successfully receive error callback on the block event ::'+error);
			});

			event_hub.registerTxEvent(txid, (txid, status, block_num) => {
				t.pass('Successfully got transaction event with txid:'+txid + ' status:'+ status + ' for block num:'+block_num);
				check_block_number = Long.fromValue(block_num);
				resolve(block_num);
			}, (error)=> {
				t.fail('Failed to receive the known transaction event ::'+error);
				reject(error);
			});

			event_hub.registerTxEvent('NONEXISTENT', (txid, status, block_num) => {
				t.fail('Failed, got transaction event that we should not have with txid:'+txid);
				reject('FAILED - this transaction listener was called');
			}, (error)=> {
				error_callback_called++;
				// this error block has to be called or the timeout will hit
				clearTimeout(handle);
				t.pass('Successfully received the error callback for "NONEXISTENT" listener ::'+error);
			});

			event_hub.registerTxEvent('ALL', (txid, status, block_num) => {
				t.pass('Successfully got ALL transaction event with txid:'+txid);
			}, (error)=> {
				error_callback_called++;
				t.pass('Successfully received the error callback for "ALL" listener ::'+error);
			});
		});
		send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

		/*
		 * Test
		 *    See if block and transaction event listeners reported correct results
		 */
		results = await Promise.all([event_monitor, send_trans]);
		if(check_block_number.equals(Long.fromValue(results[0]))) {
			t.pass('Successfully got the block passed through from the transaction listener ');
		} else {
			t.fail('Failed to get correct block number passed through from the transaction listener');
		}

		/*
		 * Test
		 *   be sure the disconnect will call the error callback
		 */
		event_hub.disconnect();
		t.pass('Successfully called the disconnect');
		t.equal(error_callback_called, 2, 'Check that the error callback was called on disconnect');

		// the query target will be the peer added to the channel
		results = await channel.queryBlock(Long.fromValue(results[0]).toNumber());
		t.pass('Successfully queried for block: '+results.header.number);

		req = {
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		// the query target will be the peer added to the channel
		results = await channel.queryByChaincode(req);
		t.equal(results[0].toString('utf8'), '1', 'checking query results are number of events generated');

		// need to always get a new transactionId object for every transaction
		tx_id = client.newTransactionID();
		txid = tx_id.getTransactionID(); //save the actual transaction id string
		req = {
			targets : targets,
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['invoke', 'CHAINCODE'],
			txId: tx_id
		};

		results = await channel.sendTransactionProposal(req);
		if(!checkResults(t, results[0])) {
			throw Error('Failed to endorse invoke proposal with "CHAINCODE" arg');
		}

		/*
		 * Test
		 *    Register two chaincode event listeners with defaults
		 */
		const event_monitor1 = createChaincodeRegistration(t, 'first chaincode', event_hub, chaincode_id, '^evtsender*');
		const event_monitor2 = createChaincodeRegistration(t, 'second chaincode', event_hub, chaincode_id, '^evtsender*');
		send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

		/*
		 * Test
		 *   run the .connect() after a .disconnect()
		 */
		event_hub.connect();

		/*
		 * Test
		 *    See if chaincode event listeners reported results
		 */
		results = await Promise.all([event_monitor1, event_monitor2, send_trans]);
		t.pass('Successfully submitted the transaction to be committed');

		t.equals(results[0], 'RECEIVEDfirst chaincode', 'Checking that we got the correct resolve string from our first event callback');
		t.equals(results[1], 'RECEIVEDsecond chaincode', 'Checking that we got the correct resolve string from our second event callback');

		//check the status of the sendTransaction
		//   notice that we are using index 2, these are based on the order of
		//   the promise all array , where the send transaction was third
		const sendResults = results[2];
		if(sendResults && sendResults.status && sendResults.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to get chaincode event');
		} else {
			t.fail('Failed to send transaction to get chaincode event ');
		}

		req = {
			chaincodeId: chaincode_id,
			fcn: 'invoke',
			args: ['query']
		};

		// the query target will be the peer that was added to the channel
		results = await channel.queryByChaincode(req);
		t.equal(results[0].toString('utf8'), '1', 'checking query results are number of events generated');

		await testUtil.sleep(5000);

		results = await channel.queryByChaincode(req);
		t.equal(results[0].toString('utf8'), '2', 'checking query results are number of events generated');

		// Test invalid transaction
		// create 2 invoke requests in quick succession that modify
		// the same state, which should cause one invoke to
		// be invalid
		const req1 = {
			targets : targets,
			chaincodeId: chaincode_id,
			chaincodeVersion: '',
			fcn: 'invoke',
			args: ['invoke', 'TRANSACTIONID1'],
			txId: client.newTransactionID()
		};
		const send_proposal_1 = channel.sendTransactionProposal(req1);

		const req2 = {
			targets : targets,
			chaincodeId: chaincode_id,
			chaincodeVersion: '',
			fcn: 'invoke',
			args: ['invoke', 'TRANSACTIONID2'],
			txId: client.newTransactionID()
		};
		const send_proposal_2 = channel.sendTransactionProposal(req2);

		results = await Promise.all([send_proposal_1, send_proposal_2]);
		if(!checkResults(t, results[0][0])) {
			throw Error('Failed to endorse invoke proposal with "TRANSACTIONID1" arg');
		}
		if(!checkResults(t, results[1][0])) {
			throw Error('Failed to endorse invoke proposal with "TRANSACTIONID2" arg');
		}

		const event_monitor_1 =  new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for event1');
				reject('timeout');
			}, 200000);

			event_hub.registerTxEvent(req1.txId.getTransactionID(), (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('Event1 has transaction code:'+ code + ' for transactionID:'+txnid + ' block number:' + block_num);
				if(block_num) {
					t.pass('Successfully got the block number '+block_num);
				} else {
					t.fail('Failed to get the block number');
				}
				resolve(code);
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event for Event1 for transaction id ::'+req1.txId.getTransactionID());
				reject(error);
			});

		});

		const event_monitor_2 =  new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive the event for event2');
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

		// now get the promises that will send to the orderer
		const send_trans_1 = channel.sendTransaction({proposalResponses: results[0][0], proposal: results[0][1]});
		const send_trans_2 = channel.sendTransaction({proposalResponses: results[1][0], proposal: results[1][1]});

		// now lets have the events and the sendtransaction all execute together
		// results will come back when all of them complete
		results = await Promise.all([event_monitor_1, event_monitor_2, send_trans_1, send_trans_2]);
		t.pass('Successfully got back event and transaction results');
		// lets see what we have
		t.equal(results[2].status,'SUCCESS', 'Check that submit status is good');
		t.equal(results[3].status,'SUCCESS', 'Check that submit status is good');
		let VALID = 0;
		let MVCC_READ_CONFLICT = 0;
		if(results[0] === 'VALID') VALID++;
		if(results[1] === 'VALID') VALID++;
		if(results[0] === 'MVCC_READ_CONFLICT') MVCC_READ_CONFLICT++;
		if(results[1] === 'MVCC_READ_CONFLICT') MVCC_READ_CONFLICT++;
		t.equals(VALID, 1, 'Checking that we had one valid when sending two transactions');
		t.equals(MVCC_READ_CONFLICT, 1, 'Checking that we had one read conflict when sending two transactions');

		results = await channel.queryInfo(peer);
		logger.debug(' queryInfo ::%j',results);
		t.pass('Successfully received channel info');

		const channel_height = Long.fromValue(results.height);
		// will use the following number as way to know when to stop the replay
		const current_block = channel_height.subtract(1);
		t.pass('Successfully got current_block number :'+ current_block.toInt());

		const eh2 = channel.newChannelEventHub(peer);
		eventhubs.push(eh2); //putting on this list will have it closed on the test end
		let block_reg_num = null;

		let block_replay =  new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to replay all the block events in a reasonable amount of time');
				throw new Error('Timeout -  block replay has not completed');
			}, 10000);

			// register to replay all block events
			block_reg_num = eh2.registerBlockEvent((full_block) => {
				t.pass('Successfully got a replayed block ::' + full_block.header.number);
				// block number is decoded into human readable form
				// let's put it back into a long
				const event_block = Long.fromValue(full_block.header.number);
				if(event_block.equals(current_block)) {
					t.pass('Successfully got the last block number');
					clearTimeout(handle);
					resolve('all blocks replayed');
				}
				// keep going...do not resolve this promise yet
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to replay all the block events');
				throw new Error('Replay Error callback was called with ::' + error);
			},
				{startBlock : 0, endBlock : current_block}
			);
			eh2.connect(true);
		});

		results = await block_replay;
		t.equals(results, 'all blocks replayed', 'Checking that all blocks were replayed');

		eh2.disconnect(); //clean up

		let seen_last_block = false;
		block_replay =  new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				t.fail('Timeout - Failed to replay all the block events in a reasonable amount of time');
				throw new Error('Timeout -  block replay has not completed');
			}, 10000);

			// register to replay all block events
			block_reg_num = eh2.registerBlockEvent((full_block) => {
				t.pass('Successfully got a replayed block ::' + full_block.header.number);
				// block number is decoded into human readable form
				// let's put it back into a long
				const event_block = Long.fromValue(full_block.header.number);
				if(event_block.equals(current_block)) {
					t.pass('Successfully got the last block number');
					seen_last_block = true;
				}
				// keep going...do not resolve this promise yet
			}, (error) => {
				clearTimeout(handle);
				if(error.toString().indexOf('Newest block received')) {
					// this error callback will be called to indicate that the listener is no longer listening
					// in this case it is OK as the message indicates that newest block was sent
					t.pass('Message received inidicating newest block received ::' + error);
					resolve('newest block replayed');
				} else {
					t.fail('Failed to replay all the block events');
					throw new Error('Replay Error callback was called with ::' + error);
				}

			},
				{startBlock : 0, endBlock : 'newest'}
			);
			eh2.connect(true); //need to connect as disconnect was called
		});

		results = await block_replay;
		t.equals(results, 'newest block replayed', 'Checking that newest block replayed');


		t.pass(' ======>>>>> CHANNEL EVENT INTEGRATION TEST END');
	} catch(catch_err) {
		t.fail('Testing of channel events has failed with ' + catch_err);
	}

	t.end();
});


function createChaincodeRegistration(t, message, event_hub, chaincode_id, chaincode_eventname) {
	const event_monitor = new Promise((resolve, reject) => {
		let regid = null;
		const timeout_handle = setTimeout(() => {
			if (regid) {
				event_hub.unregisterChaincodeEvent(regid);
				t.fail('Timeout - Failed to receive the ' + message);
			}
			reject(new Error('Timed out waiting for chaincode event ' + message));
		}, 40000);

		regid = event_hub.registerChaincodeEvent(chaincode_id.toString(), chaincode_eventname, (event, block_num, txnid, status) => {
			t.pass('Successfully got a chaincode event with transid:'+ txnid + ' with status:'+status);
			// --- With filtered events there is no chaincode event payload,
			// --- the chaincode event does have the chaincode event name.
			// --- To get the payload you must call the connect(true) to get full blocks
			// --- and you must have the access rights to get those blocks that
			// --- contain your chaincode events with the payload
			clearTimeout(timeout_handle);
			// Chaincode event listeners are meant to run continuously
			// Therefore the default to automatically unregister is false
			// So in this case we want to shutdown the event listener
			event_hub.unregisterChaincodeEvent(regid);
			t.pass('Successfully received the chaincode event on block number '+ block_num + ' for ' + message);
			resolve('RECEIVED'+ message);
		}, (error)=> {
			clearTimeout(timeout_handle);
			t.fail('Failed to receive the ' + message + ' ::' + error);
			reject(error);
		});
	});
	return event_monitor;
}

function checkResults(t, proposalResponses) {
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

	if(!all_good) {
		t.fail('Failed to endorse the proposal');
		return false;
	}
	t.pass('Successfully endorsed the proposal');
	return true;
}
