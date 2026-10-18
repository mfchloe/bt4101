/*
 * Print one element of the page on its own, so the teacher can choose
 * "Save as PDF" in the print dialog. The element is copied into a hidden
 * iframe with the app's stylesheets; anything marked data-no-print
 * (edit buttons, notices) is removed from the copy.
 */
export default function printMaterial(element, title) {
  const copy = element.cloneNode(true);
  copy.querySelectorAll("[data-no-print]").forEach((el) => el.remove());

  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')]
    .map((el) => el.outerHTML)
    .join("\n");

  const safeTitle = title.replace(/[<>&"]/g, "");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });

  // srcdoc loads once, after its stylesheets, so print runs on the styled copy
  iframe.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    ${styles}
    <style>
      @page { margin: 18mm 16mm; }
      html, body { background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body>${copy.outerHTML}</body>
</html>`;

  iframe.onload = () => {
    const win = iframe.contentWindow;
    win.addEventListener("afterprint", () => iframe.remove());
    win.focus();
    win.print();
  };

  document.body.appendChild(iframe);
}
