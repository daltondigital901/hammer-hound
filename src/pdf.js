// A small PDF writer for monthly invoices. No libraries: it writes the PDF objects directly,
// using the built-in Helvetica fonts, filled rectangles and one optional JPEG logo.

// Helvetica character widths (per 1000 units) for ASCII 32 to 126, used to right-align and trim text.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const clean = (s) => String(s == null ? "" : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/·/g, "-").replace(/[^\x20-\x7e]/g, "?");
export const textWidth = (s, size, bold) => [...clean(s)].reduce((n, ch) => n + (W[ch.charCodeAt(0) - 32] || 556), 0) * size / 1000 * (bold ? 1.06 : 1);
const fit = (s, size, max, bold) => { let t = clean(s); if (textWidth(t, size, bold) <= max) return t; while (t.length > 1 && textWidth(t + "...", size, bold) > max) t = t.slice(0, -1); return t.trimEnd() + "..."; };
const esc = (s) => clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const rgb = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");

const C = { asphalt: "#1D2125", yellow: "#FFC20E", orange: "#F15A22", white: "#FFFFFF", steel: "#56616B", line: "#D3D7DB", concrete: "#F0F1F2", tint: "#FFF4CC", green: "#1E8E3E" };

// One page's drawing commands.
function canvas() {
  const ops = [];
  return {
    ops,
    rect: (x, y, w, h, color) => ops.push(`${rgb(color)} rg ${x} ${y} ${w} ${h} re f`),
    text: (s, x, y, { size = 10, bold = false, color = C.asphalt, align = "left", max = 0 } = {}) => {
      const t = max ? fit(s, size, max, bold) : clean(s), w = textWidth(t, size, bold);
      ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${(align === "right" ? x - w : align === "center" ? x - w / 2 : x).toFixed(2)} ${y} Td (${esc(t)}) Tj ET`);
    },
    image: (x, y, w, h) => ops.push(`q ${w} 0 0 ${h} ${x} ${y} cm /Im1 Do Q`),
  };
}

const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// inv: { number, monthLabel, period, issued, seller: { name, address, email }, billTo: [lines], rows: [{ date, entry, type, amount }],
//        totals: { opening, added, charged, leadCount, leadsTotal, creditUsed, creditBack, closing } }
// logo: { bytes: Uint8Array (JPEG), width, height } or null.
export function invoicePdf(inv, logo) {
  const FIRST = 17, NEXT = 30, rows = inv.rows, pages = [];
  const chunks = [rows.slice(0, FIRST)]; for (let i = FIRST; i < rows.length; i += NEXT) chunks.push(rows.slice(i, i + NEXT));
  // Totals need about 150pt under the table; if the last page is full, they go on a page of their own.
  if (chunks.at(-1).length > (chunks.length === 1 ? FIRST - 5 : NEXT - 8)) chunks.push([]);

  chunks.forEach((chunk, pi) => {
    const c = canvas(); let y;
    // Brand header: dark bar, the hound, the name and tagline, then the yellow strip.
    c.rect(0, 702, 612, 90, C.asphalt); c.rect(0, 696, 612, 6, C.yellow);
    if (logo) c.image(40, 712, 59, 70);
    c.text("hammer hound", logo ? 112 : 40, 748, { size: 24, bold: true, color: C.white });
    c.text("REAL JOBS. LOCAL PROS. TRACKED DOWN.", logo ? 112 : 40, 732, { size: 8, bold: true, color: C.orange });
    c.text("INVOICE", 572, 752, { size: 20, bold: true, color: C.white, align: "right" });
    c.text(`${inv.number}  -  ${inv.monthLabel}`, 572, 734, { size: 9, color: C.line, align: "right" });
    if (chunks.length > 1) c.text(`Page ${pi + 1} of ${chunks.length}`, 572, 720, { size: 8, color: C.line, align: "right" });

    if (pi === 0) {
      c.text("BILLED TO", 40, 668, { size: 8, bold: true, color: C.steel });
      inv.billTo.filter(Boolean).slice(0, 4).forEach((l, i) => c.text(l, 40, 653 - i * 14, { size: i ? 10 : 12, bold: !i, max: 260 }));
      c.text("FROM", 330, 668, { size: 8, bold: true, color: C.steel });
      [inv.seller.name, inv.seller.address, inv.seller.email].filter(Boolean).forEach((l, i) => c.text(l, 330, 653 - i * 14, { size: i ? 10 : 12, bold: !i, max: 242 }));
      c.text("PERIOD", 40, 590, { size: 8, bold: true, color: C.steel }); c.text(inv.period, 40, 576, { size: 10 });
      c.text("ISSUED", 330, 590, { size: 8, bold: true, color: C.steel }); c.text(inv.issued, 330, 576, { size: 10 });
      // Four summary boxes.
      const t = inv.totals, boxes = [["LEADS CLAIMED", String(t.leadCount)], ["LEADS TOTAL", money(t.leadsTotal)], ["CHARGED TO CARD", money(t.charged)], ["WALLET AT MONTH END", money(t.closing)]];
      boxes.forEach(([k, v], i) => { const x = 40 + i * 135.5; c.rect(x, 508, 125.5, 50, i === 2 ? C.tint : C.concrete); c.text(k, x + 10, 542, { size: 7, bold: true, color: C.steel }); c.text(v, x + 10, 520, { size: 15, bold: true }); });
      y = 478;
    } else y = 668;

    if (chunk.length || pi === 0) {
      c.rect(40, y - 6, 532, 20, C.asphalt);
      c.text("DATE", 48, y, { size: 8, bold: true, color: C.white }); c.text("DESCRIPTION", 112, y, { size: 8, bold: true, color: C.white });
      c.text("TYPE", 400, y, { size: 8, bold: true, color: C.white }); c.text("AMOUNT", 564, y, { size: 8, bold: true, color: C.white, align: "right" });
      y -= 24;
      if (!chunk.length) { c.text("No activity this month.", 48, y, { size: 10, color: C.steel }); y -= 18; }
      chunk.forEach((r, i) => {
        if (i % 2) c.rect(40, y - 5, 532, 18, C.concrete);
        c.text(r.date, 48, y, { size: 9, color: C.steel }); c.text(r.entry, 112, y, { size: 9, max: 276 }); c.text(r.type, 400, y, { size: 9, color: C.steel, max: 90 });
        c.text(money(r.amount), 564, y, { size: 9, bold: true, align: "right", color: r.amount > 0 ? C.green : C.asphalt });
        y -= 18;
      });
    }

    if (pi === chunks.length - 1) {
      const t = inv.totals; y -= 10;
      const line = (k, v, o = {}) => { c.text(k, 330, y, { size: o.big ? 11 : 10, bold: !!o.big, color: o.big ? C.asphalt : C.steel }); c.text(v, 564, y, { size: o.big ? 11 : 10, bold: true, align: "right" }); y -= o.big ? 20 : 16; };
      line("Wallet at start of month", money(t.opening));
      line("Added to wallet", money(t.added));
      line(`Leads claimed (${t.leadCount})`, money(-t.leadsTotal));
      if (t.creditBack) line("Returned for bad leads", money(t.creditBack));
      c.rect(330, y + 8, 242, 1, C.line); y -= 4;
      line("Wallet at month end", money(t.closing), { big: true });
      c.rect(330, y - 12, 242, 30, C.tint);
      c.text("Charged to your card this month", 340, y - 2, { size: 10, bold: true }); c.text(money(t.charged), 564, y - 2, { size: 12, bold: true, align: "right" });
      y -= 36;
      c.text(t.creditUsed ? `${money(t.creditUsed)} of this month's leads was paid with free welcome credit.` : "", 330, y, { size: 8, color: C.steel });
      c.text("Amount due: $0.00. Leads are paid from your wallet as you claim them.", 330, y - 12, { size: 8, color: C.steel });
    }
    c.rect(40, 52, 532, 1, C.line);
    c.text(`${inv.seller.name}${inv.seller.address ? " - " + inv.seller.address : ""}`, 40, 38, { size: 8, color: C.steel, max: 360 });
    c.text("hammerhound.com  -  Questions? Reply to the email this came with.", 572, 38, { size: 8, color: C.steel, align: "right" });
    pages.push(c.ops.join("\n"));
  });

  // ---- assemble the file ----
  const enc = new TextEncoder(), parts = [], offsets = []; let size = 0;
  const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); size += b.length; };
  const obj = (n, body, stream) => {
    offsets[n] = size;
    put(`${n} 0 obj\n${body}\n`);
    if (stream) { put("stream\n"); put(stream); put("\nendstream\n"); }
    put("endobj\n");
  };
  const n = pages.length, IMG = 5, firstPage = 6;   // 1 catalog, 2 pages, 3 and 4 fonts, 5 image, then page and content pairs
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ")}] /Count ${n} >>`);
  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  if (logo) obj(IMG, `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>`, logo.bytes);
  else obj(IMG, "<< >>");
  pages.forEach((content, i) => {
    const p = firstPage + i * 2, bytes = enc.encode(content);
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${logo ? ` /XObject << /Im1 ${IMG} 0 R >>` : ""} >> /Contents ${p + 1} 0 R >>`);
    obj(p + 1, `<< /Length ${bytes.length} >>`, bytes);
  });
  const total = firstPage + n * 2, xref = size;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) put(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size); let at = 0;
  for (const b of parts) { out.set(b, at); at += b.length; }
  return out;
}
