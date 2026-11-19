// Builds a single-page preview of the site for hosts that cannot serve folders
// (for example a claude.ai artifact). Run after build.mjs:  node site/preview.mjs
// Output: site/dist-preview/index.html plus assets/. Navigation happens by #hash.
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist"), OUT = join(ROOT, "dist-preview");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hashOf = (path) => (path === "/" ? "home" : path === "/404.html" ? "not-found" : path.replace(/^\/|\/$/g, "").replace(/\//g, "--"));

const templates = [], routes = {};
for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
  const rel = "/" + relative(DIST, file).replace(/\\/g, "/");
  const path = rel === "/404.html" ? rel : rel.replace(/index\.html$/, "");
  const html = readFileSync(file, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  const cls = html.match(/<body class="([^"]*)">/)[1];
  const body = html.slice(html.indexOf(">", html.indexOf("<body")) + 1, html.indexOf("<script>window.HH="));
  const h = hashOf(path);
  routes[path] = h;
  templates.push(`<template data-route="${h}" data-path="${path}" data-title="${title}" data-class="${cls}">${body.replace(/(src|href)="\/assets\//g, '$1="assets/')}</template>`);
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hammer Hound site preview</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="assets/styles.css">
<style>.preview-bar{background:#B5390B;color:#fff;font:600 13px/1.4 Archivo,sans-serif;padding:6px 16px;text-align:center}</style>
</head>
<body>
<div class="preview-bar">Preview of hammerhound.com. Not the live site. Forms send nothing.</div>
<div id="app"></div>
${templates.join("\n")}
<script>
window.HH = { endpoints: {} };
window.HH_PREVIEW = true;
</script>
<script src="assets/app.js"></script>
<script>
(function () {
  var ROUTES = ${JSON.stringify(routes)};
  var app = document.getElementById("app"), search = "";
  function tpl(hash) { return document.querySelector('template[data-route="' + hash + '"]') || document.querySelector('template[data-route="not-found"]'); }
  function render() {
    var t = tpl((location.hash || "#home").slice(1));
    var path = t.getAttribute("data-path");
    window.HH_ROUTE = { pathname: path, search: search, href: "https://hammerhound.com" + path + search };
    app.className = t.getAttribute("data-class");
    app.innerHTML = t.innerHTML;
    document.title = t.getAttribute("data-title") + " (preview)";
    window.scrollTo(0, 0);
    window.HHInit();
    search = "";
  }
  function go(url) {
    var q = url.indexOf("?"), path = q === -1 ? url : url.slice(0, q);
    search = q === -1 ? "" : url.slice(q);
    var h = ROUTES[path] || "not-found";
    if ("#" + h === location.hash) render(); else location.hash = h;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (href.charAt(0) === "#") { e.preventDefault(); var el = document.getElementById(href.slice(1)); if (el) el.scrollIntoView(); return; }
    if (href.charAt(0) === "/") { e.preventDefault(); go(href); }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.getAttribute("action") && f.getAttribute("action").charAt(0) === "/") {
      e.preventDefault();
      go(f.getAttribute("action") + "?" + new URLSearchParams(new FormData(f)).toString());
    }
  });
  window.addEventListener("hashchange", render);
  render();
})();
</script>
</body>
</html>
`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(DIST, "assets"), join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "index.html"), page);
console.log(`Preview built: ${templates.length} pages in site/dist-preview/index.html`);
