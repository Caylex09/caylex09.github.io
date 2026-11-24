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

  function notifyAnchorCopied() {
    if (typeof iziToast === 'undefined' || !iziToast.show) return;
    iziToast.show({
      title: '链接已复制',
      message: '可以直接粘贴分享这个标题位置',
      class: 'shadow',
      position: 'topRight',
      backgroundColor: '#2dce89',
      titleColor: '#ffffff',
      messageColor: '#ffffff',
      iconColor: '#ffffff',
      progressBarColor: '#ffffff',
      icon: 'fa fa-link',
      timeout: 3000
    });
  }

  function copyAnchorUrl(anchor) {
    var url = new URL(anchor.getAttribute('href') || window.location.hash, window.location.href).href;
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(url).then(notifyAnchorCopied, function () {
      // Clipboard is unavailable (insecure context or denied permission).
      // The jump still happens, so stay silent.
    });
  }

  /* Heading anchors scrolled badly: <a href="#slug"> is a real fragment link,
     so the browser teleports to the heading first, and the resulting
     `hashchange` makes the theme's gotoHash() animate a second pass over the
     already-jumped position. Two scrolls for one click reads as a stutter.
     The sidebar TOC does not do this — headindex.js cancels the click and runs
     one animation — so mirror that here: take the click over, and animate once
     with the same duration and easing jQuery uses for 'fast' (200ms, swing).
     Keeping the numbers in sync is what makes both entry points feel alike. */
  var ANCHOR_SCROLL_MS = 200;
  var ANCHOR_SCROLL_OFFSET = 80; // same offset as gotoHash() and headIndex
  var anchorScrollFrame = null;

  function easeSwing(progress) {
    return 0.5 - Math.cos(Math.PI * progress) / 2;
  }

  function scrollToHeading(target) {
    if (anchorScrollFrame !== null) {
      cancelAnimationFrame(anchorScrollFrame);
      anchorScrollFrame = null;
    }
    var startY = window.pageYOffset;
    var maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var destination = target.getBoundingClientRect().top + startY - ANCHOR_SCROLL_OFFSET;
    destination = Math.min(Math.max(destination, 0), maxY);
    if (motionPreference.matches || Math.abs(destination - startY) < 1) {
      window.scrollTo(0, destination);
      return;
    }
    var startedAt = null;
    function step(now) {
      if (startedAt === null) startedAt = now;
      var progress = Math.min((now - startedAt) / ANCHOR_SCROLL_MS, 1);
      window.scrollTo(0, startY + (destination - startY) * easeSwing(progress));
      anchorScrollFrame = progress < 1 ? requestAnimationFrame(step) : null;
    }
    anchorScrollFrame = requestAnimationFrame(step);
  }

  function handleAnchorClick(event) {
    var anchor = event.target;
    if (!(anchor instanceof Element)) return;
    if (!anchor.classList.contains('markdownIt-Anchor')) return;
    // Leave modified clicks (new tab, new window, download) to the browser.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    var id = (anchor.getAttribute('href') || '').replace(/^#/, '');
    var target = id ? document.getElementById(id) : null;
    if (!target) return; // Unknown target: let the browser do whatever it does.

    copyAnchorUrl(anchor);
    event.preventDefault();
    scrollToHeading(target);

    // Push the hash instead of assigning location.hash: assigning it fires
    // `hashchange`, which is exactly the second scroll we are avoiding.
    if (window.history && history.pushState) {
      history.pushState(null, '', '#' + id);
    } else {
      window.location.hash = id;
    }
  }

  document.addEventListener('click', handleAnchorClick);

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
