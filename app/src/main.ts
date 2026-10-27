import "@fontsource-variable/inter/index.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "./ui/tokens.css";
import "./ui/base.css";
import "./lib/theme.svelte.ts";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
