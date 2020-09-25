/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Network, NetworkImpl} from './network';
import * as NetworkConfig from './impl/ccp/networkconfig';
import {Identity} from './impl/wallet/identity';
import {Wallet} from './impl/wallet/wallet';
import {IdentityProvider} from './impl/wallet/identityprovider';
import {TxEventHandlerFactory} from './impl/event/transactioneventhandler';
import {QueryHandlerFactory} from './impl/query/queryhandler';
import {Client, IdentityContext} from 'fabric-common';
import * as EventStrategies from './impl/event/defaulteventhandlerstrategies';
import * as QueryStrategies from './impl/query/defaultqueryhandlerstrategies';
import * as IdentityProviderRegistry from './impl/wallet/identityproviderregistry';

import * as Logger from './logger';
import {X509Identity} from './impl/wallet/x509identity';

const logger = Logger.getLogger('Gateway');

export interface GatewayOptions {
	identity: string | Identity;
	wallet?: Wallet;
	identityProvider?: IdentityProvider;
	clientTlsIdentity?: string;
	tlsInfo?: {
		certificate: string;
		key: string;
	};
	discovery?: DiscoveryOptions;
	eventHandlerOptions?: DefaultEventHandlerOptions;
	queryHandlerOptions?: DefaultQueryHandlerOptions;
	'connection-options'?: any;
}

export interface ConnectedGatewayOptions extends GatewayOptions {
	discovery: DiscoveryOptions;
	eventHandlerOptions: DefaultEventHandlerOptions;
	queryHandlerOptions: DefaultQueryHandlerOptions;
}

export interface DiscoveryOptions {
	asLocalhost?: boolean;
	enabled?: boolean;
}

export interface DefaultEventHandlerOptions {
	commitTimeout?: number;
	endorseTimeout?: number;
	strategy?: TxEventHandlerFactory | null;
}

export interface DefaultQueryHandlerOptions {
	strategy?: QueryHandlerFactory;
	timeout?: number;
}

export function mergeOptions<B, E>(currentOptions: B, additionalOptions: E): B & E {
	const result = currentOptions as B & E;
	for (const prop in additionalOptions) {
		if (typeof additionalOptions[prop] === 'object' && additionalOptions[prop] !== null) {
			if (result[prop] === undefined) {
				(result as E)[prop] = additionalOptions[prop];
			} else {
				mergeOptions(result[prop], additionalOptions[prop]);
			}
		} else {
			(result as E)[prop] = additionalOptions[prop];
		}
	}
	return result;
}

/**
 * @interface GatewayOptions
 * @memberof module:fabric-network
 * @property {(string|module:fabric-network.Identity)} identity The identity used for all interactions on this Gateway
 * instance. This can be either:
 * <ul>
 *   <li>a label matching an identity within the supplied wallet.</li>
 *   <li>an identity object.</li>
 * </ul
 * @property {module:fabric-network.Wallet} [wallet] The identity wallet implementation for use with this Gateway
 * instance. Required if a label is specified as the <code>identity</code>, or <code>clientTlsIdentity</code> is specified.
 * @property {module:fabric-network.IdentityProvider} [identityProvider] An identity provider for the supplied identity
 * object. Required if an identity object is not one of the default supported types.
 * @property {string} [clientTlsIdentity] The identity within the wallet to use as the client TLS identity.
 * @property {object} [tlsInfo] Credentials to use as the client TLS identity.
 * @property {string} tlsInfo.certificate Certificate PEM.
 * @property {string} tlsInfo.key Private key PEM.
 * @property {module:fabric-network.DefaultEventHandlerOptions} [eventHandlerOptions]
 * Options for event handling when submitting transactions.
 * @property {module:fabric-network.DefaultQueryHandlerOptions} [queryHandlerOptions]
 * Options for query handling when evaluating transactions.
 * @property {module:fabric-network.DiscoveryOptions} [discovery] Discovery options.
 */

