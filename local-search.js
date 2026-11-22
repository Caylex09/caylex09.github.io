/* Local search: load and normalize once, only when the dialog opens. */
(function () {
  'use strict';
  var input = document.getElementById('local-search-input');
  var results = document.getElementById('local-search-result');
  var status = document.getElementById('local-search-status');
  var retry = document.getElementById('local-search-retry');
  if (!input || !results || !status || !retry) return;

  var entries = null;
  var pending = null;
  var debounce;
  var composing = false;
  var limit = 50;
  var modal = $('#argon_search_modal');

  // Literal matching avoids RegExp errors and never treats an article as HTML.
  function highlight(element, value, keywords) {
    var lower = value.toLowerCase();
    var intervals = [];
    keywords.forEach(function (word) {
      var index = lower.indexOf(word);
      while (index !== -1) {
        intervals.push([index, index + word.length]);
        index = lower.indexOf(word, index + Math.max(1, word.length));
      }
    });
    intervals.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    intervals.forEach(function (part) {
      var previous = merged[merged.length - 1];
      if (previous && part[0] <= previous[1]) previous[1] = Math.max(previous[1], part[1]);
      else merged.push(part.slice());
    });
    var cursor = 0;
    merged.forEach(function (part) {
      element.appendChild(document.createTextNode(value.slice(cursor, part[0])));
      var mark = document.createElement('mark');
      mark.className = 'search-keyword';
      mark.textContent = value.slice(part[0], part[1]);
      element.appendChild(mark);
      cursor = part[1];
    });
    element.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function render() {
    if (!entries) return;
    results.replaceChildren();
    var query = input.value.trim().toLowerCase();
    if (!query) {
      status.textContent = '已准备好 ' + entries.length + ' 篇文章。输入题号、题名或关键词开始搜索。';
      return;
    }
    var keywords = Array.from(new Set(query.split(/\s+/).filter(Boolean)));
    var matches = [];
    entries.forEach(function (entry) {
      if (!keywords.every(function (word) {
        return entry.titleLower.indexOf(word) !== -1 || entry.contentLower.indexOf(word) !== -1;
      })) return;
      var score = entry.titleLower === query ? 100 : 0;
      keywords.forEach(function (word) {
        if (entry.titleLower.indexOf(word) !== -1) score += 10;
      });
      matches.push({ entry: entry, score: score });
    });
    matches.sort(function (a, b) { return b.score - a.score; });
    if (!matches.length) {
      status.textContent = '没有找到相关文章。试试题号、较短的关键词，或使用空格组合多个关键词。';
      return;
    }
    status.textContent = '找到 ' + matches.length + ' 篇文章' +
      (matches.length > limit ? '，显示前 ' + limit + ' 篇。请增加关键词缩小范围。' : '。');
    var list = document.createElement('ul');
    list.className = 'search-result-list';
    matches.slice(0, limit).forEach(function (match) {
      var entry = match.entry;
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'search-result-title';
      link.href = entry.url;
      highlight(link, entry.title, keywords);
      item.appendChild(link);
      if (entry.content) {
        var first = entry.content.length;
        keywords.forEach(function (word) {
          var position = entry.contentLower.indexOf(word);
          if (position !== -1) first = Math.min(first, position);
        });
        if (first === entry.content.length) first = 0;
        var start = Math.max(0, first - 40);
        var end = Math.min(entry.content.length, start + 160);
        var snippet = (start ? '…' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '…' : '');
        var paragraph = document.createElement('p');
        paragraph.className = 'search-result';
        highlight(paragraph, snippet, keywords);
        item.appendChild(paragraph);
      }
      list.appendChild(item);
    });
    results.appendChild(list);
  }

  function load() {
    if (entries) { render(); return Promise.resolve(entries); }
    if (pending) return pending;
    retry.hidden = true;
    results.setAttribute('aria-busy', 'true');
    status.textContent = '正在加载搜索，请稍候…';
    // The filename includes the content hash: reuse the browser's HTTP cache
    // between pages, while article changes produce a different request URL.
    pending = fetch(input.dataset.searchUrl, { credentials: 'same-origin', cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Search index request failed');
        return response.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Invalid search index');
        entries = data.reduce(function (valid, entry) {
          if (!entry || typeof entry.title !== 'string' || typeof entry.url !== 'string') return valid;
          var url;
          try { url = new URL(entry.url, window.location.href); } catch (error) { return valid; }
          if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin) return valid;
          var content = typeof entry.content === 'string' ? entry.content : '';
          valid.push({ title: entry.title, url: url.href, content: content,
            titleLower: entry.title.toLowerCase(), contentLower: content.toLowerCase() });
          return valid;
        }, []);
        render();
        return entries;
      })
      .catch(function () {
        status.textContent = '搜索加载失败。请检查网络后重新加载。';
        retry.hidden = false;
        return null;
      })
      .finally(function () {
        results.setAttribute('aria-busy', 'false');
        pending = null;
      });
    return pending;
  }

  function schedule() {
    clearTimeout(debounce);
    if (!composing) debounce = setTimeout(render, 200);
  }
  input.addEventListener('input', schedule);
  input.addEventListener('compositionstart', function () { composing = true; clearTimeout(debounce); });
  input.addEventListener('compositionend', function () { composing = false; schedule(); });
  retry.addEventListener('click', load);
  modal.on('show.bs.modal', load);
  modal.on('shown.bs.modal', function () { input.focus(); });
  // Enter opens the first result; Arrow Down moves into the result links.
  input.addEventListener('keydown', function (event) {
    if (event.isComposing || composing) return;
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      clearTimeout(debounce);
      render();
      var first = results.querySelector('.search-result-title');
      if (first) {
        event.preventDefault();
        if (event.key === 'Enter') first.click(); else first.focus();
      }
    }
  });
  results.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    var links = Array.from(results.querySelectorAll('.search-result-title'));
    var position = links.indexOf(document.activeElement);
    if (position < 0) return;
    event.preventDefault();
    var next = position + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) input.focus();
    else links[Math.min(next, links.length - 1)].focus();
  });
  results.addEventListener('click', function (event) {
    if (event.target.closest('.search-result-title')) modal.modal('hide');
  });
  if (window.location.hash === '#search') modal.modal('show');
})();
