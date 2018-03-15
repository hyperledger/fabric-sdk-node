/*
 Copyright 2018 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import { BaseClient, ICryptoSuite, User } from "fabric-client";

interface TLSOptions {
    trustedRoots: Buffer;
    verify: boolean;
}

interface IFabricCAService {
    url: string;
    tlsOptions?: TLSOptions;
    caName?: string;
    cryptoSuite?: ICryptoSuite;
}

interface IKeyValueAttribute {
    name: string;
    value: string;
    ecert?: boolean;
}

interface IRegisterRequest {
    enrollmentID: string;
    enrollmentSecret?: string;
    role?: string;
    affiliation: string;
    maxEnrollments?: number;
    attrs?: IKeyValueAttribute[];
}

interface IAttributeRequest {
    name: string;
    optional: boolean;
}

interface IEnrollmentRequest {
    enrollmentID: string;
    enrollmentSecret: string;
    profile?: string;
    attr_reqs?: IAttributeRequest[];
}

interface IReEnrollResponse {
    key: string;
    certificate: string;
    rootCertificate: string;
}

interface IRevokeRequest {
    enrollmentID: string;
    aki?: string;
    serial?: string;
    reason?: string;
}

interface IRestriction {
    revokedBefore?: Date;
    revokedAfter?: Date;
    expireBefore?: Date;
    expireAfter?: Date;
}

interface IIdentityRequest {
    enrollmentID: string;
    affiliation: string;
    attrs?: IKeyValueAttribute[];
    type?: string;
    enrollmentSecret?: string;
    maxEnrollments?: number;
    caname?: string;
}

interface IServiceResponseMessage {
    code: number;
    message: string;
}

interface IServiceResponse {
    Success: boolean;
    Result: any;
    Errors: IServiceResponseMessage[];
    Messages: IServiceResponseMessage[];
}

interface IAffiliationRequest {
    name: string;
    caname?: string;
    force?: boolean;
}

declare enum HFCAIdentityType {
    PEER = 'peer',
    ORDERER = 'orderer',
    CLIENT = 'client',
    USER = 'user'
}

declare enum HFCAIdentityAttributes {
    HFREGISTRARROLES = 'hf.Registrar.Roles',
    HFREGISTRARDELEGATEROLES = 'hf.Registrar.DelegateRoles',
    HFREGISTRARATTRIBUTES = 'hf.Registrar.Attributes',
    HFINTERMEDIATECA = 'hf.IntermediateCA',
    HFREVOKER = 'hf.Revoker',
    HFAFFILIATIONMGR = 'hf.AffiliationMgr',
    HFGENCRL = 'hf.GenCRL'
}

declare class AffiliationService {
    create(req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
    getOne(affiliation: string, registrar: User): Promise<IServiceResponse>;
    getAll(registrar: User): Promise<IServiceResponse>;
    delete(req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
    update(affiliation: string, req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
}

declare class IdentityService {
    create(req: IIdentityRequest, registrar: User): Promise<string>;
    getOne(enrollmentID: string, registrar: User): Promise<IServiceResponse>;
    getAll(registrar: User): Promise<IServiceResponse>;
    delete(enrollmentID: string, registrar: User): Promise<IServiceResponse>;
    update(enrollmentID: string, req: IIdentityRequest, registrar: User): Promise<IServiceResponse>;
}

declare class FabricCAServices extends BaseClient {
    constructor(url: string | IFabricCAService, tlsOptions?: TLSOptions, caName?: string, cryptoSuite?: ICryptoSuite);
    getCaName(): string;
    register(req: IRegisterRequest, registrar: User): Promise<string>;
    enroll(req: IEnrollmentRequest);
    reenroll(currentUser: User, attr_reqs: IAttributeRequest[]): Promise<IReEnrollResponse>;
    revoke(request: IRevokeRequest, registrar: User): Promise<any>;
    generateCRL(request: IRestriction, registrar: User): Promise<any>;
    newIdentityService(): IdentityService;
    newAffiliationService(): AffiliationService;
    toString(): string;
}

declare module 'fabric-ca-client' {
    export = FabricCAServices;
}