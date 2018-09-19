/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Long = require('long');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const testutil = require('./util.js');
const User = require('fabric-client/lib/User.js');
const utils = require('fabric-client/lib/utils.js');
const test_user = require('./user.js');

const Client = require('fabric-client');
const Peer = require('fabric-client/lib/Peer.js');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub.js');
const sdkUtils = require('fabric-client/lib/utils.js');

const rewire = require('rewire');
const RewiredChannelEventHub = rewire('fabric-client/lib/ChannelEventHub.js');

test('\n\n** ChannelEventHub tests\n\n', (t) => {
	testutil.resetDefaults();

	const client = new Client();
	const channel = client.newChannel('mychannel');
	const peer = client.newPeer('grpc://somehost.com:8888');

	let eh;

	t.throws(
		() => {
			eh = new ChannelEventHub();
		},
		/Missing required argument: channel/,
		'Must pass in a channel'
	);

	t.throws(
		() => {
			eh = new ChannelEventHub(channel);
		},
		/Missing required argument: peer/,
		'Must pass in a peer'
	);

	t.throws(
		() => {
			eh = new ChannelEventHub(channel, peer);
			eh.registerBlockEvent({});
			eh.connect();
		},
		/Error connect the ChannelEventhub to peer, either the clientContext has not been properly initialized, missing userContext or admin identity or missing signedEvent/,
		'Must pass in a clientContext that has the user context already initialized'
	);

	client._userContext = {};
	eh = new ChannelEventHub(channel, peer);

	t.throws(
		() => {
			eh.registerBlockEvent();
		},
		/Missing "onEvent" parameter/,
		'Check the Missing "onEvent" parameter'
	);

	t.throws(
		() => {
			eh.unregisterBlockEvent(999, true);
		},
		/Block listener for block registration number/,
		'Check the Block listener for block registration number'
	);
	t.throws(
		() => {
			eh.registerTxEvent();
		},
		/Missing "txid" parameter/,
		'Check the Missing "txid" parameter'
	);
	t.throws(
		() => {
			eh.registerTxEvent('txid');
		},
		/Missing "onEvent" parameter/,
		'Check the Missing "onEvent" parameter'
	);
	t.throws(
		() => {
			eh.registerTxEvent(1234);
		},
		/is not a string/,
		'Check the txid is a string'
	);
	t.throws(
		() => {
			eh.unregisterTxEvent('bad', true);
		},
		/Transaction listener for transaction id/,
		'Check the Transaction listener for transaction id'
	);
	t.throws(
		() => {
			eh.registerChaincodeEvent();
		},
		/Missing "ccid" parameter/,
		'Check the Missing "ccid" parameter'
	);
	t.throws(
		() => {
			eh.registerChaincodeEvent('ccid');
		},
		/Missing "eventname" parameter/,
		'Check the Missing "eventname" parameter'
	);
	t.throws(
		() => {
			eh.registerChaincodeEvent('ccid','eventname');
		},
		/Missing "onEvent" parameter/,
		'Check the Missing "onEvent" parameter'
	);
	t.throws(
		() => {
			eh.unregisterChaincodeEvent();
		},
		/Missing "listener_handle" parameter/,
		'Check the Missing "listener_handle" parameter'
	);
	t.throws(
		() => {
			eh.unregisterChaincodeEvent('bad', true);
		},
		/No event registration for chaincode id/,
		'Check the No event registration for chaincode id'
	);
	t.throws(
		() => {
			eh._checkReplay({startBlock:'aaaa'});
		},
		/is not a valid number/,
		'Check that we able to see start block is not a number'
	);
	t.throws(
		() => {
			eh._checkReplay({startBlock:'1', endBlock:'bbbb'});
		},
		/is not a valid number/,
		'Check that we able to see end block is not a number'
	);

	t.throws(
		() => {
			eh.lastBlockNumber();
		},
		/This ChannelEventHub has not seen a block from the peer/,
		'Check that we able to see: This ChannelEventHub has not had an event from the peer'
	);

	let converted = utils.convertToLong('1');
	if(converted.equals(Long.fromValue(1))) {
		t.pass('Successfully utils.convertToLong strings to long');
	} else {
		t.fail('utils.convertToLong did not work for strings');
	}

	t.throws(
		() => {
			converted = utils.convertToLong('aaa');
		},
		/is not a valid number/,
		'Check that we able to see an error with a bad value on the convert'
	);

	t.throws(
		() => {
			converted = utils.convertToLong();
		},
		/value parameter is missing/,
		'Check that we able to see an error with a bad value on the convert'
	);

	t.throws(
		() => {
			converted = utils.convertToLong(null);
		},
		/value parameter is missing/,
		'Check that we able to see an error with a bad value on the convert'
	);

	converted = utils.convertToLong(1);
	if(converted.equals(Long.fromValue(1))) {
		t.pass('Successfully utils.convertToLong integer to long');
	} else {
		t.fail('utils.convertToLong did not work for integer');
	}



	let some_long = Long.fromValue(2);
	converted = utils.convertToLong(some_long);
	if(converted.equals(Long.fromValue(2))) {
		t.pass('Successfully utils.convertToLong a long');
	} else {
		t.fail('utils.convertToLong did not work for long');
	}

	some_long = Long.fromValue(0);
	converted = utils.convertToLong(some_long);
	if(converted.equals(Long.fromValue(0))) {
		t.pass('Successfully utils.convertToLong a long');
	} else {
		t.fail('utils.convertToLong did not work for long');
	}

	some_long = Long.fromValue('0');
	converted = utils.convertToLong(some_long);
	if(converted.equals(Long.fromValue(0))) {
		t.pass('Successfully utils.convertToLong a long');
	} else {
		t.fail('utils.convertToLong did not work for long');
	}

	t.end();
});

