import Foundation

@main
struct TestSourceAcceptanceSummary {
    static func main() {
        let observations = [
            SourceObservation(
                sourceBundleId: "com.example.zepp",
                sourceName: "Zepp",
                metricType: "steps",
                sampleCount: 2,
                firstObservedAt: "2026-09-01T10:00:00Z",
                lastObservedAt: "2026-09-01T11:00:00Z",
                lastSyncAt: "2026-09-01T11:05:00Z",
                metadata: [:]
            ),
            SourceObservation(
                sourceBundleId: "com.example.zepp",
                sourceName: "Zepp",
                metricType: "heart_rate",
                sampleCount: 1,
                firstObservedAt: "2026-09-01T10:30:00Z",
                lastObservedAt: "2026-09-01T10:30:00Z",
                lastSyncAt: "2026-09-01T11:05:00Z",
                metadata: [:]
            ),
            SourceObservation(
                sourceBundleId: "com.example.renpho",
                sourceName: "RENPHO Health",
                metricType: "weight",
                sampleCount: 1,
                firstObservedAt: "2026-09-01T09:00:00Z",
                lastObservedAt: "2026-09-01T09:00:00Z",
                lastSyncAt: "2026-09-01T11:05:00Z",
                metadata: [:]
            )
        ]

        let events = [
            event(id: "step-old", metric: "steps", value: .number(100), unit: "count", at: "2026-09-01T10:00:00Z", bundle: "com.example.zepp", name: "Zepp"),
            event(id: "step-new", metric: "steps", value: .number(250), unit: "count", at: "2026-09-01T11:00:00Z", bundle: "com.example.zepp", name: "Zepp"),
            event(id: "hr", metric: "heart_rate", value: .number(72), unit: "bpm", at: "2026-09-01T10:30:00Z", bundle: "com.example.zepp", name: "Zepp"),
            event(id: "weight", metric: "weight", value: .number(100.5), unit: "kg", at: "2026-09-01T09:00:00Z", bundle: "com.example.renpho", name: "RENPHO Health")
        ]

        let summaries = SourceAcceptanceSummaryBuilder.build(events: events, observations: observations)
        require(summaries.count == 2, "Expected two grouped bundles")

        let zepp = requireValue(summaries.first { $0.sourceBundleId == "com.example.zepp" }, "Missing Zepp summary")
        require(zepp.displayName == "Zepp", "Expected Zepp source name")
        require(zepp.totalSamples == 3, "Expected aggregated Zepp sample count")
        require(zepp.metrics.map(\.metricType) == ["steps", "heart_rate"], "Expected metric priority ordering")
        let steps = requireValue(zepp.metrics.first { $0.metricType == "steps" }, "Missing steps metric")
        require(steps.latestValue == .number(250), "Expected latest steps value")
        require(steps.sampleCount == 2, "Expected observation sample count")
        require(steps.valueText.contains("250"), "Expected formatted latest steps value")

        let renpho = requireValue(summaries.first { $0.sourceBundleId == "com.example.renpho" }, "Missing RENPHO summary")
        require(renpho.metrics.first?.metricType == "weight", "Expected weight metric")
        require(renpho.metrics.first?.valueText.contains("100.5") == true, "Expected latest weight value")

        let eventsOnly = SourceAcceptanceSummaryBuilder.build(
            events: [event(id: "sleep", metric: "sleep_stage", value: .text("HKCategoryValueSleepAnalysisAsleepDeep"), unit: "stage", at: "2026-09-01T05:00:00Z", bundle: "com.example.sleep", name: "Sleep App")],
            observations: []
        )
        require(eventsOnly.count == 1, "Events-only source should still be summarized")
        require(eventsOnly[0].metrics[0].valueText.localizedCaseInsensitiveContains("deep"), "Expected readable text value")

        print("Build 030 native source acceptance summary tests passed.")
    }

    private static func event(id: String, metric: String, value: BridgeScalar, unit: String, at: String, bundle: String, name: String) -> BridgeEvent {
        BridgeEvent(
            eventId: id,
            metricType: metric,
            value: value,
            unit: unit,
            observedAt: at,
            endAt: nil,
            sourceProvider: "healthkit_bridge",
            sourceDevice: nil,
            sourceRecordId: id,
            importedAt: at,
            provenanceStatus: "observed",
            confidence: "measured",
            metadata: BridgeMetadata(
                sourceName: name,
                sourceBundleId: bundle,
                sourceVersion: nil,
                aggregation: nil,
                date: nil,
                bridgeTransportVerified: true,
                activityType: nil,
                totalEnergyBurned: nil,
                totalEnergyUnit: nil,
                originalUnit: nil
            )
        )
    }

    private static func require(_ condition: @autoclosure () -> Bool, _ message: String) {
        if !condition() { fatalError(message) }
    }

    private static func requireValue<T>(_ value: T?, _ message: String) -> T {
        guard let value else { fatalError(message) }
        return value
    }
}
