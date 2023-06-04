const coreApi = require("./../app/api/coreApi.js");
const addressApi = require("./../app/api/addressApi.js");
const MarketAPI = require("./../app/api/MarketApi.js");
//var sha256 = require("crypto-js/sha256");
//var hexEnc = require("crypto-js/enc-hex");
const utils = require('./../app/utils.js');
const pingUtils = require('./../app/pingUtils.js');
const PageRender = require('./../app/pageRender.js');
const coins = require("./../app/coins.js");
const config = require("./../app/config.js");
const Decimal = require("decimal.js");
const moment = require('moment');
const request = require('request').defaults({ rejectUnauthorized: false });

class RestfulRouter {
	constructor(router, apiProperties) {
		let self = this;
		apiProperties.api_map.forEach(api => {
			router.get(`/${api.uri}`, (req, res, next) => {
				var method = api.method ? api.method : api.name
				self.triggerApiCall(api.api_source, method, req).then(result => {
					if(result instanceof Object) {
						res.set('Content-Type', 'application/json');
						res.send(JSON.stringify(result, null, 4));
					} else {
						res.set('Content-Type', 'text/plain');
						res.send(self.checkAndParseString(result));
					}
					next();
				}).catch(e => {
					console.error(e);
					res.send(e + "");
					next();
				});
			});
		});
		let pageRender = new PageRender(router, "/", "api");
		pageRender.prepareRender(this.infoPageContent.bind(this));
	}

	infoPageContent() {
		var api = coins[config.coin].api();
		return {APIS : api.api_map,
				baseUri : api.base_uri};
	}

	triggerApiCall(type, apiMethod, paramValues) {
		switch(type) {
		case "core":
			return coreApi[apiMethod].call(null, paramValues);
		case "address":
			return addressApi[apiMethod].call(null, paramValues);
		default :
			return this[type].call(this, paramValues);
		}
	}

	getNetworkHashes(req) {
		var total = this.checkAndParseParams("number",req.query.total);
		var from = this.checkAndParseParams("number",req.query.from);
		var self = this;
		return new Promise((resolve, reject) => {
			if(total > 0) {
				if(from) {
					self.getNetworkHashesHelper(total, from).then(result => {
						resolve(result);
					}).catch(reject);
				} else {
					coreApi.getBlockCount().then(height => {
						from = height;
						self.getNetworkHashesHelper(total, from).then(result => {
							resolve(result);
						}).catch(reject);
					}).catch(reject);
				}
			} else {
				resolve({});
			}
		});
	}
	getNetworkHashesHelper(total, from) {
		return new Promise((resolve, reject) => {
			var promises = [];
			var lastBlock = from - total;
			if(lastBlock < 0) {
				total = from;
			}
			for(var i=0; i < total; i++) {
				promises.push(coreApi.getNetworkHash(from - i));
			}
			Promise.all(promises).then(hashes => {
				var result = {};
				for(var i=0; i < total; i++) {
					result[from-i] = hashes[i];
				}
				resolve(result)
			}).catch(reject);
		});
	}
	getAssetAddresses(req) {
		var searchTerm = this.checkAndParseParams("string", req.query.assetname);
		var start = this.checkAndParseParams("number",req.query.start);
		var limit = this.checkAndParseParams("number", req.query.length);
		var draw = req.query.draw;
		return new Promise((resolve, reject) => {
			var result = {
				data : [],
				draw : draw
			}
			if(!searchTerm || searchTerm.trim() === "") {
				result.recordsTotal = 0;
				result. recordsFiltered = 0;
				resolve(result);
			} else {
				searchTerm = searchTerm.toUpperCase();
				if(start < 0) {
					start = 0;
				}
				coreApi.getTotalAssetAddresses({query : {assetname : searchTerm}}).then( count => {
					if(limit < 0) {
						limit = count;
					}
					result.recordsTotal = count;
					result. recordsFiltered = count;
					if(count > 0) {
						coreApi.getAssetAddresses(searchTerm, start, limit).then(addresses => {
							for(var address in addresses) {
								result.data.push({
									Address : address,
									Balance : addresses[address]
								});
							}
							resolve(result);
						}).catch(reject);
					} else {
						resolve(result);
					}
				}).catch(reject);
			}
		});
	}

