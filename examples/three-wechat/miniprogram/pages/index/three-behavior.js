var THREE = require("../../chunks/three.js");
var three = THREE;
var screenshot = require("../../chunks/screenshot.js");
var window
var GLTFLoader = screenshot.GLTFLoader

// @ts-nocheck
// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2020, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)
var MeshoptDecoder = function(path1) {
  var setWasmPath = function setWasmPath(path) {
      WXWebAssembly.instantiate(path, {
      }).then(function(result) {
          instance = result.instance;
          instance.exports.__wasm_call_ctors();
          readyResolve();
      });
  };
  var decode = function decode(fun, target, count, size, source, filter) {
      var sbrk = instance.exports.sbrk;
      var count4 = count + 3 & ~3; // pad for SIMD filter
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
          throw new Error('Malformed buffer data: ' + res);
      }
  };
  // Built with clang version 11.0.0 (https://github.com/llvm/llvm-project.git 0160ad802e899c2922bc9b29564080c22eb0908c)
  // Built from meshoptimizer 0.14
  if (typeof WXWebAssembly !== 'object') {
      // This module requires WebAssembly to function
      return {
          supported: false
      };
  }
  var instance;
  var readyResolve;
  var promise = new Promise(function(resovle) {
      readyResolve = resovle;
  });
  var filters = {
      // legacy index-based enums for glTF
      0: '',
      1: 'meshopt_decodeFilterOct',
      2: 'meshopt_decodeFilterQuat',
      3: 'meshopt_decodeFilterExp',
      // string-based enums for glTF
      NONE: '',
      OCTAHEDRAL: 'meshopt_decodeFilterOct',
      QUATERNION: 'meshopt_decodeFilterQuat',
      EXPONENTIAL: 'meshopt_decodeFilterExp'
  };
  var decoders = {
      // legacy index-based enums for glTF
      0: 'meshopt_decodeVertexBuffer',
      1: 'meshopt_decodeIndexBuffer',
      2: 'meshopt_decodeIndexSequence',
      // string-based enums for glTF
      ATTRIBUTES: 'meshopt_decodeVertexBuffer',
      TRIANGLES: 'meshopt_decodeIndexBuffer',
      INDICES: 'meshopt_decodeIndexSequence'
  };
  return {
      setWasmPath: setWasmPath,
      ready: promise,
      supported: true,
      decodeVertexBuffer: function decodeVertexBuffer(target, count, size, source, filter) {
          decode(instance.exports.meshopt_decodeVertexBuffer, target, count, size, source, instance.exports[filters[filter]]);
      },
      decodeIndexBuffer: function decodeIndexBuffer(target, count, size, source) {
          decode(instance.exports.meshopt_decodeIndexBuffer, target, count, size, source);
      },
      decodeIndexSequence: function decodeIndexSequence(target, count, size, source) {
          decode(instance.exports.meshopt_decodeIndexSequence, target, count, size, source);
      },
      decodeGltfBuffer: function decodeGltfBuffer(target, count, size, source, mode, filter) {
          decode(instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
      }
  };
}();

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
  mockStatus: false,
  mockStatusObj: {
    power: 'on',
    gear: 1,
    ud_swing_angle: 60,
    // swing_direction: 'ud',
    swing_direction: 'ud',
    swing: 'off',
    // swing: 'off',
    lr_diy_swing: 'off',
    lr_diy_down_percent: 28,
    lr_diy_up_percent: 100,
    display_left_angle: 86,
    swing_angle: 60,
    target_angle: (30 / 120) * 100,
  },
}

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
  },
  attached: function () {},
  methods: {
    // 加载模型
    loadModel() {
      // this.showLoading('加载模型中')

      // 创建GLTFLoader实例，用于加载和解析glTF/glb格式的3D模型
      const loaderGLB = new GLTFLoader()
      MeshoptDecoder.setWasmPath('/decoder_base.wasm');
      // 设置MeshoptDecoder用于解码通过Meshopt压缩后的模型数据
      loaderGLB.setMeshoptDecoder(MeshoptDecoder)
      // 加载家电产品的模型文件
      loaderGLB.load(
        // './assets/models/0xFA/GDG24FG_decimate.glb',
        'https://ce-cdn.midea.com/activity/sit/3D/models/0xFA/GDG24FG_decimate.glb',
        (obj) => {
          this.model = obj.scene
          // 将模型文件添加到场景中
          this.scene.add(this.model)

          this.initCameraInModel(this.scene.getObjectByName('摄像机'))
          this.initLightInModel(this.scene.getObjectByName('点光'))

          // 所有对象
          this.readGroup()
          // 具体业务代码
          this.initFanLeafGroup()
          this.initUpDownGroup()
          this.initLrGroup()

          this.initColor()
          // 具体业务代码

          this.animate()
          this.animateCal()
          this.animateUpdate()

          let endTime = new Date().getTime()
          console.warn('加载时间: ', (endTime - this.startTime) / 1000)
          this.debugText = `加载时间: <br>${
            (endTime - this.startTime) / 1000
          }秒`
          this.hideLoading()
          this.threeLoaded = true
          this.tryTellThreeLoaded()
        },
        (event) => {
          // 监听进度
          let totalSize = event.total
          let loadedSize = event.loaded
          let percent = ((loadedSize / totalSize) * 100).toFixed(2) + '%'
          this.loadingOptions.text = '加载模型中(' + percent + ')'
          if (percent === '100.00%') {
            this.loadingOptions.text = '正在创建场景'
          }
        },
        (error) => {
          console.error(error)
        }
      )
    },
    onWindowResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()

      this.renderer.setSize(window.innerWidth, window.innerHeight)
    },
    initRender() {
      this.renderer = new THREE.WebGL1Renderer({
        alpha: true, // 支持透明度，意味着你可以在场景中使用半透明的材质或纹理
        antialias: true, // 启用抗锯齿功能，使渲染的边缘更平滑，减少锯齿状的边缘
      });
    },
    threeMounted(canvas) {
      const platform = new screenshot.WechatPlatform(canvas);
      this.platform = platform;
      platform.enableDeviceOrientation("game");
      three.PlatformManager.set(platform);
      window = three.PlatformManager.polyfill.window

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

      // if (debugObj.mockStatus) {
      //   this.updateStatus(debugObj.mockStatusObj);
      // }

      window.addEventListener("resize", this.onWindowResize);
    },
  },
});
