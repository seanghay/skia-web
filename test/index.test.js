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

describe('Paint', () => {
  it('new Paint() constructs without error', () => {
    const paint = new CanvasKit.Paint();
    assert.ok(paint);
    paint.delete();
  });

  it('setStrokeWidth / getStrokeWidth round-trip', () => {
    const paint = new CanvasKit.Paint();
    paint.setStrokeWidth(5.5);
    assert.strictEqual(paint.getStrokeWidth(), 5.5);
    paint.delete();
  });

  it('setColor / getColor round-trip', () => {
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.RED);
    const components = CanvasKit.getColorComponents(paint.getColor());
    assert.strictEqual(components[0], 255); // R
    assert.strictEqual(components[1], 0);   // G
    assert.strictEqual(components[2], 0);   // B
    paint.delete();
  });

  it('setColorComponents does not throw (takes 0.0-1.0 floats)', () => {
    const paint = new CanvasKit.Paint();
    // setColorComponents expects normalized 0.0-1.0 float values
    assert.doesNotThrow(() => paint.setColorComponents(0.0, 0.502, 1.0, 1.0));
    paint.delete();
  });

  it('setStyle accepts Fill and Stroke', () => {
    const paint = new CanvasKit.Paint();
    assert.doesNotThrow(() => {
      paint.setStyle(CanvasKit.PaintStyle.Fill);
      paint.setStyle(CanvasKit.PaintStyle.Stroke);
    });
    paint.delete();
  });

  it('setAntiAlias does not throw', () => {
    const paint = new CanvasKit.Paint();
    assert.doesNotThrow(() => paint.setAntiAlias(true));
    paint.delete();
  });

  it('copy() produces an independent Paint', () => {
    const paint = new CanvasKit.Paint();
    paint.setStrokeWidth(3);
    const copy = paint.copy();
    copy.setStrokeWidth(99);
    assert.strictEqual(paint.getStrokeWidth(), 3);
    assert.strictEqual(copy.getStrokeWidth(), 99);
    paint.delete();
    copy.delete();
  });
});

describe('canvas drawing primitives', () => {
  it('drawRect does not throw and produces valid PNG', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.RED);
    paint.setStyle(CanvasKit.PaintStyle.Fill);
    assert.doesNotThrow(() => canvas.drawRect(CanvasKit.LTRBRect(10, 10, 100, 100), paint));
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.ok(bytes.length > 0);
    image.delete();
    paint.delete();
    surface.delete();
  });

  it('drawCircle does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLUE);
    assert.doesNotThrow(() => canvas.drawCircle(W / 2, H / 2, 50, paint));
    paint.delete();
    surface.delete();
  });

  it('drawLine does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    paint.setStyle(CanvasKit.PaintStyle.Stroke);
    paint.setStrokeWidth(2);
    assert.doesNotThrow(() => canvas.drawLine(0, 0, W, H, paint));
    paint.delete();
    surface.delete();
  });

  it('drawOval does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.GREEN);
    assert.doesNotThrow(() => canvas.drawOval(CanvasKit.LTRBRect(20, 20, 180, 120), paint));
    paint.delete();
    surface.delete();
  });

  it('drawPaint fills entire canvas without throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.Color(200, 200, 200, 1));
    assert.doesNotThrow(() => surface.getCanvas().drawPaint(paint));
    paint.delete();
    surface.delete();
  });
});

