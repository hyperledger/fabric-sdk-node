/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Client = require('fabric-client');


// THIS TEST FILE MUST BE RUN FIRST so that node.js will not load the two clients in this order

test('\n\n ** config testing **\n\n', (t) => {
	// this setting is in both configs, so we want to to find the fabric-client's version not the fabric-ca-client
	const timeout = Client.getConfigSetting('request-timeout');
	t.equal(timeout, 45000, 'the timeout is correct, which means the configs were loaded in the correct order');
	t.pass('Got to the end');
	t.end();
});
