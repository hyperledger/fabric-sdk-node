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
var util = require('util');
var path = require('path');
var fs = require('fs-extra');

var Client = require('fabric-client');
var CA_Client = require('fabric-ca-client');

// THIS TEST FILE MUST BE RUN FIRST so that node.js will not load the two clients in this order

test('\n\n ** config testing **\n\n', function (t) {
	// this setting is in both configs, so we want to to find the fabric-client's version not the fabric-ca-client
	let timeout = Client.getConfigSetting('request-timeout');
	t.equal(timeout, 45000, 'the timeout is correct, which means the configs were loaded in the correct order');
	t.pass('Got to the end');
	t.end();
});
