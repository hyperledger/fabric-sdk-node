/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import {logMsg} from './baseUtils';

import {exec} from 'child_process';
import stripAnsi from 'strip-ansi';
import * as BaseUtils from '../utility/baseUtils';

export interface CommandResult {
	stdout: string;
	stderr: string;
	error?: Error;
	code?: number;
}
export class CommandRunner {

	public static getInstance(): CommandRunner {
		// Do you need arguments? Make it a regular static method instead.
		return this.instance || (this.instance = new this());
	}

	private static instance: CommandRunner;
	protected lastResp?: CommandResult;

	private constructor() {
		// Prevent external instantiation
	}

	/**
	 * Run a shell command
	 * @param {Boolean} pass - Boolean pass/fail case expected, undefined if unchecked case
	 * @param {String} cmd -  CLI command with parameters to be run
	 * @return {Promise} - Promise that will be resolved or rejected with an error
	 */
	public runShellCommand(pass: any, cmd: string, verbose = true): Promise<CommandResult> {
		BaseUtils.logMsg(` -- runShellCommand ==>${cmd}<==`);

		if (typeof cmd !== 'string') {
			return Promise.reject('Command passed to function was not a string');
		} else {
			const command: string = cmd.replace(/\s*[\n\r]+\s*/g, ' ');
			let stdout = '';
			let stderr = '';
			const env: any = Object.create(process.env);

			return new Promise((resolve: any, reject: any): any => {

				logMsg('SCENARIO CMD:', cmd);

				const childCliProcess = exec(command, {
					env,
					maxBuffer: 100000000,
				});

				if (!childCliProcess || !childCliProcess.stdout || !childCliProcess.stderr) {
					reject('ChildProcess object failed to create');
				} else {
					childCliProcess.stdout.setEncoding('utf8');
					childCliProcess.stderr.setEncoding('utf8');

					childCliProcess.stdout.on('data', (data: string) => {
						data = stripAnsi(data);
						stdout += data;
					});

					childCliProcess.stderr.on('data', (data: string) => {
						data = stripAnsi(data);
						stderr += data;
					});

					childCliProcess.on('error', error => {
						logMsg('SCENARIO CMD - STDOUT:\n', stdout);
						logMsg('SCENARIO CMD - STDERR:\n', stderr);
						this.lastResp = {
							error,
							stderr,
							stdout,
						};
						if (pass) {
							reject(this.lastResp);
						}
					});

					childCliProcess.on('close', (code: number) => {
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
