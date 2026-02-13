const esbuild = require("esbuild");
const path = require("path");

const srcDir = path.join(__dirname, "src");
const outDir = path.join(__dirname, "dist");

// Determine build mode
const isProd = process.env.NODE_ENV === "production";

async function build() {
  try {
    console.log(`🚀 Building Plox extension (${isProd ? "PRODUCTION" : "DEVELOPMENT"})...`);

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

    console.log("✅ Build complete! Files in dist/");
  } catch (err) {
    console.error("❌ Build failed:", err.message);
    process.exit(1);
  }
}

build();
