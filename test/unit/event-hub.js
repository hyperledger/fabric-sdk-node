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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var testutil = require('./util.js');

var EventHub = require('fabric-client/lib/EventHub.js');
var sdkUtils = require('fabric-client/lib/utils.js');

test('\n\n** EventHub tests\n\n', (t) => {
	testutil.resetDefaults();

	var eh;

	t.throws(
		() => {
			eh = new EventHub();
		},
		/Missing required argument: clientContext/,
		'Must pass in a clientContext'
	);

	t.throws(
		() => {
			eh = new EventHub({});
		},
		/Invalid clientContext argument: missing required function "getUserContext"/,
		'Must pass in a clientContext that has the getUserContext() function'
	);

	t.throws(
		() => {
			eh = new EventHub({ getUserContext: function() {} });
		},
		/The clientContext has not been properly initialized, missing userContext/,
		'Must pass in a clientContext that has the user context already initialized'
	);

	t.throws(
		() => {
			eh = new EventHub({ getUserContext: function() { return null; } });
		},
		/The clientContext has not been properly initialized, missing userContext/,
		'Must pass in a clientContext that has the user context already initialized'
	);

	eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	t.throws(
		() => {
			eh.connect();
		},
		/Must set peer address before connecting/,
		'Must not allow connect() when peer address has not been set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('badUrl');
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Must not allow a bad url without protocol to be set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('http://badUrl');
		},
		/InvalidProtocol: Invalid protocol: http/,
		'Must not allow an http url to be set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('https://badUrl');
		},
		/InvalidProtocol: Invalid protocol: https/,
		'Must not allow an https url to be set'
	);

	t.doesNotThrow(
		() => {
			eh.setPeerAddr('grpc://localhost:7053');
		},
		null,
		'Test valid url connect and disconnect'
	);

	t.throws(
		() => {
			eh.registerBlockEvent();
		},
		/Missing "onEvent" parameter/,
		'Check the Missing "onEvent" parameter'
	);

	t.throws(
		() => {
			eh.unregisterBlockEvent();
		},
		/Missing "block_registration_number" parameter/,
		'Check the Missing "block_registration_number" parameter'
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
			eh.unregisterTxEvent();
		},
		/Missing "txid" parameter/,
		'Check the Missing "txid" parameter'
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
			eh.registerBlockEvent({});
		},
		/The event hub has not been connected to the event source/,
		'Check the event hub must be connected before the block event listener can be registered'
	);
	t.throws(
		() => {
			eh.registerChaincodeEvent('ccid', 'eventname', {});
		},
		/The event hub has not been connected to the event source/,
		'Check the event hub must be connected before the chaincode event listener can be registered'
	);
	t.throws(
		() => {
			eh.registerTxEvent('txid', {});
		},
		/The event hub has not been connected to the event source/,
		'Check the event hub must be connected before the tranaction event listener can be registered'
	);
	t.end();
});

test('\n\n** EventHub block callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

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
	t.equal(Object.keys(eh._blockOnEvents).length, 2, 'Check the size of the blockOnEvents hash table');
	t.equal(Object.keys(eh._blockOnErrors).length, 2, 'Check the size of the blockOnErrors hash table');

	eh.disconnect();
});

test('\n\n** EventHub transaction callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	eh.registerTxEvent('txid1', (block) => {
		// empty method body
	}, (error) =>{
		// empty method body
	});
	t.pass('successfully registered transaction callbacks');
	t.equal(Object.keys(eh._transactionOnEvents).length, 1, 'Check the size of the transactionOnEvents hash table');
	t.equal(Object.keys(eh._transactionOnErrors).length, 1, 'Check the size of the transactionOnErrors hash table');

	eh.registerTxEvent('txid1', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Successfully called transaction error callback');
		t.end();
	});
	t.equal(Object.keys(eh._transactionOnEvents).length, 1,
		'Size of the transactionOnEvents hash table should still be 1 since the listeners are for the same txId');
	t.equal(Object.keys(eh._transactionOnErrors).length, 1,
		'Size of the transactionOnErrors hash table should still be 1 since the listeners are for the same txId');

	eh.registerTxEvent('txid2', (block) => {
		// empty method body
	}, (error) =>{
		// empty method body
	});

	t.equal(Object.keys(eh._transactionOnEvents).length, 2, 'Check the size of the transactionOnEvents hash table');
	t.equal(Object.keys(eh._transactionOnErrors).length, 2, 'Check the size of the transactionOnErrors hash table');

	eh.disconnect();
});

test('\n\n** EventHub chaincode callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

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

test('\n\n** EventHub block callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	eh.registerBlockEvent((block) => {
		t.fail('Should not have called block no error success callback');
		t.end();
	});
	t.pass('successfully registered block callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub transaction callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	eh.registerTxEvent('txid', (block) => {
		t.fail('Should not have called transaction no error success callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub chaincode callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called chaincode no error success callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub remove block callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

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
	t.equal(Object.keys(eh._blockOnEvents).length, 0, 'Check the size of the blockOnEvents hash table');
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove transaction callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	var txid = 'txid';
	eh.registerTxEvent(txid, (block) => {
		t.fail('Should not have called transaction success callback (on remove)');
		t.end();
	}, (error) =>{
		t.fail('Should not have called transaction error callback (on remove)');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.unregisterTxEvent(txid);
	t.pass('successfuly unregistered transaction callback');
	t.equal(Object.keys(eh._transactionOnEvents).length, 0, 'Check the size of the transactionOnEvents hash table');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove chaincode callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

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
	t.pass('successfuly disconnected eventhub');
	t.end();
});


test('\n\n** EventHub remove block callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	var blockcallback = (block) => {
		t.fail('Should not have called block success callback (remove with no error callback)');
		t.end();
	};
	var brn = eh.registerBlockEvent( blockcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove transaction callback no Error callback\n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;

	var txid = 'txid';
	eh.registerTxEvent(txid, (block) => {
		t.fail('Should not have called transaction success callback (remove with no error callback)');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.unregisterTxEvent(txid);
	t.pass('successfuly unregistered transaction callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove chaincode callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh._connected = true; //force this into connected state
	eh._force_reconnect = false;
	var cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called chaincode success callback (remove with no error callback)');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.unregisterChaincodeEvent(cbe);
	t.pass('successfuly unregistered chaincode callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** Test the add and remove utilty used by the EventHub to add a setting to the options \n\n', (t) => {
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
