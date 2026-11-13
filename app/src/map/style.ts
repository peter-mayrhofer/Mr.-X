// Eigener Kartenstil auf OpenFreeMap-Vektorkacheln (OpenMapTiles-Schema), E-07.
// Gedämpfte Basiskarte, Straßennamen groß und kontrastreich, Haltestellen sichtbar (Öffi-Regel),
// darüber die Spiel-Ebenen: außerhalb abgedunkelt, leuchtend rote Grenze, gesperrte Bereiche schraffiert.
import type { ExpressionSpecification, LayerSpecification, StyleSpecification, GeoJSONSourceSpecification } from "maplibre-gl";
import type { Theme } from "../lib/theme.svelte.ts";
import { T } from "../texte.ts";

interface Palette {
  bg: string;
  park: string;
  water: string;
  building: string;
  buildingLine: string;
  casing: string;
  minor: string;
  major: string;
  path: string;
  pedestrian: string;
  rail: string;
  label: string;
  labelHalo: string;
  labelMinor: string;
  stop: string;
  mask: string;
  border: string;
  borderGlow: string;
  cutLine: string;
  cutLabel: string;
  trail: string;
  labelBoost: number;
  roadBoost: number;
}

// Werte passend zu ui/tokens.css (gleiche Farbwelt, für die Karte gedämpft)
const PAL: Record<Theme, Palette> = {
  dunkel: {
    bg: "#0d1b28",
    park: "#10291f",
    water: "#0b2c45",
    building: "#14263a",
    buildingLine: "#1b3149",
    casing: "#08121b",
    minor: "#2a4057",
    major: "#3a5774",
    path: "#2a4057",
    pedestrian: "#33506b",
    rail: "#5f7891",
    label: "#e8eef4",
    labelHalo: "#0d1b28",
    labelMinor: "#b4c4d3",
    stop: "#7cbcff",
    mask: "rgba(2, 6, 10, 0.8)",
    border: "#ff4636",
    borderGlow: "rgba(255, 70, 54, 0.55)",
    cutLine: "#ff8a80",
    cutLabel: "#ffffff",
    trail: "#ff6a5c",
    labelBoost: 0,
    roadBoost: 0,
  },
  hell: {
    bg: "#eef1f4",
    park: "#d7ead8",
    water: "#b8d6ea",
    building: "#dde3e9",
    buildingLine: "#cdd5dd",
    casing: "#b9c4ce",
    minor: "#ffffff",
    major: "#ffffff",
    path: "#e9edf1",
    pedestrian: "#fbf6ea",
    rail: "#8a99a8",
    label: "#16232f",
    labelHalo: "#ffffff",
    labelMinor: "#3b4d5e",
    stop: "#1565c0",
    mask: "rgba(11, 24, 37, 0.5)",
    border: "#c51a1a",
    borderGlow: "rgba(197, 26, 26, 0.35)",
    cutLine: "#a31414",
    cutLabel: "#7f0e0e",
    trail: "#c51a1a",
    labelBoost: 0,
    roadBoost: 0,
  },
  sonne: {
    bg: "#ffffff",
    park: "#e0f2e0",
    water: "#9ccbe8",
    building: "#e6e6e6",
    buildingLine: "#b0b0b0",
    casing: "#000000",
    minor: "#ffffff",
    major: "#ffffff",
    path: "#f2f2f2",
    pedestrian: "#fff6d6",
    rail: "#000000",
    label: "#000000",
    labelHalo: "#ffffff",
    labelMinor: "#000000",
    stop: "#0040a0",
    mask: "rgba(0, 0, 0, 0.5)",
    border: "#b30000",
    borderGlow: "rgba(179, 0, 0, 0.25)",
    cutLine: "#800000",
    cutLabel: "#800000",
    trail: "#b30000",
    labelBoost: 2,
    roadBoost: 1.5,
  },
};

// erst beim Aufbau der Karte lesen: dann steht die Übersetzung schon in T
const attribution = () =>
  `<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> ${T.karte.daten} <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>`;

const lines: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const polys: ExpressionSpecification = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const cls = (...c: string[]): ExpressionSpecification => ["match", ["get", "class"], c, true, false];
const notTunnel: ExpressionSpecification = ["!=", ["get", "brunnel"], "tunnel"];
const isTunnel: ExpressionSpecification = ["==", ["get", "brunnel"], "tunnel"];
const w = (z14: number, z18: number, boost = 1): ExpressionSpecification => [
  "interpolate",
  ["exponential", 1.6],
  ["zoom"],
  12,
  (z14 / 3) * boost,
  14,
  z14 * boost,
  18,
  z18 * boost,
];

/** Linienbreite je nach Klasse: Zoom-Interpolation muss außen stehen (Style-Spezifikation) */
const wBy = (key: string, values: string[], a: [number, number], b: [number, number], boost = 1): ExpressionSpecification => {
  const at = (i: 0 | 1, f = 1): ExpressionSpecification => ["match", ["get", key], values, a[i] * f * boost, b[i] * f * boost];
  return ["interpolate", ["exponential", 1.6], ["zoom"], 12, at(0, 1 / 3), 14, at(0), 18, at(1)];
};

