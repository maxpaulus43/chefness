import CloudKit
import ExpoModulesCore

public final class ChefnessCloudModule: Module {
  private let container = CKContainer(identifier: "iCloud.com.maxpaulus.chefness")
  private let recordID = CKRecord.ID(recordName: "library-v1")
  private var observer: NSObjectProtocol?
  private let maxBytes = 20 * 1024 * 1024

  public func definition() -> ModuleDefinition {
    Name("ChefnessCloud")
    Events("accountChanged")
    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: .CKAccountChanged, object: nil, queue: .main
      ) { [weak self] _ in self?.sendEvent("accountChanged", [:]) }
    }
    OnDestroy {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
    }
    AsyncFunction("account") { () async throws -> String in
      do { return try await self.accountID() }
      catch { throw self.safeError(error) }
    }
    AsyncFunction("fetch") { (account: String) async throws -> [String: String] in
      do {
        try await self.checkAccount(account)
        let record: CKRecord
        do { record = try await self.container.privateCloudDatabase.record(for: self.recordID) }
        catch let error as CKError where error.code == .unknownItem {
          try await self.checkAccount(account)
          return ["payload": "", "token": ""]
        }
        guard let asset = record["snapshot"] as? CKAsset, let url = asset.fileURL else {
          throw self.failure("The iCloud library is unreadable. Your local data is safe; contact support.")
        }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= self.maxBytes else { throw self.tooLarge() }
        let data = try Data(contentsOf: url)
        guard let payload = String(data: data, encoding: .utf8) else {
          throw self.failure("The iCloud library is unreadable. Your local data is safe; contact support.")
        }
        let coder = NSKeyedArchiver(requiringSecureCoding: true)
        record.encodeSystemFields(with: coder)
        coder.finishEncoding()
        try await self.checkAccount(account)
        return ["payload": payload, "token": coder.encodedData.base64EncodedString()]
      } catch { throw self.safeError(error) }
    }
    AsyncFunction("save") { (account: String, payload: String, token: String) async throws -> Bool in
      do {
        try await self.checkAccount(account)
        let data = Data(payload.utf8)
        guard data.count <= self.maxBytes else { throw self.tooLarge() }
        let record: CKRecord
        if token.isEmpty {
          record = CKRecord(recordType: "ChefnessLibrary", recordID: self.recordID)
        } else {
          guard let encoded = Data(base64Encoded: token) else { throw self.failure("Invalid iCloud revision. Try syncing again.") }
          let decoder = try NSKeyedUnarchiver(forReadingFrom: encoded)
          decoder.requiresSecureCoding = true
          guard let decoded = CKRecord(coder: decoder), decoded.recordID == self.recordID else {
            throw self.failure("Invalid iCloud revision. Try syncing again.")
          }
          decoder.finishDecoding()
          record = decoded
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try data.write(to: url, options: .atomic)
        defer { try? FileManager.default.removeItem(at: url) }
        record["snapshot"] = CKAsset(fileURL: url)
        // Optimistic compare-and-save: never overwrite another device's unseen edits.
        let result = try await self.container.privateCloudDatabase.modifyRecords(
          saving: [record], deleting: [], savePolicy: .ifServerRecordUnchanged, atomically: true
        )
        guard let saved = result.saveResults[self.recordID] else { throw self.failure("iCloud did not confirm the save. Try again.") }
        _ = try saved.get()
        try await self.checkAccount(account)
        return true
      } catch let error as CKError where error.code == .serverRecordChanged {
        return false
      } catch { throw self.safeError(error) }
    }
  }

  private func accountID() async throws -> String {
    guard try await container.accountStatus() == .available else {
      throw failure("Sign in to iCloud and enable iCloud for Chefness in iOS Settings.")
    }
    return try await container.userRecordID().recordName
  }
  private func checkAccount(_ expected: String) async throws {
    guard try await accountID() == expected else {
      throw failure("Your iCloud account changed. Review iCloud Sync in Settings.")
    }
  }
  private func failure(_ message: String) -> NSError {
    NSError(domain: "ChefnessSync", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  private func tooLarge() -> NSError {
    failure("This text library exceeds the 20 MB sync limit. Local use is unaffected. Contact support.")
  }
  private func safeError(_ error: Error) -> Error {
    if (error as NSError).domain == "ChefnessSync" { return error }
    guard let cloud = error as? CKError else {
      return failure("iCloud sync failed. Your local changes are safe. Try again.")
    }
    switch cloud.code {
    case .quotaExceeded:
      return failure("iCloud storage is full. Free space or upgrade iCloud storage, then sync again.")
    case .notAuthenticated, .permissionFailure:
      return failure("Sign in to iCloud and enable iCloud for Chefness in iOS Settings.")
    case .networkUnavailable, .networkFailure:
      return failure("iCloud is offline. Your local changes will sync when the connection returns.")
    case .requestRateLimited, .serviceUnavailable, .zoneBusy:
      return failure("iCloud is busy. Your changes are safe and Chefness will retry shortly.")
    default:
      return failure("iCloud sync is unavailable. Your local changes are safe. Try again or contact support.")
    }
  }
}
