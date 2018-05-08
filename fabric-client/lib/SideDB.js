/*
 Copyright 2018 Zhao Chaoyi, All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const grpc = require('grpc');
const fs = require('fs');
const Policy = require('./Policy.js');
const _collectionProto = grpc.load(__dirname + '/protos/common/collection.proto').common;

const utils = require('./utils.js');
const logger = utils.getLogger('SideDB.js');
const { format } = require('util');

class CollectionConfig {
	static buildCollectionConfigPackage(collectionsConfig) {
		/**
		 * collectionsConfig can be either:
		 *   - A string represents the collections-config.json file path
		 *   - An array of collectionConfig
		 */
		try {
			let content = collectionsConfig;
			if (typeof collectionsConfig === 'string') {
				logger.debug('Read CollectionsConfig From %s', collectionsConfig);
				content = fs.readFileSync(collectionsConfig, 'utf8');
				content = JSON.parse(content);
			}
			if (!Array.isArray(content)) {
				logger.error('Expect collections config of type Array, found %s', typeof content);
				throw new Error('Expect collections config of type Array');
			}
			let collectionConfigPackage = [];
			content.forEach(config => {
				const collectionConfig = buildCollectionConfig(config);
				collectionConfigPackage.push(collectionConfig);
			});
			collectionConfigPackage = new _collectionProto.CollectionConfigPackage(collectionConfigPackage);

			return collectionConfigPackage;
		} catch (e) {
			logger.error(e);
			throw e;
		}
	}
}
function checkCollectionConfig(collectionConfig) {
	const {
		name,
		policy,
		maxPeerCount,
		requiredPeerCount
	} = collectionConfig;
	if (!name || typeof name !== 'string') {
		throw new Error(format('CollectionConfig Requires Param "name" of type string, found %j(type: %s)', name, typeof name));
	}
	if (!policy) {
		throw new Error('Missing Requires Param "policy"');
	}
	Policy.checkPolicy(policy);
	if (!Number.isInteger(maxPeerCount)) {
		throw new Error(format('CollectionConfig Requires Param "maxPeerCount" of type number, found %j(type: %s)', maxPeerCount, typeof maxPeerCount));
	}
	if (!Number.isInteger(requiredPeerCount)) {
		throw new Error(format('CollectionConfig Requires Param "requiredPeerCount" of type number, found %j(type: %s)', requiredPeerCount, typeof requiredPeerCount));
	}
}

function buildCollectionConfig(collectionConfig) {
	try {
		checkCollectionConfig(collectionConfig);

		const {
			name,
			policy,
			maxPeerCount,
			requiredPeerCount
		} = collectionConfig;

		let static_collection_config = {
			name,
			member_orgs_policy: {},
			required_peer_count: requiredPeerCount,
			maximum_peer_count: maxPeerCount
		};

		let principals = [];
		policy.identities.forEach((identity) => {
			let newPrincipal = Policy.buildPrincipal(identity);
			principals.push(newPrincipal);
		});

		let signaturePolicy = Policy.buildSignaturePolicy(policy.policy);

		let signaturePolicyEnvelope = {
			version: 0,
			rule: signaturePolicy,
			identities: principals
		};

		static_collection_config.member_orgs_policy.signature_policy = signaturePolicyEnvelope;

		return { static_collection_config };
	} catch (e) {
		logger.error(e);
		throw e;
	}
}

module.exports = {
	CollectionConfig,
	checkCollectionConfig
};
