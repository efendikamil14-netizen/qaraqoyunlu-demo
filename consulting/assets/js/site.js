/*
 * Qaraqoyunlu Consulting — site-specific interactions (runs after core.js).
 *
 *   language url .... an English page always carries ?lang=en (also when it came from storage)
 *   online count .... the big tally beside the online services follows the filter
 *   sectors ......... ROI range rows act as tabs for the sector panels
 *                     (click, arrow keys, Home/End; roving tabindex)
 *   scenario ........ $1M scenario: Conservative / Base / Optimistic toggle highlights a
 *                     table column, updates the ROI read-out and the bars with their values
 *   roadmap ......... the 0–36 month bar fills with scroll progress, phases light up
 *   chapter index ... the sticky investment index highlights the sub-section in view
 *   rekvizitlər ..... copy company details to the clipboard
 *   service pick .... [data-service-pick="invest"] links preselect the form's service
 *   form ............ translated inline messages instead of the browser's bubbles
 *   map ............. the Google map loads on request (address card by default)
 *   header & fab .... dark state over the deep-teal sections; the floating buttons step
 *                     aside where they would cover figures or repeat the contact block
 *   current nav ..... highlights the nav link of the section in view
 *   mobile nav ...... focus moves into the menu, Tab is trapped, focus returns on close
 */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function t(key, fallback) { return window.QQ && window.QQ.t ? window.QQ.t(key, fallback) : fallback; }
  function lang() { return window.QQ && window.QQ.lang ? window.QQ.lang() : 'az'; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* ---------------------------------------------------------- language url */

  // core.js may restore English from storage on a bare URL; keep the address bar
  // honest so a copied link opens in the language the visitor is reading.
  function syncLangParam() {
    if (lang() !== 'en' || /[?&]lang=en(&|$)/.test(location.search)) return;
    try {
      var u = new URL(location.href);
      u.searchParams.set('lang', 'en');
      history.replaceState(null, '', u);
    } catch (e) { /* very old browser: leave the URL alone */ }
  }
  syncLangParam();

  /* ---------------------------------------------------------- online count */

  each(doc.querySelectorAll('[data-filter-group]'), function (group) {
    var scope = doc.querySelector(group.getAttribute('data-filter-group'));
    var numEl = doc.querySelector('[data-online-count]');
    var catEl = doc.querySelector('[data-online-cat]');
    if (!scope || !numEl) return;
    var shown = parseInt(numEl.textContent, 10) || 0;
    var raf = 0;

    function label() {
      var active = group.querySelector('[data-filter].is-active [data-i18n]');
      if (catEl && active && catEl.textContent !== active.textContent) catEl.textContent = active.textContent;
    }
    function tween(to) {
      cancelAnimationFrame(raf);
      var from = shown;
      if (reduceMotion || from === to) { shown = to; numEl.textContent = to; return; }
      var start = performance.now(), dur = 420;
      (function tick(now) {
        var k = Math.min(1, (now - start) / dur);
        numEl.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick); else shown = to;
      })(start);
    }
    // core.js filters on the same click (its listener was added first)
    group.addEventListener('click', function (e) {
      if (!e.target.closest('[data-filter]')) return;
      scope.classList.add('is-filtered'); // rows animate in from now on (CSS), never on load
      tween(scope.querySelectorAll('[data-cat]:not(.is-hidden)').length);
      label();
    });
    doc.addEventListener('langchange', label);
    label();
  });

  /* --------------------------------------------------------------- sectors */

  each(doc.querySelectorAll('[data-explorer]'), function (explorer) {
    var tabs = explorer.querySelectorAll('[role="tab"]');

    function select(tab, focus) {
      each(tabs, function (x) {
        var on = x === tab;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.setAttribute('tabindex', on ? '0' : '-1');
        var panel = doc.getElementById(x.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    explorer.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      select(tab, false);
      // on narrow screens the panel sits below the list: bring it into view if it is hidden
      var panel = doc.getElementById(tab.getAttribute('aria-controls'));
      if (panel && window.innerWidth < 1100) {
        var r = panel.getBoundingClientRect();
        if (r.top > window.innerHeight - 80) panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
      }
    });

    explorer.addEventListener('keydown', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      var list = Array.prototype.slice.call(tabs);
      var i = list.indexOf(tab), next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = list[(i + 1) % list.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = list[(i - 1 + list.length) % list.length];
      else if (e.key === 'Home') next = list[0];
      else if (e.key === 'End') next = list[list.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next, true);
    });
  });

  /* -------------------------------------------------------------- scenario */

  var SCENARIOS = {
    cons: { income: 100000, costs: 25000, net: 75000, roi: 7.5 },
    base: { income: 130000, costs: 25000, net: 105000, roi: 10.5 },
    opt:  { income: 180000, costs: 30000, net: 150000, roi: 15.0 }
  };
  var BAR_MAX = 180000;

  function money(n) {
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === 'en' ? ',' : ' ');
    return lang() === 'en' ? '$' + s : s + ' $';
  }
  function pct(n) {
    var s = n.toFixed(1);
    return lang() === 'en' ? s : s.replace('.', ',');
  }

  each(doc.querySelectorAll('[data-scenario]'), function (box) {
    var btns = box.querySelectorAll('[data-sc]');
    var roiEl = box.querySelector('[data-sc-roi]');
    var liveEl = box.querySelector('[data-sc-live]');
    var roiLabel = box.querySelector('[data-i18n="sc.roi"]');
    var netLabel = box.querySelector('[data-i18n="sc.bar.net"]');
    var keys = ['income', 'costs', 'net'];
    var bars = {}, vals = {};
    keys.forEach(function (k) {
      bars[k] = box.querySelector('[data-sc-bar="' + k + '"]');
      vals[k] = box.querySelector('[data-sc-val="' + k + '"]');
    });
    var shownRoi = SCENARIOS[box.getAttribute('data-active')] ? SCENARIOS[box.getAttribute('data-active')].roi : 10.5;
    var raf = 0;
    // the pill (.seg__thumb) is positioned by CSS from [data-active]: nothing to measure here

    function tweenRoi(to) {
      cancelAnimationFrame(raf);
      var from = shownRoi;
      if (reduceMotion || from === to) { shownRoi = to; roiEl.textContent = pct(to); return; }
      var start = performance.now(), dur = 650;
      (function tick(now) {
        var k = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        shownRoi = from + (to - from) * eased;
        roiEl.textContent = pct(shownRoi);
        if (k < 1) raf = requestAnimationFrame(tick); else shownRoi = to;
      })(start);
    }

    function render(key, animate) {
      var d = SCENARIOS[key];
      if (!d) return;
      box.setAttribute('data-active', key);
      each(btns, function (b) {
        var on = b.getAttribute('data-sc') === key;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      keys.forEach(function (k) {
        if (bars[k]) bars[k].style.setProperty('--s', (d[k] / BAR_MAX).toFixed(4));
        if (vals[k]) vals[k].textContent = money(d[k]);
      });
      if (roiEl) { if (animate) tweenRoi(d.roi); else { shownRoi = d.roi; roiEl.textContent = pct(d.roi); } }
      // one polite announcement per change (the visible number tweens frame by frame)
      if (liveEl && animate) {
        liveEl.textContent = (roiLabel ? roiLabel.textContent : 'ROI') + ': ' + pct(d.roi) + '% · ' +
          (netLabel ? netLabel.textContent : '') + ': ' + money(d.net);
      }
    }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sc]');
      if (b) render(b.getAttribute('data-sc'), true);
    });

    render(box.getAttribute('data-active') || 'base', false);
    doc.addEventListener('langchange', function () { render(box.getAttribute('data-active'), false); });
  });

  /* --------------------------------------------------------------- roadmap */

  var roadmaps = Array.prototype.slice.call(doc.querySelectorAll('[data-roadmap]'));
  var rmTicking = false;

  function atOf(el, prop) { return parseFloat(el.style.getPropertyValue(prop)) || 0; }
  function updateRoadmaps() {
    rmTicking = false;
    var vh = window.innerHeight;
    roadmaps.forEach(function (rm) {
      var r = rm.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var p = reduceMotion ? 1 : clamp((vh * 0.88 - r.top) / (vh * 0.6), 0, 1);
      rm.style.setProperty('--p', p.toFixed(4));
      var months = p * 36;
      rm.qqPhases.forEach(function (ph) { ph.el.classList.toggle('is-active', p > 0.02 && months >= ph.from); });
      rm.qqNodes.forEach(function (n) { n.el.classList.toggle('is-active', p > 0.02 && months >= n.at); });
    });
  }
  roadmaps.forEach(function (rm) {
    rm.qqPhases = Array.prototype.map.call(rm.querySelectorAll('.phase'), function (el) { return { el: el, from: atOf(el, '--from') }; });
    rm.qqNodes = Array.prototype.map.call(rm.querySelectorAll('.roadmap__node'), function (el) { return { el: el, at: atOf(el, '--at') }; });
  });
  if (roadmaps.length) {
    window.addEventListener('scroll', function () {
      if (!rmTicking) { rmTicking = true; requestAnimationFrame(updateRoadmaps); }
    }, { passive: true });
    window.addEventListener('resize', updateRoadmaps, { passive: true });
    updateRoadmaps();
  }

  /* --------------------------------------------------------- chapter index */

  each(doc.querySelectorAll('[data-chapter-nav]'), function (cnav) {
    var list = cnav.querySelector('.chapter-nav__list');
    var links = cnav.querySelectorAll('a[href^="#"]');
    var byId = {}, current = null;
    each(links, function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    function setCurrent(a) {
      if (a === current) return;
      current = a;
      each(links, function (x) {
        var on = x === a;
        x.classList.toggle('is-current', on);
        if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
      });
      // keep the highlighted item in view on narrow screens (horizontal scroll only);
      // above the first sub-section the strip returns to its start
      if (list && list.scrollWidth > list.clientWidth + 2) {
        var left = a ? a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2 : 0;
        list.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    // edge fades show which side of an overflowing strip still hides links
    function edges() {
      if (!list) return;
      var max = list.scrollWidth - list.clientWidth;
      cnav.classList.toggle('has-more-start', max > 2 && list.scrollLeft > 2);
      cnav.classList.toggle('has-more-end', max > 2 && list.scrollLeft < max - 2);
    }
    if (list) {
      list.addEventListener('scroll', edges, { passive: true });
      window.addEventListener('resize', edges, { passive: true });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(edges);
      edges();
    }

    if (!hasIO) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setCurrent(byId[en.target.id]); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = doc.getElementById(id);
      if (sec) io.observe(sec);
    });
    // nothing is current above the first sub-section
    var first = doc.getElementById(Object.keys(byId)[0]);
    if (first) {
      window.addEventListener('scroll', function () {
        if (current && first.getBoundingClientRect().top > window.innerHeight * 0.4) setCurrent(null);
      }, { passive: true });
    }
  });

  /* ----------------------------------------------------------- rekvizitlər */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  each(doc.querySelectorAll('[data-copy-target]'), function (btn) {
    var timer = 0;
    btn.addEventListener('click', function () {
      var list = doc.querySelector(btn.getAttribute('data-copy-target'));
      if (!list) return;
      var lines = [];
      each(list.querySelectorAll(':scope > div'), function (row) {
        var dt = row.querySelector('dt'), dd = row.querySelector('dd');
        if (!dt || !dd) return;
        var value = dd.innerText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).join(', ');
        lines.push(dt.textContent.trim() + ': ' + value);
      });
      var status = btn.closest('.req').querySelector('[data-copy-status]');
      copyText(lines.join('\n')).then(function () {
        btn.classList.add('is-copied');
        if (status) status.textContent = t('req.copied', 'Rekvizitlər mübadilə buferinə kopyalandı.');
      }, function () {
        if (status) status.textContent = t('req.copyFail', 'Avtomatik kopyalama mümkün olmadı — mətni seçib əl ilə kopyalayın.');
      });
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.classList.remove('is-copied');
        if (status) status.textContent = '';
      }, 4000);
    });
  });

  /* ---------------------------------------------------------- service pick */

  var serviceSelect = doc.getElementById('f-service');
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-service-pick]');
    if (!a || !serviceSelect) return;
    var v = a.getAttribute('data-service-pick');
    if (serviceSelect.querySelector('option[value="' + v + '"]')) serviceSelect.value = v;
  });

  /* ------------------------------------------------------------------ form */

  // core.js validates with reportValidity(). Cancelling each 'invalid' event hides the
  // browser's bubble (shown in the browser's language, not the page's) and the matching
  // translated message under the field is shown instead: .field__error[data-err="<validity flag>"].
  each(doc.querySelectorAll('form[data-wa-form]'), function (form) {
    var focusedInRound = false;
    each(form.querySelectorAll('input, select, textarea'), function (f) {
      var field = f.closest('.field');
      var errs = field ? field.querySelectorAll('.field__error') : [];
      function sync() {
        var v = f.validity, shown = null;
        each(errs, function (er) {
          var on = !v.valid && !shown && !!v[er.getAttribute('data-err')];
          er.hidden = !on;
          if (on) shown = er;
        });
        if (!v.valid && !shown && errs.length) { errs[0].hidden = false; shown = errs[0]; }
        if (field) field.classList.toggle('is-invalid', !v.valid);
        if (v.valid) { f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby'); }
        else { f.setAttribute('aria-invalid', 'true'); if (shown) f.setAttribute('aria-describedby', shown.id); }
      }
      f.addEventListener('invalid', function (e) {
        e.preventDefault();
        sync();
        if (!focusedInRound) {
          focusedInRound = true;
          f.focus();
          setTimeout(function () { focusedInRound = false; }, 0);
        }
      });
      f.addEventListener('input', function () {
        if (field && field.classList.contains('is-invalid')) sync();
      });
    });
    // the "don't forget to press send" note belongs to the last submission only
    form.addEventListener('input', function () { form.classList.remove('is-sent'); });
  });

  /* ------------------------------------------------------------------- map */

  each(doc.querySelectorAll('[data-map]'), function (map) {
    var btn = map.querySelector('[data-map-load]');
    var frame = map.querySelector('iframe[data-src]');
    var open = map.querySelector('.map__open');
    if (!btn || !frame) return;
    btn.addEventListener('click', function () {
      frame.src = frame.getAttribute('data-src');
      frame.hidden = false;
      if (open) open.hidden = false;
      map.classList.add('is-loaded');
      frame.focus();
    });
  });

  /* ---------------------------------------------------- header & floating */

  var header = doc.querySelector('.site-header');
  var fab = doc.querySelector('.fab');
  var darkZones = Array.prototype.slice.call(doc.querySelectorAll('.dark, .ticker, .site-footer'));
  var shadeTicking = false;

  function overDark(y) {
    for (var i = 0; i < darkZones.length; i++) {
      var r = darkZones[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return true;
    }
    return false;
  }
  function updateShade() {
    shadeTicking = false;
    if (header) header.classList.toggle('is-on-dark', overDark(header.offsetHeight / 2));
    if (fab) fab.classList.toggle('is-on-dark', overDark(window.innerHeight - 60));
  }
  window.addEventListener('scroll', function () {
    if (!shadeTicking) { shadeTicking = true; requestAnimationFrame(updateShade); }
  }, { passive: true });
  window.addEventListener('resize', updateShade, { passive: true });
  updateShade();

  // The hero and the contact section already offer the same actions, the footer lists
  // them too, and over the sector ROI list, the $1M scenario (toggle and table) and the
  // investor questions the buttons would sit on the right-aligned figures and +/- toggles.
  if (fab) {
    var zones = doc.querySelectorAll('.hero, .roi, .scenario, .faq, #contact, .site-footer');
    if (hasIO && zones.length) {
      var zoneOn = [];
      var fabIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { zoneOn[Array.prototype.indexOf.call(zones, en.target)] = en.isIntersecting; });
        var tucked = zoneOn.some(Boolean);
        fab.classList.toggle('is-tucked', tucked);
        if (tucked) fab.setAttribute('inert', ''); else fab.removeAttribute('inert');
        fab.classList.add('is-ready');
      });
      each(zones, function (z) { fabIo.observe(z); });
    } else {
      fab.classList.add('is-ready');
    }
  }

  /* ----------------------------------------------------------- current nav */

  var navLinks = doc.querySelectorAll('.site-nav__list a[href^="#"]');
  if (hasIO && navLinks.length) {
    var byId = {};
    each(navLinks, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        each(navLinks, function (a) {
          var on = a === byId[entry.target.id];
          a.classList.toggle('is-current', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = doc.getElementById(id);
      if (sec) navObserver.observe(sec);
    });
    // above the first section nothing is current
    var hero = doc.getElementById('top');
    if (hero) new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) each(navLinks, function (a) { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
    }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }

  /* ------------------------------------------------------------ mobile nav */

  var toggle = doc.querySelector('[data-nav-toggle]');
  var nav = doc.getElementById('site-nav');
  if (toggle && nav) {
    var wasOpen = false;
    new MutationObserver(function () {
      var open = doc.body.classList.contains('nav-open');
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) {
        setTimeout(function () {
          var first = nav.querySelector('a');
          if (first && doc.body.classList.contains('nav-open')) first.focus({ preventScroll: true });
        }, 320);
      } else if (nav.contains(doc.activeElement)) {
        toggle.focus({ preventScroll: true });
      }
    }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });

    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !doc.body.classList.contains('nav-open')) return;
      var items = [toggle].concat(Array.prototype.filter.call(
        nav.querySelectorAll('a, button'),
        function (el) { return el.offsetParent !== null; }
      ));
      var i = items.indexOf(doc.activeElement);
      var next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next].focus();
    });

    // closing the menu with a language button keeps the menu open on purpose;
    // closing when the viewport grows to desktop avoids a stuck scroll lock
    window.matchMedia('(min-width: 1101px)').addEventListener('change', function (mq) {
      if (mq.matches && doc.body.classList.contains('nav-open')) toggle.click();
    });
  }
})();
