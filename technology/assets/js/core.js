/*
 * Qaraqoyunlu — shared site core (vanilla JS, no dependencies).
 *
 * Features (all opt-in through data-attributes):
 *   i18n ............ [data-i18n="key"]           text/HTML swapped from window.I18N.en / .ru
 *                     [data-i18n-attr="attr:key; attr2:key2"]  attribute swap
 *                     [data-lang-switch="az|en|ru"]  language buttons
 *                     'langchange' fires on document once every string is swapped
 *   contacts ........ <html data-site="group">    phones, e-mail and social links saved in /admin/
 *   reveal .......... [data-reveal="up|down|left|right|fade|scale|clip"] [data-reveal-delay="120"]
 *                     [data-stagger] on a parent -> children get --i for staggered delays
 *   split text ...... [data-split]                 heading words animate in line-by-line
 *   counters ........ [data-count="12"] [data-count-suffix="+"]
 *   parallax ........ [data-parallax="0.15"]
 *   spotlight ....... [data-spotlight]             sets --mx/--my for a pointer glow
 *   magnetic ........ [data-magnetic]              button gently follows pointer
 *   nav ............. [data-nav-toggle], body.nav-open, header gets .is-scrolled
 *   scroll progress . .scroll-progress
 *   filter .......... [data-filter-group] > [data-filter="all|cat"], items [data-cat="cat"]
 *   lightbox ........ [data-lightbox] (on <a href="big.webp"> or <img>)
 *                     [data-lightbox-group] parent -> prev/next sequence of its visible items
 *                     [data-lightbox-cap] inside a trigger -> caption text (default: img alt)
 *   forms ........... form[data-wa-form][data-wa-number="994..."]  -> WhatsApp message
 *                     [data-mail-to="x@y.z"] button inside form   -> e-mail draft
 *   year ............ [data-year]
 *   perf ............ [data-pause-offscreen]       endless CSS animations inside pause off-screen
 *
 * Azerbaijani text lives in the HTML (default, indexed by search engines).
 * English and Russian live in i18n.js as window.I18N = { en: { key: "..." }, ru: { ... } }.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var STORAGE_KEY = 'qq-lang';
  var LANGS = ['az', 'en', 'ru'];

  root.classList.add('js');
  if (reduceMotion) root.classList.add('reduce-motion');

  /* ---------------------------------------------------------------- i18n */

  var originals = new WeakMap();   // element -> its Azerbaijani markup, as written in the HTML
  var shown = new WeakMap();       // element -> the markup core.js last put there
  var originalAttrs = new WeakMap();
  var currentLang = 'az';
  // The HTML already holds the Azerbaijani text, so the first pass only records
  // the originals and never rewrites the DOM (no re-parse, no style recalc).
  var firstRun = true;
  var langJob = 0;

  function dict(lang) {
    return (window.I18N && window.I18N[lang]) || null;
  }

  function parseAttrMap(str) {
    return str.split(';').map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
      var i = p.indexOf(':');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    });
  }

  // One string into one element: plain text skips the HTML parser, and a string
  // that is already showing is left alone.
  function putText(el, html) {
    if (shown.get(el) === html) return;
    if (html.indexOf('<') < 0 && html.indexOf('&') < 0) el.textContent = html;
    else el.innerHTML = html;
    shown.set(el, html);
  }

  // Below the first screen the strings are swapped in slices, one slice per frame,
  // so a language change never becomes one long task followed by one huge relayout.
  function nextSlice(fn) {
    if (document.hidden || !window.requestAnimationFrame) setTimeout(fn, 0);
    else requestAnimationFrame(function () { setTimeout(fn, 0); });
  }

  // `done` runs (and 'langchange' fires) once every string on the page is swapped.
  function applyLang(lang, done) {
    var d = lang === 'az' ? null : dict(lang);
    if (lang !== 'az' && !d) lang = 'az';
    var job = ++langJob;

    // First screen at once: head, header + menu, floating buttons and the hero
    // (the first section of <main>). The rest of <main> and the footer follow in
    // slices, unless the page opens on a #section link and lands mid-page.
    var main = document.querySelector('main');
    var hero = document.querySelector('main > section');
    var foot = document.querySelector('.site-footer');
    var sliced = !(firstRun && location.hash.length > 1);
    var later = [];

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (!originals.has(el)) { originals.set(el, el.innerHTML); shown.set(el, originals.get(el)); }
      var html;
      if (lang === 'az') html = originals.get(el);
      else {
        var key = el.getAttribute('data-i18n');
        if (!Object.prototype.hasOwnProperty.call(d, key)) {
          if (window.console) console.warn('[i18n] missing "' + lang + '" key:', key);
          return;
        }
        html = d[key];
      }
      if (shown.get(el) === html) return;
      if (sliced && ((main && main.contains(el) && !(hero && hero.contains(el))) || (foot && foot.contains(el)))) later.push([el, html]);
      else putText(el, html);
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var pairs = parseAttrMap(el.getAttribute('data-i18n-attr'));
      if (!originalAttrs.has(el)) {
        var o = {};
        pairs.forEach(function (p) { o[p[0]] = el.getAttribute(p[0]); });
        originalAttrs.set(el, o);
      }
      pairs.forEach(function (p) {
        var attr = p[0], key = p[1];
        if (lang === 'az') { if (!firstRun) el.setAttribute(attr, originalAttrs.get(el)[attr]); }
        else if (Object.prototype.hasOwnProperty.call(d, key)) el.setAttribute(attr, d[key]);
        else if (window.console) console.warn('[i18n] missing "' + lang + '" attr key:', key);
      });
    });

    firstRun = false;
    currentLang = lang;
    // (a page may set lang="en" in <head> already: re-setting it would re-lay out every line)
    if (root.getAttribute('lang') !== lang) root.setAttribute('lang', lang);
    syncCanonical(lang);
    document.querySelectorAll('[data-lang-switch]').forEach(function (b) {
      var on = b.getAttribute('data-lang-switch') === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }

    splitAll(later);

    var i = 0;
    function finish() {
      splitAll();
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
      if (done) done();
    }
    // at most 40 strings or 6 ms per slice: the relayout that follows each one stays short
    function slice() {
      if (job !== langJob) return; // a newer language switch took over
      var t0 = performance.now(), end = Math.min(i + 40, later.length);
      while (i < end && performance.now() - t0 < 6) { putText(later[i][0], later[i][1]); i++; }
      if (i < later.length) nextSlice(slice); else finish();
    }
    if (later.length) nextSlice(slice); else finish();
  }

  // Keep canonical and og:url on the URL of the language being shown, taken from
  // the page's own <link rel="alternate" hreflang="…">, so the hreflang pair holds.
  function syncCanonical(lang) {
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (!alt) return;
    var href = alt.getAttribute('href');
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', href);
    var og = document.querySelector('meta[property="og:url"]');
    if (og) og.setAttribute('content', href);
  }

  function initialLang() {
    var fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.indexOf(fromUrl) > -1) return fromUrl;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(saved) > -1) return saved;
    } catch (e) { /* storage unavailable */ }
    return 'az';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang-switch]');
    if (!b) return;
    e.preventDefault();
    var lang = b.getAttribute('data-lang-switch');
    if (lang === currentLang) return;
    root.classList.add('is-switching-lang');
    setTimeout(function () {
      applyLang(lang, function () {
        requestAnimationFrame(function () { root.classList.remove('is-switching-lang'); });
      });
      try {
        var url = new URL(location.href);
        if (lang === 'az') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
        history.replaceState(null, '', url);
      } catch (err) { /* sandboxed or file:// page: keep the address as it is */ }
    }, reduceMotion ? 0 : 180);
  });

  window.QQ = window.QQ || {};
  window.QQ.lang = function () { return currentLang; };
  window.QQ.t = function (key, fallback) {
    var d = dict(currentLang);
    return (currentLang !== 'az' && d && d[key]) || fallback;
  };

  /* ---------------------------------------------------------- split text */

  // Wraps each word in .split-word > .split-inner so CSS can slide words up
  // from behind a mask. Keeps inline elements (em, strong, br, span) intact.
  function splitEl(el) {
    var words = 0;
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          // Split on ordinary whitespace only: a no-break space (&nbsp;) stays inside
          // its word, so "qədər&nbsp;—" can never leave the dash alone on a new line.
          var parts = child.textContent.split(/([ \t\n\r\f]+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r\f]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var outer = document.createElement('span');
            outer.className = 'split-word';
            var inner = document.createElement('span');
            inner.className = 'split-inner';
            inner.style.setProperty('--w', words++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('split-word')) {
          walk(child);
        }
      });
    }
    walk(el);
    el.classList.add('is-split');
  }

  // `skip`: [element, markup] pairs still waiting for their translation (split them after)
  function splitAll(skip) {
    document.querySelectorAll('[data-split]').forEach(function (el) {
      if (el.querySelector('.split-word')) return;
      if (skip && skip.some(function (p) { return p[0] === el || el.contains(p[0]); })) return;
      splitEl(el);
    });
  }

  /* -------------------------------------------------------------- reveal */

  function initStagger() {
    document.querySelectorAll('[data-stagger]').forEach(function (parent) {
      var step = parseInt(parent.getAttribute('data-stagger'), 10) || 80;
      Array.prototype.forEach.call(parent.children, function (child, i) {
        child.style.setProperty('--reveal-delay', (i * step) + 'ms');
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', parent.getAttribute('data-stagger-type') || 'up');
      });
    });
    document.querySelectorAll('[data-reveal-delay]').forEach(function (el) {
      el.style.setProperty('--reveal-delay', el.getAttribute('data-reveal-delay') + 'ms');
    });
  }

  // Once a split heading has finished rising, drop the word masks entirely so
  // descenders, accents and italic overhangs can never be clipped.
  function markSplitDone(el, instant) {
    if (!el.hasAttribute('data-split')) return;
    if (instant) { el.classList.add('split-done'); return; }
    var words = el.querySelectorAll('.split-word').length;
    var delay = parseFloat(getComputedStyle(el).getPropertyValue('--reveal-delay')) || 0;
    setTimeout(function () { el.classList.add('split-done'); }, words * 45 + delay + 1100);
  }

  var revealObserver = null;
  function reveal(el) {
    if (el.qqRevealed) return;
    el.qqRevealed = true;
    el.classList.add('is-visible');
    markSplitDone(el, false);
    if (el.hasAttribute('data-count')) runCounter(el, false);
    if (revealObserver) revealObserver.unobserve(el);
  }

  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal], [data-split], [data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-visible');
        markSplitDone(el, true);
        if (el.hasAttribute('data-count')) runCounter(el, true);
      });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        // A clip-path reveal hides the element's own box, so Chromium reports a 0
        // intersection ratio until it is revealed: for those, intersecting is enough.
        var isClip = el.getAttribute('data-reveal') === 'clip';
        // 0.1, not 0.12: at the 0.12 crossing Chromium can report 0.1199999973 (float32),
        // and a rejected crossing never fires again, which left blocks hidden for good.
        if (!entry.isIntersecting || (!isClip && entry.intersectionRatio < 0.1)) return;
        reveal(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: [0, 0.12] });
    targets.forEach(function (el) { revealObserver.observe(el); });

    // Safety net: when scrolling stops, anything already on screen that is still hidden
    // is shown (e.g. a block taller than ~8 screens never reaches the 0.12 threshold).
    var pending = Array.prototype.slice.call(targets);
    var sweepTimer = 0;
    function sweep() {
      var vh = window.innerHeight, vw = window.innerWidth, line = vh * 0.92;
      pending = pending.filter(function (el) {
        if (el.qqRevealed) return false;
        var r = el.getBoundingClientRect();
        var seen = Math.min(r.bottom, line) - Math.max(r.top, 0);
        if (seen > 0 && seen >= Math.min(r.height, vh) * 0.1 && r.right > 0 && r.left < vw) { reveal(el); return false; }
        return true;
      });
      if (!pending.length) window.removeEventListener('scroll', onScrollEnd);
    }
    function onScrollEnd() { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, 200); }
    window.addEventListener('scroll', onScrollEnd, { passive: true });
  }

  /* ------------------------------------------------------------ counters */

  function runCounter(el, instant) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-count-suffix') || '';
    var prefix = el.getAttribute('data-count-prefix') || '';
    var decimals = (el.getAttribute('data-count').split('.')[1] || '').length;
    if (instant) { el.textContent = prefix + target.toFixed(decimals) + suffix; return; }
    var start = performance.now(), dur = 1400;
    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 4);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------- header, progress, parallax */

  var header = document.querySelector('.site-header');
  var progress = document.querySelector('.scroll-progress');
  var parallaxEls = reduceMotion ? [] : Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;

  // All reads first, then all writes, so one scroll frame costs one layout at most.
  function onScroll() {
    var y = window.scrollY;
    var vh = window.innerHeight;
    var max = progress ? document.documentElement.scrollHeight - vh : 0;
    var moves = [];
    parallaxEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      moves.push([el, (r.top + r.height / 2 - vh / 2) * -speed]);
    });
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    moves.forEach(function (m) { m[0].style.transform = 'translate3d(0,' + m[1].toFixed(1) + 'px,0)'; });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ----------------------------------------------------------------- nav */

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    document.querySelectorAll('[data-nav-toggle]').forEach(function (b) {
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-nav-toggle]')) { setNav(!document.body.classList.contains('nav-open')); return; }
    // a menu link or the logo (it scrolls to the top) closes the open menu
    if (document.body.classList.contains('nav-open') && e.target.closest('.site-nav a, .site-header .brand')) setNav(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setNav(false); closeLightbox(); }
  });

  /* --------------------------------------------------- spotlight & magnetic */

  if (finePointer && !reduceMotion) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest('[data-spotlight]');
      if (card) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    }, { passive: true });

    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.25;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* -------------------------------------------------------------- filter */

  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    var scope = document.querySelector(group.getAttribute('data-filter-group')) || document;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      var cat = b.getAttribute('data-filter');
      group.querySelectorAll('[data-filter]').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      scope.querySelectorAll('[data-cat]').forEach(function (item) {
        var show = cat === 'all' || item.getAttribute('data-cat').split(' ').indexOf(cat) > -1;
        item.classList.toggle('is-hidden', !show);
      });
    });
  });

  /* ------------------------------------------------------------ lightbox */

  // Modal image viewer: focus stays inside while open and returns to the photo
  // on close. A [data-lightbox-group] ancestor turns its visible triggers into a
  // sequence (prev/next buttons, ←/→ keys, swipe, "03 / 16" counter).
  // Caption = text of [data-lightbox-cap] elements inside the trigger, else the
  // image alt. Labels use i18n keys lightbox.label/.close/.prev/.next.
  var lb = null, lbItems = [], lbIndex = 0;
  function lbIcon(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>'; }
  function lbPad(v) { return (v < 10 ? '0' : '') + v; }

  function labelLightbox() {
    var t = window.QQ.t;
    lb.setAttribute('aria-label', t('lightbox.label', 'Şəkil'));
    lb.querySelector('.lightbox__close').setAttribute('aria-label', t('lightbox.close', 'Bağla'));
    lb.querySelector('.lightbox__prev').setAttribute('aria-label', t('lightbox.prev', 'Əvvəlki şəkil'));
    lb.querySelector('.lightbox__next').setAttribute('aria-label', t('lightbox.next', 'Növbəti şəkil'));
  }

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<figure class="lightbox__stage"><img class="lightbox__img" alt="">' +
      '<figcaption class="lightbox__cap"><span class="lightbox__count"></span><span class="lightbox__text"></span></figcaption></figure>' +
      '<button class="lightbox__btn lightbox__prev" type="button">' + lbIcon('M14.5 5.5 8 12l6.5 6.5') + '</button>' +
      '<button class="lightbox__btn lightbox__next" type="button">' + lbIcon('M9.5 5.5 16 12l-6.5 6.5') + '</button>' +
      '<button class="lightbox__btn lightbox__close" type="button">' + lbIcon('M6 6l12 12M18 6 6 18') + '</button>';
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.closest('.lightbox__close')) closeLightbox();
      else if (e.target.closest('.lightbox__prev')) stepLightbox(-1);
      else if (e.target.closest('.lightbox__next')) stepLightbox(1);
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(e.key === 'ArrowLeft' ? -1 : 1); return; }
      if (e.key !== 'Tab') return;
      var btns = Array.prototype.filter.call(lb.querySelectorAll('button'), function (b) { return !b.hidden; });
      var i = btns.indexOf(document.activeElement);
      e.preventDefault();
      btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 48) stepLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });
    lb.querySelector('.lightbox__img').addEventListener('load', function () { this.classList.remove('is-loading'); });
    document.addEventListener('langchange', function () {
      labelLightbox();
      if (lb.classList.contains('is-open')) showLightbox(lbIndex);
    });
    document.body.appendChild(lb);
  }

  function showLightbox(i) {
    var n = lbItems.length;
    lbIndex = (i + n) % n;
    var t = lbItems[lbIndex];
    var thumb = t.tagName === 'IMG' ? t : t.querySelector('img');
    var src = t.getAttribute('href') || (thumb && (thumb.currentSrc || thumb.src));
    var caps = t.querySelectorAll('[data-lightbox-cap]');
    var img = lb.querySelector('.lightbox__img');
    if (img.getAttribute('src') !== src) { img.classList.add('is-loading'); img.setAttribute('src', src); }
    img.alt = (thumb && thumb.alt) || '';
    lb.querySelector('.lightbox__text').textContent = caps.length
      ? Array.prototype.map.call(caps, function (c) { return c.textContent.trim(); }).join(' — ')
      : img.alt;
    var count = lb.querySelector('.lightbox__count');
    count.textContent = n > 1 ? lbPad(lbIndex + 1) + ' / ' + lbPad(n) : '';
    count.hidden = lb.querySelector('.lightbox__prev').hidden = lb.querySelector('.lightbox__next').hidden = n < 2;
  }
  function stepLightbox(d) {
    if (lb && lb.classList.contains('is-open') && lbItems.length > 1) showLightbox(lbIndex + d);
  }
  function openLightbox(trigger) {
    if (!lb) buildLightbox();
    var group = trigger.closest('[data-lightbox-group]');
    lbItems = group
      ? Array.prototype.filter.call(group.querySelectorAll('[data-lightbox]'), function (el) { return el === trigger || el.offsetParent !== null; })
      : [trigger];
    labelLightbox();
    showLightbox(Math.max(0, lbItems.indexOf(trigger)));
    lb.classList.add('is-open');
    document.body.classList.add('lightbox-open');
    lb.querySelector('.lightbox__close').focus();
  }
  function closeLightbox() {
    if (!lb || !lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    // back to the photo that is showing now (it may differ from the one opened)
    var t = lbItems[lbIndex];
    if (t && typeof t.focus === 'function') t.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lightbox]');
    if (!t) return;
    e.preventDefault();
    openLightbox(t);
  });

  /* --------------------------------------------------------------- forms */

  function formText(form) {
    var lines = [];
    lines.push(form.getAttribute('data-wa-intro-' + currentLang) || form.getAttribute('data-wa-intro') || '');
    form.querySelectorAll('input, select, textarea').forEach(function (f) {
      if (!f.name || f.type === 'hidden' || f.type === 'submit' || !f.value.trim()) return;
      var label = form.querySelector('label[for="' + f.id + '"]');
      var name = label ? label.textContent.replace(/\*/g, '').trim() : f.name;
      var value = f.tagName === 'SELECT' ? f.options[f.selectedIndex].text : f.value.trim();
      lines.push(name + ': ' + value);
    });
    return lines.filter(Boolean).join('\n');
  }

  document.querySelectorAll('form[data-wa-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var number = form.getAttribute('data-wa-number');
      window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(formText(form)), '_blank', 'noopener');
      form.classList.add('is-sent');
    });
    form.querySelectorAll('[data-mail-to]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!form.reportValidity()) return;
        var subject = { en: 'Website enquiry', ru: 'Заявка с сайта' }[currentLang] || 'Saytdan müraciət';
        location.href = 'mailto:' + btn.getAttribute('data-mail-to') +
          '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(formText(form));
      });
    });
  });

  /* ------------------------------------------------ pause off-screen motion */

  // Endless CSS animations (marquees, scanners, pulses) keep the main thread busy
  // even when nobody can see them. Mark their container with [data-pause-offscreen]
  // (marquees are picked up automatically) and they stop while off-screen.
  if ('IntersectionObserver' in window) {
    var pauseObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    }, { rootMargin: '120px 0px' });
    document.querySelectorAll('.marquee, [data-pause-offscreen]').forEach(function (el) { pauseObserver.observe(el); });
  }

  /* ---------------------------------------------------------------- misc */

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------ contacts */

  // Phones, WhatsApp, e-mail and social links the client edits in /admin/.
  // contacts.js holds the defaults (the values written in this HTML) and, on
  // Cloudflare, the saved values too. This runs before the first language pass, so the
  // new values count as the originals. Nothing saved: the page stays as written.
  function digits(v) { return String(v).replace(/\D/g, ''); }
  function prettyPhone(v) {
    var d = digits(v);
    return d.length === 12 && d.indexOf('994') === 0
      ? '+994 ' + d.slice(3, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8, 10) + ' ' + d.slice(10)
      : '+' + d;
  }
  function handleOf(url) { return '@' + url.replace(/\/+$/, '').split('/').pop().replace(/^@/, ''); }

  // All at once, so two numbers that trade places do not overwrite each other.
  function swapAll(str, map) {
    var keys = Object.keys(map);
    if (!keys.length) return str;
    var re = new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'g');
    return str.replace(re, function (m) { return map[m]; });
  }

  function hideContact(link) {
    var row = link.closest('li');
    var el = row && row.querySelectorAll('a').length === 1 ? row : link;
    el.style.display = 'none';
    if (link.nextElementSibling && link.nextElementSibling.tagName === 'BR') link.nextElementSibling.style.display = 'none';
  }

  function applyContacts() {
    var data = window.QQ_CONTACTS, site = root.getAttribute('data-site');
    var from = data && data.defaults && data.defaults[site];
    var saved = data && data.saved && data.saved[site];
    if (!from || !saved) return;
    var to = {};
    Object.keys(from).forEach(function (k) { to[k] = Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : from[k]; });

    var phoneText = {}, waText = {}, handles = {};
    var mainPhone = to.phones.filter(Boolean)[0];
    from.phones.forEach(function (old, i) {
      var now = to.phones[i] === undefined ? old : to.phones[i];
      phoneText[prettyPhone(old)] = now ? prettyPhone(now) : '';
      document.querySelectorAll('a[href="tel:' + old + '"]').forEach(function (a) {
        if (now) { a.setAttribute('href', 'tel:+' + digits(now)); return; }
        // the header and floating call buttons stay: they move to the first number
        if (!a.closest('.fab__btn, .site-header__actions')) { hideContact(a); return; }
        a.setAttribute('href', 'tel:+' + digits(mainPhone));
        if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', a.getAttribute('aria-label').replace(prettyPhone(old), prettyPhone(mainPhone)));
        a.querySelectorAll('span').forEach(function (s) { s.textContent = s.textContent.replace(prettyPhone(old), prettyPhone(mainPhone)); });
      });
    });
    waText[prettyPhone(from.whatsapp)] = prettyPhone(to.whatsapp);
    document.querySelectorAll('a[href="https://wa.me/' + digits(from.whatsapp) + '"]').forEach(function (a) {
      a.setAttribute('href', 'https://wa.me/' + digits(to.whatsapp));
    });
    document.querySelectorAll('[data-wa-number]').forEach(function (f) { f.setAttribute('data-wa-number', digits(to.whatsapp)); });

    document.querySelectorAll('a[href^="mailto:' + from.email + '"]').forEach(function (a) {
      a.setAttribute('href', a.getAttribute('href').replace(from.email, to.email));
      if (a.textContent.indexOf(from.email) < 0) return;
      var at = to.email.indexOf('@');
      a.textContent = to.email.slice(0, at);
      a.appendChild(document.createElement('wbr'));
      a.appendChild(document.createTextNode(to.email.slice(at)));
    });
    document.querySelectorAll('[data-mail-to]').forEach(function (b) { b.setAttribute('data-mail-to', to.email); });

    ['instagram', 'tiktok'].forEach(function (net) {
      if (!from[net]) return;
      if (to[net]) handles[handleOf(from[net])] = handleOf(to[net]);
      document.querySelectorAll('a[href="' + from[net] + '"]').forEach(function (a) {
        if (to[net]) a.setAttribute('href', to[net]); else hideContact(a);
      });
    });

    // Numbers in running text and labels. WhatsApp's number can equal a phone's, so the
    // text around it decides which of the two it is.
    function waContext(str, el) { return /whatsapp/i.test(str) || (el && el.closest('a[href*="wa.me/"]')); }
    function swapStr(str, el) {
      return swapAll(str, waContext(str, el) ? waText : phoneText);
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentNode.closest('script, style')) continue;
      var val = swapAll(swapStr(node.nodeValue, node.parentNode), handles);
      if (val !== node.nodeValue) node.nodeValue = val;
    }
    document.querySelectorAll('a[aria-label]').forEach(function (a) {
      a.setAttribute('aria-label', swapStr(a.getAttribute('aria-label'), a));
    });

    Object.keys(window.I18N || {}).forEach(function (lang) {
      var d = window.I18N[lang];
      Object.keys(d).forEach(function (k) { d[k] = swapStr(d[k]).split('mailto:' + from.email).join('mailto:' + to.email); });
    });

    // what search engines read
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        var json = JSON.parse(ld.textContent);
        json.telephone = to.phones.filter(Boolean).map(function (p) { return '+' + digits(p); });
        json.email = to.email;
        json.sameAs = [to.instagram, to.tiktok].filter(Boolean);
        ld.textContent = JSON.stringify(json);
      } catch (e) { /* leave the block as written */ }
    }
  }

  /* ---------------------------------------------------------------- boot */

  applyContacts();
  initStagger();
  applyLang(initialLang());
  initReveal();
  onScroll();
  window.addEventListener('load', function () { root.classList.add('is-loaded'); });
})();
