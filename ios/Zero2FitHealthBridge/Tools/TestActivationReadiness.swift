import Foundation

@main
struct TestActivationReadiness {
    static func main() {
        testEmptyState()
        testObservedState()
        testVerificationRequiresObservedBundle()
        testCompleteState()
        print("Build 033 activation readiness tests passed.")
    }

    private static func testEmptyState() {
        let snapshot = ActivationReadinessBuilder.build(
            isSignedIn: false,
            healthAuthorized: false,
            localSourceBundleCount: 0,
            remoteStatus: nil,
            lastBackgroundSyncAt: nil
        )
        precondition(snapshot.completedCount == 0)
        precondition(snapshot.totalCount == 6)
        precondition(snapshot.nextIncomplete?.id == .account)
        precondition(!snapshot.isComplete)
    }

    private static func testObservedState() {
        let remote = RemoteActivationStatus(
            observations: [observation(bundle: "com.example.zepp", metric: "steps")],
            verifications: []
        )
        let snapshot = ActivationReadinessBuilder.build(
            isSignedIn: true,
            healthAuthorized: false,
            localSourceBundleCount: 0,
            remoteStatus: remote,
            lastBackgroundSyncAt: nil
        )
        precondition(snapshot.completedCount == 3)
        precondition(snapshot.checkpoints.first(where: { $0.id == .healthKit })?.complete == true)
        precondition(snapshot.checkpoints.first(where: { $0.id == .observations })?.complete == true)
        precondition(snapshot.nextIncomplete?.id == .zeppVerification)
    }

    private static func testVerificationRequiresObservedBundle() {
        let remote = RemoteActivationStatus(
            observations: [observation(bundle: "com.example.actual", metric: "steps")],
            verifications: [verification(provider: "zepp", bundle: "com.example.stale")]
        )
        precondition(remote.verification(for: "zepp") == nil)
        let snapshot = ActivationReadinessBuilder.build(
            isSignedIn: true,
            healthAuthorized: true,
            localSourceBundleCount: 1,
            remoteStatus: remote,
            lastBackgroundSyncAt: Date()
        )
        precondition(snapshot.checkpoints.first(where: { $0.id == .zeppVerification })?.complete == false)
    }

    private static func testCompleteState() {
        let observations = [
            observation(bundle: "com.example.zepp", metric: "steps"),
            observation(bundle: "com.example.renpho", metric: "weight")
        ]
        let remote = RemoteActivationStatus(
            observations: observations,
            verifications: [
                verification(provider: "zepp", bundle: "com.example.zepp"),
                verification(provider: "renpho", bundle: "com.example.renpho")
            ]
        )
        let snapshot = ActivationReadinessBuilder.build(
            isSignedIn: true,
            healthAuthorized: true,
            localSourceBundleCount: 2,
            remoteStatus: remote,
            lastBackgroundSyncAt: Date()
        )
        precondition(snapshot.completedCount == 6)
        precondition(snapshot.isComplete)
        precondition(snapshot.nextIncomplete == nil)
    }

    private static func observation(bundle: String, metric: String) -> SourceObservation {
        SourceObservation(
            sourceBundleId: bundle,
            sourceName: nil,
            metricType: metric,
            sampleCount: 1,
            firstObservedAt: "2026-09-01T12:00:00Z",
            lastObservedAt: "2026-09-01T12:00:00Z",
            lastSyncAt: "2026-09-01T12:00:01Z",
            metadata: [:]
        )
    }

    private static func verification(provider: String, bundle: String) -> RemoteSourceVerification {
        RemoteSourceVerification(
            verificationId: UUID().uuidString,
            provider: provider,
            sourceBundleId: bundle,
            sourceName: nil,
            metricTypes: [],
            verifiedAt: "2026-09-01T12:30:00Z"
        )
    }
}