	queryRichList(req) {
		var query = this.parseQuery(req);
		return new Promise((resolve, reject) => {
			if(!query.limit) {
				query.limit = 10;
			}
			if(query.start < 0) {
				query.start = 0;
			}
			request(`${process.env.CHAIN_API_URL}/${global.coinConfig.ticker}/richlist?page=${query.start/query.limit}&size=${query.limit}&sort=balance,desc`, { json: true }, (err, res, body) => {
			  if (err) { return reject(err); }
				let wallets = body.content;
				var walletRecords = [];
				for(let i in wallets) {
					walletRecords.push({
						Rank :  query.start + Number(i) + 1,
						Address : wallets[i].address,
						Label : wallets[i].label ? wallets[i].label : "",
						Balance : Number(wallets[i].balance).toLocaleString()
					})
				}
				resolve({
					data : walletRecords,
					draw : query.draw,
					recordsTotal : body.totalElements,
					recordsFiltered : body.totalElements
				});
			});
		});
	}

	parseQuery(req) {
		var start = this.checkAndParseParams("number",req.query.start);
		var limit = this.checkAndParseParams("number", req.query.length);
		var searchTerm = req.query.search ? this.checkAndParseParams("string", req.query.search.value) : "";

		var draw = req.query.draw;
		if(!searchTerm || searchTerm.trim() === "") {
			searchTerm =  "*";
		}
		searchTerm = searchTerm.trim().toUpperCase();
		if(start < 0) {
			start = 0;
		}
		return {
			start : start,
			limit : limit,
			searchTerm : searchTerm,
			draw : draw
		}
	}

	queryAssets(req) {
		var start = this.checkAndParseParams("number",req.query.start);
		var limit = this.checkAndParseParams("number", req.query.length);
		var searchTerm = this.checkAndParseParams("string", req.query.search.value);
		var draw = req.query.draw;
		return new Promise((resolve, reject) => {
			if(!searchTerm || searchTerm.trim() === "") {
				searchTerm =  "*";
			}
			searchTerm = searchTerm.trim().toUpperCase();
			if(start < 0) {
				start = 0;
			}
			var promises = [coreApi.getTotalAssetCount()];
			if(searchTerm !== "*") {
				promises.push(coreApi.getTotalAssetCount(searchTerm));
			}
			Promise.all(promises).then(totals => {
				if(limit < 0) {
					limit = totals[0];
				}
				coreApi.queryAssets(searchTerm, start, limit).then(assetResult => {
						var assets = [];
						for(var assetName in assetResult) {
							assets.push({
								Name : assetName,
								Amount : assetResult[assetName].amount,
								Units : assetResult[assetName].units,
								Reissuable : assetResult[assetName].reissuable ? true : false,
								"IPFS Hash" : assetResult[assetName].ipfs_hash ? assetResult[assetName].ipfs_hash : "",
								"Block Height" : assetResult[assetName].block_height
							});
						}
						resolve({
							data : assets,
							draw : draw,
							recordsTotal : totals[0],
							recordsFiltered : totals[1] ? totals[1] : totals[0]
						});
				}).catch(err => {
					console.error(err);
					reject(err);
				});
			}).catch(reject);
		});
	}

