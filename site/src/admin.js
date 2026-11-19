/* Hammer Hound admin panel: Today, the queues that need a person, and where pros are asking for leads. */
(function () {
  var root = document.querySelector("[data-admin]");
  if (!root) return;
  var realOnly = false;
  function h(tag, attrs, kids) {
    var el = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { if (k === "text") el.textContent = attrs[k]; else if (k === "on") Object.keys(attrs.on).forEach(function (e) { el.addEventListener(e, attrs.on[e]); }); else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]); });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function call(path, body) {
    return fetch(path, { method: body ? "POST" : "GET", credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (d) { d.status = r.status; return d; }); }).catch(function () { return { error: "Could not reach the server.", status: 0 }; });
  }
  var money = function (n) { return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var when = function (t) { return t ? new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; };
  var phone = function (p) { p = String(p || ""); return p.length === 10 ? "(" + p.slice(0, 3) + ") " + p.slice(3, 6) + "-" + p.slice(6) : p; };
  function note(text, kind) { return h("p", { class: "form-status" + (kind ? " is-" + kind : ""), role: "status", text: text }); }
  function draw(kids) { root.innerHTML = ""; kids.forEach(function (k) { if (k) root.appendChild(k); }); }

  function signIn(msg) {
    var key = h("input", { type: "password", id: "a-key", autocomplete: "current-password", class: "input" }), status = h("div");
    var form = h("form", { class: "card hq-card hq-signin", on: { submit: function (e) {
      e.preventDefault(); status.innerHTML = "";
      call("/api/admin/sign-in", { key: key.value }).then(function (r) { if (r.error) { status.appendChild(note(r.error, "bad")); return; } load(); });
    } } }, [h("h1", { text: "Admin sign-in" }), h("p", { class: "sub", text: msg || "Enter the admin key." }), h("label", { for: "a-key", text: "Admin key" }), key, h("button", { class: "btn btn--yellow btn--block", type: "submit", text: "Sign in" }), status]);
    draw([form]); key.focus();
  }

  function tile(label, big, small) { return h("div", { class: "stat" }, [h("span", { text: label }), h("strong", { text: String(big) }), small ? h("span", { text: small }) : null]); }
  function section(title, count, kids, emptyText) {
    return h("section", { class: "hq-section" }, [h("h2", {}, [title + " ", h("span", { class: "chip " + (count ? "chip--yellow" : "chip--green"), text: String(count) })])].concat(count ? kids : [h("p", { class: "meta", text: emptyText })]));
  }
  function act(status, path, body, okText) { status.innerHTML = ""; return call(path, body).then(function (r) { if (r.error) { status.appendChild(note(r.error, "bad")); return false; } status.appendChild(note(okText, "good")); setTimeout(load, 900); return true; }); }
  function who(p) { return h("p", { class: "meta", text: [p.legalName && p.legalName !== p.business ? "Legal name: " + p.legalName : "", p.trade, p.city, phone(p.phone), p.email].filter(Boolean).join(" · ") }); }
  var testChip = function (p) { return p.test ? h("span", { class: "chip", text: "Test" }) : null; };

  function verifyCard(p) {
    var status = h("div"), exp = h("input", { type: "date", class: "input", value: p.expires || "", id: "x-" + p.id }), reason = h("textarea", { class: "input", rows: "2", id: "r-" + p.id, placeholder: "Shown to the pro. Example: The certificate is cut off. Send the full page." });
    return h("div", { class: "card hq-card" }, [
      h("div", { class: "hq-head" }, [h("h3", { text: p.business }), testChip(p)]), who(p),
      h("p", { class: "meta", text: "EIN " + (p.ein ? p.ein.slice(0, 2) + "-" + p.ein.slice(2) : "not given") + " · " + (p.docType || "Document type not given") }),
      p.reason ? h("p", { text: "Why it is here: " + p.reason }) : null,
      h("div", { class: "hq-files" }, p.files.length ? p.files.map(function (f) { return h("a", { class: "btn btn--outline btn--sm", href: "/api/admin/doc?key=" + encodeURIComponent(f.key), target: "_blank", rel: "noopener", text: "Open " + f.label.toLowerCase() }); }) : [h("span", { class: "meta", text: "No stored documents." })]),
      p.detail ? h("details", {}, [h("summary", { text: "What the automated check read" }), h("pre", { class: "hq-pre", text: p.detail })]) : null,
      h("label", { for: "x-" + p.id, text: "Insurance expires" }), exp,
      h("label", { for: "r-" + p.id, text: "Reason, if declining" }), reason,
      h("div", { class: "hq-actions" }, [
        h("button", { class: "btn btn--yellow", type: "button", text: "Approve", on: { click: function () { act(status, "/api/admin/verify", { proId: p.id, decision: "approve", expires: exp.value }, "Approved. The pro has been emailed."); } } }),
        h("button", { class: "btn btn--outline", type: "button", text: "Decline", on: { click: function () { act(status, "/api/admin/verify", { proId: p.id, decision: "decline", reason: reason.value }, "Declined. The pro has been emailed the reason."); } } })]), status]);
  }
  function reportCard(r) {
    var status = h("div"), reason = h("input", { type: "text", class: "input", id: "d-" + r.purchaseId, placeholder: "Optional. Shown to the pro if you deny." });
    return h("div", { class: "card hq-card" }, [
      h("div", { class: "hq-head" }, [h("h3", { text: r.lead }), h("span", { class: "chip", text: r.kind + " · " + money(r.price) })]),
      h("p", { class: "meta", text: r.pro + " · bought " + when(r.boughtAt) }), h("p", { text: "Pro says: " + (r.reason || "No reason given.") }),
      h("label", { for: "d-" + r.purchaseId, text: "Reason, if denying" }), reason,
      h("div", { class: "hq-actions" }, [
        h("button", { class: "btn btn--yellow", type: "button", text: "Approve · credit " + money(r.price), on: { click: function () { act(status, "/api/admin/report", { purchaseId: r.purchaseId, decision: "approve" }, money(r.price) + " is back in the pro's wallet."); } } }),
        h("button", { class: "btn btn--outline", type: "button", text: "Deny", on: { click: function () { act(status, "/api/admin/report", { purchaseId: r.purchaseId, decision: "deny", reason: reason.value }, "Denied. The pro has been emailed."); } } })]), status]);
  }
  function ticketCard(t) {
    var status = h("div"), reply = h("textarea", { class: "input", rows: "3", id: "t-" + t.id });
    return h("div", { class: "card hq-card" }, [
      h("div", { class: "hq-head" }, [h("h3", { text: t.subject }), t.topic ? h("span", { class: "chip", text: t.topic }) : null]),
      h("p", { class: "meta", text: t.pro + (t.email ? " · " + t.email : "") + " · " + when(t.createdAt) }), h("p", { class: "hq-msg", text: t.message }),
      h("label", { for: "t-" + t.id, text: "Your reply" }), reply,
      h("div", { class: "hq-actions" }, [h("button", { class: "btn btn--yellow", type: "button", text: "Send reply and close", on: { click: function () { act(status, "/api/admin/ticket", { ticketId: t.id, reply: reply.value }, "Reply saved to the ticket."); } } })]), status]);
  }
  function declinedCard(p) {
    return h("div", { class: "card hq-card" }, [h("div", { class: "hq-head" }, [h("h3", { text: p.business }), testChip(p)]), who(p),
      h("p", { text: (p.card || "Card") + " was declined for " + money(p.amount) + " on " + when(p.at) + (p.forLead ? ". A lead claim is waiting on it." : ".") }),
      h("p", { class: "meta", text: "The pro has a link to update the card. Nothing to do unless you want to call them." })]);
  }

  function dashboard(d) {
    var s = d.stats, q = d.queues, needs = q.verifications.length + q.reports.length + q.tickets.length;
    var toggle = h("label", { class: "hq-toggle" }, [h("input", { type: "checkbox", checked: realOnly, on: { change: function (e) { realOnly = e.target.checked; load(); } } }), " Hide test accounts"]);
    var rows = d.marketRequests.map(function (g) { return h("tr", {}, [h("td", { text: g.market }), h("td", { text: g.trade }), h("td", { class: "num", text: String(g.pros) }), h("td", { class: "num", text: String(g.verified) }), h("td", { class: "num", text: String(g.openNow) }), h("td", { text: when(g.last) })]); });
    draw([
      h("div", { class: "hq-top" }, [h("div", {}, [h("h1", { text: "Today" }), h("p", { class: "meta", text: "As of " + when(d.asOf) + (needs ? " · " + needs + " waiting on you" : " · nothing waiting on you") })]),
        h("div", { class: "hq-top-actions" }, [toggle, h("button", { class: "btn btn--outline btn--sm", type: "button", text: "Refresh", on: { click: load } }), d.who === "key" ? h("button", { class: "btn btn--text btn--sm", type: "button", text: "Sign out", on: { click: function () { call("/api/admin/sign-out", {}).then(function () { signIn(); }); } } }) : null])]),
      h("div", { class: "pp-stats hq-stats" }, [
        tile("New pros today", s.pros.today, s.pros.week + " in 7 days"),
        tile("Pros", s.pros.total, s.pros.verified + " verified"),
        tile("Leads in today", s.leadsIn.today, s.leadsIn.week + " in 7 days"),
        tile("Open leads", s.leadsOpen.hot + s.leadsOpen.older, s.leadsOpen.hot + " hot · " + s.leadsOpen.older + " older"),
        tile("Claims today", s.claims.today, s.claims.week + " in 7 days"),
        tile("Lead sales today", money(s.leadSales.today), money(s.leadSales.week) + " in 7 days"),
        tile("Paid, not free credit, today", money(s.paidFromCards.today), money(s.paidFromCards.week) + " in 7 days"),
        tile("Card charges today", money(s.cardCharges.today), money(s.cardCharges.week) + " in 7 days"),
        tile("Wallet balances held", money(s.walletBalances), money(s.welcomeCreditOut) + " is unspent welcome credit"),
        tile("Leads rejected, 7 days", s.leadsOpen.rejectedWeek, s.leadsOpen.writerStuck ? s.leadsOpen.writerStuck + " the writer could not finish" : "Writer has none stuck")]),
      section("Verifications to review", q.verifications.length, q.verifications.map(verifyCard), "No documents are waiting for a person."),
      section("Bad-lead reports", q.reports.length, q.reports.map(reportCard), "No reports are open."),
      section("Support tickets", q.tickets.length, q.tickets.map(ticketCard), "No tickets are open."),
      section("Declined cards", q.declinedCards.length, q.declinedCards.map(declinedCard), "No card has been declined in the last 48 hours."),
      section("Pay authority changes", d.authority.length, [h("p", { class: "meta", text: "Every time an owner let a team member charge their account by text, or took that away. Newest first." }),
        h("div", { class: "hq-table" }, [h("table", {}, [h("thead", {}, [h("tr", {}, ["Change", "Account", "Team member", "By", "When", "IP"].map(function (t) { return h("th", { text: t }); }))]), h("tbody", {}, d.authority.map(function (e) { return h("tr", {}, [h("td", { text: e.action.replace("Pay authority ", "") }), h("td", { text: e.account }), h("td", { text: e.member + " " + phone(e.mobile) }), h("td", { text: e.by }), h("td", { text: when(e.at) }), h("td", { text: e.ip })]); }))])])], "No owner has changed pay authority yet."),
      section("Where pros want more leads", d.marketRequests.length, [h("p", { class: "meta", text: "Each row is a market and trade where a pro found no open leads and pressed the button. Most-requested first." }),
        h("div", { class: "hq-table" }, [h("table", {}, [h("thead", {}, [h("tr", {}, ["Market", "Trade", "Pros asking", "Verified", "Open leads now", "Last asked"].map(function (t, i) { return h("th", { class: i > 1 && i < 5 ? "num" : null, text: t }); }))]), h("tbody", {}, rows)])])], "No pro has asked for more leads yet."),
    ]);
  }
  function load() {
    call("/api/admin/overview" + (realOnly ? "?real=1" : "")).then(function (d) {
      if (d.status === 401) { if (d.access) draw([h("div", { class: "card hq-card" }, [h("h1", { text: "Not signed in" }), h("p", { text: "This panel opens through Cloudflare Access. Reload the page to sign in with your Google account." })])]); else signIn(); return; }
      if (d.error) { draw([note(d.error, "bad"), h("button", { class: "btn btn--outline", type: "button", text: "Try again", on: { click: load } })]); return; }
      dashboard(d);
    });
  }
  load();
})();
