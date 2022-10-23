var debug = require("debug");

var debugLog = debug("btcexp:utils");
var debugErrorLog = debug("btcexp:error");

var Decimal = require("decimal.js");
var request = require("request");
var qrcode = require("qrcode");

var config = require("./config.js");
var coins = require("./coins.js");
var coinConfig = coins[config.coin];
var redisCache = require("./redisCache.js");
var Cache = require("./cache.js");
const schedule = require("node-schedule");
const isPortReachable = require('is-port-reachable');
var reachableCache = new Cache(process.env.MAX_REACHABLE_CACHE ? process.env.MAX_REACHABLE_CACHE : 5000);
var ipList = {}


var exponentScales = [
	{val:1000000000000000000000000000000000, name:"?", abbreviation:"V", exponent:"33"},
	{val:1000000000000000000000000000000, name:"?", abbreviation:"W", exponent:"30"},
	{val:1000000000000000000000000000, name:"?", abbreviation:"X", exponent:"27"},
	{val:1000000000000000000000000, name:"yotta", abbreviation:"Y", exponent:"24"},
	{val:1000000000000000000000, name:"zetta", abbreviation:"Z", exponent:"21"},
	{val:1000000000000000000, name:"exa", abbreviation:"E", exponent:"18"},
	{val:1000000000000000, name:"peta", abbreviation:"P", exponent:"15"},
	{val:1000000000000, name:"tera", abbreviation:"T", exponent:"12"},
	{val:1000000000, name:"giga", abbreviation:"G", exponent:"9"},
	{val:1000000, name:"mega", abbreviation:"M", exponent:"6"},
	{val:1000, name:"kilo", abbreviation:"K", exponent:"3"}
];

var ipMemoryCache = {};
var ipCache = {
	get:function(key) {
		return new Promise(function(resolve, reject) {
			if (ipMemoryCache[key] != null) {
				resolve({key:key, value:ipMemoryCache[key]});

				return;
			}

			if (redisCache.active) {
				redisCache.get("ip-" + key).then(function(redisResult) {
					if (redisResult != null) {
						resolve({key:key, value:redisResult});

						return;
					}

					resolve({key:key, value:null});
				});

			} else {
				resolve({key:key, value:null});
			}
		});
	},
	set:function(key, value, expirationMillis) {
		ipMemoryCache[key] = value;

		if (redisCache.active) {
			redisCache.set("ip-" + key, value, expirationMillis);
		}
	}
};



function redirectToConnectPageIfNeeded(req, res) {
	if (!req.session.host) {
		req.session.redirectUrl = req.originalUrl;

		res.redirect("/");
		res.end();

		return true;
	}

	return false;
}

function hex2ascii(hex) {
	var str = "";
	for (var i = 0; i < hex.length; i += 2) {
		str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
	}

	return str;
}

function splitArrayIntoChunks(array, chunkSize) {
	var j = array.length;
	var chunks = [];

	for (var i = 0; i < j; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}

	return chunks;
}

function getRandomString(length, chars) {
    var mask = '';

    if (chars.indexOf('a') > -1) {
		mask += 'abcdefghijklmnopqrstuvwxyz';
	}

    if (chars.indexOf('A') > -1) {
		mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	}

    if (chars.indexOf('#') > -1) {
		mask += '0123456789';
	}

	if (chars.indexOf('!') > -1) {
		mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
	}

    var result = '';
    for (var i = length; i > 0; --i) {
		result += mask[Math.floor(Math.random() * mask.length)];
	}

	return result;
}

var formatCurrencyCache = {};

function getCurrencyFormatInfo(formatType) {
	if (formatCurrencyCache[formatType] == null) {
		for (var x = 0; x < coins[config.coin].currencyUnits.length; x++) {
			var currencyUnit = coins[config.coin].currencyUnits[x];

			for (var y = 0; y < currencyUnit.values.length; y++) {
				var currencyUnitValue = currencyUnit.values[y];

				if (currencyUnitValue == formatType) {
					formatCurrencyCache[formatType] = currencyUnit;
				}
			}
		}
	}

	if (formatCurrencyCache[formatType] != null) {
		return formatCurrencyCache[formatType];
	}

	return null;
}

