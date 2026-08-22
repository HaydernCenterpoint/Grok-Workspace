import type { OfficeDoc, OfficeSlide } from "./types";
import { xmlEscape } from "./xml";

export type OfficeZipEntry = { path: string; text: string };

const CT =
  'xmlns="http://schemas.openxmlformats.org/package/2006/content-types"';
const RELS =
  'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R =
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const P =
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function wt(text: string): string {
  return `<w:t xml:space="preserve">${xmlEscape(text)}</w:t>`;
}

function wp(inner: string, style?: string): string {
  const pr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pr}<w:r>${inner}</w:r></w:p>`;
}

function wTable(headers: string[], rows: string[][]): string {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const grid = Array.from({ length: cols }, () => "<w:gridCol w:w=\"2400\"/>").join(
    "",
  );
  const rowXml = (cells: string[], header: boolean) => {
    const padded = Array.from({ length: cols }, (_, i) => cells[i] ?? "");
    const shade = header
      ? "<w:tcPr><w:shd w:val=\"clear\" w:fill=\"E8DCC6\"/></w:tcPr>"
      : "";
    return `<w:tr>${padded
      .map((c) => `<w:tc>${shade}${wp(wt(c))}</w:tc>`)
      .join("")}</w:tr>`;
  };
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowXml(headers, true)}${rows.map((r) => rowXml(r, false)).join("")}</w:tbl>`;
}

function paperBody(doc: OfficeDoc): string {
  const parts = [wp(wt(doc.title), "Heading1")];
  if (doc.subtitle) parts.push(wp(wt(doc.subtitle), "Subtitle"));
  for (const block of doc.blocks ?? []) {
    switch (block.type) {
      case "h":
        parts.push(wp(wt(block.text), `Heading${block.level}`));
        break;
      case "p":
        parts.push(wp(wt(block.text)));
        break;
      case "ul":
        for (const item of block.items) {
          parts.push(
            `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r>${wt(item)}</w:r></w:p>`,
          );
        }
        break;
      case "ol":
        for (const item of block.items) {
          parts.push(
            `<w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r>${wt(item)}</w:r></w:p>`,
          );
        }
        break;
      case "table":
        parts.push(wTable(block.headers, block.rows));
        break;
      case "callout":
        parts.push(wp(wt(block.text), "IntenseQuote"));
        break;
      case "hr":
        parts.push(
          `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="C4A574"/></w:pBdr></w:pPr></w:p>`,
        );
        break;
      default: {
        const _never: never = block;
        void _never;
      }
    }
  }
  return parts.join("");
}

export function compileDocxParts(doc: OfficeDoc): OfficeZipEntry[] {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${paperBody(doc)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return [
    {
      path: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types ${CT}>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships ${RELS}>
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      path: "word/_rels/document.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships ${RELS}>
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: "word/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:basedOn w:val="Normal"/><w:rPr><w:i/></w:rPr></w:style>
</w:styles>`,
    },
    { path: "word/document.xml", text: document },
  ];
}

function aPara(text: string, size = 1800, bold = false): string {
  return `<a:p><a:r><a:rPr lang="en-US" sz="${size}"${bold ? ' b="1"' : ""} dirty="0"/><a:t>${xmlEscape(text)}</a:t></a:r></a:p>`;
}

function slideBody(slide: OfficeSlide): string {
  const layout = slide.layout ?? "bullets";
  const bits: string[] = [];
  switch (layout) {
    case "title":
      break;
    case "bullets":
      for (const b of slide.bullets ?? []) bits.push(aPara(`• ${b}`, 1600));
      break;
    case "two-col":
      for (const b of slide.left ?? []) bits.push(aPara(`• ${b}`, 1500));
      for (const b of slide.right ?? []) bits.push(aPara(`• ${b}`, 1500));
      break;
    case "table":
      if (slide.table) {
        bits.push(aPara(slide.table.headers.join("  ·  "), 1400, true));
        for (const row of slide.table.rows) {
          bits.push(aPara(row.join("  ·  "), 1400));
        }
      }
      break;
    default: {
      const _never: never = layout;
      void _never;
    }
  }
  return bits.join("") || aPara("");
}

function slideXml(slide: OfficeSlide): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${P} ${R} ${A}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${aPara(slide.title || "Slide", 2800, true)}</p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${slideBody(slide)}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme ${A} name="Grok Office">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F4E79"/></a:dk2>
      <a:lt2><a:srgbClr val="EEE5D5"/></a:lt2>
      <a:accent1><a:srgbClr val="C4A574"/></a:accent1>
      <a:accent2><a:srgbClr val="6B8F71"/></a:accent2>
      <a:accent3><a:srgbClr val="C45911"/></a:accent3>
      <a:accent4><a:srgbClr val="833C0C"/></a:accent4>
      <a:accent5><a:srgbClr val="548235"/></a:accent5>
      <a:accent6><a:srgbClr val="2F5496"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster ${P} ${R} ${A}>
  <p:cSld>
    <p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

const LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout ${P} ${R} ${A} type="titleAndContent" preserve="1">
  <p:cSld name="Title and Content">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

/** ponytail: minimal PPTX; PowerPoint may repair. Full designer layouts if users file bugs. */
export function compilePptxParts(doc: OfficeDoc): OfficeZipEntry[] {
  const slides = doc.slides ?? [];
  const slideIds = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join("");
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${P} ${R}>
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  const presRels = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...slides.map(
      (_, i) =>
        `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    ),
  ].join("");
  const overrides = [
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
    ...slides.map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    ),
  ].join("");
  const entries: OfficeZipEntry[] = [
    {
      path: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types ${CT}><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}</Types>`,
    },
    {
      path: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${RELS}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    },
    { path: "ppt/presentation.xml", text: presentation },
    {
      path: "ppt/_rels/presentation.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${RELS}>${presRels}</Relationships>`,
    },
    { path: "ppt/theme/theme1.xml", text: THEME_XML },
    { path: "ppt/slideMasters/slideMaster1.xml", text: MASTER_XML },
    {
      path: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${RELS}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    },
    { path: "ppt/slideLayouts/slideLayout1.xml", text: LAYOUT_XML },
    {
      path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${RELS}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    },
  ];
  slides.forEach((slide, i) => {
    entries.push({ path: `ppt/slides/slide${i + 1}.xml`, text: slideXml(slide) });
    entries.push({
      path: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${RELS}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
    });
  });
  return entries;
}
