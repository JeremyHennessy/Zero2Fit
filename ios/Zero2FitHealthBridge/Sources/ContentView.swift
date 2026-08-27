import SwiftUI

struct ContentView: View {
    @StateObject private var model = BridgeViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Private Zero2Fit account") {
                    TextField("Email", text: $model.email)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $model.password)
                        .textContentType(.password)
                    HStack {
                        Button("Create account") { Task { await model.signUp() } }
                            .disabled(model.isBusy || model.email.isEmpty || model.password.count < 6)
                        Spacer()
                        if model.isSignedIn {
                            Button("Sign out") { Task { await model.signOut() } }
                        } else {
                            Button("Sign in") { Task { await model.signIn() } }
                                .disabled(model.isBusy || model.email.isEmpty || model.password.isEmpty)
                        }
                    }
                }

                Section("HealthKit") {
                    Button(model.healthAuthorized ? "HealthKit authorized" : "Authorize HealthKit") {
                        Task { await model.authorizeHealthKit() }
                    }
                    .disabled(model.isBusy || model.healthAuthorized)

                    Button("Capture and sync last 30 days") {
                        Task { await model.captureAndSync(daysBack: 30) }
                    }
                    .disabled(model.isBusy || !model.healthAuthorized)

                    LabeledContent("Captured events", value: String(model.eventCount))
                    Text("Source names and bundle IDs are captured as evidence. They are never automatically trusted for Fitness XP.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Observed HealthKit sources") {
                    if model.observations.isEmpty {
                        Text("No source observations captured yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(model.observations) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.sourceName ?? "Unnamed source")
                                    .font(.headline)
                                Text(item.sourceBundleId)
                                    .font(.caption.monospaced())
                                    .textSelection(.enabled)
                                Text("\(item.metricType) · \(item.sampleCount) samples")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Status") {
                    Text(model.status)
                        .font(.footnote)
                }
            }
            .navigationTitle("Zero2Fit Bridge")
            .task { await model.restore() }
            .overlay {
                if model.isBusy {
                    ProgressView()
                        .padding()
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}