function formatCurrencyAmountWithForcedDecimalPlaces(amount, formatType, assetName, forcedDecimalPlaces) {
	var formatInfo = getCurrencyFormatInfo(formatType);
	if (formatInfo != null) {
		var dec = new Decimal(amount);

		var decimalPlaces = formatInfo.decimalPlaces;
		//if (decimalPlaces == 0 && dec < 1) {
		//	decimalPlaces = 5;
		//}

		if (forcedDecimalPlaces >= 0) {
			decimalPlaces = forcedDecimalPlaces;
		}
		//console.log("formatCurrencyAmountWithForcedDecimalPlaces assetName=", assetName);
		if (formatInfo.type == "native") {
			dec = dec.times(formatInfo.multiplier);
			var name = !assetName || assetName === coinConfig.ticker ? formatInfo.name : assetName;
			return addThousandsSeparators(dec.toDecimalPlaces(decimalPlaces)) + " " + name;

		} else if (formatInfo.type == "exchanged") {
			if (global.exchangeRates != null && global.exchangeRates[formatInfo.multiplier] != null) {
				dec = dec.times(global.exchangeRates[formatInfo.multiplier]);

				return addThousandsSeparators(dec.toDecimalPlaces(decimalPlaces)) + " " + formatInfo.name;

			} else {
				return formatCurrencyAmountWithForcedDecimalPlaces(amount, coinConfig.defaultCurrencyUnit.name, assetName, forcedDecimalPlaces);
			}
		}
	}

	return amount;
}

function formatCurrencyAmount(amount, formatType, assetName) {
	return formatCurrencyAmountWithForcedDecimalPlaces(amount, formatType,assetName, -1);
}

function formatCurrencyAmountInSmallestUnits(amount, assetName, forcedDecimalPlaces) {
	return formatCurrencyAmountWithForcedDecimalPlaces(amount, coins[config.coin].baseCurrencyUnit.name, assetName, forcedDecimalPlaces);
}

// ref: https://stackoverflow.com/a/2901298/673828
function addThousandsSeparators(x) {
	var parts = x.toString().split(".");
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

	return parts.join(".");
}

function formatExchangedCurrency(amount, exchangeType, symbol="$", decimal=2, toLocaleString = false) {
	if (global.exchangeRates != null && global.exchangeRates[exchangeType.toLowerCase()] != null) {
		var dec = new Decimal(amount);
		dec = Number(dec.times(global.exchangeRates[exchangeType.toLowerCase()])).toFixed(decimal);
		if(toLocaleString) {
			dec = Number(dec).toLocaleString();
		}
		return symbol + dec;
	}

	return "";
}

function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function seededRandomIntBetween(seed, min, max) {
	var rand = seededRandom(seed);
	return (min + (max - min) * rand);
}

function ellipsize(str, length) {
	if (str.length <= length) {
		return str;

	} else {
		return str.substring(0, length - 3) + "...";
	}
}

function logMemoryUsage() {
	var mbUsed = process.memoryUsage().heapUsed / 1024 / 1024;
	mbUsed = Math.round(mbUsed * 100) / 100;

	var mbTotal = process.memoryUsage().heapTotal / 1024 / 1024;
	mbTotal = Math.round(mbTotal * 100) / 100;

	//debugLog("memoryUsage: heapUsed=" + mbUsed + ", heapTotal=" + mbTotal + ", ratio=" + parseInt(mbUsed / mbTotal * 100));
}

