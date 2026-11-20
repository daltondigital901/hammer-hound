// Hammer Hound pro portal: home, leads, my leads, wallet, verification, business profile,
// notifications, support and account. Everything is drawn from /api/pro/*.
(function () {
  "use strict";
  var root = document.querySelector("[data-portal]");
  if (!root) return;
  var pro = null, tab = "home";
  var DOC_TYPES = ["State contractor license", "City or county business license", "Secretary of State registration", "IRS EIN letter (CP 575 or 147C)", "DBA or assumed-name certificate", "State tax registration certificate"];
  // What verifying gets this pro: free leads while they still have some, otherwise the leads themselves.
  function prize() { var c = pro ? pro.credit : 240; return c > 0 ? "your Verified Pro badge and " + money0(c) + " in free lead credit" : "your Verified Pro badge and claim leads again"; }
  function money0(n) { return "$" + (n % 1 ? Number(n).toFixed(2) : n); }
  var BANNER = {
    "Not started": [function () { return "Verify your business to unlock " + prize() + "."; }, "You can look at every lead in your market now. Claiming and buying unlock when you are verified.", "Get verified"],
    "Pending": ["We are checking your documents.", "You can look at leads now. Claiming unlocks as soon as both documents pass.", "See status"],
    "In review": ["A person is taking a closer look at your documents.", "We will email you the result. You can look at leads while you wait.", "See status"],
    "Declined": ["Your documents did not pass yet.", function () { return "Send a clearer or different document to unlock " + prize() + "."; }, "Fix it now"],
    "Insurance expired": ["Your insurance on file has expired.", "Upload a current certificate to get your badge back and keep buying leads.", "Update insurance"],
  };
  var say = function (t) { return typeof t === "function" ? t() : t; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var h = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k]; else if (k === "on") Object.keys(attrs.on).forEach(function (e) { el.addEventListener(e, attrs.on[e]); }); else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };
  var money = function (n) { return "$" + Number(n || 0).toFixed(2); };
  var when = function (iso) { return iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; };
  var phoneFmt = function (p) { return p && p.length === 10 ? "(" + p.slice(0, 3) + ") " + p.slice(3, 6) + "-" + p.slice(6) : p || ""; };
  function call(path, body) {
    return fetch(path, { method: body ? "POST" : "GET", credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { status: 0, error: "The portal could not reach the server. It only works on the live site." }; });
  }
  function upload(path, form) {
    return fetch(path, { method: "POST", credentials: "same-origin", body: form })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { status: 0, error: "The upload did not reach the server. Check your connection and try again." }; });
  }
  function note(text, kind) { return h("p", { class: "form-status" + (kind ? " is-" + kind : ""), role: "status", text: text }); }
  function setHeader() {
    var b = document.querySelector("[data-balance]"), s = document.querySelector("[data-signout]");
    if (!pro) return;
    if (pro.member) { b.textContent = pro.member.name; b.hidden = false; b.title = "Signed in as a team member of " + pro.business; } else
    if (!b.hasAttribute("data-counting")) b.textContent = money(pro.balance); b.hidden = false; b.title = pro.credit > 0 ? money(pro.credit) + " of this is free welcome credit" : "Wallet balance";
    s.hidden = false; s.onclick = function () { call("/api/pro/sign-out", {}).then(function () { try { localStorage.removeItem("hh_pro"); } catch (e) {} location.href = "/pros/sign-in/"; }); };
  }

  // ---------- navigation ----------
  var NAV = [["home", "Home", "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["offers", "Open leads", "M4 5h16M4 12h16M4 19h10"], ["leads", "My leads", "M5 4h14v17l-7-4-7 4z"], ["wallet", "Wallet", "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0l12-4v4m2 6h.01"],
    ["verify", "Verification", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zm-3 9l2 2 4-4"], ["profile", "Business profile", "M4 21V8l8-5 8 5v13M9 21v-6h6v6"], ["notifications", "Notifications", "M6 17V11a6 6 0 0 1 12 0v6l2 2H4zm4 4h4"],
    ["team", "Team", "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 20a6 6 0 0 1 12 0m2 0a5 5 0 0 0-2.5-4.3"],
    ["support", "Support", "M4 5h16v11H9l-5 4z"], ["account", "Account", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0"]];
  var PRIMARY = ["home", "offers", "leads", "wallet"];
  // A team member works leads. Money, documents, settings and the team belong to the owner.
  var MEMBER_TABS = ["offers", "leads", "support"];
  function asMember() { NAV = NAV.filter(function (n) { return MEMBER_TABS.indexOf(n[0]) >= 0; }); PRIMARY = MEMBER_TABS; }
  var icon = function (d) { var s = h("span", { class: "pp-ico", "aria-hidden": "true" }); s.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; return s; };
  function go(t) { tab = t; if (location.hash !== "#" + t) { try { history.pushState(null, "", "#" + t); } catch (e) {} } window.scrollTo(0, 0); render(); }
  function navLink(n, cls) {
    var on = tab === n[0] || (n[0] === "more" && PRIMARY.indexOf(tab) < 0);
    var b = h("button", { class: cls + (on ? " is-on" : ""), type: "button", "data-nav": n[0], on: { click: function () { go(n[0]); } } }, [icon(n[2]), h("span", { text: n[1] })]);
    if (on) b.setAttribute("aria-current", "page");
    if (n[0] === "verify" && !pro.verified) b.appendChild(h("i", { class: "pp-dot", title: "Not verified yet" }));
    return b;
  }
  function shell(content) {
    root.innerHTML = "";
    if (!pro) { content.forEach(function (c) { root.appendChild(c); }); return; }
    var main = h("div", { class: "pp-main" });
    if (pro.test) main.appendChild(h("p", { class: "test-banner", text: "Test account. Leads are copied from Dalton Digital forms for internal testing. No card is charged and no owner is contacted." }));
    // Home has its own "Do this next" card, so the banner would only repeat it there.
    if (!pro.verified && !pro.member && tab !== "verify" && tab !== "home") main.appendChild(h("div", { class: "unlock" }, [
      h("img", { src: "/assets/img/badge.png", alt: "", width: "50", height: "60" }),
      h("div", {}, [h("strong", { text: say((BANNER[pro.verification] || BANNER["Not started"])[0]) }), h("span", { text: say((BANNER[pro.verification] || BANNER["Not started"])[1]) })]),
      h("button", { class: "btn btn--black", type: "button", text: BANNER[pro.verification] ? BANNER[pro.verification][2] : "Get verified", on: { click: function () { go("verify"); } } }),
    ]));
    content.forEach(function (c) { if (c) main.appendChild(c); });
    root.appendChild(h("div", { class: "pp" }, [
      h("nav", { class: "pp-side", "aria-label": "Pro portal" }, [h("p", { class: "pp-biz", text: pro.business })].concat(NAV.map(function (n) { return navLink(n, "pp-link"); }))),
      main,
    ]));
    root.appendChild(h("nav", { class: "pp-bar", "aria-label": "Pro portal" }, NAV.filter(function (n) { return PRIMARY.indexOf(n[0]) >= 0; }).map(function (n) { return navLink(n, "pp-tab"); })
      .concat(pro.member ? [] : [navLink(["more", "More", "M5 12h.01M12 12h.01M19 12h.01"], "pp-tab")])));
    setHeader();
  }
  var head = function (title, sub, right) { return h("div", { class: "portal-head" }, [h("div", {}, [h("h1", { text: title }), sub ? h("p", { class: "sub", text: sub }) : null]), right || null]); };
  var card = function (kids, cls) { return h("div", { class: "card form" + (cls ? " " + cls : "") }, kids); };
  var day = function (d) { return d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : ""; };
  var field = function (id, label, input, hint) { return h("div", { class: "vfield" }, [h("label", { class: "label", for: id, text: label }), input, hint ? h("p", { class: "hint", text: hint }) : null]); };
  var input = function (id, type, value, extra) { var a = { class: "input", id: id, type: type, value: value == null ? "" : String(value) }; Object.keys(extra || {}).forEach(function (k) { a[k] = extra[k]; }); return h("input", a); };
  var select = function (id, options, value) { var el = h("select", { class: "input", id: id }, options.map(function (o) { return h("option", { value: o[0], text: o[1] }); })); el.value = value; return el; };
  var toggle = function (id, label, hint, checked) { var box = h("input", { type: "checkbox", id: id }); box.checked = !!checked; return { box: box, el: h("label", { class: "pp-toggle", for: id }, [box, h("span", {}, [h("strong", { text: label }), hint ? h("small", { text: hint }) : null])]) }; };
  function saver(status, btn, path, body, done) {
    btn.disabled = true;
    call(path, body).then(function (r) {
      btn.disabled = false; status.innerHTML = "";
      if (r.error) return status.appendChild(note(r.error, "bad"));
      if (r.pro) pro = r.pro;
      status.appendChild(note("Saved.", "good")); setHeader(); if (done) done(r);
    });
  }
  var TRADE_LIST = (function () { try { return JSON.parse(root.getAttribute("data-trades")) || []; } catch (e) { return []; } })();

  var STEPS = ["Checking your proof of business", "Matching your business name and EIN", "Reading your insurance certificate", "Measuring twice", "Stamping your badge"];
  function checkingView(slow) {
    var line = h("p", { class: "checking-line", role: "status", text: STEPS[0] }), n = 0;
    var timer = setInterval(function () { if (!line.isConnected) return clearInterval(timer); n = Math.min(n + 1, STEPS.length - 1); line.textContent = STEPS[n]; }, 4000);
    shell([h("div", { class: "card form checking" }, [
      h("div", { class: "checking-hound" }, [h("img", { src: "/assets/img/badge-large.png", alt: "", width: "150", height: "181" }), h("span", { class: "checking-spark" })]),
      h("h1", { text: slow ? "This one is taking longer" : "Checking your documents" }),
      slow ? h("p", { class: "sub", text: "We are still on it. We will email you the result, and you can look at leads while you wait." }) : line,
      h("div", { class: "checking-bar", role: "progressbar", "aria-label": "Checking your documents" }),
      slow ? h("button", { class: "btn btn--black btn--block", type: "button", text: "See leads in my market", on: { click: function () { go("offers"); } } }) : h("p", { class: "hint hint--center", text: "This usually takes under a minute. Keep this page open." }),
    ])]);
  }
  function resultView() {
    var status = h("div"), again = function () { resubmit = true; render(); };
    if (pro.verification === "Declined") return shell([h("div", { class: "card form result" }, [
      h("p", { class: "chips" }, [h("span", { class: "chip chip--orange", text: "Not verified yet" })]),
      h("h1", { text: "Your documents did not pass" }),
      h("p", { class: "result-reason", text: pro.verificationReason || "We could not verify your business from the documents you sent." }),
      h("p", { class: "sub", text: "We emailed this to " + (pro.email || "you") + " as well. Pick how you want to fix it:" }),
      pro.checksLeft > 0 ? h("button", { class: "btn btn--yellow btn--block btn--lg", type: "button", text: "Send different documents", on: { click: again } }) : h("p", { class: "hint", text: "You have used today's 3 checks. You can send new documents tomorrow, or ask for a person now." }),
      h("button", { class: "btn btn--outline btn--block", type: "button", text: "Ask for a person to review it", on: { click: function () {
        call("/api/pro/review", {}).then(function (r) { if (r.error) { status.innerHTML = ""; status.appendChild(note(r.error, "bad")); return; } pro = r.pro; render(); });
      } } }),
      h("a", { class: "btn btn--text btn--block", href: "/contact/", text: "Open a support ticket" }),
      status,
    ])]);
    shell([h("div", { class: "card form result" }, [
      h("p", { class: "chips" }, [h("span", { class: "chip chip--yellow", text: "In review" })]),
      h("h1", { text: "We are taking a closer look" }),
      h("p", { class: "sub", text: "Our automated check could not make a clear call, so a person is going to look at your documents. We will email " + (pro.email || "you") + " with the result. You do not need to do anything." }),
      pro.verificationReason ? h("p", { class: "result-reason", text: pro.verificationReason }) : null,
      h("button", { class: "btn btn--black btn--block", type: "button", text: "See leads in my market", on: { click: function () { go("offers"); } } }),
      pro.checksLeft > 0 ? h("button", { class: "btn btn--text btn--block", type: "button", text: "Send clearer documents instead", on: { click: again } }) : null,
    ])]);
  }
  function passedView() {
    justPassed = false;
    shell([h("div", { class: "card form passed" }, [
      h("img", { class: "passed-badge", src: "/assets/img/badge-large.png", alt: "", width: "170", height: "205" }),
      h("p", { class: "vbadge-title", text: "Verified Pro" }),
      h("h1", { text: "You are a Verified Pro." }),
      h("p", { class: "sub", text: pro.credit > 0 ? money0(pro.credit) + " in free lead credit is in your wallet. Pick a job and call the owner." : "You can claim and buy leads again. Pick a job and call the owner." }),
      h("button", { class: "btn btn--yellow btn--block btn--lg", type: "button", text: pro.credit > 0 ? "Spend my free credit" : "See open leads", on: { click: function () { go("offers"); } } }),
    ])]);
  }
  var resubmit = false, justPassed = false;

  function verifyView() {
    if (justPassed) return passedView();
    if (pro.verified && !resubmit) return onFileView();
    if ((pro.verification === "Declined" || pro.verification === "In review") && !resubmit) return resultView();
    var status = h("div");
    var field = function (id, label, input, hint) { return h("div", { class: "vfield" }, [h("label", { class: "label", for: id, text: label }), input, hint ? h("p", { class: "hint", text: hint }) : null]); };
    var file = function (id) { return h("input", { class: "input", id: id, type: "file", accept: ".pdf,image/jpeg,image/png,image/webp", required: "" }); };
    var ein = h("input", { class: "input", id: "v-ein", type: "text", inputmode: "numeric", autocomplete: "off", placeholder: "12-3456789", maxlength: "10", required: "" });
    ein.addEventListener("input", function () { var d = ein.value.replace(/\D/g, "").slice(0, 9); ein.value = d.length > 2 ? d.slice(0, 2) + "-" + d.slice(2) : d; });
    var email = h("input", { class: "input", id: "v-email", type: "email", autocomplete: "email", required: "", value: pro.email || "" });
    var legal = h("input", { class: "input", id: "v-legal", type: "text", autocomplete: "organization", required: "", value: pro.legalName || "" });
    var type = h("select", { class: "input", id: "v-type", required: "" }, [h("option", { value: "", text: "Choose a document" })].concat(DOC_TYPES.map(function (t) { return h("option", { value: t, text: t }); })));
    var bFile = file("doc-business"), iFile = file("doc-insurance");
    // On a phone: open the camera and put the photo into the upload field. A hidden second input does the capturing.
    function snap(target) {
      if (!("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) return null;
      var cam = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: "", "aria-hidden": "true", tabindex: "-1" });
      cam.addEventListener("change", function () { if (!cam.files[0]) return; try { var dt = new DataTransfer(); dt.items.add(cam.files[0]); target.files = dt.files; target.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) { /* older browsers: the normal field still works */ } });
      return h("div", { class: "snap" }, [cam, h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Take a photo instead", on: { click: function () { cam.click(); } } })]);
    }
    // No documents on hand: email a link that comes back to this screen.
    var laterStatus = h("div"), later = h("div", { class: "later" }, [h("strong", { text: "Don't have your documents with you?" }), h("p", { text: "Your account is saved. We can email you a link to finish when you do." }),
      h("button", { class: "btn btn--outline btn--block", type: "button", text: "Email me a link to finish later", on: { click: function (e) { e.target.disabled = true; call("/api/pro/finish-later", {}).then(function (res) {
        laterStatus.innerHTML = ""; e.target.disabled = false;
        laterStatus.appendChild(res.error ? note(res.error, "bad") : res.emailed ? note("Sent to " + res.email + ". Open it when you have your documents.", "good") : note("We could not send the email right now. Your account is saved: come back to hammerhound.com/pros/sign-in any time and pick up here."));
      }); } } }), laterStatus]);
    var expires = h("input", { class: "input", id: "v-expires", type: "date", required: "", min: new Date().toISOString().slice(0, 10) });
    var s1 = h("li", { text: "1. Your business" }), s2 = h("li", { text: "2. Your insurance" });
    var progress = function () { s1.className = legal.value.trim() && ein.value.length === 10 && type.value && bFile.files[0] ? "is-done" : ""; s2.className = iFile.files[0] && expires.value ? "is-done" : ""; };
    var title = pro.verification === "Insurance expired" ? "Update your insurance" : pro.verified ? "Renew your documents" : resubmit ? "Send new documents" : "Get verified";
    var form = h("form", { class: "card form verify" }, [
      h("div", { class: "verify-hero" }, [h("img", { src: "/assets/img/badge-large.png", alt: "", width: "106", height: "128" }), h("div", {}, [
        h("h1", { text: title }),
        h("p", { class: "sub", text: "Two steps unlock " + prize() + ". We check your documents while you wait." }),
      ])]),
      h("ul", { class: "verify-unlocks" }, [h("li", { text: "Verified Pro badge" }), pro.credit > 0 ? h("li", { text: money0(pro.credit) + " in free lead credit" }) : null, h("li", { text: "Claim and buy leads" })]),
      h("ol", { class: "verify-steps" }, [s1, s2]),
      h("h2", { text: "Your business" }),
      field("v-legal", "Legal business name", legal, "The name on your EIN and your documents."),
      field("v-ein", "EIN", ein, "Your 9-digit federal tax ID. One account per EIN. We never accept a Social Security number."),
      field("v-email", "Email", email, "We send your result here."),
      field("v-type", "Proof of business", type),
      field("doc-business", "Upload that document", bFile, "PDF, JPG or PNG up to 5 MB. It must show your business name."), snap(bFile),
      h("h2", { text: "Your insurance" }),
      field("doc-insurance", "Certificate of insurance", iFile, "PDF, JPG or PNG up to 5 MB, showing general liability cover."), snap(iFile),
      field("v-expires", "Insurance expiry date", expires, "Your badge stays active until this date."),
      status,
      h("button", { class: "btn btn--yellow btn--block btn--lg", type: "submit", text: "Verify my business" }),
      pro.verified ? h("button", { class: "btn btn--text btn--block", type: "button", text: "Cancel", on: { click: function () { resubmit = false; render(); } } }) : h("button", { class: "btn btn--text btn--block", type: "button", text: "Skip for now and see leads in my market", on: { click: function () { store.set("hh_skip", "1"); go("offers"); } } }),
      pro.verified ? null : h("p", { class: "hint hint--center", text: "You can look at leads without verifying. You cannot claim or buy one until you do." }),
      pro.verified ? null : later,
    ]);
    form.addEventListener("input", progress); form.addEventListener("change", progress);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = bFile.files[0], i = iFile.files[0];
      var bad = function (t) { status.innerHTML = ""; status.appendChild(note(t, "bad")); };
      if (!b || !i) return bad("Choose both documents.");
      var data = new FormData();
      data.append("legalName", legal.value); data.append("ein", ein.value); data.append("email", email.value); data.append("docType", type.value);
      data.append("insuranceExpires", expires.value); data.append("businessFile", b); data.append("insuranceFile", i);
      var done = false, started = Date.now();
      checkingView(false);
      var slow = setTimeout(function () { if (!done && tab === "verify") checkingView(true); }, 30000);
      upload("/api/pro/documents", data).then(function (r) {
        // Hold the screen a moment so a fast answer does not flash past.
        setTimeout(function () {
          done = true; clearTimeout(slow);
          if (r.error) { if (tab === "verify") { shell([form]); bad(r.error); } return; }
          pro = r.pro; resubmit = false; justPassed = pro.verified;
          if (tab === "verify" || pro.verified) { go("verify"); } else setHeader();
        }, Math.max(0, 2500 - (Date.now() - started)));
      });
    });
    shell([form]);
  }


  // What is on file for a verified pro, the badge to download, and the way to renew.
  function onFileView() {
    var snippet = '<a href="https://hammerhound.com/"><img src="https://hammerhound.com/assets/img/verified-pro-badge.png" alt="Hammer Hound Verified Pro" width="220" height="220"></a>';
    var code = h("textarea", { class: "input pp-code", rows: "3", readonly: "" }); code.value = snippet;
    shell([head("Verification", "Your documents, your badge and when to renew."),
      h("div", { class: "vbadge" }, [h("img", { src: "/assets/img/badge.png", alt: "", width: "66", height: "80" }), h("div", {}, [
        h("p", { class: "vbadge-title", text: "Verified Pro" }), h("p", { class: "vbadge-name", text: pro.legalName || pro.business }),
        h("p", { class: "meta", text: (pro.verifiedAt ? "Verified " + day(pro.verifiedAt) + ". " : "") + (pro.insuranceExpires ? "Active until " + day(pro.insuranceExpires) + ", when your insurance on file expires." : "") })])]),
      card([h("h2", { text: "On file" }), h("ul", { class: "summary" }, [
        h("li", {}, [h("span", { class: "meta", text: "Legal name: " }), pro.legalName || "Not given"]), h("li", {}, [h("span", { class: "meta", text: "EIN: " }), pro.einLast4 ? "ending in " + pro.einLast4 : "Not given"]),
        h("li", {}, [h("span", { class: "meta", text: "Insurance expires: " }), pro.insuranceExpires ? day(pro.insuranceExpires) : "No date on file"])]),
        h("p", { class: "hint", text: "We email you 30, 14, 7, 3 and 1 days before your insurance expires. Upload the renewed certificate any time and nothing lapses." }),
        h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Upload renewed documents", on: { click: function () { resubmit = true; render(); } } })]),
      card([h("h2", { text: "Show your badge" }), h("p", { class: "sub", text: "Put the Verified Pro badge on your website, truck and cards while you are verified." }),
        h("img", { class: "pp-badge-art", src: "/assets/img/verified-pro-badge.png", alt: "Hammer Hound Verified Pro badge", width: "220", height: "220" }),
        h("a", { class: "btn btn--black btn--block", href: "/assets/img/verified-pro-badge.png", download: "hammer-hound-verified-pro.png", text: "Download the badge" }),
        field("badge-code", "Or paste this into your website", code, "The badge means we received documents that appeared valid on the date we checked. Take it down if your verification ends.")]),
    ]);
  }

  // Every lead is drawn the same way: job, place, the same three facts in the same order, then the summary.
  function jobBlock(o) {
    var fact = function (k, v) { return h("div", {}, [h("dt", { text: k }), h("dd", { class: v === "Not stated" ? "is-unknown" : "", text: v })]); };
    var sum = h("p", { class: "lead-summary", text: o.summary || "The owner did not add details." });
    var more = h("button", { class: "lead-more", type: "button", text: "Read more", hidden: "", on: { click: function () { var open = sum.classList.toggle("is-open"); more.textContent = open ? "Show less" : "Read more"; } } });
    requestAnimationFrame(function () { if (sum.scrollHeight > sum.clientHeight + 2) more.hidden = false; });
    return [h("h3", { title: o.job, text: o.job }), h("p", { class: "lead-place", text: o.place }),
      h("dl", { class: "lead-facts" }, [fact("Timing", o.timing), fact("Property", o.propertyType), fact("Job size", o.jobSize)]), sum, more];
  }

  // The claim moment: a toast that drops in, and the wallet in the header counting down to the new balance.
  function claimed(res) {
    var b = document.querySelector("[data-balance]"), from = res.balanceBefore, to = res.balance, start = null;
    if (b) { b.setAttribute("data-counting", ""); b.classList.add("is-spending");
      var tick = function (ts) { if (start === null) start = ts; var k = Math.min(1, (ts - start) / 900); b.textContent = money(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick); else { b.textContent = money(to); b.removeAttribute("data-counting"); setTimeout(function () { b.classList.remove("is-spending"); }, 600); } };
      requestAnimationFrame(tick); }
    var how = res.reloaded ? "Reloaded " + money0(res.reloaded) + " on " + res.card + ", then paid from your wallet" : res.creditUsed >= res.price ? "Paid with your free credit" : res.creditUsed > 0 ? money(res.creditUsed) + " free credit + " + money(res.paidUsed) + " from your wallet" : "Paid from your wallet";
    if (res.autoReloaded) how += ". Auto-reload added " + money0(res.autoReloaded);
    var low = to < res.nextPrice && !res.card, close = function () { t.classList.add("is-leaving"); setTimeout(function () { t.remove(); }, 300); };
    var t = h("div", { class: "toast", role: "status" }, [
      h("img", { src: "/assets/img/badge.png", alt: "", width: "58", height: "70" }),
      h("div", {}, [h("p", { class: "toast-title", text: res.kind === "exclusive" ? "It's all yours!" : "Lead claimed!" }), h("p", { class: "toast-job", text: res.lead.job + " · " + res.lead.place }),
        h("p", { class: "toast-money" }, [h("strong", { text: "-" + money(res.price) }), h("span", { text: " " + how + ". " + money(to) + " left." })]),
        h("p", { class: "toast-next", text: low ? "That is not enough for another lead. Add a card and the next one is one tap." : "Call the owner now. The first pro to call usually wins the job." }),
        low ? h("button", { class: "btn btn--black btn--sm", type: "button", text: "Add a card", on: { click: function () { close(); go("wallet"); } } }) : null]),
      h("button", { class: "toast-x", type: "button", "aria-label": "Close", text: "\u00d7", on: { click: function () { close(); } } }),
      h("i", { class: "toast-sparks", "aria-hidden": "true" }),
    ]);
    document.body.appendChild(t); setTimeout(close, low ? 12000 : 7000);
  }

  // ---------- home ----------
  // Getting started: what a new pro still has to do, in order. It goes away once the required steps are done.
  function checklist(mine, team) {
    var items = [
      ["Verify your business", "Two documents, about two minutes. Unlocks claiming and your welcome credit.", pro.verified, "verify"],
      ["Turn on lead texts", "New leads come to your phone and a YES claims one.", pro.textOffers, "notifications"],
      ["Add the other towns you work in", "See leads and get texts for every town you will drive to.", (pro.serviceArea || []).length > 0, "profile"],
      ["Add a card", "Keeps you claiming when your welcome credit runs out, and shows marked-down older leads.", !!pro.card, "wallet"],
      ["Claim your first lead", "Pick one in Open leads. The owner's details are yours at once.", mine.length > 0, "offers"],
    ];
    var optional = ["Add your team", "Optional. Give your office or crew leads their own lead texts.", (team.members || []).length > 0, "team"];
    var done = items.filter(function (i) { return i[2]; }).length;
    if (done === items.length) return null;
    var row = function (i, opt) { return h("li", { class: "todo" + (i[2] ? " is-done" : "") }, [h("span", { class: "todo-mark", "aria-hidden": "true", text: i[2] ? "✓" : "" }), h("div", {}, [h("strong", { text: i[0] + (opt ? " (optional)" : "") }), h("small", { text: i[1] })]), i[2] ? h("span", { class: "sr-only", text: "Done" }) : h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Go", "aria-label": i[0], on: { click: function () { go(i[3]); } } })]); };
    return card([h("div", { class: "tm-head" }, [h("h2", { text: "Getting started" }), h("span", { class: "chip chip--yellow", text: done + " of " + items.length + " done" })]),
      h("div", { class: "todo-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(items.length), "aria-valuenow": String(done) }, [h("i", { style: "width:" + Math.round(done / items.length * 100) + "%" })]),
      h("ul", { class: "todos" }, items.map(function (i) { return row(i, false); }).concat([row(optional, true)]))]);
  }
  function homeView() {
    shell([h("p", { class: "meta", text: "Loading your account." })]);
    Promise.all([call("/api/pro/offers"), call("/api/pro/leads"), call("/api/pro/team")]).then(function (res) {
      var o = res[0], l = res[1], team = res[2] || {};
      if (o.error) return shell([note(o.error, "bad")]);
      pro = o.pro; if (tab !== "home") return;
      var mine = l.leads || [], count = function (st) { return mine.filter(function (x) { return x.pipeline === st; }).length; };
      var next = !pro.verified ? ["Get verified", "Unlock " + prize() + ".", "verify"]
        : o.offers.length && pro.credit >= 1 && pro.balance >= o.offers[0].sharedPrice ? ["Claim a lead with your free credit", "You have " + money(pro.credit) + " in free credit and " + o.offers.length + " lead" + (o.offers.length === 1 ? "" : "s") + " open in your market.", "offers"]
        : o.offers.length && pro.balance < o.offers[0].sharedPrice ? ["Top up your wallet", "You have " + money(pro.balance) + " left. Add " + money0(Math.ceil((o.offers[0].sharedPrice - pro.balance) / 5) * 5) + " or more and " + o.offers.length + " open lead" + (o.offers.length === 1 ? " is" : "s are") + " yours to claim.", "wallet"]
        : count("New") ? ["Call your new leads", count("New") + " lead" + (count("New") === 1 ? " is" : "s are") + " waiting on a first call.", "leads"]
        : o.offers.length ? ["See open leads", o.offers.length + " open in your market right now.", "offers"] : ["Check your service area", "Nothing is open in your market right now. Widen your market or add a trade.", "profile"];
      var stat = function (n, label, to) { return h("button", { class: "pp-stat", type: "button", on: { click: function () { go(to); } } }, [h("strong", { text: String(n) }), h("span", { text: label })]); };
      var where = (o.filters.market === "all" ? "all markets" : o.filters.market) + (o.filters.trade === "all" ? "" : ", " + (pro.tradeName || o.filters.trade).toLowerCase());
      shell([
        head("Welcome back", pro.business),
        h("div", { class: "pp-next" }, [h("div", {}, [h("p", { class: "eyebrow", text: "Do this next" }), h("h2", { text: next[0] }), h("p", { text: next[1] })]), h("button", { class: "btn btn--black btn--lg", type: "button", text: next[0], on: { click: function () { go(next[2]); } } })]),
        checklist(mine, team),
        h("div", { class: "pp-stats" }, [stat(o.offers.length, "Open leads in " + where, "offers"), stat(count("New"), "New leads to call", "leads"), stat(count("Quoted"), "Quoted", "leads"), stat(count("Won"), "Jobs won", "leads")]),
        h("div", { class: "pp-two" }, [
          card([h("h2", { text: "Wallet" }), h("p", { class: "offer-price", text: money(pro.balance) }), h("p", { class: "meta", text: pro.credit > 0 ? money(pro.credit) + " of it is free welcome credit" : "Balance for buying leads" }), h("button", { class: "btn btn--outline btn--block", type: "button", text: "Open wallet", on: { click: function () { go("wallet"); } } })]),
          card([h("h2", { text: pro.verified ? "Verified Pro" : "Verification" }), h("p", { class: "meta", text: pro.verified ? (pro.insuranceExpires ? "Active until " + day(pro.insuranceExpires) + "." : "Active.") : "Status: " + pro.verification + "." }),
            h("p", { class: "meta", text: pro.paused ? "Lead offers are paused." : "Lead offers are on." }), h("button", { class: "btn btn--outline btn--block", type: "button", text: pro.verified ? "Badge and documents" : "Get verified", on: { click: function () { go("verify"); } } })]),
        ]),
      ]);
    });
  }

  // ---------- leads: browse by market and trade ----------
  var pick = { market: null, trade: null };   // null = the pro's own market and trade
  var age = "hot";
  function ago(t) { var h = Math.max(0, (Date.now() - Date.parse(t)) / 36e5); return h < 1 ? "under an hour ago" : h < 24 ? Math.floor(h) + (Math.floor(h) === 1 ? " hour ago" : " hours ago") : Math.floor(h / 24) + (Math.floor(h / 24) === 1 ? " day ago" : " days ago"); }
  function offersView() {
    shell([h("p", { class: "meta", text: "Loading leads." })]);
    var qs = []; if (pick.market !== null) qs.push("market=" + encodeURIComponent(pick.market)); if (pick.trade !== null) qs.push("trade=" + encodeURIComponent(pick.trade));
    call("/api/pro/offers" + (qs.length ? "?" + qs.join("&") : "")).then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      pro = r.pro; if (tab !== "offers") return;
      var f = r.filters, locked = !r.canBuy;
      var mOpts = [["all", "All markets (" + f.total + ")"]].concat(f.markets.map(function (m) { return [m.name, m.name + " (" + m.count + ")"]; }));
      if (f.market !== "all" && !f.markets.some(function (m) { return m.name.toLowerCase() === f.market.toLowerCase(); })) mOpts.push([f.market, f.market + " (0)"]);
      var tOpts = [["all", "All trades (" + f.total + ")"]].concat(f.trades.map(function (t) { return [t.slug, t.name + " (" + t.count + ")"]; }));
      if (f.trade !== "all" && !f.trades.some(function (t) { return t.slug === f.trade; })) tOpts.push([f.trade, (pro.tradeName && f.trade === pro.trade ? pro.tradeName : f.trade) + " (0)"]);
      if (f.mine) mOpts.splice(1, 0, ["mine", "Within " + (f.mine.radius || 20) + " miles of me (" + f.mine.count + ")"]);
      var mSel = select("f-market", mOpts, (mOpts.filter(function (x) { return x[0].toLowerCase() === f.market.toLowerCase(); })[0] || ["all"])[0]), tSel = select("f-trade", tOpts, f.trade);
      mSel.addEventListener("change", function () { pick.market = mSel.value; offersView(); }); tSel.addEventListener("change", function () { pick.trade = tSel.value; offersView(); });
      var mine = (f.home.market || "all").toLowerCase() === f.market.toLowerCase() && (f.home.trade || "all") === f.trade;
      var filters = h("div", { class: "pp-filters" }, [field("f-market", "Market", mSel), field("f-trade", "Trade", tSel),
        mine ? h("p", { class: "hint", text: "Showing your market and trade." }) : h("button", { class: "btn btn--text", type: "button", text: "Back to my market and trade", on: { click: function () { pick = { market: null, trade: null }; offersView(); } } })]);
      if (!r.olderShown) age = "hot";
      if (age === "older" && !r.older && r.hot) age = "hot"; if (age === "hot" && !r.hot && r.older) age = "older";
      var ageTabs = h("div", { class: "pp-ages", role: "tablist" }, [["hot", "Hot leads", r.hot, "Sent in the last " + r.hotHours + " hours"], ["older", "Older leads", r.older, "3 to " + r.leadDays + " days old, marked down"]].map(function (a) {
        return h("button", { class: "pp-age" + (age === a[0] ? " is-on" : ""), type: "button", role: "tab", "aria-selected": String(age === a[0]), on: { click: function () { age = a[0]; offersView(); } } }, [h("strong", { text: a[1] + " (" + a[2] + ")" }), h("span", { text: a[3] })]);
      }));
      var items = r.offers.filter(function (o) { return age === "hot" ? o.hot : !o.hot; }).map(function (o) {
        var status = h("div");
        var act = function (kind, reload) { return function () {
          call("/api/pro/buy", { leadId: o.id, kind: kind, reload: !!reload }).then(function (res) {
            if (res.error) { status.innerHTML = ""; status.appendChild(note(res.error, res.status === 402 ? "" : "bad")); if (res.status === 402) status.appendChild(h("button", { class: "btn btn--" + (res.declined ? "black" : "outline") + " btn--sm", type: "button", text: res.declined ? "Update my card" : "Open wallet", on: { click: function () { go("wallet"); } } })); return; }
            pro.balance = res.balance; pro.credit = res.credit; claimed(res); go("leads");
          });
        }; };
        // Welcome credit pays for hot leads only. An older lead is paid from the pro's own funds.
        var avail = o.hot ? pro.balance : Math.round((pro.balance - pro.credit) * 100) / 100;
        var covered = o.hot && pro.credit >= o.sharedPrice, short = avail < o.sharedPrice, unit = pro.reloadAmount || 150;
        var need = function (price) { return Math.ceil((price - avail) / unit) * unit; };
        var why = o.priceWhy && o.priceWhy.length ? h("p", { class: "offer-why", text: "Priced for: " + o.priceWhy.join(", ") + "." }) : null;
        // When the wallet is short the button says what will be charged, before the tap.
        var label = function (kind, price) { var base = (kind === "exclusive" ? "Exclusive " : "Claim lead · ") + money0(price); return avail >= price ? base : pro.card ? base + " · reloads " + money0(need(price)) : base; };
        var press = function (kind, price) { return function () { if (avail < price && !pro.card) { status.innerHTML = ""; status.appendChild(note("Your wallet has " + money(avail) + ". Add a card and this lead is one tap away.")); status.appendChild(h("button", { class: "btn btn--black btn--sm", type: "button", text: "Add a card", on: { click: function () { go("wallet"); } } })); return; } act(kind, avail < price)(); }; };
        return h("div", { class: "card offer" }, [
          h("div", { class: "offer-top" }, [h("span", { class: "chip", text: o.tradeName }), o.bid ? h("span", { class: "chip", text: "Bid invitation" }) : null, o.hot ? h("span", { class: "chip chip--hot", text: "Hot · " + ago(o.receivedAt) }) : h("span", { class: "chip chip--old", text: ago(o.receivedAt) })])].concat(jobBlock(o), [
          h("div", { class: "offer-foot" }, [
            h("p", { class: "meta", text: "Received " + when(o.receivedAt) + " · closes " + when(o.endsAt) + " · " + o.spotsTaken + " of " + o.maxPros + " spots taken" }),
            h("p", { class: "offer-price" }, o.percentOff ? [h("s", { class: "offer-was", text: money0(o.fullPrice) }), document.createTextNode(" " + money(o.sharedPrice) + " "), h("span", { class: "chip chip--green", text: o.percentOff + "% off" })] : [document.createTextNode(money(o.sharedPrice))]), why,
            h("p", { class: "meta", text: locked ? (pro.credit > 0 ? "Shared lead. Your " + money0(pro.credit) + " in free credit unlocks when you are verified." : "Shared lead. Verify to claim it.") : covered ? "Shared lead. Covered by your free credit." : short ? (pro.card ? "Shared lead. " + (o.hot ? "Your wallet has " : "Welcome credit is for hot leads only. You have ") + money(avail) + (o.hot ? "" : " of your own funds") + "; " + pro.card + " covers the rest." : "Shared lead. Your wallet has " + money(avail) + ".") : "Shared lead. Paid from your wallet." }),
            pro.member && !pro.member.canPay ? h("p", { class: "meta", text: "Only " + pro.business + " or someone they gave pay authority can claim this." })
            : locked ? h("div", { class: "offer-actions" }, [h("button", { class: "btn btn--outline btn--locked", type: "button", text: "Verify to claim this lead", on: { click: function () { go("verify"); } } })])
            : h("div", { class: "offer-actions" }, [
              h("button", { class: "btn btn--yellow", type: "button", text: label("shared", o.sharedPrice), on: { click: press("shared", o.sharedPrice) } }),
              o.exclusiveAvailable ? h("button", { class: "btn btn--outline", type: "button", text: label("exclusive", o.exclusivePrice), on: { click: press("exclusive", o.exclusivePrice) } }) : null,
            ]),
            status,
          ]),
        ]));
      });
      var wantStatus = h("div"), askable = f.market !== "all";
      var tradeLabel = f.trade === "all" ? "" : ((f.trades.filter(function (t) { return t.slug === f.trade; })[0] || {}).name || pro.tradeName || "").toLowerCase();
      var place = f.market === "mine" ? "your area" : f.market;
      var doneNote = function (tradeName, where) { return note("Request sent for " + (tradeName ? tradeName + " " : "") + "leads in " + where + ". We use these requests to decide where to advertise next.", "good"); };
      var want = h("button", { class: "btn btn--yellow btn--block btn--lg", type: "button", text: "Request " + (tradeLabel ? tradeLabel + " " : "") + "leads in " + place, on: { click: function () {
        want.disabled = true;
        call("/api/pro/market-request", { market: f.market, trade: f.trade, total: f.total }).then(function (res) { wantStatus.innerHTML = ""; if (res.error) { want.disabled = false; wantStatus.appendChild(note(res.error, "bad")); return; } want.hidden = true; wantStatus.appendChild(doneNote(res.trade === "all trades" ? "" : res.trade.toLowerCase(), f.market === "mine" ? "your area" : res.market)); });
      } } });
      // already asked for this market and trade (even before a reload): show the confirmation, not the button
      if (askable && f.requested) { want.hidden = true; wantStatus.appendChild(doneNote(tradeLabel, place)); }
      var empty = card([h("h2", { text: askable ? "No open " + (tradeLabel ? tradeLabel + " " : "") + "leads in " + place + " right now" : "No open leads for this trade right now" }),
        h("p", { class: "sub", text: askable ? (f.requested ? "You've asked for leads here." : "Want leads here? Tell us. We advertise where pros ask.") : "New leads show up here as they come in." }),
        askable ? want : null, wantStatus,
        f.total ? h("button", { class: "btn btn--outline btn--block", type: "button", text: "See the " + f.total + " open in other markets and trades", on: { click: function () { pick = { market: "all", trade: "all" }; offersView(); } } }) : null]);
      shell([head(r.canBuy ? "Open leads" : "Open leads in your market", r.offers.length + " showing of " + f.total + " open"), filters, r.offers.length && r.olderShown ? ageTabs : null, items.length ? h("div", { class: "grid grid--3 pp-grid" }, items) : empty]);
    });
  }

  // ---------- my leads: work them ----------
  var STAGES = ["New", "Contacted", "Quoted", "Won", "Lost"], stageFilter = "All";
  function leadsView() {
    shell([h("p", { class: "meta", text: "Loading your leads." })]);
    call("/api/pro/leads").then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      pro = r.pro; if (tab !== "leads") return;
      // With the first lead or two: a short guide to working it. Dismissed for good with one tap.
      var guide = r.leads.length && r.leads.length <= 2 && store.get("hh_guide") !== "0" ? h("div", { class: "guide" }, [
        h("div", { class: "tm-head" }, [h("h2", { text: "How to win this lead" }), h("button", { class: "btn btn--text btn--sm", type: "button", text: "Got it", on: { click: function (e) { store.set("hh_guide", "0"); e.target.closest(".guide").remove(); } } })]),
        h("ol", {}, [
          h("li", {}, [h("strong", { text: "Call now. " }), "The first pro to reach the owner usually gets the visit. If they do not pick up, text them and try again in an hour."]),
          h("li", {}, [h("strong", { text: "Say who you are and what they asked for. " }), "\"This is " + pro.business + ". You asked about " + String(r.leads[0].job || "your project").toLowerCase() + ".\" Then ask when you can come look."]),
          h("li", {}, [h("strong", { text: "Book the visit before you hang up. " }), "A day and a time beats \"I'll call you back.\""]),
          h("li", {}, [h("strong", { text: "Mark it here. " }), "Contacted, Quoted, Won. It keeps your follow-ups straight."]),
          h("li", {}, [h("strong", { text: "Wrong number or not a real job? " }), "Report it from the lead and we review it for a credit back."])])]) : null;
      var chips = h("div", { class: "tabs" }, ["All"].concat(STAGES).map(function (st) {
        var n = st === "All" ? r.leads.length : r.leads.filter(function (l) { return l.pipeline === st; }).length;
        return h("button", { class: "chip chip--link" + (stageFilter === st ? " is-on" : ""), type: "button", text: st + " (" + n + ")", on: { click: function () { stageFilter = st; leadsView(); } } });
      }));
      var items = r.leads.filter(function (l) { return stageFilter === "All" || l.pipeline === stageFilter; }).map(function (l) {
        var status = h("div");
        var stage = select("st-" + l.purchaseId, STAGES.map(function (x) { return [x, x]; }), l.pipeline);
        stage.addEventListener("change", function () { call("/api/pro/lead-status", { purchaseId: l.purchaseId, pipeline: stage.value }).then(function (res) { status.innerHTML = ""; status.appendChild(note(res.error || "Status saved.", res.error ? "bad" : "good")); if (!res.error) l.pipeline = stage.value; }); });
        var notes = h("textarea", { class: "input", rows: "2", placeholder: "Your notes on this job", id: "nt-" + l.purchaseId }); notes.value = l.notes;
        var saveNotes = h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Save notes", on: { click: function () { call("/api/pro/lead-status", { purchaseId: l.purchaseId, notes: notes.value }).then(function (res) { status.innerHTML = ""; status.appendChild(note(res.error || "Notes saved.", res.error ? "bad" : "good")); }); } } });
        var report = l.review === "None" ? h("button", { class: "btn btn--text btn--sm", type: "button", text: "Report a bad lead", on: { click: function () {
          var reason = h("textarea", { class: "input", rows: "3", placeholder: "What was wrong with this lead?" });
          var sendBtn = h("button", { class: "btn btn--black btn--sm", type: "button", text: "Send report", on: { click: function () {
            call("/api/pro/report", { purchaseId: l.purchaseId, reason: reason.value }).then(function (res) { status.innerHTML = ""; status.appendChild(note(res.error || "Reported. We will review it and you can choose a credit or a refund if it is approved.", res.error ? "bad" : "good")); });
          } } });
          status.innerHTML = ""; status.appendChild(reason); status.appendChild(sendBtn); report.hidden = true;
        } } }) : h("span", { class: "chip", text: "Bad-lead report: " + l.review });
        return h("div", { class: "card offer" }, [
          h("div", { class: "offer-top" }, [h("span", { class: "chip", text: l.tradeName }), h("span", { class: "chip", text: l.kind === "Free" ? "Free lead" : l.kind + " · " + money(l.price) + (l.creditUsed >= l.price && l.price ? " free credit" : "") }), l.claimedBy ? h("span", { class: "chip chip--yellow", text: "Claimed by " + l.claimedBy }) : null, h("span", { class: "meta", text: "Bought " + when(l.boughtAt) })])].concat(jobBlock(l), [
          h("div", { class: "lead-contact" }, [h("span", { class: "lead-contact-label", text: "Owner" }), h("strong", { text: l.ownerName || "Name not given" }), l.ownerPhone ? h("a", { href: "tel:+1" + l.ownerPhone, text: phoneFmt(l.ownerPhone) }) : h("span", { class: "meta", text: "No phone number given" }), l.ownerEmail ? h("a", { href: "mailto:" + l.ownerEmail, text: l.ownerEmail }) : null, l.address ? h("span", { text: l.address }) : null]),
          l.message ? h("details", { class: "lead-words" }, [h("summary", { text: "The owner's own words" }), h("p", { text: l.message })]) : null,
          field("st-" + l.purchaseId, "Where it stands", stage), field("nt-" + l.purchaseId, "Notes", notes), saveNotes, report, status,
        ]));
      });
      shell([head("My leads", r.leads.length + " bought or claimed"), guide, chips,
        items.length ? h("div", { class: "grid grid--3 pp-grid" }, items) : card([h("h2", { text: r.leads.length ? "Nothing in this stage" : "No leads yet" }), h("p", { class: "sub", text: "Leads you buy or claim show up here with the owner's details." }), h("button", { class: "btn btn--black btn--block", type: "button", text: "See open leads", on: { click: function () { go("offers"); } } })])]);
    });
  }

  // ---------- wallet ----------
  function walletView() {
    shell([h("p", { class: "meta", text: "Loading your wallet." })]);
    call("/api/pro/wallet").then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      pro = r.pro; if (tab !== "wallet") return;
      var status = h("div"), cardStatus = h("div"), reloadStatus = h("div");
      var amounts = r.reloads.map(function (a) { return [String(a), money0(a)]; });
      var amount = select("w-amount", amounts, String(r.reloadAmount)), short = r.balance < r.leadPrice;
      var add = h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Add funds", on: { click: function () { saver(status, add, "/api/pro/add-funds", { amount: Number(amount.value) }, function () { walletView(); }); } } });
      // Card on file. Real cards arrive with Square; a test account can save a test card to try the whole flow.
      // Backup card (Ryan 2026-11-20): charged only if the main card is declined.
      var cardAct = function (action, extra) { return function () { call("/api/pro/card", Object.assign({ action: action }, extra || {})).then(function (res) { if (res.error) { cardStatus.innerHTML = ""; cardStatus.appendChild(note(res.error, "bad")); return; } walletView(); }); }; };
      var backupBox = r.backupCard
        ? [h("p", { class: "label", text: "Backup card" }), h("p", { class: "pp-cardline" }, [h("span", { text: r.backupCard }), h("span", {}, [h("button", { class: "btn btn--text btn--sm", type: "button", text: "Make main", on: { click: cardAct("make-main") } }), h("button", { class: "btn btn--text btn--sm", type: "button", text: "Remove", on: { click: cardAct("remove-backup") } })])]),
           h("p", { class: "hint", text: "Charged only if your main card is declined." })]
        : [h("button", { class: "btn btn--outline btn--block", type: "button", text: r.testCard && !r.cardsReady ? "Add a test backup card" : "Add a backup card", on: { click: cardAct("save-backup") } }),
           h("p", { class: "hint", text: "If your main card is declined, we charge the backup so your claim still goes through." })];
      var cardBox = r.card
        ? [h("p", { class: "pp-cardline" }, [h("strong", { text: r.card }), h("button", { class: "btn btn--text btn--sm", type: "button", text: "Remove", on: { click: cardAct("remove") } })])].concat(backupBox, [cardStatus, field("w-amount", "Amount to add", amount), add, status])
        : [h("p", { class: "sub", text: "Save a card once and every lead is one tap or one text away. You are not charged until your wallet cannot cover a lead you claim." }),
           h("button", { class: "btn btn--yellow btn--block", type: "button", text: r.cardsReady ? "Add a card" : r.testCard ? "Save a test card" : "Add a card", on: { click: saveCard(false) } }),
           r.testCard ? h("button", { class: "btn btn--text btn--block", type: "button", text: "Save a test card that declines", on: { click: saveCard(true) } }) : null,
           r.cardsReady ? null : h("p", { class: "hint", text: r.testCard ? "Card payments are not switched on yet. This is a test account, so a test card stands in. Nothing is charged." : "Card payments are not switched on yet. We will email you when they are." }), cardStatus];
      // A declined card leaves a reload waiting. Saving a working card finishes it, and claims the lead it was for.
      function saveCard(decline) { return function () { call("/api/pro/card", { action: "save", decline: decline }).then(function (res) {
        if (res.error) { cardStatus.innerHTML = ""; cardStatus.appendChild(note(res.error)); return; }
        pro = res.pro;
        if (res.claimed) { claimed(res.claimed); go("leads"); return; }
        walletView();
        if (res.pendingError) setTimeout(function () { var m = document.querySelector(".pp-main"); if (m) m.insertBefore(note("Card saved, but the reload did not go through: " + res.pendingError, "bad"), m.children[1] || null); }, 400);
        if (res.reloaded) setTimeout(function () { var m = document.querySelector(".pp-main"); if (m) m.insertBefore(note(money0(res.reloaded) + " added to your wallet." + (res.claimError ? " The lead could not be claimed: " + res.claimError : ""), "good"), m.children[1] || null); }, 400);
      }); }; }
      var auto = toggle("w-auto", "Auto-reload", "When your wallet cannot cover a lead, charge my card the reload amount so the claim goes through.", r.autoReload);
      var unit = select("w-unit", amounts, String(r.reloadAmount)), limit = input("w-limit", "number", r.monthlyLimit || "", { min: "75", step: "25", placeholder: "No limit" });
      var saveReload = h("button", { class: "btn btn--outline btn--block", type: "button", text: "Save reload settings", on: { click: function () { saver(reloadStatus, saveReload, "/api/pro/reload-settings", { autoReload: auto.box.checked, reloadAmount: Number(unit.value), monthlyLimit: limit.value }, function () { walletView(); }); } } });
      var rows = r.rows.map(function (x) { return h("tr", {}, [h("td", { text: when(x.date) }), h("td", { text: x.entry }), h("td", { text: x.type }), h("td", { class: "num" + (x.amount > 0 ? " is-in" : ""), text: (x.amount > 0 ? "+" : "-") + money(Math.abs(x.amount)) }), h("td", { class: "num", text: money(x.balanceAfter) })]); });
      var m = r.membership;
      shell([head("Wallet", "Your balance, your card, your invoices."),
        r.pending ? h("div", { class: "unlock unlock--alert" }, [h("img", { src: "/assets/img/badge.png", alt: "", width: "50", height: "60" }), h("div", {}, [h("strong", { text: "Your card was declined." }), h("span", { text: "Update your card below and we will add " + money0(r.pending.amount) + " to your wallet" + (r.pending.lead ? " and claim the lead you were after, if it is still open." : ".") })]), h("button", { class: "btn btn--black", type: "button", text: r.card ? "Replace my card" : "Add a card", on: { click: function () { call("/api/pro/card", { action: "remove" }).then(function () { walletView(); }); } } })]) : null,
        h("div", { class: "pp-two pp-two--even" }, [
          card([h("h2", { text: "Balance" }), h("p", { class: "offer-price", text: money(r.balance) }),
            h("p", { class: "meta", text: r.credit > 0 ? money(r.credit) + " of this is free welcome credit. It is spent before money you add." : "Leads are paid from this balance." }),
            short ? h("p", { class: "form-status", text: "Your wallet is low. " + (r.card ? "Your next claim reloads " + money0(r.reloadAmount) + " on " + r.card + "." : "Add a card to claim your next one.") }) : null,
            h("h2", { text: "Card on file" })].concat(cardBox)),
          card([h("h2", { text: "Reloads" }), auto.el, field("w-unit", "Reload amount", unit, "Charged each time a reload is needed."), field("w-limit", "Monthly limit", limit, r.chargedThisMonth ? money(r.chargedThisMonth) + " charged so far this month." : "The most your card can be charged for reloads in a month. Leave empty for no limit."),
            h("p", { class: "hint", text: "Every charge is emailed to you as a receipt. Replying YES to a lead text also uses your card on file when your wallet is short." }), reloadStatus, saveReload]),
        ]),
        card([h("h2", { text: "Invoices" }), h("p", { class: "sub", text: "A PDF invoice is emailed on the 1st of each month. Open any month here." }),
          r.months.length ? h("ul", { class: "summary" }, r.months.map(function (x) { return h("li", {}, [h("a", { class: "link-more", href: "/api/pro/invoice?month=" + x.month, target: "_blank", rel: "noopener", text: x.label + (x.open ? " (so far)" : "") + " · PDF" })]); })) : h("p", { class: "meta", text: "No invoices yet." })], "pp-wide"),
        card([h("h2", { text: "Activity" }), rows.length ? h("div", { class: "table-wrap" }, [h("table", { class: "pp-table" }, [h("thead", {}, [h("tr", {}, [h("th", { text: "Date" }), h("th", { text: "What" }), h("th", { text: "Type" }), h("th", { class: "num", text: "Amount" }), h("th", { class: "num", text: "Balance" })])]), h("tbody", {}, rows)])]) : h("p", { class: "sub", text: "Nothing yet." })], "pp-wide"),
        card([h("h2", { text: "Membership" }), h("div", { class: "fee-offer" }, [h("span", { class: "chip chip--yellow", text: m.inFreeYear ? "First year free" : "Member" }), h("p", { class: "fee-text", text: m.inFreeYear ? "Free until " + day(m.freeUntil) : "$" + m.fee + " a year" })]),
          h("p", { class: "hint", text: "Membership renews automatically at $" + m.fee + " a year on your card on file, starting " + day(m.freeUntil) + ", until you close your account. We email you about 35, 18 and 3 days before each charge. To cancel, close your account in Account. See the Pro Agreement, section 5.5." })], "pp-wide"),
      ]);
    });
  }

  // ---------- business profile ----------
  function profileView() {
    var status = h("div");
    var biz = input("p-biz", "text", pro.business, { autocomplete: "organization" }), city = input("p-city", "text", pro.city, { autocomplete: "address-level2" }), state = select("p-state", [["", "State"]].concat(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"].map(function (c) { return [c, c]; })), pro.state || ""), zip = input("p-zip", "text", pro.zip, { inputmode: "numeric", maxlength: "5" }), email = input("p-email", "email", pro.email, { autocomplete: "email" });
    var trade = select("p-trade", [["", "Choose a trade"]].concat(TRADE_LIST), pro.trade);
    var boxes = TRADE_LIST.map(function (t) { var b = h("input", { type: "checkbox", value: t[0] }); b.checked = pro.extraTrades.indexOf(t[0]) >= 0; return { box: b, el: h("label", { class: "pp-check" }, [b, h("span", { text: t[1] })]) }; });
    // Other towns the pro works in. Leads and lead texts cover the home market and all of these.
    var areas = (pro.serviceArea || []).slice(), areaBox = h("div", { class: "area-chips" }), areaIn = input("p-area", "text", "", { placeholder: "Bartlett, TN", autocomplete: "off" }), areaErr = h("div");
    function drawAreas() { areaBox.innerHTML = ""; areas.forEach(function (a, i) { areaBox.appendChild(h("span", { class: "chip area-chip" }, [a + " ", h("button", { type: "button", "aria-label": "Remove " + a, text: "×", on: { click: function () { areas.splice(i, 1); drawAreas(); } } })])); }); if (!areas.length) areaBox.appendChild(h("span", { class: "meta", text: "None added." })); }
    function addArea() {
      var v = areaIn.value.trim().replace(/\s+/g, " "); areaErr.innerHTML = "";
      if (!v) return;
      if (!/,\s*[A-Za-z]{2}$/.test(v)) { v = v + ", " + (state.value || pro.state || ""); if (!/,\s*[A-Za-z]{2}$/.test(v)) { areaErr.appendChild(note("Add the state, like Bartlett, TN.", "bad")); return; } }
      if (areas.length >= 10) { areaErr.appendChild(note("You can add up to 10 other towns.", "bad")); return; }
      if (areas.map(function (x) { return x.toLowerCase(); }).indexOf(v.toLowerCase()) < 0) areas.push(v);
      areaIn.value = ""; drawAreas();
    }
    areaIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addArea(); } });
    drawAreas();
    // Service radius (Ryan 2026-11-20): miles around the ZIP. The towns inside it are listed as the pro picks.
    var radius = select("p-radius", [10, 15, 20, 30, 40, 50, 75].map(function (m) { return [String(m), m + " miles"]; }), String(pro.serviceRadius || 20)), townsBox = h("div", { class: "area-chips" }), townsNote = h("p", { class: "hint" }), showAll = false;
    function drawTowns() {
      var qs = "?radius=" + radius.value + "&zip=" + encodeURIComponent(zip.value) + "&city=" + encodeURIComponent(city.value) + "&state=" + encodeURIComponent(state.value);
      townsNote.textContent = "Finding the towns in your radius."; townsBox.innerHTML = "";
      call("/api/pro/coverage" + qs).then(function (r) {
        townsBox.innerHTML = "";
        if (r.error || !r.found) { townsNote.textContent = "Enter your business ZIP code to see the towns you cover."; return; }
        townsNote.textContent = r.count + " town" + (r.count === 1 ? "" : "s") + " within " + r.radius + " miles. You see leads and get lead texts for all of them.";
        (showAll ? r.towns : r.towns.slice(0, 18)).forEach(function (t) { townsBox.appendChild(h("span", { class: "chip", text: t.name + (t.miles ? " · " + t.miles + " mi" : "") })); });
        if (!showAll && r.towns.length > 18) townsBox.appendChild(h("button", { class: "btn btn--text btn--sm", type: "button", text: "Show all " + r.count, on: { click: function () { showAll = true; drawTowns(); } } }));
      });
    }
    radius.addEventListener("change", drawTowns); zip.addEventListener("change", drawTowns);
    drawTowns();
    var save = h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Save profile", on: { click: function () {
      addArea();
      saver(status, save, "/api/pro/profile", { business: biz.value, city: city.value, state: state.value, zip: zip.value, email: email.value, trade: trade.value, serviceArea: areas, serviceRadius: Number(radius.value), extraTrades: boxes.filter(function (b) { return b.box.checked; }).map(function (b) { return b.box.value; }) }, function () { pick = { market: null, trade: null }; });
    } } });
    shell([head("Business profile", "What owners see, and which leads you see first."),
      card([h("h2", { text: "Your business" }), field("p-biz", "Business name", biz, "Shown to property owners whose leads you take."), field("p-email", "Email", email, "Where we send account notices."),
        h("h2", { text: "Your market" }), field("p-city", "City", city), field("p-state", "State", state, "Leads open on this market by default. You can look at any market from the Leads page."), field("p-zip", "Business ZIP code", zip),
        h("h2", { text: "How far you travel" }), field("p-radius", "Service radius", radius, "Measured from your business ZIP code."), townsNote, townsBox,
        h("details", { class: "pp-extra" }, [h("summary", { text: "Add a town outside your radius" }), h("p", { class: "sub", text: "Only for a town you also serve that is farther out. Most pros never need this." }), areaBox,
          h("div", { class: "area-add" }, [field("p-area", "Town and state", areaIn), h("button", { class: "btn btn--outline", type: "button", text: "Add", on: { click: addArea } })]), areaErr]),
        h("h2", { text: "Your trades" }), field("p-trade", "Main trade", trade, "Leads open on this trade by default."), h("p", { class: "label", text: "Other trades you take" }), h("div", { class: "pp-checks" }, boxes.map(function (b) { return b.el; })),
        status, save], "verify"),
    ]);
  }

  // ---------- notifications ----------
  function notificationsView() {
    var status = h("div"), q = (pro.quietHours || "").split("-");
    var text = toggle("n-text", "Lead offers by text", "Recurring automated messages. Message and data rates may apply. Reply STOP to opt out.", pro.textOffers), mail = toggle("n-mail", "Lead alerts by email", "A short email when a lead opens in your market and trade.", pro.emailOffers), paused = toggle("n-pause", "Pause my leads", "Stops every offer until you turn this off. Use it for vacations or a full schedule.", pro.paused);
    var cap = input("n-cap", "number", pro.dailyCap || "", { min: "1", max: "50", placeholder: "No cap" }), qs = input("n-qs", "time", q[0] || ""), qe = input("n-qe", "time", q[1] || "");
    var save = h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Save settings", on: { click: function () { saver(status, save, "/api/pro/notifications", { textOffers: text.box.checked, emailOffers: mail.box.checked, paused: paused.box.checked, dailyCap: cap.value, quietStart: qs.value, quietEnd: qe.value }); } } });
    shell([head("Notifications", "How and when we tell you about leads."),
      card([paused.el, h("h2", { text: "How we reach you" }), text.el, mail.el,
        h("h2", { text: "Limits" }), field("n-cap", "Most offers in one day", cap, "Leave empty for no cap."),
        h("div", { class: "form-row pp-row2" }, [field("n-qs", "Quiet hours start", qs), field("n-qe", "Quiet hours end", qe)]), h("p", { class: "hint", text: "No offers are sent between these times. Leave both empty for none." }),
        h("p", { class: "hint", text: "Account notices, such as insurance renewal reminders and verification results, are always sent." }), status, save], "verify"),
    ]);
  }

  // ---------- support ----------
  function supportView() {
    shell([h("p", { class: "meta", text: "Loading support." })]);
    call("/api/pro/tickets").then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      if (tab !== "support") return;
      var status = h("div"), topic = select("t-topic", [["A lead I bought", "A lead I bought"], ["Billing", "Billing"], ["Verification", "Verification"], ["My account", "My account"], ["Other", "Other"]], "Other");
      var subject = input("t-subject", "text", "", { maxlength: "160" }), message = h("textarea", { class: "input", id: "t-message", rows: "5" });
      var send = h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Open ticket", on: { click: function () {
        send.disabled = true;
        call("/api/pro/tickets", { topic: topic.value, subject: subject.value, message: message.value }).then(function (res) { send.disabled = false; if (res.error) { status.innerHTML = ""; status.appendChild(note(res.error, "bad")); return; } supportView(); });
      } } });
      var list = r.tickets.map(function (t) { return h("div", { class: "card pp-ticket" }, [h("div", { class: "offer-top" }, [h("span", { class: "chip" + (t.status === "Answered" ? " chip--green" : t.status === "Open" ? " chip--yellow" : ""), text: t.status }), h("span", { class: "meta", text: t.topic + " · " + when(t.createdAt) })]), h("h3", { text: t.subject }), h("p", { text: t.message }), t.reply ? h("div", { class: "pp-reply" }, [h("strong", { text: "Hammer Hound replied" }), h("p", { text: t.reply })]) : null]); });
      shell([head("Support", "Open a ticket and it stays tied to your account. There is no phone line to wait on."),
        h("div", { class: "pp-two" }, [
          card([h("h2", { text: "New ticket" }), field("t-topic", "What is it about", topic), field("t-subject", "Subject", subject), field("t-message", "What is going on", message, "For a bad lead, use Report a bad lead on the lead itself. It is faster."), status, send], "verify"),
          h("div", { class: "pp-stack" }, [h("h2", { text: "Your tickets" })].concat(list.length ? list : [h("p", { class: "sub", text: "No tickets yet." })])),
        ]),
      ]);
    });
  }

  // ---------- account ----------
  function accountView() {
    var row = function (k, v) { return h("li", {}, [h("span", { class: "meta", text: k + ": " }), v]); }, status = h("div"), confirm = input("a-close", "text", "", { placeholder: "Type CLOSE", autocomplete: "off" });
    shell([head("Account", "Your sign-in, your agreement and closing your account."),
      card([h("h2", { text: "Details" }), h("ul", { class: "summary" }, [
        row("Business", pro.business), row("Mobile (your sign-in)", phoneFmt(pro.mobile)), row("Email", pro.email || "Not given"), row("Member since", day(pro.memberSince) || "Today"),
        row("Verification", pro.verification), row("Pro Agreement accepted", pro.agreement ? "Version of " + pro.agreement : "Not on record")]),
        h("p", { class: "link-row" }, [h("a", { class: "link-more", href: "/pro-agreement/", target: "_blank", rel: "noopener", text: "Pro Agreement" }), h("a", { class: "link-more", href: "/terms/", target: "_blank", rel: "noopener", text: "Terms of Use" }), h("a", { class: "link-more", href: "/privacy/", target: "_blank", rel: "noopener", text: "Privacy Policy" })]),
        h("button", { class: "btn btn--outline btn--block", type: "button", text: "Sign out", on: { click: function () { call("/api/pro/sign-out", {}).then(function () { try { localStorage.removeItem("hh_pro"); } catch (e) {} location.href = "/pros/sign-in/"; }); } } })]),
      card([h("h2", { text: "Team members" }), h("p", { class: "sub", text: "Add up to 5 people to this account. You choose who gets lead texts, who can sign in and who can claim leads." }), h("button", { class: "btn btn--outline btn--block", type: "button", text: "Open my team", on: { click: function () { go("team"); } } })]),
      card([h("h2", { text: "Close account" }), h("p", { class: "sub", text: "Closing stops all offers and signs you out. Leads you already bought stay yours to work. To take a break without closing, pause your leads in Notifications." }),
        field("a-close", "Type CLOSE to confirm", confirm), status,
        h("button", { class: "btn btn--outline btn--block", type: "button", text: "Close my account", on: { click: function () { call("/api/pro/close", { confirm: confirm.value.trim() }).then(function (r) { if (r.error) { status.innerHTML = ""; status.appendChild(note(r.error, "bad")); return; } location.href = "/pros/"; }); } } })]),
    ]);
  }
  function moreView() {
    shell([head("More", pro.business), h("div", { class: "pp-more" }, NAV.filter(function (n) { return PRIMARY.indexOf(n[0]) < 0; }).map(function (n) { return navLink(n, "pp-link"); })),
      h("button", { class: "btn btn--outline btn--block tour-again", type: "button", text: "Take the tour", on: { click: function () { startTour(); } } })]);
  }

  // ---------- first-time tour ----------
  // A card at the bottom of the screen walks a new person through the real portal, moving between tabs and
  // ringing the part it is talking about. It never blocks the page, and can be skipped at any card.
  var tourInfo = { exclusiveMultiple: 3, maxPros: 5, welcome: 240, hotHours: 72, leadDays: 7, textsLive: false }, tourEl = null, tourTimer = null;
  function tourSteps() {
    var t = tourInfo, m = pro.member, steps = [];
    steps.push({ hound: true, title: "Welcome, " + (m ? m.name : pro.business) + ".", body: "Here is how Hammer Hound works, in about a minute." });
    steps.push({ tab: "offers", sel: "[data-nav=offers]", title: "Real jobs in " + (pro.market || "your market") + ".", body: "Every lead is written the same way: the job, the area, the size and the timing. Hot leads came in during the last " + t.hotHours + " hours." + (!m && pro.card ? " Older leads, 3 to " + t.leadDays + " days, are marked down on their own tab." : "") });
    steps.push({ tab: "offers", sel: ".pp-grid .offer", title: "Claim the ones you want.", body: m && !m.canPay
      ? "When you want a lead, reply YES to the text or tell " + pro.business + ". They claim it for the account."
      : "Each lead shows its price. It depends on the trade, the size of the job and how soon they want it. Shared goes to up to " + t.maxPros + " pros. \"Only me\" is yours alone for " + t.exclusiveMultiple + " times the shared price. The owner's details are yours the moment you claim." });
    if (!m) steps.push({ tab: "offers", sel: "[data-balance]", title: "You start with " + money0(t.welcome) + ".", body: "That is welcome credit. It pays for hot leads once you are verified. After that, leads are paid from your wallet. Add a card and it reloads when you run short." });
    if (!m) steps.push({ tab: "notifications", sel: ".pp-main .card", title: "Leads come to your phone.", body: t.textsLive ? "We text new leads in your market. Reply YES to claim one and the full details come straight back by text." : "Turn on lead texts here. When texting goes live, new leads in your market come to your phone and a YES claims one." });
    steps.push({ tab: "leads", sel: "[data-nav=leads]", title: "Work them here.", body: "Every lead " + (m ? "on the account" : "you claim") + " lands in My leads. Mark each one New, Contacted, Quoted or Won, and keep notes. Got a bad one? Report it and we review it for a credit back." });
    steps.push(m || pro.verified
      ? { hound: true, title: "You're set.", body: "Go see what is open right now.", cta: ["See open leads", "offers"] }
      : { hound: true, title: "One step left.", body: "Verify your business to start claiming. Upload proof of business and insurance. It takes about 2 minutes.", cta: ["Verify my business", "verify"] });
    return steps;
  }
  function tourRing(sel) {
    clearInterval(tourTimer);
    [].forEach.call(document.querySelectorAll(".tour-ring"), function (e) { e.classList.remove("tour-ring"); });
    if (!sel) return;
    var tries = 0;
    // The screen is redrawn when the tab changes, so wait for the part to exist, then keep the ring on it.
    tourTimer = setInterval(function () {
      var el = [].filter.call(document.querySelectorAll(sel), function (e) { return e.offsetParent !== null || e.getClientRects().length; })[0];
      if (el && !el.classList.contains("tour-ring")) { el.classList.add("tour-ring"); if (el.closest(".pp-main") && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" }); else if (!el.closest(".pp-bar")) window.scrollTo({ top: 0, behavior: "smooth" }); }
      if (++tries > 40 || !tourEl) clearInterval(tourTimer);
    }, 150);
  }
  function endTour(dest) {
    if (tourEl) { tourEl.remove(); tourEl = null; }
    tourRing(null); document.body.classList.remove("has-tour");
    if (!pro.tourSeen) { pro.tourSeen = true; call("/api/pro/tour", {}); }
    if (dest) go(dest);
  }
  function startTour() {
    var steps = tourSteps(), i = 0;
    if (tourEl) tourEl.remove();
    tourEl = h("div", { class: "tour", role: "dialog", "aria-label": "Tour of the portal", "aria-live": "polite" });
    document.body.appendChild(tourEl); document.body.classList.add("has-tour");
    function show() {
      var s = steps[i], last = i === steps.length - 1;
      if (s.tab && s.tab !== tab && VIEWS[s.tab]) go(s.tab);
      tourRing(s.sel);
      tourEl.innerHTML = "";
      var next = h("button", { class: "btn btn--yellow", type: "button", text: last ? s.cta[0] : i === 0 ? "Show me" : "Next", on: { click: function () { if (last) endTour(s.cta[1]); else { i++; show(); } } } });
      tourEl.appendChild(h("div", { class: "tour-card" + (s.hound ? " tour-card--hound" : "") }, [
        s.hound ? h("img", { src: "/assets/img/badge.png", alt: "", width: "56", height: "68" }) : null,
        h("div", { class: "tour-text" }, [h("p", { class: "tour-step", text: (i + 1) + " of " + steps.length }), h("h2", { text: s.title }), h("p", { text: s.body })]),
        h("div", { class: "tour-foot" }, [
          h("div", { class: "tour-dots", "aria-hidden": "true" }, steps.map(function (_, n) { return h("i", { class: n === i ? "is-on" : "" }); })),
          h("div", { class: "tour-btns" }, [
            last ? null : h("button", { class: "btn btn--text btn--sm", type: "button", text: "Skip", on: { click: function () { endTour(); } } }),
            i > 0 ? h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Back", on: { click: function () { i--; show(); } } }) : null, next])])]));
      next.focus({ preventScroll: true });
    }
    show();
  }

  // ---------- team ----------
  function teamView() {
    call("/api/pro/team").then(function (r) {
      if (tab !== "team") return;
      if (r.error) { shell([head("Team"), note(r.error, "bad")]); return; }
      draw(r);
    });
    function draw(r) {
      var top = h("div");
      var done = function (res, target) { if (res.error) { target.innerHTML = ""; target.appendChild(note(res.error, "bad")); return false; } if (res.members) draw(res); return true; };
      var cards = r.members.map(function (m) {
        var status = h("div"), grant = h("div"), id = m.id;
        var texts = toggle("t-tx-" + id, "Gets lead texts", m.optedInAt ? "New leads in your market and trades are texted to this number." : "Starts once they reply YES to the invite text.", m.getsTexts);
        var portal = toggle("t-po-" + id, "Can sign in", "Sees open leads and the leads you have. Never sees your wallet, card, documents or settings.", m.portal);
        var cap = input("t-cap-" + id, "number", m.dailyCap || "", { min: "10", max: "5000", placeholder: "No limit" });
        var save = h("button", { class: "btn btn--outline btn--block", type: "button", text: "Save", on: { click: function () { call("/api/pro/team/update", { memberId: id, getsTexts: texts.box.checked, portal: portal.box.checked, dailyCap: cap.value }).then(function (res) { done(res, status); }); } } });
        // Pay authority. On: two confirmations, the second a code texted to the owner. Off: one tap.
        function askGrant() {
          grant.innerHTML = "";
          grant.appendChild(h("div", { class: "tm-confirm" }, [
            h("strong", { text: "Let " + m.name + " claim and pay for leads?" }),
            h("p", { text: "A YES from " + phoneFmt(m.mobile) + " will order the lead. It is paid from your wallet" + (r.card ? ", and if the wallet is short " + r.card + " is charged a reload." : ", and from any card you add later if the wallet is short.") }),
            h("p", { text: "You are responsible for every charge " + m.name + " makes until you turn this off." + (m.dailyCap ? " Their daily limit is " + money0(m.dailyCap) + "." : " They have no daily limit.") }),
            h("div", { class: "offer-actions" }, [
              h("button", { class: "btn btn--black", type: "button", text: "Yes, text me a code to confirm", on: { click: function () { call("/api/pro/team/authority", { memberId: id, on: true, confirm: "yes" }).then(function (res) { if (res.error) { grant.appendChild(note(res.error, "bad")); return; } if (res.next === "code") askCode(res); else done(res, grant); }); } } }),
              h("button", { class: "btn btn--text", type: "button", text: "Cancel", on: { click: function () { grant.innerHTML = ""; } } })])]));
        }
        function askCode(sent) {
          var code = input("t-code-" + id, "text", "", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", placeholder: "6-digit code" }), err = h("div");
          grant.innerHTML = "";
          grant.appendChild(h("div", { class: "tm-confirm" }, [
            h("strong", { text: "Confirm on your phone" }), h("p", { text: sent.sent === "test" ? "Test account: enter your test code." : "We texted a code to " + sent.to + ". Enter it to give " + m.name + " pay authority." }),
            field("t-code-" + id, "Code", code), err,
            h("div", { class: "offer-actions" }, [
              h("button", { class: "btn btn--yellow", type: "button", text: "Confirm pay authority", on: { click: function () { call("/api/pro/team/authority", { memberId: id, on: true, confirm: "yes", code: code.value.trim() }).then(function (res) { done(res, err); }); } } }),
              h("button", { class: "btn btn--text", type: "button", text: "Cancel", on: { click: function () { grant.innerHTML = ""; } } })])]));
          code.focus();
        }
        var pay = m.canPay
          ? h("div", { class: "tm-pay tm-pay--on" }, [h("div", {}, [h("strong", { text: "Can claim and pay by text" }), h("small", { text: "On since " + when(m.payGrantedAt) + "." })]), h("button", { class: "btn btn--black btn--sm", type: "button", text: "Turn off", on: { click: function () { call("/api/pro/team/authority", { memberId: id, on: false }).then(function (res) { done(res, status); }); } } })])
          : h("div", { class: "tm-pay" }, [h("div", {}, [h("strong", { text: "Cannot claim or pay" }), h("small", { text: m.optedInAt ? "A YES from this number only asks you to claim the lead." : "Available once they accept the invite." })]), m.optedInAt ? h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Give pay authority", on: { click: askGrant } }) : null]);
        return card([
          h("div", { class: "tm-head" }, [h("div", {}, [h("h2", { text: m.name }), h("p", { class: "meta", text: phoneFmt(m.mobile) })]), h("span", { class: "chip " + (m.optedInAt ? "chip--green" : "chip--yellow"), text: m.optedInAt ? "Accepted" : "Invite sent" })]),
          !m.optedInAt ? h("div", { class: "offer-actions" }, [h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Text the invite again", on: { click: function () { call("/api/pro/team/invite", { memberId: id }).then(function (res) { if (done(res, status)) { status.innerHTML = ""; status.appendChild(note("Invite sent.", "good")); } }); } } }),
            r.test ? h("button", { class: "btn btn--text btn--sm", type: "button", text: "Mark as accepted (test)", on: { click: function () { call("/api/pro/team/test-optin", { memberId: id }).then(function (res) { done(res, status); }); } } }) : null]) : null,
          pay, grant, texts.el, portal.el, field("t-cap-" + id, "Daily limit for leads they claim ($)", cap, "Leave empty for no limit."), status, save,
          h("button", { class: "btn btn--text btn--block", type: "button", text: "Remove " + m.name, on: { click: function () { call("/api/pro/team/remove", { memberId: id }).then(function (res) { done(res, status); }); } } })], "verify");
      });
      if (!r.ack) {
        var agree = toggle("t-ack", "I understand", "", false), gs = h("div");
        shell([head("Team", "Add up to " + r.max + " people to this account."),
          card([h("h2", { text: "Before you add anyone" }),
            h("div", { class: "tm-confirm" }, [
              h("p", { text: "People you add get lead texts on their own phone once they accept." }),
              h("p", { text: "If you choose, you can also give a person the authority to claim leads. A YES from their number then orders the lead and it is paid from your wallet and your card on file." }),
              h("p", { text: "That is off for everyone until you turn it on for a person. Each time, you confirm it on screen and with a code we text to your phone. You are responsible for the charges they make." }), agree.el]),
            gs, h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Turn on my team", on: { click: function () { call("/api/pro/team/ack", { agree: agree.box.checked ? "yes" : "" }).then(function (res) { done(res, gs); }); } } })], "verify")]);
        return;
      }
      var name = input("t-name", "text", "", { autocomplete: "off" }), phone = input("t-phone", "tel", "", { autocomplete: "off", placeholder: "(901) 555-0100" });
      var add = r.members.length < r.max ? card([h("h2", { text: "Add a person" }), field("t-name", "Name", name), field("t-phone", "Their mobile number", phone, "We text them an invite. They get lead texts only after they reply YES."), top,
        h("button", { class: "btn btn--yellow btn--block", type: "button", text: "Add and text the invite", on: { click: function () { call("/api/pro/team/add", { name: name.value, phone: phone.value }).then(function (res) { done(res, top); }); } } })], "verify")
        : card([h("h2", { text: "Your team is full" }), h("p", { class: "sub", text: "An account can have up to " + r.max + " people. Remove someone to add another." })]);
      var log = r.log.length ? card([h("h2", { text: "Team history" }), h("ul", { class: "tm-log" }, r.log.map(function (e) { return h("li", {}, [h("span", { text: e.entry }), h("small", { text: when(e.at) + (e.by ? " · " + e.by : "") })]); }))]) : null;
      shell([head("Team", r.members.length + " of " + r.max + " people. You choose who gets lead texts, who can sign in and who can claim leads.")].concat(cards, [add, log]));
    }
  }

  var VIEWS = { team: teamView, home: homeView, offers: offersView, leads: leadsView, wallet: walletView, verify: verifyView, profile: profileView, notifications: notificationsView, support: supportView, account: accountView, more: moreView };
  function render() {
    if (!VIEWS[tab]) tab = pro && pro.member ? "offers" : "home";
    VIEWS[tab]();
  }
  window.addEventListener("popstate", function () { var t = location.hash.slice(1); if (pro && VIEWS[t]) { tab = t; render(); } });
  call("/api/pro/me").then(function (r) {
    if (r.status === 401) { try { localStorage.removeItem("hh_pro"); } catch (e) {} location.href = "/pros/sign-in/"; return; }
    if (r.error) { root.innerHTML = ""; root.appendChild(note(r.error, "bad")); return; }
    pro = r.pro; store.set("hh_pro", "1"); if (r.tour) tourInfo = r.tour;
    // First time in: the tour. It starts once the first screen is drawn.
    if (!pro.tourSeen) setTimeout(startTour, 600);
    if (pro.member) { asMember(); Object.keys(VIEWS).forEach(function (k) { if (MEMBER_TABS.indexOf(k) < 0) delete VIEWS[k]; }); tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "offers"; render(); return; }
    var t = location.hash.slice(1);
    // A new pro lands on verification first, and can skip it to look at leads.
    tab = VIEWS[t] ? t : !pro.verified && pro.verification === "Not started" && !store.get("hh_skip") ? "verify" : "home";
    render();
  });
})();
