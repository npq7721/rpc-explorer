const debug = require('debug');

const debugLog = debug("btcexp:rpc");

const async = require("async");

const utils = require("../utils.js");
const pingUtils = require("../pingUtils.js");
const config = require("../config.js");
const coins = require("../coins.js");

let activeQueueTasks = 0;

const HAS_COUNT_MAP = {

}

const rpcQueue = async.queue(function(task, callback) {
	activeQueueTasks++;
	//debugLog("activeQueueTasks: " + activeQueueTasks);

	task.rpcCall(function() {
		callback();

		activeQueueTasks--;
		//debugLog("activeQueueTasks: " + activeQueueTasks);
	});

}, config.rpcConcurrency);


function getBlockchainInfo() {
	return new Promise((resolve, reject) => {
		getRpcData("getblockchaininfo").then(async result => {
			result.difficultiesData = [];
			let coin = coins[config.coin];
			if(coin.type === "hydrid") {
				try {
					let diffs = await getRpcData("getdifficulty");
					result.difficultiesData.push(utils.getDifficultyData("POW Difficulty", diffs["proof-of-work"]));
					result.difficultiesData.push(utils.getDifficultyData("POS Difficulty", diffs["proof-of-stake"]));

				} catch (error) {
					reject(error);
				}
			} else if(result.difficulty) {
				result.difficultiesData.push(utils.getDifficultyData("Difficulty", result.difficulty));
			} else if(result.difficulties) {
				for(var diffName in result.difficulties) {
					result.difficultiesData.push(utils.getDifficultyData(diffName + " diff",  result.difficulties[diffName]));
				}
			}

			resolve(result);
		}).catch(reject);
	});
}

function getBlockCount() {
	return getRpcData("getblockcount");
}

function getNetworkInfo() {
	return getRpcData("getnetworkinfo");
}

function getNetTotals() {
	return getRpcData("getnettotals");
}

function getMempoolInfo() {
	return getRpcData("getmempoolinfo");
}

function getMiningInfo() {
	return getRpcData("getmininginfo");
}

function getUptimeSeconds() {
	return getRpcData("uptime");
}

function getPeerInfo() {
	return getRpcData("getpeerinfo");
}

function countRPC(rpcMethod) {
	return new Promise((resolve, reject) => {
		rpcMethod.then(result => {
			if(result) {
				if(result.name && result.name === "RpcError") {
					reject(result.message);
				} else {
					resolve(result);
				}
			} else {
				resolve(0);
			}
		});
	});
}

function getTotalAssetAddresses(assetName) {
	if(HAS_COUNT_MAP.listaddressesbyasset) {
		return getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName, true]});
	} else if(HAS_COUNT_MAP.listaddressesbyasset !== undefined) {
		return new Promise((resolve, reject) => {
			countRPC(getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName]})).then(result => {
				resolve(result ? Object.keys(result).length : 0);
			}).catch(reject);
		});
	}
	return new Promise((resolve, reject) => {
		getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName, true]}).then(result => {
			if(result) {
				if(result.name && result.name === "RpcError") {
					countRPC(getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName]})).then(result => {
						HAS_COUNT_MAP.listaddressesbyasset = 0;
						resolve(result ? Object.keys(result).length : 0);
					}).catch(reject);
				} else {
					HAS_COUNT_MAP.listaddressesbyasset = 1;
					resolve(result);
				}
			} else {
				HAS_COUNT_MAP.listaddressesbyasset = 1;
				resolve(0);
			}
		}).catch(reject);
	});
}

function getAssetAddresses(assetName, start, limit) {
	if(HAS_COUNT_MAP.listaddressesbyasset) {
		return getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName, false, limit, start]});
	} else {
		return getRpcDataWithParams({method:"listaddressesbyasset", parameters:[assetName]});
	}
}

function getTotalAddressAssetBalances(address) {
	return getRpcDataWithParams({method:"listassetbalancesbyaddress", parameters:[address, true]});
}

function getAddressAssetBalances(address, start, limit) {
	return getRpcDataWithParams({method:"listassetbalancesbyaddress", parameters:[address, false, limit, start]});
}