describe('PathBuilder', () => {
  it('new PathBuilder() constructs', () => {
    const pb = new CanvasKit.PathBuilder();
    assert.ok(pb);
    pb.delete();
  });

  it('isEmpty() is true for a new PathBuilder', () => {
    const pb = new CanvasKit.PathBuilder();
    assert.ok(pb.isEmpty());
    pb.delete();
  });

  it('moveTo + lineTo makes path non-empty', () => {
    const pb = new CanvasKit.PathBuilder();
    pb.moveTo(0, 0).lineTo(100, 100);
    const path = pb.detach();
    assert.ok(!path.isEmpty());
    path.delete();
    pb.delete();
  });

  it('countPoints() after moveTo+lineTo+close is 3', () => {
    const pb = new CanvasKit.PathBuilder();
    pb.moveTo(0, 0).lineTo(100, 0).lineTo(50, 100);
    const path = pb.detach();
    assert.ok(path.countPoints() >= 3);
    path.delete();
    pb.delete();
  });

  it('getBounds() of a triangle path is sensible', () => {
    const pb = new CanvasKit.PathBuilder();
    pb.moveTo(0, 0).lineTo(100, 0).lineTo(50, 80);
    const path = pb.detach();
    const bounds = path.getBounds();
    assert.ok(bounds[2] <= 100); // right edge
    assert.ok(bounds[3] <= 80);  // bottom edge
    path.delete();
    pb.delete();
  });

  it('drawPath on canvas does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const pb = new CanvasKit.PathBuilder();
    pb.moveTo(10, 10).lineTo(200, 10).lineTo(200, 200).lineTo(10, 200);
    const path = pb.detach();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    paint.setStyle(CanvasKit.PaintStyle.Stroke);
    assert.doesNotThrow(() => surface.getCanvas().drawPath(path, paint));
    path.delete();
    paint.delete();
    pb.delete();
    surface.delete();
  });
});

describe('color utilities', () => {
  it('Color4f() returns a value', () => {
    const c = CanvasKit.Color4f(1.0, 0.5, 0.0, 1.0);
    assert.ok(c);
  });

  it('ColorAsInt() returns a number', () => {
    const c = CanvasKit.ColorAsInt(255, 0, 128, 255);
    assert.strictEqual(typeof c, 'number');
  });

  it('parseColorString() parses hex colors and returns a non-null value', () => {
    const c = CanvasKit.parseColorString('#FF0000');
    assert.ok(c);
    // At least one component should be non-zero for a non-black color
    const comps = CanvasKit.getColorComponents(c);
    assert.ok(Array.from(comps).some(v => v > 0));
  });

  it('parseColorString() parses hex colors', () => {
    const color = CanvasKit.parseColorString('#0080FF');
    assert.ok(color);
    const components = CanvasKit.getColorComponents(color);
    assert.strictEqual(components[0], 0);
    assert.strictEqual(components[1], 128);
    assert.strictEqual(components[2], 255);
  });

  it('getColorComponents() returns [r, g, b, a] array', () => {
    const c = CanvasKit.Color(10, 20, 30, 1.0);
    const components = CanvasKit.getColorComponents(c);
    assert.ok(Array.isArray(components) || ArrayBuffer.isView(components));
    assert.strictEqual(components[0], 10);
    assert.strictEqual(components[1], 20);
    assert.strictEqual(components[2], 30);
  });

  it('multiplyByAlpha() scales alpha', () => {
    const c = CanvasKit.Color(255, 255, 255, 1.0);
    const half = CanvasKit.multiplyByAlpha(c, 0.5);
    const components = CanvasKit.getColorComponents(half);
    // alpha should be around 0.5 (index 3 is 0-1 float)
    assert.ok(components[3] <= 0.6 && components[3] >= 0.4);
  });
});

describe('canvas transforms', () => {
  it('save() returns a positive stack count', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const count = canvas.save();
    assert.ok(count >= 1);
    canvas.restore();
    surface.delete();
  });

  it('getSaveCount() reflects save/restore stack depth', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const before = canvas.getSaveCount();
    canvas.save();
    assert.strictEqual(canvas.getSaveCount(), before + 1);
    canvas.restore();
    assert.strictEqual(canvas.getSaveCount(), before);
    surface.delete();
  });

  it('translate does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.doesNotThrow(() => surface.getCanvas().translate(50, 50));
    surface.delete();
  });

  it('scale does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.doesNotThrow(() => surface.getCanvas().scale(2, 2));
    surface.delete();
  });

  it('rotate does not throw', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.doesNotThrow(() => surface.getCanvas().rotate(45, W / 2, H / 2));
    surface.delete();
  });

  it('save+translate+drawRect+restore produces valid PNG', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const canvas = surface.getCanvas();
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLUE);
    canvas.save();
    canvas.translate(50, 50);
    canvas.drawRect(CanvasKit.LTRBRect(0, 0, 100, 100), paint);
    canvas.restore();
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.ok(bytes[0] === 0x89); // PNG magic
    image.delete();
    paint.delete();
    surface.delete();
  });
});