	getBlocks(req) {
		let self = this;
		let start = this.checkAndParseParams("number", req.query.start);
		let limit = this.checkAndParseParams("number", req.query.length);
		let searchTerm = this.checkAndParseParams("string", req.query.search.value);
		let draw = req.query.draw;
		return new Promise((resolve, reject) => {
			let result = {
				data : [],
				draw : draw,
				recordsTotal : 0,
				recordsFiltered : 0
			}
			if(start < 0) {
				start = 0;
			}
			if(limit < 0) {
				limit = 100;
			}
			let filteredHeights = searchTerm ? searchTerm.split("-") : [];
			let lowHeight;
			let maxHeight;
			let defaultLow = false;
			if(filteredHeights.length > 1) {
				maxHeight = filteredHeights[1];
				lowHeight = filteredHeights[0];
			} else if(filteredHeights.length === 1) {
				lowHeight = filteredHeights[0];
			} else {
				lowHeight = 1;
				defaultLow = true;
			}
			if(lowHeight === "*") {
				lowHeight = 1;
			} else {
				lowHeight = self.checkAndParseNumber(lowHeight);
			}
			if(!lowHeight) {
				lowHeight = 1;
				defaultLow = true;
			}
			if(lowHeight) {
				coreApi.getBlockCount().then( currentHeight => {
					if(maxHeight) {
						if(maxHeight === "*") {
							maxHeight = currentHeight;
						}
						maxHeight = self.checkAndParseNumber(maxHeight);
						if(!maxHeight) {
							maxHeight = defaultLow ? currentHeight : lowHeight;
						}
						maxHeight = maxHeight > currentHeight ? currentHeight : maxHeight
					} else if(lowHeight > currentHeight){
						resolve(result);
					} else {
						maxHeight = defaultLow ? currentHeight : lowHeight;
					}
					result.recordsTotal = currentHeight;
					result.recordsFiltered = maxHeight - lowHeight + 1;
					maxHeight = maxHeight - start;
					self.getBlocksInfo(lowHeight, maxHeight, limit, req).then(blockInfo => {
						result.data = blockInfo;
						resolve(result);
					}).catch(reject);
				}).catch(reject);
			} else {
				resolve(result);
			}
		});
	}
	getBlocksInfo(startHeight, endHeight, limit, req) {
		var self = this;
		return new Promise((resolve, reject) => {
			var blockHeights = [];
			var totalBlocks = (endHeight - startHeight + 1);
			if(totalBlocks <= 0) {
				resolve([]);
			} else {
				limit = totalBlocks > limit ? limit : totalBlocks;
				for (var i = 0; i < limit; i++) {
					blockHeights.push(endHeight - i);
				}
				coreApi.getBlocksByHeight(blockHeights).then(blocks => {
					var result = [];
					for(var i in blocks) {
						if(!blocks[i].tx) {
							continue;
						}
						var blockTime = moment.utc(new Date(parseInt(blocks[i].time) * 1000));
						var currencyValue =new Decimal(blocks[i].totalFees).dividedBy(blocks[i].tx.length);
						var currencyFormatInfo = utils.getCurrencyFormatInfo(req.session.currencyFormatType);
						var value = {
							amount : 0,
							unit : config.coin
						};
						if (currencyValue > 0) {
							var parts = utils.formatCurrencyAmount(currencyValue, req.session.currencyFormatType).split(" ");
							value.amount = parts[0];
							value.unit = parts[1];
							if (currencyFormatInfo.type == "native" && global.exchangeRates) {
								value.tooltip = utils.formatExchangedCurrency(currencyValue, "usd");
							} else if (currencyFormatInfo.type == "exchanged") {
								value.tooltip = utils.formatCurrencyAmount(currencyValue, coins[config.coin].defaultCurrencyUnit.name);
							}
						}
						var fullPercent = new Decimal(100 * blocks[i].weight / coins[config.coin].maxBlockWeight).toDecimalPlaces(1);
						result.push({
							Height : blocks[i].height.toLocaleString(),
							Timestamp : blockTime.format("Y-MM-DD HH:mm:ss"),
							Age : moment.duration(moment.utc(new Date()).diff(blockTime)).format(),
							Miner : blocks[i].miner ? blocks[i].miner : {name : "?"},
							Transactions : blocks[i].tx.length.toLocaleString(),
							"Average Fee" : value,
							"Size (bytes)" : blocks[i].size.toLocaleString(),
							"Weight (wu)" : blocks[i].weight ? {
								weight : blocks[i].weight.toLocaleString(),
								percentage : `${fullPercent}%`,
								maxWeight : coins[config.coin].maxBlockWeight
							} : {}
						});
					}
					if(result.length === 0) {
						console.log("getBlocksByHeight %O is not return any result", blockHeights);
					}
					resolve(result);
				}).catch(reject);
			}
		});
	}
	getLatestTxids(req) {
		var self = this;
		return new Promise(function(resolve, reject) {
			var blocks = self.checkAndParseParams("number", req.query.blocks);
			coreApi.getBlockCount().then(height => {
				var data = [];
				var ids = [];
				if (height) {
					var blockHeights = [];
					for (var i = 0; i < blocks; i++) {
						blockHeights.push(height - i);
					}
					var promises = [];
					promises.push(coreApi.getMempoolTxids());
					promises.push(coreApi.getBlocksByHeight(blockHeights));
					Promise.all(promises).then(results => {
						var latestBlocks = results[1];
						var unconfirmedTxids = results[0];
						for(var i in unconfirmedTxids) {
							data.push({
								TXID : unconfirmedTxids[i],
								Confirmations : 0
							});
							ids.push(unconfirmedTxids[i]);
						}
						for(var j in latestBlocks) {
							var  block = latestBlocks[j];
							for(var z in block.tx) {
								data.push({
									TXID : block.tx[z],
									Confirmations : Number(j) + 1
								});
								ids.push(block.tx[z]);
							}
						}
						resolve(data);
						//resolve({data : ids});
					}).catch(reject);
				} else {
					resolve(data);
				}
			}).catch(reject);
		});
	}

