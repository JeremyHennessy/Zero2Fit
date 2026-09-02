import Foundation
import SwiftUI
import UIKit

@MainActor
final class BridgeViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var status = "Private sync is not signed in."
    @Published var isSignedIn = false
    @Published var healthAuthorized = false
    @Published var isBusy = false
    @Published var eventCount = 0
    @Published var observations: [SourceObservation] = []
    @Published var sourceSummaries: [SourceBundleSummary] = []
    @Published var lastBackgroundSyncAt: Date?
    @Published var activationReadiness = ActivationReadinessBuilder.build(
        isSignedIn: false,
        healthAuthorized: false,
        localSourceBundleCount: 0,
        remoteStatus: nil,
        lastBackgroundSyncAt: nil
    )

    private let bridge = HealthKitBridge()
    private let client = SupabaseBridgeClient.shared
    private let lastBackgroundSyncKey = "zero2fit.healthbridge.lastBackgroundSyncAt"
    private var remoteActivationStatus: RemoteActivationStatus?

    func restore() async {
        if let date = UserDefaults.standard.object(forKey: lastBackgroundSyncKey) as? Date {
            lastBackgroundSyncAt = date
        }
        rebuildActivationReadiness()
        do {
            if let session = try await client.restoreSession() {
                isSignedIn = true
                email = session.user.email ?? email
                do {
                    try await refreshActivationStatusFromServer()
                    status = "Signed in to private sync. Activation status refreshed."
                } catch {
                    rebuildActivationReadiness()
                    status = "Signed in to private sync. Activation status refresh failed: \(error.localizedDescription)"
                }
            }
        } catch {
            status = error.localizedDescription
        }
    }

    func signUp() async {
        await run {
            let immediateSession = try await client.signUp(email: email, password: password)
            isSignedIn = immediateSession
            if immediateSession {
                try await refreshActivationStatusFromServer()
                status = "Private account created and signed in. Activation status refreshed."
            } else {
                rebuildActivationReadiness()
                status = "Account created. Check your email if confirmation is required, then sign in."
            }
        }
    }

    func signIn() async {
        await run {
            let session = try await client.signIn(email: email, password: password)
            isSignedIn = true
            email = session.user.email ?? email
            try await refreshActivationStatusFromServer()
            status = "Signed in. Authorize HealthKit, then sync."
        }
    }

    func signOut() async {
        isBusy = true
        await client.signOut()
        bridge.stopBackgroundObservation()
        isSignedIn = false
        remoteActivationStatus = nil
        rebuildActivationReadiness()
        isBusy = false
        status = "Signed out."
    }

    func authorizeHealthKit() async {
        await run {
            try await bridge.requestAuthorization()
            healthAuthorized = true
            rebuildActivationReadiness()
            try await bridge.startBackgroundObservation { [weak self] in
                await self?.backgroundSync()
            }
            status = "HealthKit authorized. Source bundle IDs will be captured without being auto-trusted."
        }
    }

    func captureAndSync(daysBack: Int = 30) async {
        await run {
            let bundle = try await bridge.capture(daysBack: daysBack)
            apply(bundle)
            if isSignedIn {
                let result = try await client.upload(bundle)
                try await refreshActivationStatusFromServer()
                status = "Synced \(result.events) events and \(result.observations) source observations. Use the web HealthKit evidence matrix before verifying Zepp or RENPHO."
            } else {
                status = "Captured \(bundle.normalizedEvents.count) events locally in memory. Sign in to upload them privately."
            }
        }
    }

    func refreshActivationStatus() async {
        await run {
            guard isSignedIn else { throw SupabaseBridgeError.notSignedIn }
            try await refreshActivationStatusFromServer()
            let readiness = activationReadiness
            status = readiness.isComplete
                ? "Activation readiness complete. Both exact source verifications and physical background delivery are detected."
                : "Activation readiness refreshed: \(readiness.completedCount) of \(readiness.totalCount) checkpoints complete."
        }
    }

    func copyBundleId(_ bundleId: String) {
        UIPasteboard.general.string = bundleId
        status = "Copied HealthKit bundle ID: \(bundleId)"
    }

    func copySourceSummary(_ summary: SourceBundleSummary) {
        let metricLines = summary.metrics.map { metric in
            "- \(metric.label): \(metric.valueText) (\(metric.detailText))"
        }.joined(separator: "\n")
        let text = """
        \(summary.displayName)
        Bundle: \(summary.sourceBundleId)
        Samples: \(summary.totalSamples)
        \(summary.timingText)
        \(metricLines)
        """
        UIPasteboard.general.string = text
        status = "Copied \(summary.displayName) source summary."
    }

    private func apply(_ bundle: BridgeBundle) {
        eventCount = bundle.normalizedEvents.count
        observations = bundle.sourceObservations
        sourceSummaries = SourceAcceptanceSummaryBuilder.build(
            events: bundle.normalizedEvents,
            observations: bundle.sourceObservations
        )
        rebuildActivationReadiness()
    }

    private func refreshActivationStatusFromServer() async throws {
        remoteActivationStatus = try await client.fetchActivationStatus()
        rebuildActivationReadiness()
    }

    private func rebuildActivationReadiness() {
        activationReadiness = ActivationReadinessBuilder.build(
            isSignedIn: isSignedIn,
            healthAuthorized: healthAuthorized,
            localSourceBundleCount: sourceSummaries.count,
            remoteStatus: remoteActivationStatus,
            lastBackgroundSyncAt: lastBackgroundSyncAt
        )
    }

    private func backgroundSync() async {
        guard isSignedIn, healthAuthorized, !isBusy else { return }
        do {
            let bundle = try await bridge.capture(daysBack: 3)
            _ = try await client.upload(bundle)
            apply(bundle)
            let completedAt = Date()
            lastBackgroundSyncAt = completedAt
            UserDefaults.standard.set(completedAt, forKey: lastBackgroundSyncKey)
            try? await refreshActivationStatusFromServer()
            rebuildActivationReadiness()
            status = "Background HealthKit update synced at \(completedAt.formatted(date: .omitted, time: .shortened))."
        } catch {
            status = "Background sync: \(error.localizedDescription)"
        }
    }

    private func run(_ operation: () async throws -> Void) async {
        guard !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            try await operation()
        } catch {
            status = error.localizedDescription
        }
    }
}