test('\n\n** ChannelEventHub block callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	let index = eh.registerBlockEvent(() => {
		t.fail('Should not have called success callback when disconnect() is called');
		t.end();
	}, () =>{
		t.pass('Successfully called error callback from disconnect()');
		t.end();
	});

	t.pass('successfully registered block callbacks');
	t.equal(index, 1, 'Check the first block listener is at index 1');

	index = eh.registerBlockEvent(() => {
		// empty method body
	}, () => {
		// empty method body
	});

	t.equal(index, 2, 'Check the 2nd block listener is at index 2');
	t.equal(Object.keys(eh._blockRegistrations).length, 2, 'Check the size of the blockOnEvents hash table');

	eh.disconnect();
});

test('\n\n** ChannelEventHub block callback with replay \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	let index = eh.registerBlockEvent(() => {
		t.fail('Should not have called success callback');
		t.end();
	}, () =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered block callbacks');
	t.equal(index, 1, 'Check the first block listener is at index 1');
	try {
		index = eh.registerBlockEvent(() => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1}
		);
		t.fail('Failed if the block event with a replay is registered after another block event');
	} catch(error) {
		if(error.toString().indexOf('Only one event registration is allowed')) {
			t.pass('Should not be able to register for more than one with replay');
		} else {
			t.fail('Should have gotten the only one event registration error ::'+error.toString());
		}
	}

	eh.unregisterBlockEvent(index);

	try {
		index = eh.registerBlockEvent(() => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1}
		);
		t.pass('Successfully registered a playback block event');
	} catch(error) {
		t.fail( 'Failed - Should be able to register with replay');
	}

	t.equal(index, 2, 'Check the first block listener is at index 2');
	t.equal(Object.keys(eh._blockRegistrations).length, 1, 'Check the size of the blockOnEvents');

	t.end();
});

test('\n\n** ChannelEventHub transaction callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	eh.registerTxEvent('txid1', () => {
		// empty method body
	}, () =>{
		// empty method body
	});
	t.pass('successfully registered transaction callbacks');
	t.equal(Object.keys(eh._transactionRegistrations).length, 1, 'Check the size of the transactionOnEvents hash table');

	t.throws(
		() => {
			eh.registerTxEvent('txid1', () => {
				t.fail('Should not have called success callback');
				t.end();
			}, () =>{
				t.fail('Should not have called error callback');
				t.end();
			});
		},
		/has already been registered/,
		'Checking for TransactionId has already been registered'
	);

	eh.registerTxEvent('all', () => {
		t.fail('Should not have called success callback');
		t.end();
	}, () =>{
		t.pass('Should have called error callback');
		t.end();
	});

	t.throws(
		() => {
			eh.registerTxEvent('All', () => {
				t.fail('Should not have called success callback');
				t.end();
			}, () =>{
				t.fail('Should not have called error callback');
				t.end();
			});
		},
		/\(All\) has already been registered/,
		'Checking for TransactionId has already been registered'
	);

	t.equal(Object.keys(eh._transactionRegistrations).length, 2, 'Check the size of the transactionOnEvents hash table');

	eh.disconnect(); //should call the t.end() in the txid1 error callback
});

