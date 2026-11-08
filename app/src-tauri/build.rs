fn main() {
    // Neu bauen, wenn die Server-Adresse wechselt (sie wird mit option_env! eingebettet)
    println!("cargo:rerun-if-env-changed=MRX_SERVER_URL");
    tauri_build::build()
}
