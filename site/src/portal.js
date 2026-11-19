// Hammer Hound pro portal. Draws verification, offers, my leads and account from /api/pro/*.
(function () {
  "use strict";
  var root = document.querySelector("[data-portal]");
  if (!root) return;
  var pro = null, tab = "offers";
  var DOC_TYPES = ["State contractor license", "City or county business license", "Secretary of State registration", "IRS EIN letter (CP 575 or 147C)", "DBA or assumed-name certificate", "State tax registration certificate"];
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
  function note(text, kind) { return h("p", { class: "form-status" + (kind ? " is-" + kind : ""), role: "status", text: text }); }
  function setHeader() {
    var b = document.querySelector("[data-balance]"), s = document.querySelector("[data-signout]");
    if (!pro) return;
    b.textContent = money(pro.balance) + (pro.freeLeadsLeft ? " · " + pro.freeLeadsLeft + " free left" : ""); b.hidden = false;
    s.hidden = false; s.onclick = function () { call("/api/pro/sign-out", {}).then(function () { location.href = "/pros/sign-in/"; }); };
  }
  function shell(content) {
    root.innerHTML = "";
    if (pro && pro.test) root.appendChild(h("p", { class: "test-banner", text: "Test account. Leads are copied from Dalton Digital forms for internal testing. No card is charged and no owner is contacted." }));
    if (pro) {
      var tabs = [["offers", pro.verified ? "Offers" : "Leads in my market"]].concat(pro.verified ? [["leads", "My leads"]] : [["verify", "Get verified"]], [["account", "Account"]]);
      root.appendChild(h("div", { class: "tabs" }, tabs.map(function (t) {
        return h("button", { class: "chip chip--link" + (tab === t[0] ? " is-on" : "") + (t[0] === "verify" ? " chip--cta" : ""), type: "button", text: t[1], on: { click: function () { tab = t[0]; render(); } } });
      })));
      if (!pro.verified && tab !== "verify") root.appendChild(h("div", { class: "unlock" }, [
        h("img", { src: "/assets/img/badge.png", alt: "", width: "50", height: "60" }),
        h("div", {}, [h("strong", { text: pro.verification === "Pending" ? "We are checking your documents." : pro.verification === "Insurance expired" ? "Your insurance on file has expired." : "Verify your business to unlock your Verified Pro badge and 3 free leads." }),
          h("span", { text: pro.verification === "Pending" ? "You can look at leads now. Claiming unlocks as soon as both documents pass." : pro.verification === "Insurance expired" ? "Upload a current certificate to get your badge back and keep buying leads." : "You can look at every lead in your market now. Claiming and buying unlock when you are verified." })]),
        h("button", { class: "btn btn--black", type: "button", text: pro.verification === "Pending" ? "Send new documents" : pro.verification === "Insurance expired" ? "Update insurance" : "Get verified", on: { click: function () { tab = "verify"; render(); } } }),
      ]));
    }
    content.forEach(function (c) { root.appendChild(c); });
    setHeader();
  }

  function verifyView() {
    var status = h("div");
    var field = function (id, label, input, hint) { return h("div", { class: "vfield" }, [h("label", { class: "label", for: id, text: label }), input, hint ? h("p", { class: "hint", text: hint }) : null]); };
    var file = function (id) { return h("input", { class: "input", id: id, type: "file", accept: ".pdf,image/*", required: "" }); };
    var ein = h("input", { class: "input", id: "v-ein", type: "text", inputmode: "numeric", autocomplete: "off", placeholder: "12-3456789", maxlength: "10", required: "" });
    ein.addEventListener("input", function () { var d = ein.value.replace(/\D/g, "").slice(0, 9); ein.value = d.length > 2 ? d.slice(0, 2) + "-" + d.slice(2) : d; });
    var legal = h("input", { class: "input", id: "v-legal", type: "text", autocomplete: "organization", required: "", value: pro.legalName || "" });
    var type = h("select", { class: "input", id: "v-type", required: "" }, [h("option", { value: "", text: "Choose a document" })].concat(DOC_TYPES.map(function (t) { return h("option", { value: t, text: t }); })));
    var bFile = file("doc-business"), iFile = file("doc-insurance");
    var expires = h("input", { class: "input", id: "v-expires", type: "date", required: "", min: new Date().toISOString().slice(0, 10) });
    var s1 = h("li", { text: "1. Your business" }), s2 = h("li", { text: "2. Your insurance" });
    var progress = function () { s1.className = legal.value.trim() && ein.value.length === 10 && type.value && bFile.files[0] ? "is-done" : ""; s2.className = iFile.files[0] && expires.value ? "is-done" : ""; };
    var title = pro.verification === "Pending" ? "We are checking your documents" : pro.verification === "Insurance expired" ? "Update your insurance" : "Get verified";
    var form = h("form", { class: "card form verify" }, [
      h("div", { class: "verify-hero" }, [h("img", { src: "/assets/img/badge-large.png", alt: "", width: "106", height: "128" }), h("div", {}, [
        h("h1", { text: title }),
        h("p", { class: "sub", text: pro.verification === "Pending" ? "Your badge and free leads unlock as soon as both documents pass. You can send new ones below." : "Two steps unlock your Verified Pro badge and your 3 free leads." }),
      ])]),
      h("ul", { class: "verify-unlocks" }, [h("li", { text: "Verified Pro badge" }), h("li", { text: "3 free leads" }), h("li", { text: "Claim and buy leads" })]),
      h("ol", { class: "verify-steps" }, [s1, s2]),
      h("h2", { text: "Your business" }),
      field("v-legal", "Legal business name", legal, "The name on your EIN and your documents."),
      field("v-ein", "EIN", ein, "Your 9-digit federal tax ID. One account per EIN. We never accept a Social Security number."),
      field("v-type", "Proof of business", type),
      field("doc-business", "Upload that document", bFile, "PDF or photo. It must show your business name."),
      h("h2", { text: "Your insurance" }),
      field("doc-insurance", "Certificate of insurance", iFile, "PDF or photo showing general liability cover."),
      field("v-expires", "Insurance expiry date", expires, "Your badge stays active until this date."),
      status,
      h("button", { class: "btn btn--yellow btn--block btn--lg", type: "submit", text: "Verify my business" }),
      pro.verified ? null : h("button", { class: "btn btn--text btn--block", type: "button", text: "Skip for now and see leads in my market", on: { click: function () { store.set("hh_skip", "1"); tab = "offers"; render(); } } }),
      pro.verified ? null : h("p", { class: "hint hint--center", text: "You can look at leads without verifying. You cannot claim or buy one until you do." }),
    ]);
    form.addEventListener("input", progress); form.addEventListener("change", progress);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = bFile.files[0], i = iFile.files[0];
      var bad = function (t) { status.innerHTML = ""; status.appendChild(note(t, "bad")); };
      if (!b || !i) return bad("Choose both documents.");
      call("/api/pro/documents", { legalName: legal.value, ein: ein.value, docType: type.value, businessFile: b.name, insuranceFile: i.name, insuranceExpires: expires.value }).then(function (r) {
        if (r.error) return bad(r.error);
        pro = r.pro; tab = pro.verified ? "account" : "offers"; render();
      });
    });
    shell([form]);
  }

  function offersView() {
    shell([h("p", { class: "meta", text: "Loading offers." })]);
    call("/api/pro/offers").then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      pro = r.pro;
      var items = r.offers.map(function (o) {
        var status = h("div");
        var act = function (kind) { return function () {
          call("/api/pro/buy", { leadId: o.id, kind: kind }).then(function (res) {
            if (res.error) { status.innerHTML = ""; status.appendChild(note(res.error, res.status === 402 ? "" : "bad")); return; }
            pro.balance = res.balance; pro.freeLeadsLeft = res.freeLeadsLeft; tab = "leads"; render();
          });
        }; };
        var freeNow = pro.freeLeadsLeft > 0, locked = !r.canBuy;
        return h("div", { class: "card offer" }, [
          h("div", { class: "offer-top" }, [h("span", { class: "chip", text: o.service || "Job" }), h("span", { class: "chip chip--yellow", text: "Ends " + when(o.endsAt) })]),
          h("h3", { text: o.title }),
          h("p", { class: "meta", text: "Received " + when(o.receivedAt) + " · " + o.spotsTaken + " of " + o.maxPros + " spots taken" }),
          h("p", { class: "offer-price", text: freeNow && !locked ? "Free" : money(o.sharedPrice) }),
          h("p", { class: "meta", text: locked ? "Shared lead. Your first 3 are free once you are verified." : freeNow ? "Uses 1 of your " + pro.freeLeadsLeft + " free leads. Normally " + money(o.sharedPrice) + " shared." : "Shared lead" }),
          locked ? h("div", { class: "offer-actions" }, [h("button", { class: "btn btn--outline btn--locked", type: "button", text: "Verify to claim this lead", on: { click: function () { tab = "verify"; render(); } } })])
          : h("div", { class: "offer-actions" }, [
            h("button", { class: "btn btn--yellow", type: "button", text: freeNow ? "Claim free lead" : "Buy lead", on: { click: act("shared") } }),
            o.exclusiveAvailable ? h("button", { class: "btn btn--outline", type: "button", text: "Exclusive " + money(o.exclusivePrice), on: { click: act("exclusive") } }) : null,
          ]),
          status,
        ]);
      });
      shell([h("div", { class: "portal-head" }, [h("h1", { text: r.canBuy ? "Open offers" : "Leads in your market" }), h("p", { class: "meta", text: r.offers.length + " live" })])]
        .concat(items.length ? [h("div", { class: "grid grid--3" }, items)] : [h("div", { class: "card form" }, [h("h2", { text: "No open offers right now" }), h("p", { class: "sub", text: "New leads show up here as they come in." })])]));
    });
  }

  function leadsView() {
    shell([h("p", { class: "meta", text: "Loading your leads." })]);
    call("/api/pro/leads").then(function (r) {
      if (r.error) return shell([note(r.error, "bad")]);
      pro = r.pro;
      var items = r.leads.map(function (l) {
        var status = h("div");
        var report = l.review === "None" ? h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Report a bad lead", on: { click: function () {
          var reason = h("textarea", { class: "input", rows: "3", placeholder: "What was wrong with this lead?" });
          var sendBtn = h("button", { class: "btn btn--black btn--sm", type: "button", text: "Send report", on: { click: function () {
            call("/api/pro/report", { purchaseId: l.purchaseId, reason: reason.value }).then(function (res) { status.innerHTML = ""; status.appendChild(note(res.error || "Reported. We will review it and you can choose a credit or a refund if it is approved.", res.error ? "bad" : "good")); });
          } } });
          status.innerHTML = ""; status.appendChild(reason); status.appendChild(sendBtn); report.hidden = true;
        } } }) : h("span", { class: "chip", text: "Review: " + l.review });
        return h("div", { class: "card offer" }, [
          h("div", { class: "offer-top" }, [h("span", { class: "chip", text: l.kind + " · " + (l.price ? money(l.price) : "Free") }), h("span", { class: "meta", text: "Bought " + when(l.boughtAt) })]),
          h("h3", { text: l.title }),
          h("div", { class: "lead-contact" }, [h("strong", { text: l.ownerName || "Name not given" }), l.ownerPhone ? h("a", { href: "tel:+1" + l.ownerPhone, text: phoneFmt(l.ownerPhone) }) : h("span", { class: "meta", text: "No phone number given" }), l.ownerEmail ? h("a", { href: "mailto:" + l.ownerEmail, text: l.ownerEmail }) : null]),
          l.message ? h("p", { text: l.message }) : null,
          report, status,
        ]);
      });
      shell([h("div", { class: "portal-head" }, [h("h1", { text: "My leads" }), h("p", { class: "meta", text: r.leads.length + " bought" })])]
        .concat(items.length ? [h("div", { class: "grid grid--3" }, items)] : [h("div", { class: "card form" }, [h("h2", { text: "No leads yet" }), h("p", { class: "sub", text: "Leads you buy or claim show up here with the owner's details." })])]));
    });
  }

  function accountView() {
    var row = function (k, v) { return h("li", {}, [h("span", { class: "meta", text: k + ": " }), v]); };
    var day = function (d) { return d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : ""; };
    shell([
      pro.verified ? h("div", { class: "vbadge" }, [h("img", { src: "/assets/img/badge.png", alt: "", width: "66", height: "80" }), h("div", {}, [
        h("p", { class: "vbadge-title", text: "Verified Pro" }), h("p", { class: "vbadge-name", text: pro.legalName || pro.business }),
        h("p", { class: "meta", text: (pro.verifiedAt ? "Verified " + day(pro.verifiedAt) + ". " : "") + (pro.insuranceExpires ? "Active until " + day(pro.insuranceExpires) + ", when your insurance on file expires." : "") }),
      ])]) : null,
      h("div", { class: "card form" }, [h("h1", { text: "Account" }), h("ul", { class: "summary" }, [
        row("Business", pro.business), pro.legalName ? row("Legal name", pro.legalName) : null, pro.einLast4 ? row("EIN", "ending in " + pro.einLast4) : null,
        row("Mobile", phoneFmt(pro.mobile)), row("Trade", pro.trade || "Not set"), row("ZIP code", pro.zip || "Not set"),
        row("Verification", pro.verification), pro.insuranceExpires ? row("Insurance expires", day(pro.insuranceExpires)) : null, row("Balance", money(pro.balance)), row("Free leads left", String(pro.freeLeadsLeft)),
      ])]),
    ]);
  }

  function render() {
    if (pro.verified && tab === "verify") tab = "offers";
    if (!pro.verified && tab === "leads") tab = "offers";
    if (tab === "verify") return verifyView();
    if (tab === "leads") return leadsView();
    if (tab === "account") return accountView();
    offersView();
  }
  call("/api/pro/me").then(function (r) {
    if (r.status === 401) { location.href = "/pros/sign-in/"; return; }
    if (r.error) { root.innerHTML = ""; root.appendChild(note(r.error, "bad")); return; }
    pro = r.pro;
    // A new pro lands on verification first, and can skip it to look at leads.
    if (!pro.verified && pro.verification === "Not started" && !store.get("hh_skip")) tab = "verify";
    render();
  });
})();