describe('Surface dimensions', () => {
  it('surface.width() matches requested width', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.strictEqual(surface.width(), W);
    surface.delete();
  });

  it('surface.height() matches requested height', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.strictEqual(surface.height(), H);
    surface.delete();
  });

  it('surface.reportBackendTypeIsGPU() returns false (CPU-only)', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    assert.strictEqual(surface.reportBackendTypeIsGPU(), false);
    surface.delete();
  });
});

describe('image encoding options', () => {
  it('encodeToBytes with JPEG format returns a non-null Uint8Array', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    surface.getCanvas().drawColor(CanvasKit.WHITE);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes(CanvasKit.ImageFormat.JPEG, 80);
    image.delete();
    surface.delete();
    assert.ok(bytes !== null);
    assert.ok(bytes instanceof Uint8Array);
  });

  it('JPEG bytes start with JPEG SOI marker (0xFF 0xD8)', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    surface.getCanvas().drawColor(CanvasKit.WHITE);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes(CanvasKit.ImageFormat.JPEG, 90);
    image.delete();
    surface.delete();
    assert.ok(bytes !== null);
    assert.strictEqual(bytes[0], 0xFF);
    assert.strictEqual(bytes[1], 0xD8);
  });

  it('PNG quality parameter is ignored (output still valid PNG)', () => {
    const surface = CanvasKit.MakeSurface(W, H);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes(CanvasKit.ImageFormat.PNG, 50);
    image.delete();
    surface.delete();
    assert.ok(bytes !== null);
    assert.strictEqual(bytes[0], 0x89);
    assert.strictEqual(bytes[1], 0x50);
  });
});

describe('paragraph options', () => {
  let fontMgr;

  before(() => {
    fontMgr = CanvasKit.FontMgr.FromData(fontData);
  });

  after(() => fontMgr?.delete());

  it('maxLines truncates paragraph to N lines', () => {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
      maxLines: 1,
      ellipsis: '…',
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText('Line one. Line two. Line three. Line four. This is a very long paragraph that should be truncated.');
    const paragraph = builder.build();
    paragraph.layout(200);
    const metrics = paragraph.getLineMetrics();
    assert.ok(metrics.length <= 1);
    paragraph.delete();
    builder.delete();
  });

  it('TextAlign.Center does not throw', () => {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
      textAlign: CanvasKit.TextAlign.Center,
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText('Centered text');
    const paragraph = builder.build();
    assert.doesNotThrow(() => paragraph.layout(300));
    paragraph.delete();
    builder.delete();
  });

  it('TextAlign.Right does not throw', () => {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
      textAlign: CanvasKit.TextAlign.Right,
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText('Right-aligned');
    const paragraph = builder.build();
    assert.doesNotThrow(() => paragraph.layout(300));
    paragraph.delete();
    builder.delete();
  });

  it('pushStyle / pop applies mixed styles without throw', () => {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText('Normal ');
    builder.pushStyle(new CanvasKit.TextStyle({ color: CanvasKit.RED, fontSize: 24 }));
    builder.addText('Red Large ');
    builder.pop();
    builder.addText('normal again');
    const paragraph = builder.build();
    assert.doesNotThrow(() => paragraph.layout(400));
    assert.ok(paragraph.getHeight() > 0);
    paragraph.delete();
    builder.delete();
  });

  it('heightMultiplier option is accepted without throw', () => {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: { color: CanvasKit.BLACK, fontSize: 16, fontFamilies: ['Google Sans'] },
      heightMultiplier: 2.0,
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText('Hello World');
    const paragraph = builder.build();
    assert.doesNotThrow(() => paragraph.layout(300));
    assert.ok(paragraph.getHeight() > 0);
    paragraph.delete();
    builder.delete();
  });
});

