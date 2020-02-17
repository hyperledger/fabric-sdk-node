/*
Copyright IBM Corp. 2016 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// This is a node-js version of example_02.go

const shim = require('fabric-shim');

// An log4js logger instance
const logger = shim.newLogger('example_cc0');
// The logger level can also be set by environment variable 'CORE_CHAINCODE_LOGGING_SHIM'
// to CRITICAL, ERROR, WARNING, DEBUG
logger.level = 'info';

const Chaincode = class {
	async Init(stub) {
		logger.info('########### example_cc0 Init ###########');
		const ret = stub.getFunctionAndParameters();

		let A, B;    // Entities
		let Aval, Bval; // Asset holdings
		const args = ret.params;

		if (args.length === 4) {
			A = args[0];
			B = args[2];

			Aval = parseInt(args[1]);
			if (isNaN(Aval)) {
				return shim.error('Expecting integer value for asset holding');
			}
			Bval = parseInt(args[3]);
			if (isNaN(Bval)) {
				return shim.error('Expecting integer value for asset holding');
			}

			logger.info(`Aval = ${Aval}, Bval = ${Bval}`);

			try {
				// Write the state to the ledger
				await stub.putState(A, Buffer.from(Aval.toString()));
				await stub.putState(B, Buffer.from(Bval.toString()));
				return shim.success();
			} catch (e) {
				return shim.error(e);
			}
		} else {
			return shim.error('init expects 4 args');
		}
	}

	async Invoke(stub) {
		logger.info('########### example_cc0 Invoke ###########');
		const ret = stub.getFunctionAndParameters();
		const fcn = ret.fcn;
		const args = ret.params;

		logger.info('-stub.getFunctionAndParameters(): ', JSON.stringify(ret));
		try {
			if (fcn === 'delete') {
				return this.delete(stub, args);
			}

			if (fcn === 'query') {
				return this.query(stub, args);
			}

			if (fcn === 'returnError') {
				return this.returnError(stub, args);
			}

			if (fcn === 'throwError') {
				return this.throwError(stub, args);
			}

			if (fcn === 'move') {
				return this.move(stub, args);
			}

			if (fcn === 'call') {
				return this.call(stub, args);
			}

			if (fcn === 'getTransient') {
				return this.getTransient(stub, args);
			}

			if (fcn === 'echo') {
				return this.echo(stub, args);
			}

			if (fcn === 'init') {
				return this.Init(stub); // Use this when you wish to manage the initialization
				// return shim.error('Chaincode has not been initialized correctly');
			}
		} catch (error) {
			return shim.error(error.toString());
		}

		logger.error(`Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: ${fcn}`);
		return shim.error(`Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: ${fcn}`);
	}

	async move(stub, args) {
		logger.info('########### example_cc0 move ###########');

		let Aval, Bval;


		if (args.length !== 3) {
			return shim.error('Incorrect number of arguments. Expecting 4, function followed by 2 names and 1 value');
		}

		const A = args[0];
		const B = args[1];

		try {
			const Avalbytes = await stub.getState(A);
			if (!Avalbytes) {
				return shim.error('Entity A not found');
			}
			Aval = Avalbytes.toString();
			Aval = parseInt(Aval);
		} catch (e) {
			return shim.error('Failed to get state A');
		}

		try {
			const Bvalbytes = await stub.getState(B);
			if (!Bvalbytes) {
				return shim.error('Entity B not found');
			}
			Bval = Bvalbytes.toString();
			Bval = parseInt(Bval);
		} catch (e) {
			return shim.error('Failed to get state B');
		}
		// Perform the execution
		const X = parseInt(args[2]);
		if (isNaN(X)) {
			return shim.error('Invalid transaction amount, expecting a integer value');
		}

		Aval = Aval - X;
		Bval = Bval + X;
		logger.info(`Aval = ${Aval}, Bval = ${Bval}`);
		// Write the state back to the ledger
		try {
			await stub.putState(A, Buffer.from(Aval.toString()));
			await stub.putState(B, Buffer.from(Bval.toString()));
			logger.info(' example_cc0 - move succeed');
			return shim.success(Buffer.from('move succeed'));
		} catch (e) {
			return shim.error(e);
		}

	}

	async delete(stub, args) {
		logger.info('########### example_cc0 delete ###########');

		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting 1');
		}

		const A = args[0];

		try {
			await stub.deleteState(A);
		} catch (e) {
			return shim.error('Failed to delete state');
		}

		return shim.success();
	}

	async query(stub, args) {
		logger.info('########### example_cc0 query ###########');

		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting name of the person to query');
		}

		const A = args[0];
		let Aval;
		// Get the state from the ledger
		try {
			const Avalbytes = await stub.getState(A);
			if (!Avalbytes) {
				return shim.error('Entity A not found');
			}
			Aval = Avalbytes.toString();
		} catch (e) {
			return shim.error('Failed to get state A');
		}

		const jsonResp = {
			Name: A,
			Amount: Aval
		};
		logger.info('Query Response:%s\n', JSON.stringify(jsonResp));

		return shim.success(Buffer.from(Aval.toString()));
	}

	async returnError(stub, args) {
		return shim.error(new Error(args[0] || 'returnError: chaincode error response'));
	}

	async throwError(stub, args) {
		throw new Error(args[0] || 'throwError: chaincode error thrown');
	}

	async call(stub, args) {
		logger.info('########### example_cc0 call ###########');

		if (args.length < 2) {
			return shim.error('Incorrect number of arguments. Expecting name of the chaincode and function to call');
		}

		const chaincode_name = args.shift().toString();

		logger.info('Calling chaincode:%s with function:%s  argument 1:%s \n', chaincode_name, args[0].toString(), parseInt(args[1]));

		let results = null;
		// call the other chaincode
		try {
			results = await stub.invokeChaincode(chaincode_name, args);
			logger.info(' example_cc0 - call succeeded %s', results);
		} catch (e) {
			logger.error('Failed to call chaincode ' + e);
		}

		if (results) {
			return shim.success(Buffer.from('Success'));
		}

		return shim.error('Failed to complete the call to ' + chaincode_name);
	}

	async getTransient(stub) {
		const transientMap = stub.getTransient();
		const result = {};
		transientMap.forEach((value, key) => {
			result[key] = value.toString('utf8');
		});
		const payload = Buffer.from(result);
		return shim.success(payload);
	}

	async echo(stub, args) {
		stub.setEvent('echo', Buffer.from('content'));
		if (args.length > 0) {
			return shim.success(Buffer.from(args[0]));
		} else {
			return shim.success();
		}
	}
};

shim.start(new Chaincode());
