const coreApi = require("./../app/api/coreApi.js");
const addressApi = require("./../app/api/addressApi.js");
const utils = require("./../app/utils.js");
const debug = require("debug");
const debugLog = debug("btcexp:core");
const bitcoinjs = require('bitcoinjs-lib');
const Cache = require("./../app/cache.js");
const util = require('util');
const moment = require('moment');
const pug = require('pug');
const sha256 = require("crypto-js/sha256");
const hexEnc = require("crypto-js/enc-hex");
const qrcode = require('qrcode');
const Decimal = require("decimal.js");
const config = require("../app/config");
const htmlViewCache = new Cache(100);
class Session {
	constructor(req, res, next, config) {
		this.req = req;
		this.res = res;
		this.next = next;
		this.config = config;
	}

	isRenderConnect() {
		if (this.req.session.host == null || this.req.session.host.trim() == "") {
			if (this.req.cookies['rpc-host']) {
				this.res.locals.host = this.req.cookies['rpc-host'];
			}

			if (this.req.cookies['rpc-port']) {
				this.res.locals.port = this.req.cookies['rpc-port'];
			}

			if (this.req.cookies['rpc-username']) {
				this.res.locals.username = this.req.cookies['rpc-username'];
			}

			this.res.render("connect");
			this.res.end();
			return true;
		}
		return false;
	}

	parseAddressRequest(assetSupported, hasassets) {
		var limit = this.config.site.addressTxPageSize;
		var startBlock = 1;
		var numBlocks = 10000;
		var offset = 0;
		var sort = "desc";
		var assetName;
		if (this.req.query.limit) {
			limit = parseInt(this.req.query.limit);
		}

		if (this.req.query.offset) {
			offset = parseInt(this.req.query.offset);
		}

		if (this.req.query.sort) {
			sort =this. req.query.sort;
		}

		if (this.req.query.startBlock) {
			startBlock = parseInt(this.req.query.startBlock);
		}
		if (this.req.query.numBlocks) {
			numBlocks = parseInt(this.req.query.numBlocks);
		}


		var address = this.req.params.address;
		this.res.locals.address = address;
		this.res.locals.limit = limit;
		this.res.locals.offset = offset;
		this.res.locals.sort = sort;
		this.res.locals.startBlock = startBlock;
		this.res.locals.numBlocks = numBlocks;
		this.res.locals.transactions = [];
		this.res.locals.addressApiSupport = addressApi.getCurrentAddressApiFeatureSupport();
		this.res.locals.result = {};
		try {
			this.res.locals.addressObj = bitcoinjs.address.fromBase58Check(address);
		} catch (err) {
			if (!err.toString().startsWith("Error: Non-base58 character")) {
				this.res.locals.pageErrors.push(utils.logError("u3gr02gwef", err));
			}
			try {
				this.res.locals.addressObj = bitcoinjs.address.fromBech32(address);
			} catch (err2) {
				this.res.locals.pageErrors.push(utils.logError("u02qg02yqge", err));
			}
		}
		if (global.miningPoolsConfigs) {
			for (var i = 0; i < global.miningPoolsConfigs.length; i++) {
				if (global.miningPoolsConfigs[i].payout_addresses[address]) {
					this.res.locals.payoutAddressForMiner = global.miningPoolsConfigs[i].payout_addresses[address];
				}
			}
		}
		if(assetSupported || hasassets) {
			if(this.req.query.assetName) {
				assetName = this.req.query.assetName;
				this.res.locals.paginationBaseUrl = `/addressview/${address}?assetName=${assetName}&sort=${sort}`;
				this.res.locals.assetName = assetName;
				this.res.locals.dynamicContainerId = `tab-${assetName}`
			} else {
				this.res.locals.paginationBaseUrl = `/addressview/${address}?assetName=${this.config.coin}&sort=${sort}`;
				this.res.locals.dynamicContainerId = `tab-${this.config.coin}`
			}
		} else {
			this.res.locals.paginationBaseUrl = `/addressview/${address}?sort=${sort}`;
			this.res.locals.dynamicContainerId = "trans-history";
		}
	}
	getTransactionsDetail(txids, assetName) {
		let self = this;
		let result = this.res.locals;
		return new Promise(function(resolve, reject) {
			result = Object.assign(result, {
				transactions : [],
				blockHeightsByTxid : {},
			});
			coreApi.getRawTransactionsWithInputs(txids, 10).then(function(rawTxResult) {
				result.transactions = rawTxResult.transactions;
				// for coinbase txs, we need the block height in order to calculate subsidy to display
				let coinbaseTxs = [];
				for (let i = 0; i < rawTxResult.transactions.length; i++) {
					let tx = rawTxResult.transactions[i];
					for (let j = 0; j < tx.vin.length; j++) {
						if (tx.vin[j].coinbase) {
							// addressApi sometimes has blockHeightByTxid already available, otherwise we need to query for it
							if (!result.blockHeightsByTxid[tx.txid]) {
								coinbaseTxs.push(tx);
							}
						}
					}
				}
				let coinbaseTxBlockHashes = [];
				let blockHashesByTxid = {};
				coinbaseTxs.forEach(function(tx) {
					coinbaseTxBlockHashes.push(tx.blockhash);
					blockHashesByTxid[tx.txid] = tx.blockhash;
				});
				let blockHeightsPromises = [];
				if (coinbaseTxs.length > 0) {
					// we need to query some blockHeights by hash for some coinbase txs
					blockHeightsPromises.push(new Promise(function(resolve2, reject2) {
						coreApi.getBlocksByHash(coinbaseTxBlockHashes).then(function(blocksByHashResult) {
							for (let txid in blockHashesByTxid) {
								if (Object.hasOwn(blockHashesByTxid, txid)) {
									result.blockHeightsByTxid[txid] = blocksByHashResult[blockHashesByTxid[txid]].height;
								}
							}
							resolve2();
						}).catch(function(err) {
							reject2({msg : utils.logError("78ewrgwetg3", err), err : err});
						});
					}));
				}
				Promise.all(blockHeightsPromises).then(function() {
					self.processRawTx(result, assetName, rawTxResult);
					resolve();

				}).catch(function(err) {
					reject({msg : utils.logError("230wefrhg0egt3", err), err : err});
				});

			}).catch(function(err) {
				reject({msg : utils.logError("asdgf07uh23", err), err : err});
			});
		});
	}