function getTotalAssetCount(filter) {
	return new Promise((resolve, reject) => {
		filter = filter && filter !== "*" ? `${filter}*` : "*"
		getRpcDataWithParams({method:"listassets", parameters:[filter]}).then(assets => {
			resolve(assets.length);
		}).catch(reject);
	});
}

function queryAssets(searchTerm, start, limit) {
	searchTerm = (searchTerm && searchTerm !== "*") ? `${searchTerm}*` : "*"
	return getRpcDataWithParams({method:"listassets", parameters:[searchTerm, true, limit, start]});
}

function getNetworkHash(height) {
	return getRpcDataWithParams({method:"getnetworkhashps", parameters:[120, height]});
}

function getMempoolTxids(verbose = false) {
	return getRpcDataWithParams({method:"getrawmempool", parameters:[verbose]});
}

function broadcast(req) {
	var rawtxhex = req.query.tx;
	return getRpcDataWithParams({method:"sendrawtransaction", parameters:[rawtxhex]});
}

function getAddressDeltas(address, scriptPubkey, sort, limit, offset, start, numBlock, assetName = coins[config.coin].ticker) {
	var assetSupported = coins[config.coin].assetSupported ? true : false;
	var hasassets = coins[config.coin].hasassets ? true : false;
	var promise;
	if(assetSupported) {	
		promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], asset : assetName, start : start, end : start + numBlock - 1}]});
	} else {
		if(hasassets) {
			var tmpasset = "*";
			if (assetName)
				tmpasset = assetName
			if (tmpasset == coins[config.coin].ticker)
				promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], start : start, end : start + numBlock - 1}]});
			else
				promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], asset : tmpasset, start : start, end : start + numBlock - 1}]});
		} else {
			promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], start : start, end : start + numBlock - 1}]});
		}
	}
	return promise;
	/*return new Promise(function(resolve, reject) {
		var assetSupported = coins[config.coin].assetSupported ? true : false;
		var promise;
		if(assetSupported) {
			promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], assetName : assetName}]});
		} else {
			promise = getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], start : start, end : offset + numBlock}]});
		}
		promise.then(addressDeltas => {
			var txids = {};
			var uniqueDelta = [];
			for (var index in addressDeltas) {
				var txid = addressDeltas[index].txid;
				if(!txids[txid]) {
					txids[txid] = 1;
					uniqueDelta.push(addressDeltas[index]);
				}
			}
			addressDeltas = uniqueDelta;
			if (sort == "desc") {
				addressDeltas.reverse();
			}
			var end = Math.min(addressDeltas.length, limit + offset);
			var result = {
				txCount : addressDeltas.length,
				txids : [],
				blockHeightsByTxid : {}
			}
			addressDeltas = addressDeltas.slice(offset, end);
			for (var i in addressDeltas) {
				result.txids.push(addressDeltas[i].txid);
				result.blockHeightsByTxid[addressDeltas[i].txid] = addressDeltas[i].height;
			}
			resolve({addressDeltas : result, errors : null});
		}).catch(reject);
	});*/
}

function getAddressDetails(address, scriptPubkey, sort, limit, offset, assetName = coins[config.coin].ticker) {
	return new Promise(function(resolve, reject) {
		var txidData = null;
		var balanceData = null;
		var assetSupported = coins[config.coin].assetSupported ? true : false;
		var hasassets = coins[config.coin].hasassets ? true : false;
		// getBlockCount().then(currentHeight => {
		// 	promises.push({method : "getaddresstxids", parameters: [{adddresses : [address]}]}));
		// }).catch(reject);
		var promises = [];
		if(assetSupported) {
			promises.push(getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], assetName : assetName}]}));
			promises.push(getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address],asset:"*"},true]}));
		} else {
			if(hasassets) {
				if (assetName == coins[config.coin].ticker) {
					promises.push(getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address]}]}));
					promises.push(getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address]}]}));
				} else {
					promises.push(getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address], assetName : assetName}]}));
					promises.push(getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address],asset:assetName},true]}));
				}	
			} else {
				promises.push(getRpcDataWithParams({method : "getaddressdeltas", parameters: [{addresses : [address]}]}));
				promises.push(getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address]}]}));
			}
		}
		Promise.all(promises).then(function(results) {
			txidData = results[0];
			if (sort == "desc") {
				txidData.reverse();
			}
			var end = Math.min(txidData.length, limit + offset);
			balanceData = results[1];
			var addressDetails = {
				txCount : txidData.length,
				txids : [],
				blockHeightsByTxid : {}
			}
		  txidData = txidData.slice(offset, end);
			for (var i in txidData) {
				addressDetails.txids.push(txidData[i].txid);
				addressDetails.blockHeightsByTxid[txidData[i].txid] = txidData[i].height;
			}
			if(assetSupported) {
				addressDetails.assets = {};
				for(var bIndex in balanceData) {
					var bal = balanceData[bIndex];
					if(bal.assetName === coins[config.coin].ticker) {
						addressDetails.balanceSat = bal.balance;
					} else {
						addressDetails.assets[bal.assetName] = bal.balance;
					}
				}
			} else {
				if(hasassets) {
					addressDetails.assets = {};
					for(var bIndex in balanceData) {
						var bal = balanceData[bIndex];
						if(bal.asset === coins[config.coin].ticker) {
							addressDetails.balanceSat = bal.balance;
						} else {
							addressDetails.assets[bal.asset] = bal.balance;
						}
					}
				} else {
					addressDetails.balanceSat = balanceData.balance;
				};
			}
			resolve({addressDetails : addressDetails, errors : null});
 		}).catch(reject);
	});
}

