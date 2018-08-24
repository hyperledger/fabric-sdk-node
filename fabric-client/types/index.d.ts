/**
 * Copyright 2017 Kapil Sachdeva All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import FabricCAServices = require('fabric-ca-client');
import { BaseClient } from "./base";

interface ProtoBufObject {
  toBuffer(): Buffer;
}

// Dummy classes for opaque handles for registerChaincodeEvent's
declare class ChaincodeChannelEventHandle {
}

declare class Remote {
  constructor(url: string, opts?: Client.ConnectionOpts);
  getName(): string;
  setName(name: string): void;
  getUrl(): string;
}

declare class Client extends BaseClient {
  constructor();
  static loadFromConfig(config: any): Client;
  loadFromConfig(config: any): void;
  setTlsClientCertAndKey(clientCert: string, clientKey: string): void;
  addTlsClientCertAndKey(opts: any): void;
  isDevMode(): boolean;
  setDevMode(mode: boolean): void;
  newChannel(name: string): Client.Channel;
  getChannel(name?: string, throwError?: boolean): Client.Channel;
  newPeer(url: string, opts?: Client.ConnectionOpts): Client.Peer;
  getPeer(name: string): Client.Peer;
  getPeersForOrg(mspid?: string): Client.Peer[];
  newOrderer(url: string, opts?: Client.ConnectionOpts): Client.Orderer;
  getOrderer(name: string): Client.Orderer;
  getPeersForOrgOnChannel(channel_names: string | string[]): Client.ChannelPeer[];
  getCertificateAuthority(): FabricCAServices;
  getClientConfig(): any;
  getMspid(): string;
  newTransactionID(admin?: boolean): Client.TransactionId;
  extractChannelConfig(envelope: Buffer): Buffer;
  signChannelConfig(config: Buffer): Client.ConfigSignature;
  createChannel(request: Client.ChannelRequest): Promise<Client.BroadcastResponse>;
  updateChannel(request: Client.ChannelRequest): Promise<Client.BroadcastResponse>;
  queryChannels(peer: Client.Peer | string, useAdmin?: boolean): Promise<Client.ChannelQueryResponse>;
  queryInstalledChaincodes(peer: Client.Peer | string, useAdmin?: boolean): Promise<Client.ChaincodeQueryResponse>;
  installChaincode(request: Client.ChaincodeInstallRequest, timeout?: number): Promise<Client.ProposalResponseObject>;
  initCredentialStores(): Promise<boolean>;
  setStateStore(store: Client.IKeyValueStore): void;
  setAdminSigningIdentity(private_key: string, certificate: string, mspid: string): void;
  saveUserToStateStore(): Promise<Client.User>;
  setUserContext(user: Client.User | Client.UserContext, skipPersistence?: boolean): Promise<Client.User>;
  getUserContext(name: string, checkPersistence?: boolean): Promise<Client.User> | Client.User;
  loadUserFromStateStore(name: string): Promise<Client.User>;
  getStateStore(): Client.IKeyValueStore;
  createUser(opts: Client.UserOpts): Promise<Client.User>;

  getTargetPeers(request_targets: string | string[] | Client.Peer | Client.Peer[]): Client.Peer[];
  getTargetOrderers(request_orderer: string | Client.Orderer): Client.Orderer;
  getTargetOrderers(request_orderer: null | undefined, channel_orderers: Client.Orderer[]): Client.Orderer;
  getTargetOrderers(request_orderer: null | undefined, channel_orderers: null | undefined, channel_name: string): Client.Orderer;
  getClientCertHash(create: boolean): Buffer;
}
export = Client;

declare namespace Client {
  export enum Status {
    UNKNOWN = 0,
    SUCCESS = 200,
    BAD_REQUEST = 400,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    REQUEST_ENTITY_TOO_LARGE = 413,
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503
  }

  export type ChaincodeType = "golang" | "car" | "java" | "node";
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
    sign(key: ICryptoKey, digest: Buffer): Buffer;
    verify(key: ICryptoKey, signature: Buffer, digest: Buffer): boolean;
    setCryptoKeyStore(cryptoKeyStore: ICryptoKeyStore): void;
  }

  export interface CryptoSetting {
    software: boolean;
    keysize: number;
    algorithm: string;
    hash: string;
  }

  export interface UserConfig {
    enrollmentID: string;
    name: string
    roles?: string[];
    affiliation?: string;
  }

  export interface ConnectionOpts {
    pem?: string;
    clientKey?: string;
    clientCert?: string;
    'request-timeout'?: string;
    'ssl-target-name-override'?: string;
    [propName: string]: any;
  }

  export class User {
    constructor(cfg: string | UserConfig);
    getName(): string;
    getRoles(): string[];
    setRoles(roles: string[]): void;
    getAffiliation(): string;
    setAffiliation(affiliation: string): void;
    getIdentity(): IIdentity;
    getSigningIdentity(): ISigningIdentity;
    getCryptoSuite(): ICryptoSuite;
    setCryptoSuite(suite: ICryptoSuite): void;
    setEnrollment(privateKey: ICryptoKey, certificate: string, mspId: string): Promise<void>;
    isEnrolled(): boolean;
    fromString(): Promise<User>;
    static isInstance(object: any): boolean;
  }

  export interface InitializeRequest {
    target?: string | Peer | ChannelPeer;
    discover?: boolean;
    endorsementHandler?: string;
    asLocalhost?: boolean;
    configUpdate?: Buffer;
  }

  export class Channel {
    constructor(name: string, clientContext: Client);
    close(): void;
    initialize(request?: InitializeRequest): Promise<void>;

    getName(): string;
    getDiscoveryResults(): Promise<DiscoveryResults>;
    refresh(request?: DiscoveryRequest): Promise<DiscoveryResults>;
    getOrganizations(): string[];

    setMSPManager(manager: MSPManager): void;
    getMSPManager(): MSPManager;

    addPeer(peer: Peer, mspid: string, roles?: ChannelPeerRoles, replace?: boolean): void;
    removePeer(peer: Peer): void;
    getPeer(name: string): ChannelPeer;
    getChannelPeer(name: string): ChannelPeer;
    getPeers(): ChannelPeer[];
    getChannelPeers(): ChannelPeer[];

    addOrderer(orderer: Orderer, replace?: boolean): void;
    removeOrderer(orderer: Orderer): void;
    getOrderer(name: string): Orderer;
    getOrderers(): Orderer[];
    newChannelEventHub(peer: Peer | string): ChannelEventHub;
    getChannelEventHub(name: string): ChannelEventHub;
    getChannelEventHubsForOrg(mspid?: string): ChannelEventHub[];
    getPeersForOrg(mspid?: string): ChannelPeer[];

    getGenesisBlock(request?: OrdererRequest): Promise<Block>;

    joinChannel(request: JoinChannelRequest, timeout?: number): Promise<ProposalResponse[]>;
    getChannelConfig(target?: string | Peer, timeout?: number): Promise<any>;
    getChannelConfigFromOrderer(): Promise<any>;
    loadConfigUpdateEnvelope(data: Buffer): any;
    loadConfigUpdate(config_update_bytes: Buffer): any;
    loadConfigEnvelope(config_envelope: any): any;

    queryInfo(target?: Peer | string, useAdmin?: boolean): Promise<BlockchainInfo>;
    queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<any>;
    queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;

    queryInstantiatedChaincodes(target: Peer | string, useAdmin?: boolean): Promise<ChaincodeQueryResponse>;

    sendInstantiateProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
    sendUpgradeProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
    sendTransactionProposal(request: ChaincodeInvokeRequest, timeout?: number): Promise<ProposalResponseObject>;
    sendTransaction(request: TransactionRequest, timeout?: number): Promise<BroadcastResponse>;
    queryByChaincode(request: ChaincodeQueryRequest, useAdmin?: boolean): Promise<Buffer[]>;
    verifyProposalResponse(proposal_response: ProposalResponse): boolean;
    compareProposalResponseResults(proposal_responses: ProposalResponse[]): boolean;
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

    close(): void;

    getMspid(): string;
    getName(): string;
    getUrl(): string;
    setRole(role: string, isIn: boolean): void;
    isInRole(role: string): boolean;
    isInOrg(mspid: string): boolean;
    getChannelEventHub(): ChannelEventHub;
    getPeer(): Peer;
    sendProposal(proposal: Proposal, timeout?: number): Promise<ProposalResponse>;
    sendDiscovery(request: Buffer, timeout?: number): Promise<DiscoveryResults>;
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
    constructor(signer_or_userContext: IIdentity, admin: boolean);
    getTransactionID(): string;
    getNonce(): Buffer;
    isAdmin(): boolean;
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

  export type ProposalResponseObject = [Array<Client.ProposalResponse>, Client.Proposal];

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
      number: number;
      previous_hash: Buffer;
      data_hash: Buffer;
    };
    data: { data: BlockData[] };
    metadata: { metadata: any };
  }

  export interface ProposalResponse {
    version: number;
    timestamp: Date;
    response: Response;
    payload: Buffer;
    endorsement: any;
  }

  export class ChannelEventHub {
    constructor(channel: Channel, peer: Peer);
    getName(): string;
    getPeerAddr(): string;
    lastBlockNumber(): number;
    isconnected(): boolean;
    connect(full_block?: boolean): void;
    disconnect(): void;
    close(): void;
    checkConnection(force_reconnect: boolean): string;
    registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent, block_number?: number, tx_id?: string, tx_status?: string) => void,
      onError?: (err: Error) => void, options?: RegistrationOpts): ChaincodeChannelEventHandle;
    unregisterChaincodeEvent(handle: ChaincodeChannelEventHandle, throwError?: boolean): void;
    registerBlockEvent(onEvent: (block: Block) => void, onError?: (err: Error) => void, options?: RegistrationOpts): number;
    unregisterBlockEvent(block_registration_number: number, throwError: boolean): void;
    registerTxEvent(txId: string, onEvent: (txId: string, code: string, block_number: number) => void, onError?: (err: Error) => void, options?: RegistrationOpts): string;
    unregisterTxEvent(txId: string, throwError?: boolean): void;
  }

  export interface SignedRequest {
    payload: Buffer;
    signature: Buffer;
  }

  export class Peer extends Remote {
    constructor(url: string, opts?: ConnectionOpts);
    close(): void;
    setRole(role: string, isIn: boolean): void;
    isInRole(role: string): boolean;
    sendProposal(proposal: Proposal, timeout?: number): Promise<ProposalResponse>;
    sendDiscovery(request: SignedRequest, timeout?: number): Promise<DiscoveryResults>;
  }

  export class Orderer extends Remote {
    constructor(url: string, opts?: ConnectionOpts);
    close(): void;
    sendBroadcast(envelope: Buffer): Promise<BroadcastResponse>;
    sendDeliver(envelope: Buffer): Promise<any>;
  }

  interface MSPConstructorConfig {
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
    deserializeIdentity(serializedIdentity: Buffer, storeKey: boolean): IIdentity | Promise<IIdentity>;
    getDefaultSigningIdentity(): ISigningIdentity;
    getId(): string;
    getOrganizationUnits(): string[];
    getPolicy(): any;
    getSigningIdentity(identifier: string): ISigningIdentity;
    toProtoBuf(): any;
    validate(id: IIdentity): boolean;
  }

  export class MSPManager {
    constructor();
    addMSP(config: any): MSP;
    deserializeIdentity(serializedIdentity: Buffer): IIdentity;
    getMSP(): MSP;
    getMSPs(): any;
    loadMSPs(mspConfigs: any): void;
  }
  export interface ChaincodeInstallRequest {
    targets?: Peer[] | string[];
    chaincodePath: string;
    metadataPath?: string;
    chaincodeId: string;
    chaincodeVersion: string;
    chaincodePackage?: Buffer;
    chaincodeType?: ChaincodeType;
    channelNames?: string[] | string;
    txId: TransactionId;
  }

  export interface ChaincodeInstantiateUpgradeRequest {
    targets?: Peer[] | string[];
    chaincodeType?: ChaincodeType;
    chaincodeId: string;
    chaincodeVersion: string;
    txId: TransactionId;
    'collections-config'?: string;
    transientMap?: any;
    fcn?: string;
    args?: string[];
    'endorsement-policy'?: any;
  }

  export interface ChaincodeInvokeRequest {
    targets?: Peer[] | string[];
    chaincodeId: string;
    txId: TransactionId;
    transientMap?: any;
    fcn?: string;
    args: string[];
    ignore?: string[];
    preferred?: string[];
  }

  export interface ChaincodeQueryRequest {
    targets?: Peer[] | string[];
    chaincodeId: string;
    transientMap?: any;
    fcn?: string;
    args: string[];
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

  export interface ChaincodeQueryResponse {
    chaincodes: ChaincodeInfo[];
  }

  export interface ChannelQueryResponse {
    channels: ChannelInfo[];
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

  export interface RegistrationOpts {
    startBlock?: number;
    endBlock?: number | "newest";
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
  export type DiscoveryResultEndpoints = { endpoints: DiscoveryResultEndpoint[] };

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
  export type DiscoveryResultPeers = { peers: DiscoveryResultPeer[] };

  export interface DiscoveryResultEndorsementGroup {
    peers: DiscoveryResultPeer[];
  }
  export type DiscoveryResultEndorsementLayout = {
    [group_name: string]: number;
  };
  export interface DiscoveryResultEndorsementTarget {
    groups: {
      [group_name: string] : DiscoveryResultEndorsementGroup;
    },
    layouts: DiscoveryResultEndorsementLayout[];
  }

  export interface DiscoveryResults {
    msps?: { [mspid: string]: DiscoveryResultMSPConfig };
    orderers?: { [mspid: string]: DiscoveryResultEndpoints };

    peers_by_org?: { [name: string]: DiscoveryResultPeers };
    local_peers?: { [name: string]: DiscoveryResultPeers };

    endorsement_targets?: { [chaincode_name: string]: DiscoveryResultEndorsementTarget };

    timestamp: number;
  }
}
