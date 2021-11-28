/// <reference types="wechat-miniprogram" />
/// <reference types="offscreencanvas" />

import URL from '../base/URL';
import Blob from '../base/Blob';
import atob from '../base/atob';
import EventTarget, { Touch, TouchEvent } from '../base/EventTarget';
import $XMLHttpRequest from './XMLHttpRequest';
import copyProperties from '../base/utils/copyProperties';
import DOMParser from '../base/DOMParser';
import TextDecoder from '../base/TextDecoder';
import { Platform, Polyfill } from '../Platform';

function OffscreenCanvas() {
  // @ts-ignore
  return wx.createOffscreenCanvas();
}

export class WechatPlatform extends Platform {
  polyfill: Polyfill;
  canvas: WechatMiniprogram.Canvas & EventTarget;
  canvasW: number;
  canvasH: number;
  onDeviceMotionChange: (e: any) => void;
  enabledDeviceMotion: boolean = false;

  constructor(canvas: WechatMiniprogram.Canvas, width?: number, height?: number) {
    super();
    const systemInfo = wx.getSystemInfoSync();
    const isAndroid = systemInfo.platform === 'android';

    // @ts-ignore
    this.canvas = canvas;
    this.canvasW = width === undefined ? canvas.width : width;
    this.canvasH = height === undefined ? canvas.height : height;

    const document = {
      createElementNS(_: string, type: string) {
        if (type === 'canvas') return canvas;
        if (type === 'img') return canvas.createImage();
      },
    } as unknown as Document;

    const $URL = new URL()

    const window = {
      innerWidth: systemInfo.windowWidth,
      innerHeight: systemInfo.windowHeight,
      devicePixelRatio: systemInfo.pixelRatio,

      AudioContext: function () {},
      requestAnimationFrame: this.canvas.requestAnimationFrame,
      cancelAnimationFrame: this.canvas.cancelAnimationFrame,
      DeviceOrientationEvent: {
        requestPermission() {
          return Promise.resolve('granted');
        },
      },

      URL: $URL,
      DOMParser,
      TextDecoder,
    } as unknown as Window;

    [canvas, document, window].forEach(i => {
      // @ts-ignore
      const old = i.__proto__;
      // @ts-ignore
      i.__proto__ = {};
      // @ts-ignore
      i.__proto__.__proto__ = old;
      // @ts-ignore
      copyProperties(i.__proto__, EventTarget.prototype);
    });

    this.polyfill = {
      // @ts-expect-error
      Blob,
      window,
      document,
      // @ts-expect-error
      DOMParser,
      // @ts-expect-error
      TextDecoder,
      // @ts-expect-error
      XMLHttpRequest: $XMLHttpRequest,
      // @ts-expect-error
      OffscreenCanvas,
      // @ts-expect-error
      URL: $URL,

      atob,
      createImageBitmap: undefined,
      cancelAnimationFrame: window.cancelAnimationFrame,
      requestAnimationFrame: window.requestAnimationFrame,
    };

    this.patchCanvas();
    this.onDeviceMotionChange = e => {
      e.type = 'deviceorientation';
      if (isAndroid) {
        e.alpha *= -1;
        e.beta *= -1;
        e.gamma *= -1;
      }
      window.dispatchEvent(e);
    };
  }

  patchCanvas() {
    const { canvasH, canvasW } = this;

    Object.defineProperty(this.canvas, 'style', {
      get() {
        return {
          width: this.width + 'px',
          height: this.height + 'px',
        };
      },
    });

    Object.defineProperty(this.canvas, 'clientHeight', {
      get() {
        return canvasH || this.height;
      },
    });

    Object.defineProperty(this.canvas, 'clientWidth', {
      get() {
        return canvasW || this.width;
      },
    });

    // @ts-ignore
    this.canvas.ownerDocument = this.document;
  }

  // 某些情况下IOS会不success不触发。。。
  patchXHR() {
    $XMLHttpRequest.useFetchPatch = true;
    return this;
  }

  enableDeviceOrientation(
    interval: WechatMiniprogram.StartDeviceMotionListeningOption['interval'],
  ) {
    return new Promise((resolve, reject) => {
      wx.onDeviceMotionChange(this.onDeviceMotionChange);
      wx.startDeviceMotionListening({
        interval,
        success: e => {
          resolve(e);
          this.enabledDeviceMotion = true;
        },
        fail: reject,
      });
    });
  }

  disableDeviceOrientation() {
    return new Promise((resolve, reject) => {
      wx.offDeviceMotionChange(this.onDeviceMotionChange);

      this.enabledDeviceMotion &&
        wx.stopDeviceMotionListening({
          success: () => {
            resolve(true);
            this.enabledDeviceMotion = false;
          },
          fail: reject,
        });
    });
  }

  dispatchTouchEvent(
    e: TouchEvent = {
      touches: [],
      changedTouches: [],
      timeStamp: 0,
      type: '',
    },
  ) {
    const target = { ...this };
    const changedTouches = e.changedTouches.map(touch => new Touch(touch));

    const event = {
      changedTouches: changedTouches,
      touches: e.touches.map(touch => new Touch(touch)),
      targetTouches: Array.prototype.slice.call(e.touches.map(touch => new Touch(touch))),
      timeStamp: e.timeStamp,
      target: target,
      currentTarget: target,
      type: e.type,
      cancelBubble: false,
      cancelable: false,
    };

    this.canvas.dispatchEvent(event);

    if (changedTouches.length) {
      const touch = changedTouches[0];
      const pointerEvent = {
        pageX: touch.pageX,
        pageY: touch.pageY,
        pointerId: touch.identifier,
        type:
          {
            touchstart: 'pointerdown',
            touchmove: 'pointermove',
            touchend: 'pointerup',
          }[e.type] || '',
        pointerType: 'touch',
      };

      this.canvas.dispatchEvent(pointerEvent);
    }
  }

  dispose() {
    this.disableDeviceOrientation();
    // 缓解ios内存泄漏, 前后进出页面多几次，降低pixelRatio也可行
    this.canvas.width = 0;
    this.canvas.height = 0;
    // @ts-ignore
    if (this.canvas) this.canvas.ownerDocument = null;
    // @ts-ignore
    this.onDeviceMotionChange = null;
    // @ts-ignore
    this.canvas = null;
  }
}
