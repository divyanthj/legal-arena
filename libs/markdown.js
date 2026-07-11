const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeUrl = (value = "") => {
  const url = String(value || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(url) ? escapeHtml(url) : "#";
};

const inline = (value = "") => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<a href="${safeUrl(url)}">${alt || "Image"}</a>`)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}">${label}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/__([^_]+)__/g, "<strong>$1</strong>")
  .replace(/~~([^~]+)~~/g, "<del>$1</del>")
  .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");

export const markdownToSafeHtml = (content = "") => {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^```/.test(line.trim())) {
      const code = []; index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) code.push(lines[index++]);
      index += 1; output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); index += 1; continue; }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { output.push("<hr />"); index += 1; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      output.push(`<blockquote>${quote.map(inline).join("<br />")}</blockquote>`); continue;
    }
    const listMatch = line.match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]); const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)$/);
        if (!match || Boolean(match[2]) !== ordered) break;
        items.push(`<li>${inline(match[3])}</li>`); index += 1;
      }
      output.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`); continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1])) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = cells(line); index += 2; const rows = [];
      while (index < lines.length && lines[index].includes("|")) rows.push(cells(lines[index++]));
      output.push(`<table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue;
    }
    const paragraph = [line.trim()]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s|^```|^>|^\s*(?:[-+*]|\d+\.)\s+/.test(lines[index])) paragraph.push(lines[index++].trim());
    output.push(`<p>${paragraph.map(inline).join("<br />")}</p>`);
  }
  return output.join("");
};

export const styleEmailMarkdown = (html = "") => String(html || "")
  .replace(/<h1>/g, '<h1 style="margin:28px 0 12px;color:#fff;font-size:24px;line-height:1.25;">')
  .replace(/<h2>/g, '<h2 style="margin:26px 0 10px;color:#fff;font-size:20px;line-height:1.3;">')
  .replace(/<h3>/g, '<h3 style="margin:22px 0 8px;color:#fff;font-size:17px;line-height:1.35;">')
  .replace(/<p>/g, '<p style="margin:0 0 18px;color:#e7e1d4;font-size:15px;line-height:1.8;">')
  .replace(/<ul>/g, '<ul style="margin:0 0 22px 22px;padding:0;color:#e7e1d4;font-size:15px;line-height:1.75;">')
  .replace(/<ol>/g, '<ol style="margin:0 0 22px 24px;padding:0;color:#e7e1d4;font-size:15px;line-height:1.75;">')
  .replace(/<li>/g, '<li style="margin:0 0 8px;padding-left:4px;">')
  .replace(/<blockquote>/g, '<blockquote style="margin:0 0 22px;padding:12px 18px;border-left:3px solid #f7d56a;background:#17150f;color:#d8d0c1;">')
  .replace(/<pre>/g, '<pre style="margin:0 0 22px;padding:14px;border:1px solid #2f2f2f;border-radius:10px;background:#080808;color:#f4ead0;font-size:13px;line-height:1.6;white-space:pre-wrap;">')
  .replace(/<a /g, '<a style="color:#f7d56a;text-decoration:underline;" ')
  .replace(/<table>/g, '<table width="100%" style="width:100%;margin:0 0 22px;border-collapse:collapse;color:#e7e1d4;font-size:14px;">')
  .replace(/<th>/g, '<th style="padding:9px;border:1px solid #343434;background:#191919;color:#fff;text-align:left;">')
  .replace(/<td>/g, '<td style="padding:9px;border:1px solid #343434;vertical-align:top;">');
