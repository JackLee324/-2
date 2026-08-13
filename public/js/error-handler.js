// public/js/error-handler.js — 全局错误处理（自包含，不依赖页面函数）
// 捕获未处理的脚本错误与 Promise 拒绝，避免「静默失败」，让用户能感知异常
(function () {
  'use strict';
  var container = null;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
    return container;
  }

  function toast(message) {
    try {
      var c = ensureContainer();
      var el = document.createElement('div');
      el.style.cssText = 'background:rgba(230,57,70,0.95);color:#fff;padding:12px 16px;border-radius:8px;font-size:14px;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:auto;';
      el.textContent = message;
      c.appendChild(el);
      setTimeout(function () {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.5s';
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
      }, 5000);
    } catch (e) {
      console.error('[ErrorHandler] toast failed:', e);
    }
  }

  window.addEventListener('error', function (event) {
    var msg = event.message || '脚本错误';
    console.error('[GlobalError]', msg, event.filename || '', event.lineno || '');
    toast('⚠️ 页面发生错误，请刷新重试');
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var msg = (reason && reason.message) ? reason.message : String(reason);
    console.error('[UnhandledRejection]', msg);
    toast('⚠️ 操作失败，请重试');
  });
})();