	getAddressUTXOs(req) {
		var addresses = this.checkAndParseParams("string", req.query.address);
		return new Promise((resolve, reject) =>{
			if(!addresses || (addresses instanceof Object && addresses.length === 0)) {
				return resolve({});
			}
			var promises = [];
			if(!(addresses instanceof Object)) {
				addresses = [addresses];
			}
			for(var index in addresses) {
				promises.push(coreApi.getAddress(addresses[index]));
			}
			Promise.all(promises).then(validatedAddresses => {
				promises = [];
				for(var i in validatedAddresses) {
					if(validatedAddresses[i].isvalid) {
						promises.push(addressApi.getAddressUTXOs(addresses[i], config.addressApi === "daemonRPC" ? null : validatedAddresses[i].scriptPubKey));
					}
				}
				if(promises.length > 0) {
					Promise.all(promises).then(utxos => {
						var result = {};
						for(var j in utxos) {
							if(utxos[j].result) {
								result[addresses[j]] = utxos[j].result;
							} else {
								result[addresses[j]] = utxos[j];
							}
						}
						resolve(result);
					}).catch(err => {
						utils.logError("23t07ug2wghefud", err);
						resolve({});
					});
				} else {
					resolve({});
				}
			}).catch(err => {
				utils.logError("23t07ug2wghefud", err);
				resolve({});
			});
		});
	}

