/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import Long = require('long');
import * as fabproto6 from 'fabric-protos';
import winston = require('winston');

export interface IKeyValueStore {
	getValue(name: string): Promise<string>;
	setValue(name: string, value: string): Promise<string>;
}

export class Utils {
	public static getLogger(name: string): winston.LoggerInstance;
	public static newCryptoSuite(options?: CryptoSetting): ICryptoSuite;
	public static normalizeX509(pem: string): string;
	public static newCryptoKeyStore(keyValueStore?: IKeyValueStore): ICryptoKeyStore;
}
export interface ICryptoKey {
	getSKI(): string;
	getHandle(): string;
	isSymmetric(): boolean;
	isPrivate(): boolean;
	getPublicKey(): ICryptoKey;
	toBytes(): string;
}

export class Pkcs11EcdsaKey implements ICryptoKey {
	constructor(keyAttr: any, keySize: number);
	getSKI(): string;
	getHandle(): string;
	isSymmetric(): boolean;
	isPrivate(): boolean;
	getPublicKey(): ICryptoKey;
	toBytes(): string;
}

export interface EDSAKeyAttr {
	ski?: Buffer;
	ecpt?: Buffer;
	pub?: Buffer;
	priv?: Buffer;
}

export interface ICryptoKeyStore {
	getKey(ski: string): Promise<string>;
	putKey(key: ICryptoKey): Promise<ICryptoKey>;
}

export interface ICryptoSuite {
	createKeyFromRaw(pem: string): ICryptoKey;
	decrypt(key: ICryptoKey, cipherText: Buffer, opts: any): Buffer;
	deriveKey(key: ICryptoKey, opts?: KeyOpts): ICryptoKey;
	encrypt(key: ICryptoKey, plainText: Buffer, opts: any): Buffer;
	getKey(ski: string): Promise<ICryptoKey>;
	getKeySize(): number;
	generateKey(opts?: KeyOpts): Promise<ICryptoKey>;
	hash(msg: string, opts: any): string;
	importKey(pem: string, opts?: KeyOpts): ICryptoKey | Promise<ICryptoKey>;
	setCryptoKeyStore(cryptoKeyStore: ICryptoKeyStore): void;
	sign(key: ICryptoKey, digest: Buffer): Buffer;
	verify(key: ICryptoKey, signature: Buffer, digest: Buffer): boolean;
}
export type CryptoSetting = SoftwareCryptoSetting | HSMCryptoSetting;

export interface SoftwareCryptoSetting {
	algorithm?: string;
	hash?: string;
	keysize?: number;
	software?: true;
}

export interface HSMCryptoSetting {
	lib?: string;
	pin?: string;
	slot?: number;
	label?: string;
	usertype?: number;
	readwrite?: boolean;
	software?: false;
}

export interface UserConfig {
	affiliation?: string;
	enrollmentID: string;
	name: string;
	roles?: string[];
}

export interface ConnectionInfo {
	type: string;
	name: string;
	url: string;
	options: Record<string, unknown>;
}
export interface ServiceError extends Error {
	connection: ConnectionInfo;
}

export interface ProposalResponse {
	errors: ServiceError[];
	responses: EndorsementResponse[];
	queryResults: Buffer[];
}

export interface EndorsementResponse {
	connection: ConnectionInfo;
	response: {
		status: number;
		message: string;
		payload: Buffer;
	};
	payload: Buffer;
	endorsement?: {
		endorser: Buffer;
		signature: Buffer;
	};
}

export class User {
	public static createUser(name: string, password: string, mspid: string, signedCertPem: string, privateKeyPEM?: string): User;
	public static isInstance(object: any): boolean;
	public static newCryptoSuite(options?: CryptoSetting): ICryptoSuite;