	processRawTx(data, assetName, rawTxResult) {
		let addrGainsByTx = {};
		let addrLossesByTx = {};
		data.addrGainsByTx = addrGainsByTx;
		data.addrLossesByTx = addrLossesByTx;
		let handledTxids = [];
		for (let i = 0; i < rawTxResult.transactions.length; i++) {
			let tx = rawTxResult.transactions[i];

			if (handledTxids.includes(tx.txid)) {
				continue;
			}
			handledTxids.push(tx.txid);
			for (let j = 0; j < tx.vout.length; j++) {
				let isThiAddress;
				let value = this.getVoutValue(tx.vout[j], data.address, assetName);
				if (value) {
					if (addrGainsByTx[tx.txid] == null) {
						addrGainsByTx[tx.txid] = new Decimal(0);
					}
					addrGainsByTx[tx.txid] = addrGainsByTx[tx.txid].plus(value);
				}
			}
			for (let j = 0; j < tx.vin.length; j++) {
				let vinJ = tx.vin[j];

				if (vinJ.value) {
					let value = this.getVoutValue(vinJ, data.address, assetName);
					if (value) {
						if (addrLossesByTx[tx.txid] == null) {
							addrLossesByTx[tx.txid] = new Decimal(0);
						}

						addrLossesByTx[tx.txid] = addrLossesByTx[tx.txid].plus(value);
					}
				}
			}
			//debugLog("tx: " + JSON.stringify(tx));
			//debugLog("txInputs: " + JSON.stringify(txInputs));
		}
	}
	getVoutValue(vout, address, assetName) {
		let value = null;
		if(assetName === this.config.coin) {
			if(vout && vout.value > 0
				&& (
					vout.scriptPubKey && vout.scriptPubKey.addresses && vout.scriptPubKey.addresses.includes(address) ||
						vout.address === address
				)
			) {
				value = new Decimal(vout.value);
				//console.log("if " + value);
			}

		} else {
			//console.log(vout);
			if(vout && vout.scriptPubKey && vout.scriptPubKey.asset && vout.scriptPubKey.asset.name === assetName &&
				vout.scriptPubKey.addresses  && vout.scriptPubKey.addresses.includes(address)) {
				value = new Decimal(vout.scriptPubKey.asset.amount);
			}
		}
		return value;
	}