function getAddressBalance(address, scriptPubkey) {
	if (coins[config.coin].assetSupported || coins[config.coin].hasassets) {
		return getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address], asset:"*"},true]});
	} else {
		return getRpcDataWithParams({method : "getaddressbalance", parameters: [{addresses : [address]}]});
	}
}

function getAddresessBalance(addresses, scriptPubkeys) {
	var requests = []
	for(var index in addresses) {
		if (coins[config.coin].assetSupported) {
			requests.push({method : "getaddressbalance", parameters: [{addresses : [addresses[index]]},true]});
		} else {
			requests.push({method : "getaddressbalance", parameters: [{addresses : [addresses[index]]}]});
		}
	}
	return getBatchRpcData(requests);
}


function getAddressUTXOs(address, scriptPubkey) {
	//var assetSupported = coins[config.coin].assetSupported ? true : false;
	return getRpcDataWithParams({method : "getaddressutxos", parameters: [{addresses : [address]}]});
}

function getSupply() {
	return new Promise(function(resolve, reject) {
		getRpcData("gettxoutsetinfo").then(txoutinfo => {
			if(txoutinfo) {
				resolve(txoutinfo.total_amount);
			}
		}).catch(reject);
	});
}

function getRawMempool() {
	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getrawmempool", parameters:[false]}).then(function(txids) {
			var promises = [];

			for (var i = 0; i < txids.length; i++) {
				var txid = txids[i];

				promises.push(getRawMempoolEntry(txid));
			}

			Promise.all(promises).then(function(results) {
				var finalResult = {};

				for (var i = 0; i < results.length; i++) {
					if (results[i] != null) {
						finalResult[results[i].txid] = results[i];
					}
				}

				resolve(finalResult);

			}).catch(function(err) {
				reject(err);
			});

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getRawMempoolEntry(txid) {
	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getmempoolentry", parameters:[txid]}).then(function(result) {
			result.txid = txid;

			resolve(result);

		}).catch(function(err) {
			resolve(null);
		});
	});
}

function getChainTxStats (blockCount) {
	return getRpcDataWithParams({method:"getchaintxstats", parameters:[blockCount]});
}

function getBlockByHeight(blockHeight) {
	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getblockhash", parameters:[blockHeight]}).then(function(blockhash) {
			getBlockByHash(blockhash).then(function(block) {
				resolve(block);

			}).catch(function(err) {
				reject(err);
			});
		}).catch(function(err) {
			reject(err);
		});
	});
}

function getBlock(blockHeight) {
	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getblockhash", parameters:[Number(blockHeight)]}).then(function(blockhash) {
			getRpcDataWithParams({method:"getblock", parameters:[blockhash]}).then(function(block) {
				resolve(block);
			}).catch(reject);
		}).catch(function(err) {
			reject(err);
		});
	});
}

