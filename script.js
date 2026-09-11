/* =================================================================
   32 СТОМАТОЛОГИЯ — script.js
   Модули:
   1. CONFIG            — настройки (endpoint формы и т.п.)
   2. Header            — фон шапки при скролле
   3. MobileMenu        — бургер-меню
   4. Reveal            — плавное появление блоков при прокрутке
   5. Parallax          — лёгкое движение фоновых декораций
   6. WorksCarousel     — ручная горизонтальная карусель
   7. AppointmentForm   — валидация + отправка заявки
                          (готово к подключению Cloudflare Workers + Green API)
   7b. AboutCards       — поочерёдный бесконечный показ изображений
   8. Misc              — год в футере
================================================================== */

(function () {
  "use strict";

  /* ===============================================================
     1. CONFIG
     ---------------------------------------------------------------
     ENDPOINT — адрес вашего Cloudflare Worker, который примет заявку
     и перешлёт её в WhatsApp через Green API.
     Пока endpoint пустой — форма работает в демо-режиме
     (показывает успех без реальной отправки).
  ================================================================ */
  var CONFIG = {
    // Адрес развёрнутого Cloudflare Worker (см. cloudflare-worker/).
    // После `wrangler deploy` сюда вставить выданный URL, например:
    //   "https://stom-lead.ВАШ-СУБДОМЕН.workers.dev"
    // Пока пусто — форма в демо-режиме (успех без реальной отправки).
    ENDPOINT: "https://stom-lead.crycrazydiamond.workers.dev",
    // Таймаут запроса, мс
    TIMEOUT: 12000
  };


  /* ===============================================================
     Утилиты
  ================================================================ */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var on = function (el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); };


  /* ===============================================================
     2. HEADER — добавляем тень/границу после прокрутки
  ================================================================ */
  function initHeader() {
    var header = $("#header");
    if (!header) return;
    var hero = $("#hero");
    var toggle = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      // Пока мы в пределах hero — прячем кнопку "Записаться" в шапке.
      // Как только прокрутили ниже hero — кнопка появляется.
      if (hero) {
        var onHero = window.scrollY < hero.offsetHeight - header.offsetHeight;
        header.classList.toggle("at-hero", onHero);
      }
    };
    toggle();
    on(window, "scroll", toggle, { passive: true });
    on(window, "resize", toggle, { passive: true });
  }


  /* ===============================================================
     3. MOBILE MENU
  ================================================================ */
  function initMobileMenu() {
    var burger = $("#burger");
    var nav = $("#nav");
    if (!burger || !nav) return;

    var close = function () {
      nav.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    };

    on(burger, "click", function () {
      var open = nav.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    });

    // закрытие при клике по ссылке
    $$(".nav__link", nav).forEach(function (link) { on(link, "click", close); });

    // закрытие при ресайзе на десктоп
    on(window, "resize", function () { if (window.innerWidth > 880) close(); });
  }


  /* ===============================================================
     4. REVEAL — появление блоков при прокрутке
  ================================================================ */
  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (el) { io.observe(el); });
  }


  /* ===============================================================
     5. PARALLAX — мягкое движение фоновых декораций
  ================================================================ */
  function initParallax() {
    var layers = $$("[data-parallax]");
    if (!layers.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var ticking = false;
    var update = function () {
      var y = window.scrollY;
      layers.forEach(function (el) {
        var speed = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = "translate3d(0, " + (-y * speed).toFixed(1) + "px, 0)";
      });
      ticking = false;
    };

    on(window, "scroll", function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }


  /* ===============================================================
     6. НАШИ РАБОТЫ — витрина: один большой кейс, стрелки по бокам
  ================================================================ */
  function initWorksShowcase() {
    var slidesEl = $("#showcaseSlides");
    var prev = $("#worksPrev");
    var next = $("#worksNext");
    if (!slidesEl) return;
    var slides = $$(".showcase__slide", slidesEl);
    if (!slides.length) return;

    var index = 0;

    var update = function () {
      slidesEl.style.transform = "translateX(" + (-index * 100) + "%)";
      slides.forEach(function (s, i) { s.classList.toggle("is-current", i === index); });
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
    };

    on(prev, "click", function () { if (index > 0) { index--; update(); } });
    on(next, "click", function () { if (index < slides.length - 1) { index++; update(); } });
    update();

    // --- Before / After слайдеры внутри кейсов ---
    $$("[data-ba]", slidesEl).forEach(initBASlider);
  }

  /* Интерактивный Before/After слайдер: pointer (мышь + touch), rAF-плавность */
  function initBASlider(ba) {
    var handle = $(".ba__handle", ba);
    var raf = null, pending = 50, dragging = false;

    var render = function () {
      raf = null;
      var pct = Math.max(0, Math.min(100, pending));
      ba.style.setProperty("--pos", pct + "%");
      if (handle) handle.setAttribute("aria-valuenow", Math.round(pct));
    };
    var schedule = function (pct) {
      pending = pct;
      if (raf == null) raf = requestAnimationFrame(render);
    };
    var pctFromX = function (clientX) {
      var r = ba.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    };

    on(ba, "pointerdown", function (e) {
      dragging = true;
      ba.classList.add("is-dragging");
      try { ba.setPointerCapture(e.pointerId); } catch (err) {}
      schedule(pctFromX(e.clientX));
      e.preventDefault();
    });
    on(ba, "pointermove", function (e) {
      if (!dragging) return;
      schedule(pctFromX(e.clientX));
      e.preventDefault();                 // гасим горизонтальный скролл во время перетаскивания
    });
    var stop = function () {
      if (!dragging) return;
      dragging = false;
      ba.classList.remove("is-dragging");
    };
    on(ba, "pointerup", stop);
    on(ba, "pointercancel", stop);

    // клавиатура для доступности
    if (handle) {
      on(handle, "keydown", function (e) {
        var cur = parseFloat(ba.style.getPropertyValue("--pos")) || 50;
        if (e.key === "ArrowLeft")  { schedule(cur - 4); e.preventDefault(); }
        if (e.key === "ArrowRight") { schedule(cur + 4); e.preventDefault(); }
        if (e.key === "Home")       { schedule(0);  e.preventDefault(); }
        if (e.key === "End")        { schedule(100); e.preventDefault(); }
      });
    }

    // стартовое положение из inline --pos (или 50%)
    pending = parseFloat(ba.style.getPropertyValue("--pos")) || 50;
    render();
  }


  /* ===============================================================
     5b. HERO SLIDER — плавная авто-смена фотографий (fade + ken-burns)
  ================================================================ */
  function initHeroSlider() {
    var slides = $$(".hero__slide");
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var i = 0;
    setInterval(function () {
      slides[i].classList.remove("is-active");
      i = (i + 1) % slides.length;
      slides[i].classList.add("is-active");
    }, 5500);
  }


  /* ===============================================================
     6b. НАША КОМАНДА — горизонтальная карусель с активной центральной
  ================================================================ */
  function initDoctorsCarousel() {
    var track = $("#docsTrack");
    if (!track) return;
    var cards = $$(".docs__card", track);
    var prev = $("#docsPrev");
    var next = $("#docsNext");
    if (!cards.length) return;

    var step = function () {
      var gap = parseInt(getComputedStyle(track).columnGap || "22", 10);
      return cards[0].getBoundingClientRect().width + gap;
    };

    // определяем карточку, ближайшую к центру трека, и делаем её активной
    var raf = null;
    var updateActive = function () {
      raf = null;
      var tr = track.getBoundingClientRect();
      var center = tr.left + tr.width / 2;
      var best = null, bestDist = Infinity;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestDist) { bestDist = d; best = c; }
      });
      cards.forEach(function (c) { c.classList.toggle("is-active", c === best); });
    };
    var scheduleActive = function () {
      if (raf == null) raf = requestAnimationFrame(updateActive);
    };

    var updateButtons = function () {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    };

    on(track, "scroll", function () { scheduleActive(); updateButtons(); }, { passive: true });
    on(prev, "click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    on(next, "click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
    on(window, "resize", function () { scheduleActive(); updateButtons(); });

    // --- перетаскивание мышью + лёгкая инерция ---
    var down = false, startX = 0, startScroll = 0, moved = false;
    var lastX = 0, lastT = 0, vel = 0, momId = null;

    on(track, "pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;   // на тач — нативный скролл с инерцией
      if (e.target.closest("a, button")) return;
      down = true; moved = false;
      startX = e.clientX; startScroll = track.scrollLeft;
      lastX = e.clientX; lastT = performance.now(); vel = 0;
      if (momId) cancelAnimationFrame(momId);
      track.classList.add("is-grabbing");
    });
    on(window, "pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      track.scrollLeft = startScroll - dx;
      var now = performance.now(), dt = now - lastT;
      if (dt > 0) vel = (e.clientX - lastX) / dt;   // px/мс
      lastX = e.clientX; lastT = now;
    });
    var release = function () {
      if (!down) return;
      down = false;
      var v = vel * 16;                 // на кадр
      var glide = function () {
        if (Math.abs(v) < 0.5) {
          track.classList.remove("is-grabbing");   // вернуть snap → мягко доводит к центру
          scheduleActive();
          return;
        }
        track.scrollLeft -= v;
        v *= 0.92;                       // затухание
        momId = requestAnimationFrame(glide);
      };
      if (Math.abs(v) > 0.6) { glide(); }
      else { track.classList.remove("is-grabbing"); }
    };
    on(window, "pointerup", release);
    on(window, "pointercancel", release);
    // не даём клику по ссылке «проскочить» после драга
    on(track, "click", function (e) { if (moved) e.preventDefault(); }, true);

    // старт: центрируем и подсвечиваем среднюю карточку
    updateActive();
    updateButtons();
    on(window, "load", function () { updateActive(); updateButtons(); });
  }


  /* ===============================================================
     7. APPOINTMENT FORM
     ---------------------------------------------------------------
     Архитектура подготовлена под Cloudflare Workers + Green API.

     Поток данных:
       Форма  -> POST JSON ->  Cloudflare Worker  ->  Green API  ->  WhatsApp

     Worker (пример псевдокода на стороне сервера):
       const { name, phone, comment } = await request.json();
       const text = "Новая заявка\nИмя: " + name + "\nТел: " + phone + "\nКомм: " + comment;
       await fetch("https://api.green-api.com/waInstance" + ID + "/sendMessage/" + TOKEN, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chatId: "НОМЕР@c.us", message: text })
       });

     Здесь, на клиенте, мы только собираем и валидируем данные
     и отправляем их на CONFIG.ENDPOINT.
  ================================================================ */
  var AppointmentForm = {
    init: function () {
      this.form = $("#appointmentForm");
      if (!this.form) return;
      this.statusEl = $("#formStatus");
      this.submitBtn = $("#formSubmit");
      this.phoneInput = $("#phone");

      var self = this;
      this.form.setAttribute("novalidate", "novalidate");
      on(this.form, "submit", function (e) { self.handleSubmit(e); });
      on(this.phoneInput, "input", function () { self.formatPhone(); });

      // снимаем подсветку ошибки при вводе
      $$(".field input, .field textarea", this.form).forEach(function (el) {
        on(el, "input", function () { el.closest(".field").classList.remove("is-invalid"); });
      });
    },

    // лёгкое форматирование телефона при вводе
    formatPhone: function () {
      var v = this.phoneInput.value.replace(/[^\d+]/g, "");
      if (v && v[0] !== "+") v = "+" + v.replace(/\+/g, "");
      this.phoneInput.value = v.slice(0, 16);
    },

    // сбор и валидация
    collect: function () {
      var hp = $("#company");
      var data = {
        name: $("#name").value.trim(),
        phone: $("#phone").value.trim(),
        comment: $("#comment").value.trim(),
        company: hp ? hp.value.trim() : "" // honeypot: у людей всегда пусто
      };
      var errors = [];
      if (data.name.length < 2) errors.push("name");
      // минимум 9 цифр в номере
      if (data.phone.replace(/\D/g, "").length < 9) errors.push("phone");
      return { data: data, errors: errors };
    },

    markErrors: function (fields) {
      $$(".field", this.form).forEach(function (f) { f.classList.remove("is-invalid"); });
      fields.forEach(function (id) {
        var input = $("#" + id);
        if (input) input.closest(".field").classList.add("is-invalid");
      });
    },

    setStatus: function (msg, type) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.classList.remove("is-success", "is-error");
      if (type) this.statusEl.classList.add("is-" + type);
    },

    setLoading: function (state) {
      if (!this.submitBtn) return;
      this.submitBtn.classList.toggle("is-loading", state);
      this.submitBtn.disabled = state;
      var label = $(".btn__label", this.submitBtn);
      if (label) label.textContent = state ? "Отправляем…" : "Отправить заявку";
    },

    // отправка на сервер (Cloudflare Worker)
    send: function (payload) {
      // Демо-режим: endpoint не настроен — имитируем успешную отправку.
      if (!CONFIG.ENDPOINT) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            console.info("[demo] Заявка собрана, endpoint не настроен:", payload);
            resolve({ ok: true, demo: true });
          }, 700);
        });
      }

      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, CONFIG.TIMEOUT);
      return fetch(CONFIG.ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return { ok: true };
      }).finally(function () { clearTimeout(timer); });
    },

    handleSubmit: function (e) {
      e.preventDefault();
      var result = this.collect();
      var data = result.data;
      var errors = result.errors;

      if (errors.length) {
        this.markErrors(errors);
        this.setStatus("Проверьте имя и номер телефона.", "error");
        return;
      }

      this.setStatus("", null);
      this.setLoading(true);

      var payload = {
        name: data.name,
        phone: data.phone,
        comment: data.comment,
        source: "website",
        page: location.href,
        sentAt: new Date().toISOString()
      };

      var self = this;
      this.send(payload).then(function () {
        self.form.reset();
        self.setStatus("Спасибо! Заявка принята — мы скоро перезвоним.", "success");
      }).catch(function (err) {
        console.error("Ошибка отправки заявки:", err);
        self.setStatus("Не удалось отправить. Позвоните нам: +996 555 003 200", "error");
      }).then(function () {
        self.setLoading(false);
      });
    }
  };


  /* ===============================================================
     7b. ABOUT CARDS — поочерёдный бесконечный показ изображений
     ---------------------------------------------------------------
     Карточки по умолчанию без фото. После загрузки изображения
     проявляются строго по очереди: каждая полностью отыгрывает
     цикл (проявление, пауза, исчезновение), и только потом
     стартует следующая. Затем цикл повторяется бесконечно.
     Наведение курсора работает независимо (через CSS :hover).
  ================================================================ */
  function initAboutCards() {
    var cards = $$(".mini-card");
    if (!cards.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var FADE = 600;   // длительность проявления/исчезновения (синхронно с CSS)
    var HOLD = 2500;  // сколько изображение остаётся видимым
    var GAP  = 350;   // пауза перед следующей карточкой

    var i = 0;
    var step = function () {
      var card = cards[i];
      card.classList.add("is-showing");           // проявляем
      setTimeout(function () {
        card.classList.remove("is-showing");        // исчезаем
        setTimeout(function () {
          i = (i + 1) % cards.length;               // следующая карточка
          step();
        }, FADE + GAP);
      }, FADE + HOLD);
    };

    setTimeout(step, 900); // небольшая задержка после загрузки
  }


  /* ===============================================================
     8. MISC
  ================================================================ */
  function initMisc() {
    var year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }


  /* ===============================================================
     ИНИЦИАЛИЗАЦИЯ
  ================================================================ */
  function init() {
    initHeader();
    initHeroSlider();
    initMobileMenu();
    initReveal();
    initParallax();
    initWorksShowcase();
    initDoctorsCarousel();
    initAboutCards();
    AppointmentForm.init();
    initMisc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
