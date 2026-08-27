import Foundation
import HealthKit

final class HealthKitBridge {
    private let healthStore = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []

    private struct QuantitySpec {
        let identifier: HKQuantityTypeIdentifier
        let metricType: String
        let unit: HKUnit
        let unitLabel: String
        let confidence: String
        let normalizePercent: Bool
    }

    private let quantitySpecs: [QuantitySpec] = [
        .init(identifier: .bodyMass, metricType: "weight", unit: .gramUnit(with: .kilo), unitLabel: "kg", confidence: "measured", normalizePercent: false),
        .init(identifier: .bodyFatPercentage, metricType: "body_fat_percentage", unit: .percent(), unitLabel: "%", confidence: "trend_estimate", normalizePercent: true),
        .init(identifier: .bodyMassIndex, metricType: "bmi", unit: .count(), unitLabel: "index", confidence: "derived", normalizePercent: false),
        .init(identifier: .leanBodyMass, metricType: "lean_body_mass", unit: .gramUnit(with: .kilo), unitLabel: "kg", confidence: "trend_estimate", normalizePercent: false),
        .init(identifier: .heartRate, metricType: "heart_rate", unit: .count().unitDivided(by: .minute()), unitLabel: "bpm", confidence: "measured", normalizePercent: false),
        .init(identifier: .restingHeartRate, metricType: "resting_heart_rate", unit: .count().unitDivided(by: .minute()), unitLabel: "bpm", confidence: "measured", normalizePercent: false),
        .init(identifier: .heartRateVariabilitySDNN, metricType: "hrv_sdnn", unit: .secondUnit(with: .milli), unitLabel: "ms", confidence: "measured", normalizePercent: false),
        .init(identifier: .oxygenSaturation, metricType: "spo2", unit: .percent(), unitLabel: "%", confidence: "measured", normalizePercent: true),
        .init(identifier: .activeEnergyBurned, metricType: "active_energy", unit: .kilocalorie(), unitLabel: "kcal", confidence: "measured", normalizePercent: false),
        .init(identifier: .distanceWalkingRunning, metricType: "walking_running_distance", unit: .meter(), unitLabel: "m", confidence: "measured", normalizePercent: false),
        .init(identifier: .appleExerciseTime, metricType: "exercise_time", unit: .minute(), unitLabel: "min", confidence: "measured", normalizePercent: false),
        .init(identifier: .vo2Max, metricType: "vo2_max", unit: HKUnit(from: "ml/kg*min"), unitLabel: "mL/kg/min", confidence: "estimated", normalizePercent: false)
    ]