test('\n\n** ChannelEventHub transaction callback with replay \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);
	eh._force_reconnect = false;

	eh.registerTxEvent('transid', () => {
		t.fail('Should not have called success callback');
		t.end();
	}, () =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered transaction callbacks');
	try {
		eh.registerTxEvent('transid', () => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1, endBlock: 2}
		);
		t.fail('Failed if the transaction event with a replay is registered after another transaction event');
	} catch(error) {
		if(error.toString().indexOf('Only one event registration is allowed')) {
			t.pass('Should not be able to register for more than one with replay');
		} else {
			t.fail('Should have gotten the only one event registration error ::'+error.toString());
		}
	}

	eh.unregisterTxEvent('transid');

	try {
		eh.registerTxEvent('transid', () => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1, endBlock: 2}
		);
		t.pass('Successfully registered a playback transaction event');
	} catch(error) {
		t.fail( 'Failed - Should be able to register with replay');
	}
	t.equal(Object.keys(eh._transactionRegistrations).length, 1, 'Check the size of the transactionOnEvents');

	eh._last_block_seen = Long.fromValue(2);
	eh._checkReplayEnd();
	t.equals(Object.keys(eh._transactionRegistrations).length, 0 ,'Check that the checkReplayEnd removes the startstop registered listener');


	t.throws(
		() => {
			eh = channel.newChannelEventHub(peer);
			eh.registerTxEvent('txid3', () => {
				t.fail('Should not have called success callback');
				t.end();
			}, () =>{
				t.fail('Should not have called error callback');
				t.end();
			},
			{startBlock: 2, endBlock: 1}
			);
		},
		/must not be larger than/,
		'Checking for "startBlock" (%s) must not be larger than "endBlock" (%s)'
	);

	let got_called = false;
	try {
		eh.unregisterTxEvent('transid');
		eh.registerTxEvent('all', () => {
			t.fail('Should not have called success callback');
			t.end();
		}, (err) =>{
			got_called = true;
			t.pass('Should be called after getting last trans or a shutdown');
			t.equals(err.toString().indexOf('ChannelEventHub has been shutdown'), 7,'Check that we got the correct error message');
		},
		{startBlock: 1, endBlock: 'newest'}
		);
		t.pass('Successfully registered a newest playback transaction event');
	} catch(error) {
		t.fail( 'Failed - Should be able to register with newest replay');
	}
	t.equal(eh._ending_block_newest, true, 'Check the newest state');
	t.equal(eh._allowRegistration, false, 'Check the replay state');
	t.deepEqual(eh._ending_block_number, Long.MAX_VALUE, 'Check the replay end block');

	// this should get some errors posted
	eh.disconnect();
	t.equal(got_called, true, 'Check that error callback was called');

	try {
		eh.unregisterTxEvent('transid');
		eh.registerBlockEvent(() => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 10000000, endBlock: 'newest'}
		);
		t.pass('Successfully registered a newest playback block event');
	} catch(error) {
		t.fail( 'Failed - Should be able to register with newest replay');
	}
	t.equal(eh._ending_block_newest, true, 'Check the newest state');
	t.equal(eh._allowRegistration, false, 'Check the replay state');
	t.deepEqual(eh._ending_block_number, Long.MAX_VALUE, 'Check the replay end block');

	t.end();
});

test('\n\n** ChannelEventHub chaincode callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	eh.registerChaincodeEvent('ccid1', 'eventfilter', () => {
		t.fail('Should not have called success callback');
		t.end();
	}, () =>{
		t.pass('Successfully called chaincode error callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 1, 'Check the size of the chaincodeRegistrants hash table');

	eh.registerChaincodeEvent('ccid1', 'eventfilter', () => {
		// empty method body
	}, () =>{
		// empty method body
	});

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 1,
		'Size of the chaincodeRegistrants hash table should still be 1 because both listeners are for the same chaincode');

	eh.registerChaincodeEvent('ccid2', 'eventfilter', () => {
		// empty method body
	}, () =>{
		// empty method body
	});

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 2,
		'Size of the chaincodeRegistrants hash table should still be 2');

	eh.disconnect();
});


