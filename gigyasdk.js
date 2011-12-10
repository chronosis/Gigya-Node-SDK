/*globals require, module, Buffer */
"use strict";
/**
 * Shallow object merge
 *
 * @access  private
 * @param   Object  dest
 * @param   Object  from
 * @return  Object
 */
function merge(dest, from) {
    var target = {},
        props  = null;
    // First, copy all items from destination to new object
    props = Object.getOwnPropertyNames(dest);
    props.forEach(function (name) {
        var destination = Object.getOwnPropertyDescriptor(dest, name);
        Object.defineProperty(target, name, destination);
    });
    // Merge values with additional object
    props = Object.getOwnPropertyNames(from);
    props.forEach(function (name) {
        if (name in dest) {
            var destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(target, name, destination);
        }
    });
    // Clean return object
    return target;
}
/**
 * Creates a random nonce for signature
 *
 * @access  private
 * @param   Number  size
 * @return  String
 */
function createNonce(size) {
    var result = [],
        chars  = [
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ],
        char_pos = 0,
        nonce_chars_length = chars.length,
        i = 0;
    for (i = 0; i < size; i += 1) {
        result[i] = chars[Math.floor(Math.random() * nonce_chars_length)];
    }
    return result.join('');
}
/**
 * Creates an appropriate HTTP client connection and returns the request
 *
 * @access  private
 * @param   Object      options
 * @param   Boolean     secure
 * @return  http.request
 */
function createClient(options, secure) {
    var proto = null;
    if (secure === true) {
        options.port = 443;
        proto = require('https');
    } else {
        options.port = 80;
        proto = require('http');
    }
    return proto.request(options);
}
/**
 * Tweaks the URI encoding formula to what OAuth expects
 *
 * @access  private
 * @param   Mixed   value
 * @return  String
 */
