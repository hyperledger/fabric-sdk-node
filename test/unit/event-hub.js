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

testutil.resetDefaults();

var EventHub = require('fabric-client/lib/EventHub.js');

test('\n\n** EventHub tests\n\n', (t) => {
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
		/Missing "cbe" parameter/,
		'Check the Missing "cbe" parameter'
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
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerBlockEvent((block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Successfully called error callback');
		t.end();
	});
	t.pass('successfully registered block callbacks');
	eh.disconnect();
});

test('\n\n** EventHub transaction callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerTxEvent('txid', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Successfully called error callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.disconnect();
});

test('\n\n** EventHub chaincode callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.pass('Successfully called error callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.disconnect();
});

test('\n\n** EventHub block callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerBlockEvent((block) => {
		t.fail('Should not have called success callback');
		t.end();
	});
	t.pass('successfully registered block callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub transaction callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerTxEvent('txid', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub chaincode callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.disconnect();
	t.end();
});

test('\n\n** EventHub remove block callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	var blockcallback = (block) => {
		t.fail('Should not have called success callback');
		t.end();
	};
	var blockerrorcallback = (error) =>{
		t.fail('Should not have called error callback');
		t.end();
	};
	var brn = eh.registerBlockEvent( blockcallback, blockerrorcallback);
	t.pass('successfully registered block callbacks');
	eh.unregisterBlockEvent(brn);
	t.pass('successfuly unregistered block callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove transaction callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	var txid = 'txid';
	eh.registerTxEvent(txid, (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.fail('Should not have called error callback');
		t.end();
	});
	t.pass('successfully registered transaction callbacks');
	eh.unregisterTxEvent(txid);
	t.pass('successfuly unregistered transaction callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});

test('\n\n** EventHub remove chaincode callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	var cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	}, (error) =>{
		t.fail('Should not have called error callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.unregisterChaincodeEvent(cbe);
	t.pass('successfuly unregistered chaincode callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});


test('\n\n** EventHub remove block callback no Error callback \n\n', (t) => {
	var eh = new EventHub({ getUserContext: function() { return 'dummyUser'; } });
	eh.setPeerAddr('grpc://localhost:7053');
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	var blockcallback = (block) => {
		t.fail('Should not have called success callback');
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
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;

	var txid = 'txid';
	eh.registerTxEvent(txid, (block) => {
		t.fail('Should not have called success callback');
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
	eh.connected = true; //force this into connected state
	eh.force_reconnect = false;
	var cbe = eh.registerChaincodeEvent('ccid', 'eventfilter', (block) => {
		t.fail('Should not have called success callback');
		t.end();
	});
	t.pass('successfully registered chaincode callbacks');
	eh.unregisterChaincodeEvent(cbe);
	t.pass('successfuly unregistered chaincode callback');
	eh.disconnect();
	t.pass('successfuly disconnected eventhub');
	t.end();
});
