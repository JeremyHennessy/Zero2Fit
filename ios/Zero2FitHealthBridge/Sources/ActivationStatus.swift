import Foundation

struct RemoteSourceVerification: Codable, Sendable, Identifiable, Equatable {
    let verificationId: String
    let provider: String
    let sourceBundleId: String
    let sourceName: String?
    let metricTypes: [String]
    let verifiedAt: String

    var id: String { verificationId }

    enum CodingKeys: String, CodingKey {
        case verificationId = "verification_id"
        case provider
        case sourceBundleId = "source_bundle_id"
        case sourceName = "source_name"
        case metricTypes = "metric_types"
        case verifiedAt = "verified_at"
    }
}

struct RemoteActivationStatus: Sendable, Equatable {
    let observations: [SourceObservation]
    let verifications: [RemoteSourceVerification]

    var observedBundleIds: Set<String> {
        Set(observations.map(\.sourceBundleId))
    }

    var observedBundleCount: Int { observedBundleIds.count }

    func verification(for provider: String) -> RemoteSourceVerification? {
        verifications
            .filter { $0.provider == provider && observedBundleIds.contains($0.sourceBundleId) }
            .sorted { $0.verifiedAt > $1.verifiedAt }
            .first
    }
}

enum ActivationCheckpointID: String, Sendable, CaseIterable {
    case account
    case healthKit
    case observations
    case zeppVerification
    case renphoVerification
    case backgroundDelivery
}

struct ActivationCheckpoint: Identifiable, Sendable, Equatable {
    let id: ActivationCheckpointID
    let label: String
    let detail: String
    let complete: Bool
}

struct ActivationReadinessSnapshot: Sendable, Equatable {
    let checkpoints: [ActivationCheckpoint]

    var completedCount: Int { checkpoints.filter(\.complete).count }
    var totalCount: Int { checkpoints.count }
    var isComplete: Bool { !checkpoints.isEmpty && completedCount == totalCount }
    var nextIncomplete: ActivationCheckpoint? { checkpoints.first { !$0.complete } }
}

enum ActivationReadinessBuilder {
    static func build(
        isSignedIn: Bool,
        healthAuthorized: Bool,
        localSourceBundleCount: Int,
        remoteStatus: RemoteActivationStatus?,
        lastBackgroundSyncAt: Date?
    ) -> ActivationReadinessSnapshot {
        let remoteBundleCount = remoteStatus?.observedBundleCount ?? 0
        let sourceEvidenceExists = localSourceBundleCount > 0 || remoteBundleCount > 0
        let healthKitExercised = healthAuthorized || sourceEvidenceExists
        let zepp = remoteStatus?.verification(for: "zepp")
        let renpho = remoteStatus?.verification(for: "renpho")

        let checkpoints = [
            ActivationCheckpoint(
                id: .account,
                label: "Private account",
                detail: isSignedIn ? "Authenticated private session is active." : "Create or sign in to the real Zero2Fit private account.",
                complete: isSignedIn
            ),
            ActivationCheckpoint(
                id: .healthKit,
                label: "HealthKit access",
                detail: healthKitExercised ? "HealthKit access has produced or authorized source data." : "Authorize HealthKit on this physical iPhone.",
                complete: healthKitExercised
            ),
            ActivationCheckpoint(
                id: .observations,
                label: "Private source observations",
                detail: remoteBundleCount > 0
                    ? "\(remoteBundleCount) exact HealthKit source bundle\(remoteBundleCount == 1 ? "" : "s") visible in the private store."
                    : "Capture and sync source bundles to the private store.",
                complete: remoteBundleCount > 0
            ),
            ActivationCheckpoint(
                id: .zeppVerification,
                label: "Zepp exact-source verification",
                detail: verificationDetail(zepp, pending: "Complete Build 028 for the observed Zepp bundle, then verify it separately in the web app."),
                complete: zepp != nil
            ),
            ActivationCheckpoint(
                id: .renphoVerification,
                label: "RENPHO exact-source verification",
                detail: verificationDetail(renpho, pending: "Complete Build 028 for the observed RENPHO bundle, then verify it separately in the web app."),
                complete: renpho != nil
            ),
            ActivationCheckpoint(
                id: .backgroundDelivery,
                label: "Physical background delivery",
                detail: lastBackgroundSyncAt.map { "Successful observer-triggered private sync: \($0.formatted(date: .abbreviated, time: .shortened))." }
                    ?? "Leave the companion installed and confirm a real observer-triggered background sync.",
                complete: lastBackgroundSyncAt != nil
            )
        ]

        return ActivationReadinessSnapshot(checkpoints: checkpoints)
    }

    private static func verificationDetail(_ verification: RemoteSourceVerification?, pending: String) -> String {
        guard let verification else { return pending }
        let shortBundle = verification.sourceBundleId.count > 34
            ? "\(verification.sourceBundleId.prefix(31))…"
            : verification.sourceBundleId
        return "Private verification detected for \(shortBundle). The companion did not create it."
    }
}