    private var stepType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .stepCount)!
    }

    private var sleepType: HKCategoryType {
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    }

    private var workoutType: HKWorkoutType {
        HKObjectType.workoutType()
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw BridgeError.healthDataUnavailable
        }
        var readTypes = Set<HKObjectType>()
        readTypes.insert(stepType)
        readTypes.insert(sleepType)
        readTypes.insert(workoutType)
        for spec in quantitySpecs {
            if let type = HKObjectType.quantityType(forIdentifier: spec.identifier) {
                readTypes.insert(type)
            }
        }

        try await withCheckedThrowingContinuation { continuation in
            healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: BridgeError.authorizationNotGranted)
                }
            }
        }
    }

    func capture(daysBack: Int = 30) async throws -> BridgeBundle {
        let days = max(1, min(365, daysBack))
        let since = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date(timeIntervalSinceNow: -2_592_000)
        var events = try await queryDailySteps(since: since)

        for spec in quantitySpecs {
            events.append(contentsOf: try await queryQuantity(spec, since: since))
        }
        events.append(contentsOf: try await querySleep(since: since))
        events.append(contentsOf: try await queryWorkouts(since: since))
        events.sort { $0.observedAt < $1.observedAt }

        return BridgeBundle(
            sourceProvider: "healthkit_bridge",
            capturedAt: Self.iso(Date()),
            normalizedEvents: events,
            sourceObservations: Self.sourceObservations(from: events)
        )
    }

    func startBackgroundObservation(onChange: @escaping () async -> Void) async throws {
        stopBackgroundObservation()

        var sampleTypes: [HKSampleType] = [stepType, sleepType, workoutType]
        sampleTypes.append(contentsOf: quantitySpecs.compactMap { HKObjectType.quantityType(forIdentifier: $0.identifier) })

        for type in sampleTypes {
            try await enableBackgroundDelivery(for: type)
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                guard error == nil else {
                    completion()
                    return
                }
                Task {
                    await onChange()
                    completion()
                }
            }
            observerQueries.append(query)
            healthStore.execute(query)
        }
    }

    func stopBackgroundObservation() {
        for query in observerQueries {
            healthStore.stop(query)
        }
        observerQueries.removeAll()
    }

    private func enableBackgroundDelivery(for type: HKObjectType) async throws {
        try await withCheckedThrowingContinuation { continuation in
            healthStore.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: BridgeError.backgroundDeliveryNotEnabled)
                }
            }
        }
    }

    private func queryQuantity(_ spec: QuantitySpec, since: Date) async throws -> [BridgeEvent] {
        guard let type = HKObjectType.quantityType(forIdentifier: spec.identifier) else { return [] }
        let samples: [HKQuantitySample] = try await querySamples(type: type, since: since)
        let importedAt = Self.iso(Date())

        return samples.map { sample in
            var value = sample.quantity.doubleValue(for: spec.unit)
            if spec.normalizePercent, value >= 0, value <= 1 {
                value *= 100
            }
            let metadata = Self.metadata(sample: sample, originalUnit: spec.unitLabel)
            return BridgeEvent(
                eventId: "healthkit_bridge:\(sample.uuid.uuidString.lowercased())",
                metricType: spec.metricType,
                value: .number(value),
                unit: spec.unitLabel,
                observedAt: Self.iso(sample.startDate),
                endAt: sample.endDate > sample.startDate ? Self.iso(sample.endDate) : nil,
                sourceProvider: "healthkit_bridge",
                sourceDevice: Self.deviceLabel(sample.device),
                sourceRecordId: sample.uuid.uuidString.lowercased(),
                importedAt: importedAt,
                provenanceStatus: "observed",
                confidence: spec.confidence,
                metadata: metadata
            )
        }
    }

    private func queryDailySteps(since: Date) async throws -> [BridgeEvent] {
        let calendar = Calendar.current
        let anchor = calendar.startOfDay(for: since)
        let predicate = HKQuery.predicateForSamples(withStart: anchor, end: Date(), options: .strictStartDate)
        var interval = DateComponents()
        interval.day = 1

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: [.cumulativeSum, .separateBySource],
                anchorDate: anchor,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let collection else {
                    continuation.resume(returning: [])
                    return
                }
                var events: [BridgeEvent] = []
                let importedAt = Self.iso(Date())
                collection.enumerateStatistics(from: anchor, to: Date()) { statistics, _ in
                    let dateKey = Self.day(statistics.startDate)
                    for source in statistics.sources ?? [] {
                        guard let quantity = statistics.sumQuantity(for: source) else { continue }
                        let steps = quantity.doubleValue(for: .count())
                        guard steps >= 0 else { continue }
                        let sourceId = "steps:\(source.bundleIdentifier):\(dateKey)"
                        let metadata = BridgeMetadata(
                            sourceName: source.name,
                            sourceBundleId: source.bundleIdentifier,
                            sourceVersion: nil,
                            aggregation: "daily_total",
                            date: dateKey,
                            bridgeTransportVerified: true,
                            activityType: nil,
                            totalEnergyBurned: nil,
                            totalEnergyUnit: nil,
                            originalUnit: "count"
                        )
                        events.append(BridgeEvent(
                            eventId: "healthkit_bridge:\(sourceId)",
                            metricType: "steps",
                            value: .number(steps),
                            unit: "count",
                            observedAt: Self.iso(statistics.endDate),
                            endAt: nil,
                            sourceProvider: "healthkit_bridge",
                            sourceDevice: nil,
                            sourceRecordId: sourceId,
                            importedAt: importedAt,
                            provenanceStatus: "observed",
                            confidence: "measured",
                            metadata: metadata
                        ))
                    }
                }
                continuation.resume(returning: events)
            }
            healthStore.execute(query)
        }
    }

    private func querySleep(since: Date) async throws -> [BridgeEvent] {
        let samples: [HKCategorySample] = try await querySamples(type: sleepType, since: since)
        let importedAt = Self.iso(Date())
        return samples.map { sample in
            BridgeEvent(
                eventId: "healthkit_bridge:\(sample.uuid.uuidString.lowercased())",
                metricType: "sleep_stage",
                value: .text(Self.sleepValue(sample.value)),
                unit: "category",
                observedAt: Self.iso(sample.startDate),
                endAt: Self.iso(sample.endDate),
                sourceProvider: "healthkit_bridge",
                sourceDevice: Self.deviceLabel(sample.device),
                sourceRecordId: sample.uuid.uuidString.lowercased(),
                importedAt: importedAt,
                provenanceStatus: "observed",
                confidence: "measured",
                metadata: Self.metadata(sample: sample, originalUnit: "category")
            )
        }
    }

    private func queryWorkouts(since: Date) async throws -> [BridgeEvent] {
        let samples: [HKWorkout] = try await querySamples(type: workoutType, since: since)
        let importedAt = Self.iso(Date())
        return samples.map { workout in
            var metadata = Self.metadata(sample: workout, originalUnit: "min")
            metadata.activityType = Self.activityType(workout.workoutActivityType)
            if let energy = workout.totalEnergyBurned {
                metadata.totalEnergyBurned = energy.doubleValue(for: .kilocalorie())
                metadata.totalEnergyUnit = "kcal"
            }
            return BridgeEvent(
                eventId: "healthkit_bridge:\(workout.uuid.uuidString.lowercased())",
                metricType: "workout_session",
                value: .number(workout.duration / 60),
                unit: "min",
                observedAt: Self.iso(workout.startDate),
                endAt: Self.iso(workout.endDate),
                sourceProvider: "healthkit_bridge",
                sourceDevice: Self.deviceLabel(workout.device),
                sourceRecordId: workout.uuid.uuidString.lowercased(),
                importedAt: importedAt,
                provenanceStatus: "observed",
                confidence: "measured",
                metadata: metadata
            )
        }
    }

    private func querySamples<T: HKSample>(type: HKSampleType, since: Date) async throws -> [T] {
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (samples as? [T]) ?? [])
            }
            healthStore.execute(query)
        }
    }

    private static func metadata(sample: HKSample, originalUnit: String?) -> BridgeMetadata {
        BridgeMetadata(
            sourceName: sample.sourceRevision.source.name,
            sourceBundleId: sample.sourceRevision.source.bundleIdentifier,
            sourceVersion: sample.sourceRevision.version,
            aggregation: nil,
            date: nil,
            bridgeTransportVerified: true,
            activityType: nil,
            totalEnergyBurned: nil,
            totalEnergyUnit: nil,
            originalUnit: originalUnit
        )
    }

    private static func sourceObservations(from events: [BridgeEvent]) -> [SourceObservation] {
        struct Accumulator {
            var sourceName: String?
            var metricType: String
            var count: Int
            var first: String?
            var last: String?
        }

        var grouped: [String: Accumulator] = [:]
        for event in events {
            guard let bundle = event.metadata.sourceBundleId, !bundle.isEmpty else { continue }
            let key = "\(bundle)|\(event.metricType)"
            var current = grouped[key] ?? Accumulator(sourceName: event.metadata.sourceName, metricType: event.metricType, count: 0, first: nil, last: nil)
            current.count += 1
            current.sourceName = current.sourceName ?? event.metadata.sourceName
            current.first = [current.first, event.observedAt].compactMap { $0 }.min()
            current.last = [current.last, event.endAt ?? event.observedAt].compactMap { $0 }.max()
            grouped[key] = current
        }

        let now = iso(Date())
        return grouped.map { key, value in
            let bundle = String(key.split(separator: "|", maxSplits: 1).first ?? "")
            return SourceObservation(
                sourceBundleId: bundle,
                sourceName: value.sourceName,
                metricType: value.metricType,
                sampleCount: value.count,
                firstObservedAt: value.first,
                lastObservedAt: value.last,
                lastSyncAt: now,
                metadata: ["capture": "healthkit_bridge"]
            )
        }.sorted { ($0.sourceName ?? $0.sourceBundleId, $0.metricType) < ($1.sourceName ?? $1.sourceBundleId, $1.metricType) }
    }

    private static func sleepValue(_ raw: Int) -> String {
        if #available(iOS 16.0, *) {
            if raw == HKCategoryValueSleepAnalysis.asleepCore.rawValue { return "HKCategoryValueSleepAnalysisAsleepCore" }
            if raw == HKCategoryValueSleepAnalysis.asleepDeep.rawValue { return "HKCategoryValueSleepAnalysisAsleepDeep" }
            if raw == HKCategoryValueSleepAnalysis.asleepREM.rawValue { return "HKCategoryValueSleepAnalysisAsleepREM" }
        }
        if raw == HKCategoryValueSleepAnalysis.awake.rawValue { return "HKCategoryValueSleepAnalysisAwake" }
        if raw == HKCategoryValueSleepAnalysis.inBed.rawValue { return "HKCategoryValueSleepAnalysisInBed" }
        if raw == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue { return "HKCategoryValueSleepAnalysisAsleepUnspecified" }
        return "HKCategoryValueSleepAnalysisUnknown:\(raw)"
    }

    private static func activityType(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking: return "HKWorkoutActivityTypeWalking"
        case .running: return "HKWorkoutActivityTypeRunning"
        case .cycling: return "HKWorkoutActivityTypeCycling"
        case .functionalStrengthTraining: return "HKWorkoutActivityTypeFunctionalStrengthTraining"
        case .traditionalStrengthTraining: return "HKWorkoutActivityTypeTraditionalStrengthTraining"
        case .yoga: return "HKWorkoutActivityTypeYoga"
        case .rowing: return "HKWorkoutActivityTypeRowing"
        case .elliptical: return "HKWorkoutActivityTypeElliptical"
        case .hiking: return "HKWorkoutActivityTypeHiking"
        case .swimming: return "HKWorkoutActivityTypeSwimming"
        case .highIntensityIntervalTraining: return "HKWorkoutActivityTypeHighIntensityIntervalTraining"
        case .coreTraining: return "HKWorkoutActivityTypeCoreTraining"
        default: return "HKWorkoutActivityType\(type.rawValue)"
        }
    }

    private static func deviceLabel(_ device: HKDevice?) -> String? {
        [device?.name, device?.model, device?.manufacturer].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ").nilIfEmpty
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static func iso(_ date: Date) -> String {
        isoFormatter.string(from: date)
    }

    private static func day(_ date: Date) -> String {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

enum BridgeError: LocalizedError {
    case healthDataUnavailable
    case authorizationNotGranted
    case backgroundDeliveryNotEnabled

    var errorDescription: String? {
        switch self {
        case .healthDataUnavailable: return "Health data is not available on this device."
        case .authorizationNotGranted: return "HealthKit read authorization was not granted."
        case .backgroundDeliveryNotEnabled: return "HealthKit background delivery could not be enabled."
        }
    }
}
