!
function() {
    "use strict";
    function n(n) {
        var e = new RegExp("(^|&)" + n + "=([^&]*)(&|$)"),
        i = window.location.search.substr(1).match(e);
        return null != i ? unescape(i[2]) : null
    }
    var e = null,
    i = null,
    t = 20,
    a = ["openScheme", "closeBrowser", "setTitle", "setShareContent", "alert", "setBackHandler", "showShareWindow"],
    o = function(n) {
        return {
            timeout: null,
            running: !1,
            tasks: [],
            push: function(n, e) {
                var i = e ||
                function(n) {};
                u.tasks.push({
                    data: n,
                    callback: i
                }),
                setTimeout(function() {
                    u.process()
                },
                0)
            },
            dequeue: function() {
                i && i()
            },
            process: function() {
                if (u.tasks.length && !u.running) {
                    var t = u.tasks.shift();
                    u.running = !0,
                    i = function() {
                        u.running = !1,
                        t.callback(t.data),
                        u.process()
                    },
                    e = t.data,
                    n(t.data, i)
                }
            }
        }
    },
    u = o(function(n) {
        c._doSendMessage(n.method, n.args, n.callback, n.handle)
    }),
    l = 1,
    s = t,
    c = {
        _callbacks: {},
        _dequeueTimeout: null,
        isSupport: function(e) {
            var i = n("platform"),
            t = n("build");
            return - 1 === a.indexOf(e) ? !1 : "ios" == i && 2020 > t ? !1 : "android" == i && 408010 > t ? !1 : !0
        },
        dequeue: function() {
            var n = this;
            setTimeout(function() {
                clearTimeout(n._dequeueTimeout),
                n._dequeueTimeout = null,
                u.dequeue()
            },
            0)
        },
        ready: function(n) {
            var e = this;
            window.biliapp ? n && n() : setTimeout(function() {
                return s--,
                0 === s ? void(n && n()) : void e.ready(n)
            },
            100)
        },
        _sendMessage: function(n, e) {
            var i = this;
            u.push({
                method: n,
                args: e,
                callback: e ? e.success: null,
                handle: e ? e.handle: null
            }),
            this._dequeueTimeout = setTimeout(function() {
                i.dequeue()
            },
            1e3)
        },
        _doSendMessage: function(n, e, i, t) {
            if (window.biliapp) {
                if (!e) return void(window.biliapp[n] && window.biliapp[n]());
                if ("object" != typeof e) return void(window.biliapp[n] && window.biliapp[n](e));
                var a = i && "function" == typeof i,
                o = t && "function" == typeof t,
                u = a ? l++:0;
                a && (this._callbacks[u] = i, e.callbackId = u),
                o && (this._callbacks[u] = t, e.handle = u),
                window.biliapp[n] && window.biliapp[n](JSON.stringify(e))
            } else this._mock(n, e)
        },
        _mock: function(n, e) {
            "alert" == n ? alert(e.message) : "openScheme" == n && window.open(e.url, "_blank")
        },
        callback: function(n) {
            return function(e, i) {
                if (e && this._callbacks.hasOwnProperty(e)) {
                    var t = this._callbacks[e];
                    t && t.call(this, i),
                    this._callbacks[e] = null,
                    delete this._callbacks[e]
                } else "function" == typeof n && n.apply(window._biliapp, arguments)
            }
        } (window._biliapp && window._biliapp.callback)
    };
    return a.forEach(function(n) {
        c[n] || (c[n] = function(e) {
            c._sendMessage(n, e)
        })
    }),
    window._biliapp = c,
    window.BiliApp = c,
    c
} ();