test('\n\n** ChannelEventHub chaincode callback with replay \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);
	eh._force_reconnect = false;

	const handle = eh.registerChaincodeEvent('ccid1', 'eventfilter', () => {
		t.fail('Should not have called success callback');
		t.end();
	}, () =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered chaincode callbacks');
	try {
		eh.registerChaincodeEvent('ccid1', 'eventfilter', () => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1}
		);
		t.fail('Failed if the chaincode event with a replay is registered after another chaincode event');
	} catch(error) {
		if(error.toString().indexOf('Only one event registration is allowed')) {
			t.pass('Should not be able to register for more than one with replay');
		} else {
			t.fail('Should have gotten the only one event registration error ::'+error.toString());
		}
	}

	eh.unregisterChaincodeEvent(handle);

	try {
		eh.registerChaincodeEvent('ccid1', 'eventfilter', () => {
			t.fail('Should not have called success callback');
			t.end();
		}, () =>{
			t.fail('Should not have called error callback');
			t.end();
		},
		{startBlock: 1}
		);
		t.pass('Successfully registered a playback chaincode event');
	} catch(error) {
		t.fail( 'Failed - Should be able to register with replay');
	}

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 1, 'Check the size of the _chaincodeRegistrants');

	t.end();
});


test('\n\n** ChannelEventHub block callback no Error callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	eh.registerBlockEvent(() => {
		t.fail('Should not have called block no error success callback');
		t.end();
	});
	t.pass('successfully registered block callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub transaction callback no Error callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	eh.registerTxEvent('txid', () => {
		t.fail('Should not have called transaction no error success callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub chaincode callback no Error callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	eh.registerChaincodeEvent('ccid', 'eventfilter', () => {
		t.fail('Should not have called chaincode no error success callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub remove block callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const blockcallback = () => {
		t.fail('Should not have called block success callback (on remove)');
		t.end();
	};
	const blockerrorcallback = () =>{
		t.fail('Should not have called block error callback (on remove)');
		t.end();
	};
	const brn = eh.registerBlockEvent( blockcallback, blockerrorcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.equal(Object.keys(eh._blockRegistrations).length, 0, 'Check the size of the blockOnEvents hash table');
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove transaction callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const txid = 'txid';
	eh.registerTxEvent(txid, () => {
		t.fail('Should not have called transaction success callback (on remove)');
		t.end();
	}, () =>{
		t.fail('Should not have called transaction error callback (on remove)');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.unregisterTxEvent(txid);
	t.pass('successfuly unregistered transaction callback');
	t.equal(Object.keys(eh._transactionRegistrations).length, 0, 'Check the size of the transactionOnEvents hash table');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove chaincode callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', () => {
		t.fail('Should not have called chaincode success callback (on remove)');
		t.end();
	}, () =>{
		t.fail('Should not have called chaincode error callback (on remove)');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.unregisterChaincodeEvent(cbe);
	t.pass('successfuly unregistered chaincode callback');
	t.equal(Object.keys(eh._chaincodeRegistrants).length, 0,
		'Size of the chaincodeRegistrants hash table should be 0');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});


test('\n\n** ChannelEventHub remove block callback no Error callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const blockcallback = () => {
		t.fail('Should not have called block success callback (remove with no error callback)');
		t.end();
	};
	const brn = eh.registerBlockEvent( blockcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove transaction callback no Error callback\n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const txid = 'txid';
	eh.registerTxEvent(txid, () => {
		t.fail('Should not have called transaction success callback (remove with no error callback)');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.unregisterTxEvent(txid);
	t.pass('successfuly unregistered transaction callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove chaincode callback no Error callback \n\n', (t) => {
	const client = new Client();
	const peer = new Peer('grpc://127.0.0.1:7051');
	const channel = client.newChannel('mychannel');
	const eh = channel.newChannelEventHub(peer);

	const cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', () => {
		t.fail('Should not have called chaincode success callback (remove with no error callback)');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.unregisterChaincodeEvent(cbe);
	t.pass('successfuly unregistered chaincode callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** Test the add and remove utilty used by the ChannelEventHub to add a setting to the options \n\n', (t) => {
	const only_options = sdkUtils.checkAndAddConfigSetting('opt1', 'default1', null);
	t.equals(only_options['opt1'], 'default1', 'Checking that new options has the setting with the incoming value and options are null');

	const options = { opt1 : 'incoming1', opt4 : 'incoming4'};

	// case where incoming options does have the setting
	let updated_options = sdkUtils.checkAndAddConfigSetting('opt1', 'default1', options);
	// case where incoming options does not have setting and config does not
	updated_options = sdkUtils.checkAndAddConfigSetting('opt2', 'default2', updated_options);
	// case where incoming options does not have setting and config does
	sdkUtils.setConfigSetting('opt3', 'config3');
	updated_options = sdkUtils.checkAndAddConfigSetting('opt3', 'default3', updated_options);

	// case where incoming options does not have setting and config does have
	t.equals(updated_options['opt1'], 'incoming1', 'Checking that new options has the setting with the incoming value');
	t.equals(updated_options['opt2'], 'default2', 'Checking that new options has the setting with the default value');
	t.equals(updated_options['opt3'], 'config3', 'Checking that new options has the setting with the value from the config');
	t.equals(updated_options['opt4'], 'incoming4', 'Checking that new options has setting not looked at');

	t.end();
});

test('\n\n** ChannelEventHub test connect failure on transaction registration \n\n', (t) => {
	const client = new Client();
	const channel = client.newChannel('mychannel');
	const peer = new Peer('grpc://127.0.0.1:9999');
	let event_hub = null;
	const member = new User('user1');
	const crypto_suite = utils.newCryptoSuite();
	crypto_suite.setCryptoKeyStore(utils.newCryptoKeyStore());
	member.setCryptoSuite(crypto_suite);
	crypto_suite.generateKey()
		.then((key) => {
			return member.setEnrollment(key, test_user.TEST_CERT_PEM, 'DEFAULT');
		}).then(() => {
			client.setUserContext(member, true);

			// tx test
			event_hub = channel.newChannelEventHub(peer);
			event_hub.registerTxEvent('123',
				() => {
					t.fail('Failed callback should not have been called - tx test 2');
					t.end();
				},
				(error) => {
					if(error.toString().indexOf('Connect Failed')) {
						t.pass('Successfully got the error call back tx test 2 ::'+error);
					} else {
						t.failed('Failed to get connection failed error tx test 2 ::'+error);
					}
					t.end();
				}
			);

			event_hub.connect();

			return true;
		}).then(() => {
			t.pass('#2 call back tx test complete ');
		// eventhub is now actually not connected
		}).catch((err) => {
			t.fail(err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n** EventHub test reconnect on block registration \n\n', (t) => {
	const client = new Client();
	const channel = client.newChannel('mychannel');
	const peer = new Peer('grpc://127.0.0.1:9999');
	let event_hub = null;
	const member = new User('user1');
	const crypto_suite = utils.newCryptoSuite();
	crypto_suite.setCryptoKeyStore(utils.newCryptoKeyStore());
	member.setCryptoSuite(crypto_suite);
	crypto_suite.generateKey()
		.then((key) => {
			return member.setEnrollment(key, test_user.TEST_CERT_PEM, 'DEFAULT');
		}).then(() => {
			client.setUserContext(member, true);

			event_hub = channel.newChannelEventHub(peer);
			t.doesNotThrow(
				() => {
					event_hub.registerBlockEvent(() => {
						t.fail('Failed callback should not have been called - block test 1');
					});
				},
				'Check for The event hub has not been connected to the event source - block test 1'
			);

			event_hub = channel.newChannelEventHub(peer);
			event_hub.registerBlockEvent(
				() => {
					t.fail('Failed callback should not have been called - block test 3');
					t.end();
				},
				(error) =>{
					if(error.toString().indexOf('Connect Failed')) {
						t.pass('Successfully got the error call back block test 3 ::'+error);
					} else {
						t.failed('Failed to get connection failed error block test 3 ::'+error);
					}
					t.end();
				}
			);

			let ready = event_hub.checkConnection();
			if(ready) {
				t.fail('Connection should be not ready');
			} else {
				t.pass('Connection should be not ready');
			}

			// force the connections
			// runs asynchronously, must be an error callback registered to get the
			// failure will be reported to an error callback
			try {
				ready = event_hub.checkConnection(true);
				if(ready) {
					t.fail('Connection should be not ready after a force');
				} else {
					t.pass('Connection should be not ready after a force');
				}
			} catch(error) {
				t.fail('Connection ready test failed with %s', error);
			}


			return true;
		}).then(() => {
			t.pass('#3 callback block test complete');
		// t.end() should come from the callback
		}).catch((err) => {
			t.fail(err.stack ? err.stack : err);
			t.end();
		});

});
