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

enum OCRToolError: Error {
    case usage
    case cannotLoadImage(String)
}

func usage() -> Never {
    FileHandle.standardError.write(Data("usage: swift ocr_image.swift <image-path>\n".utf8))
    exit(64)
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
    usage()
}

let imagePath = arguments[1]
guard
    let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: imagePath) as CFURL, nil),
    let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
else {
    throw OCRToolError.cannotLoadImage(imagePath)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["ja-JP", "en-US"]
request.usesLanguageCorrection = false
request.minimumTextHeight = 0.008

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

let observations = (request.results ?? [])
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

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let output = try encoder.encode(observations)
FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))
