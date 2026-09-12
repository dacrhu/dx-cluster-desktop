// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's GPU-accelerated compositing is known to hang/leak on
    // Wayland + the proprietary NVIDIA driver after some hours of uptime —
    // seen twice on this codebase's own reference machine: once as GPU
    // memory exhaustion (kernel-logged NV_ERR_NO_MEMORY) after ~24.5h with
    // stale-frame "ghosting", once (after disabling just the DMA-BUF
    // renderer below) as a silent render-thread hang after ~3h with no
    // GPU-memory error at all, only a compositor-side "frame has assigned
    // frame counter but no frame drawn time" — i.e. disabling DMA-BUF alone
    // was not sufficient; a different GPU-accelerated code path can wedge
    // the same way. So both knobs are set: DMA-BUF disables just that
    // renderer, COMPOSITING_MODE additionally forces WebKitGTK off *all*
    // GPU-accelerated compositing (its own documented last-resort flag for
    // this exact class of driver issue). Must be set before GTK/WebKit
    // initialise, i.e. before `run()` builds the webview. Trades rendering
    // performance (map/bandmap redraws) for stability; both are
    // GTK-port-of-WebKit knobs, meaningless (and left unset) on macOS
    // (WKWebView) and Windows (WebView2).
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    dx_cluster_desktop_lib::run()
}
