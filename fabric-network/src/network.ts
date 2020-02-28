/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore no implicit any
import Contract = require('./contract');
import { EventServiceManager } from './impl/event/eventservicemanager';
import { ListenerSession } from './impl/event/listenersession';
import { addListener, removeListener } from './impl/event/listenersession';
import { CommitListener } from './impl/event/commitlistener';
import { CommitListenerSession } from './impl/event/commitlistenersession';
import { QueryHandlerFactory } from './impl/query/queryhandler';
import { BlockListener } from './impl/event/blocklistener';
import { SharedBlockListenerSession } from './impl/event/sharedblocklistenersession';
import { IsolatedBlockListenerSession } from './impl/event/isolatedblocklistenersession';
import { BlockEventSource } from './impl/event/blockeventsource';
// @ts-ignore no implicit any
import Gateway = require('./gateway');
// @ts-ignore no implicit any
import BaseEventListener = require('./impl/event/baseeventlistener');

import { Channel, DiscoveryService, Endorser } from 'fabric-common';

import Long = require('long');

import * as Logger from './logger';
const logger = Logger.getLogger('Network');

/**
 * @typedef {Object} Network~EventListenerOptions
 * @private
 * @memberof module:fabric-network
 * @property {Object} checkpointer - a checkpointer instance
 * @property {boolean} [replay=false] - event replay on listener
 * @property {boolean} [filtered=true] - used to receive filtered block events or not
 * @property {boolean} [privateData=false] - when receiving full blocks (filtered=false)
 * include this user's private data, will be ignored when receiving filtered blocks and
 * will only include private data this user is allowed to see
 * @property {boolean} [unregister] - unregisters the listener after first event is received
 * @property {number} [startBlock] - the first block to play events
 * @property {number} [endBlock] - the final block to play events
 * @property {string} [transactionId] - the transactionId to monitor for commit
 * events. Only used for transaction commit events and will be ignored for other
 * event types. The default is to call the application commit event listener on
 * every transaction committed to the ledger.
 */

export interface Network {
	getGateway(): Gateway;
	getContract(chaincodeId: string, name?: string, collections?: string[]): Contract;
	getChannel(): Channel;
	addCommitListener(listener: CommitListener, peers: Endorser[], transactionId: string): Promise<CommitListener>;
	removeCommitListener(listener: CommitListener): void;
	addBlockListener(listener: BlockListener, options?: ListenerOptions): Promise<BlockListener>;
	removeBlockListener(listener: BlockListener): void;
}

export interface ListenerOptions {
	startBlock?: number | string | Long;
}

export class NetworkImpl implements Network {
	public queryHandler?: QueryHandlerFactory;
	private readonly gateway: Gateway;
	private readonly channel: Channel;
	private readonly contracts = new Map<string, Contract>();
	private initialized = false;
	private discoveryService?: DiscoveryService;
	private eventServiceManager: EventServiceManager;
	private readonly commitListeners = new Map<CommitListener, ListenerSession>();
	private readonly blockListeners = new Map<BlockListener, ListenerSession>();
	private readonly oldListeners = new Set<BaseEventListener>();
	private readonly realtimeBlockEventSource: BlockEventSource;

	/*
	 * Network constructor for internal use only.
	 * @param {Gateway} gateway The owning gateway instance
	 * @param {Channel} channel The fabric-base channel instance
	 */
	constructor(gateway: Gateway, channel: Channel) {
		const method = 'constructor';
		logger.debug('%s - start', method);

		this.gateway = gateway;
		this.channel = channel;
		this.eventServiceManager = new EventServiceManager(this);
		this.realtimeBlockEventSource = new BlockEventSource(this.eventServiceManager);
	}