function getMinerFromCoinbaseTx(tx) {
	if (tx == null || tx.vin == null || tx.vin.length == 0) {
		return null;
	}

	if (global.miningPoolsConfigs) {
		for (var i = 0; i < global.miningPoolsConfigs.length; i++) {
			var miningPoolsConfig = global.miningPoolsConfigs[i];

			for (var payoutAddress in miningPoolsConfig.payout_addresses) {
				if(payoutAddress && tx.vout && tx.vout.length > 0) {
					for(var i in tx.vout) {
						if(tx.vout[i].scriptPubKey && tx.vout[i].scriptPubKey.addresses &&
								tx.vout[i].scriptPubKey.addresses && tx.vout[i].scriptPubKey.addresses.includes(payoutAddress)) {
							var minerInfo = miningPoolsConfig.payout_addresses[payoutAddress];
							minerInfo.identifiedBy = "payout address " + payoutAddress;
							return minerInfo;
						}
					}
				}
				// if (miningPoolsConfig.payout_addresses.hasOwnProperty(payoutAddress)) {
				// 	if (tx.vout && tx.vout.length > 0 && tx.vout[0].scriptPubKey && tx.vout[0].scriptPubKey.addresses && tx.vout[0].scriptPubKey.addresses.length > 0) {
				// 		if (tx.vout[0].scriptPubKey.addresses[0] == payoutAddress) {
				// 			var minerInfo = miningPoolsConfig.payout_addresses[payoutAddress];
				// 			minerInfo.identifiedBy = "payout address " + payoutAddress;
				//
				// 			return minerInfo;
				// 		}
				// 	}
				// }
			}

			for (var coinbaseTag in miningPoolsConfig.coinbase_tags) {
				if (Object.hasOwn(miningPoolsConfig.coinbase_tags, coinbaseTag)) {
					if (hex2ascii(tx.vin[0].coinbase).indexOf(coinbaseTag) != -1) {
						var minerInfo = miningPoolsConfig.coinbase_tags[coinbaseTag];
						minerInfo.identifiedBy = "coinbase tag '" + coinbaseTag + "'";

						return minerInfo;
					}
				}
			}
		}
	}

	return null;
}

function getAssetValue(vout, assetName) {
	if(assetName === coinConfig.ticker) {
		return vout.value;
	}
	if(vout.scriptPubKey && vout.scriptPubKey.asset) {
		return vout.scriptPubKey.asset.amount;
	}
	return 0;
}

function getTxTotalInputOutputValues(tx, txInputs, blockHeight, assetName) {
	var totalInputValue = new Decimal(0);
	var totalOutputValue = new Decimal(0);
	if(!assetName) {
		assetName = coinConfig.ticker;
	}
	try {
		for (var i = 0; i < tx.vin.length; i++) {
			if (tx.vin[i].coinbase) {
				totalInputValue = totalInputValue.plus(new Decimal(coinConfig.blockRewardFunction(blockHeight)));

			} else {
				var txInput = txInputs[i];

				if (txInput) {
					try {
						var vout = txInput.vout[tx.vin[i].vout];
						var value = getAssetValue(vout, assetName);
						if (value) {
							totalInputValue = totalInputValue.plus(new Decimal(value));
						}
					} catch (err) {
						logError("2397gs0gsse", err, {txid:tx.txid, vinIndex:i});
					}
				}
			}
		}

		for (var i = 0; i < tx.vout.length; i++) {
			var value = getAssetValue(tx.vout[i], assetName);
			totalOutputValue = totalOutputValue.plus(new Decimal(value));
		}
	} catch (err) {
		logError("2308sh0sg44", err, {tx:tx, txInputs:txInputs, blockHeight:blockHeight});
	}

	return {input:totalInputValue, output:totalOutputValue};
}

function getBlockTotalFeesFromCoinbaseTxAndBlockHeight(coinbaseTx, blockHeight) {
	if (coinbaseTx == null) {
		return 0;
	}

	var blockReward = coinConfig.blockRewardFunction(blockHeight);

	var totalOutput = new Decimal(0);
	for (var i = 0; i < coinbaseTx.vout.length; i++) {
		var outputValue = coinbaseTx.vout[i].value;
		if (outputValue > 0) {
			totalOutput = totalOutput.plus(new Decimal(outputValue));
		}
	}

	return totalOutput.minus(new Decimal(blockReward));
}