function getBlockByHash(blockHash) {
	debugLog("getBlockByHash: %s", blockHash);

	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getblock", parameters:[blockHash]}).then(function(block) {
			if(block.tx) {
				getRawTransaction(block.tx[0]).then(function(tx) {
					block.coinbaseTx = tx;
					block.totalFees = utils.getBlockTotalFeesFromCoinbaseTxAndBlockHeight(tx, block.height);
					block.miner = utils.getMinerFromCoinbaseTx(tx);

					resolve(block);

				}).catch(function(err) {
					reject(err);
				});
			} else {
				block.coinbaseTx = "";
				block.totalFees = 0;
				block.miner = "";
				resolve(block);
			}
		}).catch(function(err) {
			reject(err);
		});
	});
}

function getAddress(address) {
	return getRpcDataWithParams({method:"validateaddress", parameters:[address]});
}

function getRawTransaction(txid) {
	debugLog("getRawTransaction: %s", txid);

	return new Promise(function(resolve, reject) {
		if (coins[config.coin].genesisCoinbaseTransactionId && txid == coins[config.coin].genesisCoinbaseTransactionId) {
			// copy the "confirmations" field from genesis block to the genesis-coinbase tx
			getBlockchainInfo().then(function(blockchainInfoResult) {
				var result = coins[config.coin].genesisCoinbaseTransaction;
				result.confirmations = blockchainInfoResult.blocks;
				resolve(result);

			}).catch(function(err) {
				reject(err);
			});

		} else {
			getRpcDataWithParams({method:"getrawtransaction", parameters:[txid, 1]}).then(function(result) {
				if (result == null || result.code && result.code < 0) {
					reject(result);

					return;
				}
				resolve(result);

			}).catch(function(err) {
				reject(err);
			});
		}
	});
}

