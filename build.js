const esbuild = require("esbuild");
const path = require("path");

const srcDir = path.join(__dirname, "src");
const outDir = path.join(__dirname, "extension");

async function build() {
  try {
    console.log("🚀 Building Plox extension...");

    await esbuild.build({
      entryPoints: [
        path.join(srcDir, "background.ts"),
        path.join(srcDir, "content.ts"),
      ],
      bundle: true,
      outdir: outDir,
      minify: false, // Keep readable for now
      target: ["chrome121"],
      format: "iife", // Standard for extension scripts
    });

    console.log("✅ Build complete! Files in extension/");
  } catch (err) {
    console.error("❌ Build failed:", err.message);
    process.exit(1);
  }
}

build();
