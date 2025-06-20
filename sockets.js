//./sockets.js
import {ServerSocket, ServerSocketClient, ClientSocketHandler} from "./sockets/serversocket.js";
import {getIO} from "./sockets/index.js"

export const sockets = {getIO,ServerSocket, ServerSocketClient, ClientSocketHandler};
