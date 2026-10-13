// Génère l'icône iOS sans dépendance npm. Requiert macOS et Xcode.
// La transparence éventuelle de l'icône source est aplatie sur la couleur Wimm.
import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift create-ios-icon.swift SOURCE.png DESTINATION.png\n", stderr)
  exit(2)
}
let source = CommandLine.arguments[1]
let destination = CommandLine.arguments[2]
guard let icon = NSImage(contentsOfFile: source) else {
  fputs("Impossible de lire l'image Wimm : \(source)\n", stderr)
  exit(1)
}

let side = 1024
guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: side,
  pixelsHigh: side,
  bitsPerSample: 8,
  samplesPerPixel: 3,
  hasAlpha: false,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bitmapFormat: [],
  bytesPerRow: 0,
  bitsPerPixel: 0
), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("Impossible de créer le bitmap de l'icône.\n", stderr)
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphics
graphics.imageInterpolation = .high
graphics.shouldAntialias = true
NSColor(calibratedRed: 32.0 / 255.0, green: 35.0 / 255.0, blue: 49.0 / 255.0, alpha: 1.0).setFill()
let rect = NSRect(x: 0, y: 0, width: side, height: side)
rect.fill()
icon.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1.0,
          respectFlipped: false, hints: nil)
graphics.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("La conversion en PNG a échoué.\n", stderr)
  exit(1)
}
do {
  try png.write(to: URL(fileURLWithPath: destination), options: .atomic)
  print("Icône iOS générée en 1024 × 1024 pixels : \(destination)")
} catch {
  fputs("Impossible d'écrire l'icône : \(error)\n", stderr)
  exit(1)
}
