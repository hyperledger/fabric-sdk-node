/**
 * Copyright 2017 Kapil Sachdeva All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import FabricCAServices = require('fabric-ca-client');
import { BaseClient } from "./base";

interface ProtoBufObject {
  toBuffer(): Buffer;
}

// Dummy classes for opaque handles for registerChaincodeEvent's
declare class ChaincodeEventHandle {
}

declare class ChaincodeChannelEventHandle {
}

declare class Remote {
  constructor(url: string, opts?: Client.ConnectionOptions);
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
  newPeer(url: string, opts?: Client.ConnectionOptions): Client.Peer;
  newEventHub(): Client.EventHub;
  getEventHub(peer_name: string): Client.EventHub;
  getEventHubsForOrg(org_name: string): Client.EventHub[];
  getPeersForOrg(org_name: string): Client.Peer[];
  newOrderer(url: string, opts?: Client.ConnectionOptions): Client.Orderer;
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
  createUser(opts: Client.UserOptions): Promise<Client.User>;
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

  export interface UserConfig {
    enrollmentID: string;
    name: string
    roles?: string[];
    affiliation?: string;
  }

  export interface ConnectionOptions {
    pem?: string;
    clientKey?: string;
    clientCert?: string;
    'request-timeout'?: string;
    'ssl-target-name-override'?: string;
    [propName: string]: any;
  }

  export class User {
    constructor(cfg: string | UserConfig);
    isEnrolled(): boolean;
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
    fromString(): Promise<User>;
  }

  export class Channel {
    constructor(name: string, clientContext: Client);
    initialize(config?: Buffer): Promise<void>;
    addOrderer(orderer: Orderer): void;
    removeOrderer(orderer: Orderer): void;
    addPeer(peer: Peer): void;
    removePeer(peer: Peer): void;
    getGenesisBlock(request: OrdererRequest): Promise<Block>;
    getChannelConfig(): Promise<any>;
    joinChannel(request: JoinChannelRequest, timeout?: number): Promise<ProposalResponse[]>;
    sendInstantiateProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
    sendTransactionProposal(request: ChaincodeInvokeRequest, timeout?: number): Promise<ProposalResponseObject>;
    sendTransaction(request: TransactionRequest): Promise<BroadcastResponse>;
    sendUpgradeProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
    queryByChaincode(request: ChaincodeQueryRequest): Promise<Buffer[]>;
    queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlock(blockNumber: number, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlockByHash(block: Buffer, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<any>;
    queryTransaction(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: false): Promise<Block>;
    queryBlockByTxID(txId: string, target?: Peer | string, useAdmin?: boolean, skipDecode?: true): Promise<Buffer>;
    queryInstantiatedChaincodes(target: Peer | string, useAdmin?: boolean): Promise<ChaincodeQueryResponse>;
    queryInfo(target?: Peer | string, useAdmin?: boolean): Promise<BlockchainInfo>;
    getOrderers(): Orderer[];
    getPeers(): Peer[];
    getOrganizations(): string[];
    getMSPManager(): MSPManager;
    setMSPManager(manager: MSPManager): void;
    newChannelEventHub(peer: Peer | string): ChannelEventHub;
    getChannelEventHubsForOrg(org_name?: string): ChannelEventHub[];
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
    admin?: boolean;
    txId?: TransactionId;
  }

  export interface BroadcastResponse {
    status: string;
    info: string;
  }

  export type ProposalResponseObject = [Array<Client.ProposalResponse>, Client.Proposal];

  export interface OrdererRequest {
    txId: TransactionId;
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
    response: ResponseObject;
    payload: Buffer;
    endorsement: any;
  }

  export class ChannelEventHub {
    constructor(channel: Channel, peer: Peer);
    getPeerAddr(): string;
    lastBlockNumber(): number;
    isconnected(): boolean;
    connect(full_block?: boolean): void;
    disconnect(): void;
    checkConnection(force_reconnect: boolean): string;
    registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent, block_number?: number, tx_id?: string, tx_status?: string) => void,
      onError?: (err: Error) => void, options?: RegistrationOptions): ChaincodeChannelEventHandle;
    unregisterChaincodeEvent(handle: ChaincodeChannelEventHandle, throwError?: boolean): void;
    registerBlockEvent(onEvent: (block: Block) => void, onError?: (err: Error) => void, options?: RegistrationOptions): number;
    unregisterBlockEvent(block_registration_number: number, throwError: boolean): void;
    registerTxEvent(txId: string, onEvent: (txId: string, code: string, block_number: number) => void, onError?: (err: Error) => void, options?: RegistrationOptions): string;
    unregisterTxEvent(txId: string, throwError?: boolean): void;
  }

  export class Peer extends Remote {
    constructor(url: string, opts?: ConnectionOptions);
    close(): void;
    setRole(role: string, isIn: boolean): void;
    isInRole(role: string): boolean;
    sendProposal(proposal: Proposal, timeout: number): Promise<ProposalResponse>;
  }

  export class Orderer extends Remote {
    constructor(url: string, opts?: ConnectionOptions);
    close(): void;
    sendBroadcast(envelope: Buffer): Promise<BroadcastResponse>;
    sendDeliver(envelope: Buffer): Promise<any>;
  }

  export class EventHub {
    constructor(clientContext: Client);
    connect(): void;
    disconnect(): void;
    getPeerAddr(): string;
    setPeerAddr(url: string, opts: ConnectionOptions): void;
    isconnected(): boolean;
    registerBlockEvent(onEvent: (block: Block) => void, onError?: (err: Error) => void): number;
    registerTxEvent(txId: string, onEvent: (txId: any, code: string) => void, onError?: (err: Error) => void): void;
    registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent) => void, onError?: (err: Error) => void): ChaincodeEventHandle;
    unregisterBlockEvent(regNumber: number): void;
    unregisterTxEvent(txId: string): void;
    unregisterChaincodeEvent(handle: ChaincodeEventHandle): void;
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

  export interface UserOptions {
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

  export interface ResponseObject {
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

  export interface RegistrationOptions {
    startBlock?: number;
    endBlock?: number;
    unregister?: boolean;
    disconnect?: boolean;
  }

  export interface ChaincodeEvent {
    chaincode_id: string;
    tx_id: string;
    event_name: string;
    payload: Buffer;
  }
}
