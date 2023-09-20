const debug = require("debug");

const debugLog = debug("btcexp:core");
const fs = require('fs');

const utils = require("../utils.js");
const config = require("../config.js");
const coins = require("../coins.js");
const Cache = require("./../cache.js");
const Decimal = require("decimal.js");
const crypto = require('crypto');

// choose one of the below: RPC to a node, or mock data while testing
const rpcApi = require("./rpcApi.js");
//var rpcApi = require("./mockApi.js")
const miscCache = new Cache(process.env.MAX_MISC_CACHE ? process.env.MAX_MISC_CACHE : 100);
const blockCache = new Cache(process.env.MAX_BLOCK_CACHE ? process.env.MAX_BLOCK_CACHE : 50);
const txCache = new Cache(process.env.MAX_TX_CACHE ? process.env.MAX_TX_CACHE : 200);
const assetsCache =  new Cache(process.env.MAX_ASSET_CACHE ? process.env.MAX_ASSET_CACHE : 100);
const masternodeCache =  new Cache(process.env.MAX_MASTERNODE_CACHE ? process.env.MAX_MASTERNODE_CACHE : 100);
const chartingCache =  new Cache(process.env.MAX_CHART_CACHE ? process.env.MAX_CHART_CACHE : 1200);

function getGenesisBlockHash() {
	return coins[config.coin].genesisBlockHash;
}

function getGenesisCoinbaseTransactionId() {
	return coins[config.coin].genesisCoinbaseTransactionId;
}

function shouldCacheTransaction(tx) {
	if (!tx.confirmations) {
		return false;
	}

	if (tx.confirmations < 1) {
		return false;
	}

	if (tx.vin != null && tx.vin.length > 9) {
		return false;
	}

	return true;
}

function getBlockchainInfo() {
	return miscCache.tryCache("getBlockchainInfo", 10000, rpcApi.getBlockchainInfo);
}

function getBlockCount(req) {
	if(req && req.query.nocache) {
		return rpcApi.getBlockCount();
	}
	return miscCache.tryCache("getblockcount", 10000, rpcApi.getBlockCount);
}

function getNetworkInfo() {
	return miscCache.tryCache("getNetworkInfo", 10000, rpcApi.getNetworkInfo);
}

function getNetTotals() {
	return miscCache.tryCache("getNetTotals", 10000, rpcApi.getNetTotals);
}

function getMempoolInfo() {
	return miscCache.tryCache("getMempoolInfo", 1000, rpcApi.getMempoolInfo);
}

function getMiningInfo() {
	return miscCache.tryCache("getMiningInfo", 30000, rpcApi.getMiningInfo);
}

function getUptimeSeconds() {
	return miscCache.tryCache("getUptimeSeconds", 1000, rpcApi.getUptimeSeconds);
}
function getMarketCap() {
	return miscCache.tryCache("getMarketCap", 1200000, () => {
		return new Promise(async (resolve, reject) => {
			try {
				var supply = Number(await getSupply());
				var marketCap = `${utils.formatExchangedCurrency(supply, "btc", "฿", 2, true)}/${utils.formatExchangedCurrency(supply, "usd", "$", 2, true)}`
				resolve(marketCap);
			} catch(e) {
				reject(e);
			}
		});
	});
}
function totalCoinLockedByMN() {
	return miscCache.tryCache("totalCoinLockedByMN", 1800000, () => {
		return new Promise(async (resolve, reject) => {
			try {
				var totalCoinLocked = await rpcApi.totalCoinLockedByMN();
				var supply = await getSupply();
				resolve(`${Number(totalCoinLocked).toLocaleString()} / ${Number(totalCoinLocked * 100.00 / supply).toFixed(2)}%`);
			} catch(e) {
				reject(e);
			}
		});
	});

}
function getNetworkHash(height) {
	return chartingCache.tryCache("getNetworkHash-" + height, 86400000, () => {
		return rpcApi.getNetworkHash(height);
	});
}

function getTotalAssetAddresses(req) {
	var assetName = req.query.assetname;
	return assetsCache.tryCache("getTotalAssetAddresses-"+assetName, 300000, () => {
		return rpcApi.getTotalAssetAddresses(assetName);
	});
}

