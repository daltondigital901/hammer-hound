// Hammer Hound site behaviour. No dependencies.
(function () {
  "use strict";
  var HH = window.HH || { endpoints: {} };
  var NOT_OPEN = "Hammer Hound is not open yet, so nothing was sent. Check back soon.";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Copyright year always follows the visitor's current date.
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Mobile menu
  var toggle = $("[data-menu-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var menu = document.getElementById("mobile-menu");
      var open = menu.hasAttribute("hidden");
      if (open) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  function status(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "form-status" + (kind ? " is-" + kind : "");
    el.removeAttribute("hidden");
  }
  function validPhone(v) { return v.replace(/\D/g, "").replace(/^1/, "").length === 10; }
  function validZip(v) { return /^\d{5}$/.test(v.trim()); }
  function checkFields(form) {
    var bad = null;
    $$("[required]", form).forEach(function (f) {
      if (f.closest("[hidden]")) return;
      var ok = f.type === "checkbox" ? f.checked : f.value.trim() !== "";
      if (ok && f.type === "tel") ok = validPhone(f.value);
      if (ok && f.type === "email") ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim());
      if (ok && f.name === "zip") ok = validZip(f.value);
      f.classList.toggle("is-bad", !ok);
      if (!ok && !bad) bad = f;
    });
    return bad;
  }
  function fieldName(f) {
    var l = f.id && $('label[for="' + f.id + '"]');
    return l ? l.textContent.trim().toLowerCase() : f.name;
  }
  function send(key, data, statusEl, button, okText) {
    var url = HH.endpoints[key];
    if (!url) { status(statusEl, NOT_OPEN); return Promise.resolve(false); }
    if (button) button.disabled = true;
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); status(statusEl, okText, "good"); return true; })
      .catch(function () { status(statusEl, "That did not go through. Check your connection and try again.", "bad"); if (button) button.disabled = false; return false; });
  }

  // Simple forms: contact, pro join, pro sign in
  var OK = { contact: "Message sent. We reply by email within 1 business day.", proJoin: "Account created. Check your texts for the next step.", proSignIn: "Code sent. Check your texts." };
  $$("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var st = $("[data-status]", form);
      var bad = checkFields(form);
      if (bad) { status(st, "Check your " + fieldName(bad) + ".", "bad"); bad.focus(); return; }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.page = location.pathname;
      send(form.getAttribute("data-form"), data, st, $("button[type=submit]", form), OK[form.getAttribute("data-form")]);
    });
  });
  var chat = $("[data-chat]");
  if (chat) chat.addEventListener("click", function () { status($("[data-chat-status]"), "Chat is not open yet. Use the message form for now."); });

  // Search and category filters (trades, cost guides)
  var filterInput = $("[data-filter]");
  if (filterInput) {
    var items = $$(filterInput.getAttribute("data-filter"));
    var groupSel = filterInput.getAttribute("data-filter-group");
    var empty = $("[data-filter-empty]");
    var category = "";
    var apply = function () {
      var q = filterInput.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var ok = (!q || it.getAttribute("data-text").indexOf(q) !== -1) && (!category || it.getAttribute("data-category") === category);
        it.hidden = !ok; if (ok) shown++;
      });
      if (groupSel) $$(groupSel).forEach(function (g) { g.hidden = !$$("[data-trade]:not([hidden])", g).length; });
      if (empty) empty.hidden = shown > 0;
    };
    filterInput.addEventListener("input", apply);
    $$("[data-category-btn]").forEach(function (b) {
      b.addEventListener("click", function () {
        category = b.getAttribute("data-category-btn");
        $$("[data-category-btn]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
        apply();
      });
    });
  }

  // Request flow
  var req = $("[data-request]");
  if (req) {
    var TR = JSON.parse(req.getAttribute("data-trades"));
    var form = $("form", req), step = 1, typeVal = "";
    var st = $("[data-status]", req), next = $("[data-next]", req), back = $("[data-back]", req);
    var val = function (name) { var c = $('input[name="' + name + '"]:checked', form); return c ? c.value : ""; };
    var text = function (name) { return form.elements[name] ? form.elements[name].value.trim() : ""; };
    var KEY = "hh-request";
    var save = function () {
      try {
        var d = { step: step, type: typeVal };
        ["trade", "property", "size", "budget", "timing", "pros"].forEach(function (n) { d[n] = val(n); });
        ["details", "address", "zip", "name"].forEach(function (n) { d[n] = text(n); });
        sessionStorage.setItem(KEY, JSON.stringify(d));
      } catch (e) { /* storage unavailable: progress just is not remembered */ }
    };
    var setRadio = function (name, v) { $$('input[name="' + name + '"]', form).forEach(function (i) { if (i.value === v) i.checked = true; }); };
    var renderTypes = function () {
      var t = val("trade"), block = $("[data-type-block]", req), box = $("[data-type-options]", req);
      var other = t === "other" || !TR[t];
      block.hidden = other;
      $("[data-details-optional]", req).textContent = other && t ? "" : "(optional)";
      $("#r-details").placeholder = other && t ? "Describe the job in your own words" : "Anything a pro should know";
      if (other) { typeVal = ""; return; }
      $("[data-type-legend]", req).textContent = "What kind of " + TR[t].name.toLowerCase() + " job?";
      box.innerHTML = "";
      TR[t].jobs.forEach(function (j) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chip chip--link" + (j === typeVal ? " is-on" : ""); b.textContent = j;
        b.addEventListener("click", function () { typeVal = j; renderTypes(); summary(); save(); });
        box.appendChild(b);
      });
    };
    var summary = function () {
      var t = val("trade"), rows = [];
      if (t) rows.push(t === "other" ? "Something else" : TR[t].name + (typeVal ? " · " + typeVal : ""));
      if (val("property") || val("size")) rows.push([val("property"), val("size")].filter(Boolean).join(" · "));
      if (val("budget")) rows.push(val("budget"));
      if (val("timing")) rows.push(val("timing"));
      if (step >= 3) rows.push(val("pros") === "1" ? "1 pro" : "Up to " + val("pros") + " pros");
      if (text("zip")) rows.push("ZIP " + text("zip"));
      var ul = $("[data-summary]", req); ul.innerHTML = "";
      if (!rows.length) { var li = document.createElement("li"); li.className = "meta"; li.textContent = "Pick a trade to start."; ul.appendChild(li); }
      rows.forEach(function (r) { var li = document.createElement("li"); li.textContent = r; ul.appendChild(li); });
      $("[data-consent-pros]", req).textContent = val("pros") === "1" ? "1 pro" : "up to " + val("pros") + " pros";
    };
    var show = function () {
      $$("[data-step]", req).forEach(function (s) { s.hidden = Number(s.getAttribute("data-step")) !== step; });
      $("[data-step-label]", req).textContent = "Step " + step + " of 4";
      $("[data-progress]", req).style.width = step * 25 + "%";
      back.hidden = step === 1;
      next.textContent = step === 4 ? "Send my request" : "Next";
      $("[data-next-info]", req).hidden = step !== 4;
      st.setAttribute("hidden", "");
      summary();
    };
    var problem = function () {
      if (step === 1) {
        if (!val("trade")) return "Pick a trade to continue.";
        if (val("trade") === "other" && !text("details")) return "Describe the job so we can match it to the right pros.";
        if (val("trade") !== "other" && TR[val("trade")] && !typeVal) return "Pick the kind of job.";
      }
      if (step === 2) {
        var missing = ["property", "size", "budget", "timing"].filter(function (n) { return !val(n); });
        if (missing.length) return "Answer every question to continue. Rough answers are fine.";
      }
      if (step === 4) {
        var bad = checkFields(form);
        if (bad) { bad.focus(); return bad.type === "checkbox" ? "Tick the box to agree to be contacted about this request." : "Check your " + fieldName(bad) + "."; }
      }
      return "";
    };
    next.addEventListener("click", function () {
      var p = problem();
      if (p) { status(st, p, "bad"); return; }
      if (step < 4) { step++; show(); save(); window.scrollTo(0, 0); return; }
      var data = { trade: val("trade"), type: typeVal, pros: Number(val("pros")), consent: true, consentText: $(".consent span", form).textContent.trim(), submittedAt: new Date().toISOString(), page: location.href };
      ["property", "size", "budget", "timing"].forEach(function (n) { data[n] = val(n); });
      ["details", "address", "zip", "name", "phone"].forEach(function (n) { data[n] = text(n); });
      send("request", data, st, next, "Request sent. Keep your phone close: we will call to confirm.").then(function (ok) {
        if (ok) { try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ } }
      });
    });
    back.addEventListener("click", function () { if (step > 1) { step--; show(); save(); } });
    form.addEventListener("change", function (e) {
      if (e.target.name === "trade") { typeVal = ""; renderTypes(); }
      summary(); save();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); next.click(); });

    // Restore saved progress, then apply anything passed in the link.
    try {
      var saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (saved) {
        ["trade", "property", "size", "budget", "timing", "pros"].forEach(function (n) { if (saved[n]) setRadio(n, saved[n]); });
        ["details", "address", "zip", "name"].forEach(function (n) { if (saved[n] && form.elements[n]) form.elements[n].value = saved[n]; });
        typeVal = saved.type || ""; step = Math.min(Math.max(Number(saved.step) || 1, 1), 4);
      }
    } catch (e) { /* start fresh */ }
    var qs = new URLSearchParams(location.search);
    if (qs.get("trade")) {
      var qt = qs.get("trade");
      if (qt !== "other" && TR[qt] && !$('input[name="trade"][value="' + qt + '"]', form)) {
        // A trade outside the eight tiles: add it as a choice so the link still works.
        var grid = $('[data-group="trade"] .option-grid', req), lab = document.createElement("label");
        lab.className = "option"; lab.innerHTML = '<input type="radio" name="trade"><span><strong></strong></span>';
        lab.firstChild.value = qt; $("strong", lab).textContent = TR[qt].name; grid.insertBefore(lab, grid.lastElementChild);
      }
      setRadio("trade", qt); typeVal = ""; step = 1;
      if (qs.get("type") && TR[qt] && TR[qt].jobs.indexOf(qs.get("type")) !== -1) typeVal = qs.get("type");
    }
    if (qs.get("job")) { setRadio("trade", "other"); form.elements.details.value = qs.get("job"); typeVal = ""; step = 1; }
    if (qs.get("zip") && validZip(qs.get("zip"))) form.elements.zip.value = qs.get("zip");
    renderTypes(); show();
  }
})();
