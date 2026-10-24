/*
 * Qaraqoyunlu Technology — site-specific interactions.
 * Loaded after core.js (i18n, reveal, counters, nav, spotlight, forms live there).
 *
 *   1. HUD timecode               6. Mobile menu: inert background, focus, resize
 *   2. Camera locations (plans)   7. Floating button: hidden where it would cover content
 *   3. Smart-home demo            8. (off-screen pausing: [data-pause-offscreen], core.js)
 *   4. Copy company details       9. Service rows preselect the form
 *   5. Scroll-spy for the nav    10. Form: announce "WhatsApp opened"
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toArray(list) { return Array.prototype.slice.call(list); }

  /* ------------------------------------------------------ 1. HUD timecode */

  // Only clocks that are on screen are updated, and only their text: no work while off-screen.
  var clocks = toArray(document.querySelectorAll('[data-timecode]')).map(function (el) {
    var withDate = el.classList.contains('hud__time');
    el.innerHTML = (withDate ? '<span class="tc-date"></span>' : '') + '<span></span>';
    return { el: el, date: withDate ? el.firstChild : null, time: el.lastChild, on: !hasIO };
  });
  function tick(all) {
    var d = new Date();
    var date = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' · ';
    var time = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    clocks.forEach(function (c) {
      if (!c.on && all !== true) return;
      if (c.date && c.date.textContent !== date) c.date.textContent = date;
      c.time.textContent = time;
    });
  }
  if (clocks.length) {
    if (hasIO) {
      var clockIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          clocks.forEach(function (c) { if (c.el === en.target) c.on = en.isIntersecting; });
        });
      });
      clocks.forEach(function (c) { clockIO.observe(c.el); });
    }
    tick(true);
    setInterval(tick, 1000);
  }

  /* ----------------------------------------- 2. Camera locations (plans) */

  var locRoot = document.querySelector('[data-loc]');
  if (locRoot) {
    var items = toArray(locRoot.querySelectorAll('[data-loc-item]'));
    var plans = toArray(locRoot.querySelectorAll('[data-plan]'));
    var list = locRoot.querySelector('.loc');
    var label = locRoot.querySelector('[data-loc-label]');
    var noteOut = locRoot.querySelector('[data-loc-note]');
    var camNo = locRoot.querySelector('[data-loc-cam]');
    var vf = locRoot.querySelector('[data-loc-vf]');
    var DURATION = 4200;
    var current = 0;
    var timer = null;
    var autoplay = !reduceMotion;
    var inView = false;

    list.style.setProperty('--loc-dur', DURATION + 'ms');

    // HUD label and the caption under the plan follow the active item (and the language)
    var syncText = function () {
      var name = items[current].querySelector('.loc__name');
      var note = items[current].querySelector('.loc__note');
      if (name && label) label.textContent = name.textContent;
      if (note && noteOut) noteOut.textContent = note.textContent;
    };

    var select = function (i) {
      current = i;
      items.forEach(function (b, k) {
        var on = k === i;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      plans.forEach(function (g, k) { g.classList.toggle('is-active', k === i); });
      if (camNo) camNo.textContent = pad(i + 1);
      syncText();
      if (vf && !reduceMotion) {
        vf.classList.remove('is-refocus');
        void vf.offsetWidth; // restart the refocus animation
        vf.classList.add('is-refocus');
      }
    };

    var schedule = function () {
      clearTimeout(timer);
      if (!autoplay || !inView) return;
      timer = setTimeout(function () {
        select((current + 1) % items.length);
        schedule();
      }, DURATION);
    };

    var stopAuto = function () {
      autoplay = false;
      clearTimeout(timer);
      list.classList.remove('is-auto');
    };

    items.forEach(function (b, i) {
      b.addEventListener('click', function () { stopAuto(); select(i); });
    });

    if (autoplay && hasIO) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (!autoplay) return;
        if (inView) {
          list.classList.add('is-auto');
          select(current); // restart the progress bar
          schedule();
        } else {
          clearTimeout(timer);
          list.classList.remove('is-auto');
        }
      }, { threshold: 0.35 }).observe(locRoot);
    }

    document.addEventListener('langchange', syncText);
    select(0);
  }

  /* -------------------------------------------------- 3. Smart-home demo */

  var device = document.querySelector('[data-smart]');
  if (device) {
    var tiles = toArray(device.querySelectorAll('[data-device]'));
    var countEl = device.querySelector('[data-smart-count]');
    var SCENES = {
      home: { light: 1, curtain: 1, boiler: 1, gas: 1, water: 1, lock: 0, solar: 1 },
      away: { light: 0, curtain: 0, boiler: 0, gas: 0, water: 0, lock: 1, solar: 1 }
    };

    var setDevice = function (name, on) {
      device.setAttribute('data-' + name, on ? 'on' : 'off');
      var tile = device.querySelector('[data-device="' + name + '"]');
      if (tile) tile.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    var updateCount = function () {
      var n = tiles.filter(function (t) { return t.getAttribute('aria-pressed') === 'true'; }).length;
      if (countEl) countEl.textContent = n;
      device.classList.toggle('is-live', n > 0);
    };

    var sceneBtns = toArray(device.querySelectorAll('[data-scene]'));
    var markScene = function (btn) {
      sceneBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
    };

    tiles.forEach(function (tile) {
      tile.addEventListener('click', function () {
        setDevice(tile.getAttribute('data-device'), tile.getAttribute('aria-pressed') !== 'true');
        updateCount();
        markScene(null); // a manual change leaves the scene
      });
    });

    sceneBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        markScene(btn);
        var scene = SCENES[btn.getAttribute('data-scene')];
        Object.keys(scene).forEach(function (name, i) {
          // devices switch one after another — a small, readable cascade
          setTimeout(function () { setDevice(name, !!scene[name]); updateCount(); }, reduceMotion ? 0 : i * 90);
        });
      });
    });

    updateCount();
  }

  /* --------------------------------------------- 4. Copy company details */

  var req = document.querySelector('[data-req]');
  if (req) {
    var toastTimer = null;

    var copyText = function (text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { if (document.execCommand('copy')) resolve(); else reject(new Error('copy failed')); } catch (e) { reject(e); }
        document.body.removeChild(ta);
      });
    };

    var live = req.querySelector('[data-req-live]');
    var copiedText = req.querySelector('[data-copied-text]');
    var doneTimer = null;
    var lastBtn = null;

    // the pressed button shows a check (and "Copied") for a moment; screen readers hear it too
    var flash = function (btn) {
      if (lastBtn && lastBtn !== btn) lastBtn.classList.remove('is-done');
      lastBtn = btn;
      btn.classList.add('is-done');
      clearTimeout(doneTimer);
      doneTimer = setTimeout(function () { btn.classList.remove('is-done'); }, 1800);
      if (live) {
        live.textContent = '';
        setTimeout(function () { live.textContent = copiedText ? copiedText.textContent : 'OK'; }, 60);
      }
    };

    req.addEventListener('click', function (e) {
      var one = e.target.closest('[data-copy]');
      var all = e.target.closest('[data-copy-all]');
      var btn = one || all;
      var text = '';
      if (one) {
        text = one.getAttribute('data-copy');
      } else if (all) {
        text = toArray(req.querySelectorAll('.req__row')).map(function (row) {
          var key = row.querySelector('dt').textContent.trim();
          var val = row.querySelector('dd').innerText.replace(/\s*\n\s*/g, ', ').trim();
          return key + ': ' + val;
        }).join('\n');
      }
      if (text) copyText(text).then(function () { flash(btn); }, function () { /* clipboard blocked: nothing to do */ });
    });
  }

  /* ------------------------------------------------- 5. Scroll-spy (nav) */

  var navLinks = toArray(document.querySelectorAll('.site-nav__list a[href^="#"]'));
  if (navLinks.length && hasIO) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.toggle('is-current', a === link); });
        } else if (link.classList.contains('is-current')) {
          link.classList.remove('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ------------------------------- 6. Mobile menu: inert, focus, resize */

  var body = document.body;
  var toggle = document.querySelector('[data-nav-toggle]');
  var outside = toArray(document.querySelectorAll('main, .site-footer, .fab, .skip-link'));

  if (toggle) {
    var header = document.querySelector('.site-header');
    var wasOpen = false;

    // Keep keyboard/screen-reader focus inside the open menu; opening moves focus to the first link
    new MutationObserver(function () {
      var open = body.classList.contains('nav-open');
      if (open === wasOpen) return;
      wasOpen = open;
      outside.forEach(function (el) {
        if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert');
      });
      if (open) {
        var first = document.querySelector('.site-nav__list a');
        if (first) requestAnimationFrame(function () { first.focus({ preventScroll: true }); });
      }
    }).observe(body, { attributes: true, attributeFilter: ['class'] });

    // Tab / Shift+Tab wrap between the menu controls and the toggle
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !body.classList.contains('nav-open') || !header) return;
      var focusables = toArray(header.querySelectorAll('a[href], button:not([disabled])')).filter(function (el) {
        return el.offsetParent !== null || el === toggle;
      });
      if (!focusables.length) return;
      var firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });

    // Esc closes the menu (core.js) — return focus to the toggle
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('nav-open')) {
        setTimeout(function () { toggle.focus(); }, 0);
      }
    }, true);

    // Leaving the mobile layout closes the menu
    var desktop = window.matchMedia('(min-width: 1181px)');
    var onChange = function () { if (desktop.matches && body.classList.contains('nav-open')) toggle.click(); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ------- 7. Floating button: hidden where it would cover content ------- */

  // The hero, the tender card, the contact section and the footer already show the
  // same actions; the service index, the camera locations, the smart-home panel and
  // the family cards keep controls at the right edge. That is where the button
  // would cover numbers, buttons and text.
  // Only the bottom band of the screen (where the button sits) is watched, so the
  // button steps aside exactly while one of these zones passes underneath it.
  var fab = document.querySelector('.fab');
  if (fab) {
    var zones = toArray(document.querySelectorAll('.hero, .svc-index, .loc, [data-smart], #tender, #contact, .family, .site-footer'));
    if (hasIO && zones.length) {
      var zoneOn = zones.map(function () { return false; });
      var fabIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { zoneOn[zones.indexOf(en.target)] = en.isIntersecting; });
        var tucked = zoneOn.some(Boolean);
        fab.classList.toggle('is-tucked', tucked);
        if (tucked) fab.setAttribute('inert', ''); else fab.removeAttribute('inert');
        fab.classList.add('is-visible');
      }, { rootMargin: '-80% 0px 0px 0px' });
      zones.forEach(function (z) { fabIO.observe(z); });
    } else {
      fab.classList.add('is-visible');
    }
  }

  /* 8. Looping animations pause off-screen through core.js: [data-pause-offscreen] in the HTML */

  /* ------------------------------------ 9. Service rows preselect the form */

  var serviceSelect = document.getElementById('f-service');
  if (serviceSelect) {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-service]');
      if (link) serviceSelect.value = link.getAttribute('data-service');
    });
  }

  /* -------------------------------- 10. Form: announce "WhatsApp opened" */

  // core.js shows .form__sent after a valid submit; re-setting its text once it is
  // displayed makes the role="status" region actually speak.
  toArray(document.querySelectorAll('form[data-wa-form]')).forEach(function (form) {
    var sent = form.querySelector('.form__sent [data-i18n]');
    if (!sent) return;
    form.addEventListener('submit', function () {
      if (!form.classList.contains('is-sent')) return;
      var html = sent.innerHTML;
      sent.innerHTML = '';
      setTimeout(function () { sent.innerHTML = html; }, 120);
    });
  });
})();
