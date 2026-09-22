// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's GPU-accelerated compositing is known to hang/leak on
    // Wayland + the proprietary NVIDIA driver after some hours of uptime —
    // seen three times now on this codebase's own reference machine: once as
    // GPU memory exhaustion (kernel-logged NV_ERR_NO_MEMORY) after ~24.5h
    // with stale-frame "ghosting", once (after disabling just the DMA-BUF
    // renderer below) as a silent render-thread hang after ~3h with no
    // GPU-memory error at all, only a compositor-side "frame has assigned
    // frame counter but no frame drawn time" — i.e. disabling DMA-BUF alone
    // was not sufficient; a different GPU-accelerated code path can wedge
    // the same way. So both knobs are set: DMA-BUF disables just that
    // renderer, COMPOSITING_MODE additionally forces WebKitGTK off *all*
    // GPU-accelerated compositing (its own documented last-resort flag for
    // this exact class of driver issue). Third occurrence (this time in
    // under 2h, with both knobs already active): a live `gdb` attach to the
    // hung WebKitWebProcess showed `libEGL_nvidia`/`libnvidia-egl-gbm`/
    // `libnvidia-egl-wayland` still mapped and the app's own alert log
    // proved the Rust side + page JS kept running throughout — only the
    // compositor's frame presentation was wedged — so the two WEBKIT_*
    // knobs above (WebKit's own internal compositor) don't stop WebKitGTK
    // from still opening an NVIDIA EGL context for some other GPU-accelerated
    // path (video/canvas/etc). The reference machine is a hybrid Intel +
    // NVIDIA (Optimus/PRIME) laptop with no offload request made anywhere in
    // this app, so GLVND is free to hand out the NVIDIA vendor library by
    // default; forcing the Mesa vendor here keeps EGL/GLX contexts off the
    // NVIDIA driver entirely (falls back to the i915 iGPU) without losing
    // all acceleration the way a blanket LIBGL_ALWAYS_SOFTWARE would. Must
    // be set before GTK/WebKit initialise, i.e. before `run()` builds the
    // webview. Trades rendering performance (map/bandmap redraws) for
    // stability; all four are GTK/Linux-only knobs, meaningless (and left
    // unset) on macOS (WKWebView) and Windows (WebView2).
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("__GLX_VENDOR_LIBRARY_NAME", "mesa");
        std::env::set_var("__NV_PRIME_RENDER_OFFLOAD", "0");
    }

    dx_cluster_desktop_lib::run()
}