/**
 * @interface DefaultEventHandlerOptions
 * @memberof module:fabric-network
 * @property {number} [commitTimeout = 300] The timeout period in seconds to wait
 * for commit notification to complete.
 * @property {number} [endorseTimeout = 30] The timeout period in seconds to wait
 * for the endorsement to complete.
 * @property {?module:fabric-network.TxEventHandlerFactory} [strategy=MSPID_SCOPE_ALLFORTX]
 * Event handling strategy to identify successful transaction commits. A <code>null</code> value indicates that no
 * event handling is desired. The default is
 * [MSPID_SCOPE_ALLFORTX]{@link module:fabric-network.DefaultEventHandlerStrategies}.
 */

/**
 * @interface DefaultQueryHandlerOptions
 * @memberof module:fabric-network
 * @property {number} [timeout = 30] The timeout period in seconds to wait for the query to
 * complete.
 * @property {module:fabric-network.QueryHandlerFactory} [strategy=MSPID_SCOPE_SINGLE]
 * Query handling strategy used to evaluate queries. The default is
 * [MSPID_SCOPE_SINGLE]{@link module:fabric-network.DefaultQueryHandlerStrategies}.
 */

/**
 * @interface DiscoveryOptions
 * @memberof module:fabric-network
 * @property {boolean} [enabled=true] True if discovery should be used; otherwise false.
 * @property {boolean} [asLocalhost=false] Convert discovered host addresses to be 'localhost'.
 * Will be needed when running a docker composed fabric network on the local system;
 * otherwise should be disabled.
 */

/**
 * Factory function to obtain transaction event handler instances. Called on every transaction submit.
 * @typedef {function} TxEventHandlerFactory
 * @memberof module:fabric-network
 * @param {string} transactionId The ID of the transaction being submitted.
 * @param {module:fabric-network.Network} network The network on which this transaction is being submitted.
 * @returns {module:fabric-network.TxEventHandler} A transaction event handler.
 * @see module:fabric-network.DefaultEventHandlerStrategies
 */

/**
 * Handler used to wait for commit events when a transaction is submitted.
 * @interface TxEventHandler
 * @memberof module:fabric-network
 */
/**
 * Resolves when the handler has started listening for transaction commit events. Called after the transaction proposal
 * has been accepted and prior to submission of the transaction to the orderer.
 * @function module:fabric-network.TxEventHandler#startListening
 * @async
 * @returns {Promise<void>}
 */
/**
 * Resolves (or rejects) when suitable transaction commit events have been received. Called after submission of the
 * transaction to the orderer.
 * @function module:fabric-network.TxEventHandler#waitForEvents
 * @async
 * @returns {Promise<void>}
 */
/**
 * Called if submission of the transaction to the orderer fails.
 * @function module:fabric-network.TxEventHandler#cancelListening
 * @returns {void}
 */

/**
 * Factory function to obtain query handler instances. Called on every network creation.
 * @typedef {Function} QueryHandlerFactory
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network} network The network on which queries are being evaluated.
 * @returns {module:fabric-network.QueryHandler} A query handler.
 * @see module:fabric-network.DefaultQueryHandlerStrategies
 */

/**
 * Handler used to obtain query results from peers when a transaction is evaluated.
 * @interface QueryHandler
 * @memberof module:fabric-network
 */
/**
 * Called when a transaction is evaluated to obtain query results from suitable network peers.
 * @function module:fabric-network.QueryHandler#evaluate
 * @async
 * @param {module:fabric-network.Query} query Query object that can be used by the handler to send the query to
 * specific peers.
 * @returns {Promise<Buffer>}
 */

/**
 * Used by query handler implementations to evaluate transactions on peers of their choosing.
 * @interface Query
 * @memberof module:fabric-network
 */
/**
 * Get query results from specified peers.
 * @function module:fabric-network.Query#evaluate
 * @async
 * @param {Endorser[]} peers
 * @returns {Promise<Array<module:fabric-network.Query~QueryResponse | Error>>}
 */

