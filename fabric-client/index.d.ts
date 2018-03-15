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

import { FabricCAServices } from 'fabric-ca-client';

declare enum Status {
  UNKNOWN = 0,
  SUCCESS = 200,
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  REQUEST_ENTITY_TOO_LARGE = 413,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

type ChaincodeType = "golang" | "car" | "java" | "node";

interface ProtoBufObject {
  toBuffer(): Buffer;
}

interface KeyOpts {
  ephemeral: boolean;
}

interface ConnectionOptions {
  pem?: string;
  clientKey?: string;
  clientCert?: string;
  'request-timeout'?: string;
  'ssl-target-name-override'?: string;
  [propName: string]: any;
}

interface ConfigSignature extends ProtoBufObject {
  signature_header: Buffer;
  signature: Buffer;
}

interface ICryptoKey {
  getSKI(): string;
  isSymmetric(): boolean;
  isPrivate(): boolean;
  getPublicKey(): ICryptoKey;
  toBytes(): string;
}

interface ICryptoKeyStore {
  getKey(ski: string): Promise<string>;
  putKey(key: ICryptoKey): Promise<ICryptoKey>;
}

interface IKeyValueStore {
  getValue(name: string): Promise<string>;
  setValue(name: string, value: string): Promise<string>;
}

interface CryptoContent {
  privateKey?: string;
  privateKeyPEM?: string;
  privateKeyObj?: ICryptoKey;
  signedCert?: string;
  signedCertPEM?: string;
}

interface UserOptions {
  username: string;
  mspid: string;
  cryptoContent: CryptoContent;
  skipPersistence: boolean;
}

interface ICryptoSuite {
  decrypt(key: ICryptoKey, cipherText: Buffer, opts: any): Buffer;
  deriveKey(key: ICryptoKey): ICryptoKey;
  encrypt(key: ICryptoKey, plainText: Buffer, opts: any): Buffer;
  getKey(ski: string): Promise<ICryptoKey>;
  generateKey(opts: KeyOpts): Promise<ICryptoKey>;
  hash(msg: string, opts: any): string;
  importKey(pem: string, opts: KeyOpts): ICryptoKey | Promise<ICryptoKey>;
  sign(key: ICryptoKey, digest: Buffer): Buffer;
  verify(key: ICryptoKey, signature: Buffer, digest: Buffer): boolean;
}

interface ChannelRequest {
  name: string;
  orderer: Orderer;
  envelope?: Buffer;
  config?: Buffer;
  txId?: TransactionId;
  signatures: ConfigSignature[];
}

interface TransactionRequest {
  proposalResponses: ProposalResponse[];
  proposal: Proposal;
  txId?: TransactionId;
}

interface BroadcastResponse {
  status: string;
}

interface IIdentity {
  serialize(): Buffer;
  getMSPId(): string;
  isValid(): boolean;
  getOrganizationUnits(): string;
  verify(msg: Buffer, signature: Buffer, opts: any): boolean;
}

interface ISigningIdentity {
  sign(msg: Buffer, opts: any): Buffer;
}

interface ChaincodeInstallRequest {
  targets: Peer[];
  chaincodePath: string;
  chaincodeId: string;
  chaincodeVersion: string;
  chaincodePackage?: Buffer;
  chaincodeType?: ChaincodeType;
  channelNames?: string[] | string;
}

interface ChaincodeInstantiateUpgradeRequest {
  targets?: Peer[];
  chaincodeType?: ChaincodeType;
  chaincodeId: string;
  chaincodeVersion: string;
  txId: TransactionId;
  transientMap?: any;
  fcn?: string;
  args?: string[];
  'endorsement-policy'?: any;
}

interface ChaincodeInvokeRequest {
  targets?: Peer[];
  chaincodeId: string;
  txId: TransactionId;
  transientMap?: any;
  fcn?: string;
  args: string[];
}

interface ChaincodeQueryRequest {
  targets?: Peer[];
  chaincodeId: string;
  transientMap?: any;
  fcn?: string;
  args: string[];
}

interface ChaincodeInfo {
  name: string;
  version: string;
  path: string;
  input: string;
  escc: string;
  vscc: string;
}

interface ChannelInfo {
  channel_id: string;
}

interface ChaincodeQueryResponse {
  chaincodes: ChaincodeInfo[];
}

interface ChannelQueryResponse {
  channels: ChannelInfo[];
}

interface OrdererRequest {
  txId?: TransactionId;
  orderer: string | Orderer;
}

interface JoinChannelRequest {
  txId: TransactionId;
  targets: Peer[];
  block: Buffer;
}

interface ResponseObject {
  status: Status;
  message: string;
  payload: Buffer;
}

interface Proposal {
  header: ByteBuffer;
  payload: ByteBuffer;
  extension: ByteBuffer;
}

interface Header {
  channel_header: ByteBuffer;
  signature_header: ByteBuffer;
}

// Decoded block data
interface BlockData {
  signature: Buffer;
  payload: { header: any, data: any };
}

interface Block {
  header: { number : number;
            previous_hash : Buffer;
            data_hash : Buffer; };
  data: { data : BlockData[] };
  metadata: { metadata : any };
}

interface ProposalResponse {
  version: number;
  timestamp: Date;
  response: ResponseObject;
  payload: Buffer;
  endorsement: any;
}

// Dummy classes for opaque handles for registerChaincodeEvent's
declare class ChaincodeEventHandle {
}

declare class ChaincodeChannelEventHandle {
}

interface ChaincodeEvent {
  chaincode_id: string;
  tx_id: string;
  event_name: string;
  payload: Buffer;
}

type ProposalResponseObject = [Array<ProposalResponse>, Proposal];

declare class Remote {
  constructor(url: string, opts?: ConnectionOptions);
  getName(): string;
  setName(name: string): void;
  getUrl(): string;
}

declare class Peer extends Remote {
  constructor(url: string, opts?: ConnectionOptions);
  close(): void;
  setRole(role: string, isIn: boolean): void;
  isInRole(role: string) : boolean;
  sendProposal(proposal: Proposal, timeout: number): Promise<ProposalResponse>;
}

declare class Orderer extends Remote {
  constructor(url: string, opts?: ConnectionOptions);
  close(): void;
  sendBroadcast(envelope: Buffer): Promise<BroadcastResponse>;
  sendDeliver(envelope: Buffer): Promise<any>;
}

declare class EventHub {
  constructor(clientContext: Client);
  connect(): void;
  disconnect(): void;
  getPeerAddr(): string;
  setPeerAddr(url: string, opts: ConnectionOptions): void;
  isconnected(): boolean;
  registerBlockEvent(onEvent: (b: Block) => void, onError?: (err: Error) => void): number;
  registerTxEvent(txId: string, onEvent: (txId: any, code: string) => void, onError?: (err: Error) => void): void;
  registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent) => void, onError?: (err: Error) => void): ChaincodeEventHandle;
  unregisterBlockEvent(regNumber: number): void;
  unregisterTxEvent(txId: string): void;
  unregisterChaincodeEvent(handle: ChaincodeEventHandle): void;
}

