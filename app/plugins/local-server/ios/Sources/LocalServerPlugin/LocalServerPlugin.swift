import Foundation
import Network
import Capacitor

/// A plain WebSocket server (Apple's Network framework) so this phone can host
/// a game with no internet. It knows nothing about the game: it only moves text
/// between sockets and the room logic, which runs in the web view.
@objc(LocalServerPlugin)
public class LocalServerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalServerPlugin"
    public let jsName = "LocalServer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendMany", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAddresses", returnType: CAPPluginReturnPromise),
    ]

    private let queue = DispatchQueue(label: "app.eyespy.localserver")
    private var listener: NWListener?
    private var connections: [String: NWConnection] = [:]

    @objc func start(_ call: CAPPluginCall) {
        let port = call.getInt("port") ?? 8787
        queue.async {
            self.stopListener()
            guard let nwPort = NWEndpoint.Port(rawValue: UInt16(clamping: port)) else {
                call.reject("Bad port")
                return
            }
            let parameters = NWParameters.tcp
            parameters.allowLocalEndpointReuse = true
            parameters.includePeerToPeer = true
            let ws = NWProtocolWebSocket.Options()
            ws.autoReplyPing = true
            ws.maximumMessageSize = 256 * 1024
            parameters.defaultProtocolStack.applicationProtocols.insert(ws, at: 0)

            let listener: NWListener
            do {
                listener = try NWListener(using: parameters, on: nwPort)
            } catch {
                call.reject("Could not start server: \(error.localizedDescription)")
                return
            }
            var settled = false
            listener.stateUpdateHandler = { [weak self] state in
                switch state {
                case .ready:
                    if !settled { settled = true; call.resolve(["port": port]) }
                case .failed(let error):
                    if !settled { settled = true; call.reject("Could not start server: \(error.localizedDescription)") }
                    self?.stopListener()
                default:
                    break
                }
            }
            listener.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
            self.listener = listener
            listener.start(queue: self.queue)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            self.stopListener()
            call.resolve()
        }
    }

    @objc func sendMany(_ call: CAPPluginCall) {
        let messages = call.getArray("messages", JSObject.self) ?? []
        queue.async {
            for m in messages {
                guard let id = m["id"] as? String, let text = m["data"] as? String,
                      let conn = self.connections[id], let data = text.data(using: .utf8) else { continue }
                let meta = NWProtocolWebSocket.Metadata(opcode: .text)
                let context = NWConnection.ContentContext(identifier: "text", metadata: [meta])
                conn.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
            }
            call.resolve()
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        queue.async {
            self.drop(id)
            call.resolve()
        }
    }

    @objc func getAddresses(_ call: CAPPluginCall) {
        call.resolve(["addresses": LocalServerPlugin.ipv4Addresses()])
    }

    // MARK: - Connections

    private func accept(_ conn: NWConnection) {
        let id = UUID().uuidString
        connections[id] = conn
        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                var address: String? = nil
                if case let .hostPort(host, _) = conn.endpoint { address = "\(host)" }
                self.notifyListeners("connection", data: ["id": id, "address": address as Any])
            case .failed, .cancelled:
                self.drop(id)
            default:
                break
            }
        }
        conn.start(queue: queue)
        receive(id, conn)
    }

    private func receive(_ id: String, _ conn: NWConnection) {
        conn.receiveMessage { [weak self] data, context, _, error in
            guard let self = self else { return }
            if let error = error {
                _ = error
                self.drop(id)
                return
            }
            if let context = context,
               let meta = context.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata {
                switch meta.opcode {
                case .text:
                    if let data = data, let text = String(data: data, encoding: .utf8) {
                        self.notifyListeners("message", data: ["id": id, "data": text])
                    }
                case .close:
                    self.drop(id)
                    return
                default:
                    break
                }
            }
            if self.connections[id] != nil { self.receive(id, conn) }
        }
    }

    private func drop(_ id: String) {
        guard let conn = connections.removeValue(forKey: id) else { return }
        conn.stateUpdateHandler = nil
        conn.cancel()
        notifyListeners("close", data: ["id": id])
    }

    private func stopListener() {
        listener?.cancel()
        listener = nil
        for id in Array(connections.keys) { drop(id) }
    }

    // MARK: - Addresses

    /// IPv4 addresses on Wi-Fi (en*) and Personal Hotspot (bridge*) interfaces.
    static func ipv4Addresses() -> [String] {
        var result: [String] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return result }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let iface = p.pointee
            if let addr = iface.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) {
                let name = String(cString: iface.ifa_name)
                if name.hasPrefix("en") || name.hasPrefix("bridge") {
                    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    if getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                        result.append(String(cString: host))
                    }
                }
            }
            ptr = iface.ifa_next
        }
        return result
    }
}
