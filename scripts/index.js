import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/@xterm/addon-serialize/lib/addon-serialize.js
var require_addon_serialize = __commonJS((exports, module) => {
  (function(e, t) {
    typeof exports == "object" && typeof module == "object" ? module.exports = t() : typeof define == "function" && define.amd ? define([], t) : typeof exports == "object" ? exports.SerializeAddon = t() : e.SerializeAddon = t();
  })(exports, () => (() => {
    var e = { 930: (e2, t2, s2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.ColorContrastCache = undefined;
      const r2 = s2(485);
      t2.ColorContrastCache = class {
        constructor() {
          this._color = new r2.TwoKeyMap, this._css = new r2.TwoKeyMap;
        }
        setCss(e3, t3, s3) {
          this._css.set(e3, t3, s3);
        }
        getCss(e3, t3) {
          return this._css.get(e3, t3);
        }
        setColor(e3, t3, s3) {
          this._color.set(e3, t3, s3);
        }
        getColor(e3, t3) {
          return this._color.get(e3, t3);
        }
        clear() {
          this._color.clear(), this._css.clear();
        }
      };
    }, 997: function(e2, t2, s2) {
      var r2 = this && this.__decorate || function(e3, t3, s3, r3) {
        var o2, i2 = arguments.length, n2 = i2 < 3 ? t3 : r3 === null ? r3 = Object.getOwnPropertyDescriptor(t3, s3) : r3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          n2 = Reflect.decorate(e3, t3, s3, r3);
        else
          for (var l2 = e3.length - 1;l2 >= 0; l2--)
            (o2 = e3[l2]) && (n2 = (i2 < 3 ? o2(n2) : i2 > 3 ? o2(t3, s3, n2) : o2(t3, s3)) || n2);
        return i2 > 3 && n2 && Object.defineProperty(t3, s3, n2), n2;
      }, o = this && this.__param || function(e3, t3) {
        return function(s3, r3) {
          t3(s3, r3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.ThemeService = t2.DEFAULT_ANSI_COLORS = undefined;
      const i = s2(930), n = s2(160), l = s2(345), a = s2(859), c = s2(97), h = n.css.toColor("#ffffff"), u = n.css.toColor("#000000"), _ = n.css.toColor("#ffffff"), d = n.css.toColor("#000000"), C = { css: "rgba(255, 255, 255, 0.3)", rgba: 4294967117 };
      t2.DEFAULT_ANSI_COLORS = Object.freeze((() => {
        const e3 = [n.css.toColor("#2e3436"), n.css.toColor("#cc0000"), n.css.toColor("#4e9a06"), n.css.toColor("#c4a000"), n.css.toColor("#3465a4"), n.css.toColor("#75507b"), n.css.toColor("#06989a"), n.css.toColor("#d3d7cf"), n.css.toColor("#555753"), n.css.toColor("#ef2929"), n.css.toColor("#8ae234"), n.css.toColor("#fce94f"), n.css.toColor("#729fcf"), n.css.toColor("#ad7fa8"), n.css.toColor("#34e2e2"), n.css.toColor("#eeeeec")], t3 = [0, 95, 135, 175, 215, 255];
        for (let s3 = 0;s3 < 216; s3++) {
          const r3 = t3[s3 / 36 % 6 | 0], o2 = t3[s3 / 6 % 6 | 0], i2 = t3[s3 % 6];
          e3.push({ css: n.channels.toCss(r3, o2, i2), rgba: n.channels.toRgba(r3, o2, i2) });
        }
        for (let t4 = 0;t4 < 24; t4++) {
          const s3 = 8 + 10 * t4;
          e3.push({ css: n.channels.toCss(s3, s3, s3), rgba: n.channels.toRgba(s3, s3, s3) });
        }
        return e3;
      })());
      let f = t2.ThemeService = class extends a.Disposable {
        get colors() {
          return this._colors;
        }
        constructor(e3) {
          super(), this._optionsService = e3, this._contrastCache = new i.ColorContrastCache, this._halfContrastCache = new i.ColorContrastCache, this._onChangeColors = this.register(new l.EventEmitter), this.onChangeColors = this._onChangeColors.event, this._colors = { foreground: h, background: u, cursor: _, cursorAccent: d, selectionForeground: undefined, selectionBackgroundTransparent: C, selectionBackgroundOpaque: n.color.blend(u, C), selectionInactiveBackgroundTransparent: C, selectionInactiveBackgroundOpaque: n.color.blend(u, C), ansi: t2.DEFAULT_ANSI_COLORS.slice(), contrastCache: this._contrastCache, halfContrastCache: this._halfContrastCache }, this._updateRestoreColors(), this._setTheme(this._optionsService.rawOptions.theme), this.register(this._optionsService.onSpecificOptionChange("minimumContrastRatio", () => this._contrastCache.clear())), this.register(this._optionsService.onSpecificOptionChange("theme", () => this._setTheme(this._optionsService.rawOptions.theme)));
        }
        _setTheme(e3 = {}) {
          const s3 = this._colors;
          if (s3.foreground = g(e3.foreground, h), s3.background = g(e3.background, u), s3.cursor = g(e3.cursor, _), s3.cursorAccent = g(e3.cursorAccent, d), s3.selectionBackgroundTransparent = g(e3.selectionBackground, C), s3.selectionBackgroundOpaque = n.color.blend(s3.background, s3.selectionBackgroundTransparent), s3.selectionInactiveBackgroundTransparent = g(e3.selectionInactiveBackground, s3.selectionBackgroundTransparent), s3.selectionInactiveBackgroundOpaque = n.color.blend(s3.background, s3.selectionInactiveBackgroundTransparent), s3.selectionForeground = e3.selectionForeground ? g(e3.selectionForeground, n.NULL_COLOR) : undefined, s3.selectionForeground === n.NULL_COLOR && (s3.selectionForeground = undefined), n.color.isOpaque(s3.selectionBackgroundTransparent)) {
            const e4 = 0.3;
            s3.selectionBackgroundTransparent = n.color.opacity(s3.selectionBackgroundTransparent, e4);
          }
          if (n.color.isOpaque(s3.selectionInactiveBackgroundTransparent)) {
            const e4 = 0.3;
            s3.selectionInactiveBackgroundTransparent = n.color.opacity(s3.selectionInactiveBackgroundTransparent, e4);
          }
          if (s3.ansi = t2.DEFAULT_ANSI_COLORS.slice(), s3.ansi[0] = g(e3.black, t2.DEFAULT_ANSI_COLORS[0]), s3.ansi[1] = g(e3.red, t2.DEFAULT_ANSI_COLORS[1]), s3.ansi[2] = g(e3.green, t2.DEFAULT_ANSI_COLORS[2]), s3.ansi[3] = g(e3.yellow, t2.DEFAULT_ANSI_COLORS[3]), s3.ansi[4] = g(e3.blue, t2.DEFAULT_ANSI_COLORS[4]), s3.ansi[5] = g(e3.magenta, t2.DEFAULT_ANSI_COLORS[5]), s3.ansi[6] = g(e3.cyan, t2.DEFAULT_ANSI_COLORS[6]), s3.ansi[7] = g(e3.white, t2.DEFAULT_ANSI_COLORS[7]), s3.ansi[8] = g(e3.brightBlack, t2.DEFAULT_ANSI_COLORS[8]), s3.ansi[9] = g(e3.brightRed, t2.DEFAULT_ANSI_COLORS[9]), s3.ansi[10] = g(e3.brightGreen, t2.DEFAULT_ANSI_COLORS[10]), s3.ansi[11] = g(e3.brightYellow, t2.DEFAULT_ANSI_COLORS[11]), s3.ansi[12] = g(e3.brightBlue, t2.DEFAULT_ANSI_COLORS[12]), s3.ansi[13] = g(e3.brightMagenta, t2.DEFAULT_ANSI_COLORS[13]), s3.ansi[14] = g(e3.brightCyan, t2.DEFAULT_ANSI_COLORS[14]), s3.ansi[15] = g(e3.brightWhite, t2.DEFAULT_ANSI_COLORS[15]), e3.extendedAnsi) {
            const r3 = Math.min(s3.ansi.length - 16, e3.extendedAnsi.length);
            for (let o2 = 0;o2 < r3; o2++)
              s3.ansi[o2 + 16] = g(e3.extendedAnsi[o2], t2.DEFAULT_ANSI_COLORS[o2 + 16]);
          }
          this._contrastCache.clear(), this._halfContrastCache.clear(), this._updateRestoreColors(), this._onChangeColors.fire(this.colors);
        }
        restoreColor(e3) {
          this._restoreColor(e3), this._onChangeColors.fire(this.colors);
        }
        _restoreColor(e3) {
          if (e3 !== undefined)
            switch (e3) {
              case 256:
                this._colors.foreground = this._restoreColors.foreground;
                break;
              case 257:
                this._colors.background = this._restoreColors.background;
                break;
              case 258:
                this._colors.cursor = this._restoreColors.cursor;
                break;
              default:
                this._colors.ansi[e3] = this._restoreColors.ansi[e3];
            }
          else
            for (let e4 = 0;e4 < this._restoreColors.ansi.length; ++e4)
              this._colors.ansi[e4] = this._restoreColors.ansi[e4];
        }
        modifyColors(e3) {
          e3(this._colors), this._onChangeColors.fire(this.colors);
        }
        _updateRestoreColors() {
          this._restoreColors = { foreground: this._colors.foreground, background: this._colors.background, cursor: this._colors.cursor, ansi: this._colors.ansi.slice() };
        }
      };
      function g(e3, t3) {
        if (e3 !== undefined)
          try {
            return n.css.toColor(e3);
          } catch {}
        return t3;
      }
      t2.ThemeService = f = r2([o(0, c.IOptionsService)], f);
    }, 160: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.contrastRatio = t2.toPaddedHex = t2.rgba = t2.rgb = t2.css = t2.color = t2.channels = t2.NULL_COLOR = undefined;
      let s2 = 0, r2 = 0, o = 0, i = 0;
      var n, l, a, c, h;
      function u(e3) {
        const t3 = e3.toString(16);
        return t3.length < 2 ? "0" + t3 : t3;
      }
      function _(e3, t3) {
        return e3 < t3 ? (t3 + 0.05) / (e3 + 0.05) : (e3 + 0.05) / (t3 + 0.05);
      }
      t2.NULL_COLOR = { css: "#00000000", rgba: 0 }, function(e3) {
        e3.toCss = function(e4, t3, s3, r3) {
          return r3 !== undefined ? `#${u(e4)}${u(t3)}${u(s3)}${u(r3)}` : `#${u(e4)}${u(t3)}${u(s3)}`;
        }, e3.toRgba = function(e4, t3, s3, r3 = 255) {
          return (e4 << 24 | t3 << 16 | s3 << 8 | r3) >>> 0;
        }, e3.toColor = function(t3, s3, r3, o2) {
          return { css: e3.toCss(t3, s3, r3, o2), rgba: e3.toRgba(t3, s3, r3, o2) };
        };
      }(n || (t2.channels = n = {})), function(e3) {
        function t3(e4, t4) {
          return i = Math.round(255 * t4), [s2, r2, o] = h.toChannels(e4.rgba), { css: n.toCss(s2, r2, o, i), rgba: n.toRgba(s2, r2, o, i) };
        }
        e3.blend = function(e4, t4) {
          if (i = (255 & t4.rgba) / 255, i === 1)
            return { css: t4.css, rgba: t4.rgba };
          const l2 = t4.rgba >> 24 & 255, a2 = t4.rgba >> 16 & 255, c2 = t4.rgba >> 8 & 255, h2 = e4.rgba >> 24 & 255, u2 = e4.rgba >> 16 & 255, _2 = e4.rgba >> 8 & 255;
          return s2 = h2 + Math.round((l2 - h2) * i), r2 = u2 + Math.round((a2 - u2) * i), o = _2 + Math.round((c2 - _2) * i), { css: n.toCss(s2, r2, o), rgba: n.toRgba(s2, r2, o) };
        }, e3.isOpaque = function(e4) {
          return (255 & e4.rgba) == 255;
        }, e3.ensureContrastRatio = function(e4, t4, s3) {
          const r3 = h.ensureContrastRatio(e4.rgba, t4.rgba, s3);
          if (r3)
            return n.toColor(r3 >> 24 & 255, r3 >> 16 & 255, r3 >> 8 & 255);
        }, e3.opaque = function(e4) {
          const t4 = (255 | e4.rgba) >>> 0;
          return [s2, r2, o] = h.toChannels(t4), { css: n.toCss(s2, r2, o), rgba: t4 };
        }, e3.opacity = t3, e3.multiplyOpacity = function(e4, s3) {
          return i = 255 & e4.rgba, t3(e4, i * s3 / 255);
        }, e3.toColorRGB = function(e4) {
          return [e4.rgba >> 24 & 255, e4.rgba >> 16 & 255, e4.rgba >> 8 & 255];
        };
      }(l || (t2.color = l = {})), function(e3) {
        let t3, l2;
        try {
          const e4 = document.createElement("canvas");
          e4.width = 1, e4.height = 1;
          const s3 = e4.getContext("2d", { willReadFrequently: true });
          s3 && (t3 = s3, t3.globalCompositeOperation = "copy", l2 = t3.createLinearGradient(0, 0, 1, 1));
        } catch {}
        e3.toColor = function(e4) {
          if (e4.match(/#[\da-f]{3,8}/i))
            switch (e4.length) {
              case 4:
                return s2 = parseInt(e4.slice(1, 2).repeat(2), 16), r2 = parseInt(e4.slice(2, 3).repeat(2), 16), o = parseInt(e4.slice(3, 4).repeat(2), 16), n.toColor(s2, r2, o);
              case 5:
                return s2 = parseInt(e4.slice(1, 2).repeat(2), 16), r2 = parseInt(e4.slice(2, 3).repeat(2), 16), o = parseInt(e4.slice(3, 4).repeat(2), 16), i = parseInt(e4.slice(4, 5).repeat(2), 16), n.toColor(s2, r2, o, i);
              case 7:
                return { css: e4, rgba: (parseInt(e4.slice(1), 16) << 8 | 255) >>> 0 };
              case 9:
                return { css: e4, rgba: parseInt(e4.slice(1), 16) >>> 0 };
            }
          const a2 = e4.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|\d?\.(\d+))\s*)?\)/);
          if (a2)
            return s2 = parseInt(a2[1]), r2 = parseInt(a2[2]), o = parseInt(a2[3]), i = Math.round(255 * (a2[5] === undefined ? 1 : parseFloat(a2[5]))), n.toColor(s2, r2, o, i);
          if (!t3 || !l2)
            throw new Error("css.toColor: Unsupported css format");
          if (t3.fillStyle = l2, t3.fillStyle = e4, typeof t3.fillStyle != "string")
            throw new Error("css.toColor: Unsupported css format");
          if (t3.fillRect(0, 0, 1, 1), [s2, r2, o, i] = t3.getImageData(0, 0, 1, 1).data, i !== 255)
            throw new Error("css.toColor: Unsupported css format");
          return { rgba: n.toRgba(s2, r2, o, i), css: e4 };
        };
      }(a || (t2.css = a = {})), function(e3) {
        function t3(e4, t4, s3) {
          const r3 = e4 / 255, o2 = t4 / 255, i2 = s3 / 255;
          return 0.2126 * (r3 <= 0.03928 ? r3 / 12.92 : Math.pow((r3 + 0.055) / 1.055, 2.4)) + 0.7152 * (o2 <= 0.03928 ? o2 / 12.92 : Math.pow((o2 + 0.055) / 1.055, 2.4)) + 0.0722 * (i2 <= 0.03928 ? i2 / 12.92 : Math.pow((i2 + 0.055) / 1.055, 2.4));
        }
        e3.relativeLuminance = function(e4) {
          return t3(e4 >> 16 & 255, e4 >> 8 & 255, 255 & e4);
        }, e3.relativeLuminance2 = t3;
      }(c || (t2.rgb = c = {})), function(e3) {
        function t3(e4, t4, s3) {
          const r3 = e4 >> 24 & 255, o2 = e4 >> 16 & 255, i2 = e4 >> 8 & 255;
          let n2 = t4 >> 24 & 255, l3 = t4 >> 16 & 255, a2 = t4 >> 8 & 255, h2 = _(c.relativeLuminance2(n2, l3, a2), c.relativeLuminance2(r3, o2, i2));
          for (;h2 < s3 && (n2 > 0 || l3 > 0 || a2 > 0); )
            n2 -= Math.max(0, Math.ceil(0.1 * n2)), l3 -= Math.max(0, Math.ceil(0.1 * l3)), a2 -= Math.max(0, Math.ceil(0.1 * a2)), h2 = _(c.relativeLuminance2(n2, l3, a2), c.relativeLuminance2(r3, o2, i2));
          return (n2 << 24 | l3 << 16 | a2 << 8 | 255) >>> 0;
        }
        function l2(e4, t4, s3) {
          const r3 = e4 >> 24 & 255, o2 = e4 >> 16 & 255, i2 = e4 >> 8 & 255;
          let n2 = t4 >> 24 & 255, l3 = t4 >> 16 & 255, a2 = t4 >> 8 & 255, h2 = _(c.relativeLuminance2(n2, l3, a2), c.relativeLuminance2(r3, o2, i2));
          for (;h2 < s3 && (n2 < 255 || l3 < 255 || a2 < 255); )
            n2 = Math.min(255, n2 + Math.ceil(0.1 * (255 - n2))), l3 = Math.min(255, l3 + Math.ceil(0.1 * (255 - l3))), a2 = Math.min(255, a2 + Math.ceil(0.1 * (255 - a2))), h2 = _(c.relativeLuminance2(n2, l3, a2), c.relativeLuminance2(r3, o2, i2));
          return (n2 << 24 | l3 << 16 | a2 << 8 | 255) >>> 0;
        }
        e3.blend = function(e4, t4) {
          if (i = (255 & t4) / 255, i === 1)
            return t4;
          const l3 = t4 >> 24 & 255, a2 = t4 >> 16 & 255, c2 = t4 >> 8 & 255, h2 = e4 >> 24 & 255, u2 = e4 >> 16 & 255, _2 = e4 >> 8 & 255;
          return s2 = h2 + Math.round((l3 - h2) * i), r2 = u2 + Math.round((a2 - u2) * i), o = _2 + Math.round((c2 - _2) * i), n.toRgba(s2, r2, o);
        }, e3.ensureContrastRatio = function(e4, s3, r3) {
          const o2 = c.relativeLuminance(e4 >> 8), i2 = c.relativeLuminance(s3 >> 8);
          if (_(o2, i2) < r3) {
            if (i2 < o2) {
              const i3 = t3(e4, s3, r3), n3 = _(o2, c.relativeLuminance(i3 >> 8));
              if (n3 < r3) {
                const t4 = l2(e4, s3, r3);
                return n3 > _(o2, c.relativeLuminance(t4 >> 8)) ? i3 : t4;
              }
              return i3;
            }
            const n2 = l2(e4, s3, r3), a2 = _(o2, c.relativeLuminance(n2 >> 8));
            if (a2 < r3) {
              const i3 = t3(e4, s3, r3);
              return a2 > _(o2, c.relativeLuminance(i3 >> 8)) ? n2 : i3;
            }
            return n2;
          }
        }, e3.reduceLuminance = t3, e3.increaseLuminance = l2, e3.toChannels = function(e4) {
          return [e4 >> 24 & 255, e4 >> 16 & 255, e4 >> 8 & 255, 255 & e4];
        };
      }(h || (t2.rgba = h = {})), t2.toPaddedHex = u, t2.contrastRatio = _;
    }, 345: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.runAndSubscribe = t2.forwardEvent = t2.EventEmitter = undefined, t2.EventEmitter = class {
        constructor() {
          this._listeners = [], this._disposed = false;
        }
        get event() {
          return this._event || (this._event = (e3) => (this._listeners.push(e3), { dispose: () => {
            if (!this._disposed) {
              for (let t3 = 0;t3 < this._listeners.length; t3++)
                if (this._listeners[t3] === e3)
                  return void this._listeners.splice(t3, 1);
            }
          } })), this._event;
        }
        fire(e3, t3) {
          const s2 = [];
          for (let e4 = 0;e4 < this._listeners.length; e4++)
            s2.push(this._listeners[e4]);
          for (let r2 = 0;r2 < s2.length; r2++)
            s2[r2].call(undefined, e3, t3);
        }
        dispose() {
          this.clearListeners(), this._disposed = true;
        }
        clearListeners() {
          this._listeners && (this._listeners.length = 0);
        }
      }, t2.forwardEvent = function(e3, t3) {
        return e3((e4) => t3.fire(e4));
      }, t2.runAndSubscribe = function(e3, t3) {
        return t3(undefined), e3((e4) => t3(e4));
      };
    }, 859: (e2, t2) => {
      function s2(e3) {
        for (const t3 of e3)
          t3.dispose();
        e3.length = 0;
      }
      Object.defineProperty(t2, "__esModule", { value: true }), t2.getDisposeArrayDisposable = t2.disposeArray = t2.toDisposable = t2.MutableDisposable = t2.Disposable = undefined, t2.Disposable = class {
        constructor() {
          this._disposables = [], this._isDisposed = false;
        }
        dispose() {
          this._isDisposed = true;
          for (const e3 of this._disposables)
            e3.dispose();
          this._disposables.length = 0;
        }
        register(e3) {
          return this._disposables.push(e3), e3;
        }
        unregister(e3) {
          const t3 = this._disposables.indexOf(e3);
          t3 !== -1 && this._disposables.splice(t3, 1);
        }
      }, t2.MutableDisposable = class {
        constructor() {
          this._isDisposed = false;
        }
        get value() {
          return this._isDisposed ? undefined : this._value;
        }
        set value(e3) {
          this._isDisposed || e3 === this._value || (this._value?.dispose(), this._value = e3);
        }
        clear() {
          this.value = undefined;
        }
        dispose() {
          this._isDisposed = true, this._value?.dispose(), this._value = undefined;
        }
      }, t2.toDisposable = function(e3) {
        return { dispose: e3 };
      }, t2.disposeArray = s2, t2.getDisposeArrayDisposable = function(e3) {
        return { dispose: () => s2(e3) };
      };
    }, 485: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.FourKeyMap = t2.TwoKeyMap = undefined;

      class s2 {
        constructor() {
          this._data = {};
        }
        set(e3, t3, s3) {
          this._data[e3] || (this._data[e3] = {}), this._data[e3][t3] = s3;
        }
        get(e3, t3) {
          return this._data[e3] ? this._data[e3][t3] : undefined;
        }
        clear() {
          this._data = {};
        }
      }
      t2.TwoKeyMap = s2, t2.FourKeyMap = class {
        constructor() {
          this._data = new s2;
        }
        set(e3, t3, r2, o, i) {
          this._data.get(e3, t3) || this._data.set(e3, t3, new s2), this._data.get(e3, t3).set(r2, o, i);
        }
        get(e3, t3, s3, r2) {
          return this._data.get(e3, t3)?.get(s3, r2);
        }
        clear() {
          this._data.clear();
        }
      };
    }, 726: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.createDecorator = t2.getServiceDependencies = t2.serviceRegistry = undefined;
      const s2 = "di$target", r2 = "di$dependencies";
      t2.serviceRegistry = new Map, t2.getServiceDependencies = function(e3) {
        return e3[r2] || [];
      }, t2.createDecorator = function(e3) {
        if (t2.serviceRegistry.has(e3))
          return t2.serviceRegistry.get(e3);
        const o = function(e4, t3, i) {
          if (arguments.length !== 3)
            throw new Error("@IServiceName-decorator can only be used to decorate a parameter");
          (function(e5, t4, o2) {
            t4[s2] === t4 ? t4[r2].push({ id: e5, index: o2 }) : (t4[r2] = [{ id: e5, index: o2 }], t4[s2] = t4);
          })(o, e4, i);
        };
        return o.toString = () => e3, t2.serviceRegistry.set(e3, o), o;
      };
    }, 97: (e2, t2, s2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.IDecorationService = t2.IUnicodeService = t2.IOscLinkService = t2.IOptionsService = t2.ILogService = t2.LogLevelEnum = t2.IInstantiationService = t2.ICharsetService = t2.ICoreService = t2.ICoreMouseService = t2.IBufferService = undefined;
      const r2 = s2(726);
      var o;
      t2.IBufferService = (0, r2.createDecorator)("BufferService"), t2.ICoreMouseService = (0, r2.createDecorator)("CoreMouseService"), t2.ICoreService = (0, r2.createDecorator)("CoreService"), t2.ICharsetService = (0, r2.createDecorator)("CharsetService"), t2.IInstantiationService = (0, r2.createDecorator)("InstantiationService"), function(e3) {
        e3[e3.TRACE = 0] = "TRACE", e3[e3.DEBUG = 1] = "DEBUG", e3[e3.INFO = 2] = "INFO", e3[e3.WARN = 3] = "WARN", e3[e3.ERROR = 4] = "ERROR", e3[e3.OFF = 5] = "OFF";
      }(o || (t2.LogLevelEnum = o = {})), t2.ILogService = (0, r2.createDecorator)("LogService"), t2.IOptionsService = (0, r2.createDecorator)("OptionsService"), t2.IOscLinkService = (0, r2.createDecorator)("OscLinkService"), t2.IUnicodeService = (0, r2.createDecorator)("UnicodeService"), t2.IDecorationService = (0, r2.createDecorator)("DecorationService");
    } }, t = {};
    function s(r2) {
      var o = t[r2];
      if (o !== undefined)
        return o.exports;
      var i = t[r2] = { exports: {} };
      return e[r2].call(i.exports, i, i.exports, s), i.exports;
    }
    var r = {};
    return (() => {
      var e2 = r;
      Object.defineProperty(e2, "__esModule", { value: true }), e2.HTMLSerializeHandler = e2.SerializeAddon = undefined;
      const t2 = s(997);
      function o(e3, t3, s2) {
        return Math.max(t3, Math.min(e3, s2));
      }

      class i {
        constructor(e3) {
          this._buffer = e3;
        }
        serialize(e3, t3) {
          const s2 = this._buffer.getNullCell(), r2 = this._buffer.getNullCell();
          let o2 = s2;
          const i2 = e3.start.y, n2 = e3.end.y, l2 = e3.start.x, a2 = e3.end.x;
          this._beforeSerialize(n2 - i2, i2, n2);
          for (let t4 = i2;t4 <= n2; t4++) {
            const i3 = this._buffer.getLine(t4);
            if (i3) {
              const n3 = t4 === e3.start.y ? l2 : 0, c2 = t4 === e3.end.y ? a2 : i3.length;
              for (let e4 = n3;e4 < c2; e4++) {
                const n4 = i3.getCell(e4, o2 === s2 ? r2 : s2);
                n4 ? (this._nextCell(n4, o2, t4, e4), o2 = n4) : console.warn(`Can't get cell at row=${t4}, col=${e4}`);
              }
            }
            this._rowEnd(t4, t4 === n2);
          }
          return this._afterSerialize(), this._serializeString(t3);
        }
        _nextCell(e3, t3, s2, r2) {}
        _rowEnd(e3, t3) {}
        _beforeSerialize(e3, t3, s2) {}
        _afterSerialize() {}
        _serializeString(e3) {
          return "";
        }
      }
      function n(e3, t3) {
        return e3.getFgColorMode() === t3.getFgColorMode() && e3.getFgColor() === t3.getFgColor();
      }
      function l(e3, t3) {
        return e3.getBgColorMode() === t3.getBgColorMode() && e3.getBgColor() === t3.getBgColor();
      }
      function a(e3, t3) {
        return e3.isInverse() === t3.isInverse() && e3.isBold() === t3.isBold() && e3.isUnderline() === t3.isUnderline() && e3.isOverline() === t3.isOverline() && e3.isBlink() === t3.isBlink() && e3.isInvisible() === t3.isInvisible() && e3.isItalic() === t3.isItalic() && e3.isDim() === t3.isDim() && e3.isStrikethrough() === t3.isStrikethrough();
      }

      class c extends i {
        constructor(e3, t3) {
          super(e3), this._terminal = t3, this._rowIndex = 0, this._allRows = new Array, this._allRowSeparators = new Array, this._currentRow = "", this._nullCellCount = 0, this._cursorStyle = this._buffer.getNullCell(), this._cursorStyleRow = 0, this._cursorStyleCol = 0, this._backgroundCell = this._buffer.getNullCell(), this._firstRow = 0, this._lastCursorRow = 0, this._lastCursorCol = 0, this._lastContentCursorRow = 0, this._lastContentCursorCol = 0, this._thisRowLastChar = this._buffer.getNullCell(), this._thisRowLastSecondChar = this._buffer.getNullCell(), this._nextRowFirstChar = this._buffer.getNullCell();
        }
        _beforeSerialize(e3, t3, s2) {
          this._allRows = new Array(e3), this._lastContentCursorRow = t3, this._lastCursorRow = t3, this._firstRow = t3;
        }
        _rowEnd(e3, t3) {
          this._nullCellCount > 0 && !l(this._cursorStyle, this._backgroundCell) && (this._currentRow += `\x1B[${this._nullCellCount}X`);
          let s2 = "";
          if (!t3) {
            e3 - this._firstRow >= this._terminal.rows && this._buffer.getLine(this._cursorStyleRow)?.getCell(this._cursorStyleCol, this._backgroundCell);
            const t4 = this._buffer.getLine(e3), r2 = this._buffer.getLine(e3 + 1);
            if (r2.isWrapped) {
              s2 = "";
              const o2 = t4.getCell(t4.length - 1, this._thisRowLastChar), i2 = t4.getCell(t4.length - 2, this._thisRowLastSecondChar), n2 = r2.getCell(0, this._nextRowFirstChar), a2 = n2.getWidth() > 1;
              let c2 = false;
              (n2.getChars() && a2 ? this._nullCellCount <= 1 : this._nullCellCount <= 0) && ((o2.getChars() || o2.getWidth() === 0) && l(o2, n2) && (c2 = true), a2 && (i2.getChars() || i2.getWidth() === 0) && l(o2, n2) && l(i2, n2) && (c2 = true)), c2 || (s2 = "-".repeat(this._nullCellCount + 1), s2 += "\x1B[1D\x1B[1X", this._nullCellCount > 0 && (s2 += "\x1B[A", s2 += `\x1B[${t4.length - this._nullCellCount}C`, s2 += `\x1B[${this._nullCellCount}X`, s2 += `\x1B[${t4.length - this._nullCellCount}D`, s2 += "\x1B[B"), this._lastContentCursorRow = e3 + 1, this._lastContentCursorCol = 0, this._lastCursorRow = e3 + 1, this._lastCursorCol = 0);
            } else
              s2 = `\r
`, this._lastCursorRow = e3 + 1, this._lastCursorCol = 0;
          }
          this._allRows[this._rowIndex] = this._currentRow, this._allRowSeparators[this._rowIndex++] = s2, this._currentRow = "", this._nullCellCount = 0;
        }
        _diffStyle(e3, t3) {
          const s2 = [], r2 = !n(e3, t3), o2 = !l(e3, t3), i2 = !a(e3, t3);
          if (r2 || o2 || i2)
            if (e3.isAttributeDefault())
              t3.isAttributeDefault() || s2.push(0);
            else {
              if (r2) {
                const t4 = e3.getFgColor();
                e3.isFgRGB() ? s2.push(38, 2, t4 >>> 16 & 255, t4 >>> 8 & 255, 255 & t4) : e3.isFgPalette() ? t4 >= 16 ? s2.push(38, 5, t4) : s2.push(8 & t4 ? 90 + (7 & t4) : 30 + (7 & t4)) : s2.push(39);
              }
              if (o2) {
                const t4 = e3.getBgColor();
                e3.isBgRGB() ? s2.push(48, 2, t4 >>> 16 & 255, t4 >>> 8 & 255, 255 & t4) : e3.isBgPalette() ? t4 >= 16 ? s2.push(48, 5, t4) : s2.push(8 & t4 ? 100 + (7 & t4) : 40 + (7 & t4)) : s2.push(49);
              }
              i2 && (e3.isInverse() !== t3.isInverse() && s2.push(e3.isInverse() ? 7 : 27), e3.isBold() !== t3.isBold() && s2.push(e3.isBold() ? 1 : 22), e3.isUnderline() !== t3.isUnderline() && s2.push(e3.isUnderline() ? 4 : 24), e3.isOverline() !== t3.isOverline() && s2.push(e3.isOverline() ? 53 : 55), e3.isBlink() !== t3.isBlink() && s2.push(e3.isBlink() ? 5 : 25), e3.isInvisible() !== t3.isInvisible() && s2.push(e3.isInvisible() ? 8 : 28), e3.isItalic() !== t3.isItalic() && s2.push(e3.isItalic() ? 3 : 23), e3.isDim() !== t3.isDim() && s2.push(e3.isDim() ? 2 : 22), e3.isStrikethrough() !== t3.isStrikethrough() && s2.push(e3.isStrikethrough() ? 9 : 29));
            }
          return s2;
        }
        _nextCell(e3, t3, s2, r2) {
          if (e3.getWidth() === 0)
            return;
          const o2 = e3.getChars() === "", i2 = this._diffStyle(e3, this._cursorStyle);
          if (o2 ? !l(this._cursorStyle, e3) : i2.length > 0) {
            this._nullCellCount > 0 && (l(this._cursorStyle, this._backgroundCell) || (this._currentRow += `\x1B[${this._nullCellCount}X`), this._currentRow += `\x1B[${this._nullCellCount}C`, this._nullCellCount = 0), this._lastContentCursorRow = this._lastCursorRow = s2, this._lastContentCursorCol = this._lastCursorCol = r2, this._currentRow += `\x1B[${i2.join(";")}m`;
            const e4 = this._buffer.getLine(s2);
            e4 !== undefined && (e4.getCell(r2, this._cursorStyle), this._cursorStyleRow = s2, this._cursorStyleCol = r2);
          }
          o2 ? this._nullCellCount += e3.getWidth() : (this._nullCellCount > 0 && (l(this._cursorStyle, this._backgroundCell) || (this._currentRow += `\x1B[${this._nullCellCount}X`), this._currentRow += `\x1B[${this._nullCellCount}C`, this._nullCellCount = 0), this._currentRow += e3.getChars(), this._lastContentCursorRow = this._lastCursorRow = s2, this._lastContentCursorCol = this._lastCursorCol = r2 + e3.getWidth());
        }
        _serializeString(e3) {
          let t3 = this._allRows.length;
          this._buffer.length - this._firstRow <= this._terminal.rows && (t3 = this._lastContentCursorRow + 1 - this._firstRow, this._lastCursorCol = this._lastContentCursorCol, this._lastCursorRow = this._lastContentCursorRow);
          let s2 = "";
          for (let e4 = 0;e4 < t3; e4++)
            s2 += this._allRows[e4], e4 + 1 < t3 && (s2 += this._allRowSeparators[e4]);
          if (!e3) {
            const e4 = this._buffer.baseY + this._buffer.cursorY, t4 = this._buffer.cursorX, o3 = (e5) => {
              e5 > 0 ? s2 += `\x1B[${e5}C` : e5 < 0 && (s2 += `\x1B[${-e5}D`);
            };
            (e4 !== this._lastCursorRow || t4 !== this._lastCursorCol) && ((r2 = e4 - this._lastCursorRow) > 0 ? s2 += `\x1B[${r2}B` : r2 < 0 && (s2 += `\x1B[${-r2}A`), o3(t4 - this._lastCursorCol));
          }
          var r2;
          const o2 = this._terminal._core._inputHandler._curAttrData, i2 = this._diffStyle(o2, this._cursorStyle);
          return i2.length > 0 && (s2 += `\x1B[${i2.join(";")}m`), s2;
        }
      }
      e2.SerializeAddon = class {
        activate(e3) {
          this._terminal = e3;
        }
        _serializeBufferByScrollback(e3, t3, s2) {
          const r2 = t3.length, i2 = s2 === undefined ? r2 : o(s2 + e3.rows, 0, r2);
          return this._serializeBufferByRange(e3, t3, { start: r2 - i2, end: r2 - 1 }, false);
        }
        _serializeBufferByRange(e3, t3, s2, r2) {
          return new c(t3, e3).serialize({ start: { x: 0, y: typeof s2.start == "number" ? s2.start : s2.start.line }, end: { x: e3.cols, y: typeof s2.end == "number" ? s2.end : s2.end.line } }, r2);
        }
        _serializeBufferAsHTML(e3, t3) {
          const s2 = e3.buffer.active, r2 = new h(s2, e3, t3);
          if (!t3.onlySelection) {
            const i3 = s2.length, n2 = t3.scrollback, l2 = n2 === undefined ? i3 : o(n2 + e3.rows, 0, i3);
            return r2.serialize({ start: { x: 0, y: i3 - l2 }, end: { x: e3.cols, y: i3 - 1 } });
          }
          const i2 = this._terminal?.getSelectionPosition();
          return i2 !== undefined ? r2.serialize({ start: { x: i2.start.x, y: i2.start.y }, end: { x: i2.end.x, y: i2.end.y } }) : "";
        }
        _serializeModes(e3) {
          let t3 = "";
          const s2 = e3.modes;
          if (s2.applicationCursorKeysMode && (t3 += "\x1B[?1h"), s2.applicationKeypadMode && (t3 += "\x1B[?66h"), s2.bracketedPasteMode && (t3 += "\x1B[?2004h"), s2.insertMode && (t3 += "\x1B[4h"), s2.originMode && (t3 += "\x1B[?6h"), s2.reverseWraparoundMode && (t3 += "\x1B[?45h"), s2.sendFocusMode && (t3 += "\x1B[?1004h"), s2.wraparoundMode === false && (t3 += "\x1B[?7l"), s2.mouseTrackingMode !== "none")
            switch (s2.mouseTrackingMode) {
              case "x10":
                t3 += "\x1B[?9h";
                break;
              case "vt200":
                t3 += "\x1B[?1000h";
                break;
              case "drag":
                t3 += "\x1B[?1002h";
                break;
              case "any":
                t3 += "\x1B[?1003h";
            }
          return t3;
        }
        serialize(e3) {
          if (!this._terminal)
            throw new Error("Cannot use addon until it has been loaded");
          let t3 = e3?.range ? this._serializeBufferByRange(this._terminal, this._terminal.buffer.normal, e3.range, true) : this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.normal, e3?.scrollback);
          return e3?.excludeAltBuffer || this._terminal.buffer.active.type !== "alternate" || (t3 += `\x1B[?1049h\x1B[H${this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.alternate, undefined)}`), e3?.excludeModes || (t3 += this._serializeModes(this._terminal)), t3;
        }
        serializeAsHTML(e3) {
          if (!this._terminal)
            throw new Error("Cannot use addon until it has been loaded");
          return this._serializeBufferAsHTML(this._terminal, e3 || {});
        }
        dispose() {}
      };

      class h extends i {
        constructor(e3, s2, r2) {
          super(e3), this._terminal = s2, this._options = r2, this._currentRow = "", this._htmlContent = "", s2._core._themeService ? this._ansiColors = s2._core._themeService.colors.ansi : this._ansiColors = t2.DEFAULT_ANSI_COLORS;
        }
        _padStart(e3, t3, s2) {
          return t3 >>= 0, s2 = s2 ?? " ", e3.length > t3 ? e3 : ((t3 -= e3.length) > s2.length && (s2 += s2.repeat(t3 / s2.length)), s2.slice(0, t3) + e3);
        }
        _beforeSerialize(e3, t3, s2) {
          this._htmlContent += "<html><body><!--StartFragment--><pre>";
          let r2 = "#000000", o2 = "#ffffff";
          this._options.includeGlobalBackground && (r2 = this._terminal.options.theme?.foreground ?? "#ffffff", o2 = this._terminal.options.theme?.background ?? "#000000");
          const i2 = [];
          i2.push("color: " + r2 + ";"), i2.push("background-color: " + o2 + ";"), i2.push("font-family: " + this._terminal.options.fontFamily + ";"), i2.push("font-size: " + this._terminal.options.fontSize + "px;"), this._htmlContent += "<div style='" + i2.join(" ") + "'>";
        }
        _afterSerialize() {
          this._htmlContent += "</div>", this._htmlContent += "</pre><!--EndFragment--></body></html>";
        }
        _rowEnd(e3, t3) {
          this._htmlContent += "<div><span>" + this._currentRow + "</span></div>", this._currentRow = "";
        }
        _getHexColor(e3, t3) {
          const s2 = t3 ? e3.getFgColor() : e3.getBgColor();
          return (t3 ? e3.isFgRGB() : e3.isBgRGB()) ? "#" + [s2 >> 16 & 255, s2 >> 8 & 255, 255 & s2].map((e4) => this._padStart(e4.toString(16), 2, "0")).join("") : (t3 ? e3.isFgPalette() : e3.isBgPalette()) ? this._ansiColors[s2].css : undefined;
        }
        _diffStyle(e3, t3) {
          const s2 = [], r2 = !n(e3, t3), o2 = !l(e3, t3), i2 = !a(e3, t3);
          if (r2 || o2 || i2) {
            const t4 = this._getHexColor(e3, true);
            t4 && s2.push("color: " + t4 + ";");
            const r3 = this._getHexColor(e3, false);
            return r3 && s2.push("background-color: " + r3 + ";"), e3.isInverse() && s2.push("color: #000000; background-color: #BFBFBF;"), e3.isBold() && s2.push("font-weight: bold;"), e3.isUnderline() && e3.isOverline() ? s2.push("text-decoration: overline underline;") : e3.isUnderline() ? s2.push("text-decoration: underline;") : e3.isOverline() && s2.push("text-decoration: overline;"), e3.isBlink() && s2.push("text-decoration: blink;"), e3.isInvisible() && s2.push("visibility: hidden;"), e3.isItalic() && s2.push("font-style: italic;"), e3.isDim() && s2.push("opacity: 0.5;"), e3.isStrikethrough() && s2.push("text-decoration: line-through;"), s2;
          }
        }
        _nextCell(e3, t3, s2, r2) {
          if (e3.getWidth() === 0)
            return;
          const o2 = e3.getChars() === "", i2 = this._diffStyle(e3, t3);
          i2 && (this._currentRow += i2.length === 0 ? "</span><span>" : "</span><span style='" + i2.join(" ") + "'>"), this._currentRow += o2 ? " " : e3.getChars();
        }
        _serializeString() {
          return this._htmlContent;
        }
      }
      e2.HTMLSerializeHandler = h;
    })(), r;
  })());
});

// node_modules/@xterm/headless/lib-headless/xterm-headless.js
var require_xterm_headless = __commonJS((exports) => {
  (() => {
    var e = { 349: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CircularList = undefined;
      const s2 = i2(460), r2 = i2(844);

      class n2 extends r2.Disposable {
        constructor(e3) {
          super(), this._maxLength = e3, this.onDeleteEmitter = this.register(new s2.EventEmitter), this.onDelete = this.onDeleteEmitter.event, this.onInsertEmitter = this.register(new s2.EventEmitter), this.onInsert = this.onInsertEmitter.event, this.onTrimEmitter = this.register(new s2.EventEmitter), this.onTrim = this.onTrimEmitter.event, this._array = new Array(this._maxLength), this._startIndex = 0, this._length = 0;
        }
        get maxLength() {
          return this._maxLength;
        }
        set maxLength(e3) {
          if (this._maxLength === e3)
            return;
          const t3 = new Array(e3);
          for (let i3 = 0;i3 < Math.min(e3, this.length); i3++)
            t3[i3] = this._array[this._getCyclicIndex(i3)];
          this._array = t3, this._maxLength = e3, this._startIndex = 0;
        }
        get length() {
          return this._length;
        }
        set length(e3) {
          if (e3 > this._length)
            for (let t3 = this._length;t3 < e3; t3++)
              this._array[t3] = undefined;
          this._length = e3;
        }
        get(e3) {
          return this._array[this._getCyclicIndex(e3)];
        }
        set(e3, t3) {
          this._array[this._getCyclicIndex(e3)] = t3;
        }
        push(e3) {
          this._array[this._getCyclicIndex(this._length)] = e3, this._length === this._maxLength ? (this._startIndex = ++this._startIndex % this._maxLength, this.onTrimEmitter.fire(1)) : this._length++;
        }
        recycle() {
          if (this._length !== this._maxLength)
            throw new Error("Can only recycle when the buffer is full");
          return this._startIndex = ++this._startIndex % this._maxLength, this.onTrimEmitter.fire(1), this._array[this._getCyclicIndex(this._length - 1)];
        }
        get isFull() {
          return this._length === this._maxLength;
        }
        pop() {
          return this._array[this._getCyclicIndex(this._length-- - 1)];
        }
        splice(e3, t3, ...i3) {
          if (t3) {
            for (let i4 = e3;i4 < this._length - t3; i4++)
              this._array[this._getCyclicIndex(i4)] = this._array[this._getCyclicIndex(i4 + t3)];
            this._length -= t3, this.onDeleteEmitter.fire({ index: e3, amount: t3 });
          }
          for (let t4 = this._length - 1;t4 >= e3; t4--)
            this._array[this._getCyclicIndex(t4 + i3.length)] = this._array[this._getCyclicIndex(t4)];
          for (let t4 = 0;t4 < i3.length; t4++)
            this._array[this._getCyclicIndex(e3 + t4)] = i3[t4];
          if (i3.length && this.onInsertEmitter.fire({ index: e3, amount: i3.length }), this._length + i3.length > this._maxLength) {
            const e4 = this._length + i3.length - this._maxLength;
            this._startIndex += e4, this._length = this._maxLength, this.onTrimEmitter.fire(e4);
          } else
            this._length += i3.length;
        }
        trimStart(e3) {
          e3 > this._length && (e3 = this._length), this._startIndex += e3, this._length -= e3, this.onTrimEmitter.fire(e3);
        }
        shiftElements(e3, t3, i3) {
          if (!(t3 <= 0)) {
            if (e3 < 0 || e3 >= this._length)
              throw new Error("start argument out of range");
            if (e3 + i3 < 0)
              throw new Error("Cannot shift elements in list beyond index 0");
            if (i3 > 0) {
              for (let s4 = t3 - 1;s4 >= 0; s4--)
                this.set(e3 + s4 + i3, this.get(e3 + s4));
              const s3 = e3 + t3 + i3 - this._length;
              if (s3 > 0)
                for (this._length += s3;this._length > this._maxLength; )
                  this._length--, this._startIndex++, this.onTrimEmitter.fire(1);
            } else
              for (let s3 = 0;s3 < t3; s3++)
                this.set(e3 + s3 + i3, this.get(e3 + s3));
          }
        }
        _getCyclicIndex(e3) {
          return (this._startIndex + e3) % this._maxLength;
        }
      }
      t2.CircularList = n2;
    }, 439: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.clone = undefined, t2.clone = function e(t3, i2 = 5) {
        if (typeof t3 != "object")
          return t3;
        const s2 = Array.isArray(t3) ? [] : {};
        for (const r2 in t3)
          s2[r2] = i2 <= 1 ? t3[r2] : t3[r2] && e(t3[r2], i2 - 1);
        return s2;
      };
    }, 969: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CoreTerminal = undefined;
      const s2 = i2(844), r2 = i2(585), n2 = i2(348), a = i2(866), o = i2(744), h = i2(302), c = i2(83), l = i2(460), _ = i2(753), d = i2(480), f = i2(994), u = i2(282), p = i2(435), g = i2(981), v = i2(660);
      let b = false;

      class S extends s2.Disposable {
        get onScroll() {
          return this._onScrollApi || (this._onScrollApi = this.register(new l.EventEmitter), this._onScroll.event((e3) => {
            this._onScrollApi?.fire(e3.position);
          })), this._onScrollApi.event;
        }
        get cols() {
          return this._bufferService.cols;
        }
        get rows() {
          return this._bufferService.rows;
        }
        get buffers() {
          return this._bufferService.buffers;
        }
        get options() {
          return this.optionsService.options;
        }
        set options(e3) {
          for (const t3 in e3)
            this.optionsService.options[t3] = e3[t3];
        }
        constructor(e3) {
          super(), this._windowsWrappingHeuristics = this.register(new s2.MutableDisposable), this._onBinary = this.register(new l.EventEmitter), this.onBinary = this._onBinary.event, this._onData = this.register(new l.EventEmitter), this.onData = this._onData.event, this._onLineFeed = this.register(new l.EventEmitter), this.onLineFeed = this._onLineFeed.event, this._onResize = this.register(new l.EventEmitter), this.onResize = this._onResize.event, this._onWriteParsed = this.register(new l.EventEmitter), this.onWriteParsed = this._onWriteParsed.event, this._onScroll = this.register(new l.EventEmitter), this._instantiationService = new n2.InstantiationService, this.optionsService = this.register(new h.OptionsService(e3)), this._instantiationService.setService(r2.IOptionsService, this.optionsService), this._bufferService = this.register(this._instantiationService.createInstance(o.BufferService)), this._instantiationService.setService(r2.IBufferService, this._bufferService), this._logService = this.register(this._instantiationService.createInstance(a.LogService)), this._instantiationService.setService(r2.ILogService, this._logService), this.coreService = this.register(this._instantiationService.createInstance(c.CoreService)), this._instantiationService.setService(r2.ICoreService, this.coreService), this.coreMouseService = this.register(this._instantiationService.createInstance(_.CoreMouseService)), this._instantiationService.setService(r2.ICoreMouseService, this.coreMouseService), this.unicodeService = this.register(this._instantiationService.createInstance(d.UnicodeService)), this._instantiationService.setService(r2.IUnicodeService, this.unicodeService), this._charsetService = this._instantiationService.createInstance(f.CharsetService), this._instantiationService.setService(r2.ICharsetService, this._charsetService), this._oscLinkService = this._instantiationService.createInstance(v.OscLinkService), this._instantiationService.setService(r2.IOscLinkService, this._oscLinkService), this._inputHandler = this.register(new p.InputHandler(this._bufferService, this._charsetService, this.coreService, this._logService, this.optionsService, this._oscLinkService, this.coreMouseService, this.unicodeService)), this.register((0, l.forwardEvent)(this._inputHandler.onLineFeed, this._onLineFeed)), this.register(this._inputHandler), this.register((0, l.forwardEvent)(this._bufferService.onResize, this._onResize)), this.register((0, l.forwardEvent)(this.coreService.onData, this._onData)), this.register((0, l.forwardEvent)(this.coreService.onBinary, this._onBinary)), this.register(this.coreService.onRequestScrollToBottom(() => this.scrollToBottom())), this.register(this.coreService.onUserInput(() => this._writeBuffer.handleUserInput())), this.register(this.optionsService.onMultipleOptionChange(["windowsMode", "windowsPty"], () => this._handleWindowsPtyOptionChange())), this.register(this._bufferService.onScroll((e4) => {
            this._onScroll.fire({ position: this._bufferService.buffer.ydisp, source: 0 }), this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop, this._bufferService.buffer.scrollBottom);
          })), this.register(this._inputHandler.onScroll((e4) => {
            this._onScroll.fire({ position: this._bufferService.buffer.ydisp, source: 0 }), this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop, this._bufferService.buffer.scrollBottom);
          })), this._writeBuffer = this.register(new g.WriteBuffer((e4, t3) => this._inputHandler.parse(e4, t3))), this.register((0, l.forwardEvent)(this._writeBuffer.onWriteParsed, this._onWriteParsed));
        }
        write(e3, t3) {
          this._writeBuffer.write(e3, t3);
        }
        writeSync(e3, t3) {
          this._logService.logLevel <= r2.LogLevelEnum.WARN && !b && (this._logService.warn("writeSync is unreliable and will be removed soon."), b = true), this._writeBuffer.writeSync(e3, t3);
        }
        input(e3, t3 = true) {
          this.coreService.triggerDataEvent(e3, t3);
        }
        resize(e3, t3) {
          isNaN(e3) || isNaN(t3) || (e3 = Math.max(e3, o.MINIMUM_COLS), t3 = Math.max(t3, o.MINIMUM_ROWS), this._bufferService.resize(e3, t3));
        }
        scroll(e3, t3 = false) {
          this._bufferService.scroll(e3, t3);
        }
        scrollLines(e3, t3, i3) {
          this._bufferService.scrollLines(e3, t3, i3);
        }
        scrollPages(e3) {
          this.scrollLines(e3 * (this.rows - 1));
        }
        scrollToTop() {
          this.scrollLines(-this._bufferService.buffer.ydisp);
        }
        scrollToBottom() {
          this.scrollLines(this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp);
        }
        scrollToLine(e3) {
          const t3 = e3 - this._bufferService.buffer.ydisp;
          t3 !== 0 && this.scrollLines(t3);
        }
        registerEscHandler(e3, t3) {
          return this._inputHandler.registerEscHandler(e3, t3);
        }
        registerDcsHandler(e3, t3) {
          return this._inputHandler.registerDcsHandler(e3, t3);
        }
        registerCsiHandler(e3, t3) {
          return this._inputHandler.registerCsiHandler(e3, t3);
        }
        registerOscHandler(e3, t3) {
          return this._inputHandler.registerOscHandler(e3, t3);
        }
        _setup() {
          this._handleWindowsPtyOptionChange();
        }
        reset() {
          this._inputHandler.reset(), this._bufferService.reset(), this._charsetService.reset(), this.coreService.reset(), this.coreMouseService.reset();
        }
        _handleWindowsPtyOptionChange() {
          let e3 = false;
          const t3 = this.optionsService.rawOptions.windowsPty;
          t3 && t3.buildNumber !== undefined && t3.buildNumber !== undefined ? e3 = !!(t3.backend === "conpty" && t3.buildNumber < 21376) : this.optionsService.rawOptions.windowsMode && (e3 = true), e3 ? this._enableWindowsWrappingHeuristics() : this._windowsWrappingHeuristics.clear();
        }
        _enableWindowsWrappingHeuristics() {
          if (!this._windowsWrappingHeuristics.value) {
            const e3 = [];
            e3.push(this.onLineFeed(u.updateWindowsModeWrappedState.bind(null, this._bufferService))), e3.push(this.registerCsiHandler({ final: "H" }, () => ((0, u.updateWindowsModeWrappedState)(this._bufferService), false))), this._windowsWrappingHeuristics.value = (0, s2.toDisposable)(() => {
              for (const t3 of e3)
                t3.dispose();
            });
          }
        }
      }
      t2.CoreTerminal = S;
    }, 460: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.runAndSubscribe = t2.forwardEvent = t2.EventEmitter = undefined, t2.EventEmitter = class {
        constructor() {
          this._listeners = [], this._disposed = false;
        }
        get event() {
          return this._event || (this._event = (e3) => {
            this._listeners.push(e3);
            const t3 = { dispose: () => {
              if (!this._disposed) {
                for (let t4 = 0;t4 < this._listeners.length; t4++)
                  if (this._listeners[t4] === e3)
                    return void this._listeners.splice(t4, 1);
              }
            } };
            return t3;
          }), this._event;
        }
        fire(e3, t3) {
          const i2 = [];
          for (let e4 = 0;e4 < this._listeners.length; e4++)
            i2.push(this._listeners[e4]);
          for (let s2 = 0;s2 < i2.length; s2++)
            i2[s2].call(undefined, e3, t3);
        }
        dispose() {
          this.clearListeners(), this._disposed = true;
        }
        clearListeners() {
          this._listeners && (this._listeners.length = 0);
        }
      }, t2.forwardEvent = function(e3, t3) {
        return e3((e4) => t3.fire(e4));
      }, t2.runAndSubscribe = function(e3, t3) {
        return t3(undefined), e3((e4) => t3(e4));
      };
    }, 435: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o2 = e3.length - 1;o2 >= 0; o2--)
            (r3 = e3[o2]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.InputHandler = t2.WindowsOptionsReportType = undefined;
      const n2 = i2(584), a = i2(116), o = i2(15), h = i2(844), c = i2(482), l = i2(437), _ = i2(460), d = i2(643), f = i2(511), u = i2(734), p = i2(585), g = i2(480), v = i2(242), b = i2(351), S = i2(941), m = { "(": 0, ")": 1, "*": 2, "+": 3, "-": 1, ".": 2 }, C = 131072;
      function y(e3, t3) {
        if (e3 > 24)
          return t3.setWinLines || false;
        switch (e3) {
          case 1:
            return !!t3.restoreWin;
          case 2:
            return !!t3.minimizeWin;
          case 3:
            return !!t3.setWinPosition;
          case 4:
            return !!t3.setWinSizePixels;
          case 5:
            return !!t3.raiseWin;
          case 6:
            return !!t3.lowerWin;
          case 7:
            return !!t3.refreshWin;
          case 8:
            return !!t3.setWinSizeChars;
          case 9:
            return !!t3.maximizeWin;
          case 10:
            return !!t3.fullscreenWin;
          case 11:
            return !!t3.getWinState;
          case 13:
            return !!t3.getWinPosition;
          case 14:
            return !!t3.getWinSizePixels;
          case 15:
            return !!t3.getScreenSizePixels;
          case 16:
            return !!t3.getCellSizePixels;
          case 18:
            return !!t3.getWinSizeChars;
          case 19:
            return !!t3.getScreenSizeChars;
          case 20:
            return !!t3.getIconTitle;
          case 21:
            return !!t3.getWinTitle;
          case 22:
            return !!t3.pushTitle;
          case 23:
            return !!t3.popTitle;
          case 24:
            return !!t3.setWinLines;
        }
        return false;
      }
      var w;
      (function(e3) {
        e3[e3.GET_WIN_SIZE_PIXELS = 0] = "GET_WIN_SIZE_PIXELS", e3[e3.GET_CELL_SIZE_PIXELS = 1] = "GET_CELL_SIZE_PIXELS";
      })(w || (t2.WindowsOptionsReportType = w = {}));
      let B = 0;

      class E extends h.Disposable {
        getAttrData() {
          return this._curAttrData;
        }
        constructor(e3, t3, i3, s3, r3, h2, d2, u2, p2 = new o.EscapeSequenceParser) {
          super(), this._bufferService = e3, this._charsetService = t3, this._coreService = i3, this._logService = s3, this._optionsService = r3, this._oscLinkService = h2, this._coreMouseService = d2, this._unicodeService = u2, this._parser = p2, this._parseBuffer = new Uint32Array(4096), this._stringDecoder = new c.StringToUtf32, this._utf8Decoder = new c.Utf8ToUtf32, this._workCell = new f.CellData, this._windowTitle = "", this._iconName = "", this._windowTitleStack = [], this._iconNameStack = [], this._curAttrData = l.DEFAULT_ATTR_DATA.clone(), this._eraseAttrDataInternal = l.DEFAULT_ATTR_DATA.clone(), this._onRequestBell = this.register(new _.EventEmitter), this.onRequestBell = this._onRequestBell.event, this._onRequestRefreshRows = this.register(new _.EventEmitter), this.onRequestRefreshRows = this._onRequestRefreshRows.event, this._onRequestReset = this.register(new _.EventEmitter), this.onRequestReset = this._onRequestReset.event, this._onRequestSendFocus = this.register(new _.EventEmitter), this.onRequestSendFocus = this._onRequestSendFocus.event, this._onRequestSyncScrollBar = this.register(new _.EventEmitter), this.onRequestSyncScrollBar = this._onRequestSyncScrollBar.event, this._onRequestWindowsOptionsReport = this.register(new _.EventEmitter), this.onRequestWindowsOptionsReport = this._onRequestWindowsOptionsReport.event, this._onA11yChar = this.register(new _.EventEmitter), this.onA11yChar = this._onA11yChar.event, this._onA11yTab = this.register(new _.EventEmitter), this.onA11yTab = this._onA11yTab.event, this._onCursorMove = this.register(new _.EventEmitter), this.onCursorMove = this._onCursorMove.event, this._onLineFeed = this.register(new _.EventEmitter), this.onLineFeed = this._onLineFeed.event, this._onScroll = this.register(new _.EventEmitter), this.onScroll = this._onScroll.event, this._onTitleChange = this.register(new _.EventEmitter), this.onTitleChange = this._onTitleChange.event, this._onColor = this.register(new _.EventEmitter), this.onColor = this._onColor.event, this._parseStack = { paused: false, cursorStartX: 0, cursorStartY: 0, decodedLength: 0, position: 0 }, this._specialColors = [256, 257, 258], this.register(this._parser), this._dirtyRowTracker = new A(this._bufferService), this._activeBuffer = this._bufferService.buffer, this.register(this._bufferService.buffers.onBufferActivate((e4) => this._activeBuffer = e4.activeBuffer)), this._parser.setCsiHandlerFallback((e4, t4) => {
            this._logService.debug("Unknown CSI code: ", { identifier: this._parser.identToString(e4), params: t4.toArray() });
          }), this._parser.setEscHandlerFallback((e4) => {
            this._logService.debug("Unknown ESC code: ", { identifier: this._parser.identToString(e4) });
          }), this._parser.setExecuteHandlerFallback((e4) => {
            this._logService.debug("Unknown EXECUTE code: ", { code: e4 });
          }), this._parser.setOscHandlerFallback((e4, t4, i4) => {
            this._logService.debug("Unknown OSC code: ", { identifier: e4, action: t4, data: i4 });
          }), this._parser.setDcsHandlerFallback((e4, t4, i4) => {
            t4 === "HOOK" && (i4 = i4.toArray()), this._logService.debug("Unknown DCS code: ", { identifier: this._parser.identToString(e4), action: t4, payload: i4 });
          }), this._parser.setPrintHandler((e4, t4, i4) => this.print(e4, t4, i4)), this._parser.registerCsiHandler({ final: "@" }, (e4) => this.insertChars(e4)), this._parser.registerCsiHandler({ intermediates: " ", final: "@" }, (e4) => this.scrollLeft(e4)), this._parser.registerCsiHandler({ final: "A" }, (e4) => this.cursorUp(e4)), this._parser.registerCsiHandler({ intermediates: " ", final: "A" }, (e4) => this.scrollRight(e4)), this._parser.registerCsiHandler({ final: "B" }, (e4) => this.cursorDown(e4)), this._parser.registerCsiHandler({ final: "C" }, (e4) => this.cursorForward(e4)), this._parser.registerCsiHandler({ final: "D" }, (e4) => this.cursorBackward(e4)), this._parser.registerCsiHandler({ final: "E" }, (e4) => this.cursorNextLine(e4)), this._parser.registerCsiHandler({ final: "F" }, (e4) => this.cursorPrecedingLine(e4)), this._parser.registerCsiHandler({ final: "G" }, (e4) => this.cursorCharAbsolute(e4)), this._parser.registerCsiHandler({ final: "H" }, (e4) => this.cursorPosition(e4)), this._parser.registerCsiHandler({ final: "I" }, (e4) => this.cursorForwardTab(e4)), this._parser.registerCsiHandler({ final: "J" }, (e4) => this.eraseInDisplay(e4, false)), this._parser.registerCsiHandler({ prefix: "?", final: "J" }, (e4) => this.eraseInDisplay(e4, true)), this._parser.registerCsiHandler({ final: "K" }, (e4) => this.eraseInLine(e4, false)), this._parser.registerCsiHandler({ prefix: "?", final: "K" }, (e4) => this.eraseInLine(e4, true)), this._parser.registerCsiHandler({ final: "L" }, (e4) => this.insertLines(e4)), this._parser.registerCsiHandler({ final: "M" }, (e4) => this.deleteLines(e4)), this._parser.registerCsiHandler({ final: "P" }, (e4) => this.deleteChars(e4)), this._parser.registerCsiHandler({ final: "S" }, (e4) => this.scrollUp(e4)), this._parser.registerCsiHandler({ final: "T" }, (e4) => this.scrollDown(e4)), this._parser.registerCsiHandler({ final: "X" }, (e4) => this.eraseChars(e4)), this._parser.registerCsiHandler({ final: "Z" }, (e4) => this.cursorBackwardTab(e4)), this._parser.registerCsiHandler({ final: "`" }, (e4) => this.charPosAbsolute(e4)), this._parser.registerCsiHandler({ final: "a" }, (e4) => this.hPositionRelative(e4)), this._parser.registerCsiHandler({ final: "b" }, (e4) => this.repeatPrecedingCharacter(e4)), this._parser.registerCsiHandler({ final: "c" }, (e4) => this.sendDeviceAttributesPrimary(e4)), this._parser.registerCsiHandler({ prefix: ">", final: "c" }, (e4) => this.sendDeviceAttributesSecondary(e4)), this._parser.registerCsiHandler({ final: "d" }, (e4) => this.linePosAbsolute(e4)), this._parser.registerCsiHandler({ final: "e" }, (e4) => this.vPositionRelative(e4)), this._parser.registerCsiHandler({ final: "f" }, (e4) => this.hVPosition(e4)), this._parser.registerCsiHandler({ final: "g" }, (e4) => this.tabClear(e4)), this._parser.registerCsiHandler({ final: "h" }, (e4) => this.setMode(e4)), this._parser.registerCsiHandler({ prefix: "?", final: "h" }, (e4) => this.setModePrivate(e4)), this._parser.registerCsiHandler({ final: "l" }, (e4) => this.resetMode(e4)), this._parser.registerCsiHandler({ prefix: "?", final: "l" }, (e4) => this.resetModePrivate(e4)), this._parser.registerCsiHandler({ final: "m" }, (e4) => this.charAttributes(e4)), this._parser.registerCsiHandler({ final: "n" }, (e4) => this.deviceStatus(e4)), this._parser.registerCsiHandler({ prefix: "?", final: "n" }, (e4) => this.deviceStatusPrivate(e4)), this._parser.registerCsiHandler({ intermediates: "!", final: "p" }, (e4) => this.softReset(e4)), this._parser.registerCsiHandler({ intermediates: " ", final: "q" }, (e4) => this.setCursorStyle(e4)), this._parser.registerCsiHandler({ final: "r" }, (e4) => this.setScrollRegion(e4)), this._parser.registerCsiHandler({ final: "s" }, (e4) => this.saveCursor(e4)), this._parser.registerCsiHandler({ final: "t" }, (e4) => this.windowOptions(e4)), this._parser.registerCsiHandler({ final: "u" }, (e4) => this.restoreCursor(e4)), this._parser.registerCsiHandler({ intermediates: "'", final: "}" }, (e4) => this.insertColumns(e4)), this._parser.registerCsiHandler({ intermediates: "'", final: "~" }, (e4) => this.deleteColumns(e4)), this._parser.registerCsiHandler({ intermediates: '"', final: "q" }, (e4) => this.selectProtected(e4)), this._parser.registerCsiHandler({ intermediates: "$", final: "p" }, (e4) => this.requestMode(e4, true)), this._parser.registerCsiHandler({ prefix: "?", intermediates: "$", final: "p" }, (e4) => this.requestMode(e4, false)), this._parser.setExecuteHandler(n2.C0.BEL, () => this.bell()), this._parser.setExecuteHandler(n2.C0.LF, () => this.lineFeed()), this._parser.setExecuteHandler(n2.C0.VT, () => this.lineFeed()), this._parser.setExecuteHandler(n2.C0.FF, () => this.lineFeed()), this._parser.setExecuteHandler(n2.C0.CR, () => this.carriageReturn()), this._parser.setExecuteHandler(n2.C0.BS, () => this.backspace()), this._parser.setExecuteHandler(n2.C0.HT, () => this.tab()), this._parser.setExecuteHandler(n2.C0.SO, () => this.shiftOut()), this._parser.setExecuteHandler(n2.C0.SI, () => this.shiftIn()), this._parser.setExecuteHandler(n2.C1.IND, () => this.index()), this._parser.setExecuteHandler(n2.C1.NEL, () => this.nextLine()), this._parser.setExecuteHandler(n2.C1.HTS, () => this.tabSet()), this._parser.registerOscHandler(0, new v.OscHandler((e4) => (this.setTitle(e4), this.setIconName(e4), true))), this._parser.registerOscHandler(1, new v.OscHandler((e4) => this.setIconName(e4))), this._parser.registerOscHandler(2, new v.OscHandler((e4) => this.setTitle(e4))), this._parser.registerOscHandler(4, new v.OscHandler((e4) => this.setOrReportIndexedColor(e4))), this._parser.registerOscHandler(8, new v.OscHandler((e4) => this.setHyperlink(e4))), this._parser.registerOscHandler(10, new v.OscHandler((e4) => this.setOrReportFgColor(e4))), this._parser.registerOscHandler(11, new v.OscHandler((e4) => this.setOrReportBgColor(e4))), this._parser.registerOscHandler(12, new v.OscHandler((e4) => this.setOrReportCursorColor(e4))), this._parser.registerOscHandler(104, new v.OscHandler((e4) => this.restoreIndexedColor(e4))), this._parser.registerOscHandler(110, new v.OscHandler((e4) => this.restoreFgColor(e4))), this._parser.registerOscHandler(111, new v.OscHandler((e4) => this.restoreBgColor(e4))), this._parser.registerOscHandler(112, new v.OscHandler((e4) => this.restoreCursorColor(e4))), this._parser.registerEscHandler({ final: "7" }, () => this.saveCursor()), this._parser.registerEscHandler({ final: "8" }, () => this.restoreCursor()), this._parser.registerEscHandler({ final: "D" }, () => this.index()), this._parser.registerEscHandler({ final: "E" }, () => this.nextLine()), this._parser.registerEscHandler({ final: "H" }, () => this.tabSet()), this._parser.registerEscHandler({ final: "M" }, () => this.reverseIndex()), this._parser.registerEscHandler({ final: "=" }, () => this.keypadApplicationMode()), this._parser.registerEscHandler({ final: ">" }, () => this.keypadNumericMode()), this._parser.registerEscHandler({ final: "c" }, () => this.fullReset()), this._parser.registerEscHandler({ final: "n" }, () => this.setgLevel(2)), this._parser.registerEscHandler({ final: "o" }, () => this.setgLevel(3)), this._parser.registerEscHandler({ final: "|" }, () => this.setgLevel(3)), this._parser.registerEscHandler({ final: "}" }, () => this.setgLevel(2)), this._parser.registerEscHandler({ final: "~" }, () => this.setgLevel(1)), this._parser.registerEscHandler({ intermediates: "%", final: "@" }, () => this.selectDefaultCharset()), this._parser.registerEscHandler({ intermediates: "%", final: "G" }, () => this.selectDefaultCharset());
          for (const e4 in a.CHARSETS)
            this._parser.registerEscHandler({ intermediates: "(", final: e4 }, () => this.selectCharset("(" + e4)), this._parser.registerEscHandler({ intermediates: ")", final: e4 }, () => this.selectCharset(")" + e4)), this._parser.registerEscHandler({ intermediates: "*", final: e4 }, () => this.selectCharset("*" + e4)), this._parser.registerEscHandler({ intermediates: "+", final: e4 }, () => this.selectCharset("+" + e4)), this._parser.registerEscHandler({ intermediates: "-", final: e4 }, () => this.selectCharset("-" + e4)), this._parser.registerEscHandler({ intermediates: ".", final: e4 }, () => this.selectCharset("." + e4)), this._parser.registerEscHandler({ intermediates: "/", final: e4 }, () => this.selectCharset("/" + e4));
          this._parser.registerEscHandler({ intermediates: "#", final: "8" }, () => this.screenAlignmentPattern()), this._parser.setErrorHandler((e4) => (this._logService.error("Parsing error: ", e4), e4)), this._parser.registerDcsHandler({ intermediates: "$", final: "q" }, new b.DcsHandler((e4, t4) => this.requestStatusString(e4, t4)));
        }
        _preserveStack(e3, t3, i3, s3) {
          this._parseStack.paused = true, this._parseStack.cursorStartX = e3, this._parseStack.cursorStartY = t3, this._parseStack.decodedLength = i3, this._parseStack.position = s3;
        }
        _logSlowResolvingAsync(e3) {
          this._logService.logLevel <= p.LogLevelEnum.WARN && Promise.race([e3, new Promise((e4, t3) => setTimeout(() => t3("#SLOW_TIMEOUT"), 5000))]).catch((e4) => {
            if (e4 !== "#SLOW_TIMEOUT")
              throw e4;
            console.warn("async parser handler taking longer than 5000 ms");
          });
        }
        _getCurrentLinkId() {
          return this._curAttrData.extended.urlId;
        }
        parse(e3, t3) {
          let i3, s3 = this._activeBuffer.x, r3 = this._activeBuffer.y, n3 = 0;
          const a2 = this._parseStack.paused;
          if (a2) {
            if (i3 = this._parser.parse(this._parseBuffer, this._parseStack.decodedLength, t3))
              return this._logSlowResolvingAsync(i3), i3;
            s3 = this._parseStack.cursorStartX, r3 = this._parseStack.cursorStartY, this._parseStack.paused = false, e3.length > C && (n3 = this._parseStack.position + C);
          }
          if (this._logService.logLevel <= p.LogLevelEnum.DEBUG && this._logService.debug("parsing data" + (typeof e3 == "string" ? ` "${e3}"` : ` "${Array.prototype.map.call(e3, (e4) => String.fromCharCode(e4)).join("")}"`), typeof e3 == "string" ? e3.split("").map((e4) => e4.charCodeAt(0)) : e3), this._parseBuffer.length < e3.length && this._parseBuffer.length < C && (this._parseBuffer = new Uint32Array(Math.min(e3.length, C))), a2 || this._dirtyRowTracker.clearRange(), e3.length > C)
            for (let t4 = n3;t4 < e3.length; t4 += C) {
              const n4 = t4 + C < e3.length ? t4 + C : e3.length, a3 = typeof e3 == "string" ? this._stringDecoder.decode(e3.substring(t4, n4), this._parseBuffer) : this._utf8Decoder.decode(e3.subarray(t4, n4), this._parseBuffer);
              if (i3 = this._parser.parse(this._parseBuffer, a3))
                return this._preserveStack(s3, r3, a3, t4), this._logSlowResolvingAsync(i3), i3;
            }
          else if (!a2) {
            const t4 = typeof e3 == "string" ? this._stringDecoder.decode(e3, this._parseBuffer) : this._utf8Decoder.decode(e3, this._parseBuffer);
            if (i3 = this._parser.parse(this._parseBuffer, t4))
              return this._preserveStack(s3, r3, t4, 0), this._logSlowResolvingAsync(i3), i3;
          }
          this._activeBuffer.x === s3 && this._activeBuffer.y === r3 || this._onCursorMove.fire();
          const o2 = this._dirtyRowTracker.end + (this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp), h2 = this._dirtyRowTracker.start + (this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp);
          h2 < this._bufferService.rows && this._onRequestRefreshRows.fire(Math.min(h2, this._bufferService.rows - 1), Math.min(o2, this._bufferService.rows - 1));
        }
        print(e3, t3, i3) {
          let s3, r3;
          const n3 = this._charsetService.charset, a2 = this._optionsService.rawOptions.screenReaderMode, o2 = this._bufferService.cols, h2 = this._coreService.decPrivateModes.wraparound, _2 = this._coreService.modes.insertMode, f2 = this._curAttrData;
          let u2 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
          this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._activeBuffer.x && i3 - t3 > 0 && u2.getWidth(this._activeBuffer.x - 1) === 2 && u2.setCellFromCodepoint(this._activeBuffer.x - 1, 0, 1, f2);
          let p2 = this._parser.precedingJoinState;
          for (let v2 = t3;v2 < i3; ++v2) {
            if (s3 = e3[v2], s3 < 127 && n3) {
              const e4 = n3[String.fromCharCode(s3)];
              e4 && (s3 = e4.charCodeAt(0));
            }
            const t4 = this._unicodeService.charProperties(s3, p2);
            r3 = g.UnicodeService.extractWidth(t4);
            const i4 = g.UnicodeService.extractShouldJoin(t4), b2 = i4 ? g.UnicodeService.extractWidth(p2) : 0;
            if (p2 = t4, a2 && this._onA11yChar.fire((0, c.stringFromCodePoint)(s3)), this._getCurrentLinkId() && this._oscLinkService.addLineToLink(this._getCurrentLinkId(), this._activeBuffer.ybase + this._activeBuffer.y), this._activeBuffer.x + r3 - b2 > o2) {
              if (h2) {
                const e4 = u2;
                let t5 = this._activeBuffer.x - b2;
                for (this._activeBuffer.x = b2, this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData(), true)) : (this._activeBuffer.y >= this._bufferService.rows && (this._activeBuffer.y = this._bufferService.rows - 1), this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = true), u2 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y), b2 > 0 && u2 instanceof l.BufferLine && u2.copyCellsFrom(e4, t5, 0, b2, false);t5 < o2; )
                  e4.setCellFromCodepoint(t5++, 0, 1, f2);
              } else if (this._activeBuffer.x = o2 - 1, r3 === 2)
                continue;
            }
            if (i4 && this._activeBuffer.x) {
              const e4 = u2.getWidth(this._activeBuffer.x - 1) ? 1 : 2;
              u2.addCodepointToCell(this._activeBuffer.x - e4, s3, r3);
              for (let e5 = r3 - b2;--e5 >= 0; )
                u2.setCellFromCodepoint(this._activeBuffer.x++, 0, 0, f2);
            } else if (_2 && (u2.insertCells(this._activeBuffer.x, r3 - b2, this._activeBuffer.getNullCell(f2)), u2.getWidth(o2 - 1) === 2 && u2.setCellFromCodepoint(o2 - 1, d.NULL_CELL_CODE, d.NULL_CELL_WIDTH, f2)), u2.setCellFromCodepoint(this._activeBuffer.x++, s3, r3, f2), r3 > 0)
              for (;--r3; )
                u2.setCellFromCodepoint(this._activeBuffer.x++, 0, 0, f2);
          }
          this._parser.precedingJoinState = p2, this._activeBuffer.x < o2 && i3 - t3 > 0 && u2.getWidth(this._activeBuffer.x) === 0 && !u2.hasContent(this._activeBuffer.x) && u2.setCellFromCodepoint(this._activeBuffer.x, 0, 1, f2), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
        }
        registerCsiHandler(e3, t3) {
          return e3.final !== "t" || e3.prefix || e3.intermediates ? this._parser.registerCsiHandler(e3, t3) : this._parser.registerCsiHandler(e3, (e4) => !y(e4.params[0], this._optionsService.rawOptions.windowOptions) || t3(e4));
        }
        registerDcsHandler(e3, t3) {
          return this._parser.registerDcsHandler(e3, new b.DcsHandler(t3));
        }
        registerEscHandler(e3, t3) {
          return this._parser.registerEscHandler(e3, t3);
        }
        registerOscHandler(e3, t3) {
          return this._parser.registerOscHandler(e3, new v.OscHandler(t3));
        }
        bell() {
          return this._onRequestBell.fire(), true;
        }
        lineFeed() {
          return this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._optionsService.rawOptions.convertEol && (this._activeBuffer.x = 0), this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData())) : this._activeBuffer.y >= this._bufferService.rows ? this._activeBuffer.y = this._bufferService.rows - 1 : this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = false, this._activeBuffer.x >= this._bufferService.cols && this._activeBuffer.x--, this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._onLineFeed.fire(), true;
        }
        carriageReturn() {
          return this._activeBuffer.x = 0, true;
        }
        backspace() {
          if (!this._coreService.decPrivateModes.reverseWraparound)
            return this._restrictCursor(), this._activeBuffer.x > 0 && this._activeBuffer.x--, true;
          if (this._restrictCursor(this._bufferService.cols), this._activeBuffer.x > 0)
            this._activeBuffer.x--;
          else if (this._activeBuffer.x === 0 && this._activeBuffer.y > this._activeBuffer.scrollTop && this._activeBuffer.y <= this._activeBuffer.scrollBottom && this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y)?.isWrapped) {
            this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = false, this._activeBuffer.y--, this._activeBuffer.x = this._bufferService.cols - 1;
            const e3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
            e3.hasWidth(this._activeBuffer.x) && !e3.hasContent(this._activeBuffer.x) && this._activeBuffer.x--;
          }
          return this._restrictCursor(), true;
        }
        tab() {
          if (this._activeBuffer.x >= this._bufferService.cols)
            return true;
          const e3 = this._activeBuffer.x;
          return this._activeBuffer.x = this._activeBuffer.nextStop(), this._optionsService.rawOptions.screenReaderMode && this._onA11yTab.fire(this._activeBuffer.x - e3), true;
        }
        shiftOut() {
          return this._charsetService.setgLevel(1), true;
        }
        shiftIn() {
          return this._charsetService.setgLevel(0), true;
        }
        _restrictCursor(e3 = this._bufferService.cols - 1) {
          this._activeBuffer.x = Math.min(e3, Math.max(0, this._activeBuffer.x)), this._activeBuffer.y = this._coreService.decPrivateModes.origin ? Math.min(this._activeBuffer.scrollBottom, Math.max(this._activeBuffer.scrollTop, this._activeBuffer.y)) : Math.min(this._bufferService.rows - 1, Math.max(0, this._activeBuffer.y)), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
        }
        _setCursor(e3, t3) {
          this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._coreService.decPrivateModes.origin ? (this._activeBuffer.x = e3, this._activeBuffer.y = this._activeBuffer.scrollTop + t3) : (this._activeBuffer.x = e3, this._activeBuffer.y = t3), this._restrictCursor(), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
        }
        _moveCursor(e3, t3) {
          this._restrictCursor(), this._setCursor(this._activeBuffer.x + e3, this._activeBuffer.y + t3);
        }
        cursorUp(e3) {
          const t3 = this._activeBuffer.y - this._activeBuffer.scrollTop;
          return t3 >= 0 ? this._moveCursor(0, -Math.min(t3, e3.params[0] || 1)) : this._moveCursor(0, -(e3.params[0] || 1)), true;
        }
        cursorDown(e3) {
          const t3 = this._activeBuffer.scrollBottom - this._activeBuffer.y;
          return t3 >= 0 ? this._moveCursor(0, Math.min(t3, e3.params[0] || 1)) : this._moveCursor(0, e3.params[0] || 1), true;
        }
        cursorForward(e3) {
          return this._moveCursor(e3.params[0] || 1, 0), true;
        }
        cursorBackward(e3) {
          return this._moveCursor(-(e3.params[0] || 1), 0), true;
        }
        cursorNextLine(e3) {
          return this.cursorDown(e3), this._activeBuffer.x = 0, true;
        }
        cursorPrecedingLine(e3) {
          return this.cursorUp(e3), this._activeBuffer.x = 0, true;
        }
        cursorCharAbsolute(e3) {
          return this._setCursor((e3.params[0] || 1) - 1, this._activeBuffer.y), true;
        }
        cursorPosition(e3) {
          return this._setCursor(e3.length >= 2 ? (e3.params[1] || 1) - 1 : 0, (e3.params[0] || 1) - 1), true;
        }
        charPosAbsolute(e3) {
          return this._setCursor((e3.params[0] || 1) - 1, this._activeBuffer.y), true;
        }
        hPositionRelative(e3) {
          return this._moveCursor(e3.params[0] || 1, 0), true;
        }
        linePosAbsolute(e3) {
          return this._setCursor(this._activeBuffer.x, (e3.params[0] || 1) - 1), true;
        }
        vPositionRelative(e3) {
          return this._moveCursor(0, e3.params[0] || 1), true;
        }
        hVPosition(e3) {
          return this.cursorPosition(e3), true;
        }
        tabClear(e3) {
          const t3 = e3.params[0];
          return t3 === 0 ? delete this._activeBuffer.tabs[this._activeBuffer.x] : t3 === 3 && (this._activeBuffer.tabs = {}), true;
        }
        cursorForwardTab(e3) {
          if (this._activeBuffer.x >= this._bufferService.cols)
            return true;
          let t3 = e3.params[0] || 1;
          for (;t3--; )
            this._activeBuffer.x = this._activeBuffer.nextStop();
          return true;
        }
        cursorBackwardTab(e3) {
          if (this._activeBuffer.x >= this._bufferService.cols)
            return true;
          let t3 = e3.params[0] || 1;
          for (;t3--; )
            this._activeBuffer.x = this._activeBuffer.prevStop();
          return true;
        }
        selectProtected(e3) {
          const t3 = e3.params[0];
          return t3 === 1 && (this._curAttrData.bg |= 536870912), t3 !== 2 && t3 !== 0 || (this._curAttrData.bg &= -536870913), true;
        }
        _eraseInBufferLine(e3, t3, i3, s3 = false, r3 = false) {
          const n3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e3);
          n3.replaceCells(t3, i3, this._activeBuffer.getNullCell(this._eraseAttrData()), r3), s3 && (n3.isWrapped = false);
        }
        _resetBufferLine(e3, t3 = false) {
          const i3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e3);
          i3 && (i3.fill(this._activeBuffer.getNullCell(this._eraseAttrData()), t3), this._bufferService.buffer.clearMarkers(this._activeBuffer.ybase + e3), i3.isWrapped = false);
        }
        eraseInDisplay(e3, t3 = false) {
          let i3;
          switch (this._restrictCursor(this._bufferService.cols), e3.params[0]) {
            case 0:
              for (i3 = this._activeBuffer.y, this._dirtyRowTracker.markDirty(i3), this._eraseInBufferLine(i3++, this._activeBuffer.x, this._bufferService.cols, this._activeBuffer.x === 0, t3);i3 < this._bufferService.rows; i3++)
                this._resetBufferLine(i3, t3);
              this._dirtyRowTracker.markDirty(i3);
              break;
            case 1:
              for (i3 = this._activeBuffer.y, this._dirtyRowTracker.markDirty(i3), this._eraseInBufferLine(i3, 0, this._activeBuffer.x + 1, true, t3), this._activeBuffer.x + 1 >= this._bufferService.cols && (this._activeBuffer.lines.get(i3 + 1).isWrapped = false);i3--; )
                this._resetBufferLine(i3, t3);
              this._dirtyRowTracker.markDirty(0);
              break;
            case 2:
              for (i3 = this._bufferService.rows, this._dirtyRowTracker.markDirty(i3 - 1);i3--; )
                this._resetBufferLine(i3, t3);
              this._dirtyRowTracker.markDirty(0);
              break;
            case 3:
              const e4 = this._activeBuffer.lines.length - this._bufferService.rows;
              e4 > 0 && (this._activeBuffer.lines.trimStart(e4), this._activeBuffer.ybase = Math.max(this._activeBuffer.ybase - e4, 0), this._activeBuffer.ydisp = Math.max(this._activeBuffer.ydisp - e4, 0), this._onScroll.fire(0));
          }
          return true;
        }
        eraseInLine(e3, t3 = false) {
          switch (this._restrictCursor(this._bufferService.cols), e3.params[0]) {
            case 0:
              this._eraseInBufferLine(this._activeBuffer.y, this._activeBuffer.x, this._bufferService.cols, this._activeBuffer.x === 0, t3);
              break;
            case 1:
              this._eraseInBufferLine(this._activeBuffer.y, 0, this._activeBuffer.x + 1, false, t3);
              break;
            case 2:
              this._eraseInBufferLine(this._activeBuffer.y, 0, this._bufferService.cols, true, t3);
          }
          return this._dirtyRowTracker.markDirty(this._activeBuffer.y), true;
        }
        insertLines(e3) {
          this._restrictCursor();
          let t3 = e3.params[0] || 1;
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const i3 = this._activeBuffer.ybase + this._activeBuffer.y, s3 = this._bufferService.rows - 1 - this._activeBuffer.scrollBottom, r3 = this._bufferService.rows - 1 + this._activeBuffer.ybase - s3 + 1;
          for (;t3--; )
            this._activeBuffer.lines.splice(r3 - 1, 1), this._activeBuffer.lines.splice(i3, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y, this._activeBuffer.scrollBottom), this._activeBuffer.x = 0, true;
        }
        deleteLines(e3) {
          this._restrictCursor();
          let t3 = e3.params[0] || 1;
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const i3 = this._activeBuffer.ybase + this._activeBuffer.y;
          let s3;
          for (s3 = this._bufferService.rows - 1 - this._activeBuffer.scrollBottom, s3 = this._bufferService.rows - 1 + this._activeBuffer.ybase - s3;t3--; )
            this._activeBuffer.lines.splice(i3, 1), this._activeBuffer.lines.splice(s3, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y, this._activeBuffer.scrollBottom), this._activeBuffer.x = 0, true;
        }
        insertChars(e3) {
          this._restrictCursor();
          const t3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
          return t3 && (t3.insertCells(this._activeBuffer.x, e3.params[0] || 1, this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), true;
        }
        deleteChars(e3) {
          this._restrictCursor();
          const t3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
          return t3 && (t3.deleteCells(this._activeBuffer.x, e3.params[0] || 1, this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), true;
        }
        scrollUp(e3) {
          let t3 = e3.params[0] || 1;
          for (;t3--; )
            this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollTop, 1), this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollBottom, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        scrollDown(e3) {
          let t3 = e3.params[0] || 1;
          for (;t3--; )
            this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollBottom, 1), this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollTop, 0, this._activeBuffer.getBlankLine(l.DEFAULT_ATTR_DATA));
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        scrollLeft(e3) {
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const t3 = e3.params[0] || 1;
          for (let e4 = this._activeBuffer.scrollTop;e4 <= this._activeBuffer.scrollBottom; ++e4) {
            const i3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e4);
            i3.deleteCells(0, t3, this._activeBuffer.getNullCell(this._eraseAttrData())), i3.isWrapped = false;
          }
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        scrollRight(e3) {
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const t3 = e3.params[0] || 1;
          for (let e4 = this._activeBuffer.scrollTop;e4 <= this._activeBuffer.scrollBottom; ++e4) {
            const i3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e4);
            i3.insertCells(0, t3, this._activeBuffer.getNullCell(this._eraseAttrData())), i3.isWrapped = false;
          }
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        insertColumns(e3) {
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const t3 = e3.params[0] || 1;
          for (let e4 = this._activeBuffer.scrollTop;e4 <= this._activeBuffer.scrollBottom; ++e4) {
            const i3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e4);
            i3.insertCells(this._activeBuffer.x, t3, this._activeBuffer.getNullCell(this._eraseAttrData())), i3.isWrapped = false;
          }
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        deleteColumns(e3) {
          if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop)
            return true;
          const t3 = e3.params[0] || 1;
          for (let e4 = this._activeBuffer.scrollTop;e4 <= this._activeBuffer.scrollBottom; ++e4) {
            const i3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + e4);
            i3.deleteCells(this._activeBuffer.x, t3, this._activeBuffer.getNullCell(this._eraseAttrData())), i3.isWrapped = false;
          }
          return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), true;
        }
        eraseChars(e3) {
          this._restrictCursor();
          const t3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
          return t3 && (t3.replaceCells(this._activeBuffer.x, this._activeBuffer.x + (e3.params[0] || 1), this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), true;
        }
        repeatPrecedingCharacter(e3) {
          const t3 = this._parser.precedingJoinState;
          if (!t3)
            return true;
          const i3 = e3.params[0] || 1, s3 = g.UnicodeService.extractWidth(t3), r3 = this._activeBuffer.x - s3, n3 = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).getString(r3), a2 = new Uint32Array(n3.length * i3);
          let o2 = 0;
          for (let e4 = 0;e4 < n3.length; ) {
            const t4 = n3.codePointAt(e4) || 0;
            a2[o2++] = t4, e4 += t4 > 65535 ? 2 : 1;
          }
          let h2 = o2;
          for (let e4 = 1;e4 < i3; ++e4)
            a2.copyWithin(h2, 0, o2), h2 += o2;
          return this.print(a2, 0, h2), true;
        }
        sendDeviceAttributesPrimary(e3) {
          return e3.params[0] > 0 || (this._is("xterm") || this._is("rxvt-unicode") || this._is("screen") ? this._coreService.triggerDataEvent(n2.C0.ESC + "[?1;2c") : this._is("linux") && this._coreService.triggerDataEvent(n2.C0.ESC + "[?6c")), true;
        }
        sendDeviceAttributesSecondary(e3) {
          return e3.params[0] > 0 || (this._is("xterm") ? this._coreService.triggerDataEvent(n2.C0.ESC + "[>0;276;0c") : this._is("rxvt-unicode") ? this._coreService.triggerDataEvent(n2.C0.ESC + "[>85;95;0c") : this._is("linux") ? this._coreService.triggerDataEvent(e3.params[0] + "c") : this._is("screen") && this._coreService.triggerDataEvent(n2.C0.ESC + "[>83;40003;0c")), true;
        }
        _is(e3) {
          return (this._optionsService.rawOptions.termName + "").indexOf(e3) === 0;
        }
        setMode(e3) {
          for (let t3 = 0;t3 < e3.length; t3++)
            switch (e3.params[t3]) {
              case 4:
                this._coreService.modes.insertMode = true;
                break;
              case 20:
                this._optionsService.options.convertEol = true;
            }
          return true;
        }
        setModePrivate(e3) {
          for (let t3 = 0;t3 < e3.length; t3++)
            switch (e3.params[t3]) {
              case 1:
                this._coreService.decPrivateModes.applicationCursorKeys = true;
                break;
              case 2:
                this._charsetService.setgCharset(0, a.DEFAULT_CHARSET), this._charsetService.setgCharset(1, a.DEFAULT_CHARSET), this._charsetService.setgCharset(2, a.DEFAULT_CHARSET), this._charsetService.setgCharset(3, a.DEFAULT_CHARSET);
                break;
              case 3:
                this._optionsService.rawOptions.windowOptions.setWinLines && (this._bufferService.resize(132, this._bufferService.rows), this._onRequestReset.fire());
                break;
              case 6:
                this._coreService.decPrivateModes.origin = true, this._setCursor(0, 0);
                break;
              case 7:
                this._coreService.decPrivateModes.wraparound = true;
                break;
              case 12:
                this._optionsService.options.cursorBlink = true;
                break;
              case 45:
                this._coreService.decPrivateModes.reverseWraparound = true;
                break;
              case 66:
                this._logService.debug("Serial port requested application keypad."), this._coreService.decPrivateModes.applicationKeypad = true, this._onRequestSyncScrollBar.fire();
                break;
              case 9:
                this._coreMouseService.activeProtocol = "X10";
                break;
              case 1000:
                this._coreMouseService.activeProtocol = "VT200";
                break;
              case 1002:
                this._coreMouseService.activeProtocol = "DRAG";
                break;
              case 1003:
                this._coreMouseService.activeProtocol = "ANY";
                break;
              case 1004:
                this._coreService.decPrivateModes.sendFocus = true, this._onRequestSendFocus.fire();
                break;
              case 1005:
                this._logService.debug("DECSET 1005 not supported (see #2507)");
                break;
              case 1006:
                this._coreMouseService.activeEncoding = "SGR";
                break;
              case 1015:
                this._logService.debug("DECSET 1015 not supported (see #2507)");
                break;
              case 1016:
                this._coreMouseService.activeEncoding = "SGR_PIXELS";
                break;
              case 25:
                this._coreService.isCursorHidden = false;
                break;
              case 1048:
                this.saveCursor();
                break;
              case 1049:
                this.saveCursor();
              case 47:
              case 1047:
                this._bufferService.buffers.activateAltBuffer(this._eraseAttrData()), this._coreService.isCursorInitialized = true, this._onRequestRefreshRows.fire(0, this._bufferService.rows - 1), this._onRequestSyncScrollBar.fire();
                break;
              case 2004:
                this._coreService.decPrivateModes.bracketedPasteMode = true;
            }
          return true;
        }
        resetMode(e3) {
          for (let t3 = 0;t3 < e3.length; t3++)
            switch (e3.params[t3]) {
              case 4:
                this._coreService.modes.insertMode = false;
                break;
              case 20:
                this._optionsService.options.convertEol = false;
            }
          return true;
        }
        resetModePrivate(e3) {
          for (let t3 = 0;t3 < e3.length; t3++)
            switch (e3.params[t3]) {
              case 1:
                this._coreService.decPrivateModes.applicationCursorKeys = false;
                break;
              case 3:
                this._optionsService.rawOptions.windowOptions.setWinLines && (this._bufferService.resize(80, this._bufferService.rows), this._onRequestReset.fire());
                break;
              case 6:
                this._coreService.decPrivateModes.origin = false, this._setCursor(0, 0);
                break;
              case 7:
                this._coreService.decPrivateModes.wraparound = false;
                break;
              case 12:
                this._optionsService.options.cursorBlink = false;
                break;
              case 45:
                this._coreService.decPrivateModes.reverseWraparound = false;
                break;
              case 66:
                this._logService.debug("Switching back to normal keypad."), this._coreService.decPrivateModes.applicationKeypad = false, this._onRequestSyncScrollBar.fire();
                break;
              case 9:
              case 1000:
              case 1002:
              case 1003:
                this._coreMouseService.activeProtocol = "NONE";
                break;
              case 1004:
                this._coreService.decPrivateModes.sendFocus = false;
                break;
              case 1005:
                this._logService.debug("DECRST 1005 not supported (see #2507)");
                break;
              case 1006:
              case 1016:
                this._coreMouseService.activeEncoding = "DEFAULT";
                break;
              case 1015:
                this._logService.debug("DECRST 1015 not supported (see #2507)");
                break;
              case 25:
                this._coreService.isCursorHidden = true;
                break;
              case 1048:
                this.restoreCursor();
                break;
              case 1049:
              case 47:
              case 1047:
                this._bufferService.buffers.activateNormalBuffer(), e3.params[t3] === 1049 && this.restoreCursor(), this._coreService.isCursorInitialized = true, this._onRequestRefreshRows.fire(0, this._bufferService.rows - 1), this._onRequestSyncScrollBar.fire();
                break;
              case 2004:
                this._coreService.decPrivateModes.bracketedPasteMode = false;
            }
          return true;
        }
        requestMode(e3, t3) {
          const i3 = this._coreService.decPrivateModes, { activeProtocol: s3, activeEncoding: r3 } = this._coreMouseService, a2 = this._coreService, { buffers: o2, cols: h2 } = this._bufferService, { active: c2, alt: l2 } = o2, _2 = this._optionsService.rawOptions, d2 = (e4) => e4 ? 1 : 2, f2 = e3.params[0];
          return u2 = f2, p2 = t3 ? f2 === 2 ? 4 : f2 === 4 ? d2(a2.modes.insertMode) : f2 === 12 ? 3 : f2 === 20 ? d2(_2.convertEol) : 0 : f2 === 1 ? d2(i3.applicationCursorKeys) : f2 === 3 ? _2.windowOptions.setWinLines ? h2 === 80 ? 2 : h2 === 132 ? 1 : 0 : 0 : f2 === 6 ? d2(i3.origin) : f2 === 7 ? d2(i3.wraparound) : f2 === 8 ? 3 : f2 === 9 ? d2(s3 === "X10") : f2 === 12 ? d2(_2.cursorBlink) : f2 === 25 ? d2(!a2.isCursorHidden) : f2 === 45 ? d2(i3.reverseWraparound) : f2 === 66 ? d2(i3.applicationKeypad) : f2 === 67 ? 4 : f2 === 1000 ? d2(s3 === "VT200") : f2 === 1002 ? d2(s3 === "DRAG") : f2 === 1003 ? d2(s3 === "ANY") : f2 === 1004 ? d2(i3.sendFocus) : f2 === 1005 ? 4 : f2 === 1006 ? d2(r3 === "SGR") : f2 === 1015 ? 4 : f2 === 1016 ? d2(r3 === "SGR_PIXELS") : f2 === 1048 ? 1 : f2 === 47 || f2 === 1047 || f2 === 1049 ? d2(c2 === l2) : f2 === 2004 ? d2(i3.bracketedPasteMode) : 0, a2.triggerDataEvent(`${n2.C0.ESC}[${t3 ? "" : "?"}${u2};${p2}$y`), true;
          var u2, p2;
        }
        _updateAttrColor(e3, t3, i3, s3, r3) {
          return t3 === 2 ? (e3 |= 50331648, e3 &= -16777216, e3 |= u.AttributeData.fromColorRGB([i3, s3, r3])) : t3 === 5 && (e3 &= -50331904, e3 |= 33554432 | 255 & i3), e3;
        }
        _extractColor(e3, t3, i3) {
          const s3 = [0, 0, -1, 0, 0, 0];
          let r3 = 0, n3 = 0;
          do {
            if (s3[n3 + r3] = e3.params[t3 + n3], e3.hasSubParams(t3 + n3)) {
              const i4 = e3.getSubParams(t3 + n3);
              let a2 = 0;
              do {
                s3[1] === 5 && (r3 = 1), s3[n3 + a2 + 1 + r3] = i4[a2];
              } while (++a2 < i4.length && a2 + n3 + 1 + r3 < s3.length);
              break;
            }
            if (s3[1] === 5 && n3 + r3 >= 2 || s3[1] === 2 && n3 + r3 >= 5)
              break;
            s3[1] && (r3 = 1);
          } while (++n3 + t3 < e3.length && n3 + r3 < s3.length);
          for (let e4 = 2;e4 < s3.length; ++e4)
            s3[e4] === -1 && (s3[e4] = 0);
          switch (s3[0]) {
            case 38:
              i3.fg = this._updateAttrColor(i3.fg, s3[1], s3[3], s3[4], s3[5]);
              break;
            case 48:
              i3.bg = this._updateAttrColor(i3.bg, s3[1], s3[3], s3[4], s3[5]);
              break;
            case 58:
              i3.extended = i3.extended.clone(), i3.extended.underlineColor = this._updateAttrColor(i3.extended.underlineColor, s3[1], s3[3], s3[4], s3[5]);
          }
          return n3;
        }
        _processUnderline(e3, t3) {
          t3.extended = t3.extended.clone(), (!~e3 || e3 > 5) && (e3 = 1), t3.extended.underlineStyle = e3, t3.fg |= 268435456, e3 === 0 && (t3.fg &= -268435457), t3.updateExtended();
        }
        _processSGR0(e3) {
          e3.fg = l.DEFAULT_ATTR_DATA.fg, e3.bg = l.DEFAULT_ATTR_DATA.bg, e3.extended = e3.extended.clone(), e3.extended.underlineStyle = 0, e3.extended.underlineColor &= -67108864, e3.updateExtended();
        }
        charAttributes(e3) {
          if (e3.length === 1 && e3.params[0] === 0)
            return this._processSGR0(this._curAttrData), true;
          const t3 = e3.length;
          let i3;
          const s3 = this._curAttrData;
          for (let r3 = 0;r3 < t3; r3++)
            i3 = e3.params[r3], i3 >= 30 && i3 <= 37 ? (s3.fg &= -50331904, s3.fg |= 16777216 | i3 - 30) : i3 >= 40 && i3 <= 47 ? (s3.bg &= -50331904, s3.bg |= 16777216 | i3 - 40) : i3 >= 90 && i3 <= 97 ? (s3.fg &= -50331904, s3.fg |= 16777224 | i3 - 90) : i3 >= 100 && i3 <= 107 ? (s3.bg &= -50331904, s3.bg |= 16777224 | i3 - 100) : i3 === 0 ? this._processSGR0(s3) : i3 === 1 ? s3.fg |= 134217728 : i3 === 3 ? s3.bg |= 67108864 : i3 === 4 ? (s3.fg |= 268435456, this._processUnderline(e3.hasSubParams(r3) ? e3.getSubParams(r3)[0] : 1, s3)) : i3 === 5 ? s3.fg |= 536870912 : i3 === 7 ? s3.fg |= 67108864 : i3 === 8 ? s3.fg |= 1073741824 : i3 === 9 ? s3.fg |= 2147483648 : i3 === 2 ? s3.bg |= 134217728 : i3 === 21 ? this._processUnderline(2, s3) : i3 === 22 ? (s3.fg &= -134217729, s3.bg &= -134217729) : i3 === 23 ? s3.bg &= -67108865 : i3 === 24 ? (s3.fg &= -268435457, this._processUnderline(0, s3)) : i3 === 25 ? s3.fg &= -536870913 : i3 === 27 ? s3.fg &= -67108865 : i3 === 28 ? s3.fg &= -1073741825 : i3 === 29 ? s3.fg &= 2147483647 : i3 === 39 ? (s3.fg &= -67108864, s3.fg |= 16777215 & l.DEFAULT_ATTR_DATA.fg) : i3 === 49 ? (s3.bg &= -67108864, s3.bg |= 16777215 & l.DEFAULT_ATTR_DATA.bg) : i3 === 38 || i3 === 48 || i3 === 58 ? r3 += this._extractColor(e3, r3, s3) : i3 === 53 ? s3.bg |= 1073741824 : i3 === 55 ? s3.bg &= -1073741825 : i3 === 59 ? (s3.extended = s3.extended.clone(), s3.extended.underlineColor = -1, s3.updateExtended()) : i3 === 100 ? (s3.fg &= -67108864, s3.fg |= 16777215 & l.DEFAULT_ATTR_DATA.fg, s3.bg &= -67108864, s3.bg |= 16777215 & l.DEFAULT_ATTR_DATA.bg) : this._logService.debug("Unknown SGR attribute: %d.", i3);
          return true;
        }
        deviceStatus(e3) {
          switch (e3.params[0]) {
            case 5:
              this._coreService.triggerDataEvent(`${n2.C0.ESC}[0n`);
              break;
            case 6:
              const e4 = this._activeBuffer.y + 1, t3 = this._activeBuffer.x + 1;
              this._coreService.triggerDataEvent(`${n2.C0.ESC}[${e4};${t3}R`);
          }
          return true;
        }
        deviceStatusPrivate(e3) {
          if (e3.params[0] === 6) {
            const e4 = this._activeBuffer.y + 1, t3 = this._activeBuffer.x + 1;
            this._coreService.triggerDataEvent(`${n2.C0.ESC}[?${e4};${t3}R`);
          }
          return true;
        }
        softReset(e3) {
          return this._coreService.isCursorHidden = false, this._onRequestSyncScrollBar.fire(), this._activeBuffer.scrollTop = 0, this._activeBuffer.scrollBottom = this._bufferService.rows - 1, this._curAttrData = l.DEFAULT_ATTR_DATA.clone(), this._coreService.reset(), this._charsetService.reset(), this._activeBuffer.savedX = 0, this._activeBuffer.savedY = this._activeBuffer.ybase, this._activeBuffer.savedCurAttrData.fg = this._curAttrData.fg, this._activeBuffer.savedCurAttrData.bg = this._curAttrData.bg, this._activeBuffer.savedCharset = this._charsetService.charset, this._coreService.decPrivateModes.origin = false, true;
        }
        setCursorStyle(e3) {
          const t3 = e3.params[0] || 1;
          switch (t3) {
            case 1:
            case 2:
              this._optionsService.options.cursorStyle = "block";
              break;
            case 3:
            case 4:
              this._optionsService.options.cursorStyle = "underline";
              break;
            case 5:
            case 6:
              this._optionsService.options.cursorStyle = "bar";
          }
          const i3 = t3 % 2 == 1;
          return this._optionsService.options.cursorBlink = i3, true;
        }
        setScrollRegion(e3) {
          const t3 = e3.params[0] || 1;
          let i3;
          return (e3.length < 2 || (i3 = e3.params[1]) > this._bufferService.rows || i3 === 0) && (i3 = this._bufferService.rows), i3 > t3 && (this._activeBuffer.scrollTop = t3 - 1, this._activeBuffer.scrollBottom = i3 - 1, this._setCursor(0, 0)), true;
        }
        windowOptions(e3) {
          if (!y(e3.params[0], this._optionsService.rawOptions.windowOptions))
            return true;
          const t3 = e3.length > 1 ? e3.params[1] : 0;
          switch (e3.params[0]) {
            case 14:
              t3 !== 2 && this._onRequestWindowsOptionsReport.fire(w.GET_WIN_SIZE_PIXELS);
              break;
            case 16:
              this._onRequestWindowsOptionsReport.fire(w.GET_CELL_SIZE_PIXELS);
              break;
            case 18:
              this._bufferService && this._coreService.triggerDataEvent(`${n2.C0.ESC}[8;${this._bufferService.rows};${this._bufferService.cols}t`);
              break;
            case 22:
              t3 !== 0 && t3 !== 2 || (this._windowTitleStack.push(this._windowTitle), this._windowTitleStack.length > 10 && this._windowTitleStack.shift()), t3 !== 0 && t3 !== 1 || (this._iconNameStack.push(this._iconName), this._iconNameStack.length > 10 && this._iconNameStack.shift());
              break;
            case 23:
              t3 !== 0 && t3 !== 2 || this._windowTitleStack.length && this.setTitle(this._windowTitleStack.pop()), t3 !== 0 && t3 !== 1 || this._iconNameStack.length && this.setIconName(this._iconNameStack.pop());
          }
          return true;
        }
        saveCursor(e3) {
          return this._activeBuffer.savedX = this._activeBuffer.x, this._activeBuffer.savedY = this._activeBuffer.ybase + this._activeBuffer.y, this._activeBuffer.savedCurAttrData.fg = this._curAttrData.fg, this._activeBuffer.savedCurAttrData.bg = this._curAttrData.bg, this._activeBuffer.savedCharset = this._charsetService.charset, true;
        }
        restoreCursor(e3) {
          return this._activeBuffer.x = this._activeBuffer.savedX || 0, this._activeBuffer.y = Math.max(this._activeBuffer.savedY - this._activeBuffer.ybase, 0), this._curAttrData.fg = this._activeBuffer.savedCurAttrData.fg, this._curAttrData.bg = this._activeBuffer.savedCurAttrData.bg, this._charsetService.charset = this._savedCharset, this._activeBuffer.savedCharset && (this._charsetService.charset = this._activeBuffer.savedCharset), this._restrictCursor(), true;
        }
        setTitle(e3) {
          return this._windowTitle = e3, this._onTitleChange.fire(e3), true;
        }
        setIconName(e3) {
          return this._iconName = e3, true;
        }
        setOrReportIndexedColor(e3) {
          const t3 = [], i3 = e3.split(";");
          for (;i3.length > 1; ) {
            const e4 = i3.shift(), s3 = i3.shift();
            if (/^\d+$/.exec(e4)) {
              const i4 = parseInt(e4);
              if (L(i4))
                if (s3 === "?")
                  t3.push({ type: 0, index: i4 });
                else {
                  const e5 = (0, S.parseColor)(s3);
                  e5 && t3.push({ type: 1, index: i4, color: e5 });
                }
            }
          }
          return t3.length && this._onColor.fire(t3), true;
        }
        setHyperlink(e3) {
          const t3 = e3.split(";");
          return !(t3.length < 2) && (t3[1] ? this._createHyperlink(t3[0], t3[1]) : !t3[0] && this._finishHyperlink());
        }
        _createHyperlink(e3, t3) {
          this._getCurrentLinkId() && this._finishHyperlink();
          const i3 = e3.split(":");
          let s3;
          const r3 = i3.findIndex((e4) => e4.startsWith("id="));
          return r3 !== -1 && (s3 = i3[r3].slice(3) || undefined), this._curAttrData.extended = this._curAttrData.extended.clone(), this._curAttrData.extended.urlId = this._oscLinkService.registerLink({ id: s3, uri: t3 }), this._curAttrData.updateExtended(), true;
        }
        _finishHyperlink() {
          return this._curAttrData.extended = this._curAttrData.extended.clone(), this._curAttrData.extended.urlId = 0, this._curAttrData.updateExtended(), true;
        }
        _setOrReportSpecialColor(e3, t3) {
          const i3 = e3.split(";");
          for (let e4 = 0;e4 < i3.length && !(t3 >= this._specialColors.length); ++e4, ++t3)
            if (i3[e4] === "?")
              this._onColor.fire([{ type: 0, index: this._specialColors[t3] }]);
            else {
              const s3 = (0, S.parseColor)(i3[e4]);
              s3 && this._onColor.fire([{ type: 1, index: this._specialColors[t3], color: s3 }]);
            }
          return true;
        }
        setOrReportFgColor(e3) {
          return this._setOrReportSpecialColor(e3, 0);
        }
        setOrReportBgColor(e3) {
          return this._setOrReportSpecialColor(e3, 1);
        }
        setOrReportCursorColor(e3) {
          return this._setOrReportSpecialColor(e3, 2);
        }
        restoreIndexedColor(e3) {
          if (!e3)
            return this._onColor.fire([{ type: 2 }]), true;
          const t3 = [], i3 = e3.split(";");
          for (let e4 = 0;e4 < i3.length; ++e4)
            if (/^\d+$/.exec(i3[e4])) {
              const s3 = parseInt(i3[e4]);
              L(s3) && t3.push({ type: 2, index: s3 });
            }
          return t3.length && this._onColor.fire(t3), true;
        }
        restoreFgColor(e3) {
          return this._onColor.fire([{ type: 2, index: 256 }]), true;
        }
        restoreBgColor(e3) {
          return this._onColor.fire([{ type: 2, index: 257 }]), true;
        }
        restoreCursorColor(e3) {
          return this._onColor.fire([{ type: 2, index: 258 }]), true;
        }
        nextLine() {
          return this._activeBuffer.x = 0, this.index(), true;
        }
        keypadApplicationMode() {
          return this._logService.debug("Serial port requested application keypad."), this._coreService.decPrivateModes.applicationKeypad = true, this._onRequestSyncScrollBar.fire(), true;
        }
        keypadNumericMode() {
          return this._logService.debug("Switching back to normal keypad."), this._coreService.decPrivateModes.applicationKeypad = false, this._onRequestSyncScrollBar.fire(), true;
        }
        selectDefaultCharset() {
          return this._charsetService.setgLevel(0), this._charsetService.setgCharset(0, a.DEFAULT_CHARSET), true;
        }
        selectCharset(e3) {
          return e3.length !== 2 ? (this.selectDefaultCharset(), true) : (e3[0] === "/" || this._charsetService.setgCharset(m[e3[0]], a.CHARSETS[e3[1]] || a.DEFAULT_CHARSET), true);
        }
        index() {
          return this._restrictCursor(), this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData())) : this._activeBuffer.y >= this._bufferService.rows && (this._activeBuffer.y = this._bufferService.rows - 1), this._restrictCursor(), true;
        }
        tabSet() {
          return this._activeBuffer.tabs[this._activeBuffer.x] = true, true;
        }
        reverseIndex() {
          if (this._restrictCursor(), this._activeBuffer.y === this._activeBuffer.scrollTop) {
            const e3 = this._activeBuffer.scrollBottom - this._activeBuffer.scrollTop;
            this._activeBuffer.lines.shiftElements(this._activeBuffer.ybase + this._activeBuffer.y, e3, 1), this._activeBuffer.lines.set(this._activeBuffer.ybase + this._activeBuffer.y, this._activeBuffer.getBlankLine(this._eraseAttrData())), this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom);
          } else
            this._activeBuffer.y--, this._restrictCursor();
          return true;
        }
        fullReset() {
          return this._parser.reset(), this._onRequestReset.fire(), true;
        }
        reset() {
          this._curAttrData = l.DEFAULT_ATTR_DATA.clone(), this._eraseAttrDataInternal = l.DEFAULT_ATTR_DATA.clone();
        }
        _eraseAttrData() {
          return this._eraseAttrDataInternal.bg &= -67108864, this._eraseAttrDataInternal.bg |= 67108863 & this._curAttrData.bg, this._eraseAttrDataInternal;
        }
        setgLevel(e3) {
          return this._charsetService.setgLevel(e3), true;
        }
        screenAlignmentPattern() {
          const e3 = new f.CellData;
          e3.content = 1 << 22 | 69, e3.fg = this._curAttrData.fg, e3.bg = this._curAttrData.bg, this._setCursor(0, 0);
          for (let t3 = 0;t3 < this._bufferService.rows; ++t3) {
            const i3 = this._activeBuffer.ybase + this._activeBuffer.y + t3, s3 = this._activeBuffer.lines.get(i3);
            s3 && (s3.fill(e3), s3.isWrapped = false);
          }
          return this._dirtyRowTracker.markAllDirty(), this._setCursor(0, 0), true;
        }
        requestStatusString(e3, t3) {
          const i3 = this._bufferService.buffer, s3 = this._optionsService.rawOptions;
          return ((e4) => (this._coreService.triggerDataEvent(`${n2.C0.ESC}${e4}${n2.C0.ESC}\\`), true))(e3 === '"q' ? `P1$r${this._curAttrData.isProtected() ? 1 : 0}"q` : e3 === '"p' ? 'P1$r61;1"p' : e3 === "r" ? `P1$r${i3.scrollTop + 1};${i3.scrollBottom + 1}r` : e3 === "m" ? "P1$r0m" : e3 === " q" ? `P1$r${{ block: 2, underline: 4, bar: 6 }[s3.cursorStyle] - (s3.cursorBlink ? 1 : 0)} q` : "P0$r");
        }
        markRangeDirty(e3, t3) {
          this._dirtyRowTracker.markRangeDirty(e3, t3);
        }
      }
      t2.InputHandler = E;
      let A = class {
        constructor(e3) {
          this._bufferService = e3, this.clearRange();
        }
        clearRange() {
          this.start = this._bufferService.buffer.y, this.end = this._bufferService.buffer.y;
        }
        markDirty(e3) {
          e3 < this.start ? this.start = e3 : e3 > this.end && (this.end = e3);
        }
        markRangeDirty(e3, t3) {
          e3 > t3 && (B = e3, e3 = t3, t3 = B), e3 < this.start && (this.start = e3), t3 > this.end && (this.end = t3);
        }
        markAllDirty() {
          this.markRangeDirty(0, this._bufferService.rows - 1);
        }
      };
      function L(e3) {
        return 0 <= e3 && e3 < 256;
      }
      A = s2([r2(0, p.IBufferService)], A);
    }, 844: (e2, t2) => {
      function i2(e3) {
        for (const t3 of e3)
          t3.dispose();
        e3.length = 0;
      }
      Object.defineProperty(t2, "__esModule", { value: true }), t2.getDisposeArrayDisposable = t2.disposeArray = t2.toDisposable = t2.MutableDisposable = t2.Disposable = undefined, t2.Disposable = class {
        constructor() {
          this._disposables = [], this._isDisposed = false;
        }
        dispose() {
          this._isDisposed = true;
          for (const e3 of this._disposables)
            e3.dispose();
          this._disposables.length = 0;
        }
        register(e3) {
          return this._disposables.push(e3), e3;
        }
        unregister(e3) {
          const t3 = this._disposables.indexOf(e3);
          t3 !== -1 && this._disposables.splice(t3, 1);
        }
      }, t2.MutableDisposable = class {
        constructor() {
          this._isDisposed = false;
        }
        get value() {
          return this._isDisposed ? undefined : this._value;
        }
        set value(e3) {
          this._isDisposed || e3 === this._value || (this._value?.dispose(), this._value = e3);
        }
        clear() {
          this.value = undefined;
        }
        dispose() {
          this._isDisposed = true, this._value?.dispose(), this._value = undefined;
        }
      }, t2.toDisposable = function(e3) {
        return { dispose: e3 };
      }, t2.disposeArray = i2, t2.getDisposeArrayDisposable = function(e3) {
        return { dispose: () => i2(e3) };
      };
    }, 114: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.isChromeOS = t2.isLinux = t2.isWindows = t2.isIphone = t2.isIpad = t2.isMac = t2.getSafariVersion = t2.isSafari = t2.isLegacyEdge = t2.isFirefox = t2.isNode = undefined, t2.isNode = typeof process != "undefined" && "title" in process;
      const i2 = t2.isNode ? "node" : navigator.userAgent, s2 = t2.isNode ? "node" : navigator.platform;
      t2.isFirefox = i2.includes("Firefox"), t2.isLegacyEdge = i2.includes("Edge"), t2.isSafari = /^((?!chrome|android).)*safari/i.test(i2), t2.getSafariVersion = function() {
        if (!t2.isSafari)
          return 0;
        const e3 = i2.match(/Version\/(\d+)/);
        return e3 === null || e3.length < 2 ? 0 : parseInt(e3[1]);
      }, t2.isMac = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"].includes(s2), t2.isIpad = s2 === "iPad", t2.isIphone = s2 === "iPhone", t2.isWindows = ["Windows", "Win16", "Win32", "WinCE"].includes(s2), t2.isLinux = s2.indexOf("Linux") >= 0, t2.isChromeOS = /\bCrOS\b/.test(i2);
    }, 226: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.DebouncedIdleTask = t2.IdleTaskQueue = t2.PriorityTaskQueue = undefined;
      const s2 = i2(114);

      class r2 {
        constructor() {
          this._tasks = [], this._i = 0;
        }
        enqueue(e3) {
          this._tasks.push(e3), this._start();
        }
        flush() {
          for (;this._i < this._tasks.length; )
            this._tasks[this._i]() || this._i++;
          this.clear();
        }
        clear() {
          this._idleCallback && (this._cancelCallback(this._idleCallback), this._idleCallback = undefined), this._i = 0, this._tasks.length = 0;
        }
        _start() {
          this._idleCallback || (this._idleCallback = this._requestCallback(this._process.bind(this)));
        }
        _process(e3) {
          this._idleCallback = undefined;
          let t3 = 0, i3 = 0, s3 = e3.timeRemaining(), r3 = 0;
          for (;this._i < this._tasks.length; ) {
            if (t3 = Date.now(), this._tasks[this._i]() || this._i++, t3 = Math.max(1, Date.now() - t3), i3 = Math.max(t3, i3), r3 = e3.timeRemaining(), 1.5 * i3 > r3)
              return s3 - t3 < -20 && console.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(s3 - t3))}ms`), void this._start();
            s3 = r3;
          }
          this.clear();
        }
      }

      class n2 extends r2 {
        _requestCallback(e3) {
          return setTimeout(() => e3(this._createDeadline(16)));
        }
        _cancelCallback(e3) {
          clearTimeout(e3);
        }
        _createDeadline(e3) {
          const t3 = Date.now() + e3;
          return { timeRemaining: () => Math.max(0, t3 - Date.now()) };
        }
      }
      t2.PriorityTaskQueue = n2, t2.IdleTaskQueue = !s2.isNode && "requestIdleCallback" in window ? class extends r2 {
        _requestCallback(e3) {
          return requestIdleCallback(e3);
        }
        _cancelCallback(e3) {
          cancelIdleCallback(e3);
        }
      } : n2, t2.DebouncedIdleTask = class {
        constructor() {
          this._queue = new t2.IdleTaskQueue;
        }
        set(e3) {
          this._queue.clear(), this._queue.enqueue(e3);
        }
        flush() {
          this._queue.flush();
        }
      };
    }, 282: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.updateWindowsModeWrappedState = undefined;
      const s2 = i2(643);
      t2.updateWindowsModeWrappedState = function(e3) {
        const t3 = e3.buffer.lines.get(e3.buffer.ybase + e3.buffer.y - 1), i3 = t3?.get(e3.cols - 1), r2 = e3.buffer.lines.get(e3.buffer.ybase + e3.buffer.y);
        r2 && i3 && (r2.isWrapped = i3[s2.CHAR_DATA_CODE_INDEX] !== s2.NULL_CELL_CODE && i3[s2.CHAR_DATA_CODE_INDEX] !== s2.WHITESPACE_CELL_CODE);
      };
    }, 734: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.ExtendedAttrs = t2.AttributeData = undefined;

      class i2 {
        constructor() {
          this.fg = 0, this.bg = 0, this.extended = new s2;
        }
        static toColorRGB(e3) {
          return [e3 >>> 16 & 255, e3 >>> 8 & 255, 255 & e3];
        }
        static fromColorRGB(e3) {
          return (255 & e3[0]) << 16 | (255 & e3[1]) << 8 | 255 & e3[2];
        }
        clone() {
          const e3 = new i2;
          return e3.fg = this.fg, e3.bg = this.bg, e3.extended = this.extended.clone(), e3;
        }
        isInverse() {
          return 67108864 & this.fg;
        }
        isBold() {
          return 134217728 & this.fg;
        }
        isUnderline() {
          return this.hasExtendedAttrs() && this.extended.underlineStyle !== 0 ? 1 : 268435456 & this.fg;
        }
        isBlink() {
          return 536870912 & this.fg;
        }
        isInvisible() {
          return 1073741824 & this.fg;
        }
        isItalic() {
          return 67108864 & this.bg;
        }
        isDim() {
          return 134217728 & this.bg;
        }
        isStrikethrough() {
          return 2147483648 & this.fg;
        }
        isProtected() {
          return 536870912 & this.bg;
        }
        isOverline() {
          return 1073741824 & this.bg;
        }
        getFgColorMode() {
          return 50331648 & this.fg;
        }
        getBgColorMode() {
          return 50331648 & this.bg;
        }
        isFgRGB() {
          return (50331648 & this.fg) == 50331648;
        }
        isBgRGB() {
          return (50331648 & this.bg) == 50331648;
        }
        isFgPalette() {
          return (50331648 & this.fg) == 16777216 || (50331648 & this.fg) == 33554432;
        }
        isBgPalette() {
          return (50331648 & this.bg) == 16777216 || (50331648 & this.bg) == 33554432;
        }
        isFgDefault() {
          return (50331648 & this.fg) == 0;
        }
        isBgDefault() {
          return (50331648 & this.bg) == 0;
        }
        isAttributeDefault() {
          return this.fg === 0 && this.bg === 0;
        }
        getFgColor() {
          switch (50331648 & this.fg) {
            case 16777216:
            case 33554432:
              return 255 & this.fg;
            case 50331648:
              return 16777215 & this.fg;
            default:
              return -1;
          }
        }
        getBgColor() {
          switch (50331648 & this.bg) {
            case 16777216:
            case 33554432:
              return 255 & this.bg;
            case 50331648:
              return 16777215 & this.bg;
            default:
              return -1;
          }
        }
        hasExtendedAttrs() {
          return 268435456 & this.bg;
        }
        updateExtended() {
          this.extended.isEmpty() ? this.bg &= -268435457 : this.bg |= 268435456;
        }
        getUnderlineColor() {
          if (268435456 & this.bg && ~this.extended.underlineColor)
            switch (50331648 & this.extended.underlineColor) {
              case 16777216:
              case 33554432:
                return 255 & this.extended.underlineColor;
              case 50331648:
                return 16777215 & this.extended.underlineColor;
              default:
                return this.getFgColor();
            }
          return this.getFgColor();
        }
        getUnderlineColorMode() {
          return 268435456 & this.bg && ~this.extended.underlineColor ? 50331648 & this.extended.underlineColor : this.getFgColorMode();
        }
        isUnderlineColorRGB() {
          return 268435456 & this.bg && ~this.extended.underlineColor ? (50331648 & this.extended.underlineColor) == 50331648 : this.isFgRGB();
        }
        isUnderlineColorPalette() {
          return 268435456 & this.bg && ~this.extended.underlineColor ? (50331648 & this.extended.underlineColor) == 16777216 || (50331648 & this.extended.underlineColor) == 33554432 : this.isFgPalette();
        }
        isUnderlineColorDefault() {
          return 268435456 & this.bg && ~this.extended.underlineColor ? (50331648 & this.extended.underlineColor) == 0 : this.isFgDefault();
        }
        getUnderlineStyle() {
          return 268435456 & this.fg ? 268435456 & this.bg ? this.extended.underlineStyle : 1 : 0;
        }
        getUnderlineVariantOffset() {
          return this.extended.underlineVariantOffset;
        }
      }
      t2.AttributeData = i2;

      class s2 {
        get ext() {
          return this._urlId ? -469762049 & this._ext | this.underlineStyle << 26 : this._ext;
        }
        set ext(e3) {
          this._ext = e3;
        }
        get underlineStyle() {
          return this._urlId ? 5 : (469762048 & this._ext) >> 26;
        }
        set underlineStyle(e3) {
          this._ext &= -469762049, this._ext |= e3 << 26 & 469762048;
        }
        get underlineColor() {
          return 67108863 & this._ext;
        }
        set underlineColor(e3) {
          this._ext &= -67108864, this._ext |= 67108863 & e3;
        }
        get urlId() {
          return this._urlId;
        }
        set urlId(e3) {
          this._urlId = e3;
        }
        get underlineVariantOffset() {
          const e3 = (3758096384 & this._ext) >> 29;
          return e3 < 0 ? 4294967288 ^ e3 : e3;
        }
        set underlineVariantOffset(e3) {
          this._ext &= 536870911, this._ext |= e3 << 29 & 3758096384;
        }
        constructor(e3 = 0, t3 = 0) {
          this._ext = 0, this._urlId = 0, this._ext = e3, this._urlId = t3;
        }
        clone() {
          return new s2(this._ext, this._urlId);
        }
        isEmpty() {
          return this.underlineStyle === 0 && this._urlId === 0;
        }
      }
      t2.ExtendedAttrs = s2;
    }, 92: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.Buffer = t2.MAX_BUFFER_SIZE = undefined;
      const s2 = i2(349), r2 = i2(226), n2 = i2(734), a = i2(437), o = i2(634), h = i2(511), c = i2(643), l = i2(863), _ = i2(116);
      t2.MAX_BUFFER_SIZE = 4294967295, t2.Buffer = class {
        constructor(e3, t3, i3) {
          this._hasScrollback = e3, this._optionsService = t3, this._bufferService = i3, this.ydisp = 0, this.ybase = 0, this.y = 0, this.x = 0, this.tabs = {}, this.savedY = 0, this.savedX = 0, this.savedCurAttrData = a.DEFAULT_ATTR_DATA.clone(), this.savedCharset = _.DEFAULT_CHARSET, this.markers = [], this._nullCell = h.CellData.fromCharData([0, c.NULL_CELL_CHAR, c.NULL_CELL_WIDTH, c.NULL_CELL_CODE]), this._whitespaceCell = h.CellData.fromCharData([0, c.WHITESPACE_CELL_CHAR, c.WHITESPACE_CELL_WIDTH, c.WHITESPACE_CELL_CODE]), this._isClearing = false, this._memoryCleanupQueue = new r2.IdleTaskQueue, this._memoryCleanupPosition = 0, this._cols = this._bufferService.cols, this._rows = this._bufferService.rows, this.lines = new s2.CircularList(this._getCorrectBufferLength(this._rows)), this.scrollTop = 0, this.scrollBottom = this._rows - 1, this.setupTabStops();
        }
        getNullCell(e3) {
          return e3 ? (this._nullCell.fg = e3.fg, this._nullCell.bg = e3.bg, this._nullCell.extended = e3.extended) : (this._nullCell.fg = 0, this._nullCell.bg = 0, this._nullCell.extended = new n2.ExtendedAttrs), this._nullCell;
        }
        getWhitespaceCell(e3) {
          return e3 ? (this._whitespaceCell.fg = e3.fg, this._whitespaceCell.bg = e3.bg, this._whitespaceCell.extended = e3.extended) : (this._whitespaceCell.fg = 0, this._whitespaceCell.bg = 0, this._whitespaceCell.extended = new n2.ExtendedAttrs), this._whitespaceCell;
        }
        getBlankLine(e3, t3) {
          return new a.BufferLine(this._bufferService.cols, this.getNullCell(e3), t3);
        }
        get hasScrollback() {
          return this._hasScrollback && this.lines.maxLength > this._rows;
        }
        get isCursorInViewport() {
          const e3 = this.ybase + this.y - this.ydisp;
          return e3 >= 0 && e3 < this._rows;
        }
        _getCorrectBufferLength(e3) {
          if (!this._hasScrollback)
            return e3;
          const i3 = e3 + this._optionsService.rawOptions.scrollback;
          return i3 > t2.MAX_BUFFER_SIZE ? t2.MAX_BUFFER_SIZE : i3;
        }
        fillViewportRows(e3) {
          if (this.lines.length === 0) {
            e3 === undefined && (e3 = a.DEFAULT_ATTR_DATA);
            let t3 = this._rows;
            for (;t3--; )
              this.lines.push(this.getBlankLine(e3));
          }
        }
        clear() {
          this.ydisp = 0, this.ybase = 0, this.y = 0, this.x = 0, this.lines = new s2.CircularList(this._getCorrectBufferLength(this._rows)), this.scrollTop = 0, this.scrollBottom = this._rows - 1, this.setupTabStops();
        }
        resize(e3, t3) {
          const i3 = this.getNullCell(a.DEFAULT_ATTR_DATA);
          let s3 = 0;
          const r3 = this._getCorrectBufferLength(t3);
          if (r3 > this.lines.maxLength && (this.lines.maxLength = r3), this.lines.length > 0) {
            if (this._cols < e3)
              for (let t4 = 0;t4 < this.lines.length; t4++)
                s3 += +this.lines.get(t4).resize(e3, i3);
            let n3 = 0;
            if (this._rows < t3)
              for (let s4 = this._rows;s4 < t3; s4++)
                this.lines.length < t3 + this.ybase && (this._optionsService.rawOptions.windowsMode || this._optionsService.rawOptions.windowsPty.backend !== undefined || this._optionsService.rawOptions.windowsPty.buildNumber !== undefined ? this.lines.push(new a.BufferLine(e3, i3)) : this.ybase > 0 && this.lines.length <= this.ybase + this.y + n3 + 1 ? (this.ybase--, n3++, this.ydisp > 0 && this.ydisp--) : this.lines.push(new a.BufferLine(e3, i3)));
            else
              for (let e4 = this._rows;e4 > t3; e4--)
                this.lines.length > t3 + this.ybase && (this.lines.length > this.ybase + this.y + 1 ? this.lines.pop() : (this.ybase++, this.ydisp++));
            if (r3 < this.lines.maxLength) {
              const e4 = this.lines.length - r3;
              e4 > 0 && (this.lines.trimStart(e4), this.ybase = Math.max(this.ybase - e4, 0), this.ydisp = Math.max(this.ydisp - e4, 0), this.savedY = Math.max(this.savedY - e4, 0)), this.lines.maxLength = r3;
            }
            this.x = Math.min(this.x, e3 - 1), this.y = Math.min(this.y, t3 - 1), n3 && (this.y += n3), this.savedX = Math.min(this.savedX, e3 - 1), this.scrollTop = 0;
          }
          if (this.scrollBottom = t3 - 1, this._isReflowEnabled && (this._reflow(e3, t3), this._cols > e3))
            for (let t4 = 0;t4 < this.lines.length; t4++)
              s3 += +this.lines.get(t4).resize(e3, i3);
          this._cols = e3, this._rows = t3, this._memoryCleanupQueue.clear(), s3 > 0.1 * this.lines.length && (this._memoryCleanupPosition = 0, this._memoryCleanupQueue.enqueue(() => this._batchedMemoryCleanup()));
        }
        _batchedMemoryCleanup() {
          let e3 = true;
          this._memoryCleanupPosition >= this.lines.length && (this._memoryCleanupPosition = 0, e3 = false);
          let t3 = 0;
          for (;this._memoryCleanupPosition < this.lines.length; )
            if (t3 += this.lines.get(this._memoryCleanupPosition++).cleanupMemory(), t3 > 100)
              return true;
          return e3;
        }
        get _isReflowEnabled() {
          const e3 = this._optionsService.rawOptions.windowsPty;
          return e3 && e3.buildNumber ? this._hasScrollback && e3.backend === "conpty" && e3.buildNumber >= 21376 : this._hasScrollback && !this._optionsService.rawOptions.windowsMode;
        }
        _reflow(e3, t3) {
          this._cols !== e3 && (e3 > this._cols ? this._reflowLarger(e3, t3) : this._reflowSmaller(e3, t3));
        }
        _reflowLarger(e3, t3) {
          const i3 = (0, o.reflowLargerGetLinesToRemove)(this.lines, this._cols, e3, this.ybase + this.y, this.getNullCell(a.DEFAULT_ATTR_DATA));
          if (i3.length > 0) {
            const s3 = (0, o.reflowLargerCreateNewLayout)(this.lines, i3);
            (0, o.reflowLargerApplyNewLayout)(this.lines, s3.layout), this._reflowLargerAdjustViewport(e3, t3, s3.countRemoved);
          }
        }
        _reflowLargerAdjustViewport(e3, t3, i3) {
          const s3 = this.getNullCell(a.DEFAULT_ATTR_DATA);
          let r3 = i3;
          for (;r3-- > 0; )
            this.ybase === 0 ? (this.y > 0 && this.y--, this.lines.length < t3 && this.lines.push(new a.BufferLine(e3, s3))) : (this.ydisp === this.ybase && this.ydisp--, this.ybase--);
          this.savedY = Math.max(this.savedY - i3, 0);
        }
        _reflowSmaller(e3, t3) {
          const i3 = this.getNullCell(a.DEFAULT_ATTR_DATA), s3 = [];
          let r3 = 0;
          for (let n3 = this.lines.length - 1;n3 >= 0; n3--) {
            let h2 = this.lines.get(n3);
            if (!h2 || !h2.isWrapped && h2.getTrimmedLength() <= e3)
              continue;
            const c2 = [h2];
            for (;h2.isWrapped && n3 > 0; )
              h2 = this.lines.get(--n3), c2.unshift(h2);
            const l2 = this.ybase + this.y;
            if (l2 >= n3 && l2 < n3 + c2.length)
              continue;
            const _2 = c2[c2.length - 1].getTrimmedLength(), d = (0, o.reflowSmallerGetNewLineLengths)(c2, this._cols, e3), f = d.length - c2.length;
            let u;
            u = this.ybase === 0 && this.y !== this.lines.length - 1 ? Math.max(0, this.y - this.lines.maxLength + f) : Math.max(0, this.lines.length - this.lines.maxLength + f);
            const p = [];
            for (let e4 = 0;e4 < f; e4++) {
              const e5 = this.getBlankLine(a.DEFAULT_ATTR_DATA, true);
              p.push(e5);
            }
            p.length > 0 && (s3.push({ start: n3 + c2.length + r3, newLines: p }), r3 += p.length), c2.push(...p);
            let g = d.length - 1, v = d[g];
            v === 0 && (g--, v = d[g]);
            let b = c2.length - f - 1, S = _2;
            for (;b >= 0; ) {
              const e4 = Math.min(S, v);
              if (c2[g] === undefined)
                break;
              if (c2[g].copyCellsFrom(c2[b], S - e4, v - e4, e4, true), v -= e4, v === 0 && (g--, v = d[g]), S -= e4, S === 0) {
                b--;
                const e5 = Math.max(b, 0);
                S = (0, o.getWrappedLineTrimmedLength)(c2, e5, this._cols);
              }
            }
            for (let t4 = 0;t4 < c2.length; t4++)
              d[t4] < e3 && c2[t4].setCell(d[t4], i3);
            let m = f - u;
            for (;m-- > 0; )
              this.ybase === 0 ? this.y < t3 - 1 ? (this.y++, this.lines.pop()) : (this.ybase++, this.ydisp++) : this.ybase < Math.min(this.lines.maxLength, this.lines.length + r3) - t3 && (this.ybase === this.ydisp && this.ydisp++, this.ybase++);
            this.savedY = Math.min(this.savedY + f, this.ybase + t3 - 1);
          }
          if (s3.length > 0) {
            const e4 = [], t4 = [];
            for (let e5 = 0;e5 < this.lines.length; e5++)
              t4.push(this.lines.get(e5));
            const i4 = this.lines.length;
            let n3 = i4 - 1, a2 = 0, o2 = s3[a2];
            this.lines.length = Math.min(this.lines.maxLength, this.lines.length + r3);
            let h2 = 0;
            for (let c3 = Math.min(this.lines.maxLength - 1, i4 + r3 - 1);c3 >= 0; c3--)
              if (o2 && o2.start > n3 + h2) {
                for (let e5 = o2.newLines.length - 1;e5 >= 0; e5--)
                  this.lines.set(c3--, o2.newLines[e5]);
                c3++, e4.push({ index: n3 + 1, amount: o2.newLines.length }), h2 += o2.newLines.length, o2 = s3[++a2];
              } else
                this.lines.set(c3, t4[n3--]);
            let c2 = 0;
            for (let t5 = e4.length - 1;t5 >= 0; t5--)
              e4[t5].index += c2, this.lines.onInsertEmitter.fire(e4[t5]), c2 += e4[t5].amount;
            const l2 = Math.max(0, i4 + r3 - this.lines.maxLength);
            l2 > 0 && this.lines.onTrimEmitter.fire(l2);
          }
        }
        translateBufferLineToString(e3, t3, i3 = 0, s3) {
          const r3 = this.lines.get(e3);
          return r3 ? r3.translateToString(t3, i3, s3) : "";
        }
        getWrappedRangeForLine(e3) {
          let t3 = e3, i3 = e3;
          for (;t3 > 0 && this.lines.get(t3).isWrapped; )
            t3--;
          for (;i3 + 1 < this.lines.length && this.lines.get(i3 + 1).isWrapped; )
            i3++;
          return { first: t3, last: i3 };
        }
        setupTabStops(e3) {
          for (e3 != null ? this.tabs[e3] || (e3 = this.prevStop(e3)) : (this.tabs = {}, e3 = 0);e3 < this._cols; e3 += this._optionsService.rawOptions.tabStopWidth)
            this.tabs[e3] = true;
        }
        prevStop(e3) {
          for (e3 == null && (e3 = this.x);!this.tabs[--e3] && e3 > 0; )
            ;
          return e3 >= this._cols ? this._cols - 1 : e3 < 0 ? 0 : e3;
        }
        nextStop(e3) {
          for (e3 == null && (e3 = this.x);!this.tabs[++e3] && e3 < this._cols; )
            ;
          return e3 >= this._cols ? this._cols - 1 : e3 < 0 ? 0 : e3;
        }
        clearMarkers(e3) {
          this._isClearing = true;
          for (let t3 = 0;t3 < this.markers.length; t3++)
            this.markers[t3].line === e3 && (this.markers[t3].dispose(), this.markers.splice(t3--, 1));
          this._isClearing = false;
        }
        clearAllMarkers() {
          this._isClearing = true;
          for (let e3 = 0;e3 < this.markers.length; e3++)
            this.markers[e3].dispose(), this.markers.splice(e3--, 1);
          this._isClearing = false;
        }
        addMarker(e3) {
          const t3 = new l.Marker(e3);
          return this.markers.push(t3), t3.register(this.lines.onTrim((e4) => {
            t3.line -= e4, t3.line < 0 && t3.dispose();
          })), t3.register(this.lines.onInsert((e4) => {
            t3.line >= e4.index && (t3.line += e4.amount);
          })), t3.register(this.lines.onDelete((e4) => {
            t3.line >= e4.index && t3.line < e4.index + e4.amount && t3.dispose(), t3.line > e4.index && (t3.line -= e4.amount);
          })), t3.register(t3.onDispose(() => this._removeMarker(t3))), t3;
        }
        _removeMarker(e3) {
          this._isClearing || this.markers.splice(this.markers.indexOf(e3), 1);
        }
      };
    }, 437: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferLine = t2.DEFAULT_ATTR_DATA = undefined;
      const s2 = i2(734), r2 = i2(511), n2 = i2(643), a = i2(482);
      t2.DEFAULT_ATTR_DATA = Object.freeze(new s2.AttributeData);
      let o = 0;

      class h {
        constructor(e3, t3, i3 = false) {
          this.isWrapped = i3, this._combined = {}, this._extendedAttrs = {}, this._data = new Uint32Array(3 * e3);
          const s3 = t3 || r2.CellData.fromCharData([0, n2.NULL_CELL_CHAR, n2.NULL_CELL_WIDTH, n2.NULL_CELL_CODE]);
          for (let t4 = 0;t4 < e3; ++t4)
            this.setCell(t4, s3);
          this.length = e3;
        }
        get(e3) {
          const t3 = this._data[3 * e3 + 0], i3 = 2097151 & t3;
          return [this._data[3 * e3 + 1], 2097152 & t3 ? this._combined[e3] : i3 ? (0, a.stringFromCodePoint)(i3) : "", t3 >> 22, 2097152 & t3 ? this._combined[e3].charCodeAt(this._combined[e3].length - 1) : i3];
        }
        set(e3, t3) {
          this._data[3 * e3 + 1] = t3[n2.CHAR_DATA_ATTR_INDEX], t3[n2.CHAR_DATA_CHAR_INDEX].length > 1 ? (this._combined[e3] = t3[1], this._data[3 * e3 + 0] = 2097152 | e3 | t3[n2.CHAR_DATA_WIDTH_INDEX] << 22) : this._data[3 * e3 + 0] = t3[n2.CHAR_DATA_CHAR_INDEX].charCodeAt(0) | t3[n2.CHAR_DATA_WIDTH_INDEX] << 22;
        }
        getWidth(e3) {
          return this._data[3 * e3 + 0] >> 22;
        }
        hasWidth(e3) {
          return 12582912 & this._data[3 * e3 + 0];
        }
        getFg(e3) {
          return this._data[3 * e3 + 1];
        }
        getBg(e3) {
          return this._data[3 * e3 + 2];
        }
        hasContent(e3) {
          return 4194303 & this._data[3 * e3 + 0];
        }
        getCodePoint(e3) {
          const t3 = this._data[3 * e3 + 0];
          return 2097152 & t3 ? this._combined[e3].charCodeAt(this._combined[e3].length - 1) : 2097151 & t3;
        }
        isCombined(e3) {
          return 2097152 & this._data[3 * e3 + 0];
        }
        getString(e3) {
          const t3 = this._data[3 * e3 + 0];
          return 2097152 & t3 ? this._combined[e3] : 2097151 & t3 ? (0, a.stringFromCodePoint)(2097151 & t3) : "";
        }
        isProtected(e3) {
          return 536870912 & this._data[3 * e3 + 2];
        }
        loadCell(e3, t3) {
          return o = 3 * e3, t3.content = this._data[o + 0], t3.fg = this._data[o + 1], t3.bg = this._data[o + 2], 2097152 & t3.content && (t3.combinedData = this._combined[e3]), 268435456 & t3.bg && (t3.extended = this._extendedAttrs[e3]), t3;
        }
        setCell(e3, t3) {
          2097152 & t3.content && (this._combined[e3] = t3.combinedData), 268435456 & t3.bg && (this._extendedAttrs[e3] = t3.extended), this._data[3 * e3 + 0] = t3.content, this._data[3 * e3 + 1] = t3.fg, this._data[3 * e3 + 2] = t3.bg;
        }
        setCellFromCodepoint(e3, t3, i3, s3) {
          268435456 & s3.bg && (this._extendedAttrs[e3] = s3.extended), this._data[3 * e3 + 0] = t3 | i3 << 22, this._data[3 * e3 + 1] = s3.fg, this._data[3 * e3 + 2] = s3.bg;
        }
        addCodepointToCell(e3, t3, i3) {
          let s3 = this._data[3 * e3 + 0];
          2097152 & s3 ? this._combined[e3] += (0, a.stringFromCodePoint)(t3) : 2097151 & s3 ? (this._combined[e3] = (0, a.stringFromCodePoint)(2097151 & s3) + (0, a.stringFromCodePoint)(t3), s3 &= -2097152, s3 |= 2097152) : s3 = t3 | 1 << 22, i3 && (s3 &= -12582913, s3 |= i3 << 22), this._data[3 * e3 + 0] = s3;
        }
        insertCells(e3, t3, i3) {
          if ((e3 %= this.length) && this.getWidth(e3 - 1) === 2 && this.setCellFromCodepoint(e3 - 1, 0, 1, i3), t3 < this.length - e3) {
            const s3 = new r2.CellData;
            for (let i4 = this.length - e3 - t3 - 1;i4 >= 0; --i4)
              this.setCell(e3 + t3 + i4, this.loadCell(e3 + i4, s3));
            for (let s4 = 0;s4 < t3; ++s4)
              this.setCell(e3 + s4, i3);
          } else
            for (let t4 = e3;t4 < this.length; ++t4)
              this.setCell(t4, i3);
          this.getWidth(this.length - 1) === 2 && this.setCellFromCodepoint(this.length - 1, 0, 1, i3);
        }
        deleteCells(e3, t3, i3) {
          if (e3 %= this.length, t3 < this.length - e3) {
            const s3 = new r2.CellData;
            for (let i4 = 0;i4 < this.length - e3 - t3; ++i4)
              this.setCell(e3 + i4, this.loadCell(e3 + t3 + i4, s3));
            for (let e4 = this.length - t3;e4 < this.length; ++e4)
              this.setCell(e4, i3);
          } else
            for (let t4 = e3;t4 < this.length; ++t4)
              this.setCell(t4, i3);
          e3 && this.getWidth(e3 - 1) === 2 && this.setCellFromCodepoint(e3 - 1, 0, 1, i3), this.getWidth(e3) !== 0 || this.hasContent(e3) || this.setCellFromCodepoint(e3, 0, 1, i3);
        }
        replaceCells(e3, t3, i3, s3 = false) {
          if (s3)
            for (e3 && this.getWidth(e3 - 1) === 2 && !this.isProtected(e3 - 1) && this.setCellFromCodepoint(e3 - 1, 0, 1, i3), t3 < this.length && this.getWidth(t3 - 1) === 2 && !this.isProtected(t3) && this.setCellFromCodepoint(t3, 0, 1, i3);e3 < t3 && e3 < this.length; )
              this.isProtected(e3) || this.setCell(e3, i3), e3++;
          else
            for (e3 && this.getWidth(e3 - 1) === 2 && this.setCellFromCodepoint(e3 - 1, 0, 1, i3), t3 < this.length && this.getWidth(t3 - 1) === 2 && this.setCellFromCodepoint(t3, 0, 1, i3);e3 < t3 && e3 < this.length; )
              this.setCell(e3++, i3);
        }
        resize(e3, t3) {
          if (e3 === this.length)
            return 4 * this._data.length * 2 < this._data.buffer.byteLength;
          const i3 = 3 * e3;
          if (e3 > this.length) {
            if (this._data.buffer.byteLength >= 4 * i3)
              this._data = new Uint32Array(this._data.buffer, 0, i3);
            else {
              const e4 = new Uint32Array(i3);
              e4.set(this._data), this._data = e4;
            }
            for (let i4 = this.length;i4 < e3; ++i4)
              this.setCell(i4, t3);
          } else {
            this._data = this._data.subarray(0, i3);
            const t4 = Object.keys(this._combined);
            for (let i4 = 0;i4 < t4.length; i4++) {
              const s4 = parseInt(t4[i4], 10);
              s4 >= e3 && delete this._combined[s4];
            }
            const s3 = Object.keys(this._extendedAttrs);
            for (let t5 = 0;t5 < s3.length; t5++) {
              const i4 = parseInt(s3[t5], 10);
              i4 >= e3 && delete this._extendedAttrs[i4];
            }
          }
          return this.length = e3, 4 * i3 * 2 < this._data.buffer.byteLength;
        }
        cleanupMemory() {
          if (4 * this._data.length * 2 < this._data.buffer.byteLength) {
            const e3 = new Uint32Array(this._data.length);
            return e3.set(this._data), this._data = e3, 1;
          }
          return 0;
        }
        fill(e3, t3 = false) {
          if (t3)
            for (let t4 = 0;t4 < this.length; ++t4)
              this.isProtected(t4) || this.setCell(t4, e3);
          else {
            this._combined = {}, this._extendedAttrs = {};
            for (let t4 = 0;t4 < this.length; ++t4)
              this.setCell(t4, e3);
          }
        }
        copyFrom(e3) {
          this.length !== e3.length ? this._data = new Uint32Array(e3._data) : this._data.set(e3._data), this.length = e3.length, this._combined = {};
          for (const t3 in e3._combined)
            this._combined[t3] = e3._combined[t3];
          this._extendedAttrs = {};
          for (const t3 in e3._extendedAttrs)
            this._extendedAttrs[t3] = e3._extendedAttrs[t3];
          this.isWrapped = e3.isWrapped;
        }
        clone() {
          const e3 = new h(0);
          e3._data = new Uint32Array(this._data), e3.length = this.length;
          for (const t3 in this._combined)
            e3._combined[t3] = this._combined[t3];
          for (const t3 in this._extendedAttrs)
            e3._extendedAttrs[t3] = this._extendedAttrs[t3];
          return e3.isWrapped = this.isWrapped, e3;
        }
        getTrimmedLength() {
          for (let e3 = this.length - 1;e3 >= 0; --e3)
            if (4194303 & this._data[3 * e3 + 0])
              return e3 + (this._data[3 * e3 + 0] >> 22);
          return 0;
        }
        getNoBgTrimmedLength() {
          for (let e3 = this.length - 1;e3 >= 0; --e3)
            if (4194303 & this._data[3 * e3 + 0] || 50331648 & this._data[3 * e3 + 2])
              return e3 + (this._data[3 * e3 + 0] >> 22);
          return 0;
        }
        copyCellsFrom(e3, t3, i3, s3, r3) {
          const n3 = e3._data;
          if (r3)
            for (let r4 = s3 - 1;r4 >= 0; r4--) {
              for (let e4 = 0;e4 < 3; e4++)
                this._data[3 * (i3 + r4) + e4] = n3[3 * (t3 + r4) + e4];
              268435456 & n3[3 * (t3 + r4) + 2] && (this._extendedAttrs[i3 + r4] = e3._extendedAttrs[t3 + r4]);
            }
          else
            for (let r4 = 0;r4 < s3; r4++) {
              for (let e4 = 0;e4 < 3; e4++)
                this._data[3 * (i3 + r4) + e4] = n3[3 * (t3 + r4) + e4];
              268435456 & n3[3 * (t3 + r4) + 2] && (this._extendedAttrs[i3 + r4] = e3._extendedAttrs[t3 + r4]);
            }
          const a2 = Object.keys(e3._combined);
          for (let s4 = 0;s4 < a2.length; s4++) {
            const r4 = parseInt(a2[s4], 10);
            r4 >= t3 && (this._combined[r4 - t3 + i3] = e3._combined[r4]);
          }
        }
        translateToString(e3, t3, i3, s3) {
          t3 = t3 ?? 0, i3 = i3 ?? this.length, e3 && (i3 = Math.min(i3, this.getTrimmedLength())), s3 && (s3.length = 0);
          let r3 = "";
          for (;t3 < i3; ) {
            const e4 = this._data[3 * t3 + 0], i4 = 2097151 & e4, o2 = 2097152 & e4 ? this._combined[t3] : i4 ? (0, a.stringFromCodePoint)(i4) : n2.WHITESPACE_CELL_CHAR;
            if (r3 += o2, s3)
              for (let e5 = 0;e5 < o2.length; ++e5)
                s3.push(t3);
            t3 += e4 >> 22 || 1;
          }
          return s3 && s3.push(t3), r3;
        }
      }
      t2.BufferLine = h;
    }, 634: (e2, t2) => {
      function i2(e3, t3, i3) {
        if (t3 === e3.length - 1)
          return e3[t3].getTrimmedLength();
        const s2 = !e3[t3].hasContent(i3 - 1) && e3[t3].getWidth(i3 - 1) === 1, r2 = e3[t3 + 1].getWidth(0) === 2;
        return s2 && r2 ? i3 - 1 : i3;
      }
      Object.defineProperty(t2, "__esModule", { value: true }), t2.getWrappedLineTrimmedLength = t2.reflowSmallerGetNewLineLengths = t2.reflowLargerApplyNewLayout = t2.reflowLargerCreateNewLayout = t2.reflowLargerGetLinesToRemove = undefined, t2.reflowLargerGetLinesToRemove = function(e3, t3, s2, r2, n2) {
        const a = [];
        for (let o = 0;o < e3.length - 1; o++) {
          let h = o, c = e3.get(++h);
          if (!c.isWrapped)
            continue;
          const l = [e3.get(o)];
          for (;h < e3.length && c.isWrapped; )
            l.push(c), c = e3.get(++h);
          if (r2 >= o && r2 < h) {
            o += l.length - 1;
            continue;
          }
          let _ = 0, d = i2(l, _, t3), f = 1, u = 0;
          for (;f < l.length; ) {
            const e4 = i2(l, f, t3), r3 = e4 - u, a2 = s2 - d, o2 = Math.min(r3, a2);
            l[_].copyCellsFrom(l[f], u, d, o2, false), d += o2, d === s2 && (_++, d = 0), u += o2, u === e4 && (f++, u = 0), d === 0 && _ !== 0 && l[_ - 1].getWidth(s2 - 1) === 2 && (l[_].copyCellsFrom(l[_ - 1], s2 - 1, d++, 1, false), l[_ - 1].setCell(s2 - 1, n2));
          }
          l[_].replaceCells(d, s2, n2);
          let p = 0;
          for (let e4 = l.length - 1;e4 > 0 && (e4 > _ || l[e4].getTrimmedLength() === 0); e4--)
            p++;
          p > 0 && (a.push(o + l.length - p), a.push(p)), o += l.length - 1;
        }
        return a;
      }, t2.reflowLargerCreateNewLayout = function(e3, t3) {
        const i3 = [];
        let s2 = 0, r2 = t3[s2], n2 = 0;
        for (let a = 0;a < e3.length; a++)
          if (r2 === a) {
            const i4 = t3[++s2];
            e3.onDeleteEmitter.fire({ index: a - n2, amount: i4 }), a += i4 - 1, n2 += i4, r2 = t3[++s2];
          } else
            i3.push(a);
        return { layout: i3, countRemoved: n2 };
      }, t2.reflowLargerApplyNewLayout = function(e3, t3) {
        const i3 = [];
        for (let s2 = 0;s2 < t3.length; s2++)
          i3.push(e3.get(t3[s2]));
        for (let t4 = 0;t4 < i3.length; t4++)
          e3.set(t4, i3[t4]);
        e3.length = t3.length;
      }, t2.reflowSmallerGetNewLineLengths = function(e3, t3, s2) {
        const r2 = [], n2 = e3.map((s3, r3) => i2(e3, r3, t3)).reduce((e4, t4) => e4 + t4);
        let a = 0, o = 0, h = 0;
        for (;h < n2; ) {
          if (n2 - h < s2) {
            r2.push(n2 - h);
            break;
          }
          a += s2;
          const c = i2(e3, o, t3);
          a > c && (a -= c, o++);
          const l = e3[o].getWidth(a - 1) === 2;
          l && a--;
          const _ = l ? s2 - 1 : s2;
          r2.push(_), h += _;
        }
        return r2;
      }, t2.getWrappedLineTrimmedLength = i2;
    }, 295: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferSet = undefined;
      const s2 = i2(460), r2 = i2(844), n2 = i2(92);

      class a extends r2.Disposable {
        constructor(e3, t3) {
          super(), this._optionsService = e3, this._bufferService = t3, this._onBufferActivate = this.register(new s2.EventEmitter), this.onBufferActivate = this._onBufferActivate.event, this.reset(), this.register(this._optionsService.onSpecificOptionChange("scrollback", () => this.resize(this._bufferService.cols, this._bufferService.rows))), this.register(this._optionsService.onSpecificOptionChange("tabStopWidth", () => this.setupTabStops()));
        }
        reset() {
          this._normal = new n2.Buffer(true, this._optionsService, this._bufferService), this._normal.fillViewportRows(), this._alt = new n2.Buffer(false, this._optionsService, this._bufferService), this._activeBuffer = this._normal, this._onBufferActivate.fire({ activeBuffer: this._normal, inactiveBuffer: this._alt }), this.setupTabStops();
        }
        get alt() {
          return this._alt;
        }
        get active() {
          return this._activeBuffer;
        }
        get normal() {
          return this._normal;
        }
        activateNormalBuffer() {
          this._activeBuffer !== this._normal && (this._normal.x = this._alt.x, this._normal.y = this._alt.y, this._alt.clearAllMarkers(), this._alt.clear(), this._activeBuffer = this._normal, this._onBufferActivate.fire({ activeBuffer: this._normal, inactiveBuffer: this._alt }));
        }
        activateAltBuffer(e3) {
          this._activeBuffer !== this._alt && (this._alt.fillViewportRows(e3), this._alt.x = this._normal.x, this._alt.y = this._normal.y, this._activeBuffer = this._alt, this._onBufferActivate.fire({ activeBuffer: this._alt, inactiveBuffer: this._normal }));
        }
        resize(e3, t3) {
          this._normal.resize(e3, t3), this._alt.resize(e3, t3), this.setupTabStops(e3);
        }
        setupTabStops(e3) {
          this._normal.setupTabStops(e3), this._alt.setupTabStops(e3);
        }
      }
      t2.BufferSet = a;
    }, 511: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CellData = undefined;
      const s2 = i2(482), r2 = i2(643), n2 = i2(734);

      class a extends n2.AttributeData {
        constructor() {
          super(...arguments), this.content = 0, this.fg = 0, this.bg = 0, this.extended = new n2.ExtendedAttrs, this.combinedData = "";
        }
        static fromCharData(e3) {
          const t3 = new a;
          return t3.setFromCharData(e3), t3;
        }
        isCombined() {
          return 2097152 & this.content;
        }
        getWidth() {
          return this.content >> 22;
        }
        getChars() {
          return 2097152 & this.content ? this.combinedData : 2097151 & this.content ? (0, s2.stringFromCodePoint)(2097151 & this.content) : "";
        }
        getCode() {
          return this.isCombined() ? this.combinedData.charCodeAt(this.combinedData.length - 1) : 2097151 & this.content;
        }
        setFromCharData(e3) {
          this.fg = e3[r2.CHAR_DATA_ATTR_INDEX], this.bg = 0;
          let t3 = false;
          if (e3[r2.CHAR_DATA_CHAR_INDEX].length > 2)
            t3 = true;
          else if (e3[r2.CHAR_DATA_CHAR_INDEX].length === 2) {
            const i3 = e3[r2.CHAR_DATA_CHAR_INDEX].charCodeAt(0);
            if (55296 <= i3 && i3 <= 56319) {
              const s3 = e3[r2.CHAR_DATA_CHAR_INDEX].charCodeAt(1);
              56320 <= s3 && s3 <= 57343 ? this.content = 1024 * (i3 - 55296) + s3 - 56320 + 65536 | e3[r2.CHAR_DATA_WIDTH_INDEX] << 22 : t3 = true;
            } else
              t3 = true;
          } else
            this.content = e3[r2.CHAR_DATA_CHAR_INDEX].charCodeAt(0) | e3[r2.CHAR_DATA_WIDTH_INDEX] << 22;
          t3 && (this.combinedData = e3[r2.CHAR_DATA_CHAR_INDEX], this.content = 2097152 | e3[r2.CHAR_DATA_WIDTH_INDEX] << 22);
        }
        getAsCharData() {
          return [this.fg, this.getChars(), this.getWidth(), this.getCode()];
        }
      }
      t2.CellData = a;
    }, 643: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.WHITESPACE_CELL_CODE = t2.WHITESPACE_CELL_WIDTH = t2.WHITESPACE_CELL_CHAR = t2.NULL_CELL_CODE = t2.NULL_CELL_WIDTH = t2.NULL_CELL_CHAR = t2.CHAR_DATA_CODE_INDEX = t2.CHAR_DATA_WIDTH_INDEX = t2.CHAR_DATA_CHAR_INDEX = t2.CHAR_DATA_ATTR_INDEX = t2.DEFAULT_EXT = t2.DEFAULT_ATTR = t2.DEFAULT_COLOR = undefined, t2.DEFAULT_COLOR = 0, t2.DEFAULT_ATTR = 256 | t2.DEFAULT_COLOR << 9, t2.DEFAULT_EXT = 0, t2.CHAR_DATA_ATTR_INDEX = 0, t2.CHAR_DATA_CHAR_INDEX = 1, t2.CHAR_DATA_WIDTH_INDEX = 2, t2.CHAR_DATA_CODE_INDEX = 3, t2.NULL_CELL_CHAR = "", t2.NULL_CELL_WIDTH = 1, t2.NULL_CELL_CODE = 0, t2.WHITESPACE_CELL_CHAR = " ", t2.WHITESPACE_CELL_WIDTH = 1, t2.WHITESPACE_CELL_CODE = 32;
    }, 863: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.Marker = undefined;
      const s2 = i2(460), r2 = i2(844);

      class n2 {
        get id() {
          return this._id;
        }
        constructor(e3) {
          this.line = e3, this.isDisposed = false, this._disposables = [], this._id = n2._nextId++, this._onDispose = this.register(new s2.EventEmitter), this.onDispose = this._onDispose.event;
        }
        dispose() {
          this.isDisposed || (this.isDisposed = true, this.line = -1, this._onDispose.fire(), (0, r2.disposeArray)(this._disposables), this._disposables.length = 0);
        }
        register(e3) {
          return this._disposables.push(e3), e3;
        }
      }
      t2.Marker = n2, n2._nextId = 1;
    }, 116: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.DEFAULT_CHARSET = t2.CHARSETS = undefined, t2.CHARSETS = {}, t2.DEFAULT_CHARSET = t2.CHARSETS.B, t2.CHARSETS[0] = { "`": "◆", a: "▒", b: "␉", c: "␌", d: "␍", e: "␊", f: "°", g: "±", h: "␤", i: "␋", j: "┘", k: "┐", l: "┌", m: "└", n: "┼", o: "⎺", p: "⎻", q: "─", r: "⎼", s: "⎽", t: "├", u: "┤", v: "┴", w: "┬", x: "│", y: "≤", z: "≥", "{": "π", "|": "≠", "}": "£", "~": "·" }, t2.CHARSETS.A = { "#": "£" }, t2.CHARSETS.B = undefined, t2.CHARSETS[4] = { "#": "£", "@": "¾", "[": "ij", "\\": "½", "]": "|", "{": "¨", "|": "f", "}": "¼", "~": "´" }, t2.CHARSETS.C = t2.CHARSETS[5] = { "[": "Ä", "\\": "Ö", "]": "Å", "^": "Ü", "`": "é", "{": "ä", "|": "ö", "}": "å", "~": "ü" }, t2.CHARSETS.R = { "#": "£", "@": "à", "[": "°", "\\": "ç", "]": "§", "{": "é", "|": "ù", "}": "è", "~": "¨" }, t2.CHARSETS.Q = { "@": "à", "[": "â", "\\": "ç", "]": "ê", "^": "î", "`": "ô", "{": "é", "|": "ù", "}": "è", "~": "û" }, t2.CHARSETS.K = { "@": "§", "[": "Ä", "\\": "Ö", "]": "Ü", "{": "ä", "|": "ö", "}": "ü", "~": "ß" }, t2.CHARSETS.Y = { "#": "£", "@": "§", "[": "°", "\\": "ç", "]": "é", "`": "ù", "{": "à", "|": "ò", "}": "è", "~": "ì" }, t2.CHARSETS.E = t2.CHARSETS[6] = { "@": "Ä", "[": "Æ", "\\": "Ø", "]": "Å", "^": "Ü", "`": "ä", "{": "æ", "|": "ø", "}": "å", "~": "ü" }, t2.CHARSETS.Z = { "#": "£", "@": "§", "[": "¡", "\\": "Ñ", "]": "¿", "{": "°", "|": "ñ", "}": "ç" }, t2.CHARSETS.H = t2.CHARSETS[7] = { "@": "É", "[": "Ä", "\\": "Ö", "]": "Å", "^": "Ü", "`": "é", "{": "ä", "|": "ö", "}": "å", "~": "ü" }, t2.CHARSETS["="] = { "#": "ù", "@": "à", "[": "é", "\\": "ç", "]": "ê", "^": "î", _: "è", "`": "ô", "{": "ä", "|": "ö", "}": "ü", "~": "û" };
    }, 584: (e2, t2) => {
      var i2, s2, r2;
      Object.defineProperty(t2, "__esModule", { value: true }), t2.C1_ESCAPED = t2.C1 = t2.C0 = undefined, function(e3) {
        e3.NUL = "\x00", e3.SOH = "\x01", e3.STX = "\x02", e3.ETX = "\x03", e3.EOT = "\x04", e3.ENQ = "\x05", e3.ACK = "\x06", e3.BEL = "\x07", e3.BS = "\b", e3.HT = "\t", e3.LF = `
`, e3.VT = "\v", e3.FF = "\f", e3.CR = "\r", e3.SO = "\x0E", e3.SI = "\x0F", e3.DLE = "\x10", e3.DC1 = "\x11", e3.DC2 = "\x12", e3.DC3 = "\x13", e3.DC4 = "\x14", e3.NAK = "\x15", e3.SYN = "\x16", e3.ETB = "\x17", e3.CAN = "\x18", e3.EM = "\x19", e3.SUB = "\x1A", e3.ESC = "\x1B", e3.FS = "\x1C", e3.GS = "\x1D", e3.RS = "\x1E", e3.US = "\x1F", e3.SP = " ", e3.DEL = "";
      }(i2 || (t2.C0 = i2 = {})), function(e3) {
        e3.PAD = "", e3.HOP = "", e3.BPH = "", e3.NBH = "", e3.IND = "", e3.NEL = "", e3.SSA = "", e3.ESA = "", e3.HTS = "", e3.HTJ = "", e3.VTS = "", e3.PLD = "", e3.PLU = "", e3.RI = "", e3.SS2 = "", e3.SS3 = "", e3.DCS = "", e3.PU1 = "", e3.PU2 = "", e3.STS = "", e3.CCH = "", e3.MW = "", e3.SPA = "", e3.EPA = "", e3.SOS = "", e3.SGCI = "", e3.SCI = "", e3.CSI = "", e3.ST = "", e3.OSC = "", e3.PM = "", e3.APC = "";
      }(s2 || (t2.C1 = s2 = {})), function(e3) {
        e3.ST = `${i2.ESC}\\`;
      }(r2 || (t2.C1_ESCAPED = r2 = {}));
    }, 482: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.Utf8ToUtf32 = t2.StringToUtf32 = t2.utf32ToString = t2.stringFromCodePoint = undefined, t2.stringFromCodePoint = function(e3) {
        return e3 > 65535 ? (e3 -= 65536, String.fromCharCode(55296 + (e3 >> 10)) + String.fromCharCode(e3 % 1024 + 56320)) : String.fromCharCode(e3);
      }, t2.utf32ToString = function(e3, t3 = 0, i2 = e3.length) {
        let s2 = "";
        for (let r2 = t3;r2 < i2; ++r2) {
          let t4 = e3[r2];
          t4 > 65535 ? (t4 -= 65536, s2 += String.fromCharCode(55296 + (t4 >> 10)) + String.fromCharCode(t4 % 1024 + 56320)) : s2 += String.fromCharCode(t4);
        }
        return s2;
      }, t2.StringToUtf32 = class {
        constructor() {
          this._interim = 0;
        }
        clear() {
          this._interim = 0;
        }
        decode(e3, t3) {
          const i2 = e3.length;
          if (!i2)
            return 0;
          let s2 = 0, r2 = 0;
          if (this._interim) {
            const i3 = e3.charCodeAt(r2++);
            56320 <= i3 && i3 <= 57343 ? t3[s2++] = 1024 * (this._interim - 55296) + i3 - 56320 + 65536 : (t3[s2++] = this._interim, t3[s2++] = i3), this._interim = 0;
          }
          for (let n2 = r2;n2 < i2; ++n2) {
            const r3 = e3.charCodeAt(n2);
            if (55296 <= r3 && r3 <= 56319) {
              if (++n2 >= i2)
                return this._interim = r3, s2;
              const a = e3.charCodeAt(n2);
              56320 <= a && a <= 57343 ? t3[s2++] = 1024 * (r3 - 55296) + a - 56320 + 65536 : (t3[s2++] = r3, t3[s2++] = a);
            } else
              r3 !== 65279 && (t3[s2++] = r3);
          }
          return s2;
        }
      }, t2.Utf8ToUtf32 = class {
        constructor() {
          this.interim = new Uint8Array(3);
        }
        clear() {
          this.interim.fill(0);
        }
        decode(e3, t3) {
          const i2 = e3.length;
          if (!i2)
            return 0;
          let s2, r2, n2, a, o = 0, h = 0, c = 0;
          if (this.interim[0]) {
            let s3 = false, r3 = this.interim[0];
            r3 &= (224 & r3) == 192 ? 31 : (240 & r3) == 224 ? 15 : 7;
            let n3, a2 = 0;
            for (;(n3 = 63 & this.interim[++a2]) && a2 < 4; )
              r3 <<= 6, r3 |= n3;
            const h2 = (224 & this.interim[0]) == 192 ? 2 : (240 & this.interim[0]) == 224 ? 3 : 4, l2 = h2 - a2;
            for (;c < l2; ) {
              if (c >= i2)
                return 0;
              if (n3 = e3[c++], (192 & n3) != 128) {
                c--, s3 = true;
                break;
              }
              this.interim[a2++] = n3, r3 <<= 6, r3 |= 63 & n3;
            }
            s3 || (h2 === 2 ? r3 < 128 ? c-- : t3[o++] = r3 : h2 === 3 ? r3 < 2048 || r3 >= 55296 && r3 <= 57343 || r3 === 65279 || (t3[o++] = r3) : r3 < 65536 || r3 > 1114111 || (t3[o++] = r3)), this.interim.fill(0);
          }
          const l = i2 - 4;
          let _ = c;
          for (;_ < i2; ) {
            for (;!(!(_ < l) || 128 & (s2 = e3[_]) || 128 & (r2 = e3[_ + 1]) || 128 & (n2 = e3[_ + 2]) || 128 & (a = e3[_ + 3])); )
              t3[o++] = s2, t3[o++] = r2, t3[o++] = n2, t3[o++] = a, _ += 4;
            if (s2 = e3[_++], s2 < 128)
              t3[o++] = s2;
            else if ((224 & s2) == 192) {
              if (_ >= i2)
                return this.interim[0] = s2, o;
              if (r2 = e3[_++], (192 & r2) != 128) {
                _--;
                continue;
              }
              if (h = (31 & s2) << 6 | 63 & r2, h < 128) {
                _--;
                continue;
              }
              t3[o++] = h;
            } else if ((240 & s2) == 224) {
              if (_ >= i2)
                return this.interim[0] = s2, o;
              if (r2 = e3[_++], (192 & r2) != 128) {
                _--;
                continue;
              }
              if (_ >= i2)
                return this.interim[0] = s2, this.interim[1] = r2, o;
              if (n2 = e3[_++], (192 & n2) != 128) {
                _--;
                continue;
              }
              if (h = (15 & s2) << 12 | (63 & r2) << 6 | 63 & n2, h < 2048 || h >= 55296 && h <= 57343 || h === 65279)
                continue;
              t3[o++] = h;
            } else if ((248 & s2) == 240) {
              if (_ >= i2)
                return this.interim[0] = s2, o;
              if (r2 = e3[_++], (192 & r2) != 128) {
                _--;
                continue;
              }
              if (_ >= i2)
                return this.interim[0] = s2, this.interim[1] = r2, o;
              if (n2 = e3[_++], (192 & n2) != 128) {
                _--;
                continue;
              }
              if (_ >= i2)
                return this.interim[0] = s2, this.interim[1] = r2, this.interim[2] = n2, o;
              if (a = e3[_++], (192 & a) != 128) {
                _--;
                continue;
              }
              if (h = (7 & s2) << 18 | (63 & r2) << 12 | (63 & n2) << 6 | 63 & a, h < 65536 || h > 1114111)
                continue;
              t3[o++] = h;
            }
          }
          return o;
        }
      };
    }, 225: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.UnicodeV6 = undefined;
      const s2 = i2(480), r2 = [[768, 879], [1155, 1158], [1160, 1161], [1425, 1469], [1471, 1471], [1473, 1474], [1476, 1477], [1479, 1479], [1536, 1539], [1552, 1557], [1611, 1630], [1648, 1648], [1750, 1764], [1767, 1768], [1770, 1773], [1807, 1807], [1809, 1809], [1840, 1866], [1958, 1968], [2027, 2035], [2305, 2306], [2364, 2364], [2369, 2376], [2381, 2381], [2385, 2388], [2402, 2403], [2433, 2433], [2492, 2492], [2497, 2500], [2509, 2509], [2530, 2531], [2561, 2562], [2620, 2620], [2625, 2626], [2631, 2632], [2635, 2637], [2672, 2673], [2689, 2690], [2748, 2748], [2753, 2757], [2759, 2760], [2765, 2765], [2786, 2787], [2817, 2817], [2876, 2876], [2879, 2879], [2881, 2883], [2893, 2893], [2902, 2902], [2946, 2946], [3008, 3008], [3021, 3021], [3134, 3136], [3142, 3144], [3146, 3149], [3157, 3158], [3260, 3260], [3263, 3263], [3270, 3270], [3276, 3277], [3298, 3299], [3393, 3395], [3405, 3405], [3530, 3530], [3538, 3540], [3542, 3542], [3633, 3633], [3636, 3642], [3655, 3662], [3761, 3761], [3764, 3769], [3771, 3772], [3784, 3789], [3864, 3865], [3893, 3893], [3895, 3895], [3897, 3897], [3953, 3966], [3968, 3972], [3974, 3975], [3984, 3991], [3993, 4028], [4038, 4038], [4141, 4144], [4146, 4146], [4150, 4151], [4153, 4153], [4184, 4185], [4448, 4607], [4959, 4959], [5906, 5908], [5938, 5940], [5970, 5971], [6002, 6003], [6068, 6069], [6071, 6077], [6086, 6086], [6089, 6099], [6109, 6109], [6155, 6157], [6313, 6313], [6432, 6434], [6439, 6440], [6450, 6450], [6457, 6459], [6679, 6680], [6912, 6915], [6964, 6964], [6966, 6970], [6972, 6972], [6978, 6978], [7019, 7027], [7616, 7626], [7678, 7679], [8203, 8207], [8234, 8238], [8288, 8291], [8298, 8303], [8400, 8431], [12330, 12335], [12441, 12442], [43014, 43014], [43019, 43019], [43045, 43046], [64286, 64286], [65024, 65039], [65056, 65059], [65279, 65279], [65529, 65531]], n2 = [[68097, 68099], [68101, 68102], [68108, 68111], [68152, 68154], [68159, 68159], [119143, 119145], [119155, 119170], [119173, 119179], [119210, 119213], [119362, 119364], [917505, 917505], [917536, 917631], [917760, 917999]];
      let a;
      t2.UnicodeV6 = class {
        constructor() {
          if (this.version = "6", !a) {
            a = new Uint8Array(65536), a.fill(1), a[0] = 0, a.fill(0, 1, 32), a.fill(0, 127, 160), a.fill(2, 4352, 4448), a[9001] = 2, a[9002] = 2, a.fill(2, 11904, 42192), a[12351] = 1, a.fill(2, 44032, 55204), a.fill(2, 63744, 64256), a.fill(2, 65040, 65050), a.fill(2, 65072, 65136), a.fill(2, 65280, 65377), a.fill(2, 65504, 65511);
            for (let e3 = 0;e3 < r2.length; ++e3)
              a.fill(0, r2[e3][0], r2[e3][1] + 1);
          }
        }
        wcwidth(e3) {
          return e3 < 32 ? 0 : e3 < 127 ? 1 : e3 < 65536 ? a[e3] : function(e4, t3) {
            let i3, s3 = 0, r3 = t3.length - 1;
            if (e4 < t3[0][0] || e4 > t3[r3][1])
              return false;
            for (;r3 >= s3; )
              if (i3 = s3 + r3 >> 1, e4 > t3[i3][1])
                s3 = i3 + 1;
              else {
                if (!(e4 < t3[i3][0]))
                  return true;
                r3 = i3 - 1;
              }
            return false;
          }(e3, n2) ? 0 : e3 >= 131072 && e3 <= 196605 || e3 >= 196608 && e3 <= 262141 ? 2 : 1;
        }
        charProperties(e3, t3) {
          let i3 = this.wcwidth(e3), r3 = i3 === 0 && t3 !== 0;
          if (r3) {
            const e4 = s2.UnicodeService.extractWidth(t3);
            e4 === 0 ? r3 = false : e4 > i3 && (i3 = e4);
          }
          return s2.UnicodeService.createPropertyValue(0, i3, r3);
        }
      };
    }, 981: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.WriteBuffer = undefined;
      const s2 = i2(460), r2 = i2(844);

      class n2 extends r2.Disposable {
        constructor(e3) {
          super(), this._action = e3, this._writeBuffer = [], this._callbacks = [], this._pendingData = 0, this._bufferOffset = 0, this._isSyncWriting = false, this._syncCalls = 0, this._didUserInput = false, this._onWriteParsed = this.register(new s2.EventEmitter), this.onWriteParsed = this._onWriteParsed.event;
        }
        handleUserInput() {
          this._didUserInput = true;
        }
        writeSync(e3, t3) {
          if (t3 !== undefined && this._syncCalls > t3)
            return void (this._syncCalls = 0);
          if (this._pendingData += e3.length, this._writeBuffer.push(e3), this._callbacks.push(undefined), this._syncCalls++, this._isSyncWriting)
            return;
          let i3;
          for (this._isSyncWriting = true;i3 = this._writeBuffer.shift(); ) {
            this._action(i3);
            const e4 = this._callbacks.shift();
            e4 && e4();
          }
          this._pendingData = 0, this._bufferOffset = 2147483647, this._isSyncWriting = false, this._syncCalls = 0;
        }
        write(e3, t3) {
          if (this._pendingData > 50000000)
            throw new Error("write data discarded, use flow control to avoid losing data");
          if (!this._writeBuffer.length) {
            if (this._bufferOffset = 0, this._didUserInput)
              return this._didUserInput = false, this._pendingData += e3.length, this._writeBuffer.push(e3), this._callbacks.push(t3), void this._innerWrite();
            setTimeout(() => this._innerWrite());
          }
          this._pendingData += e3.length, this._writeBuffer.push(e3), this._callbacks.push(t3);
        }
        _innerWrite(e3 = 0, t3 = true) {
          const i3 = e3 || Date.now();
          for (;this._writeBuffer.length > this._bufferOffset; ) {
            const e4 = this._writeBuffer[this._bufferOffset], s3 = this._action(e4, t3);
            if (s3) {
              const e5 = (e6) => Date.now() - i3 >= 12 ? setTimeout(() => this._innerWrite(0, e6)) : this._innerWrite(i3, e6);
              return void s3.catch((e6) => (queueMicrotask(() => {
                throw e6;
              }), Promise.resolve(false))).then(e5);
            }
            const r3 = this._callbacks[this._bufferOffset];
            if (r3 && r3(), this._bufferOffset++, this._pendingData -= e4.length, Date.now() - i3 >= 12)
              break;
          }
          this._writeBuffer.length > this._bufferOffset ? (this._bufferOffset > 50 && (this._writeBuffer = this._writeBuffer.slice(this._bufferOffset), this._callbacks = this._callbacks.slice(this._bufferOffset), this._bufferOffset = 0), setTimeout(() => this._innerWrite())) : (this._writeBuffer.length = 0, this._callbacks.length = 0, this._pendingData = 0, this._bufferOffset = 0), this._onWriteParsed.fire();
        }
      }
      t2.WriteBuffer = n2;
    }, 941: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.toRgbString = t2.parseColor = undefined;
      const i2 = /^([\da-f])\/([\da-f])\/([\da-f])$|^([\da-f]{2})\/([\da-f]{2})\/([\da-f]{2})$|^([\da-f]{3})\/([\da-f]{3})\/([\da-f]{3})$|^([\da-f]{4})\/([\da-f]{4})\/([\da-f]{4})$/, s2 = /^[\da-f]+$/;
      function r2(e3, t3) {
        const i3 = e3.toString(16), s3 = i3.length < 2 ? "0" + i3 : i3;
        switch (t3) {
          case 4:
            return i3[0];
          case 8:
            return s3;
          case 12:
            return (s3 + s3).slice(0, 3);
          default:
            return s3 + s3;
        }
      }
      t2.parseColor = function(e3) {
        if (!e3)
          return;
        let t3 = e3.toLowerCase();
        if (t3.indexOf("rgb:") === 0) {
          t3 = t3.slice(4);
          const e4 = i2.exec(t3);
          if (e4) {
            const t4 = e4[1] ? 15 : e4[4] ? 255 : e4[7] ? 4095 : 65535;
            return [Math.round(parseInt(e4[1] || e4[4] || e4[7] || e4[10], 16) / t4 * 255), Math.round(parseInt(e4[2] || e4[5] || e4[8] || e4[11], 16) / t4 * 255), Math.round(parseInt(e4[3] || e4[6] || e4[9] || e4[12], 16) / t4 * 255)];
          }
        } else if (t3.indexOf("#") === 0 && (t3 = t3.slice(1), s2.exec(t3) && [3, 6, 9, 12].includes(t3.length))) {
          const e4 = t3.length / 3, i3 = [0, 0, 0];
          for (let s3 = 0;s3 < 3; ++s3) {
            const r3 = parseInt(t3.slice(e4 * s3, e4 * s3 + e4), 16);
            i3[s3] = e4 === 1 ? r3 << 4 : e4 === 2 ? r3 : e4 === 3 ? r3 >> 4 : r3 >> 8;
          }
          return i3;
        }
      }, t2.toRgbString = function(e3, t3 = 16) {
        const [i3, s3, n2] = e3;
        return `rgb:${r2(i3, t3)}/${r2(s3, t3)}/${r2(n2, t3)}`;
      };
    }, 770: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.PAYLOAD_LIMIT = undefined, t2.PAYLOAD_LIMIT = 1e7;
    }, 351: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.DcsHandler = t2.DcsParser = undefined;
      const s2 = i2(482), r2 = i2(742), n2 = i2(770), a = [];
      t2.DcsParser = class {
        constructor() {
          this._handlers = Object.create(null), this._active = a, this._ident = 0, this._handlerFb = () => {}, this._stack = { paused: false, loopPosition: 0, fallThrough: false };
        }
        dispose() {
          this._handlers = Object.create(null), this._handlerFb = () => {}, this._active = a;
        }
        registerHandler(e3, t3) {
          this._handlers[e3] === undefined && (this._handlers[e3] = []);
          const i3 = this._handlers[e3];
          return i3.push(t3), { dispose: () => {
            const e4 = i3.indexOf(t3);
            e4 !== -1 && i3.splice(e4, 1);
          } };
        }
        clearHandler(e3) {
          this._handlers[e3] && delete this._handlers[e3];
        }
        setHandlerFallback(e3) {
          this._handlerFb = e3;
        }
        reset() {
          if (this._active.length)
            for (let e3 = this._stack.paused ? this._stack.loopPosition - 1 : this._active.length - 1;e3 >= 0; --e3)
              this._active[e3].unhook(false);
          this._stack.paused = false, this._active = a, this._ident = 0;
        }
        hook(e3, t3) {
          if (this.reset(), this._ident = e3, this._active = this._handlers[e3] || a, this._active.length)
            for (let e4 = this._active.length - 1;e4 >= 0; e4--)
              this._active[e4].hook(t3);
          else
            this._handlerFb(this._ident, "HOOK", t3);
        }
        put(e3, t3, i3) {
          if (this._active.length)
            for (let s3 = this._active.length - 1;s3 >= 0; s3--)
              this._active[s3].put(e3, t3, i3);
          else
            this._handlerFb(this._ident, "PUT", (0, s2.utf32ToString)(e3, t3, i3));
        }
        unhook(e3, t3 = true) {
          if (this._active.length) {
            let i3 = false, s3 = this._active.length - 1, r3 = false;
            if (this._stack.paused && (s3 = this._stack.loopPosition - 1, i3 = t3, r3 = this._stack.fallThrough, this._stack.paused = false), !r3 && i3 === false) {
              for (;s3 >= 0 && (i3 = this._active[s3].unhook(e3), i3 !== true); s3--)
                if (i3 instanceof Promise)
                  return this._stack.paused = true, this._stack.loopPosition = s3, this._stack.fallThrough = false, i3;
              s3--;
            }
            for (;s3 >= 0; s3--)
              if (i3 = this._active[s3].unhook(false), i3 instanceof Promise)
                return this._stack.paused = true, this._stack.loopPosition = s3, this._stack.fallThrough = true, i3;
          } else
            this._handlerFb(this._ident, "UNHOOK", e3);
          this._active = a, this._ident = 0;
        }
      };
      const o = new r2.Params;
      o.addParam(0), t2.DcsHandler = class {
        constructor(e3) {
          this._handler = e3, this._data = "", this._params = o, this._hitLimit = false;
        }
        hook(e3) {
          this._params = e3.length > 1 || e3.params[0] ? e3.clone() : o, this._data = "", this._hitLimit = false;
        }
        put(e3, t3, i3) {
          this._hitLimit || (this._data += (0, s2.utf32ToString)(e3, t3, i3), this._data.length > n2.PAYLOAD_LIMIT && (this._data = "", this._hitLimit = true));
        }
        unhook(e3) {
          let t3 = false;
          if (this._hitLimit)
            t3 = false;
          else if (e3 && (t3 = this._handler(this._data, this._params), t3 instanceof Promise))
            return t3.then((e4) => (this._params = o, this._data = "", this._hitLimit = false, e4));
          return this._params = o, this._data = "", this._hitLimit = false, t3;
        }
      };
    }, 15: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.EscapeSequenceParser = t2.VT500_TRANSITION_TABLE = t2.TransitionTable = undefined;
      const s2 = i2(844), r2 = i2(742), n2 = i2(242), a = i2(351);

      class o {
        constructor(e3) {
          this.table = new Uint8Array(e3);
        }
        setDefault(e3, t3) {
          this.table.fill(e3 << 4 | t3);
        }
        add(e3, t3, i3, s3) {
          this.table[t3 << 8 | e3] = i3 << 4 | s3;
        }
        addMany(e3, t3, i3, s3) {
          for (let r3 = 0;r3 < e3.length; r3++)
            this.table[t3 << 8 | e3[r3]] = i3 << 4 | s3;
        }
      }
      t2.TransitionTable = o;
      const h = 160;
      t2.VT500_TRANSITION_TABLE = function() {
        const e3 = new o(4095), t3 = Array.apply(null, Array(256)).map((e4, t4) => t4), i3 = (e4, i4) => t3.slice(e4, i4), s3 = i3(32, 127), r3 = i3(0, 24);
        r3.push(25), r3.push.apply(r3, i3(28, 32));
        const n3 = i3(0, 14);
        let a2;
        for (a2 in e3.setDefault(1, 0), e3.addMany(s3, 0, 2, 0), n3)
          e3.addMany([24, 26, 153, 154], a2, 3, 0), e3.addMany(i3(128, 144), a2, 3, 0), e3.addMany(i3(144, 152), a2, 3, 0), e3.add(156, a2, 0, 0), e3.add(27, a2, 11, 1), e3.add(157, a2, 4, 8), e3.addMany([152, 158, 159], a2, 0, 7), e3.add(155, a2, 11, 3), e3.add(144, a2, 11, 9);
        return e3.addMany(r3, 0, 3, 0), e3.addMany(r3, 1, 3, 1), e3.add(127, 1, 0, 1), e3.addMany(r3, 8, 0, 8), e3.addMany(r3, 3, 3, 3), e3.add(127, 3, 0, 3), e3.addMany(r3, 4, 3, 4), e3.add(127, 4, 0, 4), e3.addMany(r3, 6, 3, 6), e3.addMany(r3, 5, 3, 5), e3.add(127, 5, 0, 5), e3.addMany(r3, 2, 3, 2), e3.add(127, 2, 0, 2), e3.add(93, 1, 4, 8), e3.addMany(s3, 8, 5, 8), e3.add(127, 8, 5, 8), e3.addMany([156, 27, 24, 26, 7], 8, 6, 0), e3.addMany(i3(28, 32), 8, 0, 8), e3.addMany([88, 94, 95], 1, 0, 7), e3.addMany(s3, 7, 0, 7), e3.addMany(r3, 7, 0, 7), e3.add(156, 7, 0, 0), e3.add(127, 7, 0, 7), e3.add(91, 1, 11, 3), e3.addMany(i3(64, 127), 3, 7, 0), e3.addMany(i3(48, 60), 3, 8, 4), e3.addMany([60, 61, 62, 63], 3, 9, 4), e3.addMany(i3(48, 60), 4, 8, 4), e3.addMany(i3(64, 127), 4, 7, 0), e3.addMany([60, 61, 62, 63], 4, 0, 6), e3.addMany(i3(32, 64), 6, 0, 6), e3.add(127, 6, 0, 6), e3.addMany(i3(64, 127), 6, 0, 0), e3.addMany(i3(32, 48), 3, 9, 5), e3.addMany(i3(32, 48), 5, 9, 5), e3.addMany(i3(48, 64), 5, 0, 6), e3.addMany(i3(64, 127), 5, 7, 0), e3.addMany(i3(32, 48), 4, 9, 5), e3.addMany(i3(32, 48), 1, 9, 2), e3.addMany(i3(32, 48), 2, 9, 2), e3.addMany(i3(48, 127), 2, 10, 0), e3.addMany(i3(48, 80), 1, 10, 0), e3.addMany(i3(81, 88), 1, 10, 0), e3.addMany([89, 90, 92], 1, 10, 0), e3.addMany(i3(96, 127), 1, 10, 0), e3.add(80, 1, 11, 9), e3.addMany(r3, 9, 0, 9), e3.add(127, 9, 0, 9), e3.addMany(i3(28, 32), 9, 0, 9), e3.addMany(i3(32, 48), 9, 9, 12), e3.addMany(i3(48, 60), 9, 8, 10), e3.addMany([60, 61, 62, 63], 9, 9, 10), e3.addMany(r3, 11, 0, 11), e3.addMany(i3(32, 128), 11, 0, 11), e3.addMany(i3(28, 32), 11, 0, 11), e3.addMany(r3, 10, 0, 10), e3.add(127, 10, 0, 10), e3.addMany(i3(28, 32), 10, 0, 10), e3.addMany(i3(48, 60), 10, 8, 10), e3.addMany([60, 61, 62, 63], 10, 0, 11), e3.addMany(i3(32, 48), 10, 9, 12), e3.addMany(r3, 12, 0, 12), e3.add(127, 12, 0, 12), e3.addMany(i3(28, 32), 12, 0, 12), e3.addMany(i3(32, 48), 12, 9, 12), e3.addMany(i3(48, 64), 12, 0, 11), e3.addMany(i3(64, 127), 12, 12, 13), e3.addMany(i3(64, 127), 10, 12, 13), e3.addMany(i3(64, 127), 9, 12, 13), e3.addMany(r3, 13, 13, 13), e3.addMany(s3, 13, 13, 13), e3.add(127, 13, 0, 13), e3.addMany([27, 156, 24, 26], 13, 14, 0), e3.add(h, 0, 2, 0), e3.add(h, 8, 5, 8), e3.add(h, 6, 0, 6), e3.add(h, 11, 0, 11), e3.add(h, 13, 13, 13), e3;
      }();

      class c extends s2.Disposable {
        constructor(e3 = t2.VT500_TRANSITION_TABLE) {
          super(), this._transitions = e3, this._parseStack = { state: 0, handlers: [], handlerPos: 0, transition: 0, chunkPos: 0 }, this.initialState = 0, this.currentState = this.initialState, this._params = new r2.Params, this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0, this._printHandlerFb = (e4, t3, i3) => {}, this._executeHandlerFb = (e4) => {}, this._csiHandlerFb = (e4, t3) => {}, this._escHandlerFb = (e4) => {}, this._errorHandlerFb = (e4) => e4, this._printHandler = this._printHandlerFb, this._executeHandlers = Object.create(null), this._csiHandlers = Object.create(null), this._escHandlers = Object.create(null), this.register((0, s2.toDisposable)(() => {
            this._csiHandlers = Object.create(null), this._executeHandlers = Object.create(null), this._escHandlers = Object.create(null);
          })), this._oscParser = this.register(new n2.OscParser), this._dcsParser = this.register(new a.DcsParser), this._errorHandler = this._errorHandlerFb, this.registerEscHandler({ final: "\\" }, () => true);
        }
        _identifier(e3, t3 = [64, 126]) {
          let i3 = 0;
          if (e3.prefix) {
            if (e3.prefix.length > 1)
              throw new Error("only one byte as prefix supported");
            if (i3 = e3.prefix.charCodeAt(0), i3 && 60 > i3 || i3 > 63)
              throw new Error("prefix must be in range 0x3c .. 0x3f");
          }
          if (e3.intermediates) {
            if (e3.intermediates.length > 2)
              throw new Error("only two bytes as intermediates are supported");
            for (let t4 = 0;t4 < e3.intermediates.length; ++t4) {
              const s4 = e3.intermediates.charCodeAt(t4);
              if (32 > s4 || s4 > 47)
                throw new Error("intermediate must be in range 0x20 .. 0x2f");
              i3 <<= 8, i3 |= s4;
            }
          }
          if (e3.final.length !== 1)
            throw new Error("final must be a single byte");
          const s3 = e3.final.charCodeAt(0);
          if (t3[0] > s3 || s3 > t3[1])
            throw new Error(`final must be in range ${t3[0]} .. ${t3[1]}`);
          return i3 <<= 8, i3 |= s3, i3;
        }
        identToString(e3) {
          const t3 = [];
          for (;e3; )
            t3.push(String.fromCharCode(255 & e3)), e3 >>= 8;
          return t3.reverse().join("");
        }
        setPrintHandler(e3) {
          this._printHandler = e3;
        }
        clearPrintHandler() {
          this._printHandler = this._printHandlerFb;
        }
        registerEscHandler(e3, t3) {
          const i3 = this._identifier(e3, [48, 126]);
          this._escHandlers[i3] === undefined && (this._escHandlers[i3] = []);
          const s3 = this._escHandlers[i3];
          return s3.push(t3), { dispose: () => {
            const e4 = s3.indexOf(t3);
            e4 !== -1 && s3.splice(e4, 1);
          } };
        }
        clearEscHandler(e3) {
          this._escHandlers[this._identifier(e3, [48, 126])] && delete this._escHandlers[this._identifier(e3, [48, 126])];
        }
        setEscHandlerFallback(e3) {
          this._escHandlerFb = e3;
        }
        setExecuteHandler(e3, t3) {
          this._executeHandlers[e3.charCodeAt(0)] = t3;
        }
        clearExecuteHandler(e3) {
          this._executeHandlers[e3.charCodeAt(0)] && delete this._executeHandlers[e3.charCodeAt(0)];
        }
        setExecuteHandlerFallback(e3) {
          this._executeHandlerFb = e3;
        }
        registerCsiHandler(e3, t3) {
          const i3 = this._identifier(e3);
          this._csiHandlers[i3] === undefined && (this._csiHandlers[i3] = []);
          const s3 = this._csiHandlers[i3];
          return s3.push(t3), { dispose: () => {
            const e4 = s3.indexOf(t3);
            e4 !== -1 && s3.splice(e4, 1);
          } };
        }
        clearCsiHandler(e3) {
          this._csiHandlers[this._identifier(e3)] && delete this._csiHandlers[this._identifier(e3)];
        }
        setCsiHandlerFallback(e3) {
          this._csiHandlerFb = e3;
        }
        registerDcsHandler(e3, t3) {
          return this._dcsParser.registerHandler(this._identifier(e3), t3);
        }
        clearDcsHandler(e3) {
          this._dcsParser.clearHandler(this._identifier(e3));
        }
        setDcsHandlerFallback(e3) {
          this._dcsParser.setHandlerFallback(e3);
        }
        registerOscHandler(e3, t3) {
          return this._oscParser.registerHandler(e3, t3);
        }
        clearOscHandler(e3) {
          this._oscParser.clearHandler(e3);
        }
        setOscHandlerFallback(e3) {
          this._oscParser.setHandlerFallback(e3);
        }
        setErrorHandler(e3) {
          this._errorHandler = e3;
        }
        clearErrorHandler() {
          this._errorHandler = this._errorHandlerFb;
        }
        reset() {
          this.currentState = this.initialState, this._oscParser.reset(), this._dcsParser.reset(), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0, this._parseStack.state !== 0 && (this._parseStack.state = 2, this._parseStack.handlers = []);
        }
        _preserveStack(e3, t3, i3, s3, r3) {
          this._parseStack.state = e3, this._parseStack.handlers = t3, this._parseStack.handlerPos = i3, this._parseStack.transition = s3, this._parseStack.chunkPos = r3;
        }
        parse(e3, t3, i3) {
          let s3, r3 = 0, n3 = 0, a2 = 0;
          if (this._parseStack.state)
            if (this._parseStack.state === 2)
              this._parseStack.state = 0, a2 = this._parseStack.chunkPos + 1;
            else {
              if (i3 === undefined || this._parseStack.state === 1)
                throw this._parseStack.state = 1, new Error("improper continuation due to previous async handler, giving up parsing");
              const t4 = this._parseStack.handlers;
              let n4 = this._parseStack.handlerPos - 1;
              switch (this._parseStack.state) {
                case 3:
                  if (i3 === false && n4 > -1) {
                    for (;n4 >= 0 && (s3 = t4[n4](this._params), s3 !== true); n4--)
                      if (s3 instanceof Promise)
                        return this._parseStack.handlerPos = n4, s3;
                  }
                  this._parseStack.handlers = [];
                  break;
                case 4:
                  if (i3 === false && n4 > -1) {
                    for (;n4 >= 0 && (s3 = t4[n4](), s3 !== true); n4--)
                      if (s3 instanceof Promise)
                        return this._parseStack.handlerPos = n4, s3;
                  }
                  this._parseStack.handlers = [];
                  break;
                case 6:
                  if (r3 = e3[this._parseStack.chunkPos], s3 = this._dcsParser.unhook(r3 !== 24 && r3 !== 26, i3), s3)
                    return s3;
                  r3 === 27 && (this._parseStack.transition |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0;
                  break;
                case 5:
                  if (r3 = e3[this._parseStack.chunkPos], s3 = this._oscParser.end(r3 !== 24 && r3 !== 26, i3), s3)
                    return s3;
                  r3 === 27 && (this._parseStack.transition |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0;
              }
              this._parseStack.state = 0, a2 = this._parseStack.chunkPos + 1, this.precedingJoinState = 0, this.currentState = 15 & this._parseStack.transition;
            }
          for (let i4 = a2;i4 < t3; ++i4) {
            switch (r3 = e3[i4], n3 = this._transitions.table[this.currentState << 8 | (r3 < 160 ? r3 : h)], n3 >> 4) {
              case 2:
                for (let s4 = i4 + 1;; ++s4) {
                  if (s4 >= t3 || (r3 = e3[s4]) < 32 || r3 > 126 && r3 < h) {
                    this._printHandler(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                  if (++s4 >= t3 || (r3 = e3[s4]) < 32 || r3 > 126 && r3 < h) {
                    this._printHandler(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                  if (++s4 >= t3 || (r3 = e3[s4]) < 32 || r3 > 126 && r3 < h) {
                    this._printHandler(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                  if (++s4 >= t3 || (r3 = e3[s4]) < 32 || r3 > 126 && r3 < h) {
                    this._printHandler(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                }
                break;
              case 3:
                this._executeHandlers[r3] ? this._executeHandlers[r3]() : this._executeHandlerFb(r3), this.precedingJoinState = 0;
                break;
              case 0:
                break;
              case 1:
                if (this._errorHandler({ position: i4, code: r3, currentState: this.currentState, collect: this._collect, params: this._params, abort: false }).abort)
                  return;
                break;
              case 7:
                const a3 = this._csiHandlers[this._collect << 8 | r3];
                let o2 = a3 ? a3.length - 1 : -1;
                for (;o2 >= 0 && (s3 = a3[o2](this._params), s3 !== true); o2--)
                  if (s3 instanceof Promise)
                    return this._preserveStack(3, a3, o2, n3, i4), s3;
                o2 < 0 && this._csiHandlerFb(this._collect << 8 | r3, this._params), this.precedingJoinState = 0;
                break;
              case 8:
                do {
                  switch (r3) {
                    case 59:
                      this._params.addParam(0);
                      break;
                    case 58:
                      this._params.addSubParam(-1);
                      break;
                    default:
                      this._params.addDigit(r3 - 48);
                  }
                } while (++i4 < t3 && (r3 = e3[i4]) > 47 && r3 < 60);
                i4--;
                break;
              case 9:
                this._collect <<= 8, this._collect |= r3;
                break;
              case 10:
                const c2 = this._escHandlers[this._collect << 8 | r3];
                let l = c2 ? c2.length - 1 : -1;
                for (;l >= 0 && (s3 = c2[l](), s3 !== true); l--)
                  if (s3 instanceof Promise)
                    return this._preserveStack(4, c2, l, n3, i4), s3;
                l < 0 && this._escHandlerFb(this._collect << 8 | r3), this.precedingJoinState = 0;
                break;
              case 11:
                this._params.reset(), this._params.addParam(0), this._collect = 0;
                break;
              case 12:
                this._dcsParser.hook(this._collect << 8 | r3, this._params);
                break;
              case 13:
                for (let s4 = i4 + 1;; ++s4)
                  if (s4 >= t3 || (r3 = e3[s4]) === 24 || r3 === 26 || r3 === 27 || r3 > 127 && r3 < h) {
                    this._dcsParser.put(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                break;
              case 14:
                if (s3 = this._dcsParser.unhook(r3 !== 24 && r3 !== 26), s3)
                  return this._preserveStack(6, [], 0, n3, i4), s3;
                r3 === 27 && (n3 |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0;
                break;
              case 4:
                this._oscParser.start();
                break;
              case 5:
                for (let s4 = i4 + 1;; s4++)
                  if (s4 >= t3 || (r3 = e3[s4]) < 32 || r3 > 127 && r3 < h) {
                    this._oscParser.put(e3, i4, s4), i4 = s4 - 1;
                    break;
                  }
                break;
              case 6:
                if (s3 = this._oscParser.end(r3 !== 24 && r3 !== 26), s3)
                  return this._preserveStack(5, [], 0, n3, i4), s3;
                r3 === 27 && (n3 |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0;
            }
            this.currentState = 15 & n3;
          }
        }
      }
      t2.EscapeSequenceParser = c;
    }, 242: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.OscHandler = t2.OscParser = undefined;
      const s2 = i2(770), r2 = i2(482), n2 = [];
      t2.OscParser = class {
        constructor() {
          this._state = 0, this._active = n2, this._id = -1, this._handlers = Object.create(null), this._handlerFb = () => {}, this._stack = { paused: false, loopPosition: 0, fallThrough: false };
        }
        registerHandler(e3, t3) {
          this._handlers[e3] === undefined && (this._handlers[e3] = []);
          const i3 = this._handlers[e3];
          return i3.push(t3), { dispose: () => {
            const e4 = i3.indexOf(t3);
            e4 !== -1 && i3.splice(e4, 1);
          } };
        }
        clearHandler(e3) {
          this._handlers[e3] && delete this._handlers[e3];
        }
        setHandlerFallback(e3) {
          this._handlerFb = e3;
        }
        dispose() {
          this._handlers = Object.create(null), this._handlerFb = () => {}, this._active = n2;
        }
        reset() {
          if (this._state === 2)
            for (let e3 = this._stack.paused ? this._stack.loopPosition - 1 : this._active.length - 1;e3 >= 0; --e3)
              this._active[e3].end(false);
          this._stack.paused = false, this._active = n2, this._id = -1, this._state = 0;
        }
        _start() {
          if (this._active = this._handlers[this._id] || n2, this._active.length)
            for (let e3 = this._active.length - 1;e3 >= 0; e3--)
              this._active[e3].start();
          else
            this._handlerFb(this._id, "START");
        }
        _put(e3, t3, i3) {
          if (this._active.length)
            for (let s3 = this._active.length - 1;s3 >= 0; s3--)
              this._active[s3].put(e3, t3, i3);
          else
            this._handlerFb(this._id, "PUT", (0, r2.utf32ToString)(e3, t3, i3));
        }
        start() {
          this.reset(), this._state = 1;
        }
        put(e3, t3, i3) {
          if (this._state !== 3) {
            if (this._state === 1)
              for (;t3 < i3; ) {
                const i4 = e3[t3++];
                if (i4 === 59) {
                  this._state = 2, this._start();
                  break;
                }
                if (i4 < 48 || 57 < i4)
                  return void (this._state = 3);
                this._id === -1 && (this._id = 0), this._id = 10 * this._id + i4 - 48;
              }
            this._state === 2 && i3 - t3 > 0 && this._put(e3, t3, i3);
          }
        }
        end(e3, t3 = true) {
          if (this._state !== 0) {
            if (this._state !== 3)
              if (this._state === 1 && this._start(), this._active.length) {
                let i3 = false, s3 = this._active.length - 1, r3 = false;
                if (this._stack.paused && (s3 = this._stack.loopPosition - 1, i3 = t3, r3 = this._stack.fallThrough, this._stack.paused = false), !r3 && i3 === false) {
                  for (;s3 >= 0 && (i3 = this._active[s3].end(e3), i3 !== true); s3--)
                    if (i3 instanceof Promise)
                      return this._stack.paused = true, this._stack.loopPosition = s3, this._stack.fallThrough = false, i3;
                  s3--;
                }
                for (;s3 >= 0; s3--)
                  if (i3 = this._active[s3].end(false), i3 instanceof Promise)
                    return this._stack.paused = true, this._stack.loopPosition = s3, this._stack.fallThrough = true, i3;
              } else
                this._handlerFb(this._id, "END", e3);
            this._active = n2, this._id = -1, this._state = 0;
          }
        }
      }, t2.OscHandler = class {
        constructor(e3) {
          this._handler = e3, this._data = "", this._hitLimit = false;
        }
        start() {
          this._data = "", this._hitLimit = false;
        }
        put(e3, t3, i3) {
          this._hitLimit || (this._data += (0, r2.utf32ToString)(e3, t3, i3), this._data.length > s2.PAYLOAD_LIMIT && (this._data = "", this._hitLimit = true));
        }
        end(e3) {
          let t3 = false;
          if (this._hitLimit)
            t3 = false;
          else if (e3 && (t3 = this._handler(this._data), t3 instanceof Promise))
            return t3.then((e4) => (this._data = "", this._hitLimit = false, e4));
          return this._data = "", this._hitLimit = false, t3;
        }
      };
    }, 742: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.Params = undefined;
      const i2 = 2147483647;

      class s2 {
        static fromArray(e3) {
          const t3 = new s2;
          if (!e3.length)
            return t3;
          for (let i3 = Array.isArray(e3[0]) ? 1 : 0;i3 < e3.length; ++i3) {
            const s3 = e3[i3];
            if (Array.isArray(s3))
              for (let e4 = 0;e4 < s3.length; ++e4)
                t3.addSubParam(s3[e4]);
            else
              t3.addParam(s3);
          }
          return t3;
        }
        constructor(e3 = 32, t3 = 32) {
          if (this.maxLength = e3, this.maxSubParamsLength = t3, t3 > 256)
            throw new Error("maxSubParamsLength must not be greater than 256");
          this.params = new Int32Array(e3), this.length = 0, this._subParams = new Int32Array(t3), this._subParamsLength = 0, this._subParamsIdx = new Uint16Array(e3), this._rejectDigits = false, this._rejectSubDigits = false, this._digitIsSub = false;
        }
        clone() {
          const e3 = new s2(this.maxLength, this.maxSubParamsLength);
          return e3.params.set(this.params), e3.length = this.length, e3._subParams.set(this._subParams), e3._subParamsLength = this._subParamsLength, e3._subParamsIdx.set(this._subParamsIdx), e3._rejectDigits = this._rejectDigits, e3._rejectSubDigits = this._rejectSubDigits, e3._digitIsSub = this._digitIsSub, e3;
        }
        toArray() {
          const e3 = [];
          for (let t3 = 0;t3 < this.length; ++t3) {
            e3.push(this.params[t3]);
            const i3 = this._subParamsIdx[t3] >> 8, s3 = 255 & this._subParamsIdx[t3];
            s3 - i3 > 0 && e3.push(Array.prototype.slice.call(this._subParams, i3, s3));
          }
          return e3;
        }
        reset() {
          this.length = 0, this._subParamsLength = 0, this._rejectDigits = false, this._rejectSubDigits = false, this._digitIsSub = false;
        }
        addParam(e3) {
          if (this._digitIsSub = false, this.length >= this.maxLength)
            this._rejectDigits = true;
          else {
            if (e3 < -1)
              throw new Error("values lesser than -1 are not allowed");
            this._subParamsIdx[this.length] = this._subParamsLength << 8 | this._subParamsLength, this.params[this.length++] = e3 > i2 ? i2 : e3;
          }
        }
        addSubParam(e3) {
          if (this._digitIsSub = true, this.length)
            if (this._rejectDigits || this._subParamsLength >= this.maxSubParamsLength)
              this._rejectSubDigits = true;
            else {
              if (e3 < -1)
                throw new Error("values lesser than -1 are not allowed");
              this._subParams[this._subParamsLength++] = e3 > i2 ? i2 : e3, this._subParamsIdx[this.length - 1]++;
            }
        }
        hasSubParams(e3) {
          return (255 & this._subParamsIdx[e3]) - (this._subParamsIdx[e3] >> 8) > 0;
        }
        getSubParams(e3) {
          const t3 = this._subParamsIdx[e3] >> 8, i3 = 255 & this._subParamsIdx[e3];
          return i3 - t3 > 0 ? this._subParams.subarray(t3, i3) : null;
        }
        getSubParamsAll() {
          const e3 = {};
          for (let t3 = 0;t3 < this.length; ++t3) {
            const i3 = this._subParamsIdx[t3] >> 8, s3 = 255 & this._subParamsIdx[t3];
            s3 - i3 > 0 && (e3[t3] = this._subParams.slice(i3, s3));
          }
          return e3;
        }
        addDigit(e3) {
          let t3;
          if (this._rejectDigits || !(t3 = this._digitIsSub ? this._subParamsLength : this.length) || this._digitIsSub && this._rejectSubDigits)
            return;
          const s3 = this._digitIsSub ? this._subParams : this.params, r2 = s3[t3 - 1];
          s3[t3 - 1] = ~r2 ? Math.min(10 * r2 + e3, i2) : e3;
        }
      }
      t2.Params = s2;
    }, 741: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.AddonManager = undefined, t2.AddonManager = class {
        constructor() {
          this._addons = [];
        }
        dispose() {
          for (let e3 = this._addons.length - 1;e3 >= 0; e3--)
            this._addons[e3].instance.dispose();
        }
        loadAddon(e3, t3) {
          const i2 = { instance: t3, dispose: t3.dispose, isDisposed: false };
          this._addons.push(i2), t3.dispose = () => this._wrappedAddonDispose(i2), t3.activate(e3);
        }
        _wrappedAddonDispose(e3) {
          if (e3.isDisposed)
            return;
          let t3 = -1;
          for (let i2 = 0;i2 < this._addons.length; i2++)
            if (this._addons[i2] === e3) {
              t3 = i2;
              break;
            }
          if (t3 === -1)
            throw new Error("Could not dispose an addon that has not been loaded");
          e3.isDisposed = true, e3.dispose.apply(e3.instance), this._addons.splice(t3, 1);
        }
      };
    }, 771: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferApiView = undefined;
      const s2 = i2(785), r2 = i2(511);
      t2.BufferApiView = class {
        constructor(e3, t3) {
          this._buffer = e3, this.type = t3;
        }
        init(e3) {
          return this._buffer = e3, this;
        }
        get cursorY() {
          return this._buffer.y;
        }
        get cursorX() {
          return this._buffer.x;
        }
        get viewportY() {
          return this._buffer.ydisp;
        }
        get baseY() {
          return this._buffer.ybase;
        }
        get length() {
          return this._buffer.lines.length;
        }
        getLine(e3) {
          const t3 = this._buffer.lines.get(e3);
          if (t3)
            return new s2.BufferLineApiView(t3);
        }
        getNullCell() {
          return new r2.CellData;
        }
      };
    }, 785: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferLineApiView = undefined;
      const s2 = i2(511);
      t2.BufferLineApiView = class {
        constructor(e3) {
          this._line = e3;
        }
        get isWrapped() {
          return this._line.isWrapped;
        }
        get length() {
          return this._line.length;
        }
        getCell(e3, t3) {
          if (!(e3 < 0 || e3 >= this._line.length))
            return t3 ? (this._line.loadCell(e3, t3), t3) : this._line.loadCell(e3, new s2.CellData);
        }
        translateToString(e3, t3, i3) {
          return this._line.translateToString(e3, t3, i3);
        }
      };
    }, 285: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferNamespaceApi = undefined;
      const s2 = i2(771), r2 = i2(460), n2 = i2(844);

      class a extends n2.Disposable {
        constructor(e3) {
          super(), this._core = e3, this._onBufferChange = this.register(new r2.EventEmitter), this.onBufferChange = this._onBufferChange.event, this._normal = new s2.BufferApiView(this._core.buffers.normal, "normal"), this._alternate = new s2.BufferApiView(this._core.buffers.alt, "alternate"), this._core.buffers.onBufferActivate(() => this._onBufferChange.fire(this.active));
        }
        get active() {
          if (this._core.buffers.active === this._core.buffers.normal)
            return this.normal;
          if (this._core.buffers.active === this._core.buffers.alt)
            return this.alternate;
          throw new Error("Active buffer is neither normal nor alternate");
        }
        get normal() {
          return this._normal.init(this._core.buffers.normal);
        }
        get alternate() {
          return this._alternate.init(this._core.buffers.alt);
        }
      }
      t2.BufferNamespaceApi = a;
    }, 975: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.ParserApi = undefined, t2.ParserApi = class {
        constructor(e3) {
          this._core = e3;
        }
        registerCsiHandler(e3, t3) {
          return this._core.registerCsiHandler(e3, (e4) => t3(e4.toArray()));
        }
        addCsiHandler(e3, t3) {
          return this.registerCsiHandler(e3, t3);
        }
        registerDcsHandler(e3, t3) {
          return this._core.registerDcsHandler(e3, (e4, i2) => t3(e4, i2.toArray()));
        }
        addDcsHandler(e3, t3) {
          return this.registerDcsHandler(e3, t3);
        }
        registerEscHandler(e3, t3) {
          return this._core.registerEscHandler(e3, t3);
        }
        addEscHandler(e3, t3) {
          return this.registerEscHandler(e3, t3);
        }
        registerOscHandler(e3, t3) {
          return this._core.registerOscHandler(e3, t3);
        }
        addOscHandler(e3, t3) {
          return this.registerOscHandler(e3, t3);
        }
      };
    }, 90: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.UnicodeApi = undefined, t2.UnicodeApi = class {
        constructor(e3) {
          this._core = e3;
        }
        register(e3) {
          this._core.unicodeService.register(e3);
        }
        get versions() {
          return this._core.unicodeService.versions;
        }
        get activeVersion() {
          return this._core.unicodeService.activeVersion;
        }
        set activeVersion(e3) {
          this._core.unicodeService.activeVersion = e3;
        }
      };
    }, 744: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o2 = e3.length - 1;o2 >= 0; o2--)
            (r3 = e3[o2]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.BufferService = t2.MINIMUM_ROWS = t2.MINIMUM_COLS = undefined;
      const n2 = i2(460), a = i2(844), o = i2(295), h = i2(585);
      t2.MINIMUM_COLS = 2, t2.MINIMUM_ROWS = 1;
      let c = t2.BufferService = class extends a.Disposable {
        get buffer() {
          return this.buffers.active;
        }
        constructor(e3) {
          super(), this.isUserScrolling = false, this._onResize = this.register(new n2.EventEmitter), this.onResize = this._onResize.event, this._onScroll = this.register(new n2.EventEmitter), this.onScroll = this._onScroll.event, this.cols = Math.max(e3.rawOptions.cols || 0, t2.MINIMUM_COLS), this.rows = Math.max(e3.rawOptions.rows || 0, t2.MINIMUM_ROWS), this.buffers = this.register(new o.BufferSet(e3, this));
        }
        resize(e3, t3) {
          this.cols = e3, this.rows = t3, this.buffers.resize(e3, t3), this._onResize.fire({ cols: e3, rows: t3 });
        }
        reset() {
          this.buffers.reset(), this.isUserScrolling = false;
        }
        scroll(e3, t3 = false) {
          const i3 = this.buffer;
          let s3;
          s3 = this._cachedBlankLine, s3 && s3.length === this.cols && s3.getFg(0) === e3.fg && s3.getBg(0) === e3.bg || (s3 = i3.getBlankLine(e3, t3), this._cachedBlankLine = s3), s3.isWrapped = t3;
          const r3 = i3.ybase + i3.scrollTop, n3 = i3.ybase + i3.scrollBottom;
          if (i3.scrollTop === 0) {
            const e4 = i3.lines.isFull;
            n3 === i3.lines.length - 1 ? e4 ? i3.lines.recycle().copyFrom(s3) : i3.lines.push(s3.clone()) : i3.lines.splice(n3 + 1, 0, s3.clone()), e4 ? this.isUserScrolling && (i3.ydisp = Math.max(i3.ydisp - 1, 0)) : (i3.ybase++, this.isUserScrolling || i3.ydisp++);
          } else {
            const e4 = n3 - r3 + 1;
            i3.lines.shiftElements(r3 + 1, e4 - 1, -1), i3.lines.set(n3, s3.clone());
          }
          this.isUserScrolling || (i3.ydisp = i3.ybase), this._onScroll.fire(i3.ydisp);
        }
        scrollLines(e3, t3, i3) {
          const s3 = this.buffer;
          if (e3 < 0) {
            if (s3.ydisp === 0)
              return;
            this.isUserScrolling = true;
          } else
            e3 + s3.ydisp >= s3.ybase && (this.isUserScrolling = false);
          const r3 = s3.ydisp;
          s3.ydisp = Math.max(Math.min(s3.ydisp + e3, s3.ybase), 0), r3 !== s3.ydisp && (t3 || this._onScroll.fire(s3.ydisp));
        }
      };
      t2.BufferService = c = s2([r2(0, h.IOptionsService)], c);
    }, 994: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CharsetService = undefined, t2.CharsetService = class {
        constructor() {
          this.glevel = 0, this._charsets = [];
        }
        reset() {
          this.charset = undefined, this._charsets = [], this.glevel = 0;
        }
        setgLevel(e3) {
          this.glevel = e3, this.charset = this._charsets[e3];
        }
        setgCharset(e3, t3) {
          this._charsets[e3] = t3, this.glevel === e3 && (this.charset = t3);
        }
      };
    }, 753: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o2 = e3.length - 1;o2 >= 0; o2--)
            (r3 = e3[o2]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CoreMouseService = undefined;
      const n2 = i2(585), a = i2(460), o = i2(844), h = { NONE: { events: 0, restrict: () => false }, X10: { events: 1, restrict: (e3) => e3.button !== 4 && e3.action === 1 && (e3.ctrl = false, e3.alt = false, e3.shift = false, true) }, VT200: { events: 19, restrict: (e3) => e3.action !== 32 }, DRAG: { events: 23, restrict: (e3) => e3.action !== 32 || e3.button !== 3 }, ANY: { events: 31, restrict: (e3) => true } };
      function c(e3, t3) {
        let i3 = (e3.ctrl ? 16 : 0) | (e3.shift ? 4 : 0) | (e3.alt ? 8 : 0);
        return e3.button === 4 ? (i3 |= 64, i3 |= e3.action) : (i3 |= 3 & e3.button, 4 & e3.button && (i3 |= 64), 8 & e3.button && (i3 |= 128), e3.action === 32 ? i3 |= 32 : e3.action !== 0 || t3 || (i3 |= 3)), i3;
      }
      const l = String.fromCharCode, _ = { DEFAULT: (e3) => {
        const t3 = [c(e3, false) + 32, e3.col + 32, e3.row + 32];
        return t3[0] > 255 || t3[1] > 255 || t3[2] > 255 ? "" : `\x1B[M${l(t3[0])}${l(t3[1])}${l(t3[2])}`;
      }, SGR: (e3) => {
        const t3 = e3.action === 0 && e3.button !== 4 ? "m" : "M";
        return `\x1B[<${c(e3, true)};${e3.col};${e3.row}${t3}`;
      }, SGR_PIXELS: (e3) => {
        const t3 = e3.action === 0 && e3.button !== 4 ? "m" : "M";
        return `\x1B[<${c(e3, true)};${e3.x};${e3.y}${t3}`;
      } };
      let d = t2.CoreMouseService = class extends o.Disposable {
        constructor(e3, t3) {
          super(), this._bufferService = e3, this._coreService = t3, this._protocols = {}, this._encodings = {}, this._activeProtocol = "", this._activeEncoding = "", this._lastEvent = null, this._onProtocolChange = this.register(new a.EventEmitter), this.onProtocolChange = this._onProtocolChange.event;
          for (const e4 of Object.keys(h))
            this.addProtocol(e4, h[e4]);
          for (const e4 of Object.keys(_))
            this.addEncoding(e4, _[e4]);
          this.reset();
        }
        addProtocol(e3, t3) {
          this._protocols[e3] = t3;
        }
        addEncoding(e3, t3) {
          this._encodings[e3] = t3;
        }
        get activeProtocol() {
          return this._activeProtocol;
        }
        get areMouseEventsActive() {
          return this._protocols[this._activeProtocol].events !== 0;
        }
        set activeProtocol(e3) {
          if (!this._protocols[e3])
            throw new Error(`unknown protocol "${e3}"`);
          this._activeProtocol = e3, this._onProtocolChange.fire(this._protocols[e3].events);
        }
        get activeEncoding() {
          return this._activeEncoding;
        }
        set activeEncoding(e3) {
          if (!this._encodings[e3])
            throw new Error(`unknown encoding "${e3}"`);
          this._activeEncoding = e3;
        }
        reset() {
          this.activeProtocol = "NONE", this.activeEncoding = "DEFAULT", this._lastEvent = null;
        }
        triggerMouseEvent(e3) {
          if (e3.col < 0 || e3.col >= this._bufferService.cols || e3.row < 0 || e3.row >= this._bufferService.rows)
            return false;
          if (e3.button === 4 && e3.action === 32)
            return false;
          if (e3.button === 3 && e3.action !== 32)
            return false;
          if (e3.button !== 4 && (e3.action === 2 || e3.action === 3))
            return false;
          if (e3.col++, e3.row++, e3.action === 32 && this._lastEvent && this._equalEvents(this._lastEvent, e3, this._activeEncoding === "SGR_PIXELS"))
            return false;
          if (!this._protocols[this._activeProtocol].restrict(e3))
            return false;
          const t3 = this._encodings[this._activeEncoding](e3);
          return t3 && (this._activeEncoding === "DEFAULT" ? this._coreService.triggerBinaryEvent(t3) : this._coreService.triggerDataEvent(t3, true)), this._lastEvent = e3, true;
        }
        explainEvents(e3) {
          return { down: !!(1 & e3), up: !!(2 & e3), drag: !!(4 & e3), move: !!(8 & e3), wheel: !!(16 & e3) };
        }
        _equalEvents(e3, t3, i3) {
          if (i3) {
            if (e3.x !== t3.x)
              return false;
            if (e3.y !== t3.y)
              return false;
          } else {
            if (e3.col !== t3.col)
              return false;
            if (e3.row !== t3.row)
              return false;
          }
          return e3.button === t3.button && e3.action === t3.action && e3.ctrl === t3.ctrl && e3.alt === t3.alt && e3.shift === t3.shift;
        }
      };
      t2.CoreMouseService = d = s2([r2(0, n2.IBufferService), r2(1, n2.ICoreService)], d);
    }, 83: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o2 = e3.length - 1;o2 >= 0; o2--)
            (r3 = e3[o2]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.CoreService = undefined;
      const n2 = i2(439), a = i2(460), o = i2(844), h = i2(585), c = Object.freeze({ insertMode: false }), l = Object.freeze({ applicationCursorKeys: false, applicationKeypad: false, bracketedPasteMode: false, origin: false, reverseWraparound: false, sendFocus: false, wraparound: true });
      let _ = t2.CoreService = class extends o.Disposable {
        constructor(e3, t3, i3) {
          super(), this._bufferService = e3, this._logService = t3, this._optionsService = i3, this.isCursorInitialized = false, this.isCursorHidden = false, this._onData = this.register(new a.EventEmitter), this.onData = this._onData.event, this._onUserInput = this.register(new a.EventEmitter), this.onUserInput = this._onUserInput.event, this._onBinary = this.register(new a.EventEmitter), this.onBinary = this._onBinary.event, this._onRequestScrollToBottom = this.register(new a.EventEmitter), this.onRequestScrollToBottom = this._onRequestScrollToBottom.event, this.modes = (0, n2.clone)(c), this.decPrivateModes = (0, n2.clone)(l);
        }
        reset() {
          this.modes = (0, n2.clone)(c), this.decPrivateModes = (0, n2.clone)(l);
        }
        triggerDataEvent(e3, t3 = false) {
          if (this._optionsService.rawOptions.disableStdin)
            return;
          const i3 = this._bufferService.buffer;
          t3 && this._optionsService.rawOptions.scrollOnUserInput && i3.ybase !== i3.ydisp && this._onRequestScrollToBottom.fire(), t3 && this._onUserInput.fire(), this._logService.debug(`sending data "${e3}"`, () => e3.split("").map((e4) => e4.charCodeAt(0))), this._onData.fire(e3);
        }
        triggerBinaryEvent(e3) {
          this._optionsService.rawOptions.disableStdin || (this._logService.debug(`sending binary "${e3}"`, () => e3.split("").map((e4) => e4.charCodeAt(0))), this._onBinary.fire(e3));
        }
      };
      t2.CoreService = _ = s2([r2(0, h.IBufferService), r2(1, h.ILogService), r2(2, h.IOptionsService)], _);
    }, 348: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.InstantiationService = t2.ServiceCollection = undefined;
      const s2 = i2(585), r2 = i2(343);

      class n2 {
        constructor(...e3) {
          this._entries = new Map;
          for (const [t3, i3] of e3)
            this.set(t3, i3);
        }
        set(e3, t3) {
          const i3 = this._entries.get(e3);
          return this._entries.set(e3, t3), i3;
        }
        forEach(e3) {
          for (const [t3, i3] of this._entries.entries())
            e3(t3, i3);
        }
        has(e3) {
          return this._entries.has(e3);
        }
        get(e3) {
          return this._entries.get(e3);
        }
      }
      t2.ServiceCollection = n2, t2.InstantiationService = class {
        constructor() {
          this._services = new n2, this._services.set(s2.IInstantiationService, this);
        }
        setService(e3, t3) {
          this._services.set(e3, t3);
        }
        getService(e3) {
          return this._services.get(e3);
        }
        createInstance(e3, ...t3) {
          const i3 = (0, r2.getServiceDependencies)(e3).sort((e4, t4) => e4.index - t4.index), s3 = [];
          for (const t4 of i3) {
            const i4 = this._services.get(t4.id);
            if (!i4)
              throw new Error(`[createInstance] ${e3.name} depends on UNKNOWN service ${t4.id}.`);
            s3.push(i4);
          }
          const n3 = i3.length > 0 ? i3[0].index : t3.length;
          if (t3.length !== n3)
            throw new Error(`[createInstance] First service dependency of ${e3.name} at position ${n3 + 1} conflicts with ${t3.length} static arguments`);
          return new e3(...[...t3, ...s3]);
        }
      };
    }, 866: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o2 = e3.length - 1;o2 >= 0; o2--)
            (r3 = e3[o2]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.traceCall = t2.setTraceLogger = t2.LogService = undefined;
      const n2 = i2(844), a = i2(585), o = { trace: a.LogLevelEnum.TRACE, debug: a.LogLevelEnum.DEBUG, info: a.LogLevelEnum.INFO, warn: a.LogLevelEnum.WARN, error: a.LogLevelEnum.ERROR, off: a.LogLevelEnum.OFF };
      let h, c = t2.LogService = class extends n2.Disposable {
        get logLevel() {
          return this._logLevel;
        }
        constructor(e3) {
          super(), this._optionsService = e3, this._logLevel = a.LogLevelEnum.OFF, this._updateLogLevel(), this.register(this._optionsService.onSpecificOptionChange("logLevel", () => this._updateLogLevel())), h = this;
        }
        _updateLogLevel() {
          this._logLevel = o[this._optionsService.rawOptions.logLevel];
        }
        _evalLazyOptionalParams(e3) {
          for (let t3 = 0;t3 < e3.length; t3++)
            typeof e3[t3] == "function" && (e3[t3] = e3[t3]());
        }
        _log(e3, t3, i3) {
          this._evalLazyOptionalParams(i3), e3.call(console, (this._optionsService.options.logger ? "" : "xterm.js: ") + t3, ...i3);
        }
        trace(e3, ...t3) {
          this._logLevel <= a.LogLevelEnum.TRACE && this._log(this._optionsService.options.logger?.trace.bind(this._optionsService.options.logger) ?? console.log, e3, t3);
        }
        debug(e3, ...t3) {
          this._logLevel <= a.LogLevelEnum.DEBUG && this._log(this._optionsService.options.logger?.debug.bind(this._optionsService.options.logger) ?? console.log, e3, t3);
        }
        info(e3, ...t3) {
          this._logLevel <= a.LogLevelEnum.INFO && this._log(this._optionsService.options.logger?.info.bind(this._optionsService.options.logger) ?? console.info, e3, t3);
        }
        warn(e3, ...t3) {
          this._logLevel <= a.LogLevelEnum.WARN && this._log(this._optionsService.options.logger?.warn.bind(this._optionsService.options.logger) ?? console.warn, e3, t3);
        }
        error(e3, ...t3) {
          this._logLevel <= a.LogLevelEnum.ERROR && this._log(this._optionsService.options.logger?.error.bind(this._optionsService.options.logger) ?? console.error, e3, t3);
        }
      };
      t2.LogService = c = s2([r2(0, a.IOptionsService)], c), t2.setTraceLogger = function(e3) {
        h = e3;
      }, t2.traceCall = function(e3, t3, i3) {
        if (typeof i3.value != "function")
          throw new Error("not supported");
        const s3 = i3.value;
        i3.value = function(...e4) {
          if (h.logLevel !== a.LogLevelEnum.TRACE)
            return s3.apply(this, e4);
          h.trace(`GlyphRenderer#${s3.name}(${e4.map((e5) => JSON.stringify(e5)).join(", ")})`);
          const t4 = s3.apply(this, e4);
          return h.trace(`GlyphRenderer#${s3.name} return`, t4), t4;
        };
      };
    }, 302: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.OptionsService = t2.DEFAULT_OPTIONS = undefined;
      const s2 = i2(460), r2 = i2(844), n2 = i2(114);
      t2.DEFAULT_OPTIONS = { cols: 80, rows: 24, cursorBlink: false, cursorStyle: "block", cursorWidth: 1, cursorInactiveStyle: "outline", customGlyphs: true, drawBoldTextInBrightColors: true, documentOverride: null, fastScrollModifier: "alt", fastScrollSensitivity: 5, fontFamily: "courier-new, courier, monospace", fontSize: 15, fontWeight: "normal", fontWeightBold: "bold", ignoreBracketedPasteMode: false, lineHeight: 1, letterSpacing: 0, linkHandler: null, logLevel: "info", logger: null, scrollback: 1000, scrollOnUserInput: true, scrollSensitivity: 1, screenReaderMode: false, smoothScrollDuration: 0, macOptionIsMeta: false, macOptionClickForcesSelection: false, minimumContrastRatio: 1, disableStdin: false, allowProposedApi: false, allowTransparency: false, tabStopWidth: 8, theme: {}, rescaleOverlappingGlyphs: false, rightClickSelectsWord: n2.isMac, windowOptions: {}, windowsMode: false, windowsPty: {}, wordSeparator: " ()[]{}',\"`", altClickMovesCursor: true, convertEol: false, termName: "xterm", cancelEvents: false, overviewRulerWidth: 0 };
      const a = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

      class o extends r2.Disposable {
        constructor(e3) {
          super(), this._onOptionChange = this.register(new s2.EventEmitter), this.onOptionChange = this._onOptionChange.event;
          const i3 = { ...t2.DEFAULT_OPTIONS };
          for (const t3 in e3)
            if (t3 in i3)
              try {
                const s3 = e3[t3];
                i3[t3] = this._sanitizeAndValidateOption(t3, s3);
              } catch (e4) {
                console.error(e4);
              }
          this.rawOptions = i3, this.options = { ...i3 }, this._setupOptions(), this.register((0, r2.toDisposable)(() => {
            this.rawOptions.linkHandler = null, this.rawOptions.documentOverride = null;
          }));
        }
        onSpecificOptionChange(e3, t3) {
          return this.onOptionChange((i3) => {
            i3 === e3 && t3(this.rawOptions[e3]);
          });
        }
        onMultipleOptionChange(e3, t3) {
          return this.onOptionChange((i3) => {
            e3.indexOf(i3) !== -1 && t3();
          });
        }
        _setupOptions() {
          const e3 = (e4) => {
            if (!(e4 in t2.DEFAULT_OPTIONS))
              throw new Error(`No option with key "${e4}"`);
            return this.rawOptions[e4];
          }, i3 = (e4, i4) => {
            if (!(e4 in t2.DEFAULT_OPTIONS))
              throw new Error(`No option with key "${e4}"`);
            i4 = this._sanitizeAndValidateOption(e4, i4), this.rawOptions[e4] !== i4 && (this.rawOptions[e4] = i4, this._onOptionChange.fire(e4));
          };
          for (const t3 in this.rawOptions) {
            const s3 = { get: e3.bind(this, t3), set: i3.bind(this, t3) };
            Object.defineProperty(this.options, t3, s3);
          }
        }
        _sanitizeAndValidateOption(e3, i3) {
          switch (e3) {
            case "cursorStyle":
              if (i3 || (i3 = t2.DEFAULT_OPTIONS[e3]), !function(e4) {
                return e4 === "block" || e4 === "underline" || e4 === "bar";
              }(i3))
                throw new Error(`"${i3}" is not a valid value for ${e3}`);
              break;
            case "wordSeparator":
              i3 || (i3 = t2.DEFAULT_OPTIONS[e3]);
              break;
            case "fontWeight":
            case "fontWeightBold":
              if (typeof i3 == "number" && 1 <= i3 && i3 <= 1000)
                break;
              i3 = a.includes(i3) ? i3 : t2.DEFAULT_OPTIONS[e3];
              break;
            case "cursorWidth":
              i3 = Math.floor(i3);
            case "lineHeight":
            case "tabStopWidth":
              if (i3 < 1)
                throw new Error(`${e3} cannot be less than 1, value: ${i3}`);
              break;
            case "minimumContrastRatio":
              i3 = Math.max(1, Math.min(21, Math.round(10 * i3) / 10));
              break;
            case "scrollback":
              if ((i3 = Math.min(i3, 4294967295)) < 0)
                throw new Error(`${e3} cannot be less than 0, value: ${i3}`);
              break;
            case "fastScrollSensitivity":
            case "scrollSensitivity":
              if (i3 <= 0)
                throw new Error(`${e3} cannot be less than or equal to 0, value: ${i3}`);
              break;
            case "rows":
            case "cols":
              if (!i3 && i3 !== 0)
                throw new Error(`${e3} must be numeric, value: ${i3}`);
              break;
            case "windowsPty":
              i3 = i3 ?? {};
          }
          return i3;
        }
      }
      t2.OptionsService = o;
    }, 660: function(e2, t2, i2) {
      var s2 = this && this.__decorate || function(e3, t3, i3, s3) {
        var r3, n3 = arguments.length, a2 = n3 < 3 ? t3 : s3 === null ? s3 = Object.getOwnPropertyDescriptor(t3, i3) : s3;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function")
          a2 = Reflect.decorate(e3, t3, i3, s3);
        else
          for (var o = e3.length - 1;o >= 0; o--)
            (r3 = e3[o]) && (a2 = (n3 < 3 ? r3(a2) : n3 > 3 ? r3(t3, i3, a2) : r3(t3, i3)) || a2);
        return n3 > 3 && a2 && Object.defineProperty(t3, i3, a2), a2;
      }, r2 = this && this.__param || function(e3, t3) {
        return function(i3, s3) {
          t3(i3, s3, e3);
        };
      };
      Object.defineProperty(t2, "__esModule", { value: true }), t2.OscLinkService = undefined;
      const n2 = i2(585);
      let a = t2.OscLinkService = class {
        constructor(e3) {
          this._bufferService = e3, this._nextId = 1, this._entriesWithId = new Map, this._dataByLinkId = new Map;
        }
        registerLink(e3) {
          const t3 = this._bufferService.buffer;
          if (e3.id === undefined) {
            const i4 = t3.addMarker(t3.ybase + t3.y), s4 = { data: e3, id: this._nextId++, lines: [i4] };
            return i4.onDispose(() => this._removeMarkerFromLink(s4, i4)), this._dataByLinkId.set(s4.id, s4), s4.id;
          }
          const i3 = e3, s3 = this._getEntryIdKey(i3), r3 = this._entriesWithId.get(s3);
          if (r3)
            return this.addLineToLink(r3.id, t3.ybase + t3.y), r3.id;
          const n3 = t3.addMarker(t3.ybase + t3.y), a2 = { id: this._nextId++, key: this._getEntryIdKey(i3), data: i3, lines: [n3] };
          return n3.onDispose(() => this._removeMarkerFromLink(a2, n3)), this._entriesWithId.set(a2.key, a2), this._dataByLinkId.set(a2.id, a2), a2.id;
        }
        addLineToLink(e3, t3) {
          const i3 = this._dataByLinkId.get(e3);
          if (i3 && i3.lines.every((e4) => e4.line !== t3)) {
            const e4 = this._bufferService.buffer.addMarker(t3);
            i3.lines.push(e4), e4.onDispose(() => this._removeMarkerFromLink(i3, e4));
          }
        }
        getLinkData(e3) {
          return this._dataByLinkId.get(e3)?.data;
        }
        _getEntryIdKey(e3) {
          return `${e3.id};;${e3.uri}`;
        }
        _removeMarkerFromLink(e3, t3) {
          const i3 = e3.lines.indexOf(t3);
          i3 !== -1 && (e3.lines.splice(i3, 1), e3.lines.length === 0 && (e3.data.id !== undefined && this._entriesWithId.delete(e3.key), this._dataByLinkId.delete(e3.id)));
        }
      };
      t2.OscLinkService = a = s2([r2(0, n2.IBufferService)], a);
    }, 343: (e2, t2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.createDecorator = t2.getServiceDependencies = t2.serviceRegistry = undefined;
      const i2 = "di$target", s2 = "di$dependencies";
      t2.serviceRegistry = new Map, t2.getServiceDependencies = function(e3) {
        return e3[s2] || [];
      }, t2.createDecorator = function(e3) {
        if (t2.serviceRegistry.has(e3))
          return t2.serviceRegistry.get(e3);
        const r2 = function(e4, t3, n2) {
          if (arguments.length !== 3)
            throw new Error("@IServiceName-decorator can only be used to decorate a parameter");
          (function(e5, t4, r3) {
            t4[i2] === t4 ? t4[s2].push({ id: e5, index: r3 }) : (t4[s2] = [{ id: e5, index: r3 }], t4[i2] = t4);
          })(r2, e4, n2);
        };
        return r2.toString = () => e3, t2.serviceRegistry.set(e3, r2), r2;
      };
    }, 585: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.IDecorationService = t2.IUnicodeService = t2.IOscLinkService = t2.IOptionsService = t2.ILogService = t2.LogLevelEnum = t2.IInstantiationService = t2.ICharsetService = t2.ICoreService = t2.ICoreMouseService = t2.IBufferService = undefined;
      const s2 = i2(343);
      var r2;
      t2.IBufferService = (0, s2.createDecorator)("BufferService"), t2.ICoreMouseService = (0, s2.createDecorator)("CoreMouseService"), t2.ICoreService = (0, s2.createDecorator)("CoreService"), t2.ICharsetService = (0, s2.createDecorator)("CharsetService"), t2.IInstantiationService = (0, s2.createDecorator)("InstantiationService"), function(e3) {
        e3[e3.TRACE = 0] = "TRACE", e3[e3.DEBUG = 1] = "DEBUG", e3[e3.INFO = 2] = "INFO", e3[e3.WARN = 3] = "WARN", e3[e3.ERROR = 4] = "ERROR", e3[e3.OFF = 5] = "OFF";
      }(r2 || (t2.LogLevelEnum = r2 = {})), t2.ILogService = (0, s2.createDecorator)("LogService"), t2.IOptionsService = (0, s2.createDecorator)("OptionsService"), t2.IOscLinkService = (0, s2.createDecorator)("OscLinkService"), t2.IUnicodeService = (0, s2.createDecorator)("UnicodeService"), t2.IDecorationService = (0, s2.createDecorator)("DecorationService");
    }, 480: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.UnicodeService = undefined;
      const s2 = i2(460), r2 = i2(225);

      class n2 {
        static extractShouldJoin(e3) {
          return (1 & e3) != 0;
        }
        static extractWidth(e3) {
          return e3 >> 1 & 3;
        }
        static extractCharKind(e3) {
          return e3 >> 3;
        }
        static createPropertyValue(e3, t3, i3 = false) {
          return (16777215 & e3) << 3 | (3 & t3) << 1 | (i3 ? 1 : 0);
        }
        constructor() {
          this._providers = Object.create(null), this._active = "", this._onChange = new s2.EventEmitter, this.onChange = this._onChange.event;
          const e3 = new r2.UnicodeV6;
          this.register(e3), this._active = e3.version, this._activeProvider = e3;
        }
        dispose() {
          this._onChange.dispose();
        }
        get versions() {
          return Object.keys(this._providers);
        }
        get activeVersion() {
          return this._active;
        }
        set activeVersion(e3) {
          if (!this._providers[e3])
            throw new Error(`unknown Unicode version "${e3}"`);
          this._active = e3, this._activeProvider = this._providers[e3], this._onChange.fire(e3);
        }
        register(e3) {
          this._providers[e3.version] = e3;
        }
        wcwidth(e3) {
          return this._activeProvider.wcwidth(e3);
        }
        getStringCellWidth(e3) {
          let t3 = 0, i3 = 0;
          const s3 = e3.length;
          for (let r3 = 0;r3 < s3; ++r3) {
            let a = e3.charCodeAt(r3);
            if (55296 <= a && a <= 56319) {
              if (++r3 >= s3)
                return t3 + this.wcwidth(a);
              const i4 = e3.charCodeAt(r3);
              56320 <= i4 && i4 <= 57343 ? a = 1024 * (a - 55296) + i4 - 56320 + 65536 : t3 += this.wcwidth(i4);
            }
            const o = this.charProperties(a, i3);
            let h = n2.extractWidth(o);
            n2.extractShouldJoin(o) && (h -= n2.extractWidth(i3)), t3 += h, i3 = o;
          }
          return t3;
        }
        charProperties(e3, t3) {
          return this._activeProvider.charProperties(e3, t3);
        }
      }
      t2.UnicodeService = n2;
    }, 781: (e2, t2, i2) => {
      Object.defineProperty(t2, "__esModule", { value: true }), t2.Terminal = undefined;
      const s2 = i2(437), r2 = i2(969), n2 = i2(460);

      class a extends r2.CoreTerminal {
        constructor(e3 = {}) {
          super(e3), this._onBell = this.register(new n2.EventEmitter), this.onBell = this._onBell.event, this._onCursorMove = this.register(new n2.EventEmitter), this.onCursorMove = this._onCursorMove.event, this._onTitleChange = this.register(new n2.EventEmitter), this.onTitleChange = this._onTitleChange.event, this._onA11yCharEmitter = this.register(new n2.EventEmitter), this.onA11yChar = this._onA11yCharEmitter.event, this._onA11yTabEmitter = this.register(new n2.EventEmitter), this.onA11yTab = this._onA11yTabEmitter.event, this._setup(), this.register(this._inputHandler.onRequestBell(() => this.bell())), this.register(this._inputHandler.onRequestReset(() => this.reset())), this.register((0, n2.forwardEvent)(this._inputHandler.onCursorMove, this._onCursorMove)), this.register((0, n2.forwardEvent)(this._inputHandler.onTitleChange, this._onTitleChange)), this.register((0, n2.forwardEvent)(this._inputHandler.onA11yChar, this._onA11yCharEmitter)), this.register((0, n2.forwardEvent)(this._inputHandler.onA11yTab, this._onA11yTabEmitter));
        }
        get buffer() {
          return this.buffers.active;
        }
        get markers() {
          return this.buffer.markers;
        }
        addMarker(e3) {
          if (this.buffer === this.buffers.normal)
            return this.buffer.addMarker(this.buffer.ybase + this.buffer.y + e3);
        }
        bell() {
          this._onBell.fire();
        }
        input(e3, t3 = true) {
          this.coreService.triggerDataEvent(e3, t3);
        }
        resize(e3, t3) {
          e3 === this.cols && t3 === this.rows || super.resize(e3, t3);
        }
        clear() {
          if (this.buffer.ybase !== 0 || this.buffer.y !== 0) {
            this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y)), this.buffer.lines.length = 1, this.buffer.ydisp = 0, this.buffer.ybase = 0, this.buffer.y = 0;
            for (let e3 = 1;e3 < this.rows; e3++)
              this.buffer.lines.push(this.buffer.getBlankLine(s2.DEFAULT_ATTR_DATA));
            this._onScroll.fire({ position: this.buffer.ydisp, source: 0 });
          }
        }
        reset() {
          this.options.rows = this.rows, this.options.cols = this.cols, this._setup(), super.reset();
        }
      }
      t2.Terminal = a;
    } }, t = {};
    function i(s2) {
      var r2 = t[s2];
      if (r2 !== undefined)
        return r2.exports;
      var n2 = t[s2] = { exports: {} };
      return e[s2].call(n2.exports, n2, n2.exports, i), n2.exports;
    }
    var s = {};
    (() => {
      var e2 = s;
      Object.defineProperty(e2, "__esModule", { value: true }), e2.Terminal = undefined;
      const t2 = i(285), r2 = i(975), n2 = i(90), a = i(781), o = i(741), h = i(844), c = ["cols", "rows"];

      class l extends h.Disposable {
        constructor(e3) {
          super(), this._core = this.register(new a.Terminal(e3)), this._addonManager = this.register(new o.AddonManager), this._publicOptions = { ...this._core.options };
          const t3 = (e4) => this._core.options[e4], i2 = (e4, t4) => {
            this._checkReadonlyOptions(e4), this._core.options[e4] = t4;
          };
          for (const e4 in this._core.options) {
            Object.defineProperty(this._publicOptions, e4, { get: () => this._core.options[e4], set: (t4) => {
              this._checkReadonlyOptions(e4), this._core.options[e4] = t4;
            } });
            const s2 = { get: t3.bind(this, e4), set: i2.bind(this, e4) };
            Object.defineProperty(this._publicOptions, e4, s2);
          }
        }
        _checkReadonlyOptions(e3) {
          if (c.includes(e3))
            throw new Error(`Option "${e3}" can only be set in the constructor`);
        }
        _checkProposedApi() {
          if (!this._core.optionsService.options.allowProposedApi)
            throw new Error("You must set the allowProposedApi option to true to use proposed API");
        }
        get onBell() {
          return this._core.onBell;
        }
        get onBinary() {
          return this._core.onBinary;
        }
        get onCursorMove() {
          return this._core.onCursorMove;
        }
        get onData() {
          return this._core.onData;
        }
        get onLineFeed() {
          return this._core.onLineFeed;
        }
        get onResize() {
          return this._core.onResize;
        }
        get onScroll() {
          return this._core.onScroll;
        }
        get onTitleChange() {
          return this._core.onTitleChange;
        }
        get parser() {
          return this._checkProposedApi(), this._parser || (this._parser = new r2.ParserApi(this._core)), this._parser;
        }
        get unicode() {
          return this._checkProposedApi(), new n2.UnicodeApi(this._core);
        }
        get rows() {
          return this._core.rows;
        }
        get cols() {
          return this._core.cols;
        }
        get buffer() {
          return this._checkProposedApi(), this._buffer || (this._buffer = this.register(new t2.BufferNamespaceApi(this._core))), this._buffer;
        }
        get markers() {
          return this._checkProposedApi(), this._core.markers;
        }
        get modes() {
          const e3 = this._core.coreService.decPrivateModes;
          let t3 = "none";
          switch (this._core.coreMouseService.activeProtocol) {
            case "X10":
              t3 = "x10";
              break;
            case "VT200":
              t3 = "vt200";
              break;
            case "DRAG":
              t3 = "drag";
              break;
            case "ANY":
              t3 = "any";
          }
          return { applicationCursorKeysMode: e3.applicationCursorKeys, applicationKeypadMode: e3.applicationKeypad, bracketedPasteMode: e3.bracketedPasteMode, insertMode: this._core.coreService.modes.insertMode, mouseTrackingMode: t3, originMode: e3.origin, reverseWraparoundMode: e3.reverseWraparound, sendFocusMode: e3.sendFocus, wraparoundMode: e3.wraparound };
        }
        get options() {
          return this._publicOptions;
        }
        set options(e3) {
          for (const t3 in e3)
            this._publicOptions[t3] = e3[t3];
        }
        input(e3, t3 = true) {
          this._core.input(e3, t3);
        }
        resize(e3, t3) {
          this._verifyIntegers(e3, t3), this._core.resize(e3, t3);
        }
        registerMarker(e3 = 0) {
          return this._checkProposedApi(), this._verifyIntegers(e3), this._core.addMarker(e3);
        }
        addMarker(e3) {
          return this.registerMarker(e3);
        }
        dispose() {
          super.dispose();
        }
        scrollLines(e3) {
          this._verifyIntegers(e3), this._core.scrollLines(e3);
        }
        scrollPages(e3) {
          this._verifyIntegers(e3), this._core.scrollPages(e3);
        }
        scrollToTop() {
          this._core.scrollToTop();
        }
        scrollToBottom() {
          this._core.scrollToBottom();
        }
        scrollToLine(e3) {
          this._verifyIntegers(e3), this._core.scrollToLine(e3);
        }
        clear() {
          this._core.clear();
        }
        write(e3, t3) {
          this._core.write(e3, t3);
        }
        writeln(e3, t3) {
          this._core.write(e3), this._core.write(`\r
`, t3);
        }
        reset() {
          this._core.reset();
        }
        loadAddon(e3) {
          this._addonManager.loadAddon(this, e3);
        }
        _verifyIntegers(...e3) {
          for (const t3 of e3)
            if (t3 === 1 / 0 || isNaN(t3) || t3 % 1 != 0)
              throw new Error("This API only accepts integers");
        }
      }
      e2.Terminal = l;
    })();
    var r = exports;
    for (var n in s)
      r[n] = s[n];
    s.__esModule && Object.defineProperty(r, "__esModule", { value: true });
  })();
});

// apps/worker/node_modules/node-pty/lib/eventEmitter2.js
var require_eventEmitter2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.EventEmitter2 = undefined;
  var EventEmitter2 = function() {
    function EventEmitter22() {
      this._listeners = [];
    }
    Object.defineProperty(EventEmitter22.prototype, "event", {
      get: function() {
        var _this = this;
        if (!this._event) {
          this._event = function(listener) {
            _this._listeners.push(listener);
            var disposable = {
              dispose: function() {
                for (var i = 0;i < _this._listeners.length; i++) {
                  if (_this._listeners[i] === listener) {
                    _this._listeners.splice(i, 1);
                    return;
                  }
                }
              }
            };
            return disposable;
          };
        }
        return this._event;
      },
      enumerable: false,
      configurable: true
    });
    EventEmitter22.prototype.fire = function(data) {
      var queue = [];
      for (var i = 0;i < this._listeners.length; i++) {
        queue.push(this._listeners[i]);
      }
      for (var i = 0;i < queue.length; i++) {
        queue[i].call(undefined, data);
      }
    };
    return EventEmitter22;
  }();
  exports.EventEmitter2 = EventEmitter2;
});

// apps/worker/node_modules/node-pty/lib/terminal.js
var require_terminal = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Terminal = exports.DEFAULT_ROWS = exports.DEFAULT_COLS = undefined;
  var events_1 = __require("events");
  var eventEmitter2_1 = require_eventEmitter2();
  exports.DEFAULT_COLS = 80;
  exports.DEFAULT_ROWS = 24;
  var FLOW_CONTROL_PAUSE = "\x13";
  var FLOW_CONTROL_RESUME = "\x11";
  var Terminal = function() {
    function Terminal2(opt) {
      this._pid = 0;
      this._fd = 0;
      this._cols = 0;
      this._rows = 0;
      this._readable = false;
      this._writable = false;
      this._onData = new eventEmitter2_1.EventEmitter2;
      this._onExit = new eventEmitter2_1.EventEmitter2;
      this._internalee = new events_1.EventEmitter;
      this.handleFlowControl = !!(opt === null || opt === undefined ? undefined : opt.handleFlowControl);
      this._flowControlPause = (opt === null || opt === undefined ? undefined : opt.flowControlPause) || FLOW_CONTROL_PAUSE;
      this._flowControlResume = (opt === null || opt === undefined ? undefined : opt.flowControlResume) || FLOW_CONTROL_RESUME;
      if (!opt) {
        return;
      }
      this._checkType("name", opt.name ? opt.name : undefined, "string");
      this._checkType("cols", opt.cols ? opt.cols : undefined, "number");
      this._checkType("rows", opt.rows ? opt.rows : undefined, "number");
      this._checkType("cwd", opt.cwd ? opt.cwd : undefined, "string");
      this._checkType("env", opt.env ? opt.env : undefined, "object");
      this._checkType("uid", opt.uid ? opt.uid : undefined, "number");
      this._checkType("gid", opt.gid ? opt.gid : undefined, "number");
      this._checkType("encoding", opt.encoding ? opt.encoding : undefined, "string");
    }
    Object.defineProperty(Terminal2.prototype, "onData", {
      get: function() {
        return this._onData.event;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Terminal2.prototype, "onExit", {
      get: function() {
        return this._onExit.event;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Terminal2.prototype, "pid", {
      get: function() {
        return this._pid;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Terminal2.prototype, "cols", {
      get: function() {
        return this._cols;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Terminal2.prototype, "rows", {
      get: function() {
        return this._rows;
      },
      enumerable: false,
      configurable: true
    });
    Terminal2.prototype.write = function(data) {
      if (this.handleFlowControl) {
        if (data === this._flowControlPause) {
          this.pause();
          return;
        }
        if (data === this._flowControlResume) {
          this.resume();
          return;
        }
      }
      this._write(data);
    };
    Terminal2.prototype._forwardEvents = function() {
      var _this = this;
      this.on("data", function(e) {
        return _this._onData.fire(e);
      });
      this.on("exit", function(exitCode, signal) {
        return _this._onExit.fire({ exitCode, signal });
      });
    };
    Terminal2.prototype._checkType = function(name, value, type, allowArray) {
      if (allowArray === undefined) {
        allowArray = false;
      }
      if (value === undefined) {
        return;
      }
      if (allowArray) {
        if (Array.isArray(value)) {
          value.forEach(function(v, i) {
            if (typeof v !== type) {
              throw new Error(name + "[" + i + "] must be a " + type + " (not a " + typeof v[i] + ")");
            }
          });
          return;
        }
      }
      if (typeof value !== type) {
        throw new Error(name + " must be a " + type + " (not a " + typeof value + ")");
      }
    };
    Terminal2.prototype.end = function(data) {
      this._socket.end(data);
    };
    Terminal2.prototype.pipe = function(dest, options) {
      return this._socket.pipe(dest, options);
    };
    Terminal2.prototype.pause = function() {
      return this._socket.pause();
    };
    Terminal2.prototype.resume = function() {
      return this._socket.resume();
    };
    Terminal2.prototype.setEncoding = function(encoding) {
      if (this._socket._decoder) {
        delete this._socket._decoder;
      }
      if (encoding) {
        this._socket.setEncoding(encoding);
      }
    };
    Terminal2.prototype.addListener = function(eventName, listener) {
      this.on(eventName, listener);
    };
    Terminal2.prototype.on = function(eventName, listener) {
      if (eventName === "close") {
        this._internalee.on("close", listener);
        return;
      }
      this._socket.on(eventName, listener);
    };
    Terminal2.prototype.emit = function(eventName) {
      var args = [];
      for (var _i = 1;_i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
      }
      if (eventName === "close") {
        return this._internalee.emit.apply(this._internalee, arguments);
      }
      return this._socket.emit.apply(this._socket, arguments);
    };
    Terminal2.prototype.listeners = function(eventName) {
      return this._socket.listeners(eventName);
    };
    Terminal2.prototype.removeListener = function(eventName, listener) {
      this._socket.removeListener(eventName, listener);
    };
    Terminal2.prototype.removeAllListeners = function(eventName) {
      this._socket.removeAllListeners(eventName);
    };
    Terminal2.prototype.once = function(eventName, listener) {
      this._socket.once(eventName, listener);
    };
    Terminal2.prototype._close = function() {
      this._socket.readable = false;
      this.write = function() {};
      this.end = function() {};
      this._writable = false;
      this._readable = false;
    };
    Terminal2.prototype._parseEnv = function(env) {
      var keys = Object.keys(env || {});
      var pairs = [];
      for (var i = 0;i < keys.length; i++) {
        if (keys[i] === undefined) {
          continue;
        }
        pairs.push(keys[i] + "=" + env[keys[i]]);
      }
      return pairs;
    };
    return Terminal2;
  }();
  exports.Terminal = Terminal;
});

// apps/worker/node_modules/node-pty/lib/shared/conout.js
var require_conout = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getWorkerPipeName = undefined;
  function getWorkerPipeName(conoutPipeName) {
    return conoutPipeName + "-worker";
  }
  exports.getWorkerPipeName = getWorkerPipeName;
});

// apps/worker/node_modules/node-pty/lib/windowsConoutConnection.js
var require_windowsConoutConnection = __commonJS((exports) => {
  var __dirname = "/Users/lawrencechen/fun/coderouter/apps/worker/node_modules/node-pty/lib";
  var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var __generator = exports && exports.__generator || function(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1)
        throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), throw: verb(1), return: verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f)
        throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
            return t;
          if (y = 0, t)
            op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2])
                _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5)
        throw op[1];
      return { value: op[0] ? op[1] : undefined, done: true };
    }
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ConoutConnection = undefined;
  var worker_threads_1 = __require("worker_threads");
  var conout_1 = require_conout();
  var path_1 = __require("path");
  var eventEmitter2_1 = require_eventEmitter2();
  var FLUSH_DATA_INTERVAL = 1000;
  var ConoutConnection = function() {
    function ConoutConnection2(_conoutPipeName) {
      var _this = this;
      this._conoutPipeName = _conoutPipeName;
      this._isDisposed = false;
      this._onReady = new eventEmitter2_1.EventEmitter2;
      var workerData = { conoutPipeName: _conoutPipeName };
      var scriptPath = __dirname.replace("node_modules.asar", "node_modules.asar.unpacked");
      this._worker = new worker_threads_1.Worker(path_1.join(scriptPath, "worker/conoutSocketWorker.js"), { workerData });
      this._worker.on("message", function(message) {
        switch (message) {
          case 1:
            _this._onReady.fire();
            return;
          default:
            console.warn("Unexpected ConoutWorkerMessage", message);
        }
      });
    }
    Object.defineProperty(ConoutConnection2.prototype, "onReady", {
      get: function() {
        return this._onReady.event;
      },
      enumerable: false,
      configurable: true
    });
    ConoutConnection2.prototype.dispose = function() {
      if (this._isDisposed) {
        return;
      }
      this._isDisposed = true;
      this._drainDataAndClose();
    };
    ConoutConnection2.prototype.connectSocket = function(socket) {
      socket.connect(conout_1.getWorkerPipeName(this._conoutPipeName));
    };
    ConoutConnection2.prototype._drainDataAndClose = function() {
      var _this = this;
      if (this._drainTimeout) {
        clearTimeout(this._drainTimeout);
      }
      this._drainTimeout = setTimeout(function() {
        return _this._destroySocket();
      }, FLUSH_DATA_INTERVAL);
    };
    ConoutConnection2.prototype._destroySocket = function() {
      return __awaiter(this, undefined, undefined, function() {
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              return [4, this._worker.terminate()];
            case 1:
              _a.sent();
              return [2];
          }
        });
      });
    };
    return ConoutConnection2;
  }();
  exports.ConoutConnection = ConoutConnection;
});

// apps/worker/node_modules/node-pty/build/Release/pty.node
var require_pty = __commonJS((exports, module) => {
  module.exports = __require("./pty-cem36aew.node");
});

// apps/worker/node_modules/node-pty/lib/windowsPtyAgent.js
var require_windowsPtyAgent = __commonJS((exports) => {
  var __dirname = "/Users/lawrencechen/fun/coderouter/apps/worker/node_modules/node-pty/lib";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.argsToCommandLine = exports.WindowsPtyAgent = undefined;
  var fs = __require("fs");
  var os = __require("os");
  var path = __require("path");
  var net_1 = __require("net");
  var child_process_1 = __require("child_process");
  var windowsConoutConnection_1 = require_windowsConoutConnection();
  var conptyNative;
  var winptyNative;
  var FLUSH_DATA_INTERVAL = 1000;
  var WindowsPtyAgent = function() {
    function WindowsPtyAgent2(file, args, env, cwd, cols, rows, debug, _useConpty, conptyInheritCursor) {
      var _this = this;
      if (conptyInheritCursor === undefined) {
        conptyInheritCursor = false;
      }
      this._useConpty = _useConpty;
      this._pid = 0;
      this._innerPid = 0;
      this._innerPidHandle = 0;
      if (this._useConpty === undefined || this._useConpty === true) {
        this._useConpty = this._getWindowsBuildNumber() >= 18309;
      }
      if (this._useConpty) {
        if (!conptyNative) {
          try {
            conptyNative = (()=>{throw new Error("Cannot require module "+"../build/Release/conpty.node");})();
          } catch (outerError) {
            try {
              conptyNative = (()=>{throw new Error("Cannot require module "+"../build/Debug/conpty.node");})();
            } catch (innerError) {
              console.error("innerError", innerError);
              throw outerError;
            }
          }
        }
      } else {
        if (!winptyNative) {
          try {
            winptyNative = require_pty();
          } catch (outerError) {
            try {
              winptyNative = (()=>{throw new Error("Cannot require module "+"../build/Debug/pty.node");})();
            } catch (innerError) {
              console.error("innerError", innerError);
              throw outerError;
            }
          }
        }
      }
      this._ptyNative = this._useConpty ? conptyNative : winptyNative;
      cwd = path.resolve(cwd);
      var commandLine = argsToCommandLine(file, args);
      var term;
      if (this._useConpty) {
        term = this._ptyNative.startProcess(file, cols, rows, debug, this._generatePipeName(), conptyInheritCursor);
      } else {
        term = this._ptyNative.startProcess(file, commandLine, env, cwd, cols, rows, debug);
        this._pid = term.pid;
        this._innerPid = term.innerPid;
        this._innerPidHandle = term.innerPidHandle;
      }
      this._fd = term.fd;
      this._pty = term.pty;
      this._outSocket = new net_1.Socket;
      this._outSocket.setEncoding("utf8");
      this._conoutSocketWorker = new windowsConoutConnection_1.ConoutConnection(term.conout);
      this._conoutSocketWorker.onReady(function() {
        _this._conoutSocketWorker.connectSocket(_this._outSocket);
      });
      this._outSocket.on("connect", function() {
        _this._outSocket.emit("ready_datapipe");
      });
      var inSocketFD = fs.openSync(term.conin, "w");
      this._inSocket = new net_1.Socket({
        fd: inSocketFD,
        readable: false,
        writable: true
      });
      this._inSocket.setEncoding("utf8");
      if (this._useConpty) {
        var connect = this._ptyNative.connect(this._pty, commandLine, cwd, env, function(c) {
          return _this._$onProcessExit(c);
        });
        this._innerPid = connect.pid;
      }
    }
    Object.defineProperty(WindowsPtyAgent2.prototype, "inSocket", {
      get: function() {
        return this._inSocket;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsPtyAgent2.prototype, "outSocket", {
      get: function() {
        return this._outSocket;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsPtyAgent2.prototype, "fd", {
      get: function() {
        return this._fd;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsPtyAgent2.prototype, "innerPid", {
      get: function() {
        return this._innerPid;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsPtyAgent2.prototype, "pty", {
      get: function() {
        return this._pty;
      },
      enumerable: false,
      configurable: true
    });
    WindowsPtyAgent2.prototype.resize = function(cols, rows) {
      if (this._useConpty) {
        if (this._exitCode !== undefined) {
          throw new Error("Cannot resize a pty that has already exited");
        }
        this._ptyNative.resize(this._pty, cols, rows);
        return;
      }
      this._ptyNative.resize(this._pid, cols, rows);
    };
    WindowsPtyAgent2.prototype.clear = function() {
      if (this._useConpty) {
        this._ptyNative.clear(this._pty);
      }
    };
    WindowsPtyAgent2.prototype.kill = function() {
      var _this = this;
      this._inSocket.readable = false;
      this._outSocket.readable = false;
      if (this._useConpty) {
        this._getConsoleProcessList().then(function(consoleProcessList) {
          consoleProcessList.forEach(function(pid) {
            try {
              process.kill(pid);
            } catch (e) {}
          });
          _this._ptyNative.kill(_this._pty);
        });
      } else {
        this._ptyNative.kill(this._pid, this._innerPidHandle);
        var processList = this._ptyNative.getProcessList(this._pid);
        processList.forEach(function(pid) {
          try {
            process.kill(pid);
          } catch (e) {}
        });
      }
      this._conoutSocketWorker.dispose();
    };
    WindowsPtyAgent2.prototype._getConsoleProcessList = function() {
      var _this = this;
      return new Promise(function(resolve) {
        var agent = child_process_1.fork(path.join(__dirname, "conpty_console_list_agent"), [_this._innerPid.toString()]);
        agent.on("message", function(message) {
          clearTimeout(timeout);
          resolve(message.consoleProcessList);
        });
        var timeout = setTimeout(function() {
          agent.kill();
          resolve([_this._innerPid]);
        }, 5000);
      });
    };
    Object.defineProperty(WindowsPtyAgent2.prototype, "exitCode", {
      get: function() {
        if (this._useConpty) {
          return this._exitCode;
        }
        return this._ptyNative.getExitCode(this._innerPidHandle);
      },
      enumerable: false,
      configurable: true
    });
    WindowsPtyAgent2.prototype._getWindowsBuildNumber = function() {
      var osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(os.release());
      var buildNumber = 0;
      if (osVersion && osVersion.length === 4) {
        buildNumber = parseInt(osVersion[3]);
      }
      return buildNumber;
    };
    WindowsPtyAgent2.prototype._generatePipeName = function() {
      return "conpty-" + Math.random() * 1e7;
    };
    WindowsPtyAgent2.prototype._$onProcessExit = function(exitCode) {
      var _this = this;
      this._exitCode = exitCode;
      this._flushDataAndCleanUp();
      this._outSocket.on("data", function() {
        return _this._flushDataAndCleanUp();
      });
    };
    WindowsPtyAgent2.prototype._flushDataAndCleanUp = function() {
      var _this = this;
      if (this._closeTimeout) {
        clearTimeout(this._closeTimeout);
      }
      this._closeTimeout = setTimeout(function() {
        return _this._cleanUpProcess();
      }, FLUSH_DATA_INTERVAL);
    };
    WindowsPtyAgent2.prototype._cleanUpProcess = function() {
      this._inSocket.readable = false;
      this._outSocket.readable = false;
      this._outSocket.destroy();
    };
    return WindowsPtyAgent2;
  }();
  exports.WindowsPtyAgent = WindowsPtyAgent;
  function argsToCommandLine(file, args) {
    if (isCommandLine(args)) {
      if (args.length === 0) {
        return file;
      }
      return argsToCommandLine(file, []) + " " + args;
    }
    var argv = [file];
    Array.prototype.push.apply(argv, args);
    var result = "";
    for (var argIndex = 0;argIndex < argv.length; argIndex++) {
      if (argIndex > 0) {
        result += " ";
      }
      var arg = argv[argIndex];
      var hasLopsidedEnclosingQuote = xOr(arg[0] !== '"', arg[arg.length - 1] !== '"');
      var hasNoEnclosingQuotes = arg[0] !== '"' && arg[arg.length - 1] !== '"';
      var quote = arg === "" || (arg.indexOf(" ") !== -1 || arg.indexOf("\t") !== -1) && (arg.length > 1 && (hasLopsidedEnclosingQuote || hasNoEnclosingQuotes));
      if (quote) {
        result += '"';
      }
      var bsCount = 0;
      for (var i = 0;i < arg.length; i++) {
        var p = arg[i];
        if (p === "\\") {
          bsCount++;
        } else if (p === '"') {
          result += repeatText("\\", bsCount * 2 + 1);
          result += '"';
          bsCount = 0;
        } else {
          result += repeatText("\\", bsCount);
          bsCount = 0;
          result += p;
        }
      }
      if (quote) {
        result += repeatText("\\", bsCount * 2);
        result += '"';
      } else {
        result += repeatText("\\", bsCount);
      }
    }
    return result;
  }
  exports.argsToCommandLine = argsToCommandLine;
  function isCommandLine(args) {
    return typeof args === "string";
  }
  function repeatText(text, count) {
    var result = "";
    for (var i = 0;i < count; i++) {
      result += text;
    }
    return result;
  }
  function xOr(arg1, arg2) {
    return arg1 && !arg2 || !arg1 && arg2;
  }
});

// apps/worker/node_modules/node-pty/lib/utils.js
var require_utils = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.assign = undefined;
  function assign(target) {
    var sources = [];
    for (var _i = 1;_i < arguments.length; _i++) {
      sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function(source) {
      return Object.keys(source).forEach(function(key) {
        return target[key] = source[key];
      });
    });
    return target;
  }
  exports.assign = assign;
});

// apps/worker/node_modules/node-pty/lib/windowsTerminal.js
var require_windowsTerminal = __commonJS((exports) => {
  var __extends = exports && exports.__extends || function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2)
          if (b2.hasOwnProperty(p))
            d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WindowsTerminal = undefined;
  var terminal_1 = require_terminal();
  var windowsPtyAgent_1 = require_windowsPtyAgent();
  var utils_1 = require_utils();
  var DEFAULT_FILE = "cmd.exe";
  var DEFAULT_NAME = "Windows Shell";
  var WindowsTerminal = function(_super) {
    __extends(WindowsTerminal2, _super);
    function WindowsTerminal2(file, args, opt) {
      var _this = _super.call(this, opt) || this;
      _this._checkType("args", args, "string", true);
      args = args || [];
      file = file || DEFAULT_FILE;
      opt = opt || {};
      opt.env = opt.env || process.env;
      if (opt.encoding) {
        console.warn("Setting encoding on Windows is not supported");
      }
      var env = utils_1.assign({}, opt.env);
      _this._cols = opt.cols || terminal_1.DEFAULT_COLS;
      _this._rows = opt.rows || terminal_1.DEFAULT_ROWS;
      var cwd = opt.cwd || process.cwd();
      var name = opt.name || env.TERM || DEFAULT_NAME;
      var parsedEnv = _this._parseEnv(env);
      _this._isReady = false;
      _this._deferreds = [];
      _this._agent = new windowsPtyAgent_1.WindowsPtyAgent(file, args, parsedEnv, cwd, _this._cols, _this._rows, false, opt.useConpty, opt.conptyInheritCursor);
      _this._socket = _this._agent.outSocket;
      _this._pid = _this._agent.innerPid;
      _this._fd = _this._agent.fd;
      _this._pty = _this._agent.pty;
      _this._socket.on("ready_datapipe", function() {
        ["connect", "data", "end", "timeout", "drain"].forEach(function(event) {
          _this._socket.on(event, function() {
            if (!_this._isReady && event === "data") {
              _this._isReady = true;
              _this._deferreds.forEach(function(fn) {
                fn.run();
              });
              _this._deferreds = [];
            }
          });
        });
        _this._socket.on("error", function(err) {
          _this._close();
          if (err.code) {
            if (~err.code.indexOf("errno 5") || ~err.code.indexOf("EIO"))
              return;
          }
          if (_this.listeners("error").length < 2) {
            throw err;
          }
        });
        _this._socket.on("close", function() {
          _this.emit("exit", _this._agent.exitCode);
          _this._close();
        });
      });
      _this._file = file;
      _this._name = name;
      _this._readable = true;
      _this._writable = true;
      _this._forwardEvents();
      return _this;
    }
    WindowsTerminal2.prototype._write = function(data) {
      this._defer(this._doWrite, data);
    };
    WindowsTerminal2.prototype._doWrite = function(data) {
      this._agent.inSocket.write(data);
    };
    WindowsTerminal2.open = function(options) {
      throw new Error("open() not supported on windows, use Fork() instead.");
    };
    WindowsTerminal2.prototype.resize = function(cols, rows) {
      var _this = this;
      if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows) || cols === Infinity || rows === Infinity) {
        throw new Error("resizing must be done using positive cols and rows");
      }
      this._deferNoArgs(function() {
        _this._agent.resize(cols, rows);
        _this._cols = cols;
        _this._rows = rows;
      });
    };
    WindowsTerminal2.prototype.clear = function() {
      var _this = this;
      this._deferNoArgs(function() {
        _this._agent.clear();
      });
    };
    WindowsTerminal2.prototype.destroy = function() {
      var _this = this;
      this._deferNoArgs(function() {
        _this.kill();
      });
    };
    WindowsTerminal2.prototype.kill = function(signal) {
      var _this = this;
      this._deferNoArgs(function() {
        if (signal) {
          throw new Error("Signals not supported on windows.");
        }
        _this._close();
        _this._agent.kill();
      });
    };
    WindowsTerminal2.prototype._deferNoArgs = function(deferredFn) {
      var _this = this;
      if (this._isReady) {
        deferredFn.call(this);
        return;
      }
      this._deferreds.push({
        run: function() {
          return deferredFn.call(_this);
        }
      });
    };
    WindowsTerminal2.prototype._defer = function(deferredFn, arg) {
      var _this = this;
      if (this._isReady) {
        deferredFn.call(this, arg);
        return;
      }
      this._deferreds.push({
        run: function() {
          return deferredFn.call(_this, arg);
        }
      });
    };
    Object.defineProperty(WindowsTerminal2.prototype, "process", {
      get: function() {
        return this._name;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsTerminal2.prototype, "master", {
      get: function() {
        throw new Error("master is not supported on Windows");
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(WindowsTerminal2.prototype, "slave", {
      get: function() {
        throw new Error("slave is not supported on Windows");
      },
      enumerable: false,
      configurable: true
    });
    return WindowsTerminal2;
  }(terminal_1.Terminal);
  exports.WindowsTerminal = WindowsTerminal;
});

// apps/worker/node_modules/node-pty/lib/unixTerminal.js
var require_unixTerminal = __commonJS((exports) => {
  var __dirname = "/Users/lawrencechen/fun/coderouter/apps/worker/node_modules/node-pty/lib";
  var __extends = exports && exports.__extends || function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2)
          if (b2.hasOwnProperty(p))
            d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.UnixTerminal = undefined;
  var net = __require("net");
  var path = __require("path");
  var terminal_1 = require_terminal();
  var utils_1 = require_utils();
  var pty;
  var helperPath;
  try {
    pty = require_pty();
    helperPath = "../build/Release/spawn-helper";
  } catch (outerError) {
    try {
      pty = (()=>{throw new Error("Cannot require module "+"../build/Debug/pty.node");})();
      helperPath = "../build/Debug/spawn-helper";
    } catch (innerError) {
      console.error("innerError", innerError);
      throw outerError;
    }
  }
  helperPath = path.resolve(__dirname, helperPath);
  helperPath = helperPath.replace("app.asar", "app.asar.unpacked");
  helperPath = helperPath.replace("node_modules.asar", "node_modules.asar.unpacked");
  var DEFAULT_FILE = "sh";
  var DEFAULT_NAME = "xterm";
  var DESTROY_SOCKET_TIMEOUT_MS = 200;
  var UnixTerminal = function(_super) {
    __extends(UnixTerminal2, _super);
    function UnixTerminal2(file, args, opt) {
      var _a, _b;
      var _this = _super.call(this, opt) || this;
      _this._boundClose = false;
      _this._emittedClose = false;
      if (typeof args === "string") {
        throw new Error("args as a string is not supported on unix.");
      }
      args = args || [];
      file = file || DEFAULT_FILE;
      opt = opt || {};
      opt.env = opt.env || process.env;
      _this._cols = opt.cols || terminal_1.DEFAULT_COLS;
      _this._rows = opt.rows || terminal_1.DEFAULT_ROWS;
      var uid = (_a = opt.uid) !== null && _a !== undefined ? _a : -1;
      var gid = (_b = opt.gid) !== null && _b !== undefined ? _b : -1;
      var env = utils_1.assign({}, opt.env);
      if (opt.env === process.env) {
        _this._sanitizeEnv(env);
      }
      var cwd = opt.cwd || process.cwd();
      env.PWD = cwd;
      var name = opt.name || env.TERM || DEFAULT_NAME;
      env.TERM = name;
      var parsedEnv = _this._parseEnv(env);
      var encoding = opt.encoding === undefined ? "utf8" : opt.encoding;
      var onexit = function(code, signal) {
        if (!_this._emittedClose) {
          if (_this._boundClose) {
            return;
          }
          _this._boundClose = true;
          var timeout_1 = setTimeout(function() {
            timeout_1 = null;
            _this._socket.destroy();
          }, DESTROY_SOCKET_TIMEOUT_MS);
          _this.once("close", function() {
            if (timeout_1 !== null) {
              clearTimeout(timeout_1);
            }
            _this.emit("exit", code, signal);
          });
          return;
        }
        _this.emit("exit", code, signal);
      };
      var term = pty.fork(file, args, parsedEnv, cwd, _this._cols, _this._rows, uid, gid, encoding === "utf8", helperPath, onexit);
      _this._socket = new PipeSocket(term.fd);
      if (encoding !== null) {
        _this._socket.setEncoding(encoding);
      }
      _this._socket.on("error", function(err) {
        if (err.code) {
          if (~err.code.indexOf("EAGAIN")) {
            return;
          }
        }
        _this._close();
        if (!_this._emittedClose) {
          _this._emittedClose = true;
          _this.emit("close");
        }
        if (err.code) {
          if (~err.code.indexOf("errno 5") || ~err.code.indexOf("EIO")) {
            return;
          }
        }
        if (_this.listeners("error").length < 2) {
          throw err;
        }
      });
      _this._pid = term.pid;
      _this._fd = term.fd;
      _this._pty = term.pty;
      _this._file = file;
      _this._name = name;
      _this._readable = true;
      _this._writable = true;
      _this._socket.on("close", function() {
        if (_this._emittedClose) {
          return;
        }
        _this._emittedClose = true;
        _this._close();
        _this.emit("close");
      });
      _this._forwardEvents();
      return _this;
    }
    Object.defineProperty(UnixTerminal2.prototype, "master", {
      get: function() {
        return this._master;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(UnixTerminal2.prototype, "slave", {
      get: function() {
        return this._slave;
      },
      enumerable: false,
      configurable: true
    });
    UnixTerminal2.prototype._write = function(data) {
      this._socket.write(data);
    };
    Object.defineProperty(UnixTerminal2.prototype, "fd", {
      get: function() {
        return this._fd;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(UnixTerminal2.prototype, "ptsName", {
      get: function() {
        return this._pty;
      },
      enumerable: false,
      configurable: true
    });
    UnixTerminal2.open = function(opt) {
      var self = Object.create(UnixTerminal2.prototype);
      opt = opt || {};
      if (arguments.length > 1) {
        opt = {
          cols: arguments[1],
          rows: arguments[2]
        };
      }
      var cols = opt.cols || terminal_1.DEFAULT_COLS;
      var rows = opt.rows || terminal_1.DEFAULT_ROWS;
      var encoding = opt.encoding === undefined ? "utf8" : opt.encoding;
      var term = pty.open(cols, rows);
      self._master = new PipeSocket(term.master);
      if (encoding !== null) {
        self._master.setEncoding(encoding);
      }
      self._master.resume();
      self._slave = new PipeSocket(term.slave);
      if (encoding !== null) {
        self._slave.setEncoding(encoding);
      }
      self._slave.resume();
      self._socket = self._master;
      self._pid = -1;
      self._fd = term.master;
      self._pty = term.pty;
      self._file = process.argv[0] || "node";
      self._name = process.env.TERM || "";
      self._readable = true;
      self._writable = true;
      self._socket.on("error", function(err) {
        self._close();
        if (self.listeners("error").length < 2) {
          throw err;
        }
      });
      self._socket.on("close", function() {
        self._close();
      });
      return self;
    };
    UnixTerminal2.prototype.destroy = function() {
      var _this = this;
      this._close();
      this._socket.once("close", function() {
        _this.kill("SIGHUP");
      });
      this._socket.destroy();
    };
    UnixTerminal2.prototype.kill = function(signal) {
      try {
        process.kill(this.pid, signal || "SIGHUP");
      } catch (e) {}
    };
    Object.defineProperty(UnixTerminal2.prototype, "process", {
      get: function() {
        if (process.platform === "darwin") {
          return pty.process(this._pid) || this._file;
        }
        return pty.process(this._fd, this._pty) || this._file;
      },
      enumerable: false,
      configurable: true
    });
    UnixTerminal2.prototype.resize = function(cols, rows) {
      if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows) || cols === Infinity || rows === Infinity) {
        throw new Error("resizing must be done using positive cols and rows");
      }
      pty.resize(this._fd, cols, rows);
      this._cols = cols;
      this._rows = rows;
    };
    UnixTerminal2.prototype.clear = function() {};
    UnixTerminal2.prototype._sanitizeEnv = function(env) {
      delete env["TMUX"];
      delete env["TMUX_PANE"];
      delete env["STY"];
      delete env["WINDOW"];
      delete env["WINDOWID"];
      delete env["TERMCAP"];
      delete env["COLUMNS"];
      delete env["LINES"];
    };
    return UnixTerminal2;
  }(terminal_1.Terminal);
  exports.UnixTerminal = UnixTerminal;
  var PipeSocket = function(_super) {
    __extends(PipeSocket2, _super);
    function PipeSocket2(fd) {
      var _this = this;
      var pipeWrap = process.binding("pipe_wrap");
      var handle = new pipeWrap.Pipe(pipeWrap.constants.SOCKET);
      handle.open(fd);
      _this = _super.call(this, { handle }) || this;
      return _this;
    }
    return PipeSocket2;
  }(net.Socket);
});

// apps/worker/node_modules/node-pty/lib/index.js
var require_lib = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.native = exports.open = exports.createTerminal = exports.fork = exports.spawn = undefined;
  var terminalCtor;
  if (process.platform === "win32") {
    terminalCtor = require_windowsTerminal().WindowsTerminal;
  } else {
    terminalCtor = require_unixTerminal().UnixTerminal;
  }
  function spawn(file, args, opt) {
    return new terminalCtor(file, args, opt);
  }
  exports.spawn = spawn;
  function fork(file, args, opt) {
    return new terminalCtor(file, args, opt);
  }
  exports.fork = fork;
  function createTerminal(file, args, opt) {
    return new terminalCtor(file, args, opt);
  }
  exports.createTerminal = createTerminal;
  function open(options) {
    return terminalCtor.open(options);
  }
  exports.open = open;
  exports.native = process.platform !== "win32" ? require_pty() : null;
});

// node_modules/negotiator/lib/charset.js
var require_charset = __commonJS((exports, module) => {
  module.exports = preferredCharsets;
  module.exports.preferredCharsets = preferredCharsets;
  var simpleCharsetRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
  function parseAcceptCharset(accept) {
    var accepts = accept.split(",");
    for (var i = 0, j = 0;i < accepts.length; i++) {
      var charset = parseCharset(accepts[i].trim(), i);
      if (charset) {
        accepts[j++] = charset;
      }
    }
    accepts.length = j;
    return accepts;
  }
  function parseCharset(str, i) {
    var match = simpleCharsetRegExp.exec(str);
    if (!match)
      return null;
    var charset = match[1];
    var q = 1;
    if (match[2]) {
      var params = match[2].split(";");
      for (var j = 0;j < params.length; j++) {
        var p = params[j].trim().split("=");
        if (p[0] === "q") {
          q = parseFloat(p[1]);
          break;
        }
      }
    }
    return {
      charset,
      q,
      i
    };
  }
  function getCharsetPriority(charset, accepted, index) {
    var priority = { o: -1, q: 0, s: 0 };
    for (var i = 0;i < accepted.length; i++) {
      var spec = specify(charset, accepted[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }
    return priority;
  }
  function specify(charset, spec, index) {
    var s = 0;
    if (spec.charset.toLowerCase() === charset.toLowerCase()) {
      s |= 1;
    } else if (spec.charset !== "*") {
      return null;
    }
    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s
    };
  }
  function preferredCharsets(accept, provided) {
    var accepts = parseAcceptCharset(accept === undefined ? "*" : accept || "");
    if (!provided) {
      return accepts.filter(isQuality).sort(compareSpecs).map(getFullCharset);
    }
    var priorities = provided.map(function getPriority(type, index) {
      return getCharsetPriority(type, accepts, index);
    });
    return priorities.filter(isQuality).sort(compareSpecs).map(function getCharset(priority) {
      return provided[priorities.indexOf(priority)];
    });
  }
  function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
  }
  function getFullCharset(spec) {
    return spec.charset;
  }
  function isQuality(spec) {
    return spec.q > 0;
  }
});

// node_modules/negotiator/lib/encoding.js
var require_encoding = __commonJS((exports, module) => {
  module.exports = preferredEncodings;
  module.exports.preferredEncodings = preferredEncodings;
  var simpleEncodingRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
  function parseAcceptEncoding(accept) {
    var accepts = accept.split(",");
    var hasIdentity = false;
    var minQuality = 1;
    for (var i = 0, j = 0;i < accepts.length; i++) {
      var encoding = parseEncoding(accepts[i].trim(), i);
      if (encoding) {
        accepts[j++] = encoding;
        hasIdentity = hasIdentity || specify("identity", encoding);
        minQuality = Math.min(minQuality, encoding.q || 1);
      }
    }
    if (!hasIdentity) {
      accepts[j++] = {
        encoding: "identity",
        q: minQuality,
        i
      };
    }
    accepts.length = j;
    return accepts;
  }
  function parseEncoding(str, i) {
    var match = simpleEncodingRegExp.exec(str);
    if (!match)
      return null;
    var encoding = match[1];
    var q = 1;
    if (match[2]) {
      var params = match[2].split(";");
      for (var j = 0;j < params.length; j++) {
        var p = params[j].trim().split("=");
        if (p[0] === "q") {
          q = parseFloat(p[1]);
          break;
        }
      }
    }
    return {
      encoding,
      q,
      i
    };
  }
  function getEncodingPriority(encoding, accepted, index) {
    var priority = { o: -1, q: 0, s: 0 };
    for (var i = 0;i < accepted.length; i++) {
      var spec = specify(encoding, accepted[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }
    return priority;
  }
  function specify(encoding, spec, index) {
    var s = 0;
    if (spec.encoding.toLowerCase() === encoding.toLowerCase()) {
      s |= 1;
    } else if (spec.encoding !== "*") {
      return null;
    }
    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s
    };
  }
  function preferredEncodings(accept, provided) {
    var accepts = parseAcceptEncoding(accept || "");
    if (!provided) {
      return accepts.filter(isQuality).sort(compareSpecs).map(getFullEncoding);
    }
    var priorities = provided.map(function getPriority(type, index) {
      return getEncodingPriority(type, accepts, index);
    });
    return priorities.filter(isQuality).sort(compareSpecs).map(function getEncoding(priority) {
      return provided[priorities.indexOf(priority)];
    });
  }
  function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
  }
  function getFullEncoding(spec) {
    return spec.encoding;
  }
  function isQuality(spec) {
    return spec.q > 0;
  }
});

// node_modules/negotiator/lib/language.js
var require_language = __commonJS((exports, module) => {
  module.exports = preferredLanguages;
  module.exports.preferredLanguages = preferredLanguages;
  var simpleLanguageRegExp = /^\s*([^\s\-;]+)(?:-([^\s;]+))?\s*(?:;(.*))?$/;
  function parseAcceptLanguage(accept) {
    var accepts = accept.split(",");
    for (var i = 0, j = 0;i < accepts.length; i++) {
      var language = parseLanguage(accepts[i].trim(), i);
      if (language) {
        accepts[j++] = language;
      }
    }
    accepts.length = j;
    return accepts;
  }
  function parseLanguage(str, i) {
    var match = simpleLanguageRegExp.exec(str);
    if (!match)
      return null;
    var prefix = match[1];
    var suffix = match[2];
    var full = prefix;
    if (suffix)
      full += "-" + suffix;
    var q = 1;
    if (match[3]) {
      var params = match[3].split(";");
      for (var j = 0;j < params.length; j++) {
        var p = params[j].split("=");
        if (p[0] === "q")
          q = parseFloat(p[1]);
      }
    }
    return {
      prefix,
      suffix,
      q,
      i,
      full
    };
  }
  function getLanguagePriority(language, accepted, index) {
    var priority = { o: -1, q: 0, s: 0 };
    for (var i = 0;i < accepted.length; i++) {
      var spec = specify(language, accepted[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }
    return priority;
  }
  function specify(language, spec, index) {
    var p = parseLanguage(language);
    if (!p)
      return null;
    var s = 0;
    if (spec.full.toLowerCase() === p.full.toLowerCase()) {
      s |= 4;
    } else if (spec.prefix.toLowerCase() === p.full.toLowerCase()) {
      s |= 2;
    } else if (spec.full.toLowerCase() === p.prefix.toLowerCase()) {
      s |= 1;
    } else if (spec.full !== "*") {
      return null;
    }
    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s
    };
  }
  function preferredLanguages(accept, provided) {
    var accepts = parseAcceptLanguage(accept === undefined ? "*" : accept || "");
    if (!provided) {
      return accepts.filter(isQuality).sort(compareSpecs).map(getFullLanguage);
    }
    var priorities = provided.map(function getPriority(type, index) {
      return getLanguagePriority(type, accepts, index);
    });
    return priorities.filter(isQuality).sort(compareSpecs).map(function getLanguage(priority) {
      return provided[priorities.indexOf(priority)];
    });
  }
  function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
  }
  function getFullLanguage(spec) {
    return spec.full;
  }
  function isQuality(spec) {
    return spec.q > 0;
  }
});

// node_modules/negotiator/lib/mediaType.js
var require_mediaType = __commonJS((exports, module) => {
  module.exports = preferredMediaTypes;
  module.exports.preferredMediaTypes = preferredMediaTypes;
  var simpleMediaTypeRegExp = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/;
  function parseAccept(accept) {
    var accepts = splitMediaTypes(accept);
    for (var i = 0, j = 0;i < accepts.length; i++) {
      var mediaType = parseMediaType(accepts[i].trim(), i);
      if (mediaType) {
        accepts[j++] = mediaType;
      }
    }
    accepts.length = j;
    return accepts;
  }
  function parseMediaType(str, i) {
    var match = simpleMediaTypeRegExp.exec(str);
    if (!match)
      return null;
    var params = Object.create(null);
    var q = 1;
    var subtype = match[2];
    var type = match[1];
    if (match[3]) {
      var kvps = splitParameters(match[3]).map(splitKeyValuePair);
      for (var j = 0;j < kvps.length; j++) {
        var pair = kvps[j];
        var key = pair[0].toLowerCase();
        var val = pair[1];
        var value = val && val[0] === '"' && val[val.length - 1] === '"' ? val.substr(1, val.length - 2) : val;
        if (key === "q") {
          q = parseFloat(value);
          break;
        }
        params[key] = value;
      }
    }
    return {
      type,
      subtype,
      params,
      q,
      i
    };
  }
  function getMediaTypePriority(type, accepted, index) {
    var priority = { o: -1, q: 0, s: 0 };
    for (var i = 0;i < accepted.length; i++) {
      var spec = specify(type, accepted[i], index);
      if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
        priority = spec;
      }
    }
    return priority;
  }
  function specify(type, spec, index) {
    var p = parseMediaType(type);
    var s = 0;
    if (!p) {
      return null;
    }
    if (spec.type.toLowerCase() == p.type.toLowerCase()) {
      s |= 4;
    } else if (spec.type != "*") {
      return null;
    }
    if (spec.subtype.toLowerCase() == p.subtype.toLowerCase()) {
      s |= 2;
    } else if (spec.subtype != "*") {
      return null;
    }
    var keys = Object.keys(spec.params);
    if (keys.length > 0) {
      if (keys.every(function(k) {
        return spec.params[k] == "*" || (spec.params[k] || "").toLowerCase() == (p.params[k] || "").toLowerCase();
      })) {
        s |= 1;
      } else {
        return null;
      }
    }
    return {
      i: index,
      o: spec.i,
      q: spec.q,
      s
    };
  }
  function preferredMediaTypes(accept, provided) {
    var accepts = parseAccept(accept === undefined ? "*/*" : accept || "");
    if (!provided) {
      return accepts.filter(isQuality).sort(compareSpecs).map(getFullType);
    }
    var priorities = provided.map(function getPriority(type, index) {
      return getMediaTypePriority(type, accepts, index);
    });
    return priorities.filter(isQuality).sort(compareSpecs).map(function getType(priority) {
      return provided[priorities.indexOf(priority)];
    });
  }
  function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
  }
  function getFullType(spec) {
    return spec.type + "/" + spec.subtype;
  }
  function isQuality(spec) {
    return spec.q > 0;
  }
  function quoteCount(string) {
    var count = 0;
    var index = 0;
    while ((index = string.indexOf('"', index)) !== -1) {
      count++;
      index++;
    }
    return count;
  }
  function splitKeyValuePair(str) {
    var index = str.indexOf("=");
    var key;
    var val;
    if (index === -1) {
      key = str;
    } else {
      key = str.substr(0, index);
      val = str.substr(index + 1);
    }
    return [key, val];
  }
  function splitMediaTypes(accept) {
    var accepts = accept.split(",");
    for (var i = 1, j = 0;i < accepts.length; i++) {
      if (quoteCount(accepts[j]) % 2 == 0) {
        accepts[++j] = accepts[i];
      } else {
        accepts[j] += "," + accepts[i];
      }
    }
    accepts.length = j + 1;
    return accepts;
  }
  function splitParameters(str) {
    var parameters = str.split(";");
    for (var i = 1, j = 0;i < parameters.length; i++) {
      if (quoteCount(parameters[j]) % 2 == 0) {
        parameters[++j] = parameters[i];
      } else {
        parameters[j] += ";" + parameters[i];
      }
    }
    parameters.length = j + 1;
    for (var i = 0;i < parameters.length; i++) {
      parameters[i] = parameters[i].trim();
    }
    return parameters;
  }
});

// node_modules/negotiator/index.js
var require_negotiator = __commonJS((exports, module) => {
  /*!
   * negotiator
   * Copyright(c) 2012 Federico Romero
   * Copyright(c) 2012-2014 Isaac Z. Schlueter
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  var preferredCharsets = require_charset();
  var preferredEncodings = require_encoding();
  var preferredLanguages = require_language();
  var preferredMediaTypes = require_mediaType();
  module.exports = Negotiator;
  module.exports.Negotiator = Negotiator;
  function Negotiator(request) {
    if (!(this instanceof Negotiator)) {
      return new Negotiator(request);
    }
    this.request = request;
  }
  Negotiator.prototype.charset = function charset(available) {
    var set = this.charsets(available);
    return set && set[0];
  };
  Negotiator.prototype.charsets = function charsets(available) {
    return preferredCharsets(this.request.headers["accept-charset"], available);
  };
  Negotiator.prototype.encoding = function encoding(available) {
    var set = this.encodings(available);
    return set && set[0];
  };
  Negotiator.prototype.encodings = function encodings(available) {
    return preferredEncodings(this.request.headers["accept-encoding"], available);
  };
  Negotiator.prototype.language = function language(available) {
    var set = this.languages(available);
    return set && set[0];
  };
  Negotiator.prototype.languages = function languages(available) {
    return preferredLanguages(this.request.headers["accept-language"], available);
  };
  Negotiator.prototype.mediaType = function mediaType(available) {
    var set = this.mediaTypes(available);
    return set && set[0];
  };
  Negotiator.prototype.mediaTypes = function mediaTypes(available) {
    return preferredMediaTypes(this.request.headers.accept, available);
  };
  Negotiator.prototype.preferredCharset = Negotiator.prototype.charset;
  Negotiator.prototype.preferredCharsets = Negotiator.prototype.charsets;
  Negotiator.prototype.preferredEncoding = Negotiator.prototype.encoding;
  Negotiator.prototype.preferredEncodings = Negotiator.prototype.encodings;
  Negotiator.prototype.preferredLanguage = Negotiator.prototype.language;
  Negotiator.prototype.preferredLanguages = Negotiator.prototype.languages;
  Negotiator.prototype.preferredMediaType = Negotiator.prototype.mediaType;
  Negotiator.prototype.preferredMediaTypes = Negotiator.prototype.mediaTypes;
});

// node_modules/mime-db/db.json
var require_db = __commonJS((exports, module) => {
  module.exports = {
    "application/1d-interleaved-parityfec": {
      source: "iana"
    },
    "application/3gpdash-qoe-report+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/3gpp-ims+xml": {
      source: "iana",
      compressible: true
    },
    "application/3gpphal+json": {
      source: "iana",
      compressible: true
    },
    "application/3gpphalforms+json": {
      source: "iana",
      compressible: true
    },
    "application/a2l": {
      source: "iana"
    },
    "application/ace+cbor": {
      source: "iana"
    },
    "application/activemessage": {
      source: "iana"
    },
    "application/activity+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-costmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-costmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-directory+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcost+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcostparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointprop+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointpropparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-error+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-updatestreamcontrol+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-updatestreamparams+json": {
      source: "iana",
      compressible: true
    },
    "application/aml": {
      source: "iana"
    },
    "application/andrew-inset": {
      source: "iana",
      extensions: ["ez"]
    },
    "application/applefile": {
      source: "iana"
    },
    "application/applixware": {
      source: "apache",
      extensions: ["aw"]
    },
    "application/at+jwt": {
      source: "iana"
    },
    "application/atf": {
      source: "iana"
    },
    "application/atfx": {
      source: "iana"
    },
    "application/atom+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atom"]
    },
    "application/atomcat+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomcat"]
    },
    "application/atomdeleted+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomdeleted"]
    },
    "application/atomicmail": {
      source: "iana"
    },
    "application/atomsvc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomsvc"]
    },
    "application/atsc-dwd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dwd"]
    },
    "application/atsc-dynamic-event-message": {
      source: "iana"
    },
    "application/atsc-held+xml": {
      source: "iana",
      compressible: true,
      extensions: ["held"]
    },
    "application/atsc-rdt+json": {
      source: "iana",
      compressible: true
    },
    "application/atsc-rsat+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rsat"]
    },
    "application/atxml": {
      source: "iana"
    },
    "application/auth-policy+xml": {
      source: "iana",
      compressible: true
    },
    "application/bacnet-xdd+zip": {
      source: "iana",
      compressible: false
    },
    "application/batch-smtp": {
      source: "iana"
    },
    "application/bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/beep+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/calendar+json": {
      source: "iana",
      compressible: true
    },
    "application/calendar+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xcs"]
    },
    "application/call-completion": {
      source: "iana"
    },
    "application/cals-1840": {
      source: "iana"
    },
    "application/captive+json": {
      source: "iana",
      compressible: true
    },
    "application/cbor": {
      source: "iana"
    },
    "application/cbor-seq": {
      source: "iana"
    },
    "application/cccex": {
      source: "iana"
    },
    "application/ccmp+xml": {
      source: "iana",
      compressible: true
    },
    "application/ccxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ccxml"]
    },
    "application/cdfx+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cdfx"]
    },
    "application/cdmi-capability": {
      source: "iana",
      extensions: ["cdmia"]
    },
    "application/cdmi-container": {
      source: "iana",
      extensions: ["cdmic"]
    },
    "application/cdmi-domain": {
      source: "iana",
      extensions: ["cdmid"]
    },
    "application/cdmi-object": {
      source: "iana",
      extensions: ["cdmio"]
    },
    "application/cdmi-queue": {
      source: "iana",
      extensions: ["cdmiq"]
    },
    "application/cdni": {
      source: "iana"
    },
    "application/cea": {
      source: "iana"
    },
    "application/cea-2018+xml": {
      source: "iana",
      compressible: true
    },
    "application/cellml+xml": {
      source: "iana",
      compressible: true
    },
    "application/cfw": {
      source: "iana"
    },
    "application/city+json": {
      source: "iana",
      compressible: true
    },
    "application/clr": {
      source: "iana"
    },
    "application/clue+xml": {
      source: "iana",
      compressible: true
    },
    "application/clue_info+xml": {
      source: "iana",
      compressible: true
    },
    "application/cms": {
      source: "iana"
    },
    "application/cnrp+xml": {
      source: "iana",
      compressible: true
    },
    "application/coap-group+json": {
      source: "iana",
      compressible: true
    },
    "application/coap-payload": {
      source: "iana"
    },
    "application/commonground": {
      source: "iana"
    },
    "application/conference-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/cose": {
      source: "iana"
    },
    "application/cose-key": {
      source: "iana"
    },
    "application/cose-key-set": {
      source: "iana"
    },
    "application/cpl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cpl"]
    },
    "application/csrattrs": {
      source: "iana"
    },
    "application/csta+xml": {
      source: "iana",
      compressible: true
    },
    "application/cstadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/csvm+json": {
      source: "iana",
      compressible: true
    },
    "application/cu-seeme": {
      source: "apache",
      extensions: ["cu"]
    },
    "application/cwt": {
      source: "iana"
    },
    "application/cybercash": {
      source: "iana"
    },
    "application/dart": {
      compressible: true
    },
    "application/dash+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpd"]
    },
    "application/dash-patch+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpp"]
    },
    "application/dashdelta": {
      source: "iana"
    },
    "application/davmount+xml": {
      source: "iana",
      compressible: true,
      extensions: ["davmount"]
    },
    "application/dca-rft": {
      source: "iana"
    },
    "application/dcd": {
      source: "iana"
    },
    "application/dec-dx": {
      source: "iana"
    },
    "application/dialog-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/dicom": {
      source: "iana"
    },
    "application/dicom+json": {
      source: "iana",
      compressible: true
    },
    "application/dicom+xml": {
      source: "iana",
      compressible: true
    },
    "application/dii": {
      source: "iana"
    },
    "application/dit": {
      source: "iana"
    },
    "application/dns": {
      source: "iana"
    },
    "application/dns+json": {
      source: "iana",
      compressible: true
    },
    "application/dns-message": {
      source: "iana"
    },
    "application/docbook+xml": {
      source: "apache",
      compressible: true,
      extensions: ["dbk"]
    },
    "application/dots+cbor": {
      source: "iana"
    },
    "application/dskpp+xml": {
      source: "iana",
      compressible: true
    },
    "application/dssc+der": {
      source: "iana",
      extensions: ["dssc"]
    },
    "application/dssc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdssc"]
    },
    "application/dvcs": {
      source: "iana"
    },
    "application/ecmascript": {
      source: "iana",
      compressible: true,
      extensions: ["es", "ecma"]
    },
    "application/edi-consent": {
      source: "iana"
    },
    "application/edi-x12": {
      source: "iana",
      compressible: false
    },
    "application/edifact": {
      source: "iana",
      compressible: false
    },
    "application/efi": {
      source: "iana"
    },
    "application/elm+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/elm+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.cap+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/emergencycalldata.comment+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.control+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.deviceinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.ecall.msd": {
      source: "iana"
    },
    "application/emergencycalldata.providerinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.serviceinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.subscriberinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.veds+xml": {
      source: "iana",
      compressible: true
    },
    "application/emma+xml": {
      source: "iana",
      compressible: true,
      extensions: ["emma"]
    },
    "application/emotionml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["emotionml"]
    },
    "application/encaprtp": {
      source: "iana"
    },
    "application/epp+xml": {
      source: "iana",
      compressible: true
    },
    "application/epub+zip": {
      source: "iana",
      compressible: false,
      extensions: ["epub"]
    },
    "application/eshop": {
      source: "iana"
    },
    "application/exi": {
      source: "iana",
      extensions: ["exi"]
    },
    "application/expect-ct-report+json": {
      source: "iana",
      compressible: true
    },
    "application/express": {
      source: "iana",
      extensions: ["exp"]
    },
    "application/fastinfoset": {
      source: "iana"
    },
    "application/fastsoap": {
      source: "iana"
    },
    "application/fdt+xml": {
      source: "iana",
      compressible: true,
      extensions: ["fdt"]
    },
    "application/fhir+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/fhir+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/fido.trusted-apps+json": {
      compressible: true
    },
    "application/fits": {
      source: "iana"
    },
    "application/flexfec": {
      source: "iana"
    },
    "application/font-sfnt": {
      source: "iana"
    },
    "application/font-tdpfr": {
      source: "iana",
      extensions: ["pfr"]
    },
    "application/font-woff": {
      source: "iana",
      compressible: false
    },
    "application/framework-attributes+xml": {
      source: "iana",
      compressible: true
    },
    "application/geo+json": {
      source: "iana",
      compressible: true,
      extensions: ["geojson"]
    },
    "application/geo+json-seq": {
      source: "iana"
    },
    "application/geopackage+sqlite3": {
      source: "iana"
    },
    "application/geoxacml+xml": {
      source: "iana",
      compressible: true
    },
    "application/gltf-buffer": {
      source: "iana"
    },
    "application/gml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["gml"]
    },
    "application/gpx+xml": {
      source: "apache",
      compressible: true,
      extensions: ["gpx"]
    },
    "application/gxf": {
      source: "apache",
      extensions: ["gxf"]
    },
    "application/gzip": {
      source: "iana",
      compressible: false,
      extensions: ["gz"]
    },
    "application/h224": {
      source: "iana"
    },
    "application/held+xml": {
      source: "iana",
      compressible: true
    },
    "application/hjson": {
      extensions: ["hjson"]
    },
    "application/http": {
      source: "iana"
    },
    "application/hyperstudio": {
      source: "iana",
      extensions: ["stk"]
    },
    "application/ibe-key-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/ibe-pkg-reply+xml": {
      source: "iana",
      compressible: true
    },
    "application/ibe-pp-data": {
      source: "iana"
    },
    "application/iges": {
      source: "iana"
    },
    "application/im-iscomposing+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/index": {
      source: "iana"
    },
    "application/index.cmd": {
      source: "iana"
    },
    "application/index.obj": {
      source: "iana"
    },
    "application/index.response": {
      source: "iana"
    },
    "application/index.vnd": {
      source: "iana"
    },
    "application/inkml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ink", "inkml"]
    },
    "application/iotp": {
      source: "iana"
    },
    "application/ipfix": {
      source: "iana",
      extensions: ["ipfix"]
    },
    "application/ipp": {
      source: "iana"
    },
    "application/isup": {
      source: "iana"
    },
    "application/its+xml": {
      source: "iana",
      compressible: true,
      extensions: ["its"]
    },
    "application/java-archive": {
      source: "apache",
      compressible: false,
      extensions: ["jar", "war", "ear"]
    },
    "application/java-serialized-object": {
      source: "apache",
      compressible: false,
      extensions: ["ser"]
    },
    "application/java-vm": {
      source: "apache",
      compressible: false,
      extensions: ["class"]
    },
    "application/javascript": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["js", "mjs"]
    },
    "application/jf2feed+json": {
      source: "iana",
      compressible: true
    },
    "application/jose": {
      source: "iana"
    },
    "application/jose+json": {
      source: "iana",
      compressible: true
    },
    "application/jrd+json": {
      source: "iana",
      compressible: true
    },
    "application/jscalendar+json": {
      source: "iana",
      compressible: true
    },
    "application/json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["json", "map"]
    },
    "application/json-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/json-seq": {
      source: "iana"
    },
    "application/json5": {
      extensions: ["json5"]
    },
    "application/jsonml+json": {
      source: "apache",
      compressible: true,
      extensions: ["jsonml"]
    },
    "application/jwk+json": {
      source: "iana",
      compressible: true
    },
    "application/jwk-set+json": {
      source: "iana",
      compressible: true
    },
    "application/jwt": {
      source: "iana"
    },
    "application/kpml-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/kpml-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/ld+json": {
      source: "iana",
      compressible: true,
      extensions: ["jsonld"]
    },
    "application/lgr+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lgr"]
    },
    "application/link-format": {
      source: "iana"
    },
    "application/load-control+xml": {
      source: "iana",
      compressible: true
    },
    "application/lost+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lostxml"]
    },
    "application/lostsync+xml": {
      source: "iana",
      compressible: true
    },
    "application/lpf+zip": {
      source: "iana",
      compressible: false
    },
    "application/lxf": {
      source: "iana"
    },
    "application/mac-binhex40": {
      source: "iana",
      extensions: ["hqx"]
    },
    "application/mac-compactpro": {
      source: "apache",
      extensions: ["cpt"]
    },
    "application/macwriteii": {
      source: "iana"
    },
    "application/mads+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mads"]
    },
    "application/manifest+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["webmanifest"]
    },
    "application/marc": {
      source: "iana",
      extensions: ["mrc"]
    },
    "application/marcxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mrcx"]
    },
    "application/mathematica": {
      source: "iana",
      extensions: ["ma", "nb", "mb"]
    },
    "application/mathml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mathml"]
    },
    "application/mathml-content+xml": {
      source: "iana",
      compressible: true
    },
    "application/mathml-presentation+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-associated-procedure-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-deregister+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-envelope+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-msk+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-msk-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-protection-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-reception-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-register+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-register-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-schedule+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-user-service-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbox": {
      source: "iana",
      extensions: ["mbox"]
    },
    "application/media-policy-dataset+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpf"]
    },
    "application/media_control+xml": {
      source: "iana",
      compressible: true
    },
    "application/mediaservercontrol+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mscml"]
    },
    "application/merge-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/metalink+xml": {
      source: "apache",
      compressible: true,
      extensions: ["metalink"]
    },
    "application/metalink4+xml": {
      source: "iana",
      compressible: true,
      extensions: ["meta4"]
    },
    "application/mets+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mets"]
    },
    "application/mf4": {
      source: "iana"
    },
    "application/mikey": {
      source: "iana"
    },
    "application/mipc": {
      source: "iana"
    },
    "application/missing-blocks+cbor-seq": {
      source: "iana"
    },
    "application/mmt-aei+xml": {
      source: "iana",
      compressible: true,
      extensions: ["maei"]
    },
    "application/mmt-usd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["musd"]
    },
    "application/mods+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mods"]
    },
    "application/moss-keys": {
      source: "iana"
    },
    "application/moss-signature": {
      source: "iana"
    },
    "application/mosskey-data": {
      source: "iana"
    },
    "application/mosskey-request": {
      source: "iana"
    },
    "application/mp21": {
      source: "iana",
      extensions: ["m21", "mp21"]
    },
    "application/mp4": {
      source: "iana",
      extensions: ["mp4s", "m4p"]
    },
    "application/mpeg4-generic": {
      source: "iana"
    },
    "application/mpeg4-iod": {
      source: "iana"
    },
    "application/mpeg4-iod-xmt": {
      source: "iana"
    },
    "application/mrb-consumer+xml": {
      source: "iana",
      compressible: true
    },
    "application/mrb-publish+xml": {
      source: "iana",
      compressible: true
    },
    "application/msc-ivr+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/msc-mixer+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/msword": {
      source: "iana",
      compressible: false,
      extensions: ["doc", "dot"]
    },
    "application/mud+json": {
      source: "iana",
      compressible: true
    },
    "application/multipart-core": {
      source: "iana"
    },
    "application/mxf": {
      source: "iana",
      extensions: ["mxf"]
    },
    "application/n-quads": {
      source: "iana",
      extensions: ["nq"]
    },
    "application/n-triples": {
      source: "iana",
      extensions: ["nt"]
    },
    "application/nasdata": {
      source: "iana"
    },
    "application/news-checkgroups": {
      source: "iana",
      charset: "US-ASCII"
    },
    "application/news-groupinfo": {
      source: "iana",
      charset: "US-ASCII"
    },
    "application/news-transmission": {
      source: "iana"
    },
    "application/nlsml+xml": {
      source: "iana",
      compressible: true
    },
    "application/node": {
      source: "iana",
      extensions: ["cjs"]
    },
    "application/nss": {
      source: "iana"
    },
    "application/oauth-authz-req+jwt": {
      source: "iana"
    },
    "application/oblivious-dns-message": {
      source: "iana"
    },
    "application/ocsp-request": {
      source: "iana"
    },
    "application/ocsp-response": {
      source: "iana"
    },
    "application/octet-stream": {
      source: "iana",
      compressible: false,
      extensions: ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"]
    },
    "application/oda": {
      source: "iana",
      extensions: ["oda"]
    },
    "application/odm+xml": {
      source: "iana",
      compressible: true
    },
    "application/odx": {
      source: "iana"
    },
    "application/oebps-package+xml": {
      source: "iana",
      compressible: true,
      extensions: ["opf"]
    },
    "application/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["ogx"]
    },
    "application/omdoc+xml": {
      source: "apache",
      compressible: true,
      extensions: ["omdoc"]
    },
    "application/onenote": {
      source: "apache",
      extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"]
    },
    "application/opc-nodeset+xml": {
      source: "iana",
      compressible: true
    },
    "application/oscore": {
      source: "iana"
    },
    "application/oxps": {
      source: "iana",
      extensions: ["oxps"]
    },
    "application/p21": {
      source: "iana"
    },
    "application/p21+zip": {
      source: "iana",
      compressible: false
    },
    "application/p2p-overlay+xml": {
      source: "iana",
      compressible: true,
      extensions: ["relo"]
    },
    "application/parityfec": {
      source: "iana"
    },
    "application/passport": {
      source: "iana"
    },
    "application/patch-ops-error+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xer"]
    },
    "application/pdf": {
      source: "iana",
      compressible: false,
      extensions: ["pdf"]
    },
    "application/pdx": {
      source: "iana"
    },
    "application/pem-certificate-chain": {
      source: "iana"
    },
    "application/pgp-encrypted": {
      source: "iana",
      compressible: false,
      extensions: ["pgp"]
    },
    "application/pgp-keys": {
      source: "iana",
      extensions: ["asc"]
    },
    "application/pgp-signature": {
      source: "iana",
      extensions: ["asc", "sig"]
    },
    "application/pics-rules": {
      source: "apache",
      extensions: ["prf"]
    },
    "application/pidf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/pidf-diff+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/pkcs10": {
      source: "iana",
      extensions: ["p10"]
    },
    "application/pkcs12": {
      source: "iana"
    },
    "application/pkcs7-mime": {
      source: "iana",
      extensions: ["p7m", "p7c"]
    },
    "application/pkcs7-signature": {
      source: "iana",
      extensions: ["p7s"]
    },
    "application/pkcs8": {
      source: "iana",
      extensions: ["p8"]
    },
    "application/pkcs8-encrypted": {
      source: "iana"
    },
    "application/pkix-attr-cert": {
      source: "iana",
      extensions: ["ac"]
    },
    "application/pkix-cert": {
      source: "iana",
      extensions: ["cer"]
    },
    "application/pkix-crl": {
      source: "iana",
      extensions: ["crl"]
    },
    "application/pkix-pkipath": {
      source: "iana",
      extensions: ["pkipath"]
    },
    "application/pkixcmp": {
      source: "iana",
      extensions: ["pki"]
    },
    "application/pls+xml": {
      source: "iana",
      compressible: true,
      extensions: ["pls"]
    },
    "application/poc-settings+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/postscript": {
      source: "iana",
      compressible: true,
      extensions: ["ai", "eps", "ps"]
    },
    "application/ppsp-tracker+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+xml": {
      source: "iana",
      compressible: true
    },
    "application/provenance+xml": {
      source: "iana",
      compressible: true,
      extensions: ["provx"]
    },
    "application/prs.alvestrand.titrax-sheet": {
      source: "iana"
    },
    "application/prs.cww": {
      source: "iana",
      extensions: ["cww"]
    },
    "application/prs.cyn": {
      source: "iana",
      charset: "7-BIT"
    },
    "application/prs.hpub+zip": {
      source: "iana",
      compressible: false
    },
    "application/prs.nprend": {
      source: "iana"
    },
    "application/prs.plucker": {
      source: "iana"
    },
    "application/prs.rdf-xml-crypt": {
      source: "iana"
    },
    "application/prs.xsf+xml": {
      source: "iana",
      compressible: true
    },
    "application/pskc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["pskcxml"]
    },
    "application/pvd+json": {
      source: "iana",
      compressible: true
    },
    "application/qsig": {
      source: "iana"
    },
    "application/raml+yaml": {
      compressible: true,
      extensions: ["raml"]
    },
    "application/raptorfec": {
      source: "iana"
    },
    "application/rdap+json": {
      source: "iana",
      compressible: true
    },
    "application/rdf+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rdf", "owl"]
    },
    "application/reginfo+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rif"]
    },
    "application/relax-ng-compact-syntax": {
      source: "iana",
      extensions: ["rnc"]
    },
    "application/remote-printing": {
      source: "iana"
    },
    "application/reputon+json": {
      source: "iana",
      compressible: true
    },
    "application/resource-lists+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rl"]
    },
    "application/resource-lists-diff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rld"]
    },
    "application/rfc+xml": {
      source: "iana",
      compressible: true
    },
    "application/riscos": {
      source: "iana"
    },
    "application/rlmi+xml": {
      source: "iana",
      compressible: true
    },
    "application/rls-services+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rs"]
    },
    "application/route-apd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rapd"]
    },
    "application/route-s-tsid+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sls"]
    },
    "application/route-usd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rusd"]
    },
    "application/rpki-ghostbusters": {
      source: "iana",
      extensions: ["gbr"]
    },
    "application/rpki-manifest": {
      source: "iana",
      extensions: ["mft"]
    },
    "application/rpki-publication": {
      source: "iana"
    },
    "application/rpki-roa": {
      source: "iana",
      extensions: ["roa"]
    },
    "application/rpki-updown": {
      source: "iana"
    },
    "application/rsd+xml": {
      source: "apache",
      compressible: true,
      extensions: ["rsd"]
    },
    "application/rss+xml": {
      source: "apache",
      compressible: true,
      extensions: ["rss"]
    },
    "application/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "application/rtploopback": {
      source: "iana"
    },
    "application/rtx": {
      source: "iana"
    },
    "application/samlassertion+xml": {
      source: "iana",
      compressible: true
    },
    "application/samlmetadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/sarif+json": {
      source: "iana",
      compressible: true
    },
    "application/sarif-external-properties+json": {
      source: "iana",
      compressible: true
    },
    "application/sbe": {
      source: "iana"
    },
    "application/sbml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sbml"]
    },
    "application/scaip+xml": {
      source: "iana",
      compressible: true
    },
    "application/scim+json": {
      source: "iana",
      compressible: true
    },
    "application/scvp-cv-request": {
      source: "iana",
      extensions: ["scq"]
    },
    "application/scvp-cv-response": {
      source: "iana",
      extensions: ["scs"]
    },
    "application/scvp-vp-request": {
      source: "iana",
      extensions: ["spq"]
    },
    "application/scvp-vp-response": {
      source: "iana",
      extensions: ["spp"]
    },
    "application/sdp": {
      source: "iana",
      extensions: ["sdp"]
    },
    "application/secevent+jwt": {
      source: "iana"
    },
    "application/senml+cbor": {
      source: "iana"
    },
    "application/senml+json": {
      source: "iana",
      compressible: true
    },
    "application/senml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["senmlx"]
    },
    "application/senml-etch+cbor": {
      source: "iana"
    },
    "application/senml-etch+json": {
      source: "iana",
      compressible: true
    },
    "application/senml-exi": {
      source: "iana"
    },
    "application/sensml+cbor": {
      source: "iana"
    },
    "application/sensml+json": {
      source: "iana",
      compressible: true
    },
    "application/sensml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sensmlx"]
    },
    "application/sensml-exi": {
      source: "iana"
    },
    "application/sep+xml": {
      source: "iana",
      compressible: true
    },
    "application/sep-exi": {
      source: "iana"
    },
    "application/session-info": {
      source: "iana"
    },
    "application/set-payment": {
      source: "iana"
    },
    "application/set-payment-initiation": {
      source: "iana",
      extensions: ["setpay"]
    },
    "application/set-registration": {
      source: "iana"
    },
    "application/set-registration-initiation": {
      source: "iana",
      extensions: ["setreg"]
    },
    "application/sgml": {
      source: "iana"
    },
    "application/sgml-open-catalog": {
      source: "iana"
    },
    "application/shf+xml": {
      source: "iana",
      compressible: true,
      extensions: ["shf"]
    },
    "application/sieve": {
      source: "iana",
      extensions: ["siv", "sieve"]
    },
    "application/simple-filter+xml": {
      source: "iana",
      compressible: true
    },
    "application/simple-message-summary": {
      source: "iana"
    },
    "application/simplesymbolcontainer": {
      source: "iana"
    },
    "application/sipc": {
      source: "iana"
    },
    "application/slate": {
      source: "iana"
    },
    "application/smil": {
      source: "iana"
    },
    "application/smil+xml": {
      source: "iana",
      compressible: true,
      extensions: ["smi", "smil"]
    },
    "application/smpte336m": {
      source: "iana"
    },
    "application/soap+fastinfoset": {
      source: "iana"
    },
    "application/soap+xml": {
      source: "iana",
      compressible: true
    },
    "application/sparql-query": {
      source: "iana",
      extensions: ["rq"]
    },
    "application/sparql-results+xml": {
      source: "iana",
      compressible: true,
      extensions: ["srx"]
    },
    "application/spdx+json": {
      source: "iana",
      compressible: true
    },
    "application/spirits-event+xml": {
      source: "iana",
      compressible: true
    },
    "application/sql": {
      source: "iana"
    },
    "application/srgs": {
      source: "iana",
      extensions: ["gram"]
    },
    "application/srgs+xml": {
      source: "iana",
      compressible: true,
      extensions: ["grxml"]
    },
    "application/sru+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sru"]
    },
    "application/ssdl+xml": {
      source: "apache",
      compressible: true,
      extensions: ["ssdl"]
    },
    "application/ssml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ssml"]
    },
    "application/stix+json": {
      source: "iana",
      compressible: true
    },
    "application/swid+xml": {
      source: "iana",
      compressible: true,
      extensions: ["swidtag"]
    },
    "application/tamp-apex-update": {
      source: "iana"
    },
    "application/tamp-apex-update-confirm": {
      source: "iana"
    },
    "application/tamp-community-update": {
      source: "iana"
    },
    "application/tamp-community-update-confirm": {
      source: "iana"
    },
    "application/tamp-error": {
      source: "iana"
    },
    "application/tamp-sequence-adjust": {
      source: "iana"
    },
    "application/tamp-sequence-adjust-confirm": {
      source: "iana"
    },
    "application/tamp-status-query": {
      source: "iana"
    },
    "application/tamp-status-response": {
      source: "iana"
    },
    "application/tamp-update": {
      source: "iana"
    },
    "application/tamp-update-confirm": {
      source: "iana"
    },
    "application/tar": {
      compressible: true
    },
    "application/taxii+json": {
      source: "iana",
      compressible: true
    },
    "application/td+json": {
      source: "iana",
      compressible: true
    },
    "application/tei+xml": {
      source: "iana",
      compressible: true,
      extensions: ["tei", "teicorpus"]
    },
    "application/tetra_isi": {
      source: "iana"
    },
    "application/thraud+xml": {
      source: "iana",
      compressible: true,
      extensions: ["tfi"]
    },
    "application/timestamp-query": {
      source: "iana"
    },
    "application/timestamp-reply": {
      source: "iana"
    },
    "application/timestamped-data": {
      source: "iana",
      extensions: ["tsd"]
    },
    "application/tlsrpt+gzip": {
      source: "iana"
    },
    "application/tlsrpt+json": {
      source: "iana",
      compressible: true
    },
    "application/tnauthlist": {
      source: "iana"
    },
    "application/token-introspection+jwt": {
      source: "iana"
    },
    "application/toml": {
      compressible: true,
      extensions: ["toml"]
    },
    "application/trickle-ice-sdpfrag": {
      source: "iana"
    },
    "application/trig": {
      source: "iana",
      extensions: ["trig"]
    },
    "application/ttml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ttml"]
    },
    "application/tve-trigger": {
      source: "iana"
    },
    "application/tzif": {
      source: "iana"
    },
    "application/tzif-leap": {
      source: "iana"
    },
    "application/ubjson": {
      compressible: false,
      extensions: ["ubj"]
    },
    "application/ulpfec": {
      source: "iana"
    },
    "application/urc-grpsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/urc-ressheet+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rsheet"]
    },
    "application/urc-targetdesc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["td"]
    },
    "application/urc-uisocketdesc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vcard+json": {
      source: "iana",
      compressible: true
    },
    "application/vcard+xml": {
      source: "iana",
      compressible: true
    },
    "application/vemmi": {
      source: "iana"
    },
    "application/vividence.scriptfile": {
      source: "apache"
    },
    "application/vnd.1000minds.decision-model+xml": {
      source: "iana",
      compressible: true,
      extensions: ["1km"]
    },
    "application/vnd.3gpp-prose+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp-prose-pc3ch+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp-v2x-local-service-information": {
      source: "iana"
    },
    "application/vnd.3gpp.5gnas": {
      source: "iana"
    },
    "application/vnd.3gpp.access-transfer-events+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.bsf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.gmop+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.gtpc": {
      source: "iana"
    },
    "application/vnd.3gpp.interworking-data": {
      source: "iana"
    },
    "application/vnd.3gpp.lpp": {
      source: "iana"
    },
    "application/vnd.3gpp.mc-signalling-ear": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-payload": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-signalling": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-floor-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-location-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-signed+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-ue-init-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-affiliation-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-location-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-transmission-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mid-call+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.ngap": {
      source: "iana"
    },
    "application/vnd.3gpp.pfcp": {
      source: "iana"
    },
    "application/vnd.3gpp.pic-bw-large": {
      source: "iana",
      extensions: ["plb"]
    },
    "application/vnd.3gpp.pic-bw-small": {
      source: "iana",
      extensions: ["psb"]
    },
    "application/vnd.3gpp.pic-bw-var": {
      source: "iana",
      extensions: ["pvb"]
    },
    "application/vnd.3gpp.s1ap": {
      source: "iana"
    },
    "application/vnd.3gpp.sms": {
      source: "iana"
    },
    "application/vnd.3gpp.sms+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.srvcc-ext+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.srvcc-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.state-and-event-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.ussd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp2.bcmcsinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp2.sms": {
      source: "iana"
    },
    "application/vnd.3gpp2.tcap": {
      source: "iana",
      extensions: ["tcap"]
    },
    "application/vnd.3lightssoftware.imagescal": {
      source: "iana"
    },
    "application/vnd.3m.post-it-notes": {
      source: "iana",
      extensions: ["pwn"]
    },
    "application/vnd.accpac.simply.aso": {
      source: "iana",
      extensions: ["aso"]
    },
    "application/vnd.accpac.simply.imp": {
      source: "iana",
      extensions: ["imp"]
    },
    "application/vnd.acucobol": {
      source: "iana",
      extensions: ["acu"]
    },
    "application/vnd.acucorp": {
      source: "iana",
      extensions: ["atc", "acutc"]
    },
    "application/vnd.adobe.air-application-installer-package+zip": {
      source: "apache",
      compressible: false,
      extensions: ["air"]
    },
    "application/vnd.adobe.flash.movie": {
      source: "iana"
    },
    "application/vnd.adobe.formscentral.fcdt": {
      source: "iana",
      extensions: ["fcdt"]
    },
    "application/vnd.adobe.fxp": {
      source: "iana",
      extensions: ["fxp", "fxpl"]
    },
    "application/vnd.adobe.partial-upload": {
      source: "iana"
    },
    "application/vnd.adobe.xdp+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdp"]
    },
    "application/vnd.adobe.xfdf": {
      source: "iana",
      extensions: ["xfdf"]
    },
    "application/vnd.aether.imp": {
      source: "iana"
    },
    "application/vnd.afpc.afplinedata": {
      source: "iana"
    },
    "application/vnd.afpc.afplinedata-pagedef": {
      source: "iana"
    },
    "application/vnd.afpc.cmoca-cmresource": {
      source: "iana"
    },
    "application/vnd.afpc.foca-charset": {
      source: "iana"
    },
    "application/vnd.afpc.foca-codedfont": {
      source: "iana"
    },
    "application/vnd.afpc.foca-codepage": {
      source: "iana"
    },
    "application/vnd.afpc.modca": {
      source: "iana"
    },
    "application/vnd.afpc.modca-cmtable": {
      source: "iana"
    },
    "application/vnd.afpc.modca-formdef": {
      source: "iana"
    },
    "application/vnd.afpc.modca-mediummap": {
      source: "iana"
    },
    "application/vnd.afpc.modca-objectcontainer": {
      source: "iana"
    },
    "application/vnd.afpc.modca-overlay": {
      source: "iana"
    },
    "application/vnd.afpc.modca-pagesegment": {
      source: "iana"
    },
    "application/vnd.age": {
      source: "iana",
      extensions: ["age"]
    },
    "application/vnd.ah-barcode": {
      source: "iana"
    },
    "application/vnd.ahead.space": {
      source: "iana",
      extensions: ["ahead"]
    },
    "application/vnd.airzip.filesecure.azf": {
      source: "iana",
      extensions: ["azf"]
    },
    "application/vnd.airzip.filesecure.azs": {
      source: "iana",
      extensions: ["azs"]
    },
    "application/vnd.amadeus+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.amazon.ebook": {
      source: "apache",
      extensions: ["azw"]
    },
    "application/vnd.amazon.mobi8-ebook": {
      source: "iana"
    },
    "application/vnd.americandynamics.acc": {
      source: "iana",
      extensions: ["acc"]
    },
    "application/vnd.amiga.ami": {
      source: "iana",
      extensions: ["ami"]
    },
    "application/vnd.amundsen.maze+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.android.ota": {
      source: "iana"
    },
    "application/vnd.android.package-archive": {
      source: "apache",
      compressible: false,
      extensions: ["apk"]
    },
    "application/vnd.anki": {
      source: "iana"
    },
    "application/vnd.anser-web-certificate-issue-initiation": {
      source: "iana",
      extensions: ["cii"]
    },
    "application/vnd.anser-web-funds-transfer-initiation": {
      source: "apache",
      extensions: ["fti"]
    },
    "application/vnd.antix.game-component": {
      source: "iana",
      extensions: ["atx"]
    },
    "application/vnd.apache.arrow.file": {
      source: "iana"
    },
    "application/vnd.apache.arrow.stream": {
      source: "iana"
    },
    "application/vnd.apache.thrift.binary": {
      source: "iana"
    },
    "application/vnd.apache.thrift.compact": {
      source: "iana"
    },
    "application/vnd.apache.thrift.json": {
      source: "iana"
    },
    "application/vnd.api+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.aplextor.warrp+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.apothekende.reservation+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.apple.installer+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpkg"]
    },
    "application/vnd.apple.keynote": {
      source: "iana",
      extensions: ["key"]
    },
    "application/vnd.apple.mpegurl": {
      source: "iana",
      extensions: ["m3u8"]
    },
    "application/vnd.apple.numbers": {
      source: "iana",
      extensions: ["numbers"]
    },
    "application/vnd.apple.pages": {
      source: "iana",
      extensions: ["pages"]
    },
    "application/vnd.apple.pkpass": {
      compressible: false,
      extensions: ["pkpass"]
    },
    "application/vnd.arastra.swi": {
      source: "iana"
    },
    "application/vnd.aristanetworks.swi": {
      source: "iana",
      extensions: ["swi"]
    },
    "application/vnd.artisan+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.artsquare": {
      source: "iana"
    },
    "application/vnd.astraea-software.iota": {
      source: "iana",
      extensions: ["iota"]
    },
    "application/vnd.audiograph": {
      source: "iana",
      extensions: ["aep"]
    },
    "application/vnd.autopackage": {
      source: "iana"
    },
    "application/vnd.avalon+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.avistar+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.balsamiq.bmml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["bmml"]
    },
    "application/vnd.balsamiq.bmpr": {
      source: "iana"
    },
    "application/vnd.banana-accounting": {
      source: "iana"
    },
    "application/vnd.bbf.usp.error": {
      source: "iana"
    },
    "application/vnd.bbf.usp.msg": {
      source: "iana"
    },
    "application/vnd.bbf.usp.msg+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.bekitzur-stech+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.bint.med-content": {
      source: "iana"
    },
    "application/vnd.biopax.rdf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.blink-idb-value-wrapper": {
      source: "iana"
    },
    "application/vnd.blueice.multipass": {
      source: "iana",
      extensions: ["mpm"]
    },
    "application/vnd.bluetooth.ep.oob": {
      source: "iana"
    },
    "application/vnd.bluetooth.le.oob": {
      source: "iana"
    },
    "application/vnd.bmi": {
      source: "iana",
      extensions: ["bmi"]
    },
    "application/vnd.bpf": {
      source: "iana"
    },
    "application/vnd.bpf3": {
      source: "iana"
    },
    "application/vnd.businessobjects": {
      source: "iana",
      extensions: ["rep"]
    },
    "application/vnd.byu.uapi+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cab-jscript": {
      source: "iana"
    },
    "application/vnd.canon-cpdl": {
      source: "iana"
    },
    "application/vnd.canon-lips": {
      source: "iana"
    },
    "application/vnd.capasystems-pg+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cendio.thinlinc.clientconf": {
      source: "iana"
    },
    "application/vnd.century-systems.tcp_stream": {
      source: "iana"
    },
    "application/vnd.chemdraw+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cdxml"]
    },
    "application/vnd.chess-pgn": {
      source: "iana"
    },
    "application/vnd.chipnuts.karaoke-mmd": {
      source: "iana",
      extensions: ["mmd"]
    },
    "application/vnd.ciedi": {
      source: "iana"
    },
    "application/vnd.cinderella": {
      source: "iana",
      extensions: ["cdy"]
    },
    "application/vnd.cirpack.isdn-ext": {
      source: "iana"
    },
    "application/vnd.citationstyles.style+xml": {
      source: "iana",
      compressible: true,
      extensions: ["csl"]
    },
    "application/vnd.claymore": {
      source: "iana",
      extensions: ["cla"]
    },
    "application/vnd.cloanto.rp9": {
      source: "iana",
      extensions: ["rp9"]
    },
    "application/vnd.clonk.c4group": {
      source: "iana",
      extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"]
    },
    "application/vnd.cluetrust.cartomobile-config": {
      source: "iana",
      extensions: ["c11amc"]
    },
    "application/vnd.cluetrust.cartomobile-config-pkg": {
      source: "iana",
      extensions: ["c11amz"]
    },
    "application/vnd.coffeescript": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.document": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.document-template": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.presentation": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.presentation-template": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.spreadsheet": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.spreadsheet-template": {
      source: "iana"
    },
    "application/vnd.collection+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.doc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.next+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.comicbook+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.comicbook-rar": {
      source: "iana"
    },
    "application/vnd.commerce-battelle": {
      source: "iana"
    },
    "application/vnd.commonspace": {
      source: "iana",
      extensions: ["csp"]
    },
    "application/vnd.contact.cmsg": {
      source: "iana",
      extensions: ["cdbcmsg"]
    },
    "application/vnd.coreos.ignition+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cosmocaller": {
      source: "iana",
      extensions: ["cmc"]
    },
    "application/vnd.crick.clicker": {
      source: "iana",
      extensions: ["clkx"]
    },
    "application/vnd.crick.clicker.keyboard": {
      source: "iana",
      extensions: ["clkk"]
    },
    "application/vnd.crick.clicker.palette": {
      source: "iana",
      extensions: ["clkp"]
    },
    "application/vnd.crick.clicker.template": {
      source: "iana",
      extensions: ["clkt"]
    },
    "application/vnd.crick.clicker.wordbank": {
      source: "iana",
      extensions: ["clkw"]
    },
    "application/vnd.criticaltools.wbs+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wbs"]
    },
    "application/vnd.cryptii.pipe+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.crypto-shade-file": {
      source: "iana"
    },
    "application/vnd.cryptomator.encrypted": {
      source: "iana"
    },
    "application/vnd.cryptomator.vault": {
      source: "iana"
    },
    "application/vnd.ctc-posml": {
      source: "iana",
      extensions: ["pml"]
    },
    "application/vnd.ctct.ws+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cups-pdf": {
      source: "iana"
    },
    "application/vnd.cups-postscript": {
      source: "iana"
    },
    "application/vnd.cups-ppd": {
      source: "iana",
      extensions: ["ppd"]
    },
    "application/vnd.cups-raster": {
      source: "iana"
    },
    "application/vnd.cups-raw": {
      source: "iana"
    },
    "application/vnd.curl": {
      source: "iana"
    },
    "application/vnd.curl.car": {
      source: "apache",
      extensions: ["car"]
    },
    "application/vnd.curl.pcurl": {
      source: "apache",
      extensions: ["pcurl"]
    },
    "application/vnd.cyan.dean.root+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cybank": {
      source: "iana"
    },
    "application/vnd.cyclonedx+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cyclonedx+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.d2l.coursepackage1p0+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.d3m-dataset": {
      source: "iana"
    },
    "application/vnd.d3m-problem": {
      source: "iana"
    },
    "application/vnd.dart": {
      source: "iana",
      compressible: true,
      extensions: ["dart"]
    },
    "application/vnd.data-vision.rdz": {
      source: "iana",
      extensions: ["rdz"]
    },
    "application/vnd.datapackage+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dataresource+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dbf": {
      source: "iana",
      extensions: ["dbf"]
    },
    "application/vnd.debian.binary-package": {
      source: "iana"
    },
    "application/vnd.dece.data": {
      source: "iana",
      extensions: ["uvf", "uvvf", "uvd", "uvvd"]
    },
    "application/vnd.dece.ttml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["uvt", "uvvt"]
    },
    "application/vnd.dece.unspecified": {
      source: "iana",
      extensions: ["uvx", "uvvx"]
    },
    "application/vnd.dece.zip": {
      source: "iana",
      extensions: ["uvz", "uvvz"]
    },
    "application/vnd.denovo.fcselayout-link": {
      source: "iana",
      extensions: ["fe_launch"]
    },
    "application/vnd.desmume.movie": {
      source: "iana"
    },
    "application/vnd.dir-bi.plate-dl-nosuffix": {
      source: "iana"
    },
    "application/vnd.dm.delegation+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dna": {
      source: "iana",
      extensions: ["dna"]
    },
    "application/vnd.document+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dolby.mlp": {
      source: "apache",
      extensions: ["mlp"]
    },
    "application/vnd.dolby.mobile.1": {
      source: "iana"
    },
    "application/vnd.dolby.mobile.2": {
      source: "iana"
    },
    "application/vnd.doremir.scorecloud-binary-document": {
      source: "iana"
    },
    "application/vnd.dpgraph": {
      source: "iana",
      extensions: ["dpg"]
    },
    "application/vnd.dreamfactory": {
      source: "iana",
      extensions: ["dfac"]
    },
    "application/vnd.drive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ds-keypoint": {
      source: "apache",
      extensions: ["kpxx"]
    },
    "application/vnd.dtg.local": {
      source: "iana"
    },
    "application/vnd.dtg.local.flash": {
      source: "iana"
    },
    "application/vnd.dtg.local.html": {
      source: "iana"
    },
    "application/vnd.dvb.ait": {
      source: "iana",
      extensions: ["ait"]
    },
    "application/vnd.dvb.dvbisl+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.dvbj": {
      source: "iana"
    },
    "application/vnd.dvb.esgcontainer": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcdftnotifaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess2": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgpdd": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcroaming": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-base": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-enhancement": {
      source: "iana"
    },
    "application/vnd.dvb.notif-aggregate-root+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-container+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-generic+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-msglist+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-registration-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-registration-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-init+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.pfr": {
      source: "iana"
    },
    "application/vnd.dvb.service": {
      source: "iana",
      extensions: ["svc"]
    },
    "application/vnd.dxr": {
      source: "iana"
    },
    "application/vnd.dynageo": {
      source: "iana",
      extensions: ["geo"]
    },
    "application/vnd.dzr": {
      source: "iana"
    },
    "application/vnd.easykaraoke.cdgdownload": {
      source: "iana"
    },
    "application/vnd.ecdis-update": {
      source: "iana"
    },
    "application/vnd.ecip.rlp": {
      source: "iana"
    },
    "application/vnd.eclipse.ditto+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ecowin.chart": {
      source: "iana",
      extensions: ["mag"]
    },
    "application/vnd.ecowin.filerequest": {
      source: "iana"
    },
    "application/vnd.ecowin.fileupdate": {
      source: "iana"
    },
    "application/vnd.ecowin.series": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesrequest": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesupdate": {
      source: "iana"
    },
    "application/vnd.efi.img": {
      source: "iana"
    },
    "application/vnd.efi.iso": {
      source: "iana"
    },
    "application/vnd.emclient.accessrequest+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.enliven": {
      source: "iana",
      extensions: ["nml"]
    },
    "application/vnd.enphase.envoy": {
      source: "iana"
    },
    "application/vnd.eprints.data+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.epson.esf": {
      source: "iana",
      extensions: ["esf"]
    },
    "application/vnd.epson.msf": {
      source: "iana",
      extensions: ["msf"]
    },
    "application/vnd.epson.quickanime": {
      source: "iana",
      extensions: ["qam"]
    },
    "application/vnd.epson.salt": {
      source: "iana",
      extensions: ["slt"]
    },
    "application/vnd.epson.ssf": {
      source: "iana",
      extensions: ["ssf"]
    },
    "application/vnd.ericsson.quickcall": {
      source: "iana"
    },
    "application/vnd.espass-espass+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.eszigno3+xml": {
      source: "iana",
      compressible: true,
      extensions: ["es3", "et3"]
    },
    "application/vnd.etsi.aoc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.asic-e+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.etsi.asic-s+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.etsi.cug+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvcommand+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvdiscovery+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-bc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-cod+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-npvr+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvservice+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsync+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvueprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.mcid+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.mheg5": {
      source: "iana"
    },
    "application/vnd.etsi.overload-control-policy-dataset+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.pstn+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.sci+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.simservs+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.timestamp-token": {
      source: "iana"
    },
    "application/vnd.etsi.tsl+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.tsl.der": {
      source: "iana"
    },
    "application/vnd.eu.kasparian.car+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.eudora.data": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.profile": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.settings": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.theme": {
      source: "iana"
    },
    "application/vnd.exstream-empower+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.exstream-package": {
      source: "iana"
    },
    "application/vnd.ezpix-album": {
      source: "iana",
      extensions: ["ez2"]
    },
    "application/vnd.ezpix-package": {
      source: "iana",
      extensions: ["ez3"]
    },
    "application/vnd.f-secure.mobile": {
      source: "iana"
    },
    "application/vnd.familysearch.gedcom+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.fastcopy-disk-image": {
      source: "iana"
    },
    "application/vnd.fdf": {
      source: "iana",
      extensions: ["fdf"]
    },
    "application/vnd.fdsn.mseed": {
      source: "iana",
      extensions: ["mseed"]
    },
    "application/vnd.fdsn.seed": {
      source: "iana",
      extensions: ["seed", "dataless"]
    },
    "application/vnd.ffsns": {
      source: "iana"
    },
    "application/vnd.ficlab.flb+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.filmit.zfc": {
      source: "iana"
    },
    "application/vnd.fints": {
      source: "iana"
    },
    "application/vnd.firemonkeys.cloudcell": {
      source: "iana"
    },
    "application/vnd.flographit": {
      source: "iana",
      extensions: ["gph"]
    },
    "application/vnd.fluxtime.clip": {
      source: "iana",
      extensions: ["ftc"]
    },
    "application/vnd.font-fontforge-sfd": {
      source: "iana"
    },
    "application/vnd.framemaker": {
      source: "iana",
      extensions: ["fm", "frame", "maker", "book"]
    },
    "application/vnd.frogans.fnc": {
      source: "iana",
      extensions: ["fnc"]
    },
    "application/vnd.frogans.ltf": {
      source: "iana",
      extensions: ["ltf"]
    },
    "application/vnd.fsc.weblaunch": {
      source: "iana",
      extensions: ["fsc"]
    },
    "application/vnd.fujifilm.fb.docuworks": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.docuworks.binder": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.docuworks.container": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.jfi+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.fujitsu.oasys": {
      source: "iana",
      extensions: ["oas"]
    },
    "application/vnd.fujitsu.oasys2": {
      source: "iana",
      extensions: ["oa2"]
    },
    "application/vnd.fujitsu.oasys3": {
      source: "iana",
      extensions: ["oa3"]
    },
    "application/vnd.fujitsu.oasysgp": {
      source: "iana",
      extensions: ["fg5"]
    },
    "application/vnd.fujitsu.oasysprs": {
      source: "iana",
      extensions: ["bh2"]
    },
    "application/vnd.fujixerox.art-ex": {
      source: "iana"
    },
    "application/vnd.fujixerox.art4": {
      source: "iana"
    },
    "application/vnd.fujixerox.ddd": {
      source: "iana",
      extensions: ["ddd"]
    },
    "application/vnd.fujixerox.docuworks": {
      source: "iana",
      extensions: ["xdw"]
    },
    "application/vnd.fujixerox.docuworks.binder": {
      source: "iana",
      extensions: ["xbd"]
    },
    "application/vnd.fujixerox.docuworks.container": {
      source: "iana"
    },
    "application/vnd.fujixerox.hbpl": {
      source: "iana"
    },
    "application/vnd.fut-misnet": {
      source: "iana"
    },
    "application/vnd.futoin+cbor": {
      source: "iana"
    },
    "application/vnd.futoin+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.fuzzysheet": {
      source: "iana",
      extensions: ["fzs"]
    },
    "application/vnd.genomatix.tuxedo": {
      source: "iana",
      extensions: ["txd"]
    },
    "application/vnd.gentics.grd+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geo+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geocube+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geogebra.file": {
      source: "iana",
      extensions: ["ggb"]
    },
    "application/vnd.geogebra.slides": {
      source: "iana"
    },
    "application/vnd.geogebra.tool": {
      source: "iana",
      extensions: ["ggt"]
    },
    "application/vnd.geometry-explorer": {
      source: "iana",
      extensions: ["gex", "gre"]
    },
    "application/vnd.geonext": {
      source: "iana",
      extensions: ["gxt"]
    },
    "application/vnd.geoplan": {
      source: "iana",
      extensions: ["g2w"]
    },
    "application/vnd.geospace": {
      source: "iana",
      extensions: ["g3w"]
    },
    "application/vnd.gerber": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt-response": {
      source: "iana"
    },
    "application/vnd.gmx": {
      source: "iana",
      extensions: ["gmx"]
    },
    "application/vnd.google-apps.document": {
      compressible: false,
      extensions: ["gdoc"]
    },
    "application/vnd.google-apps.presentation": {
      compressible: false,
      extensions: ["gslides"]
    },
    "application/vnd.google-apps.spreadsheet": {
      compressible: false,
      extensions: ["gsheet"]
    },
    "application/vnd.google-earth.kml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["kml"]
    },
    "application/vnd.google-earth.kmz": {
      source: "iana",
      compressible: false,
      extensions: ["kmz"]
    },
    "application/vnd.gov.sk.e-form+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.gov.sk.e-form+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.gov.sk.xmldatacontainer+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.grafeq": {
      source: "iana",
      extensions: ["gqf", "gqs"]
    },
    "application/vnd.gridmp": {
      source: "iana"
    },
    "application/vnd.groove-account": {
      source: "iana",
      extensions: ["gac"]
    },
    "application/vnd.groove-help": {
      source: "iana",
      extensions: ["ghf"]
    },
    "application/vnd.groove-identity-message": {
      source: "iana",
      extensions: ["gim"]
    },
    "application/vnd.groove-injector": {
      source: "iana",
      extensions: ["grv"]
    },
    "application/vnd.groove-tool-message": {
      source: "iana",
      extensions: ["gtm"]
    },
    "application/vnd.groove-tool-template": {
      source: "iana",
      extensions: ["tpl"]
    },
    "application/vnd.groove-vcard": {
      source: "iana",
      extensions: ["vcg"]
    },
    "application/vnd.hal+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hal+xml": {
      source: "iana",
      compressible: true,
      extensions: ["hal"]
    },
    "application/vnd.handheld-entertainment+xml": {
      source: "iana",
      compressible: true,
      extensions: ["zmm"]
    },
    "application/vnd.hbci": {
      source: "iana",
      extensions: ["hbci"]
    },
    "application/vnd.hc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hcl-bireports": {
      source: "iana"
    },
    "application/vnd.hdt": {
      source: "iana"
    },
    "application/vnd.heroku+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hhe.lesson-player": {
      source: "iana",
      extensions: ["les"]
    },
    "application/vnd.hl7cda+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.hl7v2+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.hp-hpgl": {
      source: "iana",
      extensions: ["hpgl"]
    },
    "application/vnd.hp-hpid": {
      source: "iana",
      extensions: ["hpid"]
    },
    "application/vnd.hp-hps": {
      source: "iana",
      extensions: ["hps"]
    },
    "application/vnd.hp-jlyt": {
      source: "iana",
      extensions: ["jlt"]
    },
    "application/vnd.hp-pcl": {
      source: "iana",
      extensions: ["pcl"]
    },
    "application/vnd.hp-pclxl": {
      source: "iana",
      extensions: ["pclxl"]
    },
    "application/vnd.httphone": {
      source: "iana"
    },
    "application/vnd.hydrostatix.sof-data": {
      source: "iana",
      extensions: ["sfd-hdstx"]
    },
    "application/vnd.hyper+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hyper-item+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hyperdrive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hzn-3d-crossword": {
      source: "iana"
    },
    "application/vnd.ibm.afplinedata": {
      source: "iana"
    },
    "application/vnd.ibm.electronic-media": {
      source: "iana"
    },
    "application/vnd.ibm.minipay": {
      source: "iana",
      extensions: ["mpy"]
    },
    "application/vnd.ibm.modcap": {
      source: "iana",
      extensions: ["afp", "listafp", "list3820"]
    },
    "application/vnd.ibm.rights-management": {
      source: "iana",
      extensions: ["irm"]
    },
    "application/vnd.ibm.secure-container": {
      source: "iana",
      extensions: ["sc"]
    },
    "application/vnd.iccprofile": {
      source: "iana",
      extensions: ["icc", "icm"]
    },
    "application/vnd.ieee.1905": {
      source: "iana"
    },
    "application/vnd.igloader": {
      source: "iana",
      extensions: ["igl"]
    },
    "application/vnd.imagemeter.folder+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.imagemeter.image+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.immervision-ivp": {
      source: "iana",
      extensions: ["ivp"]
    },
    "application/vnd.immervision-ivu": {
      source: "iana",
      extensions: ["ivu"]
    },
    "application/vnd.ims.imsccv1p1": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p2": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p3": {
      source: "iana"
    },
    "application/vnd.ims.lis.v2.result+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy.id+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings.simple+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.informedcontrol.rms+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.informix-visionary": {
      source: "iana"
    },
    "application/vnd.infotech.project": {
      source: "iana"
    },
    "application/vnd.infotech.project+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.innopath.wamp.notification": {
      source: "iana"
    },
    "application/vnd.insors.igm": {
      source: "iana",
      extensions: ["igm"]
    },
    "application/vnd.intercon.formnet": {
      source: "iana",
      extensions: ["xpw", "xpx"]
    },
    "application/vnd.intergeo": {
      source: "iana",
      extensions: ["i2g"]
    },
    "application/vnd.intertrust.digibox": {
      source: "iana"
    },
    "application/vnd.intertrust.nncp": {
      source: "iana"
    },
    "application/vnd.intu.qbo": {
      source: "iana",
      extensions: ["qbo"]
    },
    "application/vnd.intu.qfx": {
      source: "iana",
      extensions: ["qfx"]
    },
    "application/vnd.iptc.g2.catalogitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.conceptitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.knowledgeitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.newsitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.newsmessage+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.packageitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.planningitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ipunplugged.rcprofile": {
      source: "iana",
      extensions: ["rcprofile"]
    },
    "application/vnd.irepository.package+xml": {
      source: "iana",
      compressible: true,
      extensions: ["irp"]
    },
    "application/vnd.is-xpr": {
      source: "iana",
      extensions: ["xpr"]
    },
    "application/vnd.isac.fcs": {
      source: "iana",
      extensions: ["fcs"]
    },
    "application/vnd.iso11783-10+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.jam": {
      source: "iana",
      extensions: ["jam"]
    },
    "application/vnd.japannet-directory-service": {
      source: "iana"
    },
    "application/vnd.japannet-jpnstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-payment-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-registration": {
      source: "iana"
    },
    "application/vnd.japannet-registration-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-setstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-verification": {
      source: "iana"
    },
    "application/vnd.japannet-verification-wakeup": {
      source: "iana"
    },
    "application/vnd.jcp.javame.midlet-rms": {
      source: "iana",
      extensions: ["rms"]
    },
    "application/vnd.jisp": {
      source: "iana",
      extensions: ["jisp"]
    },
    "application/vnd.joost.joda-archive": {
      source: "iana",
      extensions: ["joda"]
    },
    "application/vnd.jsk.isdn-ngn": {
      source: "iana"
    },
    "application/vnd.kahootz": {
      source: "iana",
      extensions: ["ktz", "ktr"]
    },
    "application/vnd.kde.karbon": {
      source: "iana",
      extensions: ["karbon"]
    },
    "application/vnd.kde.kchart": {
      source: "iana",
      extensions: ["chrt"]
    },
    "application/vnd.kde.kformula": {
      source: "iana",
      extensions: ["kfo"]
    },
    "application/vnd.kde.kivio": {
      source: "iana",
      extensions: ["flw"]
    },
    "application/vnd.kde.kontour": {
      source: "iana",
      extensions: ["kon"]
    },
    "application/vnd.kde.kpresenter": {
      source: "iana",
      extensions: ["kpr", "kpt"]
    },
    "application/vnd.kde.kspread": {
      source: "iana",
      extensions: ["ksp"]
    },
    "application/vnd.kde.kword": {
      source: "iana",
      extensions: ["kwd", "kwt"]
    },
    "application/vnd.kenameaapp": {
      source: "iana",
      extensions: ["htke"]
    },
    "application/vnd.kidspiration": {
      source: "iana",
      extensions: ["kia"]
    },
    "application/vnd.kinar": {
      source: "iana",
      extensions: ["kne", "knp"]
    },
    "application/vnd.koan": {
      source: "iana",
      extensions: ["skp", "skd", "skt", "skm"]
    },
    "application/vnd.kodak-descriptor": {
      source: "iana",
      extensions: ["sse"]
    },
    "application/vnd.las": {
      source: "iana"
    },
    "application/vnd.las.las+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.las.las+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lasxml"]
    },
    "application/vnd.laszip": {
      source: "iana"
    },
    "application/vnd.leap+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.liberty-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.llamagraphics.life-balance.desktop": {
      source: "iana",
      extensions: ["lbd"]
    },
    "application/vnd.llamagraphics.life-balance.exchange+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lbe"]
    },
    "application/vnd.logipipe.circuit+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.loom": {
      source: "iana"
    },
    "application/vnd.lotus-1-2-3": {
      source: "iana",
      extensions: ["123"]
    },
    "application/vnd.lotus-approach": {
      source: "iana",
      extensions: ["apr"]
    },
    "application/vnd.lotus-freelance": {
      source: "iana",
      extensions: ["pre"]
    },
    "application/vnd.lotus-notes": {
      source: "iana",
      extensions: ["nsf"]
    },
    "application/vnd.lotus-organizer": {
      source: "iana",
      extensions: ["org"]
    },
    "application/vnd.lotus-screencam": {
      source: "iana",
      extensions: ["scm"]
    },
    "application/vnd.lotus-wordpro": {
      source: "iana",
      extensions: ["lwp"]
    },
    "application/vnd.macports.portpkg": {
      source: "iana",
      extensions: ["portpkg"]
    },
    "application/vnd.mapbox-vector-tile": {
      source: "iana",
      extensions: ["mvt"]
    },
    "application/vnd.marlin.drm.actiontoken+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.conftoken+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.license+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.mdcf": {
      source: "iana"
    },
    "application/vnd.mason+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.maxar.archive.3tz+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.maxmind.maxmind-db": {
      source: "iana"
    },
    "application/vnd.mcd": {
      source: "iana",
      extensions: ["mcd"]
    },
    "application/vnd.medcalcdata": {
      source: "iana",
      extensions: ["mc1"]
    },
    "application/vnd.mediastation.cdkey": {
      source: "iana",
      extensions: ["cdkey"]
    },
    "application/vnd.meridian-slingshot": {
      source: "iana"
    },
    "application/vnd.mfer": {
      source: "iana",
      extensions: ["mwf"]
    },
    "application/vnd.mfmp": {
      source: "iana",
      extensions: ["mfm"]
    },
    "application/vnd.micro+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.micrografx.flo": {
      source: "iana",
      extensions: ["flo"]
    },
    "application/vnd.micrografx.igx": {
      source: "iana",
      extensions: ["igx"]
    },
    "application/vnd.microsoft.portable-executable": {
      source: "iana"
    },
    "application/vnd.microsoft.windows.thumbnail-cache": {
      source: "iana"
    },
    "application/vnd.miele+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.mif": {
      source: "iana",
      extensions: ["mif"]
    },
    "application/vnd.minisoft-hp3000-save": {
      source: "iana"
    },
    "application/vnd.mitsubishi.misty-guard.trustweb": {
      source: "iana"
    },
    "application/vnd.mobius.daf": {
      source: "iana",
      extensions: ["daf"]
    },
    "application/vnd.mobius.dis": {
      source: "iana",
      extensions: ["dis"]
    },
    "application/vnd.mobius.mbk": {
      source: "iana",
      extensions: ["mbk"]
    },
    "application/vnd.mobius.mqy": {
      source: "iana",
      extensions: ["mqy"]
    },
    "application/vnd.mobius.msl": {
      source: "iana",
      extensions: ["msl"]
    },
    "application/vnd.mobius.plc": {
      source: "iana",
      extensions: ["plc"]
    },
    "application/vnd.mobius.txf": {
      source: "iana",
      extensions: ["txf"]
    },
    "application/vnd.mophun.application": {
      source: "iana",
      extensions: ["mpn"]
    },
    "application/vnd.mophun.certificate": {
      source: "iana",
      extensions: ["mpc"]
    },
    "application/vnd.motorola.flexsuite": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.adsi": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.fis": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.gotap": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.kmr": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.ttc": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.wem": {
      source: "iana"
    },
    "application/vnd.motorola.iprm": {
      source: "iana"
    },
    "application/vnd.mozilla.xul+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xul"]
    },
    "application/vnd.ms-3mfdocument": {
      source: "iana"
    },
    "application/vnd.ms-artgalry": {
      source: "iana",
      extensions: ["cil"]
    },
    "application/vnd.ms-asf": {
      source: "iana"
    },
    "application/vnd.ms-cab-compressed": {
      source: "iana",
      extensions: ["cab"]
    },
    "application/vnd.ms-color.iccprofile": {
      source: "apache"
    },
    "application/vnd.ms-excel": {
      source: "iana",
      compressible: false,
      extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"]
    },
    "application/vnd.ms-excel.addin.macroenabled.12": {
      source: "iana",
      extensions: ["xlam"]
    },
    "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
      source: "iana",
      extensions: ["xlsb"]
    },
    "application/vnd.ms-excel.sheet.macroenabled.12": {
      source: "iana",
      extensions: ["xlsm"]
    },
    "application/vnd.ms-excel.template.macroenabled.12": {
      source: "iana",
      extensions: ["xltm"]
    },
    "application/vnd.ms-fontobject": {
      source: "iana",
      compressible: true,
      extensions: ["eot"]
    },
    "application/vnd.ms-htmlhelp": {
      source: "iana",
      extensions: ["chm"]
    },
    "application/vnd.ms-ims": {
      source: "iana",
      extensions: ["ims"]
    },
    "application/vnd.ms-lrm": {
      source: "iana",
      extensions: ["lrm"]
    },
    "application/vnd.ms-office.activex+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-officetheme": {
      source: "iana",
      extensions: ["thmx"]
    },
    "application/vnd.ms-opentype": {
      source: "apache",
      compressible: true
    },
    "application/vnd.ms-outlook": {
      compressible: false,
      extensions: ["msg"]
    },
    "application/vnd.ms-package.obfuscated-opentype": {
      source: "apache"
    },
    "application/vnd.ms-pki.seccat": {
      source: "apache",
      extensions: ["cat"]
    },
    "application/vnd.ms-pki.stl": {
      source: "apache",
      extensions: ["stl"]
    },
    "application/vnd.ms-playready.initiator+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-powerpoint": {
      source: "iana",
      compressible: false,
      extensions: ["ppt", "pps", "pot"]
    },
    "application/vnd.ms-powerpoint.addin.macroenabled.12": {
      source: "iana",
      extensions: ["ppam"]
    },
    "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
      source: "iana",
      extensions: ["pptm"]
    },
    "application/vnd.ms-powerpoint.slide.macroenabled.12": {
      source: "iana",
      extensions: ["sldm"]
    },
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
      source: "iana",
      extensions: ["ppsm"]
    },
    "application/vnd.ms-powerpoint.template.macroenabled.12": {
      source: "iana",
      extensions: ["potm"]
    },
    "application/vnd.ms-printdevicecapabilities+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-printing.printticket+xml": {
      source: "apache",
      compressible: true
    },
    "application/vnd.ms-printschematicket+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-project": {
      source: "iana",
      extensions: ["mpp", "mpt"]
    },
    "application/vnd.ms-tnef": {
      source: "iana"
    },
    "application/vnd.ms-windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.nwprinting.oob": {
      source: "iana"
    },
    "application/vnd.ms-windows.printerpairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.wsd.oob": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-resp": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-resp": {
      source: "iana"
    },
    "application/vnd.ms-word.document.macroenabled.12": {
      source: "iana",
      extensions: ["docm"]
    },
    "application/vnd.ms-word.template.macroenabled.12": {
      source: "iana",
      extensions: ["dotm"]
    },
    "application/vnd.ms-works": {
      source: "iana",
      extensions: ["wps", "wks", "wcm", "wdb"]
    },
    "application/vnd.ms-wpl": {
      source: "iana",
      extensions: ["wpl"]
    },
    "application/vnd.ms-xpsdocument": {
      source: "iana",
      compressible: false,
      extensions: ["xps"]
    },
    "application/vnd.msa-disk-image": {
      source: "iana"
    },
    "application/vnd.mseq": {
      source: "iana",
      extensions: ["mseq"]
    },
    "application/vnd.msign": {
      source: "iana"
    },
    "application/vnd.multiad.creator": {
      source: "iana"
    },
    "application/vnd.multiad.creator.cif": {
      source: "iana"
    },
    "application/vnd.music-niff": {
      source: "iana"
    },
    "application/vnd.musician": {
      source: "iana",
      extensions: ["mus"]
    },
    "application/vnd.muvee.style": {
      source: "iana",
      extensions: ["msty"]
    },
    "application/vnd.mynfc": {
      source: "iana",
      extensions: ["taglet"]
    },
    "application/vnd.nacamar.ybrid+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ncd.control": {
      source: "iana"
    },
    "application/vnd.ncd.reference": {
      source: "iana"
    },
    "application/vnd.nearst.inv+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nebumind.line": {
      source: "iana"
    },
    "application/vnd.nervana": {
      source: "iana"
    },
    "application/vnd.netfpx": {
      source: "iana"
    },
    "application/vnd.neurolanguage.nlu": {
      source: "iana",
      extensions: ["nlu"]
    },
    "application/vnd.nimn": {
      source: "iana"
    },
    "application/vnd.nintendo.nitro.rom": {
      source: "iana"
    },
    "application/vnd.nintendo.snes.rom": {
      source: "iana"
    },
    "application/vnd.nitf": {
      source: "iana",
      extensions: ["ntf", "nitf"]
    },
    "application/vnd.noblenet-directory": {
      source: "iana",
      extensions: ["nnd"]
    },
    "application/vnd.noblenet-sealer": {
      source: "iana",
      extensions: ["nns"]
    },
    "application/vnd.noblenet-web": {
      source: "iana",
      extensions: ["nnw"]
    },
    "application/vnd.nokia.catalogs": {
      source: "iana"
    },
    "application/vnd.nokia.conml+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.conml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.iptv.config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.isds-radio-presets": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.landmarkcollection+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.n-gage.ac+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ac"]
    },
    "application/vnd.nokia.n-gage.data": {
      source: "iana",
      extensions: ["ngdat"]
    },
    "application/vnd.nokia.n-gage.symbian.install": {
      source: "iana",
      extensions: ["n-gage"]
    },
    "application/vnd.nokia.ncd": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.radio-preset": {
      source: "iana",
      extensions: ["rpst"]
    },
    "application/vnd.nokia.radio-presets": {
      source: "iana",
      extensions: ["rpss"]
    },
    "application/vnd.novadigm.edm": {
      source: "iana",
      extensions: ["edm"]
    },
    "application/vnd.novadigm.edx": {
      source: "iana",
      extensions: ["edx"]
    },
    "application/vnd.novadigm.ext": {
      source: "iana",
      extensions: ["ext"]
    },
    "application/vnd.ntt-local.content-share": {
      source: "iana"
    },
    "application/vnd.ntt-local.file-transfer": {
      source: "iana"
    },
    "application/vnd.ntt-local.ogw_remote-access": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_remote": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_tcp_stream": {
      source: "iana"
    },
    "application/vnd.oasis.opendocument.chart": {
      source: "iana",
      extensions: ["odc"]
    },
    "application/vnd.oasis.opendocument.chart-template": {
      source: "iana",
      extensions: ["otc"]
    },
    "application/vnd.oasis.opendocument.database": {
      source: "iana",
      extensions: ["odb"]
    },
    "application/vnd.oasis.opendocument.formula": {
      source: "iana",
      extensions: ["odf"]
    },
    "application/vnd.oasis.opendocument.formula-template": {
      source: "iana",
      extensions: ["odft"]
    },
    "application/vnd.oasis.opendocument.graphics": {
      source: "iana",
      compressible: false,
      extensions: ["odg"]
    },
    "application/vnd.oasis.opendocument.graphics-template": {
      source: "iana",
      extensions: ["otg"]
    },
    "application/vnd.oasis.opendocument.image": {
      source: "iana",
      extensions: ["odi"]
    },
    "application/vnd.oasis.opendocument.image-template": {
      source: "iana",
      extensions: ["oti"]
    },
    "application/vnd.oasis.opendocument.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["odp"]
    },
    "application/vnd.oasis.opendocument.presentation-template": {
      source: "iana",
      extensions: ["otp"]
    },
    "application/vnd.oasis.opendocument.spreadsheet": {
      source: "iana",
      compressible: false,
      extensions: ["ods"]
    },
    "application/vnd.oasis.opendocument.spreadsheet-template": {
      source: "iana",
      extensions: ["ots"]
    },
    "application/vnd.oasis.opendocument.text": {
      source: "iana",
      compressible: false,
      extensions: ["odt"]
    },
    "application/vnd.oasis.opendocument.text-master": {
      source: "iana",
      extensions: ["odm"]
    },
    "application/vnd.oasis.opendocument.text-template": {
      source: "iana",
      extensions: ["ott"]
    },
    "application/vnd.oasis.opendocument.text-web": {
      source: "iana",
      extensions: ["oth"]
    },
    "application/vnd.obn": {
      source: "iana"
    },
    "application/vnd.ocf+cbor": {
      source: "iana"
    },
    "application/vnd.oci.image.manifest.v1+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oftn.l10n+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.contentaccessdownload+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.contentaccessstreaming+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.cspg-hexbinary": {
      source: "iana"
    },
    "application/vnd.oipf.dae.svg+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.dae.xhtml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.mippvcontrolmessage+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.pae.gem": {
      source: "iana"
    },
    "application/vnd.oipf.spdiscovery+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.spdlist+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.ueprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.userprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.olpc-sugar": {
      source: "iana",
      extensions: ["xo"]
    },
    "application/vnd.oma-scws-config": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-request": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-response": {
      source: "iana"
    },
    "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.drm-trigger+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.imd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.ltkm": {
      source: "iana"
    },
    "application/vnd.oma.bcast.notification+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.provisioningtrigger": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgboot": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgdd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.sgdu": {
      source: "iana"
    },
    "application/vnd.oma.bcast.simple-symbol-container": {
      source: "iana"
    },
    "application/vnd.oma.bcast.smartcard-trigger+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.sprov+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.stkm": {
      source: "iana"
    },
    "application/vnd.oma.cab-address-book+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-feature-handler+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-pcc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-subs-invite+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-user-prefs+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.dcd": {
      source: "iana"
    },
    "application/vnd.oma.dcdc": {
      source: "iana"
    },
    "application/vnd.oma.dd2+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dd2"]
    },
    "application/vnd.oma.drm.risd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.group-usage-list+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.lwm2m+cbor": {
      source: "iana"
    },
    "application/vnd.oma.lwm2m+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.lwm2m+tlv": {
      source: "iana"
    },
    "application/vnd.oma.pal+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.detailed-progress-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.final-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.groups+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.invocation-descriptor+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.optimized-progress-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.push": {
      source: "iana"
    },
    "application/vnd.oma.scidm.messages+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.xcap-directory+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.omads-email+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omads-file+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omads-folder+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omaloc-supl-init": {
      source: "iana"
    },
    "application/vnd.onepager": {
      source: "iana"
    },
    "application/vnd.onepagertamp": {
      source: "iana"
    },
    "application/vnd.onepagertamx": {
      source: "iana"
    },
    "application/vnd.onepagertat": {
      source: "iana"
    },
    "application/vnd.onepagertatp": {
      source: "iana"
    },
    "application/vnd.onepagertatx": {
      source: "iana"
    },
    "application/vnd.openblox.game+xml": {
      source: "iana",
      compressible: true,
      extensions: ["obgx"]
    },
    "application/vnd.openblox.game-binary": {
      source: "iana"
    },
    "application/vnd.openeye.oeb": {
      source: "iana"
    },
    "application/vnd.openofficeorg.extension": {
      source: "apache",
      extensions: ["oxt"]
    },
    "application/vnd.openstreetmap.data+xml": {
      source: "iana",
      compressible: true,
      extensions: ["osm"]
    },
    "application/vnd.opentimestamps.ots": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawing+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["pptx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide": {
      source: "iana",
      extensions: ["sldx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
      source: "iana",
      extensions: ["ppsx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template": {
      source: "iana",
      extensions: ["potx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      source: "iana",
      compressible: false,
      extensions: ["xlsx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
      source: "iana",
      extensions: ["xltx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.theme+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.vmldrawing": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      source: "iana",
      compressible: false,
      extensions: ["docx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
      source: "iana",
      extensions: ["dotx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.core-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.relationships+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oracle.resource+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.orange.indata": {
      source: "iana"
    },
    "application/vnd.osa.netdeploy": {
      source: "iana"
    },
    "application/vnd.osgeo.mapguide.package": {
      source: "iana",
      extensions: ["mgp"]
    },
    "application/vnd.osgi.bundle": {
      source: "iana"
    },
    "application/vnd.osgi.dp": {
      source: "iana",
      extensions: ["dp"]
    },
    "application/vnd.osgi.subsystem": {
      source: "iana",
      extensions: ["esa"]
    },
    "application/vnd.otps.ct-kip+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oxli.countgraph": {
      source: "iana"
    },
    "application/vnd.pagerduty+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.palm": {
      source: "iana",
      extensions: ["pdb", "pqa", "oprc"]
    },
    "application/vnd.panoply": {
      source: "iana"
    },
    "application/vnd.paos.xml": {
      source: "iana"
    },
    "application/vnd.patentdive": {
      source: "iana"
    },
    "application/vnd.patientecommsdoc": {
      source: "iana"
    },
    "application/vnd.pawaafile": {
      source: "iana",
      extensions: ["paw"]
    },
    "application/vnd.pcos": {
      source: "iana"
    },
    "application/vnd.pg.format": {
      source: "iana",
      extensions: ["str"]
    },
    "application/vnd.pg.osasli": {
      source: "iana",
      extensions: ["ei6"]
    },
    "application/vnd.piaccess.application-licence": {
      source: "iana"
    },
    "application/vnd.picsel": {
      source: "iana",
      extensions: ["efif"]
    },
    "application/vnd.pmi.widget": {
      source: "iana",
      extensions: ["wg"]
    },
    "application/vnd.poc.group-advertisement+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.pocketlearn": {
      source: "iana",
      extensions: ["plf"]
    },
    "application/vnd.powerbuilder6": {
      source: "iana",
      extensions: ["pbd"]
    },
    "application/vnd.powerbuilder6-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder7": {
      source: "iana"
    },
    "application/vnd.powerbuilder7-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder75": {
      source: "iana"
    },
    "application/vnd.powerbuilder75-s": {
      source: "iana"
    },
    "application/vnd.preminet": {
      source: "iana"
    },
    "application/vnd.previewsystems.box": {
      source: "iana",
      extensions: ["box"]
    },
    "application/vnd.proteus.magazine": {
      source: "iana",
      extensions: ["mgz"]
    },
    "application/vnd.psfs": {
      source: "iana"
    },
    "application/vnd.publishare-delta-tree": {
      source: "iana",
      extensions: ["qps"]
    },
    "application/vnd.pvi.ptid1": {
      source: "iana",
      extensions: ["ptid"]
    },
    "application/vnd.pwg-multiplexed": {
      source: "iana"
    },
    "application/vnd.pwg-xhtml-print+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.qualcomm.brew-app-res": {
      source: "iana"
    },
    "application/vnd.quarantainenet": {
      source: "iana"
    },
    "application/vnd.quark.quarkxpress": {
      source: "iana",
      extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"]
    },
    "application/vnd.quobject-quoxdocument": {
      source: "iana"
    },
    "application/vnd.radisys.moml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-conf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-conn+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-dialog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-stream+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-conf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-base+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-fax-detect+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-group+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-speech+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-transform+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.rainstor.data": {
      source: "iana"
    },
    "application/vnd.rapid": {
      source: "iana"
    },
    "application/vnd.rar": {
      source: "iana",
      extensions: ["rar"]
    },
    "application/vnd.realvnc.bed": {
      source: "iana",
      extensions: ["bed"]
    },
    "application/vnd.recordare.musicxml": {
      source: "iana",
      extensions: ["mxl"]
    },
    "application/vnd.recordare.musicxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["musicxml"]
    },
    "application/vnd.renlearn.rlprint": {
      source: "iana"
    },
    "application/vnd.resilient.logic": {
      source: "iana"
    },
    "application/vnd.restful+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.rig.cryptonote": {
      source: "iana",
      extensions: ["cryptonote"]
    },
    "application/vnd.rim.cod": {
      source: "apache",
      extensions: ["cod"]
    },
    "application/vnd.rn-realmedia": {
      source: "apache",
      extensions: ["rm"]
    },
    "application/vnd.rn-realmedia-vbr": {
      source: "apache",
      extensions: ["rmvb"]
    },
    "application/vnd.route66.link66+xml": {
      source: "iana",
      compressible: true,
      extensions: ["link66"]
    },
    "application/vnd.rs-274x": {
      source: "iana"
    },
    "application/vnd.ruckus.download": {
      source: "iana"
    },
    "application/vnd.s3sms": {
      source: "iana"
    },
    "application/vnd.sailingtracker.track": {
      source: "iana",
      extensions: ["st"]
    },
    "application/vnd.sar": {
      source: "iana"
    },
    "application/vnd.sbm.cid": {
      source: "iana"
    },
    "application/vnd.sbm.mid2": {
      source: "iana"
    },
    "application/vnd.scribus": {
      source: "iana"
    },
    "application/vnd.sealed.3df": {
      source: "iana"
    },
    "application/vnd.sealed.csf": {
      source: "iana"
    },
    "application/vnd.sealed.doc": {
      source: "iana"
    },
    "application/vnd.sealed.eml": {
      source: "iana"
    },
    "application/vnd.sealed.mht": {
      source: "iana"
    },
    "application/vnd.sealed.net": {
      source: "iana"
    },
    "application/vnd.sealed.ppt": {
      source: "iana"
    },
    "application/vnd.sealed.tiff": {
      source: "iana"
    },
    "application/vnd.sealed.xls": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.html": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.pdf": {
      source: "iana"
    },
    "application/vnd.seemail": {
      source: "iana",
      extensions: ["see"]
    },
    "application/vnd.seis+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.sema": {
      source: "iana",
      extensions: ["sema"]
    },
    "application/vnd.semd": {
      source: "iana",
      extensions: ["semd"]
    },
    "application/vnd.semf": {
      source: "iana",
      extensions: ["semf"]
    },
    "application/vnd.shade-save-file": {
      source: "iana"
    },
    "application/vnd.shana.informed.formdata": {
      source: "iana",
      extensions: ["ifm"]
    },
    "application/vnd.shana.informed.formtemplate": {
      source: "iana",
      extensions: ["itp"]
    },
    "application/vnd.shana.informed.interchange": {
      source: "iana",
      extensions: ["iif"]
    },
    "application/vnd.shana.informed.package": {
      source: "iana",
      extensions: ["ipk"]
    },
    "application/vnd.shootproof+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.shopkick+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.shp": {
      source: "iana"
    },
    "application/vnd.shx": {
      source: "iana"
    },
    "application/vnd.sigrok.session": {
      source: "iana"
    },
    "application/vnd.simtech-mindmapper": {
      source: "iana",
      extensions: ["twd", "twds"]
    },
    "application/vnd.siren+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.smaf": {
      source: "iana",
      extensions: ["mmf"]
    },
    "application/vnd.smart.notebook": {
      source: "iana"
    },
    "application/vnd.smart.teacher": {
      source: "iana",
      extensions: ["teacher"]
    },
    "application/vnd.snesdev-page-table": {
      source: "iana"
    },
    "application/vnd.software602.filler.form+xml": {
      source: "iana",
      compressible: true,
      extensions: ["fo"]
    },
    "application/vnd.software602.filler.form-xml-zip": {
      source: "iana"
    },
    "application/vnd.solent.sdkm+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sdkm", "sdkd"]
    },
    "application/vnd.spotfire.dxp": {
      source: "iana",
      extensions: ["dxp"]
    },
    "application/vnd.spotfire.sfs": {
      source: "iana",
      extensions: ["sfs"]
    },
    "application/vnd.sqlite3": {
      source: "iana"
    },
    "application/vnd.sss-cod": {
      source: "iana"
    },
    "application/vnd.sss-dtf": {
      source: "iana"
    },
    "application/vnd.sss-ntf": {
      source: "iana"
    },
    "application/vnd.stardivision.calc": {
      source: "apache",
      extensions: ["sdc"]
    },
    "application/vnd.stardivision.draw": {
      source: "apache",
      extensions: ["sda"]
    },
    "application/vnd.stardivision.impress": {
      source: "apache",
      extensions: ["sdd"]
    },
    "application/vnd.stardivision.math": {
      source: "apache",
      extensions: ["smf"]
    },
    "application/vnd.stardivision.writer": {
      source: "apache",
      extensions: ["sdw", "vor"]
    },
    "application/vnd.stardivision.writer-global": {
      source: "apache",
      extensions: ["sgl"]
    },
    "application/vnd.stepmania.package": {
      source: "iana",
      extensions: ["smzip"]
    },
    "application/vnd.stepmania.stepchart": {
      source: "iana",
      extensions: ["sm"]
    },
    "application/vnd.street-stream": {
      source: "iana"
    },
    "application/vnd.sun.wadl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wadl"]
    },
    "application/vnd.sun.xml.calc": {
      source: "apache",
      extensions: ["sxc"]
    },
    "application/vnd.sun.xml.calc.template": {
      source: "apache",
      extensions: ["stc"]
    },
    "application/vnd.sun.xml.draw": {
      source: "apache",
      extensions: ["sxd"]
    },
    "application/vnd.sun.xml.draw.template": {
      source: "apache",
      extensions: ["std"]
    },
    "application/vnd.sun.xml.impress": {
      source: "apache",
      extensions: ["sxi"]
    },
    "application/vnd.sun.xml.impress.template": {
      source: "apache",
      extensions: ["sti"]
    },
    "application/vnd.sun.xml.math": {
      source: "apache",
      extensions: ["sxm"]
    },
    "application/vnd.sun.xml.writer": {
      source: "apache",
      extensions: ["sxw"]
    },
    "application/vnd.sun.xml.writer.global": {
      source: "apache",
      extensions: ["sxg"]
    },
    "application/vnd.sun.xml.writer.template": {
      source: "apache",
      extensions: ["stw"]
    },
    "application/vnd.sus-calendar": {
      source: "iana",
      extensions: ["sus", "susp"]
    },
    "application/vnd.svd": {
      source: "iana",
      extensions: ["svd"]
    },
    "application/vnd.swiftview-ics": {
      source: "iana"
    },
    "application/vnd.sycle+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.syft+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.symbian.install": {
      source: "apache",
      extensions: ["sis", "sisx"]
    },
    "application/vnd.syncml+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["xsm"]
    },
    "application/vnd.syncml.dm+wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["bdm"]
    },
    "application/vnd.syncml.dm+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["xdm"]
    },
    "application/vnd.syncml.dm.notification": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["ddf"]
    },
    "application/vnd.syncml.dmtnds+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmtnds+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.syncml.ds.notification": {
      source: "iana"
    },
    "application/vnd.tableschema+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tao.intent-module-archive": {
      source: "iana",
      extensions: ["tao"]
    },
    "application/vnd.tcpdump.pcap": {
      source: "iana",
      extensions: ["pcap", "cap", "dmp"]
    },
    "application/vnd.think-cell.ppttc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tmd.mediaflex.api+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tml": {
      source: "iana"
    },
    "application/vnd.tmobile-livetv": {
      source: "iana",
      extensions: ["tmo"]
    },
    "application/vnd.tri.onesource": {
      source: "iana"
    },
    "application/vnd.trid.tpt": {
      source: "iana",
      extensions: ["tpt"]
    },
    "application/vnd.triscape.mxs": {
      source: "iana",
      extensions: ["mxs"]
    },
    "application/vnd.trueapp": {
      source: "iana",
      extensions: ["tra"]
    },
    "application/vnd.truedoc": {
      source: "iana"
    },
    "application/vnd.ubisoft.webplayer": {
      source: "iana"
    },
    "application/vnd.ufdl": {
      source: "iana",
      extensions: ["ufd", "ufdl"]
    },
    "application/vnd.uiq.theme": {
      source: "iana",
      extensions: ["utz"]
    },
    "application/vnd.umajin": {
      source: "iana",
      extensions: ["umj"]
    },
    "application/vnd.unity": {
      source: "iana",
      extensions: ["unityweb"]
    },
    "application/vnd.uoml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["uoml"]
    },
    "application/vnd.uplanet.alert": {
      source: "iana"
    },
    "application/vnd.uplanet.alert-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.channel": {
      source: "iana"
    },
    "application/vnd.uplanet.channel-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.list": {
      source: "iana"
    },
    "application/vnd.uplanet.list-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.signal": {
      source: "iana"
    },
    "application/vnd.uri-map": {
      source: "iana"
    },
    "application/vnd.valve.source.material": {
      source: "iana"
    },
    "application/vnd.vcx": {
      source: "iana",
      extensions: ["vcx"]
    },
    "application/vnd.vd-study": {
      source: "iana"
    },
    "application/vnd.vectorworks": {
      source: "iana"
    },
    "application/vnd.vel+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.verimatrix.vcas": {
      source: "iana"
    },
    "application/vnd.veritone.aion+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.veryant.thin": {
      source: "iana"
    },
    "application/vnd.ves.encrypted": {
      source: "iana"
    },
    "application/vnd.vidsoft.vidconference": {
      source: "iana"
    },
    "application/vnd.visio": {
      source: "iana",
      extensions: ["vsd", "vst", "vss", "vsw"]
    },
    "application/vnd.visionary": {
      source: "iana",
      extensions: ["vis"]
    },
    "application/vnd.vividence.scriptfile": {
      source: "iana"
    },
    "application/vnd.vsf": {
      source: "iana",
      extensions: ["vsf"]
    },
    "application/vnd.wap.sic": {
      source: "iana"
    },
    "application/vnd.wap.slc": {
      source: "iana"
    },
    "application/vnd.wap.wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["wbxml"]
    },
    "application/vnd.wap.wmlc": {
      source: "iana",
      extensions: ["wmlc"]
    },
    "application/vnd.wap.wmlscriptc": {
      source: "iana",
      extensions: ["wmlsc"]
    },
    "application/vnd.webturbo": {
      source: "iana",
      extensions: ["wtb"]
    },
    "application/vnd.wfa.dpp": {
      source: "iana"
    },
    "application/vnd.wfa.p2p": {
      source: "iana"
    },
    "application/vnd.wfa.wsc": {
      source: "iana"
    },
    "application/vnd.windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.wmc": {
      source: "iana"
    },
    "application/vnd.wmf.bootstrap": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica.package": {
      source: "iana"
    },
    "application/vnd.wolfram.player": {
      source: "iana",
      extensions: ["nbp"]
    },
    "application/vnd.wordperfect": {
      source: "iana",
      extensions: ["wpd"]
    },
    "application/vnd.wqd": {
      source: "iana",
      extensions: ["wqd"]
    },
    "application/vnd.wrq-hp3000-labelled": {
      source: "iana"
    },
    "application/vnd.wt.stf": {
      source: "iana",
      extensions: ["stf"]
    },
    "application/vnd.wv.csp+wbxml": {
      source: "iana"
    },
    "application/vnd.wv.csp+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.wv.ssp+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xacml+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xara": {
      source: "iana",
      extensions: ["xar"]
    },
    "application/vnd.xfdl": {
      source: "iana",
      extensions: ["xfdl"]
    },
    "application/vnd.xfdl.webform": {
      source: "iana"
    },
    "application/vnd.xmi+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xmpie.cpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.dpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.plan": {
      source: "iana"
    },
    "application/vnd.xmpie.ppkg": {
      source: "iana"
    },
    "application/vnd.xmpie.xlim": {
      source: "iana"
    },
    "application/vnd.yamaha.hv-dic": {
      source: "iana",
      extensions: ["hvd"]
    },
    "application/vnd.yamaha.hv-script": {
      source: "iana",
      extensions: ["hvs"]
    },
    "application/vnd.yamaha.hv-voice": {
      source: "iana",
      extensions: ["hvp"]
    },
    "application/vnd.yamaha.openscoreformat": {
      source: "iana",
      extensions: ["osf"]
    },
    "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
      source: "iana",
      compressible: true,
      extensions: ["osfpvg"]
    },
    "application/vnd.yamaha.remote-setup": {
      source: "iana"
    },
    "application/vnd.yamaha.smaf-audio": {
      source: "iana",
      extensions: ["saf"]
    },
    "application/vnd.yamaha.smaf-phrase": {
      source: "iana",
      extensions: ["spf"]
    },
    "application/vnd.yamaha.through-ngn": {
      source: "iana"
    },
    "application/vnd.yamaha.tunnel-udpencap": {
      source: "iana"
    },
    "application/vnd.yaoweme": {
      source: "iana"
    },
    "application/vnd.yellowriver-custom-menu": {
      source: "iana",
      extensions: ["cmp"]
    },
    "application/vnd.youtube.yt": {
      source: "iana"
    },
    "application/vnd.zul": {
      source: "iana",
      extensions: ["zir", "zirz"]
    },
    "application/vnd.zzazz.deck+xml": {
      source: "iana",
      compressible: true,
      extensions: ["zaz"]
    },
    "application/voicexml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["vxml"]
    },
    "application/voucher-cms+json": {
      source: "iana",
      compressible: true
    },
    "application/vq-rtcpxr": {
      source: "iana"
    },
    "application/wasm": {
      source: "iana",
      compressible: true,
      extensions: ["wasm"]
    },
    "application/watcherinfo+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wif"]
    },
    "application/webpush-options+json": {
      source: "iana",
      compressible: true
    },
    "application/whoispp-query": {
      source: "iana"
    },
    "application/whoispp-response": {
      source: "iana"
    },
    "application/widget": {
      source: "iana",
      extensions: ["wgt"]
    },
    "application/winhlp": {
      source: "apache",
      extensions: ["hlp"]
    },
    "application/wita": {
      source: "iana"
    },
    "application/wordperfect5.1": {
      source: "iana"
    },
    "application/wsdl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wsdl"]
    },
    "application/wspolicy+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wspolicy"]
    },
    "application/x-7z-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["7z"]
    },
    "application/x-abiword": {
      source: "apache",
      extensions: ["abw"]
    },
    "application/x-ace-compressed": {
      source: "apache",
      extensions: ["ace"]
    },
    "application/x-amf": {
      source: "apache"
    },
    "application/x-apple-diskimage": {
      source: "apache",
      extensions: ["dmg"]
    },
    "application/x-arj": {
      compressible: false,
      extensions: ["arj"]
    },
    "application/x-authorware-bin": {
      source: "apache",
      extensions: ["aab", "x32", "u32", "vox"]
    },
    "application/x-authorware-map": {
      source: "apache",
      extensions: ["aam"]
    },
    "application/x-authorware-seg": {
      source: "apache",
      extensions: ["aas"]
    },
    "application/x-bcpio": {
      source: "apache",
      extensions: ["bcpio"]
    },
    "application/x-bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/x-bittorrent": {
      source: "apache",
      extensions: ["torrent"]
    },
    "application/x-blorb": {
      source: "apache",
      extensions: ["blb", "blorb"]
    },
    "application/x-bzip": {
      source: "apache",
      compressible: false,
      extensions: ["bz"]
    },
    "application/x-bzip2": {
      source: "apache",
      compressible: false,
      extensions: ["bz2", "boz"]
    },
    "application/x-cbr": {
      source: "apache",
      extensions: ["cbr", "cba", "cbt", "cbz", "cb7"]
    },
    "application/x-cdlink": {
      source: "apache",
      extensions: ["vcd"]
    },
    "application/x-cfs-compressed": {
      source: "apache",
      extensions: ["cfs"]
    },
    "application/x-chat": {
      source: "apache",
      extensions: ["chat"]
    },
    "application/x-chess-pgn": {
      source: "apache",
      extensions: ["pgn"]
    },
    "application/x-chrome-extension": {
      extensions: ["crx"]
    },
    "application/x-cocoa": {
      source: "nginx",
      extensions: ["cco"]
    },
    "application/x-compress": {
      source: "apache"
    },
    "application/x-conference": {
      source: "apache",
      extensions: ["nsc"]
    },
    "application/x-cpio": {
      source: "apache",
      extensions: ["cpio"]
    },
    "application/x-csh": {
      source: "apache",
      extensions: ["csh"]
    },
    "application/x-deb": {
      compressible: false
    },
    "application/x-debian-package": {
      source: "apache",
      extensions: ["deb", "udeb"]
    },
    "application/x-dgc-compressed": {
      source: "apache",
      extensions: ["dgc"]
    },
    "application/x-director": {
      source: "apache",
      extensions: ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"]
    },
    "application/x-doom": {
      source: "apache",
      extensions: ["wad"]
    },
    "application/x-dtbncx+xml": {
      source: "apache",
      compressible: true,
      extensions: ["ncx"]
    },
    "application/x-dtbook+xml": {
      source: "apache",
      compressible: true,
      extensions: ["dtb"]
    },
    "application/x-dtbresource+xml": {
      source: "apache",
      compressible: true,
      extensions: ["res"]
    },
    "application/x-dvi": {
      source: "apache",
      compressible: false,
      extensions: ["dvi"]
    },
    "application/x-envoy": {
      source: "apache",
      extensions: ["evy"]
    },
    "application/x-eva": {
      source: "apache",
      extensions: ["eva"]
    },
    "application/x-font-bdf": {
      source: "apache",
      extensions: ["bdf"]
    },
    "application/x-font-dos": {
      source: "apache"
    },
    "application/x-font-framemaker": {
      source: "apache"
    },
    "application/x-font-ghostscript": {
      source: "apache",
      extensions: ["gsf"]
    },
    "application/x-font-libgrx": {
      source: "apache"
    },
    "application/x-font-linux-psf": {
      source: "apache",
      extensions: ["psf"]
    },
    "application/x-font-pcf": {
      source: "apache",
      extensions: ["pcf"]
    },
    "application/x-font-snf": {
      source: "apache",
      extensions: ["snf"]
    },
    "application/x-font-speedo": {
      source: "apache"
    },
    "application/x-font-sunos-news": {
      source: "apache"
    },
    "application/x-font-type1": {
      source: "apache",
      extensions: ["pfa", "pfb", "pfm", "afm"]
    },
    "application/x-font-vfont": {
      source: "apache"
    },
    "application/x-freearc": {
      source: "apache",
      extensions: ["arc"]
    },
    "application/x-futuresplash": {
      source: "apache",
      extensions: ["spl"]
    },
    "application/x-gca-compressed": {
      source: "apache",
      extensions: ["gca"]
    },
    "application/x-glulx": {
      source: "apache",
      extensions: ["ulx"]
    },
    "application/x-gnumeric": {
      source: "apache",
      extensions: ["gnumeric"]
    },
    "application/x-gramps-xml": {
      source: "apache",
      extensions: ["gramps"]
    },
    "application/x-gtar": {
      source: "apache",
      extensions: ["gtar"]
    },
    "application/x-gzip": {
      source: "apache"
    },
    "application/x-hdf": {
      source: "apache",
      extensions: ["hdf"]
    },
    "application/x-httpd-php": {
      compressible: true,
      extensions: ["php"]
    },
    "application/x-install-instructions": {
      source: "apache",
      extensions: ["install"]
    },
    "application/x-iso9660-image": {
      source: "apache",
      extensions: ["iso"]
    },
    "application/x-iwork-keynote-sffkey": {
      extensions: ["key"]
    },
    "application/x-iwork-numbers-sffnumbers": {
      extensions: ["numbers"]
    },
    "application/x-iwork-pages-sffpages": {
      extensions: ["pages"]
    },
    "application/x-java-archive-diff": {
      source: "nginx",
      extensions: ["jardiff"]
    },
    "application/x-java-jnlp-file": {
      source: "apache",
      compressible: false,
      extensions: ["jnlp"]
    },
    "application/x-javascript": {
      compressible: true
    },
    "application/x-keepass2": {
      extensions: ["kdbx"]
    },
    "application/x-latex": {
      source: "apache",
      compressible: false,
      extensions: ["latex"]
    },
    "application/x-lua-bytecode": {
      extensions: ["luac"]
    },
    "application/x-lzh-compressed": {
      source: "apache",
      extensions: ["lzh", "lha"]
    },
    "application/x-makeself": {
      source: "nginx",
      extensions: ["run"]
    },
    "application/x-mie": {
      source: "apache",
      extensions: ["mie"]
    },
    "application/x-mobipocket-ebook": {
      source: "apache",
      extensions: ["prc", "mobi"]
    },
    "application/x-mpegurl": {
      compressible: false
    },
    "application/x-ms-application": {
      source: "apache",
      extensions: ["application"]
    },
    "application/x-ms-shortcut": {
      source: "apache",
      extensions: ["lnk"]
    },
    "application/x-ms-wmd": {
      source: "apache",
      extensions: ["wmd"]
    },
    "application/x-ms-wmz": {
      source: "apache",
      extensions: ["wmz"]
    },
    "application/x-ms-xbap": {
      source: "apache",
      extensions: ["xbap"]
    },
    "application/x-msaccess": {
      source: "apache",
      extensions: ["mdb"]
    },
    "application/x-msbinder": {
      source: "apache",
      extensions: ["obd"]
    },
    "application/x-mscardfile": {
      source: "apache",
      extensions: ["crd"]
    },
    "application/x-msclip": {
      source: "apache",
      extensions: ["clp"]
    },
    "application/x-msdos-program": {
      extensions: ["exe"]
    },
    "application/x-msdownload": {
      source: "apache",
      extensions: ["exe", "dll", "com", "bat", "msi"]
    },
    "application/x-msmediaview": {
      source: "apache",
      extensions: ["mvb", "m13", "m14"]
    },
    "application/x-msmetafile": {
      source: "apache",
      extensions: ["wmf", "wmz", "emf", "emz"]
    },
    "application/x-msmoney": {
      source: "apache",
      extensions: ["mny"]
    },
    "application/x-mspublisher": {
      source: "apache",
      extensions: ["pub"]
    },
    "application/x-msschedule": {
      source: "apache",
      extensions: ["scd"]
    },
    "application/x-msterminal": {
      source: "apache",
      extensions: ["trm"]
    },
    "application/x-mswrite": {
      source: "apache",
      extensions: ["wri"]
    },
    "application/x-netcdf": {
      source: "apache",
      extensions: ["nc", "cdf"]
    },
    "application/x-ns-proxy-autoconfig": {
      compressible: true,
      extensions: ["pac"]
    },
    "application/x-nzb": {
      source: "apache",
      extensions: ["nzb"]
    },
    "application/x-perl": {
      source: "nginx",
      extensions: ["pl", "pm"]
    },
    "application/x-pilot": {
      source: "nginx",
      extensions: ["prc", "pdb"]
    },
    "application/x-pkcs12": {
      source: "apache",
      compressible: false,
      extensions: ["p12", "pfx"]
    },
    "application/x-pkcs7-certificates": {
      source: "apache",
      extensions: ["p7b", "spc"]
    },
    "application/x-pkcs7-certreqresp": {
      source: "apache",
      extensions: ["p7r"]
    },
    "application/x-pki-message": {
      source: "iana"
    },
    "application/x-rar-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["rar"]
    },
    "application/x-redhat-package-manager": {
      source: "nginx",
      extensions: ["rpm"]
    },
    "application/x-research-info-systems": {
      source: "apache",
      extensions: ["ris"]
    },
    "application/x-sea": {
      source: "nginx",
      extensions: ["sea"]
    },
    "application/x-sh": {
      source: "apache",
      compressible: true,
      extensions: ["sh"]
    },
    "application/x-shar": {
      source: "apache",
      extensions: ["shar"]
    },
    "application/x-shockwave-flash": {
      source: "apache",
      compressible: false,
      extensions: ["swf"]
    },
    "application/x-silverlight-app": {
      source: "apache",
      extensions: ["xap"]
    },
    "application/x-sql": {
      source: "apache",
      extensions: ["sql"]
    },
    "application/x-stuffit": {
      source: "apache",
      compressible: false,
      extensions: ["sit"]
    },
    "application/x-stuffitx": {
      source: "apache",
      extensions: ["sitx"]
    },
    "application/x-subrip": {
      source: "apache",
      extensions: ["srt"]
    },
    "application/x-sv4cpio": {
      source: "apache",
      extensions: ["sv4cpio"]
    },
    "application/x-sv4crc": {
      source: "apache",
      extensions: ["sv4crc"]
    },
    "application/x-t3vm-image": {
      source: "apache",
      extensions: ["t3"]
    },
    "application/x-tads": {
      source: "apache",
      extensions: ["gam"]
    },
    "application/x-tar": {
      source: "apache",
      compressible: true,
      extensions: ["tar"]
    },
    "application/x-tcl": {
      source: "apache",
      extensions: ["tcl", "tk"]
    },
    "application/x-tex": {
      source: "apache",
      extensions: ["tex"]
    },
    "application/x-tex-tfm": {
      source: "apache",
      extensions: ["tfm"]
    },
    "application/x-texinfo": {
      source: "apache",
      extensions: ["texinfo", "texi"]
    },
    "application/x-tgif": {
      source: "apache",
      extensions: ["obj"]
    },
    "application/x-ustar": {
      source: "apache",
      extensions: ["ustar"]
    },
    "application/x-virtualbox-hdd": {
      compressible: true,
      extensions: ["hdd"]
    },
    "application/x-virtualbox-ova": {
      compressible: true,
      extensions: ["ova"]
    },
    "application/x-virtualbox-ovf": {
      compressible: true,
      extensions: ["ovf"]
    },
    "application/x-virtualbox-vbox": {
      compressible: true,
      extensions: ["vbox"]
    },
    "application/x-virtualbox-vbox-extpack": {
      compressible: false,
      extensions: ["vbox-extpack"]
    },
    "application/x-virtualbox-vdi": {
      compressible: true,
      extensions: ["vdi"]
    },
    "application/x-virtualbox-vhd": {
      compressible: true,
      extensions: ["vhd"]
    },
    "application/x-virtualbox-vmdk": {
      compressible: true,
      extensions: ["vmdk"]
    },
    "application/x-wais-source": {
      source: "apache",
      extensions: ["src"]
    },
    "application/x-web-app-manifest+json": {
      compressible: true,
      extensions: ["webapp"]
    },
    "application/x-www-form-urlencoded": {
      source: "iana",
      compressible: true
    },
    "application/x-x509-ca-cert": {
      source: "iana",
      extensions: ["der", "crt", "pem"]
    },
    "application/x-x509-ca-ra-cert": {
      source: "iana"
    },
    "application/x-x509-next-ca-cert": {
      source: "iana"
    },
    "application/x-xfig": {
      source: "apache",
      extensions: ["fig"]
    },
    "application/x-xliff+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xlf"]
    },
    "application/x-xpinstall": {
      source: "apache",
      compressible: false,
      extensions: ["xpi"]
    },
    "application/x-xz": {
      source: "apache",
      extensions: ["xz"]
    },
    "application/x-zmachine": {
      source: "apache",
      extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"]
    },
    "application/x400-bp": {
      source: "iana"
    },
    "application/xacml+xml": {
      source: "iana",
      compressible: true
    },
    "application/xaml+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xaml"]
    },
    "application/xcap-att+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xav"]
    },
    "application/xcap-caps+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xca"]
    },
    "application/xcap-diff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdf"]
    },
    "application/xcap-el+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xel"]
    },
    "application/xcap-error+xml": {
      source: "iana",
      compressible: true
    },
    "application/xcap-ns+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xns"]
    },
    "application/xcon-conference-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/xcon-conference-info-diff+xml": {
      source: "iana",
      compressible: true
    },
    "application/xenc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xenc"]
    },
    "application/xhtml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xhtml", "xht"]
    },
    "application/xhtml-voice+xml": {
      source: "apache",
      compressible: true
    },
    "application/xliff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xlf"]
    },
    "application/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml", "xsl", "xsd", "rng"]
    },
    "application/xml-dtd": {
      source: "iana",
      compressible: true,
      extensions: ["dtd"]
    },
    "application/xml-external-parsed-entity": {
      source: "iana"
    },
    "application/xml-patch+xml": {
      source: "iana",
      compressible: true
    },
    "application/xmpp+xml": {
      source: "iana",
      compressible: true
    },
    "application/xop+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xop"]
    },
    "application/xproc+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xpl"]
    },
    "application/xslt+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xsl", "xslt"]
    },
    "application/xspf+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xspf"]
    },
    "application/xv+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mxml", "xhvml", "xvml", "xvm"]
    },
    "application/yang": {
      source: "iana",
      extensions: ["yang"]
    },
    "application/yang-data+json": {
      source: "iana",
      compressible: true
    },
    "application/yang-data+xml": {
      source: "iana",
      compressible: true
    },
    "application/yang-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/yang-patch+xml": {
      source: "iana",
      compressible: true
    },
    "application/yin+xml": {
      source: "iana",
      compressible: true,
      extensions: ["yin"]
    },
    "application/zip": {
      source: "iana",
      compressible: false,
      extensions: ["zip"]
    },
    "application/zlib": {
      source: "iana"
    },
    "application/zstd": {
      source: "iana"
    },
    "audio/1d-interleaved-parityfec": {
      source: "iana"
    },
    "audio/32kadpcm": {
      source: "iana"
    },
    "audio/3gpp": {
      source: "iana",
      compressible: false,
      extensions: ["3gpp"]
    },
    "audio/3gpp2": {
      source: "iana"
    },
    "audio/aac": {
      source: "iana"
    },
    "audio/ac3": {
      source: "iana"
    },
    "audio/adpcm": {
      source: "apache",
      extensions: ["adp"]
    },
    "audio/amr": {
      source: "iana",
      extensions: ["amr"]
    },
    "audio/amr-wb": {
      source: "iana"
    },
    "audio/amr-wb+": {
      source: "iana"
    },
    "audio/aptx": {
      source: "iana"
    },
    "audio/asc": {
      source: "iana"
    },
    "audio/atrac-advanced-lossless": {
      source: "iana"
    },
    "audio/atrac-x": {
      source: "iana"
    },
    "audio/atrac3": {
      source: "iana"
    },
    "audio/basic": {
      source: "iana",
      compressible: false,
      extensions: ["au", "snd"]
    },
    "audio/bv16": {
      source: "iana"
    },
    "audio/bv32": {
      source: "iana"
    },
    "audio/clearmode": {
      source: "iana"
    },
    "audio/cn": {
      source: "iana"
    },
    "audio/dat12": {
      source: "iana"
    },
    "audio/dls": {
      source: "iana"
    },
    "audio/dsr-es201108": {
      source: "iana"
    },
    "audio/dsr-es202050": {
      source: "iana"
    },
    "audio/dsr-es202211": {
      source: "iana"
    },
    "audio/dsr-es202212": {
      source: "iana"
    },
    "audio/dv": {
      source: "iana"
    },
    "audio/dvi4": {
      source: "iana"
    },
    "audio/eac3": {
      source: "iana"
    },
    "audio/encaprtp": {
      source: "iana"
    },
    "audio/evrc": {
      source: "iana"
    },
    "audio/evrc-qcp": {
      source: "iana"
    },
    "audio/evrc0": {
      source: "iana"
    },
    "audio/evrc1": {
      source: "iana"
    },
    "audio/evrcb": {
      source: "iana"
    },
    "audio/evrcb0": {
      source: "iana"
    },
    "audio/evrcb1": {
      source: "iana"
    },
    "audio/evrcnw": {
      source: "iana"
    },
    "audio/evrcnw0": {
      source: "iana"
    },
    "audio/evrcnw1": {
      source: "iana"
    },
    "audio/evrcwb": {
      source: "iana"
    },
    "audio/evrcwb0": {
      source: "iana"
    },
    "audio/evrcwb1": {
      source: "iana"
    },
    "audio/evs": {
      source: "iana"
    },
    "audio/flexfec": {
      source: "iana"
    },
    "audio/fwdred": {
      source: "iana"
    },
    "audio/g711-0": {
      source: "iana"
    },
    "audio/g719": {
      source: "iana"
    },
    "audio/g722": {
      source: "iana"
    },
    "audio/g7221": {
      source: "iana"
    },
    "audio/g723": {
      source: "iana"
    },
    "audio/g726-16": {
      source: "iana"
    },
    "audio/g726-24": {
      source: "iana"
    },
    "audio/g726-32": {
      source: "iana"
    },
    "audio/g726-40": {
      source: "iana"
    },
    "audio/g728": {
      source: "iana"
    },
    "audio/g729": {
      source: "iana"
    },
    "audio/g7291": {
      source: "iana"
    },
    "audio/g729d": {
      source: "iana"
    },
    "audio/g729e": {
      source: "iana"
    },
    "audio/gsm": {
      source: "iana"
    },
    "audio/gsm-efr": {
      source: "iana"
    },
    "audio/gsm-hr-08": {
      source: "iana"
    },
    "audio/ilbc": {
      source: "iana"
    },
    "audio/ip-mr_v2.5": {
      source: "iana"
    },
    "audio/isac": {
      source: "apache"
    },
    "audio/l16": {
      source: "iana"
    },
    "audio/l20": {
      source: "iana"
    },
    "audio/l24": {
      source: "iana",
      compressible: false
    },
    "audio/l8": {
      source: "iana"
    },
    "audio/lpc": {
      source: "iana"
    },
    "audio/melp": {
      source: "iana"
    },
    "audio/melp1200": {
      source: "iana"
    },
    "audio/melp2400": {
      source: "iana"
    },
    "audio/melp600": {
      source: "iana"
    },
    "audio/mhas": {
      source: "iana"
    },
    "audio/midi": {
      source: "apache",
      extensions: ["mid", "midi", "kar", "rmi"]
    },
    "audio/mobile-xmf": {
      source: "iana",
      extensions: ["mxmf"]
    },
    "audio/mp3": {
      compressible: false,
      extensions: ["mp3"]
    },
    "audio/mp4": {
      source: "iana",
      compressible: false,
      extensions: ["m4a", "mp4a"]
    },
    "audio/mp4a-latm": {
      source: "iana"
    },
    "audio/mpa": {
      source: "iana"
    },
    "audio/mpa-robust": {
      source: "iana"
    },
    "audio/mpeg": {
      source: "iana",
      compressible: false,
      extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
    },
    "audio/mpeg4-generic": {
      source: "iana"
    },
    "audio/musepack": {
      source: "apache"
    },
    "audio/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["oga", "ogg", "spx", "opus"]
    },
    "audio/opus": {
      source: "iana"
    },
    "audio/parityfec": {
      source: "iana"
    },
    "audio/pcma": {
      source: "iana"
    },
    "audio/pcma-wb": {
      source: "iana"
    },
    "audio/pcmu": {
      source: "iana"
    },
    "audio/pcmu-wb": {
      source: "iana"
    },
    "audio/prs.sid": {
      source: "iana"
    },
    "audio/qcelp": {
      source: "iana"
    },
    "audio/raptorfec": {
      source: "iana"
    },
    "audio/red": {
      source: "iana"
    },
    "audio/rtp-enc-aescm128": {
      source: "iana"
    },
    "audio/rtp-midi": {
      source: "iana"
    },
    "audio/rtploopback": {
      source: "iana"
    },
    "audio/rtx": {
      source: "iana"
    },
    "audio/s3m": {
      source: "apache",
      extensions: ["s3m"]
    },
    "audio/scip": {
      source: "iana"
    },
    "audio/silk": {
      source: "apache",
      extensions: ["sil"]
    },
    "audio/smv": {
      source: "iana"
    },
    "audio/smv-qcp": {
      source: "iana"
    },
    "audio/smv0": {
      source: "iana"
    },
    "audio/sofa": {
      source: "iana"
    },
    "audio/sp-midi": {
      source: "iana"
    },
    "audio/speex": {
      source: "iana"
    },
    "audio/t140c": {
      source: "iana"
    },
    "audio/t38": {
      source: "iana"
    },
    "audio/telephone-event": {
      source: "iana"
    },
    "audio/tetra_acelp": {
      source: "iana"
    },
    "audio/tetra_acelp_bb": {
      source: "iana"
    },
    "audio/tone": {
      source: "iana"
    },
    "audio/tsvcis": {
      source: "iana"
    },
    "audio/uemclip": {
      source: "iana"
    },
    "audio/ulpfec": {
      source: "iana"
    },
    "audio/usac": {
      source: "iana"
    },
    "audio/vdvi": {
      source: "iana"
    },
    "audio/vmr-wb": {
      source: "iana"
    },
    "audio/vnd.3gpp.iufp": {
      source: "iana"
    },
    "audio/vnd.4sb": {
      source: "iana"
    },
    "audio/vnd.audiokoz": {
      source: "iana"
    },
    "audio/vnd.celp": {
      source: "iana"
    },
    "audio/vnd.cisco.nse": {
      source: "iana"
    },
    "audio/vnd.cmles.radio-events": {
      source: "iana"
    },
    "audio/vnd.cns.anp1": {
      source: "iana"
    },
    "audio/vnd.cns.inf1": {
      source: "iana"
    },
    "audio/vnd.dece.audio": {
      source: "iana",
      extensions: ["uva", "uvva"]
    },
    "audio/vnd.digital-winds": {
      source: "iana",
      extensions: ["eol"]
    },
    "audio/vnd.dlna.adts": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.1": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.2": {
      source: "iana"
    },
    "audio/vnd.dolby.mlp": {
      source: "iana"
    },
    "audio/vnd.dolby.mps": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2x": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2z": {
      source: "iana"
    },
    "audio/vnd.dolby.pulse.1": {
      source: "iana"
    },
    "audio/vnd.dra": {
      source: "iana",
      extensions: ["dra"]
    },
    "audio/vnd.dts": {
      source: "iana",
      extensions: ["dts"]
    },
    "audio/vnd.dts.hd": {
      source: "iana",
      extensions: ["dtshd"]
    },
    "audio/vnd.dts.uhd": {
      source: "iana"
    },
    "audio/vnd.dvb.file": {
      source: "iana"
    },
    "audio/vnd.everad.plj": {
      source: "iana"
    },
    "audio/vnd.hns.audio": {
      source: "iana"
    },
    "audio/vnd.lucent.voice": {
      source: "iana",
      extensions: ["lvp"]
    },
    "audio/vnd.ms-playready.media.pya": {
      source: "iana",
      extensions: ["pya"]
    },
    "audio/vnd.nokia.mobile-xmf": {
      source: "iana"
    },
    "audio/vnd.nortel.vbk": {
      source: "iana"
    },
    "audio/vnd.nuera.ecelp4800": {
      source: "iana",
      extensions: ["ecelp4800"]
    },
    "audio/vnd.nuera.ecelp7470": {
      source: "iana",
      extensions: ["ecelp7470"]
    },
    "audio/vnd.nuera.ecelp9600": {
      source: "iana",
      extensions: ["ecelp9600"]
    },
    "audio/vnd.octel.sbc": {
      source: "iana"
    },
    "audio/vnd.presonus.multitrack": {
      source: "iana"
    },
    "audio/vnd.qcelp": {
      source: "iana"
    },
    "audio/vnd.rhetorex.32kadpcm": {
      source: "iana"
    },
    "audio/vnd.rip": {
      source: "iana",
      extensions: ["rip"]
    },
    "audio/vnd.rn-realaudio": {
      compressible: false
    },
    "audio/vnd.sealedmedia.softseal.mpeg": {
      source: "iana"
    },
    "audio/vnd.vmx.cvsd": {
      source: "iana"
    },
    "audio/vnd.wave": {
      compressible: false
    },
    "audio/vorbis": {
      source: "iana",
      compressible: false
    },
    "audio/vorbis-config": {
      source: "iana"
    },
    "audio/wav": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/wave": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/webm": {
      source: "apache",
      compressible: false,
      extensions: ["weba"]
    },
    "audio/x-aac": {
      source: "apache",
      compressible: false,
      extensions: ["aac"]
    },
    "audio/x-aiff": {
      source: "apache",
      extensions: ["aif", "aiff", "aifc"]
    },
    "audio/x-caf": {
      source: "apache",
      compressible: false,
      extensions: ["caf"]
    },
    "audio/x-flac": {
      source: "apache",
      extensions: ["flac"]
    },
    "audio/x-m4a": {
      source: "nginx",
      extensions: ["m4a"]
    },
    "audio/x-matroska": {
      source: "apache",
      extensions: ["mka"]
    },
    "audio/x-mpegurl": {
      source: "apache",
      extensions: ["m3u"]
    },
    "audio/x-ms-wax": {
      source: "apache",
      extensions: ["wax"]
    },
    "audio/x-ms-wma": {
      source: "apache",
      extensions: ["wma"]
    },
    "audio/x-pn-realaudio": {
      source: "apache",
      extensions: ["ram", "ra"]
    },
    "audio/x-pn-realaudio-plugin": {
      source: "apache",
      extensions: ["rmp"]
    },
    "audio/x-realaudio": {
      source: "nginx",
      extensions: ["ra"]
    },
    "audio/x-tta": {
      source: "apache"
    },
    "audio/x-wav": {
      source: "apache",
      extensions: ["wav"]
    },
    "audio/xm": {
      source: "apache",
      extensions: ["xm"]
    },
    "chemical/x-cdx": {
      source: "apache",
      extensions: ["cdx"]
    },
    "chemical/x-cif": {
      source: "apache",
      extensions: ["cif"]
    },
    "chemical/x-cmdf": {
      source: "apache",
      extensions: ["cmdf"]
    },
    "chemical/x-cml": {
      source: "apache",
      extensions: ["cml"]
    },
    "chemical/x-csml": {
      source: "apache",
      extensions: ["csml"]
    },
    "chemical/x-pdb": {
      source: "apache"
    },
    "chemical/x-xyz": {
      source: "apache",
      extensions: ["xyz"]
    },
    "font/collection": {
      source: "iana",
      extensions: ["ttc"]
    },
    "font/otf": {
      source: "iana",
      compressible: true,
      extensions: ["otf"]
    },
    "font/sfnt": {
      source: "iana"
    },
    "font/ttf": {
      source: "iana",
      compressible: true,
      extensions: ["ttf"]
    },
    "font/woff": {
      source: "iana",
      extensions: ["woff"]
    },
    "font/woff2": {
      source: "iana",
      extensions: ["woff2"]
    },
    "image/aces": {
      source: "iana",
      extensions: ["exr"]
    },
    "image/apng": {
      compressible: false,
      extensions: ["apng"]
    },
    "image/avci": {
      source: "iana",
      extensions: ["avci"]
    },
    "image/avcs": {
      source: "iana",
      extensions: ["avcs"]
    },
    "image/avif": {
      source: "iana",
      compressible: false,
      extensions: ["avif"]
    },
    "image/bmp": {
      source: "iana",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/cgm": {
      source: "iana",
      extensions: ["cgm"]
    },
    "image/dicom-rle": {
      source: "iana",
      extensions: ["drle"]
    },
    "image/emf": {
      source: "iana",
      extensions: ["emf"]
    },
    "image/fits": {
      source: "iana",
      extensions: ["fits"]
    },
    "image/g3fax": {
      source: "iana",
      extensions: ["g3"]
    },
    "image/gif": {
      source: "iana",
      compressible: false,
      extensions: ["gif"]
    },
    "image/heic": {
      source: "iana",
      extensions: ["heic"]
    },
    "image/heic-sequence": {
      source: "iana",
      extensions: ["heics"]
    },
    "image/heif": {
      source: "iana",
      extensions: ["heif"]
    },
    "image/heif-sequence": {
      source: "iana",
      extensions: ["heifs"]
    },
    "image/hej2k": {
      source: "iana",
      extensions: ["hej2"]
    },
    "image/hsj2": {
      source: "iana",
      extensions: ["hsj2"]
    },
    "image/ief": {
      source: "iana",
      extensions: ["ief"]
    },
    "image/jls": {
      source: "iana",
      extensions: ["jls"]
    },
    "image/jp2": {
      source: "iana",
      compressible: false,
      extensions: ["jp2", "jpg2"]
    },
    "image/jpeg": {
      source: "iana",
      compressible: false,
      extensions: ["jpeg", "jpg", "jpe"]
    },
    "image/jph": {
      source: "iana",
      extensions: ["jph"]
    },
    "image/jphc": {
      source: "iana",
      extensions: ["jhc"]
    },
    "image/jpm": {
      source: "iana",
      compressible: false,
      extensions: ["jpm"]
    },
    "image/jpx": {
      source: "iana",
      compressible: false,
      extensions: ["jpx", "jpf"]
    },
    "image/jxr": {
      source: "iana",
      extensions: ["jxr"]
    },
    "image/jxra": {
      source: "iana",
      extensions: ["jxra"]
    },
    "image/jxrs": {
      source: "iana",
      extensions: ["jxrs"]
    },
    "image/jxs": {
      source: "iana",
      extensions: ["jxs"]
    },
    "image/jxsc": {
      source: "iana",
      extensions: ["jxsc"]
    },
    "image/jxsi": {
      source: "iana",
      extensions: ["jxsi"]
    },
    "image/jxss": {
      source: "iana",
      extensions: ["jxss"]
    },
    "image/ktx": {
      source: "iana",
      extensions: ["ktx"]
    },
    "image/ktx2": {
      source: "iana",
      extensions: ["ktx2"]
    },
    "image/naplps": {
      source: "iana"
    },
    "image/pjpeg": {
      compressible: false
    },
    "image/png": {
      source: "iana",
      compressible: false,
      extensions: ["png"]
    },
    "image/prs.btif": {
      source: "iana",
      extensions: ["btif"]
    },
    "image/prs.pti": {
      source: "iana",
      extensions: ["pti"]
    },
    "image/pwg-raster": {
      source: "iana"
    },
    "image/sgi": {
      source: "apache",
      extensions: ["sgi"]
    },
    "image/svg+xml": {
      source: "iana",
      compressible: true,
      extensions: ["svg", "svgz"]
    },
    "image/t38": {
      source: "iana",
      extensions: ["t38"]
    },
    "image/tiff": {
      source: "iana",
      compressible: false,
      extensions: ["tif", "tiff"]
    },
    "image/tiff-fx": {
      source: "iana",
      extensions: ["tfx"]
    },
    "image/vnd.adobe.photoshop": {
      source: "iana",
      compressible: true,
      extensions: ["psd"]
    },
    "image/vnd.airzip.accelerator.azv": {
      source: "iana",
      extensions: ["azv"]
    },
    "image/vnd.cns.inf2": {
      source: "iana"
    },
    "image/vnd.dece.graphic": {
      source: "iana",
      extensions: ["uvi", "uvvi", "uvg", "uvvg"]
    },
    "image/vnd.djvu": {
      source: "iana",
      extensions: ["djvu", "djv"]
    },
    "image/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "image/vnd.dwg": {
      source: "iana",
      extensions: ["dwg"]
    },
    "image/vnd.dxf": {
      source: "iana",
      extensions: ["dxf"]
    },
    "image/vnd.fastbidsheet": {
      source: "iana",
      extensions: ["fbs"]
    },
    "image/vnd.fpx": {
      source: "iana",
      extensions: ["fpx"]
    },
    "image/vnd.fst": {
      source: "iana",
      extensions: ["fst"]
    },
    "image/vnd.fujixerox.edmics-mmr": {
      source: "iana",
      extensions: ["mmr"]
    },
    "image/vnd.fujixerox.edmics-rlc": {
      source: "iana",
      extensions: ["rlc"]
    },
    "image/vnd.globalgraphics.pgb": {
      source: "iana"
    },
    "image/vnd.microsoft.icon": {
      source: "iana",
      compressible: true,
      extensions: ["ico"]
    },
    "image/vnd.mix": {
      source: "iana"
    },
    "image/vnd.mozilla.apng": {
      source: "iana"
    },
    "image/vnd.ms-dds": {
      compressible: true,
      extensions: ["dds"]
    },
    "image/vnd.ms-modi": {
      source: "iana",
      extensions: ["mdi"]
    },
    "image/vnd.ms-photo": {
      source: "apache",
      extensions: ["wdp"]
    },
    "image/vnd.net-fpx": {
      source: "iana",
      extensions: ["npx"]
    },
    "image/vnd.pco.b16": {
      source: "iana",
      extensions: ["b16"]
    },
    "image/vnd.radiance": {
      source: "iana"
    },
    "image/vnd.sealed.png": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.gif": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.jpg": {
      source: "iana"
    },
    "image/vnd.svf": {
      source: "iana"
    },
    "image/vnd.tencent.tap": {
      source: "iana",
      extensions: ["tap"]
    },
    "image/vnd.valve.source.texture": {
      source: "iana",
      extensions: ["vtf"]
    },
    "image/vnd.wap.wbmp": {
      source: "iana",
      extensions: ["wbmp"]
    },
    "image/vnd.xiff": {
      source: "iana",
      extensions: ["xif"]
    },
    "image/vnd.zbrush.pcx": {
      source: "iana",
      extensions: ["pcx"]
    },
    "image/webp": {
      source: "apache",
      extensions: ["webp"]
    },
    "image/wmf": {
      source: "iana",
      extensions: ["wmf"]
    },
    "image/x-3ds": {
      source: "apache",
      extensions: ["3ds"]
    },
    "image/x-cmu-raster": {
      source: "apache",
      extensions: ["ras"]
    },
    "image/x-cmx": {
      source: "apache",
      extensions: ["cmx"]
    },
    "image/x-freehand": {
      source: "apache",
      extensions: ["fh", "fhc", "fh4", "fh5", "fh7"]
    },
    "image/x-icon": {
      source: "apache",
      compressible: true,
      extensions: ["ico"]
    },
    "image/x-jng": {
      source: "nginx",
      extensions: ["jng"]
    },
    "image/x-mrsid-image": {
      source: "apache",
      extensions: ["sid"]
    },
    "image/x-ms-bmp": {
      source: "nginx",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/x-pcx": {
      source: "apache",
      extensions: ["pcx"]
    },
    "image/x-pict": {
      source: "apache",
      extensions: ["pic", "pct"]
    },
    "image/x-portable-anymap": {
      source: "apache",
      extensions: ["pnm"]
    },
    "image/x-portable-bitmap": {
      source: "apache",
      extensions: ["pbm"]
    },
    "image/x-portable-graymap": {
      source: "apache",
      extensions: ["pgm"]
    },
    "image/x-portable-pixmap": {
      source: "apache",
      extensions: ["ppm"]
    },
    "image/x-rgb": {
      source: "apache",
      extensions: ["rgb"]
    },
    "image/x-tga": {
      source: "apache",
      extensions: ["tga"]
    },
    "image/x-xbitmap": {
      source: "apache",
      extensions: ["xbm"]
    },
    "image/x-xcf": {
      compressible: false
    },
    "image/x-xpixmap": {
      source: "apache",
      extensions: ["xpm"]
    },
    "image/x-xwindowdump": {
      source: "apache",
      extensions: ["xwd"]
    },
    "message/cpim": {
      source: "iana"
    },
    "message/delivery-status": {
      source: "iana"
    },
    "message/disposition-notification": {
      source: "iana",
      extensions: [
        "disposition-notification"
      ]
    },
    "message/external-body": {
      source: "iana"
    },
    "message/feedback-report": {
      source: "iana"
    },
    "message/global": {
      source: "iana",
      extensions: ["u8msg"]
    },
    "message/global-delivery-status": {
      source: "iana",
      extensions: ["u8dsn"]
    },
    "message/global-disposition-notification": {
      source: "iana",
      extensions: ["u8mdn"]
    },
    "message/global-headers": {
      source: "iana",
      extensions: ["u8hdr"]
    },
    "message/http": {
      source: "iana",
      compressible: false
    },
    "message/imdn+xml": {
      source: "iana",
      compressible: true
    },
    "message/news": {
      source: "iana"
    },
    "message/partial": {
      source: "iana",
      compressible: false
    },
    "message/rfc822": {
      source: "iana",
      compressible: true,
      extensions: ["eml", "mime"]
    },
    "message/s-http": {
      source: "iana"
    },
    "message/sip": {
      source: "iana"
    },
    "message/sipfrag": {
      source: "iana"
    },
    "message/tracking-status": {
      source: "iana"
    },
    "message/vnd.si.simp": {
      source: "iana"
    },
    "message/vnd.wfa.wsc": {
      source: "iana",
      extensions: ["wsc"]
    },
    "model/3mf": {
      source: "iana",
      extensions: ["3mf"]
    },
    "model/e57": {
      source: "iana"
    },
    "model/gltf+json": {
      source: "iana",
      compressible: true,
      extensions: ["gltf"]
    },
    "model/gltf-binary": {
      source: "iana",
      compressible: true,
      extensions: ["glb"]
    },
    "model/iges": {
      source: "iana",
      compressible: false,
      extensions: ["igs", "iges"]
    },
    "model/mesh": {
      source: "iana",
      compressible: false,
      extensions: ["msh", "mesh", "silo"]
    },
    "model/mtl": {
      source: "iana",
      extensions: ["mtl"]
    },
    "model/obj": {
      source: "iana",
      extensions: ["obj"]
    },
    "model/step": {
      source: "iana"
    },
    "model/step+xml": {
      source: "iana",
      compressible: true,
      extensions: ["stpx"]
    },
    "model/step+zip": {
      source: "iana",
      compressible: false,
      extensions: ["stpz"]
    },
    "model/step-xml+zip": {
      source: "iana",
      compressible: false,
      extensions: ["stpxz"]
    },
    "model/stl": {
      source: "iana",
      extensions: ["stl"]
    },
    "model/vnd.collada+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dae"]
    },
    "model/vnd.dwf": {
      source: "iana",
      extensions: ["dwf"]
    },
    "model/vnd.flatland.3dml": {
      source: "iana"
    },
    "model/vnd.gdl": {
      source: "iana",
      extensions: ["gdl"]
    },
    "model/vnd.gs-gdl": {
      source: "apache"
    },
    "model/vnd.gs.gdl": {
      source: "iana"
    },
    "model/vnd.gtw": {
      source: "iana",
      extensions: ["gtw"]
    },
    "model/vnd.moml+xml": {
      source: "iana",
      compressible: true
    },
    "model/vnd.mts": {
      source: "iana",
      extensions: ["mts"]
    },
    "model/vnd.opengex": {
      source: "iana",
      extensions: ["ogex"]
    },
    "model/vnd.parasolid.transmit.binary": {
      source: "iana",
      extensions: ["x_b"]
    },
    "model/vnd.parasolid.transmit.text": {
      source: "iana",
      extensions: ["x_t"]
    },
    "model/vnd.pytha.pyox": {
      source: "iana"
    },
    "model/vnd.rosette.annotated-data-model": {
      source: "iana"
    },
    "model/vnd.sap.vds": {
      source: "iana",
      extensions: ["vds"]
    },
    "model/vnd.usdz+zip": {
      source: "iana",
      compressible: false,
      extensions: ["usdz"]
    },
    "model/vnd.valve.source.compiled-map": {
      source: "iana",
      extensions: ["bsp"]
    },
    "model/vnd.vtu": {
      source: "iana",
      extensions: ["vtu"]
    },
    "model/vrml": {
      source: "iana",
      compressible: false,
      extensions: ["wrl", "vrml"]
    },
    "model/x3d+binary": {
      source: "apache",
      compressible: false,
      extensions: ["x3db", "x3dbz"]
    },
    "model/x3d+fastinfoset": {
      source: "iana",
      extensions: ["x3db"]
    },
    "model/x3d+vrml": {
      source: "apache",
      compressible: false,
      extensions: ["x3dv", "x3dvz"]
    },
    "model/x3d+xml": {
      source: "iana",
      compressible: true,
      extensions: ["x3d", "x3dz"]
    },
    "model/x3d-vrml": {
      source: "iana",
      extensions: ["x3dv"]
    },
    "multipart/alternative": {
      source: "iana",
      compressible: false
    },
    "multipart/appledouble": {
      source: "iana"
    },
    "multipart/byteranges": {
      source: "iana"
    },
    "multipart/digest": {
      source: "iana"
    },
    "multipart/encrypted": {
      source: "iana",
      compressible: false
    },
    "multipart/form-data": {
      source: "iana",
      compressible: false
    },
    "multipart/header-set": {
      source: "iana"
    },
    "multipart/mixed": {
      source: "iana"
    },
    "multipart/multilingual": {
      source: "iana"
    },
    "multipart/parallel": {
      source: "iana"
    },
    "multipart/related": {
      source: "iana",
      compressible: false
    },
    "multipart/report": {
      source: "iana"
    },
    "multipart/signed": {
      source: "iana",
      compressible: false
    },
    "multipart/vnd.bint.med-plus": {
      source: "iana"
    },
    "multipart/voice-message": {
      source: "iana"
    },
    "multipart/x-mixed-replace": {
      source: "iana"
    },
    "text/1d-interleaved-parityfec": {
      source: "iana"
    },
    "text/cache-manifest": {
      source: "iana",
      compressible: true,
      extensions: ["appcache", "manifest"]
    },
    "text/calendar": {
      source: "iana",
      extensions: ["ics", "ifb"]
    },
    "text/calender": {
      compressible: true
    },
    "text/cmd": {
      compressible: true
    },
    "text/coffeescript": {
      extensions: ["coffee", "litcoffee"]
    },
    "text/cql": {
      source: "iana"
    },
    "text/cql-expression": {
      source: "iana"
    },
    "text/cql-identifier": {
      source: "iana"
    },
    "text/css": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["css"]
    },
    "text/csv": {
      source: "iana",
      compressible: true,
      extensions: ["csv"]
    },
    "text/csv-schema": {
      source: "iana"
    },
    "text/directory": {
      source: "iana"
    },
    "text/dns": {
      source: "iana"
    },
    "text/ecmascript": {
      source: "iana"
    },
    "text/encaprtp": {
      source: "iana"
    },
    "text/enriched": {
      source: "iana"
    },
    "text/fhirpath": {
      source: "iana"
    },
    "text/flexfec": {
      source: "iana"
    },
    "text/fwdred": {
      source: "iana"
    },
    "text/gff3": {
      source: "iana"
    },
    "text/grammar-ref-list": {
      source: "iana"
    },
    "text/html": {
      source: "iana",
      compressible: true,
      extensions: ["html", "htm", "shtml"]
    },
    "text/jade": {
      extensions: ["jade"]
    },
    "text/javascript": {
      source: "iana",
      compressible: true
    },
    "text/jcr-cnd": {
      source: "iana"
    },
    "text/jsx": {
      compressible: true,
      extensions: ["jsx"]
    },
    "text/less": {
      compressible: true,
      extensions: ["less"]
    },
    "text/markdown": {
      source: "iana",
      compressible: true,
      extensions: ["markdown", "md"]
    },
    "text/mathml": {
      source: "nginx",
      extensions: ["mml"]
    },
    "text/mdx": {
      compressible: true,
      extensions: ["mdx"]
    },
    "text/mizar": {
      source: "iana"
    },
    "text/n3": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["n3"]
    },
    "text/parameters": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/parityfec": {
      source: "iana"
    },
    "text/plain": {
      source: "iana",
      compressible: true,
      extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"]
    },
    "text/provenance-notation": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/prs.fallenstein.rst": {
      source: "iana"
    },
    "text/prs.lines.tag": {
      source: "iana",
      extensions: ["dsc"]
    },
    "text/prs.prop.logic": {
      source: "iana"
    },
    "text/raptorfec": {
      source: "iana"
    },
    "text/red": {
      source: "iana"
    },
    "text/rfc822-headers": {
      source: "iana"
    },
    "text/richtext": {
      source: "iana",
      compressible: true,
      extensions: ["rtx"]
    },
    "text/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "text/rtp-enc-aescm128": {
      source: "iana"
    },
    "text/rtploopback": {
      source: "iana"
    },
    "text/rtx": {
      source: "iana"
    },
    "text/sgml": {
      source: "iana",
      extensions: ["sgml", "sgm"]
    },
    "text/shaclc": {
      source: "iana"
    },
    "text/shex": {
      source: "iana",
      extensions: ["shex"]
    },
    "text/slim": {
      extensions: ["slim", "slm"]
    },
    "text/spdx": {
      source: "iana",
      extensions: ["spdx"]
    },
    "text/strings": {
      source: "iana"
    },
    "text/stylus": {
      extensions: ["stylus", "styl"]
    },
    "text/t140": {
      source: "iana"
    },
    "text/tab-separated-values": {
      source: "iana",
      compressible: true,
      extensions: ["tsv"]
    },
    "text/troff": {
      source: "iana",
      extensions: ["t", "tr", "roff", "man", "me", "ms"]
    },
    "text/turtle": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["ttl"]
    },
    "text/ulpfec": {
      source: "iana"
    },
    "text/uri-list": {
      source: "iana",
      compressible: true,
      extensions: ["uri", "uris", "urls"]
    },
    "text/vcard": {
      source: "iana",
      compressible: true,
      extensions: ["vcard"]
    },
    "text/vnd.a": {
      source: "iana"
    },
    "text/vnd.abc": {
      source: "iana"
    },
    "text/vnd.ascii-art": {
      source: "iana"
    },
    "text/vnd.curl": {
      source: "iana",
      extensions: ["curl"]
    },
    "text/vnd.curl.dcurl": {
      source: "apache",
      extensions: ["dcurl"]
    },
    "text/vnd.curl.mcurl": {
      source: "apache",
      extensions: ["mcurl"]
    },
    "text/vnd.curl.scurl": {
      source: "apache",
      extensions: ["scurl"]
    },
    "text/vnd.debian.copyright": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.dmclientscript": {
      source: "iana"
    },
    "text/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "text/vnd.esmertec.theme-descriptor": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.familysearch.gedcom": {
      source: "iana",
      extensions: ["ged"]
    },
    "text/vnd.ficlab.flt": {
      source: "iana"
    },
    "text/vnd.fly": {
      source: "iana",
      extensions: ["fly"]
    },
    "text/vnd.fmi.flexstor": {
      source: "iana",
      extensions: ["flx"]
    },
    "text/vnd.gml": {
      source: "iana"
    },
    "text/vnd.graphviz": {
      source: "iana",
      extensions: ["gv"]
    },
    "text/vnd.hans": {
      source: "iana"
    },
    "text/vnd.hgl": {
      source: "iana"
    },
    "text/vnd.in3d.3dml": {
      source: "iana",
      extensions: ["3dml"]
    },
    "text/vnd.in3d.spot": {
      source: "iana",
      extensions: ["spot"]
    },
    "text/vnd.iptc.newsml": {
      source: "iana"
    },
    "text/vnd.iptc.nitf": {
      source: "iana"
    },
    "text/vnd.latex-z": {
      source: "iana"
    },
    "text/vnd.motorola.reflex": {
      source: "iana"
    },
    "text/vnd.ms-mediapackage": {
      source: "iana"
    },
    "text/vnd.net2phone.commcenter.command": {
      source: "iana"
    },
    "text/vnd.radisys.msml-basic-layout": {
      source: "iana"
    },
    "text/vnd.senx.warpscript": {
      source: "iana"
    },
    "text/vnd.si.uricatalogue": {
      source: "iana"
    },
    "text/vnd.sosi": {
      source: "iana"
    },
    "text/vnd.sun.j2me.app-descriptor": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["jad"]
    },
    "text/vnd.trolltech.linguist": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.wap.si": {
      source: "iana"
    },
    "text/vnd.wap.sl": {
      source: "iana"
    },
    "text/vnd.wap.wml": {
      source: "iana",
      extensions: ["wml"]
    },
    "text/vnd.wap.wmlscript": {
      source: "iana",
      extensions: ["wmls"]
    },
    "text/vtt": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["vtt"]
    },
    "text/x-asm": {
      source: "apache",
      extensions: ["s", "asm"]
    },
    "text/x-c": {
      source: "apache",
      extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"]
    },
    "text/x-component": {
      source: "nginx",
      extensions: ["htc"]
    },
    "text/x-fortran": {
      source: "apache",
      extensions: ["f", "for", "f77", "f90"]
    },
    "text/x-gwt-rpc": {
      compressible: true
    },
    "text/x-handlebars-template": {
      extensions: ["hbs"]
    },
    "text/x-java-source": {
      source: "apache",
      extensions: ["java"]
    },
    "text/x-jquery-tmpl": {
      compressible: true
    },
    "text/x-lua": {
      extensions: ["lua"]
    },
    "text/x-markdown": {
      compressible: true,
      extensions: ["mkd"]
    },
    "text/x-nfo": {
      source: "apache",
      extensions: ["nfo"]
    },
    "text/x-opml": {
      source: "apache",
      extensions: ["opml"]
    },
    "text/x-org": {
      compressible: true,
      extensions: ["org"]
    },
    "text/x-pascal": {
      source: "apache",
      extensions: ["p", "pas"]
    },
    "text/x-processing": {
      compressible: true,
      extensions: ["pde"]
    },
    "text/x-sass": {
      extensions: ["sass"]
    },
    "text/x-scss": {
      extensions: ["scss"]
    },
    "text/x-setext": {
      source: "apache",
      extensions: ["etx"]
    },
    "text/x-sfv": {
      source: "apache",
      extensions: ["sfv"]
    },
    "text/x-suse-ymp": {
      compressible: true,
      extensions: ["ymp"]
    },
    "text/x-uuencode": {
      source: "apache",
      extensions: ["uu"]
    },
    "text/x-vcalendar": {
      source: "apache",
      extensions: ["vcs"]
    },
    "text/x-vcard": {
      source: "apache",
      extensions: ["vcf"]
    },
    "text/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml"]
    },
    "text/xml-external-parsed-entity": {
      source: "iana"
    },
    "text/yaml": {
      compressible: true,
      extensions: ["yaml", "yml"]
    },
    "video/1d-interleaved-parityfec": {
      source: "iana"
    },
    "video/3gpp": {
      source: "iana",
      extensions: ["3gp", "3gpp"]
    },
    "video/3gpp-tt": {
      source: "iana"
    },
    "video/3gpp2": {
      source: "iana",
      extensions: ["3g2"]
    },
    "video/av1": {
      source: "iana"
    },
    "video/bmpeg": {
      source: "iana"
    },
    "video/bt656": {
      source: "iana"
    },
    "video/celb": {
      source: "iana"
    },
    "video/dv": {
      source: "iana"
    },
    "video/encaprtp": {
      source: "iana"
    },
    "video/ffv1": {
      source: "iana"
    },
    "video/flexfec": {
      source: "iana"
    },
    "video/h261": {
      source: "iana",
      extensions: ["h261"]
    },
    "video/h263": {
      source: "iana",
      extensions: ["h263"]
    },
    "video/h263-1998": {
      source: "iana"
    },
    "video/h263-2000": {
      source: "iana"
    },
    "video/h264": {
      source: "iana",
      extensions: ["h264"]
    },
    "video/h264-rcdo": {
      source: "iana"
    },
    "video/h264-svc": {
      source: "iana"
    },
    "video/h265": {
      source: "iana"
    },
    "video/iso.segment": {
      source: "iana",
      extensions: ["m4s"]
    },
    "video/jpeg": {
      source: "iana",
      extensions: ["jpgv"]
    },
    "video/jpeg2000": {
      source: "iana"
    },
    "video/jpm": {
      source: "apache",
      extensions: ["jpm", "jpgm"]
    },
    "video/jxsv": {
      source: "iana"
    },
    "video/mj2": {
      source: "iana",
      extensions: ["mj2", "mjp2"]
    },
    "video/mp1s": {
      source: "iana"
    },
    "video/mp2p": {
      source: "iana"
    },
    "video/mp2t": {
      source: "iana",
      extensions: ["ts"]
    },
    "video/mp4": {
      source: "iana",
      compressible: false,
      extensions: ["mp4", "mp4v", "mpg4"]
    },
    "video/mp4v-es": {
      source: "iana"
    },
    "video/mpeg": {
      source: "iana",
      compressible: false,
      extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
    },
    "video/mpeg4-generic": {
      source: "iana"
    },
    "video/mpv": {
      source: "iana"
    },
    "video/nv": {
      source: "iana"
    },
    "video/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["ogv"]
    },
    "video/parityfec": {
      source: "iana"
    },
    "video/pointer": {
      source: "iana"
    },
    "video/quicktime": {
      source: "iana",
      compressible: false,
      extensions: ["qt", "mov"]
    },
    "video/raptorfec": {
      source: "iana"
    },
    "video/raw": {
      source: "iana"
    },
    "video/rtp-enc-aescm128": {
      source: "iana"
    },
    "video/rtploopback": {
      source: "iana"
    },
    "video/rtx": {
      source: "iana"
    },
    "video/scip": {
      source: "iana"
    },
    "video/smpte291": {
      source: "iana"
    },
    "video/smpte292m": {
      source: "iana"
    },
    "video/ulpfec": {
      source: "iana"
    },
    "video/vc1": {
      source: "iana"
    },
    "video/vc2": {
      source: "iana"
    },
    "video/vnd.cctv": {
      source: "iana"
    },
    "video/vnd.dece.hd": {
      source: "iana",
      extensions: ["uvh", "uvvh"]
    },
    "video/vnd.dece.mobile": {
      source: "iana",
      extensions: ["uvm", "uvvm"]
    },
    "video/vnd.dece.mp4": {
      source: "iana"
    },
    "video/vnd.dece.pd": {
      source: "iana",
      extensions: ["uvp", "uvvp"]
    },
    "video/vnd.dece.sd": {
      source: "iana",
      extensions: ["uvs", "uvvs"]
    },
    "video/vnd.dece.video": {
      source: "iana",
      extensions: ["uvv", "uvvv"]
    },
    "video/vnd.directv.mpeg": {
      source: "iana"
    },
    "video/vnd.directv.mpeg-tts": {
      source: "iana"
    },
    "video/vnd.dlna.mpeg-tts": {
      source: "iana"
    },
    "video/vnd.dvb.file": {
      source: "iana",
      extensions: ["dvb"]
    },
    "video/vnd.fvt": {
      source: "iana",
      extensions: ["fvt"]
    },
    "video/vnd.hns.video": {
      source: "iana"
    },
    "video/vnd.iptvforum.1dparityfec-1010": {
      source: "iana"
    },
    "video/vnd.iptvforum.1dparityfec-2005": {
      source: "iana"
    },
    "video/vnd.iptvforum.2dparityfec-1010": {
      source: "iana"
    },
    "video/vnd.iptvforum.2dparityfec-2005": {
      source: "iana"
    },
    "video/vnd.iptvforum.ttsavc": {
      source: "iana"
    },
    "video/vnd.iptvforum.ttsmpeg2": {
      source: "iana"
    },
    "video/vnd.motorola.video": {
      source: "iana"
    },
    "video/vnd.motorola.videop": {
      source: "iana"
    },
    "video/vnd.mpegurl": {
      source: "iana",
      extensions: ["mxu", "m4u"]
    },
    "video/vnd.ms-playready.media.pyv": {
      source: "iana",
      extensions: ["pyv"]
    },
    "video/vnd.nokia.interleaved-multimedia": {
      source: "iana"
    },
    "video/vnd.nokia.mp4vr": {
      source: "iana"
    },
    "video/vnd.nokia.videovoip": {
      source: "iana"
    },
    "video/vnd.objectvideo": {
      source: "iana"
    },
    "video/vnd.radgamettools.bink": {
      source: "iana"
    },
    "video/vnd.radgamettools.smacker": {
      source: "iana"
    },
    "video/vnd.sealed.mpeg1": {
      source: "iana"
    },
    "video/vnd.sealed.mpeg4": {
      source: "iana"
    },
    "video/vnd.sealed.swf": {
      source: "iana"
    },
    "video/vnd.sealedmedia.softseal.mov": {
      source: "iana"
    },
    "video/vnd.uvvu.mp4": {
      source: "iana",
      extensions: ["uvu", "uvvu"]
    },
    "video/vnd.vivo": {
      source: "iana",
      extensions: ["viv"]
    },
    "video/vnd.youtube.yt": {
      source: "iana"
    },
    "video/vp8": {
      source: "iana"
    },
    "video/vp9": {
      source: "iana"
    },
    "video/webm": {
      source: "apache",
      compressible: false,
      extensions: ["webm"]
    },
    "video/x-f4v": {
      source: "apache",
      extensions: ["f4v"]
    },
    "video/x-fli": {
      source: "apache",
      extensions: ["fli"]
    },
    "video/x-flv": {
      source: "apache",
      compressible: false,
      extensions: ["flv"]
    },
    "video/x-m4v": {
      source: "apache",
      extensions: ["m4v"]
    },
    "video/x-matroska": {
      source: "apache",
      compressible: false,
      extensions: ["mkv", "mk3d", "mks"]
    },
    "video/x-mng": {
      source: "apache",
      extensions: ["mng"]
    },
    "video/x-ms-asf": {
      source: "apache",
      extensions: ["asf", "asx"]
    },
    "video/x-ms-vob": {
      source: "apache",
      extensions: ["vob"]
    },
    "video/x-ms-wm": {
      source: "apache",
      extensions: ["wm"]
    },
    "video/x-ms-wmv": {
      source: "apache",
      compressible: false,
      extensions: ["wmv"]
    },
    "video/x-ms-wmx": {
      source: "apache",
      extensions: ["wmx"]
    },
    "video/x-ms-wvx": {
      source: "apache",
      extensions: ["wvx"]
    },
    "video/x-msvideo": {
      source: "apache",
      extensions: ["avi"]
    },
    "video/x-sgi-movie": {
      source: "apache",
      extensions: ["movie"]
    },
    "video/x-smv": {
      source: "apache",
      extensions: ["smv"]
    },
    "x-conference/x-cooltalk": {
      source: "apache",
      extensions: ["ice"]
    },
    "x-shader/x-fragment": {
      compressible: true
    },
    "x-shader/x-vertex": {
      compressible: true
    }
  };
});

// node_modules/mime-db/index.js
var require_mime_db = __commonJS((exports, module) => {
  /*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015-2022 Douglas Christopher Wilson
   * MIT Licensed
   */
  module.exports = require_db();
});

// node_modules/mime-types/index.js
var require_mime_types = __commonJS((exports) => {
  /*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  var db = require_mime_db();
  var extname = __require("path").extname;
  var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
  var TEXT_TYPE_REGEXP = /^text\//i;
  exports.charset = charset;
  exports.charsets = { lookup: charset };
  exports.contentType = contentType;
  exports.extension = extension;
  exports.extensions = Object.create(null);
  exports.lookup = lookup;
  exports.types = Object.create(null);
  populateMaps(exports.extensions, exports.types);
  function charset(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var mime = match && db[match[1].toLowerCase()];
    if (mime && mime.charset) {
      return mime.charset;
    }
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
      return "UTF-8";
    }
    return false;
  }
  function contentType(str) {
    if (!str || typeof str !== "string") {
      return false;
    }
    var mime = str.indexOf("/") === -1 ? exports.lookup(str) : str;
    if (!mime) {
      return false;
    }
    if (mime.indexOf("charset") === -1) {
      var charset2 = exports.charset(mime);
      if (charset2)
        mime += "; charset=" + charset2.toLowerCase();
    }
    return mime;
  }
  function extension(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var exts = match && exports.extensions[match[1].toLowerCase()];
    if (!exts || !exts.length) {
      return false;
    }
    return exts[0];
  }
  function lookup(path) {
    if (!path || typeof path !== "string") {
      return false;
    }
    var extension2 = extname("x." + path).toLowerCase().substr(1);
    if (!extension2) {
      return false;
    }
    return exports.types[extension2] || false;
  }
  function populateMaps(extensions, types2) {
    var preference = ["nginx", "apache", undefined, "iana"];
    Object.keys(db).forEach(function forEachMimeType(type) {
      var mime = db[type];
      var exts = mime.extensions;
      if (!exts || !exts.length) {
        return;
      }
      extensions[type] = exts;
      for (var i = 0;i < exts.length; i++) {
        var extension2 = exts[i];
        if (types2[extension2]) {
          var from = preference.indexOf(db[types2[extension2]].source);
          var to = preference.indexOf(mime.source);
          if (types2[extension2] !== "application/octet-stream" && (from > to || from === to && types2[extension2].substr(0, 12) === "application/")) {
            continue;
          }
        }
        types2[extension2] = type;
      }
    });
  }
});

// node_modules/accepts/index.js
var require_accepts = __commonJS((exports, module) => {
  /*!
   * accepts
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  var Negotiator = require_negotiator();
  var mime = require_mime_types();
  module.exports = Accepts;
  function Accepts(req) {
    if (!(this instanceof Accepts)) {
      return new Accepts(req);
    }
    this.headers = req.headers;
    this.negotiator = new Negotiator(req);
  }
  Accepts.prototype.type = Accepts.prototype.types = function(types_) {
    var types2 = types_;
    if (types2 && !Array.isArray(types2)) {
      types2 = new Array(arguments.length);
      for (var i = 0;i < types2.length; i++) {
        types2[i] = arguments[i];
      }
    }
    if (!types2 || types2.length === 0) {
      return this.negotiator.mediaTypes();
    }
    if (!this.headers.accept) {
      return types2[0];
    }
    var mimes = types2.map(extToMime);
    var accepts = this.negotiator.mediaTypes(mimes.filter(validMime));
    var first = accepts[0];
    return first ? types2[mimes.indexOf(first)] : false;
  };
  Accepts.prototype.encoding = Accepts.prototype.encodings = function(encodings_) {
    var encodings = encodings_;
    if (encodings && !Array.isArray(encodings)) {
      encodings = new Array(arguments.length);
      for (var i = 0;i < encodings.length; i++) {
        encodings[i] = arguments[i];
      }
    }
    if (!encodings || encodings.length === 0) {
      return this.negotiator.encodings();
    }
    return this.negotiator.encodings(encodings)[0] || false;
  };
  Accepts.prototype.charset = Accepts.prototype.charsets = function(charsets_) {
    var charsets = charsets_;
    if (charsets && !Array.isArray(charsets)) {
      charsets = new Array(arguments.length);
      for (var i = 0;i < charsets.length; i++) {
        charsets[i] = arguments[i];
      }
    }
    if (!charsets || charsets.length === 0) {
      return this.negotiator.charsets();
    }
    return this.negotiator.charsets(charsets)[0] || false;
  };
  Accepts.prototype.lang = Accepts.prototype.langs = Accepts.prototype.language = Accepts.prototype.languages = function(languages_) {
    var languages = languages_;
    if (languages && !Array.isArray(languages)) {
      languages = new Array(arguments.length);
      for (var i = 0;i < languages.length; i++) {
        languages[i] = arguments[i];
      }
    }
    if (!languages || languages.length === 0) {
      return this.negotiator.languages();
    }
    return this.negotiator.languages(languages)[0] || false;
  };
  function extToMime(type) {
    return type.indexOf("/") === -1 ? mime.lookup(type) : type;
  }
  function validMime(type) {
    return typeof type === "string";
  }
});

// node_modules/base64id/lib/base64id.js
var require_base64id = __commonJS((exports, module) => {
  /*!
   * base64id v0.1.0
   */
  var crypto2 = __require("crypto");
  var Base64Id = function() {};
  Base64Id.prototype.getRandomBytes = function(bytes) {
    var BUFFER_SIZE = 4096;
    var self = this;
    bytes = bytes || 12;
    if (bytes > BUFFER_SIZE) {
      return crypto2.randomBytes(bytes);
    }
    var bytesInBuffer = parseInt(BUFFER_SIZE / bytes);
    var threshold = parseInt(bytesInBuffer * 0.85);
    if (!threshold) {
      return crypto2.randomBytes(bytes);
    }
    if (this.bytesBufferIndex == null) {
      this.bytesBufferIndex = -1;
    }
    if (this.bytesBufferIndex == bytesInBuffer) {
      this.bytesBuffer = null;
      this.bytesBufferIndex = -1;
    }
    if (this.bytesBufferIndex == -1 || this.bytesBufferIndex > threshold) {
      if (!this.isGeneratingBytes) {
        this.isGeneratingBytes = true;
        crypto2.randomBytes(BUFFER_SIZE, function(err, bytes2) {
          self.bytesBuffer = bytes2;
          self.bytesBufferIndex = 0;
          self.isGeneratingBytes = false;
        });
      }
      if (this.bytesBufferIndex == -1) {
        return crypto2.randomBytes(bytes);
      }
    }
    var result = this.bytesBuffer.slice(bytes * this.bytesBufferIndex, bytes * (this.bytesBufferIndex + 1));
    this.bytesBufferIndex++;
    return result;
  };
  Base64Id.prototype.generateId = function() {
    var rand = Buffer.alloc(15);
    if (!rand.writeInt32BE) {
      return Math.abs(Math.random() * Math.random() * Date.now() | 0).toString() + Math.abs(Math.random() * Math.random() * Date.now() | 0).toString();
    }
    this.sequenceNumber = this.sequenceNumber + 1 | 0;
    rand.writeInt32BE(this.sequenceNumber, 11);
    if (crypto2.randomBytes) {
      this.getRandomBytes(12).copy(rand);
    } else {
      [0, 4, 8].forEach(function(i) {
        rand.writeInt32BE(Math.random() * Math.pow(2, 32) | 0, i);
      });
    }
    return rand.toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
  };
  exports = module.exports = new Base64Id;
});

// node_modules/engine.io-parser/build/cjs/commons.js
var require_commons = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ERROR_PACKET = exports.PACKET_TYPES_REVERSE = exports.PACKET_TYPES = undefined;
  var PACKET_TYPES = Object.create(null);
  exports.PACKET_TYPES = PACKET_TYPES;
  PACKET_TYPES["open"] = "0";
  PACKET_TYPES["close"] = "1";
  PACKET_TYPES["ping"] = "2";
  PACKET_TYPES["pong"] = "3";
  PACKET_TYPES["message"] = "4";
  PACKET_TYPES["upgrade"] = "5";
  PACKET_TYPES["noop"] = "6";
  var PACKET_TYPES_REVERSE = Object.create(null);
  exports.PACKET_TYPES_REVERSE = PACKET_TYPES_REVERSE;
  Object.keys(PACKET_TYPES).forEach((key) => {
    PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
  });
  var ERROR_PACKET = { type: "error", data: "parser error" };
  exports.ERROR_PACKET = ERROR_PACKET;
});

// node_modules/engine.io-parser/build/cjs/encodePacket.js
var require_encodePacket = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.encodePacket = undefined;
  exports.encodePacketToBinary = encodePacketToBinary;
  var commons_js_1 = require_commons();
  var encodePacket = ({ type, data }, supportsBinary, callback) => {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return callback(supportsBinary ? data : "b" + toBuffer(data, true).toString("base64"));
    }
    return callback(commons_js_1.PACKET_TYPES[type] + (data || ""));
  };
  exports.encodePacket = encodePacket;
  var toBuffer = (data, forceBufferConversion) => {
    if (Buffer.isBuffer(data) || data instanceof Uint8Array && !forceBufferConversion) {
      return data;
    } else if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    } else {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
  };
  var TEXT_ENCODER;
  function encodePacketToBinary(packet, callback) {
    if (packet.data instanceof ArrayBuffer || ArrayBuffer.isView(packet.data)) {
      return callback(toBuffer(packet.data, false));
    }
    (0, exports.encodePacket)(packet, true, (encoded) => {
      if (!TEXT_ENCODER) {
        TEXT_ENCODER = new TextEncoder;
      }
      callback(TEXT_ENCODER.encode(encoded));
    });
  }
});

// node_modules/engine.io-parser/build/cjs/decodePacket.js
var require_decodePacket = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.decodePacket = undefined;
  var commons_js_1 = require_commons();
  var decodePacket = (encodedPacket, binaryType) => {
    if (typeof encodedPacket !== "string") {
      return {
        type: "message",
        data: mapBinary(encodedPacket, binaryType)
      };
    }
    const type = encodedPacket.charAt(0);
    if (type === "b") {
      const buffer = Buffer.from(encodedPacket.substring(1), "base64");
      return {
        type: "message",
        data: mapBinary(buffer, binaryType)
      };
    }
    if (!commons_js_1.PACKET_TYPES_REVERSE[type]) {
      return commons_js_1.ERROR_PACKET;
    }
    return encodedPacket.length > 1 ? {
      type: commons_js_1.PACKET_TYPES_REVERSE[type],
      data: encodedPacket.substring(1)
    } : {
      type: commons_js_1.PACKET_TYPES_REVERSE[type]
    };
  };
  exports.decodePacket = decodePacket;
  var mapBinary = (data, binaryType) => {
    switch (binaryType) {
      case "arraybuffer":
        if (data instanceof ArrayBuffer) {
          return data;
        } else if (Buffer.isBuffer(data)) {
          return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        } else {
          return data.buffer;
        }
      case "nodebuffer":
      default:
        if (Buffer.isBuffer(data)) {
          return data;
        } else {
          return Buffer.from(data);
        }
    }
  };
});

// node_modules/engine.io-parser/build/cjs/index.js
var require_cjs = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.decodePayload = exports.decodePacket = exports.encodePayload = exports.encodePacket = exports.protocol = undefined;
  exports.createPacketEncoderStream = createPacketEncoderStream;
  exports.createPacketDecoderStream = createPacketDecoderStream;
  var encodePacket_js_1 = require_encodePacket();
  Object.defineProperty(exports, "encodePacket", { enumerable: true, get: function() {
    return encodePacket_js_1.encodePacket;
  } });
  var decodePacket_js_1 = require_decodePacket();
  Object.defineProperty(exports, "decodePacket", { enumerable: true, get: function() {
    return decodePacket_js_1.decodePacket;
  } });
  var commons_js_1 = require_commons();
  var SEPARATOR = String.fromCharCode(30);
  var encodePayload = (packets, callback) => {
    const length = packets.length;
    const encodedPackets = new Array(length);
    let count = 0;
    packets.forEach((packet, i) => {
      (0, encodePacket_js_1.encodePacket)(packet, false, (encodedPacket) => {
        encodedPackets[i] = encodedPacket;
        if (++count === length) {
          callback(encodedPackets.join(SEPARATOR));
        }
      });
    });
  };
  exports.encodePayload = encodePayload;
  var decodePayload = (encodedPayload, binaryType) => {
    const encodedPackets = encodedPayload.split(SEPARATOR);
    const packets = [];
    for (let i = 0;i < encodedPackets.length; i++) {
      const decodedPacket = (0, decodePacket_js_1.decodePacket)(encodedPackets[i], binaryType);
      packets.push(decodedPacket);
      if (decodedPacket.type === "error") {
        break;
      }
    }
    return packets;
  };
  exports.decodePayload = decodePayload;
  function createPacketEncoderStream() {
    return new TransformStream({
      transform(packet, controller) {
        (0, encodePacket_js_1.encodePacketToBinary)(packet, (encodedPacket) => {
          const payloadLength = encodedPacket.length;
          let header;
          if (payloadLength < 126) {
            header = new Uint8Array(1);
            new DataView(header.buffer).setUint8(0, payloadLength);
          } else if (payloadLength < 65536) {
            header = new Uint8Array(3);
            const view = new DataView(header.buffer);
            view.setUint8(0, 126);
            view.setUint16(1, payloadLength);
          } else {
            header = new Uint8Array(9);
            const view = new DataView(header.buffer);
            view.setUint8(0, 127);
            view.setBigUint64(1, BigInt(payloadLength));
          }
          if (packet.data && typeof packet.data !== "string") {
            header[0] |= 128;
          }
          controller.enqueue(header);
          controller.enqueue(encodedPacket);
        });
      }
    });
  }
  var TEXT_DECODER;
  function totalLength(chunks) {
    return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  function concatChunks(chunks, size) {
    if (chunks[0].length === size) {
      return chunks.shift();
    }
    const buffer = new Uint8Array(size);
    let j = 0;
    for (let i = 0;i < size; i++) {
      buffer[i] = chunks[0][j++];
      if (j === chunks[0].length) {
        chunks.shift();
        j = 0;
      }
    }
    if (chunks.length && j < chunks[0].length) {
      chunks[0] = chunks[0].slice(j);
    }
    return buffer;
  }
  function createPacketDecoderStream(maxPayload, binaryType) {
    if (!TEXT_DECODER) {
      TEXT_DECODER = new TextDecoder;
    }
    const chunks = [];
    let state = 0;
    let expectedLength = -1;
    let isBinary = false;
    return new TransformStream({
      transform(chunk, controller) {
        chunks.push(chunk);
        while (true) {
          if (state === 0) {
            if (totalLength(chunks) < 1) {
              break;
            }
            const header = concatChunks(chunks, 1);
            isBinary = (header[0] & 128) === 128;
            expectedLength = header[0] & 127;
            if (expectedLength < 126) {
              state = 3;
            } else if (expectedLength === 126) {
              state = 1;
            } else {
              state = 2;
            }
          } else if (state === 1) {
            if (totalLength(chunks) < 2) {
              break;
            }
            const headerArray = concatChunks(chunks, 2);
            expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
            state = 3;
          } else if (state === 2) {
            if (totalLength(chunks) < 8) {
              break;
            }
            const headerArray = concatChunks(chunks, 8);
            const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
            const n = view.getUint32(0);
            if (n > Math.pow(2, 53 - 32) - 1) {
              controller.enqueue(commons_js_1.ERROR_PACKET);
              break;
            }
            expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
            state = 3;
          } else {
            if (totalLength(chunks) < expectedLength) {
              break;
            }
            const data = concatChunks(chunks, expectedLength);
            controller.enqueue((0, decodePacket_js_1.decodePacket)(isBinary ? data : TEXT_DECODER.decode(data), binaryType));
            state = 0;
          }
          if (expectedLength === 0 || expectedLength > maxPayload) {
            controller.enqueue(commons_js_1.ERROR_PACKET);
            break;
          }
        }
      }
    });
  }
  exports.protocol = 4;
});

// node_modules/engine.io/build/parser-v3/utf8.js
var require_utf8 = __commonJS((exports, module) => {
  /*! https://mths.be/utf8js v2.1.2 by @mathias */
  var stringFromCharCode = String.fromCharCode;
  function ucs2decode(string) {
    var output = [];
    var counter = 0;
    var length = string.length;
    var value;
    var extra;
    while (counter < length) {
      value = string.charCodeAt(counter++);
      if (value >= 55296 && value <= 56319 && counter < length) {
        extra = string.charCodeAt(counter++);
        if ((extra & 64512) == 56320) {
          output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
        } else {
          output.push(value);
          counter--;
        }
      } else {
        output.push(value);
      }
    }
    return output;
  }
  function ucs2encode(array) {
    var length = array.length;
    var index = -1;
    var value;
    var output = "";
    while (++index < length) {
      value = array[index];
      if (value > 65535) {
        value -= 65536;
        output += stringFromCharCode(value >>> 10 & 1023 | 55296);
        value = 56320 | value & 1023;
      }
      output += stringFromCharCode(value);
    }
    return output;
  }
  function checkScalarValue(codePoint, strict) {
    if (codePoint >= 55296 && codePoint <= 57343) {
      if (strict) {
        throw Error("Lone surrogate U+" + codePoint.toString(16).toUpperCase() + " is not a scalar value");
      }
      return false;
    }
    return true;
  }
  function createByte(codePoint, shift) {
    return stringFromCharCode(codePoint >> shift & 63 | 128);
  }
  function encodeCodePoint(codePoint, strict) {
    if ((codePoint & 4294967168) == 0) {
      return stringFromCharCode(codePoint);
    }
    var symbol = "";
    if ((codePoint & 4294965248) == 0) {
      symbol = stringFromCharCode(codePoint >> 6 & 31 | 192);
    } else if ((codePoint & 4294901760) == 0) {
      if (!checkScalarValue(codePoint, strict)) {
        codePoint = 65533;
      }
      symbol = stringFromCharCode(codePoint >> 12 & 15 | 224);
      symbol += createByte(codePoint, 6);
    } else if ((codePoint & 4292870144) == 0) {
      symbol = stringFromCharCode(codePoint >> 18 & 7 | 240);
      symbol += createByte(codePoint, 12);
      symbol += createByte(codePoint, 6);
    }
    symbol += stringFromCharCode(codePoint & 63 | 128);
    return symbol;
  }
  function utf8encode(string, opts) {
    opts = opts || {};
    var strict = opts.strict !== false;
    var codePoints = ucs2decode(string);
    var length = codePoints.length;
    var index = -1;
    var codePoint;
    var byteString = "";
    while (++index < length) {
      codePoint = codePoints[index];
      byteString += encodeCodePoint(codePoint, strict);
    }
    return byteString;
  }
  function readContinuationByte() {
    if (byteIndex >= byteCount) {
      throw Error("Invalid byte index");
    }
    var continuationByte = byteArray[byteIndex] & 255;
    byteIndex++;
    if ((continuationByte & 192) == 128) {
      return continuationByte & 63;
    }
    throw Error("Invalid continuation byte");
  }
  function decodeSymbol(strict) {
    var byte1;
    var byte2;
    var byte3;
    var byte4;
    var codePoint;
    if (byteIndex > byteCount) {
      throw Error("Invalid byte index");
    }
    if (byteIndex == byteCount) {
      return false;
    }
    byte1 = byteArray[byteIndex] & 255;
    byteIndex++;
    if ((byte1 & 128) == 0) {
      return byte1;
    }
    if ((byte1 & 224) == 192) {
      byte2 = readContinuationByte();
      codePoint = (byte1 & 31) << 6 | byte2;
      if (codePoint >= 128) {
        return codePoint;
      } else {
        throw Error("Invalid continuation byte");
      }
    }
    if ((byte1 & 240) == 224) {
      byte2 = readContinuationByte();
      byte3 = readContinuationByte();
      codePoint = (byte1 & 15) << 12 | byte2 << 6 | byte3;
      if (codePoint >= 2048) {
        return checkScalarValue(codePoint, strict) ? codePoint : 65533;
      } else {
        throw Error("Invalid continuation byte");
      }
    }
    if ((byte1 & 248) == 240) {
      byte2 = readContinuationByte();
      byte3 = readContinuationByte();
      byte4 = readContinuationByte();
      codePoint = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
      if (codePoint >= 65536 && codePoint <= 1114111) {
        return codePoint;
      }
    }
    throw Error("Invalid UTF-8 detected");
  }
  var byteArray;
  var byteCount;
  var byteIndex;
  function utf8decode(byteString, opts) {
    opts = opts || {};
    var strict = opts.strict !== false;
    byteArray = ucs2decode(byteString);
    byteCount = byteArray.length;
    byteIndex = 0;
    var codePoints = [];
    var tmp;
    while ((tmp = decodeSymbol(strict)) !== false) {
      codePoints.push(tmp);
    }
    return ucs2encode(codePoints);
  }
  module.exports = {
    version: "2.1.2",
    encode: utf8encode,
    decode: utf8decode
  };
});

// node_modules/engine.io/build/parser-v3/index.js
var require_parser_v3 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.packets = exports.protocol = undefined;
  exports.encodePacket = encodePacket;
  exports.encodeBase64Packet = encodeBase64Packet;
  exports.decodePacket = decodePacket;
  exports.decodeBase64Packet = decodeBase64Packet;
  exports.encodePayload = encodePayload;
  exports.decodePayload = decodePayload;
  exports.encodePayloadAsBinary = encodePayloadAsBinary;
  exports.decodePayloadAsBinary = decodePayloadAsBinary;
  var utf8 = require_utf8();
  exports.protocol = 3;
  var hasBinary = (packets) => {
    for (const packet of packets) {
      if (packet.data instanceof ArrayBuffer || ArrayBuffer.isView(packet.data)) {
        return true;
      }
    }
    return false;
  };
  exports.packets = {
    open: 0,
    close: 1,
    ping: 2,
    pong: 3,
    message: 4,
    upgrade: 5,
    noop: 6
  };
  var packetslist = Object.keys(exports.packets);
  var err = { type: "error", data: "parser error" };
  var EMPTY_BUFFER = Buffer.concat([]);
  function encodePacket(packet, supportsBinary, utf8encode, callback) {
    if (typeof supportsBinary === "function") {
      callback = supportsBinary;
      supportsBinary = null;
    }
    if (typeof utf8encode === "function") {
      callback = utf8encode;
      utf8encode = null;
    }
    if (Buffer.isBuffer(packet.data)) {
      return encodeBuffer(packet, supportsBinary, callback);
    } else if (packet.data && (packet.data.buffer || packet.data) instanceof ArrayBuffer) {
      return encodeBuffer({ type: packet.type, data: arrayBufferToBuffer(packet.data) }, supportsBinary, callback);
    }
    var encoded = exports.packets[packet.type];
    if (packet.data !== undefined) {
      encoded += utf8encode ? utf8.encode(String(packet.data), { strict: false }) : String(packet.data);
    }
    return callback("" + encoded);
  }
  function encodeBuffer(packet, supportsBinary, callback) {
    if (!supportsBinary) {
      return encodeBase64Packet(packet, callback);
    }
    var data = packet.data;
    var typeBuffer = Buffer.allocUnsafe(1);
    typeBuffer[0] = exports.packets[packet.type];
    return callback(Buffer.concat([typeBuffer, data]));
  }
  function encodeBase64Packet(packet, callback) {
    var data = Buffer.isBuffer(packet.data) ? packet.data : arrayBufferToBuffer(packet.data);
    var message = "b" + exports.packets[packet.type];
    message += data.toString("base64");
    return callback(message);
  }
  function decodePacket(data, binaryType, utf8decode) {
    if (data === undefined) {
      return err;
    }
    var type;
    if (typeof data === "string") {
      type = data.charAt(0);
      if (type === "b") {
        return decodeBase64Packet(data.slice(1), binaryType);
      }
      if (utf8decode) {
        data = tryDecode(data);
        if (data === false) {
          return err;
        }
      }
      if (Number(type) != type || !packetslist[type]) {
        return err;
      }
      if (data.length > 1) {
        return { type: packetslist[type], data: data.slice(1) };
      } else {
        return { type: packetslist[type] };
      }
    }
    if (binaryType === "arraybuffer") {
      var intArray = new Uint8Array(data);
      type = intArray[0];
      return { type: packetslist[type], data: intArray.buffer.slice(1) };
    }
    if (data instanceof ArrayBuffer) {
      data = arrayBufferToBuffer(data);
    }
    type = data[0];
    return { type: packetslist[type], data: data.slice(1) };
  }
  function tryDecode(data) {
    try {
      data = utf8.decode(data, { strict: false });
    } catch (e) {
      return false;
    }
    return data;
  }
  function decodeBase64Packet(msg, binaryType) {
    var type = packetslist[msg.charAt(0)];
    var data = Buffer.from(msg.slice(1), "base64");
    if (binaryType === "arraybuffer") {
      var abv = new Uint8Array(data.length);
      for (var i = 0;i < abv.length; i++) {
        abv[i] = data[i];
      }
      data = abv.buffer;
    }
    return { type, data };
  }
  function encodePayload(packets, supportsBinary, callback) {
    if (typeof supportsBinary === "function") {
      callback = supportsBinary;
      supportsBinary = null;
    }
    if (supportsBinary && hasBinary(packets)) {
      return encodePayloadAsBinary(packets, callback);
    }
    if (!packets.length) {
      return callback("0:");
    }
    function encodeOne(packet, doneCallback) {
      encodePacket(packet, supportsBinary, false, function(message) {
        doneCallback(null, setLengthHeader(message));
      });
    }
    map(packets, encodeOne, function(err2, results) {
      return callback(results.join(""));
    });
  }
  function setLengthHeader(message) {
    return message.length + ":" + message;
  }
  function map(ary, each, done) {
    const results = new Array(ary.length);
    let count = 0;
    for (let i = 0;i < ary.length; i++) {
      each(ary[i], (error, msg) => {
        results[i] = msg;
        if (++count === ary.length) {
          done(null, results);
        }
      });
    }
  }
  function decodePayload(data, binaryType, callback) {
    if (typeof data !== "string") {
      return decodePayloadAsBinary(data, binaryType, callback);
    }
    if (typeof binaryType === "function") {
      callback = binaryType;
      binaryType = null;
    }
    if (data === "") {
      return callback(err, 0, 1);
    }
    var length = "", n, msg, packet;
    for (var i = 0, l = data.length;i < l; i++) {
      var chr = data.charAt(i);
      if (chr !== ":") {
        length += chr;
        continue;
      }
      if (length === "" || length != (n = Number(length))) {
        return callback(err, 0, 1);
      }
      msg = data.slice(i + 1, i + 1 + n);
      if (length != msg.length) {
        return callback(err, 0, 1);
      }
      if (msg.length) {
        packet = decodePacket(msg, binaryType, false);
        if (err.type === packet.type && err.data === packet.data) {
          return callback(err, 0, 1);
        }
        var more = callback(packet, i + n, l);
        if (more === false)
          return;
      }
      i += n;
      length = "";
    }
    if (length !== "") {
      return callback(err, 0, 1);
    }
  }
  function bufferToString(buffer) {
    var str = "";
    for (var i = 0, l = buffer.length;i < l; i++) {
      str += String.fromCharCode(buffer[i]);
    }
    return str;
  }
  function stringToBuffer(string) {
    var buf = Buffer.allocUnsafe(string.length);
    for (var i = 0, l = string.length;i < l; i++) {
      buf.writeUInt8(string.charCodeAt(i), i);
    }
    return buf;
  }
  function arrayBufferToBuffer(data) {
    var length = data.byteLength || data.length;
    var offset = data.byteOffset || 0;
    return Buffer.from(data.buffer || data, offset, length);
  }
  function encodePayloadAsBinary(packets, callback) {
    if (!packets.length) {
      return callback(EMPTY_BUFFER);
    }
    map(packets, encodeOneBinaryPacket, function(err2, results) {
      return callback(Buffer.concat(results));
    });
  }
  function encodeOneBinaryPacket(p, doneCallback) {
    function onBinaryPacketEncode(packet) {
      var encodingLength = "" + packet.length;
      var sizeBuffer;
      if (typeof packet === "string") {
        sizeBuffer = Buffer.allocUnsafe(encodingLength.length + 2);
        sizeBuffer[0] = 0;
        for (var i = 0;i < encodingLength.length; i++) {
          sizeBuffer[i + 1] = parseInt(encodingLength[i], 10);
        }
        sizeBuffer[sizeBuffer.length - 1] = 255;
        return doneCallback(null, Buffer.concat([sizeBuffer, stringToBuffer(packet)]));
      }
      sizeBuffer = Buffer.allocUnsafe(encodingLength.length + 2);
      sizeBuffer[0] = 1;
      for (var i = 0;i < encodingLength.length; i++) {
        sizeBuffer[i + 1] = parseInt(encodingLength[i], 10);
      }
      sizeBuffer[sizeBuffer.length - 1] = 255;
      doneCallback(null, Buffer.concat([sizeBuffer, packet]));
    }
    encodePacket(p, true, true, onBinaryPacketEncode);
  }
  function decodePayloadAsBinary(data, binaryType, callback) {
    if (typeof binaryType === "function") {
      callback = binaryType;
      binaryType = null;
    }
    var bufferTail = data;
    var buffers = [];
    var i;
    while (bufferTail.length > 0) {
      var strLen = "";
      var isString = bufferTail[0] === 0;
      for (i = 1;; i++) {
        if (bufferTail[i] === 255)
          break;
        if (strLen.length > 310) {
          return callback(err, 0, 1);
        }
        strLen += "" + bufferTail[i];
      }
      bufferTail = bufferTail.slice(strLen.length + 1);
      var msgLength = parseInt(strLen, 10);
      var msg = bufferTail.slice(1, msgLength + 1);
      if (isString)
        msg = bufferToString(msg);
      buffers.push(msg);
      bufferTail = bufferTail.slice(msgLength + 1);
    }
    var total = buffers.length;
    for (i = 0;i < total; i++) {
      var buffer = buffers[i];
      callback(decodePacket(buffer, binaryType, true), i, total);
    }
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  }
});

// node_modules/engine.io/node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce2;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      let i;
      const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      const len = split.length;
      for (i = 0;i < len; i++) {
        if (!split[i]) {
          continue;
        }
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
        } else {
          createDebug.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      const namespaces = [
        ...createDebug.names.map(toNamespace),
        ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      if (name[name.length - 1] === "*") {
        return true;
      }
      let i;
      let len;
      for (i = 0, len = createDebug.skips.length;i < len; i++) {
        if (createDebug.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = createDebug.names.length;i < len; i++) {
        if (createDebug.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function toNamespace(regexp) {
      return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
    }
    function coerce2(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/engine.io/node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS((exports, module) => {
  module.exports = (flag, argv) => {
    argv = argv || process.argv;
    const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
    const pos = argv.indexOf(prefix + flag);
    const terminatorPos = argv.indexOf("--");
    return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
  };
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS((exports, module) => {
  var os = __require("os");
  var hasFlag = require_has_flag();
  var env = process.env;
  var forceColor;
  if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false")) {
    forceColor = false;
  } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
    forceColor = true;
  }
  if ("FORCE_COLOR" in env) {
    forceColor = env.FORCE_COLOR.length === 0 || parseInt(env.FORCE_COLOR, 10) !== 0;
  }
  function translateLevel(level) {
    if (level === 0) {
      return false;
    }
    return {
      level,
      hasBasic: true,
      has256: level >= 2,
      has16m: level >= 3
    };
  }
  function supportsColor(stream) {
    if (forceColor === false) {
      return 0;
    }
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
    if (stream && !stream.isTTY && forceColor !== true) {
      return 0;
    }
    const min = forceColor ? 1 : 0;
    if (process.platform === "win32") {
      const osRelease = os.release().split(".");
      if (Number(process.versions.node.split(".")[0]) >= 8 && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
        return Number(osRelease[2]) >= 14931 ? 3 : 2;
      }
      return 1;
    }
    if ("CI" in env) {
      if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI"].some((sign) => (sign in env)) || env.CI_NAME === "codeship") {
        return 1;
      }
      return min;
    }
    if ("TEAMCITY_VERSION" in env) {
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === "truecolor") {
      return 3;
    }
    if ("TERM_PROGRAM" in env) {
      const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (env.TERM_PROGRAM) {
        case "iTerm.app":
          return version >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
      return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
      return 1;
    }
    if ("COLORTERM" in env) {
      return 1;
    }
    if (env.TERM === "dumb") {
      return min;
    }
    return min;
  }
  function getSupportLevel(stream) {
    const level = supportsColor(stream);
    return translateLevel(level);
  }
  module.exports = {
    supportsColor: getSupportLevel,
    stdout: getSupportLevel(process.stdout),
    stderr: getSupportLevel(process.stderr)
  };
});

// node_modules/engine.io/node_modules/debug/src/node.js
var require_node = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util3 = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util3.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = require_supports_color();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util3.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts);
  };
});

// node_modules/engine.io/node_modules/debug/src/index.js
var require_src = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser();
  } else {
    module.exports = require_node();
  }
});

// node_modules/engine.io/build/transport.js
var require_transport = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Transport = undefined;
  var events_1 = __require("events");
  var parser_v4 = require_cjs();
  var parser_v3 = require_parser_v3();
  var debug_1 = require_src();
  var debug = (0, debug_1.default)("engine:transport");
  function noop() {}

  class Transport extends events_1.EventEmitter {
    get readyState() {
      return this._readyState;
    }
    set readyState(state) {
      debug("readyState updated from %s to %s (%s)", this._readyState, state, this.name);
      this._readyState = state;
    }
    constructor(req) {
      super();
      this.writable = false;
      this._readyState = "open";
      this.discarded = false;
      this.protocol = req._query.EIO === "4" ? 4 : 3;
      this.parser = this.protocol === 4 ? parser_v4 : parser_v3;
      this.supportsBinary = !(req._query && req._query.b64);
    }
    discard() {
      this.discarded = true;
    }
    onRequest(req) {}
    close(fn) {
      if (this.readyState === "closed" || this.readyState === "closing")
        return;
      this.readyState = "closing";
      this.doClose(fn || noop);
    }
    onError(msg, desc) {
      if (this.listeners("error").length) {
        const err = new Error(msg);
        err.type = "TransportError";
        err.description = desc;
        this.emit("error", err);
      } else {
        debug("ignored transport error %s (%s)", msg, desc);
      }
    }
    onPacket(packet) {
      this.emit("packet", packet);
    }
    onData(data) {
      this.onPacket(this.parser.decodePacket(data));
    }
    onClose() {
      this.readyState = "closed";
      this.emit("close");
    }
  }
  exports.Transport = Transport;
});

// node_modules/engine.io/build/transports/polling.js
var require_polling = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Polling = undefined;
  var transport_1 = require_transport();
  var zlib_1 = __require("zlib");
  var accepts = require_accepts();
  var debug_1 = require_src();
  var debug = (0, debug_1.default)("engine:polling");
  var compressionMethods = {
    gzip: zlib_1.createGzip,
    deflate: zlib_1.createDeflate
  };

  class Polling extends transport_1.Transport {
    constructor(req) {
      super(req);
      this.closeTimeout = 30 * 1000;
    }
    get name() {
      return "polling";
    }
    onRequest(req) {
      const res = req.res;
      req.res = null;
      if (req.method === "GET") {
        this.onPollRequest(req, res);
      } else if (req.method === "POST") {
        this.onDataRequest(req, res);
      } else {
        res.writeHead(500);
        res.end();
      }
    }
    onPollRequest(req, res) {
      if (this.req) {
        debug("request overlap");
        this.onError("overlap from client");
        res.writeHead(400);
        res.end();
        return;
      }
      debug("setting request");
      this.req = req;
      this.res = res;
      const onClose = () => {
        this.onError("poll connection closed prematurely");
      };
      const cleanup = () => {
        req.removeListener("close", onClose);
        this.req = this.res = null;
      };
      req.cleanup = cleanup;
      req.on("close", onClose);
      this.writable = true;
      this.emit("ready");
      if (this.writable && this.shouldClose) {
        debug("triggering empty send to append close packet");
        this.send([{ type: "noop" }]);
      }
    }
    onDataRequest(req, res) {
      if (this.dataReq) {
        this.onError("data request overlap from client");
        res.writeHead(400);
        res.end();
        return;
      }
      const isBinary = req.headers["content-type"] === "application/octet-stream";
      if (isBinary && this.protocol === 4) {
        return this.onError("invalid content");
      }
      this.dataReq = req;
      this.dataRes = res;
      let chunks = isBinary ? Buffer.concat([]) : "";
      const cleanup = () => {
        req.removeListener("data", onData);
        req.removeListener("end", onEnd);
        req.removeListener("close", onClose);
        this.dataReq = this.dataRes = chunks = null;
      };
      const onClose = () => {
        cleanup();
        this.onError("data request connection closed prematurely");
      };
      const onData = (data) => {
        let contentLength;
        if (isBinary) {
          chunks = Buffer.concat([chunks, data]);
          contentLength = chunks.length;
        } else {
          chunks += data;
          contentLength = Buffer.byteLength(chunks);
        }
        if (contentLength > this.maxHttpBufferSize) {
          res.writeHead(413).end();
          cleanup();
        }
      };
      const onEnd = () => {
        this.onData(chunks);
        const headers = {
          "Content-Type": "text/html",
          "Content-Length": "2"
        };
        res.writeHead(200, this.headers(req, headers));
        res.end("ok");
        cleanup();
      };
      req.on("close", onClose);
      if (!isBinary)
        req.setEncoding("utf8");
      req.on("data", onData);
      req.on("end", onEnd);
    }
    onData(data) {
      debug('received "%s"', data);
      const callback = (packet) => {
        if (packet.type === "close") {
          debug("got xhr close packet");
          this.onClose();
          return false;
        }
        this.onPacket(packet);
      };
      if (this.protocol === 3) {
        this.parser.decodePayload(data, callback);
      } else {
        this.parser.decodePayload(data).forEach(callback);
      }
    }
    onClose() {
      if (this.writable) {
        this.send([{ type: "noop" }]);
      }
      super.onClose();
    }
    send(packets) {
      this.writable = false;
      if (this.shouldClose) {
        debug("appending close packet to payload");
        packets.push({ type: "close" });
        this.shouldClose();
        this.shouldClose = null;
      }
      const doWrite = (data) => {
        const compress = packets.some((packet) => {
          return packet.options && packet.options.compress;
        });
        this.write(data, { compress });
      };
      if (this.protocol === 3) {
        this.parser.encodePayload(packets, this.supportsBinary, doWrite);
      } else {
        this.parser.encodePayload(packets, doWrite);
      }
    }
    write(data, options) {
      debug('writing "%s"', data);
      this.doWrite(data, options, () => {
        this.req.cleanup();
        this.emit("drain");
      });
    }
    doWrite(data, options, callback) {
      const isString = typeof data === "string";
      const contentType = isString ? "text/plain; charset=UTF-8" : "application/octet-stream";
      const headers = {
        "Content-Type": contentType
      };
      const respond = (data2) => {
        headers["Content-Length"] = typeof data2 === "string" ? Buffer.byteLength(data2) : data2.length;
        this.res.writeHead(200, this.headers(this.req, headers));
        this.res.end(data2);
        callback();
      };
      if (!this.httpCompression || !options.compress) {
        respond(data);
        return;
      }
      const len = isString ? Buffer.byteLength(data) : data.length;
      if (len < this.httpCompression.threshold) {
        respond(data);
        return;
      }
      const encoding = accepts(this.req).encodings(["gzip", "deflate"]);
      if (!encoding) {
        respond(data);
        return;
      }
      this.compress(data, encoding, (err, data2) => {
        if (err) {
          this.res.writeHead(500);
          this.res.end();
          callback(err);
          return;
        }
        headers["Content-Encoding"] = encoding;
        respond(data2);
      });
    }
    compress(data, encoding, callback) {
      debug("compressing");
      const buffers = [];
      let nread = 0;
      compressionMethods[encoding](this.httpCompression).on("error", callback).on("data", function(chunk) {
        buffers.push(chunk);
        nread += chunk.length;
      }).on("end", function() {
        callback(null, Buffer.concat(buffers, nread));
      }).end(data);
    }
    doClose(fn) {
      debug("closing");
      let closeTimeoutTimer;
      if (this.dataReq) {
        debug("aborting ongoing data request");
        this.dataReq.destroy();
      }
      const onClose = () => {
        clearTimeout(closeTimeoutTimer);
        fn();
        this.onClose();
      };
      if (this.writable) {
        debug("transport writable - closing right away");
        this.send([{ type: "close" }]);
        onClose();
      } else if (this.discarded) {
        debug("transport discarded - closing right away");
        onClose();
      } else {
        debug("transport not writable - buffering orderly close");
        this.shouldClose = onClose;
        closeTimeoutTimer = setTimeout(onClose, this.closeTimeout);
      }
    }
    headers(req, headers = {}) {
      const ua = req.headers["user-agent"];
      if (ua && (~ua.indexOf(";MSIE") || ~ua.indexOf("Trident/"))) {
        headers["X-XSS-Protection"] = "0";
      }
      headers["cache-control"] = "no-store";
      this.emit("headers", headers, req);
      return headers;
    }
  }
  exports.Polling = Polling;
});

// node_modules/engine.io/build/transports/polling-jsonp.js
var require_polling_jsonp = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.JSONP = undefined;
  var polling_1 = require_polling();
  var qs = __require("querystring");
  var rDoubleSlashes = /\\\\n/g;
  var rSlashes = /(\\)?\\n/g;

  class JSONP extends polling_1.Polling {
    constructor(req) {
      super(req);
      this.head = "___eio[" + (req._query.j || "").replace(/[^0-9]/g, "") + "](";
      this.foot = ");";
    }
    onData(data) {
      data = qs.parse(data).d;
      if (typeof data === "string") {
        data = data.replace(rSlashes, function(match, slashes) {
          return slashes ? match : `
`;
        });
        super.onData(data.replace(rDoubleSlashes, "\\n"));
      }
    }
    doWrite(data, options, callback) {
      const js = JSON.stringify(data).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      data = this.head + js + this.foot;
      super.doWrite(data, options, callback);
    }
  }
  exports.JSONP = JSONP;
});

// node_modules/engine.io/build/transports/websocket.js
var require_websocket = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WebSocket = undefined;
  var transport_1 = require_transport();
  var debug_1 = require_src();
  var debug = (0, debug_1.default)("engine:ws");

  class WebSocket extends transport_1.Transport {
    constructor(req) {
      super(req);
      this._doSend = (data) => {
        this.socket.send(data, this._onSent);
      };
      this._doSendLast = (data) => {
        this.socket.send(data, this._onSentLast);
      };
      this._onSent = (err) => {
        if (err) {
          this.onError("write error", err.stack);
        }
      };
      this._onSentLast = (err) => {
        if (err) {
          this.onError("write error", err.stack);
        } else {
          this.emit("drain");
          this.writable = true;
          this.emit("ready");
        }
      };
      this.socket = req.websocket;
      this.socket.on("message", (data, isBinary) => {
        const message = isBinary ? data : data.toString();
        debug('received "%s"', message);
        super.onData(message);
      });
      this.socket.once("close", this.onClose.bind(this));
      this.socket.on("error", this.onError.bind(this));
      this.writable = true;
      this.perMessageDeflate = null;
    }
    get name() {
      return "websocket";
    }
    get handlesUpgrades() {
      return true;
    }
    send(packets) {
      this.writable = false;
      for (let i = 0;i < packets.length; i++) {
        const packet = packets[i];
        const isLast = i + 1 === packets.length;
        if (this._canSendPreEncodedFrame(packet)) {
          this.socket._sender.sendFrame(packet.options.wsPreEncodedFrame, isLast ? this._onSentLast : this._onSent);
        } else {
          this.parser.encodePacket(packet, this.supportsBinary, isLast ? this._doSendLast : this._doSend);
        }
      }
    }
    _canSendPreEncodedFrame(packet) {
      var _a, _b, _c;
      return !this.perMessageDeflate && typeof ((_b = (_a = this.socket) === null || _a === undefined ? undefined : _a._sender) === null || _b === undefined ? undefined : _b.sendFrame) === "function" && ((_c = packet.options) === null || _c === undefined ? undefined : _c.wsPreEncodedFrame) !== undefined;
    }
    doClose(fn) {
      debug("closing");
      this.socket.close();
      fn && fn();
    }
  }
  exports.WebSocket = WebSocket;
});

// node_modules/engine.io/build/transports/webtransport.js
var require_webtransport = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WebTransport = undefined;
  var transport_1 = require_transport();
  var debug_1 = require_src();
  var engine_io_parser_1 = require_cjs();
  var debug = (0, debug_1.default)("engine:webtransport");

  class WebTransport extends transport_1.Transport {
    constructor(session, stream, reader) {
      super({ _query: { EIO: "4" } });
      this.session = session;
      const transformStream = (0, engine_io_parser_1.createPacketEncoderStream)();
      transformStream.readable.pipeTo(stream.writable).catch(() => {
        debug("the stream was closed");
      });
      this.writer = transformStream.writable.getWriter();
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              debug("session is closed");
              break;
            }
            debug("received chunk: %o", value);
            this.onPacket(value);
          }
        } catch (e) {
          debug("error while reading: %s", e.message);
        }
      })();
      session.closed.then(() => this.onClose());
      this.writable = true;
    }
    get name() {
      return "webtransport";
    }
    async send(packets) {
      this.writable = false;
      try {
        for (let i = 0;i < packets.length; i++) {
          const packet = packets[i];
          await this.writer.write(packet);
        }
      } catch (e) {
        debug("error while writing: %s", e.message);
      }
      this.emit("drain");
      this.writable = true;
      this.emit("ready");
    }
    doClose(fn) {
      debug("closing WebTransport session");
      this.session.close();
      fn && fn();
    }
  }
  exports.WebTransport = WebTransport;
});

// node_modules/engine.io/build/transports/index.js
var require_transports = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var polling_1 = require_polling();
  var polling_jsonp_1 = require_polling_jsonp();
  var websocket_1 = require_websocket();
  var webtransport_1 = require_webtransport();
  exports.default = {
    polling,
    websocket: websocket_1.WebSocket,
    webtransport: webtransport_1.WebTransport
  };
  function polling(req) {
    if (typeof req._query.j === "string") {
      return new polling_jsonp_1.JSONP(req);
    } else {
      return new polling_1.Polling(req);
    }
  }
  polling.upgradesTo = ["websocket", "webtransport"];
});

// node_modules/engine.io/build/socket.js
var require_socket = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Socket = undefined;
  var events_1 = __require("events");
  var debug_1 = require_src();
  var timers_1 = __require("timers");
  var debug = (0, debug_1.default)("engine:socket");

  class Socket extends events_1.EventEmitter {
    get readyState() {
      return this._readyState;
    }
    set readyState(state) {
      debug("readyState updated from %s to %s", this._readyState, state);
      this._readyState = state;
    }
    constructor(id, server, transport, req, protocol) {
      super();
      this._readyState = "opening";
      this.upgrading = false;
      this.upgraded = false;
      this.writeBuffer = [];
      this.packetsFn = [];
      this.sentCallbackFn = [];
      this.cleanupFn = [];
      this.id = id;
      this.server = server;
      this.request = req;
      this.protocol = protocol;
      if (req) {
        if (req.websocket && req.websocket._socket) {
          this.remoteAddress = req.websocket._socket.remoteAddress;
        } else {
          this.remoteAddress = req.connection.remoteAddress;
        }
      } else {}
      this.pingTimeoutTimer = null;
      this.pingIntervalTimer = null;
      this.setTransport(transport);
      this.onOpen();
    }
    onOpen() {
      this.readyState = "open";
      this.transport.sid = this.id;
      this.sendPacket("open", JSON.stringify({
        sid: this.id,
        upgrades: this.getAvailableUpgrades(),
        pingInterval: this.server.opts.pingInterval,
        pingTimeout: this.server.opts.pingTimeout,
        maxPayload: this.server.opts.maxHttpBufferSize
      }));
      if (this.server.opts.initialPacket) {
        this.sendPacket("message", this.server.opts.initialPacket);
      }
      this.emit("open");
      if (this.protocol === 3) {
        this.resetPingTimeout();
      } else {
        this.schedulePing();
      }
    }
    onPacket(packet) {
      if (this.readyState !== "open") {
        return debug("packet received with closed socket");
      }
      debug(`received packet ${packet.type}`);
      this.emit("packet", packet);
      switch (packet.type) {
        case "ping":
          if (this.transport.protocol !== 3) {
            this.onError(new Error("invalid heartbeat direction"));
            return;
          }
          debug("got ping");
          this.pingTimeoutTimer.refresh();
          this.sendPacket("pong");
          this.emit("heartbeat");
          break;
        case "pong":
          if (this.transport.protocol === 3) {
            this.onError(new Error("invalid heartbeat direction"));
            return;
          }
          debug("got pong");
          (0, timers_1.clearTimeout)(this.pingTimeoutTimer);
          this.pingIntervalTimer.refresh();
          this.emit("heartbeat");
          break;
        case "error":
          this.onClose("parse error");
          break;
        case "message":
          this.emit("data", packet.data);
          this.emit("message", packet.data);
          break;
      }
    }
    onError(err) {
      debug("transport error");
      this.onClose("transport error", err);
    }
    schedulePing() {
      this.pingIntervalTimer = (0, timers_1.setTimeout)(() => {
        debug("writing ping packet - expecting pong within %sms", this.server.opts.pingTimeout);
        this.sendPacket("ping");
        this.resetPingTimeout();
      }, this.server.opts.pingInterval);
    }
    resetPingTimeout() {
      (0, timers_1.clearTimeout)(this.pingTimeoutTimer);
      this.pingTimeoutTimer = (0, timers_1.setTimeout)(() => {
        if (this.readyState === "closed")
          return;
        this.onClose("ping timeout");
      }, this.protocol === 3 ? this.server.opts.pingInterval + this.server.opts.pingTimeout : this.server.opts.pingTimeout);
    }
    setTransport(transport) {
      const onError = this.onError.bind(this);
      const onReady = () => this.flush();
      const onPacket = this.onPacket.bind(this);
      const onDrain = this.onDrain.bind(this);
      const onClose = this.onClose.bind(this, "transport close");
      this.transport = transport;
      this.transport.once("error", onError);
      this.transport.on("ready", onReady);
      this.transport.on("packet", onPacket);
      this.transport.on("drain", onDrain);
      this.transport.once("close", onClose);
      this.cleanupFn.push(function() {
        transport.removeListener("error", onError);
        transport.removeListener("ready", onReady);
        transport.removeListener("packet", onPacket);
        transport.removeListener("drain", onDrain);
        transport.removeListener("close", onClose);
      });
    }
    onDrain() {
      if (this.sentCallbackFn.length > 0) {
        debug("executing batch send callback");
        const seqFn = this.sentCallbackFn.shift();
        if (seqFn) {
          for (let i = 0;i < seqFn.length; i++) {
            seqFn[i](this.transport);
          }
        }
      }
    }
    _maybeUpgrade(transport) {
      debug('might upgrade socket transport from "%s" to "%s"', this.transport.name, transport.name);
      this.upgrading = true;
      const upgradeTimeoutTimer = (0, timers_1.setTimeout)(() => {
        debug("client did not complete upgrade - closing transport");
        cleanup();
        if (transport.readyState === "open") {
          transport.close();
        }
      }, this.server.opts.upgradeTimeout);
      let checkIntervalTimer;
      const onPacket = (packet) => {
        if (packet.type === "ping" && packet.data === "probe") {
          debug("got probe ping packet, sending pong");
          transport.send([{ type: "pong", data: "probe" }]);
          this.emit("upgrading", transport);
          clearInterval(checkIntervalTimer);
          checkIntervalTimer = setInterval(check, 100);
        } else if (packet.type === "upgrade" && this.readyState !== "closed") {
          debug("got upgrade packet - upgrading");
          cleanup();
          this.transport.discard();
          this.upgraded = true;
          this.clearTransport();
          this.setTransport(transport);
          this.emit("upgrade", transport);
          this.flush();
          if (this.readyState === "closing") {
            transport.close(() => {
              this.onClose("forced close");
            });
          }
        } else {
          cleanup();
          transport.close();
        }
      };
      const check = () => {
        if (this.transport.name === "polling" && this.transport.writable) {
          debug("writing a noop packet to polling for fast upgrade");
          this.transport.send([{ type: "noop" }]);
        }
      };
      const cleanup = () => {
        this.upgrading = false;
        clearInterval(checkIntervalTimer);
        (0, timers_1.clearTimeout)(upgradeTimeoutTimer);
        transport.removeListener("packet", onPacket);
        transport.removeListener("close", onTransportClose);
        transport.removeListener("error", onError);
        this.removeListener("close", onClose);
      };
      const onError = (err) => {
        debug("client did not complete upgrade - %s", err);
        cleanup();
        transport.close();
        transport = null;
      };
      const onTransportClose = () => {
        onError("transport closed");
      };
      const onClose = () => {
        onError("socket closed");
      };
      transport.on("packet", onPacket);
      transport.once("close", onTransportClose);
      transport.once("error", onError);
      this.once("close", onClose);
    }
    clearTransport() {
      let cleanup;
      const toCleanUp = this.cleanupFn.length;
      for (let i = 0;i < toCleanUp; i++) {
        cleanup = this.cleanupFn.shift();
        cleanup();
      }
      this.transport.on("error", function() {
        debug("error triggered by discarded transport");
      });
      this.transport.close();
      (0, timers_1.clearTimeout)(this.pingTimeoutTimer);
    }
    onClose(reason, description) {
      if (this.readyState !== "closed") {
        this.readyState = "closed";
        (0, timers_1.clearTimeout)(this.pingIntervalTimer);
        (0, timers_1.clearTimeout)(this.pingTimeoutTimer);
        process.nextTick(() => {
          this.writeBuffer = [];
        });
        this.packetsFn = [];
        this.sentCallbackFn = [];
        this.clearTransport();
        this.emit("close", reason, description);
      }
    }
    send(data, options, callback) {
      this.sendPacket("message", data, options, callback);
      return this;
    }
    write(data, options, callback) {
      this.sendPacket("message", data, options, callback);
      return this;
    }
    sendPacket(type, data, options = {}, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (this.readyState !== "closing" && this.readyState !== "closed") {
        debug('sending packet "%s" (%s)', type, data);
        options.compress = options.compress !== false;
        const packet = {
          type,
          options
        };
        if (data)
          packet.data = data;
        this.emit("packetCreate", packet);
        this.writeBuffer.push(packet);
        if (typeof callback === "function")
          this.packetsFn.push(callback);
        this.flush();
      }
    }
    flush() {
      if (this.readyState !== "closed" && this.transport.writable && this.writeBuffer.length) {
        debug("flushing buffer to transport");
        this.emit("flush", this.writeBuffer);
        this.server.emit("flush", this, this.writeBuffer);
        const wbuf = this.writeBuffer;
        this.writeBuffer = [];
        if (this.packetsFn.length) {
          this.sentCallbackFn.push(this.packetsFn);
          this.packetsFn = [];
        } else {
          this.sentCallbackFn.push(null);
        }
        this.transport.send(wbuf);
        this.emit("drain");
        this.server.emit("drain", this);
      }
    }
    getAvailableUpgrades() {
      const availableUpgrades = [];
      const allUpgrades = this.server.upgrades(this.transport.name);
      for (let i = 0;i < allUpgrades.length; ++i) {
        const upg = allUpgrades[i];
        if (this.server.opts.transports.indexOf(upg) !== -1) {
          availableUpgrades.push(upg);
        }
      }
      return availableUpgrades;
    }
    close(discard) {
      if (discard && (this.readyState === "open" || this.readyState === "closing")) {
        return this.closeTransport(discard);
      }
      if (this.readyState !== "open")
        return;
      this.readyState = "closing";
      if (this.writeBuffer.length) {
        debug("there are %d remaining packets in the buffer, waiting for the 'drain' event", this.writeBuffer.length);
        this.once("drain", () => {
          debug("all packets have been sent, closing the transport");
          this.closeTransport(discard);
        });
        return;
      }
      debug("the buffer is empty, closing the transport right away");
      this.closeTransport(discard);
    }
    closeTransport(discard) {
      debug("closing the transport (discard? %s)", !!discard);
      if (discard)
        this.transport.discard();
      this.transport.close(this.onClose.bind(this, "forced close"));
    }
  }
  exports.Socket = Socket;
});

// node_modules/engine.io/node_modules/cookie/index.js
var require_cookie = __commonJS((exports) => {
  /*!
   * cookie
   * Copyright(c) 2012-2014 Roman Shtylman
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  exports.parse = parse;
  exports.serialize = serialize;
  var __toString = Object.prototype.toString;
  var __hasOwnProperty = Object.prototype.hasOwnProperty;
  var cookieNameRegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  var cookieValueRegExp = /^("?)[\u0021\u0023-\u002B\u002D-\u003A\u003C-\u005B\u005D-\u007E]*\1$/;
  var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
  function parse(str, opt) {
    if (typeof str !== "string") {
      throw new TypeError("argument str must be a string");
    }
    var obj = {};
    var len = str.length;
    if (len < 2)
      return obj;
    var dec = opt && opt.decode || decode;
    var index = 0;
    var eqIdx = 0;
    var endIdx = 0;
    do {
      eqIdx = str.indexOf("=", index);
      if (eqIdx === -1)
        break;
      endIdx = str.indexOf(";", index);
      if (endIdx === -1) {
        endIdx = len;
      } else if (eqIdx > endIdx) {
        index = str.lastIndexOf(";", eqIdx - 1) + 1;
        continue;
      }
      var keyStartIdx = startIndex(str, index, eqIdx);
      var keyEndIdx = endIndex(str, eqIdx, keyStartIdx);
      var key = str.slice(keyStartIdx, keyEndIdx);
      if (!__hasOwnProperty.call(obj, key)) {
        var valStartIdx = startIndex(str, eqIdx + 1, endIdx);
        var valEndIdx = endIndex(str, endIdx, valStartIdx);
        if (str.charCodeAt(valStartIdx) === 34 && str.charCodeAt(valEndIdx - 1) === 34) {
          valStartIdx++;
          valEndIdx--;
        }
        var val = str.slice(valStartIdx, valEndIdx);
        obj[key] = tryDecode(val, dec);
      }
      index = endIdx + 1;
    } while (index < len);
    return obj;
  }
  function startIndex(str, index, max) {
    do {
      var code = str.charCodeAt(index);
      if (code !== 32 && code !== 9)
        return index;
    } while (++index < max);
    return max;
  }
  function endIndex(str, index, min) {
    while (index > min) {
      var code = str.charCodeAt(--index);
      if (code !== 32 && code !== 9)
        return index + 1;
    }
    return min;
  }
  function serialize(name, val, opt) {
    var enc = opt && opt.encode || encodeURIComponent;
    if (typeof enc !== "function") {
      throw new TypeError("option encode is invalid");
    }
    if (!cookieNameRegExp.test(name)) {
      throw new TypeError("argument name is invalid");
    }
    var value = enc(val);
    if (!cookieValueRegExp.test(value)) {
      throw new TypeError("argument val is invalid");
    }
    var str = name + "=" + value;
    if (!opt)
      return str;
    if (opt.maxAge != null) {
      var maxAge = Math.floor(opt.maxAge);
      if (!isFinite(maxAge)) {
        throw new TypeError("option maxAge is invalid");
      }
      str += "; Max-Age=" + maxAge;
    }
    if (opt.domain) {
      if (!domainValueRegExp.test(opt.domain)) {
        throw new TypeError("option domain is invalid");
      }
      str += "; Domain=" + opt.domain;
    }
    if (opt.path) {
      if (!pathValueRegExp.test(opt.path)) {
        throw new TypeError("option path is invalid");
      }
      str += "; Path=" + opt.path;
    }
    if (opt.expires) {
      var expires = opt.expires;
      if (!isDate(expires) || isNaN(expires.valueOf())) {
        throw new TypeError("option expires is invalid");
      }
      str += "; Expires=" + expires.toUTCString();
    }
    if (opt.httpOnly) {
      str += "; HttpOnly";
    }
    if (opt.secure) {
      str += "; Secure";
    }
    if (opt.partitioned) {
      str += "; Partitioned";
    }
    if (opt.priority) {
      var priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
      switch (priority) {
        case "low":
          str += "; Priority=Low";
          break;
        case "medium":
          str += "; Priority=Medium";
          break;
        case "high":
          str += "; Priority=High";
          break;
        default:
          throw new TypeError("option priority is invalid");
      }
    }
    if (opt.sameSite) {
      var sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
      switch (sameSite) {
        case true:
          str += "; SameSite=Strict";
          break;
        case "lax":
          str += "; SameSite=Lax";
          break;
        case "strict":
          str += "; SameSite=Strict";
          break;
        case "none":
          str += "; SameSite=None";
          break;
        default:
          throw new TypeError("option sameSite is invalid");
      }
    }
    return str;
  }
  function decode(str) {
    return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
  }
  function isDate(val) {
    return __toString.call(val) === "[object Date]";
  }
  function tryDecode(str, decode2) {
    try {
      return decode2(str);
    } catch (e) {
      return str;
    }
  }
});

// node_modules/ws/lib/constants.js
var require_constants = __commonJS((exports, module) => {
  module.exports = {
    BINARY_TYPES: ["nodebuffer", "arraybuffer", "fragments"],
    EMPTY_BUFFER: Buffer.alloc(0),
    GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
    kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
    kListener: Symbol("kListener"),
    kStatusCode: Symbol("status-code"),
    kWebSocket: Symbol("websocket"),
    NOOP: () => {}
  };
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS((exports, module) => {
  var { EMPTY_BUFFER } = require_constants();
  var FastBuffer = Buffer[Symbol.species];
  function concat(list, totalLength) {
    if (list.length === 0)
      return EMPTY_BUFFER;
    if (list.length === 1)
      return list[0];
    const target = Buffer.allocUnsafe(totalLength);
    let offset = 0;
    for (let i = 0;i < list.length; i++) {
      const buf = list[i];
      target.set(buf, offset);
      offset += buf.length;
    }
    if (offset < totalLength) {
      return new FastBuffer(target.buffer, target.byteOffset, offset);
    }
    return target;
  }
  function _mask(source, mask, output, offset, length) {
    for (let i = 0;i < length; i++) {
      output[offset + i] = source[i] ^ mask[i & 3];
    }
  }
  function _unmask(buffer, mask) {
    for (let i = 0;i < buffer.length; i++) {
      buffer[i] ^= mask[i & 3];
    }
  }
  function toArrayBuffer(buf) {
    if (buf.length === buf.buffer.byteLength) {
      return buf.buffer;
    }
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  }
  function toBuffer(data) {
    toBuffer.readOnly = true;
    if (Buffer.isBuffer(data))
      return data;
    let buf;
    if (data instanceof ArrayBuffer) {
      buf = new FastBuffer(data);
    } else if (ArrayBuffer.isView(data)) {
      buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
    } else {
      buf = Buffer.from(data);
      toBuffer.readOnly = false;
    }
    return buf;
  }
  module.exports = {
    concat,
    mask: _mask,
    toArrayBuffer,
    toBuffer,
    unmask: _unmask
  };
  if (!process.env.WS_NO_BUFFER_UTIL) {
    try {
      const bufferUtil = (()=>{throw new Error("Cannot require module "+"bufferutil");})();
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 48)
          _mask(source, mask, output, offset, length);
        else
          bufferUtil.mask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 32)
          _unmask(buffer, mask);
        else
          bufferUtil.unmask(buffer, mask);
      };
    } catch (e) {}
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS((exports, module) => {
  var kDone = Symbol("kDone");
  var kRun = Symbol("kRun");

  class Limiter {
    constructor(concurrency) {
      this[kDone] = () => {
        this.pending--;
        this[kRun]();
      };
      this.concurrency = concurrency || Infinity;
      this.jobs = [];
      this.pending = 0;
    }
    add(job) {
      this.jobs.push(job);
      this[kRun]();
    }
    [kRun]() {
      if (this.pending === this.concurrency)
        return;
      if (this.jobs.length) {
        const job = this.jobs.shift();
        this.pending++;
        job(this[kDone]);
      }
    }
  }
  module.exports = Limiter;
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS((exports, module) => {
  var zlib = __require("zlib");
  var bufferUtil = require_buffer_util();
  var Limiter = require_limiter();
  var { kStatusCode } = require_constants();
  var FastBuffer = Buffer[Symbol.species];
  var TRAILER = Buffer.from([0, 0, 255, 255]);
  var kPerMessageDeflate = Symbol("permessage-deflate");
  var kTotalLength = Symbol("total-length");
  var kCallback = Symbol("callback");
  var kBuffers = Symbol("buffers");
  var kError = Symbol("error");
  var zlibLimiter;

  class PerMessageDeflate {
    constructor(options, isServer, maxPayload) {
      this._maxPayload = maxPayload | 0;
      this._options = options || {};
      this._threshold = this._options.threshold !== undefined ? this._options.threshold : 1024;
      this._isServer = !!isServer;
      this._deflate = null;
      this._inflate = null;
      this.params = null;
      if (!zlibLimiter) {
        const concurrency = this._options.concurrencyLimit !== undefined ? this._options.concurrencyLimit : 10;
        zlibLimiter = new Limiter(concurrency);
      }
    }
    static get extensionName() {
      return "permessage-deflate";
    }
    offer() {
      const params = {};
      if (this._options.serverNoContextTakeover) {
        params.server_no_context_takeover = true;
      }
      if (this._options.clientNoContextTakeover) {
        params.client_no_context_takeover = true;
      }
      if (this._options.serverMaxWindowBits) {
        params.server_max_window_bits = this._options.serverMaxWindowBits;
      }
      if (this._options.clientMaxWindowBits) {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      } else if (this._options.clientMaxWindowBits == null) {
        params.client_max_window_bits = true;
      }
      return params;
    }
    accept(configurations) {
      configurations = this.normalizeParams(configurations);
      this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
      return this.params;
    }
    cleanup() {
      if (this._inflate) {
        this._inflate.close();
        this._inflate = null;
      }
      if (this._deflate) {
        const callback = this._deflate[kCallback];
        this._deflate.close();
        this._deflate = null;
        if (callback) {
          callback(new Error("The deflate stream was closed while data was being processed"));
        }
      }
    }
    acceptAsServer(offers) {
      const opts = this._options;
      const accepted = offers.find((params) => {
        if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
          return false;
        }
        return true;
      });
      if (!accepted) {
        throw new Error("None of the extension offers can be accepted");
      }
      if (opts.serverNoContextTakeover) {
        accepted.server_no_context_takeover = true;
      }
      if (opts.clientNoContextTakeover) {
        accepted.client_no_context_takeover = true;
      }
      if (typeof opts.serverMaxWindowBits === "number") {
        accepted.server_max_window_bits = opts.serverMaxWindowBits;
      }
      if (typeof opts.clientMaxWindowBits === "number") {
        accepted.client_max_window_bits = opts.clientMaxWindowBits;
      } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
        delete accepted.client_max_window_bits;
      }
      return accepted;
    }
    acceptAsClient(response) {
      const params = response[0];
      if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
        throw new Error('Unexpected parameter "client_no_context_takeover"');
      }
      if (!params.client_max_window_bits) {
        if (typeof this._options.clientMaxWindowBits === "number") {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        }
      } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
        throw new Error('Unexpected or invalid parameter "client_max_window_bits"');
      }
      return params;
    }
    normalizeParams(configurations) {
      configurations.forEach((params) => {
        Object.keys(params).forEach((key) => {
          let value = params[key];
          if (value.length > 1) {
            throw new Error(`Parameter "${key}" must have only a single value`);
          }
          value = value[0];
          if (key === "client_max_window_bits") {
            if (value !== true) {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
              }
              value = num;
            } else if (!this._isServer) {
              throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
            }
          } else if (key === "server_max_window_bits") {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
            }
            value = num;
          } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
            if (value !== true) {
              throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
            }
          } else {
            throw new Error(`Unknown parameter "${key}"`);
          }
          params[key] = value;
        });
      });
      return configurations;
    }
    decompress(data, fin, callback) {
      zlibLimiter.add((done) => {
        this._decompress(data, fin, (err, result) => {
          done();
          callback(err, result);
        });
      });
    }
    compress(data, fin, callback) {
      zlibLimiter.add((done) => {
        this._compress(data, fin, (err, result) => {
          done();
          callback(err, result);
        });
      });
    }
    _decompress(data, fin, callback) {
      const endpoint = this._isServer ? "client" : "server";
      if (!this._inflate) {
        const key = `${endpoint}_max_window_bits`;
        const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
        this._inflate = zlib.createInflateRaw({
          ...this._options.zlibInflateOptions,
          windowBits
        });
        this._inflate[kPerMessageDeflate] = this;
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];
        this._inflate.on("error", inflateOnError);
        this._inflate.on("data", inflateOnData);
      }
      this._inflate[kCallback] = callback;
      this._inflate.write(data);
      if (fin)
        this._inflate.write(TRAILER);
      this._inflate.flush(() => {
        const err = this._inflate[kError];
        if (err) {
          this._inflate.close();
          this._inflate = null;
          callback(err);
          return;
        }
        const data2 = bufferUtil.concat(this._inflate[kBuffers], this._inflate[kTotalLength]);
        if (this._inflate._readableState.endEmitted) {
          this._inflate.close();
          this._inflate = null;
        } else {
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._inflate.reset();
          }
        }
        callback(null, data2);
      });
    }
    _compress(data, fin, callback) {
      const endpoint = this._isServer ? "server" : "client";
      if (!this._deflate) {
        const key = `${endpoint}_max_window_bits`;
        const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
        this._deflate = zlib.createDeflateRaw({
          ...this._options.zlibDeflateOptions,
          windowBits
        });
        this._deflate[kTotalLength] = 0;
        this._deflate[kBuffers] = [];
        this._deflate.on("data", deflateOnData);
      }
      this._deflate[kCallback] = callback;
      this._deflate.write(data);
      this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
        if (!this._deflate) {
          return;
        }
        let data2 = bufferUtil.concat(this._deflate[kBuffers], this._deflate[kTotalLength]);
        if (fin) {
          data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
        }
        this._deflate[kCallback] = null;
        this._deflate[kTotalLength] = 0;
        this._deflate[kBuffers] = [];
        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._deflate.reset();
        }
        callback(null, data2);
      });
    }
  }
  module.exports = PerMessageDeflate;
  function deflateOnData(chunk) {
    this[kBuffers].push(chunk);
    this[kTotalLength] += chunk.length;
  }
  function inflateOnData(chunk) {
    this[kTotalLength] += chunk.length;
    if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
      this[kBuffers].push(chunk);
      return;
    }
    this[kError] = new RangeError("Max payload size exceeded");
    this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
    this[kError][kStatusCode] = 1009;
    this.removeListener("data", inflateOnData);
    this.reset();
  }
  function inflateOnError(err) {
    this[kPerMessageDeflate]._inflate = null;
    err[kStatusCode] = 1007;
    this[kCallback](err);
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS((exports, module) => {
  var { isUtf8 } = __require("buffer");
  var tokenChars = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    1,
    0,
    1,
    0
  ];
  function isValidStatusCode(code) {
    return code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3000 && code <= 4999;
  }
  function _isValidUTF8(buf) {
    const len = buf.length;
    let i = 0;
    while (i < len) {
      if ((buf[i] & 128) === 0) {
        i++;
      } else if ((buf[i] & 224) === 192) {
        if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
          return false;
        }
        i += 2;
      } else if ((buf[i] & 240) === 224) {
        if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || buf[i] === 237 && (buf[i + 1] & 224) === 160) {
          return false;
        }
        i += 3;
      } else if ((buf[i] & 248) === 240) {
        if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
          return false;
        }
        i += 4;
      } else {
        return false;
      }
    }
    return true;
  }
  module.exports = {
    isValidStatusCode,
    isValidUTF8: _isValidUTF8,
    tokenChars
  };
  if (isUtf8) {
    module.exports.isValidUTF8 = function(buf) {
      return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
    };
  } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
    try {
      const isValidUTF8 = (()=>{throw new Error("Cannot require module "+"utf-8-validate");})();
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
      };
    } catch (e) {}
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS((exports, module) => {
  var { Writable } = __require("stream");
  var PerMessageDeflate = require_permessage_deflate();
  var {
    BINARY_TYPES,
    EMPTY_BUFFER,
    kStatusCode,
    kWebSocket
  } = require_constants();
  var { concat, toArrayBuffer, unmask } = require_buffer_util();
  var { isValidStatusCode, isValidUTF8 } = require_validation();
  var FastBuffer = Buffer[Symbol.species];
  var GET_INFO = 0;
  var GET_PAYLOAD_LENGTH_16 = 1;
  var GET_PAYLOAD_LENGTH_64 = 2;
  var GET_MASK = 3;
  var GET_DATA = 4;
  var INFLATING = 5;
  var DEFER_EVENT = 6;

  class Receiver extends Writable {
    constructor(options = {}) {
      super();
      this._allowSynchronousEvents = options.allowSynchronousEvents !== undefined ? options.allowSynchronousEvents : true;
      this._binaryType = options.binaryType || BINARY_TYPES[0];
      this._extensions = options.extensions || {};
      this._isServer = !!options.isServer;
      this._maxPayload = options.maxPayload | 0;
      this._skipUTF8Validation = !!options.skipUTF8Validation;
      this[kWebSocket] = undefined;
      this._bufferedBytes = 0;
      this._buffers = [];
      this._compressed = false;
      this._payloadLength = 0;
      this._mask = undefined;
      this._fragmented = 0;
      this._masked = false;
      this._fin = false;
      this._opcode = 0;
      this._totalPayloadLength = 0;
      this._messageLength = 0;
      this._fragments = [];
      this._errored = false;
      this._loop = false;
      this._state = GET_INFO;
    }
    _write(chunk, encoding, cb) {
      if (this._opcode === 8 && this._state == GET_INFO)
        return cb();
      this._bufferedBytes += chunk.length;
      this._buffers.push(chunk);
      this.startLoop(cb);
    }
    consume(n) {
      this._bufferedBytes -= n;
      if (n === this._buffers[0].length)
        return this._buffers.shift();
      if (n < this._buffers[0].length) {
        const buf = this._buffers[0];
        this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
        return new FastBuffer(buf.buffer, buf.byteOffset, n);
      }
      const dst = Buffer.allocUnsafe(n);
      do {
        const buf = this._buffers[0];
        const offset = dst.length - n;
        if (n >= buf.length) {
          dst.set(this._buffers.shift(), offset);
        } else {
          dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
          this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
        }
        n -= buf.length;
      } while (n > 0);
      return dst;
    }
    startLoop(cb) {
      this._loop = true;
      do {
        switch (this._state) {
          case GET_INFO:
            this.getInfo(cb);
            break;
          case GET_PAYLOAD_LENGTH_16:
            this.getPayloadLength16(cb);
            break;
          case GET_PAYLOAD_LENGTH_64:
            this.getPayloadLength64(cb);
            break;
          case GET_MASK:
            this.getMask();
            break;
          case GET_DATA:
            this.getData(cb);
            break;
          case INFLATING:
          case DEFER_EVENT:
            this._loop = false;
            return;
        }
      } while (this._loop);
      if (!this._errored)
        cb();
    }
    getInfo(cb) {
      if (this._bufferedBytes < 2) {
        this._loop = false;
        return;
      }
      const buf = this.consume(2);
      if ((buf[0] & 48) !== 0) {
        const error = this.createError(RangeError, "RSV2 and RSV3 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_2_3");
        cb(error);
        return;
      }
      const compressed = (buf[0] & 64) === 64;
      if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
        const error = this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1");
        cb(error);
        return;
      }
      this._fin = (buf[0] & 128) === 128;
      this._opcode = buf[0] & 15;
      this._payloadLength = buf[1] & 127;
      if (this._opcode === 0) {
        if (compressed) {
          const error = this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1");
          cb(error);
          return;
        }
        if (!this._fragmented) {
          const error = this.createError(RangeError, "invalid opcode 0", true, 1002, "WS_ERR_INVALID_OPCODE");
          cb(error);
          return;
        }
        this._opcode = this._fragmented;
      } else if (this._opcode === 1 || this._opcode === 2) {
        if (this._fragmented) {
          const error = this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE");
          cb(error);
          return;
        }
        this._compressed = compressed;
      } else if (this._opcode > 7 && this._opcode < 11) {
        if (!this._fin) {
          const error = this.createError(RangeError, "FIN must be set", true, 1002, "WS_ERR_EXPECTED_FIN");
          cb(error);
          return;
        }
        if (compressed) {
          const error = this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1");
          cb(error);
          return;
        }
        if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
          const error = this.createError(RangeError, `invalid payload length ${this._payloadLength}`, true, 1002, "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH");
          cb(error);
          return;
        }
      } else {
        const error = this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE");
        cb(error);
        return;
      }
      if (!this._fin && !this._fragmented)
        this._fragmented = this._opcode;
      this._masked = (buf[1] & 128) === 128;
      if (this._isServer) {
        if (!this._masked) {
          const error = this.createError(RangeError, "MASK must be set", true, 1002, "WS_ERR_EXPECTED_MASK");
          cb(error);
          return;
        }
      } else if (this._masked) {
        const error = this.createError(RangeError, "MASK must be clear", true, 1002, "WS_ERR_UNEXPECTED_MASK");
        cb(error);
        return;
      }
      if (this._payloadLength === 126)
        this._state = GET_PAYLOAD_LENGTH_16;
      else if (this._payloadLength === 127)
        this._state = GET_PAYLOAD_LENGTH_64;
      else
        this.haveLength(cb);
    }
    getPayloadLength16(cb) {
      if (this._bufferedBytes < 2) {
        this._loop = false;
        return;
      }
      this._payloadLength = this.consume(2).readUInt16BE(0);
      this.haveLength(cb);
    }
    getPayloadLength64(cb) {
      if (this._bufferedBytes < 8) {
        this._loop = false;
        return;
      }
      const buf = this.consume(8);
      const num = buf.readUInt32BE(0);
      if (num > Math.pow(2, 53 - 32) - 1) {
        const error = this.createError(RangeError, "Unsupported WebSocket frame: payload length > 2^53 - 1", false, 1009, "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH");
        cb(error);
        return;
      }
      this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
      this.haveLength(cb);
    }
    haveLength(cb) {
      if (this._payloadLength && this._opcode < 8) {
        this._totalPayloadLength += this._payloadLength;
        if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
          const error = this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");
          cb(error);
          return;
        }
      }
      if (this._masked)
        this._state = GET_MASK;
      else
        this._state = GET_DATA;
    }
    getMask() {
      if (this._bufferedBytes < 4) {
        this._loop = false;
        return;
      }
      this._mask = this.consume(4);
      this._state = GET_DATA;
    }
    getData(cb) {
      let data = EMPTY_BUFFER;
      if (this._payloadLength) {
        if (this._bufferedBytes < this._payloadLength) {
          this._loop = false;
          return;
        }
        data = this.consume(this._payloadLength);
        if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
          unmask(data, this._mask);
        }
      }
      if (this._opcode > 7) {
        this.controlMessage(data, cb);
        return;
      }
      if (this._compressed) {
        this._state = INFLATING;
        this.decompress(data, cb);
        return;
      }
      if (data.length) {
        this._messageLength = this._totalPayloadLength;
        this._fragments.push(data);
      }
      this.dataMessage(cb);
    }
    decompress(data, cb) {
      const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
      perMessageDeflate.decompress(data, this._fin, (err, buf) => {
        if (err)
          return cb(err);
        if (buf.length) {
          this._messageLength += buf.length;
          if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");
            cb(error);
            return;
          }
          this._fragments.push(buf);
        }
        this.dataMessage(cb);
        if (this._state === GET_INFO)
          this.startLoop(cb);
      });
    }
    dataMessage(cb) {
      if (!this._fin) {
        this._state = GET_INFO;
        return;
      }
      const messageLength = this._messageLength;
      const fragments = this._fragments;
      this._totalPayloadLength = 0;
      this._messageLength = 0;
      this._fragmented = 0;
      this._fragments = [];
      if (this._opcode === 2) {
        let data;
        if (this._binaryType === "nodebuffer") {
          data = concat(fragments, messageLength);
        } else if (this._binaryType === "arraybuffer") {
          data = toArrayBuffer(concat(fragments, messageLength));
        } else {
          data = fragments;
        }
        if (this._allowSynchronousEvents) {
          this.emit("message", data, true);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit("message", data, true);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      } else {
        const buf = concat(fragments, messageLength);
        if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
          const error = this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8");
          cb(error);
          return;
        }
        if (this._state === INFLATING || this._allowSynchronousEvents) {
          this.emit("message", buf, false);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit("message", buf, false);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
    }
    controlMessage(data, cb) {
      if (this._opcode === 8) {
        if (data.length === 0) {
          this._loop = false;
          this.emit("conclude", 1005, EMPTY_BUFFER);
          this.end();
        } else {
          const code = data.readUInt16BE(0);
          if (!isValidStatusCode(code)) {
            const error = this.createError(RangeError, `invalid status code ${code}`, true, 1002, "WS_ERR_INVALID_CLOSE_CODE");
            cb(error);
            return;
          }
          const buf = new FastBuffer(data.buffer, data.byteOffset + 2, data.length - 2);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8");
            cb(error);
            return;
          }
          this._loop = false;
          this.emit("conclude", code, buf);
          this.end();
        }
        this._state = GET_INFO;
        return;
      }
      if (this._allowSynchronousEvents) {
        this.emit(this._opcode === 9 ? "ping" : "pong", data);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    }
    createError(ErrorCtor, message, prefix, statusCode, errorCode) {
      this._loop = false;
      this._errored = true;
      const err = new ErrorCtor(prefix ? `Invalid WebSocket frame: ${message}` : message);
      Error.captureStackTrace(err, this.createError);
      err.code = errorCode;
      err[kStatusCode] = statusCode;
      return err;
    }
  }
  module.exports = Receiver;
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS((exports, module) => {
  var { Duplex } = __require("stream");
  var { randomFillSync } = __require("crypto");
  var PerMessageDeflate = require_permessage_deflate();
  var { EMPTY_BUFFER } = require_constants();
  var { isValidStatusCode } = require_validation();
  var { mask: applyMask, toBuffer } = require_buffer_util();
  var kByteLength = Symbol("kByteLength");
  var maskBuffer = Buffer.alloc(4);
  var RANDOM_POOL_SIZE = 8 * 1024;
  var randomPool;
  var randomPoolPointer = RANDOM_POOL_SIZE;

  class Sender {
    constructor(socket, extensions, generateMask) {
      this._extensions = extensions || {};
      if (generateMask) {
        this._generateMask = generateMask;
        this._maskBuffer = Buffer.alloc(4);
      }
      this._socket = socket;
      this._firstFragment = true;
      this._compress = false;
      this._bufferedBytes = 0;
      this._deflating = false;
      this._queue = [];
    }
    static frame(data, options) {
      let mask;
      let merge = false;
      let offset = 2;
      let skipMasking = false;
      if (options.mask) {
        mask = options.maskBuffer || maskBuffer;
        if (options.generateMask) {
          options.generateMask(mask);
        } else {
          if (randomPoolPointer === RANDOM_POOL_SIZE) {
            if (randomPool === undefined) {
              randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
            }
            randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
            randomPoolPointer = 0;
          }
          mask[0] = randomPool[randomPoolPointer++];
          mask[1] = randomPool[randomPoolPointer++];
          mask[2] = randomPool[randomPoolPointer++];
          mask[3] = randomPool[randomPoolPointer++];
        }
        skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
        offset = 6;
      }
      let dataLength;
      if (typeof data === "string") {
        if ((!options.mask || skipMasking) && options[kByteLength] !== undefined) {
          dataLength = options[kByteLength];
        } else {
          data = Buffer.from(data);
          dataLength = data.length;
        }
      } else {
        dataLength = data.length;
        merge = options.mask && options.readOnly && !skipMasking;
      }
      let payloadLength = dataLength;
      if (dataLength >= 65536) {
        offset += 8;
        payloadLength = 127;
      } else if (dataLength > 125) {
        offset += 2;
        payloadLength = 126;
      }
      const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
      target[0] = options.fin ? options.opcode | 128 : options.opcode;
      if (options.rsv1)
        target[0] |= 64;
      target[1] = payloadLength;
      if (payloadLength === 126) {
        target.writeUInt16BE(dataLength, 2);
      } else if (payloadLength === 127) {
        target[2] = target[3] = 0;
        target.writeUIntBE(dataLength, 4, 6);
      }
      if (!options.mask)
        return [target, data];
      target[1] |= 128;
      target[offset - 4] = mask[0];
      target[offset - 3] = mask[1];
      target[offset - 2] = mask[2];
      target[offset - 1] = mask[3];
      if (skipMasking)
        return [target, data];
      if (merge) {
        applyMask(data, mask, target, offset, dataLength);
        return [target];
      }
      applyMask(data, mask, data, 0, dataLength);
      return [target, data];
    }
    close(code, data, mask, cb) {
      let buf;
      if (code === undefined) {
        buf = EMPTY_BUFFER;
      } else if (typeof code !== "number" || !isValidStatusCode(code)) {
        throw new TypeError("First argument must be a valid error code number");
      } else if (data === undefined || !data.length) {
        buf = Buffer.allocUnsafe(2);
        buf.writeUInt16BE(code, 0);
      } else {
        const length = Buffer.byteLength(data);
        if (length > 123) {
          throw new RangeError("The message must not be greater than 123 bytes");
        }
        buf = Buffer.allocUnsafe(2 + length);
        buf.writeUInt16BE(code, 0);
        if (typeof data === "string") {
          buf.write(data, 2);
        } else {
          buf.set(data, 2);
        }
      }
      const options = {
        [kByteLength]: buf.length,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 8,
        readOnly: false,
        rsv1: false
      };
      if (this._deflating) {
        this.enqueue([this.dispatch, buf, false, options, cb]);
      } else {
        this.sendFrame(Sender.frame(buf, options), cb);
      }
    }
    ping(data, mask, cb) {
      let byteLength;
      let readOnly;
      if (typeof data === "string") {
        byteLength = Buffer.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer(data);
        byteLength = data.length;
        readOnly = toBuffer.readOnly;
      }
      if (byteLength > 125) {
        throw new RangeError("The data size must not be greater than 125 bytes");
      }
      const options = {
        [kByteLength]: byteLength,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 9,
        readOnly,
        rsv1: false
      };
      if (this._deflating) {
        this.enqueue([this.dispatch, data, false, options, cb]);
      } else {
        this.sendFrame(Sender.frame(data, options), cb);
      }
    }
    pong(data, mask, cb) {
      let byteLength;
      let readOnly;
      if (typeof data === "string") {
        byteLength = Buffer.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer(data);
        byteLength = data.length;
        readOnly = toBuffer.readOnly;
      }
      if (byteLength > 125) {
        throw new RangeError("The data size must not be greater than 125 bytes");
      }
      const options = {
        [kByteLength]: byteLength,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 10,
        readOnly,
        rsv1: false
      };
      if (this._deflating) {
        this.enqueue([this.dispatch, data, false, options, cb]);
      } else {
        this.sendFrame(Sender.frame(data, options), cb);
      }
    }
    send(data, options, cb) {
      const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
      let opcode = options.binary ? 2 : 1;
      let rsv1 = options.compress;
      let byteLength;
      let readOnly;
      if (typeof data === "string") {
        byteLength = Buffer.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer(data);
        byteLength = data.length;
        readOnly = toBuffer.readOnly;
      }
      if (this._firstFragment) {
        this._firstFragment = false;
        if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
          rsv1 = byteLength >= perMessageDeflate._threshold;
        }
        this._compress = rsv1;
      } else {
        rsv1 = false;
        opcode = 0;
      }
      if (options.fin)
        this._firstFragment = true;
      if (perMessageDeflate) {
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (this._deflating) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      } else {
        this.sendFrame(Sender.frame(data, {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1: false
        }), cb);
      }
    }
    dispatch(data, compress, options, cb) {
      if (!compress) {
        this.sendFrame(Sender.frame(data, options), cb);
        return;
      }
      const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
      this._bufferedBytes += options[kByteLength];
      this._deflating = true;
      perMessageDeflate.compress(data, options.fin, (_, buf) => {
        if (this._socket.destroyed) {
          const err = new Error("The socket was closed while data was being compressed");
          if (typeof cb === "function")
            cb(err);
          for (let i = 0;i < this._queue.length; i++) {
            const params = this._queue[i];
            const callback = params[params.length - 1];
            if (typeof callback === "function")
              callback(err);
          }
          return;
        }
        this._bufferedBytes -= options[kByteLength];
        this._deflating = false;
        options.readOnly = false;
        this.sendFrame(Sender.frame(buf, options), cb);
        this.dequeue();
      });
    }
    dequeue() {
      while (!this._deflating && this._queue.length) {
        const params = this._queue.shift();
        this._bufferedBytes -= params[3][kByteLength];
        Reflect.apply(params[0], this, params.slice(1));
      }
    }
    enqueue(params) {
      this._bufferedBytes += params[3][kByteLength];
      this._queue.push(params);
    }
    sendFrame(list, cb) {
      if (list.length === 2) {
        this._socket.cork();
        this._socket.write(list[0]);
        this._socket.write(list[1], cb);
        this._socket.uncork();
      } else {
        this._socket.write(list[0], cb);
      }
    }
  }
  module.exports = Sender;
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS((exports, module) => {
  var { kForOnEventAttribute, kListener } = require_constants();
  var kCode = Symbol("kCode");
  var kData = Symbol("kData");
  var kError = Symbol("kError");
  var kMessage = Symbol("kMessage");
  var kReason = Symbol("kReason");
  var kTarget = Symbol("kTarget");
  var kType = Symbol("kType");
  var kWasClean = Symbol("kWasClean");

  class Event {
    constructor(type) {
      this[kTarget] = null;
      this[kType] = type;
    }
    get target() {
      return this[kTarget];
    }
    get type() {
      return this[kType];
    }
  }
  Object.defineProperty(Event.prototype, "target", { enumerable: true });
  Object.defineProperty(Event.prototype, "type", { enumerable: true });

  class CloseEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this[kCode] = options.code === undefined ? 0 : options.code;
      this[kReason] = options.reason === undefined ? "" : options.reason;
      this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
    }
    get code() {
      return this[kCode];
    }
    get reason() {
      return this[kReason];
    }
    get wasClean() {
      return this[kWasClean];
    }
  }
  Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
  Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
  Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });

  class ErrorEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this[kError] = options.error === undefined ? null : options.error;
      this[kMessage] = options.message === undefined ? "" : options.message;
    }
    get error() {
      return this[kError];
    }
    get message() {
      return this[kMessage];
    }
  }
  Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
  Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });

  class MessageEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this[kData] = options.data === undefined ? null : options.data;
    }
    get data() {
      return this[kData];
    }
  }
  Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
  var EventTarget = {
    addEventListener(type, handler, options = {}) {
      for (const listener of this.listeners(type)) {
        if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
          return;
        }
      }
      let wrapper;
      if (type === "message") {
        wrapper = function onMessage(data, isBinary) {
          const event = new MessageEvent("message", {
            data: isBinary ? data : data.toString()
          });
          event[kTarget] = this;
          callListener(handler, this, event);
        };
      } else if (type === "close") {
        wrapper = function onClose(code, message) {
          const event = new CloseEvent("close", {
            code,
            reason: message.toString(),
            wasClean: this._closeFrameReceived && this._closeFrameSent
          });
          event[kTarget] = this;
          callListener(handler, this, event);
        };
      } else if (type === "error") {
        wrapper = function onError(error) {
          const event = new ErrorEvent("error", {
            error,
            message: error.message
          });
          event[kTarget] = this;
          callListener(handler, this, event);
        };
      } else if (type === "open") {
        wrapper = function onOpen() {
          const event = new Event("open");
          event[kTarget] = this;
          callListener(handler, this, event);
        };
      } else {
        return;
      }
      wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
      wrapper[kListener] = handler;
      if (options.once) {
        this.once(type, wrapper);
      } else {
        this.on(type, wrapper);
      }
    },
    removeEventListener(type, handler) {
      for (const listener of this.listeners(type)) {
        if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
          this.removeListener(type, listener);
          break;
        }
      }
    }
  };
  module.exports = {
    CloseEvent,
    ErrorEvent,
    Event,
    EventTarget,
    MessageEvent
  };
  function callListener(listener, thisArg, event) {
    if (typeof listener === "object" && listener.handleEvent) {
      listener.handleEvent.call(listener, event);
    } else {
      listener.call(thisArg, event);
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS((exports, module) => {
  var { tokenChars } = require_validation();
  function push(dest, name, elem) {
    if (dest[name] === undefined)
      dest[name] = [elem];
    else
      dest[name].push(elem);
  }
  function parse(header) {
    const offers = Object.create(null);
    let params = Object.create(null);
    let mustUnescape = false;
    let isEscaping = false;
    let inQuotes = false;
    let extensionName;
    let paramName;
    let start = -1;
    let code = -1;
    let end = -1;
    let i = 0;
    for (;i < header.length; i++) {
      code = header.charCodeAt(i);
      if (extensionName === undefined) {
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1)
            start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1)
            end = i;
        } else if (code === 59 || code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1)
            end = i;
          const name = header.slice(start, end);
          if (code === 44) {
            push(offers, name, params);
            params = Object.create(null);
          } else {
            extensionName = name;
          }
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (paramName === undefined) {
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1)
            start = i;
        } else if (code === 32 || code === 9) {
          if (end === -1 && start !== -1)
            end = i;
        } else if (code === 59 || code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1)
            end = i;
          push(params, header.slice(start, end), true);
          if (code === 44) {
            push(offers, extensionName, params);
            params = Object.create(null);
            extensionName = undefined;
          }
          start = end = -1;
        } else if (code === 61 && start !== -1 && end === -1) {
          paramName = header.slice(start, i);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else {
        if (isEscaping) {
          if (tokenChars[code] !== 1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (start === -1)
            start = i;
          else if (!mustUnescape)
            mustUnescape = true;
          isEscaping = false;
        } else if (inQuotes) {
          if (tokenChars[code] === 1) {
            if (start === -1)
              start = i;
          } else if (code === 34 && start !== -1) {
            inQuotes = false;
            end = i;
          } else if (code === 92) {
            isEscaping = true;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
          inQuotes = true;
        } else if (end === -1 && tokenChars[code] === 1) {
          if (start === -1)
            start = i;
        } else if (start !== -1 && (code === 32 || code === 9)) {
          if (end === -1)
            end = i;
        } else if (code === 59 || code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1)
            end = i;
          let value = header.slice(start, end);
          if (mustUnescape) {
            value = value.replace(/\\/g, "");
            mustUnescape = false;
          }
          push(params, paramName, value);
          if (code === 44) {
            push(offers, extensionName, params);
            params = Object.create(null);
            extensionName = undefined;
          }
          paramName = undefined;
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
    }
    if (start === -1 || inQuotes || code === 32 || code === 9) {
      throw new SyntaxError("Unexpected end of input");
    }
    if (end === -1)
      end = i;
    const token = header.slice(start, end);
    if (extensionName === undefined) {
      push(offers, token, params);
    } else {
      if (paramName === undefined) {
        push(params, token, true);
      } else if (mustUnescape) {
        push(params, paramName, token.replace(/\\/g, ""));
      } else {
        push(params, paramName, token);
      }
      push(offers, extensionName, params);
    }
    return offers;
  }
  function format(extensions) {
    return Object.keys(extensions).map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations))
        configurations = [configurations];
      return configurations.map((params) => {
        return [extension].concat(Object.keys(params).map((k) => {
          let values = params[k];
          if (!Array.isArray(values))
            values = [values];
          return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
        })).join("; ");
      }).join(", ");
    }).join(", ");
  }
  module.exports = { format, parse };
});

// node_modules/ws/lib/websocket.js
var require_websocket2 = __commonJS((exports, module) => {
  var EventEmitter = __require("events");
  var https = __require("https");
  var http = __require("http");
  var net = __require("net");
  var tls = __require("tls");
  var { randomBytes, createHash } = __require("crypto");
  var { Duplex, Readable } = __require("stream");
  var { URL: URL2 } = __require("url");
  var PerMessageDeflate = require_permessage_deflate();
  var Receiver = require_receiver();
  var Sender = require_sender();
  var {
    BINARY_TYPES,
    EMPTY_BUFFER,
    GUID,
    kForOnEventAttribute,
    kListener,
    kStatusCode,
    kWebSocket,
    NOOP
  } = require_constants();
  var {
    EventTarget: { addEventListener, removeEventListener }
  } = require_event_target();
  var { format, parse } = require_extension();
  var { toBuffer } = require_buffer_util();
  var closeTimeout = 30 * 1000;
  var kAborted = Symbol("kAborted");
  var protocolVersions = [8, 13];
  var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
  var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

  class WebSocket extends EventEmitter {
    constructor(address, protocols, options) {
      super();
      this._binaryType = BINARY_TYPES[0];
      this._closeCode = 1006;
      this._closeFrameReceived = false;
      this._closeFrameSent = false;
      this._closeMessage = EMPTY_BUFFER;
      this._closeTimer = null;
      this._extensions = {};
      this._paused = false;
      this._protocol = "";
      this._readyState = WebSocket.CONNECTING;
      this._receiver = null;
      this._sender = null;
      this._socket = null;
      if (address !== null) {
        this._bufferedAmount = 0;
        this._isServer = false;
        this._redirects = 0;
        if (protocols === undefined) {
          protocols = [];
        } else if (!Array.isArray(protocols)) {
          if (typeof protocols === "object" && protocols !== null) {
            options = protocols;
            protocols = [];
          } else {
            protocols = [protocols];
          }
        }
        initAsClient(this, address, protocols, options);
      } else {
        this._autoPong = options.autoPong;
        this._isServer = true;
      }
    }
    get binaryType() {
      return this._binaryType;
    }
    set binaryType(type) {
      if (!BINARY_TYPES.includes(type))
        return;
      this._binaryType = type;
      if (this._receiver)
        this._receiver._binaryType = type;
    }
    get bufferedAmount() {
      if (!this._socket)
        return this._bufferedAmount;
      return this._socket._writableState.length + this._sender._bufferedBytes;
    }
    get extensions() {
      return Object.keys(this._extensions).join();
    }
    get isPaused() {
      return this._paused;
    }
    get onclose() {
      return null;
    }
    get onerror() {
      return null;
    }
    get onopen() {
      return null;
    }
    get onmessage() {
      return null;
    }
    get protocol() {
      return this._protocol;
    }
    get readyState() {
      return this._readyState;
    }
    get url() {
      return this._url;
    }
    setSocket(socket, head, options) {
      const receiver = new Receiver({
        allowSynchronousEvents: options.allowSynchronousEvents,
        binaryType: this.binaryType,
        extensions: this._extensions,
        isServer: this._isServer,
        maxPayload: options.maxPayload,
        skipUTF8Validation: options.skipUTF8Validation
      });
      this._sender = new Sender(socket, this._extensions, options.generateMask);
      this._receiver = receiver;
      this._socket = socket;
      receiver[kWebSocket] = this;
      socket[kWebSocket] = this;
      receiver.on("conclude", receiverOnConclude);
      receiver.on("drain", receiverOnDrain);
      receiver.on("error", receiverOnError);
      receiver.on("message", receiverOnMessage);
      receiver.on("ping", receiverOnPing);
      receiver.on("pong", receiverOnPong);
      if (socket.setTimeout)
        socket.setTimeout(0);
      if (socket.setNoDelay)
        socket.setNoDelay();
      if (head.length > 0)
        socket.unshift(head);
      socket.on("close", socketOnClose);
      socket.on("data", socketOnData);
      socket.on("end", socketOnEnd);
      socket.on("error", socketOnError);
      this._readyState = WebSocket.OPEN;
      this.emit("open");
    }
    emitClose() {
      if (!this._socket) {
        this._readyState = WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
        return;
      }
      if (this._extensions[PerMessageDeflate.extensionName]) {
        this._extensions[PerMessageDeflate.extensionName].cleanup();
      }
      this._receiver.removeAllListeners();
      this._readyState = WebSocket.CLOSED;
      this.emit("close", this._closeCode, this._closeMessage);
    }
    close(code, data) {
      if (this.readyState === WebSocket.CLOSED)
        return;
      if (this.readyState === WebSocket.CONNECTING) {
        const msg = "WebSocket was closed before the connection was established";
        abortHandshake(this, this._req, msg);
        return;
      }
      if (this.readyState === WebSocket.CLOSING) {
        if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
          this._socket.end();
        }
        return;
      }
      this._readyState = WebSocket.CLOSING;
      this._sender.close(code, data, !this._isServer, (err) => {
        if (err)
          return;
        this._closeFrameSent = true;
        if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
          this._socket.end();
        }
      });
      this._closeTimer = setTimeout(this._socket.destroy.bind(this._socket), closeTimeout);
    }
    pause() {
      if (this.readyState === WebSocket.CONNECTING || this.readyState === WebSocket.CLOSED) {
        return;
      }
      this._paused = true;
      this._socket.pause();
    }
    ping(data, mask, cb) {
      if (this.readyState === WebSocket.CONNECTING) {
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      }
      if (typeof data === "function") {
        cb = data;
        data = mask = undefined;
      } else if (typeof mask === "function") {
        cb = mask;
        mask = undefined;
      }
      if (typeof data === "number")
        data = data.toString();
      if (this.readyState !== WebSocket.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }
      if (mask === undefined)
        mask = !this._isServer;
      this._sender.ping(data || EMPTY_BUFFER, mask, cb);
    }
    pong(data, mask, cb) {
      if (this.readyState === WebSocket.CONNECTING) {
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      }
      if (typeof data === "function") {
        cb = data;
        data = mask = undefined;
      } else if (typeof mask === "function") {
        cb = mask;
        mask = undefined;
      }
      if (typeof data === "number")
        data = data.toString();
      if (this.readyState !== WebSocket.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }
      if (mask === undefined)
        mask = !this._isServer;
      this._sender.pong(data || EMPTY_BUFFER, mask, cb);
    }
    resume() {
      if (this.readyState === WebSocket.CONNECTING || this.readyState === WebSocket.CLOSED) {
        return;
      }
      this._paused = false;
      if (!this._receiver._writableState.needDrain)
        this._socket.resume();
    }
    send(data, options, cb) {
      if (this.readyState === WebSocket.CONNECTING) {
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      }
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      if (typeof data === "number")
        data = data.toString();
      if (this.readyState !== WebSocket.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }
      const opts = {
        binary: typeof data !== "string",
        mask: !this._isServer,
        compress: true,
        fin: true,
        ...options
      };
      if (!this._extensions[PerMessageDeflate.extensionName]) {
        opts.compress = false;
      }
      this._sender.send(data || EMPTY_BUFFER, opts, cb);
    }
    terminate() {
      if (this.readyState === WebSocket.CLOSED)
        return;
      if (this.readyState === WebSocket.CONNECTING) {
        const msg = "WebSocket was closed before the connection was established";
        abortHandshake(this, this._req, msg);
        return;
      }
      if (this._socket) {
        this._readyState = WebSocket.CLOSING;
        this._socket.destroy();
      }
    }
  }
  Object.defineProperty(WebSocket, "CONNECTING", {
    enumerable: true,
    value: readyStates.indexOf("CONNECTING")
  });
  Object.defineProperty(WebSocket.prototype, "CONNECTING", {
    enumerable: true,
    value: readyStates.indexOf("CONNECTING")
  });
  Object.defineProperty(WebSocket, "OPEN", {
    enumerable: true,
    value: readyStates.indexOf("OPEN")
  });
  Object.defineProperty(WebSocket.prototype, "OPEN", {
    enumerable: true,
    value: readyStates.indexOf("OPEN")
  });
  Object.defineProperty(WebSocket, "CLOSING", {
    enumerable: true,
    value: readyStates.indexOf("CLOSING")
  });
  Object.defineProperty(WebSocket.prototype, "CLOSING", {
    enumerable: true,
    value: readyStates.indexOf("CLOSING")
  });
  Object.defineProperty(WebSocket, "CLOSED", {
    enumerable: true,
    value: readyStates.indexOf("CLOSED")
  });
  Object.defineProperty(WebSocket.prototype, "CLOSED", {
    enumerable: true,
    value: readyStates.indexOf("CLOSED")
  });
  [
    "binaryType",
    "bufferedAmount",
    "extensions",
    "isPaused",
    "protocol",
    "readyState",
    "url"
  ].forEach((property) => {
    Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
  });
  ["open", "error", "close", "message"].forEach((method) => {
    Object.defineProperty(WebSocket.prototype, `on${method}`, {
      enumerable: true,
      get() {
        for (const listener of this.listeners(method)) {
          if (listener[kForOnEventAttribute])
            return listener[kListener];
        }
        return null;
      },
      set(handler) {
        for (const listener of this.listeners(method)) {
          if (listener[kForOnEventAttribute]) {
            this.removeListener(method, listener);
            break;
          }
        }
        if (typeof handler !== "function")
          return;
        this.addEventListener(method, handler, {
          [kForOnEventAttribute]: true
        });
      }
    });
  });
  WebSocket.prototype.addEventListener = addEventListener;
  WebSocket.prototype.removeEventListener = removeEventListener;
  module.exports = WebSocket;
  function initAsClient(websocket, address, protocols, options) {
    const opts = {
      allowSynchronousEvents: true,
      autoPong: true,
      protocolVersion: protocolVersions[1],
      maxPayload: 100 * 1024 * 1024,
      skipUTF8Validation: false,
      perMessageDeflate: true,
      followRedirects: false,
      maxRedirects: 10,
      ...options,
      socketPath: undefined,
      hostname: undefined,
      protocol: undefined,
      timeout: undefined,
      method: "GET",
      host: undefined,
      path: undefined,
      port: undefined
    };
    websocket._autoPong = opts.autoPong;
    if (!protocolVersions.includes(opts.protocolVersion)) {
      throw new RangeError(`Unsupported protocol version: ${opts.protocolVersion} ` + `(supported versions: ${protocolVersions.join(", ")})`);
    }
    let parsedUrl;
    if (address instanceof URL2) {
      parsedUrl = address;
    } else {
      try {
        parsedUrl = new URL2(address);
      } catch (e) {
        throw new SyntaxError(`Invalid URL: ${address}`);
      }
    }
    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "ws:";
    } else if (parsedUrl.protocol === "https:") {
      parsedUrl.protocol = "wss:";
    }
    websocket._url = parsedUrl.href;
    const isSecure = parsedUrl.protocol === "wss:";
    const isIpcUrl = parsedUrl.protocol === "ws+unix:";
    let invalidUrlMessage;
    if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
      invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", ` + '"http:", "https", or "ws+unix:"';
    } else if (isIpcUrl && !parsedUrl.pathname) {
      invalidUrlMessage = "The URL's pathname is empty";
    } else if (parsedUrl.hash) {
      invalidUrlMessage = "The URL contains a fragment identifier";
    }
    if (invalidUrlMessage) {
      const err = new SyntaxError(invalidUrlMessage);
      if (websocket._redirects === 0) {
        throw err;
      } else {
        emitErrorAndClose(websocket, err);
        return;
      }
    }
    const defaultPort = isSecure ? 443 : 80;
    const key = randomBytes(16).toString("base64");
    const request = isSecure ? https.request : http.request;
    const protocolSet = new Set;
    let perMessageDeflate;
    opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
    opts.defaultPort = opts.defaultPort || defaultPort;
    opts.port = parsedUrl.port || defaultPort;
    opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
    opts.headers = {
      ...opts.headers,
      "Sec-WebSocket-Version": opts.protocolVersion,
      "Sec-WebSocket-Key": key,
      Connection: "Upgrade",
      Upgrade: "websocket"
    };
    opts.path = parsedUrl.pathname + parsedUrl.search;
    opts.timeout = opts.handshakeTimeout;
    if (opts.perMessageDeflate) {
      perMessageDeflate = new PerMessageDeflate(opts.perMessageDeflate !== true ? opts.perMessageDeflate : {}, false, opts.maxPayload);
      opts.headers["Sec-WebSocket-Extensions"] = format({
        [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
      });
    }
    if (protocols.length) {
      for (const protocol of protocols) {
        if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
          throw new SyntaxError("An invalid or duplicated subprotocol was specified");
        }
        protocolSet.add(protocol);
      }
      opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
    }
    if (opts.origin) {
      if (opts.protocolVersion < 13) {
        opts.headers["Sec-WebSocket-Origin"] = opts.origin;
      } else {
        opts.headers.Origin = opts.origin;
      }
    }
    if (parsedUrl.username || parsedUrl.password) {
      opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
    }
    if (isIpcUrl) {
      const parts = opts.path.split(":");
      opts.socketPath = parts[0];
      opts.path = parts[1];
    }
    let req;
    if (opts.followRedirects) {
      if (websocket._redirects === 0) {
        websocket._originalIpc = isIpcUrl;
        websocket._originalSecure = isSecure;
        websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
        const headers = options && options.headers;
        options = { ...options, headers: {} };
        if (headers) {
          for (const [key2, value] of Object.entries(headers)) {
            options.headers[key2.toLowerCase()] = value;
          }
        }
      } else if (websocket.listenerCount("redirect") === 0) {
        const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
        if (!isSameHost || websocket._originalSecure && !isSecure) {
          delete opts.headers.authorization;
          delete opts.headers.cookie;
          if (!isSameHost)
            delete opts.headers.host;
          opts.auth = undefined;
        }
      }
      if (opts.auth && !options.headers.authorization) {
        options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
      }
      req = websocket._req = request(opts);
      if (websocket._redirects) {
        websocket.emit("redirect", websocket.url, req);
      }
    } else {
      req = websocket._req = request(opts);
    }
    if (opts.timeout) {
      req.on("timeout", () => {
        abortHandshake(websocket, req, "Opening handshake has timed out");
      });
    }
    req.on("error", (err) => {
      if (req === null || req[kAborted])
        return;
      req = websocket._req = null;
      emitErrorAndClose(websocket, err);
    });
    req.on("response", (res) => {
      const location = res.headers.location;
      const statusCode = res.statusCode;
      if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
        if (++websocket._redirects > opts.maxRedirects) {
          abortHandshake(websocket, req, "Maximum redirects exceeded");
          return;
        }
        req.abort();
        let addr;
        try {
          addr = new URL2(location, address);
        } catch (e) {
          const err = new SyntaxError(`Invalid URL: ${location}`);
          emitErrorAndClose(websocket, err);
          return;
        }
        initAsClient(websocket, addr, protocols, options);
      } else if (!websocket.emit("unexpected-response", req, res)) {
        abortHandshake(websocket, req, `Unexpected server response: ${res.statusCode}`);
      }
    });
    req.on("upgrade", (res, socket, head) => {
      websocket.emit("upgrade", res);
      if (websocket.readyState !== WebSocket.CONNECTING)
        return;
      req = websocket._req = null;
      const upgrade = res.headers.upgrade;
      if (upgrade === undefined || upgrade.toLowerCase() !== "websocket") {
        abortHandshake(websocket, socket, "Invalid Upgrade header");
        return;
      }
      const digest = createHash("sha1").update(key + GUID).digest("base64");
      if (res.headers["sec-websocket-accept"] !== digest) {
        abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
        return;
      }
      const serverProt = res.headers["sec-websocket-protocol"];
      let protError;
      if (serverProt !== undefined) {
        if (!protocolSet.size) {
          protError = "Server sent a subprotocol but none was requested";
        } else if (!protocolSet.has(serverProt)) {
          protError = "Server sent an invalid subprotocol";
        }
      } else if (protocolSet.size) {
        protError = "Server sent no subprotocol";
      }
      if (protError) {
        abortHandshake(websocket, socket, protError);
        return;
      }
      if (serverProt)
        websocket._protocol = serverProt;
      const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
      if (secWebSocketExtensions !== undefined) {
        if (!perMessageDeflate) {
          const message = "Server sent a Sec-WebSocket-Extensions header but no extension " + "was requested";
          abortHandshake(websocket, socket, message);
          return;
        }
        let extensions;
        try {
          extensions = parse(secWebSocketExtensions);
        } catch (err) {
          const message = "Invalid Sec-WebSocket-Extensions header";
          abortHandshake(websocket, socket, message);
          return;
        }
        const extensionNames = Object.keys(extensions);
        if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
          const message = "Server indicated an extension that was not requested";
          abortHandshake(websocket, socket, message);
          return;
        }
        try {
          perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
        } catch (err) {
          const message = "Invalid Sec-WebSocket-Extensions header";
          abortHandshake(websocket, socket, message);
          return;
        }
        websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
      }
      websocket.setSocket(socket, head, {
        allowSynchronousEvents: opts.allowSynchronousEvents,
        generateMask: opts.generateMask,
        maxPayload: opts.maxPayload,
        skipUTF8Validation: opts.skipUTF8Validation
      });
    });
    if (opts.finishRequest) {
      opts.finishRequest(req, websocket);
    } else {
      req.end();
    }
  }
  function emitErrorAndClose(websocket, err) {
    websocket._readyState = WebSocket.CLOSING;
    websocket.emit("error", err);
    websocket.emitClose();
  }
  function netConnect(options) {
    options.path = options.socketPath;
    return net.connect(options);
  }
  function tlsConnect(options) {
    options.path = undefined;
    if (!options.servername && options.servername !== "") {
      options.servername = net.isIP(options.host) ? "" : options.host;
    }
    return tls.connect(options);
  }
  function abortHandshake(websocket, stream, message) {
    websocket._readyState = WebSocket.CLOSING;
    const err = new Error(message);
    Error.captureStackTrace(err, abortHandshake);
    if (stream.setHeader) {
      stream[kAborted] = true;
      stream.abort();
      if (stream.socket && !stream.socket.destroyed) {
        stream.socket.destroy();
      }
      process.nextTick(emitErrorAndClose, websocket, err);
    } else {
      stream.destroy(err);
      stream.once("error", websocket.emit.bind(websocket, "error"));
      stream.once("close", websocket.emitClose.bind(websocket));
    }
  }
  function sendAfterClose(websocket, data, cb) {
    if (data) {
      const length = toBuffer(data).length;
      if (websocket._socket)
        websocket._sender._bufferedBytes += length;
      else
        websocket._bufferedAmount += length;
    }
    if (cb) {
      const err = new Error(`WebSocket is not open: readyState ${websocket.readyState} ` + `(${readyStates[websocket.readyState]})`);
      process.nextTick(cb, err);
    }
  }
  function receiverOnConclude(code, reason) {
    const websocket = this[kWebSocket];
    websocket._closeFrameReceived = true;
    websocket._closeMessage = reason;
    websocket._closeCode = code;
    if (websocket._socket[kWebSocket] === undefined)
      return;
    websocket._socket.removeListener("data", socketOnData);
    process.nextTick(resume, websocket._socket);
    if (code === 1005)
      websocket.close();
    else
      websocket.close(code, reason);
  }
  function receiverOnDrain() {
    const websocket = this[kWebSocket];
    if (!websocket.isPaused)
      websocket._socket.resume();
  }
  function receiverOnError(err) {
    const websocket = this[kWebSocket];
    if (websocket._socket[kWebSocket] !== undefined) {
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      websocket.close(err[kStatusCode]);
    }
    websocket.emit("error", err);
  }
  function receiverOnFinish() {
    this[kWebSocket].emitClose();
  }
  function receiverOnMessage(data, isBinary) {
    this[kWebSocket].emit("message", data, isBinary);
  }
  function receiverOnPing(data) {
    const websocket = this[kWebSocket];
    if (websocket._autoPong)
      websocket.pong(data, !this._isServer, NOOP);
    websocket.emit("ping", data);
  }
  function receiverOnPong(data) {
    this[kWebSocket].emit("pong", data);
  }
  function resume(stream) {
    stream.resume();
  }
  function socketOnClose() {
    const websocket = this[kWebSocket];
    this.removeListener("close", socketOnClose);
    this.removeListener("data", socketOnData);
    this.removeListener("end", socketOnEnd);
    websocket._readyState = WebSocket.CLOSING;
    let chunk;
    if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk = websocket._socket.read()) !== null) {
      websocket._receiver.write(chunk);
    }
    websocket._receiver.end();
    this[kWebSocket] = undefined;
    clearTimeout(websocket._closeTimer);
    if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
      websocket.emitClose();
    } else {
      websocket._receiver.on("error", receiverOnFinish);
      websocket._receiver.on("finish", receiverOnFinish);
    }
  }
  function socketOnData(chunk) {
    if (!this[kWebSocket]._receiver.write(chunk)) {
      this.pause();
    }
  }
  function socketOnEnd() {
    const websocket = this[kWebSocket];
    websocket._readyState = WebSocket.CLOSING;
    websocket._receiver.end();
    this.end();
  }
  function socketOnError() {
    const websocket = this[kWebSocket];
    this.removeListener("error", socketOnError);
    this.on("error", NOOP);
    if (websocket) {
      websocket._readyState = WebSocket.CLOSING;
      this.destroy();
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS((exports, module) => {
  var { Duplex } = __require("stream");
  function emitClose(stream) {
    stream.emit("close");
  }
  function duplexOnEnd() {
    if (!this.destroyed && this._writableState.finished) {
      this.destroy();
    }
  }
  function duplexOnError(err) {
    this.removeListener("error", duplexOnError);
    this.destroy();
    if (this.listenerCount("error") === 0) {
      this.emit("error", err);
    }
  }
  function createWebSocketStream(ws, options) {
    let terminateOnDestroy = true;
    const duplex = new Duplex({
      ...options,
      autoDestroy: false,
      emitClose: false,
      objectMode: false,
      writableObjectMode: false
    });
    ws.on("message", function message(msg, isBinary) {
      const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
      if (!duplex.push(data))
        ws.pause();
    });
    ws.once("error", function error(err) {
      if (duplex.destroyed)
        return;
      terminateOnDestroy = false;
      duplex.destroy(err);
    });
    ws.once("close", function close() {
      if (duplex.destroyed)
        return;
      duplex.push(null);
    });
    duplex._destroy = function(err, callback) {
      if (ws.readyState === ws.CLOSED) {
        callback(err);
        process.nextTick(emitClose, duplex);
        return;
      }
      let called = false;
      ws.once("error", function error(err2) {
        called = true;
        callback(err2);
      });
      ws.once("close", function close() {
        if (!called)
          callback(err);
        process.nextTick(emitClose, duplex);
      });
      if (terminateOnDestroy)
        ws.terminate();
    };
    duplex._final = function(callback) {
      if (ws.readyState === ws.CONNECTING) {
        ws.once("open", function open() {
          duplex._final(callback);
        });
        return;
      }
      if (ws._socket === null)
        return;
      if (ws._socket._writableState.finished) {
        callback();
        if (duplex._readableState.endEmitted)
          duplex.destroy();
      } else {
        ws._socket.once("finish", function finish() {
          callback();
        });
        ws.close();
      }
    };
    duplex._read = function() {
      if (ws.isPaused)
        ws.resume();
    };
    duplex._write = function(chunk, encoding, callback) {
      if (ws.readyState === ws.CONNECTING) {
        ws.once("open", function open() {
          duplex._write(chunk, encoding, callback);
        });
        return;
      }
      ws.send(chunk, callback);
    };
    duplex.on("end", duplexOnEnd);
    duplex.on("error", duplexOnError);
    return duplex;
  }
  module.exports = createWebSocketStream;
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS((exports, module) => {
  var { tokenChars } = require_validation();
  function parse(header) {
    const protocols = new Set;
    let start = -1;
    let end = -1;
    let i = 0;
    for (i;i < header.length; i++) {
      const code = header.charCodeAt(i);
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1)
          start = i;
      } else if (i !== 0 && (code === 32 || code === 9)) {
        if (end === -1 && start !== -1)
          end = i;
      } else if (code === 44) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
        if (end === -1)
          end = i;
        const protocol2 = header.slice(start, end);
        if (protocols.has(protocol2)) {
          throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
        }
        protocols.add(protocol2);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
    if (start === -1 || end !== -1) {
      throw new SyntaxError("Unexpected end of input");
    }
    const protocol = header.slice(start, i);
    if (protocols.has(protocol)) {
      throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
    }
    protocols.add(protocol);
    return protocols;
  }
  module.exports = { parse };
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS((exports, module) => {
  var EventEmitter = __require("events");
  var http = __require("http");
  var { Duplex } = __require("stream");
  var { createHash } = __require("crypto");
  var extension = require_extension();
  var PerMessageDeflate = require_permessage_deflate();
  var subprotocol = require_subprotocol();
  var WebSocket = require_websocket2();
  var { GUID, kWebSocket } = require_constants();
  var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
  var RUNNING = 0;
  var CLOSING = 1;
  var CLOSED = 2;

  class WebSocketServer extends EventEmitter {
    constructor(options, callback) {
      super();
      options = {
        allowSynchronousEvents: true,
        autoPong: true,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: false,
        handleProtocols: null,
        clientTracking: true,
        verifyClient: null,
        noServer: false,
        backlog: null,
        server: null,
        host: null,
        path: null,
        port: null,
        WebSocket,
        ...options
      };
      if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
        throw new TypeError('One and only one of the "port", "server", or "noServer" options ' + "must be specified");
      }
      if (options.port != null) {
        this._server = http.createServer((req, res) => {
          const body = http.STATUS_CODES[426];
          res.writeHead(426, {
            "Content-Length": body.length,
            "Content-Type": "text/plain"
          });
          res.end(body);
        });
        this._server.listen(options.port, options.host, options.backlog, callback);
      } else if (options.server) {
        this._server = options.server;
      }
      if (this._server) {
        const emitConnection = this.emit.bind(this, "connection");
        this._removeListeners = addListeners(this._server, {
          listening: this.emit.bind(this, "listening"),
          error: this.emit.bind(this, "error"),
          upgrade: (req, socket, head) => {
            this.handleUpgrade(req, socket, head, emitConnection);
          }
        });
      }
      if (options.perMessageDeflate === true)
        options.perMessageDeflate = {};
      if (options.clientTracking) {
        this.clients = new Set;
        this._shouldEmitClose = false;
      }
      this.options = options;
      this._state = RUNNING;
    }
    address() {
      if (this.options.noServer) {
        throw new Error('The server is operating in "noServer" mode');
      }
      if (!this._server)
        return null;
      return this._server.address();
    }
    close(cb) {
      if (this._state === CLOSED) {
        if (cb) {
          this.once("close", () => {
            cb(new Error("The server is not running"));
          });
        }
        process.nextTick(emitClose, this);
        return;
      }
      if (cb)
        this.once("close", cb);
      if (this._state === CLOSING)
        return;
      this._state = CLOSING;
      if (this.options.noServer || this.options.server) {
        if (this._server) {
          this._removeListeners();
          this._removeListeners = this._server = null;
        }
        if (this.clients) {
          if (!this.clients.size) {
            process.nextTick(emitClose, this);
          } else {
            this._shouldEmitClose = true;
          }
        } else {
          process.nextTick(emitClose, this);
        }
      } else {
        const server = this._server;
        this._removeListeners();
        this._removeListeners = this._server = null;
        server.close(() => {
          emitClose(this);
        });
      }
    }
    shouldHandle(req) {
      if (this.options.path) {
        const index = req.url.indexOf("?");
        const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
        if (pathname !== this.options.path)
          return false;
      }
      return true;
    }
    handleUpgrade(req, socket, head, cb) {
      socket.on("error", socketOnError);
      const key = req.headers["sec-websocket-key"];
      const upgrade = req.headers.upgrade;
      const version = +req.headers["sec-websocket-version"];
      if (req.method !== "GET") {
        const message = "Invalid HTTP method";
        abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
        return;
      }
      if (upgrade === undefined || upgrade.toLowerCase() !== "websocket") {
        const message = "Invalid Upgrade header";
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
      if (key === undefined || !keyRegex.test(key)) {
        const message = "Missing or invalid Sec-WebSocket-Key header";
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
      if (version !== 8 && version !== 13) {
        const message = "Missing or invalid Sec-WebSocket-Version header";
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
      if (!this.shouldHandle(req)) {
        abortHandshake(socket, 400);
        return;
      }
      const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
      let protocols = new Set;
      if (secWebSocketProtocol !== undefined) {
        try {
          protocols = subprotocol.parse(secWebSocketProtocol);
        } catch (err) {
          const message = "Invalid Sec-WebSocket-Protocol header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
      }
      const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
      const extensions = {};
      if (this.options.perMessageDeflate && secWebSocketExtensions !== undefined) {
        const perMessageDeflate = new PerMessageDeflate(this.options.perMessageDeflate, true, this.options.maxPayload);
        try {
          const offers = extension.parse(secWebSocketExtensions);
          if (offers[PerMessageDeflate.extensionName]) {
            perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
            extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
          }
        } catch (err) {
          const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
      }
      if (this.options.verifyClient) {
        const info = {
          origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
          secure: !!(req.socket.authorized || req.socket.encrypted),
          req
        };
        if (this.options.verifyClient.length === 2) {
          this.options.verifyClient(info, (verified, code, message, headers) => {
            if (!verified) {
              return abortHandshake(socket, code || 401, message, headers);
            }
            this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
          });
          return;
        }
        if (!this.options.verifyClient(info))
          return abortHandshake(socket, 401);
      }
      this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
    }
    completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
      if (!socket.readable || !socket.writable)
        return socket.destroy();
      if (socket[kWebSocket]) {
        throw new Error("server.handleUpgrade() was called more than once with the same " + "socket, possibly due to a misconfiguration");
      }
      if (this._state > RUNNING)
        return abortHandshake(socket, 503);
      const digest = createHash("sha1").update(key + GUID).digest("base64");
      const headers = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${digest}`
      ];
      const ws = new this.options.WebSocket(null, undefined, this.options);
      if (protocols.size) {
        const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
        if (protocol) {
          headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
          ws._protocol = protocol;
        }
      }
      if (extensions[PerMessageDeflate.extensionName]) {
        const params = extensions[PerMessageDeflate.extensionName].params;
        const value = extension.format({
          [PerMessageDeflate.extensionName]: [params]
        });
        headers.push(`Sec-WebSocket-Extensions: ${value}`);
        ws._extensions = extensions;
      }
      this.emit("headers", headers, req);
      socket.write(headers.concat(`\r
`).join(`\r
`));
      socket.removeListener("error", socketOnError);
      ws.setSocket(socket, head, {
        allowSynchronousEvents: this.options.allowSynchronousEvents,
        maxPayload: this.options.maxPayload,
        skipUTF8Validation: this.options.skipUTF8Validation
      });
      if (this.clients) {
        this.clients.add(ws);
        ws.on("close", () => {
          this.clients.delete(ws);
          if (this._shouldEmitClose && !this.clients.size) {
            process.nextTick(emitClose, this);
          }
        });
      }
      cb(ws, req);
    }
  }
  module.exports = WebSocketServer;
  function addListeners(server, map) {
    for (const event of Object.keys(map))
      server.on(event, map[event]);
    return function removeListeners() {
      for (const event of Object.keys(map)) {
        server.removeListener(event, map[event]);
      }
    };
  }
  function emitClose(server) {
    server._state = CLOSED;
    server.emit("close");
  }
  function socketOnError() {
    this.destroy();
  }
  function abortHandshake(socket, code, message, headers) {
    message = message || http.STATUS_CODES[code];
    headers = {
      Connection: "close",
      "Content-Type": "text/html",
      "Content-Length": Buffer.byteLength(message),
      ...headers
    };
    socket.once("finish", socket.destroy);
    socket.end(`HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join(`\r
`) + `\r
\r
` + message);
  }
  function abortHandshakeOrEmitwsClientError(server, req, socket, code, message) {
    if (server.listenerCount("wsClientError")) {
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
      server.emit("wsClientError", err, socket, req);
    } else {
      abortHandshake(socket, code, message);
    }
  }
});

// node_modules/ws/index.js
var require_ws = __commonJS((exports, module) => {
  var WebSocket = require_websocket2();
  WebSocket.createWebSocketStream = require_stream();
  WebSocket.Server = require_websocket_server();
  WebSocket.Receiver = require_receiver();
  WebSocket.Sender = require_sender();
  WebSocket.WebSocket = WebSocket;
  WebSocket.WebSocketServer = WebSocket.Server;
  module.exports = WebSocket;
});

// node_modules/object-assign/index.js
var require_object_assign = __commonJS((exports, module) => {
  var getOwnPropertySymbols = Object.getOwnPropertySymbols;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var propIsEnumerable = Object.prototype.propertyIsEnumerable;
  function toObject(val) {
    if (val === null || val === undefined) {
      throw new TypeError("Object.assign cannot be called with null or undefined");
    }
    return Object(val);
  }
  function shouldUseNative() {
    try {
      if (!Object.assign) {
        return false;
      }
      var test1 = new String("abc");
      test1[5] = "de";
      if (Object.getOwnPropertyNames(test1)[0] === "5") {
        return false;
      }
      var test2 = {};
      for (var i = 0;i < 10; i++) {
        test2["_" + String.fromCharCode(i)] = i;
      }
      var order2 = Object.getOwnPropertyNames(test2).map(function(n) {
        return test2[n];
      });
      if (order2.join("") !== "0123456789") {
        return false;
      }
      var test3 = {};
      "abcdefghijklmnopqrst".split("").forEach(function(letter) {
        test3[letter] = letter;
      });
      if (Object.keys(Object.assign({}, test3)).join("") !== "abcdefghijklmnopqrst") {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }
  module.exports = shouldUseNative() ? Object.assign : function(target, source) {
    var from;
    var to = toObject(target);
    var symbols;
    for (var s = 1;s < arguments.length; s++) {
      from = Object(arguments[s]);
      for (var key in from) {
        if (hasOwnProperty.call(from, key)) {
          to[key] = from[key];
        }
      }
      if (getOwnPropertySymbols) {
        symbols = getOwnPropertySymbols(from);
        for (var i = 0;i < symbols.length; i++) {
          if (propIsEnumerable.call(from, symbols[i])) {
            to[symbols[i]] = from[symbols[i]];
          }
        }
      }
    }
    return to;
  };
});

// node_modules/vary/index.js
var require_vary = __commonJS((exports, module) => {
  /*!
   * vary
   * Copyright(c) 2014-2017 Douglas Christopher Wilson
   * MIT Licensed
   */
  module.exports = vary;
  module.exports.append = append;
  var FIELD_NAME_REGEXP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  function append(header, field) {
    if (typeof header !== "string") {
      throw new TypeError("header argument is required");
    }
    if (!field) {
      throw new TypeError("field argument is required");
    }
    var fields = !Array.isArray(field) ? parse(String(field)) : field;
    for (var j = 0;j < fields.length; j++) {
      if (!FIELD_NAME_REGEXP.test(fields[j])) {
        throw new TypeError("field argument contains an invalid header name");
      }
    }
    if (header === "*") {
      return header;
    }
    var val = header;
    var vals = parse(header.toLowerCase());
    if (fields.indexOf("*") !== -1 || vals.indexOf("*") !== -1) {
      return "*";
    }
    for (var i = 0;i < fields.length; i++) {
      var fld = fields[i].toLowerCase();
      if (vals.indexOf(fld) === -1) {
        vals.push(fld);
        val = val ? val + ", " + fields[i] : fields[i];
      }
    }
    return val;
  }
  function parse(header) {
    var end = 0;
    var list = [];
    var start = 0;
    for (var i = 0, len = header.length;i < len; i++) {
      switch (header.charCodeAt(i)) {
        case 32:
          if (start === end) {
            start = end = i + 1;
          }
          break;
        case 44:
          list.push(header.substring(start, end));
          start = end = i + 1;
          break;
        default:
          end = i + 1;
          break;
      }
    }
    list.push(header.substring(start, end));
    return list;
  }
  function vary(res, field) {
    if (!res || !res.getHeader || !res.setHeader) {
      throw new TypeError("res argument is required");
    }
    var val = res.getHeader("Vary") || "";
    var header = Array.isArray(val) ? val.join(", ") : String(val);
    if (val = append(header, field)) {
      res.setHeader("Vary", val);
    }
  }
});

// node_modules/cors/lib/index.js
var require_lib2 = __commonJS((exports, module) => {
  (function() {
    var assign = require_object_assign();
    var vary = require_vary();
    var defaults = {
      origin: "*",
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      preflightContinue: false,
      optionsSuccessStatus: 204
    };
    function isString(s) {
      return typeof s === "string" || s instanceof String;
    }
    function isOriginAllowed(origin, allowedOrigin) {
      if (Array.isArray(allowedOrigin)) {
        for (var i = 0;i < allowedOrigin.length; ++i) {
          if (isOriginAllowed(origin, allowedOrigin[i])) {
            return true;
          }
        }
        return false;
      } else if (isString(allowedOrigin)) {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      } else {
        return !!allowedOrigin;
      }
    }
    function configureOrigin(options, req) {
      var requestOrigin = req.headers.origin, headers = [], isAllowed;
      if (!options.origin || options.origin === "*") {
        headers.push([{
          key: "Access-Control-Allow-Origin",
          value: "*"
        }]);
      } else if (isString(options.origin)) {
        headers.push([{
          key: "Access-Control-Allow-Origin",
          value: options.origin
        }]);
        headers.push([{
          key: "Vary",
          value: "Origin"
        }]);
      } else {
        isAllowed = isOriginAllowed(requestOrigin, options.origin);
        headers.push([{
          key: "Access-Control-Allow-Origin",
          value: isAllowed ? requestOrigin : false
        }]);
        headers.push([{
          key: "Vary",
          value: "Origin"
        }]);
      }
      return headers;
    }
    function configureMethods(options) {
      var methods = options.methods;
      if (methods.join) {
        methods = options.methods.join(",");
      }
      return {
        key: "Access-Control-Allow-Methods",
        value: methods
      };
    }
    function configureCredentials(options) {
      if (options.credentials === true) {
        return {
          key: "Access-Control-Allow-Credentials",
          value: "true"
        };
      }
      return null;
    }
    function configureAllowedHeaders(options, req) {
      var allowedHeaders = options.allowedHeaders || options.headers;
      var headers = [];
      if (!allowedHeaders) {
        allowedHeaders = req.headers["access-control-request-headers"];
        headers.push([{
          key: "Vary",
          value: "Access-Control-Request-Headers"
        }]);
      } else if (allowedHeaders.join) {
        allowedHeaders = allowedHeaders.join(",");
      }
      if (allowedHeaders && allowedHeaders.length) {
        headers.push([{
          key: "Access-Control-Allow-Headers",
          value: allowedHeaders
        }]);
      }
      return headers;
    }
    function configureExposedHeaders(options) {
      var headers = options.exposedHeaders;
      if (!headers) {
        return null;
      } else if (headers.join) {
        headers = headers.join(",");
      }
      if (headers && headers.length) {
        return {
          key: "Access-Control-Expose-Headers",
          value: headers
        };
      }
      return null;
    }
    function configureMaxAge(options) {
      var maxAge = (typeof options.maxAge === "number" || options.maxAge) && options.maxAge.toString();
      if (maxAge && maxAge.length) {
        return {
          key: "Access-Control-Max-Age",
          value: maxAge
        };
      }
      return null;
    }
    function applyHeaders(headers, res) {
      for (var i = 0, n = headers.length;i < n; i++) {
        var header = headers[i];
        if (header) {
          if (Array.isArray(header)) {
            applyHeaders(header, res);
          } else if (header.key === "Vary" && header.value) {
            vary(res, header.value);
          } else if (header.value) {
            res.setHeader(header.key, header.value);
          }
        }
      }
    }
    function cors(options, req, res, next) {
      var headers = [], method = req.method && req.method.toUpperCase && req.method.toUpperCase();
      if (method === "OPTIONS") {
        headers.push(configureOrigin(options, req));
        headers.push(configureCredentials(options, req));
        headers.push(configureMethods(options, req));
        headers.push(configureAllowedHeaders(options, req));
        headers.push(configureMaxAge(options, req));
        headers.push(configureExposedHeaders(options, req));
        applyHeaders(headers, res);
        if (options.preflightContinue) {
          next();
        } else {
          res.statusCode = options.optionsSuccessStatus;
          res.setHeader("Content-Length", "0");
          res.end();
        }
      } else {
        headers.push(configureOrigin(options, req));
        headers.push(configureCredentials(options, req));
        headers.push(configureExposedHeaders(options, req));
        applyHeaders(headers, res);
        next();
      }
    }
    function middlewareWrapper(o) {
      var optionsCallback = null;
      if (typeof o === "function") {
        optionsCallback = o;
      } else {
        optionsCallback = function(req, cb) {
          cb(null, o);
        };
      }
      return function corsMiddleware(req, res, next) {
        optionsCallback(req, function(err, options) {
          if (err) {
            next(err);
          } else {
            var corsOptions = assign({}, defaults, options);
            var originCallback = null;
            if (corsOptions.origin && typeof corsOptions.origin === "function") {
              originCallback = corsOptions.origin;
            } else if (corsOptions.origin) {
              originCallback = function(origin, cb) {
                cb(null, corsOptions.origin);
              };
            }
            if (originCallback) {
              originCallback(req.headers.origin, function(err2, origin) {
                if (err2 || !origin) {
                  next(err2);
                } else {
                  corsOptions.origin = origin;
                  cors(corsOptions, req, res, next);
                }
              });
            } else {
              next();
            }
          }
        });
      };
    }
    module.exports = middlewareWrapper;
  })();
});

// node_modules/engine.io/build/server.js
var require_server = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Server = exports.BaseServer = undefined;
  var qs = __require("querystring");
  var url_1 = __require("url");
  var base64id = require_base64id();
  var transports_1 = require_transports();
  var events_1 = __require("events");
  var socket_1 = require_socket();
  var debug_1 = require_src();
  var cookie_1 = require_cookie();
  var ws_1 = require_ws();
  var webtransport_1 = require_webtransport();
  var engine_io_parser_1 = require_cjs();
  var debug = (0, debug_1.default)("engine");
  var kResponseHeaders = Symbol("responseHeaders");
  function parseSessionId(data) {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed.sid === "string") {
        return parsed.sid;
      }
    } catch (e) {}
  }

  class BaseServer extends events_1.EventEmitter {
    constructor(opts = {}) {
      super();
      this.middlewares = [];
      this.clients = {};
      this.clientsCount = 0;
      this.opts = Object.assign({
        wsEngine: ws_1.Server,
        pingTimeout: 20000,
        pingInterval: 25000,
        upgradeTimeout: 1e4,
        maxHttpBufferSize: 1e6,
        transports: ["polling", "websocket"],
        allowUpgrades: true,
        httpCompression: {
          threshold: 1024
        },
        cors: false,
        allowEIO3: false
      }, opts);
      if (opts.cookie) {
        this.opts.cookie = Object.assign({
          name: "io",
          path: "/",
          httpOnly: opts.cookie.path !== false,
          sameSite: "lax"
        }, opts.cookie);
      }
      if (this.opts.cors) {
        this.use(require_lib2()(this.opts.cors));
      }
      if (opts.perMessageDeflate) {
        this.opts.perMessageDeflate = Object.assign({
          threshold: 1024
        }, opts.perMessageDeflate);
      }
      this.init();
    }
    _computePath(options) {
      let path = (options.path || "/engine.io").replace(/\/$/, "");
      if (options.addTrailingSlash !== false) {
        path += "/";
      }
      return path;
    }
    upgrades(transport) {
      if (!this.opts.allowUpgrades)
        return [];
      return transports_1.default[transport].upgradesTo || [];
    }
    verify(req, upgrade, fn) {
      const transport = req._query.transport;
      if (!~this.opts.transports.indexOf(transport) || transport === "webtransport") {
        debug('unknown transport "%s"', transport);
        return fn(Server.errors.UNKNOWN_TRANSPORT, { transport });
      }
      const isOriginInvalid = checkInvalidHeaderChar(req.headers.origin);
      if (isOriginInvalid) {
        const origin = req.headers.origin;
        req.headers.origin = null;
        debug("origin header invalid");
        return fn(Server.errors.BAD_REQUEST, {
          name: "INVALID_ORIGIN",
          origin
        });
      }
      const sid = req._query.sid;
      if (sid) {
        if (!this.clients.hasOwnProperty(sid)) {
          debug('unknown sid "%s"', sid);
          return fn(Server.errors.UNKNOWN_SID, {
            sid
          });
        }
        const previousTransport = this.clients[sid].transport.name;
        if (!upgrade && previousTransport !== transport) {
          debug("bad request: unexpected transport without upgrade");
          return fn(Server.errors.BAD_REQUEST, {
            name: "TRANSPORT_MISMATCH",
            transport,
            previousTransport
          });
        }
      } else {
        if (req.method !== "GET") {
          return fn(Server.errors.BAD_HANDSHAKE_METHOD, {
            method: req.method
          });
        }
        if (transport === "websocket" && !upgrade) {
          debug("invalid transport upgrade");
          return fn(Server.errors.BAD_REQUEST, {
            name: "TRANSPORT_HANDSHAKE_ERROR"
          });
        }
        if (!this.opts.allowRequest)
          return fn();
        return this.opts.allowRequest(req, (message, success) => {
          if (!success) {
            return fn(Server.errors.FORBIDDEN, {
              message
            });
          }
          fn();
        });
      }
      fn();
    }
    use(fn) {
      this.middlewares.push(fn);
    }
    _applyMiddlewares(req, res, callback) {
      if (this.middlewares.length === 0) {
        debug("no middleware to apply, skipping");
        return callback();
      }
      const apply = (i) => {
        debug("applying middleware n°%d", i + 1);
        this.middlewares[i](req, res, (err) => {
          if (err) {
            return callback(err);
          }
          if (i + 1 < this.middlewares.length) {
            apply(i + 1);
          } else {
            callback();
          }
        });
      };
      apply(0);
    }
    close() {
      debug("closing all open clients");
      for (let i in this.clients) {
        if (this.clients.hasOwnProperty(i)) {
          this.clients[i].close(true);
        }
      }
      this.cleanup();
      return this;
    }
    generateId(req) {
      return base64id.generateId();
    }
    async handshake(transportName, req, closeConnection) {
      const protocol = req._query.EIO === "4" ? 4 : 3;
      if (protocol === 3 && !this.opts.allowEIO3) {
        debug("unsupported protocol version");
        this.emit("connection_error", {
          req,
          code: Server.errors.UNSUPPORTED_PROTOCOL_VERSION,
          message: Server.errorMessages[Server.errors.UNSUPPORTED_PROTOCOL_VERSION],
          context: {
            protocol
          }
        });
        closeConnection(Server.errors.UNSUPPORTED_PROTOCOL_VERSION);
        return;
      }
      let id;
      try {
        id = await this.generateId(req);
      } catch (e) {
        debug("error while generating an id");
        this.emit("connection_error", {
          req,
          code: Server.errors.BAD_REQUEST,
          message: Server.errorMessages[Server.errors.BAD_REQUEST],
          context: {
            name: "ID_GENERATION_ERROR",
            error: e
          }
        });
        closeConnection(Server.errors.BAD_REQUEST);
        return;
      }
      debug('handshaking client "%s"', id);
      try {
        var transport = this.createTransport(transportName, req);
        if (transportName === "polling") {
          transport.maxHttpBufferSize = this.opts.maxHttpBufferSize;
          transport.httpCompression = this.opts.httpCompression;
        } else if (transportName === "websocket") {
          transport.perMessageDeflate = this.opts.perMessageDeflate;
        }
      } catch (e) {
        debug('error handshaking to transport "%s"', transportName);
        this.emit("connection_error", {
          req,
          code: Server.errors.BAD_REQUEST,
          message: Server.errorMessages[Server.errors.BAD_REQUEST],
          context: {
            name: "TRANSPORT_HANDSHAKE_ERROR",
            error: e
          }
        });
        closeConnection(Server.errors.BAD_REQUEST);
        return;
      }
      const socket = new socket_1.Socket(id, this, transport, req, protocol);
      transport.on("headers", (headers, req2) => {
        const isInitialRequest = !req2._query.sid;
        if (isInitialRequest) {
          if (this.opts.cookie) {
            headers["Set-Cookie"] = [
              (0, cookie_1.serialize)(this.opts.cookie.name, id, this.opts.cookie)
            ];
          }
          this.emit("initial_headers", headers, req2);
        }
        this.emit("headers", headers, req2);
      });
      transport.onRequest(req);
      this.clients[id] = socket;
      this.clientsCount++;
      socket.once("close", () => {
        delete this.clients[id];
        this.clientsCount--;
      });
      this.emit("connection", socket);
      return transport;
    }
    async onWebTransportSession(session) {
      const timeout = setTimeout(() => {
        debug("the client failed to establish a bidirectional stream in the given period");
        session.close();
      }, this.opts.upgradeTimeout);
      const streamReader = session.incomingBidirectionalStreams.getReader();
      const result = await streamReader.read();
      if (result.done) {
        debug("session is closed");
        return;
      }
      const stream = result.value;
      const transformStream = (0, engine_io_parser_1.createPacketDecoderStream)(this.opts.maxHttpBufferSize, "nodebuffer");
      const reader = stream.readable.pipeThrough(transformStream).getReader();
      const { value, done } = await reader.read();
      if (done) {
        debug("stream is closed");
        return;
      }
      clearTimeout(timeout);
      if (value.type !== "open") {
        debug("invalid WebTransport handshake");
        return session.close();
      }
      if (value.data === undefined) {
        const transport = new webtransport_1.WebTransport(session, stream, reader);
        const id = base64id.generateId();
        debug('handshaking client "%s" (WebTransport)', id);
        const socket = new socket_1.Socket(id, this, transport, null, 4);
        this.clients[id] = socket;
        this.clientsCount++;
        socket.once("close", () => {
          delete this.clients[id];
          this.clientsCount--;
        });
        this.emit("connection", socket);
        return;
      }
      const sid = parseSessionId(value.data);
      if (!sid) {
        debug("invalid WebTransport handshake");
        return session.close();
      }
      const client = this.clients[sid];
      if (!client) {
        debug("upgrade attempt for closed client");
        session.close();
      } else if (client.upgrading) {
        debug("transport has already been trying to upgrade");
        session.close();
      } else if (client.upgraded) {
        debug("transport had already been upgraded");
        session.close();
      } else {
        debug("upgrading existing transport");
        const transport = new webtransport_1.WebTransport(session, stream, reader);
        client._maybeUpgrade(transport);
      }
    }
  }
  exports.BaseServer = BaseServer;
  BaseServer.errors = {
    UNKNOWN_TRANSPORT: 0,
    UNKNOWN_SID: 1,
    BAD_HANDSHAKE_METHOD: 2,
    BAD_REQUEST: 3,
    FORBIDDEN: 4,
    UNSUPPORTED_PROTOCOL_VERSION: 5
  };
  BaseServer.errorMessages = {
    0: "Transport unknown",
    1: "Session ID unknown",
    2: "Bad handshake method",
    3: "Bad request",
    4: "Forbidden",
    5: "Unsupported protocol version"
  };

  class WebSocketResponse {
    constructor(req, socket) {
      this.req = req;
      this.socket = socket;
      req[kResponseHeaders] = {};
    }
    setHeader(name, value) {
      this.req[kResponseHeaders][name] = value;
    }
    getHeader(name) {
      return this.req[kResponseHeaders][name];
    }
    removeHeader(name) {
      delete this.req[kResponseHeaders][name];
    }
    write() {}
    writeHead() {}
    end() {
      this.socket.destroy();
    }
  }

  class Server extends BaseServer {
    init() {
      if (!~this.opts.transports.indexOf("websocket"))
        return;
      if (this.ws)
        this.ws.close();
      this.ws = new this.opts.wsEngine({
        noServer: true,
        clientTracking: false,
        perMessageDeflate: this.opts.perMessageDeflate,
        maxPayload: this.opts.maxHttpBufferSize
      });
      if (typeof this.ws.on === "function") {
        this.ws.on("headers", (headersArray, req) => {
          const additionalHeaders = req[kResponseHeaders] || {};
          delete req[kResponseHeaders];
          const isInitialRequest = !req._query.sid;
          if (isInitialRequest) {
            this.emit("initial_headers", additionalHeaders, req);
          }
          this.emit("headers", additionalHeaders, req);
          debug("writing headers: %j", additionalHeaders);
          Object.keys(additionalHeaders).forEach((key) => {
            headersArray.push(`${key}: ${additionalHeaders[key]}`);
          });
        });
      }
    }
    cleanup() {
      if (this.ws) {
        debug("closing webSocketServer");
        this.ws.close();
      }
    }
    prepare(req) {
      if (!req._query) {
        req._query = ~req.url.indexOf("?") ? qs.parse((0, url_1.parse)(req.url).query) : {};
      }
    }
    createTransport(transportName, req) {
      return new transports_1.default[transportName](req);
    }
    handleRequest(req, res) {
      debug('handling "%s" http request "%s"', req.method, req.url);
      this.prepare(req);
      req.res = res;
      const callback = (errorCode, errorContext) => {
        if (errorCode !== undefined) {
          this.emit("connection_error", {
            req,
            code: errorCode,
            message: Server.errorMessages[errorCode],
            context: errorContext
          });
          abortRequest(res, errorCode, errorContext);
          return;
        }
        if (req._query.sid) {
          debug("setting new request for existing client");
          this.clients[req._query.sid].transport.onRequest(req);
        } else {
          const closeConnection = (errorCode2, errorContext2) => abortRequest(res, errorCode2, errorContext2);
          this.handshake(req._query.transport, req, closeConnection);
        }
      };
      this._applyMiddlewares(req, res, (err) => {
        if (err) {
          callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
        } else {
          this.verify(req, false, callback);
        }
      });
    }
    handleUpgrade(req, socket, upgradeHead) {
      this.prepare(req);
      const res = new WebSocketResponse(req, socket);
      const callback = (errorCode, errorContext) => {
        if (errorCode !== undefined) {
          this.emit("connection_error", {
            req,
            code: errorCode,
            message: Server.errorMessages[errorCode],
            context: errorContext
          });
          abortUpgrade(socket, errorCode, errorContext);
          return;
        }
        const head = Buffer.from(upgradeHead);
        upgradeHead = null;
        res.writeHead();
        this.ws.handleUpgrade(req, socket, head, (websocket) => {
          this.onWebSocket(req, socket, websocket);
        });
      };
      this._applyMiddlewares(req, res, (err) => {
        if (err) {
          callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
        } else {
          this.verify(req, true, callback);
        }
      });
    }
    onWebSocket(req, socket, websocket) {
      websocket.on("error", onUpgradeError);
      if (transports_1.default[req._query.transport] !== undefined && !transports_1.default[req._query.transport].prototype.handlesUpgrades) {
        debug("transport doesnt handle upgraded requests");
        websocket.close();
        return;
      }
      const id = req._query.sid;
      req.websocket = websocket;
      if (id) {
        const client = this.clients[id];
        if (!client) {
          debug("upgrade attempt for closed client");
          websocket.close();
        } else if (client.upgrading) {
          debug("transport has already been trying to upgrade");
          websocket.close();
        } else if (client.upgraded) {
          debug("transport had already been upgraded");
          websocket.close();
        } else {
          debug("upgrading existing transport");
          websocket.removeListener("error", onUpgradeError);
          const transport = this.createTransport(req._query.transport, req);
          transport.perMessageDeflate = this.opts.perMessageDeflate;
          client._maybeUpgrade(transport);
        }
      } else {
        const closeConnection = (errorCode, errorContext) => abortUpgrade(socket, errorCode, errorContext);
        this.handshake(req._query.transport, req, closeConnection);
      }
      function onUpgradeError() {
        debug("websocket error before upgrade");
      }
    }
    attach(server, options = {}) {
      const path = this._computePath(options);
      const destroyUpgradeTimeout = options.destroyUpgradeTimeout || 1000;
      function check(req) {
        return path === req.url.slice(0, path.length);
      }
      const listeners = server.listeners("request").slice(0);
      server.removeAllListeners("request");
      server.on("close", this.close.bind(this));
      server.on("listening", this.init.bind(this));
      server.on("request", (req, res) => {
        if (check(req)) {
          debug('intercepting request for path "%s"', path);
          this.handleRequest(req, res);
        } else {
          let i = 0;
          const l = listeners.length;
          for (;i < l; i++) {
            listeners[i].call(server, req, res);
          }
        }
      });
      if (~this.opts.transports.indexOf("websocket")) {
        server.on("upgrade", (req, socket, head) => {
          if (check(req)) {
            this.handleUpgrade(req, socket, head);
          } else if (options.destroyUpgrade !== false) {
            setTimeout(function() {
              if (socket.writable && socket.bytesWritten <= 0) {
                socket.on("error", (e) => {
                  debug("error while destroying upgrade: %s", e.message);
                });
                return socket.end();
              }
            }, destroyUpgradeTimeout);
          }
        });
      }
    }
  }
  exports.Server = Server;
  function abortRequest(res, errorCode, errorContext) {
    const statusCode = errorCode === Server.errors.FORBIDDEN ? 403 : 400;
    const message = errorContext && errorContext.message ? errorContext.message : Server.errorMessages[errorCode];
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      code: errorCode,
      message
    }));
  }
  function abortUpgrade(socket, errorCode, errorContext = {}) {
    socket.on("error", () => {
      debug("ignoring error from closed connection");
    });
    if (socket.writable) {
      const message = errorContext.message || Server.errorMessages[errorCode];
      const length = Buffer.byteLength(message);
      socket.write(`HTTP/1.1 400 Bad Request\r
` + `Connection: close\r
` + `Content-type: text/html\r
` + "Content-Length: " + length + `\r
` + `\r
` + message);
    }
    socket.destroy();
  }
  var validHdrChars = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1
  ];
  function checkInvalidHeaderChar(val) {
    val += "";
    if (val.length < 1)
      return false;
    if (!validHdrChars[val.charCodeAt(0)]) {
      debug('invalid header, index 0, char "%s"', val.charCodeAt(0));
      return true;
    }
    if (val.length < 2)
      return false;
    if (!validHdrChars[val.charCodeAt(1)]) {
      debug('invalid header, index 1, char "%s"', val.charCodeAt(1));
      return true;
    }
    if (val.length < 3)
      return false;
    if (!validHdrChars[val.charCodeAt(2)]) {
      debug('invalid header, index 2, char "%s"', val.charCodeAt(2));
      return true;
    }
    if (val.length < 4)
      return false;
    if (!validHdrChars[val.charCodeAt(3)]) {
      debug('invalid header, index 3, char "%s"', val.charCodeAt(3));
      return true;
    }
    for (let i = 4;i < val.length; ++i) {
      if (!validHdrChars[val.charCodeAt(i)]) {
        debug('invalid header, index "%i", char "%s"', i, val.charCodeAt(i));
        return true;
      }
    }
    return false;
  }
});

// node_modules/engine.io/build/transports-uws/polling.js
var require_polling2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Polling = undefined;
  var transport_1 = require_transport();
  var zlib_1 = __require("zlib");
  var accepts = require_accepts();
  var debug_1 = require_src();
  var debug = (0, debug_1.default)("engine:polling");
  var compressionMethods = {
    gzip: zlib_1.createGzip,
    deflate: zlib_1.createDeflate
  };

  class Polling extends transport_1.Transport {
    constructor(req) {
      super(req);
      this.closeTimeout = 30 * 1000;
    }
    get name() {
      return "polling";
    }
    onRequest(req) {
      const res = req.res;
      req.res = null;
      if (req.getMethod() === "get") {
        this.onPollRequest(req, res);
      } else if (req.getMethod() === "post") {
        this.onDataRequest(req, res);
      } else {
        res.writeStatus("500 Internal Server Error");
        res.end();
      }
    }
    onPollRequest(req, res) {
      if (this.req) {
        debug("request overlap");
        this.onError("overlap from client");
        res.writeStatus("500 Internal Server Error");
        res.end();
        return;
      }
      debug("setting request");
      this.req = req;
      this.res = res;
      const onClose = () => {
        this.writable = false;
        this.onError("poll connection closed prematurely");
      };
      const cleanup = () => {
        this.req = this.res = null;
      };
      req.cleanup = cleanup;
      res.onAborted(onClose);
      this.writable = true;
      this.emit("ready");
      if (this.writable && this.shouldClose) {
        debug("triggering empty send to append close packet");
        this.send([{ type: "noop" }]);
      }
    }
    onDataRequest(req, res) {
      if (this.dataReq) {
        this.onError("data request overlap from client");
        res.writeStatus("500 Internal Server Error");
        res.end();
        return;
      }
      const expectedContentLength = Number(req.headers["content-length"]);
      if (!expectedContentLength) {
        this.onError("content-length header required");
        res.writeStatus("411 Length Required").end();
        return;
      }
      if (expectedContentLength > this.maxHttpBufferSize) {
        this.onError("payload too large");
        res.writeStatus("413 Payload Too Large").end();
        return;
      }
      const isBinary = req.headers["content-type"] === "application/octet-stream";
      if (isBinary && this.protocol === 4) {
        return this.onError("invalid content");
      }
      this.dataReq = req;
      this.dataRes = res;
      let buffer;
      let offset = 0;
      const headers = {
        "Content-Type": "text/html"
      };
      this.headers(req, headers);
      for (let key in headers) {
        res.writeHeader(key, String(headers[key]));
      }
      const onEnd = (buffer2) => {
        this.onData(buffer2.toString());
        this.onDataRequestCleanup();
        res.cork(() => {
          res.end("ok");
        });
      };
      res.onAborted(() => {
        this.onDataRequestCleanup();
        this.onError("data request connection closed prematurely");
      });
      res.onData((arrayBuffer, isLast) => {
        const totalLength = offset + arrayBuffer.byteLength;
        if (totalLength > expectedContentLength) {
          this.onError("content-length mismatch");
          res.close();
          return;
        }
        if (!buffer) {
          if (isLast) {
            onEnd(Buffer.from(arrayBuffer));
            return;
          }
          buffer = Buffer.allocUnsafe(expectedContentLength);
        }
        Buffer.from(arrayBuffer).copy(buffer, offset);
        if (isLast) {
          if (totalLength != expectedContentLength) {
            this.onError("content-length mismatch");
            res.writeStatus("400 Content-Length Mismatch").end();
            this.onDataRequestCleanup();
            return;
          }
          onEnd(buffer);
          return;
        }
        offset = totalLength;
      });
    }
    onDataRequestCleanup() {
      this.dataReq = this.dataRes = null;
    }
    onData(data) {
      debug('received "%s"', data);
      const callback = (packet) => {
        if (packet.type === "close") {
          debug("got xhr close packet");
          this.onClose();
          return false;
        }
        this.onPacket(packet);
      };
      if (this.protocol === 3) {
        this.parser.decodePayload(data, callback);
      } else {
        this.parser.decodePayload(data).forEach(callback);
      }
    }
    onClose() {
      if (this.writable) {
        this.send([{ type: "noop" }]);
      }
      super.onClose();
    }
    send(packets) {
      this.writable = false;
      if (this.shouldClose) {
        debug("appending close packet to payload");
        packets.push({ type: "close" });
        this.shouldClose();
        this.shouldClose = null;
      }
      const doWrite = (data) => {
        const compress = packets.some((packet) => {
          return packet.options && packet.options.compress;
        });
        this.write(data, { compress });
      };
      if (this.protocol === 3) {
        this.parser.encodePayload(packets, this.supportsBinary, doWrite);
      } else {
        this.parser.encodePayload(packets, doWrite);
      }
    }
    write(data, options) {
      debug('writing "%s"', data);
      this.doWrite(data, options, () => {
        this.req.cleanup();
        this.emit("drain");
      });
    }
    doWrite(data, options, callback) {
      const isString = typeof data === "string";
      const contentType = isString ? "text/plain; charset=UTF-8" : "application/octet-stream";
      const headers = {
        "Content-Type": contentType
      };
      const respond = (data2) => {
        this.headers(this.req, headers);
        this.res.cork(() => {
          Object.keys(headers).forEach((key) => {
            this.res.writeHeader(key, String(headers[key]));
          });
          this.res.end(data2);
        });
        callback();
      };
      if (!this.httpCompression || !options.compress) {
        respond(data);
        return;
      }
      const len = isString ? Buffer.byteLength(data) : data.length;
      if (len < this.httpCompression.threshold) {
        respond(data);
        return;
      }
      const encoding = accepts(this.req).encodings(["gzip", "deflate"]);
      if (!encoding) {
        respond(data);
        return;
      }
      this.compress(data, encoding, (err, data2) => {
        if (err) {
          this.res.writeStatus("500 Internal Server Error");
          this.res.end();
          callback(err);
          return;
        }
        headers["Content-Encoding"] = encoding;
        respond(data2);
      });
    }
    compress(data, encoding, callback) {
      debug("compressing");
      const buffers = [];
      let nread = 0;
      compressionMethods[encoding](this.httpCompression).on("error", callback).on("data", function(chunk) {
        buffers.push(chunk);
        nread += chunk.length;
      }).on("end", function() {
        callback(null, Buffer.concat(buffers, nread));
      }).end(data);
    }
    doClose(fn) {
      debug("closing");
      let closeTimeoutTimer;
      const onClose = () => {
        clearTimeout(closeTimeoutTimer);
        fn();
        this.onClose();
      };
      if (this.writable) {
        debug("transport writable - closing right away");
        this.send([{ type: "close" }]);
        onClose();
      } else if (this.discarded) {
        debug("transport discarded - closing right away");
        onClose();
      } else {
        debug("transport not writable - buffering orderly close");
        this.shouldClose = onClose;
        closeTimeoutTimer = setTimeout(onClose, this.closeTimeout);
      }
    }
    headers(req, headers) {
      headers = headers || {};
      const ua = req.headers["user-agent"];
      if (ua && (~ua.indexOf(";MSIE") || ~ua.indexOf("Trident/"))) {
        headers["X-XSS-Protection"] = "0";
      }
      headers["cache-control"] = "no-store";
      this.emit("headers", headers, req);
      return headers;
    }
  }
  exports.Polling = Polling;
});

// node_modules/engine.io/build/transports-uws/websocket.js
var require_websocket3 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WebSocket = undefined;
  var transport_1 = require_transport();
  var debug_1 = require_src();
  var debug = (0, debug_1.default)("engine:ws");

  class WebSocket extends transport_1.Transport {
    constructor(req) {
      super(req);
      this.writable = false;
      this.perMessageDeflate = null;
    }
    get name() {
      return "websocket";
    }
    get handlesUpgrades() {
      return true;
    }
    send(packets) {
      this.writable = false;
      for (let i = 0;i < packets.length; i++) {
        const packet = packets[i];
        const isLast = i + 1 === packets.length;
        const send = (data) => {
          const isBinary = typeof data !== "string";
          const compress = this.perMessageDeflate && Buffer.byteLength(data) > this.perMessageDeflate.threshold;
          debug('writing "%s"', data);
          this.socket.send(data, isBinary, compress);
          if (isLast) {
            this.emit("drain");
            this.writable = true;
            this.emit("ready");
          }
        };
        if (packet.options && typeof packet.options.wsPreEncoded === "string") {
          send(packet.options.wsPreEncoded);
        } else {
          this.parser.encodePacket(packet, this.supportsBinary, send);
        }
      }
    }
    doClose(fn) {
      debug("closing");
      fn && fn();
      this.socket.end();
    }
  }
  exports.WebSocket = WebSocket;
});

// node_modules/engine.io/build/transports-uws/index.js
var require_transports_uws = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var polling_1 = require_polling2();
  var websocket_1 = require_websocket3();
  exports.default = {
    polling: polling_1.Polling,
    websocket: websocket_1.WebSocket
  };
});

// node_modules/engine.io/build/userver.js
var require_userver = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.uServer = undefined;
  var debug_1 = require_src();
  var server_1 = require_server();
  var transports_uws_1 = require_transports_uws();
  var debug = (0, debug_1.default)("engine:uws");

  class uServer extends server_1.BaseServer {
    init() {}
    cleanup() {}
    prepare(req, res) {
      req.method = req.getMethod().toUpperCase();
      req.url = req.getUrl();
      const params = new URLSearchParams(req.getQuery());
      req._query = Object.fromEntries(params.entries());
      req.headers = {};
      req.forEach((key, value) => {
        req.headers[key] = value;
      });
      req.connection = {
        remoteAddress: Buffer.from(res.getRemoteAddressAsText()).toString()
      };
      res.onAborted(() => {
        debug("response has been aborted");
      });
    }
    createTransport(transportName, req) {
      return new transports_uws_1.default[transportName](req);
    }
    attach(app, options = {}) {
      const path = this._computePath(options);
      app.any(path, this.handleRequest.bind(this)).ws(path, {
        compression: options.compression,
        idleTimeout: options.idleTimeout,
        maxBackpressure: options.maxBackpressure,
        maxPayloadLength: this.opts.maxHttpBufferSize,
        upgrade: this.handleUpgrade.bind(this),
        open: (ws) => {
          const transport = ws.getUserData().transport;
          transport.socket = ws;
          transport.writable = true;
          transport.emit("ready");
        },
        message: (ws, message, isBinary) => {
          ws.getUserData().transport.onData(isBinary ? message : Buffer.from(message).toString());
        },
        close: (ws, code, message) => {
          ws.getUserData().transport.onClose(code, message);
        }
      });
    }
    _applyMiddlewares(req, res, callback) {
      if (this.middlewares.length === 0) {
        return callback();
      }
      req.res = new ResponseWrapper(res);
      super._applyMiddlewares(req, req.res, (err) => {
        req.res.writeHead();
        callback(err);
      });
    }
    handleRequest(res, req) {
      debug('handling "%s" http request "%s"', req.getMethod(), req.getUrl());
      this.prepare(req, res);
      req.res = res;
      const callback = (errorCode, errorContext) => {
        if (errorCode !== undefined) {
          this.emit("connection_error", {
            req,
            code: errorCode,
            message: server_1.Server.errorMessages[errorCode],
            context: errorContext
          });
          this.abortRequest(req.res, errorCode, errorContext);
          return;
        }
        if (req._query.sid) {
          debug("setting new request for existing client");
          this.clients[req._query.sid].transport.onRequest(req);
        } else {
          const closeConnection = (errorCode2, errorContext2) => this.abortRequest(res, errorCode2, errorContext2);
          this.handshake(req._query.transport, req, closeConnection);
        }
      };
      this._applyMiddlewares(req, res, (err) => {
        if (err) {
          callback(server_1.Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
        } else {
          this.verify(req, false, callback);
        }
      });
    }
    handleUpgrade(res, req, context) {
      debug("on upgrade");
      this.prepare(req, res);
      req.res = res;
      const callback = async (errorCode, errorContext) => {
        if (errorCode !== undefined) {
          this.emit("connection_error", {
            req,
            code: errorCode,
            message: server_1.Server.errorMessages[errorCode],
            context: errorContext
          });
          this.abortRequest(res, errorCode, errorContext);
          return;
        }
        const id = req._query.sid;
        let transport;
        if (id) {
          const client = this.clients[id];
          if (!client) {
            debug("upgrade attempt for closed client");
            return res.close();
          } else if (client.upgrading) {
            debug("transport has already been trying to upgrade");
            return res.close();
          } else if (client.upgraded) {
            debug("transport had already been upgraded");
            return res.close();
          } else {
            debug("upgrading existing transport");
            transport = this.createTransport(req._query.transport, req);
            client._maybeUpgrade(transport);
          }
        } else {
          transport = await this.handshake(req._query.transport, req, (errorCode2, errorContext2) => this.abortRequest(res, errorCode2, errorContext2));
          if (!transport) {
            return;
          }
        }
        req.res.writeStatus("101 Switching Protocols");
        res.upgrade({
          transport
        }, req.getHeader("sec-websocket-key"), req.getHeader("sec-websocket-protocol"), req.getHeader("sec-websocket-extensions"), context);
      };
      this._applyMiddlewares(req, res, (err) => {
        if (err) {
          callback(server_1.Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
        } else {
          this.verify(req, true, callback);
        }
      });
    }
    abortRequest(res, errorCode, errorContext) {
      const statusCode = errorCode === server_1.Server.errors.FORBIDDEN ? "403 Forbidden" : "400 Bad Request";
      const message = errorContext && errorContext.message ? errorContext.message : server_1.Server.errorMessages[errorCode];
      res.writeStatus(statusCode);
      res.writeHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        code: errorCode,
        message
      }));
    }
  }
  exports.uServer = uServer;

  class ResponseWrapper {
    constructor(res) {
      this.res = res;
      this.statusWritten = false;
      this.headers = [];
      this.isAborted = false;
    }
    set statusCode(status) {
      if (!status) {
        return;
      }
      this.writeStatus(status === 200 ? "200 OK" : "204 No Content");
    }
    writeHead(status) {
      this.statusCode = status;
    }
    setHeader(key, value) {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          this.writeHeader(key, val);
        });
      } else {
        this.writeHeader(key, value);
      }
    }
    removeHeader() {}
    getHeader() {}
    writeStatus(status) {
      if (this.isAborted)
        return;
      this.res.writeStatus(status);
      this.statusWritten = true;
      this.writeBufferedHeaders();
      return this;
    }
    writeHeader(key, value) {
      if (this.isAborted)
        return;
      if (key === "Content-Length") {
        return;
      }
      if (this.statusWritten) {
        this.res.writeHeader(key, value);
      } else {
        this.headers.push([key, value]);
      }
    }
    writeBufferedHeaders() {
      this.headers.forEach(([key, value]) => {
        this.res.writeHeader(key, value);
      });
    }
    end(data) {
      if (this.isAborted)
        return;
      this.res.cork(() => {
        if (!this.statusWritten) {
          this.writeBufferedHeaders();
        }
        this.res.end(data);
      });
    }
    onData(fn) {
      if (this.isAborted)
        return;
      this.res.onData(fn);
    }
    onAborted(fn) {
      if (this.isAborted)
        return;
      this.res.onAborted(() => {
        this.isAborted = true;
        fn();
      });
    }
    cork(fn) {
      if (this.isAborted)
        return;
      this.res.cork(fn);
    }
  }
});

// node_modules/engine.io/build/engine.io.js
var require_engine_io = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.protocol = exports.Transport = exports.Socket = exports.uServer = exports.parser = exports.transports = exports.Server = undefined;
  exports.listen = listen;
  exports.attach = attach;
  var http_1 = __require("http");
  var server_1 = require_server();
  Object.defineProperty(exports, "Server", { enumerable: true, get: function() {
    return server_1.Server;
  } });
  var index_1 = require_transports();
  exports.transports = index_1.default;
  var parser = require_cjs();
  exports.parser = parser;
  var userver_1 = require_userver();
  Object.defineProperty(exports, "uServer", { enumerable: true, get: function() {
    return userver_1.uServer;
  } });
  var socket_1 = require_socket();
  Object.defineProperty(exports, "Socket", { enumerable: true, get: function() {
    return socket_1.Socket;
  } });
  var transport_1 = require_transport();
  Object.defineProperty(exports, "Transport", { enumerable: true, get: function() {
    return transport_1.Transport;
  } });
  exports.protocol = parser.protocol;
  function listen(port, options, fn) {
    if (typeof options === "function") {
      fn = options;
      options = {};
    }
    const server = (0, http_1.createServer)(function(req, res) {
      res.writeHead(501);
      res.end("Not Implemented");
    });
    const engine = attach(server, options);
    engine.httpServer = server;
    server.listen(port, fn);
    return engine;
  }
  function attach(server, options) {
    const engine = new server_1.Server(options);
    engine.attach(server, options);
    return engine;
  }
});

// node_modules/@socket.io/component-emitter/lib/cjs/index.js
var require_cjs2 = __commonJS((exports) => {
  exports.Emitter = Emitter;
  function Emitter(obj) {
    if (obj)
      return mixin(obj);
  }
  function mixin(obj) {
    for (var key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }
  Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn) {
    this._callbacks = this._callbacks || {};
    (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn);
    return this;
  };
  Emitter.prototype.once = function(event, fn) {
    function on() {
      this.off(event, on);
      fn.apply(this, arguments);
    }
    on.fn = fn;
    this.on(event, on);
    return this;
  };
  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn) {
    this._callbacks = this._callbacks || {};
    if (arguments.length == 0) {
      this._callbacks = {};
      return this;
    }
    var callbacks = this._callbacks["$" + event];
    if (!callbacks)
      return this;
    if (arguments.length == 1) {
      delete this._callbacks["$" + event];
      return this;
    }
    var cb;
    for (var i = 0;i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }
    if (callbacks.length === 0) {
      delete this._callbacks["$" + event];
    }
    return this;
  };
  Emitter.prototype.emit = function(event) {
    this._callbacks = this._callbacks || {};
    var args = new Array(arguments.length - 1), callbacks = this._callbacks["$" + event];
    for (var i = 1;i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length;i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }
    return this;
  };
  Emitter.prototype.emitReserved = Emitter.prototype.emit;
  Emitter.prototype.listeners = function(event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks["$" + event] || [];
  };
  Emitter.prototype.hasListeners = function(event) {
    return !!this.listeners(event).length;
  };
});

// node_modules/socket.io-parser/build/cjs/is-binary.js
var require_is_binary = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.hasBinary = exports.isBinary = undefined;
  var withNativeArrayBuffer = typeof ArrayBuffer === "function";
  var isView = (obj) => {
    return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj.buffer instanceof ArrayBuffer;
  };
  var toString = Object.prototype.toString;
  var withNativeBlob = typeof Blob === "function" || typeof Blob !== "undefined" && toString.call(Blob) === "[object BlobConstructor]";
  var withNativeFile = typeof File === "function" || typeof File !== "undefined" && toString.call(File) === "[object FileConstructor]";
  function isBinary(obj) {
    return withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)) || withNativeBlob && obj instanceof Blob || withNativeFile && obj instanceof File;
  }
  exports.isBinary = isBinary;
  function hasBinary(obj, toJSON) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    if (Array.isArray(obj)) {
      for (let i = 0, l = obj.length;i < l; i++) {
        if (hasBinary(obj[i])) {
          return true;
        }
      }
      return false;
    }
    if (isBinary(obj)) {
      return true;
    }
    if (obj.toJSON && typeof obj.toJSON === "function" && arguments.length === 1) {
      return hasBinary(obj.toJSON(), true);
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
        return true;
      }
    }
    return false;
  }
  exports.hasBinary = hasBinary;
});

// node_modules/socket.io-parser/build/cjs/binary.js
var require_binary = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.reconstructPacket = exports.deconstructPacket = undefined;
  var is_binary_js_1 = require_is_binary();
  function deconstructPacket(packet) {
    const buffers = [];
    const packetData = packet.data;
    const pack = packet;
    pack.data = _deconstructPacket(packetData, buffers);
    pack.attachments = buffers.length;
    return { packet: pack, buffers };
  }
  exports.deconstructPacket = deconstructPacket;
  function _deconstructPacket(data, buffers) {
    if (!data)
      return data;
    if ((0, is_binary_js_1.isBinary)(data)) {
      const placeholder = { _placeholder: true, num: buffers.length };
      buffers.push(data);
      return placeholder;
    } else if (Array.isArray(data)) {
      const newData = new Array(data.length);
      for (let i = 0;i < data.length; i++) {
        newData[i] = _deconstructPacket(data[i], buffers);
      }
      return newData;
    } else if (typeof data === "object" && !(data instanceof Date)) {
      const newData = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          newData[key] = _deconstructPacket(data[key], buffers);
        }
      }
      return newData;
    }
    return data;
  }
  function reconstructPacket(packet, buffers) {
    packet.data = _reconstructPacket(packet.data, buffers);
    delete packet.attachments;
    return packet;
  }
  exports.reconstructPacket = reconstructPacket;
  function _reconstructPacket(data, buffers) {
    if (!data)
      return data;
    if (data && data._placeholder === true) {
      const isIndexValid = typeof data.num === "number" && data.num >= 0 && data.num < buffers.length;
      if (isIndexValid) {
        return buffers[data.num];
      } else {
        throw new Error("illegal attachments");
      }
    } else if (Array.isArray(data)) {
      for (let i = 0;i < data.length; i++) {
        data[i] = _reconstructPacket(data[i], buffers);
      }
    } else if (typeof data === "object") {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = _reconstructPacket(data[key], buffers);
        }
      }
    }
    return data;
  }
});

// node_modules/socket.io-parser/node_modules/debug/src/common.js
var require_common2 = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce2;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      let i;
      const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      const len = split.length;
      for (i = 0;i < len; i++) {
        if (!split[i]) {
          continue;
        }
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
        } else {
          createDebug.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      const namespaces = [
        ...createDebug.names.map(toNamespace),
        ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      if (name[name.length - 1] === "*") {
        return true;
      }
      let i;
      let len;
      for (i = 0, len = createDebug.skips.length;i < len; i++) {
        if (createDebug.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = createDebug.names.length;i < len; i++) {
        if (createDebug.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function toNamespace(regexp) {
      return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
    }
    function coerce2(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/socket.io-parser/node_modules/debug/src/browser.js
var require_browser2 = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common2()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/socket.io-parser/node_modules/debug/src/node.js
var require_node2 = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util3 = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util3.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = require_supports_color();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util3.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common2()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts);
  };
});

// node_modules/socket.io-parser/node_modules/debug/src/index.js
var require_src2 = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser2();
  } else {
    module.exports = require_node2();
  }
});

// node_modules/socket.io-parser/build/cjs/index.js
var require_cjs3 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Decoder = exports.Encoder = exports.PacketType = exports.protocol = undefined;
  var component_emitter_1 = require_cjs2();
  var binary_js_1 = require_binary();
  var is_binary_js_1 = require_is_binary();
  var debug_1 = require_src2();
  var debug = (0, debug_1.default)("socket.io-parser");
  var RESERVED_EVENTS = [
    "connect",
    "connect_error",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener"
  ];
  exports.protocol = 5;
  var PacketType;
  (function(PacketType2) {
    PacketType2[PacketType2["CONNECT"] = 0] = "CONNECT";
    PacketType2[PacketType2["DISCONNECT"] = 1] = "DISCONNECT";
    PacketType2[PacketType2["EVENT"] = 2] = "EVENT";
    PacketType2[PacketType2["ACK"] = 3] = "ACK";
    PacketType2[PacketType2["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
    PacketType2[PacketType2["BINARY_EVENT"] = 5] = "BINARY_EVENT";
    PacketType2[PacketType2["BINARY_ACK"] = 6] = "BINARY_ACK";
  })(PacketType = exports.PacketType || (exports.PacketType = {}));

  class Encoder {
    constructor(replacer) {
      this.replacer = replacer;
    }
    encode(obj) {
      debug("encoding packet %j", obj);
      if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
        if ((0, is_binary_js_1.hasBinary)(obj)) {
          return this.encodeAsBinary({
            type: obj.type === PacketType.EVENT ? PacketType.BINARY_EVENT : PacketType.BINARY_ACK,
            nsp: obj.nsp,
            data: obj.data,
            id: obj.id
          });
        }
      }
      return [this.encodeAsString(obj)];
    }
    encodeAsString(obj) {
      let str = "" + obj.type;
      if (obj.type === PacketType.BINARY_EVENT || obj.type === PacketType.BINARY_ACK) {
        str += obj.attachments + "-";
      }
      if (obj.nsp && obj.nsp !== "/") {
        str += obj.nsp + ",";
      }
      if (obj.id != null) {
        str += obj.id;
      }
      if (obj.data != null) {
        str += JSON.stringify(obj.data, this.replacer);
      }
      debug("encoded %j as %s", obj, str);
      return str;
    }
    encodeAsBinary(obj) {
      const deconstruction = (0, binary_js_1.deconstructPacket)(obj);
      const pack = this.encodeAsString(deconstruction.packet);
      const buffers = deconstruction.buffers;
      buffers.unshift(pack);
      return buffers;
    }
  }
  exports.Encoder = Encoder;
  function isObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  class Decoder extends component_emitter_1.Emitter {
    constructor(reviver) {
      super();
      this.reviver = reviver;
    }
    add(obj) {
      let packet;
      if (typeof obj === "string") {
        if (this.reconstructor) {
          throw new Error("got plaintext data when reconstructing a packet");
        }
        packet = this.decodeString(obj);
        const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
        if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
          packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
          this.reconstructor = new BinaryReconstructor(packet);
          if (packet.attachments === 0) {
            super.emitReserved("decoded", packet);
          }
        } else {
          super.emitReserved("decoded", packet);
        }
      } else if ((0, is_binary_js_1.isBinary)(obj) || obj.base64) {
        if (!this.reconstructor) {
          throw new Error("got binary data when not reconstructing a packet");
        } else {
          packet = this.reconstructor.takeBinaryData(obj);
          if (packet) {
            this.reconstructor = null;
            super.emitReserved("decoded", packet);
          }
        }
      } else {
        throw new Error("Unknown type: " + obj);
      }
    }
    decodeString(str) {
      let i = 0;
      const p = {
        type: Number(str.charAt(0))
      };
      if (PacketType[p.type] === undefined) {
        throw new Error("unknown packet type " + p.type);
      }
      if (p.type === PacketType.BINARY_EVENT || p.type === PacketType.BINARY_ACK) {
        const start = i + 1;
        while (str.charAt(++i) !== "-" && i != str.length) {}
        const buf = str.substring(start, i);
        if (buf != Number(buf) || str.charAt(i) !== "-") {
          throw new Error("Illegal attachments");
        }
        p.attachments = Number(buf);
      }
      if (str.charAt(i + 1) === "/") {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if (c === ",")
            break;
          if (i === str.length)
            break;
        }
        p.nsp = str.substring(start, i);
      } else {
        p.nsp = "/";
      }
      const next = str.charAt(i + 1);
      if (next !== "" && Number(next) == next) {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if (c == null || Number(c) != c) {
            --i;
            break;
          }
          if (i === str.length)
            break;
        }
        p.id = Number(str.substring(start, i + 1));
      }
      if (str.charAt(++i)) {
        const payload = this.tryParse(str.substr(i));
        if (Decoder.isPayloadValid(p.type, payload)) {
          p.data = payload;
        } else {
          throw new Error("invalid payload");
        }
      }
      debug("decoded %s as %j", str, p);
      return p;
    }
    tryParse(str) {
      try {
        return JSON.parse(str, this.reviver);
      } catch (e) {
        return false;
      }
    }
    static isPayloadValid(type, payload) {
      switch (type) {
        case PacketType.CONNECT:
          return isObject(payload);
        case PacketType.DISCONNECT:
          return payload === undefined;
        case PacketType.CONNECT_ERROR:
          return typeof payload === "string" || isObject(payload);
        case PacketType.EVENT:
        case PacketType.BINARY_EVENT:
          return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS.indexOf(payload[0]) === -1);
        case PacketType.ACK:
        case PacketType.BINARY_ACK:
          return Array.isArray(payload);
      }
    }
    destroy() {
      if (this.reconstructor) {
        this.reconstructor.finishedReconstruction();
        this.reconstructor = null;
      }
    }
  }
  exports.Decoder = Decoder;

  class BinaryReconstructor {
    constructor(packet) {
      this.packet = packet;
      this.buffers = [];
      this.reconPack = packet;
    }
    takeBinaryData(binData) {
      this.buffers.push(binData);
      if (this.buffers.length === this.reconPack.attachments) {
        const packet = (0, binary_js_1.reconstructPacket)(this.reconPack, this.buffers);
        this.finishedReconstruction();
        return packet;
      }
      return null;
    }
    finishedReconstruction() {
      this.reconPack = null;
      this.buffers = [];
    }
  }
});

// node_modules/socket.io/node_modules/debug/src/common.js
var require_common3 = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce2;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      let i;
      const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      const len = split.length;
      for (i = 0;i < len; i++) {
        if (!split[i]) {
          continue;
        }
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
        } else {
          createDebug.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      const namespaces = [
        ...createDebug.names.map(toNamespace),
        ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      if (name[name.length - 1] === "*") {
        return true;
      }
      let i;
      let len;
      for (i = 0, len = createDebug.skips.length;i < len; i++) {
        if (createDebug.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = createDebug.names.length;i < len; i++) {
        if (createDebug.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function toNamespace(regexp) {
      return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
    }
    function coerce2(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/socket.io/node_modules/debug/src/browser.js
var require_browser3 = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common3()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/socket.io/node_modules/debug/src/node.js
var require_node3 = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util3 = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util3.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = require_supports_color();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util3.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common3()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts);
  };
});

// node_modules/socket.io/node_modules/debug/src/index.js
var require_src3 = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser3();
  } else {
    module.exports = require_node3();
  }
});

// node_modules/socket.io/dist/client.js
var require_client = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Client = undefined;
  var socket_io_parser_1 = require_cjs3();
  var debugModule = require_src3();
  var url = __require("url");
  var debug = debugModule("socket.io:client");

  class Client {
    constructor(server, conn) {
      this.sockets = new Map;
      this.nsps = new Map;
      this.server = server;
      this.conn = conn;
      this.encoder = server.encoder;
      this.decoder = new server._parser.Decoder;
      this.id = conn.id;
      this.setup();
    }
    get request() {
      return this.conn.request;
    }
    setup() {
      this.onclose = this.onclose.bind(this);
      this.ondata = this.ondata.bind(this);
      this.onerror = this.onerror.bind(this);
      this.ondecoded = this.ondecoded.bind(this);
      this.decoder.on("decoded", this.ondecoded);
      this.conn.on("data", this.ondata);
      this.conn.on("error", this.onerror);
      this.conn.on("close", this.onclose);
      this.connectTimeout = setTimeout(() => {
        if (this.nsps.size === 0) {
          debug("no namespace joined yet, close the client");
          this.close();
        } else {
          debug("the client has already joined a namespace, nothing to do");
        }
      }, this.server._connectTimeout);
    }
    connect(name, auth = {}) {
      if (this.server._nsps.has(name)) {
        debug("connecting to namespace %s", name);
        return this.doConnect(name, auth);
      }
      this.server._checkNamespace(name, auth, (dynamicNspName) => {
        if (dynamicNspName) {
          this.doConnect(name, auth);
        } else {
          debug("creation of namespace %s was denied", name);
          this._packet({
            type: socket_io_parser_1.PacketType.CONNECT_ERROR,
            nsp: name,
            data: {
              message: "Invalid namespace"
            }
          });
        }
      });
    }
    doConnect(name, auth) {
      const nsp = this.server.of(name);
      nsp._add(this, auth, (socket) => {
        this.sockets.set(socket.id, socket);
        this.nsps.set(nsp.name, socket);
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = undefined;
        }
      });
    }
    _disconnect() {
      for (const socket of this.sockets.values()) {
        socket.disconnect();
      }
      this.sockets.clear();
      this.close();
    }
    _remove(socket) {
      if (this.sockets.has(socket.id)) {
        const nsp = this.sockets.get(socket.id).nsp.name;
        this.sockets.delete(socket.id);
        this.nsps.delete(nsp);
      } else {
        debug("ignoring remove for %s", socket.id);
      }
    }
    close() {
      if (this.conn.readyState === "open") {
        debug("forcing transport close");
        this.conn.close();
        this.onclose("forced server close");
      }
    }
    _packet(packet, opts = {}) {
      if (this.conn.readyState !== "open") {
        debug("ignoring packet write %j", packet);
        return;
      }
      const encodedPackets = opts.preEncoded ? packet : this.encoder.encode(packet);
      this.writeToEngine(encodedPackets, opts);
    }
    writeToEngine(encodedPackets, opts) {
      if (opts.volatile && !this.conn.transport.writable) {
        debug("volatile packet is discarded since the transport is not currently writable");
        return;
      }
      const packets = Array.isArray(encodedPackets) ? encodedPackets : [encodedPackets];
      for (const encodedPacket of packets) {
        this.conn.write(encodedPacket, opts);
      }
    }
    ondata(data) {
      try {
        this.decoder.add(data);
      } catch (e) {
        debug("invalid packet format");
        this.onerror(e);
      }
    }
    ondecoded(packet) {
      let namespace;
      let authPayload;
      if (this.conn.protocol === 3) {
        const parsed = url.parse(packet.nsp, true);
        namespace = parsed.pathname;
        authPayload = parsed.query;
      } else {
        namespace = packet.nsp;
        authPayload = packet.data;
      }
      const socket = this.nsps.get(namespace);
      if (!socket && packet.type === socket_io_parser_1.PacketType.CONNECT) {
        this.connect(namespace, authPayload);
      } else if (socket && packet.type !== socket_io_parser_1.PacketType.CONNECT && packet.type !== socket_io_parser_1.PacketType.CONNECT_ERROR) {
        process.nextTick(function() {
          socket._onpacket(packet);
        });
      } else {
        debug("invalid state (packet type: %s)", packet.type);
        this.close();
      }
    }
    onerror(err) {
      for (const socket of this.sockets.values()) {
        socket._onerror(err);
      }
      this.conn.close();
    }
    onclose(reason, description) {
      debug("client close with reason %s", reason);
      this.destroy();
      for (const socket of this.sockets.values()) {
        socket._onclose(reason, description);
      }
      this.sockets.clear();
      this.decoder.destroy();
    }
    destroy() {
      this.conn.removeListener("data", this.ondata);
      this.conn.removeListener("error", this.onerror);
      this.conn.removeListener("close", this.onclose);
      this.decoder.removeListener("decoded", this.ondecoded);
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
    }
  }
  exports.Client = Client;
});

// node_modules/socket.io/dist/typed-events.js
var require_typed_events = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.StrictEventEmitter = undefined;
  var events_1 = __require("events");

  class StrictEventEmitter extends events_1.EventEmitter {
    on(ev, listener) {
      return super.on(ev, listener);
    }
    once(ev, listener) {
      return super.once(ev, listener);
    }
    emit(ev, ...args) {
      return super.emit(ev, ...args);
    }
    emitReserved(ev, ...args) {
      return super.emit(ev, ...args);
    }
    emitUntyped(ev, ...args) {
      return super.emit(ev, ...args);
    }
    listeners(event) {
      return super.listeners(event);
    }
  }
  exports.StrictEventEmitter = StrictEventEmitter;
});

// node_modules/socket.io/dist/socket-types.js
var require_socket_types = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.RESERVED_EVENTS = undefined;
  exports.RESERVED_EVENTS = new Set([
    "connect",
    "connect_error",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener"
  ]);
});

// node_modules/socket.io/dist/broadcast-operator.js
var require_broadcast_operator = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.RemoteSocket = exports.BroadcastOperator = undefined;
  var socket_types_1 = require_socket_types();
  var socket_io_parser_1 = require_cjs3();

  class BroadcastOperator {
    constructor(adapter, rooms = new Set, exceptRooms = new Set, flags = {}) {
      this.adapter = adapter;
      this.rooms = rooms;
      this.exceptRooms = exceptRooms;
      this.flags = flags;
    }
    to(room) {
      const rooms = new Set(this.rooms);
      if (Array.isArray(room)) {
        room.forEach((r) => rooms.add(r));
      } else {
        rooms.add(room);
      }
      return new BroadcastOperator(this.adapter, rooms, this.exceptRooms, this.flags);
    }
    in(room) {
      return this.to(room);
    }
    except(room) {
      const exceptRooms = new Set(this.exceptRooms);
      if (Array.isArray(room)) {
        room.forEach((r) => exceptRooms.add(r));
      } else {
        exceptRooms.add(room);
      }
      return new BroadcastOperator(this.adapter, this.rooms, exceptRooms, this.flags);
    }
    compress(compress) {
      const flags = Object.assign({}, this.flags, { compress });
      return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
    }
    get volatile() {
      const flags = Object.assign({}, this.flags, { volatile: true });
      return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
    }
    get local() {
      const flags = Object.assign({}, this.flags, { local: true });
      return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
    }
    timeout(timeout) {
      const flags = Object.assign({}, this.flags, { timeout });
      return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
    }
    emit(ev, ...args) {
      if (socket_types_1.RESERVED_EVENTS.has(ev)) {
        throw new Error(`"${String(ev)}" is a reserved event name`);
      }
      const data = [ev, ...args];
      const packet = {
        type: socket_io_parser_1.PacketType.EVENT,
        data
      };
      const withAck = typeof data[data.length - 1] === "function";
      if (!withAck) {
        this.adapter.broadcast(packet, {
          rooms: this.rooms,
          except: this.exceptRooms,
          flags: this.flags
        });
        return true;
      }
      const ack = data.pop();
      let timedOut = false;
      let responses = [];
      const timer = setTimeout(() => {
        timedOut = true;
        ack.apply(this, [
          new Error("operation has timed out"),
          this.flags.expectSingleResponse ? null : responses
        ]);
      }, this.flags.timeout);
      let expectedServerCount = -1;
      let actualServerCount = 0;
      let expectedClientCount = 0;
      const checkCompleteness = () => {
        if (!timedOut && expectedServerCount === actualServerCount && responses.length === expectedClientCount) {
          clearTimeout(timer);
          ack.apply(this, [
            null,
            this.flags.expectSingleResponse ? responses[0] : responses
          ]);
        }
      };
      this.adapter.broadcastWithAck(packet, {
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      }, (clientCount) => {
        expectedClientCount += clientCount;
        actualServerCount++;
        checkCompleteness();
      }, (clientResponse) => {
        responses.push(clientResponse);
        checkCompleteness();
      });
      this.adapter.serverCount().then((serverCount) => {
        expectedServerCount = serverCount;
        checkCompleteness();
      });
      return true;
    }
    emitWithAck(ev, ...args) {
      return new Promise((resolve, reject) => {
        args.push((err, responses) => {
          if (err) {
            err.responses = responses;
            return reject(err);
          } else {
            return resolve(responses);
          }
        });
        this.emit(ev, ...args);
      });
    }
    allSockets() {
      if (!this.adapter) {
        throw new Error("No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?");
      }
      return this.adapter.sockets(this.rooms);
    }
    fetchSockets() {
      return this.adapter.fetchSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      }).then((sockets) => {
        return sockets.map((socket) => {
          if (socket.server) {
            return socket;
          } else {
            return new RemoteSocket(this.adapter, socket);
          }
        });
      });
    }
    socketsJoin(room) {
      this.adapter.addSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      }, Array.isArray(room) ? room : [room]);
    }
    socketsLeave(room) {
      this.adapter.delSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      }, Array.isArray(room) ? room : [room]);
    }
    disconnectSockets(close = false) {
      this.adapter.disconnectSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      }, close);
    }
  }
  exports.BroadcastOperator = BroadcastOperator;

  class RemoteSocket {
    constructor(adapter, details) {
      this.id = details.id;
      this.handshake = details.handshake;
      this.rooms = new Set(details.rooms);
      this.data = details.data;
      this.operator = new BroadcastOperator(adapter, new Set([this.id]), new Set, {
        expectSingleResponse: true
      });
    }
    timeout(timeout) {
      return this.operator.timeout(timeout);
    }
    emit(ev, ...args) {
      return this.operator.emit(ev, ...args);
    }
    join(room) {
      return this.operator.socketsJoin(room);
    }
    leave(room) {
      return this.operator.socketsLeave(room);
    }
    disconnect(close = false) {
      this.operator.disconnectSockets(close);
      return this;
    }
  }
  exports.RemoteSocket = RemoteSocket;
});

// node_modules/socket.io/dist/socket.js
var require_socket2 = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Socket = undefined;
  var socket_io_parser_1 = require_cjs3();
  var debug_1 = __importDefault(require_src3());
  var typed_events_1 = require_typed_events();
  var base64id_1 = __importDefault(require_base64id());
  var broadcast_operator_1 = require_broadcast_operator();
  var socket_types_1 = require_socket_types();
  var debug = (0, debug_1.default)("socket.io:socket");
  var RECOVERABLE_DISCONNECT_REASONS = new Set([
    "transport error",
    "transport close",
    "forced close",
    "ping timeout",
    "server shutting down",
    "forced server close"
  ]);
  function noop() {}

  class Socket extends typed_events_1.StrictEventEmitter {
    constructor(nsp, client, auth, previousSession) {
      super();
      this.nsp = nsp;
      this.client = client;
      this.recovered = false;
      this.data = {};
      this.connected = false;
      this.acks = new Map;
      this.fns = [];
      this.flags = {};
      this.server = nsp.server;
      this.adapter = this.nsp.adapter;
      if (previousSession) {
        this.id = previousSession.sid;
        this.pid = previousSession.pid;
        previousSession.rooms.forEach((room) => this.join(room));
        this.data = previousSession.data;
        previousSession.missedPackets.forEach((packet) => {
          this.packet({
            type: socket_io_parser_1.PacketType.EVENT,
            data: packet
          });
        });
        this.recovered = true;
      } else {
        if (client.conn.protocol === 3) {
          this.id = nsp.name !== "/" ? nsp.name + "#" + client.id : client.id;
        } else {
          this.id = base64id_1.default.generateId();
        }
        if (this.server._opts.connectionStateRecovery) {
          this.pid = base64id_1.default.generateId();
        }
      }
      this.handshake = this.buildHandshake(auth);
      this.on("error", noop);
    }
    buildHandshake(auth) {
      var _a, _b, _c, _d;
      return {
        headers: ((_a = this.request) === null || _a === undefined ? undefined : _a.headers) || {},
        time: new Date + "",
        address: this.conn.remoteAddress,
        xdomain: !!((_b = this.request) === null || _b === undefined ? undefined : _b.headers.origin),
        secure: !this.request || !!this.request.connection.encrypted,
        issued: +new Date,
        url: (_c = this.request) === null || _c === undefined ? undefined : _c.url,
        query: ((_d = this.request) === null || _d === undefined ? undefined : _d._query) || {},
        auth
      };
    }
    emit(ev, ...args) {
      if (socket_types_1.RESERVED_EVENTS.has(ev)) {
        throw new Error(`"${String(ev)}" is a reserved event name`);
      }
      const data = [ev, ...args];
      const packet = {
        type: socket_io_parser_1.PacketType.EVENT,
        data
      };
      if (typeof data[data.length - 1] === "function") {
        const id = this.nsp._ids++;
        debug("emitting packet with ack id %d", id);
        this.registerAckCallback(id, data.pop());
        packet.id = id;
      }
      const flags = Object.assign({}, this.flags);
      this.flags = {};
      if (this.nsp.server.opts.connectionStateRecovery) {
        this.adapter.broadcast(packet, {
          rooms: new Set([this.id]),
          except: new Set,
          flags
        });
      } else {
        this.notifyOutgoingListeners(packet);
        this.packet(packet, flags);
      }
      return true;
    }
    emitWithAck(ev, ...args) {
      const withErr = this.flags.timeout !== undefined;
      return new Promise((resolve, reject) => {
        args.push((arg1, arg2) => {
          if (withErr) {
            return arg1 ? reject(arg1) : resolve(arg2);
          } else {
            return resolve(arg1);
          }
        });
        this.emit(ev, ...args);
      });
    }
    registerAckCallback(id, ack) {
      const timeout = this.flags.timeout;
      if (timeout === undefined) {
        this.acks.set(id, ack);
        return;
      }
      const timer = setTimeout(() => {
        debug("event with ack id %d has timed out after %d ms", id, timeout);
        this.acks.delete(id);
        ack.call(this, new Error("operation has timed out"));
      }, timeout);
      this.acks.set(id, (...args) => {
        clearTimeout(timer);
        ack.apply(this, [null, ...args]);
      });
    }
    to(room) {
      return this.newBroadcastOperator().to(room);
    }
    in(room) {
      return this.newBroadcastOperator().in(room);
    }
    except(room) {
      return this.newBroadcastOperator().except(room);
    }
    send(...args) {
      this.emit("message", ...args);
      return this;
    }
    write(...args) {
      this.emit("message", ...args);
      return this;
    }
    packet(packet, opts = {}) {
      packet.nsp = this.nsp.name;
      opts.compress = opts.compress !== false;
      this.client._packet(packet, opts);
    }
    join(rooms) {
      debug("join room %s", rooms);
      return this.adapter.addAll(this.id, new Set(Array.isArray(rooms) ? rooms : [rooms]));
    }
    leave(room) {
      debug("leave room %s", room);
      return this.adapter.del(this.id, room);
    }
    leaveAll() {
      this.adapter.delAll(this.id);
    }
    _onconnect() {
      debug("socket connected - writing packet");
      this.connected = true;
      this.join(this.id);
      if (this.conn.protocol === 3) {
        this.packet({ type: socket_io_parser_1.PacketType.CONNECT });
      } else {
        this.packet({
          type: socket_io_parser_1.PacketType.CONNECT,
          data: { sid: this.id, pid: this.pid }
        });
      }
    }
    _onpacket(packet) {
      debug("got packet %j", packet);
      switch (packet.type) {
        case socket_io_parser_1.PacketType.EVENT:
          this.onevent(packet);
          break;
        case socket_io_parser_1.PacketType.BINARY_EVENT:
          this.onevent(packet);
          break;
        case socket_io_parser_1.PacketType.ACK:
          this.onack(packet);
          break;
        case socket_io_parser_1.PacketType.BINARY_ACK:
          this.onack(packet);
          break;
        case socket_io_parser_1.PacketType.DISCONNECT:
          this.ondisconnect();
          break;
      }
    }
    onevent(packet) {
      const args = packet.data || [];
      debug("emitting event %j", args);
      if (packet.id != null) {
        debug("attaching ack callback to event");
        args.push(this.ack(packet.id));
      }
      if (this._anyListeners && this._anyListeners.length) {
        const listeners = this._anyListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, args);
        }
      }
      this.dispatch(args);
    }
    ack(id) {
      const self = this;
      let sent = false;
      return function() {
        if (sent)
          return;
        const args = Array.prototype.slice.call(arguments);
        debug("sending ack %j", args);
        self.packet({
          id,
          type: socket_io_parser_1.PacketType.ACK,
          data: args
        });
        sent = true;
      };
    }
    onack(packet) {
      const ack = this.acks.get(packet.id);
      if (typeof ack == "function") {
        debug("calling ack %s with %j", packet.id, packet.data);
        ack.apply(this, packet.data);
        this.acks.delete(packet.id);
      } else {
        debug("bad ack %s", packet.id);
      }
    }
    ondisconnect() {
      debug("got disconnect packet");
      this._onclose("client namespace disconnect");
    }
    _onerror(err) {
      this.emitReserved("error", err);
    }
    _onclose(reason, description) {
      if (!this.connected)
        return this;
      debug("closing socket - reason %s", reason);
      this.emitReserved("disconnecting", reason, description);
      if (this.server._opts.connectionStateRecovery && RECOVERABLE_DISCONNECT_REASONS.has(reason)) {
        debug("connection state recovery is enabled for sid %s", this.id);
        this.adapter.persistSession({
          sid: this.id,
          pid: this.pid,
          rooms: [...this.rooms],
          data: this.data
        });
      }
      this._cleanup();
      this.client._remove(this);
      this.connected = false;
      this.emitReserved("disconnect", reason, description);
      return;
    }
    _cleanup() {
      this.leaveAll();
      this.nsp._remove(this);
      this.join = noop;
    }
    _error(err) {
      this.packet({ type: socket_io_parser_1.PacketType.CONNECT_ERROR, data: err });
    }
    disconnect(close = false) {
      if (!this.connected)
        return this;
      if (close) {
        this.client._disconnect();
      } else {
        this.packet({ type: socket_io_parser_1.PacketType.DISCONNECT });
        this._onclose("server namespace disconnect");
      }
      return this;
    }
    compress(compress) {
      this.flags.compress = compress;
      return this;
    }
    get volatile() {
      this.flags.volatile = true;
      return this;
    }
    get broadcast() {
      return this.newBroadcastOperator();
    }
    get local() {
      return this.newBroadcastOperator().local;
    }
    timeout(timeout) {
      this.flags.timeout = timeout;
      return this;
    }
    dispatch(event) {
      debug("dispatching an event %j", event);
      this.run(event, (err) => {
        process.nextTick(() => {
          if (err) {
            return this._onerror(err);
          }
          if (this.connected) {
            super.emitUntyped.apply(this, event);
          } else {
            debug("ignore packet received after disconnection");
          }
        });
      });
    }
    use(fn) {
      this.fns.push(fn);
      return this;
    }
    run(event, fn) {
      if (!this.fns.length)
        return fn();
      const fns = this.fns.slice(0);
      function run(i) {
        fns[i](event, (err) => {
          if (err)
            return fn(err);
          if (!fns[i + 1])
            return fn();
          run(i + 1);
        });
      }
      run(0);
    }
    get disconnected() {
      return !this.connected;
    }
    get request() {
      return this.client.request;
    }
    get conn() {
      return this.client.conn;
    }
    get rooms() {
      return this.adapter.socketRooms(this.id) || new Set;
    }
    onAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.push(listener);
      return this;
    }
    prependAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.unshift(listener);
      return this;
    }
    offAny(listener) {
      if (!this._anyListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyListeners;
        for (let i = 0;i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
            return this;
          }
        }
      } else {
        this._anyListeners = [];
      }
      return this;
    }
    listenersAny() {
      return this._anyListeners || [];
    }
    onAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.push(listener);
      return this;
    }
    prependAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.unshift(listener);
      return this;
    }
    offAnyOutgoing(listener) {
      if (!this._anyOutgoingListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyOutgoingListeners;
        for (let i = 0;i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
            return this;
          }
        }
      } else {
        this._anyOutgoingListeners = [];
      }
      return this;
    }
    listenersAnyOutgoing() {
      return this._anyOutgoingListeners || [];
    }
    notifyOutgoingListeners(packet) {
      if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
        const listeners = this._anyOutgoingListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, packet.data);
        }
      }
    }
    newBroadcastOperator() {
      const flags = Object.assign({}, this.flags);
      this.flags = {};
      return new broadcast_operator_1.BroadcastOperator(this.adapter, new Set, new Set([this.id]), flags);
    }
  }
  exports.Socket = Socket;
});

// node_modules/socket.io/dist/namespace.js
var require_namespace = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Namespace = exports.RESERVED_EVENTS = undefined;
  var socket_1 = require_socket2();
  var typed_events_1 = require_typed_events();
  var debug_1 = __importDefault(require_src3());
  var broadcast_operator_1 = require_broadcast_operator();
  var debug = (0, debug_1.default)("socket.io:namespace");
  exports.RESERVED_EVENTS = new Set(["connect", "connection", "new_namespace"]);

  class Namespace extends typed_events_1.StrictEventEmitter {
    constructor(server, name) {
      super();
      this.sockets = new Map;
      this._preConnectSockets = new Map;
      this._fns = [];
      this._ids = 0;
      this.server = server;
      this.name = name;
      this._initAdapter();
    }
    _initAdapter() {
      this.adapter = new (this.server.adapter())(this);
    }
    use(fn) {
      this._fns.push(fn);
      return this;
    }
    run(socket, fn) {
      if (!this._fns.length)
        return fn();
      const fns = this._fns.slice(0);
      function run(i) {
        fns[i](socket, (err) => {
          if (err)
            return fn(err);
          if (!fns[i + 1])
            return fn();
          run(i + 1);
        });
      }
      run(0);
    }
    to(room) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).to(room);
    }
    in(room) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).in(room);
    }
    except(room) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).except(room);
    }
    async _add(client, auth, fn) {
      var _a;
      debug("adding socket to nsp %s", this.name);
      const socket = await this._createSocket(client, auth);
      this._preConnectSockets.set(socket.id, socket);
      if (((_a = this.server.opts.connectionStateRecovery) === null || _a === undefined ? undefined : _a.skipMiddlewares) && socket.recovered && client.conn.readyState === "open") {
        return this._doConnect(socket, fn);
      }
      this.run(socket, (err) => {
        process.nextTick(() => {
          if (client.conn.readyState !== "open") {
            debug("next called after client was closed - ignoring socket");
            socket._cleanup();
            return;
          }
          if (err) {
            debug("middleware error, sending CONNECT_ERROR packet to the client");
            socket._cleanup();
            if (client.conn.protocol === 3) {
              return socket._error(err.data || err.message);
            } else {
              return socket._error({
                message: err.message,
                data: err.data
              });
            }
          }
          this._doConnect(socket, fn);
        });
      });
    }
    async _createSocket(client, auth) {
      const sessionId = auth.pid;
      const offset = auth.offset;
      if (this.server.opts.connectionStateRecovery && typeof sessionId === "string" && typeof offset === "string") {
        let session;
        try {
          session = await this.adapter.restoreSession(sessionId, offset);
        } catch (e) {
          debug("error while restoring session: %s", e);
        }
        if (session) {
          debug("connection state recovered for sid %s", session.sid);
          return new socket_1.Socket(this, client, auth, session);
        }
      }
      return new socket_1.Socket(this, client, auth);
    }
    _doConnect(socket, fn) {
      this._preConnectSockets.delete(socket.id);
      this.sockets.set(socket.id, socket);
      socket._onconnect();
      if (fn)
        fn(socket);
      this.emitReserved("connect", socket);
      this.emitReserved("connection", socket);
    }
    _remove(socket) {
      this.sockets.delete(socket.id) || this._preConnectSockets.delete(socket.id);
    }
    emit(ev, ...args) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).emit(ev, ...args);
    }
    send(...args) {
      this.emit("message", ...args);
      return this;
    }
    write(...args) {
      this.emit("message", ...args);
      return this;
    }
    serverSideEmit(ev, ...args) {
      if (exports.RESERVED_EVENTS.has(ev)) {
        throw new Error(`"${String(ev)}" is a reserved event name`);
      }
      args.unshift(ev);
      this.adapter.serverSideEmit(args);
      return true;
    }
    serverSideEmitWithAck(ev, ...args) {
      return new Promise((resolve, reject) => {
        args.push((err, responses) => {
          if (err) {
            err.responses = responses;
            return reject(err);
          } else {
            return resolve(responses);
          }
        });
        this.serverSideEmit(ev, ...args);
      });
    }
    _onServerSideEmit(args) {
      super.emitUntyped.apply(this, args);
    }
    allSockets() {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).allSockets();
    }
    compress(compress) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).compress(compress);
    }
    get volatile() {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).volatile;
    }
    get local() {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).local;
    }
    timeout(timeout) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).timeout(timeout);
    }
    fetchSockets() {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).fetchSockets();
    }
    socketsJoin(room) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).socketsJoin(room);
    }
    socketsLeave(room) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).socketsLeave(room);
    }
    disconnectSockets(close = false) {
      return new broadcast_operator_1.BroadcastOperator(this.adapter).disconnectSockets(close);
    }
  }
  exports.Namespace = Namespace;
});

// node_modules/socket.io-adapter/dist/contrib/yeast.js
var require_yeast = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.yeast = exports.decode = exports.encode = undefined;
  var alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split("");
  var length = 64;
  var map = {};
  var seed = 0;
  var i = 0;
  var prev;
  function encode(num) {
    let encoded = "";
    do {
      encoded = alphabet[num % length] + encoded;
      num = Math.floor(num / length);
    } while (num > 0);
    return encoded;
  }
  exports.encode = encode;
  function decode(str) {
    let decoded = 0;
    for (i = 0;i < str.length; i++) {
      decoded = decoded * length + map[str.charAt(i)];
    }
    return decoded;
  }
  exports.decode = decode;
  function yeast() {
    const now = encode(+new Date);
    if (now !== prev)
      return seed = 0, prev = now;
    return now + "." + encode(seed++);
  }
  exports.yeast = yeast;
  for (;i < length; i++)
    map[alphabet[i]] = i;
});

// node_modules/socket.io-adapter/dist/in-memory-adapter.js
var require_in_memory_adapter = __commonJS((exports) => {
  var _a;
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.SessionAwareAdapter = exports.Adapter = undefined;
  var events_1 = __require("events");
  var yeast_1 = require_yeast();
  var WebSocket = require_ws();
  var canPreComputeFrame = typeof ((_a = WebSocket === null || WebSocket === undefined ? undefined : WebSocket.Sender) === null || _a === undefined ? undefined : _a.frame) === "function";

  class Adapter extends events_1.EventEmitter {
    constructor(nsp) {
      super();
      this.nsp = nsp;
      this.rooms = new Map;
      this.sids = new Map;
      this.encoder = nsp.server.encoder;
    }
    init() {}
    close() {}
    serverCount() {
      return Promise.resolve(1);
    }
    addAll(id, rooms) {
      if (!this.sids.has(id)) {
        this.sids.set(id, new Set);
      }
      for (const room of rooms) {
        this.sids.get(id).add(room);
        if (!this.rooms.has(room)) {
          this.rooms.set(room, new Set);
          this.emit("create-room", room);
        }
        if (!this.rooms.get(room).has(id)) {
          this.rooms.get(room).add(id);
          this.emit("join-room", room, id);
        }
      }
    }
    del(id, room) {
      if (this.sids.has(id)) {
        this.sids.get(id).delete(room);
      }
      this._del(room, id);
    }
    _del(room, id) {
      const _room = this.rooms.get(room);
      if (_room != null) {
        const deleted = _room.delete(id);
        if (deleted) {
          this.emit("leave-room", room, id);
        }
        if (_room.size === 0 && this.rooms.delete(room)) {
          this.emit("delete-room", room);
        }
      }
    }
    delAll(id) {
      if (!this.sids.has(id)) {
        return;
      }
      for (const room of this.sids.get(id)) {
        this._del(room, id);
      }
      this.sids.delete(id);
    }
    broadcast(packet, opts) {
      const flags = opts.flags || {};
      const packetOpts = {
        preEncoded: true,
        volatile: flags.volatile,
        compress: flags.compress
      };
      packet.nsp = this.nsp.name;
      const encodedPackets = this._encode(packet, packetOpts);
      this.apply(opts, (socket) => {
        if (typeof socket.notifyOutgoingListeners === "function") {
          socket.notifyOutgoingListeners(packet);
        }
        socket.client.writeToEngine(encodedPackets, packetOpts);
      });
    }
    broadcastWithAck(packet, opts, clientCountCallback, ack) {
      const flags = opts.flags || {};
      const packetOpts = {
        preEncoded: true,
        volatile: flags.volatile,
        compress: flags.compress
      };
      packet.nsp = this.nsp.name;
      packet.id = this.nsp._ids++;
      const encodedPackets = this._encode(packet, packetOpts);
      let clientCount = 0;
      this.apply(opts, (socket) => {
        clientCount++;
        socket.acks.set(packet.id, ack);
        if (typeof socket.notifyOutgoingListeners === "function") {
          socket.notifyOutgoingListeners(packet);
        }
        socket.client.writeToEngine(encodedPackets, packetOpts);
      });
      clientCountCallback(clientCount);
    }
    _encode(packet, packetOpts) {
      const encodedPackets = this.encoder.encode(packet);
      if (canPreComputeFrame && encodedPackets.length === 1 && typeof encodedPackets[0] === "string") {
        const data = Buffer.from("4" + encodedPackets[0]);
        packetOpts.wsPreEncodedFrame = WebSocket.Sender.frame(data, {
          readOnly: false,
          mask: false,
          rsv1: false,
          opcode: 1,
          fin: true
        });
      }
      return encodedPackets;
    }
    sockets(rooms) {
      const sids = new Set;
      this.apply({ rooms }, (socket) => {
        sids.add(socket.id);
      });
      return Promise.resolve(sids);
    }
    socketRooms(id) {
      return this.sids.get(id);
    }
    fetchSockets(opts) {
      const sockets = [];
      this.apply(opts, (socket) => {
        sockets.push(socket);
      });
      return Promise.resolve(sockets);
    }
    addSockets(opts, rooms) {
      this.apply(opts, (socket) => {
        socket.join(rooms);
      });
    }
    delSockets(opts, rooms) {
      this.apply(opts, (socket) => {
        rooms.forEach((room) => socket.leave(room));
      });
    }
    disconnectSockets(opts, close) {
      this.apply(opts, (socket) => {
        socket.disconnect(close);
      });
    }
    apply(opts, callback) {
      const rooms = opts.rooms;
      const except = this.computeExceptSids(opts.except);
      if (rooms.size) {
        const ids = new Set;
        for (const room of rooms) {
          if (!this.rooms.has(room))
            continue;
          for (const id of this.rooms.get(room)) {
            if (ids.has(id) || except.has(id))
              continue;
            const socket = this.nsp.sockets.get(id);
            if (socket) {
              callback(socket);
              ids.add(id);
            }
          }
        }
      } else {
        for (const [id] of this.sids) {
          if (except.has(id))
            continue;
          const socket = this.nsp.sockets.get(id);
          if (socket)
            callback(socket);
        }
      }
    }
    computeExceptSids(exceptRooms) {
      const exceptSids = new Set;
      if (exceptRooms && exceptRooms.size > 0) {
        for (const room of exceptRooms) {
          if (this.rooms.has(room)) {
            this.rooms.get(room).forEach((sid) => exceptSids.add(sid));
          }
        }
      }
      return exceptSids;
    }
    serverSideEmit(packet) {
      console.warn("this adapter does not support the serverSideEmit() functionality");
    }
    persistSession(session) {}
    restoreSession(pid, offset) {
      return null;
    }
  }
  exports.Adapter = Adapter;

  class SessionAwareAdapter extends Adapter {
    constructor(nsp) {
      super(nsp);
      this.nsp = nsp;
      this.sessions = new Map;
      this.packets = [];
      this.maxDisconnectionDuration = nsp.server.opts.connectionStateRecovery.maxDisconnectionDuration;
      const timer = setInterval(() => {
        const threshold = Date.now() - this.maxDisconnectionDuration;
        this.sessions.forEach((session, sessionId) => {
          const hasExpired = session.disconnectedAt < threshold;
          if (hasExpired) {
            this.sessions.delete(sessionId);
          }
        });
        for (let i = this.packets.length - 1;i >= 0; i--) {
          const hasExpired = this.packets[i].emittedAt < threshold;
          if (hasExpired) {
            this.packets.splice(0, i + 1);
            break;
          }
        }
      }, 60 * 1000);
      timer.unref();
    }
    persistSession(session) {
      session.disconnectedAt = Date.now();
      this.sessions.set(session.pid, session);
    }
    restoreSession(pid, offset) {
      const session = this.sessions.get(pid);
      if (!session) {
        return null;
      }
      const hasExpired = session.disconnectedAt + this.maxDisconnectionDuration < Date.now();
      if (hasExpired) {
        this.sessions.delete(pid);
        return null;
      }
      const index = this.packets.findIndex((packet) => packet.id === offset);
      if (index === -1) {
        return null;
      }
      const missedPackets = [];
      for (let i = index + 1;i < this.packets.length; i++) {
        const packet = this.packets[i];
        if (shouldIncludePacket(session.rooms, packet.opts)) {
          missedPackets.push(packet.data);
        }
      }
      return Promise.resolve(Object.assign(Object.assign({}, session), { missedPackets }));
    }
    broadcast(packet, opts) {
      var _a2;
      const isEventPacket = packet.type === 2;
      const withoutAcknowledgement = packet.id === undefined;
      const notVolatile = ((_a2 = opts.flags) === null || _a2 === undefined ? undefined : _a2.volatile) === undefined;
      if (isEventPacket && withoutAcknowledgement && notVolatile) {
        const id = (0, yeast_1.yeast)();
        packet.data.push(id);
        this.packets.push({
          id,
          opts,
          data: packet.data,
          emittedAt: Date.now()
        });
      }
      super.broadcast(packet, opts);
    }
  }
  exports.SessionAwareAdapter = SessionAwareAdapter;
  function shouldIncludePacket(sessionRooms, opts) {
    const included = opts.rooms.size === 0 || sessionRooms.some((room) => opts.rooms.has(room));
    const notExcluded = sessionRooms.every((room) => !opts.except.has(room));
    return included && notExcluded;
  }
});

// node_modules/socket.io-adapter/node_modules/debug/src/common.js
var require_common4 = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce2;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      let i;
      const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      const len = split.length;
      for (i = 0;i < len; i++) {
        if (!split[i]) {
          continue;
        }
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
        } else {
          createDebug.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      const namespaces = [
        ...createDebug.names.map(toNamespace),
        ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      if (name[name.length - 1] === "*") {
        return true;
      }
      let i;
      let len;
      for (i = 0, len = createDebug.skips.length;i < len; i++) {
        if (createDebug.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = createDebug.names.length;i < len; i++) {
        if (createDebug.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function toNamespace(regexp) {
      return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
    }
    function coerce2(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/socket.io-adapter/node_modules/debug/src/browser.js
var require_browser4 = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common4()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/socket.io-adapter/node_modules/debug/src/node.js
var require_node4 = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util3 = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util3.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = require_supports_color();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util3.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common4()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util3.inspect(v, this.inspectOpts);
  };
});

// node_modules/socket.io-adapter/node_modules/debug/src/index.js
var require_src4 = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser4();
  } else {
    module.exports = require_node4();
  }
});

// node_modules/socket.io-adapter/dist/cluster-adapter.js
var require_cluster_adapter = __commonJS((exports) => {
  var __rest = exports && exports.__rest || function(s, e) {
    var t = {};
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s);i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
          t[p[i]] = s[p[i]];
      }
    return t;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ClusterAdapterWithHeartbeat = exports.ClusterAdapter = exports.MessageType = undefined;
  var in_memory_adapter_1 = require_in_memory_adapter();
  var debug_1 = require_src4();
  var crypto_1 = __require("crypto");
  var debug = (0, debug_1.debug)("socket.io-adapter");
  var EMITTER_UID = "emitter";
  var DEFAULT_TIMEOUT = 5000;
  function randomId() {
    return (0, crypto_1.randomBytes)(8).toString("hex");
  }
  var MessageType;
  (function(MessageType2) {
    MessageType2[MessageType2["INITIAL_HEARTBEAT"] = 1] = "INITIAL_HEARTBEAT";
    MessageType2[MessageType2["HEARTBEAT"] = 2] = "HEARTBEAT";
    MessageType2[MessageType2["BROADCAST"] = 3] = "BROADCAST";
    MessageType2[MessageType2["SOCKETS_JOIN"] = 4] = "SOCKETS_JOIN";
    MessageType2[MessageType2["SOCKETS_LEAVE"] = 5] = "SOCKETS_LEAVE";
    MessageType2[MessageType2["DISCONNECT_SOCKETS"] = 6] = "DISCONNECT_SOCKETS";
    MessageType2[MessageType2["FETCH_SOCKETS"] = 7] = "FETCH_SOCKETS";
    MessageType2[MessageType2["FETCH_SOCKETS_RESPONSE"] = 8] = "FETCH_SOCKETS_RESPONSE";
    MessageType2[MessageType2["SERVER_SIDE_EMIT"] = 9] = "SERVER_SIDE_EMIT";
    MessageType2[MessageType2["SERVER_SIDE_EMIT_RESPONSE"] = 10] = "SERVER_SIDE_EMIT_RESPONSE";
    MessageType2[MessageType2["BROADCAST_CLIENT_COUNT"] = 11] = "BROADCAST_CLIENT_COUNT";
    MessageType2[MessageType2["BROADCAST_ACK"] = 12] = "BROADCAST_ACK";
    MessageType2[MessageType2["ADAPTER_CLOSE"] = 13] = "ADAPTER_CLOSE";
  })(MessageType = exports.MessageType || (exports.MessageType = {}));
  function encodeOptions(opts) {
    return {
      rooms: [...opts.rooms],
      except: [...opts.except],
      flags: opts.flags
    };
  }
  function decodeOptions(opts) {
    return {
      rooms: new Set(opts.rooms),
      except: new Set(opts.except),
      flags: opts.flags
    };
  }

  class ClusterAdapter extends in_memory_adapter_1.Adapter {
    constructor(nsp) {
      super(nsp);
      this.requests = new Map;
      this.ackRequests = new Map;
      this.uid = randomId();
    }
    onMessage(message, offset) {
      if (message.uid === this.uid) {
        return debug("[%s] ignore message from self", this.uid);
      }
      debug("[%s] new event of type %d from %s", this.uid, message.type, message.uid);
      switch (message.type) {
        case MessageType.BROADCAST: {
          const withAck = message.data.requestId !== undefined;
          if (withAck) {
            super.broadcastWithAck(message.data.packet, decodeOptions(message.data.opts), (clientCount) => {
              debug("[%s] waiting for %d client acknowledgements", this.uid, clientCount);
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_CLIENT_COUNT,
                data: {
                  requestId: message.data.requestId,
                  clientCount
                }
              });
            }, (arg) => {
              debug("[%s] received acknowledgement with value %j", this.uid, arg);
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_ACK,
                data: {
                  requestId: message.data.requestId,
                  packet: arg
                }
              });
            });
          } else {
            const packet = message.data.packet;
            const opts = decodeOptions(message.data.opts);
            this.addOffsetIfNecessary(packet, opts, offset);
            super.broadcast(packet, opts);
          }
          break;
        }
        case MessageType.SOCKETS_JOIN:
          super.addSockets(decodeOptions(message.data.opts), message.data.rooms);
          break;
        case MessageType.SOCKETS_LEAVE:
          super.delSockets(decodeOptions(message.data.opts), message.data.rooms);
          break;
        case MessageType.DISCONNECT_SOCKETS:
          super.disconnectSockets(decodeOptions(message.data.opts), message.data.close);
          break;
        case MessageType.FETCH_SOCKETS: {
          debug("[%s] calling fetchSockets with opts %j", this.uid, message.data.opts);
          super.fetchSockets(decodeOptions(message.data.opts)).then((localSockets) => {
            this.publishResponse(message.uid, {
              type: MessageType.FETCH_SOCKETS_RESPONSE,
              data: {
                requestId: message.data.requestId,
                sockets: localSockets.map((socket) => {
                  const _a = socket.handshake, { sessionStore } = _a, handshake = __rest(_a, ["sessionStore"]);
                  return {
                    id: socket.id,
                    handshake,
                    rooms: [...socket.rooms],
                    data: socket.data
                  };
                })
              }
            });
          });
          break;
        }
        case MessageType.SERVER_SIDE_EMIT: {
          const packet = message.data.packet;
          const withAck = message.data.requestId !== undefined;
          if (!withAck) {
            this.nsp._onServerSideEmit(packet);
            return;
          }
          let called = false;
          const callback = (arg) => {
            if (called) {
              return;
            }
            called = true;
            debug("[%s] calling acknowledgement with %j", this.uid, arg);
            this.publishResponse(message.uid, {
              type: MessageType.SERVER_SIDE_EMIT_RESPONSE,
              data: {
                requestId: message.data.requestId,
                packet: arg
              }
            });
          };
          this.nsp._onServerSideEmit([...packet, callback]);
          break;
        }
        case MessageType.BROADCAST_CLIENT_COUNT:
        case MessageType.BROADCAST_ACK:
        case MessageType.FETCH_SOCKETS_RESPONSE:
        case MessageType.SERVER_SIDE_EMIT_RESPONSE:
          this.onResponse(message);
          break;
        default:
          debug("[%s] unknown message type: %s", this.uid, message.type);
      }
    }
    onResponse(response) {
      var _a, _b;
      const requestId = response.data.requestId;
      debug("[%s] received response %s to request %s", this.uid, response.type, requestId);
      switch (response.type) {
        case MessageType.BROADCAST_CLIENT_COUNT: {
          (_a = this.ackRequests.get(requestId)) === null || _a === undefined || _a.clientCountCallback(response.data.clientCount);
          break;
        }
        case MessageType.BROADCAST_ACK: {
          (_b = this.ackRequests.get(requestId)) === null || _b === undefined || _b.ack(response.data.packet);
          break;
        }
        case MessageType.FETCH_SOCKETS_RESPONSE: {
          const request = this.requests.get(requestId);
          if (!request) {
            return;
          }
          request.current++;
          response.data.sockets.forEach((socket) => request.responses.push(socket));
          if (request.current === request.expected) {
            clearTimeout(request.timeout);
            request.resolve(request.responses);
            this.requests.delete(requestId);
          }
          break;
        }
        case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
          const request = this.requests.get(requestId);
          if (!request) {
            return;
          }
          request.current++;
          request.responses.push(response.data.packet);
          if (request.current === request.expected) {
            clearTimeout(request.timeout);
            request.resolve(null, request.responses);
            this.requests.delete(requestId);
          }
          break;
        }
        default:
          debug("[%s] unknown response type: %s", this.uid, response.type);
      }
    }
    async broadcast(packet, opts) {
      var _a;
      const onlyLocal = (_a = opts.flags) === null || _a === undefined ? undefined : _a.local;
      if (!onlyLocal) {
        try {
          const offset = await this.publishAndReturnOffset({
            type: MessageType.BROADCAST,
            data: {
              packet,
              opts: encodeOptions(opts)
            }
          });
          this.addOffsetIfNecessary(packet, opts, offset);
        } catch (e) {
          return debug("[%s] error while broadcasting message: %s", this.uid, e.message);
        }
      }
      super.broadcast(packet, opts);
    }
    addOffsetIfNecessary(packet, opts, offset) {
      var _a;
      if (!this.nsp.server.opts.connectionStateRecovery) {
        return;
      }
      const isEventPacket = packet.type === 2;
      const withoutAcknowledgement = packet.id === undefined;
      const notVolatile = ((_a = opts.flags) === null || _a === undefined ? undefined : _a.volatile) === undefined;
      if (isEventPacket && withoutAcknowledgement && notVolatile) {
        packet.data.push(offset);
      }
    }
    broadcastWithAck(packet, opts, clientCountCallback, ack) {
      var _a;
      const onlyLocal = (_a = opts === null || opts === undefined ? undefined : opts.flags) === null || _a === undefined ? undefined : _a.local;
      if (!onlyLocal) {
        const requestId = randomId();
        this.ackRequests.set(requestId, {
          clientCountCallback,
          ack
        });
        this.publish({
          type: MessageType.BROADCAST,
          data: {
            packet,
            requestId,
            opts: encodeOptions(opts)
          }
        });
        setTimeout(() => {
          this.ackRequests.delete(requestId);
        }, opts.flags.timeout);
      }
      super.broadcastWithAck(packet, opts, clientCountCallback, ack);
    }
    async addSockets(opts, rooms) {
      var _a;
      const onlyLocal = (_a = opts.flags) === null || _a === undefined ? undefined : _a.local;
      if (!onlyLocal) {
        try {
          await this.publishAndReturnOffset({
            type: MessageType.SOCKETS_JOIN,
            data: {
              opts: encodeOptions(opts),
              rooms
            }
          });
        } catch (e) {
          debug("[%s] error while publishing message: %s", this.uid, e.message);
        }
      }
      super.addSockets(opts, rooms);
    }
    async delSockets(opts, rooms) {
      var _a;
      const onlyLocal = (_a = opts.flags) === null || _a === undefined ? undefined : _a.local;
      if (!onlyLocal) {
        try {
          await this.publishAndReturnOffset({
            type: MessageType.SOCKETS_LEAVE,
            data: {
              opts: encodeOptions(opts),
              rooms
            }
          });
        } catch (e) {
          debug("[%s] error while publishing message: %s", this.uid, e.message);
        }
      }
      super.delSockets(opts, rooms);
    }
    async disconnectSockets(opts, close) {
      var _a;
      const onlyLocal = (_a = opts.flags) === null || _a === undefined ? undefined : _a.local;
      if (!onlyLocal) {
        try {
          await this.publishAndReturnOffset({
            type: MessageType.DISCONNECT_SOCKETS,
            data: {
              opts: encodeOptions(opts),
              close
            }
          });
        } catch (e) {
          debug("[%s] error while publishing message: %s", this.uid, e.message);
        }
      }
      super.disconnectSockets(opts, close);
    }
    async fetchSockets(opts) {
      var _a;
      const [localSockets, serverCount] = await Promise.all([
        super.fetchSockets(opts),
        this.serverCount()
      ]);
      const expectedResponseCount = serverCount - 1;
      if (((_a = opts.flags) === null || _a === undefined ? undefined : _a.local) || expectedResponseCount <= 0) {
        return localSockets;
      }
      const requestId = randomId();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const storedRequest2 = this.requests.get(requestId);
          if (storedRequest2) {
            reject(new Error(`timeout reached: only ${storedRequest2.current} responses received out of ${storedRequest2.expected}`));
            this.requests.delete(requestId);
          }
        }, opts.flags.timeout || DEFAULT_TIMEOUT);
        const storedRequest = {
          type: MessageType.FETCH_SOCKETS,
          resolve,
          timeout,
          current: 0,
          expected: expectedResponseCount,
          responses: localSockets
        };
        this.requests.set(requestId, storedRequest);
        this.publish({
          type: MessageType.FETCH_SOCKETS,
          data: {
            opts: encodeOptions(opts),
            requestId
          }
        });
      });
    }
    async serverSideEmit(packet) {
      const withAck = typeof packet[packet.length - 1] === "function";
      if (!withAck) {
        return this.publish({
          type: MessageType.SERVER_SIDE_EMIT,
          data: {
            packet
          }
        });
      }
      const ack = packet.pop();
      const expectedResponseCount = await this.serverCount() - 1;
      debug('[%s] waiting for %d responses to "serverSideEmit" request', this.uid, expectedResponseCount);
      if (expectedResponseCount <= 0) {
        return ack(null, []);
      }
      const requestId = randomId();
      const timeout = setTimeout(() => {
        const storedRequest2 = this.requests.get(requestId);
        if (storedRequest2) {
          ack(new Error(`timeout reached: only ${storedRequest2.current} responses received out of ${storedRequest2.expected}`), storedRequest2.responses);
          this.requests.delete(requestId);
        }
      }, DEFAULT_TIMEOUT);
      const storedRequest = {
        type: MessageType.SERVER_SIDE_EMIT,
        resolve: ack,
        timeout,
        current: 0,
        expected: expectedResponseCount,
        responses: []
      };
      this.requests.set(requestId, storedRequest);
      this.publish({
        type: MessageType.SERVER_SIDE_EMIT,
        data: {
          requestId,
          packet
        }
      });
    }
    publish(message) {
      this.publishAndReturnOffset(message).catch((err) => {
        debug("[%s] error while publishing message: %s", this.uid, err);
      });
    }
    publishAndReturnOffset(message) {
      message.uid = this.uid;
      message.nsp = this.nsp.name;
      return this.doPublish(message);
    }
    publishResponse(requesterUid, response) {
      response.uid = this.uid;
      response.nsp = this.nsp.name;
      this.doPublishResponse(requesterUid, response).catch((err) => {
        debug("[%s] error while publishing response: %s", this.uid, err);
      });
    }
  }
  exports.ClusterAdapter = ClusterAdapter;

  class ClusterAdapterWithHeartbeat extends ClusterAdapter {
    constructor(nsp, opts) {
      super(nsp);
      this.nodesMap = new Map;
      this.customRequests = new Map;
      this._opts = Object.assign({
        heartbeatInterval: 5000,
        heartbeatTimeout: 1e4
      }, opts);
      this.cleanupTimer = setInterval(() => {
        const now = Date.now();
        this.nodesMap.forEach((lastSeen, uid) => {
          const nodeSeemsDown = now - lastSeen > this._opts.heartbeatTimeout;
          if (nodeSeemsDown) {
            debug("[%s] node %s seems down", this.uid, uid);
            this.removeNode(uid);
          }
        });
      }, 1000);
    }
    init() {
      this.publish({
        type: MessageType.INITIAL_HEARTBEAT
      });
    }
    scheduleHeartbeat() {
      if (this.heartbeatTimer) {
        this.heartbeatTimer.refresh();
      } else {
        this.heartbeatTimer = setTimeout(() => {
          this.publish({
            type: MessageType.HEARTBEAT
          });
        }, this._opts.heartbeatInterval);
      }
    }
    close() {
      this.publish({
        type: MessageType.ADAPTER_CLOSE
      });
      clearTimeout(this.heartbeatTimer);
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
    }
    onMessage(message, offset) {
      if (message.uid === this.uid) {
        return debug("[%s] ignore message from self", this.uid);
      }
      if (message.uid && message.uid !== EMITTER_UID) {
        this.nodesMap.set(message.uid, Date.now());
      }
      debug("[%s] new event of type %d from %s", this.uid, message.type, message.uid);
      switch (message.type) {
        case MessageType.INITIAL_HEARTBEAT:
          this.publish({
            type: MessageType.HEARTBEAT
          });
          break;
        case MessageType.HEARTBEAT:
          break;
        case MessageType.ADAPTER_CLOSE:
          this.removeNode(message.uid);
          break;
        default:
          super.onMessage(message, offset);
      }
    }
    serverCount() {
      return Promise.resolve(1 + this.nodesMap.size);
    }
    publish(message) {
      this.scheduleHeartbeat();
      return super.publish(message);
    }
    async serverSideEmit(packet) {
      const withAck = typeof packet[packet.length - 1] === "function";
      if (!withAck) {
        return this.publish({
          type: MessageType.SERVER_SIDE_EMIT,
          data: {
            packet
          }
        });
      }
      const ack = packet.pop();
      const expectedResponseCount = this.nodesMap.size;
      debug('[%s] waiting for %d responses to "serverSideEmit" request', this.uid, expectedResponseCount);
      if (expectedResponseCount <= 0) {
        return ack(null, []);
      }
      const requestId = randomId();
      const timeout = setTimeout(() => {
        const storedRequest2 = this.customRequests.get(requestId);
        if (storedRequest2) {
          ack(new Error(`timeout reached: missing ${storedRequest2.missingUids.size} responses`), storedRequest2.responses);
          this.customRequests.delete(requestId);
        }
      }, DEFAULT_TIMEOUT);
      const storedRequest = {
        type: MessageType.SERVER_SIDE_EMIT,
        resolve: ack,
        timeout,
        missingUids: new Set([...this.nodesMap.keys()]),
        responses: []
      };
      this.customRequests.set(requestId, storedRequest);
      this.publish({
        type: MessageType.SERVER_SIDE_EMIT,
        data: {
          requestId,
          packet
        }
      });
    }
    async fetchSockets(opts) {
      var _a;
      const [localSockets, serverCount] = await Promise.all([
        super.fetchSockets({
          rooms: opts.rooms,
          except: opts.except,
          flags: {
            local: true
          }
        }),
        this.serverCount()
      ]);
      const expectedResponseCount = serverCount - 1;
      if (((_a = opts.flags) === null || _a === undefined ? undefined : _a.local) || expectedResponseCount <= 0) {
        return localSockets;
      }
      const requestId = randomId();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const storedRequest2 = this.customRequests.get(requestId);
          if (storedRequest2) {
            reject(new Error(`timeout reached: missing ${storedRequest2.missingUids.size} responses`));
            this.customRequests.delete(requestId);
          }
        }, opts.flags.timeout || DEFAULT_TIMEOUT);
        const storedRequest = {
          type: MessageType.FETCH_SOCKETS,
          resolve,
          timeout,
          missingUids: new Set([...this.nodesMap.keys()]),
          responses: localSockets
        };
        this.customRequests.set(requestId, storedRequest);
        this.publish({
          type: MessageType.FETCH_SOCKETS,
          data: {
            opts: encodeOptions(opts),
            requestId
          }
        });
      });
    }
    onResponse(response) {
      const requestId = response.data.requestId;
      debug("[%s] received response %s to request %s", this.uid, response.type, requestId);
      switch (response.type) {
        case MessageType.FETCH_SOCKETS_RESPONSE: {
          const request = this.customRequests.get(requestId);
          if (!request) {
            return;
          }
          response.data.sockets.forEach((socket) => request.responses.push(socket));
          request.missingUids.delete(response.uid);
          if (request.missingUids.size === 0) {
            clearTimeout(request.timeout);
            request.resolve(request.responses);
            this.customRequests.delete(requestId);
          }
          break;
        }
        case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
          const request = this.customRequests.get(requestId);
          if (!request) {
            return;
          }
          request.responses.push(response.data.packet);
          request.missingUids.delete(response.uid);
          if (request.missingUids.size === 0) {
            clearTimeout(request.timeout);
            request.resolve(null, request.responses);
            this.customRequests.delete(requestId);
          }
          break;
        }
        default:
          super.onResponse(response);
      }
    }
    removeNode(uid) {
      this.customRequests.forEach((request, requestId) => {
        request.missingUids.delete(uid);
        if (request.missingUids.size === 0) {
          clearTimeout(request.timeout);
          if (request.type === MessageType.FETCH_SOCKETS) {
            request.resolve(request.responses);
          } else if (request.type === MessageType.SERVER_SIDE_EMIT) {
            request.resolve(null, request.responses);
          }
          this.customRequests.delete(requestId);
        }
      });
      this.nodesMap.delete(uid);
    }
  }
  exports.ClusterAdapterWithHeartbeat = ClusterAdapterWithHeartbeat;
});

// node_modules/socket.io-adapter/dist/index.js
var require_dist = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MessageType = exports.ClusterAdapterWithHeartbeat = exports.ClusterAdapter = exports.SessionAwareAdapter = exports.Adapter = undefined;
  var in_memory_adapter_1 = require_in_memory_adapter();
  Object.defineProperty(exports, "Adapter", { enumerable: true, get: function() {
    return in_memory_adapter_1.Adapter;
  } });
  Object.defineProperty(exports, "SessionAwareAdapter", { enumerable: true, get: function() {
    return in_memory_adapter_1.SessionAwareAdapter;
  } });
  var cluster_adapter_1 = require_cluster_adapter();
  Object.defineProperty(exports, "ClusterAdapter", { enumerable: true, get: function() {
    return cluster_adapter_1.ClusterAdapter;
  } });
  Object.defineProperty(exports, "ClusterAdapterWithHeartbeat", { enumerable: true, get: function() {
    return cluster_adapter_1.ClusterAdapterWithHeartbeat;
  } });
  Object.defineProperty(exports, "MessageType", { enumerable: true, get: function() {
    return cluster_adapter_1.MessageType;
  } });
});

// node_modules/socket.io/dist/parent-namespace.js
var require_parent_namespace = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ParentNamespace = undefined;
  var namespace_1 = require_namespace();
  var socket_io_adapter_1 = require_dist();
  var debug_1 = __importDefault(require_src3());
  var debug = (0, debug_1.default)("socket.io:parent-namespace");

  class ParentNamespace extends namespace_1.Namespace {
    constructor(server) {
      super(server, "/_" + ParentNamespace.count++);
      this.children = new Set;
    }
    _initAdapter() {
      this.adapter = new ParentBroadcastAdapter(this);
    }
    emit(ev, ...args) {
      this.children.forEach((nsp) => {
        nsp.emit(ev, ...args);
      });
      return true;
    }
    createChild(name) {
      debug("creating child namespace %s", name);
      const namespace = new namespace_1.Namespace(this.server, name);
      this["_fns"].forEach((fn) => namespace.use(fn));
      this.listeners("connect").forEach((listener) => namespace.on("connect", listener));
      this.listeners("connection").forEach((listener) => namespace.on("connection", listener));
      this.children.add(namespace);
      if (this.server._opts.cleanupEmptyChildNamespaces) {
        const remove = namespace._remove;
        namespace._remove = (socket) => {
          remove.call(namespace, socket);
          if (namespace.sockets.size === 0) {
            debug("closing child namespace %s", name);
            namespace.adapter.close();
            this.server._nsps.delete(namespace.name);
            this.children.delete(namespace);
          }
        };
      }
      this.server._nsps.set(name, namespace);
      this.server.sockets.emitReserved("new_namespace", namespace);
      return namespace;
    }
    fetchSockets() {
      throw new Error("fetchSockets() is not supported on parent namespaces");
    }
  }
  exports.ParentNamespace = ParentNamespace;
  ParentNamespace.count = 0;

  class ParentBroadcastAdapter extends socket_io_adapter_1.Adapter {
    broadcast(packet, opts) {
      this.nsp.children.forEach((nsp) => {
        nsp.adapter.broadcast(packet, opts);
      });
    }
  }
});

// node_modules/socket.io/dist/uws.js
var require_uws = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.patchAdapter = patchAdapter;
  exports.restoreAdapter = restoreAdapter;
  exports.serveFile = serveFile;
  var socket_io_adapter_1 = require_dist();
  var fs_1 = __require("fs");
  var debug_1 = __importDefault(require_src3());
  var debug = (0, debug_1.default)("socket.io:adapter-uws");
  var SEPARATOR = "\x1F";
  var { addAll, del, broadcast } = socket_io_adapter_1.Adapter.prototype;
  function patchAdapter(app) {
    socket_io_adapter_1.Adapter.prototype.addAll = function(id, rooms) {
      const isNew = !this.sids.has(id);
      addAll.call(this, id, rooms);
      const socket = this.nsp.sockets.get(id) || this.nsp._preConnectSockets.get(id);
      if (!socket) {
        return;
      }
      if (socket.conn.transport.name === "websocket") {
        subscribe(this.nsp.name, socket, isNew, rooms);
        return;
      }
      if (isNew) {
        socket.conn.on("upgrade", () => {
          const rooms2 = this.sids.get(id);
          if (rooms2) {
            subscribe(this.nsp.name, socket, isNew, rooms2);
          }
        });
      }
    };
    socket_io_adapter_1.Adapter.prototype.del = function(id, room) {
      del.call(this, id, room);
      const socket = this.nsp.sockets.get(id) || this.nsp._preConnectSockets.get(id);
      if (socket && socket.conn.transport.name === "websocket") {
        const sessionId = socket.conn.id;
        const websocket = socket.conn.transport.socket;
        const topic = `${this.nsp.name}${SEPARATOR}${room}`;
        debug("unsubscribe connection %s from topic %s", sessionId, topic);
        websocket.unsubscribe(topic);
      }
    };
    socket_io_adapter_1.Adapter.prototype.broadcast = function(packet, opts) {
      const useFastPublish = opts.rooms.size <= 1 && opts.except.size === 0;
      if (!useFastPublish) {
        broadcast.call(this, packet, opts);
        return;
      }
      const flags = opts.flags || {};
      const basePacketOpts = {
        preEncoded: true,
        volatile: flags.volatile,
        compress: flags.compress
      };
      packet.nsp = this.nsp.name;
      const encodedPackets = this.encoder.encode(packet);
      const topic = opts.rooms.size === 0 ? this.nsp.name : `${this.nsp.name}${SEPARATOR}${opts.rooms.keys().next().value}`;
      debug("fast publish to %s", topic);
      encodedPackets.forEach((encodedPacket) => {
        const isBinary = typeof encodedPacket !== "string";
        app.publish(topic, isBinary ? encodedPacket : "4" + encodedPacket, isBinary);
      });
      this.apply(opts, (socket) => {
        if (socket.conn.transport.name !== "websocket") {
          socket.client.writeToEngine(encodedPackets, basePacketOpts);
        }
      });
    };
  }
  function subscribe(namespaceName, socket, isNew, rooms) {
    const sessionId = socket.conn.id;
    const websocket = socket.conn.transport.socket;
    if (isNew) {
      debug("subscribe connection %s to topic %s", sessionId, namespaceName);
      websocket.subscribe(namespaceName);
    }
    rooms.forEach((room) => {
      const topic = `${namespaceName}${SEPARATOR}${room}`;
      debug("subscribe connection %s to topic %s", sessionId, topic);
      websocket.subscribe(topic);
    });
  }
  function restoreAdapter() {
    socket_io_adapter_1.Adapter.prototype.addAll = addAll;
    socket_io_adapter_1.Adapter.prototype.del = del;
    socket_io_adapter_1.Adapter.prototype.broadcast = broadcast;
  }
  var toArrayBuffer = (buffer) => {
    const { buffer: arrayBuffer, byteOffset, byteLength } = buffer;
    return arrayBuffer.slice(byteOffset, byteOffset + byteLength);
  };
  function serveFile(res, filepath) {
    const { size } = (0, fs_1.statSync)(filepath);
    const readStream = (0, fs_1.createReadStream)(filepath);
    const destroyReadStream = () => !readStream.destroyed && readStream.destroy();
    const onError = (error) => {
      destroyReadStream();
      throw error;
    };
    const onDataChunk = (chunk) => {
      const arrayBufferChunk = toArrayBuffer(chunk);
      res.cork(() => {
        const lastOffset = res.getWriteOffset();
        const [ok, done] = res.tryEnd(arrayBufferChunk, size);
        if (!done && !ok) {
          readStream.pause();
          res.onWritable((offset) => {
            const [ok2, done2] = res.tryEnd(arrayBufferChunk.slice(offset - lastOffset), size);
            if (!done2 && ok2) {
              readStream.resume();
            }
            return ok2;
          });
        }
      });
    };
    res.onAborted(destroyReadStream);
    readStream.on("data", onDataChunk).on("error", onError).on("end", destroyReadStream);
  }
});

// node_modules/socket.io/package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "socket.io",
    version: "4.8.1",
    description: "node.js realtime framework server",
    keywords: [
      "realtime",
      "framework",
      "websocket",
      "tcp",
      "events",
      "socket",
      "io"
    ],
    files: [
      "dist/",
      "client-dist/",
      "wrapper.mjs",
      "!**/*.tsbuildinfo"
    ],
    directories: {
      doc: "docs/",
      example: "example/",
      lib: "lib/",
      test: "test/"
    },
    type: "commonjs",
    main: "./dist/index.js",
    exports: {
      types: "./dist/index.d.ts",
      import: "./wrapper.mjs",
      require: "./dist/index.js"
    },
    types: "./dist/index.d.ts",
    license: "MIT",
    homepage: "https://github.com/socketio/socket.io/tree/main/packages/socket.io#readme",
    repository: {
      type: "git",
      url: "git+https://github.com/socketio/socket.io.git"
    },
    bugs: {
      url: "https://github.com/socketio/socket.io/issues"
    },
    scripts: {
      compile: "rimraf ./dist && tsc",
      test: "npm run format:check && npm run compile && npm run test:types && npm run test:unit",
      "test:types": "tsd",
      "test:unit": "nyc mocha --require ts-node/register --reporter spec --slow 200 --bail --timeout 10000 test/index.ts",
      "format:check": 'prettier --check "lib/**/*.ts" "test/**/*.ts"',
      "format:fix": 'prettier --write "lib/**/*.ts" "test/**/*.ts"',
      prepack: "npm run compile"
    },
    dependencies: {
      accepts: "~1.3.4",
      base64id: "~2.0.0",
      cors: "~2.8.5",
      debug: "~4.3.2",
      "engine.io": "~6.6.0",
      "socket.io-adapter": "~2.5.2",
      "socket.io-parser": "~4.2.4"
    },
    contributors: [
      {
        name: "Guillermo Rauch",
        email: "rauchg@gmail.com"
      },
      {
        name: "Arnout Kazemier",
        email: "info@3rd-eden.com"
      },
      {
        name: "Vladimir Dronnikov",
        email: "dronnikov@gmail.com"
      },
      {
        name: "Einar Otto Stangvik",
        email: "einaros@gmail.com"
      }
    ],
    engines: {
      node: ">=10.2.0"
    },
    tsd: {
      directory: "test"
    }
  };
});

// node_modules/socket.io/dist/index.js
var require_dist2 = __commonJS((exports, module) => {
  var __dirname = "/Users/lawrencechen/fun/coderouter/node_modules/socket.io/dist";
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
  } : function(o, v) {
    o["default"] = v;
  });
  var __importStar = exports && exports.__importStar || function(mod) {
    if (mod && mod.__esModule)
      return mod;
    var result = {};
    if (mod != null) {
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
  };
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Namespace = exports.Socket = exports.Server = undefined;
  var http = __require("http");
  var fs_1 = __require("fs");
  var zlib_1 = __require("zlib");
  var accepts = require_accepts();
  var stream_1 = __require("stream");
  var path = __require("path");
  var engine_io_1 = require_engine_io();
  var client_1 = require_client();
  var events_1 = __require("events");
  var namespace_1 = require_namespace();
  Object.defineProperty(exports, "Namespace", { enumerable: true, get: function() {
    return namespace_1.Namespace;
  } });
  var parent_namespace_1 = require_parent_namespace();
  var socket_io_adapter_1 = require_dist();
  var parser = __importStar(require_cjs3());
  var debug_1 = __importDefault(require_src3());
  var socket_1 = require_socket2();
  Object.defineProperty(exports, "Socket", { enumerable: true, get: function() {
    return socket_1.Socket;
  } });
  var typed_events_1 = require_typed_events();
  var uws_1 = require_uws();
  var cors_1 = __importDefault(require_lib2());
  var debug = (0, debug_1.default)("socket.io:server");
  var clientVersion = require_package().version;
  var dotMapRegex = /\.map/;

  class Server extends typed_events_1.StrictEventEmitter {
    constructor(srv, opts = {}) {
      super();
      this._nsps = new Map;
      this.parentNsps = new Map;
      this.parentNamespacesFromRegExp = new Map;
      if (typeof srv === "object" && srv instanceof Object && !srv.listen) {
        opts = srv;
        srv = undefined;
      }
      this.path(opts.path || "/socket.io");
      this.connectTimeout(opts.connectTimeout || 45000);
      this.serveClient(opts.serveClient !== false);
      this._parser = opts.parser || parser;
      this.encoder = new this._parser.Encoder;
      this.opts = opts;
      if (opts.connectionStateRecovery) {
        opts.connectionStateRecovery = Object.assign({
          maxDisconnectionDuration: 2 * 60 * 1000,
          skipMiddlewares: true
        }, opts.connectionStateRecovery);
        this.adapter(opts.adapter || socket_io_adapter_1.SessionAwareAdapter);
      } else {
        this.adapter(opts.adapter || socket_io_adapter_1.Adapter);
      }
      opts.cleanupEmptyChildNamespaces = !!opts.cleanupEmptyChildNamespaces;
      this.sockets = this.of("/");
      if (srv || typeof srv == "number")
        this.attach(srv);
      if (this.opts.cors) {
        this._corsMiddleware = (0, cors_1.default)(this.opts.cors);
      }
    }
    get _opts() {
      return this.opts;
    }
    serveClient(v) {
      if (!arguments.length)
        return this._serveClient;
      this._serveClient = v;
      return this;
    }
    _checkNamespace(name, auth, fn) {
      if (this.parentNsps.size === 0)
        return fn(false);
      const keysIterator = this.parentNsps.keys();
      const run = () => {
        const nextFn = keysIterator.next();
        if (nextFn.done) {
          return fn(false);
        }
        nextFn.value(name, auth, (err, allow) => {
          if (err || !allow) {
            return run();
          }
          if (this._nsps.has(name)) {
            debug("dynamic namespace %s already exists", name);
            return fn(this._nsps.get(name));
          }
          const namespace = this.parentNsps.get(nextFn.value).createChild(name);
          debug("dynamic namespace %s was created", name);
          fn(namespace);
        });
      };
      run();
    }
    path(v) {
      if (!arguments.length)
        return this._path;
      this._path = v.replace(/\/$/, "");
      const escapedPath = this._path.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      this.clientPathRegex = new RegExp("^" + escapedPath + "/socket\\.io(\\.msgpack|\\.esm)?(\\.min)?\\.js(\\.map)?(?:\\?|$)");
      return this;
    }
    connectTimeout(v) {
      if (v === undefined)
        return this._connectTimeout;
      this._connectTimeout = v;
      return this;
    }
    adapter(v) {
      if (!arguments.length)
        return this._adapter;
      this._adapter = v;
      for (const nsp of this._nsps.values()) {
        nsp._initAdapter();
      }
      return this;
    }
    listen(srv, opts = {}) {
      return this.attach(srv, opts);
    }
    attach(srv, opts = {}) {
      if (typeof srv == "function") {
        const msg = "You are trying to attach socket.io to an express " + "request handler function. Please pass a http.Server instance.";
        throw new Error(msg);
      }
      if (Number(srv) == srv) {
        srv = Number(srv);
      }
      if (typeof srv == "number") {
        debug("creating http server and binding to %d", srv);
        const port = srv;
        srv = http.createServer((req, res) => {
          res.writeHead(404);
          res.end();
        });
        srv.listen(port);
      }
      Object.assign(opts, this.opts);
      opts.path = opts.path || this._path;
      this.initEngine(srv, opts);
      return this;
    }
    attachApp(app, opts = {}) {
      Object.assign(opts, this.opts);
      opts.path = opts.path || this._path;
      debug("creating uWebSockets.js-based engine with opts %j", opts);
      const engine = new engine_io_1.uServer(opts);
      engine.attach(app, opts);
      this.bind(engine);
      if (this._serveClient) {
        app.get(`${this._path}/*`, (res, req) => {
          if (!this.clientPathRegex.test(req.getUrl())) {
            req.setYield(true);
            return;
          }
          const filename = req.getUrl().replace(this._path, "").replace(/\?.*$/, "").replace(/^\//, "");
          const isMap = dotMapRegex.test(filename);
          const type = isMap ? "map" : "source";
          const expectedEtag = '"' + clientVersion + '"';
          const weakEtag = "W/" + expectedEtag;
          const etag = req.getHeader("if-none-match");
          if (etag) {
            if (expectedEtag === etag || weakEtag === etag) {
              debug("serve client %s 304", type);
              res.writeStatus("304 Not Modified");
              res.end();
              return;
            }
          }
          debug("serve client %s", type);
          res.writeHeader("cache-control", "public, max-age=0");
          res.writeHeader("content-type", "application/" + (isMap ? "json" : "javascript") + "; charset=utf-8");
          res.writeHeader("etag", expectedEtag);
          const filepath = path.join(__dirname, "../client-dist/", filename);
          (0, uws_1.serveFile)(res, filepath);
        });
      }
      (0, uws_1.patchAdapter)(app);
    }
    initEngine(srv, opts) {
      debug("creating engine.io instance with opts %j", opts);
      this.eio = (0, engine_io_1.attach)(srv, opts);
      if (this._serveClient)
        this.attachServe(srv);
      this.httpServer = srv;
      this.bind(this.eio);
    }
    attachServe(srv) {
      debug("attaching client serving req handler");
      const evs = srv.listeners("request").slice(0);
      srv.removeAllListeners("request");
      srv.on("request", (req, res) => {
        if (this.clientPathRegex.test(req.url)) {
          if (this._corsMiddleware) {
            this._corsMiddleware(req, res, () => {
              this.serve(req, res);
            });
          } else {
            this.serve(req, res);
          }
        } else {
          for (let i = 0;i < evs.length; i++) {
            evs[i].call(srv, req, res);
          }
        }
      });
    }
    serve(req, res) {
      const filename = req.url.replace(this._path, "").replace(/\?.*$/, "");
      const isMap = dotMapRegex.test(filename);
      const type = isMap ? "map" : "source";
      const expectedEtag = '"' + clientVersion + '"';
      const weakEtag = "W/" + expectedEtag;
      const etag = req.headers["if-none-match"];
      if (etag) {
        if (expectedEtag === etag || weakEtag === etag) {
          debug("serve client %s 304", type);
          res.writeHead(304);
          res.end();
          return;
        }
      }
      debug("serve client %s", type);
      res.setHeader("Cache-Control", "public, max-age=0");
      res.setHeader("Content-Type", "application/" + (isMap ? "json" : "javascript") + "; charset=utf-8");
      res.setHeader("ETag", expectedEtag);
      Server.sendFile(filename, req, res);
    }
    static sendFile(filename, req, res) {
      const readStream = (0, fs_1.createReadStream)(path.join(__dirname, "../client-dist/", filename));
      const encoding = accepts(req).encodings(["br", "gzip", "deflate"]);
      const onError = (err) => {
        if (err) {
          res.end();
        }
      };
      switch (encoding) {
        case "br":
          res.writeHead(200, { "content-encoding": "br" });
          (0, stream_1.pipeline)(readStream, (0, zlib_1.createBrotliCompress)(), res, onError);
          break;
        case "gzip":
          res.writeHead(200, { "content-encoding": "gzip" });
          (0, stream_1.pipeline)(readStream, (0, zlib_1.createGzip)(), res, onError);
          break;
        case "deflate":
          res.writeHead(200, { "content-encoding": "deflate" });
          (0, stream_1.pipeline)(readStream, (0, zlib_1.createDeflate)(), res, onError);
          break;
        default:
          res.writeHead(200);
          (0, stream_1.pipeline)(readStream, res, onError);
      }
    }
    bind(engine) {
      this.engine = engine;
      this.engine.on("connection", this.onconnection.bind(this));
      return this;
    }
    onconnection(conn) {
      debug("incoming connection with id %s", conn.id);
      const client = new client_1.Client(this, conn);
      if (conn.protocol === 3) {
        client.connect("/");
      }
      return this;
    }
    of(name, fn) {
      if (typeof name === "function" || name instanceof RegExp) {
        const parentNsp = new parent_namespace_1.ParentNamespace(this);
        debug("initializing parent namespace %s", parentNsp.name);
        if (typeof name === "function") {
          this.parentNsps.set(name, parentNsp);
        } else {
          this.parentNsps.set((nsp2, conn, next) => next(null, name.test(nsp2)), parentNsp);
          this.parentNamespacesFromRegExp.set(name, parentNsp);
        }
        if (fn) {
          parentNsp.on("connect", fn);
        }
        return parentNsp;
      }
      if (String(name)[0] !== "/")
        name = "/" + name;
      let nsp = this._nsps.get(name);
      if (!nsp) {
        for (const [regex, parentNamespace] of this.parentNamespacesFromRegExp) {
          if (regex.test(name)) {
            debug("attaching namespace %s to parent namespace %s", name, regex);
            return parentNamespace.createChild(name);
          }
        }
        debug("initializing namespace %s", name);
        nsp = new namespace_1.Namespace(this, name);
        this._nsps.set(name, nsp);
        if (name !== "/") {
          this.sockets.emitReserved("new_namespace", nsp);
        }
      }
      if (fn)
        nsp.on("connect", fn);
      return nsp;
    }
    async close(fn) {
      await Promise.allSettled([...this._nsps.values()].map(async (nsp) => {
        nsp.sockets.forEach((socket) => {
          socket._onclose("server shutting down");
        });
        await nsp.adapter.close();
      }));
      this.engine.close();
      (0, uws_1.restoreAdapter)();
      if (this.httpServer) {
        this.httpServer.close(fn);
      } else {
        fn && fn();
      }
    }
    use(fn) {
      this.sockets.use(fn);
      return this;
    }
    to(room) {
      return this.sockets.to(room);
    }
    in(room) {
      return this.sockets.in(room);
    }
    except(room) {
      return this.sockets.except(room);
    }
    send(...args) {
      this.sockets.emit("message", ...args);
      return this;
    }
    write(...args) {
      this.sockets.emit("message", ...args);
      return this;
    }
    serverSideEmit(ev, ...args) {
      return this.sockets.serverSideEmit(ev, ...args);
    }
    serverSideEmitWithAck(ev, ...args) {
      return this.sockets.serverSideEmitWithAck(ev, ...args);
    }
    allSockets() {
      return this.sockets.allSockets();
    }
    compress(compress) {
      return this.sockets.compress(compress);
    }
    get volatile() {
      return this.sockets.volatile;
    }
    get local() {
      return this.sockets.local;
    }
    timeout(timeout) {
      return this.sockets.timeout(timeout);
    }
    fetchSockets() {
      return this.sockets.fetchSockets();
    }
    socketsJoin(room) {
      return this.sockets.socketsJoin(room);
    }
    socketsLeave(room) {
      return this.sockets.socketsLeave(room);
    }
    disconnectSockets(close = false) {
      return this.sockets.disconnectSockets(close);
    }
  }
  exports.Server = Server;
  var emitterMethods = Object.keys(events_1.EventEmitter.prototype).filter(function(key) {
    return typeof events_1.EventEmitter.prototype[key] === "function";
  });
  emitterMethods.forEach(function(fn) {
    Server.prototype[fn] = function() {
      return this.sockets[fn].apply(this.sockets, arguments);
    };
  });
  module.exports = (srv, opts) => new Server(srv, opts);
  module.exports.Server = Server;
  module.exports.Namespace = namespace_1.Namespace;
  module.exports.Socket = socket_1.Socket;
});

// node_modules/zod/v3/external.js
var exports_external = {};
__export(exports_external, {
  void: () => voidType,
  util: () => util,
  unknown: () => unknownType,
  union: () => unionType,
  undefined: () => undefinedType,
  tuple: () => tupleType,
  transformer: () => effectsType,
  symbol: () => symbolType,
  string: () => stringType,
  strictObject: () => strictObjectType,
  setErrorMap: () => setErrorMap,
  set: () => setType,
  record: () => recordType,
  quotelessJson: () => quotelessJson,
  promise: () => promiseType,
  preprocess: () => preprocessType,
  pipeline: () => pipelineType,
  ostring: () => ostring,
  optional: () => optionalType,
  onumber: () => onumber,
  oboolean: () => oboolean,
  objectUtil: () => objectUtil,
  object: () => objectType,
  number: () => numberType,
  nullable: () => nullableType,
  null: () => nullType,
  never: () => neverType,
  nativeEnum: () => nativeEnumType,
  nan: () => nanType,
  map: () => mapType,
  makeIssue: () => makeIssue,
  literal: () => literalType,
  lazy: () => lazyType,
  late: () => late,
  isValid: () => isValid,
  isDirty: () => isDirty,
  isAsync: () => isAsync,
  isAborted: () => isAborted,
  intersection: () => intersectionType,
  instanceof: () => instanceOfType,
  getParsedType: () => getParsedType,
  getErrorMap: () => getErrorMap,
  function: () => functionType,
  enum: () => enumType,
  effect: () => effectsType,
  discriminatedUnion: () => discriminatedUnionType,
  defaultErrorMap: () => en_default,
  datetimeRegex: () => datetimeRegex,
  date: () => dateType,
  custom: () => custom,
  coerce: () => coerce,
  boolean: () => booleanType,
  bigint: () => bigIntType,
  array: () => arrayType,
  any: () => anyType,
  addIssueToContext: () => addIssueToContext,
  ZodVoid: () => ZodVoid,
  ZodUnknown: () => ZodUnknown,
  ZodUnion: () => ZodUnion,
  ZodUndefined: () => ZodUndefined,
  ZodType: () => ZodType,
  ZodTuple: () => ZodTuple,
  ZodTransformer: () => ZodEffects,
  ZodSymbol: () => ZodSymbol,
  ZodString: () => ZodString,
  ZodSet: () => ZodSet,
  ZodSchema: () => ZodType,
  ZodRecord: () => ZodRecord,
  ZodReadonly: () => ZodReadonly,
  ZodPromise: () => ZodPromise,
  ZodPipeline: () => ZodPipeline,
  ZodParsedType: () => ZodParsedType,
  ZodOptional: () => ZodOptional,
  ZodObject: () => ZodObject,
  ZodNumber: () => ZodNumber,
  ZodNullable: () => ZodNullable,
  ZodNull: () => ZodNull,
  ZodNever: () => ZodNever,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNaN: () => ZodNaN,
  ZodMap: () => ZodMap,
  ZodLiteral: () => ZodLiteral,
  ZodLazy: () => ZodLazy,
  ZodIssueCode: () => ZodIssueCode,
  ZodIntersection: () => ZodIntersection,
  ZodFunction: () => ZodFunction,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodError: () => ZodError,
  ZodEnum: () => ZodEnum,
  ZodEffects: () => ZodEffects,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodDefault: () => ZodDefault,
  ZodDate: () => ZodDate,
  ZodCatch: () => ZodCatch,
  ZodBranded: () => ZodBranded,
  ZodBoolean: () => ZodBoolean,
  ZodBigInt: () => ZodBigInt,
  ZodArray: () => ZodArray,
  ZodAny: () => ZodAny,
  Schema: () => ZodType,
  ParseStatus: () => ParseStatus,
  OK: () => OK,
  NEVER: () => NEVER,
  INVALID: () => INVALID,
  EMPTY_PATH: () => EMPTY_PATH,
  DIRTY: () => DIRTY,
  BRAND: () => BRAND
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {};
  function assertIs(_arg) {}
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error;
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== undefined) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === en_default ? undefined : en_default
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}

class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus,
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}

class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}

class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};

class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};

class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};

class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};

class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};

class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};

class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};

class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};

class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};

class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};

class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};

class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : undefined,
          maximum: tooBig ? def.exactLength.value : undefined,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}

class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {} else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== undefined ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};

class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = undefined;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [undefined, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};

class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(discriminator, options, params) {
    const optionsMap = new Map;
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}

class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};

class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};

class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}

class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = new Map;
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = new Map;
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};

class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = new Set;
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};

class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}

class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};

class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}

class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};

class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};

class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(undefined);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};

class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};

class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};

class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};

class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");

class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}

class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}

class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
// packages/shared/src/socket-schemas.ts
var CreateTerminalSchema = exports_external.object({
  id: exports_external.string().optional(),
  cols: exports_external.number().int().positive().default(80),
  rows: exports_external.number().int().positive().default(24)
});
var TerminalInputSchema = exports_external.object({
  terminalId: exports_external.string(),
  data: exports_external.string()
});
var ResizeSchema = exports_external.object({
  terminalId: exports_external.string(),
  cols: exports_external.number().int().positive(),
  rows: exports_external.number().int().positive()
});
var CloseTerminalSchema = exports_external.object({
  terminalId: exports_external.string()
});
var StartTaskSchema = exports_external.object({
  repoUrl: exports_external.string(),
  branch: exports_external.string().optional(),
  taskDescription: exports_external.string(),
  projectFullName: exports_external.string(),
  taskId: exports_external.string(),
  selectedAgents: exports_external.array(exports_external.string()).optional()
});
var TerminalCreatedSchema = exports_external.object({
  terminalId: exports_external.string()
});
var TerminalOutputSchema = exports_external.object({
  terminalId: exports_external.string(),
  data: exports_external.string()
});
var TerminalExitSchema = exports_external.object({
  terminalId: exports_external.string(),
  exitCode: exports_external.number().int(),
  signal: exports_external.number().int().optional()
});
var TerminalClosedSchema = exports_external.object({
  terminalId: exports_external.string()
});
var TerminalClearSchema = exports_external.object({
  terminalId: exports_external.string()
});
var TerminalRestoreSchema = exports_external.object({
  terminalId: exports_external.string(),
  data: exports_external.string()
});
var TaskStartedSchema = exports_external.object({
  taskId: exports_external.string(),
  worktreePath: exports_external.string(),
  terminalId: exports_external.string()
});
var TaskErrorSchema = exports_external.object({
  taskId: exports_external.string(),
  error: exports_external.string()
});
var GitStatusRequestSchema = exports_external.object({
  workspacePath: exports_external.string()
});
var GitDiffRequestSchema = exports_external.object({
  workspacePath: exports_external.string(),
  filePath: exports_external.string()
});
var GitFullDiffRequestSchema = exports_external.object({
  workspacePath: exports_external.string()
});
var GitFileSchema = exports_external.object({
  path: exports_external.string(),
  status: exports_external.enum(["added", "modified", "deleted", "renamed"]),
  additions: exports_external.number(),
  deletions: exports_external.number()
});
var DiffLineSchema = exports_external.object({
  type: exports_external.enum(["addition", "deletion", "context", "header"]),
  content: exports_external.string(),
  lineNumber: exports_external.object({
    old: exports_external.number().optional(),
    new: exports_external.number().optional()
  }).optional()
});
var GitStatusResponseSchema = exports_external.object({
  files: exports_external.array(GitFileSchema),
  error: exports_external.string().optional()
});
var GitDiffResponseSchema = exports_external.object({
  path: exports_external.string(),
  diff: exports_external.array(DiffLineSchema),
  error: exports_external.string().optional()
});
var GitFileChangedSchema = exports_external.object({
  workspacePath: exports_external.string(),
  filePath: exports_external.string()
});
var GitFullDiffResponseSchema = exports_external.object({
  diff: exports_external.string(),
  error: exports_external.string().optional()
});
var OpenInEditorSchema = exports_external.object({
  editor: exports_external.enum(["vscode", "cursor", "windsurf"]),
  path: exports_external.string()
});
var OpenInEditorErrorSchema = exports_external.object({
  error: exports_external.string()
});
var ListFilesRequestSchema = exports_external.object({
  repoUrl: exports_external.string(),
  branch: exports_external.string().optional().default("main"),
  pattern: exports_external.string().optional()
});
var FileInfoSchema = exports_external.object({
  path: exports_external.string(),
  name: exports_external.string(),
  isDirectory: exports_external.boolean(),
  relativePath: exports_external.string()
});
var ListFilesResponseSchema = exports_external.object({
  files: exports_external.array(FileInfoSchema),
  error: exports_external.string().optional()
});
// packages/shared/src/worker-schemas.ts
var WorkerRegisterSchema = exports_external.object({
  workerId: exports_external.string(),
  capabilities: exports_external.object({
    maxConcurrentTerminals: exports_external.number().int().positive(),
    supportedLanguages: exports_external.array(exports_external.string()).optional(),
    gpuAvailable: exports_external.boolean().optional(),
    memoryMB: exports_external.number().int().positive(),
    cpuCores: exports_external.number().int().positive()
  }),
  containerInfo: exports_external.object({
    image: exports_external.string(),
    version: exports_external.string(),
    platform: exports_external.string()
  }).optional()
});
var WorkerHeartbeatSchema = exports_external.object({
  workerId: exports_external.string(),
  timestamp: exports_external.number(),
  stats: exports_external.object({
    activeTerminals: exports_external.number().int(),
    cpuUsage: exports_external.number().min(0).max(100),
    memoryUsage: exports_external.number().min(0).max(100)
  })
});
var TerminalAssignmentSchema = exports_external.object({
  terminalId: exports_external.string(),
  workerId: exports_external.string(),
  taskId: exports_external.string().optional()
});
var WorkerStatusSchema = exports_external.object({
  workerId: exports_external.string(),
  status: exports_external.enum(["online", "offline", "busy", "error"]),
  lastSeen: exports_external.number()
});
var WorkerCreateTerminalSchema = exports_external.object({
  terminalId: exports_external.string(),
  cols: exports_external.number().int().positive().default(80),
  rows: exports_external.number().int().positive().default(24),
  cwd: exports_external.string().optional(),
  env: exports_external.record(exports_external.string()).optional(),
  command: exports_external.string().optional(),
  args: exports_external.array(exports_external.string()).optional(),
  taskId: exports_external.string().optional()
});
var WorkerTerminalInputSchema = exports_external.object({
  terminalId: exports_external.string(),
  data: exports_external.string()
});
var WorkerResizeTerminalSchema = exports_external.object({
  terminalId: exports_external.string(),
  cols: exports_external.number().int().positive(),
  rows: exports_external.number().int().positive()
});
var WorkerCloseTerminalSchema = exports_external.object({
  terminalId: exports_external.string()
});
var WorkerTerminalOutputSchema = exports_external.object({
  workerId: exports_external.string(),
  terminalId: exports_external.string(),
  data: exports_external.string()
});
var WorkerTerminalExitSchema = exports_external.object({
  workerId: exports_external.string(),
  terminalId: exports_external.string(),
  exitCode: exports_external.number().int(),
  signal: exports_external.number().int().optional()
});
var WorkerTerminalCreatedSchema = exports_external.object({
  workerId: exports_external.string(),
  terminalId: exports_external.string()
});
var WorkerTerminalClosedSchema = exports_external.object({
  workerId: exports_external.string(),
  terminalId: exports_external.string()
});
var ServerToWorkerCommandSchema = exports_external.object({
  command: exports_external.enum(["create-terminal", "destroy-terminal", "execute-command"]),
  payload: exports_external.any()
});
// packages/shared/src/terminal-config.ts
var SERVER_TERMINAL_CONFIG = {
  cols: 80,
  rows: 24,
  scrollback: 1e5,
  allowProposedApi: true
};
// apps/worker/src/index.ts
var import_addon_serialize = __toESM(require_addon_serialize(), 1);
var import_headless = __toESM(require_xterm_headless(), 1);
var import_node_pty = __toESM(require_lib(), 1);
import { createServer } from "node:http";
import { platform, cpus, totalmem } from "node:os";

// node_modules/socket.io/wrapper.mjs
var import_dist = __toESM(require_dist2(), 1);
var { Server, Namespace, Socket } = import_dist.default;

// apps/worker/src/index.ts
var { Terminal } = import_headless.default;
var WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
var WORKER_PORT = parseInt(process.env.WORKER_PORT || "3002", 10);
var MANAGEMENT_PORT = parseInt(process.env.MANAGEMENT_PORT || "3003", 10);
var CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || "coderouter/worker:latest";
var CONTAINER_VERSION = process.env.CONTAINER_VERSION || "1.0.0";
var terminals = new Map;
var clientHttpServer = createServer();
var managementHttpServer = createServer();
var clientIO = new Server(clientHttpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
var managementIO = new Server(managementHttpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
var mainServerSocket = null;
function getWorkerStats() {
  const totalMem = totalmem();
  const usedMem = process.memoryUsage().heapUsed;
  return {
    workerId: WORKER_ID,
    timestamp: Date.now(),
    stats: {
      activeTerminals: terminals.size,
      cpuUsage: 0,
      memoryUsage: usedMem / totalMem * 100
    }
  };
}
function registerWithMainServer(socket) {
  const registration = {
    workerId: WORKER_ID,
    capabilities: {
      maxConcurrentTerminals: 50,
      supportedLanguages: ["javascript", "typescript", "python", "go", "rust"],
      gpuAvailable: false,
      memoryMB: Math.floor(totalmem() / 1024 / 1024),
      cpuCores: cpus().length
    },
    containerInfo: {
      image: CONTAINER_IMAGE,
      version: CONTAINER_VERSION,
      platform: platform()
    }
  };
  socket.emit("worker:register", registration);
  console.log(`Worker ${WORKER_ID} sent registration to main server`);
}
managementIO.on("connection", (socket) => {
  console.log(`Main server connected to worker ${WORKER_ID}`);
  mainServerSocket = socket;
  registerWithMainServer(socket);
  socket.on("worker:create-terminal", (data) => {
    try {
      const validated = WorkerCreateTerminalSchema.parse(data);
      const terminal = createTerminal(validated.terminalId, {
        cols: validated.cols,
        rows: validated.rows,
        cwd: validated.cwd,
        env: validated.env,
        command: validated.command,
        args: validated.args,
        taskId: validated.taskId
      });
      if (terminal) {
        socket.emit("worker:terminal-created", {
          workerId: WORKER_ID,
          terminalId: validated.terminalId
        });
      }
    } catch (error) {
      console.error("Error creating terminal from main server:", error);
      socket.emit("worker:error", {
        workerId: WORKER_ID,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  socket.on("worker:terminal-input", (data) => {
    try {
      const validated = WorkerTerminalInputSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.write(validated.data);
      }
    } catch (error) {
      console.error("Error handling terminal input from main server:", error);
    }
  });
  socket.on("worker:resize-terminal", (data) => {
    try {
      const validated = WorkerResizeTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.resize(validated.cols, validated.rows);
        terminal.headlessTerminal.resize(validated.cols, validated.rows);
      }
    } catch (error) {
      console.error("Error resizing terminal from main server:", error);
    }
  });
  socket.on("worker:close-terminal", (data) => {
    try {
      const validated = WorkerCloseTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(validated.terminalId);
        clientIO.emit("terminal-closed", { terminalId: validated.terminalId });
        socket.emit("worker:terminal-closed", {
          workerId: WORKER_ID,
          terminalId: validated.terminalId
        });
      }
    } catch (error) {
      console.error("Error closing terminal from main server:", error);
    }
  });
  socket.on("worker:shutdown", () => {
    console.log(`Worker ${WORKER_ID} received shutdown command`);
    gracefulShutdown();
  });
  socket.on("disconnect", () => {
    console.log(`Main server disconnected from worker ${WORKER_ID}`);
    mainServerSocket = null;
  });
});
clientIO.on("connection", (socket) => {
  console.log(`Client connected to worker ${WORKER_ID}:`, socket.id);
  terminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });
  socket.on("create-terminal", (data) => {
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);
      if (id && terminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }
      const terminalId = id || crypto.randomUUID();
      const terminal = createTerminal(terminalId, { cols, rows });
      if (terminal) {
        clientIO.emit("terminal-created", { terminalId });
        console.log(`Terminal ${terminalId} created on worker ${WORKER_ID}`);
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-created", {
            workerId: WORKER_ID,
            terminalId
          });
        }
      }
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });
  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminal = terminals.get(terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.write(data);
      }
    } catch (error) {
      console.error("Invalid terminal-input data:", error);
    }
  });
  socket.on("resize", (resizeData) => {
    try {
      const { terminalId, cols, rows } = ResizeSchema.parse(resizeData);
      const terminal = terminals.get(terminalId);
      if (terminal && terminal.pty) {
        if (!terminal.pty.pid) {
          console.warn(`Terminal ${terminalId} has no PID, likely already exited`);
          terminals.delete(terminalId);
        } else {
          terminal.pty.resize(cols - 1, rows - 1);
          terminal.headlessTerminal.resize(cols - 1, rows - 1);
          terminal.pty.resize(cols, rows);
          terminal.headlessTerminal.resize(cols, rows);
        }
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
    }
  });
  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminal = terminals.get(terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(terminalId);
        clientIO.emit("terminal-closed", { terminalId });
        console.log(`Terminal ${terminalId} closed on worker ${WORKER_ID}`);
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-closed", {
            workerId: WORKER_ID,
            terminalId
          });
        }
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });
  socket.on("disconnect", () => {
    console.log(`Client disconnected from worker ${WORKER_ID}:`, socket.id);
  });
});
function createTerminal(terminalId, options = {}) {
  if (terminals.has(terminalId)) {
    console.error(`Terminal ${terminalId} already exists`);
    return null;
  }
  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME || "/",
    env = process.env,
    command,
    args = [],
    taskId
  } = options;
  const shell = command || (platform() === "win32" ? "powershell.exe" : "bash");
  const ptyProcess = import_node_pty.spawn(shell, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...env,
      WORKER_ID,
      TERM: "xterm-256color"
    }
  });
  const headlessTerminal = new Terminal({
    cols,
    rows,
    scrollback: SERVER_TERMINAL_CONFIG.scrollback,
    allowProposedApi: SERVER_TERMINAL_CONFIG.allowProposedApi
  });
  const serializeAddon = new import_addon_serialize.SerializeAddon;
  headlessTerminal.loadAddon(serializeAddon);
  const terminal = {
    pty: ptyProcess,
    headlessTerminal,
    serializeAddon,
    taskId
  };
  terminals.set(terminalId, terminal);
  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    clientIO.emit("terminal-output", { terminalId, data });
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-output", {
        workerId: WORKER_ID,
        terminalId,
        data
      });
    }
  });
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
    terminals.delete(terminalId);
    clientIO.emit("terminal-exit", { terminalId, exitCode, signal });
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-exit", {
        workerId: WORKER_ID,
        terminalId,
        exitCode,
        signal
      });
    }
  });
  return terminal;
}
setInterval(() => {
  const stats = getWorkerStats();
  if (mainServerSocket) {
    mainServerSocket.emit("worker:heartbeat", stats);
  } else {
    console.log(`Worker ${WORKER_ID} heartbeat (main server not connected):`, stats);
  }
}, 30000);
clientHttpServer.listen(WORKER_PORT, () => {
  console.log(`Worker ${WORKER_ID} client server listening on port ${WORKER_PORT}`);
});
managementHttpServer.listen(MANAGEMENT_PORT, () => {
  console.log(`Worker ${WORKER_ID} management server listening on port ${MANAGEMENT_PORT}`);
  console.log(`Waiting for main server to connect...`);
});
function gracefulShutdown() {
  console.log(`Worker ${WORKER_ID} shutting down...`);
  terminals.forEach((terminal, id) => {
    console.log(`Killing terminal ${id}`);
    try {
      terminal.pty.kill();
    } catch (error) {
      console.error(`Error killing terminal ${id}:`, error);
    }
  });
  terminals.clear();
  clientIO.close(() => {
    console.log("Client Socket.IO server closed");
  });
  managementIO.close(() => {
    console.log("Management Socket.IO server closed");
  });
  clientHttpServer.close(() => {
    console.log("Client HTTP server closed");
  });
  managementHttpServer.close(() => {
    console.log("Management HTTP server closed");
    process.exit(0);
  });
}
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