interface RegistrationOptions {
  startBlock?: number;
  endBlock?: number;
  unregister?: boolean;
  disconnect?: boolean;
}

declare class ChannelEventHub {
  constructor(channel: Channel, peer: Peer);
  getPeerAddr(): string;
  lastBlockNumber(): number;
  isconnected(): boolean;
  connect(full_block: boolean): void;
  disconnect(): void;
  checkConnection(force_reconnect: boolean): string;
  registerChaincodeEvent(ccid: string, eventname: string, onEvent: (event: ChaincodeEvent, block_number?: number, tx_id?: string, tx_status?: string) => void,
                         onError?: (err: Error) => void, options?: RegistrationOptions): ChaincodeChannelEventHandle;
  unregisterChaincodeEvent(handle: ChaincodeChannelEventHandle, throwError?: boolean): void;
  registerBlockEvent(onEvent: (b: Block) => void, onError?: (err: Error) => void, options?: RegistrationOptions): number;
  unregisterBlockEvent(block_registration_number: number, throwError: boolean): void;
  registerTxEvent(txId: string, onEvent: (txId: string, code: string, block_number: number) => void, onError?: (err: Error) => void, options?: RegistrationOptions): string;
  unregisterTxEvent(txId: string, throwError: boolean): void;
}

interface MSPConstructorConfig {
  rootCerts: IIdentity[];
  intermediateCerts: IIdentity[];
  admins: IIdentity[];
  signer: ISigningIdentity;
  id: string;
  orgs: string[];
  cryptoSuite: ICryptoSuite;
}

