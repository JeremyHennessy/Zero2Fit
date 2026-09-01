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

                Section("HealthKit capture") {
                    Button(model.healthAuthorized ? "HealthKit authorized" : "Authorize HealthKit") {
                        Task { await model.authorizeHealthKit() }
                    }
                    .disabled(model.isBusy || model.healthAuthorized)

                    Button("Capture + sync last 24 hours") {
                        Task { await model.captureAndSync(daysBack: 1) }
                    }
                    .disabled(model.isBusy || !model.healthAuthorized)

                    Button("Capture + sync last 30 days") {
                        Task { await model.captureAndSync(daysBack: 30) }
                    }
                    .disabled(model.isBusy || !model.healthAuthorized)

                    LabeledContent("Captured events", value: String(model.eventCount))
                    LabeledContent(
                        "Last background delivery",
                        value: model.lastBackgroundSyncAt?.formatted(date: .abbreviated, time: .shortened) ?? "Not observed yet"
                    )

                    Text("Use 24 hours for a quick physical parity check and 30 days when you need broader source/metric coverage. A background timestamp is evidence that the native observer delivered a successful private sync; it does not verify a vendor source by itself.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Physical source acceptance console") {
                    Text("These are the exact HealthKit source names and bundle IDs from the phone. Compare the latest representative values with the source app and Apple Health, then resolve the matching rows in Zero2Fit's Build 028 evidence matrix before using Verify Zepp or Verify RENPHO.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if model.sourceSummaries.isEmpty {
                        Text("No source bundles captured yet. Authorize HealthKit, then capture the last 24 hours or 30 days.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(model.sourceSummaries) { source in
                            DisclosureGroup {
                                VStack(alignment: .leading, spacing: 10) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("Bundle ID")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Text(source.sourceBundleId)
                                            .font(.caption.monospaced())
                                            .textSelection(.enabled)
                                    }

                                    HStack {
                                        Button("Copy bundle ID") { model.copyBundleId(source.sourceBundleId) }
                                        Spacer()
                                        Button("Copy source summary") { model.copySourceSummary(source) }
                                    }
                                    .buttonStyle(.borderless)

                                    LabeledContent("Samples", value: String(source.totalSamples))
                                    if !source.timingText.isEmpty {
                                        Text(source.timingText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }

                                    Divider()

                                    ForEach(source.metrics) { metric in
                                        VStack(alignment: .leading, spacing: 3) {
                                            HStack(alignment: .firstTextBaseline) {
                                                Text(metric.label)
                                                    .font(.subheadline.weight(.semibold))
                                                Spacer()
                                                Text(metric.valueText)
                                                    .font(.subheadline.monospacedDigit())
                                                    .multilineTextAlignment(.trailing)
                                            }
                                            Text(metric.detailText)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        .padding(.vertical, 3)
                                    }
                                }
                                .padding(.top, 8)
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(source.displayName)
                                        .font(.headline)
                                    Text("\(source.metrics.count) metric\(source.metrics.count == 1 ? "" : "s") · \(source.totalSamples) samples")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                Section("Trust boundary") {
                    Text("This companion only captures and displays HealthKit evidence. It never auto-classifies a bundle as Zepp or RENPHO and never authorizes permanent Fitness XP. Exact verification remains a separate user action in the web app after the Build 028 physical evidence matrix is complete.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
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
