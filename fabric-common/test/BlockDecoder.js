/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs');
const path = require('path');
const rewire = require('rewire');
const BlockDecoderRewire = rewire('../lib/BlockDecoder');
const should = require('chai').should();
const sinon = require('sinon');

const fabproto6 = require('fabric-protos');

describe('BlockDecoder', () => {
	let revert;

	const sandbox = sinon.createSandbox();
	let data;
	let FakeLogger;

	before(() => {
		data = fs.readFileSync(path.join(__dirname, '../../test/fixtures/crypto-material/config-base/twoorgs.genesis.block'));
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
			const type = block.data.data[0].payload.data.config.channel_group.policies.Writers.policy.typeString;
			type.should.equal('IMPLICIT_META');
		});

		it('should throw and log error object', () => {
			revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Block.decode', () => {
				throw new Error('MockError');
			}));

			(() => {
				BlockDecoderRewire.decode(data);
			}).should.throw(/MockError/);
			sinon.assert.calledOnce(FakeLogger.error);
		});

		it('should throw and log string', () => {
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Block.decode', () => {
				throw new Error('Error');
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
				number: 0,
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
				throw new Error('Error');
			}));

			(() => {
				BlockDecoderRewire.decodeBlock(blockData);
			}).should.throw();
			sinon.assert.calledOnce(FakeLogger.error);
		});
	});

	describe('#BlockDecoder.decodeBlockWithPrivateData', () => {
		const blockData = {
			header: {number: 0, previous_hash: 'previous_hash', data_hash: 'data_hash'}
		};
		let pvt_block;

		beforeEach(() => {
			pvt_block = {block: blockData, private_data_map: 'private_data_map'};
		});

		it('should throw error if block input data is missing', () => {
			(() => {
				BlockDecoderRewire.decodeBlockWithPrivateData();
			}).should.throw(/Block with private data input data is missing/);
		});

		it('should decode Block object', () => {
			revert.push(BlockDecoderRewire.__set__('decodePrivateData', (value) => {
				return value;
			}));
			revert.push(BlockDecoderRewire.__set__('decodeBlockData', () => {}));
			revert.push(BlockDecoderRewire.__set__('decodeBlockMetaData', () => {}));
			const block_with_private_data = BlockDecoderRewire.decodeBlockWithPrivateData(pvt_block);
			block_with_private_data.block.header.should.deep.equal({
				number: 0,
				previous_hash: 'previous_hash',
				data_hash: 'data_hash'
			});
			block_with_private_data.private_data_map.should.equal('private_data_map');
		});

		it('should throw and log error object', () => {
			revert.push(BlockDecoderRewire.__set__('logger', FakeLogger));
			revert.push(BlockDecoderRewire.__set__('decodePrivateData', () => {
				throw new Error('MockError');
			}));
			revert.push(BlockDecoderRewire.__set__('decodeBlockData', () => {}));
			revert.push(BlockDecoderRewire.__set__('decodeBlockMetaData', () => {}));

			(() => {
				BlockDecoderRewire.decodeBlockWithPrivateData(pvt_block);
			}).should.throw(/Block with private data decode has failed with/);
			sinon.assert.calledOnce(FakeLogger.error);
		});
	});

	describe('#BlockDecoder.decodeTransaction', () => {
		beforeEach(() => {
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ProcessedTransaction.decode', sandbox.stub().returns({
				validationCode: 'validationCode',
				transactionEnvelope: 'transactionEnvelope'
			})));

			revert.push(BlockDecoderRewire.__set__('decodeBlockDataEnvelope', (value) => {
				return value;
			}));
		});
		it('should throw error if not given a byte buffer', () => {
			(() => {
				BlockDecoderRewire.decodeTransaction(new Uint8Array(2));
			}).should.throw(/Processed transaction data is not a byte buffer/);
		});

		it('should generate a processed transaction', () => {
			const processedtransaction = BlockDecoderRewire.decodeTransaction(data);
			processedtransaction.validationCode.should.equal('validationCode');
			processedtransaction.transactionEnvelope.should.equal('transactionEnvelope');
		});
	});

	describe('#BlockDecoder.decodeFilterBlock', () => {
		it('should throw error if not given a filtered block', () => {
			(() => {
				BlockDecoderRewire.decodeFilteredBlock();
			}).should.throw(/FilteredBlock input data is missing/);
		});

		it('should decode a block if empty', () => {
			const filteredBlock = BlockDecoderRewire.decodeFilteredBlock({});
			filteredBlock.should.be.deep.equal({
				channel_id: undefined,
				filtered_transactions: []
			});
		});

		it('should decode a filtered block', () => {
			const filteredBlock = BlockDecoderRewire.decodeFilteredBlock({
				channel_id: 'channel',
				number: 1
			});
			filteredBlock.should.be.deep.equal({
				channel_id: 'channel',
				number: 1,
				filtered_transactions: []
			});
		});
	});

	describe('#decodeFilteredTransactions', () => {
		let decodeFilteredTransactions;
		before(() => {
			decodeFilteredTransactions = BlockDecoderRewire.__get__('decodeFilteredTransactions');
		});
		it('should decode a filtered trasaction if undefined', () => {
			const filtered_transactions = decodeFilteredTransactions();
			filtered_transactions.should.be.deep.equal([]);
		});
		it('should decode a filtered trasaction if empty', () => {
			const filtered_transactions = decodeFilteredTransactions({});
			filtered_transactions.should.be.deep.equal([]);
		});

		it('should decode a filtered trasaction', () => {
			const filtered_transactions = decodeFilteredTransactions([{
				txid: 'txid',
				type: 3,
				tx_validation_code: 'VALID'
			}]);
			filtered_transactions.should.be.deep.equal([{
				txid: 'txid',
				type: 3,
				typeString: 'ENDORSER_TRANSACTION',
				tx_validation_code: 'VALID',
				transaction_actions: {}
			}]);
		});
	});

	describe('#decodeFilteredTransactionActions', () => {
		let decodeFilteredTransactionActions;
		before(() => {
			decodeFilteredTransactionActions = BlockDecoderRewire.__get__('decodeFilteredTransactionActions');
		});
		it('should decode a filtered trasaction actions if undefined', () => {
			const filtered_transaction_actions = decodeFilteredTransactionActions();
			filtered_transaction_actions.should.be.deep.equal({});
		});
		it('should decode a filtered trasaction actions if empty', () => {
			const filtered_transaction_actions = decodeFilteredTransactionActions({});
			filtered_transaction_actions.should.be.deep.equal({});
		});

		it('should decode a filtered trasaction actions', () => {
			const filtered_transaction_actions = decodeFilteredTransactionActions({
				chaincode_actions: []
			});
			filtered_transaction_actions.should.be.deep.equal({
				chaincode_actions: []
			});
		});

		it('should decode a filtered trasaction actions with chaincode actions', () => {
			const filtered_transaction_actions = decodeFilteredTransactionActions({
				chaincode_actions: []
			});
			filtered_transaction_actions.should.be.deep.equal({
				chaincode_actions: []
			});
		});
	});

	describe('#decodeFilteredChaincodeAction', () => {
		let decodeFilteredChaincodeAction;
		before(() => {
			decodeFilteredChaincodeAction = BlockDecoderRewire.__get__('decodeFilteredChaincodeAction');
		});
		it('should decode a filtered chaincode action if undefined', () => {
			const filtered_chaincode_action = decodeFilteredChaincodeAction();
			filtered_chaincode_action.should.be.deep.equal({});
		});
		it('should decode a filtered chaincode action if empty', () => {
			const filtered_chaincode_action = decodeFilteredChaincodeAction({});
			filtered_chaincode_action.should.be.deep.equal({});
		});
		it('should decode a filtered chaincode action', () => {
			const filtered_transaction_actions = decodeFilteredChaincodeAction({
				chaincode_event: {
					chaincode_id: 'chaincodeId',
					tx_id: 'txId',
					event_name: 'eventName'
				}
			});
			filtered_transaction_actions.should.be.deep.equal({
				chaincode_event: {
					chaincode_id: 'chaincodeId',
					tx_id: 'txId',
					event_name: 'eventName'
				}
			});
		});
		it('should decode a filtered chaincode action and not keep payload', () => {
			const filtered_transaction_actions = decodeFilteredChaincodeAction({
				chaincode_event: {
					chaincode_id: 'chaincodeId',
					tx_id: 'txId',
					event_name: 'eventName',
					payload: Buffer.from('')
				}
			});
			filtered_transaction_actions.should.be.deep.equal({
				chaincode_event: {
					chaincode_id: 'chaincodeId',
					tx_id: 'txId',
					event_name: 'eventName'
				}
			});
		});

	});

	describe('#decodeBlockHeader', () => {
		let decodeBlockHeader;
		before(() => {
			decodeBlockHeader = BlockDecoderRewire.__get__('decodeBlockHeader');
		});

		it('should return a decoded block header', () => {
			const protoBlockHeader = {
				number: 0,
				previous_hash: 'previous-hash',
				data_hash: 'data-hash'
			};
			const result = decodeBlockHeader(protoBlockHeader);
			result.should.deep.equal({number: 0, previous_hash: 'previous-hash', data_hash: 'data-hash'});
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Envelope.decode', decodeStub));
		});

		it('should call _commonProto.Envelope.decode with buffer twice', () => {
			const protoBlockData = {
				data: [
					{key1: {}},
					{key2: {}}
				]
			};
			const newData = decodeBlockData(protoBlockData);
			sinon.assert.calledTwice(decodeStub);
			newData.data.should.deep.equal(['envelope', 'envelope']);
		});
	});

	describe('#decodeBlockMetaData', () => {
		let decodeBlockMetaData;

		let decodeMetadataSignaturesStub;
		let decodeCommitHashStub;
		let decodeTransactionFilterStub;
		before(() => {
			decodeBlockMetaData = BlockDecoderRewire.__get__('decodeBlockMetaData');
		});

		beforeEach(() => {
			decodeMetadataSignaturesStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeMetadataSignatures', decodeMetadataSignaturesStub));
			decodeTransactionFilterStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeTransactionFilter', decodeTransactionFilterStub));
			decodeCommitHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeCommitHash', decodeCommitHashStub));

		});

		it('should return the correct meta data with no paramaters', () => {
			const metadata = decodeBlockMetaData();
			metadata.metadata.should.deep.equal([]);
		});

		it('should populate the metadata', () => {
			decodeMetadataSignaturesStub.returns('decoded-metadata-signatures');
			decodeCommitHashStub.returns('decoded-commit-hash');
			decodeTransactionFilterStub.returns('decoded-transaction-filter');

			const protoBlockMetadata = {metadata: ['metadata-signature', '', 'transaction-filter', '', 'commit-hash']};
			const result = decodeBlockMetaData(protoBlockMetadata);
			sinon.assert.calledWith(decodeMetadataSignaturesStub, 'metadata-signature');
			sinon.assert.calledWith(decodeCommitHashStub, 'commit-hash');
			sinon.assert.calledWith(decodeTransactionFilterStub, 'transaction-filter');
			result.should.deep.equal({metadata: ['decoded-metadata-signatures', {}, 'decoded-transaction-filter', {}, 'decoded-commit-hash']});
		});
	});

	describe('#decodeTransactionFilter', () => {
		let decodeTransactionFilter;

		before(() => {
			decodeTransactionFilter = BlockDecoderRewire.__get__('decodeTransactionFilter');
		});

		it('should return empty array if metadata_bytes not given', () => {
			const transactionFilter = decodeTransactionFilter();
			transactionFilter.should.deep.equal([]);
		});

		it('should return empty array if string given', () => {
			const transactionFilter = decodeTransactionFilter('string');
			transactionFilter.should.deep.equal([]);
		});

		it('should add each value in metadata_bytes to transaction_filter', () => {
			const buffer = Buffer.from('1');
			const transactionFilter = decodeTransactionFilter(buffer);
			transactionFilter.should.deep.equal([49]);
		});
	});

	describe('#decodeCommitHash', () => {
		let decodeCommitHash;
		before(() => {
			decodeCommitHash = BlockDecoderRewire.__get__('decodeCommitHash');
		});

		it ('should return as given', () => {
			const result = decodeCommitHash('commit-hash');
			result.should.equal('commit-hash');
		});
	});

	describe('#decodeMetadataSignatures', () => {
		let decodeMetadataSignatures;

		let metadataDecodeStub;
		let decodeMetadataValueSignaturesStub;
		before(() => {
			decodeMetadataSignatures = BlockDecoderRewire.__get__('decodeMetadataSignatures');
		});

		beforeEach(() => {
			metadataDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Metadata.decode', metadataDecodeStub));
			decodeMetadataValueSignaturesStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeMetadataValueSignatures', decodeMetadataValueSignaturesStub));
			metadataDecodeStub.returns({value: 'value', signatures: 'signatures'});
		});

		it('should decode the metadata signatures and call decodeMetadataValueSignatures', () => {
			decodeMetadataValueSignaturesStub.returns('decoded-signatures');
			const metadataBytes = 'metadata-bytes';
			const result = decodeMetadataSignatures(metadataBytes);
			sinon.assert.calledWith(metadataDecodeStub, metadataBytes);
			sinon.assert.calledWith(decodeMetadataValueSignaturesStub, 'signatures');
			result.should.deep.equal({value: 'value', signatures: 'decoded-signatures'});
		});
	});

	describe('#decodeMetadataValueSignatures', () => {
		let decodeMetadataValueSignatures;
		beforeEach(() => {
			decodeMetadataValueSignatures = BlockDecoderRewire.__get__('decodeMetadataValueSignatures;');
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', (value) => value));
		});

		it('should return an empty array if no meta signatures are given', () => {
			decodeMetadataValueSignatures().should.be.empty;
		});

		it('should create return a list of signatures', () => {
			const signatures = [{
				signature_header: 'signature-header',
				signature: 'signature'
			}];
			const metadataValueSignatures = decodeMetadataValueSignatures(signatures);
			metadataValueSignatures[0].should.deep.equal({
				signature_header: 'signature-header',
				signature: 'signature'
			});
		});
	});

	describe('#decodeBlockDataEnvelope', () => {
		let decodeBlockDataEnvelope;

		let payloadDecodeStub;
		let decodeHeaderStub;
		let decodeConfigEnvelope;
		let decodeConfigUpdateEnvelope;
		let decodeEndorserTransaction;

		before(() => {
			decodeBlockDataEnvelope = BlockDecoderRewire.__get__('decodeBlockDataEnvelope');
		});

		beforeEach(() => {
			decodeConfigEnvelope = sandbox.stub().returns('config-envelope');
			revert.push(BlockDecoderRewire.__set__('decodeConfigEnvelope', decodeConfigEnvelope));

			decodeConfigUpdateEnvelope = sandbox.stub().returns('config-update-envelope');
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdateEnvelope', decodeConfigUpdateEnvelope));

			decodeEndorserTransaction = sandbox.stub().returns('endorser-transaction');
			revert.push(BlockDecoderRewire.__set__('decodeEndorserTransaction', decodeEndorserTransaction));

			payloadDecodeStub = sandbox.stub().returns({header: 'header', data: 'data'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Payload.decode', payloadDecodeStub));

			decodeHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHeader', decodeHeaderStub));
		});

		it('should return the decoded envelope type unknown', () => {
			decodeHeaderStub.returns({channel_header: {type: 99}});

			const protoEnvelope = {signature: 'signature', payload: 'payload'};
			const result = decodeBlockDataEnvelope(protoEnvelope);
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(decodeHeaderStub, 'header');
			result.should.deep.equal({
				payload: {
					header: {
						channel_header: {
							type: 99,
							typeString: undefined
						}
					},
					data: {}
				},
				signature: 'signature'
			});
		});
		it('should return the decoded envelope type 1', () => {
			decodeHeaderStub.returns({channel_header: {type: 1}});

			const protoEnvelope = {signature: 'signature', payload: 'payload'};
			const result = decodeBlockDataEnvelope(protoEnvelope);
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(decodeHeaderStub, 'header');
			result.should.deep.equal({
				payload: {
					header: {
						channel_header: {
							type: 1,
							typeString: 'CONFIG'
						}
					},
					data: 'config-envelope'
				},
				signature: 'signature'
			});
		});
		it('should return the decoded envelope type 2', () => {
			decodeHeaderStub.returns({channel_header: {type: 2}});

			const protoEnvelope = {signature: 'signature', payload: 'payload'};
			const result = decodeBlockDataEnvelope(protoEnvelope);
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(decodeHeaderStub, 'header');
			result.should.deep.equal({
				payload: {
					header: {
						channel_header: {
							type: 2,
							typeString: 'CONFIG_UPDATE'
						}
					},
					data: 'config-update-envelope'
				},
				signature: 'signature'
			});
		});
		it('should return the decoded envelope type 3', () => {
			decodeHeaderStub.returns({channel_header: {type: 3}});

			const protoEnvelope = {signature: 'signature', payload: 'payload'};
			const result = decodeBlockDataEnvelope(protoEnvelope);
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(decodeHeaderStub, 'header');
			result.should.deep.equal({
				payload: {
					header: {
						channel_header: {
							type: 3,
							typeString: 'ENDORSER_TRANSACTION'
						}
					},
					data: 'endorser-transaction'
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.Transaction.decode', () => {
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.Transaction.decode', () => {
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.Transaction.decode', () => {
				return null;
			}));

			const newData = decodeEndorserTransaction('trans_bytes');
			newData.should.deep.equal({actions: []});
		});

		it('should return an empty object if transaction is given with no actions', () => {
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.Transaction.decode', () => {
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
		let decodePayloadStub;
		before(() => {
			decodeConfigEnvelope = BlockDecoderRewire.__get__('decodeConfigEnvelope');
		});

		beforeEach(() => {
			configEnvelopeDecodeStub = sandbox.stub().returns({
				config: 'config',
				last_update: {
					payload: 'payload',
					signature: 'signature'
				}
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.ConfigEnvelope.decode', configEnvelopeDecodeStub));
			decodeConfigStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfig', decodeConfigStub));
			decodeHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHeader', decodeHeaderStub));
			decodeConfigUpdateEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdateEnvelope', decodeConfigUpdateEnvelopeStub));
			decodePayloadStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Payload.decode', decodePayloadStub));
		});

		it('should return the correct config envelope', () => {
			decodeConfigStub.returns('config');
			decodeHeaderStub.returns('header');
			decodeConfigUpdateEnvelopeStub.returns('data');
			decodePayloadStub.returns({header: 'payload-header', data: 'payload-data'});
			const configEnvelope = decodeConfigEnvelope({});
			sinon.assert.calledWith(decodeHeaderStub, 'payload-header');
			sinon.assert.calledWith(decodeConfigUpdateEnvelopeStub, 'payload-data');

			configEnvelope.last_update.payload.header.should.equal('header');
			configEnvelope.last_update.payload.data.should.equal('data');
			configEnvelope.last_update.signature.should.equal('signature');
		});
	});

	describe('#decodeConfig', () => {
		let decodeConfig;
		let decodeConfigGroupStub;
		before(() => {
			decodeConfig = BlockDecoderRewire.__get__('decodeConfig');
		});

		beforeEach(() => {
			decodeConfigGroupStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroup', decodeConfigGroupStub));
		});

		it('should decode the config given', () => {
			decodeConfigGroupStub.returns('decoded-config-group');
			const protoConfig = {sequence: 0, channel_group: 'channel-group'};
			const result = decodeConfig(protoConfig);
			sinon.assert.calledWith(decodeConfigGroupStub, 'channel-group');
			result.should.deep.equal({'sequence': 0, channel_group: 'decoded-config-group'});
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.ConfigUpdateEnvelope.decode', configUpdateEnvelopeStub));
			decodeConfigUpdateStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigUpdate', decodeConfigUpdateStub));
			decodeConfigSignatureStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigSignature', decodeConfigSignatureStub));
		});

		it('should return the config update envelope', () => {
			configUpdateEnvelopeStub.returns({
				config_update: 'config-update',
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.ConfigUpdate.decode', configUpdateDecodeStub));
			decodeConfigGroupStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroup', decodeConfigGroupStub));
		});

		it('should create the correct config update', () => {
			configUpdateDecodeStub.returns({
				channel_id: 'channel-id',
				read_set: 'read-set',
				write_set: 'write-set',
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
			const result = decodeConfigGroups({});
			result.should.deep.equal({});
		});

		it('should call decodeConfigGroup for each group', () => {
			decodeConfigGroupStub.returns('value');
			const configGroupMap = {'key1': 'value1', 'key2': 'value2'};
			const result = decodeConfigGroups(configGroupMap);
			sinon.assert.calledTwice(decodeConfigGroupStub);
			result.should.deep.equal({'key1': 'value', 'key2': 'value'});
		});
	});

	describe('#decodeConfigGroup', () => {
		let decodeConfigGroup;

		let decodeConfigGroups;
		let decodeConfigValues;
		let decodeConfigPolicies;

		before(() => {
			decodeConfigGroup = BlockDecoderRewire.__get__('decodeConfigGroup');
		});

		beforeEach(() => {
			decodeConfigGroups = sandbox.stub().returns('groups');
			decodeConfigValues = sandbox.stub().returns('values');
			decodeConfigPolicies = sandbox.stub().returns('policies');
			revert.push(BlockDecoderRewire.__set__('decodeConfigGroups', decodeConfigGroups));
			revert.push(BlockDecoderRewire.__set__('decodeConfigValues', decodeConfigValues));
			revert.push(BlockDecoderRewire.__set__('decodeConfigPolicies', decodeConfigPolicies));
		});

		it('should return null when no proto_config_group is given', () => {
			const configGroup = decodeConfigGroup();
			should.equal(configGroup, null);
		});
		it('should return decoded value', () => {
			const configGroup = decodeConfigGroup({
				version: 2,
				groups: 'groupsProto',
				values: 'valuesProto',
				policies: 'policiesProto',
				mod_policy: 'admins'
			});
			configGroup.should.deep.equal({
				version: 2,
				groups: 'groups',
				values: 'values',
				policies: 'policies',
				mod_policy: 'admins'
			});
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
			const configValueMap = {'key1': 'value1', 'key2': 'value2'};
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.AnchorPeers.decode', peerConfigurationProtoDecodeStub));
			protoConfigValue = {
				version: 0,
				mod_policy: 'admins',
				value: Buffer.from('test')
			};
		});

		it('should return the correct config value for AnchorPeers', () => {
			peerConfigurationProtoDecodeStub.returns({anchor_peers: [
				{host: 'host', port: 'port'}
			]});

			const configValue = decodeConfigValue(protoConfigValue, 'AnchorPeers');
			configValue.version.should.equal(0);
			configValue.mod_policy.should.equal('admins');
			configValue.value.anchor_peers.should.deep.equal([{host: 'host', port: 'port'}]);
		});

		it('should return an empty config for AnchorPeers when no anchor peers given', () => {
			const configValue = decodeConfigValue(protoConfigValue, 'AnchorPeers');
			configValue.value.anchor_peers.should.deep.equal([]);
		});

		it('should return the correct config value for MSP when config type is 0', () => {
			const decodeFabricMSPConfigStub = sandbox.stub();
			const mspConfigProtoDecodeStub = () => {
				return {type: 0, config: 'config'};
			};

			decodeFabricMSPConfigStub.returns('decoded-config');
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.MSPConfig.decode', mspConfigProtoDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeFabricMSPConfig', decodeFabricMSPConfigStub));

			const configValue = decodeConfigValue(protoConfigValue, 'MSP');
			sinon.assert.calledWith(decodeFabricMSPConfigStub, 'config');
			configValue.value.type.should.equal(0);
			configValue.value.config.should.equal('decoded-config');
		});

		it('should return the correct config value for MSP when config type is not 0', () => {
			const decodeFabricMSPConfigStub = sandbox.stub();
			const mspConfigProtoDecodeStub = () => {
				return {type: 1, config: 'config'};
			};

			decodeFabricMSPConfigStub.returns('decoded-config');
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.MSPConfig.decode', mspConfigProtoDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeFabricMSPConfig', decodeFabricMSPConfigStub));

			const configValue = decodeConfigValue(protoConfigValue, 'MSP');
			sinon.assert.notCalled(decodeFabricMSPConfigStub);
			configValue.value.type.should.equal(1);
			should.not.exist(configValue.value.config);
		});

		it('should return the correct config value for Consortium', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({name: 'name'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Consortium.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'Consortium');
			sinon.assert.calledWith(commonConfigurationProtoStub, protoConfigValue.value);
			configValue.value.name.should.equal('name');
		});

		it('should return the correct config value for OrdererAddresses', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({addresses: ['a', 'b']});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.OrdererAddresses.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'OrdererAddresses');
			configValue.value.addresses.should.deep.equal(['a', 'b']);
		});
		it('should return the correct config value for BlockDataHashingStructure', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({width: 17});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.BlockDataHashingStructure.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'BlockDataHashingStructure');
			configValue.value.width.should.deep.equal(17);
		});
		it('should return the correct config value for HashingAlgorithm', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({name: 'hash'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.HashingAlgorithm.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'HashingAlgorithm');
			configValue.value.name.should.deep.equal('hash');
		});
		it('should return the correct config value for ChannelRestrictions', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({max_count: 27});
			revert.push(BlockDecoderRewire.__set__('fabproto6.orderer.ChannelRestrictions.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'ChannelRestrictions');
			configValue.value.max_count.should.deep.equal(27);
		});
		it('should return the correct config value for BatchTimeout', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({timeout: '1000'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.orderer.BatchTimeout.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'BatchTimeout');
			configValue.value.timeout.should.deep.equal('1000');
		});
		it('should return the correct config value for BatchSize', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({
				max_message_count: 100,
				absolute_max_bytes: 2000,
				preferred_max_bytes: 1500,
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.orderer.BatchSize.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'BatchSize');
			configValue.value.should.deep.equal({
				max_message_count: 100,
				absolute_max_bytes: 2000,
				preferred_max_bytes: 1500,
			});
		});
		it('should return the correct config value for ConsensusType', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({type: 'Best'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.orderer.ConsensusType.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'ConsensusType');
			configValue.value.type.should.deep.equal('Best');
		});
		it('should return an array of strings for Capabilities', () => {
			const commonConfigurationProtoStub = sandbox.stub().returns({capabilities: ['V1_1']});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.Capabilities.decode', commonConfigurationProtoStub));

			const configValue = decodeConfigValue(protoConfigValue, 'Capabilities');
			configValue.value.capabilities.should.deep.equal(['V1_1']);
		});
		it('should return an object with ACLs', () => {
			const apiResourceFields = {
				policy_ref: 'Writers'
			};
			const apiResource = fabproto6.protos.APIResource.create(apiResourceFields);
			const aclsFields = {
				acls: {writer: apiResource}
			};
			const aclsProto = fabproto6.protos.ACLs.create(aclsFields);
			const aclsBuffer = fabproto6.protos.ACLs.encode(aclsProto).finish();
			protoConfigValue.value = aclsBuffer;

			const configValue = decodeConfigValue(protoConfigValue, 'ACLs');
			configValue.value.acls.should.deep.equal(aclsFields.acls);
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
			const configPolicyMap = {'key1': 'value1', 'key2': 'value2'};
			const result = decodeConfigPolicies(configPolicyMap);
			sinon.assert.calledTwice(decodeConfigPolicyStub);
			result.should.deep.equal({'key1': 'value', 'key2': 'value'});
		});
	});

	describe('#decodeConfigPolicy', () => {
		let decodeConfigPolicy;
		let protoConfigPolicy;
		let decodeStub;
		before(() => {
			decodeConfigPolicy = BlockDecoderRewire.__get__('decodeConfigPolicy');
		});

		beforeEach(() => {
			protoConfigPolicy = {
				version: 1,
				mod_policy: 'mod-policy',
				policy: {}
			};
		});

		it('should return the correct config policy if no policy is given', () => {
			protoConfigPolicy.policy = null;
			const configPolicy = decodeConfigPolicy(protoConfigPolicy);
			configPolicy.policy.should.deep.equal({});
		});
		it('should return the correct config policy if policy is MSP', () => {
			protoConfigPolicy.policy.type = 2;
			protoConfigPolicy.policy.value = Buffer.from('MSPtype');
			decodeConfigPolicy(protoConfigPolicy);
			sinon.assert.called(FakeLogger.warn);
		});
		it('should throw error if it doesnt recognise the policy type', () => {
			protoConfigPolicy.policy.type = 99;
			(() => {
				decodeConfigPolicy(protoConfigPolicy);
			}).should.throw(/Unknown Policy type/);
		});
		it('should return the correct config policy if policy is SIGNATURE', () => {
			protoConfigPolicy.policy.type = 1;
			protoConfigPolicy.policy.value = Buffer.from('SIGNATURE-type');
			decodeStub = sinon.stub().returns('SIGNATURE Policy');
			revert.push(BlockDecoderRewire.__set__('decodeSignaturePolicyEnvelope', decodeStub));
			const config_policy = decodeConfigPolicy(protoConfigPolicy);
			config_policy.should.deep.equal({
				version: 1,
				mod_policy: 'mod-policy',
				policy: {
					type: 1,
					typeString: 'SIGNATURE',
					value: 'SIGNATURE Policy'
				}
			});
		});
		it('should return the correct config policy if policy is IMPLICIT_META', () => {
			protoConfigPolicy.policy.type = 3;
			protoConfigPolicy.policy.value = Buffer.from('IMPLICIT_META-type');
			decodeStub = sinon.stub().returns('IMPLICIT_META Policy');
			revert.push(BlockDecoderRewire.__set__('decodeImplicitMetaPolicy', decodeStub));
			const config_policy = decodeConfigPolicy(protoConfigPolicy);
			config_policy.should.deep.equal({
				version: 1,
				mod_policy: 'mod-policy',
				policy: {
					type: 3,
					typeString: 'IMPLICIT_META',
					value: 'IMPLICIT_META Policy'
				}
			});
		});
	});

	describe('#decodeImplicitMetaPolicy', () => {
		let decodeImplicitMetaPolicy;

		let implicitMetaPolicyDecodeStub;
		before(() => {
			decodeImplicitMetaPolicy = BlockDecoderRewire.__get__('decodeImplicitMetaPolicy');
		});

		beforeEach(() => {
			implicitMetaPolicyDecodeStub = sandbox.stub().returns({
				sub_policy: 'sub-policy',
				rule: 0
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.ImplicitMetaPolicy.decode', implicitMetaPolicyDecodeStub));
		});

		it('should decode the implicit meta policy', () => {
			const result = decodeImplicitMetaPolicy('any');
			sinon.assert.calledWith(implicitMetaPolicyDecodeStub, 'any');
			result.should.deep.equal({
				sub_policy: 'sub-policy',
				rule: 0,
				ruleString: 'ANY'
			});
		});

	});

	describe('#decodeSignaturePolicyEnvelope', () => {
		let decodeSignaturePolicyEnvelope;

		let signaturePolicyEnvelopeStub;
		let decodeSignaturePolicyStub;
		let decodeMSPPrincipalStub;

		before(() => {
			decodeSignaturePolicyEnvelope = BlockDecoderRewire.__get__('decodeSignaturePolicyEnvelope');
		});

		beforeEach(() => {
			signaturePolicyEnvelopeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.SignaturePolicyEnvelope.decode', signaturePolicyEnvelopeStub));
			decodeSignaturePolicyStub = sandbox.stub().returns('signature-rule');
			revert.push(BlockDecoderRewire.__set__('decodeSignaturePolicy', decodeSignaturePolicyStub));
			decodeMSPPrincipalStub = sandbox.stub().returns('msp');
			revert.push(BlockDecoderRewire.__set__('decodeMSPPrincipal', decodeMSPPrincipalStub));
		});

		it('should return the correct signature policy envelope without identities given', () => {
			const decodedSignaurePolicyEnvelope = {
				identities: ['a', 'b'],
				version: 1,
				rule: 'rule'
			};
			signaturePolicyEnvelopeStub.returns(decodedSignaurePolicyEnvelope);
			const policy = decodeSignaturePolicyEnvelope('bytes');
			sinon.assert.calledWith(decodeSignaturePolicyStub, 'rule');
			sinon.assert.calledTwice(decodeMSPPrincipalStub);
			policy.should.deep.equal({
				version: 1,
				rule: 'signature-rule',
				identities: ['msp', 'msp']
			});
		});
	});

	describe('#decodeSignaturePolicy', () => {
		let decodeSignaturePolicy;
		before(() => {
			decodeSignaturePolicy = BlockDecoderRewire.__get__('decodeSignaturePolicy');
		});

		it('should decode signature policy noutofn given', () => {
			const protoSignaturePolicy = {n_out_of: {n:1, rules: [{signed_by: 0}]}};
			const signature_policy = decodeSignaturePolicy(protoSignaturePolicy);
			signature_policy.should.deep.equal({n_out_of: {n:1, rules: [{signed_by: 0}]}});
		});
	});

	describe('#decodeMSPPrincipal', () => {
		let decodeMSPPrincipal;
		before(() => {
			decodeMSPPrincipal = BlockDecoderRewire.__get__('decodeMSPPrincipal');
		});

		it('should return the correct msp principal with role other than 0 or 1', () => {
			const mspRoleDecodeStub = sandbox.stub().returns({
				msp_identifier: 'msp-id',
				role: 0
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.MSPRole.decode', mspRoleDecodeStub));

			const mspPrincipal = decodeMSPPrincipal({
				principal_classification: 0,
				principal: 'msp-role-principal'
			});
			sinon.assert.calledWith(mspRoleDecodeStub, 'msp-role-principal');
			mspPrincipal.principal_classification.should.equal(0);
			mspPrincipal.role.should.equal(0);
			mspPrincipal.roleString.should.equal('MEMBER');
			mspPrincipal.msp_identifier.should.equal('msp-id');
		});

		it('should return the correct msp principal with principal_classification ORGANISATION_UNIT', () => {
			const organizationUnitDecodeStub = sandbox.stub().returns({
				msp_identifier: 'msp-id',
				organizational_unit_identifier: 'organizational-unit-identifier',
				certifiers_identifier: 'certifiers-identifier'
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.OrganizationUnit.decode', organizationUnitDecodeStub));

			const mspPrincipal = decodeMSPPrincipal({
				principal_classification: 1,
				principal: 'org-unit-principal'
			});
			sinon.assert.calledWith(organizationUnitDecodeStub, 'org-unit-principal');
			mspPrincipal.msp_identifier.should.equal('msp-id');
			mspPrincipal.organizational_unit_identifier.should.equal('organizational-unit-identifier');
			mspPrincipal.certifiers_identifier.should.equal('certifiers-identifier');
		});

		it('should return the correct msp principal with principal_clasification IDENTITY', () => {
			const decodeIdentityStub = sandbox.stub().returns('identity');
			revert.push(BlockDecoderRewire.__set__('decodeIdentity', decodeIdentityStub));

			const mspPrincipal = decodeMSPPrincipal({
				principal_classification: 2,
				principal: 'identity-principal'
			});
			sinon.assert.calledWith(decodeIdentityStub, 'identity-principal');
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
				signature_header: 'signature-header',
				signature: 'signature'
			};

			const configSignature = decodeConfigSignature(protoConfigSignature);
			sinon.assert.called(decodeSignatureHeaderStub);
			configSignature.signature_header.should.equal('signature-header');
			configSignature.sigature.should.equal('signature');
		});
	});

	describe('#decodeSignatureHeader', () => {
		let decodeSignatureHeader;

		let signatureHeaderDecodeStub;
		let decodeIdentityStub;
		before(() => {
			decodeSignatureHeader = BlockDecoderRewire.__get__('decodeSignatureHeader');
		});

		beforeEach(() => {
			signatureHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.SignatureHeader.decode', signatureHeaderDecodeStub));
			signatureHeaderDecodeStub.returns({creator: 'creator', nonce: 'nonce'});
			decodeIdentityStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeIdentity', decodeIdentityStub));
		});

		it('should decode the signature header and identity before returning decoded signature header', () => {
			decodeIdentityStub.returns('identity');
			const signatureHeaderBytes = 'signature-header-bytes';
			const result = decodeSignatureHeader(signatureHeaderBytes);

			sinon.assert.calledWith(signatureHeaderDecodeStub, signatureHeaderBytes);
			sinon.assert.calledWith(decodeIdentityStub, 'creator');
			result.should.deep.equal({creator: 'identity', nonce: 'nonce'});
		});
	});

	describe('#decodeIdentity', () => {
		let decodeIdentity;

		let signatureHeaderDecodeStub;
		before(() => {
			decodeIdentity = BlockDecoderRewire.__get__('decodeIdentity');
		});

		beforeEach(() => {
			signatureHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.SerializedIdentity.decode', signatureHeaderDecodeStub));
			signatureHeaderDecodeStub.returns({mspid: 'msp-id', id_bytes: 'identity-bytes-decoded'});
		});

		it('should return a decoded identity', () => {
			const identityBytes = 'identity-bytes';
			const result = decodeIdentity(identityBytes);
			sinon.assert.calledWith(signatureHeaderDecodeStub, identityBytes);
			result.should.deep.equal({mspid: 'msp-id', id_bytes: 'identity-bytes-decoded'});
		});

		it('should log an error when identity decoding fails', () => {
			signatureHeaderDecodeStub.throws(new Error('MockError'));
			const identity = decodeIdentity({});
			sinon.assert.calledWith(FakeLogger.error, 'Failed to decode the identity: %s');
			identity.should.deep.equal({});
		});
	});

	describe('#decodeFabricMSPConfig', () => {
		let decodeFabricMSPConfig;

		let fabricMSPConfigDecodeStub;
		let toPEMcertsStub;
		let decodeSigningIdentityInfoStub;
		let decodeFabricOUIdentifierStub;
		before(() => {
			decodeFabricMSPConfig = BlockDecoderRewire.__get__('decodeFabricMSPConfig');
		});

		beforeEach(() => {
			fabricMSPConfigDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.FabricMSPConfig.decode', fabricMSPConfigDecodeStub));
			toPEMcertsStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('toPEMcerts', toPEMcertsStub));
			decodeSigningIdentityInfoStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeSigningIdentityInfo', decodeSigningIdentityInfoStub));
			decodeFabricOUIdentifierStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeFabricOUIdentifier', decodeFabricOUIdentifierStub));
			fabricMSPConfigDecodeStub.returns({
				name: 'name',
				root_certs: 'root-certs',
				intermediate_certs: 'intermediate-cert',
				admins: 'admin',
				revocation_list: 'revocation-list',
				signing_identity: 'signing-identity',
				organizational_unit_identifiers: 'unit-identifier',
				tls_root_certs: 'tls-root-cert',
				tls_intermediate_certs: 'tls-intermediate-cert'
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
			result.name.should.equal('name');

			toPEMcertsStub.getCall(0).args[0].should.equal('root-certs');
			result.root_certs.should.equal('pem-root-cert');

			toPEMcertsStub.getCall(1).args[0].should.equal('intermediate-cert');
			result.intermediate_certs.should.equal('intermediate-cert');

			toPEMcertsStub.getCall(2).args[0].should.equal('admin');
			result.admins.should.equal('admins-cert');

			toPEMcertsStub.getCall(3).args[0].should.equal('revocation-list');
			result.revocation_list.should.equal('revocation-list-cert');

			sinon.assert.calledWith(decodeSigningIdentityInfoStub, 'signing-identity');
			result.signing_identity.should.equal('decoded-signing-identity');

			sinon.assert.calledWith(decodeFabricOUIdentifierStub, 'unit-identifier');
			result.organizational_unit_identifiers.should.equal('decided-unit-identifier');

			toPEMcertsStub.getCall(4).args[0].should.equal('tls-root-cert');
			result.tls_root_certs.should.equal('tls-root-cert');

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
			const protoOrganizationalUnitIdentifiers = [{
				certificate: 'certificate',
				organizational_unit_identifier: 'organizational-unit-identifier'
			}];
			const identifiers = decodeFabricOUIdentifier(protoOrganizationalUnitIdentifiers);
			identifiers[0].certificate.should.equal('certificate');
			identifiers[0].organizational_unit_identifier.should.equal('organizational-unit-identifier');
		});
	});

	describe('#toPEMcerts', () => {

	});

	describe('#decodeSigningIdentityInfo', () => {
		let decodeSigningIdentityInfo;
		let signingIdentityInfoDecoderStub;
		let decodeKeyInfoStub;
		before(() => {
			decodeSigningIdentityInfo = BlockDecoderRewire.__get__('decodeSigningIdentityInfo');
		});

		beforeEach(() => {
			signingIdentityInfoDecoderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.SigningIdentityInfo.decode', signingIdentityInfoDecoderStub));
			decodeKeyInfoStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKeyInfo', decodeKeyInfoStub));
		});

		it('should return the correct identity info', () => {
			signingIdentityInfoDecoderStub.returns({public_signer: 'public-signer', private_signer: 'private-signer'});
			decodeKeyInfoStub.returns('decode-key-info');
			const signingIdentityInfo = decodeSigningIdentityInfo('bytes');
			sinon.assert.calledWith(signingIdentityInfoDecoderStub, 'bytes');
			sinon.assert.called(decodeKeyInfoStub);
			signingIdentityInfo.public_signer.should.equal('public-signer');
			signingIdentityInfo.private_signer.should.equal('decode-key-info');
		});
	});

	describe('#decodeKeyInfo', () => {
		let decodeKeyInfo;
		let keyInfoDecoderStub;
		before(() => {
			decodeKeyInfo = BlockDecoderRewire.__get__('decodeKeyInfo');
		});

		beforeEach(() => {
			keyInfoDecoderStub = sandbox.stub();
			keyInfoDecoderStub.returns({key_identifier: 'key-identifier'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.msp.KeyInfo.decode', keyInfoDecoderStub));
		});

		it('should return the correct key info', () => {
			const keyInfo = decodeKeyInfo({});
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
		before(() => {
			decodeHeader = BlockDecoderRewire.__get__('decodeHeader');
		});

		beforeEach(() => {
			decodeChannelHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChannelHeader', decodeChannelHeaderStub));
			decodeSignatureHeaderStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeSignatureHeader', decodeSignatureHeaderStub));
		});

		it('should decode and return the header', () => {
			decodeChannelHeaderStub.returns('channel-header');
			decodeSignatureHeaderStub.returns('signature-header');
			const headerBytes = {
				channel_header: 'channel-header',
				signature_header: 'signature-header'
			};
			const result = decodeHeader(headerBytes);
			sinon.assert.calledWith(decodeChannelHeaderStub, 'channel-header');
			sinon.assert.calledWith(decodeSignatureHeaderStub, 'signature-header');
			result.channel_header.should.equal('channel-header');
			result.signature_header.should.equal('signature-header');
		});
	});

	describe('#decodeChannelHeader', () => {
		let decodeChannelHeader;

		let channelHeaderDecodeStub;
		let convertVersionStub;
		let timeStampToDateStub;
		before(() => {
			decodeChannelHeader = BlockDecoderRewire.__get__('decodeChannelHeader');
		});

		beforeEach(() => {
			channelHeaderDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.common.ChannelHeader.decode', channelHeaderDecodeStub));
			convertVersionStub = sandbox.stub().returns('version-converted');
			revert.push(BlockDecoderRewire.__set__('convertVersion', convertVersionStub));
			timeStampToDateStub = sandbox.stub().returns('timestamp-formatted');
			revert.push(BlockDecoderRewire.__set__('timeStampToDate', timeStampToDateStub));

			channelHeaderDecodeStub.returns({
				type: 'type',
				version: 'version',
				timestamp: 'timestamp',
				channel_id: 'channel-id',
				tx_id: 'tx-id',
				epoch: 'epoch',
				extension: 'extension'
			});
		});

		it('should decode and return the channel header', () => {
			const result = decodeChannelHeader('header_bytes');
			sinon.assert.calledWith(channelHeaderDecodeStub, 'header_bytes');
			result.type.should.equal('type');
			sinon.assert.calledWith(convertVersionStub, 'version');
			sinon.assert.calledWith(timeStampToDateStub, 'timestamp');
			result.version.should.equal('version-converted');
			result.timestamp.should.equal('timestamp-formatted');
			result.channel_id.should.equal('channel-id');
			result.tx_id.should.equal('tx-id');
			result.epoch.should.equal('epoch');
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
		let decodeChaincodeProposalPayloadStub;
		let decodeChaincodeEndorsedActionStub;
		before(() => {
			decodeChaincodeActionPayload = BlockDecoderRewire.__get__('decodeChaincodeActionPayload');
		});

		beforeEach(() => {
			chaincodeActionPayloadStub = sandbox.stub();
			chaincodeActionPayloadStub.returns({chaincode_proposal_payload: 'chaincode', action: 'action'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ChaincodeActionPayload.decode', chaincodeActionPayloadStub));
			decodeChaincodeProposalPayloadStub = sandbox.stub();

			revert.push(BlockDecoderRewire.__set__('decodeChaincodeProposalPayload', decodeChaincodeProposalPayloadStub));
			decodeChaincodeEndorsedActionStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeEndorsedAction', decodeChaincodeEndorsedActionStub));
		});

		it('should return the correct chaincode action payload', () => {
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

		let decodeChaincodeProposalPayloadInputStub;
		before(() => {
			decodeChaincodeProposalPayload = BlockDecoderRewire.__get__('decodeChaincodeProposalPayload');
		});

		beforeEach(() => {
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ChaincodeProposalPayload.decode', sandbox.stub().returns({input: 'input'})));
			decodeChaincodeProposalPayloadInputStub = sandbox.stub().returns('decoded-input');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeProposalPayloadInput', decodeChaincodeProposalPayloadInputStub));
		});

		it('should return the correct chaincode proposal payload', () => {
			const chaincodeProposalPayload = decodeChaincodeProposalPayload({});
			sinon.assert.calledWith(decodeChaincodeProposalPayloadInputStub, 'input');
			chaincodeProposalPayload.input.should.equal('decoded-input');
		});
	});

	describe('#decodeChaincodeProposalPayloadInput', () => {
		let decodeChaincodeProposalPayloadInput;

		let chaincodeInvocationSpecDecodeStub;
		let decodeChaincodeSpecStub;
		before(() => {
			decodeChaincodeProposalPayloadInput = BlockDecoderRewire.__get__('decodeChaincodeProposalPayloadInput');
		});

		beforeEach(() => {
			chaincodeInvocationSpecDecodeStub = sandbox.stub();
			chaincodeInvocationSpecDecodeStub.returns({chaincodeSpec: 'chaincode_spec'});
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ChaincodeInvocationSpec.decode', chaincodeInvocationSpecDecodeStub));

			decodeChaincodeSpecStub = sandbox.stub().returns('chaincode-spec');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeSpec', decodeChaincodeSpecStub));
		});

		it('should return the correct chaincode proposal payload input', () => {
			const chaincodeProposalPayloadInput = decodeChaincodeProposalPayloadInput({});
			sinon.assert.called(chaincodeInvocationSpecDecodeStub);
			chaincodeProposalPayloadInput.chaincode_spec.should.equal('chaincode-spec');
		});
	});

	describe('#decodeChaincodeSpec', () => {
		let decodeChaincodeSpec;
		let decodeChaincodeInputStub;
		before(() => {
			decodeChaincodeSpec = BlockDecoderRewire.__get__('decodeChaincodeSpec');
		});

		beforeEach(() => {
			decodeChaincodeInputStub = sandbox.stub().returns('decoded-chaincode-input');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeInput', decodeChaincodeInputStub));
		});

		it('should return the correct decoded chaincode spec', () => {
			const chaincodeSpec = decodeChaincodeSpec({type: 1, chaincode_id: 'chaincode-id', timeout: 1000, input: 'input'});
			sinon.assert.calledWith(decodeChaincodeInputStub, 'input');
			chaincodeSpec.typeString.should.equal('GOLANG');
			chaincodeSpec.input.should.equal('decoded-chaincode-input');
			chaincodeSpec.chaincode_id.should.equal('chaincode-id');
			chaincodeSpec.timeout.should.equal(1000);
		});
	});

	describe('#decodeChaincodeInput', () => {
		let decodeChaincodeInput;
		before(() => {
			decodeChaincodeInput = BlockDecoderRewire.__get__('decodeChaincodeInput');
		});

		it('should return the correct decoded chaincode input', () => {
			const input = decodeChaincodeInput({args: ['arg1'], decorations: {key1: 'value'}});
			input.args.should.deep.equal(['arg1']);
			input.decorations.should.deep.equal({'key1': 'value'});
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
			decodeEndorsementStub.returns('endorsement');
			const action = decodeChaincodeEndorsedAction({proposalResponsePayload: 'buffer', endorsements: ['e1', 'e2']});
			sinon.assert.called(decodeProposalResponsePayloadStub);
			sinon.assert.calledTwice(decodeEndorsementStub);
			action.proposal_response_payload.should.equal('proposal-payload-response');
			action.endorsements[0].should.equal('endorsement');
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
				endorser: 'endorser',
				signature: 'signature'
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
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ProposalResponsePayload.decode', proposalResponsePayloadDecodeStub));
			proposalResponsePayloadDecodeStub.returns({
				proposal_hash: 'proposal-hash',
				extension: 'extensionToBeDecoded'
			});
			decodeChaincodeActionStub = sandbox.stub().returns('extension');
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeAction', decodeChaincodeActionStub));
		});

		it('should return the correct proposal response payload', () => {
			const proposalResponsePayload = decodeProposalResponsePayload({});
			proposalResponsePayload.proposal_hash.should.equal('proposal-hash');
			proposalResponsePayload.extension.should.equal('extension');
			sinon.assert.calledWith(decodeChaincodeActionStub, 'extensionToBeDecoded');
		});
	});

	describe('#decodeChaincodeAction', () => {
		let decodeChaincodeAction;

		let chaincodeActionDecodeStub;
		let decodeReadWriteSetsStub;
		let decodeChaincodeEventStub;
		let decodeResponseStub;
		let decodeChaincodeIdStub;
		before(() => {
			decodeChaincodeAction = BlockDecoderRewire.__get__('decodeChaincodeAction');
		});

		beforeEach(() => {
			chaincodeActionDecodeStub = sandbox.stub().returns({
				results: 'results',
				events: 'events',
				response: 'response',
				chaincode_id: 'chaincode-id'
			});
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ChaincodeAction.decode', chaincodeActionDecodeStub));
			decodeReadWriteSetsStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeReadWriteSets', decodeReadWriteSetsStub));
			decodeChaincodeEventStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeEvent', decodeChaincodeEventStub));
			decodeResponseStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeResponse', decodeResponseStub));
			decodeChaincodeIdStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeChaincodeID', decodeChaincodeIdStub));
		});

		it('should return the correct chaincode action payload', () => {
			decodeReadWriteSetsStub.returns('read-write');
			decodeChaincodeEventStub.returns('decoded-events');
			decodeResponseStub.returns('decoded-response');
			decodeChaincodeIdStub.returns('decoded-chaincode-id');
			const chaincodeAction = decodeChaincodeAction('action_bytes');
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeAction - start');
			sinon.assert.calledWith(chaincodeActionDecodeStub, 'action_bytes');
			sinon.assert.calledWith(decodeReadWriteSetsStub, 'results');
			sinon.assert.calledWith(decodeChaincodeEventStub, 'events');
			sinon.assert.calledWith(decodeResponseStub, 'response');
			sinon.assert.calledWith(decodeChaincodeIdStub, 'chaincode-id');
			chaincodeAction.results.should.equal('read-write');
			chaincodeAction.events.should.equal('decoded-events');
			chaincodeAction.response.should.equal('decoded-response');
			chaincodeAction.chaincode_id.should.equal('decoded-chaincode-id');
		});
	});

	describe('#decodeChaincodeEvent', () => {
		let decodeChaincodeEvent;

		let chaincodeEventDecodeStub;
		before(() => {
			decodeChaincodeEvent = BlockDecoderRewire.__get__('decodeChaincodeEvent');
		});

		beforeEach(() => {
			chaincodeEventDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.protos.ChaincodeEvent.decode', chaincodeEventDecodeStub));
			chaincodeEventDecodeStub.returns({
				chaincode_id: 'chaincode-id',
				tx_id: 'tx-id',
				event_name: 'event-name',
				payload: 'payload'
			});
		});

		it('should return the correct decoded event', () => {
			const decodedEvent = decodeChaincodeEvent('event_bytes');
			decodedEvent.chaincode_id.should.equal('chaincode-id');
			decodedEvent.tx_id.should.equal('tx-id');
			decodedEvent.event_name.should.equal('event-name');
			decodedEvent.payload.should.equal('payload');
		});
	});

	describe('#decodeChaincodeID', () => {
		let decodeChaincodeID;

		before(() => {
			decodeChaincodeID = BlockDecoderRewire.__get__('decodeChaincodeID');
		});

		it('should log and return an empty object when no proto_chaincode_id is given', () => {
			const decodedChaincodeId = decodeChaincodeID();
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeID - no chaincodeIDProto found');
			decodedChaincodeId.should.deep.equal({});
		});

		it('should return the correct decoded chaincode id', () => {
			const mockProtoChaincodeId = {
				path: 'path',
				name: 'name',
				version: 'version'
			};
			const chaincodeId = decodeChaincodeID(mockProtoChaincodeId);
			sinon.assert.calledWith(FakeLogger.debug, 'decodeChaincodeID - start');
			chaincodeId.path.should.equal('path');
			chaincodeId.name.should.equal('name');
			chaincodeId.version.should.equal('version');
		});
	});

	describe('#decodeReadWriteSets', () => {
		let decodeReadWriteSets;

		let txReadWriteSetDecodeStub;
		let decodeCollectionHashedRWSetStub;
		let decodeKVRWSetStub;
		before(() => {
			decodeReadWriteSets = BlockDecoderRewire.__get__('decodeReadWriteSets');
		});

		beforeEach(() => {
			txReadWriteSetDecodeStub = sandbox.stub().returns({
				data_model: 'data-model',
				ns_rwset: 'ns-rwset'
			});
			decodeKVRWSetStub = sandbox.stub();
			decodeCollectionHashedRWSetStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.rwset.TxReadWriteSet.decode', txReadWriteSetDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVRWSet', decodeKVRWSetStub));
			revert.push(BlockDecoderRewire.__set__('decodeCollectionHashedRWSet', decodeCollectionHashedRWSetStub));
		});

		it('should return the correct read write set when data model not KV', () => {
			const readWriteSet = decodeReadWriteSets('buffer');
			readWriteSet.ns_rwset.should.equal('ns-rwset');
			readWriteSet.data_model.should.equal('data-model');
		});

		it('should return the correct read write set when the data model is KV', () => {
			decodeKVRWSetStub.returns('rwset');
			decodeCollectionHashedRWSetStub.returns('collection-hashed-rwset');
			txReadWriteSetDecodeStub.returns({
				data_model: 0,
				ns_rwset: [{
					namespace: 'namespace',
					rwset: 'rwset-internal',
					collection_hashed_rwset: 'collection-hashed-rwset-interanl'
				}]
			});
			const readWriteSet = decodeReadWriteSets('buffer');
			const nsRwSet = readWriteSet.ns_rwset[0];
			nsRwSet.namespace.should.equal('namespace');
			nsRwSet.rwset.should.equal('rwset');
			sinon.assert.calledWith(decodeKVRWSetStub, 'rwset-internal');
			nsRwSet.collection_hashed_rwset.should.equal('collection-hashed-rwset');
			sinon.assert.calledWith(decodeCollectionHashedRWSetStub, 'collection-hashed-rwset-interanl');
		});
	});

	describe('#decodeKVRWSet', () => {
		let deocdeKVRWSet;

		let KVRWSetDecodeStub;
		let decodeKVReadStub;
		let decodeKVWriteStub;
		let decodeRangeQueryInfoStub;
		let decodeKVMetadataWriteStub;
		before(() => {
			deocdeKVRWSet = BlockDecoderRewire.__get__('decodeKVRWSet');
		});

		beforeEach(() => {
			decodeKVReadStub = sandbox.stub();
			KVRWSetDecodeStub = sandbox.stub();
			decodeRangeQueryInfoStub = sandbox.stub();
			decodeKVWriteStub = sandbox.stub();
			decodeKVMetadataWriteStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.kvrwset.KVRWSet.decode', KVRWSetDecodeStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVRead', decodeKVReadStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVWrite', decodeKVWriteStub));
			revert.push(BlockDecoderRewire.__set__('decodeRangeQueryInfo', decodeRangeQueryInfoStub));
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataWrite', decodeKVMetadataWriteStub));
		});

		it('should return the correct decoded kv_rw_set', () => {
			KVRWSetDecodeStub.returns({
				writes: ['write'],
				reads: ['read'],
				range_queries_info: ['range-queries-info'],
				metadata_writes: ['metadata-write']
			});
			decodeRangeQueryInfoStub.returns('range-query-info');
			decodeKVMetadataWriteStub.returns('metadata-write');
			decodeKVReadStub.returns('read');
			decodeKVWriteStub.returns('write');
			const kvRwSet = deocdeKVRWSet('kv_bytes');
			sinon.assert.calledWith(KVRWSetDecodeStub, 'kv_bytes');
			sinon.assert.calledOnce(decodeKVReadStub);
			sinon.assert.calledOnce(decodeKVWriteStub);
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

		before(() => {
			decodeKVRead = BlockDecoderRewire.__get__('decodeKVRead');
		});

		it('should return the correct kv read', () => {
			const mockProtoKvRead = {key: 1, version: {block_num: 0, tx_num: 1}};
			const kvRead = decodeKVRead(mockProtoKvRead);
			kvRead.key.should.equal(1);
			kvRead.version.block_num.should.equal(0);
			kvRead.version.tx_num.should.equal(1);
		});

		it('should return the correct kv read when proto_version not present', () => {
			const mockProtoKvRead = {key: 1};
			const kvRead = decodeKVRead(mockProtoKvRead);
			kvRead.key.should.equal(1);
			should.equal(kvRead.version, undefined);
		});
	});

	describe('#decodeRangeQueryInfo', () => {
		let decodeRangeQueryInfo;

		let decodeKVReadStub;
		let mockMerkelHash;
		before(() => {
			decodeRangeQueryInfo = BlockDecoderRewire.__get__('decodeRangeQueryInfo');
		});

		beforeEach(() => {
			decodeKVReadStub = sandbox.stub();
			mockMerkelHash = {max_degree: 'max-degree', max_level: 'max-level', max_level_hashes: 'max-level-hashes'};
			revert.push(BlockDecoderRewire.__set__('decodeKVRead', decodeKVReadStub));
		});

		it('should return the correct range query info with raw reads', () => {
			decodeKVReadStub.returns('kvread');
			const mockProtoRangeQueryInfo = {
				start_key: 'start_key',
				end_key: 'end_key',
				itr_exhausted: 'itr_exhausted',
				raw_reads: {kv_reads: ['kv_read']}
			};
			const rangeQueryInfo = decodeRangeQueryInfo(mockProtoRangeQueryInfo);
			rangeQueryInfo.start_key.should.equal('start_key');
			rangeQueryInfo.end_key.should.equal('end_key');
			rangeQueryInfo.itr_exhausted.should.equal('itr_exhausted');
			sinon.assert.calledWith(decodeKVReadStub, 'kv_read');
		});

		it('should return the correct range query info with reads merklehashes', () => {
			decodeKVReadStub.returns('kvread');
			const mockProtoRangeQueryInfo = {
				start_key: 'start_key',
				end_key: 'end_key',
				itr_exhausted: 'itr_exhausted',
				reads_merkle_hashes: mockMerkelHash
			};
			const rangeQueryInfo = decodeRangeQueryInfo(mockProtoRangeQueryInfo);
			rangeQueryInfo.start_key.should.equal('start_key');
			rangeQueryInfo.end_key.should.equal('end_key');
			rangeQueryInfo.itr_exhausted.should.equal('itr_exhausted');
			sinon.assert.notCalled(decodeKVReadStub);
			rangeQueryInfo.reads_merkle_hashes.should.deep.equal({max_degree: 'max-degree', max_level: 'max-level', max_level_hashes: 'max-level-hashes'});
		});

		it('should return the correct range query info where there are no raw reads or merkle hashes', () => {
			const mockProtoRangeQueryInfo = {
				start_key: 'start_key',
				end_key: 'end_key',
				itr_exhausted: 'itr_exhausted'
			};
			const rangeQueryInfo = decodeRangeQueryInfo(mockProtoRangeQueryInfo);
			rangeQueryInfo.start_key.should.equal('start_key');
			rangeQueryInfo.end_key.should.equal('end_key');
			rangeQueryInfo.itr_exhausted.should.equal('itr_exhausted');
		});
	});

	describe('#decodeKVWrite', () => {
		let decodeKVWrite;

		before(() => {
			decodeKVWrite = BlockDecoderRewire.__get__('decodeKVWrite');
		});

		it('should return the correct kv write', () => {
			const mockProtoKVWrite = {
				key: 'key',
				is_delete: 'is_delete',
				value: 'value'
			};

			const kvWrite = decodeKVWrite(mockProtoKVWrite);
			kvWrite.key.should.equal('key');
			kvWrite.is_delete.should.equal('is_delete');
			kvWrite.value.should.equal('value');
		});
	});

	describe('#decodeKVMetadataWrite', () => {
		let decodeKVMetadataWrite;

		let decodeKVMetadataEntryStub;
		before(() => {
			decodeKVMetadataWrite = BlockDecoderRewire.__get__('decodeKVMetadataWrite');
		});

		beforeEach(() => {
			decodeKVMetadataEntryStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataEntry', decodeKVMetadataEntryStub));
		});

		it('should return the correct kv metadata', () => {
			const mockProtokvMetadataWrite = {
				key: 'key',
				entries: ['entry'],
			};
			decodeKVMetadataEntryStub.returns('metadata');
			const kvMetadataWrite = decodeKVMetadataWrite(mockProtokvMetadataWrite);
			sinon.assert.calledWith(decodeKVMetadataEntryStub, 'entry');
			kvMetadataWrite.key.should.equal('key');
			kvMetadataWrite.entries.should.deep.equal(['metadata']);
		});
	});

	describe('decodeKVMetadataEntry', () => {
		let decodeKVMetadataEntry;

		before(() => {
			decodeKVMetadataEntry = BlockDecoderRewire.__get__('decodeKVMetadataEntry');
		});

		it('should return the correct kv metadata entry', () => {
			const mockProtoMetadataEntry = {
				name: 'name',
				value: 'value'
			};

			const kvMetadataEntry = decodeKVMetadataEntry(mockProtoMetadataEntry);
			kvMetadataEntry.name.should.equal('name');
			kvMetadataEntry.value.should.equal('value');
		});
	});

	describe('#decodeResponse', () => {
		let decodeResponse;

		before(() => {
			decodeResponse = BlockDecoderRewire.__get__('decodeResponse');
		});

		it('should return the correct response', () => {
			const mockProtoResponse = {
				status: 'status',
				message: 'message',
				payload: 'payload'
			};

			const response = decodeResponse(mockProtoResponse);
			response.status.should.equal('status');
			response.message.should.equal('message');
			response.payload.should.equal('payload');
		});

		it('should return null when no proto response is given', () => {
			const response = decodeResponse();
			should.equal(response, undefined);
		});
	});

	describe('#convertVersion', () => {
		let convertVersion;

		before(() => {
			convertVersion = BlockDecoderRewire.__get__('convertVersion');
		});

		it('should return the verson number of type int', () => {
			const result = convertVersion(10.2);
			result.should.equal(10);
		});
	});

	describe('#decodeCollectionHashedRWSet', () => {
		let decodeCollectionHashedRWSet;

		let decodeHashedRwsetStub;
		before(() => {
			decodeCollectionHashedRWSet = BlockDecoderRewire.__get__('decodeCollectionHashedRWSet');
		});

		beforeEach(() => {
			decodeHashedRwsetStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeHashedRwset', decodeHashedRwsetStub));
		});

		it('should return the correct collection hashed rw set', () => {
			const mockCollectionHashedRw = {
				collection_name: 'name',
				hashed_rwset: 'hashed-rw-set',
				pvt_rwset_hash: 'pvt-rw-set'
			};
			decodeHashedRwsetStub.returns('rw-set');
			const rwSet = decodeCollectionHashedRWSet([mockCollectionHashedRw]);
			rwSet[0].collection_name.should.equal('name');
			sinon.assert.calledWith(decodeHashedRwsetStub, 'hashed-rw-set');
			rwSet[0].hashed_rwset.should.equal('rw-set');
			rwSet[0].pvt_rwset_hash.should.equal('pvt-rw-set');
		});
	});

	describe('#decodeHashedRwset', () => {
		let decodeHashedRwset;

		let hashedRwsetDecodeStub;
		let decodeKVReadHashStub;
		let decodeKVWriteHashStub;
		let decodeKVMetadataWriteHashStub;
		before(() => {
			decodeHashedRwset = BlockDecoderRewire.__get__('decodeHashedRwset');
		});

		beforeEach(() => {
			hashedRwsetDecodeStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('fabproto6.kvrwset.HashedRWSet.decode', hashedRwsetDecodeStub));
			decodeKVReadHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVReadHash', decodeKVReadHashStub));
			decodeKVWriteHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVWriteHash', decodeKVWriteHashStub));
			decodeKVMetadataWriteHashStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataWriteHash', decodeKVMetadataWriteHashStub));

			hashedRwsetDecodeStub.returns({
				hashed_reads: ['read'],
				hashed_writes: ['write'],
				metadata_writes: ['metadata']
			});
		});

		it('should return the correct hashe rw set', () => {
			decodeKVReadHashStub.returns('read-decode');
			decodeKVWriteHashStub.returns('write-decode');
			decodeKVMetadataWriteHashStub.returns('metadata-decode');
			const rwset = decodeHashedRwset({});
			sinon.assert.called(decodeKVReadHashStub);
			rwset.hashed_reads.should.deep.equal(['read-decode']);
			sinon.assert.called(decodeKVWriteHashStub);
			rwset.hashed_writes.should.deep.equal(['write-decode']);
			sinon.assert.called(decodeKVMetadataWriteHashStub);
			rwset.metadata_writes.should.deep.equal(['metadata-decode']);
		});
	});

	describe('#decodeKVReadHash', () => {
		let decodeKVReadHash;

		before(() => {
			decodeKVReadHash = BlockDecoderRewire.__get__('decodeKVReadHash');
		});

		it('should return the correct kv read hash', () => {
			const mockProtoKVReadHash = {
				key_hash: 'key-hash',
				version: {block_num: 0, tx_num: 1}
			};
			const kvKeyHash = decodeKVReadHash(mockProtoKVReadHash);
			kvKeyHash.key_hash.should.equal('key-hash');
			kvKeyHash.version.should.deep.equal({block_num: 0, tx_num: 1});
		});

		it('should return the correct kv read hash when version is not given', () => {
			const mockProtoKVReadHash = {
				key_hash: 'key-hash',
				version: null
			};
			const kvKeyHash = decodeKVReadHash(mockProtoKVReadHash);
			kvKeyHash.key_hash.should.equal('key-hash');
			should.equal(kvKeyHash.version, undefined);
		});
	});

	describe('#decodeKVWriteHash', () => {
		let decodeKVWriteHash;

		before(() => {
			decodeKVWriteHash = BlockDecoderRewire.__get__('decodeKVWriteHash');
		});

		it('should return the correct key hash', () => {
			const mockProtoKVWriteHash = {
				key_hash: 'key-hash',
				is_delete: 'is-delete',
				value_hash: 'value-hash'
			};
			const kvWriteHash = decodeKVWriteHash(mockProtoKVWriteHash);
			kvWriteHash.key_hash.should.equal('key-hash');
			kvWriteHash.is_delete.should.equal('is-delete');
			kvWriteHash.value_hash.should.equal('value-hash');
		});
	});

	describe('#decodeKVMetadataWriteHash', () => {
		let decodeKVMetadataWriteHash;

		let decodeKVMetadataEntryStub;
		before(() => {
			decodeKVMetadataWriteHash = BlockDecoderRewire.__get__('decodeKVMetadataWriteHash');
		});

		beforeEach(() => {
			decodeKVMetadataEntryStub = sandbox.stub();
			revert.push(BlockDecoderRewire.__set__('decodeKVMetadataEntry', decodeKVMetadataEntryStub));
		});

		it('should return the correct kv metadata write hash', () => {
			const mockProtoKVMetatataWriteHash = {
				key_hash: 'key-hash', // bytes
				entries: ['entry'] // repeated KVMetadataEntry
			};
			decodeKVMetadataEntryStub.returns('decoded-entry');
			const kvMetadataWriteHash = decodeKVMetadataWriteHash(mockProtoKVMetatataWriteHash);
			kvMetadataWriteHash.key_hash.should.equal('key-hash');
			kvMetadataWriteHash.entries.should.deep.equal(['decoded-entry']);
		});
	});

	describe('#decodePrivateData', () => {
		let decodePrivateData;
		let decodeKVRWSet;

		const privateDataMapProto = {0: // map key is transaction index
			// TxPvtReadWriteSet
			{
				data_model: 0, // enum KV
				ns_pvt_rwset: [
					// NSPvtReadWriteSet
					{
						namespace: 'namespace-string',
						collection_pvt_rwset: [
							// CollectionReadWriteSet
							{
								collection_name: 'collectionName-string',
								rwset: 'rwset-bytes' // decoded by decodeKVRWSet
							}
						]
					}
				]
			}
		};

		beforeEach(() => {
			decodePrivateData = BlockDecoderRewire.__get__('decodePrivateData');
			decodeKVRWSet = sandbox.stub().returns('rwset-decode');
			revert.push(BlockDecoderRewire.__set__('decodeKVRWSet', decodeKVRWSet));
		});
		it('should run with no data', () => {
			const private_data_map = decodePrivateData();
			should.exist(private_data_map);
		});

		it('should return the correct rwset', () => {
			const private_data_map = decodePrivateData(privateDataMapProto);
			private_data_map[0].ns_pvt_rwset[0].collection_pvt_rwset[0].rwset.should.equal('rwset-decode');
			private_data_map[0].ns_pvt_rwset[0].collection_pvt_rwset[0].collection_name.should.equal('collectionName-string');
			private_data_map[0].ns_pvt_rwset[0].namespace.should.equal('namespace-string');
			sinon.assert.called(decodeKVRWSet);
		});
	});
});
