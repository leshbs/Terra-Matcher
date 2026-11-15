import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const explorerFiles = [
  new URL("../../components/explore/ExploreShell.tsx", import.meta.url),
  new URL("../../components/explore/Inspector.tsx", import.meta.url),
  new URL("../../components/explore/LayerControl.tsx", import.meta.url),
  new URL("../../lib/explore/data.ts", import.meta.url),
];

test("Explorer interface and loader messages are in English", () => {
  const source = explorerFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  const IndonesianCopy = [
    "Peta medan interaktif",
    "Benda langit",
    "Jendela studi",
    "Memuat data peta",
    "Belum ada jendela",
    "Skenario acuan",
    "Titik sampel grid",
    "Gagal memuat data peta",
    "Coba lagi",
    "Klik kotak sampel",
    "Keterbatasan",
    "Layer sel kosong",
    "tidak ada di manifest",
  ];

  for (const text of IndonesianCopy) {
    assert.ok(!source.includes(text), `expected no Indonesian UI text: ${text}`);
  }
});
