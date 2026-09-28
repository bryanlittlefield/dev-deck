// duo87-keys — tiny keyboard / clipboard helper used by the DUO87 Dev Deck plugin.
//
//   duo87-keys [--dry-run] <step> [<step> ...]
//
// Steps run in order:
//   activate <bundle id | app name>   bring an app to the front and wait until it is frontmost
//   wait <ms>                         pause
//   key <combo>                       tap one key combo: cmd+shift+p, ctrl+alt+f16, enter, esc, 1
//   paste <text>                      paste text through the clipboard, then restore the clipboard
//   type <text>                       type text as unicode keystrokes (no clipboard)
//   check                             exit 0 if Accessibility access is granted, 3 if not
//
// Posting keystrokes needs Accessibility access for the app that launches this helper
// (DUO87_Play_Deck when run from the plugin). Build: swiftc -O -o duo87-keys duo87-keys.swift

import Cocoa
import ApplicationServices

let keyCodes: [String: CGKeyCode] = [
    "a": 0x00, "s": 0x01, "d": 0x02, "f": 0x03, "h": 0x04, "g": 0x05, "z": 0x06, "x": 0x07,
    "c": 0x08, "v": 0x09, "b": 0x0B, "q": 0x0C, "w": 0x0D, "e": 0x0E, "r": 0x0F, "y": 0x10,
    "t": 0x11, "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17, "=": 0x18,
    "9": 0x19, "7": 0x1A, "-": 0x1B, "8": 0x1C, "0": 0x1D, "]": 0x1E, "o": 0x1F, "u": 0x20,
    "[": 0x21, "i": 0x22, "p": 0x23, "l": 0x25, "j": 0x26, "'": 0x27, "k": 0x28, ";": 0x29,
    "\\": 0x2A, ",": 0x2B, "/": 0x2C, "n": 0x2D, "m": 0x2E, ".": 0x2F, "`": 0x32,
    "backslash": 0x2A, "slash": 0x2C, "comma": 0x2B, "period": 0x2F, "grave": 0x32,
    "backtick": 0x32, "minus": 0x1B, "equal": 0x18, "plus": 0x18, "semicolon": 0x29,
    "quote": 0x27, "bracketleft": 0x21, "bracketright": 0x1E,
    "enter": 0x24, "return": 0x24, "tab": 0x30, "space": 0x31, "backspace": 0x33,
    "delete": 0x33, "esc": 0x35, "escape": 0x35, "fwddelete": 0x75, "forwarddelete": 0x75,
    "home": 0x73, "end": 0x77, "pageup": 0x74, "pagedown": 0x79,
    "left": 0x7B, "right": 0x7C, "down": 0x7D, "up": 0x7E,
    "f1": 0x7A, "f2": 0x78, "f3": 0x63, "f4": 0x76, "f5": 0x60, "f6": 0x61, "f7": 0x62,
    "f8": 0x64, "f9": 0x65, "f10": 0x6D, "f11": 0x67, "f12": 0x6F, "f13": 0x69, "f14": 0x6B,
    "f15": 0x71, "f16": 0x6A, "f17": 0x40, "f18": 0x4F, "f19": 0x50, "f20": 0x5A,
]

let modifiers: [String: (code: CGKeyCode, flag: CGEventFlags)] = [
    "cmd": (0x37, .maskCommand), "command": (0x37, .maskCommand), "meta": (0x37, .maskCommand),
    "shift": (0x38, .maskShift),
    "ctrl": (0x3B, .maskControl), "control": (0x3B, .maskControl),
    "alt": (0x3A, .maskAlternate), "opt": (0x3A, .maskAlternate), "option": (0x3A, .maskAlternate),
    "fn": (0x3F, .maskSecondaryFn),
]

var dryRun = false
let source = CGEventSource(stateID: .hidSystemState)

func fail(_ message: String, code: Int32 = 2) -> Never {
    FileHandle.standardError.write(("duo87-keys: " + message + "\n").data(using: .utf8)!)
    exit(code)
}

func pause(_ ms: Int) {
    RunLoop.current.run(until: Date().addingTimeInterval(Double(ms) / 1000.0))
}

func requireAccessibility() {
    if !dryRun && !AXIsProcessTrusted() {
        fail("Accessibility access is not granted to the app that launched this helper. "
            + "Enable it in System Settings > Privacy & Security > Accessibility.", code: 3)
    }
}

func post(_ code: CGKeyCode, down: Bool, flags: CGEventFlags) {
    guard let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down) else { return }
    event.flags = flags
    event.post(tap: .cghidEventTap)
}

func parseCombo(_ combo: String) -> (mods: [(code: CGKeyCode, flag: CGEventFlags)], key: CGKeyCode) {
    let lower = combo.lowercased()
    // A trailing "+" means the plus/equal key itself, e.g. "cmd++".
    var parts = lower.split(separator: "+", omittingEmptySubsequences: true).map(String.init)
    if lower.hasSuffix("++") { parts.append("plus") }
    guard let keyName = parts.last else { fail("empty key combo") }
    var mods: [(code: CGKeyCode, flag: CGEventFlags)] = []
    for name in parts.dropLast() {
        guard let mod = modifiers[name] else { fail("unknown modifier '\(name)' in '\(combo)'") }
        mods.append(mod)
    }
    guard let key = keyCodes[keyName] else { fail("unknown key '\(keyName)' in '\(combo)'") }
    return (mods, key)
}

