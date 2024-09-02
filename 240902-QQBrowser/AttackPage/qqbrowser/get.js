/*
    core.ios.js
    v1.0
    create bridge for qq browser
    client environment can only be iOS
    date:2014-08-13
*/

; !function (window, ns, bridge) {

    "use strict";

    var exports = window[ns] = window[ns] || {};

    // 此方法用于创建 qb_channel
    !function () {
        var QbChannel = function (type) {
            this.type = type;
            this.handlers = {};
            this.numHandlers = 0;
            this.onHasSubscribersChange = null;
        };

        QbChannel.prototype.subscribe = function (f) {
            var func = f,
                guid = f.observer_guid;

            if (!guid) {
                // first time any channel has seen this subscriber
                guid = '' + window.qb_channel.nextGuid++;
            }
            func.observer_guid = guid;
            f.observer_guid = guid;

            // Don't add the same handler more than once.
            if (!this.handlers[guid]) {
                this.handlers[guid] = func;
                this.numHandlers++;
                if (this.numHandlers == 1) {
                    this.onHasSubscribersChange && this.onHasSubscribersChange();
                }
            }
        };

        /**
         * Unsubscribes the function with the given guid from the channel.
         */
        QbChannel.prototype.unsubscribe = function (f) {
            var guid = f.observer_guid,
                handler = this.handlers[guid];
            if (handler) {
                delete this.handlers[guid];
                this.numHandlers--;
                if (this.numHandlers === 0) {
                    this.onHasSubscribersChange && this.onHasSubscribersChange();
                }
            }
        };

        /**
         * Calls all functions subscribed to this channel.
         */
        QbChannel.prototype.fire = function (e) {
            if (this.numHandlers) {
                // Copy the values first so that it is safe to modify it from within
                // callbacks.
                var toCall = [];
                for (var item in this.handlers) {
                    toCall.push(this.handlers[item]);
                }
                for (var i = 0; i < toCall.length; ++i) {
                    toCall[i](e);
                }
            }
        };

        var loaded = !!(window.qb_channel && typeof (window.qb_channel.create) === 'function');
        window.qb_channel = loaded ? window.qb_channel : {
            create: function (type) {
                return window.qb_channel[type] = new QbChannel(type);
            },
            nextGuid: 0
        };
    }();

    // 创建命名空间
    var createNamespace = function (name) {
        var arr = name.split('.'),
            space = window;
        arr.forEach(function (a) {
            !space[a] && (space[a] = {});
            space = space[a];
        });
        return space;
    };

    //实现bridge的内容
    if (typeof bridge === 'function') {
        bridge();
    }

    //用来对API进行定义
    exports.define = function (name, fn) {
        var index = name.lastIndexOf('.'),
            ns = createNamespace(name.substring(0, index));
        ns[name.substring(index + 1)] = fn;
    };

}(window, 'browser', function () {
    if (window.x5 == undefined || window.x5.callbacks == undefined) {
        var x5 = {
        commandQueue: [],
        commandQueueFlushing: false,
        resources: {
            base: !0
        }
    };

    x5.callbackId = 0;
    x5.callbacks = {};
    x5.callbackStatus = {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
        ILLEGAL_ACCESS_EXCEPTION: 3,
        INSTANTIATION_EXCEPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,
        IO_EXCEPTION: 6,
        INVALID_ACTION: 7,
        JSON_EXCEPTION: 8,
        ERROR: 9
    };

    x5.createBridge = function () {
        var iframe = document.createElement("iframe");
        iframe.style.cssText = 'display:none;width:0px;height:0px;';
        (document.body || document.documentElement).appendChild(iframe);
        return iframe;
    };

    x5.exec = function (successCallback, errorCallback, service, action, options) {
        var callbackId = null;
        var command = {
            className: service,
            methodName: action,
            options: {},
            arguments: []
        };

        if (successCallback || errorCallback) {
            callbackId = service + x5.callbackId++;
            x5.callbacks[callbackId] = {
                success: successCallback,
                fail: errorCallback
            };
        }

        if (callbackId != null) {
            command.arguments.push(callbackId);
        }

        for (var i = 0; i < options.length; ++i) {
            var arg = options[i];

            if (arg == undefined || arg == null) {
                continue;
            } else if (typeof (arg) == 'object') {
                command.options = arg;
            } else {
                command.arguments.push(arg);
            }
        }

        x5.commandQueue.push(JSON.stringify(command));
        if (x5.commandQueue.length == 1 && !x5.commandQueueFlushing) {
            if (!x5.bridge) {
                x5.bridge = x5.createBridge();
            }
            x5.bridge.src = "mtt:" + service + ":" + action;
        }
    };

    // 浏览器调用接口
    x5.getAndClearQueuedCommands = function () {
        var json = JSON.stringify(x5.commandQueue);
        x5.commandQueue = [];
        return json;
    };

    // 浏览器执行成功的回调函数
    x5.callbackSuccess = function (callbackId, args) {
        if (x5.callbacks[callbackId]) {
            if (args.status === x5.callbackStatus.OK) {
                try {
                    if (x5.callbacks[callbackId].success) {
                        x5.callbacks[callbackId].success(args.message);
                    }
                } catch (e) {
                    console.log("Error in success callback: " + callbackId + " = " + e);
                }
            }
            if (!args.keepCallback) {
                delete x5.callbacks[callbackId];
            }
        }
    };

    // 浏览器执行失败的回调函数
    x5.callbackError = function (callbackId, args) {
        if (x5.callbacks[callbackId]) {
            try {
                if (x5.callbacks[callbackId].fail) {
                    x5.callbacks[callbackId].fail(args.message);
                }
            } catch (e) {
                console.log("Error in error callback: " + callbackId + " = " + e);
            }
            if (!args.keepCallback) {
                delete x5.callbacks[callbackId];
            }
        }
    };

    x5.createEvent = function (type, data) {
        var event = document.createEvent('Events');
        event.initEvent(type, false, false);
        if (data) {
            for (var i in data) {
                if (data.hasOwnProperty(i)) {
                    event[i] = data[i];
                }
            }
        }
        return event;
    };

    x5.fireEvent = function (type, params) {
        var channel = window.qb_channel[type];
        if (channel) {
            var data = params && JSON.parse(params);
            var evt = x5.createEvent(type, data);
            channel.fire(evt);
        };
    };

    window.T5Kit = window.x5 = x5;
}
});browser.define("browser.login.getAccountInfo", function(succCallback, errCallback, options) {
  x5.exec(succCallback, errCallback, "login", "getAccountInfo", options ? [options] : []);
});browser.define("browser.login.showLoginPanel", function (succCallback, errCallback, options) {
	x5.exec(succCallback, errCallback, "login", "showLoginPanel", options ? [options] : []);
});browser.define("browser.login.changeLoginPanel", function(succCallback, options){
	x5.exec(succCallback, null, "login", "changeLoginPanel", options ? [options] : []);
});

