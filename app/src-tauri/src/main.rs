// Im Release kein zusätzliches Konsolenfenster unter Windows – NICHT entfernen!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mister_x_lib::run()
}