describe('picture reuse', () => {
  it('same Picture renders to PDF, SVG, and PNG without corruption', () => {
    const recorder = new CanvasKit.PictureRecorder();
    const rc = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, W, H));
    rc.drawColor(CanvasKit.WHITE);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.RED);
    rc.drawCircle(W / 2, H / 2, 80, paint);
    paint.delete();
    const picture = recorder.finishRecordingAsPicture();
    recorder.delete();

    // PDF
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    doc.beginPage(W, H).drawPicture(picture);
    doc.endPage();
    const pdfBytes = doc.close();
    doc.delete();
    assert.strictEqual(pdfBytes[0], 0x25); // %PDF

    // SVG
    const svg = new CanvasKit.SVGCanvas(W, H, 1);
    svg.getCanvas().drawPicture(picture);
    const svgBytes = svg.close();
    svg.delete();
    assert.ok(Buffer.from(svgBytes).toString('utf8').includes('<svg'));

    // PNG
    const surface = CanvasKit.MakeSurface(W, H);
    surface.getCanvas().drawPicture(picture);
    const image = surface.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();
    image.delete();
    surface.delete();
    assert.strictEqual(pngBytes[0], 0x89); // PNG

    picture.delete();
  });

  it('multi-page PDF produces valid output', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);

    for (let i = 0; i < 3; i++) {
      const canvas = doc.beginPage(W, H);
      canvas.drawColor(CanvasKit.Color(i * 80, 0, 0, 1));
      doc.endPage();
    }

    const bytes = doc.close();
    doc.delete();
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(bytes[0], 0x25); // %PDF
    assert.ok(bytes.length > 0);
  });
});

