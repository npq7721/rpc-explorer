const debug = require("debug");
const debugLog = debug("btcexp:core");
const LRU = require("lru-cache");
const config = require("./config.js");
const redisCache = require("./redisCache.js");
//var utils = require("./utils.js");
class Cache {
  constructor(maxCacheAmount) {
    if (config.noInmemoryRpcCache) {
      this.cacheObj = null;
    } else if(redisCache.active) {
      this.cacheObj = redisCache;
    } else {
      this.cacheObj = new LRU({max : Number(maxCacheAmount) });
    }
  }

  tryCache(cacheKey, cacheMaxAge, dataFunc, cacheConditionFunction = (obj) => {return true}) {
    /*if (cacheConditionFunction == null) {
      cacheConditionFunction = function(obj) {
        return true;
      };
    }*/
    var self = this;
    return new Promise(function(resolve, reject) {
      const finallyFunc = function() {
        dataFunc().then(function(result) {
          if (result != null && cacheConditionFunction(result)) {
          //  console.log("caching, key=%s,result=%O", cacheKey, result);
            self.set(cacheKey, result, cacheMaxAge);
          }
        //  console.log("null result ? %s----%O", cacheConditionFunction(result), result);
          resolve(result);

        }).catch(function(err) {
          reject(err);
        });
      };
      self.get(cacheKey).then(function(result) {
        if(!result) {
          finallyFunc();
        } else {
          //console.log("cache hit %s=%O", cacheKey, result);
          resolve(result);
        }
      }).catch(function(err) {
        console.log(err);
        //utils.logError("nds9fc2eg621tf3", err, {cacheKey:cacheKey});
        finallyFunc();
      });
    });
  }
  onCacheEvent(cacheType, hitOrMiss, cacheKey) {
  	//debugLog(`cache.${cacheType}.${hitOrMiss}: ${cacheKey}`);
  }

  LRUGet(key) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var val = self.cacheObj.get(key);

      if (val != null) {
        self.onCacheEvent("memory", "hit", key);

      } else {
        self.onCacheEvent("memory", "miss", key);
      }

      resolve(self.cacheObj.get(key));
    });
  }
  LRUSet(key, obj, maxAge) {
    this.cacheObj.set(key, obj, maxAge);
  }

  noopGet(key) {
    return new Promise(function(resolve, reject) {
      resolve(null);
    });
  }

  get(key) {
    if(this.cacheObj) {
      if(redisCache.active) {
        return redisCache.get(key);
      }
      return this.LRUGet(key);
    } else {
      return noopGet(key);
    }
  }

  set(key, obj, maxAge) {
    if(this.cacheObj) {
      this.cacheObj.set(key, obj, maxAge);
    }
  }
}

module.exports = Cache;
