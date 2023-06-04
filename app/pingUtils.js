let redisCache = require("./redisCache.js");
let Cache = require("./cache.js");
const isPortReachable = require("is-port-reachable");
const schedule = require("node-schedule");
const config = require("./config");
const request = require("request");
const debug = require("debug");
let debugLog = debug("btcexp:utils");
let reachableCache = new Cache(process.env.MAX_REACHABLE_CACHE ? process.env.MAX_REACHABLE_CACHE : 5000);
let ipList = {}
let ipMemoryCache = {};
let ipCache = {
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
            console.error(err);

            reject(err);
        });
    });
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
    geoLocateIpAddresses: geoLocateIpAddresses,
    clearIpList: clearIpList
}