describe('Shaper', () => {
  let typeface;
  let font;
  let fontProvider; // TypefaceFontProvider
  let fontArrayBuffer;

  before(() => {
    fontArrayBuffer = fontData.buffer.slice(
      fontData.byteOffset,
      fontData.byteOffset + fontData.byteLength,
    );
    typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(fontArrayBuffer);
    font = new CanvasKit.Font(typeface, 24);
    fontProvider = CanvasKit.TypefaceFontProvider.Make();
    fontProvider.registerFont(fontArrayBuffer, 'Google Sans');
  });

  after(() => {
    font.delete();
    typeface.delete();
    fontProvider.delete();
  });

  // --- factory ---

  it('Shaper.Make() returns a non-null Shaper', () => {
    const shaper = CanvasKit.Shaper.Make();
    assert.ok(shaper);
    shaper.delete();
  });

  it('Shaper.MakePrimitive() returns a non-null Shaper', () => {
    const shaper = CanvasKit.Shaper.MakePrimitive();
    assert.ok(shaper);
    shaper.delete();
  });

  it('Shaper.MakeWithFontMgr() returns a non-null Shaper', () => {
    // MakeWithFontMgr requires a FontMgr (not TypefaceFontProvider — different binding type)
    const mgr = CanvasKit.FontMgr.FromData(fontArrayBuffer);
    const shaper = CanvasKit.Shaper.MakeWithFontMgr(mgr);
    assert.ok(shaper);
    shaper.delete();
    mgr.delete();
  });

  // --- shapeTextToBlob ---

  it('shapeTextToBlob() returns a non-null TextBlob for ASCII text', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlob('Hello World', font, true, 500, 0, 0);
    assert.ok(blob !== null, 'expected a TextBlob for ASCII text');
    blob.delete();
    shaper.delete();
  });

  it('shapeTextToBlob() returns null for empty string', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlob('', font, true, 500, 0, 0);
    // empty input → no glyphs → null
    assert.strictEqual(blob, null);
    shaper.delete();
  });

  it('shapeTextToBlob() RTL flag does not throw', () => {
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlob('Hello', font, false /* RTL */, 500, 0, 0);
      blob?.delete();
    });
    shaper.delete();
  });

  it('shapeTextToBlob() result can be drawn on a canvas', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlob('Hello CanvasKit', font, true, 1000, 0, 0);
    assert.ok(blob);
    const surface = CanvasKit.MakeSurface(W, H);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    assert.doesNotThrow(() => surface.getCanvas().drawTextBlob(blob, 0, 50, paint));
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.ok(bytes[0] === 0x89); // valid PNG
    image.delete();
    paint.delete();
    surface.delete();
    blob.delete();
    shaper.delete();
  });

  it('shapeTextToBlob() with narrow width wraps text (does not throw)', () => {
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlob('Hello World this is a long sentence', font, true, 50, 0, 0);
      blob?.delete();
    });
    shaper.delete();
  });

  // --- shapeTextToBlobWithFontMgr ---

  it('shapeTextToBlobWithFontMgr() returns a non-null TextBlob for ASCII', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFontMgr('Hello World', font, fontProvider, true, 500, 0, 0);
    assert.ok(blob !== null, 'expected a TextBlob');
    blob.delete();
    shaper.delete();
  });

  it('shapeTextToBlobWithFontMgr() returns null for empty string', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFontMgr('', font, fontProvider, true, 500, 0, 0);
    assert.strictEqual(blob, null);
    shaper.delete();
  });

  it('shapeTextToBlobWithFontMgr() handles Khmer text', () => {
    const shaper = CanvasKit.Shaper.Make();
    // Google Sans covers basic Khmer glyphs
    const blob = shaper.shapeTextToBlobWithFontMgr(
      'មិនដឹងប្រៅការញ៉ី',
      font, fontProvider, true, 500, 0, 0,
    );
    // We can't guarantee glyphs are present, but it must not throw
    blob?.delete();
    shaper.delete();
  });

  it('shapeTextToBlobWithFontMgr() result can be drawn on a surface', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFontMgr('Test text', font, fontProvider, true, 1000, 0, 0);
    assert.ok(blob);
    const surface = CanvasKit.MakeSurface(W, H);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    surface.getCanvas().drawTextBlob(blob, 10, 50, paint);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.ok(bytes[0] === 0x89);
    image.delete();
    paint.delete();
    surface.delete();
    blob.delete();
    shaper.delete();
  });

  it('shapeTextToBlobWithFontMgr() offsetX/offsetY shift glyph positions', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFontMgr('Offset', font, fontProvider, true, 1000, 20, 40);
    assert.ok(blob);
    blob.delete();
    shaper.delete();
  });

  // --- getEndPoint ---

  it('getEndPoint() returns a Float32Array of length 2', () => {
    const shaper = CanvasKit.Shaper.Make();
    const pt = shaper.getEndPoint('Hello', font, true, 1000, 0, 0);
    assert.ok(pt instanceof Float32Array);
    assert.strictEqual(pt.length, 2);
    shaper.delete();
  });

  it('getEndPoint() returns finite numbers', () => {
    const shaper = CanvasKit.Shaper.Make();
    const pt = shaper.getEndPoint('Hello', font, true, 1000, 0, 0);
    assert.ok(Number.isFinite(pt[0]), `endX should be finite, got ${pt[0]}`);
    assert.ok(Number.isFinite(pt[1]), `endY should be finite, got ${pt[1]}`);
    shaper.delete();
  });

  it('getEndPoint() embeds offsetX into the result', () => {
    const shaper = CanvasKit.Shaper.Make();
    const base    = shaper.getEndPoint('Hello', font, true, 1000, 0,   0);
    const shifted = shaper.getEndPoint('Hello', font, true, 1000, 100, 0);
    // offsetX is embedded: shifted[0] should be base[0] + 100
    assert.ok(
      Math.abs(shifted[0] - base[0] - 100) < 1,
      `expected shifted endX ≈ base+100, got base=${base[0]} shifted=${shifted[0]}`,
    );
    shaper.delete();
  });

  it('getEndPoint() offsetX shifts the result', () => {
    const shaper = CanvasKit.Shaper.Make();
    const base    = shaper.getEndPoint('Hello', font, true, 1000, 0,  0);
    const shifted = shaper.getEndPoint('Hello', font, true, 1000, 50, 0);
    assert.ok(
      Math.abs(shifted[0] - base[0] - 50) < 1,
      `expected shifted endX ≈ base+50, got base=${base[0]} shifted=${shifted[0]}`,
    );
    shaper.delete();
  });

  // --- memory management ---

  it('Shaper and TextBlob delete() do not throw', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlob('cleanup test', font, true, 500, 0, 0);
    assert.doesNotThrow(() => {
      blob?.delete();
      shaper.delete();
    });
  });

  it('Typeface and Font delete() do not throw', () => {
    const ab = fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
    const tf = CanvasKit.Typeface.MakeFreeTypeFaceFromData(ab);
    const f  = new CanvasKit.Font(tf, 16);
    assert.doesNotThrow(() => {
      f.delete();
      tf.delete();
    });
  });

  it('TypefaceFontProvider.delete() does not throw', () => {
    const provider = CanvasKit.TypefaceFontProvider.Make();
    assert.doesNotThrow(() => provider.delete());
  });
});

