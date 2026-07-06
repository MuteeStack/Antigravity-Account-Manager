/* ════════════════════════════════════════
   ANTIGRAVITY — EXPORT TO WORD  (export.js)
   Walks each prompt's Quill HTML and rebuilds it
   as a real .docx using the docx.js browser build.
════════════════════════════════════════ */

const btnExportPrompts = document.getElementById('btnExportPrompts');

btnExportPrompts.addEventListener('click', exportPromptsToWord);

/* ── Convert a base64 data URL to a Uint8Array for docx ImageRun ── */
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ── Figure out an image's natural pixel size so we can scale it sanely in the doc ── */
function getImageDims(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = dataUrl;
  });
}

/* Max display width inside the doc (content width ~9360 DXA = 6.5in @ 1440 DXA/in → use px equivalent) */
const MAX_DOC_IMG_WIDTH = 500; // px-equivalent, docx ImageRun takes px-like units

async function scaledImageSize(dataUrl) {
  const { w, h } = await getImageDims(dataUrl);
  if (w <= MAX_DOC_IMG_WIDTH) return { width: w, height: h };
  const ratio = MAX_DOC_IMG_WIDTH / w;
  return { width: MAX_DOC_IMG_WIDTH, height: Math.round(h * ratio) };
}

/* ── Parse a single Quill paragraph/block element's inline children into docx runs ── */
async function inlineNodesToRuns(node, baseFormat = {}) {
  const runs = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (!text) continue;
      runs.push(new docx.TextRun({
        text,
        bold: !!baseFormat.bold,
        italics: !!baseFormat.italic,
        underline: baseFormat.underline ? {} : undefined,
        color: baseFormat.link ? 'FF8C00' : undefined,
      }));
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName.toLowerCase();

    if (tag === 'img') {
      const src = child.getAttribute('src');
      if (src && src.startsWith('data:image')) {
        try {
          const bytes = dataUrlToUint8Array(src);
          const { width, height } = await scaledImageSize(src);
          runs.push(new docx.ImageRun({
            data: bytes,
            transformation: { width, height },
            type: src.includes('png') ? 'png' : (src.includes('gif') ? 'gif' : 'jpg'),
          }));
        } catch (err) {
          console.warn('Image embed failed, skipping:', err);
        }
      }
      continue;
    }

    if (tag === 'a') {
      const href = child.getAttribute('href') || '#';
      const innerRuns = await inlineNodesToRuns(child, { ...baseFormat, link: true, underline: true });
      runs.push(new docx.ExternalHyperlink({ link: href, children: innerRuns }));
      continue;
    }

    if (tag === 'strong' || tag === 'b') {
      runs.push(...await inlineNodesToRuns(child, { ...baseFormat, bold: true }));
      continue;
    }
    if (tag === 'em' || tag === 'i') {
      runs.push(...await inlineNodesToRuns(child, { ...baseFormat, italic: true }));
      continue;
    }
    if (tag === 'u') {
      runs.push(...await inlineNodesToRuns(child, { ...baseFormat, underline: true }));
      continue;
    }
    if (tag === 'br') {
      runs.push(new docx.TextRun({ text: '', break: 1 }));
      continue;
    }

    /* Unknown inline tag — just recurse into it with the same formatting */
    runs.push(...await inlineNodesToRuns(child, baseFormat));
  }

  return runs;
}

/* ── Convert a prompt's Quill HTML into an array of docx Paragraph elements ── */
async function quillHtmlToDocxParagraphs(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  const paragraphs = [];

  for (const block of Array.from(container.children)) {
    const tag = block.tagName.toLowerCase();

    if (tag === 'p') {
      /* Quill wraps an <img> alone in its own <p> sometimes */
      const onlyImg = block.children.length === 1 && block.children[0].tagName === 'IMG' && block.textContent.trim() === '';
      const runs = await inlineNodesToRuns(block);
      if (!runs.length) {
        paragraphs.push(new docx.Paragraph({ children: [] })); // blank line
      } else {
        paragraphs.push(new docx.Paragraph({
          children: runs,
          spacing: { after: onlyImg ? 200 : 160 },
        }));
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      for (const li of Array.from(block.children)) {
        const runs = await inlineNodesToRuns(li);
        paragraphs.push(new docx.Paragraph({
          children: runs,
          numbering: { reference: isOrdered ? 'export-numbers' : 'export-bullets', level: 0 },
        }));
      }
      continue;
    }

    /* Fallback: treat as a generic paragraph */
    const runs = await inlineNodesToRuns(block);
    if (runs.length) paragraphs.push(new docx.Paragraph({ children: runs, spacing: { after: 160 } }));
  }

  if (!paragraphs.length) paragraphs.push(new docx.Paragraph({ children: [] }));
  return paragraphs;
}

/* ── Main export handler ── */
async function exportPromptsToWord() {
  if (!prompts.length) { toast('No prompts to export yet.'); return; }

  btnExportPrompts.disabled = true;
  const originalHtml = btnExportPrompts.innerHTML;
  btnExportPrompts.innerHTML = '<i class="ph ph-spinner-gap"></i> Exporting…';

  try {
    const sectionChildren = [
      new docx.Paragraph({
        text: 'My Prompts',
        heading: docx.HeadingLevel.HEADING_1,
      }),
      new docx.Paragraph({
        children: [new docx.TextRun({ text: `Exported from Antigravity · ${new Date().toLocaleDateString()}`, italics: true, color: '888888', size: 18 })],
        spacing: { after: 360 },
      }),
    ];

    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];

      sectionChildren.push(new docx.Paragraph({
        text: p.title || `Prompt ${i + 1}`,
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: i === 0 ? 0 : 300, after: 120 },
      }));

      const html = p.html || `<p>${(p.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`;
      const blockParas = await quillHtmlToDocxParagraphs(html);
      sectionChildren.push(...blockParas);

      if (i < prompts.length - 1) {
        sectionChildren.push(new docx.Paragraph({
          border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 1 } },
          spacing: { after: 240 },
        }));
      }
    }

    const doc = new docx.Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 24 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 36, bold: true, font: 'Arial', color: '1A1A1A' },
            paragraph: { spacing: { after: 240 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 26, bold: true, font: 'Arial', color: 'FF8C00' },
            paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
        ]
      },
      numbering: {
        config: [
          { reference: 'export-bullets',
            levels: [{ level: 0, format: docx.LevelFormat.BULLET, text: '•', alignment: docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
          { reference: 'export-numbers',
            levels: [{ level: 0, format: docx.LevelFormat.DECIMAL, text: '%1.', alignment: docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: sectionChildren,
      }],
    });

    const blob = await docx.Packer.toBlob(doc);
    const filename = `Antigravity-Prompts-${new Date().toISOString().slice(0,10)}.docx`;
    saveAs(blob, filename);
    toast('Exported to Word!');
  } catch (err) {
    console.error('Export failed:', err);
    toast('Export failed — check console for details.');
  } finally {
    btnExportPrompts.disabled = false;
    btnExportPrompts.innerHTML = originalHtml;
  }
}
