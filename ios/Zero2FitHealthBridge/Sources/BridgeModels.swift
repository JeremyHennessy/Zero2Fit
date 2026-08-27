import Foundation

enum BridgeScalar: Codable, Sendable, Equatable {
    case number(Double)
    case text(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else {
            self = .text(try container.decode(String.self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let value): try container.encode(value)
        case .text(let value): try container.encode(value)
        }
    }

    var numericValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var textValue: String? {
        if case .text(let value) = self { return value }
        return nil
    }
}

struct BridgeMetadata: Codable, Sendable, Equatable {
    var sourceName: String?
    var sourceBundleId: String?
    var sourceVersion: String?
    var aggregation: String?
    var date: String?
    var bridgeTransportVerified: Bool = true
    var activityType: String?
    var totalEnergyBurned: Double?
    var totalEnergyUnit: String?
    var originalUnit: String?

    enum CodingKeys: String, CodingKey {
        case sourceName = "source_name"
        case sourceBundleId = "source_bundle_id"
        case sourceVersion = "source_version"
        case aggregation
        case date
        case bridgeTransportVerified = "bridge_transport_verified"
        case activityType = "activity_type"
        case totalEnergyBurned = "total_energy_burned"
        case totalEnergyUnit = "total_energy_unit"
        case originalUnit = "original_unit"
    }
}

struct BridgeEvent: Codable, Sendable, Identifiable, Equatable {
    let eventId: String
    let metricType: String
    let value: BridgeScalar
    let unit: String
    let observedAt: String
    let endAt: String?
    let sourceProvider: String
    let sourceDevice: String?
    let sourceRecordId: String?
    let importedAt: String
    let provenanceStatus: String
    let confidence: String
    let metadata: BridgeMetadata

    var id: String { eventId }

    enum CodingKeys: String, CodingKey {
        case eventId = "event_id"
        case metricType = "metric_type"
        case value
        case unit
        case observedAt = "observed_at"
        case endAt = "end_at"
        case sourceProvider = "source_provider"
        case sourceDevice = "source_device"
        case sourceRecordId = "source_record_id"
        case importedAt = "imported_at"
        case provenanceStatus = "provenance_status"
        case confidence
        case metadata
    }
}

struct SourceObservation: Codable, Sendable, Identifiable, Equatable {
    let sourceBundleId: String
    let sourceName: String?
    let metricType: String
    let sampleCount: Int
    let firstObservedAt: String?
    let lastObservedAt: String?
    let lastSyncAt: String
    let metadata: [String: String]

    var id: String { "\(sourceBundleId)|\(metricType)" }

    enum CodingKeys: String, CodingKey {
        case sourceBundleId = "source_bundle_id"
        case sourceName = "source_name"
        case metricType = "metric_type"
        case sampleCount = "sample_count"
        case firstObservedAt = "first_observed_at"
        case lastObservedAt = "last_observed_at"
        case lastSyncAt = "last_sync_at"
        case metadata
    }
}

struct BridgeBundle: Codable, Sendable {
    let sourceProvider: String
    let capturedAt: String
    let normalizedEvents: [BridgeEvent]
    let sourceObservations: [SourceObservation]

    enum CodingKeys: String, CodingKey {
        case sourceProvider = "source_provider"
        case capturedAt = "captured_at"
        case normalizedEvents = "normalized_events"
        case sourceObservations = "source_observations"
    }
}

struct SupabaseSession: Codable, Sendable {
    struct User: Codable, Sendable {
        let id: String
        let email: String?
    }

    let accessToken: String
    let refreshToken: String?
    let expiresAt: Int?
    let expiresIn: Int?
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case expiresIn = "expires_in"
        case user
    }
}
