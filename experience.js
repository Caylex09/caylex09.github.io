(function () {
  'use strict';

  var script = document.currentScript;
  var mermaidSource = script && script.dataset.mermaidSrc;
  var mermaidReady;
  var mermaidInitialized = false;
  var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (mermaidReady) return mermaidReady;
    mermaidReady = new Promise(function (resolve, reject) {
      var dependency = document.createElement('script');
      dependency.src = mermaidSource;
      dependency.async = true;
      dependency.dataset.argonMermaid = 'true';
      dependency.onload = function () {
        if (window.mermaid) resolve(window.mermaid);
        else reject(new Error('Mermaid unavailable'));
      };
      dependency.onerror = function () { reject(new Error('Mermaid unavailable')); };
      document.head.appendChild(dependency);
    });
    return mermaidReady;
  }

  function renderDiagrams() {
    var diagrams = Array.from(document.querySelectorAll('article .mermaid:not([data-processed]):not([data-argon-pending])'));
    if (!mermaidSource || !diagrams.length) return;
    var originals = diagrams.map(function (node) {
      node.dataset.argonPending = 'true';
      return node.textContent;
    });
    loadMermaid().then(function (mermaid) {
      if (!mermaidInitialized) {
        mermaid.initialize({ startOnLoad: false, theme: 'forest' });
        mermaidInitialized = true;
      }
      diagrams.forEach(function (node, index) {
        try {
          mermaid.init(undefined, node);
        } catch (error) {
          node.textContent = originals[index];
          node.removeAttribute('data-processed');
          node.classList.add('mermaid-unavailable');
        }
        node.removeAttribute('data-argon-pending');
      });
    }).catch(function () {
      diagrams.forEach(function (node, index) {
        node.textContent = originals[index];
        node.classList.add('mermaid-unavailable');
        node.removeAttribute('data-argon-pending');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDiagrams, { once: true });
  } else {
    renderDiagrams();
  }
  window.addEventListener('hexo-blog-decrypt', renderDiagrams);
  document.addEventListener('pjax:complete', renderDiagrams);

  var colors = ['#FF1461', '#18FF92', '#5A87FF', '#FBF38C'];
  document.addEventListener('click', function (event) {
    if (motionPreference.matches || event.detail === 0 || event.defaultPrevented) return;
    var target = event.target;
    if (target instanceof Element && (target.closest('a, button, input, textarea, select, label, pre, code, [role="button"], .hljs-control, .heimu') || target.isContentEditable)) return;
    if (window.getSelection() && window.getSelection().toString()) return;
    if (document.querySelectorAll('.particle').length >= 40) return;

    var ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = event.clientX + 'px';
    ripple.style.top = event.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 600);

    for (var i = 0; i < 8; i++) {
      (function (index) {
        var particle = document.createElement('div');
        particle.className = 'particle';
        particle.setAttribute('aria-hidden', 'true');
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        var angle = ((index * 45 + 22.5) * Math.PI) / 180;
        var velocity = 2 + Math.random() * 2;
        var start = performance.now();
        function animate(now) {
          var progress = (now - start) / 600;
          if (progress >= 1 || motionPreference.matches) {
            particle.remove();
            return;
          }
          particle.style.left = (event.clientX - 4 + Math.cos(angle) * velocity * progress * 20) + 'px';
          particle.style.top = (event.clientY - 4 + Math.sin(angle) * velocity * progress * 20) + 'px';
          particle.style.opacity = 1 - progress;
          particle.style.transform = 'scale(' + (1 - progress) + ')';
          requestAnimationFrame(animate);
        }
        document.body.appendChild(particle);
        requestAnimationFrame(animate);
      })(i);
    }
  });
})();
