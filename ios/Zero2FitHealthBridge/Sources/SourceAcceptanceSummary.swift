import Foundation

struct SourceMetricSnapshot: Identifiable, Equatable, Sendable {
    let metricType: String
    let label: String
    let sampleCount: Int
    let latestValue: BridgeScalar?
    let unit: String?
    let observedAt: String?

    var id: String { metricType }

    var valueText: String {
        guard let latestValue else { return "No recent value" }
        switch latestValue {
        case .number(let value):
            let digits = Self.fractionDigits(for: metricType)
            let formatted = value.formatted(.number.precision(.fractionLength(digits)))
            return unit.map { "\(formatted) \($0)" } ?? formatted
        case .text(let value):
            return Self.prettyValue(value)
        }
    }

    var detailText: String {
        var parts = ["\(sampleCount) sample\(sampleCount == 1 ? "" : "s")"]
        if let observedAt, let date = Self.date(from: observedAt) {
            parts.append("latest \(date.formatted(date: .abbreviated, time: .shortened))")
        }
        return parts.joined(separator: " · ")
    }

    static func fractionDigits(for metricType: String) -> Int {
        switch metricType {
        case "steps", "heart_rate", "resting_heart_rate", "active_energy", "exercise_time":
            return 0
        case "walking_running_distance":
            return 2
        case "weight", "body_fat_percentage", "bmi", "lean_body_mass", "hrv_sdnn", "spo2", "vo2_max":
            return 1
        default:
            return 1
        }
    }

    static func prettyValue(_ value: String) -> String {
        value
            .replacingOccurrences(of: "HKCategoryValueSleepAnalysis", with: "")
            .replacingOccurrences(of: "Asleep", with: "Asleep ")
            .replacingOccurrences(of: "InBed", with: "In bed")
            .replacingOccurrences(of: "Awake", with: "Awake")
            .replacingOccurrences(of: "Core", with: "Core")
            .replacingOccurrences(of: "Deep", with: "Deep")
            .replacingOccurrences(of: "REM", with: "REM")
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }
}

struct SourceBundleSummary: Identifiable, Equatable, Sendable {
    let sourceBundleId: String
    let sourceName: String?
    let totalSamples: Int
    let firstObservedAt: String?
    let lastObservedAt: String?
    let lastSyncAt: String?
    let metrics: [SourceMetricSnapshot]

    var id: String { sourceBundleId }
    var displayName: String { sourceName?.isEmpty == false ? sourceName! : "Unnamed HealthKit source" }

    var timingText: String {
        var parts: [String] = []
        if let lastObservedAt, let date = SourceMetricSnapshot.date(from: lastObservedAt) {
            parts.append("latest sample \(date.formatted(date: .abbreviated, time: .shortened))")
        }
        if let lastSyncAt, let date = SourceMetricSnapshot.date(from: lastSyncAt) {
            parts.append("captured \(date.formatted(date: .omitted, time: .shortened))")
        }
        return parts.joined(separator: " · ")
    }
}

enum SourceAcceptanceSummaryBuilder {
    private static let metricPriority: [String] = [
        "steps",
        "weight",
        "body_fat_percentage",
        "bmi",
        "lean_body_mass",
        "heart_rate",
        "resting_heart_rate",
        "hrv_sdnn",
        "sleep_stage",
        "workout_session",
        "active_energy",
        "exercise_time",
        "walking_running_distance",
        "spo2",
        "vo2_max"
    ]

    private static let labels: [String: String] = [
        "steps": "Steps",
        "weight": "Weight",
        "body_fat_percentage": "Body fat",
        "bmi": "BMI",
        "lean_body_mass": "Lean body mass",
        "heart_rate": "Heart rate",
        "resting_heart_rate": "Resting heart rate",
        "hrv_sdnn": "HRV (SDNN)",
        "sleep_stage": "Sleep / stage",
        "workout_session": "Workout",
        "active_energy": "Active energy",
        "exercise_time": "Exercise time",
        "walking_running_distance": "Walking/running distance",
        "spo2": "Blood oxygen",
        "vo2_max": "VO₂ max"
    ]

    static func build(events: [BridgeEvent], observations: [SourceObservation]) -> [SourceBundleSummary] {
        let eventsWithSource = events.filter { $0.metadata.sourceBundleId?.isEmpty == false }
        let groupedObservations = Dictionary(grouping: observations, by: \SourceObservation.sourceBundleId)
        let groupedEvents = Dictionary(grouping: eventsWithSource, by: { $0.metadata.sourceBundleId! })
        let bundleIds = Set(groupedObservations.keys).union(groupedEvents.keys)

        return bundleIds.map { bundleId in
            let sourceObservations = groupedObservations[bundleId] ?? []
            let sourceEvents = groupedEvents[bundleId] ?? []
            let sourceName = sourceObservations.compactMap(\.sourceName).first
                ?? sourceEvents.compactMap { $0.metadata.sourceName }.first
            let observationByMetric = Dictionary(grouping: sourceObservations, by: \SourceObservation.metricType)
            let eventsByMetric = Dictionary(grouping: sourceEvents, by: \BridgeEvent.metricType)
            let metrics = Set(observationByMetric.keys).union(eventsByMetric.keys)

            let metricSnapshots = metrics.map { metricType -> SourceMetricSnapshot in
                let metricObservations = observationByMetric[metricType] ?? []
                let metricEvents = eventsByMetric[metricType] ?? []
                let latest = metricEvents.max { $0.observedAt < $1.observedAt }
                return SourceMetricSnapshot(
                    metricType: metricType,
                    label: labels[metricType] ?? prettyMetric(metricType),
                    sampleCount: metricObservations.reduce(0) { $0 + $1.sampleCount },
                    latestValue: latest?.value,
                    unit: latest?.unit,
                    observedAt: latest?.observedAt ?? metricObservations.compactMap(\.lastObservedAt).max()
                )
            }.sorted { lhs, rhs in
                let li = metricPriority.firstIndex(of: lhs.metricType) ?? Int.max
                let ri = metricPriority.firstIndex(of: rhs.metricType) ?? Int.max
                if li != ri { return li < ri }
                return lhs.label.localizedCaseInsensitiveCompare(rhs.label) == .orderedAscending
            }

            return SourceBundleSummary(
                sourceBundleId: bundleId,
                sourceName: sourceName,
                totalSamples: sourceObservations.reduce(0) { $0 + $1.sampleCount },
                firstObservedAt: sourceObservations.compactMap(\.firstObservedAt).min(),
                lastObservedAt: sourceObservations.compactMap(\.lastObservedAt).max(),
                lastSyncAt: sourceObservations.map(\.lastSyncAt).max(),
                metrics: metricSnapshots
            )
        }.sorted { lhs, rhs in
            let nameOrder = lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName)
            if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
            return lhs.sourceBundleId < rhs.sourceBundleId
        }
    }

    private static func prettyMetric(_ metric: String) -> String {
        metric
            .split(separator: "_")
            .map { $0.capitalized }
            .joined(separator: " ")
    }
}
