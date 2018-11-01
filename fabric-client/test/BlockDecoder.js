/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/* eslint-disable no-throw-literal */

const fs = require('fs');
const path = require('path');
const rewire = require('rewire');
const BlockDecoderRewire = rewire('../lib/BlockDecoder');
const should = require('chai').should();
const sinon = require('sinon');


describe('BlockDecoder', () => {
	let revert;

	const sandbox = sinon.createSandbox();
	let data;
	let FakeLogger;

	before(() => {
		data = fs.readFileSync(path.join(__dirname, '../../test/fixtures/channel/twoorgs.genesis.block'));
	});

	beforeEach(() => {
		revert = [];
		FakeLogger = {
			debug : () => {},
			error: () => {},
			warn: () => {}
		};
		sandbox.stub(FakeLogger, 'debug');
		sandbox.stub(FakeLogger, 'error');
		sandbox.stub(FakeLogger, 'warn');
		revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#BlockDecoder.decode', () => {
		it('should throw error if not given a byte buffer', () => {
			(() => {
				BlockDecoderRewire.decode(new Uint8Array(2));
			}).should.throw(/Block input data is not a byte buffer/);
		});

		it('should parse genesis block with IMPLICIT_META type', () => {
			const block = BlockDecoderRewire.decode(data);
			const type = block.data.data[0].payload.data.config.channel_group.policies.Writers.policy.type;
			type.should.equal('IMPLICIT_META');
		});

		it('should throw and log error object', () => {
			revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
			revert.push(BlockDecoderRewire.__set__('_commonProto.Block.decode', () => {
				throw new Error('MockError');
			}));

			(() => {
				BlockDecoderRewire.decode(data);
			}).should.throw(/MockError/);
			sinon.assert.calledOnce(FakeLogger.error);
		});

		it('should throw and log string', () => {
			revert.push(BlockDecoderRewire.__set__('_commonProto.Block.decode', () => {
				throw 'Error';
			}));

			(() => {
				BlockDecoderRewire.decode(data);
			}).should.throw(/Error/);
			sinon.assert.called(FakeLogger.error);
		});
	});

	describe('#BlockDecoder.decodeBlock', () => {
		const blockData = {
			header: {number: 0, previous_hash: 'previous_hash', data_hash: 'data_hash'}
		};
		beforeEach(() => {
			revert.push(BlockDecoderRewire.__set__('decodeBlockData', () => {}));
		});

		it('should throw error if block input data is missing', () => {
			(() => {
				BlockDecoderRewire.decodeBlock();
			}).should.throw(/Block input data is missing/);
		});

		it('should decode Block object', () => {
			revert.push(BlockDecoderRewire.__set__('decodeBlockMetaData', () => {}));
			const block = BlockDecoderRewire.decodeBlock(blockData);

			block.header.should.deep.equal({
				number: '0',
				previous_hash: 'previous_hash',
				data_hash: 'data_hash'
			});
			should.not.exist(block.data);
			should.not.exist(block.metadata);
		});

		it('should throw and log error object', () => {
			revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
			revert.push(BlockDecoderRewire.__set__('decodeBlockMetaData', () => {
				throw new Error('MockError');
			}));

			(() => {
				BlockDecoderRewire.decodeBlock(blockData);
			}).should.throw();
			sinon.assert.calledOnce(FakeLogger.error);
		});

		it('should throw and log string', () => {
			revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
			revert.push(BlockDecoderRewire.__set__('decodeBlockMetaData', () => {
				throw 'Error';
			}));

			(() => {
				BlockDecoderRewire.decodeBlock(blockData);
			}).should.throw();
			sinon.assert.calledOnce(FakeLogger.error);
		});
	});

	describe('#BlockDecoder.decodeTransaction', () => {
		beforeEach(() => {
			revert.push(BlockDecoderRewire.__set__('_transProto.ProcessedTransaction.decode', () => {
				const stub = {
					getValidationCode() {},
					getTransactionEnvelope() {}
				};
				sandbox.stub(stub, 'getValidationCode').returns('validationCode');
				sandbox.stub(stub, 'getTransactionEnvelope').returns('transactionEnvelope');
				return stub;
			}));

			revert.push(BlockDecoderRewire.__set__('decodeBlockDataEnvelope', (value) => {
				return value;
			}));
		});
		it('should throw error if not given a byte buffer', () => {
			(() => {
				BlockDecoderRewire.decodeTransaction(new Uint8Array(2));
			}).should.throw(/Proccesed transaction data is not a byte buffer/);
		});

		it('should generate a processed transaction', () => {
			const processedtransaction = BlockDecoderRewire.decodeTransaction(data);
			processedtransaction.validationCode.should.equal('validationCode');
			processedtransaction.transactionEnvelope.should.equal('transactionEnvelope');
		});
	});

	describe('#decodeBlockHeader', () => {
		let decodeBlockHeader;

		let getNumberStub;
		let getPreviousHashStub;
		let getDataHashStub;
		before(() => {
			decodeBlockHeader = BlockDecoderRewire.__get__('decodeBlockHeader');
		});

		beforeEach(() => {
			getNumberStub = sandbox.stub();
			getPreviousHashStub = sandbox.stub();
			getDataHashStub = sandbox.stub();

		});

		it('should return a decoded block header', () => {
			const protoBlockHeader = {
				getNumber: getNumberStub.returns(0),
				getPreviousHash: getPreviousHashStub.returns({toBuffer: () => {
					return {toString: () => 'previous-hash'};
				}}),
				getDataHash: getDataHashStub.returns({toBuffer: () => {
					return {toString: () => 'data-hash'};
				}})
			};
			const result = decodeBlockHeader(protoBlockHeader);
			sinon.assert.called(getNumberStub);
			sinon.assert.called(getPreviousHashStub);
			sinon.assert.called(getDataHashStub);
			result.should.deep.equal({number: '0', previous_hash: 'previous-hash', data_hash: 'data-hash'});
		});
	});

	describe('#decodeBlockData', () => {
		let decodeBlockData;
		let decodeStub;
		beforeEach(() => {
			decodeBlockData = BlockDecoderRewire.__get__('decodeBlockData');
			decodeStub = sandbox.stub();
			decodeStub.returns('envelope');
			revert.push(BlockDecoderRewire.__set__('decodeBlockDataEnvelope', (value) => value));
			revert.push(BlockDecoderRewire.__set__('_commonProto.Envelope.decode', decodeStub));
		});

		it('should call _commonProto.Envelope.decode with buffer twice', () => {
			const protoBlockData = {
				data: {
					key1: {toBuffer() {}},
					key2: {toBuffer() {}}
				}
			};
			const newData = decodeBlockData(protoBlockData);
			sinon.assert.calledTwice(decodeStub);
			newData.data.should.deep.equal(['envelope', 'envelope']);
		});

		it('should call _commonProto.Envelope.decode with no proto', () => {
			const protoBlockData = {
				data: [{}]
			};
			const newData = decodeBlockData(protoBlockData, true);
			sinon.assert.calledOnce(decodeStub);
			newData.data.should.deep.equal(['envelope']);
		});
	});

	describe('#decodeBlockMetaData', () => {
		let decodeBlockMetaData;

		let decodeMetadataSignaturesStub;
		let decodeLastConfigSequenceNumberStub;
		let decodeTransactionFilterStub;
		before(() => {
			decodeBlockMetaData = BlockDecoderRewire.__get__('decodeBlockMetaData');
		});

		beforeEach(() => {
			decodeMetadataSignaturesStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeMetadataSignatures', decodeMetadataSignaturesStub));
			decodeLastConfigSequenceNumberStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeLastConfigSequenceNumber', decodeLastConfigSequenceNumberStub));
			decodeTransactionFilterStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeTransactionFilter', decodeTransactionFilterStub));
		});

		it('should return the correct meta data with no paramaters', () => {
			const metadata = decodeBlockMetaData();
			metadata.metadata.should.deep.equal([]);
		});

		it('should populate the metadata', () => {
			decodeMetadataSignaturesStub.returns('decoded-metadata-signatures');
			decodeLastConfigSequenceNumberStub.returns('decoded-last-config-sequence-number');
			decodeTransactionFilterStub.returns('decoded-transaction-filter');

			const protoBlockMetadata = {metadata: ['metadata-signature', 'last-config-sequence-number', 'transaction-filter']};
			const result = decodeBlockMetaData(protoBlockMetadata);
			sinon.assert.calledWith(decodeMetadataSignaturesStub, 'metadata-signature');
			sinon.assert.calledWith(decodeLastConfigSequenceNumberStub, 'last-config-sequence-number');
			sinon.assert.calledWith(decodeTransactionFilterStub, 'transaction-filter');
			result.should.deep.equal({metadata: ['decoded-metadata-signatures', 'decoded-last-config-sequence-number', 'decoded-transaction-filter']});
		});
	});

	describe('#decodeTransactionFilter', () => {
		let decodeTransactionFilter;

		before(() => {
			decodeTransactionFilter = BlockDecoderRewire.__get__('decodeTransactionFilter');
		});

		it('should return null if metadata_bytes not given', () => {
			should.not.exist(decodeTransactionFilter());
		});

		it('should convert a not buffer to a buffer if string given', () => {
			const notBuffer = {toBuffer() {}};
			sandbox.stub(notBuffer, 'toBuffer').returns([]);
			decodeTransactionFilter(notBuffer);
			sinon.assert.called(notBuffer.toBuffer);
		});

		it('should add each value in metadata_bytes to transaction_filter', () => {
			const buffer = new Buffer('1');
			const transactionFilter = decodeTransactionFilter(buffer);
			transactionFilter.should.deep.equal([49]);
		});
	});

	describe('#decodeLastConfigSequenceNumber', () => {
		let decodeLastConfigSequenceNumber;
		before(() => {
			decodeLastConfigSequenceNumber = BlockDecoderRewire.__get__('decodeLastConfigSequenceNumber');
		});

		it ('should return an object with value property if metadata_bytes not given', () => {
			const result = decodeLastConfigSequenceNumber();
			result.should.deep.equal({value: {}});
		});
	});

	describe('#decodeMetadataSignatures', () => {
		let decodeMetadataSignatures;

		let metadataDecodeStub;
		let getValueStub;
		let decodeMetadataValueSignaturesStub;
		before(() => {
			decodeMetadataSignatures = BlockDecoderRewire.__get__('decodeMetadataSignatures');
		});

		beforeEach(() => {
			metadataDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_commonProto.Metadata.decode', metadataDecodeStub));
			getValueStub = sandbox.stub();
			decodeMetadataValueSignaturesStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeMetadataValueSignatures', decodeMetadataValueSignaturesStub));
			metadataDecodeStub.returns({getValue: getValueStub, signatures: 'signatures'});
		});

		it('should decode the metadata signatures and call decodeMetadataValueSignatures', () => {
			getValueStub.returns({toBuffer: () => {
				return {toString: () => 'value'};
			}});
			decodeMetadataValueSignaturesStub.returns('decoded-signatures');
			const metadataBytes = 'metadata-bytes';
			const result = decodeMetadataSignatures(metadataBytes);
			sinon.assert.calledWith(metadataDecodeStub, metadataBytes);
			sinon.assert.called(getValueStub);
			sinon.assert.calledWith(decodeMetadataValueSignaturesStub, 'signatures');
			result.should.deep.equal({value: 'value', signatures: 'decoded-signatures'});
		});
	});

	describe('#decodeMetadataValueSignatures', () => {
		let decodeMetadataValueSignatures;
		beforeEach(() => {
			decodeMetadataValueSignatures = BlockDecoderRewire.__get__('decodeMetadataValueSignatures;');
			revert.push(BlockDecoderRewire.__set__('_commonProto.MetadataSignature.decode', () => {
				return {getSignatureHeader: () => 'signature-header', getSignature: () => {
					return {toBuffer: () => 'signature'};
				}};
			}));
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', (value) => value));
		});

		it('should return an empty array if no meta signatures are given', () => {
			decodeMetadataValueSignatures().should.be.empty;
		});

		it('should create return a list of signatures', () => {
			const metaSignature = {toBuffer: () => 'meta-signature'};
			const signatures = decodeMetadataValueSignatures([metaSignature]);
			signatures[0].should.deep.equal({
				signature_header: 'signature-header',
				signature: 'signature'
			});
		});
	});

	describe('#decodeBlockDataEnvelope', () => {
		let decodeBlockDataEnvelope;

		let getSignatureStub;
		let payloadDecodeStub;
		let decodeHeaderStub;
		let getHeaderStub;
		let decodePayloadBasedOnTypeStub;
		let getDataStub;
		let convertToStringStub;
		let getPayloadStub;
		before(() => {
			decodeBlockDataEnvelope = BlockDecoderRewire.__get__('decodeBlockDataEnvelope');
		});

		beforeEach(() => {
			getSignatureStub = sandbox.stub();
			payloadDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_commonProto.Payload.decode', payloadDecodeStub));
			decodeHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHeader', decodeHeaderStub));
			getHeaderStub = sandbox.stub();
			decodePayloadBasedOnTypeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('HeaderType.decodePayloadBasedOnType', decodePayloadBasedOnTypeStub));
			getDataStub = sandbox.stub();
			convertToStringStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('HeaderType.convertToString', convertToStringStub));
			getPayloadStub = sandbox.stub();
		});

		it('should return the decoded envelope', () => {
			getSignatureStub.returns({toBuffer: () => 'signature'});
			getDataStub.returns({toBuffer: () => 'data'});
			getPayloadStub.returns({toBuffer: () => 'payload'});
			getHeaderStub.returns('header');
			decodeHeaderStub.returns({channel_header: {type: 'channel-header-type'}});
			payloadDecodeStub.returns({getHeader: getHeaderStub, getData: getDataStub});
			decodePayloadBasedOnTypeStub.returns('data');
			convertToStringStub.returns('typeString');
			const protoEnvelope = {getSignature: getSignatureStub, getPayload: getPayloadStub};
			const result = decodeBlockDataEnvelope(protoEnvelope);
			sinon.assert.called(getSignatureStub);
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(decodeHeaderStub, 'header');
			sinon.assert.called(getHeaderStub);
			sinon.assert.calledWith(decodePayloadBasedOnTypeStub, 'data', 'channel-header-type');
			sinon.assert.calledWith(convertToStringStub, 'channel-header-type');
			result.should.deep.equal({
				payload: {
					header: {
						channel_header: {
							type: 'channel-header-type',
							typeString: 'typeString'
						}
					},
					data: 'data'
				},
				signature: 'signature'
			});
		});
	});

	describe('#decodeEndorserTransaction', () => {
		let decodeEndorserTransaction;

		before(() => {
			decodeEndorserTransaction = BlockDecoderRewire.__get__('decodeEndorserTransaction');
		});

		it('should log an error when an error is thrown', () => {
			revert.push(BlockDecoderRewire.__set__('_transProto.Transaction.decode', () => {
				throw new Error();
			}));
			const newData = decodeEndorserTransaction();
			sinon.assert.called(FakeLogger.error);
			newData.should.deep.equal({});
		});

		it('should add actions to data when transaction with actions is given', () => {
			const mockAction = {header: 'header', payload: 'payload'};
			const decodeSignatureheaderStub = sandbox.stub().returns('header');
			const decodeChaincodeActionPayloadStub = sandbox.stub().returns('payload');
			revert.push(BlockDecoderRewire.__set__('_transProto.Transaction.decode', () => {
				return {actions: [mockAction]};
			}));
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', decodeSignatureheaderStub));
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeActionPayload', decodeChaincodeActionPayloadStub));

			const newData = decodeEndorserTransaction('trans_bytes');
			newData.actions.should.have.lengthOf(1);
			sinon.assert.called(decodeSignatureheaderStub);
			sinon.assert.called(decodeChaincodeActionPayloadStub);
		});

		it('should return an empty object if transaction is not given', () => {
			revert.push(BlockDecoderRewire.__set__('_transProto.Transaction.decode', () => {
				return null;
			}));

			const newData = decodeEndorserTransaction('trans_bytes');
			newData.should.deep.equal({actions: []});
		});

		it('should return an empty object if transaction is given with no actions', () => {
			revert.push(BlockDecoderRewire.__set__('_transProto.Transaction.decode', () => {
				return {};
			}));

			const newData = decodeEndorserTransaction('trans_bytes');
			newData.should.deep.equal({actions: []});
		});
	});

	describe('#decodeConfigEnvelope', () => {
		let decodeConfigEnvelope;
		let configEnvelopeDecodeStub;
		let decodeConfigStub;
		let decodeHeaderStub;
		let decodeConfigUpdateEnvelopeStub;
		before(() => {
			decodeConfigEnvelope = BlockDecoderRewire.__get__('decodeConfigEnvelope');
		});

		beforeEach(() => {
			configEnvelopeDecodeStub = sandbox.stub().returns({
				getConfig: () => 'config',
				getLastUpdate: () => {
					return {
						getPayload: () => {
							return {toBuffer: () => 'payload'};
						},
						getSignature: () => {
							return {toBuffer: () => 'signature'};
						}
					};
				}
			});
			revert.push(BlockDecoderRewire.__set__('_configtxProto.ConfigEnvelope.decode', configEnvelopeDecodeStub));
			decodeConfigStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfig', decodeConfigStub));
			decodeHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHeader', decodeHeaderStub));
			decodeConfigUpdateEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdateEnvelope', decodeConfigUpdateEnvelopeStub));
		});

		it('should return the correct config envelope', () => {
			decodeConfigStub.returns('config');
			decodeHeaderStub.returns('header');
			decodeConfigUpdateEnvelopeStub.returns('data');
			const configEnvelope = decodeConfigEnvelope({});

			configEnvelope.last_update.payload.header.should.equal('header');
			configEnvelope.last_update.payload.data.should.equal('data');
			configEnvelope.last_update.signature.should.equal('signature');
		});
	});

	describe('#decodeConfig', () => {
		let decodeConfig;

		let decodeConfigGroupStub;
		let getSequenceStub;
		let getChannelGroupStub;
		before(() => {
			decodeConfig = BlockDecoderRewire.__get__('decodeConfig');
		});

		beforeEach(() => {
			decodeConfigGroupStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroup', decodeConfigGroupStub));
			getSequenceStub = sandbox.stub();
			getChannelGroupStub = sandbox.stub();
		});

		it('should decode the config given', () => {
			getSequenceStub.returns(0);
			decodeConfigGroupStub.returns('decoded-config-group');
			getChannelGroupStub.returns('channel-group');
			const protoConfig = {getSequence: getSequenceStub, getChannelGroup: getChannelGroupStub};
			const result = decodeConfig(protoConfig);
			sinon.assert.called(getSequenceStub);
			sinon.assert.called(getChannelGroupStub);
			sinon.assert.calledWith(decodeConfigGroupStub, 'channel-group');
			result.should.deep.equal({'sequence': '0', channel_group: 'decoded-config-group'});
		});
	});

	describe('#decodeConfigUpdateEnvelope', () => {
		let decodeConfigUpdateEnvelope;
		let configUpdateEnvelopeStub;
		let decodeConfigUpdateStub;
		let decodeConfigSignatureStub;
		before(() => {
			decodeConfigUpdateEnvelope = BlockDecoderRewire.__get__('decodeConfigUpdateEnvelope');
		});

		beforeEach(() => {
			configUpdateEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_configtxProto.ConfigUpdateEnvelope.decode', configUpdateEnvelopeStub));
			decodeConfigUpdateStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdate', decodeConfigUpdateStub));
			decodeConfigSignatureStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigSignature', decodeConfigSignatureStub));
		});

		it('should return the config update envelope', () => {
			configUpdateEnvelopeStub.returns({
				getConfigUpdate: () => {
					return {toBuffer: () => 'config-update'};
				},
				signatures: ['signature']
			});
			decodeConfigSignatureStub.returns('config-signature');
			decodeConfigUpdateStub.returns('config-update');
			const configUpdateEnvelope = decodeConfigUpdateEnvelope({signatures: ['signature']});
			configUpdateEnvelope.config_update.should.equal('config-update');
			configUpdateEnvelope.signatures.should.have.lengthOf(1);
			configUpdateEnvelope.signatures[0].should.equal('config-signature');
		});
	});

	describe('#decodeConfigUpdate', () => {
		let decodeConfigUpdate;
		let configUpdateDecodeStub;
		let decodeConfigGroupStub;
		before(() => {
			decodeConfigUpdate = BlockDecoderRewire.__get__('decodeConfigUpdate');
		});

		beforeEach(() => {
			configUpdateDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_configtxProto.ConfigUpdate.decode', configUpdateDecodeStub));
			decodeConfigGroupStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroup', decodeConfigGroupStub));
		});

		it('should create the correct config update', () => {
			configUpdateDecodeStub.returns({
				getChannelId: () => 'channel-id',
				getReadSet: () => 'read-set',
				getWriteSet: () => 'write-set',
			});
			decodeConfigGroupStub.onFirstCall().returns('read-set');
			decodeConfigGroupStub.onSecondCall().returns('write-set');
			const configUpdate = decodeConfigUpdate({});
			configUpdate.channel_id.should.equal('channel-id');
			configUpdate.read_set.should.equal('read-set');
			configUpdate.write_set.should.equal('write-set');
			sinon.assert.calledWith(configUpdateDecodeStub, {});
			sinon.assert.calledWith(decodeConfigGroupStub, 'read-set');
			sinon.assert.calledWith(decodeConfigGroupStub, 'write-set');
		});
	});

	describe('#decodeConfigGroups', () => {
		let decodeConfigGroups;

		let decodeConfigGroupStub;
		before(() => {
			decodeConfigGroups = BlockDecoderRewire.__get__('decodeConfigGroups');
		});

		beforeEach(() => {
			decodeConfigGroupStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroup', decodeConfigGroupStub));
		});

		it('should return an empty object when no proto group config given', () => {
			const result = decodeConfigGroups({map: {}});
			result.should.deep.equal({});
		});

		it('should call decodeConfigGroup for each group', () => {
			decodeConfigGroupStub.returns('value');
			const configGroupMap = {map: {'key1': 'value1', 'key2': 'value2'}};
			const result = decodeConfigGroups(configGroupMap);
			sinon.assert.calledTwice(decodeConfigGroupStub);
			result.should.deep.equal({'key1': 'value', 'key2': 'value'});
		});
	});

	describe('#decodeConfigGroup', () => {
		let decodeConfigGroup;

		before(() => {
			decodeConfigGroup = BlockDecoderRewire.__get__('decodeConfigGroup');
		});

		it('should return null when no proto_config_group is given', () => {
			const configGroup = decodeConfigGroup();
			should.equal(configGroup, null);
		});
	});

	describe('#decodeConfigValues', () => {
		let decodeConfigValues;

		let decodeConfigValueStub;
		before(() => {
			decodeConfigValues = BlockDecoderRewire.__get__('decodeConfigValues');
		});

		beforeEach(() => {
			decodeConfigValueStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigValue', decodeConfigValueStub));
		});

		it('should call decodeConfigValue for each key in config_value_map', () => {
			decodeConfigValueStub.returns('value');
			const configValueMap = {map: {'key1': 'value1', 'key2': 'value2'}};
			const result = decodeConfigValues(configValueMap);
			sinon.assert.calledTwice(decodeConfigValueStub);
			result.should.deep.equal({'key1': 'value', 'key2': 'value'});
		});
	});

	describe('#decodeConfigValue', () => {
		let decodeConfigValue;
		let decodeVersionStub;
		let protoConfigValue;
		let peerConfigurationProtoDecodeStub;
		before(() => {
			decodeConfigValue = BlockDecoderRewire.__get__('decodeConfigValue');
		});

		beforeEach(() => {
			decodeVersionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeVersion', decodeVersionStub));
			peerConfigurationProtoDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_peerConfigurationProto.AnchorPeers.decode', peerConfigurationProtoDecodeStub));
			protoConfigValue = {
				key: '',
				value: {
					getVersion: sandbox.stub(),
					getModPolicy: sandbox.stub()
				}
			};
		});

		it('should return the correct config value for AnchorPeers', () => {
			protoConfigValue.key = 'AnchorPeers';
			peerConfigurationProtoDecodeStub.returns({anchor_peers: [
				{host: 'host', port: 'port'}
			]});

			const configValue = decodeConfigValue(protoConfigValue);
			configValue.value.anchor_peers.should.deep.equal([{host: 'host', port: 'port'}]);
		});

		it('should return an empty config for AnchorPeers when no anchor peers given', () => {
			protoConfigValue.key = 'AnchorPeers';

			const configValue = decodeConfigValue(protoConfigValue);
			configValue.value.anchor_peers.should.deep.equal([]);
		});

		it('should return the correct config value for MSP when config type is 0', () => {
			const getTypeStub = sandbox.stub();
			const getConfigStub = sandbox.stub();
			const decodeFabricMSPConfigStub = sandbox.stub();
			const mspConfigProtoDecodeStub = () => {
				return {type: 0, getType: getTypeStub, getConfig: getConfigStub};
			};
			getTypeStub.returns(0);
			getConfigStub.returns('config');
			decodeFabricMSPConfigStub.returns('decoded-config');
			revert.push(BlockDecoderRewire.__set__('_mspConfigProto.MSPConfig.decode', mspConfigProtoDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeFabricMSPConfig', decodeFabricMSPConfigStub));

			protoConfigValue.key = 'MSP';
			const configValue = decodeConfigValue(protoConfigValue);
			sinon.assert.called(getTypeStub);
			sinon.assert.called(getConfigStub);
			sinon.assert.calledWith(decodeFabricMSPConfigStub, 'config');
			configValue.value.type.should.equal(0);
			configValue.value.config.should.equal('decoded-config');
		});

		it('should return the correct config value for MSP when config type is not 0', () => {
			const getTypeStub = sandbox.stub();
			const getConfigStub = sandbox.stub();
			const decodeFabricMSPConfigStub = sandbox.stub();
			const mspConfigProtoDecodeStub = () => {
				return {type: 1, getType: getTypeStub, getConfig: getConfigStub};
			};
			getTypeStub.returns(1);
			getConfigStub.returns('config');
			decodeFabricMSPConfigStub.returns('decoded-config');
			revert.push(BlockDecoderRewire.__set__('_mspConfigProto.MSPConfig.decode', mspConfigProtoDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeFabricMSPConfig', decodeFabricMSPConfigStub));

			protoConfigValue.key = 'MSP';
			const configValue = decodeConfigValue(protoConfigValue);
			sinon.assert.called(getTypeStub);
			sinon.assert.notCalled(getConfigStub);
			sinon.assert.notCalled(decodeFabricMSPConfigStub);
			configValue.value.type.should.equal(1);
			configValue.value.config.should.deep.equal({});
		});

		it('should return the correct config value for Consortium', () => {
			const commonConfigurationProtoStub = sandbox.stub();
			const getNameStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_commonConfigurationProto.Consortium.decode', commonConfigurationProtoStub));
			commonConfigurationProtoStub.returns({getName: getNameStub});
			getNameStub.returns('name');

			protoConfigValue.key = 'Consortium';
			const configValue = decodeConfigValue(protoConfigValue);
			sinon.assert.calledWith(commonConfigurationProtoStub, protoConfigValue.value.value);
			sinon.assert.called(getNameStub);
			configValue.value.name.should.equal('name');
		});

		it('should return the correct config value for OrdererAddresses when no proto addresses are found', () => {
			const commonConfigurationProtoStub = sandbox.stub();
			const getAddressesStub = sandbox.stub();
			commonConfigurationProtoStub.returns({getAddresses: getAddressesStub});
			getAddressesStub.returns(null);
			revert.push(BlockDecoderRewire.__set__('_commonConfigurationProto.OrdererAddresses.decode', commonConfigurationProtoStub));

			protoConfigValue.key = 'OrdererAddresses';
			const configValue = decodeConfigValue(protoConfigValue);
			configValue.value.addresses.should.deep.equal([]);
		});
	});

	describe('#decodeConfigPolicies', () => {
		let decodeConfigPolicies;

		let decodeConfigPolicyStub;
		before(() => {
			decodeConfigPolicies = BlockDecoderRewire.__get__('decodeConfigPolicies');
		});

		beforeEach(() => {
			decodeConfigPolicyStub = sinon.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigPolicy', decodeConfigPolicyStub));
		});

		it('should call deocdeConfigPolicy twice', () => {
			decodeConfigPolicyStub.returns('value');
			const configPolicyMap = {map: {'key1': 'value1', 'key2': 'value2'}};
			const result = decodeConfigPolicies(configPolicyMap);
			sinon.assert.calledTwice(decodeConfigPolicyStub);
			result.should.deep.equal({'key1': 'value', 'key2': 'value'});
		});
	});

	describe('#decodeConfigPolicy', () => {
		let decodeConfigPolicy;
		let protoConfigPolicy;
		before(() => {
			decodeConfigPolicy = BlockDecoderRewire.__get__('decodeConfigPolicy');
		});

		beforeEach(() => {
			protoConfigPolicy = {
				key: '',
				value: {
					getVersion: sandbox.stub().returns('version'),
					getModPolicy: sandbox.stub().returns('mod-policy'),
					policy: {}
				},
			};
		});

		it('should return the correct config policy if no policy is given', () => {
			revert.push(BlockDecoderRewire.__set__('decodeVersion', (value) => value));
			protoConfigPolicy.value.policy = null;
			const configPolicy = decodeConfigPolicy(protoConfigPolicy);
			sinon.assert.called(protoConfigPolicy.value.getVersion);
			sinon.assert.called(protoConfigPolicy.value.getModPolicy);
			configPolicy.version.should.equal('version');
			configPolicy.mod_policy.should.equal('mod-policy');
			configPolicy.policy.should.deep.equal({});
		});

		it('should return the correct config polict if plicy is MSP', () => {
			const policy = 'MSP';
			revert.push(BlockDecoderRewire.__set__('_policiesProto.Policy.PolicyType.MSP', policy));
			protoConfigPolicy.value.policy.type = policy;
			decodeConfigPolicy(protoConfigPolicy);
			sinon.assert.called(FakeLogger.warn);
		});

		it('should throw error if it doesnt recognise the policy type', () => {
			protoConfigPolicy.value.policy.type = 'unknown-policy';
			(() => {
				decodeConfigPolicy(protoConfigPolicy);
			}).should.throw(/Unknown Policy type/);
		});
	});

	describe('#decodeImplicitMetaPolicy', () => {
		let decodeImplicitMetaPolicy;

		let implicitMetaPolicyDecodeStub;
		let getSubPolicyStub;
		let getRuleStub;
		before(() => {
			decodeImplicitMetaPolicy = BlockDecoderRewire.__get__('decodeImplicitMetaPolicy');
			revert.push(BlockDecoderRewire.__set__('ImplicitMetaPolicy_Rule', ['ANY', 'ALL', 'MAJORITY']));
		});

		beforeEach(() => {
			implicitMetaPolicyDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__(' _policiesProto.ImplicitMetaPolicy.decode', implicitMetaPolicyDecodeStub));
			getSubPolicyStub = sandbox.stub();
			getRuleStub = sandbox.stub();

			implicitMetaPolicyDecodeStub.returns({getSubPolicy: getSubPolicyStub, getRule: getRuleStub});
		});

		it('should decode the implicit meta policy', () => {
			getSubPolicyStub.returns('sub-policy');
			getRuleStub.returns(0);
			const implicitMetaPolicyBytes = 'implicit_meta_policy_bytes';
			const result = decodeImplicitMetaPolicy(implicitMetaPolicyBytes);
			sinon.assert.calledWith(implicitMetaPolicyDecodeStub, implicitMetaPolicyBytes);
			sinon.assert.called(getSubPolicyStub);
			sinon.assert.called(getRuleStub);
			result.should.deep.equal({sub_policy: 'sub-policy', rule: 'ANY'});
		});
	});

	describe('#decodeSignaturePolicyEnvelope', () => {
		let decodeSignaturePolicyEnvelope;

		let signaturePolicyEnvelopeStub;
		let decodeVersionStub;
		let decodeSignaturePolicyStub;
		let getIdentitiesStub;
		let getVersionStub;
		let getRuleStub;
		before(() => {
			decodeSignaturePolicyEnvelope = BlockDecoderRewire.__get__('decodeSignaturePolicyEnvelope');
		});

		beforeEach(() => {
			signaturePolicyEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_policiesProto.SignaturePolicyEnvelope.decode', signaturePolicyEnvelopeStub));
			decodeVersionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeVersion', decodeVersionStub));
			decodeSignaturePolicyStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeSignaturePolicy', decodeSignaturePolicyStub));
			getIdentitiesStub = sandbox.stub();
			getVersionStub = sandbox.stub();
			getRuleStub = sandbox.stub();
		});

		it('should return the correct signature policy envelope without identities given', () => {
			const decodedSignaurePolicyEnvelope = {
				getIdentities: getIdentitiesStub.returns(null),
				getVersion: getVersionStub.returns(1),
				getRule: getRuleStub.returns('rule')
			};
			signaturePolicyEnvelopeStub.returns(decodedSignaurePolicyEnvelope);
			decodeSignaturePolicyEnvelope({});
			sinon.assert.called(getVersionStub);
			sinon.assert.calledWith(decodeVersionStub, 1);
			sinon.assert.called(getRuleStub);
			sinon.assert.calledWith(decodeSignaturePolicyStub, 'rule');
			sinon.assert.called(getIdentitiesStub);
		});
	});

	describe('#decodeSignaturePolicy', () => {
		let decodeSignaturePolicy;
		before(() => {
			decodeSignaturePolicy = BlockDecoderRewire.__get__('decodeSignaturePolicy');
		});

		it('should throw error when unknown signature policy is given', () => {
			const protoSignaturePolicy = {Type:'unknown', n_out_of: {getN: () => {}}};
			(() => {
				decodeSignaturePolicy(protoSignaturePolicy);
			}).should.throw(/unknown signature policy type/);
		});
	});

	describe('#decodeMSPPrincipal', () => {
		let decodeMSPPrincipal;
		let protoMspPrincipal;
		before(() => {
			decodeMSPPrincipal = BlockDecoderRewire.__get__('decodeMSPPrincipal');
		});

		beforeEach(() => {
			protoMspPrincipal = {
				getPrincipalClassification: sandbox.stub(),
				getPrincipal: sandbox.stub()
			};
		});

		it('should return the correct msp principal with role other than 0 or 1', () => {
			const mspPrProtoRoleDecodeStub = sandbox.stub();
			const getMspIdentifierstub = sandbox.stub();
			const getRoleStub = sandbox.stub();
			mspPrProtoRoleDecodeStub.returns({getMspIdentifier: getMspIdentifierstub, getRole: getRoleStub});
			const role = 10;
			protoMspPrincipal.getPrincipalClassification.returns(role);
			revert.push(BlockDecoderRewire.__set__('_mspPrProto.MSPPrincipal.Classification.ROLE', role));
			revert.push(BlockDecoderRewire.__set__('_mspPrProto.MSPRole.decode', mspPrProtoRoleDecodeStub));

			const mspPrincipal = decodeMSPPrincipal(protoMspPrincipal);
			mspPrincipal.principal_classification.should.equal(role);
		});

		it('should return the correct msp principal with principal_classification ORGANISATION_UNIT', () => {
			const principalClassification = 'ORGANISATION_UNIT';
			revert.push(BlockDecoderRewire.__set__('_mspPrProto.MSPPrincipal.Classification.ORGANIZATION_UNIT', principalClassification));
			const unitOrgDecoderStub = sandbox.stub().returns({
				getCertificiersIdentifier: sandbox.stub(),
				getMspIdentifier: () => 'msp-identifier',
				getOrganizationalUnitIdentifier: () => 'organizational-unit-identifier',
				getCertifiersIdentifier: () => {
					return {toBuffer: () => 'certifiers-identifier'};
				}
			});
			revert.push(BlockDecoderRewire.__set__('_mspPrProto.OrganizationUnit.decode', unitOrgDecoderStub));
			protoMspPrincipal.getPrincipalClassification.returns(principalClassification);
			const mspPrProtoOrganizationUnitDecodeStub = sandbox.stub();
			const getMspIdentifierstub = sandbox.stub();
			const getRoleStub = sandbox.stub();
			mspPrProtoOrganizationUnitDecodeStub.returns({getMspIdentifier: getMspIdentifierstub, getRole: getRoleStub});

			const mspPrincipal = decodeMSPPrincipal(protoMspPrincipal);
			mspPrincipal.msp_identifier.should.equal('msp-identifier');
			mspPrincipal.organizational_unit_identifier.should.equal('organizational-unit-identifier');
			mspPrincipal.certifiers_identifier.should.equal('certifiers-identifier');
		});

		it('should return the correct msp principal with principal_clasification IDENTITY', () => {
			const principalClassification = 'IDENTITY';
			protoMspPrincipal.getPrincipalClassification.returns(principalClassification);
			revert.push(BlockDecoderRewire.__set__('_mspPrProto.MSPPrincipal.Classification.IDENTITY', principalClassification));
			const decodeIdentityStub = sandbox.stub();
			decodeIdentityStub.returns('identity');
			revert.push(BlockDecoderRewire.__set__('decodeIdentity', decodeIdentityStub));

			protoMspPrincipal.getPrincipal.returns('principal');

			const mspPrincipal = decodeMSPPrincipal(protoMspPrincipal);
			sinon.assert.calledWith(decodeIdentityStub, 'principal');
			mspPrincipal.should.equal('identity');
		});
	});

	describe('#decodeConfigSignature', () => {
		let decodeConfigSignature;
		before(() => {
			decodeConfigSignature = BlockDecoderRewire.__get__('decodeConfigSignature');
		});

		it('should return the correct decoded config signature', () => {
			const decodeSignatureHeaderStub = sandbox.stub();
			decodeSignatureHeaderStub.returns('signature-header');
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', decodeSignatureHeaderStub));
			const protoConfigSignature = {
				getSignatureHeader: sandbox.stub().returns({toBuffer: () => 'signature-header'}),
				getSignature: sandbox.stub().returns({toBuffer: () => 'signature'})
			};

			const configSignature = decodeConfigSignature(protoConfigSignature);
			sinon.assert.called(protoConfigSignature.getSignatureHeader);
			sinon.assert.called(protoConfigSignature.getSignature);
			sinon.assert.called(decodeSignatureHeaderStub);
			configSignature.signature_header.should.equal('signature-header');
			configSignature.sigature.should.equal('signature'); // Spelling mistake
		});
	});

	describe('#decodeSignatureHeader', () => {
		let decodeSignatureHeader;

		let signatureHeaderDecodeStub;
		let decodeIdentityStub;
		let getCreatorStub;
		let getNonceStub;
		before(() => {
			decodeSignatureHeader = BlockDecoderRewire.__get__('decodeSignatureHeader');
		});

		beforeEach(() => {
			signatureHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_commonProto.SignatureHeader.decode', signatureHeaderDecodeStub));
			decodeIdentityStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeIdentity', decodeIdentityStub));
			getCreatorStub = sandbox.stub();
			getNonceStub = sandbox.stub();
			signatureHeaderDecodeStub.returns({getCreator: getCreatorStub, getNonce: getNonceStub});
		});

		it('should decode the signature header and identity before returning decoded signature header', () => {
			getCreatorStub.returns({toBuffer: () => 'creator'});
			getNonceStub.returns({toBuffer: () => 'nonce'});
			decodeIdentityStub.returns('identity');
			const signatureHeaderBytes = 'signature-header-bytes';
			const result = decodeSignatureHeader(signatureHeaderBytes);

			sinon.assert.calledWith(signatureHeaderDecodeStub, signatureHeaderBytes);
			sinon.assert.calledWith(decodeIdentityStub, 'creator');
			sinon.assert.called(getCreatorStub);
			sinon.assert.called(getNonceStub);
			result.should.deep.equal({creator: 'identity', nonce: 'nonce'});
		});
	});

	describe('#decodeIdentity', () => {
		let decodeIdentity;

		let signatureHeaderDecodeStub;
		let getIdBytesStub;
		let getMspidStub;
		before(() => {
			decodeIdentity = BlockDecoderRewire.__get__('decodeIdentity');
		});

		beforeEach(() => {
			signatureHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_identityProto.SerializedIdentity.decode', signatureHeaderDecodeStub));
			getIdBytesStub = sandbox.stub();
			getMspidStub = sandbox.stub();
			signatureHeaderDecodeStub.returns({getMspid: getMspidStub, getIdBytes: getIdBytesStub});
		});

		it('should return a decoded identity', () => {
			getIdBytesStub.returns({toBuffer: () => 0});
			getMspidStub.returns('msp-id');
			const identityBytes = 'identity-bytes';
			const result = decodeIdentity(identityBytes);
			sinon.assert.calledWith(signatureHeaderDecodeStub, identityBytes);
			sinon.assert.called(getMspidStub);
			sinon.assert.called(getMspidStub);
			result.should.deep.equal({Mspid: 'msp-id', IdBytes: '0'});
		});

		it('should log an error when identity decoding fails', () => {
			revert.push(BlockDecoderRewire.__set__('_identityProto.SerializedIdentity.decode', () => {
				throw new Error('MockError');
			}));
			const identity = decodeIdentity({});
			sinon.assert.called(FakeLogger.error);
			identity.should.deep.equal({});
		});

		it('should log a string error when identity decoding fails', () => {
			revert.push(BlockDecoderRewire.__set__('_identityProto.SerializedIdentity.decode', () => {
				throw 'error';
			}));
			const identity = decodeIdentity({});
			sinon.assert.calledWith(FakeLogger.error, 'Failed to decode the identity: %s', 'error');
			identity.should.deep.equal({});
		});
	});

	describe('#decodeFabricMSPConfig', () => {
		let decodeFabricMSPConfig;

		let fabricMSPConfigDecodeStub;
		let toPEMcertsStub;
		let decodeSigningIdentityInfoStub;
		let decodeFabricOUIdentifierStub;
		let getNameStub;
		let getRootCertsStub;
		let getIntermediateCertsStub;
		let getAdminsStub;
		let getRevocationListStub;
		let getSigningIdentityStub;
		let getOrganizationalUnitIdentifiersStub;
		let getTlsRootCertsStub;
		let getTlsIntermediateCertsStub;
		before(() => {
			decodeFabricMSPConfig = BlockDecoderRewire.__get__('decodeFabricMSPConfig');
		});

		beforeEach(() => {
			getNameStub = sandbox.stub();
			getRootCertsStub = sandbox.stub();
			getIntermediateCertsStub = sandbox.stub();
			getAdminsStub = sandbox.stub();
			getRevocationListStub = sandbox.stub();
			getSigningIdentityStub = sandbox.stub();
			getOrganizationalUnitIdentifiersStub = sandbox.stub();
			getTlsRootCertsStub = sandbox.stub();
			getTlsIntermediateCertsStub = sandbox.stub();

			fabricMSPConfigDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_mspConfigProto.FabricMSPConfig.decode', fabricMSPConfigDecodeStub));
			toPEMcertsStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('toPEMcerts', toPEMcertsStub));
			decodeSigningIdentityInfoStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeSigningIdentityInfo', decodeSigningIdentityInfoStub));
			decodeFabricOUIdentifierStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeFabricOUIdentifier', decodeFabricOUIdentifierStub));
			fabricMSPConfigDecodeStub.returns({
				getName: getNameStub.returns('name'),
				getRootCerts: getRootCertsStub.returns('root-certs'),
				getIntermediateCerts: getIntermediateCertsStub.returns('intermediate-cert'),
				getAdmins: getAdminsStub.returns('admin'),
				getRevocationList: getRevocationListStub.returns('revocation-list'),
				getSigningIdentity: getSigningIdentityStub.returns('signing-identity'),
				getOrganizationalUnitIdentifiers: getOrganizationalUnitIdentifiersStub.returns('unit-identifier'),
				getTlsRootCerts: getTlsRootCertsStub.returns('tls-root-cert'),
				getTlsIntermediateCerts: getTlsIntermediateCertsStub.returns('tls-intermediate-cert')
			});
		});

		it('should decode a fabric msp config', () => {
			toPEMcertsStub.onCall(0).returns('pem-root-cert');
			toPEMcertsStub.onCall(1).returns('intermediate-cert');
			toPEMcertsStub.onCall(2).returns('admins-cert');
			toPEMcertsStub.onCall(3).returns('revocation-list-cert');
			toPEMcertsStub.onCall(4).returns('tls-root-cert');
			toPEMcertsStub.onCall(5).returns('tls-intermediate-cert');

			decodeSigningIdentityInfoStub.returns('decoded-signing-identity');
			decodeFabricOUIdentifierStub.returns('decided-unit-identifier');
			const mspConfigBytes = 'msp_config_bytes';
			const result = decodeFabricMSPConfig(mspConfigBytes);
			sinon.assert.calledWith(fabricMSPConfigDecodeStub, mspConfigBytes);
			sinon.assert.called(getNameStub);
			result.name.should.equal('name');

			toPEMcertsStub.getCall(0).args[0].should.equal('root-certs');
			sinon.assert.called(getRootCertsStub);
			result.root_certs.should.equal('pem-root-cert');

			toPEMcertsStub.getCall(1).args[0].should.equal('intermediate-cert');
			sinon.assert.called(getIntermediateCertsStub);
			result.intermediate_certs.should.equal('intermediate-cert');

			toPEMcertsStub.getCall(2).args[0].should.equal('admin');
			sinon.assert.called(getAdminsStub);
			result.admins.should.equal('admins-cert');

			toPEMcertsStub.getCall(3).args[0].should.equal('revocation-list');
			sinon.assert.called(getRevocationListStub);
			result.revocation_list.should.equal('revocation-list-cert');

			sinon.assert.called(getSigningIdentityStub);
			sinon.assert.calledWith(decodeSigningIdentityInfoStub, 'signing-identity');
			result.signing_identity.should.equal('decoded-signing-identity');

			sinon.assert.called(getOrganizationalUnitIdentifiersStub);
			sinon.assert.calledWith(decodeFabricOUIdentifierStub, 'unit-identifier');
			result.organizational_unit_identifiers.should.equal('decided-unit-identifier');

			sinon.assert.called(getTlsRootCertsStub);
			toPEMcertsStub.getCall(4).args[0].should.equal('tls-root-cert');
			result.tls_root_certs.should.equal('tls-root-cert');

			sinon.assert.called(getTlsIntermediateCertsStub);
			toPEMcertsStub.getCall(5).args[0].should.equal('tls-intermediate-cert');
			result.tls_intermediate_certs.should.equal('tls-intermediate-cert');
		});
	});

	describe('#decodeFabricOUIdentifier', () => {
		let decodeFabricOUIdentifier;
		before(() => {
			decodeFabricOUIdentifier = BlockDecoderRewire.__get__('decodeFabricOUIdentifier');
		});

		it('should return an empty array if no unit identifiers given', () => {
			const identifiers = decodeFabricOUIdentifier();
			identifiers.should.deep.equal([]);
		});

		it('should return the correct identifiers', () => {
			const mockUnitIdentifier = {
				getCertificate: sandbox.stub().returns({
					toBuffer: sandbox.stub().returns({
						toString: sandbox.stub().returns('certificate')
					})
				}),
				getOrganizationalUnitIdentifier: sandbox.stub().returns('organizational-unit-identifier')
			};
			const protoOrganizationalUnitIdentifiers = [mockUnitIdentifier];
			const identifiers = decodeFabricOUIdentifier(protoOrganizationalUnitIdentifiers);
			identifiers[0].certificate.should.equal('certificate');
			identifiers[0].organizational_unit_identifier.should.equal('organizational-unit-identifier');
			sinon.assert.called(mockUnitIdentifier.getCertificate);
			sinon.assert.called(mockUnitIdentifier.getOrganizationalUnitIdentifier);
		});
	});

	describe('#toPEMcerts', () => {

	});

	describe('#decodeSigningIdentityInfo', () => {
		let decodeSigningIdentityInfo;
		let signingIdentityInfoDecoderStub;
		let decodeKeyInfoStub;
		let getPublicSignerStub;
		let getPrivateSignerStub;
		before(() => {
			decodeSigningIdentityInfo = BlockDecoderRewire.__get__('decodeSigningIdentityInfo');
		});

		beforeEach(() => {
			signingIdentityInfoDecoderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_mspConfigProto.SigningIdentityInfo.decode', signingIdentityInfoDecoderStub));
			decodeKeyInfoStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKeyInfo', decodeKeyInfoStub));
			getPublicSignerStub = sandbox.stub().returns({toBuffer: () => {
				return {toString: () => 'public-signer'};
			}});
			getPrivateSignerStub = sandbox.stub().returns('private-signer');
		});

		it('should return the correct identity info', () => {
			signingIdentityInfoDecoderStub.returns({getPublicSigner: getPublicSignerStub, getPrivateSigner: getPrivateSignerStub});
			decodeKeyInfoStub.returns('decode-key-info');
			const signingIdentityinfoBytes = {};

			const signingIdentityInfo = decodeSigningIdentityInfo(signingIdentityinfoBytes);
			sinon.assert.called(signingIdentityInfoDecoderStub);
			sinon.assert.called(getPublicSignerStub);
			sinon.assert.called(getPrivateSignerStub);
			sinon.assert.called(decodeKeyInfoStub);
			signingIdentityInfo.public_signer.should.equal('public-signer');
			signingIdentityInfo.private_signer.should.equal('decode-key-info');
		});
	});

	describe('#decodeKeyInfo', () => {
		let decodeKeyInfo;
		let keyInfoDecoderStub;
		let getKeyIdentifierStub;
		before(() => {
			decodeKeyInfo = BlockDecoderRewire.__get__('decodeKeyInfo');
		});

		beforeEach(() => {
			getKeyIdentifierStub = sandbox.stub();
			keyInfoDecoderStub = sandbox.stub();
			keyInfoDecoderStub.returns({getKeyIdentifier: getKeyIdentifierStub});
			revert.push(BlockDecoderRewire.__set__('_mspConfigProto.KeyInfo.decode', keyInfoDecoderStub));
		});

		it('should return the correct key info', () => {
			getKeyIdentifierStub.returns('key-identifier');
			const keyInfo = decodeKeyInfo({});
			sinon.assert.called(getKeyIdentifierStub);
			sinon.assert.called(keyInfoDecoderStub);
			keyInfo.key_identifier.should.equal('key-identifier');
			keyInfo.key_material.should.equal('private');
		});

		it('should return an empty object if no key info bytes are given', () => {
			const keyInfo = decodeKeyInfo();
			keyInfo.should.deep.equal({});
		});
	});

	describe('#decodeHeader', () => {
		let decodeHeader;

		let decodeChannelHeaderStub;
		let decodeSignatureHeaderStub;
		let getChannelHeaderStub;
		let getSignatureHeaderStub;
		before(() => {
			decodeHeader = BlockDecoderRewire.__get__('decodeHeader');
		});

		beforeEach(() => {
			decodeChannelHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChannelHeader', decodeChannelHeaderStub));
			decodeSignatureHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', decodeSignatureHeaderStub));
			getChannelHeaderStub = sandbox.stub();
			getSignatureHeaderStub = sandbox.stub();
		});

		it('should decode and return the header', () => {
			decodeChannelHeaderStub.returns('channel-header');
			decodeSignatureHeaderStub.returns('signature-header');
			const headerBytes = {
				getChannelHeader: getChannelHeaderStub.returns({toBuffer: () => 'channel-header'}),
				getSignatureHeader: getSignatureHeaderStub.returns({toBuffer: () => 'signature-header'})
			};
			const result = decodeHeader(headerBytes);
			sinon.assert.calledWith(decodeChannelHeaderStub, 'channel-header');
			sinon.assert.calledWith(decodeSignatureHeaderStub, 'signature-header');
			sinon.assert.called(getChannelHeaderStub);
			sinon.assert.called(getSignatureHeaderStub);
			result.channel_header.should.equal('channel-header');
			result.signature_header.should.equal('signature-header');
		});
	});

	describe('#decodeChannelHeader', () => {
		let decodeChannelHeader;

		let channelHeaderDecodeStub;
		let getTypeStub;
		let decodeVersionStub;
		let getVersionStub;
		let timeStampToDateStub;
		let getTimestampStub;
		let getChannelIdStub;
		let getTxIdStub;
		let getEpochStub;
		let getExtensionStub;
		before(() => {
			decodeChannelHeader = BlockDecoderRewire.__get__('decodeChannelHeader');
		});

		beforeEach(() => {
			channelHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_commonProto.ChannelHeader.decode', channelHeaderDecodeStub));
			getTypeStub = sandbox.stub();
			decodeVersionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeVersion', decodeVersionStub));
			getVersionStub = sandbox.stub();
			timeStampToDateStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('timeStampToDate', timeStampToDateStub));
			getTimestampStub = sandbox.stub();
			getChannelIdStub = sandbox.stub();
			getTxIdStub = sandbox.stub();
			getEpochStub = sandbox.stub();
			getExtensionStub = sandbox.stub();

			channelHeaderDecodeStub.returns({
				getType: getTypeStub,
				getVersion: getVersionStub,
				getTimestamp: getTimestampStub,
				getChannelId: getChannelIdStub,
				getTxId: getTxIdStub,
				getEpoch: getEpochStub,
				getExtension: getExtensionStub
			});
		});

		it('should decode and return te channel header', () => {
			getTypeStub.returns('type');
			getVersionStub.returns('version');
			decodeVersionStub.returns('version');
			getTimestampStub.returns('timestamp');
			timeStampToDateStub.returns('timestamp');
			getChannelIdStub.returns('channel-id');
			getTxIdStub.returns('tx-id');
			getEpochStub.returns({toString: () => 'epoch'});
			getExtensionStub.returns({toBuffer: () => 'extension'});

			const result = decodeChannelHeader('header_bytes');
			sinon.assert.calledWith(channelHeaderDecodeStub, 'header_bytes');
			sinon.assert.called(getTypeStub);
			result.type.should.equal('type');
			sinon.assert.called(getVersionStub);
			sinon.assert.calledWith(decodeVersionStub, 'version');
			result.version.should.equal('version');
			sinon.assert.called(getTimestampStub);
			sinon.assert.calledWith(timeStampToDateStub, 'timestamp');
			result.timestamp.should.equal('timestamp');
			sinon.assert.called(getChannelIdStub);
			result.channel_id.should.equal('channel-id');
			sinon.assert.called(getTxIdStub);
			result.tx_id.should.equal('tx-id');
			sinon.assert.called(getEpochStub);
			result.epoch.should.equal('epoch');
			sinon.assert.called(getExtensionStub);
			result.extension.should.equal('extension');
		});
	});

	describe('timeStampToDate()', () => {
		const timeStampToDate = BlockDecoderRewire.__get__('timeStampToDate');

		it('should return null for empty timestamp', () => {
			const res = timeStampToDate();
			res.should.eql('null');
		});

		it('should return ISO8601 string for a valid timestamp', () => {
			const now = new Date();
			const timestamp = {
				seconds: Math.floor(now.getTime() / 1000),
				nanos: now.getMilliseconds() * 1000000
			};
			const res = timeStampToDate(timestamp);
			res.should.have.string(now.getMilliseconds().toString());
		});
	});

	describe('#decodeChaincodeActionPayload', () => {
		let decodeChaincodeActionPayload;
		let chaincodeActionPayloadStub;
		let chaincodeProposalPayloadStub;
		let decodeChaincodeProposalPayloadStub;
		let decodeChaincodeEndorsedActionStub;
		before(() => {
			decodeChaincodeActionPayload = BlockDecoderRewire.__get__('decodeChaincodeActionPayload');
		});

		beforeEach(() => {
			chaincodeActionPayloadStub = sandbox.stub();
			chaincodeProposalPayloadStub = sandbox.stub();
			chaincodeActionPayloadStub.returns({getChaincodeProposalPayload: chaincodeProposalPayloadStub, getAction: sandbox.stub().returns('action')});
			revert.push(BlockDecoderRewire.__set__('_transProto.ChaincodeActionPayload.decode', chaincodeActionPayloadStub));
			decodeChaincodeProposalPayloadStub = sandbox.stub();

			revert.push(BlockDecoderRewire.__set__('decodeChaincodeProposalPayload', decodeChaincodeProposalPayloadStub));
			decodeChaincodeEndorsedActionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeEndorsedAction', decodeChaincodeEndorsedActionStub));
		});

		it('should return the correct chaincode action payload', () => {
			chaincodeProposalPayloadStub.returns('chaincode');
			decodeChaincodeProposalPayloadStub.returns('chaincode-proposal-payload');
			decodeChaincodeEndorsedActionStub.returns('action');
			const payload = decodeChaincodeActionPayload({});
			payload.chaincode_proposal_payload.should.equal('chaincode-proposal-payload');
			payload.action.should.equal('action');
			sinon.assert.called(chaincodeActionPayloadStub);
			sinon.assert.calledWith(decodeChaincodeProposalPayloadStub, 'chaincode');
			sinon.assert.called(decodeChaincodeEndorsedActionStub);
		});
	});

	describe('#decodeChaincodeProposalPayload', () => {
		let decodeChaincodeProposalPayload;

		let getInputStub;
		let decodeChaincodeProposalPayloadInputStub;
		before(() => {
			decodeChaincodeProposalPayload = BlockDecoderRewire.__get__('decodeChaincodeProposalPayload');
		});

		beforeEach(() => {
			getInputStub = sandbox.stub().returns('input');
			revert.push(BlockDecoderRewire.__set__('_proposalProto.ChaincodeProposalPayload.decode', sandbox.stub().returns({getInput: getInputStub})));
			decodeChaincodeProposalPayloadInputStub = sandbox.stub().returns('decoded-input');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeProposalPayloadInput', decodeChaincodeProposalPayloadInputStub));
		});

		it('should return the correct chaincode proposal payload', () => {
			const chaincodeProposalPayload = decodeChaincodeProposalPayload({});
			sinon.assert.called(getInputStub);
			sinon.assert.calledWith(decodeChaincodeProposalPayloadInputStub, 'input');
			chaincodeProposalPayload.input.should.equal('decoded-input');
		});
	});

	describe('#decodeChaincodeProposalPayloadInput', () => {
		let decodeChaincodeProposalPayloadInput;

		let chaincodeInvocationSpecDecodeStub;
		before(() => {
			decodeChaincodeProposalPayloadInput = BlockDecoderRewire.__get__('decodeChaincodeProposalPayloadInput');
		});

		beforeEach(() => {
			chaincodeInvocationSpecDecodeStub = sandbox.stub();
			chaincodeInvocationSpecDecodeStub.returns({getChaincodeSpec: () => {
				return {toBuffer: () => 'chaincode_spec'};
			}});
			revert.push(BlockDecoderRewire.__set__('_chaincodeProto.ChaincodeInvocationSpec.decode', chaincodeInvocationSpecDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeSpec', (value) => value));
		});

		it('should return the correct chaincode proposal payload input', () => {
			const chaincodeProposalPayloadInput = decodeChaincodeProposalPayloadInput({});
			sinon.assert.called(chaincodeInvocationSpecDecodeStub);
			chaincodeProposalPayloadInput.chaincode_spec.should.equal('chaincode_spec');
		});
	});

	describe('#chaincodeTypeToString', () => {
		let chaincodeTypeToString;
		before(() => {
			chaincodeTypeToString = BlockDecoderRewire.__get__('chaincodeTypeToString');
			revert.push(BlockDecoderRewire.__set__('chaincode_type_as_string', {'matched_type1': 'type1'}));
		});

		it('should return the correct chaincode type when one is given', () => {
			const chaincodeTypeString = chaincodeTypeToString('matched_type1');
			chaincodeTypeString.should.equal('type1');
		});

		it('should return an unknown chaincode type', () => {
			const chaincodeTypeString = chaincodeTypeToString();
			chaincodeTypeString.should.equal('UNKNOWN');
		});
	});

	describe('#decodeChaincodeSpec', () => {
		let decodeChaincodeSpec;
		let chaincodeSpecDecodeStub;
		let chaincodeTypeToStringStub;
		let decodeChaincodeInputStub;
		before(() => {
			decodeChaincodeSpec = BlockDecoderRewire.__get__('decodeChaincodeSpec');
		});

		beforeEach(() => {
			chaincodeSpecDecodeStub = sandbox.stub();
			chaincodeSpecDecodeStub.returns({getType: () => 'type', getChaincodeId: () => 'chaincode-id', getTimeout: () => 1000, getInput: () => {
				return {toBuffer: () => 'input'};
			}});
			revert.push(BlockDecoderRewire.__set__('_chaincodeProto.ChaincodeSpec.decode', chaincodeSpecDecodeStub));
			chaincodeTypeToStringStub = sandbox.stub().returns('chaincode-type');
			revert.push(BlockDecoderRewire.__set__('chaincodeTypeToString', chaincodeTypeToStringStub));
			decodeChaincodeInputStub = sandbox.stub().returns('decoded-chaincode-input');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeInput', decodeChaincodeInputStub));
		});

		it('should return the correct decoded chaincode spec', () => {
			const chaincodeSpec = decodeChaincodeSpec();
			sinon.assert.called(chaincodeSpecDecodeStub);
			sinon.assert.called(decodeChaincodeInputStub);
			sinon.assert.called(chaincodeTypeToStringStub);
			chaincodeSpec.typeString.should.equal('chaincode-type');
			chaincodeSpec.input.should.equal('decoded-chaincode-input');
			chaincodeSpec.chaincode_id.should.equal('chaincode-id');
			chaincodeSpec.timeout.should.equal(1000);
		});
	});

	describe('#decodeChaincodeInput', () => {
		let decodeChaincodeInput;
		let chaincodeInputDecoderStub;
		before(() => {
			decodeChaincodeInput = BlockDecoderRewire.__get__('decodeChaincodeInput');
		});

		beforeEach(() => {
			const mockArg = {toBuffer: () => 'arg'};
			chaincodeInputDecoderStub = sandbox.stub();
			const mockDecoration = {map: {'key1': {value: {toBuffer: () => 'value'}}}};
			chaincodeInputDecoderStub.returns({getArgs: () => [mockArg], getDecorations: () => mockDecoration});
			revert.push(BlockDecoderRewire.__set__('_chaincodeProto.ChaincodeInput.decode', chaincodeInputDecoderStub));
		});

		it('should return the correct decoded chaincode input', () => {
			const input = decodeChaincodeInput({});
			input.args.should.deep.equal(['arg']);
			input.decorations.should.deep.equal({'key1': 'value'});
			sinon.assert.called(chaincodeInputDecoderStub);
		});
	});

	describe('#decodeChaincodeEndorsedAction', () => {
		let decodeChaincodeEndorsedAction;

		let decodeProposalResponsePayloadStub;
		let decodeEndorsementStub;
		before(() => {
			decodeChaincodeEndorsedAction = BlockDecoderRewire.__get__('decodeChaincodeEndorsedAction');
		});

		beforeEach(() => {
			decodeProposalResponsePayloadStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeProposalResponsePayload', decodeProposalResponsePayloadStub));
			decodeEndorsementStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeEndorsement', decodeEndorsementStub));
		});

		it('should return the correct endorsed action', () => {
			decodeProposalResponsePayloadStub.returns('proposal-payload-response');
			const action = decodeChaincodeEndorsedAction({getProposalResponsePayload: () => {}, endorsements: ['endorsement']});
			sinon.assert.called(decodeProposalResponsePayloadStub);
			sinon.assert.called(decodeEndorsementStub);
			action.proposal_response_payload.should.equal('proposal-payload-response');
		});
	});

	describe('#decodeEndorsement', () => {
		let decodeEndorsement;
		let decodeIdentityStub;
		before(() => {
			decodeEndorsement = BlockDecoderRewire.__get__('decodeEndorsement');
		});

		beforeEach(() => {
			decodeIdentityStub = sandbox.stub().returns('endorser');
			revert.push(BlockDecoderRewire.__set__('decodeIdentity', decodeIdentityStub));
		});

		it('should return the correct endorsement', () => {
			const protoEndorsement = {
				getEndorser: () => 'endorser',
				getSignature: () => {
					return {toBuffer: () => 'signature'};
				}
			};
			const endorsement = decodeEndorsement(protoEndorsement);
			endorsement.endorser.should.equal('endorser');
			endorsement.signature.should.equal('signature');
		});
	});

	describe('#decodeProposalResponsePayload', () => {
		let decodeProposalResponsePayload;

		let proposalResponsePayloadDecodeStub;
		let decodeChaincodeActionStub;
		before(() => {
			decodeProposalResponsePayload = BlockDecoderRewire.__get__('decodeProposalResponsePayload');
		});

		beforeEach(() => {
			proposalResponsePayloadDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_responseProto.ProposalResponsePayload.decode', proposalResponsePayloadDecodeStub));
			proposalResponsePayloadDecodeStub.returns({
				getProposalHash: () => {
					return {
						toBuffer: () => {
							return {toString: () => 'proposal-hash'};
						}
					};
				},
				getExtension: () => 'extension'
			});
			decodeChaincodeActionStub = sandbox.stub().returns('extension');

			revert.push(BlockDecoderRewire.__set__('decodeChaincodeAction', decodeChaincodeActionStub));
		});

		it('should return the correct proposal response payload', () => {
			const proposalResponsePayload = decodeProposalResponsePayload({});
			proposalResponsePayload.proposal_hash.should.equal('proposal-hash');
			proposalResponsePayload.extension.should.equal('extension');
		});
	});

	describe('#decodeChaincodeAction', () => {
		let decodeChaincodeAction;

		let chaincodeActionDecodeStub;
		let decodeReadWriteSetsStub;
		let decodeChaincodeEventsStub;
		let decodeResponseStub;
		let decodeChaincodeIdStub;
		before(() => {
			decodeChaincodeAction = BlockDecoderRewire.__get__('decodeChaincodeAction');
		});

		beforeEach(() => {
			chaincodeActionDecodeStub = sandbox.stub().returns({
				getResults: () => 'results',
				getEvents: () => 'events',
				getResponse: () => 'response',
				getChaincodeId: () => 'chaincode-id'
			});
			revert.push(BlockDecoderRewire.__set__('_proposalProto.ChaincodeAction.decode', chaincodeActionDecodeStub));
			decodeReadWriteSetsStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeReadWriteSets', decodeReadWriteSetsStub));
			decodeChaincodeEventsStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeEvents', decodeChaincodeEventsStub));
			decodeResponseStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeResponse', decodeResponseStub));
			decodeChaincodeIdStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeID', decodeChaincodeIdStub));
		});

		it('should return the correct chaincode action payload', () => {
			decodeReadWriteSetsStub.returns('read-write');
			decodeChaincodeEventsStub.returns('decoded-events');
			decodeResponseStub.returns('decoded-response');
			decodeChaincodeIdStub.returns('decoded-chaincode-id');
			const chaincodeAction = decodeChaincodeAction('action_bytes');
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeAction - start');
			sinon.assert.calledWith(chaincodeActionDecodeStub, 'action_bytes');
			sinon.assert.calledWith(decodeReadWriteSetsStub, 'results');
			sinon.assert.calledWith(decodeChaincodeEventsStub, 'events');
			sinon.assert.calledWith(decodeResponseStub, 'response');
			sinon.assert.calledWith(decodeChaincodeIdStub, 'chaincode-id');
			chaincodeAction.results.should.equal('read-write');
			chaincodeAction.events.should.equal('decoded-events');
			chaincodeAction.response.should.equal('decoded-response');
			chaincodeAction.chaincode_id.should.equal('decoded-chaincode-id');
		});
	});

	describe('#decodeChaincodeEvents', () => {
		let decodeChaincodeEvents;

		let chaincodeEventDecodeStub;
		let getChaincodeIdStub;
		let getTxIdStub;
		let getEventNameStub;
		let getPayloadStub;
		before(() => {
			decodeChaincodeEvents = BlockDecoderRewire.__get__('decodeChaincodeEvents');
		});

		beforeEach(() => {
			chaincodeEventDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_ccEventProto.ChaincodeEvent.decode', chaincodeEventDecodeStub));
			getChaincodeIdStub = sandbox.stub().returns('chaincode-id');
			getTxIdStub = sandbox.stub().returns('tx-id');
			getEventNameStub = sandbox.stub().returns('event-name');
			getPayloadStub = sandbox.stub().returns({toBuffer: () => 'payload'});
			chaincodeEventDecodeStub.returns({
				getChaincodeId: getChaincodeIdStub,
				getTxId: getTxIdStub,
				getEventName: getEventNameStub,
				getPayload: getPayloadStub
			});
		});

		it('should return the correct decoded event', () => {
			const decodedEvent = decodeChaincodeEvents('event_bytes');
			decodedEvent.chaincode_id.should.equal('chaincode-id');
			sinon.assert.called(getChaincodeIdStub);
			decodedEvent.chaincode_id.should.equal('chaincode-id');
			sinon.assert.called(getTxIdStub);
			decodedEvent.tx_id.should.equal('tx-id');
			sinon.assert.called(getEventNameStub);
			decodedEvent.event_name.should.equal('event-name');
			sinon.assert.called(getPayloadStub);
			decodedEvent.payload.should.equal('payload');
		});
	});

	describe('#decodeChaincodeID', () => {
		let decodeChaincodeID;

		before(() => {
			decodeChaincodeID = BlockDecoderRewire.__get__('decodeChaincodeID');
		});

		beforeEach(() => {

		});

		it('should log and return an empty object when no proto_chaincode_id is given', () => {
			const decodedChaincodeId = decodeChaincodeID();
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeID - no proto_chaincode_id found');
			decodedChaincodeId.should.deep.equal({});
		});

		it('should return the correct decoded chaincode id', () => {
			const mockProtoChaincodeId = {
				getPath: sandbox.stub().returns('path'),
				getName: sandbox.stub().returns('name'),
				getVersion: sandbox.stub().returns('version')
			};
			const chaincodeId = decodeChaincodeID(mockProtoChaincodeId);
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeID - start');
			sinon.assert.called(mockProtoChaincodeId.getPath);
			chaincodeId.path.should.equal('path');
			sinon.assert.called(mockProtoChaincodeId.getName);
			chaincodeId.name.should.equal('name');
			sinon.assert.called(mockProtoChaincodeId.getVersion);
			chaincodeId.version.should.equal('version');
		});
	});

	describe('#decodeReadWriteSets', () => {
		let decodeReadWriteSets;

		let txReadWriteSetDecodeStub;
		let decodeCollectionHashedRWSetStub;
		let getNsRwsetStub;
		let getDataModelStub;
		let decodeKVRWSetStub;
		before(() => {
			decodeReadWriteSets = BlockDecoderRewire.__get__('decodeReadWriteSets');
		});

		beforeEach(() => {
			getDataModelStub = sandbox.stub();
			getNsRwsetStub = sandbox.stub();
			txReadWriteSetDecodeStub = sandbox.stub().returns({
				getDataModel: getDataModelStub,
				getNsRwset: getNsRwsetStub
			});
			decodeKVRWSetStub = sandbox.stub();
			decodeCollectionHashedRWSetStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_rwsetProto.TxReadWriteSet.decode', txReadWriteSetDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVRWSet', decodeKVRWSetStub));
			revert.push(BlockDecoderRewire.__set__('decodeCollectionHashedRWSet', decodeCollectionHashedRWSetStub));
		});

		it('should return the correct read write set when data model not KV', () => {
			getNsRwsetStub.returns('ns-rwset');
			getDataModelStub.returns('data-model');
			const readWriteSet = decodeReadWriteSets({});
			sinon.assert.called(getNsRwsetStub);
			readWriteSet.ns_rwset.should.equal('ns-rwset');
			sinon.assert.called(getDataModelStub);
			readWriteSet.data_model.should.equal('data-model');
		});

		it('should return the correct read write set when the data model is KV', () => {
			decodeKVRWSetStub.returns('rwset');
			decodeCollectionHashedRWSetStub.returns('collection-hashed-rwset');
			const getNamespaceStub = sandbox.stub().returns('namespace');
			const getRwsetStub = sandbox.stub().returns('rwset');
			const getCollectionHashedRwsetStub = sandbox.stub().returns('collection-hashed-rwset');
			const mockKvRwSet = {
				getNamespace: getNamespaceStub,
				getRwset: getRwsetStub,
				getCollectionHashedRwset: getCollectionHashedRwsetStub
			};
			getDataModelStub.returns('KV');
			getNsRwsetStub.returns({1: mockKvRwSet});
			revert.push(BlockDecoderRewire.__set__('_rwsetProto.TxReadWriteSet.DataModel.KV', 'KV'));
			const readWriteSet = decodeReadWriteSets({});
			const nsRwSet = readWriteSet.ns_rwset[0];
			sinon.assert.calledTwice(getDataModelStub);
			nsRwSet.namespace.should.equal('namespace');
			sinon.assert.called(getNsRwsetStub);
			nsRwSet.rwset.should.equal('rwset');
			sinon.assert.calledWith(decodeKVRWSetStub, 'rwset');
			nsRwSet.collection_hashed_rwset.should.equal('collection-hashed-rwset');
			sinon.assert.calledWith(decodeCollectionHashedRWSetStub, 'collection-hashed-rwset');
		});
	});

	describe('#decodeKVRWSet', () => {
		let deocdeKVRWSet;

		let getWritesStub;
		let getReadsStub;
		let getRangeQueriesInfoStub;
		let getMetadataWritesStub;
		let KVRWSetDecodeStub;
		let decodeKVReadStub;
		let decodeKVWriteStub;
		let decodeRangeQueryInfoStub;
		let decodeKVMetadataWriteStub;
		before(() => {
			deocdeKVRWSet = BlockDecoderRewire.__get__('decodeKVRWSet');
		});

		beforeEach(() => {
			getWritesStub = sandbox.stub();
			getReadsStub = sandbox.stub();
			getRangeQueriesInfoStub = sandbox.stub();
			getMetadataWritesStub = sandbox.stub();
			decodeKVReadStub = sandbox.stub();
			KVRWSetDecodeStub = sandbox.stub().returns({
				getWrites: getWritesStub,
				getReads: getReadsStub,
				getRangeQueriesInfo: getRangeQueriesInfoStub,
				getMetadataWrites: getMetadataWritesStub
			});
			decodeRangeQueryInfoStub = sandbox.stub();
			decodeKVWriteStub = sandbox.stub();
			decodeKVMetadataWriteStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_kv_rwsetProto.KVRWSet.decode', KVRWSetDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVRead', decodeKVReadStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVWrite', decodeKVWriteStub));
			revert.push(BlockDecoderRewire.__set__('decodeRangeQueryInfo', decodeRangeQueryInfoStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataWrite', decodeKVMetadataWriteStub));
		});

		it('should return the correct decoded kv_rw_set', () => {
			getReadsStub.returns(['read']);
			getWritesStub.returns(['write']);
			getMetadataWritesStub.returns(['metadata-write']);
			getRangeQueriesInfoStub.returns(['range-queries-info']);
			decodeRangeQueryInfoStub.returns('range-query-info');
			decodeKVMetadataWriteStub.returns('metadata-write');
			decodeKVReadStub.returns('read');
			decodeKVWriteStub.returns('write');
			const kvRwSet = deocdeKVRWSet('kv_bytes');
			sinon.assert.calledWith(KVRWSetDecodeStub, 'kv_bytes');
			sinon.assert.called(getReadsStub);
			sinon.assert.called(getWritesStub);
			sinon.assert.calledOnce(decodeKVReadStub);
			sinon.assert.calledOnce(decodeKVWriteStub);
			sinon.assert.calledOnce(getRangeQueriesInfoStub);
			sinon.assert.calledOnce(decodeRangeQueryInfoStub);
			sinon.assert.calledOnce(decodeKVMetadataWriteStub);

			kvRwSet.reads.should.deep.equal(['read']);
			kvRwSet.writes.should.deep.equal(['write']);
			kvRwSet.range_queries_info.should.deep.equal(['range-query-info']);
			kvRwSet.metadata_writes.should.deep.equal(['metadata-write']);
		});
	});

	describe('#decodeKVRead', () => {
		let decodeKVRead;

		let getKeyStub;
		let getVersionStub;
		let getBlockNumStub;
		let getTxNumStub;
		before(() => {
			decodeKVRead = BlockDecoderRewire.__get__('decodeKVRead');
		});

		beforeEach(() => {
			getKeyStub = sandbox.stub();
			getVersionStub = sandbox.stub();
			getBlockNumStub = sandbox.stub();
			getTxNumStub = sandbox.stub();
		});

		it('should return the correct kv read', () => {
			getKeyStub.returns(1);
			getVersionStub.returns({getBlockNum: getBlockNumStub, getTxNum: getTxNumStub});
			getBlockNumStub.returns(0);
			getTxNumStub.returns(1);
			const mockProtoKvRead = {getKey: getKeyStub, getVersion: getVersionStub};
			const kvRead = decodeKVRead(mockProtoKvRead);
			kvRead.key.should.equal(1);
			sinon.assert.called(getKeyStub);
			kvRead.version.block_num.should.equal('0');
			kvRead.version.tx_num.should.equal('1');
			sinon.assert.called(getVersionStub);
		});

		it('should return the correct kv read when proto_version not present', () => {
			getKeyStub.returns(1);
			getVersionStub.returns(null);
			const mockProtoKvRead = {getKey: getKeyStub, getVersion: getVersionStub};
			const kvRead = decodeKVRead(mockProtoKvRead);
			kvRead.key.should.equal(1);
			sinon.assert.called(getKeyStub);
			sinon.assert.called(getVersionStub);
			should.equal(kvRead.version, null);
		});
	});

	describe('#decodeRangeQueryInfo', () => {
		let decodeRangeQueryInfo;

		let getStartKeyStub;
		let getEndKeyStub;
		let getItrExhaustedStub;
		let getRawReadsStub;
		let getReadsMerkleHashesStub;
		let decodeKVReadStub;
		let getMaxDegreeStub;
		let getMaxLevelStub;
		let getMaxLevelHashesStub;
		let mockMerkelHash;
		before(() => {
			decodeRangeQueryInfo = BlockDecoderRewire.__get__('decodeRangeQueryInfo');
		});

		beforeEach(() => {
			getStartKeyStub = sandbox.stub();
			getEndKeyStub = sandbox.stub();
			getItrExhaustedStub = sandbox.stub();
			getRawReadsStub = sandbox.stub();
			getReadsMerkleHashesStub = sandbox.stub();
			decodeKVReadStub = sandbox.stub();
			getMaxDegreeStub = sandbox.stub();
			getMaxLevelStub = sandbox.stub();
			getMaxLevelHashesStub = sandbox.stub();
			mockMerkelHash = {getMaxDegree: getMaxDegreeStub, getMaxLevel: getMaxLevelStub, getMaxLevelHashes: getMaxLevelHashesStub};
			revert.push(BlockDecoderRewire.__set__('decodeKVRead', decodeKVReadStub));
		});

		it('should return the correct range query info', () => {
			getMaxDegreeStub.returns('max-degree');
			getMaxLevelStub.returns('max-level');
			getMaxLevelHashesStub.returns('max-level-hashes');
			const mockProtoRangeQueryInfo = {
				getStartKey: getStartKeyStub.returns('start_key'),
				getEndKey: getEndKeyStub.returns('end_key'),
				getItrExhausted: getItrExhaustedStub.returns('itr_exhausted'),
				getRawReads: getRawReadsStub.returns({kv_reads: ['raw_read']}),
				getReadsMerkleHashes: getReadsMerkleHashesStub.returns(mockMerkelHash)
			};
			const rangeQueryInfo = decodeRangeQueryInfo(mockProtoRangeQueryInfo);
			sinon.assert.called(getStartKeyStub);
			rangeQueryInfo.start_key.should.equal('start_key');
			sinon.assert.called(getEndKeyStub);
			rangeQueryInfo.end_key.should.equal('end_key');
			sinon.assert.called(getItrExhaustedStub);
			rangeQueryInfo.itr_exhausted.should.equal('itr_exhausted');
			sinon.assert.called(getReadsMerkleHashesStub);
			sinon.assert.calledWith(decodeKVReadStub, 'raw_read');
			rangeQueryInfo.reads_merkle_hashes.should.deep.equal({max_degree: 'max-degree', max_level: 'max-level', max_level_hashes: 'max-level-hashes'});
		});

		it('should return the correct range query info where there are no raw reads or merkle hashes', () => {
			getMaxDegreeStub.returns('max-degree');
			getMaxLevelStub.returns('max-level');
			getMaxLevelHashesStub.returns('max-level-hashes');
			const mockProtoRangeQueryInfo = {
				getStartKey: getStartKeyStub.returns('start_key'),
				getEndKey: getEndKeyStub.returns('end_key'),
				getItrExhausted: getItrExhaustedStub.returns('itr_exhausted'),
				getRawReads: getRawReadsStub.returns(),
				getReadsMerkleHashes: getReadsMerkleHashesStub.returns()
			};
			const rangeQueryInfo = decodeRangeQueryInfo(mockProtoRangeQueryInfo);
			sinon.assert.called(getStartKeyStub);
			rangeQueryInfo.start_key.should.equal('start_key');
			sinon.assert.called(getEndKeyStub);
			rangeQueryInfo.end_key.should.equal('end_key');
			sinon.assert.called(getItrExhaustedStub);
			rangeQueryInfo.itr_exhausted.should.equal('itr_exhausted');
		});
	});

	describe('#decodeKVWrite', () => {
		let decodeKVWrite;

		let getKeyStub;
		let getIsDeleteStub;
		let getValueStub;
		before(() => {
			decodeKVWrite = BlockDecoderRewire.__get__('decodeKVWrite');
		});

		beforeEach(() => {
			getKeyStub = sandbox.stub();
			getIsDeleteStub = sandbox.stub();
			getValueStub = sandbox.stub();
		});

		it('should return the correct kv write', () => {
			const mockProtoKVWrite = {
				getKey: getKeyStub.returns('key'),
				getIsDelete: getIsDeleteStub.returns('is_delete'),
				getValue: getValueStub.returns({toBuffer: () => 0})
			};

			const kvWrite = decodeKVWrite(mockProtoKVWrite);
			sinon.assert.called(getKeyStub);
			sinon.assert.called(getIsDeleteStub);
			sinon.assert.called(getValueStub);
			kvWrite.key.should.equal('key');
			kvWrite.is_delete.should.equal('is_delete');
			kvWrite.value.should.equal('0');
		});
	});

	describe('#decodeKVMetadataWrite', () => {
		let decodeKVMetadataWrite;

		let getKeyStub;
		let getEntriesStub;
		let decodeKVMetadataEntryStub;
		before(() => {
			decodeKVMetadataWrite = BlockDecoderRewire.__get__('decodeKVMetadataWrite');
		});

		beforeEach(() => {
			getKeyStub = sandbox.stub();
			getEntriesStub = sandbox.stub();

			decodeKVMetadataEntryStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataEntry', decodeKVMetadataEntryStub));
		});

		it('should return the correct kv metadata', () => {
			const mockProtokvMetadataWrite = {
				getKey: getKeyStub.returns('key'),
				getEntries: getEntriesStub.returns(['entry']),
			};
			decodeKVMetadataEntryStub.returns('metadata');
			const kvMetadataWrite = decodeKVMetadataWrite(mockProtokvMetadataWrite);
			sinon.assert.called(getKeyStub);
			sinon.assert.called(getEntriesStub);
			sinon.assert.calledWith(decodeKVMetadataEntryStub, 'entry');
			kvMetadataWrite.key.should.equal('key');
			kvMetadataWrite.entries.should.deep.equal(['metadata']);
		});
	});

	describe('decodeKVMetadataEntry', () => {
		let decodeKVMetadataEntry;

		let getNameStub;
		let getValueStub;
		before(() => {
			decodeKVMetadataEntry = BlockDecoderRewire.__get__('decodeKVMetadataEntry');
		});

		beforeEach(() => {
			getNameStub = sandbox.stub();
			getValueStub = sandbox.stub();
		});

		it('should return the correct kv metadata entry', () => {
			const mockProtoMetadataEntry = {
				getName: getNameStub.returns('name'),
				getValue: getValueStub.returns({toBuffer: () => 'value'})
			};

			const kvMetadataEntry = decodeKVMetadataEntry(mockProtoMetadataEntry);
			sinon.assert.called(getNameStub);
			kvMetadataEntry.name.should.equal('name');
			sinon.assert.called(getValueStub);
			kvMetadataEntry.value.should.equal('value');
		});
	});

	describe('#decodeResponse', () => {
		let decodeResponse;

		let getStatusStub;
		let getMessageStub;
		let getPayloadStub;
		before(() => {
			decodeResponse = BlockDecoderRewire.__get__('decodeResponse');
		});

		beforeEach(() => {
			getStatusStub = sandbox.stub();
			getMessageStub = sandbox.stub();
			getPayloadStub = sandbox.stub();
		});

		it('should return the correct response', () => {
			const mockProtoResponse = {
				getStatus: getStatusStub.returns('status'),
				getMessage: getMessageStub.returns('message'),
				getPayload: getPayloadStub.returns({toBuffer: () => 0})
			};

			const response = decodeResponse(mockProtoResponse);
			sinon.assert.called(getStatusStub);
			response.status.should.equal('status');
			sinon.assert.called(getMessageStub);
			response.message.should.equal('message');
			sinon.assert.called(getPayloadStub);
			response.payload.should.equal('0');
		});

		it('should return nul when no proto response is given', () => {
			const response = decodeResponse();
			should.equal(response, null);
		});
	});

	describe('#decodeVersion', () => {
		let decodeVersion;

		before(() => {
			decodeVersion = BlockDecoderRewire.__get__('decodeVersion');
		});

		it('should return the verson number of type int', () => {
			const result = decodeVersion(10.2);
			result.should.equal(10);
		});
	});

	describe('#decodeCollectionHashedRWSet', () => {
		let decodeCollectionHashedRWSet;

		let getCollectionNameStub;
		let getHashedRwsetStub;
		let getPvtRwsetHashStub;
		let decodeHashedRwsetStub;
		before(() => {
			decodeCollectionHashedRWSet = BlockDecoderRewire.__get__('decodeCollectionHashedRWSet');
		});

		beforeEach(() => {
			getCollectionNameStub = sandbox.stub();
			getHashedRwsetStub = sandbox.stub();
			getPvtRwsetHashStub = sandbox.stub();
			decodeHashedRwsetStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHashedRwset', decodeHashedRwsetStub));
		});

		it('should return the correct collection hashed rw set', () => {
			const mockCollectionHashedRw = {
				getCollectionName: getCollectionNameStub.returns('name'),
				getHashedRwset: getHashedRwsetStub.returns({toBuffer: () => 'hashed-rw-set'}),
				getPvtRwsetHash: getPvtRwsetHashStub.returns({toBuffer: () => 'pvt-rw-set'})
			};
			decodeHashedRwsetStub.returns('rw-set');
			const rwSet = decodeCollectionHashedRWSet([mockCollectionHashedRw]);
			sinon.assert.called(getCollectionNameStub);
			rwSet[0].collection_name.should.equal('name');
			sinon.assert.calledWith(decodeHashedRwsetStub, 'hashed-rw-set');
			rwSet[0].hashed_rwset.should.equal('rw-set');
			sinon.assert.called(getPvtRwsetHashStub);
			rwSet[0].pvt_rwset_hash.should.equal('pvt-rw-set');
		});
	});

	describe('#decodeHashedRwset', () => {
		let decodeHashedRwset;

		let hashedRwsetDecodeStub;
		let getHashedReadsStub;
		let decodeKVReadHashStub;
		let getHashedWritesStub;
		let decodeKVWriteHashStub;
		let getMetadataWritesStub;
		let decodeKVMetadataWriteHashStub;
		before(() => {
			decodeHashedRwset = BlockDecoderRewire.__get__('decodeHashedRwset');
		});

		beforeEach(() => {
			hashedRwsetDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('_kv_rwsetProto.HashedRWSet.decode', hashedRwsetDecodeStub));
			getHashedReadsStub = sandbox.stub();
			decodeKVReadHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVReadHash', decodeKVReadHashStub));
			getHashedWritesStub = sandbox.stub();
			decodeKVWriteHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVWriteHash', decodeKVWriteHashStub));
			getMetadataWritesStub = sandbox.stub();
			decodeKVMetadataWriteHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataWriteHash', decodeKVMetadataWriteHashStub));

			hashedRwsetDecodeStub.returns({
				getHashedReads: getHashedReadsStub.returns(['read']),
				getHashedWrites: getHashedWritesStub.returns(['write']),
				getMetadataWrites: getMetadataWritesStub.returns(['metadata'])
			});
		});

		it('should return the correct hashe rw set', () => {
			decodeKVReadHashStub.returns('read');
			decodeKVWriteHashStub.returns('write');
			decodeKVMetadataWriteHashStub.returns('metadata');
			const rwset = decodeHashedRwset({});
			sinon.assert.called(getHashedReadsStub);
			sinon.assert.called(decodeKVReadHashStub);
			rwset.hashed_reads.should.deep.equal(['read']);
			sinon.assert.called(getHashedWritesStub);
			sinon.assert.called(decodeKVWriteHashStub);
			rwset.hashed_writes.should.deep.equal(['write']);
			sinon.assert.called(getMetadataWritesStub);
			sinon.assert.called(decodeKVMetadataWriteHashStub);
			rwset.metadata_writes.should.deep.equal(['metadata']);
		});
	});

	describe('#decodeKVReadHash', () => {
		let decodeKVReadHash;

		let getKeyHashStub;
		let getVersionStub;
		let getBlockNumStub;
		let getTxNumStub;
		before(() => {
			decodeKVReadHash = BlockDecoderRewire.__get__('decodeKVReadHash');
		});

		beforeEach(() => {
			getKeyHashStub = sandbox.stub();
			getVersionStub = sandbox.stub();
			getBlockNumStub = sandbox.stub();
			getTxNumStub = sandbox.stub();
		});

		it('should return the correct kv read hash', () => {
			const mockProtoKVReadHash = {
				getKeyHash: getKeyHashStub.returns({toBuffer: () => 'key-hash'}),
				getVersion: getVersionStub.returns({getBlockNum: getBlockNumStub.returns(0), getTxNum: getTxNumStub.returns(1)})

			};
			const kvKeyHash = decodeKVReadHash(mockProtoKVReadHash);
			sinon.assert.called(getKeyHashStub);
			kvKeyHash.key_hash.should.equal('key-hash');
			sinon.assert.called(getVersionStub);
			sinon.assert.called(getBlockNumStub);
			sinon.assert.called(getTxNumStub);
			kvKeyHash.version.should.deep.equal({block_num: '0', tx_num: '1'});
		});

		it('should return the correct kv read hash when version is not given', () => {
			const mockProtoKVReadHash = {
				getKeyHash: getKeyHashStub.returns({toBuffer: () => 'key-hash'}),
				getVersion: getVersionStub.returns(null)

			};
			const kvKeyHash = decodeKVReadHash(mockProtoKVReadHash);
			sinon.assert.called(getKeyHashStub);
			kvKeyHash.key_hash.should.equal('key-hash');
			sinon.assert.called(getVersionStub);
			should.equal(kvKeyHash.version, null);
		});
	});

	describe('#decodeKVWriteHash', () => {
		let decodeKVWriteHash;

		let getKeyHashStub;
		let getIsDeleteStub;
		let getValueHashStub;
		before(() => {
			decodeKVWriteHash = BlockDecoderRewire.__get__('decodeKVWriteHash');
		});

		beforeEach(() => {
			getKeyHashStub = sandbox.stub();
			getIsDeleteStub = sandbox.stub();
			getValueHashStub = sandbox.stub();
		});

		it('should return the correct key hash', () => {
			const mockProtoKVWriteHash = {
				getKeyHash: getKeyHashStub.returns({toBuffer: () => 'key-hash'}),
				getIsDelete: getIsDeleteStub.returns('is-delete'),
				getValueHash: getValueHashStub.returns({toBuffer: () => 'value-hash'})
			};
			const kvWriteHash = decodeKVWriteHash(mockProtoKVWriteHash);
			sinon.assert.called(getKeyHashStub);
			kvWriteHash.key_hash.should.equal('key-hash');
			sinon.assert.called(getIsDeleteStub);
			kvWriteHash.is_delete.should.equal('is-delete');
			sinon.assert.called(getValueHashStub);
			kvWriteHash.value_hash.should.equal('value-hash');
		});
	});

	describe('#decodeKVMetadataWriteHash', () => {
		let decodeKVMetadataWriteHash;

		let getKeyHashStub;
		let getEntriesStub;
		let decodeKVMetadataEntryStub;
		before(() => {
			decodeKVMetadataWriteHash = BlockDecoderRewire.__get__('decodeKVMetadataWriteHash');
		});

		beforeEach(() => {
			getKeyHashStub = sandbox.stub();
			getEntriesStub = sandbox.stub();
			decodeKVMetadataEntryStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataEntry', decodeKVMetadataEntryStub));
		});

		it('should return the correct kv metadata write hash', () => {
			const mockProtoKVMetatataWriteHash = {
				getKeyHash: getKeyHashStub.returns({toBuffer: () => 'key-hash'}),
				getEntries: getEntriesStub.returns(['entry'])
			};
			decodeKVMetadataEntryStub.returns('decoded-entry');
			const kvMetadataWriteHash = decodeKVMetadataWriteHash(mockProtoKVMetatataWriteHash);
			sinon.assert.called(getKeyHashStub);
			kvMetadataWriteHash.key_hash.should.equal('key-hash');
			sinon.assert.called(getEntriesStub);
			kvMetadataWriteHash.entries.should.deep.equal(['decoded-entry']);
		});
	});

	describe('#HeaderType.convertToString', () => {
		let typeAsStringStub;
		beforeEach(() => {
			typeAsStringStub = null;
		});

		it('should log an error', () => {
			revert.push(BlockDecoderRewire.__set__('type_as_string', typeAsStringStub));
			const convertedType = BlockDecoderRewire.HeaderType.convertToString('type');
			convertedType.should.equal('UNKNOWN_TYPE');
			sinon.assert.calledWith(FakeLogger.error, 'HeaderType conversion - unknown headertype - %s', 'type');
		});

		it('should return the correct type', () => {
			typeAsStringStub = {0: 'type'};
			revert.push(BlockDecoderRewire.__set__('type_as_string', typeAsStringStub));
			const convertedType = BlockDecoderRewire.HeaderType.convertToString(0);
			convertedType.should.equal('type');
		});
	});

	describe('#HeaderType.decodePayloadBasedOnType', () => {
		let decodeConfigEnvelopeStub;
		let decodeConfigUpdateEnvelopeStub;
		let decodeEndorserTransactionStub;

		beforeEach(() => {
			decodeConfigEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigEnvelope', decodeConfigEnvelopeStub));
			decodeConfigUpdateEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdateEnvelope', decodeConfigUpdateEnvelopeStub));
			decodeEndorserTransactionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeEndorserTransaction', decodeEndorserTransactionStub));
		});

		it('should call decodeConfigEnvelope', () => {
			decodeConfigEnvelopeStub.returns('config');
			const payload = BlockDecoderRewire.HeaderType.decodePayloadBasedOnType('data', 1);
			payload.should.equal('config');
			sinon.assert.calledWith(decodeConfigEnvelopeStub, 'data');
		});

		it('should call decodeConfigUpdateEnvelope', () => {
			decodeConfigUpdateEnvelopeStub.returns('config');
			const payload = BlockDecoderRewire.HeaderType.decodePayloadBasedOnType('data', 2);
			payload.should.equal('config');
			sinon.assert.calledWith(decodeConfigUpdateEnvelopeStub, 'data');
		});

		it('should call decodeEndorserTransaction', () => {
			decodeEndorserTransactionStub.returns('config');
			const payload = BlockDecoderRewire.HeaderType.decodePayloadBasedOnType('data', 3);
			payload.should.equal('config');
			sinon.assert.calledWith(decodeEndorserTransactionStub, 'data');
		});

		it('should return an empty object and call Logger.debug as a default case', () => {
			BlockDecoderRewire.HeaderType.convertToString = () => 'type';
			const payload = BlockDecoderRewire.HeaderType.decodePayloadBasedOnType('data', null);
			payload.should.deep.equal({});
			sinon.assert.calledWith(FakeLogger.debug, ' ***** found a header type of %s :: %s', null, 'type');
		});
	});
});
