/**
 * Copyright 2017 Kapil Sachdeva All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import * as ByteBuffer from 'bytebuffer';
import FabricCAServices = require('fabric-ca-client');
import * as Long from 'long';
import { BaseClient } from './base';

interface ProtoBufObject {
	toBuffer(): Buffer;
}

declare class Remote {
	constructor(url: string, opts?: Client.ConnectionOpts);
	public getName(): string;
	public setName(name: string): void;
	public getUrl(): string;
}

declare class Client extends BaseClient {
	public static loadFromConfig(config: any): Client;

	constructor();
	public loadFromConfig(config: any): void;
	public setTlsClientCertAndKey(clientCert: string, clientKey: string): void;
	public addTlsClientCertAndKey(opts: any): void;
	public isDevMode(): boolean;
	public setDevMode(mode: boolean): void;
	public newChannel(name: string): Client.Channel;
	public getChannel(name?: string, throwError?: boolean): Client.Channel;
	public newPeer(url: string, opts?: Client.ConnectionOpts): Client.Peer;
	public getPeer(name: string): Client.Peer;
	public getPeersForOrg(mspid?: string): Client.Peer[];
	public newOrderer(url: string, opts?: Client.ConnectionOpts): Client.Orderer;
	public getOrderer(name: string): Client.Orderer;
	public getPeersForOrgOnChannel(channelNames: string | string[]): Client.ChannelPeer[];
	public getCertificateAuthority(): FabricCAServices;
	public getClientConfig(): any;
	public getMspid(): string;
	public newTransactionID(admin?: boolean): Client.TransactionId;
	public extractChannelConfig(configEnvelope: Buffer): Buffer;
	public signChannelConfig(config: Buffer): Client.ConfigSignature;
	public createChannel(request: Client.ChannelRequest): Promise<Client.BroadcastResponse>;
	public updateChannel(request: Client.ChannelRequest): Promise<Client.BroadcastResponse>;
	public queryPeers(request: Client.PeerQueryRequest): Promise<Client.PeerQueryResponse>;
	public queryChannels(peer: Client.Peer | string, useAdmin?: boolean): Promise<Client.ChannelQueryResponse>;
	public queryInstalledChaincodes(peer: Client.Peer | string, useAdmin?: boolean): Promise<Client.ChaincodeQueryResponse>;
	public installChaincode(request: Client.ChaincodeInstallRequest, timeout?: number): Promise<Client.ProposalResponseObject>;
	public initCredentialStores(): Promise<boolean>;
	public setStateStore(store: Client.IKeyValueStore): void;
	public setAdminSigningIdentity(privateKey: string, certificate: string, mspid: string): void;
	public saveUserToStateStore(): Promise<Client.User>;
	public setUserContext(user: Client.User | Client.UserContext, skipPersistence?: boolean): Promise<Client.User>;
	public getUserContext(name: string, checkPersistence?: boolean): Promise<Client.User> | Client.User;
	public loadUserFromStateStore(name: string): Promise<Client.User>;
	public getStateStore(): Client.IKeyValueStore;
	public createUser(opts: Client.UserOpts): Promise<Client.User>;

	public getTargetPeers(requestTargets: string | string[] | Client.Peer | Client.Peer[]): Client.Peer[];
	public getTargetOrderer(requestOrderer?: string | Client.Orderer, channelOrderers?: Client.Orderer[], channelName?: string): Client.Orderer;
	public getClientCertHash(create: boolean): Buffer;
}

export = Client;

declare namespace Client { // tslint:disable-line:no-namespace
	export enum Status {
		UNKNOWN = 0,
		SUCCESS = 200,
		BAD_REQUEST = 400,
		FORBIDDEN = 403,
		NOT_FOUND = 404,
		REQUEST_ENTITY_TOO_LARGE = 413,
		INTERNAL_SERVER_ERROR = 500,
		SERVICE_UNAVAILABLE = 503,
	}

	export type ChaincodeType = 'golang' | 'car' | 'java' | 'node';
	export interface ICryptoKey {
		getSKI(): string;
		isSymmetric(): boolean;
		isPrivate(): boolean;
		getPublicKey(): ICryptoKey;
		toBytes(): string;
	}

	export interface ICryptoKeyStore {
		getKey(ski: string): Promise<string>;
		putKey(key: ICryptoKey): Promise<ICryptoKey>;
	}

	export interface ICryptoSuite {
		decrypt(key: ICryptoKey, cipherText: Buffer, opts: any): Buffer;
		deriveKey(key: ICryptoKey, opts?: KeyOpts): ICryptoKey;
		encrypt(key: ICryptoKey, plainText: Buffer, opts: any): Buffer;
		getKey(ski: string): Promise<ICryptoKey>;
		generateKey(opts?: KeyOpts): Promise<ICryptoKey>;
		hash(msg: string, opts: any): string;
		importKey(pem: string, opts?: KeyOpts): ICryptoKey | Promise<ICryptoKey>;
		setCryptoKeyStore(cryptoKeyStore: ICryptoKeyStore): void;
		sign(key: ICryptoKey, digest: Buffer): Buffer;
		verify(key: ICryptoKey, signature: Buffer, digest: Buffer): boolean;
	}

	export interface CryptoSetting {
		algorithm: string;
		hash: string;
		keysize: number;
		software: boolean;
	}

	export interface UserConfig {
		affiliation?: string;
		enrollmentID: string;
		name: string;
		roles?: string[];
	}

	export interface ConnectionOpts {
		pem?: string;
		clientKey?: string;
		clientCert?: string;
		'request-timeout'?: number;
		'ssl-target-name-override'?: string;
		[propName: string]: any;
	}

	export class User {
		public static isInstance(object: any): boolean;

		constructor(cfg: string | UserConfig);
		public getName(): string;
		public getRoles(): string[];
		public setRoles(roles: string[]): void;
		public getAffiliation(): string;
		public setAffiliation(affiliation: string): void;
		public getIdentity(): IIdentity;
		public getSigningIdentity(): ISigningIdentity;
		public getCryptoSuite(): ICryptoSuite;
		public setCryptoSuite(suite: ICryptoSuite): void;
		public setEnrollment(privateKey: ICryptoKey, certificate: string, mspId: string): Promise<void>;
		public isEnrolled(): boolean;
		public fromString(): Promise<User>;
	}

	export interface InitializeRequest {
		target?: string | Peer | ChannelPeer;
		discover?: boolean;
		endorsementHandler?: string;
		commitHandler?: string;
		asLocalhost?: boolean;
		configUpdate?: Buffer;
	}

	export class Channel {
		public static sendSignedProposal(request: SignedProposal, timeout?: number): Promise<ProposalResponseObject>;

		constructor(name: string, clientContext: Client);
		public close(): void;
		public initialize(request?: InitializeRequest): Promise<void>;
		public getName(): string;

		public getDiscoveryResults(endorsementHints?: DiscoveryChaincodeInterest[]): Promise<DiscoveryResults>;
		public getEndorsementPlan(endorsementHint?: DiscoveryChaincodeInterest): Promise<DiscoveryResultEndorsementPlan>;
		public refresh(): Promise<DiscoveryResults>;

		public getOrganizations(): string[];

		public setMSPManager(mspManager: MSPManager): void;
		public getMSPManager(): MSPManager;

		public addPeer(peer: Peer, mspid: string, roles?: ChannelPeerRoles, replace?: boolean): void;
		public removePeer(peer: Peer): void;
		public getPeer(name: string): ChannelPeer;
		public getChannelPeer(name: string): ChannelPeer;
		public getPeers(): ChannelPeer[];
		public getChannelPeers(): ChannelPeer[];

		public addOrderer(orderer: Orderer, replace?: boolean): void;
		public removeOrderer(orderer: Orderer): void;
		public getOrderer(name: string): Orderer;
		public getOrderers(): Orderer[];
		public newChannelEventHub(peer: Peer | string): ChannelEventHub;
		public getChannelEventHub(name: string): ChannelEventHub;
		public getChannelEventHubsForOrg(mspid?: string): ChannelEventHub[];
		public getPeersForOrg(mspid?: string): ChannelPeer[];
		public getGenesisBlock(request?: OrdererRequest): Promise<Block>;

		public joinChannel(request: JoinChannelRequest, timeout?: number): Promise<ProposalResponse[]>;
		public getChannelConfig(target?: string | Peer, timeout?: number): Promise<any>;
		public getChannelCapabilities(configEnvelope: any): string[];
		public getChannelConfigFromOrderer(): Promise<any>;
		public loadConfigUpdate(configUpdateBytes: Buffer): any;
		public loadConfigEnvelope(configEnvelope: any): any;

		public queryInfo(target?: Peer | string, useAdmin?: boolean): Promise<BlockchainInfo>;
		public queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
		public queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
		public queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
		public queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
		public queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
		public queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
		public queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<any>;
		public queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;

		public queryInstantiatedChaincodes(target: Peer | string, useAdmin?: boolean): Promise<ChaincodeQueryResponse>;
		public queryCollectionsConfig(options: CollectionQueryOptions, useAdmin?: boolean): Promise<CollectionQueryResponse[]>;

		public sendInstantiateProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
		public sendUpgradeProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
		public sendTransactionProposal(request: ChaincodeInvokeRequest, timeout?: number): Promise<ProposalResponseObject>;
		public sendTransaction(request: TransactionRequest, timeout?: number): Promise<BroadcastResponse>;

		public generateUnsignedProposal(request: ProposalRequest, mspId: string, certificate: string, admin: boolean): Promise<Proposal>;
		public sendSignedProposal(request: SignedProposal, timeout?: number): Promise<ProposalResponseObject>;
		public generateUnsignedTransaction(request: TransactionRequest): Promise<any>;
		public sendSignedTransaction(request: SignedCommitProposal, timeout?: number): Promise<BroadcastResponse>;

		public queryByChaincode(request: ChaincodeQueryRequest, useAdmin?: boolean): Promise<Buffer[]>;
		public verifyProposalResponse(proposalResponse: ProposalResponse): boolean;
		public compareProposalResponseResults(proposalResponses: ProposalResponse[]): boolean;
	}

	export interface ChannelPeerRoles {
		endorsingPeer?: boolean;
		chaincodeQuery?: boolean;
		ledgerQuery?: boolean;
		eventSource?: boolean;
		discover?: boolean;
	}

	export class ChannelPeer {
		constructor(mspid: string, channel: Channel, peer: Peer, roles: ChannelPeerRoles);

		public close(): void;

		public getMspid(): string;
		public getName(): string;
		public getUrl(): string;
		public setRole(role: string, isIn: boolean): void;
		public isInRole(role: string): boolean;
		public isInOrg(mspid: string): boolean;
		public getChannelEventHub(): ChannelEventHub;
		public getPeer(): Peer;
		public sendProposal(proposal: Proposal, timeout?: number): Promise<ProposalResponse>;
		public sendDiscovery(request: SignedRequest, timeout?: number): Promise<DiscoveryResults>;
	}

	export interface IKeyValueStore {
		getValue(name: string): Promise<string>;
		setValue(name: string, value: string): Promise<string>;
	}

	export interface ConfigSignature extends ProtoBufObject {
		signature_header: Buffer;
		signature: Buffer;
	}

	export class TransactionId {
		constructor(signerOrUserContext: IIdentity, admin: boolean);
		public getTransactionID(): string;
		public getNonce(): Buffer;
		public isAdmin(): boolean;
	}

	export interface ChannelRequest {
		name: string;
		orderer: Orderer | string;
		envelope?: Buffer;
		config?: Buffer;
		txId?: TransactionId;
		signatures: ConfigSignature[] | string[];
	}

	export interface TransactionRequest {
		proposalResponses: ProposalResponse[];
		proposal: Proposal;
		txId?: TransactionId;
		orderer?: string | Orderer;
	}

	export interface BroadcastResponse {
		status: string;
		info?: string;
	}

	export interface ProposalErrorResponse extends Error {
		isProposalResponse?: boolean;
	}

	export type ProposalResponseObject = [Array<Client.ProposalResponse | Client.ProposalErrorResponse>, Client.Proposal];

	export interface OrdererRequest {
		txId?: TransactionId;
		orderer?: string | Orderer;
	}

	export interface JoinChannelRequest {
		txId: TransactionId;
		targets?: Peer[] | string[];
		block: Block;
	}

	export interface BlockData {
		signature: Buffer;
		payload: { header: any, data: any };
	}

	export interface BlockchainInfo {
		height: any;
		currentBlockHash: Buffer;
		previousBlockHash: Buffer;
	}

	export interface Block {
		header: {
			number: string;
			previous_hash: Buffer;
			data_hash: Buffer;
		};
		data: { data: BlockData[] };
		metadata: { metadata: any };
	}

	export interface FilteredBlock {
		channel_id: string;
		number: string;
		filtered_transactions: FilteredTransaction[];
	}

	export interface FilteredTransaction {
		Data: string;
		txid: string;
		type: string;
		transaction_actions: any[];
	}

	export interface ProposalResponse {
		version: number;
		timestamp: Date;
		response: Response;
		payload: Buffer;
		endorsement: any;
		peer: RemoteCharacteristics;
	}

	export interface RemoteCharacteristics {
		url: string;
		name: string;
		options: object;
	}

	export interface SignedEvent {
		signature: Buffer;
		payload: Buffer;
	}

	export interface ConnectOptions {
		full_block?: boolean;
		startBlock?: number | string;
		endBlock?: number | string;
		signedEvent?: SignedEvent;
		target?: Peer | string;
		as_array?: boolean;
	}

	export interface EventHubRegistrationRequest {
		identity: IIdentity;
		TransactionID: TransactionId;
		certificate: string;
		mspId: string;
	}

	export class ChannelEventHub {
		constructor(channel: Channel, peer: Peer);
		public getName(): string;
		public getPeerAddr(): string;
		public lastBlockNumber(): number;
		public isconnected(): boolean;
		public connect(options?: ConnectOptions | boolean, connectCallback?: (err: Error, channelEventHub: ChannelEventHub) => void): void;
		public reconnect(options?: ConnectOptions, connectCallback?: (err: Error, channelEventHub: ChannelEventHub) => void): void;
		public disconnect(): void;
		public close(): void;

		public generateUnsignedRegistration(options: EventHubRegistrationRequest): Buffer;

		public checkConnection(forceReconnect: boolean): string;
		public registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent, blockNumber?: string, txId?: string, txStatus?: string) => void, onError?: (err: Error) => void, options?: RegistrationOpts): ChaincodeChannelEventHandle;
		public unregisterChaincodeEvent(handle: ChaincodeChannelEventHandle, throwError?: boolean): void;
		public registerBlockEvent(onEvent: (block: Block | FilteredBlock) => void, onError?: (err: Error) => void, options?: RegistrationOpts): number;
		public unregisterBlockEvent(blockRegistrationNumber: number, throwError: boolean): void;
		public registerTxEvent(txId: string, onEvent: (txId: string, code: string, blockNumber: string) => void, onError?: (err: Error) => void, options?: RegistrationOpts): string;
		public unregisterTxEvent(txId: string, throwError?: boolean): void;
	}

	// Dummy interface for opaque handles for registerChaincodeEvent's
	export interface ChaincodeChannelEventHandle { // tslint:disable-line:no-empty-interface
	}

	export interface SignedRequest {
		payload: Buffer;
		signature: Buffer;
	}

	export interface PeerSignedProposal {
		proposal_bytes: Buffer;
		signature: Buffer;
	}

	export class Peer extends Remote {
		constructor(url: string, opts?: ConnectionOpts);
		public close(): void;
		public sendProposal(proposal: PeerSignedProposal, timeout?: number): Promise<ProposalResponse>;
		public sendDiscovery(request: SignedRequest, timeout?: number): Promise<DiscoveryResults>;
	}

	export class Orderer extends Remote {
		constructor(url: string, opts?: ConnectionOpts);
		public close(): void;
		public sendBroadcast(envelope: Buffer): Promise<BroadcastResponse>;
		public sendDeliver(envelope: Buffer): Promise<any>;
	}

	export interface MSPConstructorConfig {
		rootCerts: IIdentity[];
		intermediateCerts: IIdentity[];
		admins: IIdentity[];
		signer: ISigningIdentity;
		id: string;
		orgs: string[];
		cryptoSuite: Client.ICryptoSuite;
	}

	export class MSP {
		constructor(config: MSPConstructorConfig);
		public deserializeIdentity(serializedIdentity: Buffer, storeKey: boolean): IIdentity | Promise<IIdentity>;
		public getDefaultSigningIdentity(): ISigningIdentity;
		public getId(): string;
		public getOrganizationUnits(): string[];
		public getPolicy(): any;
		public getSigningIdentity(identifier: string): ISigningIdentity;
		public toProtoBuf(): any;
		public validate(id: IIdentity): boolean;
	}

	export class MSPManager {
		constructor();
		public addMSP(config: any): MSP;
		public deserializeIdentity(serializedIdentity: Buffer): IIdentity;
		public getMSP(): MSP;
		public getMSPs(): any;
		public loadMSPs(mspConfigs: any): void;
	}

	export interface MSPPrincipal {
		principal_classification: number;
		principal: Buffer;
	}

	export interface ChaincodePackageInstallRequest {
		targets?: Peer[] | string[];
		channelNames?: string[] | string;
		txId?: TransactionId;
		chaincodePackage: Buffer;
	}

	export interface ChaincodePathInstallRequest {
		targets?: Peer[] | string[];
		channelNames?: string[] | string;
		txId?: TransactionId;
		chaincodeId: string;
		chaincodeVersion: string;
		chaincodePath: string;
		chaincodeType?: ChaincodeType;
		metadataPath?: string;
	}

	export type ChaincodeInstallRequest = ChaincodePackageInstallRequest | ChaincodePathInstallRequest;

	export interface CollectionConfig {
		name: string;
		policy: {
			identities: any[];
			policy: any;
		};
		requiredPeerCount: number;
		maxPeerCount: number;
		blockToLive?: number;
		memberOnlyRead?: boolean;
	}

	export type CollectionsConfig = CollectionConfig[];

	export interface EndorsementPolicy {
		identities: any[];
		policy: any;
	}
	export interface ChaincodeInstantiateUpgradeRequest {
		targets?: Peer[] | string[];
		chaincodeType?: ChaincodeType;
		chaincodeId: string;
		chaincodeVersion: string;
		txId: TransactionId;
		'collections-config'?: string | CollectionsConfig;
		transientMap?: TransientMap;
		fcn?: string;
		args?: string[];
		'endorsement-policy'?: EndorsementPolicy;
	}

	export interface ChaincodeInvokeRequest {
		targets?: Peer[] | string[];
		chaincodeId: string;
		endorsement_hint?: DiscoveryChaincodeInterest;
		txId: TransactionId;
		transientMap?: TransientMap;
		fcn?: string;
		args: string[];
		ignore?: string[];
		preferred?: string[];
	}

	export interface ChaincodeQueryRequest {
		targets?: Peer[] | string[];
		chaincodeId: string;
		transientMap?: TransientMap;
		fcn?: string;
		args: string[];
		txId?: TransactionId;
	}

	export interface KeyOpts {
		ephemeral: boolean;
	}

	export interface CryptoContent {
		privateKey?: string;
		privateKeyPEM?: string;
		privateKeyObj?: Client.ICryptoKey;
		signedCert?: string;
		signedCertPEM?: string;
	}

	export interface UserContext {
		username: string;
		password?: string;
	}

	export interface UserOpts {
		username: string;
		mspid: string;
		cryptoContent: CryptoContent;
		skipPersistence: boolean;
	}

	export interface IIdentity {
		serialize(): Buffer;
		getMSPId(): string;
		isValid(): boolean;
		getOrganizationUnits(): string;
		verify(msg: Buffer, signature: Buffer, opts: any): boolean;
	}

	export interface ISigningIdentity {
		sign(msg: Buffer, opts: any): Buffer;
	}

	export interface ChaincodeInfo {
		name: string;
		version: string;
		path: string;
		input: string;
		escc: string;
		vscc: string;
	}

	export interface ChannelInfo {
		channel_id: string;
	}

	export interface PeerQueryRequest {
		target: Peer | string;
		useAdmin?: boolean;
	}

	export interface PeerQueryResponse {
		peers_by_org: {
			[mspId: string]: {
				'peers': Array<{
					'mspid': string,
					'endpoint': string,
				}>;
			},
		};
	}

	export interface ChaincodeQueryResponse {
		chaincodes: ChaincodeInfo[];
	}

	export interface ChannelQueryResponse {
		channels: ChannelInfo[];
	}

	export interface CollectionQueryOptions {
		target?: Peer | string;
		chaincodeId: string;
	}

	export interface CollectionQueryResponse {
		type: string;
		name: string;
		policy: {
			identities: MSPPrincipal[];
			n_out_of: any;
		};
		required_peer_count: number;
		maximum_peer_count: number;
		block_to_live: number;
		member_only_read: boolean;
	}

	export interface Response {
		status: Client.Status;
		message: string;
		payload: Buffer;
	}

	export interface Proposal {
		header: ByteBuffer;
		payload: ByteBuffer;
		extension: ByteBuffer;
	}

	export interface Header {
		channel_header: ByteBuffer;
		signature_header: ByteBuffer;
	}

	export interface TransientMap {
		[key: string]: Buffer;
	}

	export interface ProposalRequest {
		fcn: string;
		args: string[];
		chaincodeId: string;
		argbytes?: Buffer;
		transientMap?: TransientMap;
	}

	export interface SignedProposal {
		targets: Peer[];
		signedProposal: Buffer;
	}

	export interface SignedCommitProposal {
		request: TransactionRequest;
		signedTransaction: Buffer;
		orderer?: Orderer | string;
	}

	export interface RegistrationOpts {
		startBlock?: number;
		endBlock?: number | 'newest';
		unregister?: boolean;
		disconnect?: boolean;
	}

	export interface ChaincodeEvent {
		chaincode_id: string;
		tx_id: string;
		event_name: string;
		payload: Buffer;
	}

	export interface DiscoveryRequest {
		target?: string | Peer;
		chaincodes?: string[];
		endpoint_names?: boolean;
		initialize_msps?: boolean;
		config?: boolean;
		local?: boolean;
	}

	export interface DiscoveryResultMSPConfig {
		rootCerts: string;
		intermediateCerts: string;
		admins: string;
		id: string;
		orgs: string[];
		tls_root_certs: string;
		tls_intermediate_certs: string;
	}

	export interface DiscoveryResultEndpoint {
		host: string;
		port: number;
		name?: string;
	}
	export interface DiscoveryResultEndpoints {
		endpoints: DiscoveryResultEndpoint[];
	}

	export interface DiscoveryResultChaincode {
		name: string;
		version: string;
	}

	export interface DiscoveryResultPeer {
		mspid: string;
		endpoint: string;
		ledger_height: Long;
		name: string;
		chaincodes: DiscoveryResultChaincode[];
	}
	export interface DiscoveryResultPeers {
		peers: DiscoveryResultPeer[];
	}

	export interface DiscoveryResultEndorsementGroup {
		peers: DiscoveryResultPeer[];
	}
	export interface DiscoveryResultEndorsementLayout {
		[groupName: string]: number;
	}

	export interface DiscoveryResultEndorsementPlan {
		chaincode: string;
		plan_id: string;
		groups: {
			[groupName: string]: DiscoveryResultEndorsementGroup;
		};
		layouts: DiscoveryResultEndorsementLayout[];
	}

	export interface DiscoveryResults {
		msps?: { [mspid: string]: DiscoveryResultMSPConfig };
		orderers?: { [mspid: string]: DiscoveryResultEndpoints };

		peers_by_org?: { [name: string]: DiscoveryResultPeers };

		endorsement_plans: DiscoveryResultEndorsementPlan[];

		timestamp: number;
	}

	export interface DiscoveryChaincodeCall {
		name: string;
		collection_names?: string[];
	}

	export interface DiscoveryChaincodeInterest {
		chaincodes: DiscoveryChaincodeCall[];
	}

	export class Package {
		public static fromBuffer(buffer: Buffer): Promise<Package>;
		public static fromDirectory(options: { name: string, version: string, path: string, type: ChaincodeType, metadataPath?: string }): Promise<Package>;
		public getName(): string;
		public getVersion(): string;
		public getType(): ChaincodeType;
		public getFileNames(): string[];
		public toBuffer(): Promise<Buffer>;
	}
}