function encode(value) {
    if (value === null || value === '') {
        return '';
    } else {
        value = encodeURIComponent(value);
        return value
            .replace(/\!/g, "%21")
            .replace(/\'/g, "%27")
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29")
            .replace(/\*/g, "%2A");
    }
}
/**
 * Creates a signature that Gigya is expecting for calls
 *
 * @access  private
 * @param   String  string  string to sign
 * @param   String  key     base64 encoded client secret key
 * @return  String
 */
function createSignature(string, key) {
    var crypto    = require('crypto'),
        salt      = new Buffer(key, 'base64').toString('binary'),
        signature = crypto.createHmac('sha1', salt).update(string).digest('base64');
    return signature;
}
/**
 * Creates an OAuth compatible signature based on request parameters
 *
 * @access  private
 * @param   Object  options
 * @param   String  key
 * @return  String
 */
function createRequestSignature(options, key) {
    var domain = [options.service, options.domain].join('.'),
        path   = '/' + [options.service, options.method].join('.'),
        proto  = 'http://',
        url    = null,
        base   = null,
        params = [];
    // Switch protocol
    if (options.ssl === true) {
        proto = 'https://';
    }
    // Sort and encode parameters
    Object.getOwnPropertyNames(options.params).forEach(function (name) {
        params.push(encode(name) + '=' + encode(options.params[name]));
    });
    params = params.sort().join('&');
    params = encode(params);
    // Put together the full URL and encode it again
    url = encode([proto, domain, path].join(''));
    // Compose the final string
    base = [options.reqMethod.toUpperCase(), url, params].join('&');
    // Return the final signature
    return createSignature(base, options.secret);
}
/**
 * Server side Gigya SDK for NodeJS
 *
 * @access  public      Configuration details, mainly API Key and Secret Token
 * @param   Object      options
 */
function GigyaSDK(config) {
    if (!(this instanceof GigyaSDK)) {
        return new GigyaSDK(config);
    }
    var self     = this,
        wrappers = {},
        services = {
            'socialize' : [
                'checkin', 'deleteAccount', 'delUserSettings', 'getAlbums',
                'getContacts', 'getFeed', 'getFriendsInfo', 'getPhotos',
                'getPlaces', 'getRawData', 'getSessionInfo', 'getUserInfo',
                'getUserSettings', 'logout', 'notifyLogin',
                'notifyRegistration', 'publishUserAction', 'removeConnection',
                'sendNotification', 'setStatus', 'setUID', 'setUserSettings',
                'shortenURL'
            ],
            'comments' : [
                'flagComment', 'getComments', 'getStreamInfo', 'getTopStreams',
                'postComment', 'setStreamInfo', 'vote'
            ],
            'gm' : [
                'getChallengeConfig', 'getChallengeStatus', 'getTopUsers',
                'notifyAction', 'redeemPoints', 'resetLevelStatus'
            ],
            'gcs' : [
                'deleteObjectData', 'deleteUserData', 'getobjectData',
                'getUserData', 'search', 'setObjectData', 'setUserData'
            ],
            'reports' : [
                'getSocializeStats'
            ]
        },
        defaults = {
            'apiKey'    : null,
            'secret'    : null,
            'domain'    : 'gigya.com',
            'service'   : 'socialize',
            'method'    : null,
            'reqMethod' : 'GET',
            'nonceSize' : 32,
            'ssl'       : false
        };
    this.options = merge(defaults, config);
    Object.getOwnPropertyNames(services).forEach(function (service) {
        wrappers[service] = {};
        services[service].forEach(function (method) {
            wrappers[service][method] = function (params, callback) {
                return self[service](method, params, callback);
            };
        });
    });
    this.services = wrappers;
}
/**
 * Only export the public facing Gigya class
 */
module.exports = GigyaSDK;
/**
 * Low level access to create and issue a Gigya request asynchronously
 *
 * @access  public
 * @param   Object      options
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.request = function (options, callback) {
    var qs        = require('querystring'),
        fs        = require('fs'),
        opts      = null,
        request   = null;
    // Mash together all of the options
    opts = merge(this.options, options);
    // Create parameter string
    opts.params        = options.params;
    opts.params.apiKey = opts.apiKey;
    opts.params.format = 'json';
    if (opts.ssl === true) {
        opts.params.secret = opts.secret;
    } else {
        opts.params.timestamp = Math.round((new Date()).getTime() / 1000);
        opts.params.nonce     = createNonce(opts.nonceSize);
        opts.params.sig       = createRequestSignature(opts);
    }
    opts.params = qs.stringify(opts.params);
    // Setup request parameters
    request = {
        'host'    : [opts.service, opts.domain].join('.'),
        'path'    : '/' + [opts.service, opts.method].join('.'),
        'method'  : opts.reqMethod,
        'headers' : {
            'User-Agent' : 'Node-Gigya-SDK'
        }
    };
    // Add appropriate headers in case of POST requests
    if (opts.reqMethod === 'POST') {
        request.headers['Content-Type']   = 'application/x-www-form-urlencoded';
        request.headers['Content-Length'] = opts.params.length;
    } else {
        request.path += '?' + opts.params;
    }
    // Perform raw request
    return this.raw(request, opts, callback);
};
/**
 * Handles the grunt work of creating a connection and issuing a request
 *
 * @access  public
 * @param   Object      request
 * @param   Object      options
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.raw = function (request, options, callback) {
    var client = null,
        chunks = [];
    // Create request
    client = createClient(request, options.ssl);
    client.on('response', function (response) {
        response.setEncoding('utf8');
        // Collect chunks
        response.on('data', function (chunk) {
            chunks.push(chunk);
        });
        // Mash all chunks together and issue the callback
        response.on('end', function () {
            var result = JSON.parse(chunks.join(''));
            if (result.errorCode) {
                callback(result);
            } else {
                callback(null, result);
            }
        });
    });
    // Request level errors
    client.on('error', function (error) {
        return callback(error);
    });
    // We need to write the POST parameters to the request stream
    if (options.reqMethod.toUpperCase() === 'POST') {
        client.write(options.params);
    }
    client.end();
};
/**
 * Validates the user information signature
 *
 * @access  public
 * @param   String  UID
 * @param   String  timestamp
 * @param   String  signature
 * @return  Boolean
 */
GigyaSDK.prototype.validateUserSignature = function (UID, timestamp, signature) {
    var base     = [timestamp, UID].join('_'),
        expected = createSignature(base, this.options.secret);
    return expected === signature;
};
/**
 * Validates the user's friend information signature
 *
 * @access  public
 * @param   String  UID
 * @param   String  timestamp
 * @param   String  friendUID
 * @param   String  signature
 * @return  Boolean
 */
GigyaSDK.prototype.validateFriendSignature = function (UID, timestamp, friendUID, signature) {
    var base     = [timestamp, friendUID, UID].join('_'),
        expected = createSignature(base, this.options.secret);
    return expected === signature;
};
/**
 * Asynchronous caller for Socialize services
 *
 * @access  public
 * @param   String      method
 * @param   Object      params
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.socialize = function (method, params, callback) {
    return this.request({
        'service' : 'socialize',
        'method'  : method,
        'params'  : params
    }, callback);
};
/**
 * Asynchronous caller for Comment services
 *
 * @access  public
 * @param   String      method
 * @param   Object      params
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.comments = function (method, params, callback) {
    return this.request({
        'service' : 'comments',
        'method'  : method,
        'params'  : params
    }, callback);
};
/**
 * Asynchronous caller for Game Mechanic services
 *
 * @access  public
 * @param   String      method
 * @param   Object      params
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.gm = function (method, params, callback) {
    return this.request({
        'service' : 'gm',
        'method'  : method,
        'params'  : params
    }, callback);
};
/**
 * Asynchronous caller for Cloud Storage services
 *
 * @access  public
 * @param   String      method
 * @param   Object      params
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.gcs = function (method, params, callback) {
    return this.request({
        'service' : 'gcs',
        'method'  : method,
        'params'  : params
    }, callback);
};
/**
 * Asynchronous caller for Reports services
 *
 * @access  public
 * @param   String      method
 * @param   Object      params
 * @param   Function    callback
 * @return  void
 */
GigyaSDK.prototype.reports = function (method, params, callback) {
    return this.request({
        'service' : 'reports',
        'method'  : method,
        'params'  : params
    }, callback);
};