function getAssetAddresses(assetName, start, limit) {
	return assetsCache.tryCache(`getAssetAddresses-${assetName}-${start}-${limit}`, 300000, function() {
		return rpcApi.getAssetAddresses(assetName, start, limit);
	});
}

function getTotalAddressAssetBalances(req) {
	var address = req.query.address;
	return assetsCache.tryCache("getTotalAddressAssetBalances-"+address, 300000, () => {
		return rpcApi.getTotalAddressAssetBalances(address);
	});
}

function getAddressAssetBalances(address, start, limit) {
	return assetsCache.tryCache(`getAddressAssetBalances-${address}-${start}-${limit}`, 300000, function() {
		return rpcApi.getAddressAssetBalances(address, start, limit);
	});
}

function getTotalAssetCount(filter) {
	return assetsCache.tryCache("getTotalAssetCount-"+filter, 300000, () => {
		return rpcApi.getTotalAssetCount(filter);
	});
}
function queryAssets(searchTerm, start, limit) {
	return assetsCache.tryCache(`queryAssets-${searchTerm}-${start}-${limit}`, 300000, function() {
		return rpcApi.queryAssets(searchTerm, start, limit);
	});
}

function getAddressDetails(address, scriptPubkey, sort, limit, offset, assetName) {
	return miscCache.tryCache(`getAddressDetails-${address}-${assetName}-${sort}-${limit}-${offset}`, 300000, function() {
		return rpcApi.getAddressDetails(address, scriptPubkey, sort, limit, offset, assetName);
	});
}

function getAddressBalance(address, scriptPubkey) {
	return miscCache.tryCache("getAddressBalance-" + address, 300000, function() {
		return rpcApi.getAddressBalance(address, scriptPubkey);
	});
}
function getAddressUTXOs(address, scriptPubkey) {
	return miscCache.tryCache("getAddressUTXOs-" + address, 1200000, function() {
		return rpcApi.getAddressUTXOs(address, scriptPubkey);
	});
}

function getMasternodeReachableCount() {
	return masternodeCache.tryCache("getMasternodeReachableCount", 1800000, function() {
		return rpcApi.getMasternodeReachableCount();
	});
}


function getChainTxStats(blockCount) {
	return miscCache.tryCache("getChainTxStats-" + blockCount, 1200000, function() {
		return rpcApi.getChainTxStats(blockCount);
	});
}

function getDifficultyData(name, difficulty) {
	return {
			name : name,
			diff : difficulty,
			diffCal : utils.formatLargeNumber(difficulty, 3)
	}
}

