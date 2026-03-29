import fs from 'node:fs/promises'
import { create } from 'skia'

const CanvasKit = await create()

const WIDTH = 800
const HEIGHT = 600

const fontData = await fs.readFile('./GoogleSans.ttf')
const fontMgr = CanvasKit.FontMgr.FromData(fontData)

// --- RECORDING PHASE ---
const recorder = new CanvasKit.PictureRecorder()
const canvas = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, WIDTH, HEIGHT))

canvas.drawColor(CanvasKit.WHITE)

// Background rect
const bgPaint = new CanvasKit.Paint()
bgPaint.setColor(CanvasKit.Color(245, 245, 250, 255))
bgPaint.setStyle(CanvasKit.PaintStyle.Fill)
canvas.drawRect(CanvasKit.LTRBRect(0, 0, WIDTH, HEIGHT), bgPaint)

// Heading — English
const headingStyle = new CanvasKit.ParagraphStyle({
  textStyle: {
    color: CanvasKit.Color(30, 30, 30, 255),
    fontSize: 36,
    fontFamilies: ['Google Sans'],
    fontStyle: { weight: CanvasKit.FontWeight.Bold },
  },
})
const headingBuilder = CanvasKit.ParagraphBuilder.Make(headingStyle, fontMgr)
headingBuilder.addText('Skia WebAssembly Demo')
const heading = headingBuilder.build()
heading.layout(WIDTH - 80)
canvas.drawParagraph(heading, 40, 40)

// Subheading — Khmer
const subStyle = new CanvasKit.ParagraphStyle({
  textStyle: {
    color: CanvasKit.Color(80, 80, 180, 255),
    fontSize: 28,
    fontFamilies: ['Google Sans'],
  },
})
const subBuilder = CanvasKit.ParagraphBuilder.Make(subStyle, fontMgr)
subBuilder.addText('បង្ហាញអក្សរខ្មែរ និងអក្សរអង់គ្លេស')
const sub = subBuilder.build()
sub.layout(WIDTH - 80)
canvas.drawParagraph(sub, 40, 110)

// Divider line
const linePaint = new CanvasKit.Paint()
linePaint.setColor(CanvasKit.Color(200, 200, 220, 255))
linePaint.setStrokeWidth(1.5)
canvas.drawLine(40, 175, WIDTH - 40, 175, linePaint)

// Body — mixed English and Khmer
const bodyStyle = new CanvasKit.ParagraphStyle({
  textStyle: {
    color: CanvasKit.Color(50, 50, 50, 255),
    fontSize: 20,
    fontFamilies: ['Google Sans'],
  },
  textAlign: CanvasKit.TextAlign.Left,
})
const bodyBuilder = CanvasKit.ParagraphBuilder.Make(bodyStyle, fontMgr)
bodyBuilder.addText('This example draws text using ')
bodyBuilder.pushStyle(new CanvasKit.TextStyle({
  color: CanvasKit.Color(200, 50, 50, 255),
  fontSize: 20,
  fontFamilies: ['Google Sans'],
  fontStyle: { weight: CanvasKit.FontWeight.Bold },
}))
bodyBuilder.addText('Google Sans')
bodyBuilder.pop()
bodyBuilder.addText(' font.\n\n')
bodyBuilder.addText('ឯកសារនេះបង្ហាញពីការប្រើប្រាស់ ')
bodyBuilder.pushStyle(new CanvasKit.TextStyle({
  color: CanvasKit.Color(30, 100, 200, 255),
  fontSize: 20,
  fontFamilies: ['Google Sans'],
}))
bodyBuilder.addText('Skia Graphics Library')
bodyBuilder.pop()
bodyBuilder.addText(' ជាមួយ WebAssembly\nដើម្បីបង្ហាញអក្សរខ្មែរ និងបន្ទាត់ក្រាហ្វិក។')
const body = bodyBuilder.build()
body.layout(WIDTH - 80)
canvas.drawParagraph(body, 40, 200)

// Decorative shapes
const redPaint = new CanvasKit.Paint()
redPaint.setColor(CanvasKit.Color(220, 50, 50, 200))
redPaint.setStyle(CanvasKit.PaintStyle.Fill)
redPaint.setAntiAlias(true)
canvas.drawCircle(100, 490, 50, redPaint)

const bluePaint = new CanvasKit.Paint()
bluePaint.setColor(CanvasKit.Color(30, 100, 220, 200))
bluePaint.setStyle(CanvasKit.PaintStyle.Fill)
bluePaint.setAntiAlias(true)
canvas.drawRect(CanvasKit.LTRBRect(200, 445, 380, 540), bluePaint)

const greenPaint = new CanvasKit.Paint()
greenPaint.setColor(CanvasKit.Color(40, 180, 80, 200))
greenPaint.setStyle(CanvasKit.PaintStyle.Fill)
greenPaint.setAntiAlias(true)
canvas.drawRRect(CanvasKit.RRectXY(CanvasKit.LTRBRect(430, 445, 620, 540), 20, 20), greenPaint)

const picture = recorder.finishRecordingAsPicture()

// --- EXPORT: PDF ---
const pdfMeta = new CanvasKit.PDFMetadata()
const pdfDoc = new CanvasKit.PDFDocument(pdfMeta)
const pdfCanvas = pdfDoc.beginPage(WIDTH, HEIGHT)
pdfCanvas.drawPicture(picture)
pdfDoc.endPage()
const pdfBytes = pdfDoc.close()
await fs.writeFile('output.pdf', pdfBytes)

// --- EXPORT: SVG ---
const svg = new CanvasKit.SVGCanvas(WIDTH, HEIGHT, 1)
const svgCanvas = svg.getCanvas()
svgCanvas.drawPicture(picture)
const svgBytes = svg.close()
await fs.writeFile('output.svg', svgBytes)

// --- EXPORT: PNG ---
const surface = CanvasKit.MakeSurface(WIDTH, HEIGHT)
const pngCanvas = surface.getCanvas()
pngCanvas.drawPicture(picture)
const image = surface.makeImageSnapshot()
const pngBytes = image.encodeToBytes()
if (pngBytes) {
  await fs.writeFile('output.png', pngBytes)
}

// Cleanup
heading.delete()
headingBuilder.delete()
sub.delete()
subBuilder.delete()
body.delete()
bodyBuilder.delete()
bgPaint.delete()
linePaint.delete()
redPaint.delete()
bluePaint.delete()
greenPaint.delete()
fontMgr.delete()
picture.delete()
recorder.delete()
image.delete()
surface.delete()

console.log('Exported output.pdf, output.svg, output.png')
