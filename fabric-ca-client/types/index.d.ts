/**
 * SPDX-License-Identifier: Apache-2.0
 */

import {ICryptoSuite, ICryptoKey, User} from 'fabric-common';

declare class FabricCAServices {
	constructor(url: string | FabricCAServices.IFabricCAService,
		tlsOptions?: FabricCAServices.TLSOptions, caName?: string, cryptoSuite?: ICryptoSuite);

	getCaName(): string;

	register(req: FabricCAServices.IRegisterRequest, registrar: User): Promise<string>;

	enroll(req: FabricCAServices.IEnrollmentRequest): Promise<FabricCAServices.IEnrollResponse>;

	reenroll(currentUser: User, attrReqs: FabricCAServices.IAttributeRequest[]): Promise<FabricCAServices.IEnrollResponse>;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	revoke(request: FabricCAServices.IRevokeRequest, registrar: User): Promise<any>;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	generateCRL(request: FabricCAServices.IRestriction, registrar: User): Promise<any>;

	newIdentityService(): FabricCAServices.IdentityService;

	newAffiliationService(): FabricCAServices.AffiliationService;

	toString(): string;
}

export = FabricCAServices;

declare namespace FabricCAServices {
	export interface TLSOptions {
		trustedRoots: Buffer | string[];
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
		csr?: string;
	}

	export interface IEnrollResponse {
		key: ICryptoKey;
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
		success: boolean;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		result: any;
		errors: IServiceResponseMessage[];
		messages: IServiceResponseMessage[];
	}

	export interface IAffiliationRequest {
		name: string;
		caname?: string;
		force?: boolean;
	}

	// eslint-disable-next-line no-shadow
	export enum HFCAIdentityType {
		PEER = 'peer',
		ORDERER = 'orderer',
		CLIENT = 'client',
		USER = 'user'
	}

	// eslint-disable-next-line no-shadow
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