/**
 * @typedef {Object} Query~QueryResponse
 * @memberof module:fabric-network
 * @property {boolean} isEndorsed True if the proposal was endorsed by the peer.
 * @property {number} status The status value from the endorsement. This attribute will be set by the chaincode.
 * @property {Buffer} payload The payload value from the endorsement. This attribute may be considered the query value
 * if the proposal was endorsed by the peer.
 * @property {string} message The message value from the endorsement. This property contains the error message from
 * the peer if it did not endorse the proposal.
 */

/**
 * The gateway peer provides the connection point for an application to access the Fabric network.
 * It is instantiated using the default constructor.
 * It can then be connected to a fabric network using the [connect]{@link #connect} method by
 * passing either a common connection profile definition or an existing {@link Client} object.
 * Once connected, it can then access individual Network instances (channels) using the
 * [getNetwork]{@link #getNetwork} method which in turn can access the
 * [smart contracts]{@link Contract} installed on a network and
 * [submit transactions]{@link Contract#submitTransaction} to the ledger.
 * @memberof module:fabric-network
 */
export class Gateway {
	identityContext?: IdentityContext;
	private client?: Client;
	private readonly networks = new Map<string, NetworkImpl>();
	private identity?: Identity;
	private options?: ConnectedGatewayOptions;

	constructor() {
		logger.debug('in Gateway constructor');
	}

	/**
	 * Connect to the Gateway with a connection profile or a prebuilt Client instance.
	 * @async
	 * @param {(object|Client)} config The configuration for this Gateway which can be:
	 * <ul>
	 *   <li>A common connection profile JSON (Object)</li>
	 *   <li>A pre-configured client instance</li>
	 * </ul>
	 * @param {module:fabric-network.GatewayOptions} options - specific options
	 * for creating this Gateway instance
	 * @example
	 * const gateway = new Gateway();
	 * const wallet = await Wallets.newFileSystemWallet('./WALLETS/wallet');
	 * const connectionProfileJson = (await fs.promises.readFile('network.json')).toString();
	 * const connectionProfile = JSON.parse(connectionProfileJson);
	 * await gateway.connect(connectionProfile, {
	 *     identity: 'admin',
	 *     wallet: wallet
	 * });
	 */
	async connect(config: Client | object, options: GatewayOptions) {
		const method = 'connect';
		logger.debug('%s - start', method);

		const defaultOptions = {
			queryHandlerOptions: {
				timeout: 30, // 30 seconds
				strategy: QueryStrategies.PREFER_MSPID_SCOPE_SINGLE
			},
			eventHandlerOptions: {
				endorseTimeout: 30, // 30 seconds
				commitTimeout: 300, // 5 minutes
				strategy: EventStrategies.PREFER_MSPID_SCOPE_ALLFORTX
			},
			discovery: {
				enabled: true,
				asLocalhost: true
			}
		};

		this.options = mergeOptions(defaultOptions, options);
		logger.debug('connection options: %j', options);

		let loadCcp = false;
		if (config instanceof Client) {
			// initialize from an existing Client object instance
			logger.debug('%s - using existing client object', method);
			this.client = config;
		} else if (typeof config === 'object') {
			this.client = new Client('gateway client');
			loadCcp = true;
		} else {
			throw new Error('Configuration must be a connection profile object or Client object');
		}

		// setup an initial identity for the Gateway
		if (typeof options.identity === 'string') {
			logger.debug('%s - setting identity from wallet', method);
			this.identity = await this._getWalletIdentity(options.identity);
			const provider = options.wallet!.getProviderRegistry().getProvider(this.identity.type);
			const user = await provider.getUserContext(this.identity, options.identity);
			this.identityContext = this.client.newIdentityContext(user);
		} else if (typeof options.identity === 'object') {
			logger.debug('%s - setting identity using identity object', method);
			this.identity = options.identity;
			const provider = options.identityProvider || IdentityProviderRegistry.newDefaultProviderRegistry().getProvider(this.identity.type);
			const user = await provider.getUserContext(this.identity, 'gateway identity');
			this.identityContext = this.client.newIdentityContext(user);
		} else {
			logger.error('%s - An identity must be assigned to a Gateway instance', method);
			throw new Error('An identity must be assigned to a Gateway instance');
		}

		if (options.clientTlsIdentity) {
			logger.debug('%s - setting tlsIdentity', method);
			const tlsIdentity = await this._getWalletIdentity(options.clientTlsIdentity);
			if (tlsIdentity.type !== 'X.509') {
				throw new Error('Unsupported TLS identity type: ' + tlsIdentity.type);
			}
			const tlsCredentials = (tlsIdentity as X509Identity).credentials;
			this.client.setTlsClientCertAndKey(tlsCredentials.certificate, tlsCredentials.privateKey);
		} else if (options.tlsInfo) {
			logger.debug('%s - setting tlsInfo', method);
			this.client.setTlsClientCertAndKey(options.tlsInfo.certificate, options.tlsInfo.key);
		} else {
			logger.debug('%s - using self signed setting for tls', method);
			this.client.setTlsClientCertAndKey();
		}

		// apply any connection options to the client instance for use
		// internally by the client instance when building a complete set
		// of connection options for an endpoint
		// these will be merged with those from the config (default.json)
		if (options['connection-options']) {
			(this.client as any).centralized_options = options['connection-options'];
			logger.debug('%s - assigned connection options');
		}

		// Load connection profile after client configuration has been completed
		if (loadCcp) {
			logger.debug('%s - NetworkConfig loading client from ccp', method);
			await NetworkConfig.loadFromConfig(this.client, config);
		}

		logger.debug('%s - end', method);
	}