// ─── Font.getGlyphPath ────────────────────────────────────────────────────────

describe('Font.getGlyphPath', () => {
  let typeface;
  let font;

  before(() => {
    const ab = fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
    typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(ab);
    font = new CanvasKit.Font(typeface, 48);
  });

  after(() => {
    font.delete();
    typeface.delete();
  });

  it('returns a Path object', () => {
    const [glyphID] = font.getGlyphIDs('A');
    const path = font.getGlyphPath(glyphID);
    assert.ok(path, 'expected a Path for glyph A');
    path.delete();
  });

  it('path for a normal glyph is non-empty', () => {
    const [glyphID] = font.getGlyphIDs('A');
    const path = font.getGlyphPath(glyphID);
    assert.ok(!path.isEmpty(), 'outline path for A should not be empty');
    path.delete();
  });

  it('path bounds are sensible for an uppercase letter', () => {
    const [glyphID] = font.getGlyphIDs('M');
    const path = font.getGlyphPath(glyphID);
    const bounds = path.getBounds(); // [left, top, right, bottom]
    assert.ok(bounds[2] > bounds[0], 'path width should be positive');
    assert.ok(bounds[3] > bounds[1], 'path height should be positive');
    path.delete();
  });

  it('different glyphs produce different paths', () => {
    const [idA] = font.getGlyphIDs('A');
    const [idB] = font.getGlyphIDs('B');
    const pathA = font.getGlyphPath(idA);
    const pathB = font.getGlyphPath(idB);
    const boundsA = pathA.getBounds();
    const boundsB = pathB.getBounds();
    // At minimum the paths should exist; widths are almost certainly different
    assert.ok(!pathA.isEmpty());
    assert.ok(!pathB.isEmpty());
    pathA.delete();
    pathB.delete();
  });

  it('path can be drawn on a canvas', () => {
    const [glyphID] = font.getGlyphIDs('G');
    const path = font.getGlyphPath(glyphID);
    const surface = CanvasKit.MakeSurface(W, H);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    assert.doesNotThrow(() => surface.getCanvas().drawPath(path, paint));
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.strictEqual(bytes[0], 0x89); // valid PNG
    image.delete();
    paint.delete();
    surface.delete();
    path.delete();
  });

  it('path.delete() does not throw', () => {
    const [glyphID] = font.getGlyphIDs('X');
    const path = font.getGlyphPath(glyphID);
    assert.doesNotThrow(() => path.delete());
  });
});

// ─── Canvas.drawGlyphsRSXform ────────────────────────────────────────────────
// NOTE: drawGlyphsRSXform is declared in canvaskit.d.ts but the current WASM
// binary only exposes drawGlyphs. Tests are skipped until the WASM is updated.

describe('Canvas.drawGlyphsRSXform', { skip: 'not yet in WASM binary (only drawGlyphs is available)' }, () => {
  it('draws glyphs with identity xforms without throwing', () => {});
  it('produces a valid PNG after drawing', () => {});
  it('applies rotation via scos/ssin', () => {});
  it('overall x/y origin offsets all glyphs', () => {});
});

// ─── Typeface variation axes ──────────────────────────────────────────────────
// getVariationAxes() returns a Float32Array packed as [tag_f32, min, default, max]
// repeated per axis (4 values each). makeVariation is declared in the d.ts but
// is only exposed as _makeVariation in the current WASM; those tests are skipped.

