var THREE = require("../../chunks/three.js");
var three = THREE;
var screenshot = require("../../chunks/screenshot.js");
var window;
var GLTFLoader = screenshot.GLTFLoader;

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

let cameraInitPos;
let cameraInitPosOn = new THREE.Vector3(0, 0.6, 3.6);
let cameraInitTargetOn = new THREE.Vector3(0, 0.23568405126528758, 0);
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
    scene: null,
    renderer: null,
    platform: null,
    model: null,
    group: null,
  },
  attached: function () {},
  methods: {
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
      child.intensity *= 80;
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
          const that = this
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
              console.warn("加载时间: ", (endTime - that.startTime) / 1000);
              that.debugText = `加载时间: <br>${
                (endTime - this.startTime) / 1000
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
      const platform = new screenshot.WechatPlatform(canvas);
      this.platform = platform;
      platform.enableDeviceOrientation("game");
      three.PlatformManager.set(platform);
      window = three.PlatformManager.polyfill.window;

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
