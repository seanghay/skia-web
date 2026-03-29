import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { create } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, 'GoogleSans.ttf');
const W = 400;
const H = 300;

let CanvasKit;
let fontData;

before(async () => {
  CanvasKit = await create();
  fontData = await readFile(FONT_PATH);
});

// Helper: create a minimal picture with a white background
function makeWhitePicture() {
  const recorder = new CanvasKit.PictureRecorder();
  const rc = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, W, H));
  rc.drawColor(CanvasKit.WHITE);
  const picture = recorder.finishRecordingAsPicture();
  recorder.delete();
  return picture;
}

describe('initialization', () => {
  it('create() resolves to a non-null object', () => {
    assert.ok(CanvasKit);
  });

  it('exposes PictureRecorder constructor', () => {
    assert.strictEqual(typeof CanvasKit.PictureRecorder, 'function');
  });

  it('exposes PDFDocument constructor', () => {
    assert.strictEqual(typeof CanvasKit.PDFDocument, 'function');
  });

  it('exposes PDFMetadata constructor', () => {
    assert.strictEqual(typeof CanvasKit.PDFMetadata, 'function');
  });

  it('exposes SVGCanvas constructor', () => {
    assert.strictEqual(typeof CanvasKit.SVGCanvas, 'function');
  });

  it('exposes MakeSurface function', () => {
    assert.strictEqual(typeof CanvasKit.MakeSurface, 'function');
  });

  it('exposes FontMgr.FromData', () => {
    assert.strictEqual(typeof CanvasKit.FontMgr?.FromData, 'function');
  });

  it('exposes ParagraphBuilder.Make', () => {
    assert.strictEqual(typeof CanvasKit.ParagraphBuilder?.Make, 'function');
  });

  it('exposes color constants BLACK, WHITE, BLUE', () => {
    assert.ok(CanvasKit.BLACK);
    assert.ok(CanvasKit.WHITE);
    assert.ok(CanvasKit.BLUE);
  });

  it('Color() is callable and returns a value', () => {
    const c = CanvasKit.Color(255, 0, 0, 1.0);
    assert.ok(c);
  });

  it('LTRBRect() is callable and returns a value', () => {
    const r = CanvasKit.LTRBRect(0, 0, W, H);
    assert.ok(r);
  });
});

describe('PDF export', () => {
  let picture;

  before(() => {
    picture = makeWhitePicture();
  });

  after(() => picture.delete());

  it('returns a Uint8Array', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    const pdfCanvas = doc.beginPage(W, H);
    pdfCanvas.drawPicture(picture);
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.ok(bytes instanceof Uint8Array);
  });

  it('has non-zero byte length', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    doc.beginPage(W, H);
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.ok(bytes.length > 0);
  });

  it('starts with %PDF magic header', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    const pdfCanvas = doc.beginPage(W, H);
    pdfCanvas.drawPicture(picture);
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    // %PDF = 0x25 0x50 0x44 0x46
    assert.strictEqual(bytes[0], 0x25);
    assert.strictEqual(bytes[1], 0x50);
    assert.strictEqual(bytes[2], 0x44);
    assert.strictEqual(bytes[3], 0x46);
  });

  it('produces valid output with drawColor', () => {
    const recorder = new CanvasKit.PictureRecorder();
    const rc = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, W, H));
    rc.drawColor(CanvasKit.BLUE);
    const pic = recorder.finishRecordingAsPicture();
    recorder.delete();

    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    const pdfCanvas = doc.beginPage(W, H);
    pdfCanvas.drawPicture(pic);
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    pic.delete();

    assert.strictEqual(bytes[0], 0x25);
    assert.strictEqual(bytes[1], 0x50);
  });
});

describe('SVG export', () => {
  let picture;

  before(() => {
    picture = makeWhitePicture();
  });

  after(() => picture.delete());

  it('returns a Uint8Array', () => {
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    svg.getCanvas().drawPicture(picture);
    const bytes = svg.close();
    assert.ok(bytes instanceof Uint8Array);
  });

  it('has non-zero byte length', () => {
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    const bytes = svg.close();
    assert.ok(bytes.length > 0);
  });

  it('contains <svg element marker', () => {
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    svg.getCanvas().drawPicture(picture);
    const bytes = svg.close();
    const text = Buffer.from(bytes).toString('utf8');
    assert.ok(text.includes('<svg'), 'SVG output must contain <svg element');
  });

  it('getCanvas() returns a truthy canvas before close()', () => {
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    const canvas = svg.getCanvas();
    assert.ok(canvas);
    svg.close();
  });
});

describe('PNG export', () => {
  it('MakeSurface returns a non-null surface', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.ok(surface);
    surface.delete();
  });

  it('surface.getCanvas() returns a truthy canvas', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.ok(surface.getCanvas());
    surface.delete();
  });

  it('encodeToBytes() returns a non-null Uint8Array', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    image.delete();
    surface.delete();
    assert.ok(bytes !== null);
    assert.ok(bytes instanceof Uint8Array);
  });

  it('PNG bytes have non-zero length', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    image.delete();
    surface.delete();
    assert.ok(bytes.length > 0);
  });

  it('PNG bytes start with PNG magic signature', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    surface.getCanvas().drawColor(CanvasKit.WHITE);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    image.delete();
    surface.delete();
    // PNG magic: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    assert.strictEqual(bytes[0], 0x89);
    assert.strictEqual(bytes[1], 0x50); // P
    assert.strictEqual(bytes[2], 0x4E); // N
    assert.strictEqual(bytes[3], 0x47); // G
    assert.strictEqual(bytes[4], 0x0D);
    assert.strictEqual(bytes[5], 0x0A);
    assert.strictEqual(bytes[6], 0x1A);
    assert.strictEqual(bytes[7], 0x0A);
  });
});