function getUtxo(txid, outputIndex) {
	debugLog("getUtxo: %s (%d)", txid, outputIndex);

	return new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"gettxout", parameters:[txid, outputIndex]}).then(function(result) {
			if (result == null) {
				resolve("0");

				return;
			}

			if (result.code && result.code < 0) {
				reject(result);

				return;
			}

			resolve(result);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getMempoolTxDetails(txid) {
	debugLog("getMempoolTxDetails: %s", txid);

	var promises = [];

	var mempoolDetails = {};

	promises.push(new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getmempoolentry", parameters:[txid]}).then(function(result) {
			mempoolDetails.entry = result;

			resolve();

		}).catch(function(err) {
			reject(err);
		});
	}));

	promises.push(new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getmempoolancestors", parameters:[txid]}).then(function(result) {
			mempoolDetails.ancestors = result;

			resolve();

		}).catch(function(err) {
			reject(err);
		});
	}));

	promises.push(new Promise(function(resolve, reject) {
		getRpcDataWithParams({method:"getmempooldescendants", parameters:[txid]}).then(function(result) {
			mempoolDetails.descendants = result;

			resolve();

		}).catch(function(err) {
			reject(err);
		});
	}));

	return new Promise(function(resolve, reject) {
		Promise.all(promises).then(function() {
			resolve(mempoolDetails);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function getHelp() {
	return getRpcData("help");
}

function totalCoinLockedByMN() {
	return new Promise(async (resolve, reject) => {
		try {
			var currentHeight = await getBlockCount();
			var currentCollateralAmount = await global.coinConfig.masternodeCollateral(currentHeight);
			if(global.coinConfig.isFixedCollateral) {
				var mnCount = await masternode("count", global.coinConfig.masternodeCommand);
				resolve(Number(mnCount.total)*Number(mnCount));
			} else {
				var mnList = await masternode("list", global.coinConfig.masternodeCommand);
				var collateralsTransactionsRequests = [];
				var outputs = [];
				var totalLocked = 0;
				for(var mn in mnList) {
					var output = mn.split("-");
					outputs.push(output);
					collateralsTransactionsRequests.push({method : "getrawtransaction", parameters : [output[0], 1]});
					if(outputs.length >= 100) {
						var collateralsTransactions = await getBatchRpcData(collateralsTransactionsRequests);
						for(var index in collateralsTransactions) {
							var collateralsTransaction = collateralsTransactions[index];
							totalLocked += Number(collateralsTransaction.vout[outputs[index][1]].value);
						}
						collateralsTransactionsRequests = [];
						outputs = [];
					}
				}
				if(collateralsTransactionsRequests.length > 0) {
					var collateralsTransactions = await getBatchRpcData(collateralsTransactionsRequests);
					for(var index in collateralsTransactions) {
						var collateralsTransaction = collateralsTransactions[index];
						totalLocked += Number(collateralsTransaction.vout[outputs[index][1]].value);
					}
				}
				resolve(totalLocked);
			}
		} catch(e) {
			reject(e);
		}
	});
}

function smartnode(command) {
		return masternode(command, smartnode);
}

function masternode(command, masternodeCommand = "masternode") {
	return new Promise((resolve, reject) => {
		var possibleCommand = ["count", "list", "current", "winner", "winners"];
		if(command) {
			command = command.toLowerCase();
		} else {
			resolve({"error" : "no command was given"});
		}
		if(possibleCommand.includes(command)) {
			getRpcDataWithParams({method:masternodeCommand, parameters:[command]}).then(result => {
				resolve(result);
			}).catch(reject);
		} else {
			resolve({"error" : `${command} is an invalid command`});
		}
	});
}

function getRawTransactions(txids) {
	return new Promise(async (resolve, reject) => {
		result = [];
		var rawRequests = [];
		try {
			for(var i in txids) {
				if((i+1) % 10)  {
					rawRequests.push({method : "getrawtransaction", parameters : [txids[i], 1]});
				} else {
					var rawResults = await getBatchRpcData(rawRequests);
					result.push(...rawResults);
					rawRequests = [];
				}
			}
			if(rawRequests.length > 0) {
				var rawResults = await getBatchRpcData(rawRequests);
				result.push(...rawResults);
			}
			resolve(result);
		} catch(err) {
			reject(err);
		};
	})
}

function protx(command, params) {
	return new Promise((resolve, reject) => {
		var possibleCommand = ["list", "info", "diff"];
		if(command) {
			command = command.toLowerCase();
		} else {
			resolve({"error" : "no command was given"});
		}
		if(possibleCommand.includes(command)) {
			var parameters = [command];
			if(command == "info") {
				if(params.protxhash) {
					parameters.push(params.protxhash);
				} else {
					return resolve({"error" : "protxhash was not given for info command"});
				}
			} else if(command == "diff") {
				if(params.baseblock && params.block) {
					parameters.push(params.baseblock);
					parameters.push(params.block);
				} else {
					return resolve({"error" : "baseblock or/and baseblock was not given for diff command"});
				}
			}
			getRpcDataWithParams({method:"protx", parameters:parameters}).then(result => {
				resolve(result);
			}).catch(reject);
		} else {
			resolve({"error" : `${command} is an invalid command`});
		}
	});
}

function quorum(command, params) {
	return new Promise((resolve, reject) => {
		var possibleCommand = ["list", "info", "memberof", "isconflicting"];
		if(command) {
			command = command.toLowerCase();
		} else {
			resolve({"error" : "no command was given"});
		}
		if(possibleCommand.includes(command)) {
			var parameters = [command];
			if(command == "info") {
				if(params.llmqtype && params.quorumhash) {
					parameters.push(params.llmqtype);
					parameters.push(params.quorumhash);
					if(params.skshare) {
						parameters.push(params.skshare);
					}
				} else {
					return resolve({"error" : "quorumhash or/and llmqtype was not given for info command"});
				}
			} else if(command == "memberof") {
				if(params.protxhash) {
					parameters.push(params.protxhash);
					if(params.count) {
						parameters.push(params.count);
					}
				} else {
					return resolve({"error" : "protxhash was not given for memberof command"});
				}
			} else if(command == "isconflicting") {
				if(params.llmqtype && params.id && params.msghash) {
					parameters.push(params.llmqtype);
					parameters.push(params.id);
					parameters.push(params.msghash);
				} else {
					return resolve({"error" : "llmqtype, id, or/and msghash was not given for isconflicting command"});
				}
			}
			getRpcDataWithParams({method:"quorum", parameters:parameters}).then(result => {
				resolve(result);
			}).catch(reject);
		} else {
			resolve({"error" : `${command} is an invalid command`});
		}
	});
}

function getMasternodeReachableCount() {
	var self = this;
	return new Promise((resolve, reject) => {
		masternode("list", global.coinConfig.masternodeCommand).then(async mnList => {
			pingUtils.clearIpList();
			for(var tx in mnList) {
				var mn = mnList[tx];
				if(mn.status === "ENABLED") {
					var ipPort = mn.address.split(':');
					var isReachable = await pingUtils.isIpPortReachableFromCache(ipPort[0], ipPort[1]);
				}
			}
			var checkResult = await pingUtils.checkIpsAsync();
			resolve(checkResult);
		}).catch(reject);
	});
}

function getOutputAddressBalance(fromHeight, endHeight) {
	return new Promise((resolve, reject) => {
		getOutputAddressForBlocks(fromHeight, endHeight).then(async addresses => {
			var addressBalanceRequests = [];
			var wallets = [];
			var walletIndex = 0;
			for(var address in addresses) {
				addressBalanceRequests.push({method : "getaddressbalance", parameters: [{addresses : [address]}]});
				wallets.push({
					address : address,
					balance : 0
				});
				if(addressBalanceRequests.length > 100) {
					console.log("scanning address balance for the next %s addresses", addressBalanceRequests.length);
					await lookForAddressBalance(addressBalanceRequests, wallets, walletIndex);
					walletIndex += addressBalanceRequests.length;
					addressBalanceRequests = [];
				}
			}
			if(addressBalanceRequests.length > 0) {
				console.log("scanning address balance for the next %s addresses", addressBalanceRequests.length);
				await lookForAddressBalance(addressBalanceRequests, wallets, walletIndex);
			}
			resolve(wallets);
		}).catch(reject);
	});
}

function lookForAddressBalance(addressBalanceRequests, wallets, start) {
	return new Promise((resolve, reject) => {
		 getBatchRpcData(addressBalanceRequests).then(addressBalances => {
			 for(var index in addressBalances) {
				 var walletIndex = start + Number(index);
				 wallets[walletIndex].balance = addressBalances[index].balance;
			 }
			 resolve(wallets);
		 }).catch(reject);
	});
}

function getOutputAddressForBlocks(fromHeight, endHeight) {
	return new Promise(async (resolve, reject) => {
		var blockCountLimit = 100;
		var addresses = {};
		console.log("Syncing Addresses from %s to %s blocks", fromHeight, endHeight);
		for(var height = fromHeight; height < endHeight;) {
			var blockHashRequests = [];
			var roundEndHeight = height + blockCountLimit;
			if(roundEndHeight > endHeight) {
				roundEndHeight = endHeight;
				blockCountLimit = roundEndHeight - height;
			}
			for(var i = 0; i < blockCountLimit; i++) {
				blockHashRequests.push({method : "getblockhash", parameters : [height + i]});
			}
			try {
				var blockHashes = await getBatchRpcData(blockHashRequests);
				var blockRequests = [];
				for(var index in blockHashes) {
					blockRequests.push({method : "getblock", parameters : [blockHashes[index]]});
				}
				var blocks = await getBatchRpcData(blockRequests);
				console.log("scanning transaction from %s to %s blocks", height, roundEndHeight);
				var transactionRequests = [];
				for(var bIndex in blocks) {
					for(var txIndex in blocks[bIndex].tx) {

						transactionRequests.push({method : "getrawtransaction", parameters : [blocks[bIndex].tx[txIndex], 1]});
						if(transactionRequests.length > 100) {
							await lookForTransactions(transactionRequests, addresses);
							transactionRequests = [];
						}
					}
				}
				if(transactionRequests.length > 0) {
					await lookForTransactions(transactionRequests, addresses);
				}
				height = roundEndHeight;
			} catch(err) {
				return reject(err);
			}
		}
		resolve(addresses);
	});
}

function lookForTransactions(transactionRequests, addresses) {
	return new Promise((resolve, reject) => {
		getBatchRpcData(transactionRequests).then(transactions => {
			// console.log(transactions);
			for(var j in transactions) {
				if(transactions[j].vout) {
					for(var vIndex in transactions[j].vout) {
						var vout = transactions[j].vout[vIndex];
						if(vout.scriptPubKey && vout.scriptPubKey.addresses) {
							for(var aIndex in vout.scriptPubKey.addresses) {
								addresses[vout.scriptPubKey.addresses[aIndex]] = 0;
							}
						}
					}
				}
			}
			resolve(addresses);
		}).catch(reject);
	});
}

function getRpcMethodHelp(methodName) {
	return getRpcDataWithParams({method:"help", parameters:[methodName]});

}


function getRpcData(cmd) {
	return new Promise(function(resolve, reject) {
		debugLog(`RPC: ${cmd}`);
		let rpcCall = function (callback) {
			let client = (cmd == "gettxoutsetinfo" ? global.rpcClientNoTimeout : global.rpcClient);
			client.command(cmd).then(result => {
				resolve(result)
				callback();
			}).catch(err => {
				utils.logError("32euofeege", err, {cmd: cmd});
				reject(err);
				callback();
			})
		};
		rpcQueue.push({rpcCall: rpcCall});
	});
}

function batchRpcCommand(requests, callback, resolve, reject, retry = 2) {
	global.rpcClient.command(requests, function(err, result, resHeaders) {
		if (err != null) {
			if(retry <= 1) {
				utils.logError("38eh39hdee", err, {result:result, headers:resHeaders});
				reject(err);
				callback();
			} else {
				setTimeout(() => {
					retry--;
					batchRpcCommand(requests, callback, resolve, reject, retry);
				}, 10);
			}
			return;
		}
		for(var r of result) {
			if(r == null || r.code && r.code < 0) {
				if(retry <= 1) {
					reject(r);
					callback();
				} else {
					setTimeout(() => {
						retry--;
						batchRpcCommand(requests, callback, resolve, reject, retry);
					}, 10);
				}
				return;
			}
		}
		resolve(result);

		callback();
	});
}

function getBatchRpcData(requests) {
	return new Promise(function(resolve, reject) {
		debugLog(`RPC: ${JSON.stringify(requests)}`);

		let rpcCall = function (callback) {
			global.rpcClient.command(requests).then(result => {
				for (var r of result) {
					if (r == null || r.code && r.code < 0) {
						reject(r);
						callback();
						return;
					}
				}
				resolve(result);
				callback();
			}).catch(err => {
				utils.logError("38eh39hdee", err, {requests : requests});
				reject(err)
				callback();
			});
		};
		rpcQueue.push({rpcCall:rpcCall});
	});
}

function singleRpcCommand(request, callback, resolve, reject, retry = 2) {
	global.rpcClient.command([request]).then(result => {
		resolve(result[0]);
		callback();
	}).catch(err => {
		utils.logError("38eh39hdee", err, {request : request});
		if(retry <= 1) {
			reject(err);
			callback();
		} else {
			setTimeout(() => {
				retry--;
				singleRpcCommand(request, callback, resolve, reject, retry);
			}, 10);
		}
		return;
	});
}

function getRpcDataWithParams(request) {
	return new Promise(function(resolve, reject) {
		debugLog(`RPC: ${JSON.stringify(request)}`);

		let rpcCall = function (callback) {
			singleRpcCommand(request, callback, resolve, reject);
		};
		rpcQueue.push({rpcCall:rpcCall});
	});
}

module.exports = {
	getBlockchainInfo: getBlockchainInfo,
	getNetworkInfo: getNetworkInfo,
	getNetTotals: getNetTotals,
	getMempoolInfo: getMempoolInfo,
	getMempoolTxids: getMempoolTxids,
	getMiningInfo: getMiningInfo,
	getBlockByHeight: getBlockByHeight,
	getBlockByHash: getBlockByHash,
	getRawTransaction: getRawTransaction,
	getRawTransactions : getRawTransactions,
	getUtxo: getUtxo,
	getMempoolTxDetails: getMempoolTxDetails,
	getRawMempool: getRawMempool,
	getUptimeSeconds: getUptimeSeconds,
	getHelp: getHelp,
	getRpcMethodHelp: getRpcMethodHelp,
	getAddress: getAddress,
	getPeerInfo: getPeerInfo,
	getChainTxStats : getChainTxStats,
	getBlockCount : getBlockCount,
	getBlock : getBlock,
	getSupply : getSupply,
	broadcast : broadcast,
	getAddressDetails : getAddressDetails,
	getAddressUTXOs : getAddressUTXOs,
	getAddressBalance : getAddressBalance,
	getAddresessBalance : getAddresessBalance,
	getAddressDeltas : getAddressDeltas,
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
	totalCoinLockedByMN : totalCoinLockedByMN
};
