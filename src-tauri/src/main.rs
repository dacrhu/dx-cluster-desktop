// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF hardware-accelerated renderer is known to
    // leak/exhaust GPU memory over long sessions on Wayland + the
    // proprietary NVIDIA driver, eventually causing stale-frame "ghosting"
    // when the window moves and, once the driver can no longer allocate a
    // buffer at all, a full freeze or a WebKitWebProcess crash. Must be set
    // before GTK/WebKit initialise, i.e. before `run()` builds the webview.
    // Disabling it trades a little rendering performance for stability;
    // it's a GTK-port-of-WebKit knob, meaningless (and left unset) on
    // macOS (WKWebView) and Windows (WebView2).
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    dx_cluster_desktop_lib::run()
}
