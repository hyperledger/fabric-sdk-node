/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contract } from './contract';
import { Gateway } from './gateway';
import { Channel, DiscoveryService, Endorser } from 'fabric-common';
import { BlockListener, CommitListener, EventType, ListenerOptions } from './events';
import { BlockEventSource } from './impl/event/blockeventsource';
import { CommitListenerSession } from './impl/event/commitlistenersession';
import { EventServiceManager } from './impl/event/eventservicemanager';
import { IsolatedBlockListenerSession } from './impl/event/isolatedblocklistenersession';
import { checkpointBlockListener } from './impl/event/listeners';
import { addListener, ListenerSession, removeListener } from './impl/event/listenersession';
import { SharedBlockListenerSession } from './impl/event/sharedblocklistenersession';
import { QueryHandler } from './impl/query/queryhandler';
import * as Logger from './logger';

const logger = Logger.getLogger('Network');

async function listenerOptionsWithDefaults(options: ListenerOptions): Promise<ListenerOptions> {
	const defaultOptions = {
		type: 'full'
	};
	const result = Object.assign(defaultOptions, options);

	const checkpointBlock = await options.checkpointer?.getBlockNumber();
	if (checkpointBlock) {
		result.startBlock = checkpointBlock;
	}

	return result;
}

export interface Network {
	getGateway(): Gateway;
	getContract(chaincodeId: string, name?: string): Contract;
	getChannel(): Channel;
	addCommitListener(listener: CommitListener, peers: Endorser[], transactionId: string): Promise<CommitListener>;
	removeCommitListener(listener: CommitListener): void;
	addBlockListener(listener: BlockListener, options?: ListenerOptions): Promise<BlockListener>;
	removeBlockListener(listener: BlockListener): void;
}

export class NetworkImpl implements Network {
	public queryHandler?: QueryHandler;
	private readonly gateway: Gateway;
	private readonly channel: Channel;
	private readonly contracts = new Map<string, Contract>();
	private initialized = false;
	private discoveryService?: DiscoveryService;
	private eventServiceManager: EventServiceManager;
	private readonly commitListeners = new Map<CommitListener, ListenerSession>();
	private readonly blockListeners = new Map<BlockListener, ListenerSession>();
	private readonly realtimeFilteredBlockEventSource: BlockEventSource;
	private readonly realtimeFullBlockEventSource: BlockEventSource;
	private readonly realtimePrivateBlockEventSource: BlockEventSource;

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
		this.realtimeFilteredBlockEventSource = new BlockEventSource(this.eventServiceManager, { type: 'filtered' });
		this.realtimeFullBlockEventSource = new BlockEventSource(this.eventServiceManager, { type: 'full' });
		this.realtimePrivateBlockEventSource = new BlockEventSource(this.eventServiceManager, { type: 'private' });
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
		const queryOptions = this.gateway.getOptions().queryHandlerOptions;
		this.queryHandler = queryOptions!.strategy!(this);
		logger.debug('%s - end', method);
	}

	getGateway() {
		return this.gateway;
	}

	getContract(chaincodeId: string, name = '') {
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
				name
			);
			logger.debug('%s - create new contract %s', method, chaincodeId);
			this.contracts.set(key, contract);
		}
		return contract;
	}

	getChannel() {
		return this.channel;
	}

	getDiscoveryService() {
		return this.discoveryService;
	}

	_dispose() {
		const method = '_dispose';
		logger.debug('%s - start', method);

		this.contracts.clear();

		this.commitListeners.forEach((listener) => listener.close());
		this.commitListeners.clear();

		this.blockListeners.forEach((listener) => listener.close());
		this.blockListeners.clear();

		this.realtimeFilteredBlockEventSource.close();
		this.realtimeFullBlockEventSource.close();
		this.realtimePrivateBlockEventSource.close();
		this.eventServiceManager.close();
		this.channel.close();

		this.initialized = false;
	}

	async addCommitListener(listener: CommitListener, peers: Endorser[], transactionId: string) {
		const sessionSupplier = async () => new CommitListenerSession(listener, this.eventServiceManager, peers, transactionId);
		return await addListener(listener, this.commitListeners, sessionSupplier);
	}

	removeCommitListener(listener: CommitListener) {
		removeListener(listener, this.commitListeners);
	}

	async addBlockListener(listener: BlockListener, options = {} as ListenerOptions) {
		const sessionSupplier = async () => await this.newBlockListenerSession(listener, options);
		return await addListener(listener, this.blockListeners, sessionSupplier);
	}

	removeBlockListener(listener: BlockListener) {
		removeListener(listener, this.blockListeners);
	}

	private async newBlockListenerSession(listener: BlockListener, options: ListenerOptions): Promise<ListenerSession> {
		options = await listenerOptionsWithDefaults(options);

		if (options.checkpointer) {
			listener = checkpointBlockListener(listener, options.checkpointer);
		}

		if (options.startBlock) {
			return this.newIsolatedBlockListenerSession(listener, options);
		} else {
			return this.newSharedBlockListenerSession(listener, options.type);
		}
	}

	private newIsolatedBlockListenerSession(listener: BlockListener, options: ListenerOptions) {
		const blockSource = new BlockEventSource(this.eventServiceManager, options);
		return new IsolatedBlockListenerSession(listener, blockSource);
	}

	private newSharedBlockListenerSession(listener: BlockListener, type?: EventType) {
		if (type === 'filtered') {
			return new SharedBlockListenerSession(listener, this.realtimeFilteredBlockEventSource);
		} else if (type === 'full') {
			return new SharedBlockListenerSession(listener, this.realtimeFullBlockEventSource);
		} else if (type === 'private') {
			return new SharedBlockListenerSession(listener, this.realtimePrivateBlockEventSource);
		} else {
			throw new Error('Unsupported event listener type: ' + type);
		}
	}
}
