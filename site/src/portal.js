// Hammer Hound pro portal. Draws verification, offers, my leads and account from /api/pro/*.
(function () {
  "use strict";
  var root = document.querySelector("[data-portal]");
  if (!root) return;
  var pro = null, tab = "offers";
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
    if (pro && pro.verification === "Verified") {
      root.appendChild(h("div", { class: "tabs" }, [["offers", "Offers"], ["leads", "My leads"], ["account", "Account"]].map(function (t) {
        return h("button", { class: "chip chip--link" + (tab === t[0] ? " is-on" : ""), type: "button", text: t[1], on: { click: function () { tab = t[0]; render(); } } });
      })));
    }
    content.forEach(function (c) { root.appendChild(c); });
    setHeader();
  }

  function verifyView() {
    var status = h("div");
    var file = function (id, label) { return [h("label", { class: "label", for: id, text: label }), h("input", { class: "input", id: id, type: "file", accept: ".pdf,image/*", required: "" })]; };
    var form = h("form", { class: "card form" }, [
      h("h1", { text: pro.verification === "Pending" ? "We are checking your documents" : "Verify your business" }),
      h("p", { class: "sub", text: pro.verification === "Pending" ? "You will get your free leads as soon as both documents pass. You can send new ones below." : "Upload proof of business and proof of insurance. Your 3 free leads unlock when both pass." }),
    ].concat(file("doc-business", "Proof of business"), file("doc-insurance", "Proof of insurance"), [status, h("button", { class: "btn btn--yellow btn--block", type: "submit", text: "Submit documents" })]));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = form.querySelector("#doc-business").files[0], i = form.querySelector("#doc-insurance").files[0];
      if (!b || !i) { status.innerHTML = ""; status.appendChild(note("Choose both documents.", "bad")); return; }
      call("/api/pro/documents", { businessFile: b.name, insuranceFile: i.name }).then(function (r) {
        if (r.error) { status.innerHTML = ""; status.appendChild(note(r.error, "bad")); return; }
        pro = r.pro; render();
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
        var freeNow = pro.freeLeadsLeft > 0;
        return h("div", { class: "card offer" }, [
          h("div", { class: "offer-top" }, [h("span", { class: "chip", text: o.service || "Job" }), h("span", { class: "chip chip--yellow", text: "Ends " + when(o.endsAt) })]),
          h("h3", { text: o.title }),
          h("p", { class: "meta", text: "Received " + when(o.receivedAt) + " · " + o.spotsTaken + " of " + o.maxPros + " spots taken" }),
          h("p", { class: "offer-price", text: freeNow ? "Free" : money(o.sharedPrice) }),
          h("p", { class: "meta", text: freeNow ? "Uses 1 of your " + pro.freeLeadsLeft + " free leads. Normally " + money(o.sharedPrice) + " shared." : "Shared lead" }),
          h("div", { class: "offer-actions" }, [
            h("button", { class: "btn btn--yellow", type: "button", text: freeNow ? "Claim free lead" : "Buy lead", on: { click: act("shared") } }),
            o.exclusiveAvailable ? h("button", { class: "btn btn--outline", type: "button", text: "Exclusive " + money(o.exclusivePrice), on: { click: act("exclusive") } }) : null,
          ]),
          status,
        ]);
      });
      shell([h("div", { class: "portal-head" }, [h("h1", { text: "Open offers" }), h("p", { class: "meta", text: r.offers.length + " live" })])]
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
          h("div", { class: "lead-contact" }, [h("strong", { text: l.ownerName || "Name not given" }), h("a", { href: "tel:+1" + l.ownerPhone, text: phoneFmt(l.ownerPhone) }), l.ownerEmail ? h("span", { text: l.ownerEmail }) : null]),
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
    shell([h("div", { class: "card form" }, [h("h1", { text: "Account" }), h("ul", { class: "summary" }, [
      row("Business", pro.business), row("Mobile", phoneFmt(pro.mobile)), row("Trade", pro.trade || "Not set"), row("ZIP code", pro.zip || "Not set"),
      row("Verification", pro.verification), row("Balance", money(pro.balance)), row("Free leads left", String(pro.freeLeadsLeft)),
    ])])]);
  }

  function render() {
    if (pro.verification !== "Verified") return verifyView();
    if (tab === "leads") return leadsView();
    if (tab === "account") return accountView();
    offersView();
  }
  call("/api/pro/me").then(function (r) {
    if (r.status === 401) { location.href = "/pros/sign-in/"; return; }
    if (r.error) { root.innerHTML = ""; root.appendChild(note(r.error, "bad")); return; }
    pro = r.pro; render();
  });
})();