function refreshExchangeRates() {
	if (!config.queryExchangeRates || config.privacyMode) {
		return;
	}

	if (coins[config.coin].exchangeRateData) {
		request(coins[config.coin].exchangeRateData.jsonUrl, function(error, response, body) {
			if (error == null && response && response.statusCode && response.statusCode == 200) {
				var responseBody = JSON.parse(body);

				var exchangeRates = coins[config.coin].exchangeRateData.responseBodySelectorFunction(responseBody);
				if (exchangeRates != null) {
					global.exchangeRates = exchangeRates;
					global.exchangeRatesUpdateTime = new Date();

					debugLog("Using exchange rates: " + JSON.stringify(global.exchangeRates) + " starting at " + global.exchangeRatesUpdateTime);

				} else {
					debugLog("Unable to get exchange rate data");
				}
			} else {
				logError("39r7h2390fgewfgds", {error:error, response:response, body:body});
			}
		});
	}
}

// Uses ipstack.com API
function geoLocateIpAddresses(ipAddresses, provider) {
	return new Promise(function(resolve, reject) {
		if (config.privacyMode || config.credentials.ipStackComApiAccessKey === undefined) {
			resolve({});

			return;
		}

		var ipDetails = {ips:ipAddresses, detailsByIp:{}};

		var promises = [];
		for (var i = 0; i < ipAddresses.length; i++) {
			var ipStr = ipAddresses[i];

			promises.push(new Promise(function(resolve2, reject2) {
				ipCache.get(ipStr).then(function(result) {
					if (result.value == null) {
						var apiUrl = "http://api.ipstack.com/" + result.key + "?access_key=" + config.credentials.ipStackComApiAccessKey;

						debugLog("Requesting IP-geo: " + apiUrl);

						request(apiUrl, function(error, response, body) {
							if (error) {
								reject2(error);

							} else {
								resolve2({needToProcess:true, response:response});
							}
						});

					} else {
						ipDetails.detailsByIp[result.key] = result.value;

						resolve2({needToProcess:false});
					}
				});
			}));
		}

		Promise.all(promises).then(function(results) {
			for (var i = 0; i < results.length; i++) {
				if (results[i].needToProcess) {
					var res = results[i].response;
					if (res != null && res["statusCode"] == 200) {
						var resBody = JSON.parse(res["body"]);
						var ip = resBody["ip"];

						ipDetails.detailsByIp[ip] = resBody;

						ipCache.set(ip, resBody, 1000 * 60 * 60 * 24 * 365);
					}
				}
			}

			resolve(ipDetails);

		}).catch(function(err) {
			logError("80342hrf78wgehdf07gds", err);

			reject(err);
		});
	});
}

function parseExponentStringDouble(val) {
	var [lead,decimal,pow] = val.toString().split(/e|\./);
	return +pow <= 0
		? "0." + "0".repeat(Math.abs(pow)-1) + lead + decimal
		: lead + ( +pow >= decimal.length ? (decimal + "0".repeat(+pow-decimal.length)) : (decimal.slice(0,+pow)+"."+decimal.slice(+pow)));
}

function formatLargeNumber(n, decimalPlaces) {
	for (var i = 0; i < exponentScales.length; i++) {
		var item = exponentScales[i];

		var fraction = new Decimal(n / item.val);
		if (fraction >= 1) {
			return [fraction.toDecimalPlaces(decimalPlaces), item];
		}
	}

	return [new Decimal(n).toDecimalPlaces(decimalPlaces), {}];
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {h:h, s:s, l:l};
}

function colorHexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function colorHexToHsl(hex) {
	var rgb = colorHexToRgb(hex);
	return rgbToHsl(rgb.r, rgb.g, rgb.b);
}


// https://stackoverflow.com/a/31424853/673828
const reflectPromise = p => p.then(v => ({v, status: "resolved" }),
                            e => ({e, status: "rejected" }));

function logError(errorId, err, optionalUserData = null) {
	if (!global.errorLog) {
		global.errorLog = [];
	}

	global.errorLog.push({errorId:errorId, error:err, userData:optionalUserData, date:new Date()});
	while (global.errorLog.length > 100) {
		global.errorLog.splice(0, 1);
	}

	debugErrorLog("Error " + errorId + ": " + err + ", json: " + JSON.stringify(err) + (optionalUserData != null ? (", userData: " + optionalUserData + " (json: " + JSON.stringify(optionalUserData) + ")") : ""));

	if (err && err.stack) {
		debugErrorLog("Stack: " + err.stack);
	}

	var returnVal = {errorId:errorId, error:err};
	if (optionalUserData) {
		returnVal.userData = optionalUserData;
	}

	return returnVal;
}

