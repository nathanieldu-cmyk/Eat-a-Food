#!/usr/bin/env python3
"""Serve Eat a Food and relay multiplayer rooms.

    python3 server.py

Open http://127.0.0.1:8765 . The page connects to ws://<this host>/ws.
"""

import asyncio
import hashlib
import json
import mimetypes
import os
import secrets
import struct

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "0.0.0.0"
PORT = 8765
MAX_PLAYERS = 8
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

ROOMS = {}
CLIENTS = {}

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("text/css", ".css")


def new_code():
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
        if code not in ROOMS:
            return code


def roster(room):
    people = []
    for ws in room["order"]:
        info = room["clients"].get(ws)
        if not info:
            continue
        people.append(
            {
                "id": info["id"],
                "name": info["name"],
                "food": info.get("food") or "",
                "host": ws is room["host"],
            }
        )
    return people


def frame(opcode, payload):
    data = payload if isinstance(payload, (bytes, bytearray)) else payload.encode("utf-8")
    n = len(data)
    if n < 126:
        header = struct.pack("!BB", 0x80 | opcode, n)
    elif n < 65536:
        header = struct.pack("!BBH", 0x80 | opcode, 126, n)
    else:
        header = struct.pack("!BBQ", 0x80 | opcode, 127, n)
    return header + data


async def send_json(writer, obj):
    if writer.is_closing():
        return
    writer.write(frame(1, json.dumps(obj, separators=(",", ":"))))
    try:
        await writer.drain()
    except (ConnectionError, OSError):
        pass


async def broadcast(room, obj, skip=None):
    for ws in list(room["order"]):
        if ws is skip:
            continue
        await send_json(ws, obj)


async def send_roster(room):
    await broadcast(room, {"t": "roster", "players": roster(room)})


def drop_client(writer):
    info = CLIENTS.pop(writer, None)
    if not info:
        return None
    room = ROOMS.get(info["code"])
    if not room:
        return None
    room["clients"].pop(writer, None)
    if writer in room["order"]:
        room["order"].remove(writer)
    if room["host"] is writer:
        room["host"] = None
    return room


async def close_room(room, msg):
    code = room["code"]
    ROOMS.pop(code, None)
    for ws in list(room["order"]):
        CLIENTS.pop(ws, None)
        try:
            await send_json(ws, {"t": "closed", "msg": msg})
            ws.close()
        except (ConnectionError, OSError):
            pass
    room["order"].clear()
    room["clients"].clear()


class Reader:
    def __init__(self, reader):
        self.reader = reader
        self.buf = b""

    async def read(self, n):
        while len(self.buf) < n:
            chunk = await self.reader.read(max(4096, n - len(self.buf)))
            if not chunk:
                raise ConnectionError("closed")
            self.buf += chunk
        out = self.buf[:n]
        self.buf = self.buf[n:]
        return out

    async def headers(self):
        while b"\r\n\r\n" not in self.buf:
            chunk = await self.reader.read(4096)
            if not chunk:
                return None
            self.buf += chunk
            if len(self.buf) > 65536:
                return None
        raw, self.buf = self.buf.split(b"\r\n\r\n", 1)
        lines = raw.decode("latin1", "replace").split("\r\n")
        if not lines or not lines[0]:
            return None
        parts = lines[0].split(" ")
        if len(parts) < 2:
            return None
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()
        return parts[0].upper(), parts[1], headers


def safe_path(url_path):
    path = url_path.split("?", 1)[0].split("#", 1)[0]
    if path in ("", "/"):
        path = "/index.html"
    rel = os.path.normpath(path.lstrip("/"))
    if rel.startswith("..") or os.path.isabs(rel):
        return None
    full = os.path.join(ROOT, rel)
    if not full.startswith(ROOT):
        return None
    if not os.path.isfile(full):
        return None
    return full


async def serve_file(writer, url_path):
    full = safe_path(url_path)
    if not full:
        body = b"Not found"
        head = (
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/plain\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n\r\n"
        )
        writer.write(head.encode() + body)
        await writer.drain()
        writer.close()
        return
    mime = mimetypes.guess_type(full)[0] or "application/octet-stream"
    with open(full, "rb") as handle:
        body = handle.read()
    head = (
        "HTTP/1.1 200 OK\r\n"
        f"Content-Type: {mime}\r\n"
        f"Content-Length: {len(body)}\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: close\r\n\r\n"
    )
    writer.write(head.encode() + body)
    await writer.drain()
    writer.close()


def accept_key(key):
    digest = hashlib.sha1((key + GUID).encode("ascii")).digest()
    import base64

    return base64.b64encode(digest).decode("ascii")