browser.define("browser.login.refreshToken", function(options, callback){
	x5.exec(callback, callback, 'login', 'refreshToken',[options]);
});browser.define("browser.app.installApp", function(succCallback, errCallback, options){
	x5.exec(succCallback,errCallback,"app","installApp",[options]);
});browser.define("browser.app.isInstallApk", function(callback,options){
  x5.exec(function(data){ 
      if(data.resCode){
          callback && callback(true);
      } else {
          callback && callback(false);
      }
  },function(){},"app","isInstallApk",[options]);
});browser.define("browser.app.checkInstalledApp", function(succCallback, errCallback, options) {
  x5.exec(function(params) { // {"value": false(uninstalled) | true(installed)}
    succCallback && succCallback(params.value);
  }, errCallback || function(err) {}, "app", "checkInstalledApp", [options]);
});browser.define("browser.app.getInstalledApps", function(succCallback, errCallback){
	x5.exec(succCallback,errCallback,"app","getInstalledApps",[]);
});browser.define("browser.app.getAppInfo", function(succCallback, errCallback){
	x5.exec(succCallback, errCallback,"app","getAppInfo",[]);
});browser.define("browser.app.openUrl",  function(succCallback, errCallback,options){
	x5.exec(succCallback, errCallback, "app","openUrl",[options]);
});browser.define("browser.app.getMobileAppSupport", function(succCallback, errCallback,options){
	 x5.exec(succCallback, errCallback,"app","getMobileAppSupport",[options]);
});browser.define("browser.app.toast", function(text,duration){
	x5.exec(function () { }, function () { }, "app", "toast", [{ text: text, duration: duration }]);
});browser.define("browser.app.getCryptext", function(succCallback,errCallback,options){
	x5.exec(succCallback,errCallback,"app","getCryptext",[options]);
});browser.define("browser.app.getQua", function(succ, fail){
	x5.exec(succ, fail, "app", "qua", []);
});browser.define("browser.app.loadLiteApp", function(succCallback,errCallback,options){
	x5.exec(succCallback,errCallback,"app","loadLiteApp",[options]);
});browser.define("browser.app.installApk", function(options){
  x5.exec(function(){},function(){},"app","installApk",[options]);
});browser.define("browser.app.getWindowNumber", function(callback){
  x5.exec(callback,function(){},"app","getWindowNumber",[]);
});browser.define("browser.app.doTokenFeature", function(callback, options){
  x5.exec(callback, function(){}, 'app', 'doTokenFeature', [options]);
});browser.define("browser.app.subscribeFreeFlow", function(succCallback, errCallback){
	x5.exec(succCallback, errCallback, "app", "subscribeFreeFlow", []);
});browser.define("browser.app.turnToSysPush", function(){
	x5.exec(null, null, "app","turnToSysPush",[]);  
});browser.define("browser.app.setFreeFlowStatus", function(options, succCallback, errCallback){
	x5.exec(succCallback, errCallback, "app", "setFreeFlowStatus", [options]);
});browser.define("browser.app.preLoadSearchResultPage", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback || function(){}, "app","preLoadSearchResultPage",[options]);
});browser.define("browser.app.openUrlInWechat", function(options, cbSucc,cbFaild){
	x5.exec(cbSucc, cbFaild, "app", "openUrlInWechat", [options]);
});browser.define("browser.app.getInstallTime", function(succCallback){
    x5.exec(succCallback, null, "app", "getInstallTime", []);
});browser.define("browser.app.openPhotoBrowser", function(urls, index, style){
	x5.exec(function () {}, function () {}, "app", "openPhotoBrowser", [{urls: urls, index: index, style: style}]);
});browser.define("browser.app.openInMainBrowseWindow", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback, 'usercenter', 'openInMainBrowseWindow', [options])
});browser.define("browser.app.showAlertDialog", function(succCallback, options){
   x5.exec(succCallback, null,"app","showAlertDialog", options ? [options] : []);
});browser.define("browser.app.openImageReaderWithDelete", function(urls, index, httpRefer, succFun){
	/*请在这里输入API的实现代码*/
  x5mtt.openImageReaderWithDelete(urls, index, httpRefer, succFun);
});browser.define("browser.app.getAdvertisingID", function(succCallback){
    x5.exec(succCallback, null,"app","getAdvertisingID",[]);
});browser.define("browser.app.getAppShowType", function(succCallback, errCallback){
	x5.exec(succCallback, errCallback,"app","getAppShowType",[]);
});browser.define("browser.app.openByApk", function(options){
  x5.exec(function(){},function(){},"app","openByApk",[options]);
});browser.define("browser.app.loadAppUrl", function(succCallback, errCallback,options){
  x5.exec(succCallback, errCallback, "app","loadAppUrl",[options]);
});browser.define("browser.app.checkKingCardInfo", function(succCallback){
	x5.exec(succCallback, succCallback,"app","checkKingCardInfo",[]);
});browser.define("browser.app.getFreeFlowStatus", function(succCallback, errCallback){
	x5.exec(succCallback, errCallback, "app", "getFreeFlowStatus", []);
});browser.define("browser.app.share", function(options,callback){
    callback = callback || function(){};
    if (typeof options === 'object') {
      if (options.title && options.description && options.img_url) {
        options.content_type = 1;
      } else {
        options.content_type = 0;
      }
    }
    x5.exec(callback, function(){},"app","share",[options]);
});browser.define("browser.app.startpage", function(succCallback,errcallback){
  x5.exec(succCallback,errcallback,"app","startpage",[]);
});browser.define("browser.app.sendAppToDesktop", function(succCallback,errCallback,options){
	x5.exec(succCallback,errCallback,"app","sendAppToDesktop",[options]);
});browser.define("browser.app.getBrowserSignature", function(succCallback, errCallback,options){
	x5.exec(succCallback, errCallback,"app","getBrowserSignature",[options]);
});browser.define("browser.app.unInstallApp", function(succCallback, errCallback,options){
	x5.exec(succCallback,errCallback,"app","unInstallApp",[options]);
});browser.define("browser.app.getApnType", function(callback){
  x5.exec(callback,function(){},"app","getApnType",[]);
});browser.define("browser.app.historyBack", function() {
  x5.exec(function() {}, function() {}, "app", "historyBack", []);
});browser.define("browser.app.multiWindow", function(succCallback,errCallback){
	x5.exec(succCallback,errCallback,"app","multiWindow",[]);
});browser.define("browser.app.getQua2", function(succ, fail){
	x5.exec(succ, fail, "app", "qua2", []);
});browser.define("browser.app.getOverScrollState", function(succCallback){
	x5.exec(succCallback, succCallback,"app","getOverScrollState",[]);
});browser.define("browser.app.setShareInfo", function (options, callback/*参数列表*/) {
  if (window.originalPostMessage) { // RN
    try {
      window.postMessage(JSON.stringify({
        func: 'app.setShareInfo',
        data: options,
      }));
    } catch (e) { console.error(e); }
  }
  var _toString = Object.prototype.toString,
    _cb = _toString.call(callback) === '[object Function]' ? callback : function () { },
    _opt = options;

  if (_toString.call(_opt) !== '[object Object]') {
    _cb({ code: 1, msg: 'options 参数错误，必须为Object' });
  }
  else if (_toString.call(_opt.title) !== '[object String]') {
    _cb({ code: 2, msg: 'options.title 参数错误，必须为String' });
  }
  else {
    if (_toString.call(window.browser.execWebFn) !== '[object Object]') {
      Object.defineProperty(window.browser, 'execWebFn', { value: {} });
    }

    _opt['content_type'] = 1;
    window.browser.execWebFn.shareInfoOptions = _opt;

    if (_toString.call(window.browser.execWebFn.customQbMenuShareInfo) !== '[object Function]') {
      Object.defineProperty(window.browser.execWebFn, 'customQbMenuShareInfo', {
        value: function (options/*终端传递过来的参数对象*/) {
          return JSON.stringify(window.browser.execWebFn.shareInfoOptions);
        }
      });
    }

    _cb({ code: 0, msg: '设置成功' });
  }
});
browser.define("browser.app.openInNewWindow", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback, 'usercenter', 'openInNewWindow', [options])
});browser.define("browser.app.setCurrentWindowTitle", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback, 'usercenter', 'setCurrentWindowTitle', [options])
});browser.define("browser.app.getAppVersion", function(callback){
	x5.exec(callback, null, "app", "appVersion", []);
});browser.define("browser.app.getBrowserParam", function(succCallback,errCallback){
  x5.exec(function( res ){
  	var no_error = true, info = null;
   try {
     info = JSON.parse( res ); 
   }
   catch( e ) {
     no_error = false;
     errCallback && errCallback({code: -1, message: e.message});
   }
   if( no_error ) {
     succCallback && succCallback( info );
   }
  }, function( e ) {
  	errCallback && errCallback({code: -2, message: e.message});
  },"app","getBrowserParam",[]);
});browser.define("browser.app.setOverScrollState", function(isOpen){
	x5.exec(function(){},function(){},"app","setOverScrollState",[{"isOpen":isOpen}]);
});browser.define("browser.app.setNightMode", function(callback, options){
  	x5.exec(callback, null, "app", "setNightMode", [options]);
});browser.define("browser.app.exitAdNovelMode", function(callback, options){
	x5.exec(callback, null, "app", "exitAdNovelMode", [options]);
});browser.define("browser.app.getFreeFlowInviteCode", function(succCallback, errCallback){
	x5.exec(succCallback, errCallback, "app", "getFreeFlowInviteCode", []);
});browser.define("browser.app.preloadApp", function(urls){
  x5.exec(function() {}, function() {}, "app", "preloadApp", [{urls:urls}]);
});browser.define("browser.app.openWXMiniProgram", function(options,callback){
  x5.exec(callback, function(){}, 'app', 'openWXMiniProgram', [options]);
});browser.define("browser.app.addCardToWechat", function(options, cbSucc, cbError){
	x5.exec(cbSucc, cbError,"app","addCardToWechat",[options]);
});
browser.define("browser.app.getGeoLocationWithAlert", function(succCallback, errCallback){
  x5.exec(succCallback, errCallback || function(){}, "app", "getGeoLocationWithAlert", []);
});browser.define("browser.app.addUrlToSecurityWhiteList",  function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback || function(){}, "app","addUrlToSecurityWhiteList",[options]);
});browser.define("browser.app.readSettings", function(callback,options){
	x5.exec(callback, callback, "app", "readSettings", [options]);
});browser.define("browser.app.removeSettings", function(options){
	return x5.exec(null, null, "app", "removeSettings", [options]);
});browser.define("browser.app.writeSettings", function(options){
	return x5.exec(null, null, "app", "writeSettings", [options]);
});browser.define("browser.app.downloadPremiumGame", function(options){
	x5.exec(null, null, "app", "downloadPremiumGame", [options]);
});browser.define("browser.app.isOnline", function(callback){
	x5.exec(callback, null, "app", "isOnline", []);
});browser.define("browser.app.enableNovelMode",  function(options){
	x5.exec(null, null, "app","enableNovelMode",[options]);
});browser.define("browser.app.newAndLiveReport", function(options){
	x5.exec(null, null, "app","newAndLiveReport", [options]);
});browser.define("browser.app.addHistory", function(callback,options){
	x5.exec(callback,function(){},"app","addHistory",[options]);
});browser.define("browser.app.sendPb", function(succCallback,errCallback,options){
	/*请在这里输入API的实现代码*/
  x5.exec(succCallback, errCallback,"app","sendPb",[options]);
});browser.define("browser.app.showPushGuide", function(callback, options){
   x5.exec(callback, null,"app","showPushGuide", [options]);
});browser.define("browser.app.setShareTokenSwitch", function(succCallback,options){
    x5.exec(succCallback, null,"app","setShareTokenSwitch",[options]);
});browser.define("browser.app.asyncGetSystemPushState", function(callback){
    x5.exec(callback, null,"app","asyncGetSystemPushState",[]);
});browser.define("browser.app.openAppKeyWithCallback", function(succCallback,options){
	x5.exec(succCallback, function(){}, "app", "openAppKeyWithCallback", [options]);
});browser.define("browser.app.showActionSheet", function(callback, actionCallback, options){
	x5.exec(callback, actionCallback, "app", "showActionSheet", [options]);
});browser.define("browser.app.calenderSubscribe", function(callback, errCallback, options){
  x5.exec(callback || function() {}, errCallback || function() {}, "app", "calenderSubscribe", [options]);
});browser.define("browser.app.getRecommendationSwitchStatus", function(succCallback, errCallback, options){
	x5.exec(succCallback,errCallback,"app","getRecommendationSwitchStatus",[options]);
});browser.define("browser.app.showPopMenu", function(callback,options){
  x5.exec(callback, null, "app", "showPopMenu", [options]);
});browser.define("browser.app.recordUnitTime", function(callback,options){
  x5.exec(callback, null, "app", "recordUnitTime", [options]);
});browser.define("browser.app.reportUserPrivacyEvent", function(options){
	x5.exec(null,null,"app","reportUserPrivacyEvent",options ? [options] : []);
});browser.define("browser.app.starTrailDecryptStr", function(options, callback){
	x5.exec(callback, null, "app", "starTrailDecryptStr", [options]);
});browser.define("browser.app.starTrailSignV1Str", function(options, callback){
	x5.exec(callback, null, "app", "starTrailSignV1Str", [options]);
});browser.define("browser.app.getAdaptAgedSwitchStatus", function(succCallback,options){
	x5.exec(succCallback,null,"app","getAdaptAgedSwitchStatus",[options]);
});browser.define("browser.app.isNovelMode",  function(succ, fail ){
	x5.exec(succ, fail, "app","isNovelMode",[]);
});browser.define("browser.app.getWUPEnvType", function(callback){
	x5.exec(callback, null,"app","getWUPEnvType",[]);
});browser.define("browser.app.preConnect", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback || function(){}, "app","preConnect",[options]);
});browser.define("browser.app.prefetchDNS", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback || function(){}, "app","prefetchDNS",[options]);
});browser.define("browser.app.showDialog", function(succCallback, options){
   x5.exec(succCallback, null,"app","showDialog", options ? [options] : []);
});browser.define("browser.app.getMsgComponentFrequency", function(succCallback, options){
   x5.exec(succCallback, null,"app","getMsgComponentFrequency", options ? [options] : []);
});browser.define("browser.app.setMsgComponentFrequency", function(succCallback, options){
   x5.exec(succCallback, null,"app","setMsgComponentFrequency", options ? [options] : []);
});browser.define("browser.app.showLinkToast", function(callback,options){
	x5.exec(callback, function(){}, "app", "showLinkToast", [options]);
});browser.define("browser.app.setCoolReadScrollStatus", function(options){
  x5.exec(null, null, "app", "setCoolReadScrollStatus", options ? [options] : []);
});
browser.define("browser.app.showHalfFloatingView", function(options){
	x5.exec(null,null,"app","showHalfFloatingView",[options]);
});browser.define("browser.app.getFeatureToggle", function(succCallback,options){
	x5.exec(succCallback, function(){}, "app", "getFeatureToggle", [options]);
});browser.define("browser.device.getModel",function(callback){
  x5.exec(callback, null, "device", "deviceModel", []);
});browser.define("browser.device.getVersion",function(callback){
  x5.exec(callback, null, "device", "deviceVersion", []);
});browser.define("browser.device.beep", function(times){
	x5.exec(function () { }, function () { }, 'device', 'beep', [{ times: times }]);
});browser.define("browser.device.vibrate", function(times){
	x5.exec(function () { }, function () { }, 'device', 'vibrate', [{ times: times }]);
});browser.define("browser.device.getQAID", function(callback){
	/*请在这里输入API的实现代码*/
    x5.exec(callback, null,"device","getQAID",[]);
});browser.define("browser.device.getMacAddress", function(callback){
	x5.exec(callback, null, "device", "getMacAddress", []);
});browser.define("browser.device.copy", function(strCopy,succCallback,errCallback){
    x5.exec(succCallback, errCallback,"device","copy",[{ 'strCopy': strCopy }]);
});browser.define("browser.device.checkPermission", function(succCallback, options){
	x5.exec(succCallback, null, 'device', 'checkPermission', [options])
});browser.define("browser.device.getQIMEI", function(succCallback){
  x5.exec(succCallback, null, "device", "getQIMEI", []);
});browser.define("browser.device.getWifiInfo", function(callback){
    x5.exec(callback, null,"device","getWifiInfo",[]);
});browser.define("browser.device.stopRecordAudio", function() {
  x5.exec(function() {}, function() {}, "device", "stopRecordAudio", []);
});
browser.define("browser.device.playAudio", function() {
  x5.exec(function() {}, function() {}, "device", "playAudio", []);
});
browser.define("browser.device.getstephistory", function(succCallback,options){
	/*请在这里输入API的实现代码*/
  x5.exec(succCallback, function() {},"device","getstephistory",[options]);
});browser.define("browser.device.getPlatform",function(callback){
  x5.exec(callback, null, "device", "devicePlatform", []);
});browser.define("browser.device.getstep", function(succCallback,errCallback){
  x5.exec(succCallback,errCallback, "device", "getstep", []);
});browser.define("browser.device.getIDFV", function(callback){
    x5.exec(callback, null,"device","getIDFV",[]);
});browser.define("browser.device.getWifiMac", function(callback){
	/*请在这里输入API的实现代码*/
  	x5.exec(callback, null, "device", "getWifiMac", []);
});browser.define("browser.device.requestPermission", function(succcb,options){
	x5.exec(succcb, null, "device", "requestPermission", [options]);
});browser.define("browser.device.startRecordAudio", function() {
  x5.exec(function() {}, function() {}, "device", "startRecordAudio", []);
});
browser.define("browser.device.uploadFile", function(succCallback, errCallback, options){
	x5.exec(succCallback, errCallback,"device","uploadFile",[options])
});browser.define("browser.device.getTuringTicket", function(succCallback, errCallback){
	/*请在这里输入API的实现代码*/
  x5.exec(succCallback, errCallback, "device", "getTuringTicket", []);
});browser.define("browser.device.requestLbsPermission", function(succCallback,options){
	x5.exec(succCallback, null, "device", "requestLbsPermission", [options]);
});
browser.define("browser.device.checkLbsPermission", function(succCallback, options){
	x5.exec(succCallback, null, 'device', 'checkLbsPermission', [options])
});browser.define("browser.connection.getType",function(callback){
  x5.exec(callback, null, "app", "connectionType", []);
});browser.define("browser.screen.lockOrientation",function(){
  x5.exec(function () { }, function () { }, "app", "lockOrientation", []);
});browser.define("browser.screen.getOrientation",function(callback){
  x5.exec(callback, null, "app", "orientation", []);
});browser.define("browser.screen.getNightmodeEnabled", function(callback){
	x5.exec(callback, null, "app", "nightmodeEnabled", []);
});browser.define("browser.screen.unlockOrientation",function(){
  x5.exec(function () { }, function () { }, "app", "unlockOrientation", []);
});browser.define("browser.screen.exitFullScreen", function(succCallback,errCallback){
	x5.exec(succCallback,errCallback, "app","exitFullScreen",[]);
});browser.define("browser.screen.requestFullScreen", function(succCallback,errCallback){
	x5.exec(succCallback, errCallback, "app","requestFullScreen",[]);
});browser.define("browser.screen.fullscreenEnabled", function(succCallback,errCallback){
	x5.exec(succCallback,errCallback,"app","fullscreenEnabled",[]);
});browser.define("browser.screen.capturePage", function(succCallback,errCallback,options){
        x5.exec(succCallback, errCallback,"screen","capturePage",[options]);
    });
