fn main() {
    // Neu bauen, wenn die Server-Adresse wechselt (sie wird mit option_env! eingebettet)
    println!("cargo:rerun-if-env-changed=MRX_SERVER_URL");
    // App-Befehle bekommen Berechtigungen `allow-<befehl>` (capabilities/server.json: allow-grossbild-oeffnen, allow-melden)
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["grossbild_oeffnen", "melden"]),
        ),
    )
    .expect("Tauri-Build fehlgeschlagen")
}
