/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const hfc = require('fabric-client');
const testutil = require('./util.js');
const utils = require('fabric-client/lib/utils.js');

const bunyan = require('bunyan');
const log4js = require('log4js');
const intercept = require('intercept-stdout');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');

let backup_env = null;
let unhook_count = 0;
const final_unhook_count = 5;

console.log(' ***** logger test loaded *****');

// Logger tests /////////
function testLogger(t, ignoreLevels) {
	console.log(' ***** logger.js - started *****');

	let output = '';

	const unhook = intercept((txt) => {
		output += txt;
	});

	const log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();
	unhook_count++;

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

test('\n\n ** Logging utility tests - save settings **\n\n', (t) => {
	console.log(' ***** logger.js - save settings *****');

	if (process.env.HFC_LOGGING) {
		backup_env = process.env.HFC_LOGGING;
	}
	t.pass('Successfully saved the environment');
	t.end();
});

test('\n\n ** Logging utility tests - built-in logger **\n\n', (t) => {
	console.log(' ***** logger.js - test built-in *****');

	if (process.env.HFC_LOGGING) {
		delete process.env.HFC_LOGGING;
	}

	if (global.hfc.logger) {
		global.hfc.logger = undefined;
	}

	testutil.resetDefaults();

	// test 2: custom logging levels for console logging
	let output = '';
	// setup the environment *ignore this*
	process.env.HFC_LOGGING = "{'debug': 'console'}"; // eslint-disable-line quotes
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	try {
		const unhook = intercept((txt) => {
			output += txt;
		});

		const logger = utils.getLogger('testlogger');

		unhook();
		unhook_count++;

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

	let unhook = intercept((txt) => {
		output += txt;
	});

	let log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();
	unhook_count++;

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

	unhook = intercept((txt) => {
		output += txt;
	});

	log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();
	unhook_count++;

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0 &&
		output.indexOf('Test logger - debug') > 0) {
		t.pass('Successfully tested debug logger levels');
	} else {
		t.fail('Failed to test debug logger levels. All of info, warn and error message should have appeared in console');
	}


	const prepareEmptyFile = function (logPath) {
		try {
			fs.ensureFileSync(logPath);

			const stats = fs.statSync(logPath);

			if (stats.isFile()) {
				fs.truncateSync(logPath);
			}
		} catch (err) {
			t.fail('Can not create an empty file to prepare for the rest of this test. ' + err.stack ? err.stack : err);
			t.end();
		}
	};

	const debugPath = path.join(testutil.getTempDir(), 'hfc-log/debug.log');
	console.log(' *** logger.js - debugPath:' + debugPath);
	const errorPath = path.join(testutil.getTempDir(), 'hfc-log/error.log');
	console.log(' *** logger.js - errorPath:' + errorPath);

	prepareEmptyFile(debugPath);
	prepareEmptyFile(errorPath);

	hfc.setConfigSetting('hfc-logging', util.format('{"debug": "%s", "error": "%s"}', debugPath, errorPath));
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	const log1 = utils.getLogger('testlogger');
	log1.error('Test logger - error');
	log1.warn('Test logger - warn');
	log1.info('Test logger - info');
	log1.debug('Test logger - debug');

	setTimeout(() => {
		let data = fs.readFileSync(debugPath);

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

test('\n\n ** Logging utility tests - test setting an external logger based on bunyan **\n\n', (t) => {
	console.log(' ***** logger.js - test bunyan *****');

	const logger = bunyan.createLogger({name: 'bunyanLogger'});
	hfc.setLogger(logger);

	testLogger(t);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an external logger based on log4js **\n\n', (t) => {
	console.log(' ***** logger.js - test log4js *****');

	const logger = log4js.getLogger();
	logger.level = 'info'; // Set level in order to output logs because by default it is OFF
	hfc.setLogger(logger);

	testLogger(t, true);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an invalid external logger **\n\n', (t) => {
	console.log(' ***** logger.js - test external *****');

	// construct an invalid logger
	const logger = {
		inf: function () {
			t.comment('info');
		},
	};

	try {
		hfc.setLogger(logger);
		t.fail('Should not have allowed an invalid logger to be set');
		t.end();
	} catch (err) {
		const er1 = err.toString();
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

test('\n\n ** Logging utility tests - clean up **\n\n', (t) => {
	console.log(' ***** logger.js - clean up *****');

	t.equals(unhook_count, final_unhook_count, 'Checking that the unhook count is correct to check the flow');

	if (backup_env) {
		process.env.HFC_LOGGING = backup_env;
	}

	// remove the args we added
	process.argv.pop();
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	t.pass('Successfully reset the logging environment');
	t.end();
});