/** Spiel-Ebenen als GeoJSON (werden von GameMap mit setData aktualisiert) */
export interface Overlays {
  mask: GeoJSON.FeatureCollection;
  boundary: GeoJSON.FeatureCollection;
  cuts: GeoJSON.FeatureCollection;
  preview: GeoJSON.FeatureCollection;
  trail: GeoJSON.FeatureCollection;
  accuracy: GeoJSON.FeatureCollection;
  /** Zonen-Editor: Linie, Eckpunkte, Mittelpunkte zum Einfügen */
  edit: GeoJSON.FeatureCollection;
}

export const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** raster = Ersatz, falls OpenFreeMap ausfällt: OSM-Rasterkacheln (E-07), Spiel-Ebenen bleiben */
export function mapStyle(theme: Theme, data: Overlays, raster = false): StyleSpecification {
  const c = PAL[theme];
  const rb = 1 + c.roadBoost / 3;
  const geo = (d: GeoJSON.FeatureCollection): GeoJSONSourceSpecification => ({ type: "geojson", data: d });
  const font = (bold: boolean) => [bold ? "Noto Sans Bold" : "Noto Sans Regular"];
  const label = (size14: number, size18: number): ExpressionSpecification => [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    size14 + c.labelBoost,
    18,
    size18 + c.labelBoost,
  ];

  const base: LayerSpecification[] = [
    { id: "bg", type: "background", paint: { "background-color": c.bg } },
    { id: "park", type: "fill", source: "omt", "source-layer": "park", filter: polys, paint: { "fill-color": c.park } },
    {
      id: "landcover",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["all", polys, cls("grass", "wood")],
      paint: { "fill-color": c.park },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      filter: ["all", polys, notTunnel],
      paint: { "fill-color": c.water },
    },
    {
      id: "building",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 13,
      paint: { "fill-color": c.building, "fill-outline-color": c.buildingLine },
    },
    {
      id: "tunnel",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, isTunnel, cls("motorway", "trunk", "primary", "secondary", "tertiary", "minor")],
      paint: { "line-color": c.major, "line-width": w(4, 14, rb), "line-opacity": 0.5, "line-dasharray": [2, 1.5] },
    },
    {
      id: "road-casing",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, cls("motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.casing,
        "line-width": wBy("class", ["minor", "service"], [5, 16], [8, 24], rb),
      },
    },
    {
      id: "path",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, cls("path")],
      minzoom: 14,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "subclass"], ["pedestrian"], c.pedestrian, c.path],
        "line-width": wBy("subclass", ["pedestrian"], [4, 18], [1.5, 4], rb),
      },
    },
    {
      id: "road",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, cls("motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "class"], ["minor", "service"], c.minor, c.major],
        "line-width": wBy("class", ["minor", "service"], [3.5, 13], [6, 20], rb),
      },
    },
    {
      id: "rail",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, cls("rail", "transit")],
      minzoom: 13,
      paint: { "line-color": c.rail, "line-width": w(1.2, 2.5, rb), "line-dasharray": [3, 2] },
    },
  ];

  const game: LayerSpecification[] = [
    {
      id: "cuts-fill",
      type: "fill",
      source: "cuts",
      paint: { "fill-pattern": `hatch-${theme}`, "fill-opacity": 0.95 },
    },
    {
      id: "cuts-line",
      type: "line",
      source: "cuts",
      paint: { "line-color": c.cutLine, "line-width": 2.5, "line-dasharray": [2, 1.5] },
    },
    {
      id: "preview-line",
      type: "line",
      source: "preview",
      paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [1, 1.5] },
    },
    { id: "mask", type: "fill", source: "mask", paint: { "fill-color": c.mask } },
    {
      id: "boundary-glow",
      type: "line",
      source: "boundary",
      layout: { "line-join": "round" },
      paint: { "line-color": c.borderGlow, "line-width": 12, "line-blur": 8 },
    },
    {
      id: "boundary",
      type: "line",
      source: "boundary",
      layout: { "line-join": "round" },
      paint: { "line-color": c.border, "line-width": theme === "sonne" ? 5 : 3.5 },
    },
    {
      id: "accuracy",
      type: "fill",
      source: "accuracy",
      paint: {
        "fill-color": theme === "dunkel" ? "rgba(59,156,255,0.16)" : "rgba(21,101,192,0.14)",
        "fill-outline-color": theme === "dunkel" ? "#3b9cff" : "#1565c0",
      },
    },
    {
      id: "trail-line",
      type: "line",
      source: "trail",
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.trail, "line-width": 3, "line-dasharray": [1.5, 1.5], "line-opacity": 0.8 },
    },
    {
      id: "trail-dot",
      type: "circle",
      source: "trail",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 8,
        "circle-color": c.trail,
        "circle-opacity": ["get", "fade"],
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": ["get", "fade"],
      },
    },
  ];

  const edit: LayerSpecification[] = [
    {
      id: "edit-line",
      type: "line",
      source: "edit",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: { "line-color": ["get", "color"], "line-width": 3 },
    },
    {
      id: "edit-mid",
      type: "circle",
      source: "edit",
      minzoom: 15.5,
      filter: ["==", ["get", "kind"], "mid"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-opacity": 0.85,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 2,
      },
    },
    {
      id: "edit-vertex",
      type: "circle",
      source: "edit",
      filter: ["==", ["get", "kind"], "vertex"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, ["case", ["get", "sel"], 8, 3.5], 16, ["case", ["get", "sel"], 10, 7]],
        "circle-color": ["case", ["get", "sel"], "#ffc531", ["get", "color"]],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 16, 2.5],
      },
    },
  ];

  const labels: LayerSpecification[] = [
    {
      id: "water-name",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      filter: lines,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": font(false),
        "text-size": label(14, 18),
        "text-letter-spacing": 0.2,
      },
      paint: { "text-color": c.labelMinor, "text-halo-color": c.labelHalo, "text-halo-width": 1.5 },
    },
    {
      id: "street-name",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 13.5,
      filter: ["all", lines, ["!=", ["get", "class"], "rail"]],
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": font(true),
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          ["match", ["get", "class"], ["minor", "service", "path"], 12 + c.labelBoost, 13 + c.labelBoost],
          18,
          ["match", ["get", "class"], ["minor", "service", "path"], 16 + c.labelBoost, 18 + c.labelBoost],
        ],
        "text-max-angle": 30,
        "symbol-spacing": 280,
      },
      paint: { "text-color": c.label, "text-halo-color": c.labelHalo, "text-halo-width": theme === "sonne" ? 3 : 2 },
    },
    {
      id: "stop",
      type: "circle",
      source: "omt",
      "source-layer": "poi",
      minzoom: 15,
      filter: cls("bus", "railway"),
      paint: { "circle-radius": 5, "circle-color": c.stop, "circle-stroke-color": c.labelHalo, "circle-stroke-width": 2 },
    },
    {
      id: "stop-name",
      type: "symbol",
      source: "omt",
      "source-layer": "poi",
      minzoom: 16,
      filter: cls("bus", "railway"),
      layout: {
        "text-field": ["get", "name"],
        "text-font": font(false),
        "text-size": label(12, 14),
        "text-offset": [0, 1.1],
        "text-anchor": "top",
      },
      paint: { "text-color": c.stop, "text-halo-color": c.labelHalo, "text-halo-width": 2 },
    },
    {
      id: "trail-label",
      type: "symbol",
      source: "trail",
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["get", "label"],
        "text-font": font(true),
        "text-size": 14 + c.labelBoost,
        "text-offset": [1, 0],
        "text-anchor": "left",
      },
      paint: { "text-color": c.trail, "text-opacity": ["get", "fade"], "text-halo-color": c.labelHalo, "text-halo-width": 2 },
    },
    {
      id: "cuts-label",
      type: "symbol",
      source: "cuts",
      layout: {
        "text-field": ["concat", ["upcase", ["get", "short"]], "\n", ["get", "status"]],
        "text-font": font(true),
        "text-size": 15 + c.labelBoost,
        "text-letter-spacing": 0.12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": c.cutLabel, "text-halo-color": theme === "dunkel" ? "#07111a" : "#ffffff", "text-halo-width": 2.5 },
    },
  ];

  const osm: LayerSpecification[] = [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-saturation": -0.6, "raster-brightness-max": theme === "dunkel" ? 0.45 : 1 },
    },
  ];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ...(raster
        ? {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
          }
        : { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: attribution() } }),
      mask: geo(data.mask),
      boundary: geo(data.boundary),
      cuts: geo(data.cuts),
      preview: geo(data.preview),
      trail: geo(data.trail),
      accuracy: geo(data.accuracy),
      edit: geo(data.edit),
    },
    layers: raster
      ? [...osm, ...game, ...labels.filter((l) => l.id === "cuts-label" || l.id === "trail-label"), ...edit]
      : [...base, ...game, ...labels, ...edit],
  };
}

/** Schraffur-Muster für gesperrte Bereiche (wird bei Bedarf erzeugt) */
export function hatchImage(theme: Theme): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 24;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.fillStyle = theme === "dunkel" ? "rgba(197,26,26,0.20)" : "rgba(197,26,26,0.12)";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = theme === "dunkel" ? "rgba(255,106,92,0.75)" : theme === "sonne" ? "rgba(128,0,0,0.9)" : "rgba(163,20,20,0.6)";
  g.lineWidth = theme === "sonne" ? 4 : 3;
  for (const o of [-size, 0, size]) {
    g.beginPath();
    g.moveTo(o, size);
    g.lineTo(o + size, 0);
    g.stroke();
  }
  return { width: size, height: size, data: g.getImageData(0, 0, size, size).data };
}
