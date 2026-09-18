// main.rs — the desktop shell, and nothing more.
//
// There is no application logic here on purpose. The library is the same
// HTML, CSS and ES modules that run in the browser; this process exists
// to give them a window and a real filesystem.
//
// The filesystem plugin is the only capability granted, and
// capabilities/default.json narrows it to the app's own data directory.
// Nothing here can read her documents, her desktop, or anything else.
//
// Atomic writes need `rename`, which the fs plugin already provides and
// which is a single overwriting syscall on macOS. That is why there is
// no custom command in this file.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Ponyo's Little Library could not start");
}
