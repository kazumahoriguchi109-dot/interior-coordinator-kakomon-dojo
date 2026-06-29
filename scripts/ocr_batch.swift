import Foundation
import ImageIO
import Vision

struct OCRLine: Codable {
    let text: String
    let minX: Double
    let minY: Double
    let maxX: Double
    let maxY: Double
    let confidence: Float
}

struct OCRPage: Codable {
    let imagePath: String
    let lines: [OCRLine]
}

func usage() -> Never {
    let message = "usage: swift ocr_batch.swift <image-path> [<image-path> ...]\n"
    FileHandle.standardError.write(Data(message.utf8))
    exit(64)
}

func ocrPage(at imagePath: String) throws -> OCRPage {
    guard
        let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: imagePath) as CFURL, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
    else {
        throw NSError(domain: "OCRBatch", code: 1, userInfo: [NSLocalizedDescriptionKey: "cannot load \(imagePath)"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ja-JP", "en-US"]
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.008

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let lines = (request.results ?? [])
        .compactMap { observation -> OCRLine? in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }
            let box = observation.boundingBox
            return OCRLine(
                text: candidate.string,
                minX: Double(box.minX),
                minY: Double(box.minY),
                maxX: Double(box.maxX),
                maxY: Double(box.maxY),
                confidence: candidate.confidence
            )
        }
        .sorted {
            if abs($0.maxY - $1.maxY) > 0.01 {
                return $0.maxY > $1.maxY
            }
            return $0.minX < $1.minX
        }

    return OCRPage(imagePath: imagePath, lines: lines)
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard !arguments.isEmpty else {
    usage()
}

var pages: [OCRPage] = []
pages.reserveCapacity(arguments.count)

for imagePath in arguments {
    let page = try ocrPage(at: imagePath)
    pages.append(page)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let output = try encoder.encode(pages)
FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))