browser.define("browser.ad.setAmsRewardVideoAD", function (succCallback, options) {
  x5.exec(succCallback, null, "ad", "setAmsRewardVideoAD", options ? [options] : []);
});browser.define("browser.ad.releaseAmsRewardVideoAD", function (succCallback, options) {
  x5.exec(succCallback, null, "ad", "releaseAmsRewardVideoAD", options ? [options] : []);
});browser.define("browser.ad.showAmsRewardVideoAD", function (succCallback, options) {
  x5.exec(succCallback, null, "ad", "showAmsRewardVideoAD", options ? [options] : []);
});browser.define("browser.ad.getADDeviceInfo", function (succCallback, options) {
  x5.exec(succCallback, null, "ad", "getADDeviceInfo", options ? [options] : []);
});browser.define("browser.ad.doClick", function(callback, options){
	/*请在这里输入API的实现代码*/
  x5.exec(callback, null, "ad","doClick", [options]);
}); browser.define("browser.ad.ztJumpAppstoreInner", function(options){
	x5.exec(null, null, "ad", "ztJumpAppstoreInner", [options]);
});browser.define("browser.ad.ztReportActionEvent", function(options){
	x5.exec(null, null, "ad", "ztReportActionEvent ", [options]);
});browser.define("browser.ad.ztReportClickEvent", function(options){
	x5.exec(null, null, "ad", "ztReportClickEvent ", [options]);
});browser.define("browser.ad.ztReportShowEvent", function (options) {
	x5.exec(null, null, "ad", "ztReportShowEvent ", [options]);
});browser.define("browser.ad.ztReportSDKInit", function(options){
	x5.exec(null, null, "ad", "ztReportSDKInit ", [options]);
});browser.define("browser.ad.openPureAd", function (options) {
  x5.exec(null, null, "ad", "openPureAd", options ? [options] : []);
});browser.define("browser.ad.ztReportExposureEvent", function(options){
	x5.exec(null, null, "ad", "ztReportExposureEvent", [options]);
});browser.define("browser.ad.ztOpenUrl", function(callback, options){
	x5.exec(callback, null, "ad", "ztOpenUrl", [options]);
});browser.define("browser.ad.ztReportShareEvent", function(options){
	x5.exec(null, null, "ad", "ztReportShareEvent", [options]);
});browser.define("browser.ad.ztReportSearchEvent", function(options){
	x5.exec(null, null, "ad", "ztReportSearchEvent", [options]);
});browser.define("browser.ad.ztReportOfferEvent", function(options){
	x5.exec(null, null, "ad", "ztReportOfferEvent", [options]);
});browser.define("browser.ad.generateExpInfo", function (succCallback, options) {
  x5.exec(succCallback, null, "ad", "generateExpInfo", options ? [options] : []);
});browser.define("browser.usercenter.reportDataToWelfareCenter", function(callback,options){
	x5.exec(callback, function(){}, 'usercenter', 'reportDataToWelfareCenter', [options]);
});browser.define("browser.qb.beacon", function(options){
  	x5.exec(null,null,"qb","beacon",options ? [options] : []);
});
browser.define("browser.usercenter.showWelfareRemind", function(callback,options){
	x5.exec(callback, function(){}, 'usercenter', 'showWelfareRemind', [options]);
});browser.define("browser.usercenter.hidePendant", function(callback,options){
	x5.exec(callback, function(){}, 'usercenter', 'hidePendant', [options]);
});browser.define("browser.usercenter.ifWelfareNewuserDlgCanShow", function(callback){
	x5.exec(callback, null, 'usercenter', 'ifWelfareNewuserDlgCanShow',[]);
});browser.define("browser.usercenter.isSogouUser", function (succCallback, options) {
	x5.exec(succCallback, null, "usercenter", "isSogouUser", options ? [options] : []);
});browser.define("browser.usercenter.hasSogouBookmark", function (succCallback, options) {
	x5.exec(succCallback, null, "usercenter", "hasSogouBookmark", options ? [options] : []);
});browser.define("browser.usercenter.onLifeCycleFinish", function(callback,options){
	x5.exec(callback, function(){}, 'usercenter', 'onLifeCycleFinish', [options]);
});browser.define("browser.usercenter.handleLifecycleDialog", function(callback,options){
	x5.exec(callback, function(){}, 'usercenter', 'handleLifecycleDialog', [options]);
});browser.define("browser.usercenter.bindOtherInviter", function(callback){
  	x5.exec(callback,null,"usercenter","bindOtherInviter",[]);
});browser.define("browser.welfare.sendVideoAds", function(options, successCallback){
	x5.exec(successCallback, null, 'welfare', 'sendVideoAds', [options])
});browser.define("browser.event.onloginUserSwitch", function(handler){
               var str = new Date().getTime();
               window[str] = handler;
               var channel = qb_channel['onloginUserSwitch'];
               if (!channel) {
               channel = qb_channel.create('onloginUserSwitch');
               channel.onHasSubscribersChange = function () {
               x5.exec(function () { }, function () { }, "event", "addEventListener", [{ numHandlers: this.numHandlers, handler: 'window[' + str + ']', type: "onloginUserSwitch" }]);
               }
               }
               channel.subscribe(handler);
               });browser.define("browser.env.height", 1334);browser.define("browser.env.osVersion", "14.4.2");browser.define("browser.env.coreName", "SYS");browser.define("browser.env.softType", "QB");browser.define("browser.env.subPlatForm", "IPH");browser.define("browser.env.version", 154);browser.define("browser.env.channel", 50001);browser.define("browser.env.machine", "iPhone101");browser.define("browser.env.coreVersion", "");browser.define("browser.env.build", "1545995");browser.define("browser.env.platForm", "I");browser.define("browser.env.qua2", "PR=QB&PP=com.tencent.mttlite&PPVN=15.4.5.5995&CO=SYS&QV=3&PL=IOS&CHID=50001&LCID=22185&RL=750*1334&MO=iPhone101&PB=GE&VE=GA&DE=PHONE&OS=14.4.2&TM=00&REF=qb_0");browser.define("browser.env.subVersion", "GA");browser.define("browser.env.width", 750);browser.define("browser.env.qua", "");browser.define("browser.file.saveImgToGallery", function(callback,imgData){
	callback = callback || function(){}; 
  	x5.exec(callback, function(){}, "file", "saveImgToGallery", [imgData]);	
});browser.define("browser.qb.addToShortcut", function (options, callback) {
  x5.exec(callback, null, "qb", "addToShortcut", [options]);
});browser.define("browser.qb.queryShortcutState", function (options, callback) {
  x5.exec(callback, null, "qb", "queryShortcutState", [options]);
});browser.define("browser.login.getSocialMediaTokenInfoOfPhone", function (succCallback, options) {
    x5.exec(succCallback, null, "login", "getSocialMediaTokenInfoOfPhone", options ? [options] : []);
});browser.define("browser.qb.applyTheme", function(callback,options){
	x5.exec(callback, function(){}, 'qb', 'applyTheme', [options]);
});