function buildQrCodeUrls(strings) {
	return new Promise(function(resolve, reject) {
		var promises = [];
		var qrcodeUrls = {};

		for (var i = 0; i < strings.length; i++) {
			promises.push(new Promise(function(resolve2, reject2) {
				buildQrCodeUrl(strings[i], qrcodeUrls).then(function() {
					resolve2();

				}).catch(function(err) {
					reject2(err);
				});
			}));
		}

		Promise.all(promises).then(function(results) {
			resolve(qrcodeUrls);

		}).catch(function(err) {
			reject(err);
		});
	});
}

function buildQrCodeUrl(str, results) {
	return new Promise(function(resolve, reject) {
		qrcode.toDataURL(str, function(err, url) {
			if (err) {
				logError("2q3ur8fhudshfs", err, str);

				reject(err);

				return;
			}

			results[str] = url;

			resolve();
		});
	});
}

function getDifficultyData(name, difficulty) {
	return {
			name : name,
			diff : difficulty,
			diffCal : formatLargeNumber(difficulty, 3)
	}
}

function getStatsSummary(json) {
	//console.log("getStatsSummary %O", json.getblockchaininfo.difficultiesData)
	var hashrateData = formatLargeNumber(json.miningInfo.networkhashps, 3);
	var mempoolBytesData = formatLargeNumber(json.mempoolInfo.usage, 2);
	var chainworkData = formatLargeNumber(parseInt("0x" + json.getblockchaininfo.chainwork), 2);
	var difficultiesData = {};
	for(var index in json.getblockchaininfo.difficultiesData) {
		diffData =  json.getblockchaininfo.difficultiesData[index];
		difficultiesData[diffData.name + "Num"] = diffData.diffCal[0];
		difficultiesData[diffData.name + "Exp"] = diffData.diffCal[1].exponent;
	}
	var sizeData;
	if(json.getblockchaininfo.size_on_disk) {
		sizeData = formatLargeNumber(json.getblockchaininfo.size_on_disk, 2);
	}
	var price = `${formatExchangedCurrency(1.0, "btc", "฿", 8)}/${formatExchangedCurrency(1.0, "usd", "$", 6)}`
	mempoolBytesData[1].abbreviation = mempoolBytesData[1].abbreviation ? mempoolBytesData[1].abbreviation : "";
	return {
		hashrate : {
			rate : hashrateData[0],
			unit : ` ${hashrateData[1].abbreviation}H = ${hashrateData[1].name}-hash (x10^${hashrateData[1].exponent})`
		},
		txcount : json.txStats.totalTxCount.toLocaleString(),
		mempool : {
			count : json.mempoolInfo.size.toLocaleString(),
			size : `(${mempoolBytesData[0]} ${mempoolBytesData[1].abbreviation}B)`
		},
		chainwork : {
			num : chainworkData[0],
			exp : chainworkData[1].exponent
		},
		diff : difficultiesData,
		chainSize : sizeData ? `${sizeData[0]} ${sizeData[1].abbreviation}B` : "N/A",
		price : price,
		height : json.getblockchaininfo.blocks
	}
	/*
	updateElementValue("hashrate", hashrateData[0]);
	updateElementAttr("hashUnit", "data-oriinal-title", `${hashrateData[1].abbreviation}H = ${hashrateData[1].name}-hash (x10^${hashrateData[1].exponent})`);
	updateElementValue("txStats", json.txStats.totalTxCount.toLocaleString());
	updateElementValue("mempoolCount", json.mempoolInfo.size.toLocaleString() + " tx");
	updateElementValue("mempoolSize", `(${mempoolBytesData[0]} ${mempoolBytesData[1].abbreviation}B)`);
	updateElementValue("chainworkNum", chainworkData[0]);
	updateElementValue("chainworkExp", chainworkData[1].exponent);
	updateElementValue("diffNum", difficultyData[0]);
	updateElementValue("diffExp", difficultyData[1].exponent);
	updateElementValue("chainSize", `${sizeData[0]} ${sizeData[1].abbreviation}B`);
	updateElementValue("price", price);*/
}