	constructor(cfg: string | UserConfig);
	public getName(): string;
	public getMspid(): string;
	public getRoles(): string[];
	public setRoles(roles: string[]): void;
	public getAffiliation(): string;
	public setAffiliation(affiliation: string): void;
	public getEnrollmentSecret(): string;
	public getIdentity(): IIdentity;
	public getSigningIdentity(): ISigningIdentity;
	public setSigningIdentity(signingIdentity: ISigningIdentity): void;
	public getCryptoSuite(): ICryptoSuite;
	public setCryptoSuite(suite: ICryptoSuite): void;
	public setEnrollment(privateKey: ICryptoKey, certificate: string, mspId: string): Promise<void>;
	public isEnrolled(): boolean;
	public fromString(str: string): Promise<User>;
}

export class Endpoint {
	constructor(options: ConnectOptions);
	public isTLS(): boolean;
}

export class ServiceHandler {
	commit(signedEnvelope: Buffer, request: any): Promise<any>;
	endorse(signedProposal: Buffer, request: any): Promise<any>;
	query(signedProposal: Buffer, request: any): Promise<any>;
}
export class DiscoveryHandler extends ServiceHandler {
	constructor(discovery: DiscoveryService)
	commit(signedEnvelope: Buffer, request: any): Promise<any>;
	endorse(signedProposal: Buffer, request: any): Promise<any>;
	query(signedProposal: Buffer, request: any): Promise<any>;
}

export class ServiceEndpoint {
	public readonly name: string;
	public readonly mspid: string;
	public readonly endpoint: Endpoint;
	constructor(name: string, client: Client, mspid?: string);
	public connect(endpoint: Endpoint, options?: ConnectOptions): Promise<void>;
	public disconnect(): void;
	public checkConnection(): Promise<boolean>;
	public isTLS(): boolean;
	public setEndpoint(endpoint: Endpoint): void;
}

export class Committer extends ServiceEndpoint {
	constructor(name: string, client: Client, mspid: string);
	public sendBroadcast(envelope?: Buffer, timeout?: number): Promise<any>;
}

export class Endorser extends ServiceEndpoint {
	public discovered: boolean;
	constructor(name: string, client: Client, mspid: string);
	public sendProposal(signedProposal?: Buffer, timeout?: number): Promise<any>;
	public addChaincode(chaincodeName: string): Endorser;
	public hasChaincode(chaincodeName: string): boolean;
}

export class Eventer extends ServiceEndpoint {
	constructor(name: string, client: Client, mspid: string);
	public disconnect(): void;
	public checkConnection(): Promise<boolean>;
}

export class Discoverer extends ServiceEndpoint {
	constructor(name: string, client: Client, mspid: string);
	public sendDiscovery(signedEnvelope?: Buffer, timeout?: number): Promise<any>;
}

export class ServiceAction {
	public readonly name: string;
	constructor(name: string);
	public sign(parm: IdentityContext | Buffer): ServiceAction;

	public getSignedProposal(): any;
	public getSignedEnvelope(): any;
}

export interface CommitSendRequest {
	targets?: Committer[];
	handler?: ServiceHandler;
	requestTimeout?: number;
}

export class Commit extends Proposal {
	constructor(chaincodeName: string, channel: Channel, endorsement: Endorsement);
	public build(idContext: IdentityContext, request?: any): Buffer;
	public send(request?: any): Promise<any>;
}

export class Endorsement extends Proposal {
	constructor(chaincodeName: string, channel: Channel);
	public newCommit(): Commit;
}

export class Query extends Proposal {
	constructor(chaincodeName: string, channel: Channel);
}

export interface BuildProposalRequest {
	fcn?: string;
	args?: string[];
	transientMap?: { [key: string]: Buffer };
	init?: boolean;
	generateTransactionId?: boolean;
}

export interface SendProposalRequest {
	targets?: Endorser[];
	handler?: ServiceHandler;
	requestTimeout?: number;
	requiredOrgs?: string[];
}

