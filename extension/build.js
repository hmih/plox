const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

// Helper to copy manifest
async function copyManifest(outDir) {
  const manifestPath = path.join(__dirname, "dist", "manifest.json");
  const targetPath = path.join(outDir, "manifest.json");
  
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, targetPath);
    console.log(`📄 Copied manifest to ${outDir}`);
  } else {
    console.warn("⚠️ Warning: manifest.json not found in dist root.");
  }
}

const srcDir = path.join(__dirname, "src");

// Determine build mode and output directory
const isProd = process.env.PRODUCTION === "true";
const outDir = isProd ? path.join(__dirname, "dist/prod") : path.join(__dirname, "dist/dev");

async function build() {
  try {
    console.log(`🚀 Building Plox extension (${isProd ? "PRODUCTION" : "DEVELOPMENT"})...`);
    console.log(`📁 Output: ${outDir}`);

    await esbuild.build({
      entryPoints: [
        path.join(srcDir, "background.ts"),
        path.join(srcDir, "content.ts"),
        path.join(srcDir, "interceptor.ts"),
      ],
      bundle: true,
      outdir: outDir,
      
      // SECURITY & STEALTH CONFIGURATION
      minify: isProd,             // Total minification in production
      minifyIdentifiers: isProd,  // Obfuscate variable names
      minifySyntax: isProd,       // Compress syntax
      legalComments: "none",      // Strip all comments
      
      target: ["chrome121"],
      format: "iife",
      
      // DROP CONSOLE IN PRODUCTION
      drop: isProd ? ["console", "debugger"] : [],
      
      define: {
        // Inject dev mode flag for our log helper
        __DEV__: JSON.stringify(!isProd),
        
        PLOX_SERVER_URL: JSON.stringify(
          process.env.PLOX_SERVER_URL || "https://plox.krepost.xy",
        ),
      },
    });

    // Copy manifest to the build target
    await copyManifest(outDir);

    console.log(`✅ Build complete! Files in ${outDir}`);
  } catch (err) {
    console.error("❌ Build failed:", err.message);
    process.exit(1);
  }
}

build();
