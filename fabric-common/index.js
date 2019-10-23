/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const Config = require('./lib/Config');
const CryptoAlgorithms = require('./lib/CryptoAlgorithms');
const CryptoSuite = require('./lib/CryptoSuite');
const HashPrimitives = require('./lib/HashPrimitives');
const Identity = require('./lib/Identity');
const Key = require('./lib/Key');
const KeyValueStore = require('./lib/KeyValueStore');
const Signer = require('./lib/Signer');
const SigningIdentity = require('./lib/SigningIdentity');
const Utils = require('./lib/Utils');
const User = require('./lib/User');
const BaseClient = require('./lib/BaseClient');
const Client = require('./lib/Client');

const BlockDecoder = require('./lib/BlockDecoder');
const Channel = require('./lib/Channel');
const Commit = require('./lib/Commit');
const Committer = require('./lib/Committer');
const Discoverer = require('./lib/Discoverer');
const DiscoveryHandler = require('./lib/DiscoveryHandler');
const DiscoveryService = require('./lib/DiscoveryService');
const Endorsement = require('./lib/Endorsement');
const Endorser = require('./lib/Endorser');
const Endpoint = require('./lib/Endpoint');
const Eventer = require('./lib/Eventer');
const EventListener = require('./lib/EventListener');
const EventService = require('./lib/EventService');
const Hash = require('./lib/Hash');
const IdentityContext = require('./lib/IdentityContext');
const Proposal = require('./lib/Proposal');
const Query = require('./lib/Query');
const ServiceAction = require('./lib/ServiceAction');
const ServiceEndpoint = require('./lib/ServiceEndpoint');
const ServiceHandler = require('./lib/ServiceHandler');

module.exports = {
	Client,
	Config,
	CryptoAlgorithms,
	CryptoSuite,
	HashPrimitives,
	Identity,
	Key,
	KeyValueStore,
	Signer,
	SigningIdentity,
	Utils,
	User,
	BaseClient,
	BlockDecoder,
	Channel,
	Commit,
	Committer,
	Discoverer,
	DiscoveryHandler,
	DiscoveryService,
	Endorsement,
	Endorser,
	Endpoint,
	Eventer,
	EventListener,
	EventService,
	Hash,
	IdentityContext,
	Proposal,
	Query,
	ServiceAction,
	ServiceEndpoint,
	ServiceHandler
};
