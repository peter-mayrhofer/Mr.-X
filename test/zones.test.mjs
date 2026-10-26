// Prüft die Spielfeld-Zonen: node test/zones.test.mjs
import { inZone } from "../zones.js";
import assert from "assert";
const t = (name, p, cuts, exp) => { assert.equal(inZone(p, cuts), exp, name); console.log("ok", name); };
t("Taubenmarkt im Spielfeld", { lat: 48.3036, lng: 14.2878 }, [0, 1, 2, 3], true);
t("Hauptplatz gesperrt bei Nord", { lat: 48.3058, lng: 14.2864 }, [0], false);
t("Hauptplatz ok ohne Sperre", { lat: 48.3058, lng: 14.2864 }, [], true);
t("Stadtpark gesperrt bei Ost", { lat: 48.3050, lng: 14.2970 }, [1], false);
t("Hessenplatz gesperrt bei Mitte-Ost", { lat: 48.2995, lng: 14.2955 }, [2], false);
t("Hessenplatz ok bei nur Ost", { lat: 48.2995, lng: 14.2955 }, [1], true);
t("Baumbachstraße gesperrt bei West", { lat: 48.3005, lng: 14.2840 }, [3], false);
t("auf der Humboldtstraße noch drinnen", { lat: 48.2985, lng: 14.29495 }, [2], true);
t("Urfahr draußen", { lat: 48.3120, lng: 14.2850 }, [], false);
t("Hauptbahnhof draußen", { lat: 48.2905, lng: 14.2915 }, [], false);
