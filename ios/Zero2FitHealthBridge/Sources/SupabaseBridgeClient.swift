import Foundation

final class SupabaseBridgeClient {
    static let shared = SupabaseBridgeClient()

    private let baseURL = URL(string: "https://guxdnxnqzhkidtastsfb.supabase.co")!
    private let publishableKey = "sb_publishable_pRhqHz4vEl0plyGuXx8Ztg_JfSxg57m"
    private let sessionAccount = "supabase-session-v1"
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private var cachedSession: SupabaseSession?

    private init() {
        encoder = JSONEncoder()
        decoder = JSONDecoder()
    }

    func restoreSession() async throws -> SupabaseSession? {
        if let cachedSession {
            return try await refreshIfNeeded(cachedSession)
        }
        guard let data = try KeychainStore.load(account: sessionAccount) else { return nil }
        let session = try decoder.decode(SupabaseSession.self, from: data)
        cachedSession = session
        return try await refreshIfNeeded(session)
    }

    @discardableResult
    func signUp(email: String, password: String) async throws -> Bool {
        let envelope: AuthEnvelope = try await authRequest(
            path: "/auth/v1/signup",
            body: Credentials(email: email, password: password)
        )
        if let session = envelope.session {
            try save(session)
            return true
        }
        return false
    }

    func signIn(email: String, password: String) async throws -> SupabaseSession {
        let envelope: AuthEnvelope = try await authRequest(
            path: "/auth/v1/token?grant_type=password",
            body: Credentials(email: email, password: password)
        )
        guard let session = envelope.session else {
            throw SupabaseBridgeError.missingSession
        }
        try save(session)
        return session
    }

    func signOut() async {
        if let session = try? await restoreSession() {
            var request = authorizedRequest(path: "/auth/v1/logout", method: "POST", accessToken: session.accessToken)
            request.httpBody = Data()
            _ = try? await URLSession.shared.data(for: request)
        }
        cachedSession = nil
        KeychainStore.delete(account: sessionAccount)
    }

    func upload(_ bundle: BridgeBundle) async throws -> (events: Int, observations: Int) {
        guard let session = try await restoreSession() else { throw SupabaseBridgeError.notSignedIn }
        try await uploadEvents(bundle.normalizedEvents, userId: session.user.id, accessToken: session.accessToken)
        try await uploadObservations(bundle.sourceObservations, userId: session.user.id, accessToken: session.accessToken)
        return (bundle.normalizedEvents.count, bundle.sourceObservations.count)
    }

    private func uploadEvents(_ events: [BridgeEvent], userId: String, accessToken: String) async throws {
        for chunk in events.chunked(into: 200) {
            let rows = chunk.map { event in
                RemoteEventRow(
                    userId: userId,
                    eventId: event.eventId,
                    metricType: event.metricType,
                    numericValue: event.value.numericValue,
                    textValue: event.value.textValue,
                    unit: event.unit,
                    observedAt: event.observedAt,
                    endAt: event.endAt,
                    sourceProvider: event.sourceProvider,
                    sourceDevice: event.sourceDevice,
                    sourceRecordId: event.sourceRecordId,
                    importedAt: event.importedAt,
                    provenanceStatus: event.provenanceStatus,
                    confidence: event.confidence,
                    metadata: event.metadata
                )
            }
            try await postREST(
                path: "/rest/v1/normalized_events?on_conflict=user_id,event_id",
                body: rows,
                accessToken: accessToken
            )
        }
    }

    private func uploadObservations(_ observations: [SourceObservation], userId: String, accessToken: String) async throws {
        guard !observations.isEmpty else { return }
        let rows = observations.map {
            RemoteSourceObservation(
                userId: userId,
                sourceBundleId: $0.sourceBundleId,
                sourceName: $0.sourceName,
                metricType: $0.metricType,
                sampleCount: $0.sampleCount,
                firstObservedAt: $0.firstObservedAt,
                lastObservedAt: $0.lastObservedAt,
                lastSyncAt: $0.lastSyncAt,
                metadata: $0.metadata
            )
        }
        try await postREST(
            path: "/rest/v1/device_source_observations?on_conflict=user_id,source_bundle_id,metric_type",
            body: rows,
            accessToken: accessToken
        )
    }

    private func refreshIfNeeded(_ session: SupabaseSession) async throws -> SupabaseSession {
        let expiry: Int
        if let expiresAt = session.expiresAt {
            expiry = expiresAt
        } else if let expiresIn = session.expiresIn {
            expiry = Int(Date().timeIntervalSince1970) + expiresIn
        } else {
            return session
        }

        guard expiry < Int(Date().timeIntervalSince1970) + 60 else { return session }
        guard let refreshToken = session.refreshToken else { throw SupabaseBridgeError.expiredSession }

        let envelope: AuthEnvelope = try await authRequest(
            path: "/auth/v1/token?grant_type=refresh_token",
            body: RefreshBody(refreshToken: refreshToken)
        )
        guard let refreshed = envelope.session else { throw SupabaseBridgeError.missingSession }
        try save(refreshed)
        return refreshed
    }

    private func save(_ session: SupabaseSession) throws {
        cachedSession = session
        try KeychainStore.save(try encoder.encode(session), account: sessionAccount)
    }

    private func authRequest<Body: Encodable, Response: Decodable>(path: String, body: Body) async throws -> Response {
        var request = URLRequest(url: URL(string: path, relativeTo: baseURL)!)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func postREST<Body: Encodable>(path: String, body: Body, accessToken: String) async throws {
        var request = authorizedRequest(path: path, method: "POST", accessToken: accessToken)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    private func authorizedRequest(path: String, method: String, accessToken: String) -> URLRequest {
        var request = URLRequest(url: URL(string: path, relativeTo: baseURL)!)
        request.httpMethod = method
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw SupabaseBridgeError.invalidResponse }
        guard 200..<300 ~= http.statusCode else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { ($0["message"] ?? $0["msg"] ?? $0["error_description"] ?? $0["error"]) as? String }
            throw SupabaseBridgeError.http(http.statusCode, message ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode))
        }
    }
}

private struct Credentials: Codable {
    let email: String
    let password: String
}

private struct RefreshBody: Codable {
    let refreshToken: String
    enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
}

private struct AuthEnvelope: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let expiresAt: Int?
    let expiresIn: Int?
    let user: SupabaseSession.User?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case expiresIn = "expires_in"
        case user
    }

    var session: SupabaseSession? {
        guard let accessToken, let user else { return nil }
        return SupabaseSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            expiresIn: expiresIn,
            user: user
        )
    }
}

private struct RemoteEventRow: Encodable {
    let userId: String
    let eventId: String
    let metricType: String
    let numericValue: Double?
    let textValue: String?
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

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case eventId = "event_id"
        case metricType = "metric_type"
        case numericValue = "numeric_value"
        case textValue = "text_value"
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

private struct RemoteSourceObservation: Encodable {
    let userId: String
    let sourceBundleId: String
    let sourceName: String?
    let metricType: String
    let sampleCount: Int
    let firstObservedAt: String?
    let lastObservedAt: String?
    let lastSyncAt: String
    let metadata: [String: String]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
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

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}

enum SupabaseBridgeError: LocalizedError {
    case notSignedIn
    case missingSession
    case expiredSession
    case invalidResponse
    case http(Int, String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to Zero2Fit private sync first."
        case .missingSession: return "Authentication succeeded without a usable session."
        case .expiredSession: return "The private-sync session expired and has no refresh token."
        case .invalidResponse: return "The private-sync server returned an invalid response."
        case .http(let status, let message): return "Private sync failed (\(status)): \(message)"
        }
    }
}