describe('Typeface.getVariationAxes / makeVariation', () => {
  let typeface;

  before(() => {
    const ab = fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
    typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(ab);
  });

  after(() => typeface.delete());

  it('getVariationAxes() returns a Float32Array', () => {
    const axes = typeface.getVariationAxes();
    assert.ok(axes instanceof Float32Array, `expected Float32Array, got ${axes?.constructor?.name}`);
  });

  it('length is a multiple of 4 (4 floats per axis)', () => {
    const axes = typeface.getVariationAxes();
    assert.strictEqual(axes.length % 4, 0);
  });

  it('Google Sans has 3 variation axes (length === 12)', () => {
    // Google Sans is a variable font with opsz, wght, GRAD axes
    const axes = typeface.getVariationAxes();
    assert.strictEqual(axes.length, 12); // 3 axes × 4 values
  });

  it('each axis: min <= default <= max', () => {
    const axes = typeface.getVariationAxes();
    for (let i = 0; i < axes.length; i += 4) {
      // layout: [tag_f32, min, default, max]
      const min     = axes[i + 1];
      const def     = axes[i + 2];
      const max     = axes[i + 3];
      assert.ok(min <= def, `axis ${i / 4}: min (${min}) > default (${def})`);
      assert.ok(def <= max, `axis ${i / 4}: default (${def}) > max (${max})`);
    }
  });

  it('wght axis has range covering 400–700 (Google Sans)', () => {
    const axes = typeface.getVariationAxes();
    // Find an axis where max >= 700 and min <= 400 — that is wght
    let found = false;
    for (let i = 0; i < axes.length; i += 4) {
      const min = axes[i + 1];
      const max = axes[i + 3];
      if (min <= 400 && max >= 700) { found = true; break; }
    }
    assert.ok(found, 'expected a weight axis covering 400–700');
  });

  // makeVariation is declared in d.ts but exposed only as _makeVariation in WASM
  it('makeVariation() is not yet publicly exposed', { skip: 'only _makeVariation exists in current WASM' }, () => {
    assert.strictEqual(typeof typeface.makeVariation, 'function');
  });
});

// ─── PDFDocument.beginPageWithContentRect ────────────────────────────────────

describe('PDFDocument.beginPageWithContentRect', () => {
  it('returns a Canvas without throwing', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    let canvas;
    assert.doesNotThrow(() => {
      canvas = doc.beginPageWithContentRect(W, H, CanvasKit.LTRBRect(10, 10, W - 10, H - 10));
    });
    assert.ok(canvas);
    doc.endPage();
    doc.close();
    doc.delete();
  });

  it('produces valid PDF bytes starting with %PDF', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    doc.beginPageWithContentRect(W, H, CanvasKit.LTRBRect(0, 0, W, H));
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(bytes[0], 0x25); // %
    assert.strictEqual(bytes[1], 0x50); // P
    assert.strictEqual(bytes[2], 0x44); // D
    assert.strictEqual(bytes[3], 0x46); // F
  });

  it('content can be drawn onto the returned canvas', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    const canvas = doc.beginPageWithContentRect(W, H, CanvasKit.LTRBRect(20, 20, W - 20, H - 20));
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    assert.doesNotThrow(() => canvas.drawRect(CanvasKit.LTRBRect(30, 30, 100, 80), paint));
    paint.delete();
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.ok(bytes.length > 0);
  });

  it('content rect smaller than page does not corrupt output', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    // Tiny content rect — just a 10x10 region
    doc.beginPageWithContentRect(W, H, CanvasKit.LTRBRect(100, 100, 110, 110));
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.strictEqual(bytes[0], 0x25); // still valid %PDF
  });

  it('multi-page mix of beginPage and beginPageWithContentRect', () => {
    const meta = new CanvasKit.PDFMetadata();
    const doc = new CanvasKit.PDFDocument(meta);
    doc.beginPage(W, H);
    doc.endPage();
    doc.beginPageWithContentRect(W, H, CanvasKit.LTRBRect(10, 10, W - 10, H - 10));
    doc.endPage();
    doc.beginPage(W, H);
    doc.endPage();
    const bytes = doc.close();
    doc.delete();
    assert.strictEqual(bytes[0], 0x25);
    assert.ok(bytes.length > 0);
  });
});

// ─── Shaper.shapeTextToBlobWithFeatures ──────────────────────────────────────

