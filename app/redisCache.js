let redis = require("redis");
let bluebird = require("bluebird");

let config = require("./config.js");
let utils = require("./utils.js");

let redisClient = null;

const expirationKey = "-expire-time"
const pendingCallPostfix = "-pending"

if (config.redisUrl) {
	//bluebird.promisifyAll(redis.RedisClient.prototype);

	redisClient = redis.createClient({url:config.redisUrl});
	redisClient.connect().then(() => {
	}).catch(err => {
		utils.logError("328rhwefghsdgsdss", err, {})
	})
	redisClient.on("error", (err) => {
		console.error("redis encounter an error ", err);
	})
}

function onCacheEvent(cacheType, hitOrMiss, cacheKey) {
	//console.log(`cache.${cacheType}.${hitOrMiss}: ${cacheKey}`);
}

let redisCache = {
	get:function(key, maxAgeMillis, dataFunc) {
		let self = this;
		return new Promise(async (resolve, reject) => {
			try {
				let cacheValue = await redisClient.get(key);
				if(cacheValue) {
					try {
						cacheValue = JSON.parse(cacheValue)
					} catch (err) {

					}
				}
				let expirationTime = await redisClient.get(key + expirationKey);
				let isExpired = !expirationTime || Number(expirationTime) <= Date.now()
				//	console.log("%s is expired , %s, %s %O", key, isExpired, expirationTime, Date.now(), dataFunc);
				if(!isExpired) {
					if(cacheValue) {
						return resolve(cacheValue)
					}
				} else if(cacheValue) {
					if(dataFunc) {
						let pendingKey = key + pendingCallPostfix;
						let isPendingCall = await redisClient.get(pendingKey);
						if(!isPendingCall) {
							redisClient.set(pendingKey, "true")
							dataFunc().then(value => {
								self.set(key, value, maxAgeMillis);
								redisClient.del(pendingKey)
							}).catch(err => {
								console.error(err);
								redisClient.del(pendingKey)
							})
						}
					} else {
						redisClient.del(key);
					}
				}
				onCacheEvent("redis", "miss", key);
				resolve(cacheValue);
			} catch(err) {
				//utils.logError("328rhwefghsdgsdss", err);
				console.log(err);
				reject(err);
			}
			// redisClient.get(key).then(function(result) {
			// 	if (result == null) {
			// 		onCacheEvent("redis", "miss", key);
			//
			// 		resolve(null);
			//
			// 		return;
			// 	}
			//
			// 	onCacheEvent("redis", "hit", key);
			//
			// 	resolve(JSON.parse(result));
			//
			// }).catch(function(err) {
			// 	utils.logError("328rhwefghsdgsdss", err);
			//
			// 	reject(err);
			// });
		});
	},
	set:function(key, obj, maxAgeMillis) {
		if(obj) {
			let expirationTimeInMs = Date.now() + Number(maxAgeMillis);
			let expKey = key + expirationKey;
			redisClient.del(key);
			redisClient.del(expKey);
			redisClient.set(key, JSON.stringify(obj));
			//console.log("cache: %s=%s %s", key, obj, expirationTimeInMs);
			redisClient.set(expKey, expirationTimeInMs);

			let age = (maxAgeMillis / 1000) + 90;
			redisClient.expire(key, age);
			redisClient.expire(expKey, age)
		}
		// redisCache.set(key, JSON.stringify(obj), {
		// 	PX : maxAgeMillis,
		// 	NX : true
		// })
	}
};

module.exports = {
	active: (redisClient != null),
	get: redisCache.get,
	set: redisCache.set
}