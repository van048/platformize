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

// 本地保存自定义外观的key
let customColorKey = "GDG24FG_customColor";

// transform
let cameraAnimUd = {
  endPos: null,
  endTarget: null,
  endLight: new THREE.Vector3(0, 0.6, 4).add(new THREE.Vector3(2.93, 0, -1.49)),
};
let normalAnimDuration = ((1000 / 24) * 20) / 1.5;
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

// 调试开关
const debugObj = {
  gui: false,
  fps: false,
  text: false,
  // stats: isDebug() ? true : false,
  cone: false,
  axesHelper: false,
  light: false,
  // mockStatus: isPC(),
  mockStatus: true,
  mockStatusObj: {
    power: "on",
    gear: 1,
    ud_swing_angle: 60,
    // swing_direction: 'ud',
    swing_direction: "ud",
    swing: "off",
    // swing: 'off',
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
  },
  attached: function () {},
  methods: {
    createCurrentRangePlane(r, up, down) {
      const geometry = new THREE.CircleGeometry(r, 32, down, up - down);

      //纹理贴图加载器TextureLoader
      const texLoader = new THREE.TextureLoader();
      // .load()方法加载图像，返回一个纹理对象Texture
      // const texture = texLoader.load("./assets/textures/range_1.png?v=2");
      const texture = texLoader.load(
        "https://ce-cdn.midea.com/activity/sit/3D/textures/range_1.png"
      );
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
      this.swingDegreeTipsTransitionName = "fade-slide-x";
      this.swingFixDegreeTipsTransitionName = "fade-slide-x";
      this.$nextTick(() => {
        this.showSwingDegreeTab = true;
        this.seeUd();
        this.showSwingDegreeTips = false;
        this.showFixDegreeTips = false;
        this.switchObj.show = false;
        this.upPanel.show = true;

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
        this.showUdDegreeTips = true;
      }, showSwingDegreeTipsTimeout);
    },
    transformHome(lastTransformType, type) {
      // home是web收缩到web展开的切换，web展开可能是在左右tab或上下tab，所以home最终可能会是类似于swingOn/swingOff/ud的状态

      // homeBack，其实是处理homeBack=>swingOn/swingOff/ud
      // ud=>home，其实是处理ud=>swingOn/swingOff
      // swingOn=>home，其实是处理swingOn=>swingOff/ud
      // swingOff=>home，其实是处理swingOff=>swingOn/ud
      if (
        lastTransformType == "homeBack" ||
        lastTransformType == null ||
        lastTransformType == "ud"
      ) {
        let showSwingDegreeTipsTimeout = 600;
        if (lastTransformType === "ud") {
          this.swingDegreeTipsTransitionName = "fade-slide-x";
          this.swingFixDegreeTipsTransitionName = "fade-slide-x";
          showSwingDegreeTipsTimeout = 0;
          this.reset();
          this.reset2();
          this.upPanel.show = false;
        }
        if (lastTransformType == "homeBack") {
          this.udDegreeTipsTransitionName = "fade-slide-y";
          this.swingDegreeTipsTransitionName = "fade-slide-y";
          this.swingFixDegreeTipsTransitionName = "fade-slide-y";
        }
        this.currentTransformType = type;
        this.transforming = true;
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

      this.swingDegreeTipsTransitionName = "fade-slide-y";
      this.swingFixDegreeTipsTransitionName = "fade-slide-y-fix";
      this.udDegreeTipsTransitionName = "fade-slide-ud";
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
        this.transforming = false;
      }, normalAnimDuration + 500);
    },
    test() {
      this.transform("home");
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
        // this.postDataToWeex({
        //   type: 'threeLoaded',
        // })
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
            // this.postDataToWeex({
            //   type: 'fpsUpdate',
            //   value: this.fps,
            // })
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
      // TODO
      this.lookPanel = this.data.lookPanel;

      let color = localStorage.getItem(customColorKey) || "#FFFFFF";
      light.color = this.convertColor(color);
      this.lookPanel.activeOption = color;
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
      // const aspectRatio = window.innerWidth / window.innerHeight;
      const aspectRatio = 750 / 1280;
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
      this.statusData = statusData;
    },
    threeMounted(canvas) {
      this.clock = new THREE.Clock();
      this.clockCal = new THREE.Clock();
      this.startTime = new Date().getTime();

      const platform = new screenshot.WechatPlatform(canvas);
      this.platform = platform;
      platform.enableDeviceOrientation("game").catch((err) => {
        console.log("enableDeviceOrientation err", err);
      });
      three.PlatformManager.set(platform);
      window = three.PlatformManager.polyfill.window;
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
});