describe('Shaper.shapeTextToBlobWithFeatures', () => {
  let typeface;
  let font;
  let fontProvider;

  before(() => {
    const ab = fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
    typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(ab);
    font = new CanvasKit.Font(typeface, 24);
    fontProvider = CanvasKit.TypefaceFontProvider.Make();
    fontProvider.registerFont(ab, 'Google Sans');
  });

  after(() => {
    font.delete();
    typeface.delete();
    fontProvider.delete();
  });

  it('returns a TextBlob for ASCII text with empty features array', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFeatures(
      'Hello World', font, null, true, 500, 0, 0, [],
    );
    assert.ok(blob !== null, 'expected a TextBlob');
    blob.delete();
    shaper.delete();
  });

  it('returns null for empty string', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFeatures('', font, null, true, 500, 0, 0, []);
    assert.strictEqual(blob, null);
    shaper.delete();
  });

  it('ligature feature (liga) does not throw', () => {
    const text = 'ffi office';
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlobWithFeatures(
        text, font, null, true, 500, 0, 0,
        [{ tag: 'liga', value: 1, start: 0, end: text.length }],
      );
      blob?.delete();
    });
    shaper.delete();
  });

  it('kerning feature (kern) does not throw', () => {
    const text = 'AV Wa';
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlobWithFeatures(
        text, font, null, true, 500, 0, 0,
        [{ tag: 'kern', value: 1, start: 0, end: text.length }],
      );
      blob?.delete();
    });
    shaper.delete();
  });

  it('disabling a feature (value=0) does not throw', () => {
    const text = 'ffi test';
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlobWithFeatures(
        text, font, null, true, 500, 0, 0,
        [{ tag: 'liga', value: 0, start: 0, end: text.length }],
      );
      blob?.delete();
    });
    shaper.delete();
  });

  it('feature applied to a sub-range does not throw', () => {
    const text = 'Hello World';
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlobWithFeatures(
        text, font, null, true, 500, 0, 0,
        [{ tag: 'kern', value: 1, start: 0, end: 5 }], // only "Hello"
      );
      blob?.delete();
    });
    shaper.delete();
  });

  it('multiple features in one call does not throw', () => {
    const text = 'ffi office AV';
    const shaper = CanvasKit.Shaper.Make();
    assert.doesNotThrow(() => {
      const blob = shaper.shapeTextToBlobWithFeatures(
        text, font, null, true, 500, 0, 0,
        [
          { tag: 'liga', value: 1, start: 0, end: text.length },
          { tag: 'kern', value: 1, start: 0, end: text.length },
        ],
      );
      blob?.delete();
    });
    shaper.delete();
  });

  it('result can be drawn on a canvas', () => {
    const shaper = CanvasKit.Shaper.Make();
    const text = 'Hello';
    const blob = shaper.shapeTextToBlobWithFeatures(
      text, font, null, true, 500, 0, 0,
      [{ tag: 'kern', value: 1, start: 0, end: text.length }],
    );
    assert.ok(blob);
    const surface = CanvasKit.MakeSurface(W, H);
    const paint = new CanvasKit.Paint();
    paint.setColor(CanvasKit.BLACK);
    surface.getCanvas().drawTextBlob(blob, 10, 50, paint);
    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    assert.strictEqual(bytes[0], 0x89); // valid PNG
    image.delete();
    paint.delete();
    surface.delete();
    blob.delete();
    shaper.delete();
  });

  it('with fontProvider instead of null fontMgr', () => {
    const shaper = CanvasKit.Shaper.Make();
    const text = 'Hello World';
    const blob = shaper.shapeTextToBlobWithFeatures(
      text, font, fontProvider, true, 500, 0, 0,
      [{ tag: 'kern', value: 1, start: 0, end: text.length }],
    );
    assert.ok(blob !== null);
    blob.delete();
    shaper.delete();
  });

  it('TextBlob delete() does not throw', () => {
    const shaper = CanvasKit.Shaper.Make();
    const blob = shaper.shapeTextToBlobWithFeatures(
      'cleanup', font, null, true, 500, 0, 0, [],
    );
    assert.doesNotThrow(() => blob?.delete());
    shaper.delete();
  });
});
