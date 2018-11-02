/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const clientUtils = require('./client-utils.js');
const ProtoLoader = require('./ProtoLoader');
const Packager = require('./Packager.js');
const tar = require('tar-stream');
const utils = require('./utils.js');
const zlib = require('zlib');

const _ccProto = ProtoLoader.load(__dirname + '/protos/peer/chaincode.proto').protos;
const logger = utils.getLogger('package');

/**
 * A class representing a smart contract package.
 */
class Package {

	/**
	 * Find the list of file names in the specified chaincode deployment specification.
	 * @private
	 * @param {ChaincodeDeploymentSpec} chaincodeDeploymentSpec The chaincode deployment specification.
	 * @returns {string[]} The list of file names.
	 */
	static async _findFileNames(chaincodeDeploymentSpec) {
		const codePackage = chaincodeDeploymentSpec.getCodePackage().toBuffer();
		const gunzip = zlib.createGunzip();
		const extract = tar.extract();
		return new Promise((resolve) => {
			const fileNames = [];
			extract.on('entry', (header, stream, next) => {
				logger.debug('Package._findFileNames - found entry %s', header.name);
				fileNames.push(header.name);
				stream.on('end', () => {
					next();
				});
				stream.resume();
			});
			extract.on('finish', () => {
				resolve(fileNames.sort());
			});
			gunzip.pipe(extract);
			gunzip.end(codePackage);
		});
	}

	/**
	 * Validate that the specified smart contract name and version meet the rules specified
	 * by the LSCC (https://github.com/hyperledger/fabric/blob/master/core/scc/lscc/lscc.go).
	 * @param {string} name The name of the smart contract.
	 * @param {*} version The version of the smart contract.
	 */
	static _validateNameAndVersion(name, version) {
		if (!name) {
			throw new Error('Smart contract name not specified');
		} else if (!name.match(/^[a-zA-Z0-9]+([-_][a-zA-Z0-9]+)*$/)) {
			throw new Error(`Invalid smart contract name '${name}'. Smart contract names must only consist of alphanumerics, '_', and '-'`);
		} else if (!version) {
			throw new Error('Smart contract version not specified');
		} else if (!version.match(/^[A-Za-z0-9_.+-]+$/)) {
			throw new Error(`Invalid smart contract version '${version}'. Smart contract versions must only consist of alphanumerics, '_', '-', '+', and '.'`);
		}
	}

	/**
	 * Load a smart contract package from the specified buffer.
	 * @param {Buffer} buffer A buffer containing the serialized smart contract package.
	 * @returns {Package} The smart contract package.
	 */
	static async fromBuffer(buffer) {
		const chaincodeDeploymentSpec = _ccProto.ChaincodeDeploymentSpec.decode(buffer);
		const fileNames = await Package._findFileNames(chaincodeDeploymentSpec);
		return new Package(chaincodeDeploymentSpec, fileNames);
	}

	/**
	 * Create a new smart contract package from the specified directory.
	 * @param {Object} options The options for the packager.
	 * @param {string} options.name The name of the smart contract.
	 * @param {string} options.version The version of the smart contract.
	 * @param {string} options.path The directory containing the smart contract.
	 * @param {string} options.type The type of the smart contract, one of 'golang', 'car', 'node' or 'java'.
	 * @param {string} [options.metadataPath] The directory containing the metadata descriptors.
	 * @returns {Package} The smart contract package.
	 */
	static async fromDirectory({name, version, path, type, metadataPath}) {
		logger.debug('Package.fromDirectory - entry - %s, %s, %s, %s', name, version, path, type);
		Package._validateNameAndVersion(name, version);
		const codePackage = await Packager.package(path, type, false, metadataPath);
		logger.debug('Package.fromDirectory - code package is %s bytes', codePackage.length);
		const chaincodeSpec = {
			type: clientUtils.translateCCType(type),
			chaincode_id: {
				name,
				path,
				version
			}
		};
		logger.debug('Package.fromDirectory - built chaincode specification %s', JSON.stringify(chaincodeSpec));
		const chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(chaincodeSpec);
		chaincodeDeploymentSpec.setCodePackage(codePackage);
		const fileNames = await Package._findFileNames(chaincodeDeploymentSpec);
		return new Package(chaincodeDeploymentSpec, fileNames);
	}

	/**
	 * Constructor.
	 * @private
	 * @param {ChaincodeDeploymentSpec} chaincodeDeploymentSpec The chaincode deployment specification.
	 */
	constructor(chaincodeDeploymentSpec, fileNames) {
		this.chaincodeDeploymentSpec = chaincodeDeploymentSpec;
		this.fileNames = fileNames;
	}

	/**
	 * Get the name of the smart contract package.
	 * @returns {string} The name of the smart contract package.
	 */
	getName() {
		return this.chaincodeDeploymentSpec.getChaincodeSpec().getChaincodeId().getName();
	}

	/**
	 * Get the version of the smart contract package.
	 * @returns {string} The version of the smart contract package.
	 */
	getVersion() {
		return this.chaincodeDeploymentSpec.getChaincodeSpec().getChaincodeId().getVersion();
	}

	/**
	 * Get the type of the smart contract package.
	 * @returns {string} The type of the smart contract package, one of 'golang', 'car', 'node' or 'java'.
	 */
	getType() {
		return clientUtils.ccTypeToString(this.chaincodeDeploymentSpec.getChaincodeSpec().getType());
	}

	/**
	 * Get the list of file names in this smart contract package.
	 * @returns {string[]} The list of file names in this smart contract package.
	 */
	getFileNames() {
		return this.fileNames;
	}

	/**
	 * Save the smart contract package to a buffer.
	 * @returns {Buffer} A buffer containing the serialized smart contract package.
	 */
	async toBuffer() {
		return this.chaincodeDeploymentSpec.toBuffer();
	}

}

module.exports = Package;
