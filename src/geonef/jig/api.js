define([
         "dojo/_base/lang",
         "dojo/_base/window",
         "dojo/_base/xhr",
         "dojo/json",
         "dojo",
         "dojox/uuid/generateRandomUuid",
         "./_base",
         "./workspace",
         "./util",
         "./Deferred",
], function(lang, window, xhr, json, dojo, generateRandomUuid,
            jig, workspace, util, Deferred) {

var self = {
  //
  // todo:
  //    implement caching based in scalar params
  //

  windowId: generateRandomUuid(),

  /**
   * @type {string} Default URL, if not given in params
   */
  url: '/api',

  /**
   * @type {Object} Common parameters which are added automatically to every request
   */
  requestCommonParams: {},

  /**
   * @type {string} Name of topic to publish events to. First arg is a boolean telling whether an XHR is active
   */
  noticeTopic: 'jig/api/request',

  /**
   * Whether to show exceptions to the user
   *
   * @type {boolean}
   */
  showExceptions: false,

  /**
   * Number of seconds between pings, when no API request is made during that time
   */
  pingDelay: 300,

  /**
   * Delay in milliseconds of extra-time to wait before sending the XHR
   *
   * (used for debugging)
   */
  debugDelay: 0,

  /**
   * @type {Object} Parallel requests deferred to later execution
   */
  _deferredRequests: {},

  /**
   * @type {geonef.jig.Deferred} Global XHR promise for pending XHR call
   */
  _deferred: null,

  /**
   * Make API request
   *
   *    Custom params are:
   *            - defer: boolean
   *                    if true, the request is remembered, and is executed
   *                    the next time a request is made with a falsy defer.
   *
   * @param {?Object} object for parameters to pass to dojo XHR.
   * @return {dojo.Deferred} promise, ensured to be geoenf.jig.Deferred if request.callback is set
   */
  request: function(request, options) {
    self.cancelPing();
    options = options || {};
    request.windowId = self.windowId;
    var uuid = generateRandomUuid();
    request.promise = new Deferred();
    var ret = request.promise;
    if (options) {
      request.__options = options;
    }
    self._deferredRequests[uuid] = request;
    if (!self._timeout) {
      self._deferred = new Deferred();
      self._timeout = window.global.setTimeout(
          function() {
            // execute all deferred requests
            self._timeout = null;
            var reqs = lang.mixin({}, self._deferredRequests);
            self._deferredRequests = {};
            self._deferred.dependsOn(self._doRequest(reqs, options));
            self._deferred.callback();
          }, self.debugDelay);
    }
    if (request.callback) {
      // backward compat ; api.request({}).then() preferred
      ret = new Deferred();
      request.promise
        .then(lang.hitch(request.scope || window, request.callback))
        .then(function() { ret.callback(); });
    }
    delete request.scope;
    delete request.callback;

    return ret;
  },

  /**
   * Execute XHR for all deferred requests
   *
   * @return {dojo.Deferred} from XHR call
   */
  _doRequest: function(request, options) {

    /**
     * Process single-request response
     */
    var _processResponseReq =
      function(request, response, xhr) {
        var options = request.__options || {};
	if (response.status === 'error') {
	  console.error('error status from API', response);
	}
	if (response.status === 'exception' && !options.ignoreException) {
	  console.error('Server API exception', response);
          self.processException(request, response);
	}
        try {
          request.promise.resolve(response);
        } catch (error) {
          console.error("exception in API request callback", request, response);
        }
      };

    /**
     * Process XHR (transport) response
     */
    var _processResponse = function(text, xhr) {
      //console.log('JiG API Response', xhr, text);
      dojo.publish('noticeTopic', [ false ]);
      var ret = 0, data = null;
      try {
	data = json.parse(text);
      }
      catch (e) {
	console.error('JiG  API response: invalid JSON string: ',
	              text, xhr);
	if (typeof request.transportError == 'function') {
	  request.transportError(text, xhr);
	}
	return;
      }
      // check if one req or many in the structure
      if (typeof request.callback == 'function') {
	_processResponseReq(request, data, xhr);
      } else {
	for (var i in data) {
          if (data.hasOwnProperty(i)) {
	    _processResponseReq(request[i], data[i], xhr);
	  }
        }
      }
      self.delayPing();
    };

    /**
     * Process XHR (transport) failure
     */
    var _processError = function(error, xhr) {
      dojo.publish('noticeTopic', [ false ]);
      console.error('JiG API Error: ', error, xhr);
    };

    /**
     * Make single request structure out of single request params
     *
     * @param {Object} origRequest
     * @return {Object} the structure ready to be serialized
     */
    var _prepareRequest = function(origRequest) {
      var ret = lang.mixin({}, origRequest, self.requestCommonParams);
      delete ret.promise;
      delete ret.__options;
      return ret;
    };

    var requestToSend;
    if (request.module) {
      requestToSend = _prepareRequest(request);
    } else {
      requestToSend = {};
      for (var i in request) {
        if (request.hasOwnProperty(i)) {
          requestToSend[i] = _prepareRequest(request[i]);
        }
      }
    }
    dojo.publish('noticeTopic', [ true ]);
    return xhr.post(lang.mixin(
                      {
                        url: options.url || self.url,
                        handleAs: 'text', //'json',
                        postData: json.stringify(requestToSend),
                        load: _processResponse,
                        error: _processError
                      }, options), true);
  },

  processException: function(request, response) {
    if (self.showExceptions) {
      var Class = util.getClass('geonef.jig.tool.dev.ExceptionDump');
      var dump = new Class(
        lang.mixin({ context: { request: request, response: response }},
                   response.exception));
      workspace.autoAnchorWidget(dump);
      dump.startup();
    } else {
      window.global.alert("Une erreur est survenue durant la requête serveur.\n"
                   + "Elle a été enregistrée en vue d'une correction prochaine.");
    }
    // console.log('started exception', this, arguments);
  },

  /**
   * Send a dumb API request to preserve the session (timed-out)
   *
   * Called after an effective API request has been sent.
   * The timeout cleared before an API request is sent.
   */
  delayPing: function() {
    var delay = self.pingDelay * 1000;
    self._pingTO = window.global.setTimeout(self.doPing, delay);
  },

  cancelPing: function() {
    if (self._pingTO) {
      window.global.clearTimeout(self._pingTO);
      delete self._pingTO;
    }
  },

  doPing: function() {
    self.request({ module: 'user', action: 'ping' } );
  },

};

return self;

});