declare class MSP {
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

declare class MSPManager {
  constructor();
  addMSP(config: any): MSP;
  deserializeIdentity(serializedIdentity: Buffer): IIdentity;
  getMSP(): MSP;
  getMSPs(): any;
  loadMSPs(mspConfigs: any): void;
}

declare class Channel {
  constructor(name: string, clientContext: Client);
  initialize(config?: Buffer): Promise<void>;
  addOrderer(orderer: Orderer): void;
  removeOrderer(orderer: Orderer): void;
  addPeer(peer: Peer): void;
  removePeer(peer: Peer): void;
  getGenesisBlock(request: OrdererRequest): Promise<any>;
  getChannelConfig(): Promise<any>;
  joinChannel(request: JoinChannelRequest, timeout?: number): Promise<ProposalResponse[]>;
  sendInstantiateProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
  sendTransactionProposal(request: ChaincodeInvokeRequest, timeout?: number): Promise<ProposalResponseObject>;
  sendTransaction(request: TransactionRequest): Promise<BroadcastResponse>;
  sendUpgradeProposal(request: ChaincodeInstantiateUpgradeRequest, timeout?: number): Promise<ProposalResponseObject>;
  queryByChaincode(request: ChaincodeQueryRequest): Promise<Buffer[]>;
  queryBlock(blockNumber: number, target?: Peer, useAdmin?: boolean): Promise<any>;
  queryBlockByHash(block : Buffer, target?: Peer, useAdmin?: boolean): Promise<any>;
  queryTransaction(txId: string, target?: Peer, useAdmin?: boolean): Promise<any>;
  queryBlockByTxID(txId: string, target?: Peer, useAdmin?: boolean): Promise<any>;
  queryInstantiatedChaincodes(target: Peer, useAdmin?: boolean): Promise<ChaincodeQueryResponse>;
  queryInfo(target: Peer, useAdmin?: boolean): Promise<any>;
  getOrderers(): Orderer[];
  getPeers(): Peer[];
  getOrganizations(): string[];
  getMSPManager(): MSPManager;
  setMSPManager(manager: MSPManager): void;
  newChannelEventHub(peer: Peer): ChannelEventHub;
  getChannelEventHubsForOrg(org_name: string): ChannelEventHub[];
}

declare class TransactionId {
  constructor(signer_or_userContext: IIdentity, admin: boolean);
  getTransactionID(): string;
  getNonce(): Buffer;
  isAdmin(): boolean;
}

interface UserConfig {
  enrollmentID: string;
  name: string
  roles?: string[];
  affiliation?: string;
}

declare class User {
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

declare abstract class BaseClient {
  constructor();
  static setLogger(logger: any): void;
  static addConfigFile(path: string): void;
  static getConfigSetting(name: string, default_value?: any): any;
  static setConfigSetting(name: string, value: any): void;
  static newCryptoSuite(): ICryptoSuite;
  static newCryptoKeyStore(obj?: { path: string }): ICryptoKeyStore;
  static newDefaultKeyValueStore(obj?: { path: string }): Promise<IKeyValueStore>;
  static normalizeX509(raw: string): string;
  setCryptoSuite(suite: ICryptoSuite): void;
  getCryptoSuite(): ICryptoSuite;
}

declare class Client extends BaseClient {
  constructor();
  static loadFromConfig(config: any): Client;
  loadFromConfig(config: any): void;
  setTlsClientCertAndKey(clientCert: string, clientKey: Buffer): void;
  addTlsClientCertAndKey(opts: any): void;
  isDevMode(): boolean;
  setDevMode(mode: boolean): void;
  newChannel(name: string): Channel;
  getChannel(name?: string, throwError?: boolean): Channel;
  newPeer(url: string, opts: ConnectionOptions): Peer;
  newEventHub(): EventHub;
  getEventHub(peer_name: string): EventHub;
  getEventHubsForOrg(org_name: string): EventHub[];
  getPeersForOrg(org_name: string): Peer[];
  newOrderer(url: string, opts: ConnectionOptions): Orderer;
  getCertificateAuthority(): FabricCAServices;
  getClientConfig(): any;
  getMspid(): string;
  newTransactionID(admin?: boolean): TransactionId;
  extractChannelConfig(envelope: Buffer): Buffer;
  signChannelConfig(config: Buffer): ConfigSignature;
  createChannel(request: ChannelRequest): Promise<BroadcastResponse>;
  updateChannel(request: ChannelRequest): Promise<BroadcastResponse>;
  queryChannels(peer: Peer, useAdmin: boolean): Promise<ChannelQueryResponse>;
  queryInstalledChaincodes(peer: Peer, useAdmin: boolean): Promise<ChaincodeQueryResponse>;
  installChaincode(request: ChaincodeInstallRequest, timeout: number): Promise<ProposalResponseObject>;
  initCredentialStores(): Promise<boolean>;
  setStateStore(store: IKeyValueStore): void;
  setAdminSigningIdentity(private_key: string, certificate: string, mspid: string): void;
  saveUserToStateStore(): Promise<User>;
  setUserContext(user: User, skipPersistence?: boolean): Promise<User>;
  getUserContext(name: string, checkPersistence?: boolean): Promise<User> | User;
  loadUserFromStateStore(name: string): Promise<User>;
  getStateStore(): IKeyValueStore;
  createUser(opts: UserOptions): Promise<User>;
}

declare module 'fabric-client' {
  export = Client;
}
