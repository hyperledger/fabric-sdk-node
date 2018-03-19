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

import { ICryptoSuite, ICryptoKeyStore, IKeyValueStore, User } from "fabric-client";
import { BaseClient } from './base';

declare class FabricCAServices extends BaseClient {
    constructor(url: string | FabricCAServices.IFabricCAService, tlsOptions?: FabricCAServices.TLSOptions, caName?: string, cryptoSuite?: ICryptoSuite);
    getCaName(): string;
    register(req: FabricCAServices.IRegisterRequest, registrar: User): Promise<string>;
    enroll(req: FabricCAServices.IEnrollmentRequest): Promise<FabricCAServices.IEnrollResponse>;
    reenroll(currentUser: User, attr_reqs: FabricCAServices.IAttributeRequest[]): Promise<FabricCAServices.IEnrollResponse>;
    revoke(request: FabricCAServices.IRevokeRequest, registrar: User): Promise<any>;
    generateCRL(request: FabricCAServices.IRestriction, registrar: User): Promise<any>;
    newIdentityService(): FabricCAServices.IdentityService;
    newAffiliationService(): FabricCAServices.AffiliationService;
    toString(): string;
}


export = FabricCAServices;

declare namespace FabricCAServices {
    export interface TLSOptions {
        trustedRoots: Buffer;
        verify: boolean;
    }

    export interface IFabricCAService {
        url: string;
        tlsOptions?: TLSOptions;
        caName?: string;
        cryptoSuite?: ICryptoSuite;
    }

    export interface IKeyValueAttribute {
        name: string;
        value: string;
        ecert?: boolean;
    }

    export interface IRegisterRequest {
        enrollmentID: string;
        enrollmentSecret?: string;
        role?: string;
        affiliation: string;
        maxEnrollments?: number;
        attrs?: IKeyValueAttribute[];
    }

    export interface IAttributeRequest {
        name: string;
        optional: boolean;
    }

    export interface IEnrollmentRequest {
        enrollmentID: string;
        enrollmentSecret: string;
        profile?: string;
        attr_reqs?: IAttributeRequest[];
    }

    export interface IKey {
        getSKI(): string;

        /**
         * Returns true if this key is a symmetric key, false is this key is asymmetric
         *
         * @returns {boolean} if this key is a symmetric key
         */
        isSymmetric(): boolean;

        /**
         * Returns true if this key is an asymmetric private key, false otherwise.
         *
         * @returns {boolean} if this key is an asymmetric private key
         */
        isPrivate(): boolean;

        /**
         * Returns the corresponding public key if this key is an asymmetric private key.
         * If this key is already public, returns this key itself.
         *
         * @returns {module:api.Key} the corresponding public key if this key is an asymmetric private key.
         * If this key is already public, returns this key itself.
         */
        getPublicKey(): IKey;

        /**
         * Converts this key to its PEM representation, if this operation is allowed.
         *
         * @returns {string} the PEM string representation of the key
         */
        toBytes(): string;
    }

    export interface IEnrollResponse {
        key: IKey;
        certificate: string;
        rootCertificate: string;
    }

    export interface IRevokeRequest {
        enrollmentID: string;
        aki?: string;
        serial?: string;
        reason?: string;
    }

    export interface IRestriction {
        revokedBefore?: Date;
        revokedAfter?: Date;
        expireBefore?: Date;
        expireAfter?: Date;
    }

    export interface IIdentityRequest {
        enrollmentID: string;
        affiliation: string;
        attrs?: IKeyValueAttribute[];
        type?: string;
        enrollmentSecret?: string;
        maxEnrollments?: number;
        caname?: string;
    }

    export interface IServiceResponseMessage {
        code: number;
        message: string;
    }

    export interface IServiceResponse {
        Success: boolean;
        Result: any;
        Errors: IServiceResponseMessage[];
        Messages: IServiceResponseMessage[];
    }

    export interface IAffiliationRequest {
        name: string;
        caname?: string;
        force?: boolean;
    }

    export enum HFCAIdentityType {
        PEER = 'peer',
        ORDERER = 'orderer',
        CLIENT = 'client',
        USER = 'user'
    }

    export enum HFCAIdentityAttributes {
        HFREGISTRARROLES = 'hf.Registrar.Roles',
        HFREGISTRARDELEGATEROLES = 'hf.Registrar.DelegateRoles',
        HFREGISTRARATTRIBUTES = 'hf.Registrar.Attributes',
        HFINTERMEDIATECA = 'hf.IntermediateCA',
        HFREVOKER = 'hf.Revoker',
        HFAFFILIATIONMGR = 'hf.AffiliationMgr',
        HFGENCRL = 'hf.GenCRL'
    }
    export class AffiliationService {
        create(req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
        getOne(affiliation: string, registrar: User): Promise<IServiceResponse>;
        getAll(registrar: User): Promise<IServiceResponse>;
        delete(req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
        update(affiliation: string, req: IAffiliationRequest, registrar: User): Promise<IServiceResponse>;
    }

    export class IdentityService {
        create(req: IIdentityRequest, registrar: User): Promise<string>;
        getOne(enrollmentID: string, registrar: User): Promise<IServiceResponse>;
        getAll(registrar: User): Promise<IServiceResponse>;
        delete(enrollmentID: string, registrar: User): Promise<IServiceResponse>;
        update(enrollmentID: string, req: IIdentityRequest, registrar: User): Promise<IServiceResponse>;
    }
}