export class Proposal extends ServiceAction {
	readonly chaincodeId: string;
	constructor(chaincodeName: string, channel: Channel);
	public getTransactionId(): string;
	public buildProposalInterest(): any;
	public addCollectionInterest(collectionName: string): Proposal;
	public setNoPrivateReads(noPrivateReads: boolean): Proposal;
	public addChaincodeCollectionsInterest(collectionName: string, collectionNames: string[]): Proposal;
	public addChaincodeNoPrivateReadsCollectionsInterest(collectionName: string, noPrivateReads: boolean, collectionNames: string[]): Proposal;
	public build(idContext: IdentityContext, request?: BuildProposalRequest): Buffer;
	public send(request?: SendProposalRequest): Promise<ProposalResponse>;
	public verifyProposalResponse(proposalResponse?: any): boolean;
	public compareProposalResponseResults(proposalResponses: any[]): boolean;
}

export class DiscoveryService extends ServiceAction {
	readonly targets: Discoverer[];
	constructor(chaincodeName: string, channel: Channel);
	public newHandler(): DiscoveryHandler;
	public build(idContext: IdentityContext, request?: any): Buffer;
	public send(request?: any): Promise<any>;
	public getDiscoveryResults(refresh?: boolean): Promise<any>;
	public close(): void;
	public hasDiscoveryResults(): boolean;
}
export interface RegistrationOpts {
	startBlock?: number|string|Long;
	endBlock?: number|string|Long;
	unregister?: boolean;
}

interface EventListener {
	onEvent(error: Error, event: EventInfo): void;
	unregisterEventListener(): void;
}

export type EventCallback = (error?: Error, event?: EventInfo) => void;

export interface EventInfo {
	eventService: EventService;
	blockNumber: Long;
	transactionId?: string;
	status?: string;
	endBlockReceived?: boolean;
	chaincodeEvents?: ChaincodeEvent[];
	block?: fabproto6.common.IBlock;
	filteredBlock?: fabproto6.protos.IFilteredBlock;
	privateData?: PrivateData;
}

export interface EventRegistrationOptions {
	unregister?: boolean;
	startBlock?: string | Long;
	endBlock?: string | Long;
}

export interface ChaincodeEvent {
	chaincodeId: string;
	transactionId: string;
	status: string;
	eventName: string;
	payload: Buffer;
}

export type BlockType = 'filtered' | 'full' | 'private';

export class EventService extends ServiceAction {
	readonly startBlock: Long | string;
	readonly endBlock?: Long | string;
	readonly blockType: BlockType;
	constructor(chaincodeName: string, channel: Channel);
	public setEventer(discoverer: Eventer): EventService;
	public getLastBlockNumber(): Long;
	public close(): void;
	public build(idContext: IdentityContext, request: StartRequestOptions): Buffer;
	public send(request?: StartEventRequest): Promise<void>;
	public isListening(): boolean;
	public unregisterEventListener(eventListener: EventListener): EventService;
	public registerTransactionListener(txid: string, callback: EventCallback, options: EventRegistrationOptions): EventListener;
	public registerChaincodeListener(chaincodeId: string, eventName: string,
		callback: EventCallback, options: EventRegistrationOptions): EventListener;
	public registerBlockListener(callback: EventCallback, options: EventRegistrationOptions): EventListener;
	public setTargets(targets: Eventer[]): void;
	public isStarted(): boolean;
	public isInUse(): boolean;
}

export interface StartEventRequest {
	targets?: Eventer[];
	requestTimeout?: number;
}

export interface StartRequestOptions {
	blockType?: BlockType;
	startBlock?: number | string | Long;
	endBlock?: number | string | Long;
}

export interface SendEventOptions {
	targets?: Eventer[];
	requestTimeout?: number;
}

export class Client {
	public static newClient(name: string): Client;

	constructor(name: string);
	public newIdentityContext(user: User): IdentityContext;

