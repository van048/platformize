"use strict";

var three = require("../../chunks/three.js");

function _optionalChain(ops) {
  let lastAccessLHS = undefined;
  let value = ops[0];
  let i = 1;
  while (i < ops.length) {
    const op = ops[i];
    const fn = ops[i + 1];
    i += 2;
    if ((op === "optionalAccess" || op === "optionalCall") && value == null) {
      return undefined;
    }
    if (op === "access" || op === "optionalAccess") {
      lastAccessLHS = value;
      value = fn(value);
    } else if (op === "call" || op === "optionalCall") {
      value = fn((...args) => value.call(lastAccessLHS, ...args));
      lastAccessLHS = undefined;
    }
  }
  return value;
} // index.ts

console.log("THREE Version", three.REVISION);

const getNode = (id, self) =>
  new Promise((r) =>
    wx
      .createSelectorQuery()
      .in(self)
      .select(id)
      .fields({ node: true, size: true })
      .exec(r)
  );

var threeBehavior = require("three-behavior");
// @ts-ignore
Component({
  disposing: false,
  switchingItem: false,
  deps: {},
  currDemo: null,
  platform: null,

  behaviors: [threeBehavior],
  data: {
    showCanvas: false,
    currItem: -1,
    menuList: [
      "GLTFLoader",
      "ThreeSpritePlayer",
      "DeviceOrientationControls",
      "RGBELoader",
      "SVGLoader",
      "OBJLoader",
      "MeshOpt",
      "EXRLoader",
      "HDRPrefilterTexture",
      "MTLLoader",
      "LWOLoader",
      "FBXLoader",
      "BVHLoader",
      "ColladaLoader",
      "MeshQuantization",
      "TTFLoader",
      "STLLoader",
      "PDBLoader",
      "TGALoader",
      "VTKLoader",
      "VSMShadow",
      "MemoryTest",
    ],
  },

  attached() {
    this.onReady();
  },
  detached() {
    this.onUnload();
  },

  methods: {
    onReady() {
      this.onCanvasReady();
    },

    onCanvasReady() {
      console.log("onCanvasReady");
      Promise.all([getNode("#gl", this)]).then(
        ([glRes]) => {
          // @ts-ignore
          this.initCanvas(glRes[0].node);
        }
      );
    },

    initCanvas(canvas) {
      console.log(canvas.width, canvas.height);

      console.log("canvas inited");

      this.setData({ showCanvas: true });

      this.threeMounted(canvas);
    },

    async onMenuItemClick(e) {
      const { i, item } = e.currentTarget.dataset;
      wx.showLoading({ mask: false, title: "加载中" });
      if (this.switchingItem || !DEMO_MAP[item]) return;

      _optionalChain([
        this.currDemo,
        "optionalAccess",
        (_3) => _3.dispose,
        "call",
        (_4) => _4(),
      ]);
      this.switchingItem = true;
      this.currDemo = null;

      const demo = new DEMO_MAP[item](this.deps);
      await demo.init();
      this.currDemo = demo;
      this.setData({ currItem: i });
      this.onMenuClick();
      this.switchingItem = false;
      wx.hideLoading();
    },

    onTX(e) {
      // console.error(e)
      if(e.touches[0]) {
        e.touches[0].clientX = e.touches[0].x
        e.touches[0].clientY = e.touches[0].y
      }
      this.platform.dispatchTouchEvent(e);
      if (e.type == 'touchstart') this.onTouchStart(e)
      else if (e.type == 'touchmove') this.onTouchMove(e)
      else if (e.type == 'touchend') this.onTouchEnd(e)
    },

    onUnload() {
      this.disposing = true;
      _optionalChain([
        this.currDemo,
        "optionalAccess",
        (_5) => _5.dispose,
        "call",
        (_6) => _6(),
      ]);
      three.PlatformManager.dispose();
    },

    onShareAppMessage() {},
  },
});
