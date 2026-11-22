package app.eyespy.localserver

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * A plain WebSocket server so this phone can host a game with no internet.
 * It knows nothing about the game: it only moves text between sockets and
 * the room logic, which runs in the web view.
 */
@CapacitorPlugin(name = "LocalServer")
class LocalServerPlugin : Plugin() {
    private var server: Server? = null
    private val sockets = ConcurrentHashMap<String, WebSocket>()

    @PluginMethod
    fun start(call: PluginCall) {
        val port = call.getInt("port") ?: 8787
        stopServer()
        val s = Server(port, call)
        server = s
        try {
            s.start()
        } catch (e: Exception) {
            server = null
            call.reject("Could not start server: ${e.message}")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopServer()
        call.resolve()
    }

    @PluginMethod
    fun sendMany(call: PluginCall) {
        val messages = call.getArray("messages")
        if (messages == null) {
            call.reject("messages is required")
            return
        }
        for (i in 0 until messages.length()) {
            val m = messages.optJSONObject(i) ?: continue
            val socket = sockets[m.optString("id")] ?: continue
            try {
                if (socket.isOpen) socket.send(m.optString("data"))
            } catch (_: Exception) {
                // The close callback will report it.
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun close(call: PluginCall) {
        val id = call.getString("id")
        sockets[id]?.close(1000, "closed by host")
        call.resolve()
    }

    @PluginMethod
    fun getAddresses(call: PluginCall) {
        val result = JSObject()
        val list = com.getcapacitor.JSArray()
        try {
            for (iface in NetworkInterface.getNetworkInterfaces().toList()) {
                if (!iface.isUp || iface.isLoopback) continue
                for (addr in iface.inetAddresses.toList()) {
                    if (addr is Inet4Address && !addr.isLoopbackAddress) list.put(addr.hostAddress)
                }
            }
        } catch (_: Exception) {
        }
        result.put("addresses", list)
        call.resolve(result)
    }

    override fun handleOnDestroy() {
        stopServer()
        super.handleOnDestroy()
    }

    private fun stopServer() {
        val s = server ?: return
        server = null
        try {
            s.stop(500)
        } catch (_: Exception) {
        }
        sockets.clear()
    }

    private inner class Server(private val port: Int, private var startCall: PluginCall?) :
        WebSocketServer(InetSocketAddress(port)) {

        init {
            isReuseAddr = true
            isTcpNoDelay = true
            // The game runs its own 2-second heartbeat.
            connectionLostTimeout = 0
        }

        override fun onStart() {
            startCall?.resolve(JSObject().put("port", port))
            startCall = null
        }

        override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
            val id = UUID.randomUUID().toString()
            conn.setAttachment(id)
            sockets[id] = conn
            val address = conn.remoteSocketAddress?.address?.hostAddress
            notifyListeners("connection", JSObject().put("id", id).put("address", address))
        }

        override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
            val id = conn.getAttachment<String>() ?: return
            sockets.remove(id)
            notifyListeners("close", JSObject().put("id", id))
        }

        override fun onMessage(conn: WebSocket, message: String) {
            val id = conn.getAttachment<String>() ?: return
            notifyListeners("message", JSObject().put("id", id).put("data", message))
        }

        override fun onError(conn: WebSocket?, ex: Exception) {
            if (conn == null) {
                // Server-level failure, usually the port is taken.
                startCall?.reject("Could not start server: ${ex.message}")
                startCall = null
                if (server === this) server = null
            }
        }
    }
}