function isIpPortReachable(ip, port) {
		return reachableCache.tryCache(`${ip}:${port}`, 600000, () => {
			return isPortReachable(port, {host  : ip, timeout : 1000});
		});
}

function clearIpList() {
	ipList = {};
}

async function isIpPortReachableFromCache(ip, port) {
	ipList[ip] = port;
	var reachable = await reachableCache.get(`${ip}:${port}`);
	if(reachable == undefined || reachable == null) {
			return "Not Cached"
	}
	return reachable;
}

function checkIps(checkCount) {
	Object.keys(ipList).forEach(ip => {
		var port = ipList[ip];
		//console.log("checking if reachable %s:%s", ip, port);
		isIpPortReachable(ip, port).then(reachable => {
			var log = `${ip}:${port} is ${reachable ? "reachable" : "no reachable"}`;
			if(checkCount) {
				checkCount.count++;
				if(reachable) {
					checkCount.reachable++;
				}
			}
			debugLog(log);
			//console.log(log);
		}).catch(err => {
			console.log(err);
		})
	});
}

function checkIpsAsync() {
	return new Promise((resolve, reject) => {
		const checkCount = {count : 0, reachable: 0};
		checkIps(checkCount);
		const job = schedule.scheduleJob("0/1 * * * *", () => {
			console.log("checkCount.count ", checkCount.count);
				if(checkCount.count >= Object.keys(ipList).length) {
					resolve(`${checkCount.reachable}/${checkCount.count}`);
					job.cancel();
				}
		});
	});
}

function scheduleCheckIps() {
	schedule.scheduleJob("*/10 * * * *", checkIps);
}

module.exports = {
	checkIps: checkIps,
	checkIpsAsync: checkIpsAsync,
	isIpPortReachableFromCache: isIpPortReachableFromCache,
	scheduleCheckIps: scheduleCheckIps,
	reflectPromise: reflectPromise,
	redirectToConnectPageIfNeeded: redirectToConnectPageIfNeeded,
	hex2ascii: hex2ascii,
	splitArrayIntoChunks: splitArrayIntoChunks,
	getRandomString: getRandomString,
	getCurrencyFormatInfo: getCurrencyFormatInfo,
	formatCurrencyAmount: formatCurrencyAmount,
	formatCurrencyAmountWithForcedDecimalPlaces: formatCurrencyAmountWithForcedDecimalPlaces,
	formatExchangedCurrency: formatExchangedCurrency,
	addThousandsSeparators: addThousandsSeparators,
	formatCurrencyAmountInSmallestUnits: formatCurrencyAmountInSmallestUnits,
	seededRandom: seededRandom,
	seededRandomIntBetween: seededRandomIntBetween,
	logMemoryUsage: logMemoryUsage,
	getMinerFromCoinbaseTx: getMinerFromCoinbaseTx,
	getBlockTotalFeesFromCoinbaseTxAndBlockHeight: getBlockTotalFeesFromCoinbaseTxAndBlockHeight,
	refreshExchangeRates: refreshExchangeRates,
	parseExponentStringDouble: parseExponentStringDouble,
	formatLargeNumber: formatLargeNumber,
	geoLocateIpAddresses: geoLocateIpAddresses,
	getTxTotalInputOutputValues: getTxTotalInputOutputValues,
	rgbToHsl: rgbToHsl,
	colorHexToRgb: colorHexToRgb,
	colorHexToHsl: colorHexToHsl,
	logError: logError,
	buildQrCodeUrls: buildQrCodeUrls,
	ellipsize: ellipsize,
	getStatsSummary: getStatsSummary,
	clearIpList: clearIpList,
	getDifficultyData: getDifficultyData
};
