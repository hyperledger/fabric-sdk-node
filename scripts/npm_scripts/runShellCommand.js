/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const childProcess = require('child_process');
const stripAnsi = require('strip-ansi');

/* eslint-disable no-alert, no-console */

/**
 * Run a shell command
 * @param {String} cmd -  CLI command with parameters to be run
 * @param {Obejct} env -  environment shell for command to be run in
 * @return {Promise} - Promise that will be resolved or rejected with an error
 */
module.exports.runShellCommand = function(cmd, env) {
	if (typeof cmd !== 'string') {
		return Promise.reject('Command passed to function was not a string');
	} else {
		const command = cmd.replace(/\s*[\n\r]+\s*/g, ' ');
		let stdout = '';
		let stderr = '';

		return new Promise((resolve, reject) => {

			const options = {
				env : env,
				maxBuffer: 100000000
			};
			const childCliProcess = childProcess.exec(command, options);

			childCliProcess.stdout.setEncoding('utf8');
			childCliProcess.stderr.setEncoding('utf8');

			childCliProcess.stdout.on('data', (data) => {
				const stdOutData = stripAnsi(data);
				stdout += stdOutData;
			});

			childCliProcess.stderr.on('data', (data) => {
				const stdErrData = stripAnsi(data);
				stderr += stdErrData;
			});

			childCliProcess.on('error', (error) => {
				console.log(stdout);
				console.log(stderr);
				this.lastResp = {error : error, stdout : stdout, stderr : stderr};
				reject(this.lastResp);
			});

			childCliProcess.on('close', (code) => {
				console.log(stdout);
				console.log(stderr);
				this.lastResp = {code : code, stdout : stdout, stderr : stderr};
				resolve(this.lastResp);
			});
		});
	}
};