	getAddressBalance(req) {
		var addresses = this.checkAndParseParams("string", req.query.address);
		return new Promise((resolve, reject) =>{
			if(!addresses || (addresses instanceof Object && addresses.length === 0)) {
				return resolve({});
			}
			var promises = [];
			if(!(addresses instanceof Object)) {
				addresses = [addresses];
			}
			for(var index in addresses) {
				promises.push(coreApi.getAddress(addresses[index]));
			}
			Promise.all(promises).then(validatedAddresses => {
				promises = [];
				for(var i in validatedAddresses) {
					if(validatedAddresses[i].isvalid) {
						promises.push(addressApi.getAddressBalance(addresses[i], config.addressApi === "daemonRPC" ? null : validatedAddresses[i].scriptPubKey));
					}
				}
				if(promises.length > 0) {
					Promise.all(promises).then(balances => {
						var result = {};
						for(var j in balances) {
							if(balances[j].result) {
								result[addresses[j]] = balances[j].result;
							} else {
								result[addresses[j]] = balances[j];
							}
						}
						resolve(result);
					}).catch(err => {
						utils.logError("23t07ug2wghefud", err);
						resolve({});
					});
				} else {
					resolve({});
				}
			}).catch(err => {
				utils.logError("23t07ug2wghefud", err);
				resolve({});
			});
		});
	}

	getMarketList(req) {
		var self = this;
		return new Promise((resolve, reject) => {
			var marketApi = new MarketAPI({});
			marketApi.getMarket(global.coinConfig.ticker).then(markets => {
				resolve(markets);
			}).catch(reject);
		});
	}

	getNodeList(req) {
		var self = this;
		return new Promise((resolve, reject) => {
			coreApi.masternode({query : {command :"list"}}, global.coinConfig.masternodeCommand).then(async mnList => {
				var result = {
					data : [],
					draw : req.query.draw,
					recordsTotal : 0,
					recordsFiltered : 0
				};
				for(var tx in mnList) {
					var mn = mnList[tx];
					//console.log(mn);
					result.recordsTotal++;
					var ipPort = mn.address.split(':');
					var isReachable = await pingUtils.isIpPortReachableFromCache(ipPort[0], ipPort[1]);
					var reachableStatus;
					if(isReachable === "Not Cached") {
						reachableStatus = "Checking"
					} else {
						reachableStatus = isReachable;// ? "Yes" : "No";
					}
					result.data.push({
						IP : ipPort[0],
						"Status" : mn.status,
						"Reachable" : reachableStatus,
						"Collateral Address" : mn.collateraladdress,
						"Protx Hash" : mn.proTxHash,
						"Voting Address" : mn.votingaddress,
						"Owner Address" : mn.owneraddress,
						"Payee Address" : mn.payee,
						"Last Paid Block" : mn.lastpaidblock,
						"Last Paid Time" : moment.utc(new Date(parseInt(mn.lastpaidtime) * 1000)).format("Y-MM-DD HH:mm:ss")
					});
				}
				result.data.sort((first, second) => {
					return second.Reachable.toLocaleString().localeCompare(first.Reachable.toLocaleString());
				});
				result.recordsFiltered = result.recordsTotal;
				pingUtils.checkIps();
				resolve(result.data);
			}).catch(reject);
		});
	}

	getMasternodeCount() {
		var self = this;
		return new Promise((resolve, reject) => {
			coreApi.masternode({query : {command :"count"}}, global.coinConfig.masternodeCommand).then(mnCount => {
				resolve(`${mnCount.enabled}/${mnCount.total}`);
			}).catch(reject);
		});
	}

	checkAndParseString(value) {
		if(value) {
			value = (typeof value) === "string" ? value.trim() : JSON.stringify(value);
			return value !== "" ? value : null;
		}
		return null;
	}
	checkAndParseNumber(value) {
		if(value) {
			value = (typeof value) === "string" ? value.trim() : value;
			var num = Number(value);
			if(isNaN(num)) {
				return null;
			}
			return num;
		}
		return null;
	}

	checkAndParseParams(paramType, paramValue, key) {
		switch(paramType) {
		case "string" :
			return this.checkAndParseString(paramValue);
			break;
		case "number" :
			return this.checkAndParseNumber(paramValue);
			break;
		case "boolean" :
			return paramValue ? paramValue.toLowerCase() === "true" || paramValue == "1" : false;
			break;
		case "object" :
			return paramValue ? paramValue[key] : paramValue;
			break;
		}
	}
}

module.exports = RestfulRouter;