func tap(_ combo: String) {
    let parsed = parseCombo(combo)
    if dryRun {
        print("key \(combo) -> code 0x\(String(parsed.key, radix: 16)) mods \(parsed.mods.map { $0.code })")
        return
    }
    var flags: CGEventFlags = []
    for mod in parsed.mods {
        flags.insert(mod.flag)
        post(mod.code, down: true, flags: flags)
        usleep(4_000)
    }
    post(parsed.key, down: true, flags: flags)
    usleep(8_000)
    post(parsed.key, down: false, flags: flags)
    usleep(4_000)
    for mod in parsed.mods.reversed() {
        flags.remove(mod.flag)
        post(mod.code, down: false, flags: flags)
        usleep(4_000)
    }
}

func appURL(_ target: String) -> URL? {
    let ws = NSWorkspace.shared
    if target.hasPrefix("/") { return URL(fileURLWithPath: target) }
    if target.contains(".") && !target.lowercased().hasSuffix(".app") {
        if let url = ws.urlForApplication(withBundleIdentifier: target) { return url }
    }
    let name = target.lowercased().hasSuffix(".app") ? target : target + ".app"
    for dir in ["/Applications", "/System/Applications", "/System/Applications/Utilities",
                NSHomeDirectory() + "/Applications"] {
        let url = URL(fileURLWithPath: dir).appendingPathComponent(name)
        if FileManager.default.fileExists(atPath: url.path) { return url }
    }
    return nil
}

func activate(_ target: String) {
    if dryRun { print("activate \(target)"); return }
    guard let url = appURL(target) else { fail("app not found: \(target)") }
    let bundleID = Bundle(url: url)?.bundleIdentifier
    let ws = NSWorkspace.shared
    if let front = ws.frontmostApplication, front.bundleIdentifier == bundleID { return }
    // LaunchServices activation works under macOS cooperative activation rules,
    // unlike NSRunningApplication.activate() from a background process.
    let config = NSWorkspace.OpenConfiguration()
    config.activates = true
    let done = DispatchSemaphore(value: 0)
    ws.openApplication(at: url, configuration: config) { _, _ in done.signal() }
    _ = done.wait(timeout: .now() + 3)
    let deadline = Date().addingTimeInterval(1.5)
    while Date() < deadline {
        if ws.frontmostApplication?.bundleIdentifier == bundleID { break }
        pause(20)
    }
    pause(90) // let the window take keyboard focus
}

func paste(_ text: String) {
    if dryRun { print("paste \(text.count) chars"); return }
    let pb = NSPasteboard.general
    let saved: [NSPasteboardItem] = (pb.pasteboardItems ?? []).map { item in
        let copy = NSPasteboardItem()
        for type in item.types {
            if let data = item.data(forType: type) { copy.setData(data, forType: type) }
        }
        return copy
    }
    pb.clearContents()
    pb.setString(text, forType: .string)
    // Ask clipboard managers not to record this temporary entry.
    pb.setData(Data(), forType: NSPasteboard.PasteboardType("org.nspasteboard.TransientType"))
    let ours = pb.changeCount
    pause(30)
    tap("cmd+v")
    pause(700)
    if pb.changeCount == ours {
        pb.clearContents()
        if !saved.isEmpty { pb.writeObjects(saved) }
    }
}

func typeText(_ text: String) {
    if dryRun { print("type \(text.count) chars"); return }
    let units = Array(text.utf16)
    var index = 0
    while index < units.count {
        var chunk = Array(units[index..<min(index + 16, units.count)])
        for down in [true, false] {
            guard let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down) else { continue }
            event.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: &chunk)
            event.post(tap: .cghidEventTap)
        }
        usleep(12_000)
        index += 16
    }
}

var args = Array(CommandLine.arguments.dropFirst())
if args.first == "--dry-run" { dryRun = true; args.removeFirst() }
if args.isEmpty { fail("usage: duo87-keys [--dry-run] activate <app> | wait <ms> | key <combo> | paste <text> | type <text> | check") }

var i = 0
func nextArg(_ step: String) -> String {
    i += 1
    guard i < args.count else { fail("'\(step)' needs an argument") }
    return args[i]
}

while i < args.count {
    let step = args[i]
    switch step {
    case "check":
        let trusted = AXIsProcessTrusted()
        print(trusted ? "accessibility: granted" : "accessibility: not granted")
        exit(trusted ? 0 : 3)
    case "activate":
        activate(nextArg(step))
    case "wait":
        let value = nextArg(step)
        guard let ms = Int(value) else { fail("wait needs milliseconds, got '\(value)'") }
        if !dryRun { pause(ms) }
    case "key":
        requireAccessibility()
        tap(nextArg(step))
    case "paste":
        requireAccessibility()
        paste(nextArg(step))
    case "type":
        requireAccessibility()
        typeText(nextArg(step))
    default:
        fail("unknown step '\(step)'")
    }
    i += 1
}
