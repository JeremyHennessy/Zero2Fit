import Foundation
import SwiftUI

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

    private let bridge = HealthKitBridge()
    private let client = SupabaseBridgeClient.shared

    func restore() async {
        do {
            if let session = try await client.restoreSession() {
                isSignedIn = true
                email = session.user.email ?? email
                status = "Signed in to private sync."
            }
        } catch {
            status = error.localizedDescription
        }
    }

    func signUp() async {
        await run {
            let immediateSession = try await client.signUp(email: email, password: password)
            isSignedIn = immediateSession
            status = immediateSession
                ? "Private account created and signed in."
                : "Account created. Check your email if confirmation is required, then sign in."
        }
    }

    func signIn() async {
        await run {
            let session = try await client.signIn(email: email, password: password)
            isSignedIn = true
            email = session.user.email ?? email
            status = "Signed in. Authorize HealthKit, then sync."
        }
    }

    func signOut() async {
        isBusy = true
        await client.signOut()
        bridge.stopBackgroundObservation()
        isSignedIn = false
        isBusy = false
        status = "Signed out."
    }

    func authorizeHealthKit() async {
        await run {
            try await bridge.requestAuthorization()
            healthAuthorized = true
            try await bridge.startBackgroundObservation { [weak self] in
                await self?.backgroundSync()
            }
            status = "HealthKit authorized. Source bundle IDs will be captured without being auto-trusted."
        }
    }

    func captureAndSync(daysBack: Int = 30) async {
        await run {
            let bundle = try await bridge.capture(daysBack: daysBack)
            eventCount = bundle.normalizedEvents.count
            observations = bundle.sourceObservations
            if isSignedIn {
                let result = try await client.upload(bundle)
                status = "Synced \(result.events) events and \(result.observations) source observations. Verify Zepp/RENPHO mappings in Zero2Fit before device XP is enabled."
            } else {
                status = "Captured \(bundle.normalizedEvents.count) events locally in memory. Sign in to upload them privately."
            }
        }
    }

    private func backgroundSync() async {
        guard isSignedIn, healthAuthorized, !isBusy else { return }
        do {
            let bundle = try await bridge.capture(daysBack: 3)
            _ = try await client.upload(bundle)
            eventCount = bundle.normalizedEvents.count
            observations = bundle.sourceObservations
            status = "Background HealthKit update synced at \(Date().formatted(date: .omitted, time: .shortened))."
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
