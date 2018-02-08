/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var Long = require('long');
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var testutil = require('./util.js');
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var test_user = require('./user.js');

var Client = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var ChannelEventHub = require('fabric-client/lib/ChannelEventHub.js');
var sdkUtils = require('fabric-client/lib/utils.js');

var rewire = require('rewire');
var RewiredChannelEventHub = rewire('fabric-client/lib/ChannelEventHub.js');

test('\n\n** ChannelEventHub tests\n\n', (t) => {
	testutil.resetDefaults();

	let client = new Client();
	let channel = client.newChannel('mychannel');
	let peer = client.newPeer('grpc://somehost.com:8888');

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
			eh = new ChannelEventHub();
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
		/The clientContext has not been properly initialized, missing userContext/,
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
		/This ChannelEventHub has not had an event from the peer/,
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var index = eh.registerBlockEvent((block) => {
		t.fail('Should not have called success callback when disconnect() is called');
		t.end();
	}, (error) =>{
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var index = eh.registerBlockEvent((block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered block callbacks');
	t.equal(index, 1, 'Check the first block listener is at index 1');
	try {
		index = eh.registerBlockEvent((block) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
		index = eh.registerBlockEvent((block) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	eh.registerTxEvent('txid1', (transid, status) => {
		// empty method body
	}, (error) =>{
		// empty method body
	});
	t.pass('successfully registered transaction callbacks');
	t.equal(Object.keys(eh._transactionRegistrations).length, 1, 'Check the size of the transactionOnEvents hash table');

	t.throws(
	 	() => {
			eh.registerTxEvent('txid1', (transid, status) => {
				t.fail('Should not have called success callback');
				t.end();
			}, (error) =>{
				t.fail('Should not have called error callback');
				t.end();
			});
	 	},
	 	/has already been registered/,
	 	'Checking for TransactionId (%s) has already been registered'
	 );

	eh.registerTxEvent('txid2', (transid, status) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Should have called error callback');
		t.end();
	});

	t.equal(Object.keys(eh._transactionRegistrations).length, 2, 'Check the size of the transactionOnEvents hash table');

	eh.disconnect(); //should call the t.end() in the txid1 error callback
});

test('\n\n** ChannelEventHub transaction callback with replay \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);
	eh._force_reconnect = false;

	eh.registerTxEvent('transid', (transid, status) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered transaction callbacks');
	try {
		eh.registerTxEvent('transid', (transid, status) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
		eh.registerTxEvent('transid', (transid, status) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
			eh.registerTxEvent('txid3', (transid, status) => {
				t.fail('Should not have called success callback');
				t.end();
			}, (error) =>{
				t.fail('Should not have called error callback');
				t.end();
			},
				{startBlock: 2, endBlock: 1}
			);
	 	},
	 	/must not be larger than/,
	 	'Checking for "startBlock" (%s) must not be larger than "endBlock" (%s)'
	 );

	t.end();
});

test('\n\n** ChannelEventHub chaincode callback \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	eh.registerChaincodeEvent('ccid1', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Successfully called chaincode error callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 1, 'Check the size of the chaincodeRegistrants hash table');

	eh.registerChaincodeEvent('ccid1', 'eventfilter', (block) => {
		// empty method body
	}, (error) =>{
		// empty method body
	});

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 1,
		'Size of the chaincodeRegistrants hash table should still be 1 because both listeners are for the same chaincode');

	eh.registerChaincodeEvent('ccid2', 'eventfilter', (block) => {
		// empty method body
	}, (error) =>{
		// empty method body
	});

	t.equal(Object.keys(eh._chaincodeRegistrants).length, 2,
		'Size of the chaincodeRegistrants hash table should still be 2');

	eh.disconnect();
});


test('\n\n** ChannelEventHub chaincode callback with replay \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);
	eh._force_reconnect = false;

	let handle = eh.registerChaincodeEvent('ccid1', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.fail('Error callback should not be called');
		t.end();
	});

	t.pass('Successfully registered chaincode callbacks');
	try {
		eh.registerChaincodeEvent('ccid1', 'eventfilter', (block) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
		eh.registerChaincodeEvent('ccid1', 'eventfilter', (block) => {
			t.fail('Should not have called success callback');
			t.end();
		}, (error) =>{
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	eh.registerBlockEvent((block) => {
		t.fail('Should not have called block no error success callback');
		t.end();
	});
	t.pass('successfully registered block callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub transaction callback no Error callback \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	eh.registerTxEvent('txid', (txid, status) => {
		t.fail('Should not have called transaction no error success callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub chaincode callback no Error callback \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called chaincode no error success callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** ChannelEventHub remove block callback \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var blockcallback = (block) => {
		t.fail('Should not have called block success callback (on remove)');
		t.end();
	};
	var blockerrorcallback = (error) =>{
		t.fail('Should not have called block error callback (on remove)');
		t.end();
	};
	var brn = eh.registerBlockEvent( blockcallback, blockerrorcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.equal(Object.keys(eh._blockRegistrations).length, 0, 'Check the size of the blockOnEvents hash table');
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove transaction callback \n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var txid = 'txid';
	eh.registerTxEvent(txid, (transid, status) => {
		t.fail('Should not have called transaction success callback (on remove)');
		t.end();
	}, (error) =>{
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called chaincode success callback (on remove)');
		t.end();
	}, (error) =>{
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var blockcallback = (block) => {
		t.fail('Should not have called block success callback (remove with no error callback)');
		t.end();
	};
	var brn = eh.registerBlockEvent( blockcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected ChannelEventHub');
	t.end();
});

test('\n\n** ChannelEventHub remove transaction callback no Error callback\n\n', (t) => {
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var txid = 'txid';
	eh.registerTxEvent(txid, (transid, status) => {
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
	let client = new Client();
	let peer = new Peer('grpc://127.0.0.1:7051');
	let channel = client.newChannel('mychannel');
	let eh = channel.newChannelEventHub(peer);

	var cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
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
	var only_options = sdkUtils.checkAndAddConfigSetting('opt1', 'default1', null);
	t.equals(only_options['opt1'], 'default1', 'Checking that new options has the setting with the incoming value and options are null');

	var options = { opt1 : 'incoming1', opt4 : 'incoming4'};

	// case where incoming options does have the setting
	var updated_options = sdkUtils.checkAndAddConfigSetting('opt1', 'default1', options);
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
	var client = new Client();
	var channel = client.newChannel('mychannel');
	let peer = new Peer('grpc://127.0.0.1:9999');
	var event_hub = null;
	var member = new User('user1');
	var crypto_suite = utils.newCryptoSuite();
	crypto_suite.setCryptoKeyStore(utils.newCryptoKeyStore());
	member.setCryptoSuite(crypto_suite);
	crypto_suite.generateKey()
	.then(function (key) {
		return member.setEnrollment(key, test_user.TEST_CERT_PEM, 'DEFAULT');
	}).then(() => {
		var id = member.getIdentity();
		client.setUserContext(member, true);

		// tx test
		event_hub = channel.newChannelEventHub(peer);
		event_hub.registerTxEvent('123',
			(tx_id, code) => {
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
		let sleep_time = 3000;
		t.comment('about to sleep '+sleep_time);

		return sleep(sleep_time);
	}).then((nothing) => {
		t.pass('Sleep complete');
		// eventhub is now actually not connected
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n** EventHub test reconnect on block registration \n\n', (t) => {
	var client = new Client();
	var channel = client.newChannel('mychannel');
	let peer = new Peer('grpc://127.0.0.1:9999');
	var event_hub = null;
	var member = new User('user1');
	var crypto_suite = utils.newCryptoSuite();
	crypto_suite.setCryptoKeyStore(utils.newCryptoKeyStore());
	member.setCryptoSuite(crypto_suite);
	crypto_suite.generateKey()
	.then(function (key) {
		return member.setEnrollment(key, test_user.TEST_CERT_PEM, 'DEFAULT');
	}).then(() => {
		var id = member.getIdentity();
		client.setUserContext(member, true);

		event_hub = channel.newChannelEventHub(peer);
		t.doesNotThrow(
			() => {
				event_hub.registerBlockEvent((tx_id, code) => {
					t.fail('Failed callback should not have been called - block test 1');
				});
			},
			null,
			'Check for The event hub has not been connected to the event source - block test 1'
		);

		event_hub = channel.newChannelEventHub(peer);
		event_hub.registerBlockEvent(
			(tx_id, code) => {
				t.fail('Failed callback should not have been called - block test 2');
				t.end();
			},
			(error) =>{
				if(error.toString().indexOf('Connect Failed')) {
					t.pass('Successfully got the error call back block test 2 ::'+error);
				} else {
					t.failed('Failed to get connection failed error block test 2 ::'+error);
				}
				t.end();
			}
		);

		let state = event_hub.checkConnection();
		t.equals(state, 'UNKNOWN_STATE', 'Check the state of the connection');

		// force the connections
		// runs asynchronously, must be an error callback registered to get the
		// failure will be reported to an error callback
		state = event_hub.checkConnection(true);
		t.equals(state, 'UNKNOWN_STATE', 'Check the state of the connection');
		let sleep_time = 5000; //need to sleep longer than request timeout
		t.comment('about to sleep '+sleep_time);
		return sleep(sleep_time);
	}).then((nothing) => {
		t.pass('Sleep complete');
		// t.end() should come from the callback
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});

});

test('\n\n** Test the state conversion\n\n', (t) => {
	var getStateText = RewiredChannelEventHub.__get__('getStateText');

	t.equals(getStateText(0), 'IDLE', 'Checking that 0 state');
	t.equals(getStateText(1), 'CONNECTING', 'Checking that 1 state');
	t.equals(getStateText(2), 'READY', 'Checking that 2 state');
	t.equals(getStateText(3), 'TRANSIENT_FAILURE', 'Checking that 3 state');
	t.equals(getStateText(4), 'FATAL_FAILURE', 'Checking that 4 state');
	t.equals(getStateText(5), 'SHUTDOWN', 'Checking that 5 state');
	t.equals(getStateText(99), 'UNKNOWN_STATE', 'Checking that 99 state');

	t.end();
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
