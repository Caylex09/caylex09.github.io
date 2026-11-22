(function () {
  'use strict';
  var config = document.currentScript.dataset;
  var renderer = config.renderer;
  var katexBase = (config.katexBase || 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/').replace(/\/?$/, '/');
  var dependencies = new Map();
  var work = Promise.resolve();
  var ignoredSelector = 'script, style, pre, code, textarea, noscript, option, math, svg, mjx-container, .katex, .katex-display, .katex-error, .MathJax, .tex2jax_ignore, .mermaid';
  var ignoredClasses = ['katex', 'katex-display', 'katex-error', 'MathJax', 'tex2jax_ignore', 'mermaid'];

  function hasRawMath(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest(ignoredSelector)) continue;
      if (/\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|(?:^|[^\\$])\$(?!\$)[^$\n]+?\$/.test(node.nodeValue)) return true;
    }
    return false;
  }

  function ensureKatexStyle() {
    if (document.getElementById('argon-katex-style')) return;
    var style = document.createElement('link');
    style.id = 'argon-katex-style';
    style.rel = 'stylesheet';
    style.href = katexBase + 'katex.min.css';
    document.head.appendChild(style);
  }

  function loadScript(url) {
    if (dependencies.has(url)) return dependencies.get(url);
    var pending = new Promise(function (resolve, reject) {
      var dependency = document.createElement('script');
      dependency.src = url;
      dependency.async = true;
      dependency.onload = resolve;
      dependency.onerror = function () {
        dependencies.delete(url);
        dependency.remove();
        reject(new Error('Math renderer unavailable'));
      };
      document.head.appendChild(dependency);
    });
    dependencies.set(url, pending);
    return pending;
  }

  async function renderMath(root) {
    if (root.querySelector('.katex')) ensureKatexStyle();
    if (!hasRawMath(root)) return;
    if (renderer === 'katex') {
      ensureKatexStyle();
      if (!window.katex) await loadScript(katexBase + 'katex.min.js');
      if (!window.renderMathInElement) await loadScript(katexBase + 'contrib/auto-render.min.js');
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        ignoredClasses: ignoredClasses,
        throwOnError: false
      });
    } else if (renderer === 'mathjax3') {
      if (!window.MathJax || !window.MathJax.typesetPromise) {
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            packages: { '[+]': ['noerrors'] }
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoreHtmlClass: ignoredClasses.join('|')
          },
          loader: { load: ['[tex]/noerrors'] },
          startup: { typeset: false }
        };
        await loadScript(config.mathjax3Src);
      }
      await window.MathJax.startup.promise;
      await window.MathJax.typesetPromise([root]);
    } else if (renderer === 'mathjax2') {
      if (!window.MathJax || !window.MathJax.Hub) {
        window.MathJax = {
          messageStyle: 'none',
          skipStartupTypeset: true,
          tex2jax: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            skipTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoreClass: ignoredClasses.join('|')
          },
          menuSettings: { zoom: 'Hover', zscale: '200%' },
          'HTML-CSS': { showMathMenu: false }
        };
        await loadScript(config.mathjax2Src);
      }
      await new Promise(function (resolve) {
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, root], resolve);
      });
    }
  }

  function schedule() {
    // Serial work also covers a decrypt event while a dependency is loading.
    work = work.then(function () { return renderMath(document.body); }).catch(function () {
      // Keep the original TeX readable when a CDN cannot be reached.
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  window.addEventListener('hexo-blog-decrypt', schedule);
  document.addEventListener('pjax:complete', schedule);
})();
