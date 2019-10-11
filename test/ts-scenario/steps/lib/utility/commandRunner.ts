/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
import { logMsg } from './baseUtils';

import { ChildProcess, exec } from 'child_process';
import stripAnsi from 'strip-ansi';

export class CommandRunner {

	public static getInstance() {
		// Do you need arguments? Make it a regular static method instead.
		return this.instance || (this.instance = new this());
	}

	private static instance: CommandRunner;
	protected lastResp: any;

	private constructor() {
		// Prevent external instantiation
	}

	/**
	 * Run a shell command
	 * @param {Boolean} pass - Boolean pass/fail case expected, undefined if unchecked case
	 * @param {DataTable} cmd -  CLI command with parameters to be run
	 * @return {Promise} - Promise that will be resolved or rejected with an error
	 */
	public runShellCommand(pass: any, cmd: string, verbose: boolean = true) {
		if (typeof cmd !== 'string') {
			return Promise.reject('Command passed to function was not a string');
		} else {
			const command = cmd.replace(/\s*[\n\r]+\s*/g, ' ');
			let stdout = '';
			let stderr = '';
			const env = Object.create(process.env);

			return new Promise((resolve, reject) => {

				logMsg('SCENARIO CMD:', cmd);

				const options = {
					env,
					maxBuffer: 100000000,
				};

				const childCliProcess: ChildProcess = exec(command, options);

				if (!childCliProcess || !childCliProcess.stdout || !childCliProcess.stderr) {
					reject('ChildProcess object failed to create');
				} else {
					childCliProcess.stdout.setEncoding('utf8');
					childCliProcess.stderr.setEncoding('utf8');

					childCliProcess.stdout.on('data', (data) => {
						data = stripAnsi(data);
						stdout += data;
					});

					childCliProcess.stderr.on('data', (data) => {
						data = stripAnsi(data);
						stderr += data;
					});

					childCliProcess.on('error', (error) => {
						if (verbose) {
							logMsg('SCENARIO CMD - STDOUT:\n', stdout);
							logMsg('SCENARIO CMD - STDERR:\n', stderr);
						}
						this.lastResp = {
							error,
							stderr,
							stdout,
						};
						if (pass) {
							reject(this.lastResp);
						}
					});

					childCliProcess.on('close', (code) => {
						if (verbose) {
							logMsg('SCENARIO CMD - STDOUT:\n', stdout);
							logMsg('SCENARIO CMD - STDERR:\n', stderr);
						}
						if (pass === undefined) {
							// don't care case
							this.lastResp = {
								code,
								stderr,
								stdout,
							};
							resolve(this.lastResp);
						} else if (code && code !== 0 && pass) {
							// non zero return code, should pass
							this.lastResp = {
								code,
								stderr,
								stdout,
							};
							reject(this.lastResp);
						} else if (code && code === 0 && !pass) {
							// zero return code, should fail
							this.lastResp = {
								code,
								stderr,
								stdout,
							};
							reject(this.lastResp);
						} else {
							this.lastResp = {
								code,
								stderr,
								stdout,
							};
							resolve(this.lastResp);
						}
					});
				}
			});
		}
	}
}
