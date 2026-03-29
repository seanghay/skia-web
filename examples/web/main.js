import { create } from 'skia'

const WIDTH = 800
const HEIGHT = 600

const status = document.getElementById('status')
const htmlCanvas = document.getElementById('canvas')
const btnPdf = document.getElementById('btn-pdf')
const btnSvg = document.getElementById('btn-svg')

status.textContent = 'Loading WebAssembly...'
const CanvasKit = await create()

status.textContent = 'Loading font...'
const fontData = await fetch('./GoogleSans.ttf').then(r => r.arrayBuffer())
const fontMgr = CanvasKit.FontMgr.FromData(fontData)

status.textContent = 'Rendering...'
const t0 = performance.now()

// --- RECORDING PHASE ---
const recorder = new CanvasKit.PictureRecorder()
const canvas = recorder.beginRecording(CanvasKit.LTRBRect(0, 0, WIDTH, HEIGHT))

canvas.drawColor(CanvasKit.WHITE)

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

// Divider
const linePaint = new CanvasKit.Paint()
linePaint.setColor(CanvasKit.Color(200, 200, 220, 255))
linePaint.setStrokeWidth(1.5)
canvas.drawLine(40, 175, WIDTH - 40, 175, linePaint)

// Body — mixed English + Khmer
const bodyStyle = new CanvasKit.ParagraphStyle({
  textStyle: {
    color: CanvasKit.Color(50, 50, 50, 255),
    fontSize: 20,
    fontFamilies: ['Google Sans'],
  },
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

// --- RENDER TO HTML CANVAS ---
const surface = CanvasKit.MakeSurface(WIDTH, HEIGHT)
const skCanvas = surface.getCanvas()
skCanvas.drawPicture(picture)
const image = surface.makeImageSnapshot()
const pngBytes = image.encodeToBytes()

const ctx = htmlCanvas.getContext('2d')
const blob = new Blob([pngBytes], { type: 'image/png' })
const url = URL.createObjectURL(blob)
const img = new Image()
img.onload = () => {
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  const ms = (performance.now() - t0).toFixed(1)
  status.textContent = `Done in ${ms}ms`
}
img.src = url

// --- PDF DOWNLOAD ---
btnPdf.disabled = false
btnPdf.addEventListener('click', () => {
  const pdfMeta = new CanvasKit.PDFMetadata()
  const pdfDoc = new CanvasKit.PDFDocument(pdfMeta)
  const pdfCanvas = pdfDoc.beginPage(WIDTH, HEIGHT)
  pdfCanvas.drawPicture(picture)
  pdfDoc.endPage()
  const pdfBytes = pdfDoc.close()
  download('output.pdf', pdfBytes, 'application/pdf')
  pdfMeta.delete()
})

// --- SVG DOWNLOAD ---
btnSvg.disabled = false
btnSvg.addEventListener('click', () => {
  const svg = new CanvasKit.SVGCanvas(WIDTH, HEIGHT, 1)
  const svgCanvas = svg.getCanvas()
  svgCanvas.drawPicture(picture)
  const svgBytes = svg.close()
  download('output.svg', svgBytes, 'image/svg+xml')
})

function download(filename, bytes, mime) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
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
image.delete()
surface.delete()
// picture kept alive for download buttons
