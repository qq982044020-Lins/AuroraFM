/* Aurora FM — 极简 MQTT 3.1.1 over WebSocket 客户端
 * 零依赖、纯浏览器 API：Electron 渲染层 / WebView / 浏览器通用。
 * 仅实现 CONNECT / SUBSCRIBE / UNSUBSCRIBE / PUBLISH(QoS0) / PING / DISCONNECT。
 */
(function () {
  "use strict";
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function utf8(str) {
    const b = enc.encode(String(str));
    const out = new Uint8Array(b.length + 2);
    out[0] = (b.length >> 8) & 255;
    out[1] = b.length & 255;
    out.set(b, 2);
    return out;
  }
  function remaining(n) {
    const bytes = [];
    do {
      let d = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) d |= 128;
      bytes.push(d);
    } while (n > 0);
    return Uint8Array.from(bytes);
  }
  function concat(parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  const pkt = (header, body) => concat([Uint8Array.of(header), remaining(body.length), body]);

  function readStr(buf, offset) {
    const len = (buf[offset] << 8) | buf[offset + 1];
    return [dec.decode(buf.subarray(offset + 2, offset + 2 + len)), offset + 2 + len];
  }

  function create(url, opts) {
    opts = opts || {};
    const clientId = opts.clientId || ("afm_" + Math.random().toString(36).slice(2, 12));
    const keepalive = 30;
    let ws = null;
    let buf = new Uint8Array(0);
    let packetId = 0;
    let closed = false;
    let connected = false;
    let pingTimer = null;
    let deadTimer = null;

    const nextId = () => { packetId = packetId >= 65535 ? 1 : packetId + 1; return packetId; };
    const send = (bytes) => { if (ws && ws.readyState === 1) { try { ws.send(bytes); } catch (_) {} } };

    function cleanup() {
      if (pingTimer) clearInterval(pingTimer);
      if (deadTimer) clearTimeout(deadTimer);
      pingTimer = deadTimer = null;
    }
    function fail(err) {
      if (closed) return;
      closed = true;
      connected = false;
      cleanup();
      try { ws && ws.close(); } catch (_) {}
      if (opts.onClose) opts.onClose(err);
    }
    function markAlive() {
      if (deadTimer) clearTimeout(deadTimer);
      deadTimer = setTimeout(() => fail(new Error("keepalive timeout")), keepalive * 2000);
    }

    function handle(frame) {
      const type = frame[0] >> 4;
      let i = 1, mult = 1, rem = 0, digit;
      do { digit = frame[i++]; rem += (digit & 127) * mult; mult *= 128; } while ((digit & 128) !== 0 && i < 5);
      const body = frame.subarray(i);
      if (type === 2) {                     // CONNACK
        if (body[1] === 0) {
          connected = true;
          pingTimer = setInterval(() => send(Uint8Array.of(0xc0, 0x00)), keepalive * 1000);
          if (opts.onOpen) opts.onOpen();
        } else fail(new Error("CONNACK error " + body[1]));
      } else if (type === 3) {              // PUBLISH (QoS0)
        let off = 0, topic;
        [topic, off] = readStr(body, 0);
        if (opts.onMessage) opts.onMessage(topic, dec.decode(body.subarray(off)));
      }
      // SUBACK(9) / UNSUBACK(11) / PINGRESP(13) 无需处理
    }

    function onData(data) {
      let chunk;
      if (data instanceof ArrayBuffer) chunk = new Uint8Array(data);
      else if (data instanceof Uint8Array) chunk = data;
      else if (data && data.buffer) chunk = new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || 0);
      else return;
      const merged = new Uint8Array(buf.length + chunk.length);
      merged.set(buf);
      merged.set(chunk, buf.length);
      buf = merged;
      // 一个 WS 帧里可能粘了多个 MQTT 包，循环解包
      while (buf.length >= 2) {
        let i = 1, mult = 1, rem = 0, digit;
        do {
          if (i >= buf.length) return;
          digit = buf[i++];
          rem += (digit & 127) * mult;
          mult *= 128;
        } while ((digit & 128) !== 0 && i < 5);
        const total = i + rem;
        if (buf.length < total) return;
        const frame = buf.subarray(0, total);
        buf = buf.subarray(total);
        try { handle(frame); } catch (_) { /* 忽略坏包 */ }
      }
    }

    const api = {
      isConnected: () => connected && !closed,
      subscribe(topic) {
        if (!connected) return;
        const id = nextId();
        send(pkt(0x82, concat([Uint8Array.of(id >> 8, id & 255), utf8(topic), Uint8Array.of(0)])));
      },
      unsubscribe(topic) {
        if (!connected) return;
        const id = nextId();
        send(pkt(0xa2, concat([Uint8Array.of(id >> 8, id & 255), utf8(topic)])));
      },
      publish(topic, payload) {
        if (!connected) return false;
        send(pkt(0x30, concat([utf8(topic), enc.encode(typeof payload === "string" ? payload : JSON.stringify(payload))])));
        return true;
      },
      end() {
        if (closed) return;
        closed = true;
        connected = false;
        cleanup();
        try { send(Uint8Array.of(0xe0, 0x00)); } catch (_) {}
        try { ws && ws.close(); } catch (_) {}
      },
    };

    try {
      ws = new WebSocket(url, "mqtt");
      ws.binaryType = "arraybuffer";
    } catch (e) {
      setTimeout(() => fail(e), 0);
      return api;
    }
    ws.onopen = () => {
      const vh = concat([utf8("MQTT"), Uint8Array.of(4, 0x02, keepalive >> 8, keepalive & 255)]);
      send(pkt(0x10, concat([vh, utf8(clientId)])));
      markAlive();
    };
    ws.onmessage = (e) => { markAlive(); onData(e.data); };
    ws.onclose = () => fail(new Error("connection closed"));
    ws.onerror = () => { /* 由 onclose 统一处理 */ };
    return api;
  }

  window.AuroraMQTT = { create };
})();
