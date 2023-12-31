(() => {
  "use strict";
  var t = {
      9478: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.i = void 0),
          (e.i = function (t) {
            return "object" == typeof t && void 0 !== t.o;
          });
      },
      8192: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.h = void 0),
          (e.h = function (t) {
            return "object" == typeof t && void 0 !== t.init;
          });
      },
      7249: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.u = void 0),
          (e.u = function (t) {
            return "object" == typeof t && void 0 !== t.l;
          });
      },
      3349: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.v = void 0),
          (e.v = function (t) {
            return "object" == typeof t && void 0 !== t.step;
          });
      },
      1971: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9327),
          o = n(8725),
          c = s(n(3910));
        e.default = class {
          _(t) {
            const e = {};
            for (let n = 0; n < t.length; n++) {
              const s = t[n];
              if (o.m(s))
                for (let n = 0; n < t.length; n++) {
                  const i = t[n];
                  if (s !== i && o.m(i)) {
                    this.O(s, i) &&
                      (void 0 === e[s.id] ? (e[s.id] = [i]) : e[s.id].push(i));
                  }
                }
              s.p(e[s.id]);
            }
            return e;
          }
          O(t, e) {
            if (t.g instanceof i.j) {
              if (e.g instanceof i.j)
                return c.default.C(t.g, e.g, t.position, e.position);
              if (e.g instanceof i.R)
                return c.default.I(e.g, t.g, e.position, t.position);
            }
            if (t.g instanceof i.R) {
              if (e.g instanceof i.j)
                return c.default.I(t.g, e.g, t.position, e.position);
              if (e.g instanceof i.R)
                return c.default.F(e.g, t.g, e.position, t.position);
            }
            return !1;
          }
        };
      },
      1239: (t, e, n) => {
        Object.defineProperty(e, "t", { value: !0 });
        const s = n(3349),
          i = n(8192),
          o = n(9478),
          c = n(4939);
        e.default = class {
          initialize(t) {
            const { k: e } = t;
            e.forEach((e) => {
              i.h(e) && e.S && (e.init(t), (e.S = !1));
            });
          }
          step(t) {
            t.k.forEach((e) => {
              s.v(e) && e.step(t);
            });
          }
          A(t) {
            const { k: e } = t;
            c.L(e, (t) => !(o.i(t) && t.o)).forEach((t) => {
              o.i(t) && t.A && t.A();
            });
          }
        };
      },
      4446: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(7249),
          o = s(n(2854)),
          c = s(n(6364)),
          r = s(n(5656)),
          h = n(6353);
        function u(t, e) {
          return 0 === t.children.length
            ? e
            : (t.children.forEach((t) => {
                e.push(t), u(t, e);
              }),
              []);
        }
        e.default = class {
          l(t) {
            const { P: e, T: n, k: s } = t,
              { canvas: o } = e,
              c = s.filter(i.u).filter((t) => "background" !== t.id),
              r = s.find((t) => "background" === t.id),
              a = [];
            c.forEach((t) => {
              if (i.u(t)) {
                const e = t.l(),
                  n = [];
                u(e, n), a.push(e), a.push(...n);
              }
            });
            const l = a.filter((t) => "overlay" === t.J),
              w = a.filter((t) => "normal" === t.J);
            this.N(e),
              r &&
                this.X(e, () => {
                  r.l().l(t);
                }),
              this.X(e, () => {
                e.translate(h.$.w / 2, h.$.B / 2),
                  e.scale(n.zoom, n.zoom),
                  e.translate(-n.position.x, -n.position.y),
                  w.forEach((n) => {
                    i.u(n) &&
                      this.X(e, () => {
                        n.l(t);
                      });
                  });
              }),
              l.forEach((n) => {
                this.X(e, () => {
                  n.l(t);
                });
              }),
              t.K && this.G(e);
          }
          N(t) {
            const e = t.canvas;
            t.clearRect(-1, -1, e.width + 1, e.height + 1);
          }
          X(t, e) {
            t.save(), e(), t.restore();
          }
          G(t) {
            const e = { w: t.canvas.width, B: t.canvas.height };
            t.rect(0, 0, e.w, e.B),
              (t.fillStyle = new r.default(0, 0, 0, 0.5).W()),
              t.fill(),
              (t.font = "45px Comic Sans MS"),
              (t.fillStyle = "#FFF"),
              c.default.D(t, "Press [p] to unpause", new o.default(e.w / 2, 0));
          }
        };
      },
      6111: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(2854)),
          o = s(n(3910)),
          c = n(3704);
        class r {
          step(t) {
            const { V: e } = t;
            if (this.Y(e)) {
              const n = this.U(e);
              null === n || n.q
                ? e.H(t)
                : this.Z(e, n) && this.tt(e)
                ? e.et(n)
                : e.H(t);
            }
          }
          nt(t) {
            return !o.default.st(t.V.position, t.it, new i.default());
          }
          U(t) {
            let e;
            return (e = t.ot.find((t) => t.type === c.rt.ct)), e || null;
          }
          Y(t) {
            let e = !1;
            return (
              t.ht &&
                (e = t.ot.some(
                  (t) => t.type === c.rt.ct || t.type === c.rt.ut
                )),
              e
            );
          }
          Z(t, e) {
            const n = t.position.clone().sub(e.position);
            return Math.abs(t.direction.at(n)) < r.lt;
          }
          tt(t) {
            return t.speed < r.wt;
          }
        }
        (r.wt = 70), (r.lt = Math.PI / 4), (e.default = r);
      },
      9764: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(977)),
          o = s(n(2854)),
          c = n(9327);
        class r extends i.default {
          constructor() {
            super("camera"),
              (this.A = void 0),
              (this.locked = !1),
              (this.S = !0),
              (this.o = !1),
              (this.dt = new o.default(0, 0)),
              (this.viewport = new c.R(
                document.body.scrollWidth,
                document.body.scrollHeight
              )),
              (this.ft = 1),
              (this.vt = null);
          }
          init(t) {
            const { P: e } = t,
              n = e.canvas;
            (this.viewport.w = n.width), (this.viewport.B = n.height);
            let s = new o.default(),
              i = new o.default(),
              c = !1;
            const r = (t) => {
                t.preventDefault();
                const e = -1 * (t.clientX - (n.offsetLeft + n.width / 2)),
                  s = -1 * (t.clientY - (n.offsetTop + n.height / 2)),
                  i = t.deltaY < 0 ? 1 : -1,
                  o = Math.exp(0.02 * i),
                  c = this.zoom;
                (this.zoom = this.zoom * o),
                  c !== this.zoom &&
                    null === this.vt &&
                    ((this.position.x += e / (this.zoom * o) - e / this.zoom),
                    (this.position.y += s / (this.zoom * o) - s / this.zoom));
              },
              h = (t) => {
                if (c) {
                  this.Mt();
                  const e = i.clone().sub(new o.default(t.clientX, t.clientY));
                  e._t(1 / this.zoom), (this.position = s.clone().add(e));
                }
              },
              u = (t) => {
                (c = !0),
                  (s = this.position.clone()),
                  (i = new o.default(t.clientX, t.clientY));
              },
              a = (t) => {
                c = !1;
              },
              l = (t) => {
                "." === t.key && this.bt(), "," === t.key && this.Ot();
              };
            n.addEventListener("mousedown", u),
              n.addEventListener("mouseup", a),
              n.addEventListener("mouseover", a),
              n.addEventListener("mouseout", a),
              n.addEventListener("mousemove", h),
              n.addEventListener("wheel", r),
              window.addEventListener("keydown", l),
              (this.A = () => {
                n.removeEventListener("mousedown", u),
                  n.removeEventListener("mouseup", a),
                  n.removeEventListener("mouseover", a),
                  n.removeEventListener("mouseout", a),
                  n.removeEventListener("mousemove", h),
                  n.removeEventListener("wheel", r),
                  window.removeEventListener("keydown", l);
              });
          }
          gt(t) {
            this.vt = t;
          }
          Mt() {
            this.vt = null;
          }
          bt() {
            this.zoom += 0.5;
          }
          Ot() {
            this.zoom -= 0.5;
          }
          set zoom(t) {
            this.locked || (this.ft = Math.min(Math.max(t, 0.01), 14));
          }
          get zoom() {
            return this.ft;
          }
          set position(t) {
            this.locked || (this.dt = t);
          }
          get position() {
            return this.dt;
          }
          step(t) {
            null !== this.vt && (this.dt = this.vt.position.clone()),
              this.jt(t.it);
          }
          jt(t) {
            const e = this.position.clone().x - this.viewport.w / 2 < -t.w / 2,
              n = this.position.clone().x + this.viewport.w / 2 > t.w / 2,
              s = this.position.clone().y - this.viewport.B / 2 > t.B / 2,
              i = this.position.clone().y + this.viewport.B / 2 < -t.B / 2;
            e && (this.position.x = -t.w / 2 + this.viewport.w / 2),
              n && (this.position.x = t.w / 2 - this.viewport.w / 2),
              s && (this.position.y = t.w / 2 + this.viewport.B / 2),
              i && (this.position.y = -t.w / 2 - this.viewport.B / 2);
          }
        }
        e.default = r;
      },
      6353: (t, e, n) => {
        Object.defineProperty(e, "t", { value: !0 }), (e.$ = void 0);
        const s = n(9327);
        e.$ = new s.R(document.body.scrollWidth, document.body.scrollHeight);
        e.default = class {
          static yt() {
            let t;
            const n = document.createElement("canvas"),
              s = document.getElementById("c");
            if (!s) throw "";
            {
              const i = () => {
                  (n.width = document.body.scrollWidth),
                    (n.height = document.body.scrollHeight),
                    (t.imageSmoothingEnabled = !1),
                    t.translate(0.5, 0.5),
                    (e.$.w = n.width),
                    (e.$.B = n.height);
                },
                o = n.getContext("2d");
              if (void 0 === o) throw "";
              (t = o),
                i(),
                s.appendChild(n),
                window.addEventListener("resize", i);
            }
            return t;
          }
        };
      },
      9753: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        function n() {
          return ("undefined" == typeof performance ? Date : performance).now();
        }
        e.default = class {
          constructor(t = !0) {
            (this.Ct = t),
              (this.startTime = 0),
              (this.xt = 0),
              (this.elapsedTime = 0),
              (this.Rt = !1);
          }
          start() {
            (this.startTime = n()),
              (this.xt = this.startTime),
              (this.elapsedTime = 0),
              (this.Rt = !0);
          }
          stop() {
            this.It(), (this.Rt = !1), (this.Ct = !1);
          }
          It() {
            return this.Ft(), this.elapsedTime;
          }
          Ft() {
            let t = 0;
            if (this.Ct && !this.Rt) return this.start(), 0;
            if (this.Rt) {
              const e = n();
              (t = (e - this.xt) / 1e3), (this.xt = e), (this.elapsedTime += t);
            }
            return t;
          }
        };
      },
      6319: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.kt = void 0);
        const i = s(n(7421)),
          o = s(n(9753)),
          c = s(n(6353)),
          r = n(1991),
          h = s(n(9010)),
          u = i.default.St();
        e.default = class {
          constructor() {
            (this.K = !1),
              (this.At = 1),
              (this.Lt = !1),
              (this.Pt = () => {
                (this.K = !1), this.Tt.start();
              }),
              (this.pause = () => {
                (this.K = !0), this.Tt.stop();
              }),
              (this.loop = () => () => {
                this.update(), requestAnimationFrame(this.loop()), this.Jt();
              }),
              (this.zt = (t) => {
                this.Xt.Nt(t), this.Xt.next();
              }),
              (this.$t = () => {
                r.Bt(), (this.Lt = !1), this.Pt();
              }),
              (this.P = c.default.yt()),
              (this.Tt = new o.default()),
              (this.Xt = new h.default());
          }
          init() {
            this.Xt.init(),
              window.addEventListener("blur", () => {
                u.Et(), this.pause();
              }),
              window.addEventListener("keydown", (t) => {
                if (
                  ("x" === t.key &&
                    ((this.At += 1), (this.At = Math.min(this.At, 5))),
                  "z" === t.key &&
                    ((this.At -= 1), (this.At = Math.max(this.At, 1))),
                  "m" === t.key && (this.Lt ? this.$t() : this.Kt()),
                  "r" === t.key && this.Xt.Gt(),
                  " " === t.key)
                ) {
                  const t = this.Xt.Wt();
                  t.T.gt(t.V);
                }
                "p" !== t.key || this.Lt || (this.K ? this.Pt() : this.pause());
              }),
              this.Kt();
          }
          update() {
            try {
              const t = this.Xt.Wt(),
                e = this.Dt();
              t.update(e);
            } catch (t) {
              console.log(t);
            }
          }
          Jt() {}
          Dt() {
            const t = this.Tt.Ft() * this.At;
            return new a(t, this.P, this.K, this.zt, this.pause, this.Pt);
          }
          Kt() {
            this.pause(),
              r.Vt(this.$t, this.Xt.Yt(), this.Xt.Ut, this.Xt.qt(), (t) =>
                this.Xt.Ht(t)
              ),
              (this.Lt = !0);
          }
        };
        class a {
          constructor(t, e, n, s, i, o) {
            (this.Qt = t),
              (this.P = e),
              (this.K = n),
              (this.zt = s),
              (this.pause = i),
              (this.Pt = o);
          }
        }
        e.kt = a;
      },
      1839: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        e.default = class {
          constructor(t, e, n, s, i, o, c, r, h, u, a, l, w) {
            (this.ot = t),
              (this.Qt = e),
              (this.K = n),
              (this.k = s),
              (this.Zt = i),
              (this.P = o),
              (this.T = c),
              (this.it = r),
              (this.V = h),
              (this.te = u),
              (this.ee = a),
              (this.pause = l),
              (this.Pt = w);
          }
        };
      },
      7421: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        class n {
          constructor() {
            (this.ne = (t) => {
              this.Zt[t.key] = !1;
            }),
              (this.se = (t) => {
                this.Zt[t.key] = !0;
              }),
              (this.ie = (t) => !!this.Zt[t]),
              (this.Zt = {}),
              document.addEventListener("keydown", this.se),
              document.addEventListener("keyup", this.ne);
          }
          Et() {
            this.Zt = {};
          }
          oe() {
            document.removeEventListener("keydown", this.se),
              document.removeEventListener("keyup", this.ne);
          }
          static St() {
            return n.ce || (n.ce = new n()), n.ce;
          }
          re() {
            return Object.keys(this.Zt).some((t) => this.Zt[t]);
          }
        }
        e.default = n;
      },
      1866: function (t, e, n) {
        var s =
            (this && this.he) ||
            (Object.create
              ? function (t, e, n, s) {
                  void 0 === s && (s = n),
                    Object.defineProperty(t, s, {
                      ue: !0,
                      get: function () {
                        return e[n];
                      },
                    });
                }
              : function (t, e, n, s) {
                  void 0 === s && (s = n), (t[s] = e[n]);
                }),
          i =
            (this && this.ae) ||
            (Object.create
              ? function (t, e) {
                  Object.defineProperty(t, "default", { ue: !0, value: e });
                }
              : function (t, e) {
                  t.default = e;
                }),
          o =
            (this && this.le) ||
            function (t) {
              if (t && t.t) return t;
              var e = {};
              if (null != t)
                for (var n in t)
                  "default" !== n &&
                    Object.hasOwnProperty.call(t, n) &&
                    s(e, t, n);
              return i(e, t), e;
            },
          c =
            (this && this.M) ||
            function (t) {
              return t && t.t ? t : { default: t };
            };
        Object.defineProperty(e, "t", { value: !0 }), (e.Text = void 0);
        const r = n(9327),
          h = c(n(977)),
          u = c(n(9764)),
          a = o(n(2164)),
          l = c(n(9789)),
          w = c(n(2854)),
          d = c(n(1839)),
          f = c(n(1239)),
          v = c(n(1971)),
          M = c(n(4446)),
          _ = n(8725),
          m = c(n(7421)),
          b = c(n(6111)),
          O = c(n(6364)),
          p = n(6353),
          g = c(n(9878)),
          j = c(n(6271)),
          y = c(n(9451)),
          C = c(n(3530)),
          x = m.default.St();
        var R;
        (e.default = class {
          constructor(t, e, n = new r.R(5e3, 5e3)) {
            (this.k = []),
              (this.te = 0),
              (this.we = new f.default()),
              (this.de = new v.default()),
              (this.fe = new M.default()),
              (this.S = !0),
              (this.o = !1),
              (this.ee = () => {
                this.te += 1;
              });
            const s = new a.default();
            this.V = new l.default(new w.default());
            const i = new a.ve(n);
            (this.k = [s, i]),
              (this.T = new u.default()),
              (this.it = n),
              (this.Me = e);
            const o = new C.default(),
              c = new k();
            this.k.push(...t, this.V, this.T, o, c),
              (this._e = new b.default()),
              (this.me = new I(e)),
              (this.te = 0),
              this.T.gt(this.V);
          }
          update(t) {
            const e = this.be(t);
            if (!t.K) {
              if ((this.we.initialize(e), this.we.step(e), !this.me.Oe)) {
                this._e.step(e), this.Me.step(e);
                const n = this.me.pe(e);
                this.ge(e, t, n);
              }
              this.we.A(e);
            }
            this.fe.l(e);
          }
          init() {}
          A() {}
          ge(t, e, n) {
            const s = [
              "Great job!",
              "Awesome!",
              "Nice!",
              "Landed!",
              "Nailed it!",
            ];
            n !== R.je &&
              (n === R.ye &&
                (t.k.push(new j.default([s[y.default.Ce(0, s.length - 1)]])),
                setTimeout(() => {
                  e.zt(this.te);
                }, 2e3)),
              n === R.xe && this.k.push(new F()));
          }
          Gt() {
            this.A(), this.init();
          }
          be(t) {
            const e = this.k.filter(_.m),
              n = this.de._(e);
            return new d.default(
              n,
              t.Qt,
              t.K,
              this.k,
              x,
              t.P,
              this.T,
              this.it,
              this.V,
              this.te,
              this.ee,
              t.pause,
              t.Pt
            );
          }
        }),
          (function (t) {
            (t[(t.ye = 0)] = "WON"),
              (t[(t.xe = 1)] = "LOST"),
              (t[(t.je = 2)] = "PLAYING");
          })(R || (R = {}));
        class I {
          constructor(t) {
            (this.Oe = !1), (this.Me = t);
          }
          pe(t) {
            const { V: e } = t;
            return this.Me.Re()
              ? ((this.Oe = !0), R.ye)
              : e.Ie || e.Fe
              ? ((this.Oe = !0), R.xe)
              : R.je;
          }
        }
        class F extends h.default {
          l() {
            const t = new g.default((t) => {
              (t.P.font = "45px Comic Sans MS"),
                (t.P.fillStyle = "#FFF"),
                O.default.D(
                  t.P,
                  "Press [r] to restart level",
                  new w.default(p.$.w / 2, 20)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        class k extends h.default {
          l() {
            const t = new g.default((t) => {
              const e = t.P;
              (e.fillStyle = "#FFF"),
                (e.font = "15px Comic Sans MS"),
                O.default.D(
                  e,
                  "Press [m] to toggle menu",
                  new w.default(100, p.$.B - 30)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        e.Text = k;
      },
      3607: function (t, e, n) {
        var s =
            (this && this.ke) ||
            function (t, e, n, s) {
              return new (n || (n = Promise))(function (i, o) {
                function c(t) {
                  try {
                    h(s.next(t));
                  } catch (t) {
                    o(t);
                  }
                }
                function r(t) {
                  try {
                    h(s.Se(t));
                  } catch (t) {
                    o(t);
                  }
                }
                function h(t) {
                  var e;
                  t.done
                    ? i(t.value)
                    : ((e = t.value),
                      e instanceof n
                        ? e
                        : new n(function (t) {
                            t(e);
                          })).then(c, r);
                }
                h((s = s.apply(t, e || [])).next());
              });
            },
          i =
            (this && this.M) ||
            function (t) {
              return t && t.t ? t : { default: t };
            };
        Object.defineProperty(e, "t", { value: !0 });
        const o = i(n(6319));
        !(function () {
          s(this, void 0, void 0, function* () {
            const t = new o.default();
            (window.Ae = t), t.init();
            t.loop()();
          });
        })();
      },
      234: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.Text = e.Le = void 0);
        const i = s(n(1866)),
          o = s(n(977)),
          c = s(n(2854)),
          r = s(n(9878)),
          h = s(n(6364)),
          u = n(6353);
        e.default = function () {
          const t = new i.default([], new a());
          (t.V.Pe = !0), (t.V.o = !0), (t.V.position = new c.default(0, 0));
          const e = new l();
          return (t.k = [...t.k, e]), t;
        };
        class a {
          step(t) {}
          Re() {
            return !1;
          }
        }
        e.Le = a;
        class l extends o.default {
          l() {
            const t = new r.default((t) => {
              const e = t.P;
              (e.font = "45px Comic Sans MS"),
                (e.fillStyle = "#FFF"),
                h.default.D(
                  e,
                  "Thanks for playing!",
                  new c.default(u.$.w / 2, u.$.B / 2 + 40)
                ),
                (e.fillStyle = "#F00"),
                h.default.D(
                  e,
                  "By Luis Gurmendez",
                  new c.default(u.$.w / 2, u.$.B / 2 + 100)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        e.Text = l;
      },
      1743: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.Text = void 0);
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(977)),
          r = s(n(2854)),
          h = s(n(6256)),
          u = s(n(6096)),
          a = n(7322),
          l = s(n(6364)),
          w = n(6353),
          d = s(n(9878));
        class f extends c.default {
          l() {
            const t = new d.default((t) => {
              const e = t.P;
              (e.font = "25px Comic Sans MS"),
                (e.fillStyle = "#FFF"),
                l.default.D(
                  e,
                  "Press [w] to use your main thruster, rescue the astronauts",
                  new r.default(w.$.w / 2, w.$.B - 70)
                ),
                l.default.D(
                  e,
                  " and then let gravity pull you down and land",
                  new r.default(w.$.w / 2, w.$.B - 40)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        (e.Text = f),
          (e.default = function () {
            const t = new o.default(new r.default(0, 0), 4e3, 150);
            t.color = a.Te;
            const e = [
                t,
                ...u.default(
                  new r.default(0, -230),
                  new r.default(0, -250),
                  new r.default(0, -300)
                ),
                new f(),
              ],
              n = new i.default(e, new h.default(t));
            return (n.V.position = new r.default(0, -160)), (n.T.zoom = 1.6), n;
          });
      },
      1574: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.Text = void 0);
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(977)),
          r = s(n(2854)),
          h = s(n(6256)),
          u = s(n(6096)),
          a = n(7322),
          l = n(7549),
          w = s(n(6364)),
          d = n(6353),
          f = s(n(9878));
        class v extends c.default {
          l() {
            const t = new f.default((t) => {
              const e = t.P;
              (e.font = "25px Comic Sans MS"),
                (e.fillStyle = "#FFF"),
                w.default.D(
                  e,
                  "Press [w] and [a,s,d] to use your thrusters, ",
                  new r.default(d.$.w / 2, d.$.B - 70)
                ),
                w.default.D(
                  e,
                  " then land in the blue planet",
                  new r.default(d.$.w / 2, d.$.B - 40)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        (e.Text = v),
          (e.default = function () {
            const t = new o.default(new r.default(0, 0), 4500, 140);
            (t.Je = !1), (t.color = a.Te);
            const e = u.default(
                new r.default(0, -220),
                new r.default(-80, -200),
                new r.default(-130, -165)
              ),
              n = [
                t,
                l.ze(new r.default(0, 240), new r.default(60, 0)),
                new v(),
                ...e,
              ],
              s = new i.default(n, new h.default(t));
            return (
              (s.V.position = new r.default(0, -t.g.Ne - 10)),
              (s.T.zoom = 1.6),
              s
            );
          });
      },
      6630: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322);
        e.default = function () {
          const t = new o.default(new c.default(0, 0), 3e3, 100),
            e = new o.default(new c.default(400, -480), 6500, 175);
          e.color = u.Te;
          const n = [
              t,
              e,
              ...h.default(
                new c.default(0, -300),
                new c.default(100, -600),
                new c.default(800, -500)
              ),
            ],
            s = new i.default(n, new r.default(e));
          return (s.V.position = new c.default(0, -110)), (s.T.zoom = 0.6), s;
        };
      },
      1809: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322);
        e.default = function () {
          const t = new o.default(new c.default(0, -1e3), 3400, 110),
            e = new o.default(new c.default(0, 0), 3e3, 100),
            n = new o.default(new c.default(300, -580), 3200, 70),
            s = new o.default(new c.default(-150, -600), 3800, 120);
          n.color = u.Te;
          const a = [
              n,
              e,
              s,
              t,
              ...h.default(
                new c.default(20, -1120),
                new c.default(100, -600),
                new c.default(250, -800)
              ),
            ],
            l = new i.default(a, new r.default(n));
          return (l.V.position = new c.default(0, -110)), (l.T.zoom = 0.5), l;
        };
      },
      274: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322),
          a = n(7549);
        e.default = function () {
          const t = new o.default(new c.default(0, 100), 3e3, 100),
            e = new o.default(new c.default(0, -780), 6500, 175);
          e.color = u.Te;
          const n = [
              t,
              e,
              a.ze(new c.default(0, -430), new c.default(70, 0)),
              a.ze(new c.default(0, -1100), new c.default(70, 0)),
              ...h.default(
                new c.default(0, -300),
                new c.default(100, -600),
                new c.default(250, -800)
              ),
            ],
            s = new i.default(n, new r.default(e));
          return (s.V.position = new c.default(0, -10)), s;
        };
      },
      8152: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = s(n(5656)),
          a = n(7322);
        e.default = function () {
          const t = new o.default(new c.default(0, 100), 3e3, 100),
            e = new o.default(new c.default(0, 480), 2e3, 75);
          e.color = a.Te;
          const n = new o.default(new c.default(240, 0), 10500, 45);
          n.color = u.default.Xe();
          const s = new o.default(new c.default(-240, 0), 10500, 45);
          (s.color = u.default.Xe()), (s.Je = !1), (n.Je = !1);
          const l = [
              t,
              e,
              n,
              s,
              ...h.default(
                new c.default(0, -200),
                new c.default(150, 600),
                new c.default(-150, 600)
              ),
            ],
            w = new i.default(l, new r.default(e));
          return (w.V.position = new c.default(0, -10)), (w.T.zoom = 0.57), w;
        };
      },
      778: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322),
          a = n(7549);
        e.default = function () {
          const t = new o.default(new c.default(0, 0), 3e3, 100),
            e = new o.default(new c.default(0, -780), 2e3, 75);
          e.color = u.Te;
          const n = a.ze(new c.default(0, 150), new c.default(55, 0)),
            s = a.ze(new c.default(0, -150), new c.default(-55, 0)),
            l = [
              t,
              e,
              n,
              a.ze(new c.default(250, 0), new c.default(0, 60)),
              s,
              a.ze(new c.default(-250, 0), new c.default(0, -60)),
              a.ze(
                new c.default(300, 150),
                new c.default(-1, 1).normalize()._t(30)
              ),
              a.ze(
                new c.default(-300, -150),
                new c.default(1, -1).normalize()._t(30)
              ),
              ...h.default(
                new c.default(0, -200),
                new c.default(150, 0),
                new c.default(-150, 0)
              ),
            ],
            w = new i.default(l, new r.default(e));
          return (w.V.position = new c.default(0, -110)), w;
        };
      },
      8379: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322);
        e.default = function () {
          const t = new o.default(new c.default(0, 0), 3e3, 90),
            e = new o.default(new c.default(0, 680), 3e3, 120);
          e.color = u.Te;
          const n = h.default(
            new c.default(0, -200),
            new c.default(50, 820),
            new c.default(-50, 820)
          );
          (n[0].$e = new c.default(0, -20)),
            (n[1].$e = new c.default(5, 10)),
            (n[2].$e = new c.default(-5, 10));
          const s = [e, t, ...n],
            a = new i.default(s, new r.default(e));
          return (a.V.position = new c.default(0, -100)), a;
        };
      },
      4989: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = n(7322),
          a = s(n(5656));
        e.default = function () {
          const t = new o.default(new c.default(0, -2e3), 3e3, 100),
            e = new o.default(new c.default(0, 0), 2300, 90),
            n = new o.default(new c.default(-180, -900), 8e3, 100);
          (n.color = a.default.Xe()), (n.q = !0), (n.$e = new c.default(0, 60));
          const s = new o.default(new c.default(180, -900), 8e3, 100);
          (s.color = a.default.Xe()),
            (s.q = !0),
            (s.$e = new c.default(0, -60)),
            (t.color = u.Te);
          const l = [
              t,
              e,
              n,
              s,
              ...h.default(
                new c.default(0, -900),
                new c.default(-50, -2140),
                new c.default(250, -1800)
              ),
            ],
            w = new i.default(l, new r.default(t));
          return (w.V.position = new c.default(0, -100)), (w.T.zoom = 0.5), w;
        };
      },
      4782: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = s(n(6096)),
          u = s(n(5656)),
          a = n(7322),
          l = n(9327);
        e.default = function () {
          const t = new o.default(new c.default(0, -2900), 3e3, 100);
          t.color = a.Te;
          const e = new o.default(new c.default(0, 0), 3e3, 100),
            n = new o.default(new c.default(-400, -1e3), 12500, 90);
          n.color = u.default.Xe();
          const s = new o.default(new c.default(400, -1e3), 12500, 90);
          s.color = u.default.Xe();
          const w = new o.default(new c.default(0, -1800), 12500, 90);
          w.color = u.default.Xe();
          const d = [
              t,
              e,
              n,
              s,
              w,
              ...h.default(
                new c.default(0, -1e3),
                new c.default(-30, -1300),
                new c.default(30, -1300)
              ),
            ],
            f = new i.default(d, new r.default(t), new l.R(9e3, 9e3));
          return (f.V.position = new c.default(0, -110)), f;
        };
      },
      9010: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1743)),
          o = s(n(1574)),
          c = s(n(6630)),
          r = s(n(1809)),
          h = s(n(778)),
          u = s(n(8379)),
          a = s(n(4782)),
          l = s(n(4989)),
          w = s(n(274)),
          d = s(n(8152)),
          f = s(n(2131)),
          v = s(n(234));
        e.default = class {
          constructor() {
            (this.Ut = this.Be()),
              (this.Ee = [
                i.default,
                o.default,
                c.default,
                w.default,
                h.default,
                r.default,
                u.default,
                l.default,
                a.default,
                d.default,
                f.default,
                v.default,
              ]),
              (this.level = this.Ee[this.Ut]());
          }
          init() {
            this.Ut < this.Ee.length &&
              ((this.level = this.Ee[this.Ut]()), this.level.init());
          }
          next() {
            this.Ut++, this.init();
          }
          Gt() {
            this.init();
          }
          Wt() {
            return this.level;
          }
          Yt() {
            return this.Ee.length - 1;
          }
          Be() {
            const t = this.qt(),
              e = Object.keys(t).map((t) => parseInt(t));
            return e.length > 0 ? Math.max(...e) + 1 : 0;
          }
          qt() {
            const t = localStorage.getItem("savedLevels");
            return t ? JSON.parse(t) : {};
          }
          Nt(t) {
            const e = this.qt();
            (e[this.Ut] = Math.max(e[this.Ut] || 0, t)),
              localStorage.setItem("savedLevels", JSON.stringify(e));
          }
          Ht(t) {
            (this.Ut = t), this.init();
          }
        };
      },
      6256: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        e.default = class {
          constructor(t) {
            (this.Ke = !1), (this.target = t);
          }
          Re() {
            return this.Ke;
          }
          step(t) {
            const { V: e } = t;
            !e.Ie && e.Fe && e.Ge === this.target && (this.Ke = !0);
          }
        };
      },
      6096: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(5462));
        e.default = function (t, e, n) {
          return [new i.default(t), new i.default(e), new i.default(n)];
        };
      },
      7549: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.We = e.ze = void 0);
        const i = s(n(5462)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(5656));
        (e.ze = function (t, e = new c.default()) {
          const n = new o.default(t, 0, 5);
          return (
            (n.q = !0), (n.color = r.default.Xe()), (n.$e = e), (n.De = !1), n
          );
        }),
          (e.We = function (t, e, n) {
            return [new i.default(t), new i.default(e), new i.default(n)];
          });
      },
      7322: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.Te = void 0);
        const i = s(n(5656));
        e.Te = new i.default(0, 0, 255);
      },
      2131: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(1866)),
          o = s(n(8473)),
          c = s(n(2854)),
          r = s(n(6256)),
          h = n(9327),
          u = n(7322),
          a = s(n(5656)),
          l = s(n(6096));
        e.default = function () {
          const t = new o.default(new c.default(0, 0), 53e3, 1500);
          t.color = new a.default(200, 225, 25);
          const e = new o.default(new c.default(0, -7400), 16e3, 870);
          e.color = u.Te;
          const n = [
              t,
              e,
              ...l.default(
                new c.default(85, -1515),
                new c.default(270, -1510),
                new c.default(-1415, 1145)
              ),
            ],
            s = new i.default(n, new r.default(e), new h.R(2e4, 2e4));
          return (s.V.position = new c.default(0, -1510)), s;
        };
      },
      1991: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }),
          (e.Ve = e.Bt = e.Vt = void 0);
        const i = s(n(6111)),
          o = s(n(2949)),
          c = n(4939);
        function r(t, e) {
          const n = document.createElement("button");
          return (
            (n.innerText = t),
            (n.className = "m-i"),
            n.addEventListener("click", e),
            n
          );
        }
        function h(t) {
          const e = document.createElement("div");
          return (e.className = "m-t"), (e.innerText = t), e;
        }
        function u(t) {
          const e = document.createElement("div");
          return (e.innerText = t), (e.className = "c-i"), e;
        }
        (e.Vt = function (t, n, s, i, a) {
          const l = document.getElementById("mc");
          let w = 0,
            d = null;
          function f(t) {
            null !== d && d.remove(), (w = t), (d = p[w]), l.append(d);
          }
          function v() {
            f(0);
          }
          const M = Object.values(i).reduce((t, e) => t + e, 0),
            _ = (function (t, e, n, s) {
              const i = document.createElement("div");
              i.id = "m";
              const c = [
                  { label: "Resume game", Ye: t },
                  { label: "Objective", Ye: () => e(1) },
                  { label: "Controls", Ye: () => e(2) },
                  { label: "Levels", Ye: () => e(3) },
                ],
                u = h("Rescue Mission"),
                a = c.map((t) => r(t.label, t.Ye)),
                l = document.createElement("div"),
                w = document.createElement("span");
              (w.innerText = ` Rescued: ${n} / ${s}`), (w.className = "r");
              const d = o.default.Ue();
              return l.append(d), l.append(w), i.append(u, ...a, l), i;
            })(t, f, M, 3 * n),
            m = (function (t) {
              const n = document.createElement("div");
              n.id = "m";
              const s = h("Objective"),
                i = r("< Back", t),
                o = e.Ve.map(u),
                c = [s, ...o, i];
              return n.append(...c), n;
            })(v),
            b = (function (t) {
              const e = document.createElement("div");
              e.id = "m";
              const n = h("Controls"),
                s = [
                  "w,a,s,d - thrusters",
                  "a,d - pre launching inclination",
                  "p - toggle pause",
                  " mouse wheel or '.' or ',' - zoom in/out",
                  "'space' - camera follow rocket",
                  "click & drag to move camera",
                  "m - toggle menu",
                  "r - restart level",
                  "x - increase game speed",
                  "z - decrease game speed",
                ],
                i = r("< Back", t),
                o = s.map(u),
                c = [n, ...o, i];
              return e.append(...c), e;
            })(v),
            O = (function (t, e, n, s, i) {
              const u = document.createElement("div");
              u.id = "m";
              const a = h("Levels"),
                l = r("< Back", t),
                w = [];
              c.qe(e, (t) => {
                w.push({
                  name: `Level ${t + 1}`,
                  He: s[t] || 0,
                  Qe: n === t,
                  Ye: () => i(t),
                });
              });
              const d = w.map((t) =>
                  (function (t) {
                    const e = document.createElement("div"),
                      n = document.createElement("button");
                    (n.innerText = t.name),
                      (n.className = `m-i ${t.Qe ? "l-s" : ""} ${
                        3 === t.He ? "l-a" : ""
                      }`),
                      n.addEventListener("click", t.Ye);
                    const s = o.default.Ze(t.He);
                    s.forEach((t) => {
                      t.style.marginLeft = "4px";
                    });
                    const i = document.createElement("span");
                    return (
                      (i.innerText = "Rescued: "),
                      (i.className = "r"),
                      e.appendChild(n),
                      e.appendChild(i),
                      e.append(...s),
                      e
                    );
                  })(t)
                ),
                f = [a, ...d, l];
              return u.append(...f), u;
            })(v, n, s, i, (e) => {
              a(e), t();
            }),
            p = [_, m, b, O];
          f(0);
          const g = (function () {
            const t = document.createElement("div");
            return (t.id = "m-b"), (t.className = "f"), t;
          })();
          null == l || l.append(g);
        }),
          (e.Bt = function () {
            const t = document.getElementById("m"),
              e = document.getElementById("m-b");
            null == e || e.remove(), null == t || t.remove();
          }),
          (e.Ve = [
            "Use your thrusters and gravity to rescue",
            "as many astronauts as you can,",
            `remember to land slowly (less than ${i.default.wt} km/h) in the blue planet`,
          ]);
      },
      6137: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.tn = void 0);
        const i = s(n(2854)),
          o = n(4673);
        e.tn = function (t) {
          return class extends t {
            en(t) {
              const e = t.k.filter((t) => o.nn(t) && t.id !== this.id),
                n = new i.default();
              return (
                e.forEach((t) => {
                  const e = this.sn(t);
                  n.add(e);
                }),
                n
              );
            }
            sn(t) {
              const e = this.position.on(t.position);
              if (e < t.cn) {
                const n = new i.default(
                  t.position.x - this.position.x,
                  t.position.y - this.position.y
                ).normalize();
                return n._t(t.rn / e), n;
              }
              return new i.default();
            }
          };
        };
      },
      8725: (t, e, n) => {
        Object.defineProperty(e, "t", { value: !0 }), (e.m = e.hn = void 0);
        const s = n(9327);
        (e.hn = function () {
          return function (t) {
            return class extends t {
              constructor() {
                super(...arguments), (this.g = new s.un()), (this.ot = []);
              }
              get ht() {
                return void 0 !== this.ot && this.ot.length > 0;
              }
              p(t) {
                this.ot = t || [];
              }
            };
          };
        }),
          (e.m = function (t) {
            return "object" == typeof t && void 0 !== t.g;
          });
      },
      4673: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.nn = e.an = void 0),
          (e.an = function (t) {
            return class extends t {
              constructor() {
                super(...arguments), (this.cn = 0), (this.rn = 0);
              }
            };
          }),
          (e.nn = function (t) {
            return "object" == typeof t && void 0 !== t.cn;
          });
      },
      9528: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.ln = void 0);
        const i = s(n(2854));
        e.ln = function (t) {
          return class extends t {
            constructor() {
              super(...arguments),
                (this.$e = new i.default()),
                (this.acceleration = new i.default()),
                (this.angularAcceleration = 0),
                (this.angularVelocity = 0),
                (this.direction = new i.default());
            }
            get speed() {
              return this.$e.length();
            }
            wn() {
              return this.speed > 0;
            }
            dn(t) {
              const e = this.$e.clone(),
                n = this.acceleration.clone()._t(t);
              return e.add(n), e;
            }
            fn(t) {
              const e = this.position.clone(),
                n = this.acceleration.clone()._t(Math.pow(t, 2) / 2),
                s = this.$e.clone()._t(t).add(n);
              return e.add(s), e;
            }
            vn(t) {
              return this.angularVelocity + this.angularAcceleration * t;
            }
            Mn(t) {
              const e = this.direction.clone(),
                n = this.angularVelocity * t;
              return e.rotate(n), e;
            }
          };
        };
      },
      2037: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e._n = e.mn = void 0);
        const i = s(n(2854));
        (e.mn = function (t) {
          return class extends t {
            constructor() {
              super(...arguments), (this.position = new i.default());
            }
          };
        }),
          (e._n = function (t) {
            return "object" == typeof t && t.position instanceof i.default;
          });
      },
      5462: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9528),
          o = n(8725),
          c = n(2037),
          r = s(n(977)),
          h = n(9327),
          u = s(n(9878)),
          a = s(n(2949)),
          l = s(n(2854)),
          w = n(3704),
          d = s(n(9451)),
          f = i.ln(o.hn()(c.mn(r.default)));
        e.default = class extends f {
          constructor(t) {
            super(),
              (this.o = !1),
              (this.direction = new l.default(1, 0)),
              (this.g = new h.R(12, 12)),
              (this.angularVelocity = d.default.bn(d.default.Ce(45, 220))),
              (this.position = t),
              (this.type = w.rt.On);
          }
          step(t) {
            (this.angularVelocity = this.vn(t.Qt)),
              (this.direction = this.Mn(t.Qt)),
              (this.position = this.fn(t.Qt)),
              this.pn(t.ee);
          }
          pn(t) {
            void 0 !== this.ot.find((t) => t.type === w.rt.gn) && this.jn(t);
          }
          l() {
            return new u.default((t) => {
              a.default.yn(t, this);
            });
          }
          jn(t) {
            (this.o = !0), t();
          }
        };
      },
      2949: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(6364)),
          o = s(n(2854)),
          c = n(4939);
        class r {}
        (r.yn = (t, e) => {
          const n = t.P;
          (n.strokeStyle = "#FFF"),
            i.default.rotateSelf(
              n,
              e.position,
              e.direction.at(new o.default(1, 0))
            );
          const s = r.Ue();
          n.drawImage(
            s,
            e.position.x - e.g.w / 2,
            e.position.y - e.g.B / 2,
            e.g.w,
            e.g.B
          );
        }),
          (r.Ue = (t = "eee000222444888355ccc") =>
            i.default.Cn(
              t,
              "@@X[[C@@@@{II_@@@XKRRYC@@XQRJJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]{YLIIaK_[[LIIa[[@@LiMa@@@XOYKyC@@[O[[y[@XMiCXMiCX[[CX[[C",
              16
            )),
          (r.Ze = (t, e = 3) => {
            const n = [];
            return (
              c.qe(e, (e) => {
                e >= t ? n.push(r.Ue("ccc666ccccccccccccccc")) : n.push(r.Ue());
              }),
              n
            );
          }),
          (e.default = r);
      },
      3530: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(4939),
          o = s(n(977)),
          c = s(n(9878)),
          r = s(n(2949));
        class h extends o.default {
          l() {
            const t = new c.default((t) => {
              const { P: e, te: n } = t,
                s = r.default.Ue();
              i.qe(n, (t) => {
                e.drawImage(s, s.width * t + 20, 20);
              });
            });
            return (t.J = "overlay"), t;
          }
        }
        e.default = h;
      },
      977: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9878),
          o = n(3704),
          c = s(n(9451));
        e.default = class {
          constructor(t = c.default.xn()) {
            (this.type = o.rt.Rn), (this.id = t);
          }
          l() {
            return new i.In();
          }
          step(t) {}
        };
      },
      3704: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.rt = void 0),
          (function (t) {
            (t[(t.Rn = 0)] = "BASE_OBJECT"),
              (t[(t.ct = 1)] = "PLANET"),
              (t[(t.ut = 2)] = "ASTEROID"),
              (t[(t.gn = 3)] = "ROCKET"),
              (t[(t.On = 4)] = "ASTRONAUT"),
              (t[(t.Fn = 5)] = "BUTTON"),
              (t[(t.kn = 6)] = "PARTICLE");
          })(e.rt || (e.rt = {}));
      },
      6442: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(2854)),
          o = n(3704),
          c = n(9528),
          r = n(2037),
          h = s(n(977)),
          u = s(n(9878)),
          a = s(n(5656)),
          l = c.ln(r.mn(h.default));
        e.default = class extends l {
          constructor(t = 1) {
            super(),
              (this.o = !1),
              (this.Sn = !1),
              (this.position = new i.default()),
              (this.type = o.rt.kn),
              (this.$e = new i.default(0, 0)),
              (this.direction = new i.default(0, -1)),
              (this.An = t),
              (this.Ln = t),
              (this.color = new a.default(0, 0, 0)),
              (this.Sn = !0),
              (this.size = 1);
          }
          step(t) {
            (this.acceleration = this.Pn(t)),
              (this.position = this.fn(t.Qt)),
              (this.$e = this.dn(t.Qt)),
              (this.An -= t.Qt),
              this.An < 0 && (this.o = !0);
          }
          l() {
            return new u.default((t) => {
              const e = t.P;
              if (this.Sn) {
                let t = this.An / this.Ln;
                this.color.a = t;
              }
              (e.fillStyle = this.color.W()),
                e.beginPath(),
                e.arc(
                  this.position.x,
                  this.position.y,
                  this.size,
                  0,
                  2 * Math.PI
                ),
                e.fill();
            });
          }
          Pn(t) {
            return new i.default();
          }
        };
      },
      8473: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9327),
          o = n(3704),
          c = s(n(6364)),
          r = n(9528),
          h = n(8725),
          u = n(2037),
          a = s(n(977)),
          l = n(4673),
          w = s(n(9878)),
          d = s(n(5656)),
          f = s(n(9451)),
          v = n(6137).tn(l.an(r.ln(h.hn()(u.mn(a.default)))));
        e.default = class extends v {
          constructor(t, e, n, s = f.default.Tn(0.3), r = !1) {
            super(),
              (this.Je = !0),
              (this.De = !0),
              (this.Jn = (t) => {
                const e = t.P;
                (e.fillStyle = this.color.W()),
                  (e.strokeStyle = this.color.W()),
                  this.De &&
                    (e.save(),
                    e.beginPath(),
                    e.setLineDash([5, 15]),
                    e.arc(
                      this.position.x,
                      this.position.y,
                      this.cn,
                      0,
                      2 * Math.PI
                    ),
                    e.stroke(),
                    e.restore()),
                  c.default.zn(e, this.position, this.g),
                  e.fill(),
                  this.Je &&
                    !this.q &&
                    (c.default.rotateSelf(e, this.position, this.rotation),
                    e.beginPath(),
                    (e.strokeStyle = this.Nn.W()),
                    (e.lineWidth = 6),
                    e.moveTo(this.position.x - this.g.Ne, this.position.y),
                    e.bezierCurveTo(
                      this.position.x - 4 * this.g.Ne,
                      this.position.y + this.g.Ne / 2,
                      this.position.x + 4 * this.g.Ne,
                      this.position.y + this.g.Ne / 2,
                      this.position.x + this.g.Ne,
                      this.position.y
                    ),
                    e.stroke(),
                    (e.strokeStyle = "#8484FF"),
                    (e.lineWidth = 1),
                    e.stroke());
              }),
              (this.position = t),
              (this.rn = e),
              (this.type = o.rt.ct),
              (this.g = new i.j(n)),
              (this.cn = 5 * n),
              (this.q = r),
              (this.Je = s),
              (this.color = d.default.random(255, 255, 30)),
              (this.rotation = f.default.Xn(-Math.PI / 4, Math.PI / 4)),
              (this.Nn = d.default.random());
          }
          step(t) {
            this.q &&
              ((this.acceleration = this.Pn(t)),
              (this.position = this.fn(t.Qt)),
              (this.$e = this.dn(t.Qt)));
          }
          l() {
            return new w.default(this.Jn);
          }
          Pn(t) {
            return this.en(t);
          }
        };
      },
      9789: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9327),
          o = s(n(2854)),
          c = n(3704),
          r = s(n(2202)),
          h = n(9528),
          u = n(8725),
          a = n(2037),
          l = s(n(977)),
          w = n(6137),
          d = s(n(9878)),
          f = n(4363),
          v = s(n(5656)),
          M = s(n(2135)),
          _ = w.tn(h.ln(u.hn()(a.mn(l.default))));
        e.default = class extends _ {
          constructor(t) {
            super("rocket"),
              (this.Pe = !1),
              (this.Fe = !1),
              (this.Ie = !1),
              (this.Ge = null),
              (this.o = !1),
              (this.$n = (t, e, n = !1) => {
                const s = n ? f.Bn : f.En;
                if (t.length() > 0) {
                  const n = s(this.position.clone(), t.clone().normalize());
                  return f.Kn(n, e, this.direction, this.g), n;
                }
                return null;
              }),
              (this.position = t),
              (this.type = c.rt.gn),
              (this.g = new i.R(13, 16)),
              (this.direction = new o.default(0, -1)),
              (this.Gn = new r.default(16.5, 40)),
              (this.Wn = new r.default(5, 30));
          }
          step(t) {
            this.Fe ||
              ((this.angularAcceleration = this.Dn(t)),
              (this.angularVelocity = this.vn(t.Qt)),
              (this.direction = this.Mn(t.Qt)),
              (this.acceleration = this.Pn(t)),
              (this.position = this.fn(t.Qt)),
              (this.$e = this.dn(t.Qt)),
              (this.direction = this.Vn(t)));
          }
          l() {
            const t = new d.default(M.default.Yn),
              e = this.Gn.l(),
              n = this.Wn.l({
                color: new v.default(255, 255, 255),
                offset: new o.default(45, 0),
              }),
              s = new d.default(M.default.Un);
            if (((s.J = "overlay"), (t.children = [n, e, s]), !this.Pe)) {
              const e = new d.default(M.default.qn);
              t.children.push(e);
            }
            return t;
          }
          Vn(t) {
            const e = this.direction.clone();
            return (
              this.Pe ||
                (t.Zt.ie("a") && e.rotate(-0.5).normalize(),
                t.Zt.ie("d") && e.rotate(0.5).normalize()),
              e
            );
          }
          Dn(t) {
            const e = t.Zt.ie;
            let n = 0;
            if (e("d") && this.Pe) {
              const e = this.direction.clone().rotate(90)._t(this.Wn.Hn(t.Qt)),
                s = this.$n(e, "top-left");
              s && t.k.push(s), (n = 5 * e.length());
            }
            if (e("a") && this.Pe) {
              const e = this.direction.clone().rotate(-90)._t(this.Wn.Hn(t.Qt)),
                s = this.$n(e, "top-right");
              s && t.k.push(s), (n = -5 * e.length());
            }
            return n;
          }
          Pn(t) {
            const e = this.Qn(t),
              n = this.Pe ? this.en(t) : new o.default();
            return e.clone().add(n);
          }
          H(t) {
            (this.o = !0),
              t.k.push(...f.Zn(this.position.clone())),
              (this.Ie = !0);
          }
          et(t) {
            (this.Fe = !0), this.ts(), (this.Ge = t);
          }
          ts() {
            (this.acceleration = new o.default()),
              (this.$e = new o.default()),
              (this.angularVelocity = 0),
              (this.angularAcceleration = 0);
          }
          Qn(t) {
            let e = new o.default(),
              n = new o.default();
            const s = t.Zt.ie;
            if (s("w")) {
              (this.Pe = !0), (e = this.direction.clone()._t(this.Gn.Hn(t.Qt)));
              const n = this.$n(e, "bottom", !0);
              n && t.k.push(n);
            }
            if (s("s")) {
              n = this.direction.clone()._t(-this.Wn.Hn(t.Qt));
              const e = this.$n(n, "top");
              e && t.k.push(e);
            }
            return e.add(n);
          }
        };
      },
      4363: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }),
          (e.Kn = e.Zn = e.En = e.Bn = void 0);
        const i = s(n(5656)),
          o = s(n(6442)),
          c = s(n(2854)),
          r = s(n(9451)),
          h = n(4939);
        function u(t, e) {
          const n = r.default.Tn(0.3),
            s = n ? 0.4 : r.default.Xn(0.7, 1.8),
            c = new o.default(s);
          (c.position = t),
            (c.color = n
              ? new i.default(20, r.default.Ce(0, 255), 255)
              : new i.default(255, r.default.Ce(0, 255), 12)),
            (c.Sn = !0);
          const h = r.default.Xn(-45, 45);
          return (
            (c.$e = e.clone()._t(-1).rotate(h)._t(r.default.es(10, 20))),
            (c.direction = c.$e.clone().normalize()),
            (c.size = r.default.Xn(1, 4)),
            c
          );
        }
        (e.Bn = u),
          (e.En = function (t, e) {
            const n = u(t, e);
            return (
              (n.color = new i.default(255, r.default.Ce(200, 255), 255)),
              (n.size = r.default.Xn(1, 2)),
              n.$e._t(2),
              n
            );
          }),
          (e.Zn = function (t) {
            return h.qe(50, () => {
              const e = r.default.Xn(0.5, 1.3),
                n = new o.default(e);
              (n.position = t),
                (n.color = new i.default(255, r.default.Ce(0, 255), 12)),
                (n.Sn = !0);
              const s = r.default.Xn(0, 360);
              return (
                (n.$e = new c.default(1, 0).rotate(s)._t(r.default.es(10, 20))),
                (n.direction = n.$e.clone().normalize()),
                (n.size = r.default.Xn(1, 3)),
                n
              );
            });
          }),
          (e.Kn = function (t, e, n, s) {
            let i = new c.default();
            if ("bottom" === e) {
              const t = n.at(new c.default(1, 0));
              i = new c.default(Math.cos(t), Math.sin(t))._t(s.B / 2);
            }
            if (e.includes("top")) {
              const t = n.at(new c.default(1, 0));
              i = new c.default(Math.cos(t), Math.sin(t))
                ._t(s.B / 2 - 3)
                ._t(-1);
            }
            if ("top-right" === e) {
              const t = n.at(new c.default(0, 1)),
                e = new c.default(Math.cos(t), Math.sin(t))._t(s.w / 2 - 2);
              i.add(e);
            }
            if ("top-left" === e) {
              const t = n.at(new c.default(0, 1)),
                e = new c.default(Math.cos(t), Math.sin(t))
                  ._t(s.w / 2 - 2)
                  ._t(-1);
              i.add(e);
            }
            t.position.sub(i);
          });
      },
      2135: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(2854)),
          o = s(n(6364)),
          c = n(6353);
        class r {
          static Un(t) {
            const {
              V: e,
              P: n,
              P: { canvas: s },
            } = t;
            (n.font = "15px Comic Sans MS"), (n.fillStyle = "#FFF");
            const i = `speed: ${e.speed.toFixed(0)} km/h`,
              o = n.measureText(i).width;
            n.fillText(i, c.$.w - (o + 20), c.$.B - 20);
          }
        }
        (r.qn = (t) => {
          const { P: e, V: n } = t;
          (e.strokeStyle = "#FFF"),
            e.save(),
            e.beginPath(),
            e.setLineDash([5, 15]),
            e.moveTo(n.position.x, n.position.y);
          const s = n.direction.clone()._t(1e3).add(n.position);
          e.lineTo(s.x, s.y),
            e.stroke(),
            e.restore(),
            (e.font = "7px Comic Sans MS"),
            (e.fillStyle = "#FFF"),
            e.fillText(
              `${(
                (180 * n.direction.at(new i.default(0, -1))) /
                Math.PI
              ).toFixed(2)}º`,
              n.position.x + 10,
              n.position.y
            );
        }),
          (r.Yn = (t) => {
            const { V: e } = t,
              n = t.P;
            (n.strokeStyle = "#FFF"),
              e.ht && (n.strokeStyle = "#F00"),
              o.default.rotateSelf(
                n,
                e.position,
                e.direction.at(new i.default(0, -1))
              );
            const s = o.default.Cn(
              "eeeccd34722449c89b568",
              "@@@JI@@@@@PJIA@@@@R|OI@@@@b|I@@@@b|I@@@@b|I@@@@b|I@@@@RJII@@@@RJiI@@@@RJII@@@@RJIy@@@XRJIyF@@[RJIyw@@[RJIyw@@[RJIyw@@[`ddxw@",
              16
            );
            n.translate(-1, -1),
              n.drawImage(
                s,
                e.position.x - e.g.w / 2,
                e.position.y - e.g.B / 2
              );
          }),
          (e.default = r);
      },
      2202: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(9327),
          o = s(n(2854)),
          c = s(n(9878)),
          r = {
            color: new (s(n(5656)).default)(255, 10, 20),
            offset: new o.default(),
          };
        e.default = class {
          constructor(t, e) {
            (this.ns = t), (this.ss = e), (this.os = t);
          }
          l(t) {
            const e = new c.default((e) => {
              const n = Object.assign(Object.assign({}, r), t),
                s = n.color.W(),
                { P: c } = e,
                h = this.ns / this.os;
              c.translate(n.offset.x, n.offset.y);
              const u = 0.5 * c.canvas.height,
                a = new o.default(25, 0.25 * c.canvas.height),
                l = new i.R(20, u),
                w = u * h,
                d = a.clone().add(new o.default(0, u - w)),
                f = new i.R(20, w);
              (c.strokeStyle = s),
                (c.fillStyle = s),
                c.beginPath(),
                c.rect(a.x, a.y, l.w, l.B),
                c.stroke(),
                c.beginPath(),
                c.rect(d.x, d.y, f.w, f.B),
                c.fill();
            });
            return (e.J = "overlay"), e;
          }
          Hn(t) {
            return this.cs() ? 0 : ((this.ns -= t), this.ss);
          }
          cs() {
            return this.ns < 0;
          }
        };
      },
      9327: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.un = e.j = e.R = void 0);
        e.R = class {
          constructor(t, e) {
            (this.w = t), (this.B = e);
          }
        };
        e.j = class {
          constructor(t) {
            this.Ne = t;
          }
        };
        e.un = class {};
      },
      2164: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.ve = void 0);
        const i = s(n(2854)),
          o = s(n(6364)),
          c = n(2037),
          r = s(n(9878)),
          h = s(n(977)),
          u = n(9327),
          a = s(n(9451)),
          l = n(4939),
          w = s(n(3910)),
          d = s(n(5656)),
          f = c.mn(h.default);
        e.default = class extends f {
          constructor() {
            super(), (this.id = "background");
          }
          l() {
            const t = new r.default((t) => {
              const { P: e } = t;
              (e.fillStyle = "#000"),
                o.default.rs(e, new i.default(0, 0), new u.R(t.it.w, t.it.B)),
                e.fill();
            });
            return (t.J = "overlay"), t;
          }
          step() {}
        };
        class v extends f {
          constructor(t) {
            super(),
              (this.hs = a.default.Xn(0.01, 15)),
              (this.position = t),
              (this.shape = new u.j(a.default.Xn(0.5, 1.5)));
          }
        }
        e.ve = class extends f {
          constructor(t) {
            super(),
              (this.us = []),
              l.qe(5e4, () => {
                const e = new i.default(
                  a.default.Xn(-t.w, t.w),
                  a.default.Xn(-t.B, t.B)
                );
                this.us.push(new v(e));
              });
          }
          l() {
            return new r.default((t) => {
              const { P: e, T: n } = t,
                s = new u.R(n.viewport.w / n.zoom, n.viewport.B / n.zoom);
              e.fillStyle = "#FFF";
              this.us
                .filter(
                  (t) =>
                    w.default.st(t.position, s, n.position) && t.hs < n.zoom
                )
                .forEach((t) => {
                  const s = t.position.clone();
                  (e.fillStyle = new d.default(
                    255,
                    255,
                    255,
                    1 - t.hs / n.zoom
                  ).W()),
                    e.beginPath(),
                    e.arc(s.x, s.y, t.shape.Ne, 0, 2 * Math.PI),
                    e.fill();
                });
            });
          }
        };
      },
      6271: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = n(6353),
          o = s(n(2854)),
          c = s(n(9878)),
          r = s(n(6364)),
          h = s(n(977));
        class u extends h.default {
          constructor(t) {
            super(),
              (this.ls = 0),
              (this.o = !1),
              (this.ws = t.map((t) =>
                "object" == typeof t ? t : { text: t, duration: 4 }
              )),
              (this.ds = this.ws[this.ls]);
          }
          step(t) {
            this.ds.duration < 0
              ? (this.ls++,
                this.ls > this.ws.length - 1
                  ? (this.o = !0)
                  : (this.ds = this.ws[this.ls]))
              : (this.ds.duration -= t.Qt);
          }
          l() {
            const t = new c.default((t) => {
              const { P: e } = t;
              (e.font = "35px Comic Sans MS"),
                (e.fillStyle = "#FFF"),
                r.default.D(
                  e,
                  this.ds.text,
                  new o.default(i.$.w / 2, i.$.B - 80)
                );
            });
            return (t.J = "overlay"), t;
          }
        }
        e.default = u;
      },
      2854: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        class n {
          constructor(t = 0, e = 0) {
            (this.x = t), (this.y = e);
          }
          clone() {
            return new n(this.x, this.y);
          }
          on(t) {
            return Math.sqrt(
              Math.pow(this.x - t.x, 2) + Math.pow(this.y - t.y, 2)
            );
          }
          fs() {
            return Math.pow(this.x, 2) + Math.pow(this.y, 2);
          }
          length() {
            return Math.sqrt(this.fs());
          }
          normalize() {
            const t = this.length();
            return (this.x /= t), (this.y /= t), this;
          }
          _t(t) {
            return (this.x *= t), (this.y *= t), this;
          }
          add(t) {
            return this.set(this.x + t.x, this.y + t.y), this;
          }
          sub(t) {
            return this.set(this.x - t.x, this.y - t.y), this;
          }
          set(t, e) {
            return (this.x = t), (this.y = e), this;
          }
          at(t) {
            return Math.atan2(this.y, this.x) - Math.atan2(t.y, t.x);
          }
          rotate(t, e = !0) {
            let n = t * (Math.PI / 180);
            e || (n = t);
            const s = Math.round(1e3 * Math.cos(n)) / 1e3,
              i = Math.round(1e3 * Math.sin(n)) / 1e3,
              o = this.clone();
            return (
              (this.x = o.x * s - o.y * i), (this.y = o.x * i + o.y * s), this
            );
          }
        }
        e.default = n;
      },
      9878: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 }), (e.In = void 0);
        const i = s(n(9451));
        class o {
          constructor(t) {
            (this.J = "normal"),
              (this.children = []),
              (this.id = i.default.xn()),
              (this.zIndex = 1),
              (this.Jn = t);
          }
          l(t) {
            this.Jn(t);
          }
        }
        e.default = o;
        e.In = class extends o {
          constructor() {
            super(() => {});
          }
        };
      },
      6364: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        e.default = class {
          static zn(t, e, n) {
            t.beginPath(), t.arc(e.x, e.y, n.Ne, 0, 2 * Math.PI), t.stroke();
          }
          static rs(t, e, n) {
            t.beginPath(),
              t.rect(e.x - n.w / 2, e.y - n.B / 2, n.w, n.B),
              t.stroke();
          }
          static D(t, e, n) {
            const s = t.measureText(e).width,
              i = t.measureText("M").width;
            t.fillText(e, n.x - s / 2, n.y + i);
          }
          static Cn(t, e, n = 16) {
            const s = document.createElement("canvas");
            (s.width = n), (s.height = n);
            const i = s.getContext("2d");
            if (null !== i) {
              const s = [];
              e.replace(/./g, (t) => {
                const e = t.charCodeAt(0);
                return s.push(7 & e), s.push((e >> 3) & 7), "";
              });
              for (let e = 0; e < n; e++)
                for (let o = 0; o < n; o++)
                  s[e * n + o] &&
                    ((i.fillStyle = "#" + t.substr(3 * (s[e * n + o] - 1), 3)),
                    i.fillRect(o, e, 1, 1));
            }
            return s;
          }
          static rotateSelf(t, e, n) {
            t.translate(e.x, e.y), t.rotate(n), t.translate(-e.x, -e.y);
          }
        };
      },
      5656: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(9451));
        class o {
          constructor(t, e, n, s = 1) {
            (this.a = 1),
              (this.r = t),
              (this.Ae = e),
              (this.b = n),
              (this.a = s);
          }
          clone() {
            return new o(this.r, this.Ae, this.b, this.a);
          }
          static random(t = 255, e = 255, n = 255) {
            function s(t) {
              return Array.isArray(t)
                ? i.default.Ce(t[0], t[1])
                : i.default.Ce(0, t);
            }
            return new o(s(t), s(e), s(n));
          }
          static Xe() {
            return new o(255, 255, 255);
          }
          static vs() {
            return new o(0, 0, 0);
          }
          W() {
            return `rgba(${this.r},${this.Ae},${this.b},${this.a})`;
          }
        }
        e.default = o;
      },
      4939: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 }),
          (e.L = e.qe = e.Ms = void 0),
          (e.Ms = function () {}),
          (e.qe = function (t, e) {
            return [...Array(t)].map((t, n) => e(n));
          }),
          (e.L = function (t, e) {
            let n = 0;
            const s = [];
            for (let i of t) e(i) ? (t[n++] = i) : s.push(i);
            return t.splice(n), s;
          });
      },
      3910: function (t, e, n) {
        var s =
          (this && this.M) ||
          function (t) {
            return t && t.t ? t : { default: t };
          };
        Object.defineProperty(e, "t", { value: !0 });
        const i = s(n(2854));
        e.default = class {
          static I(t, e, n, s) {
            const { x: i, y: o } = n,
              { x: c, y: r } = s,
              h = e.Ne,
              u = i - t.w / 2,
              a = i + t.w / 2,
              l = o - t.B / 2,
              w = o + t.B / 2;
            let d = Math.max(u, Math.min(c, a)) - c,
              f = Math.max(l, Math.min(r, w)) - r;
            return d * d + f * f <= h * h;
          }
          static F(t, e, n, s) {
            const o = new i.default(n.x - t.w / 2, n.y + t.B / 2),
              c = new i.default(n.x + t.w / 2, n.y - t.B / 2),
              r = new i.default(s.x - e.w / 2, s.y + e.B / 2),
              h = new i.default(s.x + e.w / 2, s.y - e.B / 2);
            return (
              o.x != c.x &&
              o.y != c.y &&
              r.x != h.x &&
              r.y != h.y &&
              !(o.x >= h.x || r.x >= c.x) &&
              !(c.y >= r.y || h.y >= o.y)
            );
          }
          static C(t, e, n, s) {
            return n.on(s) <= t.Ne + e.Ne;
          }
          static st(t, e, n) {
            const s = n.x - e.w / 2,
              i = n.x + e.w / 2,
              o = n.y - e.B / 2,
              c = n.y + e.B / 2;
            return t.x > s && t.x < i && t.y > o && t.y < c;
          }
        };
      },
      9451: (t, e) => {
        Object.defineProperty(e, "t", { value: !0 });
        class n {
          static es(t, e) {
            return t + Math.random() * e;
          }
          static Xn(t, e) {
            return Math.random() * (e - t) + t;
          }
          static Ce(t, e) {
            return Math.floor(n.Xn(t, e + 1));
          }
          static _s(t) {
            let e = t.length - 1;
            return t[n.Ce(0, e)];
          }
          static Tn(t = 0.5) {
            return Math.random() < t;
          }
          static xn() {
            return Math.round(1e4 * Math.random()).toString(16);
          }
          static bn(t, e = 0.5) {
            return (Math.random() > e ? -1 : 1) * t;
          }
        }
        e.default = n;
      },
    },
    e = {};
  (function n(s) {
    var i = e[s];
    if (void 0 !== i) return i.exports;
    var o = (e[s] = { exports: {} });
    return t[s].call(o.exports, o, o.exports, n), o.exports;
  })(3607);
})();
