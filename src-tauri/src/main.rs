// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Find the installed libglvnd EGL vendor ICD file for Mesa (e.g.
/// `/usr/share/glvnd/egl_vendor.d/50_mesa.json`), searching the two
/// directories glvnd itself searches. Returns `None` (rather than guessing a
/// path) when it can't be found, so the caller can leave EGL vendor
/// selection alone instead of pointing `__EGL_VENDOR_LIBRARY_FILENAMES` at a
/// file that doesn't exist on this particular distro and breaking EGL
/// entirely for whoever's running it.
#[cfg(target_os = "linux")]
fn find_mesa_egl_vendor_file() -> Option<std::path::PathBuf> {
    for dir in ["/usr/share/glvnd/egl_vendor.d", "/etc/glvnd/egl_vendor.d"] {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            if name.contains("mesa") && name.ends_with(".json") {
                return Some(path);
            }
        }
    }
    None
}

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
    // default; forcing the Mesa vendor keeps EGL/GLX contexts off the NVIDIA
    // driver entirely (falls back to the i915 iGPU) without losing all
    // acceleration the way a blanket LIBGL_ALWAYS_SOFTWARE would.
    //
    // Fourth occurrence, in a *new* build with all four knobs above already
    // active (verified live via /proc/<webprocess-pid>/environ before this
    // freeze): NVIDIA's EGL libraries were *still* mapped into the
    // WebKitWebProcess. Root cause: `__GLX_VENDOR_LIBRARY_NAME` only steers
    // libglvnd's **GLX** (X11) dispatch — it does nothing for **EGL**, which
    // is the API WebKitGTK actually opens (GBM/Wayland-style paths). EGL
    // vendor selection goes through libglvnd's separate ICD search
    // (`/usr/share/glvnd/egl_vendor.d/*.json`, tried in filename order), and
    // on this machine `10_nvidia.json` sorts before `50_mesa.json` — so
    // NVIDIA always won regardless of the GLX variable. The fix is the
    // EGL-specific equivalent, `__EGL_VENDOR_LIBRARY_FILENAMES`, pointed at
    // the Mesa ICD file found above; `__GLX_VENDOR_LIBRARY_NAME` is kept too
    // since it's still correct for any GLX path. Must be set before
    // GTK/WebKit initialise, i.e. before `run()` builds the webview. Trades
    // rendering performance (map/bandmap redraws) for stability; all of
    // these are GTK/Linux-only knobs, meaningless (and left unset) on macOS
    // (WKWebView) and Windows (WebView2).
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("__GLX_VENDOR_LIBRARY_NAME", "mesa");
        std::env::set_var("__NV_PRIME_RENDER_OFFLOAD", "0");
        if let Some(mesa_egl) = find_mesa_egl_vendor_file() {
            std::env::set_var("__EGL_VENDOR_LIBRARY_FILENAMES", mesa_egl);
        }
    }

    dx_cluster_desktop_lib::run()
}