describe('text layout', () => {
  let fontMgr;

  before(() => {
    fontMgr = CanvasKit.FontMgr.FromData(fontData);
  });

  after(() => fontMgr?.delete());

  function makeParaStyle() {
    return new CanvasKit.ParagraphStyle({
      textStyle: {
        color: CanvasKit.BLACK,
        fontSize: 16,
        fontFamilies: ['Google Sans'],
      },
      textAlign: CanvasKit.TextAlign.Left,
    });
  }

  it('FontMgr.FromData returns a non-null FontMgr', () => {
    assert.ok(fontMgr);
  });

  it('fontMgr.countFamilies() >= 1', () => {
    assert.ok(fontMgr.countFamilies() >= 1);
  });

  it('fontMgr.getFamilyName(0) returns a non-empty string', () => {
    const name = fontMgr.getFamilyName(0);
    assert.strictEqual(typeof name, 'string');
    assert.ok(name.length > 0);
  });

  it('ParagraphBuilder.Make returns a non-null builder', () => {
    const builder = CanvasKit.ParagraphBuilder.Make(makeParaStyle(), fontMgr);
    assert.ok(builder);
    builder.delete();
  });

  it('paragraph.getHeight() > 0 after layout', () => {
    const builder = CanvasKit.ParagraphBuilder.Make(makeParaStyle(), fontMgr);
    builder.addText('Hello, CanvasKit!');
    const paragraph = builder.build();
    paragraph.layout(300);
    assert.ok(paragraph.getHeight() > 0);
    paragraph.delete();
    builder.delete();
  });

  it('paragraph.getLineMetrics() returns a non-empty array', () => {
    const builder = CanvasKit.ParagraphBuilder.Make(makeParaStyle(), fontMgr);
    builder.addText('Hello, CanvasKit!');
    const paragraph = builder.build();
    paragraph.layout(300);
    const metrics = paragraph.getLineMetrics();
    assert.ok(Array.isArray(metrics));
    assert.ok(metrics.length >= 1);
    paragraph.delete();
    builder.delete();
  });

  it('paragraph.getMaxWidth() matches layout width', () => {
    const builder = CanvasKit.ParagraphBuilder.Make(makeParaStyle(), fontMgr);
    builder.addText('Hello!');
    const paragraph = builder.build();
    paragraph.layout(300);
    assert.strictEqual(paragraph.getMaxWidth(), 300);
    paragraph.delete();
    builder.delete();
  });

  it('paragraph.getLongestLine() <= layout width', () => {
    const builder = CanvasKit.ParagraphBuilder.Make(makeParaStyle(), fontMgr);
    builder.addText('Hello!');
    const paragraph = builder.build();
    paragraph.layout(300);
    assert.ok(paragraph.getLongestLine() <= 300);
    paragraph.delete();
    builder.delete();
  });
});

describe('memory management', () => {
  it('PictureRecorder.delete() does not throw', () => {
    assert.doesNotThrow(() => {
      const r = new CanvasKit.PictureRecorder();
      r.delete();
    });
  });

  it('PictureRecorder begin+finish+delete does not throw', () => {
    assert.doesNotThrow(() => {
      const recorder = new CanvasKit.PictureRecorder();
      recorder.beginRecording(CanvasKit.LTRBRect(0, 0, W, H));
      const picture = recorder.finishRecordingAsPicture();
      picture.delete();
      recorder.delete();
    });
  });

  it('PDFDocument full cycle then delete does not throw', () => {
    assert.doesNotThrow(() => {
      const meta = new CanvasKit.PDFMetadata();
      const doc = new CanvasKit.PDFDocument(meta);
      doc.beginPage(W, H);
      doc.endPage();
      doc.close();
      doc.delete();
    });
  });

  it('SVGCanvas close then delete does not throw', () => {
    assert.doesNotThrow(() => {
      const svg = new CanvasKit.SVGCanvas(W, H, 1);
      svg.close();
      svg.delete();
    });
  });

  it('Surface.delete() does not throw', () => {
    assert.doesNotThrow(() => {
      const s = CanvasKit.MakeSurface(W, H);
      s.delete();
    });
  });

  it('FontMgr.delete() does not throw', () => {
    assert.doesNotThrow(() => {
      const mgr = CanvasKit.FontMgr.FromData(fontData);
      mgr.delete();
    });
  });

  it('ParagraphBuilder and Paragraph delete() do not throw', () => {
    const mgr = CanvasKit.FontMgr.FromData(fontData);
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, mgr);
    builder.addText('test');
    const paragraph = builder.build();
    paragraph.layout(200);
    assert.doesNotThrow(() => {
      paragraph.delete();
      builder.delete();
      mgr.delete();
    });
  });

  it('full pipeline cleanup does not throw', () => {
    const recorder = new CanvasKit.PictureRecorder();
    const rc = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, W, H));
    rc.drawColor(CanvasKit.WHITE);
    const picture = recorder.finishRecordingAsPicture();
    recorder.delete();

    // PDF
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    doc.beginPage(W, H).drawPicture(picture);
    doc.endPage();
    doc.close();

    // SVG
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    svg.getCanvas().drawPicture(picture);
    svg.close();

    // PNG
    const surface = CanvasKit.MakeSurface(W, H);
    surface.getCanvas().drawPicture(picture);
    const image = surface.makeImageSnapshot();
    image.encodeToBytes();

    assert.doesNotThrow(() => {
      image.delete();
      surface.delete();
      svg.delete();
      doc.delete();
      picture.delete();
    });
  });
});
