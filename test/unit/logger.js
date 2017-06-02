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

var hfc = require('fabric-client');
var testutil = require('./util.js');
var utils = require('fabric-client/lib/utils.js');

var bunyan = require('bunyan');
var log4js = require('log4js');
var intercept = require('intercept-stdout');
var fs = require('fs-extra');
var util = require('util');
var path = require('path');

// Logger tests /////////
function testLogger(t, ignoreLevels) {
	var output = '';

	let unhook = intercept(function (txt) {
		output += txt;
	});

	let log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0) {
		if (output.indexOf('Test logger - debug') > 0 && !ignoreLevels) {
			t.fail('Default logger setting should not have printed debug logs');
		} else {
			t.pass('Successfully tested default logger levels');
		}
	} else {
		t.fail('Failed to test default logger levels: info, warn and error');
	}
}

test('\n\n ** Logging utility tests - built-in logger **\n\n', function (t) {
	if (!!process.env.HFC_LOGGING) {
		delete process.env['HFC_LOGGING'];
	}

	if (!!global.hfc.logger) {
		global.hfc.logger = undefined;
	}

	testutil.resetDefaults();

	// test 2: custom logging levels for console logging
	var output = '';
	// setup the environment *ignore this*
	process.env.HFC_LOGGING = "{'debug': 'console'}"; // eslint-disable-line quotes
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	try {
		let unhook = intercept(function (txt) {
			output += txt;
		});

		let logger = utils.getLogger('testlogger');

		unhook();

		if (output.indexOf('Failed to parse environment variable "HFC_LOGGING"') > 0 && logger) {
			t.pass('Successfully caught error thrown by "utils.getLogger()" on invalid environment variable value, and returned a valid default logger');
		} else {
			t.fail('Failed to catch invalid environment variable value or return a valid default logger');
		}
	} catch (err) {
		t.fail('Failed to properly handle invalid environment variable value. ' + err.stack ? err.stack : err);
	}


	output = '';
	// setup the environment
	process.env.HFC_LOGGING = '{"debug": "console"}';
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;

	let unhook = intercept(function (txt) {
		output += txt;
	});

	let log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0 &&
		output.indexOf('Test logger - debug') > 0) {
		t.pass('Successfully tested debug logger levels');
	} else {
		t.fail('Failed to test debug logger levels. All of info, warn and error message should have appeared in console');
	}

	output = '';
	// setup the environment
	process.argv.push('--hfc-logging={"debug": "console"}');
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;

	unhook = intercept(function (txt) {
		output += txt;
	});

	log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0 &&
		output.indexOf('Test logger - debug') > 0) {
		t.pass('Successfully tested debug logger levels');
	} else {
		t.fail('Failed to test debug logger levels. All of info, warn and error message should have appeared in console');
	}


	let prepareEmptyFile = function (logPath) {
		try {
			fs.ensureFileSync(logPath);

			let stats = fs.statSync(logPath);

			if (stats.isFile()) {
				fs.truncateSync(logPath);
			}
		} catch (err) {
			t.fail('Can not create an empty file to prepare for the rest of this test. ' + err.stack ? err.stack : err);
			t.end();
		}
	};

	let debugPath = path.join(testutil.getTempDir(), 'hfc-log/debug.log');
	let errorPath = path.join(testutil.getTempDir(), 'hfc-log/error.log');
	prepareEmptyFile(debugPath);
	prepareEmptyFile(errorPath);

	hfc.setConfigSetting('hfc-logging', util.format('{"debug": "%s", "error": "%s"}', debugPath, errorPath));
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	var log1 = utils.getLogger('testlogger');
	log1.error('Test logger - error');
	log1.warn('Test logger - warn');
	log1.info('Test logger - info');
	log1.debug('Test logger - debug');

	setTimeout(function () {
		var data = fs.readFileSync(debugPath);

		if (data.indexOf('Test logger - error') > 0 &&
			data.indexOf('Test logger - warn') > 0 &&
			data.indexOf('Test logger - info') > 0 &&
			data.indexOf('Test logger - debug') > 0) {
			t.pass('Successfully tested logging to debug file');
		} else {
			t.fail('Failed to validate content in debug log file');
		}

		data = fs.readFileSync(errorPath);

		if (data.indexOf('Test logger - error') > 0) {
			if (data.indexOf('Test logger - warn') > 0 ||
				data.indexOf('Test logger - info') > 0 ||
				data.indexOf('Test logger - debug') > 0) {
				t.fail('Failed testing logging to error file, it should not contain any debug, info or warn messages.');
			} else {
				t.pass('Successfully tested logging to error file');
			}
		} else {
			t.fail('Failed to validate content in error log file');
		}

		t.end();
	}, 1000);
});

test('\n\n ** Logging utility tests - test setting an external logger based on bunyan **\n\n', function (t) {
	var logger = bunyan.createLogger({ name: 'bunyanLogger' });
	hfc.setLogger(logger);

	testLogger(t);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an external logger based on log4js **\n\n', function (t) {
	var logger = log4js.getLogger();
	hfc.setLogger(logger);

	testLogger(t, true);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an invalid external logger **\n\n', function (t) {
	// construct an invalid logger
	var logger = {
		inf: function () { console.log('info'); },
	};

	try {
		hfc.setLogger(logger);
		t.fail('Should not have allowed an invalid logger to be set');
		t.end();
	} catch (err) {
		var er1 = err.toString();
		if (er1.indexOf('debug()') > 0 &&
			er1.indexOf('info()') > 0 &&
			er1.indexOf('warn()') > 0 &&
			er1.indexOf('error()') > 0) {
			t.pass('Successfully tested thrown error for an invalid logger to set on the HFC SDK');
			t.end();
		} else {
			t.fail('Failed to catch all errors for an invalid logger missing required methods');
			t.end();
		}
	}
});