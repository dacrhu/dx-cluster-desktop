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
    // default; forcing the Mesa vendor keeps EGL/GLX contexts off the NVIDIA
    // driver entirely (falls back to the i915 iGPU) without losing all
    // acceleration the way a blanket LIBGL_ALWAYS_SOFTWARE would.
    //
    // Fourth occurrence, in a build with all four knobs above already active
    // (verified live via /proc/<webprocess-pid>/environ before this freeze):
    // NVIDIA's EGL libraries were *still* mapped into the WebKitWebProcess.
    // Root cause: `__GLX_VENDOR_LIBRARY_NAME` only steers libglvnd's **GLX**
    // (X11) dispatch — it does nothing for **EGL**, which is the API
    // WebKitGTK actually opens (GBM/Wayland-style paths). EGL vendor
    // selection goes through libglvnd's separate ICD search
    // (`/usr/share/glvnd/egl_vendor.d/*.json`, tried in filename order), and
    // on this machine `10_nvidia.json` sorts before `50_mesa.json` — so
    // NVIDIA always won regardless of the GLX variable.
    //
    // Tried next: pointing `__EGL_VENDOR_LIBRARY_FILENAMES` at the installed
    // Mesa ICD file — this was WORSE, not better. It made EGL display
    // creation fail outright, every single launch, logged as `Could not
    // create default EGL display: EGL_BAD_PARAMETER. Aborting...` — no
    // WebKitWebProcess ever started at all (confirmed via the process tree:
    // the app's WebKitNetworkProcess child existed, its WebProcess sibling
    // never did), so the window painted its native chrome but the page
    // content stayed permanently blank from the very first frame — a 100%
    // reproducible, worse failure than the multi-hour intermittent hang it
    // was meant to fix. Reverted. `__GLX_VENDOR_LIBRARY_NAME` and
    // `__NV_PRIME_RENDER_OFFLOAD` are kept (harmless, and still correct for
    // any GLX path) but do not by themselves keep WebKitGTK's EGL context
    // off the NVIDIA driver — that half of the problem is open again; the
    // next attempt should look at excluding the NVIDIA ICD (e.g. via
    // `__EGL_VENDOR_LIBRARY_DIRS` pointed at a directory containing only the
    // Mesa json) rather than a bare `__EGL_VENDOR_LIBRARY_FILENAMES`
    // override, and must be verified with a real launch (checking for the
    // WebProcess actually starting), not just a `/proc/.../environ` read.
    // Must be set before GTK/WebKit initialise, i.e. before `run()` builds
    // the webview. Trades rendering performance (map/bandmap redraws) for
    // stability; both are GTK/Linux-only knobs, meaningless (and left
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
