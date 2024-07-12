var THREE = require("../../chunks/three.js");
var three = THREE;
var screenshot = require("../../chunks/screenshot.js");
var window, requestAnimationFrame;
var GLTFLoader = screenshot.GLTFLoader;
var performance = Date;
// @ts-nocheck
// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2020, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)
var MeshoptDecoder = (function (path1) {
  var setWasmPath = function setWasmPath(path) {
    WXWebAssembly.instantiate(path, {}).then(function (result) {
      instance = result.instance;
      instance.exports.__wasm_call_ctors();
      readyResolve();
    });
  };
  var decode = function decode(fun, target, count, size, source, filter) {
    var sbrk = instance.exports.sbrk;
    var count4 = (count + 3) & ~3; // pad for SIMD filter
    var tp = sbrk(count4 * size);
    var sp = sbrk(source.length);
    var heap = new Uint8Array(instance.exports.memory.buffer);
    heap.set(source, sp);
    var res = fun(tp, count, size, sp, source.length);
    if (res == 0 && filter) {
      filter(tp, count4, size);
    }
    target.set(heap.subarray(tp, tp + count * size));
    sbrk(tp - sbrk(0));
    if (res != 0) {
      throw new Error("Malformed buffer data: " + res);
    }
  };
  // Built with clang version 11.0.0 (https://github.com/llvm/llvm-project.git 0160ad802e899c2922bc9b29564080c22eb0908c)
  // Built from meshoptimizer 0.14
  if (typeof WXWebAssembly !== "object") {
    // This module requires WebAssembly to function
    return {
      supported: false,
    };
  }
  var instance;
  var readyResolve;
  var promise = new Promise(function (resovle) {
    readyResolve = resovle;
  });
  var filters = {
    // legacy index-based enums for glTF
    0: "",
    1: "meshopt_decodeFilterOct",
    2: "meshopt_decodeFilterQuat",
    3: "meshopt_decodeFilterExp",
    // string-based enums for glTF
    NONE: "",
    OCTAHEDRAL: "meshopt_decodeFilterOct",
    QUATERNION: "meshopt_decodeFilterQuat",
    EXPONENTIAL: "meshopt_decodeFilterExp",
  };
  var decoders = {
    // legacy index-based enums for glTF
    0: "meshopt_decodeVertexBuffer",
    1: "meshopt_decodeIndexBuffer",
    2: "meshopt_decodeIndexSequence",
    // string-based enums for glTF
    ATTRIBUTES: "meshopt_decodeVertexBuffer",
    TRIANGLES: "meshopt_decodeIndexBuffer",
    INDICES: "meshopt_decodeIndexSequence",
  };
  return {
    setWasmPath: setWasmPath,
    ready: promise,
    supported: true,
    decodeVertexBuffer: function decodeVertexBuffer(
      target,
      count,
      size,
      source,
      filter
    ) {
      decode(
        instance.exports.meshopt_decodeVertexBuffer,
        target,
        count,
        size,
        source,
        instance.exports[filters[filter]]
      );
    },
    decodeIndexBuffer: function decodeIndexBuffer(target, count, size, source) {
      decode(
        instance.exports.meshopt_decodeIndexBuffer,
        target,
        count,
        size,
        source
      );
    },
    decodeIndexSequence: function decodeIndexSequence(
      target,
      count,
      size,
      source
    ) {
      decode(
        instance.exports.meshopt_decodeIndexSequence,
        target,
        count,
        size,
        source
      );
    },
    decodeGltfBuffer: function decodeGltfBuffer(
      target,
      count,
      size,
      source,
      mode,
      filter
    ) {
      decode(
        instance.exports[decoders[mode]],
        target,
        count,
        size,
        source,
        instance.exports[filters[filter]]
      );
    },
  };
})();
var localStorage = {
  getItem: function (key) {
    return wx.getStorageSync(key);
  },
  setItem: function (key, value) {
    return wx.setStorageSync(key, value);
  },
};

let cameraInitPos;
let cameraInitPosOn = new THREE.Vector3(0, 0.6, 3.6);
let cameraInitTargetOn = new THREE.Vector3(0, 0.23568405126528758, 0);
let cameraInitTargetOff = new THREE.Vector3(
  -0.0962711995010399,
  0.23568405126528758,
  0
);
let cameraInitTarget;
let cameraAnimForwardHome = {
  startPos: null,
  endPos: null,
  startTarget: null,
  endTarget: null,
  startLight: null,
  endLight: null,
};
let cameraInitPosOff = new THREE.Vector3(2.45431651, 0.578276529, 2.92998338);

let light;

const fanLeafGroupMatrix = new THREE.Matrix4();
const upDownGroupMatrix = new THREE.Matrix4();
const lrGroupMatrix = new THREE.Matrix4();
let fanLeafRotation = 0;
const fanLeafRotateSpeed = 0.5; // 1档的时候1s转圈数
let udDeg = 0;
const upDownSpeed = 0.01;
let udDirectionFlag = 1;
let lrDeg = 0;
const calMatrix = new THREE.Matrix4();
const calMatrix_1 = new THREE.Matrix4();
const calVector = new THREE.Vector3();
const calVector_1 = new THREE.Vector3();
const calQuaternion = new THREE.Quaternion();
const lrSpeed = 0.01;
let lrDirectionFlag = 1;
// 头部拖动中标志
let draggingHead;
let draggingSphere;
const touch = new THREE.Vector2();
let draggingSwingShape;
const raycaster = new THREE.Raycaster();
// 送风范围
let calVectorSwingRange = new THREE.Vector3(); // 避免重复new
function threeConversionTwo(model, camera) {
  // 这里判断model是因为model可能是被选中的mesh的position，也可能是点击到了环境贴图
  if (model !== undefined) {
    // 世界坐标转标准设备坐标
    const worldVectorsss = new THREE.Vector3(model.x, model.y, model.z);
    const ndc = worldVectorsss.project(camera);

    // 将规范化设备坐标转换为屏幕坐标
    const screenPosition = {
      x: ((ndc.x + 1) / 2) * window.innerWidth,
      y: ((1 - ndc.y) / 2) * window.innerHeight,
    };

    return screenPosition;
  }
  return;
}
function findPointOnCircleWithGivenX(circleCenter, pointP, x) {
  const { x: a, y: b } = circleCenter; // 圆心坐标
  const { x: x0, y: y0 } = pointP; // 已知圆上的点P的坐标

  // 计算半径r
  const r = Math.sqrt((x0 - a) ** 2 + (y0 - b) ** 2);

  // 计算y值
  const ySquared = r ** 2 - (x - a) ** 2;
  if (ySquared < 0) {
    // 如果ySquared小于0，说明x不在圆的范围内
    return null;
  }

  const y1 = b + Math.sqrt(ySquared);
  const y2 = b - Math.sqrt(ySquared);

  // 检查y值是否大于圆心的y坐标
  if (y1 > b) {
    return { x, y: y1 };
  } else if (y2 > b) {
    return { x, y: y2 };
  } else {
    // 如果没有y值大于圆心的y坐标，返回null
    return null;
  }
}
function getAngleBAC(ax, ay, bx, by, cx, cy) {
  let x1 = bx - ax;
  let y1 = by - ay;
  let x2 = cx - ax;
  let y2 = cy - ay;
  let dotProduct = x1 * x2 + y1 * y2;
  let modAB = Math.sqrt(x1 * x1 + y1 * y1);
  let modAC = Math.sqrt(x2 * x2 + y2 * y2);
  let cosTheta = Math.max(-1, Math.min(1, dotProduct / (modAB * modAC)));
  let angleBAC = (Math.acos(cosTheta) * 180) / Math.PI;
  return angleBAC;
}

// 本地保存自定义外观的key
let customColorKey = "GDG24FG_customColor";

// transform
let cameraAnimUd = {
  endPos: null,
  endTarget: null,
  endLight: new THREE.Vector3(0, 0.6, 4).add(new THREE.Vector3(2.93, 0, -1.49)),
};
let normalAnimDuration = ((1000 / 24) * 20) / 1.5;
let sphereRight; // 扇形的最右端的一个点
// 上下
// 转到侧面时摄像机的matrix
let cameraCeMianMatrix = new THREE.Matrix4().fromArray([
  0.011272813674444363, -4.336809383831408e-20, -0.09936260298453094, 0,
  0.0004622545581642977, 0.09999892684632541, 0.000052443367502761376, 0,
  0.0993615128243416, -0.0004652198928570993, 0.011272689994384459, 0, 2.956797,
  0.5861559999999999, 0.43545237999999986, 1,
]);
// 作为scene的子对象时，转到侧面时扇形的matrix
let swingRangeShapeCeMianMatrix = new THREE.Matrix4().fromArray([
  2.220446049250313e-16, 0, 1, 0, 0, 1, 0, 0, -1, 0, 2.220446049250313e-16, 0,
  -3.1086244689504386e-17, 0.8835, 0.21000000000000005, 1,
]);
// 作为camera的子对象时，扇形的matrix
let newMUd = swingRangeShapeCeMianMatrix
  .clone()
  .premultiply(cameraCeMianMatrix.clone().invert());
let swingRangeShapeInitPosUd;
let swingRangeShapeInitPosUdOffset = -0.5;
// 定向送风
// 留给控制柄的位置偏移量
let targetAngleOffset = 3.5;
// 转到正面时摄像机的matrix
let cameraZhengMianMatrix = new THREE.Matrix4().fromArray([
  0.100000016, 0, 0, 0, 0, 0.100000009, 0, 0, 0, 0, 0.100000001, 0, 0, 0.6,
  3.04615338, 1,
]);
// 作为scene的子对象时，转到正面时扇形的matrix
let swingRangeShapeZhengMianMatrix = new THREE.Matrix4().fromArray([
  2.220446049250313e-16, -1, 3.14018491736755e-16, 0, -1,
  -2.220446049250313e-16, 2.465190328815662e-32, 0, 2.465190328815662e-32,
  -3.14018491736755e-16, -1, 0, 0, 0.7984388716086597, 0.1361891151791681, 1,
]);
// 作为camera的子对象时，扇形的matrix
let newM = swingRangeShapeZhengMianMatrix
  .clone()
  .premultiply(cameraZhengMianMatrix.clone().invert());
