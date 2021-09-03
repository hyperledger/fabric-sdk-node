/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'ServiceHandler';

const {getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

/**
 * @classdesc
 * This is an base class that represents an action on a fabric service.
 *
 * @class
 */
const ServiceHandler = class {

	/**
	 * Construct a ServiceHandler base object.
	 *
	 * @returns {ServiceHandler} The ServiceHandler instance.
	 */
	constructor() {
		logger.debug(`${TYPE}.constructor - start `);
	}

	/**
	 * implementing class must implement
	 */
	commit() {
		throw Error('"commit" method must be implemented');
	}

	/**
	 * implementing class must implement
	 */
	endorse() {
		throw Error('"endorse" method must be implemented');
	}

	/**
	 * implementing class must implement
	 */
	query() {
		throw Error('"query" method must be implemented');
	}

	/**
	 * implementing class must implement
	 */
	toString() {
		throw Error('"toString" method must be implemented');
	}
};

module.exports = ServiceHandler;