function getTxCountStats(dataPtCount, blockStart, blockEnd) {
	return new Promise(async function(resolve, reject) {
		var dataPoints = dataPtCount;

		getBlockchainInfo().then(function(getblockchaininfo) {
			if (typeof blockStart === "string") {
				if (["genesis", "first", "zero"].includes(blockStart)) {
					blockStart = 0;
				}
			}

			if (typeof blockEnd === "string") {
				if (["latest", "tip", "newest"].includes(blockEnd)) {
					blockEnd = getblockchaininfo.blocks;
				}
			}

			if (blockStart > blockEnd) {
				reject(`Error 37rhw0e7ufdsgf: blockStart (${blockStart}) > blockEnd (${blockEnd})`);

				return;
			}

			if (blockStart < 0) {
				blockStart += getblockchaininfo.blocks;
			}

			if (blockEnd < 0) {
				blockEnd += getblockchaininfo.blocks;
			}

			let chainTxStatsIntervals = [];
			for (let i = 0; i < dataPoints; i++) {
				let values = Number(getblockchaininfo.blocks) - Number(blockStart) - i * (Number(blockEnd) - Number(blockStart)) / (Number(dataPoints) - 1) - 1;
				let block = Math.max(10, values);
				block = Math.floor(block)
				chainTxStatsIntervals.push(block);
			}

			var promises = [];
			for (var i = 0; i < chainTxStatsIntervals.length; i++) {
				promises.push(getChainTxStats(chainTxStatsIntervals[i]));
			}

			Promise.all(promises).then(function(results) {
				var txStats = {
                txCounts: [],
                txLabels: [],
                txRates: []
        };
        for (var i = results.length - 1; i >= 0; i--) {
                if (results[i].window_tx_count) {
                        txStats.txCounts.push( {x:(getblockchaininfo.blocks - results[i].window_block_count), y: (results[i].txcount - results[i].window_tx_count)} );
                        txStats.txRates.push( {x:(getblockchaininfo.blocks - results[i].window_block_count), y: (results[i].txrate)} );
                        txStats.txLabels.push(i);
                }
        }
        var txcount;
        i = 0;
        while(!txcount) {
                txcount = results[i].txcount;
                i++
        }
        var stats = {txCountStats:txStats, getblockchaininfo:getblockchaininfo, totalTxCount: txcount};
        resolve(stats);
			}).catch(function(err) {
				reject(err);
			});

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getPeerSummary() {
	return new Promise(function(resolve, reject) {
		miscCache.tryCache("getpeerinfo", 1000, rpcApi.getPeerInfo).then(function(getpeerinfo) {
			var result = {};
			result.getpeerinfo = getpeerinfo;

			var versionSummaryMap = {};
			for (var i = 0; i < getpeerinfo.length; i++) {
				var x = getpeerinfo[i];

				if (versionSummaryMap[x.subver] == null) {
					versionSummaryMap[x.subver] = 0;
				}

				versionSummaryMap[x.subver]++;
			}

			var versionSummary = [];
			for (var prop in versionSummaryMap) {
				if (Object.hasOwn(versionSummaryMap, prop)) {
					versionSummary.push([prop, versionSummaryMap[prop]]);
				}
			}

			versionSummary.sort(function(a, b) {
				if (b[1] > a[1]) {
					return 1;

				} else if (b[1] < a[1]) {
					return -1;

				} else {
					return a[0].localeCompare(b[0]);
				}
			});



			var servicesSummaryMap = {};
			for (var i = 0; i < getpeerinfo.length; i++) {
				var x = getpeerinfo[i];

				if (servicesSummaryMap[x.services] == null) {
					servicesSummaryMap[x.services] = 0;
				}

				servicesSummaryMap[x.services]++;
			}

			var servicesSummary = [];
			for (var prop in servicesSummaryMap) {
				if (Object.hasOwn(servicesSummaryMap, prop)) {
					servicesSummary.push([prop, servicesSummaryMap[prop]]);
				}
			}

			servicesSummary.sort(function(a, b) {
				if (b[1] > a[1]) {
					return 1;

				} else if (b[1] < a[1]) {
					return -1;

				} else {
					return a[0].localeCompare(b[0]);
				}
			});



			result.versionSummary = versionSummary;
			result.servicesSummary = servicesSummary;

			resolve(result);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getMempoolTxids(verbose = false) {
	return miscCache.tryCache("getMempoolTxidSummary", 1000, rpcApi.getMempoolTxids);
}

function getMempoolDetails(start, count) {
	return new Promise(function(resolve, reject) {
		miscCache.tryCache("getMempoolTxids", 1000, rpcApi.getMempoolTxids).then(function(resultTxids) {
			let txids = [];

			for (let i = start; (i < resultTxids.length && i < (start + count)); i++) {
				txids.push(resultTxids[i]);
			}

			getRawTransactions(txids).then(function(transactions) {
				let maxInputsTracked = config.site.txMaxInput;
				let vinMap = {};
				for (let transaction of transactions) {
					if (transaction && transaction.vin) {
						for (let j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
							let vin = transaction.vin[j];
							if (vin.txid && !vin.address) {
								vinMap[vin.txid] = vin;
							}
						}
					}
					transaction.vout.forEach(utils.findAddressVout);
				}

				getRawTransactions(Object.keys(vinMap)).then(function(vinTransactions) {

					vinTransactions.forEach(function(tx) {
						let vin = vinMap[tx.txid];
						let inputVout = tx.vout[vin.vout];
						utils.extractedVinVout(inputVout, vin);
					});


					resolve({ txCount:resultTxids.length, transactions:transactions });

				}).catch(function(err) {
					reject(err);
				});

			}).catch(function(err) {
				reject(err);
			});

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getMempoolStats() {
	return new Promise(function(resolve, reject) {
		miscCache.tryCache("getRawMempool", 5000, rpcApi.getRawMempool).then(function(result) {
			var maxFee = 0;
			var maxFeePerByte = 0;
			var maxAge = 0;
			var maxSize = 0;
			var ages = [];
			var sizes = [];
			for (var txid in result) {
				var txMempoolInfo = result[txid];
				var fee = txMempoolInfo.modifiedfee;
				var feePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.size;
				var age = Date.now() / 1000 - txMempoolInfo.time;
				var size = txMempoolInfo.size;

				if (fee > maxFee) {
					maxFee = txMempoolInfo.modifiedfee;
				}

				if (feePerByte > maxFeePerByte) {
					maxFeePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.size;
				}

				ages.push({age:age, txid:txid});
				sizes.push({size:size, txid:txid});

				if (age > maxAge) {
					maxAge = age;
				}

				if (size > maxSize) {
					maxSize = size;
				}
			}

			ages.sort(function(a, b) {
				if (a.age != b.age) {
					return b.age - a.age;

				} else {
					return a.txid.localeCompare(b.txid);
				}
			});

			sizes.sort(function(a, b) {
				if (a.size != b.size) {
					return b.size - a.size;

				} else {
					return a.txid.localeCompare(b.txid);
				}
			});

			maxSize = 2000;

			var satoshiPerByteBucketMaxima = coins[config.coin].feeSatoshiPerByteBucketMaxima;
			var bucketCount = satoshiPerByteBucketMaxima.length + 1;

			var satoshiPerByteBuckets = [];
			var satoshiPerByteBucketLabels = [];

			satoshiPerByteBucketLabels[0] = ("[0 - " + satoshiPerByteBucketMaxima[0] + ")");
			for (var i = 0; i < bucketCount; i++) {
				satoshiPerByteBuckets[i] = {"count":0, "totalFees":0, "totalBytes":0};

				if (i > 0 && i < bucketCount - 1) {
					satoshiPerByteBucketLabels[i] = ("[" + satoshiPerByteBucketMaxima[i - 1] + " - " + satoshiPerByteBucketMaxima[i] + ")");
				}
			}

			var ageBucketCount = 100;
			var ageBucketTxCounts = [];
			var ageBucketLabels = [];

			var sizeBucketCount = 100;
			var sizeBucketTxCounts = [];
			var sizeBucketLabels = [];

			for (var i = 0; i < ageBucketCount; i++) {
				var rangeMin = i * maxAge / ageBucketCount;
				var rangeMax = (i + 1) * maxAge / ageBucketCount;

				ageBucketTxCounts.push(0);

				if (maxAge > 600) {
					var rangeMinutesMin = new Decimal(rangeMin / 60).toFixed(1);
					var rangeMinutesMax = new Decimal(rangeMax / 60).toFixed(1);

					ageBucketLabels.push(rangeMinutesMin + " - " + rangeMinutesMax + " min");

				} else {
					ageBucketLabels.push(parseInt(rangeMin) + " - " + parseInt(rangeMax) + " sec");
				}
			}

			for (var i = 0; i < sizeBucketCount; i++) {
				sizeBucketTxCounts.push(0);

				if (i == sizeBucketCount - 1) {
					sizeBucketLabels.push(parseInt(i * maxSize / sizeBucketCount) + "+");

				} else {
					sizeBucketLabels.push(parseInt(i * maxSize / sizeBucketCount) + " - " + parseInt((i + 1) * maxSize / sizeBucketCount));
				}
			}

			satoshiPerByteBucketLabels[bucketCount - 1] = (satoshiPerByteBucketMaxima[satoshiPerByteBucketMaxima.length - 1] + "+");

			var summary = {
				"count":0,
				"totalFees":0,
				"totalBytes":0,
				"satoshiPerByteBuckets":satoshiPerByteBuckets,
				"satoshiPerByteBucketLabels":satoshiPerByteBucketLabels,
				"ageBucketTxCounts":ageBucketTxCounts,
				"ageBucketLabels":ageBucketLabels,
				"sizeBucketTxCounts":sizeBucketTxCounts,
				"sizeBucketLabels":sizeBucketLabels
			};

			for (var txid in result) {
				var txMempoolInfo = result[txid];
				var fee = txMempoolInfo.modifiedfee;
				var feePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.size;
				var satoshiPerByte = feePerByte * 100000000;
				var age = Date.now() / 1000 - txMempoolInfo.time;
				var size = txMempoolInfo.size;

				var addedToBucket = false;
				for (var i = 0; i < satoshiPerByteBucketMaxima.length; i++) {
					if (satoshiPerByteBucketMaxima[i] > satoshiPerByte) {
						satoshiPerByteBuckets[i]["count"]++;
						satoshiPerByteBuckets[i]["totalFees"] += fee;
						satoshiPerByteBuckets[i]["totalBytes"] += txMempoolInfo.size;

						addedToBucket = true;

						break;
					}
				}

				if (!addedToBucket) {
					satoshiPerByteBuckets[bucketCount - 1]["count"]++;
					satoshiPerByteBuckets[bucketCount - 1]["totalFees"] += fee;
					satoshiPerByteBuckets[bucketCount - 1]["totalBytes"] += txMempoolInfo.size;
				}

				summary["count"]++;
				summary["totalFees"] += txMempoolInfo.modifiedfee;
				summary["totalBytes"] += txMempoolInfo.size;

				var ageBucketIndex = Math.min(ageBucketCount - 1, parseInt(age / (maxAge / ageBucketCount)));
				var sizeBucketIndex = Math.min(sizeBucketCount - 1, parseInt(size / (maxSize / sizeBucketCount)));

				ageBucketTxCounts[ageBucketIndex]++;
				sizeBucketTxCounts[sizeBucketIndex]++;
			}

			summary["averageFee"] = summary["totalFees"] / summary["count"];
			summary["averageFeePerByte"] = summary["totalFees"] / summary["totalBytes"];

			summary["satoshiPerByteBucketMaxima"] = satoshiPerByteBucketMaxima;
			summary["satoshiPerByteBucketCounts"] = [];
			summary["satoshiPerByteBucketTotalFees"] = [];

			for (var i = 0; i < bucketCount; i++) {
				summary["satoshiPerByteBucketCounts"].push(summary["satoshiPerByteBuckets"][i]["count"]);
				summary["satoshiPerByteBucketTotalFees"].push(summary["satoshiPerByteBuckets"][i]["totalFees"]);
			}

			/*debugLog(JSON.stringify(ageBuckets));
			debugLog(JSON.stringify(ageBucketLabels));
			debugLog(JSON.stringify(sizeBuckets));
			debugLog(JSON.stringify(sizeBucketLabels));*/

			resolve(summary);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getBlockByHeight(blockHeight) {
	return blockCache.tryCache("getBlockByHeight-" + blockHeight, 3600000, function() {
		return rpcApi.getBlockByHeight(blockHeight);
	});
}

function getBlock(req) {
	var blockHeight = req.query.height;
	return blockCache.tryCache("getBlock-" + blockHeight, 3600000, function() {
		return rpcApi.getBlock(blockHeight);
	});
}

function getBlocksByHeight(blockHeights) {
	return new Promise(function(resolve, reject) {
		var promises = [];
		for (var i = 0; i < blockHeights.length; i++) {
			promises.push(getBlockByHeight(blockHeights[i]));
		}

		Promise.all(promises).then(function(results) {
			resolve(results);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getBlockByHash(blockHash) {
	return blockCache.tryCache("getBlockByHash-" + blockHash, 3600000, function() {
		return rpcApi.getBlockByHash(blockHash);
	});
}

function getBlocksByHash(blockHashes) {
	return new Promise(function(resolve, reject) {
		var promises = [];
		for (var i = 0; i < blockHashes.length; i++) {
			promises.push(getBlockByHash(blockHashes[i]));
		}

		Promise.all(promises).then(function(results) {
			var result = {};

			results.forEach(function(item) {
				result[item.hash] = item;
			});

			resolve(result);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getRawTransaction(req) {
	var txid = req.query.txid;
	var rpcApiFunction = function() {
		return rpcApi.getRawTransaction(txid);
	};

	return txCache.tryCache("getRawTransaction-" + txid, 60000, rpcApiFunction, shouldCacheTransaction);
}

function getRawTransactions(txids) {
	var txidsHash = crypto.createHash('sha256').update(txids + "").digest('hex');
	return txCache.tryCache("getRawTransactions-" + txidsHash, 360000, function() {
		return rpcApi.getRawTransactions(txids);
	});

}

function getTxUtxos(tx) {
	return new Promise(function(resolve, reject) {
		var promises = [];

		for (var i = 0; i < tx.vout.length; i++) {
			promises.push(getUtxo(tx.txid, i));
		}

		Promise.all(promises).then(function(results) {
			resolve(results);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getUtxo(txid, outputIndex) {
	return new Promise(function(resolve, reject) {
		miscCache.tryCache("utxo-" + txid + "-" + outputIndex, 3600000, function() {
			return rpcApi.getUtxo(txid, outputIndex);

		}).then(function(result) {
			// to avoid cache misses, rpcApi.getUtxo returns "0" instead of null
			if (result === "0") {
				resolve(null);

				return;
			}
			resolve(result);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getMempoolTxDetails(txid) {
	return miscCache.tryCache("mempoolTxDetails-" + txid, 3600000, function() {
		return rpcApi.getMempoolTxDetails(txid);
	});
}

function getAddress(address) {
	return miscCache.tryCache("getAddress-" + address, 3600000, function() {
		return rpcApi.getAddress(address);
	});
}

function smartnode(req) {
	return masternode(req, "smartnode")
}

function masternode(req, masternodeCommand = "masternode") {
	var command = req.query.command;
	return masternodeCache.tryCache(masternodeCommand + "-" + command, 60000, function() {
		return rpcApi.masternode(command, masternodeCommand);
	});
}

function nullableValue(value) {
	return value ? value : "";
}

function protx(req) {
	var command = req.query.command;
	var protxHash = req.query.protxhash;
	var baseBlock = req.query.baseblock;
	var block = req.query.block;
	var cacheKey = `protx-${nullableValue(command)}-${nullableValue(protxHash)}-${nullableValue(baseBlock)}-${nullableValue(block)}`;
	return miscCache.tryCache(cacheKey, 60000, function() {
		return rpcApi.protx(command, req.query);
	});
}

function quorum(req) {
	var command = req.query.command;
	var protxHash = req.query.protxhash;
	var llmqType = req.query.llmqtype;
	var count = req.query.count;
	var quorumHash = req.query.quorumhash;
	var skshare = req.query.skshare;
	var id = req.query.id;
	var msgHash = req.query.msghash
	var cacheKey = `protx-${nullableValue(command)}-${nullableValue(protxHash)}-${nullableValue(llmqType)}-${nullableValue(count)}
	-${nullableValue(quorumHash)}-${nullableValue(id)}-${nullableValue(msgHash)}-${nullableValue(skshare)}`;
	return miscCache.tryCache(cacheKey, 60000, function() {
		return rpcApi.quorum(command, req.query);
	});
}

function getRawTransactionsWithInputs(txids, maxInputs=-1) {
	return new Promise(function(resolve, reject) {
		getRawTransactions(txids).then(function(transactions) {
			let maxInputsTracked = config.site.txMaxInput;

			if (maxInputs <= 0) {
				maxInputsTracked = 1000000;

			} else if (maxInputs > 0) {
				maxInputsTracked = maxInputs;
			}

			let vinMap = {};
			let voutMap = {};
			for (let transaction of transactions) {
				if (transaction && transaction.vin) {
					for (let j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
						let vin = transaction.vin[j];
						if (vin.txid && !vin.address) {
							vinMap[vin.txid] = vin;
							if (!voutMap[vin.txid])
								voutMap[vin.txid] = {};
							voutMap[vin.txid][vin.vout] = vin;
						}
					}
				}
				transaction.vout.forEach(utils.findAddressVout);
			}

			getRawTransactions(Object.keys(vinMap)).then(function(vinTransactions) {
				vinTransactions.forEach(function(tx) {
					for ( let t in voutMap[tx.txid]) {
						let vin = voutMap[tx.txid][t];
						if(vin) {
							let inputVout = tx.vout[vin.vout];
							utils.extractedVinVout(inputVout, vin);
						}
					}
				});

				resolve({ transactions:transactions});
			});
		});
	});
}

function getBlockByHashWithTransactions(blockHash, txLimit, txOffset) {
	return new Promise(function(resolve, reject) {
		getBlockByHash(blockHash).then(function(block) {
			let txids = [];

			if (txOffset > 0) {
				txids.push(block.tx[0]);
			}
			if(block.tx) {
				for (let i = txOffset; i < Math.min(txOffset + txLimit, block.tx.length); i++) {
					txids.push(block.tx[i]);
				}
			}
			let isProofOfState = false;
			if (block.flags)
				isProofOfState = block.flags.includes("proof-of-stake")
			getRawTransactions(txids).then(async (transactions) => {

				// if we're on page 2, we don't really want it anymore...
				if (txOffset > 0) {
					transactions.shift();
				}

				let maxInputsTracked = config.site.txMaxInput;
				let vinMap = {};
				for (let transaction of transactions) {
					if (transaction && transaction.vin) {
						for (let j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
							let vin = transaction.vin[j];
							if (vin.txid && !vin.address) {
								vinMap[vin.txid] = vin;
							}
						}
					}
					transaction.vout.forEach(utils.findAddressVout);
				}
				try {
					let vinTransactions = await getRawTransactions(Object.keys(vinMap));
					vinTransactions.forEach(function(tx) {
						let vin = vinMap[tx.txid];
						if(vin) {
							let inputVout = tx.vout[vin.vout];
							utils.extractedVinVout(inputVout, vin);
						}
					});
					if (transactions.length === txids.length) {
						block.coinbaseTx = isProofOfState ? transactions[1] : transactions[0];
						block.totalFees = utils.getBlockTotalFeesFromCoinbaseTxAndBlockHeight(block.coinbaseTx, block.height, isProofOfState);
						block.miner = utils.getMinerFromCoinbaseTx(block.coinbaseTx);
					}
				} catch(err) {
					console.error(err);
				}
				resolve({ getblock:block, transactions:transactions });
			});
		});
	});
}

function getHelp() {
	return new Promise(function(resolve, reject) {
		miscCache.tryCache("getHelp", 3600000, rpcApi.getHelp).then(function(helpContent) {
			var lines = helpContent.split("\n");
			var sections = [];

			lines.forEach(function(line) {
				if (line.startsWith("==")) {
					var sectionName = line.substring(2);
					sectionName = sectionName.substring(0, sectionName.length - 2).trim();

					sections.push({name:sectionName, methods:[]});

				} else if (line.trim().length > 0) {
					var methodName = line.trim();

					if (methodName.includes(" ")) {
						methodName = methodName.substring(0, methodName.indexOf(" "));
					}

					sections[sections.length - 1].methods.push({name:methodName, content:line.trim()});
				}
			});

			resolve(sections);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getRpcMethodHelp(methodName) {
	var rpcApiFunction = function() {
		return rpcApi.getRpcMethodHelp(methodName);
	};

	return new Promise(function(resolve, reject) {
		miscCache.tryCache("getHelp-" + methodName, 3600000, rpcApiFunction).then(function(helpContent) {
			var output = {};
			output.string = helpContent;

			var str = helpContent;

			var lines = str.split("\n");
			var argumentLines = [];
			var catchArgs = false;
			lines.forEach(function(line) {
				if (line.trim().length == 0) {
					catchArgs = false;
				}

				if (catchArgs) {
					argumentLines.push(line);
				}

				if (line.trim() == "Arguments:" || line.trim() == "Arguments") {
					catchArgs = true;
				}
			});

			var args = [];
			var argX = null;
			// looking for line starting with "N. " where N is an integer (1-2 digits)
			argumentLines.forEach(function(line) {
				var regex = /^([0-9]+)\.\s*"?(\w+)"?\s*\(([^,)]*),?\s*([^,)]*),?\s*([^,)]*),?\s*([^,)]*)?\s*\)\s*(.+)?$/;

				var match = regex.exec(line);

				if (match) {
					argX = {};
					argX.name = match[2];
					argX.detailsLines = [];

					argX.properties = [];

					if (match[3]) {
						argX.properties.push(match[3]);
					}

					if (match[4]) {
						argX.properties.push(match[4]);
					}

					if (match[5]) {
						argX.properties.push(match[5]);
					}

					if (match[6]) {
						argX.properties.push(match[6]);
					}

					if (match[7]) {
						argX.description = match[7];
					}

					args.push(argX);
				}

				if (!match && argX) {
					argX.detailsLines.push(line);
				}
			});

			output.args = args;

			resolve(output);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getOutputAddressBalance(fromHeight, toHeight) {
	return rpcApi.getOutputAddressBalance(fromHeight, toHeight);
}

function getSupply() {
	return miscCache.tryCache("getSupply", 3600000, function() {
		return rpcApi.getSupply();
	});
}

function logCacheSizes() {
	var itemCounts = [ miscCache.itemCount, blockCache.itemCount, txCache.itemCount ];

	var stream = fs.createWriteStream("memoryUsage.csv", {flags:'a'});
	stream.write("itemCounts: " + JSON.stringify(itemCounts) + "\n");
	stream.end();
}

module.exports = {
	getGenesisBlockHash: getGenesisBlockHash,
	getGenesisCoinbaseTransactionId: getGenesisCoinbaseTransactionId,
	getBlockchainInfo: getBlockchainInfo,
	getNetworkInfo: getNetworkInfo,
	getNetTotals: getNetTotals,
	getMempoolInfo: getMempoolInfo,
	getMiningInfo: getMiningInfo,
	getBlockByHeight: getBlockByHeight,
	getBlocksByHeight: getBlocksByHeight,
	getBlockByHash: getBlockByHash,
	getBlocksByHash: getBlocksByHash,
	getBlockByHashWithTransactions: getBlockByHashWithTransactions,
	getRawTransaction: getRawTransaction,
	getRawTransactions: getRawTransactions,
	getRawTransactionsWithInputs: getRawTransactionsWithInputs,
	getTxUtxos: getTxUtxos,
	getMempoolTxDetails: getMempoolTxDetails,
	getMempoolStats: getMempoolStats,
	getUptimeSeconds: getUptimeSeconds,
	getHelp: getHelp,
	getRpcMethodHelp: getRpcMethodHelp,
	getAddress: getAddress,
	logCacheSizes: logCacheSizes,
	getPeerSummary: getPeerSummary,
	getChainTxStats: getChainTxStats,
	getMempoolDetails: getMempoolDetails,
	getTxCountStats: getTxCountStats,
	getBlockCount : getBlockCount,
	getBlock : getBlock,
	broadcast : rpcApi.broadcast,
	getSupply : getSupply,
	getAddressDetails : getAddressDetails,
	getAddressUTXOs : getAddressUTXOs,
	getAddressDeltas : rpcApi.getAddressDeltas,
	getAddressBalance : getAddressBalance,
	getMempoolTxids : getMempoolTxids,
	getTotalAssetAddresses : getTotalAssetAddresses,
	getAssetAddresses : getAssetAddresses,
	getTotalAddressAssetBalances : getTotalAddressAssetBalances,
	getAddressAssetBalances : getAddressAssetBalances,
	getTotalAssetCount : getTotalAssetCount,
	queryAssets : queryAssets,
	getNetworkHash : getNetworkHash,
	masternode : masternode,
	smartnode : smartnode,
	protx : protx,
	quorum : quorum,
	getMasternodeReachableCount : getMasternodeReachableCount,
	getOutputAddressBalance : getOutputAddressBalance,
	totalCoinLockedByMN : totalCoinLockedByMN,
	getMarketCap : getMarketCap,
	getAddresessBalance : rpcApi.getAddresessBalance
};