	/**
	 * Get the identity associated with the gateway connection.
	 * @returns {module:fabric-network.Identity} An identity.
	 */
	getIdentity(): Identity {
		if (!this.identity) {
			throw new Error('Gateway is not connected');
		}
		return this.identity;
	}

	/**
	 * Returns the set of options associated with the Gateway connection
	 * @returns {module:fabric-network.Gateway~GatewayOptions} The Gateway connection options
	 */
	getOptions(): ConnectedGatewayOptions {
		if (!this.options) {
			throw new Error('Gateway is not connected');
		}
		return this.options;
	}

	/**
	 * Clean up and disconnect this Gateway connection in preparation for it to be discarded and garbage collected
	 */
	disconnect(): void {
		logger.debug('in disconnect');
		this.networks.forEach((network) => network._dispose());
		this.networks.clear();
		if (this.client) {
			this.client.close();
		}
	}

	/**
	 * Returns an object representing a network
	 * @param {string} networkName The name of the network (channel name)
	 * @returns {module:fabric-network.Network}
	 */
	async getNetwork(networkName: string): Promise<Network> {
		const method = 'getNetwork';
		logger.debug('%s - start', method);

		if (!this.client || !this.options) {
			throw new Error('Gateway is not connected');
		}

		const existingNetwork = this.networks.get(networkName);
		if (existingNetwork) {
			logger.debug('%s - returning existing network:%s', method, networkName);
			return existingNetwork;
		}

		logger.debug('%s - create network object and initialize', method);
		const channel = this.client.getChannel(networkName);
		const newNetwork = new NetworkImpl(this, channel);
		await newNetwork._initialize(this.options.discovery);
		this.networks.set(networkName, newNetwork);
		return newNetwork;
	}

	private async _getWalletIdentity(label: string): Promise<Identity> {
		if (!this.options?.wallet) {
			throw new Error('No wallet supplied from which to retrieve identity label');
		}

		const identity = await this.options.wallet.get(label);
		if (!identity) {
			throw new Error(`Identity not found in wallet: ${label}`);
		}

		return identity;
	}
}
