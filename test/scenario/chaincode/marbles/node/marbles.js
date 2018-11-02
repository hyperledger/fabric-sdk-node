/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

'use strict';
const shim = require('fabric-shim');
const util = require('util');

/**
 * Marble asset management chaincode written in node.js, implementing {@link ChaincodeInterface}.
 * @type {SimpleChaincode}
 * @extends {ChaincodeInterface}
 */
const Chaincode = class {

	/**
     * Called during chaincode instantiate and upgrade. This method can be used
     * to initialize asset states.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub is implemented by the fabric-shim
     * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform. The stub
     * encapsulates the APIs between the chaincode implementation and the Fabric peer.
     * @return {Promise<SuccessResponse>} Returns a promise of a response indicating the result of the invocation.
     */
	async Init(stub) {
		const ret = stub.getFunctionAndParameters();
		console.info(ret);
		console.info('=========== Instantiated Marbles Chaincode ===========');
		return shim.success();
	}

	/**
     * Called throughout the life time of the chaincode to carry out business
     * transaction logic and effect the asset states.
     * The provided functions are the following: initMarble, delete, transferMarble, readMarble, getMarblesByRange,
     * transferMarblesBasedOnColor, queryMarblesByOwner, queryMarbles, getHistoryForMarble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub is implemented by the fabric-shim
     * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform. The stub
     * encapsulates the APIs between the chaincode implementation and the Fabric peer.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
	async Invoke(stub) {
		console.info('Transaction ID: ' + stub.getTxID());
		console.info(util.format('Args: %j', stub.getArgs()));

		const ret = stub.getFunctionAndParameters();
		const fcn = ret.fcn;
		const args = ret.params;

		if (fcn === 'initMarble') {
			return this.initMarble(stub, args, this);
		}

		if (fcn === 'readMarble') {
			return this.readMarble(stub, args, this);
		}

		if (fcn === 'delete') {
			return this.delete(stub, args, this);
		}

		if (fcn === 'transferMarble') {
			return this.transferMarble(stub, args, this);
		}

		if (fcn === 'getMarblesByRange') {
			return this.delete(stub, args, this);
		}

		if (fcn === 'transferMarblesBasedOnColor') {
			return this.transferMarblesBasedOnColor(stub, args, this);
		}

		if (fcn === 'queryMarblesByOwner') {
			return this.queryMarblesByOwner(stub, args, this);
		}

		if (fcn === 'queryMarbles') {
			return this.queryMarbles(stub, args, this);
		}

		if (fcn === 'getAllResults') {
			return this.getAllResults(stub, args, this);
		}

		if (fcn === 'getHistoryForMarble') {
			return this.getHistoryForMarble(stub, args, this);
		}

		console.log(`Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: ${fcn}`);
		return shim.error(`Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: ${fcn}`);
	}

	/**
     * Creates a new marble with the given attributes.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name. Index 1: marble color.
     * Index 2: marble size. Index 3: marble owner.
     * @return {Promise<String>} notification of success of failure.
     */
	async initMarble(stub, args) {
		if (args.length !== 4) {
			return shim.error('Incorrect number of arguments. Expecting 4');
		}
		// ==== Input sanitation ====
		console.info('--- start init marble ---');
		if (args[0].length <= 0) {
			return shim.error('1st argument must be a non-empty string');
		}
		if (args[1].length <= 0) {
			return shim.error('2nd argument must be a non-empty string');
		}
		if (args[2].length <= 0) {
			return shim.error('3rd argument must be a non-empty string');
		}
		if (args[3].length <= 0) {
			return shim.error('4th argument must be a non-empty string');
		}
		const marbleName = args[0];
		const color = args[1].toLowerCase();
		const owner = args[3].toLowerCase();
		const size = parseInt(args[2]);
		if (isNaN(size)) {
			return shim.error('3rd argument must be a numeric string');
		}

		// ==== Check if marble already exists ====
		const marbleState = await stub.getState(marbleName);
		if (marbleState.toString()) {
			return shim.error('This marble already exists: ' + marbleName);
		}

		// ==== Create marble object and marshal to JSON ====
		const marble = {};
		marble.docType = 'marble';
		marble.name = marbleName;
		marble.color = color;
		marble.size = size;
		marble.owner = owner;

		// === Save marble to state ===
		await stub.putState(marbleName, Buffer.from(JSON.stringify(marble)));
		const indexName = 'color~name';
		const colorNameIndexKey = await stub.createCompositeKey(indexName, [marble.color, marble.name]);
		console.info(colorNameIndexKey);
		//  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of the marble.
		//  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
		await stub.putState(colorNameIndexKey, Buffer.from('\u0000'));
		// ==== Marble saved and indexed. Return success ====
		console.info('- end init marble');
		return shim.success('init marble success');
	}

	/**
     * Retrieves the information about a marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     * @return {Promise<Object[]>} The byte representation of the marble.
     */
	async readMarble(stub, args) {
		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting name of the marble to query');
		}

		const name = args[0];
		if (!name) {
			return shim.error(' marble name must not be empty');
		}
		const marbleAsBytes = await stub.getState(name); // get the marble from chaincode state
		if (!marbleAsBytes.toString()) {
			const jsonResp = {};
			jsonResp.Error = 'Marble does not exist: ' + name;
			return shim.error(JSON.stringify(jsonResp));
		}
		console.info('=======================================');
		console.log(marbleAsBytes.toString());
		console.info('=======================================');
		return shim.success(marbleAsBytes);
	}

	/**
     * Deletes the given marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     * @returns {success|error} shim.success or shim.error
     */
	async delete(stub, args) {
		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting name of the marble to delete');
		}
		const marbleName = args[0];
		if (!marbleName) {
			return shim.error('marble name must not be empty');
		}
		// to maintain the color~name index, we need to read the marble first and get its color
		const valAsBytes = await stub.getState(marbleName); // get the marble from chaincode state
		let jsonResp = {};
		if (!valAsBytes) {
			jsonResp.error = 'marble does not exist: ' + marbleName;
			return shim.error(jsonResp);
		}
		let marbleJSON = {};
		try {
			marbleJSON = JSON.parse(valAsBytes.toString());
		} catch (err) {
			jsonResp = {};
			jsonResp.error = 'Failed to decode JSON of: ' + marbleName;
			return shim.error(jsonResp);
		}

		await stub.deleteState(marbleName); // remove the marble from chaincode state

		// delete the index
		const indexName = 'color~name';
		const colorNameIndexKey = stub.createCompositeKey(indexName, [marbleJSON.color, marbleJSON.name]);
		if (!colorNameIndexKey) {
			return shim.error(' Failed to create the createCompositeKey');
		}
		//  Delete index entry to state.
		await stub.deleteState(colorNameIndexKey);
		return shim.success('delete success');
	}

	// ===========================================================
	// transfer a marble by setting a new owner name on the marble
	// ===========================================================

	/**
     * Transfers the given marble to a new owner.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name. Index 1: the new owner.
     * @returns {success|error} shim.success or shim.error
     */
	async transferMarble(stub, args) {
		if (args.length !== 2) {
			return shim.error('Incorrect number of arguments. Expecting marble name and owner');
		}

		const marbleName = args[0];
		const newOwner = args[1].toLowerCase();
		console.info('- start transferMarble ', marbleName, newOwner);

		const marbleAsBytes = await stub.getState(marbleName);
		if (!marbleAsBytes || !marbleAsBytes.toString()) {
			return shim.error('marble does not exist');
		}
		let marbleToTransfer = {};
		try {
			marbleToTransfer = JSON.parse(marbleAsBytes.toString()); // unmarshal
		} catch (err) {
			const jsonResp = {};
			jsonResp.error = 'Failed to decode JSON of: ' + marbleName;
			return shim.error(jsonResp);
		}
		console.info(marbleToTransfer);
		marbleToTransfer.owner = newOwner; // change the owner

		const marbleJSONasBytes = Buffer.from(JSON.stringify(marbleToTransfer));
		await stub.putState(marbleName, marbleJSONasBytes); // rewrite the marble

		console.info('- end transferMarble (success)');
		return shim.success('transferMarble success');
	}

	/**
     * Performs a range query based on the start and end keys provided.
     *
     * Read-only function results are not typically submitted to ordering. If the read-only
     * results are submitted to ordering, or if the query is used in an update transaction
     * and submitted to ordering, then the committing peers will re-execute to guarantee that
     * result sets are stable between endorsement time and commit time. The transaction is
     * invalidated by the committing peers if the result set has changed between endorsement
     * time and commit time.
     * Therefore, range queries are a safe option for performing update transactions based on query results.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: start key. Index 1: end key.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The marbles in the given range.
     */
	async getMarblesByRange(stub, args, thisObject) {

		if (args.length !== 2) {
			return shim.error('Incorrect number of arguments. Expecting 2');
		}

		const startKey = args[0];
		const endKey = args[1];

		const resultsIterator = await stub.getStateByRange(startKey, endKey);
		const results = await thisObject.getAllResults(resultsIterator, false);

		return shim.success(Buffer.from(JSON.stringify(results)));
	}

	/**
     * Transfers marbles of a given color to a certain new owner.
     *
     * Uses a GetStateByPartialCompositeKey (range query) against color~name 'index'.
     * Committing peers will re-execute range queries to guarantee that result sets are stable
     * between endorsement time and commit time. The transaction is invalidated by the
     * committing peers if the result set has changed between endorsement time and commit time.
     * Therefore, range queries are a safe option for performing update transactions based on query results.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble color. Index 1: new owner.
     * @param {Chaincode} thisObject The chaincode object context.
     * @returns {success|error} shim.success or shim.error
     */
	async transferMarblesBasedOnColor(stub, args, thisObject) {
		if (args.length !== 2) {
			return shim.error('Incorrect number of arguments. Expecting color and owner');
		}

		const color = args[0];
		const newOwner = args[1].toLowerCase();
		console.info('- start transferMarblesBasedOnColor ', color, newOwner);

		// Query the color~name index by color
		// This will execute a key range query on all keys starting with 'color'
		const coloredMarbleResultsIterator = await stub.getStateByPartialCompositeKey('color~name', [color]);

		let hasNext = true;
		// Iterate through result set and for each marble found, transfer to newOwner
		while (hasNext) {
			let responseRange;
			try {
				responseRange = await coloredMarbleResultsIterator.next();
			} catch (err) {
				hasNext = false;
				continue;
			}

			if (!responseRange || !responseRange.value || !responseRange.value.key) {
				return;
			}
			console.log(responseRange.value.key);

			const splitKey = await stub.splitCompositeKey(responseRange.value.key);
			const objectType = splitKey.objectType;
			const attributes = splitKey.attributes;

			const returnedColor = attributes[0];
			const returnedMarbleName = attributes[1];
			console.info(util.format('- found a marble from index:%s color:%s name:%s\n', objectType, returnedColor, returnedMarbleName));

			// Now call the transfer function for the found marble.
			// Re-use the same function that is used to transfer individual marbles
			await thisObject.transferMarble(stub, [returnedMarbleName, newOwner]);
		}

		const responsePayload = util.format('Transferred %s marbles to %s', color, newOwner);
		console.info('- end transferMarblesBasedOnColor: ' + responsePayload);
		return shim.success('- end transferMarblesBasedOnColor: ' + responsePayload);
	}

	/**
     * Queries for marbles based on a passed in owner.
     * This is an example of a parameterized query where the query logic is baked into the chaincode,
     * and accepting a single query parameter (owner).
     * Only available on state databases that support rich query (e.g. CouchDB)
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble owner.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The marbles of the specified owner.
     */
	async queryMarblesByOwner(stub, args, thisObject) {
		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting owner name.');
		}

		const owner = args[0].toLowerCase();
		const queryString = {};
		queryString.selector = {};
		queryString.selector.docType = 'marble';
		queryString.selector.owner = owner;
		const queryResults = await thisObject.getQueryResultForQueryString(stub, JSON.stringify(queryString), thisObject);
		return shim.success(queryResults);
	}

	/**
     * Uses a query string to perform a query for marbles.
     * Query string matching state database syntax is passed in and executed as is.
     * Supports ad hoc queries that can be defined at runtime by the client.
     * If this is not desired, follow the queryMarblesForOwner example for parameterized queries.
     * Only available on state databases that support rich query (e.g. CouchDB)
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: query string.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The results of the specified query.
     */
	async queryMarbles(stub, args, thisObject) {
		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting queryString');
		}
		const queryString = args[0];
		if (!queryString) {
			return shim.error('queryString must not be empty');
		}

		const queryResults = await thisObject.getQueryResultForQueryString(stub, queryString, thisObject);
		return shim.success(queryResults);
	}

	/**
     * Gets the results of a specified iterator.
     * @async
     * @param {Object} iterator The iterator to use.
     * @param {Boolean} isHistory Specifies whether the iterator returns history entries or not.
     * @return {Promise<Object[]>} The array of results in JSON format.
     */
	async getAllResults(iterator, isHistory) {
		const allResults = [];
		let hasNext = true;
		while (hasNext) {
			let res;
			try {
				res = await iterator.next();
			} catch (err) {
				hasNext = false;
				continue;
			}

			if (res.value && res.value.value.toString()) {
				const jsonRes = {};
				console.log(res.value.value.toString('utf8'));

				if (isHistory && isHistory === true) {
					jsonRes.TxId = res.value.tx_id;
					jsonRes.Timestamp = res.value.timestamp;
					jsonRes.IsDelete = res.value.is_delete.toString();
					try {
						jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
					} catch (err) {
						console.log(err);
						jsonRes.Value = res.value.value.toString('utf8');
					}
				} else {
					jsonRes.Key = res.value.key;
					try {
						jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
					} catch (err) {
						console.log(err);
						jsonRes.Record = res.value.value.toString('utf8');
					}
				}
				allResults.push(jsonRes);
			}
			if (res.done) {
				console.log('end of data');
				await iterator.close();
				console.info(allResults);
				return allResults;
			}
		}
	}

	/**
     * Executes the provided query string.
     * Result set is built and returned as a byte array containing the JSON results.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String} queryString The query string to execute.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The results of the specified query.
     */
	async getQueryResultForQueryString(stub, queryString, thisObject) {

		console.info('- getQueryResultForQueryString queryString:\n' + queryString);
		const resultsIterator = await stub.getQueryResult(queryString);

		const results = await thisObject.getAllResults(resultsIterator, false);

		return Buffer.from(JSON.stringify(results));
	}

	/**
     * Retrieves the history for a marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The history entries of the specified marble.
     */
	async getHistoryForMarble(stub, args, thisObject) {

		if (args.length !== 1) {
			return shim.error('Incorrect number of arguments. Expecting 1');
		}
		const marbleName = args[0];
		console.info('- start getHistoryForMarble: %s\n', marbleName);

		const resultsIterator = await stub.getHistoryForKey(marbleName);
		const results = await thisObject.getAllResults(resultsIterator, true);

		return shim.success(Buffer.from(JSON.stringify(results)));
	}
};

shim.start(new Chaincode());