	public getConnectionOptions(options?: ConnectOptions): ConnectOptions;
	public setCentralizedConnectionOptions(options: Record<string, unknown>): Client;
	public newEndpoint(options: ConnectOptions): Endpoint;
	public newEndorser(name: string, mspid?: string): Endorser;
	public getEndorser(name: string, mspid?: string): Endorser;
	public getEndorsers(mspid?: string): Endorser[];
	public newCommitter(name: string, mspid?: string): Committer;
	public getCommitter(name: string, mspid?: string): Committer;
	public newEventer(name: string, mspid?: string): Eventer;
	public newDiscoverer(name: string, mspid?: string): Discoverer;

	public newChannel(name: string): Channel;
	public getChannel(name: string): Channel;

	public setTlsClientCertAndKey(clientCert: string, clientKey: string): Client;
	public setTlsClientCertAndKey(): Client;
	public addTlsClientCertAndKey(options: ConnectOptions): Client;
	public close(): void;
}

export interface ConnectOptions {
	url?: string;
	pem?: string;
	clientKey?: string;
	clientCert?: string;
	requestTimeout?: number;
	'ssl-target-name-override'?: string;
	[propName: string]: any;
}

export class Channel {
	readonly name: string;
	readonly client: Client;

	constructor(name: string, client: Client);
	public close(): void;

	public newEndorsement(chaincodeName: string): Endorsement;
	public newQuery(chaincodeName: string): Query;
	public newCommit(chaincodeName: string): Commit;
	public newEventService(name: string): EventService;
	public newDiscoveryService(name: string): DiscoveryService;

	public getMspids(): string[];
	public getMsp(id: string): any;
	public removeMsp(id: string): boolean;
	public addMsp(msp: any): Channel;

	public addEndorser(endorser: Endorser, replace?: boolean): Channel;
	public removeEndorser(endorser: Endorser): boolean;
	public getEndorser(name: string): Endorser;
	public getEndorsers(mspid?: string): Endorser[];

	public addCommitter(endorser: Committer, replace?: boolean): Channel;
	public removeCommitter(endorser: Committer): boolean;
	public getCommitter(name: string): Committer;
	public getCommitters(mspid?: string): Committer[];
}

export class IdentityContext {
	readonly transactionId: string;
	readonly nonce: Buffer;
	constructor(user: User, client: Client);
	calculateTransactionId(): IdentityContext;
	serializeIdentity(): Buffer;
	sign(payload: Buffer): Buffer;
}

export interface BlockData {
	signature: Buffer;
	payload: { header: any, data: any };
}

export interface PrivateData {
	[txIndexInBlock: number]: any;
}

export interface KeyOpts {
	ephemeral: boolean;
}

export interface CryptoContent {
	privateKey?: string;
	privateKeyPEM?: string;
	privateKeyObj?: ICryptoKey;
	signedCert?: string;
	signedCertPEM?: string;
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

export interface DiscoveryResultMSPConfig {
	rootCerts: string;
	intermediateCerts: string;
	admins: string;
	id: string;
	name: string;
	organizationalUnitIdentifiers: string[];
	tlsRootCerts: string;
	tlsIntermediateCerts: string;
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
	ledgerHeight: Long;
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
	plan_id?: string;
	groups: {
		[groupName: string]: DiscoveryResultEndorsementGroup;
	};
	layouts: DiscoveryResultEndorsementLayout[];
}

export interface DiscoveryResults {
	msps?: { [mspid: string]: DiscoveryResultMSPConfig };
	orderers?: { [mspid: string]: DiscoveryResultEndpoints };

	peers_by_org?: { [name: string]: DiscoveryResultPeers };

	endorsement_plan?: DiscoveryResultEndorsementPlan;

	timestamp: number;
}

export interface DiscoveryChaincodeCall {
	name: string;
	collection_names?: string[];
}

export interface DiscoveryChaincodeInterest {
	chaincodes: DiscoveryChaincodeCall[];
}