let cameraAnimSwingOff = {
  pos: null,
  target: null,
  light: null,
};
// 扇形动画
let swingRangeShapeInitPos = new THREE.Vector3(
  0,
  1.9843885374916281,
  -29.09964235721189
);
let swingRangeShapeInitPosOffset = 1;
// 外观
let lookAnimCamera = {
  pos: null,
  target: null,
  light: null,
};
function pxToRem(px) {
  return px + "rpx";
}
// 使用线性插值的easing函数
function linearEasing(t) {
  return t;
}
function animateCamera(
  startPos,
  startTarget,
  startLight,
  endPos,
  endTarget,
  endLight,
  duration,
  camera,
  scene,
  light,
  renderer,
  progressCallback,
  easing = linearEasing
) {
  let startTime = performance.now();

  const tick = () => {
    const elapsedTime = performance.now() - startTime;
    const fraction = elapsedTime / duration;

    if (fraction < 1) {
      // 使用提供的easing函数来计算插值
      const easedProgress = easing(fraction);
      progressCallback && progressCallback(easedProgress);

      const newPos = startPos.clone().lerp(endPos, easedProgress);
      camera.position.set(newPos.x, newPos.y, newPos.z);
      const newTarget = startTarget.clone().lerp(endTarget, easedProgress);
      camera.lookAt(newTarget);
      const newLight = startLight.clone().lerp(endLight, easedProgress);
      light.position.set(newLight.x, newLight.y, newLight.z);
      light.lookAt(newTarget);

      requestAnimationFrame(tick);
    } else {
      // 动画结束，设置最终位置
      camera.position.set(endPos.x, endPos.y, endPos.z);
      camera.lookAt(endTarget);
      light.position.set(endLight.x, endLight.y, endLight.z);
      light.lookAt(endTarget);
      progressCallback && progressCallback(1);
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  tick();
}
function setOpacity(object, opacity) {
  if (object instanceof THREE.Group) {
    let group = object;
    group.traverse((child) => {
      if (child.material) {
        // 确保child是Mesh且有material属性
        child.material.opacity = opacity;
        child.material.transparent = true; // 确保是透明的，以便opacity生效
      }
    });
  } else {
    // 插值透明度
    object.material.opacity = opacity;
    object.material.transparent = true; // 确保是透明的，以便opacity生效
  }
}
// 封装动画函数
function animateObject(
  object,
  startPosition,
  targetPosition,
  startOpacity,
  targetOpacity,
  duration,
  callback,
  easing = linearEasing
) {
  if (!object) return;
  const start = performance.now();

  const animate = () => {
    const now = performance.now();
    const elapsedTime = now - start;
    const progress = elapsedTime / duration;

    if (progress < 1) {
      // 使用提供的easing函数来计算插值
      const easedProgress = easing(progress);

      // 插值位置
      object.position.lerpVectors(startPosition, targetPosition, easedProgress);
      setOpacity(
        object,
        startOpacity + (targetOpacity - startOpacity) * easedProgress
      );

      // 继续动画
      requestAnimationFrame(animate);
    } else {
      // 动画结束，设置最终位置和透明度
      object.position.copy(targetPosition);
      setOpacity(object, targetOpacity);
      callback && callback();
    }
  };

  // 开始动画
  requestAnimationFrame(animate);
}

function isPC() {
  return true;
}
// 调试开关
const debugObj = {
  gui: false,
  fps: false,
  text: false,
  // stats: isDebug() ? true : false,
  cone: false,
  axesHelper: false,
  light: false,
  mockStatus: isPC(),
  mockStatusObj: {
    power: "on",
    gear: 1,
    ud_swing_angle: 60,
    swing_direction: "udlr",
    swing: "on",
    lr_diy_swing: "off",
    lr_diy_down_percent: 28,
    lr_diy_up_percent: 100,
    display_left_angle: 86,
    swing_angle: 60,
    target_angle: (30 / 120) * 100,
  },
};

module.exports = Behavior({
  behaviors: [],
  properties: {
    myBehaviorProperty: {
      type: String,
    },
  },
  data: {
    lookPanel: {
      show: false,
      options: ["#B4E7F0", "#93EBC0", "#E9DD90", "#FFFFFF"],
      activeOption: "#FFFFFF",
    },

    modelMaskStyleObj: {
      height: pxToRem(400),
    },
    switchObj: {
      show: false,
      // icon: require('../assets/image/icon/icon-switch-on.png'),
      icon: "",
      statusText: "",
      // value: 'on',
      value: "",
    },

    upPanel: {
      show: false,
      options: [0, 30, 60, 135],
    },

    activeTab: "lr",
    isLrSwinging: false,
    isLrFocus: false,
    statusData: {},
    tabList: [
      { id: "lr", title: "左右" },
      { id: "ud", title: "上下" },
    ],
    showSwingDegreeTab: false,
    transforming: false,
    showSwingDegreeTips: false,
    swingDegreeTipsTransitionName: "fade-slide-y",
    tips2: "",
    loadingType: null,
    controlLoading: false,
    loadingBgColor: "#00cbb8",
    loadingIconWhite:
      "https://ce-cdn.midea.com/activity/sit/3D/image/loading_white.png",
    loadingIconGray:
      "https://ce-cdn.midea.com/activity/sit/3D/image/loading_gray.png",
    loadingIcon:
      "https://ce-cdn.midea.com/activity/sit/3D/image/loading_white.png",

    showFixDegreeTips: false,
    swingFixDegreeTipsTransitionName: "fade-slide-y-fix",
    tips: "",
    tipsFirstChar: "",
    tipsRestOfTips: "",

    showUdDegreeTips: false,
    udDegreeTipsTransitionName: "fade-slide-ud",
    tips4: "",

    activeUdOption: null,
  },
  attached: function () {},
  methods: {
    test() {
      this.transform("ud");
    },
    test2() {
      this.transform("home");
    },
    test3() {
      this.transform("homeBack");
    },
    test4() {
      this.transform("swingOff");
    },
    test5() {
      this.transform("swingOn");
    },
    test6() {
      this.transform("look");
    },
    test7() {
      this.transform("homeBackOff");
    },

    udOptionClick(event) {
      if (!this.upPanel.show) return;
      let value = event.currentTarget.dataset.option;
      if (isPC()) {
        if (value == 0) {
          debugObj.mockStatusObj.swing_direction = "lr";
          // 两种情况
          // debugObj.mockStatusObj.swing_direction = 'invalid'
          debugObj.mockStatusObj.ud_swing_angle = 0;
        } else {
          debugObj.mockStatusObj.swing_direction = "ud";
          // 两种情况
          // debugObj.mockStatusObj.swing_direction = 'udlr'
          debugObj.mockStatusObj.ud_swing_angle = value;
        }
        this.updateStatus(debugObj.mockStatusObj);
      } else {
        this.postDataToWeex({
          type: "udControl",
          value: JSON.stringify({
            targetValue: value,
          }),
        });
      }
    },
    animateUdShape(from, to) {
      const start = performance.now();
      const duration = normalAnimDuration / 4;

      const animate = () => {
        const now = performance.now();
        const elapsedTime = now - start;
        const progress = elapsedTime / duration;

        let totalAngle = 135;
        if (progress < 1) {
          // 使用提供的easing函数来计算插值
          const easedProgress = progress;

          // 插值
          let displayAngle = Math.max(from + (to - from) * easedProgress, 5);
          const up = ((Math.PI / 180) * displayAngle) / 2;
          const down = -((Math.PI / 180) * displayAngle) / 2;

          this.updateShapeInHandleTouchMove2(up, down, totalAngle);
          // 继续动画
          requestAnimationFrame(animate);
        } else {
          // 动画结束
          let displayAngle = Math.max(to, 5);
          const up = ((Math.PI / 180) * displayAngle) / 2;
          const down = -((Math.PI / 180) * displayAngle) / 2;

          this.updateShapeInHandleTouchMove2(up, down, totalAngle);
        }
      };

      // 开始动画
      requestAnimationFrame(animate);
    },
    loopUd() {
      let options = this.upPanel.options;
      let curIndex = options.findIndex((it) => it == this.activeUdOption);
      let nextIndex = (curIndex + 1) % options.length;
      this.udOptionClick(options[nextIndex]);
    },
    updateSwitchObj() {
      if (this.isLrSwinging) {
        this.setData({
          "switchObj.statusText": "已开启",
          "switchObj.value": "on",
          "switchObj.icon":
            "https://ce-cdn.midea.com/activity/sit/3D/image/icon/icon-switch-on.png",
        });
      } else if (this.isLrFocus) {
        this.setData({
          "switchObj.statusText": "已关闭",
          "switchObj.value": "off",
          "switchObj.icon":
            "https://ce-cdn.midea.com/activity/sit/3D/image/icon/icon-switch-off.png",
        });
      }
    },
    toggleSwingSwitch() {
      // 动画中
      if (this.transforming) return;
      if (!this.switchObj.show) return;
      if (isPC()) {
        if (this.switchObj.value == "on") {
          debugObj.mockStatusObj.swing = "off";
          debugObj.mockStatusObj.lr_diy_swing = "off";
          debugObj.mockStatusObj.target_angle = (30 / 120) * 100;
        } else {
          debugObj.mockStatusObj.swing = "on";
          debugObj.mockStatusObj.swing_direction = "lr";
        }
        this.updateStatus(debugObj.mockStatusObj);
      } else {
        const that = this;
        this.setData({
          loadingType: "toggleSwingSwitch",
          loadingBgColor: that.switchObj.value === "on" ? "#00cbb8" : "#f2f2f2",
          loadingIcon:
            that.switchObj.value === "on"
              ? this.loadingIconWhite
              : this.loadingIconGray,
        });
        this.postDataToWeex({
          type: "toggleSwingSwitch",
          value: JSON.stringify({
            targetValue: that.switchObj.value === "on" ? "off" : "on",
          }),
        });
      }
    },
    updateComputed() {
      let tips2 = () => {
        let text = "";
        text = this.swingChangeSettingObj.display_left_angle + "°";
        return text;
      };
      let tips = () => {
        let text = "";
        // target_angle 0-100=>右60-左60
        if (this.seeingSwingRange) {
          let degree = Math.round(
            this.swingChangeSettingObj.target_angle * 1.2 - 60
          );
          let tmpText = degree + "°";
          if (tmpText.startsWith("-")) text = tmpText.replace("-", "右");
          else if (degree != 0) text = "左" + tmpText;
          else text = tmpText;
        }
        return text;
      };
      let tips4 = () => {
        let text = "";
        if (this.seeingUd)
          text = this.swingChangeSettingObj.ud_swing_angle + "°";
        return text;
      };

      let activeUdOption = () => {
        return this.swingChangeSettingObj.ud_swing_angle;
      };
      this.setData({
        tips2: tips2(),
        tips: tips(),
        tips4: tips4(),
        activeUdOption: activeUdOption(),
      });
    },
    setCameraAnimUdAndAnimate() {
      cameraAnimUd.endPos = cameraAnimForwardHome.endPos
        .clone()
        .sub(new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1))
        .add(new THREE.Vector3(2.53438, 0.680595, -0.137939 * -1))
        // 微调
        .add(new THREE.Vector3(0.5, 0, 0));
      cameraAnimUd.endTarget = cameraAnimForwardHome.endTarget
        .clone()
        // 微调
        .add(new THREE.Vector3(0, 0, 0.1));
      let cameraAnimNow = {
        pos: cameraAnimForwardHome.endPos.clone(),
        target: cameraAnimForwardHome.endTarget.clone(),
        light: cameraAnimForwardHome.endLight.clone(),
      };
      animateCamera(
        cameraAnimNow.pos.clone(),
        cameraAnimNow.target.clone(),
        cameraAnimNow.light.clone(),
        cameraAnimUd.endPos.clone(),
        cameraAnimUd.endTarget.clone(),
        cameraAnimUd.endLight.clone(),
        normalAnimDuration,
        this.camera,
        this.scene,
        light,
        this.renderer,
        this.cameraAnimUdScaleFunc
        // singleBounce
      );
    },
    tabClicked(event) {
      let tabId = event.detail.tabId;
      this.setData({
        activeTab: tabId,
      });
      if (tabId == "ud") {
        this.transform("ud");
      } else {
        this.transform("home");
      }
    },
    tuneByUpDownDiff(angleOffset) {
      // down，右边的
      this.swingChangeSettingObj.lr_diy_down_percent = Math.max(
        0,
        draggingSwingShape.current.down + angleOffset
      );
      // up，左边的
      this.swingChangeSettingObj.lr_diy_up_percent = Math.min(
        100,
        draggingSwingShape.current.up + angleOffset
      );
      // console.error(
      //   (angleOffset * 120) / 100,
      //   this.swingChangeSettingObj.lr_diy_down_percent,
      //   this.swingChangeSettingObj.lr_diy_up_percent,
      //   pTouchStart.x,
      //   pTouchStart.y,
      //   p.x,
      //   p.y
      // )
      let originDiff =
        draggingSwingShape.current.up - draggingSwingShape.current.down;
      if (
        this.swingChangeSettingObj.lr_diy_up_percent -
          this.swingChangeSettingObj.lr_diy_down_percent <
        originDiff
      ) {
        if (this.swingChangeSettingObj.lr_diy_up_percent == 100) {
          this.swingChangeSettingObj.lr_diy_down_percent =
            this.swingChangeSettingObj.lr_diy_up_percent - originDiff;
        }
        if (this.swingChangeSettingObj.lr_diy_down_percent == 0) {
          this.swingChangeSettingObj.lr_diy_up_percent =
            this.swingChangeSettingObj.lr_diy_down_percent + originDiff;
        }
      }
    },
    getPTouchStart(swingRangeOrigin2D) {
      // 当前拖动的把柄在屏幕上的坐标
      this.spheres[0].getWorldPosition(calVectorSwingRange);
      let swingRangePoint2D = threeConversionTwo(
        calVectorSwingRange.clone(),
        this.camera
      );
      return findPointOnCircleWithGivenX(
        swingRangeOrigin2D,
        swingRangePoint2D,
        ((draggingSwingShape.touch.x + 1) / 2) * window.innerWidth
      );
    },
    postDataToWeex(obj) {
      console.error(obj);
    },
    updateSphereInHandleTouchMove2(up, down) {
      // 更新拖动点
      this.spheres[0].position.set(
        this.swingRangeRadius * Math.cos(down),
        this.swingRangeRadius * Math.sin(down),
        this.sphereRadius / 2
      );
      this.spheres[1].position.set(
        this.swingRangeRadius * Math.cos(up),
        this.swingRangeRadius * Math.sin(up),
        this.sphereRadius / 2
      );
    },
    updateShapeInHandleTouchMove2(up, down, totalAngle = 120) {
      // 更新扇形
      this.rangePlane.geometry.dispose();
      this.rangePlane.geometry = new THREE.CircleGeometry(
        this.swingRangeRadius,
        32,
        down,
        up - down
      );

      this.rangePlane_1.geometry.dispose();
      this.rangePlane_1.geometry = new THREE.CircleGeometry(
        this.swingRangeRadius,
        32,
        (Math.PI / 180) * (0 - totalAngle / 2),
        down - (Math.PI / 180) * (0 - totalAngle / 2)
      );

      this.rangePlane_2.geometry.dispose();
      this.rangePlane_2.geometry = new THREE.CircleGeometry(
        this.swingRangeRadius,
        32,
        up,
        ((Math.PI / 180) * totalAngle) / 2 - up
      );
    },
    calculateAngleOffset(p, sphereRight2D, swingRangeOrigin2D) {
      let angleOffset;
      if (p == null) {
        // 不在圆上，在右边
        if (((touch.x + 1) / 2) * window.innerWidth >= sphereRight2D.x)
          angleOffset = 0;
        // 在左边
        else angleOffset = 120;
      } else {
        if (p.x > sphereRight2D.x) {
          // 点在圆上，但不在圆弧上
          angleOffset = 0;
        } else {
          // 计算扇形最右端与找到的点间的角度
          angleOffset = getAngleBAC(
            swingRangeOrigin2D.x,
            swingRangeOrigin2D.y,
            sphereRight2D.x,
            sphereRight2D.y,
            p.x,
            p.y
          );
        }
      }
      return angleOffset;
    },
    calculateSwingRangePoint() {
      let v = new THREE.Vector3();
      this.swingRangeShape.getWorldPosition(v);
      // 扇形圆心在屏幕上的坐标
      let swingRangeOrigin2D = threeConversionTwo(v.clone(), this.camera);
      // 当前拖动的把柄在屏幕上的坐标
      if (draggingSphere) draggingSphere.getWorldPosition(calVectorSwingRange);
      else this.spheres[0].getWorldPosition(calVectorSwingRange);
      let swingRangePoint2D = threeConversionTwo(
        calVectorSwingRange.clone(),
        this.camera
      );
      // 找到屏幕上横坐标跟触摸位置对应的，而且在扇形所在圆上的点
      let p = findPointOnCircleWithGivenX(
        swingRangeOrigin2D,
        swingRangePoint2D,
        ((touch.x + 1) / 2) * window.innerWidth
      );
      // 扇形最右端点在屏幕上的坐标
      sphereRight.getWorldPosition(calVectorSwingRange);
      let sphereRight2D = threeConversionTwo(
        calVectorSwingRange.clone(),
        this.camera
      );

      return { p, sphereRight2D, swingRangeOrigin2D };
    },
    handleTouchMoveSwingShape(event) {
      if (!draggingSwingShape) return;
      // 满格了，没得移动
      if (
        this.swingChangeSettingObj.lr_diy_up_percent == 100 &&
        this.swingChangeSettingObj.lr_diy_down_percent == 0
      ) {
        draggingSwingShape = null;
        return;
      }
      // console.error(JSON.stringify(draggingSwingShape))

      // let originX = touch.x
      // let originY = touch.y
      // 计算触摸位置
      touch.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      touch.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;

      let { p, swingRangeOrigin2D } = this.calculateSwingRangePoint();
      if (p == null) return;

      // 找到屏幕上横坐标跟touchStart触摸位置对应的，而且在扇形所在圆上的点
      let pTouchStart = this.getPTouchStart(swingRangeOrigin2D);

      let angleOffset = getAngleBAC(
        swingRangeOrigin2D.x,
        swingRangeOrigin2D.y,
        pTouchStart.x,
        pTouchStart.y,
        p.x,
        p.y
      );
      angleOffset = (angleOffset * 100) / 120;
      if (pTouchStart.x < p.x) angleOffset *= -1;

      this.tuneByUpDownDiff(angleOffset);

      const up =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_up_percent - 60);
      const down =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_down_percent - 60);
      this.updateShapeInHandleTouchMove2(up, down);
      this.updateSphereInHandleTouchMove2(up, down);

      // 更新tips
      this.swingChangeSettingObj.display_left_angle = Math.max(
        15,
        Math.floor(
          1.2 *
            (this.swingChangeSettingObj.lr_diy_up_percent -
              this.swingChangeSettingObj.lr_diy_down_percent)
        )
      );
      this.updateComputed();
    },
    handleTouchMove2(event) {
      if (!draggingSphere) return;

      // let originX = touch.x
      // let originY = touch.y
      // 计算触摸位置
      touch.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      touch.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;

      let { p, sphereRight2D, swingRangeOrigin2D } =
        this.calculateSwingRangePoint();

      let angleOffset = this.calculateAngleOffset(
        p,
        sphereRight2D,
        swingRangeOrigin2D
      );

      if (draggingSphere == this.spheres[0]) {
        // down，右边的
        this.swingChangeSettingObj.lr_diy_down_percent = Math.max(
          0,
          Math.min(
            this.swingChangeSettingObj.lr_diy_up_percent - 1500 / 120,
            (angleOffset * 100) / 120
          )
        );
      } else if (draggingSphere == this.spheres[1]) {
        // up，左边的
        this.swingChangeSettingObj.lr_diy_up_percent = Math.max(
          this.swingChangeSettingObj.lr_diy_down_percent + 1500 / 120,
          Math.min(100, (angleOffset * 100) / 120)
        );
      }

      const up =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_up_percent - 60);
      const down =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_down_percent - 60);
      this.updateShapeInHandleTouchMove2(up, down);
      this.updateSphereInHandleTouchMove2(up, down);

      // 更新tips
      this.swingChangeSettingObj.display_left_angle = Math.max(
        15,
        Math.floor(
          1.2 *
            (this.swingChangeSettingObj.lr_diy_up_percent -
              this.swingChangeSettingObj.lr_diy_down_percent)
        )
      );
      this.updateComputed();
    },
    onTouchEnd() {
      if (this.seeingSwingRange) {
        // 确定
        if (draggingHead) {
          this.statusData.target_angle =
            this.swingChangeSettingObj.target_angle;
          // console.log(this.swingChangeSettingObj)
          this.postDataToWeex({
            type: "lrFocusChanged",
            value: JSON.stringify(this.swingChangeSettingObj),
          });
        }
      }
      if (this.seeingSwingRange2) {
        if (draggingSphere || draggingSwingShape) {
          this.swingChangeSettingObj.lr_diy_down_percent = Math.round(
            this.swingChangeSettingObj.lr_diy_down_percent
          );
          this.swingChangeSettingObj.lr_diy_up_percent = Math.round(
            this.swingChangeSettingObj.lr_diy_up_percent
          );

          this.statusData.lr_diy_down_percent =
            this.swingChangeSettingObj.lr_diy_down_percent;
          this.statusData.lr_diy_up_percent =
            this.swingChangeSettingObj.lr_diy_up_percent;
          this.statusData.display_left_angle =
            this.swingChangeSettingObj.display_left_angle;
          // console.log(this.swingChangeSettingObj)
          this.postDataToWeex({
            type: "lrSwingRangeChanged",
            value: JSON.stringify(this.swingChangeSettingObj),
          });
        }
      }
    },
    onTouchMove(event) {
      if (this.seeingSwingRange) {
        this.handleTouchMove1(event);
      }
      if (this.seeingSwingRange2) {
        this.handleTouchMove2(event);
        this.handleTouchMoveSwingShape(event);
      }
    },
    onTouchStartSwingRange2(event) {
      // 获取Touch事件的坐标，将坐标转换为Three.js中的向量
      touch.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      touch.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;

      let t = touch.clone();
      draggingSphere = null;
      draggingSwingShape = null;
      // 设置射线的起点和方向
      raycaster.setFromCamera(t, this.camera);

      for (let r = 0; r < 0.1; r += 0.001) {
        if (draggingSphere) break;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 90) {
          if (draggingSphere) break;
          t.x = touch.x + r * Math.cos(angle);
          t.y = touch.y + r * Math.sin(angle);

          // 设置射线的起点和方向
          raycaster.setFromCamera(t, this.camera);

          // 检测射线与球体是否相交
          let intersects = raycaster.intersectObject(this.spheres[0]);
          if (intersects.length > 0) {
            draggingSphere = this.spheres[0];
          } else {
            intersects = raycaster.intersectObject(this.spheres[1]);
            if (intersects.length > 0) {
              draggingSphere = this.spheres[1];
            } else {
              draggingSphere = null;
            }
          }
        }
      }

      t = touch.clone();
      if (draggingSphere) return;
      raycaster.setFromCamera(t, this.camera);
      // 检测射线与球体是否相交
      let intersects = raycaster.intersectObject(this.rangePlane);
      if (intersects.length > 0) {
        draggingSwingShape = {
          touch: t,
          current: {
            down: this.statusData.lr_diy_down_percent,
            up: this.statusData.lr_diy_up_percent,
          },
        };
      } else {
        draggingSwingShape = null;
      }
      // console.error(draggingSwingShape)
    },
    onTouchStart(event) {
      if (this.seeingSwingRange) {
        this.onTouchStartSwingRange1(event);
      }

      // 送风范围
      if (this.seeingSwingRange2) {
        if (!this.spheres) return;

        this.onTouchStartSwingRange2(event);
      }
    },
    reset() {
      this.seeingSwingRange = false;
      draggingHead = false;
      this.swingRangeShape && this.swingRangeShape.removeFromParent();
      this.lrGroup.remove(draggingSphere);
      this.swingRangeShape = null;
    },
    transformHomeBackOff(lastTransformType, type) {
      // 先只考虑特定情况
      if (lastTransformType != "homeBack" && lastTransformType != null) return;
      if (this.statusData.power != "on") return;
      this.currentTransformType = type;
      this.setData({
        transforming: true,
      });
      animateCamera(
        cameraAnimForwardHome.startPos.clone(),
        cameraAnimForwardHome.startTarget.clone(),
        cameraAnimForwardHome.startLight.clone(),
        cameraInitPosOff.clone(),
        cameraInitTargetOff.clone(),
        cameraAnimForwardHome.startLight.clone(),
        normalAnimDuration,
        this.camera,
        this.scene,
        light,
        this.renderer
      );
    },
    transformSwingOff(lastTransformType, type) {
      // ud=>swingOff，通过activeTab=lr和ud=>home来实现
      // home=>swingOff
      // swingOn=>swingOff
      // homeBack=>swingOff，通过activeTab=lr和homeBack=>home来实现
      if (lastTransformType == "home" || lastTransformType == "swingOn") {
        this.currentTransformType = type;
        this.reset2();
        this.seeSwingRange();
        setOpacity(this.swingRangeShape, 1);
        this.setData({
          showSwingDegreeTips: false,
          showFixDegreeTips: true,
        });
        // this.transforming = true
        // cameraAnimSwingOff.pos = cameraAnimForwardHome.endPos
        //   .clone()
        //   .add(new THREE.Vector3(1.50636, 0.921639, -2.25001 * -1))
        //   .sub(new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1))
        // cameraAnimSwingOff.target = cameraAnimForwardHome.endTarget.clone()
        // cameraAnimSwingOff.light = cameraAnimForwardHome.startLight.clone()
        // cameraAnimSwingOff.pos.z += 0.5
        // cameraAnimSwingOff.pos.x -= 1
        // animateCamera(
        //   cameraAnimForwardHome.endPos.clone(),
        //   cameraAnimForwardHome.endTarget.clone(),
        //   cameraAnimForwardHome.endLight.clone(),
        //   cameraAnimSwingOff.pos.clone(),
        //   cameraAnimSwingOff.target.clone(),
        //   cameraAnimSwingOff.light.clone(),
        //   normalAnimDuration,
        //   this.camera,
        //   this.scene,
        //   light,
        //   this.renderer
        // )
      }
    },
    transformSwingOn(lastTransformType, type) {
      // ud=>swingOn，通过ud=>home实现
      // home=>swingOn，通过swingOff=>swingOn、ud=>swingOn实现
      // homeBack=>swingOn，通过homeBack=>home实现
      // swingOff=>swingOn
      if (
        lastTransformType == "swingOff" ||
        (lastTransformType == "home" && !this.seeingSwingRange2)
      ) {
        if (lastTransformType == "home" && !this.seeingSwingRange2) {
          this.setData({
            swingFixDegreeTipsTransitionName: "fade-slide-y-fix",
          });
        }
        this.$nextTick(() => {
          this.currentTransformType = type;
          this.reset();
          this.seeSwingRange2();
          setOpacity(this.swingRangeShape, 1);
          this.setData({
            transforming: true,
            showSwingDegreeTips: true,
            showFixDegreeTips: false,
          });
          // cameraAnimSwingOff.pos = cameraAnimForwardHome.endPos
          //   .clone()
          //   .add(new THREE.Vector3(1.50636, 0.921639, -2.25001 * -1))
          //   .sub(new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1))
          // cameraAnimSwingOff.target = cameraAnimForwardHome.endTarget.clone()
          // cameraAnimSwingOff.target.x -= 0.1
          // cameraAnimSwingOff.light = cameraAnimForwardHome.startLight.clone()
          // animateCamera(
          //   cameraAnimSwingOff.pos.clone(),
          //   cameraAnimSwingOff.target.clone(),
          //   cameraAnimSwingOff.light.clone(),
          //   cameraAnimForwardHome.endPos.clone(),
          //   cameraAnimForwardHome.endTarget.clone(),
          //   cameraAnimForwardHome.endLight.clone(),
          //   normalAnimDuration,
          //   this.camera,
          //   this.scene,
          //   light,
          //   this.renderer
          // )
        });
      }
    },
    addSwingRangeObjects2() {
      const swingRangeRadius = 0.3;
      this.swingRangeRadius = swingRangeRadius;
      const up =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_up_percent - 60);
      const down =
        (Math.PI / 180) *
        (1.2 * this.swingChangeSettingObj.lr_diy_down_percent - 60);

      // 添加描边
      // const edges = new THREE.EdgesGeometry(plane.geometry)
      // const line = new THREE.LineSegments(
      //   edges,
      //   new THREE.LineBasicMaterial({ color: 0x0000ff })
      //   )

      const { plane, plane_1, plane_2, sphere, sphere_1 } =
        this.initShapeAndSphere(swingRangeRadius, down, up);
      this.rangePlane = plane;
      this.rangePlane_1 = plane_1;
      this.rangePlane_2 = plane_2;

      this.swingRangeShape = new THREE.Group();
      this.swingRangeShape.add(plane_1);
      this.swingRangeShape.add(plane_2);
      this.swingRangeShape.add(plane);
      // this.swingRangeShape.add(line)
      this.swingRangeShape.add(sphere);
      this.swingRangeShape.add(sphere_1);
      this.swingRangeShape.add(sphereRight);
      this.spheres = [sphere, sphere_1];
      this.swingRangeShape.rotateX(Math.PI / 2);
      this.swingRangeShape.rotateZ(Math.PI / 2);
      this.swingRangeShape.rotateOnWorldAxis(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2
      );

      // 塞到camera里，那就可以一直相对摄像头静止
      this.camera.add(this.swingRangeShape);
      this.swingRangeShape.matrix = newM;
      this.swingRangeShape.matrix.decompose(
        this.swingRangeShape.position,
        this.swingRangeShape.quaternion,
        this.swingRangeShape.scale
      );
      setOpacity(this.swingRangeShape, 0);
    },
    seeSwingRange2() {
      // 锁定参数
      this.swingChangeSettingObj = JSON.parse(JSON.stringify(this.statusData));
      this.seeingSwingRange2 = true;
      this.addSwingRangeObjects2();
      this.updateComputed();
    },
    transformHomeLrSwinging(showSwingDegreeTipsTimeout, cameraAnimNow) {
      this.seeSwingRange2();
      this.setData({
        showSwingDegreeTab: true,
      });
      animateCamera(
        cameraAnimNow.pos.clone(),
        cameraAnimNow.target.clone(),
        cameraAnimNow.light.clone(),
        cameraAnimForwardHome.endPos.clone(),
        cameraAnimForwardHome.endTarget.clone(),
        cameraAnimForwardHome.endLight.clone(),
        normalAnimDuration,
        this.camera,
        this.scene,
        light,
        this.renderer,
        cameraAnimNow.type == "ud" ? this.cameraAnimUdScaleFunc : null
      );
      let startPos = swingRangeShapeInitPos.clone();
      startPos.y += swingRangeShapeInitPosOffset;
      animateObject(
        this.swingRangeShape,
        startPos.clone(),
        swingRangeShapeInitPos.clone(),
        0,
        1,
        normalAnimDuration
      );
      setTimeout(() => {
        this.setData({
          showSwingDegreeTips: true,
        });
      }, showSwingDegreeTipsTimeout);
      setTimeout(() => {
        // this.switchObj.show = true;
        this.setData({
          "switchObj.show": true,
        });
      }, 300);
    },
    transformUd(lastTransformType, type) {
      let startPos;
      // homeBack=>ud，不直接切换，是通过homeBack=>home + activeTab=ud来切换
      if (
        lastTransformType === "home" ||
        lastTransformType === "swingOff" ||
        lastTransformType === "swingOn"
      ) {
        this.reset();
        this.reset2();
        this.currentTransformType = type;
        this.setData({
          transforming: true,
          swingDegreeTipsTransitionName: "fade-slide-x",
          swingFixDegreeTipsTransitionName: "fade-slide-x",
        });
        this.$nextTick(() => {
          this.seeUd();
          this.setData({
            "switchObj.show": false,
            "upPanel.show": true,
            showSwingDegreeTips: false,
            showFixDegreeTips: false,
            showUdDegreeTips: true,
          });

          startPos = swingRangeShapeInitPosUd.clone();
          startPos.y += swingRangeShapeInitPosUdOffset;
          animateObject(
            this.swingRangeShape,
            startPos.clone(),
            swingRangeShapeInitPosUd.clone(),
            0,
            1,
            normalAnimDuration
          );
        });
        this.setCameraAnimUdAndAnimate();
      }
    },
    setCameraAnimHomeBackAndAnimate(lastTransformType) {
      let durationScale = 1;
      let cameraAnimNow = {
        pos: cameraAnimForwardHome.endPos,
        target: cameraAnimForwardHome.endTarget,
        light: cameraAnimForwardHome.endLight,
        initPos: swingRangeShapeInitPos,
      };
      if (lastTransformType === "ud") {
        cameraAnimNow = {
          pos: cameraAnimUd.endPos,
          target: cameraAnimUd.endTarget,
          light: cameraAnimUd.endLight,
          initPos: swingRangeShapeInitPosUd,
        };
      } else if (lastTransformType === "look") {
        cameraAnimNow = {
          pos: lookAnimCamera.pos,
          target: lookAnimCamera.target,
          light: lookAnimCamera.light,
        };
        durationScale = 0.5;
      } else if (
        lastTransformType === null ||
        lastTransformType == "homeBackOff"
      ) {
        cameraAnimNow = {
          pos: cameraInitPosOff,
          target: cameraInitTargetOff,
          light: cameraAnimForwardHome.startLight,
        };
      }
      animateCamera(
        cameraAnimNow.pos.clone(),
        cameraAnimNow.target.clone(),
        cameraAnimNow.light.clone(),
        cameraAnimForwardHome.startPos.clone(),
        cameraAnimForwardHome.startTarget.clone(),
        cameraAnimForwardHome.startLight.clone(),
        normalAnimDuration * durationScale,
        this.camera,
        this.scene,
        light,
        this.renderer
      );
      return cameraAnimNow;
    },
    transformHomeBack(lastTransformType, type) {
      let startPos;
      // home=>homeBack
      // ud=>homeBack
      // swingOn=>homeBack
      // swingOff=>homeBack
      if (lastTransformType == "swingOff") {
        this.setData({
          swingFixDegreeTipsTransitionName: "fade-slide-y",
        });
      }
      this.currentTransformType = type;
      this.setData({
        transforming: true,
      });
      if (lastTransformType == null || lastTransformType == "homeBackOff") {
        // 关机到开机
        this.setCameraAnimHomeBackAndAnimate(lastTransformType);
        return;
      }
      let cameraAnimNow =
        this.setCameraAnimHomeBackAndAnimate(lastTransformType);
      if (lastTransformType === "ud") {
        startPos = swingRangeShapeInitPosUd.clone();
        startPos.y += swingRangeShapeInitPosUdOffset;
      } else {
        startPos = swingRangeShapeInitPos.clone();
        startPos.y += swingRangeShapeInitPosOffset;
      }
      this.swingRangeShape &&
        animateObject(
          this.swingRangeShape,
          cameraAnimNow.initPos.clone(),
          startPos.clone(),
          1,
          0,
          normalAnimDuration,
          () => {
            this.reset2();
            this.reset();
          }
        );
      if (lastTransformType === "ud") {
        this.setData({
          udDegreeTipsTransitionName: "fade-slide-y",
        });
      }
      this.$nextTick(() => {
        this.changingColor = false;
        this.setData({
          showSwingDegreeTab: false,
        });
        this.setData({
          "switchObj.show": false,
          "upPanel.show": false,
          "lookPanel.show": false,
          showSwingDegreeTips: false,
          showFixDegreeTips: false,
          showUdDegreeTips: false,
        });
      });
      // this.modelMaskStyleObj.height = pxToRem(400)
      this.setData({
        "modelMaskStyleObj.height": pxToRem(400),
      });
    },
    confirmChangeColor() {
      // 如果选择过，记录；没有选择过，保持原样
      this.selectedColor &&
        localStorage.setItem(customColorKey, this.selectedColor);
    },
    selectColor(color) {
      this.selectedColor = color;
      // TODO
      // this.lookPanel.activeOption = this.selectedColor
      this.setData({
        "lookPanel.activeOption": this.selectedColor,
      });
      light.color = this.convertColor(color);
    },
    lookOptionClick(event) {
      if (!this.lookPanel.show) return;
      let value = event.currentTarget.dataset.item;
      this.selectColor(value);
      this.confirmChangeColor();
    },
    startChangeColor() {
      this.selectedColor = null;
      this.changingColor = true;
    },
    transformLook(type) {
      if (this.statusData.power == "off") return;
      this.startChangeColor();
      this.currentTransformType = type;
      this.setData({
        transforming: true,
      });
      // TODO
      // this.modelMaskStyleObj.height = pxToRem(0)
      this.setData({
        "modelMaskStyleObj.height": pxToRem(0),
      });

      this.camera.getWorldDirection(calVector);
      lookAnimCamera.pos = cameraAnimForwardHome.startPos
        .clone()
        .add(calVector.normalize().multiplyScalar(0.2));
      lookAnimCamera.target = cameraAnimForwardHome.startTarget
        .clone()
        .add(new THREE.Vector3(0, 0.1, 0));
      lookAnimCamera.light = cameraAnimForwardHome.startLight.clone();
      animateCamera(
        cameraAnimForwardHome.startPos.clone(),
        cameraAnimForwardHome.startTarget.clone(),
        cameraAnimForwardHome.startLight.clone(),
        lookAnimCamera.pos.clone(),
        lookAnimCamera.target.clone(),
        lookAnimCamera.light.clone(),
        normalAnimDuration / 2,
        this.camera,
        this.scene,
        light,
        this.renderer
      );
      // TODO
      // this.lookPanel.show = true
      this.setData({
        "lookPanel.show": true,
      });
    },
    addSwingRangeObjects() {
      const swingRangeRadius = 0.3;
      this.swingRangeRadius = swingRangeRadius;

      const offset = targetAngleOffset;
      const up =
        (Math.PI / 180) *
        (1.2 * (this.swingChangeSettingObj.target_angle + offset) - 60);
      const down =
        (Math.PI / 180) *
        (1.2 * (this.swingChangeSettingObj.target_angle - offset) - 60);

      const { plane, plane_1, plane_2, sphere } = this.initShapeAndSphere(
        swingRangeRadius,
        down,
        up
      );
      this.rangePlane = plane;
      this.rangePlane_1 = plane_1;
      this.rangePlane_2 = plane_2;

      const newSphereDown =
        (Math.PI / 180) * (1.2 * this.swingChangeSettingObj.target_angle - 60);
      sphere.position.set(
        swingRangeRadius * Math.cos(newSphereDown),
        swingRangeRadius * Math.sin(newSphereDown),
        this.sphereRadius / 2
      );

      this.swingRangeShape = new THREE.Group();
      this.swingRangeShape.add(plane_1);
      this.swingRangeShape.add(plane_2);
      this.swingRangeShape.add(plane);
      this.swingRangeShape.add(sphere);
      this.swingRangeShape.add(sphereRight);
      this.spheres = [sphere];

      // 塞到camera里，那就可以一直相对摄像头静止
      this.camera.add(this.swingRangeShape);
      this.swingRangeShape.matrix = newM.clone();
      this.swingRangeShape.matrix.decompose(
        this.swingRangeShape.position,
        this.swingRangeShape.quaternion,
        this.swingRangeShape.scale
      );
      setOpacity(this.swingRangeShape, 0);
    },
    seeSwingRange() {
      // 锁定参数
      this.swingChangeSettingObj = JSON.parse(JSON.stringify(this.statusData));
      this.seeingSwingRange = true;
      this.addSwingRangeObjects();
      this.updateComputed();
    },
    addShapeHelper(totalAngle, swingRangeRadius, sphereRadius) {
      // 辅助用，用于定位扇形最右端
      const geometry_2 = new THREE.SphereGeometry(0.000001, 32, 32);
      const material_2 = new THREE.MeshBasicMaterial({
        color: "#FFFFFF",
        transparent: true,
        opacity: 0,
      });
      sphereRight = new THREE.Mesh(geometry_2, material_2);
      let end = (Math.PI / 180) * ((totalAngle / 100) * 0 - totalAngle / 2);
      sphereRight.position.set(
        swingRangeRadius * Math.cos(end),
        swingRangeRadius * Math.sin(end),
        sphereRadius / 2
      );
    },
    createSphere(sphereRadius, swingRangeRadius, down) {
      const geometry_2 = new THREE.SphereGeometry(sphereRadius, 32, 32);
      const material_2 = new THREE.MeshBasicMaterial({
        color: 0x00cbb8,
        transparent: true,
        opacity: 1,
      });
      const sphere = new THREE.Mesh(geometry_2, material_2);
      sphere.position.set(
        swingRangeRadius * Math.cos(down),
        swingRangeRadius * Math.sin(down),
        sphereRadius / 2
      );
      return sphere;
    },
    createRangePlane1(swingRangeRadius, down, up, totalAngle) {
      const geometry_1 = new THREE.CircleGeometry(
        swingRangeRadius,
        32,
        (Math.PI / 180) * (0 - totalAngle / 2),
        down - (Math.PI / 180) * (0 - totalAngle / 2)
      );
      //纹理贴图加载器TextureLoader
      const texLoader = new THREE.TextureLoader();
      // .load()方法加载图像，返回一个纹理对象Texture
      // const texture = texLoader.load("./assets/textures/range_2.png?v=4");
      const texture = texLoader.load(
        "https://ce-cdn.midea.com/activity/sit/3D/textures/range_2.png"
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.NearestFilter;
      const material_1 = new THREE.MeshBasicMaterial({
        // 设置纹理贴图：Texture对象作为材质map属性的属性值
        map: texture, //map表示材质的颜色贴图属性
        transparent: true,
        side: THREE.DoubleSide,
      });
      return { plane_1: new THREE.Mesh(geometry_1, material_1), material_1 };
    },
    createCurrentRangePlane(r, up, down) {
      const geometry = new THREE.CircleGeometry(r, 32, down, up - down);

      //纹理贴图加载器TextureLoader
      const texLoader = new THREE.TextureLoader();
      // .load()方法加载图像，返回一个纹理对象Texture
      // const texture = texLoader.load("./assets/textures/range_1.png?v=2");
      const texture = texLoader.load(
        "https://ce-cdn.midea.com/activity/sit/3D/textures/range_1.png"
      );
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        // 设置纹理贴图：Texture对象作为材质map属性的属性值
        map: texture, //map表示材质的颜色贴图属性
        transparent: true,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geometry, material);
    },
    initShapeAndSphere(swingRangeRadius, down, up, totalAngle = 120) {
      const plane = this.createCurrentRangePlane(swingRangeRadius, up, down);

      const { plane_1, material_1 } = this.createRangePlane1(
        swingRangeRadius,
        down,
        up,
        totalAngle
      );

      const geometry_4 = new THREE.CircleGeometry(
        swingRangeRadius,
        32,
        up,
        (Math.PI / 180) * (totalAngle / 2) - up
      );
      const plane_2 = new THREE.Mesh(geometry_4, material_1);

      const sphereRadius = 0.02;
      this.sphereRadius = sphereRadius;

      let sphere = this.createSphere(sphereRadius, swingRangeRadius, down);

      const geometry_3 = new THREE.SphereGeometry(sphereRadius, 32, 32);
      const material_3 = new THREE.MeshBasicMaterial({
        color: 0x00cbb8,
        transparent: true,
        opacity: 1,
      });
      const sphere_1 = new THREE.Mesh(geometry_3, material_3);
      sphere_1.position.set(
        swingRangeRadius * Math.cos(up),
        swingRangeRadius * Math.sin(up),
        sphereRadius / 2
      );

      this.addShapeHelper(totalAngle, swingRangeRadius, sphereRadius);

      return { plane, plane_1, plane_2, sphere, sphere_1 };
    },
    addUdObjects() {
      const swingRangeRadius = 0.3;
      this.swingRangeRadius = swingRangeRadius;

      let displayAngle = Math.max(this.swingChangeSettingObj.ud_swing_angle, 5);

      const totalAngle = 135;
      const up = ((Math.PI / 180) * displayAngle) / 2;
      const down = -((Math.PI / 180) * displayAngle) / 2;

      const { plane, plane_1, plane_2 } = this.initShapeAndSphere(
        swingRangeRadius,
        down,
        up,
        totalAngle
      );
      this.rangePlane = plane;
      this.rangePlane_1 = plane_1;
      this.rangePlane_2 = plane_2;

      this.swingRangeShape = new THREE.Group();
      this.swingRangeShape.add(plane_1);
      this.swingRangeShape.add(plane_2);
      this.swingRangeShape.add(plane);
      // this.swingRangeShape.add(sphere)
      // this.swingRangeShape.add(sphereRight)
      // this.spheres = [sphere]
      this.swingRangeShape.translateY(0.95);
      // this.swingRangeShape.rotateX(Math.PI / 2)
      // this.swingRangeShape.rotateZ(Math.PI / 2)
      this.swingRangeShape.rotateOnWorldAxis(
        new THREE.Vector3(0, 1, 0),
        -Math.PI / 2
      );
      let v = new THREE.Vector3(0, 0, 3);
      this.swingRangeShape.translateOnAxis(
        this.swingRangeShape.worldToLocal(v),
        0.07
      );

      // 塞到camera里，那就可以一直相对摄像头静止
      this.camera.add(this.swingRangeShape);
      this.swingRangeShape.matrix = newMUd.clone();
      this.swingRangeShape.matrix.decompose(
        this.swingRangeShape.position,
        this.swingRangeShape.quaternion,
        this.swingRangeShape.scale
      );
      // this.scene.add(this.swingRangeShape)
      swingRangeShapeInitPosUd = this.swingRangeShape.position.clone();
    },
    seeUd() {
      // 锁定参数
      this.swingChangeSettingObj = JSON.parse(JSON.stringify(this.statusData));
      this.seeingUd = true;
      this.addUdObjects();
      setOpacity(this.swingRangeShape, 0);
      this.updateComputed();
    },
    reset2() {
      this.seeingSwingRange2 = false;
      this.swingRangeShape && this.swingRangeShape.removeFromParent();
      this.swingRangeShape = null;
    },
    setCameraAnimUdAndAnimateInHomeNotLr() {
      cameraAnimUd.endPos = cameraAnimForwardHome.endPos
        .clone()
        .sub(new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1))
        .add(new THREE.Vector3(2.53438, 0.680595, -0.137939 * -1))
        // 微调
        .add(new THREE.Vector3(0.5, 0, 0));
      cameraAnimUd.endTarget = cameraAnimForwardHome.endTarget
        .clone()
        // 微调
        .add(new THREE.Vector3(0, 0, 0.1));

      this.reset2();
      animateCamera(
        cameraAnimForwardHome.startPos.clone(),
        cameraAnimForwardHome.startTarget.clone(),
        cameraAnimForwardHome.startLight.clone(),
        cameraAnimUd.endPos.clone(),
        cameraAnimUd.endTarget.clone(),
        cameraAnimUd.endLight.clone(),
        normalAnimDuration,
        this.camera,
        this.scene,
        light,
        this.renderer
        // singleBounce
      );
    },
    $nextTick(callback) {
      wx.nextTick(callback);
    },
    transformHomeNotLr(showSwingDegreeTipsTimeout) {
      let startPos;
      this.currentTransformType = "ud";
      this.setData({
        swingDegreeTipsTransitionName: "fade-slide-x",
        swingFixDegreeTipsTransitionName: "fade-slide-x",
      });
      this.$nextTick(() => {
        this.setData({
          showSwingDegreeTab: true,
        });
        this.seeUd();
        this.setData({
          "switchObj.show": false,
          "upPanel.show": false,
          showSwingDegreeTips: false,
          showFixDegreeTips: false,
        });

        startPos = swingRangeShapeInitPosUd.clone();
        startPos.y += swingRangeShapeInitPosUdOffset;
        animateObject(
          this.swingRangeShape,
          startPos.clone(),
          swingRangeShapeInitPosUd.clone(),
          0,
          1,
          normalAnimDuration
        );
      });
      this.setCameraAnimUdAndAnimateInHomeNotLr();
      setTimeout(() => {
        this.setData({
          showUdDegreeTips: true,
        });
      }, showSwingDegreeTipsTimeout);
    },
    transformHomeLrNotSwinging(showSwingDegreeTipsTimeout, cameraAnimNow) {
      this.seeSwingRange();
      this.setData({
        showSwingDegreeTab: true,
      });

      cameraAnimSwingOff.pos = cameraAnimForwardHome.endPos.clone();
      // .add(new THREE.Vector3(1.50636, 0.921639, -2.25001 * -1))
      // .sub(new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1))
      // // 微调
      // .add(new THREE.Vector3(0.1, 0, 0.1))
      cameraAnimSwingOff.target = cameraAnimForwardHome.endTarget.clone();
      // cameraAnimSwingOff.target.x -= 0.05
      cameraAnimSwingOff.light = cameraAnimForwardHome.endLight.clone();

      animateCamera(
        cameraAnimNow.pos.clone(),
        cameraAnimNow.target.clone(),
        cameraAnimNow.light.clone(),
        cameraAnimSwingOff.pos.clone(),
        cameraAnimSwingOff.target.clone(),
        cameraAnimSwingOff.light.clone(),
        normalAnimDuration,
        this.camera,
        this.scene,
        light,
        this.renderer,
        cameraAnimNow.type == "ud" ? this.cameraAnimUdScaleFunc : null
      );

      let startPos = swingRangeShapeInitPos.clone();
      startPos.y += swingRangeShapeInitPosOffset;
      animateObject(
        this.swingRangeShape,
        startPos.clone(),
        swingRangeShapeInitPos.clone(),
        0,
        1,
        normalAnimDuration
      );
      setTimeout(() => {
        this.setData({
          showFixDegreeTips: true,
        });
      }, showSwingDegreeTipsTimeout);
      setTimeout(() => {
        this.setData({
          "switchObj.show": true,
        });
      }, 300);
    },
    transformHomeLr(lastTransformType, showSwingDegreeTipsTimeout) {
      this.setData({
        showUdDegreeTips: false,
      });
      let cameraAnimNow = {
        pos: cameraAnimForwardHome.startPos,
        target: cameraAnimForwardHome.startTarget,
        light: cameraAnimForwardHome.startLight,
      };
      if (lastTransformType === "ud") {
        cameraAnimNow = {
          pos: cameraAnimUd.endPos,
          target: cameraAnimUd.endTarget,
          light: cameraAnimUd.endLight,
          type: "ud",
        };
      }
      console.log("isLrSwinging", this.isLrSwinging);
      console.log("isLrFocus", this.isLrFocus);
      if (this.isLrSwinging) {
        this.transformHomeLrSwinging(showSwingDegreeTipsTimeout, cameraAnimNow);
      } else {
        this.transformHomeLrNotSwinging(
          showSwingDegreeTipsTimeout,
          cameraAnimNow
        );
      }
    },
    transformHome(lastTransformType, type) {
      // home是web收缩到web展开的切换，web展开可能是在左右tab或上下tab，所以home最终可能会是类似于swingOn/swingOff/ud的状态

      // homeBack，其实是处理homeBack=>swingOn/swingOff/ud
      // ud=>home，其实是处理ud=>swingOn/swingOff
      // swingOn=>home，其实是处理swingOn=>swingOff/ud
      // swingOff=>home，其实是处理swingOff=>swingOn/ud
      if (
        this.statusData.power == "on" &&
        (lastTransformType == "homeBack" ||
          lastTransformType == null ||
          lastTransformType == "ud")
      ) {
        let showSwingDegreeTipsTimeout = 600;
        if (lastTransformType === "ud") {
          showSwingDegreeTipsTimeout = 0;
          this.reset();
          this.reset2();
          this.setData({
            "upPanel.show": false,
            swingDegreeTipsTransitionName: "fade-slide-x",
            swingFixDegreeTipsTransitionName: "fade-slide-x",
          });
        }
        if (lastTransformType == "homeBack") {
          this.setData({
            swingDegreeTipsTransitionName: "fade-slide-y",
            swingFixDegreeTipsTransitionName: "fade-slide-y",
            udDegreeTipsTransitionName: "fade-slide-y",
          });
        }
        this.currentTransformType = type;
        this.setData({
          transforming: true,
        });
        if (this.activeTab === "lr") {
          this.transformHomeLr(lastTransformType, showSwingDegreeTipsTimeout);
        } else {
          this.transformHomeNotLr(showSwingDegreeTipsTimeout);
        }
        // TODO
        // this.modelMaskStyleObj.height = pxToRem(400);
        this.setData({
          "modelMaskStyleObj.height": pxToRem(400),
        });
      }
    },
    transform(type) {
      if (!this.camera) return;
      if (this.transforming) return;
      // console.log('statusData', this.statusData)
      // console.log('type', type)
      let lastTransformType = this.currentTransformType;
      // console.log('lastTransformType', lastTransformType)

      this.setData({
        swingDegreeTipsTransitionName: "fade-slide-y",
        swingFixDegreeTipsTransitionName: "fade-slide-y-fix",
        udDegreeTipsTransitionName: "fade-slide-ud",
      });
      switch (type) {
        case "ud":
          this.transformUd(lastTransformType, type);
          break;
        case "home":
          this.transformHome(lastTransformType, type);
          break;
        case "homeBack":
          this.transformHomeBack(lastTransformType, type);
          break;
        case "swingOff":
          this.transformSwingOff(lastTransformType, type);
          break;
        case "swingOn":
          this.transformSwingOn(lastTransformType, type);
          break;
        case "look":
          if (lastTransformType != "homeBack" && lastTransformType != null)
            break;
          this.transformLook(type);
          break;
        case "homeBackOff":
          this.transformHomeBackOff(lastTransformType, type);
          break;
      }
      setTimeout(() => {
        this.setData({
          transforming: false,
        });
      }, normalAnimDuration + 500);
    },
    resetLrDegAnim() {
      // 复位
      if (Math.abs(lrDeg) > 0.01) {
        const up = -(Math.PI / 180) * (1.2 * 100 - 60);
        const down = -(Math.PI / 180) * (1.2 * 0 - 60);
        lrDeg = Math.min(down, Math.max(up, lrDeg + lrSpeed * lrDirectionFlag));
        if (lrDeg <= up) lrDirectionFlag = 1;
        else if (lrDeg >= down) lrDirectionFlag = -1;
      } else {
        lrDeg = 0;
      }
    },
    resetUdDegAnim() {
      // 复位
      if (Math.abs(udDeg) > 0.01) {
        if (udDeg >= 0) udDirectionFlag = -1;
        else if (udDeg <= 0) udDirectionFlag = 1;
        udDeg = udDeg + upDownSpeed * udDirectionFlag;
      } else {
        udDeg = 0;
      }
    },
    tryTellThreeLoaded() {
      if (this.threeLoaded) {
        this.postDataToWeex({
          type: "threeLoaded",
        });
      }
    },
    updateLrGroup() {
      if (!this.lrGroup) return;
      calMatrix.copy(lrGroupMatrix);
      calMatrix.multiply(calMatrix_1.identity().makeRotationY(lrDeg));
      this.lrGroup.matrix.copy(calMatrix);
    },
    updateUpDownGroup() {
      if (!this.upDownGroup) return;
      // 初始矩阵
      calMatrix.copy(upDownGroupMatrix);
      // 绕自身x轴旋转
      calMatrix.multiply(calMatrix_1.identity().makeRotationX(udDeg));
      // 绕原来y轴旋转
      calMatrix.multiply(
        calMatrix_1
          .identity()
          .makeRotationFromQuaternion(
            calQuaternion
              .identity()
              .setFromAxisAngle(
                calVector
                  .set(0, 1, 0)
                  .applyAxisAngle(calVector_1.set(1, 0, 0), -udDeg),
                lrDeg
              )
          )
      );
      // 应用matrix
      this.upDownGroup.matrix.copy(calMatrix);
    },
    updateFanLeafGroup() {
      if (!this.fanLeafGroup) return;
      // 在初始矩阵基础上进行变换
      calMatrix.copy(fanLeafGroupMatrix);
      // 绕自身x轴旋转
      calMatrix.multiply(calMatrix_1.identity().makeRotationX(udDeg));
      // 绕原来y轴旋转
      calMatrix.multiply(
        calMatrix_1
          .identity()
          .makeRotationFromQuaternion(
            calQuaternion
              .identity()
              .setFromAxisAngle(
                calVector
                  .set(0, 1, 0)
                  .applyAxisAngle(calVector_1.set(1, 0, 0), -udDeg),
                lrDeg
              )
          )
      );
      // 绕自身z轴旋转
      calMatrix.multiply(calMatrix_1.identity().makeRotationZ(fanLeafRotation));
      // 将变换后的矩阵应用到Group，下一次渲染后界面更新
      this.fanLeafGroup.matrix.copy(calMatrix);
    },
    animateUpdate() {
      // #region 美居插件端数据与模型组件绑定
      this.updateLrGroup();

      this.updateUpDownGroup();

      this.updateFanLeafGroup();
      // #endregion

      const that = this;
      requestAnimationFrame(() => {
        that.animateUpdate();
      });
    },
    calLrDeg() {
      if (this.statusData.power == "off") {
        this.resetLrDegAnim();
        return;
      }
      if (this.currentTransformType == "ud") {
        lrDeg = 0;
        return;
      }
      if (this.seeingSwingRange) {
        lrDeg =
          -(Math.PI / 180) *
          (1.2 * this.swingChangeSettingObj.target_angle - 60);
      } else if (this.seeingSwingRange2) {
        const up =
          -(Math.PI / 180) *
          (1.2 * this.swingChangeSettingObj.lr_diy_up_percent - 60);
        const down =
          -(Math.PI / 180) *
          (1.2 * this.swingChangeSettingObj.lr_diy_down_percent - 60);
        lrDeg = Math.min(down, Math.max(up, lrDeg + lrSpeed * lrDirectionFlag));
        if (lrDeg <= up) lrDirectionFlag = 1;
        else if (lrDeg >= down) lrDirectionFlag = -1;
      } else {
        if (this.isLrSwinging) {
          const up =
            -(Math.PI / 180) * (1.2 * this.statusData.lr_diy_up_percent - 60);
          const down =
            -(Math.PI / 180) * (1.2 * this.statusData.lr_diy_down_percent - 60);
          lrDeg = Math.min(
            down,
            Math.max(up, lrDeg + lrSpeed * lrDirectionFlag)
          );
          if (lrDeg <= up) lrDirectionFlag = 1;
          else if (lrDeg >= down) lrDirectionFlag = -1;
        } else if (this.isLrFocus) {
          lrDeg = -(Math.PI / 180) * (1.2 * this.statusData.target_angle - 60);
        } else {
          // lrDeg = 0
        }
      }
    },
    calUdDeg() {
      if (this.statusData.power == "off") {
        this.resetUdDegAnim();
        return;
      }
      if (this.seeingSwingRange) {
        udDeg = 0;
        return;
      }
      if (this.seeingSwingRange2) {
        udDeg = 0;
        return;
      }
      if (
        this.statusData.power == "on" &&
        (this.statusData.swing_direction == "ud" ||
          this.statusData.swing_direction == "udlr")
      ) {
        const range = ((Math.PI / 180) * this.statusData.ud_swing_angle) / 2;
        if (range != 0) {
          udDeg = Math.max(
            -range,
            Math.min(range, udDeg + upDownSpeed * udDirectionFlag)
          );
          if (udDeg >= range) udDirectionFlag = -1;
          else if (udDeg <= -range) udDirectionFlag = 1;
        }
      } else {
        // udDeg = 0
      }
    },
    calFanLeafRotation(delta) {
      if (this.statusData.power == "on" && this.statusData.gear) {
        // 扇叶绕z轴旋转
        fanLeafRotation +=
          fanLeafRotateSpeed * this.statusData.gear * Math.PI * 2 * delta;
      }
    },
    animateCal() {
      // 获取帧间隔时间
      const delta = this.clockCal.getDelta();

      // #region 美居插件端数据与模型组件绑定
      this.calFanLeafRotation(delta);

      this.calUdDeg();

      this.calLrDeg();
      // #endregion

      const that = this;
      requestAnimationFrame(() => {
        that.animateCal();
      });
    },
    // 循环渲染
    animate() {
      //requestAnimationFrame循环调用的函数中调用方法update(),来刷新时间
      this.stats && this.stats.update();
      // 获取帧间隔时间
      const delta = this.clock.getDelta();

      const that = this;
      requestAnimationFrame(() => {
        that.animate();
      });

      if (debugObj.fps) {
        if (delta > 0) {
          // 增加帧数计数器
          fpsCount++;
          // 根据帧间隔时间计算FPS
          fpsTotal += Math.round(1 / delta);
          if (fpsCount == 60) {
            // 计算平均FPS
            this.fps = Math.round(fpsTotal / 60);
            this.postDataToWeex({
              type: "fpsUpdate",
              value: this.fps,
            });
            // 如果平均FPS低于60，则输出警告信息
            if (this.fps < 50) console.warn("fps low " + this.fps);
            // 重置帧数计数器和FPS总数
            fpsCount = 0;
            fpsTotal = 0;
          }
        }
      }

      // 重新渲染场景并显示到H5页面中
      this.renderer.render(this.scene, this.camera);
    },
    convertColor(colorString) {
      // 移除井号并转换为小写
      colorString = colorString.replace("#", "").toLowerCase();
      // 将16进制字符串转换为整数
      return new THREE.Color(parseInt(colorString, 16));
    },
    // 初始化自定义外观，如果有的话
    initColor() {
      let color = localStorage.getItem(customColorKey) || "#FFFFFF";
      light.color = this.convertColor(color);
      // TODO
      // this.lookPanel.activeOption = color;
      this.setData({
        "lookPanel.activeOption": color,
      });
    },
    initLrGroup() {
      this.lrGroupObj = this.group.find((it) => it.desc == "左右摇柄");
      this.lrGroup = this.lrGroupObj.object_list;
      this.lrGroup.matrixAutoUpdate = false; // 禁用自动更新矩阵
      let offset = new THREE.Vector3(0, 0.8984388716086597, 0.1020891151791681);
      this.changePivot(offset, this.lrGroup);
      this.lrGroup.updateMatrix();
      lrGroupMatrix.copy(this.lrGroup.matrix);
    },
    initUpDownGroup() {
      this.upDownGroupObj = this.group.find(
        (it) => it.desc == "上下摇头除去扇叶"
      );
      this.upDownGroup = this.upDownGroupObj.object_list;
      this.upDownGroup.matrixAutoUpdate = false; // 禁用自动更新矩阵
      let offset = new THREE.Vector3(
        0.0002563020907130481,
        0.8984388716086597,
        0.1061891151791681
      );
      this.changePivot(offset, this.upDownGroup);
      this.upDownGroup.updateMatrix();
      upDownGroupMatrix.copy(this.upDownGroup.matrix);
    },
    changePivot(offset, group) {
      group.position.set(
        group.position.x + offset.x,
        group.position.y + offset.y,
        group.position.z + offset.z
      );
      group.children.forEach((child) => {
        child.position.set(
          child.position.x - offset.x,
          child.position.y - offset.y,
          child.position.z - offset.z
        );
      });
    },
    initFanLeafGroup() {
      this.fanLeafGroup = this.group.find(
        (it) => it.desc == "扇叶"
      ).object_list;
      this.fanLeafGroup.matrixAutoUpdate = false; // 禁用自动更新矩阵
      let offset = new THREE.Vector3(
        0.0002563020907130481,
        0.8979188716086597,
        0.1228891151791681
      );
      this.changePivot(offset, this.fanLeafGroup);
      this.fanLeafGroup.updateMatrix();

      // let geometry = new THREE.SphereGeometry(0.01, 32, 16)
      // const material = new THREE.MeshBasicMaterial({
      //   color: 0xffff00,
      //   transparent: true,
      //   opacity: 0,
      // })
      // particleCenterSphere = new THREE.Mesh(geometry, material)
      // geometry = geometry.clone()
      // particleNormalSphere = new THREE.Mesh(geometry, material)
      // particleNormalSphere.position.z = particleNormalSphere.position.z + 0.4
      // this.fanLeafGroup.add(particleCenterSphere)
      // this.fanLeafGroup.add(particleNormalSphere)

      fanLeafGroupMatrix.copy(this.fanLeafGroup.matrix);
    },
    readGroup() {
      let children = [];
      // 遍历模型的每个子对象，将其添加到children数组中
      this.model.traverse((child) => {
        children.push(child);
      });
      // console.log(JSON.stringify(children.map((it) => it.name)))
      console.log("原有对象数目", children.length);
      this.group.forEach((g) => {
        if (g.desc === "invisible") {
          // console.log(JSON.stringify(g.name_list))
          g.name_list.forEach((name) => {
            let o = children.find((it) => it.name == name);
            if (o) {
              o.visible = false;
            }
          });
        } else {
          if (!g["object_list"]) {
            g["object_list"] = new THREE.Group();
          }
          // 按照JSON的分组信息，将相应的对象添加到一个Group对象中
          g.name_list.forEach((name) => {
            let o = children.find((it) => it.name == name);
            if (o) {
              g["object_list"].add(o);
            }
          });
          // 将分组添加到场景
          this.scene.add(g["object_list"]);
        }
      });
      let count = 0;
      this.scene.traverse((child) => {
        if (child.visible) count++;
      });
      console.log("隐藏后可见对象数目", count);
    },
    /**
     * 使用模型里的灯光作为灯光
     */
    initLightInModel(child) {
      console.log("initLightInModel", child);

      // 与摄像机解绑，拉到与摄像机统一层级，方便控制
      child.removeFromParent();
      this.scene.add(child);

      // 数据来自blender文件
      const localV = new THREE.Vector3(-1.02732, 1.1113, -1.48945 * -1);
      const cV = new THREE.Vector3(2.18837, 0.69065, -2.23247 * -1);
      const reV = localV.add(cV);
      child.position.set(reV.x, reV.y, reV.z);

      // 让灯光照着摄像机的目标方向
      child.lookAt(cameraInitTarget);

      // 手动调
      // The light's luminous intensity measured in candela (cd). Default is 1.
      child.intensity = 3;
      // this.scene.add(child)
      light = child;

      // 初始化
      {
        cameraAnimForwardHome.startLight = light.position.clone();
        // 先保持跟相机相对静止
        cameraAnimForwardHome.endLight = cameraAnimForwardHome.endPos
          .clone()
          .add(
            cameraAnimForwardHome.startLight
              .clone()
              .sub(cameraAnimForwardHome.startPos)
          );
      }

      if (debugObj.light) {
        const sphereSize = 1;
        const pointLightHelper = new THREE.PointLightHelper(
          child,
          sphereSize,
          0xff0000
        );
        this.scene.add(pointLightHelper);
      }
    },
    /**
     * 使用模型里的相机作为场景的相机
     */
    initCameraInModel(child) {
      const aspectRatio = window.innerWidth / window.innerHeight;
      console.log("initCameraInModel", child);
      // 删除现有camera
      if (this.camera) this.camera.removeFromParent();

      const camera = child;
      camera.far = 39;
      // 手动调
      camera.fov += 5;
      camera.position.y -= 0.1;
      // 来自blender
      // camera.position.set(2.18837, 0.69065, -2.23247 * -1)
      // camera.lookAt(camera.position.x,-1,camera.position.z)
      // rotateObjectLocal(camera, 'X', -95.8632/180*Math.PI)
      // rotateObjectLocal(camera, 'Z', 180.017/180*Math.PI*-1)
      // rotateObjectLocal(camera, 'Y', 226.09/180*Math.PI)
      // Camera frustum aspect ratio, usually the canvas width / canvas height
      camera.aspect = aspectRatio;
      this.camera = camera;

      // 初始化
      {
        if (this.statusData.power == "off") {
          cameraInitPos = cameraInitPosOff.clone();
          cameraInitTarget = cameraInitTargetOff.clone();
        } else {
          cameraInitPos = cameraInitPosOn.clone();
          cameraInitTarget = cameraInitTargetOn.clone();
        }
        this.camera.position.copy(cameraInitPos);
        this.camera.lookAt(cameraInitTarget);

        cameraAnimForwardHome.startPos = cameraInitPosOn.clone();
        cameraAnimForwardHome.endPos = cameraInitPosOff
          .clone()
          .add(
            new THREE.Vector3(0.077583, 0.694439, -2.74864 * -1).sub(
              new THREE.Vector3(2.18837, 0.69065, -2.23247 * -1)
            )
          );
        let y = 0.6;
        cameraAnimForwardHome.endPos.x = 0;
        cameraAnimForwardHome.endPos.y = y;
        cameraAnimForwardHome.endPos.z -= 0.4;
        cameraAnimForwardHome.startTarget = cameraInitTargetOn.clone();
        cameraAnimForwardHome.endTarget = new THREE.Vector3(0, y, 0);
      }

      // Updates the camera projection matrix. Must be called after any change of parameters.
      this.camera.updateProjectionMatrix();
    },
    showLoading(message) {
      wx.showLoading({ title: message });
    },
    hideLoading() {
      wx.hideLoading();
    },
    // 加载模型
    loadModel() {
      this.showLoading("加载模型中");

      // 创建GLTFLoader实例，用于加载和解析glTF/glb格式的3D模型
      const loaderGLB = new GLTFLoader();
      MeshoptDecoder.setWasmPath("/decoder_base.wasm");
      // 设置MeshoptDecoder用于解码通过Meshopt压缩后的模型数据
      loaderGLB.setMeshoptDecoder(MeshoptDecoder);
      // 加载家电产品的模型文件
      loaderGLB.load(
        // './assets/models/0xFA/GDG24FG_decimate.glb',
        "https://ce-cdn.midea.com/activity/sit/3D/models/0xFA/GDG24FG_decimate.glb",
        (obj) => {
          const that = this;
          wx.request({
            url: "https://ce-cdn.midea.com/activity/sit/3D/models/0xFA/group.json", // 请替换为实际的 URL
            success: function (res) {
              that.group = res.data;

              that.model = obj.scene;
              // 将模型文件添加到场景中
              that.scene.add(that.model);

              that.initCameraInModel(that.scene.getObjectByName("摄像机"));
              that.initLightInModel(that.scene.getObjectByName("点光"));

              // 所有对象
              that.readGroup();
              // 具体业务代码
              that.initFanLeafGroup();
              that.initUpDownGroup();
              that.initLrGroup();

              that.initColor();
              // 具体业务代码

              that.animate();
              that.animateCal();
              that.animateUpdate();

              let endTime = new Date().getTime();
              console.log("加载时间: ", (endTime - that.startTime) / 1000);
              that.debugText = `加载时间: <br>${
                (endTime - that.startTime) / 1000
              }秒`;
              that.hideLoading();
              that.threeLoaded = true;
              that.tryTellThreeLoaded();
            },
          });
        },
        (event) => {
          // 监听进度
          let totalSize = event.total;
          let loadedSize = event.loaded;
          let percent = ((loadedSize / totalSize) * 100).toFixed(2) + "%";
          this.loadingOptions.text = "加载模型中(" + percent + ")";
          if (percent === "100.00%") {
            this.loadingOptions.text = "正在创建场景";
          }
        },
        (error) => {
          console.error(error);
        }
      );
    },
    onWindowResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
    },
    initRender() {
      this.renderer = new THREE.WebGL1Renderer({
        alpha: true, // 支持透明度，意味着你可以在场景中使用半透明的材质或纹理
        antialias: true, // 启用抗锯齿功能，使渲染的边缘更平滑，减少锯齿状的边缘
      });
    },
    // 状态更新
    updateStatus(statusData) {
      this.debugText = JSON.stringify(
        {
          // power: statusData.power,
          swing_direction: statusData.swing_direction,
          ud_swing_angle: statusData.ud_swing_angle,
          swing: statusData.swing,
          swing_angle: statusData.swing_angle,
          display_left_angle: statusData.display_left_angle,
          lr_diy_down_percent: statusData.lr_diy_down_percent,
          lr_diy_up_percent: statusData.lr_diy_up_percent,
          lr_diy_swing: statusData.lr_diy_swing,
          target_angle: statusData.target_angle,
          // gear: statusData.gear,
        },
        null,
        2
      );
      if (statusData.display_left_angle == 255) {
        statusData.display_left_angle = statusData.swing_angle;
      }
      // this.statusData = statusData;
      this.setData({
        statusData: statusData,
      });
    },
    threeMounted(canvas) {
      this.clock = new THREE.Clock();
      this.clockCal = new THREE.Clock();
      this.startTime = new Date().getTime();
      this.currentTransformType = null;
      this.setData({
        activeTab: "lr",
      });

      const platform = new screenshot.WechatPlatform(canvas);
      this.platform = platform;
      platform.enableDeviceOrientation("game").catch((err) => {
        console.log("enableDeviceOrientation err", err);
      });
      three.PlatformManager.set(platform);
      window = three.PlatformManager.polyfill.window;
      window.innerWidth = canvas.width;
      window.innerHeight = canvas.height;
      requestAnimationFrame =
        three.PlatformManager.polyfill.requestAnimationFrame;

      console.log(
        three.PlatformManager.polyfill.window.innerWidth,
        three.PlatformManager.polyfill.window.innerHeight
      );

      // 右上角多了一个交互界面，GUI本质上就是一个前端js库
      //   this.createGUI();

      // 双向通信
      //   this.getWeexData();

      // 创建场景
      this.scene = new THREE.Scene();
      // 初始化渲染器
      this.initRender();

      //创建stats对象
      // const stats = new Stats();
      // stats.domElement.style.position = "absolute";
      // stats.domElement.style.top = "0px";
      // stats.domElement.style.display = "none";
      // if (debugObj.stats) {
      //   stats.domElement.style.display = "block";
      // }
      // this.stats = stats;
      // //stats.domElement:web页面上输出计算结果,一个div元素，
      // document.body.appendChild(stats.domElement);

      // if (debugObj.axesHelper) {
      //   // AxesHelper：辅助观察的坐标系
      //   const axesHelper = new THREE.AxesHelper(1);
      //   this.scene.add(axesHelper);
      // }

      this.renderer.setSize(window.innerWidth, window.innerHeight);
      // 根据设备的像素比例来设置渲染器的像素比例，以获得更清晰的图像显示效果
      this.renderer.setPixelRatio(window.devicePixelRatio);

      // this.container = document.getElementById("container");
      // this.container.appendChild(this.renderer.domElement);

      this.loadModel();

      // this.initOrbitControls();

      if (debugObj.mockStatus) {
        this.updateStatus(debugObj.mockStatusObj);
      }

      window.addEventListener("resize", this.onWindowResize);
    },
  },
  observers: {
    activeUdOption(newVal) {
      let oldVal = this.activeUdOption;
      this.activeUdOption = newVal;
      if (this.activeTab == "ud") {
        // 动画
        this.animateUdShape(oldVal, newVal);
      }
    },
    tips: function (tips) {
      this.setData({
        tipsFirstChar: tips.substring(0, 1),
        tipsRestOfTips: tips.substring(1),
      });
    },
    "lookPanel.**": function (lookPanel) {
      this.lookPanel = lookPanel;
    },
    "upPanel.**": function (upPanel) {
      this.upPanel = upPanel;
    },
    "switchObj.**": function (switchObj) {
      this.switchObj = switchObj;
    },
    activeTab: function (activeTab) {
      this.activeTab = activeTab;
    },
    transforming: function (transforming) {
      this.transforming = transforming;
    },
    isLrSwinging: function (isLrSwinging) {
      this.isLrSwinging = isLrSwinging;
      this.updateSwitchObj();
      if (this.activeTab == "lr") {
        if (!isLrSwinging) {
          // 从到开关
          this.transform("swingOff");
        } else {
          this.transform("swingOn");
        }
      }
    },
    isLrFocus: function (isLrFocus) {
      this.isLrFocus = isLrFocus;
      this.updateSwitchObj();
    },
    "statusData.**": function (statusData) {
      this.statusData = statusData;

      let isLrSwinging =
        statusData.power == "on" &&
        statusData.swing == "on" &&
        (statusData.swing_direction == "lr" ||
          statusData.swing_direction == "udlr");
      this.setData({
        isLrSwinging,
        isLrFocus: statusData.power == "on" && !isLrSwinging,
      });
      if (this.swingChangeSettingObj) {
        this.swingChangeSettingObj.ud_swing_angle = statusData.ud_swing_angle;
        this.updateComputed();
      }
    },
  },
});
