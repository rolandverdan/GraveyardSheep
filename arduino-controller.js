(() => {
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", "Arduino controller");
  panel.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:1000000;width:min(320px,calc(100vw - 28px));padding:12px;border:1px solid #34d39966;border-radius:14px;background:#111c20f2;color:#fff7e6;font:14px system-ui,sans-serif;box-shadow:0 8px 28px #0009;text-align:center";
  panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap"><strong style="color:#a7f3d0">Arduino</strong><span data-status style="font-size:12px">Not connected</span><button data-connect type="button" style="border:0;border-radius:8px;padding:8px 12px;background:#6ee7b7;color:#10201c;font-weight:800;cursor:pointer">Connect COM port</button><button data-disconnect type="button" hidden style="border:1px solid #ffffff55;border-radius:8px;padding:7px 10px;background:transparent;color:white;cursor:pointer">Disconnect</button></div><div data-log style="margin-top:7px;max-height:46px;overflow:auto;overflow-wrap:anywhere;text-align:left;color:#a7f3d0;font-size:11px">Choose your Arduino port. Serial speed: 115200 baud.</div>';
  document.body.append(panel);

  const status = panel.querySelector("[data-status]");
  const log = panel.querySelector("[data-log]");
  const connectButton = panel.querySelector("[data-connect]");
  const disconnectButton = panel.querySelector("[data-disconnect]");
  const pressedKeys = new Map();
  const commandMap = {
    KEY_W: ["w", "KeyW"], W: ["w", "KeyW"],
    KEY_A: ["a", "KeyA"], A: ["a", "KeyA"],
    KEY_S: ["s", "KeyS"], S: ["s", "KeyS"],
    KEY_D: ["d", "KeyD"], D: ["d", "KeyD"],
    KEY_E: ["e", "KeyE"], E: ["e", "KeyE"],
    KEY_SPACE: [" ", "Space"], SPACE: [" ", "Space"]
  };

  function report(message) {
    log.textContent = message;
    console.log("Arduino:", message);
  }

  function sendCommand(raw) {
    let command = raw.trim().toUpperCase().replace(/[\r\0]/g, "");
    if (!command) return;
    let mode = "pulse";
    const holdMatch = command.match(/^(KEY_)?(W|A|S|D|E|SPACE)_(DOWN|UP|RELEASE)$/);
    if (holdMatch) {
      command = `${holdMatch[1] || "KEY_"}${holdMatch[2]}`;
      mode = holdMatch[3] === "DOWN" ? "down" : "up";
    }
    const mapped = commandMap[command];
    report(mapped ? `Received ${command}${mode === "pulse" ? "" : `_${mode.toUpperCase()}`} → keyboard ${mapped[0] === " " ? "Space" : mapped[0].toUpperCase()}` : `Received unsupported command: ${command}`);
    if (!mapped) return;

    const [key, code] = mapped;
    const active = pressedKeys.get(code);
    if (mode === "up") {
      if (active) {
        clearTimeout(active.timer);
        document.body.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
        pressedKeys.delete(code);
      }
      return;
    }
    if (!active) document.body.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
    clearTimeout(active?.timer);
    const timer = mode === "down" ? null : setTimeout(() => {
      document.body.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
      pressedKeys.delete(code);
    }, 350);
    pressedKeys.set(code, { key, timer });
  }

  let port = null;
  let reader = null;
  let keepReading = false;

  async function disconnect() {
    keepReading = false;
    try { if (reader) await reader.cancel(); } catch (_) {}
    reader = null;
    if (port) try { await port.close(); } catch (_) {}
    port = null;
    for (const [code, active] of pressedKeys) {
      clearTimeout(active.timer);
      document.body.dispatchEvent(new KeyboardEvent("keyup", { key: active.key, code, bubbles: true }));
    }
    pressedKeys.clear();
    status.textContent = "Not connected";
    connectButton.hidden = false;
    disconnectButton.hidden = true;
    report("Disconnected");
  }

  connectButton.addEventListener("click", async () => {
    if (!("serial" in navigator)) {
      status.textContent = "Unsupported browser";
      report("Web Serial requires desktop Chrome or Edge on localhost or HTTPS.");
      return;
    }
    connectButton.disabled = true;
    report("Select your Arduino COM port in the browser picker.");
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      status.textContent = "Connected · 115200";
      connectButton.hidden = true;
      disconnectButton.hidden = false;
      report("CONNECTED · press a controller button to check input");
      keepReading = true;
      reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\n/);
        buffer = lines.pop() || "";
        for (const line of lines) sendCommand(line);
        if (buffer.length > 100) {
          sendCommand(buffer);
          buffer = "";
        }
      }
    } catch (error) {
      if (error.name === "NotFoundError") report("No COM port selected.");
      else report(`Connection/read error: ${error.message}`);
      status.textContent = "Not connected";
      if (port) try { await port.close(); } catch (_) {}
      port = null;
    } finally {
      try { reader?.releaseLock(); } catch (_) {}
      reader = null;
      keepReading = false;
      connectButton.disabled = false;
      connectButton.hidden = false;
      disconnectButton.hidden = true;
    }
  });
  disconnectButton.addEventListener("click", disconnect);
  if ("serial" in navigator) navigator.serial.addEventListener("disconnect", event => {
    if (port && event.target === port) disconnect();
  });
})();