	/**
	 * initialize the channel if it hasn't been done
	 * @private
	 */
	async _initializeInternalChannel(options: any) { // TODO: fix types
		const method = '_initializeInternalChannel';
		logger.debug('%s - start', method);

		if (options.enabled) {
			logger.debug('%s - initialize with discovery', method);
			let targets: Endorser[];
			if (options.targets) {
				if (Array.isArray(options.targets) && options.targets.length > 0) {
					for (const target of options.targets) {
						if (!target.connected) {
							throw Error(`Endorser instance ${target.name} is not connected to an endpoint`);
						}
					}
				} else {
					throw Error('No discovery targets found');
				}
				targets = options.targets;
				logger.debug('%s - user has specified discovery targets', method);
			} else {
				logger.debug('%s - user has not specified discovery targets, check channel and client', method);

				// maybe the channel has connected endorsers with the mspid
				const mspId = this.gateway.getIdentity().mspId;
				targets = this.channel.getEndorsers(mspId);
				if (!targets || targets.length < 1) {
					// then check the client for connected peers associated with the mspid
					targets = this.channel.client.getEndorsers(mspId);
				}
				if (!targets || targets.length < 1) {
					// get any peer
					targets = this.channel.client.getEndorsers();
				}

				if (!targets || targets.length < 1) {
					throw Error('No discovery targets found');
				} else {
					logger.debug('%s - using channel/client targets', method);
				}
			}

			// should have targets by now, create the discoverers from the endorsers
			const discoverers = [];
			for (const peer of targets) {
				const discoverer = this.channel.client.newDiscoverer(peer.name, peer.mspid);
				await discoverer.connect(peer.endpoint);
				discoverers.push(discoverer);
			}
			this.discoveryService = this.channel.newDiscoveryService(this.channel.name);
			const idx = this.gateway.identityContext;

			// do the three steps
			this.discoveryService.build(idx);
			this.discoveryService.sign(idx);
			logger.debug('%s - will discover asLocalhost:%s', method, options.asLocalhost);
			await this.discoveryService.send({
				asLocalhost: options.asLocalhost,
				targets: discoverers
			});

			// now we can work with the discovery results
			// or get a handler later from the discoverService
			// to be used on endorsement, queries, and commits
			logger.debug('%s - discovery complete - channel is populated', method);
		}

		logger.debug('%s - end', method);
	}

	/**
	 * Initialize this network instance
	 * @private
	 */
	async _initialize(discover: any) { // TODO: fix types
		const method = '_initialize';
		logger.debug('%s - start', method);

		if (this.initialized) {
			return;
		}

		await this._initializeInternalChannel(discover);

		this.initialized = true;

		// Must be created after channel initialization to ensure discovery has located the peers
		const queryOptions = this.gateway.getOptions().query;
		this.queryHandler = queryOptions.strategy(this, queryOptions);
		logger.debug('%s - end', method);
	}

	getGateway() {
		return this.gateway;
	}

	getContract(chaincodeId: string, name = '', collections?: string[]) {
		const method = 'getContract';
		logger.debug('%s - start - name %s', method, name);

		if (!this.initialized) {
			throw new Error('Unable to get contract as this network has failed to initialize');
		}
		const key = `${chaincodeId}:${name}`;
		let contract = this.contracts.get(key);
		if (!contract) {
			contract = 	new Contract(
				this,
				chaincodeId,
				name,
				collections
			);
			this.contracts.set(key, contract);
		}
		return contract;
	}

	getChannel() {
		return this.channel;
	}

	_dispose() {
		const method = '_dispose';
		logger.debug('%s - start', method);

		this.contracts.clear();

		this.oldListeners.forEach((listener) => listener.unregister());
		this.oldListeners.clear();

		this.commitListeners.forEach((listener) => listener.close());
		this.commitListeners.clear();

		this.blockListeners.forEach((listener) => listener.close());
		this.blockListeners.clear();

		this.realtimeBlockEventSource.close();
		this.eventServiceManager.close();
		this.channel.close();

		this.initialized = false;
	}

	async addCommitListener(listener: CommitListener, peers: Endorser[], transactionId: string) {
		const sessionSupplier = () => new CommitListenerSession(listener, this.eventServiceManager, peers, transactionId);
		return await addListener(listener, this.commitListeners, sessionSupplier);
	}

	removeCommitListener(listener: CommitListener) {
		removeListener(listener, this.commitListeners);
	}

	async addBlockListener(listener: BlockListener, options = {} as ListenerOptions) {
		const sessionSupplier = () => this.newBlockListenerSession(listener, options);
		return await addListener(listener, this.blockListeners, sessionSupplier);
	}

	removeBlockListener(listener: BlockListener) {
		removeListener(listener, this.blockListeners);
	}

	saveListener(listener: BaseEventListener) {
		this.oldListeners.add(listener);
	}

	private newBlockListenerSession(listener: BlockListener, options: ListenerOptions) {
		if (options.startBlock) {
			const blockSource = new BlockEventSource(this.eventServiceManager, Long.fromValue(options.startBlock));
			return new IsolatedBlockListenerSession(listener, blockSource);
		} else {
			return new SharedBlockListenerSession(listener, this.realtimeBlockEventSource);
		}
	}
}