	getAddressMetaData(result) {
		let assetName = result.assetName ? result.assetName : this.config.coin;
		let address = result.address;
		let self = this;
		return new Promise(function(resolve, reject) {
			coreApi.getAddress(address).then(function(validateaddressResult) {
				result.result.validateaddress = validateaddressResult;
				if (!result.crawlerBot) {
					let addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(validateaddressResult.scriptPubKey)));
					addrScripthash = addrScripthash.match(/.{2}/g).reverse().join("");
					result.electrumScripthash = addrScripthash;
					addressApi.getAddressDeltas(address, validateaddressResult.scriptPubKey, result.sort,
																			result.limit, result.offset, result.startBlock, result.numBlocks, assetName).then(addressResult => {
						let addressDetails = addressResult.addressDeltas;
						if (addressResult.errors) {
							result.addressDetailsErrors = addressResult.errors;
						}
						if(addressDetails) {
							result.addressDetails = addressDetails;
							if (addressDetails.txCount === 0) {
								// make sure txCount=0 pass the falsey check in the UI
								addressDetails.txCount = "0";
							}
							if (addressDetails.txids) {
								let txids = addressDetails.txids;
								// if the active addressApi gives us blockHeightsByTxid, it saves us work, so try to use it
								result.blockHeightsByTxid = {};
								if (addressDetails.blockHeightsByTxid) {
									result.blockHeightsByTxid = addressDetails.blockHeightsByTxid;
								}
								result.txids = txids;
								self.getTransactionsDetail(txids, assetName).then(() => {
									resolve();
								}).catch(reject);

							} else {
								// no addressDetails.txids available
								resolve();
							}
						} else {
							resolve();
						}
					}).catch(err => {
						result.pageErrors.push(utils.logError("23t07ug2wghefud", err));
						result.addressApiError = err;
						reject(err);
					});
				}
			});
		});
	}

	compileView(query, viewUri, cacheKey, viewDataPromise) {
		var self = this;
		var cacheTime = query.cacheTime  ? query.cacheTime : 300000;
		return htmlViewCache.tryCache(cacheKey, cacheTime, () => {
			return new Promise((resolve, reject) => {
				viewDataPromise(query).then(() => {
					query.moment = moment;
					query.utils = utils;
					//console.log("query ", query);
					var htmlView = pug.compileFile(`${__dirname}/../views/${viewUri}`)(query);
					resolve(htmlView)
				}).catch(err=> {
					query.pageErrors.push(utils.logError("2108hs0gsdfe", err, {viewUri:viewUri}));
					query.userMessage = "Failed to getting view data " + viewUri+ " (" + err + ")";
					self.res.send(query);
					self.next();
				});
			});
		});
	}

	renderDynamicView(query, viewUri, cacheKey, viewDataPromise) {
		var self = this;
		this.compileView(query,viewUri, cacheKey, viewDataPromise).then((result) => {
			if(result) {
				self.res.send(result);
				self.next();
			} else {
				self.res.send("No Results");
				self.next();
			}
		}).catch(err => {
			query.pageErrors.push(utils.logError("2108hs0gsdfe", err, {view:viewUri}));
			query.userMessage = "Failed to compile view " + viewUri + " (" + err + ")";
			self.res.send(query);
			self.next();
		});
	}
	renderTransactions(assetSupported, hasassets) {
		var cacheKey;
		var query = this.res.locals;
		//console.log(query);
		if(assetSupported || hasassets) {
			cacheKey = `address-transaction-view-${query.address}-${query.assetName}-${query.sort}-${query.limit}-${query.offset}`
		} else {
			cacheKey = `address-transaction-view-${query.address}-${query.sort}-${query.limit}-${query.offset}-${query.startBlock}-${query.numBlocks}`
		}
		this.renderDynamicView(query, "includes/address-transaction.pug", cacheKey, this.getAddressMetaData.bind(this));
	}

	renderAddressView(assetSupported, hasassets) {
		this.parseAddressRequest(assetSupported, hasassets);
		this.renderTransactions(assetSupported, hasassets);
	}

	renderAddressPage(assetSupported, hasassets) {
		this.parseAddressRequest(assetSupported, hasassets);
		var self = this;
		this.getAddressSummary().then(async () => {
			var currentBlock;
			try {
				currentBlock = await coreApi.getBlockCount();
			} catch(err) {
				currentBlock = 0;
			}
			self.res.locals.numBlocks = 10000;
			self.res.locals.startBlock = currentBlock ? currentBlock - self.res.locals.numBlocks + 1 : 0;
			if(self.res.locals.startBlock < 0) {
				self.res.locals.startBlock = 1;
			}
			qrcode.toDataURL(this.res.locals.address, function(err, url) {
				if (err) {
					self.res.locals.pageErrors.push(utils.logError("93ygfew0ygf2gf2", err));
				}
				self.res.locals.addressQrCodeUrl = url;
				self.res.render("address");
				self.next();
			});
		}).catch(err => {
			self.res.locals.pageErrors.push(utils.logError("2108hs0gsdfe", err, {address:self.res.locals.address}));
			self.res.locals.userMessage = "Failed to load address " + self.res.locals.address + " (" + err + ")";
			self.res.render("address");
			self.next();
		});
	}

	getAddressSummary() {
		var result = this.res.locals;
		var assetName = result.assetName ? result.assetName : this.config.coin;
		var address = result.address;
		return new Promise(function(resolve, reject) {
			coreApi.getAddress(address).then(function(validateaddressResult) {
				result.result.validateaddress = validateaddressResult;
				if (!result.crawlerBot) {
					var addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(validateaddressResult.scriptPubKey)));
					addrScripthash = addrScripthash.match(/.{2}/g).reverse().join("");

					result.electrumScripthash = addrScripthash;
					addressApi.getAddressBalance(address, config.addressApi === "daemonRPC" ? null : validateaddressResult.scriptPubKey).then(balData => {
						result.addressDetails = {};
						if(balData.length) {
							result.addressDetails.assets = {};
							for(var bIndex in balData) {
								var bal = balData[bIndex];
								result.addressDetails.assets[bal.assetName] = bal.balance;
							}
						} else {
							if (balData.balance) {
								result.addressDetails.balanceSat = balData.balance;
							} else {
								result.addressDetails.assets = {};
								for(var it in balData){
									if (it == "RTM")
										result.addressDetails.balanceSat = balData[it].balance;
									else
										result.addressDetails.assets[it] = balData[it].balance;
								}
							}
						}
						resolve();
					}).catch(reject);
				}
			});
		});
	}

	renderBlockTables(query) {
		return new Promise(function(resolve, reject) {
			coreApi.getBlockCount().then(height => {
				if (height) {
					var blockHeights = [];
					for (var i = 0; i < query.amountOfBlocks; i++) {
						blockHeights.push(height - i);
					}
					coreApi.getBlocksByHeight(blockHeights).then(function(latestBlocks) {
						query.blocks = latestBlocks;
						resolve();
					}).catch(reject);
				} else {
					resolve();
				}
			}).catch(reject);
		});
	}

	renderBlocksTableView() {
		var query = this.res.locals;
		query.Decimal = Decimal;
		query.amountOfBlocks = this.req.params.blockTotal ? this.req.params.blockTotal : 10;
		query.cacheTime = 60000;
		var cacheKey = `block-table-view`;
		this.renderDynamicView(query, "includes/blocks-list.pug", cacheKey, this.renderBlockTables.bind(this));
	}

	renderHome() {
		this.res.locals.homepage = true;
		var promises = [];

		promises.push(coreApi.getMempoolInfo());
		promises.push(coreApi.getMiningInfo());
		var self = this;
		coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
			self.res.locals.getblockchaininfo = getblockchaininfo;

			if (getblockchaininfo.chain !== 'regtest') {
				var targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;

				promises.push(coreApi.getTxCountStats(targetBlocksPerDay / 4, -targetBlocksPerDay, "latest"));

				var chainTxStatsIntervals = [ targetBlocksPerDay, targetBlocksPerDay * 7, targetBlocksPerDay * 30, targetBlocksPerDay * 365 ]
					.filter(numBlocks => numBlocks <= getblockchaininfo.blocks);

				self.res.locals.chainTxStatsLabels = [ "24 hours", "1 week", "1 month", "1 year" ]
					.slice(0, chainTxStatsIntervals.length)
					.concat("All time");

				for (var i = 0; i < chainTxStatsIntervals.length; i++) {
					promises.push(coreApi.getChainTxStats(chainTxStatsIntervals[i]));
				}
			}
			if (getblockchaininfo.chain !== 'regtest') {
				promises.push(coreApi.getChainTxStats(getblockchaininfo.blocks - 1));
			}
			Promise.all(promises).then(function(promiseResults) {
				self.res.locals.mempoolInfo = promiseResults[0];
				self.res.locals.miningInfo = promiseResults[1];
				self.res.locals.masternodeStats = global.coinConfig.masternodeSupported;

				if (getblockchaininfo.chain !== 'regtest') {
					self.res.locals.txStats = promiseResults[2];

					var chainTxStats = [];
					for (var i = 0; i < self.res.locals.chainTxStatsLabels.length; i++) {
						chainTxStats.push(promiseResults[i + 3]);
					}

					self.res.locals.chainTxStats = chainTxStats;
				}
				self.res.render("index");
				self.next();
			}).catch(err => {
				self.res.locals.userMessage = "Error loading index: " + err;
				self.res.render("index");
				self.next();
			});
		}).catch(function(err) {
			self.res.locals.userMessage = "Error loading recent blocks: " + err;
			self.res.render("index");
			self.next();
		});
	}

	getNetworkSummary() {
		var promises = [];

		promises.push(coreApi.getMempoolInfo());
		promises.push(coreApi.getMiningInfo());
		var self = this;
		var result = {};
		coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
			result.getblockchaininfo = getblockchaininfo;

			if (getblockchaininfo.chain !== 'regtest') {
				var targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;

				promises.push(coreApi.getTxCountStats(targetBlocksPerDay / 4, -targetBlocksPerDay, "latest"));

				var chainTxStatsIntervals = [ targetBlocksPerDay, targetBlocksPerDay * 7, targetBlocksPerDay * 30, targetBlocksPerDay * 365 ]
					.filter(numBlocks => numBlocks <= getblockchaininfo.blocks);

				result.chainTxStatsLabels = [ "24 hours", "1 week", "1 month", "1 year" ]
					.slice(0, chainTxStatsIntervals.length)
					.concat("All time");

				for (var i = 0; i < chainTxStatsIntervals.length; i++) {
					promises.push(coreApi.getChainTxStats(chainTxStatsIntervals[i]));
				}
			}
			Promise.all(promises).then(function(promiseResults) {
				result.mempoolInfo = promiseResults[0];
				result.miningInfo = promiseResults[1];

				if (getblockchaininfo.chain !== 'regtest') {
					result.txStats = promiseResults[2];

					var chainTxStats = [];
					for (var i = 0; i < result.chainTxStatsLabels.length; i++) {
						chainTxStats.push(promiseResults[i + 3]);
					}

					result.chainTxStats = chainTxStats;
				}
				self.res.send(utils.getStatsSummary(result));
				if(self.next) {
					self.next();
				}
			});
		}).catch(function(err) {
			result.userMessage = "Error loading recent blocks: " + err;

			self.res.send(result);
			if(self.next) {
				self.next();
			}
		});
	}
}

module.exports = Session;