async def read_frame(stream):
    first = await stream.read(2)
    b0, b1 = first[0], first[1]
    opcode = b0 & 0x0F
    masked = (b1 & 0x80) != 0
    length = b1 & 0x7F
    if length == 126:
        length = struct.unpack("!H", await stream.read(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", await stream.read(8))[0]
    if length > 8_000_000:
        raise ConnectionError("frame too large")
    mask = await stream.read(4) if masked else None
    payload = await stream.read(length) if length else b""
    if mask:
        payload = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
    return opcode, payload


def clean_name(value):
    text = str(value or "Player").strip()[:12]
    return text or "Player"


def clean_code(value):
    return "".join(ch for ch in str(value or "").upper() if ch.isalnum())[:4]


async def handle_socket(writer, stream, first):
    player_id = secrets.token_hex(4)
    CLIENTS[writer] = {"id": player_id, "name": "Player", "food": "", "code": None}
    try:
        kind = first.get("t")
        if kind == "create":
            code = new_code()
            room = {"code": code, "host": writer, "clients": {}, "order": []}
            ROOMS[code] = room
            info = CLIENTS[writer]
            info.update(
                {
                    "code": code,
                    "name": clean_name(first.get("name")),
                    "food": str(first.get("food") or "")[:80],
                    "role": "host",
                }
            )
            room["clients"][writer] = info
            room["order"].append(writer)
            await send_json(
                writer,
                {
                    "t": "room",
                    "code": code,
                    "id": player_id,
                    "host": True,
                    "players": roster(room),
                },
            )
        elif kind == "join":
            code = clean_code(first.get("code"))
            room = ROOMS.get(code)
            if not room or room["host"] is None:
                await send_json(writer, {"t": "err", "msg": "No room with that code."})
                writer.close()
                return
            if len(room["clients"]) >= MAX_PLAYERS:
                await send_json(writer, {"t": "err", "msg": "That room is full (8 players)."})
                writer.close()
                return
            info = CLIENTS[writer]
            info.update(
                {
                    "code": code,
                    "name": clean_name(first.get("name")),
                    "food": str(first.get("food") or "")[:80],
                    "role": "guest",
                }
            )
            room["clients"][writer] = info
            room["order"].append(writer)
            await send_json(
                writer,
                {
                    "t": "room",
                    "code": code,
                    "id": player_id,
                    "host": False,
                    "players": roster(room),
                },
            )
            await send_roster(room)
        else:
            await send_json(writer, {"t": "err", "msg": "Create or join a room first."})
            writer.close()
            return

        while True:
            opcode, payload = await read_frame(stream)
            if opcode == 8:
                break
            if opcode == 9:
                writer.write(frame(10, payload))
                await writer.drain()
                continue
            if opcode != 1:
                continue
            try:
                msg = json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            info = CLIENTS.get(writer)
            room = ROOMS.get(info["code"]) if info else None
            if not info or not room:
                break
            kind = msg.get("t")
            if info["role"] == "guest" and kind in ("in", "end"):
                msg["id"] = info["id"]
                if room["host"] is not None:
                    await send_json(room["host"], msg)
                if kind == "in":
                    food = str(msg.get("food") or "")[:80]
                    if food and food != info.get("food"):
                        info["food"] = food
                        await send_roster(room)
            elif info["role"] == "host" and kind in ("snap", "ev"):
                await broadcast(room, msg, skip=writer)
    except (ConnectionError, asyncio.IncompleteReadError, OSError):
        pass
    finally:
        room = drop_client(writer)
        if room:
            if room["host"] is None:
                await close_room(room, "The host left. You are back in single player.")
            else:
                await send_roster(room)
        try:
            writer.close()
        except OSError:
            pass


async def handle_client(reader, writer):
    stream = Reader(reader)
    try:
        request = await stream.headers()
        if not request:
            writer.close()
            return
        method, path, headers = request
        if method == "GET" and path.split("?", 1)[0] == "/ws":
            key = headers.get("sec-websocket-key")
            if not key or "upgrade" not in headers.get("connection", "").lower():
                writer.close()
                return
            accept = accept_key(key)
            writer.write(
                (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
                ).encode()
            )
            await writer.drain()
            opcode, payload = await read_frame(stream)
            if opcode != 1:
                writer.close()
                return
            try:
                first = json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                writer.close()
                return
            await handle_socket(writer, stream, first)
            return
        if method == "GET":
            await serve_file(writer, path)
            return
        writer.close()
    except (ConnectionError, asyncio.IncompleteReadError, OSError):
        try:
            writer.close()
        except OSError:
            pass


async def main():
    server = await asyncio.start_server(handle_client, HOST, PORT)
    print(f"Eat a Food at http://127.0.0.1:{PORT}")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
