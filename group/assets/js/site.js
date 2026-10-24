/*
 * Qaraqoyunlu Group — site-specific interactions (runs after core.js).
 *
 *   services ........ desktop: active line follows hover/scroll and swaps the sticky photo
 *                     (headings are plain text there); mobile: accordion, one panel open
 *   service pick .... [data-service-pick="metal"] links preselect the form's service
 *   lede ............ about statement lights up word by word while scrolling
 *   steps ........... process line fills with scroll progress
 *   drawings ........ line drawings (stack, tender mark) start when visible
 *   header .......... hides on scroll down, returns on scroll up; stays after anchor jumps
 *   floating buttons  tucked away over the hero, the contact section and the footer, and
 *                     (where they would cover text) while scrolling down; back on scroll up
 *   rekvizitlər ..... copy company details to clipboard
 *   gallery ......... soft entrance after filtering (the viewer itself is in core.js)
 *   form ............ inline, translated validation messages instead of browser bubbles
 *   map ............. Google Maps iframe loads only when the visitor asks for it
 *   mobile nav ...... focus trap + focus return on Esc
 */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var desktopMq = window.matchMedia('(min-width: 1024px)');

  function t(key, fallback) { return window.QQ && window.QQ.t ? window.QQ.t(key, fallback) : fallback; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* Clip-path "wipe" between stacked images.
     .is-active = on top and wiping in; .is-prev = stays visible underneath. */
  function wipeTo(imgs, from, to) {
    if (from === to) return;
    var cur = imgs[from], next = imgs[to];
    each(imgs, function (img) { if (img !== cur && img !== next) img.classList.remove('is-prev', 'is-active'); });
    next.classList.remove('is-prev', 'is-active');
    void next.offsetWidth; // restart from the hidden state
    cur.classList.remove('is-active');
    cur.classList.add('is-prev');
    next.classList.add('is-active');
  }

  /* -------------------------------------------------------------- services */

  var svcList = doc.querySelector('[data-svc-list]');
  if (svcList) {
    var svcs = svcList.querySelectorAll('.svc');
    var mediaImgs = doc.querySelectorAll('.svc-media__img');
    var countEl = doc.querySelector('[data-svc-count]');
    var active = 0;
    var openIdx = 0;

    var setActive = function (i) {
      if (i === active) return;
      svcs[active].classList.remove('is-active');
      svcs[i].classList.add('is-active');
      if (mediaImgs.length) wipeTo(mediaImgs, active, i);
      if (countEl) countEl.textContent = '0' + (i + 1);
      active = i;
    };

    // Desktop shows every panel, so the heading is plain text (a <span>);
    // below 1024px it is the accordion <button>. Children (with their i18n
    // state) are moved across, never re-created.
    var setHeadTag = function (svc, desktop) {
      var cur = svc.querySelector('.svc__toggle');
      var want = desktop ? 'SPAN' : 'BUTTON';
      if (cur.tagName === want) return cur;
      var el = doc.createElement(want);
      el.className = cur.className;
      el.id = cur.id;
      if (!desktop) {
        el.type = 'button';
        el.setAttribute('aria-controls', svc.querySelector('.svc__panel').id);
      }
      while (cur.firstChild) el.appendChild(cur.firstChild);
      cur.parentNode.replaceChild(el, cur);
      return el;
    };

    var layout = function () {
      var desktop = desktopMq.matches;
      each(svcs, function (svc, k) {
        var head = setHeadTag(svc, desktop);
        var panel = svc.querySelector('.svc__panel');
        if (desktop) {
          panel.hidden = false;
        } else {
          head.setAttribute('aria-expanded', k === openIdx ? 'true' : 'false');
          panel.hidden = k !== openIdx;
        }
      });
    };

    each(svcs, function (svc, k) {
      svc.addEventListener('click', function (e) {
        if (desktopMq.matches || !e.target.closest('button.svc__toggle')) return;
        openIdx = openIdx === k ? -1 : k;
        layout();
        if (openIdx === k) {
          setActive(k);
          // keep the opened row's heading in view
          var top = svc.getBoundingClientRect().top;
          if (top < 70) window.scrollBy({ top: top - 90, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
      svc.addEventListener('mouseenter', function () { if (desktopMq.matches) setActive(k); });
    });

    if ('IntersectionObserver' in window) {
      var svcIo = new IntersectionObserver(function (entries) {
        if (!desktopMq.matches) return;
        entries.forEach(function (en) {
          if (en.isIntersecting) setActive(Array.prototype.indexOf.call(svcs, en.target));
        });
      }, { rootMargin: '-42% 0px -52% 0px' });
      each(svcs, function (s) { svcIo.observe(s); });
    }

    layout();
    if (desktopMq.addEventListener) desktopMq.addEventListener('change', layout);
    else if (desktopMq.addListener) desktopMq.addListener(layout);
  }

  /* ------------------------------------------- service preselect in form */

  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-service-pick]');
    if (!a) return;
    var sel = doc.getElementById('f-service');
    if (!sel) return;
    sel.value = a.getAttribute('data-service-pick');
    var wait = reduceMotion ? 0 : 750;
    var name = doc.getElementById('f-name');
    if (finePointer && name && !name.value) {
      // desktop: start typing right away
      setTimeout(function () { name.focus({ preventScroll: true }); }, wait);
    } else {
      // touch: no keyboard pop-up mid-scroll; briefly mark the chosen service instead
      setTimeout(function () {
        sel.classList.add('is-picked');
        setTimeout(function () { sel.classList.remove('is-picked'); }, 1600);
      }, wait);
    }
  });

  /* ------------------------------------------------- lede: words light up */

  var lede = doc.querySelector('[data-lede]');
  var ledeWords = [];
  var ledeCount = -1;
  function splitLede() {
    if (!lede || reduceMotion) return;
    var words = lede.textContent.trim().split(/\s+/);
    lede.textContent = '';
    words.forEach(function (w, i) {
      var s = doc.createElement('span');
      s.className = 'lede-word';
      s.textContent = w;
      lede.appendChild(s);
      if (i < words.length - 1) lede.appendChild(doc.createTextNode(' '));
    });
    ledeWords = lede.querySelectorAll('.lede-word');
    ledeCount = -1;
    lede.classList.add('is-lit-ready');
  }
  function updateLede(vh) {
    if (!ledeWords.length) return;
    var r = lede.getBoundingClientRect();
    // fully lit by the time the statement's top reaches ~the middle of the screen
    var p = clamp((vh * 0.92 - r.top) / (r.height * 0.8 + vh * 0.1), 0, 1);
    var count = Math.round(p * ledeWords.length);
    if (count === ledeCount) return;
    ledeCount = count;
    each(ledeWords, function (w, i) { w.classList.toggle('is-lit', i < count); });
  }
  splitLede();
  doc.addEventListener('langchange', function () { splitLede(); updateLede(window.innerHeight); });

  /* ---------------------------------------------------- process line fill */

  var steps = doc.querySelector('[data-steps]');
  var stepEls = steps ? steps.querySelectorAll('.step') : [];
  function updateSteps(vh) {
    if (!steps) return;
    if (reduceMotion) {
      steps.style.setProperty('--p', '1');
      each(stepEls, function (s) { s.classList.add('is-on'); });
      return;
    }
    var r = steps.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) return;
    var p;
    if (desktopMq.matches) {
      p = clamp((vh * 0.85 - r.top) / (vh * 0.5), 0, 1);
      var w = r.width || 1;
      each(stepEls, function (s) {
        var x = s.getBoundingClientRect().left - r.left;
        s.classList.toggle('is-on', p * w >= x - 2);
      });
    } else {
      var fill = vh * 0.62 - r.top;
      p = clamp(fill / r.height, 0, 1);
      each(stepEls, function (s) { s.classList.toggle('is-on', s.offsetTop <= fill); });
    }
    steps.style.setProperty('--p', p.toFixed(3));
  }

  /* --------------------------------------------- header: hide on scroll down */

  var header = doc.querySelector('.site-header');
  var lastY = window.scrollY;
  var keepHeaderUntil = 0;
  function updateHeader() {
    if (!header) return;
    var y = window.scrollY;
    if (Date.now() < keepHeaderUntil || doc.body.classList.contains('nav-open') || header.contains(doc.activeElement)) {
      header.classList.remove('is-hidden');
    } else if (y > window.innerHeight * 0.9 && y > lastY + 6) {
      header.classList.add('is-hidden');
    } else if (y < lastY - 6 || y < 120) {
      header.classList.remove('is-hidden');
    }
    lastY = y;
  }
  if (header) header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  // a smooth anchor jump scrolls down too: keep the header until the visitor arrives
  doc.addEventListener('click', function (e) {
    if (e.target.closest('a[href^="#"]')) keepHeaderUntil = Date.now() + 1400;
  });

  /* ------------------------------------------------ floating buttons */

  // 1. The hero, the contact section and the footer already show the same actions,
  //    so the buttons step aside there.
  // 2. Where the buttons sit over the text column (phones, tablets, laptops below
  //    ~1440px) they also step aside while the visitor scrolls down to read, and come
  //    back on a scroll up (24px of travel, so a slow scroll still counts), like the header.
  //    Wide screens keep them: there they sit in the empty margin.
  var fab = doc.querySelector('.fab');
  var fabZone = false, fabReading = false, fabOverText = true, fabAnchor = window.scrollY;
  function setFab() {
    var tucked = fabZone || (fabReading && fabOverText && !fab.contains(doc.activeElement));
    if (tucked === fab.classList.contains('is-tucked')) return;
    fab.classList.toggle('is-tucked', tucked);
    fab.toggleAttribute('inert', tucked);
  }
  function measureFab() {
    // layout reads on load and resize only, never while scrolling
    var col = doc.querySelector('main .container');
    if (!fab || !col) return;
    var c = col.getBoundingClientRect(), f = fab.getBoundingClientRect();
    fabOverText = f.left < c.right - (parseFloat(getComputedStyle(col).paddingRight) || 0) + 8;
  }
  function updateFab() {
    if (!fab) return;
    var y = window.scrollY;
    if (fabReading ? y > fabAnchor : y < fabAnchor) fabAnchor = y;
    else if (Math.abs(y - fabAnchor) > 24) { fabReading = !fabReading; fabAnchor = y; }
    setFab();
  }
  if (fab) {
    measureFab();
    var zones = doc.querySelectorAll('.hero, #contact, .site-footer');
    if ('IntersectionObserver' in window && zones.length) {
      var zoneOn = [];
      var fabIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { zoneOn[Array.prototype.indexOf.call(zones, en.target)] = en.isIntersecting; });
        fabZone = zoneOn.some(Boolean);
        setFab();
        fab.classList.add('is-ready');
      });
      each(zones, function (z) { fabIo.observe(z); });
    } else {
      fab.classList.add('is-ready');
    }
  }

  /* ------------------------------------------------------ scroll handler */

  var ticking = false;
  function onScroll() {
    var vh = window.innerHeight;
    updateLede(vh);
    updateSteps(vh);
    if (!reduceMotion) updateHeader();
    updateFab();
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(function () { measureFab(); onScroll(); }); }, { passive: true });
  onScroll();

  /* ------------------------------------- one-shot drawings when visible */

  var drawTargets = doc.querySelectorAll('[data-stack], .tender');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var drawIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-drawn');
        drawIo.unobserve(en.target);
      });
    }, { threshold: 0.25 });
    each(drawTargets, function (el) { drawIo.observe(el); });
  } else {
    each(drawTargets, function (el) { el.classList.add('is-drawn'); });
  }

  /* -------------------------------------------------- current nav link */

  var navLinks = doc.querySelectorAll('.site-nav__list a[href^="#"]');
  if ('IntersectionObserver' in window && navLinks.length) {
    var byId = {};
    each(navLinks, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          each(navLinks, function (x) { x.classList.remove('is-current'); x.removeAttribute('aria-current'); });
          a.classList.add('is-current');
          a.setAttribute('aria-current', 'true');
        } else if (a.classList.contains('is-current')) {
          a.classList.remove('is-current');
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var s = doc.getElementById(id); if (s) navIo.observe(s); });
  }

  /* ------------------------------------------------- copy rekvizitlər */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  each(doc.querySelectorAll('[data-copy-req]'), function (btn) {
    var card = btn.closest('.req');
    var status = card && card.querySelector('.req__status');
    var timer = null;
    btn.addEventListener('click', function () {
      var lines = [];
      each(card.querySelectorAll('.req__row'), function (row) {
        var k = row.querySelector('dt').textContent.trim();
        var v = row.querySelector('dd').innerText.replace(/\s*\n\s*/g, ', ').trim();
        lines.push(k + ': ' + v);
      });
      copyText(lines.join('\n')).then(function () {
        btn.classList.add('is-copied');
        if (status) status.textContent = t('req.copied', 'Rekvizitlər kopyalandı');
      }, function () {
        if (status) status.textContent = t('req.copyfail', 'Kopyalamaq alınmadı — mətni əl ilə seçin.');
      });
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.classList.remove('is-copied');
        if (status) status.textContent = '';
      }, 2600);
    });
  });

  /* ------------------------------------------------------------ gallery */

  each(doc.querySelectorAll('[data-filter-group]'), function (group) {
    var scope = doc.querySelector(group.getAttribute('data-filter-group'));
    if (!scope) return;
    group.addEventListener('click', function (e) {
      if (!e.target.closest('[data-filter]') || reduceMotion) return;
      var shown = scope.querySelectorAll('[data-cat]:not(.is-hidden)');
      each(shown, function (item) {
        item.style.transition = 'none';
        item.classList.add('is-entering');
      });
      void scope.offsetWidth;
      each(shown, function (item, i) {
        item.style.transition = '';
        item.style.transitionDelay = Math.min(i, 10) * 45 + 'ms';
        item.classList.remove('is-entering');
      });
      setTimeout(function () { each(shown, function (item) { item.style.transitionDelay = ''; }); }, 1000);
    });
  });

  /* --------------------------------------------- form: inline messages */

  // core.js validates with reportValidity(); cancelling each 'invalid' event
  // replaces the browser's bubble (shown in the browser's own language) with
  // the translated message under the field.
  each(doc.querySelectorAll('form[data-wa-form]'), function (form) {
    var focusedInRound = false;
    each(form.querySelectorAll('input, select, textarea'), function (f) {
      var field = f.closest('.field');
      var err = f.id ? doc.getElementById(f.id + '-err') : null;
      function setInvalid(on) {
        if (field) field.classList.toggle('is-invalid', on);
        if (on) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
        if (err) err.hidden = !on;
      }
      f.addEventListener('invalid', function (e) {
        e.preventDefault();
        setInvalid(true);
        if (!focusedInRound) {
          focusedInRound = true;
          f.focus();
          setTimeout(function () { focusedInRound = false; }, 0);
        }
      });
      f.addEventListener('input', function () { if (f.validity.valid) setInvalid(false); });
    });
  });

  /* ---------------------------------------------------------------- map */

  each(doc.querySelectorAll('[data-map]'), function (map) {
    var btn = map.querySelector('[data-map-load]');
    var frame = map.querySelector('iframe[data-src]');
    if (!btn || !frame) return;
    btn.addEventListener('click', function () {
      frame.src = frame.getAttribute('data-src');
      frame.hidden = false;
      map.classList.add('is-loaded');
      frame.focus();
    });
  });

  /* ---------------------------------------------- mobile nav: focus care */

  // Capture phase: this runs before core.js's own keydown listener closes the menu on
  // Esc, so the menu still reads as open here and focus can go back to the burger.
  var toggleBtn = doc.querySelector('[data-nav-toggle]');
  doc.addEventListener('keydown', function (e) {
    var open = doc.body.classList.contains('nav-open');
    if (!open || !header) return;
    if (e.key === 'Escape') {
      // core.js closes the menu; give focus back to the burger
      setTimeout(function () { if (toggleBtn) toggleBtn.focus(); }, 0);
      return;
    }
    if (e.key !== 'Tab') return;
    var focusables = Array.prototype.filter.call(
      header.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null || el === toggleBtn; }
    );
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);
})();
